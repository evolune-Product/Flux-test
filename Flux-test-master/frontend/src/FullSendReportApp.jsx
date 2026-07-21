import { useState, useEffect } from 'react';
import {
  Zap, Globe, ShieldCheck, Activity, Camera, FlaskConical,
  CheckCircle2, XCircle, AlertTriangle, Info, ChevronDown, ChevronRight,
  ExternalLink, Copy, ArrowRight, Clock, TrendingUp, Shield,
  BarChart2, Eye, Bug, Sparkles
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Severity badge ────────────────────────────────────────────────────────────
const SEV_STYLE = {
  critical: { bg: 'rgba(239,68,68,0.12)', color: '#f87171', border: 'rgba(239,68,68,0.25)' },
  high:     { bg: 'rgba(249,115,22,0.12)', color: '#fb923c', border: 'rgba(249,115,22,0.25)' },
  medium:   { bg: 'rgba(234,179,8,0.12)',  color: '#facc15', border: 'rgba(234,179,8,0.25)' },
  low:      { bg: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  info:     { bg: 'rgba(148,163,184,0.1)', color: '#94a3b8', border: 'rgba(148,163,184,0.15)' },
};

function SevBadge({ severity }) {
  const s = SEV_STYLE[severity] || SEV_STYLE.info;
  return (
    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide border"
      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {severity}
    </span>
  );
}

// ─── Health score ring ─────────────────────────────────────────────────────────
function HealthRing({ score }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#10b981' : score >= 55 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Healthy' : score >= 55 ? 'Needs Work' : 'At Risk';

  return (
    <div className="relative w-28 h-28 flex items-center justify-center mx-auto">
      <svg width="112" height="112" className="-rotate-90">
        <circle cx="56" cy="56" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <circle cx="56" cy="56" r={r} fill="none" stroke={color}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1.2s ease-out', filter: `drop-shadow(0 0 8px ${color}80)` }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-white">{score}</span>
        <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
      </div>
    </div>
  );
}

// ─── Collapsible section ───────────────────────────────────────────────────────
function Section({ icon: Icon, title, color, badge, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden mb-4"
      style={{ background: 'rgba(255,255,255,0.02)' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/3 transition-colors">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18` }}>
          <Icon size={15} style={{ color }} />
        </div>
        <span className="font-semibold text-white text-sm flex-1">{title}</span>
        {badge && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium mr-2"
            style={{ background: `${color}20`, color }}>
            {badge}
          </span>
        )}
        {open ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Smoke / functional results table ─────────────────────────────────────────
function TestTable({ results = [] }) {
  if (!results.length) return <p className="text-white/30 text-sm">No results.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-white/40 border-b border-white/5">
            <th className="text-left py-2 pr-4 font-medium">URL</th>
            <th className="text-left py-2 pr-3 font-medium">Status</th>
            <th className="text-left py-2 pr-3 font-medium">ms</th>
            <th className="text-left py-2 font-medium">Result</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r, i) => (
            <tr key={i} className="border-b border-white/4 hover:bg-white/2 transition-colors">
              <td className="py-2 pr-4 max-w-xs">
                <span className="text-white/60 font-mono truncate block"
                  title={r.url}>{r.url?.replace(/^https?:\/\//, '').substring(0, 55) || '—'}</span>
              </td>
              <td className="py-2 pr-3">
                <span className={`font-mono font-bold ${r.status_code >= 400 || r.status_code === 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {r.status_code || r.actual_status || '—'}
                </span>
              </td>
              <td className="py-2 pr-3 text-white/50">{r.response_ms ?? '—'}</td>
              <td className="py-2">
                {r.passed
                  ? <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={11} /> Pass</span>
                  : <span className="flex items-center gap-1 text-red-400"><XCircle size={11} /> Fail</span>
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Security issues list ─────────────────────────────────────────────────────
function SecurityList({ issues = [] }) {
  if (!issues.length) return <p className="text-green-400 text-sm flex items-center gap-2"><CheckCircle2 size={14} /> No security issues detected.</p>;
  return (
    <div className="space-y-2">
      {issues.map((issue, i) => (
        <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-white/5"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <AlertTriangle size={13} className="mt-0.5 flex-shrink-0 text-orange-400" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-white/80 text-xs font-medium">{issue.title}</span>
              <SevBadge severity={issue.severity} />
            </div>
            {issue.detail && <p className="text-white/40 text-xs">{issue.detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Performance list ─────────────────────────────────────────────────────────
function PerfTable({ results = [] }) {
  if (!results.length) return <p className="text-white/30 text-sm">No data.</p>;
  const ratingColor = { fast: '#10b981', acceptable: '#f59e0b', slow: '#f97316', critical: '#ef4444' };
  return (
    <div className="space-y-2">
      {results.map((r, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-white/5"
          style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-xs font-mono truncate">{r.url?.replace(/^https?:\/\//, '').substring(0, 60)}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-white/50 text-xs">{r.avg_ms}ms</span>
            <span className="w-2 h-2 rounded-full"
              style={{ background: ratingColor[r.rating] || '#94a3b8', boxShadow: `0 0 6px ${ratingColor[r.rating] || '#94a3b8'}` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Screenshot grid ──────────────────────────────────────────────────────────
function ScreenshotGrid({ screenshots = [] }) {
  const [lightbox, setLightbox] = useState(null);
  if (!screenshots.length) return <p className="text-white/30 text-sm">No screenshots captured.</p>;

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {screenshots.map((s, i) => (
          <button key={i} onClick={() => setLightbox(s)}
            className="group relative rounded-lg overflow-hidden border border-white/10 hover:border-purple-500/40 transition-all aspect-video bg-white/3">
            <img src={`data:image/jpeg;base64,${s.screenshot_b64}`}
              alt={s.title || s.url}
              className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300" />
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              style={{ background: 'rgba(0,0,0,0.5)' }}>
              <Eye size={20} className="text-white" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2"
              style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.7))' }}>
              <p className="text-white text-[10px] truncate">{s.title || s.url}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setLightbox(null)}>
          <div className="relative max-w-4xl max-h-[90vh] overflow-auto rounded-xl border border-white/10">
            <img src={`data:image/jpeg;base64,${lightbox.screenshot_b64}`}
              alt={lightbox.title}
              className="max-w-full" />
            <div className="absolute top-2 right-2">
              <button className="w-8 h-8 rounded-full flex items-center justify-center text-white/70 hover:text-white"
                style={{ background: 'rgba(0,0,0,0.6)' }}
                onClick={() => setLightbox(null)}>
                ×
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── AI Issues list ───────────────────────────────────────────────────────────
function AIIssueCard({ issue }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border border-white/8 overflow-hidden mb-3"
      style={{ background: 'rgba(255,255,255,0.02)' }}>
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/3 transition-colors">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <SevBadge severity={issue.severity} />
            <span className="text-white/50 text-xs uppercase tracking-wide">{issue.type}</span>
          </div>
          <p className="text-white/85 text-sm font-medium">{issue.title}</p>
        </div>
        {expanded ? <ChevronDown size={14} className="text-white/40 mt-0.5 flex-shrink-0" />
          : <ChevronRight size={14} className="text-white/40 mt-0.5 flex-shrink-0" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {issue.url && (
            <div>
              <p className="text-white/30 text-xs mb-1 uppercase tracking-wide">Affected URL</p>
              <p className="text-white/60 text-xs font-mono">{issue.url}</p>
            </div>
          )}
          {issue.root_cause && (
            <div>
              <p className="text-white/30 text-xs mb-1 uppercase tracking-wide">Root Cause</p>
              <p className="text-white/70 text-sm">{issue.root_cause}</p>
            </div>
          )}
          {issue.business_impact && (
            <div>
              <p className="text-white/30 text-xs mb-1 uppercase tracking-wide">Business Impact</p>
              <p className="text-white/70 text-sm">{issue.business_impact}</p>
            </div>
          )}
          {issue.fix_recommendation && (
            <div className="rounded-lg p-3 border border-green-500/20"
              style={{ background: 'rgba(16,185,129,0.06)' }}>
              <p className="text-green-400/70 text-xs mb-1 uppercase tracking-wide font-medium">Fix</p>
              <p className="text-green-300/80 text-sm">{issue.fix_recommendation}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CTA (viral loop) ─────────────────────────────────────────────────────────
function CTABanner() {
  return (
    <div className="rounded-2xl border p-8 text-center my-8"
      style={{
        borderColor: 'rgba(124,58,237,0.35)',
        background: 'linear-gradient(135deg, rgba(124,58,237,0.08), rgba(219,39,119,0.06))',
      }}>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
        style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}>
        <Zap size={26} className="text-white" />
      </div>
      <h2 className="text-3xl font-black text-white mb-2">Want this for your app?</h2>
      <p className="text-white/50 text-base mb-6 max-w-md mx-auto">
        Drop your URL. Get a full report in under 60 seconds.
        No config. No API keys. No BS.
      </p>
      <a href="/"
        className="inline-flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
        style={{
          background: 'linear-gradient(135deg,#7c3aed,#db2777)',
          boxShadow: '0 0 24px rgba(124,58,237,0.4)',
        }}>
        <Zap size={15} />
        Test your own app — it's free
        <ArrowRight size={14} />
      </a>
      <p className="text-white/25 text-xs mt-4">Powered by Flasqo · FullSend</p>
    </div>
  );
}

// ─── Main report view ─────────────────────────────────────────────────────────
export default function FullSendReportApp({ token }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/fullsend/report/${token}`);
        if (resp.status === 202) {
          setError('Report is still being generated. Refresh in a moment.');
          setLoading(false);
          return;
        }
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.detail || 'Report not found');
        }
        const data = await resp.json();
        setReport(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [token]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a1a' }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
            <Zap size={22} className="text-white" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
          </div>
          <p className="text-white/50 text-sm">Loading FullSend report...</p>
        </div>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#0a0a1a' }}>
        <div className="text-center max-w-sm">
          <XCircle size={40} className="text-red-400 mx-auto mb-4" />
          <h2 className="text-white font-bold text-lg mb-2">Report unavailable</h2>
          <p className="text-white/40 text-sm mb-6">{error}</p>
          <a href="/" className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
            <Zap size={13} /> Test your own app
          </a>
        </div>
      </div>
    );
  }

  const {
    target_url, scanned_at, elapsed_seconds, app_health_score,
    executive_summary, ai_issues = [], positive_findings = [], priority_actions = [],
    pages_discovered, routes_tested, api_calls_found,
    smoke = {}, functional = {}, visual = {}, security = {}, performance = {},
    page_screenshots = [],
  } = report;

  const totalIssues = ai_issues.length;
  const criticalCount = ai_issues.filter(i => i.severity === 'critical').length;

  const scannedDate = scanned_at
    ? new Date(scanned_at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  return (
    <div className="min-h-screen text-white" style={{ background: '#0a0a1a' }}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/3 w-80 h-80 rounded-full opacity-8 blur-3xl"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }} />
      </div>

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-white/5"
        style={{ background: 'rgba(10,10,26,0.9)', backdropFilter: 'blur(16px)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#ec4899)' }}>
              <Zap size={13} className="text-white" />
            </div>
            <span className="font-bold text-white text-sm hidden sm:block">FullSend Report</span>
            <span className="text-white/30 text-xs truncate max-w-[160px] sm:max-w-xs hidden sm:block">
              · {target_url}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={copyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 transition-all hover:border-white/20"
              style={{ background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)', color: copied ? '#34d399' : 'rgba(255,255,255,0.6)' }}>
              <Copy size={11} />
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          </div>
        </div>
      </div>

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Hero */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-purple-500/30 mb-4"
            style={{ background: 'rgba(124,58,237,0.1)', color: '#a78bfa' }}>
            <Zap size={11} />
            FullSend · Automated App Test Report
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white mb-2 break-all">{target_url}</h1>
          <div className="flex items-center gap-4 text-white/40 text-xs flex-wrap">
            <span className="flex items-center gap-1.5"><Clock size={11} /> {scannedDate}</span>
            <span className="flex items-center gap-1.5"><Activity size={11} /> {elapsed_seconds}s scan</span>
            <span className="flex items-center gap-1.5"><Globe size={11} /> {pages_discovered} pages</span>
            <span className="flex items-center gap-1.5"><Bug size={11} /> {api_calls_found} API calls found</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-white/8 p-4" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <HealthRing score={app_health_score ?? 0} />
            <p className="text-center text-white/40 text-xs mt-2">Health Score</p>
          </div>
          <div className="rounded-xl border border-white/8 p-4 flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-3xl font-black text-white mb-0.5">{totalIssues}</p>
            <p className="text-white/40 text-xs">Issues Found</p>
            {criticalCount > 0 && (
              <p className="text-red-400 text-xs mt-1 font-semibold">{criticalCount} critical</p>
            )}
          </div>
          <div className="rounded-xl border border-white/8 p-4 flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-3xl font-black text-green-400 mb-0.5">
              {(smoke.passed ?? 0) + (functional.passed ?? 0)}
            </p>
            <p className="text-white/40 text-xs">Tests Passed</p>
            <p className="text-white/25 text-xs mt-1">
              {(smoke.failed ?? 0) + (functional.failed ?? 0)} failed
            </p>
          </div>
          <div className="rounded-xl border border-white/8 p-4 flex flex-col justify-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
            <p className="text-3xl font-black text-cyan-400 mb-0.5">{performance.avg_ms ?? 0}ms</p>
            <p className="text-white/40 text-xs">Avg Response</p>
            <p className="text-white/25 text-xs mt-1">{performance.slow_routes?.length ?? 0} slow routes</p>
          </div>
        </div>

        {/* Executive summary */}
        {executive_summary && (
          <div className="rounded-xl border border-purple-500/20 p-5 mb-6"
            style={{ background: 'rgba(124,58,237,0.06)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles size={15} className="text-purple-400" />
              <span className="text-purple-300/80 text-xs font-semibold uppercase tracking-wide">GPT-4 Executive Summary</span>
            </div>
            <p className="text-white/80 text-sm leading-relaxed">{executive_summary}</p>
          </div>
        )}

        {/* Priority actions */}
        {priority_actions.length > 0 && (
          <div className="rounded-xl border border-orange-500/15 p-5 mb-6"
            style={{ background: 'rgba(249,115,22,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={14} className="text-orange-400" />
              <span className="text-orange-300/80 text-xs font-semibold uppercase tracking-wide">Priority Actions</span>
            </div>
            <ol className="space-y-2">
              {priority_actions.map((action, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                  <span className="font-bold text-orange-400/70 flex-shrink-0">{i + 1}.</span>
                  {action}
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Positive findings */}
        {positive_findings.length > 0 && (
          <div className="rounded-xl border border-green-500/15 p-5 mb-6"
            style={{ background: 'rgba(16,185,129,0.04)' }}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 size={14} className="text-green-400" />
              <span className="text-green-300/80 text-xs font-semibold uppercase tracking-wide">What's working well</span>
            </div>
            <ul className="space-y-1.5">
              {positive_findings.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-white/65">
                  <span className="text-green-400 flex-shrink-0">✓</span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* AI Issues */}
        {ai_issues.length > 0 && (
          <Section icon={Bug} title="Issues Found" color="#ef4444"
            badge={`${ai_issues.length} issue${ai_issues.length !== 1 ? 's' : ''}`}
            defaultOpen>
            {ai_issues.map((issue, i) => <AIIssueCard key={i} issue={issue} />)}
          </Section>
        )}

        {/* Smoke tests */}
        <Section icon={CheckCircle2} title="Smoke Tests"
          color="#10b981"
          badge={`${smoke.passed ?? 0}/${smoke.total ?? 0} passed`}>
          <TestTable results={smoke.results || []} />
        </Section>

        {/* Functional tests */}
        <Section icon={FlaskConical} title="AI Functional Tests"
          color="#6366f1"
          badge={`${functional.passed ?? 0}/${functional.total ?? 0} passed`}>
          {!functional.ai_used && (
            <p className="text-yellow-400/70 text-xs mb-3 flex items-center gap-1">
              <Info size={11} /> AI not available — basic tests only
            </p>
          )}
          <TestTable results={functional.results || []} />
        </Section>

        {/* Security */}
        <Section icon={ShieldCheck} title="Security Checks"
          color="#ef4444"
          badge={`${(security.critical ?? 0) + (security.high ?? 0)} critical/high`}>
          <div className="flex gap-4 mb-4 flex-wrap">
            {[
              { label: 'Critical', count: security.critical ?? 0, color: '#f87171' },
              { label: 'High',     count: security.high ?? 0,     color: '#fb923c' },
              { label: 'Medium',   count: security.medium ?? 0,   color: '#facc15' },
              { label: 'Low',      count: security.low ?? 0,      color: '#60a5fa' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="text-xl font-black" style={{ color: s.color }}>{s.count}</p>
                <p className="text-white/40 text-xs">{s.label}</p>
              </div>
            ))}
          </div>
          <SecurityList issues={security.issues || []} />
        </Section>

        {/* Performance */}
        <Section icon={Activity} title="Performance Baseline"
          color="#06b6d4"
          badge={performance.avg_ms ? `${performance.avg_ms}ms avg` : undefined}>
          {performance.slowest && (
            <p className="text-white/40 text-xs mb-3">
              Slowest: <span className="text-orange-400 font-mono">{performance.slowest.url?.replace(/^https?:\/\//, '').substring(0, 50)}</span>
              {' '}({performance.slowest.avg_ms}ms)
            </p>
          )}
          <PerfTable results={performance.results || []} />
        </Section>

        {/* Visual baseline */}
        <Section icon={Camera} title="Visual Baseline (Screenshots)"
          color="#f59e0b"
          badge={`${page_screenshots.length} captured`}>
          <p className="text-white/40 text-xs mb-3">Baseline snapshots saved. Use these for future visual regression comparisons.</p>
          <ScreenshotGrid screenshots={page_screenshots} />
        </Section>

        {/* CTA */}
        <CTABanner />

        {/* Footer */}
        <div className="text-center pb-8 text-white/20 text-xs">
          Generated by <span className="text-purple-400/60 font-medium">Flasqo FullSend</span>
          {' '}· {scannedDate}
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1}50%{opacity:0.4} }
      `}</style>
    </div>
  );
}
