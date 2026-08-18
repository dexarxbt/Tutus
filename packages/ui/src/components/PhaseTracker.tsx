import { Phase } from '../types';

interface Props {
  currentPhase: Phase | null;
}

const PHASES: { key: Phase; label: string }[] = [
  { key: 'authenticating', label: 'Authentication' },
  { key: 'exploring', label: 'Exploration' },
  { key: 'discovering', label: 'Discovery' },
  { key: 'analyzing', label: 'Risk Analysis' },
  { key: 'verifying', label: 'Verification' },
  { key: 'collecting-evidence', label: 'Evidence' },
  { key: 'generating-finding', label: 'Finding' },
  { key: 'complete', label: 'Complete' },
];

export function PhaseTracker({ currentPhase }: Props) {
  const currentIndex = PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Investigation Progress</h3>
      <div className="space-y-1">
        {PHASES.map((phase, idx) => {
          let status: 'done' | 'active' | 'pending';
          if (idx < currentIndex) status = 'done';
          else if (idx === currentIndex) status = 'active';
          else status = 'pending';

          return (
            <div key={phase.key} className="flex items-center gap-3 py-1.5">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  status === 'done'
                    ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/40'
                    : status === 'active'
                    ? 'bg-indigo-500/20 text-indigo-300 ring-2 ring-indigo-500 animate-pulse'
                    : 'bg-gray-800 text-gray-600 ring-1 ring-gray-700'
                }`}
              >
                {status === 'done' ? '✓' : idx + 1}
              </div>
              <span
                className={`text-sm ${
                  status === 'done'
                    ? 'text-green-400'
                    : status === 'active'
                    ? 'text-white font-medium'
                    : 'text-gray-600'
                }`}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
