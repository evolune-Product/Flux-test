import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Activity,
  TrendingDown,
  Zap,
  Clock,
  XCircle,
  ChevronLeft,
  PlayCircle,
  StopCircle,
  Cloud,
  Wifi,
  Server,
  Database,
  Github,
  LogOut,
  User,
  BarChart2,
  Shield,
  Loader
} from 'lucide-react';
import BackButton from './BackButton';
import GitHubIntegration from './GitHubIntegration';
import { saveTestRun } from './testHistoryUtils.js';
import RecentRuns from './RecentRuns.jsx';

const ChaosTestingApp = () => {
  const navigate = useNavigate();

  // Chaos configurations - different failure scenarios
  const chaosConfigs = {
    'timeout': {
      name: 'Timeout Injection',
      description: 'Simulate request timeouts',
      icon: Clock,
      color: 'orange',
      defaultRate: 30,
      defaultTimeout: 5000
    },
    'error-503': {
      name: '503 Service Unavailable',
      description: 'Simulate server unavailability',
      icon: Server,
      color: 'red',
      defaultRate: 20,
      defaultTimeout: 0
    },
    'error-500': {
      name: '500 Internal Server Error',
      description: 'Simulate server errors',
      icon: XCircle,
      color: 'red',
      defaultRate: 15,
      defaultTimeout: 0
    },
    'latency': {
      name: 'High Latency',
      description: 'Add random delays to requests',
      icon: TrendingDown,
      color: 'yellow',
      defaultRate: 40,
      defaultTimeout: 3000
    },
    'network-failure': {
      name: 'Network Failure',
      description: 'Simulate network connectivity issues',
      icon: Wifi,
      color: 'purple',
      defaultRate: 25,
      defaultTimeout: 0
    },
    'random-errors': {
      name: 'Random Error Mix',
      description: 'Mix of various error types',
      icon: AlertTriangle,
      color: 'pink',
      defaultRate: 30,
      defaultTimeout: 2000
    }
  };

  // State management
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [selectedChaos, setSelectedChaos] = useState('timeout');
  const [chaosRate, setChaosRate] = useState(30); // Percentage of requests to fail
  const [totalRequests, setTotalRequests] = useState(50);
  const [concurrency, setConcurrency] = useState(5);
  const [httpMethod, setHttpMethod] = useState('GET');
  const [requestBody, setRequestBody] = useState('');
  const [customHeaders, setCustomHeaders] = useState('');
  const [customTimeout, setCustomTimeout] = useState(5000);

  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('results');
  const [configTab, setConfigTab] = useState('basic');
  const [showGitHub, setShowGitHub] = useState(false);

  // Get user from localStorage for GitHub integration
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('chaosTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.apiEndpoint) setApiEndpoint(state.apiEndpoint);
        if (state.selectedChaos) setSelectedChaos(state.selectedChaos);
        if (state.chaosRate) setChaosRate(state.chaosRate);
        if (state.totalRequests) setTotalRequests(state.totalRequests);
        if (state.concurrency) setConcurrency(state.concurrency);
        if (state.httpMethod) setHttpMethod(state.httpMethod);
        if (state.requestBody) setRequestBody(state.requestBody);
        if (state.customHeaders) setCustomHeaders(state.customHeaders);
        if (state.customTimeout) setCustomTimeout(state.customTimeout);
        if (state.results) setResults(state.results);
      } catch (e) {
        console.error('Failed to load saved Chaos Testing state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    const stateToSave = {
      apiEndpoint,
      selectedChaos,
      chaosRate,
      totalRequests,
      concurrency,
      httpMethod,
      requestBody,
      customHeaders,
      customTimeout,
      results,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('chaosTestingState', JSON.stringify(stateToSave));
  }, [apiEndpoint, selectedChaos, chaosRate, totalRequests, concurrency, httpMethod, requestBody, customHeaders, customTimeout, results]);

  // Logging function
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Simulate chaos for a request
  const applyChaos = (chaosType, rate) => {
    const shouldApplyChaos = Math.random() * 100 < rate;

    if (!shouldApplyChaos) {
      return { shouldFail: false, chaos: null };
    }

    switch (chaosType) {
      case 'timeout':
        return {
          shouldFail: true,
          chaos: { type: 'timeout', message: 'Request timeout', delay: customTimeout }
        };

      case 'error-503':
        return {
          shouldFail: true,
          chaos: { type: 'error', status: 503, message: 'Service Unavailable' }
        };

      case 'error-500':
        return {
          shouldFail: true,
          chaos: { type: 'error', status: 500, message: 'Internal Server Error' }
        };

      case 'latency':
        const delay = Math.floor(Math.random() * customTimeout) + 500;
        return {
          shouldFail: false,
          chaos: { type: 'latency', delay, message: `Added ${delay}ms latency` }
        };

      case 'network-failure':
        return {
          shouldFail: true,
          chaos: { type: 'network', message: 'Network connection failed' }
        };

      case 'random-errors':
        const errorTypes = ['timeout', 'error-503', 'error-500', 'network-failure'];
        const randomType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
        return applyChaos(randomType, 100); // Always apply when selected for random

      default:
        return { shouldFail: false, chaos: null };
    }
  };

  // Make a single request with chaos injection
  const makeRequestWithChaos = async (url, options, chaosType, rate, requestNumber) => {
    const startTime = performance.now();
    const chaosResult = applyChaos(chaosType, rate);

    try {
      // Apply latency chaos if specified
      if (chaosResult.chaos && chaosResult.chaos.type === 'latency') {
        await new Promise(resolve => setTimeout(resolve, chaosResult.chaos.delay));
      }

      // Apply failure chaos
      if (chaosResult.shouldFail) {
        if (chaosResult.chaos.type === 'timeout') {
          await new Promise(resolve => setTimeout(resolve, chaosResult.chaos.delay));
          throw new Error('CHAOS_TIMEOUT');
        } else if (chaosResult.chaos.type === 'error') {
          throw new Error(`CHAOS_ERROR_${chaosResult.chaos.status}`);
        } else if (chaosResult.chaos.type === 'network') {
          throw new Error('CHAOS_NETWORK_ERROR');
        }
      }

      // Make actual request
      const response = await fetch(url, options);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }

      const result = {
        success: response.ok,
        status: response.status,
        responseTime,
        size: new Blob([text]).size,
        chaosApplied: chaosResult.chaos !== null,
        chaosType: chaosResult.chaos ? chaosResult.chaos.type : null,
        chaosMessage: chaosResult.chaos ? chaosResult.chaos.message : null,
        failed: false
      };

      if (chaosResult.chaos) {
        addLog(`Request #${requestNumber}: ${chaosResult.chaos.message} - ${response.status} (${responseTime.toFixed(2)}ms)`, 'warning');
      }

      return result;

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      let errorType = 'unknown';
      let errorMessage = error.message;
      let status = 0;

      if (error.message === 'CHAOS_TIMEOUT') {
        errorType = 'timeout';
        errorMessage = 'Request timeout (chaos injected)';
        status = 408;
      } else if (error.message.startsWith('CHAOS_ERROR_')) {
        errorType = 'server_error';
        status = parseInt(error.message.split('_')[2]);
        errorMessage = `${status} error (chaos injected)`;
      } else if (error.message === 'CHAOS_NETWORK_ERROR') {
        errorType = 'network';
        errorMessage = 'Network failure (chaos injected)';
        status = 0;
      } else {
        errorType = 'network';
        errorMessage = error.message;
      }

      addLog(`Request #${requestNumber}: FAILED - ${errorMessage}`, 'error');

      return {
        success: false,
        status,
        responseTime,
        size: 0,
        error: errorMessage,
        errorType,
        chaosApplied: chaosResult.chaos !== null,
        chaosType: chaosResult.chaos ? chaosResult.chaos.type : null,
        failed: true
      };
    }
  };

  // Run chaos test
  const runChaosTest = async () => {
    if (!apiEndpoint) {
      addLog('Please enter an API endpoint', 'error');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults(null);
    setLogs([]);

    addLog(`Starting Chaos Test: ${chaosConfigs[selectedChaos].name}`, 'info');
    addLog(`Target: ${apiEndpoint}`, 'info');
    addLog(`Total Requests: ${totalRequests}, Concurrency: ${concurrency}`, 'info');
    addLog(`Chaos Injection Rate: ${chaosRate}%`, 'warning');

    const startTime = performance.now();
    const responseTimes = [];
    const chaosResponses = [];
    const normalResponses = [];
    let successCount = 0;
    let failureCount = 0;
    let chaosInjectedCount = 0;
    const errorTypes = {};
    let totalSize = 0;

    try {
      // Prepare request options
      let headers = { 'Content-Type': 'application/json' };
      if (customHeaders) {
        try {
          const parsed = JSON.parse(customHeaders);
          headers = { ...headers, ...parsed };
        } catch {
          addLog('Invalid JSON in custom headers, using defaults', 'warning');
        }
      }

      const options = {
        method: httpMethod,
        headers,
        mode: 'cors'
      };

      if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && requestBody) {
        options.body = requestBody;
      }

      // Run requests in batches (concurrency control)
      let completedRequests = 0;
      const batchSize = concurrency;

      for (let i = 0; i < totalRequests; i += batchSize) {
        const batch = [];
        const batchEnd = Math.min(i + batchSize, totalRequests);

        for (let j = i; j < batchEnd; j++) {
          batch.push(makeRequestWithChaos(apiEndpoint, options, selectedChaos, chaosRate, j + 1));
        }

        const batchResults = await Promise.all(batch);

        batchResults.forEach(result => {
          completedRequests++;
          responseTimes.push(result.responseTime);
          totalSize += result.size;

          if (result.chaosApplied) {
            chaosInjectedCount++;
            chaosResponses.push(result.responseTime);
          } else {
            normalResponses.push(result.responseTime);
          }

          if (result.success) {
            successCount++;
          } else {
            failureCount++;
            const errorType = result.errorType || 'unknown';
            errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
          }

          setProgress((completedRequests / totalRequests) * 100);
        });
      }

      const endTime = performance.now();
      const totalTime = (endTime - startTime) / 1000;

      // Calculate statistics
      const calculateStats = (times) => {
        if (times.length === 0) return { min: 0, max: 0, avg: 0, p50: 0, p95: 0, p99: 0 };
        const sorted = [...times].sort((a, b) => a - b);
        return {
          min: sorted[0],
          max: sorted[sorted.length - 1],
          avg: times.reduce((a, b) => a + b, 0) / times.length,
          p50: sorted[Math.floor(sorted.length * 0.5)],
          p95: sorted[Math.floor(sorted.length * 0.95)],
          p99: sorted[Math.floor(sorted.length * 0.99)]
        };
      };

      const overallStats = calculateStats(responseTimes);
      const chaosStats = calculateStats(chaosResponses);
      const normalStats = calculateStats(normalResponses);

      const testResults = {
        overall: overallStats,
        chaos: chaosStats,
        normal: normalStats,
        successCount,
        failureCount,
        chaosInjectedCount,
        normalCount: totalRequests - chaosInjectedCount,
        totalRequests,
        chaosRate,
        actualChaosRate: (chaosInjectedCount / totalRequests) * 100,
        successRate: (successCount / totalRequests) * 100,
        failureRate: (failureCount / totalRequests) * 100,
        throughput: totalRequests / totalTime,
        totalTime,
        totalSize: (totalSize / 1024).toFixed(2),
        avgSize: (totalSize / totalRequests / 1024).toFixed(2),
        errorTypes,
        chaosType: chaosConfigs[selectedChaos].name,
        resilience: calculateResilience(successCount, failureCount, chaosInjectedCount)
      };

      setResults(testResults);
      saveTestRun({
        module: 'chaos',
        apiUrl: apiEndpoint,
        totalTests: testResults.totalRequests,
        passed: testResults.successCount,
        failed: testResults.failureCount,
        durationMs: Math.round(totalTime * 1000),
        overallStatus: testResults.failureCount === 0 ? 'PASS' : 'FAIL'
      });
      addLog(`Test completed in ${totalTime.toFixed(2)}s`, 'success');
      addLog(`Success: ${successCount}, Failures: ${failureCount}, Chaos Injected: ${chaosInjectedCount}`, 'info');

    } catch (error) {
      addLog(`Test failed: ${error.message}`, 'error');
    } finally {
      setIsRunning(false);
      setProgress(100);
    }
  };

  // Calculate resilience score
  const calculateResilience = (success, failure, chaosCount) => {
    if (chaosCount === 0) return 100;

    const chaosSuccessRate = (success / (success + failure)) * 100;
    const expectedFailureRate = (chaosCount / (success + failure)) * 100;
    const actualFailureRate = (failure / (success + failure)) * 100;

    // Resilience score: how well the system handled chaos
    // 100 = perfect (no unexpected failures)
    // 0 = complete failure
    let score = 100;

    if (actualFailureRate > expectedFailureRate) {
      // More failures than expected chaos
      score -= (actualFailureRate - expectedFailureRate) * 2;
    }

    return Math.max(0, Math.min(100, score));
  };

  // Get color for metrics
  const getResilienceColor = (score) => {
    if (score >= 80) return '#34d399';
    if (score >= 60) return '#fbbf24';
    if (score >= 40) return '#f97316';
    return '#f87171';
  };

  const getSuccessRateColor = (rate) => {
    const expectedSuccess = 100 - chaosRate;
    if (rate >= expectedSuccess - 10) return '#34d399';
    if (rate >= expectedSuccess - 30) return '#fbbf24';
    return '#f87171';
  };

  // ─── Design tokens ───────────────────────────────────────────────
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
    if (type === 'warning') return { color: '#fb923c' };
    if (type === 'success') return { color: '#34d399' };
    return { color: 'rgba(255,255,255,0.55)' };
  };

  const chaosAccentColors = {
    'timeout':        { bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.35)', text: '#fb923c' },
    'error-503':      { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171' },
    'error-500':      { bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.35)',  text: '#f87171' },
    'latency':        { bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.35)', text: '#fbbf24' },
    'network-failure':{ bg: 'rgba(167,139,250,0.12)',border: 'rgba(167,139,250,0.35)',text: '#a78bfa' },
    'random-errors':  { bg: 'rgba(236,72,153,0.12)', border: 'rgba(236,72,153,0.35)', text: '#f472b6' },
  };

  const ORANGE = '#f97316';
  const ORANGE_DIM = 'rgba(249,115,22,0.18)';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#020408 0%,#060c18 50%,#020408 100%)',
      color: '#e2e8f0',
      fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
      position: 'relative',
    }}>
      {/* Dot grid ambient */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(249,115,22,0.10) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Sticky Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(2,4,8,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        padding: '0 32px',
        height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BackButton />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg,#ea580c,#dc2626)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(249,115,22,0.45)',
            }}>
              <AlertTriangle size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
                Chaos Engineering
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -1 }}>
                Failure injection &amp; resilience analysis
              </div>
            </div>
          </div>
        </div>

        {/* Right: user + logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user?.username && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              padding: '5px 12px',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)',
            }}>
              <User size={13} />
              {user.username}
            </div>
          )}
        </div>
      </div>

      {/* ── Page body ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '36px 32px 60px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: ORANGE_DIM, color: ORANGE,
              border: `1px solid rgba(249,115,22,0.30)`, letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}>Chaos Suite</span>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)',
              border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.06em',
            }}>Failure Simulation</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>
            Chaos Engineering &amp; Failure Simulation
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14, margin: 0 }}>
            Inject controlled failures to measure your API&apos;s resilience under chaos conditions.
          </p>

          {/* Quick stats */}
          <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
            {[
              { label: 'Inject Rate', value: `${chaosRate}%`, color: ORANGE },
              { label: 'Requests', value: totalRequests, color: '#a78bfa' },
              { label: 'Concurrency', value: concurrency, color: '#60a5fa' },
              { label: 'Chaos Type', value: chaosConfigs[selectedChaos]?.name.split(' ')[0], color: chaosAccentColors[selectedChaos]?.text },
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
        </div>

        {/* ── Two-column layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* ═══ LEFT: Config ═══ */}
          <div style={{ ...card, padding: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: ORANGE_DIM,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Activity size={14} color={ORANGE} />
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
                { key: 'basic',   label: 'Basic',       accent: '#60a5fa' },
                { key: 'chaos',   label: 'Chaos Type',  accent: ORANGE },
                { key: 'request', label: 'Request',     accent: '#a78bfa' },
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
                  <label style={labelStyle}>API Endpoint</label>
                  <input
                    type="text"
                    value={apiEndpoint}
                    onChange={(e) => setApiEndpoint(e.target.value)}
                    placeholder="https://api.example.com/endpoint"
                    style={inputStyle}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Total Requests</label>
                    <input
                      type="number"
                      value={totalRequests}
                      onChange={(e) => setTotalRequests(parseInt(e.target.value) || 50)}
                      min="1" max="1000"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>Concurrency</label>
                    <input
                      type="number"
                      value={concurrency}
                      onChange={(e) => setConcurrency(parseInt(e.target.value) || 5)}
                      min="1" max="50"
                      style={inputStyle}
                    />
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>
                    Chaos Injection Rate — <span style={{ color: ORANGE }}>{chaosRate}%</span>
                  </label>
                  <input
                    type="range"
                    value={chaosRate}
                    onChange={(e) => setChaosRate(parseInt(e.target.value))}
                    min="0" max="100"
                    style={{ width: '100%', accentColor: ORANGE }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 4 }}>
                    <span>0% — calm</span>
                    <span>50%</span>
                    <span>100% — full chaos</span>
                  </div>
                </div>
              </div>
            )}

            {/* ─ Chaos Type tab ─ */}
            {configTab === 'chaos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(chaosConfigs).map(([key, config]) => {
                  const Icon = config.icon;
                  const acc = chaosAccentColors[key];
                  const isActive = selectedChaos === key;
                  return (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedChaos(key);
                        setCustomTimeout(config.defaultTimeout);
                        setChaosRate(config.defaultRate);
                      }}
                      style={{
                        width: '100%', padding: '12px 14px',
                        borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                        background: isActive ? acc.bg : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isActive ? acc.border : 'rgba(255,255,255,0.07)'}`,
                        transition: 'all 0.18s', display: 'flex', alignItems: 'flex-start', gap: 12,
                      }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: isActive ? acc.bg : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${isActive ? acc.border : 'rgba(255,255,255,0.07)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                      }}>
                        <Icon size={15} color={isActive ? acc.text : 'rgba(255,255,255,0.40)'} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: isActive ? acc.text : '#e2e8f0' }}>
                          {config.name}
                        </div>
                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                          {config.description}
                        </div>
                      </div>
                    </button>
                  );
                })}

                {(selectedChaos === 'timeout' || selectedChaos === 'latency') && (
                  <div style={{ marginTop: 6 }}>
                    <label style={labelStyle}>
                      {selectedChaos === 'timeout' ? 'Timeout Duration (ms)' : 'Max Latency (ms)'}
                    </label>
                    <input
                      type="number"
                      value={customTimeout}
                      onChange={(e) => setCustomTimeout(parseInt(e.target.value) || 5000)}
                      min="100" max="30000" step="100"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ─ Request tab ─ */}
            {configTab === 'request' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle}>HTTP Method</label>
                  <select
                    value={httpMethod}
                    onChange={(e) => setHttpMethod(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                      <option key={m} value={m} style={{ background: '#0a0e1a' }}>{m}</option>
                    ))}
                  </select>
                </div>

                {['POST', 'PUT', 'PATCH'].includes(httpMethod) && (
                  <div>
                    <label style={labelStyle}>Request Body (JSON)</label>
                    <textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      placeholder={'{"key": "value"}'}
                      rows={6}
                      style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                    />
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Custom Headers (JSON)</label>
                  <textarea
                    value={customHeaders}
                    onChange={(e) => setCustomHeaders(e.target.value)}
                    placeholder={'{"Authorization": "Bearer token"}'}
                    rows={4}
                    style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* ─ Run button + progress ─ */}
            <div style={{ marginTop: 24 }}>
              <button
                onClick={runChaosTest}
                disabled={isRunning || !apiEndpoint}
                style={{
                  width: '100%', padding: '13px 0',
                  borderRadius: 10, fontWeight: 700, fontSize: 14,
                  border: 'none', cursor: isRunning || !apiEndpoint ? 'not-allowed' : 'pointer',
                  background: isRunning || !apiEndpoint
                    ? 'rgba(255,255,255,0.06)'
                    : 'linear-gradient(135deg,#ea580c,#dc2626)',
                  color: isRunning || !apiEndpoint ? 'rgba(255,255,255,0.30)' : '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: isRunning || !apiEndpoint ? 'none' : '0 0 24px rgba(234,88,12,0.40)',
                  transition: 'all 0.2s',
                }}
              >
                {isRunning ? (
                  <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Running Chaos Test…</>
                ) : (
                  <><PlayCircle size={16} /> Launch Chaos Test</>
                )}
              </button>

              {isRunning && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                    <span>Injecting failures…</span>
                    <span>{progress.toFixed(0)}%</span>
                  </div>
                  <div style={{ width: '100%', height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 4,
                      background: 'linear-gradient(90deg,#ea580c,#dc2626)',
                      width: `${progress}%`, transition: 'width 0.3s ease',
                    }} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Results / Logs / History ═══ */}
          <div style={{ ...card, padding: 0, overflow: 'hidden', position: 'sticky', top: 76 }}>
            {/* Tab bar header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 22px',
              borderBottom: '1px solid rgba(255,255,255,0.07)',
            }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[
                  { key: 'results', label: 'Results',       accent: ORANGE },
                  { key: 'logs',    label: `Logs (${logs.length})`, accent: '#34d399' },
                  { key: 'history', label: 'History',       accent: '#60a5fa' },
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

            <div style={{ padding: 22, maxHeight: 620, overflowY: 'auto' }}>

              {/* ─ Results Tab ─ */}
              {activeTab === 'results' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                  {!results ? (
                    <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.25)' }}>
                      <AlertTriangle size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.25 }} />
                      <p style={{ margin: 0, fontSize: 14 }}>Run a chaos test to see resilience results</p>
                    </div>
                  ) : (
                    <>
                      {/* Top summary cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          {
                            label: 'Resilience Score',
                            value: `${results.resilience.toFixed(1)}%`,
                            color: getResilienceColor(results.resilience),
                            bg: 'rgba(52,211,153,0.06)',
                          },
                          {
                            label: 'Success Rate',
                            value: `${results.successRate.toFixed(1)}%`,
                            color: getSuccessRateColor(results.successRate),
                            bg: 'rgba(96,165,250,0.06)',
                          },
                          {
                            label: 'Chaos Injected',
                            value: `${results.chaosInjectedCount}/${results.totalRequests}`,
                            sub: `${results.actualChaosRate.toFixed(1)}% actual`,
                            color: ORANGE,
                            bg: ORANGE_DIM,
                          },
                          {
                            label: 'Total Failures',
                            value: `${results.failureCount}`,
                            sub: `${results.failureRate.toFixed(1)}% failure rate`,
                            color: '#f87171',
                            bg: 'rgba(248,113,113,0.06)',
                          },
                        ].map(c => (
                          <div key={c.label} style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: c.bg,
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>
                              {c.label}
                            </div>
                            <div style={{ fontSize: 22, fontWeight: 800, color: c.color, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                              {c.value}
                            </div>
                            {c.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 3 }}>{c.sub}</div>}
                          </div>
                        ))}
                      </div>

                      {/* Chaos type info bar */}
                      <div style={{
                        padding: '12px 16px', borderRadius: 10,
                        background: ORANGE_DIM,
                        border: `1px solid rgba(249,115,22,0.30)`,
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <AlertTriangle size={15} color={ORANGE} />
                        <div>
                          <span style={{ fontWeight: 700, color: ORANGE, fontSize: 13 }}>{results.chaosType}</span>
                          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginLeft: 10 }}>
                            Target {results.chaosRate}% · Actual {results.actualChaosRate.toFixed(1)}%
                          </span>
                        </div>
                      </div>

                      {/* Response time sections */}
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                          Response Time Analysis
                        </div>

                        {/* Overall */}
                        <div style={{
                          padding: '14px 16px', borderRadius: 10,
                          background: 'rgba(96,165,250,0.07)',
                          border: '1px solid rgba(96,165,250,0.20)',
                          marginBottom: 8,
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', marginBottom: 8 }}>
                            All Requests
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                            {[
                              ['Avg', results.overall.avg.toFixed(1)+'ms'],
                              ['P95', results.overall.p95.toFixed(1)+'ms'],
                              ['P99', results.overall.p99.toFixed(1)+'ms'],
                              ['Min', results.overall.min.toFixed(1)+'ms'],
                              ['Max', results.overall.max.toFixed(1)+'ms'],
                              ['P50', results.overall.p50.toFixed(1)+'ms'],
                            ].map(([k,v]) => (
                              <div key={k}>
                                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{k}</div>
                                <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{v}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Normal */}
                        {results.normalCount > 0 && (
                          <div style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: 'rgba(52,211,153,0.07)',
                            border: '1px solid rgba(52,211,153,0.20)',
                            marginBottom: 8,
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', marginBottom: 8 }}>
                              Normal Requests ({results.normalCount})
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                              {[
                                ['Avg', results.normal.avg.toFixed(1)+'ms'],
                                ['P95', results.normal.p95.toFixed(1)+'ms'],
                                ['P99', results.normal.p99.toFixed(1)+'ms'],
                              ].map(([k,v]) => (
                                <div key={k}>
                                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{k}</div>
                                  <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Chaos */}
                        {results.chaosInjectedCount > 0 && (
                          <div style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: ORANGE_DIM,
                            border: 'rgba(249,115,22,0.25) 1px solid',
                          }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, marginBottom: 8 }}>
                              Chaos Requests ({results.chaosInjectedCount})
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                              {[
                                ['Avg', results.chaos.avg.toFixed(1)+'ms'],
                                ['P95', results.chaos.p95.toFixed(1)+'ms'],
                                ['P99', results.chaos.p99.toFixed(1)+'ms'],
                              ].map(([k,v]) => (
                                <div key={k}>
                                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{k}</div>
                                  <div style={{ color: '#e2e8f0', fontWeight: 700 }}>{v}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Error Distribution */}
                      {Object.keys(results.errorTypes).length > 0 && (
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                            Error Distribution
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {Object.entries(results.errorTypes).map(([type, count]) => (
                              <div key={type} style={{
                                padding: '10px 14px', borderRadius: 8,
                                background: 'rgba(248,113,113,0.07)',
                                border: '1px solid rgba(248,113,113,0.18)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}>
                                <span style={{ fontSize: 13, color: '#e2e8f0', textTransform: 'capitalize' }}>
                                  {type.replace('_', ' ')}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#f87171', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                                  {count} ({((count / results.totalRequests) * 100).toFixed(1)}%)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Throughput / timing */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        {[
                          { label: 'Throughput',  value: `${results.throughput.toFixed(2)} req/s` },
                          { label: 'Total Time',  value: `${results.totalTime.toFixed(2)}s` },
                          { label: 'Total Data',  value: `${results.totalSize} KB` },
                          { label: 'Avg Response',value: `${results.avgSize} KB` },
                        ].map(m => (
                          <div key={m.label} style={{
                            padding: '12px 14px', borderRadius: 9,
                            background: 'rgba(255,255,255,0.03)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                              {m.label}
                            </div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                              {m.value}
                            </div>
                          </div>
                        ))}
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
                  {/* macOS title bar */}
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
                      chaos.log — {logs.length} entries
                    </span>
                  </div>
                  <div style={{ padding: 14, maxHeight: 480, overflowY: 'auto', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                    {logs.length === 0 ? (
                      <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.20)', padding: '40px 0' }}>
                        No log entries yet
                      </div>
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
                  <RecentRuns module="chaos" />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spin keyframe */}
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
              test: `Chaos Test - ${chaosConfigs[selectedChaos].name}`,
              status: results.successRate >= 50 ? 'PASS' : 'FAIL',
              details: `${results.totalRequests} requests | Success: ${results.successCount} (${results.successRate}%) | Failures: ${results.failureCount} | Chaos Injected: ${results.chaosInjectedCount} (${results.chaosRate}%) | Avg Response: ${results.overall.avg.toFixed(2)}ms`,
              timestamp: new Date().toISOString(),
              chaosMetrics: {
                totalRequests: results.totalRequests,
                successCount: results.successCount,
                failureCount: results.failureCount,
                successRate: results.successRate,
                chaosInjectedCount: results.chaosInjectedCount,
                chaosRate: results.chaosRate,
                throughput: results.throughput,
                totalTime: results.totalTime,
                totalSize: results.totalSize,
                avgSize: results.avgSize,
                overall: results.overall,
                normal: results.normal,
                chaos: results.chaos,
                errorTypes: results.errorTypes,
                chaosType: selectedChaos,
                chaosConfig: chaosConfigs[selectedChaos]
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

export default ChaosTestingApp;
