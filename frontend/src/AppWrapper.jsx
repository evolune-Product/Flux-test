import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import TrialGate from './TrialGate.jsx';
import { useTrialCounter } from './hooks/useTrialCounter.js';
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
import VibeTestingApp from './VibeTestingApp.jsx';
import TestHistoryApp from './TestHistoryApp.jsx';
import SharedReportApp from './SharedReportApp.jsx';
import SharedDashboardApp from './SharedDashboardApp.jsx';
import FullSendApp from './FullSendApp.jsx';
import FullSendReportApp from './FullSendReportApp.jsx';
import VisualBuilderApp from './VisualBuilderApp.jsx';
import IntegrationTestingApp from './IntegrationTestingApp.jsx';
import SharedFlowApp from './SharedFlowApp.jsx';
import TestingTypesLanding from './TestingTypesLanding.jsx';
import RequestBuilderApp from './RequestBuilderApp.jsx';
import DesktopShell from './DesktopShell.jsx';
import AppHome from './AppHome.jsx';
import SuitesPage from './SuitesPage.jsx';
import AccountApp from './AccountApp.jsx';
import LandingPage from './LandingPage.jsx';
// PROD-GATE: import (remove this line to disable the module)
import ProductionGateApp from './ProductionGateApp.jsx';
import MobileBlocker from './MobileBlocker.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

const LOCAL_MODE = import.meta.env.VITE_LOCAL_MODE === '1';
const API_BASE_URL = LOCAL_MODE
  ? window.location.origin
  : (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000');

function AppWrapper() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  // Check if user is already logged in on mount AND handle OAuth callbacks
  useEffect(() => {
    const checkAuthStatus = async () => {
      // Desktop/local mode: auto-login with the built-in local workspace user
      if (LOCAL_MODE) {
        try {
          const response = await fetch(`${API_BASE_URL}/auth/local`);
          if (response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user));
            setUser(data.user);
            setLoading(false);
            return;
          }
        } catch (err) {
          console.error('Local mode auto-login failed:', err);
        }
        // Backend may still be starting up (Electron launch) — retry shortly
        setTimeout(checkAuthStatus, 1000);
        return;
      }

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

    // Clear all testing suite state so results don't persist across sessions
    const testingKeys = [
      'performanceTestingState',
      'smokeTestingState',
      'chaosTestingState',
      'fuzzTestingState',
      'regressionTestingState',
      'contractTestingState',
      'graphqlTestingState',
      'autoDiscoveryState',
      'discoveryData',
      'github_redirect_path',
    ];
    testingKeys.forEach(key => localStorage.removeItem(key));

    // Desktop/local mode: there is no login screen — sign straight back
    // into the local workspace after clearing session state.
    if (LOCAL_MODE) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/local`);
        if (response.ok) {
          const data = await response.json();
          localStorage.setItem('token', data.token);
          localStorage.setItem('user', JSON.stringify(data.user));
          setUser(data.user);
        }
      } catch (err) {
        console.error('Local mode re-login failed:', err);
      }
    }

    setLoggingOut(false);
  };

  // Loading screen - Creative OAuth Animation
  if (loading) {
    // Check if we're processing OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthCallback = urlParams.get('token') && urlParams.get('user_id');

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating orbs */}
          <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl" style={{ animation: 'floatOrb 8s ease-in-out infinite' }} />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl" style={{ animation: 'floatOrb 10s ease-in-out infinite reverse' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" style={{ animation: 'pulseOrb 4s ease-in-out infinite' }} />

          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/30 rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `particle ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`
              }}
            />
          ))}
        </div>

        <div className="relative text-center z-10">
          {/* Main loader container */}
          <div className="relative w-32 h-32 mx-auto mb-8">
            {/* Outer spinning ring */}
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent"
              style={{
                borderTopColor: '#3b82f6',
                borderRightColor: '#06b6d4',
                animation: 'spinRing 1.5s linear infinite'
              }}
            />

            {/* Middle pulsing ring */}
            <div
              className="absolute inset-3 rounded-full border-2 border-blue-400/30"
              style={{ animation: 'pulseRing 2s ease-in-out infinite' }}
            />

            {/* Inner spinning ring (reverse) */}
            <div
              className="absolute inset-6 rounded-full border-2 border-transparent"
              style={{
                borderBottomColor: '#3b82f6',
                borderLeftColor: '#06b6d4',
                animation: 'spinRing 2s linear infinite reverse'
              }}
            />

            {/* Center logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ animation: 'logoFloat 3s ease-in-out infinite' }}>
                <img src="/flasqo-logo.png" alt="Flasqo" style={{ height: '90px', width: 'auto', objectFit: 'contain', mixBlendMode: 'screen' }} />
              </div>
            </div>

            {/* Orbiting dots */}
            <div className="absolute inset-0" style={{ animation: 'spinRing 3s linear infinite' }}>
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full shadow-lg shadow-cyan-500/50" />
            </div>
            <div className="absolute inset-0" style={{ animation: 'spinRing 4s linear infinite reverse' }}>
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full shadow-lg shadow-cyan-500/50" />
            </div>
          </div>

          {/* Text content */}
          <div style={{ animation: 'fadeInUp 0.6s ease-out' }}>
            <h2 className="text-3xl font-bold mb-3">
              <span
                className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-200 bg-clip-text text-transparent"
                style={{ backgroundSize: '200% 200%', animation: 'gradientShift 3s ease-in-out infinite' }}
              >
                {isOAuthCallback ? 'Welcome Back!' : 'Loading'}
              </span>
            </h2>

            <p className="text-gray-300 text-lg mb-6">
              {isOAuthCallback ? 'Setting up your workspace...' : 'Preparing your experience...'}
            </p>

            {/* Progress bar */}
            <div className="w-64 mx-auto h-1 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400 rounded-full"
                style={{
                  width: '100%',
                  animation: 'progressSlide 2s ease-in-out infinite'
                }}
              />
            </div>

            {/* Status indicators */}
            {isOAuthCallback && (
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full" style={{ animation: 'pulse 1s ease-in-out infinite' }} />
                  <span>Authenticated</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full" style={{ animation: 'pulse 1s ease-in-out 0.3s infinite' }} />
                  <span>Loading profile</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full" style={{ animation: 'pulse 1s ease-in-out 0.6s infinite' }} />
                  <span>Almost ready</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes floatOrb {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-30px) scale(1.1); }
          }
          @keyframes pulseOrb {
            0%, 100% { opacity: 0.15; transform: translate(-50%, -50%) scale(1); }
            50% { opacity: 0.25; transform: translate(-50%, -50%) scale(1.2); }
          }
          @keyframes particle {
            0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
            25% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
            50% { transform: translateY(-10px) translateX(-10px); opacity: 0.3; }
            75% { transform: translateY(-30px) translateX(5px); opacity: 0.6; }
          }
          @keyframes spinRing {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulseRing {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(1.05); }
          }
          @keyframes logoFloat {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50% { transform: translateY(-5px) rotate(5deg); }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes gradientShift {
            0%, 100% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
          }
          @keyframes progressSlide {
            0% { transform: translateX(-100%); }
            50% { transform: translateX(0%); }
            100% { transform: translateX(100%); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  // Logout loading screen - Creative Animation
  if (loggingOut) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" style={{ animation: 'shrinkOrb 1.5s ease-in-out forwards' }} />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl" style={{ animation: 'shrinkOrb 1.5s ease-in-out 0.2s forwards' }} />
        </div>

        <div className="relative text-center z-10">
          {/* Goodbye animation container */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            {/* Fading rings */}
            <div
              className="absolute inset-0 rounded-full border-2 border-blue-400/40"
              style={{ animation: 'fadeOutRing 1.5s ease-out forwards' }}
            />
            <div
              className="absolute inset-4 rounded-full border-2 border-blue-400/30"
              style={{ animation: 'fadeOutRing 1.5s ease-out 0.2s forwards' }}
            />

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center"
                style={{ animation: 'waveGoodbye 1.5s ease-in-out forwards' }}
              >
                <span className="text-2xl">👋</span>
              </div>
            </div>
          </div>

          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ animation: 'fadeOutUp 1.5s ease-out forwards' }}
          >
            See you soon!
          </h2>
          <p
            className="text-gray-400"
            style={{ animation: 'fadeOutUp 1.5s ease-out 0.1s forwards' }}
          >
            Logging you out safely...
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-blue-400 rounded-full"
                style={{ animation: `dotFade 1s ease-in-out ${i * 0.2}s infinite` }}
              />
            ))}
          </div>
        </div>

        <style>{`
          @keyframes shrinkOrb {
            to { transform: scale(0); opacity: 0; }
          }
          @keyframes fadeOutRing {
            0% { transform: scale(1); opacity: 0.4; }
            100% { transform: scale(1.5); opacity: 0; }
          }
          @keyframes waveGoodbye {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-15deg); }
            75% { transform: rotate(15deg); }
          }
          @keyframes fadeOutUp {
            0% { opacity: 1; transform: translateY(0); }
            100% { opacity: 0.8; transform: translateY(-5px); }
          }
          @keyframes dotFade {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
        `}</style>
      </div>
    );
  }

  // Public shared flow — no authentication required
  const sharedFlowMatch = window.location.pathname.match(/^\/flow\/([a-zA-Z0-9_-]+)/);
  if (sharedFlowMatch) {
    return <SharedFlowApp token={sharedFlowMatch[1]} />;
  }

  // Public report page — no authentication required
  const reportMatch = window.location.pathname.match(/^\/report\/([a-zA-Z0-9_-]+)/);
  if (reportMatch) {
    return <SharedReportApp token={reportMatch[1]} />;
  }

  // Public shared dashboard — no authentication required
  const dashMatch = window.location.pathname.match(/^\/dashboard\/([a-zA-Z0-9_-]+)/);
  if (dashMatch) {
    return <SharedDashboardApp token={dashMatch[1]} />;
  }

  // FullSend public report — no authentication required
  const fullSendReportMatch = window.location.pathname.match(/^\/fullsend-report\/([a-zA-Z0-9_-]+)/);
  if (fullSendReportMatch) {
    return <FullSendReportApp token={fullSendReportMatch[1]} />;
  }

  // If not logged in, show Landing Page
  if (!user) {
    return (
      <MobileBlocker>
        <LandingPage onLoginSuccess={handleLogin} authError={authError} />
      </MobileBlocker>
    );
  }

  // Desktop/local mode: wrap everything in the native app shell (persistent icon rail)
  // and use the app-style home + suites launcher instead of the marketing landing.
  if (LOCAL_MODE) {
    return <DesktopLocalApp user={user} onLogout={handleLogout} onLogin={handleLogin} />;
  }

  // If logged in, show Router with routes
  return (
    <MobileBlocker>
      <Router>
        <Routes>
          <Route path="/" element={<ErrorBoundary><TestingTypesLanding user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/request-builder" element={<ErrorBoundary><RequestBuilderApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/functional" element={<ErrorBoundary><App user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/smoke" element={<ErrorBoundary><SmokeTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/performance" element={<ErrorBoundary><PerformanceTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/chaos" element={<ErrorBoundary><ChaosTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/fuzz" element={<ErrorBoundary><FuzzTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/regression" element={<ErrorBoundary><RegressionTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/contract" element={<ErrorBoundary><ContractTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/graphql" element={<ErrorBoundary><GraphQLTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/auto-discovery" element={<ErrorBoundary><AutoDiscoveryApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/vibe-testing" element={<ErrorBoundary><VibeTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/history" element={<ErrorBoundary><TestHistoryApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/fullsend" element={<ErrorBoundary><FullSendApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/flow-builder" element={<ErrorBoundary><VisualBuilderApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="/integration" element={<ErrorBoundary><IntegrationTestingApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          {/* PROD-GATE: route (remove this line to disable the module) */}
          <Route path="/prod-gate" element={<ErrorBoundary><ProductionGateApp user={user} onLogout={handleLogout} /></ErrorBoundary>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MobileBlocker>
  );
}

// Routes that count as a "trial run" when navigated to
const TEST_ROUTES = [
  '/functional', '/smoke', '/performance', '/chaos',
  '/fuzz', '/regression', '/contract', '/graphql', '/auto-discovery',
  '/vibe-testing', '/fullsend', '/flow-builder', '/integration', '/prod-gate',
];

// Watches location changes and increments trial counter for test-suite routes.
// Must live inside <Router> to use useLocation().
function TrialTracker({ onVisit }) {
  const location = useLocation();
  useEffect(() => {
    if (TEST_ROUTES.includes(location.pathname)) {
      onVisit(location.pathname);
    }
  }, [location.pathname]);
  return null;
}

// Standalone component for LOCAL_MODE so hooks (useTrialCounter) can be called
// unconditionally at the top level and useLocation is available inside Router.
function DesktopLocalApp({ user, onLogout, onLogin }) {
  const { trialCount, isExpired, increment, reset } = useTrialCounter();
  const isLocalUser = user?.username === 'local';

  const handleTrialLogin = (userData) => {
    reset();       // clear trial counter
    onLogin(userData);
  };

  // GatedRoute: renders TrialGate instead of the suite when trial is exhausted
  // and the user is still on the built-in local account.
  const GatedRoute = ({ element }) =>
    isExpired && isLocalUser
      ? <TrialGate onLogin={handleTrialLogin} />
      : element;

  return (
    <Router>
      <TrialTracker onVisit={increment} />
      <DesktopShell
        user={user}
        onLogout={onLogout}
        trialCount={trialCount}
        isLocalUser={isLocalUser}
      >
        <Routes>
          {/* Free routes — never gated */}
          <Route path="/" element={<ErrorBoundary><AppHome user={user} /></ErrorBoundary>} />
          <Route path="/suites" element={<ErrorBoundary><SuitesPage /></ErrorBoundary>} />
          <Route path="/request-builder" element={<ErrorBoundary><RequestBuilderApp user={user} onLogout={onLogout} /></ErrorBoundary>} />
          <Route path="/history" element={<ErrorBoundary><TestHistoryApp user={user} onLogout={onLogout} /></ErrorBoundary>} />
          <Route path="/settings" element={<ErrorBoundary><AccountApp /></ErrorBoundary>} />

          {/* Gated test-suite routes */}
          <Route path="/functional" element={<GatedRoute element={<ErrorBoundary><App user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/smoke" element={<GatedRoute element={<ErrorBoundary><SmokeTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/performance" element={<GatedRoute element={<ErrorBoundary><PerformanceTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/chaos" element={<GatedRoute element={<ErrorBoundary><ChaosTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/fuzz" element={<GatedRoute element={<ErrorBoundary><FuzzTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/regression" element={<GatedRoute element={<ErrorBoundary><RegressionTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/contract" element={<GatedRoute element={<ErrorBoundary><ContractTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/graphql" element={<GatedRoute element={<ErrorBoundary><GraphQLTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/auto-discovery" element={<GatedRoute element={<ErrorBoundary><AutoDiscoveryApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/vibe-testing" element={<GatedRoute element={<ErrorBoundary><VibeTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/fullsend" element={<GatedRoute element={<ErrorBoundary><FullSendApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/flow-builder" element={<GatedRoute element={<ErrorBoundary><VisualBuilderApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/integration" element={<GatedRoute element={<ErrorBoundary><IntegrationTestingApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />
          <Route path="/prod-gate" element={<GatedRoute element={<ErrorBoundary><ProductionGateApp user={user} onLogout={onLogout} /></ErrorBoundary>} />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DesktopShell>
    </Router>
  );
}

export default AppWrapper;