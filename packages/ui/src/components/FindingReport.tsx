import { useState } from 'react';
import { Finding, ReplayResult } from '../types';

interface Props {
  finding: Finding;
  onReset: () => void;
}

const severityColors = {
  critical: 'bg-red-500/20 text-red-400 ring-red-500/40',
  high: 'bg-orange-500/20 text-orange-400 ring-orange-500/40',
  medium: 'bg-yellow-500/20 text-yellow-400 ring-yellow-500/40',
  low: 'bg-blue-500/20 text-blue-400 ring-blue-500/40',
};

export function FindingReport({ finding, onReset }: Props) {
  const [activeTab, setActiveTab] = useState<'details' | 'evidence' | 'steps' | 'replay'>('details');
  const [replayState, setReplayState] = useState<'idle' | 'running' | 'done'>('idle');
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);

  const handleReplay = async () => {
    setReplayState('running');
    setActiveTab('replay');

    try {
      const res = await fetch('http://localhost:3000/api/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ findingId: finding.id }),
      });

      if (!res.ok) {
        setReplayState('done');
        setReplayResult({ success: false, verified: false, screenshots: [], request: null, response: null, error: 'Failed to start replay', timestamp: new Date().toISOString() });
        return;
      }

      // Poll for replay result
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const resultRes = await fetch(`http://localhost:3000/api/replay/${finding.id}/full`);
        if (resultRes.ok) {
          const data = await resultRes.json();
          setReplayResult(data);
          setReplayState('done');
          return;
        }
      }

      setReplayState('done');
      setReplayResult({ success: false, verified: false, screenshots: [], request: null, response: null, error: 'Replay timed out', timestamp: new Date().toISOString() });
    } catch (err) {
      setReplayState('done');
      setReplayResult({ success: false, verified: false, screenshots: [], request: null, response: null, error: (err as Error).message, timestamp: new Date().toISOString() });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase ring-1 ${
                  severityColors[finding.severity]
                }`}
              >
                {finding.severity}
              </span>
              <span className="text-gray-500 text-sm">
                Confidence: <span className="text-gray-300">{finding.confidence}</span>
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white">{finding.title}</h2>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReplay}
              disabled={replayState === 'running'}
              className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {replayState === 'running' ? 'Replaying...' : 'Replay'}
            </button>
            <button
              onClick={onReset}
              className="px-3 py-1.5 text-sm text-gray-400 hover:text-white border border-gray-700 rounded-lg hover:border-gray-500 transition-colors"
            >
              New Scan
            </button>
          </div>
        </div>

        <p className="text-gray-300 text-sm leading-relaxed">{finding.impact}</p>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-gray-800">
          <div>
            <div className="text-xs text-gray-500 uppercase">Actor</div>
            <div className="text-sm text-white mt-1">{finding.actor.email}</div>
            <div className="text-xs text-gray-400">Role: {finding.actor.role}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Expected Privilege</div>
            <div className="text-sm text-white mt-1">{finding.expectedPrivilege}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase">Actual Privilege</div>
            <div className="text-sm text-red-400 mt-1 font-medium">{finding.actualPrivilege}</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex border-b border-gray-800">
          {(['details', 'evidence', 'steps', 'replay'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-medium capitalize transition-colors ${
                activeTab === tab
                  ? 'text-indigo-400 border-b-2 border-indigo-400 bg-gray-800/50'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab === 'steps' ? 'Reproduction' : tab === 'replay' ? 'Replay' : tab}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'details' && <DetailsTab finding={finding} />}
          {activeTab === 'evidence' && <EvidenceTab finding={finding} label="Original Investigation" />}
          {activeTab === 'steps' && <StepsTab finding={finding} />}
          {activeTab === 'replay' && <ReplayTab state={replayState} result={replayResult} onReplay={handleReplay} />}
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-1">Finding ID</h4>
        <p className="text-gray-300 font-mono text-xs">{finding.id}</p>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-1">Timestamp</h4>
        <p className="text-gray-300 text-sm">{new Date(finding.timestamp).toLocaleString()}</p>
      </div>
      <div>
        <h4 className="text-sm font-medium text-gray-400 mb-1">Impact Assessment</h4>
        <p className="text-gray-300 text-sm leading-relaxed">{finding.impact}</p>
      </div>
    </div>
  );
}

function EvidenceTab({ finding, label }: { finding: Finding; label: string }) {
  const { evidence } = finding;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-indigo-500" />
        <span className="text-xs font-medium text-indigo-400 uppercase tracking-wide">{label}</span>
      </div>

      {/* Screenshots */}
      {evidence.screenshots.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Screenshots</h4>
          <div className="space-y-3">
            {evidence.screenshots.map((ss, idx) => (
              <div key={idx} className="border border-gray-700 rounded-lg overflow-hidden">
                <div className="bg-gray-800 px-3 py-1.5 text-xs text-gray-400">{ss.name}</div>
                <img src={`data:image/png;base64,${ss.data}`} alt={ss.name} className="w-full" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request */}
      {evidence.request && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">HTTP Request</h4>
          <pre className="bg-gray-800 rounded-lg p-4 text-xs text-green-400 overflow-x-auto">
            <code>
              {evidence.request.method} {evidence.request.url}
              {'\n'}Content-Type: application/json
              {evidence.request.body && `\n\n${formatJson(evidence.request.body)}`}
            </code>
          </pre>
        </div>
      )}

      {/* Response */}
      {evidence.response && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">HTTP Response</h4>
          <pre className="bg-gray-800 rounded-lg p-4 text-xs text-amber-400 overflow-x-auto">
            <code>
              HTTP {evidence.response.status}
              {'\n\n'}{formatJson(evidence.response.body)}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
}

function StepsTab({ finding }: { finding: Finding }) {
  return (
    <div className="space-y-3">
      {finding.reproductionSteps.map((step) => (
        <div key={step.step} className="flex gap-3 items-start">
          <div className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
            {step.step}
          </div>
          <div>
            <div className="text-sm text-white">{step.action}</div>
            <div className="text-xs text-gray-500 font-mono mt-0.5">{step.target}</div>
            {step.details && <div className="text-xs text-gray-400 mt-0.5">{step.details}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ReplayTab({ state, result, onReplay }: { state: string; result: ReplayResult | null; onReplay: () => void }) {
  if (state === 'idle') {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400 mb-4">Replay the reproduction steps to verify the vulnerability is still exploitable.</p>
        <button
          onClick={onReplay}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
        >
          Start Replay
        </button>
      </div>
    );
  }

  if (state === 'running') {
    return (
      <div className="text-center py-8">
        <div className="inline-block w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-300">Replaying reproduction steps...</p>
        <p className="text-gray-500 text-sm mt-1">Executing in real browser</p>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6">
      {/* Replay status */}
      <div className={`flex items-center gap-3 p-4 rounded-lg border ${
        result.verified
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-green-500/10 border-green-500/30'
      }`}>
        <div className={`w-3 h-3 rounded-full ${result.verified ? 'bg-red-500' : 'bg-green-500'}`} />
        <div>
          <div className={`text-sm font-medium ${result.verified ? 'text-red-400' : 'text-green-400'}`}>
            {result.verified ? 'Vulnerability Still Exploitable' : 'Vulnerability No Longer Exploitable'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Replayed at {new Date(result.timestamp).toLocaleString()}
          </div>
        </div>
      </div>

      {result.error && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
          Error: {result.error}
        </div>
      )}

      {/* Replay evidence - clearly labeled */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-amber-500" />
        <span className="text-xs font-medium text-amber-400 uppercase tracking-wide">Replay Evidence</span>
      </div>

      {/* Replay screenshots */}
      {result.screenshots && result.screenshots.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-3">Replay Screenshots</h4>
          <div className="space-y-3">
            {result.screenshots.map((ss, idx) => (
              <div key={idx} className="border border-amber-500/30 rounded-lg overflow-hidden">
                <div className="bg-gray-800 px-3 py-1.5 text-xs text-amber-400">{ss.name}</div>
                {ss.data && <img src={`data:image/png;base64,${ss.data}`} alt={ss.name} className="w-full" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Replay request/response */}
      {result.request && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Replay Request</h4>
          <pre className="bg-gray-800 rounded-lg p-4 text-xs text-green-400 overflow-x-auto border border-amber-500/20">
            <code>
              {result.request.method} {result.request.url}
              {'\n'}Content-Type: application/json
              {result.request.body && `\n\n${formatJson(result.request.body)}`}
            </code>
          </pre>
        </div>
      )}

      {result.response && (
        <div>
          <h4 className="text-sm font-medium text-gray-400 mb-2">Replay Response</h4>
          <pre className="bg-gray-800 rounded-lg p-4 text-xs text-amber-400 overflow-x-auto border border-amber-500/20">
            <code>
              HTTP {result.response.status}
              {'\n\n'}{formatJson(result.response.body)}
            </code>
          </pre>
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
