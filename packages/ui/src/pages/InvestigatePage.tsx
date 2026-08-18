import { useState, useEffect, useCallback, useRef } from 'react';
import { Phase, Finding, ActivityEvent, ServerMessage } from '../types';
import { useNavigate } from 'react-router-dom';

interface Props {
  messages: ServerMessage[];
  clearMessages: () => void;
  connected: boolean;
  onFindingReady: (finding: Finding) => void;
}

let eventCounter = 0;

const PIPELINE_STAGES = [
  { key: 'authenticating', num: '01', label: 'AUTHENTICATE', desc: 'Logging into target' },
  { key: 'exploring', num: '02', label: 'EXPLORE', desc: 'Mapping application' },
  { key: 'discovering', num: '03', label: 'DISCOVER', desc: 'Identifying actions' },
  { key: 'analyzing', num: '04', label: 'ANALYZE', desc: 'Scoring by risk' },
  { key: 'verifying', num: '05', label: 'VERIFY', desc: 'Testing permissions' },
  { key: 'collecting-evidence', num: '06', label: 'PROVE', desc: 'Capturing evidence' },
] as const;

export function InvestigatePage({ messages, clearMessages, connected, onFindingReady }: Props) {
  const navigate = useNavigate();
  const [view, setView] = useState<'form' | 'running' | 'done'>('form');
  const [phase, setPhase] = useState<Phase | null>(null);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [finding, setFinding] = useState<Finding | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [stats, setStats] = useState({ pages: 0, actions: 0 });
  const feedRef = useRef<HTMLDivElement>(null);

  // Form state
  const [url, setUrl] = useState('http://localhost:4000');
  const [username, setUsername] = useState('employee@acme.com');
  const [password, setPassword] = useState('employee123');

  // Timer
  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  // Process WS messages
  const processedCountRef = useRef(0);
  useEffect(() => {
    if (messages.length === 0) return;
    // Process all new messages since last render
    const newMessages = messages.slice(processedCountRef.current);
    for (const msg of newMessages) {
      handleMessage(msg);
    }
    processedCountRef.current = messages.length;
  }, [messages]);

  // Auto-scroll feed
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [events]);

  const handleMessage = (msg: ServerMessage) => {
    switch (msg.type) {
      case 'phase_changed':
        setPhase(msg.phase);
        if (msg.phase === 'complete') {
          setView('done');
        }
        break;
      case 'activity':
        addEvent(msg.message, 'info', msg.timestamp);
        break;
      case 'page_discovered':
        setStats((s) => ({ ...s, pages: s.pages + 1 }));
        addEvent(`Discovered: ${msg.title || msg.url}`, 'info');
        break;
      case 'action_discovered':
        setStats((s) => ({ ...s, actions: s.actions + 1 }));
        addEvent(`Action: "${msg.action.label}" [${msg.action.method}]`, 'info');
        break;
      case 'verification_result': {
        const type = msg.result === 'confirmed' ? 'success' : msg.result === 'denied' ? 'warning' : 'error';
        addEvent(`${msg.result.toUpperCase()}: ${msg.action}`, type);
        break;
      }
      case 'finding_ready':
        setFinding(msg.finding);
        onFindingReady(msg.finding);
        addEvent(`FINDING: ${msg.finding.title}`, 'success');
        break;
      case 'error':
        addEvent(`Error: ${msg.message}`, 'error');
        setView('done');
        break;
      case 'investigation_started':
        addEvent('Investigation initiated', 'info');
        break;
      case 'investigation_complete':
        addEvent('Investigation complete', 'success');
        break;
    }
  };

  const addEvent = (message: string, type: ActivityEvent['type'], timestamp?: string) => {
    setEvents((prev) => [...prev, { id: ++eventCounter, message, type, timestamp: timestamp || new Date().toISOString() }]);
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !username || !password) return;

    setView('running');
    setPhase(null);
    setEvents([]);
    setFinding(null);
    setStats({ pages: 0, actions: 0 });
    setStartTime(Date.now());
    setElapsed(0);
    processedCountRef.current = 0;
    clearMessages();

    try {
      const res = await fetch('http://localhost:3000/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        addEvent(`Failed: ${data.error}`, 'error');
        setView('form');
      }
    } catch (err) {
      addEvent(`Connection error: ${(err as Error).message}`, 'error');
      setView('form');
    }
  }, [url, username, password, clearMessages]);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // --- FORM VIEW ---
  if (view === 'form') {
    return (
      <div className="max-w-xl mx-auto py-20 px-6 animate-in">
        <h1 className="text-headline text-tutus-black mb-3">Start Investigation</h1>
        <p className="text-body text-text-secondary mb-10">
          Provide the target application URL and user credentials. Tutus will autonomously
          discover and verify authorization vulnerabilities.
        </p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="url" className="block text-caption font-medium text-text-primary mb-1.5">
              Target URL
            </label>
            <input
              id="url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="input-field"
              placeholder="https://app.example.com"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="username" className="block text-caption font-medium text-text-primary mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="input-field"
                placeholder="user@company.com"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-caption font-medium text-text-primary mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Password"
                required
              />
            </div>
          </div>
          <div className="pt-3">
            <button type="submit" className="btn-primary w-full py-3 text-base">
              Begin Investigation
            </button>
          </div>
        </form>
      </div>
    );
  }

  // --- RUNNING / DONE VIEW ---
  // Map server phases to stepper index. generating-finding and complete both mean "all visible stages done"
  let currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === phase);
  if (phase === 'generating-finding' || phase === 'complete') {
    currentStageIdx = PIPELINE_STAGES.length; // all stages complete
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-10 animate-in">
      {/* Top bar: target + status */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="mono-label mb-1">TARGET</div>
          <div className="text-title text-tutus-black font-mono">{url.replace(/https?:\/\//, '')}</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="mono-label mb-0.5">ELAPSED</div>
            <div className="font-mono text-sm text-text-primary">{formatTime(elapsed)}</div>
          </div>
          <div className="text-right">
            <div className="mono-label mb-0.5">STATUS</div>
            <div className={`font-mono text-sm font-medium ${view === 'done' ? (finding ? 'text-state-critical' : 'text-state-verified') : 'text-tutus-black'}`}>
              {view === 'done' ? (finding ? 'FINDING' : 'SECURE') : 'RUNNING'}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Pipeline */}
        <div className="lg:col-span-4">
          <div className="mono-label mb-4">INVESTIGATION PIPELINE</div>
          <div className="space-y-0">
            {PIPELINE_STAGES.map((stage, idx) => {
              let state: 'queued' | 'running' | 'complete' | 'failed' = 'queued';
              if (idx < currentStageIdx) state = 'complete';
              else if (idx === currentStageIdx) state = phase === 'complete' || view === 'done' ? 'complete' : 'running';

              return (
                <div key={stage.key} className="flex items-start gap-4 py-3 relative">
                  {/* Connector line */}
                  {idx < PIPELINE_STAGES.length - 1 && (
                    <div className={`absolute left-[11px] top-[2.25rem] w-px h-[calc(100%-1rem)] ${
                      state === 'complete' ? 'bg-tutus-black' : 'bg-border'
                    }`} />
                  )}
                  {/* Number circle */}
                  <div className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-300 ${
                    state === 'complete' ? 'bg-tutus-black text-white' :
                    state === 'running' ? 'bg-tutus-black text-white animate-pulse-slow ring-4 ring-tutus-black/10' :
                    'bg-surface-secondary text-text-tertiary border border-border'
                  }`}>
                    {state === 'complete' ? '✓' : stage.num}
                  </div>
                  {/* Label */}
                  <div>
                    <div className={`text-sm font-semibold transition-colors ${
                      state === 'complete' ? 'text-tutus-black' :
                      state === 'running' ? 'text-tutus-black' :
                      'text-text-tertiary'
                    }`}>
                      {stage.label}
                    </div>
                    <div className={`text-caption ${state === 'running' ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                      {stage.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Stats */}
          <div className="mt-8 pt-6 border-t border-border grid grid-cols-2 gap-4">
            <div>
              <div className="mono-label mb-0.5">PAGES</div>
              <div className="text-title font-mono">{stats.pages}</div>
            </div>
            <div>
              <div className="mono-label mb-0.5">ACTIONS</div>
              <div className="text-title font-mono">{stats.actions}</div>
            </div>
          </div>

          {/* Finding CTA */}
          {view === 'done' && finding && (
            <div className="mt-6 p-4 border border-state-critical/20 bg-state-critical-bg rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-state-critical" />
                <span className="mono-label text-state-critical">CRITICAL FINDING</span>
              </div>
              <p className="text-sm font-semibold text-tutus-black mb-3">{finding.title}</p>
              <button onClick={() => navigate('/findings')} className="btn-primary text-xs py-1.5 px-3">
                View Finding
              </button>
            </div>
          )}

          {view === 'done' && !finding && (
            <div className="mt-6 p-4 border border-state-verified/20 bg-state-verified-bg rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-state-verified" />
                <span className="mono-label text-state-verified">SECURE</span>
              </div>
              <p className="text-sm text-text-secondary">No authorization flaws confirmed.</p>
            </div>
          )}
        </div>

        {/* Right: Live console */}
        <div className="lg:col-span-8">
          <div className="mono-label mb-4">LIVE CONSOLE</div>
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            {/* Console header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface-secondary/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${view === 'running' ? 'bg-state-verified animate-pulse' : 'bg-text-tertiary'}`} />
                <span className="mono-label">{view === 'running' ? 'STREAMING' : 'COMPLETED'}</span>
              </div>
              <span className="mono-label">{events.length} events</span>
            </div>
            {/* Console body */}
            <div ref={feedRef} className="h-[28rem] overflow-y-auto p-4 font-mono text-xs leading-6">
              {events.length === 0 && (
                <div className="text-text-tertiary italic">Waiting for events...</div>
              )}
              {events.map((event) => (
                <div key={event.id} className="flex gap-3 hover:bg-surface-secondary/40 px-1 -mx-1 rounded">
                  <span className="text-text-tertiary flex-shrink-0 select-none">
                    {new Date(event.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>
                  <span className={
                    event.type === 'success' ? 'text-state-verified' :
                    event.type === 'warning' ? 'text-state-medium' :
                    event.type === 'error' ? 'text-state-critical' :
                    'text-text-primary'
                  }>
                    {event.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
