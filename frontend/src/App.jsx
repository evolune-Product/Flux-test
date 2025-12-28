import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Check, Settings, Lock, Zap, Play, Download, RefreshCw, FileJson, FileText, Loader, Edit, Trash2, Plus, X, User, Github, Activity, AlertTriangle, Home } from 'lucide-react';
import Profile from './Profile.jsx';
import GitHubIntegration from './GitHubIntegration.jsx';
import AIAnalysisPanel from './AIAnalysisPanel.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// TestResultItem Component with AI Analysis Support
const TestResultItem = ({ result, idx }) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(result.ai_analysis || null);
  const [showAnalysis, setShowAnalysis] = useState(false);

  // Check if this failure was auto-analyzed (critical failure)
  const autoAnalyzed = result.ai_analysis !== undefined;

  const handleAnalyzeFailure = async () => {
    setAnalyzing(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/analyze-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          test_name: result.test,
          test_type: 'functional',
          endpoint: result.endpoint || 'Unknown',
          method: result.method || 'GET',
          expected_status: result.expected_status || 200,
          actual_status: result.actual_status || 0,
          error_message: result.details,
          request_data: result.request_data || {},
          actual_response: result.response_data || {},
          response_time: result.response_data?.time || 0
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAiAnalysis(data.analysis);
        setShowAnalysis(true);
      } else {
        console.error('AI analysis failed:', await response.text());
      }
    } catch (error) {
      console.error('AI analysis error:', error);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-lg border-l-4 ${
        result.status === 'PASS'
          ? 'bg-green-50 border-green-500'
          : 'bg-red-50 border-red-500'
      }`}
    >
      <div className="font-semibold">
        {result.status === 'PASS' ? '✅' : '❌'} {result.test}
      </div>
      <div className="text-sm text-gray-600 mt-1">{result.details}</div>
      <div className="text-xs text-gray-400 mt-1">🕐 {result.timestamp}</div>

      {/* AI Analysis Panel for Failed Tests */}
      {result.status === 'FAIL' && (
        <AIAnalysisPanel
          analysis={showAnalysis || autoAnalyzed ? aiAnalysis : null}
          onAnalyze={!autoAnalyzed && !showAnalysis ? handleAnalyzeFailure : null}
          analyzing={analyzing}
          autoAnalyzed={autoAnalyzed}
        />
      )}
    </div>
  );
};

function App({ user, onLogout }) {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [apiUrl, setApiUrl] = useState('https://jsonplaceholder.typicode.com/posts');
  const [sampleData, setSampleData] = useState('{\n  "title": "Test Post",\n  "body": "This is a test",\n  "userId": 1\n}');
  const [timeout, setTimeout] = useState(10);
  const [authConfig, setAuthConfig] = useState({ type: 'none' });
  const [authType, setAuthType] = useState('none');
  const [testCases, setTestCases] = useState([]);
  const [testResults, setTestResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [numTests, setNumTests] = useState(30);
  const [testTypes, setTestTypes] = useState({
    happy_path: true,
    edge_cases: true,
    negative_tests: true,
    security_tests: true
  });
  
  // Custom test editor states
  const [customTests, setCustomTests] = useState([]);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [editingTest, setEditingTest] = useState(null);
  const [customTestForm, setCustomTestForm] = useState({
    method: 'GET',
    endpoint: '',
    description: '',
    data: '',
    params: '',
    expected_status: 200,
    category: 'custom'
  });
  const [nlTestInput, setNlTestInput] = useState('');
  const [nlGenerating, setNlGenerating] = useState(false);
  
  // Test preview states
  const [showTestPreview, setShowTestPreview] = useState(false);
  const [generatedTests, setGeneratedTests] = useState([]);
  const [previewFilter, setPreviewFilter] = useState('all');
  const [selectedTests, setSelectedTests] = useState([]);
  const [editingPreviewTest, setEditingPreviewTest] = useState(null);

  const steps = [
    { num: 1, icon: '🎯', title: 'Configure API', desc: 'Set up endpoint' },
    { num: 2, icon: '🔒', title: 'Authentication', desc: 'Optional security' },
    { num: 3, icon: '⚙️', title: 'Generate Tests', desc: 'AI-powered' },
    { num: 4, icon: '▶️', title: 'Run Tests', desc: 'Execute & view' },
    { num: 5, icon: '📊', title: 'Results', desc: 'Download reports' }
  ];

  // Reset preview when any configuration changes
  const handleConfigChange = (configType, value) => {
    // Clear preview when configuration changes
    if (showTestPreview) {
      setShowTestPreview(false);
      setGeneratedTests([]);
      setSelectedTests([]);
      setStatusMessage('');
    }
    
    // Update the specific configuration
    if (configType === 'numTests') {
      setNumTests(value);
    } else if (configType === 'testTypes') {
      setTestTypes(value);
    }
  };

  // Reset preview when navigating backwards
  const handleStepChange = (stepNumber) => {
    // Clear test preview if going back to step 1 or 2
    if (stepNumber < 3) {
      setShowTestPreview(false);
      setGeneratedTests([]);
      setSelectedTests([]);
      setStatusMessage('');
    }
    
    // Clear test results if going back before step 5
    if (stepNumber < 5) {
      setTestResults(null);
    }
    
    setCurrentStep(stepNumber);
  };

  const handleGenerateTests = async () => {
    // Reset previous preview before generating new tests
    setShowTestPreview(false);
    setGeneratedTests([]);
    setSelectedTests([]);
    
    setLoading(true);
    setStatusMessage('Generating test cases...');
    
    try {
      const sampleJson = JSON.parse(sampleData);
      const selectedTypes = Object.keys(testTypes).filter(key => testTypes[key]);
      const hasAuth = authConfig.type !== 'none';

      const response = await fetch(`${API_BASE_URL}/generate-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          api_url: apiUrl,
          sample_data: sampleJson,
          num_tests: numTests,
          test_types: selectedTypes,
          has_auth: hasAuth
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.test_cases) {
        setGeneratedTests(data.test_cases);
        setSelectedTests(data.test_cases.map((_, idx) => idx)); // Select all by default
        setShowTestPreview(true);
        setStatusMessage(`✅ Generated ${data.test_cases.length} AI tests! Review them below.`);
      } else {
        setStatusMessage('❌ Failed to generate tests');
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleProceedWithTests = () => {
    // Combine selected AI tests with custom tests
    const selectedAITests = generatedTests.filter((_, idx) => selectedTests.includes(idx));
    const allTests = [...selectedAITests, ...customTests];
    setTestCases(allTests);
    setStatusMessage(`✅ Proceeding with ${selectedAITests.length} AI + ${customTests.length} custom = ${allTests.length} total tests!`);
    setTimeout(() => {
      setCurrentStep(4);
    }, 1500);
  };

  const handleToggleTest = (index) => {
    if (selectedTests.includes(index)) {
      setSelectedTests(selectedTests.filter(i => i !== index));
    } else {
      setSelectedTests([...selectedTests, index]);
    }
  };

  const handleSelectAll = () => {
    const filtered = getFilteredTests();
    const allIndices = filtered.map(t => t.originalIndex);
    setSelectedTests([...new Set([...selectedTests, ...allIndices])]);
  };

  const handleDeselectAll = () => {
    const filtered = getFilteredTests();
    const filteredIndices = filtered.map(t => t.originalIndex);
    setSelectedTests(selectedTests.filter(i => !filteredIndices.includes(i)));
  };

  const getFilteredTests = () => {
    return generatedTests
      .map((test, idx) => ({ ...test, originalIndex: idx }))
      .filter(test => {
        if (previewFilter === 'all') return true;
        return test.category === previewFilter;
      });
  };

  const getCategoryStats = () => {
    const stats = {
      all: generatedTests.length,
      happy_path: 0,
      edge_case: 0,
      negative_test: 0,
      security_test: 0,
      other: 0
    };
    
    generatedTests.forEach(test => {
      const cat = test.category || 'other';
      stats[cat] = (stats[cat] || 0) + 1;
    });
    
    return stats;
  };

  const handleGenerateFromNL = async () => {
    if (!nlTestInput.trim()) {
      alert('Please describe your test in plain English');
      return;
    }

    setNlGenerating(true);
    try {
      const response = await fetch(`${API_BASE_URL}/generate-test-from-nl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          description: nlTestInput,
          base_url: apiUrl
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate test: ${response.statusText}`);
      }

      const data = await response.json();

      // Auto-fill the form with AI-generated test
      setCustomTestForm({
        method: data.method || 'GET',
        endpoint: data.endpoint || '',
        description: data.description || nlTestInput,
        data: data.data ? JSON.stringify(data.data, null, 2) : '',
        params: data.params ? JSON.stringify(data.params, null, 2) : '',
        expected_status: data.expected_status || 200,
        category: 'custom'
      });

      setNlTestInput('');
      setStatusMessage('✅ Test generated! Review and click "Add Test" to save it.');
    } catch (error) {
      alert(`Error generating test: ${error.message}`);
    } finally {
      setNlGenerating(false);
    }
  };

  const handleAddCustomTest = () => {
    try {
      const newTest = {
        method: customTestForm.method,
        endpoint: customTestForm.endpoint,
        description: customTestForm.description || `Custom ${customTestForm.method} test`,
        data: customTestForm.data ? JSON.parse(customTestForm.data) : null,
        params: customTestForm.params ? JSON.parse(customTestForm.params) : null,
        expected_status: parseInt(customTestForm.expected_status),
        category: 'custom',
        validate_body: false
      };

      if (editingTest !== null) {
        const updatedTests = [...customTests];
        updatedTests[editingTest] = newTest;
        setCustomTests(updatedTests);
        setEditingTest(null);
      } else {
        setCustomTests([...customTests, newTest]);
      }

      setCustomTestForm({
        method: 'GET',
        endpoint: '',
        description: '',
        data: '',
        params: '',
        expected_status: 200,
        category: 'custom'
      });
      setShowCustomEditor(false);
    } catch (error) {
      alert(`Error adding test: ${error.message}`);
    }
  };

  const handleEditCustomTest = (index) => {
    const test = customTests[index];
    setCustomTestForm({
      method: test.method,
      endpoint: test.endpoint,
      description: test.description,
      data: test.data ? JSON.stringify(test.data, null, 2) : '',
      params: test.params ? JSON.stringify(test.params, null, 2) : '',
      expected_status: test.expected_status,
      category: 'custom'
    });
    setEditingTest(index);
    setShowCustomEditor(true);
  };

  const handleDeleteCustomTest = (index) => {
    if (window.confirm('Are you sure you want to delete this test?')) {
      const updatedTests = customTests.filter((_, i) => i !== index);
      setCustomTests(updatedTests);
    }
  };

  const handleRunTests = async () => {
    setLoading(true);
    setStatusMessage('Running tests...');

    try {
      const response = await fetch(`${API_BASE_URL}/run-tests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({
          base_url: apiUrl,
          auth_config: authConfig,
          timeout: timeout,
          test_cases: testCases
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.results) {
        setTestResults(data);
        setStatusMessage('✅ Tests completed!');
        setTimeout(() => {
          setCurrentStep(5);
        }, 1500);
      }
    } catch (error) {
      setStatusMessage(`❌ Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  const handleDownloadReport = async (format) => {
    try {
      const response = await fetch(`${API_BASE_URL}/download-report/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          test_results: testResults,
          api_url: apiUrl,
          auth_enabled: authConfig.type !== 'none'
        })
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `api_test_report.${format}`;
      a.click();
    } catch (error) {
      alert(`Error downloading report: ${error.message}`);
    }

  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-gradient-to-b from-blue-900 via-indigo-900 to-blue-950 text-white p-6 shadow-2xl overflow-y-auto border-r border-blue-700/30">
        <div className="mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-200 via-purple-200 to-pink-200 bg-clip-text text-transparent">🚀 Evo-TFX</h2>
          <p className="text-xs text-blue-300 mt-1">by EvoluneEdgeTech</p>
        </div>
        {/* User info and profile button */}
        {user && (
          <div className="mb-6">
            <button
              onClick={() => setShowProfile(true)}
              className="w-full p-3 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl border border-white/30 hover:border-purple-400/50 hover:bg-white/20 transition-all text-left group shadow-lg hover:shadow-purple-500/20"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center font-bold group-hover:scale-110 transition-transform shadow-lg">
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-sm font-semibold truncate">{user.username}</div>
                  <div className="text-xs text-blue-200 truncate">{user.email}</div>
                </div>
                <User size={16} className="text-blue-200 group-hover:text-purple-300 transition-colors" />
              </div>
              <div className="text-xs text-center text-blue-200 mt-2 group-hover:text-white transition-colors">
                👤 Click to view profile
              </div>
            </button>
          </div>
        )}

        {/* Home Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full mb-6 p-3 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-500 hover:via-emerald-500 hover:to-teal-500 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-green-500/30 hover:scale-105 transform"
        >
          <Home className="w-5 h-5" />
          Back to Home
        </button>

        <div className="space-y-3">
          {steps.map(step => (
            <button
              key={step.num}
              onClick={() => handleStepChange(step.num)}
              className={`w-full text-left p-4 rounded-xl transition-all shadow-lg ${
                currentStep === step.num
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-2 border-purple-400 shadow-purple-500/50 scale-105'
                  : currentStep > step.num
                  ? 'bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/40'
                  : 'bg-white/5 hover:bg-white/10 border border-white/10'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{step.icon}</span>
                <div>
                  <div className="font-semibold">{step.title}</div>
                  <div className={`text-xs ${currentStep === step.num ? 'text-blue-100' : 'text-blue-200'}`}>{step.desc}</div>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-8 pt-8 border-t border-white/20">
          <div className="text-sm mb-2 font-semibold">Progress: {Math.round((currentStep / 5) * 100)}%</div>
          <div className="w-full bg-white/20 rounded-full h-2.5 shadow-inner">
            <div
              className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 h-2.5 rounded-full transition-all duration-500 shadow-lg"
              style={{ width: `${(currentStep / 5) * 100}%` }}
            />
          </div>
        </div>

        {testCases.length > 0 && (
          <div className="mt-6 p-3 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl border border-white/20 shadow-lg">
            <div className="text-sm font-semibold">📦 Tests Ready: {testCases.length}</div>
            {customTests.length > 0 && (
              <div className="text-sm mt-1 text-blue-200">✏️ Custom: {customTests.length}</div>
            )}
          </div>
        )}

        {testResults && (
          <div className="mt-3 p-3 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-xl text-sm border border-white/20 shadow-lg">
            <div className="text-green-300 font-semibold">✅ Passed: {testResults.summary?.passed || 0}</div>
            <div className="text-red-300 font-semibold">❌ Failed: {testResults.summary?.failed || 0}</div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          
          {/* Step 1: Configure API */}
          {currentStep === 1 && (
            <div>
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                🎯 Step 1: Configure Your API
              </h1>
              <p className="text-gray-300 mb-8 text-lg">Enter your API endpoint details to get started</p>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-white">🌐 API Endpoint</h3>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent shadow-lg"
                      placeholder="https://api.example.com/v1/resources"
                    />

                    <h3 className="text-lg font-semibold mb-4 mt-6 text-white">📝 Sample Data Structure</h3>
                    <textarea
                      value={sampleData}
                      onChange={(e) => setSampleData(e.target.value)}
                      className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm shadow-lg"
                      rows={10}
                    />
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-white">⚙️ Configuration</h3>
                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2 text-gray-300">Request Timeout (seconds)</label>
                      <input
                        type="range"
                        min="5"
                        max="60"
                        step="5"
                        value={timeout}
                        onChange={(e) => setTimeout(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="text-right text-sm text-purple-300 font-semibold">{timeout}s</div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 backdrop-blur-sm rounded-xl p-4 mt-6 shadow-lg">
                      <h4 className="font-semibold mb-2 text-white">📌 Quick Tips</h4>
                      <ul className="text-sm space-y-1 text-gray-200">
                        <li>✨ Enter your API's base URL</li>
                        <li>✨ Provide sample JSON data</li>
                        <li>✨ Adjust timeout for slow APIs</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => apiUrl && handleStepChange(2)}
                  disabled={!apiUrl}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  ➡️ Next: Authentication
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Authentication */}
          {currentStep === 2 && (
            <div>
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                🔒 Step 2: Authentication Setup
              </h1>
              <p className="text-gray-300 mb-8 text-lg">Configure authentication if your API requires it</p>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2 text-gray-300">Authentication Type</label>
                  <select
                    value={authType}
                    onChange={(e) => {
                      setAuthType(e.target.value);
                      setAuthConfig({ type: e.target.value });
                    }}
                    className="w-full p-3 bg-white/10 border border-purple-400/30 text-white rounded-xl focus:ring-2 focus:ring-purple-500 shadow-lg"
                  >
                    <option value="none" className="bg-slate-800">🚫 No Authentication</option>
                    <option value="bearer" className="bg-slate-800">🔑 Bearer Token (JWT)</option>
                    <option value="api_key" className="bg-slate-800">🗝️ API Key</option>
                    <option value="basic" className="bg-slate-800">👤 Basic Auth</option>
                  </select>
                </div>

                {authType === 'bearer' && (
                  <div>
                    <label className="block text-sm font-medium mb-2 text-gray-300">Bearer Token</label>
                    <input
                      type="password"
                      onChange={(e) => setAuthConfig({ type: 'bearer', token: e.target.value })}
                      className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-lg"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    />
                  </div>
                )}

                {authType === 'api_key' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Header Name</label>
                      <input
                        type="text"
                        defaultValue="X-API-Key"
                        onChange={(e) => setAuthConfig(prev => ({ ...prev, key_name: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">API Key</label>
                      <input
                        type="password"
                        onChange={(e) => setAuthConfig(prev => ({ ...prev, api_key: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-lg"
                      />
                    </div>
                  </div>
                )}

                {authType === 'basic' && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Username</label>
                      <input
                        type="text"
                        onChange={(e) => setAuthConfig(prev => ({ ...prev, username: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2 text-gray-300">Password</label>
                      <input
                        type="password"
                        onChange={(e) => setAuthConfig(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full p-3 bg-white/10 border border-purple-400/30 text-white placeholder-gray-400 rounded-xl focus:ring-2 focus:ring-purple-500 shadow-lg"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleStepChange(1)}
                  className="px-8 py-3 bg-white/10 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/20 hover:shadow-lg transition-all shadow-md"
                >
                  ⬅️ Back
                </button>
                <button
                  onClick={() => handleStepChange(3)}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all shadow-lg"
                >
                  ➡️ Next: Generate Tests
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generate Tests with Custom Editor */}
          {currentStep === 3 && (
            <div>
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                ⚙️ Step 3: Generate AI Tests
              </h1>
              <p className="text-gray-300 mb-8 text-lg">Let AI create intelligent test cases for your API</p>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-white">🎯 Test Configuration</h3>
                    <div className="mb-6">
                      <label className="block text-sm font-medium mb-2 text-gray-300">Number of AI Test Cases</label>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        step="10"
                        value={numTests}
                        onChange={(e) => handleConfigChange('numTests', Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="text-right text-sm text-purple-300 font-semibold">{numTests} tests</div>
                    </div>

                    <h3 className="text-lg font-semibold mb-4 text-white">📋 Test Categories</h3>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-gray-200 cursor-pointer hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={testTypes.happy_path}
                          onChange={(e) => handleConfigChange('testTypes', { ...testTypes, happy_path: e.target.checked })}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span>✅ Happy Path Tests</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-200 cursor-pointer hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={testTypes.edge_cases}
                          onChange={(e) => handleConfigChange('testTypes', { ...testTypes, edge_cases: e.target.checked })}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span>⚠️ Edge Cases</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-200 cursor-pointer hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={testTypes.negative_tests}
                          onChange={(e) => handleConfigChange('testTypes', { ...testTypes, negative_tests: e.target.checked })}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span>❌ Negative Tests</span>
                      </label>
                      <label className="flex items-center gap-2 text-gray-200 cursor-pointer hover:text-white transition-colors">
                        <input
                          type="checkbox"
                          checked={testTypes.security_tests}
                          onChange={(e) => handleConfigChange('testTypes', { ...testTypes, security_tests: e.target.checked })}
                          className="w-4 h-4 accent-purple-500"
                        />
                        <span>🔒 Security Tests</span>
                      </label>
                    </div>
                  </div>

                  <div>
                    <div className="bg-gradient-to-br from-purple-600 via-pink-600 to-blue-600 text-white rounded-xl p-6 text-center mb-6 shadow-2xl border border-purple-400/30">
                      <div className="text-5xl font-bold mb-2">{numTests + customTests.length}</div>
                      <div className="text-sm opacity-90">Total Tests ({numTests} AI + {customTests.length} Custom)</div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 backdrop-blur-sm rounded-xl p-4 shadow-lg">
                      <p className="text-sm text-gray-200"><strong className="text-white">API:</strong> {apiUrl.substring(0, 40)}...</p>
                      <p className="text-sm mt-2 text-gray-200"><strong className="text-white">Auth:</strong> {authConfig.type}</p>
                      <p className="text-sm mt-2 text-gray-200"><strong className="text-white">Timeout:</strong> {timeout}s</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Test Editor Section */}
              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white">✏️ Custom Test Cases ({customTests.length})</h3>
                  <button
                    onClick={() => {
                      setShowCustomEditor(!showCustomEditor);
                      if (showCustomEditor) {
                        setEditingTest(null);
                        setCustomTestForm({
                          method: 'GET',
                          endpoint: '',
                          description: '',
                          data: '',
                          params: '',
                          expected_status: 200,
                          category: 'custom'
                        });
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all"
                  >
                    {showCustomEditor ? (
                      <>
                        <X size={18} />
                        <span>Cancel</span>
                      </>
                    ) : (
                      <>
                        <Plus size={18} />
                        <span>Add Custom Test</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Custom Test Form */}
                {showCustomEditor && (
                  <div className="bg-gradient-to-br from-gray-50 to-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-4">
                    <h4 className="font-semibold text-lg mb-4">{editingTest !== null ? '✏️ Edit Test' : '➕ New Custom Test'}</h4>

                    {/* Natural Language Input */}
                    {editingTest === null && (
                      <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-4 mb-6">
                        <div className="flex items-start gap-2 mb-2">
                          <span className="text-2xl">🤖</span>
                          <div className="flex-1">
                            <h5 className="font-semibold text-purple-800 mb-1">Quick: Describe in Plain English</h5>
                            <p className="text-xs text-gray-600 mb-3">Let AI fill the form for you! Just describe what you want to test.</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={nlTestInput}
                            onChange={(e) => setNlTestInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleGenerateFromNL()}
                            className="flex-1 p-3 border-2 border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm"
                            placeholder='Example: "Test user login with invalid password should return 401"'
                            disabled={nlGenerating}
                          />
                          <button
                            onClick={handleGenerateFromNL}
                            disabled={nlGenerating || !nlTestInput.trim()}
                            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {nlGenerating ? (
                              <>
                                <Loader className="animate-spin" size={18} />
                                <span>Generating...</span>
                              </>
                            ) : (
                              <>
                                <span>✨ Generate</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="text-center text-sm text-gray-500 mb-4">
                      {editingTest === null ? '─── OR Fill Manually ───' : ''}
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">HTTP Method *</label>
                        <select
                          value={customTestForm.method}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, method: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="GET">GET</option>
                          <option value="POST">POST</option>
                          <option value="PUT">PUT</option>
                          <option value="PATCH">PATCH</option>
                          <option value="DELETE">DELETE</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Expected Status Code *</label>
                        <input
                          type="number"
                          value={customTestForm.expected_status}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, expected_status: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          placeholder="200"
                        />
                      </div>
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Endpoint (relative path)</label>
                      <input
                        type="text"
                        value={customTestForm.endpoint}
                        onChange={(e) => setCustomTestForm(prev => ({ ...prev, endpoint: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="/users/123 or leave empty for base URL"
                      />
                    </div>

                    <div className="mb-4">
                      <label className="block text-sm font-medium mb-2">Description *</label>
                      <input
                        type="text"
                        value={customTestForm.description}
                        onChange={(e) => setCustomTestForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe what this test does"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Request Body (JSON, optional)</label>
                        <textarea
                          value={customTestForm.data}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, data: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                          rows={4}
                          placeholder='{"key": "value"}'
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Query Parameters (JSON, optional)</label>
                        <textarea
                          value={customTestForm.params}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, params: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500"
                          rows={4}
                          placeholder='{"page": 1, "limit": 10}'
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCustomTest}
                        className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-semibold"
                      >
                        {editingTest !== null ? '💾 Update Test' : '➕ Add Test'}
                      </button>
                      <button
                        onClick={() => {
                          setShowCustomEditor(false);
                          setEditingTest(null);
                          setCustomTestForm({
                            method: 'GET',
                            endpoint: '',
                            description: '',
                            data: '',
                            params: '',
                            expected_status: 200,
                            category: 'custom'
                          });
                        }}
                        className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-all font-semibold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Custom Tests */}
                {customTests.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {customTests.map((test, index) => (
                      <div key={index} className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 flex items-start justify-between hover:shadow-md transition-all">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold">{test.method}</span>
                            <span className="font-semibold text-gray-800">{test.description}</span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <div><strong>Endpoint:</strong> {test.endpoint || '/'}</div>
                            <div><strong>Expected Status:</strong> {test.expected_status}</div>
                            {test.data && <div><strong>Has Body:</strong> Yes</div>}
                            {test.params && <div><strong>Has Params:</strong> Yes</div>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditCustomTest(index)}
                            className="flex items-center gap-1 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm transition-all"
                          >
                            <Edit size={16} />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteCustomTest(index)}
                            className="flex items-center gap-1 px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm transition-all"
                          >
                            <Trash2 size={16} />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                    <div className="text-6xl mb-4">📝</div>
                    <p className="text-gray-600 font-medium mb-2">No custom tests added yet.</p>
                    <p className="text-sm text-gray-500">Click "Add Custom Test" to create your own test cases.</p>
                  </div>
                )}
              </div>

              {statusMessage && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-center">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader className="animate-spin" size={20} />
                      <span>{statusMessage}</span>
                    </div>
                  ) : (
                    <span>{statusMessage}</span>
                  )}
                </div>
              )}

              {/* Test Preview Section */}
              {showTestPreview && generatedTests.length > 0 && (
                <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border-2 border-purple-200">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-purple-600">🔍 Preview Generated Tests</h3>
                      <p className="text-gray-600 text-sm mt-1">
                        Review, select, and customize tests before running. Uncheck tests you don't want to run.
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-purple-600">{selectedTests.length}</div>
                      <div className="text-sm text-gray-600">Selected</div>
                    </div>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {Object.entries(getCategoryStats()).map(([category, count]) => (
                      <button
                        key={category}
                        onClick={() => setPreviewFilter(category)}
                        className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                          previewFilter === category
                            ? 'bg-purple-600 text-white'
                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                        }`}
                      >
                        {category === 'all' && `🌐 All (${count})`}
                        {category === 'happy_path' && `✅ Happy Path (${count})`}
                        {category === 'edge_case' && `⚠️ Edge Cases (${count})`}
                        {category === 'negative_test' && `❌ Negative (${count})`}
                        {category === 'security_test' && `🔒 Security (${count})`}
                        {category === 'other' && `📋 Other (${count})`}
                      </button>
                    ))}
                  </div>

                  {/* Select All / Deselect All */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={handleSelectAll}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-semibold"
                    >
                      ✓ Select All ({getFilteredTests().length})
                    </button>
                    <button
                      onClick={handleDeselectAll}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-semibold"
                    >
                      ✗ Deselect All
                    </button>
                  </div>

                  {/* Test List */}
                  <div className="max-h-96 overflow-y-auto space-y-2 border border-gray-200 rounded-lg p-4 bg-gray-50">
                    {getFilteredTests().map((test, idx) => {
                      const isSelected = selectedTests.includes(test.originalIndex);
                      return (
                        <div
                          key={test.originalIndex}
                          className={`p-4 rounded-lg border-2 transition-all ${
                            isSelected
                              ? 'bg-white border-purple-300 shadow-sm'
                              : 'bg-gray-100 border-gray-300 opacity-60'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTest(test.originalIndex)}
                              className="mt-1 w-5 h-5 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                                  test.method === 'GET' ? 'bg-blue-500' :
                                  test.method === 'POST' ? 'bg-green-500' :
                                  test.method === 'PUT' ? 'bg-orange-500' :
                                  test.method === 'DELETE' ? 'bg-red-500' :
                                  'bg-purple-500'
                                }`}>
                                  {test.method}
                                </span>
                                <span className="font-semibold text-gray-800">{test.description}</span>
                                <span className={`ml-auto px-2 py-1 rounded text-xs font-semibold ${
                                  test.category === 'happy_path' ? 'bg-green-100 text-green-700' :
                                  test.category === 'edge_case' ? 'bg-yellow-100 text-yellow-700' :
                                  test.category === 'negative_test' ? 'bg-red-100 text-red-700' :
                                  test.category === 'security_test' ? 'bg-purple-100 text-purple-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {test.category?.replace('_', ' ') || 'other'}
                                </span>
                              </div>
                              <div className="text-sm text-gray-600 space-y-1">
                                <div><strong>Endpoint:</strong> {apiUrl}{test.endpoint || ''}</div>
                                <div><strong>Expected Status:</strong> {test.expected_status}</div>
                                {test.data && (
                                  <div>
                                    <strong>Request Body:</strong>
                                    <pre className="bg-gray-800 text-green-400 p-2 rounded mt-1 text-xs overflow-x-auto">
                                      {JSON.stringify(test.data, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {test.params && (
                                  <div>
                                    <strong>Query Params:</strong>
                                    <code className="bg-gray-200 px-2 py-1 rounded text-xs ml-2">
                                      {JSON.stringify(test.params)}
                                    </code>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary and Proceed */}
                  <div className="mt-6 bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg p-6">
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{selectedTests.length}</div>
                        <div className="text-sm text-gray-600">AI Tests Selected</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{customTests.length}</div>
                        <div className="text-sm text-gray-600">Custom Tests</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{selectedTests.length + customTests.length}</div>
                        <div className="text-sm text-gray-600">Total to Run</div>
                      </div>
                    </div>
                    <button
                      onClick={handleProceedWithTests}
                      disabled={selectedTests.length === 0 && customTests.length === 0}
                      className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-bold text-lg hover:shadow-lg transform hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      ✅ Proceed with Selected Tests ({selectedTests.length + customTests.length} total)
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleStepChange(2)}
                  className="px-8 py-3 bg-white/10 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/20 hover:shadow-lg transition-all shadow-md"
                  disabled={loading}
                >
                  ⬅️ Back
                </button>
                {!showTestPreview && (
                  <button
                    onClick={handleGenerateTests}
                    disabled={loading}
                    className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all disabled:opacity-50 shadow-lg"
                  >
                    {loading ? '⏳ Generating...' : '🚀 Generate Tests'}
                  </button>
                )}
                {showTestPreview && (
                  <button
                    onClick={() => {
                      setShowTestPreview(false);
                      setGeneratedTests([]);
                      setSelectedTests([]);
                      setStatusMessage('');
                    }}
                    className="px-8 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-orange-500/50 transform hover:scale-105 transition-all shadow-lg"
                  >
                    🔄 Regenerate Tests
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Run Tests */}
          {currentStep === 4 && (
            <div>
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                ▶️ Step 4: Run Tests
              </h1>
              <p className="text-gray-300 mb-8 text-lg">Execute your test suite and view real-time results</p>

              <div className="grid grid-cols-3 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-xl p-6 text-center shadow-2xl border border-blue-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testCases.length}</div>
                  <div className="text-sm opacity-90">Total Tests</div>
                </div>
                <div className="bg-gradient-to-br from-green-600 to-emerald-500 text-white rounded-xl p-6 text-center shadow-2xl border border-green-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testCases.filter(tc => tc.category !== 'custom').length}</div>
                  <div className="text-sm opacity-90">AI Generated</div>
                </div>
                <div className="bg-gradient-to-br from-orange-600 to-amber-500 text-white rounded-xl p-6 text-center shadow-2xl border border-orange-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testCases.filter(tc => tc.category === 'custom').length}</div>
                  <div className="text-sm opacity-90">Custom Tests</div>
                </div>
              </div>

              {statusMessage && (
                <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-blue-400/30 backdrop-blur-sm rounded-xl p-4 mb-6 text-center shadow-lg">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-white">
                      <Loader className="animate-spin" size={20} />
                      <span>{statusMessage}</span>
                    </div>
                  ) : (
                    <span className="text-white">{statusMessage}</span>
                  )}
                </div>
              )}

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleStepChange(3)}
                  className="px-8 py-3 bg-white/10 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/20 hover:shadow-lg transition-all shadow-md"
                  disabled={loading}
                >
                  ⬅️ Back
                </button>
                <button
                  onClick={handleRunTests}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all disabled:opacity-50 shadow-lg"
                >
                  {loading ? '⏳ Running...' : '▶️ Run All Tests'}
                </button>
              </div>
            </div>
          )}

          {/* Step 5: Results */}
          {currentStep === 5 && testResults && (
            <div>
              <h1 className="text-5xl font-bold mb-3 bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent drop-shadow-lg">
                📊 Step 5: Results & Reports
              </h1>
              <p className="text-gray-300 mb-8 text-lg">View detailed results and download reports</p>

              <div className="grid grid-cols-4 gap-6 mb-6">
                <div className="bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-xl p-6 text-center shadow-2xl border border-blue-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testResults.summary.total}</div>
                  <div className="text-sm opacity-90">Total Tests</div>
                </div>
                <div className="bg-gradient-to-br from-green-600 to-emerald-500 text-white rounded-xl p-6 text-center shadow-2xl border border-green-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testResults.summary.passed}</div>
                  <div className="text-sm opacity-90">Passed</div>
                </div>
                <div className="bg-gradient-to-br from-red-600 to-rose-500 text-white rounded-xl p-6 text-center shadow-2xl border border-red-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testResults.summary.failed}</div>
                  <div className="text-sm opacity-90">Failed</div>
                </div>
                <div className="bg-gradient-to-br from-purple-600 to-pink-500 text-white rounded-xl p-6 text-center shadow-2xl border border-purple-400/30 hover:scale-105 transition-transform">
                  <div className="text-4xl font-bold mb-2">{testResults.summary.pass_rate.toFixed(1)}%</div>
                  <div className="text-sm opacity-90">Pass Rate</div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <h3 className="text-xl font-semibold mb-4 text-white">📋 Test Results</h3>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {testResults.results.map((result, idx) => (
                    <TestResultItem
                      key={idx}
                      result={result}
                      idx={idx}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <h3 className="text-xl font-semibold mb-4 text-white">📥 Download Reports</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleDownloadReport('json')}
                    className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:shadow-xl hover:shadow-blue-500/50 transition-all transform hover:scale-105 shadow-lg"
                  >
                    <FileJson size={20} />
                    <span>Download JSON Report</span>
                  </button>
                  <button
                    onClick={() => handleDownloadReport('pdf')}
                    className="flex items-center justify-center gap-2 p-4 bg-gradient-to-r from-red-600 to-rose-600 text-white rounded-xl hover:shadow-xl hover:shadow-red-500/50 transition-all transform hover:scale-105 shadow-lg"
                  >
                    <FileText size={20} />
                    <span>Download PDF Report</span>
                  </button>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 mb-6 border border-white/20">
                <h3 className="text-xl font-semibold mb-4 flex items-center gap-2 text-white">
                  <Github size={20} />
                  Save to GitHub
                </h3>
                <button
                  onClick={() => setShowGitHub(true)}
                  className="w-full py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-xl hover:shadow-xl hover:shadow-gray-800/50 transition-all transform hover:scale-105 flex items-center justify-center gap-2 shadow-lg"
                >
                  <Github size={20} />
                  Save Results to GitHub Repository
                </button>
              </div>

              <div className="flex justify-center gap-4">
                <button
                  onClick={() => handleStepChange(4)}
                  className="px-8 py-3 bg-gradient-to-r from-orange-600 to-amber-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-orange-500/50 transform hover:scale-105 transition-all shadow-lg"
                >
                  🔄 Run Tests Again
                </button>
                <button
                  onClick={() => {
                    handleStepChange(1);
                    setTestCases([]);
                    setTestResults(null);
                    setGeneratedTests([]);
                    setSelectedTests([]);
                    setCustomTests([]);
                    setShowTestPreview(false);
                  }}
                  className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-xl hover:shadow-purple-500/50 transform hover:scale-105 transition-all shadow-lg"
                >
                  🆕 New Test Suite
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
      {/* Profile Modal */}
      {showProfile && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onUpdate={(updatedUser) => {
            localStorage.setItem('user', JSON.stringify(updatedUser));
          }}
          onLogout={onLogout}
        />
      )}

      {/* GitHub Integration Modal */}
      {showGitHub && (
        <GitHubIntegration
          user={user}
          testResults={testResults}
          apiUrl={apiUrl}
          onClose={() => setShowGitHub(false)}
        />
      )}
    </div>
  );
}
export default App;