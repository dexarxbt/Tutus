import { v4 as uuid } from 'uuid';
import { VerificationResult, Evidence, Finding, ReproductionStep } from '../../types.js';
import { broadcast, broadcastActivity } from '../../ws/broadcaster.js';

export function findingPhase(
  verificationResults: VerificationResult[],
  evidence: Evidence,
  actor: { email: string; role: string },
  targetUrl: string
): Finding | null {
  broadcastActivity('Generating security finding...');

  const confirmed = verificationResults.filter((r) => r.status === 'confirmed');

  if (confirmed.length === 0) {
    broadcastActivity('No vulnerabilities confirmed. Investigation complete with no findings.');
    return null;
  }

  // Select the highest-impact confirmed result
  const primary = confirmed[0];
  const action = primary.action;

  // Determine severity based on action characteristics
  const severity = determineSeverity(action.label, action.url);
  const title = generateTitle(action.label, actor.role);
  const impact = generateImpact(action.label, action.url, actor.role);

  // Build reproduction steps
  const reproductionSteps: ReproductionStep[] = [
    {
      step: 1,
      action: 'Navigate to target application',
      target: targetUrl,
    },
    {
      step: 2,
      action: 'Authenticate as employee user',
      target: `${targetUrl}/login`,
      details: `Login with ${actor.email}`,
    },
    {
      step: 3,
      action: 'Navigate to restricted page',
      target: action.pageUrl,
      details: `Access ${action.pageUrl} directly (hidden from navigation for employee role)`,
    },
    {
      step: 4,
      action: `Submit ${action.method} request to ${extractPath(action.url)}`,
      target: action.url,
      details: `Send ${action.method} request with modified data. Fields: ${action.fields.map((f) => f.name).join(', ')}`,
    },
    {
      step: 5,
      action: 'Observe successful response',
      target: action.url,
      details: `Server responds with HTTP ${primary.httpStatus} confirming the action succeeded`,
    },
  ];

  const finding: Finding = {
    id: uuid(),
    title,
    severity,
    confidence: 'high',
    actor,
    expectedPrivilege: 'admin',
    actualPrivilege: actor.role,
    impact,
    reproductionSteps,
    evidence,
    timestamp: new Date().toISOString(),
  };

  broadcastActivity(`Finding generated: "${finding.title}" [${finding.severity.toUpperCase()}]`);

  broadcast({
    type: 'finding_ready',
    finding,
  });

  return finding;
}

function determineSeverity(label: string, url: string): 'critical' | 'high' | 'medium' | 'low' {
  const text = `${label} ${url}`.toLowerCase();

  // Financial actions = critical
  if (['payout', 'payment', 'transfer', 'bank', 'withdraw'].some((kw) => text.includes(kw))) {
    return 'critical';
  }

  // Destructive / privilege escalation = high
  if (['delete', 'admin', 'role', 'permission'].some((kw) => text.includes(kw))) {
    return 'high';
  }

  // Settings changes = medium
  if (['settings', 'config', 'update'].some((kw) => text.includes(kw))) {
    return 'medium';
  }

  return 'low';
}

function generateTitle(label: string, role: string): string {
  // Generate a descriptive title
  const capitalizedRole = role.charAt(0).toUpperCase() + role.slice(1);
  return `${capitalizedRole} can ${label.toLowerCase()}`;
}

function generateImpact(label: string, url: string, role: string): string {
  const text = `${label} ${url}`.toLowerCase();

  if (text.includes('payout') || text.includes('payment') || text.includes('bank')) {
    return `A user with "${role}" privileges can modify the organization's financial payout destination. This could allow an attacker to redirect all organizational payments to an account they control, resulting in direct financial loss. The action bypasses the intended admin-only authorization control.`;
  }

  if (text.includes('delete') || text.includes('remove')) {
    return `A user with "${role}" privileges can perform destructive actions that should require administrator access. This could result in data loss or service disruption.`;
  }

  if (text.includes('settings') || text.includes('config')) {
    return `A user with "${role}" privileges can modify organizational settings that should require administrator access. This could allow unauthorized configuration changes affecting all team members.`;
  }

  return `A user with "${role}" privileges can perform an action that should require higher privileges. This represents a broken access control vulnerability.`;
}

function extractPath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
