import { useState, useEffect, useCallback } from 'react';

export interface LastInvestigationSummary {
  hasRun: boolean;
  id?: string;
  target?: string;
  completedAt?: string;
  findingCount?: number;
  pagesExplored?: number;
  actionsDiscovered?: number;
}

export function useLastInvestigation(): [LastInvestigationSummary | null, () => void] {
  const [summary, setSummary] = useState<LastInvestigationSummary | null>(null);

  const refresh = useCallback(() => {
    fetch('http://localhost:3000/api/last-investigation')
      .then((r) => r.json())
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  // Fetch on mount
  useEffect(() => {
    refresh();
  }, [refresh]);

  return [summary, refresh];
}
