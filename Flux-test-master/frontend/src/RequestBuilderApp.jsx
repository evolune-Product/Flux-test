import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send, Save, Plus, Trash2, Folder, FolderOpen, Clock, X, Check,
  ChevronRight, ChevronDown, Copy, Download, Upload, Globe, Settings,
  Play, ArrowLeft, RefreshCw, FileJson, Terminal, CircleCheck, CircleX, Layers, Code2
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_COLORS = {
  GET: 'text-emerald-400', POST: 'text-amber-400', PUT: 'text-blue-400',
  PATCH: 'text-purple-400', DELETE: 'text-red-400', HEAD: 'text-teal-400', OPTIONS: 'text-pink-400',
};

const emptyKV = () => ({ key: '', value: '', enabled: true });

const newDefinition = () => ({
  method: 'GET',
  url: '',
  params: [emptyKV()],
  headers: [emptyKV()],
  auth: { type: 'none', token: '', username: '', password: '', key: '', value: '', add_to: 'header' },
  body: { mode: 'none', raw: '', content_type: '', urlencoded: [emptyKV()], formdata: [emptyKV()], graphql_query: '', graphql_variables: '' },
  tests: [],
  timeout: 30,
  follow_redirects: true,
  verify_ssl: true,
});

// Fill missing fields on definitions loaded from imports/history
const normalizeDefinition = (d) => {
  const base = newDefinition();
  const def = { ...base, ...d };
  def.auth = { ...base.auth, ...(d.auth || {}) };
  def.body = { ...base.body, ...(d.body || {}) };
  def.params = (d.params?.length ? d.params : [emptyKV()]);
  def.headers = (d.headers?.length ? d.headers : [emptyKV()]);
  def.body.urlencoded = def.body.urlencoded?.length ? def.body.urlencoded : [emptyKV()];
  def.body.formdata = def.body.formdata?.length ? def.body.formdata : [emptyKV()];
  def.tests = d.tests || [];
  return def;
};

// Replace {{var}} using the active environment
const substitute = (text, vars) => {
  if (!text) return text;
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, name) => (name in vars ? vars[name] : m));
};

const applyEnvironment = (def, envVars) => {
  const vars = {};
  (envVars || []).forEach(v => { if (v.enabled && v.key) vars[v.key] = v.value; });
  const sub = (t) => substitute(t, vars);
  return {
    ...def,
    url: sub(def.url),
    params: def.params.map(p => ({ ...p, key: sub(p.key), value: sub(p.value) })),
    headers: def.headers.map(h => ({ ...h, key: sub(h.key), value: sub(h.value) })),
    auth: {
      ...def.auth,
      token: sub(def.auth.token), username: sub(def.auth.username),
      password: sub(def.auth.password), key: sub(def.auth.key), value: sub(def.auth.value),
    },
    body: {
      ...def.body,
      raw: sub(def.body.raw),
      graphql_query: sub(def.body.graphql_query),
      graphql_variables: sub(def.body.graphql_variables),
      urlencoded: def.body.urlencoded.map(p => ({ ...p, key: sub(p.key), value: sub(p.value) })),
      formdata: def.body.formdata.map(p => ({ ...p, key: sub(p.key), value: sub(p.value) })),
    },
  };
};

const getJsonPath = (obj, path) => {
  try {
    return path.replace(/^\$\.?/, '').split(/[.[\]]+/).filter(Boolean)
      .reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
  } catch { return undefined; }
};

const evaluateAssertions = (tests, response) => {
  return (tests || []).filter(t => t.enabled).map(t => {
    let passed = false, actual = '';
    try {
      if (t.type === 'status_equals') {
        actual = String(response.status ?? '');
        passed = actual === String(t.value).trim();
      } else if (t.type === 'body_contains') {
        actual = '(body)';
        passed = (response.body || '').includes(t.value);
      } else if (t.type === 'json_path_equals') {
        const parsed = JSON.parse(response.body || 'null');
        const v = getJsonPath(parsed, t.target);
        actual = v === undefined ? '(missing)' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
        passed = actual === String(t.value).trim();
      } else if (t.type === 'time_below_ms') {
        actual = `${response.time_ms} ms`;
        passed = response.time_ms < parseFloat(t.value);
      } else if (t.type === 'header_exists') {
        const h = (response.headers || []).find(x => x.key.toLowerCase() === t.target.toLowerCase());
        actual = h ? h.value : '(missing)';
        passed = !!h && (t.value === '' || h.value === t.value);
      }
    } catch (e) {
      actual = `error: ${e.message}`;
    }
    return { ...t, passed, actual };
  });
};

const formatBytes = (n) => {
  if (n == null) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const statusColor = (s) => {
  if (!s) return 'bg-slate-600';
  if (s < 300) return 'bg-emerald-600';
  if (s < 400) return 'bg-blue-600';
  if (s < 500) return 'bg-amber-600';
  return 'bg-red-600';
};

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token') || ''}` });

// ─────────────────────────────────────────────
// Code snippet generation (Postman-style) — client-side, multi-language
// ─────────────────────────────────────────────

const collectHeaders = (d) => {
  const h = {};
  d.headers.filter(x => x.enabled && x.key).forEach(x => { h[x.key] = x.value; });
  if (d.auth.type === 'bearer' && d.auth.token) h['Authorization'] = `Bearer ${d.auth.token}`;
  if (d.auth.type === 'apikey' && d.auth.key && d.auth.add_to === 'header') h[d.auth.key] = d.auth.value || '';
  if (['json', 'graphql'].includes(d.body.mode)) h['Content-Type'] = h['Content-Type'] || 'application/json';
  return h;
};

const fullUrl = (d) => {
  const qs = d.params.filter(p => p.enabled && p.key).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  let u = d.url;
  if (d.auth.type === 'apikey' && d.auth.key && d.auth.add_to === 'query') {
    u += (u.includes('?') ? '&' : '?') + `${encodeURIComponent(d.auth.key)}=${encodeURIComponent(d.auth.value || '')}`;
  }
  return qs ? u + (u.includes('?') ? '&' : '?') + qs : u;
};

const bodyString = (d) => {
  if (d.body.mode === 'json' || d.body.mode === 'raw') return d.body.raw || '';
  if (d.body.mode === 'graphql') {
    let vars = {};
    try { vars = JSON.parse(d.body.graphql_variables || '{}'); } catch { /* ignore */ }
    return JSON.stringify({ query: d.body.graphql_query || '', variables: vars });
  }
  if (d.body.mode === 'urlencoded') return d.body.urlencoded.filter(p => p.enabled && p.key).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
  return '';
};

const CODE_GENERATORS = {
  'curl': (d) => {
    const url = fullUrl(d); const h = collectHeaders(d); const body = bodyString(d);
    let s = `curl -X ${d.method} '${url}'`;
    Object.entries(h).forEach(([k, v]) => { s += ` \\\n  -H '${k}: ${v}'`; });
    if (d.auth.type === 'basic') s += ` \\\n  -u '${d.auth.username || ''}:${d.auth.password || ''}'`;
    if (body) s += ` \\\n  -d '${body.replace(/'/g, "'\\''")}'`;
    return s;
  },
  'JavaScript — fetch': (d) => {
    const h = collectHeaders(d); const body = bodyString(d);
    if (d.auth.type === 'basic') h['Authorization'] = `Basic \${btoa('${d.auth.username || ''}:${d.auth.password || ''}')}`;
    const opts = { method: d.method, headers: h };
    let bodyLine = '';
    if (body) bodyLine = `,\n  body: ${JSON.stringify(body)}`;
    return `const res = await fetch('${fullUrl(d)}', {\n  method: '${d.method}',\n  headers: ${JSON.stringify(h, null, 2).replace(/\n/g, '\n  ')}${bodyLine}\n});\nconst data = await res.json();\nconsole.log(data);`;
  },
  'Node — axios': (d) => {
    const h = collectHeaders(d); const body = bodyString(d);
    let cfg = `  method: '${d.method.toLowerCase()}',\n  url: '${fullUrl(d)}',\n  headers: ${JSON.stringify(h, null, 2).replace(/\n/g, '\n  ')}`;
    if (d.auth.type === 'basic') cfg += `,\n  auth: { username: '${d.auth.username || ''}', password: '${d.auth.password || ''}' }`;
    if (body) cfg += `,\n  data: ${d.body.mode === 'json' ? (body || '{}') : JSON.stringify(body)}`;
    return `import axios from 'axios';\n\nconst res = await axios({\n${cfg}\n});\nconsole.log(res.data);`;
  },
  'Python — requests': (d) => {
    const h = collectHeaders(d); const body = bodyString(d);
    let lines = [`import requests`, ``, `url = "${fullUrl(d)}"`, `headers = ${JSON.stringify(h, null, 4)}`];
    let call = `requests.${d.method.toLowerCase()}(url, headers=headers`;
    if (d.body.mode === 'json') { lines.push(`payload = ${body || '{}'}`); call += `, json=payload`; }
    else if (body) { lines.push(`payload = ${JSON.stringify(body)}`); call += `, data=payload`; }
    if (d.auth.type === 'basic') call += `, auth=("${d.auth.username || ''}", "${d.auth.password || ''}")`;
    call += `)`;
    lines.push(``, `res = ${call}`, `print(res.status_code, res.text)`);
    return lines.join('\n');
  },
  'Go — net/http': (d) => {
    const h = collectHeaders(d); const body = bodyString(d);
    let s = `package main\n\nimport (\n  "fmt"\n  "io"\n  "net/http"\n  "strings"\n)\n\nfunc main() {\n`;
    s += `  body := strings.NewReader(${JSON.stringify(body)})\n`;
    s += `  req, _ := http.NewRequest("${d.method}", "${fullUrl(d)}", body)\n`;
    Object.entries(h).forEach(([k, v]) => { s += `  req.Header.Set(${JSON.stringify(k)}, ${JSON.stringify(v)})\n`; });
    if (d.auth.type === 'basic') s += `  req.SetBasicAuth("${d.auth.username || ''}", "${d.auth.password || ''}")\n`;
    s += `  res, _ := http.DefaultClient.Do(req)\n  defer res.Body.Close()\n  out, _ := io.ReadAll(res.Body)\n  fmt.Println(res.Status, string(out))\n}`;
    return s;
  },
  'PHP — cURL': (d) => {
    const h = collectHeaders(d); const body = bodyString(d);
    let s = `<?php\n$ch = curl_init('${fullUrl(d)}');\ncurl_setopt($ch, CURLOPT_CUSTOMREQUEST, '${d.method}');\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\n`;
    const hdrs = Object.entries(h).map(([k, v]) => `'${k}: ${v}'`).join(', ');
    if (hdrs) s += `curl_setopt($ch, CURLOPT_HTTPHEADER, [${hdrs}]);\n`;
    if (body) s += `curl_setopt($ch, CURLOPT_POSTFIELDS, ${JSON.stringify(body)});\n`;
    s += `$response = curl_exec($ch);\ncurl_close($ch);\necho $response;`;
    return s;
  },
  'Java — HttpClient': (d) => {
    const h = collectHeaders(d); const body = bodyString(d);
    let s = `HttpClient client = HttpClient.newHttpClient();\nHttpRequest request = HttpRequest.newBuilder()\n    .uri(URI.create("${fullUrl(d)}"))\n`;
    Object.entries(h).forEach(([k, v]) => { s += `    .header("${k}", "${v}")\n`; });
    const method = d.method === 'GET' ? '.GET()' : `.method("${d.method}", HttpRequest.BodyPublishers.ofString(${JSON.stringify(body)}))`;
    s += `    ${method}\n    .build();\nHttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());\nSystem.out.println(response.body());`;
    return s;
  },
};

const api = {
  async get(path) { const r = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders() }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async post(path, body) { const r = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async put(path, body) { const r = await fetch(`${API_BASE_URL}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...authHeaders() }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
  async del(path) { const r = await fetch(`${API_BASE_URL}${path}`, { method: 'DELETE', headers: authHeaders() }); if (!r.ok) throw new Error(await r.text()); return r.json(); },
};

// ─────────────────────────────────────────────
// Small building blocks
// ─────────────────────────────────────────────

function KVEditor({ rows, onChange, keyPlaceholder = 'Key', valuePlaceholder = 'Value' }) {
  const update = (i, field, val) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r));
    // auto-append an empty row when the last row is being used
    const last = next[next.length - 1];
    if (last.key || last.value) next.push(emptyKV());
    onChange(next);
  };
  const remove = (i) => {
    const next = rows.filter((_, idx) => idx !== i);
    onChange(next.length ? next : [emptyKV()]);
  };
  return (
    <div className="space-y-1.5">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="checkbox" checked={row.enabled} onChange={e => update(i, 'enabled', e.target.checked)}
            className="w-4 h-4 accent-blue-500 shrink-0" />
          <input value={row.key} onChange={e => update(i, 'key', e.target.value)} placeholder={keyPlaceholder}
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono" />
          <input value={row.value} onChange={e => update(i, 'value', e.target.value)} placeholder={valuePlaceholder}
            className="flex-[2] min-w-0 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none font-mono" />
          <button onClick={() => remove(i)} className="p-1.5 text-gray-600 hover:text-red-400 shrink-0">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children, badge }) {
  return (
    <button onClick={onClick}
      className={`px-3.5 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${active ? 'border-orange-500 text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
      {children}
      {badge > 0 && <span className="ml-1.5 text-xs bg-slate-700 text-gray-300 rounded-full px-1.5 py-0.5">{badge}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────

export default function RequestBuilderApp({ user, onLogout }) {
  const navigate = useNavigate();

  // Workspace data
  const [collections, setCollections] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [history, setHistory] = useState([]);
  const [expandedCols, setExpandedCols] = useState({});
  const [sidebarTab, setSidebarTab] = useState('collections');

  // Current request
  const [def, setDef] = useState(newDefinition);
  const [requestName, setRequestName] = useState('Untitled Request');
  const [openRequestId, setOpenRequestId] = useState(null); // saved request being edited
  const [openCollectionId, setOpenCollectionId] = useState(null);
  const [dirty, setDirty] = useState(false);

  // Response
  const [response, setResponse] = useState(null);
  const [testResults, setTestResults] = useState([]);
  const [sending, setSending] = useState(false);
  const [respTab, setRespTab] = useState('body');
  const [reqTab, setReqTab] = useState('params');
  const [bodyView, setBodyView] = useState('pretty');

  // Modals
  const [showEnvModal, setShowEnvModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [runReport, setRunReport] = useState(null); // collection runner results
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState(null);

  const toastTimer = useRef(null);
  const notify = useCallback((msg, ok = true) => {
    setToast({ msg, ok });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  }, []);

  const activeEnv = environments.find(e => e.is_active);

  const refreshAll = useCallback(async () => {
    try {
      const [cols, envs, hist] = await Promise.all([
        api.get('/rb/collections'), api.get('/rb/environments'), api.get('/rb/history?limit=100'),
      ]);
      setCollections(cols); setEnvironments(envs); setHistory(hist);
    } catch (e) {
      console.error('Failed to load workspace:', e);
    }
  }, []);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const updateDef = (patch) => { setDef(d => ({ ...d, ...patch })); setDirty(true); };
  const updateBody = (patch) => { setDef(d => ({ ...d, body: { ...d.body, ...patch } })); setDirty(true); };
  const updateAuth = (patch) => { setDef(d => ({ ...d, auth: { ...d.auth, ...patch } })); setDirty(true); };

  // ── Send ──
  const sendRequest = async (definition = null, saveHistory = true) => {
    const d = definition || def;
    if (!d.url.trim()) { notify('Enter a URL first', false); return null; }
    const resolved = applyEnvironment(d, activeEnv?.variables);
    setSending(true);
    try {
      const result = await api.post('/rb/send', { request: resolved, save_history: saveHistory });
      if (!definition) {
        setResponse(result);
        setTestResults(evaluateAssertions(d.tests, result));
        setRespTab(result.ok ? 'body' : 'body');
        api.get('/rb/history?limit=100').then(setHistory).catch(() => {});
      }
      return result;
    } catch (e) {
      const errResult = { ok: false, error: e.message, time_ms: 0 };
      if (!definition) { setResponse(errResult); setTestResults([]); }
      return errResult;
    } finally {
      setSending(false);
    }
  };

  // ── Save request ──
  const saveRequest = async (collectionId, name) => {
    try {
      if (openRequestId && !collectionId) {
        await api.put(`/rb/requests/${openRequestId}`, { name: requestName, definition: def });
        notify('Request saved');
      } else {
        const saved = await api.post(`/rb/collections/${collectionId}/requests`, { name, definition: def });
        setOpenRequestId(saved.id);
        setOpenCollectionId(collectionId);
        setRequestName(name);
        setExpandedCols(x => ({ ...x, [collectionId]: true }));
        notify('Request saved to collection');
      }
      setDirty(false);
      setShowSaveModal(false);
      refreshAll();
    } catch (e) { notify(`Save failed: ${e.message}`, false); }
  };

  const loadSavedRequest = (col, req) => {
    setDef(normalizeDefinition(req.definition));
    setRequestName(req.name);
    setOpenRequestId(req.id);
    setOpenCollectionId(col.id);
    setResponse(null); setTestResults([]); setDirty(false);
  };

  const loadHistoryEntry = (h) => {
    setDef(normalizeDefinition(h.definition));
    setRequestName(`${h.method} ${h.url.slice(0, 40)}`);
    setOpenRequestId(null); setOpenCollectionId(null);
    setResponse(null); setTestResults([]); setDirty(false);
  };

  const newRequest = () => {
    setDef(newDefinition()); setRequestName('Untitled Request');
    setOpenRequestId(null); setOpenCollectionId(null);
    setResponse(null); setTestResults([]); setDirty(false);
  };

  // ── Collection runner ──
  const runCollection = async (col) => {
    if (!col.requests.length) { notify('Collection is empty', false); return; }
    setRunning(true);
    setRunReport({ name: col.name, items: [], done: false });
    const items = [];
    for (const req of col.requests) {
      const d = normalizeDefinition(req.definition);
      const resolved = applyEnvironment(d, activeEnv?.variables);
      let result;
      try {
        result = await api.post('/rb/send', { request: resolved, save_history: false });
      } catch (e) {
        result = { ok: false, error: e.message, time_ms: 0 };
      }
      const assertions = evaluateAssertions(d.tests, result);
      const passed = result.ok && (result.status < 400 || assertions.length > 0) && assertions.every(a => a.passed);
      items.push({ name: req.name, method: d.method, url: resolved.url, result, assertions, passed });
      setRunReport({ name: col.name, items: [...items], done: false });
    }
    setRunReport({ name: col.name, items, done: true });
    setRunning(false);
  };

  // ── Export / import ──
  const exportCollection = async (col) => {
    try {
      const data = await api.get(`/rb/collections/${col.id}/export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${col.name.replace(/[^\w-]+/g, '_')}.postman_collection.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) { notify(`Export failed: ${e.message}`, false); }
  };

  const copyAsCurl = () => {
    const d = applyEnvironment(def, activeEnv?.variables);
    let cmd = `curl -X ${d.method} '${d.url}`;
    const qs = d.params.filter(p => p.enabled && p.key).map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
    if (qs) cmd += (d.url.includes('?') ? '&' : '?') + qs;
    cmd += `'`;
    d.headers.filter(h => h.enabled && h.key).forEach(h => { cmd += ` \\\n  -H '${h.key}: ${h.value}'`; });
    if (d.auth.type === 'bearer' && d.auth.token) cmd += ` \\\n  -H 'Authorization: Bearer ${d.auth.token}'`;
    if (d.auth.type === 'basic') cmd += ` \\\n  -u '${d.auth.username}:${d.auth.password}'`;
    if (d.auth.type === 'apikey' && d.auth.key && d.auth.add_to === 'header') cmd += ` \\\n  -H '${d.auth.key}: ${d.auth.value}'`;
    if (['json', 'raw', 'graphql'].includes(d.body.mode) && (d.body.raw || d.body.graphql_query)) {
      const raw = d.body.mode === 'graphql'
        ? JSON.stringify({ query: d.body.graphql_query, variables: d.body.graphql_variables ? JSON.parse(d.body.graphql_variables || '{}') : {} })
        : d.body.raw;
      cmd += ` \\\n  -d '${raw.replace(/'/g, "'\\''")}'`;
    } else if (d.body.mode === 'urlencoded') {
      const data = d.body.urlencoded.filter(p => p.enabled && p.key).map(p => `${p.key}=${p.value}`).join('&');
      if (data) cmd += ` \\\n  -d '${data}'`;
    }
    navigator.clipboard.writeText(cmd);
    notify('Copied as cURL');
  };

  const prettyBody = () => {
    if (!response?.body) return '';
    if (bodyView === 'raw') return response.body;
    try { return JSON.stringify(JSON.parse(response.body), null, 2); } catch { return response.body; }
  };

  const beautifyJsonBody = () => {
    try { updateBody({ raw: JSON.stringify(JSON.parse(def.body.raw), null, 2) }); }
    catch { notify('Body is not valid JSON', false); }
  };

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-gray-200 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-slate-900/70 shrink-0">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm">
          <ArrowLeft size={16} /> Home
        </button>
        <div className="w-px h-5 bg-slate-700" />
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-red-600 flex items-center justify-center">
            <Send size={14} className="text-white" />
          </div>
          <span className="font-semibold text-white">Request Builder</span>
        </div>
        <div className="flex-1" />
        {/* Environment selector */}
        <select
          value={activeEnv?.id || ''}
          onChange={async (e) => {
            const id = e.target.value;
            if (id) await api.put(`/rb/environments/${id}`, { is_active: true });
            else if (activeEnv) await api.put(`/rb/environments/${activeEnv.id}`, { is_active: false });
            refreshAll();
          }}
          className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 focus:border-blue-500 focus:outline-none">
          <option value="">No Environment</option>
          {environments.map(env => <option key={env.id} value={env.id}>{env.name}</option>)}
        </select>
        <button onClick={() => setShowEnvModal(true)} title="Manage environments"
          className="p-2 text-gray-400 hover:text-white bg-slate-900 border border-slate-700 rounded-lg">
          <Settings size={15} />
        </button>
        <button onClick={() => setShowImportModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-slate-900 border border-slate-700 rounded-lg text-gray-300 hover:text-white">
          <Upload size={14} /> Import
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* ── Sidebar ── */}
        <div className="w-72 border-r border-slate-800 bg-slate-900/40 flex flex-col shrink-0">
          <div className="flex border-b border-slate-800">
            <TabButton active={sidebarTab === 'collections'} onClick={() => setSidebarTab('collections')}>
              <span className="flex items-center gap-1.5"><Layers size={14} /> Collections</span>
            </TabButton>
            <TabButton active={sidebarTab === 'history'} onClick={() => setSidebarTab('history')}>
              <span className="flex items-center gap-1.5"><Clock size={14} /> History</span>
            </TabButton>
          </div>

          {sidebarTab === 'collections' ? (
            <div className="flex-1 overflow-y-auto p-2">
              <button
                onClick={async () => {
                  const name = prompt('Collection name:', 'New Collection');
                  if (name) { await api.post('/rb/collections', { name }); refreshAll(); }
                }}
                className="w-full flex items-center gap-2 px-3 py-2 mb-2 text-sm text-gray-400 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 rounded-lg">
                <Plus size={14} /> New Collection
              </button>
              {collections.map(col => (
                <div key={col.id} className="mb-1">
                  <div className="group flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-800/70 cursor-pointer"
                    onClick={() => setExpandedCols(x => ({ ...x, [col.id]: !x[col.id] }))}>
                    {expandedCols[col.id] ? <ChevronDown size={14} className="text-gray-500" /> : <ChevronRight size={14} className="text-gray-500" />}
                    {expandedCols[col.id] ? <FolderOpen size={15} className="text-amber-400" /> : <Folder size={15} className="text-amber-400" />}
                    <span className="flex-1 text-sm truncate">{col.name}</span>
                    <span className="text-xs text-gray-600">{col.requests.length}</span>
                    <button title="Run collection" onClick={(e) => { e.stopPropagation(); runCollection(col); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-emerald-400">
                      <Play size={13} />
                    </button>
                    <button title="Export (Postman v2.1)" onClick={(e) => { e.stopPropagation(); exportCollection(col); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-blue-400">
                      <Download size={13} />
                    </button>
                    <button title="Delete collection" onClick={async (e) => {
                      e.stopPropagation();
                      if (confirm(`Delete collection "${col.name}" and its ${col.requests.length} requests?`)) {
                        await api.del(`/rb/collections/${col.id}`); refreshAll();
                      }
                    }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  {expandedCols[col.id] && col.requests.map(req => (
                    <div key={req.id}
                      onClick={() => loadSavedRequest(col, req)}
                      className={`group flex items-center gap-2 pl-9 pr-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800/70 ${openRequestId === req.id ? 'bg-slate-800' : ''}`}>
                      <span className={`text-[11px] font-bold w-12 shrink-0 ${METHOD_COLORS[req.definition.method] || 'text-gray-400'}`}>
                        {req.definition.method}
                      </span>
                      <span className="flex-1 text-sm truncate text-gray-300">{req.name}</span>
                      <button onClick={async (e) => {
                        e.stopPropagation();
                        await api.del(`/rb/requests/${req.id}`);
                        if (openRequestId === req.id) setOpenRequestId(null);
                        refreshAll();
                      }} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-400">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {collections.length === 0 && (
                <p className="text-xs text-gray-600 px-3 py-4 text-center">No collections yet. Create one to save and organize requests.</p>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-2">
              <button onClick={async () => { if (confirm('Clear all history?')) { await api.del('/rb/history'); refreshAll(); } }}
                className="w-full flex items-center justify-center gap-2 px-3 py-1.5 mb-2 text-xs text-gray-500 hover:text-red-400 border border-slate-800 rounded-lg">
                <Trash2 size={12} /> Clear history
              </button>
              {history.map(h => (
                <div key={h.id} onClick={() => loadHistoryEntry(h)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-800/70">
                  <span className={`text-[11px] font-bold w-12 shrink-0 ${METHOD_COLORS[h.method] || 'text-gray-400'}`}>{h.method}</span>
                  <span className="flex-1 text-xs truncate text-gray-400">{h.url}</span>
                  {h.status && <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${statusColor(h.status)}`}>{h.status}</span>}
                </div>
              ))}
              {history.length === 0 && <p className="text-xs text-gray-600 px-3 py-4 text-center">Sent requests appear here.</p>}
            </div>
          )}
        </div>

        {/* ── Main panel ── */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Request name row */}
          <div className="flex items-center gap-2 px-4 pt-3 pb-1">
            <input value={requestName} onChange={e => { setRequestName(e.target.value); setDirty(true); }}
              className="bg-transparent text-white font-medium text-sm focus:outline-none focus:border-b focus:border-blue-500 min-w-0 flex-1" />
            {dirty && <span className="text-[10px] text-amber-400 shrink-0">● unsaved</span>}
            <button onClick={newRequest} className="text-xs text-gray-500 hover:text-white flex items-center gap-1 shrink-0">
              <Plus size={12} /> New
            </button>
          </div>

          {/* URL bar */}
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex flex-1 min-w-0 rounded-lg border border-slate-700 bg-slate-900 focus-within:border-blue-500 overflow-hidden">
              <select value={def.method} onChange={e => updateDef({ method: e.target.value })}
                className={`bg-slate-800 px-3 py-2.5 text-sm font-bold focus:outline-none cursor-pointer ${METHOD_COLORS[def.method]}`}>
                {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <input value={def.url} onChange={e => updateDef({ url: e.target.value })}
                onKeyDown={e => { if (e.key === 'Enter') sendRequest(); }}
                placeholder="https://api.example.com/endpoint  —  use {{variables}} from your environment"
                className="flex-1 min-w-0 bg-transparent px-3 py-2.5 text-sm font-mono text-gray-200 placeholder-gray-600 focus:outline-none" />
            </div>
            <button onClick={() => sendRequest()} disabled={sending}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg shrink-0">
              {sending ? <RefreshCw size={15} className="animate-spin" /> : <Send size={15} />}
              {sending ? 'Sending' : 'Send'}
            </button>
            <button onClick={() => (openRequestId ? saveRequest(null, requestName) : setShowSaveModal(true))}
              className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm rounded-lg shrink-0">
              <Save size={14} /> Save
            </button>
            <button onClick={() => setShowCodeModal(true)} title="Generate code snippet"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shrink-0">
              <Code2 size={14} />
            </button>
            <button onClick={copyAsCurl} title="Copy as cURL"
              className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg shrink-0">
              <Terminal size={14} />
            </button>
          </div>

          {/* Request config tabs */}
          <div className="border-b border-slate-800 px-4 flex">
            <TabButton active={reqTab === 'params'} onClick={() => setReqTab('params')} badge={def.params.filter(p => p.key).length}>Params</TabButton>
            <TabButton active={reqTab === 'headers'} onClick={() => setReqTab('headers')} badge={def.headers.filter(h => h.key).length}>Headers</TabButton>
            <TabButton active={reqTab === 'body'} onClick={() => setReqTab('body')}>Body</TabButton>
            <TabButton active={reqTab === 'auth'} onClick={() => setReqTab('auth')}>Auth</TabButton>
            <TabButton active={reqTab === 'tests'} onClick={() => setReqTab('tests')} badge={def.tests.length}>Tests</TabButton>
            <TabButton active={reqTab === 'settings'} onClick={() => setReqTab('settings')}>Settings</TabButton>
          </div>

          {/* Request config content */}
          <div className="px-4 py-3 overflow-y-auto" style={{ maxHeight: '32vh', minHeight: '120px' }}>
            {reqTab === 'params' && (
              <KVEditor rows={def.params} onChange={rows => updateDef({ params: rows })} keyPlaceholder="param" valuePlaceholder="value" />
            )}
            {reqTab === 'headers' && (
              <KVEditor rows={def.headers} onChange={rows => updateDef({ headers: rows })} keyPlaceholder="Header-Name" valuePlaceholder="value" />
            )}
            {reqTab === 'body' && (
              <div>
                <div className="flex items-center gap-1 mb-3 flex-wrap">
                  {['none', 'json', 'raw', 'urlencoded', 'formdata', 'graphql'].map(m => (
                    <button key={m} onClick={() => updateBody({ mode: m })}
                      className={`px-2.5 py-1 rounded text-xs font-medium ${def.body.mode === m ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}>
                      {m === 'json' ? 'JSON' : m === 'graphql' ? 'GraphQL' : m === 'urlencoded' ? 'x-www-form-urlencoded' : m === 'formdata' ? 'form-data' : m}
                    </button>
                  ))}
                  {def.body.mode === 'json' && (
                    <button onClick={beautifyJsonBody} className="ml-auto text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <FileJson size={12} /> Beautify
                    </button>
                  )}
                </div>
                {def.body.mode === 'none' && <p className="text-xs text-gray-600">This request has no body.</p>}
                {(def.body.mode === 'json' || def.body.mode === 'raw') && (
                  <>
                    {def.body.mode === 'raw' && (
                      <input value={def.body.content_type || ''} onChange={e => updateBody({ content_type: e.target.value })}
                        placeholder="Content-Type (e.g. text/plain, application/xml)"
                        className="w-full mb-2 bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-gray-300 placeholder-gray-600 focus:border-blue-500 focus:outline-none" />
                    )}
                    <textarea value={def.body.raw || ''} onChange={e => updateBody({ raw: e.target.value })}
                      placeholder={def.body.mode === 'json' ? '{\n  "key": "value"\n}' : 'raw body'}
                      spellCheck={false}
                      className="w-full h-40 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y" />
                  </>
                )}
                {def.body.mode === 'urlencoded' && (
                  <KVEditor rows={def.body.urlencoded} onChange={rows => updateBody({ urlencoded: rows })} />
                )}
                {def.body.mode === 'formdata' && (
                  <KVEditor rows={def.body.formdata} onChange={rows => updateBody({ formdata: rows })} />
                )}
                {def.body.mode === 'graphql' && (
                  <div className="space-y-2">
                    <textarea value={def.body.graphql_query || ''} onChange={e => updateBody({ graphql_query: e.target.value })}
                      placeholder={'query {\n  viewer { name }\n}'} spellCheck={false}
                      className="w-full h-28 bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm font-mono text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y" />
                    <textarea value={def.body.graphql_variables || ''} onChange={e => updateBody({ graphql_variables: e.target.value })}
                      placeholder='{ "variables": "as JSON" }' spellCheck={false}
                      className="w-full h-16 bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y" />
                  </div>
                )}
              </div>
            )}
            {reqTab === 'auth' && (
              <div className="max-w-lg space-y-3">
                <select value={def.auth.type} onChange={e => updateAuth({ type: e.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                  <option value="none">No Auth</option>
                  <option value="bearer">Bearer Token</option>
                  <option value="basic">Basic Auth</option>
                  <option value="apikey">API Key</option>
                </select>
                {def.auth.type === 'bearer' && (
                  <input value={def.auth.token || ''} onChange={e => updateAuth({ token: e.target.value })} placeholder="Token"
                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
                )}
                {def.auth.type === 'basic' && (
                  <div className="flex gap-2">
                    <input value={def.auth.username || ''} onChange={e => updateAuth({ username: e.target.value })} placeholder="Username"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                    <input type="password" value={def.auth.password || ''} onChange={e => updateAuth({ password: e.target.value })} placeholder="Password"
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                )}
                {def.auth.type === 'apikey' && (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <input value={def.auth.key || ''} onChange={e => updateAuth({ key: e.target.value })} placeholder="Key (e.g. X-Api-Key)"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
                      <input value={def.auth.value || ''} onChange={e => updateAuth({ value: e.target.value })} placeholder="Value"
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none" />
                    </div>
                    <select value={def.auth.add_to} onChange={e => updateAuth({ add_to: e.target.value })}
                      className="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="header">Add to Header</option>
                      <option value="query">Add to Query Params</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            {reqTab === 'tests' && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 mb-1">Assertions run automatically after each send — and during collection runs.</p>
                {def.tests.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="checkbox" checked={t.enabled} onChange={e => {
                      const tests = def.tests.map((x, idx) => idx === i ? { ...x, enabled: e.target.checked } : x);
                      updateDef({ tests });
                    }} className="w-4 h-4 accent-blue-500 shrink-0" />
                    <select value={t.type} onChange={e => {
                      const tests = def.tests.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x);
                      updateDef({ tests });
                    }} className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs focus:border-blue-500 focus:outline-none">
                      <option value="status_equals">Status equals</option>
                      <option value="body_contains">Body contains</option>
                      <option value="json_path_equals">JSON path equals</option>
                      <option value="time_below_ms">Response time below (ms)</option>
                      <option value="header_exists">Header exists</option>
                    </select>
                    {(t.type === 'json_path_equals' || t.type === 'header_exists') && (
                      <input value={t.target} onChange={e => {
                        const tests = def.tests.map((x, idx) => idx === i ? { ...x, target: e.target.value } : x);
                        updateDef({ tests });
                      }} placeholder={t.type === 'json_path_equals' ? '$.data.id' : 'Header-Name'}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none" />
                    )}
                    <input value={t.value} onChange={e => {
                      const tests = def.tests.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x);
                      updateDef({ tests });
                    }} placeholder={t.type === 'status_equals' ? '200' : t.type === 'time_below_ms' ? '500' : 'expected value'}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono focus:border-blue-500 focus:outline-none" />
                    <button onClick={() => updateDef({ tests: def.tests.filter((_, idx) => idx !== i) })}
                      className="p-1.5 text-gray-600 hover:text-red-400 shrink-0"><Trash2 size={13} /></button>
                  </div>
                ))}
                <button onClick={() => updateDef({ tests: [...def.tests, { type: 'status_equals', target: '', value: '200', enabled: true }] })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white border border-dashed border-slate-700 hover:border-slate-500 rounded-lg">
                  <Plus size={12} /> Add assertion
                </button>
              </div>
            )}
            {reqTab === 'settings' && (
              <div className="max-w-md space-y-3 text-sm">
                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Timeout (seconds)</span>
                  <input type="number" min="1" max="300" value={def.timeout}
                    onChange={e => updateDef({ timeout: parseFloat(e.target.value) || 30 })}
                    className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none" />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Follow redirects</span>
                  <input type="checkbox" checked={def.follow_redirects} onChange={e => updateDef({ follow_redirects: e.target.checked })}
                    className="w-4 h-4 accent-blue-500" />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span className="text-gray-400">Verify SSL certificates</span>
                  <input type="checkbox" checked={def.verify_ssl} onChange={e => updateDef({ verify_ssl: e.target.checked })}
                    className="w-4 h-4 accent-blue-500" />
                </label>
              </div>
            )}
          </div>

          {/* ── Response panel ── */}
          <div className="flex-1 border-t border-slate-800 flex flex-col min-h-0 bg-slate-900/30">
            {!response ? (
              <div className="flex-1 flex items-center justify-center text-gray-600 text-sm">
                <div className="text-center">
                  <Globe size={32} className="mx-auto mb-3 opacity-30" />
                  Hit <span className="text-orange-400 font-medium">Send</span> to see the response here
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-800 shrink-0 flex-wrap">
                  {response.ok ? (
                    <>
                      <span className={`px-2.5 py-1 rounded-md text-white text-xs font-bold ${statusColor(response.status)}`}>
                        {response.status} {response.status_text}
                      </span>
                      <span className="text-xs text-gray-400">{response.time_ms} ms</span>
                      <span className="text-xs text-gray-400">{formatBytes(response.size_bytes)}</span>
                      <span className="text-xs text-gray-600">{response.http_version}</span>
                    </>
                  ) : (
                    <span className="px-2.5 py-1 rounded-md bg-red-700 text-white text-xs font-bold">Error</span>
                  )}
                  {testResults.length > 0 && (
                    <span className={`text-xs font-medium ${testResults.every(t => t.passed) ? 'text-emerald-400' : 'text-red-400'}`}>
                      Tests: {testResults.filter(t => t.passed).length}/{testResults.length} passed
                    </span>
                  )}
                  <div className="flex-1" />
                  {response.ok && (
                    <button onClick={() => { navigator.clipboard.writeText(response.body || ''); notify('Response copied'); }}
                      className="text-xs text-gray-500 hover:text-white flex items-center gap-1"><Copy size={12} /> Copy body</button>
                  )}
                </div>
                <div className="flex border-b border-slate-800 px-4 shrink-0">
                  <TabButton active={respTab === 'body'} onClick={() => setRespTab('body')}>Body</TabButton>
                  <TabButton active={respTab === 'headers'} onClick={() => setRespTab('headers')} badge={response.headers?.length || 0}>Headers</TabButton>
                  <TabButton active={respTab === 'cookies'} onClick={() => setRespTab('cookies')} badge={response.cookies?.length || 0}>Cookies</TabButton>
                  <TabButton active={respTab === 'tests'} onClick={() => setRespTab('tests')} badge={testResults.length}>Test Results</TabButton>
                </div>
                <div className="flex-1 overflow-auto p-4 min-h-0">
                  {respTab === 'body' && (
                    response.ok ? (
                      response.is_text ? (
                        <>
                          <div className="flex gap-1 mb-2">
                            {['pretty', 'raw'].map(v => (
                              <button key={v} onClick={() => setBodyView(v)}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium ${bodyView === v ? 'bg-slate-700 text-white' : 'text-gray-500 hover:text-white'}`}>
                                {v}
                              </button>
                            ))}
                          </div>
                          <pre className="text-xs font-mono text-gray-300 whitespace-pre-wrap break-all">{prettyBody()}</pre>
                        </>
                      ) : (
                        <p className="text-xs text-gray-500">Binary response ({formatBytes(response.size_bytes)}) — not displayable as text.</p>
                      )
                    ) : (
                      <pre className="text-xs font-mono text-red-400 whitespace-pre-wrap">{response.error}</pre>
                    )
                  )}
                  {respTab === 'headers' && (
                    <table className="w-full text-xs font-mono">
                      <tbody>
                        {(response.headers || []).map((h, i) => (
                          <tr key={i} className="border-b border-slate-800/60">
                            <td className="py-1.5 pr-4 text-orange-300/90 align-top whitespace-nowrap">{h.key}</td>
                            <td className="py-1.5 text-gray-300 break-all">{h.value}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {respTab === 'cookies' && (
                    (response.cookies || []).length ? (
                      <table className="w-full text-xs font-mono">
                        <tbody>
                          {response.cookies.map((c, i) => (
                            <tr key={i} className="border-b border-slate-800/60">
                              <td className="py-1.5 pr-4 text-orange-300/90 whitespace-nowrap">{c.key}</td>
                              <td className="py-1.5 text-gray-300 break-all">{c.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : <p className="text-xs text-gray-600">No cookies in response.</p>
                  )}
                  {respTab === 'tests' && (
                    testResults.length ? (
                      <div className="space-y-1.5">
                        {testResults.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            {t.passed ? <CircleCheck size={14} className="text-emerald-400 shrink-0" /> : <CircleX size={14} className="text-red-400 shrink-0" />}
                            <span className="text-gray-300">{t.type.replace(/_/g, ' ')}</span>
                            {t.target && <span className="font-mono text-gray-500">{t.target}</span>}
                            {t.value && <span className="font-mono text-gray-500">= {t.value}</span>}
                            <span className="text-gray-600">→ actual: <span className="font-mono">{t.actual}</span></span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-gray-600">No assertions on this request. Add them in the Tests tab.</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Save modal ── */}
      {showSaveModal && (
        <SaveModal collections={collections} defaultName={requestName}
          onClose={() => setShowSaveModal(false)}
          onSave={async (collectionId, name, newCollectionName) => {
            let cid = collectionId;
            if (newCollectionName) {
              const col = await api.post('/rb/collections', { name: newCollectionName });
              cid = col.id;
            }
            saveRequest(cid, name);
          }} />
      )}

      {/* ── Environments modal ── */}
      {showEnvModal && (
        <EnvironmentsModal environments={environments} onClose={() => { setShowEnvModal(false); refreshAll(); }} notify={notify} />
      )}

      {/* ── Import modal ── */}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} notify={notify}
          onCurlImported={(definition) => {
            setDef(normalizeDefinition(definition));
            setRequestName('Imported from cURL');
            setOpenRequestId(null); setDirty(true);
            setShowImportModal(false);
          }}
          onPostmanImported={() => { refreshAll(); setShowImportModal(false); }} />
      )}

      {/* ── Code snippet modal ── */}
      {showCodeModal && (
        <CodeModal definition={applyEnvironment(def, activeEnv?.variables)} onClose={() => setShowCodeModal(false)} notify={notify} />
      )}

      {/* ── Collection run report ── */}
      {runReport && (
        <RunReportModal report={runReport} running={running} onClose={() => setRunReport(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-5 right-5 px-4 py-2.5 rounded-lg text-sm text-white shadow-xl z-50 ${toast.ok ? 'bg-slate-800 border border-slate-600' : 'bg-red-800 border border-red-600'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Modals
// ─────────────────────────────────────────────

function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-40 p-6" onClick={onClose}>
      <div onClick={e => e.stopPropagation()}
        className={`bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} max-h-[85vh] flex flex-col`}>
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800">
          <h3 className="font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

function SaveModal({ collections, defaultName, onClose, onSave }) {
  const [name, setName] = useState(defaultName);
  const [collectionId, setCollectionId] = useState(collections[0]?.id || '');
  const [newCollection, setNewCollection] = useState(collections.length === 0);
  const [newCollectionName, setNewCollectionName] = useState('My Collection');
  return (
    <ModalShell title="Save Request" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Request name</label>
          <input value={name} onChange={e => setName(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Collection</label>
          {!newCollection && collections.length > 0 ? (
            <div className="flex gap-2">
              <select value={collectionId} onChange={e => setCollectionId(e.target.value)}
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none">
                {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={() => setNewCollection(true)} className="text-xs text-blue-400 hover:text-blue-300 shrink-0">+ New</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input value={newCollectionName} onChange={e => setNewCollectionName(e.target.value)} placeholder="New collection name"
                className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
              {collections.length > 0 && <button onClick={() => setNewCollection(false)} className="text-xs text-gray-500 hover:text-white shrink-0">existing</button>}
            </div>
          )}
        </div>
        <button
          onClick={() => onSave(newCollection ? null : collectionId, name.trim() || 'Untitled Request', newCollection ? (newCollectionName.trim() || 'My Collection') : null)}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 rounded-lg text-white text-sm font-semibold">
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function EnvironmentsModal({ environments, onClose, notify }) {
  const [envs, setEnvs] = useState(environments);
  const [selected, setSelected] = useState(environments[0]?.id || null);
  const env = envs.find(e => e.id === selected);

  const createEnv = async () => {
    const created = await api.post('/rb/environments', { name: 'New Environment', variables: [] });
    setEnvs([...envs, created]); setSelected(created.id);
  };
  const persist = async (patch) => {
    const next = envs.map(e => e.id === selected ? { ...e, ...patch } : e);
    setEnvs(next);
    try { await api.put(`/rb/environments/${selected}`, patch); } catch (e) { notify(`Save failed: ${e.message}`, false); }
  };
  const removeEnv = async (id) => {
    await api.del(`/rb/environments/${id}`);
    const next = envs.filter(e => e.id !== id);
    setEnvs(next); setSelected(next[0]?.id || null);
  };

  return (
    <ModalShell title="Environments" onClose={onClose} wide>
      <div className="flex gap-4 min-h-[300px]">
        <div className="w-52 shrink-0 border-r border-slate-800 pr-3 space-y-1">
          <button onClick={createEnv}
            className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-white border border-dashed border-slate-700 rounded-lg mb-2">
            <Plus size={12} /> New Environment
          </button>
          {envs.map(e => (
            <div key={e.id} onClick={() => setSelected(e.id)}
              className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer text-sm ${selected === e.id ? 'bg-slate-800 text-white' : 'text-gray-400 hover:bg-slate-800/60'}`}>
              <span className="flex-1 truncate">{e.name}</span>
              {e.is_active && <Check size={13} className="text-emerald-400 shrink-0" />}
              <button onClick={ev => { ev.stopPropagation(); removeEnv(e.id); }}
                className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400"><Trash2 size={12} /></button>
            </div>
          ))}
          {envs.length === 0 && <p className="text-xs text-gray-600 px-2">No environments yet.</p>}
        </div>
        <div className="flex-1 min-w-0">
          {env ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input value={env.name} onChange={e => persist({ name: e.target.value })}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" />
                <label className="flex items-center gap-2 text-xs text-gray-400 shrink-0">
                  <input type="checkbox" checked={env.is_active}
                    onChange={e => persist({ is_active: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
                  Active
                </label>
              </div>
              <p className="text-xs text-gray-600">Use variables anywhere as <span className="font-mono text-orange-300">{'{{name}}'}</span> — URL, headers, body, auth.</p>
              <KVEditor
                rows={env.variables.length ? env.variables : [emptyKV()]}
                onChange={rows => persist({ variables: rows.filter(r => r.key || r.value) })}
                keyPlaceholder="variable" valuePlaceholder="value" />
            </div>
          ) : (
            <p className="text-sm text-gray-600">Select or create an environment.</p>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

function ImportModal({ onClose, onCurlImported, onPostmanImported, notify }) {
  const [mode, setMode] = useState('curl');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const doImport = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      if (mode === 'curl') {
        const res = await api.post('/rb/import/curl', { curl: text });
        onCurlImported(res.definition);
        notify('cURL imported');
      } else {
        const res = await api.post('/rb/import/postman', { collection_json: text });
        notify(`Imported "${res.name}" (${res.imported} requests)`);
        onPostmanImported();
      }
    } catch (e) {
      notify(`Import failed: ${e.message}`, false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell title="Import" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex gap-1">
          <button onClick={() => setMode('curl')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${mode === 'curl' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400'}`}>cURL command</button>
          <button onClick={() => setMode('postman')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${mode === 'postman' ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400'}`}>Postman Collection (v2.x JSON)</button>
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} spellCheck={false}
          placeholder={mode === 'curl'
            ? "curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'"
            : 'Paste the exported Postman collection JSON here…'}
          className="w-full h-48 bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-gray-200 placeholder-gray-600 focus:border-blue-500 focus:outline-none resize-y" />
        <button onClick={doImport} disabled={busy || !text.trim()}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 disabled:opacity-50 rounded-lg text-white text-sm font-semibold">
          {busy ? 'Importing…' : 'Import'}
        </button>
      </div>
    </ModalShell>
  );
}

function CodeModal({ definition, onClose, notify }) {
  const langs = Object.keys(CODE_GENERATORS);
  const [lang, setLang] = useState(langs[0]);
  let code = '';
  try { code = CODE_GENERATORS[lang](definition); } catch (e) { code = `// Could not generate: ${e.message}`; }
  return (
    <ModalShell title="Generate Code" onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {langs.map(l => (
            <button key={l} onClick={() => setLang(l)}
              className={`px-2.5 py-1 rounded text-xs font-medium ${lang === l ? 'bg-orange-600 text-white' : 'bg-slate-800 text-gray-400 hover:text-white'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="relative">
          <button onClick={() => { navigator.clipboard.writeText(code); notify('Code copied'); }}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-gray-300 hover:text-white z-10">
            <Copy size={12} /> Copy
          </button>
          <pre className="bg-slate-950 border border-slate-700 rounded-lg p-4 text-xs font-mono text-gray-200 whitespace-pre-wrap break-all max-h-[55vh] overflow-auto">{code}</pre>
        </div>
      </div>
    </ModalShell>
  );
}

function RunReportModal({ report, running, onClose }) {
  const passed = report.items.filter(i => i.passed).length;
  return (
    <ModalShell title={`Run: ${report.name}`} onClose={onClose} wide>
      <div className="space-y-3">
        <div className="flex items-center gap-4 text-sm">
          {running ? (
            <span className="flex items-center gap-2 text-blue-400"><RefreshCw size={14} className="animate-spin" /> Running… {report.items.length} done</span>
          ) : (
            <>
              <span className={`font-semibold ${passed === report.items.length ? 'text-emerald-400' : 'text-red-400'}`}>
                {passed}/{report.items.length} passed
              </span>
              <span className="text-gray-500 text-xs">
                total {Math.round(report.items.reduce((s, i) => s + (i.result.time_ms || 0), 0))} ms
              </span>
            </>
          )}
        </div>
        <div className="space-y-1.5">
          {report.items.map((item, i) => (
            <div key={i} className="border border-slate-800 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                {item.passed ? <CircleCheck size={15} className="text-emerald-400 shrink-0" /> : <CircleX size={15} className="text-red-400 shrink-0" />}
                <span className={`text-xs font-bold ${METHOD_COLORS[item.method] || ''}`}>{item.method}</span>
                <span className="flex-1 truncate text-gray-300">{item.name}</span>
                {item.result.ok
                  ? <span className={`text-[10px] px-1.5 py-0.5 rounded text-white ${statusColor(item.result.status)}`}>{item.result.status}</span>
                  : <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-800 text-white">ERR</span>}
                <span className="text-xs text-gray-600">{item.result.time_ms} ms</span>
              </div>
              {item.assertions.length > 0 && (
                <div className="mt-1.5 pl-6 space-y-0.5">
                  {item.assertions.map((a, j) => (
                    <div key={j} className="flex items-center gap-1.5 text-[11px] text-gray-500">
                      {a.passed ? <Check size={11} className="text-emerald-500" /> : <X size={11} className="text-red-500" />}
                      {a.type.replace(/_/g, ' ')} {a.target} {a.value && `= ${a.value}`} <span className="text-gray-600">(actual: {a.actual})</span>
                    </div>
                  ))}
                </div>
              )}
              {!item.result.ok && <p className="mt-1 pl-6 text-[11px] text-red-400 font-mono truncate">{item.result.error}</p>}
            </div>
          ))}
        </div>
      </div>
    </ModalShell>
  );
}
