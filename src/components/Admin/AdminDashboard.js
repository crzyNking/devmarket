// src/components/Admin/AdminDashboard.js
import React, { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';
import { useAppContext } from '../../contexts/AppContext';
import { ContentModeration } from './ContentModeration';
import { SkeletonGrid } from '../Common/SkeletonLoader';

export function AdminDashboard() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  async function loadDashboardData() {
    setLoading(true);
    try {
      const [
        { count: totalUsers },
        { count: totalListings },
        { count: totalApps },
        { count: totalSnippets },
        { count: totalMessages },
        { data: recentListings },
        { data: recentMessages },
        { data: allUsers }
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('listings').select('*', { count: 'exact', head: true }),
        supabase.from('apps').select('*', { count: 'exact', head: true }),
        supabase.from('code_snippets').select('*', { count: 'exact', head: true }),
        supabase.from('messages').select('*', { count: 'exact', head: true }),
        supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('messages').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('profiles').select('*').order('created_at', { ascending: false })
      ]);

      setStats({
        totalUsers: totalUsers || 0,
        totalListings: totalListings || 0,
        totalApps: totalApps || 0,
        totalSnippets: totalSnippets || 0,
        totalMessages: totalMessages || 0,
        totalContent: (totalListings || 0) + (totalApps || 0) + (totalSnippets || 0)
      });

      setRecentActivity([
        ...(recentListings || []).map(l => ({ type: 'listing', ...l, time: l.created_at })),
        ...(recentMessages || []).map(m => ({ type: 'message', ...m, time: m.created_at }))
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20));

      setUsers(allUsers || []);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
    setLoading(false);
  }

  if (!state.isAdmin) {
    return (
      <div className="admin-access-denied">
        <span>🔒</span>
        <h2>Access Denied</h2>
        <p>You don't have permission to access the admin dashboard.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="admin-header">
          <h1>Admin Dashboard</h1>
          <p>Loading analytics...</p>
        </div>
        <SkeletonGrid count={4} />
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'users', label: '👥 Users', icon: '👥' },
    { id: 'content', label: '📝 Content', icon: '📝' },
    { id: 'moderation', label: '🛡️ Moderation', icon: '🛡️' },
    { id: 'analytics', label: '📈 Analytics', icon: '📈' }
  ];

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>🛡️ Admin Dashboard</h1>
        <p>Manage and monitor your DevMarket platform</p>
      </div>

      <div className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span> {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="admin-overview">
          <div className="stats-grid">
            <div className="admin-stat-card">
              <span className="stat-icon">👥</span>
              <div>
                <h3>{stats.totalUsers}</h3>
                <p>Total Users</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="stat-icon">📦</span>
              <div>
                <h3>{stats.totalContent}</h3>
                <p>Total Content</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="stat-icon">💬</span>
              <div>
                <h3>{stats.totalMessages}</h3>
                <p>Messages</p>
              </div>
            </div>
            <div className="admin-stat-card">
              <span className="stat-icon">📈</span>
              <div>
                <h3>+12%</h3>
                <p>Growth Rate</p>
              </div>
            </div>
          </div>

          <div className="admin-section">
            <h2>Recent Activity</h2>
            <div className="activity-list">
              {recentActivity.slice(0, 10).map((activity, i) => (
                <div key={i} className="activity-item">
                  <span className="activity-icon">
                    {activity.type === 'listing' ? '📢' : '💬'}
                  </span>
                  <div className="activity-content">
                    <p>
                      {activity.type === 'listing' 
                        ? `New listing: "${activity.title}"` 
                        : `New message: "${activity.message?.substring(0, 50)}..."`}
                    </p>
                    <small>{new Date(activity.time).toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-users">
          <div className="admin-section-header">
            <h2>User Management</h2>
            <input 
              type="text" 
              placeholder="Search users..." 
              className="search-input"
              onChange={(e) => {
                const query = e.target.value.toLowerCase();
                supabase
                  .from('profiles')
                  .select('*')
                  .or(`name.ilike.%${query}%,email.ilike.%${query}%`)
                  .then(({ data }) => setUsers(data || []));
              }}
            />
          </div>
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 50).map(user => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <img 
                          src={user.avatar_url || `https://ui-avatars.com/api/?name=${user.name}&background=667eea&color=fff&size=30`} 
                          alt={user.name}
                          className="user-avatar-small"
                        />
                        {user.name}
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>
                      <span className={`role-badge ${user.role}`}>{user.role}</span>
                    </td>
                    <td>{new Date(user.created_at).toLocaleDateString()}</td>
                    <td>
                      <button 
                        className="btn-text"
                        onClick={async () => {
                          const newRole = user.role === 'admin' ? 'developer' : 'admin';
                          await supabase
                            .from('profiles')
                            .update({ role: newRole })
                            .eq('id', user.id);
                          loadDashboardData();
                        }}
                      >
                        {user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'content' && (
        <div className="admin-content">
          <h2>Content Overview</h2>
          <div className="content-stats-grid">
            <div className="content-stat">
              <h3>{stats.totalListings}</h3>
              <p>Listings</p>
            </div>
            <div className="content-stat">
              <h3>{stats.totalApps}</h3>
              <p>Apps</p>
            </div>
            <div className="content-stat">
              <h3>{stats.totalSnippets}</h3>
              <p>Code Snippets</p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'moderation' && <ContentModeration />}

      {activeTab === 'analytics' && (
        <div className="admin-analytics">
          <h2>Platform Analytics</h2>
          <div className="analytics-grid">
            <div className="analytics-card">
              <h3>Growth Trends</h3>
              <div className="chart-placeholder">
                📈 Chart coming soon
              </div>
            </div>
            <div className="analytics-card">
              <h3>User Activity</h3>
              <div className="chart-placeholder">
                📊 Activity data loading...
              </div>
            </div>
            <div className="analytics-card">
              <h3>Popular Categories</h3>
              <div className="chart-placeholder">
                🏷️ Category distribution
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}