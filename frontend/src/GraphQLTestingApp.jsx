import React, { useState, useEffect } from 'react';
import { FileText, Play, Download, AlertCircle, CheckCircle, XCircle, Zap, Code, Database, TrendingUp } from 'lucide-react';
import Toast from './Toast';

const GraphQLTestingApp = () => {
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

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 p-8">
      {toast.show && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast({ ...toast, show: false })}
        />
      )}

      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Database className="w-10 h-10 text-purple-400" />
          <h1 className="text-4xl font-bold text-white">GraphQL API Testing</h1>
        </div>
        <p className="text-gray-300 text-lg">
          AI-powered GraphQL testing with schema introspection, N+1 detection, and advanced validations
        </p>
      </div>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex items-center justify-between">
          {[
            { num: 1, label: 'Configure', icon: Code },
            { num: 2, label: 'Generate Tests', icon: Zap },
            { num: 3, label: 'Run Tests', icon: Play },
            { num: 4, label: 'Results', icon: TrendingUp }
          ].map((s, idx) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all ${
                    step >= s.num
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  <s.icon className="w-6 h-6" />
                </div>
                <span className={`text-sm ${step >= s.num ? 'text-purple-400' : 'text-gray-500'}`}>
                  {s.label}
                </span>
              </div>
              {idx < 3 && (
                <div
                  className={`flex-1 h-1 mx-4 rounded ${
                    step > s.num ? 'bg-purple-600' : 'bg-gray-700'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        {/* Step 1: Configure */}
        {step === 1 && (
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Code className="w-6 h-6" />
              Configure GraphQL Endpoint
            </h2>

            <div className="space-y-6">
              {/* Endpoint Input */}
              <div>
                <label className="block text-gray-300 mb-2 font-medium">
                  GraphQL Endpoint URL *
                </label>
                <input
                  type="text"
                  value={graphqlEndpoint}
                  onChange={(e) => setGraphqlEndpoint(e.target.value)}
                  placeholder="https://api.example.com/graphql"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                />
                <p className="text-gray-400 text-sm mt-2">
                  Enter your GraphQL endpoint. We'll automatically discover the schema using introspection.
                </p>
              </div>

              {/* Authentication */}
              <div>
                <label className="block text-gray-300 mb-2 font-medium">Authentication</label>
                <select
                  value={authConfig.type}
                  onChange={(e) => setAuthConfig({ ...authConfig, type: e.target.value })}
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                >
                  <option value="none">No Authentication</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key">API Key</option>
                  <option value="basic">Basic Auth</option>
                </select>
              </div>

              {/* Auth Details */}
              {authConfig.type === 'bearer' && (
                <div>
                  <label className="block text-gray-300 mb-2">Bearer Token</label>
                  <input
                    type="password"
                    value={authConfig.token || ''}
                    onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                    placeholder="Your bearer token"
                    className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                  />
                </div>
              )}

              {authConfig.type === 'api_key' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Header Name</label>
                    <input
                      type="text"
                      value={authConfig.key_name || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, key_name: e.target.value })}
                      placeholder="X-API-Key"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">API Key</label>
                    <input
                      type="password"
                      value={authConfig.api_key || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, api_key: e.target.value })}
                      placeholder="Your API key"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {authConfig.type === 'basic' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 mb-2">Username</label>
                    <input
                      type="text"
                      value={authConfig.username || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                      placeholder="Username"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 mb-2">Password</label>
                    <input
                      type="password"
                      value={authConfig.password || ''}
                      onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                      placeholder="Password"
                      className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={discoverSchema}
                disabled={loading}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Discovering Schema...
                  </>
                ) : (
                  <>
                    <Database className="w-5 h-5" />
                    Discover Schema
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Generate Tests */}
        {step === 2 && schema && (
          <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Zap className="w-6 h-6" />
              AI-Powered Test Generation
            </h2>

            {/* Schema Info */}
            <div className="bg-gray-700 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Schema Discovered</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-purple-400">{schema.queries?.length || 0}</div>
                  <div className="text-gray-300 text-sm">Queries</div>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-green-400">{schema.mutations?.length || 0}</div>
                  <div className="text-gray-300 text-sm">Mutations</div>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">{schema.types?.length || 0}</div>
                  <div className="text-gray-300 text-sm">Types</div>
                </div>
              </div>
            </div>

            {/* Test Type Selection */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-white mb-4">Select Test Types</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.entries({
                  queries: '🔍 Query Tests - Test all queries',
                  mutations: '✏️ Mutation Tests - Test all mutations',
                  nested: '🔗 Nested Query Tests - Test deep relationships',
                  fragments: '📦 Fragment Tests - Test reusable fragments',
                  errors: '❌ Error Handling - Test error scenarios',
                  performance: '⚡ Performance Tests - N+1 detection & complexity'
                }).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 bg-gray-700 p-4 rounded-lg cursor-pointer hover:bg-gray-600">
                    <input
                      type="checkbox"
                      checked={selectedTestTypes[key]}
                      onChange={(e) => setSelectedTestTypes({ ...selectedTestTypes, [key]: e.target.checked })}
                      className="w-5 h-5 text-purple-600"
                    />
                    <span className="text-gray-200">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
              >
                Back
              </button>
              <button
                onClick={generateTests}
                disabled={loading}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Generating Tests...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5" />
                    Generate AI Tests
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Run Tests */}
        {step === 3 && generatedTests.length > 0 && (
          <div className="space-y-6">
            {/* Test Summary */}
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <Play className="w-6 h-6" />
                Review & Run Tests
              </h2>

              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-white">{generatedTests.length}</div>
                  <div className="text-gray-300 text-sm">Total Tests</div>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-blue-400">
                    {generatedTests.filter(t => t.type === 'query').length}
                  </div>
                  <div className="text-gray-300 text-sm">Query Tests</div>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-green-400">
                    {generatedTests.filter(t => t.type === 'mutation').length}
                  </div>
                  <div className="text-gray-300 text-sm">Mutation Tests</div>
                </div>
                <div className="bg-gray-700 p-4 rounded-lg">
                  <div className="text-3xl font-bold text-purple-400">
                    {generatedTests.filter(t => t.type === 'performance').length}
                  </div>
                  <div className="text-gray-300 text-sm">Performance</div>
                </div>
              </div>

              {/* Natural Language Query Builder */}
              <div className="bg-gradient-to-r from-purple-900/40 to-blue-900/40 p-6 rounded-lg mb-6 border border-purple-600/30">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="w-6 h-6 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">🤖 AI Query Builder</h3>
                  <span className="px-2 py-1 bg-purple-600 text-white text-xs rounded-full">NEW</span>
                </div>
                <p className="text-gray-300 text-sm mb-4">
                  Describe what you want to query in plain English, and AI will generate the GraphQL query for you!
                </p>

                {/* NL Input */}
                <div className="mb-4">
                  <label className="block text-gray-300 mb-2 font-medium">Describe your query</label>
                  <input
                    type="text"
                    value={nlDescription}
                    onChange={(e) => setNlDescription(e.target.value)}
                    placeholder="e.g., Get all countries with their languages and currencies"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        generateQueryFromNL();
                      }
                    }}
                  />
                </div>

                <button
                  onClick={generateQueryFromNL}
                  disabled={nlGenerating}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {nlGenerating ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Generating Query with AI...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Generate GraphQL Query
                    </>
                  )}
                </button>

                {/* Generated Query Display */}
                {generatedQuery && (
                  <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-green-600/30">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-green-400 font-semibold">Query Generated!</span>
                    </div>
                    {queryExplanation && (
                      <p className="text-gray-300 text-sm mb-3 italic">{queryExplanation}</p>
                    )}
                    <pre className="text-gray-200 text-sm font-mono overflow-x-auto bg-gray-900 p-3 rounded">
                      {generatedQuery}
                    </pre>
                    <p className="text-gray-400 text-xs mt-2">
                      ✨ Query has been auto-filled below. You can edit it before adding to tests.
                    </p>
                  </div>
                )}
              </div>

              {/* Add Custom Query */}
              <div className="bg-gray-700 p-6 rounded-lg mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Add Custom Query (Optional)</h3>
                <p className="text-gray-400 text-sm mb-3">
                  Manually write or edit the AI-generated query below:
                </p>
                <textarea
                  value={customQuery}
                  onChange={(e) => setCustomQuery(e.target.value)}
                  placeholder="query { users { id name email } }"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-purple-500 h-32"
                />
                <button
                  onClick={addCustomQuery}
                  className="mt-4 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-all"
                >
                  Add Custom Query
                </button>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                >
                  Back
                </button>
                <button
                  onClick={runTests}
                  disabled={loading}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Running Tests...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      Run All Tests ({generatedTests.length})
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Test Preview */}
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Test Preview (First 5)</h3>
              <div className="space-y-3">
                {generatedTests.slice(0, 5).map((test, idx) => (
                  <div key={idx} className="bg-gray-700 p-4 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{test.name}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        test.type === 'query' ? 'bg-blue-500' :
                        test.type === 'mutation' ? 'bg-green-500' :
                        test.type === 'performance' ? 'bg-purple-500' :
                        'bg-gray-500'
                      } text-white`}>
                        {test.type}
                      </span>
                    </div>
                    <pre className="text-gray-300 text-sm font-mono overflow-x-auto">
                      {test.query?.substring(0, 100)}...
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Results */}
        {step === 4 && testResults && (
          <div className="space-y-6">
            {/* Results Summary */}
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                Test Results
              </h2>

              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-green-900 bg-opacity-30 p-6 rounded-lg border border-green-700">
                  <CheckCircle className="w-8 h-8 text-green-400 mb-2" />
                  <div className="text-3xl font-bold text-green-400">{testResults.summary?.passed || 0}</div>
                  <div className="text-gray-300 text-sm">Passed</div>
                </div>
                <div className="bg-red-900 bg-opacity-30 p-6 rounded-lg border border-red-700">
                  <XCircle className="w-8 h-8 text-red-400 mb-2" />
                  <div className="text-3xl font-bold text-red-400">{testResults.summary?.failed || 0}</div>
                  <div className="text-gray-300 text-sm">Failed</div>
                </div>
                <div className="bg-blue-900 bg-opacity-30 p-6 rounded-lg border border-blue-700">
                  <Zap className="w-8 h-8 text-blue-400 mb-2" />
                  <div className="text-3xl font-bold text-blue-400">{testResults.summary?.avg_response_time || 0}ms</div>
                  <div className="text-gray-300 text-sm">Avg Response</div>
                </div>
                <div className="bg-purple-900 bg-opacity-30 p-6 rounded-lg border border-purple-700">
                  <AlertCircle className="w-8 h-8 text-purple-400 mb-2" />
                  <div className="text-3xl font-bold text-purple-400">{testResults.summary?.n_plus_one_detected || 0}</div>
                  <div className="text-gray-300 text-sm">N+1 Detected</div>
                </div>
              </div>

              {/* AI Insights */}
              {testResults.ai_insights && (
                <div className="bg-gradient-to-r from-purple-900 to-blue-900 p-6 rounded-lg border border-purple-700 mb-6">
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    AI-Powered Insights
                  </h3>
                  <div className="space-y-2">
                    {testResults.ai_insights.recommendations?.map((rec, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                        <p className="text-gray-200 text-sm">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Buttons */}
              <div className="flex gap-4">
                <button
                  onClick={() => downloadReport('json')}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <Download className="w-5 h-5" />
                  Download JSON
                </button>
                <button
                  onClick={() => downloadReport('pdf')}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                >
                  <FileText className="w-5 h-5" />
                  Download PDF
                </button>
                <button
                  onClick={() => {
                    setStep(1);
                    setGeneratedTests([]);
                    setTestResults(null);
                    setSchema(null);
                  }}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg transition-all"
                >
                  New Test
                </button>
              </div>
            </div>

            {/* Detailed Results */}
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">Detailed Test Results</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {testResults.results?.map((result, idx) => (
                  <div
                    key={idx}
                    className={`p-4 rounded-lg border-l-4 ${
                      result.status === 'PASS'
                        ? 'bg-green-900 bg-opacity-20 border-green-500'
                        : 'bg-red-900 bg-opacity-20 border-red-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white font-medium">{result.test_name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-400 text-sm">{result.response_time}ms</span>
                        {result.status === 'PASS' ? (
                          <CheckCircle className="w-5 h-5 text-green-400" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-400" />
                        )}
                      </div>
                    </div>
                    {result.error && (
                      <p className="text-red-300 text-sm mt-2">{result.error}</p>
                    )}
                    {result.n_plus_one_warning && (
                      <div className="mt-2 flex items-center gap-2 text-yellow-400 text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>N+1 Query Detected</span>
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
