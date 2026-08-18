import { PlaywrightController } from '../../browser/controller.js';
import { broadcastActivity } from '../../ws/broadcaster.js';

export async function authenticatePhase(
  browser: PlaywrightController,
  targetUrl: string,
  username: string,
  password: string
): Promise<boolean> {
  broadcastActivity('Navigating to target application...');
  await browser.navigate(targetUrl);

  const currentUrl = await browser.getCurrentUrl();
  broadcastActivity(`Landed on: ${currentUrl}`);

  // If redirected to login already, great. Otherwise navigate there.
  if (!currentUrl.includes('/login')) {
    broadcastActivity('Navigating to login page...');
    await browser.navigate(`${targetUrl}/login`);
  }

  broadcastActivity('Detecting login form...');

  // Use direct page interaction for reliability
  const loginSuccess = await browser.loginWithCredentials(username, password);

  if (loginSuccess) {
    const postLoginUrl = await browser.getCurrentUrl();
    broadcastActivity(`Authentication successful. Now at: ${postLoginUrl}`);
  } else {
    broadcastActivity('Authentication failed - still on login page');
  }

  return loginSuccess;
}
