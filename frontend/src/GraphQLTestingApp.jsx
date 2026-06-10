import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Play, Download, AlertCircle, CheckCircle, XCircle, Zap, Code, Database, TrendingUp, ChevronDown, ChevronRight, Search, Plus, List, LogOut, RefreshCw } from 'lucide-react';
import BackButton from './BackButton';
import Toast from './Toast';
import { saveTestRun } from './testHistoryUtils.js';
import RecentRuns from './RecentRuns.jsx';

const FUCHSIA = '#e879f9';
const FUCHSIA_DIM = 'rgba(232,121,249,0.12)';
const FUCHSIA_BORDER = 'rgba(232,121,249,0.25)';

const GraphQLTestingApp = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [graphqlEndpoint, setGraphqlEndpoint] = useState('');
  const [authConfig, setAuthConfig] = useState({ type: 'none' });
  const [schema, setSchema] = useState(null);
  const [loading, setLoading] = useState(false);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [customQuery, setCustomQuery] = useState('');
  const [selectedTestTypes, setSelectedTestTypes] = useState({
    queries: true,
    mutations: true,
    nested: true,
    fragments: true,
    errors: true,
    performance: true
  });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  // Natural Language Query Builder states
  const [nlDescription, setNlDescription] = useState('');
  const [nlGenerating, setNlGenerating] = useState(false);
  const [generatedQuery, setGeneratedQuery] = useState('');
  const [queryExplanation, setQueryExplanation] = useState('');
  const [expandedSections, setExpandedSections] = useState({ queries: true, mutations: true, types: false });
  const [schemaSearch, setSchemaSearch] = useState('');

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  const addTestFromSchemaExplorer = (operation, opType) => {
    const resolveType = (t) => (typeof t === 'string' ? t : t?.name || 'String');
    const args = operation.args || [];
    const argsDef = args.map(a => `$${a.name}: ${resolveType(a.type)}`).join(', ');
    const argsCall = args.map(a => `${a.name}: $${a.name}`).join(', ');
    const callStr = argsCall ? `${operation.name}(${argsCall})` : operation.name;
    const varStr = argsDef ? `(${argsDef})` : '';

    const query = opType === 'mutation'
      ? `mutation${varStr} {\n  ${callStr} {\n    id\n  }\n}`
      : `query${varStr} {\n  ${callStr} {\n    id\n    name\n  }\n}`;

    const newTest = {
      type: opType,
      name: `Explorer: ${operation.name}`,
      query,
      description: `Added from schema explorer`
    };

    setGeneratedTests(prev => {
      const updated = [...prev, newTest];
      if (updated.length === 1) setStep(3);
      return updated;
    });
    showToast(`Added test for ${operation.name}`, 'success');
  };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('graphqlTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.graphqlEndpoint) setGraphqlEndpoint(state.graphqlEndpoint);
        if (state.authConfig) setAuthConfig(state.authConfig);
        if (state.schema) setSchema(state.schema);
        if (state.generatedTests) setGeneratedTests(state.generatedTests);
        if (state.testResults) setTestResults(state.testResults);
        if (state.customQuery) setCustomQuery(state.customQuery);
        if (state.selectedTestTypes) setSelectedTestTypes(state.selectedTestTypes);
        if (state.step) setStep(state.step);
      } catch (e) {
        console.error('Failed to load saved GraphQL Testing state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    const stateToSave = {
      graphqlEndpoint,
      authConfig,
      schema,
      generatedTests,
      testResults,
      customQuery,
      selectedTestTypes,
      step,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('graphqlTestingState', JSON.stringify(stateToSave));
  }, [graphqlEndpoint, authConfig, schema, generatedTests, testResults, customQuery, selectedTestTypes, step]);

  // Step 1: Discover GraphQL Schema
  const discoverSchema = async () => {
    if (!graphqlEndpoint.trim()) {
      showToast('Please enter a GraphQL endpoint', 'error');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showToast('You are not logged in. Please refresh the page and log in again.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/graphql/discover-schema`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: graphqlEndpoint,
          auth_config: authConfig
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Session expired. Please refresh the page and log in again.');
        }
        throw new Error(data.detail || 'Failed to discover schema');
      }

      setSchema(data.schema);
      showToast('Schema discovered successfully!', 'success');
      setStep(2);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Generate AI-Powered Tests
  const generateTests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showToast('You are not logged in. Please refresh the page and log in again.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/graphql/generate-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: graphqlEndpoint,
          schema: schema,
          auth_config: authConfig,
          test_types: selectedTestTypes,
          num_tests: 50
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate tests');
      }

      setGeneratedTests(data.tests);
      showToast(`Generated ${data.tests.length} AI-powered tests!`, 'success');
      setStep(3);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Run Tests
  const runTests = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showToast('You are not logged in. Please refresh the page and log in again.', 'error');
        setLoading(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/graphql/run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: graphqlEndpoint,
          auth_config: authConfig,
          tests: generatedTests
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to run tests');
      }

      setTestResults(data);
      saveTestRun({
        module: 'graphql',
        apiUrl: graphqlEndpoint,
        totalTests: data.summary?.total ?? 0,
        passed: data.summary?.passed ?? 0,
        failed: data.summary?.failed ?? 0,
        overallStatus: (data.summary?.failed ?? 0) === 0 ? 'PASS' : 'FAIL'
      });
      showToast('Tests completed successfully!', 'success');
      setStep(4);
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Add custom query
  const addCustomQuery = () => {
    if (!customQuery.trim()) {
      showToast('Please enter a query', 'error');
      return;
    }

    const newTest = {
      type: 'custom',
      name: 'Custom Query',
      query: customQuery,
      description: 'User-defined custom query'
    };

    setGeneratedTests([...generatedTests, newTest]);
    setCustomQuery('');
    showToast('Custom query added!', 'success');
  };

  // Natural Language to GraphQL Query
  const generateQueryFromNL = async () => {
    if (!nlDescription.trim()) {
      showToast('Please describe what you want to query', 'error');
      return;
    }

    if (!schema) {
      showToast('Please discover schema first', 'error');
      return;
    }

    setNlGenerating(true);
    setGeneratedQuery('');
    setQueryExplanation('');

    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showToast('You are not logged in. Please refresh the page and log in again.', 'error');
        setNlGenerating(false);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/graphql/nl-to-query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: nlDescription,
          schema: schema
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to generate query');
      }

      setGeneratedQuery(data.query);
      setQueryExplanation(data.explanation);
      setCustomQuery(data.query); // Auto-fill the custom query field
      showToast('Query generated successfully!', 'success');

    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setNlGenerating(false);
    }
  };

  const resetSession = () => {
    setStep(1);
    setGraphqlEndpoint('');
    setSchema(null);
    setGeneratedTests([]);
    setTestResults(null);
    setCustomQuery('');
    setNlDescription('');
    setGeneratedQuery('');
    setQueryExplanation('');
    setSchemaSearch('');
    localStorage.removeItem('graphqlTestingState');
  };

  // Download report
  const downloadReport = async (format) => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        showToast('You are not logged in. Please refresh the page and log in again.', 'error');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/graphql/download-report/${format}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          endpoint: graphqlEndpoint,
          results: testResults
        })
      });

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `graphql-test-report-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      showToast('Report downloaded!', 'success');
    } catch (error) {
      showToast('Failed to download report', 'error');
    }
  };

  // ── Shared style tokens
  const card = {
    background: 'rgba(9,12,22,0.80)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    backdropFilter: 'blur(20px)',
    padding: 28,
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 10,
    padding: '11px 14px',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 6,
  };

  const btnPrimary = {
    width: '100%',
    background: `linear-gradient(135deg, #a21caf 0%, #7c3aed 100%)`,
    border: 'none',
    borderRadius: 10,
    padding: '13px 20px',
    color: '#fff',
    fontWeight: 700,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const btnSecondary = {
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderRadius: 10,
    padding: '12px 20px',
    color: 'rgba(255,255,255,0.7)',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  };

  const testTypeMeta = {
    queries:     { label: 'Query Tests',       desc: 'Test all queries',            color: FUCHSIA },
    mutations:   { label: 'Mutation Tests',     desc: 'Test all mutations',          color: '#34d399' },
    nested:      { label: 'Nested Queries',     desc: 'Test deep relationships',     color: '#60a5fa' },
    fragments:   { label: 'Fragment Tests',     desc: 'Test reusable fragments',     color: '#fbbf24' },
    errors:      { label: 'Error Handling',     desc: 'Test error scenarios',        color: '#f87171' },
    performance: { label: 'Performance Tests',  desc: 'N+1 detection & complexity',  color: '#a78bfa' },
  };

  const testTypeBadgeColor = { query: '#60a5fa', mutation: '#34d399', performance: '#a78bfa', custom: '#fbbf24' };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#020408 0%,#060c18 50%,#020408 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      position: 'relative',
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .gql-input:focus { border-color: ${FUCHSIA_BORDER} !important; box-shadow: 0 0 0 3px ${FUCHSIA_DIM}; }
        .gql-btn-primary:hover { opacity: 0.88; }
        .gql-btn-secondary:hover { background: rgba(255,255,255,0.10) !important; color: #fff !important; }
        .gql-card-hover:hover { border-color: rgba(232,121,249,0.20) !important; }
        .gql-explorer-row:hover { background: rgba(255,255,255,0.04); }
        .gql-explorer-row:hover .gql-add-btn { opacity: 1 !important; }
      `}</style>

      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(232,121,249,0.08) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}

      {/* ── Sticky Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(2,4,8,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        height: 60,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', width: '100%',
          padding: '0 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <BackButton />
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg,#a21caf,#7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 16px rgba(232,121,249,0.35)`,
            }}>
              <Database size={18} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>GraphQL API Testing</div>
              <div style={{ fontSize: 11, color: 'rgba(232,121,249,0.7)' }}>Schema introspection · N+1 detection · AI validation</div>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step > 1 && (
              <button
                onClick={resetSession}
                style={{ ...btnSecondary, width: 'auto', padding: '7px 14px', fontSize: 12, gap: 6 }}
                className="gql-btn-secondary"
                title="Clear session and start over"
              >
                <RefreshCw size={13} /> New Test
              </button>
            )}
            {user && (
              <>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 8,
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%',
                    background: 'linear-gradient(135deg,#a21caf,#7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff',
                  }}>
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ fontSize: 13, color: '#fff' }}>{user.username}</span>
                </div>
                <button
                  onClick={onLogout}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '7px 12px',
                    background: 'rgba(220,38,38,0.15)',
                    border: '1px solid rgba(220,38,38,0.30)',
                    borderRadius: 8, color: '#f87171',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <LogOut size={13} /> Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Page body */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '36px 28px', position: 'relative', zIndex: 1 }}>

        {/* ── Step Progress Indicator */}
        <div style={{ marginBottom: 36, display: 'flex', alignItems: 'center' }}>
          {[
            { num: 1, label: 'Configure', Icon: Code },
            { num: 2, label: 'Generate Tests', Icon: Zap },
            { num: 3, label: 'Run Tests', Icon: Play },
            { num: 4, label: 'Results', Icon: TrendingUp },
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: step >= s.num
                    ? `linear-gradient(135deg,#a21caf,#7c3aed)`
                    : 'rgba(255,255,255,0.05)',
                  border: step >= s.num
                    ? `2px solid ${FUCHSIA}`
                    : '2px solid rgba(255,255,255,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: step >= s.num ? `0 0 14px rgba(232,121,249,0.35)` : 'none',
                  transition: 'all 0.3s',
                }}>
                  <s.Icon size={18} color={step >= s.num ? '#fff' : 'rgba(255,255,255,0.3)'} />
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: step >= s.num ? FUCHSIA : 'rgba(255,255,255,0.3)',
                  letterSpacing: '0.04em',
                }}>
                  {s.label}
                </span>
              </div>
              {idx < 3 && (
                <div style={{
                  flex: 1, height: 2, margin: '0 10px', marginBottom: 24,
                  background: step > s.num
                    ? `linear-gradient(90deg,#a21caf,${FUCHSIA})`
                    : 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  transition: 'background 0.3s',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ────────────────────────────────────────
            STEP 1 — Configure
        ──────────────────────────────────────── */}
        {step === 1 && (
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={card}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Code size={18} color={FUCHSIA} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Configure GraphQL Endpoint</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Connect and discover your schema</div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Endpoint */}
                <div>
                  <label style={labelStyle}>GraphQL Endpoint URL *</label>
                  <input
                    type="text"
                    value={graphqlEndpoint}
                    onChange={(e) => setGraphqlEndpoint(e.target.value)}
                    placeholder="https://api.example.com/graphql"
                    style={inputStyle}
                    className="gql-input"
                  />
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>
                    We'll automatically discover the schema using introspection.
                  </div>
                </div>

                {/* Auth type */}
                <div>
                  <label style={labelStyle}>Authentication</label>
                  <select
                    value={authConfig.type}
                    onChange={(e) => setAuthConfig({ ...authConfig, type: e.target.value })}
                    style={{ ...inputStyle, appearance: 'none' }}
                    className="gql-input"
                  >
                    <option value="none">No Authentication</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>

                {/* Bearer */}
                {authConfig.type === 'bearer' && (
                  <div>
                    <label style={labelStyle}>Bearer Token</label>
                    <input
                      type="password"
                      value={authConfig.token || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                      placeholder="Your bearer token"
                      style={inputStyle}
                      className="gql-input"
                    />
                  </div>
                )}

                {/* API Key */}
                {authConfig.type === 'api_key' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Header Name</label>
                      <input
                        type="text"
                        value={authConfig.key_name || ''}
                        onChange={(e) => setAuthConfig({ ...authConfig, key_name: e.target.value })}
                        placeholder="X-API-Key"
                        style={inputStyle}
                        className="gql-input"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>API Key</label>
                      <input
                        type="password"
                        value={authConfig.api_key || ''}
                        onChange={(e) => setAuthConfig({ ...authConfig, api_key: e.target.value })}
                        placeholder="Your API key"
                        style={inputStyle}
                        className="gql-input"
                      />
                    </div>
                  </div>
                )}

                {/* Basic */}
                {authConfig.type === 'basic' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Username</label>
                      <input
                        type="text"
                        value={authConfig.username || ''}
                        onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                        placeholder="Username"
                        style={inputStyle}
                        className="gql-input"
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Password</label>
                      <input
                        type="password"
                        value={authConfig.password || ''}
                        onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                        placeholder="Password"
                        style={inputStyle}
                        className="gql-input"
                      />
                    </div>
                  </div>
                )}

                {/* Discover button */}
                <button
                  onClick={discoverSchema}
                  disabled={loading}
                  style={{ ...btnPrimary, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                  className="gql-btn-primary"
                >
                  {loading ? (
                    <>
                      <div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Discovering Schema...
                    </>
                  ) : (
                    <>
                      <Database size={17} />
                      Discover Schema
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────
            STEP 2 — Generate Tests
        ──────────────────────────────────────── */}
        {step === 2 && schema && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={card}>
              {/* Card header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Zap size={18} color={FUCHSIA} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>AI-Powered Test Generation</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Explore schema and configure test types</div>
                </div>
              </div>

              {/* Schema info strip */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14,
                marginBottom: 28,
              }}>
                {[
                  { val: schema.queries?.length || 0, label: 'Queries', color: FUCHSIA },
                  { val: schema.mutations?.length || 0, label: 'Mutations', color: '#34d399' },
                  { val: schema.types?.length || 0, label: 'Types', color: '#60a5fa' },
                ].map(({ val, label, color }) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '16px 18px',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 4 }}>{val}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* Schema Explorer */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <List size={15} color={FUCHSIA} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>Schema Explorer</span>
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.35)' }} />
                    <input
                      type="text"
                      value={schemaSearch}
                      onChange={(e) => setSchemaSearch(e.target.value)}
                      placeholder="Search operations..."
                      style={{ ...inputStyle, width: 200, paddingLeft: 32, fontSize: 12, padding: '8px 12px 8px 32px' }}
                      className="gql-input"
                    />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
                  Browse discovered operations. Hover any row and click <span style={{ color: FUCHSIA }}>+</span> to cherry-pick individual tests, or use <strong style={{ color: 'rgba(255,255,255,0.6)' }}>Generate AI Tests</strong> for full coverage.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {/* Queries */}
                  {schema.queries?.length > 0 && (
                    <div style={{ border: `1px solid ${FUCHSIA_BORDER}`, borderRadius: 10, overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedSections(s => ({ ...s, queries: !s.queries }))}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', background: 'rgba(232,121,249,0.06)',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        {expandedSections.queries
                          ? <ChevronDown size={14} color={FUCHSIA} />
                          : <ChevronRight size={14} color={FUCHSIA} />}
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: FUCHSIA }}>QUERIES</span>
                        <span style={{
                          padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                          background: FUCHSIA_DIM, color: FUCHSIA, border: `1px solid ${FUCHSIA_BORDER}`,
                        }}>{schema.queries.length}</span>
                      </button>
                      {expandedSections.queries && (
                        <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: `1px solid ${FUCHSIA_BORDER}` }}>
                          {schema.queries
                            .filter(q => !schemaSearch || q.name?.toLowerCase().includes(schemaSearch.toLowerCase()))
                            .map((q, idx) => (
                              <div key={idx} className="gql-explorer-row" style={{
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#fff' }}>{q.name}</span>
                                    {q.type && (
                                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: FUCHSIA }}>
                                        → {typeof q.type === 'string' ? q.type : q.type?.name || 'Object'}
                                      </span>
                                    )}
                                  </div>
                                  {q.args?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {q.args.map((arg, i) => (
                                        <span key={i} style={{
                                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                                          fontFamily: 'monospace',
                                        }}>
                                          {arg.name}: {typeof arg.type === 'string' ? arg.type : arg.type?.name || 'String'}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => addTestFromSchemaExplorer(q, 'query')}
                                  className="gql-add-btn"
                                  style={{
                                    marginLeft: 10, padding: 6, borderRadius: 6,
                                    background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                                    color: FUCHSIA, cursor: 'pointer', opacity: 0,
                                    display: 'flex', alignItems: 'center', transition: 'opacity 0.15s',
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Mutations */}
                  {schema.mutations?.length > 0 && (
                    <div style={{ border: '1px solid rgba(52,211,153,0.25)', borderRadius: 10, overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedSections(s => ({ ...s, mutations: !s.mutations }))}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', background: 'rgba(52,211,153,0.06)',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        {expandedSections.mutations
                          ? <ChevronDown size={14} color="#34d399" />
                          : <ChevronRight size={14} color="#34d399" />}
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#34d399' }}>MUTATIONS</span>
                        <span style={{
                          padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                          background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)',
                        }}>{schema.mutations.length}</span>
                      </button>
                      {expandedSections.mutations && (
                        <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid rgba(52,211,153,0.20)' }}>
                          {schema.mutations
                            .filter(m => !schemaSearch || m.name?.toLowerCase().includes(schemaSearch.toLowerCase()))
                            .map((m, idx) => (
                              <div key={idx} className="gql-explorer-row" style={{
                                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                              }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#fff' }}>{m.name}</span>
                                    {m.type && (
                                      <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#34d399' }}>
                                        → {typeof m.type === 'string' ? m.type : m.type?.name || 'Object'}
                                      </span>
                                    )}
                                  </div>
                                  {m.args?.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                      {m.args.map((arg, i) => (
                                        <span key={i} style={{
                                          fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                                          fontFamily: 'monospace',
                                        }}>
                                          {arg.name}: {typeof arg.type === 'string' ? arg.type : arg.type?.name || 'String'}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <button
                                  onClick={() => addTestFromSchemaExplorer(m, 'mutation')}
                                  className="gql-add-btn"
                                  style={{
                                    marginLeft: 10, padding: 6, borderRadius: 6,
                                    background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)',
                                    color: '#34d399', cursor: 'pointer', opacity: 0,
                                    display: 'flex', alignItems: 'center', transition: 'opacity 0.15s',
                                  }}
                                >
                                  <Plus size={13} />
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Types */}
                  {schema.types?.length > 0 && (
                    <div style={{ border: '1px solid rgba(96,165,250,0.25)', borderRadius: 10, overflow: 'hidden' }}>
                      <button
                        onClick={() => setExpandedSections(s => ({ ...s, types: !s.types }))}
                        style={{
                          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', background: 'rgba(96,165,250,0.06)',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        {expandedSections.types
                          ? <ChevronDown size={14} color="#60a5fa" />
                          : <ChevronRight size={14} color="#60a5fa" />}
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#60a5fa' }}>TYPES</span>
                        <span style={{
                          padding: '1px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                          background: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)',
                        }}>{schema.types.length}</span>
                      </button>
                      {expandedSections.types && (
                        <div style={{ maxHeight: 240, overflowY: 'auto', borderTop: '1px solid rgba(96,165,250,0.20)' }}>
                          {schema.types
                            .filter(t => !schemaSearch || t.name?.toLowerCase().includes(schemaSearch.toLowerCase()))
                            .map((t, idx) => (
                              <div key={idx} style={{ padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{t.name}</div>
                                {t.fields?.length > 0 && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                    {t.fields.map((field, i) => (
                                      <span key={i} style={{
                                        fontSize: 10, padding: '2px 6px', borderRadius: 4,
                                        background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                                        fontFamily: 'monospace',
                                      }}>
                                        {field.name}: {typeof field.type === 'string' ? field.type : field.type?.name || 'String'}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {generatedTests.length > 0 && (
                  <div style={{
                    marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                    borderRadius: 10, padding: '10px 16px',
                  }}>
                    <span style={{ fontSize: 13, color: FUCHSIA }}>
                      {generatedTests.length} test{generatedTests.length !== 1 ? 's' : ''} cherry-picked
                    </span>
                    <button
                      onClick={() => setStep(3)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        background: 'linear-gradient(135deg,#a21caf,#7c3aed)',
                        border: 'none', color: '#fff', cursor: 'pointer',
                      }}
                    >
                      Review Selected →
                    </button>
                  </div>
                )}
              </div>

              {/* Test Type Selection */}
              <div style={{ marginBottom: 28 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 14 }}>Select Test Types</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {Object.entries(testTypeMeta).map(([key, meta]) => (
                    <label key={key} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '12px 16px', borderRadius: 10,
                      background: selectedTestTypes[key] ? `rgba(${key === 'queries' ? '232,121,249' : key === 'mutations' ? '52,211,153' : key === 'nested' ? '96,165,250' : key === 'fragments' ? '251,191,36' : key === 'errors' ? '248,113,113' : '167,139,250'},0.08)` : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${selectedTestTypes[key] ? meta.color + '40' : 'rgba(255,255,255,0.07)'}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}>
                      <input
                        type="checkbox"
                        checked={selectedTestTypes[key]}
                        onChange={(e) => setSelectedTestTypes({ ...selectedTestTypes, [key]: e.target.checked })}
                        style={{ width: 15, height: 15, accentColor: meta.color }}
                      />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{meta.label}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{meta.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => setStep(1)}
                  style={{ ...btnSecondary, flex: 1 }}
                  className="gql-btn-secondary"
                >
                  Back
                </button>
                <button
                  onClick={generateTests}
                  disabled={loading}
                  style={{ ...btnPrimary, flex: 1, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                  className="gql-btn-primary"
                >
                  {loading ? (
                    <>
                      <div style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Generating Tests...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Generate AI Tests
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────
            STEP 3 — Review & Run Tests
        ──────────────────────────────────────── */}
        {step === 3 && generatedTests.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary + NL builder + custom */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Play size={18} color={FUCHSIA} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Review & Run Tests</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Inspect, add custom queries, then execute</div>
                </div>
              </div>

              {/* 4-stat grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { val: generatedTests.length, label: 'Total Tests', color: '#fff' },
                  { val: generatedTests.filter(t => t.type === 'query').length, label: 'Query Tests', color: '#60a5fa' },
                  { val: generatedTests.filter(t => t.type === 'mutation').length, label: 'Mutation Tests', color: '#34d399' },
                  { val: generatedTests.filter(t => t.type === 'performance').length, label: 'Performance', color: FUCHSIA },
                ].map(({ val, label, color }) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, padding: '14px 16px', textAlign: 'center',
                  }}>
                    <div style={{ fontSize: 26, fontWeight: 800, color, marginBottom: 4 }}>{val}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* AI Query Builder */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(162,28,175,0.15) 0%, rgba(124,58,237,0.10) 100%)',
                border: `1px solid ${FUCHSIA_BORDER}`,
                borderRadius: 14, padding: 20, marginBottom: 20,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <Zap size={16} color={FUCHSIA} />
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>AI Query Builder</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                    background: 'linear-gradient(135deg,#a21caf,#7c3aed)', color: '#fff',
                  }}>NEW</span>
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 14 }}>
                  Describe what you want to query in plain English — AI generates the GraphQL for you.
                </div>

                <div style={{ marginBottom: 12 }}>
                  <label style={labelStyle}>Describe your query</label>
                  <input
                    type="text"
                    value={nlDescription}
                    onChange={(e) => setNlDescription(e.target.value)}
                    placeholder="e.g., Get all countries with their languages and currencies"
                    style={inputStyle}
                    className="gql-input"
                    onKeyPress={(e) => { if (e.key === 'Enter') generateQueryFromNL(); }}
                  />
                </div>

                <button
                  onClick={generateQueryFromNL}
                  disabled={nlGenerating}
                  style={{
                    ...btnPrimary,
                    background: 'linear-gradient(135deg,#a21caf,#4f46e5)',
                    opacity: nlGenerating ? 0.6 : 1,
                    cursor: nlGenerating ? 'not-allowed' : 'pointer',
                  }}
                  className="gql-btn-primary"
                >
                  {nlGenerating ? (
                    <>
                      <div style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Generating Query with AI...
                    </>
                  ) : (
                    <>
                      <Zap size={16} />
                      Generate GraphQL Query
                    </>
                  )}
                </button>

                {generatedQuery && (
                  <div style={{
                    marginTop: 14, padding: 14,
                    background: 'rgba(52,211,153,0.07)', border: '1px solid rgba(52,211,153,0.25)',
                    borderRadius: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <CheckCircle size={15} color="#34d399" />
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>Query Generated!</span>
                    </div>
                    {queryExplanation && (
                      <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 10, fontStyle: 'italic' }}>{queryExplanation}</p>
                    )}
                    <pre style={{
                      fontFamily: 'monospace', fontSize: 12, color: '#e2e8f0',
                      background: 'rgba(0,0,0,0.35)', padding: 12, borderRadius: 8,
                      overflowX: 'auto', whiteSpace: 'pre-wrap', margin: 0,
                    }}>
                      {generatedQuery}
                    </pre>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                      Query auto-filled below. Edit before adding to tests.
                    </div>
                  </div>
                )}
              </div>

              {/* Custom query */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 14, padding: 20, marginBottom: 20,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Add Custom Query</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 12 }}>
                  Manually write or edit the AI-generated query below:
                </div>
                <textarea
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="query { users { id name email } }"
                  style={{ ...inputStyle, height: 110, fontFamily: 'monospace', fontSize: 12, resize: 'vertical' }}
                  className="gql-input"
                />
                <button
                  onClick={addCustomQuery}
                  style={{
                    ...btnSecondary,
                    marginTop: 12, width: 'auto', padding: '9px 18px',
                    border: `1px solid ${FUCHSIA_BORDER}`, color: FUCHSIA,
                    fontSize: 13,
                  }}
                  className="gql-btn-secondary"
                >
                  Add Custom Query
                </button>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep(2)} style={{ ...btnSecondary, flex: 1 }} className="gql-btn-secondary">
                  Back
                </button>
                <button
                  onClick={runTests}
                  disabled={loading}
                  style={{ ...btnPrimary, flex: 1, opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                  className="gql-btn-primary"
                >
                  {loading ? (
                    <>
                      <div style={{ width: 17, height: 17, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <Play size={16} />
                      Run All Tests ({generatedTests.length})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Preview */}
            <div style={card}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Test Preview (First 5)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {generatedTests.slice(0, 5).map((test, idx) => (
                  <div key={idx} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 10, padding: '12px 16px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{test.name}</span>
                      <span style={{
                        padding: '3px 10px', borderRadius: 99, fontSize: 10, fontWeight: 700,
                        background: `${testTypeBadgeColor[test.type] || '#888'}22`,
                        color: testTypeBadgeColor[test.type] || '#888',
                        border: `1px solid ${testTypeBadgeColor[test.type] || '#888'}44`,
                        textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {test.type}
                      </span>
                    </div>
                    <pre style={{
                      fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)',
                      overflowX: 'auto', whiteSpace: 'pre-wrap', margin: 0,
                    }}>
                      {test.query?.substring(0, 100)}...
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────
            STEP 4 — Results
        ──────────────────────────────────────── */}
        {step === 4 && testResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Summary card */}
            <div style={card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <TrendingUp size={18} color={FUCHSIA} />
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>Test Results</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>GraphQL test suite execution complete</div>
                </div>
              </div>

              {/* 4 stat cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
                <div style={{
                  background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)',
                  borderRadius: 14, padding: 20,
                }}>
                  <CheckCircle size={22} color="#34d399" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#34d399' }}>{testResults.summary?.passed || 0}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Passed</div>
                </div>
                <div style={{
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)',
                  borderRadius: 14, padding: 20,
                }}>
                  <XCircle size={22} color="#f87171" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#f87171' }}>{testResults.summary?.failed || 0}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Failed</div>
                </div>
                <div style={{
                  background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.25)',
                  borderRadius: 14, padding: 20,
                }}>
                  <Zap size={22} color="#60a5fa" style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: '#60a5fa' }}>{testResults.summary?.avg_response_time || 0}ms</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>Avg Response</div>
                </div>
                <div style={{
                  background: FUCHSIA_DIM, border: `1px solid ${FUCHSIA_BORDER}`,
                  borderRadius: 14, padding: 20,
                }}>
                  <AlertCircle size={22} color={FUCHSIA} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 28, fontWeight: 800, color: FUCHSIA }}>{testResults.summary?.n_plus_one_detected || 0}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>N+1 Detected</div>
                </div>
              </div>

              {/* AI Insights */}
              {testResults.ai_insights && (
                <div style={{
                  background: 'linear-gradient(135deg,rgba(162,28,175,0.18) 0%,rgba(79,70,229,0.12) 100%)',
                  border: `1px solid ${FUCHSIA_BORDER}`,
                  borderRadius: 14, padding: 20, marginBottom: 20,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Zap size={15} color={FUCHSIA} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#fff' }}>AI-Powered Insights</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {testResults.ai_insights.recommendations?.map((rec, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <CheckCircle size={14} color="#34d399" style={{ marginTop: 2, flexShrink: 0 }} />
                        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', margin: 0, lineHeight: 1.5 }}>{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download + New Test */}
              <div style={{ display: 'flex', gap: 12 }}>
                <button
                  onClick={() => downloadReport('json')}
                  style={{ ...btnSecondary, flex: 1, border: '1px solid rgba(96,165,250,0.35)', color: '#60a5fa' }}
                  className="gql-btn-secondary"
                >
                  <Download size={15} /> Download JSON
                </button>
                <button
                  onClick={() => downloadReport('pdf')}
                  style={{ ...btnSecondary, flex: 1, border: `1px solid ${FUCHSIA_BORDER}`, color: FUCHSIA }}
                  className="gql-btn-secondary"
                >
                  <FileText size={15} /> Download PDF
                </button>
                <button
                  onClick={() => { setStep(1); setGeneratedTests([]); setTestResults(null); setSchema(null); }}
                  style={{ ...btnSecondary, flex: 1 }}
                  className="gql-btn-secondary"
                >
                  New Test
                </button>
              </div>
            </div>

            {/* Recent Runs */}
            <div style={{ ...card, padding: 20 }}>
              <RecentRuns module="graphql" />
            </div>

            {/* Detailed results */}
            <div style={card}>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Detailed Test Results</div>

              {/* Terminal header dots */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
              </div>

              <div style={{ maxHeight: 420, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {testResults.results?.map((result, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 10,
                      borderLeft: `3px solid ${result.status === 'PASS' ? '#34d399' : '#f87171'}`,
                      background: result.status === 'PASS'
                        ? 'rgba(52,211,153,0.05)'
                        : 'rgba(248,113,113,0.05)',
                      border: `1px solid ${result.status === 'PASS' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                      borderLeftWidth: 3,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: result.error || result.n_plus_one_warning ? 8 : 0 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{result.test_name}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontFamily: 'monospace' }}>{result.response_time}ms</span>
                        {result.status === 'PASS'
                          ? <CheckCircle size={16} color="#34d399" />
                          : <XCircle size={16} color="#f87171" />
                        }
                      </div>
                    </div>
                    {result.error && (
                      <p style={{ fontSize: 12, color: '#fca5a5', margin: '4px 0 0' }}>{result.error}</p>
                    )}
                    {result.n_plus_one_warning && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                        <AlertCircle size={13} color="#fbbf24" />
                        <span style={{ fontSize: 12, color: '#fbbf24' }}>N+1 Query Detected</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GraphQLTestingApp;
