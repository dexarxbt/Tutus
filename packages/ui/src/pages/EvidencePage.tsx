import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Finding } from '../types';
import { useLastInvestigation } from '../hooks/useLastInvestigation';
import { ZeroFindingsState } from '../components/ZeroFindingsState';

interface Props {
  latestFinding: Finding | null;
}

export function EvidencePage({ latestFinding }: Props) {
  const navigate = useNavigate();
  const [finding, setFinding] = useState<Finding | null>(latestFinding);
  const [expandedSection, setExpandedSection] = useState<string | null>('request');
  const [loaded, setLoaded] = useState(false);
  const [lastInvestigation, refreshSummary] = useLastInvestigation();

  useEffect(() => {
    fetchFinding();
  }, [latestFinding]);

  const fetchFinding = async () => {
    try {
      const res = await fetch('http://localhost:3000/api/findings');
      const data = await res.json();
      if (data.findings?.length > 0) {
        setFinding(data.findings[0]);
      } else {
        setFinding(null);
      }
    } catch {}
    refreshSummary();
    setLoaded(true);
  };

  if (!loaded) return null;

  if (!finding) {
    // Distinguish "never run" from "ran but found nothing"
    if (lastInvestigation?.hasRun && lastInvestigation.findingCount === 0) {
      return <ZeroFindingsState summary={lastInvestigation} context="evidence" />;
    }

    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center animate-in">
        <h1 className="text-headline text-tutus-black mb-4">No evidence captured</h1>
        <p className="text-body text-text-secondary mb-8">
          Evidence is captured during investigation when a vulnerability is confirmed.
        </p>
        <button onClick={() => navigate('/investigate')} className="btn-primary">
          Start Investigation
        </button>
      </div>
    );
  }

  const { evidence } = finding;

  const toggle = (key: string) => {
    setExpandedSection(expandedSection === key ? null : key);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-in">
      <div className="mb-10">
        <div className="mono-label text-state-critical mb-2">EVIDENCE</div>
        <h1 className="text-headline text-tutus-black mb-3">Captured proof</h1>
        <p className="text-body text-text-secondary">
          No alerts. Proof. This evidence was captured during live verification of the finding.
        </p>
      </div>

      <div className="space-y-3">
        {/* HTTP Request */}
        {evidence.request && (
          <EvidenceSection
            num="01"
            title="HTTP Request"
            subtitle={`${evidence.request.method} ${evidence.request.url}`}
            expanded={expandedSection === 'request'}
            onToggle={() => toggle('request')}
          >
            <pre className="bg-surface-secondary rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto leading-6">
              <span className="text-state-verified font-semibold">{evidence.request.method}</span>{' '}
              <span className="text-text-secondary">{evidence.request.url}</span>
              {'\n'}<span className="text-text-tertiary">Content-Type:</span> application/json
              {evidence.request.body && (
                <>
                  {'\n\n'}
                  <span className="text-text-primary">{formatJson(evidence.request.body)}</span>
                </>
              )}
            </pre>
          </EvidenceSection>
        )}

        {/* HTTP Response */}
        {evidence.response && (
          <EvidenceSection
            num="02"
            title="HTTP Response"
            subtitle={`Status ${evidence.response.status}`}
            expanded={expandedSection === 'response'}
            onToggle={() => toggle('response')}
          >
            <pre className="bg-surface-secondary rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto leading-6">
              <span className={evidence.response.status === 200 ? 'text-state-critical font-semibold' : 'text-text-secondary'}>
                HTTP {evidence.response.status}
              </span>
              {'\n\n'}
              <span className="text-text-primary">{formatJson(evidence.response.body)}</span>
            </pre>
          </EvidenceSection>
        )}

        {/* Action performed */}
        <EvidenceSection
          num="03"
          title="Action"
          subtitle={finding.title}
          expanded={expandedSection === 'action'}
          onToggle={() => toggle('action')}
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="mono-label mb-1">ACTOR</div>
                <div className="text-sm text-text-primary">{finding.actor.email}</div>
              </div>
              <div>
                <div className="mono-label mb-1">ROLE</div>
                <div className="text-sm text-text-primary">{finding.actor.role}</div>
              </div>
              <div>
                <div className="mono-label mb-1">REQUIRED PRIVILEGE</div>
                <div className="text-sm text-text-primary">{finding.expectedPrivilege}</div>
              </div>
              <div>
                <div className="mono-label mb-1">ACTUAL PRIVILEGE</div>
                <div className="text-sm text-state-critical font-medium">{finding.actualPrivilege}</div>
              </div>
            </div>
          </div>
        </EvidenceSection>

        {/* Result */}
        <EvidenceSection
          num="04"
          title="Result"
          subtitle="State change confirmed"
          expanded={expandedSection === 'result'}
          onToggle={() => toggle('result')}
        >
          <div className="flex items-center gap-3 p-3 bg-state-critical-bg rounded-lg border border-state-critical/10">
            <div className="w-2 h-2 rounded-full bg-state-critical" />
            <span className="text-sm text-state-critical font-medium">
              Unauthorized action succeeded — server accepted the request
            </span>
          </div>
        </EvidenceSection>

        {/* Screenshots */}
        {evidence.screenshots.length > 0 && (
          <EvidenceSection
            num="05"
            title="Browser State"
            subtitle={`${evidence.screenshots.length} screenshot${evidence.screenshots.length > 1 ? 's' : ''} captured`}
            expanded={expandedSection === 'screenshots'}
            onToggle={() => toggle('screenshots')}
          >
            <div className="space-y-3">
              {evidence.screenshots.map((ss, idx) => (
                <div key={idx} className="border border-border rounded-lg overflow-hidden">
                  <div className="px-3 py-2 bg-surface-secondary border-b border-border">
                    <span className="mono-label">{ss.name}</span>
                  </div>
                  <img src={`data:image/png;base64,${ss.data}`} alt={ss.name} className="w-full" />
                </div>
              ))}
            </div>
          </EvidenceSection>
        )}

        {/* Reproduction */}
        <EvidenceSection
          num="06"
          title="Reproduction"
          subtitle={`${finding.reproductionSteps.length} steps`}
          expanded={expandedSection === 'reproduction'}
          onToggle={() => toggle('reproduction')}
        >
          <div className="space-y-2">
            {finding.reproductionSteps.map((step) => (
              <div key={step.step} className="flex gap-3 items-baseline">
                <span className="mono-label flex-shrink-0 w-4 text-right">{step.step}.</span>
                <span className="text-sm text-text-primary">{step.action}</span>
              </div>
            ))}
          </div>
        </EvidenceSection>
      </div>
    </div>
  );
}

function EvidenceSection({
  num, title, subtitle, expanded, onToggle, children,
}: {
  num: string; title: string; subtitle: string;
  expanded: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-surface-secondary/40 transition-colors"
      >
        <span className="mono-label text-tutus-red">{num}</span>
        <div className="flex-1">
          <div className="text-sm font-semibold text-tutus-black">{title}</div>
          <div className="text-caption text-text-secondary font-mono">{subtitle}</div>
        </div>
        <svg className={`w-4 h-4 text-text-tertiary transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="px-5 pb-5 animate-fade-in">
          {children}
        </div>
      )}
    </div>
  );
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
