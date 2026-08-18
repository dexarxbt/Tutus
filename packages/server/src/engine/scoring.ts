import { DiscoveredAction, RankedAction } from '../types.js';

/**
 * Risk scoring heuristic engine.
 * Scores discovered actions by potential business impact using keyword analysis
 * and HTTP method classification. This is a generic heuristic - it has NO
 * hard-coded knowledge of specific vulnerabilities.
 */

interface ScoringFactor {
  name: string;
  weight: number;
  keywords: string[];
}

const SCORING_FACTORS: ScoringFactor[] = [
  {
    name: 'financial',
    weight: 40,
    keywords: ['payout', 'payment', 'transfer', 'bank', 'account', 'billing', 'withdraw', 'deposit', 'refund', 'wire'],
  },
  {
    name: 'destructive',
    weight: 30,
    keywords: ['delete', 'remove', 'revoke', 'disable', 'destroy', 'purge', 'terminate', 'cancel'],
  },
  {
    name: 'privilege',
    weight: 25,
    keywords: ['admin', 'role', 'permission', 'invite', 'settings', 'config', 'access', 'grant'],
  },
  {
    name: 'data_sensitive',
    weight: 20,
    keywords: ['export', 'download', 'credentials', 'key', 'secret', 'token', 'api-key', 'password'],
  },
  {
    name: 'org_scope',
    weight: 15,
    keywords: ['organization', 'company', 'team', 'all', 'global', 'org'],
  },
];

const WRITE_METHOD_BONUS = 10;

export function scoreActions(actions: DiscoveredAction[]): RankedAction[] {
  const ranked: RankedAction[] = actions.map((action) => {
    let score = 0;
    const factors: string[] = [];

    // Build searchable text from action properties
    const searchText = [
      action.label,
      action.url,
      action.fields.map((f) => f.name).join(' '),
      action.fields.map((f) => f.placeholder).join(' '),
      action.pageUrl,
    ]
      .join(' ')
      .toLowerCase();

    // Score against each factor
    for (const factor of SCORING_FACTORS) {
      const matchedKeywords = factor.keywords.filter((kw) => searchText.includes(kw));
      if (matchedKeywords.length > 0) {
        // Score increases with more keyword matches but with diminishing returns
        const factorScore = factor.weight * Math.min(matchedKeywords.length, 3) / 3;
        score += factorScore;
        factors.push(`${factor.name}: [${matchedKeywords.join(', ')}] (+${factorScore.toFixed(0)})`);
      }
    }

    // Bonus for write methods
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(action.method)) {
      score += WRITE_METHOD_BONUS;
      factors.push(`write_method: ${action.method} (+${WRITE_METHOD_BONUS})`);
    }

    return { action, score, factors };
  });

  // Sort by score descending
  ranked.sort((a, b) => b.score - a.score);

  return ranked;
}
