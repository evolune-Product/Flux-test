import { useState, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { GitFork, Loader, ArrowLeft, Calendar, User, Layers } from 'lucide-react';
import RequestNode from './components/nodes/RequestNode.jsx';

import { API_BASE_URL } from './lib/api.js';

// Module-level to prevent React Flow re-mounting
const nodeTypes = { requestNode: RequestNode };

function SharedFlowCanvas({ nodes, edges }) {
  const displayNodes = nodes.map((n) => ({
    ...n,
    data: { ...n.data, _result: null, _details: '' },
  }));

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={displayNodes}
        edges={edges.map((e) => ({
          ...e,
          animated: true,
          style: { stroke: '#6366f1', strokeWidth: 2 },
        }))}
        nodeTypes={nodeTypes}
        fitView
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={true}
        zoomOnScroll={true}
        defaultEdgeOptions={{ animated: true, style: { stroke: '#6366f1', strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} size={1} />
        <Controls />
        <MiniMap nodeColor={() => '#475569'} maskColor="rgba(15,23,42,0.8)" />
      </ReactFlow>
    </div>
  );
}

export default function SharedFlowApp({ token }) {
  const [flow, setFlow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isForking, setIsForking] = useState(false);
  const [forkDone, setForkDone] = useState(false);
  const [forkError, setForkError] = useState(null);

  const isLoggedIn = !!localStorage.getItem('token');

  useEffect(() => {
    fetch(`${API_BASE_URL}/flows/shared/${token}`)
      .then((r) => {
        if (!r.ok) throw new Error('not_found');
        return r.json();
      })
      .then((data) => { setFlow(data); setLoading(false); })
      .catch(() => { setError(true); setLoading(false); });
  }, [token]);

  const handleFork = async () => {
    if (!isLoggedIn) {
      window.location.href = '/';
      return;
    }
    setIsForking(true);
    setForkError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/flows/shared/${token}/fork`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!res.ok) throw new Error('Fork failed');
      const data = await res.json();
      // Redirect to flow-builder with the forked flow pre-loaded
      window.location.href = `/flow-builder?fork=${data.flow_id}`;
    } catch {
      setForkError('Fork failed. Please try again.');
      setIsForking(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader className="w-6 h-6 text-indigo-400 animate-spin" />
      </div>
    );
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-center px-4">
        <div>
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-white text-xl font-semibold mb-2">Flow not found</h1>
          <p className="text-slate-400 text-sm mb-6">This link may have expired or the flow was deleted.</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-sm font-medium transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Go to Flasqo
          </a>
        </div>
      </div>
    );
  }

  // ── Main view ──────────────────────────────────────────────────────────────
  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* ── Header ── */}
      <div className="shrink-0 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-sm px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          {/* Left — branding + flow info */}
          <div className="flex items-center gap-4 min-w-0">
            <a
              href="/"
              className="shrink-0 flex items-center gap-2 text-slate-400 hover:text-white transition-colors text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="font-semibold text-white">Flasqo</span>
            </a>
            <div className="w-px h-5 bg-slate-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="text-white font-semibold text-base truncate">{flow.name}</h1>
              {flow.description && (
                <p className="text-slate-400 text-xs truncate">{flow.description}</p>
              )}
            </div>
          </div>

          {/* Right — meta + fork */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" /> {flow.owner}
              </span>
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" /> {flow.node_count} node{flow.node_count !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(flow.updated_at).toLocaleDateString()}
              </span>
            </div>

            {forkDone ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-400 text-sm font-medium">
                Forked to your workspace!
              </div>
            ) : (
              <button
                onClick={handleFork}
                disabled={isForking}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-indigo-500/20"
              >
                {isForking ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <GitFork className="w-4 h-4" />
                )}
                {isLoggedIn ? 'Fork to my workspace' : 'Sign up to fork'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Fork error ── */}
      {forkError && (
        <div className="shrink-0 bg-red-500/10 border-b border-red-500/20 px-6 py-2 text-center text-red-400 text-sm">
          {forkError}
        </div>
      )}

      {/* ── Not logged in banner ── */}
      {!isLoggedIn && (
        <div className="shrink-0 bg-indigo-500/10 border-b border-indigo-500/20 px-6 py-3">
          <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
            <p className="text-indigo-300 text-sm">
              You're viewing a shared API flow. Sign up free to fork it into your own workspace and run it.
            </p>
            <a
              href="/"
              className="shrink-0 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white text-xs font-semibold transition-colors"
            >
              Get started free
            </a>
          </div>
        </div>
      )}

      {/* ── Canvas ── */}
      <div className="flex-1 relative" style={{ minHeight: 0 }}>
        {flow.nodes.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-center">
            <div>
              <div className="text-4xl mb-3">⬡</div>
              <p className="text-slate-500 text-sm">This flow has no nodes yet.</p>
            </div>
          </div>
        ) : (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ReactFlowProvider>
              <SharedFlowCanvas nodes={flow.nodes} edges={flow.edges} />
            </ReactFlowProvider>
          </div>
        )}
      </div>

      {/* React Flow dark theme overrides */}
      <style>{`
        .react-flow__background { background: #0f172a; }
        .react-flow__controls { background: #1e293b !important; border: 1px solid rgba(71,85,105,0.6) !important; border-radius: 10px !important; overflow: hidden; }
        .react-flow__controls-button { background: #1e293b !important; border-color: rgba(71,85,105,0.4) !important; color: #94a3b8 !important; fill: #94a3b8 !important; }
        .react-flow__controls-button:hover { background: #334155 !important; }
        .react-flow__minimap { background: #1e293b !important; border: 1px solid rgba(71,85,105,0.6) !important; border-radius: 10px !important; overflow: hidden; }
        .react-flow__attribution { display: none !important; }
      `}</style>
    </div>
  );
}
