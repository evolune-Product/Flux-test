import React, { useState, useEffect } from 'react';
import { X, Github, CheckCircle, AlertCircle, Loader, ExternalLink, FolderGit2 } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function GitHubIntegration({ testResults, apiUrl, onClose }) {
  const [connected, setConnected] = useState(false);
  const [githubUsername, setGithubUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [savedResults, setSavedResults] = useState([]);
  
  const [saveData, setSaveData] = useState({
    suite_name: '',
    repo_name: '',
    file_path: 'test-results',
    commit_message: ''
  });

  useEffect(() => {
    checkGitHubStatus();
    loadSavedResults();

    // Check if we just returned from GitHub OAuth
    const urlParams = new URLSearchParams(window.location.search);
    const githubConnected = urlParams.get('github_connected');
    const error = urlParams.get('error');

    if (githubConnected === 'true') {
      setMessage({ type: 'success', text: 'GitHub connected successfully!' });
      checkGitHubStatus(); // Refresh status
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (error || githubConnected === 'false') {
      setMessage({ type: 'error', text: `Failed to connect GitHub: ${error || 'Unknown error'}` });
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const checkGitHubStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/github/status`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setConnected(data.connected);
        setGithubUsername(data.github_username || '');
        if (data.default_repo) {
          setSaveData(prev => ({ ...prev, repo_name: data.default_repo }));
        }
      }
    } catch (error) {
      console.error('Error checking GitHub status:', error);
    }
  };

  const loadSavedResults = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/github/my-results`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setSavedResults(data.results);
      }
    } catch (error) {
      console.error('Error loading saved results:', error);
    }
  };

  const handleConnectGitHub = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        setMessage({ type: 'error', text: 'You must be logged in to connect GitHub.' });
        setLoading(false);
        return;
      }

      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      // Pass current page path so we return here after GitHub auth
      const currentPath = window.location.pathname;
      const response = await fetch(`${API_BASE_URL}/github/connect?redirect_path=${encodeURIComponent(currentPath)}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `Server error: ${response.status}`;
        throw new Error(errorMessage);
      }

      const data = await response.json();

      // Validate response has auth_url
      if (!data.auth_url) {
        throw new Error('Invalid response from server: missing authorization URL');
      }

      console.log('Redirecting to GitHub OAuth:', data.auth_url);

      // Redirect to GitHub OAuth page
      window.location.href = data.auth_url;
    } catch (error) {
      console.error('Error connecting to GitHub:', error);

      let errorMessage = 'Failed to connect to GitHub. Please try again.';

      if (error.name === 'AbortError') {
        errorMessage = 'Connection timeout. Please check your internet connection and try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessage({ type: 'error', text: errorMessage });
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!window.confirm('Are you sure you want to disconnect GitHub?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/github/disconnect`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setConnected(false);
        setGithubUsername('');
        setMessage({ type: 'success', text: 'GitHub disconnected successfully' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect GitHub' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveToGitHub = async (e) => {
    e.preventDefault();
    
    if (!saveData.suite_name.trim() || !saveData.repo_name.trim()) {
      setMessage({ type: 'error', text: 'Please fill in all required fields' });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      
      const resultsData = {
        api_url: apiUrl,
        timestamp: new Date().toISOString(),
        summary: testResults.summary,
        results: testResults.results
      };

      const response = await fetch(`${API_BASE_URL}/github/save-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          suite_name: saveData.suite_name,
          test_results: resultsData,
          repo_name: saveData.repo_name,
          file_path: saveData.file_path,
          commit_message: saveData.commit_message || undefined
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save to GitHub');
      }

      setMessage({ 
        type: 'success', 
        text: 'Results saved to GitHub successfully!' 
      });
      
      setSaveData({
        suite_name: '',
        repo_name: saveData.repo_name,
        file_path: 'test-results',
        commit_message: ''
      });

      loadSavedResults();

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white text-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="bg-gradient-to-r from-gray-900 to-gray-700 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Github size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">GitHub Integration</h2>
              <p className="text-sm text-gray-300">Save test results to your GitHub repository</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {message.text && (
            <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
              ) : (
                <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
              )}
              <p className={`text-sm ${
                message.type === 'success' ? 'text-green-700' : 'text-red-700'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          <div className={`mb-6 p-6 rounded-lg border-2 ${
            connected 
              ? 'bg-green-50 border-green-200' 
              : 'bg-gray-50 border-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Github size={32} className={connected ? 'text-green-600' : 'text-gray-400'} />
                <div>
                  <h3 className="font-bold text-lg">GitHub Status</h3>
                  {connected ? (
                    <p className="text-sm text-green-700">
                      Connected as <strong>@{githubUsername}</strong>
                    </p>
                  ) : (
                    <p className="text-sm text-gray-600">Not connected</p>
                  )}
                </div>
              </div>
              
              {connected ? (
                <button
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={handleConnectGitHub}
                  className="px-6 py-3 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all flex items-center gap-2 font-semibold"
                >
                  <Github size={20} />
                  Connect GitHub
                </button>
              )}
            </div>

            {!connected && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                <p className="text-sm text-blue-800">
                  <strong>Why connect GitHub?</strong> Save your test results directly to a GitHub repository for version control, sharing, and historical tracking.
                </p>
              </div>
            )}
          </div>

          {connected && testResults && (
            <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <FolderGit2 size={24} />
                Save Current Test Results
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Test Suite Name *</label>
                  <input
                    type="text"
                    value={saveData.suite_name}
                    onChange={(e) => setSaveData({...saveData, suite_name: e.target.value})}
                    placeholder="e.g., UserAPI_Tests"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-600 mt-1">This will be used in the filename</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Repository Name *</label>
                  <input
                    type="text"
                    value={saveData.repo_name}
                    onChange={(e) => setSaveData({...saveData, repo_name: e.target.value})}
                    placeholder="e.g., api-test-results"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-600 mt-1">Repository will be created if it doesn't exist (private by default)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Folder Path</label>
                  <input
                    type="text"
                    value={saveData.file_path}
                    onChange={(e) => setSaveData({...saveData, file_path: e.target.value})}
                    placeholder="test-results"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                  <p className="text-xs text-gray-600 mt-1">Folder where results will be saved</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Commit Message (Optional)</label>
                  <input
                    type="text"
                    value={saveData.commit_message}
                    onChange={(e) => setSaveData({...saveData, commit_message: e.target.value})}
                    placeholder="Add test results for UserAPI"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  />
                </div>

                <div className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-sm mb-2">Test Results Summary:</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total Tests:</span>
                      <div className="font-bold text-lg">{testResults.summary?.total || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Passed:</span>
                      <div className="font-bold text-lg text-green-600">{testResults.summary?.passed || 0}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Failed:</span>
                      <div className="font-bold text-lg text-red-600">{testResults.summary?.failed || 0}</div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleSaveToGitHub}
                  disabled={loading || !saveData.suite_name.trim() || !saveData.repo_name.trim()}
                  className="w-full py-3 bg-gradient-to-r from-gray-900 to-gray-700 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader className="animate-spin" size={20} />
                      Saving to GitHub...
                    </>
                  ) : (
                    <>
                      <Github size={20} />
                      Save to GitHub Repository
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {connected && savedResults.length > 0 && (
            <div>
              <h3 className="text-xl font-bold mb-4">Saved Results History ({savedResults.length})</h3>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {savedResults.map((result) => (
                  <div
                    key={result.result_id}
                    className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-bold">{result.suite_name}</h4>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(result.created_at).toLocaleString()}
                        </p>
                        {result.commit_sha && (
                          <p className="text-xs text-gray-400 mt-1">
                            Commit: {result.commit_sha.substring(0, 7)}
                          </p>
                        )}
                      </div>
                      <a
                        href={result.github_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-all flex items-center gap-2 text-sm"
                      >
                        <ExternalLink size={16} />
                        View on GitHub
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GitHubIntegration;