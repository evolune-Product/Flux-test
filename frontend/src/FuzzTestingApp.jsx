import React, { useState, useEffect } from 'react';
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
  Play,
  Loader,
  Target,
  Bug,
  Code,
  Server,
  FileText,
  Download
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-all mb-4"
        >
          <ArrowLeft size={20} />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <Target className="text-orange-400" size={32} />
          <h1 className="text-3xl font-bold">Fuzz Testing</h1>
        </div>
        <p className="text-slate-300">Advanced Input Fuzzing & Vulnerability Detection</p>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto">
        {results && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-semibold">Total Tests</p>
                  <p className="text-3xl font-bold text-white">{getFuzzStats().total}</p>
                </div>
                <Activity className="w-12 h-12 text-orange-400 opacity-30" />
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-semibold">Passed</p>
                  <p className="text-3xl font-bold text-green-400">{getFuzzStats().passed}</p>
                </div>
                <CheckCircle className="w-12 h-12 text-green-400 opacity-30" />
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-semibold">Failed</p>
                  <p className="text-3xl font-bold text-red-400">{getFuzzStats().failed}</p>
                </div>
                <XCircle className="w-12 h-12 text-red-400 opacity-30" />
              </div>
            </div>

            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-semibold">Pass Rate</p>
                  <p className="text-3xl font-bold text-purple-400">{getFuzzStats().passRate.toFixed(1)}%</p>
                </div>
                <Zap className="w-12 h-12 text-purple-400 opacity-30" />
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-slate-700">
            <button
              onClick={() => setActiveTab('config')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'config'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Server className="w-5 h-5 inline-block mr-2" />
              Configuration
            </button>
            <button
              onClick={() => setActiveTab('tests')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'tests'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code className="w-5 h-5 inline-block mr-2" />
              Generated Tests ({generatedTests.length})
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'results'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-5 h-5 inline-block mr-2" />
              Results
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-6 py-3 font-semibold transition-all ${
                activeTab === 'logs'
                  ? 'text-orange-400 border-b-2 border-orange-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Activity className="w-5 h-5 inline-block mr-2" />
              Logs ({logs.length})
            </button>
          </div>

          {/* Configuration Tab */}
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="bg-orange-500/20 border-l-4 border-orange-500 p-6 rounded-lg">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                  <Bug className="w-6 h-6 text-orange-400" />
                  What is Fuzz Testing?
                </h3>
                <p className="text-slate-300">
                  Fuzz testing generates malformed, unexpected, or random data to test API robustness.
                  It helps discover buffer overflows, memory corruption, integer overflows, format string
                  vulnerabilities, and other critical security bugs that standard testing might miss.
                </p>
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">API Endpoint URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">Sample Data Structure (JSON)</label>
                <textarea
                  value={sampleData}
                  onChange={(e) => setSampleData(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 bg-slate-900/50 border border-slate-600 rounded-lg font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent text-white"
                  placeholder='{"field": "value"}'
                />
              </div>

              <div>
                <label className="block text-white font-semibold mb-2">
                  Number of Fuzz Tests: {numTests}
                </label>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={numTests}
                  onChange={(e) => setNumTests(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-600"
                />
                <div className="flex justify-between text-sm text-slate-400 mt-1">
                  <span>10</span>
                  <span>50</span>
                  <span>100</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleGenerateFuzzTests}
                  disabled={isRunning}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 text-white px-6 py-4 rounded-lg font-bold hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Target className="w-5 h-5" />
                      Generate Fuzz Tests
                    </>
                  )}
                </button>

                <button
                  onClick={handleRunFuzzTests}
                  disabled={isRunning || generatedTests.length === 0}
                  className="flex items-center justify-center gap-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 rounded-lg font-bold hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <Loader className="w-5 h-5 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run Fuzz Tests
                    </>
                  )}
                </button>
              </div>

              {isRunning && (
                <div className="mt-4">
                  <div className="bg-slate-700 rounded-full h-4 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-orange-600 to-red-600 h-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-center text-sm text-slate-400 mt-2">{progress}%</p>
                </div>
              )}
            </div>
          )}

          {/* Generated Tests Tab */}
          {activeTab === 'tests' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">
                Generated Fuzz Tests ({generatedTests.length})
              </h3>
              {generatedTests.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Bug className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No fuzz tests generated yet. Configure and generate tests first.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {generatedTests.map((test, index) => (
                    <div key={index} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="flex items-start gap-3">
                        <span className="bg-orange-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                          {test.method}
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold text-white">{test.description}</p>
                          <p className="text-sm text-slate-300 mt-1">
                            <span className="font-mono bg-slate-800 px-2 py-1 rounded">{test.endpoint || '/'}</span>
                          </p>
                          {test.data && (
                            <details className="mt-2">
                              <summary className="text-sm text-orange-400 cursor-pointer font-semibold">
                                View Payload
                              </summary>
                              <pre className="mt-2 bg-slate-800 p-3 rounded border border-slate-700 text-xs overflow-x-auto text-slate-300">
                                {JSON.stringify(test.data, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          Expected: {test.expected_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-white mb-4">Test Results</h3>
              {!results ? (
                <div className="text-center py-12 text-slate-400">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No results yet. Run fuzz tests to see results.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {results.results.map((result, index) => (
                    <div
                      key={index}
                      className={`rounded-lg p-4 border-l-4 ${
                        result.status === 'PASS'
                          ? 'bg-green-500/20 border-green-500'
                          : 'bg-red-500/20 border-red-500'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {result.status === 'PASS' ? (
                          <CheckCircle className="w-5 h-5 text-green-400 mt-1" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400 mt-1" />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold text-white">{result.test}</p>
                          <p className="text-sm text-slate-300 mt-1">{result.details}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white mb-4">Activity Logs</h3>
              {logs.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Activity className="w-16 h-16 mx-auto mb-4 opacity-20" />
                  <p>No logs yet.</p>
                </div>
              ) : (
                <div className="bg-slate-900 rounded-lg p-4 max-h-[600px] overflow-y-auto font-mono text-sm">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`py-1 ${
                        log.type === 'error'
                          ? 'text-red-400'
                          : log.type === 'success'
                          ? 'text-green-400'
                          : log.type === 'warning'
                          ? 'text-yellow-400'
                          : 'text-slate-300'
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
  );
};

export default FuzzTestingApp;
