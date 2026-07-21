import { useEffect, useState } from 'react';
import {
  User, LogOut, Crown, Check, ShieldCheck, Cloud, CloudOff, Loader,
  Mail, Lock, AtSign, Save, ExternalLink
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = {
  async get(p) { const r = await fetch(`${API_BASE_URL}${p}`); if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail || r.statusText); return r.json(); },
  async post(p, b) { const r = await fetch(`${API_BASE_URL}${p}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || r.statusText); return j; },
  async put(p, b) { const r = await fetch(`${API_BASE_URL}${p}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.detail || r.statusText); return j; },
};

export default function AccountApp() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try { setSession(await api.get('/account/session')); }
    catch { setSession({ signed_in: false }); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  if (loading) {
    return <div className="h-full flex items-center justify-center bg-slate-950 text-gray-500"><Loader className="animate-spin" /></div>;
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-950 text-gray-200">
      <div className="max-w-3xl mx-auto px-8 py-10">
        <h1 className="text-2xl font-bold text-white">Account & Settings</h1>
        <p className="text-gray-500 mt-1 text-sm mb-8">
          Your API testing always runs locally on this machine. Signing in to flasqo.com is optional — it links your account and (soon) enables cloud sync and teams.
        </p>

        {session?.signed_in
          ? <SignedIn session={session} onChange={setSession} onRefresh={refresh} />
          : <SignedOut onSignedIn={setSession} cloudApi={session?.cloud_api} />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

function SignedOut({ onSignedIn, cloudApi }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true); setError('');
    try {
      const path = mode === 'login' ? '/account/login' : '/account/signup';
      const body = mode === 'login'
        ? { username: form.username, password: form.password }
        : { username: form.username, email: form.email, password: form.password };
      const res = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.detail || 'Failed');
      onSignedIn(j);
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Auth card */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <div className="flex gap-1 mb-5 bg-slate-950 rounded-lg p-1">
          {['login', 'signup'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); }}
              className={`flex-1 py-1.5 rounded-md text-sm font-medium ${mode === m ? 'bg-slate-800 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
              {m === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          <Field icon={AtSign} placeholder="Username" value={form.username} onChange={v => setForm(f => ({ ...f, username: v }))} />
          {mode === 'signup' && <Field icon={Mail} placeholder="Email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} />}
          <Field icon={Lock} placeholder="Password" type="password" value={form.password} onChange={v => setForm(f => ({ ...f, password: v }))}
            onEnter={submit} />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={submit} disabled={busy || !form.username || !form.password || (mode === 'signup' && !form.email)}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2">
            {busy ? <Loader className="animate-spin" size={15} /> : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </div>

        <p className="text-[11px] text-gray-600 mt-4 flex items-center gap-1.5">
          <ShieldCheck size={12} /> Authenticates against {cloudApi || 'flasqo.com'}. Google/GitHub sign-in coming to desktop soon.
        </p>
      </div>

      {/* Why sign in */}
      <div className="rounded-2xl bg-slate-900/50 border border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Cloud size={16} className="text-blue-400" /> Why sign in?</h3>
        <ul className="space-y-2.5 text-sm text-gray-400">
          {['Keep your flasqo.com identity in the app', 'Cloud sync of collections & history (soon)', 'Shared team workspaces (soon)', 'Manage your subscription in one place'].map(t => (
            <li key={t} className="flex items-start gap-2"><Check size={15} className="text-emerald-400 mt-0.5 shrink-0" />{t}</li>
          ))}
        </ul>
        <div className="mt-4 p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-gray-500 flex items-start gap-2">
          <CloudOff size={14} className="mt-0.5 shrink-0" />
          You don't need an account to use Flasqo. Everything works offline; sign-in is purely optional.
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

function SignedIn({ session, onChange, onRefresh }) {
  const u = session.user || {};
  const sub = session.subscription || {};
  const [profile, setProfile] = useState({ full_name: u.full_name || '', linkedin_url: u.linkedin_url || '', github_url: u.github_url || '' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const saveProfile = async () => {
    setSaving(true); setSaved(false);
    try { const res = await api.put('/account/profile', profile); onChange(res); setSaved(true); setTimeout(() => setSaved(false), 2000); }
    catch (e) { alert(e.message); }
    finally { setSaving(false); }
  };
  const signOut = async () => { await api.post('/account/logout', {}); onRefresh(); };

  return (
    <div className="space-y-6">
      {session.stale && (
        <div className="rounded-lg bg-amber-900/20 border border-amber-600/30 px-4 py-2.5 text-xs text-amber-300 flex items-center gap-2">
          <CloudOff size={14} /> Couldn't reach flasqo.com to refresh — showing your last-known account details.
        </div>
      )}

      {/* Identity */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-xl font-bold text-white">
            {(u.username || 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-white">{u.username}</h2>
            <p className="text-sm text-gray-500 truncate">{u.email}</p>
            {u.oauth_provider && <span className="text-[10px] text-gray-600">via {u.oauth_provider}</span>}
          </div>
          <button onClick={signOut} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-gray-300">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {/* Subscription */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900 border border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Crown size={16} className="text-amber-400" /> Subscription</h3>
          <span className="px-2.5 py-1 rounded-full bg-emerald-900/40 border border-emerald-600/40 text-xs text-emerald-300 font-medium">{sub.name || 'Free'} plan</span>
        </div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-3xl font-bold text-white">{sub.price || '$0'}</span>
          <span className="text-sm text-gray-500">/ current plan</span>
        </div>
        <ul className="space-y-2 text-sm text-gray-400 mb-4">
          {(sub.features || []).map(f => <li key={f} className="flex items-center gap-2"><Check size={15} className="text-emerald-400 shrink-0" />{f}</li>)}
        </ul>
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-xs text-gray-500">
          Paid plans & billing aren't available yet — this is a preview of where your subscription will live. You're on the free plan with unlimited local testing.
        </div>
      </div>

      {/* Profile */}
      <div className="rounded-2xl bg-slate-900 border border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><User size={16} /> Profile</h3>
        <div className="space-y-3">
          <Labeled label="Full name"><input value={profile.full_name} onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" /></Labeled>
          <Labeled label="LinkedIn URL"><input value={profile.linkedin_url} onChange={e => setProfile(p => ({ ...p, linkedin_url: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" /></Labeled>
          <Labeled label="GitHub URL"><input value={profile.github_url} onChange={e => setProfile(p => ({ ...p, github_url: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none" /></Labeled>
          <button onClick={saveProfile} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm text-white disabled:opacity-40">
            {saving ? <Loader className="animate-spin" size={14} /> : saved ? <Check size={14} className="text-emerald-400" /> : <Save size={14} />}
            {saved ? 'Saved' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────

function Field({ icon: Icon, type = 'text', placeholder, value, onChange, onEnter }) {
  return (
    <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 rounded-lg px-3 focus-within:border-blue-500">
      <Icon size={15} className="text-gray-500 shrink-0" />
      <input type={type} placeholder={placeholder} value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && onEnter) onEnter(); }}
        className="flex-1 bg-transparent py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none" />
    </div>
  );
}

function Labeled({ label, children }) {
  return (<label className="block"><span className="text-xs text-gray-500 block mb-1">{label}</span>{children}</label>);
}
