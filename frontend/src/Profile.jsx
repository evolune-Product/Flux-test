import React, { useState } from 'react';
import {
  X, Mail, Github, Lock, Save, AlertCircle, CheckCircle,
  Loader, LogOut, Shield, Trash2, Hash, ExternalLink,
  Link, ChevronRight, Copy, Check
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function Profile({ user, onClose, onUpdate, onLogout }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const [profileData, setProfileData] = useState({
    full_name: user.full_name || '',
    linkedin_url: user.linkedin_url || '',
    github_url: user.github_url || ''
  });

  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  const isOAuthUser = user.oauth_provider && user.oauth_provider !== 'none';
  const githubConnected = user.github_connected || false;
  const flasqoId = user.flasqo_id || '—';
  const plan = user.plan || 'free';
  const avatarLetter = (user.full_name || user.username || 'U').charAt(0).toUpperCase();
  const memberSince = new Date(user.created_at || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });

  const authMethodLabel = () => {
    if (user.oauth_provider === 'google') return 'Google OAuth';
    if (user.oauth_provider === 'github') return 'GitHub OAuth';
    return 'Email & Password';
  };

  const showMessage = (type, text) => {
    setMessage({ type, text });
    setTimeout(() => setMessage({ type: '', text: '' }), 4000);
  };

  const copyFlasqoId = () => {
    navigator.clipboard.writeText(`FQ-${flasqoId}`);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(profileData)
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to update profile');
      const updatedUser = { ...user, ...data.user };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      if (onUpdate) onUpdate(updatedUser);
      showMessage('success', 'Profile updated.');
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showMessage('error', 'New passwords do not match.');
      return;
    }
    if (passwordData.new_password.length < 8) {
      showMessage('error', 'Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ current_password: passwordData.current_password, new_password: passwordData.new_password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || 'Failed to change password');
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' });
      showMessage('success', 'Password changed.');
    } catch (error) {
      showMessage('error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user.username) {
      showMessage('error', 'Username does not match.');
      return;
    }
    setDeletingAccount(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/auth/account`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.detail || 'Failed to delete account');
      }
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      onLogout();
      onClose();
    } catch (error) {
      showMessage('error', error.message);
      setDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleLogoutConfirm = () => {
    setIsLoggingOut(true);
    setTimeout(() => { onLogout(); onClose(); }, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '88vh' }}
      >
        {/* ── Top bar ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <span className="text-xs font-semibold text-gray-400 tracking-widest uppercase">Account</span>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Identity block ── */}
        <div className="px-6 py-5 flex items-center gap-4 border-b border-gray-100">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-200">
            <span className="text-xl font-bold text-white">{avatarLetter}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-gray-900 truncate">
                {user.full_name || user.username}
              </h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tracking-wide ${
                plan === 'pro'
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {plan.toUpperCase()}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-0.5">@{user.username}</p>
          </div>

          {/* Flasqo ID pill — right side */}
          <button
            onClick={copyFlasqoId}
            title="Copy Flasqo ID"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg text-xs font-mono text-gray-600 transition-all flex-shrink-0"
          >
            {copiedId ? <Check size={11} className="text-green-500" /> : <Hash size={11} />}
            FQ-{flasqoId}
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-gray-100 px-6 flex-shrink-0">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'security', label: 'Security' },
            { id: 'danger', label: 'Danger Zone', red: true }
          ].map(({ id, label, red }) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setMessage({ type: '', text: '' }); }}
              className={`mr-6 py-3 text-sm font-medium border-b-2 transition-all -mb-px ${
                activeTab === id
                  ? red
                    ? 'border-red-500 text-red-600'
                    : 'border-violet-600 text-violet-700'
                  : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* Inline message */}
          {message.text && (
            <div className={`mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-100'
                : 'bg-red-50 text-red-700 border border-red-100'
            }`}>
              {message.type === 'success'
                ? <CheckCircle size={14} className="flex-shrink-0" />
                : <AlertCircle size={14} className="flex-shrink-0" />
              }
              {message.text}
            </div>
          )}

          {/* ═══ OVERVIEW ═══ */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Account details rows */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Account Details</p>
                <div className="divide-y divide-gray-100 border border-gray-100 rounded-xl overflow-hidden">
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Username" value={`@${user.username}`} mono />
                  <InfoRow label="Flasqo ID" value={`FQ-${flasqoId}`} mono />
                  <InfoRow label="Member since" value={memberSince} />
                  <InfoRow label="Auth method" value={authMethodLabel()} />
                  <InfoRow label="Plan" value={plan === 'pro' ? 'Pro' : 'Free'} />
                </div>
              </div>

              {/* GitHub integration */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">GitHub</p>
                {githubConnected ? (
                  <div className="flex items-center justify-between border border-green-100 bg-green-50 rounded-xl px-4 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-white rounded-lg border border-green-200 flex items-center justify-center">
                        <Github size={15} className="text-gray-700" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {user.github_username ? `@${user.github_username}` : 'Connected'}
                        </p>
                        {user.github_repo && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <Link size={10} />
                            {user.github_repo}
                          </p>
                        )}
                      </div>
                    </div>
                    {user.github_username && (
                      <a
                        href={`https://github.com/${user.github_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1 transition-colors"
                      >
                        View <ExternalLink size={11} />
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 border border-gray-200 bg-gray-50 rounded-xl px-4 py-3.5">
                    <div className="w-8 h-8 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                      <Github size={15} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">Not connected</p>
                      <p className="text-xs text-gray-400 mt-0.5">Connect to save and share test reports</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Edit form */}
              <div>
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-3">Edit Profile</p>
                <form onSubmit={handleProfileUpdate} className="space-y-3">
                  <FormField
                    label="Display name"
                    value={profileData.full_name}
                    onChange={v => setProfileData({ ...profileData, full_name: v })}
                    placeholder="Your full name"
                  />
                  <FormField
                    label="LinkedIn URL"
                    type="url"
                    value={profileData.linkedin_url}
                    onChange={v => setProfileData({ ...profileData, linkedin_url: v })}
                    placeholder="https://linkedin.com/in/you"
                  />
                  <FormField
                    label="GitHub URL"
                    type="url"
                    value={profileData.github_url}
                    onChange={v => setProfileData({ ...profileData, github_url: v })}
                    placeholder="https://github.com/you"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <><Loader size={14} className="animate-spin" />Saving...</> : <><Save size={14} />Save changes</>}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ═══ SECURITY ═══ */}
          {activeTab === 'security' && (
            <div>
              {isOAuthUser ? (
                <div className="border border-gray-200 rounded-xl p-5 text-center">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Shield size={18} className="text-gray-500" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Managed by {user.oauth_provider === 'google' ? 'Google' : 'GitHub'}</p>
                  <p className="text-xs text-gray-400">Password management is handled by your OAuth provider.</p>
                </div>
              ) : (
                <div>
                  <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-4">Change Password</p>
                  <form onSubmit={handlePasswordChange} className="space-y-3">
                    <FormField label="Current password" type="password" value={passwordData.current_password}
                      onChange={v => setPasswordData({ ...passwordData, current_password: v })}
                      placeholder="Enter current password" required />
                    <FormField label="New password" type="password" value={passwordData.new_password}
                      onChange={v => setPasswordData({ ...passwordData, new_password: v })}
                      placeholder="At least 8 characters" required />
                    <FormField label="Confirm new password" type="password" value={passwordData.confirm_password}
                      onChange={v => setPasswordData({ ...passwordData, confirm_password: v })}
                      placeholder="Repeat new password" required />
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full mt-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading
                        ? <><Loader size={14} className="animate-spin" />Updating...</>
                        : <><Lock size={14} />Update password</>
                      }
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}

          {/* ═══ DANGER ZONE ═══ */}
          {activeTab === 'danger' && (
            <div className="space-y-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Destructive Actions</p>
              <div className="border border-red-100 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Delete account</p>
                    <p className="text-xs text-gray-400 mt-0.5">Permanently remove your account and all data</p>
                  </div>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="flex-shrink-0 ml-4 px-4 py-2 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold rounded-lg transition-all"
                  >
                    Delete account
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-400 px-1">
                Deletion permanently removes all your test suites, flows, and data from Flasqo servers. This cannot be reversed.
              </p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-gray-100 px-6 py-3.5 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-gray-300 font-mono">FQ-{flasqoId}</p>
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-red-500 font-medium transition-colors"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </div>

      {/* ── Logout confirm ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-xs p-6 text-center">
            <p className="text-base font-bold text-gray-800 mb-1">Sign out?</p>
            <p className="text-sm text-gray-400 mb-5">You'll need to sign back in to access Flasqo.</p>
            {isLoggingOut ? (
              <Loader size={22} className="animate-spin mx-auto text-violet-600" />
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all">
                  Cancel
                </button>
                <button onClick={handleLogoutConfirm}
                  className="flex-1 py-2.5 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition-all">
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <p className="text-base font-bold text-gray-900 mb-1">Delete account</p>
            <p className="text-sm text-gray-500 mb-4">
              Type <span className="font-mono font-semibold text-gray-800">{user.username}</span> to confirm. This cannot be undone.
            </p>
            {deletingAccount ? (
              <div className="text-center py-2">
                <Loader size={22} className="animate-spin mx-auto text-red-500" />
              </div>
            ) : (
              <>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={e => setDeleteConfirmText(e.target.value)}
                  placeholder={user.username}
                  className="w-full px-3 py-2.5 border-2 border-gray-200 focus:border-red-400 rounded-xl text-sm font-mono outline-none mb-4 transition-all"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); }}
                    className="flex-1 py-2.5 text-sm font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== user.username}
                    className="flex-1 py-2.5 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-xl transition-all disabled:opacity-35 disabled:cursor-not-allowed"
                  >
                    Delete permanently
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Sub-components ── */

function InfoRow({ label, value, mono }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm text-gray-800 font-medium ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text', required }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 transition-all placeholder:text-gray-300"
      />
    </div>
  );
}

export default Profile;
