import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Globe,
  Image,
  Code2,
  Smartphone,
  ArrowLeft,
  Play,
  Download,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  User,
  LogOut,
  ChevronUp,
  ChevronDown,
  Zap,
  Eye
} from 'lucide-react';

import { saveTestRun } from './testHistoryUtils.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Strip large base64 screenshots before storing in history to avoid DB bloat
function stripScreenshots(data) {
  if (!data) return data;
  const { baseline_screenshot_b64, current_screenshot_b64, diff_screenshot_b64, screenshot_b64, ...rest } = data;
  return rest;
}

const VIEWPORT_PRESETS = {
  desktop: { width: 1280, height: 800  },
  tablet:  { width: 768,  height: 1024 },
  mobile:  { width: 375,  height: 812  }
};

// ─── Priority badge ────────────────────────────────────────────────────────────
function PriorityBadge({ priority }) {
  const map = {
    high: 'bg-red-500/20 text-red-400 border-red-500/30',
    medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    low: 'bg-green-500/20 text-green-400 border-green-500/30'
  };
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${map[priority] || map.medium}`}>
      {priority?.toUpperCase()}
    </span>
  );
}

// ─── Scenario card ─────────────────────────────────────────────────────────────
function ScenarioCard({ scenario, index }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/5 transition-colors"
      >
        <span className="text-xs font-mono text-gray-500 flex-shrink-0">#{index + 1}</span>
        <span className="text-sm font-medium text-white flex-1 truncate">{scenario.title}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-gray-400 flex-shrink-0">
          {scenario.category}
        </span>
        <PriorityBadge priority={scenario.priority} />
        {open ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-white/5">
          <div className="mt-3">
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Steps</p>
            <ol className="space-y-1">
              {scenario.steps.map((step, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-300">
                  <span className="text-fuchsia-400 font-mono text-xs flex-shrink-0 mt-0.5">{i + 1}.</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">Expected Outcome</p>
            <p className="text-sm text-green-300">{scenario.expected_outcome}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Visual regression helpers ─────────────────────────────────────────────────
function VisualStatusBadge({ status }) {
  const map = {
    pass:    'bg-green-500/20 text-green-300 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    fail:    'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${map[status] || map.warning}`}>
      {status?.toUpperCase()}
    </span>
  );
}

function ScreenshotThumb({ label, b64 }) {
  const [expanded, setExpanded] = useState(false);
  if (!b64) return null;
  return (
    <div className="space-y-1">
      <p className="text-[10px] text-gray-500 text-center font-medium uppercase tracking-wider">{label}</p>
      <img
        src={`data:image/png;base64,${b64}`}
        alt={label}
        onClick={() => setExpanded(true)}
        className="w-full rounded-lg border border-white/10 cursor-zoom-in object-cover max-h-32"
      />
      {expanded && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}>
          <img src={`data:image/png;base64,${b64}`} alt={label}
            className="max-w-full max-h-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

function VisualChangeCard({ change }) {
  const sev = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    major:    'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    minor:    'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  return (
    <div className="bg-slate-800/60 border border-white/10 rounded-xl p-3 space-y-1">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-white">{change.element}</span>
        <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/10 text-gray-400">{change.change_type}</span>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${sev[change.severity] || sev.minor}`}>
          {change.severity}
        </span>
      </div>
      <p className="text-xs text-gray-300">{change.description}</p>
      <p className="text-[10px] text-gray-500">{change.location}</p>
    </div>
  );
}

// ─── Results panel ─────────────────────────────────────────────────────────────
function ResultsPanel({ mode, results, onSendToSmoke, navigate }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(results, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibe-testing-${mode}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scenarios = results?.test_scenarios || [];

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* APK manifest strip */}
      {mode === 'apk' && results && (
        <div className="bg-slate-800/60 border border-fuchsia-500/20 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Smartphone size={16} className="text-fuchsia-400" />
            <span className="text-sm font-semibold text-white">{results.package_name || 'Unknown package'}</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              {results.parse_method}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-400">{results.activities?.length || 0} activities</span>
            <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-400">{results.services?.length || 0} services</span>
            {results.min_sdk && <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-400">minSDK {results.min_sdk}</span>}
            {results.target_sdk && <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-400">targetSDK {results.target_sdk}</span>}
          </div>
          {results.permissions?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {results.permissions.slice(0, 8).map((p, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-fuchsia-500/10 text-fuchsia-300 border border-fuchsia-500/20">
                  {p.replace('android.permission.', '')}
                </span>
              ))}
              {results.permissions.length > 8 && (
                <span className="text-[10px] text-gray-500">+{results.permissions.length - 8} more</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Crawl summary strip */}
      {mode === 'crawl' && results && (
        <div className="bg-slate-800/60 border border-cyan-500/20 rounded-xl p-3 flex flex-wrap items-center gap-3 text-sm">
          <Globe size={16} className="text-cyan-400 flex-shrink-0" />
          <span className="text-gray-300">{results.pages_crawled} pages crawled</span>
          {results.crawler_used === 'playwright' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
              playwright
            </span>
          )}
          {results.crawler_used === 'httpx' && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              httpx
            </span>
          )}
          {results.spa_detected && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30">
              SPA detected
            </span>
          )}
          {results.fallback_used && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
              rule-based (no AI key)
            </span>
          )}
        </div>
      )}

      {/* Visual — baseline saved */}
      {mode === 'visual' && results?.session_id && !results.overall_status && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-fuchsia-500/20 rounded-xl p-3 flex flex-wrap items-center gap-3 text-sm">
            <Eye size={16} className="text-fuchsia-400 flex-shrink-0" />
            <span className="text-gray-300 font-medium">Baseline saved</span>
            <span className="text-gray-400 truncate">{results.label || results.url}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
              results.source === 'playwright'
                ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
            }`}>{results.source}</span>
          </div>
          <img src={`data:image/png;base64,${results.screenshot_b64}`} alt="baseline"
            className="w-full rounded-xl border border-white/10 max-h-64 object-contain bg-slate-900" />
          <p className="text-[10px] text-gray-600 font-mono">ID: {results.session_id}</p>
        </div>
      )}

      {/* Visual — comparison results */}
      {mode === 'visual' && results?.overall_status && (
        <div className="space-y-4">
          <div className="bg-slate-800/60 border border-white/10 rounded-xl p-3 flex flex-wrap items-center gap-3 text-sm">
            <Eye size={16} className="text-fuchsia-400 flex-shrink-0" />
            <VisualStatusBadge status={results.overall_status} />
            <span className="text-gray-300 flex-1 min-w-0 text-xs">{results.summary}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-gray-400">
              {results.pixel_diff_score}% pixels changed
            </span>
            {results.fallback_used && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                AI unavailable
              </span>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ScreenshotThumb label="Baseline" b64={results.baseline_screenshot_b64} />
            <ScreenshotThumb label="Current"  b64={results.current_screenshot_b64} />
            <ScreenshotThumb label="Diff"     b64={results.diff_screenshot_b64} />
          </div>
          {results.changes?.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
                {results.changes.length} Change{results.changes.length !== 1 ? 's' : ''} Detected
              </p>
              <div className="space-y-2 overflow-y-auto">
                {results.changes.map((c, i) => <VisualChangeCard key={i} change={c} />)}
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-400 text-center py-4">No visual changes detected</p>
          )}
        </div>
      )}

      {/* Code summary strip */}
      {mode === 'code' && results && (
        <div className="bg-slate-800/60 border border-indigo-500/20 rounded-xl p-3 flex items-center gap-4 text-sm flex-wrap">
          <Code2 size={16} className="text-indigo-400 flex-shrink-0" />
          <span className="text-gray-300">{results.files_analyzed} files analyzed</span>
          {results.routes_confirmed?.length > 0 && (
            <span className="text-gray-400">{results.routes_confirmed.length} routes</span>
          )}
          {results.components_confirmed?.length > 0 && (
            <span className="text-gray-400">{results.components_confirmed.length} components</span>
          )}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm font-semibold text-white">
          {scenarios.length} Test Scenario{scenarios.length !== 1 ? 's' : ''}
        </p>
        <div className="flex items-center gap-2">
          {mode === 'crawl' && (
            <button
              onClick={onSendToSmoke}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 border border-green-500/30 hover:bg-green-500/30 transition-colors"
            >
              <Zap size={12} />
              Send to Smoke
            </button>
          )}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 transition-colors"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy All'}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30 hover:bg-fuchsia-500/30 transition-colors"
          >
            <Download size={12} />
            Download JSON
          </button>
        </div>
      </div>

      {/* Scenario cards */}
      <div className="space-y-2 overflow-y-auto flex-1">
        {scenarios.map((s, i) => (
          <ScenarioCard key={i} scenario={s} index={i} />
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────────
function VibeTestingApp({ user, onLogout }) {
  const navigate = useNavigate();

  // Mode
  const [activeMode, setActiveMode] = useState('crawl');

  // Shared status
  const [status, setStatus] = useState('idle'); // idle | loading | done | error
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);

  // Crawl inputs
  const [webUrl, setWebUrl] = useState('');
  const [maxPages, setMaxPages] = useState(10);
  const [jsRendering, setJsRendering] = useState(false);

  // Screenshot inputs
  const [screenshotFile, setScreenshotFile] = useState(null);
  const [screenshotPreview, setScreenshotPreview] = useState(null);

  // Code ZIP input
  const [codeZipFile, setCodeZipFile] = useState(null);

  // APK input
  const [apkFile, setApkFile] = useState(null);

  // Visual regression inputs
  const [visualSubMode, setVisualSubMode]           = useState('baseline');
  const [visualUrl, setVisualUrl]                   = useState('');
  const [visualLabel, setVisualLabel]               = useState('');
  const [visualViewport, setVisualViewport]         = useState('desktop');
  const [visualFullPage, setVisualFullPage]         = useState(true);
  const [visualFile, setVisualFile]                 = useState(null);
  const [visualBaselines, setVisualBaselines]       = useState([]);
  const [selectedBaselineId, setSelectedBaselineId] = useState('');
  const visualFileRef = useRef(null);

  const screenshotRef = useRef(null);
  const codeRef = useRef(null);
  const apkRef = useRef(null);

  const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });

  const resetResults = () => {
    setStatus('idle');
    setError(null);
    setResults(null);
  };

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    resetResults();
    if (mode === 'visual') loadVisualBaselines();
  };

  // ── Crawl ──
  const runCrawl = async () => {
    if (!webUrl.trim()) return;
    setStatus('loading');
    setError(null);
    setResults(null);
    try {
      const res = await fetch(`${API_BASE_URL}/vibe/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ url: webUrl.trim(), max_pages: maxPages, js_rendering: jsRendering })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Crawl failed');
      }
      const data = await res.json();
      setResults(data);
      setStatus('done');
      const scenarios = data.test_scenarios || [];
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: webUrl.trim(),
        totalTests: scenarios.length,
        passed: scenarios.length,
        failed: 0,
        overallStatus: 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  // ── Screenshot ──
  const handleScreenshotSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setScreenshotFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setScreenshotPreview(ev.target.result);
    reader.readAsDataURL(file);
    resetResults();
  };

  const runScreenshot = async () => {
    if (!screenshotFile) return;
    setStatus('loading');
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('file', screenshotFile);
      const res = await fetch(`${API_BASE_URL}/vibe/screenshot`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Screenshot analysis failed');
      }
      const data = await res.json();
      setResults(data);
      setStatus('done');
      const scenarios = data.test_scenarios || [];
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: screenshotFile?.name || 'screenshot',
        totalTests: scenarios.length,
        passed: scenarios.length,
        failed: 0,
        overallStatus: 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  // ── Code ZIP ──
  const handleCodeSelect = (e) => {
    setCodeZipFile(e.target.files[0] || null);
    resetResults();
  };

  const runCodeUpload = async () => {
    if (!codeZipFile) return;
    setStatus('loading');
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('file', codeZipFile);
      const res = await fetch(`${API_BASE_URL}/vibe/code-upload`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'Code upload failed');
      }
      const data = await res.json();
      setResults(data);
      setStatus('done');
      const scenarios = data.test_scenarios || [];
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: codeZipFile?.name || 'code-zip',
        totalTests: scenarios.length,
        passed: scenarios.length,
        failed: 0,
        overallStatus: 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  // ── APK ──
  const handleApkSelect = (e) => {
    setApkFile(e.target.files[0] || null);
    resetResults();
  };

  const runApk = async () => {
    if (!apkFile) return;
    setStatus('loading');
    setError(null);
    setResults(null);
    try {
      const fd = new FormData();
      fd.append('file', apkFile);
      const res = await fetch(`${API_BASE_URL}/vibe/apk`, {
        method: 'POST',
        headers: authHeader(),
        body: fd
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || 'APK analysis failed');
      }
      const data = await res.json();
      setResults(data);
      setStatus('done');
      const scenarios = data.test_scenarios || [];
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: apkFile?.name || 'apk',
        totalTests: scenarios.length,
        passed: scenarios.length,
        failed: 0,
        overallStatus: 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  };

  // ── Visual Regression ──
  const loadVisualBaselines = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/vibe/visual/baselines`, { headers: authHeader() });
      if (res.ok) { const d = await res.json(); setVisualBaselines(d.sessions || []); }
    } catch (_) {}
  };

  const runVisualCapture = async () => {
    if (!visualUrl.trim()) return;
    setStatus('loading'); setError(null); setResults(null);
    const vp = VIEWPORT_PRESETS[visualViewport];
    try {
      const res = await fetch(`${API_BASE_URL}/vibe/visual/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ url: visualUrl.trim(), label: visualLabel.trim(),
          viewport_width: vp.width, viewport_height: vp.height, full_page: visualFullPage })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Capture failed'); }
      const data = await res.json();
      setResults(data); setStatus('done');
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: visualUrl.trim(),
        totalTests: 1,
        passed: 1,
        failed: 0,
        overallStatus: 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) { setError(e.message); setStatus('error'); }
  };

  const runVisualUploadBaseline = async (file) => {
    if (!file) return;
    setStatus('loading'); setError(null); setResults(null);
    const vp = VIEWPORT_PRESETS[visualViewport];
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('url', visualUrl.trim() || 'unknown');
      fd.append('label', visualLabel.trim());
      fd.append('viewport_width', String(vp.width));
      fd.append('viewport_height', String(vp.height));
      const res = await fetch(`${API_BASE_URL}/vibe/visual/upload-baseline`, {
        method: 'POST', headers: authHeader(), body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Upload failed'); }
      const data = await res.json();
      setResults(data); setStatus('done');
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: visualUrl.trim() || 'unknown',
        totalTests: 1,
        passed: 1,
        failed: 0,
        overallStatus: 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) { setError(e.message); setStatus('error'); }
  };

  const runVisualCompare = async () => {
    if (!selectedBaselineId) return;
    setStatus('loading'); setError(null); setResults(null);
    const vp = VIEWPORT_PRESETS[visualViewport];
    try {
      const res = await fetch(`${API_BASE_URL}/vibe/visual/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ session_id: selectedBaselineId,
          viewport_width: vp.width, viewport_height: vp.height, full_page: visualFullPage })
      });
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Compare failed'); }
      const data = await res.json();
      setResults(data); setStatus('done');
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: visualUrl.trim() || selectedBaselineId,
        totalTests: 1,
        passed: data.overall_status === 'fail' ? 0 : 1,
        failed: data.overall_status === 'fail' ? 1 : 0,
        overallStatus: data.overall_status === 'fail' ? 'FAIL' : 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) { setError(e.message); setStatus('error'); }
  };

  const runVisualCompareUpload = async (file) => {
    if (!file || !selectedBaselineId) return;
    setStatus('loading'); setError(null); setResults(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('session_id', selectedBaselineId);
      const res = await fetch(`${API_BASE_URL}/vibe/visual/compare-upload`, {
        method: 'POST', headers: authHeader(), body: fd });
      if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || 'Compare failed'); }
      const data = await res.json();
      setResults(data); setStatus('done');
      saveTestRun({
        module: 'vibe-testing',
        apiUrl: selectedBaselineId,
        totalTests: 1,
        passed: data.overall_status === 'fail' ? 0 : 1,
        failed: data.overall_status === 'fail' ? 1 : 0,
        overallStatus: data.overall_status === 'fail' ? 'FAIL' : 'PASS',
        resultJson: stripScreenshots(data)
      });
    } catch (e) { setError(e.message); setStatus('error'); }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (activeMode === 'visual' && visualSubMode === 'compare') loadVisualBaselines();
  }, [activeMode, visualSubMode]);

  // ── Send to Smoke ──
  const handleSendToSmoke = () => {
    if (!results) return;
    const smokeData = {
      source: 'vibe-crawl',
      endpoints: Object.keys(results.state_graph?.nodes || {}).map(url => ({
        method: 'GET',
        url,
        description: results.state_graph?.nodes[url]?.title || url
      }))
    };
    localStorage.setItem('discoveryData', JSON.stringify(smokeData));
    navigate('/smoke');
  };

  const canRun = () => {
    if (status === 'loading') return false;
    if (activeMode === 'crawl') return webUrl.trim().length > 0;
    if (activeMode === 'screenshot') return !!screenshotFile;
    if (activeMode === 'code') return !!codeZipFile;
    if (activeMode === 'apk') return !!apkFile;
    if (activeMode === 'visual') {
      if (visualSubMode === 'baseline') return visualUrl.trim().length > 0;
      return selectedBaselineId.length > 0;
    }
    return false;
  };

  const handleRun = () => {
    if (activeMode === 'crawl') runCrawl();
    else if (activeMode === 'screenshot') runScreenshot();
    else if (activeMode === 'code') runCodeUpload();
    else if (activeMode === 'apk') runApk();
    else if (activeMode === 'visual') {
      if (visualSubMode === 'baseline') runVisualCapture();
      else runVisualCompare();
    }
  };

  const MODES = [
    { id: 'crawl', label: 'Web Crawl', icon: Globe },
    { id: 'screenshot', label: 'Screenshot', icon: Image },
    { id: 'code', label: 'Code ZIP', icon: Code2 },
    { id: 'apk', label: 'APK', icon: Smartphone },
    { id: 'visual', label: 'Visual', icon: Eye }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-fuchsia-950 to-slate-900 flex flex-col">

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/10 bg-slate-900/70">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-fuchsia-600 via-violet-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Vibe Testing</h1>
              <p className="text-[10px] text-fuchsia-400/80 font-medium tracking-wider">AI-Powered Exploratory Testing</p>
            </div>
          </div>

          {/* User / Logout */}
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-fuchsia-500 to-violet-600 flex items-center justify-center">
                  <span className="text-sm font-bold text-white">{user.username?.charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-sm text-gray-300">{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 text-red-400 hover:bg-red-500/20 transition-colors text-sm"
              >
                <LogOut size={14} />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── Back + Mode Tabs ── */}
      <div className="max-w-7xl mx-auto px-6 pt-6 w-full">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        {/* Mode tabs */}
        <div className="flex gap-2 flex-wrap">
          {MODES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleModeChange(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeMode === id
                  ? 'bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 text-white shadow-lg shadow-fuchsia-500/20'
                  : 'bg-slate-800/50 text-gray-400 hover:text-white hover:bg-slate-700/50 border border-white/10'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Two-Column Layout ── */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col lg:flex-row gap-6">

        {/* Input Panel */}
        <div className="w-full lg:w-96 flex-shrink-0">
          <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 space-y-5">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider">
              {activeMode === 'crawl' && 'Web App URL'}
              {activeMode === 'screenshot' && 'Upload Screenshot'}
              {activeMode === 'code' && 'Upload Source ZIP'}
              {activeMode === 'apk' && 'Upload APK'}
              {activeMode === 'visual' && 'Visual Regression'}
            </h2>

            {/* ── Crawl inputs ── */}
            {activeMode === 'crawl' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Target URL</label>
                  <input
                    type="url"
                    value={webUrl}
                    onChange={e => setWebUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500/50"
                    onKeyDown={e => e.key === 'Enter' && canRun() && handleRun()}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Max Pages: {maxPages}</label>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={maxPages}
                    onChange={e => setMaxPages(Number(e.target.value))}
                    className="w-full accent-fuchsia-500"
                  />
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>1</span><span>20</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300 font-medium">JS Rendering</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Force Playwright for SPAs</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={jsRendering}
                      onChange={e => setJsRendering(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-fuchsia-600 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/60 rounded-full transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
                  </label>
                </div>
              </div>
            )}

            {/* ── Screenshot inputs ── */}
            {activeMode === 'screenshot' && (
              <div className="space-y-4">
                <div
                  onClick={() => screenshotRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center cursor-pointer hover:border-fuchsia-500/40 hover:bg-fuchsia-500/5 transition-all"
                >
                  {screenshotPreview ? (
                    <img src={screenshotPreview} alt="preview" className="max-h-40 mx-auto rounded-lg object-contain" />
                  ) : (
                    <>
                      <Image size={32} className="mx-auto text-gray-500 mb-2" />
                      <p className="text-sm text-gray-400">Click to upload PNG/JPG/WebP</p>
                      <p className="text-[11px] text-gray-600 mt-1">Max 10 MB</p>
                    </>
                  )}
                </div>
                <input
                  ref={screenshotRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotSelect}
                  className="hidden"
                />
                {screenshotFile && (
                  <p className="text-xs text-gray-400 truncate">{screenshotFile.name}</p>
                )}
              </div>
            )}

            {/* ── Code ZIP inputs ── */}
            {activeMode === 'code' && (
              <div className="space-y-4">
                <div
                  onClick={() => codeRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-500/40 hover:bg-indigo-500/5 transition-all"
                >
                  <Code2 size={32} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">
                    {codeZipFile ? codeZipFile.name : 'Click to upload ZIP archive'}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">Max 50 MB</p>
                </div>
                <input
                  ref={codeRef}
                  type="file"
                  accept=".zip"
                  onChange={handleCodeSelect}
                  className="hidden"
                />
                <div className="text-[11px] text-gray-500 space-y-0.5">
                  <p>Skips: node_modules, .git, dist, __pycache__</p>
                  <p>Prioritizes: routes, controllers, API files</p>
                </div>
              </div>
            )}

            {/* ── APK inputs ── */}
            {activeMode === 'apk' && (
              <div className="space-y-4">
                <div
                  onClick={() => apkRef.current?.click()}
                  className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition-all"
                >
                  <Smartphone size={32} className="mx-auto text-gray-500 mb-2" />
                  <p className="text-sm text-gray-400">
                    {apkFile ? apkFile.name : 'Click to upload .apk file'}
                  </p>
                  <p className="text-[11px] text-gray-600 mt-1">Max 100 MB</p>
                </div>
                <input
                  ref={apkRef}
                  type="file"
                  accept=".apk"
                  onChange={handleApkSelect}
                  className="hidden"
                />
                <div className="text-[11px] text-gray-500 space-y-0.5">
                  <p>Parses AndroidManifest.xml (binary AXML)</p>
                  <p>Extracts activities, permissions, services</p>
                </div>
              </div>
            )}

            {/* ── Visual inputs ── */}
            {activeMode === 'visual' && (
              <div className="space-y-4">
                {/* Sub-mode toggle */}
                <div className="flex rounded-xl overflow-hidden border border-white/10">
                  {[['baseline','Set Baseline'],['compare','Compare']].map(([sub, lbl]) => (
                    <button key={sub}
                      onClick={() => { setVisualSubMode(sub); resetResults(); }}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${
                        visualSubMode === sub ? 'bg-fuchsia-600 text-white' : 'bg-slate-800/60 text-gray-400 hover:text-white'
                      }`}>{lbl}</button>
                  ))}
                </div>

                {/* URL */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Target URL</label>
                  <input type="url" value={visualUrl} onChange={e => setVisualUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500/50" />
                </div>

                {/* Label (baseline only) */}
                {visualSubMode === 'baseline' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Label (optional)</label>
                    <input type="text" value={visualLabel} onChange={e => setVisualLabel(e.target.value)}
                      placeholder="e.g. v1.2.3 production"
                      className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-fuchsia-500/50" />
                  </div>
                )}

                {/* Viewport preset */}
                <div>
                  <label className="text-xs text-gray-400 mb-1.5 block">Viewport</label>
                  <div className="flex gap-2">
                    {['desktop','tablet','mobile'].map(vp => (
                      <button key={vp} onClick={() => setVisualViewport(vp)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${
                          visualViewport === vp ? 'bg-fuchsia-600/80 text-white' : 'bg-slate-800/60 text-gray-400 border border-white/10 hover:text-white'
                        }`}>{vp}</button>
                    ))}
                  </div>
                </div>

                {/* Full page toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-gray-300 font-medium">Full Page</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">Capture entire scrollable page</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer"
                      checked={visualFullPage} onChange={e => setVisualFullPage(e.target.checked)} />
                    <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-fuchsia-600 transition-colors" />
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white/60 rounded-full transition-transform peer-checked:translate-x-4 peer-checked:bg-white" />
                  </label>
                </div>

                {/* Baseline selector (compare sub-mode) */}
                {visualSubMode === 'compare' && (
                  <div>
                    <label className="text-xs text-gray-400 mb-1.5 block">Select Baseline</label>
                    {visualBaselines.length === 0
                      ? <p className="text-xs text-gray-500 italic">No baselines yet — capture one first.</p>
                      : <select value={selectedBaselineId} onChange={e => setSelectedBaselineId(e.target.value)}
                          className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-fuchsia-500/50">
                          <option value="">— select a baseline —</option>
                          {visualBaselines.map(b => (
                            <option key={b.session_id} value={b.session_id}>
                              {b.label || b.url} · {new Date(b.captured_at).toLocaleDateString()}
                            </option>
                          ))}
                        </select>
                    }
                  </div>
                )}

                {/* Auto-capture button */}
                <button
                  onClick={visualSubMode === 'baseline' ? runVisualCapture : runVisualCompare}
                  disabled={status === 'loading' || (visualSubMode === 'baseline' ? !visualUrl.trim() : !selectedBaselineId)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:from-fuchsia-500 hover:via-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-fuchsia-500/20"
                >
                  <Eye size={15} />
                  {visualSubMode === 'baseline' ? 'Auto-Capture (Playwright)' : 'Auto-Compare (Playwright)'}
                </button>

                {/* Upload button */}
                <button
                  onClick={() => visualFileRef.current?.click()}
                  disabled={status === 'loading' || (visualSubMode === 'compare' && !selectedBaselineId)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-slate-800/60 border border-white/10 text-gray-300 hover:bg-white/10 hover:text-white"
                >
                  <Image size={15} />
                  {visualSubMode === 'baseline' ? 'Upload Baseline Screenshot' : 'Upload & Compare'}
                </button>
                <input ref={visualFileRef} type="file" accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const f = e.target.files[0]; if (!f) return;
                    setVisualFile(f);
                    if (visualSubMode === 'baseline') runVisualUploadBaseline(f);
                    else runVisualCompareUpload(f);
                  }} />
              </div>
            )}

            {/* ── Run button ── */}
            <button
              onClick={handleRun}
              disabled={!canRun()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-fuchsia-600 via-violet-600 to-indigo-600 hover:from-fuchsia-500 hover:via-violet-500 hover:to-indigo-500 text-white shadow-lg shadow-fuchsia-500/20 hover:shadow-fuchsia-500/30 hover:scale-[1.01]"
            >
              {status === 'loading' ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Run Vibe Test
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Panel */}
        <div className="flex-1 min-h-[400px]">
          {status === 'idle' && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 bg-slate-900/30 border border-white/5 rounded-2xl p-12">
              <div className="w-16 h-16 rounded-2xl bg-fuchsia-500/10 flex items-center justify-center">
                <Sparkles size={28} className="text-fuchsia-400" />
              </div>
              <div>
                <p className="text-gray-300 font-medium mb-1">Ready to Vibe Test</p>
                <p className="text-gray-600 text-sm">
                  {activeMode === 'crawl' && 'Enter a URL and hit Run to crawl the web app and generate test scenarios.'}
                  {activeMode === 'screenshot' && 'Upload a screenshot and the AI will identify UI elements and generate tests.'}
                  {activeMode === 'code' && 'Upload a ZIP of your source code to get code-aware test scenarios.'}
                  {activeMode === 'apk' && 'Upload an APK to parse the manifest and generate mobile test scenarios.'}
                  {activeMode === 'visual' && 'Capture a baseline, then compare after deployment to detect UI breaks.'}
                </p>
              </div>
            </div>
          )}

          {status === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center gap-4 bg-slate-900/30 border border-white/5 rounded-2xl">
              <Loader2 size={32} className="animate-spin text-fuchsia-400" />
              <p className="text-gray-400 text-sm">
                {activeMode === 'crawl' && (jsRendering ? 'Crawling with Playwright (headless)...' : 'Crawling web app...')}
                {activeMode === 'screenshot' && 'Analyzing screenshot with GPT-4o...'}
                {activeMode === 'code' && 'Analyzing codebase...'}
                {activeMode === 'apk' && 'Parsing APK manifest...'}
                {activeMode === 'visual' && (visualSubMode === 'baseline'
                  ? 'Capturing baseline screenshot...'
                  : 'Comparing screenshots with AI...')}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 flex items-start gap-3">
              <XCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-300 font-medium mb-1">Analysis failed</p>
                <p className="text-red-400/70 text-sm">{error}</p>
                <button onClick={resetResults} className="mt-3 text-xs text-gray-400 hover:text-white underline">
                  Try again
                </button>
              </div>
            </div>
          )}

          {status === 'done' && results && (
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-6 h-full flex flex-col">
              <ResultsPanel
                mode={activeMode}
                results={results}
                onSendToSmoke={handleSendToSmoke}
                navigate={navigate}
              />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center py-4 text-[11px] text-gray-600">
        Vibe Testing • Evo-TFX by EvoluneEdgeTech
      </div>
    </div>
  );
}

export default VibeTestingApp;
