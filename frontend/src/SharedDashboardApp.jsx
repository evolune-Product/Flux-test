import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle, XCircle, BarChart3, Activity,
  Clock, Zap, RefreshCw, Shield, ExternalLink, AlertTriangle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const REFRESH_INTERVAL = 30; // seconds

const MODULE_META = {
  functional:       { label: 'Functional',    color: 'from-blue-600 to-purple-600' },
  smoke:            { label: 'Smoke',          color: 'from-green-600 to-emerald-600' },
  performance:      { label: 'Performance',    color: 'from-purple-600 to-pink-600' },
  chaos:            { label: 'Chaos',          color: 'from-orange-600 to-red-600' },
  fuzz:             { label: 'Fuzz',           color: 'from-red-600 to-orange-600' },
  regression:       { label: 'Regression',     color: 'from-cyan-600 to-indigo-600' },
  contract:         { label: 'Contract',       color: 'from-violet-600 to-purple-600' },
  graphql:          { label: 'GraphQL',        color: 'from-indigo-600 to-cyan-600' },
  'auto-discovery': { label: 'Auto Discovery', color: 'from-emerald-600 to-teal-600' },
  'vibe-testing':   { label: 'Vibe Testing',   color: 'from-fuchsia-600 to-violet-600' },
};

function moduleMeta(mod) {
  return MODULE_META[mod] || { label: mod, color: 'from-slate-600 to-slate-500' };
}

function relativeTime(isoString) {
  const diff = (Date.now() - new Date(isoString).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function fmt(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// ── Inline SVG trend chart (reused pattern) ──────────────────────
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
        const x      = i * (barW + gap);
        return (
          <g key={d.date}>
            {failH > 0 && <rect x={x} y={H - totalH} width={barW} height={failH} fill="#ef4444" opacity="0.7" rx="2" />}
            {passH > 0 && <rect x={x} y={H - totalH + failH} width={barW} height={passH} fill="#22c55e" opacity="0.7" rx="2" />}
            <text x={x + barW / 2} y={H + 16} textAnchor="middle" fontSize="10" fill="#64748b">
              {d.date.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────
export default function SharedDashboardApp({ token }) {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/dashboard/${token}`);
      if (res.status === 404) { setNotFound(true); return; }
      const json = await res.json();
      if (json.success) {
        setData(json);
        setCountdown(REFRESH_INTERVAL);
      }
    } catch {
      if (!silent && !data) setNotFound(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  // Initial fetch
  useEffect(() => { fetchDashboard(false); }, [fetchDashboard]);

  // Auto-refresh countdown
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          fetchDashboard(true);
          return REFRESH_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchDashboard]);

  // ── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading dashboard...</div>
      </div>
    );
  }

  // ── Not found ────────────────────────────────────────────────────
  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Dashboard not found</h2>
          <p className="text-slate-400 text-sm">This link may be invalid or the dashboard has been removed.</p>
        </div>
      </div>
    );
  }

  const passRate = data.pass_rate ?? 0;
  const moduleCount = Object.keys(data.modules || {}).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* ── Top banner ── */}
      <div className="bg-gradient-to-r from-blue-900/60 to-purple-900/60 border-b border-white/10 py-3 px-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-3">
          <p className="text-sm text-slate-300">
            <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Evo-TFX
            </span>
            {' '}· Live Testing Dashboard shared by{' '}
            <span className="text-white font-semibold">{data.username}</span>
          </p>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {refreshing ? (
              <RefreshCw size={12} className="animate-spin text-blue-400" />
            ) : (
              <Clock size={12} />
            )}
            <span>
              {refreshing ? 'Refreshing...' : `Refreshes in ${countdown}s`}
            </span>
            <button
              onClick={() => fetchDashboard(true)}
              className="ml-2 px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 transition-colors"
            >
              Refresh now
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Page title ── */}
        <div>
          <h1 className="text-2xl font-bold text-white">Test Dashboard</h1>
          <p className="text-slate-400 text-sm mt-1">
            Last updated {fmt(data.refreshed_at)}
          </p>
        </div>

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<BarChart3 size={20} className="text-blue-400" />}
            label="Total Runs"
            value={data.total_runs}
          />
          <StatCard
            icon={<CheckCircle size={20} className="text-green-400" />}
            label="Pass Rate"
            value={`${passRate}%`}
            sub={`${data.total_passed} passed`}
            valueClass={passRate === 100 ? 'text-green-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}
          />
          <StatCard
            icon={<XCircle size={20} className="text-red-400" />}
            label="Total Failed"
            value={data.total_failed}
            valueClass={data.total_failed > 0 ? 'text-red-400' : 'text-white'}
          />
          <StatCard
            icon={<Activity size={20} className="text-purple-400" />}
            label="Modules Active"
            value={moduleCount}
          />
        </div>

        {/* ── Module breakdown ── */}
        {moduleCount > 0 && (
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
              Modules Used
            </h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.modules).map(([mod, count]) => {
                const meta = moduleMeta(mod);
                return (
                  <div
                    key={mod}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${meta.color} text-white flex items-center gap-1.5`}
                  >
                    {meta.label}
                    <span className="bg-white/20 rounded-full px-1.5 py-0.5 text-[10px]">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── 7-day trend ── */}
        {data.daily_trend && (
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
            <TrendChart trend={data.daily_trend} />
          </div>
        )}

        {/* ── Pass rate bar ── */}
        <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-6">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Overall pass rate</span>
            <span>{passRate}%</span>
          </div>
          <div className="w-full h-3 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                passRate === 100 ? 'bg-green-500' : passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${passRate}%` }}
            />
          </div>
        </div>

        {/* ── Recent runs ── */}
        <div>
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
            Recent Runs
          </h2>
          {data.recent_runs.length === 0 ? (
            <div className="text-center py-12 bg-slate-800/20 border border-slate-700/30 rounded-2xl">
              <BarChart3 size={36} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No runs recorded yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.recent_runs.map(run => {
                const meta     = moduleMeta(run.module);
                const pr       = run.total_tests > 0
                  ? Math.round((run.passed / run.total_tests) * 100) : 0;
                return (
                  <div
                    key={run.session_id}
                    className="bg-slate-800/40 border border-slate-700/40 rounded-xl px-5 py-4 flex items-center gap-4 hover:border-slate-600/60 transition-colors"
                  >
                    {/* status bar */}
                    <div className={`w-1.5 h-10 rounded-full flex-shrink-0 ${run.overall_status === 'PASS' ? 'bg-green-500' : 'bg-red-500'}`} />

                    {/* module badge */}
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full bg-gradient-to-r ${meta.color} text-white flex-shrink-0`}>
                      {meta.label}
                    </span>

                    {/* URL + time */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-200 truncate">{run.api_url}</p>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock size={10} /> {relativeTime(run.executed_at)}
                      </p>
                    </div>

                    {/* stats */}
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span className="text-slate-400">{run.total_tests} tests</span>
                      <span className="text-green-400">{run.passed}✓</span>
                      <span className="text-red-400">{run.failed}✗</span>
                      <span className={`font-bold ${pr === 100 ? 'text-green-400' : pr >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {pr}%
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
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── CTA ── */}
        <div className="text-center border-t border-slate-700/40 pt-8">
          <p className="text-slate-400 text-sm mb-4">
            Want to run your own API tests and share a live dashboard like this?
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/20"
          >
            <Shield size={16} />
            Try Evo-TFX for free
            <ExternalLink size={14} />
          </a>
          <p className="text-slate-600 text-xs mt-4">No credit card required</p>
        </div>

      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, valueClass = 'text-white' }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-2xl p-5 flex flex-col gap-2">
      <div className="flex items-center gap-2 text-slate-400 text-xs font-medium uppercase tracking-wide">
        {icon} {label}
      </div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
