import React, { useState, useEffect } from 'react';
import { Zap, Shield, BarChart3, Code, ArrowRight, Github, Loader, AlertCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function Auth({ onLoginSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    username: '',
    name: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // OAuth is now handled by AppWrapper, so we can remove this useEffect

  const features = [
    {
      icon: <Zap className="text-blue-400" size={24} />,
      title: "AI-Powered Test Generation",
      description: "Generate comprehensive test suites automatically using advanced AI"
    },
    {
      icon: <Shield className="text-green-400" size={24} />,
      title: "Security Testing Built-in",
      description: "Identify vulnerabilities with automated security test cases"
    },
    {
      icon: <BarChart3 className="text-purple-400" size={24} />,
      title: "Detailed Analytics",
      description: "Get actionable insights with comprehensive test reports"
    },
    {
      icon: <Code className="text-orange-400" size={24} />,
      title: "RESTful API Support",
      description: "Test any REST API with multiple authentication methods"
    }
  ];

  const testimonials = [
    { company: "TechCorp" },
    { company: "StartupXYZ" },
    { company: "FinTech Co" }
  ];

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

      // Save to localStorage
      localStorage.setItem('token', data.token);

      // Fetch complete user profile
      try {
        const profileResponse = await fetch(`${API_BASE_URL}/auth/me`, {
          headers: {
            'Authorization': `Bearer ${data.token}`
          }
        });

        if (profileResponse.ok) {
          const profileData = await profileResponse.json();
          localStorage.setItem('user', JSON.stringify(profileData));

          setSuccess(isLogin ? '✅ Login successful!' : '✅ Account created successfully!');

          // Call the success callback with complete profile
          setTimeout(() => {
            onLoginSuccess(profileData);
          }, 600);
        } else {
          // Fallback to basic data if profile fetch fails
          const userData = {
            user_id: data.user_id,
            username: data.username,
            email: data.email,
            oauth_provider: 'none'
          };
          localStorage.setItem('user', JSON.stringify(userData));

          setSuccess(isLogin ? '✅ Login successful!' : '✅ Account created successfully!');

          setTimeout(() => {
            onLoginSuccess(userData);
          }, 600);
        }
      } catch (profileError) {
        // Fallback to basic data if profile fetch fails
        const userData = {
          user_id: data.user_id,
          username: data.username,
          email: data.email,
          oauth_provider: 'none'
        };
        localStorage.setItem('user', JSON.stringify(userData));

        setSuccess(isLogin ? '✅ Login successful!' : '✅ Account created successfully!');

        setTimeout(() => {
          onLoginSuccess(userData);
        }, 600);
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
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleGithubLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/github`;
  };

  const switchMode = () => {
    setIsLogin(!isLogin);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex">
      {/* Left Side - Marketing Content */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 flex-col justify-between p-12 text-white">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={24} />
            </div>
            <div>
              <div className="text-2xl font-bold">Evo-TFX</div>
              <div className="text-xs text-blue-200">by EvoluneEdgeTech</div>
            </div>
          </div>

          <div className="max-w-xl">
            <h1 className="text-5xl font-bold mb-6 leading-tight">
              Automated API Testing
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">
                Powered by AI
              </span>
            </h1>
            <p className="text-xl text-gray-300 mb-12">
              Generate comprehensive test suites in seconds. No more manual test writing. Just paste your API endpoint and let AI do the heavy lifting.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-lg flex items-center justify-center">
                    {feature.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">{feature.title}</h3>
                    <p className="text-sm text-gray-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-8 mb-12">
              <div>
                <div className="text-3xl font-bold text-blue-400">100+</div>
                <div className="text-sm text-gray-400">APIs Tested</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-purple-400">1K+</div>
                <div className="text-sm text-gray-400">Tests Generated</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-400">99.9%</div>
                <div className="text-sm text-gray-400">Uptime</div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-xl">
          <p className="text-sm text-gray-400 mb-4">Trusted by developers at</p>
          <div className="flex gap-6 text-gray-500">
            {testimonials.map((testimonial, index) => (
              <div key={index} className="bg-white/5 backdrop-blur-sm rounded-lg px-4 py-2 border border-white/10">
                <p className="text-xs text-white font-medium">{testimonial.company}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Side - Login/Signup Form */}
      <div className="w-full lg:w-1/2 xl:w-2/5 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={24} className="text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">Evo-TFX</div>
              <div className="text-xs text-gray-500">by EvoluneEdgeTech</div>
            </div>
          </div>

          <div className="mb-8">
            {/* Animated Logo/Icon Section */}
            <div className="flex justify-center mb-6">
              <div className="relative">
                {/* Animated background glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 rounded-2xl blur-xl opacity-60 animate-pulse"></div>

                {/* Main icon container with float animation */}
                <div className="relative bg-gradient-to-br from-blue-500 via-purple-600 to-pink-500 p-6 rounded-2xl shadow-2xl transform hover:scale-105 transition-transform duration-300 animate-float">
                  <Zap size={48} className="text-white" strokeWidth={2.5} />
                </div>
              </div>
            </div>

            <div className="smooth-transition">
              <h2 className="text-3xl font-bold text-gray-900 mb-2 smooth-transition">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-gray-600 smooth-transition">
                {isLogin
                  ? 'Enter your credentials to access your dashboard'
                  : 'Start testing your APIs in minutes'}
              </p>
            </div>
          </div>

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

          <div className="space-y-3 mb-6">
            <button 
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button 
              onClick={handleGithubLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 border-2 border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Github size={20} />
              Continue with GitHub
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or continue with email</span>
            </div>
          </div>

          <div className="space-y-4" key={isLogin ? 'login' : 'signup'}>
            <div className="smooth-transition">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
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
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                disabled={loading}
                required
              />
            </div>

            {isLogin && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" />
                  <span className="text-gray-600">Remember me</span>
                </label>
                <button className="text-blue-600 hover:text-blue-700 font-medium">
                  Forgot password?
                </button>
              </div>
            )}

            <button
              onClick={handleSubmit}
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
          </div>

          <div className="mt-6 text-center text-sm text-gray-600">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={switchMode}
              disabled={loading}
              className="text-blue-600 hover:text-blue-700 font-semibold disabled:opacity-50"
            >
              {isLogin ? 'Sign up for free' : 'Sign in'}
            </button>
          </div>

          {!isLogin && (
            <p className="mt-6 text-xs text-center text-gray-500">
              By creating an account, you agree to our{' '}
              <button className="text-blue-600 hover:underline">Terms of Service</button>
              {' '}and{' '}
              <button className="text-blue-600 hover:underline">Privacy Policy</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Auth;