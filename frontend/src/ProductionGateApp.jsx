/**
 * PROD-GATE MODULE — ProductionGateApp.jsx
 * To remove from the platform:
 *   1. Delete this file
 *   2. Remove the /prod-gate route from AppWrapper.jsx
 *   3. Remove the prod-gate card from TestingTypesLanding.jsx
 *   4. Delete PROD-GATE blocks from backend/backend.py
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Shield, Activity, CheckCircle, Globe, Database, Gauge,
  AlertTriangle, ArrowRight, ArrowLeft, LogOut, Plus, X,
  Save, Play, Square, RefreshCw, Download, TrendingUp,
  Clock, History, Zap, ChevronRight, Loader, User,
  FileText, Eye, Trash2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─── Suite Definitions ──────────────────────────────────────────────────────
const SUITES = [
  {
    id: 'health', name: 'Health & Availability',
    desc: 'Ping endpoints, verify uptime, response codes and latency',
    icon: Globe, color: '#22c55e', glow: 'rgba(34,197,94,0.15)',
    weight: 0.25, alwaysOn: true,
  },
  {
    id: 'security', name: 'Security Probe',
    desc: 'SQL injection, XSS, path traversal, oversized payloads',
    icon: Shield, color: '#ef4444', glow: 'rgba(239,68,68,0.15)',
    weight: 0.30,
  },
  {
    id: 'load', name: 'Load Simulation',
    desc: 'Concurrent requests, latency percentiles, throughput',
    icon: TrendingUp, color: '#a855f7', glow: 'rgba(168,85,247,0.15)',
    weight: 0.20,
  },
  {
    id: 'functional', name: 'Functional Check',
    desc: 'Endpoint validation, JSON schema, status codes',
    icon: CheckCircle, color: '#3b82f6', glow: 'rgba(59,130,246,0.15)',
    weight: 0.15,
  },
  {
    id: 'rate_limit', name: 'Rate Limit Validation',
    desc: 'Burst detection, 429 responses, X-RateLimit headers',
    icon: Gauge, color: '#f59e0b', glow: 'rgba(245,158,11,0.15)',
    weight: 0.07,
  },
  {
    id: 'data_integrity', name: 'Data Integrity',
    desc: 'Response consistency, Content-Type, schema stability',
    icon: Database, color: '#06b6d4', glow: 'rgba(6,182,212,0.15)',
    weight: 0.03,
  },
];

// ─── Scoring helpers ─────────────────────────────────────────────────────────
function calcScore(results, selected) {
  const w = { health: 0.25, security: 0.30, load: 0.20, functional: 0.15, rate_limit: 0.07, data_integrity: 0.03 };
  let ws = 0, wt = 0;
  for (const id of selected) {
    if (results[id] != null) { ws += (results[id].score || 0) * (w[id] || 0); wt += (w[id] || 0); }
  }
  return wt > 0 ? Math.round(ws / wt) : 0;
}

function gateDecision(score, results) {
  const hasCritical = Object.values(results).some(r => r?.findings?.some(f => f.severity === 'CRITICAL'));
  if (hasCritical || score < 50) return { label: 'DO NOT DEPLOY', color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.30)' };
  if (score < 75)                 return { label: 'NEEDS ATTENTION', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.30)' };
  return                                  { label: 'DEPLOY READY',   color: '#22c55e', bg: 'rgba(34,197,94,0.08)',  border: 'rgba(34,197,94,0.30)' };
}

function statusColor(s) {
  if (s === 'PASS') return '#22c55e';
  if (s === 'WARN') return '#f59e0b';
  return '#ef4444';
}

function scoreColor(n) {
  if (n >= 80) return '#22c55e';
  if (n >= 55) return '#f59e0b';
  return '#ef4444';
}

// ─── Small reusable UI parts ─────────────────────────────────────────────────
const Card = ({ children, className = '', style = {} }) => (
  <div className={`rounded-xl overflow-hidden ${className}`}
    style={{ background: 'rgba(9,12,22,0.80)', border: '1px solid rgba(255,255,255,0.07)', ...style }}>
    {children}
  </div>
);

const Input = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
    <input
      {...props}
      className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-600 outline-none focus:ring-1 font-mono"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', focusRingColor: '#3b82f6' }}
    />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>}
    <select
      {...props}
      className="w-full px-3 py-2 rounded-lg text-sm text-slate-200 outline-none"
      style={{ background: 'rgba(20,24,40,0.95)', border: '1px solid rgba(255,255,255,0.09)' }}
    >
      {children}
    </select>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductionGateApp({ user, onLogout }) {
  const [activeTab, setActiveTab]       = useState('run');   // 'run' | 'history'
  const [phase, setPhase]               = useState('config'); // 'config' | 'running' | 'report'

  // Profile config state
  const [profile, setProfile] = useState({
    name: '', baseUrl: '', authType: 'none',
    authToken: '', apiKey: '', apiKeyHeader: 'X-API-Key',
    basicUser: '', basicPass: '',
    customHeaders: '{}', concurrentUsers: 20, timeout: 5000,
    endpoints: [],
  });
  const [newEndpointPath,   setNewEndpointPath]   = useState('/');
  const [newEndpointMethod, setNewEndpointMethod] = useState('GET');
  const [selectedSuites,    setSelectedSuites]    = useState(['health', 'security', 'load', 'functional']);
  const [savedProfiles,     setSavedProfiles]     = useState([]);
  const [profilesOpen,      setProfilesOpen]      = useState(false);

  // Run state
  const [suiteResults,   setSuiteResults]   = useState({});
  const [currentSuite,   setCurrentSuite]   = useState(null);
  const [completedSuites,setCompletedSuites]= useState([]);
  const [logs,           setLogs]           = useState([]);
  const [report,         setReport]         = useState(null);
  const stopRef = useRef(false);
  const logsEndRef = useRef(null);

  // History state
  const [history, setHistory] = useState([]);
  const [histLoading, setHistLoading] = useState(false);

  const token = localStorage.getItem('token');

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchProfiles();
  }, []);

  useEffect(() => {
    if (activeTab === 'history') fetchHistory();
  }, [activeTab]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // ── API helpers ────────────────────────────────────────────────────────────
  const authHeaders = useCallback(() => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }), [token]);

  async function fetchProfiles() {
    try {
      const r = await fetch(`${API_BASE_URL}/prod-gate/profiles`, { headers: authHeaders() });
      if (r.ok) setSavedProfiles(await r.json());
    } catch (_) {}
  }

  async function fetchHistory() {
    setHistLoading(true);
    try {
      const r = await fetch(`${API_BASE_URL}/prod-gate/sessions`, { headers: authHeaders() });
      if (r.ok) setHistory(await r.json());
    } catch (_) {}
    setHistLoading(false);
  }

  async function saveProfile() {
    const headers = (() => { try { return JSON.parse(profile.customHeaders); } catch { return {}; } })();
    await fetch(`${API_BASE_URL}/prod-gate/profiles`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        name: profile.name || profile.baseUrl || 'Profile',
        baseUrl: profile.baseUrl,
        authConfig: buildAuthConfig(),
        customHeaders: headers,
        loadConfig: { concurrentUsers: profile.concurrentUsers, timeout: profile.timeout },
        endpoints: profile.endpoints,
      }),
    });
    fetchProfiles();
  }

  async function deleteProfile(id) {
    await fetch(`${API_BASE_URL}/prod-gate/profiles/${id}`, { method: 'DELETE', headers: authHeaders() });
    fetchProfiles();
  }

  function loadProfile(p) {
    const auth = p.authConfig || {};
    setProfile(prev => ({
      ...prev,
      name: p.name, baseUrl: p.baseUrl,
      authType: auth.type || 'none',
      authToken: auth.token || '',
      apiKey: auth.key || '',
      apiKeyHeader: auth.header || 'X-API-Key',
      basicUser: auth.username || '',
      basicPass: auth.password || '',
      customHeaders: JSON.stringify(p.customHeaders || {}, null, 2),
      concurrentUsers: (p.loadConfig || {}).concurrentUsers || 20,
      timeout: (p.loadConfig || {}).timeout || 5000,
      endpoints: p.endpoints || [],
    }));
    setProfilesOpen(false);
  }

  // ── Auth config builder ───────────────────────────────────────────────────
  function buildAuthConfig() {
    if (profile.authType === 'bearer')  return { type: 'bearer', token: profile.authToken };
    if (profile.authType === 'api_key') return { type: 'api_key', key: profile.apiKey, header: profile.apiKeyHeader };
    if (profile.authType === 'basic')   return { type: 'basic', username: profile.basicUser, password: profile.basicPass };
    return { type: 'none' };
  }

  function buildCustomHeaders() {
    try { return JSON.parse(profile.customHeaders); } catch { return {}; }
  }

  // ── Run logic ──────────────────────────────────────────────────────────────
  function addLog(msg) {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(l => [...l, `[${ts}] ${msg}`]);
  }

  async function runGate() {
    if (!profile.baseUrl.trim()) return;
    stopRef.current = false;
    setSuiteResults({});
    setCompletedSuites([]);
    setLogs([]);
    setReport(null);
    setPhase('running');

    const results = {};
    const authConfig    = buildAuthConfig();
    const customHeaders = buildCustomHeaders();

    addLog(`→ Production Gate started for ${profile.baseUrl}`);
    addLog(`→ Running ${selectedSuites.length} suites: ${selectedSuites.join(', ')}`);

    for (const suiteId of selectedSuites) {
      if (stopRef.current) { addLog('✗ Run stopped by user'); break; }
      const suite = SUITES.find(s => s.id === suiteId);
      setCurrentSuite(suiteId);
      addLog(`\n→ Starting: ${suite?.name || suiteId}`);

      try {
        const res = await fetch(`${API_BASE_URL}/prod-gate/suite`, {
          method: 'POST', headers: authHeaders(),
          body: JSON.stringify({
            suiteId, baseUrl: profile.baseUrl,
            authConfig, customHeaders,
            endpoints: profile.endpoints,
            loadConfig: { concurrentUsers: profile.concurrentUsers, timeout: profile.timeout },
          }),
        });
        const data = await res.json();

        // Append backend logs
        (data.logs || []).forEach(l => addLog(l));

        const statusIcon = data.status === 'PASS' ? '✓' : data.status === 'WARN' ? '⚠' : '✗';
        addLog(`${statusIcon} ${suite?.name}: ${data.status} — ${data.score}/100 — ${data.summary || ''}`);

        results[suiteId] = data;
        setSuiteResults(prev => ({ ...prev, [suiteId]: data }));
        setCompletedSuites(prev => [...prev, suiteId]);

        // Stop on CRITICAL failure in security suite
        if (suiteId === 'security' && data.findings?.some(f => f.severity === 'CRITICAL')) {
          addLog('⚠ Critical security finding — remaining suites will still run');
        }
      } catch (e) {
        addLog(`✗ ${suite?.name} failed: ${e.message}`);
        results[suiteId] = {
          score: 0, status: 'FAIL', tests: [],
          findings: [{ severity: 'CRITICAL', message: e.message }],
          summary: `Failed: ${e.message}`,
        };
        setSuiteResults(prev => ({ ...prev, [suiteId]: results[suiteId] }));
        setCompletedSuites(prev => [...prev, suiteId]);
      }
    }

    setCurrentSuite(null);
    const finalScore    = calcScore(results, selectedSuites);
    const decision      = gateDecision(finalScore, results);
    const allFindings   = Object.values(results).flatMap(r => r?.findings || []);
    const reportObj     = { score: finalScore, decision, results, findings: allFindings, ts: new Date().toISOString() };
    setReport(reportObj);

    addLog(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    addLog(`GATE DECISION: ${decision.label} (${finalScore}/100)`);
    addLog(`Critical: ${allFindings.filter(f=>f.severity==='CRITICAL').length}  Warnings: ${allFindings.filter(f=>f.severity==='WARN').length}`);

    // Save to history
    try {
      await fetch(`${API_BASE_URL}/prod-gate/sessions`, {
        method: 'POST', headers: authHeaders(),
        body: JSON.stringify({
          profileName: profile.name || profile.baseUrl,
          baseUrl: profile.baseUrl,
          score: finalScore,
          gateDecision: decision.label,
          suitesRun: selectedSuites,
          resultJson: results,
        }),
      });
    } catch (_) {}

    setPhase('report');
  }

  // ── Endpoint management ───────────────────────────────────────────────────
  function addEndpoint() {
    if (!newEndpointPath.trim()) return;
    setProfile(p => ({
      ...p,
      endpoints: [...p.endpoints, { path: newEndpointPath.trim(), method: newEndpointMethod }],
    }));
    setNewEndpointPath('/');
  }

  function removeEndpoint(idx) {
    setProfile(p => ({ ...p, endpoints: p.endpoints.filter((_, i) => i !== idx) }));
  }

  // ── Reset to a blank new test ─────────────────────────────────────────────
  function loadNewSuite() {
    setPhase('config');
    setReport(null);
    setLogs([]);
    setSuiteResults({});
    setCompletedSuites([]);
    setCurrentSuite(null);
    setSelectedSuites(['health', 'security', 'load', 'functional']);
    setProfile({
      name: '', baseUrl: '', authType: 'none',
      authToken: '', apiKey: '', apiKeyHeader: 'X-API-Key',
      basicUser: '', basicPass: '',
      customHeaders: '{}', concurrentUsers: 20, timeout: 5000,
      endpoints: [],
    });
    setActiveTab('run');
  }

  // ── Suite toggle ─────────────────────────────────────────────────────────
  function toggleSuite(id) {
    const suite = SUITES.find(s => s.id === id);
    if (suite?.alwaysOn) return;
    setSelectedSuites(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER PHASES
  // ─────────────────────────────────────────────────────────────────────────

  const renderConfig = () => (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

      {/* Left: Profile Config */}
      <div className="xl:col-span-2 space-y-4">

        {/* Saved Profiles */}
        <Card>
          <button
            className="w-full flex items-center justify-between px-5 py-3.5 text-left"
            onClick={() => setProfilesOpen(o => !o)}
          >
            <div className="flex items-center gap-2.5">
              <FileText size={15} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-300">Saved Profiles</span>
              {savedProfiles.length > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono"
                  style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                  {savedProfiles.length}
                </span>
              )}
            </div>
            <ChevronRight size={14} className="text-slate-600" style={{ transform: profilesOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {profilesOpen && (
            <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              {savedProfiles.length === 0 ? (
                <p className="text-xs text-slate-600 py-2 font-mono">no saved profiles — save one below</p>
              ) : savedProfiles.map(p => (
                <div key={p.profileId} className="flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-slate-300 truncate">{p.name}</div>
                    <div className="text-[10px] font-mono text-slate-600 truncate">{p.baseUrl}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => loadProfile(p)}
                      className="text-[10px] px-2.5 py-1 rounded font-mono text-blue-400 hover:text-blue-300 transition-colors"
                      style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.20)' }}>
                      Load
                    </button>
                    <button onClick={() => deleteProfile(p.profileId)}
                      className="p-1 rounded text-slate-600 hover:text-red-400 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Environment Config */}
        <Card>
          <div className="px-5 py-4 space-y-4">
            <div className="flex items-center gap-2.5 mb-1">
              <Globe size={15} className="text-blue-400" />
              <span className="text-sm font-semibold text-slate-200">Environment Config</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Profile Name (optional)"
                placeholder="My Production API"
                value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              />
              <Input label="Base URL *"
                placeholder="https://api.yourapp.com"
                value={profile.baseUrl}
                onChange={e => setProfile(p => ({ ...p, baseUrl: e.target.value }))}
              />
            </div>

            {/* Auth */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-2">Authentication</label>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {['none', 'bearer', 'api_key', 'basic'].map(t => (
                  <button key={t} onClick={() => setProfile(p => ({ ...p, authType: t }))}
                    className="px-3 py-1 rounded text-xs font-mono transition-all"
                    style={{
                      background: profile.authType === t ? 'rgba(59,130,246,0.20)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${profile.authType === t ? 'rgba(59,130,246,0.50)' : 'rgba(255,255,255,0.08)'}`,
                      color: profile.authType === t ? '#93c5fd' : '#64748b',
                    }}>
                    {t === 'none' ? 'None' : t === 'bearer' ? 'Bearer Token' : t === 'api_key' ? 'API Key' : 'Basic Auth'}
                  </button>
                ))}
              </div>
              {profile.authType === 'bearer' && (
                <Input label="Bearer Token" placeholder="eyJhbGc..." value={profile.authToken}
                  onChange={e => setProfile(p => ({ ...p, authToken: e.target.value }))} />
              )}
              {profile.authType === 'api_key' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Header Name" placeholder="X-API-Key" value={profile.apiKeyHeader}
                    onChange={e => setProfile(p => ({ ...p, apiKeyHeader: e.target.value }))} />
                  <Input label="API Key Value" placeholder="sk-..." value={profile.apiKey}
                    onChange={e => setProfile(p => ({ ...p, apiKey: e.target.value }))} />
                </div>
              )}
              {profile.authType === 'basic' && (
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Username" placeholder="admin" value={profile.basicUser}
                    onChange={e => setProfile(p => ({ ...p, basicUser: e.target.value }))} />
                  <Input label="Password" type="password" placeholder="••••••••" value={profile.basicPass}
                    onChange={e => setProfile(p => ({ ...p, basicPass: e.target.value }))} />
                </div>
              )}
            </div>

            {/* Custom Headers */}
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">Custom Headers (JSON)</label>
              <textarea rows={2} value={profile.customHeaders}
                onChange={e => setProfile(p => ({ ...p, customHeaders: e.target.value }))}
                placeholder='{"X-Environment": "production", "X-App-Version": "2.1.0"}'
                className="w-full px-3 py-2 rounded-lg text-xs text-slate-300 placeholder-slate-700 outline-none font-mono resize-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
              />
            </div>

            {/* Load Config */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Concurrent Users
                  <span className="ml-1.5 text-blue-400 font-mono">{profile.concurrentUsers}</span>
                </label>
                <input type="range" min={5} max={50} step={5} value={profile.concurrentUsers}
                  onChange={e => setProfile(p => ({ ...p, concurrentUsers: +e.target.value }))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{ background: `linear-gradient(to right, #3b82f6 ${(profile.concurrentUsers - 5) / 45 * 100}%, rgba(255,255,255,0.1) 0%)` }}
                />
                <div className="flex justify-between text-[9px] font-mono text-slate-700 mt-1">
                  <span>5</span><span>50</span>
                </div>
              </div>
              <Input label={`Request Timeout (ms)`} type="number" placeholder="5000"
                value={profile.timeout}
                onChange={e => setProfile(p => ({ ...p, timeout: +e.target.value }))}
              />
            </div>
          </div>
        </Card>

        {/* Endpoints */}
        <Card>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2.5 mb-3">
              <ArrowRight size={14} className="text-slate-500" />
              <span className="text-sm font-semibold text-slate-200">Endpoint Paths</span>
              <span className="text-[10px] text-slate-600 font-mono">(optional — improves accuracy)</span>
            </div>
            {/* Add endpoint row */}
            <div className="flex gap-2 mb-3">
              <select value={newEndpointMethod} onChange={e => setNewEndpointMethod(e.target.value)}
                className="px-2 py-1.5 rounded text-xs font-mono text-slate-300 outline-none flex-shrink-0"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)', minWidth: 80 }}>
                {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
              </select>
              <input value={newEndpointPath} onChange={e => setNewEndpointPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEndpoint()}
                placeholder="/api/users"
                className="flex-1 px-3 py-1.5 rounded text-xs font-mono text-slate-300 placeholder-slate-700 outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
              />
              <button onClick={addEndpoint}
                className="flex-shrink-0 px-3 py-1.5 rounded flex items-center gap-1 text-xs font-mono text-emerald-400 transition-colors hover:text-emerald-300"
                style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}>
                <Plus size={12} /> Add
              </button>
            </div>
            {/* Endpoint list */}
            {profile.endpoints.length === 0 ? (
              <p className="text-[11px] font-mono text-slate-700">no endpoints added — base URL will be probed</p>
            ) : (
              <div className="space-y-1.5">
                {profile.endpoints.map((ep, i) => (
                  <div key={i} className="flex items-center gap-2 rounded px-3 py-1.5"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#93c5fd' }}>{ep.method}</span>
                    <span className="text-xs font-mono text-slate-400 flex-1 truncate">{ep.path}</span>
                    <button onClick={() => removeEndpoint(i)} className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Save Profile + Launch */}
        <div className="flex gap-3">
          <button onClick={saveProfile}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-mono text-slate-400 transition-all hover:text-slate-200"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
            <Save size={14} /> Save Profile
          </button>
          <button
            disabled={!profile.baseUrl.trim()}
            onClick={runGate}
            className="flex-1 flex items-center justify-center gap-2.5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: profile.baseUrl.trim()
                ? 'linear-gradient(135deg,#1d4ed8,#7c3aed)'
                : 'rgba(255,255,255,0.04)',
              opacity: profile.baseUrl.trim() ? 1 : 0.4,
              boxShadow: profile.baseUrl.trim() ? '0 4px 20px rgba(59,130,246,0.35)' : 'none',
            }}>
            <Play size={16} />
            Launch Production Gate
          </button>
        </div>
      </div>

      {/* Right: Suite Selection */}
      <div>
        <Card>
          <div className="px-5 py-4">
            <div className="flex items-center gap-2.5 mb-4">
              <Shield size={15} className="text-purple-400" />
              <span className="text-sm font-semibold text-slate-200">Test Suites</span>
            </div>
            <div className="space-y-2">
              {SUITES.map(suite => {
                const SIcon = suite.icon;
                const on    = selectedSuites.includes(suite.id);
                return (
                  <button key={suite.id} onClick={() => toggleSuite(suite.id)}
                    className="w-full text-left rounded-lg px-3 py-3 transition-all duration-150"
                    style={{
                      background: on ? suite.glow : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${on ? suite.color + '40' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <div className="flex items-start gap-3">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: on ? suite.color + '25' : 'rgba(255,255,255,0.04)' }}>
                        <SIcon size={14} style={{ color: on ? suite.color : '#475569' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold" style={{ color: on ? '#e2e8f0' : '#475569' }}>
                            {suite.name}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {suite.alwaysOn && (
                              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                                style={{ background: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
                                required
                              </span>
                            )}
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(255,255,255,0.04)', color: '#475569', border: '1px solid rgba(255,255,255,0.07)' }}>
                              {Math.round(suite.weight * 100)}%
                            </span>
                            <div className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0"
                              style={{ borderColor: on ? suite.color : '#334155', background: on ? suite.color + '30' : 'transparent' }}>
                              {on && <div className="w-2 h-2 rounded-sm" style={{ background: suite.color }} />}
                            </div>
                          </div>
                        </div>
                        <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: on ? '#64748b' : '#1e293b' }}>
                          {suite.desc}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Weight total */}
            <div className="mt-4 pt-3 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <span className="text-[10px] font-mono text-slate-700">weighted coverage</span>
              <span className="text-xs font-mono font-bold text-blue-400">
                {Math.round(selectedSuites.reduce((acc, id) => acc + (SUITES.find(s=>s.id===id)?.weight||0), 0) * 100)}%
              </span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  // ─── Running Phase ──────────────────────────────────────────────────────────
  const renderRunning = () => (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
      {/* Suite progress */}
      <div className="xl:col-span-2 space-y-3">
        <Card>
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-slate-200">Suite Progress</span>
              <div className="flex items-center gap-2">
                <button onClick={() => { stopRef.current = true; }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-red-400 transition-all hover:text-red-300"
                  style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)' }}>
                  <Square size={10} /> Stop
                </button>
                <button onClick={loadNewSuite}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-emerald-400 transition-all hover:text-emerald-300"
                  style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <Plus size={10} /> New Suite
                </button>
              </div>
            </div>
            <div className="space-y-3">
              {selectedSuites.map(id => {
                const suite = SUITES.find(s => s.id === id);
                const SIcon  = suite?.icon || Activity;
                const done   = completedSuites.includes(id);
                const active = currentSuite === id;
                const result = suiteResults[id];
                const waiting = !done && !active;
                return (
                  <div key={id}>
                    <div className="flex items-center gap-3 mb-1.5">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: active ? suite?.color + '25' : done ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)' }}>
                        {active
                          ? <Loader size={13} style={{ color: suite?.color, animation: 'spin 1s linear infinite' }} />
                          : done
                          ? <CheckCircle size={13} style={{ color: statusColor(result?.status) }} />
                          : <SIcon size={13} style={{ color: '#1e293b' }} />
                        }
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold" style={{ color: active ? '#e2e8f0' : done ? '#94a3b8' : '#334155' }}>
                            {suite?.name}
                          </span>
                          {done && result && (
                            <span className="text-[10px] font-mono font-bold" style={{ color: scoreColor(result.score) }}>
                              {result.score}/100
                            </span>
                          )}
                          {active && <span className="text-[10px] font-mono text-blue-400 animate-pulse">running...</span>}
                          {waiting && <span className="text-[10px] font-mono text-slate-700">waiting</span>}
                        </div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1 rounded-full overflow-hidden ml-10" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: done ? '100%' : active ? '60%' : '0%',
                          background: done
                            ? `linear-gradient(90deg, ${statusColor(result?.status)}, ${statusColor(result?.status)}bb)`
                            : `linear-gradient(90deg, ${suite?.color}, ${suite?.color}88)`,
                          animation: active ? 'loadPulse 1.5s ease-in-out infinite' : 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        {/* Live results preview */}
        {Object.keys(suiteResults).length > 0 && (
          <Card>
            <div className="px-5 py-4">
              <span className="text-xs font-semibold text-slate-400">Live Results</span>
              <div className="mt-3 space-y-1.5">
                {Object.entries(suiteResults).map(([id, r]) => (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{SUITES.find(s=>s.id===id)?.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono" style={{ color: scoreColor(r.score) }}>{r.score}/100</span>
                      <span className="text-[10px] font-bold font-mono" style={{ color: statusColor(r.status) }}>{r.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Live Log terminal */}
      <div className="xl:col-span-3">
        <div className="rounded-xl overflow-hidden font-mono text-xs h-full" style={{ background: 'rgba(4,7,15,0.97)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="flex items-center gap-1.5 px-4 py-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.3)' }}>
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-2 text-[9px] tracking-wider text-slate-600">flasqo / prod-gate / live-log</span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[9px] text-green-400/70">running</span>
            </div>
          </div>
          <div className="p-4 overflow-y-auto" style={{ height: 420 }}>
            {logs.map((l, i) => {
              const isSection = l.trim().startsWith('\n') || l.includes('━');
              const isError   = l.includes('✗') || l.includes('CRITICAL');
              const isWarn    = l.includes('⚠') || l.includes('WARN');
              const isSuccess = l.includes('✓') || l.includes('PASS');
              const isGate    = l.includes('GATE DECISION');
              return (
                <div key={i} className="leading-relaxed"
                  style={{
                    color: isGate ? '#f0abfc'
                         : isError ? '#f87171'
                         : isWarn  ? '#fbbf24'
                         : isSuccess ? '#4ade80'
                         : l.startsWith('[') && l.indexOf(']') < 12 ? '#64748b'
                         : '#475569',
                    marginTop: isSection ? '12px' : undefined,
                    fontWeight: isGate ? '700' : undefined,
                  }}>
                  {l}
                </div>
              );
            })}
            <div ref={logsEndRef} />
            {currentSuite && (
              <div className="flex items-center gap-1 mt-2" style={{ color: '#475569' }}>
                <span>&gt;</span>
                <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse" style={{ background: '#475569' }} />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes loadPulse { 0%,100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </div>
  );

  // ─── Report Phase ──────────────────────────────────────────────────────────
  const renderReport = () => {
    if (!report) return null;
    const { score, decision, results, findings } = report;
    const criticals = findings.filter(f => f.severity === 'CRITICAL');
    const warnings  = findings.filter(f => f.severity === 'WARN');
    const ringDash  = 2 * Math.PI * 52;
    const ringOffset = ringDash * (1 - score / 100);

    return (
      <div className="space-y-5">
        {/* Score header */}
        <Card>
          <div className="px-6 py-6">
            <div className="flex flex-col sm:flex-row items-center gap-6">
              {/* Score ring */}
              <div className="relative flex-shrink-0">
                <svg width={130} height={130} viewBox="0 0 130 130">
                  <circle cx={65} cy={65} r={52} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth={10} />
                  <circle cx={65} cy={65} r={52} fill="none"
                    stroke={scoreColor(score)} strokeWidth={10}
                    strokeDasharray={ringDash} strokeDashoffset={ringOffset}
                    strokeLinecap="round"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '65px 65px', transition: 'stroke-dashoffset 1.2s ease-out', filter: `drop-shadow(0 0 8px ${scoreColor(score)}70)` }}
                  />
                  <text x={65} y={60} textAnchor="middle" fill={scoreColor(score)} fontSize={28} fontWeight={800} fontFamily="monospace">{score}</text>
                  <text x={65} y={76} textAnchor="middle" fill="#475569" fontSize={10} fontFamily="monospace">/100</text>
                </svg>
              </div>

              {/* Decision + stats */}
              <div className="flex-1 w-full">
                <div className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl mb-4"
                  style={{ background: decision.bg, border: `1px solid ${decision.border}` }}>
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: decision.color }} />
                  <span className="text-base font-black tracking-wider" style={{ color: decision.color }}>{decision.label}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Critical', value: criticals.length, color: '#ef4444' },
                    { label: 'Warnings', value: warnings.length, color: '#f59e0b' },
                    { label: 'Suites Run', value: selectedSuites.length, color: '#3b82f6' },
                  ].map(stat => (
                    <div key={stat.label} className="rounded-lg px-3 py-2.5 text-center"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div className="text-lg font-black font-mono" style={{ color: stat.color }}>{stat.value}</div>
                      <div className="text-[10px] text-slate-600 mt-0.5">{stat.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex sm:flex-col gap-2 flex-shrink-0">
                <button onClick={() => { setPhase('config'); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-slate-400 transition-all hover:text-slate-200"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}>
                  <RefreshCw size={12} /> Re-run
                </button>
                <button onClick={loadNewSuite}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-emerald-400 transition-all hover:text-emerald-300"
                  style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <Plus size={12} /> New Suite
                </button>
                <button onClick={() => {
                  const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
                  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `prod-gate-${Date.now()}.json` });
                  a.click();
                }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-mono text-blue-400 transition-all hover:text-blue-300"
                  style={{ background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.25)' }}>
                  <Download size={12} /> Export
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Suite breakdown */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
          {selectedSuites.map(id => {
            const suite = SUITES.find(s => s.id === id);
            const r     = results[id];
            const SIcon = suite?.icon || Activity;
            if (!r) return null;
            return (
              <div key={id} className="rounded-xl overflow-hidden"
                style={{ background: 'rgba(9,12,22,0.80)', border: `1px solid ${statusColor(r.status)}25` }}>
                <div className="h-0.5" style={{ background: `linear-gradient(90deg, ${suite?.color}, ${suite?.color}80)` }} />
                <div className="p-3 text-center">
                  <div className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                    style={{ background: suite?.color + '20' }}>
                    <SIcon size={15} style={{ color: suite?.color }} />
                  </div>
                  <div className="text-lg font-black font-mono" style={{ color: scoreColor(r.score) }}>{r.score}</div>
                  <div className="text-[9px] font-mono mt-0.5" style={{ color: statusColor(r.status) }}>{r.status}</div>
                  <div className="text-[9px] text-slate-700 mt-1 truncate">{suite?.name}</div>
                  {r.summary && <div className="text-[9px] text-slate-700 mt-1 leading-tight truncate">{r.summary}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Findings */}
        {findings.length > 0 && (
          <Card>
            <div className="px-5 py-4">
              <div className="flex items-center gap-2.5 mb-4">
                <AlertTriangle size={15} className="text-yellow-500" />
                <span className="text-sm font-bold text-slate-200">Findings</span>
                <span className="text-[10px] font-mono text-slate-600">{findings.length} total</span>
              </div>
              <div className="space-y-2">
                {[...criticals, ...warnings].map((f, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                    style={{
                      background: f.severity === 'CRITICAL' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${f.severity === 'CRITICAL' ? 'rgba(239,68,68,0.20)' : 'rgba(245,158,11,0.20)'}`,
                    }}>
                    <span className="text-[9px] font-black font-mono px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                      style={{
                        background: f.severity === 'CRITICAL' ? 'rgba(239,68,68,0.20)' : 'rgba(245,158,11,0.20)',
                        color: f.severity === 'CRITICAL' ? '#f87171' : '#fbbf24',
                      }}>
                      {f.severity}
                    </span>
                    <span className="text-xs text-slate-400">{f.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )}

        {/* Detailed Suite Results */}
        <div className="space-y-3">
          {selectedSuites.map(id => {
            const suite = SUITES.find(s => s.id === id);
            const r     = results[id];
            const SIcon = suite?.icon || Activity;
            if (!r || !r.tests?.length) return null;
            return (
              <Card key={id}>
                <div className="px-5 py-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: suite?.color + '20' }}>
                      <SIcon size={13} style={{ color: suite?.color }} />
                    </div>
                    <span className="text-sm font-bold text-slate-300">{suite?.name}</span>
                    <span className="ml-auto text-xs font-mono font-bold" style={{ color: scoreColor(r.score) }}>{r.score}/100</span>
                  </div>
                  <div className="space-y-1.5">
                    {r.tests.map((t, ti) => (
                      <div key={ti} className="flex items-center gap-3 rounded px-3 py-1.5"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: statusColor(t.status) }} />
                        <span className="text-xs text-slate-400 flex-1 truncate">{t.name}</span>
                        {t.latency > 0 && <span className="text-[10px] font-mono text-slate-700">{t.latency}ms</span>}
                        <span className="text-[10px] font-mono font-bold flex-shrink-0" style={{ color: statusColor(t.status) }}>{t.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  // ─── History Tab ────────────────────────────────────────────────────────────
  const renderHistory = () => (
    <Card>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2.5 mb-4">
          <History size={15} className="text-slate-500" />
          <span className="text-sm font-bold text-slate-200">Gate Run History</span>
          <span className="text-[10px] font-mono text-slate-600">last 20 runs</span>
        </div>
        {histLoading ? (
          <div className="flex items-center gap-2 py-4 text-slate-600 text-xs font-mono">
            <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Loading...
          </div>
        ) : history.length === 0 ? (
          <p className="text-xs font-mono text-slate-700 py-4">no gate runs yet — run your first gate above</p>
        ) : (
          <div className="space-y-2">
            {history.map(s => {
              const dec = s.gateDecision === 'DEPLOY READY' ? '#22c55e'
                        : s.gateDecision === 'NEEDS ATTENTION' ? '#f59e0b' : '#ef4444';
              return (
                <div key={s.sessionId} className="flex items-center gap-4 rounded-lg px-4 py-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="text-lg font-black font-mono w-10 flex-shrink-0" style={{ color: scoreColor(s.score) }}>
                    {s.score}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-slate-400 truncate">{s.profileName || s.baseUrl}</div>
                    <div className="text-[10px] font-mono text-slate-700 truncate">{s.baseUrl}</div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: dec }} />
                    <span className="text-[10px] font-mono font-bold hidden sm:block" style={{ color: dec }}>{s.gateDecision}</span>
                  </div>
                  <div className="text-[10px] font-mono text-slate-700 flex-shrink-0">
                    {new Date(s.executedAt).toLocaleDateString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
      </div>
    </Card>
  );

  // ─── Main Layout ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #020408 0%, #060c18 50%, #020408 100%)' }}>
      {/* Ambient dot grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* Header */}
      <div className="sticky top-0 z-40" style={{ background: 'rgba(2,4,8,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => { if (window.opener) window.close(); else window.location.href = '/'; }}
                className="flex items-center gap-1.5 text-slate-600 hover:text-slate-300 transition-colors text-xs font-mono">
                <ArrowLeft size={14} /> {window.opener ? 'close tab' : 'home'}
              </button>
              <div className="w-px h-4 bg-slate-800" />
              {/* Logo */}
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#7c3aed)', boxShadow: '0 0 16px rgba(59,130,246,0.30)' }}>
                  <Shield size={16} className="text-white" />
                </div>
                <div>
                  <div className="text-sm font-black text-white leading-none">Production Gate</div>
                  <div className="text-[9px] font-mono mt-0.5" style={{ color: '#1e3a5f' }}>
                    {profile.baseUrl || 'no environment configured'}
                  </div>
                </div>
              </div>
            </div>

            {/* User + logout */}
            {user && (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)' }}>
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs text-slate-500">{user.username}</span>
                </div>
                <button onClick={onLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500/70 hover:text-red-400 transition-colors font-mono"
                  style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                  <LogOut size={12} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page hero */}
      <div className="max-w-7xl mx-auto px-6 pt-8 pb-5">
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-mono text-blue-400/70 tracking-widest uppercase">Production Simulation</span>
            </div>
            <h1 className="text-2xl font-black text-white">Production Gate</h1>
            <p className="text-sm text-slate-500 mt-1">Test your APIs exactly as they'd behave in production — before you deploy.</p>
          </div>

          {/* Phase indicator */}
          <div className="hidden sm:flex items-center gap-1">
            {[
              { id: 'config',  label: 'Config'  },
              { id: 'running', label: 'Running' },
              { id: 'report',  label: 'Report'  },
            ].map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && <div className="w-5 h-px" style={{ background: phase === p.id || (phase === 'report' && i < 2) ? '#3b82f6' : 'rgba(255,255,255,0.08)' }} />}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono transition-all"
                  style={{
                    background: phase === p.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${phase === p.id ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.07)'}`,
                    color: phase === p.id ? '#93c5fd' : '#334155',
                  }}>
                  {phase === p.id && <div className="w-1 h-1 rounded-full bg-blue-400 animate-pulse" />}
                  {p.label}
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Tabs — only show when not running */}
        {phase !== 'running' && (
          <div className="flex gap-1 mb-5">
            {[
              { id: 'run', label: 'Run Gate', icon: Play },
              { id: 'history', label: 'History', icon: History },
            ].map(tab => {
              const TIcon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono transition-all"
                  style={{
                    background: activeTab === tab.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${activeTab === tab.id ? 'rgba(59,130,246,0.30)' : 'rgba(255,255,255,0.07)'}`,
                    color: activeTab === tab.id ? '#93c5fd' : '#475569',
                  }}>
                  <TIcon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Phase content */}
        {phase === 'running' && renderRunning()}
        {phase !== 'running' && activeTab === 'run' && (
          phase === 'config' ? renderConfig() : renderReport()
        )}
        {phase !== 'running' && activeTab === 'history' && renderHistory()}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-6 py-6 mt-4">
        <div className="flex items-center justify-between pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <p className="text-[10px] font-mono text-slate-800">Flasqo Production Gate · by EvoluneEdgeTech</p>
          <p className="text-[10px] font-mono text-slate-800">
            {profile.baseUrl ? `target: ${profile.baseUrl}` : 'no target configured'}
          </p>
        </div>
      </div>
    </div>
  );
}
