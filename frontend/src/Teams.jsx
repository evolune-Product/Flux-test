import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, UserPlus, Shield, Crown, Save, FolderOpen, Share2, Loader, AlertCircle, CheckCircle, Download } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

function Teams({ user, onClose, currentTestSuite, onLoadSuite }) {
  const [activeTab, setActiveTab] = useState('teams');
  const [teams, setTeams] = useState([]);
  const [testSuites, setTestSuites] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [newTeamName, setNewTeamName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  
  const [saveSuiteData, setSaveSuiteData] = useState({
    suite_name: '',
    description: '',
    team_id: '',
    is_shared: false
  });

  useEffect(() => {
    loadTeams();
    loadTestSuites();
  }, []);

  // Clear message when switching tabs
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMessage({ type: '', text: '' });
  };

  // Auto-dismiss success messages after 3 seconds
  useEffect(() => {
    if (message.type === 'success') {
      const timer = setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const loadTeams = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teams/my-teams`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams);
      }
    } catch (error) {
      console.error('Error loading teams:', error);
    }
  };

  const loadTestSuites = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/test-suites/my-suites`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTestSuites(data.suites);
      }
    } catch (error) {
      console.error('Error loading test suites:', error);
    }
  };

  const loadTeamMembers = async (teamId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teams/${teamId}/members`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setTeamMembers(data.members);
      }
    } catch (error) {
      console.error('Error loading team members:', error);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teams/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ team_name: newTeamName })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to create team');
      }

      setMessage({ type: 'success', text: 'Team created successfully!' });
      setNewTeamName('');
      loadTeams();

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleInviteMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !selectedTeam) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teams/${selectedTeam.team_id}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to invite member');
      }

      setMessage({ type: 'success', text: data.message });
      setInviteEmail('');
      setInviteRole('member');
      loadTeamMembers(selectedTeam.team_id);

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/teams/${selectedTeam.team_id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Member removed successfully' });
        loadTeamMembers(selectedTeam.team_id);
      }

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to remove member' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTestSuite = async (e) => {
    e.preventDefault();
    if (!saveSuiteData.suite_name.trim() || !currentTestSuite) return;
    
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/test-suites/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          suite_name: saveSuiteData.suite_name,
          description: saveSuiteData.description,
          api_url: currentTestSuite.api_url,
          sample_data: currentTestSuite.sample_data,
          auth_config: currentTestSuite.auth_config,
          test_cases: currentTestSuite.test_cases,
          team_id: saveSuiteData.team_id || null,
          is_shared: saveSuiteData.is_shared
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Failed to save test suite');
      }

      setMessage({ type: 'success', text: 'Test suite saved successfully!' });
      setSaveSuiteData({
        suite_name: '',
        description: '',
        team_id: '',
        is_shared: false
      });
      loadTestSuites();

    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSuite = async (suiteId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/test-suites/${suiteId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        onLoadSuite(data);
        setMessage({ type: 'success', text: 'Test suite loaded successfully!' });
        setTimeout(() => {
          onClose();
        }, 1500);
      }

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load test suite' });
    }
  };

  const handleDeleteSuite = async (suiteId) => {
    if (!window.confirm('Are you sure you want to delete this test suite?')) return;
    
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/test-suites/${suiteId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setMessage({ type: 'success', text: 'Test suite deleted successfully' });
        loadTestSuites();
      }

    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to delete test suite' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Team Collaboration</h2>
              <p className="text-sm text-blue-100">Manage teams and share test suites</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/20 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => handleTabChange('teams')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'teams'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <Users className="inline mr-2" size={18} />
              My Teams
            </button>
            <button
              onClick={() => handleTabChange('suites')}
              className={`flex-1 px-6 py-4 font-semibold transition-all ${
                activeTab === 'suites'
                  ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <FolderOpen className="inline mr-2" size={18} />
              Test Suites
            </button>
            {currentTestSuite && (
              <button
                onClick={() => handleTabChange('save')}
                className={`flex-1 px-6 py-4 font-semibold transition-all ${
                  activeTab === 'save'
                    ? 'text-green-600 border-b-2 border-green-600 bg-green-50'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <Save className="inline mr-2" size={18} />
                Save Current
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Message Display */}
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

          {/* Teams Tab */}
          {activeTab === 'teams' && (
            <div>
              {/* Create Team */}
              <div className="bg-gradient-to-br from-green-50 to-blue-50 border-2 border-green-200 rounded-lg p-6 mb-6">
                <h3 className="text-xl font-bold mb-4">Create New Team</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    placeholder="Enter team name"
                    className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                  />
                  <button
                    onClick={handleCreateTeam}
                    disabled={loading || !newTeamName.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <Plus size={20} />
                    Create Team
                  </button>
                </div>
              </div>

              {/* Teams List */}
              <h3 className="text-xl font-bold mb-4">Your Teams ({teams.length})</h3>
              {teams.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teams.map((team) => (
                    <div
                      key={team.team_id}
                      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer"
                      onClick={() => {
                        setSelectedTeam(team);
                        loadTeamMembers(team.team_id);
                      }}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-xl">
                            {team.team_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{team.team_name}</h4>
                            <p className="text-sm text-gray-600">{team.member_count} members</p>
                          </div>
                        </div>
                        {team.role === 'owner' ? (
                          <Crown className="text-yellow-500" size={20} />
                        ) : team.role === 'admin' ? (
                          <Shield className="text-blue-500" size={20} />
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className={`px-3 py-1 rounded-full font-semibold ${
                          team.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                          team.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {team.role.toUpperCase()}
                        </span>
                        <span className="text-gray-500">Click to manage</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <Users className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600 font-medium">No teams yet</p>
                  <p className="text-sm text-gray-500">Create your first team to collaborate</p>
                </div>
              )}

              {/* Team Members Modal */}
              {selectedTeam && (
                <div className="mt-6 bg-gray-50 border-2 border-gray-300 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold">{selectedTeam.team_name} - Members</h3>
                    <button
                      onClick={() => setSelectedTeam(null)}
                      className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                      Close
                    </button>
                  </div>

                  {/* Invite Member */}
                  {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && (
                    <div className="bg-white border-2 border-blue-200 rounded-lg p-4 mb-4">
                      <h4 className="font-semibold mb-3">Invite New Member</h4>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          placeholder="Enter email address"
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value)}
                          className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="member">Member</option>
                          <option value="admin">Admin</option>
                        </select>
                        <button
                          onClick={handleInviteMember}
                          disabled={loading || !inviteEmail.trim()}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                        >
                          <UserPlus size={18} />
                          Invite
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Members List */}
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div
                        key={member.user_id}
                        className="bg-white border border-gray-200 rounded-lg p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                            {member.username.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold">{member.full_name || member.username}</div>
                            <div className="text-sm text-gray-600">{member.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            member.role === 'owner' ? 'bg-yellow-100 text-yellow-700' :
                            member.role === 'admin' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {member.role.toUpperCase()}
                          </span>
                          {(selectedTeam.role === 'owner' || selectedTeam.role === 'admin') && 
                           member.role !== 'owner' && 
                           member.user_id !== user.user_id && (
                            <button
                              onClick={() => handleRemoveMember(member.user_id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Test Suites Tab */}
          {activeTab === 'suites' && (
            <div>
              <h3 className="text-xl font-bold mb-4">Saved Test Suites ({testSuites.length})</h3>
              {testSuites.length > 0 ? (
                <div className="space-y-4">
                  {testSuites.map((suite) => (
                    <div
                      key={suite.suite_id}
                      className="bg-white border-2 border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-bold text-lg">{suite.suite_name}</h4>
                            {suite.is_shared && (
                              <Share2 className="text-green-500" size={16} />
                            )}
                          </div>
                          {suite.description && (
                            <p className="text-sm text-gray-600 mb-2">{suite.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 text-sm">
                            <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                              {suite.test_count} tests
                            </span>
                            <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded">
                              By {suite.created_by}
                            </span>
                            {suite.team_name && (
                              <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                                Team: {suite.team_name}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleLoadSuite(suite.suite_id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
                          >
                            <Download size={16} />
                            Load
                          </button>
                          {suite.is_owner && (
                            <button
                              onClick={() => handleDeleteSuite(suite.suite_id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        Updated: {new Date(suite.updated_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  <FolderOpen className="mx-auto text-gray-400 mb-4" size={48} />
                  <p className="text-gray-600 font-medium">No saved test suites</p>
                  <p className="text-sm text-gray-500">Save your current tests to reuse them later</p>
                </div>
              )}
            </div>
          )}

          {/* Save Current Tab */}
          {activeTab === 'save' && currentTestSuite && (
            <div>
              <h3 className="text-xl font-bold mb-4">Save Current Test Suite</h3>
              <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-lg p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Suite Name *</label>
                    <input
                      type="text"
                      value={saveSuiteData.suite_name}
                      onChange={(e) => setSaveSuiteData({...saveSuiteData, suite_name: e.target.value})}
                      placeholder="Enter a name for this test suite"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Description</label>
                    <textarea
                      value={saveSuiteData.description}
                      onChange={(e) => setSaveSuiteData({...saveSuiteData, description: e.target.value})}
                      placeholder="Optional description"
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      rows={3}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Share with Team (Optional)</label>
                    <select
                      value={saveSuiteData.team_id}
                      onChange={(e) => setSaveSuiteData({...saveSuiteData, team_id: e.target.value})}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    >
                      <option value="">Private (Only you)</option>
                      {teams.map((team) => (
                        <option key={team.team_id} value={team.team_id}>
                          {team.team_name} ({team.member_count} members)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={saveSuiteData.is_shared}
                      onChange={(e) => setSaveSuiteData({...saveSuiteData, is_shared: e.target.checked})}
                      className="w-4 h-4 text-blue-600 rounded"
                    />
                    <label className="text-sm">
                      Allow team members to edit this test suite
                    </label>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">Test Suite Summary:</h4>
                    <ul className="text-sm space-y-1">
                      <li>• API: {currentTestSuite.api_url}</li>
                      <li>• Total Tests: {currentTestSuite.test_cases?.length || 0}</li>
                      <li>• Auth Type: {currentTestSuite.auth_config?.type || 'none'}</li>
                    </ul>
                  </div>

                  <button
                    onClick={handleSaveTestSuite}
                    disabled={loading || !saveSuiteData.suite_name.trim()}
                    className="w-full py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save size={20} />
                        Save Test Suite
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Teams;