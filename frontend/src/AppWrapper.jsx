import { lazy, Suspense, useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// ── Lazy-loaded route components ────────────────────────────────────────────
// Each testing app is only downloaded when the user first visits that route.
// Startup bundle drops ~60-70%; subsequent visits are instant (cached chunk).
const App = lazy(() => import("./App.jsx"));
const Auth = lazy(() => import("./Auth"));
const PerformanceTestingApp = lazy(() => import("./Performance_testing.jsx"));
const ChaosTestingApp = lazy(() => import("./ChaosTestingApp.jsx"));
const SmokeTestingApp = lazy(() => import("./SmokeTestingApp.jsx"));
const FuzzTestingApp = lazy(() => import("./FuzzTestingApp.jsx"));
const RegressionTestingApp = lazy(() => import("./RegressionTestingApp.jsx"));
const ContractTestingApp = lazy(() => import("./ContractTestingApp.jsx"));
const GraphQLTestingApp = lazy(() => import("./GraphQLTestingApp.jsx"));
const AutoDiscoveryApp = lazy(() => import("./AutoDiscoveryApp.jsx"));
const VibeTestingApp = lazy(() => import("./VibeTestingApp.jsx"));
const TestHistoryApp = lazy(() => import("./TestHistoryApp.jsx"));
const SharedReportApp = lazy(() => import("./SharedReportApp.jsx"));
const SharedDashboardApp = lazy(() => import("./SharedDashboardApp.jsx"));
const FullSendApp = lazy(() => import("./FullSendApp.jsx"));
const FullSendReportApp = lazy(() => import("./FullSendReportApp.jsx"));
const VisualBuilderApp = lazy(() => import("./VisualBuilderApp.jsx"));
const IntegrationTestingApp = lazy(() => import("./IntegrationTestingApp.jsx"));
const SharedFlowApp = lazy(() => import("./SharedFlowApp.jsx"));
const TestingTypesLanding = lazy(() => import("./TestingTypesLanding.jsx"));
const LandingPage = lazy(() => import("./LandingPage.jsx"));
const DownloadApp = lazy(() => import("./DownloadApp.jsx"));
// PROD-GATE: import (remove this line to disable the module)
const ProductionGateApp = lazy(() => import("./ProductionGateApp.jsx"));

// ── Static infrastructure (tiny, always needed) ─────────────────────────────
import ErrorBoundary from "./ErrorBoundary.jsx";
import { setPageMeta, NOINDEX_META } from "./seo.js";
import { API_BASE_URL } from "./lib/api.js";

// ── Page skeleton fallback ───────────────────────────────────────────────────
// Shown by Suspense while a chunk is downloading (typically <200ms on first visit).
// Intentionally minimal — no imports, no animation library needed.
function PageSkeleton() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#020617",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid #1e293b",
          borderTopColor: "#3b82f6",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Wraps user-generated / auth-gated views so search engines never index them.
function NoIndex({ children }) {
  useEffect(() => {
    setPageMeta(NOINDEX_META);
  }, []);
  return children;
}

function AppPageShell({ children }) {
  return (
    <div className="relative min-h-screen">
      <div className="min-h-screen">{children}</div>
    </div>
  );
}

function AppWrapper() {
  const [user, setUser] = useState(() => {
    // Initialise synchronously so returning users never see the landing page flash
    try {
      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("token");
      if (savedUser && savedToken) return JSON.parse(savedUser);
    } catch {}
    return null;
  });
  // Only show loading screen during OAuth callback processing
  const [loading, setLoading] = useState(
    () => !!new URLSearchParams(window.location.search).get("token"),
  );
  const [authError, setAuthError] = useState(null);
  const [loggingOut, setLoggingOut] = useState(false);

  /**
   * Token → user session handler.
   * Fetches a full profile from /auth/me; falls back to the raw params on failure.
   */
  const applyOAuthToken = async ({ token, userId, username, email }) => {
    localStorage.setItem("token", token);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const profileData = await response.json();
        localStorage.setItem("user", JSON.stringify(profileData));
        setUser(profileData);
        return;
      }
    } catch (err) {
      console.error("[auth] /auth/me fetch failed:", err);
    }
    // Fallback to the params we already have
    const userData = {
      user_id: userId,
      username,
      email,
      oauth_provider: "oauth",
    };
    localStorage.setItem("user", JSON.stringify(userData));
    setUser(userData);
  };

  // Check if user is already logged in on mount AND handle OAuth callbacks
  useEffect(() => {
    const checkAuthStatus = async () => {
      // First, check for OAuth callback parameters
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get("token");
      const userId = urlParams.get("user_id");
      const username = urlParams.get("username");
      const email = urlParams.get("email");
      const errorParam = urlParams.get("error");
      const githubConnected = urlParams.get("github_connected");

      // Handle GitHub repo connection callback - redirect to saved path
      if (githubConnected) {
        const savedPath = localStorage.getItem("github_redirect_path");
        if (savedPath && window.location.pathname !== savedPath) {
          localStorage.removeItem("github_redirect_path");
          window.location.href =
            savedPath + "?github_connected=" + githubConnected;
          return;
        }
      }

      // Handle OAuth error
      if (errorParam) {
        console.error("OAuth error:", errorParam);
        let errorMessage = "Authentication failed. Please try again.";
        if (errorParam === "google_auth_failed") {
          errorMessage = "Google authentication failed. Please try again.";
        } else if (errorParam === "github_auth_failed") {
          errorMessage = "GitHub authentication failed. Please try again.";
        }
        setAuthError(errorMessage);
        window.history.replaceState({}, document.title, "/");
        setLoading(false);
        return;
      }

      // Handle OAuth success - callback from Google/GitHub (web flow)
      if (token && userId && username && email) {
        await applyOAuthToken({ token, userId, username, email });
        window.history.replaceState({}, document.title, "/");
        setLoading(false);
        return;
      }

      // Check for saved user in localStorage (normal flow)
      const savedUser = localStorage.getItem("user");
      const savedToken = localStorage.getItem("token");

      if (savedUser && savedToken) {
        try {
          const userData = JSON.parse(savedUser);
          setUser(userData);
          setLoading(false);
          return;
        } catch (error) {
          console.error("Error parsing saved user data:", error);
          localStorage.removeItem("user");
          localStorage.removeItem("token");
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
  const handleLogout = () => {
    // Fire-and-forget — backend endpoint is a no-op
    fetch(`${API_BASE_URL}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    }).catch(() => {});

    // Clear session immediately (security — token gone before animation ends)
    [
      "user",
      "token",
      "performanceTestingState",
      "smokeTestingState",
      "chaosTestingState",
      "fuzzTestingState",
      "regressionTestingState",
      "contractTestingState",
      "graphqlTestingState",
      "autoDiscoveryState",
      "discoveryData",
      "github_redirect_path",
    ].forEach((k) => localStorage.removeItem(k));
    setUser(null);

    // Show "See you soon" for 2 s, then let AppWrapper render landing
    setLoggingOut(true);
    setTimeout(() => setLoggingOut(false), 2000);
  };

  // Loading screen - Creative OAuth Animation
  if (loading) {
    // Check if we're processing OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const isOAuthCallback = urlParams.get("token") && urlParams.get("user_id");

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Floating orbs */}
          <div
            className="absolute top-20 left-20 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl"
            style={{ animation: "floatOrb 8s ease-in-out infinite" }}
          />
          <div
            className="absolute bottom-20 right-20 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl"
            style={{ animation: "floatOrb 10s ease-in-out infinite reverse" }}
          />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl"
            style={{ animation: "pulseOrb 4s ease-in-out infinite" }}
          />

          {/* Floating particles */}
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1 h-1 bg-white/30 rounded-full"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animation: `particle ${3 + Math.random() * 4}s ease-in-out infinite`,
                animationDelay: `${Math.random() * 2}s`,
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
                borderTopColor: "#3b82f6",
                borderRightColor: "#06b6d4",
                animation: "spinRing 1.5s linear infinite",
              }}
            />

            {/* Middle pulsing ring */}
            <div
              className="absolute inset-3 rounded-full border-2 border-blue-400/30"
              style={{ animation: "pulseRing 2s ease-in-out infinite" }}
            />

            {/* Inner spinning ring (reverse) */}
            <div
              className="absolute inset-6 rounded-full border-2 border-transparent"
              style={{
                borderBottomColor: "#3b82f6",
                borderLeftColor: "#06b6d4",
                animation: "spinRing 2s linear infinite reverse",
              }}
            />

            {/* Center logo */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div style={{ animation: "logoFloat 3s ease-in-out infinite" }}>
                <img
                  src="/flasqo-logo.png"
                  alt="Flasqo"
                  style={{
                    height: "90px",
                    width: "auto",
                    objectFit: "contain",
                    mixBlendMode: "screen",
                  }}
                />
              </div>
            </div>

            {/* Orbiting dots */}
            <div
              className="absolute inset-0"
              style={{ animation: "spinRing 3s linear infinite" }}
            >
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full shadow-lg shadow-cyan-500/50" />
            </div>
            <div
              className="absolute inset-0"
              style={{ animation: "spinRing 4s linear infinite reverse" }}
            >
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-2 h-2 bg-gradient-to-r from-cyan-400 to-blue-400 rounded-full shadow-lg shadow-cyan-500/50" />
            </div>
          </div>

          {/* Text content */}
          <div style={{ animation: "fadeInUp 0.6s ease-out" }}>
            <h2 className="text-3xl font-bold mb-3">
              <span
                className="bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-200 bg-clip-text text-transparent"
                style={{
                  backgroundSize: "200% 200%",
                  animation: "gradientShift 3s ease-in-out infinite",
                }}
              >
                {isOAuthCallback ? "Welcome Back!" : "Loading"}
              </span>
            </h2>

            <p className="text-gray-300 text-lg mb-6">
              {isOAuthCallback
                ? "Setting up your workspace..."
                : "Preparing your experience..."}
            </p>

            {/* Progress bar */}
            <div className="w-64 mx-auto h-1 bg-slate-700/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400 rounded-full"
                style={{
                  width: "100%",
                  animation: "progressSlide 2s ease-in-out infinite",
                }}
              />
            </div>

            {/* Status indicators */}
            {isOAuthCallback && (
              <div className="mt-6 flex items-center justify-center gap-6 text-sm text-gray-400">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 bg-green-400 rounded-full"
                    style={{ animation: "pulse 1s ease-in-out infinite" }}
                  />
                  <span>Authenticated</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 bg-blue-400 rounded-full"
                    style={{ animation: "pulse 1s ease-in-out 0.3s infinite" }}
                  />
                  <span>Loading profile</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 bg-cyan-400 rounded-full"
                    style={{ animation: "pulse 1s ease-in-out 0.6s infinite" }}
                  />
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
          <div
            className="absolute top-1/4 left-1/4 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl"
            style={{ animation: "shrinkOrb 1.5s ease-in-out forwards" }}
          />
          <div
            className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"
            style={{ animation: "shrinkOrb 1.5s ease-in-out 0.2s forwards" }}
          />
        </div>

        <div className="relative text-center z-10">
          {/* Goodbye animation container */}
          <div className="relative w-28 h-28 mx-auto mb-8">
            {/* Fading rings */}
            <div
              className="absolute inset-0 rounded-full border-2 border-blue-400/40"
              style={{ animation: "fadeOutRing 1.5s ease-out forwards" }}
            />
            <div
              className="absolute inset-4 rounded-full border-2 border-blue-400/30"
              style={{ animation: "fadeOutRing 1.5s ease-out 0.2s forwards" }}
            />

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="w-14 h-14 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl flex items-center justify-center"
                style={{ animation: "waveGoodbye 1.5s ease-in-out forwards" }}
              >
                <span className="text-2xl">👋</span>
              </div>
            </div>
          </div>

          <h2
            className="text-2xl font-bold text-white mb-2"
            style={{ animation: "fadeOutUp 1.5s ease-out forwards" }}
          >
            See you soon!
          </h2>
          <p
            className="text-gray-400"
            style={{ animation: "fadeOutUp 1.5s ease-out 0.1s forwards" }}
          >
            Logging you out safely...
          </p>

          {/* Progress dots */}
          <div className="flex items-center justify-center gap-2 mt-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-2 h-2 bg-blue-400 rounded-full"
                style={{
                  animation: `dotFade 1s ease-in-out ${i * 0.2}s infinite`,
                }}
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
  const sharedFlowMatch = window.location.pathname.match(
    /^\/flow\/([a-zA-Z0-9_-]+)/,
  );
  if (sharedFlowMatch) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <NoIndex>
          <SharedFlowApp token={sharedFlowMatch[1]} />
        </NoIndex>
      </Suspense>
    );
  }

  // Public report page — no authentication required
  const reportMatch = window.location.pathname.match(
    /^\/report\/([a-zA-Z0-9_-]+)/,
  );
  if (reportMatch) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <NoIndex>
          <SharedReportApp token={reportMatch[1]} />
        </NoIndex>
      </Suspense>
    );
  }

  // Public shared dashboard — no authentication required
  const dashMatch = window.location.pathname.match(
    /^\/dashboard\/([a-zA-Z0-9_-]+)/,
  );
  if (dashMatch) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <NoIndex>
          <SharedDashboardApp token={dashMatch[1]} />
        </NoIndex>
      </Suspense>
    );
  }

  // FullSend public report — no authentication required
  const fullSendReportMatch = window.location.pathname.match(
    /^\/fullsend-report\/([a-zA-Z0-9_-]+)/,
  );
  if (fullSendReportMatch) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <NoIndex>
          <FullSendReportApp token={fullSendReportMatch[1]} />
        </NoIndex>
      </Suspense>
    );
  }

  // Public download page should stay available before login as well.
  if (window.location.pathname === "/download") {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AppPageShell>
          <DownloadApp />
        </AppPageShell>
      </Suspense>
    );
  }

  // If not logged in, show Landing Page.
  // No MobileBlocker here: Google indexes mobile-first (Googlebot Smartphone),
  // so blocking small screens would make "Mobile Device Detected" the page
  // Google sees. The marketing page must render for every visitor.
  if (!user) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <AppPageShell>
          <LandingPage onLoginSuccess={handleLogin} authError={authError} />
        </AppPageShell>
      </Suspense>
    );
  }

  // If logged in, show Router with routes.
  // One Suspense at the Router level covers all lazy route chunks.
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Router>
        <Routes>
          <Route
            path="/"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <TestingTypesLanding user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/functional"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <App user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/smoke"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <SmokeTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/performance"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <PerformanceTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/chaos"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <ChaosTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/fuzz"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <FuzzTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/regression"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <RegressionTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/contract"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <ContractTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/graphql"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <GraphQLTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/auto-discovery"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <AutoDiscoveryApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/vibe-testing"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <VibeTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/history"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <TestHistoryApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/fullsend"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <FullSendApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/flow-builder"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <VisualBuilderApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/integration"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <IntegrationTestingApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route
            path="/download"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <DownloadApp />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          {/* PROD-GATE: route (remove this line to disable the module) */}
          <Route
            path="/prod-gate"
            element={
              <ErrorBoundary>
                <AppPageShell>
                  <ProductionGateApp user={user} onLogout={handleLogout} />
                </AppPageShell>
              </ErrorBoundary>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </Suspense>
  );
}

export default AppWrapper;
