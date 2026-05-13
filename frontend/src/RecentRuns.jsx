import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Share2, Clock, RefreshCw } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function relativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function RecentRuns({ module }) {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [sharingId, setSharingId] = useState(null);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      if (!token) { setLoading(false); return; }
      const url = module
        ? `${API_BASE_URL}/history/runs?module=${module}&limit=10`
        : `${API_BASE_URL}/history/runs?limit=10`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error('[History] GET /history/runs failed:', res.status, body);
        setError(`${res.status}: ${body || res.statusText}`);
        return;
      }
      const data = await res.json();
      setRuns(data.runs || []);
    } catch (err) {
      console.error('[History] Fetch error:', err);
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => { fetchRuns(); }, [fetchRuns]);

  const handleShare = async (run) => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setSharingId(run.session_id);
    try {
      let shareToken = run.share_token;
      if (!shareToken) {
        const res = await fetch(`${API_BASE_URL}/history/runs/${run.session_id}/share`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await res.json();
        shareToken = data.share_token;
        setRuns(prev => prev.map(r =>
          r.session_id === run.session_id ? { ...r, share_token: shareToken } : r
        ));
      }
      const shareUrl = `${window.location.origin}/report/${shareToken}`;
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(run.session_id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // silently fail
    } finally {
      setSharingId(null);
    }
  };

  if (loading) {
    return (
      <div className="py-8 text-center text-slate-500 text-sm animate-pulse">
        Loading history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-slate-500 text-sm mb-1">Could not load history</p>
        <p className="text-red-400/70 text-xs font-mono mb-3 px-4 break-all">{error}</p>
        <button
          onClick={fetchRuns}
          className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mx-auto"
        >
          <RefreshCw size={12} /> Retry
        </button>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="py-10 text-center">
        <Clock size={32} className="mx-auto text-slate-700 mb-3" />
        <p className="text-slate-500 text-sm">No previous runs yet</p>
        <p className="text-slate-600 text-xs mt-1">Run a test above to see history here</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-slate-500 uppercase tracking-wider">Recent Runs</span>
        <button
          onClick={fetchRuns}
          className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 transition-colors"
        >
          <RefreshCw size={11} /> Refresh
        </button>
      </div>

      {runs.map((run) => {
        const isCopied = copiedId === run.session_id;
        const isSharing = sharingId === run.session_id;
        const passRate = run.total_tests > 0
          ? Math.round((run.passed / run.total_tests) * 100)
          : 0;

        return (
          <div
            key={run.session_id}
            className="flex items-center gap-3 bg-slate-800/50 border border-slate-700/40 rounded-xl px-4 py-3 hover:border-slate-600/60 transition-colors"
          >
            {/* Status dot */}
            {run.overall_status === 'PASS' ? (
              <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
            ) : (
              <XCircle size={16} className="text-red-400 flex-shrink-0" />
            )}

            {/* URL + stats */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-200 font-mono truncate">{run.api_url}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">
                  <span className="text-green-400">{run.passed}P</span>
                  {' / '}
                  <span className={run.failed > 0 ? 'text-red-400' : 'text-slate-500'}>{run.failed}F</span>
                  {' · '}
                  <span className={passRate === 100 ? 'text-green-400' : passRate >= 50 ? 'text-yellow-400' : 'text-red-400'}>
                    {passRate}%
                  </span>
                </span>
                <span className="text-xs text-slate-600">{relativeTime(run.executed_at)}</span>
              </div>
            </div>

            {/* Share button */}
            <button
              onClick={() => handleShare(run)}
              disabled={isSharing}
              title={isCopied ? 'Link copied!' : 'Copy share link'}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isCopied
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-slate-700/50 text-slate-400 hover:text-white hover:bg-slate-700 border border-slate-600/30'
              }`}
            >
              <Share2 size={11} />
              {isCopied ? 'Copied!' : isSharing ? '...' : 'Share'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
