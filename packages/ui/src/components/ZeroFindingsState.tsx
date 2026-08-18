import { useNavigate } from 'react-router-dom';
import { LastInvestigationSummary } from '../hooks/useLastInvestigation';

interface Props {
  summary: LastInvestigationSummary;
  context: 'findings' | 'evidence' | 'replay';
}

const messages = {
  findings: {
    title: 'No vulnerabilities confirmed',
    description: 'completed and did not confirm any authorization vulnerabilities.',
  },
  evidence: {
    title: 'No evidence to display',
    description: 'completed without confirming a vulnerability, so no evidence was captured.',
  },
  replay: {
    title: 'No vulnerability to replay',
    description: 'confirmed no exploitable authorization flaw, so there is nothing to replay.',
  },
};

export function ZeroFindingsState({ summary, context }: Props) {
  const navigate = useNavigate();
  const msg = messages[context];
  const target = summary.target?.replace(/https?:\/\//, '') || 'unknown target';
  const time = summary.completedAt ? new Date(summary.completedAt).toLocaleString() : '';

  return (
    <div className="max-w-2xl mx-auto py-20 px-6 animate-in">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-2.5 h-2.5 rounded-full bg-state-verified" />
        <span className="mono-label text-state-verified">SECURE</span>
      </div>

      <h1 className="text-headline text-tutus-black mb-4">{msg.title}</h1>

      <p className="text-body text-text-secondary mb-6">
        The last investigation against{' '}
        <span className="font-mono font-medium text-text-primary">{target}</span>{' '}
        {msg.description}
      </p>

      <div className="bg-surface-secondary border border-border rounded-xl p-4 mb-8">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <div className="mono-label mb-0.5">TARGET</div>
            <div className="text-sm font-mono text-text-primary">{target}</div>
          </div>
          <div>
            <div className="mono-label mb-0.5">COMPLETED</div>
            <div className="text-sm text-text-primary">{time}</div>
          </div>
          <div>
            <div className="mono-label mb-0.5">PAGES</div>
            <div className="text-sm font-mono text-text-primary">{summary.pagesExplored ?? 0}</div>
          </div>
          <div>
            <div className="mono-label mb-0.5">FINDINGS</div>
            <div className="text-sm font-mono text-state-verified font-medium">0</div>
          </div>
        </div>
      </div>

      <button onClick={() => navigate('/investigate')} className="btn-secondary">
        Run Another Investigation
      </button>
    </div>
  );
}
