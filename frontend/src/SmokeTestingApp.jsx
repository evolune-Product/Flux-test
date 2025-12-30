import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  Zap,
  Clock,
  Activity,
  AlertTriangle,
  Home,
  ArrowLeft,
  Github,
  Play,
  Loader,
  Plus,
  Trash2,
  Edit3,
  Server,
  Database,
  Globe,
  Shield
} from 'lucide-react';
import GitHubIntegration from './GitHubIntegration.jsx';

const SmokeTestingApp = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // State management
  const [endpoints, setEndpoints] = useState([
    { id: 1, name: 'Health Check', url: '', method: 'GET', maxTime: 2000, critical: true },
    { id: 2, name: 'API Status', url: '', method: 'GET', maxTime: 2000, critical: true }
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [showGitHub, setShowGitHub] = useState(false);
  const [activeTab, setActiveTab] = useState('results');
  const [editingEndpoint, setEditingEndpoint] = useState(null);

  // Form state for adding/editing endpoints
  const [endpointForm, setEndpointForm] = useState({
    name: '',
    url: '',
    method: 'GET',
    maxTime: 2000,
    critical: true,
    headers: '',
    expectedStatus: 200
  });
  const [nlTestInput, setNlTestInput] = useState('');
  const [nlGenerating, setNlGenerating] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  const handleGenerateFromNL = async () => {
    if (!nlTestInput.trim()) return;
    setNlGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-test-from-nl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: nlTestInput, base_url: 'http://api.example.com' })
      });
      if (!response.ok) throw new Error('Failed to generate');
      const data = await response.json();
      setEndpointForm({
        name: data.description,
        url: data.endpoint || '',
        method: data.method || 'GET',
        maxTime: 2000,
        critical: true,
        headers: '',
        expectedStatus: data.expected_status || 200
      });
      setNlTestInput('');
      addLog('✅ Test generated! Review and click "Save Endpoint"', 'success');
    } catch (error) {
      addLog(`❌ Error: ${error.message}`, 'error');
    } finally {
      setNlGenerating(false);
    }
  };

  // Logging function
  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Add or update endpoint
  const handleSaveEndpoint = () => {
    if (!endpointForm.name.trim() || !endpointForm.url.trim()) {
      addLog('Endpoint name and URL are required', 'error');
      return;
    }

    if (editingEndpoint !== null) {
      // Update existing endpoint
      setEndpoints(endpoints.map(ep =>
        ep.id === editingEndpoint ? { ...endpointForm, id: editingEndpoint } : ep
      ));
      addLog(`Updated endpoint: ${endpointForm.name}`, 'success');
    } else {
      // Add new endpoint
      const newEndpoint = {
        ...endpointForm,
        id: Date.now()
      };
      setEndpoints([...endpoints, newEndpoint]);
      addLog(`Added endpoint: ${endpointForm.name}`, 'success');
    }

    // Reset form
    setEndpointForm({
      name: '',
      url: '',
      method: 'GET',
      maxTime: 2000,
      critical: true,
      headers: '',
      expectedStatus: 200
    });
    setEditingEndpoint(null);
  };

  // Edit endpoint
  const handleEditEndpoint = (endpoint) => {
    setEndpointForm(endpoint);
    setEditingEndpoint(endpoint.id);
  };

  // Delete endpoint
  const handleDeleteEndpoint = (id) => {
    setEndpoints(endpoints.filter(ep => ep.id !== id));
    addLog('Endpoint removed', 'info');
  };

  // Test a single endpoint
  const testEndpoint = async (endpoint) => {
    const startTime = performance.now();

    try {
      // Parse headers if provided
      let headers = { 'Content-Type': 'application/json' };
      if (endpoint.headers) {
        try {
          const parsedHeaders = JSON.parse(endpoint.headers);
          headers = { ...headers, ...parsedHeaders };
        } catch (e) {
          addLog(`Invalid headers for ${endpoint.name}, using defaults`, 'warning');
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.maxTime);

      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        headers: headers,
        signal: controller.signal,
        mode: 'cors'
      });

      clearTimeout(timeoutId);
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      const passed = response.status === endpoint.expectedStatus && responseTime <= endpoint.maxTime;

      return {
        name: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        passed: passed,
        status: response.status,
        expectedStatus: endpoint.expectedStatus,
        responseTime: responseTime.toFixed(2),
        maxTime: endpoint.maxTime,
        critical: endpoint.critical,
        message: passed
          ? `✓ OK (${responseTime.toFixed(0)}ms)`
          : `✗ ${response.status !== endpoint.expectedStatus ? `Expected ${endpoint.expectedStatus}, got ${response.status}` : `Timeout (${responseTime.toFixed(0)}ms > ${endpoint.maxTime}ms)`}`
      };

    } catch (error) {
      const endTime = performance.now();
      const responseTime = endTime - startTime;

      let message = '✗ Failed';
      if (error.name === 'AbortError') {
        message = `✗ Timeout (>${endpoint.maxTime}ms)`;
      } else if (error.message.includes('Failed to fetch')) {
        message = '✗ Network error / CORS';
      } else {
        message = `✗ ${error.message}`;
      }

      return {
        name: endpoint.name,
        url: endpoint.url,
        method: endpoint.method,
        passed: false,
        status: 0,
        expectedStatus: endpoint.expectedStatus,
        responseTime: responseTime.toFixed(2),
        maxTime: endpoint.maxTime,
        critical: endpoint.critical,
        message: message,
        error: error.message
      };
    }
  };

  // Run smoke tests
  const runSmokeTests = async () => {
    // Validate endpoints
    const validEndpoints = endpoints.filter(ep => ep.url.trim() !== '');

    if (validEndpoints.length === 0) {
      addLog('No valid endpoints to test. Please add at least one endpoint with a URL.', 'error');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults(null);
    setLogs([]);

    addLog(`Starting Smoke Tests...`, 'info');
    addLog(`Testing ${validEndpoints.length} critical endpoints`, 'info');

    const startTime = performance.now();
    const testResults = [];
    let passedCount = 0;
    let failedCount = 0;
    let criticalFailures = 0;

    try {
      // Run tests sequentially (smoke tests should be fast)
      for (let i = 0; i < validEndpoints.length; i++) {
        const endpoint = validEndpoints[i];
        addLog(`Testing: ${endpoint.name} (${endpoint.method} ${endpoint.url})`, 'info');

        const result = await testEndpoint(endpoint);
        testResults.push(result);

        if (result.passed) {
          passedCount++;
          addLog(`${result.name}: ${result.message}`, 'success');
        } else {
          failedCount++;
          if (endpoint.critical) {
            criticalFailures++;
          }
          addLog(`${result.name}: ${result.message}`, 'error');
        }

        setProgress(((i + 1) / validEndpoints.length) * 100);

        // Small delay between tests
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const endTime = performance.now();
      const totalTime = ((endTime - startTime) / 1000).toFixed(2);

      // Calculate statistics
      const avgResponseTime = (testResults.reduce((sum, r) => sum + parseFloat(r.responseTime), 0) / testResults.length).toFixed(2);
      const maxResponseTime = Math.max(...testResults.map(r => parseFloat(r.responseTime))).toFixed(2);
      const passRate = ((passedCount / testResults.length) * 100).toFixed(2);

      const finalResults = {
        totalTests: testResults.length,
        passed: passedCount,
        failed: failedCount,
        criticalFailures: criticalFailures,
        passRate: passRate,
        totalTime: totalTime,
        avgResponseTime: avgResponseTime,
        maxResponseTime: maxResponseTime,
        tests: testResults,
        overallStatus: criticalFailures === 0 && failedCount === 0 ? 'PASS' : criticalFailures > 0 ? 'CRITICAL_FAIL' : 'FAIL',
        timestamp: new Date().toISOString()
      };

      setResults(finalResults);

      // Final summary
      if (finalResults.overallStatus === 'PASS') {
        addLog(`✅ All smoke tests passed! (${totalTime}s)`, 'success');
        addLog(`🚀 System is healthy and ready for use`, 'success');
      } else if (finalResults.overallStatus === 'CRITICAL_FAIL') {
        addLog(`❌ CRITICAL FAILURE: ${criticalFailures} critical endpoint(s) failed`, 'error');
        addLog(`⚠️ System may not be ready for production use`, 'error');
      } else {
        addLog(`⚠️ Some tests failed but no critical failures (${totalTime}s)`, 'warning');
      }

    } catch (error) {
      addLog(`Test execution error: ${error.message}`, 'error');
    }

    setIsRunning(false);
    setProgress(100);
  };

  // Quick test presets
  const loadPreset = (preset) => {
    switch (preset) {
      case 'api':
        setEndpoints([
          { id: 1, name: 'Health Check', url: 'https://jsonplaceholder.typicode.com/', method: 'GET', maxTime: 2000, critical: true, headers: '', expectedStatus: 200 },
          { id: 2, name: 'Users API', url: 'https://jsonplaceholder.typicode.com/users/1', method: 'GET', maxTime: 2000, critical: true, headers: '', expectedStatus: 200 },
          { id: 3, name: 'Posts API', url: 'https://jsonplaceholder.typicode.com/posts/1', method: 'GET', maxTime: 2000, critical: false, headers: '', expectedStatus: 200 }
        ]);
        addLog('Loaded API example preset', 'info');
        break;
      case 'microservices':
        setEndpoints([
          { id: 1, name: 'Gateway Health', url: '', method: 'GET', maxTime: 1000, critical: true, headers: '', expectedStatus: 200 },
          { id: 2, name: 'Auth Service', url: '', method: 'GET', maxTime: 1500, critical: true, headers: '', expectedStatus: 200 },
          { id: 3, name: 'User Service', url: '', method: 'GET', maxTime: 1500, critical: true, headers: '', expectedStatus: 200 },
          { id: 4, name: 'Payment Service', url: '', method: 'GET', maxTime: 2000, critical: true, headers: '', expectedStatus: 200 },
          { id: 5, name: 'Notification Service', url: '', method: 'GET', maxTime: 2000, critical: false, headers: '', expectedStatus: 200 }
        ]);
        addLog('Loaded microservices preset (add your URLs)', 'info');
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back to Home Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-green-500 p-3 rounded-xl">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Smoke Testing
              </h1>
              <p className="text-slate-300">Quick health checks for critical API endpoints</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="text-green-400" size={20} />
                <h3 className="font-semibold">Fast Execution</h3>
              </div>
              <p className="text-sm text-slate-300">Tests run in seconds, not minutes</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="text-blue-400" size={20} />
                <h3 className="font-semibold">Critical Checks</h3>
              </div>
              <p className="text-sm text-slate-300">Focus on must-work functionality</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="text-purple-400" size={20} />
                <h3 className="font-semibold">Go/No-Go Decision</h3>
              </div>
              <p className="text-sm text-slate-300">Quick pass/fail for deployments</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <div className="space-y-6">
            {/* Quick Presets */}
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Globe size={20} className="text-green-400" />
                Quick Presets
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => loadPreset('api')}
                  className="px-4 py-3 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 rounded-lg transition-all"
                >
                  <Server size={18} className="mx-auto mb-1" />
                  <div className="text-sm font-semibold">REST API</div>
                </button>
                <button
                  onClick={() => loadPreset('microservices')}
                  className="px-4 py-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 rounded-lg transition-all"
                >
                  <Database size={18} className="mx-auto mb-1" />
                  <div className="text-sm font-semibold">Microservices</div>
                </button>
              </div>
            </div>

            {/* Add/Edit Endpoint Form */}
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Plus size={20} className="text-green-400" />
                {editingEndpoint !== null ? 'Edit Endpoint' : 'Add Endpoint'}
              </h2>

              <div className="space-y-3">
                {editingEndpoint === null && (
                  <>
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4">
                      <div className="flex items-start gap-2 mb-2">
                        <span className="text-2xl">🤖</span>
                        <div className="flex-1">
                          <h5 className="font-semibold text-purple-800 mb-1">Quick: Describe in Plain English</h5>
                          <p className="text-xs text-gray-600 mb-3">Let AI fill the form!</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={nlTestInput}
                          onChange={(e) => setNlTestInput(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && handleGenerateFromNL()}
                          className="flex-1 p-3 border-2 border-purple-300 rounded-lg text-sm text-gray-800"
                          placeholder='"Check if API health endpoint returns 200"'
                          disabled={nlGenerating}
                        />
                        <button
                          onClick={handleGenerateFromNL}
                          disabled={nlGenerating || !nlTestInput.trim()}
                          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold disabled:opacity-50 flex items-center gap-2"
                        >
                          {nlGenerating ? (
                            <>
                              <Loader className="animate-spin" size={18} />
                              <span>Generating...</span>
                            </>
                          ) : (
                            <span>✨ Generate</span>
                          )}
                        </button>
                      </div>
                    </div>
                    <div className="text-center text-sm text-gray-400">─── OR Fill Manually ───</div>
                  </>
                )}
                <div>
                  <label className="block text-sm font-medium mb-1">Endpoint Name *</label>
                  <input
                    type="text"
                    value={endpointForm.name}
                    onChange={(e) => setEndpointForm({ ...endpointForm, name: e.target.value })}
                    placeholder="e.g., Health Check"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">URL *</label>
                  <input
                    type="text"
                    value={endpointForm.url}
                    onChange={(e) => setEndpointForm({ ...endpointForm, url: e.target.value })}
                    placeholder="https://api.example.com/health"
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Method</label>
                    <select
                      value={endpointForm.method}
                      onChange={(e) => setEndpointForm({ ...endpointForm, method: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500"
                    >
                      <option>GET</option>
                      <option>POST</option>
                      <option>PUT</option>
                      <option>DELETE</option>
                      <option>HEAD</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Expected Status</label>
                    <input
                      type="number"
                      value={endpointForm.expectedStatus}
                      onChange={(e) => setEndpointForm({ ...endpointForm, expectedStatus: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Max Response Time (ms)</label>
                  <input
                    type="number"
                    value={endpointForm.maxTime}
                    onChange={(e) => setEndpointForm({ ...endpointForm, maxTime: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Custom Headers (JSON)</label>
                  <textarea
                    value={endpointForm.headers}
                    onChange={(e) => setEndpointForm({ ...endpointForm, headers: e.target.value })}
                    placeholder='{"Authorization": "Bearer token"}'
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-green-500 font-mono text-sm"
                    rows={2}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={endpointForm.critical}
                    onChange={(e) => setEndpointForm({ ...endpointForm, critical: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <label className="text-sm">
                    Critical endpoint (failure blocks deployment)
                  </label>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveEndpoint}
                    className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-all font-semibold"
                  >
                    {editingEndpoint !== null ? 'Update' : 'Add'} Endpoint
                  </button>
                  {editingEndpoint !== null && (
                    <button
                      onClick={() => {
                        setEditingEndpoint(null);
                        setEndpointForm({
                          name: '',
                          url: '',
                          method: 'GET',
                          maxTime: 2000,
                          critical: true,
                          headers: '',
                          expectedStatus: 200
                        });
                      }}
                      className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Endpoints List */}
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Activity size={20} className="text-green-400" />
                Test Endpoints ({endpoints.filter(ep => ep.url.trim() !== '').length})
              </h2>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {endpoints.map((endpoint) => (
                  <div
                    key={endpoint.id}
                    className="bg-slate-900/50 border border-slate-700 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{endpoint.name}</span>
                          {endpoint.critical && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded border border-red-500/30">
                              CRITICAL
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-slate-400">
                          <span className="font-mono bg-slate-800 px-2 py-0.5 rounded">{endpoint.method}</span>
                          {' '}
                          {endpoint.url || <span className="text-orange-400">No URL set</span>}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          Max: {endpoint.maxTime}ms | Expected: {endpoint.expectedStatus}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleEditEndpoint(endpoint)}
                          className="p-2 hover:bg-slate-700 rounded transition-all"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteEndpoint(endpoint.id)}
                          className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Run Tests Button */}
              <button
                onClick={runSmokeTests}
                disabled={isRunning || endpoints.filter(ep => ep.url.trim() !== '').length === 0}
                className="w-full mt-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isRunning ? (
                  <>
                    <Loader className="animate-spin" size={20} />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play size={20} />
                    Run Smoke Tests
                  </>
                )}
              </button>
            </div>

            {/* Progress */}
            {isRunning && (
              <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
                <h2 className="text-xl font-semibold mb-4">Testing Progress</h2>
                <div className="w-full bg-slate-700 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-green-500 to-emerald-500 h-3 rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-slate-400 mt-2">{progress.toFixed(0)}%</p>
              </div>
            )}
          </div>

          {/* Right Panel - Results & Logs */}
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold flex items-center gap-2">
                <Activity size={20} className="text-green-400" />
                Results & Logs
              </h2>
              {results && (
                <button
                  onClick={() => setShowGitHub(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-lg hover:shadow-lg hover:shadow-gray-800/50 transition-all transform hover:scale-105"
                >
                  <Github size={18} />
                  <span>Save to GitHub</span>
                </button>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-slate-700">
              <button
                onClick={() => setActiveTab('results')}
                className={`px-4 py-2 transition-all ${
                  activeTab === 'results'
                    ? 'border-b-2 border-green-400 text-green-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Results
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`px-4 py-2 transition-all ${
                  activeTab === 'logs'
                    ? 'border-b-2 border-green-400 text-green-400'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Logs ({logs.length})
              </button>
            </div>

            {/* Results Tab */}
            {activeTab === 'results' && (
              <div className="space-y-4">
                {!results ? (
                  <div className="text-center py-20">
                    <Zap size={64} className="mx-auto text-slate-600 mb-4" />
                    <p className="text-slate-400">Configure endpoints and run smoke tests</p>
                    <p className="text-sm text-slate-500 mt-2">Quick health checks in seconds</p>
                  </div>
                ) : (
                  <>
                    {/* Overall Status */}
                    <div className={`rounded-lg p-6 text-center ${
                      results.overallStatus === 'PASS'
                        ? 'bg-green-500/20 border border-green-500/30'
                        : results.overallStatus === 'CRITICAL_FAIL'
                        ? 'bg-red-500/20 border border-red-500/30'
                        : 'bg-yellow-500/20 border border-yellow-500/30'
                    }`}>
                      {results.overallStatus === 'PASS' ? (
                        <CheckCircle size={48} className="mx-auto text-green-400 mb-2" />
                      ) : results.overallStatus === 'CRITICAL_FAIL' ? (
                        <XCircle size={48} className="mx-auto text-red-400 mb-2" />
                      ) : (
                        <AlertTriangle size={48} className="mx-auto text-yellow-400 mb-2" />
                      )}
                      <h3 className="text-2xl font-bold mb-2">
                        {results.overallStatus === 'PASS' ? 'All Tests Passed!' :
                         results.overallStatus === 'CRITICAL_FAIL' ? 'Critical Failure!' :
                         'Some Tests Failed'}
                      </h3>
                      <p className="text-sm">
                        {results.overallStatus === 'PASS'
                          ? '🚀 System is healthy and ready for production'
                          : results.overallStatus === 'CRITICAL_FAIL'
                          ? '⛔ Critical endpoints failed - deployment blocked'
                          : '⚠️ Non-critical failures detected'}
                      </p>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <div className="text-sm text-slate-400">Pass Rate</div>
                        <div className="text-3xl font-bold text-green-400">{results.passRate}%</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <div className="text-sm text-slate-400">Total Time</div>
                        <div className="text-3xl font-bold">{results.totalTime}s</div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <div className="text-sm text-slate-400">Passed / Failed</div>
                        <div className="text-2xl font-bold">
                          <span className="text-green-400">{results.passed}</span>
                          {' / '}
                          <span className="text-red-400">{results.failed}</span>
                        </div>
                      </div>
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                        <div className="text-sm text-slate-400">Avg Response</div>
                        <div className="text-3xl font-bold">{results.avgResponseTime}ms</div>
                      </div>
                    </div>

                    {/* Individual Test Results */}
                    <div>
                      <h3 className="font-semibold mb-3">Individual Tests:</h3>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {results.tests.map((test, index) => (
                          <div
                            key={index}
                            className={`rounded-lg p-4 border ${
                              test.passed
                                ? 'bg-green-900/20 border-green-700/30'
                                : test.critical
                                ? 'bg-red-900/20 border-red-700/30'
                                : 'bg-yellow-900/20 border-yellow-700/30'
                            }`}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {test.passed ? (
                                  <CheckCircle size={20} className="text-green-400" />
                                ) : (
                                  <XCircle size={20} className="text-red-400" />
                                )}
                                <span className="font-semibold">{test.name}</span>
                                {test.critical && !test.passed && (
                                  <span className="px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded">
                                    CRITICAL
                                  </span>
                                )}
                              </div>
                              <span className="text-sm font-mono">{test.responseTime}ms</span>
                            </div>
                            <div className="text-sm text-slate-400">
                              <div className="font-mono text-xs mb-1">
                                {test.method} {test.url}
                              </div>
                              <div>{test.message}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div className="bg-slate-900/50 rounded-lg p-4 max-h-[600px] overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <div className="text-center text-slate-400 py-20">
                    <Activity size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No logs yet</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log, index) => (
                      <div
                        key={index}
                        className={`p-2 rounded ${
                          log.type === 'error' ? 'bg-red-900/20 text-red-300' :
                          log.type === 'warning' ? 'bg-orange-900/20 text-orange-300' :
                          log.type === 'success' ? 'bg-green-900/20 text-green-300' :
                          'bg-slate-800/30 text-slate-300'
                        }`}
                      >
                        <span className="text-slate-500">[{log.timestamp}]</span> {log.message}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GitHub Integration Modal */}
      {showGitHub && results && (
        <GitHubIntegration
          user={user}
          testResults={{
            summary: {
              total: results.totalTests,
              passed: results.passed,
              failed: results.failed,
              pass_rate: parseFloat(results.passRate)
            },
            results: [{
              test: `Smoke Test Suite - ${results.overallStatus}`,
              status: results.overallStatus === 'PASS' ? 'PASS' : 'FAIL',
              details: `${results.totalTests} endpoints tested | Pass Rate: ${results.passRate}% | Avg Response: ${results.avgResponseTime}ms | Total Time: ${results.totalTime}s | Critical Failures: ${results.criticalFailures}`,
              timestamp: results.timestamp,
              smokeMetrics: {
                totalTests: results.totalTests,
                passed: results.passed,
                failed: results.failed,
                criticalFailures: results.criticalFailures,
                passRate: results.passRate,
                totalTime: results.totalTime,
                avgResponseTime: results.avgResponseTime,
                maxResponseTime: results.maxResponseTime,
                overallStatus: results.overallStatus,
                tests: results.tests
              }
            }]
          }}
          apiUrl="Smoke Tests"
          onClose={() => setShowGitHub(false)}
        />
      )}
    </div>
  );
};

export default SmokeTestingApp;
