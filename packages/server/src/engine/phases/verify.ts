import { PlaywrightController } from '../../browser/controller.js';
import { RankedAction, VerificationResult } from '../../types.js';
import { broadcast, broadcastActivity } from '../../ws/broadcaster.js';

const TEST_VALUES: Record<string, string> = {
  payoutAccount: `HACKED-ACCOUNT-${Date.now()}`,
  account: `HACKED-ACCOUNT-${Date.now()}`,
  name: `TEST-VALUE-${Date.now()}`,
  email: `test-${Date.now()}@example.com`,
  default: `test-${Date.now()}`,
};

export async function verifyPhase(
  browser: PlaywrightController,
  rankedActions: RankedAction[],
  targetUrl: string
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const topActions = rankedActions.slice(0, 5); // Test top 5

  broadcastActivity(`Verifying top ${topActions.length} high-risk actions...`);

  // Navigate to a known page first to ensure browser is in a good state
  try {
    await browser.navigate(targetUrl + '/dashboard');
  } catch {
    // If even this fails, the browser is in a bad state
  }

  for (const ranked of topActions) {
    const action = ranked.action;
    broadcastActivity(`Testing: "${action.label}" (${action.method} ${action.url})`);

    try {
      // Determine the API endpoint to call
      const apiUrl = resolveApiUrl(action.url, targetUrl);

      // Build test payload from form fields
      const payload: Record<string, string> = {};
      for (const field of action.fields) {
        if (field.type === 'submit' || field.type === 'hidden') continue;
        const testValue = TEST_VALUES[field.name] || TEST_VALUES.default;
        payload[field.name] = testValue;
      }

      // Try multiple HTTP methods - forms typically POST but APIs often use PUT/PATCH
      const methodsToTry = getMethodsToTry(action.method);
      let bestResult: { status: number; body: string; request: CapturedRequest; response: CapturedResponse } | null = null;

      for (const method of methodsToTry) {
        const result = await browser.makeApiRequest(apiUrl, method, payload);
        broadcastActivity(
          `  Tried ${method} ${apiUrl} -> HTTP ${result.status}`,
          result.body.substring(0, 100)
        );

        // If we got a success response, use it
        if (result.status >= 200 && result.status < 300) {
          bestResult = result;
          break;
        }

        // If we got 403/401, record it (might be correctly denied)
        if (result.status === 403 || result.status === 401) {
          bestResult = result;
          break;
        }

        // If 404 or method not allowed, try next method
        if (!bestResult || result.status < 500) {
          bestResult = result;
        }
      }

      if (!bestResult) {
        results.push({
          action,
          status: 'failed',
          httpStatus: null,
          responseBody: '',
          request: null,
          response: null,
          error: 'No response received',
        });
        continue;
      }

      let status: 'confirmed' | 'denied' | 'failed';
      if (bestResult.status >= 200 && bestResult.status < 300) {
        status = 'confirmed';
        broadcastActivity(
          `CONFIRMED: "${action.label}" succeeded with HTTP ${bestResult.status}`,
          `Response: ${bestResult.body.substring(0, 200)}`
        );
      } else if (bestResult.status === 403 || bestResult.status === 401) {
        status = 'denied';
        broadcastActivity(`DENIED: "${action.label}" returned HTTP ${bestResult.status}`);
      } else {
        status = 'failed';
        broadcastActivity(`FAILED: "${action.label}" returned HTTP ${bestResult.status}`);
      }

      const verificationResult: VerificationResult = {
        action,
        status,
        httpStatus: bestResult.status,
        responseBody: bestResult.body,
        request: bestResult.request,
        response: bestResult.response,
      };

      results.push(verificationResult);

      broadcast({
        type: 'verification_result',
        action: action.label,
        result: status,
      });
    } catch (error) {
      broadcastActivity(`Error testing "${action.label}": ${(error as Error).message}`);
      results.push({
        action,
        status: 'failed',
        httpStatus: null,
        responseBody: '',
        request: null,
        response: null,
        error: (error as Error).message,
      });

      broadcast({
        type: 'verification_result',
        action: action.label,
        result: 'failed',
      });
    }
  }

  const confirmed = results.filter((r) => r.status === 'confirmed').length;
  const denied = results.filter((r) => r.status === 'denied').length;
  broadcastActivity(`Verification complete: ${confirmed} confirmed, ${denied} denied, ${results.length - confirmed - denied} failed`);

  return results;
}

function resolveApiUrl(actionUrl: string, targetUrl: string): string {
  // If the action URL already contains /api/, use it directly
  if (actionUrl.includes('/api/')) {
    try {
      new URL(actionUrl);
      return actionUrl;
    } catch {
      // Relative URL
      return `${targetUrl}${actionUrl}`;
    }
  }

  // Convert page URL to API URL pattern
  // e.g., http://localhost:4000/billing/payout -> http://localhost:4000/api/billing/payout
  try {
    const parsed = new URL(actionUrl);
    const path = parsed.pathname;
    const base = parsed.origin;
    return `${base}/api${path}`;
  } catch {
    return `${targetUrl}/api${actionUrl}`;
  }
}

function getMethodsToTry(formMethod: string): string[] {
  // HTML forms only support GET and POST, but APIs commonly use PUT, PATCH, DELETE
  // When we discover a POST form targeting a resource-like URL, also try PUT
  const method = formMethod.toUpperCase();

  if (method === 'POST') {
    return ['PUT', 'POST', 'PATCH']; // Try PUT first (common for updates), then POST
  }
  if (method === 'GET') {
    return ['GET'];
  }
  return [method, 'PUT', 'POST'];
}
