// App.js - Complete Fixed Version with DevMarket Loader & Single Sign-In Button
import React, { useState, useEffect, createContext, useContext, useReducer, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabase';
import './App.css';

// Context for global state
const AppContext = createContext();

const initialState = {
  listings: [],
  apps: [],
  codeSnippets: [],
  currentUser: null,
  profile: null,
  session: null,
  notifications: [],
  messages: [],
  favorites: [],
  searchHistory: [],
  theme: 'light',
  authError: null,
  loading: true,
  initialized: false,
  dataLoaded: false
};

function appReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZED': 
      return { ...state, initialized: true, loading: false };
    case 'SET_LOADING': 
      return { ...state, loading: action.payload };
    case 'SET_DATA_LOADED':
      return { ...state, dataLoaded: action.payload };
    case 'SET_SESSION': 
      return { ...state, session: action.payload };
    case 'SET_USER': 
      return { ...state, currentUser: action.payload };
    case 'SET_PROFILE': 
      return { ...state, profile: action.payload };
    case 'UPDATE_PROFILE': 
      return { ...state, profile: { ...state.profile, ...action.payload } };
    case 'SET_LISTINGS': 
      return { ...state, listings: action.payload || [] };
    case 'ADD_LISTING': 
      return { ...state, listings: [action.payload, ...(state.listings || [])] };
    case 'UPDATE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l) };
    case 'DELETE_LISTING': 
      return { ...state, listings: (state.listings || []).filter(l => l.id !== action.payload) };
    case 'SET_APPS': 
      return { ...state, apps: action.payload || [] };
    case 'ADD_APP': 
      return { ...state, apps: [action.payload, ...(state.apps || [])] };
    case 'SET_CODE_SNIPPETS': 
      return { ...state, codeSnippets: action.payload || [] };
    case 'ADD_CODE_SNIPPET': 
      return { ...state, codeSnippets: [action.payload, ...(state.codeSnippets || [])] };
    case 'LIKE_SNIPPET': 
      return { ...state, codeSnippets: (state.codeSnippets || []).map(s => s.id === action.payload.id ? { ...s, likes: action.payload.likes, likedBy: action.payload.likedBy } : s) };
    case 'SET_NOTIFICATIONS': 
      return { ...state, notifications: action.payload || [] };
    case 'ADD_NOTIFICATION': 
      return { ...state, notifications: [{...action.payload, id: Date.now() + Math.random()}, ...(state.notifications || [])].slice(0, 50) };
    case 'REMOVE_NOTIFICATION': 
      return { ...state, notifications: (state.notifications || []).filter(n => n.id !== action.payload) };
    case 'CLEAR_NOTIFICATIONS': 
      return { ...state, notifications: [] };
    case 'MARK_NOTIFICATIONS_READ': 
      return { ...state, notifications: (state.notifications || []).map(n => ({ ...n, read: true })) };
    case 'SET_MESSAGES': 
      return { ...state, messages: action.payload || [] };
    case 'ADD_MESSAGE': 
      return { ...state, messages: [action.payload, ...(state.messages || [])] };
    case 'MARK_MESSAGE_READ': 
      return { ...state, messages: (state.messages || []).map(m => m.id === action.payload ? { ...m, read: true } : m) };
    case 'DELETE_MESSAGE': 
      return { ...state, messages: (state.messages || []).filter(m => m.id !== action.payload) };
    case 'SET_FAVORITES': 
      return { ...state, favorites: action.payload || [] };
    case 'TOGGLE_FAVORITE': {
      const favExists = (state.favorites || []).find(f => f.id === action.payload.id);
      return { ...state, favorites: favExists ? (state.favorites || []).filter(f => f.id !== action.payload.id) : [...(state.favorites || []), action.payload] };
    }
    case 'SET_AUTH_ERROR': 
      return { ...state, authError: action.payload };
    case 'LOGOUT': 
      return { ...state, currentUser: null, profile: null, session: null, notifications: [], messages: [], favorites: [] };
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('devMarketTheme', newTheme);
      return { ...state, theme: newTheme };
    }
    default: 
      return state;
  }
}

// ============================================
// DEVMARKET LOADER COMPONENT
// ============================================
function DevMarketLoader() {
  const [progress, setProgress] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [dots, setDots] = useState([true, false, false]);

  const steps = [
    { icon: '🔌', label: 'Connecting to Supabase...' },
    { icon: '📡', label: 'Loading marketplace data...' },
    { icon: '🚀', label: 'Preparing DevMarket...' }
  ];

  useEffect(() => {
    // Animate progress bar
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        return prev + Math.random() * 15;
      });
    }, 400);

    // Rotate through steps
    const stepInterval = setInterval(() => {
      setActiveStep(prev => {
        if (prev < steps.length - 1) return prev + 1;
        return prev;
      });
    }, 1500);

    // Animate dots
    const dotsInterval = setInterval(() => {
      setDots(prev => {
        const nextIndex = prev.findIndex(d => d) + 1;
        if (nextIndex >= prev.length) return [true, false, false];
        return prev.map((_, i) => i === nextIndex);
      });
    }, 500);

    return () => {
      clearInterval(progressInterval);
      clearInterval(stepInterval);
      clearInterval(dotsInterval);
    };
  }, [steps.length]);

  return (
    <div className="dm-loader">
      {/* Animated grid background */}
      <div className="dm-loader__grid">
        {Array.from({ length: 64 }).map((_, i) => (
          <div key={i} className="dm-loader__cell" style={{ animationDelay: `${Math.random() * 3}s` }} />
        ))}
      </div>

      {/* Floating code tokens */}
      <div className="dm-loader__tokens">
        {['const', 'function', 'import', 'export', 'async', 'await', 'return', 'class', 'interface', 'type'].map((token, i) => (
          <span key={i} className="dm-loader__token">{token}</span>
        ))}
      </div>

      {/* Center card */}
      <div className="dm-loader__card">
        {/* Logo with orbiting rings */}
        <div className="dm-loader__logo-wrap">
          <span className="dm-loader__logo-icon">🚀</span>
          <div className="dm-loader__orbit">
            <div className="dm-loader__orbit-dot" />
          </div>
          <div className="dm-loader__orbit dm-loader__orbit--2">
            <div className="dm-loader__orbit-dot--2" />
          </div>
        </div>

        {/* Brand text */}
        <div className="dm-loader__brand">
          <span className="dm-loader__brand-dev">Dev</span>
          <span className="dm-loader__brand-market">Market</span>
        </div>
        <p className="dm-loader__tagline">IT Marketplace Hub</p>

        {/* Progress bar */}
        <div className="dm-loader__bar-track">
          <div 
            className="dm-loader__bar-fill" 
            style={{ width: `${Math.min(progress, 100)}%` }} 
          />
        </div>

        {/* Step indicators */}
        <div className="dm-loader__steps">
          {steps.map((step, i) => (
            <div 
              key={i} 
              className={`dm-loader__step ${
                i < activeStep ? 'dm-loader__step--done' : 
                i === activeStep ? 'dm-loader__step--active' : ''
              }`}
            >
              <span className="dm-loader__step-icon">
                {i < activeStep ? '✓' : step.icon}
              </span>
              <span className="dm-loader__step-label">{step.label}</span>
            </div>
          ))}
        </div>

        {/* Pulsing dots */}
        <div className="dm-loader__dots">
          {dots.map((isOn, i) => (
            <div 
              key={i} 
              className={`dm-loader__dot ${isOn ? 'dm-loader__dot--on' : ''}`} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================
// TOAST COMPONENT
// ============================================
function Toast({ notification, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const getIcon = (type) => {
    switch(type) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📢';
    }
  };

  return (
    <div className={`toast toast-${notification.type || 'info'}`}>
      <div className="toast-content">
        <span className="toast-icon">{getIcon(notification.type)}</span>
        <div className="toast-body">
          <p className="toast-message">{notification.message}</p>
          <span className="toast-time">{notification.time || new Date().toLocaleTimeString()}</span>
        </div>
      </div>
      <button className="toast-close" onClick={() => onClose(notification.id)}>×</button>
    </div>
  );
}

// ============================================
// CONFIRMATION DIALOG
// ============================================
function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText, type }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{type === 'danger' ? '⚠️' : type === 'success' ? '✅' : 'ℹ️'}</div>
        <h3 style={{ marginBottom: '8px', color: 'var(--gray-800)' }}>{title || 'Confirm'}</h3>
        <p style={{ color: 'var(--gray-500)', marginBottom: '24px', lineHeight: '1.6' }}>{message || 'Are you sure?'}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button 
            className="btn-primary" 
            onClick={onConfirm} 
            style={{ background: type === 'danger' ? 'var(--danger)' : 'var(--primary)' }}
          >
            {confirmText || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN APP WITH FIXED SUPABASE INTEGRATION
// ============================================
function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  // Load all public data from Supabase
  async function loadPublicData() {
    try {
      console.log('Loading public data from Supabase...');
      
      const [listingsResult, appsResult, snippetsResult] = await Promise.all([
        supabase.from('listings').select('*').order('created_at', { ascending: false }),
        supabase.from('apps').select('*').order('created_at', { ascending: false }),
        supabase.from('code_snippets').select('*').order('created_at', { ascending: false })
      ]);

      if (listingsResult.data) {
        const formattedListings = listingsResult.data.map(item => ({
          ...item,
          seller: item.seller_name,
          sellerAvatar: item.seller_avatar,
          imageUrl: item.image_url,
          date: new Date(item.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_LISTINGS', payload: formattedListings });
      }

      if (appsResult.data) {
        const formattedApps = appsResult.data.map(item => ({
          ...item,
          appName: item.app_name,
          appUrl: item.app_url,
          developer: item.developer_name,
          developerAvatar: item.developer_avatar,
          date: new Date(item.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_APPS', payload: formattedApps });
      }

      if (snippetsResult.data) {
        const formattedSnippets = snippetsResult.data.map(item => ({
          ...item,
          author: item.author_name,
          authorAvatar: item.author_avatar,
          likedBy: item.liked_by || [],
          date: new Date(item.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_CODE_SNIPPETS', payload: formattedSnippets });
      }

      dispatch({ type: 'SET_DATA_LOADED', payload: true });
      console.log('Public data loaded successfully');
    } catch (error) {
      console.error('Error loading public data:', error);
      dispatch({ type: 'SET_LISTINGS', payload: [] });
      dispatch({ type: 'SET_APPS', payload: [] });
      dispatch({ type: 'SET_CODE_SNIPPETS', payload: [] });
      dispatch({ type: 'SET_DATA_LOADED', payload: true });
    }
  }

  // Load user profile from Supabase
  async function loadProfile(user) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profile) {
        dispatch({ type: 'SET_PROFILE', payload: profile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...profile } });
      } else {
        const meta = user.user_metadata || {};
        const defaultProfile = {
          id: user.id,
          name: meta.name || meta.full_name || user.email?.split('@')[0] || 'User',
          email: user.email,
          role: meta.role || 'developer',
          bio: '',
          website: '',
          github: '',
          twitter: '',
          avatar_url: meta.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.name || user.email?.split('@')[0] || 'User')}&background=667eea&color=fff`
        };

        try {
          await supabase.from('profiles').upsert({ 
            ...defaultProfile, 
            updated_at: new Date().toISOString() 
          });
        } catch (err) {
          console.log('Could not save profile to Supabase:', err);
        }

        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...defaultProfile } });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const fallback = {
        id: user.id,
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
        email: user.email,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.name || 'User')}&background=667eea&color=fff`
      };
      dispatch({ type: 'SET_PROFILE', payload: fallback });
      dispatch({ type: 'SET_USER', payload: { ...user, ...fallback } });
    }
  }

  // Load user-specific data from Supabase
  async function loadUserData(userId) {
    try {
      const [notifsResult, msgsResult, favsResult] = await Promise.all([
        supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('messages').select('*').or(`from_user.eq.${userId},to_user.eq.${userId}`).order('created_at', { ascending: false }),
        supabase.from('favorites').select('*, listing:listing_id (*)').eq('user_id', userId)
      ]);

      if (notifsResult.data) {
        dispatch({ type: 'SET_NOTIFICATIONS', payload: notifsResult.data.map(n => ({
          ...n,
          read: n.read || false
        })) });
      }

      if (msgsResult.data) {
        dispatch({ type: 'SET_MESSAGES', payload: msgsResult.data });
      }

      if (favsResult.data) {
        const favorites = favsResult.data
          .map(f => f.listing)
          .filter(Boolean)
          .map(l => ({
            ...l,
            seller: l.seller_name,
            sellerAvatar: l.seller_avatar,
            imageUrl: l.image_url,
            date: new Date(l.created_at).toLocaleDateString()
          }));
        dispatch({ type: 'SET_FAVORITES', payload: favorites });
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  // Initialize the app
  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        // Get current session
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          dispatch({ type: 'SET_SESSION', payload: session });
          
          if (session?.user) {
            await loadProfile(session.user);
            await loadUserData(session.user.id);
          }
        }

        // Always load public data
        await loadPublicData();
        
        if (mounted) {
          dispatch({ type: 'INITIALIZED' });
          // Hide loader after a short delay for smooth transition
          setTimeout(() => {
            setIsInitialLoading(false);
          }, 800);
        }
      } catch (error) {
        console.error('Init error:', error);
        if (mounted) {
          dispatch({ type: 'INITIALIZED' });
          setTimeout(() => {
            setIsInitialLoading(false);
          }, 800);
        }
      }

      // Listen for auth state changes
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (mounted) {
          dispatch({ type: 'SET_SESSION', payload: session });
          
          if (event === 'SIGNED_IN' && session?.user) {
            dispatch({ type: 'SET_USER', payload: session.user });
            await loadProfile(session.user);
            await loadUserData(session.user.id);
            await loadPublicData();
          } else if (event === 'SIGNED_OUT') {
            dispatch({ type: 'LOGOUT' });
            await loadPublicData();
          }
        }
      });

      return () => {
        mounted = false;
        subscription?.unsubscribe();
      };
    }

    initialize();
    // eslint-disable-next-line
  }, []);

  // Load theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem('devMarketTheme');
    if (savedTheme && savedTheme !== state.theme) {
      dispatch({ type: 'TOGGLE_THEME' });
    }
    // eslint-disable-next-line
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  // Show loader during initial loading
  if (isInitialLoading || (!state.initialized && state.loading)) {
    return <DevMarketLoader />;
  }

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <Router>
        <div className={`App ${state.theme}`}>
          <div className="toast-container">
            {(state.notifications || []).filter(n => !n.read).slice(0, 3).map(n => (
              <Toast key={n.id} notification={n} onClose={removeNotification} />
            ))}
          </div>
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
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AppContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { state } = useAppContext();
  const location = useLocation();
  if (!state.currentUser) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return children;
}

function useAppContext() {
  return useContext(AppContext);
}

// ============================================
// HEADER COMPONENT (FIXED - Single Sign In Button)
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
  const unreadMessages = (state.messages || []).filter(m => !m.read).length;

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
  const userAvatar = state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=667eea&color=fff`;

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
              </>
            )}
            {/* REMOVED: Mobile auth section with duplicate sign-in button */}
          </nav>

          <div className="header-actions">
            <button className="icon-button search-button" onClick={() => setShowSearch(!showSearch)} title="Search" aria-label="Search">
              🔍
            </button>
            
            {showSearch && (
              <>
                <div className="overlay-backdrop" onClick={() => setShowSearch(false)} />
                <div className="search-overlay">
                  <form onSubmit={handleSearch} className="search-form">
                    <input 
                      type="text" 
                      placeholder="Search marketplace, apps, code..." 
                      value={searchQuery} 
                      onChange={e => setSearchQuery(e.target.value)} 
                      className="search-input-header" 
                      autoFocus 
                    />
                    <button type="submit" className="btn-search">Search</button>
                    <button type="button" className="btn-close-search" onClick={() => setShowSearch(false)}>✕</button>
                  </form>
                </div>
              </>
            )}
            
            {state.currentUser ? (
              <>
                <button 
                  className="icon-button notification-bell" 
                  onClick={() => setShowNotifications(!showNotifications)} 
                  title="Notifications" 
                  aria-label="Notifications"
                >
                  🔔
                  {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications}</span>}
                </button>
                
                <div className="user-menu">
                  <div className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                    <img 
                      src={userAvatar} 
                      alt={userDisplayName} 
                      className="user-avatar" 
                      onError={(e) => { 
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=667eea&color=fff`; 
                      }} 
                    />
                    <span className="user-name">{userDisplayName}</span>
                    <span className="dropdown-arrow">▾</span>
                  </div>
                  {showUserMenu && (
                    <div className="dropdown-menu">
                      <div className="dropdown-header">
                        <img src={userAvatar} alt={userDisplayName} className="dropdown-avatar" />
                        <div>
                          <strong>{userDisplayName}</strong>
                          <p>{state.currentUser.email}</p>
                        </div>
                      </div>
                      <div className="dropdown-divider"></div>
                      <Link to="/profile" onClick={() => setShowUserMenu(false)}>
                        <span>👤</span> My Profile
                      </Link>
                      <Link to="/settings" onClick={() => setShowUserMenu(false)}>
                        <span>⚙️</span> Settings
                      </Link>
                      <div className="dropdown-divider"></div>
                      <button onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}>
                        <span>🚪</span> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              /* ONLY ONE SIGN IN BUTTON - Desktop only */
              <button className="btn-login" onClick={() => setShowAuth(true)}>
                👤 Sign In
              </button>
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
                  <button className="btn-text" onClick={() => dispatch({ type: 'MARK_NOTIFICATIONS_READ' })}>
                    Mark all read
                  </button>
                  <button className="btn-text" onClick={() => { dispatch({ type: 'CLEAR_NOTIFICATIONS' }); setShowNotifications(false); }}>
                    Clear All
                  </button>
                </div>
              </div>
              <div className="notifications-list">
                {(state.notifications || []).length === 0 ? (
                  <div className="empty-notifications">
                    <span>🔔</span>
                    <p>No notifications yet</p>
                  </div>
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
                      <button 
                        className="btn-remove-notification" 
                        onClick={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: notif.id })}
                      >
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        {showAuth && <AuthModal setShowAuth={setShowAuth} authMode={authMode} setAuthMode={setAuthMode} />}
      </header>
      <ConfirmDialog 
        isOpen={showLogoutConfirm} 
        title="Confirm Logout" 
        message="Are you sure you want to logout? Any unsaved changes will be lost." 
        onConfirm={handleLogout} 
        onCancel={() => setShowLogoutConfirm(false)} 
        confirmText="Logout" 
        type="danger" 
      />
    </>
  );
}

// ============================================
// AUTH MODAL
// ============================================
function AuthModal({ setShowAuth, authMode, setAuthMode }) {
  const { state, dispatch } = useAppContext();
  const [formData, setFormData] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    confirmPassword: '', 
    role: 'developer' 
  });
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
    resetForm();
    return () => document.body.classList.remove('modal-open');
    // eslint-disable-next-line
  }, [authMode]);

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
      if (!formData.name.trim()) {
        newErrors.name = 'Full name is required';
      } else if (formData.name.trim().length < 2) {
        newErrors.name = 'Name must be at least 2 characters';
      }
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (authMode === 'signup' && step === 2) {
      if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (!formData.role) {
        newErrors.role = 'Please select your role';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    if (authMode === 'signup' && step === 1) {
      setStep(2);
      return;
    }
    
    setLoading(true);
    setAuthStatus('');
    dispatch({ type: 'SET_AUTH_ERROR', payload: null });
    
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              name: formData.name,
              role: formData.role
            }
          }
        });
        
        if (error) {
          dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
          setLoading(false);
          return;
        }
        
        setShowSuccess(true);
        
        if (data.session) {
          setAuthStatus('success');
          dispatch({ type: 'ADD_NOTIFICATION', payload: { 
            message: `🎉 Welcome to DevMarket, ${formData.name}!`, 
            type: 'success', 
            time: new Date().toLocaleTimeString(), 
            read: false 
          }});
          setTimeout(() => {
            setShowAuth(false);
            navigate('/profile');
          }, 2000);
        } else {
          setAuthStatus('confirmation');
          dispatch({ type: 'ADD_NOTIFICATION', payload: { 
            message: '📧 Please check your email to confirm your account.', 
            type: 'info', 
            time: new Date().toLocaleTimeString(), 
            read: false 
          }});
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password
        });
        
        if (error) {
          let msg = error.message;
          if (error.message.includes('Invalid login')) {
            msg = 'Invalid email or password. Please try again.';
          } else if (error.message.includes('Email not confirmed')) {
            msg = 'Please confirm your email first.';
          }
          dispatch({ type: 'SET_AUTH_ERROR', payload: msg });
          setLoading(false);
          return;
        }
        
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: '👋 Welcome back!', 
          type: 'success', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
        setShowAuth(false);
      }
    } catch (error) {
      dispatch({ type: 'SET_AUTH_ERROR', payload: 'An unexpected error occurred' });
    }
    
    setLoading(false);
  };

  const handleSocialLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: window.location.origin
        }
      });
      
      if (error) {
        dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login is not configured. Please check Supabase settings.` });
      }
    } catch (error) {
      dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login is not available.` });
    }
  };

  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setShowAuth(false);
    };
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
              {authStatus === 'confirmation' 
                ? `We've sent a confirmation link to ${formData.email}.` 
                : 'Your account has been created successfully!'
              }
            </div>
            <div className="success-features">
              <div className="feature-item"><span>🛒</span> Marketplace</div>
              <div className="feature-item"><span>💻</span> Share Code</div>
              <div className="feature-item"><span>📱</span> Advertise Apps</div>
            </div>
            {authStatus === 'success' && (
              <p className="redirect-message">Redirecting to your profile...</p>
            )}
            {authStatus === 'confirmation' && (
              <button 
                className="btn-primary" 
                onClick={() => { setShowSuccess(false); setAuthMode('login'); resetForm(); }} 
                style={{ marginTop: '16px' }}
              >
                Go to Login
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="auth-header">
              <div className="auth-logo-container">
                <span className="auth-logo">🚀</span>
                <div className="auth-logo-ring"></div>
              </div>
              <h2>{authMode === 'login' ? 'Welcome Back!' : 'Join DevMarket'}</h2>
              <p>{authMode === 'login' ? 'Sign in to access your account' : 'Create your free account'}</p>
            </div>

            <div className="social-login">
              <button className="social-btn google" type="button" onClick={() => handleSocialLogin('google')} title="Sign in with Google">
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#4285f4' }}>G</span> Google
              </button>
              <button className="social-btn facebook" type="button" onClick={() => handleSocialLogin('facebook')} title="Sign in with Facebook" style={{ background: '#1877f2', color: 'white', border: 'none' }}>
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>f</span> Facebook
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

            {state.authError && (
              <div className="auth-error">
                <span>⚠️</span> {state.authError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              {authMode === 'signup' && (
                <div className="step-indicator">
                  <div className={`step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
                    {step > 1 ? '✓' : '1'}
                  </div>
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
                        <input
                          id="name"
                          type="text"
                          placeholder="John Doe"
                          value={formData.name}
                          onChange={e => {
                            setFormData({ ...formData, name: e.target.value });
                            if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                          }}
                          className={errors.name ? 'error' : ''}
                          autoFocus
                        />
                      </div>
                      {errors.name && <span className="error-message">⚠️ {errors.name}</span>}
                    </div>
                  )}
                  <div className="form-group">
                    <label htmlFor="email">Email Address</label>
                    <div className="input-wrapper">
                      <span className="input-icon">📧</span>
                      <input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={formData.email}
                        onChange={e => {
                          setFormData({ ...formData, email: e.target.value });
                          if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                          dispatch({ type: 'SET_AUTH_ERROR', payload: null });
                        }}
                        className={errors.email ? 'error' : ''}
                        autoFocus={authMode === 'login'}
                      />
                    </div>
                    {errors.email && <span className="error-message">⚠️ {errors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder={authMode === 'login' ? 'Enter your password' : 'Create a password (min 6 characters)'}
                        value={formData.password}
                        onChange={e => {
                          setFormData({ ...formData, password: e.target.value });
                          if (errors.password) setErrors(prev => ({ ...prev, password: '' }));
                        }}
                        className={errors.password ? 'error' : ''}
                      />
                      <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                        {showPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {errors.password && <span className="error-message">⚠️ {errors.password}</span>}
                    {authMode === 'signup' && formData.password && (
                      <div className="password-strength">
                        <div className="strength-bars">
                          {[1, 2, 3, 4].map(level => (
                            <div key={level} className={`strength-bar ${passwordStrength >= level ? `active level-${passwordStrength}` : ''}`} />
                          ))}
                        </div>
                        <span className="strength-text">
                          {['Very weak', 'Weak', 'Fair', 'Good', 'Strong'][passwordStrength] || 'Very weak'}
                        </span>
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
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Confirm your password"
                        value={formData.confirmPassword}
                        onChange={e => {
                          setFormData({ ...formData, confirmPassword: e.target.value });
                          if (errors.confirmPassword) setErrors(prev => ({ ...prev, confirmPassword: '' }));
                        }}
                        className={errors.confirmPassword ? 'error' : ''}
                      />
                      <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} tabIndex={-1}>
                        {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                    {errors.confirmPassword && <span className="error-message">⚠️ {errors.confirmPassword}</span>}
                  </div>
                  <div className="form-group">
                    <label>I am a...</label>
                    <div className="role-selector">
                      {[
                        { role: 'developer', icon: '👨‍💻', label: 'Developer' },
                        { role: 'designer', icon: '🎨', label: 'Designer' },
                        { role: 'entrepreneur', icon: '💼', label: 'Entrepreneur' },
                        { role: 'student', icon: '📚', label: 'Student' }
                      ].map(r => (
                        <button
                          key={r.role}
                          type="button"
                          className={`role-option ${formData.role === r.role ? 'active' : ''}`}
                          onClick={() => setFormData({ ...formData, role: r.role })}
                        >
                          <span>{r.icon}</span>
                          <span>{r.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <button type="button" className="btn-secondary btn-full" onClick={() => setStep(1)}>
                    ← Back
                  </button>
                </>
              )}

              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? (
                  <>
                    <span className="loading-spinner"></span>
                    {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
                  </>
                ) : (
                  authMode === 'signup' && step === 1 ? 'Continue →' : authMode === 'login' ? '🚀 Sign In' : '🎉 Create Account'
                )}
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
// HOME COMPONENT
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
          <div className="hero-badge">
            {state.currentUser ? `👋 Welcome, ${state.profile?.name || 'Developer'}!` : '🎉 New: Code Sharing Community!'}
          </div>
          <h1>Where Developers <span className="text-gradient">Trade & Share</span></h1>
          <p>Buy and sell websites, showcase your apps, and share code with thousands of developers worldwide.</p>
          <div className="hero-buttons">
            <button onClick={() => navigate('/marketplace')} className="btn-primary btn-large">🛒 Browse Marketplace</button>
            <button onClick={() => navigate('/code-sharing')} className="btn-secondary btn-large">💻 Share Code</button>
          </div>
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.listings}+</span>
              <span className="hero-stat-label">Listings</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.apps}+</span>
              <span className="hero-stat-label">Apps</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.snippets}+</span>
              <span className="hero-stat-label">Snippets</span>
            </div>
            <div className="hero-stat">
              <span className="hero-stat-value">{stats.users}+</span>
              <span className="hero-stat-label">Users</span>
            </div>
          </div>
        </div>
        <div className="hero-visual">
          <div className="floating-elements">
            {['🌐', '📱', '💻', '🚀', '⚡', '🎯'].map((icon, i) => (
              <div key={i} className="float-item">{icon}</div>
            ))}
          </div>
          <div className="hero-card">
            <div className="hero-card-header">
              <span className="dot"></span>
              <span className="dot"></span>
              <span className="dot"></span>
            </div>
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
            {featuredListings.map(listing => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================
// LISTING CARD COMPONENT (FIXED - No contact column)
// ============================================
function ListingCard({ listing }) {
  const { state, dispatch } = useAppContext();
  const [showContact, setShowContact] = useState(false);
  const [message, setMessage] = useState('');
  const isFavorited = (state.favorites || []).some(f => f.id === listing.id);

  const handleContact = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to contact sellers', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    if (showContact && message.trim()) {
      try {
        // FIXED: Removed contact and to_email fields that don't exist in the schema
        await supabase.from('messages').insert([{
          from_user: state.currentUser.id,
          to_user: listing.user_id,
          subject: `Inquiry about ${listing.title}`,
          message: message,
          listing_id: listing.id,
          read: false,
          created_at: new Date().toISOString()
        }]);
        
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: `Message sent about "${listing.title}"`, 
          type: 'success', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
      } catch (error) {
        console.error('Error sending message:', error);
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: 'Failed to send message. Please try again.', 
          type: 'error', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
      }
      setShowContact(false);
      setMessage('');
    } else {
      setShowContact(!showContact);
    }
  };

  const toggleFavorite = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to save favorites', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    dispatch({ type: 'TOGGLE_FAVORITE', payload: listing });
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: isFavorited ? 'Removed from favorites' : 'Added to favorites', 
      type: 'info', 
      time: new Date().toLocaleTimeString(), 
      read: false 
    }});
    
    try {
      if (isFavorited) {
        await supabase.from('favorites').delete().eq('user_id', state.currentUser.id).eq('listing_id', listing.id);
      } else {
        await supabase.from('favorites').insert([{
          user_id: state.currentUser.id,
          listing_id: listing.id,
          created_at: new Date().toISOString()
        }]);
      }
    } catch (error) {
      console.error('Error updating favorites:', error);
    }
  };

  return (
    <div className="listing-card">
      <div className="card-image">
        {listing.imageUrl ? (
          <img src={listing.imageUrl} alt={listing.title} loading="lazy" />
        ) : (
          <div className="placeholder-image"><span>🌐</span></div>
        )}
        <span className="category-badge">{listing.category}</span>
        <button 
          className={`favorite-button ${isFavorited ? 'active' : ''}`} 
          onClick={toggleFavorite}
          title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
          aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
        >
          {isFavorited ? '⭐' : '☆'}
        </button>
      </div>
      <div className="card-content">
        <div className="card-header">
          <h3>{listing.title}</h3>
          <span className="price-tag">{listing.price}</span>
        </div>
        <p className="description">
          {listing.description?.substring(0, 150)}{listing.description?.length > 150 ? '...' : ''}
        </p>
        <div className="card-meta">
          <span className="seller-info">
            <img 
              src={listing.sellerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(listing.seller || 'User')}&background=667eea&color=fff`} 
              alt={listing.seller} 
            />
            {listing.seller}
          </span>
          <span className="rating">⭐ {listing.rating || 'New'}</span>
        </div>
        <div className="card-stats">
          <span>👁 {listing.views || 0}</span>
          <span>💬 {listing.inquiries || 0}</span>
          <span>{listing.date}</span>
        </div>
        {showContact && (
          <textarea 
            placeholder="Write your message..." 
            value={message} 
            onChange={e => setMessage(e.target.value)} 
            className="contact-message" 
            rows="3" 
          />
        )}
        <div className="card-actions">
          {listing.url && (
            <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
              🔗 View
            </a>
          )}
          <button onClick={handleContact} className="btn-primary btn-sm">
            {showContact ? '📤 Send' : '📧 Contact'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MARKETPLACE COMPONENT (FIXED - Removed contact field)
// ============================================
function Marketplace() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterPrice, setFilterPrice] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    url: '',
    imageUrl: '',
    category: 'website'
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to create a listing', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    if (!formData.title || !formData.description || !formData.price) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please fill in all required fields', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    setSubmitting(true);
    
    try {
      // FIXED: Removed 'contact' field that doesn't exist in the schema
      const listingData = {
        title: formData.title,
        description: formData.description,
        price: formData.price,
        url: formData.url,
        image_url: formData.imageUrl || 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600',
        category: formData.category,
        seller_name: state.profile?.name || state.currentUser.email,
        seller_avatar: state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.name || 'User')}&background=667eea&color=fff`,
        user_id: state.currentUser.id,
        views: 0,
        inquiries: 0,
        rating: 0,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('listings')
        .insert([listingData])
        .select()
        .single();

      if (error) throw error;

      const newListing = {
        ...data,
        seller: data.seller_name,
        sellerAvatar: data.seller_avatar,
        imageUrl: data.image_url,
        date: new Date(data.created_at).toLocaleDateString()
      };

      dispatch({ type: 'ADD_LISTING', payload: newListing });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `✅ Listing "${formData.title}" published successfully!`, 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      
      setFormData({
        title: '',
        description: '',
        price: '',
        url: '',
        imageUrl: '',
        category: 'website'
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating listing:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Failed to publish: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    
    setSubmitting(false);
  };

  const filteredListings = (state.listings || [])
    .filter(l => {
      const matchesSearch = l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           l.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = filterPrice === 'all' ? true : 
                          filterPrice === 'free' ? l.price?.toLowerCase().includes('free') : 
                          !l.price?.toLowerCase().includes('free');
      return matchesSearch && matchesPrice;
    })
    .sort((a, b) => {
      if (sortBy === 'price') {
        return (a.price || '').localeCompare(b.price || '');
      } else if (sortBy === 'title') {
        return (a.title || '').localeCompare(b.title || '');
      }
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    });

  return (
    <div className="marketplace-page">
      <div className="page-header">
        <h1>Website & Portfolio Marketplace</h1>
        <p>Discover and purchase amazing websites and portfolios</p>
        <button 
          className="btn-primary" 
          onClick={() => {
            if (!state.currentUser) {
              dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                message: 'Please login to create a listing', 
                type: 'warning', 
                time: new Date().toLocaleTimeString(), 
                read: false 
              }});
              return;
            }
            setShowForm(!showForm);
          }}
        >
          {showForm ? '❌ Cancel' : '📢 List Your Website'}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h2>📢 Create New Listing</h2>
            <form onSubmit={handleSubmit} className="listing-form">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Title *</label>
                  <input 
                    type="text" 
                    placeholder="Website Title" 
                    value={formData.title} 
                    onChange={e => setFormData({ ...formData, title: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Category</label>
                  <select 
                    value={formData.category} 
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="website">Website</option>
                    <option value="portfolio">Portfolio</option>
                    <option value="ecommerce">E-Commerce</option>
                    <option value="blog">Blog</option>
                    <option value="saas">SaaS</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  placeholder="Describe your website" 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  required 
                  rows="3" 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Price *</label>
                  <input 
                    type="text" 
                    placeholder="$500 or Negotiable" 
                    value={formData.price} 
                    onChange={e => setFormData({ ...formData, price: e.target.value })} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label>Website URL</label>
                  <input 
                    type="url" 
                    placeholder="https://example.com" 
                    value={formData.url} 
                    onChange={e => setFormData({ ...formData, url: e.target.value })} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Image URL (optional)</label>
                <input 
                  type="url" 
                  placeholder="https://example.com/image.jpg" 
                  value={formData.imageUrl} 
                  onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} 
                />
              </div>
              {/* REMOVED: Contact Email field since it's not in the schema */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : '📤 Publish Listing'}
                </button>
              </div>
            </form>
            <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input 
          type="text" 
          placeholder="🔍 Search listings..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="search-input" 
        />
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} aria-label="Sort by">
          <option value="date">Sort by Date</option>
          <option value="price">Sort by Price</option>
          <option value="title">Sort by Title</option>
        </select>
        <select value={filterPrice} onChange={e => setFilterPrice(e.target.value)} aria-label="Filter by price">
          <option value="all">All Prices</option>
          <option value="free">Free Only</option>
          <option value="paid">Paid Only</option>
        </select>
      </div>

      <div className="listings-grid">
        {filteredListings.map(listing => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
        {filteredListings.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🛒</span>
            <h3>No listings found</h3>
            {searchTerm ? (
              <p>Try different search terms</p>
            ) : (
              <>
                <p>Be the first to list a website!</p>
                <button onClick={() => setShowForm(true)} className="btn-primary">
                  Create First Listing
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// ADVERTISE COMPONENT
// ============================================
function Advertise() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [formData, setFormData] = useState({
    appName: '',
    description: '',
    platform: '',
    appUrl: '',
    contact: '',
    features: '',
    price: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to advertise', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    setSubmitting(true);
    
    try {
      const featuresArray = formData.features.split(',').map(f => f.trim()).filter(f => f);
      
      const { data, error } = await supabase
        .from('apps')
        .insert([{
          app_name: formData.appName,
          description: formData.description,
          platform: formData.platform,
          app_url: formData.appUrl,
          contact: formData.contact,
          features: featuresArray,
          price: formData.price,
          developer_name: state.profile?.name || state.currentUser.email,
          developer_avatar: state.profile?.avatar_url,
          user_id: state.currentUser.id,
          rating: 0,
          downloads: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      const newApp = {
        ...data,
        appName: data.app_name,
        appUrl: data.app_url,
        developer: data.developer_name,
        developerAvatar: data.developer_avatar,
        date: new Date(data.created_at).toLocaleDateString()
      };
      
      dispatch({ type: 'ADD_APP', payload: newApp });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `✅ App "${formData.appName}" published successfully!`, 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      
      setFormData({
        appName: '',
        description: '',
        platform: '',
        appUrl: '',
        contact: '',
        features: '',
        price: ''
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating app:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Failed to publish: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    
    setSubmitting(false);
  };

  const filteredApps = (state.apps || []).filter(a => {
    const matchesSearch = a.appName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         a.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || a.platform?.toLowerCase() === filterPlatform.toLowerCase();
    return matchesSearch && matchesPlatform;
  });

  const platforms = [...new Set((state.apps || []).map(a => a.platform))];

  return (
    <div className="advertise-page">
      <div className="page-header">
        <h1>App & Software Advertising</h1>
        <p>Showcase your applications and reach potential users</p>
        <button 
          className="btn-primary" 
          onClick={() => {
            if (!state.currentUser) {
              dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                message: 'Please login to advertise', 
                type: 'warning', 
                time: new Date().toLocaleTimeString(), 
                read: false 
              }});
              return;
            }
            setShowForm(!showForm);
          }}
        >
          {showForm ? '❌ Cancel' : '📱 Advertise Your App'}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h2>📱 Create App Listing</h2>
            <form onSubmit={handleSubmit} className="listing-form">
              <div className="form-group">
                <label>App Name *</label>
                <input 
                  type="text" 
                  placeholder="My Awesome App" 
                  value={formData.appName} 
                  onChange={e => setFormData({ ...formData, appName: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  placeholder="Describe your app" 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  required 
                  rows="3" 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Platform *</label>
                  <select 
                    value={formData.platform} 
                    onChange={e => setFormData({ ...formData, platform: e.target.value })} 
                    required
                  >
                    <option value="">Select</option>
                    <option value="Web">Web</option>
                    <option value="iOS">iOS</option>
                    <option value="Android">Android</option>
                    <option value="Desktop">Desktop</option>
                    <option value="Cross-platform">Cross-platform</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <input 
                    type="text" 
                    placeholder="Free / $9.99/month" 
                    value={formData.price} 
                    onChange={e => setFormData({ ...formData, price: e.target.value })} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>App URL</label>
                <input 
                  type="url" 
                  placeholder="https://myapp.com" 
                  value={formData.appUrl} 
                  onChange={e => setFormData({ ...formData, appUrl: e.target.value })} 
                />
              </div>
              <div className="form-group">
                <label>Key Features * (comma-separated)</label>
                <input 
                  type="text" 
                  placeholder="Feature 1, Feature 2, Feature 3" 
                  value={formData.features} 
                  onChange={e => setFormData({ ...formData, features: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Contact Email *</label>
                <input 
                  type="email" 
                  placeholder="your@email.com" 
                  value={formData.contact} 
                  onChange={e => setFormData({ ...formData, contact: e.target.value })} 
                  required 
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : '📱 Publish App'}
                </button>
              </div>
            </form>
            <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input 
          type="text" 
          placeholder="🔍 Search apps..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="search-input" 
        />
        <select 
          value={filterPlatform} 
          onChange={e => setFilterPlatform(e.target.value)} 
          aria-label="Filter by platform"
        >
          <option value="all">All Platforms</option>
          {platforms.map(p => (
            <option key={p} value={p?.toLowerCase()}>{p}</option>
          ))}
        </select>
      </div>

      <div className="app-grid">
        {filteredApps.map(app => (
          <AppCard key={app.id} app={app} />
        ))}
        {filteredApps.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">📱</span>
            <h3>No apps found</h3>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Advertise Your App
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AppCard({ app }) {
  const { state, dispatch } = useAppContext();
  const [showContact, setShowContact] = useState(false);
  const [message, setMessage] = useState('');

  const handleInquiry = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to inquire', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    if (showContact && message.trim()) {
      try {
        // FIXED: Removed from_name, from_email, to_email fields
        await supabase.from('messages').insert([{
          from_user: state.currentUser.id,
          to_user: app.user_id,
          subject: `Inquiry about ${app.appName}`,
          message: message,
          read: false,
          created_at: new Date().toISOString()
        }]);
        
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: `Inquiry sent about "${app.appName}"`, 
          type: 'success', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
      } catch (error) {
        console.error('Error sending inquiry:', error);
      }
      setShowContact(false);
      setMessage('');
    } else {
      setShowContact(!showContact);
    }
  };

  return (
    <div className="app-card">
      <div className="app-header">
        <span className={`platform-badge ${app.platform?.toLowerCase()}`}>{app.platform}</span>
        {app.price && <span className="price-badge">{app.price}</span>}
      </div>
      <h3>{app.appName}</h3>
      <p className="description">
        {app.description?.substring(0, 150)}{app.description?.length > 150 ? '...' : ''}
      </p>
      <div className="features-list">
        {app.features?.map((f, i) => (
          <span key={i} className="feature-tag">✓ {f}</span>
        ))}
      </div>
      <div className="app-meta">
        <span>⭐ {app.rating || 'New'}</span>
        <span>⬇️ {app.downloads || 0}</span>
      </div>
      <div className="developer-info">
        <span>
          <img 
            src={app.developerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.developer || 'Dev')}&background=667eea&color=fff`} 
            alt={app.developer} 
            style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px' }}
          />
          {app.developer}
        </span>
        <span>{app.date}</span>
      </div>
      {showContact && (
        <textarea 
          placeholder="Write your inquiry..." 
          value={message} 
          onChange={e => setMessage(e.target.value)} 
          className="contact-message" 
        />
      )}
      <div className="app-actions">
        {app.appUrl && (
          <a href={app.appUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary">
            🔗 Visit
          </a>
        )}
        <button onClick={handleInquiry} className="btn-primary">
          {showContact ? '📤 Send' : '💬 Inquire'}
        </button>
      </div>
    </div>
  );
}

// ============================================
// CODE SHARING COMPONENT
// ============================================
function CodeSharing() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    language: '',
    code: '',
    tags: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to share code', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    setSubmitting(true);
    
    try {
      const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
      
      const { data, error } = await supabase
        .from('code_snippets')
        .insert([{
          title: formData.title,
          description: formData.description,
          language: formData.language,
          code: formData.code,
          tags: tagsArray,
          author_name: state.profile?.name || state.currentUser.email,
          author_avatar: state.profile?.avatar_url,
          user_id: state.currentUser.id,
          likes: 0,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      const newSnippet = {
        ...data,
        author: data.author_name,
        authorAvatar: data.author_avatar,
        likedBy: [],
        date: new Date(data.created_at).toLocaleDateString()
      };
      
      dispatch({ type: 'ADD_CODE_SNIPPET', payload: newSnippet });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `✅ Code snippet "${formData.title}" shared successfully!`, 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      
      setFormData({
        title: '',
        description: '',
        language: '',
        code: '',
        tags: ''
      });
      setShowForm(false);
    } catch (error) {
      console.error('Error creating snippet:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Failed to share: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    
    setSubmitting(false);
  };

  const handleLike = async (snippet) => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to like', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    const userName = state.profile?.name || state.currentUser.email;
    const userLiked = snippet.likedBy?.includes(userName);
    const newLikedBy = userLiked 
      ? snippet.likedBy.filter(u => u !== userName) 
      : [...(snippet.likedBy || []), userName];
    const newLikes = userLiked ? snippet.likes - 1 : snippet.likes + 1;
    
    dispatch({ 
      type: 'LIKE_SNIPPET', 
      payload: { ...snippet, likes: newLikes, likedBy: newLikedBy } 
    });
    
    try {
      await supabase
        .from('code_snippets')
        .update({ likes: newLikes })
        .eq('id', snippet.id);
      
      // Handle snippet_likes table
      if (userLiked) {
        await supabase
          .from('snippet_likes')
          .delete()
          .eq('snippet_id', snippet.id)
          .eq('user_id', state.currentUser.id);
      } else {
        await supabase
          .from('snippet_likes')
          .insert([{
            snippet_id: snippet.id,
            user_id: state.currentUser.id,
            created_at: new Date().toISOString()
          }]);
      }
    } catch (error) {
      console.error('Error updating like:', error);
    }
  };

  const filteredSnippets = (state.codeSnippets || []).filter(s => {
    const matchesSearch = s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLanguage = filterLanguage === 'all' || s.language?.toLowerCase() === filterLanguage.toLowerCase();
    return matchesSearch && matchesLanguage;
  });

  const languages = [...new Set((state.codeSnippets || []).map(s => s.language))];

  return (
    <div className="code-sharing-page">
      <div className="page-header">
        <h1>Code Sharing Community</h1>
        <p>Share your code, learn from others, and grow together</p>
        <button 
          className="btn-primary" 
          onClick={() => {
            if (!state.currentUser) {
              dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                message: 'Please login to share code', 
                type: 'warning', 
                time: new Date().toLocaleTimeString(), 
                read: false 
              }});
              return;
            }
            setShowForm(!showForm);
          }}
        >
          {showForm ? '❌ Cancel' : '💻 Share Code'}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <h2>💻 Share Code Snippet</h2>
            <form onSubmit={handleSubmit} className="listing-form">
              <div className="form-group">
                <label>Title *</label>
                <input 
                  type="text" 
                  placeholder="e.g., React Custom Hook for API" 
                  value={formData.title} 
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  required 
                />
              </div>
              <div className="form-group">
                <label>Description *</label>
                <textarea 
                  placeholder="Briefly explain what this code does" 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  required 
                  rows="3" 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <div className="form-group">
                  <label>Language *</label>
                  <select 
                    value={formData.language} 
                    onChange={e => setFormData({ ...formData, language: e.target.value })} 
                    required
                  >
                    <option value="">Select</option>
                    {['JavaScript', 'Python', 'React', 'Node.js', 'HTML/CSS', 'TypeScript', 'Java', 'C++', 'Ruby', 'Go', 'PHP'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tags (comma-separated)</label>
                  <input 
                    type="text" 
                    placeholder="react, hooks, api" 
                    value={formData.tags} 
                    onChange={e => setFormData({ ...formData, tags: e.target.value })} 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Code *</label>
                <textarea 
                  placeholder="Paste your code here..." 
                  value={formData.code} 
                  onChange={e => setFormData({ ...formData, code: e.target.value })} 
                  required 
                  rows="8" 
                  style={{ fontFamily: 'monospace' }} 
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Publishing...' : '💻 Publish Code'}
                </button>
              </div>
            </form>
            <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input 
          type="text" 
          placeholder="🔍 Search snippets..." 
          value={searchTerm} 
          onChange={e => setSearchTerm(e.target.value)} 
          className="search-input" 
        />
        <select 
          value={filterLanguage} 
          onChange={e => setFilterLanguage(e.target.value)} 
          aria-label="Filter by language"
        >
          <option value="all">All Languages</option>
          {languages.map(l => (
            <option key={l} value={l?.toLowerCase()}>{l}</option>
          ))}
        </select>
      </div>

      <div className="code-grid">
        {filteredSnippets.map(snippet => (
          <CodeCard key={snippet.id} snippet={snippet} onLike={handleLike} />
        ))}
        {filteredSnippets.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">💻</span>
            <h3>No snippets found</h3>
            <button onClick={() => setShowForm(true)} className="btn-primary">
              Share Your Code
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeCard({ snippet, onLike }) {
  const { state } = useAppContext();
  
  const handleCopy = () => {
    navigator.clipboard.writeText(snippet.code).catch(() => {
      const textArea = document.createElement('textarea');
      textArea.value = snippet.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    });
  };
  
  const userName = state.profile?.name || state.currentUser?.email;
  const isLiked = state.currentUser && snippet.likedBy?.includes(userName);

  return (
    <div className="code-card">
      <div className="code-header">
        <div>
          <h3>{snippet.title}</h3>
          <span className="language-badge">{snippet.language}</span>
        </div>
      </div>
      <p className="description">{snippet.description}</p>
      <pre className="code-preview">
        <code>{snippet.code?.substring(0, 200)}{snippet.code?.length > 200 ? '...' : ''}</code>
      </pre>
      <div className="tags-container">
        {snippet.tags?.map((t, i) => (
          <span key={i} className="tag">#{t}</span>
        ))}
      </div>
      <div className="code-footer">
        <div className="author-info">
          <span>
            <img 
              src={snippet.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.author || 'Dev')}&background=667eea&color=fff`} 
              alt={snippet.author} 
              style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '4px' }}
            />
            {snippet.author}
          </span>
          <span>{snippet.date}</span>
        </div>
        <div className="code-actions">
          <button 
            onClick={() => onLike(snippet)} 
            className={`btn-like ${isLiked ? 'liked' : ''}`} 
            aria-label={isLiked ? 'Unlike' : 'Like'}
          >
            {isLiked ? '❤️' : '🤍'} {snippet.likes}
          </button>
          <button onClick={handleCopy} className="btn-copy" aria-label="Copy code">
            📋 Copy
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================
// MESSAGES COMPONENT
// ============================================
function Messages() {
  const { state, dispatch } = useAppContext();
  
  if (!state.currentUser) {
    return (
      <div className="messages-page">
        <div className="empty-state">
          <span className="empty-icon">📧</span>
          <h2>Messages</h2>
          <p>Please login to view messages</p>
        </div>
      </div>
    );
  }

  const userMessages = (state.messages || []).filter(
    m => m.from_user === state.currentUser.id || m.to_user === state.currentUser.id
  );

  const deleteMessage = async (id) => {
    dispatch({ type: 'DELETE_MESSAGE', payload: id });
    try {
      await supabase.from('messages').delete().eq('id', id);
    } catch (error) {
      console.error('Error deleting message:', error);
    }
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: 'Message deleted', 
      type: 'info', 
      time: new Date().toLocaleTimeString(), 
      read: false 
    }});
  };

  const markAsRead = async (id) => {
    dispatch({ type: 'MARK_MESSAGE_READ', payload: id });
    try {
      await supabase.from('messages').update({ read: true }).eq('id', id);
    } catch (error) {
      console.error('Error marking message read:', error);
    }
  };

  return (
    <div className="messages-page">
      <div className="page-header">
        <h1>Messages</h1>
        <p>Your conversations and inquiries</p>
      </div>
      
      {userMessages.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">💬</span>
          <h3>No messages yet</h3>
          <p>Messages from your listings and inquiries will appear here</p>
        </div>
      ) : (
        <div className="messages-list">
          {userMessages.map(msg => (
            <div 
              key={msg.id} 
              className={`message-card ${!msg.read ? 'unread' : ''}`}
              onClick={() => !msg.read && markAsRead(msg.id)}
            >
              <button 
                onClick={(e) => { e.stopPropagation(); deleteMessage(msg.id); }} 
                className="btn-remove-notification" 
                title="Delete message" 
                aria-label="Delete message"
                style={{ float: 'right' }}
              >
                🗑️
              </button>
              <div className="message-header">
                <span><strong>Subject:</strong> {msg.subject}</span>
                <span>{new Date(msg.created_at).toLocaleDateString()}</span>
              </div>
              <p>{msg.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// PROFILE COMPONENT
// ============================================
function Profile() {
  const { state } = useAppContext();
  
  if (!state.currentUser) {
    return (
      <div className="profile-page">
        <div className="empty-state">
          <span className="empty-icon">👤</span>
          <h2>Profile</h2>
          <p>Please login to view your profile</p>
        </div>
      </div>
    );
  }

  const userName = state.profile?.name || state.currentUser.email;
  const userListings = (state.listings || []).filter(
    l => l.user_id === state.currentUser.id || l.seller === userName
  );
  const userApps = (state.apps || []).filter(
    a => a.user_id === state.currentUser.id || a.developer === userName
  );
  const userSnippets = (state.codeSnippets || []).filter(
    s => s.user_id === state.currentUser.id || s.author === userName
  );
  const userReceivedMessages = (state.messages || []).filter(
    m => m.to_user === state.currentUser.id
  );

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img 
          src={state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=667eea&color=fff`} 
          alt={userName} 
          className="profile-avatar" 
        />
        <div>
          <h1>{userName}</h1>
          <p>{state.currentUser.email}</p>
          {state.profile?.role && <p>Role: {state.profile.role}</p>}
          {state.profile?.bio && <p>{state.profile.bio}</p>}
          {state.profile?.website && (
            <p>🌐 <a href={state.profile.website} target="_blank" rel="noopener noreferrer">{state.profile.website}</a></p>
          )}
        </div>
      </div>
      
      <div className="profile-stats">
        <div className="stat-box">
          <h3>{userListings.length}</h3>
          <p>Active Listings</p>
        </div>
        <div className="stat-box">
          <h3>{userApps.length}</h3>
          <p>Apps Advertised</p>
        </div>
        <div className="stat-box">
          <h3>{userSnippets.length}</h3>
          <p>Code Snippets</p>
        </div>
        <div className="stat-box">
          <h3>{userReceivedMessages.length}</h3>
          <p>Messages</p>
        </div>
      </div>
      
      {userListings.length > 0 && (
        <div className="profile-section">
          <h2>Your Listings</h2>
          <div className="listings-grid">
            {userListings.map(l => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
        </div>
      )}
      
      {userSnippets.length > 0 && (
        <div className="profile-section">
          <h2>Your Code Snippets</h2>
          <div className="code-grid">
            {userSnippets.map(s => (
              <CodeCard key={s.id} snippet={s} onLike={() => {}} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// FAVORITES COMPONENT
// ============================================
function Favorites() {
  const { state } = useAppContext();
  
  return (
    <div className="favorites-page">
      <div className="page-header">
        <h1>⭐ My Favorites</h1>
        <p>Your saved listings</p>
      </div>
      
      {!state.currentUser ? (
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <h3>Please login to view</h3>
        </div>
      ) : (state.favorites || []).length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">⭐</span>
          <h3>No favorites yet</h3>
          <p>Start browsing and save items!</p>
        </div>
      ) : (
        <div className="listings-grid">
          {(state.favorites || []).map(item => (
            <ListingCard key={item.id} listing={item} />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================
// SETTINGS COMPONENT
// ============================================
function Settings() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    name: state.profile?.name || '',
    email: state.currentUser?.email || '',
    bio: state.profile?.bio || '',
    website: state.profile?.website || '',
    github: state.profile?.github || '',
    twitter: state.profile?.twitter || ''
  });
  
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: true,
    pushNotifications: false,
    marketingEmails: false,
    listingUpdates: true,
    messageAlerts: true,
    favoritesActivity: true,
    weeklyDigest: false
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public',
    showEmail: false,
    showActivity: true,
    allowMessages: true
  });

  useEffect(() => {
    setProfileForm({
      name: state.profile?.name || '',
      email: state.currentUser?.email || '',
      bio: state.profile?.bio || '',
      website: state.profile?.website || '',
      github: state.profile?.github || '',
      twitter: state.profile?.twitter || ''
    });
  }, [state.profile, state.currentUser]);

  if (!state.currentUser) {
    return (
      <div className="settings-page">
        <div className="empty-state">
          <span className="empty-icon">⚙️</span>
          <h2>Settings</h2>
          <p>Please login to access settings</p>
        </div>
      </div>
    );
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    dispatch({ type: 'UPDATE_PROFILE', payload: profileForm });
    
    try {
      await supabase.from('profiles').upsert({
        id: state.currentUser.id,
        ...profileForm,
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      console.error('Could not save to Supabase:', error);
    }
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: '✅ Profile updated!', 
      type: 'success', 
      time: new Date().toLocaleTimeString(), 
      read: false 
    }});
    setSaving(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    
    if (!securityForm.currentPassword) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Please enter current password', 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Passwords do not match', 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    if (securityForm.newPassword.length < 6) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Password must be at least 6 characters', 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    setSaving(true);
    
    try {
      const { error } = await supabase.auth.updateUser({
        password: securityForm.newPassword
      });
      
      if (error) {
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: `❌ ${error.message}`, 
          type: 'error', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
      } else {
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: '✅ Password changed!', 
          type: 'success', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
        setSecurityForm({
          currentPassword: '',
          newPassword: '',
          confirmNewPassword: ''
        });
      }
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Failed to update password', 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    
    setSaving(false);
  };

  const sidebarTabs = [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'security', icon: '🔒', label: 'Security' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'privacy', icon: '🛡️', label: 'Privacy' },
    { id: 'appearance', icon: '🎨', label: 'Appearance' },
    { id: 'danger', icon: '⚠️', label: 'Danger Zone' }
  ];

  return (
    <>
      <div className="settings-page">
        <div className="page-header">
          <h1>⚙️ Settings</h1>
          <p>Manage your account and preferences</p>
        </div>
        
        <div className="settings-container">
          <div className="settings-sidebar">
            {sidebarTabs.map(tab => (
              <button
                key={tab.id}
                className={`settings-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span className="settings-nav-label">{tab.label}</span>
              </button>
            ))}
          </div>
          
          <div className="settings-content">
            {activeTab === 'profile' && (
              <form onSubmit={handleProfileUpdate} className="settings-form">
                <h3>Profile Information</h3>
                <p className="settings-description">Update your personal information and public profile</p>
                
                <div className="form-group">
                  <label>Full Name</label>
                  <div className="input-wrapper">
                    <span className="input-icon">👤</span>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={e => setProfileForm({ ...profileForm, name: e.target.value })}
                      placeholder="Your full name"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-wrapper">
                    <span className="input-icon">📧</span>
                    <input
                      type="email"
                      value={profileForm.email}
                      disabled
                      style={{ background: 'var(--gray-100)' }}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Bio</label>
                  <textarea
                    value={profileForm.bio}
                    onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })}
                    placeholder="Tell us about yourself..."
                    rows="4"
                    className="settings-textarea"
                  />
                </div>
                
                <div className="form-group">
                  <label>Website</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🌐</span>
                    <input
                      type="url"
                      value={profileForm.website}
                      onChange={e => setProfileForm({ ...profileForm, website: e.target.value })}
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>GitHub Username</label>
                    <div className="input-wrapper">
                      <span className="input-icon">⌨️</span>
                      <input
                        type="text"
                        value={profileForm.github}
                        onChange={e => setProfileForm({ ...profileForm, github: e.target.value })}
                        placeholder="username"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Twitter Handle</label>
                    <div className="input-wrapper">
                      <span className="input-icon">𝕏</span>
                      <input
                        type="text"
                        value={profileForm.twitter}
                        onChange={e => setProfileForm({ ...profileForm, twitter: e.target.value })}
                        placeholder="@username"
                      />
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '💾 Saving...' : '💾 Save Changes'}
                </button>
              </form>
            )}

            {activeTab === 'security' && (
              <form onSubmit={handlePasswordChange} className="settings-form">
                <h3>Change Password</h3>
                <p className="settings-description">Ensure your account is using a strong password</p>
                
                <div className="form-group">
                  <label>Current Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔒</span>
                    <input
                      type="password"
                      value={securityForm.currentPassword}
                      onChange={e => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>New Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔑</span>
                    <input
                      type="password"
                      value={securityForm.newPassword}
                      onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                      placeholder="Enter new password"
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔑</span>
                    <input
                      type="password"
                      value={securityForm.confirmNewPassword}
                      onChange={e => setSecurityForm({ ...securityForm, confirmNewPassword: e.target.value })}
                      placeholder="Confirm new password"
                    />
                  </div>
                </div>
                
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '🔒 Updating...' : '🔒 Update Password'}
                </button>
              </form>
            )}

            {activeTab === 'notifications' && (
              <div className="settings-form">
                <h3>Notification Preferences</h3>
                <p className="settings-description">Configure how you receive notifications</p>
                
                <div className="notification-settings">
                  {Object.entries(notificationPrefs).map(([key, value]) => (
                    <div className="setting-item" key={key}>
                      <div className="setting-info">
                        <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</strong>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={() => setNotificationPrefs({ ...notificationPrefs, [key]: !value })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                    message: '✅ Notification preferences saved!', 
                    type: 'success', 
                    time: new Date().toLocaleTimeString(), 
                    read: false 
                  }})}
                  className="btn-primary"
                >
                  💾 Save Preferences
                </button>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="settings-form">
                <h3>Privacy Settings</h3>
                <p className="settings-description">Control your privacy and visibility</p>
                
                <div className="form-group">
                  <label>Profile Visibility</label>
                  <select
                    value={privacySettings.profileVisibility}
                    onChange={e => setPrivacySettings({ ...privacySettings, profileVisibility: e.target.value })}
                  >
                    <option value="public">Public</option>
                    <option value="members">Members Only</option>
                    <option value="private">Private</option>
                  </select>
                </div>
                
                {Object.entries({
                  showEmail: 'Show Email',
                  showActivity: 'Show Activity',
                  allowMessages: 'Allow Messages'
                }).map(([key, label]) => (
                  <div className="setting-item" key={key}>
                    <div className="setting-info">
                      <strong>{label}</strong>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={privacySettings[key]}
                        onChange={() => setPrivacySettings({ ...privacySettings, [key]: !privacySettings[key] })}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
                
                <button
                  onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                    message: '✅ Privacy settings saved!', 
                    type: 'success', 
                    time: new Date().toLocaleTimeString(), 
                    read: false 
                  }})}
                  className="btn-primary"
                >
                  💾 Save Privacy Settings
                </button>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-form">
                <h3>Appearance Settings</h3>
                <p className="settings-description">Customize your visual experience</p>
                
                <div className="theme-toggle-section">
                  <div className="theme-info">
                    <strong>Theme Mode</strong>
                    <p>Choose between light and dark theme</p>
                  </div>
                  <button
                    type="button"
                    className="theme-toggle"
                    onClick={() => dispatch({ type: 'TOGGLE_THEME' })}
                  >
                    {state.theme === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
                  </button>
                </div>
                
                <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>
                  Current theme: <strong>{state.theme === 'light' ? '☀️ Light' : '🌙 Dark'}</strong>
                </p>
              </div>
            )}

            {activeTab === 'danger' && (
              <div className="settings-form">
                <h3 style={{ color: 'var(--danger)' }}>⚠️ Danger Zone</h3>
                <p className="settings-description">Irreversible actions for your account</p>
                
                <div className="danger-zone-card">
                  <h4 style={{ color: 'var(--danger)' }}>Delete Account</h4>
                  <p>Once you delete your account, there is no going back.</p>
                  <button
                    className="btn-primary"
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{ background: 'var(--danger)' }}
                  >
                    🗑️ Delete My Account
                  </button>
                </div>
                
                <div className="danger-zone-card warning">
                  <h4 style={{ color: 'var(--warning)' }}>Export Data</h4>
                  <p>Download all your data including listings, messages, and activity.</p>
                  <button
                    className="btn-secondary"
                    onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                      message: '📦 Data export started!', 
                      type: 'info', 
                      time: new Date().toLocaleTimeString(), 
                      read: false 
                    }})}
                  >
                    📥 Export My Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Account"
        message="Are you absolutely sure? This action cannot be undone."
        onConfirm={() => {
          dispatch({ type: 'ADD_NOTIFICATION', payload: { 
            message: '⚠️ Account deletion is not available in demo mode', 
            type: 'warning', 
            time: new Date().toLocaleTimeString(), 
            read: false 
          }});
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Delete Forever"
        type="danger"
      />
    </>
  );
}

// ============================================
// FOOTER COMPONENT
// ============================================
function Footer() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="footer">
      <div className="footer-content">
        <div className="footer-section">
          <h3>🚀 DevMarket</h3>
          <p>The ultimate marketplace for developers to trade, showcase, and share digital products.</p>
        </div>
        
        <div className="footer-section">
          <h4>Quick Links</h4>
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/advertise">Advertise</Link>
          <Link to="/code-sharing">Code Sharing</Link>
          <Link to="/messages">Messages</Link>
        </div>
        
        <div className="footer-section">
          <h4>Community</h4>
          <a href="https://discord.com" target="_blank" rel="noopener noreferrer">Discord</a>
          <a href="https://twitter.com" target="_blank" rel="noopener noreferrer">Twitter</a>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        
        <div className="footer-section">
          <h4>Support</h4>
          <a href="mailto:support@devmarket.com">Contact Us</a>
          <Link to="/faq">FAQs</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
        </div>
      </div>
      
      <div className="footer-bottom">
        <p>&copy; {currentYear} DevMarket. All rights reserved. Built with React & Supabase ❤️</p>
      </div>
    </footer>
  );
}

export default App;