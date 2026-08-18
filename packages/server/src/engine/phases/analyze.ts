import { DiscoveredAction, RankedAction } from '../../types.js';
import { scoreActions } from '../scoring.js';
import { broadcastActivity } from '../../ws/broadcaster.js';

export function analyzePhase(actions: DiscoveredAction[]): RankedAction[] {
  broadcastActivity(`Analyzing ${actions.length} discovered actions for risk...`);

  const ranked = scoreActions(actions);

  // Log top ranked actions
  const topN = ranked.slice(0, 5);
  for (let i = 0; i < topN.length; i++) {
    const item = topN[i];
    broadcastActivity(
      `Risk #${i + 1}: "${item.action.label}" (score: ${item.score.toFixed(0)})`,
      item.factors.join('; ')
    );
  }

  broadcastActivity(`Risk analysis complete. Top action: "${topN[0]?.action.label || 'none'}" with score ${topN[0]?.score.toFixed(0) || 0}`);

  return ranked;
}
