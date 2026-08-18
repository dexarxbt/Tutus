import { PlaywrightController } from '../../browser/controller.js';
import { PageNode } from '../../types.js';
import { broadcast, broadcastActivity } from '../../ws/broadcaster.js';

// Common sensitive paths to probe in addition to discovered links
const PROBE_PATHS = [
  '/admin',
  '/billing/payout',
  '/settings/advanced',
  '/api-keys',
  '/users',
  '/billing/payment',
  '/account',
  '/profile',
  '/export',
  '/reports',
];

export async function explorePhase(
  browser: PlaywrightController,
  targetUrl: string
): Promise<PageNode[]> {
  const sitemap: PageNode[] = [];
  const visited = new Set<string>();
  const toVisit: string[] = [];
  const baseUrl = new URL(targetUrl).origin;

  broadcastActivity('Starting application exploration...');

  // Get links from current page (post-login)
  const currentUrl = await browser.getCurrentUrl();
  const initialLinks = await browser.getPageLinks();
  const title = await browser.getPageTitle();

  // Record current page
  const currentForms = await browser.getPageForms();
  const currentButtons = await browser.getButtons();

  sitemap.push({
    url: currentUrl,
    title,
    links: initialLinks,
    forms: currentForms,
    buttons: currentButtons,
  });
  visited.add(normalizeUrl(currentUrl, baseUrl));

  broadcast({
    type: 'page_discovered',
    url: currentUrl,
    title: title || currentUrl,
  });

  // Queue discovered links
  for (const link of initialLinks) {
    const normalized = normalizeUrl(link, baseUrl);
    if (isInternalLink(normalized, baseUrl) && !visited.has(normalized) && !isLogoutLink(link)) {
      toVisit.push(normalized);
    }
  }

  // Also probe common paths
  for (const probePath of PROBE_PATHS) {
    const probeUrl = `${baseUrl}${probePath}`;
    if (!visited.has(probeUrl) && !toVisit.includes(probeUrl)) {
      toVisit.push(probeUrl);
    }
  }

  broadcastActivity(`Found ${toVisit.length} pages to explore`);

  // BFS exploration (max 20 pages, max depth not needed for flat structure)
  const maxPages = 20;
  let pagesVisited = 0;

  while (toVisit.length > 0 && pagesVisited < maxPages) {
    const nextUrl = toVisit.shift()!;

    if (visited.has(nextUrl)) continue;
    visited.add(nextUrl);

    try {
      await browser.navigate(nextUrl);
      pagesVisited++;

      const pageUrl = await browser.getCurrentUrl();
      const normalizedPageUrl = normalizeUrl(pageUrl, baseUrl);

      // If we got redirected to login, this page requires different auth or is blocked
      if (pageUrl.includes('/login')) {
        broadcastActivity(`Skipped ${nextUrl} (redirected to login)`);
        continue;
      }

      const pageTitle = await browser.getPageTitle();
      const pageLinks = await browser.getPageLinks();
      const pageForms = await browser.getPageForms();
      const pageButtons = await browser.getButtons();

      sitemap.push({
        url: pageUrl,
        title: pageTitle,
        links: pageLinks,
        forms: pageForms,
        buttons: pageButtons,
      });

      broadcast({
        type: 'page_discovered',
        url: pageUrl,
        title: pageTitle || pageUrl,
      });

      broadcastActivity(`Explored: ${pageUrl}`, `Title: "${pageTitle}", Forms: ${pageForms.length}, Links: ${pageLinks.length}`);

      // Queue new links
      for (const link of pageLinks) {
        const normalized = normalizeUrl(link, baseUrl);
        if (isInternalLink(normalized, baseUrl) && !visited.has(normalized) && !isLogoutLink(link)) {
          toVisit.push(normalized);
        }
      }
    } catch (error) {
      broadcastActivity(`Failed to explore ${nextUrl}`, (error as Error).message);
    }
  }

  broadcastActivity(`Exploration complete. Discovered ${sitemap.length} pages.`);
  return sitemap;
}

function normalizeUrl(url: string, baseUrl: string): string {
  try {
    const parsed = new URL(url, baseUrl);
    // Remove trailing slash, hash, and query params for dedup
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return url;
  }
}

function isInternalLink(url: string, baseUrl: string): boolean {
  try {
    return url.startsWith(baseUrl);
  } catch {
    return false;
  }
}

function isLogoutLink(url: string): boolean {
  return url.includes('/logout') || url.includes('/signout');
}
