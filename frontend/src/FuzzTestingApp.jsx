import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Zap,
  Clock,
  Activity,
  AlertTriangle,
  Play,
  Loader,
  Target,
  Bug,
  Code,
  Server,
  FileText,
  Download,
  User,
} from 'lucide-react';
import BackButton from './BackButton';
import { saveTestRun } from './testHistoryUtils.js';
import RecentRuns from './RecentRuns.jsx';

import { API_BASE_URL } from './lib/api.js';

const FuzzTestingApp = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // State management
  const [apiUrl, setApiUrl] = useState('');
  const [sampleData, setSampleData] = useState('{\n  "field": "value"\n}');
  const [numTests, setNumTests] = useState(50);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('config');

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('fuzzTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.apiUrl) setApiUrl(state.apiUrl);
        if (state.sampleData) setSampleData(state.sampleData);
        if (state.numTests) setNumTests(state.numTests);
        if (state.results) setResults(state.results);
        if (state.generatedTests) setGeneratedTests(state.generatedTests);
      } catch (e) {
        console.error('Failed to load saved Fuzz Testing state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    const stateToSave = {
      apiUrl,
      sampleData,
      numTests,
      results,
      generatedTests,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('fuzzTestingState', JSON.stringify(stateToSave));
  }, [apiUrl, sampleData, numTests, results, generatedTests]);

  // Logging function
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Generate fuzz tests
  const handleGenerateFuzzTests = async () => {
    if (!apiUrl.trim()) {
      addLog('Please enter an API URL', 'error');
      return;
    }

    try {
      const parsedData = JSON.parse(sampleData);
      addLog('Starting fuzz test generation...', 'info');
      setIsRunning(true);
      setProgress(20);

      const response = await fetch(`${API_BASE_URL}/generate-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          api_url: apiUrl,
          sample_data: parsedData,
          num_tests: numTests,
          test_types: ['fuzz_tests'], // Only fuzz tests
          has_auth: false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProgress(60);
      addLog(`Generated ${data.count} fuzz test cases`, 'success');

      setGeneratedTests(data.test_cases);
      setProgress(100);
      setActiveTab('tests');
      setTimeout(() => {
        setIsRunning(false);
        setProgress(0);
      }, 500);

    } catch (error) {
      addLog(`Error generating tests: ${error.message}`, 'error');
      setIsRunning(false);
      setProgress(0);
    }
  };

  // Run fuzz tests
  const handleRunFuzzTests = async () => {
    if (generatedTests.length === 0) {
      addLog('No tests to run. Generate tests first.', 'error');
      return;
    }

    try {
      addLog('Starting fuzz test execution...', 'info');
      setIsRunning(true);
      setProgress(20);

      const response = await fetch(`${API_BASE_URL}/run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base_url: apiUrl,
          test_cases: generatedTests,
          auth_config: { type: 'none' },
          timeout: 10
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setProgress(80);
      setResults(data);
      saveTestRun({
        module: 'fuzz',
        apiUrl: apiUrl,
        totalTests: data.summary?.total ?? 0,
        passed: data.summary?.passed ?? 0,
        failed: data.summary?.failed ?? 0,
        overallStatus: (data.summary?.failed ?? 0) === 0 ? 'PASS' : 'FAIL'
      });
      addLog(`Completed: ${data.summary.passed}/${data.summary.total} tests passed`, data.summary.passed === data.summary.total ? 'success' : 'warning');
      setProgress(100);
      setActiveTab('results');

      setTimeout(() => {
        setIsRunning(false);
        setProgress(0);
      }, 500);

    } catch (error) {
      addLog(`Error running tests: ${error.message}`, 'error');
      setIsRunning(false);
      setProgress(0);
    }
  };

  // Get fuzz test statistics
  const getFuzzStats = () => {
    if (!results) return null;

    const stats = {
      total: results.summary.total,
      passed: results.summary.passed,
      failed: results.summary.failed,
      passRate: results.summary.pass_rate
    };

    return stats;
  };

  // ─── Design tokens ───────────────────────────────────────────────
  const PURPLE = '#a78bfa';
  const PURPLE_DIM = 'rgba(167,139,250,0.15)';

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
    return { color: 'rgba(255,255,255,0.55)' };
  };

  const methodColor = (m) => {
    const map = { GET:'#34d399', POST:'#60a5fa', PUT:'#fbbf24', PATCH:'#fb923c', DELETE:'#f87171' };
    return map[m] || '#a78bfa';
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
        backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.10) 1px, transparent 1px)',
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
              background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(167,139,250,0.40)',
            }}>
              <Target size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
                Fuzz Testing
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -1 }}>
                Input fuzzing &amp; vulnerability detection
              </div>
            </div>
          </div>
        </div>
        {user?.username && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)',
          }}>
            <User size={13} /> {user.username}
          </div>
        )}
      </div>

      {/* ── Page body ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '36px 32px 60px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: PURPLE_DIM, color: PURPLE,
              border: `1px solid rgba(167,139,250,0.30)`, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Fuzz Suite</span>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)',
              border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.06em',
            }}>AI-Powered</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>
            Fuzz Testing &amp; Vulnerability Detection
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14, margin: 0 }}>
            Generate malformed inputs to discover hidden security flaws and edge-case failures.
          </p>

          {/* Quick stats row */}
          {results && (
            <div style={{ display: 'flex', gap: 12, marginTop: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total',    value: getFuzzStats().total,               color: '#e2e8f0' },
                { label: 'Passed',   value: getFuzzStats().passed,              color: '#34d399' },
                { label: 'Failed',   value: getFuzzStats().failed,              color: '#f87171' },
                { label: 'Pass Rate',value: `${getFuzzStats().passRate.toFixed(1)}%`, color: PURPLE },
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

        {/* ── Main card with tabs ── */}
        <div style={{ ...card, overflow: 'hidden' }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 2,
            padding: '0 22px',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
          }}>
            {[
              { key: 'config',  label: 'Configuration',                  icon: Server,   accent: PURPLE },
              { key: 'tests',   label: `Generated (${generatedTests.length})`, icon: Code,  accent: '#fbbf24' },
              { key: 'results', label: 'Results',                         icon: FileText, accent: '#34d399' },
              { key: 'logs',    label: `Logs (${logs.length})`,           icon: Activity, accent: '#60a5fa' },
              { key: 'history', label: 'History',                         icon: Clock,    accent: '#fb923c' },
            ].map(t => {
              const Icon = t.icon;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '14px 16px', fontSize: 13, fontWeight: 600,
                  background: 'none', border: 'none', cursor: 'pointer',
                  borderBottom: activeTab === t.key ? `2px solid ${t.accent}` : '2px solid transparent',
                  color: activeTab === t.key ? t.accent : 'rgba(255,255,255,0.35)',
                  marginBottom: -1, transition: 'all 0.18s',
                }}>
                  <Icon size={14} /> {t.label}
                </button>
              );
            })}
          </div>

          <div style={{ padding: 28 }}>

            {/* ── Config Tab ── */}
            {activeTab === 'config' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
                {/* Info banner */}
                <div style={{
                  padding: '16px 20px', borderRadius: 12,
                  background: PURPLE_DIM,
                  border: `1px solid rgba(167,139,250,0.25)`,
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                }}>
                  <Bug size={20} color={PURPLE} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <div style={{ fontWeight: 700, color: PURPLE, fontSize: 14, marginBottom: 4 }}>What is Fuzz Testing?</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6 }}>
                      Fuzz testing generates malformed, unexpected, or random data to test API robustness.
                      It helps discover buffer overflows, memory corruption, integer overflows, format string
                      vulnerabilities, and other critical security bugs that standard testing might miss.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
                  {/* Left column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <div>
                      <label style={labelStyle}>API Endpoint URL</label>
                      <input
                        type="text"
                        value={apiUrl}
                        onChange={(e) => setApiUrl(e.target.value)}
                        placeholder="https://api.example.com/endpoint"
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>
                        Number of Fuzz Tests — <span style={{ color: PURPLE }}>{numTests}</span>
                      </label>
                      <input
                        type="range"
                        min="10" max="100"
                        value={numTests}
                        onChange={(e) => setNumTests(parseInt(e.target.value))}
                        style={{ width: '100%', accentColor: PURPLE }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.30)', marginTop: 4 }}>
                        <span>10</span><span>50</span><span>100</span>
                      </div>
                    </div>

                    {/* Buttons */}
                    <button
                      onClick={handleGenerateFuzzTests}
                      disabled={isRunning}
                      style={{
                        width: '100%', padding: '13px 0',
                        borderRadius: 10, fontWeight: 700, fontSize: 14,
                        border: 'none', cursor: isRunning ? 'not-allowed' : 'pointer',
                        background: isRunning ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                        color: isRunning ? 'rgba(255,255,255,0.30)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: isRunning ? 'none' : '0 0 20px rgba(124,58,237,0.35)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isRunning ? (
                        <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                      ) : (
                        <><Target size={16} /> Generate Fuzz Tests</>
                      )}
                    </button>

                    <button
                      onClick={handleRunFuzzTests}
                      disabled={isRunning || generatedTests.length === 0}
                      style={{
                        width: '100%', padding: '13px 0',
                        borderRadius: 10, fontWeight: 700, fontSize: 14,
                        border: 'none',
                        cursor: isRunning || generatedTests.length === 0 ? 'not-allowed' : 'pointer',
                        background: isRunning || generatedTests.length === 0
                          ? 'rgba(255,255,255,0.06)'
                          : 'linear-gradient(135deg,#059669,#047857)',
                        color: isRunning || generatedTests.length === 0 ? 'rgba(255,255,255,0.30)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: isRunning || generatedTests.length === 0 ? 'none' : '0 0 20px rgba(5,150,105,0.30)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isRunning ? (
                        <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
                      ) : (
                        <><Play size={16} /> Run Fuzz Tests</>
                      )}
                    </button>

                    {isRunning && (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
                          <span>Processing…</span><span>{progress}%</span>
                        </div>
                        <div style={{ width: '100%', height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%', borderRadius: 4,
                            background: 'linear-gradient(90deg,#7c3aed,#059669)',
                            width: `${progress}%`, transition: 'width 0.5s ease',
                          }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right column: sample data */}
                  <div>
                    <label style={labelStyle}>Sample Data Structure (JSON)</label>
                    <textarea
                      value={sampleData}
                      onChange={(e) => setSampleData(e.target.value)}
                      rows={14}
                      style={{
                        ...inputStyle,
                        fontFamily: '"JetBrains Mono","Fira Code",monospace',
                        fontSize: 13, resize: 'vertical',
                      }}
                      placeholder='{"field": "value"}'
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ── Generated Tests Tab ── */}
            {activeTab === 'tests' && (
              <div>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18,
                }}>
                  <div style={{ fontWeight: 700, fontSize: 16, color: '#fff' }}>
                    Generated Fuzz Tests
                    <span style={{
                      marginLeft: 10, padding: '2px 10px', borderRadius: 12,
                      background: PURPLE_DIM, color: PURPLE, fontSize: 12, fontWeight: 700,
                    }}>{generatedTests.length}</span>
                  </div>
                </div>

                {generatedTests.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.20)' }}>
                    <Bug size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>No fuzz tests generated yet. Configure and generate tests first.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
                    {generatedTests.map((test, index) => (
                      <div key={index} style={{
                        padding: '12px 16px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.07)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: 'rgba(0,0,0,0.30)',
                            color: methodColor(test.method), flexShrink: 0,
                            fontFamily: '"JetBrains Mono","Fira Code",monospace',
                          }}>
                            {test.method}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0', marginBottom: 4 }}>
                              {test.description}
                            </div>
                            <div style={{
                              fontSize: 12, color: 'rgba(255,255,255,0.40)',
                              fontFamily: '"JetBrains Mono","Fira Code",monospace',
                              background: 'rgba(255,255,255,0.03)',
                              padding: '3px 8px', borderRadius: 5, display: 'inline-block',
                            }}>
                              {test.endpoint || '/'}
                            </div>
                            {test.data && (
                              <details style={{ marginTop: 8 }}>
                                <summary style={{
                                  fontSize: 12, color: PURPLE, cursor: 'pointer', fontWeight: 600, userSelect: 'none',
                                }}>
                                  View Payload
                                </summary>
                                <pre style={{
                                  marginTop: 8, padding: '10px 12px',
                                  background: '#050810', border: '1px solid rgba(255,255,255,0.07)',
                                  borderRadius: 8, fontSize: 11, overflowX: 'auto',
                                  color: 'rgba(255,255,255,0.60)',
                                  fontFamily: '"JetBrains Mono","Fira Code",monospace',
                                }}>
                                  {JSON.stringify(test.data, null, 2)}
                                </pre>
                              </details>
                            )}
                          </div>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', flexShrink: 0, marginTop: 2 }}>
                            {test.expected_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── Results Tab ── */}
            {activeTab === 'results' && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#fff', marginBottom: 18 }}>
                  Test Results
                </div>

                {!results ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(255,255,255,0.20)' }}>
                    <FileText size={44} style={{ margin: '0 auto 12px', display: 'block', opacity: 0.2 }} />
                    <p style={{ margin: 0, fontSize: 14 }}>No results yet. Run fuzz tests to see results.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 560, overflowY: 'auto' }}>
                    {results.results.map((result, index) => {
                      const pass = result.status === 'PASS';
                      return (
                        <div key={index} style={{
                          padding: '12px 16px', borderRadius: 10,
                          background: pass ? 'rgba(52,211,153,0.07)' : 'rgba(248,113,113,0.07)',
                          border: `1px solid ${pass ? 'rgba(52,211,153,0.20)' : 'rgba(248,113,113,0.20)'}`,
                          display: 'flex', alignItems: 'flex-start', gap: 10,
                        }}>
                          {pass
                            ? <CheckCircle size={16} color="#34d399" style={{ flexShrink: 0, marginTop: 1 }} />
                            : <XCircle size={16} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                          }
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>{result.test}</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3 }}>{result.details}</div>
                          </div>
                          <span style={{
                            padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700,
                            background: pass ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)',
                            color: pass ? '#34d399' : '#f87171',
                          }}>
                            {result.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Logs Tab ── */}
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
                    fuzz.log — {logs.length} entries
                  </span>
                </div>
                <div style={{ padding: 14, maxHeight: 500, overflowY: 'auto', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
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

            {/* ── History Tab ── */}
            {activeTab === 'history' && (
              <div style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 10, padding: 16,
              }}>
                <RecentRuns module="fuzz" />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default FuzzTestingApp;
