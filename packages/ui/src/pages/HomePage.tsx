import { useNavigate } from 'react-router-dom';
import { TutusLogo } from '../components/TutusLogo';

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex flex-col">
      {/* Hero section */}
      <section className="flex-1 flex items-center">
        <div className="max-w-7xl mx-auto px-6 w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-16">
          {/* Left: Copy */}
          <div className="animate-in">
            <div className="mb-8">
              <TutusLogo size="lg" />
            </div>
            <h1 className="text-display text-tutus-black mb-6 max-w-lg">
              Find what your users shouldn't be able to do.
            </h1>
            <p className="text-body-lg text-text-secondary max-w-md mb-10 leading-relaxed">
              Tutus autonomously explores your application, discovers dangerous actions,
              verifies the impact, and produces evidence you can reproduce.
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/investigate')}
                className="btn-primary text-base px-7 py-3"
              >
                Start Investigation
              </button>
              <button
                onClick={() => {
                  document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="btn-secondary text-base px-7 py-3"
              >
                See How It Works
              </button>
            </div>
          </div>

          {/* Right: Technical visual */}
          <div className="hidden lg:flex items-center justify-center">
            <div className="relative w-full max-w-md aspect-square">
              {/* Geometric security investigation visual */}
              <svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                {/* Outer ring */}
                <circle cx="200" cy="200" r="180" stroke="#e7e5e4" strokeWidth="0.5" />
                <circle cx="200" cy="200" r="140" stroke="#e7e5e4" strokeWidth="0.5" strokeDasharray="4 4" />
                <circle cx="200" cy="200" r="100" stroke="#d6d3d1" strokeWidth="0.5" />

                {/* Orbital paths */}
                <ellipse cx="200" cy="200" rx="160" ry="80" stroke="#e7e5e4" strokeWidth="0.5" transform="rotate(30 200 200)" />
                <ellipse cx="200" cy="200" rx="160" ry="80" stroke="#e7e5e4" strokeWidth="0.5" transform="rotate(-30 200 200)" />

                {/* Center node */}
                <circle cx="200" cy="180" r="8" fill="#1a1a1a" opacity="0.8" />
                <circle cx="200" cy="180" r="4" fill="#c41e1e" opacity="0.9" />

                {/* Nodes - discovered pages */}
                <circle cx="100" cy="140" r="4" fill="#1a1a1a" opacity="0.6" />
                <circle cx="300" cy="140" r="4" fill="#1a1a1a" opacity="0.6" />
                <circle cx="320" cy="260" r="4" fill="#c41e1e" opacity="0.8" />
                <circle cx="80" cy="260" r="4" fill="#1a1a1a" opacity="0.6" />
                <circle cx="200" cy="60" r="3" fill="#1a1a1a" opacity="0.4" />
                <circle cx="200" cy="340" r="3" fill="#1a1a1a" opacity="0.4" />
                <circle cx="140" cy="320" r="3" fill="#1a1a1a" opacity="0.3" />
                <circle cx="260" cy="320" r="3" fill="#1a1a1a" opacity="0.3" />

                {/* Connection lines */}
                <line x1="200" y1="185" x2="100" y2="140" stroke="#d6d3d1" strokeWidth="0.5" />
                <line x1="200" y1="185" x2="300" y2="140" stroke="#d6d3d1" strokeWidth="0.5" />
                <line x1="200" y1="185" x2="320" y2="260" stroke="#c41e1e" strokeWidth="0.8" opacity="0.6" />
                <line x1="200" y1="185" x2="80" y2="260" stroke="#d6d3d1" strokeWidth="0.5" />

                {/* Coordinate markers */}
                <text x="95" y="130" fill="#a8a29e" fontSize="8" fontFamily="monospace">01</text>
                <text x="295" y="130" fill="#a8a29e" fontSize="8" fontFamily="monospace">02</text>
                <text x="315" y="250" fill="#c41e1e" fontSize="8" fontFamily="monospace" opacity="0.8">03</text>
                <text x="75" y="250" fill="#a8a29e" fontSize="8" fontFamily="monospace">04</text>

                {/* Scanning arc */}
                <path d="M200 200 L350 200 A150 150 0 0 0 275 75" stroke="#1a1a1a" strokeWidth="0.5" fill="none" opacity="0.3" strokeDasharray="2 3" />
              </svg>

              {/* Floating labels */}
              <div className="absolute top-8 right-4 mono-label text-[10px]">DISCOVERY</div>
              <div className="absolute bottom-12 left-4 mono-label text-[10px]">VERIFICATION</div>
              <div className="absolute top-1/2 right-0 translate-x-2">
                <span className="mono-label text-[10px] text-state-critical">FINDING</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works section */}
      <section id="how-it-works" className="border-t border-border py-20">
        <div className="max-w-7xl mx-auto px-6">
          <h2 className="text-headline text-tutus-black mb-12">How Tutus investigates</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
            {[
              { num: '01', label: 'AUTHENTICATE', desc: 'Log into the target application' },
              { num: '02', label: 'EXPLORE', desc: 'Map every accessible page and endpoint' },
              { num: '03', label: 'DISCOVER', desc: 'Identify all actionable elements' },
              { num: '04', label: 'ANALYZE', desc: 'Score actions by potential impact' },
              { num: '05', label: 'VERIFY', desc: 'Attempt high-risk actions' },
              { num: '06', label: 'PROVE', desc: 'Capture reproducible evidence' },
            ].map((step) => (
              <div key={step.num} className="group">
                <div className="mono-label text-tutus-red mb-2">{step.num}</div>
                <div className="text-sm font-semibold text-tutus-black mb-1">{step.label}</div>
                <div className="text-caption text-text-secondary">{step.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
