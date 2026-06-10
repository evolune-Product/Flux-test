import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, Zap, Clock, Activity, AlertTriangle,
  Home, ArrowLeft, Github, Play, Loader, Plus, Trash2, Edit3,
  Server, Database, Globe, Shield
} from 'lucide-react';
import GitHubIntegration from './GitHubIntegration.jsx';
import { saveTestRun } from './testHistoryUtils.js';
import RecentRuns from './RecentRuns.jsx';

const SmokeTestingApp = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // ─── State (unchanged) ────────────────────────────────────────────────────
  const [endpoints, setEndpoints] = useState([
    { id: 1, name: 'Health Check', url: '', method: 'GET', maxTime: 2000, critical: true },
    { id: 2, name: 'API Status',   url: '', method: 'GET', maxTime: 2000, critical: true }
  ]);
  const [isRunning,        setIsRunning]        = useState(false);
  const [progress,         setProgress]         = useState(0);
  const [results,          setResults]          = useState(null);
  const [logs,             setLogs]             = useState([]);
  const [showGitHub,       setShowGitHub]       = useState(false);
  const [activeTab,        setActiveTab]        = useState('results');
  const [editingEndpoint,  setEditingEndpoint]  = useState(null);
  const [endpointForm,     setEndpointForm]     = useState({
    name: '', url: '', method: 'GET', maxTime: 2000,
    critical: true, headers: '', expectedStatus: 200
  });
  const [nlTestInput,  setNlTestInput]  = useState('');
  const [nlGenerating, setNlGenerating] = useState(false);

  const logsEndRef = useRef(null);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // ─── Effects (unchanged) ──────────────────────────────────────────────────
  useEffect(() => {
    const discoveryDataStr = localStorage.getItem('discoveryData');
    if (discoveryDataStr) {
      try {
        const discoveryData = JSON.parse(discoveryDataStr);
        if (discoveryData.endpoints?.length > 0) {
          setEndpoints(discoveryData.endpoints);
          addLog(`Loaded ${discoveryData.endpoints.length} endpoints from Auto-Discovery`, 'success');
          localStorage.removeItem('discoveryData');
          return;
        }
      } catch (e) { console.error(e); }
    }
    const savedState = localStorage.getItem('smokeTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.endpoints?.length > 0) setEndpoints(state.endpoints);
        if (state.results) setResults(state.results);
      } catch (e) { console.error(e); }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('smokeTestingState', JSON.stringify({ endpoints, results, savedAt: new Date().toISOString() }));
  }, [endpoints, results]);

  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  // ─── Logic (unchanged) ────────────────────────────────────────────────────
  const handleGenerateFromNL = async () => {
    if (!nlTestInput.trim()) return;
    setNlGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-test-from-nl`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: nlTestInput, base_url: 'http://api.example.com' })
      });
      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setEndpointForm({ name: data.description, url: data.endpoint || '', method: data.method || 'GET',
        maxTime: 2000, critical: true, headers: '', expectedStatus: data.expected_status || 200 });
      setNlTestInput('');
      addLog('Test generated from AI — review and save', 'success');
    } catch (error) { addLog(`Error: ${error.message}`, 'error'); }
    finally { setNlGenerating(false); }
  };

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const handleSaveEndpoint = () => {
    if (!endpointForm.name.trim() || !endpointForm.url.trim()) {
      addLog('Endpoint name and URL are required', 'error'); return;
    }
    if (editingEndpoint !== null) {
      setEndpoints(endpoints.map(ep => ep.id === editingEndpoint ? { ...endpointForm, id: editingEndpoint } : ep));
      addLog(`Updated: ${endpointForm.name}`, 'success');
    } else {
      setEndpoints([...endpoints, { ...endpointForm, id: Date.now() }]);
      addLog(`Added: ${endpointForm.name}`, 'success');
    }
    setEndpointForm({ name: '', url: '', method: 'GET', maxTime: 2000, critical: true, headers: '', expectedStatus: 200 });
    setEditingEndpoint(null);
  };

  const handleEditEndpoint = (endpoint) => { setEndpointForm(endpoint); setEditingEndpoint(endpoint.id); };
  const handleDeleteEndpoint = (id) => { setEndpoints(endpoints.filter(ep => ep.id !== id)); addLog('Endpoint removed', 'info'); };

  const testEndpoint = async (endpoint) => {
    const startTime = performance.now();
    try {
      let headers = { 'Content-Type': 'application/json' };
      if (endpoint.headers) {
        try { headers = { ...headers, ...JSON.parse(endpoint.headers) }; }
        catch { addLog(`Invalid headers for ${endpoint.name}, using defaults`, 'warning'); }
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.maxTime);
      const response = await fetch(endpoint.url, { method: endpoint.method, headers, signal: controller.signal, mode: 'cors' });
      clearTimeout(timeoutId);
      const responseTime = performance.now() - startTime;
      const passed = response.status === endpoint.expectedStatus && responseTime <= endpoint.maxTime;
      return {
        name: endpoint.name, url: endpoint.url, method: endpoint.method, passed,
        status: response.status, expectedStatus: endpoint.expectedStatus,
        responseTime: responseTime.toFixed(2), maxTime: endpoint.maxTime, critical: endpoint.critical,
        message: passed ? `OK (${responseTime.toFixed(0)}ms)`
          : `${response.status !== endpoint.expectedStatus ? `Expected ${endpoint.expectedStatus}, got ${response.status}` : `Timeout (${responseTime.toFixed(0)}ms > ${endpoint.maxTime}ms)`}`
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      return {
        name: endpoint.name, url: endpoint.url, method: endpoint.method, passed: false,
        status: 0, expectedStatus: endpoint.expectedStatus, responseTime: responseTime.toFixed(2),
        maxTime: endpoint.maxTime, critical: endpoint.critical,
        message: error.name === 'AbortError' ? `Timeout (>${endpoint.maxTime}ms)`
          : error.message.includes('Failed to fetch') ? 'Network error / CORS'
          : error.message
      };
    }
  };

  const runSmokeTests = async () => {
    const validEndpoints = endpoints.filter(ep => ep.url.trim() !== '');
    if (validEndpoints.length === 0) { addLog('No valid endpoints. Add at least one URL.', 'error'); return; }
    setIsRunning(true); setProgress(0); setResults(null); setLogs([]);
    addLog(`Starting Smoke Tests — ${validEndpoints.length} endpoints`, 'info');
    const startTime = performance.now();
    const testResults = [];
    let passedCount = 0, failedCount = 0, criticalFailures = 0;
    try {
      for (let i = 0; i < validEndpoints.length; i++) {
        const endpoint = validEndpoints[i];
        addLog(`Testing: ${endpoint.name} (${endpoint.method} ${endpoint.url})`, 'info');
        const result = await testEndpoint(endpoint);
        testResults.push(result);
        if (result.passed) { passedCount++; addLog(`${result.name}: ${result.message}`, 'success'); }
        else { failedCount++; if (endpoint.critical) criticalFailures++; addLog(`${result.name}: ${result.message}`, 'error'); }
        setProgress(((i + 1) / validEndpoints.length) * 100);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
      const avgResponseTime = (testResults.reduce((sum, r) => sum + parseFloat(r.responseTime), 0) / testResults.length).toFixed(2);
      const maxResponseTime = Math.max(...testResults.map(r => parseFloat(r.responseTime))).toFixed(2);
      const passRate = ((passedCount / testResults.length) * 100).toFixed(2);
      const overallStatus = criticalFailures === 0 && failedCount === 0 ? 'PASS' : criticalFailures > 0 ? 'CRITICAL_FAIL' : 'FAIL';
      const finalResults = { totalTests: testResults.length, passed: passedCount, failed: failedCount,
        criticalFailures, passRate, totalTime, avgResponseTime, maxResponseTime, tests: testResults, overallStatus,
        timestamp: new Date().toISOString() };
      setResults(finalResults);
      saveTestRun({ module: 'smoke', apiUrl: endpoints[0]?.url || 'multiple endpoints',
        totalTests: finalResults.totalTests, passed: finalResults.passed, failed: finalResults.failed,
        durationMs: Math.round(parseFloat(totalTime) * 1000), overallStatus: overallStatus === 'PASS' ? 'PASS' : 'FAIL' });
      if (overallStatus === 'PASS') addLog(`All smoke tests passed! (${totalTime}s)`, 'success');
      else if (overallStatus === 'CRITICAL_FAIL') addLog(`CRITICAL FAILURE: ${criticalFailures} critical endpoint(s) failed`, 'error');
      else addLog(`Some tests failed but no critical failures (${totalTime}s)`, 'warning');
      setActiveTab('results');
    } catch (error) { addLog(`Test execution error: ${error.message}`, 'error'); }
    setIsRunning(false); setProgress(100);
  };

  const loadPreset = (preset) => {
    if (preset === 'api') {
      setEndpoints([
        { id: 1, name: 'Health Check', url: 'https://jsonplaceholder.typicode.com/', method: 'GET', maxTime: 2000, critical: true, headers: '', expectedStatus: 200 },
        { id: 2, name: 'Users API', url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET', maxTime: 2000, critical: true, headers: '', expectedStatus: 200 },
        { id: 3, name: 'Posts API', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET', maxTime: 2000, critical: false, headers: '', expectedStatus: 200 }
      ]);
      addLog('Loaded REST API preset', 'info');
    } else if (preset === 'microservices') {
      setEndpoints([
        { id: 1, name: 'Gateway Health',         url: '', method: 'GET', maxTime: 1000, critical: true,  headers: '', expectedStatus: 200 },
        { id: 2, name: 'Auth Service',            url: '', method: 'GET', maxTime: 1500, critical: true,  headers: '', expectedStatus: 200 },
        { id: 3, name: 'User Service',            url: '', method: 'GET', maxTime: 1500, critical: true,  headers: '', expectedStatus: 200 },
        { id: 4, name: 'Payment Service',         url: '', method: 'GET', maxTime: 2000, critical: true,  headers: '', expectedStatus: 200 },
        { id: 5, name: 'Notification Service',    url: '', method: 'GET', maxTime: 2000, critical: false, headers: '', expectedStatus: 200 }
      ]);
      addLog('Loaded microservices preset (add your URLs)', 'info');
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const validCount = endpoints.filter(ep => ep.url.trim() !== '').length;
  const overallColor = results
    ? results.overallStatus === 'PASS' ? '#22c55e' : results.overallStatus === 'CRITICAL_FAIL' ? '#ef4444' : '#f59e0b'
    : null;

  const logColor = (type) => {
    if (type === 'error')   return '#f87171';
    if (type === 'warning') return '#fbbf24';
    if (type === 'success') return '#4ade80';
    return '#475569';
  };

  const methodColor = (m) => {
    const map = { GET: '#22c55e', POST: '#3b82f6', PUT: '#f59e0b', DELETE: '#ef4444', PATCH: '#a855f7', HEAD: '#06b6d4' };
    return map[m] || '#64748b';
  };

  // ─── Shared card style ─────────────────────────────────────────────────────
  const card = {
    background: 'rgba(9,12,22,0.80)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 12,
    overflow: 'hidden',
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8,
    color: '#e2e8f0',
    padding: '8px 12px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    fontFamily: 'monospace',
  };

  const labelStyle = { display: 'block', fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 6 };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#020408 0%,#060c18 50%,#020408 100%)' }}>

      {/* Ambient dot grid */}
      <div className="fixed inset-0 pointer-events-none opacity-[0.035]"
        style={{ backgroundImage: 'radial-gradient(circle,#22c55e 1px,transparent 1px)', backgroundSize: '28px 28px' }} />

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-40"
        style={{ background: 'rgba(2,4,8,0.92)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-300 transition-colors text-xs font-mono">
              <ArrowLeft size={14} /> modules
            </button>
            <div className="w-px h-4 bg-slate-800" />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg,#16a34a,#059669)', boxShadow: '0 0 16px rgba(34,197,94,0.30)' }}>
                <Zap size={16} className="text-white" />
              </div>
              <div>
                <div className="text-sm font-black text-white leading-none">Smoke Testing</div>
                <div className="text-[9px] font-mono mt-0.5 text-emerald-900">
                  {validCount > 0 ? `${validCount} endpoint${validCount > 1 ? 's' : ''} configured` : 'no endpoints configured'}
                </div>
              </div>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#059669)' }}>
                  {user.username?.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs text-slate-500">{user.username}</span>
              </div>
              <button onClick={onLogout}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-red-500/70 hover:text-red-400 transition-colors font-mono"
                style={{ border: '1px solid rgba(239,68,68,0.15)' }}>
                <ArrowLeft size={12} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Page Content ── */}
      <div className="max-w-7xl mx-auto px-6 pt-7 pb-10">

        {/* Hero row */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono text-emerald-600/70 tracking-widest uppercase">Health Check Suite</span>
          </div>
          <div className="flex items-end justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-black text-white">Smoke Testing</h1>
              <p className="text-sm text-slate-500 mt-0.5">Quick go/no-go health checks for critical API endpoints before every deploy.</p>
            </div>
            {/* Quick stat badges */}
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Fast Execution', sub: '< 30s',      color: '#22c55e' },
                { label: 'Critical Checks', sub: 'must-pass',  color: '#3b82f6' },
                { label: 'Deploy Gate',     sub: 'pass/fail',  color: '#a855f7' },
              ].map(b => (
                <div key={b.label} className="rounded-lg px-3 py-1.5 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <div className="text-[10px] font-bold font-mono" style={{ color: b.color }}>{b.sub}</div>
                  <div className="text-[9px] text-slate-600 mt-0.5">{b.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Main grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,400px] gap-5">

          {/* ─── LEFT: Config ─── */}
          <div className="space-y-4">

            {/* Presets */}
            <div style={card}>
              <div className="px-5 py-3.5 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <Globe size={14} className="text-emerald-500" />
                <span className="text-xs font-bold text-slate-300">Quick Presets</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-2.5">
                <button onClick={() => loadPreset('api')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono transition-all hover:text-emerald-300"
                  style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.20)', color: '#4ade80' }}>
                  <Server size={13} /> REST API
                </button>
                <button onClick={() => loadPreset('microservices')}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-mono transition-all hover:text-blue-300"
                  style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.20)', color: '#60a5fa' }}>
                  <Database size={13} /> Microservices
                </button>
              </div>
            </div>

            {/* AI Generate */}
            <div style={card}>
              <div className="px-5 py-3.5 flex items-center gap-2.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="text-sm">✦</span>
                <span className="text-xs font-bold text-slate-300">AI Generate from Description</span>
                <span className="text-[9px] font-mono px-2 py-0.5 rounded-full ml-auto"
                  style={{ background: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}>
                  GPT-4
                </span>
              </div>
              <div className="p-4 flex gap-2">
                <input type="text" value={nlTestInput} onChange={e => setNlTestInput(e.target.value)}
                  onKeyPress={e => e.key === 'Enter' && handleGenerateFromNL()}
                  placeholder='"Check if auth endpoint returns 200"'
                  disabled={nlGenerating}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button onClick={handleGenerateFromNL} disabled={nlGenerating || !nlTestInput.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono transition-all flex-shrink-0"
                  style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.30)', color: '#c084fc', opacity: (!nlTestInput.trim() || nlGenerating) ? 0.4 : 1 }}>
                  {nlGenerating ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : '✦'}
                  {nlGenerating ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>

            {/* Endpoint Form */}
            <div style={card}>
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2.5">
                  <Plus size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-slate-300">
                    {editingEndpoint !== null ? 'Edit Endpoint' : 'Add Endpoint'}
                  </span>
                </div>
                {editingEndpoint !== null && (
                  <button onClick={() => { setEditingEndpoint(null); setEndpointForm({ name:'',url:'',method:'GET',maxTime:2000,critical:true,headers:'',expectedStatus:200 }); }}
                    className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors">cancel</button>
                )}
              </div>
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label style={labelStyle}>Endpoint Name *</label>
                    <input value={endpointForm.name} onChange={e => setEndpointForm({...endpointForm, name: e.target.value})}
                      placeholder="e.g., Health Check" style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>URL *</label>
                    <input value={endpointForm.url} onChange={e => setEndpointForm({...endpointForm, url: e.target.value})}
                      placeholder="https://api.example.com/health" style={inputStyle} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label style={labelStyle}>Method</label>
                    <select value={endpointForm.method} onChange={e => setEndpointForm({...endpointForm, method: e.target.value})}
                      style={{ ...inputStyle, cursor: 'pointer' }}>
                      {['GET','POST','PUT','DELETE','HEAD'].map(m => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>Expected Status</label>
                    <input type="number" value={endpointForm.expectedStatus}
                      onChange={e => setEndpointForm({...endpointForm, expectedStatus: parseInt(e.target.value)})} style={inputStyle} />
                  </div>
                  <div>
                    <label style={labelStyle}>Max Time (ms)</label>
                    <input type="number" value={endpointForm.maxTime}
                      onChange={e => setEndpointForm({...endpointForm, maxTime: parseInt(e.target.value)})} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Custom Headers (JSON)</label>
                  <textarea value={endpointForm.headers} onChange={e => setEndpointForm({...endpointForm, headers: e.target.value})}
                    placeholder='{"Authorization": "Bearer token"}' rows={2}
                    style={{ ...inputStyle, resize: 'none', fontFamily: 'monospace' }} />
                </div>
                <div className="flex items-center gap-2.5">
                  <div
                    onClick={() => setEndpointForm({...endpointForm, critical: !endpointForm.critical})}
                    className="w-4 h-4 rounded cursor-pointer flex items-center justify-center flex-shrink-0"
                    style={{ background: endpointForm.critical ? 'rgba(239,68,68,0.20)' : 'rgba(255,255,255,0.04)', border: `1px solid ${endpointForm.critical ? 'rgba(239,68,68,0.50)' : 'rgba(255,255,255,0.12)'}` }}>
                    {endpointForm.critical && <div className="w-2 h-2 rounded-sm bg-red-400" />}
                  </div>
                  <span className="text-xs text-slate-500">Critical endpoint — failure blocks deployment</span>
                </div>
                <button onClick={handleSaveEndpoint}
                  className="w-full py-2.5 rounded-lg text-sm font-bold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg,#16a34a,#059669)', boxShadow: '0 4px 16px rgba(34,197,94,0.25)' }}>
                  {editingEndpoint !== null ? 'Update Endpoint' : 'Save Endpoint'}
                </button>
              </div>
            </div>

            {/* Endpoint List + Run */}
            <div style={card}>
              <div className="px-5 py-3.5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2.5">
                  <Activity size={14} className="text-emerald-500" />
                  <span className="text-xs font-bold text-slate-300">Endpoints</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(34,197,94,0.10)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.20)' }}>
                    {validCount} ready
                  </span>
                </div>
              </div>
              <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
                {endpoints.map(ep => (
                  <div key={ep.id} className="flex items-start gap-3 rounded-lg px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <span className="text-[10px] font-black font-mono px-1.5 py-0.5 rounded"
                        style={{ background: methodColor(ep.method) + '20', color: methodColor(ep.method) }}>
                        {ep.method}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-300 truncate">{ep.name}</span>
                        {ep.critical && (
                          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0"
                            style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)' }}>
                            CRITICAL
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                        {ep.url || <span style={{ color: '#f97316' }}>No URL set</span>}
                      </div>
                      <div className="text-[9px] font-mono text-slate-700 mt-0.5">
                        max {ep.maxTime}ms · expect {ep.expectedStatus}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleEditEndpoint(ep)}
                        className="p-1.5 rounded text-slate-600 hover:text-slate-300 transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Edit3 size={11} />
                      </button>
                      <button onClick={() => handleDeleteEndpoint(ep.id)}
                        className="p-1.5 rounded text-slate-600 hover:text-red-400 transition-colors"
                        style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              {isRunning && (
                <div className="px-4 pb-2">
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <div className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#22c55e,#10b981)' }} />
                  </div>
                  <div className="text-[10px] font-mono text-slate-700 text-right mt-1">{progress.toFixed(0)}%</div>
                </div>
              )}

              <div className="px-4 pb-4">
                <button onClick={runSmokeTests}
                  disabled={isRunning || validCount === 0}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: (isRunning || validCount === 0) ? 'rgba(255,255,255,0.04)' : 'linear-gradient(135deg,#16a34a,#059669)',
                    opacity: (isRunning || validCount === 0) ? 0.5 : 1,
                    boxShadow: (isRunning || validCount === 0) ? 'none' : '0 4px 20px rgba(34,197,94,0.30)',
                  }}>
                  {isRunning
                    ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Running Tests…</>
                    : <><Play size={15} /> Run Smoke Tests</>
                  }
                </button>
              </div>
            </div>
          </div>

          {/* ─── RIGHT: Results / Logs / History ─── */}
          <div className="lg:sticky lg:top-20 self-start">
            <div style={card}>
              {/* Tab bar */}
              <div className="flex items-center gap-0 px-4 pt-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { id: 'results', label: 'Results' },
                  { id: 'logs',    label: `Logs ${logs.length > 0 ? `(${logs.length})` : ''}` },
                  { id: 'history', label: 'History' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className="px-4 py-2 text-xs font-mono transition-all"
                    style={{
                      color: activeTab === tab.id ? '#4ade80' : '#334155',
                      borderBottom: activeTab === tab.id ? '2px solid #22c55e' : '2px solid transparent',
                      marginBottom: -1,
                    }}>
                    {tab.label}
                  </button>
                ))}
                {results && (
                  <button onClick={() => setShowGitHub(true)}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono mb-2 transition-all hover:text-slate-200"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#64748b' }}>
                    <Github size={12} /> GitHub
                  </button>
                )}
              </div>

              {/* ── Results Tab ── */}
              {activeTab === 'results' && (
                <div className="p-4 space-y-4">
                  {!results ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                        <Zap size={22} style={{ color: 'rgba(34,197,94,0.30)' }} />
                      </div>
                      <p className="text-xs font-mono text-slate-700">configure endpoints and run tests</p>
                    </div>
                  ) : (
                    <>
                      {/* Gate decision */}
                      <div className="rounded-xl px-5 py-4 flex items-center gap-4"
                        style={{ background: overallColor + '0D', border: `1px solid ${overallColor}30` }}>
                        <div>
                          {results.overallStatus === 'PASS'
                            ? <CheckCircle size={28} style={{ color: overallColor }} />
                            : results.overallStatus === 'CRITICAL_FAIL'
                            ? <XCircle size={28} style={{ color: overallColor }} />
                            : <AlertTriangle size={28} style={{ color: overallColor }} />
                          }
                        </div>
                        <div>
                          <div className="text-sm font-black" style={{ color: overallColor }}>
                            {results.overallStatus === 'PASS' ? 'All Tests Passed'
                              : results.overallStatus === 'CRITICAL_FAIL' ? 'Critical Failure'
                              : 'Some Tests Failed'}
                          </div>
                          <div className="text-[10px] font-mono text-slate-600 mt-0.5">
                            {results.overallStatus === 'PASS' ? 'System is healthy — deploy ready'
                              : results.overallStatus === 'CRITICAL_FAIL' ? 'Critical endpoints failed — block deploy'
                              : 'Non-critical failures — review before deploy'}
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="text-lg font-black font-mono" style={{ color: overallColor }}>{results.passRate}%</div>
                          <div className="text-[9px] font-mono text-slate-700">pass rate</div>
                        </div>
                      </div>

                      {/* Stat grid */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {[
                          { label: 'Passed',       value: results.passed,          color: '#22c55e' },
                          { label: 'Failed',        value: results.failed,          color: '#ef4444' },
                          { label: 'Total Time',    value: `${results.totalTime}s`, color: '#3b82f6' },
                          { label: 'Avg Response',  value: `${results.avgResponseTime}ms`, color: '#a855f7' },
                        ].map(s => (
                          <div key={s.label} className="rounded-lg px-3 py-3"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <div className="text-base font-black font-mono" style={{ color: s.color }}>{s.value}</div>
                            <div className="text-[9px] text-slate-700 mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Individual tests */}
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {results.tests.map((test, i) => (
                          <div key={i} className="rounded-lg px-3 py-2.5"
                            style={{
                              background: test.passed ? 'rgba(34,197,94,0.05)' : test.critical ? 'rgba(239,68,68,0.05)' : 'rgba(245,158,11,0.05)',
                              border: `1px solid ${test.passed ? 'rgba(34,197,94,0.18)' : test.critical ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'}`,
                            }}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ background: test.passed ? '#22c55e' : test.critical ? '#ef4444' : '#f59e0b' }} />
                                <span className="text-xs font-semibold text-slate-300 truncate">{test.name}</span>
                                {test.critical && !test.passed && (
                                  <span className="text-[9px] font-mono flex-shrink-0 px-1.5 rounded"
                                    style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>CRIT</span>
                                )}
                              </div>
                              <span className="text-[10px] font-mono flex-shrink-0" style={{ color: test.passed ? '#22c55e' : '#ef4444' }}>
                                {test.responseTime}ms
                              </span>
                            </div>
                            <div className="text-[10px] font-mono text-slate-600 mt-1 truncate">
                              <span style={{ color: methodColor(test.method) }}>{test.method}</span> {test.url}
                            </div>
                            <div className="text-[10px] font-mono mt-0.5" style={{ color: test.passed ? '#4ade80' : '#f87171' }}>
                              {test.message}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Logs Tab (terminal) ── */}
              {activeTab === 'logs' && (
                <div className="font-mono text-xs" style={{ background: 'rgba(4,7,15,0.95)' }}>
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b"
                    style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.25)' }}>
                    <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
                    <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
                    <div className="w-2 h-2 rounded-full bg-[#28c840]" />
                    <span className="ml-2 text-[9px] tracking-wider text-slate-700">smoke / test-log</span>
                  </div>
                  <div className="p-4 overflow-y-auto space-y-0.5" style={{ maxHeight: 480 }}>
                    {logs.length === 0 ? (
                      <div className="text-slate-800 py-12 text-center">$ awaiting test run...</div>
                    ) : (
                      logs.map((log, i) => (
                        <div key={i} className="leading-relaxed">
                          <span style={{ color: '#1e293b' }}>[{log.timestamp}]</span>
                          {' '}
                          <span style={{ color: logColor(log.type) }}>{log.message}</span>
                        </div>
                      ))
                    )}
                    <div ref={logsEndRef} />
                    {isRunning && (
                      <div className="flex items-center gap-1 mt-1">
                        <span style={{ color: '#22c55e60' }}>$</span>
                        <span className="inline-block w-1.5 h-3 ml-0.5 animate-pulse" style={{ background: '#334155' }} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── History Tab ── */}
              {activeTab === 'history' && (
                <div className="p-4">
                  <RecentRuns module="smoke" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* GitHub modal */}
      {showGitHub && results && (
        <GitHubIntegration user={user}
          testResults={{
            summary: { total: results.totalTests, passed: results.passed, failed: results.failed, pass_rate: parseFloat(results.passRate) },
            results: [{ test: `Smoke Test Suite - ${results.overallStatus}`, status: results.overallStatus === 'PASS' ? 'PASS' : 'FAIL',
              details: `${results.totalTests} endpoints | Pass: ${results.passRate}% | Avg: ${results.avgResponseTime}ms | Time: ${results.totalTime}s`,
              timestamp: results.timestamp,
              smokeMetrics: { ...results } }]
          }}
          apiUrl="Smoke Tests"
          onClose={() => setShowGitHub(false)}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default SmokeTestingApp;
