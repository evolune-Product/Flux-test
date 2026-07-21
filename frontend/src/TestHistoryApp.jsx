import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, Activity, BarChart3, Clock, Zap, LogOut, Link2, Copy, Share2 } from 'lucide-react';

import { API_BASE_URL } from './lib/api.js';

// ── module metadata ──────────────────────────────────────────────
const MODULE_META = {
  functional:       { label: 'Functional',      color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  smoke:            { label: 'Smoke',            color: 'bg-green-500/20 text-green-300 border-green-500/30' },
  performance:      { label: 'Performance',      color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  chaos:            { label: 'Chaos',            color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  fuzz:             { label: 'Fuzz',             color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  regression:       { label: 'Regression',       color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  contract:         { label: 'Contract',         color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  graphql:          { label: 'GraphQL',          color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
  'auto-discovery': { label: 'Auto Discovery',   color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  'vibe-testing':   { label: 'Vibe Testing',     color: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30' },
};

function moduleMeta(mod) {
  return MODULE_META[mod] || { label: mod, color: 'bg-slate-500/20 text-slate-300 border-slate-500/30' };
}

function relativeTime(isoString) {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── tiny inline SVG bar chart (7-day trend) ─────────────────────
function TrendChart({ trend }) {
  if (!trend || trend.length === 0) return null;

  const maxVal = Math.max(...trend.map(d => d.passed + d.failed), 1);
  const W = 420, H = 80, barW = 40, gap = 20;

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="w-full" style={{ maxWidth: W }}>
      {trend.map((d, i) => {
        const totalH = ((d.passed + d.failed) / maxVal) * H;
        const passH  = (d.passed / maxVal) * H;
        const failH  = totalH - passH;
        const x = i * (barW + gap);
        const label = d.date.slice(5); // MM-DD

        return (
          <g key={d.date}>
            {/* fail portion (bottom) */}
            {failH > 0 && (
              <rect x={x} y={H - totalH} width={barW} height={failH}
                fill="#ef4444" opacity="0.7" rx="2" />
            )}
            {/* pass portion (top) */}
            {passH > 0 && (
              <rect x={x} y={H - totalH + failH} width={barW} height={passH}
                fill="#22c55e" opacity="0.7" rx="2" />
            )}
            {/* date label */}
            <text x={x + barW / 2} y={H + 16} textAnchor="middle"
              fontSize="10" fill="#64748b">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── main component ───────────────────────────────────────────────
export default function TestHistoryApp({ user, onLogout }) {
  const navigate = useNavigate();

  const [stats, setStats]       = useState(null);
  const [runs, setRuns]         = useState([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [module, setModule]     = useState('');
  const [loading, setLoading]   = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);
  const [dashSharing, setDashSharing] = useState(false);
  const [dashCopied, setDashCopied]   = useState(false);

  const authHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  });

  const handleShareDashboard = async () => {
    setDashSharing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/share`, {
        method: 'POST',
        headers: authHeaders()
      });
      const data = await res.json();
      if (data.success) {
        const url = `${window.location.origin}/dashboard/${data.token}`;
        await navigator.clipboard.writeText(url);
        setDashCopied(true);
        setTimeout(() => setDashCopied(false), 3000);
      }
    } catch {
      // silently ignore
    } finally {
      setDashSharing(false);
    }
  };

  // fetch summary stats once
  useEffect(() => {
    fetch(`${API_BASE_URL}/history/stats`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setStats(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // fetch runs when module filter or page changes
  const fetchRuns = useCallback(() => {
    setRunsLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (module) params.set('module', module);

    fetch(`${API_BASE_URL}/history/runs?${params}`, { headers: authHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setRuns(d.runs);
          setTotal(d.total);
        }
      })
      .catch(() => {})
      .finally(() => setRunsLoading(false));
  }, [module, page]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  // reset to page 1 when module filter changes
  const handleModuleChange = (mod) => {
    setModule(mod);
    setPage(1);
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* ── Header ── */}
      <div className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/10 bg-slate-900/70">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-colors text-sm text-slate-300"
            >
              <ArrowLeft size={15} /> Dashboard
            </button>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
                Test History
              </h1>
              <p className="text-xs text-slate-400">All your test runs in one place</p>
            </div>
          </div>

          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-400 hidden md:inline">{user.username}</span>
              <button
                onClick={handleShareDashboard}
                disabled={dashSharing}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                  dashCopied
                    ? 'bg-green-500/20 border-green-500/30 text-green-400'
                    : 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/20 text-blue-400'
                } disabled:opacity-50`}
              >
                {dashCopied ? <><Copy size={14} /> Link Copied!</> : <><Share2 size={14} /> Share Dashboard</>}
              </button>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm transition-colors"
              >
                <LogOut size={14} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">

        {/* ── Summary Cards ── */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-slate-800/40 animate-pulse" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<BarChart3 size={20} className="text-blue-400" />}
              label="Total Runs" value={stats.total_runs} />
            <StatCard icon={<CheckCircle size={20} className="text-green-400" />}
              label="Pass Rate" value={`${stats.pass_rate}%`}
              sub={`${stats.total_passed} passed`} />
            <StatCard icon={<XCircle size={20} className="text-red-400" />}
              label="Total Failed" value={stats.total_failed}
              sub={`across all modules`} />
            <StatCard icon={<Activity size={20} className="text-purple-400" />}
              label="Modules Used" value={Object.keys(stats.modules || {}).length} />
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400 text-sm">Could not load stats.</div>
        )}

        {/* ── 7-Day Trend ── */}
        {stats?.daily_trend && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={16} className="text-yellow-400" />
              <span className="text-sm font-semibold text-slate-200">7-Day Test Trend</span>
              <div className="flex items-center gap-3 ml-auto text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-green-500 inline-block opacity-70" /> Passed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-red-500 inline-block opacity-70" /> Failed
                </span>
              </div>
            </div>
            <TrendChart trend={stats.daily_trend} />
          </div>
        )}

        {/* ── Module Filter Tabs ── */}
        <div className="flex flex-wrap gap-2">
          {['', ...Object.keys(MODULE_META)].map(mod => {
            const active = module === mod;
            const meta = mod ? moduleMeta(mod) : { label: 'All' };
            return (
              <button
                key={mod || 'all'}
                onClick={() => handleModuleChange(mod)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  active
                    ? 'bg-white/15 border-white/30 text-white'
                    : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {meta.label}
                {mod && stats?.modules?.[mod]
                  ? <span className="ml-1.5 opacity-60">({stats.modules[mod]})</span>
                  : null}
              </button>
            );
          })}
        </div>

        {/* ── Runs List ── */}
        <div className="space-y-3">
          {runsLoading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-16 rounded-xl bg-slate-800/40 animate-pulse" />
            ))
          ) : runs.length === 0 ? (
            <EmptyState module={module} />
          ) : (
            runs.map(run => <RunRow key={run.session_id} run={run} />)
          )}
        </div>

        {/* ── Pagination ── */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 pt-4">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Previous
            </button>
            <span className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-slate-300 disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── sub-components ───────────────────────────────────────────────

function StatCard({ icon, label, value, sub }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function RunRow({ run }) {
  const meta = moduleMeta(run.module);
  const passRate = run.total_tests > 0
    ? Math.round((run.passed / run.total_tests) * 100)
    : 0;
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied]   = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/history/runs/${run.session_id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const url = `${window.location.origin}/report/${data.share_token}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // silently ignore — clipboard may not be available in non-https
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-slate-600/60 transition-colors">
      {/* status indicator */}
      <div className={`w-2 h-10 rounded-full flex-shrink-0 ${run.overall_status === 'PASS' ? 'bg-green-500' : 'bg-red-500'}`} />

      {/* module badge */}
      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${meta.color}`}>
        {meta.label}
      </span>

      {/* URL */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 truncate">{run.api_url}</p>
        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
          <Clock size={11} /> {relativeTime(run.executed_at)}
        </p>
      </div>

      {/* stats */}
      <div className="flex items-center gap-4 flex-shrink-0 text-sm">
        <span className="text-slate-400">{run.total_tests} tests</span>
        <span className="text-green-400">{run.passed} ✓</span>
        <span className="text-red-400">{run.failed} ✗</span>
        <span className={`font-semibold ${passRate === 100 ? 'text-green-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
          {passRate}%
        </span>
      </div>

      {/* overall badge */}
      <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
        run.overall_status === 'PASS'
          ? 'bg-green-500/15 text-green-400 border border-green-500/20'
          : 'bg-red-500/15 text-red-400 border border-red-500/20'
      }`}>
        {run.overall_status}
      </span>

      {/* Share button */}
      <button
        onClick={handleShare}
        disabled={sharing}
        title="Copy shareable link"
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 ${
          copied
            ? 'bg-green-500/20 border-green-500/30 text-green-400'
            : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
        } disabled:opacity-50`}
      >
        {copied ? (
          <><Copy size={12} /> Copied!</>
        ) : (
          <><Link2 size={12} /> Share</>
        )}
      </button>
    </div>
  );
}

function EmptyState({ module }) {
  return (
    <div className="text-center py-16 bg-slate-800/20 border border-slate-700/30 rounded-2xl">
      <BarChart3 size={40} className="text-slate-600 mx-auto mb-4" />
      <p className="text-slate-300 font-medium">No runs yet</p>
      <p className="text-slate-500 text-sm mt-1">
        {module
          ? `No ${moduleMeta(module).label} runs recorded.`
          : 'Run any test module and your history will appear here.'}
      </p>
    </div>
  );
}
