import React, { useState } from 'react';
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
  Home,
  ArrowLeft
} from 'lucide-react';
import GitHubIntegration from './GitHubIntegration';

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
    if (score >= 80) return 'text-green-400';
    if (score >= 60) return 'text-yellow-400';
    if (score >= 40) return 'text-orange-400';
    return 'text-red-400';
  };

  const getSuccessRateColor = (rate) => {
    const expectedSuccess = 100 - chaosRate;
    if (rate >= expectedSuccess - 10) return 'text-green-400';
    if (rate >= expectedSuccess - 30) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 hover:bg-slate-700/50 rounded-lg transition-all mb-4"
        >
          <ChevronLeft size={20} />
          <span>Back to Home</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="text-orange-400" size={32} />
          <h1 className="text-3xl font-bold">Chaos Engineering / Failure Simulation</h1>
        </div>
        <p className="text-slate-300">Test your API's resilience by injecting controlled failures</p>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Left Panel - Configuration */}
        <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Activity size={20} className="text-blue-400" />
            Configuration
          </h2>

          {/* Tabs */}
          <div className="flex gap-2 mb-4 border-b border-slate-700">
            <button
              onClick={() => setConfigTab('basic')}
              className={`px-4 py-2 transition-all ${
                configTab === 'basic'
                  ? 'border-b-2 border-blue-400 text-blue-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Basic
            </button>
            <button
              onClick={() => setConfigTab('chaos')}
              className={`px-4 py-2 transition-all ${
                configTab === 'chaos'
                  ? 'border-b-2 border-orange-400 text-orange-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Chaos Type
            </button>
            <button
              onClick={() => setConfigTab('request')}
              className={`px-4 py-2 transition-all ${
                configTab === 'request'
                  ? 'border-b-2 border-purple-400 text-purple-400'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Request
            </button>
          </div>

          {/* Basic Tab */}
          {configTab === 'basic' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">API Endpoint</label>
                <input
                  type="text"
                  value={apiEndpoint}
                  onChange={(e) => setApiEndpoint(e.target.value)}
                  placeholder="https://api.example.com/endpoint"
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Total Requests</label>
                  <input
                    type="number"
                    value={totalRequests}
                    onChange={(e) => setTotalRequests(parseInt(e.target.value) || 50)}
                    min="1"
                    max="1000"
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Concurrency</label>
                  <input
                    type="number"
                    value={concurrency}
                    onChange={(e) => setConcurrency(parseInt(e.target.value) || 5)}
                    min="1"
                    max="50"
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Chaos Injection Rate: {chaosRate}%
                </label>
                <input
                  type="range"
                  value={chaosRate}
                  onChange={(e) => setChaosRate(parseInt(e.target.value))}
                  min="0"
                  max="100"
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-1">
                  <span>0% (No Chaos)</span>
                  <span>50%</span>
                  <span>100% (Full Chaos)</span>
                </div>
              </div>
            </div>
          )}

          {/* Chaos Type Tab */}
          {configTab === 'chaos' && (
            <div className="space-y-3">
              {Object.entries(chaosConfigs).map(([key, config]) => {
                const Icon = config.icon;
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setSelectedChaos(key);
                      setCustomTimeout(config.defaultTimeout);
                      setChaosRate(config.defaultRate);
                    }}
                    className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                      selectedChaos === key
                        ? `border-${config.color}-400 bg-${config.color}-400/10`
                        : 'border-slate-600 bg-slate-900/30 hover:border-slate-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Icon size={24} className={`text-${config.color}-400 flex-shrink-0 mt-1`} />
                      <div>
                        <h3 className="font-semibold">{config.name}</h3>
                        <p className="text-sm text-slate-400">{config.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}

              {(selectedChaos === 'timeout' || selectedChaos === 'latency') && (
                <div className="mt-4">
                  <label className="block text-sm font-medium mb-2">
                    {selectedChaos === 'timeout' ? 'Timeout Duration (ms)' : 'Max Latency (ms)'}
                  </label>
                  <input
                    type="number"
                    value={customTimeout}
                    onChange={(e) => setCustomTimeout(parseInt(e.target.value) || 5000)}
                    min="100"
                    max="30000"
                    step="100"
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
          )}

          {/* Request Tab */}
          {configTab === 'request' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">HTTP Method</label>
                <select
                  value={httpMethod}
                  onChange={(e) => setHttpMethod(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              {['POST', 'PUT', 'PATCH'].includes(httpMethod) && (
                <div>
                  <label className="block text-sm font-medium mb-2">Request Body (JSON)</label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={6}
                    className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2">Custom Headers (JSON)</label>
                <textarea
                  value={customHeaders}
                  onChange={(e) => setCustomHeaders(e.target.value)}
                  placeholder='{"Authorization": "Bearer token"}'
                  rows={4}
                  className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                />
              </div>
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={runChaosTest}
            disabled={isRunning || !apiEndpoint}
            className={`w-full mt-6 px-6 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 transition-all ${
              isRunning || !apiEndpoint
                ? 'bg-slate-600 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600'
            }`}
          >
            {isRunning ? (
              <>
                <StopCircle size={20} className="animate-pulse" />
                Running Test...
              </>
            ) : (
              <>
                <PlayCircle size={20} />
                Start Chaos Test
              </>
            )}
          </button>

          {/* Progress Bar */}
          {isRunning && (
            <div className="mt-4">
              <div className="w-full bg-slate-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-orange-500 to-red-500 h-2 rounded-full transition-all duration-300"
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
              <Zap size={20} className="text-yellow-400" />
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
                  ? 'border-b-2 border-yellow-400 text-yellow-400'
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
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {!results ? (
                <div className="text-center text-slate-400 py-20">
                  <Activity size={48} className="mx-auto mb-4 opacity-50" />
                  <p>Configure and run a chaos test to see results</p>
                </div>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Resilience Score</div>
                      <div className={`text-2xl font-bold ${getResilienceColor(results.resilience)}`}>
                        {results.resilience.toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Success Rate</div>
                      <div className={`text-2xl font-bold ${getSuccessRateColor(results.successRate)}`}>
                        {results.successRate.toFixed(1)}%
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Chaos Injected</div>
                      <div className="text-2xl font-bold text-orange-400">
                        {results.chaosInjectedCount}/{results.totalRequests}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {results.actualChaosRate.toFixed(1)}% actual rate
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400 mb-1">Total Failures</div>
                      <div className="text-2xl font-bold text-red-400">
                        {results.failureCount}
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        {results.failureRate.toFixed(1)}% failure rate
                      </div>
                    </div>
                  </div>

                  {/* Chaos Type Info */}
                  <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <AlertTriangle size={16} className="text-orange-400" />
                      <span className="font-semibold text-orange-400">Chaos Type Applied</span>
                    </div>
                    <div className="text-sm">{results.chaosType}</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Target rate: {results.chaosRate}% | Actual: {results.actualChaosRate.toFixed(1)}%
                    </div>
                  </div>

                  {/* Response Time Stats */}
                  <div>
                    <h3 className="font-semibold mb-3 flex items-center gap-2">
                      <Clock size={16} />
                      Response Time Analysis
                    </h3>

                    {/* Overall Stats */}
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mb-3">
                      <div className="text-sm font-medium mb-2 text-blue-400">Overall (All Requests)</div>
                      <div className="grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-slate-400">Avg</div>
                          <div className="font-semibold">{results.overall.avg.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-slate-400">P95</div>
                          <div className="font-semibold">{results.overall.p95.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-slate-400">P99</div>
                          <div className="font-semibold">{results.overall.p99.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Min</div>
                          <div className="font-semibold">{results.overall.min.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Max</div>
                          <div className="font-semibold">{results.overall.max.toFixed(2)}ms</div>
                        </div>
                        <div>
                          <div className="text-slate-400">P50</div>
                          <div className="font-semibold">{results.overall.p50.toFixed(2)}ms</div>
                        </div>
                      </div>
                    </div>

                    {/* Normal Requests Stats */}
                    {results.normalCount > 0 && (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-green-700/50 mb-3">
                        <div className="text-sm font-medium mb-2 text-green-400">
                          Normal Requests ({results.normalCount})
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="text-slate-400">Avg</div>
                            <div className="font-semibold">{results.normal.avg.toFixed(2)}ms</div>
                          </div>
                          <div>
                            <div className="text-slate-400">P95</div>
                            <div className="font-semibold">{results.normal.p95.toFixed(2)}ms</div>
                          </div>
                          <div>
                            <div className="text-slate-400">P99</div>
                            <div className="font-semibold">{results.normal.p99.toFixed(2)}ms</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Chaos Requests Stats */}
                    {results.chaosInjectedCount > 0 && (
                      <div className="bg-slate-900/50 rounded-lg p-4 border border-orange-700/50">
                        <div className="text-sm font-medium mb-2 text-orange-400">
                          Chaos Requests ({results.chaosInjectedCount})
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div>
                            <div className="text-slate-400">Avg</div>
                            <div className="font-semibold">{results.chaos.avg.toFixed(2)}ms</div>
                          </div>
                          <div>
                            <div className="text-slate-400">P95</div>
                            <div className="font-semibold">{results.chaos.p95.toFixed(2)}ms</div>
                          </div>
                          <div>
                            <div className="text-slate-400">P99</div>
                            <div className="font-semibold">{results.chaos.p99.toFixed(2)}ms</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Error Distribution */}
                  {Object.keys(results.errorTypes).length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <XCircle size={16} />
                        Error Distribution
                      </h3>
                      <div className="space-y-2">
                        {Object.entries(results.errorTypes).map(([type, count]) => (
                          <div key={type} className="bg-slate-900/50 rounded-lg p-3 border border-red-700/30">
                            <div className="flex justify-between items-center">
                              <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                              <span className="font-semibold text-red-400">
                                {count} ({((count / results.totalRequests) * 100).toFixed(1)}%)
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Additional Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                      <div className="text-sm text-slate-400">Throughput</div>
                      <div className="font-semibold">{results.throughput.toFixed(2)} req/s</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                      <div className="text-sm text-slate-400">Total Time</div>
                      <div className="font-semibold">{results.totalTime.toFixed(2)}s</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                      <div className="text-sm text-slate-400">Total Data</div>
                      <div className="font-semibold">{results.totalSize} KB</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-3 border border-slate-700">
                      <div className="text-sm text-slate-400">Avg Size</div>
                      <div className="font-semibold">{results.avgSize} KB</div>
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
                  <Database size={48} className="mx-auto mb-4 opacity-50" />
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
