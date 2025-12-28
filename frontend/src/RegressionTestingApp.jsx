import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  GitCompare,
  Home,
  ArrowLeft,
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
  Minus
} from 'lucide-react';

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

  const API_BASE_URL = 'http://localhost:8000';

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

      const response = await fetch(`${API_BASE_URL}/regression/create-baseline`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        addLog(`Baseline "${data.baseline_name}" created successfully!`, 'success');

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
        const error = await response.json();
        addLog(`Failed to create baseline: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error creating baseline: ${error.message}`, 'error');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-cyan-900 to-slate-900 text-white p-6">
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
            <div className="bg-gradient-to-r from-cyan-500 to-indigo-500 p-3 rounded-xl">
              <GitCompare className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-indigo-400 bg-clip-text text-transparent">
                Regression Testing
              </h1>
              <p className="text-slate-300">Detect API changes and prevent regressions</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitCompare className="text-cyan-400" size={20} />
                <h3 className="font-semibold">Baseline Comparison</h3>
              </div>
              <p className="text-sm text-slate-300">Compare current responses with saved baselines</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <History className="text-blue-400" size={20} />
                <h3 className="font-semibold">Test History</h3>
              </div>
              <p className="text-sm text-slate-300">Track changes over time</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="text-purple-400" size={20} />
                <h3 className="font-semibold">Change Detection</h3>
              </div>
              <p className="text-sm text-slate-300">Automatically detect API regressions</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Baselines List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <FileText size={20} className="text-cyan-400" />
                  My Baselines ({baselines.length})
                </h2>
                <button
                  onClick={() => setActiveTab('create')}
                  className="p-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg transition-all"
                  title="Create New Baseline"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {baselines.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <GitCompare size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No baselines yet</p>
                    <p className="text-sm mt-2">Create your first baseline to start regression testing</p>
                  </div>
                ) : (
                  baselines.map((baseline) => (
                    <div
                      key={baseline.baseline_id}
                      className={`bg-slate-900/50 border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedBaseline?.baseline_id === baseline.baseline_id
                          ? 'border-cyan-500 bg-cyan-900/20'
                          : 'border-slate-700 hover:border-cyan-700'
                      }`}
                      onClick={() => selectBaseline(baseline)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-white mb-1">{baseline.baseline_name}</div>
                          <div className="text-xs text-slate-400 mb-2">
                            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded">{baseline.http_method}</span>
                            {' '}
                            {baseline.api_url.length > 40 ? baseline.api_url.substring(0, 40) + '...' : baseline.api_url}
                          </div>
                          {baseline.description && (
                            <div className="text-xs text-slate-500 mb-2">{baseline.description}</div>
                          )}
                          <div className="text-xs text-slate-500">
                            Created: {new Date(baseline.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {selectedBaseline?.baseline_id === baseline.baseline_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runRegressionTest(baseline.baseline_id);
                              }}
                              disabled={isLoading}
                              className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-all"
                              title="Run Test"
                            >
                              {isLoading ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteBaseline(baseline.baseline_id);
                            }}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-all"
                            title="Delete Baseline"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Tabs for Create, Results, History */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white/10 backdrop-blur-lg rounded-t-2xl shadow-2xl border border-white/20 border-b-0">
              <div className="flex gap-2 p-4 flex-wrap">
                <button
                  onClick={() => setActiveTab('baselines')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === 'baselines'
                      ? 'bg-cyan-600 text-white shadow-lg'
                      : 'bg-white/10 text-cyan-200 hover:bg-white/20'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Baselines
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === 'create'
                      ? 'bg-cyan-600 text-white shadow-lg'
                      : 'bg-white/10 text-cyan-200 hover:bg-white/20'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
                <button
                  onClick={() => setActiveTab('results')}
                  disabled={!testResults}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === 'results'
                      ? 'bg-cyan-600 text-white shadow-lg'
                      : 'bg-white/10 text-cyan-200 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Results
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  disabled={!testHistory}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
                    activeTab === 'history'
                      ? 'bg-cyan-600 text-white shadow-lg'
                      : 'bg-white/10 text-cyan-200 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed'
                  }`}
                >
                  <History className="w-4 h-4" />
                  History
                  {testHistory && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{testHistory.results.length}</span>}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white/10 backdrop-blur-lg rounded-b-2xl shadow-2xl p-6 border border-white/20 min-h-[600px] max-h-[700px] overflow-y-auto">
              {/* Baselines Tab */}
              {activeTab === 'baselines' && (
                <div>
                  {selectedBaseline ? (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white">Baseline Details</h2>
                        <button
                          onClick={() => runRegressionTest(selectedBaseline.baseline_id)}
                          disabled={isLoading}
                          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-semibold transition-all disabled:opacity-50"
                        >
                          {isLoading ? (
                            <>
                              <Loader className="w-5 h-5 animate-spin" />
                              Running...
                            </>
                          ) : (
                            <>
                              <Play className="w-5 h-5" />
                              Run Test
                            </>
                          )}
                        </button>
                      </div>

                      <div className="space-y-4">
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-slate-400">Baseline Name</div>
                              <div className="text-lg font-semibold">{selectedBaseline.baseline_name}</div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">HTTP Method</div>
                              <div className="text-lg font-semibold">{selectedBaseline.http_method}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-sm text-slate-400">API URL</div>
                              <div className="text-sm font-mono bg-slate-800 px-3 py-2 rounded mt-1 break-all">
                                {selectedBaseline.api_url}
                              </div>
                            </div>
                            {selectedBaseline.description && (
                              <div className="col-span-2">
                                <div className="text-sm text-slate-400">Description</div>
                                <div className="text-sm">{selectedBaseline.description}</div>
                              </div>
                            )}
                            <div>
                              <div className="text-sm text-slate-400">Expected Status</div>
                              <div className="text-lg font-semibold">{selectedBaseline.expected_status}</div>
                            </div>
                            {selectedBaseline.expected_response_time_ms && (
                              <div>
                                <div className="text-sm text-slate-400">Max Response Time</div>
                                <div className="text-lg font-semibold">{selectedBaseline.expected_response_time_ms}ms</div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Logs */}
                        {logs.length > 0 && (
                          <div className="bg-black/30 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
                            {logs.map((log, index) => (
                              <div
                                key={index}
                                className={`mb-2 ${
                                  log.type === 'error'
                                    ? 'text-red-400'
                                    : log.type === 'success'
                                    ? 'text-green-400'
                                    : 'text-cyan-300'
                                }`}
                              >
                                <span className="text-cyan-400">[{log.timestamp}]</span> {log.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <GitCompare size={64} className="mx-auto text-slate-600 mb-4" />
                      <p className="text-slate-400 text-lg">Select a baseline from the list</p>
                      <p className="text-sm text-slate-500 mt-2">Or create a new baseline to get started</p>
                    </div>
                  )}
                </div>
              )}

              {/* Create Tab */}
              {activeTab === 'create' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6" />
                    Create New Baseline
                  </h2>

                  <div className="space-y-4">
                    <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4 mb-4">
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
                          placeholder='"Ensure users can still update their password"'
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
                    <div className="text-center text-sm text-gray-400 mb-3">─── OR Fill Manually ───</div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Baseline Name *</label>
                      <input
                        type="text"
                        value={baselineForm.baseline_name}
                        onChange={(e) => setBaselineForm({ ...baselineForm, baseline_name: e.target.value })}
                        placeholder="e.g., User API v1.0"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <input
                        type="text"
                        value={baselineForm.description}
                        onChange={(e) => setBaselineForm({ ...baselineForm, description: e.target.value })}
                        placeholder="Optional description"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">API URL *</label>
                      <input
                        type="text"
                        value={baselineForm.api_url}
                        onChange={(e) => setBaselineForm({ ...baselineForm, api_url: e.target.value })}
                        placeholder="https://api.example.com/users"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">HTTP Method</label>
                        <select
                          value={baselineForm.http_method}
                          onChange={(e) => setBaselineForm({ ...baselineForm, http_method: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                        >
                          <option>GET</option>
                          <option>POST</option>
                          <option>PUT</option>
                          <option>PATCH</option>
                          <option>DELETE</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium mb-2">Expected Status Code</label>
                        <input
                          type="number"
                          value={baselineForm.expected_status}
                          onChange={(e) => setBaselineForm({ ...baselineForm, expected_status: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Max Response Time (ms) - Optional</label>
                      <input
                        type="number"
                        value={baselineForm.expected_response_time_ms}
                        onChange={(e) => setBaselineForm({ ...baselineForm, expected_response_time_ms: e.target.value })}
                        placeholder="e.g., 500"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500"
                      />
                    </div>

                    {['POST', 'PUT', 'PATCH'].includes(baselineForm.http_method) && (
                      <div>
                        <label className="block text-sm font-medium mb-2">Request Body (JSON)</label>
                        <textarea
                          value={baselineForm.request_body}
                          onChange={(e) => setBaselineForm({ ...baselineForm, request_body: e.target.value })}
                          placeholder='{"key": "value"}'
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                          rows={4}
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Headers (JSON) - Optional</label>
                      <textarea
                        value={baselineForm.custom_headers}
                        onChange={(e) => setBaselineForm({ ...baselineForm, custom_headers: e.target.value })}
                        placeholder='{"Authorization": "Bearer token"}'
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-cyan-500 font-mono text-sm"
                        rows={3}
                      />
                    </div>

                    <div className="bg-cyan-500/20 border border-cyan-400/30 rounded-lg p-4">
                      <h4 className="font-bold text-white mb-2 text-sm">ℹ️ What happens when you create a baseline?</h4>
                      <ul className="space-y-1 text-xs text-cyan-200">
                        <li>• We'll call your API and capture the current response</li>
                        <li>• This becomes your "baseline" for future comparisons</li>
                        <li>• Future tests will detect any changes from this baseline</li>
                        <li>• You can run unlimited regression tests against this baseline</li>
                      </ul>
                    </div>

                    <button
                      onClick={createBaseline}
                      disabled={isCreatingBaseline || !baselineForm.baseline_name || !baselineForm.api_url}
                      className="w-full py-3 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-700 hover:to-indigo-700 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCreatingBaseline ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader className="w-5 h-5 animate-spin" />
                          Creating Baseline...
                        </span>
                      ) : (
                        'Create Baseline'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Results Tab */}
              {activeTab === 'results' && (
                <div>
                  {testResults ? (
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                        <BarChart3 className="w-6 h-6" />
                        Test Results
                      </h2>

                      {/* Overall Status */}
                      <div className={`rounded-lg p-6 text-center mb-6 ${
                        testResults.passed
                          ? 'bg-green-500/20 border border-green-500/30'
                          : 'bg-red-500/20 border border-red-500/30'
                      }`}>
                        {testResults.passed ? (
                          <CheckCircle size={48} className="mx-auto text-green-400 mb-2" />
                        ) : (
                          <XCircle size={48} className="mx-auto text-red-400 mb-2" />
                        )}
                        <h3 className="text-2xl font-bold mb-2">
                          {testResults.passed ? 'No Regressions Detected!' : 'Regressions Detected!'}
                        </h3>
                        <p className="text-sm">
                          {testResults.passed
                            ? '✅ API response matches baseline perfectly'
                            : `❌ ${testResults.differences.length} difference(s) found`}
                        </p>
                      </div>

                      {/* Summary */}
                      <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Total Checks</div>
                          <div className="text-2xl font-bold">{testResults.summary.total_checks}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Failed Checks</div>
                          <div className="text-2xl font-bold text-red-400">{testResults.summary.failed_checks}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Response Time</div>
                          <div className="text-2xl font-bold">{testResults.test_response.response_time_ms}ms</div>
                        </div>
                      </div>

                      {/* Differences */}
                      {testResults.differences && testResults.differences.length > 0 && (
                        <div className="mb-6">
                          <h3 className="font-semibold mb-3 text-lg">Detected Differences:</h3>
                          <div className="space-y-3">
                            {testResults.differences.map((diff, index) => (
                              <div key={index} className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                                <div className="flex items-start gap-2 mb-2">
                                  <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                                  <div className="flex-1">
                                    <div className="font-semibold text-red-300">{diff.type.replace('_', ' ').toUpperCase()}</div>
                                    <div className="text-sm text-red-200 mt-1">{diff.message}</div>
                                  </div>
                                </div>

                                {diff.type === 'response_body' && diff.changes && (
                                  <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                                    {diff.changes.slice(0, 10).map((change, idx) => (
                                      <div key={idx} className="bg-slate-900/50 rounded p-3 text-sm font-mono">
                                        <div className="text-slate-400 mb-1">Path: {change.path}</div>
                                        <div className="flex items-center gap-4">
                                          <div className="flex-1">
                                            <div className="text-red-400 flex items-center gap-2">
                                              <TrendingDown size={14} />
                                              Baseline: {JSON.stringify(change.baseline_value)}
                                            </div>
                                          </div>
                                          <div className="flex-1">
                                            <div className="text-green-400 flex items-center gap-2">
                                              <TrendingUp size={14} />
                                              Current: {JSON.stringify(change.current_value)}
                                            </div>
                                          </div>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-1">Change: {change.change_type}</div>
                                      </div>
                                    ))}
                                    {diff.changes.length > 10 && (
                                      <div className="text-sm text-slate-400 text-center">
                                        ... and {diff.changes.length - 10} more changes
                                      </div>
                                    )}
                                  </div>
                                )}

                                {diff.type === 'status_code' && (
                                  <div className="mt-2 bg-slate-900/50 rounded p-3 font-mono text-sm flex items-center justify-between">
                                    <div className="text-red-400">Expected: {diff.expected}</div>
                                    <div className="text-green-400">Actual: {diff.actual}</div>
                                  </div>
                                )}

                                {diff.type === 'response_time' && (
                                  <div className="mt-2 bg-slate-900/50 rounded p-3 font-mono text-sm flex items-center justify-between">
                                    <div className="text-red-400">Max Allowed: {diff.expected_max}ms</div>
                                    <div className="text-green-400">Actual: {diff.actual}ms</div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Response Comparison */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <h4 className="font-semibold mb-2 text-sm text-slate-400">Baseline Response</h4>
                          <pre className="text-xs bg-black/30 p-3 rounded overflow-auto max-h-64">
                            {JSON.stringify(testResults.baseline_response.body, null, 2)}
                          </pre>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <h4 className="font-semibold mb-2 text-sm text-slate-400">Current Response</h4>
                          <pre className="text-xs bg-black/30 p-3 rounded overflow-auto max-h-64">
                            {JSON.stringify(testResults.test_response.body, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <BarChart3 size={64} className="mx-auto text-slate-600 mb-4" />
                      <p className="text-slate-400 text-lg">No results yet</p>
                      <p className="text-sm text-slate-500 mt-2">Run a regression test to see results</p>
                    </div>
                  )}
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && (
                <div>
                  {testHistory ? (
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                          <History className="w-6 h-6" />
                          Test History
                        </h2>
                        <div className="text-sm text-slate-400">
                          Showing last {testHistory.results.length} tests
                        </div>
                      </div>

                      {/* Statistics */}
                      <div className="grid grid-cols-4 gap-4 mb-6">
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Total Tests</div>
                          <div className="text-2xl font-bold">{testHistory.statistics.total_tests}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Passed</div>
                          <div className="text-2xl font-bold text-green-400">{testHistory.statistics.passed}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Failed</div>
                          <div className="text-2xl font-bold text-red-400">{testHistory.statistics.failed}</div>
                        </div>
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="text-sm text-slate-400">Pass Rate</div>
                          <div className={`text-2xl font-bold ${testHistory.statistics.pass_rate >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {testHistory.statistics.pass_rate}%
                          </div>
                        </div>
                      </div>

                      {/* Test Results Timeline */}
                      <div className="space-y-2">
                        <h3 className="font-semibold mb-3">Test Timeline:</h3>
                        {testHistory.results.map((result, index) => (
                          <div
                            key={result.result_id}
                            className={`rounded-lg p-4 border ${
                              result.passed
                                ? 'bg-green-900/10 border-green-700/30'
                                : 'bg-red-900/10 border-red-700/30'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {result.passed ? (
                                  <CheckCircle size={20} className="text-green-400" />
                                ) : (
                                  <XCircle size={20} className="text-red-400" />
                                )}
                                <div>
                                  <div className="font-semibold">
                                    {result.passed ? 'Passed' : 'Failed'}
                                  </div>
                                  <div className="text-xs text-slate-400">
                                    {new Date(result.created_at).toLocaleString()}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-sm">
                                  <span className="text-slate-400">Status:</span>{' '}
                                  <span className="font-mono">{result.status_code}</span>
                                </div>
                                <div className="text-sm">
                                  <span className="text-slate-400">Response:</span>{' '}
                                  <span className="font-mono">{result.response_time_ms}ms</span>
                                </div>
                              </div>
                            </div>
                            {!result.passed && result.differences && (
                              <div className="mt-2 text-xs text-red-300 bg-red-900/20 rounded p-2">
                                {result.differences.differences?.length || 0} difference(s) detected
                              </div>
                            )}
                            {result.error_message && (
                              <div className="mt-2 text-xs text-red-300 bg-red-900/20 rounded p-2">
                                Error: {result.error_message}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <History size={64} className="mx-auto text-slate-600 mb-4" />
                      <p className="text-slate-400 text-lg">No history available</p>
                      <p className="text-sm text-slate-500 mt-2">Select a baseline and run tests to build history</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegressionTestingApp;
