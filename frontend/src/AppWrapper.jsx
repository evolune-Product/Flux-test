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
const DownloadApp = lazy(() => import("./DownloadApp.jsx"));

import LandingPage from "./LandingPage.jsx";
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
  return null;
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
  // Keep the app shell lightweight and avoid showing a full-screen loader on reload.
  const [loading, setLoading] = useState(false);
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

  if (loading) {
    return null;
  }

  if (loggingOut) {
    return null;
  }

  // Public shared flow — no authentication required
  const sharedFlowMatch = window.location.pathname.match(
    /^\/flow\/([a-zA-Z0-9_-]+)/,
  );
  if (sharedFlowMatch) {
    return (
      <Suspense fallback={null}>
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
      <Suspense fallback={null}>
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
      <Suspense fallback={null}>
        <NoIndex>
          <SharedDashboardApp token={dashMatch[1]} />
        </NoIndex>
      </Suspense>
    );
  }

  // FullSend public report — no authentication required
  const fullSendReportMatch = window.location.pathname.match(
    /^\/report\/fullsend\/([a-zA-Z0-9_-]+)/,
  );
  if (fullSendReportMatch) {
    return (
      <Suspense fallback={null}>
        <NoIndex>
          <FullSendReportApp token={fullSendReportMatch[1]} />
        </NoIndex>
      </Suspense>
    );
  }

  // Public download page should stay available before login as well.
  if (window.location.pathname === "/download") {
    return (
      <Suspense fallback={null}>
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
<AppPageShell>
  <LandingPage
    onLoginSuccess={handleLogin}
    authError={authError}
  />
</AppPageShell>
    );
  }

  // If logged in, show Router with routes.
  // One Suspense at the Router level covers all lazy route chunks.
  return (
    <Suspense fallback={null}>
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
