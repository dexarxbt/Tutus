import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Finding } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { useLastInvestigation } from '../hooks/useLastInvestigation';
import { ZeroFindingsState } from '../components/ZeroFindingsState';

interface Props {
  latestFinding: Finding | null;
}

export function FindingsPage({ latestFinding }: Props) {
  const navigate = useNavigate();
  const [findings, setFindings] = useState<Finding[]>([]);
  const [selected, setSelected] = useState<Finding | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [lastInvestigation, refreshSummary] = useLastInvestigation();

  useEffect(() => {
    fetchFindings();
  }, [latestFinding]);

  const fetchFindings = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/findings');
      const data = await res.json();
      setFindings(data.findings || []);
      if (data.findings?.length > 0) {
        setSelected(data.findings[0]);
      }
    } catch {
      if (latestFinding) setFindings([latestFinding]);
    }
    refreshSummary();
    setLoaded(true);
  };

  if (!loaded) return null;

  if (findings.length === 0) {
    // Distinguish "never run" from "ran but found nothing"
    if (lastInvestigation?.hasRun && lastInvestigation.findingCount === 0) {
      return <ZeroFindingsState summary={lastInvestigation} context="findings" />;
    }

    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center animate-in">
        <h1 className="text-headline text-tutus-black mb-4">No findings yet</h1>
        <p className="text-body text-text-secondary mb-8">
          Start an investigation to discover authorization vulnerabilities.
        </p>
        <button onClick={() => navigate('/investigate')} className="btn-primary">
          Start Investigation
        </button>
      </div>
    );
  }

  const f = selected || findings[0];

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in">
      {/* Finding header - editorial */}
      <div className="mb-12">
        <div className="flex items-center gap-3 mb-4">
          <StatusBadge severity={f.severity} />
          <span className="mono-label">TUT-{f.id.substring(0, 4).toUpperCase()}</span>
          <span className="mono-label">VERIFIED</span>
        </div>
        <h1 className="text-display text-tutus-black mb-6 max-w-2xl">{f.title}</h1>
        <p className="text-body-lg text-text-secondary max-w-2xl leading-relaxed">{f.impact}</p>
      </div>

      {/* Metadata grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-8 border-y border-border mb-12">
        <div>
          <div className="mono-label mb-1">ACTOR</div>
          <div className="text-sm font-medium text-tutus-black">{f.actor.role}</div>
          <div className="text-caption text-text-secondary font-mono">{f.actor.email}</div>
        </div>
        <div>
          <div className="mono-label mb-1">EXPECTED</div>
          <div className="text-sm font-medium text-tutus-black capitalize">{f.expectedPrivilege}</div>
        </div>
        <div>
          <div className="mono-label mb-1">ACTUAL</div>
          <div className="text-sm font-medium text-state-critical capitalize">{f.actualPrivilege}</div>
        </div>
        <div>
          <div className="mono-label mb-1">CONFIDENCE</div>
          <div className="text-sm font-medium text-tutus-black capitalize">{f.confidence}</div>
        </div>
        <div>
          <div className="mono-label mb-1">STATUS</div>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-state-critical" />
            <span className="text-sm font-medium text-tutus-black">Verified</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 mb-12">
        <button onClick={() => navigate('/replay')} className="btn-primary">
          Replay Finding
        </button>
        <button onClick={() => navigate('/evidence')} className="btn-secondary">
          View Evidence
        </button>
      </div>

      {/* Reproduction steps */}
      <div>
        <h2 className="text-title text-tutus-black mb-6">Reproduction Steps</h2>
        <div className="space-y-4">
          {f.reproductionSteps.map((step) => (
            <div key={step.step} className="flex gap-4 items-start">
              <div className="w-7 h-7 rounded-full bg-surface-secondary border border-border flex items-center justify-center text-xs font-semibold text-text-secondary flex-shrink-0">
                {step.step}
              </div>
              <div className="pt-0.5">
                <div className="text-sm font-medium text-tutus-black">{step.action}</div>
                <div className="text-caption text-text-secondary font-mono mt-0.5">{step.target}</div>
                {step.details && <div className="text-caption text-text-tertiary mt-0.5">{step.details}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
