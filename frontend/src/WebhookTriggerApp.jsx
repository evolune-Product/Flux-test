import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitMerge, Plus, Trash2, ToggleLeft, ToggleRight, Copy, Check,
  ChevronDown, ChevronRight, ArrowLeft, RefreshCw, ExternalLink,
  AlertCircle, CheckCircle2, Clock, XCircle, Loader2, Github,
  GitBranch, Radio
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── Shared helpers ────────────────────────────────────────────────────────────

function authHeaders() {
  const token = localStorage.getItem('token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function statusColor(status) {
  return {
    passed:  '#22c55e',
    failed:  '#ef4444',
    error:   '#f97316',
    running: '#3b82f6',
    queued:  '#94a3b8',
  }[status] ?? '#94a3b8';
}

function StatusBadge({ status }) {
  const icons = {
    passed:  <CheckCircle2 size={11} />,
    failed:  <XCircle size={11} />,
    error:   <AlertCircle size={11} />,
    running: <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />,
    queued:  <Clock size={11} />,
  };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 700,
      color: statusColor(status),
      background: statusColor(status) + '1a',
      border: `1px solid ${statusColor(status)}33`,
    }}>
      {icons[status] ?? null}{status}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} title="Copy" style={{
      background: 'none', border: 'none', cursor: 'pointer',
      color: copied ? '#22c55e' : '#64748b', padding: 2,
      display: 'inline-flex', alignItems: 'center',
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  );
}

function Pill({ label }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '1px 7px',
      borderRadius: 99, background: 'rgba(59,130,246,0.12)',
      color: '#93c5fd', border: '1px solid rgba(59,130,246,0.2)',
      fontFamily: 'monospace',
    }}>
      {label}
    </span>
  );
}

// ── Tab button ────────────────────────────────────────────────────────────────

function Tab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
      borderRadius: 8, border: 'none',
      background: active ? 'rgba(255,255,255,0.09)' : 'transparent',
      color:      active ? '#fff' : '#64748b',
      transition: 'all .15s',
    }}>
      {children}
    </button>
  );
}

// ── GitHub not-connected banner ────────────────────────────────────────────────

function GitHubConnectBanner({ apiBase }) {
  return (
    <div style={{
      background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)',
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <Github size={24} color="#fbbf24" />
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#fbbf24', marginBottom: 4 }}>
          GitHub not connected
        </div>
        <div style={{ fontSize: 13, color: '#94a3b8' }}>
          Connect your GitHub account so Flasqo can register webhooks on your repositories.
        </div>
      </div>
      <a
        href={`${apiBase}/github/connect?redirect_path=/webhook-trigger`}
        style={{
          padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
          background: 'linear-gradient(135deg,#1f6feb,#388bfd)',
          color: '#fff', textDecoration: 'none', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        <Github size={14} /> Connect GitHub
      </a>
    </div>
  );
}

// ── Create config modal ────────────────────────────────────────────────────────

function CreateConfigModal({ suites, onClose, onCreate }) {
  const [form, setForm] = useState({
    repo_full_name:     '',
    suite_id:           '',
    branch_filter:      '*',
    events:             ['push', 'pull_request'],
    post_commit_status: true,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState('');

  const toggleEvent = (ev) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev)
        ? f.events.filter(e => e !== ev)
        : [...f.events, ev],
    }));
  };

  const submit = async () => {
    if (!form.repo_full_name.trim()) return setError('Repository is required (owner/repo)');
    if (!form.suite_id)              return setError('Select a test suite');
    if (form.events.length === 0)    return setError('Select at least one event');

    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE}/webhooks/configs`, {
        method:  'POST',
        headers: authHeaders(),
        body:    JSON.stringify(form),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail ?? 'Failed to create config');
      onCreate(data);
      onClose();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 500,
        background: 'rgba(9,12,22,0.98)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 16, overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.07)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <GitMerge size={18} color="#22d3ee" />
            <span style={{ fontWeight: 700, fontSize: 15, color: '#fff' }}>
              New Webhook Config
            </span>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#64748b', fontSize: 20, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Repo */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              REPOSITORY <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              placeholder="owner/repo"
              value={form.repo_full_name}
              onChange={e => setForm(f => ({ ...f, repo_full_name: e.target.value.trim() }))}
              style={{
                marginTop: 6, width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', borderRadius: 8, fontSize: 13,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', outline: 'none', fontFamily: 'monospace',
              }}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
              The GitHub repository to watch (e.g. octocat/hello-world)
            </div>
          </div>

          {/* Suite */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              TEST SUITE <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              value={form.suite_id}
              onChange={e => setForm(f => ({ ...f, suite_id: e.target.value }))}
              style={{
                marginTop: 6, width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', borderRadius: 8, fontSize: 13,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: form.suite_id ? '#fff' : '#64748b', outline: 'none',
              }}
            >
              <option value="">— select a suite —</option>
              {suites.map(s => (
                <option key={s.suite_id} value={s.suite_id} style={{ background: '#0f172a' }}>
                  {s.suite_name}
                </option>
              ))}
            </select>
          </div>

          {/* Branch */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              BRANCH FILTER
            </label>
            <input
              placeholder="* (all branches)"
              value={form.branch_filter}
              onChange={e => setForm(f => ({ ...f, branch_filter: e.target.value || '*' }))}
              style={{
                marginTop: 6, width: '100%', boxSizing: 'border-box',
                padding: '9px 12px', borderRadius: 8, fontSize: 13,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#fff', outline: 'none', fontFamily: 'monospace',
              }}
            />
            <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
              Use <code>*</code> for all branches, or a specific branch name like <code>main</code>
            </div>
          </div>

          {/* Events */}
          <div>
            <label style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              TRIGGER ON
            </label>
            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              {['push', 'pull_request'].map(ev => {
                const on = form.events.includes(ev);
                return (
                  <button key={ev} onClick={() => toggleEvent(ev)} style={{
                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'monospace',
                    background: on ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${on ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    color:  on ? '#22d3ee' : '#64748b',
                  }}>
                    {ev}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Commit status toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#cbd5e1' }}>
                Post commit status to GitHub
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>
                Adds ✅ / ❌ checks directly on your PR
              </div>
            </div>
            <button
              onClick={() => setForm(f => ({ ...f, post_commit_status: !f.post_commit_status }))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {form.post_commit_status
                ? <ToggleRight size={28} color="#22d3ee" />
                : <ToggleLeft  size={28} color="#475569" />}
            </button>
          </div>

          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <AlertCircle size={14} />{error}
            </div>
          )}

          <button onClick={submit} disabled={loading} style={{
            padding: '10px 0', borderRadius: 10, fontSize: 14, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            background: loading
              ? 'rgba(255,255,255,0.05)'
              : 'linear-gradient(135deg,#0ea5e9,#22d3ee)',
            border: 'none', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
            {loading
              ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Registering…</>
              : <><GitMerge size={15} /> Register Webhook</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Config card ────────────────────────────────────────────────────────────────

function ConfigCard({ config, onDelete, onToggle }) {
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [urlCopied, setUrlCopied] = useState(false);

  const handleDelete = async () => {
    if (!window.confirm(`Remove webhook for ${config.repo_full_name}?`)) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/webhooks/configs/${config.config_id}`, {
        method: 'DELETE', headers: authHeaders(),
      });
      onDelete(config.config_id);
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle = async () => {
    setToggling(true);
    try {
      const resp = await fetch(`${API_BASE}/webhooks/configs/${config.config_id}`, {
        method:  'PATCH',
        headers: authHeaders(),
        body:    JSON.stringify({ is_active: !config.is_active }),
      });
      const updated = await resp.json();
      onToggle(updated);
    } finally {
      setToggling(false);
    }
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(config.webhook_url);
    setUrlCopied(true);
    setTimeout(() => setUrlCopied(false), 2000);
  };

  return (
    <div style={{
      background: 'rgba(9,12,22,0.8)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 12, padding: '18px 20px',
      borderLeft: `3px solid ${config.is_active ? '#22d3ee' : '#334155'}`,
    }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
            <Github size={14} color="#94a3b8" />
            <span style={{ fontWeight: 700, fontSize: 14, color: '#fff', fontFamily: 'monospace' }}>
              {config.repo_full_name}
            </span>
            {!config.is_active && (
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 99,
                background: 'rgba(100,116,139,0.15)', color: '#64748b',
                border: '1px solid rgba(100,116,139,0.2)',
              }}>
                paused
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
            <Pill label={`suite: ${config.suite_name}`} />
            <Pill label={`branch: ${config.branch_filter}`} />
            {(config.events || []).map(ev => <Pill key={ev} label={ev} />)}
            {config.post_commit_status && <Pill label="commit status" />}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button onClick={handleToggle} disabled={toggling} title={config.is_active ? 'Pause' : 'Resume'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            {config.is_active
              ? <ToggleRight size={20} color="#22d3ee" />
              : <ToggleLeft  size={20} color="#475569" />}
          </button>
          <button onClick={handleDelete} disabled={deleting} title="Remove"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', color: '#ef4444' }}>
            {deleting ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {/* Webhook URL */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px', borderRadius: 8, fontFamily: 'monospace', fontSize: 11,
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        color: '#64748b', wordBreak: 'break-all',
      }}>
        <Radio size={11} color="#475569" style={{ flexShrink: 0 }} />
        <span style={{ flex: 1 }}>{config.webhook_url}</span>
        <button onClick={copyUrl} style={{
          background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
          color: urlCopied ? '#22c55e' : '#64748b', padding: 0, display: 'flex',
        }}>
          {urlCopied ? <Check size={13} /> : <Copy size={13} />}
        </button>
      </div>

      <div style={{ marginTop: 8, fontSize: 11, color: '#334155' }}>
        Created {new Date(config.created_at).toLocaleDateString()}
      </div>
    </div>
  );
}

// ── Run history row ────────────────────────────────────────────────────────────

function RunRow({ run }) {
  const [open, setOpen] = useState(false);
  const sha = run.commit_sha ? run.commit_sha.slice(0, 7) : '—';

  return (
    <div style={{
      background: 'rgba(9,12,22,0.8)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 10, overflow: 'hidden',
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '13px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 12,
        }}
      >
        {open ? <ChevronDown size={14} color="#64748b" /> : <ChevronRight size={14} color="#64748b" />}
        <StatusBadge status={run.status} />
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#94a3b8', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {run.repo_full_name}
          {run.branch && <span style={{ color: '#475569' }}> @ {run.branch}</span>}
          {run.event_type && <span style={{ color: '#334155' }}> [{run.event_type}]</span>}
        </span>
        <span style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>
          {sha}
        </span>
        {run.total != null && (
          <span style={{ fontSize: 11, color: '#64748b', flexShrink: 0 }}>
            {run.passed}/{run.total} passed
          </span>
        )}
        {run.duration_ms != null && (
          <span style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>
            {(run.duration_ms / 1000).toFixed(1)}s
          </span>
        )}
        <span style={{ fontSize: 11, color: '#334155', flexShrink: 0 }}>
          {new Date(run.created_at).toLocaleString()}
        </span>
      </button>

      {open && (
        <div style={{
          padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.05)',
          paddingTop: 14,
        }}>
          {run.error && (
            <div style={{
              padding: '8px 12px', borderRadius: 8, fontSize: 12, fontFamily: 'monospace',
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
              color: '#fca5a5', marginBottom: 12,
            }}>
              {run.error}
            </div>
          )}

          {run.results && run.results.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {run.results.filter(r => r.status === 'FAIL').slice(0, 5).map((r, i) => (
                <div key={i} style={{
                  padding: '6px 10px', borderRadius: 7, fontSize: 11, fontFamily: 'monospace',
                  background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)',
                  color: '#fca5a5',
                }}>
                  ✗ {r.test_name || r.name || `Test ${i + 1}`}
                  {r.details && <span style={{ color: '#64748b' }}>: {r.details}</span>}
                </div>
              ))}
              {run.failed > 5 && (
                <div style={{ fontSize: 11, color: '#475569', paddingLeft: 4 }}>
                  + {run.failed - 5} more failures…
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
            {run.commit_sha && (
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                sha: {run.commit_sha}
              </span>
            )}
            {run.pr_number && (
              <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#64748b' }}>
                PR #{run.pr_number}
              </span>
            )}
            {run.commit_status_posted && (
              <span style={{ fontSize: 11, color: '#22d3ee' }}>
                ✓ commit status posted
              </span>
            )}
            {run.completed_at && (
              <span style={{ fontSize: 11, color: '#334155' }}>
                completed {new Date(run.completed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────

export default function WebhookTriggerApp({ user, onLogout }) {
  const navigate = useNavigate();

  const [tab,          setTab         ] = useState('configs');
  const [configs,      setConfigs     ] = useState([]);
  const [runs,         setRuns        ] = useState([]);
  const [suites,       setSuites      ] = useState([]);
  const [ghConnected,  setGhConnected ] = useState(null);   // null = loading
  const [showCreate,   setShowCreate  ] = useState(false);
  const [loadingCfg,   setLoadingCfg  ] = useState(true);
  const [loadingRuns,  setLoadingRuns ] = useState(false);
  const [cfgError,     setCfgError    ] = useState('');
  const [runsError,    setRunsError   ] = useState('');

  // ── Fetch GitHub connection status + suites ─────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');

    fetch(`${API_BASE}/github/status`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setGhConnected(!!d.connected))
      .catch(() => setGhConnected(false));

    fetch(`${API_BASE}/test-suites/my-suites`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setSuites(Array.isArray(d) ? d : d.suites ?? []))
      .catch(() => {});
  }, []);

  // ── Load configs ──────────────────────────────────────────────────────────
  const loadConfigs = useCallback(async () => {
    setLoadingCfg(true);
    setCfgError('');
    try {
      const resp = await fetch(`${API_BASE}/webhooks/configs`, { headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail ?? 'Failed to load configs');
      setConfigs(data);
    } catch (e) {
      setCfgError(e.message);
    } finally {
      setLoadingCfg(false);
    }
  }, []);

  // ── Load runs ─────────────────────────────────────────────────────────────
  const loadRuns = useCallback(async () => {
    setLoadingRuns(true);
    setRunsError('');
    try {
      const resp = await fetch(`${API_BASE}/webhooks/runs?limit=50`, { headers: authHeaders() });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.detail ?? 'Failed to load runs');
      setRuns(data);
    } catch (e) {
      setRunsError(e.message);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => { loadConfigs(); }, [loadConfigs]);
  useEffect(() => { if (tab === 'runs') loadRuns(); }, [tab, loadRuns]);

  const handleCreated = (cfg) => setConfigs(prev => [cfg, ...prev]);
  const handleDeleted = (id)  => setConfigs(prev => prev.filter(c => c.config_id !== id));
  const handleToggled = (cfg) => setConfigs(prev => prev.map(c => c.config_id === cfg.config_id ? cfg : c));

  return (
    <div style={{ minHeight: '100vh', background: '#080b15', color: '#e2e8f0', fontFamily: 'Inter,sans-serif' }}>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 30,
        background: 'rgba(8,11,21,0.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 28px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={() => navigate('/')} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#64748b', fontSize: 13, padding: '4px 10px',
          borderRadius: 7, border: '1px solid rgba(255,255,255,0.07)',
        }}>
          <ArrowLeft size={14} /> Back
        </button>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg,#0891b2,#22d3ee)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitMerge size={17} color="#fff" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>GitHub Webhook Trigger</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Auto-run test suites on push / pull request</div>
          </div>
        </div>

        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>{user.username}</span>
            <button onClick={onLogout} style={{
              padding: '5px 14px', borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#fca5a5', cursor: 'pointer',
            }}>Logout</button>
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>

        {/* GitHub not connected */}
        {ghConnected === false && (
          <div style={{ marginBottom: 28 }}>
            <GitHubConnectBanner apiBase={API_BASE} />
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28 }}>
          <Tab active={tab === 'configs'} onClick={() => setTab('configs')}>
            <GitBranch size={14} style={{ display: 'inline', marginRight: 6 }} />
            Webhook Configs
          </Tab>
          <Tab active={tab === 'runs'} onClick={() => setTab('runs')}>
            <Radio size={14} style={{ display: 'inline', marginRight: 6 }} />
            Run History
          </Tab>
        </div>

        {/* ── Configs tab ─────────────────────────────────────────────────── */}
        {tab === 'configs' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {configs.length} webhook{configs.length !== 1 ? 's' : ''} configured
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={loadConfigs} title="Refresh" style={{
                  padding: '6px 10px', borderRadius: 8, fontSize: 12,
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <RefreshCw size={13} />
                </button>
                <button
                  onClick={() => ghConnected ? setShowCreate(true) : null}
                  disabled={ghConnected === false}
                  title={ghConnected === false ? 'Connect GitHub first' : 'New webhook config'}
                  style={{
                    padding: '7px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: ghConnected === false
                      ? 'rgba(255,255,255,0.04)'
                      : 'linear-gradient(135deg,#0891b2,#22d3ee)',
                    border: 'none', color: ghConnected === false ? '#475569' : '#fff',
                    cursor: ghConnected === false ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <Plus size={14} /> New Config
                </button>
              </div>
            </div>

            {cfgError && (
              <div style={{
                padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={15} />{cfgError}
              </div>
            )}

            {loadingCfg ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#334155' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : configs.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 64,
                border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16,
              }}>
                <GitMerge size={36} color="#1e293b" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  No webhooks configured
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', maxWidth: 340, margin: '0 auto' }}>
                  Create a webhook config to automatically run your test suite every time code is pushed to GitHub.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {configs.map(c => (
                  <ConfigCard key={c.config_id} config={c}
                    onDelete={handleDeleted} onToggle={handleToggled} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Runs tab ────────────────────────────────────────────────────── */}
        {tab === 'runs' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 13, color: '#64748b' }}>
                {runs.length} recent run{runs.length !== 1 ? 's' : ''}
              </div>
              <button onClick={loadRuns} style={{
                padding: '6px 10px', borderRadius: 8, fontSize: 12,
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <RefreshCw size={13} /> Refresh
              </button>
            </div>

            {runsError && (
              <div style={{
                padding: '12px 16px', borderRadius: 10, marginBottom: 16,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                color: '#fca5a5', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertCircle size={15} />{runsError}
              </div>
            )}

            {loadingRuns ? (
              <div style={{ textAlign: 'center', padding: 60, color: '#334155' }}>
                <Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : runs.length === 0 ? (
              <div style={{
                textAlign: 'center', padding: 64,
                border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 16,
              }}>
                <Radio size={36} color="#1e293b" style={{ marginBottom: 16 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: '#334155', marginBottom: 8 }}>
                  No webhook runs yet
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', maxWidth: 320, margin: '0 auto' }}>
                  Runs appear here after GitHub sends a push or pull request event to your registered webhook.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {runs.map(r => <RunRow key={r.run_id} run={r} />)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Create config modal */}
      {showCreate && (
        <CreateConfigModal
          suites={suites}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreated}
        />
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
