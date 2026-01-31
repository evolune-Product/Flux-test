import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Zap, TrendingUp, AlertCircle, Clock, Users, Target, Repeat, Home, ArrowLeft, Github, FileText, BarChart3, Settings } from 'lucide-react';
import GitHubIntegration from './GitHubIntegration.jsx';

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
  const [activeTab, setActiveTab] = useState('results'); // 'results' or 'logs'
  const [configTab, setConfigTab] = useState('basic'); // 'basic', 'request', or 'testtype'

  // Get user from localStorage for GitHub integration
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Test configurations
  const testConfigs = {
    'response-time': {
      name: 'Response Time Testing',
      icon: Clock,
      requests: 100,
      concurrency: 1,
      description: 'Measures average, P95, and P99 response times'
    },
    'load-100': {
      name: 'Load Test - 100 Users',
      icon: Users,
      requests: 1000,
      concurrency: 100,
      description: 'Simulates 100 concurrent users'
    },
    'load-1000': {
      name: 'Load Test - 1,000 Users',
      icon: Users,
      requests: 10000,
      concurrency: 1000,
      description: 'Simulates 1,000 concurrent users'
    },
    'stress': {
      name: 'Stress Testing',
      icon: AlertCircle,
      requests: 5000,
      concurrency: 500,
      description: 'Finds the breaking point of your API'
    },
    'spike': {
      name: 'Spike Testing',
      icon: TrendingUp,
      requests: 2000,
      concurrency: 1000,
      description: 'Tests sudden traffic surge (10 to 10,000 users)'
    },
    'endurance': {
      name: 'Endurance Testing',
      icon: Repeat,
      requests: 10000,
      concurrency: 50,
      description: 'Long-running test for memory leaks'
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
    const stateToSave = {
      apiEndpoint,
      testType,
      httpMethod,
      requestBody,
      customHeaders,
      results,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('performanceTestingState', JSON.stringify(stateToSave));
  }, [apiEndpoint, testType, httpMethod, requestBody, customHeaders, results]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const makeRequest = async (url) => {
    const startTime = performance.now();
    let responseSize = 0;

    try {
      // Parse custom headers if provided
      let headers = { 'Content-Type': 'application/json' };
      if (customHeaders) {
        try {
          const parsedHeaders = JSON.parse(customHeaders);
          headers = { ...headers, ...parsedHeaders };
        } catch (e) {
          // Invalid JSON, ignore custom headers
        }
      }

      // Prepare request options
      const options = {
        method: httpMethod,
        mode: 'cors',
        headers: headers,
      };

      // Add body for POST, PUT, PATCH methods
      if (['POST', 'PUT', 'PATCH'].includes(httpMethod) && requestBody) {
        try {
          options.body = JSON.stringify(JSON.parse(requestBody));
        } catch (e) {
          options.body = requestBody; // Use as plain text if not valid JSON
        }
      }

      const response = await fetch(url, options);

      // Get response size
      const responseText = await response.text();
      responseSize = new Blob([responseText]).size;

      const endTime = performance.now();
      const duration = endTime - startTime;

      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        duration: duration,
        size: responseSize
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        status: 0,
        statusText: 'Network Error',
        duration: endTime - startTime,
        error: error.message,
        size: 0
      };
    }
  };

  const calculateStats = (durations) => {
    const sorted = [...durations].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    const avg = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const p50 = sorted[Math.floor(sorted.length * 0.50)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    
    return { avg, min, max, p50, p95, p99 };
  };

  const runPerformanceTest = async () => {
    if (!apiEndpoint) {
      addLog('Please enter an API endpoint', 'error');
      return;
    }

    setIsRunning(true);
    setProgress(0);
    setResults(null);
    setLogs([]);

    const config = testConfigs[testType];
    addLog(`Starting ${config.name}...`, 'info');
    addLog(`Configuration: ${config.requests} requests, ${config.concurrency} concurrent users`, 'info');

    const startTime = Date.now();
    const results = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      // Batch requests based on concurrency
      const batches = Math.ceil(config.requests / config.concurrency);
      
      for (let batch = 0; batch < batches; batch++) {
        const batchSize = Math.min(config.concurrency, config.requests - batch * config.concurrency);
        const promises = [];

        for (let i = 0; i < batchSize; i++) {
          promises.push(makeRequest(apiEndpoint));
        }

        const batchResults = await Promise.all(promises);
        
        batchResults.forEach(result => {
          results.push(result);
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        });

        const currentProgress = ((batch + 1) / batches) * 100;
        setProgress(currentProgress);
        addLog(`Batch ${batch + 1}/${batches} completed: ${batchResults.length} requests`, 'success');

        // Small delay between batches to prevent overwhelming
        if (batch < batches - 1) {
          await sleep(100);
        }
      }

      const endTime = Date.now();
      const totalDuration = (endTime - startTime) / 1000;

      // Calculate statistics
      const successfulDurations = results
        .filter(r => r.success)
        .map(r => r.duration);

      const stats = calculateStats(successfulDurations);
      const throughput = config.requests / totalDuration;

      // Calculate total data transferred
      const totalSize = results.reduce((sum, r) => sum + (r.size || 0), 0);
      const avgSize = totalSize / results.length;

      // Calculate error distribution
      const errorTypes = {};
      results.filter(r => !r.success).forEach(r => {
        const errorKey = r.error || `HTTP ${r.status}`;
        errorTypes[errorKey] = (errorTypes[errorKey] || 0) + 1;
      });

      const finalResults = {
        totalRequests: config.requests,
        successCount,
        failureCount,
        successRate: ((successCount / config.requests) * 100).toFixed(2),
        totalDuration: totalDuration.toFixed(2),
        throughput: throughput.toFixed(2),
        totalDataTransferred: (totalSize / 1024).toFixed(2), // KB
        avgResponseSize: (avgSize / 1024).toFixed(2), // KB
        errorTypes: errorTypes,
        stats: {
          avg: stats.avg.toFixed(2),
          min: stats.min.toFixed(2),
          max: stats.max.toFixed(2),
          p50: stats.p50.toFixed(2),
          p95: stats.p95.toFixed(2),
          p99: stats.p99.toFixed(2)
        }
      };

      setResults(finalResults);
      addLog(`Test completed successfully!`, 'success');
      addLog(`Total Duration: ${totalDuration.toFixed(2)}s | Throughput: ${throughput.toFixed(2)} req/s`, 'info');
      
      // Performance assessment
      if (stats.avg < 200) {
        addLog('✅ Excellent: Average response time < 200ms', 'success');
      } else if (stats.avg < 500) {
        addLog('⚠️ Good: Average response time < 500ms', 'warning');
      } else {
        addLog('❌ Poor: Average response time > 500ms - Optimization needed', 'error');
      }

      if (stats.p95 < 500) {
        addLog('✅ Excellent: P95 response time < 500ms', 'success');
      } else if (stats.p95 < 1000) {
        addLog('⚠️ Good: P95 response time < 1000ms', 'warning');
      } else {
        addLog('❌ Poor: P95 response time > 1000ms - Optimization needed', 'error');
      }

    } catch (error) {
      addLog(`Test failed: ${error.message}`, 'error');
    }

    setIsRunning(false);
    setProgress(100);
  };

  const getStatusColor = (value, thresholds) => {
    if (value < thresholds.good) return 'text-green-600';
    if (value < thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back to Home Button */}
        <div className="mb-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 backdrop-blur-lg text-white rounded-xl font-semibold transition-all duration-300 border border-white/20 hover:border-white/40 shadow-lg hover:shadow-xl"
          >
            <ArrowLeft className="w-5 h-5" />
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>

        {/* Header */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
          <div className="flex items-center gap-4 mb-4">
            <div className="bg-purple-500 p-3 rounded-xl">
              <Zap className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-white">Performance Testing Dashboard</h1>
              <p className="text-purple-200">Comprehensive API Performance Analysis</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Configuration with Tabs */}
          <div className="lg:col-span-1">
            {/* Configuration Tabs */}
            <div className="bg-white/10 backdrop-blur-lg rounded-t-2xl shadow-2xl border border-white/20 border-b-0">
              <div className="flex gap-2 p-4">
                <button
                  onClick={() => setConfigTab('basic')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${
                    configTab === 'basic'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  <Settings className="w-4 h-4" />
                  Basic
                </button>
                <button
                  onClick={() => setConfigTab('request')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${
                    configTab === 'request'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Request
                </button>
                <button
                  onClick={() => setConfigTab('testtype')}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition-all text-sm ${
                    configTab === 'testtype'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  <Target className="w-4 h-4" />
                  Test Type
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white/10 backdrop-blur-lg rounded-b-2xl shadow-2xl p-6 border border-white/20 min-h-[500px] max-h-[600px] overflow-y-auto">
              {/* Basic Config Tab */}
              {configTab === 'basic' && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Settings className="w-5 h-5" />
                    Basic Configuration
                  </h2>

                  {/* API Endpoint Input */}
                  <div className="mb-6">
                    <label className="block text-purple-200 text-sm font-semibold mb-2">
                      API Endpoint *
                    </label>
                    <input
                      type="text"
                      value={apiEndpoint}
                      onChange={(e) => setApiEndpoint(e.target.value)}
                      placeholder="https://api.example.com/endpoint"
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-purple-400/30 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>

                  {/* HTTP Method Selection */}
                  <div className="mb-6">
                    <label className="block text-purple-200 text-sm font-semibold mb-2">
                      HTTP Method
                    </label>
                    <select
                      value={httpMethod}
                      onChange={(e) => setHttpMethod(e.target.value)}
                      disabled={isRunning}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-purple-400/30 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="GET" className="bg-slate-800">GET</option>
                      <option value="POST" className="bg-slate-800">POST</option>
                      <option value="PUT" className="bg-slate-800">PUT</option>
                      <option value="PATCH" className="bg-slate-800">PATCH</option>
                      <option value="DELETE" className="bg-slate-800">DELETE</option>
                    </select>
                  </div>

                  <div className="bg-purple-500/20 border border-purple-400/30 rounded-lg p-4 mt-6">
                    <h4 className="font-bold text-white mb-2 text-sm">Quick Tips:</h4>
                    <ul className="space-y-1 text-xs text-purple-200">
                      <li>Enter your API endpoint URL</li>
                      <li>Select the HTTP method to test</li>
                      <li>Configure request data in the Request tab</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Request Data Tab */}
              {configTab === 'request' && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Request Data
                  </h2>

                  {/* Request Body (for POST, PUT, PATCH) */}
                  {['POST', 'PUT', 'PATCH'].includes(httpMethod) && (
                    <div className="mb-6">
                      <label className="block text-purple-200 text-sm font-semibold mb-2">
                        Request Body (JSON)
                      </label>
                      <textarea
                        value={requestBody}
                        onChange={(e) => setRequestBody(e.target.value)}
                        placeholder='{"key": "value"}'
                        disabled={isRunning}
                        className="w-full px-4 py-3 rounded-lg bg-white/10 border border-purple-400/30 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                        rows={6}
                      />
                    </div>
                  )}

                  {/* Custom Headers */}
                  <div className="mb-6">
                    <label className="block text-purple-200 text-sm font-semibold mb-2">
                      Custom Headers (JSON, Optional)
                    </label>
                    <textarea
                      value={customHeaders}
                      onChange={(e) => setCustomHeaders(e.target.value)}
                      placeholder='{"Authorization": "Bearer token"}'
                      disabled={isRunning}
                      className="w-full px-4 py-3 rounded-lg bg-white/10 border border-purple-400/30 text-white placeholder-purple-300/50 focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono text-sm"
                      rows={5}
                    />
                  </div>

                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-4 mt-6">
                    <h4 className="font-bold text-white mb-2 text-sm">Request Info:</h4>
                    <ul className="space-y-1 text-xs text-blue-200">
                      <li>Add custom headers for authentication</li>
                      <li>Provide request body for POST/PUT/PATCH</li>
                      <li>Use valid JSON format for both fields</li>
                    </ul>
                  </div>
                </div>
              )}

              {/* Test Type Tab */}
              {configTab === 'testtype' && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Select Test Type
                  </h2>

                  <div className="space-y-2">
                    {Object.entries(testConfigs).map(([key, config]) => {
                      const Icon = config.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => setTestType(key)}
                          disabled={isRunning}
                          className={`w-full p-4 rounded-lg border transition-all ${
                            testType === key
                              ? 'bg-purple-500 border-purple-400 text-white shadow-lg'
                              : 'bg-white/5 border-white/10 text-purple-200 hover:bg-white/10'
                          } ${isRunning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5" />
                            <div className="text-left">
                              <div className="font-semibold">{config.name}</div>
                              <div className="text-xs opacity-80">{config.description}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Run Button - Always visible below tabs */}
            <div className="mt-4">
              <button
                onClick={runPerformanceTest}
                disabled={isRunning || !apiEndpoint}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  isRunning || !apiEndpoint
                    ? 'bg-gray-600 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg hover:shadow-xl'
                } text-white`}
              >
                {isRunning ? (
                  <span className="flex items-center justify-center gap-2">
                    <Activity className="w-5 h-5 animate-spin" />
                    Running Test... {progress.toFixed(0)}%
                  </span>
                ) : (
                  'Start Performance Test'
                )}
              </button>

              {/* Progress Bar */}
              {isRunning && (
                <div className="mt-4">
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-pink-500 h-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Tabbed Results and Logs */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white/10 backdrop-blur-lg rounded-t-2xl shadow-2xl border border-white/20 border-b-0">
              <div className="flex gap-2 p-4">
                <button
                  onClick={() => setActiveTab('results')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === 'results'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  <BarChart3 className="w-5 h-5" />
                  Results
                </button>
                <button
                  onClick={() => setActiveTab('logs')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-lg font-semibold transition-all ${
                    activeTab === 'logs'
                      ? 'bg-purple-600 text-white shadow-lg'
                      : 'bg-white/10 text-purple-200 hover:bg-white/20'
                  }`}
                >
                  <AlertCircle className="w-5 h-5" />
                  Logs
                  {logs.length > 0 && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{logs.length}</span>
                  )}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white/10 backdrop-blur-lg rounded-b-2xl shadow-2xl p-6 border border-white/20">
              {/* Results Tab */}
              {activeTab === 'results' && results && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                      <Activity className="w-6 h-6" />
                      Test Results
                    </h2>
                    <button
                      onClick={() => setShowGitHub(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gray-800 to-gray-700 hover:from-gray-700 hover:to-gray-600 text-white rounded-lg font-semibold transition-all shadow-lg hover:shadow-xl"
                    >
                      <Github className="w-5 h-5" />
                      Save to GitHub
                    </button>
                  </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Total Requests</div>
                    <div className="text-2xl font-bold text-white">{results.totalRequests}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Success Rate</div>
                    <div className={`text-2xl font-bold ${results.successRate >= 99 ? 'text-green-400' : 'text-yellow-400'}`}>
                      {results.successRate}%
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Duration</div>
                    <div className="text-2xl font-bold text-white">{results.totalDuration}s</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Throughput</div>
                    <div className="text-2xl font-bold text-white">{results.throughput} req/s</div>
                  </div>
                </div>

                {/* Additional Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Total Data</div>
                    <div className="text-xl font-bold text-white">{results.totalDataTransferred} KB</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Avg Response Size</div>
                    <div className="text-xl font-bold text-white">{results.avgResponseSize} KB</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                    <div className="text-purple-300 text-sm mb-1">Failed Requests</div>
                    <div className="text-xl font-bold text-red-400">{results.failureCount}</div>
                  </div>
                </div>

                {/* Error Types (if any) */}
                {results.failureCount > 0 && Object.keys(results.errorTypes).length > 0 && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
                    <h4 className="font-bold text-red-300 mb-2">Error Distribution:</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(results.errorTypes).map(([error, count]) => (
                        <div key={error} className="text-red-200 flex justify-between">
                          <span>{error}</span>
                          <span className="font-bold">{count} occurrences</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Response Time Statistics */}
                <div className="bg-white/5 p-6 rounded-lg border border-white/10">
                  <h3 className="text-xl font-bold text-white mb-4">Response Time Statistics (ms)</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <div className="text-purple-300 text-sm mb-1">Average</div>
                      <div className={`text-xl font-bold ${getStatusColor(parseFloat(results.stats.avg), { good: 200, warning: 500 })}`}>
                        {results.stats.avg}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">Minimum</div>
                      <div className="text-xl font-bold text-green-400">{results.stats.min}ms</div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">Maximum</div>
                      <div className="text-xl font-bold text-red-400">{results.stats.max}ms</div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">P50 (Median)</div>
                      <div className="text-xl font-bold text-white">{results.stats.p50}ms</div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">P95</div>
                      <div className={`text-xl font-bold ${getStatusColor(parseFloat(results.stats.p95), { good: 500, warning: 1000 })}`}>
                        {results.stats.p95}ms
                      </div>
                    </div>
                    <div>
                      <div className="text-purple-300 text-sm mb-1">P99</div>
                      <div className={`text-xl font-bold ${getStatusColor(parseFloat(results.stats.p99), { good: 1000, warning: 2000 })}`}>
                        {results.stats.p99}ms
                      </div>
                    </div>
                  </div>
                </div>

                {/* Performance Assessment */}
                <div className="mt-4 p-4 bg-purple-500/20 border border-purple-400/30 rounded-lg">
                  <h4 className="font-bold text-white mb-2">Performance Assessment:</h4>
                  <ul className="space-y-1 text-sm text-purple-200">
                    <li>✅ Average &lt; 200ms = Excellent</li>
                    <li>⚠️ Average 200-500ms = Good</li>
                    <li>❌ Average &gt; 500ms = Needs Optimization</li>
                  </ul>
                </div>
                </div>
              )}

              {/* Empty State for Results Tab */}
              {activeTab === 'results' && !results && (
                <div className="text-center py-12">
                  <BarChart3 className="w-16 h-16 text-purple-300/50 mx-auto mb-4" />
                  <p className="text-purple-200 text-lg font-semibold">No results yet</p>
                  <p className="text-purple-300/70 text-sm mt-2">Run a performance test to see results here</p>
                </div>
              )}

              {/* Logs Tab */}
              {activeTab === 'logs' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                    <AlertCircle className="w-6 h-6" />
                    Test Logs
                  </h2>
                  <div className="bg-black/30 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
                    {logs.length === 0 ? (
                      <div className="text-purple-300/50 italic">No logs yet. Start a test to see logs.</div>
                    ) : (
                      logs.map((log, index) => (
                        <div
                          key={index}
                          className={`mb-2 ${
                            log.type === 'error'
                              ? 'text-red-400'
                              : log.type === 'success'
                              ? 'text-green-400'
                              : log.type === 'warning'
                              ? 'text-yellow-400'
                              : 'text-purple-300'
                          }`}
                        >
                          <span className="text-purple-400">[{log.timestamp}]</span> {log.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
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
              test: `Performance Test - ${testConfigs[testType].name}`,
              status: results.successRate >= 95 ? 'PASS' : 'FAIL',
              details: `${results.totalRequests} requests | Success Rate: ${results.successRate}% | Avg Response: ${results.stats.avg}ms | P95: ${results.stats.p95}ms | Throughput: ${results.throughput} req/s`,
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