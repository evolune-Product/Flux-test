import { useState } from 'react';
import { CheckCircle2, Github } from 'lucide-react';

const API_BASE_URL = window.location.origin;

const BENEFITS = [
  'Unlimited test runs',
  'Save & sync your history',
  'Share reports with teammates',
  'AI root cause analysis',
];

export default function TrialGate({ onLogin }) {
  const [mode, setMode] = useState('signup'); // 'signup' | 'login'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/login';
      const body =
        mode === 'signup'
          ? { username: name, email, password }
          : { email, password };

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || data.message || 'Something went wrong. Please try again.');
        return;
      }

      // Save auth credentials
      if (data.token) localStorage.setItem('token', data.token);
      if (data.user) localStorage.setItem('user', JSON.stringify(data.user));

      onLogin(data.user || data);
    } catch (err) {
      setError('Network error — make sure you are connected and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = (provider) => {
    window.location.href = `${API_BASE_URL}/auth/${provider}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-6">
        <img
          src="/flasqo-logo.png"
          alt="Flasqo"
          className="h-10 w-auto object-contain"
          style={{ mixBlendMode: 'screen' }}
        />
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        {/* Headline */}
        <div className="mb-6 text-center">
          <h1 className="text-xl font-semibold text-white mb-1">
            You've used your 3 free test runs
          </h1>
          <p className="text-sm text-slate-400">
            {mode === 'signup'
              ? 'Sign up to keep going — it\'s free.'
              : 'Welcome back! Sign in to continue.'}
          </p>
        </div>

        {/* Benefits — only shown on signup mode */}
        {mode === 'signup' && (
          <ul className="mb-6 space-y-2">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm text-slate-300">
                <CheckCircle2 size={15} className="text-cyan-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        )}

        {/* OAuth buttons */}
        <div className="space-y-2 mb-4">
          <p className="text-xs text-center text-slate-500 mb-2">Continue with</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleOAuth('google')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors"
            >
              {/* Google SVG icon */}
              <svg width="16" height="16" viewBox="0 0 48 48" fill="none">
                <path d="M43.6 20.5H42V20H24v8h11.3C33.7 32.8 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z" fill="#FFC107"/>
                <path d="M6.3 14.7l6.6 4.8C14.5 16 19 13 24 13c3.1 0 5.8 1.1 7.9 3l5.7-5.7C34.5 6.5 29.6 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" fill="#FF3D00"/>
                <path d="M24 44c5.4 0 10.3-2.1 13.9-5.5l-6.4-5.4C29.6 34.9 26.9 36 24 36c-5.3 0-9.7-3.2-11.3-7.9L6 33.2C9.4 39.7 16.2 44 24 44z" fill="#4CAF50"/>
                <path d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4 5.5l6.4 5.4C37.9 38.9 44 34 44 24c0-1.2-.1-2.4-.4-3.5z" fill="#1976D2"/>
              </svg>
              Google
            </button>
            <button
              onClick={() => handleOAuth('github')}
              className="flex items-center justify-center gap-2 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-sm text-slate-200 transition-colors"
            >
              <Github size={16} />
              GitHub
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 h-px bg-slate-700" />
          <span className="text-xs text-slate-500">or</span>
          <div className="flex-1 h-px bg-slate-700" />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all shadow-lg shadow-blue-900/30"
          >
            {loading
              ? 'Please wait...'
              : mode === 'signup'
              ? 'Create Free Account'
              : 'Sign In'}
          </button>
        </form>

        {/* Toggle */}
        <p className="mt-4 text-center text-xs text-slate-500">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                Sign in
              </button>
            </>
          ) : (
            <>
              Don't have an account?{' '}
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                Create one free
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
