import React, { useState, useEffect, useRef } from 'react';
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
  Eye
} from 'lucide-react';
import AuthModal from './AuthModal';
import Toast from './Toast';

const METHOD_STYLES = {
  GET:    { badge: 'bg-blue-500/20 text-blue-300 border-blue-500/40',   dot: 'bg-blue-400',   glow: 'shadow-blue-500/50'   },
  POST:   { badge: 'bg-green-500/20 text-green-300 border-green-500/40', dot: 'bg-green-400',  glow: 'shadow-green-500/50'  },
  DELETE: { badge: 'bg-red-500/20 text-red-300 border-red-500/40',      dot: 'bg-red-400',    glow: 'shadow-red-500/50'    },
  PATCH:  { badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', dot: 'bg-yellow-400', glow: 'shadow-yellow-500/50' },
  PUT:    { badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40', dot: 'bg-purple-400', glow: 'shadow-purple-500/50' },
};

const REQUEST_POOL = [
  { method: 'POST',   path: '/api/users/create',  status: 201, ms: 142, passed: true,  label: 'User Creation'   },
  { method: 'GET',    path: '/api/products',       status: 200, ms: 89,  passed: true,  label: 'Product List'    },
  { method: 'DELETE', path: '/api/orders/42',      status: 404, ms: 210, passed: false, label: 'Order Delete'    },
  { method: 'PATCH',  path: '/api/profile',        status: 200, ms: 95,  passed: true,  label: 'Profile Update'  },
  { method: 'PUT',    path: '/api/settings',       status: 200, ms: 77,  passed: true,  label: 'Config Set'      },
  { method: 'GET',    path: '/api/auth/verify',    status: 401, ms: 55,  passed: false, label: 'Auth Verify'     },
  { method: 'POST',   path: '/api/payments',       status: 201, ms: 320, passed: true,  label: 'Payment Init'    },
  { method: 'GET',    path: '/api/health',         status: 200, ms: 12,  passed: true,  label: 'Health Check'    },
  { method: 'DELETE', path: '/api/cache/flush',    status: 200, ms: 43,  passed: true,  label: 'Cache Flush'     },
  { method: 'PUT',    path: '/api/roles/admin',    status: 403, ms: 30,  passed: false, label: 'Role Update'     },
];


// ─── Flasqo Traffic Visualizer ───────────────────────────────────────────────

const FlasqoTrafficVisualizer = () => {
  const [liveLog, setLiveLog] = useState([]);
  const [processed, setProcessed] = useState(0);
  const [phase, setPhase] = useState(null); // null | 'sending' | 'intercepting' | 'result'
  const [currentReq, setCurrentReq] = useState(null);
  const [packetLeft, setPacketLeft] = useState(false);
  const [packetRight, setPacketRight] = useState(false);
  const [procSteps, setProcSteps] = useState([]);
  const idxRef = useRef(0);
  const timerRef = useRef(null);

  useEffect(() => {
    const PROC_LABELS = ['Schema Check', 'Auth Validate', 'Assertions', 'AI Review'];

    const runCycle = () => {
      const req = { ...REQUEST_POOL[idxRef.current % REQUEST_POOL.length], uid: Date.now() };
      idxRef.current++;
      setCurrentReq(req);
      setPhase('sending');
      setProcSteps([]);

      // Show request 500ms, then send left packet
      timerRef.current = setTimeout(() => {
        setPacketLeft(true);
        setTimeout(() => setPacketLeft(false), 680);

        // Flasqo intercepts 680ms later
        timerRef.current = setTimeout(() => {
          setPhase('intercepting');
          PROC_LABELS.forEach((_, i) => {
            timerRef.current = setTimeout(() => {
              setProcSteps(prev => [...prev, i]);
            }, i * 270);
          });

          // Fire right packet 1200ms later
          timerRef.current = setTimeout(() => {
            setPacketRight(true);
            setTimeout(() => setPacketRight(false), 680);

            // Show result 680ms later
            timerRef.current = setTimeout(() => {
              setPhase('result');
              setProcessed(n => n + 1);
              setLiveLog(prev =>
                [{ ...req, ts: new Date().toLocaleTimeString('en-US', { hour12: false }) }, ...prev].slice(0, 5)
              );

              // Reset then next cycle
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

  const passCount = liveLog.filter(l => l.passed).length;
  const failCount = liveLog.filter(l => !l.passed).length;

  const getAssertions = (req) => {
    if (!req) return [];
    return [
      { label: `status ${req.status}`, pass: req.passed },
      { label: 'response schema valid', pass: req.passed },
      { label: `${req.ms}ms latency`, pass: req.ms < 300 },
      ...(['POST', 'PUT', 'PATCH'].includes(req.method)
        ? [{ label: 'request body accepted', pass: true }]
        : [{ label: 'idempotent contract OK', pass: req.passed }]
      ),
    ];
  };

  const getBody = (method) => {
    const map = {
      POST:  '  "email": "dev@test.co",\n  "role": "developer"',
      PUT:   '  "theme": "dark",\n  "notify": true',
      PATCH: '  "status": "active"',
    };
    return map[method] || null;
  };

  const assertions = getAssertions(currentReq);
  const showingResult = phase === 'result';

  return (
    <section className="relative z-10 max-w-7xl mx-auto px-6 py-8">
      {/* Section heading */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-green-500/30 bg-green-500/10 mb-5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
          <span className="text-sm text-green-400 font-semibold tracking-wide">Live Intercept Engine</span>
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
          Flasqo sits as an intelligent middleware layer — capturing, analyzing, and
          validating every HTTP call in real time.
        </p>
      </div>

      {/* ── 3-column layout — FIXED HEIGHT to prevent any layout shift ── */}
      <div
        className="relative grid items-stretch gap-0"
        style={{ gridTemplateColumns: '1fr 56px 220px 56px 1fr', height: '390px' }}
      >

        {/* ── LEFT: Dev Terminal ── */}
        <div
          className="flex flex-col bg-[#0d1117] border border-slate-700/60 rounded-xl overflow-hidden"
          style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}
        >
          {/* Title bar */}
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-slate-800/80 bg-black/40 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[10px] text-gray-600 tracking-wider">~/dev  •  curl</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="text-[9px] text-orange-400/70 font-mono">OUTBOUND</span>
            </div>
          </div>

          {/* Code area — flex-1, overflow hidden, no resize */}
          <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 text-[11px]">
            {currentReq ? (
              <div key={currentReq.uid} style={{ animation: 'ftv-slideIn 0.22s ease-out' }}>
                <div className="text-gray-700 mb-1 font-mono">
                  $ curl -X{' '}
                  <span className={`font-bold ${METHOD_STYLES[currentReq.method]?.badge?.includes('blue') ? 'text-blue-400' : METHOD_STYLES[currentReq.method]?.badge?.includes('green') ? 'text-green-400' : METHOD_STYLES[currentReq.method]?.badge?.includes('red') ? 'text-red-400' : METHOD_STYLES[currentReq.method]?.badge?.includes('yellow') ? 'text-yellow-400' : 'text-purple-400'}`}>
                    {currentReq.method}
                  </span>{' '}
                  \
                </div>
                <div className="flex items-center gap-2 mb-2 pl-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border font-mono ${METHOD_STYLES[currentReq.method]?.badge}`}>
                    {currentReq.method}
                  </span>
                  <span className="text-cyan-400 font-mono truncate">{currentReq.path}</span>
                </div>
                <div className="pl-2 text-gray-700 font-mono text-[10px] mb-0.5">
                  -H <span className="text-green-400/60">'Content-Type: application/json'</span> \
                </div>
                <div className="pl-2 text-gray-700 font-mono text-[10px] mb-2">
                  -H <span className="text-green-400/60">'Authorization: Bearer <span className="text-gray-600">••••••</span>'</span> \
                </div>
                {getBody(currentReq.method) ? (
                  <div className="pl-2 font-mono text-[10px]">
                    <span className="text-gray-700">-d </span>
                    <span className="text-gray-600">{'{'}</span>
                    {getBody(currentReq.method).split('\n').map((line, i) => (
                      <div key={i} className="pl-4 text-green-400/70">{line}</div>
                    ))}
                    <span className="text-gray-600">{'}'}</span>
                  </div>
                ) : (
                  <div className="pl-2 text-gray-700 font-mono text-[10px]">--no-body</div>
                )}
                <div className="mt-3 flex items-center gap-1.5 text-[10px] font-mono">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${phase === 'sending' ? 'bg-yellow-400 animate-pulse' : 'bg-blue-500'}`} />
                  <span className={phase === 'sending' ? 'text-yellow-400/80' : 'text-blue-400/80'}>
                    {phase === 'sending' ? 'Sending request...' : 'Request dispatched'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-700 pt-2 font-mono text-[11px]">
                <span className="inline-block w-[7px] h-[13px] bg-gray-700 animate-pulse rounded-sm" />
                <span>Waiting for outbound calls...</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-3.5 py-1.5 border-t border-slate-800/60 flex items-center gap-2 bg-black/20">
            <Code size={9} className="text-gray-700" />
            <span className="text-[9px] text-gray-700 font-mono">dev environment</span>
            <span className="ml-auto text-[9px] text-gray-700 font-mono tabular-nums">{processed} fired</span>
          </div>
        </div>

        {/* ── LEFT WIRE ── */}
        <div className="relative flex items-center justify-center" style={{ overflow: 'visible' }}>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
            style={{ background: 'linear-gradient(90deg,rgba(99,102,241,0.15),rgba(59,130,246,0.5))' }} />
          {/* Arrow tip */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{ borderTop: '3px solid transparent', borderBottom: '3px solid transparent', borderLeft: '5px solid rgba(59,130,246,0.45)' }} />
          {/* Packet dot */}
          {packetLeft && currentReq && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${METHOD_STYLES[currentReq.method]?.dot}`}
              style={{ left: '0%', animation: 'ftv-packetFly 0.66s ease-in-out forwards', willChange: 'left, opacity' }}
            />
          )}
        </div>

        {/* ── CENTER: Flasqo Hub ── */}
        <div
          className="flex flex-col items-center justify-between bg-gradient-to-b from-blue-950/60 via-slate-900/70 to-blue-950/60 border border-blue-500/35 rounded-xl px-4 py-4 relative overflow-hidden"
          style={{ boxShadow: '0 0 32px rgba(59,130,246,0.09), inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(59,130,246,0.07) 0%, transparent 70%)' }} />

          {/* Logo & name */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0">
            <div className="relative">
              <div className="absolute inset-0 bg-blue-500/25 rounded-xl blur-lg" />
              <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                <Shield size={18} className="text-white" />
              </div>
            </div>
            <span className="text-[12px] font-bold text-white">Flasqo</span>
            <span className="text-[8px] text-blue-400/55 font-mono tracking-[0.2em]">MIDDLEWARE</span>
          </div>

          {/* Active request badge */}
          <div className="w-full flex-shrink-0" style={{ minHeight: '44px' }}>
            {currentReq ? (
              <div
                key={currentReq.uid + '-badge'}
                className={`w-full rounded-lg px-2 py-2 text-center border ${METHOD_STYLES[currentReq.method]?.badge}`}
                style={{ background: 'rgba(0,0,0,0.45)', animation: 'ftv-slideIn 0.18s ease-out' }}
              >
                <div className="text-[11px] font-bold font-mono">{currentReq.method}</div>
                <div className="text-[9px] text-gray-400 font-mono truncate">{currentReq.path}</div>
              </div>
            ) : (
              <div className="w-full rounded-lg px-2 py-2 text-center border border-slate-800/50 bg-black/20">
                <div className="text-[10px] text-gray-700 font-mono">Idle</div>
              </div>
            )}
          </div>

          {/* Processing pipeline steps */}
          <div className="w-full space-y-1.5 flex-shrink-0">
            {['Schema', 'Auth', 'Assert', 'AI'].map((step, i) => {
              const done = procSteps.includes(i);
              return (
                <div key={step} className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors duration-150 ${done ? 'bg-green-400' : 'bg-slate-700'}`} />
                  <span className={`text-[9px] font-mono transition-colors duration-150 ${done ? 'text-green-400' : 'text-gray-700'}`}>
                    {step}
                  </span>
                  {done && <span className="ml-auto text-[8px] text-green-500/60 font-mono">✓</span>}
                </div>
              );
            })}
          </div>

          {/* Mini counters */}
          <div className="w-full grid grid-cols-2 gap-1.5 flex-shrink-0">
            <div className="text-center rounded-lg bg-slate-800/50 border border-slate-700/30 py-1.5">
              <div className="text-[14px] font-bold text-white tabular-nums">{processed}</div>
              <div className="text-[8px] text-gray-700 uppercase tracking-wider font-mono">Seen</div>
            </div>
            <div className="text-center rounded-lg bg-green-900/25 border border-green-500/20 py-1.5">
              <div className="text-[14px] font-bold text-green-400 tabular-nums">{passCount}</div>
              <div className="text-[8px] text-gray-700 uppercase tracking-wider font-mono">Pass</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT WIRE ── */}
        <div className="relative flex items-center justify-center" style={{ overflow: 'visible' }}>
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px"
            style={{ background: 'linear-gradient(90deg,rgba(59,130,246,0.5),rgba(16,185,129,0.3))' }} />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-0 h-0"
            style={{ borderTop: '3px solid transparent', borderBottom: '3px solid transparent', borderLeft: '5px solid rgba(16,185,129,0.45)' }} />
          {packetRight && currentReq && (
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${METHOD_STYLES[currentReq.method]?.dot}`}
              style={{ left: '0%', animation: 'ftv-packetFly 0.66s ease-in-out forwards', willChange: 'left, opacity' }}
            />
          )}
        </div>

        {/* ── RIGHT: Test Output Terminal ── */}
        <div
          className="flex flex-col bg-[#0d1117] border border-slate-700/60 rounded-xl overflow-hidden"
          style={{ fontFamily: "'JetBrains Mono','Fira Code',monospace" }}
        >
          <div className="flex items-center gap-1.5 px-3.5 py-2.5 border-b border-slate-800/80 bg-black/40 flex-shrink-0">
            <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-[10px] text-gray-600 tracking-wider">flasqo/test-suite</span>
            <div className="ml-auto flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-400" />
              </span>
              <span className="text-[9px] text-green-400/70 font-mono">RUNNING</span>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden px-4 py-3 text-[11px]">
            {currentReq && (phase === 'intercepting' || phase === 'result') ? (
              <div key={currentReq.uid + '-result'} style={{ animation: 'ftv-slideIn 0.22s ease-out' }}>
                {/* Suite header line */}
                <div className="flex items-center gap-2 mb-2.5 font-mono text-[10px]">
                  <span className={`font-bold ${
                    phase === 'result'
                      ? currentReq.passed ? 'text-green-400' : 'text-red-400'
                      : 'text-yellow-400'
                  }`}>
                    {phase === 'result' ? (currentReq.passed ? 'PASS' : 'FAIL') : 'RUN '}
                  </span>
                  <span className="text-gray-500">
                    flasqo/{currentReq.label.toLowerCase().replace(/ /g, '-')}
                  </span>
                </div>

                {/* Assertion list */}
                <div className="space-y-1 mb-3">
                  {assertions.map((a, i) => {
                    const revealed = procSteps.includes(i) || phase === 'result';
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-2 font-mono text-[10px]"
                        style={{ opacity: revealed ? 1 : 0, transition: 'opacity 0.18s ease' }}
                      >
                        <span className={`font-bold flex-shrink-0 ${a.pass ? 'text-green-400' : 'text-red-400'}`}>
                          {a.pass ? '✓' : '✗'}
                        </span>
                        <span className={a.pass ? 'text-gray-400' : 'text-red-400/80'}>{a.label}</span>
                        {i === 0 && (
                          <span className="ml-auto text-gray-700 text-[9px]">{currentReq.ms}ms</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Summary */}
                {phase === 'result' && (
                  <div
                    className={`font-mono text-[10px] font-bold pt-2 border-t border-slate-800/50 ${currentReq.passed ? 'text-green-400' : 'text-red-400'}`}
                    style={{ animation: 'ftv-slideIn 0.14s ease-out' }}
                  >
                    {assertions.filter(a => a.pass).length} passed
                    {assertions.filter(a => !a.pass).length > 0 && (
                      <span className="text-red-400">, {assertions.filter(a => !a.pass).length} failed</span>
                    )}
                    <span className="text-gray-700 font-normal ml-2 text-[9px]">{currentReq.ms}ms</span>
                  </div>
                )}
              </div>
            ) : liveLog.length > 0 ? (
              <div className="space-y-0.5">
                {liveLog.map((log, i) => (
                  <div
                    key={log.uid}
                    className="flex items-center gap-2 text-[10px] py-1 border-b border-slate-800/25 last:border-0 font-mono"
                    style={{ opacity: i === 0 ? 1 : Math.max(0.25, 1 - i * 0.18), ...(i === 0 ? { animation: 'ftv-slideIn 0.22s ease-out' } : {}) }}
                  >
                    <span className={`font-bold flex-shrink-0 ${log.passed ? 'text-green-400' : 'text-red-400'}`}>{log.passed ? '✓' : '✗'}</span>
                    <span className={`text-[9px] font-bold border px-1 py-0.5 rounded flex-shrink-0 ${METHOD_STYLES[log.method]?.badge}`}>{log.method}</span>
                    <span className="text-gray-500 truncate flex-1">{log.label}</span>
                    <span className={`font-bold flex-shrink-0 ${log.passed ? 'text-green-400' : 'text-red-400'}`}>{log.status}</span>
                    <span className="text-gray-700 flex-shrink-0">{log.ms}ms</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-gray-700 pt-2 font-mono text-[11px]">
                <span className="inline-block w-[7px] h-[13px] bg-gray-700 animate-pulse rounded-sm" />
                <span>Awaiting first intercept...</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex-shrink-0 px-3.5 py-1.5 border-t border-slate-800/60 flex items-center gap-2 bg-black/20">
            <CheckCircle size={9} className="text-gray-700" />
            <span className="text-[9px] text-gray-700 font-mono">validated by flasqo</span>
            <span className="ml-auto font-mono text-[9px]">
              <span className="text-green-500/70">{passCount}↑</span>{' '}
              <span className="text-red-500/70">{failCount}↓</span>
            </span>
          </div>
        </div>
      </div>

      {/* Bottom metrics bar */}
      <div className="mt-5 grid grid-cols-4 gap-3">
        {[
          { label: 'Avg Latency',   value: '~118ms',                                                                              icon: Clock,      color: 'text-blue-400',   border: 'border-blue-500/20',   bg: 'bg-blue-500/5'   },
          { label: 'Pass Rate',     value: processed > 0 ? `${Math.round((passCount / Math.max(processed, 1)) * 100)}%` : '—',   icon: TrendingUp, color: 'text-green-400',  border: 'border-green-500/20',  bg: 'bg-green-500/5'  },
          { label: 'AI Assertions', value: `${processed * 4}`,                                                                    icon: Brain,      color: 'text-purple-400', border: 'border-purple-500/20', bg: 'bg-purple-500/5' },
          { label: 'Intercepted',   value: `${processed}`,                                                                        icon: Activity,   color: 'text-cyan-400',   border: 'border-cyan-500/20',   bg: 'bg-cyan-500/5'   },
        ].map(({ label, value, icon: Icon, color, border, bg }) => (
          <div key={label} className={`flex items-center gap-3 rounded-xl px-4 py-3 border ${border} ${bg}`}>
            <Icon size={15} className={color} />
            <div>
              <div className={`text-lg font-bold tabular-nums font-mono ${color}`}>{value}</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</div>
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


// ─── Comparison Matrix ───────────────────────────────────────────────────────

const MATRIX_GROUPS = [
  {
    tab: 'Testing',
    label: '01 · Testing Capabilities',
    rows: [
      { label: 'Auto-Discovery',        vals: ['check', 'dash',    'dash',    'dash'   ] },
      { label: 'Functional Testing',    vals: ['check', 'check',   'check',   'check'  ] },
      { label: 'Performance Testing',   vals: ['check', 'addon',   'check',   'dash'   ] },
      { label: 'Chaos & Fuzz',          vals: ['check', 'dash',    'partial', 'dash'   ] },
      { label: 'Regression Testing',    vals: ['check', 'partial', 'check',   'dash'   ] },
      { label: 'Contract Testing',      vals: ['check', 'partial', 'partial', 'partial'] },
      { label: 'GraphQL Testing',       vals: ['check', 'check',   'partial', 'check'  ] },
      { label: 'Flow Builder',          vals: ['check', 'partial', 'dash',    'dash'   ] },
    ],
  },
  {
    tab: 'AI',
    label: '02 · AI Features',
    rows: [
      { label: 'AI Test Generation',    vals: ['check', 'partial', 'partial', 'dash'   ] },
      { label: 'Natural Language Tests',vals: ['check', 'dash',    'dash',    'dash'   ] },
      { label: 'Root Cause Analysis',   vals: ['check', 'dash',    'partial', 'dash'   ] },
      { label: 'Vibe Testing',          vals: ['check', 'dash',    'dash',    'dash'   ] },
    ],
  },
  {
    tab: 'DX',
    label: '03 · Developer Experience',
    rows: [
      { label: 'Live Streaming (SSE)',  vals: ['check', 'dash',    'dash',    'dash'   ] },
      { label: 'PDF Reports',           vals: ['check', 'paid',    'check',   'dash'   ] },
      { label: 'GitHub Integration',    vals: ['check', 'check',   'check',   'check'  ] },
      { label: 'Team Collaboration',    vals: ['check', 'paid',    'paid',    'paid'   ] },
      { label: 'Free to Use',           vals: ['check', 'partial', 'dash',    'check'  ] },
    ],
  },
];

const MatrixCell = ({ v }) => {
  if (v === 'check')   return <span className="text-green-400 text-lg font-bold leading-none">✓</span>;
  if (v === 'dash')    return <span className="text-slate-700 text-base font-mono">—</span>;
  if (v === 'partial') return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-500/75 border border-amber-500/20 whitespace-nowrap">Partial</span>;
  if (v === 'paid')    return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-700/40 text-gray-500 border border-slate-600/30 whitespace-nowrap">Paid</span>;
  if (v === 'addon')   return <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-700/40 text-gray-500 border border-slate-600/30 whitespace-nowrap">Add-on</span>;
  return null;
};

const ComparisonMatrix = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [fading, setFading]       = useState(false);
  const pendingTab                = useRef(null);

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
    <section className="relative z-10 max-w-4xl mx-auto px-6 py-12">

      {/* Heading */}
      <div className="text-center mb-7">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 mb-4">
          <GitCompare size={12} className="text-blue-400" />
          <span className="text-xs text-blue-300 font-semibold tracking-wide">How We Stack Up</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-2 leading-tight">
          <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">Flasqo </span>
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">vs The Rest</span>
        </h2>
        <p className="text-gray-600 text-sm">13-module AI engine vs legacy API testing tools.</p>
        {/* Category preview pills — shows all tabs upfront */}
        <div className="flex items-center justify-center gap-2 mt-3">
          {[
            { label: 'Testing', count: 8, color: '#3b82f6', bg: 'rgba(59,130,246,0.10)', border: 'rgba(59,130,246,0.30)' },
            { label: 'AI Features', count: 4, color: '#a78bfa', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.30)' },
            { label: 'Dev Experience', count: 5, color: '#22d3ee', bg: 'rgba(34,211,238,0.10)', border: 'rgba(34,211,238,0.30)' },
          ].map((c, i) => (
            <span
              key={c.label}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold"
              style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
            >
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.color }} />
              {c.label}
              <span className="opacity-60">{c.count}</span>
            </span>
          ))}
          <span className="text-[11px] text-slate-600 font-mono ml-1">← click to switch</span>
        </div>
      </div>

      {/* Card */}
      <div
        className="rounded-xl border border-slate-700/40 overflow-hidden"
        style={{ background: 'rgba(9,13,24,0.98)' }}
      >
        {/* ── Sticky header: tabs + column names ── */}
        <div
          className="grid border-b border-slate-800/70"
          style={{ gridTemplateColumns: '1fr 120px 108px 108px 108px' }}
        >
          {/* Tab switcher */}
          {(() => {
            const TAB_COLORS = [
              { text: '#93c5fd', dimText: '#60a5fa99', bg: 'rgba(59,130,246,0.12)', activeBg: 'rgba(59,130,246,0.18)', border: 'rgba(59,130,246,0.45)', dimBorder: 'rgba(59,130,246,0.22)', dot: '#3b82f6' },
              { text: '#c4b5fd', dimText: '#a78bfa99', bg: 'rgba(167,139,250,0.12)', activeBg: 'rgba(167,139,250,0.18)', border: 'rgba(167,139,250,0.50)', dimBorder: 'rgba(167,139,250,0.22)', dot: '#a78bfa' },
              { text: '#67e8f9', dimText: '#22d3ee99', bg: 'rgba(34,211,238,0.12)', activeBg: 'rgba(34,211,238,0.18)', border: 'rgba(34,211,238,0.45)', dimBorder: 'rgba(34,211,238,0.22)', dot: '#22d3ee' },
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
                      className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold uppercase tracking-wider transition-all duration-200 cursor-pointer"
                      style={{
                        color: isActive ? c.text : c.dimText,
                        background: isActive ? c.activeBg : c.bg,
                        border: `1px solid ${isActive ? c.border : c.dimBorder}`,
                        boxShadow: isActive ? `0 0 10px ${c.dot}30` : 'none',
                        animation: isActive ? 'none' : `matrixTabPulse 2.8s ease-in-out ${i * 0.9}s infinite`,
                      }}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: isActive ? c.dot : `${c.dot}60` }}
                      />
                      {g.tab}
                      <span
                        className="text-[9px] px-1 py-px rounded font-mono leading-none"
                        style={{ background: isActive ? `${c.dot}25` : `${c.dot}12`, color: isActive ? c.text : c.dimText }}
                      >
                        {g.rows.length}
                      </span>
                    </button>
                  );
                })}
                <span className="ml-1 text-[9px] text-slate-700 font-mono hidden sm:flex items-center gap-1">
                  <span style={{ animation: 'matrixArrowBounce 1.4s ease-in-out infinite' }}>↔</span> explore
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

          {/* Flasqo col header */}
          <div
            className="flex flex-col items-center justify-center py-3.5 gap-1.5"
            style={{
              background: 'rgba(59,130,246,0.07)',
              borderLeft: '1px solid rgba(59,130,246,0.18)',
              borderRight: '1px solid rgba(59,130,246,0.18)',
            }}
          >
            <Shield size={13} className="text-blue-400" />
            <span className="text-[10px] font-bold text-white font-mono tracking-widest">FLASQO</span>
          </div>

          {/* Competitor col headers */}
          {['POSTMAN', 'KATALON', 'INSOMNIA'].map(name => (
            <div key={name} className="flex items-center justify-center py-3.5 border-l border-slate-800/40">
              <span className="text-[10px] font-mono font-semibold text-slate-600 uppercase tracking-widest">{name}</span>
            </div>
          ))}
        </div>

        {/* ── Rows (fade on tab switch) ── */}
        <div style={{ opacity: fading ? 0 : 1, transition: 'opacity 0.16s ease' }}>
          {rows.map(({ label, vals }, ri) => (
            <div
              key={label}
              className="grid border-b border-slate-800/20 last:border-0 group hover:bg-white/[0.02] transition-colors"
              style={{ gridTemplateColumns: '1fr 120px 108px 108px 108px' }}
            >
              {/* Label */}
              <div className="px-5 py-3 flex items-center">
                <span className="text-sm text-slate-400 group-hover:text-slate-300 transition-colors">{label}</span>
              </div>
              {/* Flasqo cell */}
              <div
                className="py-3 flex items-center justify-center"
                style={{
                  background: 'rgba(59,130,246,0.04)',
                  borderLeft: '1px solid rgba(59,130,246,0.09)',
                  borderRight: '1px solid rgba(59,130,246,0.09)',
                }}
              >
                <span className="text-green-400 text-lg font-bold leading-none">✓</span>
              </div>
              {/* Competitor cells */}
              {vals.slice(1).map((v, ci) => (
                <div key={ci} className="py-3 flex items-center justify-center border-l border-slate-800/20">
                  <MatrixCell v={v} />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── Legend ── */}
        <div
          className="px-5 py-2.5 border-t border-slate-800/50 flex flex-wrap items-center gap-3 text-xs font-mono"
          style={{ background: 'rgba(5,8,16,0.8)' }}
        >
          <span className="flex items-center gap-1 text-slate-700"><span className="text-green-400 font-bold">✓</span> Full</span>
          <span className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500/70 border border-amber-500/20">Partial</span>
            <span className="text-slate-700">Limited</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded bg-slate-700/40 text-gray-500 border border-slate-600/30">Paid</span>
            <span className="text-slate-700">Paid plan</span>
          </span>
          <span className="flex items-center gap-1 text-slate-700"><span className="text-slate-700">—</span> Not available</span>
          <span className="ml-auto text-slate-800">Public docs · 2025</span>
        </div>
      </div>
    </section>
  );
};


// ─── Reviews Marquee ──────────────────────────────────────────────────────────

const REVIEW_CARDS = [
  {
    kind: 'pro', name: 'Karthik', role: 'Tester', init: 'K',
    grad: 'from-blue-600 to-cyan-500', stars: 5,
    text: "A nice platform with 20+ AI features — makes manual work much easier in API testing.",
  },
  {
    kind: 'pro', name: 'Aman', role: 'Automation Architect', init: 'A',
    grad: 'from-cyan-600 to-blue-500', stars: 5,
    text: "8 testing types and 25+ AI features. Tested on 10 APIs with ~90% accuracy. Impressive!",
  },
  {
    kind: 'pro', name: 'Adarsh', role: 'Solution Architect', init: 'AD',
    grad: 'from-indigo-600 to-blue-500', stars: 5,
    text: "Unified with all testing types — exactly what the industry was missing.",
  },
  {
    kind: 'student', title: 'Exploring New Testing Types',
    accent: '#10b981', border: 'rgba(16,185,129,0.22)',
    text: "Amazing to see Fuzz, Chaos, and Contract testing all in one place. The platform makes it easy to understand and implement them. Great learning resource!",
  },
  {
    kind: 'student', title: 'AI-Powered Automation',
    accent: '#3b82f6', border: 'rgba(59,130,246,0.22)',
    text: "No more manually writing JSON test cases! The AI generates comprehensive tests automatically — saves hours of repetitive work.",
  },
  {
    kind: 'student', title: 'Perfect for Learning',
    accent: '#818cf8', border: 'rgba(129,140,248,0.22)',
    text: "Intuitive and doesn't need deep technical knowledge. I can experiment with different test types and see real results instantly.",
  },
  {
    kind: 'student', title: 'Reducing Manual Work',
    accent: '#22d3ee', border: 'rgba(34,211,238,0.22)',
    text: "With 25+ AI features the platform automates most tedious work. Test multiple APIs quickly and get detailed reports.",
  },
];

const ReviewCard = ({ r }) => (
  <div
    className="flex-shrink-0 w-[252px] rounded-xl p-4 mx-2.5"
    style={{
      background: 'rgba(10,14,26,0.95)',
      border: `1px solid ${r.kind === 'pro' ? 'rgba(51,65,85,0.32)' : r.border}`,
    }}
  >
    {r.kind === 'pro' ? (
      <>
        <div className="flex gap-0.5 mb-2.5">
          {[...Array(r.stars)].map((_, i) => (
            <Star key={i} size={10} className="text-yellow-400 fill-yellow-400" />
          ))}
        </div>
        <p className="text-gray-400 text-[11px] leading-relaxed mb-3 line-clamp-3">
          &ldquo;{r.text}&rdquo;
        </p>
        <div className="flex items-center gap-2 pt-2.5 border-t border-slate-800/50">
          <div
            className={`w-7 h-7 rounded-full bg-gradient-to-br ${r.grad} flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0`}
          >
            {r.init}
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white leading-tight">{r.name}</div>
            <div className="text-[9px] text-gray-600">{r.role}</div>
          </div>
        </div>
      </>
    ) : (
      <>
        <div className="text-[10px] font-bold font-mono mb-2.5 tracking-wide" style={{ color: r.accent }}>
          {r.title}
        </div>
        <p className="text-gray-400 text-[11px] leading-relaxed line-clamp-4">
          &ldquo;{r.text}&rdquo;
        </p>
      </>
    )}
  </div>
);

const ReviewsMarquee = () => {
  const row1 = [...REVIEW_CARDS, ...REVIEW_CARDS];
  const row2 = [
    ...REVIEW_CARDS.slice(3), ...REVIEW_CARDS.slice(0, 3),
    ...REVIEW_CARDS.slice(3), ...REVIEW_CARDS.slice(0, 3),
  ];

  return (
    <section id="testimonials" className="relative z-10 py-12">
      {/* Heading */}
      <div className="max-w-4xl mx-auto px-6 text-center mb-9">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-yellow-500/25 bg-yellow-500/10 mb-4">
          <Star size={11} className="text-yellow-400 fill-yellow-400" />
          <span className="text-xs text-yellow-300 font-semibold tracking-wide">Loved by Users</span>
        </div>
        <h2 className="text-3xl md:text-4xl font-bold mb-2 leading-tight">
          <span className="text-white">What People </span>
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">Are Saying</span>
        </h2>
        <p className="text-gray-600 text-sm">Professionals and students building with Flasqo.</p>
      </div>

      {/* Rows with edge-fade mask */}
      <div
        style={{
          WebkitMaskImage: 'linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%)',
          maskImage: 'linear-gradient(90deg,transparent 0%,black 8%,black 92%,transparent 100%)',
        }}
      >
        {/* Row 1 — left */}
        <div className="mrq-track overflow-hidden mb-3">
          <div className="mrq-inner flex" style={{ animation: 'mrq-left 34s linear infinite', width: 'max-content' }}>
            {row1.map((r, i) => <ReviewCard key={'r1-' + i} r={r} />)}
          </div>
        </div>

        {/* Row 2 — right */}
        <div className="mrq-track overflow-hidden">
          <div className="mrq-inner flex" style={{ animation: 'mrq-right 30s linear infinite', width: 'max-content' }}>
            {row2.map((r, i) => <ReviewCard key={'r2-' + i} r={r} />)}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes mrq-left  { from{transform:translateX(0)}    to{transform:translateX(-50%)} }
        @keyframes mrq-right { from{transform:translateX(-50%)} to{transform:translateX(0)}    }
        .mrq-track:hover .mrq-inner { animation-play-state: paused; }
      `}</style>
    </section>
  );
};


// ─── Pipeline Diagram ─────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  {
    id: '01', label: 'DISCOVER', color: '#3b82f6', dim: 'rgba(59,130,246,0.10)',
    items: [
      { text: 'API Endpoint',    sub: 'base URL or OpenAPI spec'     },
      { text: 'Auto-Discovery',  sub: 'zero-config endpoint scan'    },
      { text: 'Schema Detect',   sub: 'REST · GraphQL · gRPC'        },
      { text: 'Auth Extraction', sub: 'bearer · key · basic · OAuth' },
    ],
  },
  {
    id: '02', label: 'TEST SUITE', color: '#8b5cf6', dim: 'rgba(139,92,246,0.10)',
    modules: [
      { name: 'Functional',   c: '#3b82f6' }, { name: 'Smoke',        c: '#22c55e' },
      { name: 'Performance',  c: '#8b5cf6' }, { name: 'Chaos',        c: '#f97316' },
      { name: 'Fuzz',         c: '#ef4444' }, { name: 'Regression',   c: '#06b6d4' },
      { name: 'Contract',     c: '#6366f1' }, { name: 'GraphQL',      c: '#e879f9' },
      { name: 'Integration',  c: '#14b8a6' }, { name: 'FullSend',     c: '#ec4899' },
      { name: 'Flow Builder', c: '#f59e0b' }, { name: 'Vibe Testing', c: '#a855f7' },
    ],
  },
  {
    id: '03', label: 'AI ENGINE', color: '#06b6d4', dim: 'rgba(6,182,212,0.10)',
    items: [
      { text: 'Root Cause Analysis', sub: 'GPT-4 failure diagnosis'   },
      { text: 'Natural Language',    sub: 'describe → test cases'     },
      { text: 'Predictive AI',       sub: 'pattern-based forecasting' },
      { text: 'Auto Assertions',     sub: 'AI-generated validations'  },
    ],
  },
  {
    id: '04', label: 'DELIVER', color: '#10b981', dim: 'rgba(16,185,129,0.10)',
    items: [
      { text: 'Live Streaming', sub: 'SSE real-time feed'   },
      { text: 'PDF Reports',    sub: 'stakeholder-ready'    },
      { text: 'GitHub Push',    sub: 'native repo commits'  },
      { text: 'Team Workspace', sub: 'share · collaborate'  },
    ],
  },
];

const PipelineDiagram = () => (
  <section id="features" className="relative z-10 max-w-7xl mx-auto px-6 py-8">

    {/* Header */}
    <div className="text-center mb-12">
      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 mb-4">
        <Cpu size={12} className="text-blue-400" />
        <span className="text-xs text-blue-300 font-semibold tracking-wide">4-Stage Pipeline · 13 Test Modules</span>
      </div>
      <h2 className="text-4xl md:text-5xl font-bold mb-3 leading-tight">
        <span className="bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent">
          How Flasqo Works
        </span>
      </h2>
      <p className="text-gray-500 text-base max-w-lg mx-auto">
        One URL in — every test module fires automatically, AI analyzes, results delivered.
      </p>
    </div>

    {/* Pipeline row */}
    <div className="flex items-start gap-0">
      {PIPELINE_STAGES.map((stage, si) => (
        <React.Fragment key={stage.id}>

          {/* Stage card */}
          <div
            className="flex-1 min-w-0 rounded-xl overflow-hidden"
            style={{ background: 'rgba(9,13,24,0.97)', border: `1px solid ${stage.color}25` }}
          >
            {/* Header bar */}
            <div
              className="flex items-center gap-2.5 px-4 py-3.5"
              style={{ background: stage.dim, borderBottom: `1px solid ${stage.color}20` }}
            >
              <span className="text-sm font-black font-mono tracking-[0.25em] flex-shrink-0" style={{ color: stage.color }}>
                {stage.id}
              </span>
              <span className="text-sm font-bold font-mono text-white tracking-widest uppercase truncate">
                {stage.label}
              </span>
              <span className="ml-auto w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: stage.color, boxShadow: `0 0 6px ${stage.color}` }} />
            </div>

            {/* Body */}
            <div className="p-4">
              {stage.items && (
                <div className="space-y-3.5">
                  {stage.items.map((item, ii) => (
                    <div key={ii}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                        <span className="text-sm font-mono font-semibold text-gray-200 leading-tight">{item.text}</span>
                      </div>
                      <div className="text-xs font-mono text-gray-500 pl-[17px]">{item.sub}</div>
                    </div>
                  ))}
                </div>
              )}
              {stage.modules && (
                <div className="grid grid-cols-2 gap-1.5">
                  {stage.modules.map((mod, mi) => (
                    <div key={mi} className="rounded px-2 py-1.5 text-center"
                      style={{ background: `${mod.c}10`, border: `1px solid ${mod.c}28` }}>
                      <span className="text-[11px] font-mono font-bold leading-tight" style={{ color: mod.c }}>
                        {mod.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Connector arrow */}
          {si < PIPELINE_STAGES.length - 1 && (
            <div className="flex-shrink-0 relative" style={{ width: '64px', height: '56px', alignSelf: 'flex-start' }}>
              <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2"
                style={{ background: `linear-gradient(90deg,${stage.color}55,${PIPELINE_STAGES[si+1].color}55)` }} />
              <div className="absolute top-1/2 right-0 -translate-y-1/2"
                style={{ width:0, height:0,
                  borderTop:'5px solid transparent', borderBottom:'5px solid transparent',
                  borderLeft:`8px solid ${PIPELINE_STAGES[si+1].color}55` }} />
              <div className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
                style={{
                  background: stage.color,
                  boxShadow: `0 0 6px ${stage.color}`,
                  animation: `pdot 2.2s linear ${si * 0.7}s infinite`,
                  willChange: 'transform, opacity',
                }} />
            </div>
          )}

        </React.Fragment>
      ))}
    </div>

    {/* Flow summary strip */}
    <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
      {['Your API URL', 'Auto-Scan', '12 Tests Fire', 'AI Analysis', 'Report Ready'].map((label, i) => (
        <React.Fragment key={i}>
          <span className="px-3.5 py-1.5 rounded-md text-xs font-mono font-bold"
            style={{
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(51,65,85,0.4)',
              color: ['#3b82f6','#8b5cf6','#8b5cf6','#06b6d4','#10b981'][i],
            }}>
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

// ─── TypewriterSnippet ────────────────────────────────────────────────────────

const TypewriterSnippet = ({ text, delay = 0 }) => {
  const [displayed, setDisplayed] = useState('');
  const [blinking, setBlinking] = useState(false);
  const stateRef = useRef({ phase: 'idle', i: 0 });

  useEffect(() => {
    let timer;
    const s = stateRef.current;

    const tick = () => {
      if (s.phase === 'typing') {
        s.i++;
        setDisplayed(text.slice(0, s.i));
        if (s.i >= text.length) {
          setBlinking(true);
          timer = setTimeout(() => {
            setBlinking(false);
            s.phase = 'erasing';
            timer = setTimeout(tick, 0);
          }, 2400);
        } else {
          timer = setTimeout(tick, 62);
        }
      } else if (s.phase === 'erasing') {
        s.i--;
        setDisplayed(text.slice(0, s.i));
        if (s.i <= 0) {
          timer = setTimeout(() => { s.phase = 'typing'; timer = setTimeout(tick, 0); }, 700);
        } else {
          timer = setTimeout(tick, 28);
        }
      }
    };

    timer = setTimeout(() => { s.phase = 'typing'; s.i = 0; tick(); }, delay);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {displayed}
      <span
        className="inline-block w-px h-[0.8em] bg-current align-middle ml-px"
        style={{ animation: blinking ? 'twCursor 0.65s step-end infinite' : 'none' }}
      />
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const LandingPage = ({ onLoginSuccess, authError }) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [toast, setToast] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Dynamic Island nav state
  const [navExpanded, setNavExpanded] = useState(false);
  const navTimerRef = useRef(null);
  const handleNavEnter = () => { clearTimeout(navTimerRef.current); setNavExpanded(true); };
  const handleNavLeave = () => { navTimerRef.current = setTimeout(() => setNavExpanded(false), 10000); };

  // Show error toast if OAuth failed
  useEffect(() => {
    if (authError) {
      setToast({
        message: authError,
        type: 'error'
      });
    }
  }, [authError]);
  const [stats, setStats] = useState({
    users: 0,
    testsRun: 0,
    apisSecured: 0,
    uptime: 0
  });

  // Animate stats counting up
  useEffect(() => {
    const targetStats = {
      users: 15,
      testsRun: 1000,
      apisSecured: 10,
      uptime: 99.9
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
        uptime: (targetStats.uptime * progress).toFixed(1)
      });

      if (currentStep >= steps) {
        clearInterval(timer);
        setStats(targetStats);
      }
    }, interval);

    return () => clearInterval(timer);
  }, []);



  const differentiators = [
    {
      title: 'Zero-Config Setup',
      description: 'Just paste your API URL - auto-discovery finds all endpoints, detects auth, and generates tests automatically',
      icon: Search,
      gradient: 'from-emerald-500 to-teal-600'
    },
    {
      title: '90% Less Manual Work',
      description: 'AI generates comprehensive test suites in seconds - what took hours now takes minutes',
      icon: Brain,
      gradient: 'from-blue-500 to-cyan-600'
    },
    {
      title: 'Live Progress Streaming',
      description: 'Watch every request and response in real-time with SSE streaming - no more waiting blindly',
      icon: Eye,
      gradient: 'from-cyan-500 to-blue-600'
    },
    {
      title: 'Enterprise Security',
      description: 'Google & GitHub OAuth, JWT sessions, encrypted storage - your tests and data are protected',
      icon: Shield,
      gradient: 'from-blue-500 to-indigo-600'
    },
    {
      title: 'Built-in Collaboration',
      description: 'Create teams, invite members, share test suites - perfect for agile development teams',
      icon: Users,
      gradient: 'from-orange-500 to-red-600'
    },
    {
      title: 'Stakeholder-Ready Reports',
      description: 'Export professional PDF reports with charts and metrics - impress clients and managers',
      icon: FileText,
      gradient: 'from-green-500 to-emerald-600'
    }
  ];


  const handleGetStarted = (mode = 'signup') => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const handleLoginSuccess = (userData) => {
    // Close the modal
    setShowAuthModal(false);

    // Show success toast
    setToast({
      message: `🎉 Welcome back, ${userData.username}! Redirecting to your dashboard...`,
      type: 'success'
    });

    // Add fade out effect to landing page
    setIsTransitioning(true);

    // Wait for toast to be visible, then redirect
    setTimeout(() => {
      onLoginSuccess(userData);
    }, 2000);
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 text-white overflow-hidden transition-opacity duration-500 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-blue-600/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse delay-500"></div>
      </div>

      {/* ── Dynamic Island Navigation ── */}
      <nav
        className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4"
        onMouseEnter={handleNavEnter}
        onMouseLeave={handleNavLeave}
      >
        {/* Outer glow — only when expanded */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[680px] h-[72px] bg-blue-600/12 blur-3xl rounded-full pointer-events-none transition-opacity duration-500"
          style={{ opacity: navExpanded ? 1 : 0 }}
        />

        {/* Island wrapper — morphs from small pill to full bar */}
        <div
          className="relative transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ maxWidth: navExpanded ? '1024px' : '218px', width: '100%' }}
        >
          {/* Animated gradient border — only when expanded */}
          <div
            className="absolute -inset-[1px] rounded-full transition-opacity duration-300"
            style={{
              background: 'linear-gradient(90deg,rgba(59,130,246,0.55),rgba(6,182,212,0.5),rgba(99,102,241,0.45),rgba(59,130,246,0.55))',
              backgroundSize: '300% 100%',
              animation: 'navBorderShift 4s linear infinite',
              opacity: navExpanded ? 0.75 : 0.3,
            }}
          />

          {/* Glass island pill */}
          <div
            className="relative bg-slate-950/80 backdrop-blur-2xl shadow-2xl shadow-black/50 overflow-hidden"
            style={{
              borderRadius: navExpanded ? '20px' : '9999px',
              padding: navExpanded ? '7px 20px' : '7px 18px',
              transition: 'border-radius 0.45s ease, padding 0.4s ease, box-shadow 0.4s ease',
              boxShadow: navExpanded
                ? '0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.05)'
                : '0 4px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <div className="flex items-center justify-between gap-4">

              {/* ── Logo (always visible) ── */}
              <div className="flex items-center gap-2 flex-shrink-0 cursor-pointer group" onClick={handleNavEnter}>
                {/* Icon */}
                <div className="relative">
                  {/* Orbital ring — only expanded */}
                  {navExpanded && (
                    <div
                      className="absolute -inset-[7px] rounded-full border border-blue-500/25"
                      style={{ animation: 'logoOrbit 8s linear infinite' }}>
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full" />
                    </div>
                  )}
                  <div
                    className="flex items-center justify-center bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-xl overflow-hidden transition-all duration-500 group-hover:scale-105"
                    style={{
                      width: navExpanded ? '40px' : '32px',
                      height: navExpanded ? '40px' : '32px',
                      boxShadow: '0 0 12px rgba(59,130,246,0.5)',
                      transition: 'width 0.4s ease, height 0.4s ease',
                    }}
                  >
                    <Shield size={navExpanded ? 20 : 16} className="text-white" />
                  </div>
                </div>

                {/* Text */}
                <div>
                  <div
                    className="font-bold bg-gradient-to-r from-blue-300 via-cyan-300 to-blue-200 bg-clip-text text-transparent leading-none transition-all duration-400"
                    style={{
                      fontSize: navExpanded ? '18px' : '14px',
                      backgroundSize: '200% 200%',
                      animation: 'navGradientShift 4s ease-in-out infinite',
                    }}>
                    Flasqo
                  </div>
                  {/* Subtitle — only expanded */}
                  <div
                    className="text-[10px] text-gray-500 flex items-center gap-1 overflow-hidden transition-all duration-300"
                    style={{
                      maxHeight: navExpanded ? '16px' : '0px',
                      opacity: navExpanded ? 1 : 0,
                      marginTop: navExpanded ? '1px' : '0',
                    }}>
                    by EvoluneEdgeTech
                    <span className="inline-block w-1 h-1 bg-green-400 rounded-full flex-shrink-0" style={{ animation: 'navPulse 2s ease-in-out infinite' }} />
                  </div>
                </div>

                {/* Idle live dot (shown only when NOT expanded) */}
                {!navExpanded && (
                  <span className="relative flex h-1.5 w-1.5 ml-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                )}
              </div>

              {/* ── Nav links — collapse to 0 when shrunk ── */}
              <div
                className="hidden md:flex items-center gap-1 flex-shrink-0 overflow-hidden"
                style={{
                  maxWidth: navExpanded ? '500px' : '0px',
                  opacity: navExpanded ? 1 : 0,
                  transition: 'max-width 0.45s ease, opacity 0.25s ease',
                  transitionDelay: navExpanded ? '0.1s' : '0s',
                }}>
                {[
                  { href: '#features',     label: 'Features'     },
                  { href: '#why-us',       label: 'Why Us'       },
                  { href: '#testimonials', label: 'Testimonials' },
                  { href: '#pricing',      label: 'Pricing'      },
                ].map(item => (
                  <a key={item.href} href={item.href}
                    className="relative px-3.5 py-1.5 rounded-full text-gray-400 hover:text-white text-sm font-medium whitespace-nowrap transition-colors duration-200 hover:bg-white/5">
                    {item.label}
                  </a>
                ))}
              </div>

              {/* ── Action buttons — collapse when shrunk ── */}
              <div
                className="flex items-center gap-2 flex-shrink-0 overflow-hidden"
                style={{
                  maxWidth: navExpanded ? '280px' : '0px',
                  opacity: navExpanded ? 1 : 0,
                  transition: 'max-width 0.45s ease, opacity 0.25s ease',
                  transitionDelay: navExpanded ? '0.15s' : '0s',
                }}>
                {/* Login */}
                <button
                  onClick={() => handleGetStarted('login')}
                  className="whitespace-nowrap px-4 py-1.5 rounded-full text-sm font-medium text-white border border-white/15 hover:border-white/35 hover:bg-white/8 transition-all duration-200">
                  Login
                </button>
                {/* Get Started */}
                <button
                  onClick={() => handleGetStarted('signup')}
                  className="group relative whitespace-nowrap px-5 py-1.5 rounded-full text-sm font-semibold text-white overflow-hidden hover:scale-105 transition-transform duration-200"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #0891b2)', boxShadow: '0 0 14px rgba(37,99,235,0.45)' }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-600" />
                  <span className="relative flex items-center gap-1.5">
                    Get Started
                    <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>
              </div>

            </div>
          </div>
        </div>

        <style>{`
          @keyframes navBorderShift {
            0%   { background-position: 0% 50%;   }
            100% { background-position: 300% 50%; }
          }
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
            50%      { opacity: 0.5; transform: scale(1.5); }
          }
        `}</style>
      </nav>

      {/* Hero Section - Creative Design */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-28 pb-6 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {/* Floating geometric shapes */}
          <div className="absolute top-20 left-[10%] w-24 h-24 border border-blue-500/20 rounded-2xl rotate-12" style={{ animation: 'heroFloat1 8s ease-in-out infinite' }} />
          <div className="absolute top-40 right-[15%] w-16 h-16 border border-blue-500/20 rounded-full" style={{ animation: 'heroFloat2 6s ease-in-out infinite' }} />
          <div className="absolute bottom-40 left-[20%] w-12 h-12 bg-gradient-to-r from-blue-500/10 to-cyan-500/10 rounded-xl rotate-45" style={{ animation: 'heroFloat3 7s ease-in-out infinite' }} />
          <div className="absolute top-1/3 right-[8%] w-20 h-20 border border-cyan-500/10 rounded-full" style={{ animation: 'heroFloat1 9s ease-in-out infinite reverse' }} />

          {/* Floating code snippets — typewriter */}
          <div className="hidden md:block absolute top-32 left-[5%] min-w-[148px] text-xs font-mono text-blue-400/65 bg-blue-500/5 px-3 py-1.5 rounded-lg border border-blue-500/20" style={{ animation: 'heroFloat2 10s ease-in-out infinite' }}>
            <TypewriterSnippet text='{ "status": 200 }' delay={400} />
          </div>
          <div className="hidden md:block absolute bottom-48 right-[5%] min-w-[164px] text-xs font-mono text-cyan-400/65 bg-cyan-500/5 px-3 py-1.5 rounded-lg border border-cyan-500/20" style={{ animation: 'heroFloat3 8s ease-in-out infinite' }}>
            <TypewriterSnippet text='POST /api/test → 201' delay={1400} />
          </div>
          <div className="hidden md:block absolute top-1/2 left-[3%] min-w-[158px] text-xs font-mono text-green-400/65 bg-green-500/5 px-3 py-1.5 rounded-lg border border-green-500/20" style={{ animation: 'heroFloat1 12s ease-in-out infinite' }}>
            <TypewriterSnippet text='✓ 4/4 assertions pass' delay={2600} />
          </div>

          {/* Animated dot grid */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.45) 1px, transparent 1px)',
              backgroundSize: '28px 28px',
              animation: 'gridPulse 6s ease-in-out infinite',
            }}
          />
          {/* Residual ambient glow */}
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-blue-700/8 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* ── Left hero panel: Live Test Runner ── */}
        <div
          className="hidden xl:block absolute left-0 top-[130px] w-[200px] pointer-events-none"
          style={{ animation: 'heroFloat2 9s ease-in-out infinite' }}
        >
          <div className="rounded-xl overflow-hidden border border-slate-700/50 text-[10px] font-mono" style={{ background: 'rgba(9,13,24,0.92)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center gap-1.5 px-3 py-2 border-b border-slate-800/60 bg-black/30">
              <div className="w-2 h-2 rounded-full bg-[#ff5f57]" />
              <div className="w-2 h-2 rounded-full bg-[#febc2e]" />
              <div className="w-2 h-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[9px] text-slate-600 tracking-wider">test-runner</span>
              <span className="ml-auto flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[8px] text-green-500/60">LIVE</span>
              </span>
            </div>
            <div className="px-3 py-2.5 space-y-2">
              {[
                { pass: true,  method: 'GET',   path: '/health',  ms: '5ms',  mc: '#3b82f6' },
                { pass: true,  method: 'POST',  path: '/users',   ms: '89ms', mc: '#22c55e' },
                { pass: false, method: 'DEL',   path: '/orders',  ms: '404',  mc: '#ef4444' },
                { pass: true,  method: 'PATCH', path: '/profile', ms: '44ms', mc: '#eab308' },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span style={{ color: t.pass ? '#22c55e' : '#ef4444', fontSize: 10 }}>{t.pass ? '✓' : '✗'}</span>
                  <span className="px-1 py-px rounded text-[8px] font-bold flex-shrink-0" style={{ background: `${t.mc}18`, color: t.mc, border: `1px solid ${t.mc}35` }}>{t.method}</span>
                  <span className="text-slate-500 flex-1 truncate">{t.path}</span>
                  <span className="flex-shrink-0" style={{ color: t.pass ? '#4b5563' : '#ef4444' }}>{t.ms}</span>
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
          style={{ animation: 'heroFloat3 10s ease-in-out infinite' }}
        >
          <div className="rounded-xl overflow-hidden border border-green-500/20 text-[10px] font-mono" style={{ background: 'rgba(9,13,24,0.92)', backdropFilter: 'blur(10px)' }}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/60 bg-black/30">
              <div className="flex items-center gap-1.5">
                <Rocket size={10} className="text-green-400" />
                <span className="text-[9px] text-green-400 font-bold tracking-wider">DEPLOY GATE</span>
              </div>
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'pulseGlow 1.6s ease-in-out infinite' }} />
                <span className="text-[8px] text-green-400/70">READY</span>
              </span>
            </div>
            <div className="px-3 py-2.5 space-y-2.5">
              {[
                { label: 'API Coverage',  val: 94, color: '#3b82f6' },
                { label: 'Pass Rate',     val: 87, color: '#22c55e' },
                { label: 'Avg Latency',   val: 74, display: '~92ms', color: '#a78bfa' },
              ].map((m) => (
                <div key={m.label}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-500">{m.label}</span>
                    <span style={{ color: m.color }}>{m.display ?? `${m.val}%`}</span>
                  </div>
                  <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <div className="h-full rounded-full" style={{ width: `${m.val}%`, background: m.color, opacity: 0.65 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="px-3 py-1.5 border-t flex items-center gap-1.5" style={{ borderColor: 'rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.05)' }}>
              <CheckCircle size={9} className="text-green-400" />
              <span className="text-green-400/80">Cleared for deploy</span>
            </div>
          </div>
        </div>

        <div className="relative text-center">
          {/* Badge with animated border */}
          <div className="relative inline-flex items-center gap-2 px-5 py-2.5 mb-8">
            <div className="absolute inset-0 rounded-full" style={{
              background: 'linear-gradient(90deg, #3b82f6, #06b6d4, #6366f1, #3b82f6)',
              backgroundSize: '300% 100%',
              animation: 'gradientBorder 3s linear infinite',
              padding: '1px'
            }}>
              <div className="absolute inset-[1px] bg-slate-950 rounded-full" />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-cyan-500 to-indigo-500 opacity-20 blur-md" style={{ animation: 'pulseGlow 2s ease-in-out infinite' }} />
            <Sparkles size={16} className="relative text-cyan-400" style={{ animation: 'sparkleRotate 3s ease-in-out infinite' }} />
            <span className="relative text-sm font-semibold bg-gradient-to-r from-blue-300 via-cyan-300 to-indigo-300 bg-clip-text text-transparent">AI-Powered API Testing Platform</span>
            <span className="relative flex h-2 w-2 ml-1">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
          </div>

          {/* Main heading with animation */}
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            <span
              className="inline-block bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent"
              style={{ animation: 'titleSlideIn 0.8s ease-out' }}
            >
              Test Smarter,
            </span>
            <br />
            <span
              className="inline-block bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent"
              style={{ animation: 'titleSlideIn 0.8s ease-out 0.2s both' }}
            >
              Ship Faster
            </span>
            {/* Animated underline */}
            <div className="mt-2 mx-auto w-32 h-1 bg-gradient-to-r from-blue-500 via-cyan-500 to-blue-400 rounded-full" style={{ animation: 'underlineExpand 1s ease-out 0.5s both' }} />
          </h1>

          {/* Tagline */}
          <div className="flex items-center justify-center gap-3 mb-5" style={{ animation: 'fadeInUp 0.8s ease-out 0.35s both' }}>
            <div className="h-px w-10 bg-gradient-to-r from-transparent to-blue-500/50 rounded-full" />
            <span className="text-sm font-semibold tracking-wide bg-gradient-to-r from-blue-300/90 via-cyan-300/90 to-blue-200/90 bg-clip-text text-transparent">
              Stop shipping guesses — deploy with certainty
            </span>
            <div className="h-px w-10 bg-gradient-to-l from-transparent to-cyan-500/50 rounded-full" />
          </div>

          <p className="text-base text-gray-400 mb-10 max-w-xl mx-auto leading-relaxed" style={{ animation: 'fadeInUp 0.8s ease-out 0.4s both' }}>
            Not just API testing — total deployment confidence. AI validates every request,
            catches every regression, and gives your pipeline the green signal it needs
            to ship clean, every time.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-4 mb-12" style={{ animation: 'fadeInUp 0.8s ease-out 0.6s both' }}>
            <button
              onClick={() => handleGetStarted('signup')}
              className="group relative px-8 py-4 rounded-full font-bold text-lg overflow-hidden transition-all transform hover:scale-105"
            >
              {/* Button gradient background */}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500" style={{ backgroundSize: '200% 200%', animation: 'gradientBorder 3s linear infinite' }} />
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <span className="relative flex items-center gap-2 text-white">
                <Zap size={20} />
                Start Testing Now
                <ArrowRight className="group-hover:translate-x-1 transition-transform" size={20} />
              </span>
            </button>
            <button
              onClick={() => document.getElementById('demo-video').scrollIntoView({ behavior: 'smooth' })}
              className="group px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 text-white rounded-full font-bold text-lg hover:bg-white/10 hover:border-white/40 transition-all flex items-center gap-2"
            >
              <Play size={20} className="group-hover:scale-110 transition-transform" />
              Watch Demo
            </button>
          </div>

          {/* Trust badges — terminal row */}
          <div
            className="inline-flex items-center font-mono text-xs mb-8 rounded-lg border border-slate-700/60 bg-slate-900/70 backdrop-blur-sm overflow-hidden divide-x divide-slate-700/60"
            style={{ animation: 'fadeInUp 0.8s ease-out 0.8s both' }}
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
              { value: stats.users.toLocaleString(), suffix: '+', label: 'Active Users',  gradient: 'from-blue-400 to-cyan-400',    glow: '#22d3ee', Icon: Users,    bars: [3,5,4,6,5,7,6] },
              { value: stats.testsRun.toLocaleString(), suffix: '+', label: 'Tests Run',  gradient: 'from-indigo-400 to-blue-400',  glow: '#818cf8', Icon: Activity, bars: [4,7,5,8,6,9,8] },
              { value: stats.apisSecured.toLocaleString(), suffix: '+', label: 'APIs Secured', gradient: 'from-green-400 to-emerald-400', glow: '#22c55e', Icon: Lock, bars: [5,4,6,5,7,6,8] },
              { value: stats.uptime, suffix: '%', label: 'Uptime',                        gradient: 'from-orange-400 to-red-400',   glow: '#f97316', Icon: Zap,      bars: [8,9,8,9,9,8,9] },
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="group relative"
                style={{ animation: `floatCard 4s ease-in-out ${index * 0.3}s infinite` }}
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
                      backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
                      backgroundSize: '14px 14px',
                    }}
                  />

                  {/* Scan line — sweeps top → bottom on hover */}
                  <div
                    className="absolute left-0 right-0 h-px opacity-0 group-hover:opacity-100 pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${stat.glow} 50%, transparent 100%)`,
                      animation: 'scanLine 2.6s ease-in-out infinite',
                      animationDelay: `${index * 0.45}s`,
                    }}
                  />

                  {/* Animated shine */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 pointer-events-none" />

                  {/* Lucide icon badge — top right */}
                  <div
                    className="absolute top-3 right-3 w-7 h-7 rounded-md flex items-center justify-center opacity-35 group-hover:opacity-80 transition-all duration-300"
                    style={{ background: `${stat.glow}18`, border: `1px solid ${stat.glow}35` }}
                  >
                    <stat.Icon size={13} style={{ color: stat.glow }} />
                  </div>

                  {/* Content */}
                  <div className="relative pr-8">
                    <div className={`text-4xl font-bold bg-gradient-to-r ${stat.gradient} bg-clip-text text-transparent mb-0.5 group-hover:scale-105 transition-transform origin-left font-mono tabular-nums`}>
                      {stat.value}{stat.suffix}
                    </div>
                    <div className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors font-mono tracking-wide uppercase">{stat.label}</div>
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
                          transformOrigin: 'bottom',
                        }}
                      />
                    ))}
                  </div>

                  {/* Bottom gradient line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r ${stat.gradient} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left`} />
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
      <PipelineDiagram />

      {/* Why Choose Us - Creative Hexagon Design */}
      <section id="why-us" className="relative z-10 max-w-6xl mx-auto px-6 py-10 overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] border border-blue-500/10 rounded-full" style={{ animation: 'spin 30s linear infinite' }} />
        </div>

        {/* Header */}
        <div className="relative text-center mb-8">
          <h2 className="text-4xl md:text-5xl font-bold mb-3">
            <span className="text-white">Why Choose </span>
            <span className="bg-gradient-to-r from-green-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent">Flasqo?</span>
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
                className={`group relative ${isMiddle ? 'md:translate-y-8' : ''}`}
                style={{ animation: `fadeSlideUp 0.5s ease-out ${index * 0.1}s both` }}
              >
                {/* Card */}
                <div className="relative bg-slate-900/60 backdrop-blur-xl rounded-2xl p-5 border border-white/10 group-hover:border-white/30 transition-all duration-300 group-hover:scale-105 overflow-hidden">
                  {/* Glow on hover */}
                  <div className={`absolute -inset-1 bg-gradient-to-r ${item.gradient} rounded-2xl opacity-0 group-hover:opacity-20 blur-xl transition-all duration-500`} />

                  {/* Top accent line */}
                  <div className={`absolute top-0 left-4 right-4 h-0.5 bg-gradient-to-r ${item.gradient} rounded-full transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500`} />

                  {/* Content */}
                  <div className="relative">
                    {/* Icon orb */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="relative">
                        <div className={`absolute inset-0 bg-gradient-to-r ${item.gradient} rounded-xl blur-md opacity-40 group-hover:opacity-60 transition-opacity`} />
                        <div className={`relative w-11 h-11 bg-gradient-to-br ${item.gradient} rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                          <Icon size={22} className="text-white" />
                        </div>
                      </div>
                      <h3 className={`text-sm font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                        {item.title}
                      </h3>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  </div>

                  {/* Corner decoration */}
                  <div className={`absolute bottom-2 right-2 w-8 h-8 border-r border-b ${item.gradient.includes('green') ? 'border-green-500/20' : 'border-blue-500/20'} rounded-br-xl opacity-0 group-hover:opacity-100 transition-opacity`} />
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
      <ReviewsMarquee />

      {/* CTA Section - Creative Design */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        <div
          className="relative overflow-hidden rounded-2xl"
          style={{
            background: 'rgba(5,8,18,0.88)',
            border: '1px solid rgba(59,130,246,0.16)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 0 80px rgba(59,130,246,0.05), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          {/* Dot grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(59,130,246,0.35) 1px, transparent 1px)',
              backgroundSize: '26px 26px',
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
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.22)' }}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ animation: 'ctaBadgePulse 1.8s ease-in-out infinite' }} />
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
                  style={{ borderLeft: '2px solid rgba(59,130,246,0.45)' }}
                >
                  "APIs don't fail on demo day.<br />
                  They fail the night before."
                </p>

                {/* CTAs */}
                <div className="flex flex-wrap gap-3 mb-5">
                  <button
                    onClick={() => handleGetStarted('signup')}
                    className="group relative px-7 py-3 rounded-full font-bold text-sm overflow-hidden transition-all transform hover:scale-105"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                    <span className="relative flex items-center gap-2 text-white">
                      <Zap size={15} />
                      Start Free Trial
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                  <button
                    onClick={() => handleGetStarted('login')}
                    className="px-7 py-3 rounded-full font-bold text-sm text-slate-300 hover:text-white transition-all"
                    style={{ border: '1px solid rgba(255,255,255,0.12)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'}
                  >
                    Login to Continue
                  </button>
                </div>

                {/* Trust micro-line */}
                <div className="flex items-center gap-4 text-[11px] text-slate-600 font-mono">
                  <span><span className="text-green-500/60">✓</span> No credit card</span>
                  <span><span className="text-green-500/60">✓</span> Free forever</span>
                  <span><span className="text-green-500/60">✓</span> Cancel anytime</span>
                </div>
              </div>

              {/* ── RIGHT: pre-deploy check terminal ── */}
              <div>
                <div
                  className="rounded-xl overflow-hidden font-mono text-[11px]"
                  style={{ background: 'rgba(4,7,15,0.80)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  {/* Title bar */}
                  <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800/50 bg-black/25">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
                    <div className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
                    <span className="ml-3 text-slate-600 text-[10px] tracking-wider">flasqo / pre-deploy-check</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-[9px] text-green-400/70">ALL PASSING</span>
                    </span>
                  </div>

                  {/* Check rows */}
                  <div className="px-4 py-4 space-y-2.5">
                    {[
                      { label: 'functional tests',  result: '24 / 24 passed',  color: '#22c55e' },
                      { label: 'schema validation',  result: 'no drift',        color: '#22c55e' },
                      { label: 'performance gates',  result: 'p95 < 200ms',    color: '#3b82f6' },
                      { label: 'chaos simulation',   result: '0 cascades',     color: '#a78bfa' },
                      { label: 'auth contracts',     result: 'all verified',   color: '#22d3ee' },
                    ].map((row, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-slate-500">
                          <span style={{ color: '#22c55e' }}>✓ </span>
                          {row.label}
                        </span>
                        <span style={{ color: row.color }}>{row.result}</span>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div
                    className="px-4 py-2.5 border-t flex items-center justify-between"
                    style={{ borderColor: 'rgba(34,197,94,0.12)', background: 'rgba(34,197,94,0.05)' }}
                  >
                    <span className="font-bold text-green-400">● ALL CHECKS PASSED</span>
                    <span className="text-slate-600 text-[10px]">deploy unblocked ↗</span>
                  </div>
                </div>

                {/* Stat strip */}
                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  {[
                    { val: '94%', sub: 'avg coverage',     color: '#3b82f6' },
                    { val: '< 2s', sub: 'time to results', color: '#22d3ee' },
                    { val: '∞',   sub: 'free tests',       color: '#a78bfa' },
                  ].map((s) => (
                    <div
                      key={s.sub}
                      className="text-center rounded-lg py-2.5"
                      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}
                    >
                      <div className="text-lg font-bold font-mono tabular-nums" style={{ color: s.color }}>{s.val}</div>
                      <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5 font-mono">{s.sub}</div>
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
      <footer className="relative z-10 mt-8">
        {/* Top aurora border */}
        <div className="h-px bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-40" />

        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-xl flex items-center justify-center shadow-lg"
                style={{ animation: 'logoFloat 4s ease-in-out infinite' }}
              >
                <Zap size={22} className="text-white" />
              </div>
              <div>
                <div className="text-lg font-bold bg-gradient-to-r from-white to-blue-200 bg-clip-text text-transparent">Flasqo</div>
                <a
                  href="https://www.evolune.in/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-blue-400 hover:text-cyan-300 transition-colors"
                >
                  by EvoluneEdgeTech
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a href="#features" className="hover:text-white transition-colors">Features</a>
              <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
              <a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>
              <a href="mailto:contact@evolune.in" className="hover:text-white transition-colors">Contact</a>
            </div>

            {/* Social Icons */}
            <div className="flex items-center gap-2">
              {[
                { icon: Github, href: 'https://github.com/EvoluneEdgeTech', gradient: 'from-gray-600 to-gray-700' },
                { icon: Twitter, href: 'https://x.com/EvoluneEdgeTech', gradient: 'from-blue-400 to-blue-600' },
                { icon: Linkedin, href: 'https://www.linkedin.com/in/evolune-edgetech-546640389/', gradient: 'from-blue-600 to-blue-800' },
                { icon: Mail, href: 'mailto:contact@evolune.in', gradient: 'from-blue-500 to-cyan-600' }
              ].map((social, i) => (
                <a
                  key={i}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative w-9 h-9 rounded-full flex items-center justify-center overflow-hidden"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${social.gradient} opacity-0 group-hover:opacity-100 transition-opacity`} />
                  <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors" />
                  <social.icon size={16} className="relative z-10 text-gray-400 group-hover:text-white transition-colors" />
                </a>
              ))}
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-6 pt-4 border-t border-white/5 text-center">
            <p className="text-xs text-gray-500">
              © 2026 Flasqo. All rights reserved. Built with ❤️ for developers.
            </p>
          </div>
        </div>

        <style>{`
          @keyframes logoFloat {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
        `}</style>
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