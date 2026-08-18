import { v4 as uuid } from 'uuid';
import { PlaywrightController } from '../browser/controller.js';
import { InvestigationState, InvestigationRequest, Phase, Finding } from '../types.js';
import { broadcast, broadcastActivity } from '../ws/broadcaster.js';
import { authenticatePhase } from './phases/authenticate.js';
import { explorePhase } from './phases/explore.js';
import { discoverPhase } from './phases/discover.js';
import { analyzePhase } from './phases/analyze.js';
import { verifyPhase } from './phases/verify.js';
import { evidencePhase } from './phases/evidence.js';
import { findingPhase } from './phases/finding.js';

let currentInvestigation: InvestigationState | null = null;
let findings: Finding[] = [];

export interface LastInvestigationSummary {
  id: string;
  target: string;
  completedAt: string;
  findingCount: number;
  pagesExplored: number;
  actionsDiscovered: number;
}

let lastSummary: LastInvestigationSummary | null = null;

export function getCurrentInvestigation(): InvestigationState | null {
  return currentInvestigation;
}

export function getFindings(): Finding[] {
  return findings;
}

export function getLastInvestigationSummary(): LastInvestigationSummary | null {
  return lastSummary;
}

export function clearFindings(): void {
  findings = [];
}

export async function runInvestigation(request: InvestigationRequest): Promise<Finding | null> {
  const id = uuid();
  const browser = new PlaywrightController();

  // Clear findings from any previous investigation — findings are scoped to the current run
  findings = [];

  currentInvestigation = {
    id,
    target: {
      url: request.url,
      credentials: { username: request.username, password: request.password },
    },
    phase: 'authenticating',
    sitemap: [],
    actions: [],
    rankedActions: [],
    verificationResults: [],
    finding: null,
    timeline: [],
    startedAt: new Date().toISOString(),
  };

  broadcast({ type: 'investigation_started', id });

  try {
    await browser.launch(true);
    broadcastActivity('Browser launched');

    // Phase 1: Authentication
    setPhase('authenticating');
    const authSuccess = await authenticatePhase(
      browser,
      request.url,
      request.username,
      request.password
    );

    if (!authSuccess) {
      broadcastActivity('Investigation aborted: authentication failed');
      broadcast({ type: 'error', message: 'Authentication failed' });
      recordSummary(request.url);
      setPhase('complete');
      return null;
    }

    // Phase 2: Exploration
    setPhase('exploring');
    currentInvestigation.sitemap = await explorePhase(browser, request.url);

    // Phase 3: Action Discovery
    setPhase('discovering');
    currentInvestigation.actions = discoverPhase(currentInvestigation.sitemap);

    if (currentInvestigation.actions.length === 0) {
      broadcastActivity('No actionable elements discovered. Investigation complete.');
      recordSummary(request.url);
      setPhase('complete');
      broadcast({ type: 'investigation_complete', id });
      return null;
    }

    // Phase 4: Risk Analysis
    setPhase('analyzing');
    currentInvestigation.rankedActions = analyzePhase(currentInvestigation.actions);

    // Phase 5: Verification
    setPhase('verifying');
    currentInvestigation.verificationResults = await verifyPhase(
      browser,
      currentInvestigation.rankedActions,
      request.url
    );

    // Phase 6: Evidence Collection
    setPhase('collecting-evidence');
    const evidence = await evidencePhase(browser, currentInvestigation.verificationResults);

    // Phase 7: Finding Generation
    setPhase('generating-finding');
    const actor = { email: request.username, role: 'employee' };
    const finding = findingPhase(
      currentInvestigation.verificationResults,
      evidence,
      actor,
      request.url
    );

    currentInvestigation.finding = finding;
    if (finding) {
      findings.push(finding);
    }

    recordSummary(request.url);
    setPhase('complete');
    broadcast({ type: 'investigation_complete', id });

    return finding;
  } catch (error) {
    const message = (error as Error).message;
    broadcastActivity(`Investigation error: ${message}`);
    broadcast({ type: 'error', message });
    recordSummary(request.url);
    setPhase('complete');
    return null;
  } finally {
    await browser.close();
  }
}

function setPhase(phase: Phase): void {
  if (currentInvestigation) {
    currentInvestigation.phase = phase;
  }
  broadcast({
    type: 'phase_changed',
    phase,
    timestamp: new Date().toISOString(),
  });
}

function recordSummary(targetUrl: string): void {
  lastSummary = {
    id: currentInvestigation?.id || '',
    target: targetUrl,
    completedAt: new Date().toISOString(),
    findingCount: findings.length,
    pagesExplored: currentInvestigation?.sitemap.length || 0,
    actionsDiscovered: currentInvestigation?.actions.length || 0,
  };
}
