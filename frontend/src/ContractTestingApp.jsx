import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  FileText,
  Home,
  ArrowLeft,
  Plus,
  Play,
  Trash2,
  Code,
  AlertTriangle,
  Loader,
  BarChart3,
  History,
  GitBranch,
  Check,
  X,
  Sparkles
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ContractTestingApp = ({ user, onLogout }) => {
  const navigate = useNavigate();

  // State
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);
  const [verificationHistory, setVerificationHistory] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('contracts');
  const [logs, setLogs] = useState([]);

  // Contract form
  const [contractForm, setContractForm] = useState({
    contract_name: '',
    description: '',
    consumer_name: '',
    provider_name: '',
    version: '1.0.0',
    request_method: 'GET',
    request_path: '/api/users/1',
    response_status: 200,
    response_body_schema: '{\n  "type": "object",\n  "properties": {\n    "id": {"type": "integer"},\n    "name": {"type": "string"},\n    "email": {"type": "string"}\n  },\n  "required": ["id", "name", "email"]\n}'
  });

  // Provider verification form
  const [providerForm, setProviderForm] = useState({
    provider_url: '',
    custom_headers: ''
  });

  // AI Assistant state
  const [aiDescription, setAiDescription] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { timestamp, message, type }]);
  };

  // Load saved state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('contractTestingState');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.contractForm) setContractForm(state.contractForm);
        if (state.providerForm) setProviderForm(state.providerForm);
        if (state.verificationResult) setVerificationResult(state.verificationResult);
        if (state.selectedContract) setSelectedContract(state.selectedContract);
      } catch (e) {
        console.error('Failed to load saved Contract Testing state:', e);
      }
    }
    // Fetch contracts from backend
    fetchContracts();
  }, []);

  // Save state to localStorage whenever important data changes
  useEffect(() => {
    const stateToSave = {
      contractForm,
      providerForm,
      verificationResult,
      selectedContract,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('contractTestingState', JSON.stringify(stateToSave));
  }, [contractForm, providerForm, verificationResult, selectedContract]);

  const fetchContracts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/contract/my-contracts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setContracts(data.contracts);
      }
    } catch (error) {
      addLog(`Failed to fetch contracts: ${error.message}`, 'error');
    }
  };

  const createContract = async () => {
    if (!contractForm.contract_name || !contractForm.consumer_name || !contractForm.provider_name) {
      addLog('Please fill in all required fields', 'error');
      return;
    }

    setIsLoading(true);
    addLog('Creating contract...', 'info');

    try {
      const token = localStorage.getItem('token');
      let responseBodySchema;

      try {
        responseBodySchema = JSON.parse(contractForm.response_body_schema);
      } catch (e) {
        addLog('Invalid JSON Schema format', 'error');
        setIsLoading(false);
        return;
      }

      const payload = {
        contract_name: contractForm.contract_name,
        description: contractForm.description || null,
        consumer_name: contractForm.consumer_name,
        provider_name: contractForm.provider_name,
        version: contractForm.version,
        request_method: contractForm.request_method,
        request_path: contractForm.request_path,
        response_status: parseInt(contractForm.response_status),
        response_body_schema: responseBodySchema,
        is_shared: false
      };

      const response = await fetch(`${API_BASE_URL}/contract/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        addLog(`Contract "${data.contract_name}" created successfully!`, 'success');
        setContractForm({
          contract_name: '',
          description: '',
          consumer_name: '',
          provider_name: '',
          version: '1.0.0',
          request_method: 'GET',
          request_path: '/api/users/1',
          response_status: 200,
          response_body_schema: '{\n  "type": "object",\n  "properties": {\n    "id": {"type": "integer"},\n    "name": {"type": "string"},\n    "email": {"type": "string"}\n  },\n  "required": ["id", "name", "email"]\n}'
        });
        await fetchContracts();
        setActiveTab('contracts');
      } else {
        const error = await response.json();
        addLog(`Failed to create contract: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const generateContractWithAI = async () => {
    if (!aiDescription.trim()) {
      addLog('Please describe what contract you want to create', 'error');
      return;
    }

    setAiLoading(true);
    addLog('🤖 AI is generating your contract...', 'info');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/contract/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          description: aiDescription,
          include_request_schema: true,
          include_response_headers: false
        })
      });

      if (response.ok) {
        const data = await response.json();
        const contract = data.contract;

        // Auto-fill the form with AI-generated contract
        setContractForm({
          contract_name: contract.contract_name || '',
          description: contract.description || '',
          consumer_name: contract.consumer_name || '',
          provider_name: contract.provider_name || '',
          version: contract.version || '1.0.0',
          request_method: contract.request_method || 'GET',
          request_path: contract.request_path || '',
          response_status: contract.response_status || 200,
          response_body_schema: JSON.stringify(contract.response_body_schema, null, 2)
        });

        addLog('✅ Contract generated successfully! Review and edit below.', 'success');
        setAiDescription(''); // Clear the description
      } else {
        const error = await response.json();
        addLog(`AI generation failed: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setAiLoading(false);
    }
  };

  const deleteContract = async (contractId) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/contract/${contractId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        addLog('Contract deleted successfully', 'success');
        await fetchContracts();
        if (selectedContract?.contract_id === contractId) {
          setSelectedContract(null);
          setVerificationResult(null);
          setVerificationHistory(null);
        }
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    }
  };

  const verifyProvider = async () => {
    if (!providerForm.provider_url) {
      addLog('Please enter provider URL', 'error');
      return;
    }

    setIsLoading(true);
    setLogs([]);
    addLog('Verifying provider against contract...', 'info');

    try {
      const token = localStorage.getItem('token');
      let customHeaders = null;

      if (providerForm.custom_headers) {
        try {
          customHeaders = JSON.parse(providerForm.custom_headers);
        } catch (e) {
          addLog('Invalid headers JSON', 'error');
          setIsLoading(false);
          return;
        }
      }

      const payload = {
        contract_id: selectedContract.contract_id,
        provider_url: providerForm.provider_url,
        timeout: 10,
        custom_headers: customHeaders
      };

      const response = await fetch(`${API_BASE_URL}/contract/verify-provider`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationResult(data);

        if (data.passed) {
          addLog('✅ Provider verification PASSED!', 'success');
        } else {
          addLog(`❌ Provider verification FAILED! ${data.validation_errors.length} error(s)`, 'error');
        }

        setActiveTab('results');
        await fetchVerificationHistory(selectedContract.contract_id);
      } else {
        const error = await response.json();
        addLog(`Verification failed: ${error.detail}`, 'error');
      }
    } catch (error) {
      addLog(`Error: ${error.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVerificationHistory = async (contractId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/contract/verifications/${contractId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setVerificationHistory(data);
      }
    } catch (error) {
      addLog(`Failed to fetch history: ${error.message}`, 'error');
    }
  };

  const selectContract = async (contract) => {
    setSelectedContract(contract);
    setVerificationResult(null);
    setProviderForm({ provider_url: '', custom_headers: '' });
    await fetchVerificationHistory(contract.contract_id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Back Button */}
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
            <div className="bg-gradient-to-r from-violet-500 to-purple-500 p-3 rounded-xl">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-violet-400 to-purple-400 bg-clip-text text-transparent">
                Contract Testing
              </h1>
              <p className="text-slate-300">Consumer-Driven Contract verification</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="text-violet-400" size={20} />
                <h3 className="font-semibold">Contract Definition</h3>
              </div>
              <p className="text-sm text-slate-300">Define API expectations</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Check className="text-blue-400" size={20} />
                <h3 className="font-semibold">Provider Verification</h3>
              </div>
              <p className="text-sm text-slate-300">Validate provider compliance</p>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="text-purple-400" size={20} />
                <h3 className="font-semibold">Version Control</h3>
              </div>
              <p className="text-sm text-slate-300">Track contract changes</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left - Contracts List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl p-6 border border-slate-700/50">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Code size={20} className="text-violet-400" />
                  Contracts ({contracts.length})
                </h2>
                <button
                  onClick={() => setActiveTab('create')}
                  className="p-2 bg-violet-600 hover:bg-violet-700 rounded-lg transition-all"
                  title="Create Contract"
                >
                  <Plus size={20} />
                </button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {contracts.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No contracts yet</p>
                    <p className="text-sm mt-2">Create your first contract</p>
                  </div>
                ) : (
                  contracts.map((contract) => (
                    <div
                      key={contract.contract_id}
                      className={`bg-slate-900/50 border rounded-lg p-3 cursor-pointer transition-all ${
                        selectedContract?.contract_id === contract.contract_id
                          ? 'border-violet-500 bg-violet-900/20'
                          : 'border-slate-700 hover:border-violet-700'
                      }`}
                      onClick={() => selectContract(contract)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-semibold text-white mb-1">{contract.contract_name}</div>
                          <div className="text-xs text-slate-400 mb-1">
                            <span className="bg-violet-500/20 px-2 py-0.5 rounded">{contract.consumer_name}</span>
                            {' → '}
                            <span className="bg-purple-500/20 px-2 py-0.5 rounded">{contract.provider_name}</span>
                          </div>
                          <div className="text-xs text-slate-500 mb-1">
                            <span className="font-mono bg-slate-800 px-2 py-0.5 rounded">{contract.request_method}</span>
                            {' '}
                            {contract.request_path}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-2">
                            <span>v{contract.version}</span>
                            {contract.verification_count > 0 && (
                              <>
                                <span>•</span>
                                <span>{contract.verification_count} tests</span>
                                {contract.last_verification_passed !== null && (
                                  contract.last_verification_passed ?
                                    <CheckCircle size={12} className="text-green-400" /> :
                                    <XCircle size={12} className="text-red-400" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-2">
                          {selectedContract?.contract_id === contract.contract_id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveTab('verify');
                              }}
                              disabled={isLoading}
                              className="p-2 hover:bg-green-500/20 text-green-400 rounded transition-all"
                              title="Verify Provider"
                            >
                              {isLoading ? <Loader size={16} className="animate-spin" /> : <Play size={16} />}
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteContract(contract.contract_id);
                            }}
                            className="p-2 hover:bg-red-500/20 text-red-400 rounded transition-all"
                            title="Delete"
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

          {/* Right - Tabs */}
          <div className="lg:col-span-2">
            {/* Tabs */}
            <div className="bg-white/10 backdrop-blur-lg rounded-t-2xl shadow-2xl border border-white/20 border-b-0">
              <div className="flex gap-2 p-4 flex-wrap">
                <button
                  onClick={() => setActiveTab('contracts')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                    activeTab === 'contracts' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/10 text-violet-200 hover:bg-white/20'
                  }`}
                >
                  <Code className="w-4 h-4" />
                  Details
                </button>
                <button
                  onClick={() => setActiveTab('create')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                    activeTab === 'create' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/10 text-violet-200 hover:bg-white/20'
                  }`}
                >
                  <Plus className="w-4 h-4" />
                  Create
                </button>
                <button
                  onClick={() => setActiveTab('verify')}
                  disabled={!selectedContract}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                    activeTab === 'verify' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/10 text-violet-200 hover:bg-white/20 disabled:opacity-50'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Verify
                </button>
                <button
                  onClick={() => setActiveTab('results')}
                  disabled={!verificationResult}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                    activeTab === 'results' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/10 text-violet-200 hover:bg-white/20 disabled:opacity-50'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  Results
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  disabled={!verificationHistory}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all text-sm ${
                    activeTab === 'history' ? 'bg-violet-600 text-white shadow-lg' : 'bg-white/10 text-violet-200 hover:bg-white/20 disabled:opacity-50'
                  }`}
                >
                  <History className="w-4 h-4" />
                  History
                  {verificationHistory && <span className="bg-white/20 px-2 py-0.5 rounded-full text-xs">{verificationHistory.verifications.length}</span>}
                </button>
              </div>
            </div>

            {/* Tab Content */}
            <div className="bg-white/10 backdrop-blur-lg rounded-b-2xl shadow-2xl p-6 border border-white/20 min-h-[600px] max-h-[700px] overflow-y-auto">
              {/* Details Tab */}
              {activeTab === 'contracts' && (
                <div>
                  {selectedContract ? (
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-6">Contract Details</h2>
                      <div className="space-y-4">
                        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <div className="text-sm text-slate-400">Contract Name</div>
                              <div className="text-lg font-semibold">{selectedContract.contract_name}</div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">Version</div>
                              <div className="text-lg font-semibold">{selectedContract.version}</div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">Consumer</div>
                              <div className="text-sm bg-violet-500/20 px-3 py-1 rounded inline-block">{selectedContract.consumer_name}</div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">Provider</div>
                              <div className="text-sm bg-purple-500/20 px-3 py-1 rounded inline-block">{selectedContract.provider_name}</div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-sm text-slate-400">Request</div>
                              <div className="font-mono text-sm bg-slate-800 px-3 py-2 rounded mt-1">
                                {selectedContract.request_method} {selectedContract.request_path}
                              </div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">Expected Status</div>
                              <div className="text-lg font-semibold">{selectedContract.response_status}</div>
                            </div>
                            <div>
                              <div className="text-sm text-slate-400">Verifications</div>
                              <div className="text-lg font-semibold">{selectedContract.verification_count}</div>
                            </div>
                          </div>
                        </div>

                        {logs.length > 0 && (
                          <div className="bg-black/30 rounded-lg p-4 h-48 overflow-y-auto font-mono text-sm">
                            {logs.map((log, index) => (
                              <div key={index} className={`mb-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-violet-300'}`}>
                                <span className="text-violet-400">[{log.timestamp}]</span> {log.message}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20">
                      <FileText size={64} className="mx-auto text-slate-600 mb-4" />
                      <p className="text-slate-400 text-lg">Select a contract</p>
                      <p className="text-sm text-slate-500 mt-2">Or create a new one</p>
                    </div>
                  )}
                </div>
              )}

              {/* Create Tab */}
              {activeTab === 'create' && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Plus className="w-6 h-6" />
                    Create New Contract
                  </h2>

                  {/* AI Assistant Section */}
                  <div className="mb-8 bg-gradient-to-r from-violet-600/20 via-purple-600/20 to-fuchsia-600/20 border-2 border-violet-400/40 rounded-xl p-6 backdrop-blur-sm">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white">AI Contract Assistant</h3>
                        <p className="text-sm text-violet-200">Describe your contract in plain English, AI will generate it for you</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <textarea
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        placeholder="Example: I need a contract for a user registration API that accepts email and password in the request body, and returns user ID, username, email, and authentication token in the response..."
                        className="w-full px-4 py-3 bg-slate-900/80 border border-violet-400/30 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent text-white placeholder-slate-400 resize-none"
                        rows={4}
                        disabled={aiLoading}
                      />

                      <button
                        onClick={generateContractWithAI}
                        disabled={aiLoading || !aiDescription.trim()}
                        className="w-full py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 hover:from-violet-700 hover:via-purple-700 hover:to-fuchsia-700 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-violet-500/30"
                      >
                        {aiLoading ? (
                          <>
                            <Loader className="w-5 h-5 animate-spin" />
                            AI is generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            Generate Contract with AI
                          </>
                        )}
                      </button>

                      <div className="bg-violet-500/10 border border-violet-400/20 rounded-lg p-3">
                        <p className="text-xs text-violet-200 leading-relaxed">
                          <strong className="text-violet-100">💡 Tips:</strong> Be specific about your API endpoint, request/response structure,
                          and data types. Mention consumer and provider names if you have them. The AI will generate a complete
                          contract with proper JSON Schema that you can review and edit below.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-violet-400/30"></div>
                    <span className="text-sm text-violet-300 font-semibold">OR CREATE MANUALLY</span>
                    <div className="flex-1 h-px bg-violet-400/30"></div>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Contract Name *</label>
                        <input
                          type="text"
                          value={contractForm.contract_name}
                          onChange={(e) => setContractForm({ ...contractForm, contract_name: e.target.value })}
                          placeholder="User API Contract"
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Version</label>
                        <input
                          type="text"
                          value={contractForm.version}
                          onChange={(e) => setContractForm({ ...contractForm, version: e.target.value })}
                          placeholder="1.0.0"
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Consumer (Your App) *</label>
                        <input
                          type="text"
                          value={contractForm.consumer_name}
                          onChange={(e) => setContractForm({ ...contractForm, consumer_name: e.target.value })}
                          placeholder="Mobile App"
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Provider (API Service) *</label>
                        <input
                          type="text"
                          value={contractForm.provider_name}
                          onChange={(e) => setContractForm({ ...contractForm, provider_name: e.target.value })}
                          placeholder="User Service API"
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Description</label>
                      <input
                        type="text"
                        value={contractForm.description}
                        onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                        placeholder="Contract for user API"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">HTTP Method</label>
                        <select
                          value={contractForm.request_method}
                          onChange={(e) => setContractForm({ ...contractForm, request_method: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
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
                          value={contractForm.response_status}
                          onChange={(e) => setContractForm({ ...contractForm, response_status: e.target.value })}
                          className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Request Path *</label>
                      <input
                        type="text"
                        value={contractForm.request_path}
                        onChange={(e) => setContractForm({ ...contractForm, request_path: e.target.value })}
                        placeholder="/api/users/1"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Response Body Schema (JSON Schema) *</label>
                      <textarea
                        value={contractForm.response_body_schema}
                        onChange={(e) => setContractForm({ ...contractForm, response_body_schema: e.target.value })}
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                        rows={10}
                      />
                    </div>

                    <div className="bg-violet-500/20 border border-violet-400/30 rounded-lg p-4">
                      <h4 className="font-bold text-white mb-2 text-sm">💡 JSON Schema Format</h4>
                      <ul className="space-y-1 text-xs text-violet-200">
                        <li>• Define the structure your app expects from the API</li>
                        <li>• Specify field types: string, integer, number, boolean, object, array</li>
                        <li>• Mark required fields in the "required" array</li>
                        <li>• Provider will be tested against this schema</li>
                      </ul>
                    </div>

                    <button
                      onClick={createContract}
                      disabled={isLoading}
                      className="w-full py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader className="w-5 h-5 animate-spin" />
                          Creating...
                        </span>
                      ) : (
                        'Create Contract'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Verify Tab */}
              {activeTab === 'verify' && selectedContract && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Verify Provider</h2>
                  <div className="space-y-4">
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700 mb-4">
                      <div className="text-sm text-slate-400 mb-2">Testing Contract:</div>
                      <div className="font-semibold text-lg">{selectedContract.contract_name}</div>
                      <div className="text-sm text-slate-400 mt-1">
                        {selectedContract.consumer_name} → {selectedContract.provider_name}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Provider Base URL *</label>
                      <input
                        type="text"
                        value={providerForm.provider_url}
                        onChange={(e) => setProviderForm({ ...providerForm, provider_url: e.target.value })}
                        placeholder="https://api.example.com"
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500"
                      />
                      <div className="text-xs text-slate-500 mt-1">
                        Full URL will be: {providerForm.provider_url || 'https://api.example.com'}{selectedContract.request_path}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Headers (JSON) - Optional</label>
                      <textarea
                        value={providerForm.custom_headers}
                        onChange={(e) => setProviderForm({ ...providerForm, custom_headers: e.target.value })}
                        placeholder='{"Authorization": "Bearer token"}'
                        className="w-full px-4 py-2 bg-slate-900/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-violet-500 font-mono text-sm"
                        rows={3}
                      />
                    </div>

                    <button
                      onClick={verifyProvider}
                      disabled={isLoading || !providerForm.provider_url}
                      className="w-full py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-bold transition-all disabled:opacity-50"
                    >
                      {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                          <Loader className="w-5 h-5 animate-spin" />
                          Verifying...
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-2">
                          <Play className="w-5 h-5" />
                          Verify Provider
                        </span>
                      )}
                    </button>

                    {logs.length > 0 && (
                      <div className="bg-black/30 rounded-lg p-4 max-h-64 overflow-y-auto font-mono text-sm">
                        {logs.map((log, index) => (
                          <div key={index} className={`mb-2 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : 'text-violet-300'}`}>
                            <span className="text-violet-400">[{log.timestamp}]</span> {log.message}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Results Tab */}
              {activeTab === 'results' && verificationResult && (
                <div>
                  <h2 className="text-2xl font-bold text-white mb-6">Verification Results</h2>

                  {/* Status */}
                  <div className={`rounded-lg p-6 text-center mb-6 ${
                    verificationResult.passed ? 'bg-green-500/20 border border-green-500/30' : 'bg-red-500/20 border border-red-500/30'
                  }`}>
                    {verificationResult.passed ? (
                      <CheckCircle size={48} className="mx-auto text-green-400 mb-2" />
                    ) : (
                      <XCircle size={48} className="mx-auto text-red-400 mb-2" />
                    )}
                    <h3 className="text-2xl font-bold mb-2">
                      {verificationResult.passed ? 'Contract Verified!' : 'Contract Violation!'}
                    </h3>
                    <p className="text-sm">
                      {verificationResult.passed ? '✅ Provider meets all contract requirements' : `❌ ${verificationResult.validation_errors.length} validation error(s)`}
                    </p>
                  </div>

                  {/* Summary */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Status Code</div>
                      <div className={`text-2xl font-bold ${verificationResult.status_code_match ? 'text-green-400' : 'text-red-400'}`}>
                        {verificationResult.status_code_match ? '✓' : '✗'} {verificationResult.response_received.status_code}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Schema Match</div>
                      <div className={`text-2xl font-bold ${verificationResult.schema_match ? 'text-green-400' : 'text-red-400'}`}>
                        {verificationResult.schema_match ? '✓ PASS' : '✗ FAIL'}
                      </div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Response Time</div>
                      <div className="text-2xl font-bold">{verificationResult.response_time_ms}ms</div>
                    </div>
                  </div>

                  {/* Validation Errors */}
                  {verificationResult.validation_errors && verificationResult.validation_errors.length > 0 && (
                    <div className="mb-6">
                      <h3 className="font-semibold mb-3 text-lg">Validation Errors:</h3>
                      <div className="space-y-3">
                        {verificationResult.validation_errors.map((error, index) => (
                          <div key={index} className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
                            <div className="flex items-start gap-2">
                              <AlertTriangle className="text-red-400 flex-shrink-0 mt-0.5" size={20} />
                              <div className="flex-1">
                                <div className="font-semibold text-red-300">{error.type.replace('_', ' ').toUpperCase()}</div>
                                <div className="text-sm text-red-200 mt-1">{error.message}</div>
                                {error.path && <div className="text-xs text-red-300 mt-1 font-mono">Path: {error.path}</div>}
                                {error.expected && <div className="text-xs text-red-300 mt-1">Expected: {JSON.stringify(error.expected)}</div>}
                                {error.actual !== undefined && <div className="text-xs text-red-300">Actual: {JSON.stringify(error.actual)}</div>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Response */}
                  <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                    <h4 className="font-semibold mb-2 text-sm text-slate-400">Provider Response</h4>
                    <pre className="text-xs bg-black/30 p-3 rounded overflow-auto max-h-64">
                      {JSON.stringify(verificationResult.response_received.body, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* History Tab */}
              {activeTab === 'history' && verificationHistory && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-white">Verification History</h2>
                    <div className="text-sm text-slate-400">
                      {verificationHistory.verifications.length} test(s)
                    </div>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Total</div>
                      <div className="text-2xl font-bold">{verificationHistory.statistics.total_verifications}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Passed</div>
                      <div className="text-2xl font-bold text-green-400">{verificationHistory.statistics.passed}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Failed</div>
                      <div className="text-2xl font-bold text-red-400">{verificationHistory.statistics.failed}</div>
                    </div>
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700">
                      <div className="text-sm text-slate-400">Pass Rate</div>
                      <div className={`text-2xl font-bold ${verificationHistory.statistics.pass_rate >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {verificationHistory.statistics.pass_rate}%
                      </div>
                    </div>
                  </div>

                  {/* Timeline */}
                  <div className="space-y-2">
                    <h3 className="font-semibold mb-3">Verification Timeline:</h3>
                    {verificationHistory.verifications.map((verification, index) => (
                      <div
                        key={verification.verification_id}
                        className={`rounded-lg p-4 border ${
                          verification.passed ? 'bg-green-900/10 border-green-700/30' : 'bg-red-900/10 border-red-700/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {verification.passed ? (
                              <CheckCircle size={20} className="text-green-400" />
                            ) : (
                              <XCircle size={20} className="text-red-400" />
                            )}
                            <div>
                              <div className="font-semibold">{verification.passed ? 'Passed' : 'Failed'}</div>
                              <div className="text-xs text-slate-400">{new Date(verification.created_at).toLocaleString()}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-sm">
                              <span className="text-slate-400">Status:</span> <span className={verification.status_code_match ? 'text-green-400' : 'text-red-400'}>{verification.status_code_match ? '✓' : '✗'}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-slate-400">Schema:</span> <span className={verification.schema_match ? 'text-green-400' : 'text-red-400'}>{verification.schema_match ? '✓' : '✗'}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-slate-400">Time:</span> <span className="font-mono">{verification.response_time_ms}ms</span>
                            </div>
                          </div>
                        </div>
                        {verification.error_message && (
                          <div className="mt-2 text-xs text-red-300 bg-red-900/20 rounded p-2">
                            {verification.error_message}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractTestingApp;
