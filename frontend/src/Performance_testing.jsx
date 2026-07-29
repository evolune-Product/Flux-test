import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, Zap, TrendingUp, AlertCircle, Clock, Users, Target, Repeat,
  Github, FileText, BarChart3, Settings, Loader, Play, StopCircle, User,
} from 'lucide-react';
import BackButton from './BackButton';
import GitHubIntegration from './GitHubIntegration.jsx';
import { saveTestRun } from './testHistoryUtils.js';
import RecentRuns from './RecentRuns.jsx';

const PerformanceTestingApp = () => {
  const navigate = useNavigate();
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [testType, setTestType] = useState('response-time');
  const [httpMethod, setHttpMethod] = useState('GET');
  const [requestBody, setRequestBody] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showGitHub, setShowGitHub] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [configTab, setConfigTab] = useState('basic');
  const abortControllerRef = useRef(null);
  const cancelledRef = useRef(false);

  // Get user from localStorage for GitHub integration
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Test configurations
  const testConfigs = {
    'response-time': {
      name: 'Response Time',
      icon: Clock,
      requests: 100,
      concurrency: 1,
      description: 'Measures avg, P95, and P99 response times',
      color: '#60a5fa',
    },
    'load-100': {
      name: 'Load — 100 Users',
      icon: Users,
      requests: 1000,
      concurrency: 100,
      description: 'Simulates 100 concurrent users',
      color: '#34d399',
    },
    'load-1000': {
      name: 'Load — 1,000 Users',
      icon: Users,
      requests: 10000,
      concurrency: 1000,
      description: 'Simulates 1,000 concurrent users',
      color: '#a78bfa',
    },
    'stress': {
      name: 'Stress Test',
      icon: AlertCircle,
      requests: 5000,
      concurrency: 500,
      description: 'Finds the breaking point of your API',
      color: '#f87171',
    },
    'spike': {
      name: 'Spike Test',
      icon: TrendingUp,
      requests: 2000,
      concurrency: 1000,
      description: 'Sudden traffic surge (10 → 10,000 users)',
      color: '#fb923c',
    },
    'endurance': {
      name: 'Endurance Test',
      icon: Repeat,
      requests: 10000,
      concurrency: 50,
      description: 'Long-running test for memory leaks',
      color: '#fbbf24',
    }
  };

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('performanceTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.apiEndpoint) setApiEndpoint(state.apiEndpoint);
        if (state.testType) setTestType(state.testType);
        if (state.httpMethod) setHttpMethod(state.httpMethod);
        if (state.requestBody) setRequestBody(state.requestBody);
        if (state.customHeaders) setCustomHeaders(state.customHeaders);
        if (state.results) setResults(state.results);
      } catch (e) {
        console.error('Failed to load saved Performance Testing state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    const stateToSave = { apiEndpoint, testType, httpMethod, requestBody, customHeaders, results, savedAt: new Date().toISOString() };
    localStorage.setItem('performanceTestingState', JSON.stringify(stateToSave));
  }, [apiEndpoint, testType, httpMethod, requestBody, customHeaders, results]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const makeRequest = async (url, cancelSignal) => {
    const startTime = performance.now();
    let responseSize = 0;

    // Per-request timeout controller, independent of the global cancel controller
    const perRequestController = new AbortController();
    const timeoutId = setTimeout(() => perRequestController.abort(), 10000);

    // Forward global cancellation to this request's controller
    const onGlobalCancel = () => perRequestController.abort();
    cancelSignal.addEventListener('abort', onGlobalCancel);

    try {
      let headers = { 'Content-Type': 'application/json' };
      if (customHeaders) {
        try {
          const parsedHeaders = JSON.parse(customHeaders);
          headers = { ...headers, ...parsedHeaders };
        } catch (e) { /* ignore */ }
      }

      const options = { method: httpMethod, mode: 'cors', headers, signal: perRequestController.signal };

      if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && requestBody) {
        try {
          options.body = JSON.stringify(JSON.parse(requestBody));
        } catch (e) {
          options.body = requestBody;
        }
      }

      const response = await fetch(url, options);
      clearTimeout(timeoutId);
      cancelSignal.removeEventListener('abort', onGlobalCancel);

      const responseText = await response.text();
      responseSize = new Blob([responseText]).size;
      const endTime = performance.now();

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration: endTime - startTime,
        size: responseSize
      };
    } catch (error) {
      clearTimeout(timeoutId);
      cancelSignal.removeEventListener('abort', onGlobalCancel);
      const endTime = performance.now();
      // Distinguish user-cancelled vs per-request timeout
      const isCancelled = cancelSignal.aborted;
      return {
        success: false,
        status: 0,
        statusText: error.name === 'AbortError' ? (isCancelled ? 'Cancelled' : 'Timeout') : 'Network Error',
        duration: endTime - startTime,
        error: error.name === 'AbortError' ? (isCancelled ? 'Request cancelled' : 'Request timeout') : error.message,
        size: 0
      };
    }
  };

  const calculateStats = (durations) => {
    if (!durations || durations.length === 0) return { avg: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    const sorted = [...durations].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      avg: sum / sorted.length,
      min: sorted[0] || 0,
      max: sorted[sorted.length - 1] || 0,
      p50: sorted[Math.floor(sorted.length * 0.50)] || 0,
      p95: sorted[Math.floor(sorted.length * 0.95)] || 0,
      p99: sorted[Math.floor(sorted.length * 0.99)] || 0,
    };
  };

  const cancelTest = () => {
    cancelledRef.current = true;
    if (abortControllerRef.current) abortControllerRef.current.abort();
  };

  const runPerformanceTest = async () => {
    if (!apiEndpoint) { addLog('Please enter an API endpoint', 'error'); return; }

    setIsRunning(true);
    setProgress(0);
    setResults(null);
    setLogs([]);
    cancelledRef.current = false;
    abortControllerRef.current = new AbortController();
    const { signal } = abortControllerRef.current;

    const config = testConfigs[testType];
    addLog(`Starting ${config.name}…`, 'info');
    addLog(`${config.requests} requests @ ${config.concurrency} concurrency`, 'info');

    const startTime = Date.now();
    const allResults = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      const batches = Math.ceil(config.requests / config.concurrency);

      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(config.concurrency, config.requests - batch * config.concurrency);
        const promises = [];
        for (let i = 0; i < batchSize; i++) promises.push(makeRequest(apiEndpoint, signal));

        const batchResults = await Promise.all(promises);

        if (cancelledRef.current) {
          addLog('Test cancelled by user.', 'warning');
          setIsRunning(false);
          setProgress(0);
          return;
        }

        batchResults.forEach(result => {
          allResults.push(result);
          if (result.success) successCount++; else failureCount++;
        });

        setProgress(((batch + 1) / batches) * 100);
        addLog(`Batch ${batch + 1}/${batches} — ${batchResults.length} requests`, 'success');
      }

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;
      const respondedDurations = allResults.filter(r => r.status > 0).map(r => r.duration);
      const durationsForStats = respondedDurations.length > 0 ? respondedDurations : allResults.map(r => r.duration);
      const stats = calculateStats(durationsForStats);
      const throughput = config.requests / totalDuration;
      const totalSize = allResults.reduce((sum, r) => sum + (r.size || 0), 0);
      const errorTypes = {};
      allResults.filter(r => !r.success).forEach(r => {
        const k = r.error || `HTTP ${r.status}`;
        errorTypes[k] = (errorTypes[k] || 0) + 1;
      });

      const finalResults = {
        totalRequests: config.requests,
        successCount,
        failureCount,
        successRate: ((successCount / config.requests) * 100).toFixed(2),
        totalDuration: totalDuration.toFixed(2),
        throughput: throughput.toFixed(2),
        totalDataTransferred: (totalSize / 1024).toFixed(2),
        avgResponseSize: ((totalSize / allResults.length) / 1024).toFixed(2),
        errorTypes,
        hasValidStats: respondedDurations.length > 0,
        stats: {
          avg: stats.avg.toFixed(2), min: stats.min.toFixed(2), max: stats.max.toFixed(2),
          p50: stats.p50.toFixed(2), p95: stats.p95.toFixed(2), p99: stats.p99.toFixed(2),
        }
      };

      setResults(finalResults);
      saveTestRun({
        module: 'performance', apiUrl: apiEndpoint,
        totalTests: finalResults.totalRequests, passed: finalResults.successCount,
        failed: finalResults.failureCount, durationMs: Math.round(totalDuration * 1000),
        overallStatus: finalResults.failureCount === 0 ? 'PASS' : 'FAIL'
      });
      addLog(`Completed — ${totalDuration.toFixed(2)}s | ${throughput.toFixed(2)} req/s`, 'success');
      if (!respondedDurations.length) {
        addLog('All requests failed at network level. Check URL and CORS.', 'error');
      } else {
        addLog(`Avg: ${stats.avg.toFixed(0)}ms | P95: ${stats.p95.toFixed(0)}ms | P99: ${stats.p99.toFixed(0)}ms`, 'info');
      }
    } catch (error) {
      addLog(`Test failed: ${error.message}`, 'error');
    }

    setIsRunning(false);
    setProgress(100);
  };

  const getStatusColor = (value, thresholds) => {
    if (value < thresholds.good) return '#34d399';
    if (value < thresholds.warning) return '#fbbf24';
    return '#f87171';
  };

  // ─── Design tokens ────────────────────────────────────────────────
  const BLUE = '#60a5fa';
  const BLUE_DIM = 'rgba(96,165,250,0.12)';

  const card = {
    background: 'rgba(9,12,22,0.80)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    backdropFilter: 'blur(20px)',
  };
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  };
  const logColor = (type) => {
    if (type === 'error')   return { color: '#f87171' };
    if (type === 'warning') return { color: '#fbbf24' };
    if (type === 'success') return { color: '#34d399' };
    return { color: BLUE };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#020408 0%,#060c18 50%,#020408 100%)',
      color: '#e2e8f0',
      fontFamily: '"Inter","SF Pro Display",system-ui,sans-serif',
      position: 'relative',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(96,165,250,0.09) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Sticky Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(2,4,8,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BackButton />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg,#2563eb,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(96,165,250,0.35)',
            }}>
              <Zap size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', letterSpacing: '-0.01em' }}>
                Performance Testing
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
                Load, stress &amp; endurance analysis
              </div>
            </div>
          </div>
        </div>
        {user?.username && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 14px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 8, fontSize: 15, color: 'rgba(255,255,255,0.85)',
          }}>
            <User size={15} /> {user.username}
          </div>
        )}
      </div>

      {/* ── Page body ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '36px 32px 60px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: BLUE_DIM, color: BLUE,
              border: `1px solid rgba(96,165,250,0.25)`, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Performance Suite</span>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)',
              border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.06em',
            }}>
              {testConfigs[testType].name}
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>
            Performance Testing Dashboard
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14, margin: 0 }}>
            Comprehensive load, stress, spike, and endurance API performance analysis.
          </p>

          {/* Quick stats */}
          {results && (
            <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'Success Rate', value: `${results.successRate}%`, color: parseFloat(results.successRate) >= 99 ? '#34d399' : '#fbbf24' },
                { label: 'Throughput',   value: `${results.throughput} req/s`, color: BLUE },
                { label: 'Avg',          value: `${results.stats.avg}ms`, color: getStatusColor(parseFloat(results.stats.avg), { good: 200, warning: 500 }) },
                { label: 'P95',          value: `${results.stats.p95}ms`, color: getStatusColor(parseFloat(results.stats.p95), { good: 500, warning: 1000 }) },
              ].map(s => (
                <div key={s.label} style={{
                  padding: '8px 18px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10, fontSize: 13,
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.40)' }}>{s.label}: </span>
                  <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 2-col layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* ═══ LEFT: Config ═══ */}
          <div style={{ ...card, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: BLUE_DIM,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Settings size={14} color={BLUE} />
              </div>
              <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>Configuration</span>
            </div>

            {/* Tab bar */}
            <div style={{
              display: 'flex', gap: 4, marginBottom: 22,
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 10, padding: 4,
            }}>
              {[
                { key: 'basic',    label: 'Basic',     accent: BLUE },
                { key: 'testtype', label: 'Test Type', accent: '#a78bfa' },
                { key: 'request',  label: 'Request',   accent: '#34d399' },
              ].map(t => (
                <button key={t.key} onClick={() => setConfigTab(t.key)} style={{
                  flex: 1, padding: '7px 0', borderRadius: 7, fontSize: 13, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.18s',
                  background: configTab === t.key ? 'rgba(255,255,255,0.07)' : 'transparent',
                  color: configTab === t.key ? t.accent : 'rgba(255,255,255,0.35)',
                }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ─ Basic tab ─ */}
            {configTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>API Endpoint *</label>
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>HTTP Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value)}
                    disabled={isRunning}
                    style={{ ...inputStyle, cursor: isRunning ? 'not-allowed' : 'pointer' }}
                  >
                    {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                      <option key={m} value={m} style={{ background: '#0a0e1a' }}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Selected test info */}
                <div style={{
                  padding: '14px 16px', borderRadius: 10,
                  background: `rgba(${testConfigs[testType].color.slice(1).match(/../g).map(h => parseInt(h,16)).join(',')},0.08)`,
                  border: `1px solid ${testConfigs[testType].color}30`,
                }}>
                  <div style={{ fontWeight: 700, color: testConfigs[testType].color, fontSize: 13, marginBottom: 4 }}>
                    {testConfigs[testType].name}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
                    {testConfigs[testType].description}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 6, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                    {testConfigs[testType].requests.toLocaleString()} requests @ {testConfigs[testType].concurrency} concurrency
                  </div>
                </div>
              </div>
            )}

            {/* ─ Test Type tab ─ */}
            {configTab === 'testtype' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                {Object.entries(testConfigs).map(([key, config]) => {
                  const Icon = config.icon;
                  const isActive = testType === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setTestType(key)}
                      disabled={isRunning}
                      style={{
                        width: '100%', padding: '12px 14px', borderRadius: 10,
                        cursor: isRunning ? 'not-allowed' : 'pointer', textAlign: 'left',
                        background: isActive ? `${config.color}18` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isActive ? config.color + '45' : 'rgba(255,255,255,0.07)'}`,
                        display: 'flex', alignItems: 'center', gap: 12,
                        opacity: isRunning ? 0.5 : 1, transition: 'all 0.18s',
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isActive ? `${config.color}20` : 'rgba(255,255,255,0.04)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <Icon size={14} color={isActive ? config.color : 'rgba(255,255,255,0.35)'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? config.color : '#e2e8f0' }}>
                          {config.name}
                        </div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                          {config.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* ─ Request tab ─ */}
            {configTab === 'request' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                {['POST','PUT','PATCH'].includes(httpMethod) && (
                  <div>
                    <label style={labelStyle}>Request Body (JSON)</label>
                    <textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      placeholder='{"key": "value"}'
                      disabled={isRunning}
                      rows={6}
                      style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                    />
                  </div>
                )}
                <div>
                  <label style={labelStyle}>Custom Headers (JSON) — optional</label>
                  <textarea
                    value={customHeaders}
                    onChange={(e) => setCustomHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer token"}'
                    disabled={isRunning}
                    rows={5}
                    style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* Run + Cancel */}
            <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
              <button
                onClick={runPerformanceTest}
                disabled={isRunning || !apiEndpoint}
                style={{
                  flex: 1, padding: '13px 0',
                  borderRadius: 10, fontWeight: 700, fontSize: 14,
                  border: 'none', cursor: isRunning || !apiEndpoint ? 'not-allowed' : 'pointer',
                  background: isRunning || !apiEndpoint
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg,#2563eb,#7c3aed)',
                  color: isRunning || !apiEndpoint ? 'rgba(255,255,255,0.30)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: isRunning || !apiEndpoint ? 'none' : '0 0 24px rgba(37,99,235,0.35)',
                  transition: 'all 0.2s',
                }}
              >
                {isRunning
                  ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Running… {progress.toFixed(0)}%</>
                  : <><Play size={16} /> Start Test</>
                }
              </button>
              {isRunning && (
                <button
                  onClick={cancelTest}
                  style={{
                    padding: '13px 18px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                    border: 'none', cursor: 'pointer',
                    background: 'rgba(248,113,113,0.15)',
                    border: '1px solid rgba(248,113,113,0.30)',
                    color: '#f87171',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <StopCircle size={14} /> Stop
                </button>
              )}
            </div>

            {isRunning && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                  <span>Running performance test…</span>
                  <span>{progress.toFixed(0)}%</span>
                </div>
                <div style={{ width: '100%', height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 4,
                    background: 'linear-gradient(90deg,#2563eb,#7c3aed)',
                    width: `${progress}%`, transition: 'width 0.3s ease',
                  }} />
                </div>
              </div>
            )}
          </div>

          {/* ═══ RIGHT: Results / Logs / History ═══ */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', position: 'sticky', top: 76 }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 22px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { key: 'results', label: 'Results',       accent: BLUE },
                  { key: 'logs',    label: `Logs (${logs.length})`, accent: '#34d399' },
                  { key: 'history', label: 'History',       accent: '#fbbf24' },
                ].map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    padding: '6px 14px', borderRadius: 7, fontSize: 13, fontWeight: 600,
                    border: 'none', cursor: 'pointer', transition: 'all 0.18s',
                    background: activeTab === t.key ? 'rgba(255,255,255,0.07)' : 'transparent',
                    color: activeTab === t.key ? t.accent : 'rgba(255,255,255,0.35)',
                  }}>
                    {t.label}
                  </button>
                ))}
              </div>
              {results && (
                <button
                  onClick={() => setShowGitHub(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.10)',
                    color: 'rgba(255,255,255,0.60)', cursor: 'pointer',
                  }}
                >
                  <Github size={13} /> Save
                </button>
              )}
            </div>

            <div style={{ padding: 22, maxHeight: 640, overflowY: 'auto' }}>

              {/* ─ Results Tab ─ */}
              {activeTab === 'results' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {!results ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.20)' }}>
                      <BarChart3 size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.20 }} />
                      <p style={{ margin: 0, fontSize: 14 }}>Run a performance test to see results</p>
                    </div>
                  ) : (
                    <>
                      {/* Top 4 stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Total Requests', value: results.totalRequests.toLocaleString(), color: '#e2e8f0', bg: 'rgba(255,255,255,0.03)' },
                          { label: 'Success Rate',   value: `${results.successRate}%`, color: parseFloat(results.successRate) >= 99 ? '#34d399' : '#fbbf24', bg: 'rgba(52,211,153,0.05)' },
                          { label: 'Duration',       value: `${results.totalDuration}s`, color: BLUE, bg: BLUE_DIM },
                          { label: 'Throughput',     value: `${results.throughput} req/s`, color: '#a78bfa', bg: 'rgba(167,139,250,0.08)' },
                        ].map(c => (
                          <div key={c.label} style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: c.bg, border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{c.label}</div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>{c.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Additional metrics */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {[
                          { label: 'Total Data',   value: `${results.totalDataTransferred} KB` },
                          { label: 'Avg Size',     value: `${results.avgResponseSize} KB` },
                          { label: 'Failures',     value: results.failureCount, color: results.failureCount > 0 ? '#f87171' : '#34d399' },
                        ].map(m => (
                          <div key={m.label} style={{
                            padding: '12px 14px', borderRadius: 9,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: m.color || '#e2e8f0', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>{m.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Error distribution */}
                      {results.failureCount > 0 && Object.keys(results.errorTypes).length > 0 && (
                        <div style={{
                          padding: '14px 16px', borderRadius: 10,
                          background: 'rgba(248,113,113,0.07)',
                          border: '1px solid rgba(248,113,113,0.20)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 10 }}>Error Distribution</div>
                          {Object.entries(results.errorTypes).map(([error, count]) => (
                            <div key={error} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                              <span style={{ color: 'rgba(255,255,255,0.55)' }}>{error}</span>
                              <span style={{ color: '#f87171', fontWeight: 700 }}>{count}×</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Response time stats */}
                      <div style={{
                        padding: '16px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
                          Response Time Statistics (ms)
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                          {[
                            { label: 'Average', value: results.stats.avg, thresholds: { good: 200, warning: 500 } },
                            { label: 'Min',     value: results.stats.min, color: '#34d399' },
                            { label: 'Max',     value: results.stats.max, color: '#f87171' },
                            { label: 'P50',     value: results.stats.p50, color: '#e2e8f0' },
                            { label: 'P95',     value: results.stats.p95, thresholds: { good: 500, warning: 1000 } },
                            { label: 'P99',     value: results.stats.p99, thresholds: { good: 1000, warning: 2000 } },
                          ].map(s => (
                            <div key={s.label}>
                              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                              <div style={{
                                fontSize: 16, fontWeight: 700,
                                color: s.color || getStatusColor(parseFloat(s.value), s.thresholds),
                              }}>
                                {s.value}ms
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Assessment */}
                      <div style={{
                        padding: '14px 16px', borderRadius: 10,
                        background: !results.hasValidStats ? 'rgba(248,113,113,0.07)' : BLUE_DIM,
                        border: `1px solid ${!results.hasValidStats ? 'rgba(248,113,113,0.20)' : 'rgba(96,165,250,0.25)'}`,
                        fontSize: 13, lineHeight: 1.8,
                      }}>
                        <div style={{ fontWeight: 700, color: BLUE, marginBottom: 6, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Performance Assessment</div>
                        {!results.hasValidStats ? (
                          <div style={{ color: '#f87171' }}>All requests failed at network level — check URL and CORS settings.</div>
                        ) : (
                          <ul style={{ margin: 0, paddingLeft: 16, color: 'rgba(255,255,255,0.55)' }}>
                            <li style={{ color: getStatusColor(parseFloat(results.stats.avg), { good: 200, warning: 500 }) }}>
                              Avg {results.stats.avg}ms — {parseFloat(results.stats.avg) < 200 ? 'Excellent' : parseFloat(results.stats.avg) < 500 ? 'Good' : 'Needs Optimization'}
                            </li>
                            <li style={{ color: getStatusColor(parseFloat(results.stats.p95), { good: 500, warning: 1000 }) }}>
                              P95 {results.stats.p95}ms — {parseFloat(results.stats.p95) < 500 ? 'Excellent' : parseFloat(results.stats.p95) < 1000 ? 'Good' : 'Needs Optimization'}
                            </li>
                            <li style={{ color: getStatusColor(parseFloat(results.stats.p99), { good: 1000, warning: 2000 }) }}>
                              P99 {results.stats.p99}ms — {parseFloat(results.stats.p99) < 1000 ? 'Excellent' : parseFloat(results.stats.p99) < 2000 ? 'Good' : 'Needs Optimization'}
                            </li>
                          </ul>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ─ Logs Tab ─ */}
              {activeTab === 'logs' && (
                <div style={{
                  background: '#050810',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, overflow: 'hidden',
                }}>
                  <div style={{
                    padding: '9px 14px',
                    background: 'rgba(255,255,255,0.03)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 7,
                  }}>
                    {['#ff5f57','#febc2e','#28c840'].map(c => (
                      <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.85 }} />
                    ))}
                    <span style={{ marginLeft: 8, fontSize: 11, color: 'rgba(255,255,255,0.25)', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                      performance.log — {logs.length} entries
                    </span>
                  </div>
                  <div style={{ padding: 14, maxHeight: 500, overflowY: 'auto', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                    {logs.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.20)', padding: '40px 0' }}>No log entries yet</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {logs.map((log, i) => (
                          <div key={i} style={{ display: 'flex', gap: 10, lineHeight: 1.5 }}>
                            <span style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>{log.timestamp}</span>
                            <span style={logColor(log.type)}>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─ History Tab ─ */}
              {activeTab === 'history' && (
                <div style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: 16,
                }}>
                  <RecentRuns module="performance" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* GitHub Integration Modal */}
      {showGitHub && results && (
        <GitHubIntegration
          user={user}
          testResults={{
            summary: {
              total: 1,
              passed: results.successCount > 0 ? 1 : 0,
              failed: results.failureCount > 0 ? 1 : 0,
              pass_rate: parseFloat(results.successRate)
            },
            results: [{
              test: `Performance Test — ${testConfigs[testType].name}`,
              status: results.successRate >= 95 ? 'PASS' : 'FAIL',
              details: `${results.totalRequests} requests | Success: ${results.successRate}% | Avg: ${results.stats.avg}ms | P95: ${results.stats.p95}ms | Throughput: ${results.throughput} req/s`,
              timestamp: new Date().toISOString(),
              performanceMetrics: {
                totalRequests: results.totalRequests,
                successCount: results.successCount,
                failureCount: results.failureCount,
                successRate: results.successRate,
                totalDuration: results.totalDuration,
                throughput: results.throughput,
                totalDataTransferred: results.totalDataTransferred,
                avgResponseSize: results.avgResponseSize,
                stats: results.stats,
                errorTypes: results.errorTypes,
                testType: testType,
                testConfig: testConfigs[testType]
              }
            }]
          }}
          apiUrl={apiEndpoint}
          onClose={() => setShowGitHub(false)}
        />
      )}
    </div>
  );
};

export default PerformanceTestingApp;
