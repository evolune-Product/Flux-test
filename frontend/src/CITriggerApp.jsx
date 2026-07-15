import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Key, Plus, Trash2, Copy, CheckCircle, XCircle, Clock,
  Terminal, RefreshCw, AlertTriangle, Activity, Eye, EyeOff,
  ChevronDown, ExternalLink, ArrowLeft,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeader() {
  const token = localStorage.getItem('token');
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function fmtMs(ms) {
  if (ms == null) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

const STATUS_STYLES = {
  passed:  { bg: 'bg-green-500/15',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400'  },
  failed:  { bg: 'bg-red-500/15',    border: 'border-red-500/30',    text: 'text-red-400',    dot: 'bg-red-400'    },
  running: { bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  queued:  { bg: 'bg-yellow-500/15', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  error:   { bg: 'bg-orange-500/15', border: 'border-orange-500/30', text: 'text-orange-400', dot: 'bg-orange-400' },
};

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.queued;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${s.bg} ${s.border} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {status}
    </span>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-all"
    >
      {copied ? <CheckCircle size={13} className="text-green-400" /> : <Copy size={13} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── CI Snippet Generator ───────────────────────────────────────────────────────

function buildSnippet(system, suiteId, backendUrl) {
  const url = backendUrl || 'https://flasqo.com';
  const sid = suiteId || 'YOUR_SUITE_ID';

  const snippets = {
    'github-actions': `# .github/workflows/ci.yml
- name: Flasqo API Quality Gate
  env:
    FLASQO_API_KEY: \${{ secrets.FLASQO_API_KEY }}
  run: |
    curl -sX POST "${url}/ci/trigger?fail_on_error=true" \\
      -H "Authorization: Bearer $FLASQO_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d '{
        "suite_id":     "${sid}",
        "branch":       "\${{ github.ref_name }}",
        "commit_sha":   "\${{ github.sha }}",
        "triggered_by": "github-actions"
      }' \\
      --fail-with-body`,

    'gitlab-ci': `# .gitlab-ci.yml
flasqo-quality-gate:
  stage: test
  script:
    - |
      curl -sX POST "${url}/ci/trigger?fail_on_error=true" \\
        -H "Authorization: Bearer $FLASQO_API_KEY" \\
        -H "Content-Type: application/json" \\
        -d '{
          "suite_id":     "${sid}",
          "branch":       "$CI_COMMIT_REF_NAME",
          "commit_sha":   "$CI_COMMIT_SHA",
          "triggered_by": "gitlab-ci"
        }' \\
        --fail-with-body`,

    jenkins: `// Jenkinsfile (Declarative)
stage('Flasqo Quality Gate') {
  steps {
    sh """
      curl -sX POST "${url}/ci/trigger?fail_on_error=true" \\
        -H "Authorization: Bearer \${FLASQO_API_KEY}" \\
        -H "Content-Type: application/json" \\
        -d '{
          "suite_id":     "${sid}",
          "branch":       "\${env.BRANCH_NAME}",
          "commit_sha":   "\${env.GIT_COMMIT}",
          "triggered_by": "jenkins"
        }' \\
        --fail-with-body
    """
  }
}`,

    curl: `# Universal — works anywhere curl is available
curl -sX POST "${url}/ci/trigger?fail_on_error=true" \\
  -H "Authorization: Bearer YOUR_FLASQO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "suite_id":     "${sid}",
    "triggered_by": "manual"
  }' \\
  --fail-with-body

# Async trigger (for large suites >30s)
RUN_ID=$(curl -sX POST "${url}/ci/trigger/async" \\
  -H "Authorization: Bearer YOUR_FLASQO_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"suite_id":"${sid}"}' | jq -r '.run_id')

# Poll until done
until [ "$(curl -s "${url}/ci/run/$RUN_ID" \\
  -H "Authorization: Bearer YOUR_FLASQO_API_KEY" | jq -r '.status')" != "running" ] && \\
  [ "$(curl -s "${url}/ci/run/$RUN_ID" \\
  -H "Authorization: Bearer YOUR_FLASQO_API_KEY" | jq -r '.status')" != "queued" ]; do
  sleep 3
done`,
  };

  return snippets[system] || snippets.curl;
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'keys',      label: 'API Keys',   icon: Key      },
  { id: 'integrate', label: 'Integrate',  icon: Terminal },
  { id: 'runs',      label: 'Run History',icon: Activity },
];

// ── Main Component ─────────────────────────────────────────────────────────────

export default function CITriggerApp() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState('keys');
  const [apiKeys, setApiKeys] = useState([]);
  const [runs, setRuns]       = useState([]);
  const [suites, setSuites]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  // Create key modal
  const [showCreate, setShowCreate]     = useState(false);
  const [keyName, setKeyName]           = useState('');
  const [expiryDays, setExpiryDays]     = useState('');
  const [newKeyValue, setNewKeyValue]   = useState('');   // shown once after creation
  const [showNewKey, setShowNewKey]     = useState(false);

  // Integrate tab
  const [ciSystem, setCiSystem]         = useState('github-actions');
  const [selectedSuite, setSelectedSuite] = useState('');

  // ── Fetch ────────────────────────────────────────────────────────────────────

  const fetchKeys = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/ci/keys`, { headers: authHeader() });
      const data = await res.json();
      setApiKeys(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load API keys');
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/ci/runs`, { headers: authHeader() });
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load run history');
    }
  }, []);

  const fetchSuites = useCallback(async () => {
    try {
      const res  = await fetch(`${API_BASE_URL}/test-suites/my-suites`, { headers: authHeader() });
      const data = await res.json();
      setSuites(data.suites || []);
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => { fetchKeys(); fetchSuites(); }, [fetchKeys, fetchSuites]);
  useEffect(() => { if (tab === 'runs') fetchRuns(); }, [tab, fetchRuns]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const handleCreateKey = async () => {
    if (!keyName.trim()) return;
    setLoading(true);
    setError('');
    try {
      const body = { name: keyName.trim() };
      if (expiryDays) body.expires_in_days = parseInt(expiryDays);

      const res  = await fetch(`${API_BASE_URL}/ci/keys`, {
        method:  'POST',
        headers: authHeader(),
        body:    JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.detail || 'Failed to create key');

      setNewKeyValue(data.key);
      setShowCreate(false);
      setKeyName('');
      setExpiryDays('');
      fetchKeys();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (keyId) => {
    if (!window.confirm('Revoke this key? Any pipeline using it will immediately fail.')) return;
    try {
      await fetch(`${API_BASE_URL}/ci/keys/${keyId}`, {
        method:  'DELETE',
        headers: authHeader(),
      });
      fetchKeys();
    } catch {
      setError('Failed to revoke key');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 text-white">

      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/60 backdrop-blur-xl px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Terminal size={20} className="text-purple-400" />
                CI/CD Trigger
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Trigger Flasqo test suites directly from your pipeline
              </p>
            </div>
          </div>
          <a
            href="/docs#ci-trigger"
            className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors flex-shrink-0"
          >
            Docs <ExternalLink size={11} />
          </a>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Error banner */}
        {error && (
          <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 text-red-300 rounded-xl px-4 py-3 text-sm">
            <AlertTriangle size={15} />
            {error}
            <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-200">✕</button>
          </div>
        )}

        {/* New key banner — shown once after creation */}
        {newKeyValue && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
              <CheckCircle size={16} />
              API key created — copy it now. It will not be shown again.
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-green-300 font-mono break-all">
                {showNewKey ? newKeyValue : '•'.repeat(newKeyValue.length)}
              </code>
              <button
                onClick={() => setShowNewKey(v => !v)}
                className="p-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white transition-all"
              >
                {showNewKey ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
              <CopyButton text={newKeyValue} />
            </div>
            <button
              onClick={() => setNewKeyValue('')}
              className="text-xs text-slate-500 hover:text-slate-300"
            >
              I've saved it — dismiss
            </button>
          </div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-800/50 border border-slate-700/50 rounded-xl p-1 w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === id
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Keys Tab ─────────────────────────────────────────────────────── */}
        {tab === 'keys' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">
                API keys authenticate your CI pipeline to trigger test suites.
                Each key can be scoped to a specific pipeline.
              </p>
              <button
                onClick={() => { setShowCreate(true); setNewKeyValue(''); }}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-purple-500/20 flex-shrink-0 ml-4"
              >
                <Plus size={15} /> New Key
              </button>
            </div>

            {/* Create modal */}
            {showCreate && (
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-white">Create API Key</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Key Name
                    </label>
                    <input
                      type="text"
                      value={keyName}
                      onChange={e => setKeyName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateKey()}
                      placeholder="Production CI, Dev Pipeline…"
                      className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                      Expires In (days) — optional
                    </label>
                    <input
                      type="number"
                      value={expiryDays}
                      onChange={e => setExpiryDays(e.target.value)}
                      placeholder="Leave blank for no expiry"
                      min="1"
                      className="w-full px-3 py-2.5 bg-slate-900/60 border border-slate-700 text-white placeholder-slate-500 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateKey}
                    disabled={loading || !keyName.trim()}
                    className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-semibold disabled:opacity-40 transition-all"
                  >
                    {loading ? 'Creating…' : 'Create Key'}
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setKeyName(''); setExpiryDays(''); }}
                    className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl text-sm font-semibold transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Keys list */}
            {apiKeys.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Key size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No API keys yet.</p>
                <p className="text-xs mt-1">Create one to start triggering tests from your pipeline.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map(k => (
                  <div
                    key={k.key_id}
                    className={`flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${
                      k.is_active
                        ? 'bg-slate-800/40 border-slate-700/50 hover:border-slate-600/60'
                        : 'bg-slate-800/20 border-slate-700/30 opacity-50'
                    }`}
                  >
                    <Key size={16} className={k.is_active ? 'text-purple-400' : 'text-slate-600'} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{k.name}</span>
                        {!k.is_active && (
                          <span className="text-[10px] px-2 py-0.5 bg-slate-700/60 text-slate-500 rounded-full">revoked</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <code className="text-slate-400 font-mono">{k.key_prefix}…</code>
                        <span>Created {fmtDate(k.created_at)}</span>
                        {k.last_used_at && <span>Last used {fmtDate(k.last_used_at)}</span>}
                        {k.expires_at   && <span>Expires {fmtDate(k.expires_at)}</span>}
                      </div>
                    </div>

                    {k.is_active && (
                      <button
                        onClick={() => handleRevoke(k.key_id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                      >
                        <Trash2 size={12} /> Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Security note */}
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 text-xs text-yellow-300/80 flex items-start gap-2">
              <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
              Store API keys as CI secrets (GitHub Secrets, GitLab CI Variables, etc.).
              Never commit them to source code. Flasqo stores only a hash — the full key
              cannot be recovered after creation.
            </div>
          </div>
        )}

        {/* ── Integrate Tab ─────────────────────────────────────────────────── */}
        {tab === 'integrate' && (
          <div className="space-y-5">
            <p className="text-sm text-slate-400">
              Add one step to your pipeline YAML. Tests run on every push —
              the step fails and blocks the deploy if any tests fail.
            </p>

            {/* Config selectors */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  CI System
                </label>
                <div className="relative">
                  <select
                    value={ciSystem}
                    onChange={e => setCiSystem(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70 appearance-none"
                  >
                    <option value="github-actions">GitHub Actions</option>
                    <option value="gitlab-ci">GitLab CI</option>
                    <option value="jenkins">Jenkins</option>
                    <option value="curl">curl (universal)</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
                  Test Suite
                </label>
                <div className="relative">
                  <select
                    value={selectedSuite}
                    onChange={e => setSelectedSuite(e.target.value)}
                    className="w-full px-3 py-2.5 bg-slate-800/60 border border-slate-700 text-white rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-purple-500/70 appearance-none"
                  >
                    <option value="">— select a suite —</option>
                    {suites.map(s => (
                      <option key={s.suite_id} value={s.suite_id}>{s.suite_name}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-3 top-3 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Snippet */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50 bg-slate-800/40">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Terminal size={13} />
                  {ciSystem === 'github-actions' && 'GitHub Actions — .github/workflows/ci.yml'}
                  {ciSystem === 'gitlab-ci'      && 'GitLab CI — .gitlab-ci.yml'}
                  {ciSystem === 'jenkins'        && 'Jenkins — Jenkinsfile'}
                  {ciSystem === 'curl'           && 'curl — universal'}
                </div>
                <CopyButton text={buildSnippet(ciSystem, selectedSuite, API_BASE_URL)} />
              </div>
              <pre className="p-4 text-xs text-slate-300 font-mono overflow-x-auto leading-relaxed whitespace-pre">
                {buildSnippet(ciSystem, selectedSuite, API_BASE_URL)}
              </pre>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { step: '1', title: 'Generate API key',   desc: 'Create a key in the API Keys tab. Add it as a CI secret.',        color: 'text-purple-400' },
                { step: '2', title: 'Add the step',       desc: 'Paste the snippet into your pipeline YAML. Set your suite_id.',   color: 'text-blue-400'   },
                { step: '3', title: 'Pipeline is gated',  desc: 'Every deploy is blocked until all tests pass. Results in Flasqo.',color: 'text-green-400'  },
              ].map(({ step, title, desc, color }) => (
                <div key={step} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 space-y-1.5">
                  <div className={`text-2xl font-bold ${color}`}>{step}</div>
                  <div className="text-sm font-semibold text-white">{title}</div>
                  <div className="text-xs text-slate-400">{desc}</div>
                </div>
              ))}
            </div>

            {/* fail_on_error explainer */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 text-xs text-blue-300/80 space-y-1">
              <p className="font-semibold text-blue-300">How pipeline blocking works</p>
              <p>
                <code className="text-blue-200">?fail_on_error=true</code> makes Flasqo return HTTP 422
                when any test fails. <code className="text-blue-200">--fail-with-body</code> makes curl
                exit non-zero on any 4xx/5xx — halting the pipeline and printing the failure details.
                Without this flag, Flasqo always returns 200 and you can check the{' '}
                <code className="text-blue-200">.status</code> field manually.
              </p>
            </div>
          </div>
        )}

        {/* ── Runs Tab ──────────────────────────────────────────────────────── */}
        {tab === 'runs' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Recent CI-triggered test runs across all pipelines.</p>
              <button
                onClick={fetchRuns}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-all"
              >
                <RefreshCw size={12} /> Refresh
              </button>
            </div>

            {runs.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Activity size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No CI runs yet.</p>
                <p className="text-xs mt-1">Runs will appear here once your pipeline triggers a test suite.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map(run => (
                  <RunRow key={run.run_id} run={run} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Run Row ───────────────────────────────────────────────────────────────────

function RunRow({ run }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800/60 transition-all text-left"
      >
        <StatusBadge status={run.status} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <code className="text-xs text-slate-400 font-mono">{run.run_id}</code>
            {run.branch     && <span className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded-full">⎇ {run.branch}</span>}
            {run.commit_sha && <span className="text-xs text-slate-500 font-mono">{run.commit_sha.slice(0, 7)}</span>}
            {run.triggered_by && <span className="text-xs text-slate-500">{run.triggered_by}</span>}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{fmtDate(run.triggered_at)}</div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 flex-shrink-0 text-xs">
          {run.total != null && (
            <>
              <span className="text-green-400 font-semibold">{run.passed}✓</span>
              <span className="text-red-400 font-semibold">{run.failed}✗</span>
              {run.pass_rate != null && (
                <span className={`font-bold ${run.pass_rate === 100 ? 'text-green-400' : run.pass_rate >= 70 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {run.pass_rate}%
                </span>
              )}
            </>
          )}
          <span className="text-slate-500">{fmtMs(run.duration_ms)}</span>
          <ChevronDown
            size={14}
            className={`text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-700/40 px-4 py-3 space-y-3">
          {/* Meta */}
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { label: 'Suite ID',    value: run.suite_id },
              { label: 'Completed',   value: fmtDate(run.completed_at) },
              { label: 'Environment', value: run.environment || '—' },
            ].map(({ label, value }) => (
              <div key={label}>
                <div className="text-slate-500 mb-0.5">{label}</div>
                <div className="text-slate-300 font-mono">{value}</div>
              </div>
            ))}
          </div>

          {/* Failures */}
          {run.failures && run.failures.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-red-400">Failures ({run.failures.length})</p>
              {run.failures.map((f, i) => (
                <div key={i} className="bg-red-500/8 border border-red-500/20 rounded-lg px-3 py-2">
                  <div className="text-xs text-red-300 font-medium">{f.test}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{f.details}</div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {run.error && (
            <div className="bg-orange-500/10 border border-orange-500/25 rounded-lg px-3 py-2 text-xs text-orange-300">
              <span className="font-semibold">Error: </span>{run.error}
            </div>
          )}

          {/* Report link */}
          {run.report_url && (
            <a
              href={run.report_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
            >
              <ExternalLink size={11} /> View full report
            </a>
          )}
        </div>
      )}
    </div>
  );
}
