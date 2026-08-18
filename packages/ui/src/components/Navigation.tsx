import { NavLink } from 'react-router-dom';
import { TutusLogo } from './TutusLogo';

interface Props {
  connected: boolean;
}

const navItems = [
  { to: '/investigate', label: 'Investigate' },
  { to: '/findings', label: 'Findings' },
  { to: '/evidence', label: 'Evidence' },
  { to: '/replay', label: 'Replay' },
];

export function Navigation({ connected }: Props) {
  return (
    <header className="sticky top-0 z-50 bg-surface-primary/90 backdrop-blur-md section-border">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <NavLink to="/" className="flex items-center">
          <TutusLogo size="sm" />
        </NavLink>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `px-3.5 py-1.5 text-sm font-medium rounded-md transition-colors duration-150 ${
                  isActive
                    ? 'text-tutus-black bg-surface-secondary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-secondary/60'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <a
            href="http://localhost:4000"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-1.5 text-sm font-medium rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-secondary/60 transition-colors duration-150"
          >
            Vault
          </a>
        </nav>

        {/* Right: Status + action */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? 'bg-state-verified' : 'bg-state-critical'
              }`}
            />
            <span className="mono-label">
              {connected ? 'LIVE' : 'OFFLINE'}
            </span>
          </div>
          <NavLink to="/investigate" className="btn-primary text-xs py-2 px-4">
            New Scan
          </NavLink>
        </div>
      </div>
    </header>
  );
}
