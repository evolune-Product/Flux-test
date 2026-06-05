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
  Home,
  Save,
  FolderOpen,
  ArrowLeft,
  Server,
  Layers,
  Clock,
  Variable,
  AlertCircle,
  Edit2,
  X
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Color palette per service index
const SERVICE_COLORS = [
  { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-300', dot: 'bg-blue-400' },
  { bg: 'bg-purple-500/20', border: 'border-purple-500/40', text: 'text-purple-300', dot: 'bg-purple-400' },
  { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  { bg: 'bg-orange-500/20', border: 'border-orange-500/40', text: 'text-orange-300', dot: 'bg-orange-400' },
  { bg: 'bg-pink-500/20', border: 'border-pink-500/40', text: 'text-pink-300', dot: 'bg-pink-400' },
  { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-300', dot: 'bg-cyan-400' },
];

function getServiceColor(services, serviceId) {
  const idx = services.findIndex(s => s.id === serviceId);
  return SERVICE_COLORS[idx % SERVICE_COLORS.length] || SERVICE_COLORS[0];
}

function genId() {
  return Math.random().toString(36).slice(2, 10);
}

// ── Small reusable badge
function ServiceBadge({ label, color }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${color.bg} ${color.border} ${color.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${color.dot}`} />
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
  const [saveConflict, setSaveConflict] = useState(null); // { id, name }

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
    // Auto-commit any extraction that was typed but + not clicked
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

      const res = await fetch(`${API_BASE_URL}/run-integration-tests`, {
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
      const token = localStorage.getItem('token');
      // Overwrite: delete old first
      if (overwriteId) {
        await fetch(`${API_BASE_URL}/integration-scenarios/${overwriteId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      }
      const res = await fetch(`${API_BASE_URL}/integration-scenarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/integration-scenarios`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
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
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE_URL}/integration-scenarios/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
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
  function logColor(type) {
    switch (type) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'extract': return 'text-yellow-300';
      default: return 'text-gray-300';
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-950 to-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl border-b border-white/10 bg-slate-900/70">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-sm">
              <ArrowLeft size={16} />
              <Home size={16} />
            </button>
            <div className="w-px h-5 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Link2 size={16} className="text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-white">Integration Testing</h1>
                <p className="text-[10px] text-gray-400">Multi-service scenario validation</p>
              </div>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 hidden sm:block">{user.username}</span>
              <button onClick={onLogout} className="text-xs text-red-400 hover:text-red-300 transition-colors px-3 py-1.5 rounded border border-red-500/30 hover:border-red-400/50">
                Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main two-column layout */}
      <div className="max-w-screen-2xl mx-auto px-4 py-6 flex gap-6 items-start">

        {/* ── LEFT PANEL */}
        <div className="w-[420px] flex-shrink-0 space-y-4">

          {/* Service Registry */}
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Server size={15} className="text-purple-400" />
                <span className="text-sm font-semibold text-white">Service Registry</span>
                <span className="text-xs text-gray-500">({services.length})</span>
              </div>
              <button
                onClick={() => { setShowServiceForm(true); setEditingServiceId(null); setServiceForm({ name: '', base_url: '', auth_type: 'none', token: '', api_key: '', header_name: 'X-API-Key', username: '', password: '' }); }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-purple-600/30 border border-purple-500/40 text-purple-300 hover:bg-purple-600/50 transition-colors"
              >
                <Plus size={12} /> Add Service
              </button>
            </div>

            {/* Service list */}
            {services.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No services registered. Add one to start.</p>
            )}
            <div className="space-y-2">
              {services.map((svc, idx) => {
                const c = SERVICE_COLORS[idx % SERVICE_COLORS.length];
                return (
                  <div key={svc.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${c.bg} ${c.border}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                        <span className={`text-sm font-medium ${c.text}`}>{svc.name}</span>
                      </div>
                      <span className="text-xs text-gray-400 truncate block ml-4">{svc.base_url}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button onClick={() => handleEditService(svc)} className="p-1 text-gray-400 hover:text-white transition-colors">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => handleDeleteService(svc.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Service Form */}
            {showServiceForm && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-300">{editingServiceId ? 'Edit Service' : 'New Service'}</span>
                  <button onClick={() => setShowServiceForm(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                </div>
                <input
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  placeholder="Service name (e.g. Auth Service)"
                  value={serviceForm.name}
                  onChange={e => setServiceForm(p => ({ ...p, name: e.target.value }))}
                />
                <input
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50"
                  placeholder="Base URL (e.g. https://api.example.com)"
                  value={serviceForm.base_url}
                  onChange={e => setServiceForm(p => ({ ...p, base_url: e.target.value }))}
                />
                <select
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-purple-500/50"
                  value={serviceForm.auth_type}
                  onChange={e => setServiceForm(p => ({ ...p, auth_type: e.target.value }))}
                >
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="api_key">API Key</option>
                  <option value="basic">Basic Auth</option>
                </select>
                {serviceForm.auth_type === 'bearer' && (
                  <input className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" placeholder="Bearer token" value={serviceForm.token} onChange={e => setServiceForm(p => ({ ...p, token: e.target.value }))} />
                )}
                {serviceForm.auth_type === 'api_key' && (
                  <div className="flex gap-2">
                    <input className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" placeholder="Header name" value={serviceForm.header_name} onChange={e => setServiceForm(p => ({ ...p, header_name: e.target.value }))} />
                    <input className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" placeholder="API key value" value={serviceForm.api_key} onChange={e => setServiceForm(p => ({ ...p, api_key: e.target.value }))} />
                  </div>
                )}
                {serviceForm.auth_type === 'basic' && (
                  <div className="flex gap-2">
                    <input className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" placeholder="Username" value={serviceForm.username} onChange={e => setServiceForm(p => ({ ...p, username: e.target.value }))} />
                    <input className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500/50" placeholder="Password" type="password" value={serviceForm.password} onChange={e => setServiceForm(p => ({ ...p, password: e.target.value }))} />
                  </div>
                )}
                <button onClick={handleSaveService} className="w-full py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 transition-colors text-sm font-medium text-white">
                  {editingServiceId ? 'Update Service' : 'Save Service'}
                </button>
              </div>
            )}
          </div>

          {/* Scenario Steps */}
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-blue-400" />
                <span className="text-sm font-semibold text-white">Scenario Steps</span>
                <span className="text-xs text-gray-500">({steps.length})</span>
              </div>
              <button
                onClick={() => { setShowStepForm(true); setEditingStepId(null); setStepForm({ name: '', service_id: services[0]?.id || '', method: 'GET', endpoint: '', body: '', expected_status: 200, extractionName: '', extractionPath: '' }); setExtractions([]); }}
                className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-600/30 border border-blue-500/40 text-blue-300 hover:bg-blue-600/50 transition-colors"
              >
                <Plus size={12} /> Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-4">No steps defined. Add a step to build your scenario.</p>
            )}
            <div className="space-y-2">
              {steps.map((step, idx) => {
                const svc = services.find(s => s.id === step.service_id);
                const c = svc ? getServiceColor(services, svc.id) : SERVICE_COLORS[0];
                return (
                  <div key={step.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-900/40 border border-white/5">
                    <span className="text-xs text-gray-500 w-5 flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-white font-medium truncate">{step.name}</span>
                        {svc && <ServiceBadge label={svc.name} color={c} />}
                      </div>
                      <span className="text-xs text-gray-500">{step.method} {step.endpoint || '/'}</span>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button onClick={() => handleEditStep(step)} className="p-1 text-gray-400 hover:text-white transition-colors"><Edit2 size={13} /></button>
                      <button onClick={() => handleDeleteStep(step.id)} className="p-1 text-gray-400 hover:text-red-400 transition-colors"><Trash2 size={13} /></button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Step Form */}
            {showStepForm && (
              <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-gray-300">{editingStepId ? 'Edit Step' : 'New Step'}</span>
                  <button onClick={() => setShowStepForm(false)} className="text-gray-500 hover:text-white"><X size={14} /></button>
                </div>
                <input
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                  placeholder="Step name (e.g. Login and get token)"
                  value={stepForm.name}
                  onChange={e => setStepForm(p => ({ ...p, name: e.target.value }))}
                />
                <select
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                  value={stepForm.service_id}
                  onChange={e => setStepForm(p => ({ ...p, service_id: e.target.value }))}
                >
                  <option value="">-- Select Service --</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <select
                    className="bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    value={stepForm.method}
                    onChange={e => setStepForm(p => ({ ...p, method: e.target.value }))}
                  >
                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
                  </select>
                  <input
                    className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                    placeholder="Endpoint (e.g. /auth/login or /users/{{userId}})"
                    value={stepForm.endpoint}
                    onChange={e => setStepForm(p => ({ ...p, endpoint: e.target.value }))}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-400 whitespace-nowrap">Expected status</label>
                  <input
                    type="number"
                    className="w-20 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500/50"
                    value={stepForm.expected_status}
                    onChange={e => setStepForm(p => ({ ...p, expected_status: e.target.value }))}
                  />
                </div>
                <textarea
                  className="w-full bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 font-mono resize-none"
                  rows={3}
                  placeholder='Request body (JSON, optional). Use {{varName}} for variables.'
                  value={stepForm.body}
                  onChange={e => setStepForm(p => ({ ...p, body: e.target.value }))}
                />

                {/* Available vars hint */}
                {availableVars.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    <span className="text-[10px] text-gray-500">Available vars:</span>
                    {availableVars.map(v => (
                      <span key={v} className="text-[10px] font-mono px-1.5 py-0.5 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-300">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}

                {/* Extractions */}
                <div>
                  <span className="text-xs font-medium text-gray-300 block mb-1">Variable Extractions (JSONPath)</span>
                  {extractions.map((e, i) => (
                    <div key={i} className="flex items-center gap-1 mb-1">
                      <span className="text-xs font-mono text-yellow-300 flex-1">{e.name} ← {e.jsonpath}</span>
                      <button onClick={() => setExtractions(prev => prev.filter((_, j) => j !== i))} className="text-gray-500 hover:text-red-400"><X size={12} /></button>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <input
                      className="flex-1 bg-slate-900/60 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                      placeholder="Var name (e.g. token)"
                      value={stepForm.extractionName}
                      onChange={e => setStepForm(p => ({ ...p, extractionName: e.target.value }))}
                    />
                    <input
                      className="flex-1 bg-slate-900/60 border border-white/10 rounded px-2 py-1 text-xs text-white placeholder-gray-500 focus:outline-none"
                      placeholder="JSONPath (e.g. $.token)"
                      value={stepForm.extractionPath}
                      onChange={e => setStepForm(p => ({ ...p, extractionPath: e.target.value }))}
                    />
                    <button onClick={addExtraction} className="px-2 py-1 rounded bg-yellow-600/30 border border-yellow-500/30 text-yellow-300 text-xs hover:bg-yellow-600/50">+</button>
                  </div>
                </div>

                <button onClick={handleSaveStep} className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-medium text-white">
                  {editingStepId ? 'Update Step' : 'Add Step'}
                </button>
              </div>
            )}
          </div>

          {/* Scenario Management */}
          <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Save size={15} className="text-green-400" />
              <span className="text-sm font-semibold text-white">Scenario Management</span>
            </div>
            <div className="flex gap-2 mb-2">
              <input
                className="flex-1 bg-slate-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500/50"
                placeholder="Scenario name"
                value={scenarioName}
                onChange={e => { setScenarioName(e.target.value); setSaveConflict(null); }}
              />
              <button onClick={() => handleSaveScenario()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-600/30 border border-green-500/40 text-green-300 text-sm hover:bg-green-600/50 transition-colors">
                <Save size={13} /> Save
              </button>
            </div>
            {saveConflict && (
              <div className="mb-3 p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-xs text-yellow-300 mb-2">
                  <span className="font-semibold">"{saveConflict.name}"</span> already exists. What do you want to do?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveScenario(saveConflict.id)}
                    className="flex-1 py-1 text-xs rounded bg-yellow-600/30 border border-yellow-500/40 text-yellow-300 hover:bg-yellow-600/50 transition-colors font-medium"
                  >
                    Update Existing
                  </button>
                  <button
                    onClick={() => { setSaveConflict(null); setScenarioName(scenarioName + ' (copy)'); }}
                    className="flex-1 py-1 text-xs rounded bg-slate-700/50 border border-white/10 text-gray-300 hover:bg-slate-700 transition-colors font-medium"
                  >
                    Save as New
                  </button>
                  <button
                    onClick={() => setSaveConflict(null)}
                    className="px-2 py-1 text-xs rounded bg-slate-700/50 border border-white/10 text-gray-400 hover:text-white transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {savedScenarios.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-xs text-gray-500">Saved scenarios</span>
                {savedScenarios.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-900/40 border border-white/5">
                    <span className="text-xs text-gray-300 truncate flex-1">{s.name}</span>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      <button onClick={() => handleLoadScenario(s)} className="px-2 py-0.5 text-xs rounded bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/40 transition-colors">Load</button>
                      <button onClick={() => handleDeleteScenario(s.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors"><Trash2 size={12} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Run Button */}
          <button
            onClick={handleRun}
            disabled={isRunning || services.length === 0 || steps.length === 0}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-white font-semibold flex items-center justify-center gap-2 shadow-lg"
          >
            {isRunning ? <><Loader size={18} className="animate-spin" /> Running...</> : <><Play size={18} /> Run Integration Tests</>}
          </button>
        </div>

        {/* ── RIGHT PANEL */}
        <div className="flex-1 min-w-0">
          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-800/50 border border-white/10 rounded-xl p-1">
            {['results', 'logs'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg capitalize transition-all ${activeTab === tab ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-white'}`}
              >
                {tab === 'results' ? 'Results' : 'Logs'}
              </button>
            ))}
          </div>

          {/* Results Tab */}
          {activeTab === 'results' && (
            <div className="space-y-4">
              {!results && !isRunning && (
                <div className="text-center py-20 text-gray-500">
                  <Link2 size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Configure your services and steps, then click Run.</p>
                </div>
              )}
              {isRunning && (
                <div className="text-center py-20">
                  <Loader size={40} className="mx-auto mb-3 animate-spin text-purple-400" />
                  <p className="text-sm text-gray-400">Executing integration scenario...</p>
                </div>
              )}
              {results && (
                <>
                  {/* Overall summary */}
                  <div className="bg-slate-800/50 border border-white/10 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-semibold text-white">Overall Summary</span>
                      <span className={`text-sm font-bold ${results.summary.failed > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        {results.summary.pass_rate}% pass rate
                      </span>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-white">{results.summary.total}</div>
                        <div className="text-xs text-gray-400">Total</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-400">{results.summary.passed}</div>
                        <div className="text-xs text-gray-400">Passed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-400">{results.summary.failed}</div>
                        <div className="text-xs text-gray-400">Failed</div>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full transition-all"
                        style={{ width: `${results.summary.pass_rate}%` }}
                      />
                    </div>
                  </div>

                  {/* Per-service summary */}
                  {results.service_summaries && Object.keys(results.service_summaries).length > 0 && (
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(results.service_summaries).map(([svcId, svcSum]) => {
                        const c = getServiceColor(services, svcId);
                        const rate = svcSum.total > 0 ? Math.round(svcSum.passed / svcSum.total * 100) : 0;
                        return (
                          <div key={svcId} className={`rounded-xl p-3 border ${c.bg} ${c.border}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                              <span className={`text-sm font-medium ${c.text}`}>{svcSum.name}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                              <span className="text-xl font-bold text-white">{svcSum.passed}</span>
                              <span className="text-sm text-gray-400">/ {svcSum.total} passed</span>
                            </div>
                            <div className="mt-1.5 h-1 bg-slate-700 rounded-full overflow-hidden">
                              <div className={`h-full rounded-full ${rate === 100 ? 'bg-emerald-400' : rate >= 50 ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${rate}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Step-by-step results */}
                  <div className="space-y-2">
                    {results.results.map((r, idx) => {
                      const c = getServiceColor(services, r.service_id);
                      const isExpanded = expandedResults[r.step_id];
                      const hasExtracted = r.extracted_vars && Object.keys(r.extracted_vars).length > 0;
                      return (
                        <div key={r.step_id || idx} className="bg-slate-800/50 border border-white/10 rounded-xl overflow-hidden">
                          <div
                            className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5 transition-colors"
                            onClick={() => setExpandedResults(prev => ({ ...prev, [r.step_id]: !prev[r.step_id] }))}
                          >
                            <span className="text-xs text-gray-500 w-5 flex-shrink-0">{idx + 1}</span>
                            {r.status === 'PASS'
                              ? <CheckCircle size={16} className="text-emerald-400 flex-shrink-0" />
                              : <XCircle size={16} className="text-red-400 flex-shrink-0" />
                            }
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-white">{r.step_name}</span>
                                <ServiceBadge label={r.service_name} color={c} />
                                {hasExtracted && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 flex items-center gap-1">
                                    <Variable size={9} /> {Object.keys(r.extracted_vars).length} var{Object.keys(r.extracted_vars).length > 1 ? 's' : ''}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-400">{r.details}</span>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded flex-shrink-0 ${r.status === 'PASS' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                              {r.status}
                            </span>
                            {(hasExtracted || r.ai_analysis) && (
                              isExpanded ? <ChevronUp size={14} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                            )}
                          </div>

                          {isExpanded && (
                            <div className="px-4 pb-3 space-y-2 border-t border-white/5">
                              {hasExtracted && (
                                <div className="mt-2">
                                  <span className="text-xs font-semibold text-yellow-300 flex items-center gap-1 mb-1"><Variable size={11} /> Extracted Variables</span>
                                  <div className="space-y-1">
                                    {Object.entries(r.extracted_vars).map(([k, v]) => (
                                      <div key={k} className="flex items-center gap-2 font-mono text-xs">
                                        <span className="text-yellow-300">{k}</span>
                                        <span className="text-gray-500">=</span>
                                        <span className="text-white truncate">{String(v)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {r.ai_analysis && (
                                <div className="mt-2">
                                  <span className="text-xs font-semibold text-orange-300 flex items-center gap-1 mb-1"><AlertCircle size={11} /> AI Analysis</span>
                                  <p className="text-xs text-gray-300 leading-relaxed bg-orange-500/5 border border-orange-500/20 rounded-lg p-2">{r.ai_analysis}</p>
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

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="bg-slate-900/70 border border-white/10 rounded-xl p-4 font-mono text-xs min-h-[400px] max-h-[70vh] overflow-y-auto">
              {logs.length === 0 && (
                <p className="text-gray-500 text-center py-8">Logs will appear here when you run a scenario.</p>
              )}
              {logs.map((log, i) => {
                const svcColor = log.serviceId ? getServiceColor(services, log.serviceId) : null;
                return (
                  <div key={i} className="flex items-start gap-2 py-0.5">
                    <span className="text-gray-600 flex-shrink-0">{log.ts}</span>
                    {svcColor && <span className={`flex-shrink-0 text-[10px] px-1 rounded ${svcColor.bg} ${svcColor.text}`}>{services.find(s => s.id === log.serviceId)?.name || ''}</span>}
                    <span className={logColor(log.type)}>{log.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
