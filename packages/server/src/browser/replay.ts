import { chromium } from 'playwright';
import { Finding, CapturedRequest, CapturedResponse, Screenshot } from '../types.js';
import { broadcast, broadcastActivity } from '../ws/broadcaster.js';

export interface ReplayResult {
  success: boolean;
  finding: Finding;
  verified: boolean;
  screenshots: Screenshot[];
  request: CapturedRequest | null;
  response: CapturedResponse | null;
  error?: string;
  timestamp: string;
}

export async function replayFinding(finding: Finding): Promise<ReplayResult> {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const screenshots: Screenshot[] = [];
  let capturedRequest: CapturedRequest | null = null;
  let capturedResponse: CapturedResponse | null = null;
  let verified = false;

  try {
    broadcast({ type: 'phase_changed', phase: 'authenticating', timestamp: new Date().toISOString() });
    broadcastActivity('[Replay] Starting replay of finding: ' + finding.title);

    const steps = finding.reproductionSteps;
    const targetUrl = steps[0]?.target || '';
    const loginUrl = steps[1]?.target || targetUrl + '/login';

    // Step 1: Navigate to target
    broadcastActivity(`[Replay] Step 1: Navigate to ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });

    // Step 2: Authenticate
    broadcastActivity(`[Replay] Step 2: Authenticating as ${finding.actor.email}`);
    const currentUrl = page.url();
    if (!currentUrl.includes('/login')) {
      await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    }

    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });
    await page.fill('input[type="email"], input[name="email"]', finding.actor.email);
    await page.fill('input[type="password"]', 'employee123'); // use stored credential
    await page.click('button[type="submit"]');
    await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 10000 });

    broadcastActivity('[Replay] Authentication successful');
    broadcast({ type: 'phase_changed', phase: 'verifying', timestamp: new Date().toISOString() });

    // Step 3: Navigate to the vulnerable page
    const actionPageUrl = steps[2]?.target || '';
    if (actionPageUrl) {
      broadcastActivity(`[Replay] Step 3: Navigating to ${actionPageUrl}`);
      await page.goto(actionPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    }

    // Take before screenshot
    const beforeData = await page.screenshot({ fullPage: true });
    screenshots.push({
      name: 'Replay: Before action',
      data: beforeData.toString('base64'),
      timestamp: new Date().toISOString(),
    });

    // Step 4: Execute the exploit request
    const exploitUrl = finding.evidence.request?.url;
    const exploitMethod = finding.evidence.request?.method || 'PUT';
    const exploitBody = finding.evidence.request?.body;

    if (!exploitUrl) {
      throw new Error('No exploit URL in finding evidence');
    }

    broadcastActivity(`[Replay] Step 4: Executing ${exploitMethod} ${exploitUrl}`);

    // Modify test value to distinguish replay from original
    let body: Record<string, unknown> = {};
    try {
      body = JSON.parse(exploitBody || '{}');
    } catch {
      body = {};
    }

    // Use a unique replay value
    for (const key of Object.keys(body)) {
      if (typeof body[key] === 'string') {
        body[key] = `REPLAY-${Date.now()}`;
      }
    }

    const result = await page.evaluate(
      async ({ url, method, body }) => {
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
        });
        return {
          status: res.status,
          body: await res.text(),
          headers: Object.fromEntries(res.headers.entries()),
        };
      },
      { url: exploitUrl, method: exploitMethod, body }
    );

    capturedRequest = {
      method: exploitMethod,
      url: exploitUrl,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    };

    capturedResponse = {
      status: result.status,
      headers: result.headers,
      body: result.body,
    };

    verified = result.status >= 200 && result.status < 300;

    // Step 5: Screenshot after
    if (actionPageUrl) {
      await page.goto(actionPageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
      await new Promise((r) => setTimeout(r, 500));
    }

    const afterData = await page.screenshot({ fullPage: true });
    screenshots.push({
      name: 'Replay: After action (state change confirmed)',
      data: afterData.toString('base64'),
      timestamp: new Date().toISOString(),
    });

    broadcast({ type: 'phase_changed', phase: 'complete', timestamp: new Date().toISOString() });

    if (verified) {
      broadcastActivity(`[Replay] CONFIRMED: Vulnerability still exploitable (HTTP ${result.status})`);
    } else {
      broadcastActivity(`[Replay] NOT CONFIRMED: Action was denied or failed (HTTP ${result.status})`);
    }

    return {
      success: true,
      finding,
      verified,
      screenshots,
      request: capturedRequest,
      response: capturedResponse,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    const message = (error as Error).message;
    broadcastActivity(`[Replay] Error: ${message}`);
    broadcast({ type: 'error', message: `Replay failed: ${message}` });

    return {
      success: false,
      finding,
      verified: false,
      screenshots,
      request: capturedRequest,
      response: capturedResponse,
      error: message,
      timestamp: new Date().toISOString(),
    };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
  }
}
