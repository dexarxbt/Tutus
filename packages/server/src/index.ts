import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { initWebSocket } from './ws/broadcaster.js';
import { runInvestigation, getFindings, getCurrentInvestigation, clearFindings, getLastInvestigationSummary } from './engine/orchestrator.js';
import { InvestigationRequest } from './types.js';
import { replayFinding } from './browser/replay.js';

const app = express();
const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 3000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// REST API Routes
app.post('/api/investigate', async (req, res) => {
  const { url, username, password } = req.body as InvestigationRequest;

  if (!url || !username || !password) {
    res.status(400).json({ error: 'url, username, and password are required' });
    return;
  }

  // Don't await — start investigation in background
  const investigationPromise = runInvestigation({ url, username, password });

  // Clear stale replay results from previous investigation
  replayResults.clear();

  // Return immediately with investigation ID
  const current = getCurrentInvestigation();
  res.json({
    success: true,
    investigationId: current?.id,
    message: 'Investigation started',
  });

  // Let it run to completion
  investigationPromise.catch((err) => {
    console.error('[Investigation Error]', err);
  });
});

app.get('/api/findings', (req, res) => {
  res.json({ findings: getFindings() });
});

app.get('/api/findings/:id', (req, res) => {
  const finding = getFindings().find((f) => f.id === req.params.id);
  if (!finding) {
    res.status(404).json({ error: 'Finding not found' });
    return;
  }
  res.json({ finding });
});

app.get('/api/status', (req, res) => {
  const current = getCurrentInvestigation();
  if (!current) {
    res.json({ status: 'idle' });
    return;
  }
  res.json({
    status: current.phase,
    id: current.id,
    startedAt: current.startedAt,
    pagesDiscovered: current.sitemap.length,
    actionsDiscovered: current.actions.length,
  });
});

app.get('/api/last-investigation', (req, res) => {
  const summary = getLastInvestigationSummary();
  if (!summary) {
    res.json({ hasRun: false });
    return;
  }
  res.json({ hasRun: true, ...summary });
});

// Replay a finding
app.post('/api/replay', async (req, res) => {
  const { findingId } = req.body;

  if (!findingId) {
    res.status(400).json({ error: 'findingId is required' });
    return;
  }

  const finding = getFindings().find((f) => f.id === findingId);
  if (!finding) {
    res.status(404).json({ error: 'Finding not found' });
    return;
  }

  // Run replay in background
  const replayPromise = replayFinding(finding);

  res.json({ success: true, message: 'Replay started', findingId });

  replayPromise
    .then((result) => {
      // Store replay result accessible via API
      replayResults.set(findingId, result);
    })
    .catch((err) => {
      console.error('[Replay Error]', err);
    });
});

// Store replay results
const replayResults = new Map<string, any>();

app.get('/api/replay/:findingId', (req, res) => {
  const result = replayResults.get(req.params.findingId);
  if (!result) {
    res.status(404).json({ error: 'No replay result found for this finding' });
    return;
  }
  // Return without screenshot data in listing (too large)
  const { screenshots, ...rest } = result;
  res.json({
    ...rest,
    screenshotCount: screenshots.length,
    screenshots: screenshots.map((s: any) => ({ name: s.name, timestamp: s.timestamp })),
  });
});

app.get('/api/replay/:findingId/full', (req, res) => {
  const result = replayResults.get(req.params.findingId);
  if (!result) {
    res.status(404).json({ error: 'No replay result found for this finding' });
    return;
  }
  res.json(result);
});

// Create HTTP server and attach WebSocket
const server = createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`[Tutus Server] Running on http://localhost:${PORT}`);
  console.log(`[Tutus Server] WebSocket available at ws://localhost:${PORT}/ws`);
});
