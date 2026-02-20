import React, { useState, useEffect } from 'react';
import { X, Zap, Github, Loader, AlertCircle, ArrowRight } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function AuthModal({ mode: initialMode, onClose, onLoginSuccess, onSwitchMode }) {
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(null); // 'google' or 'github'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setIsLogin(initialMode === 'login');
  }, [initialMode]);

  // OAuth is now handled by AppWrapper, so we can remove the OAuth callback useEffect

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin
        ? { username: formData.username, password: formData.password }
        : { username: formData.username, email: formData.email, password: formData.password };

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Authentication failed');
      }

      localStorage.setItem('token', data.token);

      try {
        const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          localStorage.setItem('user', JSON.stringify(profileData));
          // Call onLoginSuccess immediately without delay
          onLoginSuccess(profileData);
        } else {
          const userData = {
            user_id: data.user_id,
            username: data.username,
            email: data.email,
            oauth_provider: 'none'
          };
          localStorage.setItem('user', JSON.stringify(userData));
          onLoginSuccess(userData);
        }
      } catch (profileError) {
        const userData = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          oauth_provider: 'none'
        };
        localStorage.setItem('user', JSON.stringify(userData));
        onLoginSuccess(userData);
      }

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const handleGoogleLogin = () => {
    setOauthLoading('google');
    // Brief delay to show animation before redirect
    setTimeout(() => {
      window.location.href = `${API_BASE_URL}/auth/google`;
    }, 800);
  };

  const handleGithubLogin = () => {
    setOauthLoading('github');
    // Brief delay to show animation before redirect
    setTimeout(() => {
      window.location.href = `${API_BASE_URL}/auth/github`;
    }, 800);
  };

  const switchMode = () => {
    const newMode = !isLogin;
    setIsLogin(newMode);
    onSwitchMode(newMode ? 'login' : 'signup');
    setError('');
    setSuccess('');
    setFormData({
      email: '',
      password: '',
      username: '',
      name: ''
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-modalBackdrop">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-modalSlide">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all text-white"
          >
            <X size={24} />
          </button>

          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-2xl blur-xl opacity-60 animate-pulse"></div>
              <div className="relative bg-white p-4 rounded-2xl shadow-2xl">
                <Zap size={40} className="text-purple-600" strokeWidth={2.5} />
              </div>
            </div>
          </div>

          <div className="smooth-transition">
            <h2 className="text-3xl font-bold text-white text-center smooth-transition">
              {isLogin ? 'Welcome Back!' : 'Get Started Free'}
            </h2>
            <p className="text-blue-100 text-center mt-2 smooth-transition">
              {isLogin
                ? 'Sign in to continue testing your APIs'
                : 'Create your account and start testing in minutes'}
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 message-enter">
              <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 message-enter">
              <div className="text-green-500 flex-shrink-0 mt-0.5">✓</div>
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={handleGoogleLogin}
              disabled={loading || oauthLoading}
              className={`relative w-full flex items-center justify-center gap-3 px-4 py-3 border-2 rounded-xl font-medium transition-all duration-300 overflow-hidden ${
                oauthLoading === 'google'
                  ? 'border-blue-400 bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              } disabled:cursor-not-allowed`}
            >
              {oauthLoading === 'google' ? (
                <>
                  {/* Animated background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-100/50 via-purple-100/50 to-pink-100/50" style={{ backgroundSize: '200% 100%', animation: 'shimmer 1s linear infinite' }} />

                  {/* Spinning loader */}
                  <div className="relative flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="relative">Connecting to Google...</span>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400" style={{ animation: 'progressBar 0.8s ease-out forwards' }} />
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
            <button
              onClick={handleGithubLogin}
              disabled={loading || oauthLoading}
              className={`relative w-full flex items-center justify-center gap-3 px-4 py-3 border-2 rounded-xl font-medium transition-all duration-300 overflow-hidden ${
                oauthLoading === 'github'
                  ? 'border-gray-600 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-800'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700'
              } disabled:cursor-not-allowed`}
            >
              {oauthLoading === 'github' ? (
                <>
                  {/* Animated background */}
                  <div className="absolute inset-0 bg-gradient-to-r from-gray-100/50 via-gray-200/50 to-gray-100/50" style={{ backgroundSize: '200% 100%', animation: 'shimmer 1s linear infinite' }} />

                  {/* Spinning loader */}
                  <div className="relative flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                    <span className="relative">Connecting to GitHub...</span>
                  </div>

                  {/* Progress bar */}
                  <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-gray-500 to-gray-700" style={{ animation: 'progressBar 0.8s ease-out forwards' }} />
                </>
              ) : (
                <>
                  <Github size={20} />
                  Continue with GitHub
                </>
              )}
            </button>
          </div>

          {/* OAuth Loading Animations */}
          <style>{`
            @keyframes shimmer {
              0% { background-position: -200% 0; }
              100% { background-position: 200% 0; }
            }
            @keyframes progressBar {
              0% { width: 0%; }
              100% { width: 100%; }
            }
          `}</style>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4" key={isLogin ? 'login' : 'signup'}>
            <div className="smooth-transition">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900"
                placeholder="johndoe"
                disabled={loading}
                required
              />
            </div>

            {!isLogin && (
              <div className="form-field-enter smooth-transition">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900"
                  placeholder="you@example.com"
                  disabled={loading}
                  required
                />
              </div>
            )}

            <div className="smooth-transition">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all text-gray-900"
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 text-purple-600 rounded" />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button type="button" className="text-purple-600 hover:text-purple-700 font-medium">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 rounded-lg font-semibold hover:shadow-lg transform hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {loading ? (
                <>
                  <Loader className="animate-spin" size={20} />
                  {isLogin ? 'Signing In...' : 'Creating Account...'}
                </>
              ) : (
                <>
                  {isLogin ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={switchMode}
              disabled={loading}
              className="text-purple-600 hover:text-purple-700 font-semibold disabled:opacity-50"
            >
              {isLogin ? 'Sign up for free' : 'Sign in'}
            </button>
          </div>

          {!isLogin && (
            <p className="mt-6 text-xs text-center text-gray-500">
              By creating an account, you agree to our{' '}
              <button className="text-purple-600 hover:underline">Terms of Service</button>
              {' '}and{' '}
              <button className="text-purple-600 hover:underline">Privacy Policy</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default AuthModal;
