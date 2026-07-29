import React, { useEffect, useRef, useState } from "react";
import {
  Zap,
  Shield,
  Activity,
  TrendingUp,
  Users,
  CheckCircle,
  Star,
  Globe,
  Code,
  Cpu,
  Rocket,
  BarChart3,
  Lock,
  GitBranch,
  Terminal,
  Sparkles,
  ArrowRight,
  Github,
  Twitter,
  Linkedin,
  Mail,
  FileCheck,
  AlertTriangle,
  Clock,
  Bug,
  GitCompare,
  FileText,
  Database,
  Target,
  Layers,
  Brain,
  X,
  MessageSquare,
  Copy,
  Search,
  Play,
  Settings,
  Eye,
} from "lucide-react";
import {
  METHOD_STYLES,
  REQUEST_POOL,
  MATRIX_GROUPS,
  REVIEW_CARDS,
  PIPELINE_STAGES,
  FAQ_ITEMS,
} from "./content";

export const FlasqoTrafficVisualizer = () => {
  const [liveLog, setLiveLog] = useState([]);
  const [processed, setProcessed] = useState(0);
  const [phase, setPhase] = useState(null);
  const [currentReq, setCurrentReq] = useState(null);
  const [packetLeft, setPacketLeft] = useState(false);
  const [packetRight, setPacketRight] = useState(false);
  const [procSteps, setProcSteps] = useState([]);
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const PROC_LABELS = [
      "Schema Check",
      "Auth Validate",
      "Assertions",
      "AI Review",
    ];

    const runCycle = () => {
      const req = {
        ...REQUEST_POOL[idxRef.current % REQUEST_POOL.length],
        uid: Date.now(),
      };
      idxRef.current += 1;
      setCurrentReq(req);
      setPhase("sending");
      setProcSteps([]);

      timerRef.current = setTimeout(() => {
        setPacketLeft(true);
        setTimeout(() => setPacketLeft(false), 680);

        timerRef.current = setTimeout(() => {
          setPhase("intercepting");
          PROC_LABELS.forEach((_, i) => {
            timerRef.current = setTimeout(() => {
              setProcSteps((prev) => [...prev, i]);
            }, i * 270);
          });

          timerRef.current = setTimeout(() => {
            setPacketRight(true);
            setTimeout(() => setPacketRight(false), 680);

            timerRef.current = setTimeout(() => {
              setPhase("result");
              setProcessed((n) => n + 1);
              setLiveLog((prev) =>
                [
                  {
                    ...req,
                    ts: new Date().toLocaleTimeString("en-US", {
                      hour12: false,
                    }),
                  },
                  ...prev,
                ].slice(0, 5),
              );

              timerRef.current = setTimeout(() => {
                setPhase(null);
                setCurrentReq(null);
                timerRef.current = setTimeout(runCycle, 400);
              }, 1600);
            }, 680);
          }, 1200);
        }, 680);
      }, 500);
    };

    timerRef.current = setTimeout(runCycle, 700);
    return () => clearTimeout(timerRef.current);
  }, []);

  const passCount = liveLog.filter((log) => log.passed).length;
  const failCount = liveLog.filter((log) => !log.passed).length;

  const getAssertions = (req) => {
    if (!req) return [];
    return [
      { label: `status ${req.status}`, pass: req.passed },
      { label: "response schema valid", pass: req.passed },
      { label: `${req.ms}ms latency`, pass: req.ms < 300 },
      ...(["POST", "PUT", "PATCH"].includes(req.method)
        ? [{ label: "request body accepted", pass: true }]
        : [{ label: "idempotent contract OK", pass: req.passed }]),
    ];
  };

  const getBody = (method) => {
    const map = {
      POST: '  "email": "dev@test.co",\n  "role": "developer"',
      PUT: '  "theme": "dark",\n  "notify": true',
      PATCH: '  "status": "active"',
    };
    return map[method] || null;
  };

  const assertions = getAssertions(currentReq);
  const showingResult = phase === "result";

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 py-8">
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-sm text-green-400 font-semibold tracking-wide">
            Live Intercept Engine
          </span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
          <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
            Every Request, Intercepted.
          </span>
          <br />
          <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
            Analyzed. Validated.
          </span>
        </h2>
        <p className="text-gray-400 text-lg max-w-xl mx-auto">
          Flasqo sits as an intelligent middleware layer — capturing, analyzing,
          and validating every HTTP call in real time.
        </p>
      </div>

      <div
        className="relative grid items-stretch gap-0"
        style={{
          gridTemplateColumns: "1fr 56px 220px 56px 1fr",
          height: "390px",
        }}
      >
        <div
          className="flex flex-col bg-[#0d1117] border border-slate-700/60 rounded-xl overflow-hidden"
          style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}
        >
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-slate-800/80 bg-black/40 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[12px] text-gray-600 tracking-wider">
              ~/dev • curl
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[11px] text-orange-400/70 font-mono">
                OUTBOUND
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 text-[13px]">
            {currentReq ? (
              <div
                key={currentReq.uid}
                style={{ animation: "ftv-slideIn 0.22s ease-out" }}
              >
                <div className="text-gray-700 mb-1 font-mono">
                  $ curl -X{" "}
                  <span
                    className={`font-bold ${METHOD_STYLES[currentReq.method]?.badge?.includes("blue") ? "text-blue-400" : METHOD_STYLES[currentReq.method]?.badge?.includes("green") ? "text-green-400" : METHOD_STYLES[currentReq.method]?.badge?.includes("red") ? "text-red-400" : METHOD_STYLES[currentReq.method]?.badge?.includes("yellow") ? "text-yellow-400" : "text-purple-400"}`}
                  >
                    {currentReq.method}
                  </span>{" "}
                  \
                </div>
                <div className="flex items-center gap-2 mb-2 pl-2">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[12px] font-bold border font-mono ${METHOD_STYLES[currentReq.method]?.badge}`}
                  >
                    {currentReq.method}
                  </span>
                  <span className="text-cyan-400 font-mono truncate">
                    {currentReq.path}
                  </span>
                </div>
                <div className="pl-2 text-gray-700 font-mono text-[12px] mb-0.5">
                  -H{" "}
                  <span className="text-green-400/60">
                    'Content-Type: application/json'
                  </span>{" "}
                  \
                </div>
                <div className="pl-2 text-gray-700 font-mono text-[12px] mb-2">
                  -H{" "}
                  <span className="text-green-400/60">
                    'Authorization: Bearer{" "}
                    <span className="text-gray-600">••••••</span>'
                  </span>{" "}
                  \
                </div>
                {getBody(currentReq.method) ? (
                  <div className="pl-2 font-mono text-[12px]">
                    <span className="text-gray-700">-d </span>
                    <span className="text-gray-600">{"{"}</span>
                    {getBody(currentReq.method)
                      .split("\n")
                      .map((line, i) => (
                        <div key={i} className="pl-4 text-green-400/70">
                          {line}
                        </div>
                      ))}
                    <span className="text-gray-600">{"}"}</span>
                  </div>
                ) : (
                  <div className="pl-2 text-gray-700 font-mono text-[12px]">
                    --no-body
                  </div>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[12px] font-mono">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${phase === "sending" ? "bg-yellow-400 animate-pulse" : "bg-blue-500"}`}
                  />
                  <span
                    className={
                      phase === "sending"
                        ? "text-yellow-400/80"
                        : "text-blue-400/80"
                    }
                  >
                    {phase === "sending"
                      ? "Sending request..."
                      : "Request dispatched"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-700 pt-2 font-mono text-[13px]">
                <span className="inline-block w-[7px] h-[13px] bg-gray-700 animate-pulse rounded-sm" />
                <span>Waiting for outbound calls...</span>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 px-3.5 py-1.5 border-t border-slate-800/60 flex items-center gap-2 bg-black/20">
            <Code size={9} className="text-gray-700" />
            <span className="text-[11px] text-gray-700 font-mono">
              dev environment
            </span>
            <span className="ml-auto text-[11px] text-gray-700 font-mono tabular-nums">
              {processed} fired
            </span>
          </div>
        </div>

        <div
          className="relative flex items-center justify-center"
          style={{ overflow: "visible" }}
        >
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
            style={{
              background:
                "linear-gradient(90deg,rgba(99,102,241,0.15),rgba(59,130,246,0.5))",
            }}
          />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{
              borderTop: "3px solid transparent",
              borderBottom: "3px solid transparent",
              borderLeft: "5px solid rgba(59,130,246,0.45)",
            }}
          />
          {packetLeft && currentReq && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${METHOD_STYLES[currentReq.method]?.dot}`}
              style={{
                left: "0%",
                animation: "ftv-packetFly 0.66s ease-in-out forwards",
                willChange: "left, opacity",
              }}
            />
          )}
        </div>

        <div
          className="flex flex-col items-center justify-between bg-gradient-to-b from-blue-950/60 via-slate-900/70 to-blue-950/60 border border-blue-500/35 rounded-xl px-4 py-4 relative overflow-hidden"
          style={{
            boxShadow:
              "0 0 32px rgba(59,130,246,0.09), inset 0 1px 0 rgba(255,255,255,0.04)",
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 70%)",
            }}
          />
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <img
              src="/flasqo-logo.png"
              alt="Flasqo"
              className="mix-blend-screen"
              style={{ height: "60px", width: "auto", objectFit: "contain" }}
            />
            <span className="text-[12px] font-bold text-white">Flasqo</span>
            <span className="text-[10px] text-blue-400/55 font-mono tracking-[0.2em]">
              MIDDLEWARE
            </span>
          </div>
          <div className="w-full flex-shrink-0" style={{ minHeight: "44px" }}>
            {currentReq ? (
              <div
                key={currentReq.uid + "-badge"}
                className={`w-full rounded-lg px-2 py-2 text-center border ${METHOD_STYLES[currentReq.method]?.badge}`}
                style={{
                  background: "rgba(0,0,0,0.45)",
                  animation: "ftv-slideIn 0.18s ease-out",
                }}
              >
                <div className="text-[13px] font-bold font-mono">
                  {currentReq.method}
                </div>
                <div className="text-[11px] text-gray-400 font-mono truncate">
                  {currentReq.path}
                </div>
              </div>
            ) : (
              <div className="w-full rounded-lg px-2 py-2 text-center border border-slate-800/50 bg-black/20">
                <div className="text-[12px] text-gray-700 font-mono">Idle</div>
              </div>
            )}
          </div>
          <div className="w-full space-y-1.5 flex-shrink-0">
            {["Schema", "Auth", "Assert", "AI"].map((step, i) => {
              const done = procSteps.includes(i);
              return (
                <div key={step} className="flex items-center gap-2">
                  <span
                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-150 ${done ? "bg-green-400" : "bg-slate-700"}`}
                  />
                  <span
                    className={`text-[11px] font-mono transition-colors duration-150 ${done ? "text-green-400" : "text-gray-700"}`}
                  >
                    {step}
                  </span>
                  {done && (
                    <span className="ml-auto text-[10px] text-green-500/60 font-mono">
                      ✓
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="w-full grid grid-cols-2 gap-1.5 flex-shrink-0">
            <div className="text-center rounded-lg bg-slate-800/50 border border-slate-700/30 py-1.5">
              <div className="text-[14px] font-bold text-white tabular-nums">
                {processed}
              </div>
              <div className="text-[10px] text-gray-700 uppercase tracking-wider font-mono">
                Seen
              </div>
            </div>
            <div className="text-center rounded-lg bg-green-900/25 border border-green-500/20 py-1.5">
              <div className="text-[14px] font-bold text-green-400 tabular-nums">
                {passCount}
              </div>
              <div className="text-[10px] text-gray-700 uppercase tracking-wider font-mono">
                Pass
              </div>
            </div>
          </div>
        </div>

        <div
          className="relative flex items-center justify-center"
          style={{ overflow: "visible" }}
        >
          <div
            className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
            style={{
              background:
                "linear-gradient(90deg,rgba(59,130,246,0.5),rgba(16,185,129,0.3))",
            }}
          />
          <div
            className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{
              borderTop: "3px solid transparent",
              borderBottom: "3px solid transparent",
              borderLeft: "5px solid rgba(16,185,129,0.45)",
            }}
          />
          {packetRight && currentReq && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${METHOD_STYLES[currentReq.method]?.dot}`}
              style={{
                left: "0%",
                animation: "ftv-packetFly 0.66s ease-in-out forwards",
                willChange: "left, opacity",
              }}
            />
          )}
        </div>

        <div
          className="flex flex-col bg-[#0d1117] border border-slate-700/60 rounded-xl overflow-hidden"
          style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}
        >
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-slate-800/80 bg-black/40 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[12px] text-gray-600 tracking-wider">
              flasqo/test-suite
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              <span className="text-[11px] text-green-400/70 font-mono">
                RUNNING
              </span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 text-[13px]">
            {currentReq && (phase === "intercepting" || phase === "result") ? (
              <div
                key={currentReq.uid + "-result"}
                style={{ animation: "ftv-slideIn 0.22s ease-out" }}
              >
                <div className="flex items-center gap-2 mb-2.5 font-mono text-[12px]">
                  <span
                    className={`font-bold ${phase === "result" ? (currentReq.passed ? "text-green-400" : "text-red-400") : "text-yellow-400"}`}
                  >
                    {phase === "result"
                      ? currentReq.passed
                        ? "PASS"
                        : "FAIL"
                      : "RUN "}
                  </span>
                  <span className="text-gray-500">
                    flasqo/{currentReq.label.toLowerCase().replace(/ /g, "-")}
                  </span>
                </div>
                <div className="space-y-1 mb-3">
                  {assertions.map((a, i) => {
                    const revealed =
                      procSteps.includes(i) || phase === "result";
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 font-mono text-[12px]"
                        style={{
                          opacity: revealed ? 1 : 0,
                          transition: "opacity 0.18s ease",
                        }}
                      >
                        <span
                          className={`font-bold flex-shrink-0 ${a.pass ? "text-green-400" : "text-red-400"}`}
                        >
                          {a.pass ? "✓" : "✗"}
                        </span>
                        <span
                          className={
                            a.pass ? "text-gray-400" : "text-red-400/80"
                          }
                        >
                          {a.label}
                        </span>
                        {i === 0 && (
                          <span className="ml-auto text-gray-700 text-[11px]">
                            {currentReq.ms}ms
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
                {phase === "result" && (
                  <div
                    className={`font-mono text-[12px] font-bold pt-2 border-t border-slate-800/50 ${currentReq.passed ? "text-green-400" : "text-red-400"}`}
                    style={{ animation: "ftv-slideIn 0.14s ease-out" }}
                  >
                    {assertions.filter((a) => a.pass).length} passed
                    {assertions.filter((a) => !a.pass).length > 0 && (
                      <span className="text-red-400">
                        , {assertions.filter((a) => !a.pass).length} failed
                      </span>
                    )}
                    <span className="text-gray-700 font-normal ml-2 text-[11px]">
                      {currentReq.ms}ms
                    </span>
                  </div>
                )}
              </div>
            ) : liveLog.length > 0 ? (
              <div className="space-y-0.5">
                {liveLog.map((log, i) => (
                  <div
                    key={log.uid}
                    className="flex items-center gap-2 text-[12px] py-1 border-b border-slate-800/25 last:border-0 font-mono"
                    style={{
                      opacity: i === 0 ? 1 : Math.max(0.25, 1 - i * 0.18),
                      ...(i === 0
                        ? { animation: "ftv-slideIn 0.22s ease-out" }
                        : {}),
                    }}
                  >
                    <span
                      className={`font-bold flex-shrink-0 ${log.passed ? "text-green-400" : "text-red-400"}`}
                    >
                      {log.passed ? "✓" : "✗"}
                    </span>
                    <span
                      className={`text-[11px] font-bold border px-1 py-0.5 rounded flex-shrink-0 ${METHOD_STYLES[log.method]?.badge}`}
                    >
                      {log.method}
                    </span>
                    <span className="text-gray-500 truncate flex-1">
                      {log.label}
                    </span>
                    <span
                      className={`font-bold flex-shrink-0 ${log.passed ? "text-green-400" : "text-red-400"}`}
                    >
                      {log.status}
                    </span>
                    <span className="text-gray-700 flex-shrink-0">
                      {log.ms}ms
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-700 pt-2 font-mono text-[13px]">
                <span className="inline-block w-[7px] h-[13px] bg-gray-700 animate-pulse rounded-sm" />
                <span>Awaiting first intercept...</span>
              </div>
            )}
          </div>

          <div className="flex-shrink-0 px-3.5 py-1.5 border-t border-slate-800/60 flex items-center gap-2 bg-black/20">
            <CheckCircle size={9} className="text-gray-700" />
            <span className="text-[11px] text-gray-700 font-mono">
              validated by flasqo
            </span>
            <span className="ml-auto font-mono text-[11px]">
              <span className="text-green-500/70">{passCount}↑</span>{" "}
              <span className="text-red-500/70">{failCount}↓</span>
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          {
            label: "Avg Latency",
            value: "~118ms",
            icon: Clock,
            color: "text-blue-400",
            border: "border-blue-500/20",
            bg: "bg-blue-500/5",
          },
          {
            label: "Pass Rate",
            value:
              processed > 0
                ? `${Math.round((passCount / Math.max(processed, 1)) * 100)}%`
                : "—",
            icon: TrendingUp,
            color: "text-green-400",
            border: "border-green-500/20",
            bg: "bg-green-500/5",
          },
          {
            label: "AI Assertions",
            value: `${processed * 4}`,
            icon: Brain,
            color: "text-purple-400",
            border: "border-purple-500/20",
            bg: "bg-purple-500/5",
          },
          {
            label: "Intercepted",
            value: `${processed}`,
            icon: Activity,
            color: "text-cyan-400",
            border: "border-cyan-500/20",
            bg: "bg-cyan-500/5",
          },
        ].map(({ label, value, icon: Icon, color, border, bg }) => (
          <div
            key={label}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${border} ${bg}`}
          >
            <Icon size={15} className={color} />
            <div>
              <div
                className={`text-lg font-bold tabular-nums font-mono ${color}`}
              >
                {value}
              </div>
              <div className="text-[12px] text-gray-600 uppercase tracking-wider">
                {label}
              </div>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes ftv-slideIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ftv-packetFly {
          0%   { left: 3%;  opacity: 0; }
          10%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { left: 97%; opacity: 0; }
        }
      `}</style>
    </section>
  );
};

export const MatrixCell = ({ v }) => {
  if (v === "check")
    return (
      <span className="text-green-400 text-lg font-bold leading-none">✓</span>
    );
  if (v === "dash")
    return <span className="text-slate-700 text-base font-mono">—</span>;
  if (v === "partial")
    return (
      <span className="px-2 py-0.5 rounded text-[12px] font-mono font-bold bg-amber-500/10 text-amber-500/75 border border-amber-500/20 whitespace-nowrap">
        Partial
      </span>
    );
  if (v === "paid")
    return (
      <span className="px-2 py-0.5 rounded text-[12px] font-mono font-bold bg-slate-700/40 text-gray-500 border border-slate-600/30 whitespace-nowrap">
        Paid
      </span>
    );
  if (v === "addon")
    return (
      <span className="px-2 py-0.5 rounded text-[12px] font-mono font-bold bg-slate-700/40 text-gray-500 border border-slate-600/30 whitespace-nowrap">
        Add-on
      </span>
    );
  return null;
};

export const ComparisonMatrix = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [fading, setFading] = useState(false);
  const pendingTab = useRef(null);

  const switchTab = (i) => {
    if (i === activeTab || fading) return;
    pendingTab.current = i;
    setFading(true);
    setTimeout(() => {
      setActiveTab(pendingTab.current);
      setFading(false);
    }, 160);
  };

  const { rows, label: groupLabel } = MATRIX_GROUPS[activeTab];

  return (
    <section
      id="compare"
      className="relative z-10 max-w-4xl mx-auto px-6 py-12"
    >
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 mb-4">
          <GitCompare size={12} className="text-blue-400" />
          <span className="text-xs text-blue-300 font-semibold tracking-wide">
            How We Stack Up
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-2 leading-tight">
          <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
            Flasqo{" "}
          </span>
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            vs The Rest
          </span>
        </h2>
        <p className="text-gray-600 text-sm">
          13-module AI engine vs legacy API testing tools.
        </p>
        <div className="flex items-center justify-center gap-2 mt-3">
          {[
            {
              label: "Testing",
              count: 8,
              color: "#3b82f6",
              bg: "rgba(59,130,246,0.10)",
              border: "rgba(59,130,246,0.30)",
            },
            {
              label: "AI Features",
              count: 4,
              color: "#a78bfa",
              bg: "rgba(167,139,250,0.10)",
              border: "rgba(167,139,250,0.30)",
            },
            {
              label: "Dev Experience",
              count: 5,
              color: "#22d3ee",
              bg: "rgba(34,211,238,0.10)",
              border: "rgba(34,211,238,0.30)",
            },
          ].map((c, i) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[13px] font-mono font-semibold"
              style={{
                color: c.color,
                background: c.bg,
                border: `1px solid ${c.border}`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ background: c.color }}
              />
              {c.label}
              <span className="opacity-60">{c.count}</span>
            </span>
          ))}
          <span className="text-[13px] text-slate-600 font-mono ml-1">
            ← click to switch
          </span>
        </div>
      </div>

      <div
        className="rounded-xl border border-slate-700/40 overflow-hidden"
        style={{ background: "rgba(9,13,24,0.98)" }}
      >
        <div
          className="grid border-b border-slate-800/70"
          style={{ gridTemplateColumns: "1fr 120px 108px 108px 108px" }}
        >
          {(() => {
            const TAB_COLORS = [
              {
                text: "#93c5fd",
                dimText: "#60a5fa99",
                bg: "rgba(59,130,246,0.12)",
                activeBg: "rgba(59,130,246,0.18)",
                border: "rgba(59,130,246,0.45)",
                dimBorder: "rgba(59,130,246,0.22)",
                dot: "#3b82f6",
              },
              {
                text: "#c4b5fd",
                dimText: "#a78bfa99",
                bg: "rgba(167,139,250,0.12)",
                activeBg: "rgba(167,139,250,0.18)",
                border: "rgba(167,139,250,0.50)",
                dimBorder: "rgba(167,139,250,0.22)",
                dot: "#a78bfa",
              },
              {
                text: "#67e8f9",
                dimText: "#22d3ee99",
                bg: "rgba(34,211,238,0.12)",
                activeBg: "rgba(34,211,238,0.18)",
                border: "rgba(34,211,238,0.45)",
                dimBorder: "rgba(34,211,238,0.22)",
                dot: "#22d3ee",
              },
            ];
            return (
              <div className="flex items-center gap-2 px-4 py-3">
                {MATRIX_GROUPS.map((g, i) => {
                  const c = TAB_COLORS[i];
                  const isActive = activeTab === i;
                  return (
                    <button
                      key={g.tab}
                      onClick={() => switchTab(i)}
                      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-mono font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                      style={{
                        color: isActive ? c.text : c.dimText,
                        background: isActive ? c.activeBg : c.bg,
                        border: `1px solid ${isActive ? c.border : c.dimBorder}`,
                        boxShadow: isActive ? `0 0 10px ${c.dot}30` : "none",
                        animation: isActive
                          ? "none"
                          : `matrixTabPulse 2.8s ease-in-out ${i * 0.9}s infinite`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: isActive ? c.dot : `${c.dot}60` }}
                      />
                      {g.tab}
                      <span
                        className="text-[11px] px-1 py-px rounded font-mono leading-none"
                        style={{
                          background: isActive ? `${c.dot}25` : `${c.dot}12`,
                          color: isActive ? c.text : c.dimText,
                        }}
                      >
                        {g.rows.length}
                      </span>
                    </button>
                  );
                })}
                <span className="ml-1 text-[11px] text-slate-700 font-mono hidden sm:flex items-center gap-1">
                  <span
                    style={{
                      animation: "matrixArrowBounce 1.4s ease-in-out infinite",
                    }}
                  >
                    ↔
                  </span>{" "}
                  explore
                </span>
              </div>
            );
          })()}
          <style>{`
            @keyframes matrixTabPulse {
              0%, 100% { opacity: 0.65; }
              50%       { opacity: 1; box-shadow: 0 0 8px currentColor; }
            }
            @keyframes matrixArrowBounce {
              0%, 100% { transform: translateX(0); }
              50%       { transform: translateX(3px); }
            }
          `}</style>

          <div
            className="flex flex-col items-center justify-center py-3.5 gap-1.5"
            style={{
              background: "rgba(59,130,246,0.07)",
              borderLeft: "1px solid rgba(59,130,246,0.18)",
              borderRight: "1px solid rgba(59,130,246,0.18)",
            }}
          >
            <Shield size={13} className="text-blue-400" />
            <span className="text-[12px] font-bold text-white font-mono tracking-widest">
              FLASQO
            </span>
          </div>
          {["POSTMAN", "KATALON", "INSOMNIA"].map((name) => (
            <div
              key={name}
              className="flex items-center justify-center py-3.5 border-l border-slate-800/40"
            >
              <span className="text-[12px] font-mono font-semibold text-slate-600 uppercase tracking-widest">
                {name}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{ opacity: fading ? 0 : 1, transition: "opacity 0.16s ease" }}
        >
          {rows.map(({ label, vals }, ri) => (
            <div
              key={label}
              className="grid border-b border-slate-800/20 last:border-0 group hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: "1fr 120px 108px 108px 108px" }}
            >
              <div className="px-5 py-3 flex items-center">
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">
                  {label}
                </span>
              </div>
              <div
                className="py-3 flex items-center justify-center"
                style={{
                  background: "rgba(59,130,246,0.04)",
                  borderLeft: "1px solid rgba(59,130,246,0.09)",
                  borderRight: "1px solid rgba(59,130,246,0.09)",
                }}
              >
                <span className="text-green-400 text-lg font-bold leading-none">
                  ✓
                </span>
              </div>
              {vals.slice(1).map((v, ci) => (
                <div
                  key={ci}
                  className="py-3 flex items-center justify-center border-l border-slate-800/20"
                >
                  <MatrixCell v={v} />
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          className="px-5 py-2.5 border-t border-slate-800/50 flex flex-wrap items-center gap-3 text-xs font-mono"
          style={{ background: "rgba(5,8,16,0.8)" }}
        >
          <span className="flex items-center gap-1 text-slate-700">
            <span className="text-green-400 font-bold">✓</span> Full
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500/70 border border-amber-500/20">
              Partial
            </span>
            <span className="text-slate-700">Limited</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-slate-700/40 text-gray-500 border border-slate-600/30">
              Paid
            </span>
            <span className="text-slate-700">Paid plan</span>
          </span>
          <span className="flex items-center gap-1 text-slate-700">
            <span className="text-slate-700">—</span> Not available
          </span>
          <span className="ml-auto text-slate-800">Public docs · 2025</span>
        </div>
      </div>
    </section>
  );
};

export const ReviewCard = ({ r }) => (
  <div
    className="flex-shrink-0 w-[252px] rounded-xl p-4 mx-2.5"
    style={{
      background: "rgba(10,14,26,0.95)",
      border: `1px solid ${r.kind === "pro" ? "rgba(51,65,85,0.32)" : r.border}`,
    }}
  >
    {r.kind === "pro" ? (
      <>
        <div className="flex gap-0.5 mb-2.5">
          {[...Array(r.stars)].map((_, i) => (
            <Star
              key={i}
              size={10}
              className="text-yellow-400 fill-yellow-400"
            />
          ))}
        </div>
        <p className="text-gray-400 text-[13px] leading-relaxed mb-3 line-clamp-3">
          &ldquo;{r.text}&rdquo;
        </p>
        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-800/50">
          <div
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${r.grad} flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0`}
          >
            {r.init}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-white leading-tight">
              {r.name}
            </div>
            <div className="text-[11px] text-gray-600">{r.role}</div>
          </div>
        </div>
      </>
    ) : (
      <>
        <div
          className="text-[12px] font-bold font-mono mb-2.5 tracking-wide"
          style={{ color: r.accent }}
        >
          {r.title}
        </div>
        <p className="text-gray-400 text-[13px] leading-relaxed line-clamp-4">
          &ldquo;{r.text}&rdquo;
        </p>
      </>
    )}
  </div>
);

export const ReviewsMarquee = () => {
  const row1 = [...REVIEW_CARDS, ...REVIEW_CARDS];

  return (
    <section id="testimonials" className="relative z-10 py-12">
      <div className="max-w-4xl mx-auto px-6 text-center mb-9">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-yellow-500/25 bg-yellow-500/10 mb-4">
          <Star size={11} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-yellow-300 font-semibold tracking-wide">
            Loved by Users
          </span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-2 leading-tight">
          <span className="text-white">What People </span>
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            Are Saying
          </span>
        </h2>
        <p className="text-gray-600 text-sm">
          Professionals and students building with Flasqo.
        </p>
      </div>

      <div
        style={{
          WebkitMaskImage:
            "linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%)",
          maskImage:
            "linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%)",
        }}
      >
        <div className="mrq-track overflow-hidden">
          <div
            className="mrq-inner flex"
            style={{
              animation: "mrq-left 34s linear infinite",
              width: "max-content",
            }}
          >
            {row1.map((r, i) => (
              <ReviewCard key={`r1-${i}`} r={r} />
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mrq-left { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        .mrq-track:hover .mrq-inner { animation-play-state: paused; }
      `}</style>
    </section>
  );
};

export const PipelineDiagram = () => (
  <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-8">
    <div className="text-center mb-12">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 mb-4">
        <Cpu size={12} className="text-blue-400" />
        <span className="text-xs text-blue-300 font-semibold tracking-wide">
          4-Stage Pipeline · 13 Test Modules
        </span>
      </div>
      <h2 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
        <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
          How Flasqo Works
        </span>
      </h2>
      <p className="text-gray-500 text-base max-w-lg mx-auto">
        One URL in — every test module fires automatically, AI analyzes, results
        delivered.
      </p>
    </div>

    <div className="flex items-start gap-0">
      {PIPELINE_STAGES.map((stage, si) => (
        <React.Fragment key={stage.id}>
          <div
            className="flex-1 min-w-0 rounded-xl overflow-hidden"
            style={{
              background: "rgba(9,13,24,0.97)",
              border: `1px solid ${stage.color}25`,
            }}
          >
            <div
              className="flex items-center gap-2.5 px-4 py-3.5"
              style={{
                background: stage.dim,
                borderBottom: `1px solid ${stage.color}20`,
              }}
            >
              <span
                className="text-sm font-black font-mono tracking-[0.25em] flex-shrink-0"
                style={{ color: stage.color }}
              >
                {stage.id}
              </span>
              <span className="text-sm font-bold font-mono text-white tracking-widest uppercase truncate">
                {stage.label}
              </span>
              <span
                className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                style={{
                  background: stage.color,
                  boxShadow: `0 0 6px ${stage.color}`,
                }}
              />
            </div>
            <div className="p-4">
              {stage.items && (
                <div className="space-y-3.5">
                  {stage.items.map((item, ii) => (
                    <div key={ii}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ background: stage.color }}
                        />
                        <span className="text-sm font-mono font-semibold text-gray-200 leading-tight">
                          {item.text}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-gray-500 pl-[17px]">
                        {item.sub}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {stage.modules && (
                <div className="grid grid-cols-2 gap-1.5">
                  {stage.modules.map((mod, mi) => (
                    <div
                      key={mi}
                      className="rounded px-2 py-1.5 text-center"
                      style={{
                        background: `${mod.c}10`,
                        border: `1px solid ${mod.c}28`,
                      }}
                    >
                      <span
                        className="text-[13px] font-mono font-bold leading-tight"
                        style={{ color: mod.c }}
                      >
                        {mod.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          {si < PIPELINE_STAGES.length - 1 && (
            <div
              className="flex-shrink-0 relative"
              style={{ width: "64px", height: "56px", alignSelf: "flex-start" }}
            >
              <div
                className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
                style={{
                  background: `linear-gradient(90deg,${stage.color}55,${PIPELINE_STAGES[si + 1].color}55)`,
                }}
              />
              <div
                className="absolute top-1/2 right-0 -translate-y-1/2"
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "5px solid transparent",
                  borderBottom: "5px solid transparent",
                  borderLeft: `8px solid ${PIPELINE_STAGES[si + 1].color}55`,
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: stage.color,
                  boxShadow: `0 0 6px ${stage.color}`,
                  animation: `pdot 2.2s linear ${si * 0.7}s infinite`,
                  willChange: "transform, opacity",
                }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>

    <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
      {[
        "Your API URL",
        "Auto-Scan",
        "12 Tests Fire",
        "AI Analysis",
        "Report Ready",
      ].map((label, i) => (
        <React.Fragment key={i}>
          <span
            className="px-3.5 py-1.5 rounded-md text-xs font-mono font-bold"
            style={{
              background: "rgba(15,23,42,0.8)",
              border: "1px solid rgba(51,65,85,0.4)",
              color: ["#3b82f6", "#8b5cf6", "#8b5cf6", "#06b6d4", "#10b981"][i],
            }}
          >
            {label}
          </span>
          {i < 4 && <span className="text-gray-700 text-xs font-mono">→</span>}
        </React.Fragment>
      ))}
    </div>

    <style>{`
      @keyframes pdot {
        0%   { transform: translateY(-50%) translateX(0px);   opacity: 0; }
        8%   { opacity: 1; }
        90%  { opacity: 1; }
        100% { transform: translateY(-50%) translateX(54px);  opacity: 0; }
      }
    `}</style>
  </section>
);

export const TypewriterSnippet = ({ text, delay = 0 }) => {
  const [displayed, setDisplayed] = useState("");
  const [blinking, setBlinking] = useState(false);
  const stateRef = useRef({ phase: "idle", i: 0 });

  useEffect(() => {
    let timer;
    const s = stateRef.current;

    const tick = () => {
      if (s.phase === "typing") {
        s.i += 1;
        setDisplayed(text.slice(0, s.i));
        if (s.i >= text.length) {
          setBlinking(true);
          timer = setTimeout(() => {
            setBlinking(false);
            s.phase = "erasing";
            timer = setTimeout(tick, 0);
          }, 2400);
        } else {
          timer = setTimeout(tick, 62);
        }
      } else if (s.phase === "erasing") {
        s.i -= 1;
        setDisplayed(text.slice(0, s.i));
        if (s.i <= 0) {
          timer = setTimeout(() => {
            s.phase = "typing";
            timer = setTimeout(tick, 0);
          }, 700);
        } else {
          timer = setTimeout(tick, 28);
        }
      }
    };

    timer = setTimeout(() => {
      s.phase = "typing";
      s.i = 0;
      tick();
    }, delay);
    return () => clearTimeout(timer);
  }, [delay, text]);

  return (
    <>
      {displayed}
      <span
        className="inline-block w-px h-[0.8em] bg-current align-middle ml-px"
        style={{
          animation: blinking ? "twCursor 0.65s step-end infinite" : "none",
        }}
      />
    </>
  );
};

export const FaqSection = () => (
  <section id="faq" className="relative z-10 max-w-5xl mx-auto px-6 py-8">
    <div className="text-center mb-5">
      <h2 className="text-3xl md:text-4xl font-bold mb-1 leading-tight">
        <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
          Frequently Asked{" "}
        </span>
        <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
          Questions
        </span>
      </h2>
      <p className="text-gray-500 text-sm">
        Everything developers ask before their first test run
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {FAQ_ITEMS.map((item) => (
        <details
          key={item.q}
          className="group rounded-xl border border-slate-700/50 bg-slate-900/60 backdrop-blur-sm px-4 py-3 open:border-blue-500/40 transition-colors"
        >
          <summary className="cursor-pointer list-none flex items-center justify-between gap-3 text-slate-200 font-semibold text-sm">
            {item.q}
            <span className="flex-shrink-0 text-blue-400 group-open:rotate-45 transition-transform text-lg leading-none">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm text-gray-400 leading-relaxed">
            {item.a}
            {item.link && (
              <>
                {" "}
                <a
                  href={item.link.href}
                  className="text-blue-400 hover:text-cyan-300 transition-colors"
                >
                  {item.link.label}
                </a>
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  </section>
);
