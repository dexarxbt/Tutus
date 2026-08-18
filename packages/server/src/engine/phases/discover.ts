import { PageNode, DiscoveredAction, FormInfo } from '../../types.js';
import { broadcast, broadcastActivity } from '../../ws/broadcaster.js';
import { v4 as uuid } from 'uuid';

export function discoverPhase(sitemap: PageNode[]): DiscoveredAction[] {
  const actions: DiscoveredAction[] = [];
  const seen = new Set<string>();

  broadcastActivity('Analyzing discovered pages for actionable elements...');

  for (const page of sitemap) {
    // Extract actions from forms
    for (const form of page.forms) {
      const actionKey = `${form.method}:${form.action}`;
      if (seen.has(actionKey)) continue;
      seen.add(actionKey);

      // Skip login forms (we don't want to test those)
      if (isLoginForm(form)) continue;

      const action: DiscoveredAction = {
        id: uuid(),
        label: deriveLabel(form),
        url: form.action,
        method: form.method,
        fields: form.fields,
        pageUrl: form.pageUrl,
        source: 'form',
      };

      actions.push(action);

      broadcast({
        type: 'action_discovered',
        action,
      });
    }
  }

  broadcastActivity(`Discovered ${actions.length} actionable elements across ${sitemap.length} pages.`);
  return actions;
}

function isLoginForm(form: FormInfo): boolean {
  const hasEmail = form.fields.some((f) => f.type === 'email' || f.name === 'email');
  const hasPassword = form.fields.some((f) => f.type === 'password');
  const actionIsLogin = form.action.includes('/login');
  return (hasEmail && hasPassword) || actionIsLogin;
}

function deriveLabel(form: FormInfo): string {
  // Use submit button text as primary label
  if (form.submitText && form.submitText !== 'Submit') {
    return form.submitText;
  }

  // Derive from action URL
  const actionPath = extractPath(form.action);
  if (actionPath) {
    return pathToLabel(actionPath);
  }

  // Derive from fields
  if (form.fields.length > 0) {
    const fieldNames = form.fields.map((f) => f.name || f.placeholder).filter(Boolean);
    return `Update ${fieldNames.join(', ')}`;
  }

  return 'Unknown Action';
}

function extractPath(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname;
  } catch {
    return url;
  }
}

function pathToLabel(path: string): string {
  // Convert /billing/payout to "Billing Payout"
  return path
    .split('/')
    .filter(Boolean)
    .map((seg) => seg.charAt(0).toUpperCase() + seg.slice(1))
    .join(' ');
}
