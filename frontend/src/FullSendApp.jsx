import { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap,
  ShieldCheck,
  Activity,
  Camera,
  FlaskConical,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Copy,
  Share2,
  LogOut,
  LayoutDashboard,
  Sparkles,
  ChevronRight,
  Play,
} from "lucide-react";
import UrlScannerInput from "./components/UrlScannerInput";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const PHASES = [
  {
    key: "smoke",
    icon: CheckCircle2,
    label: "Smoke",
    color: "#10b981",
    glow: "#10b98140",
    desc: "All routes responding",
  },
  {
    key: "functional",
    icon: FlaskConical,
    label: "Functional",
    color: "#6366f1",
    glow: "#6366f140",
    desc: "GPT-4 test cases",
  },
  {
    key: "visual",
    icon: Camera,
    label: "Visual",
    color: "#f59e0b",
    glow: "#f59e0b40",
    desc: "Full-page screenshots",
  },
  {
    key: "security",
    icon: ShieldCheck,
    label: "Security",
    color: "#ef4444",
    glow: "#ef444440",
    desc: "Headers & fuzz probes",
  },
  {
    key: "performance",
    icon: Activity,
    label: "Performance",
    color: "#06b6d4",
    glow: "#06b6d440",
    desc: "Response time baseline",
  },
];

const ALL_CARDS = [
  ...PHASES,
  {
    key: "ai",
    icon: Sparkles,
    label: "AI Report",
    color: "#a855f7",
    glow: "#a855f740",
    desc: "GPT-4 synthesis",
  },
];

function getPhaseStatuses(progress) {
  if (progress < 25)
    return ["active", "pending", "pending", "pending", "pending"];
  if (progress < 75) return ["done", "active", "active", "active", "active"];
  return ["done", "done", "done", "done", "done"];
}

// ─── Ambient background ───────────────────────────────────────────────────────
function AmbientBg() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {/* Deep orbs */}
      <div
        className="absolute -top-32 left-1/4 w-[600px] h-[600px] rounded-full opacity-[0.06] blur-3xl"
        style={{
          background: "radial-gradient(circle, #7c3aed, transparent)",
          animation: "slowDrift 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute top-1/3 -right-32 w-[500px] h-[500px] rounded-full opacity-[0.05] blur-3xl"
        style={{
          background: "radial-gradient(circle, #db2777, transparent)",
          animation: "slowDrift 22s ease-in-out 4s infinite reverse",
        }}
      />
      <div
        className="absolute -bottom-24 left-1/4 w-[450px] h-[450px] rounded-full opacity-[0.04] blur-3xl"
        style={{
          background: "radial-gradient(circle, #06b6d4, transparent)",
          animation: "slowDrift 25s ease-in-out 8s infinite",
        }}
      />
      {/* Subtle grid */}
      <div
        className="absolute inset-0 opacity-[0.018]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.6) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }}
      />
      {/* Floating micro dots */}
      {Array.from({ length: 18 }, (_, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${(i * 37 + 11) % 100}%`,
            top: `${(i * 53 + 7) % 100}%`,
            width: i % 3 === 0 ? 2 : 1.5,
            height: i % 3 === 0 ? 2 : 1.5,
            background: ["#8b5cf680", "#ec489980", "#06b6d480"][i % 3],
            animation: `floatParticle ${7 + (i % 5)}s ease-in-out ${i * 0.4}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

// ─── Dynamic Island NavBar ────────────────────────────────────────────────────
function NavBar({ user, onLogout, onBack }) {
  const [expanded, setExpanded] = useState(false);
  const initials = user?.username?.[0]?.toUpperCase() || "?";

  return (
    // Full-width invisible anchor, pointer-events disabled so page content is clickable
    <div
      className="fixed top-3 inset-x-0 z-50 flex justify-center"
      style={{ pointerEvents: "none" }}
    >
      <nav
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        style={{
          pointerEvents: "auto",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: "999px",
          background: "rgba(6,6,16,0.94)",
          backdropFilter: "blur(32px) saturate(200%)",
          WebkitBackdropFilter: "blur(32px) saturate(200%)",
          border: "1px solid rgba(255,255,255,0.07)",
          // Island grows with a spring overshoot
          width: expanded ? "560px" : "208px",
          height: expanded ? "48px" : "44px",
          transition:
            "width 0.55s cubic-bezier(0.34,1.56,0.64,1), height 0.55s cubic-bezier(0.34,1.56,0.64,1), box-shadow 0.4s ease",
          boxShadow: expanded
            ? "0 16px 56px rgba(124,58,237,0.28), 0 4px 20px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.07)"
            : "0 8px 28px rgba(0,0,0,0.55), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}
      >
        {/* Purple glow halo under island when expanded */}
        {expanded && (
          <div
            style={{
              position: "absolute",
              inset: "-4px",
              borderRadius: "999px",
              background:
                "radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.35), transparent 65%)",
              pointerEvents: "none",
              zIndex: -1,
            }}
          />
        )}

        {/* LEFT — Dashboard (fades in from left) */}
        <div
          style={{
            position: "absolute",
            left: "16px",
            display: "flex",
            alignItems: "center",
            gap: "5px",
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateX(0)" : "translateX(-12px)",
            transition: expanded
              ? "opacity 0.22s ease 0.2s, transform 0.22s ease 0.2s"
              : "opacity 0.12s ease, transform 0.12s ease",
            pointerEvents: expanded ? "auto" : "none",
          }}
        >
          <button
            onClick={onBack}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              color: "rgba(255,255,255,0.4)",
              fontSize: "12px",
              fontWeight: 500,
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.18s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.85)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "rgba(255,255,255,0.4)")
            }
          >
            <LayoutDashboard size={12} />
            Dashboard
          </button>
          <ChevronRight size={10} style={{ color: "rgba(255,255,255,0.2)" }} />
          <span
            style={{
              color: "rgba(255,255,255,0.55)",
              fontSize: "12px",
              fontWeight: 500,
            }}
          >
            FullSend
          </span>
        </div>

        {/* CENTER — Logo (always visible, always centered) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "9px",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative" }}>
            <div
              style={{
                width: "30px",
                height: "30px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #7c3aed, #db2777)",
                boxShadow: "0 0 20px rgba(124,58,237,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {/* Clean paper-airplane "send" icon — sharp at any size */}
              <svg
                width="15"
                height="15"
                viewBox="0 0 16 16"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14.5 1.5L7.5 8.5M14.5 1.5L9.5 14.5L7.5 8.5M14.5 1.5L1.5 6.5L7.5 8.5"
                  stroke="white"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {/* subtle glow halo behind icon */}
            <div
              style={{
                position: "absolute",
                inset: "-4px",
                borderRadius: "14px",
                background: "linear-gradient(135deg,#7c3aed,#db2777)",
                opacity: 0.22,
                filter: "blur(6px)",
                zIndex: -1,
                animation: "glowPulse 2.5s ease-in-out infinite",
              }}
            />
          </div>
          <span
            style={{
              fontWeight: 700,
              color: "#fff",
              fontSize: "15px",
              letterSpacing: "-0.02em",
              whiteSpace: "nowrap",
            }}
          >
            FullSend
          </span>
        </div>

        {/* RIGHT — User (fades in from right) */}
        <div
          style={{
            position: "absolute",
            right: "14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            opacity: expanded ? 1 : 0,
            transform: expanded ? "translateX(0)" : "translateX(12px)",
            transition: expanded
              ? "opacity 0.22s ease 0.2s, transform 0.22s ease 0.2s"
              : "opacity 0.12s ease, transform 0.12s ease",
            pointerEvents: expanded ? "auto" : "none",
          }}
        >
          {user && (
            <span
              style={{
                color: "rgba(255,255,255,0.32)",
                fontSize: "12px",
                whiteSpace: "nowrap",
              }}
            >
              {user.username}
            </span>
          )}
          {/* Avatar */}
          <div
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.75), rgba(219,39,119,0.75))",
              border: "1.5px solid rgba(255,255,255,0.13)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: 700,
              color: "white",
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          {/* Logout */}
          <button
            onClick={onLogout}
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.07)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "rgba(255,255,255,0.3)",
              cursor: "pointer",
              transition: "color 0.18s, background 0.18s",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.75)";
              e.currentTarget.style.background = "rgba(255,255,255,0.1)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "rgba(255,255,255,0.3)";
              e.currentTarget.style.background = "rgba(255,255,255,0.05)";
            }}
          >
            <LogOut size={11} />
          </button>
        </div>
      </nav>
    </div>
  );
}

// ─── Phase status cards (during / after scan) ────────────────────────────────
function PhaseStatusRow({ statuses, done }) {
  return (
    <div className="flex gap-2 flex-wrap justify-center">
      {PHASES.map((phase, i) => {
        const Icon = phase.icon;
        const status = done ? "done" : statuses[i];
        const isActive = status === "active";
        const isDone = status === "done";
        return (
          <div
            key={phase.key}
            className="relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl border transition-all duration-500"
            style={{
              borderColor: isDone
                ? `${phase.color}35`
                : isActive
                  ? `${phase.color}55`
                  : "rgba(255,255,255,0.06)",
              background: isDone
                ? `${phase.color}08`
                : isActive
                  ? `${phase.color}12`
                  : "rgba(255,255,255,0.02)",
              boxShadow: isActive
                ? `0 0 20px ${phase.glow}, 0 4px 16px rgba(0,0,0,0.2)`
                : isDone
                  ? `0 0 10px ${phase.glow}`
                  : "none",
            }}
          >
            {isActive && (
              <div
                className="absolute inset-0 rounded-2xl opacity-15 blur-md"
                style={{
                  background: phase.color,
                  animation: "glowPulse 1.5s ease-in-out infinite",
                }}
              />
            )}
            <div
              className="relative w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{
                background:
                  isDone || isActive
                    ? `${phase.color}20`
                    : "rgba(255,255,255,0.04)",
              }}
            >
              {isDone ? (
                <CheckCircle2
                  size={13}
                  style={{
                    color: phase.color,
                    filter: `drop-shadow(0 0 3px ${phase.color})`,
                  }}
                />
              ) : isActive ? (
                <Loader2
                  size={13}
                  style={{
                    color: phase.color,
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              ) : (
                <Icon size={13} style={{ color: "rgba(255,255,255,0.2)" }} />
              )}
            </div>
            <span
              className="text-[11px] font-semibold"
              style={{
                color:
                  isDone || isActive ? phase.color : "rgba(255,255,255,0.22)",
              }}
            >
              {phase.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Scan animation (full-width) ─────────────────────────────────────────────
function ScanVisual({ progress, phase }) {
  return (
    <div className="flex flex-col items-center py-10">
      <div className="relative w-52 h-52 flex items-center justify-center mb-8">
        {/* Outer decorative rings */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "1px solid rgba(139,92,246,0.12)",
            animation: "spinSlow 22s linear infinite",
          }}
        />
        <div
          className="absolute inset-4 rounded-full"
          style={{
            border: "1px solid rgba(236,72,153,0.1)",
            animation: "spinSlow 16s linear infinite reverse",
          }}
        />
        <div
          className="absolute inset-8 rounded-full"
          style={{
            border: "1px solid rgba(6,182,212,0.09)",
            animation: "spinSlow 11s linear infinite",
          }}
        />

        {/* Active arcs */}
        <div
          className="absolute inset-0 rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "#8b5cf6",
            borderRightColor: "#ec4899",
            animation: "spin 1s linear infinite",
            filter: "drop-shadow(0 0 8px #8b5cf6)",
          }}
        />
        <div
          className="absolute inset-5 rounded-full border-2 border-transparent"
          style={{
            borderBottomColor: "#06b6d4",
            borderLeftColor: "#8b5cf6",
            animation: "spin 1.7s linear infinite reverse",
            filter: "drop-shadow(0 0 6px #06b6d4)",
          }}
        />

        {/* Core */}
        <div className="relative w-28 h-28">
          <div
            className="absolute inset-0 rounded-full opacity-35 blur-2xl"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#db2777)",
              animation: "glowPulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            className="relative w-full h-full rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, rgba(124,58,237,0.25), rgba(219,39,119,0.18))",
              border: "1px solid rgba(255,255,255,0.1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <Zap
              size={36}
              className="text-white"
              style={{
                filter: "drop-shadow(0 0 10px rgba(255,255,255,0.6))",
                animation: "glowPulse 1s ease-in-out infinite",
              }}
            />
          </div>
        </div>

        {/* Orbiting dots */}
        <div
          className="absolute inset-0"
          style={{ animation: "spin 3.5s linear infinite" }}
        >
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 rounded-full"
            style={{ background: "#8b5cf6", boxShadow: "0 0 10px #8b5cf6" }}
          />
        </div>
        <div
          className="absolute inset-2"
          style={{ animation: "spin 4.5s linear infinite reverse" }}
        >
          <div
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full"
            style={{ background: "#ec4899", boxShadow: "0 0 8px #ec4899" }}
          />
        </div>
        <div
          className="absolute inset-7"
          style={{ animation: "spin 2.5s linear infinite" }}
        >
          <div
            className="absolute top-0 right-0 w-2 h-2 rounded-full"
            style={{ background: "#06b6d4", boxShadow: "0 0 7px #06b6d4" }}
          />
        </div>
      </div>

      {/* Status */}
      <p
        className="text-white font-bold text-xl mb-1.5 text-center"
        style={{ textShadow: "0 0 24px rgba(139,92,246,0.5)" }}
      >
        {phase || "Initializing scan…"}
      </p>
      <p className="text-white/35 text-sm font-mono mb-5">
        {progress}% complete
      </p>

      {/* Progress track */}
      <div
        className="w-72 h-[3px] rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-700 relative overflow-hidden"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg,#7c3aed,#ec4899,#06b6d4)",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)",
              animation: "shimmer 1.4s ease-in-out infinite",
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function FullSendApp({ user, onLogout }) {
  const [url, setUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanId, setScanId] = useState(null);
  const [reportToken, setReportToken] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [reportData, setReportData] = useState(null);
  const pollRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch full report data once scan is complete
  useEffect(() => {
    if (done && reportToken) {
      fetch(`${API_BASE_URL}/fullsend/report/${reportToken}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => setReportData(data))
        .catch(() => {});
    }
  }, [done, reportToken]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pollStatus = useCallback(
    async (sid) => {
      try {
        const resp = await fetch(`${API_BASE_URL}/fullsend/status/${sid}`);
        if (!resp.ok) return;
        const data = await resp.json();
        setStatusData(data);
        if (data.status === "complete") {
          stopPolling();
          setDone(true);
          setScanning(false);
        } else if (data.status === "error") {
          stopPolling();
          setError(data.error || "Scan failed.");
          setScanning(false);
        }
      } catch {
        /* keep polling */
      }
    },
    [stopPolling],
  );

  const handleScan = async (e) => {
    e.preventDefault();
    if (!url.trim()) return;
    setError("");
    setDone(false);
    setStatusData(null);
    setScanning(true);
    setScanId(null);
    setReportToken(null);
    try {
      const resp = await fetch(`${API_BASE_URL}/fullsend/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), user_id: user?.user_id }),
      });
      if (!resp.ok) {
        const err = await resp.json();
        throw new Error(err.detail || "Failed to start scan");
      }
      const data = await resp.json();
      setScanId(data.scan_id);
      setReportToken(data.report_token);
      pollRef.current = setInterval(() => pollStatus(data.scan_id), 2000);
    } catch (err) {
      setError(err.message || "Something went wrong");
      setScanning(false);
    }
  };

  const progress = statusData?.progress ?? 0;
  const phaseStatuses = getPhaseStatuses(progress);
  const reportPageUrl = reportToken
    ? `${window.location.origin}/fullsend-report/${reportToken}`
    : null;

  const copyLink = () => {
    if (!reportPageUrl) return;
    navigator.clipboard.writeText(reportPageUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const resetScan = () => {
    setDone(false);
    setScanning(false);
    setUrl("");
    setScanId(null);
    setReportToken(null);
    setStatusData(null);
    setReportData(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  return (
    <div className="min-h-screen text-white" style={{ background: "#05050e" }}>
      <AmbientBg />
      <NavBar
        user={user}
        onLogout={onLogout}
        onBack={() => (window.location.href = "/")}
      />

      {/* Always-visible back button — top-left, level with the island */}
      <button
        onClick={() => window.history.back()}
        className="fixed z-50 flex items-center gap-2 text-white/45 hover:text-white/85 transition-all duration-200 group"
        style={{ top: "18px", left: "24px" }}
      >
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-200 group-hover:bg-white/[0.08]"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />
        </div>
        <span className="text-xs font-medium hidden sm:block">Back</span>
      </button>

      {/* Subtle BETA corner tag — bottom-right, static, unobtrusive */}
      <div
        style={{
          position: "fixed",
          bottom: "20px",
          right: "24px",
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          gap: "6px",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            letterSpacing: "0.18em",
            color: "rgba(255,255,255,0.16)",
            textTransform: "uppercase",
          }}
        >
          Beta
        </span>
        <div
          style={{
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            background: "rgba(139,92,246,0.45)",
          }}
        />
      </div>

      {/* ── Scanning state ── */}
      {scanning && (
        <div
          className="relative flex flex-col items-center justify-center min-h-screen px-6 pt-20"
          style={{ animation: "fadeIn 0.4s ease-out" }}
        >
          <div className="w-full max-w-xl">
            <ScanVisual progress={progress} phase={statusData?.phase} />
            <div className="mt-4">
              <PhaseStatusRow statuses={phaseStatuses} done={false} />
            </div>
          </div>
        </div>
      )}

      {/* ── Done state ── */}
      {done && !scanning && (
        <div
          className="relative px-6 pt-20 pb-24 min-h-screen"
          style={{ animation: "fadeInDown 0.5s ease-out" }}
        >
          <div className="w-full max-w-4xl mx-auto">
            {/* Header row — success + health score */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8 pt-4">
              <div className="flex items-center gap-4 flex-1">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <div
                    className="absolute inset-0 rounded-full opacity-30 blur-lg"
                    style={{
                      background: "#10b981",
                      animation: "glowPulse 2s ease-in-out infinite",
                    }}
                  />
                  <div
                    className="relative w-full h-full rounded-full flex items-center justify-center"
                    style={{
                      background: "rgba(16,185,129,0.1)",
                      border: "2px solid rgba(16,185,129,0.4)",
                    }}
                  >
                    <CheckCircle2
                      size={26}
                      style={{
                        color: "#10b981",
                        filter: "drop-shadow(0 0 8px #10b981)",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <h2 className="text-3xl font-black text-white leading-tight">
                    Report is live!
                  </h2>
                  <p className="text-white/35 text-sm mt-1">
                    {statusData?.phase} · Anyone with the link can view — no
                    login needed
                  </p>
                </div>
              </div>

              {/* Health score ring */}
              {reportData?.app_health_score != null &&
                (() => {
                  const score = reportData.app_health_score;
                  const color =
                    score >= 90
                      ? "#10b981"
                      : score >= 70
                        ? "#f59e0b"
                        : score >= 50
                          ? "#f97316"
                          : "#ef4444";
                  const r = 38;
                  const circ = 2 * Math.PI * r;
                  return (
                    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                      <div className="relative w-20 h-20">
                        <svg
                          viewBox="0 0 100 100"
                          className="w-full h-full"
                          style={{ transform: "rotate(-90deg)" }}
                        >
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke="rgba(255,255,255,0.06)"
                            strokeWidth="9"
                          />
                          <circle
                            cx="50"
                            cy="50"
                            r={r}
                            fill="none"
                            stroke={color}
                            strokeWidth="9"
                            strokeDasharray={`${(score / 100) * circ} ${circ}`}
                            strokeLinecap="round"
                            style={{ filter: `drop-shadow(0 0 5px ${color})` }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span
                            className="text-2xl font-black"
                            style={{ color }}
                          >
                            {score}
                          </span>
                        </div>
                      </div>
                      <span className="text-white/30 text-[10px] font-semibold tracking-widest uppercase">
                        Health
                      </span>
                    </div>
                  );
                })()}
            </div>

            {/* Phase status row */}
            <div className="mb-6">
              <PhaseStatusRow statuses={[]} done={true} />
            </div>

            {/* Detail cards — only when report data is fetched */}
            {reportData && (
              <div
                className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5"
                style={{ animation: "fadeInUp 0.4s ease-out" }}
              >
                {/* AI Executive Summary */}
                {reportData.executive_summary && (
                  <div
                    className="rounded-2xl p-5 border"
                    style={{
                      background: "rgba(139,92,246,0.05)",
                      borderColor: "rgba(139,92,246,0.15)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={12} style={{ color: "#a78bfa" }} />
                      <span className="text-[11px] font-semibold text-white/40 tracking-widest uppercase">
                        AI Summary
                      </span>
                    </div>
                    <p className="text-white/70 text-sm leading-relaxed">
                      {reportData.executive_summary}
                    </p>
                  </div>
                )}

                {/* Key metrics */}
                <div
                  className="rounded-2xl p-5 border"
                  style={{
                    background: "rgba(255,255,255,0.025)",
                    borderColor: "rgba(255,255,255,0.07)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Activity size={12} style={{ color: "#06b6d4" }} />
                    <span className="text-[11px] font-semibold text-white/40 tracking-widest uppercase">
                      Scan Results
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      {
                        label: "Pages crawled",
                        val: reportData.pages_discovered ?? "—",
                        color: "#818cf8",
                      },
                      {
                        label: "Smoke tests",
                        val: `${reportData.smoke?.passed ?? 0}/${reportData.smoke?.total ?? 0}`,
                        color: "#10b981",
                      },
                      {
                        label: "Security issues",
                        val:
                          (reportData.security?.critical ?? 0) +
                          (reportData.security?.high ?? 0) +
                          (reportData.security?.medium ?? 0),
                        color: "#f87171",
                      },
                      {
                        label: "Avg response",
                        val: reportData.performance?.avg_ms
                          ? `${reportData.performance.avg_ms}ms`
                          : "—",
                        color: "#06b6d4",
                      },
                    ].map((s, i) => (
                      <div key={i}>
                        <p
                          className="text-2xl font-black leading-none mb-1"
                          style={{ color: s.color }}
                        >
                          {s.val}
                        </p>
                        <p className="text-white/30 text-[11px]">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Priority actions */}
                {reportData.priority_actions?.length > 0 && (
                  <div
                    className="rounded-2xl p-5 border md:col-span-2"
                    style={{
                      background: "rgba(239,68,68,0.04)",
                      borderColor: "rgba(239,68,68,0.12)",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <ShieldCheck size={12} style={{ color: "#f87171" }} />
                      <span className="text-[11px] font-semibold text-white/40 tracking-widest uppercase">
                        Top Priority Actions
                      </span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {reportData.priority_actions
                        .slice(0, 3)
                        .map((action, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span
                              className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5"
                              style={{
                                background: "rgba(239,68,68,0.15)",
                                color: "#f87171",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="text-white/60 text-sm leading-snug">
                              {action}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Report link card */}
            <div
              className="rounded-3xl border overflow-hidden mb-5"
              style={{
                borderColor: "rgba(16,185,129,0.18)",
                background: "rgba(16,185,129,0.04)",
                backdropFilter: "blur(16px)",
              }}
            >
              <div
                className="px-5 py-3.5 border-b text-xs font-mono text-white/22 truncate"
                style={{ borderColor: "rgba(255,255,255,0.05)" }}
              >
                {reportPageUrl}
              </div>
              <div className="p-4 flex gap-3">
                <button
                  onClick={() => window.open(reportPageUrl, "_blank")}
                  className="flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#db2777)",
                    boxShadow:
                      "0 0 28px rgba(124,58,237,0.4), 0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  <ExternalLink size={15} />
                  View Full Report
                </button>
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl font-medium text-sm border transition-all duration-200"
                  style={{
                    borderColor: copied
                      ? "rgba(16,185,129,0.45)"
                      : "rgba(255,255,255,0.1)",
                    background: copied
                      ? "rgba(16,185,129,0.1)"
                      : "rgba(255,255,255,0.04)",
                    color: copied ? "#34d399" : "rgba(255,255,255,0.6)",
                  }}
                >
                  <Copy size={14} />
                  {copied ? "Copied!" : "Copy"}
                </button>
                <button
                  onClick={copyLink}
                  className="flex items-center justify-center px-4 py-3.5 rounded-2xl border border-white/10 transition-all duration-200 hover:border-white/20"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    color: "rgba(255,255,255,0.5)",
                  }}
                >
                  <Share2 size={14} />
                </button>
              </div>
            </div>

            {/* Scan another — now with real bottom breathing room */}
            <div className="text-center">
              <button
                onClick={resetScan}
                className="group inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-[1.03]"
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.14)",
                  color: "rgba(255,255,255,0.65)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.9)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                  e.currentTarget.style.color = "rgba(255,255,255,0.65)";
                }}
              >
                <ArrowRight size={13} style={{ transform: "rotate(180deg)" }} />
                Scan another URL
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Idle / Input state ── */}
      {!scanning && !done && (
        <div className="relative pt-20 min-h-screen flex flex-col">
          {/* Split layout */}
          <div className="flex-1 max-w-6xl mx-auto w-full px-6 grid grid-cols-1 lg:grid-cols-[1fr_1.15fr] gap-10 xl:gap-16 items-center py-12 lg:py-0 min-h-[calc(100vh-80px)]">
            {/* LEFT — Branding */}
            <div style={{ animation: "fadeInLeft 0.65s ease-out both" }}>
              {/* Badge */}
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold mb-7 border"
                style={{
                  background: "rgba(124,58,237,0.07)",
                  borderColor: "rgba(124,58,237,0.22)",
                  color: "#c4b5fd",
                }}
              >
                <Sparkles size={11} style={{ color: "#a78bfa" }} />
                Zero Config · 5 Parallel Suites · GPT-4 Report
              </div>

              {/* Title */}
              <h1
                className="font-black leading-[0.9] tracking-tight mb-5"
                style={{ fontSize: "clamp(62px, 8vw, 96px)" }}
              >
                <span
                  className="block"
                  style={{
                    background:
                      "linear-gradient(135deg, #e879f9, #c084fc, #818cf8)",
                    backgroundSize: "200% 200%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "gradientFlow 5s ease-in-out infinite",
                  }}
                >
                  Full
                </span>
                <span
                  className="block"
                  style={{
                    background:
                      "linear-gradient(135deg, #f9a8d4, #c084fc, #67e8f9)",
                    backgroundSize: "200% 200%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    animation: "gradientFlow 5s ease-in-out 0.6s infinite",
                  }}
                >
                  Send
                </span>
              </h1>

              <p className="text-white/55 text-xl font-medium mb-3 leading-snug">
                Drop a URL.
                <br />
                We test{" "}
                <em className="not-italic text-white/75">everything.</em>
              </p>
              <p className="text-white/25 text-sm leading-relaxed mb-10 max-w-sm">
                Crawls every page · Runs smoke, functional, visual,
                <br />
                security & performance tests · All in under 60s
              </p>

              {/* Stats */}
              <div className="flex items-center gap-8">
                {[
                  { val: "<60s", label: "Total time" },
                  { val: "5", label: "Suites run" },
                  { val: "∞", label: "Shareable" },
                ].map((s, i) => (
                  <div key={i}>
                    <p
                      className="text-3xl font-black leading-none mb-1"
                      style={{
                        background: "linear-gradient(135deg,#c084fc,#f0abfc)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                      }}
                    >
                      {s.val}
                    </p>
                    <p className="text-white/30 text-xs font-medium">
                      {s.label}
                    </p>
                  </div>
                ))}
              </div>

              {/* Feature list — desktop only */}
              <div className="hidden lg:flex flex-col gap-2.5 mt-10">
                {ALL_CARDS.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div
                      key={card.key}
                      className="flex items-center gap-3 group cursor-default"
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110"
                        style={{
                          background: `${card.color}18`,
                          border: `1px solid ${card.color}25`,
                        }}
                      >
                        <Icon size={13} style={{ color: card.color }} />
                      </div>
                      <span className="text-white/45 text-sm font-medium group-hover:text-white/70 transition-colors duration-200">
                        <span className="text-white/70 font-semibold">
                          {card.label}
                        </span>{" "}
                        — {card.desc}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RIGHT — Scanner */}
            <div style={{ animation: "fadeInRight 0.65s ease-out 0.1s both" }}>
              {/* Input card */}
              <div className="relative mb-5">
                <UrlScannerInput
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onSubmit={handleScan}
                  placeholder="https://yourapp.com"
                  buttonLabel="FULL SEND IT"
                  disabled={done}
                  error={error}
                  onClear={() => setUrl("")}
                  inputRef={inputRef}
                  inputFocused={inputFocused}
                  setInputFocused={setInputFocused}
                />
              </div>

              {/* Phase cards grid (mobile: 3×2, desktop: 3×2 with AI card) */}
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(255,255,255,0.07))",
                    }}
                  />
                  <span className="text-white/22 text-[10px] font-semibold tracking-[0.15em] uppercase">
                    5 suites run in parallel
                  </span>
                  <div
                    className="flex-1 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(255,255,255,0.07), transparent)",
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {ALL_CARDS.map((card, i) => {
                    const Icon = card.icon;
                    return (
                      <div
                        key={card.key}
                        className="group relative rounded-2xl p-4 border overflow-hidden cursor-default transition-all duration-300 hover:scale-[1.02] hover:-translate-y-0.5"
                        style={{
                          borderColor: "rgba(255,255,255,0.07)",
                          background: "rgba(255,255,255,0.025)",
                          animationDelay: `${0.35 + i * 0.06}s`,
                        }}
                      >
                        {/* Top edge glow on hover */}
                        <div
                          className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                          style={{
                            background: `linear-gradient(90deg, transparent, ${card.color}55, transparent)`,
                          }}
                        />
                        {/* Radial fill on hover */}
                        <div
                          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400"
                          style={{
                            background: `radial-gradient(circle at 50% 0%, ${card.color}18, transparent 65%)`,
                          }}
                        />
                        <div className="relative">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 transition-all duration-300 group-hover:scale-110"
                            style={{
                              background: `${card.color}14`,
                              border: `1px solid ${card.color}20`,
                            }}
                          >
                            <Icon size={16} style={{ color: card.color }} />
                          </div>
                          <p className="text-xs font-bold text-white/75 mb-0.5">
                            {card.label}
                          </p>
                          <p className="text-[11px] text-white/28 leading-snug">
                            {card.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spinSlow { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes glowPulse { 0%,100%{opacity:0.25} 50%{opacity:0.75} }
        @keyframes gradientFlow {
          0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%}
        }
        @keyframes floatParticle {
          0%,100%{transform:translateY(0) translateX(0) scale(1);opacity:0.35}
          33%{transform:translateY(-28px) translateX(14px) scale(1.2);opacity:0.7}
          66%{transform:translateY(-12px) translateX(-9px) scale(0.9);opacity:0.45}
        }
        @keyframes slowDrift {
          0%,100%{transform:translate(0,0) scale(1)}
          50%{transform:translate(28px,-18px) scale(1.08)}
        }
        @keyframes shimmer {
          from{transform:translateX(-100%)} to{transform:translateX(200%)}
        }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes fadeInDown {
          from{opacity:0;transform:translateY(-18px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes fadeInUp {
          from{opacity:0;transform:translateY(18px)} to{opacity:1;transform:translateY(0)}
        }
        @keyframes fadeInLeft {
          from{opacity:0;transform:translateX(-24px)} to{opacity:1;transform:translateX(0)}
        }
        @keyframes fadeInRight {
          from{opacity:0;transform:translateX(24px)} to{opacity:1;transform:translateX(0)}
        }
      `}</style>
    </div>
  );
}
