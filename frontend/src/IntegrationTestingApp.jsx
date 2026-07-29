import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Link2,
  Plus,
  Trash2,
  Play,
  Loader,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Save,
  FolderOpen,
  Server,
  Layers,
  Clock,
  Variable,
  AlertCircle,
  Edit2,
  X,
  List,
  LogOut,
  Github,
} from 'lucide-react';
import BackButton from './BackButton';
import GitHubIntegration from './GitHubIntegration.jsx';
import { apiFetch } from './lib/api.js';

const ROSE = '#fb7185';
const ROSE_DIM = 'rgba(251,113,133,0.12)';
const ROSE_BORDER = 'rgba(251,113,133,0.28)';

// Inline-style color palette per service index
const SERVICE_COLORS = [
  { bg: 'rgba(59,130,246,0.14)',  border: 'rgba(59,130,246,0.32)',  text: '#93c5fd', dot: '#60a5fa'  },
  { bg: 'rgba(168,85,247,0.14)',  border: 'rgba(168,85,247,0.32)',  text: '#d8b4fe', dot: '#c084fc'  },
  { bg: 'rgba(16,185,129,0.14)',  border: 'rgba(16,185,129,0.32)',  text: '#6ee7b7', dot: '#34d399'  },
  { bg: 'rgba(249,115,22,0.14)',  border: 'rgba(249,115,22,0.32)',  text: '#fdba74', dot: '#fb923c'  },
  { bg: 'rgba(236,72,153,0.14)',  border: 'rgba(236,72,153,0.32)',  text: '#f9a8d4', dot: '#f472b6'  },
  { bg: 'rgba(6,182,212,0.14)',   border: 'rgba(6,182,212,0.32)',   text: '#67e8f9', dot: '#22d3ee'  },
];

function getServiceColor(services, serviceId) {
  const idx = services.findIndex(s => s.id === serviceId);
  return SERVICE_COLORS[idx % SERVICE_COLORS.length] || SERVICE_COLORS[0];
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// Service badge using inline styles
function ServiceBadge({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 6,
      fontSize: 13, fontWeight: 600,
      background: color.bg,
      border: `1px solid ${color.border}`,
      color: color.text,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color.dot, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export default function IntegrationTestingApp({ user, onLogout }) {
  const navigate = useNavigate();

  // ── State
  const [services, setServices] = useState([]);
  const [steps, setSteps] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState(null);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('results');
  const [savedScenarios, setSavedScenarios] = useState([]);
  const [scenarioName, setScenarioName] = useState('');
  const [expandedResults, setExpandedResults] = useState({});
  const [saveConflict, setSaveConflict] = useState(null);
  const [showScenariosPanel, setShowScenariosPanel] = useState(false);
  const [showGitHub, setShowGitHub] = useState(false);

  // Service form
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState(null);
  const [serviceForm, setServiceForm] = useState({ name: '', base_url: '', auth_type: 'none', token: '', api_key: '', header_name: 'X-API-Key', username: '', password: '' });

  // Step form
  const [showStepForm, setShowStepForm] = useState(false);
  const [editingStepId, setEditingStepId] = useState(null);
  const [stepForm, setStepForm] = useState({ name: '', service_id: '', method: 'GET', endpoint: '', body: '', expected_status: 200, extractionName: '', extractionPath: '' });
  const [extractions, setExtractions] = useState([]);

  // Load saved scenarios on mount
  useEffect(() => {
    if (user) fetchSavedScenarios();
  }, [user]);

  const addLog = (message, type = 'info', serviceId = null) => {
    const ts = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { ts, message, type, serviceId }]);
  };

  // ── Service CRUD
  function buildAuthConfig() {
    switch (serviceForm.auth_type) {
      case 'bearer': return { type: 'bearer', token: serviceForm.token };
      case 'api_key': return { type: 'api_key', header_name: serviceForm.header_name, api_key: serviceForm.api_key };
      case 'basic': return { type: 'basic', username: serviceForm.username, password: serviceForm.password };
      default: return { type: 'none' };
    }
  }

  function handleSaveService() {
    if (!serviceForm.name.trim() || !serviceForm.base_url.trim()) return;
    const auth_config = buildAuthConfig();
    const base_url = serviceForm.base_url.trim();
    if (editingServiceId) {
      setServices(prev => prev.map(s => s.id === editingServiceId ? { ...s, name: serviceForm.name, base_url, auth_config } : s));
    } else {
      setServices(prev => [...prev, { id: genId(), name: serviceForm.name, base_url, auth_config }]);
    }
    setShowServiceForm(false);
    setEditingServiceId(null);
    setServiceForm({ name: '', base_url: '', auth_type: 'none', token: '', api_key: '', header_name: 'X-API-Key', username: '', password: '' });
  }

  function handleEditService(svc) {
    const at = svc.auth_config?.type || 'none';
    setServiceForm({
      name: svc.name,
      base_url: svc.base_url,
      auth_type: at,
      token: svc.auth_config?.token || '',
      api_key: svc.auth_config?.api_key || '',
      header_name: svc.auth_config?.header_name || 'X-API-Key',
      username: svc.auth_config?.username || '',
      password: svc.auth_config?.password || '',
    });
    setEditingServiceId(svc.id);
    setShowServiceForm(true);
  }

  function handleDeleteService(id) {
    setServices(prev => prev.filter(s => s.id !== id));
    setSteps(prev => prev.filter(st => st.service_id !== id));
  }

  // ── Step CRUD
  function handleSaveStep() {
    if (!stepForm.name.trim() || !stepForm.service_id) return;
    let bodyObj = null;
    if (stepForm.body.trim()) {
      try { bodyObj = JSON.parse(stepForm.body); } catch { bodyObj = null; }
    }
    const finalExtractions = [...extractions];
    if (stepForm.extractionName.trim() && stepForm.extractionPath.trim()) {
      finalExtractions.push({ name: stepForm.extractionName.trim(), jsonpath: stepForm.extractionPath.trim() });
    }
    const stepData = {
      id: editingStepId || genId(),
      service_id: stepForm.service_id,
      name: stepForm.name,
      method: stepForm.method,
      endpoint: stepForm.endpoint,
      body: bodyObj,
      expected_status: parseInt(stepForm.expected_status, 10) || 200,
      extractions: finalExtractions.filter(e => e.name && e.jsonpath),
      assertions: [],
    };
    if (editingStepId) {
      setSteps(prev => prev.map(s => s.id === editingStepId ? stepData : s));
    } else {
      setSteps(prev => [...prev, stepData]);
    }
    setShowStepForm(false);
    setEditingStepId(null);
    setStepForm({ name: '', service_id: '', method: 'GET', endpoint: '', body: '', expected_status: 200, extractionName: '', extractionPath: '' });
    setExtractions([]);
  }

  function handleEditStep(step) {
    setStepForm({
      name: step.name,
      service_id: step.service_id,
      method: step.method,
      endpoint: step.endpoint,
      body: step.body ? JSON.stringify(step.body, null, 2) : '',
      expected_status: step.expected_status,
      extractionName: '',
      extractionPath: '',
    });
    setExtractions(step.extractions || []);
    setEditingStepId(step.id);
    setShowStepForm(true);
  }

  function handleDeleteStep(id) {
    setSteps(prev => prev.filter(s => s.id !== id));
  }

  function addExtraction() {
    if (!stepForm.extractionName.trim() || !stepForm.extractionPath.trim()) return;
    setExtractions(prev => [...prev, { name: stepForm.extractionName.trim(), jsonpath: stepForm.extractionPath.trim() }]);
    setStepForm(prev => ({ ...prev, extractionName: '', extractionPath: '' }));
  }

  // ── Run
  async function handleRun() {
    if (services.length === 0 || steps.length === 0) {
      addLog('Add at least one service and one step before running.', 'error');
      return;
    }
    setIsRunning(true);
    setResults(null);
    setLogs([]);
    setActiveTab('logs');
    addLog('Starting integration test scenario...', 'info');

    try {
      const payload = {
        services: services.map(s => ({ id: s.id, name: s.name, base_url: s.base_url, auth_config: s.auth_config })),
        steps: steps.map(st => ({
          id: st.id,
          service_id: st.service_id,
          name: st.name,
          method: st.method,
          endpoint: st.endpoint,
          body: st.body || null,
          params: null,
          headers: null,
          expected_status: st.expected_status,
          extractions: st.extractions || [],
          assertions: st.assertions || [],
        })),
        timeout: 15,
      };

      const res = await apiFetch('/run-integration-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.results) {
        data.results.forEach(r => {
          const icon = r.status === 'PASS' ? '✓' : '✗';
          addLog(`[${r.service_name}] ${icon} ${r.step_name}: ${r.details}`, r.status === 'PASS' ? 'success' : 'error', r.service_id);
          if (r.extracted_vars && Object.keys(r.extracted_vars).length > 0) {
            Object.entries(r.extracted_vars).forEach(([k, v]) => {
              addLog(`[${r.service_name}] Extracted: ${k} = ${v}`, 'extract', r.service_id);
            });
          }
        });
      }

      addLog(`Done — ${data.summary?.passed}/${data.summary?.total} passed`, data.summary?.failed > 0 ? 'error' : 'success');
      setResults(data);
      setActiveTab('results');
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setIsRunning(false);
    }
  }

  // ── Scenario save/load
  async function handleSaveScenario(overwriteId = null) {
    if (!scenarioName.trim()) { addLog('Enter a scenario name first.', 'error'); return; }
    const existing = savedScenarios.find(s => s.name.trim().toLowerCase() === scenarioName.trim().toLowerCase());
    if (existing && !overwriteId) {
      setSaveConflict({ id: existing.id, name: existing.name });
      return;
    }
    try {
      if (overwriteId) {
        await apiFetch(`/integration-scenarios/${overwriteId}`, { method: 'DELETE' });
      }
      const res = await apiFetch('/integration-scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: scenarioName, description: '', services, steps }),
      });
      if (!res.ok) throw new Error(await res.text());
      addLog(`${overwriteId ? 'Updated' : 'Saved'} scenario: ${scenarioName}`, 'success');
      setSaveConflict(null);
      fetchSavedScenarios();
    } catch (err) {
      addLog(`Save failed: ${err.message}`, 'error');
      setSaveConflict(null);
    }
  }

  async function fetchSavedScenarios() {
    try {
      const res = await apiFetch('/integration-scenarios');
      if (res.ok) setSavedScenarios(await res.json());
    } catch { /* silent */ }
  }

  function handleLoadScenario(s) {
    setServices(s.services || []);
    setSteps(s.steps || []);
    setScenarioName(s.name);
    setSaveConflict(null);
    addLog(`Loaded scenario: ${s.name}`, 'success');
  }

  async function handleDeleteScenario(id) {
    try {
      await apiFetch(`/integration-scenarios/${id}`, { method: 'DELETE' });
      fetchSavedScenarios();
    } catch { /* silent */ }
  }

  // ── Helpers for available vars
  function getAvailableVars(beforeStepId) {
    const vars = [];
    for (const st of steps) {
      if (st.id === beforeStepId) break;
      (st.extractions || []).forEach(e => vars.push(e.name));
    }
    return vars;
  }

  const availableVars = editingStepId ? getAvailableVars(editingStepId) : getAvailableVars(null);

  // ── Log color helper
  function logColorStyle(type) {
    switch (type) {
      case 'success': return '#34d399';
      case 'error':   return '#f87171';
      case 'extract': return '#fde68a';
      default:        return 'rgba(255,255,255,0.6)';
    }
  }

  // ── Shared style tokens
  const card = {
    background: 'rgba(9,12,22,0.80)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 14,
    backdropFilter: 'blur(20px)',
    padding: 16,
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 8,
    padding: '8px 12px',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    boxSizing: 'border-box',
  };

  const smallLabel = {
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.38)',
    display: 'block',
    marginBottom: 4,
  };

  const btnRose = {
    background: 'linear-gradient(135deg,#be123c,#9f1239)',
    border: 'none', borderRadius: 10,
    padding: '12px 20px',
    color: '#fff', fontWeight: 700, fontSize: 16,
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    width: '100%',
  };

  const methodColor = { GET: '#34d399', POST: '#60a5fa', PUT: '#fbbf24', PATCH: '#a78bfa', DELETE: '#f87171' };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg,#020408 0%,#060c18 50%,#020408 100%)',
      fontFamily: 'Inter, system-ui, sans-serif',
      color: '#fff',
      position: 'relative',
    }}>
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .int-input:focus { border-color: ${ROSE_BORDER} !important; box-shadow: 0 0 0 3px ${ROSE_DIM}; }
        .int-card-hover:hover { border-color: rgba(251,113,133,0.20) !important; }
        .int-row-hover:hover { background: rgba(255,255,255,0.03) !important; }
      `}</style>

      {/* Dot grid */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        backgroundImage: 'radial-gradient(circle, rgba(251,113,133,0.07) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      {/* ── Sticky Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(2,4,8,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        height: 60,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{
          maxWidth: 1400, margin: '0 auto', width: '100%',
          padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BackButton />
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.10)' }} />
            <div style={{
              width: 34, height: 34, borderRadius: 9,
              background: 'linear-gradient(135deg,#be123c,#9f1239)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 0 14px rgba(251,113,133,0.30)`,
            }}>
              <Link2 size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>Integration Testing</div>
              <div style={{ fontSize: 13, color: 'rgba(251,113,133,0.7)' }}>Multi-service scenario validation</div>
            </div>
          </div>

          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 12px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: 8,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'linear-gradient(135deg,#be123c,#9f1239)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}>
                  {user.username?.charAt(0).toUpperCase()}
                </div>
                <span style={{ fontSize: 14, color: '#fff' }}>{user.username}</span>
              </div>
              <button
                onClick={onLogout}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 11px',
                  background: 'rgba(220,38,38,0.15)',
                  border: '1px solid rgba(220,38,38,0.28)',
                  borderRadius: 7, color: '#f87171',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer',
                }}
              >
                <LogOut size={12} /> Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Scenarios Manager Panel (full-screen overlay) */}
      {showScenariosPanel && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 60,
          background: 'rgba(2,4,8,0.96)',
          backdropFilter: 'blur(24px)',
          overflowY: 'auto',
        }}>
          <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px', position: 'relative', zIndex: 1 }}>
            {/* Overlay dot grid */}
            <div style={{
              position: 'fixed', inset: 0, pointerEvents: 'none',
              backgroundImage: 'radial-gradient(circle, rgba(251,113,133,0.06) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12,
                  background: 'linear-gradient(135deg,#059669,#047857)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 0 16px rgba(16,185,129,0.30)',
                }}>
                  <FolderOpen size={20} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>Saved Scenarios</div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                    {savedScenarios.length} scenario{savedScenarios.length !== 1 ? 's' : ''} saved
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowScenariosPanel(false)}
                style={{
                  padding: 8, borderRadius: 8,
                  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                  color: 'rgba(255,255,255,0.7)', cursor: 'pointer',
                  display: 'flex', alignItems: 'center',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {savedScenarios.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '64px 0' }}>
                <FolderOpen size={48} color="rgba(255,255,255,0.15)" style={{ margin: '0 auto 16px' }} />
                <div style={{ fontSize: 17, color: 'rgba(255,255,255,0.4)' }}>No scenarios saved yet.</div>
                <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Build a flow in the editor and save it.</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
                {savedScenarios.map(s => (
                  <div key={s.id} style={{
                    background: 'rgba(9,12,22,0.80)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 14, padding: 20,
                    backdropFilter: 'blur(20px)',
                    transition: 'border-color 0.2s',
                  }}
                  className="int-card-hover"
                  >
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ fontSize: 17, fontWeight: 700, color: '#fff', marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                      {s.description && <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description}</div>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                        <Server size={12} color={ROSE} /> {(s.services || []).length} service{(s.services || []).length !== 1 ? 's' : ''}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                        <List size={12} color="#60a5fa" /> {(s.steps || []).length} step{(s.steps || []).length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                      {(s.services || []).slice(0, 3).map((svc, idx) => {
                        const c = SERVICE_COLORS[idx % SERVICE_COLORS.length];
                        return (
                          <span key={svc.id} style={{
                            fontSize: 12, padding: '2px 8px', borderRadius: 99,
                            background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                          }}>
                            {svc.name}
                          </span>
                        );
                      })}
                      {(s.services || []).length > 3 && (
                        <span style={{
                          fontSize: 12, padding: '2px 8px', borderRadius: 99,
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.4)',
                        }}>
                          +{s.services.length - 3} more
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => { handleLoadScenario(s); setShowScenariosPanel(false); }}
                        style={{
                          flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 14, fontWeight: 600,
                          background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.30)', color: '#93c5fd',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        <FolderOpen size={13} /> Load
                      </button>
                      <button
                        onClick={() => handleDeleteScenario(s.id)}
                        style={{
                          padding: '8px 10px', borderRadius: 8,
                          background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.25)', color: '#f87171',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main two-column layout */}
      <div style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '24px 24px',
        display: 'flex', gap: 20, alignItems: 'flex-start',
        position: 'relative', zIndex: 1,
      }}>

        {/* ── LEFT PANEL */}
        <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Service Registry */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Server size={14} color={ROSE} />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Service Registry</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>({services.length})</span>
              </div>
              <button
                onClick={() => { setShowServiceForm(true); setEditingServiceId(null); setServiceForm({ name: '', base_url: '', auth_type: 'none', token: '', api_key: '', header_name: 'X-API-Key', username: '', password: '' }); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                  background: ROSE_DIM, border: `1px solid ${ROSE_BORDER}`, color: ROSE, cursor: 'pointer',
                }}
              >
                <Plus size={11} /> Add Service
              </button>
            </div>

            {services.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>
                No services registered. Add one to start.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {services.map((svc, idx) => {
                const c = SERVICE_COLORS[idx % SERVICE_COLORS.length];
                return (
                  <div key={svc.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 12px', borderRadius: 8,
                    background: c.bg, border: `1px solid ${c.border}`,
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                        <span style={{ fontSize: 15, fontWeight: 600, color: c.text }}>{svc.name}</span>
                      </div>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', display: 'block', marginLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{svc.base_url}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 8 }}>
                      <button onClick={() => handleEditService(svc)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDeleteService(svc.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Service Form */}
            {showServiceForm && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{editingServiceId ? 'Edit Service' : 'New Service'}</span>
                  <button onClick={() => setShowServiceForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                    <X size={13} />
                  </button>
                </div>
                <input
                  style={inputStyle} placeholder="Service name (e.g. Auth Service)"
                  value={serviceForm.name} onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))}
                  className="int-input"
                />
                <input
                  style={inputStyle} placeholder="Base URL (e.g. https://api.example.com)"
                  value={serviceForm.base_url} onChange={e => setServiceForm(p => ({ ...p, base_url: e.target.value }))}
                  className="int-input"
                />
                <select
                  style={{ ...inputStyle, appearance: 'none' }}
                  value={serviceForm.auth_type} onChange={e => setServiceForm(p => ({ ...p, auth_type: e.target.value }))}
                  className="int-input"
                >
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key">API Key</option>
                  <option value="basic">Basic Auth</option>
                </select>
                {serviceForm.auth_type === 'bearer' && (
                  <input style={inputStyle} className="int-input" placeholder="Bearer token" value={serviceForm.token} onChange={e => setServiceForm(p => ({ ...p, token: e.target.value }))} />
                )}
                {serviceForm.auth_type === 'api_key' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inputStyle, flex: 1 }} className="int-input" placeholder="Header name" value={serviceForm.header_name} onChange={e => setServiceForm(p => ({ ...p, header_name: e.target.value }))} />
                    <input style={{ ...inputStyle, flex: 1 }} className="int-input" placeholder="API key value" value={serviceForm.api_key} onChange={e => setServiceForm(p => ({ ...p, api_key: e.target.value }))} />
                  </div>
                )}
                {serviceForm.auth_type === 'basic' && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input style={{ ...inputStyle, flex: 1 }} className="int-input" placeholder="Username" value={serviceForm.username} onChange={e => setServiceForm(p => ({ ...p, username: e.target.value }))} />
                    <input style={{ ...inputStyle, flex: 1 }} className="int-input" placeholder="Password" type="password" value={serviceForm.password} onChange={e => setServiceForm(p => ({ ...p, password: e.target.value }))} />
                  </div>
                )}
                <button
                  onClick={handleSaveService}
                  style={{
                    padding: '8px 0', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    background: 'linear-gradient(135deg,#be123c,#9f1239)', border: 'none',
                    color: '#fff', cursor: 'pointer',
                  }}
                >
                  {editingServiceId ? 'Update Service' : 'Save Service'}
                </button>
              </div>
            )}
          </div>

          {/* ── Scenario Steps */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Layers size={14} color="#60a5fa" />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Scenario Steps</span>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>({steps.length})</span>
              </div>
              <button
                onClick={() => { setShowStepForm(true); setEditingStepId(null); setStepForm({ name: '', service_id: services[0]?.id || '', method: 'GET', endpoint: '', body: '', expected_status: 200, extractionName: '', extractionPath: '' }); setExtractions([]); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '4px 10px', fontSize: 13, fontWeight: 600, borderRadius: 6,
                  background: 'rgba(96,165,250,0.14)', border: '1px solid rgba(96,165,250,0.30)', color: '#93c5fd', cursor: 'pointer',
                }}
              >
                <Plus size={11} /> Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 14, color: 'rgba(255,255,255,0.25)' }}>
                No steps defined. Add a step to build your scenario.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {steps.map((step, idx) => {
                const svc = services.find(s => s.id === step.service_id);
                const c = svc ? getServiceColor(services, svc.id) : SERVICE_COLORS[0];
                return (
                  <div key={step.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', width: 18, flexShrink: 0 }}>{idx + 1}.</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{step.name}</span>
                        {svc && <ServiceBadge label={svc.name} color={c} />}
                      </div>
                      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                        <span style={{ color: methodColor[step.method] || '#fff' }}>{step.method}</span>
                        {' '}{step.endpoint || '/'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                      <button onClick={() => handleEditStep(step)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDeleteStep(step.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step Form */}
            {showStepForm && (
              <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{editingStepId ? 'Edit Step' : 'New Step'}</span>
                  <button onClick={() => setShowStepForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.4)', display: 'flex' }}>
                    <X size={13} />
                  </button>
                </div>
                <input
                  style={inputStyle} className="int-input"
                  placeholder="Step name (e.g. Login and get token)"
                  value={stepForm.name} onChange={e => setStepForm(p => ({ ...p, name: e.target.value }))}
                />
                <select
                  style={{ ...inputStyle, appearance: 'none' }} className="int-input"
                  value={stepForm.service_id} onChange={e => setStepForm(p => ({ ...p, service_id: e.target.value }))}
                >
                  <option value="">-- Select Service --</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    style={{ ...inputStyle, width: 'auto', flex: '0 0 auto' }} className="int-input"
                    value={stepForm.method} onChange={e => setStepForm(p => ({ ...p, method: e.target.value }))}
                  >
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input
                    style={{ ...inputStyle, flex: 1 }} className="int-input"
                    placeholder="Endpoint (e.g. /auth/login or /users/{{userId}})"
                    value={stepForm.endpoint} onChange={e => setStepForm(p => ({ ...p, endpoint: e.target.value }))}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <label style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>Expected status</label>
                  <input
                    type="number" style={{ ...inputStyle, width: 80 }} className="int-input"
                    value={stepForm.expected_status} onChange={e => setStepForm(p => ({ ...p, expected_status: e.target.value }))}
                  />
                </div>
                <textarea
                  style={{ ...inputStyle, height: 72, fontFamily: 'monospace', fontSize: 13, resize: 'vertical' }}
                  className="int-input"
                  rows={3}
                  placeholder='Request body (JSON, optional). Use {{varName}} for variables.'
                  value={stepForm.body} onChange={e => setStepForm(p => ({ ...p, body: e.target.value }))}
                />

                {/* Available vars hint */}
                {availableVars.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Available vars:</span>
                    {availableVars.map(v => (
                      <span key={v} style={{
                        fontSize: 12, fontFamily: 'monospace', padding: '1px 6px',
                        background: 'rgba(253,230,138,0.10)', border: '1px solid rgba(253,230,138,0.20)',
                        borderRadius: 4, color: '#fde68a',
                      }}>{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}

                {/* Extractions */}
                <div>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6 }}>Variable Extractions (JSONPath)</span>
                  {extractions.map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontFamily: 'monospace', color: '#fde68a', flex: 1 }}>{e.name} ← {e.jsonpath}</span>
                      <button onClick={() => setExtractions(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.35)', display: 'flex' }}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input
                      style={{ ...inputStyle, flex: 1, fontSize: 13, padding: '6px 10px' }} className="int-input"
                      placeholder="Var name (e.g. token)"
                      value={stepForm.extractionName} onChange={e => setStepForm(p => ({ ...p, extractionName: e.target.value }))}
                    />
                    <input
                      style={{ ...inputStyle, flex: 1, fontSize: 13, padding: '6px 10px' }} className="int-input"
                      placeholder="JSONPath (e.g. $.token)"
                      value={stepForm.extractionPath} onChange={e => setStepForm(p => ({ ...p, extractionPath: e.target.value }))}
                    />
                    <button
                      onClick={addExtraction}
                      style={{
                        padding: '6px 10px', borderRadius: 6,
                        background: 'rgba(253,230,138,0.12)', border: '1px solid rgba(253,230,138,0.25)',
                        color: '#fde68a', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                      }}
                    >+</button>
                  </div>
                </div>

                <button
                  onClick={handleSaveStep}
                  style={{
                    padding: '9px 0', borderRadius: 8, fontSize: 15, fontWeight: 700,
                    background: 'linear-gradient(135deg,#1d4ed8,#1e40af)', border: 'none',
                    color: '#fff', cursor: 'pointer',
                  }}
                >
                  {editingStepId ? 'Update Step' : 'Add Step'}
                </button>
              </div>
            )}
          </div>

          {/* ── Scenario Management */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Save size={14} color="#34d399" />
                <span style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Scenario Management</span>
              </div>
              {savedScenarios.length > 0 && (
                <button
                  onClick={() => setShowScenariosPanel(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 13, color: '#93c5fd', background: 'none', border: 'none', cursor: 'pointer',
                  }}
                >
                  <List size={12} /> View All ({savedScenarios.length})
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                style={{ ...inputStyle, flex: 1 }} className="int-input"
                placeholder="Scenario name"
                value={scenarioName} onChange={e => { setScenarioName(e.target.value); setSaveConflict(null); }}
              />
              <button
                onClick={() => handleSaveScenario()}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.28)',
                  color: '#6ee7b7', fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <Save size={12} /> Save
              </button>
            </div>

            {/* Save conflict resolution */}
            {saveConflict && (
              <div style={{
                marginBottom: 12, padding: 12, borderRadius: 10,
                background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
              }}>
                <p style={{ fontSize: 14, color: '#fde68a', marginBottom: 10 }}>
                  <span style={{ fontWeight: 700 }}>"{saveConflict.name}"</span> already exists. What do you want to do?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleSaveScenario(saveConflict.id)}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 13, fontWeight: 700,
                      background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.30)',
                      color: '#fde68a', cursor: 'pointer',
                    }}
                  >
                    Update Existing
                  </button>
                  <button
                    onClick={() => { setSaveConflict(null); setScenarioName(scenarioName + ' (copy)'); }}
                    style={{
                      flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 13, fontWeight: 700,
                      background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)',
                      color: 'rgba(255,255,255,0.6)', cursor: 'pointer',
                    }}
                  >
                    Save as New
                  </button>
                  <button
                    onClick={() => setSaveConflict(null)}
                    style={{
                      padding: '6px 10px', borderRadius: 6, fontSize: 13,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {savedScenarios.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Saved scenarios</span>
                {savedScenarios.map(s => (
                  <div key={s.id} className="int-row-hover" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', borderRadius: 8,
                    background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                  }}>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => handleLoadScenario(s)}
                        style={{
                          padding: '3px 8px', borderRadius: 5, fontSize: 13,
                          background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.28)',
                          color: '#93c5fd', cursor: 'pointer',
                        }}
                      >Load</button>
                      <button onClick={() => handleDeleteScenario(s.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', padding: 2, display: 'flex' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Run Button */}
          <button
            onClick={handleRun}
            disabled={isRunning || services.length === 0 || steps.length === 0}
            style={{
              ...btnRose,
              opacity: (isRunning || services.length === 0 || steps.length === 0) ? 0.45 : 1,
              cursor: (isRunning || services.length === 0 || steps.length === 0) ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 20px rgba(251,113,133,0.25)',
            }}
          >
            {isRunning
              ? <><div style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Running...</>
              : <><Play size={16} /> Run Integration Tests</>
            }
          </button>
        </div>

        {/* ── RIGHT PANEL */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Tab bar */}
          <div style={{
            display: 'flex', gap: 4, marginBottom: 16,
            background: 'rgba(9,12,22,0.80)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: 4,
            backdropFilter: 'blur(20px)',
          }}>
            {['results', 'logs'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1, padding: '9px 0', borderRadius: 8,
                  fontSize: 15, fontWeight: 600,
                  background: activeTab === tab ? 'linear-gradient(135deg,#be123c,#9f1239)' : 'transparent',
                  border: activeTab === tab ? 'none' : 'none',
                  color: activeTab === tab ? '#fff' : 'rgba(255,255,255,0.45)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  textTransform: 'capitalize',
                  boxShadow: activeTab === tab ? '0 2px 10px rgba(251,113,133,0.25)' : 'none',
                }}
              >
                {tab === 'results' ? 'Results' : 'Logs'}
              </button>
            ))}
            {results && (
              <button
                onClick={() => setShowGitHub(true)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  padding: '0 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
                  color: 'rgba(255,255,255,0.65)', cursor: 'pointer',
                }}
              >
                <Github size={14} /> Save to GitHub
              </button>
            )}
          </div>

          {/* ── Results Tab */}
          {activeTab === 'results' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Empty state */}
              {!results && !isRunning && (
                <div style={{
                  ...card,
                  textAlign: 'center', padding: '80px 20px',
                }}>
                  <Link2 size={40} color="rgba(255,255,255,0.12)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.35)' }}>Configure your services and steps, then click Run.</div>
                </div>
              )}

              {/* Running state */}
              {isRunning && (
                <div style={{
                  ...card,
                  textAlign: 'center', padding: '80px 20px',
                }}>
                  <div style={{ width: 40, height: 40, border: `3px solid ${ROSE_DIM}`, borderTopColor: ROSE, borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                  <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)' }}>Executing integration scenario...</div>
                </div>
              )}

              {results && (
                <>
                  {/* Overall summary */}
                  <div style={card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <span style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Overall Summary</span>
                      <span style={{
                        fontSize: 16, fontWeight: 800,
                        color: results.summary.failed > 0 ? '#f87171' : '#34d399',
                      }}>
                        {results.summary.pass_rate}% pass rate
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 24, marginBottom: 14 }}>
                      {[
                        { val: results.summary.total,  label: 'Total',  color: '#fff'     },
                        { val: results.summary.passed, label: 'Passed', color: '#34d399'  },
                        { val: results.summary.failed, label: 'Failed', color: '#f87171'  },
                      ].map(({ val, label, color }) => (
                        <div key={label} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 26, fontWeight: 800, color }}>{val}</div>
                          <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Progress bar */}
                    <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', borderRadius: 99,
                        background: results.summary.failed > 0
                          ? 'linear-gradient(90deg,#f87171,#ef4444)'
                          : 'linear-gradient(90deg,#34d399,#10b981)',
                        width: `${results.summary.pass_rate}%`,
                        transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>

                  {/* Per-service summary */}
                  {results.service_summaries && Object.keys(results.service_summaries).length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                      {Object.entries(results.service_summaries).map(([svcId, svcSum]) => {
                        const c = getServiceColor(services, svcId);
                        const rate = svcSum.total > 0 ? Math.round(svcSum.passed / svcSum.total * 100) : 0;
                        return (
                          <div key={svcId} style={{
                            borderRadius: 12, padding: 14,
                            background: c.bg, border: `1px solid ${c.border}`,
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.dot }} />
                              <span style={{ fontSize: 14, fontWeight: 700, color: c.text }}>{svcSum.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                              <span style={{ fontSize: 22, fontWeight: 800, color: '#fff' }}>{svcSum.passed}</span>
                              <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>/ {svcSum.total} passed</span>
                            </div>
                            <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{
                                height: '100%', borderRadius: 99,
                                background: rate === 100 ? '#34d399' : rate >= 50 ? '#fbbf24' : '#f87171',
                                width: `${rate}%`,
                              }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Step-by-step results */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {results.results.map((r, idx) => {
                      const c = getServiceColor(services, r.service_id);
                      const isExpanded = expandedResults[r.step_id];
                      const hasExtracted = r.extracted_vars && Object.keys(r.extracted_vars).length > 0;
                      return (
                        <div key={r.step_id || idx} style={{
                          background: 'rgba(9,12,22,0.80)',
                          border: '1px solid rgba(255,255,255,0.07)',
                          borderRadius: 12, overflow: 'hidden',
                          backdropFilter: 'blur(20px)',
                        }}>
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                            className="int-row-hover"
                            onClick={() => setExpandedResults(prev => ({ ...prev, [r.step_id]: !prev[r.step_id] }))}
                          >
                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.30)', width: 18, flexShrink: 0 }}>{idx + 1}</span>
                            {r.status === 'PASS'
                              ? <CheckCircle size={15} color="#34d399" style={{ flexShrink: 0 }} />
                              : <XCircle size={15} color="#f87171" style={{ flexShrink: 0 }} />
                            }
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
                                <span style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{r.step_name}</span>
                                <ServiceBadge label={r.service_name} color={c} />
                                {hasExtracted && (
                                  <span style={{
                                    fontSize: 12, padding: '1px 6px', borderRadius: 4,
                                    background: 'rgba(253,230,138,0.10)', border: '1px solid rgba(253,230,138,0.20)',
                                    color: '#fde68a', display: 'inline-flex', alignItems: 'center', gap: 3,
                                  }}>
                                    <Variable size={9} /> {Object.keys(r.extracted_vars).length} var{Object.keys(r.extracted_vars).length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>{r.details}</span>
                            </div>
                            <span style={{
                              fontSize: 13, fontWeight: 800,
                              padding: '3px 8px', borderRadius: 6, flexShrink: 0,
                              background: r.status === 'PASS' ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)',
                              color: r.status === 'PASS' ? '#34d399' : '#f87171',
                            }}>
                              {r.status}
                            </span>
                            {(hasExtracted || r.ai_analysis) && (
                              isExpanded
                                ? <ChevronUp size={13} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
                                : <ChevronDown size={13} color="rgba(255,255,255,0.4)" style={{ flexShrink: 0 }} />
                            )}
                          </div>

                          {isExpanded && (
                            <div style={{
                              padding: '12px 16px 14px',
                              borderTop: '1px solid rgba(255,255,255,0.05)',
                              display: 'flex', flexDirection: 'column', gap: 12,
                            }}>
                              {hasExtracted && (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                    <Variable size={11} color="#fde68a" />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fde68a' }}>Extracted Variables</span>
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                    {Object.entries(r.extracted_vars).map(([k, v]) => (
                                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'monospace', fontSize: 14 }}>
                                        <span style={{ color: '#fde68a' }}>{k}</span>
                                        <span style={{ color: 'rgba(255,255,255,0.35)' }}>=</span>
                                        <span style={{ color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.ai_analysis && (
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8 }}>
                                    <AlertCircle size={11} color="#fb923c" />
                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fb923c' }}>AI Analysis</span>
                                  </div>
                                  <p style={{
                                    fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0,
                                    background: 'rgba(249,115,22,0.05)', border: '1px solid rgba(249,115,22,0.15)',
                                    borderRadius: 8, padding: '10px 12px',
                                  }}>{r.ai_analysis}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Logs Tab */}
          {activeTab === 'logs' && (
            <div style={{
              background: 'rgba(4,6,14,0.90)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 14,
              backdropFilter: 'blur(20px)',
              overflow: 'hidden',
            }}>
              {/* Terminal header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840' }} />
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', marginLeft: 8, fontFamily: 'monospace' }}>integration-runner.log</span>
              </div>

              <div style={{ padding: 16, fontFamily: 'monospace', fontSize: 13, minHeight: 400, maxHeight: '70vh', overflowY: 'auto' }}>
                {logs.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(255,255,255,0.25)' }}>
                    Logs will appear here when you run a scenario.
                  </div>
                )}
                {logs.map((log, i) => {
                  const svcColor = log.serviceId ? getServiceColor(services, log.serviceId) : null;
                  const svcName = svcColor ? services.find(s => s.id === log.serviceId)?.name : null;
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '2px 0' }}>
                      <span style={{ color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{log.ts}</span>
                      {svcColor && svcName && (
                        <span style={{
                          fontSize: 12, padding: '0px 5px', borderRadius: 3, flexShrink: 0,
                          background: svcColor.bg, color: svcColor.text,
                        }}>{svcName}</span>
                      )}
                      <span style={{ color: logColorStyle(log.type) }}>{log.message}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {showGitHub && results && (
        <GitHubIntegration
          user={user}
          testResults={results}
          apiUrl={scenarioName?.trim() || `${services.length} service(s) · ${steps.length} step(s)`}
          onClose={() => setShowGitHub(false)}
        />
      )}
    </div>
  );
}
