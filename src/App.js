// App.js - Complete Fixed Version
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabase';
import { AppProvider, useAppContext } from './contexts/AppContext';
import { useRealtimeMessages } from './hooks/useRealtimeMessages';
import { AvatarUpload } from './components/Common/AvatarUpload';
import { ConfirmDialog } from './components/Common/ConfirmDialog';
import { DevMarketLoader } from './components/Common/DevMarketLoader';
import { SkeletonGrid } from './components/Common/SkeletonLoader';
import { Toast } from './components/Common/Toast';
import { AdvancedSearch } from './components/Listings/AdvancedSearch';
import { ListingCard } from './components/Listings/ListingCard';
import { ListingForm } from './components/Listings/ListingForm';
import { AdminDashboard } from './components/Admin/AdminDashboard';
import { ChatArea } from './components/Chat/ChatArea';
import { ConversationList } from './components/Chat/ConversationList';
import './App.css';

// ============================================
// PROTECTED ROUTE
// ============================================
function ProtectedRoute({ children }) {
  const { state } = useAppContext();
  const location = useLocation();
  if (!state.currentUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return children;
}

// ============================================
// HEADER COMPONENT
// ============================================
function Header() {
  const { state, dispatch } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const unreadNotifications = (state.notifications || []).filter(n => !n.read).length;
  const unreadMessages = (state.conversations || []).reduce((sum, conv) => sum + conv.unreadCount, 0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setShowSearch(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'LOGOUT' });
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: '👋 You have been logged out successfully', 
      type: 'info', 
      time: new Date().toLocaleTimeString(), 
      read: false 
    }});
    setShowLogoutConfirm(false);
    setShowUserMenu(false);
    navigate('/');
  };

  const userDisplayName = state.profile?.name || state.currentUser?.email?.split('@')[0] || 'User';
  const userAvatar = state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=667eea&color=fff&size=40`;

  const closeAll = () => {
    setIsMenuOpen(false);
    setShowUserMenu(false);
    setShowNotifications(false);
  };

  return (
    <>
      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo" onClick={closeAll}>
            <div className="logo-icon-wrapper"><span className="logo-icon">🚀</span></div>
            <div className="logo-text"><h1>DevMarket</h1><p>IT Marketplace Hub</p></div>
          </Link>

          <nav className={`nav-menu ${isMenuOpen ? 'active' : ''}`}>
            <Link to="/marketplace" className={`nav-link ${location.pathname === '/marketplace' ? 'active' : ''}`} onClick={closeAll}>
              <span className="nav-icon">🛒</span> Marketplace
            </Link>
            <Link to="/advertise" className={`nav-link ${location.pathname === '/advertise' ? 'active' : ''}`} onClick={closeAll}>
              <span className="nav-icon">📱</span> Advertise
            </Link>
            <Link to="/code-sharing" className={`nav-link ${location.pathname === '/code-sharing' ? 'active' : ''}`} onClick={closeAll}>
              <span className="nav-icon">💻</span> Code Share
            </Link>
            {state.currentUser && (
              <>
                <Link to="/favorites" className={`nav-link ${location.pathname === '/favorites' ? 'active' : ''}`} onClick={closeAll}>
                  <span className="nav-icon">⭐</span> Favorites
                </Link>
                <Link to="/messages" className={`nav-link ${location.pathname === '/messages' ? 'active' : ''}`} onClick={closeAll}>
                  <span className="nav-icon">💬</span> Messages
                  {unreadMessages > 0 && <span className="notification-badge">{unreadMessages}</span>}
                </Link>
                {state.isAdmin && (
                  <Link to="/admin" className={`nav-link ${location.pathname === '/admin' ? 'active' : ''}`} onClick={closeAll}>
                    <span className="nav-icon">🛡️</span> Admin
                  </Link>
                )}
              </>
            )}
          </nav>

          <div className="header-actions">
            <button className="icon-button search-button" onClick={() => setShowSearch(!showSearch)} title="Search" aria-label="Search">🔍</button>
            
            {showSearch && (
              <>
                <div className="overlay-backdrop" onClick={() => setShowSearch(false)} />
                <div className="search-overlay">
                  <form onSubmit={handleSearch} className="search-form">
                    <input type="text" placeholder="Search marketplace, apps, code..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="search-input-header" autoFocus />
                    <button type="submit" className="btn-search">Search</button>
                    <button type="button" className="btn-close-search" onClick={() => setShowSearch(false)}>✕</button>
                  </form>
                </div>
              </>
            )}
            
            {state.currentUser ? (
              <>
                <button className="icon-button notification-bell" onClick={() => setShowNotifications(!showNotifications)} title="Notifications" aria-label="Notifications">
                  🔔
                  {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications}</span>}
                </button>
                
                <div className="user-menu">
                  <div className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                    <img src={userAvatar} alt={userDisplayName} className="user-avatar" onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=667eea&color=fff&size=40`; }} />
                    <span className="user-name">{userDisplayName}</span>
                    <span className="dropdown-arrow">▾</span>
                  </div>
                  {showUserMenu && (
                    <div className="dropdown-menu">
                      <div className="dropdown-header">
                        <img src={userAvatar} alt={userDisplayName} className="dropdown-avatar" />
                        <div><strong>{userDisplayName}</strong><p>{state.currentUser.email}</p></div>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link to="/profile" onClick={() => setShowUserMenu(false)}><span>👤</span> My Profile</Link>
                      <Link to="/settings" onClick={() => setShowUserMenu(false)}><span>⚙️</span> Settings</Link>
                      {state.isAdmin && <Link to="/admin" onClick={() => setShowUserMenu(false)}><span>🛡️</span> Admin Dashboard</Link>}
                      <div className="dropdown-divider"></div>
                      <button onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}><span>🚪</span> Logout</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button className="btn-login" onClick={() => setShowAuth(true)}>👤 Sign In</button>
            )}
            
            <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} aria-label="Toggle menu">
              {isMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {showNotifications && !isMenuOpen && (
          <>
            <div className="overlay-backdrop" onClick={() => setShowNotifications(false)} />
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h3>Notifications</h3>
                <div className="notification-actions">
                  <button className="btn-text" onClick={() => dispatch({ type: 'MARK_NOTIFICATIONS_READ' })}>Mark all read</button>
                  <button className="btn-text" onClick={() => { dispatch({ type: 'CLEAR_NOTIFICATIONS' }); setShowNotifications(false); }}>Clear All</button>
                </div>
              </div>
              <div className="notifications-list">
                {(state.notifications || []).length === 0 ? (
                  <div className="empty-notifications"><span>🔔</span><p>No notifications yet</p></div>
                ) : (
                  (state.notifications || []).slice(0, 10).map(notif => (
                    <div key={notif.id} className={`notification-item ${!notif.read ? 'unread' : ''}`}>
                      <div className="notification-content">
                        <span className="notification-icon-small">
                          {notif.type === 'success' ? '✅' : notif.type === 'error' ? '❌' : notif.type === 'warning' ? '⚠️' : 'ℹ️'}
                        </span>
                        <div className="notification-body">
                          <p>{notif.message}</p>
                          <small>{notif.time || new Date(notif.created_at).toLocaleTimeString()}</small>
                        </div>
                      </div>
                      <button className="btn-remove-notification" onClick={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: notif.id })}>×</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        {showAuth && <AuthModal setShowAuth={setShowAuth} authMode={authMode} setAuthMode={setAuthMode} />}
      </header>
      <ConfirmDialog isOpen={showLogoutConfirm} title="Confirm Logout" message="Are you sure you want to logout?" onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} confirmText="Logout" type="danger" />
    </>
  );
}

// ============================================
// AUTH MODAL
// ============================================
function AuthModal({ setShowAuth, authMode, setAuthMode }) {
  const { state, dispatch } = useAppContext();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'developer' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    document.body.classList.add('modal-open');
    return () => document.body.classList.remove('modal-open');
  }, []);

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'developer' });
    setErrors({});
    setStep(1);
    setShowSuccess(false);
    setAuthStatus('');
    dispatch({ type: 'SET_AUTH_ERROR', payload: null });
  };

  const validateForm = () => {
    const newErrors = {};
    if (authMode === 'signup') {
      if (!formData.name.trim()) newErrors.name = 'Full name is required';
      else if (formData.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';
    }
    if (!formData.email.trim()) newErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email address';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    if (authMode === 'signup' && step === 2) {
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
      if (!formData.role) newErrors.role = 'Please select your role';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    if (authMode === 'signup' && step === 1) { setStep(2); return; }
    
    setLoading(true);
    setAuthStatus('');
    dispatch({ type: 'SET_AUTH_ERROR', payload: null });
    
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email, password: formData.password,
          options: { data: { name: formData.name, role: formData.role } }
        });
        if (error) { dispatch({ type: 'SET_AUTH_ERROR', payload: error.message }); setLoading(false); return; }
        setShowSuccess(true);
        if (data.session) {
          setAuthStatus('success');
          dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🎉 Welcome to DevMarket, ${formData.name}!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
          setTimeout(() => { setShowAuth(false); navigate('/profile'); }, 2000);
        } else {
          setAuthStatus('confirmation');
          dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '📧 Please check your email to confirm your account.', type: 'info', time: new Date().toLocaleTimeString(), read: false }});
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) {
          let msg = error.message;
          if (error.message.includes('Invalid login')) msg = 'Invalid email or password. Please try again.';
          else if (error.message.includes('Email not confirmed')) msg = 'Please confirm your email first.';
          dispatch({ type: 'SET_AUTH_ERROR', payload: msg });
          setLoading(false);
          return;
        }
        dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '👋 Welcome back!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
        setShowAuth(false);
      }
    } catch (error) {
      dispatch({ type: 'SET_AUTH_ERROR', payload: 'An unexpected error occurred' });
    }
    setLoading(false);
  };

  const handleSocialLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
      if (error) dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login is not configured.` });
    } catch (error) {
      dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login is not available.` });
    }
  };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setShowAuth(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setShowAuth]);

  const passwordStrength = (() => {
    const p = formData.password;
    let s = 0;
    if (p.length >= 8) s++;
    if (p.match(/[a-z]/) && p.match(/[A-Z]/)) s++;
    if (p.match(/\d/)) s++;
    if (p.match(/[^a-zA-Z\d]/)) s++;
    return s;
  })();

  return (
    <div className="modal-overlay" onClick={() => setShowAuth(false)}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="btn-close" onClick={() => setShowAuth(false)} aria-label="Close modal">✕</button>
        
        {showSuccess ? (
          <div className="success-state">
            <div className="success-icon">{authStatus === 'confirmation' ? '📧' : '🎉'}</div>
            <h2>{authStatus === 'confirmation' ? 'Check Your Email' : 'Account Created!'}</h2>
            <p>Welcome to DevMarket, <strong>{formData.name}</strong>!</p>
            <div className="success-details">
              {authStatus === 'confirmation' ? `We've sent a confirmation link to ${formData.email}.` : 'Your account has been created successfully!'}
            </div>
            <div className="success-features">
              <div className="feature-item"><span>🛒</span> Marketplace</div>
              <div className="feature-item"><span>💻</span> Share Code</div>
              <div className="feature-item"><span>📱</span> Advertise Apps</div>
            </div>
            {authStatus === 'success' && <p className="redirect-message">Redirecting to your profile...</p>}
            {authStatus === 'confirmation' && (
              <button className="btn-primary" onClick={() => { setShowSuccess(false); setAuthMode('login'); resetForm(); }} style={{ marginTop: '16px' }}>Go to Login</button>
            )}
          </div>
        ) : (
          <>
            <div className="auth-header">
              <div className="auth-logo-container"><span className="auth-logo">🚀</span><div className="auth-logo-ring"></div></div>
              <h2>{authMode === 'login' ? 'Welcome Back!' : 'Join DevMarket'}</h2>
              <p>{authMode === 'login' ? 'Sign in to access your account' : 'Create your free account'}</p>
            </div>

            <div className="social-login">
              <button className="social-btn google" type="button" onClick={() => handleSocialLogin('google')} title="Sign in with Google">
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4285f4' }}>G</span> Google
              </button>
              <button className="social-btn github" type="button" onClick={() => handleSocialLogin('github')} title="Sign in with GitHub">
                <span>⌨️</span> GitHub
              </button>
            </div>

            <div className="auth-divider"><span>or continue with email</span></div>

            <div className="auth-tabs">
              <button className={`auth-tab ${authMode === 'login' ? 'active' : ''}`} onClick={() => { setAuthMode('login'); resetForm(); }} type="button">Sign In</button>
              <button className={`auth-tab ${authMode === 'signup' ? 'active' : ''}`} onClick={() => { setAuthMode('signup'); resetForm(); }} type="button">Create Account</button>
            </div>

            {state.authError && <div className="auth-error"><span>⚠️</span> {state.authError}</div>}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {authMode === 'signup' && (
                <div className="step-indicator">
                  <div className={`step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>{step > 1 ? '✓' : '1'}</div>
                  <div className={`step-line ${step > 1 ? 'active' : ''}`}></div>
                  <div className={`step ${step === 2 ? 'active' : ''}`}>2</div>
                </div>
              )}

              {(authMode === 'login' || step === 1) && (
                <>
                  {authMode === 'signup' && (
                    <div className="form-group">
                      <label htmlFor="name">Full Name</label>
                      <div className="input-wrapper">
                        <span className="input-icon">👤</span>
                        <input id="name" type="text" placeholder="John Doe" value={formData.name} onChange={e => { setFormData({ ...formData, name: e.target.value }); if (errors.name) setErrors(prev => ({ ...prev, name: '' })); }} className={errors.name ? 'error' : ''} autoFocus />
                      </div>
                      {errors.name && <span className="error-message">⚠️ {errors.name}</span>}
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <div className="input-wrapper">
                      <span className="input-icon">📧</span>
                      <input id="email" type="email" placeholder="you@example.com" value={formData.email} onChange={e => { setFormData({ ...formData, email: e.target.value }); if (errors.email) setErrors(prev => ({ ...prev, email: '' })); dispatch({ type: 'SET_AUTH_ERROR', payload: null }); }} className={errors.email ? 'error' : ''} autoFocus={authMode === 'login'} />
                    </div>
                    {errors.email && <span className="error-message">⚠️ {errors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input id="password" type={showPassword ? "text" : "password"} placeholder={authMode === 'login' ? 'Enter your password' : 'Create a password (min 6 characters)'} value={formData.password} onChange={e => { setFormData({ ...formData, password: e.target.value }); if (errors.password) setErrors(prev => ({ ...prev, password: '' })); }} className={errors.password ? 'error' : ''} />
                      <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
                    </div>
                    {errors.password && <span className="error-message">⚠️ {errors.password}</span>}
                    {authMode === 'signup' && formData.password && (
                      <div className="password-strength">
                        <div className="strength-bars">
                          {[1, 2, 3, 4].map(level => <div key={level} className={`strength-bar ${passwordStrength >= level ? `active level-${passwordStrength}` : ''}`} />)}
                        </div>
                        <span className="strength-text">{['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength] || 'Very weak'}</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {authMode === 'signup' && step === 2 && (
                <>
                  <div className="form-group">
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="Confirm your password" value={formData.confirmPassword} onChange={e => { setFormData({ ...formData, confirmPassword: e.target.value }); if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' })); }} className={errors.confirmPassword ? 'error' : ''} />
                      <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</button>
                    </div>
                    {errors.confirmPassword && <span className="error-message">⚠️ {errors.confirmPassword}</span>}
                  </div>
                  <div className="form-group">
                    <label>I am a...</label>
                    <div className="role-selector">
                      {[{ role: 'developer', icon: '👨‍💻', label: 'Developer' }, { role: 'designer', icon: '🎨', label: 'Designer' }, { role: 'entrepreneur', icon: '💼', label: 'Entrepreneur' }, { role: 'student', icon: '📚', label: 'Student' }].map(r => (
                        <button key={r.role} type="button" className={`role-option ${formData.role === r.role ? 'active' : ''}`} onClick={() => setFormData({ ...formData, role: r.role })}><span>{r.icon}</span><span>{r.label}</span></button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary btn-full" onClick={() => setStep(1)}>← Back</button>
                </>
              )}

              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? <><span className="loading-spinner"></span> {authMode === 'login' ? 'Signing in...' : 'Creating account...'}</> : authMode === 'signup' && step === 1 ? 'Continue →' : authMode === 'login' ? '🚀 Sign In' : '🎉 Create Account'}
              </button>
            </form>

            <div className="auth-footer">
              {authMode === 'login' ? (
                <p>Don't have an account? <button onClick={() => { setAuthMode('signup'); resetForm(); }} type="button" className="btn-link">Create one</button></p>
              ) : (
                <p>Already have an account? <button onClick={() => { setAuthMode('login'); resetForm(); }} type="button" className="btn-link">Sign in</button></p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// HOME PAGE
// ============================================
function Home() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  
  const stats = {
    listings: (state.listings || []).length,
    apps: (state.apps || []).length,
    snippets: (state.codeSnippets || []).length,
    users: 1250
  };
  
  const featuredListings = (state.listings || []).slice(0, 3);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">{state.currentUser ? `👋 Welcome, ${state.profile?.name || 'Developer'}!` : '🎉 New: Code Sharing Community!'}</div>
          <h1>Where Developers <span className="text-gradient">Trade & Share</span></h1>
          <p>Buy and sell websites, showcase your apps, and share code with thousands of developers worldwide.</p>
          <div className="hero-buttons">
            <button onClick={() => navigate('/marketplace')} className="btn-primary btn-large">🛒 Browse Marketplace</button>
            <button onClick={() => navigate('/code-sharing')} className="btn-secondary btn-large">💻 Share Code</button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat"><span className="hero-stat-value">{stats.listings}+</span><span className="hero-stat-label">Listings</span></div>
            <div className="hero-stat"><span className="hero-stat-value">{stats.apps}+</span><span className="hero-stat-label">Apps</span></div>
            <div className="hero-stat"><span className="hero-stat-value">{stats.snippets}+</span><span className="hero-stat-label">Snippets</span></div>
            <div className="hero-stat"><span className="hero-stat-value">{stats.users}+</span><span className="hero-stat-label">Users</span></div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-elements">
            {['🌐', '📱', '💻', '🚀', '⚡', '🎯'].map((icon, i) => <div key={i} className="float-item">{icon}</div>)}
          </div>
          <div className="hero-card">
            <div className="hero-card-header"><span className="dot"></span><span className="dot"></span><span className="dot"></span></div>
            <div className="hero-card-content">
              <div className="code-snippet-preview">
                <span className="keyword">const</span> <span className="function">DevMarket</span> = {'{'} <br />
                &nbsp;&nbsp;marketplace: <span className="string">'Amazing!'</span>,<br />
                &nbsp;&nbsp;community: <span className="string">'Global'</span><br />
                {'}'};
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {featuredListings.length > 0 && (
        <section className="recent-listings">
          <div className="section-header-with-link">
            <h2>Recent Listings</h2>
            <button onClick={() => navigate('/marketplace')} className="btn-text">View All →</button>
          </div>
          <div className="listings-grid">
            {featuredListings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================
// MARKETPLACE PAGE
// ============================================
function Marketplace() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [filters, setFilters] = useState({ search: '', category: 'all', sortBy: 'date', priceRange: 'all' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search');
    if (search) setFilters(prev => ({ ...prev, search }));
  }, []);

  const filteredListings = (state.listings || [])
    .filter(l => !filters.search || l.title?.toLowerCase().includes(filters.search.toLowerCase()) || l.description?.toLowerCase().includes(filters.search.toLowerCase()))
    .filter(l => filters.category === 'all' || l.category === filters.category)
    .filter(l => filters.priceRange === 'all' || (filters.priceRange === 'free' ? l.price?.toLowerCase().includes('free') : !l.price?.toLowerCase().includes('free')))
    .sort((a, b) => {
      if (filters.sortBy === 'price') return (a.price || '').localeCompare(b.price || '');
      if (filters.sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div className="marketplace-page">
      <div className="page-header">
        <h1>Website & Portfolio Marketplace</h1>
        <p>Discover and purchase amazing websites and portfolios</p>
        <button className="btn-primary" onClick={() => {
          if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to create a listing', type: 'warning', time: new Date().toLocaleTimeString(), read: false }}); return; }
          setShowForm(!showForm);
        }}>{showForm ? '❌ Cancel' : '📢 List Your Website'}</button>
      </div>

      <AdvancedSearch onFilterChange={setFilters} />
      {showForm && <ListingForm type="listing" onClose={() => setShowForm(false)} />}

      {loading ? <SkeletonGrid count={6} /> : (
        <div className="listings-grid">
          {filteredListings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          {filteredListings.length === 0 && (
            <div className="empty-state">
              <span className="empty-icon">🛒</span>
              <h3>No listings found</h3>
              {filters.search ? <p>Try different search terms</p> : <><p>Be the first to list a website!</p><button onClick={() => setShowForm(true)} className="btn-primary">Create First Listing</button></>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// ADVERTISE PAGE
// ============================================
function Advertise() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');

  const filteredApps = (state.apps || []).filter(a => {
    const matchesSearch = !search || a.appName?.toLowerCase().includes(search.toLowerCase()) || a.description?.toLowerCase().includes(search.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || a.platform?.toLowerCase() === filterPlatform.toLowerCase();
    return matchesSearch && matchesPlatform;
  });

  const platforms = [...new Set((state.apps || []).map(a => a.platform))];

  return (
    <div className="advertise-page">
      <div className="page-header">
        <h1>App & Software Advertising</h1>
        <p>Showcase your applications and reach potential users</p>
        <button className="btn-primary" onClick={() => {
          if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to advertise', type: 'warning', time: new Date().toLocaleTimeString(), read: false }}); return; }
          setShowForm(!showForm);
        }}>{showForm ? '❌ Cancel' : '📱 Advertise Your App'}</button>
      </div>

      {showForm && <ListingForm type="app" onClose={() => setShowForm(false)} />}

      <div className="filters-bar">
        <input type="text" placeholder="🔍 Search apps..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)} aria-label="Filter by platform">
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p?.toLowerCase()}>{p}</option>)}
        </select>
      </div>

      <div className="app-grid">
        {filteredApps.map(app => (
          <div key={app.id} className="app-card">
            <div className="app-header">
              <span className={`platform-badge ${app.platform?.toLowerCase() || ''}`}>{app.platform}</span>
              {app.price && <span className="price-badge">{app.price}</span>}
            </div>
            <h3>{app.appName}</h3>
            <p className="description">{app.description?.substring(0, 150)}{app.description?.length > 150 ? '...' : ''}</p>
            <div className="features-list">{app.features?.map((f, i) => <span key={i} className="feature-tag">✓ {f}</span>)}</div>
            <div className="app-meta"><span>⭐ {app.rating || 'New'}</span><span>⬇️ {app.downloads || 0}</span></div>
            <div className="developer-info">
              <span><img src={app.developerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.developer || 'Dev')}&background=667eea&color=fff&size=24`} alt={app.developer} style={{ width: 24, height: 24, borderRadius: '50%', marginRight: 8 }} />{app.developer}</span>
              <span>{app.date}</span>
            </div>
            {app.appUrl && <a href={app.appUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">🔗 Visit</a>}
          </div>
        ))}
        {filteredApps.length === 0 && (
          <div className="empty-state"><span className="empty-icon">📱</span><h3>No apps found</h3><button onClick={() => setShowForm(true)} className="btn-primary">Advertise Your App</button></div>
        )}
      </div>
    </div>
  );
}

// ============================================
// CODE SHARING PAGE
// ============================================
function CodeSharing() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');

  const filteredSnippets = (state.codeSnippets || []).filter(s => {
    const matchesSearch = !search || s.title?.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase());
    const matchesLanguage = filterLanguage === 'all' || s.language?.toLowerCase() === filterLanguage.toLowerCase();
    return matchesSearch && matchesLanguage;
  });

  const languages = [...new Set((state.codeSnippets || []).map(s => s.language))];

  return (
    <div className="code-sharing-page">
      <div className="page-header">
        <h1>Code Sharing Community</h1>
        <p>Share your code, learn from others, and grow together</p>
        <button className="btn-primary" onClick={() => {
          if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to share code', type: 'warning', time: new Date().toLocaleTimeString(), read: false }}); return; }
          setShowForm(!showForm);
        }}>{showForm ? '❌ Cancel' : '💻 Share Code'}</button>
      </div>

      {showForm && <ListingForm type="code" onClose={() => setShowForm(false)} />}

      <div className="filters-bar">
        <input type="text" placeholder="🔍 Search snippets..." value={search} onChange={e => setSearch(e.target.value)} className="search-input" />
        <select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)} aria-label="Filter by language">
          <option value="all">All Languages</option>
          {languages.map(l => <option key={l} value={l?.toLowerCase()}>{l}</option>)}
        </select>
      </div>

      <div className="code-grid">
        {filteredSnippets.map(s => (
          <div key={s.id} className="code-card">
            <div className="code-header"><div><h3>{s.title}</h3><span className="language-badge">{s.language}</span></div></div>
            <p className="description">{s.description}</p>
            <pre className="code-preview"><code>{s.code?.substring(0, 200)}{s.code?.length > 200 ? '...' : ''}</code></pre>
            <div className="tags-container">{s.tags?.map((t, i) => <span key={i} className="tag">#{t}</span>)}</div>
            <div className="code-footer">
              <div className="author-info">
                <span><img src={s.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.author || 'Dev')}&background=667eea&color=fff&size=20`} alt={s.author} style={{ width: 20, height: 20, borderRadius: '50%', marginRight: 4 }} />{s.author}</span>
                <span>{s.date}</span>
              </div>
              <div className="code-actions"><button onClick={() => { navigator.clipboard.writeText(s.code); }} className="btn-copy">📋 Copy</button></div>
            </div>
          </div>
        ))}
        {filteredSnippets.length === 0 && (
          <div className="empty-state"><span className="empty-icon">💻</span><h3>No snippets found</h3><button onClick={() => setShowForm(true)} className="btn-primary">Share Your Code</button></div>
        )}
      </div>
    </div>
  );
}

// ============================================
// MESSAGES PAGE
// ============================================
function Messages() {
  const { state, dispatch } = useAppContext();
  useRealtimeMessages();

  if (!state.currentUser) return (
    <div className="messages-page"><div className="empty-state"><span className="empty-icon">📧</span><h2>Messages</h2><p>Please login to view messages</p></div></div>
  );

  return (
    <div className="messages-page">
      <div className="page-header">
        <h1>💬 Messages</h1>
        <p>Your conversations and inquiries</p>
        {state.realtimeConnected && <span className="live-badge">🟢 Live</span>}
      </div>
      <div className="messages-layout">
        <ConversationList conversations={state.conversations || []} activeConv={state.activeConversation} onSelect={(c) => dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: c })} />
        <ChatArea conversation={state.activeConversation} />
      </div>
    </div>
  );
}

// ============================================
// PROFILE PAGE
// ============================================
function Profile() {
  const { state, dispatch } = useAppContext();
  
  if (!state.currentUser) return (
    <div className="profile-page"><div className="empty-state"><span className="empty-icon">👤</span><h2>Profile</h2><p>Please login to view your profile</p></div></div>
  );

  const userName = state.profile?.name || state.currentUser.email;
  const userListings = (state.listings || []).filter(l => l.user_id === state.currentUser.id);
  const userSnippets = (state.codeSnippets || []).filter(s => s.user_id === state.currentUser.id);

  const handleAvatarUpdate = async (avatarUrl) => {
    dispatch({ type: 'UPDATE_AVATAR', payload: avatarUrl });
    try { await supabase.from('profiles').upsert({ id: state.currentUser.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() }); } catch (error) { console.error('Error saving avatar:', error); }
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Profile picture updated!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <AvatarUpload currentAvatar={state.profile?.avatar_url} userName={userName} onAvatarUpdate={handleAvatarUpdate} />
        <div>
          <h1>{userName}</h1>
          <p>{state.currentUser.email}</p>
          {state.profile?.role && <p>Role: {state.profile.role}</p>}
          {state.profile?.bio && <p>{state.profile.bio}</p>}
          {state.profile?.website && <p>🌐 <a href={state.profile.website} target="_blank" rel="noopener noreferrer">{state.profile.website}</a></p>}
        </div>
      </div>
      <div className="profile-stats">
        <div className="stat-box"><h3>{userListings.length}</h3><p>Active Listings</p></div>
        <div className="stat-box"><h3>{userSnippets.length}</h3><p>Code Snippets</p></div>
      </div>
      {userListings.length > 0 && (
        <div className="profile-section"><h2>Your Listings</h2><div className="listings-grid">{userListings.map(l => <ListingCard key={l.id} listing={l} />)}</div></div>
      )}
    </div>
  );
}

// ============================================
// FAVORITES PAGE
// ============================================
function Favorites() {
  const { state } = useAppContext();
  return (
    <div className="favorites-page">
      <div className="page-header"><h1>⭐ My Favorites</h1><p>Your saved listings</p></div>
      {!state.currentUser ? <div className="empty-state"><span className="empty-icon">🔒</span><h3>Please login to view</h3></div> :
       (state.favorites || []).length === 0 ? <div className="empty-state"><span className="empty-icon">⭐</span><h3>No favorites yet</h3><p>Start browsing and save items!</p></div> :
       <div className="listings-grid">{(state.favorites || []).map(item => <ListingCard key={item.id} listing={item} />)}</div>}
    </div>
  );
}

// ============================================
// SETTINGS PAGE
// ============================================
function Settings() {
  const { state, dispatch } = useAppContext();
  
  if (!state.currentUser) return (
    <div className="settings-page"><div className="empty-state"><span className="empty-icon">⚙️</span><h2>Settings</h2><p>Please login to access settings</p></div></div>
  );

  return (
    <div className="settings-page">
      <div className="page-header"><h1>⚙️ Settings</h1><p>Manage your account and preferences</p></div>
      <div className="settings-container">
        <div className="settings-sidebar">
          <button className="settings-nav-btn active"><span>👤</span> Profile</button>
          <button className="settings-nav-btn"><span>🎨</span> Appearance</button>
        </div>
        <div className="settings-content">
          <h3>Appearance</h3>
          <p>Choose between light and dark theme</p>
          <button onClick={() => dispatch({ type: 'TOGGLE_THEME' })} className="btn-secondary">
            {state.theme === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
          </button>
          <p style={{ marginTop: 16, color: 'var(--gray-500)' }}>Current theme: <strong>{state.theme === 'light' ? '☀️ Light' : '🌙 Dark'}</strong></p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FOOTER
// ============================================
function Footer() {
  const currentYear = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section"><h3>🚀 DevMarket</h3><p>The ultimate marketplace for developers.</p></div>
        <div className="footer-section"><h4>Quick Links</h4><Link to="/marketplace">Marketplace</Link><Link to="/advertise">Advertise</Link><Link to="/code-sharing">Code Sharing</Link></div>
        <div className="footer-section"><h4>Community</h4><a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a><a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a></div>
        <div className="footer-section"><h4>Support</h4><a href="mailto:support@devmarket.com">Contact Us</a></div>
      </div>
      <div className="footer-bottom"><p>&copy; {currentYear} DevMarket. Built with React & Supabase ❤️</p></div>
    </footer>
  );
}

// ============================================
// MAIN APP CONTENT
// ============================================
function AppContent() {
  const { state, dispatch } = useAppContext();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasShownLoader, setHasShownLoader] = useState(false);

  useEffect(() => { if (sessionStorage.getItem('devMarketLoaderShown')) setHasShownLoader(true); }, []);
  useEffect(() => {
    if (state.initialized) {
      if (!hasShownLoader) { sessionStorage.setItem('devMarketLoaderShown', 'true'); setTimeout(() => setIsInitialLoading(false), 800); }
      else setIsInitialLoading(false);
    }
    const safetyTimeout = setTimeout(() => setIsInitialLoading(false), 6000);
    return () => clearTimeout(safetyTimeout);
  }, [state.initialized, hasShownLoader]);

  const removeNotification = useCallback((id) => dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }), [dispatch]);

  if (isInitialLoading && !hasShownLoader) return <DevMarketLoader />;
  if (isInitialLoading && hasShownLoader) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '3rem', animation: 'spin 1s linear infinite' }}>🚀</div>
      <p style={{ color: 'var(--gray-500)' }}>Loading...</p>
    </div>
  );

  return (
    <Router>
      <div className={`App ${state.theme}`}>
        <div className="toast-container">{(state.notifications || []).filter(n => !n.read).slice(0, 3).map(n => <Toast key={n.id} notification={n} onClose={removeNotification} />)}</div>
        <Header />
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/marketplace" element={<Marketplace />} />
            <Route path="/advertise" element={<Advertise />} />
            <Route path="/code-sharing" element={<CodeSharing />} />
            <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          </Routes>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

// ============================================
// EXPORT
// ============================================
export default function App() {
  return <AppProvider><AppContent /></AppProvider>;
}