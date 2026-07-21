import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  GitCompare,
  Plus,
  Play,
  Trash2,
  History,
  AlertTriangle,
  Clock,
  Loader,
  FileText,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
  User,
  Zap,
} from 'lucide-react';
import BackButton from './BackButton';
import { saveTestRun } from './testHistoryUtils.js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const RegressionTestingApp = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // State management
  const [baselines, setBaselines] = useState([]);
  const [selectedBaseline, setSelectedBaseline] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [testHistory, setTestHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingBaseline, setIsCreatingBaseline] = useState(false);
  const [activeTab, setActiveTab] = useState('baselines'); // 'baselines', 'create', 'results', 'history'
  const [logs, setLogs] = useState([]);

  // Form state for creating baseline
  const [baselineForm, setBaselineForm] = useState({
    baseline_name: '',
    description: '',
    api_url: '',
    http_method: 'GET',
    request_body: '',
    custom_headers: '',
    expected_status: 200,
    expected_response_time_ms: ''
  });
  const [nlTestInput, setNlTestInput] = useState('');
  const [nlGenerating, setNlGenerating] = useState(false);

  const handleGenerateFromNL = async () => {
    if (!nlTestInput.trim()) return;
    setNlGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-test-from-nl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: nlTestInput, base_url: 'http://api.example.com' })
      });
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      setBaselineForm({
        baseline_name: data.description,
        description: data.description,
        api_url: data.endpoint || '',
        http_method: data.method || 'GET',
        request_body: '',
        custom_headers: '',
        expected_status: data.expected_status || 200,
        expected_response_time_ms: ''
      });
      setNlTestInput('');
    } catch (error) {
    } finally {
      setNlGenerating(false);
    }
  };

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('regressionTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.baselineForm) setBaselineForm(state.baselineForm);
        if (state.testResults) setTestResults(state.testResults);
        if (state.selectedBaseline) setSelectedBaseline(state.selectedBaseline);
      } catch (e) {
        console.error('Failed to load saved Regression Testing state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    const stateToSave = {
      baselineForm,
      testResults,
      selectedBaseline,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('regressionTestingState', JSON.stringify(stateToSave));
  }, [baselineForm, testResults, selectedBaseline]);

  // Logging function
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Fetch baselines on component mount
  useEffect(() => {
    fetchBaselines();
  }, []);

  // Fetch baselines
  const fetchBaselines = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/regression/my-baselines`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setBaselines(data.baselines);
      }
    } catch (error) {
      addLog(`Failed to fetch baselines: ${error.message}`, 'error');
    }
  };

  // Create new baseline
  const createBaseline = async () => {
    if (!baselineForm.baseline_name.trim() || !baselineForm.api_url.trim()) {
      addLog('Baseline name and API URL are required', 'error');
      return;
    }

    setIsCreatingBaseline(true);
    addLog('Creating baseline...', 'info');

    try {
      const token = localStorage.getItem('token');

      // Parse request body and headers
      let requestBody = null;
      let customHeaders = null;

      if (baselineForm.request_body) {
        try {
          requestBody = JSON.parse(baselineForm.request_body);
        } catch (e) {
          addLog('Invalid JSON in request body', 'error');
          setIsCreatingBaseline(false);
          return;
        }
      }

      if (baselineForm.custom_headers) {
        try {
          customHeaders = JSON.parse(baselineForm.custom_headers);
        } catch (e) {
          addLog('Invalid JSON in custom headers', 'error');
          setIsCreatingBaseline(false);
          return;
        }
      }

      const payload = {
        baseline_name: baselineForm.baseline_name,
        description: baselineForm.description || null,
        api_url: baselineForm.api_url,
        http_method: baselineForm.http_method,
        request_body: requestBody,
        custom_headers: customHeaders,
        expected_status: parseInt(baselineForm.expected_status),
        expected_response_time_ms: baselineForm.expected_response_time_ms ? parseInt(baselineForm.expected_response_time_ms) : null,
        is_shared: false
      };

      addLog(`Sending request to: ${API_BASE_URL}/regression/create-baseline`, 'info');
      addLog(`Payload: ${JSON.stringify(payload, null, 2)}`, 'info');

      const response = await fetch(`${API_BASE_URL}/regression/create-baseline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      addLog(`Response status: ${response.status}`, 'info');

      if (response.ok) {
        const data = await response.json();
        addLog(`Baseline "${data.baseline_name}" created successfully!`, 'success');
        addLog(`Baseline ID: ${data.baseline_id}`, 'success');

        // Reset form
        setBaselineForm({
          baseline_name: '',
          description: '',
          api_url: '',
          http_method: 'GET',
          request_body: '',
          custom_headers: '',
          expected_status: 200,
          expected_response_time_ms: ''
        });

        // Refresh baselines list
        await fetchBaselines();

        // Switch to baselines tab
        setActiveTab('baselines');
      } else {
        let errorDetail = 'Unknown error';
        try {
          const error = await response.json();
          errorDetail = error.detail || JSON.stringify(error);
        } catch (e) {
          errorDetail = await response.text();
        }
        addLog(`Failed to create baseline (${response.status}): ${errorDetail}`, 'error');
      }
    } catch (error) {
      addLog(`Network/Error creating baseline: ${error.message}`, 'error');
      console.error('Baseline creation error:', error);
    } finally {
      setIsCreatingBaseline(false);
    }
  };

  // Delete baseline
  const deleteBaseline = async (baselineId) => {
    if (!confirm('Are you sure you want to delete this baseline? This will also delete all associated test results.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/regression/baselines/${baselineId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        addLog('Baseline deleted successfully', 'success');
        await fetchBaselines();

        // Clear selection if deleted baseline was selected
        if (selectedBaseline?.baseline_id === baselineId) {
          setSelectedBaseline(null);
          setTestResults(null);
          setTestHistory(null);
        }
      } else {
        const error = await response.json();
        addLog(`Failed to delete baseline: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error deleting baseline: ${error.message}`, 'error');
    }
  };

  // Run regression test
  const runRegressionTest = async (baselineId) => {
    setIsLoading(true);
    setTestResults(null);
    setLogs([]);
    addLog('Running regression test...', 'info');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/regression/run-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          baseline_id: baselineId,
          timeout: 10
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTestResults(data);
        saveTestRun({
          module: 'regression',
          apiUrl: selectedBaseline?.api_url || 'regression baseline',
          totalTests: data.summary?.total_checks ?? 1,
          passed: data.passed ? (data.summary?.total_checks ?? 1) : (data.summary?.total_checks ?? 1) - (data.summary?.failed_checks ?? 1),
          failed: data.summary?.failed_checks ?? (data.passed ? 0 : 1),
          overallStatus: data.passed ? 'PASS' : 'FAIL'
        });

        if (data.passed) {
          addLog('✅ Regression test PASSED! No regressions detected.', 'success');
        } else {
          addLog(`❌ Regression test FAILED! ${data.differences.length} difference(s) detected.`, 'error');
        }

        // Switch to results tab
        setActiveTab('results');

        // Refresh test history
        fetchTestHistory(baselineId);
      } else {
        const error = await response.json();
        addLog(`Test failed: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error running test: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch test history for a baseline
  const fetchTestHistory = async (baselineId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/regression/results/${baselineId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTestHistory(data);
      }
    } catch (error) {
      addLog(`Failed to fetch test history: ${error.message}`, 'error');
    }
  };

  // Select a baseline
  const selectBaseline = async (baseline) => {
    setSelectedBaseline(baseline);
    setTestResults(null);

    // Fetch test history for this baseline
    await fetchTestHistory(baseline.baseline_id);
  };

  // ─── Design tokens ───────────────────────────────────────────────
  const CYAN = '#22d3ee';
  const CYAN_DIM = 'rgba(34,211,238,0.12)';

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
    return { color: CYAN };
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
        backgroundImage: 'radial-gradient(circle, rgba(34,211,238,0.08) 1px, transparent 1px)',
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
              background: 'linear-gradient(135deg,#0891b2,#0e7490)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(34,211,238,0.35)',
            }}>
              <GitCompare size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
                Regression Testing
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -1 }}>
                Baseline comparison &amp; change detection
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
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: CYAN_DIM, color: CYAN,
              border: `1px solid rgba(34,211,238,0.25)`, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Regression Suite</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>
            Regression Testing &amp; Baseline Comparison
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14, margin: 0 }}>
            Capture API baselines and automatically detect regressions over time.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Baselines Saved', value: baselines.length, color: CYAN },
              { label: 'Selected', value: selectedBaseline?.baseline_name || 'None', color: 'rgba(255,255,255,0.60)' },
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

        {/* ── 3-col layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 22, alignItems: 'start' }}>

          {/* ═══ LEFT: Baselines list ═══ */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: CYAN_DIM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <FileText size={13} color={CYAN} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                  Baselines
                  <span style={{
                    marginLeft: 6, padding: '1px 7px', borderRadius: 10,
                    background: CYAN_DIM, color: CYAN, fontSize: 11, fontWeight: 700,
                  }}>{baselines.length}</span>
                </span>
              </div>
              <button
                onClick={() => setActiveTab('create')}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: 'linear-gradient(135deg,#0891b2,#0e7490)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(34,211,238,0.25)',
                }}
                title="Create New Baseline"
              >
                <Plus size={15} color="#fff" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
              {baselines.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)' }}>
                  <GitCompare size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.2 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No baselines yet</p>
                  <p style={{ margin: '4px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.18)' }}>
                    Create a baseline to start
                  </p>
                </div>
              ) : (
                baselines.map((baseline) => {
                  const isSelected = selectedBaseline?.baseline_id === baseline.baseline_id;
                  return (
                    <div
                      key={baseline.baseline_id}
                      onClick={() => selectBaseline(baseline)}
                      style={{
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                        background: isSelected ? CYAN_DIM : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSelected ? 'rgba(34,211,238,0.30)' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.18s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: isSelected ? CYAN : '#e2e8f0', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {baseline.baseline_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                            <span style={{
                              padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                              color: methodColor(baseline.http_method),
                              background: 'rgba(0,0,0,0.30)',
                              fontFamily: '"JetBrains Mono","Fira Code",monospace',
                            }}>{baseline.http_method}</span>
                            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {baseline.api_url.length > 28 ? baseline.api_url.substring(0, 28) + '…' : baseline.api_url}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                            {new Date(baseline.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {isSelected && (
                            <button
                              onClick={(e) => { e.stopPropagation(); runRegressionTest(baseline.baseline_id); }}
                              disabled={isLoading}
                              style={{
                                width: 26, height: 26, borderRadius: 6,
                                background: 'rgba(52,211,153,0.15)',
                                border: '1px solid rgba(52,211,153,0.25)',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              title="Run Test"
                            >
                              {isLoading
                                ? <Loader size={12} color="#34d399" style={{ animation: 'spin 1s linear infinite' }} />
                                : <Play size={12} color="#34d399" />
                              }
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteBaseline(baseline.baseline_id); }}
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              background: 'rgba(248,113,113,0.10)',
                              border: '1px solid rgba(248,113,113,0.15)',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Delete"
                          >
                            <Trash2 size={12} color="#f87171" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Tabbed panel ═══ */}
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 22px',
            }}>
              {[
                { key: 'baselines', label: 'Overview',   icon: FileText,  accent: CYAN },
                { key: 'create',    label: 'Create',     icon: Plus,      accent: '#a78bfa' },
                { key: 'results',   label: 'Results',    icon: BarChart3, accent: '#34d399' },
                { key: 'history',   label: `History${testHistory ? ` (${testHistory.results.length})` : ''}`, icon: History, accent: '#fbbf24' },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '14px 14px', fontSize: 13, fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: activeTab === t.key ? `2px solid ${t.accent}` : '2px solid transparent',
                    color: activeTab === t.key ? t.accent : 'rgba(255,255,255,0.35)',
                    marginBottom: -1, transition: 'all 0.18s',
                  }}>
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 28, maxHeight: 680, overflowY: 'auto' }}>

              {/* ─ Overview / Baselines Tab ─ */}
              {activeTab === 'baselines' && (
                <div>
                  {selectedBaseline ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                        <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>Baseline Details</div>
                        <button
                          onClick={() => runRegressionTest(selectedBaseline.baseline_id)}
                          disabled={isLoading}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '9px 18px', borderRadius: 9, fontWeight: 700, fontSize: 13,
                            border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                            background: isLoading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#059669,#047857)',
                            color: isLoading ? 'rgba(255,255,255,0.30)' : '#fff',
                            boxShadow: isLoading ? 'none' : '0 0 16px rgba(5,150,105,0.30)',
                          }}
                        >
                          {isLoading
                            ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> Running…</>
                            : <><Play size={14} /> Run Test</>
                          }
                        </button>
                      </div>

                      <div style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20,
                      }}>
                        {[
                          { label: 'Name',            value: selectedBaseline.baseline_name },
                          { label: 'Method',          value: selectedBaseline.http_method,          mono: true, color: methodColor(selectedBaseline.http_method) },
                          { label: 'Expected Status', value: selectedBaseline.expected_status,       mono: true },
                          { label: 'Created',         value: new Date(selectedBaseline.created_at).toLocaleDateString() },
                        ].map(f => (
                          <div key={f.label} style={{
                            padding: '12px 14px', borderRadius: 9,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</div>
                            <div style={{
                              fontSize: 14, fontWeight: 600,
                              color: f.color || '#e2e8f0',
                              fontFamily: f.mono ? '"JetBrains Mono","Fira Code",monospace' : 'inherit',
                            }}>{f.value}</div>
                          </div>
                        ))}
                        <div style={{
                          gridColumn: '1/-1', padding: '12px 14px', borderRadius: 9,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>API URL</div>
                          <div style={{
                            fontSize: 13, color: CYAN,
                            fontFamily: '"JetBrains Mono","Fira Code",monospace',
                            wordBreak: 'break-all',
                          }}>{selectedBaseline.api_url}</div>
                        </div>
                      </div>

                      {/* Logs */}
                      {logs.length > 0 && (
                        <div style={{
                          background: '#050810',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 12, overflow: 'hidden',
                        }}>
                          <div style={{
                            padding: '8px 14px',
                            background: 'rgba(255,255,255,0.03)',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', gap: 7,
                          }}>
                            {['#ff5f57','#febc2e','#28c840'].map(c => (
                              <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.80 }} />
                            ))}
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                              regression.log
                            </span>
                          </div>
                          <div style={{ padding: 12, maxHeight: 160, overflowY: 'auto', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 11 }}>
                            {logs.map((log, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, lineHeight: 1.5, marginBottom: 2 }}>
                                <span style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>{log.timestamp}</span>
                                <span style={logColor(log.type)}>{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.20)' }}>
                      <GitCompare size={52} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.15 }} />
                      <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>Select a baseline from the list</p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.20)' }}>
                        Or create a new baseline to get started
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ─ Create Tab ─ */}
              {activeTab === 'create' && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={18} /> Create New Baseline
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* AI generate banner */}
                    <div style={{
                      padding: '16px 18px', borderRadius: 12,
                      background: 'rgba(167,139,250,0.10)',
                      border: '1px solid rgba(167,139,250,0.25)',
                    }}>
                      <div style={{ fontWeight: 700, color: '#a78bfa', fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Zap size={14} /> Describe in Plain English — AI fills the form
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input
                          type="text"
                          value={nlTestInput}
                          onChange={(e) => setNlTestInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleGenerateFromNL()}
                          placeholder='"Ensure users can still update their password"'
                          disabled={nlGenerating}
                          style={{ ...inputStyle, flex: 1, background: 'rgba(167,139,250,0.06)' }}
                        />
                        <button
                          onClick={handleGenerateFromNL}
                          disabled={nlGenerating || !nlTestInput.trim()}
                          style={{
                            padding: '0 18px', borderRadius: 9, fontWeight: 700, fontSize: 13,
                            border: 'none', cursor: nlGenerating || !nlTestInput.trim() ? 'not-allowed' : 'pointer',
                            background: nlGenerating || !nlTestInput.trim() ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                            color: '#fff', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                          }}
                        >
                          {nlGenerating
                            ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
                            : '✨ Generate'
                          }
                        </button>
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>— or fill manually —</div>

                    <div>
                      <label style={labelStyle}>Baseline Name *</label>
                      <input
                        type="text"
                        value={baselineForm.baseline_name}
                        onChange={(e) => setBaselineForm({ ...baselineForm, baseline_name: e.target.value })}
                        placeholder="e.g., User API v1.0"
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Description</label>
                      <input
                        type="text"
                        value={baselineForm.description}
                        onChange={(e) => setBaselineForm({ ...baselineForm, description: e.target.value })}
                        placeholder="Optional description"
                        style={inputStyle}
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>API URL *</label>
                      <input
                        type="text"
                        value={baselineForm.api_url}
                        onChange={(e) => setBaselineForm({ ...baselineForm, api_url: e.target.value })}
                        placeholder="https://api.example.com/users"
                        style={inputStyle}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>HTTP Method</label>
                        <select
                          value={baselineForm.http_method}
                          onChange={(e) => setBaselineForm({ ...baselineForm, http_method: e.target.value })}
                          style={{ ...inputStyle, cursor: 'pointer' }}
                        >
                          {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                            <option key={m} value={m} style={{ background: '#0a0e1a' }}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Expected Status</label>
                        <input
                          type="number"
                          value={baselineForm.expected_status}
                          onChange={(e) => setBaselineForm({ ...baselineForm, expected_status: e.target.value })}
                          style={inputStyle}
                        />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Max Response Time (ms) — optional</label>
                      <input
                        type="number"
                        value={baselineForm.expected_response_time_ms}
                        onChange={(e) => setBaselineForm({ ...baselineForm, expected_response_time_ms: e.target.value })}
                        placeholder="e.g., 500"
                        style={inputStyle}
                      />
                    </div>

                    {['POST', 'PUT', 'PATCH'].includes(baselineForm.http_method) && (
                      <div>
                        <label style={labelStyle}>Request Body (JSON)</label>
                        <textarea
                          value={baselineForm.request_body}
                          onChange={(e) => setBaselineForm({ ...baselineForm, request_body: e.target.value })}
                          placeholder='{"key": "value"}'
                          rows={4}
                          style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                        />
                      </div>
                    )}

                    <div>
                      <label style={labelStyle}>Custom Headers (JSON) — optional</label>
                      <textarea
                        value={baselineForm.custom_headers}
                        onChange={(e) => setBaselineForm({ ...baselineForm, custom_headers: e.target.value })}
                        placeholder='{"Authorization": "Bearer token"}'
                        rows={3}
                        style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                      />
                    </div>

                    {/* Info box */}
                    <div style={{
                      padding: '14px 16px', borderRadius: 10,
                      background: CYAN_DIM,
                      border: `1px solid rgba(34,211,238,0.20)`,
                      fontSize: 12, color: 'rgba(34,211,238,0.80)', lineHeight: 1.7,
                    }}>
                      <div style={{ fontWeight: 700, marginBottom: 6, color: CYAN }}>What happens when you create a baseline?</div>
                      <ul style={{ margin: 0, paddingLeft: 16 }}>
                        <li>We'll call your API and capture the current response</li>
                        <li>This becomes your baseline for future comparisons</li>
                        <li>Future tests will detect any changes from this baseline</li>
                        <li>You can run unlimited regression tests against this baseline</li>
                      </ul>
                    </div>

                    <button
                      onClick={createBaseline}
                      disabled={isCreatingBaseline || !baselineForm.baseline_name || !baselineForm.api_url}
                      style={{
                        width: '100%', padding: '13px 0',
                        borderRadius: 10, fontWeight: 700, fontSize: 14,
                        border: 'none',
                        cursor: isCreatingBaseline || !baselineForm.baseline_name || !baselineForm.api_url ? 'not-allowed' : 'pointer',
                        background: isCreatingBaseline || !baselineForm.baseline_name || !baselineForm.api_url
                          ? 'rgba(255,255,255,0.06)'
                          : 'linear-gradient(135deg,#0891b2,#0e7490)',
                        color: isCreatingBaseline || !baselineForm.baseline_name || !baselineForm.api_url ? 'rgba(255,255,255,0.30)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 0 20px rgba(8,145,178,0.25)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isCreatingBaseline
                        ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creating Baseline…</>
                        : 'Create Baseline'
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ─ Results Tab ─ */}
              {activeTab === 'results' && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <BarChart3 size={18} /> Test Results
                  </div>

                  {!testResults ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.20)' }}>
                      <BarChart3 size={52} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.15 }} />
                      <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No results yet</p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.20)' }}>Run a regression test to see results</p>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                      {/* Status banner */}
                      <div style={{
                        padding: '20px', borderRadius: 12, textAlign: 'center',
                        background: testResults.passed ? 'rgba(52,211,153,0.09)' : 'rgba(248,113,113,0.09)',
                        border: `1px solid ${testResults.passed ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                      }}>
                        {testResults.passed
                          ? <CheckCircle size={42} color="#34d399" style={{ margin: '0 auto 10px', display: 'block' }} />
                          : <XCircle size={42} color="#f87171" style={{ margin: '0 auto 10px', display: 'block' }} />
                        }
                        <div style={{ fontWeight: 800, fontSize: 18, color: testResults.passed ? '#34d399' : '#f87171', marginBottom: 4 }}>
                          {testResults.passed ? 'No Regressions Detected!' : 'Regressions Detected!'}
                        </div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                          {testResults.passed
                            ? 'API response matches baseline perfectly'
                            : `${testResults.differences.length} difference(s) found`
                          }
                        </div>
                      </div>

                      {/* Summary stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                        {[
                          { label: 'Total Checks',   value: testResults.summary.total_checks,                      color: '#e2e8f0' },
                          { label: 'Failed Checks',  value: testResults.summary.failed_checks,                     color: '#f87171' },
                          { label: 'Response Time',  value: `${testResults.test_response.response_time_ms}ms`,    color: CYAN },
                        ].map(s => (
                          <div key={s.label} style={{
                            padding: '14px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                            <div style={{ fontSize: 20, fontWeight: 800, color: s.color, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Differences */}
                      {testResults.differences && testResults.differences.length > 0 && (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 10 }}>Detected Differences</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {testResults.differences.map((diff, index) => (
                              <div key={index} style={{
                                padding: '14px 16px', borderRadius: 10,
                                background: 'rgba(248,113,113,0.07)',
                                border: '1px solid rgba(248,113,113,0.20)',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                                  <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                                  <div>
                                    <div style={{ fontWeight: 700, color: '#f87171', fontSize: 13 }}>
                                      {diff.type.replace('_', ' ').toUpperCase()}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{diff.message}</div>
                                  </div>
                                </div>

                                {diff.type === 'response_body' && diff.changes && (
                                  <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {diff.changes.slice(0, 10).map((change, idx) => (
                                      <div key={idx} style={{
                                        padding: '8px 10px', borderRadius: 7,
                                        background: 'rgba(0,0,0,0.25)',
                                        fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 11,
                                      }}>
                                        <div style={{ color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>Path: {change.path}</div>
                                        <div style={{ display: 'flex', gap: 16 }}>
                                          <div style={{ flex: 1 }}>
                                            <span style={{ color: '#f87171', display: 'flex', alignItems: 'center', gap: 4 }}>
                                              <TrendingDown size={11} /> Baseline: {JSON.stringify(change.baseline_value)}
                                            </span>
                                          </div>
                                          <div style={{ flex: 1 }}>
                                            <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: 4 }}>
                                              <TrendingUp size={11} /> Current: {JSON.stringify(change.current_value)}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                    {diff.changes.length > 10 && (
                                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)', textAlign: 'center' }}>
                                        … and {diff.changes.length - 10} more changes
                                      </div>
                                    )}
                                  </div>
                                )}

                                {diff.type === 'status_code' && (
                                  <div style={{
                                    display: 'flex', gap: 20, padding: '8px 10px', borderRadius: 7,
                                    background: 'rgba(0,0,0,0.25)',
                                    fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12,
                                  }}>
                                    <span style={{ color: '#f87171' }}>Expected: {diff.expected}</span>
                                    <span style={{ color: '#34d399' }}>Actual: {diff.actual}</span>
                                  </div>
                                )}

                                {diff.type === 'response_time' && (
                                  <div style={{
                                    display: 'flex', gap: 20, padding: '8px 10px', borderRadius: 7,
                                    background: 'rgba(0,0,0,0.25)',
                                    fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12,
                                  }}>
                                    <span style={{ color: '#f87171' }}>Max Allowed: {diff.expected_max}ms</span>
                                    <span style={{ color: '#34d399' }}>Actual: {diff.actual}ms</span>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response comparison */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        {[
                          { label: 'Baseline Response', body: testResults.baseline_response.body, color: 'rgba(255,255,255,0.35)' },
                          { label: 'Current Response',  body: testResults.test_response.body,     color: CYAN },
                        ].map(p => (
                          <div key={p.label} style={{
                            padding: '14px', borderRadius: 10,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: p.color, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.label}</div>
                            <pre style={{
                              margin: 0, padding: '10px 12px',
                              background: '#050810', borderRadius: 7,
                              fontSize: 10, overflowX: 'auto', maxHeight: 200,
                              color: 'rgba(255,255,255,0.55)',
                              fontFamily: '"JetBrains Mono","Fira Code",monospace',
                            }}>
                              {JSON.stringify(p.body, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ─ History Tab ─ */}
              {activeTab === 'history' && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 22, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <History size={18} /> Test History
                  </div>

                  {!testHistory ? (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.20)' }}>
                      <History size={52} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.15 }} />
                      <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.35)' }}>No history available</p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.20)' }}>Select a baseline and run tests to build history</p>
                    </div>
                  ) : (
                    <div>
                      {/* Stats */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                        {[
                          { label: 'Total',     value: testHistory.statistics.total_tests, color: '#e2e8f0' },
                          { label: 'Passed',    value: testHistory.statistics.passed,       color: '#34d399' },
                          { label: 'Failed',    value: testHistory.statistics.failed,       color: '#f87171' },
                          { label: 'Pass Rate', value: `${testHistory.statistics.pass_rate}%`, color: testHistory.statistics.pass_rate >= 80 ? '#34d399' : '#fbbf24' },
                        ].map(s => (
                          <div key={s.label} style={{
                            padding: '12px', borderRadius: 9,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                            <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>{s.value}</div>
                          </div>
                        ))}
                      </div>

                      {/* Timeline */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {testHistory.results.map((result) => (
                          <div key={result.result_id} style={{
                            padding: '12px 16px', borderRadius: 10,
                            background: result.passed ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                            border: `1px solid ${result.passed ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              {result.passed
                                ? <CheckCircle size={16} color="#34d399" />
                                : <XCircle size={16} color="#f87171" />
                              }
                              <div>
                                <div style={{ fontWeight: 600, fontSize: 13, color: result.passed ? '#34d399' : '#f87171' }}>
                                  {result.passed ? 'Passed' : 'Failed'}
                                </div>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                                  {new Date(result.created_at).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 16, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.35)' }}>Status </span>
                                <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{result.status_code}</span>
                              </div>
                              <div>
                                <span style={{ color: 'rgba(255,255,255,0.35)' }}>Time </span>
                                <span style={{ color: CYAN, fontWeight: 700 }}>{result.response_time_ms}ms</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default RegressionTestingApp;
