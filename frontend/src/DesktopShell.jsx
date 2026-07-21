import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Send, FlaskConical, Clock, Globe, Settings, RotateCcw,
  Zap, Activity, AlertTriangle, Bug, GitCompare, FileText, Database,
  Search, Sparkles, Workflow, Link2, ShieldCheck, Rocket
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_LOCAL_MODE === '1'
  ? window.location.origin
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000');

// Persistent native-app chrome for desktop/local mode: a slim vertical icon rail
// on the far left (Postman-style) that stays mounted across every route.

const PRIMARY = [
  { icon: Home, label: 'Home', path: '/' },
  { icon: Send, label: 'Request Builder', path: '/request-builder' },
  { icon: FlaskConical, label: 'Test Suites', path: '/suites' },
  { icon: Clock, label: 'History', path: '/history' },
  { icon: Workflow, label: 'Flow Builder', path: '/flow-builder' },
];

// Quick-launch popover for the Test Suites rail button
export const SUITES = [
  { icon: Rocket, label: 'FullSend — URL Scan', path: '/fullsend', color: 'text-fuchsia-400', desc: 'Scan any URL end-to-end' },
  { icon: FileText, label: 'Functional', path: '/functional', color: 'text-blue-400', desc: 'Validate API logic' },
  { icon: Zap, label: 'Smoke', path: '/smoke', color: 'text-emerald-400', desc: 'Fast health checks' },
  { icon: Activity, label: 'Performance', path: '/performance', color: 'text-purple-400', desc: 'Load & stress' },
  { icon: AlertTriangle, label: 'Chaos', path: '/chaos', color: 'text-orange-400', desc: 'Resilience' },
  { icon: Bug, label: 'Fuzz', path: '/fuzz', color: 'text-red-400', desc: 'Security fuzzing' },
  { icon: GitCompare, label: 'Regression', path: '/regression', color: 'text-cyan-400', desc: 'Detect changes' },
  { icon: FileText, label: 'Contract', path: '/contract', color: 'text-indigo-400', desc: 'API compatibility' },
  { icon: Database, label: 'GraphQL', path: '/graphql', color: 'text-pink-400', desc: 'Query testing' },
  { icon: Search, label: 'Auto-Discovery', path: '/auto-discovery', color: 'text-teal-400', desc: 'Find endpoints' },
  { icon: Sparkles, label: 'Vibe Testing', path: '/vibe-testing', color: 'text-amber-400', desc: 'Natural-language tests' },
  { icon: Link2, label: 'Integration', path: '/integration', color: 'text-green-400', desc: 'Cross-service' },
  { icon: ShieldCheck, label: 'Production Gate', path: '/prod-gate', color: 'text-violet-400', desc: 'Release gate' },
];

function RailButton({ icon: Icon, label, active, onClick }) {
  return (
    <button onClick={onClick} title={label}
      className={`group relative w-11 h-11 flex items-center justify-center rounded-xl transition-colors ${
        active ? 'bg-gradient-to-br from-amber-500/25 to-orange-600/25 text-orange-300' : 'text-gray-500 hover:text-white hover:bg-slate-800'
      }`}>
      {active && <span className="absolute -left-2 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r bg-orange-400" />}
      <Icon size={20} />
      <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap px-2 py-1 rounded-md bg-slate-800 text-xs text-gray-100 opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {label}
      </span>
    </button>
  );
}

export default function DesktopShell({ user, onLogout, children, trialCount = 0, isLocalUser = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const [account, setAccount] = useState(null);

  // Reflect cloud sign-in state on the avatar (refresh when landing on Settings)
  useEffect(() => {
    fetch(`${API_BASE_URL}/account/session`)
      .then(r => r.ok ? r.json() : null).then(setAccount).catch(() => {});
  }, [path === '/settings']);

  const isActive = (p) => (p === '/' ? path === '/' : path.startsWith(p));
  const signedIn = account?.signed_in;
  const initial = (signedIn ? (account.user?.username || 'U') : (user?.username || 'L'))[0].toUpperCase();

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Icon rail */}
      <nav className="w-16 shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col items-center py-3 gap-1 z-30">
        <button onClick={() => navigate('/')} title="Flasqo" className="mb-2 w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center shadow-lg">
          <Send size={18} className="text-white" />
        </button>

        {PRIMARY.map(item => (
          <RailButton key={item.path} icon={item.icon} label={item.label}
            active={item.path === '/suites' ? path === '/suites' : isActive(item.path)}
            onClick={() => navigate(item.path)} />
        ))}

        <div className="flex-1" />

        <RailButton icon={Settings} label="Account & Settings" active={isActive('/settings')} onClick={() => navigate('/settings')} />
        <button onClick={onLogout} title="Reset local workspace"
          className="w-11 h-11 flex items-center justify-center rounded-xl text-gray-500 hover:text-amber-400 hover:bg-slate-800">
          <RotateCcw size={18} />
        </button>

        {/* Trial badge — shown only for the built-in local user while trial is active */}
        {isLocalUser && !signedIn && trialCount < 3 && (
          <div title={`${3 - trialCount} free run${3 - trialCount === 1 ? '' : 's'} left`}
            className="flex flex-col items-center mb-0.5">
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-tight ${
              trialCount === 2
                ? 'bg-red-900/60 text-red-300 border border-red-700/50'
                : trialCount === 1
                ? 'bg-orange-900/60 text-orange-300 border border-orange-700/50'
                : 'bg-amber-900/60 text-amber-300 border border-amber-700/50'
            }`}>
              {3 - trialCount} left
            </span>
          </div>
        )}

        <button onClick={() => navigate('/settings')} title={signedIn ? `${account.user?.username} — Account` : 'Sign in / Account'}
          className="group relative mt-1 w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white ring-2 ring-transparent hover:ring-orange-500/50">
          <span className={`w-8 h-8 rounded-full flex items-center justify-center ${signedIn ? 'bg-gradient-to-br from-amber-500 to-orange-600' : 'bg-gradient-to-br from-slate-600 to-slate-700'}`}>{initial}</span>
          {signedIn && <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900" />}
          {!signedIn && isLocalUser && trialCount < 3 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-slate-900" />
          )}
        </button>
      </nav>

      {/* Routed content */}
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
