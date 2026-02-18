import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import App from './App.jsx'
import Auth from './Auth';
import PerformanceTestingApp from './Performance_testing.jsx';
import ChaosTestingApp from './ChaosTestingApp.jsx';
import SmokeTestingApp from './SmokeTestingApp.jsx';
import FuzzTestingApp from './FuzzTestingApp.jsx';
import RegressionTestingApp from './RegressionTestingApp.jsx';
import ContractTestingApp from './ContractTestingApp.jsx';
import GraphQLTestingApp from './GraphQLTestingApp.jsx';
import AutoDiscoveryApp from './AutoDiscoveryApp.jsx';
import TestingTypesLanding from './TestingTypesLanding.jsx';
import LandingPage from './LandingPage.jsx';
import MobileBlocker from './MobileBlocker.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function AppWrapper() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Check if user is already logged in on mount AND handle OAuth callbacks
  useEffect(() => {
    const checkAuthStatus = async () => {
      // First, check for OAuth callback parameters
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');
      const userId = urlParams.get('user_id');
      const username = urlParams.get('username');
      const email = urlParams.get('email');
      const errorParam = urlParams.get('error');
      const githubConnected = urlParams.get('github_connected');

      // Handle GitHub repo connection callback - redirect to saved path
      if (githubConnected) {
        const savedPath = localStorage.getItem('github_redirect_path');
        if (savedPath && window.location.pathname !== savedPath) {
          localStorage.removeItem('github_redirect_path');
          window.location.href = savedPath + '?github_connected=' + githubConnected;
          return;
        }
      }

      // Handle OAuth error
      if (errorParam) {
        console.error('OAuth error:', errorParam);
        let errorMessage = 'Authentication failed. Please try again.';
        if (errorParam === 'google_auth_failed') {
          errorMessage = 'Google authentication failed. Please try again.';
        } else if (errorParam === 'github_auth_failed') {
          errorMessage = 'GitHub authentication failed. Please try again.';
        }
        setAuthError(errorMessage);
        window.history.replaceState({}, document.title, '/');
        setLoading(false);
        return;
      }

      // Handle OAuth success - callback from Google/GitHub
      if (token && userId && username && email) {
        // Save token to localStorage
        localStorage.setItem('token', token);

        try {
          // Fetch complete user profile
          const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });

          if (response.ok) {
            const profileData = await response.json();
            localStorage.setItem('user', JSON.stringify(profileData));
            setUser(profileData);
          } else {
            // Fallback to basic data
            const userData = {
              user_id: userId,
              username: username,
              email: email,
              oauth_provider: 'oauth'
            };
            localStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
          }
        } catch (err) {
          // Fallback to basic data if profile fetch fails
          const userData = {
            user_id: userId,
            username: username,
            email: email,
            oauth_provider: 'oauth'
          };
          localStorage.setItem('user', JSON.stringify(userData));
          setUser(userData);
        }

        // Clean URL parameters
        window.history.replaceState({}, document.title, '/');
        setLoading(false);
        return;
      }

      // Check for saved user in localStorage (normal flow)
      const savedUser = localStorage.getItem('user');
      const savedToken = localStorage.getItem('token');

      if (savedUser && savedToken) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
        } catch (error) {
          console.error('Error parsing saved user data:', error);
          localStorage.removeItem('user');
          localStorage.removeItem('token');
        }
      }

      setLoading(false);
    };

    checkAuthStatus();
  }, []);

  // Handle successful login
  const handleLogin = (userData) => {
    setUser(userData);
  };

  // Handle logout
  const handleLogout = async () => {
    setLoggingOut(true);

    // Show logout animation for 1.5 seconds
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Call backend logout endpoint
    try {
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
    } catch (err) {
      console.error('Logout error:', err);
    }

    // Clear user data
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    setLoggingOut(false);
  };

  // Loading screen
  if (loading) {
    // Check if we're processing OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthCallback = urlParams.get('token') && urlParams.get('user_id');

    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-white mx-auto mb-4"></div>
          <p className="text-white text-xl font-semibold">
            {isOAuthCallback ? '🎉 Login successful! Loading your dashboard...' : 'Loading...'}
          </p>
          {isOAuthCallback && (
            <p className="text-white/80 text-sm mt-2">Please wait while we set up your workspace</p>
          )}
        </div>
      </div>
    );
  }

  // Logout loading screen
  if (loggingOut) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-purple-400 mx-auto mb-4"></div>
            <div className="absolute inset-0 rounded-full h-16 w-16 border-4 border-purple-400/20 mx-auto animate-pulse"></div>
          </div>
          <p className="text-white text-xl font-semibold mb-2">
            👋 Logging out...
          </p>
          <p className="text-gray-300 text-sm">
            See you soon!
          </p>
        </div>
      </div>
    );
  }

  // If not logged in, show Landing Page
  if (!user) {
    return (
      <MobileBlocker>
        <LandingPage onLoginSuccess={handleLogin} authError={authError} />
      </MobileBlocker>
    );
  }

  // If logged in, show Router with routes
  return (
    <MobileBlocker>
      <Router>
        <Routes>
          <Route path="/" element={<TestingTypesLanding user={user} onLogout={handleLogout} />} />
          <Route path="/functional" element={<App user={user} onLogout={handleLogout} />} />
          <Route path="/smoke" element={<SmokeTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/performance" element={<PerformanceTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/chaos" element={<ChaosTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/fuzz" element={<FuzzTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/regression" element={<RegressionTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/contract" element={<ContractTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/graphql" element={<GraphQLTestingApp user={user} onLogout={handleLogout} />} />
          <Route path="/auto-discovery" element={<AutoDiscoveryApp user={user} onLogout={handleLogout} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MobileBlocker>
  );
}

export default AppWrapper;