import React from "react";
import { useNavigate } from "react-router-dom";
import DocsButton from "./components/DocsButton.jsx";
import LaunchButton from "./components/LaunchButton.jsx";
import ProductHuntBadge from "./components/ProductHuntBadge.jsx";
import {
  Globe, FileCheck, Zap, Activity, AlertTriangle, Bug, GitCompare,
  FileText, Database, Search, Sparkles, Link2, Workflow,
  Shield, User, LogOut, ArrowRight,
} from "lucide-react";

function TestingTypesLanding({ user, onLogout }) {
  const navigate = useNavigate();
  // Seeded with first module so panel is always visible; never set to null
  const [activeType, setActiveType] = React.useState(null);
  React.useLayoutEffect(() => {
    // Populate once testingTypes is available (avoids circular ref at declaration time)
    setActiveType((prev) => prev ?? testingTypes[0]);
  }, []);
  const [wordIndex, setWordIndex] = React.useState(0);

  const cyclingWords = [
    "Functional",
    "Performance",
    "Smoke",
    "Chaos",
    "Security",
    "Regression",
  ];

  React.useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % cyclingWords.length);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const testingTypes = [
    {
      id: "fullsend",
      title: "FullSend — URL Scan",
      description:
        "Drop any URL. Get a full app health report in under 60 seconds. Playwright crawls every page, then smoke, AI functional, visual, security, and performance tests run in parallel. GPT-4 writes the report. No config.",
      icon: Globe,
      gradient: "from-violet-600 via-fuchsia-600 to-pink-600",
      features: [
        "Zero Config — Just a URL",
        "Playwright Headless Crawl",
        "5 Test Suites in Parallel",
        "GPT-4 Unified Report",
        "Public Shareable Link",
      ],
      route: "/fullsend",
      launchHref: "/fullsend",
      docsHref: "https://docs.flasqo.com",
      color: "violet",
      badge: "NEW",
    },
    {
      id: "functional",
      title: "Functional API Testing",
      description:
        "AI-powered test generation for REST APIs with comprehensive test coverage including happy path, edge cases, negative tests, and security testing.",
      icon: FileCheck,
      gradient: "from-blue-600 via-purple-600 to-pink-600",
      features: [
        "AI-Powered Test Generation",
        "Security Test Cases",
        "Custom Test Editor",
        "Multiple Auth Methods",
        "Detailed Reports",
      ],
      route: "/functional",
      launchHref: "/functional",
      docsHref: "/guides/api-testing/",
      color: "blue",
    },
    {
      id: "smoke",
      title: "Smoke Testing",
      description:
        "Quick health checks for critical API endpoints to verify system readiness. Fast execution for deployment gates and CI/CD pipelines.",
      icon: Zap,
      gradient: "from-green-600 via-emerald-600 to-teal-600",
      features: [
        "Fast Health Checks (< 5 min)",
        "Critical Endpoint Testing",
        "Go/No-Go Decisions",
        "Quick Presets",
        "Deployment Gates",
      ],
      route: "/smoke",
      launchHref: "/smoke",
      docsHref: "/guides/smoke-testing/",
      color: "green",
    },
    {
      id: "performance",
      title: "Performance Testing",
      description:
        "Load testing, stress testing, and response time analysis to ensure your API can handle real-world traffic and identify bottlenecks.",
      icon: Activity,
      gradient: "from-purple-600 via-pink-600 to-orange-500",
      features: [
        "Response Time Analysis",
        "Load Testing (100-1000 users)",
        "Stress Testing",
        "Spike Testing",
        "Endurance Testing",
      ],
      route: "/performance",
      launchHref: "/performance",
      docsHref: "/guides/api-load-testing/",
      color: "purple",
    },
    {
      id: "chaos",
      title: "Chaos Testing",
      description:
        "Test your API resilience by injecting failures, timeouts, and network issues to ensure your system can handle unexpected scenarios.",
      icon: AlertTriangle,
      gradient: "from-orange-600 via-red-600 to-pink-600",
      features: [
        "Timeout Injection",
        "Error Simulation (500, 503)",
        "Network Failure Testing",
        "High Latency Testing",
        "Random Error Mix",
      ],
      route: "/chaos",
      launchHref: "/chaos",
      docsHref: "/guides/api-chaos-testing/",
      color: "orange",
    },
    {
      id: "fuzz",
      title: "Fuzz Testing",
      description:
        "Advanced security testing using malformed and random inputs to discover vulnerabilities like buffer overflows, injection attacks, and memory corruption.",
      icon: Bug,
      gradient: "from-red-600 via-orange-600 to-yellow-600",
      features: [
        "Buffer Overflow Detection",
        "Injection Attack Testing",
        "Type Confusion Tests",
        "Memory Corruption Detection",
        "30+ Attack Vectors",
      ],
      route: "/fuzz",
      launchHref: "/fuzz",
      docsHref: "https://docs.flasqo.com",
      color: "red",
    },
    {
      id: "regression",
      title: "Regression Testing",
      description:
        "Detect API changes and prevent regressions by comparing current responses against saved baselines. Track changes over time and ensure API stability.",
      icon: GitCompare,
      gradient: "from-cyan-600 via-indigo-600 to-blue-600",
      features: [
        "Baseline Comparison",
        "Change Detection",
        "Response Validation",
        "Historical Tracking",
        "Automated Alerts",
      ],
      route: "/regression",
      launchHref: "/regression",
      docsHref: "https://docs.flasqo.com",
      color: "cyan",
    },
    {
      id: "contract",
      title: "Contract Testing",
      description:
        "Consumer-Driven Contract testing to ensure service providers meet consumer expectations. Verify API contracts and prevent breaking changes in microservices.",
      icon: FileText,
      gradient: "from-violet-600 via-purple-600 to-fuchsia-600",
      features: [
        "Consumer-Driven Contracts",
        "Provider Verification",
        "Schema Validation",
        "Breaking Change Detection",
        "Contract Versioning",
      ],
      route: "/contract",
      launchHref: "/contract",
      docsHref: "/guides/api-contract-testing/",
      color: "violet",
    },
    {
      id: "graphql",
      title: "GraphQL API Testing",
      description:
        "AI-powered GraphQL testing with automatic schema introspection, query/mutation generation, N+1 detection, and deep nested query testing.",
      icon: Database,
      gradient: "from-indigo-600 via-blue-600 to-cyan-600",
      features: [
        "Auto Schema Discovery",
        "AI Query Generation",
        "N+1 Detection",
        "Nested Query Testing",
        "Performance Analysis",
      ],
      route: "/graphql",
      launchHref: "/graphql",
      docsHref: "/guides/graphql-api-testing/",
      color: "indigo",
    },
    {
      id: "auto-discovery",
      title: "Auto-Discovery",
      description:
        "Zero-config API discovery. Enter a URL and instantly discover endpoints, get security scores, and generate tests automatically.",
      icon: Search,
      gradient: "from-emerald-600 via-teal-600 to-cyan-600",
      features: [
        "OpenAPI/Swagger Detection",
        "Common Path Crawling",
        "Auth Pattern Detection",
        "Instant Security Score",
        "Auto Test Generation",
      ],
      route: "/auto-discovery",
      launchHref: "/auto-discovery",
      docsHref: "https://docs.flasqo.com",
      color: "emerald",
    },
    {
      id: "vibe-testing",
      title: "Vibe Testing",
      description:
        "AI-powered exploratory testing from real artifacts. Crawl web apps, analyze screenshots, upload source code, or drop an APK to instantly generate test scenarios.",
      icon: Sparkles,
      gradient: "from-fuchsia-600 via-violet-600 to-indigo-600",
      features: [
        "Web App Crawler + GPT-4o",
        "Screenshot UI Analysis",
        "ZIP/Source Code Upload",
        "APK Manifest Analysis",
        "Instant Test Scenarios",
      ],
      route: "/vibe-testing",
      launchHref: "/vibe-testing",
      docsHref: "https://docs.flasqo.com",
      color: "fuchsia",
    },
    {
      id: "integration",
      title: "Integration Testing",
      description:
        "Test how multiple services communicate. Define services, build cross-service scenarios, and validate inter-service data flow with variable passing between steps.",
      icon: Link2,
      gradient: "from-purple-600 via-violet-600 to-indigo-600",
      features: [
        "Multi-Service Registry",
        "Cross-Service Scenarios",
        "Variable Extraction & Injection",
        "Per-Service Breakdown",
        "AI Failure Analysis",
      ],
      route: "/integration",
      launchHref: "/integration",
      docsHref: "https://docs.flasqo.com",
      color: "purple",
      badge: "NEW",
    },
    {
      id: "flow-builder",
      title: "Visual Flow Builder",
      description:
        "Drag-and-drop canvas for multi-step API flows. Chain requests, extract response variables, and inject them into subsequent steps.",
      icon: Workflow,
      gradient: "from-teal-600 via-cyan-600 to-blue-600",
      features: [
        "Drag-and-Drop Canvas",
        "Request Chaining",
        "Variable Extraction",
        "{{token}} Injection",
        "Per-node Results",
      ],
      route: "/flow-builder",
      launchHref: "/flow-builder",
      docsHref: "https://docs.flasqo.com",
      color: "teal",
      badge: "NEW",
    },
    // PROD-GATE: card entry (remove this object to disable the module card)
    {
      id: "prod-gate",
      title: "Production Gate",
      description:
        "Simulate production conditions before you deploy. Health checks, security probes, load simulation, rate limit validation — all in one gate run.",
      icon: Shield,
      gradient: "from-blue-700 via-indigo-700 to-violet-700",
      features: [
        "Health & Availability",
        "Security Probe (OWASP)",
        "Load Simulation",
        "Rate Limit Validation",
        "Readiness Score 0–100",
      ],
      route: "/prod-gate",
      launchHref: "/prod-gate",
      docsHref: "https://docs.flasqo.com",
      color: "blue",
      badge: "NEW",
      newTab: true,
    },
  ];

  const handleNavigate = (route, newTab = false) => {
    if (newTab) {
      window.open(route, "_blank", "noopener,noreferrer");
    } else {
      navigate(route);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header - Creative Design */}
      <div className="relative sticky top-0 z-50">
        {/* Animated mesh gradient background */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900" />
          {/* Animated gradient orbs */}
          <div
            className="absolute -top-20 -left-20 w-60 h-60 bg-purple-600/30 rounded-full blur-3xl"
            style={{ animation: "headerOrb1 8s ease-in-out infinite" }}
          />
          <div
            className="absolute -top-10 right-1/4 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"
            style={{ animation: "headerOrb2 6s ease-in-out infinite" }}
          />
          <div
            className="absolute -top-20 -right-20 w-60 h-60 bg-pink-600/20 rounded-full blur-3xl"
            style={{ animation: "headerOrb1 10s ease-in-out infinite reverse" }}
          />
          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
        </div>

        {/* Main header content */}
        <div className="relative backdrop-blur-xl border-b border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              {/* Logo section */}
              <div className="flex items-center gap-4 group cursor-pointer">
                {/* Animated logo container */}
                <div className="relative">
                  {/* Glow effect */}
                  <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-2xl opacity-0 group-hover:opacity-50 blur-lg transition-all duration-500" />
                  {/* Rotating border */}
                  <div
                    className="absolute -inset-1 rounded-xl opacity-50"
                    style={{
                      background:
                        "linear-gradient(90deg, #3b82f6, #8b5cf6, #ec4899, #3b82f6)",
                      backgroundSize: "300% 100%",
                      animation: "gradientShift 3s linear infinite",
                    }}
                  />
                  {/* Logo box */}
                  <img
                    src="/flasqo-logo.png"
                    alt="Flasqo"
                    style={{
                      height: "64px",
                      width: "auto",
                      objectFit: "contain",
                      mixBlendMode: "screen",
                    }}
                  />
                </div>
                {/* Brand text */}
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-purple-200 bg-clip-text text-transparent">
                    Flasqo
                  </h1>
                  <p className="text-xs text-blue-400/80 font-medium tracking-wider">
                    by EvoluneEdgeTech
                  </p>
                </div>
              </div>

              {/* User Profile - Creative Floating Design */}
              {user && (
                <div className="flex items-center gap-3">
                  {/* Floating Avatar with Orbital Ring */}
                  <div className="hidden md:flex items-center gap-3 group cursor-pointer">
                    {/* Avatar container */}
                    <div
                      className="relative"
                      style={{
                        animation: "avatarFloat 4s ease-in-out infinite",
                      }}
                    >
                      {/* Outer orbital ring */}
                      <div
                        className="absolute -inset-3 rounded-full border border-purple-500/30"
                        style={{ animation: "spin 8s linear infinite" }}
                      >
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50" />
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1.5 h-1.5 rounded-full bg-pink-400 shadow-lg shadow-pink-400/50" />
                      </div>
                      {/* Inner orbital ring */}
                      <div
                        className="absolute -inset-1.5 rounded-full border border-blue-400/20"
                        style={{ animation: "spin 5s linear infinite reverse" }}
                      >
                        <div className="absolute top-1/2 right-0 translate-x-1/2 -translate-y-1/2 w-1 h-1 rounded-full bg-purple-400" />
                      </div>
                      {/* Glow behind avatar */}
                      <div
                        className="absolute -inset-2 bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 rounded-full opacity-40 blur-md group-hover:opacity-60 transition-opacity"
                        style={{ animation: "pulse 3s ease-in-out infinite" }}
                      />
                      {/* Avatar */}
                      <div className="relative w-11 h-11 rounded-full overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500" />
                        <div className="absolute inset-[2px] rounded-full bg-slate-900 flex items-center justify-center">
                          <span className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {user.username?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        {/* Online indicator */}
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-slate-900 shadow-lg shadow-green-500/50">
                          <div className="absolute inset-0 bg-green-400 rounded-full animate-ping opacity-75" />
                        </div>
                      </div>
                    </div>

                    {/* User info - floating style */}
                    <div className="relative">
                      <div className="text-sm font-bold text-white group-hover:text-purple-300 transition-colors">
                        {user.username}
                      </div>
                      <div className="text-[10px] text-gray-400 flex items-center gap-1">
                        <span className="w-1 h-1 rounded-full bg-green-400 animate-pulse" />
                        Online
                      </div>
                    </div>
                  </div>

                  {/* Logout button - Floating orb style */}
                  <button onClick={onLogout} className="relative group">
                    {/* Glow effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-red-500 to-pink-500 rounded-full opacity-0 group-hover:opacity-50 blur-md transition-all duration-300" />
                    {/* Button */}
                    <div className="relative flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-red-500/20 to-pink-500/20 rounded-full border border-red-500/30 group-hover:border-red-400/60 group-hover:bg-red-500/30 transition-all duration-300">
                      <LogOut
                        size={16}
                        className="text-red-400 group-hover:text-white transition-colors"
                      />
                      <span className="hidden sm:inline text-sm text-red-400 group-hover:text-white transition-colors font-medium">
                        Logout
                      </span>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Creative animated bottom border - Natural Aurora Flow */}
        <div className="absolute -bottom-2 left-0 right-0 h-20 overflow-hidden pointer-events-none">
          {/* Organic flowing aurora blobs */}
          <svg
            className="absolute inset-0 w-full h-full"
            viewBox="0 0 1440 80"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="aurora1" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0" />
                <stop offset="30%" stopColor="#8b5cf6" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#a855f7" stopOpacity="0.8" />
                <stop offset="70%" stopColor="#ec4899" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="aurora2" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#06b6d4" stopOpacity="0" />
                <stop offset="40%" stopColor="#3b82f6" stopOpacity="0.5" />
                <stop offset="60%" stopColor="#8b5cf6" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#c026d3" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="aurora3" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
                <stop offset="50%" stopColor="#ec4899" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
              </linearGradient>
              <filter id="auroraBlur">
                <feGaussianBlur stdDeviation="4" />
              </filter>
              <filter id="softGlow">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Layer 1 - Base aurora flow */}
            <path
              fill="url(#aurora1)"
              filter="url(#auroraBlur)"
              opacity="0.8"
              style={{ animation: "morphAurora1 8s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="8s"
                repeatCount="indefinite"
                values="
                  M0,60 C200,80 400,40 600,60 S900,80 1100,50 S1300,70 1440,60 L1440,80 L0,80 Z;
                  M0,50 C150,70 350,50 550,70 S800,40 1000,65 S1250,45 1440,55 L1440,80 L0,80 Z;
                  M0,65 C250,45 450,75 650,55 S950,70 1150,45 S1350,60 1440,50 L1440,80 L0,80 Z;
                  M0,60 C200,80 400,40 600,60 S900,80 1100,50 S1300,70 1440,60 L1440,80 L0,80 Z
                "
              />
            </path>

            {/* Layer 2 - Mid aurora wave */}
            <path
              fill="url(#aurora2)"
              filter="url(#auroraBlur)"
              opacity="0.6"
              style={{ animation: "morphAurora2 10s ease-in-out infinite" }}
            >
              <animate
                attributeName="d"
                dur="10s"
                repeatCount="indefinite"
                values="
                  M0,65 C300,50 500,75 700,55 S1000,70 1200,55 S1350,65 1440,60 L1440,80 L0,80 Z;
                  M0,55 C250,70 450,45 650,65 S900,50 1100,70 S1300,55 1440,65 L1440,80 L0,80 Z;
                  M0,70 C200,55 400,70 600,50 S850,75 1050,55 S1250,70 1440,55 L1440,80 L0,80 Z;
                  M0,65 C300,50 500,75 700,55 S1000,70 1200,55 S1350,65 1440,60 L1440,80 L0,80 Z
                "
              />
            </path>

            {/* Layer 3 - Top shimmer wave */}
            <path fill="url(#aurora3)" filter="url(#softGlow)" opacity="0.5">
              <animate
                attributeName="d"
                dur="6s"
                repeatCount="indefinite"
                values="
                  M0,70 C180,60 380,75 580,65 S880,70 1080,60 S1280,72 1440,68 L1440,80 L0,80 Z;
                  M0,68 C220,75 420,60 620,72 S920,58 1120,70 S1320,62 1440,70 L1440,80 L0,80 Z;
                  M0,72 C200,65 400,78 600,62 S900,75 1100,65 S1300,70 1440,66 L1440,80 L0,80 Z;
                  M0,70 C180,60 380,75 580,65 S880,70 1080,60 S1280,72 1440,68 L1440,80 L0,80 Z
                "
              />
            </path>

            {/* Floating light orbs */}
            <circle
              cx="0"
              cy="65"
              r="4"
              fill="#8b5cf6"
              filter="url(#softGlow)"
              opacity="0.8"
            >
              <animate
                attributeName="cx"
                dur="12s"
                repeatCount="indefinite"
                values="0;1440;0"
              />
              <animate
                attributeName="cy"
                dur="3s"
                repeatCount="indefinite"
                values="65;55;65"
              />
              <animate
                attributeName="opacity"
                dur="12s"
                repeatCount="indefinite"
                values="0;0.8;0.8;0"
              />
            </circle>
            <circle
              cx="400"
              cy="60"
              r="3"
              fill="#3b82f6"
              filter="url(#softGlow)"
              opacity="0.6"
            >
              <animate
                attributeName="cx"
                dur="15s"
                repeatCount="indefinite"
                values="0;1440"
              />
              <animate
                attributeName="cy"
                dur="4s"
                repeatCount="indefinite"
                values="60;50;60"
              />
              <animate
                attributeName="opacity"
                dur="15s"
                repeatCount="indefinite"
                values="0;0.6;0.6;0"
              />
            </circle>
            <circle
              cx="800"
              cy="55"
              r="2"
              fill="#ec4899"
              filter="url(#softGlow)"
              opacity="0.7"
            >
              <animate
                attributeName="cx"
                dur="10s"
                repeatCount="indefinite"
                values="0;1440"
                begin="2s"
              />
              <animate
                attributeName="cy"
                dur="2.5s"
                repeatCount="indefinite"
                values="55;48;55"
              />
            </circle>
          </svg>

          {/* Subtle sparkles */}
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: "2px",
                height: "2px",
                background: ["#8b5cf6", "#3b82f6", "#ec4899", "#06b6d4"][i % 4],
                left: `${5 + i * 8}%`,
                bottom: `${15 + Math.sin(i) * 20}px`,
                boxShadow: `0 0 6px ${["#8b5cf6", "#3b82f6", "#ec4899", "#06b6d4"][i % 4]}`,
                animation: `sparkle ${2 + (i % 3)}s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>

        {/* Floating particles in header */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute rounded-full"
              style={{
                width: `${2 + Math.random() * 3}px`,
                height: `${2 + Math.random() * 3}px`,
                background: `radial-gradient(circle, ${["#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"][i % 4]}, transparent)`,
                left: `${10 + i * 12}%`,
                top: `${30 + Math.random() * 40}%`,
                animation: `floatParticle ${4 + i}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section - Creative */}
        <div className="relative text-center mb-12 overflow-hidden">
          {/* Animated background elements */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Floating geometric shapes */}
            <div
              className="absolute top-10 left-[10%] w-20 h-20 border border-purple-500/20 rounded-full"
              style={{ animation: "float1 8s ease-in-out infinite" }}
            />
            <div
              className="absolute top-20 right-[15%] w-12 h-12 border border-blue-500/20 rotate-45"
              style={{ animation: "float2 6s ease-in-out infinite" }}
            />
            <div
              className="absolute bottom-10 left-[20%] w-8 h-8 bg-gradient-to-r from-pink-500/10 to-purple-500/10 rounded-full blur-sm"
              style={{ animation: "float3 7s ease-in-out infinite" }}
            />
            <div
              className="absolute top-1/2 right-[10%] w-16 h-16 border border-cyan-500/10 rounded-lg rotate-12"
              style={{ animation: "float1 9s ease-in-out infinite reverse" }}
            />
            <div
              className="absolute bottom-20 right-[25%] w-6 h-6 bg-blue-500/20 rounded-full"
              style={{ animation: "pulse 3s ease-in-out infinite" }}
            />

            {/* Code-like floating elements */}
            <div
              className="absolute top-16 left-[5%] text-[10px] font-mono text-purple-500/20"
              style={{ animation: "float2 10s ease-in-out infinite" }}
            >
              {'{ api: "test" }'}
            </div>
            <div
              className="absolute bottom-16 right-[8%] text-[10px] font-mono text-blue-500/20"
              style={{ animation: "float3 8s ease-in-out infinite" }}
            >
              {"<Response 200 />"}
            </div>
            <div
              className="absolute top-1/3 left-[3%] text-[10px] font-mono text-cyan-500/20"
              style={{ animation: "float1 12s ease-in-out infinite" }}
            >
              {"assert(true)"}
            </div>
          </div>

          {/* Badge with pulse animation */}
          <div className="relative inline-flex items-center gap-2 px-5 py-2.5 mb-6 group cursor-default">
            {/* Animated border */}
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-50"
              style={{ animation: "spin 4s linear infinite", padding: "1px" }}
            >
              <div className="absolute inset-[1px] rounded-full bg-slate-900" />
            </div>
            {/* Glow effect */}
            <div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-20 blur-md"
              style={{ animation: "pulse 2s ease-in-out infinite" }}
            />
            {/* Content */}
            <div className="relative flex items-center gap-2">
              <Shield
                className="text-blue-400"
                size={18}
                style={{ animation: "pulse 2s ease-in-out infinite" }}
              />
              <span className="text-blue-200 text-sm font-semibold tracking-wide">
                Enterprise-Grade Testing Platform
              </span>
              <span className="flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
            </div>
          </div>

          {/* Main heading with animated gradient and cycling word */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 leading-tight">
            <span className="text-white">Choose Your </span>
            {/* Cycling word with animation */}
            <span className="relative inline-block">
              <span
                key={wordIndex}
                className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent"
                style={{
                  animation: "wordFade 2s ease-in-out",
                  display: "inline-block",
                }}
              >
                {cyclingWords[wordIndex]}
              </span>
              {/* Underline animation */}
              <span
                className="absolute -bottom-2 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full"
                style={{ animation: "scaleX 2s ease-in-out infinite" }}
              />
            </span>
            <span className="text-white"> Testing</span>
          </h1>

          {/* Animated subtitle */}
          <div className="relative max-w-2xl mx-auto">
            <p className="text-lg text-gray-400 leading-relaxed">
              Select the type of testing that best fits your needs.
              <span className="text-gray-300">
                {" "}
                Each module provides comprehensive insights{" "}
              </span>
              into your API's performance and reliability.
            </p>
            {/* Decorative line */}
            <div className="mt-6 flex items-center justify-center gap-3">
              <div className="h-px w-12 bg-gradient-to-r from-transparent to-purple-500/50" />
              <div className="flex gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full bg-blue-500"
                  style={{ animation: "bounce 1s ease-in-out infinite" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-purple-500"
                  style={{ animation: "bounce 1s ease-in-out 0.1s infinite" }}
                />
                <span
                  className="w-1.5 h-1.5 rounded-full bg-pink-500"
                  style={{ animation: "bounce 1s ease-in-out 0.2s infinite" }}
                />
              </div>
              <div className="h-px w-12 bg-gradient-to-l from-transparent to-purple-500/50" />
            </div>

            {/* Product Hunt launch badge */}
            <div className="flex justify-center mt-6">
              <ProductHuntBadge />
            </div>
          </div>
        </div>

        {/* Testing Types — Card Grid + Terminal Detail */}
        <div className="relative mb-12 flex flex-col lg:flex-row gap-5 items-start">
          {/* Module Card Grid */}
          <div className="flex-1 min-w-0">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
              {testingTypes.map((testType, index) => {
                const Icon = testType.icon;
                const isActive = activeType?.id === testType.id;
                return (
                  <div
                    key={testType.id}
                    className="group relative cursor-pointer h-full"
                    style={{
                      animation: `fadeIn 0.35s ease-out ${index * 0.04}s both`,
                    }}
                    onMouseEnter={() => setActiveType(testType)}
                    onClick={() =>
                      handleNavigate(testType.route, testType.newTab)
                    }
                  >
                    <div
                      className="relative h-full rounded-xl overflow-hidden transition-all duration-200 flex flex-col"
                      style={{
                        background: isActive
                          ? "rgba(12,16,30,0.98)"
                          : "rgba(9,12,22,0.72)",
                        border: `1px solid ${isActive ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.06)"}`,
                        transform: isActive ? "translateY(-3px)" : "none",
                        boxShadow: isActive
                          ? "0 12px 40px rgba(0,0,0,0.5)"
                          : "none",
                      }}
                    >
                      {/* Top accent line */}
                      <div
                        className={`h-[2px] w-full bg-gradient-to-r ${testType.gradient} transition-opacity duration-200`}
                        style={{ opacity: isActive ? 1 : 0.35 }}
                      />

                      <div className="p-4 flex flex-col flex-1">
                        {/* Icon + badge row */}
                        <div className="flex items-start justify-between mb-3">
                          <div
                            className={`w-10 h-10 rounded-lg bg-gradient-to-br ${testType.gradient} flex items-center justify-center flex-shrink-0 shadow-md transition-transform duration-200 ${isActive ? "scale-110" : ""}`}
                          >
                            <Icon size={19} className="text-white" />
                          </div>
                          {testType.badge ? (
                            <span
                              className="text-[10px] font-black px-2 py-0.5 rounded-full text-white flex-shrink-0 tracking-wide"
                              style={{
                                background:
                                  "linear-gradient(135deg,#7c3aed,#db2777)",
                                boxShadow: "0 0 8px rgba(124,58,237,0.4)",
                              }}
                            >
                              {testType.badge}
                            </span>
                          ) : (
                            <span
                              className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 transition-colors duration-200"
                              style={{
                                background: isActive ? "#22c55e" : "#1e293b",
                              }}
                            />
                          )}
                        </div>

                        {/* Module name */}
                        <div
                          className="text-sm font-bold leading-tight mb-1.5 transition-colors duration-200"
                          style={{ color: isActive ? "#fff" : "#94a3b8" }}
                        >
                          {testType.title}
                        </div>

                        {/* 1-line description */}
                        <p
                          className="text-xs leading-relaxed mb-3 line-clamp-2 flex-1"
                          style={{ color: "#64748b" }}
                        >
                          {testType.description.split(".")[0]}.
                        </p>

                        {/* Feature tags */}
                        <div className="flex flex-wrap gap-1 mb-3">
                          {testType.features.slice(0, 3).map((f, fi) => (
                            <span
                              key={fi}
                              className="text-[11px] px-2 py-0.5 rounded font-mono"
                              style={{
                                background: "rgba(255,255,255,0.05)",
                                border: "1px solid rgba(255,255,255,0.09)",
                                color: "#64748b",
                              }}
                            >
                              {f.split(" ").slice(0, 3).join(" ")}
                            </span>
                          ))}
                        </div>

                        {/* Action row */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          <DocsButton
                            href={
                              testType.docsHref || "https://docs.flasqo.com"
                            }
                            label={testType.docsLabel || "Docs"}
                            className="px-2.5 py-1.5 text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <LaunchButton
                            href={testType.launchHref || testType.route}
                            label={testType.launchLabel || "Launch"}
                            className="px-2.5 py-1.5 text-[11px]"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>

                        <div
                          className="mt-3 flex items-center justify-between text-xs font-mono transition-colors duration-200"
                          style={{ color: isActive ? "#94a3b8" : "#334155" }}
                        >
                          <span>→ run module</span>
                          <ArrowRight
                            size={10}
                            style={{
                              transform: isActive ? "translateX(2px)" : "none",
                              transition: "transform 0.2s",
                            }}
                          />
                        </div>
                      </div>

                      {/* Hover gradient overlay */}
                      {isActive && (
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${testType.gradient} pointer-events-none`}
                          style={{ opacity: 0.04 }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* CSS Animations */}
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(8px) scale(0.97); }
            to   { opacity: 1; transform: translateY(0)  scale(1); }
          }
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(-8px); }
            to   { opacity: 1; transform: translateX(0); }
          }
          @keyframes spin {
            from { transform: rotate(0deg); }
            to   { transform: rotate(360deg); }
          }
          @keyframes shimmer {
            0%   { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
          @keyframes wordFade {
            0%   { opacity: 0; transform: translateY(20px) rotateX(-90deg); }
            20%  { opacity: 1; transform: translateY(0) rotateX(0); }
            80%  { opacity: 1; transform: translateY(0) rotateX(0); }
            100% { opacity: 0; transform: translateY(-20px) rotateX(90deg); }
          }
          @keyframes scaleX {
            0%, 100% { transform: scaleX(0.3); opacity: 0.5; }
            50%       { transform: scaleX(1);   opacity: 1; }
          }
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50%       { transform: translateY(-4px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50%       { opacity: 1;   transform: scale(1.05); }
          }
          @keyframes float1 {
            0%, 100% { transform: translateY(0) rotate(0deg); }
            50%       { transform: translateY(-20px) rotate(10deg); }
          }
          @keyframes float2 {
            0%, 100% { transform: translateY(0) translateX(0); }
            33%       { transform: translateY(-15px) translateX(10px); }
            66%       { transform: translateY(5px) translateX(-5px); }
          }
          @keyframes float3 {
            0%, 100% { transform: translateY(0) scale(1); }
            50%       { transform: translateY(-25px) scale(1.1); }
          }
          @keyframes headerOrb1 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            50%       { transform: translate(30px, 10px) scale(1.1); }
          }
          @keyframes headerOrb2 {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33%       { transform: translate(-20px, 5px) scale(1.05); }
            66%       { transform: translate(10px, -5px) scale(0.95); }
          }
          @keyframes gradientShift {
            0%   { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @keyframes floatParticle {
            0%, 100% { transform: translateY(0) translateX(0) scale(1); opacity: 0.4; }
            25%       { transform: translateY(-15px) translateX(5px) scale(1.2); opacity: 0.8; }
            50%       { transform: translateY(-5px) translateX(-5px) scale(1); opacity: 0.6; }
            75%       { transform: translateY(-20px) translateX(3px) scale(1.1); opacity: 0.9; }
          }
          @keyframes avatarFloat {
            0%, 100% { transform: translateY(0); }
            50%       { transform: translateY(-3px); }
          }
          @keyframes sparkle {
            0%, 100% { opacity: 0.3; transform: scale(1); }
            50%       { opacity: 1;   transform: scale(1.5); }
          }
          @keyframes morphAurora1 {
            0%, 100% { transform: translateX(0); }
            50%       { transform: translateX(-20px); }
          }
          @keyframes morphAurora2 {
            0%, 100% { transform: translateX(0); }
            50%       { transform: translateX(30px); }
          }
          @keyframes dashFlow {
            to { stroke-dashoffset: -20; }
          }
            50%       { opacity: 0.80; }
          }
          @keyframes shine {
            0%   { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
            50%  { opacity: 1; }
            100% { transform: translateX(200%) skewX(-15deg); opacity: 0; }
          }
          .scrollbar-thin::-webkit-scrollbar { height: 4px; }
          .scrollbar-thin::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 2px; }
          .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }
        `}</style>

        
      </div>

      {/* Compact Creative Footer */}
      <div className="relative mt-8 overflow-hidden">
        {/* Animated top border */}
        <div className="absolute top-0 left-0 right-0 h-px">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-purple-500 to-transparent opacity-50" />
          <div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
            style={{ animation: "shimmer 3s linear infinite" }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-6">
          <div className="flex flex-col items-center">
            {/* Logo and brand */}
            <div className="flex items-center gap-3 mb-3">
              <img
                src="/flasqo-logo.png"
                alt="Flasqo"
                style={{
                  height: "80px",
                  width: "auto",
                  objectFit: "contain",
                  mixBlendMode: "screen",
                  animation: "float1 4s ease-in-out infinite",
                }}
              />
              <a
                href="https://www.evolune.in/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-purple-400/80 hover:text-purple-300 transition-colors tracking-wide"
              >
                by EvoluneEdgeTech
              </a>
            </div>

            {/* Tagline */}
            <p className="text-gray-500 text-sm tracking-wide">
              Professional API Testing Platform • Comprehensive testing for
              modern APIs
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TestingTypesLanding;
