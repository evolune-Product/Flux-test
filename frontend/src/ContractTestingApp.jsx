import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  FileText,
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
  Sparkles,
  User,
} from 'lucide-react';
import BackButton from './BackButton';
import { saveTestRun } from './testHistoryUtils.js';
import { apiFetch } from './lib/api.js';

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
      const response = await apiFetch('/contract/my-contracts');
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

      const response = await apiFetch('/contract/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    addLog('AI is generating your contract...', 'info');

    try {
      const response = await apiFetch('/contract/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

        addLog('Contract generated successfully! Review and edit below.', 'success');
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
      const response = await apiFetch(`/contract/${contractId}`, { method: 'DELETE' });

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

      const response = await apiFetch('/contract/verify-provider', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setVerificationResult(data);
        saveTestRun({
          module: 'contract',
          apiUrl: providerForm.provider_url,
          totalTests: 1,
          passed: data.passed ? 1 : 0,
          failed: data.passed ? 0 : 1,
          overallStatus: data.passed ? 'PASS' : 'FAIL'
        });

        if (data.passed) {
          addLog('Provider verification PASSED!', 'success');
        } else {
          addLog(`Provider verification FAILED! ${data.validation_errors.length} error(s)`, 'error');
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
      const response = await apiFetch(`/contract/verifications/${contractId}`);
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

  // ─── Design tokens ───────────────────────────────────────────────
  const VIOLET = '#a78bfa';
  const VIOLET_DIM = 'rgba(167,139,250,0.12)';

  const card = {
    background: 'rgba(9,12,22,0.80)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    backdropFilter: 'blur(20px)',
  };
  const inputStyle = {
    width: '100%',
    padding: '10px 14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 10,
    color: '#e2e8f0',
    fontSize: 14,
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'rgba(255,255,255,0.45)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: 6,
  };
  const logColor = (type) => {
    if (type === 'error')   return { color: '#f87171' };
    if (type === 'warning') return { color: '#fbbf24' };
    if (type === 'success') return { color: '#34d399' };
    return { color: VIOLET };
  };
  const methodColor = (m) => {
    const map = { GET:'#34d399', POST:'#60a5fa', PUT:'#fbbf24', PATCH:'#fb923c', DELETE:'#f87171' };
    return map[m] || VIOLET;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#020408 0%,#060c18 50%,#020408 100%)',
      color: '#e2e8f0',
      fontFamily: '"Inter","SF Pro Display",system-ui,sans-serif',
      position: 'relative',
    }}>
      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(167,139,250,0.08) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Sticky Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(2,4,8,0.92)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(20px)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <BackButton />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 34, height: 34, borderRadius: 10,
              background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(167,139,250,0.40)',
            }}>
              <FileText size={17} color="#fff" />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
                Contract Testing
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: -1 }}>
                Consumer-driven contract verification
              </div>
            </div>
          </div>
        </div>
        {user?.username && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, fontSize: 13, color: 'rgba(255,255,255,0.6)',
          }}>
            <User size={13} /> {user.username}
          </div>
        )}
      </div>

      {/* ── Page body ── */}
      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1280, margin: '0 auto', padding: '36px 32px 60px' }}>

        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
              background: VIOLET_DIM, color: VIOLET,
              border: `1px solid rgba(167,139,250,0.25)`, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>Contract Suite</span>
            <span style={{
              padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.40)',
              border: '1px solid rgba(255,255,255,0.07)', letterSpacing: '0.06em',
            }}>AI-Powered</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em', margin: 0, marginBottom: 8 }}>
            Contract Testing &amp; Provider Verification
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.40)', fontSize: 14, margin: 0 }}>
            Define consumer-driven contracts and verify provider compliance automatically.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Contracts', value: contracts.length, color: VIOLET },
              { label: 'Selected', value: selectedContract?.contract_name || 'None', color: 'rgba(255,255,255,0.60)' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '8px 18px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 10, fontSize: 13,
              }}>
                <span style={{ color: 'rgba(255,255,255,0.40)' }}>{s.label}: </span>
                <span style={{ color: s.color, fontWeight: 700 }}>{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── 2-col layout ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 22, alignItems: 'start' }}>

          {/* ═══ LEFT: Contracts list ═══ */}
          <div style={{ ...card, padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7,
                  background: VIOLET_DIM,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Code size={13} color={VIOLET} />
                </div>
                <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
                  Contracts
                  <span style={{
                    marginLeft: 6, padding: '1px 7px', borderRadius: 10,
                    background: VIOLET_DIM, color: VIOLET, fontSize: 11, fontWeight: 700,
                  }}>{contracts.length}</span>
                </span>
              </div>
              <button
                onClick={() => setActiveTab('create')}
                style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                  border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 10px rgba(167,139,250,0.25)',
                }}
                title="Create Contract"
              >
                <Plus size={15} color="#fff" />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 560, overflowY: 'auto' }}>
              {contracts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)' }}>
                  <FileText size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.2 }} />
                  <p style={{ margin: 0, fontSize: 12 }}>No contracts yet</p>
                </div>
              ) : (
                contracts.map((contract) => {
                  const isSel = selectedContract?.contract_id === contract.contract_id;
                  return (
                    <div
                      key={contract.contract_id}
                      onClick={() => selectContract(contract)}
                      style={{
                        padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                        background: isSel ? VIOLET_DIM : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSel ? 'rgba(167,139,250,0.30)' : 'rgba(255,255,255,0.06)'}`,
                        transition: 'all 0.18s',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13, color: isSel ? VIOLET : '#e2e8f0', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {contract.contract_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, flexWrap: 'wrap' }}>
                            <span style={{
                              padding: '1px 6px', borderRadius: 4, fontSize: 10,
                              background: VIOLET_DIM, color: VIOLET, fontWeight: 600,
                            }}>{contract.consumer_name}</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>→</span>
                            <span style={{
                              padding: '1px 6px', borderRadius: 4, fontSize: 10,
                              background: 'rgba(167,139,250,0.07)', color: 'rgba(167,139,250,0.70)', fontWeight: 600,
                            }}>{contract.provider_name}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{
                              padding: '1px 5px', borderRadius: 4, fontSize: 10, fontWeight: 700,
                              color: methodColor(contract.request_method), background: 'rgba(0,0,0,0.25)',
                              fontFamily: '"JetBrains Mono","Fira Code",monospace',
                            }}>{contract.request_method}</span>
                            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>v{contract.version}</span>
                            {contract.verification_count > 0 && (
                              <>
                                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.20)' }}>•</span>
                                {contract.last_verification_passed !== null && (
                                  contract.last_verification_passed
                                    ? <CheckCircle size={11} color="#34d399" />
                                    : <XCircle size={11} color="#f87171" />
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                          {isSel && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveTab('verify'); }}
                              disabled={isLoading}
                              style={{
                                width: 26, height: 26, borderRadius: 6,
                                background: 'rgba(52,211,153,0.15)',
                                border: '1px solid rgba(52,211,153,0.25)',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                              title="Verify Provider"
                            >
                              {isLoading
                                ? <Loader size={12} color="#34d399" style={{ animation: 'spin 1s linear infinite' }} />
                                : <Play size={12} color="#34d399" />
                              }
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteContract(contract.contract_id); }}
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              background: 'rgba(248,113,113,0.10)',
                              border: '1px solid rgba(248,113,113,0.15)',
                              cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                            title="Delete"
                          >
                            <Trash2 size={12} color="#f87171" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* ═══ RIGHT: Tabbed panel ═══ */}
          <div style={{ ...card, overflow: 'hidden' }}>
            {/* Tab bar */}
            <div style={{
              display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '0 22px',
            }}>
              {[
                { key: 'contracts', label: 'Details',  icon: Code,     accent: VIOLET },
                { key: 'create',    label: 'Create',   icon: Plus,     accent: '#60a5fa' },
                { key: 'verify',    label: 'Verify',   icon: Play,     accent: '#34d399' },
                { key: 'results',   label: 'Results',  icon: BarChart3,accent: '#fbbf24' },
                { key: 'history',   label: `History${verificationHistory ? ` (${verificationHistory.verifications.length})` : ''}`, icon: History, accent: '#fb923c' },
              ].map(t => {
                const Icon = t.icon;
                return (
                  <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '14px 13px', fontSize: 13, fontWeight: 600,
                    background: 'none', border: 'none', cursor: 'pointer',
                    borderBottom: activeTab === t.key ? `2px solid ${t.accent}` : '2px solid transparent',
                    color: activeTab === t.key ? t.accent : 'rgba(255,255,255,0.35)',
                    marginBottom: -1, transition: 'all 0.18s',
                  }}>
                    <Icon size={13} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: 28, maxHeight: 680, overflowY: 'auto' }}>

              {/* ─ Details Tab ─ */}
              {activeTab === 'contracts' && (
                <div>
                  {selectedContract ? (
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                        <div style={{ fontWeight: 700, fontSize: 17, color: '#fff' }}>Contract Details</div>
                        <button
                          onClick={() => setActiveTab('verify')}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 7,
                            padding: '8px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13,
                            border: 'none', cursor: 'pointer',
                            background: 'linear-gradient(135deg,#059669,#047857)',
                            color: '#fff',
                            boxShadow: '0 0 14px rgba(5,150,105,0.25)',
                          }}
                        >
                          <Play size={13} /> Verify Provider
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                        {[
                          { label: 'Contract Name', value: selectedContract.contract_name },
                          { label: 'Version',       value: selectedContract.version, mono: true },
                          { label: 'Consumer',      value: selectedContract.consumer_name, badge: true, color: VIOLET, bg: VIOLET_DIM },
                          { label: 'Provider',      value: selectedContract.provider_name, badge: true, color: 'rgba(167,139,250,0.70)', bg: 'rgba(167,139,250,0.07)' },
                          { label: 'Expected Status', value: selectedContract.response_status, mono: true },
                          { label: 'Verifications', value: selectedContract.verification_count },
                        ].map(f => (
                          <div key={f.label} style={{
                            padding: '12px 14px', borderRadius: 9,
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid rgba(255,255,255,0.06)',
                          }}>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{f.label}</div>
                            {f.badge ? (
                              <span style={{
                                padding: '3px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: f.bg, color: f.color,
                              }}>{f.value}</span>
                            ) : (
                              <div style={{
                                fontSize: 14, fontWeight: 600, color: '#e2e8f0',
                                fontFamily: f.mono ? '"JetBrains Mono","Fira Code",monospace' : 'inherit',
                              }}>{f.value}</div>
                            )}
                          </div>
                        ))}
                        <div style={{
                          gridColumn: '1/-1', padding: '12px 14px', borderRadius: 9,
                          background: 'rgba(255,255,255,0.02)',
                          border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Request</div>
                          <div style={{
                            fontSize: 13, color: '#e2e8f0',
                            fontFamily: '"JetBrains Mono","Fira Code",monospace',
                          }}>
                            <span style={{ color: methodColor(selectedContract.request_method), fontWeight: 700 }}>{selectedContract.request_method}</span>
                            {' '}{selectedContract.request_path}
                          </div>
                        </div>
                      </div>

                      {/* Logs */}
                      {logs.length > 0 && (
                        <div style={{
                          background: '#050810',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 12, overflow: 'hidden',
                        }}>
                          <div style={{
                            padding: '8px 14px', background: 'rgba(255,255,255,0.03)',
                            borderBottom: '1px solid rgba(255,255,255,0.06)',
                            display: 'flex', alignItems: 'center', gap: 7,
                          }}>
                            {['#ff5f57','#febc2e','#28c840'].map(c => (
                              <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.80 }} />
                            ))}
                            <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                              contract.log
                            </span>
                          </div>
                          <div style={{ padding: 12, maxHeight: 160, overflowY: 'auto', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 11 }}>
                            {logs.map((log, i) => (
                              <div key={i} style={{ display: 'flex', gap: 8, lineHeight: 1.5, marginBottom: 2 }}>
                                <span style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>{log.timestamp}</span>
                                <span style={logColor(log.type)}>{log.message}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.20)' }}>
                      <FileText size={52} style={{ margin: '0 auto 14px', display: 'block', opacity: 0.15 }} />
                      <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.35)' }}>Select a contract</p>
                      <p style={{ margin: '6px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.20)' }}>Or create a new one</p>
                    </div>
                  )}
                </div>
              )}

              {/* ─ Create Tab ─ */}
              {activeTab === 'create' && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Plus size={18} /> Create New Contract
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* AI assistant */}
                    <div style={{
                      padding: '18px 20px', borderRadius: 12,
                      background: 'linear-gradient(135deg,rgba(124,58,237,0.12),rgba(109,40,217,0.12))',
                      border: '1px solid rgba(167,139,250,0.25)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: 9,
                          background: 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Sparkles size={16} color="#fff" />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: VIOLET, fontSize: 14 }}>AI Contract Assistant</div>
                          <div style={{ fontSize: 12, color: 'rgba(167,139,250,0.65)' }}>
                            Describe your contract — AI will generate it for you
                          </div>
                        </div>
                      </div>
                      <textarea
                        value={aiDescription}
                        onChange={(e) => setAiDescription(e.target.value)}
                        placeholder="Example: A contract for a user registration API that accepts email and password, and returns user ID, username, email, and auth token..."
                        rows={4}
                        disabled={aiLoading}
                        style={{
                          ...inputStyle,
                          fontFamily: 'inherit', resize: 'vertical',
                          background: 'rgba(167,139,250,0.06)',
                          marginBottom: 10,
                        }}
                      />
                      <button
                        onClick={generateContractWithAI}
                        disabled={aiLoading || !aiDescription.trim()}
                        style={{
                          width: '100%', padding: '11px 0',
                          borderRadius: 9, fontWeight: 700, fontSize: 13,
                          border: 'none',
                          cursor: aiLoading || !aiDescription.trim() ? 'not-allowed' : 'pointer',
                          background: aiLoading || !aiDescription.trim()
                            ? 'rgba(255,255,255,0.06)'
                            : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                          color: aiLoading || !aiDescription.trim() ? 'rgba(255,255,255,0.30)' : '#fff',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                          boxShadow: aiLoading || !aiDescription.trim() ? 'none' : '0 0 16px rgba(124,58,237,0.30)',
                        }}
                      >
                        {aiLoading
                          ? <><Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> AI is generating…</>
                          : <><Sparkles size={14} /> Generate Contract with AI</>
                        }
                      </button>
                    </div>

                    <div style={{ textAlign: 'center', fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>— or create manually —</div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>Contract Name *</label>
                        <input type="text" value={contractForm.contract_name}
                          onChange={(e) => setContractForm({ ...contractForm, contract_name: e.target.value })}
                          placeholder="User API Contract" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Version</label>
                        <input type="text" value={contractForm.version}
                          onChange={(e) => setContractForm({ ...contractForm, version: e.target.value })}
                          placeholder="1.0.0" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Consumer (Your App) *</label>
                        <input type="text" value={contractForm.consumer_name}
                          onChange={(e) => setContractForm({ ...contractForm, consumer_name: e.target.value })}
                          placeholder="Mobile App" style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Provider (API Service) *</label>
                        <input type="text" value={contractForm.provider_name}
                          onChange={(e) => setContractForm({ ...contractForm, provider_name: e.target.value })}
                          placeholder="User Service API" style={inputStyle} />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Description</label>
                      <input type="text" value={contractForm.description}
                        onChange={(e) => setContractForm({ ...contractForm, description: e.target.value })}
                        placeholder="Contract for user API" style={inputStyle} />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
                      <div>
                        <label style={labelStyle}>HTTP Method</label>
                        <select value={contractForm.request_method}
                          onChange={(e) => setContractForm({ ...contractForm, request_method: e.target.value })}
                          style={{ ...inputStyle, cursor: 'pointer' }}>
                          {['GET','POST','PUT','PATCH','DELETE'].map(m => (
                            <option key={m} value={m} style={{ background: '#0a0e1a' }}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={labelStyle}>Expected Status</label>
                        <input type="number" value={contractForm.response_status}
                          onChange={(e) => setContractForm({ ...contractForm, response_status: e.target.value })}
                          style={inputStyle} />
                      </div>
                      <div>
                        <label style={labelStyle}>Request Path *</label>
                        <input type="text" value={contractForm.request_path}
                          onChange={(e) => setContractForm({ ...contractForm, request_path: e.target.value })}
                          placeholder="/api/users/1" style={inputStyle} />
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Response Body Schema (JSON Schema) *</label>
                      <textarea
                        value={contractForm.response_body_schema}
                        onChange={(e) => setContractForm({ ...contractForm, response_body_schema: e.target.value })}
                        rows={10}
                        style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12, resize: 'vertical' }}
                      />
                    </div>

                    <div style={{
                      padding: '12px 16px', borderRadius: 10,
                      background: VIOLET_DIM, border: `1px solid rgba(167,139,250,0.20)`,
                      fontSize: 12, color: 'rgba(167,139,250,0.80)', lineHeight: 1.7,
                    }}>
                      <strong style={{ color: VIOLET }}>JSON Schema tips:</strong> Define field types (string, integer, boolean, object, array), mark required fields in the "required" array. Provider will be tested against this schema.
                    </div>

                    <button
                      onClick={createContract}
                      disabled={isLoading}
                      style={{
                        width: '100%', padding: '13px 0',
                        borderRadius: 10, fontWeight: 700, fontSize: 14,
                        border: 'none', cursor: isLoading ? 'not-allowed' : 'pointer',
                        background: isLoading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)',
                        color: isLoading ? 'rgba(255,255,255,0.30)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: isLoading ? 'none' : '0 0 20px rgba(124,58,237,0.30)',
                        transition: 'all 0.2s',
                      }}
                    >
                      {isLoading
                        ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Creating…</>
                        : 'Create Contract'
                      }
                    </button>
                  </div>
                </div>
              )}

              {/* ─ Verify Tab ─ */}
              {activeTab === 'verify' && selectedContract && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 20 }}>Verify Provider</div>

                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: VIOLET_DIM, border: `1px solid rgba(167,139,250,0.20)`,
                    marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Testing Contract</div>
                    <div style={{ fontWeight: 700, fontSize: 15, color: VIOLET }}>{selectedContract.contract_name}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      {selectedContract.consumer_name} → {selectedContract.provider_name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={labelStyle}>Provider Base URL *</label>
                      <input
                        type="text"
                        value={providerForm.provider_url}
                        onChange={(e) => setProviderForm({ ...providerForm, provider_url: e.target.value })}
                        placeholder="https://api.example.com"
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 5, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                        Full: {providerForm.provider_url || 'https://api.example.com'}{selectedContract.request_path}
                      </div>
                    </div>

                    <div>
                      <label style={labelStyle}>Custom Headers (JSON) — optional</label>
                      <textarea
                        value={providerForm.custom_headers}
                        onChange={(e) => setProviderForm({ ...providerForm, custom_headers: e.target.value })}
                        placeholder='{"Authorization": "Bearer token"}'
                        rows={3}
                        style={{ ...inputStyle, fontFamily: '"JetBrains Mono","Fira Code",monospace', resize: 'vertical' }}
                      />
                    </div>

                    <button
                      onClick={verifyProvider}
                      disabled={isLoading || !providerForm.provider_url}
                      style={{
                        width: '100%', padding: '13px 0',
                        borderRadius: 10, fontWeight: 700, fontSize: 14,
                        border: 'none',
                        cursor: isLoading || !providerForm.provider_url ? 'not-allowed' : 'pointer',
                        background: isLoading || !providerForm.provider_url
                          ? 'rgba(255,255,255,0.06)'
                          : 'linear-gradient(135deg,#059669,#047857)',
                        color: isLoading || !providerForm.provider_url ? 'rgba(255,255,255,0.30)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: isLoading || !providerForm.provider_url ? 'none' : '0 0 20px rgba(5,150,105,0.25)',
                      }}
                    >
                      {isLoading
                        ? <><Loader size={15} style={{ animation: 'spin 1s linear infinite' }} /> Verifying…</>
                        : <><Play size={15} /> Verify Provider</>
                      }
                    </button>

                    {/* Inline log terminal */}
                    {logs.length > 0 && (
                      <div style={{
                        background: '#050810', border: '1px solid rgba(255,255,255,0.07)',
                        borderRadius: 12, overflow: 'hidden',
                      }}>
                        <div style={{
                          padding: '8px 14px', background: 'rgba(255,255,255,0.03)',
                          borderBottom: '1px solid rgba(255,255,255,0.06)',
                          display: 'flex', alignItems: 'center', gap: 7,
                        }}>
                          {['#ff5f57','#febc2e','#28c840'].map(c => (
                            <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.80 }} />
                          ))}
                          <span style={{ marginLeft: 6, fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>verify.log</span>
                        </div>
                        <div style={{ padding: 12, maxHeight: 200, overflowY: 'auto', fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 11 }}>
                          {logs.map((log, i) => (
                            <div key={i} style={{ display: 'flex', gap: 8, lineHeight: 1.5, marginBottom: 2 }}>
                              <span style={{ color: 'rgba(255,255,255,0.22)', flexShrink: 0 }}>{log.timestamp}</span>
                              <span style={logColor(log.type)}>{log.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─ Results Tab ─ */}
              {activeTab === 'results' && verificationResult && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 20 }}>Verification Results</div>

                  {/* Status banner */}
                  <div style={{
                    padding: '20px', borderRadius: 12, textAlign: 'center', marginBottom: 20,
                    background: verificationResult.passed ? 'rgba(52,211,153,0.09)' : 'rgba(248,113,113,0.09)',
                    border: `1px solid ${verificationResult.passed ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`,
                  }}>
                    {verificationResult.passed
                      ? <CheckCircle size={42} color="#34d399" style={{ margin: '0 auto 10px', display: 'block' }} />
                      : <XCircle size={42} color="#f87171" style={{ margin: '0 auto 10px', display: 'block' }} />
                    }
                    <div style={{ fontWeight: 800, fontSize: 18, color: verificationResult.passed ? '#34d399' : '#f87171', marginBottom: 4 }}>
                      {verificationResult.passed ? 'Contract Verified!' : 'Contract Violation!'}
                    </div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>
                      {verificationResult.passed ? 'Provider meets all contract requirements' : `${verificationResult.validation_errors.length} validation error(s)`}
                    </div>
                  </div>

                  {/* Summary stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'Status Code', value: `${verificationResult.status_code_match ? '✓' : '✗'} ${verificationResult.response_received.status_code}`, color: verificationResult.status_code_match ? '#34d399' : '#f87171' },
                      { label: 'Schema Match', value: verificationResult.schema_match ? '✓ PASS' : '✗ FAIL', color: verificationResult.schema_match ? '#34d399' : '#f87171' },
                      { label: 'Response Time', value: `${verificationResult.response_time_ms}ms`, color: '#e2e8f0' },
                    ].map(s => (
                      <div key={s.label} style={{
                        padding: '14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Validation errors */}
                  {verificationResult.validation_errors && verificationResult.validation_errors.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 10 }}>Validation Errors</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {verificationResult.validation_errors.map((error, index) => (
                          <div key={index} style={{
                            padding: '14px 16px', borderRadius: 10,
                            background: 'rgba(248,113,113,0.07)',
                            border: '1px solid rgba(248,113,113,0.20)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                              <AlertTriangle size={15} color="#f87171" style={{ flexShrink: 0, marginTop: 1 }} />
                              <div>
                                <div style={{ fontWeight: 700, color: '#f87171', fontSize: 13 }}>
                                  {error.type.replace('_', ' ').toUpperCase()}
                                </div>
                                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{error.message}</div>
                                {error.path && (
                                  <div style={{ fontSize: 11, color: 'rgba(248,113,113,0.70)', marginTop: 3, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>
                                    Path: {error.path}
                                  </div>
                                )}
                                {error.expected !== undefined && (
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginTop: 2 }}>
                                    Expected: {JSON.stringify(error.expected)}
                                  </div>
                                )}
                                {error.actual !== undefined && (
                                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)' }}>
                                    Actual: {JSON.stringify(error.actual)}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Provider response */}
                  <div style={{ padding: '14px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Provider Response</div>
                    <pre style={{
                      margin: 0, padding: '10px 12px',
                      background: '#050810', borderRadius: 7,
                      fontSize: 11, overflowX: 'auto', maxHeight: 200,
                      color: 'rgba(255,255,255,0.55)',
                      fontFamily: '"JetBrains Mono","Fira Code",monospace',
                    }}>
                      {JSON.stringify(verificationResult.response_received.body, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* ─ History Tab ─ */}
              {activeTab === 'history' && verificationHistory && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: 17, color: '#fff', marginBottom: 20 }}>Verification History</div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
                    {[
                      { label: 'Total',     value: verificationHistory.statistics.total_verifications, color: '#e2e8f0' },
                      { label: 'Passed',    value: verificationHistory.statistics.passed,              color: '#34d399' },
                      { label: 'Failed',    value: verificationHistory.statistics.failed,              color: '#f87171' },
                      { label: 'Pass Rate', value: `${verificationHistory.statistics.pass_rate}%`,     color: verificationHistory.statistics.pass_rate >= 80 ? '#34d399' : '#fbbf24' },
                    ].map(s => (
                      <div key={s.label} style={{
                        padding: '12px', borderRadius: 9,
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.06)',
                      }}>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.label}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: s.color, fontFamily: '"JetBrains Mono","Fira Code",monospace' }}>{s.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {verificationHistory.verifications.map((v) => (
                      <div key={v.verification_id} style={{
                        padding: '12px 16px', borderRadius: 10,
                        background: v.passed ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                        border: `1px solid ${v.passed ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          {v.passed
                            ? <CheckCircle size={16} color="#34d399" />
                            : <XCircle size={16} color="#f87171" />
                          }
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 13, color: v.passed ? '#34d399' : '#f87171' }}>
                              {v.passed ? 'Passed' : 'Failed'}
                            </div>
                            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.30)' }}>
                              {new Date(v.created_at).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 16, fontFamily: '"JetBrains Mono","Fira Code",monospace', fontSize: 12 }}>
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>Status </span>
                            <span style={{ color: v.status_code_match ? '#34d399' : '#f87171', fontWeight: 700 }}>{v.status_code_match ? '✓' : '✗'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>Schema </span>
                            <span style={{ color: v.schema_match ? '#34d399' : '#f87171', fontWeight: 700 }}>{v.schema_match ? '✓' : '✗'}</span>
                          </div>
                          <div>
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>Time </span>
                            <span style={{ color: VIOLET, fontWeight: 700 }}>{v.response_time_ms}ms</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ContractTestingApp;
