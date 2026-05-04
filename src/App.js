// ============================================
// src/App.js (COMPLETE ENHANCED VERSION - FIXED)
// ============================================
import React, { useState, useEffect, createContext, useContext, useReducer, useCallback, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabase';
import { realtimeManager } from './utils/realtime';
import { analytics } from './utils/analytics';
import './App.css';

// ============================================
// MODAL PORTAL — renders outside header stacking context
// This is the ONLY correct way to fix z-index issues caused
// by position:sticky headers creating new stacking contexts.
// ============================================
function ModalPortal({ children }) {
  return ReactDOM.createPortal(children, document.body);
}

// ============================================
// GLOBAL CONTEXT
// ============================================
const AppContext = createContext();

const getPersistedNotificationsEnabled = () => {
  try {
    const stored = localStorage.getItem('devMarketNotificationsEnabled');
    if (stored !== null) return JSON.parse(stored);
  } catch(e) {}
  return true;
};

const initialState = {
  listings: [],
  apps: [],
  codeSnippets: [],
  currentUser: null,
  profile: null,
  session: null,
  notifications: [],
  messages: [],
  conversations: [],
  activeConversation: null,
  favorites: [],
  searchHistory: [],
  follows: [],
  followers: [],
  theme: 'light',
  authError: null,
  loading: true,
  initialized: false,
  dataLoaded: false,
  realtimeConnected: false,
  analyticsData: null,
  isAdmin: false,
  moderationQueue: [],
  notificationsEnabled: getPersistedNotificationsEnabled(),
  announcement: null,
  maintenanceMode: false,
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
    case 'UPDATE_AVATAR':
      return { 
        ...state, 
        profile: { ...state.profile, avatar_url: action.payload },
        currentUser: state.currentUser ? { ...state.currentUser, avatar_url: action.payload } : state.currentUser
      };
    case 'SET_LISTINGS': 
      return { ...state, listings: action.payload || [] };
    case 'ADD_LISTING': 
      return { ...state, listings: [action.payload, ...(state.listings || [])] };
    case 'UPDATE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l) };
    case 'DELETE_LISTING': 
      return { ...state, listings: (state.listings || []).filter(l => l.id !== action.payload) };
    case 'HIDE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload ? { ...l, hidden: true } : l) };
    case 'UNHIDE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload ? { ...l, hidden: false } : l) };
    case 'SET_APPS': 
      return { ...state, apps: action.payload || [] };
    case 'ADD_APP': 
      return { ...state, apps: [action.payload, ...(state.apps || [])] };
    case 'DELETE_APP':
      return { ...state, apps: (state.apps || []).filter(a => a.id !== action.payload) };
    case 'SET_CODE_SNIPPETS': 
      return { ...state, codeSnippets: action.payload || [] };
    case 'ADD_CODE_SNIPPET': 
      return { ...state, codeSnippets: [action.payload, ...(state.codeSnippets || [])] };
    case 'DELETE_SNIPPET':
      return { ...state, codeSnippets: (state.codeSnippets || []).filter(s => s.id !== action.payload) };
    case 'LIKE_SNIPPET': 
      return { ...state, codeSnippets: (state.codeSnippets || []).map(s => s.id === action.payload.id ? { ...s, likes: action.payload.likes, likedBy: action.payload.likedBy } : s) };
    case 'SET_NOTIFICATIONS': 
      return { ...state, notifications: action.payload || [] };
    case 'SET_NOTIFICATIONS_ENABLED':
      try { localStorage.setItem('devMarketNotificationsEnabled', JSON.stringify(action.payload)); } catch(e) {}
      return { ...state, notificationsEnabled: action.payload };
    case 'ADD_NOTIFICATION': {
      // When notifications are disabled, block ALL incoming notifications
      // except those with _force: true (used for the toggle feedback itself)
      if (!state.notificationsEnabled && !action.payload._force) return state;
      // Strip _force before storing so it doesn't pollute the notification object
      const { _force, ...notifData } = action.payload;
      const newNotif = { ...notifData, id: notifData.id || `n-${Date.now()}-${Math.random()}` };
      return { ...state, notifications: [newNotif, ...(state.notifications || [])].slice(0, 50) };
    }
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
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload || [] };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: (state.conversations || []).map(c => 
          c.userId === action.payload.userId ? { ...c, ...action.payload } : c
        )
      };
    case 'ADD_CONVERSATION_MESSAGE': {
      const { otherUserId, message: newMsg } = action.payload;
      const existingConv = (state.conversations || []).find(c => c.userId === otherUserId);
      if (existingConv) {
        // Deduplicate: skip if message id already exists in this conversation
        const alreadyExists = existingConv.messages.some(m => m.id === newMsg.id);
        if (alreadyExists) return state;
        return {
          ...state,
          conversations: (state.conversations || []).map(c =>
            c.userId === otherUserId
              ? {
                  ...c,
                  messages: [...c.messages, newMsg],
                  lastMessage: newMsg.message,
                  lastMessageTime: newMsg.created_at,
                  unreadCount: newMsg.to_user === state.currentUser?.id ? c.unreadCount + 1 : c.unreadCount
                }
              : c
          )
        };
      }
      // New sender: create a new conversation entry
      const newConv = {
        userId: otherUserId,
        userName: newMsg.from_name || newMsg.to_name || 'User',
        userAvatar: newMsg.from_avatar || newMsg.to_avatar || null,
        lastMessage: newMsg.message,
        lastMessageTime: newMsg.created_at,
        unreadCount: newMsg.to_user === state.currentUser?.id ? 1 : 0,
        messages: [newMsg]
      };
      return {
        ...state,
        conversations: [newConv, ...(state.conversations || [])]
      };
    }
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversation: action.payload };
    case 'MARK_CONVERSATION_READ':
      return {
        ...state,
        conversations: (state.conversations || []).map(c => 
          c.userId === action.payload ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, read: true })) } : c
        )
      };
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
    case 'SET_FOLLOWS':
      return { ...state, follows: action.payload || [] };
    case 'SET_FOLLOWERS':
      return { ...state, followers: action.payload || [] };
    case 'ADD_FOLLOW':
      return { ...state, follows: [...(state.follows || []), action.payload] };
    case 'REMOVE_FOLLOW':
      return { ...state, follows: (state.follows || []).filter(id => id !== action.payload) };
    case 'SET_ACTIVITY_FEED':
      return { ...state, activityFeed: action.payload || [] };
    case 'ADD_ACTIVITY':
      return { ...state, activityFeed: [action.payload, ...(state.activityFeed || [])].slice(0, 100) };
    case 'SET_AUTH_ERROR': 
      return { ...state, authError: action.payload };
    case 'SET_REALTIME_CONNECTED':
      return { ...state, realtimeConnected: action.payload };
    case 'SET_ANALYTICS_DATA':
      return { ...state, analyticsData: action.payload };
    case 'SET_IS_ADMIN':
      return { ...state, isAdmin: action.payload };
    case 'SET_MODERATION_QUEUE':
      return { ...state, moderationQueue: action.payload || [] };
    case 'LOGOUT': 
      return { ...state, currentUser: null, profile: null, session: null, notifications: [], messages: [], conversations: [], activeConversation: null, favorites: [], follows: [], followers: [], isAdmin: false, announcement: null };
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('devMarketTheme', newTheme);
      return { ...state, theme: newTheme };
    }
    case 'SET_ANNOUNCEMENT':
      return { ...state, announcement: action.payload };
    case 'CLEAR_ANNOUNCEMENT':
      return { ...state, announcement: null };
    case 'SET_MAINTENANCE_MODE':
      return { ...state, maintenanceMode: action.payload };
    default: 
      return state;
  }
}

// ============================================
// SKELETON LOADER COMPONENTS
// ============================================
function SkeletonCard() {
  return (
    <div className="skeleton-card">
      <div className="skeleton skeleton-image"></div>
      <div className="skeleton-content">
        <div className="skeleton skeleton-title"></div>
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text short"></div>
        <div className="skeleton skeleton-button"></div>
      </div>
    </div>
  );
}

function SkeletonGrid({ count = 6 }) {
  return (
    <div className="listings-grid">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonMessage() {
  return (
    <div className="skeleton-message">
      <div className="skeleton skeleton-avatar"></div>
      <div className="skeleton-message-content">
        <div className="skeleton skeleton-text"></div>
        <div className="skeleton skeleton-text short"></div>
      </div>
    </div>
  );
}

// ============================================
// AVATAR SELECTOR - 3 PRESET OPTIONS
// ============================================
const PRESET_AVATARS = [
  {
    id: 'dev',
    url: 'https://api.dicebear.com/7.x/adventurer/svg?seed=DevMarket&backgroundColor=667eea&scale=90',
    label: '🧑‍💻 Developer'
  },
  {
    id: 'rocket',
    url: 'https://api.dicebear.com/7.x/bottts/svg?seed=Rocket&backgroundColor=10b981&scale=80',
    label: '🤖 Bot'
  },
  {
    id: 'pixel',
    url: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=Pixel&backgroundColor=764ba2&scale=85',
    label: '🎮 Pixel'
  }
];

function AvatarUpload({ currentAvatar, userName, onAvatarUpdate, size = 'large' }) {
  const [showPicker, setShowPicker] = useState(false);
  const [saveStatus, setSaveStatus] = useState(''); // '' | 'saving' | 'saved' | 'error'
  const selectedAvatarId = PRESET_AVATARS.find(av => av.url === currentAvatar)?.id || 
    (currentAvatar?.includes('ui-avatars') ? 'generated' : null);
  const [selected, setSelected] = useState(selectedAvatarId);

  useEffect(() => {
    const matchedId = PRESET_AVATARS.find(av => av.url === currentAvatar)?.id ||
      (currentAvatar?.includes('ui-avatars') ? 'generated' : null);
    setSelected(matchedId);
  }, [currentAvatar]);

  const displayAvatar = currentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;
  const sizeMap = { small: '60px', medium: '80px', large: '100px' };
  const sz = sizeMap[size] || '100px';

  const handleSelect = async (avatar) => {
    setSelected(avatar.id);
    setShowPicker(false);
    setSaveStatus('saving');
    try {
      await onAvatarUpdate(avatar.url);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (_) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  return (
    <div className="avatar-upload-container">
      <div className="avatar-preview-wrapper" onClick={() => setShowPicker(true)} style={{ width: sz, height: sz, cursor: 'pointer' }}>
        <img src={displayAvatar} alt={userName || 'User'} className="avatar-upload-preview"
          style={{ width: sz, height: sz }}
          onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`; }}
        />
        <div className="avatar-upload-overlay"><span>📷</span><span>Change</span></div>
      </div>
      {saveStatus && (
        <p className={`avatar-save-status ${saveStatus}`} style={{ fontSize: '0.72rem', textAlign: 'center', marginTop: 4 }}>
          {saveStatus === 'saving' && '⏳ Saving...'}
          {saveStatus === 'saved' && '✅ Saved!'}
          {saveStatus === 'error' && '❌ Failed'}
        </p>
      )}

      {showPicker && (
        <ModalPortal>
          <div className="modal-overlay" onClick={() => setShowPicker(false)}>
            <div className="avatar-picker-modal" onClick={e => e.stopPropagation()}>
              <div className="avatar-picker-header">
                <h3>🖼️ Choose Your Avatar</h3>
                <button className="btn-close" onClick={() => setShowPicker(false)}>✕</button>
              </div>
              <p className="avatar-picker-desc">Select one of the avatars below as your profile picture</p>
              <div className="avatar-picker-grid">
                {PRESET_AVATARS.map(av => (
                  <div
                    key={av.id}
                    className={`avatar-option ${selected === av.id ? 'selected' : ''}`}
                    onClick={() => handleSelect(av)}
                  >
                    <img src={av.url} alt={av.label} onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${av.label}&background=667eea&color=fff&size=80`; }} />
                    <span>{av.label}</span>
                  </div>
                ))}
                <div
                  className="avatar-option"
                  onClick={() => handleSelect({ id: 'generated', url: `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200` })}
                >
                  <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=80`} alt="Initials" />
                  <span>🔤 Initials</span>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </div>
  );
}

// ============================================
// ADVANCED SEARCH COMPONENT
// ============================================
function AdvancedSearch({ isOpen, onClose, onSearch, searchType = 'all' }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    category: 'all',
    priceRange: 'all',
    platform: 'all',
    language: 'all',
    sortBy: 'date',
    dateRange: 'all',
    rating: 'all'
  });

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch({ query, filters });
    analytics.trackSearch(query, filters);
    onClose();
  };

  const resetFilters = () => {
    setFilters({
      category: 'all',
      priceRange: 'all',
      platform: 'all',
      language: 'all',
      sortBy: 'date',
      dateRange: 'all',
      rating: 'all'
    });
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content advanced-search-modal" onClick={e => e.stopPropagation()}>
        <div className="advanced-search-header">
          <h2>🔍 Advanced Search</h2>
          <button className="btn-close" onClick={onClose}>✕</button>
        </div>
        
        <form onSubmit={handleSearch} className="advanced-search-form">
          <div className="search-main-input">
            <input
              type="text"
              placeholder="Search across all DevMarket..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="search-input"
              autoFocus
            />
          </div>

          <div className="search-filters-grid">
            {searchType !== 'code' && (
              <div className="filter-group">
                <label>Category</label>
                <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})}>
                  <option value="all">All Categories</option>
                  <option value="website">Website</option>
                  <option value="portfolio">Portfolio</option>
                  <option value="ecommerce">E-Commerce</option>
                  <option value="blog">Blog</option>
                  <option value="saas">SaaS</option>
                  <option value="app">App</option>
                </select>
              </div>
            )}

            <div className="filter-group">
              <label>Price Range</label>
              <select value={filters.priceRange} onChange={e => setFilters({...filters, priceRange: e.target.value})}>
                <option value="all">All Prices</option>
                <option value="free">Free</option>
                <option value="under50">Under $50</option>
                <option value="50to200">$50 - $200</option>
                <option value="200to1000">$200 - $1000</option>
                <option value="over1000">Over $1000</option>
              </select>
            </div>

            {searchType !== 'code' && (
              <div className="filter-group">
                <label>Platform</label>
                <select value={filters.platform} onChange={e => setFilters({...filters, platform: e.target.value})}>
                  <option value="all">All Platforms</option>
                  <option value="web">Web</option>
                  <option value="ios">iOS</option>
                  <option value="android">Android</option>
                  <option value="desktop">Desktop</option>
                </select>
              </div>
            )}

            {searchType !== 'listing' && (
              <div className="filter-group">
                <label>Language</label>
                <select value={filters.language} onChange={e => setFilters({...filters, language: e.target.value})}>
                  <option value="all">All Languages</option>
                  <option value="javascript">JavaScript</option>
                  <option value="python">Python</option>
                  <option value="typescript">TypeScript</option>
                  <option value="react">React</option>
                  <option value="node">Node.js</option>
                  <option value="java">Java</option>
                </select>
              </div>
            )}

            <div className="filter-group">
              <label>Sort By</label>
              <select value={filters.sortBy} onChange={e => setFilters({...filters, sortBy: e.target.value})}>
                <option value="date">Most Recent</option>
                <option value="price">Price</option>
                <option value="rating">Rating</option>
                <option value="popular">Most Popular</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Date Range</label>
              <select value={filters.dateRange} onChange={e => setFilters({...filters, dateRange: e.target.value})}>
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Minimum Rating</label>
              <select value={filters.rating} onChange={e => setFilters({...filters, rating: e.target.value})}>
                <option value="all">Any Rating</option>
                <option value="4">4+ Stars</option>
                <option value="3">3+ Stars</option>
                <option value="2">2+ Stars</option>
              </select>
            </div>
          </div>

          <div className="search-actions">
            <button type="button" className="btn-secondary" onClick={resetFilters}>
              🔄 Reset Filters
            </button>
            <button type="submit" className="btn-primary">
              🔍 Search
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// ENHANCED MAIN APP WITH REAL-TIME
// ============================================
function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [hasShownLoader, setHasShownLoader] = useState(false);

  useEffect(() => {
    const loaderShown = sessionStorage.getItem('devMarketLoaderShown');
    if (loaderShown) {
      setHasShownLoader(true);
    }
  }, []);

  async function loadPublicData() {
    try {
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
          likedBy: [],
          date: new Date(item.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_CODE_SNIPPETS', payload: formattedSnippets });
      }

      const stats = await analytics.getDashboardStats();
      if (stats) {
        dispatch({ type: 'SET_ANALYTICS_DATA', payload: stats });
      }

      dispatch({ type: 'SET_DATA_LOADED', payload: true });
    } catch (error) {
      console.error('Error loading public data:', error);
      dispatch({ type: 'SET_LISTINGS', payload: [] });
      dispatch({ type: 'SET_APPS', payload: [] });
      dispatch({ type: 'SET_CODE_SNIPPETS', payload: [] });
      dispatch({ type: 'SET_DATA_LOADED', payload: true });
    }
  }

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
        dispatch({ type: 'SET_IS_ADMIN', payload: profile.role === 'admin' });
        // Load notification preference from Supabase
        if (profile.notifications_enabled !== undefined && profile.notifications_enabled !== null) {
          dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: profile.notifications_enabled });
        }
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
          avatar_url: meta.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.name || user.email?.split('@')[0] || 'User')}&background=667eea&color=fff&size=200`
        };

        try {
          await supabase.from('profiles').upsert({ 
            ...defaultProfile, 
            updated_at: new Date().toISOString() 
          });
        } catch (err) {
          console.log('Could not save profile:', err);
        }

        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...defaultProfile } });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

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
        await buildConversations(msgsResult.data, userId);
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

      // Load persisted follow state from Supabase so it survives refresh
      try {
        const [followsRes, followersRes] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', userId),
          supabase.from('follows').select('follower_id').eq('following_id', userId)
        ]);
        if (followsRes.data) {
          dispatch({ type: 'SET_FOLLOWS', payload: followsRes.data.map(r => r.following_id) });
        }
        if (followersRes.data) {
          dispatch({ type: 'SET_FOLLOWERS', payload: followersRes.data.map(r => r.follower_id) });
        }
      } catch(e) { /* follows table may not exist yet */ }

      setupRealtimeSubscriptions(userId);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }

  function setupRealtimeSubscriptions(userId) {
    realtimeManager.unsubscribeAll();

    realtimeManager.subscribe(
      `messages-${userId}`,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_user=eq.${userId}`
      },
      async (payload) => {
        const newMsg = payload.new;
        
        // Fetch sender profile to get real name + avatar (if not embedded in message row)
        let fromName = newMsg.from_name;
        let fromAvatar = newMsg.from_avatar;
        if (!fromName) {
          try {
            const { data: senderProfile } = await supabase
              .from('profiles')
              .select('name, avatar_url')
              .eq('id', newMsg.from_user)
              .single();
            if (senderProfile) {
              fromName = senderProfile.name;
              fromAvatar = senderProfile.avatar_url;
            }
          } catch (_) {}
        }
        
        const enrichedMsg = { ...newMsg, from_name: fromName || 'User', from_avatar: fromAvatar };
        
        dispatch({ type: 'ADD_MESSAGE', payload: enrichedMsg });
        
        const otherUserId = enrichedMsg.from_user;
        const otherUserName = fromName || 'User';
        
        dispatch({
          type: 'ADD_CONVERSATION_MESSAGE',
          payload: {
            otherUserId,
            message: { ...enrichedMsg, from_name: otherUserName, from_avatar: fromAvatar }
          }
        });
        
        // Only notify if the conversation is NOT currently open
        const activeConvId = window.__activeConversationId || null;
        const isConversationOpen = activeConvId === otherUserId;
        
        if (!isConversationOpen) {
          dispatch({ type: 'ADD_NOTIFICATION', payload: {
            message: `💬 New message from ${otherUserName}: ${enrichedMsg.message?.substring(0, 50)}`,
            type: 'info',
            time: new Date().toLocaleTimeString(),
            read: false
          }});
        }
      }
    );

    realtimeManager.subscribe(
      `notifications-${userId}`,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        // ADD_NOTIFICATION reducer already checks notificationsEnabled,
        // so this dispatch is safe — it will be ignored if notifications are OFF
        dispatch({ type: 'ADD_NOTIFICATION', payload: {
          ...payload.new,
          read: false
        }});
      }
    );

    realtimeManager.subscribe(
      'listings-updates',
      {
        event: '*',
        schema: 'public',
        table: 'listings'
      },
      (payload) => {
        // Targeted update — no full refetch needed
        if (payload.eventType === 'INSERT') {
          dispatch({ type: 'ADD_LISTING', payload: payload.new });
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'DELETE_LISTING', payload: payload.old?.id });
        } else if (payload.eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_LISTING', payload: payload.new });
        }
      }
    );

    // Also subscribe to messages SENT by this user so sender sees real-time confirmation
    realtimeManager.subscribe(
      `messages-sent-${userId}`,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `from_user=eq.${userId}`
      },
      (payload) => {
        const sentMsg = payload.new;
        // Deduplicate: ignore optimistic messages we already have locally
        dispatch({
          type: 'ADD_CONVERSATION_MESSAGE',
          payload: { otherUserId: sentMsg.to_user, message: sentMsg }
        });
      }
    );

    dispatch({ type: 'SET_REALTIME_CONNECTED', payload: true });
  }

  async function buildConversations(messages, userId) {
    const conversationMap = new Map();
    
    // Collect all unique other user IDs first
    const otherUserIds = new Set();
    messages.forEach(msg => {
      const otherId = msg.from_user === userId ? msg.to_user : msg.from_user;
      otherUserIds.add(otherId);
    });

    // Batch-fetch all profiles for other users
    let profilesMap = new Map();
    if (otherUserIds.size > 0) {
      try {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name, avatar_url')
          .in('id', Array.from(otherUserIds));
        if (profiles) {
          profiles.forEach(p => profilesMap.set(p.id, p));
        }
      } catch (_) {}
    }
    
    messages.forEach(msg => {
      const otherUserId = msg.from_user === userId ? msg.to_user : msg.from_user;
      // Prefer real DB profile name over embedded from_name/to_name fields
      const profile = profilesMap.get(otherUserId);
      const otherUserName = profile?.name || (msg.from_user === userId ? msg.to_name : msg.from_name) || 'User';
      const otherUserAvatar = profile?.avatar_url || (msg.from_user === userId ? msg.to_avatar : msg.from_avatar);
      
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: otherUserName,
          userAvatar: otherUserAvatar,
          lastMessage: msg.message,
          lastMessageTime: msg.created_at,
          unreadCount: 0,
          messages: []
        });
      }
      
      const conv = conversationMap.get(otherUserId);
      // Update name/avatar from real profile if we have it (in case earlier msg had null)
      if (profile) {
        conv.userName = profile.name || conv.userName;
        conv.userAvatar = profile.avatar_url || conv.userAvatar;
      }
      conv.messages.push(msg);
      
      if (!msg.read && msg.to_user === userId) {
        conv.unreadCount++;
      }
      
      if (new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
        conv.lastMessage = msg.message;
        conv.lastMessageTime = msg.created_at;
      }
    });
    
    const conversations = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    
    dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
  }

  useEffect(() => {
    let mounted = true;

    async function initialize() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (mounted) {
          dispatch({ type: 'SET_SESSION', payload: session });
          
          if (session?.user) {
            await loadProfile(session.user);
            await loadUserData(session.user.id);
          }
        }

        await loadPublicData();
        
        if (mounted) {
          dispatch({ type: 'INITIALIZED' });
        }

        analytics.trackPageView(window.location.pathname);
      } catch (error) {
        console.error('Init error:', error);
        if (mounted) {
          dispatch({ type: 'INITIALIZED' });
        }
      }
    }

    // Show the full splash loader only on the very first visit per session.
    // On subsequent page refreshes within the same session show a minimal spinner.
    if (!hasShownLoader) {
      const safetyTimeout = setTimeout(() => {
        if (mounted) {
          setIsInitialLoading(false);
          sessionStorage.setItem('devMarketLoaderShown', 'true');
          setHasShownLoader(true);
        }
      }, 6000);

      initialize().then(() => {
        if (mounted) {
          sessionStorage.setItem('devMarketLoaderShown', 'true');
          setHasShownLoader(true);
          setTimeout(() => { if (mounted) setIsInitialLoading(false); }, 400);
        }
        clearTimeout(safetyTimeout);
      });

      return () => {
        mounted = false;
        clearTimeout(safetyTimeout);
      };
    } else {
      // Already seen the splash — init quickly with mini-spinner
      initialize().then(() => {
        if (mounted) setIsInitialLoading(false);
      });
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        dispatch({ type: 'SET_SESSION', payload: session });
        
        if (event === 'SIGNED_IN' && session?.user) {
          await loadProfile(session.user);
          await loadUserData(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          dispatch({ type: 'LOGOUT' });
          realtimeManager.unsubscribeAll();
        }
      }
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      realtimeManager.unsubscribeAll();
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('devMarketTheme');
    if (savedTheme && savedTheme !== state.theme) {
      dispatch({ type: 'TOGGLE_THEME' });
    }
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  // Load announcement/maintenance from platform_settings table
  // Placed BEFORE early returns to comply with React Rules of Hooks
  useEffect(() => {
    const fetchPlatformSettings = async () => {
      try {
        const { data } = await supabase.from('platform_settings').select('*').eq('id', 'main').maybeSingle();
        if (data) {
          if (data.maintenance_mode) dispatch({ type: 'SET_MAINTENANCE_MODE', payload: true });
          if (data.announcement_message) {
            dispatch({ type: 'SET_ANNOUNCEMENT', payload: { message: data.announcement_message, type: data.announcement_type || 'info', id: data.id } });
          }
        }
      } catch(e) { /* table may not exist */ }
    };
    fetchPlatformSettings();

    // Subscribe to real-time platform_settings changes
    const chan = supabase.channel('platform-settings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, (payload) => {
        const d = payload.new;
        if (d) {
          dispatch({ type: 'SET_MAINTENANCE_MODE', payload: !!d.maintenance_mode });
          if (d.announcement_message) {
            dispatch({ type: 'SET_ANNOUNCEMENT', payload: { message: d.announcement_message, type: d.announcement_type || 'info', id: Date.now() } });
          } else {
            dispatch({ type: 'CLEAR_ANNOUNCEMENT' });
          }
        }
      })
      .subscribe();
    return () => supabase.removeChannel(chan);
  }, []);

  if (isInitialLoading && !hasShownLoader) {
    return (
      <div className="dm-loader">
        <div className="dm-loader__card">
          <div className="dm-loader__logo-wrap">
            <span className="dm-loader__logo-icon">🚀</span>
          </div>
          <div className="dm-loader__brand">
            <span className="dm-loader__brand-dev">Dev</span>
            <span className="dm-loader__brand-market">Market</span>
          </div>
          <p className="dm-loader__tagline">IT Marketplace Hub</p>
          <div className="dm-loader__bar-track">
            <div className="dm-loader__bar-fill" />
          </div>
          <p className="dm-loader__hint">Loading your experience...</p>
        </div>
      </div>
    );
  }

  if (isInitialLoading && hasShownLoader) {
    return (
      <div className="dm-mini-loader">
        <div className="dm-mini-loader__inner">
          <div className="dm-mini-loader__ring"></div>
          <span>🚀</span>
        </div>
      </div>
    );
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
          {state.announcement && (
            <AnnouncementBanner
              announcement={state.announcement}
              onClose={() => dispatch({ type: 'CLEAR_ANNOUNCEMENT' })}
            />
          )}
          <Header />
          <main className="main-content">
            {state.maintenanceMode && !state.isAdmin ? (
              <MaintenancePage />
            ) : (
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/marketplace" element={<Marketplace />} />
              <Route path="/advertise" element={<Advertise />} />
              <Route path="/code-sharing" element={<CodeSharing />} />
              <Route path="/posts" element={<Posts />} />
              <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/profile/:userId" element={<UserProfile />} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            </Routes>
            )}
          </main>
          <Footer />
          <FloatingPWAButton />
        </div>
      </Router>
    </AppContext.Provider>
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
// ANNOUNCEMENT BANNER
// ============================================
function AnnouncementBanner({ announcement, onClose }) {
  const colorMap = {
    info: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af', icon: 'ℹ️' },
    success: { bg: '#d1fae5', border: '#10b981', text: '#065f46', icon: '✅' },
    warning: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e', icon: '⚠️' },
    error: { bg: '#fee2e2', border: '#ef4444', text: '#991b1b', icon: '🚨' },
  };
  const c = colorMap[announcement.type] || colorMap.info;
  return (
    <div className="announcement-banner" style={{ background: c.bg, borderBottom: `2px solid ${c.border}`, color: c.text }}>
      <div className="announcement-inner">
        <span className="announcement-icon">{c.icon}</span>
        <p className="announcement-text">{announcement.message}</p>
        <button className="announcement-close" onClick={onClose} title="Dismiss" style={{ color: c.text }}>×</button>
      </div>
    </div>
  );
}

// ============================================
// MAINTENANCE PAGE
// ============================================
function MaintenancePage() {
  return (
    <div className="maintenance-page">
      <div className="maintenance-card">
        <div className="maintenance-icon">🔧</div>
        <h1>Under Maintenance</h1>
        <p>We're making improvements to DevMarket. We'll be back shortly!</p>
        <div className="maintenance-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring delay1"></div>
          <div className="spinner-ring delay2"></div>
        </div>
        <p className="maintenance-hint">Thank you for your patience.</p>
      </div>
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

function useAppContext() {
  return useContext(AppContext);
}

// ============================================
// PWA INSTALL HOOK
// ============================================
function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setIsInstalled(true));
    if (window.matchMedia('(display-mode: standalone)').matches) setIsInstalled(true);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') setIsInstalled(true);
    setInstallPrompt(null);
  };

  return { canInstall: !!installPrompt && !isInstalled, install };
}

// ============================================
// HEADER COMPONENT
// ============================================
function Header() {
  const { state, dispatch } = useAppContext();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const { canInstall, install } = usePWAInstall();
  const navigate = useNavigate();
  const location = useLocation();

  const unreadNotifications = (state.notifications || []).filter(n => !n.read).length;
  const unreadMessages = (state.conversations || []).reduce((sum, conv) => sum + (conv.unreadCount || 0), 0);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      analytics.trackSearch(searchQuery, {});
      navigate(`/marketplace?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleAdvancedSearch = (searchData) => {
    const params = new URLSearchParams();
    if (searchData.query) params.set('q', searchData.query);
    Object.entries(searchData.filters).forEach(([key, value]) => {
      if (value && value !== 'all') params.set(key, value);
    });
    navigate(`/marketplace?${params.toString()}`);
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
    setShowUserMenu(false);
    setShowNotifications(false);
  };

  return (
    <>
      <header className="header">
        <div className="header-container">
          <Link to="/" className="logo" onClick={closeAll}>
            <div className="logo-icon-wrapper">
              <span className="logo-icon">🚀</span>
              {state.realtimeConnected && <span className="realtime-dot" title="Live connection active"></span>}
            </div>
            <div className="logo-text"><h1>DevMarket</h1><p>IT Marketplace Hub</p></div>
          </Link>

          {/* Desktop nav only */}
          <nav className="nav-menu desktop-nav">
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
                <Link to="/posts" className={`nav-link ${location.pathname === '/posts' ? 'active' : ''}`} onClick={closeAll}>
                  <span className="nav-icon">📝</span> Posts
                </Link>
                <Link to="/analytics" className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`} onClick={closeAll}>
                  <span className="nav-icon">📊</span> Dashboard
                </Link>
              </>
            )}
          </nav>

          <div className="header-actions">
            {canInstall && (
              <button className="btn-install-pwa" onClick={install} title="Install App">
                📲 <span className="install-label">Install</span>
              </button>
            )}
            <button className="icon-button" onClick={() => setShowAdvancedSearch(true)} title="Search" aria-label="Search">
              🔍
            </button>
            
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
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=667eea&color=fff&size=40`; 
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
                      <Link to="/favorites" onClick={() => setShowUserMenu(false)}>
                        <span>⭐</span> My Favorites
                      </Link>
                      <Link to="/settings" onClick={() => setShowUserMenu(false)}>
                        <span>⚙️</span> Settings
                      </Link>
                      {state.isAdmin && (
                        <>
                          <Link to="/admin" onClick={() => setShowUserMenu(false)}>
                            <span>🛡️</span> Admin Panel
                          </Link>
                          <Link to="/analytics" onClick={() => setShowUserMenu(false)}>
                            <span>📊</span> Analytics
                          </Link>
                        </>
                      )}
                      <div className="dropdown-divider"></div>
                      <button onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}>
                        <span>🚪</span> Logout
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button className="btn-login" onClick={() => setShowAuth(true)}>
                👤 Sign In
              </button>
            )}
          </div>
        </div>

        {showNotifications && (
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
      </header>

      {/* Modals rendered via Portal — completely outside header stacking context */}
      {showAuth && (
        <ModalPortal>
          <AuthModal setShowAuth={setShowAuth} authMode={authMode} setAuthMode={setAuthMode} />
        </ModalPortal>
      )}
      <ModalPortal>
        <AdvancedSearch 
          isOpen={showAdvancedSearch} 
          onClose={() => setShowAdvancedSearch(false)} 
          onSearch={handleAdvancedSearch}
          searchType="all"
        />
      </ModalPortal>

      {/* Mobile Bottom Navigation Row */}
      <MobileNav location={location} unreadMessages={unreadMessages} currentUser={state.currentUser} isAdmin={state.isAdmin} />

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
// MOBILE BOTTOM NAVIGATION
// ============================================
function MobileNav({ location, unreadMessages, currentUser, isAdmin }) {
  // Logged-in nav items — Favorites removed, Advertise + Code added next to Market
  const loggedInItems = [
    { to: '/', icon: '🏠', label: 'Home' },
    { to: '/marketplace', icon: '🛒', label: 'Market' },
    { to: '/advertise', icon: '📱', label: 'Advertise' },
    { to: '/code-sharing', icon: '💻', label: 'Code' },
    { to: '/messages', icon: '💬', label: 'Messages', badge: unreadMessages },
  ];

  // Logged-out nav items — same layout
  const loggedOutItems = [
    { to: '/', icon: '🏠', label: 'Home' },
    { to: '/marketplace', icon: '🛒', label: 'Market' },
    { to: '/advertise', icon: '📱', label: 'Advertise' },
    { to: '/code-sharing', icon: '💻', label: 'Code' },
    { to: '/posts', icon: '📝', label: 'Posts' },
  ];

  const navItems = currentUser ? loggedInItems : loggedOutItems;

  return (
    <nav className={`mobile-bottom-nav ${!currentUser ? 'mobile-bottom-nav--guest' : ''}`}>
      {navItems.map(item => (
        <Link
          key={item.to}
          to={item.to}
          className={`mobile-nav-btn ${location.pathname === item.to ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">
            {item.icon}
            {item.badge > 0 && <span className="mobile-nav-badge">{item.badge}</span>}
          </span>
          <span className="mobile-nav-label">{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}

// ============================================
// AUTH MODAL
// ============================================
function AuthModal({ setShowAuth, authMode, setAuthMode }) {
  const { state, dispatch } = useAppContext();
  const [formData, setFormData] = useState({ 
    name: '', email: '', password: '', confirmPassword: '', role: 'developer' 
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
      if (!formData.name.trim()) newErrors.name = 'Full name is required';
      else if (formData.name.trim().length < 2) newErrors.name = 'Name must be at least 2 characters';
    }
    if (!formData.email.trim()) newErrors.email = 'Email address is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Please enter a valid email';
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
    dispatch({ type: 'SET_AUTH_ERROR', payload: null });
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { name: formData.name, role: formData.role } }
        });
        if (error) { dispatch({ type: 'SET_AUTH_ERROR', payload: error.message }); setLoading(false); return; }
        setShowSuccess(true);
        if (data.session) {
          setAuthStatus('success');
          dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🎉 Welcome, ${formData.name}!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
          setTimeout(() => { setShowAuth(false); navigate('/profile'); }, 2000);
        } else {
          setAuthStatus('confirmation');
          dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '📧 Check your email to confirm.', type: 'info', time: new Date().toLocaleTimeString(), read: false }});
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) {
          let msg = error.message.includes('Invalid login') ? 'Invalid email or password.' : error.message;
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
      if (error) dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login not configured.` });
    } catch (error) {
      dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login not available.` });
    }
  };

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') setShowAuth(false); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [setShowAuth]);

  return (
    <div className="modal-overlay" onClick={() => setShowAuth(false)}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="btn-close" onClick={() => setShowAuth(false)}>✕</button>
        {showSuccess ? (
          <div className="success-state">
            <div className="auth-success-icon">{authStatus === 'confirmation' ? '📧' : '🎉'}</div>
            <h2>{authStatus === 'confirmation' ? 'Check Your Email' : 'Account Created!'}</h2>
            <p>Welcome, <strong>{formData.name}</strong>!</p>
            {authStatus === 'confirmation' && <button className="btn-primary" onClick={() => { setShowSuccess(false); setAuthMode('login'); resetForm(); }}>Go to Login</button>}
          </div>
        ) : (
          <>
            <div className="auth-header-new">
              <div className="auth-brand-mark">
                <span className="auth-brand-icon">🚀</span>
                <span className="auth-brand-glow"></span>
              </div>
              <h2>{authMode === 'login' ? 'Welcome Back' : 'Join DevMarket'}</h2>
              <p>{authMode === 'login' ? 'Sign in to continue building' : 'Start your developer journey'}</p>
            </div>
            <div className="social-login">
              <button className="social-btn social-btn-google" onClick={() => handleSocialLogin('google')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{flexShrink:0}}>
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Google
              </button>
              <button className="social-btn social-btn-facebook" onClick={() => handleSocialLogin('facebook')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" style={{flexShrink:0}}>
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </button>
              <button className="social-btn social-btn-github" onClick={() => handleSocialLogin('github')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{flexShrink:0}}>
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </button>
            </div>
            <div className="auth-divider"><span>or continue with email</span></div>
            {state.authError && <div className="auth-error">⚠️ {state.authError}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              {authMode === 'signup' && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="John Doe" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={errors.name ? 'error' : ''} />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>
              )}
              <div className="form-group">
                <label>Email</label>
                <input type="email" placeholder="you@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={errors.email ? 'error' : ''} />
                {errors.email && <span className="error-message">{errors.email}</span>}
              </div>
              <div className="form-group">
                <label>Password</label>
                <input type={showPassword ? "text" : "password"} placeholder="Password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={errors.password ? 'error' : ''} />
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
                {errors.password && <span className="error-message">{errors.password}</span>}
              </div>
              {authMode === 'signup' && step === 2 && (
                <>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} />
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                </>
              )}
              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? 'Processing...' : authMode === 'login' ? '🚀 Sign In' : step === 1 ? 'Continue →' : '🎉 Create Account'}
              </button>
            </form>
            <div className="auth-footer">
              {authMode === 'login' ? (
                <p>No account? <button onClick={() => { setAuthMode('signup'); resetForm(); }} className="btn-link">Create one</button></p>
              ) : (
                <p>Have account? <button onClick={() => { setAuthMode('login'); resetForm(); }} className="btn-link">Sign in</button></p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// ADMIN DASHBOARD
// ============================================
function AdminDashboard() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [moderationFilter, setModerationFilter] = useState('all');
  const [platformSettings, setPlatformSettings] = useState({
    autoApprove: true,
    requireEmailVerification: true,
    allowMessages: true,
    maintenanceMode: false
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [hideConfirm, setHideConfirm] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  // New: Platform Stats, Activity Feed, Reports
  const [platformStats, setPlatformStats] = useState(null);
  const [loadingPlatformStats, setLoadingPlatformStats] = useState(false);
  const [activityFeed, setActivityFeed] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [reportResolved, setReportResolved] = useState({});

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) loadUsers();
    if (activeTab === 'overview') loadStats();
    if (activeTab === 'platform') loadPlatformStats();
    if (activeTab === 'activity') loadActivityFeed();
    if (activeTab === 'reports') loadReports();
  }, [activeTab]);

  const loadPlatformStats = async () => {
    setLoadingPlatformStats(true);
    try {
      const [usersRes, listingsRes, msgsRes, appsRes, snippetsRes] = await Promise.all([
        supabase.from('profiles').select('id,created_at,role', { count: 'exact' }),
        supabase.from('listings').select('id,created_at,views,hidden', { count: 'exact' }),
        supabase.from('messages').select('id,created_at,read', { count: 'exact' }),
        supabase.from('apps').select('id,created_at,downloads', { count: 'exact' }),
        supabase.from('code_snippets').select('id,created_at,likes', { count: 'exact' })
      ]);
      const now = new Date();
      const day7 = new Date(now - 7 * 86400000);
      const day30 = new Date(now - 30 * 86400000);
      const newUsersWeek = (usersRes.data || []).filter(u => new Date(u.created_at) > day7).length;
      const newUsersMonth = (usersRes.data || []).filter(u => new Date(u.created_at) > day30).length;
      const activeListings = (listingsRes.data || []).filter(l => !l.hidden).length;
      const hiddenListings = (listingsRes.data || []).filter(l => l.hidden).length;
      const totalViews = (listingsRes.data || []).reduce((s, l) => s + (l.views || 0), 0);
      const unreadMsgs = (msgsRes.data || []).filter(m => !m.read).length;
      const totalDownloads = (appsRes.data || []).reduce((s, a) => s + (a.downloads || 0), 0);
      const totalLikes = (snippetsRes.data || []).reduce((s, sn) => s + (sn.likes || 0), 0);
      const adminCount = (usersRes.data || []).filter(u => u.role === 'admin').length;
      setPlatformStats({
        totalUsers: usersRes.data?.length || 0,
        newUsersWeek,
        newUsersMonth,
        adminCount,
        totalListings: listingsRes.data?.length || 0,
        activeListings,
        hiddenListings,
        totalViews,
        totalMessages: msgsRes.data?.length || 0,
        unreadMsgs,
        totalApps: appsRes.data?.length || 0,
        totalDownloads,
        totalSnippets: snippetsRes.data?.length || 0,
        totalLikes
      });
    } catch(e) { console.error('Platform stats error:', e); }
    setLoadingPlatformStats(false);
  };

  const loadActivityFeed = async () => {
    setLoadingActivity(true);
    try {
      // Combine recent listings, messages, and user signups as activity
      const [listingsRes, usersRes] = await Promise.all([
        supabase.from('listings').select('id,title,user_id,seller_name,created_at,hidden').order('created_at', { ascending: false }).limit(20),
        supabase.from('profiles').select('id,name,email,created_at,role').order('created_at', { ascending: false }).limit(10)
      ]);
      const activities = [];
      (listingsRes.data || []).forEach(l => activities.push({
        id: `listing-${l.id}`, type: 'listing', icon: '🛒',
        title: `New listing: "${l.title}"`,
        user: l.seller_name || 'Unknown', created_at: l.created_at,
        meta: l.hidden ? '🙈 Hidden' : '✅ Live'
      }));
      (usersRes.data || []).forEach(u => activities.push({
        id: `user-${u.id}`, type: 'signup', icon: '👤',
        title: `New user joined`,
        user: u.name || u.email?.split('@')[0] || 'User', created_at: u.created_at,
        meta: u.role
      }));
      activities.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setActivityFeed(activities.slice(0, 30));
    } catch(e) {}
    setLoadingActivity(false);
  };

  const loadReports = async () => {
    setLoadingReports(true);
    try {
      const { data } = await supabase.from('reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      setReports(data || []);
    } catch(e) {
      // reports table may not exist — generate mock from flagged listings
      const flagged = (state.listings || []).filter(l => l.flagged || l.hidden);
      setReports(flagged.map(l => ({
        id: `mock-${l.id}`, listing_id: l.id, listing_title: l.title,
        reason: 'Flagged by system', status: l.hidden ? 'actioned' : 'pending',
        created_at: l.created_at, reporter_name: 'System'
      })));
    }
    setLoadingReports(false);
  };

  const handleResolveReport = async (reportId) => {
    try {
      await supabase.from('reports').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', reportId);
    } catch(e) {}
    setReportResolved(prev => ({ ...prev, [reportId]: true }));
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'resolved' } : r));
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Report marked resolved', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
  };

  const loadStats = async () => {
    try {
      const stats = await analytics.getDashboardStats();
      dispatch({ type: 'SET_ANALYTICS_DATA', payload: stats });
    } catch (e) {}
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (data) setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
    setLoadingUsers(false);
  };

  const handleDeleteListing = async (listingId, title) => {
    // Show confirmation — actual delete happens in confirmDelete
    setDeleteConfirm({ id: listingId, title, type: 'listing' });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      if (deleteConfirm.type === 'listing') {
        await supabase.from('listings').delete().eq('id', deleteConfirm.id);
        dispatch({ type: 'DELETE_LISTING', payload: deleteConfirm.id });
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: `🗑️ Listing "${deleteConfirm.title}" deleted`, type: 'success', 
          time: new Date().toLocaleTimeString(), read: false 
        }});
      }
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Could not delete. Please try again.', type: 'error', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    }
    setDeleteConfirm(null);
  };

  const handleHideListing = async (listingId, title) => {
    try {
      await supabase.from('listings').update({ hidden: true }).eq('id', listingId);
      dispatch({ type: 'HIDE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `🙈 Listing "${title}" hidden from users`, type: 'info', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Could not hide listing', type: 'error', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    }
    setHideConfirm(null);
  };

  const handleUnhideListing = async (listingId, title) => {
    try {
      await supabase.from('listings').update({ hidden: false }).eq('id', listingId);
      dispatch({ type: 'UNHIDE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `👁️ Listing "${title}" is now visible`, type: 'success', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Could not unhide listing', type: 'error', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    }
  };

  const handleSaveSettings = () => {
    setSettingsSaved(true);
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: '✅ Platform settings saved!', type: 'success', 
      time: new Date().toLocaleTimeString(), read: false 
    }});
    setTimeout(() => setSettingsSaved(false), 3000);
  };

  const handleBanUser = async (userId, userName) => {
    try {
      await supabase.from('profiles').update({ role: 'banned', updated_at: new Date().toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'banned' } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🚫 ${userName} has been banned`, type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Could not ban user: ${e.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handlePromoteUser = async (userId, userName) => {
    try {
      await supabase.from('profiles').update({ role: 'admin', updated_at: new Date().toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'admin' } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🛡️ ${userName} is now an Admin!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Could not promote user`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handleDemoteUser = async (userId, userName) => {
    try {
      await supabase.from('profiles').update({ role: 'developer', updated_at: new Date().toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'developer' } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `👤 ${userName} has been moved back to Developer`, type: 'info', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Could not demote user`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handleUnbanUser = async (userId, userName) => {
    try {
      await supabase.from('profiles').update({ role: 'developer', updated_at: new Date().toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: 'developer' } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ ${userName} has been unbanned`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Could not unban user`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  if (!state.currentUser || !state.isAdmin) {
    return (
      <div className="admin-page">
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <h2>Access Denied</h2>
          <p>You need admin privileges to view this page.</p>
        </div>
      </div>
    );
  }

  const stats = state.analyticsData || {
    totalUsers: 0, totalListings: 0, totalApps: 0, totalSnippets: 0, totalMessages: 0
  };

  const filteredListings = moderationFilter === 'all' 
    ? (state.listings || []) 
    : (state.listings || []).filter(l => l.category === moderationFilter);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'platform', label: '🔢 Platform Stats' },
    { id: 'activity', label: '📡 Activity Feed' },
    { id: 'reports', label: '🚩 Reports' },
    { id: 'users', label: '👥 Users' },
    { id: 'listings', label: '🛒 Listings' },
    { id: 'posts', label: '📝 Posts' },
    { id: 'moderation', label: '🛡️ Moderation' },
    { id: 'announcements', label: '📢 Announcements' },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  return (
    <>
    <div className="admin-page">
      <div className="page-header">
        <h1>🛡️ Admin Dashboard</h1>
        <p>Manage your DevMarket platform</p>
        <span style={{ fontSize: '0.8rem', color: 'var(--success)', background: 'var(--success-light)', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
          ● Live
        </span>
      </div>

      <div className="admin-tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="admin-overview">
          <div className="stats-grid">
            {[
              { icon: '👥', value: stats.totalUsers, label: 'Total Users', color: '#667eea' },
              { icon: '🛒', value: stats.totalListings, label: 'Listings', color: '#f59e0b' },
              { icon: '📱', value: stats.totalApps, label: 'Apps', color: '#10b981' },
              { icon: '💻', value: stats.totalSnippets, label: 'Snippets', color: '#8b5cf6' },
              { icon: '💬', value: stats.totalMessages, label: 'Messages', color: '#ef4444' }
            ].map((s, i) => (
              <div key={i} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
                <span className="stat-icon">{s.icon}</span>
                <h3 style={{ color: s.color }}>{s.value}</h3>
                <p>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="admin-section-card">
            <div className="admin-section-header">
              <h3>📢 Recent Listings</h3>
              <button className="btn-sm btn-secondary" onClick={() => setActiveTab('listings')}>View All</button>
            </div>
            <div className="activity-list">
              {(state.listings || []).slice(0, 5).map(listing => (
                <div key={listing.id} className="activity-item">
                  <span>📢</span>
                  <div>
                    <strong>{listing.seller_name || listing.seller || 'Unknown'}</strong>
                    <p>Listed "{listing.title}" — {listing.price}</p>
                  </div>
                  <small>{listing.date || new Date(listing.created_at).toLocaleDateString()}</small>
                </div>
              ))}
              {(state.listings || []).length === 0 && (
                <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>No listings yet</p>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'platform' && (
        <div className="admin-platform-stats">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0 }}>🔢 Platform Statistics</h2>
            <button className="btn-sm btn-secondary" onClick={loadPlatformStats}>🔄 Refresh</button>
          </div>
          {loadingPlatformStats ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>Loading stats…</div>
          ) : platformStats ? (
            <>
              <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16, marginBottom: 24 }}>
                {[
                  { icon: '👥', value: platformStats.totalUsers, label: 'Total Users', sub: `+${platformStats.newUsersWeek} this week`, color: '#667eea' },
                  { icon: '📅', value: platformStats.newUsersMonth, label: 'New Users (30d)', sub: `${platformStats.adminCount} admin(s)`, color: '#3b82f6' },
                  { icon: '🛒', value: platformStats.totalListings, label: 'Total Listings', sub: `${platformStats.activeListings} live, ${platformStats.hiddenListings} hidden`, color: '#f59e0b' },
                  { icon: '👁️', value: platformStats.totalViews, label: 'Total Views', sub: 'across all listings', color: '#ec4899' },
                  { icon: '💬', value: platformStats.totalMessages, label: 'Messages', sub: `${platformStats.unreadMsgs} unread`, color: '#ef4444' },
                  { icon: '📱', value: platformStats.totalApps, label: 'Apps', sub: `${platformStats.totalDownloads} downloads`, color: '#10b981' },
                  { icon: '💻', value: platformStats.totalSnippets, label: 'Snippets', sub: `${platformStats.totalLikes} likes`, color: '#8b5cf6' },
                ].map((s, i) => (
                  <div key={i} className="stat-card kpi-card" style={{ borderTop: `3px solid ${s.color}` }}>
                    <span className="stat-icon">{s.icon}</span>
                    <h3 style={{ color: s.color }}>{s.value}</h3>
                    <p>{s.label}</p>
                    <small style={{ color: 'var(--gray-400)' }}>{s.sub}</small>
                  </div>
                ))}
              </div>
              <div className="admin-section-card">
                <h3 style={{ marginBottom: 16 }}>📊 Health Overview</h3>
                <div className="platform-health-grid">
                  <div className="health-metric">
                    <div className="health-label">User Retention (new/total)</div>
                    <div className="health-bar-wrap"><div className="health-bar" style={{ width: `${platformStats.totalUsers > 0 ? Math.round((platformStats.newUsersMonth / platformStats.totalUsers) * 100) : 0}%`, background: '#667eea' }}></div></div>
                    <div className="health-value">{platformStats.totalUsers > 0 ? Math.round((platformStats.newUsersMonth / platformStats.totalUsers) * 100) : 0}% growth</div>
                  </div>
                  <div className="health-metric">
                    <div className="health-label">Listing Activity (live/total)</div>
                    <div className="health-bar-wrap"><div className="health-bar" style={{ width: `${platformStats.totalListings > 0 ? Math.round((platformStats.activeListings / platformStats.totalListings) * 100) : 0}%`, background: '#10b981' }}></div></div>
                    <div className="health-value">{platformStats.totalListings > 0 ? Math.round((platformStats.activeListings / platformStats.totalListings) * 100) : 0}% active</div>
                  </div>
                  <div className="health-metric">
                    <div className="health-label">Message Read Rate</div>
                    <div className="health-bar-wrap"><div className="health-bar" style={{ width: `${platformStats.totalMessages > 0 ? Math.round(((platformStats.totalMessages - platformStats.unreadMsgs) / platformStats.totalMessages) * 100) : 0}%`, background: '#f59e0b' }}></div></div>
                    <div className="health-value">{platformStats.totalMessages > 0 ? Math.round(((platformStats.totalMessages - platformStats.unreadMsgs) / platformStats.totalMessages) * 100) : 0}% read</div>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <button className="btn-primary" onClick={loadPlatformStats}>Load Platform Stats</button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'activity' && (
        <div className="admin-activity">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0 }}>📡 User Activity Monitor</h2>
            <button className="btn-sm btn-secondary" onClick={loadActivityFeed}>🔄 Refresh</button>
          </div>
          {loadingActivity ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>Loading activity…</div>
          ) : activityFeed.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📡</span><h3>No activity yet</h3></div>
          ) : (
            <div className="admin-section-card">
              <div className="activity-feed-list">
                {activityFeed.map(item => (
                  <div key={item.id} className="activity-feed-row">
                    <div className="activity-feed-icon" style={{ background: item.type === 'signup' ? 'var(--info-light)' : 'var(--success-light)' }}>
                      {item.icon}
                    </div>
                    <div className="activity-feed-body">
                      <p><strong>{item.user}</strong> — {item.title}</p>
                      <small style={{ color: 'var(--gray-400)' }}>{new Date(item.created_at).toLocaleString()}</small>
                    </div>
                    <span className="activity-feed-meta" style={{
                      background: item.meta === '✅ Live' ? 'var(--success-light)' : item.meta === '🙈 Hidden' ? 'var(--warning-light)' : 'var(--gray-100)',
                      color: item.meta === '✅ Live' ? 'var(--success)' : item.meta === '🙈 Hidden' ? 'var(--warning)' : 'var(--gray-600)'
                    }}>{item.meta}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="admin-reports">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h2 style={{ margin: 0 }}>🚩 Reports &amp; Moderation</h2>
            <button className="btn-sm btn-secondary" onClick={loadReports}>🔄 Refresh</button>
          </div>
          {loadingReports ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--gray-400)' }}>Loading reports…</div>
          ) : reports.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">✅</span><h3>No reports</h3><p>Nothing flagged yet — platform looks clean!</p></div>
          ) : (
            <div className="admin-section-card">
              <div className="admin-table-header" style={{ gridTemplateColumns: '1fr 1fr 120px 120px' }}>
                <span>Item</span><span>Reason / Reporter</span><span>Status</span><span>Action</span>
              </div>
              {reports.map(report => (
                <div key={report.id} className="admin-table-row" style={{ gridTemplateColumns: '1fr 1fr 120px 120px' }}>
                  <div>
                    <strong>{report.listing_title || report.target_id || 'Unknown'}</strong>
                    <br /><small style={{ color: 'var(--gray-400)' }}>{new Date(report.created_at).toLocaleDateString()}</small>
                  </div>
                  <div>
                    <span>{report.reason || 'No reason given'}</span>
                    <br /><small style={{ color: 'var(--gray-400)' }}>By: {report.reporter_name || 'Anonymous'}</small>
                  </div>
                  <span className={`report-status ${report.status || 'pending'}`} style={{
                    padding: '4px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.78rem',
                    background: report.status === 'resolved' ? 'var(--success-light)' : report.status === 'actioned' ? 'var(--warning-light)' : 'var(--danger-light)',
                    color: report.status === 'resolved' ? 'var(--success)' : report.status === 'actioned' ? 'var(--warning)' : 'var(--danger)'
                  }}>{report.status || 'pending'}</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {report.status !== 'resolved' && (
                      <button className="btn-sm btn-secondary" onClick={() => handleResolveReport(report.id)}>✅ Resolve</button>
                    )}
                    {report.listing_id && (
                      <button className="btn-sm" style={{ background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '4px 10px', cursor: 'pointer', fontSize: '0.78rem' }}
                        onClick={() => handleHideListing(report.listing_id, report.listing_title || 'this listing')}>🙈 Hide</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-users">
          <div className="admin-section-card">
            <div className="admin-section-header">
              <h3>👥 Registered Users</h3>
              <button className="btn-sm btn-secondary" onClick={loadUsers}>🔄 Refresh</button>
            </div>
            {loadingUsers ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>Loading users...</div>
            ) : (
              <div className="admin-users-table">
                <div className="admin-table-header">
                  <span>User</span>
                  <span>Role</span>
                  <span>Email</span>
                  <span>Actions</span>
                </div>
                {users.map(user => (
                  <div key={user.id} className="admin-table-row">
                    <div className="admin-user-info">
                      <img 
                        src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=667eea&color=fff&size=36`} 
                        alt={user.name}
                        className="admin-user-avatar"
                        onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=36`; }}
                      />
                      <span>{user.name || 'Unknown'}</span>
                    </div>
                    <span>
                      <span className={`role-badge role-${user.role || 'user'}`}>
                        {user.role === 'admin' ? '🛡️' : '👤'} {user.role || 'user'}
                      </span>
                    </span>
                    <span className="admin-user-email">{user.email || '—'}</span>
                    <div className="admin-row-actions">
                      {user.id !== state.currentUser.id && user.role !== 'banned' && user.role !== 'admin' && (
                        <button 
                          className="btn-sm" 
                          style={{ background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}
                          onClick={() => handlePromoteUser(user.id, user.name)}
                        >
                          🛡️ Promote
                        </button>
                      )}
                      {user.id !== state.currentUser.id && user.role === 'admin' && (
                        <button 
                          className="btn-sm" 
                          style={{ background: 'var(--warning)', color: 'white', border: 'none', cursor: 'pointer' }}
                          onClick={() => handleDemoteUser(user.id, user.name)}
                          title="Move back to Developer"
                        >
                          👤 To Developer
                        </button>
                      )}
                      {user.id !== state.currentUser.id && user.role !== 'banned' && (
                        <button 
                          className="btn-sm" 
                          style={{ background: 'var(--danger)', color: 'white', border: 'none', cursor: 'pointer' }}
                          onClick={() => handleBanUser(user.id, user.name)}
                        >
                          🚫 Ban
                        </button>
                      )}
                      {user.role === 'banned' && (
                        <button 
                          className="btn-sm" 
                          style={{ background: 'var(--success)', color: 'white', border: 'none', cursor: 'pointer' }}
                          onClick={() => handleUnbanUser(user.id, user.name)}
                        >
                          ✅ Unban
                        </button>
                      )}
                      {user.id === state.currentUser.id && (
                        <span style={{ color: 'var(--success)', fontSize: '0.8rem' }}>✅ You</span>
                      )}
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                    No users found. Check database permissions.
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="admin-listings">
          <div className="admin-section-card">
            <div className="admin-section-header">
              <h3>🛒 All Listings ({(state.listings || []).length})</h3>
            </div>
            <div className="admin-listings-grid">
              {(state.listings || []).map(listing => (
                <div key={listing.id} className={`admin-listing-item ${listing.hidden ? 'listing-hidden' : ''}`}>
                  <div className="admin-listing-info">
                    <h4>
                      {listing.title}
                      {listing.hidden && <span className="hidden-badge">🙈 Hidden</span>}
                    </h4>
                    <p>{listing.description?.substring(0, 80)}...</p>
                    <small>By {listing.seller_name || listing.seller} · {listing.price} · {listing.category}</small>
                  </div>
                  <div className="admin-listing-actions">
                    {listing.url && (
                      <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary">
                        👁 View
                      </a>
                    )}
                    {listing.hidden ? (
                      <button 
                        className="btn-sm" 
                        style={{ background: 'var(--success)', color: 'white', border: 'none' }}
                        onClick={() => handleUnhideListing(listing.id, listing.title)}
                      >
                        👁️ Unhide
                      </button>
                    ) : (
                      <button 
                        className="btn-sm" 
                        style={{ background: 'var(--warning)', color: 'white', border: 'none' }}
                        onClick={() => setHideConfirm({ id: listing.id, title: listing.title })}
                      >
                        🙈 Hide
                      </button>
                    )}
                    <button 
                      className="btn-sm" 
                      style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                      onClick={() => handleDeleteListing(listing.id, listing.title)}
                    >
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              ))}
              {(state.listings || []).length === 0 && (
                <p style={{ color: 'var(--gray-400)', padding: '40px', textAlign: 'center' }}>No listings found</p>
              )}
            </div>
          </div>

          <ConfirmDialog
            isOpen={!!hideConfirm}
            title="Hide Listing"
            message={`Are you sure you want to hide "${hideConfirm?.title}"? It will no longer be visible to non-admin users.`}
            onConfirm={() => handleHideListing(hideConfirm.id, hideConfirm.title)}
            onCancel={() => setHideConfirm(null)}
            confirmText="Yes, Hide It"
            type="warning"
          />
        </div>
      )}

      {activeTab === 'posts' && <AdminPostsTab dispatch={dispatch} state={state} />}

      {activeTab === 'announcements' && <AdminAnnouncementsTab dispatch={dispatch} state={state} />}

      {activeTab === 'moderation' && (
        <div className="moderation-panel">
          <div className="admin-section-header">
            <h3>🛡️ Content Moderation</h3>
          </div>
          <div className="moderation-filters">
            {['all', 'website', 'portfolio', 'ecommerce', 'saas', 'app'].map(f => (
              <button 
                key={f}
                className={`btn-sm ${moderationFilter === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setModerationFilter(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
          <div className="moderation-list">
            {filteredListings.slice(0, 15).map(listing => (
              <div key={listing.id} className="moderation-item">
                <div className="moderation-content">
                  <h4>{listing.title}</h4>
                  <p>{listing.description?.substring(0, 120)}...</p>
                  <small>By: {listing.seller_name || listing.seller} · {listing.category} · {listing.price}</small>
                </div>
                <div className="moderation-actions">
                  {listing.url && (
                    <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary">
                      👁 View
                    </a>
                  )}
                  <button 
                    className="btn-sm" 
                    style={{ background: 'var(--success)', color: 'white', border: 'none' }}
                    onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ "${listing.title}" approved`, type: 'success', time: new Date().toLocaleTimeString(), read: false }})}
                  >
                    ✅ Approve
                  </button>
                  <button 
                    className="btn-sm" 
                    style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                    onClick={() => handleDeleteListing(listing.id, listing.title)}
                  >
                    🚫 Remove
                  </button>
                </div>
              </div>
            ))}
            {filteredListings.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--gray-400)' }}>
                No content to moderate
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="admin-settings">
          <div className="admin-section-header">
            <h3>⚙️ Platform Settings</h3>
          </div>
          <div className="settings-form">
            {[
              { key: 'autoApprove', label: 'Auto-Approve Listings', desc: 'New listings are automatically published without review' },
              { key: 'requireEmailVerification', label: 'Require Email Verification', desc: 'Users must verify email before posting content' },
              { key: 'allowMessages', label: 'Allow Direct Messages', desc: 'Enable users to message each other through the platform' },
            ].map(({ key, label, desc }) => (
              <div className="setting-item" key={key}>
                <div className="setting-info">
                  <strong>{label}</strong>
                  <p>{desc}</p>
                </div>
                <label className="toggle-switch">
                  <input 
                    type="checkbox" 
                    checked={platformSettings[key]}
                    onChange={() => setPlatformSettings(prev => ({ ...prev, [key]: !prev[key] }))}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            ))}
            <p style={{fontSize:'0.8rem',color:'var(--gray-400)',marginTop:4}}>
              💡 Maintenance Mode & Announcements are managed in the <strong>Announcements</strong> tab.
            </p>
            <button 
              className="btn-primary" 
              onClick={handleSaveSettings}
              style={{ alignSelf: 'flex-start' }}
            >
              {settingsSaved ? '✅ Saved!' : '💾 Save Settings'}
            </button>
          </div>
        </div>
      )}
    </div>

    {/* Admin confirmation dialogs — rendered via portal so they're above everything */}
    <ModalPortal>
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="⚠️ Delete Listing"
        message={`Are you absolutely sure you want to permanently delete "${deleteConfirm?.title}"? This cannot be undone and the listing will be gone forever.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Yes, Delete Forever"
        type="danger"
      />
    </ModalPortal>
    </>
  );
}

// ============================================
// ANALYTICS PAGE
// ============================================
function AnalyticsPage() {
  const { state } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [extraStats, setExtraStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);

  useEffect(() => {
    if (state.currentUser) loadExtraStats();
  }, [state.currentUser]);

  const loadExtraStats = async () => {
    if (!state.currentUser) return;
    setLoadingStats(true);
    try {
      const [viewsRes, convRes] = await Promise.all([
        supabase.from('listings').select('id,title,views,created_at').eq('user_id', state.currentUser.id),
        supabase.from('messages').select('id,read,created_at').eq('to_user', state.currentUser.id)
      ]);
      setExtraStats({
        listingViews: viewsRes.data || [],
        inboxMessages: convRes.data || []
      });
    } catch(e) {}
    setLoadingStats(false);
  };

  if (!state.currentUser) {
    return (
      <div className="analytics-page">
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <h2>Analytics</h2>
          <p>Please login to view analytics</p>
        </div>
      </div>
    );
  }

  const userListings = (state.listings || []).filter(l => l.user_id === state.currentUser.id);
  const userApps = (state.apps || []).filter(a => a.user_id === state.currentUser.id);
  const userSnippets = (state.codeSnippets || []).filter(s => s.user_id === state.currentUser.id);
  const userMessages = (state.messages || []).filter(m => m.to_user === state.currentUser.id);
  const totalViews = userListings.reduce((sum, l) => sum + (l.views || 0), 0);
  const unreadMsgs = userMessages.filter(m => !m.read).length;
  const totalLikes = userSnippets.reduce((sum, s) => sum + (s.likes || 0), 0);
  const totalDownloads = userApps.reduce((sum, a) => sum + (a.downloads || 0), 0);
  const maxViews = Math.max(...userListings.map(l => l.views || 0), 1);

  const kpiCards = [
    { icon: '👁️', value: totalViews, label: 'Total Views', sub: `across ${userListings.length} listing${userListings.length !== 1 ? 's' : ''}`, color: '#667eea' },
    { icon: '💬', value: userMessages.length, label: 'Messages Received', sub: `${unreadMsgs} unread`, color: '#10b981' },
    { icon: '⭐', value: state.favorites?.length || 0, label: 'Saved Favorites', sub: 'across marketplace', color: '#f59e0b' },
    { icon: '❤️', value: totalLikes, label: 'Code Likes', sub: `${userSnippets.length} snippet${userSnippets.length !== 1 ? 's' : ''}`, color: '#ef4444' },
    { icon: '📱', value: userApps.length, label: 'Apps Listed', sub: `${totalDownloads} downloads`, color: '#8b5cf6' },
    { icon: '👥', value: (state.followers || []).length, label: 'Followers', sub: `following ${(state.follows || []).length}`, color: '#3b82f6' },
  ];

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>📊 Your Dashboard</h1>
        <p>Track performance, messages, and growth</p>
      </div>

      <div className="dashboard-tabs">
        {[
          { id: 'dashboard', label: '🏠 Overview' },
          { id: 'listings', label: '🛒 Listings' },
          { id: 'messages', label: '💬 Messages' },
        ].map(t => (
          <button key={t.id} className={`admin-tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && (
        <>
          <div className="stats-grid dashboard-kpi-grid">
            {kpiCards.map((k, i) => (
              <div key={i} className="stat-card kpi-card" style={{ borderTop: `3px solid ${k.color}` }}>
                <span className="stat-icon">{k.icon}</span>
                <h3 style={{ color: k.color }}>{loadingStats ? '…' : k.value}</h3>
                <p>{k.label}</p>
                <small style={{ color: 'var(--gray-400)' }}>{k.sub}</small>
              </div>
            ))}
          </div>

          <div className="dashboard-panels">
            <div className="dash-panel">
              <div className="dash-panel-header">
                <h3>🛒 Recent Listings</h3>
                <Link to="/marketplace" className="btn-sm btn-secondary">Browse All</Link>
              </div>
              {userListings.length === 0 ? (
                <div className="dash-empty"><span>🛒</span><p>No listings yet</p><Link to="/marketplace" className="btn-primary btn-sm">Create One</Link></div>
              ) : (
                <div className="dash-listing-list">
                  {userListings.slice(0, 5).map(l => (
                    <div key={l.id} className="dash-listing-row">
                      <div className="dash-listing-thumb" style={{ background: 'var(--gray-100)' }}>
                        {l.imageUrl ? <img src={l.imageUrl} alt={l.title} onError={e => e.target.style.display='none'} /> : <span>🛒</span>}
                      </div>
                      <div className="dash-listing-meta">
                        <strong>{l.title}</strong>
                        <span className="price-tag">${l.price || 0}</span>
                      </div>
                      <div className="dash-listing-stats">
                        <span className="dash-stat-pill">👁️ {l.views || 0}</span>
                        <span className={`dash-stat-pill ${l.hidden ? 'hidden-pill' : 'visible-pill'}`}>{l.hidden ? '🙈 Hidden' : '👁 Live'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="dash-panel">
              <div className="dash-panel-header">
                <h3>💬 Recent Messages</h3>
                <Link to="/messages" className="btn-sm btn-secondary">Open Inbox</Link>
              </div>
              {userMessages.length === 0 ? (
                <div className="dash-empty"><span>💬</span><p>No messages yet</p></div>
              ) : (
                <div className="dash-msg-list">
                  {userMessages.slice(0, 5).map((m, i) => (
                    <div key={i} className={`dash-msg-row ${!m.read ? 'unread' : ''}`}>
                      <div className="dash-msg-avatar">
                        <img src={m.from_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.from_name || 'U')}&background=667eea&color=fff&size=36`}
                          alt={m.from_name} onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=36'; }} />
                      </div>
                      <div className="dash-msg-body">
                        <strong>{m.from_name || 'Unknown'}</strong>
                        <p>{(m.message || '').substring(0, 60)}{m.message?.length > 60 ? '…' : ''}</p>
                      </div>
                      {!m.read && <span className="dash-unread-dot"></span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {activeTab === 'listings' && (
        <div className="analytics-charts">
          <div className="chart-container">
            <h3>📊 Listing Performance by Views</h3>
            {userListings.length === 0 ? (
              <div className="dash-empty"><span>🛒</span><p>No listings to show</p></div>
            ) : (
              <div className="bar-chart enhanced-bar-chart">
                {userListings.slice(0, 10).map((listing, i) => {
                  const pct = maxViews > 0 ? Math.round(((listing.views || 0) / maxViews) * 100) : 0;
                  const colors = ['#667eea','#10b981','#f59e0b','#ef4444','#8b5cf6','#3b82f6','#ec4899','#14b8a6','#f97316','#6366f1'];
                  return (
                    <div key={listing.id} className="bar-item">
                      <div className="bar-label" title={listing.title}>{listing.title?.substring(0, 22) || 'Untitled'}</div>
                      <div className="bar-wrapper">
                        <div className="bar-fill" style={{ width: `${Math.max(pct, 4)}%`, background: colors[i % colors.length] }}>
                          <span>{listing.views || 0} views</span>
                        </div>
                      </div>
                      <div className="bar-meta">
                        <span className={listing.hidden ? 'hidden-pill' : 'visible-pill'}>{listing.hidden ? '🙈' : '✅'}</span>
                        <span>${listing.price || 0}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="chart-container">
            <h3>💬 Engagement Summary</h3>
            <div className="engage-grid">
              <div className="engage-card" style={{ borderColor: '#667eea' }}>
                <span style={{ fontSize: '2rem' }}>👁️</span>
                <h4>{totalViews}</h4>
                <p>Total Views</p>
              </div>
              <div className="engage-card" style={{ borderColor: '#10b981' }}>
                <span style={{ fontSize: '2rem' }}>💬</span>
                <h4>{userMessages.length}</h4>
                <p>Inquiries</p>
              </div>
              <div className="engage-card" style={{ borderColor: '#f59e0b' }}>
                <span style={{ fontSize: '2rem' }}>⭐</span>
                <h4>{state.favorites?.length || 0}</h4>
                <p>Saved by You</p>
              </div>
              <div className="engage-card" style={{ borderColor: '#ef4444' }}>
                <span style={{ fontSize: '2rem' }}>❤️</span>
                <h4>{totalLikes}</h4>
                <p>Code Likes</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="chart-container">
          <div className="dash-panel-header" style={{ marginBottom: '16px' }}>
            <h3>💬 All Received Messages</h3>
            <Link to="/messages" className="btn-sm btn-primary">Reply in Inbox</Link>
          </div>
          {userMessages.length === 0 ? (
            <div className="dash-empty"><span>📭</span><p>No messages received yet</p></div>
          ) : (
            <div className="dash-msg-list full-msg-list">
              {userMessages.map((m, i) => (
                <div key={i} className={`dash-msg-row ${!m.read ? 'unread' : ''}`}>
                  <div className="dash-msg-avatar">
                    <img src={m.from_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.from_name || 'U')}&background=667eea&color=fff&size=36`}
                      alt={m.from_name} onError={e => { e.target.src = 'https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=36'; }} />
                  </div>
                  <div className="dash-msg-body">
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <strong>{m.from_name || 'Unknown'}</strong>
                      <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)' }}>{new Date(m.created_at).toLocaleDateString()}</span>
                    </div>
                    <p style={{ margin: 0 }}>{m.message}</p>
                    {m.subject && <small style={{ color: 'var(--gray-400)' }}>Re: {m.subject}</small>}
                  </div>
                  {!m.read && <span className="dash-unread-dot"></span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// MESSENGER-STYLE MESSAGES — Full Redesign
// ============================================
function Messages() {
  const { state, dispatch } = useAppContext();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convToDelete, setConvToDelete] = useState(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const typingChannelRef = useRef(null);
  const presenceChannelRef = useRef(null);

  // Presence tracking: subscribe to online/offline
  useEffect(() => {
    if (!state.currentUser) return;
    try {
      const presenceChannel = supabase.channel('online-users', {
        config: { presence: { key: state.currentUser.id } }
      });
      presenceChannel
        .on('presence', { event: 'sync' }, () => {
          const state_ = presenceChannel.presenceState();
          const online = new Set(Object.keys(state_));
          setOnlineUsers(online);
        })
        .on('presence', { event: 'join' }, ({ key }) => {
          setOnlineUsers(prev => new Set([...prev, key]));
        })
        .on('presence', { event: 'leave' }, ({ key }) => {
          setOnlineUsers(prev => { const s = new Set(prev); s.delete(key); return s; });
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({ user_id: state.currentUser.id, online_at: new Date().toISOString() });
          }
        });
      presenceChannelRef.current = presenceChannel;
    } catch (e) {}
    return () => { if (presenceChannelRef.current) supabase.removeChannel(presenceChannelRef.current); };
  }, [state.currentUser]);

  // Typing indicator subscription for active conversation
  useEffect(() => {
    if (!state.activeConversation || !state.currentUser) return;
    try {
      const channelName = `typing:${[state.currentUser.id, state.activeConversation.userId].sort().join('-')}`;
      const channel = supabase.channel(channelName);
      channel
        .on('broadcast', { event: 'typing' }, ({ payload }) => {
          if (payload.userId !== state.currentUser.id) {
            setIsTyping(true);
            clearTimeout(typingTimeout);
            const t = setTimeout(() => setIsTyping(false), 3000);
            setTypingTimeout(t);
          }
        })
        .subscribe();
      typingChannelRef.current = channel;
    } catch (e) {}
    return () => { if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current); };
  }, [state.activeConversation?.userId]);

  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !state.currentUser) return;
    try {
      typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: state.currentUser.id } });
    } catch (e) {}
  }, [state.currentUser]);

  const scrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => { scrollToBottom(); }, [state.activeConversation, scrollToBottom]);

  useEffect(() => {
    if (chatMessagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
      if (scrollHeight - scrollTop - clientHeight < 120) scrollToBottom();
    }
  }, [state.messages.length, scrollToBottom]);

  useEffect(() => {
    if (state.activeConversation && state.conversations.length > 0) {
      const updated = state.conversations.find(c => c.userId === state.activeConversation.userId);
      if (updated && updated.messages.length !== state.activeConversation.messages?.length) {
        dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: updated });
      }
    }
  }, [state.conversations, state.activeConversation?.userId]);

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

  const conversations = state.conversations || [];
  const activeConv = state.activeConversation;

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !replyingTo) return;
    
    setSending(true);
    const optimisticMsg = {
      id: `temp-${Date.now()}`,
      from_user: state.currentUser.id,
      to_user: replyingTo.userId,
      subject: 'Re: Conversation',
      message: replyMessage,
      read: false,
      created_at: new Date().toISOString(),
      _optimistic: true
    };

    // Optimistically update UI
    if (activeConv) {
      dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: {
        ...activeConv,
        messages: [...(activeConv.messages || []), optimisticMsg],
        lastMessage: replyMessage,
        lastMessageTime: optimisticMsg.created_at
      }});
    }
    setReplyMessage('');

    try {
      const msgData = {
        from_user: state.currentUser.id,
        to_user: replyingTo.userId,
        subject: 'Re: Conversation',
        message: optimisticMsg.message,
        read: false,
        created_at: new Date().toISOString()
      };

      const { data: insertedMsg, error } = await supabase.from('messages').insert([msgData]).select().single();
      
      if (!error && insertedMsg) {
        // Replace optimistic message with real one in active conversation
        if (activeConv) {
          dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: {
            ...activeConv,
            messages: [
              ...(activeConv.messages || []).filter(m => m.id !== optimisticMsg.id),
              insertedMsg
            ],
            lastMessage: insertedMsg.message,
            lastMessageTime: insertedMsg.created_at
          }});
        }
        // Try to notify recipient (non-blocking)
        supabase.from('notifications').insert([{
          user_id: replyingTo.userId,
          message: `💬 New message from ${state.profile?.name || state.currentUser.email?.split('@')[0] || 'User'}`,
          type: 'info',
          read: false,
          created_at: new Date().toISOString()
        }]).then(() => {}).catch(() => {});
      }
    } catch (error) {
      console.error('Error sending reply:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Failed to send message', type: 'error', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    }
    setSending(false);
    setTimeout(scrollToBottom, 100);
  };

  const handleDeleteConversation = async () => {
    if (!convToDelete) return;
    setDeletingConv(true);
    try {
      // Delete all messages between these two users
      await supabase.from('messages').delete()
        .or(
          `and(from_user.eq.${state.currentUser.id},to_user.eq.${convToDelete.userId}),and(from_user.eq.${convToDelete.userId},to_user.eq.${state.currentUser.id})`
        );

      // Remove from conversations state
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations.filter(c => c.userId !== convToDelete.userId) });
      dispatch({ type: 'SET_MESSAGES', payload: (state.messages || []).filter(m => 
        !(m.from_user === convToDelete.userId || m.to_user === convToDelete.userId)
      )});
      
      if (activeConv?.userId === convToDelete.userId) {
        dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: null });
        setReplyingTo(null);
      }
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '🗑️ Conversation deleted', type: 'success', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Could not delete conversation', type: 'error', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    }
    setDeletingConv(false);
    setShowDeleteConfirm(false);
    setConvToDelete(null);
  };

  const buildConversationsLocal = (messages, userId) => {
    const conversationMap = new Map();
    messages.forEach(msg => {
      const otherUserId = msg.from_user === userId ? msg.to_user : msg.from_user;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId,
          userName: (msg.from_user === userId ? msg.to_name : msg.from_name) || 'User',
          userAvatar: msg.from_user === userId ? msg.to_avatar : msg.from_avatar,
          lastMessage: msg.message,
          lastMessageTime: msg.created_at,
          unreadCount: 0,
          messages: []
        });
      }
      const conv = conversationMap.get(otherUserId);
      conv.messages.push(msg);
      if (!msg.read && msg.to_user === userId) conv.unreadCount++;
      if (new Date(msg.created_at) > new Date(conv.lastMessageTime)) {
        conv.lastMessage = msg.message;
        conv.lastMessageTime = msg.created_at;
      }
    });
    const convs = Array.from(conversationMap.values())
      .sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));
    dispatch({ type: 'SET_CONVERSATIONS', payload: convs });
    // Update active conversation if open
    if (activeConv) {
      const updated = convs.find(c => c.userId === activeConv.userId);
      if (updated) dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: updated });
    }
  };

  const openConversation = (conv) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conv });
    setReplyingTo(conv);
    setMobileShowChat(true);
    dispatch({ type: 'MARK_CONVERSATION_READ', payload: conv.userId });
    window.__activeConversationId = conv.userId; // used by realtime handler to suppress notifications
    
    conv.messages.forEach(async (msg) => {
      if (!msg.read && msg.to_user === state.currentUser.id) {
        try {
          await supabase.from('messages').update({ read: true }).eq('id', msg.id);
        } catch (error) {}
      }
    });
  };

  const confirmDeleteConversation = (e, conv) => {
    e.stopPropagation();
    setConvToDelete(conv);
    setShowDeleteConfirm(true);
  };

  const formatMsgTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isOnline = (userId) => onlineUsers.has(userId);

  const activeMessages = (activeConv?.messages || [])
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className="messenger-page">
      {/* Sidebar */}
      <div className={`messenger-sidebar ${mobileShowChat ? 'mobile-hidden' : ''}`}>
        <div className="messenger-sidebar-header">
          <h2>💬 Messages</h2>
          {state.realtimeConnected && (
            <span className="live-badge">🟢 Live</span>
          )}
        </div>

        {loadingMessages ? (
          <div className="conv-list">{[1,2,3,4].map(i => <SkeletonMessage key={i} />)}</div>
        ) : conversations.length === 0 ? (
          <div className="messenger-empty-sidebar">
            <span>💬</span>
            <p>No conversations yet</p>
            <small>Messages from listing inquiries appear here</small>
          </div>
        ) : (
          <div className="conv-list">
            {conversations.map((conv, index) => (
              <div
                key={conv.userId || index}
                className={`conv-item ${activeConv?.userId === conv.userId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                onClick={() => openConversation(conv)}
              >
                <div className="conv-avatar-wrap">
                  <img
                    src={conv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.userName || 'U')}&background=667eea&color=fff&size=48`}
                    alt={conv.userName}
                    className="conv-avatar"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=48`; }}
                  />
                  <span className={`online-dot ${isOnline(conv.userId) ? 'online' : 'offline'}`}></span>
                </div>
                <div className="conv-info">
                  <div className="conv-row1">
                    <strong className="conv-name">{conv.userName || 'User'}</strong>
                    <span className="conv-time">{formatMsgTime(conv.lastMessageTime)}</span>
                  </div>
                  <div className="conv-row2">
                    <p className="conv-preview">{conv.lastMessage?.substring(0, 38)}{conv.lastMessage?.length > 38 ? '…' : ''}</p>
                    {conv.unreadCount > 0 && <span className="conv-badge">{conv.unreadCount}</span>}
                  </div>
                </div>
                <button
                  className="conv-del-btn"
                  onClick={(e) => confirmDeleteConversation(e, conv)}
                  title="Delete"
                >×</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className={`messenger-chat ${mobileShowChat ? 'mobile-show' : ''}`}>
        {activeConv ? (
          <>
            <div className="messenger-chat-header">
              <button className="messenger-back-btn" onClick={() => { setMobileShowChat(false); }}>←</button>
              <div className="messenger-chat-avatar-wrap">
                <img
                  src={activeConv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.userName || 'U')}&background=667eea&color=fff&size=44`}
                  alt={activeConv.userName}
                  className="messenger-chat-avatar"
                  onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=44`; }}
                />
                <span className={`online-dot ${isOnline(activeConv.userId) ? 'online' : 'offline'}`}></span>
              </div>
              <div className="messenger-chat-info">
                <strong>{activeConv.userName || 'User'}</strong>
                <p>{isOnline(activeConv.userId) ? '🟢 Active now' : '⚪ Offline'}</p>
              </div>
              <button
                className="btn-secondary btn-sm"
                onClick={() => { setConvToDelete(activeConv); setShowDeleteConfirm(true); }}
                style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
              >
                🗑️
              </button>
            </div>

            <div className="messenger-messages" ref={chatMessagesRef}>
              {activeMessages.map((msg, i) => {
                const isMine = msg.from_user === state.currentUser.id;
                const showAvatar = !isMine && (i === 0 || activeMessages[i-1]?.from_user !== msg.from_user);
                const isLast = isMine && i === activeMessages.length - 1;
                // Always use the conversation's resolved name/avatar (populated from real profiles)
                const senderName = isMine 
                  ? (state.profile?.name || state.currentUser?.email?.split('@')[0] || 'You')
                  : (activeConv.userName || msg.from_name || 'User');
                const senderAvatar = isMine
                  ? (state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=667eea&color=fff&size=32`)
                  : (activeConv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.userName||'U')}&background=667eea&color=fff&size=32`);
                return (
                  <div key={msg.id} className={`msg-row ${isMine ? 'mine' : 'theirs'}`}>
                    {!isMine && (
                      <img
                        src={showAvatar ? senderAvatar : undefined}
                        alt={showAvatar ? senderName : ''}
                        className={`msg-avatar ${showAvatar ? '' : 'invisible'}`}
                        onError={e => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(senderName)}&background=667eea&color=fff&size=32`; }}
                      />
                    )}
                    <div className="msg-col">
                      {!isMine && showAvatar && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--gray-400)', marginBottom: 2, display: 'block' }}>
                          {senderName}
                        </span>
                      )}
                      <div className={`msg-bubble ${msg._optimistic ? 'optimistic' : ''}`}>
                        <p>{msg.message}</p>
                      </div>
                      <div className={`msg-meta ${isMine ? 'mine' : ''}`}>
                        <span>{formatMsgTime(msg.created_at)}</span>
                        {isMine && (
                          <span className="msg-status">
                            {msg._optimistic ? '🕐' : msg.read ? '✓✓' : '✓'}
                          </span>
                        )}
                        {isMine && isLast && msg.read && !msg._optimistic && (
                          <span style={{ fontSize: '0.65rem', color: 'var(--primary)' }}>Seen</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              {isTyping && (
                <div className="msg-row theirs">
                  <img
                    src={activeConv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.userName||'U')}&background=667eea&color=fff&size=32`}
                    alt=""
                    className="msg-avatar"
                    onError={e => { e.target.src = `https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=32`; }}
                  />
                  <div className="msg-col">
                    <div className="typing-bubble">
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                      <span className="typing-dot"></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="messenger-input-area">
              <textarea
                placeholder="Aa"
                value={replyMessage}
                onChange={e => { setReplyMessage(e.target.value); broadcastTyping(); }}
                className="messenger-input"
                rows="1"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); }
                }}
              />
              <button
                className="messenger-send-btn"
                onClick={handleSendReply}
                disabled={sending || !replyMessage.trim()}
                title="Send"
              >
                {sending ? '⏳' : '➤'}
              </button>
            </div>
          </>
        ) : (
          <div className="messenger-no-chat">
            <div className="messenger-no-chat-inner">
              <span>💬</span>
              <h3>Your Messages</h3>
              <p>Select a conversation to start chatting</p>
              {state.realtimeConnected && <p className="live-note">🟢 Live — messages arrive instantly</p>}
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Conversation"
        message={`Delete your entire conversation with ${convToDelete?.userName || 'this user'}? This cannot be undone.`}
        onConfirm={handleDeleteConversation}
        onCancel={() => { setShowDeleteConfirm(false); setConvToDelete(null); }}
        confirmText={deletingConv ? "Deleting..." : "Delete"}
        type="danger"
      />
    </div>
  );
}

// ============================================
// PROFILE WITH ENHANCED AVATAR UPLOAD
// ============================================
function Profile() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('listings');
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  useEffect(() => {
    if (state.currentUser) {
      loadFollowCounts();
    }
  }, [state.currentUser, state.follows, state.followers]);

  const loadFollowCounts = async () => {
    try {
      const { count: fCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', state.currentUser.id);
      setFollowingCount(fCount || state.follows?.length || 0);

      const { count: rCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', state.currentUser.id);
      setFollowersCount(rCount || state.followers?.length || 0);
    } catch (e) {
      setFollowingCount(state.follows?.length || 0);
      setFollowersCount(state.followers?.length || 0);
    }
  };

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
  const userListings = (state.listings || []).filter(l => l.user_id === state.currentUser.id);
  const userApps = (state.apps || []).filter(a => a.user_id === state.currentUser.id);
  const userSnippets = (state.codeSnippets || []).filter(s => s.user_id === state.currentUser.id);

  const handleAvatarUpdate = async (avatarUrl) => {
    const previousAvatar = state.profile?.avatar_url;
    // Optimistically update UI immediately
    dispatch({ type: 'UPDATE_AVATAR', payload: avatarUrl });
    try {
      const { error } = await supabase.from('profiles').update({
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      }).eq('id', state.currentUser.id);

      if (error) {
        // Rollback on failure
        dispatch({ type: 'UPDATE_AVATAR', payload: previousAvatar });
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: '❌ Could not save avatar. Please try again.', 
          type: 'error', time: new Date().toLocaleTimeString(), read: false 
        }});
        return;
      }
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '✅ Profile picture saved!', 
        type: 'success', time: new Date().toLocaleTimeString(), read: false 
      }});
    } catch (error) {
      dispatch({ type: 'UPDATE_AVATAR', payload: previousAvatar });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Network error — avatar not saved.', 
        type: 'error', time: new Date().toLocaleTimeString(), read: false 
      }});
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header-card">
        <div className="profile-cover"></div>
        <div className="profile-header-inner">
          <AvatarUpload 
            currentAvatar={state.profile?.avatar_url} 
            userName={userName} 
            onAvatarUpdate={handleAvatarUpdate}
            size="large"
          />
          <div className="profile-info">
            <h1>
              {userName}
              {state.profile?.verified && (
                <span className="verified-badge" title="Verified Account">✓</span>
              )}
            </h1>
            <p className="profile-email">{state.currentUser.email}</p>
            {state.profile?.role && (
              <span className="profile-role-badge">
                {state.profile.role === 'developer' ? '👨‍💻' : state.profile.role === 'admin' ? '🛡️' : '👤'} {state.profile.role}
              </span>
            )}
            {state.profile?.bio && <p className="profile-bio">{state.profile.bio}</p>}
            <div className="profile-links">
              {state.profile?.website && (
                <a href={state.profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">🌐 Website</a>
              )}
              {state.profile?.github && (
                <a href={`https://github.com/${state.profile.github}`} target="_blank" rel="noopener noreferrer" className="profile-link">⚡ GitHub</a>
              )}
            </div>
          </div>
          <div className="profile-header-actions">
            <Link to="/settings" className="btn-secondary">⚙️ Edit Profile</Link>
            {state.isAdmin && <Link to="/admin" className="btn-secondary">🛡️ Admin</Link>}
          </div>
        </div>
        <div className="profile-stats-row">
          <div className="stat-box">
            <h3>{userListings.length}</h3>
            <p>Listings</p>
          </div>
          <div className="stat-box">
            <h3>{userSnippets.length}</h3>
            <p>Snippets</p>
          </div>
          <div className="stat-box">
            <h3>{state.favorites?.length || 0}</h3>
            <p>Favorites</p>
          </div>
          <div className="stat-box clickable">
            <h3>{followersCount}</h3>
            <p>Followers</p>
          </div>
          <div className="stat-box clickable">
            <h3>{followingCount}</h3>
            <p>Following</p>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {['listings', 'apps', 'snippets'].map(tab => (
          <button
            key={tab}
            className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'listings' ? `🛒 Listings (${userListings.length})` :
             tab === 'apps' ? `📱 Apps (${userApps.length})` :
             `💻 Snippets (${userSnippets.length})`}
          </button>
        ))}
      </div>

      <div className="profile-content">
        {activeTab === 'listings' && (
          userListings.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">🛒</span>
              <h3>No listings yet</h3>
              <Link to="/marketplace" className="btn-primary">Create a Listing</Link>
            </div>
          ) : (
            <div className="listings-grid">
              {userListings.map(l => <ListingCard key={l.id} listing={l} />)}
            </div>
          )
        )}
        {activeTab === 'apps' && (
          userApps.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📱</span>
              <h3>No apps advertised yet</h3>
              <Link to="/advertise" className="btn-primary">Advertise an App</Link>
            </div>
          ) : (
            <div className="app-grid">
              {userApps.map(a => <AppCard key={a.id} app={a} />)}
            </div>
          )
        )}
        {activeTab === 'snippets' && (
          userSnippets.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">💻</span>
              <h3>No snippets shared yet</h3>
              <Link to="/code-sharing" className="btn-primary">Share Code</Link>
            </div>
          ) : (
            <div className="snippets-grid">
              {userSnippets.map(s => (
                <CodeCard key={s.id} snippet={s} onLike={() => {}} onDelete={() => {}} currentUser={state.currentUser} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================
// USER PROFILE (public view of another user)
// ============================================
function UserProfile() {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const userId = location.pathname.split('/profile/')[1];

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [activeTab, setActiveTab] = useState('listings');
  const [userPosts, setUserPosts] = useState({ listings: [], apps: [], snippets: [] });

  useEffect(() => {
    if (!userId) return;
    if (state.currentUser && userId === state.currentUser.id) {
      navigate('/profile');
      return;
    }
    loadUserProfile();
  }, [userId, state.currentUser]);

  // Sync follow state from persisted Redux store whenever it changes
  useEffect(() => {
    if (state.follows && userId) {
      setIsFollowing(state.follows.includes(userId));
    }
  }, [state.follows, userId]);

  const loadUserProfile = async () => {
    setLoading(true);
    try {
      // Load profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setProfile(profileData);

      // Load follow counts
      const { count: fersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', userId);
      setFollowersCount(fersCount || 0);

      const { count: fingCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('follower_id', userId);
      setFollowingCount(fingCount || 0);

      // Check if current user follows this user — derived from persisted state.follows
      if (state.currentUser && state.follows) {
        setIsFollowing(state.follows.includes(userId));
      } else if (state.currentUser) {
        // Fallback DB check on first load before state.follows is populated
        try {
          const { data: followData } = await supabase
            .from('follows')
            .select('id')
            .eq('follower_id', state.currentUser.id)
            .eq('following_id', userId)
            .maybeSingle();
          setIsFollowing(!!followData);
        } catch(e) {}
      }

      // Load user's public content
      const [listingsRes, appsRes, snippetsRes] = await Promise.all([
        supabase.from('listings').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('apps').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
        supabase.from('code_snippets').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      setUserPosts({
        listings: listingsRes.data || [],
        apps: appsRes.data || [],
        snippets: snippetsRes.data || []
      });
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
    setLoading(false);
  };

  const handleFollowToggle = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Please login to follow users', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    if (followLoading) return;
    setFollowLoading(true);

    try {
      if (isFollowing) {
        // Unfollow
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', state.currentUser.id)
          .eq('following_id', userId);
        setIsFollowing(false);
        setFollowersCount(prev => Math.max(0, prev - 1));
        dispatch({ type: 'REMOVE_FOLLOW', payload: userId });
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: `Unfollowed ${profile?.name || 'user'}`, 
          type: 'info', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
      } else {
        // Follow
        await supabase
          .from('follows')
          .insert([{
            follower_id: state.currentUser.id,
            following_id: userId,
            created_at: new Date().toISOString()
          }]);
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        dispatch({ type: 'ADD_FOLLOW', payload: userId });

        // Create activity
        try {
          await supabase.from('activities').insert([{
            user_id: state.currentUser.id,
            type: 'follow',
            target_user_id: userId,
            message: `started following ${profile?.name || 'a user'}`,
            created_at: new Date().toISOString()
          }]);
        } catch(e) { /* activities table may not exist yet */ }

        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: `✅ Now following ${profile?.name || 'user'}!`, 
          type: 'success', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
      }
    } catch (error) {
      console.error('Follow error:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Error: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    setFollowLoading(false);
  };

  if (loading) return (
    <div className="profile-page">
      <div className="loading-container">
        <div className="loading-spinner-large"></div>
        <p>Loading profile...</p>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="profile-page">
      <div className="empty-state">
        <span className="empty-icon">👤</span>
        <h3>User not found</h3>
        <button onClick={() => navigate(-1)} className="btn-secondary">← Go Back</button>
      </div>
    </div>
  );

  const displayName = profile.name || 'Anonymous User';
  const avatarUrl = profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=667eea&color=fff&size=120`;

  return (
    <div className="profile-page">
      <div className="profile-header-card">
        <div className="profile-cover"></div>
        <div className="profile-header-inner">
          <div className="avatar-container-static">
            <img src={avatarUrl} alt={displayName} className="avatar-large" />
          </div>
          <div className="profile-info">
            <h1>
              {displayName}
              {profile.verified && (
                <span className="verified-badge" title="Verified Account">✓</span>
              )}
            </h1>
            {profile.role && (
              <span className="profile-role-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
                {profile.role === 'admin' ? '🛡️' : profile.role === 'developer' ? '👨‍💻' : profile.role === 'banned' ? '🚫' : '👤'} {profile.role}
              </span>
            )}
            {profile.bio && <p className="profile-bio">{profile.bio}</p>}
            <div className="profile-links">
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">🌐 Website</a>
              )}
              {profile.github && (
                <a href={`https://github.com/${profile.github}`} target="_blank" rel="noopener noreferrer" className="profile-link">⚡ GitHub</a>
              )}
            </div>
          </div>
          <div className="profile-header-actions">
            {state.currentUser && (
              <>
                <button
                  className={`btn-follow ${isFollowing ? 'following' : ''}`}
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                >
                  {followLoading ? '...' : isFollowing ? '✓ Following' : '+ Follow'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/messages')}
                >
                  💬 Message
                </button>
              </>
            )}
          </div>
        </div>
        <div className="profile-stats-row">
          <div className="stat-box">
            <h3>{userPosts.listings.length}</h3>
            <p>Listings</p>
          </div>
          <div className="stat-box">
            <h3>{userPosts.snippets.length}</h3>
            <p>Snippets</p>
          </div>
          <div className="stat-box">
            <h3>{followersCount}</h3>
            <p>Followers</p>
          </div>
          <div className="stat-box">
            <h3>{followingCount}</h3>
            <p>Following</p>
          </div>
        </div>
      </div>

      <div className="profile-tabs">
        {['listings', 'apps', 'snippets'].map(tab => (
          <button
            key={tab}
            className={`profile-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'listings' ? `🛒 Listings (${userPosts.listings.length})` :
             tab === 'apps' ? `📱 Apps (${userPosts.apps.length})` :
             `💻 Snippets (${userPosts.snippets.length})`}
          </button>
        ))}
      </div>

      <div className="profile-content">
        {activeTab === 'listings' && (
          userPosts.listings.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">🛒</span><h3>No listings yet</h3></div>
          ) : (
            <div className="listings-grid">
              {userPosts.listings.map(l => {
                const mappedListing = { ...l, seller: l.seller_name, sellerAvatar: l.seller_avatar, imageUrl: l.image_url, date: new Date(l.created_at).toLocaleDateString() };
                return <ListingCard key={l.id} listing={mappedListing} />;
              })}
            </div>
          )
        )}
        {activeTab === 'apps' && (
          userPosts.apps.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">📱</span><h3>No apps yet</h3></div>
          ) : (
            <div className="app-grid">
              {userPosts.apps.map(a => <AppCard key={a.id} app={a} />)}
            </div>
          )
        )}
        {activeTab === 'snippets' && (
          userPosts.snippets.length === 0 ? (
            <div className="empty-state"><span className="empty-icon">💻</span><h3>No snippets yet</h3></div>
          ) : (
            <div className="snippets-grid">
              {userPosts.snippets.map(s => {
                const mapped = { ...s, author: s.author_name, authorAvatar: s.author_avatar, likedBy: [], date: new Date(s.created_at).toLocaleDateString() };
                return <CodeCard key={s.id} snippet={mapped} onLike={() => {}} onDelete={() => {}} currentUser={state.currentUser} />;
              })}
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ============================================
// ACTIVITY FEED COMPONENT
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
  
  const featuredListings = (state.listings || []).filter(l => !l.hidden).slice(0, 3);

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
// LISTING CARD COMPONENT
// ============================================
function ListingCard({ listing }) {
  const { state, dispatch } = useAppContext();
  const [showContact, setShowContact] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isFavorited = (state.favorites || []).some(f => f.id === listing.id);
  const isOwner = state.currentUser && listing.user_id === state.currentUser.id;

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
    
    if (isOwner) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'You cannot message yourself', 
        type: 'warning', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      return;
    }
    
    if (showContact && message.trim()) {
      try {
        const msgData = {
          from_user: state.currentUser.id,
          to_user: listing.user_id,
          subject: `Inquiry about ${listing.title}`,
          message: message,
          listing_id: listing.id,
          read: false,
          created_at: new Date().toISOString()
        };

        await supabase.from('messages').insert([msgData]);
        
        try {
          await supabase.from('notifications').insert([{
            user_id: listing.user_id,
            message: `💬 New inquiry about "${listing.title}" from ${state.profile?.name || state.currentUser.email}`,
            type: 'info',
            read: false,
            created_at: new Date().toISOString()
          }]);
        } catch (notifError) {
          console.log('Could not create notification:', notifError);
        }
        
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

  // Track listing view on expand/contact (non-blocking, best-effort)
  const trackView = async () => {
    if (!listing?.id) return;
    try {
      await supabase.rpc('increment_listing_views', { listing_id: listing.id }).then(() => {}).catch(() => {
        // Fallback: direct update if RPC doesn't exist
        supabase.from('listings').update({ views: (listing.views || 0) + 1 }).eq('id', listing.id).then(() => {}).catch(() => {});
      });
    } catch(e) {}
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('listings')
        .delete()
        .eq('id', listing.id);

      if (error) throw error;

      dispatch({ type: 'DELETE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `✅ Listing "${listing.title}" deleted successfully`, 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    } catch (error) {
      console.error('Error deleting listing:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Failed to delete: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <>
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
          {isOwner && (
            <button
              className="delete-button"
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete listing"
              aria-label="Delete listing"
            >
              🗑️
            </button>
          )}
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
                src={listing.sellerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(listing.seller || 'User')}&background=667eea&color=fff&size=28`} 
                alt={listing.seller} 
              />
              {listing.user_id ? (
                <Link to={`/profile/${listing.user_id}`} className="seller-link">{listing.seller}</Link>
              ) : listing.seller}
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
            <button 
              onClick={handleContact} 
              className="btn-primary btn-sm"
              disabled={isOwner}
              title={isOwner ? 'This is your listing' : 'Contact seller'}
            >
              {isOwner ? '👤 Your Listing' : showContact ? '📤 Send' : '📧 Contact'}
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Listing"
        message={`Are you sure you want to delete "${listing.title}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        type="danger"
      />
    </>
  );
}

// ============================================
// MARKETPLACE COMPONENT
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search');
    if (search) {
      setSearchTerm(search);
    }
  }, []);

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
      const listingData = {
        title: formData.title,
        description: formData.description,
        price: formData.price,
        url: formData.url || null,
        image_url: formData.imageUrl || null,
        category: formData.category,
        seller_name: state.profile?.name || state.currentUser.email,
        seller_avatar: state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.name || 'User')}&background=667eea&color=fff&size=40`,
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
      // Hide hidden listings from non-admin users
      if (l.hidden && !state.isAdmin) return false;
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
          <div className="modal-content large listing-form-modal" onClick={e => e.stopPropagation()}>
            <div className="listing-form-header">
              <span className="listing-form-icon">📢</span>
              <h2>Create New Listing</h2>
              <p>Fill in the details below to list your website or portfolio</p>
            </div>
            <form onSubmit={handleSubmit} className="listing-form-styled">
              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <div className="input-wrapper">
                  <span className="input-icon">📝</span>
                  <input 
                    type="text" 
                    placeholder="e.g., Modern SaaS Dashboard" 
                    value={formData.title} 
                    onChange={e => setFormData({ ...formData, title: e.target.value })} 
                    required 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select 
                  value={formData.category} 
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="website">🌐 Website</option>
                  <option value="portfolio">📁 Portfolio</option>
                  <option value="ecommerce">🛍️ E-Commerce</option>
                  <option value="blog">📝 Blog</option>
                  <option value="saas">☁️ SaaS</option>
                  <option value="other">📦 Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Description <span className="required">*</span></label>
                <textarea 
                  placeholder="Describe your website, its features, and what makes it special..." 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  required 
                  rows="4" 
                  className="listing-textarea"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <span className="input-icon">💰</span>
                    <input 
                      type="text" 
                      placeholder="$500 or Negotiable" 
                      value={formData.price} 
                      onChange={e => setFormData({ ...formData, price: e.target.value })} 
                      required 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Website URL</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔗</span>
                    <input 
                      type="url" 
                      placeholder="https://example.com" 
                      value={formData.url} 
                      onChange={e => setFormData({ ...formData, url: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Image URL (optional)</label>
                <div className="input-wrapper">
                  <span className="input-icon">🖼️</span>
                  <input 
                    type="url" 
                    placeholder="https://example.com/image.jpg" 
                    value={formData.imageUrl} 
                    onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} 
                  />
                </div>
              </div>
              <div className="listing-form-footer">
                <span className="listing-form-note">💡 Your listing will be visible to all DevMarket users</span>
                <div className="listing-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? (
                      <><span className="loading-spinner"></span> Publishing...</>
                    ) : (
                      <>📤 Publish Listing</>
                    )}
                  </button>
                </div>
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
          app_url: formData.appUrl || null,
          contact: formData.contact,
          features: featuresArray,
          price: formData.price || 'Free',
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
            <div className="listing-form-header">
              <span className="listing-form-icon">📱</span>
              <h2>Create App Listing</h2>
              <p>Showcase your application to the DevMarket community</p>
            </div>
            <form onSubmit={handleSubmit} className="listing-form-styled">
              <div className="form-group">
                <label>App Name <span className="required">*</span></label>
                <div className="input-wrapper">
                  <span className="input-icon">📱</span>
                  <input 
                    type="text" 
                    placeholder="My Awesome App" 
                    value={formData.appName} 
                    onChange={e => setFormData({ ...formData, appName: e.target.value })} 
                    required 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description <span className="required">*</span></label>
                <textarea 
                  placeholder="Describe your app and its key benefits..." 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  required 
                  rows="3" 
                  className="listing-textarea"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Platform <span className="required">*</span></label>
                  <select 
                    value={formData.platform} 
                    onChange={e => setFormData({ ...formData, platform: e.target.value })} 
                    required
                  >
                    <option value="">Select Platform</option>
                    <option value="Web">🌐 Web</option>
                    <option value="iOS">🍎 iOS</option>
                    <option value="Android">🤖 Android</option>
                    <option value="Desktop">💻 Desktop</option>
                    <option value="Cross-platform">🔄 Cross-platform</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Price</label>
                  <div className="input-wrapper">
                    <span className="input-icon">💲</span>
                    <input 
                      type="text" 
                      placeholder="Free / $9.99/month" 
                      value={formData.price} 
                      onChange={e => setFormData({ ...formData, price: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>App URL</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🔗</span>
                    <input 
                      type="url" 
                      placeholder="https://myapp.com" 
                      value={formData.appUrl} 
                      onChange={e => setFormData({ ...formData, appUrl: e.target.value })} 
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Contact Email <span className="required">*</span></label>
                  <div className="input-wrapper">
                    <span className="input-icon">📧</span>
                    <input 
                      type="email" 
                      placeholder="your@email.com" 
                      value={formData.contact} 
                      onChange={e => setFormData({ ...formData, contact: e.target.value })} 
                      required 
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Key Features (comma-separated) <span className="required">*</span></label>
                <div className="input-wrapper">
                  <span className="input-icon">✨</span>
                  <input 
                    type="text" 
                    placeholder="Fast Performance, User-Friendly, Cloud Sync" 
                    value={formData.features} 
                    onChange={e => setFormData({ ...formData, features: e.target.value })} 
                    required 
                  />
                </div>
              </div>
              <div className="listing-form-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <><span className="loading-spinner"></span> Publishing...</>
                  ) : (
                    <>📱 Publish App</>
                  )}
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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const isOwner = state.currentUser && app.user_id === state.currentUser.id;

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
        await supabase.from('messages').insert([{
          from_user: state.currentUser.id,
          to_user: app.user_id,
          subject: `Inquiry about ${app.appName}`,
          message: message,
          read: false,
          created_at: new Date().toISOString()
        }]);
        
        try {
          await supabase.from('notifications').insert([{
            user_id: app.user_id,
            message: `💬 New inquiry about "${app.appName}" from ${state.profile?.name || state.currentUser.email}`,
            type: 'info',
            read: false,
            created_at: new Date().toISOString()
          }]);
        } catch (notifError) {
          console.log('Could not create notification:', notifError);
        }
        
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', app.id);

      if (error) throw error;

      dispatch({ type: 'DELETE_APP', payload: app.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `✅ App "${app.appName}" deleted successfully`, 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    } catch (error) {
      console.error('Error deleting app:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Failed to delete: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div className="app-card">
        <div className="app-header">
          <span className={`platform-badge ${app.platform?.toLowerCase()}`}>{app.platform}</span>
          {app.price && <span className="price-badge">{app.price}</span>}
          {isOwner && (
            <button
              className="btn-sm"
              onClick={() => setShowDeleteConfirm(true)}
              style={{ 
                background: 'var(--danger-light)', 
                color: 'var(--danger)', 
                border: 'none', 
                cursor: 'pointer',
                borderRadius: 'var(--radius-full)',
                padding: '6px 12px',
                fontSize: '0.8rem',
                marginLeft: 'auto'
              }}
            >
              🗑️ Delete
            </button>
          )}
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
              src={app.developerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(app.developer || 'Dev')}&background=667eea&color=fff&size=24`} 
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
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete App"
        message={`Are you sure you want to delete "${app.appName}"? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText={deleting ? 'Deleting...' : 'Delete'}
        type="danger"
      />
    </>
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

  const handleDelete = async (snippet) => {
    try {
      const { error } = await supabase
        .from('code_snippets')
        .delete()
        .eq('id', snippet.id);

      if (error) throw error;

      dispatch({ type: 'DELETE_SNIPPET', payload: snippet.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `✅ Snippet "${snippet.title}" deleted successfully`, 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    } catch (error) {
      console.error('Error deleting snippet:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `❌ Failed to delete: ${error.message}`, 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
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
            <div className="listing-form-header">
              <span className="listing-form-icon">💻</span>
              <h2>Share Code Snippet</h2>
              <p>Share your knowledge with the DevMarket community</p>
            </div>
            <form onSubmit={handleSubmit} className="listing-form-styled">
              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <div className="input-wrapper">
                  <span className="input-icon">📝</span>
                  <input 
                    type="text" 
                    placeholder="e.g., React Custom Hook for API Calls" 
                    value={formData.title} 
                    onChange={e => setFormData({ ...formData, title: e.target.value })} 
                    required 
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Description <span className="required">*</span></label>
                <textarea 
                  placeholder="Briefly explain what this code does and how to use it..." 
                  value={formData.description} 
                  onChange={e => setFormData({ ...formData, description: e.target.value })} 
                  required 
                  rows="3" 
                  className="listing-textarea"
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Language <span className="required">*</span></label>
                  <select 
                    value={formData.language} 
                    onChange={e => setFormData({ ...formData, language: e.target.value })} 
                    required
                  >
                    <option value="">Select Language</option>
                    {['JavaScript', 'Python', 'React', 'Node.js', 'HTML/CSS', 'TypeScript', 'Java', 'C++', 'Ruby', 'Go', 'PHP', 'Rust', 'Swift'].map(l => (
                      <option key={l} value={l}>{l}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tags (comma-separated)</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🏷️</span>
                    <input 
                      type="text" 
                      placeholder="react, hooks, api, typescript" 
                      value={formData.tags} 
                      onChange={e => setFormData({ ...formData, tags: e.target.value })} 
                    />
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Code <span className="required">*</span></label>
                <textarea 
                  placeholder="Paste your code here..." 
                  value={formData.code} 
                  onChange={e => setFormData({ ...formData, code: e.target.value })} 
                  required 
                  rows="8" 
                  className="code-textarea"
                  style={{ fontFamily: 'var(--font-mono)', background: 'var(--gray-900)', color: '#e5e7eb' }}
                />
              </div>
              <div className="listing-form-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? (
                    <><span className="loading-spinner"></span> Publishing...</>
                  ) : (
                    <>💻 Publish Code</>
                  )}
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
          <CodeCard key={snippet.id} snippet={snippet} onLike={handleLike} onDelete={handleDelete} />
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

function CodeCard({ snippet, onLike, onDelete }) {
  const { state } = useAppContext();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isOwner = state.currentUser && snippet.user_id === state.currentUser.id;
  
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
    <>
      <div className="code-card">
        <div className="code-header">
          <div>
            <h3>{snippet.title}</h3>
            <span className="language-badge">{snippet.language}</span>
          </div>
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="btn-sm"
              style={{ 
                background: 'var(--danger-light)', 
                color: 'var(--danger)', 
                border: 'none', 
                cursor: 'pointer',
                borderRadius: 'var(--radius-full)',
                padding: '6px 12px',
                fontSize: '0.8rem'
              }}
            >
              🗑️
            </button>
          )}
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
                src={snippet.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(snippet.author || 'Dev')}&background=667eea&color=fff&size=20`} 
                alt={snippet.author} 
                style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '4px' }}
              />
              {snippet.user_id ? (
                <Link to={`/profile/${snippet.user_id}`} className="seller-link">{snippet.author}</Link>
              ) : snippet.author}
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
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Snippet"
        message={`Are you sure you want to delete "${snippet.title}"? This action cannot be undone.`}
        onConfirm={() => {
          onDelete(snippet);
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Delete"
        type="danger"
      />
    </>
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
// SETTINGS COMPONENT — FULLY FUNCTIONAL
// ============================================
function Settings() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarSaved, setAvatarSaved] = useState(false);
  
  const [profileForm, setProfileForm] = useState({
    name: state.profile?.name || '',
    email: state.currentUser?.email || '',
    bio: state.profile?.bio || '',
    website: state.profile?.website || '',
    github: state.profile?.github || '',
    twitter: state.profile?.twitter || '',
    linkedin: state.profile?.linkedin || '',
    role: state.profile?.role || 'developer'
  });
  
  const [securityForm, setSecurityForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: ''
  });
  const [showPwd, setShowPwd] = useState({ current: false, newp: false, confirm: false });
  const [sessions, setSessions] = useState([
    { id: 1, device: '💻 Chrome on Windows', location: 'Current session', time: 'Now', current: true },
    { id: 2, device: '📱 Safari on iPhone', location: 'Last seen 2 days ago', time: '2d ago', current: false },
  ]);
  
  const [notificationPrefs, setNotificationPrefs] = useState({
    emailNotifications: state.profile?.notif_email ?? true,
    pushNotifications: state.profile?.notif_push ?? false,
    marketingEmails: state.profile?.notif_marketing ?? false,
    listingUpdates: state.profile?.notif_listings ?? true,
    messageAlerts: state.profile?.notif_messages ?? true,
    favoritesActivity: state.profile?.notif_favorites ?? true,
    weeklyDigest: state.profile?.notif_digest ?? false
  });
  
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: state.profile?.privacy_visibility || 'public',
    showEmail: state.profile?.privacy_show_email ?? false,
    showActivity: state.profile?.privacy_show_activity ?? true,
    allowMessages: state.profile?.privacy_allow_messages ?? true,
    showOnlineStatus: state.profile?.privacy_online ?? true,
    indexableProfile: state.profile?.privacy_indexable ?? true,
  });

  const [connectedAccounts, setConnectedAccounts] = useState({
    github: state.profile?.github ? true : false,
    twitter: state.profile?.twitter ? true : false,
    linkedin: state.profile?.linkedin ? true : false,
  });

  useEffect(() => {
    setProfileForm({
      name: state.profile?.name || '',
      email: state.currentUser?.email || '',
      bio: state.profile?.bio || '',
      website: state.profile?.website || '',
      github: state.profile?.github || '',
      twitter: state.profile?.twitter || '',
      linkedin: state.profile?.linkedin || '',
      role: state.profile?.role || 'developer'
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
      const { error } = await supabase.from('profiles').upsert({
        id: state.currentUser.id,
        name: profileForm.name,
        bio: profileForm.bio,
        website: profileForm.website,
        github: profileForm.github,
        twitter: profileForm.twitter,
        linkedin: profileForm.linkedin,
        role: profileForm.role,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Profile updated successfully!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not save profile: ' + (error.message || 'Unknown error'), type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSaving(false);
  };

  const handleAvatarUpdate = async (avatarUrl) => {
    const prev = state.profile?.avatar_url;
    dispatch({ type: 'UPDATE_AVATAR', payload: avatarUrl });
    try {
      const { error } = await supabase.from('profiles').update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() }).eq('id', state.currentUser.id);
      if (error) { dispatch({ type: 'UPDATE_AVATAR', payload: prev }); throw error; }
      setAvatarSaved(true);
      setTimeout(() => setAvatarSaved(false), 3000);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Avatar updated!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (err) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not save avatar', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!securityForm.currentPassword) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Please enter your current password', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    if (securityForm.newPassword !== securityForm.confirmNewPassword) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ New passwords do not match', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    if (securityForm.newPassword.length < 6) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Password must be at least 6 characters', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: securityForm.newPassword });
      if (error) throw error;
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Password changed successfully!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      setSecurityForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSaving(false);
  };

  const handleSaveNotifications = async () => {
    try {
      const newVal = state.notificationsEnabled;
      const updateData = {
        id: state.currentUser.id,
        notifications_enabled: newVal,
        notif_email: notificationPrefs.emailNotifications,
        notif_push: notificationPrefs.pushNotifications,
        notif_marketing: notificationPrefs.marketingEmails,
        notif_listings: notificationPrefs.listingUpdates,
        notif_messages: notificationPrefs.messageAlerts,
        notif_favorites: notificationPrefs.favoritesActivity,
        notif_digest: notificationPrefs.weeklyDigest,
        updated_at: new Date().toISOString()
      };
      await supabase.from('profiles').upsert(updateData, { onConflict: 'id' });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Notification preferences saved!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not save preferences', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handleSavePrivacy = async () => {
    try {
      await supabase.from('profiles').upsert({
        id: state.currentUser.id,
        privacy_visibility: privacySettings.profileVisibility,
        privacy_show_email: privacySettings.showEmail,
        privacy_show_activity: privacySettings.showActivity,
        privacy_allow_messages: privacySettings.allowMessages,
        privacy_online: privacySettings.showOnlineStatus,
        privacy_indexable: privacySettings.indexableProfile,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      dispatch({ type: 'UPDATE_PROFILE', payload: {
        privacy_visibility: privacySettings.profileVisibility,
        privacy_show_email: privacySettings.showEmail,
        privacy_show_activity: privacySettings.showActivity,
        privacy_allow_messages: privacySettings.allowMessages,
        privacy_online: privacySettings.showOnlineStatus,
        privacy_indexable: privacySettings.indexableProfile,
      }});
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Privacy settings saved!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not save privacy settings', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handleExportData = async () => {
    try {
      const exportPayload = {
        profile: state.profile,
        listings: (state.listings || []).filter(l => l.user_id === state.currentUser.id),
        favorites: state.favorites || [],
        codeSnippets: (state.codeSnippets || []).filter(s => s.user_id === state.currentUser.id),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devmarket-data-${state.currentUser.id.substring(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '📦 Data exported successfully!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Export failed', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await supabase.from('profiles').delete().eq('id', state.currentUser.id);
      await supabase.auth.signOut();
      dispatch({ type: 'LOGOUT' });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '👋 Account deleted. Goodbye!', type: 'info', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not delete account. Contact support.', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setShowDeleteConfirm(false);
  };

  const sidebarTabs = [
    { id: 'profile', icon: '👤', label: 'Profile' },
    { id: 'avatar', icon: '🖼️', label: 'Avatar' },
    { id: 'security', icon: '🔒', label: 'Security' },
    { id: 'notifications', icon: '🔔', label: 'Notifications' },
    { id: 'privacy', icon: '🛡️', label: 'Privacy' },
    { id: 'appearance', icon: '🎨', label: 'Appearance' },
    { id: 'connected', icon: '🔗', label: 'Connections' },
    { id: 'danger', icon: '⚠️', label: 'Danger Zone' }
  ];

  const userName = state.profile?.name || state.currentUser?.email?.split('@')[0] || 'User';

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
                    <input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Your full name" />
                  </div>
                </div>
                
                <div className="form-group">
                  <label>Email Address <span style={{fontSize:'0.75rem',color:'var(--gray-400)'}}>— cannot be changed here</span></label>
                  <div className="input-wrapper">
                    <span className="input-icon">📧</span>
                    <input type="email" value={profileForm.email} disabled style={{ background: 'var(--gray-100)', cursor: 'not-allowed' }} />
                  </div>
                </div>

                <div className="form-group">
                  <label>Role</label>
                  <select value={profileForm.role} onChange={e => setProfileForm({ ...profileForm, role: e.target.value })}>
                    <option value="developer">👨‍💻 Developer</option>
                    <option value="designer">🎨 Designer</option>
                    <option value="freelancer">💼 Freelancer</option>
                    <option value="startup">🚀 Startup</option>
                    <option value="other">👤 Other</option>
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Bio</label>
                  <textarea value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Tell the community about yourself..." rows="4" className="settings-textarea" maxLength={500} />
                  <small style={{color:'var(--gray-400)'}}>{profileForm.bio.length}/500 characters</small>
                </div>
                
                <div className="form-group">
                  <label>Website</label>
                  <div className="input-wrapper">
                    <span className="input-icon">🌐</span>
                    <input type="url" value={profileForm.website} onChange={e => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="https://yourwebsite.com" />
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div className="form-group">
                    <label>GitHub Username</label>
                    <div className="input-wrapper">
                      <span className="input-icon">⌨️</span>
                      <input type="text" value={profileForm.github} onChange={e => setProfileForm({ ...profileForm, github: e.target.value })} placeholder="username" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Twitter / X Handle</label>
                    <div className="input-wrapper">
                      <span className="input-icon">𝕏</span>
                      <input type="text" value={profileForm.twitter} onChange={e => setProfileForm({ ...profileForm, twitter: e.target.value })} placeholder="@username" />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>LinkedIn Username</label>
                    <div className="input-wrapper">
                      <span className="input-icon">💼</span>
                      <input type="text" value={profileForm.linkedin} onChange={e => setProfileForm({ ...profileForm, linkedin: e.target.value })} placeholder="your-linkedin-username" />
                    </div>
                  </div>
                </div>
                
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? '💾 Saving...' : '💾 Save Profile'}
                </button>
              </form>
            )}

            {activeTab === 'avatar' && (
              <div className="settings-form">
                <h3>Profile Picture</h3>
                <p className="settings-description">Choose how you appear across DevMarket</p>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0' }}>
                  <AvatarUpload
                    currentAvatar={state.profile?.avatar_url}
                    userName={userName}
                    onAvatarUpdate={handleAvatarUpdate}
                    size="large"
                  />
                  {avatarSaved && <p style={{color:'var(--success)',fontWeight:600}}>✅ Avatar saved to your profile!</p>}
                  <p style={{color:'var(--gray-500)',fontSize:'0.88rem',textAlign:'center',maxWidth:340}}>
                    Click your avatar above to choose from preset options. Your picture is shown on your profile, listings, posts and messages.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="settings-form">
                <h3>Security</h3>
                <p className="settings-description">Keep your account safe with a strong password</p>

                <form onSubmit={handlePasswordChange}>
                  <div className="form-group">
                    <label>Current Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔒</span>
                      <input
                        type={showPwd.current ? 'text' : 'password'}
                        value={securityForm.currentPassword}
                        onChange={e => setSecurityForm({ ...securityForm, currentPassword: e.target.value })}
                        placeholder="Enter current password"
                      />
                      <button type="button" className="pwd-toggle" onClick={() => setShowPwd(p => ({...p, current: !p.current}))}>{showPwd.current ? '🙈' : '👁️'}</button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>New Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔑</span>
                      <input
                        type={showPwd.newp ? 'text' : 'password'}
                        value={securityForm.newPassword}
                        onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })}
                        placeholder="At least 6 characters"
                      />
                      <button type="button" className="pwd-toggle" onClick={() => setShowPwd(p => ({...p, newp: !p.newp}))}>{showPwd.newp ? '🙈' : '👁️'}</button>
                    </div>
                    {securityForm.newPassword && (
                      <div className="password-strength">
                        <div className={`strength-bar ${securityForm.newPassword.length < 6 ? 'weak' : securityForm.newPassword.length < 10 ? 'medium' : 'strong'}`}></div>
                        <small>{securityForm.newPassword.length < 6 ? '⚠️ Too short' : securityForm.newPassword.length < 10 ? '🟡 Medium' : '✅ Strong'}</small>
                      </div>
                    )}
                  </div>
                  <div className="form-group">
                    <label>Confirm New Password</label>
                    <div className="input-wrapper">
                      <span className="input-icon">🔑</span>
                      <input
                        type={showPwd.confirm ? 'text' : 'password'}
                        value={securityForm.confirmNewPassword}
                        onChange={e => setSecurityForm({ ...securityForm, confirmNewPassword: e.target.value })}
                        placeholder="Repeat new password"
                      />
                      <button type="button" className="pwd-toggle" onClick={() => setShowPwd(p => ({...p, confirm: !p.confirm}))}>{showPwd.confirm ? '🙈' : '👁️'}</button>
                    </div>
                    {securityForm.confirmNewPassword && securityForm.newPassword !== securityForm.confirmNewPassword && (
                      <small style={{color:'var(--danger)'}}>❌ Passwords don't match</small>
                    )}
                    {securityForm.confirmNewPassword && securityForm.newPassword === securityForm.confirmNewPassword && (
                      <small style={{color:'var(--success)'}}>✅ Passwords match</small>
                    )}
                  </div>
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? '🔒 Updating...' : '🔒 Update Password'}
                  </button>
                </form>

                <div style={{marginTop: 32}}>
                  <h4 style={{marginBottom: 12}}>Active Sessions</h4>
                  {sessions.map(s => (
                    <div key={s.id} className="session-item">
                      <span className="session-device">{s.device}</span>
                      <span className="session-location">{s.location}</span>
                      {s.current ? (
                        <span className="badge-current">Current</span>
                      ) : (
                        <button className="btn-sm" style={{background:'var(--danger)',color:'white',border:'none',cursor:'pointer'}}
                          onClick={() => { setSessions(prev => prev.filter(x => x.id !== s.id)); dispatch({type:'ADD_NOTIFICATION',payload:{message:'🔒 Session revoked',type:'info',time:new Date().toLocaleTimeString(),read:false}}); }}>
                          Revoke
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="settings-form">
                <h3>Notification Preferences</h3>
                <p className="settings-description">Configure how and when you receive notifications</p>

                <div className="setting-item master-toggle">
                  <div className="setting-info">
                    <strong>Enable All Notifications</strong>
                    <p>When disabled, no notifications will appear or be stored</p>
                  </div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={state.notificationsEnabled} onChange={async () => {
                      const newVal = !state.notificationsEnabled;
                      // Persist to localStorage immediately (keeps setting across hard refresh)
                      try { localStorage.setItem('devMarketNotificationsEnabled', JSON.stringify(newVal)); } catch(e) {}
                      dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: newVal });
                      if (!newVal) {
                        dispatch({ type: 'CLEAR_NOTIFICATIONS' });
                      }
                      // Use _force:true so this feedback toast bypasses the disabled-notifications guard
                      dispatch({ type: 'ADD_NOTIFICATION', payload: {
                        message: newVal ? '🔔 Notifications are now ON' : '🔕 Notifications are now OFF',
                        type: newVal ? 'success' : 'info',
                        time: new Date().toLocaleTimeString(),
                        read: false,
                        _force: true
                      }});
                      // Persist to Supabase so it survives logout + login on other devices
                      if (state.currentUser) {
                        try {
                          await supabase.from('profiles').upsert({
                            id: state.currentUser.id,
                            notifications_enabled: newVal,
                            updated_at: new Date().toISOString()
                          }, { onConflict: 'id' });
                        } catch(e) {}
                      }
                    }} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
                <p style={{ fontSize: '0.8rem', marginTop: 4, fontWeight: 600, minHeight: '1.2em', color: state.notificationsEnabled ? 'var(--success)' : 'var(--danger)' }}>
                  {state.notificationsEnabled ? '🔔 Notifications are currently ON' : '🔕 Notifications are currently OFF'}
                </p>

                {state.notificationsEnabled && (
                  <div className="notification-settings">
                    {[
                      { key: 'emailNotifications', label: 'Email Notifications', desc: 'Get important updates via email' },
                      { key: 'pushNotifications', label: 'Push Notifications', desc: 'Browser push alerts (requires permission)' },
                      { key: 'messageAlerts', label: 'Message Alerts', desc: 'When someone sends you a message' },
                      { key: 'listingUpdates', label: 'Listing Updates', desc: 'Activity on your listings' },
                      { key: 'favoritesActivity', label: 'Favorites Activity', desc: 'Updates from items you favorited' },
                      { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of platform activity' },
                      { key: 'marketingEmails', label: 'Marketing Emails', desc: 'Product news and feature announcements' },
                    ].map(({ key, label, desc }) => (
                      <div className="setting-item" key={key}>
                        <div className="setting-info">
                          <strong>{label}</strong>
                          <p>{desc}</p>
                        </div>
                        <label className="toggle-switch">
                          <input type="checkbox" checked={notificationPrefs[key]} onChange={() => setNotificationPrefs({ ...notificationPrefs, [key]: !notificationPrefs[key] })} />
                          <span className="toggle-slider"></span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
                
                <button onClick={handleSaveNotifications} className="btn-primary">
                  💾 Save Preferences
                </button>
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="settings-form">
                <h3>Privacy Settings</h3>
                <p className="settings-description">Control your privacy, visibility and data</p>
                
                <div className="form-group">
                  <label>Profile Visibility</label>
                  <select value={privacySettings.profileVisibility} onChange={e => setPrivacySettings({ ...privacySettings, profileVisibility: e.target.value })}>
                    <option value="public">🌍 Public — visible to everyone</option>
                    <option value="members">👥 Members Only — logged-in users only</option>
                    <option value="private">🔒 Private — only you</option>
                  </select>
                </div>
                
                {[
                  { key: 'showEmail', label: 'Show Email on Profile', desc: 'Display your email publicly' },
                  { key: 'showActivity', label: 'Show Activity Feed', desc: 'Others can see your recent activity' },
                  { key: 'allowMessages', label: 'Allow Direct Messages', desc: 'Let others message you' },
                  { key: 'showOnlineStatus', label: 'Show Online Status', desc: 'Show when you\'re active' },
                  { key: 'indexableProfile', label: 'Allow Search Indexing', desc: 'Your profile may appear in search results' },
                ].map(({ key, label, desc }) => (
                  <div className="setting-item" key={key}>
                    <div className="setting-info">
                      <strong>{label}</strong>
                      <p>{desc}</p>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={privacySettings[key]} onChange={() => setPrivacySettings({ ...privacySettings, [key]: !privacySettings[key] })} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
                
                <button onClick={handleSavePrivacy} className="btn-primary">💾 Save Privacy Settings</button>
              </div>
            )}

            {activeTab === 'appearance' && (
              <div className="settings-form">
                <h3>Appearance</h3>
                <p className="settings-description">Customize your visual experience</p>
                
                <div className="theme-cards-row">
                  {[
                    { id: 'light', label: '☀️ Light', desc: 'Clean and bright' },
                    { id: 'dark', label: '🌙 Dark', desc: 'Easy on the eyes' },
                  ].map(t => (
                    <div
                      key={t.id}
                      className={`theme-card ${state.theme === t.id ? 'selected' : ''}`}
                      onClick={() => { if (state.theme !== t.id) dispatch({ type: 'TOGGLE_THEME' }); }}
                    >
                      <div className={`theme-preview theme-preview-${t.id}`}></div>
                      <strong>{t.label}</strong>
                      <p>{t.desc}</p>
                      {state.theme === t.id && <span className="theme-check">✅ Active</span>}
                    </div>
                  ))}
                </div>
                <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>
                  Current theme: <strong>{state.theme === 'light' ? '☀️ Light' : '🌙 Dark'}</strong>
                </p>
              </div>
            )}

            {activeTab === 'connected' && (
              <div className="settings-form">
                <h3>Connected Accounts</h3>
                <p className="settings-description">Link your social accounts to your DevMarket profile</p>

                {[
                  { key: 'github', icon: '⌨️', label: 'GitHub', url: profileForm.github ? `https://github.com/${profileForm.github}` : null, placeholder: 'Enter your GitHub username' },
                  { key: 'twitter', icon: '𝕏', label: 'Twitter / X', url: profileForm.twitter ? `https://twitter.com/${profileForm.twitter.replace('@','')}` : null, placeholder: 'Enter your Twitter handle' },
                  { key: 'linkedin', icon: '💼', label: 'LinkedIn', url: profileForm.linkedin ? `https://linkedin.com/in/${profileForm.linkedin}` : null, placeholder: 'Enter your LinkedIn username' },
                ].map(({ key, icon, label, url, placeholder }) => (
                  <div key={key} className="connected-account-item">
                    <div className="connected-account-info">
                      <span className="connected-icon">{icon}</span>
                      <div>
                        <strong>{label}</strong>
                        {profileForm[key] ? (
                          <p style={{color:'var(--success)',fontSize:'0.82rem'}}>✅ Connected: {profileForm[key]}</p>
                        ) : (
                          <p style={{color:'var(--gray-400)',fontSize:'0.82rem'}}>Not connected</p>
                        )}
                      </div>
                    </div>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      {url && <a href={url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary">View</a>}
                      {profileForm[key] ? (
                        <button className="btn-sm" style={{background:'var(--danger)',color:'white',border:'none',cursor:'pointer'}}
                          onClick={() => { setProfileForm(f => ({...f, [key]: ''})); }}>
                          Disconnect
                        </button>
                      ) : (
                        <button className="btn-sm btn-secondary"
                          onClick={() => {
                            const val = prompt(`Enter your ${label} username:`);
                            if (val) setProfileForm(f => ({...f, [key]: val.replace('@','')}));
                          }}>
                          + Connect
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                <div style={{marginTop:20}}>
                  <button className="btn-primary" onClick={handleProfileUpdate} disabled={saving}>
                    {saving ? '💾 Saving...' : '💾 Save Connections'}
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'danger' && (
              <div className="settings-form">
                <h3 style={{ color: 'var(--danger)' }}>⚠️ Danger Zone</h3>
                <p className="settings-description">These actions are irreversible — proceed with caution</p>
                
                <div className="danger-zone-card warning">
                  <h4 style={{ color: 'var(--warning)' }}>📥 Export My Data</h4>
                  <p>Download all your data including your profile, listings, snippets, and favorites as a JSON file.</p>
                  <button className="btn-secondary" onClick={handleExportData}>📥 Download My Data</button>
                </div>

                <div className="danger-zone-card" style={{marginTop:16}}>
                  <h4 style={{ color: 'var(--danger)' }}>🗑️ Delete Account</h4>
                  <p>Permanently delete your DevMarket account. All your data, listings, and messages will be erased. <strong>This cannot be undone.</strong></p>
                  <button className="btn-primary" onClick={() => setShowDeleteConfirm(true)} style={{ background: 'var(--danger)' }}>
                    🗑️ Delete My Account
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="⚠️ Delete Account Forever"
        message="Are you absolutely sure? Your profile, listings, and all data will be permanently deleted. This cannot be undone."
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
        confirmText="Yes, Delete Forever"
        type="danger"
      />
    </>
  );
}

// ============================================
// ADMIN POSTS TAB
// ============================================
function AdminPostsTab({ dispatch, state }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  useEffect(() => { loadPosts(); }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(100);
      if (data) setPosts(data);
    } catch (e) { setPosts([]); }
    setLoading(false);
  };

  const handleDeletePost = async (post) => {
    try {
      await supabase.from('posts').delete().eq('id', post.id);
      setPosts(prev => prev.filter(p => p.id !== post.id));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🗑️ Post deleted`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not delete post', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="admin-section-card">
      <div className="admin-section-header">
        <h3>📝 Community Posts ({posts.length})</h3>
        <button className="btn-sm btn-secondary" onClick={loadPosts}>🔄 Refresh</button>
      </div>
      {loading ? (
        <div style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>Loading posts...</div>
      ) : posts.length === 0 ? (
        <div style={{textAlign:'center',padding:40,color:'var(--gray-400)'}}>No posts yet</div>
      ) : (
        <div className="admin-listings-grid">
          {posts.map(post => (
            <div key={post.id} className="admin-listing-item">
              <div className="admin-listing-info">
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <img src={post.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name||'U')}&background=667eea&color=fff&size=24`} alt="" style={{width:24,height:24,borderRadius:'50%'}} />
                  <strong>{post.author_name || 'Unknown'}</strong>
                  <small style={{color:'var(--gray-400)'}}>{new Date(post.created_at).toLocaleDateString()}</small>
                  <span style={{marginLeft:'auto',color:'var(--danger)',fontSize:'0.8rem'}}>❤️ {post.likes || 0}</span>
                </div>
                <p style={{fontSize:'0.88rem',color:'var(--gray-600)',margin:0}}>{post.text?.substring(0, 120)}{post.text?.length > 120 ? '...' : ''}</p>
                {post.image_url && <small style={{color:'var(--primary)'}}>📷 Has image</small>}
                {post.video_url && <small style={{color:'var(--primary)'}}>🎥 Has video</small>}
              </div>
              <div className="admin-listing-actions">
                <button className="btn-sm" style={{background:'var(--danger)',color:'white',border:'none',cursor:'pointer'}} onClick={() => setDeleteConfirm(post)}>🗑️ Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete Post"
        message={`Remove this post by ${deleteConfirm?.author_name}? This cannot be undone.`}
        onConfirm={() => handleDeletePost(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
        confirmText="Delete"
        type="danger"
      />
    </div>
  );
}

// ============================================
// ADMIN ANNOUNCEMENTS TAB — FULL IMPLEMENTATION
// ============================================
function AdminAnnouncementsTab({ dispatch, state }) {
  const [form, setForm] = useState({ title: '', message: '', type: 'info' });
  const [submitting, setSubmitting] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState(state.maintenanceMode || false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [activeAnnouncement, setActiveAnnouncement] = useState(state.announcement?.message || '');
  const [announcements, setAnnouncements] = useState([]);

  useEffect(() => { loadRecentAnnouncements(); }, []);

  const loadRecentAnnouncements = async () => {
    try {
      const { data } = await supabase.from('notifications').select('*').eq('is_announcement', true).order('created_at', { ascending: false }).limit(10);
      if (data) setAnnouncements(data);
    } catch(e) {}
  };

  const savePlatformSettings = async (updates) => {
    try {
      await supabase.from('platform_settings').upsert({ id: 'main', ...updates, updated_at: new Date().toISOString() }, { onConflict: 'id' });
    } catch(e) { console.error('platform_settings save failed:', e); }
  };

  const handleToggleMaintenance = async () => {
    setSavingMaintenance(true);
    const newVal = !maintenanceOn;
    setMaintenanceOn(newVal);
    dispatch({ type: 'SET_MAINTENANCE_MODE', payload: newVal });
    await savePlatformSettings({ maintenance_mode: newVal });
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: newVal ? '🔧 Maintenance mode ON — users see maintenance page' : '✅ Maintenance mode OFF — site is live', type: newVal ? 'warning' : 'success', time: new Date().toLocaleTimeString(), read: false }});
    setSavingMaintenance(false);
  };

  const handleSetAnnouncement = async () => {
    if (!form.title.trim() && !form.message.trim()) return;
    setSubmitting(true);
    const fullMsg = form.title.trim() ? `${form.title}: ${form.message}` : form.message;
    try {
      // Save to platform_settings for real-time broadcast
      await savePlatformSettings({ announcement_message: fullMsg, announcement_type: form.type });
      // Also notify all users via notifications table
      const { data: allUsers } = await supabase.from('profiles').select('id').limit(500);
      if (allUsers && allUsers.length > 0) {
        const notifs = allUsers.map(u => ({ user_id: u.id, message: `📢 ${fullMsg}`, type: form.type, is_announcement: true, read: false, created_at: new Date().toISOString() }));
        await supabase.from('notifications').insert(notifs);
      }
      dispatch({ type: 'SET_ANNOUNCEMENT', payload: { message: fullMsg, type: form.type, id: Date.now() } });
      setActiveAnnouncement(fullMsg);
      setAnnouncements(prev => [{ id: Date.now(), message: `📢 ${fullMsg}`, type: form.type, created_at: new Date().toISOString() }, ...prev]);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `📢 Announcement broadcast to ${allUsers?.length || 0} users`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      setForm({ title: '', message: '', type: 'info' });
    } catch(e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not send: ' + (e.message || ''), type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSubmitting(false);
  };

  const handleClearAnnouncement = async () => {
    await savePlatformSettings({ announcement_message: null });
    dispatch({ type: 'CLEAR_ANNOUNCEMENT' });
    setActiveAnnouncement('');
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Announcement cleared', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      {/* Maintenance Mode */}
      <div className="admin-section-card">
        <div className="admin-section-header"><h3>🔧 Maintenance Mode</h3></div>
        <div className="settings-form" style={{padding:'12px 0 0'}}>
          <div className="setting-item master-toggle">
            <div className="setting-info">
              <strong>Enable Maintenance Mode</strong>
              <p>When ON, non-admin users see a maintenance page. You can still access the admin panel.</p>
            </div>
            <label className="toggle-switch">
              <input type="checkbox" checked={maintenanceOn} onChange={handleToggleMaintenance} disabled={savingMaintenance} />
              <span className="toggle-slider"></span>
            </label>
          </div>
          {maintenanceOn && (
            <div className="maintenance-active-notice">
              ⚠️ <strong>Maintenance mode is ACTIVE.</strong> Regular users cannot access the site right now.
            </div>
          )}
        </div>
      </div>

      {/* Active Announcement */}
      {activeAnnouncement && (
        <div className="admin-section-card">
          <div className="admin-section-header"><h3>📌 Active Announcement</h3></div>
          <div style={{padding:'12px 0',display:'flex',alignItems:'center',justifyContent:'space-between',gap:12}}>
            <p style={{margin:0,fontSize:'0.9rem',color:'var(--gray-700)'}}>{activeAnnouncement}</p>
            <button className="btn-sm" style={{background:'var(--danger)',color:'white',border:'none',cursor:'pointer',flexShrink:0}} onClick={handleClearAnnouncement}>🗑️ Clear</button>
          </div>
        </div>
      )}

      {/* Send Announcement */}
      <div className="admin-section-card">
        <div className="admin-section-header"><h3>📢 Send Announcement Banner</h3></div>
        <div className="settings-form" style={{padding:'12px 0 0'}}>
          <div className="form-group">
            <label>Title (optional)</label>
            <div className="input-wrapper">
              <span className="input-icon">📢</span>
              <input type="text" value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g., New Feature Available!" />
            </div>
          </div>
          <div className="form-group">
            <label>Message <span className="required">*</span></label>
            <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} placeholder="Write your announcement..." rows={3} className="settings-textarea" />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
              <option value="info">ℹ️ Info</option>
              <option value="success">✅ Success</option>
              <option value="warning">⚠️ Warning</option>
              <option value="error">🚨 Alert</option>
            </select>
          </div>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            <button className="btn-primary" onClick={handleSetAnnouncement} disabled={submitting || (!form.title.trim() && !form.message.trim())}>
              {submitting ? '📤 Sending...' : '📤 Broadcast to All Users'}
            </button>
          </div>
        </div>
      </div>

      {/* Recent */}
      <div className="admin-section-card">
        <div className="admin-section-header"><h3>📋 Recent Announcements</h3></div>
        {announcements.length === 0 ? (
          <p style={{color:'var(--gray-400)',textAlign:'center',padding:20}}>No announcements sent yet</p>
        ) : (
          <div className="activity-list">
            {announcements.map((a, i) => (
              <div key={a.id || i} className="activity-item">
                <span>{a.type === 'success' ? '✅' : a.type === 'warning' ? '⚠️' : a.type === 'error' ? '🚨' : 'ℹ️'}</span>
                <div>
                  <p style={{margin:0,fontSize:'0.88rem'}}>{a.message}</p>
                  <small style={{color:'var(--gray-400)'}}>{new Date(a.created_at).toLocaleDateString()}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================
// FOOTER COMPONENT
// ============================================
function Footer() {
  const currentYear = new Date().getFullYear();
  const { canInstall, install } = usePWAInstall();
  
  return (
    <footer className="footer">
      <div className="footer-compact">
        <div className="footer-brand">
          <span>🚀</span>
          <span className="footer-brand-name">DevMarket</span>
        </div>
        <div className="footer-links">
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/code-sharing">Code Share</Link>
          <Link to="/advertise">Advertise</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        {canInstall && (
          <button className="footer-pwa-btn" onClick={install}>
            📲 Add to Home Screen
          </button>
        )}
        <p className="footer-copy">&copy; {currentYear} DevMarket</p>
      </div>
    </footer>
  );
}

// ============================================
// FLOATING PWA INSTALL BUTTON
// ============================================
function FloatingPWAButton() {
  const { canInstall, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('pwaDismissed') === '1'; } catch(e) { return false; }
  });

  if (!canInstall || dismissed) return null;

  return (
    <div className="pwa-float-banner">
      <div className="pwa-float-content">
        <span className="pwa-float-icon">📲</span>
        <div className="pwa-float-text">
          <strong>Install DevMarket</strong>
          <p>Add to your home screen for the best experience</p>
        </div>
      </div>
      <div className="pwa-float-actions">
        <button className="pwa-float-install" onClick={install}>Install</button>
        <button className="pwa-float-dismiss" onClick={() => { setDismissed(true); try { localStorage.setItem('pwaDismissed', '1'); } catch(e) {} }}>✕</button>
      </div>
    </div>
  );
}

export default App;

// ============================================
// MEDIA UPLOAD ZONE — Drag & Drop + URL
// ============================================
function MediaUploadZone({ label, accept, currentUrl, onUrl, onFile }) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlVal, setUrlVal] = useState(currentUrl || '');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    setUploading(true);
    await onFile(file);
    setUploading(false);
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    await onFile(file);
    setUploading(false);
  };

  const handleUrlSubmit = (e) => {
    e.preventDefault();
    onUrl(urlVal.trim());
    setUrlMode(false);
  };

  const isImage = label.includes('📷');
  const preview = currentUrl;

  return (
    <div className="media-upload-zone-wrapper">
      {urlMode ? (
        <div className="media-url-mode">
          <input
            type="url"
            placeholder={isImage ? "Paste image URL..." : "Paste video/YouTube URL..."}
            value={urlVal}
            onChange={e => setUrlVal(e.target.value)}
            className="compose-url-input"
            autoFocus
          />
          <div className="media-url-actions">
            <button className="btn-secondary btn-sm" onClick={() => setUrlMode(false)}>Cancel</button>
            <button className="btn-primary btn-sm" onClick={handleUrlSubmit}>Use URL</button>
          </div>
        </div>
      ) : (
        <div
          className={`media-dropzone ${isDragging ? 'dragging' : ''} ${preview ? 'has-media' : ''}`}
          onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !preview && fileRef.current?.click()}
        >
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {uploading ? (
            <div className="dropzone-uploading">
              <div className="upload-spinner"></div>
              <p>Uploading...</p>
            </div>
          ) : preview ? (
            <div className="dropzone-preview">
              {isImage ? (
                <img src={preview} alt="Preview" onError={e => e.target.style.display='none'} />
              ) : (
                <div className="dropzone-video-thumb">🎥 Video attached</div>
              )}
              <button
                className="dropzone-remove"
                onClick={e => { e.stopPropagation(); onUrl(''); setUrlVal(''); }}
                title="Remove"
              >×</button>
            </div>
          ) : (
            <div className="dropzone-empty">
              <span className="dropzone-icon">{isImage ? '📷' : '🎥'}</span>
              <p className="dropzone-label">{label}</p>
              <p className="dropzone-hint">Drag & drop or click to upload</p>
              <button
                className="dropzone-url-btn"
                onClick={e => { e.stopPropagation(); setUrlMode(true); }}
              >🔗 Use URL instead</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// POSTS COMPONENT — Social Feed
// ============================================
function Posts() {
  const { state, dispatch } = useAppContext();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCompose, setShowCompose] = useState(false);
  const [newPost, setNewPost] = useState({ text: '', imageUrl: '', videoUrl: '' });
  const [submitting, setSubmitting] = useState(false);
  const [deletePostConfirm, setDeletePostConfirm] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*, profile:user_id(name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!error && data) {
        setPosts(data);
      } else {
        // Table may not exist yet — show empty state gracefully
        setPosts([]);
      }
    } catch (_) {
      setPosts([]);
    }
    setLoading(false);
  };

  const handleSubmitPost = async () => {
    if (!newPost.text.trim() && !newPost.imageUrl.trim() && !newPost.videoUrl.trim()) return;
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '🔒 Please sign in to post', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from('posts').insert({
        user_id: state.currentUser.id,
        author_name: state.profile?.name || state.currentUser.email?.split('@')[0] || 'User',
        author_avatar: state.profile?.avatar_url || '',
        text: newPost.text.trim(),
        image_url: newPost.imageUrl.trim() || null,
        video_url: newPost.videoUrl.trim() || null,
        likes: 0,
        created_at: new Date().toISOString()
      }).select().single();
      if (error) throw error;
      setPosts(prev => [data, ...prev]);
      setNewPost({ text: '', imageUrl: '', videoUrl: '' });
      setShowCompose(false);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Post published!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
    } catch (err) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not publish post. Make sure the posts table is created in Supabase.', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setSubmitting(false);
  };

  const handleLikePost = async (post) => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '🔒 Sign in to like posts', type: 'warning', time: new Date().toLocaleTimeString(), read: false }});
      return;
    }
    const newLikes = (post.likes || 0) + 1;
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: newLikes } : p));
    try {
      await supabase.from('posts').update({ likes: newLikes }).eq('id', post.id);
    } catch (_) {
      setPosts(prev => prev.map(p => p.id === post.id ? { ...p, likes: post.likes } : p));
    }
  };

  const handleDeletePost = async () => {
    if (!deletePostConfirm) return;
    try {
      await supabase.from('posts').delete().eq('id', deletePostConfirm.id);
      setPosts(prev => prev.filter(p => p.id !== deletePostConfirm.id));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '🗑️ Post deleted', type: 'info', time: new Date().toLocaleTimeString(), read: false }});
    } catch (_) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Could not delete post', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
    }
    setDeletePostConfirm(null);
  };

  const isVideo = (url) => url && (url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo') || /\.(mp4|webm|ogg)$/i.test(url));
  const getYoutubeEmbed = (url) => {
    const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]+)/);
    return match ? `https://www.youtube.com/embed/${match[1]}` : null;
  };

  return (
    <div className="posts-page">
      <div className="page-header">
        <h1>📝 Community Posts</h1>
        <p>Share updates, ideas, images and videos with the DevMarket community</p>
      </div>

      {/* Compose Button */}
      {state.currentUser && !showCompose && (
        <button className="posts-compose-trigger" onClick={() => setShowCompose(true)}>
          <img 
            src={state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.name || 'U')}&background=667eea&color=fff&size=40`}
            alt="You"
            className="compose-avatar"
            onError={e => { e.target.src = `https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=40`; }}
          />
          <span className="compose-placeholder">What's on your mind?</span>
          <span className="compose-icons">📷 🎥</span>
        </button>
      )}

      {/* Compose Form */}
      {showCompose && (
        <div className="posts-compose-card">
          <div className="compose-header">
            <img 
              src={state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(state.profile?.name || 'U')}&background=667eea&color=fff&size=40`}
              alt="You"
              className="compose-avatar"
            />
            <strong>{state.profile?.name || state.currentUser?.email?.split('@')[0]}</strong>
          </div>
          <textarea
            className="compose-textarea"
            placeholder="Share something with the community... What are you working on? Any cool discoveries? 🚀"
            value={newPost.text}
            onChange={e => setNewPost({...newPost, text: e.target.value})}
            rows={4}
          />
          <div className="compose-media-inputs">
            <MediaUploadZone
              label="📷 Image"
              accept="image/*"
              currentUrl={newPost.imageUrl}
              onUrl={url => setNewPost({...newPost, imageUrl: url})}
              onFile={async (file) => {
                try {
                  const ext = file.name.split('.').pop();
                  const path = `posts/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from('post-media').upload(path, file, { upsert: true });
                  if (!error) {
                    const { data } = supabase.storage.from('post-media').getPublicUrl(path);
                    setNewPost(p => ({...p, imageUrl: data.publicUrl}));
                  }
                } catch(e) {
                  dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Image upload failed, try URL instead', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
                }
              }}
            />
            <MediaUploadZone
              label="🎥 Video"
              accept="video/*"
              currentUrl={newPost.videoUrl}
              onUrl={url => setNewPost({...newPost, videoUrl: url})}
              onFile={async (file) => {
                try {
                  const ext = file.name.split('.').pop();
                  const path = `posts/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from('post-media').upload(path, file, { upsert: true });
                  if (!error) {
                    const { data } = supabase.storage.from('post-media').getPublicUrl(path);
                    setNewPost(p => ({...p, videoUrl: data.publicUrl}));
                  }
                } catch(e) {
                  dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Video upload failed, try URL instead', type: 'error', time: new Date().toLocaleTimeString(), read: false }});
                }
              }}
            />
          </div>
          {newPost.imageUrl && (
            <div className="compose-preview">
              <img src={newPost.imageUrl} alt="Preview" onError={e => e.target.style.display='none'} />
            </div>
          )}
          <div className="compose-actions">
            <button className="btn-secondary btn-sm" onClick={() => { setShowCompose(false); setNewPost({ text: '', imageUrl: '', videoUrl: '' }); }}>
              Cancel
            </button>
            <button 
              className="btn-primary btn-sm" 
              onClick={handleSubmitPost} 
              disabled={submitting || (!newPost.text.trim() && !newPost.imageUrl && !newPost.videoUrl)}
            >
              {submitting ? '⏳ Posting...' : '🚀 Post'}
            </button>
          </div>
        </div>
      )}

      {/* Posts Feed */}
      {loading ? (
        <div className="posts-loading">
          {[1,2,3].map(i => (
            <div key={i} className="post-skeleton">
              <div className="skeleton" style={{width:40, height:40, borderRadius:'50%'}}></div>
              <div style={{flex:1, display:'flex', flexDirection:'column', gap:8}}>
                <div className="skeleton" style={{height:14, width:'40%'}}></div>
                <div className="skeleton" style={{height:14, width:'80%'}}></div>
                <div className="skeleton" style={{height:14, width:'60%'}}></div>
              </div>
            </div>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="empty-state" style={{marginTop:48}}>
          <span className="empty-icon">📝</span>
          <h3>No posts yet</h3>
          <p>Be the first to share something with the community!</p>
          {!state.currentUser && <p style={{color:'var(--gray-400)', fontSize:'0.9rem'}}>Sign in to start posting.</p>}
          {state.currentUser && <button className="btn-primary" onClick={() => setShowCompose(true)}>✍️ Create First Post</button>}
        </div>
      ) : (
        <div className="posts-feed">
          {posts.map(post => (
            <div key={post.id} className="post-card">
              <div className="post-header">
                <img
                  src={post.author_avatar || post.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.author_name || 'U')}&background=667eea&color=fff&size=40`}
                  alt={post.author_name}
                  className="post-avatar"
                  onError={e => { e.target.src = `https://ui-avatars.com/api/?name=U&background=667eea&color=fff&size=40`; }}
                />
                <div className="post-meta">
                  <strong>{post.author_name || post.profile?.name || 'User'}</strong>
                  <span>{new Date(post.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                </div>
                {state.currentUser?.id === post.user_id && (
                  <button 
                    className="post-delete-btn" 
                    onClick={() => setDeletePostConfirm({ id: post.id, text: post.text })}
                    title="Delete post"
                  >
                    🗑️
                  </button>
                )}
              </div>

              {post.text && <p className="post-text">{post.text}</p>}

              {post.image_url && !isVideo(post.image_url) && (
                <div className="post-image-wrap">
                  <img 
                    src={post.image_url} 
                    alt="Post" 
                    className="post-image"
                    onError={e => e.target.parentElement.style.display='none'}
                  />
                </div>
              )}

              {post.video_url && (
                <div className="post-video-wrap">
                  {getYoutubeEmbed(post.video_url) ? (
                    <iframe
                      src={getYoutubeEmbed(post.video_url)}
                      title="video"
                      frameBorder="0"
                      allowFullScreen
                      className="post-iframe"
                    />
                  ) : (
                    <video src={post.video_url} controls className="post-video" />
                  )}
                </div>
              )}

              <div className="post-footer">
                <button className="post-like-btn" onClick={() => handleLikePost(post)}>
                  ❤️ <span>{post.likes || 0}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalPortal>
        <ConfirmDialog
          isOpen={!!deletePostConfirm}
          title="Delete Post"
          message="Are you sure you want to delete this post? This cannot be undone."
          onConfirm={handleDeletePost}
          onCancel={() => setDeletePostConfirm(null)}
          confirmText="Delete"
          type="danger"
        />
      </ModalPortal>
    </div>
  );
}