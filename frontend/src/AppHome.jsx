import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Upload, Plus, ArrowRight, Clock, FlaskConical, Library, Sparkles } from 'lucide-react';
import { SUITES } from './DesktopShell.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

const METHOD_COLORS = {
  GET: 'text-emerald-400', POST: 'text-amber-400', PUT: 'text-blue-400',
  PATCH: 'text-purple-400', DELETE: 'text-red-400', HEAD: 'text-teal-400', OPTIONS: 'text-pink-400',
};

export default function AppHome({ user }) {
  const navigate = useNavigate();
  const [recent, setRecent] = useState([]);
  const [libCount, setLibCount] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/rb/history?limit=8`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : []).then(setRecent).catch(() => {});
    fetch(`${API_BASE_URL}/library/catalog`, { headers: authHeaders() })
      .then(r => r.ok ? r.json() : null).then(d => d && setLibCount(d.total_cases)).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-gray-200">
      <div className="max-w-5xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm text-gray-500">{greeting}</p>
          <h1 className="text-3xl font-bold text-white mt-1">Flasqo Workspace</h1>
          <p className="text-gray-500 mt-1.5 text-sm">Everything runs locally on your machine — no account, no cloud.</p>
        </div>

        {/* Primary actions */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <button onClick={() => navigate('/request-builder')}
            className="group text-left p-5 rounded-2xl bg-gradient-to-br from-amber-500/15 to-orange-600/10 border border-orange-500/30 hover:border-orange-400/60 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mb-3">
              <Send size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-white flex items-center gap-1.5">New Request <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
            <p className="text-xs text-gray-400 mt-1">Craft and send any HTTP request. Collections, environments, tests.</p>
          </button>

          <button onClick={() => navigate('/suites')}
            className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center mb-3">
              <FlaskConical size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-white flex items-center gap-1.5">Run Test Suites <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
            <p className="text-xs text-gray-400 mt-1">Functional, smoke, performance, chaos, security and more.</p>
          </button>

          <button onClick={() => navigate('/functional')}
            className="group text-left p-5 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-600 transition-colors">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mb-3">
              <Library size={20} className="text-white" />
            </div>
            <h3 className="font-semibold text-white flex items-center gap-1.5">Built-in Test Library <ArrowRight size={15} className="opacity-0 group-hover:opacity-100 transition-opacity" /></h3>
            <p className="text-xs text-gray-400 mt-1">{libCount ? `${libCount}+ ready-made tests` : 'Ready-made tests'} — offline, no API cost.</p>
          </button>
        </div>

        {/* Three ways to build tests */}
        <div className="mb-10">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">Three ways to build tests</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Plus, title: 'Manual', desc: 'Write each test case yourself with full control.', tint: 'text-gray-300' },
              { icon: Sparkles, title: 'AI Generated', desc: 'Let AI draft a suite from your endpoint (needs API key).', tint: 'text-purple-300' },
              { icon: Library, title: 'Built-in Library', desc: 'Load curated OWASP + functional packs. Zero cost.', tint: 'text-emerald-300' },
            ].map(c => (
              <div key={c.title} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <c.icon size={17} className={`${c.tint} mb-2`} />
                <h4 className="text-sm font-medium text-white">{c.title}</h4>
                <p className="text-xs text-gray-500 mt-1">{c.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Recent + suites */}
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2"><Clock size={14} /> Recent requests</h2>
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 divide-y divide-slate-800/70 overflow-hidden">
              {recent.length ? recent.map(h => (
                <button key={h.id} onClick={() => navigate('/request-builder')}
                  className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-slate-800/60 text-left">
                  <span className={`text-[11px] font-bold w-12 shrink-0 ${METHOD_COLORS[h.method] || 'text-gray-400'}`}>{h.method}</span>
                  <span className="flex-1 text-xs truncate text-gray-400">{h.url}</span>
                  {h.status && <span className="text-[10px] text-gray-500">{h.status}</span>}
                </button>
              )) : (
                <div className="px-4 py-8 text-center text-xs text-gray-600">
                  No requests yet. <button onClick={() => navigate('/request-builder')} className="text-orange-400 hover:underline">Send your first one →</button>
                </div>
              )}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2"><FlaskConical size={14} /> Jump into a suite</h2>
            <div className="grid grid-cols-2 gap-2">
              {SUITES.slice(0, 8).map(s => (
                <button key={s.path} onClick={() => navigate(s.path)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-600 text-left">
                  <s.icon size={15} className={s.color} />
                  <span className="text-xs text-gray-300 truncate">{s.label}</span>
                </button>
              ))}
            </div>
            <button onClick={() => navigate('/suites')} className="mt-2 text-xs text-orange-400 hover:underline">View all {SUITES.length} suites →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
