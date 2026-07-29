import React, { useState, useEffect, useRef } from "react";
import { setPageMeta, HOME_META } from "./seo.js";
import {
  Zap,
  Shield,
  Activity,
  Users,
  CheckCircle,
  Globe,
  Rocket,
  Lock,
  Sparkles,
  ArrowRight,
  Github,
  Twitter,
  Linkedin,
  Mail,
  Play,
} from "lucide-react";
import AuthModal from "./AuthModal";
import Toast from "./Toast";
import UrlScannerInput from "./components/UrlScannerInput";

import {
  FlasqoTrafficVisualizer,
  ComparisonMatrix,
  ReviewsMarquee,
  PipelineDiagram,
  FaqSection,
  TypewriterSnippet,
} from "./landing/LandingSections";
import { DIFFERENTIATORS } from "./landing/content";

const LandingPage = ({ onLoginSuccess, authError }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login"); // 'login' or 'signup'
  const [terminalKey, setTerminalKey] = useState(0);
  const [toast, setToast] = useState(null);
  const [landingUrl, setLandingUrl] = useState("");
  const [landingError, setLandingError] = useState("");
  const [landingScanning, setLandingScanning] = useState(false);
  const [landingReportUrl, setLandingReportUrl] = useState("");
  const [landingProgress, setLandingProgress] = useState({ value: 0, phase: "" });
  const [landingReport, setLandingReport] = useState(null);
  const landingInputRef = useRef(null);
  const landingPollRef = useRef(null);

  // The landing page renders for logged-out visitors on any path, so keep the
  // homepage title/description/canonical authoritative for all of them.
  useEffect(() => {
    setPageMeta(HOME_META);
  }, []);

<<<<<<< HEAD
=======
  useEffect(() => {
    const id = setInterval(() => setTerminalKey(k => k + 1), 5500);
    return () => clearInterval(id);
  }, []);

>>>>>>> origin/master
  // Show error toast if OAuth failed
  useEffect(() => {
    if (authError) {
      setToast({
        message: authError,
        type: "error",
      });
    }
  }, [authError]);
  const [stats, setStats] = useState({
    users: 0,
    testsRun: 0,
    apisSecured: 0,
    uptime: 0,
  });

  // Animate stats counting up
  useEffect(() => {
    const targetStats = {
      users: 15,
      testsRun: 1000,
      apisSecured: 10,
      uptime: 99.9,
    };

    const duration = 2000; // 2 seconds
    const steps = 60;
    const interval = duration / steps;

    let currentStep = 0;
    const timer = setInterval(() => {
      currentStep++;
      const progress = currentStep / steps;

      setStats({
        users: Math.floor(targetStats.users * progress),
        testsRun: Math.floor(targetStats.testsRun * progress),
        apisSecured: Math.floor(targetStats.apisSecured * progress),
        uptime: (targetStats.uptime * progress).toFixed(1),
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setStats(targetStats);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);

  const differentiators = DIFFERENTIATORS;

  const handleGetStarted = (mode = "signup") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleLoginSuccess = (userData) => {
    setShowAuthModal(false);
    onLoginSuccess(userData);
  };

  const handleLandingScan = async (event) => {
    if (event && event.preventDefault) event.preventDefault();
    const nextUrl = landingUrl.trim();
    if (!nextUrl) { setLandingError("Please enter a URL to scan."); return; }

    if (landingPollRef.current) clearInterval(landingPollRef.current);
    setLandingError("");
    setLandingScanning(true);
    setLandingReportUrl("");
    setLandingReport(null);
    setLandingProgress({ value: 5, phase: "Starting scan..." });

    const API = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

    try {
      const res = await fetch(`${API}/fullsend/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: nextUrl }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || "Failed to start scan"); }
      const { scan_id, report_token } = await res.json();

      landingPollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API}/fullsend/status/${scan_id}`);
          const status = await statusRes.json();
          setLandingProgress({ value: status.progress || 0, phase: status.phase || "Running..." });

          if (status.status === "complete") {
            clearInterval(landingPollRef.current);
            const reportRes = await fetch(`${API}/fullsend/report/${report_token}`);
            const report = await reportRes.json();
            setLandingReport(report);
            setLandingReportUrl(`${window.location.origin}/report/fullsend/${report_token}`);
            setLandingProgress({ value: 100, phase: `Done in ${report.elapsed_seconds}s` });
            setLandingScanning(false);
          } else if (status.status === "error") {
            clearInterval(landingPollRef.current);
            setLandingError(status.error || "Scan failed.");
            setLandingScanning(false);
          }
        } catch (pollErr) {
          clearInterval(landingPollRef.current);
          setLandingError(pollErr.message || "Scan failed.");
          setLandingScanning(false);
        }
      }, 1500);
    } catch (err) {
      setLandingError(err.message || "Unable to start scan.");
      setLandingScanning(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white overflow-hidden"
    >
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* ── Dynamic Island Navigation ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 w-full bg-slate-950/70 backdrop-blur-xl border-b border-white/[0.06] px-6 py-4 flex justify-center">
        {/* Outer ambient glow — matches your custom branding atmosphere */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[60px] bg-blue-600/10 blur-3xl rounded-full pointer-events-none" />

        {/* Standard full-width header block layout */}
        <div className="w-full max-w-7xl flex items-center justify-between gap-4 relative z-10">
          {/* ── Logo & Meta Row (Permanently Configured Layout) ── */}
          <div className="flex items-center gap-2.5 flex-shrink-0 cursor-pointer group">
            <div className="relative">
              <div
                className="absolute -inset-[6px] rounded-full border border-blue-500/20"
                style={{ animation: "logoOrbit 12s linear infinite" }}
              >
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full" />
              </div>
              <img
                src="/flasqo-logo.png"
                alt="Flasqo"
                className="mix-blend-screen"
                style={{
                  height: "44px",
                  width: "auto",
                  objectFit: "contain",
                }}
              />
            </div>

            <div>
              <div
                className="font-bold bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-200 bg-clip-text text-transparent leading-none"
                style={{
                  fontSize: "17px",
                  backgroundSize: "200% 200%",
                  animation: "navGradientShift 4s ease-in-out infinite",
                }}
              >
                Flasqo
              </div>
              <div className="text-[10px] text-gray-500 flex items-center gap-1 mt-1 font-medium tracking-wide">
                by EvoluneEdgeTech
                <span
                  className="inline-block w-1 h-1 bg-green-400 rounded-full flex-shrink-0"
                  style={{ animation: "navPulse 2s ease-in-out infinite" }}
                />
              </div>
            </div>
          </div>

          {/* ── Navigation Links (Always Visible on Desktop Layouts) ── */}
          <div className="hidden md:flex items-center gap-2 flex-shrink-0">
            {[
              { href: "#features", label: "Features" },
              { href: "#why-us", label: "Why Us" },
              { href: "#testimonials", label: "Testimonials" },
              { href: "#pricing", label: "Pricing" },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="relative px-4 py-2 rounded-full text-slate-400 hover:text-white text-sm font-semibold whitespace-nowrap transition-all duration-200 hover:bg-white/5"
              >
                {item.label}
              </a>
            ))}
          </div>

          {/* ── Action Buttons Container Cluster ── */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <a
              href="/download"
              className="whitespace-nowrap rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400"
            >
              Download App
            </a>
            {/* Login */}
            <button
              onClick={() => handleGetStarted("login")}
              className="whitespace-nowrap px-4 py-2 rounded-xl text-sm font-semibold text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all duration-200"
            >
              Login
            </button>

            {/* Get Started */}
            <button
              onClick={() => handleGetStarted("signup")}
              className="group relative whitespace-nowrap px-5 py-2 rounded-xl text-sm font-bold text-white overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              style={{
                background: "linear-gradient(135deg, #2563eb, #0891b2)",
                boxShadow: "0 4px 14px rgba(37,99,235,0.25)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-1.5">
                Get Started
                <ArrowRight
                  size={14}
                  className="group-hover:translate-x-0.5 transition-transform"
                />
              </span>
            </button>
          </div>
        </div>
<<<<<<< HEAD
=======
        <img
          src="/flasqo-logo.png"
          alt="Flasqo"
          className="mix-blend-screen"
          style={{
            height: "56px",
            width: "auto",
            objectFit: "contain",
            transform: "scale(1.5)",
            transformOrigin: "center center",
          }}
        />
      </div>
>>>>>>> origin/master

        <style>{`
    @keyframes logoOrbit {
      from { transform: rotate(0deg);   }
      to   { transform: rotate(360deg); }
    }
    @keyframes navGradientShift {
      0%, 100% { background-position: 0% 50%;   }
      50%      { background-position: 100% 50%; }
    }
    @keyframes navPulse {
      0%, 100% { opacity: 1; transform: scale(1);   }
      50%      { opacity: 0.5; transform: scale(1.3); }
    }
  `}</style>
      </nav>

      {/* Hero Section - Creative Design */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-6 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Floating geometric shapes */}
          <div
            className="absolute top-20 left-[10%] w-24 h-24 border border-blue-500/20 rounded-2xl rotate-12"
            style={{ animation: "heroFloat1 8s ease-in-out infinite" }}
          />
          <div
            className="absolute top-40 right-[15%] w-16 h-16 border border-blue-500/20 rounded-full"
            style={{ animation: "heroFloat2 6s ease-in-out infinite" }}
          />
          <div
            className="absolute bottom-40 left-[20%] w-12 h-12 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl rotate-45"
            style={{ animation: "heroFloat3 7s ease-in-out infinite" }}
          />
          <div
            className="absolute top-1/3 right-[8%] w-20 h-20 border border-cyan-500/10 rounded-full"
            style={{ animation: "heroFloat1 9s ease-in-out infinite reverse" }}
          />

          {/* Floating code snippets — typewriter */}
          <div
            className="hidden md:block absolute top-32 left-[5%] min-w-[148px] text-xs font-mono text-blue-400/65 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/20"
            style={{ animation: "heroFloat2 10s ease-in-out infinite" }}
          >
            <TypewriterSnippet text='{ "status": 200 }' delay={400} />
          </div>
          <div
            className="hidden md:block absolute bottom-48 right-[5%] min-w-[164px] text-xs font-mono text-cyan-400/65 bg-cyan-500/5 px-3 py-1.5 rounded-lg border border-cyan-500/20"
            style={{ animation: "heroFloat3 8s ease-in-out infinite" }}
          >
            <TypewriterSnippet text="POST /api/test → 201" delay={1400} />
          </div>
          <div
            className="hidden md:block absolute top-1/2 left-[3%] min-w-[158px] text-xs font-mono text-green-400/65 bg-green-500/5 px-3 py-1.5 rounded-lg border border-green-500/20"
            style={{ animation: "heroFloat1 12s ease-in-out infinite" }}
          >
            <TypewriterSnippet text="✓ 4/4 assertions pass" delay={2600} />
          </div>

          {/* Animated dot grid */}
          <div
            className="absolute m-6 inset-0"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(59,130,246,0.45) 1px, transparent 1px)",
              backgroundSize: "28px 28px",
              animation: "gridPulse 6s ease-in-out infinite",
            }}
          />
          {/* Residual ambient glow */}
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-blue-700/8 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ── Left hero panel: Live Test Runner ── */}
        <div
          className="hidden xl:block absolute left-0 top-[130px] w-[200px] pointer-events-none"
          style={{ animation: "heroFloat2 9s ease-in-out infinite" }}
        >
          <div
            className="rounded-xl overflow-hidden border border-slate-700/50 text-[10px] font-mono"
            style={{
              background: "rgba(9,13,24,0.92)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800/60 bg-black/30">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[9px] text-slate-600 tracking-wider">
                test-runner
              </span>
              <span className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[8px] text-green-500/60">LIVE</span>
              </span>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              {[
                {
                  pass: true,
                  method: "GET",
                  path: "/health",
                  ms: "5ms",
                  mc: "#3b82f6",
                },
                {
                  pass: true,
                  method: "POST",
                  path: "/users",
                  ms: "89ms",
                  mc: "#22c55e",
                },
                {
                  pass: false,
                  method: "DEL",
                  path: "/orders",
                  ms: "404",
                  mc: "#ef4444",
                },
                {
                  pass: true,
                  method: "PATCH",
                  path: "/profile",
                  ms: "44ms",
                  mc: "#eab308",
                },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span
                    style={{
                      color: t.pass ? "#22c55e" : "#ef4444",
                      fontSize: 10,
                    }}
                  >
                    {t.pass ? "✓" : "✗"}
                  </span>
                  <span
                    className="px-1 py-px rounded text-[8px] font-bold flex-shrink-0"
                    style={{
                      background: `${t.mc}18`,
                      color: t.mc,
                      border: `1px solid ${t.mc}35`,
                    }}
                  >
                    {t.method}
                  </span>
                  <span className="text-slate-500 flex-1 truncate">
                    {t.path}
                  </span>
                  <span
                    className="flex-shrink-0"
                    style={{ color: t.pass ? "#4b5563" : "#ef4444" }}
                  >
                    {t.ms}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t border-slate-800/40 flex items-center gap-2 bg-black/20">
              <span className="text-green-500/70">3 passed</span>
              <span className="text-slate-700">·</span>
              <span className="text-red-500/70">1 failed</span>
              <span className="ml-auto text-slate-700">238ms</span>
            </div>
          </div>
        </div>

        {/* ── Right hero panel: Deploy Gate ── */}
        <div
          className="hidden xl:block absolute right-0 top-[130px] w-[200px] pointer-events-none"
          style={{ animation: "heroFloat3 10s ease-in-out infinite" }}
        >
          <div
            className="rounded-xl overflow-hidden border border-green-500/20 text-[10px] font-mono"
            style={{
              background: "rgba(9,13,24,0.92)",
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 bg-black/30">
              <div className="flex items-center gap-1.5">
                <Rocket size={10} className="text-green-400" />
                <span className="text-[9px] text-green-400 font-bold tracking-wider">
                  DEPLOY GATE
                </span>
              </div>
              <span className="flex items-center gap-1">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-400"
                  style={{ animation: "pulseGlow 1.6s ease-in-out infinite" }}
                />
                <span className="text-[8px] text-green-400/70">READY</span>
              </span>
            </div>
            <div className="px-3 py-2.5 space-y-2.5 mx-2">
              {[
                { label: "API Coverage", val: 94, color: "#3b82f6" },
                { label: "Pass Rate", val: 87, color: "#22c55e" },
                {
                  label: "Avg Latency",
                  val: 74,
                  display: "~92ms",
                  color: "#a78bfa",
                },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">{m.label}</span>
                    <span style={{ color: m.color }}>
                      {m.display ?? `${m.val}%`}
                    </span>
                  </div>
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${m.val}%`,
                        background: m.color,
                        opacity: 0.65,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div
              className="px-3 py-1.5 border-t flex items-center gap-1.5"
              style={{
                borderColor: "rgba(34,197,94,0.15)",
                background: "rgba(34,197,94,0.05)",
              }}
            >
              <CheckCircle size={9} className="text-green-400" />
              <span className="text-green-400/80">Cleared for deploy</span>
            </div>
          </div>
        </div>

        <div className="relative text-center">
          {/* 1. BRANDING HEADER ADDED HERE */}
          <h2
            className="text-lg sm:text-xl font-black tracking-[0.35em] text-cyan-400 uppercase mb-4 opacity-90 origin-center"
            style={{ animation: "fadeInUp 0.8s ease-out 0.1s both" }}
          >
            Flasqo
          </h2>
          {/* Badge with animated border */}
          <div className="relative inline-flex items-center gap-2 px-5 py-2.5 mb-8">
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background:
                  "linear-gradient(90deg, #3b82f6, #06b6d4, #6366f1, #3b82f6)",
                backgroundSize: "300% 100%",
                animation: "gradientBorder 3s linear infinite",
                padding: "1px",
              }}
            >
              <div className="absolute inset-[1px] bg-slate-950 rounded-full" />
            </div>
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 opacity-20 blur-md"
              style={{ animation: "pulseGlow 2s ease-in-out infinite" }}
            />
            <Sparkles
              size={16}
              className="relative text-cyan-400"
              style={{ animation: "sparkleRotate 3s ease-in-out infinite" }}
            />
            <span className="relative text-sm font-semibold bg-gradient-to-r from-blue-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">
              The All-in-One API Testing for Modern Engineering Teams
            </span>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

          {/* <p
            className="text-base text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed"
            style={{ animation: "fadeInUp 0.8s ease-out 0.4s both" }}
          >
            Go beyond basic requests. Ship resilient APIs with native Chaos,
            Load, and Contract testing—all in a local-first, privacy-focused
            environment.
          </p> */}
          {/* Main heading with animation */}

          <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
            {/* Screen-reader/heading context — same phrase as the visible badge above */}
            <span className="sr-only">
              Flasqo — AI-Powered API Testing Platform:{" "}
            </span>
            <span
              className="inline-block bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent"
              style={{ animation: "titleSlideIn 0.8s ease-out" }}
            >
              Test Smarter,
            </span>
            <span
              className="inline-block bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent"
              style={{ animation: "titleSlideIn 0.8s ease-out 0.2s both" }}
            >
              &nbsp;Ship Faster
            </span>
            {/* Animated underline */}
            <div
              className="mt-2 mx-auto w-32 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400 rounded-full"
              style={{ animation: "underlineExpand 1s ease-out 0.5s both" }}
            />
          </h1>
          {/* Tagline */}
          <div
            className="flex items-center justify-center gap-3 mb-5"
            style={{ animation: "fadeInUp 0.8s ease-out 0.35s both" }}
          >
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-blue-500/50 rounded-full" />
            <span className="text-sm font-semibold tracking-wide bg-gradient-to-r from-blue-300/90 via-cyan-300/90 to-blue-200/90 bg-clip-text text-transparent">
              Stop shipping guesses — deploy with certainty
            </span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-500/50 rounded-full" />
          </div>

          <div
<<<<<<< HEAD
            className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row"
            style={{ animation: "fadeInUp 0.8s ease-out 0.6s both" }}
          >
            <a
              href="/download"
              className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-blue-500 to-cyan-500 px-6 py-3 text-sm font-semibold text-white transition hover:scale-105"
            >
              Download App
              <ArrowRight size={16} />
            </a>
            <button
              onClick={() => handleGetStarted("signup")}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/20 hover:bg-white/10"
            >
              Get Started
              <ArrowRight size={16} />
            </button>
          </div>

          <div
            className="mx-auto my-10 px-4 w-full md:mt-10"
=======
            className="mx-auto my-10 px-4 w-full md:mt-10 max-w-4xl"
>>>>>>> origin/master
            style={{ animation: "fadeInUp 0.8s ease-out 0.7s both" }}
          >
            {/* Browser Window Mockup */}
            <div
              className="rounded-xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 backdrop-blur-xl"
              style={{ background: "rgba(13,17,23,0.95)" }}
            >
              {/* Browser Chrome — URL bar is the real input */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]"
                style={{ background: "rgba(0,0,0,0.45)" }}
              >
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
                  <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
                  <div className="w-3 h-3 rounded-full bg-[#28c840]" />
                </div>
                <form
                  onSubmit={handleLandingScan}
                  className="flex-1 flex items-center gap-2 bg-slate-800/60 rounded-lg px-3 py-1.5 border border-white/[0.07]"
                >
                  <Globe size={12} className="text-slate-500 flex-shrink-0" />
                  <input
                    ref={landingInputRef}
                    value={landingUrl}
                    onChange={(e) => { setLandingUrl(e.target.value); if (landingError) setLandingError(""); }}
                    placeholder="https://yourapp.com"
                    className="flex-1 bg-transparent text-sm text-slate-300 placeholder-slate-600 outline-none font-mono"
                  />
                  {landingUrl && (
                    <button type="button" onClick={() => setLandingUrl("")} className="text-slate-600 hover:text-slate-400 text-xs">✕</button>
                  )}
                </form>
                <button
                  onClick={handleLandingScan}
                  disabled={landingScanning || !landingUrl.trim()}
                  className="flex-shrink-0 flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-500 hover:to-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {landingScanning ? (
                    <>
                      <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Scanning...
                    </>
                  ) : (
                    <><Zap size={13} /> Run Scan</>
                  )}
                </button>
              </div>

              {/* Browser Content — full-width report panel */}
              <div className="p-6" style={{ minHeight: "230px", background: "rgba(10,14,20,0.95)" }}>
                {!landingScanning && !landingReport ? (
                  /* Idle state */
                  <div className="flex flex-col items-center justify-center h-full py-8 gap-3">
                    <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Globe size={22} className="text-blue-400/60" />
                    </div>
                    <p className="text-slate-500 text-sm">Paste a URL above and click <span className="text-blue-400">Run Scan</span> to analyse your site</p>
                  </div>
                ) : landingScanning ? (
                  /* Scanning — live progress */
                  <div className="flex flex-col gap-4 py-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-white">Flasqo AI Report</span>
                      <span className="flex items-center gap-1.5 text-[11px] text-yellow-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
                        Scanning...
                      </span>
                    </div>
                    <div>
                      <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                        <span className="font-mono">{landingProgress.phase}</span>
                        <span>{landingProgress.value}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-700"
                          style={{ width: `${landingProgress.value}%` }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {["APIs Discovered", "Tests Generated", "Security Issues"].map((l) => (
                        <div key={l} className="text-center rounded-lg bg-slate-800/40 border border-white/[0.05] py-3">
                          <div className="text-xl font-bold text-slate-700 animate-pulse">—</div>
                          <div className="text-[10px] text-slate-600 mt-0.5">{l}</div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1.5">Performance Score</div>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full w-1/3 bg-slate-700 rounded-full animate-pulse" />
                      </div>
                    </div>
                  </div>
                ) : (() => {
                  const r = landingReport;
                  const score = r.app_health_score ?? 0;
                  const scoreColor = score >= 75 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
                  const secIssues = (r.security?.critical ?? 0) + (r.security?.high ?? 0) + (r.security?.medium ?? 0) + (r.security?.low ?? 0);
                  const suites = [
                    {
                      label: "Smoke",
                      icon: "🟢",
                      passed: r.smoke?.passed ?? 0,
                      failed: r.smoke?.failed ?? 0,
                      total: r.smoke?.total ?? 0,
                      detail: `${r.smoke?.passed ?? 0}/${r.smoke?.total ?? 0} routes healthy`,
                      status: (r.smoke?.failed ?? 0) === 0 ? "pass" : "fail",
                    },
                    {
                      label: "Functional",
                      icon: "⚙️",
                      passed: r.functional?.passed ?? 0,
                      failed: r.functional?.failed ?? 0,
                      total: r.functional?.total ?? 0,
                      detail: `${r.functional?.passed ?? 0}/${r.functional?.total ?? 0} tests passed`,
                      status: (r.functional?.failed ?? 0) === 0 ? "pass" : "warn",
                    },
                    {
                      label: "Security",
                      icon: "🔒",
                      passed: 0,
                      failed: secIssues,
                      total: secIssues,
                      detail: `${r.security?.critical ?? 0} critical · ${r.security?.high ?? 0} high · ${r.security?.medium ?? 0} medium`,
                      status: (r.security?.critical ?? 0) > 0 ? "fail" : secIssues > 0 ? "warn" : "pass",
                    },
                    {
                      label: "Performance",
                      icon: "⚡",
                      passed: 0,
                      failed: 0,
                      total: 0,
                      detail: r.performance?.avg_ms ? `avg ${Math.round(r.performance.avg_ms)}ms · ${r.performance?.slow_routes?.length ?? 0} slow routes` : "No data",
                      status: (r.performance?.avg_ms ?? 0) < 400 ? "pass" : (r.performance?.avg_ms ?? 0) < 1200 ? "warn" : "fail",
                    },
                    {
                      label: "Visual",
                      icon: "👁",
                      passed: 0,
                      failed: 0,
                      total: 0,
                      detail: `${r.visual?.screenshots_captured ?? 0} screenshots · ${r.visual?.issues_found ?? 0} issues`,
                      status: (r.visual?.issues_found ?? 0) === 0 ? "pass" : "warn",
                    },
                  ];
                  const statusStyle = { pass: { dot: "#22c55e", text: "text-green-400" }, warn: { dot: "#eab308", text: "text-yellow-400" }, fail: { dot: "#ef4444", text: "text-red-400" } };
                  return (
                    <div className="flex flex-col gap-3">
                      {/* Header row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-white">Flasqo AI Report</span>
                          <span className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full border" style={{ color: scoreColor, borderColor: scoreColor + "40", background: scoreColor + "12" }}>
                            {score}/100
                          </span>
                        </div>
                        <span className="text-[11px] text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">
                          ✓ {r.elapsed_seconds}s
                        </span>
                      </div>

                      {/* Top stats */}
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { val: r.api_calls_found ?? 0, label: "APIs Found", color: "#3b82f6" },
                          { val: (r.smoke?.total ?? 0) + (r.functional?.total ?? 0), label: "Tests Run", color: "#22c55e" },
                          { val: secIssues, label: "Security Issues", color: secIssues > 0 ? "#ef4444" : "#22c55e" },
                        ].map((s) => (
                          <div key={s.label} className="text-center rounded-lg bg-slate-800/40 border border-white/[0.04] py-2">
                            <div className="text-xl font-bold tabular-nums" style={{ color: s.color }}>{s.val}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Suite table */}
                      <div className="rounded-lg border border-white/[0.06] overflow-hidden">
                        <div className="grid grid-cols-3 px-3 py-1.5 bg-slate-800/60 border-b border-white/[0.04]">
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Suite</span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-center">Result</span>
                          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider text-right">Detail</span>
                        </div>
                        {suites.map((s) => {
                          const st = statusStyle[s.status];
                          return (
                            <div key={s.label} className="grid grid-cols-3 px-3 py-2 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs">{s.icon}</span>
                                <span className="text-xs text-slate-300 font-medium">{s.label}</span>
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: st.dot }} />
                                <span className={`text-[10px] font-semibold ${st.text}`}>
                                  {s.status === "pass" ? "PASS" : s.status === "warn" ? "WARN" : "FAIL"}
                                </span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-slate-500 font-mono">{s.detail}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Top priority */}
                      {r.priority_actions?.length > 0 && (
                        <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/15 px-3 py-2">
                          <div className="text-[10px] font-semibold text-yellow-500/70 uppercase tracking-wider mb-1">Top Priority</div>
                          <p className="text-xs text-slate-300 leading-relaxed">{r.priority_actions[0]}</p>
                        </div>
                      )}

                      {/* CTA */}
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white text-sm font-semibold hover:from-blue-500 hover:to-cyan-500 transition-all"
                      >
                        ⬇ Download Full Report — Sign in free
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Error bar */}
              {landingError && (
                <div className="px-4 py-2 text-sm text-red-400 border-t border-red-500/20 bg-red-500/5">
                  {landingError}
                </div>
              )}
            </div>
          </div>

          {/* CTA Buttons */}
          {/* <div
            className="flex flex-wrap items-center justify-center gap-4 mb-8"
            style={{ animation: "fadeInUp 0.8s ease-out 0.6s both" }}
          >
            <button
              onClick={() => handleGetStarted("signup")}
              className="group relative px-8 py-4 rounded-full font-bold text-lg overflow-hidden transition-all transform hover:scale-105"
            >
              <div
                className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500"
                style={{
                  backgroundSize: "200% 200%",
                  animation: "gradientBorder 3s linear infinite",
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2 text-white">
                <Zap size={20} />
                "Start Testing Now"
                <ArrowRight
                  className="group-hover:translate-x-1 transition-transform"
                  size={20}
                />
              </span>
            </button>
            <button
              onClick={() =>
                document
                  .getElementById("demo-video")
                  .scrollIntoView({ behavior: "smooth" })
              }
              className="group px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2"
            >
              <Play
                size={20}
                className="group-hover:scale-110 transition-transform"
              />
              Watch Demo
            </button>
          </div> */}

          {/* Trust badges — terminal row */}
          <div
            className="inline-flex items-center font-mono text-xs mb-8 rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm overflow-hidden divide-x divide-slate-700/60"
            style={{ animation: "fadeInUp 0.8s ease-out 0.8s both" }}
          >
            <div className="flex items-center gap-1.5 px-4 py-2">
              <span className="text-slate-600 select-none">$</span>
              <Shield size={11} className="text-green-400 flex-shrink-0" />
              <span className="text-green-400/80">enterprise.security</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-300/70">true</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2">
              <span className="text-slate-600 select-none">$</span>
              <Zap size={11} className="text-yellow-400 flex-shrink-0" />
              <span className="text-yellow-400/80">ai.engine</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-300/70">"active"</span>
            </div>
            <div className="flex items-center gap-1.5 px-4 py-2">
              <span className="text-slate-600 select-none">$</span>
              <CheckCircle size={11} className="text-blue-400 flex-shrink-0" />
              <span className="text-blue-400/80">plan.free</span>
              <span className="text-slate-600">=</span>
              <span className="text-cyan-300/70">forever</span>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes heroFloat1 {
            0%, 100% { transform: translateY(0) rotate(12deg); }
            50% { transform: translateY(-20px) rotate(20deg); }
          }
          @keyframes heroFloat2 {
            0%, 100% { transform: translateY(0) translateX(0); }
            33% { transform: translateY(-15px) translateX(10px); }
            66% { transform: translateY(5px) translateX(-5px); }
          }
          @keyframes heroFloat3 {
            0%, 100% { transform: translateY(0) rotate(45deg); }
            50% { transform: translateY(-25px) rotate(55deg); }
          }
          @keyframes pulseGlow {
            0%, 100% { opacity: 0.2; transform: scale(1); }
            50% { opacity: 0.4; transform: scale(1.1); }
          }
          @keyframes gradientBorder {
            0% { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @keyframes sparkleRotate {
            0%, 100% { transform: rotate(0deg) scale(1); }
            50% { transform: rotate(180deg) scale(1.2); }
          }
          @keyframes titleSlideIn {
            from { opacity: 0; transform: translateY(30px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes underlineExpand {
            from { width: 0; opacity: 0; }
            to { width: 8rem; opacity: 1; }
          }
          @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes gridPulse {
            0%, 100% { opacity: 0.10; }
            50%       { opacity: 0.20; }
          }
          @keyframes twCursor {
            0%, 100% { opacity: 1; }
            50%       { opacity: 0; }
          }
        `}</style>

        {/* Stats - Tech Floating Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-5xl mx-auto">
          {[
            {
              value: stats.users.toLocaleString(),
              suffix: "+",
              label: "Active Users",
              gradient: "from-blue-400 to-cyan-400",
              glow: "#22d3ee",
              Icon: Users,
              bars: [3, 5, 4, 6, 5, 7, 6],
            },
            {
              value: stats.testsRun.toLocaleString(),
              suffix: "+",
              label: "Tests Run",
              gradient: "from-indigo-400 to-blue-400",
              glow: "#818cf8",
              Icon: Activity,
              bars: [4, 7, 5, 8, 6, 9, 8],
            },
            {
              value: stats.apisSecured.toLocaleString(),
              suffix: "+",
              label: "APIs Secured",
              gradient: "from-green-400 to-emerald-400",
              glow: "#22c55e",
              Icon: Lock,
              bars: [5, 4, 6, 5, 7, 6, 8],
            },
            {
              value: stats.uptime,
              suffix: "%",
              label: "Uptime",
              gradient: "from-orange-400 to-red-400",
              glow: "#f97316",
              Icon: Zap,
              bars: [8, 9, 8, 9, 9, 8, 9],
            },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="group relative"
              style={{
                animation: `floatCard 4s ease-in-out ${index * 0.3}s infinite`,
              }}
            >
              {/* Glow effect */}
              <div
                className="absolute -inset-2 rounded-2xl opacity-0 group-hover:opacity-35 blur-xl transition-all duration-500"
                style={{ background: stat.glow }}
              />

              {/* Card */}
              <div className="relative bg-slate-900/80 backdrop-blur-xl rounded-2xl p-5 border border-white/10 group-hover:border-white/25 transition-all duration-300 overflow-hidden">
                {/* Dot grid overlay */}
                <div
                  className="absolute inset-0 opacity-[0.06] group-hover:opacity-[0.13] transition-opacity duration-500 pointer-events-none"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)",
                    backgroundSize: "14px 14px",
                  }}
                />

                {/* Scan line — sweeps top → bottom on hover */}
                <div
                  className="absolute left-0 right-0 h-px opacity-0 group-hover:opacity-100 pointer-events-none"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${stat.glow} 50%, transparent 100%)`,
                    animation: "scanLine 2.6s ease-in-out infinite",
                    animationDelay: `${index * 0.45}s`,
                  }}
                />

                {/* Animated shine */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                {/* Lucide icon badge — top right */}
                <div
                  className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center opacity-35 group-hover:opacity-80 transition-all duration-300"
                  style={{
                    background: `${stat.glow}18`,
                    border: `1px solid ${stat.glow}35`,
                  }}
                >
                  <stat.Icon size={13} style={{ color: stat.glow }} />
                </div>

                {/* Content */}
                <div className="relative pr-8">
                  <div
                    className={`text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-0.5 group-hover:scale-105 transition-transform origin-left font-mono tabular-nums`}
                  >
                    {stat.value}
                    {stat.suffix}
                  </div>
                  <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors font-mono tracking-wide uppercase">
                    {stat.label}
                  </div>
                </div>

                {/* Mini sparkline bars */}
                <div className="relative mt-3 flex items-end gap-[3px] h-7">
                  {stat.bars.map((h, i) => (
                    <div
                      key={i}
                      className="flex-1 rounded-[2px]"
                      style={{
                        height: `${Math.round((h / 9) * 100)}%`,
                        background: `linear-gradient(to top, ${stat.glow}70, ${stat.glow}28)`,
                        animation: `barGrow 0.45s ease-out ${i * 0.055 + index * 0.08}s both`,
                        transformOrigin: "bottom",
                      }}
                    />
                  ))}
                </div>

                {/* Bottom gradient line */}
                <div
                  className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${stat.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`}
                />
              </div>
            </div>
          ))}
        </div>

        <style>{`
            @keyframes floatCard {
              0%, 100% { transform: translateY(0); }
              50%       { transform: translateY(-8px); }
            }
            @keyframes scanLine {
              0%   { top: 0%;   opacity: 0; }
              6%   { opacity: 1; }
              92%  { opacity: 1; }
              100% { top: 100%; opacity: 0; }
            }
            @keyframes barGrow {
              from { transform: scaleY(0); }
              to   { transform: scaleY(1); }
            }
          `}</style>
      </section>

      {/* Live Traffic Visualizer */}
      <FlasqoTrafficVisualizer />

      {/* Features Section */}
      <div id="features">
        <PipelineDiagram />
      </div>

      {/* Why Choose Us - Creative Hexagon Design */}
      <section
        id="why-us"
        className="relative z-10 max-w-6xl mx-auto px-6 py-10 overflow-hidden"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-blue-500/10 rounded-full"
            style={{ animation: "spin 30s linear infinite" }}
          />
        </div>

        {/* Header */}
        <div className="relative text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-white">Why Choose </span>
            <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Flasqo?
            </span>
          </h2>
          <p className="text-gray-400 max-w-xl mx-auto text-sm">
            What makes us different from other API testing platforms
          </p>
        </div>

        {/* Creative Grid - 3 columns with staggered layout */}
        <div className="relative grid grid-cols-2 md:grid-cols-3 gap-4">
          {differentiators.map((item, index) => {
            const Icon = item.icon;
            const isMiddle = index % 3 === 1;
            return (
              <div
                key={index}
                className={`group relative ${isMiddle ? "md:translate-y-8" : ""}`}
                style={{
                  animation: `fadeSlideUp 0.5s ease-out ${index * 0.1}s both`,
                }}
              >
                {/* Card */}
                <div className="relative bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/10 group-hover:border-white/30 transition-all duration-300 group-hover:scale-105 overflow-hidden">
                  {/* Glow on hover */}
                  <div
                    className={`absolute -inset-1 bg-gradient-to-r ${item.gradient} rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500`}
                  />

                  {/* Top accent line */}
                  <div
                    className={`absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r ${item.gradient} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`}
                  />

                  {/* Content */}
                  <div className="relative">
                    {/* Icon orb */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        <div
                          className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity`}
                        />
                        <div
                          className={`relative w-11 h-11 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}
                        >
                          <Icon size={22} className="text-white" />
                        </div>
                      </div>
                      <h3
                        className={`text-sm font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}
                      >
                        {item.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Corner decoration */}
                  <div
                    className={`absolute bottom-2 right-2 w-8 h-8 border-r border-b ${item.gradient.includes("green") ? "border-green-500/20" : "border-blue-500/20"} rounded-br-xl opacity-0 group-hover:opacity-100 transition-opacity`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <style>{`
          @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </section>

      {/* ── Comparison Matrix ── */}
      <ComparisonMatrix />

      {/* Reviews Marquee */}
      <div id="testimonials">
        <ReviewsMarquee />
      </div>

      {/* FAQ */}
      <FaqSection />

      {/* CTA Section - Creative Design */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: "rgba(5,8,18,0.88)",
            border: "1px solid rgba(59,130,246,0.16)",
            backdropFilter: "blur(24px)",
            boxShadow:
              "0 0 80px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          {/* Dot grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, rgba(59,130,246,0.35) 1px, transparent 1px)",
              backgroundSize: "26px 26px",
              opacity: 0.09,
            }}
          />

          {/* Ambient top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-28 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/3 w-56 h-20 bg-cyan-500/8 rounded-full blur-2xl pointer-events-none" />

          {/* Corner bracket — top-left */}
          <div className="absolute top-0 left-0 w-10 h-10 pointer-events-none">
            <div className="absolute top-3 left-3 w-5 h-5 border-t-2 border-l-2 border-blue-500/50 rounded-tl" />
          </div>
          {/* Corner bracket — top-right */}
          <div className="absolute top-0 right-0 w-10 h-10 pointer-events-none">
            <div className="absolute top-3 right-3 w-5 h-5 border-t-2 border-r-2 border-cyan-500/50 rounded-tr" />
          </div>
          {/* Corner bracket — bottom-left */}
          <div className="absolute bottom-0 left-0 w-10 h-10 pointer-events-none">
            <div className="absolute bottom-3 left-3 w-5 h-5 border-b-2 border-l-2 border-blue-500/35 rounded-bl" />
          </div>
          {/* Corner bracket — bottom-right */}
          <div className="absolute bottom-0 right-0 w-10 h-10 pointer-events-none">
            <div className="absolute bottom-3 right-3 w-5 h-5 border-b-2 border-r-2 border-cyan-500/35 rounded-br" />
          </div>

          <div className="relative px-8 md:px-12 py-10">
            {/* Top code badge */}
            <div className="flex justify-center mb-8">
              <div
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-mono text-[11px]"
                style={{
                  background: "rgba(59,130,246,0.08)",
                  border: "1px solid rgba(59,130,246,0.22)",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-400"
                  style={{
                    animation: "ctaBadgePulse 1.8s ease-in-out infinite",
                  }}
                />
                <span className="text-slate-500">// </span>
                <span className="text-blue-300">deploy</span>
                <span className="text-slate-600">.</span>
                <span className="text-cyan-300">ready</span>
                <span className="text-slate-600"> = </span>
                <span className="text-green-400">true</span>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid md:grid-cols-2 gap-10 items-center">
              {/* ── LEFT: headline + quote + CTAs ── */}
              <div>
                <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-5">
                  <span className="bg-gradient-to-r from-white via-blue-50 to-cyan-100 bg-clip-text text-transparent">
                    Ship clean code.
                  </span>
                  <br />
                  <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                    Every deployment.
                  </span>
                </h2>

                {/* Italic quote with left border */}
                <p
                  className="text-slate-400 text-sm leading-relaxed mb-8 pl-4 italic"
                  style={{ borderLeft: "2px solid rgba(59,130,246,0.45)" }}
                >
                  "APIs don't fail on demo day.
                  <br />
                  They fail the night before."
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mb-5">
                  <button
                    onClick={() => handleGetStarted("signup")}
                    className="group relative px-7 py-3 rounded-full font-bold text-sm overflow-hidden transition-all transform hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative flex items-center gap-2 text-white">
                      <Zap size={15} />
                      Start Free Trial
                      <ArrowRight
                        size={14}
                        className="group-hover:translate-x-1 transition-transform"
                      />
                    </span>
                  </button>
                  <button
                    onClick={() => handleGetStarted("login")}
                    className="px-7 py-3 rounded-full font-bold text-sm text-slate-300 hover:text-white transition-all"
                    style={{ border: "1px solid rgba(255,255,255,0.12)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.28)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.borderColor =
                        "rgba(255,255,255,0.12)")
                    }
                  >
                    Login to Continue
                  </button>
                </div>

                {/* Trust micro-line */}
                <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono">
                  <span>
                    <span className="text-green-500/60">✓</span> No credit card
                  </span>
                  <span>
                    <span className="text-green-500/60">✓</span> Free forever
                  </span>
                  <span>
                    <span className="text-green-500/60">✓</span> Cancel anytime
                  </span>
                </div>
              </div>

              {/* ── RIGHT: pre-deploy check terminal ── */}
              <div>
                <div
                  key={terminalKey}
                  className="rounded-xl overflow-hidden font-mono text-[11px]"
                  style={{
                    background: "rgba(4,7,15,0.80)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  {/* Title bar */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800/50 bg-black/25">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-3 text-slate-600 text-[10px] tracking-wider">
                      flasqo / pre-deploy-check
                    </span>
                    <span className="ml-auto flex items-center gap-1.5"
                      style={{ opacity: 0, animation: "termFadeUp 0.4s ease forwards", animationDelay: "2.8s" }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[9px] text-green-400/70">ALL PASSING</span>
                    </span>
                  </div>

                  {/* Check rows */}
                  <div className="px-4 py-4 space-y-2.5">
                    {[
                      { label: "functional tests",  result: "24 / 24 passed", color: "#22c55e" },
                      { label: "schema validation",  result: "no drift",       color: "#22c55e" },
                      { label: "performance gates",  result: "p95 < 200ms",    color: "#3b82f6" },
                      { label: "chaos simulation",   result: "0 cascades",     color: "#a78bfa" },
                      { label: "auth contracts",     result: "all verified",   color: "#22d3ee" },
                    ].map((row, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between"
                        style={{ opacity: 0, animation: "termFadeUp 0.35s ease forwards", animationDelay: `${i * 0.45 + 0.2}s` }}
                      >
                        <span className="text-slate-500">
                          <span style={{ color: "#22c55e" }}>✓ </span>
                          {row.label}
                        </span>
                        <span
                          style={{ color: row.color, opacity: 0, animation: "termSlideRight 0.35s ease forwards", animationDelay: `${i * 0.45 + 0.45}s` }}
                        >
                          {row.result}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 py-2.5 border-t flex items-center justify-between"
                    style={{
                      borderColor: "rgba(34,197,94,0.12)",
                      background: "rgba(34,197,94,0.05)",
                      opacity: 0,
                      animation: "termFadeUp 0.5s ease forwards",
                      animationDelay: "3.0s",
                    }}
                  >
                    <span className="font-bold text-green-400">
                      ● ALL CHECKS PASSED
                    </span>
                    <span className="text-slate-600 text-[10px]">
                      deploy unblocked ↗
                    </span>
                  </div>
                </div>

                <style>{`
                  @keyframes termFadeUp {
                    from { opacity: 0; transform: translateY(6px); }
                    to   { opacity: 1; transform: translateY(0); }
                  }
                  @keyframes termSlideRight {
                    from { opacity: 0; transform: translateX(10px); }
                    to   { opacity: 1; transform: translateX(0); }
                  }
                `}</style>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  {[
                    { val: "94%", sub: "avg coverage", color: "#3b82f6" },
                    { val: "< 2s", sub: "time to results", color: "#22d3ee" },
                    { val: "∞", sub: "free tests", color: "#a78bfa" },
                  ].map((s) => (
                    <div
                      key={s.sub}
                      className="text-center rounded-lg py-2.5"
                      style={{
                        background: "rgba(255,255,255,0.025)",
                        border: "1px solid rgba(255,255,255,0.055)",
                      }}
                    >
                      <div
                        className="text-lg font-bold font-mono tabular-nums"
                        style={{ color: s.color }}
                      >
                        {s.val}
                      </div>
                      <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5 font-mono">
                        {s.sub}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes ctaBadgePulse {
            0%, 100% { opacity: 1; box-shadow: 0 0 4px #22c55e; }
            50%       { opacity: 0.5; box-shadow: none; }
          }
        `}</style>
      </section>

      {/* Footer - Creative Compact Design */}
      <footer className="relative z-10 mt-4">
        {/* Top aurora border */}
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40" />

        <div className="max-w-6xl mx-auto px-6 py-5">
          {/* Top row: logo left, social icons centered */}
          <div className="relative flex items-center justify-center">
            {/* Logo & Brand — pinned left */}
            <div className="absolute left-0 flex flex-col">
              <img
                src="/flasqo-logo.png"
                alt="Flasqo"
                className="mix-blend-screen"
                style={{ height: "68px", width: "auto", objectFit: "contain" }}
              />
              <a
                href="https://www.evolune.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-400 hover:text-cyan-300 transition-colors"
              >
                by EvoluneEdgeTech
              </a>
            </div>

            {/* Social Icons — truly centered */}
            <div className="flex items-center gap-2">
              {[
                { icon: Github,   href: "https://github.com/EvoluneEdgeTech",                          gradient: "from-gray-600 to-gray-700" },
                { icon: Twitter,  href: "https://x.com/EvoluneEdgeTech",                               gradient: "from-blue-400 to-blue-600" },
                { icon: Linkedin, href: "https://www.linkedin.com/in/evolune-edgetech-546640389/",     gradient: "from-blue-600 to-blue-800" },
                { icon: Mail,     href: "mailto:contact@evolune.in",                                   gradient: "from-blue-500 to-cyan-600" },
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-12 h-12 rounded-full flex items-center justify-center overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${social.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors" />
                  <social.icon size={22} className="relative z-10 text-gray-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Resource links — crawlable paths into the comparison & guide pages */}
          <div className="mt-4 pt-4 border-t border-white/5 grid grid-cols-2 md:grid-cols-3 gap-5 text-sm">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Compare
              </h3>
              <ul className="space-y-1.5 text-gray-400">
                <li>
                  <a
                    href="/compare/flasqo-vs-postman/"
                    className="hover:text-white transition-colors"
                  >
                    Flasqo vs Postman
                  </a>
                </li>
                <li>
                  <a
                    href="/compare/flasqo-vs-insomnia/"
                    className="hover:text-white transition-colors"
                  >
                    Flasqo vs Insomnia
                  </a>
                </li>
                <li>
                  <a
                    href="/compare/flasqo-vs-katalon/"
                    className="hover:text-white transition-colors"
                  >
                    Flasqo vs Katalon
                  </a>
                </li>
                <li>
                  <a
                    href="/compare/flasqo-vs-bruno/"
                    className="hover:text-white transition-colors"
                  >
                    Flasqo vs Bruno
                  </a>
                </li>
                <li>
                  <a
                    href="/compare/flasqo-vs-hoppscotch/"
                    className="hover:text-white transition-colors"
                  >
                    Flasqo vs Hoppscotch
                  </a>
                </li>
                <li>
                  <a
                    href="/compare/postman-alternatives/"
                    className="hover:text-white transition-colors"
                  >
                    Best Postman alternatives
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Guides
              </h3>
              <ul className="space-y-1.5 text-gray-400">
                <li>
                  <a
                    href="/guides/api-testing/"
                    className="hover:text-white transition-colors"
                  >
                    What is API testing?
                  </a>
                </li>
                <li>
                  <a
                    href="/guides/api-load-testing/"
                    className="hover:text-white transition-colors"
                  >
                    API load testing
                  </a>
                </li>
                <li>
                  <a
                    href="/guides/api-chaos-testing/"
                    className="hover:text-white transition-colors"
                  >
                    API chaos testing
                  </a>
                </li>
                <li>
                  <a
                    href="/guides/api-contract-testing/"
                    className="hover:text-white transition-colors"
                  >
                    API contract testing
                  </a>
                </li>
                <li>
                  <a
                    href="/guides/graphql-api-testing/"
                    className="hover:text-white transition-colors"
                  >
                    GraphQL API testing
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">
                Product
              </h3>
              <ul className="space-y-1.5 text-gray-400">
                <li>
                  <a
                    href="#features"
                    className="hover:text-white transition-colors"
                  >
                    Features
                  </a>
                </li>
                <li>
                  <a
                    href="#compare"
                    className="hover:text-white transition-colors"
                  >
                    How we stack up
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.evolune.in/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    EvoluneEdgeTech
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-4 pt-3 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              © 2026 Flasqo. All rights reserved. Built for developers.
            </p>
          </div>
        </div>

      </footer>

      {/* Toast Notification */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
          duration={3000}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          mode={authMode}
          onClose={() => setShowAuthModal(false)}
          onLoginSuccess={handleLoginSuccess}
          onSwitchMode={(mode) => setAuthMode(mode)}
        />
      )}
    </div>
  );
};

export default LandingPage;
