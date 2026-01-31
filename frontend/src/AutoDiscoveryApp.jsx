import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  Globe,
  Shield,
  Zap,
  ArrowLeft,
  Play,
  Download,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Lock,
  Unlock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileText,
  Bug,
  Activity,
  User,
  LogOut,
  Info,
  Copy,
  Check
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function AutoDiscoveryApp({ user, onLogout }) {
  const navigate = useNavigate();

  // State
  const [targetUrl, setTargetUrl] = useState('');
  const [discoveryState, setDiscoveryState] = useState('idle'); // idle, discovering, complete, error
  const [liveProgress, setLiveProgress] = useState([]);
  const [discoveredEndpoints, setDiscoveredEndpoints] = useState([]);
  const [securityScore, setSecurityScore] = useState(null);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [error, setError] = useState(null);
  const [metadata, setMetadata] = useState(null);

  // Auth config state
  const [authType, setAuthType] = useState('none');
  const [authToken, setAuthToken] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyHeader, setApiKeyHeader] = useState('X-API-Key');
  const [basicUsername, setBasicUsername] = useState('');
  const [basicPassword, setBasicPassword] = useState('');

  // Test running state
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState(null);

  // UI state
  const [showAuthConfig, setShowAuthConfig] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    endpoints: true,
    security: true,
    tests: true
  });
  const [selectedTests, setSelectedTests] = useState(new Set());
  const [copiedEndpoint, setCopiedEndpoint] = useState(null);

  const abortControllerRef = useRef(null);

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('autoDiscoveryState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.targetUrl) setTargetUrl(state.targetUrl);
        if (state.discoveredEndpoints) setDiscoveredEndpoints(state.discoveredEndpoints);
        if (state.securityScore) setSecurityScore(state.securityScore);
        if (state.generatedTests) setGeneratedTests(state.generatedTests);
        if (state.metadata) setMetadata(state.metadata);
        if (state.testResults) setTestResults(state.testResults);
        if (state.discoveryState && state.discoveryState !== 'discovering') {
          setDiscoveryState(state.discoveryState);
        }
        // Restore auth config
        if (state.authType) setAuthType(state.authType);
        if (state.authToken) setAuthToken(state.authToken);
        if (state.apiKey) setApiKey(state.apiKey);
        if (state.apiKeyHeader) setApiKeyHeader(state.apiKeyHeader);
        // Auto-select all tests if we have them
        if (state.generatedTests?.length > 0) {
          setSelectedTests(new Set(state.generatedTests.map(t => t.id)));
        }
      } catch (e) {
        console.error('Failed to load saved Auto-Discovery state:', e);
      }
    }
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    if (discoveryState === 'discovering') return; // Don't save during discovery

    const stateToSave = {
      targetUrl,
      discoveredEndpoints,
      securityScore,
      generatedTests,
      metadata,
      testResults,
      discoveryState,
      authType,
      authToken,
      apiKey,
      apiKeyHeader,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('autoDiscoveryState', JSON.stringify(stateToSave));
  }, [targetUrl, discoveredEndpoints, securityScore, generatedTests, metadata, testResults, discoveryState, authType, authToken, apiKey, apiKeyHeader]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Build auth config object
  const buildAuthConfig = () => {
    if (authType === 'none') return null;

    const config = { type: authType };

    if (authType === 'bearer') {
      config.token = authToken;
    } else if (authType === 'api_key') {
      config.api_key = apiKey;
      config.api_key_header = apiKeyHeader;
    } else if (authType === 'basic') {
      config.username = basicUsername;
      config.password = basicPassword;
    }

    return config;
  };

  // Start discovery
  const startDiscovery = async () => {
    if (!targetUrl.trim()) {
      setError('Please enter a URL');
      return;
    }

    setDiscoveryState('discovering');
    setLiveProgress([]);
    setDiscoveredEndpoints([]);
    setSecurityScore(null);
    setGeneratedTests([]);
    setError(null);
    setTestResults(null);
    setSelectedTests(new Set());

    try {
      const response = await fetch(`${API_BASE_URL}/discovery/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          target_url: targetUrl,
          discovery_methods: ['all'],
          auth_config: buildAuthConfig(),
          test_types: ['smoke', 'security', 'functional']
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Discovery failed');
      }

      const data = await response.json();

      setDiscoveredEndpoints(data.endpoints || []);
      setSecurityScore(data.security_score);
      setGeneratedTests(data.generated_tests || []);
      setLiveProgress(data.progress_log || []);
      setMetadata(data.metadata);
      setDiscoveryState('complete');

      // Auto-select all tests
      setSelectedTests(new Set(data.generated_tests?.map(t => t.id) || []));

    } catch (err) {
      setError(err.message);
      setDiscoveryState('error');
    }
  };

  // Run selected tests
  const runTests = async () => {
    const testsToRun = generatedTests.filter(t => selectedTests.has(t.id));

    if (testsToRun.length === 0) {
      setError('Please select at least one test to run');
      return;
    }

    setRunningTests(true);
    setTestResults(null);

    try {
      const response = await fetch(`${API_BASE_URL}/discovery/run-quick`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          tests: testsToRun,
          target_url: targetUrl,
          auth_config: buildAuthConfig(),
          timeout: 30
        })
      });

      if (!response.ok) {
        throw new Error('Test execution failed');
      }

      const data = await response.json();
      setTestResults(data);

    } catch (err) {
      setError(err.message);
    } finally {
      setRunningTests(false);
    }
  };

  // Export results as JSON
  const exportResults = () => {
    const exportData = {
      target_url: targetUrl,
      discovered_at: new Date().toISOString(),
      endpoints: discoveredEndpoints,
      security_score: securityScore,
      generated_tests: generatedTests,
      test_results: testResults,
      metadata: metadata
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discovery-${new URL(targetUrl).hostname}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Copy endpoint to clipboard
  const copyEndpoint = (endpoint) => {
    navigator.clipboard.writeText(`${targetUrl}${endpoint.path}`);
    setCopiedEndpoint(endpoint.id);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  // Navigate to Functional Testing with discovered data
  const openInFunctionalTesting = () => {
    const discoveryData = {
      targetUrl,
      endpoints: discoveredEndpoints,
      securityScore,
      generatedTests: generatedTests.filter(t => t.category === 'functional' || t.category === 'security'),
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('discoveryData', JSON.stringify(discoveryData));
    navigate('/functional');
  };

  // Navigate to Smoke Testing with discovered data
  const openInSmokeTesting = () => {
    // Convert discovered endpoints to smoke test format
    const smokeEndpoints = discoveredEndpoints.map((ep, index) => ({
      id: Date.now() + index,
      name: ep.description || `${ep.method} ${ep.path}`,
      url: `${targetUrl}${ep.path}`,
      method: ep.method,
      maxTime: 2000,
      critical: ep.confidence > 0.7,
      expectedStatus: ep.auth_required ? 401 : 200
    }));

    const discoveryData = {
      targetUrl,
      endpoints: smokeEndpoints,
      securityScore,
      timestamp: new Date().toISOString()
    };
    localStorage.setItem('discoveryData', JSON.stringify(discoveryData));
    navigate('/smoke');
  };

  // Toggle section
  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Toggle test selection
  const toggleTestSelection = (testId) => {
    setSelectedTests(prev => {
      const next = new Set(prev);
      if (next.has(testId)) {
        next.delete(testId);
      } else {
        next.add(testId);
      }
      return next;
    });
  };

  // Select all/none tests
  const toggleAllTests = () => {
    if (selectedTests.size === generatedTests.length) {
      setSelectedTests(new Set());
    } else {
      setSelectedTests(new Set(generatedTests.map(t => t.id)));
    }
  };

  // Get method color
  const getMethodColor = (method) => {
    const colors = {
      GET: 'bg-green-500/20 text-green-400 border-green-500/30',
      POST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      PUT: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      PATCH: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      DELETE: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return colors[method] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  // Get category color
  const getCategoryColor = (category) => {
    const colors = {
      smoke: 'bg-green-500/20 text-green-400',
      security: 'bg-red-500/20 text-red-400',
      functional: 'bg-blue-500/20 text-blue-400'
    };
    return colors[category] || 'bg-gray-500/20 text-gray-400';
  };

  // Get severity color
  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-red-500',
      high: 'text-orange-500',
      medium: 'text-yellow-500',
      low: 'text-blue-500',
      info: 'text-gray-400'
    };
    return colors[severity] || 'text-gray-400';
  };

  // Get grade color
  const getGradeColor = (grade) => {
    const colors = {
      A: 'text-green-400',
      B: 'text-lime-400',
      C: 'text-yellow-400',
      D: 'text-orange-400',
      F: 'text-red-400'
    };
    return colors[grade] || 'text-gray-400';
  };

  // Security score gauge component
  const SecurityGauge = ({ score, grade }) => {
    const rotation = (score / 100) * 180 - 90;

    return (
      <div className="relative w-48 h-24 mx-auto">
        {/* Background arc */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="w-48 h-48 rounded-full border-8 border-gray-700" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
        </div>

        {/* Colored sections */}
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="w-48 h-48 rounded-full"
            style={{
              background: `conic-gradient(from 180deg,
                #ef4444 0deg 36deg,
                #f97316 36deg 72deg,
                #eab308 72deg 108deg,
                #84cc16 108deg 144deg,
                #22c55e 144deg 180deg,
                transparent 180deg 360deg)`,
              clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'
            }}
          />
        </div>

        {/* Needle */}
        <div
          className="absolute bottom-0 left-1/2 w-1 h-20 bg-white origin-bottom transition-transform duration-1000"
          style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
        />

        {/* Center circle */}
        <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-slate-800 rounded-full border-2 border-gray-600 flex items-center justify-center">
          <span className={`text-sm font-bold ${getGradeColor(grade)}`}>{grade}</span>
        </div>

        {/* Score display */}
        <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-center">
          <span className="text-3xl font-bold text-white">{score}</span>
          <span className="text-gray-400 text-sm">/100</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900/50 via-teal-900/50 to-cyan-900/50 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <ArrowLeft size={24} className="text-white" />
              </button>
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <Search size={28} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Auto-Discovery</h1>
                <p className="text-xs text-emerald-300">Zero-config API Discovery</p>
              </div>
            </div>

            {user && (
              <div className="flex items-center gap-4">
                <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/10 rounded-lg border border-white/20">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center font-bold text-white">
                    {user.username?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{user.username}</div>
                    <div className="text-xs text-emerald-200">{user.email}</div>
                  </div>
                </div>
                <button
                  onClick={onLogout}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg transition-all shadow-lg hover:shadow-red-500/30"
                >
                  <LogOut size={18} />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* URL Input Section */}
        <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="text-emerald-400" size={24} />
            <h2 className="text-xl font-bold text-white">Target API</h2>
          </div>

          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <input
                  type="text"
                  value={targetUrl}
                  onChange={(e) => setTargetUrl(e.target.value)}
                  placeholder="https://api.example.com or https://api.example.com/swagger.json"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  disabled={discoveryState === 'discovering'}
                />
                {targetUrl && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {targetUrl.includes('swagger') || targetUrl.includes('openapi') ? (
                      <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">OpenAPI Spec</span>
                    ) : (
                      <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">Base URL</span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAuthConfig(!showAuthConfig)}
                className={`px-4 py-3 rounded-xl border transition-all flex items-center gap-2 ${
                  authType !== 'none'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'bg-slate-800/50 border-white/20 text-gray-400 hover:border-white/40'
                }`}
              >
                {authType !== 'none' ? <Lock size={20} /> : <Unlock size={20} />}
                <span className="hidden sm:inline">Auth</span>
                {showAuthConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              <button
                onClick={startDiscovery}
                disabled={discoveryState === 'discovering' || !targetUrl.trim()}
                className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-xl font-semibold transition-all flex items-center gap-2 shadow-lg hover:shadow-emerald-500/30"
              >
                {discoveryState === 'discovering' ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Discovering...</span>
                  </>
                ) : (
                  <>
                    <Search size={20} />
                    <span>Discover</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Auth Configuration */}
          {showAuthConfig && (
            <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Auth Type</label>
                  <select
                    value={authType}
                    onChange={(e) => setAuthType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="none">None</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="api_key">API Key</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>

                {authType === 'bearer' && (
                  <div className="md:col-span-3">
                    <label className="block text-sm text-gray-400 mb-2">Bearer Token</label>
                    <input
                      type="password"
                      value={authToken}
                      onChange={(e) => setAuthToken(e.target.value)}
                      placeholder="Enter your bearer token"
                      className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                )}

                {authType === 'api_key' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Header Name</label>
                      <input
                        type="text"
                        value={apiKeyHeader}
                        onChange={(e) => setApiKeyHeader(e.target.value)}
                        placeholder="X-API-Key"
                        className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">API Key</label>
                      <input
                        type="password"
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="Enter your API key"
                        className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </>
                )}

                {authType === 'basic' && (
                  <>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Username</label>
                      <input
                        type="text"
                        value={basicUsername}
                        onChange={(e) => setBasicUsername(e.target.value)}
                        placeholder="Username"
                        className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-400 mb-2">Password</label>
                      <input
                        type="password"
                        value={basicPassword}
                        onChange={(e) => setBasicPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-3 py-2 bg-slate-700 border border-white/20 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-center gap-3">
              <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
              <span className="text-red-300">{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-auto text-red-400 hover:text-red-300"
              >
                <XCircle size={20} />
              </button>
            </div>
          )}
        </div>

        {/* Progress Section */}
        {discoveryState === 'discovering' && (
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <Loader2 className="text-emerald-400 animate-spin" size={24} />
              <h2 className="text-xl font-bold text-white">Discovering API...</h2>
            </div>

            <div className="space-y-3">
              {['openapi', 'crawler', 'wellknown', 'security', 'tests'].map((step) => {
                const progress = liveProgress.find(p => p.step === step);
                const status = progress?.status || 'pending';

                return (
                  <div key={step} className="flex items-center gap-3">
                    {status === 'complete' && <CheckCircle className="text-green-400" size={20} />}
                    {status === 'running' && <Loader2 className="text-emerald-400 animate-spin" size={20} />}
                    {status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-gray-600" />}
                    {status === 'error' && <XCircle className="text-red-400" size={20} />}

                    <span className={`text-sm ${status === 'complete' ? 'text-green-400' : status === 'running' ? 'text-emerald-400' : status === 'error' ? 'text-red-400' : 'text-gray-500'}`}>
                      {step === 'openapi' && 'Checking for OpenAPI/Swagger spec...'}
                      {step === 'crawler' && 'Scanning common API paths...'}
                      {step === 'wellknown' && 'Checking well-known endpoints...'}
                      {step === 'security' && 'Analyzing security headers...'}
                      {step === 'tests' && 'Generating test cases...'}
                    </span>

                    {progress?.detail && (
                      <span className="text-xs text-gray-500">({progress.detail})</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results Section */}
        {discoveryState === 'complete' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                    <Globe className="text-blue-400" size={20} />
                  </div>
                  <span className="text-gray-400">Endpoints Found</span>
                </div>
                <div className="text-4xl font-bold text-white">{discoveredEndpoints.length}</div>
                {metadata && (
                  <div className="mt-2 text-xs text-gray-500">
                    OpenAPI: {metadata.endpoint_sources?.openapi || 0} |
                    Crawler: {metadata.endpoint_sources?.crawler || 0} |
                    Well-known: {metadata.endpoint_sources?.wellknown || 0}
                  </div>
                )}
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center">
                    <Shield className="text-emerald-400" size={20} />
                  </div>
                  <span className="text-gray-400">Security Score</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-4xl font-bold ${getGradeColor(securityScore?.grade)}`}>
                    {securityScore?.score || 0}
                  </span>
                  <span className="text-gray-400">/100</span>
                  <span className={`text-2xl font-bold ml-2 ${getGradeColor(securityScore?.grade)}`}>
                    ({securityScore?.grade || 'N/A'})
                  </span>
                </div>
                <div className="mt-2 text-xs text-gray-500">
                  {securityScore?.findings?.length || 0} findings
                </div>
              </div>

              <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <FileText className="text-purple-400" size={20} />
                  </div>
                  <span className="text-gray-400">Tests Generated</span>
                </div>
                <div className="text-4xl font-bold text-white">{generatedTests.length}</div>
                {metadata && (
                  <div className="mt-2 text-xs text-gray-500">
                    Smoke: {metadata.test_categories?.smoke || 0} |
                    Security: {metadata.test_categories?.security || 0} |
                    Functional: {metadata.test_categories?.functional || 0}
                  </div>
                )}
              </div>
            </div>

            {/* Discovered Endpoints */}
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 mb-8 overflow-hidden">
              <button
                onClick={() => toggleSection('endpoints')}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Globe className="text-blue-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Discovered Endpoints</h2>
                  <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-sm rounded-full">
                    {discoveredEndpoints.length}
                  </span>
                </div>
                {expandedSections.endpoints ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
              </button>

              {expandedSections.endpoints && (
                <div className="px-6 pb-6">
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {discoveredEndpoints.map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className="flex items-center gap-4 p-4 bg-slate-800/50 rounded-xl border border-white/10 hover:border-white/20 transition-all"
                      >
                        <span className={`px-3 py-1 text-xs font-bold rounded border ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <code className="text-white font-mono text-sm truncate">{endpoint.path}</code>
                            {endpoint.auth_required && (
                              <Lock className="text-yellow-400 flex-shrink-0" size={14} />
                            )}
                          </div>
                          {endpoint.description && (
                            <p className="text-xs text-gray-500 mt-1 truncate">{endpoint.description}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-gray-700/50 text-gray-400 text-xs rounded">
                            {endpoint.source}
                          </span>
                          <span className="text-xs text-gray-500">
                            {Math.round(endpoint.confidence * 100)}%
                          </span>
                          <button
                            onClick={() => copyEndpoint(endpoint)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            {copiedEndpoint === endpoint.id ? (
                              <Check className="text-green-400" size={16} />
                            ) : (
                              <Copy className="text-gray-400" size={16} />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Security Analysis */}
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 mb-8 overflow-hidden">
              <button
                onClick={() => toggleSection('security')}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Shield className="text-emerald-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Security Analysis</h2>
                  <span className={`px-2 py-1 bg-opacity-20 text-sm rounded-full ${getGradeColor(securityScore?.grade)} bg-current`}>
                    Grade {securityScore?.grade}
                  </span>
                </div>
                {expandedSections.security ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
              </button>

              {expandedSections.security && securityScore && (
                <div className="px-6 pb-6">
                  <div className="flex flex-col md:flex-row gap-8">
                    {/* Gauge */}
                    <div className="flex-shrink-0 pt-4">
                      <SecurityGauge score={securityScore.score} grade={securityScore.grade} />
                      <div className="text-center mt-12 text-sm text-gray-400">
                        {securityScore.checks_passed}/{securityScore.checks_total} checks passed
                      </div>
                    </div>

                    {/* Findings */}
                    <div className="flex-1 space-y-3 max-h-80 overflow-y-auto">
                      {securityScore.findings.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <CheckCircle className="mx-auto mb-2" size={40} />
                          <p>No security issues found!</p>
                        </div>
                      ) : (
                        securityScore.findings.map((finding, index) => (
                          <div
                            key={index}
                            className="p-4 bg-slate-800/50 rounded-xl border border-white/10"
                          >
                            <div className="flex items-start gap-3">
                              <AlertTriangle className={`flex-shrink-0 ${getSeverityColor(finding.severity)}`} size={20} />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`font-semibold ${getSeverityColor(finding.severity)}`}>
                                    {finding.title}
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-700/50 text-gray-400 text-xs rounded capitalize">
                                    {finding.severity}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-400">{finding.description}</p>
                                {finding.recommendation && (
                                  <p className="text-xs text-emerald-400 mt-2">
                                    Recommendation: {finding.recommendation}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Generated Tests */}
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 mb-8 overflow-hidden">
              <button
                onClick={() => toggleSection('tests')}
                className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <FileText className="text-purple-400" size={24} />
                  <h2 className="text-xl font-bold text-white">Generated Tests</h2>
                  <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-sm rounded-full">
                    {generatedTests.length}
                  </span>
                </div>
                {expandedSections.tests ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
              </button>

              {expandedSections.tests && (
                <div className="px-6 pb-6">
                  {/* Test Actions */}
                  <div className="flex items-center gap-4 mb-4">
                    <button
                      onClick={toggleAllTests}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
                    >
                      {selectedTests.size === generatedTests.length ? 'Deselect All' : 'Select All'}
                    </button>

                    <span className="text-sm text-gray-400">
                      {selectedTests.size} of {generatedTests.length} selected
                    </span>

                    <div className="flex-1" />

                    <button
                      onClick={runTests}
                      disabled={runningTests || selectedTests.size === 0}
                      className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:from-gray-600 disabled:to-gray-600 text-white rounded-lg transition-all flex items-center gap-2"
                    >
                      {runningTests ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Running...
                        </>
                      ) : (
                        <>
                          <Play size={16} />
                          Run Selected
                        </>
                      )}
                    </button>

                    <button
                      onClick={exportResults}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Download size={16} />
                      Export
                    </button>
                  </div>

                  {/* Test Results Summary */}
                  {testResults && (
                    <div className="mb-4 p-4 bg-slate-800/50 rounded-xl border border-white/10">
                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                          <Activity className="text-blue-400" size={20} />
                          <span className="text-gray-400">Total:</span>
                          <span className="text-white font-bold">{testResults.total}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="text-green-400" size={20} />
                          <span className="text-gray-400">Passed:</span>
                          <span className="text-green-400 font-bold">{testResults.passed}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <XCircle className="text-red-400" size={20} />
                          <span className="text-gray-400">Failed:</span>
                          <span className="text-red-400 font-bold">{testResults.failed}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Zap className="text-yellow-400" size={20} />
                          <span className="text-gray-400">Duration:</span>
                          <span className="text-white font-bold">{testResults.duration_ms}ms</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Test List */}
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {generatedTests.map((test) => {
                      const result = testResults?.results?.find(r => r.test_id === test.id);

                      return (
                        <div
                          key={test.id}
                          className={`flex items-center gap-4 p-4 rounded-xl border transition-all cursor-pointer ${
                            selectedTests.has(test.id)
                              ? 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-slate-800/50 border-white/10 hover:border-white/20'
                          }`}
                          onClick={() => toggleTestSelection(test.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTests.has(test.id)}
                            onChange={() => toggleTestSelection(test.id)}
                            className="w-4 h-4 rounded border-gray-600 bg-slate-700 text-emerald-500 focus:ring-emerald-500"
                            onClick={(e) => e.stopPropagation()}
                          />

                          <span className={`px-2 py-1 text-xs rounded ${getCategoryColor(test.category)}`}>
                            {test.category}
                          </span>

                          <span className={`px-2 py-0.5 text-xs font-bold rounded border ${getMethodColor(test.method)}`}>
                            {test.method}
                          </span>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white truncate">{test.name}</p>
                            <p className="text-xs text-gray-500 truncate">{test.endpoint}</p>
                          </div>

                          {result && (
                            <div className="flex items-center gap-2">
                              {result.passed ? (
                                <CheckCircle className="text-green-400" size={20} />
                              ) : (
                                <XCircle className="text-red-400" size={20} />
                              )}
                              <span className="text-xs text-gray-400">
                                {result.status_code || 'Error'} / {result.response_time_ms}ms
                              </span>
                            </div>
                          )}

                          {test.severity && (
                            <span className={`px-2 py-0.5 text-xs rounded capitalize ${getSeverityColor(test.severity)} bg-current bg-opacity-20`}>
                              {test.severity}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => {
                  setDiscoveryState('idle');
                  setTargetUrl('');
                  setDiscoveredEndpoints([]);
                  setSecurityScore(null);
                  setGeneratedTests([]);
                  setTestResults(null);
                }}
                className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-all flex items-center gap-2"
              >
                <RefreshCw size={20} />
                New Discovery
              </button>

              <button
                onClick={openInFunctionalTesting}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all flex items-center gap-2"
              >
                <ExternalLink size={20} />
                Open in Functional Testing
              </button>

              <button
                onClick={openInSmokeTesting}
                className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl transition-all flex items-center gap-2"
              >
                <Zap size={20} />
                Open in Smoke Testing
              </button>
            </div>
          </>
        )}

        {/* Empty State */}
        {discoveryState === 'idle' && (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Search className="text-emerald-400" size={48} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Ready to Discover</h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              Enter a URL above to automatically discover API endpoints, analyze security headers,
              and generate comprehensive test cases - all with zero configuration.
            </p>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                <CheckCircle className="text-emerald-400" size={16} />
                <span className="text-gray-300">OpenAPI/Swagger Detection</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                <CheckCircle className="text-emerald-400" size={16} />
                <span className="text-gray-300">50+ Common Paths</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                <CheckCircle className="text-emerald-400" size={16} />
                <span className="text-gray-300">Security Scoring</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg">
                <CheckCircle className="text-emerald-400" size={16} />
                <span className="text-gray-300">Auto Test Generation</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-7xl mx-auto px-6 py-8 mt-12 border-t border-white/10">
        <div className="text-center text-gray-400 text-sm">
          <p className="font-bold">Evo-TFX</p>
          <p className="text-xs text-gray-500">by EvoluneEdgeTech</p>
          <p className="mt-2">Professional API Testing Platform - Auto-Discovery Module</p>
        </div>
      </div>
    </div>
  );
}

export default AutoDiscoveryApp;
