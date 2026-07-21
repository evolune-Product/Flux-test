import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Check, Settings, Lock, Zap, Play, Download, RefreshCw, FileJson, FileText, Loader, Edit, Trash2, Plus, X, User, Github, Activity, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import BackButton from './BackButton';
import Profile from './Profile.jsx';
import GitHubIntegration from './GitHubIntegration.jsx';
import AIAnalysisPanel from './AIAnalysisPanel.jsx';
import { saveTestRun } from './testHistoryUtils.js';
import RecentRuns from './RecentRuns.jsx';

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
    <div className={`p-3 rounded-xl border-l-2 ${
      result.status === 'PASS' ? 'bg-green-500/5 border-green-500' : 'bg-red-500/5 border-red-500'
    }`}>
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
          result.status === 'PASS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>{result.status}</span>
        <span className="text-sm text-white font-medium">{result.test}</span>
      </div>
      <div className="text-xs text-slate-400 mt-1">{result.details}</div>
      <div className="text-xs text-slate-600 mt-0.5">🕐 {result.timestamp}</div>
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
  const [httpMethod, setHttpMethod] = useState('GET');
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

  // Highest step the user is allowed to navigate to, based on what they've actually completed.
  // Step 1 → need a URL. Step 2 (auth) is optional so URL unlocks step 3 too.
  // Step 4 → need confirmed test cases. Step 5 → need test results.
  const maxAllowedStep = testResults !== null ? 5
    : testCases.length > 0                    ? 4
    : apiUrl.trim().length > 0                ? 3
    : 1;

  // Warn user before leaving if there's unsaved data
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      // Only warn if there are generated tests or results
      if (generatedTests.length > 0 || testResults) {
        e.preventDefault();
        e.returnValue = 'You have unsaved test data. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [generatedTests, testResults]);

  // Load saved state from localStorage on mount
  useEffect(() => {
    // First check for discovery data (from Auto-Discovery navigation)
    const discoveryDataStr = localStorage.getItem('discoveryData');
    if (discoveryDataStr) {
      try {
        const discoveryData = JSON.parse(discoveryDataStr);
        if (discoveryData.targetUrl) {
          setApiUrl(discoveryData.targetUrl);
          setStatusMessage(`Loaded API URL from Auto-Discovery: ${discoveryData.targetUrl}`);
          // Clear the discovery data after loading
          localStorage.removeItem('discoveryData');
          return; // Don't load saved state if we got discovery data
        }
      } catch (e) {
        console.error('Failed to parse discovery data:', e);
      }
    }

    // Clear any saved state on page load - data should not persist after refresh
    localStorage.removeItem('functionalTestingState');
  }, []);

  // Auto-save disabled - data clears on refresh (user is warned via beforeunload)

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
    // Block forward navigation beyond what the user has actually completed
    if (stepNumber > maxAllowedStep) return;

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
          http_method: httpMethod,
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

  const handleLoadLibrary = async (bundle = 'essentials') => {
    // Third test-source approach: built-in offline library (no API cost)
    setShowTestPreview(false);
    setGeneratedTests([]);
    setSelectedTests([]);
    setLoading(true);
    setStatusMessage('Loading built-in test library...');
    try {
      let sampleJson = {};
      try { sampleJson = JSON.parse(sampleData); } catch { sampleJson = {}; }
      const response = await fetch(`${API_BASE_URL}/library/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ api_url: apiUrl, sample_data: sampleJson, bundle }),
      });
      if (!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if (data.test_cases) {
        setGeneratedTests(data.test_cases);
        setSelectedTests(data.test_cases.map((_, idx) => idx));
        setShowTestPreview(true);
        setStatusMessage(`✅ Loaded ${data.test_cases.length} built-in tests — no API cost. Review below.`);
      } else {
        setStatusMessage('❌ Failed to load library');
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
    const knownCategories = ['happy_path', 'edge_case', 'negative_test', 'security_test', 'fuzz_test', 'other'];
    const stats = {
      all: generatedTests.length,
      happy_path: 0,
      edge_case: 0,
      negative_test: 0,
      security_test: 0,
      fuzz_test: 0,
      other: 0
    };

    generatedTests.forEach(test => {
      const cat = test.category || 'other';
      if (knownCategories.includes(cat)) {
        stats[cat] = stats[cat] + 1;
      } else {
        stats.other = stats.other + 1;
      }
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
        body: JSON.stringify({
          base_url: apiUrl,
          http_method: httpMethod,
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
        // Save run to history (fire-and-forget)
        const passedCount = data.results.filter(r => r.status === 'PASS').length;
        saveTestRun({
          module: 'functional',
          apiUrl: apiUrl,
          totalTests: data.results.length,
          passed: passedCount,
          failed: data.results.length - passedCount,
          overallStatus: passedCount === data.results.length ? 'PASS' : 'FAIL'
        });
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* ── Top Navigation Bar ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 h-14 bg-slate-900/80 backdrop-blur-xl border-b border-white/10 flex items-center px-6 gap-4">

        {/* Brand + Back */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-sm font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">🚀 Flasqo</span>
          <BackButton />
        </div>

        {/* Step stepper */}
        <div className="flex-1 flex items-center justify-center gap-0.5">
          {steps.map((step, idx) => {
            const isActive   = currentStep === step.num;
            const isComplete = step.num < currentStep && step.num <= maxAllowedStep;
            const isLocked   = step.num > maxAllowedStep;
            return (
              <React.Fragment key={step.num}>
                <button
                  onClick={() => handleStepChange(step.num)}
                  disabled={isLocked}
                  title={step.desc}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isLocked   ? 'text-slate-600 cursor-not-allowed' :
                    isActive   ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' :
                    isComplete ? 'text-green-400 hover:bg-green-500/10' :
                                 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    isLocked   ? 'bg-white/5 text-slate-600' :
                    isActive   ? 'bg-white/20 text-white' :
                    isComplete ? 'bg-green-500/20 text-green-400' :
                                 'bg-white/10 text-slate-300'
                  }`}>
                    {isComplete ? <Check size={10} /> : isLocked ? <Lock size={9} /> : <span className="text-[10px] font-bold">{step.num}</span>}
                  </span>
                  <span className="hidden sm:inline">{step.title}</span>
                </button>
                {idx < steps.length - 1 && (
                  <div className={`w-5 h-px flex-shrink-0 transition-all ${step.num < maxAllowedStep ? 'bg-purple-500/50' : 'bg-white/10'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Progress + user avatar */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="hidden md:flex items-center gap-2">
            <div className="w-16 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${((maxAllowedStep - 1) / 4) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-400">{Math.round(((maxAllowedStep - 1) / 4) * 100)}%</span>
          </div>
          {user && (
            <button
              onClick={() => setShowProfile(true)}
              title={`${user.username} — click to view profile`}
              className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-sm font-bold hover:scale-110 transition-transform shadow-md"
            >
              {user.username.charAt(0).toUpperCase()}
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ───────────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">

          {/* Step 1: Configure API */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Configure Your API</h1>
                <p className="text-sm text-slate-400 mt-1">Enter your API endpoint details to get started</p>
              </div>

              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-5">
                {/* Method + URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">API Endpoint</label>
                  <div className="flex gap-1.5 mb-3 flex-wrap">
                    {['GET','POST','PUT','PATCH','DELETE','OPTIONS'].map(m => {
                      const colors = {
                        GET:     'bg-green-500/80  border-green-400/60  text-white',
                        POST:    'bg-blue-500/80   border-blue-400/60   text-white',
                        PUT:     'bg-yellow-500/80 border-yellow-400/60 text-white',
                        PATCH:   'bg-orange-500/80 border-orange-400/60 text-white',
                        DELETE:  'bg-red-500/80    border-red-400/60    text-white',
                        OPTIONS: 'bg-purple-500/80 border-purple-400/60 text-white',
                      };
                      const inactive = 'bg-white/5 border-white/15 text-slate-400 hover:bg-white/10 hover:text-white';
                      return (
                        <button
                          key={m}
                          onClick={() => setHttpMethod(m)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${httpMethod === m ? colors[m] : inactive}`}
                        >
                          {m}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-bold border ${
                      {GET:'bg-green-500/80 border-green-400/60',POST:'bg-blue-500/80 border-blue-400/60',PUT:'bg-yellow-500/80 border-yellow-400/60',PATCH:'bg-orange-500/80 border-orange-400/60',DELETE:'bg-red-500/80 border-red-400/60',OPTIONS:'bg-purple-500/80 border-purple-400/60'}[httpMethod]
                    } text-white`}>
                      {httpMethod}
                    </span>
                    <input
                      type="text"
                      value={apiUrl}
                      onChange={(e) => setApiUrl(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 focus:border-purple-500/60 transition-colors text-sm"
                      placeholder="https://api.example.com/v1/resources"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Sample Data — wider column */}
                  <div className="lg:col-span-2">
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Sample Request Body (JSON)</label>
                    <textarea
                      value={sampleData}
                      onChange={(e) => setSampleData(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 focus:border-purple-500/60 transition-colors font-mono text-sm resize-none"
                      rows={10}
                    />
                  </div>
                  {/* Config */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                        Request Timeout — <span className="text-purple-400 font-bold">{timeout}s</span>
                      </label>
                      <input
                        type="range" min="5" max="60" step="5"
                        value={timeout}
                        onChange={(e) => setTimeout(Number(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                      <div className="flex justify-between text-xs text-slate-600 mt-1"><span>5s</span><span>60s</span></div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Quick Tips</p>
                      <p className="text-xs text-slate-400">Enter your API's base URL with HTTP method</p>
                      <p className="text-xs text-slate-400">Provide sample JSON to guide test generation</p>
                      <p className="text-xs text-slate-400">Increase timeout for slow external APIs</p>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4 space-y-2">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Current Config</p>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Method</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          {GET:'bg-green-500/20 text-green-400',POST:'bg-blue-500/20 text-blue-400',PUT:'bg-yellow-500/20 text-yellow-400',PATCH:'bg-orange-500/20 text-orange-400',DELETE:'bg-red-500/20 text-red-400',OPTIONS:'bg-purple-500/20 text-purple-400'}[httpMethod]
                        }`}>{httpMethod}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Timeout</span>
                        <span className="text-purple-400 font-semibold">{timeout}s</span>
                      </div>
                      <div className="text-xs text-slate-500 truncate" title={apiUrl}>
                        {apiUrl ? <span className="text-slate-300">{apiUrl.replace(/^https?:\/\//, '').substring(0, 28)}{apiUrl.length > 35 ? '…' : ''}</span> : <span className="italic">no URL yet</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => apiUrl && handleStepChange(2)}
                  disabled={!apiUrl}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next: Authentication →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Authentication */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Authentication Setup</h1>
                <p className="text-sm text-slate-400 mt-1">Configure authentication if your API requires it</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: auth config — takes 2 cols */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Authentication Type</label>
                    <select
                      value={authType}
                      onChange={(e) => { setAuthType(e.target.value); setAuthConfig({ type: e.target.value }); }}
                      className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 focus:border-purple-500/60 transition-colors text-sm"
                    >
                      <option value="none"    className="bg-slate-800">No Authentication</option>
                      <option value="bearer"  className="bg-slate-800">Bearer Token (JWT)</option>
                      <option value="api_key" className="bg-slate-800">API Key</option>
                      <option value="basic"   className="bg-slate-800">Basic Auth</option>
                    </select>
                  </div>

                  {authType === 'none' && (
                    <div className="bg-slate-900/40 border border-slate-700/30 rounded-xl p-4">
                      <p className="text-xs text-slate-400">Tests will run without any authentication headers. Most public APIs work this way.</p>
                    </div>
                  )}

                  {authType === 'bearer' && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Bearer Token</label>
                      <input
                        type="password"
                        onChange={(e) => setAuthConfig({ type: 'bearer', token: e.target.value })}
                        className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 transition-colors text-sm"
                        placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      />
                      <p className="text-xs text-slate-600 mt-1.5">Sent as <code className="text-slate-400">Authorization: Bearer &lt;token&gt;</code></p>
                    </div>
                  )}

                  {authType === 'api_key' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Header Name</label>
                        <input
                          type="text"
                          defaultValue="X-API-Key"
                          onChange={(e) => setAuthConfig(prev => ({ ...prev, key_name: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">API Key Value</label>
                        <input
                          type="password"
                          onChange={(e) => setAuthConfig(prev => ({ ...prev, api_key: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 text-sm"
                          placeholder="your-api-key"
                        />
                      </div>
                    </div>
                  )}

                  {authType === 'basic' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Username</label>
                        <input
                          type="text"
                          onChange={(e) => setAuthConfig(prev => ({ ...prev, username: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 text-sm"
                          placeholder="username"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Password</label>
                        <input
                          type="password"
                          onChange={(e) => setAuthConfig(prev => ({ ...prev, password: e.target.value }))}
                          className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl focus:outline-none focus:ring-1 focus:ring-purple-500/70 text-sm"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: info panel */}
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">API Summary</p>
                    <div className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Endpoint</span>
                        <span className="text-slate-300 truncate ml-2 max-w-[140px]" title={apiUrl}>{apiUrl.replace(/^https?:\/\//, '').substring(0, 22)}{apiUrl.length > 28 ? '…' : ''}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Method</span>
                        <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                          {GET:'bg-green-500/20 text-green-400',POST:'bg-blue-500/20 text-blue-400',PUT:'bg-yellow-500/20 text-yellow-400',PATCH:'bg-orange-500/20 text-orange-400',DELETE:'bg-red-500/20 text-red-400',OPTIONS:'bg-purple-500/20 text-purple-400'}[httpMethod]
                        }`}>{httpMethod}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Timeout</span>
                        <span className="text-purple-400">{timeout}s</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Auth</span>
                        <span className={`font-semibold ${authType === 'none' ? 'text-slate-500' : 'text-green-400'}`}>
                          {authType === 'none' ? 'None' : authType === 'bearer' ? 'Bearer JWT' : authType === 'api_key' ? 'API Key' : 'Basic'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 space-y-2">
                    <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Auth Guide</p>
                    <p className="text-xs text-slate-400"><span className="text-slate-300 font-medium">Bearer</span> — JWTs, OAuth tokens</p>
                    <p className="text-xs text-slate-400"><span className="text-slate-300 font-medium">API Key</span> — custom header (e.g. X-API-Key)</p>
                    <p className="text-xs text-slate-400"><span className="text-slate-300 font-medium">Basic</span> — username + password</p>
                    <p className="text-xs text-slate-400"><span className="text-slate-300 font-medium">None</span> — public APIs</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => handleStepChange(1)}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-sm font-semibold transition-all"
                >
                  ← Back
                </button>
                <button
                  onClick={() => handleStepChange(3)}
                  className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
                >
                  Next: Generate Tests →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Generate Tests with Custom Editor */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Build Your Test Suite</h1>
                <p className="text-sm text-slate-400 mt-1">Three ways to add tests — combine any of them:</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <span className="px-2.5 py-1 rounded-lg bg-green-900/30 border border-green-600/30 text-xs text-green-300">✍️ Manual — add custom tests below</span>
                  <span className="px-2.5 py-1 rounded-lg bg-purple-900/30 border border-purple-600/30 text-xs text-purple-300">🤖 AI — generate from your endpoint</span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-900/30 border border-emerald-600/30 text-xs text-emerald-300">📚 Library — built-in, no API cost</span>
                </div>
              </div>

              {/* Built-in library — one-click bundles (no API cost) */}
              <div className="bg-emerald-900/10 border border-emerald-600/30 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-emerald-200">📚 Built-in Test Library</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Hundreds of ready-made functional + OWASP security tests. Runs offline, costs nothing.</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'essentials', label: 'Essentials', desc: 'CRUD + validation + methods' },
                    { id: 'security', label: 'Security (OWASP)', desc: 'SQLi, XSS, injection, auth' },
                    { id: 'full_owasp', label: 'Full Security+', desc: 'security + content types' },
                    { id: 'everything', label: 'Everything', desc: 'all packs (100+)' },
                  ].map(b => (
                    <button key={b.id} onClick={() => handleLoadLibrary(b.id)} disabled={loading}
                      className="px-3 py-2 bg-emerald-700/40 hover:bg-emerald-700/70 border border-emerald-600/40 text-emerald-100 rounded-lg text-xs font-semibold disabled:opacity-40 transition-colors text-left">
                      <div>{b.label}</div>
                      <div className="text-[10px] text-emerald-300/70 font-normal">{b.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Test config — 2 cols */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      AI Test Count — <span className="text-purple-400 font-bold">{numTests}</span>
                    </label>
                    <input
                      type="range" min="10" max="100" step="10"
                      value={numTests}
                      onChange={(e) => handleConfigChange('numTests', Number(e.target.value))}
                      className="w-full accent-purple-500"
                    />
                    <div className="flex justify-between text-xs text-slate-600 mt-1"><span>10</span><span>100</span></div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Test Categories</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { key: 'happy_path',     label: 'Happy Path Tests',  color: 'text-green-400' },
                        { key: 'edge_cases',     label: 'Edge Cases',        color: 'text-yellow-400' },
                        { key: 'negative_tests', label: 'Negative Tests',    color: 'text-red-400' },
                        { key: 'security_tests', label: 'Security Tests',    color: 'text-purple-400' },
                      ].map(({ key, label, color }) => (
                        <label key={key} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${testTypes[key] ? 'bg-slate-900/60 border-slate-600/60' : 'bg-slate-900/20 border-slate-700/30 opacity-60'}`}>
                          <input
                            type="checkbox"
                            checked={testTypes[key]}
                            onChange={(e) => handleConfigChange('testTypes', { ...testTypes, [key]: e.target.checked })}
                            className="w-4 h-4 accent-purple-500 rounded flex-shrink-0"
                          />
                          <span className={`text-sm font-medium ${testTypes[key] ? color : 'text-slate-400'}`}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Summary panel — 1 col */}
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 flex flex-col justify-between">
                  <div className="flex items-center justify-center flex-1 py-6">
                    <div className="text-center">
                      <div className="text-6xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        {numTests + customTests.length}
                      </div>
                      <div className="text-xs text-slate-400 mt-2">Total Tests</div>
                      <div className="flex gap-5 justify-center mt-4 text-xs">
                        <div className="text-center">
                          <div className="text-lg font-bold text-purple-400">{numTests}</div>
                          <div className="text-slate-600">AI</div>
                        </div>
                        <div className="w-px bg-slate-700/60" />
                        <div className="text-center">
                          <div className="text-lg font-bold text-green-400">{customTests.length}</div>
                          <div className="text-slate-600">Custom</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-700/50 pt-4 space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-slate-500">API</span><span className="text-slate-300 truncate ml-2 max-w-[130px]">{apiUrl.replace(/^https?:\/\//, '').substring(0, 22)}{apiUrl.length > 28 ? '…' : ''}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Auth</span><span className="text-slate-300">{authConfig.type}</span></div>
                    <div className="flex justify-between"><span className="text-slate-500">Timeout</span><span className="text-slate-300">{timeout}s</span></div>
                  </div>
                </div>
              </div>

              {/* Custom Test Editor Section */}
              <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-slate-200">Custom Test Cases <span className="text-slate-500 ml-1">({customTests.length})</span></h3>
                  <button
                    onClick={() => {
                      setShowCustomEditor(!showCustomEditor);
                      if (showCustomEditor) {
                        setEditingTest(null);
                        setCustomTestForm({ method: 'GET', endpoint: '', description: '', data: '', params: '', expected_status: 200, category: 'custom' });
                      }
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-xs font-semibold transition-colors"
                  >
                    {showCustomEditor ? <><X size={13}/> Cancel</> : <><Plus size={13}/> Add Custom Test</>}
                  </button>
                </div>

                {/* Custom Test Form */}
                {showCustomEditor && (
                  <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl p-5 mb-4 space-y-4">
                    <h4 className="text-sm font-semibold text-white">{editingTest !== null ? 'Edit Test' : 'New Custom Test'}</h4>

                    {editingTest === null && (
                      <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
                        <p className="text-xs font-semibold text-purple-300 mb-2">Describe in plain English — AI will fill the form</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={nlTestInput}
                            onChange={(e) => setNlTestInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleGenerateFromNL()}
                            className="flex-1 px-3 py-2 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                            placeholder='e.g. "Test login with invalid password returns 401"'
                            disabled={nlGenerating}
                          />
                          <button
                            onClick={handleGenerateFromNL}
                            disabled={nlGenerating || !nlTestInput.trim()}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                          >
                            {nlGenerating ? <><Loader className="animate-spin" size={12}/> Generating...</> : 'Generate'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Method</label>
                        <select
                          value={customTestForm.method}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, method: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                        >
                          {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m} value={m} className="bg-slate-800">{m}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Expected Status</label>
                        <input
                          type="number"
                          value={customTestForm.expected_status}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, expected_status: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 text-white rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                          placeholder="200"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Endpoint (relative)</label>
                      <input
                        type="text"
                        value={customTestForm.endpoint}
                        onChange={(e) => setCustomTestForm(prev => ({ ...prev, endpoint: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                        placeholder="/users/123 or leave empty for base URL"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Description</label>
                      <input
                        type="text"
                        value={customTestForm.description}
                        onChange={(e) => setCustomTestForm(prev => ({ ...prev, description: e.target.value }))}
                        className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                        placeholder="Describe what this test does"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Request Body (JSON)</label>
                        <textarea
                          value={customTestForm.data}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, data: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/70 resize-none"
                          rows={3}
                          placeholder='{"key": "value"}'
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Query Params (JSON)</label>
                        <textarea
                          value={customTestForm.params}
                          onChange={(e) => setCustomTestForm(prev => ({ ...prev, params: e.target.value }))}
                          className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-lg font-mono text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/70 resize-none"
                          rows={3}
                          placeholder='{"page": 1}'
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleAddCustomTest}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors"
                      >
                        {editingTest !== null ? 'Update Test' : 'Add Test'}
                      </button>
                      <button
                        onClick={() => { setShowCustomEditor(false); setEditingTest(null); setCustomTestForm({ method: 'GET', endpoint: '', description: '', data: '', params: '', expected_status: 200, category: 'custom' }); }}
                        className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* List of Custom Tests */}
                {customTests.length > 0 ? (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {customTests.map((test, index) => (
                      <div key={index} className="bg-slate-900/40 border border-slate-700/40 rounded-xl p-3.5 flex items-start gap-3 hover:border-slate-600/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="bg-green-600/80 text-white px-2 py-0.5 rounded text-[10px] font-bold flex-shrink-0">{test.method}</span>
                            <span className="text-sm text-slate-200 font-medium truncate">{test.description}</span>
                          </div>
                          <div className="text-xs text-slate-500">{test.endpoint || '/'} · status {test.expected_status}</div>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0">
                          <button onClick={() => handleEditCustomTest(index)} className="p-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 rounded-lg transition-colors"><Edit size={13}/></button>
                          <button onClick={() => handleDeleteCustomTest(index)} className="p-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-400 rounded-lg transition-colors"><Trash2 size={13}/></button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-slate-600 text-sm">
                    No custom tests yet. Click "Add Custom Test" to create one.
                  </div>
                )}
              </div>

              {statusMessage && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
                  {loading ? (
                    <div className="flex items-center justify-center gap-2 text-slate-300 text-sm">
                      <Loader className="animate-spin" size={16}/> {statusMessage}
                    </div>
                  ) : (
                    <span className="text-slate-300 text-sm">{statusMessage}</span>
                  )}
                </div>
              )}

              {/* Test Preview Section */}
              {showTestPreview && generatedTests.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Preview Generated Tests</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Select tests to include — uncheck any you want to skip.</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-purple-400">{selectedTests.length}</div>
                      <div className="text-xs text-slate-500">selected</div>
                    </div>
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex gap-1.5 flex-wrap">
                    {(() => {
                      const stats = getCategoryStats();
                      const cats = ['all','happy_path','edge_case','negative_test','security_test','fuzz_test','other'];
                      const labels = { all:'All', happy_path:'Happy Path', edge_case:'Edge Cases', negative_test:'Negative', security_test:'Security', fuzz_test:'Fuzz', other:'Other' };
                      return cats
                        .filter(c => c === 'all' || (stats[c] || 0) > 0)
                        .map(c => (
                          <button
                            key={c}
                            onClick={() => setPreviewFilter(c)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${previewFilter === c ? 'bg-purple-600 text-white' : 'bg-slate-700/50 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                          >
                            {labels[c]} ({stats[c] || 0})
                          </button>
                        ));
                    })()}
                  </div>

                  {/* Select/Deselect */}
                  <div className="flex gap-2">
                    <button onClick={handleSelectAll} className="px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-600/30 rounded-lg text-xs font-semibold transition-colors">
                      Select All ({getFilteredTests().length})
                    </button>
                    <button onClick={handleDeselectAll} className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 rounded-lg text-xs font-semibold transition-colors">
                      Deselect All
                    </button>
                  </div>

                  {/* Test list */}
                  <div className="max-h-80 overflow-y-auto space-y-1.5 pr-1">
                    {getFilteredTests().map((test) => {
                      const isSelected = selectedTests.includes(test.originalIndex);
                      return (
                        <div
                          key={test.originalIndex}
                          className={`p-3 rounded-xl border transition-all ${isSelected ? 'bg-slate-900/60 border-slate-600/60' : 'bg-slate-900/20 border-slate-700/30 opacity-50'}`}
                        >
                          <div className="flex items-start gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleTest(test.originalIndex)}
                              className="mt-0.5 w-4 h-4 cursor-pointer accent-purple-500"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                                  test.method === 'GET' ? 'bg-green-600/70' : test.method === 'POST' ? 'bg-blue-600/70' :
                                  test.method === 'PUT' ? 'bg-yellow-600/70' : test.method === 'DELETE' ? 'bg-red-600/70' : 'bg-purple-600/70'
                                }`}>{test.method}</span>
                                <span className="text-xs text-slate-200 font-medium">{test.description}</span>
                                <span className={`ml-auto text-[10px] px-2 py-0.5 rounded font-semibold ${
                                  test.category === 'happy_path' ? 'bg-green-500/15 text-green-400' :
                                  test.category === 'edge_case' ? 'bg-yellow-500/15 text-yellow-400' :
                                  test.category === 'negative_test' ? 'bg-red-500/15 text-red-400' :
                                  test.category === 'security_test' ? 'bg-purple-500/15 text-purple-400' :
                                  'bg-slate-500/15 text-slate-400'
                                }`}>
                                  {test.category?.replace(/_/g, ' ') || 'other'}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">{apiUrl}{test.endpoint || ''} · {test.expected_status}</div>
                              {test.data && (
                                <pre className="bg-slate-950/60 text-green-400 px-2.5 py-1.5 rounded-lg mt-1.5 text-[10px] overflow-x-auto">
                                  {JSON.stringify(test.data, null, 2)}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Summary + Proceed */}
                  <div className="bg-slate-900/50 border border-slate-700/40 rounded-xl p-4">
                    <div className="flex items-center gap-6 mb-3">
                      <div className="text-center">
                        <div className="text-xl font-bold text-purple-400">{selectedTests.length}</div>
                        <div className="text-xs text-slate-500">AI Selected</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-green-400">{customTests.length}</div>
                        <div className="text-xs text-slate-500">Custom</div>
                      </div>
                      <div className="text-center">
                        <div className="text-xl font-bold text-blue-400">{selectedTests.length + customTests.length}</div>
                        <div className="text-xs text-slate-500">Total</div>
                      </div>
                    </div>
                    <button
                      onClick={handleProceedWithTests}
                      disabled={selectedTests.length === 0 && customTests.length === 0}
                      className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Proceed with {selectedTests.length + customTests.length} Tests →
                    </button>
                  </div>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => handleStepChange(2)}
                  disabled={loading}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                >
                  ← Back
                </button>
                {!showTestPreview && (
                  <button
                    onClick={handleGenerateTests}
                    disabled={loading}
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-40"
                  >
                    {loading ? <span className="flex items-center gap-2"><Loader className="animate-spin" size={14}/> Generating...</span> : 'Generate Tests →'}
                  </button>
                )}
                {showTestPreview && (
                  <button
                    onClick={() => { setShowTestPreview(false); setGeneratedTests([]); setSelectedTests([]); setStatusMessage(''); }}
                    className="px-5 py-2.5 bg-orange-600/80 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-all"
                  >
                    Regenerate
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Step 4: Run Tests */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Run Tests</h1>
                <p className="text-sm text-slate-400 mt-1">Execute your test suite against the API</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: stats + run button */}
                <div className="space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Test Suite</p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Total Tests</span>
                        <span className="text-2xl font-bold text-white">{testCases.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">AI Generated</span>
                        <span className="text-xl font-bold text-purple-400">{testCases.filter(tc => tc.category !== 'custom').length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">Custom</span>
                        <span className="text-xl font-bold text-green-400">{testCases.filter(tc => tc.category === 'custom').length}</span>
                      </div>
                    </div>
                    <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-green-500 rounded-full"
                        style={{ width: testCases.length > 0 ? `${(testCases.filter(tc => tc.category !== 'custom').length / testCases.length) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-2 text-xs text-slate-400">
                    <p className="font-semibold text-slate-300 text-xs uppercase tracking-wide">Target</p>
                    <p className="text-slate-300 break-all">{apiUrl}</p>
                    <div className="flex gap-2 flex-wrap pt-1">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        {GET:'bg-green-500/20 text-green-400',POST:'bg-blue-500/20 text-blue-400',PUT:'bg-yellow-500/20 text-yellow-400',PATCH:'bg-orange-500/20 text-orange-400',DELETE:'bg-red-500/20 text-red-400',OPTIONS:'bg-purple-500/20 text-purple-400'}[httpMethod]
                      }`}>{httpMethod}</span>
                      <span className="px-2 py-0.5 bg-slate-700/50 rounded text-[10px] text-slate-400">Auth: {authConfig.type}</span>
                      <span className="px-2 py-0.5 bg-slate-700/50 rounded text-[10px] text-slate-400">{timeout}s timeout</span>
                    </div>
                  </div>

                  {statusMessage && (
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-3 text-center">
                      {loading ? (
                        <div className="flex items-center justify-center gap-2 text-slate-300 text-sm">
                          <Loader className="animate-spin" size={16}/> {statusMessage}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm">{statusMessage}</span>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleStepChange(3)}
                      disabled={loading}
                      className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleRunTests}
                      disabled={loading}
                      className="flex-1 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                      {loading ? <><Loader className="animate-spin" size={14}/> Running...</> : 'Run All Tests →'}
                    </button>
                  </div>
                </div>

                {/* Right: test cases preview */}
                <div className="lg:col-span-2 bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Tests Queued ({testCases.length})</p>
                  <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
                    {testCases.map((tc, i) => (
                      <div key={i} className="flex items-center gap-2.5 px-3 py-2 bg-slate-900/40 border border-slate-700/30 rounded-xl hover:border-slate-600/50 transition-colors">
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-bold text-white ${
                          tc.method === 'GET' ? 'bg-green-600/70' : tc.method === 'POST' ? 'bg-blue-600/70' :
                          tc.method === 'PUT' ? 'bg-yellow-600/70' : tc.method === 'DELETE' ? 'bg-red-600/70' : 'bg-purple-600/70'
                        }`}>{tc.method}</span>
                        <span className="text-xs text-slate-300 flex-1 truncate">{tc.description}</span>
                        <span className={`flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded font-medium ${tc.category === 'custom' ? 'bg-green-500/15 text-green-400' : 'bg-purple-500/15 text-purple-400'}`}>
                          {tc.category === 'custom' ? 'custom' : 'ai'}
                        </span>
                      </div>
                    ))}
                    {testCases.length === 0 && (
                      <div className="text-center py-12 text-slate-600 text-sm">No tests loaded</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 5: Results */}
          {currentStep === 5 && testResults && (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Results & Reports</h1>
                <p className="text-sm text-slate-400 mt-1">View detailed results and download reports</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* Left: summary sidebar */}
                <div className="space-y-4">
                  {/* Stat chips */}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-4">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Summary</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-900/50 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-white">{testResults.summary.total}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Total</div>
                      </div>
                      <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-green-400">{testResults.summary.passed}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Passed</div>
                      </div>
                      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                        <div className="text-2xl font-bold text-red-400">{testResults.summary.failed}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Failed</div>
                      </div>
                      <div className={`rounded-xl p-3 text-center border ${testResults.summary.pass_rate === 100 ? 'bg-green-500/10 border-green-500/20' : testResults.summary.pass_rate >= 50 ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                        <div className={`text-2xl font-bold ${testResults.summary.pass_rate === 100 ? 'text-green-400' : testResults.summary.pass_rate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {testResults.summary.pass_rate.toFixed(0)}%
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">Pass Rate</div>
                      </div>
                    </div>
                    {/* Pass rate bar */}
                    <div>
                      <div className="w-full h-2 bg-slate-700/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${testResults.summary.pass_rate === 100 ? 'bg-green-500' : testResults.summary.pass_rate >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${testResults.summary.pass_rate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Downloads */}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 space-y-3">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Download Reports</p>
                    <button
                      onClick={() => handleDownloadReport('json')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <FileJson size={14}/> Download JSON
                    </button>
                    <button
                      onClick={() => handleDownloadReport('pdf')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600/80 hover:bg-red-600 text-white rounded-xl text-xs font-semibold transition-colors"
                    >
                      <FileText size={14}/> Download PDF
                    </button>
                    <button
                      onClick={() => setShowGitHub(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-700/80 hover:bg-slate-700 text-white border border-slate-600/50 rounded-xl text-xs font-semibold transition-colors"
                    >
                      <Github size={14}/> Save to GitHub
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleStepChange(4)}
                      className="w-full py-2.5 bg-orange-600/80 hover:bg-orange-600 text-white rounded-xl text-sm font-semibold transition-colors"
                    >
                      Run Again
                    </button>
                    <button
                      onClick={() => { handleStepChange(1); setTestCases([]); setTestResults(null); setGeneratedTests([]); setSelectedTests([]); setCustomTests([]); setShowTestPreview(false); }}
                      className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl text-sm font-semibold hover:shadow-lg hover:shadow-purple-500/20 transition-all"
                    >
                      New Test Suite
                    </button>
                  </div>
                </div>

                {/* Right: full test results list */}
                <div className="lg:col-span-2 space-y-4">
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                      Test Results <span className="text-slate-600 ml-1 font-normal">({testResults.results.length} tests)</span>
                    </h3>
                    <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
                      {testResults.results.map((result, idx) => (
                        <TestResultItem key={idx} result={result} idx={idx} />
                      ))}
                    </div>
                  </div>

                  {/* Recent Runs */}
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Previous Runs</h3>
                    <RecentRuns module="functional" />
                  </div>
                </div>
              </div>
            </div>
          )}

      </main>
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