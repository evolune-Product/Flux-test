import { useState, useCallback, useRef, useEffect } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  useReactFlow,
  BackgroundVariant,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ArrowLeft, Play, Plus, Loader, Trash2, Save, FolderOpen, X, Check, Link, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RequestNode from './components/nodes/RequestNode.jsx';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

// Must be module-level to prevent React Flow re-mounting on re-render
const nodeTypes = { requestNode: RequestNode };

let nodeIdCounter = 1;
function generateNodeId() {
  return `node-${Date.now()}-${nodeIdCounter++}`;
}

// ── Inner component (needs useReactFlow) ──────────────────────────────────────
function VisualBuilderInner({ user, onLogout }) {
  const navigate = useNavigate();
  const { screenToFlowPosition } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [authConfig, setAuthConfig] = useState({ type: 'none', token: '' });
  const [isRunning, setIsRunning] = useState(false);
  const [flowResults, setFlowResults] = useState(null);
  const [activeTab, setActiveTab] = useState('inspector');

  // Flow save / load state
  const [currentFlowId, setCurrentFlowId] = useState(null);
  const [currentFlowName, setCurrentFlowName] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [saveFlowName, setSaveFlowName] = useState('');
  const [saveFlowDesc, setSaveFlowDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showFlowsModal, setShowFlowsModal] = useState(false);
  const [savedFlows, setSavedFlows] = useState([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Share state
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [isSharing, setIsSharing] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [customSlugInput, setCustomSlugInput] = useState('');
  const [slugError, setSlugError] = useState('');

  const reactFlowWrapper = useRef(null);

  // ── Auto-load forked flow on mount ────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const forkId = params.get('fork');
    if (!forkId) return;
    // Clean the URL immediately
    window.history.replaceState({}, document.title, '/flow-builder');
    const token = localStorage.getItem('token');
    fetch(`${API_BASE_URL}/flows/${forkId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setBaseUrl(data.base_url || '');
        setAuthConfig(data.auth_config || { type: 'none' });
        const restored = (data.nodes || []).map((n) => ({
          ...n,
          data: { ...n.data, _result: null, _details: '' },
        }));
        setNodes(restored);
        setEdges(data.edges || []);
        setCurrentFlowId(data.flow_id);
        setCurrentFlowName(data.name);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connections ────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#6366f1' } }, eds)),
    [setEdges]
  );

  // ── Node selection ─────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
    setActiveTab('inspector');
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // ── Drag-from-palette onto canvas ──────────────────────────────────────────
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow-nodetype');
      if (!type) return;

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });

      const newNode = {
        id: generateNodeId(),
        type: 'requestNode',
        position,
        data: {
          label: 'New Request',
          method: 'GET',
          endpoint: '',
          description: '',
          expected_status: 200,
          body: null,
          params: null,
          headers: {},
          extractions: [],
          _result: null,
          _details: '',
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setSelectedNodeId(newNode.id);
      setActiveTab('inspector');
    },
    [screenToFlowPosition, setNodes]
  );

  // ── Selected node helpers ──────────────────────────────────────────────────
  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const updateNodeData = useCallback(
    (field, value) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === selectedNodeId ? { ...n, data: { ...n.data, [field]: value } } : n
        )
      );
    },
    [selectedNodeId, setNodes]
  );

  const deleteSelectedNode = useCallback(() => {
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId)
    );
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  // ── Extraction rows ────────────────────────────────────────────────────────
  const addExtraction = useCallback(() => {
    const current = selectedNode?.data?.extractions || [];
    updateNodeData('extractions', [...current, { name: '', jsonpath: '' }]);
  }, [selectedNode, updateNodeData]);

  const updateExtraction = useCallback(
    (index, field, value) => {
      const current = [...(selectedNode?.data?.extractions || [])];
      current[index] = { ...current[index], [field]: value };
      updateNodeData('extractions', current);
    },
    [selectedNode, updateNodeData]
  );

  const removeExtraction = useCallback(
    (index) => {
      const current = [...(selectedNode?.data?.extractions || [])];
      current.splice(index, 1);
      updateNodeData('extractions', current);
    },
    [selectedNode, updateNodeData]
  );

  // ── Run Flow ───────────────────────────────────────────────────────────────
  const runFlow = useCallback(async () => {
    if (!baseUrl.trim()) {
      alert('Please enter a Base URL before running the flow.');
      return;
    }
    if (nodes.length === 0) {
      alert('Add at least one request node to the canvas.');
      return;
    }

    setIsRunning(true);
    setFlowResults(null);

    // Mark all nodes as RUNNING
    setNodes((nds) =>
      nds.map((n) => ({ ...n, data: { ...n.data, _result: 'RUNNING', _details: '' } }))
    );

    // Strip runtime fields before sending to backend
    const serializedNodes = nodes.map((n) => ({
      id: n.id,
      data: {
        label: n.data.label,
        method: n.data.method,
        endpoint: n.data.endpoint,
        description: n.data.description,
        expected_status: n.data.expected_status,
        body: n.data.body,
        params: n.data.params,
        headers: n.data.headers,
        extractions: n.data.extractions,
      },
    }));

    const serializedEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    }));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/run-flow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          base_url: baseUrl.trim(),
          auth_config: authConfig,
          timeout: 10,
          nodes: serializedNodes,
          edges: serializedEdges,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Flow execution failed');
      }

      // Map node_id → result
      const resultMap = {};
      for (const r of data.results || []) {
        resultMap[r.node_id] = r;
      }

      // Update nodes with per-node results
      setNodes((nds) =>
        nds.map((n) => {
          const r = resultMap[n.id];
          if (!r) return { ...n, data: { ...n.data, _result: null, _details: '' } };
          return {
            ...n,
            data: {
              ...n.data,
              _result: r.status,
              _details: r.details || '',
            },
          };
        })
      );

      setFlowResults(data);
      setActiveTab('results');

      // Save to history (non-blocking)
      try {
        await fetch(`${API_BASE_URL}/test-runs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            module: 'flow-builder',
            api_url: baseUrl.trim(),
            total_tests: data.summary?.total || 0,
            passed: data.summary?.passed || 0,
            failed: data.summary?.failed || 0,
            overall_status: (data.summary?.failed || 0) === 0 ? 'PASS' : 'FAIL',
            result_json: data,
          }),
        });
      } catch {
        // History save is non-critical
      }
    } catch (err) {
      alert(`Flow execution error: ${err.message}`);
      setNodes((nds) =>
        nds.map((n) => ({ ...n, data: { ...n.data, _result: null, _details: '' } }))
      );
    } finally {
      setIsRunning(false);
    }
  }, [baseUrl, authConfig, nodes, edges, setNodes]);

  // ── Highlight node from results panel ─────────────────────────────────────
  const highlightNode = useCallback(
    (nodeId) => {
      setSelectedNodeId(nodeId);
      setActiveTab('inspector');
    },
    []
  );

  // ── Flow Save / Load ───────────────────────────────────────────────────────
  const openSaveModal = useCallback(() => {
    setSaveFlowName(currentFlowName || '');
    setSaveFlowDesc('');
    setSaveSuccess(false);
    setShowSaveModal(true);
  }, [currentFlowName]);

  const handleSaveFlow = useCallback(async () => {
    if (!saveFlowName.trim()) { alert('Enter a name for this flow.'); return; }
    setIsSaving(true);
    setSaveSuccess(false);
    const token = localStorage.getItem('token');
    const cleanNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        label: n.data.label,
        method: n.data.method,
        endpoint: n.data.endpoint,
        description: n.data.description,
        expected_status: n.data.expected_status,
        body: n.data.body,
        params: n.data.params,
        headers: n.data.headers,
        extractions: n.data.extractions,
      },
    }));
    const cleanEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target }));
    const payload = {
      name: saveFlowName.trim(),
      description: saveFlowDesc.trim() || null,
      base_url: baseUrl,
      auth_config: authConfig,
      nodes: cleanNodes,
      edges: cleanEdges,
    };
    try {
      if (currentFlowId) {
        await fetch(`${API_BASE_URL}/flows/${currentFlowId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        const res = await fetch(`${API_BASE_URL}/flows`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        setCurrentFlowId(data.flow_id);
      }
      setCurrentFlowName(saveFlowName.trim());
      setSaveSuccess(true);
      setTimeout(() => { setShowSaveModal(false); setSaveSuccess(false); }, 800);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  }, [saveFlowName, saveFlowDesc, currentFlowId, nodes, edges, baseUrl, authConfig]);

  const openFlowsModal = useCallback(async () => {
    setShowFlowsModal(true);
    setIsLoadingFlows(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/flows`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setSavedFlows(data.flows || []);
    } catch {
      setSavedFlows([]);
    } finally {
      setIsLoadingFlows(false);
    }
  }, []);

  const loadFlow = useCallback(async (flowId) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/flows/${flowId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to load flow');
      const data = await res.json();
      setBaseUrl(data.base_url || '');
      setAuthConfig(data.auth_config || { type: 'none' });
      // Restore runtime fields
      const restored = (data.nodes || []).map((n) => ({
        ...n,
        data: { ...n.data, _result: null, _details: '' },
      }));
      setNodes(restored);
      setEdges(data.edges || []);
      setCurrentFlowId(data.flow_id);
      setCurrentFlowName(data.name);
      setFlowResults(null);
      setSelectedNodeId(null);
      setShowFlowsModal(false);
    } catch (err) {
      alert(`Load failed: ${err.message}`);
    }
  }, [setNodes, setEdges]);

  const handleDeleteFlow = useCallback(async (flowId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this flow? This cannot be undone.')) return;
    const token = localStorage.getItem('token');
    await fetch(`${API_BASE_URL}/flows/${flowId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    setSavedFlows((fs) => fs.filter((f) => f.flow_id !== flowId));
    if (currentFlowId === flowId) {
      setCurrentFlowId(null);
      setCurrentFlowName('');
    }
  }, [currentFlowId]);

  const handleShare = useCallback(() => {
    if (!currentFlowId) {
      alert('Save the flow first before sharing.');
      return;
    }
    // Pre-fill slug from flow name
    const autoSlug = currentFlowName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60);
    setCustomSlugInput(autoSlug);
    setShareLink('');
    setShareCopied(false);
    setSlugError('');
    setShowShareModal(true);
  }, [currentFlowId, currentFlowName]);

  const handleGenerateLink = useCallback(async () => {
    setIsSharing(true);
    setSlugError('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/flows/${currentFlowId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ custom_slug: customSlugInput.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSlugError(data.detail || 'Failed to generate link.');
        return;
      }
      const slug = data.custom_slug || data.share_token;
      setShareLink(`${window.location.origin}/flow/${slug}`);
    } catch {
      setSlugError('Failed to generate link. Try again.');
    } finally {
      setIsSharing(false);
    }
  }, [currentFlowId, customSlugInput]);

  const copyShareLink = useCallback(() => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setShareCopied(true);
    setTimeout(() => setShareCopied(false), 2000);
  }, [shareLink]);

  const showBodyField =
    selectedNode &&
    ['POST', 'PUT', 'PATCH'].includes(selectedNode.data.method);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-white overflow-hidden">
      {/* ── TOOLBAR ── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 backdrop-blur-sm shrink-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="w-px h-5 bg-slate-600" />

        {/* Flow name + save/load controls */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={openFlowsModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 border border-slate-600/60 hover:border-blue-500/60 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all"
            title="Open saved flow"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Flows
          </button>
          <button
            onClick={openSaveModal}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 border border-slate-600/60 hover:border-indigo-500/60 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all"
            title="Save current flow"
          >
            <Save className="w-3.5 h-3.5" />
            Save
          </button>
          {currentFlowId && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700/60 border border-slate-600/60 hover:border-purple-500/60 hover:bg-slate-700 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-all"
              title="Share this flow"
            >
              <Link className="w-3.5 h-3.5" />
              Share
            </button>
          )}
          {currentFlowName && (
            <span className="text-xs text-indigo-400 font-medium truncate max-w-[120px]" title={currentFlowName}>
              {currentFlowName}
            </span>
          )}
        </div>

        <div className="w-px h-5 bg-slate-600" />

        <div className="flex items-center gap-2 flex-1">
          <span className="text-slate-400 text-sm shrink-0">Base URL</span>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com"
            className="flex-1 max-w-sm bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:bg-slate-700"
          />
        </div>

        <button
          onClick={runFlow}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-1.5 bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-all shadow-lg shadow-teal-500/20"
        >
          {isRunning ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              Running…
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Flow
            </>
          )}
        </button>
      </div>

      {/* ── 3-PANEL BODY ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT — Palette */}
        <div className="w-44 shrink-0 bg-slate-800/60 border-r border-slate-700/60 flex flex-col gap-3 p-3 overflow-y-auto">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Nodes</p>

          <div
            draggable
            onDragStart={(e) =>
              e.dataTransfer.setData('application/reactflow-nodetype', 'requestNode')
            }
            className="flex flex-col gap-1 p-3 bg-slate-700/60 border border-slate-600/60 rounded-lg cursor-grab active:cursor-grabbing hover:border-blue-500/60 hover:bg-slate-700 transition-all select-none"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-white">Request</span>
            </div>
            <p className="text-xs text-slate-500">HTTP API call</p>
          </div>

          <div className="mt-4 text-xs text-slate-600 leading-relaxed">
            Drag node onto canvas, then connect nodes to chain requests.
          </div>

          {/* ── Auth Config ── */}
          <div className="mt-4 border-t border-slate-700/60 pt-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Auth</p>

            {/* Type buttons */}
            {[
              { val: 'none', label: 'None' },
              { val: 'bearer', label: 'Bearer' },
              { val: 'basic', label: 'Basic' },
              { val: 'api_key', label: 'API Key' },
            ].map(({ val, label }) => (
              <button
                key={val}
                onClick={() => setAuthConfig({ type: val, token: '', username: '', password: '', header_name: '', api_key: '' })}
                className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  authConfig.type === val
                    ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40'
                    : 'bg-slate-700/40 text-slate-400 border border-slate-700/40 hover:text-white hover:bg-slate-700/60'
                }`}
              >
                {label}
              </button>
            ))}

            {/* Bearer token input */}
            {authConfig.type === 'bearer' && (
              <input
                type="text"
                value={authConfig.token || ''}
                onChange={(e) => setAuthConfig({ ...authConfig, token: e.target.value })}
                placeholder="Paste token…"
                className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 mt-1"
              />
            )}

            {/* Basic auth inputs */}
            {authConfig.type === 'basic' && (
              <div className="flex flex-col gap-1.5 mt-1">
                <input
                  type="text"
                  value={authConfig.username || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, username: e.target.value })}
                  placeholder="Username"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                />
                <input
                  type="password"
                  value={authConfig.password || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, password: e.target.value })}
                  placeholder="Password"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                />
              </div>
            )}

            {/* API Key inputs */}
            {authConfig.type === 'api_key' && (
              <div className="flex flex-col gap-1.5 mt-1">
                <input
                  type="text"
                  value={authConfig.header_name || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, header_name: e.target.value })}
                  placeholder="Header (e.g. X-API-Key)"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                />
                <input
                  type="text"
                  value={authConfig.api_key || ''}
                  onChange={(e) => setAuthConfig({ ...authConfig, api_key: e.target.value })}
                  placeholder="API key value"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-2 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60"
                />
              </div>
            )}
          </div>
        </div>

        {/* CENTER — Canvas */}
        <div
          className="flex-1 relative"
          ref={reactFlowWrapper}
          onDrop={onDrop}
          onDragOver={onDragOver}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={nodeTypes}
            fitView
            className="flow-dark"
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
            }}
            connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2 }}
          >
            <Background variant={BackgroundVariant.Dots} color="#334155" gap={20} size={1} />
            <Controls className="flow-controls" />
            <MiniMap
              nodeColor={() => '#475569'}
              maskColor="rgba(15, 23, 42, 0.8)"
              className="flow-minimap"
            />

            {/* Empty state */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <div className="text-4xl mb-3">⬡</div>
                  <p className="text-slate-500 text-sm">Drag a Request node from the left panel</p>
                  <p className="text-slate-600 text-xs mt-1">Connect nodes to chain API calls</p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>

        {/* RIGHT — Inspector / Results */}
        <div className="w-80 shrink-0 bg-slate-800/60 border-l border-slate-700/60 flex flex-col overflow-hidden">
          {/* Tab bar */}
          <div className="flex border-b border-slate-700/60 shrink-0">
            <button
              onClick={() => setActiveTab('inspector')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === 'inspector'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-slate-800/80'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Inspector
            </button>
            <button
              onClick={() => setActiveTab('results')}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === 'results'
                  ? 'text-teal-400 border-b-2 border-teal-400 bg-slate-800/80'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Results
              {flowResults && (
                <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${
                  flowResults.summary?.failed === 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {flowResults.summary?.passed}/{flowResults.summary?.total}
                </span>
              )}
            </button>
          </div>

          {/* Inspector tab */}
          {activeTab === 'inspector' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {!selectedNode ? (
                <div className="flex-1 flex items-center justify-center text-center py-12">
                  <div>
                    <div className="text-3xl mb-3">🖱️</div>
                    <p className="text-slate-500 text-sm">Click a node to inspect and configure it</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Label */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Label
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.label}
                      onChange={(e) => updateNodeData('label', e.target.value)}
                      className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/60"
                    />
                  </div>

                  {/* Method */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Method
                    </label>
                    <select
                      value={selectedNode.data.method}
                      onChange={(e) => updateNodeData('method', e.target.value)}
                      className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/60"
                    >
                      {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  {/* Endpoint */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Endpoint
                    </label>
                    <input
                      type="text"
                      value={selectedNode.data.endpoint}
                      onChange={(e) => updateNodeData('endpoint', e.target.value)}
                      placeholder="/api/path  (use {{varName}})"
                      className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 font-mono"
                    />
                  </div>

                  {/* Expected Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Expected Status
                    </label>
                    <input
                      type="number"
                      value={selectedNode.data.expected_status}
                      onChange={(e) => updateNodeData('expected_status', parseInt(e.target.value) || 200)}
                      className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/60"
                    />
                  </div>

                  {/* Request Body (POST/PUT/PATCH only) */}
                  {showBodyField && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                        Request Body (JSON)
                      </label>
                      <textarea
                        rows={5}
                        value={
                          selectedNode.data.body
                            ? JSON.stringify(selectedNode.data.body, null, 2)
                            : ''
                        }
                        onChange={(e) => {
                          try {
                            const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : null;
                            updateNodeData('body', parsed);
                          } catch {
                            // Let user keep typing — only update on valid JSON
                          }
                        }}
                        placeholder='{"key": "value"}'
                        className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 font-mono resize-y"
                      />
                      <p className="text-xs text-slate-600 mt-1">Use {`{{varName}}`} to inject extracted variables</p>
                    </div>
                  )}

                  {/* Custom Headers */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Headers (JSON)
                    </label>
                    <textarea
                      rows={3}
                      value={
                        selectedNode.data.headers && Object.keys(selectedNode.data.headers).length > 0
                          ? JSON.stringify(selectedNode.data.headers, null, 2)
                          : ''
                      }
                      onChange={(e) => {
                        try {
                          const parsed = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                          updateNodeData('headers', parsed);
                        } catch {
                          // Let user keep typing
                        }
                      }}
                      placeholder='{"Authorization": "Bearer {{token}}"}'
                      className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-blue-500/60 font-mono resize-y"
                    />
                  </div>

                  {/* Variable Extractions */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Variable Extractions
                      </label>
                      <button
                        onClick={addExtraction}
                        className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>

                    {(selectedNode.data.extractions || []).length === 0 ? (
                      <p className="text-xs text-slate-600 italic">No extractions. Add one to chain data into later nodes.</p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {(selectedNode.data.extractions || []).map((ext, idx) => (
                          <div key={idx} className="flex gap-1.5 items-start">
                            <div className="flex-1 flex flex-col gap-1">
                              <input
                                type="text"
                                value={ext.name}
                                onChange={(e) => updateExtraction(idx, 'name', e.target.value)}
                                placeholder="varName"
                                className="w-full bg-slate-700/60 border border-slate-600/60 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 font-mono"
                              />
                              <input
                                type="text"
                                value={ext.jsonpath}
                                onChange={(e) => updateExtraction(idx, 'jsonpath', e.target.value)}
                                placeholder="$.data.token"
                                className="w-full bg-slate-700/60 border border-slate-600/60 rounded px-2 py-1 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-cyan-500/60 font-mono"
                              />
                            </div>
                            <button
                              onClick={() => removeExtraction(idx)}
                              className="mt-1 text-slate-600 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Delete Node */}
                  <button
                    onClick={deleteSelectedNode}
                    className="mt-2 flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 rounded-lg text-red-400 text-xs font-semibold transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Node
                  </button>
                </>
              )}
            </div>
          )}

          {/* Results tab */}
          {activeTab === 'results' && (
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
              {!flowResults ? (
                <div className="flex-1 flex items-center justify-center text-center py-12">
                  <div>
                    <div className="text-3xl mb-3">▷</div>
                    <p className="text-slate-500 text-sm">Run the flow to see results here</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Summary */}
                  <div className="bg-slate-700/40 border border-slate-600/40 rounded-xl p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Summary</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        flowResults.summary?.failed === 0
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-red-500/20 text-red-400'
                      }`}>
                        {flowResults.summary?.failed === 0 ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold text-white">{flowResults.summary?.total || 0}</div>
                        <div className="text-xs text-slate-500">Total</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-green-400">{flowResults.summary?.passed || 0}</div>
                        <div className="text-xs text-slate-500">Passed</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-red-400">{flowResults.summary?.failed || 0}</div>
                        <div className="text-xs text-slate-500">Failed</div>
                      </div>
                    </div>
                  </div>

                  {/* Per-step results */}
                  {(flowResults.results || []).map((r, i) => (
                    <button
                      key={r.node_id}
                      onClick={() => highlightNode(r.node_id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] ${
                        r.status === 'PASS'
                          ? 'bg-green-500/5 border-green-500/20 hover:border-green-500/40'
                          : 'bg-red-500/5 border-red-500/20 hover:border-red-500/40'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          r.status === 'PASS' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          {r.status}
                        </span>
                        <span className="text-sm text-white font-medium truncate">{r.test}</span>
                      </div>
                      <p className="text-xs text-slate-400">{r.details}</p>

                      {/* Extracted vars */}
                      {r.extracted_vars && Object.keys(r.extracted_vars).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(r.extracted_vars).map(([k, v]) => (
                            <span key={k} className="text-xs bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded px-1.5 py-0.5 font-mono">
                              {k}={String(v).slice(0, 20)}{String(v).length > 20 ? '…' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── SHARE MODAL ── */}
      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-base">Share Flow</h2>
              <button onClick={() => setShowShareModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: '👁', label: 'View', desc: 'See the flow diagram' },
                { icon: '⑂', label: 'Fork', desc: 'Copy to their workspace' },
              ].map((m) => (
                <div key={m.label} className="bg-slate-700/40 border border-slate-700/40 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-lg">{m.icon}</span>
                  <div>
                    <p className="text-white text-xs font-semibold">{m.label}</p>
                    <p className="text-slate-500 text-xs">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom URL slug */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Custom URL</label>
              <div className="flex items-center gap-0 bg-slate-700/60 border border-slate-600/60 rounded-lg overflow-hidden focus-within:border-indigo-500/60">
                <span className="text-slate-500 text-xs px-3 py-2 shrink-0 border-r border-slate-600/60 bg-slate-700/40">
                  /flow/
                </span>
                <input
                  type="text"
                  value={customSlugInput}
                  onChange={(e) => {
                    setCustomSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''));
                    setShareLink('');
                    setSlugError('');
                  }}
                  placeholder="your-flow-name"
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-white font-mono focus:outline-none"
                  maxLength={60}
                />
              </div>
              {slugError && <p className="text-red-400 text-xs">{slugError}</p>}
              <p className="text-slate-600 text-xs">Letters, numbers, hyphens and underscores only.</p>
            </div>

            {/* Link output */}
            {shareLink ? (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Shareable Link</label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareLink}
                    className="flex-1 bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono focus:outline-none"
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    onClick={copyShareLink}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                      shareCopied
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                        : 'bg-purple-600 hover:bg-purple-500 text-white'
                    }`}
                  >
                    {shareCopied ? <><Check className="w-3.5 h-3.5" /> Copied!</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleGenerateLink}
                disabled={isSharing || !customSlugInput.trim()}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold text-white transition-all"
              >
                {isSharing ? <Loader className="w-4 h-4 animate-spin" /> : <Link className="w-4 h-4" />}
                {isSharing ? 'Generating…' : 'Generate Link'}
              </button>
            )}

            <p className="text-xs text-slate-600">
              Permanent until you delete the flow. Credentials and base URL are not exposed publicly.
            </p>
          </div>
        </div>
      )}

      {/* ── SAVE MODAL ── */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold text-base">
                {currentFlowId ? 'Update Flow' : 'Save Flow'}
              </h2>
              <button onClick={() => setShowSaveModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Flow Name *</label>
                <input
                  type="text"
                  value={saveFlowName}
                  onChange={(e) => setSaveFlowName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveFlow()}
                  placeholder="e.g. Auth + Create Post"
                  autoFocus
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">Description</label>
                <input
                  type="text"
                  value={saveFlowDesc}
                  onChange={(e) => setSaveFlowDesc(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-slate-700/60 border border-slate-600/60 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2 rounded-lg border border-slate-600/60 text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveFlow}
                disabled={isSaving || !saveFlowName.trim()}
                className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : saveSuccess ? (
                  <><Check className="w-4 h-4" /> Saved!</>
                ) : (
                  <><Save className="w-4 h-4" /> {currentFlowId ? 'Update' : 'Save'}</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FLOWS MODAL ── */}
      {showFlowsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-slate-800 border border-slate-700/60 rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[70vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700/60 shrink-0">
              <h2 className="text-white font-semibold text-base">Saved Flows</h2>
              <button onClick={() => setShowFlowsModal(false)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
              {isLoadingFlows ? (
                <div className="flex items-center justify-center py-12 text-slate-500">
                  <Loader className="w-5 h-5 animate-spin mr-2" /> Loading…
                </div>
              ) : savedFlows.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-3xl mb-3">📂</div>
                  <p className="text-slate-500 text-sm">No saved flows yet.</p>
                  <p className="text-slate-600 text-xs mt-1">Use the Save button in the toolbar to save your first flow.</p>
                </div>
              ) : (
                savedFlows.map((flow) => (
                  <button
                    key={flow.flow_id}
                    onClick={() => loadFlow(flow.flow_id)}
                    className={`w-full text-left p-3 rounded-xl border transition-all hover:scale-[1.01] group ${
                      currentFlowId === flow.flow_id
                        ? 'bg-indigo-500/10 border-indigo-500/40'
                        : 'bg-slate-700/30 border-slate-700/40 hover:border-slate-600/60 hover:bg-slate-700/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white truncate">{flow.name}</p>
                          {currentFlowId === flow.flow_id && (
                            <span className="text-xs bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 px-1.5 py-0.5 rounded font-medium shrink-0">active</span>
                          )}
                        </div>
                        {flow.description && (
                          <p className="text-xs text-slate-400 mt-0.5 truncate">{flow.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                          <span>{flow.node_count} node{flow.node_count !== 1 ? 's' : ''}</span>
                          <span>·</span>
                          <span>{new Date(flow.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDeleteFlow(flow.flow_id, e)}
                        className="opacity-0 group-hover:opacity-100 shrink-0 p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        title="Delete flow"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-700/60 shrink-0">
              <button
                onClick={() => {
                  setShowFlowsModal(false);
                  setCurrentFlowId(null);
                  setCurrentFlowName('');
                  setNodes([]);
                  setEdges([]);
                  setBaseUrl('');
                  setAuthConfig({ type: 'none', token: '' });
                  setFlowResults(null);
                  setSelectedNodeId(null);
                }}
                className="w-full py-2 rounded-lg border border-slate-600/60 text-slate-400 text-sm hover:text-white hover:border-slate-500 transition-all"
              >
                + New blank flow
              </button>
            </div>
          </div>
        </div>
      )}

      {/* React Flow dark theme overrides */}
      <style>{`
        .flow-dark .react-flow__background { background: #0f172a; }
        .react-flow__controls { background: #1e293b !important; border: 1px solid rgba(71,85,105,0.6) !important; border-radius: 10px !important; overflow: hidden; }
        .react-flow__controls-button { background: #1e293b !important; border-color: rgba(71,85,105,0.4) !important; color: #94a3b8 !important; fill: #94a3b8 !important; }
        .react-flow__controls-button:hover { background: #334155 !important; color: #e2e8f0 !important; fill: #e2e8f0 !important; }
        .react-flow__minimap { background: #1e293b !important; border: 1px solid rgba(71,85,105,0.6) !important; border-radius: 10px !important; overflow: hidden; }
        .react-flow__edge-path { stroke: #6366f1; stroke-width: 2; }
        .react-flow__connection-path { stroke: #6366f1; }
        .react-flow__handle { background: #475569 !important; border-color: #64748b !important; }
        .react-flow__node { border-radius: 10px; }
        .react-flow__attribution { display: none !important; }
      `}</style>
    </div>
  );
}

// ── Exported wrapper (provides ReactFlowProvider context) ─────────────────────
export default function VisualBuilderApp(props) {
  return (
    <ReactFlowProvider>
      <VisualBuilderInner {...props} />
    </ReactFlowProvider>
  );
}
