import { PlaywrightController } from '../../browser/controller.js';
import { VerificationResult, Evidence, Screenshot } from '../../types.js';
import { broadcast, broadcastActivity } from '../../ws/broadcaster.js';

export async function evidencePhase(
  browser: PlaywrightController,
  verificationResults: VerificationResult[]
): Promise<Evidence> {
  broadcastActivity('Collecting evidence for confirmed findings...');

  const confirmed = verificationResults.filter((r) => r.status === 'confirmed');

  if (confirmed.length === 0) {
    broadcastActivity('No confirmed findings to collect evidence for.');
    return { screenshots: [], request: null, response: null };
  }

  // Take evidence from the highest-impact confirmed result (first one, since they're pre-sorted by risk)
  const primary = confirmed[0];
  const screenshots: Screenshot[] = [];

  // Screenshot the current state (post-verification, showing the change)
  try {
    // Navigate to the page where the action was performed to show the result
    if (primary.action.pageUrl) {
      await browser.navigate(primary.action.pageUrl);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for render

      const afterScreenshot = await browser.screenshot('evidence-after');
      screenshots.push({
        name: 'After: State change confirmed',
        data: afterScreenshot,
        timestamp: new Date().toISOString(),
      });

      broadcast({
        type: 'screenshot',
        name: 'evidence-after',
        data: afterScreenshot,
      });

      broadcastActivity('Captured post-action screenshot');
    }
  } catch (error) {
    broadcastActivity(`Screenshot capture error: ${(error as Error).message}`);
  }

  const evidence: Evidence = {
    screenshots,
    request: primary.request,
    response: primary.response,
  };

  broadcastActivity(
    `Evidence collected: ${screenshots.length} screenshots, request/response captured`,
    `Action: ${primary.action.label}, HTTP ${primary.httpStatus}`
  );

  return evidence;
}
