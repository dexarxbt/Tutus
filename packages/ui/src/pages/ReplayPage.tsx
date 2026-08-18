import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Finding, ReplayResult } from '../types';
import { useLastInvestigation } from '../hooks/useLastInvestigation';
import { ZeroFindingsState } from '../components/ZeroFindingsState';

interface Props {
  latestFinding: Finding | null;
}

export function ReplayPage({ latestFinding }: Props) {
  const navigate = useNavigate();
  const [finding, setFinding] = useState<Finding | null>(latestFinding);
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle');
  const [result, setResult] = useState<ReplayResult | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
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

  const startReplay = async () => {
    if (!finding) return;
    setState('running');
    setResult(null);
    setCurrentStep(0);

    try {
      const res = await fetch('http://localhost:3000/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.id }),
      });

      if (!res.ok) {
        setState('done');
        setResult({ success: false, verified: false, screenshots: [], request: null, response: null, error: 'Failed to start', timestamp: new Date().toISOString() });
        return;
      }

      // Animate steps while waiting
      const stepInterval = setInterval(() => {
        setCurrentStep((s) => Math.min(s + 1, (finding.reproductionSteps?.length || 5) - 1));
      }, 3000);

      // Poll for result
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const resultRes = await fetch(`http://localhost:3000/api/replay/${finding.id}/full`);
        if (resultRes.ok) {
          const data = await resultRes.json();
          setResult(data);
          setState('done');
          clearInterval(stepInterval);
          setCurrentStep(finding.reproductionSteps?.length || 5);
          return;
        }
      }

      clearInterval(stepInterval);
      setState('done');
      setResult({ success: false, verified: false, screenshots: [], request: null, response: null, error: 'Timeout', timestamp: new Date().toISOString() });
    } catch (err) {
      setState('done');
      setResult({ success: false, verified: false, screenshots: [], request: null, response: null, error: (err as Error).message, timestamp: new Date().toISOString() });
    }
  };

  if (!loaded) return null;

  if (!finding) {
    // Distinguish "never run" from "ran but found nothing"
    if (lastInvestigation?.hasRun && lastInvestigation.findingCount === 0) {
      return <ZeroFindingsState summary={lastInvestigation} context="replay" />;
    }

    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center animate-in">
        <h1 className="text-headline text-tutus-black mb-4">Nothing to replay</h1>
        <p className="text-body text-text-secondary mb-8">
          Complete an investigation first to capture a reproducible finding.
        </p>
        <button onClick={() => navigate('/investigate')} className="btn-primary">
          Start Investigation
        </button>
      </div>
    );
  }

  const steps = finding.reproductionSteps || [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-10 animate-in">
      <div className="mb-10">
        <div className="mono-label mb-2">REPLAY</div>
        <h1 className="text-headline text-tutus-black mb-3">Reproduce the finding</h1>
        <p className="text-body text-text-secondary">
          Execute the verified attack sequence step-by-step in a real browser.
        </p>
      </div>

      {/* Replay controls */}
      {state === 'idle' && (
        <div className="mb-10">
          <button onClick={startReplay} className="btn-primary text-base px-7 py-3">
            Start Replay
          </button>
        </div>
      )}

      {/* Steps timeline */}
      <div className="space-y-0 mb-10">
        {steps.map((step, idx) => {
          let stepState: 'done' | 'active' | 'pending' = 'pending';
          if (state === 'done') stepState = 'done';
          else if (idx < currentStep) stepState = 'done';
          else if (idx === currentStep && state === 'running') stepState = 'active';

          return (
            <div key={step.step} className="flex items-start gap-4 py-3 relative">
              {idx < steps.length - 1 && (
                <div className={`absolute left-[11px] top-[2.25rem] w-px h-[calc(100%-1rem)] transition-colors duration-500 ${
                  stepState === 'done' ? 'bg-tutus-black' : 'bg-border'
                }`} />
              )}
              <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-500 ${
                stepState === 'done' ? 'bg-tutus-black text-white' :
                stepState === 'active' ? 'bg-tutus-black text-white ring-4 ring-tutus-black/10 animate-pulse-slow' :
                'bg-surface-secondary text-text-tertiary border border-border'
              }`}>
                {stepState === 'done' ? '✓' : String(idx + 1).padStart(2, '0')}
              </div>
              <div className="pt-0.5">
                <div className={`text-sm font-medium transition-colors ${
                  stepState === 'done' ? 'text-tutus-black' :
                  stepState === 'active' ? 'text-tutus-black' :
                  'text-text-tertiary'
                }`}>
                  {step.action}
                </div>
                <div className="text-caption text-text-tertiary font-mono">{step.target}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Running state */}
      {state === 'running' && (
        <div className="flex items-center gap-3 p-4 bg-surface-secondary rounded-xl border border-border">
          <div className="w-4 h-4 border-2 border-tutus-black border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-text-secondary">Executing in real browser...</span>
        </div>
      )}

      {/* Result */}
      {state === 'done' && result && (
        <div className="space-y-6">
          {/* Verdict */}
          <div className={`flex items-center gap-3 p-4 rounded-xl border ${
            result.verified
              ? 'bg-state-critical-bg border-state-critical/20'
              : 'bg-state-verified-bg border-state-verified/20'
          }`}>
            <div className={`w-2.5 h-2.5 rounded-full ${result.verified ? 'bg-state-critical' : 'bg-state-verified'}`} />
            <div>
              <div className={`text-sm font-semibold ${result.verified ? 'text-state-critical' : 'text-state-verified'}`}>
                {result.verified ? 'Vulnerability confirmed — still exploitable' : 'Vulnerability no longer exploitable'}
              </div>
              <div className="mono-label mt-0.5">
                {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Replay evidence */}
          {result.request && (
            <div>
              <div className="mono-label mb-2">REPLAY REQUEST</div>
              <pre className="bg-surface-secondary rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto border border-border">
                {result.request.method} {result.request.url}
                {'\n'}Content-Type: application/json
                {result.request.body && `\n\n${formatJson(result.request.body)}`}
              </pre>
            </div>
          )}

          {result.response && (
            <div>
              <div className="mono-label mb-2">REPLAY RESPONSE</div>
              <pre className="bg-surface-secondary rounded-lg p-4 text-xs font-mono text-text-primary overflow-x-auto border border-border">
                HTTP {result.response.status}
                {'\n\n'}{formatJson(result.response.body)}
              </pre>
            </div>
          )}

          {/* Replay screenshots */}
          {result.screenshots && result.screenshots.length > 0 && (
            <div>
              <div className="mono-label mb-3">REPLAY SCREENSHOTS</div>
              <div className="space-y-3">
                {result.screenshots.map((ss, idx) => (
                  <div key={idx} className="border border-border rounded-lg overflow-hidden">
                    <div className="px-3 py-2 bg-surface-secondary border-b border-border">
                      <span className="mono-label">{ss.name}</span>
                    </div>
                    {ss.data && <img src={`data:image/png;base64,${ss.data}`} alt={ss.name} className="w-full" />}
                  </div>
                ))}
              </div>
            </div>
          )}
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
