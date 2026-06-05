import React, { useState, useEffect } from 'react';
import {
  CheckCircle, XCircle, Clock, Zap, Shield,
  ExternalLink, BarChart3, AlertTriangle
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const MODULE_META = {
  functional:       { label: 'Functional Testing',    color: 'from-blue-600 to-purple-600' },
  smoke:            { label: 'Smoke Testing',          color: 'from-green-600 to-emerald-600' },
  performance:      { label: 'Performance Testing',    color: 'from-purple-600 to-pink-600' },
  chaos:            { label: 'Chaos Testing',          color: 'from-orange-600 to-red-600' },
  fuzz:             { label: 'Fuzz Testing',           color: 'from-red-600 to-orange-600' },
  regression:       { label: 'Regression Testing',     color: 'from-cyan-600 to-indigo-600' },
  contract:         { label: 'Contract Testing',       color: 'from-violet-600 to-purple-600' },
  graphql:          { label: 'GraphQL Testing',        color: 'from-indigo-600 to-cyan-600' },
  'auto-discovery': { label: 'Auto-Discovery',         color: 'from-emerald-600 to-teal-600' },
  'vibe-testing':   { label: 'Vibe Testing',           color: 'from-fuchsia-600 to-violet-600' },
};

function moduleMeta(mod) {
  return MODULE_META[mod] || { label: mod, color: 'from-slate-600 to-slate-500' };
}

function fmt(isoString) {
  return new Date(isoString).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

export default function SharedReportApp({ token }) {
  const [run, setRun]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/report/${token}`)
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        return r.json();
      })
      .then(d => { if (d?.success) setRun(d.run); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-sm animate-pulse">Loading report...</div>
      </div>
    );
  }

  if (notFound || !run) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertTriangle size={40} className="text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-white mb-2">Report not found</h2>
          <p className="text-slate-400 text-sm">
            This link may be invalid or the report has been removed.
          </p>
        </div>
      </div>
    );
  }

  const meta = moduleMeta(run.module);
  const passRate = run.pass_rate ?? (run.total_tests > 0
    ? Math.round((run.passed / run.total_tests) * 100)
    : 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* ── Shared-by banner ── */}
      <div className="bg-gradient-to-r from-blue-900/60 to-purple-900/60 border-b border-white/10 py-3 px-6 text-center">
        <p className="text-sm text-slate-300">
          Shared via{' '}
          <span className="font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Flasqo
          </span>
          {' '}· API Testing Platform by EvoluneEdgeTech
        </p>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-12">

        {/* ── Status hero ── */}
        <div className="text-center mb-10">
          {run.overall_status === 'PASS' ? (
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle size={44} className="text-green-400" />
            </div>
          ) : (
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
              <XCircle size={44} className="text-red-400" />
            </div>
          )}

          <h1 className="text-3xl font-bold mb-2">
            {run.overall_status === 'PASS' ? 'All Tests Passed' : 'Tests Failed'}
          </h1>
          <p className="text-slate-400 text-sm">{fmt(run.executed_at)}</p>
        </div>

        {/* ── Module + URL card ── */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className={`px-3 py-1.5 rounded-full text-xs font-semibold bg-gradient-to-r ${meta.color} text-white`}>
              {meta.label}
            </div>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              run.overall_status === 'PASS'
                ? 'bg-green-500/15 text-green-400 border border-green-500/20'
                : 'bg-red-500/15 text-red-400 border border-red-500/20'
            }`}>
              {run.overall_status}
            </span>
          </div>

          <div className="text-sm text-slate-300 font-mono break-all bg-slate-900/50 rounded-lg px-4 py-3">
            {run.api_url}
          </div>
        </div>

        {/* ── Stat cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Tests"
            value={run.total_tests}
            icon={<BarChart3 size={18} className="text-blue-400" />}
          />
          <StatCard
            label="Passed"
            value={run.passed}
            icon={<CheckCircle size={18} className="text-green-400" />}
            valueClass="text-green-400"
          />
          <StatCard
            label="Failed"
            value={run.failed}
            icon={<XCircle size={18} className="text-red-400" />}
            valueClass={run.failed > 0 ? 'text-red-400' : 'text-white'}
          />
          <StatCard
            label="Pass Rate"
            value={`${passRate}%`}
            icon={<Zap size={18} className="text-yellow-400" />}
            valueClass={passRate === 100 ? 'text-green-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}
          />
        </div>

        {/* ── Duration ── */}
        {run.duration_ms && (
          <div className="bg-slate-800/30 border border-slate-700/30 rounded-xl px-5 py-3 mb-8 flex items-center gap-3 text-sm text-slate-400">
            <Clock size={15} />
            Completed in {run.duration_ms >= 1000
              ? `${(run.duration_ms / 1000).toFixed(2)}s`
              : `${run.duration_ms}ms`}
          </div>
        )}

        {/* ── Pass rate bar ── */}
        <div className="mb-10">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Pass rate</span>
            <span>{passRate}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-700/60 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                passRate === 100 ? 'bg-green-500' : passRate >= 50 ? 'bg-yellow-500' : 'bg-red-500'
              }`}
              style={{ width: `${passRate}%` }}
            />
          </div>
        </div>

        {/* ── Full result drill-down ── */}
        {run.result_json && (
          <div className="mb-10">
            <h2 className="text-sm font-semibold text-slate-300 mb-3 uppercase tracking-wider">
              Full Results
            </h2>
            <ResultDetail module={run.module} data={run.result_json} />
          </div>
        )}

        {/* ── CTA ── */}
        <div className="text-center border-t border-slate-700/40 pt-8">
          <p className="text-slate-400 text-sm mb-4">
            Want to run tests like this on your own APIs?
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-purple-500/20"
          >
            <Shield size={16} />
            Try Flasqo for free
            <ExternalLink size={14} />
          </a>
          <p className="text-slate-600 text-xs mt-4">No credit card required</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, valueClass = 'text-white' }) {
  return (
    <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <div className={`text-2xl font-bold ${valueClass}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
    </div>
  );
}

function ResultDetail({ module, data }) {
  // Vibe testing — scenario list (crawl, screenshot, code, apk modes)
  if (module === 'vibe-testing' && data.test_scenarios?.length > 0) {
    return (
      <div className="space-y-2">
        {data.test_scenarios.map((s, i) => (
          <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className="text-sm font-medium text-white">{s.title}</p>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-slate-400 flex-shrink-0">
                {s.category}
              </span>
            </div>
            {s.steps?.length > 0 && (
              <ol className="mt-2 space-y-1">
                {s.steps.map((step, j) => (
                  <li key={j} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-fuchsia-400 flex-shrink-0">{j + 1}.</span>
                    {step}
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Vibe testing — visual comparison result
  if (module === 'vibe-testing' && data.overall_status) {
    const statusColor = data.overall_status === 'fail' ? 'text-red-400' : 'text-green-400';
    return (
      <div className="space-y-3">
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 text-sm">
          <p className="font-semibold mb-1">
            Visual status:{' '}
            <span className={statusColor}>{data.overall_status?.toUpperCase()}</span>
          </p>
          {data.summary && <p className="text-slate-400 text-xs mt-1">{data.summary}</p>}
          {data.pixel_diff_score !== undefined && (
            <p className="text-slate-400 text-xs mt-1">{data.pixel_diff_score}% pixels changed</p>
          )}
        </div>
        {data.changes?.map((c, i) => (
          <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3">
            <p className="text-sm text-white">{c.element}</p>
            <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>
          </div>
        ))}
      </div>
    );
  }

  // Generic fallback — collapsible raw JSON
  return (
    <details className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-4">
      <summary className="text-xs text-slate-400 cursor-pointer select-none">
        Raw JSON result
      </summary>
      <pre className="mt-3 text-xs text-slate-400 overflow-x-auto whitespace-pre-wrap break-all">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}
