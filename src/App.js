// ============================================
// src/App.js — DevMarket ULTRA ENHANCED v2.0
// ============================================
import React, {
  useState, useEffect, createContext, useContext,
  useReducer, useCallback, useRef, useMemo, lazy, Suspense
} from 'react';
import {
  BrowserRouter as Router, Routes, Route, Link,
  useNavigate, useLocation, Navigate
} from 'react-router-dom';
import { supabase } from './utils/supabase';
import { realtimeManager } from './utils/realtime';
import { analytics } from './utils/analytics';
import './App.css';

// ============================================
// AVATAR OPTIONS (replaces broken upload)
// ============================================
const AVATAR_OPTIONS = [
  { id: 'av1', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4', label: 'Felix' },
  { id: 'av2', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=ffdfbf', label: 'Aneka' },
  { id: 'av3', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zoe&backgroundColor=d1d4f9', label: 'Zoe' },
  { id: 'av4', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Max&backgroundColor=c0aede', label: 'Max' },
  { id: 'av5', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna&backgroundColor=ffd5dc', label: 'Luna' },
  { id: 'av6', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Dev&backgroundColor=b6e3f4', label: 'Dev' },
];

// ============================================
// GLOBAL CONTEXT
// ============================================
const AppContext = createContext();
export const useAppContext = () => useContext(AppContext);

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
  follows: [],         // NEW: who the user follows
  followers: [],       // NEW: who follows the user
  activityFeed: [],    // NEW: social activity feed
  theme: 'light',
  authError: null,
  loading: true,
  initialized: false,
  dataLoaded: false,
  realtimeConnected: false,
  onlineUsers: [],
  analyticsData: null,
  isAdmin: false,
  moderationQueue: [],
  notificationsEnabled: true,  // NEW: master notification toggle
  typingUsers: {},              // NEW: { conversationId: userName }
};

function appReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZED': return { ...state, initialized: true, loading: false };
    case 'SET_LOADING': return { ...state, loading: action.payload };
    case 'SET_DATA_LOADED': return { ...state, dataLoaded: action.payload };
    case 'SET_SESSION': return { ...state, session: action.payload };
    case 'SET_USER': return { ...state, currentUser: action.payload };
    case 'SET_PROFILE': return { ...state, profile: action.payload };
    case 'UPDATE_PROFILE': return { ...state, profile: { ...state.profile, ...action.payload } };
    case 'UPDATE_AVATAR': return { ...state, profile: { ...state.profile, avatar_url: action.payload } };
    case 'SET_LISTINGS': return { ...state, listings: action.payload || [] };
    case 'ADD_LISTING': return { ...state, listings: [action.payload, ...(state.listings || [])] };
    case 'UPDATE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload.id ? { ...l, ...action.payload } : l) };
    case 'DELETE_LISTING': return { ...state, listings: (state.listings || []).filter(l => l.id !== action.payload) };
    case 'HIDE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload ? { ...l, hidden: true } : l) };
    case 'UNHIDE_LISTING':
      return { ...state, listings: (state.listings || []).map(l => l.id === action.payload ? { ...l, hidden: false } : l) };
    case 'SET_APPS': return { ...state, apps: action.payload || [] };
    case 'ADD_APP': return { ...state, apps: [action.payload, ...(state.apps || [])] };
    case 'DELETE_APP': return { ...state, apps: (state.apps || []).filter(a => a.id !== action.payload) };
    case 'SET_CODE_SNIPPETS': return { ...state, codeSnippets: action.payload || [] };
    case 'ADD_CODE_SNIPPET': return { ...state, codeSnippets: [action.payload, ...(state.codeSnippets || [])] };
    case 'DELETE_SNIPPET': return { ...state, codeSnippets: (state.codeSnippets || []).filter(s => s.id !== action.payload) };
    case 'LIKE_SNIPPET':
      return { ...state, codeSnippets: (state.codeSnippets || []).map(s => s.id === action.payload.id ? { ...s, likes: action.payload.likes, likedBy: action.payload.likedBy } : s) };
    case 'SET_NOTIFICATIONS': return { ...state, notifications: action.payload || [] };
    case 'ADD_NOTIFICATION':
      if (!state.notificationsEnabled) return state;
      return { ...state, notifications: [{ ...action.payload, id: Date.now() + Math.random() }, ...(state.notifications || [])].slice(0, 50) };
    case 'REMOVE_NOTIFICATION': return { ...state, notifications: (state.notifications || []).filter(n => n.id !== action.payload) };
    case 'CLEAR_NOTIFICATIONS': return { ...state, notifications: [] };
    case 'MARK_NOTIFICATIONS_READ': return { ...state, notifications: (state.notifications || []).map(n => ({ ...n, read: true })) };
    case 'SET_NOTIFICATIONS_ENABLED': return { ...state, notificationsEnabled: action.payload };
    case 'SET_MESSAGES': return { ...state, messages: action.payload || [] };
    case 'ADD_MESSAGE': return { ...state, messages: [action.payload, ...(state.messages || [])] };
    case 'SET_CONVERSATIONS': return { ...state, conversations: action.payload || [] };
    case 'UPDATE_CONVERSATION':
      return {
        ...state,
        conversations: (state.conversations || []).map(c =>
          c.userId === action.payload.userId ? { ...c, ...action.payload } : c
        )
      };
    case 'ADD_CONVERSATION_MESSAGE':
      return {
        ...state,
        conversations: (state.conversations || []).map(c => {
          if (c.userId === action.payload.otherUserId) {
            return {
              ...c,
              messages: [...c.messages, action.payload.message],
              lastMessage: action.payload.message.message,
              lastMessageTime: action.payload.message.created_at,
              unreadCount: action.payload.message.to_user === state.currentUser?.id ? c.unreadCount + 1 : c.unreadCount
            };
          }
          return c;
        })
      };
    case 'SET_ACTIVE_CONVERSATION': return { ...state, activeConversation: action.payload };
    case 'MARK_CONVERSATION_READ':
      return {
        ...state,
        conversations: (state.conversations || []).map(c =>
          c.userId === action.payload ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, read: true })) } : c
        )
      };
    case 'MARK_MESSAGE_READ': return { ...state, messages: (state.messages || []).map(m => m.id === action.payload ? { ...m, read: true } : m) };
    case 'DELETE_MESSAGE': return { ...state, messages: (state.messages || []).filter(m => m.id !== action.payload) };
    case 'SET_FAVORITES': return { ...state, favorites: action.payload || [] };
    case 'TOGGLE_FAVORITE': {
      const favExists = (state.favorites || []).find(f => f.id === action.payload.id);
      return { ...state, favorites: favExists ? (state.favorites || []).filter(f => f.id !== action.payload.id) : [...(state.favorites || []), action.payload] };
    }
    case 'SET_FOLLOWS': return { ...state, follows: action.payload || [] };
    case 'ADD_FOLLOW': return { ...state, follows: [...(state.follows || []), action.payload] };
    case 'REMOVE_FOLLOW': return { ...state, follows: (state.follows || []).filter(f => f !== action.payload) };
    case 'SET_FOLLOWERS': return { ...state, followers: action.payload || [] };
    case 'SET_ACTIVITY_FEED': return { ...state, activityFeed: action.payload || [] };
    case 'ADD_ACTIVITY': return { ...state, activityFeed: [action.payload, ...(state.activityFeed || [])].slice(0, 100) };
    case 'SET_AUTH_ERROR': return { ...state, authError: action.payload };
    case 'SET_REALTIME_CONNECTED': return { ...state, realtimeConnected: action.payload };
    case 'SET_ANALYTICS_DATA': return { ...state, analyticsData: action.payload };
    case 'SET_IS_ADMIN': return { ...state, isAdmin: action.payload };
    case 'SET_MODERATION_QUEUE': return { ...state, moderationQueue: action.payload || [] };
    case 'SET_TYPING': return { ...state, typingUsers: { ...state.typingUsers, [action.payload.convId]: action.payload.userName } };
    case 'CLEAR_TYPING': {
      const newTyping = { ...state.typingUsers };
      delete newTyping[action.payload];
      return { ...state, typingUsers: newTyping };
    }
    case 'LOGOUT':
      return {
        ...state, currentUser: null, profile: null, session: null,
        notifications: [], messages: [], conversations: [], activeConversation: null,
        favorites: [], follows: [], followers: [], activityFeed: [], isAdmin: false
      };
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('devMarketTheme', newTheme);
      return { ...state, theme: newTheme };
    }
    default: return state;
  }
}

// ============================================
// SKELETON LOADERS
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
      {Array.from({ length: count }).map((_, i) => <SkeletonCard key={i} />)}
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
// AVATAR PICKER COMPONENT (replaces broken upload)
// ============================================
function AvatarPicker({ currentAvatar, userName, onAvatarUpdate, size = 'large' }) {
  const [showPicker, setShowPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const sizeMap = { small: '48px', medium: '72px', large: '100px' };
  const px = sizeMap[size] || '100px';

  const displayAvatar = currentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;

  const handleSelect = async (av) => {
    setSaving(true);
    await onAvatarUpdate(av.url);
    setSaving(false);
    setShowPicker(false);
  };

  return (
    <div className="avatar-picker-wrap" style={{ position: 'relative', display: 'inline-block' }}>
      <div
        className="avatar-preview-wrapper"
        onClick={() => setShowPicker(!showPicker)}
        style={{ width: px, height: px, cursor: 'pointer', position: 'relative' }}
      >
        <img src={displayAvatar} alt={userName || 'User'} className="avatar-upload-preview"
          style={{ width: px, height: px, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--primary-light)' }}
          onError={e => { e.target.src = `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=200`; }} />
        <div className="avatar-upload-overlay" style={{ fontSize: '0.7rem' }}>
          <span>🎨</span>
          <span>{saving ? 'Saving...' : 'Change'}</span>
        </div>
      </div>
      {showPicker && (
        <div className="avatar-picker-dropdown">
          <div className="avatar-picker-title">Choose Your Avatar</div>
          <div className="avatar-picker-grid">
            {AVATAR_OPTIONS.map(av => (
              <button key={av.id} className="avatar-option-btn" onClick={() => handleSelect(av)}
                title={av.label}>
                <img src={av.url} alt={av.label} className="avatar-option-img" />
                <span>{av.label}</span>
              </button>
            ))}
          </div>
          <button className="btn-secondary btn-sm" style={{ width: '100%', marginTop: '8px' }}
            onClick={() => setShowPicker(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ============================================
// ADVANCED SEARCH
// ============================================
function AdvancedSearch({ isOpen, onClose, onSearch, searchType = 'all' }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    category: 'all', priceRange: 'all', platform: 'all',
    language: 'all', sortBy: 'date', dateRange: 'all', rating: 'all'
  });

  const handleSearch = (e) => {
    e.preventDefault();
    onSearch({ query, filters });
    analytics.trackSearch(query, filters);
    onClose();
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
            <input type="text" placeholder="Search DevMarket..." value={query}
              onChange={e => setQuery(e.target.value)} className="search-input" autoFocus />
          </div>
          <div className="search-filters-grid">
            <div className="filter-group">
              <label>Category</label>
              <select value={filters.category} onChange={e => setFilters({ ...filters, category: e.target.value })}>
                <option value="all">All Categories</option>
                <option value="website">Website</option>
                <option value="portfolio">Portfolio</option>
                <option value="ecommerce">E-Commerce</option>
                <option value="blog">Blog</option>
                <option value="saas">SaaS</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Price Range</label>
              <select value={filters.priceRange} onChange={e => setFilters({ ...filters, priceRange: e.target.value })}>
                <option value="all">All Prices</option>
                <option value="free">Free</option>
                <option value="under50">Under $50</option>
                <option value="50to200">$50–$200</option>
                <option value="over200">Over $200</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Sort By</label>
              <select value={filters.sortBy} onChange={e => setFilters({ ...filters, sortBy: e.target.value })}>
                <option value="date">Newest</option>
                <option value="price">Price</option>
                <option value="rating">Rating</option>
                <option value="views">Most Viewed</option>
              </select>
            </div>
          </div>
          <div className="search-actions">
            <button type="button" className="btn-secondary" onClick={() => setFilters({ category: 'all', priceRange: 'all', platform: 'all', language: 'all', sortBy: 'date', dateRange: 'all', rating: 'all' })}>
              Reset
            </button>
            <button type="submit" className="btn-primary">🔍 Search</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============================================
// APP MAIN COMPONENT
// ============================================
export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const hasShownLoader = sessionStorage.getItem('devMarketLoaderShown');

  async function loadPublicData() {
    try {
      const [listingsRes, appsRes, snippetsRes] = await Promise.all([
        supabase.from('listings').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('apps').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('code_snippets').select('*').order('created_at', { ascending: false }).limit(100)
      ]);

      if (listingsRes.data) {
        const listings = listingsRes.data.map(l => ({
          ...l, seller: l.seller_name, sellerAvatar: l.seller_avatar,
          imageUrl: l.image_url, date: new Date(l.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_LISTINGS', payload: listings });
      }
      if (appsRes.data) {
        const apps = appsRes.data.map(a => ({
          ...a, appName: a.app_name, appUrl: a.app_url,
          developer: a.developer_name, developerAvatar: a.developer_avatar,
          date: new Date(a.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_APPS', payload: apps });
      }
      if (snippetsRes.data) {
        const snippets = snippetsRes.data.map(s => ({
          ...s, author: s.author_name, authorAvatar: s.author_avatar,
          likedBy: s.liked_by || [], date: new Date(s.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_CODE_SNIPPETS', payload: snippets });
      }
      dispatch({ type: 'SET_DATA_LOADED', payload: true });
    } catch (error) {
      console.error('Error loading public data:', error);
      dispatch({ type: 'SET_DATA_LOADED', payload: true });
    }
  }

  async function loadProfile(user) {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profile) {
        dispatch({ type: 'SET_PROFILE', payload: profile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...profile } });
        dispatch({ type: 'SET_IS_ADMIN', payload: profile.role === 'admin' });
        if (profile.notifications_enabled !== undefined) {
          dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: profile.notifications_enabled });
        }
      } else {
        const meta = user.user_metadata || {};
        const defaultProfile = {
          id: user.id,
          name: meta.name || meta.full_name || user.email?.split('@')[0] || 'User',
          email: user.email,
          role: meta.role || 'developer',
          bio: '', website: '', github: '', twitter: '',
          avatar_url: meta.avatar_url || AVATAR_OPTIONS[0].url,
          notifications_enabled: true
        };
        try { await supabase.from('profiles').upsert({ ...defaultProfile, updated_at: new Date().toISOString() }); } catch (e) {}
        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...defaultProfile } });
      }
    } catch (error) { console.error('Error loading profile:', error); }
  }

  async function loadUserData(userId) {
    try {
      const [notifsResult, msgsResult, favsResult] = await Promise.all([
        supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        supabase.from('messages').select('*').or(`from_user.eq.${userId},to_user.eq.${userId}`).order('created_at', { ascending: false }),
        supabase.from('favorites').select('*, listing:listing_id (*)').eq('user_id', userId)
      ]);

      if (notifsResult.data) dispatch({ type: 'SET_NOTIFICATIONS', payload: notifsResult.data.map(n => ({ ...n, read: n.read || false })) });
      if (msgsResult.data) { dispatch({ type: 'SET_MESSAGES', payload: msgsResult.data }); buildConversations(msgsResult.data, userId); }
      if (favsResult.data) {
        const favorites = favsResult.data.map(f => f.listing).filter(Boolean).map(l => ({
          ...l, seller: l.seller_name, sellerAvatar: l.seller_avatar,
          imageUrl: l.image_url, date: new Date(l.created_at).toLocaleDateString()
        }));
        dispatch({ type: 'SET_FAVORITES', payload: favorites });
      }

      // Load follows
      try {
        const { data: followsData } = await supabase.from('follows').select('following_id').eq('follower_id', userId);
        if (followsData) dispatch({ type: 'SET_FOLLOWS', payload: followsData.map(f => f.following_id) });
      } catch (e) {}

      setupRealtimeSubscriptions(userId);
    } catch (error) { console.error('Error loading user data:', error); }
  }

  function setupRealtimeSubscriptions(userId) {
    realtimeManager.unsubscribeAll();

    realtimeManager.subscribe(`messages-${userId}`, { event: 'INSERT', schema: 'public', table: 'messages', filter: `to_user=eq.${userId}` }, (payload) => {
      const newMsg = payload.new;
      dispatch({ type: 'ADD_MESSAGE', payload: newMsg });
      const otherUserId = newMsg.from_user;
      const otherUserName = newMsg.from_name || 'User';
      dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: { otherUserId, message: newMsg } });
      const activeConvId = sessionStorage.getItem('activeConversationId');
      if (activeConvId !== otherUserId) {
        dispatch({ type: 'ADD_NOTIFICATION', payload: {
          message: `💬 New message from ${otherUserName}: ${newMsg.message?.substring(0, 50)}`,
          type: 'info', time: new Date().toLocaleTimeString(), read: false
        }});
      }
    });

    realtimeManager.subscribe(`notifications-${userId}`, { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { ...payload.new, read: false } });
    });

    realtimeManager.subscribe('listings-updates', { event: '*', schema: 'public', table: 'listings' }, (payload) => {
      if (payload.eventType === 'INSERT') dispatch({ type: 'ADD_LISTING', payload: payload.new });
      else if (payload.eventType === 'DELETE') dispatch({ type: 'DELETE_LISTING', payload: payload.old.id });
      else if (payload.eventType === 'UPDATE') dispatch({ type: 'UPDATE_LISTING', payload: payload.new });
    });

    dispatch({ type: 'SET_REALTIME_CONNECTED', payload: true });
  }

  function buildConversations(messages, userId) {
    const conversationMap = new Map();
    messages.forEach(msg => {
      const otherUserId = msg.from_user === userId ? msg.to_user : msg.from_user;
      const otherUserName = msg.from_user === userId ? msg.to_name : msg.from_name;
      const otherUserAvatar = msg.from_user === userId ? msg.to_avatar : msg.from_avatar;
      if (!conversationMap.has(otherUserId)) {
        conversationMap.set(otherUserId, {
          userId: otherUserId, userName: otherUserName || 'Unknown User',
          userAvatar: otherUserAvatar, lastMessage: msg.message,
          lastMessageTime: msg.created_at, unreadCount: 0, messages: []
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
    dispatch({ type: 'SET_CONVERSATIONS', payload: Array.from(conversationMap.values()).sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime)) });
  }

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          dispatch({ type: 'SET_SESSION', payload: session });
          if (session?.user) { await loadProfile(session.user); await loadUserData(session.user.id); }
        }
        await loadPublicData();
        if (mounted) dispatch({ type: 'INITIALIZED' });
        analytics.trackPageView(window.location.pathname);
      } catch (error) {
        console.error('Init error:', error);
        if (mounted) dispatch({ type: 'INITIALIZED' });
      }
    }

    if (!hasShownLoader) {
      initialize().then(() => { sessionStorage.setItem('devMarketLoaderShown', 'true'); setTimeout(() => setIsInitialLoading(false), 500); });
      const safetyTimeout = setTimeout(() => { setIsInitialLoading(false); sessionStorage.setItem('devMarketLoaderShown', 'true'); }, 6000);
      return () => clearTimeout(safetyTimeout);
    } else {
      initialize().then(() => setIsInitialLoading(false));
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        dispatch({ type: 'SET_SESSION', payload: session });
        if (event === 'SIGNED_IN' && session?.user) { await loadProfile(session.user); await loadUserData(session.user.id); }
        else if (event === 'SIGNED_OUT') { dispatch({ type: 'LOGOUT' }); realtimeManager.unsubscribeAll(); }
      }
    });

    return () => { mounted = false; subscription?.unsubscribe(); realtimeManager.unsubscribeAll(); };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('devMarketTheme');
    if (savedTheme && savedTheme !== state.theme) dispatch({ type: 'TOGGLE_THEME' });
  }, []);

  const removeNotification = useCallback((id) => { dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }); }, []);

  if (isInitialLoading && !hasShownLoader) {
    return (
      <div className="dm-loader">
        <div className="dm-loader__card">
          <div className="dm-loader__logo-wrap"><span className="dm-loader__logo-icon">🚀</span></div>
          <div className="dm-loader__brand">
            <span className="dm-loader__brand-dev">Dev</span>
            <span className="dm-loader__brand-market">Market</span>
          </div>
          <p className="dm-loader__tagline">IT Marketplace Hub</p>
          <div className="dm-loader__bar-track"><div className="dm-loader__bar-fill" /></div>
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
            {state.notificationsEnabled && (state.notifications || []).filter(n => !n.read).slice(0, 3).map(n => (
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
              <Route path="/profile/:userId" element={<PublicProfile />} />
              <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
              <Route path="/activity" element={<ProtectedRoute><ActivityFeed /></ProtectedRoute>} />
            </Routes>
          </main>
          <MobileNav />
          <Footer />
        </div>
      </Router>
    </AppContext.Provider>
  );
}

// ============================================
// TOAST
// ============================================
function Toast({ notification, onClose }) {
  useEffect(() => {
    const timer = setTimeout(() => onClose(notification.id), 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };

  return (
    <div className={`toast toast-${notification.type || 'info'}`}>
      <div className="toast-content">
        <span className="toast-icon">{icons[notification.type] || '📢'}</span>
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
// CONFIRM DIALOG
// ============================================
function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, confirmText, type }) {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px', textAlign: 'center', padding: '32px' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{type === 'danger' ? '⚠️' : '✅'}</div>
        <h3 style={{ marginBottom: '8px' }}>{title || 'Confirm'}</h3>
        <p style={{ color: 'var(--gray-500)', marginBottom: '24px', lineHeight: '1.6' }}>{message || 'Are you sure?'}</p>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className="btn-primary" onClick={onConfirm} style={{ background: type === 'danger' ? 'var(--danger)' : 'var(--primary)' }}>
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
  if (!state.initialized) return null;
  if (!state.session) return <Navigate to="/" replace />;
  return children;
}

// ============================================
// HEADER
// ============================================
function Header() {
  const { state, dispatch } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const notifRef = useRef(null);
  const menuRef = useRef(null);

  const unreadCount = (state.notifications || []).filter(n => !n.read).length;
  const totalUnreadMessages = (state.conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  useEffect(() => {
    const handleClick = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false);
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowUserMenu(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    dispatch({ type: 'LOGOUT' });
    navigate('/');
    setShowLogoutConfirm(false);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/marketplace?search=${encodeURIComponent(searchQuery)}`);
      setSearchQuery('');
    }
  };

  const handleAdvancedSearch = ({ query, filters }) => {
    if (query) navigate(`/marketplace?search=${encodeURIComponent(query)}`);
  };

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/marketplace', label: 'Marketplace' },
    { to: '/advertise', label: 'Advertise' },
    { to: '/code-sharing', label: 'Code Share' },
  ];

  const userName = state.profile?.name || state.currentUser?.email?.split('@')[0] || 'User';
  const userAvatar = state.profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName)}&background=667eea&color=fff&size=40`;

  return (
    <>
      <header className="header">
        <div className="header-content">
          <Link to="/" className="brand-logo">
            <span className="brand-icon">🚀</span>
            <span className="brand-name">
              <span className="brand-dev">Dev</span>
              <span className="brand-market">Market</span>
            </span>
          </Link>

          <nav className="desktop-nav">
            {navLinks.map(link => (
              <Link key={link.to} to={link.to}
                className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}>
                {link.label}
              </Link>
            ))}
          </nav>

          <form onSubmit={handleSearch} className="header-search">
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)} className="header-search-input" />
            <button type="submit" className="header-search-btn">🔍</button>
            <button type="button" className="header-search-btn" onClick={() => setShowAdvancedSearch(true)} title="Advanced search">⚙️</button>
          </form>

          <div className="header-actions">
            <button className="theme-btn" onClick={() => dispatch({ type: 'TOGGLE_THEME' })} title="Toggle theme">
              {state.theme === 'light' ? '🌙' : '☀️'}
            </button>

            {state.currentUser ? (
              <>
                <div className="notif-wrap" ref={notifRef}>
                  <button className="notif-btn" onClick={() => setShowNotifications(!showNotifications)}>
                    🔔
                    {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
                  </button>
                  {showNotifications && (
                    <div className="notif-dropdown">
                      <div className="notif-header">
                        <h4>Notifications</h4>
                        <button onClick={() => dispatch({ type: 'MARK_NOTIFICATIONS_READ' })} className="btn-link">Mark all read</button>
                      </div>
                      <div className="notif-list">
                        {(state.notifications || []).length === 0 ? (
                          <div className="notif-empty">No notifications</div>
                        ) : (
                          (state.notifications || []).slice(0, 10).map(n => (
                            <div key={n.id} className={`notif-item ${n.read ? '' : 'unread'}`}>
                              <p className="notif-msg">{n.message}</p>
                              <span className="notif-time">{n.time || ''}</span>
                              <button className="notif-dismiss" onClick={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: n.id })}>×</button>
                            </div>
                          ))
                        )}
                      </div>
                      {(state.notifications || []).length > 0 && (
                        <button onClick={() => dispatch({ type: 'CLEAR_NOTIFICATIONS' })} className="notif-clear-all">Clear All</button>
                      )}
                    </div>
                  )}
                </div>

                <Link to="/messages" className="msg-btn" title="Messages">
                  💬
                  {totalUnreadMessages > 0 && <span className="notif-badge">{totalUnreadMessages}</span>}
                </Link>

                <div className="user-menu-wrap" ref={menuRef}>
                  <button className="user-avatar-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                    <img src={userAvatar} alt={userName}
                      onError={e => { e.target.src = `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=40`; }} />
                  </button>
                  {showUserMenu && (
                    <div className="user-dropdown">
                      <div className="user-dropdown-header">
                        <img src={userAvatar} alt={userName}
                          onError={e => { e.target.src = `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=40`; }} />
                        <div>
                          <strong>{userName}</strong>
                          <p>{state.currentUser.email}</p>
                        </div>
                      </div>
                      <div className="user-dropdown-links">
                        <Link to="/profile" onClick={() => setShowUserMenu(false)}>👤 Profile</Link>
                        <Link to="/favorites" onClick={() => setShowUserMenu(false)}>⭐ Favorites</Link>
                        <Link to="/activity" onClick={() => setShowUserMenu(false)}>📡 Activity Feed</Link>
                        <Link to="/settings" onClick={() => setShowUserMenu(false)}>⚙️ Settings</Link>
                        {state.isAdmin && <Link to="/admin" onClick={() => setShowUserMenu(false)}>🛡️ Admin</Link>}
                        <button onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }} className="logout-link">🚪 Logout</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="auth-buttons">
                <button className="btn-secondary btn-sm" onClick={() => { setAuthMode('login'); setShowAuth(true); }}>Login</button>
                <button className="btn-primary btn-sm" onClick={() => { setAuthMode('signup'); setShowAuth(true); }}>Sign Up</button>
              </div>
            )}
          </div>
        </div>

        {/* Mobile Button Nav Row */}
        <MobileNavRow />

        {showAuth && <AuthModal setShowAuth={setShowAuth} authMode={authMode} setAuthMode={setAuthMode} />}
        <AdvancedSearch isOpen={showAdvancedSearch} onClose={() => setShowAdvancedSearch(false)} onSearch={handleAdvancedSearch} />
      </header>
      <ConfirmDialog isOpen={showLogoutConfirm} title="Confirm Logout" message="Are you sure you want to logout?" onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} confirmText="Logout" type="danger" />
    </>
  );
}

// ============================================
// MOBILE NAV ROW (replaces traditional navbar on mobile)
// ============================================
function MobileNavRow() {
  const location = useLocation();
  const { state } = useAppContext();
  const totalUnread = (state.conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const navItems = [
    { to: '/', icon: '🏠', label: 'Home' },
    { to: '/marketplace', icon: '🛒', label: 'Market' },
    { to: '/advertise', icon: '📱', label: 'Apps' },
    { to: '/code-sharing', icon: '💻', label: 'Code' },
    { to: '/messages', icon: '💬', label: 'Chats', badge: totalUnread },
  ];

  return (
    <div className="mobile-nav-row">
      {navItems.map(item => (
        <Link key={item.to} to={item.to}
          className={`mobile-nav-btn ${location.pathname === item.to ? 'active' : ''}`}>
          <span className="mobile-nav-icon">
            {item.icon}
            {item.badge > 0 && <span className="mobile-nav-badge">{item.badge}</span>}
          </span>
          <span className="mobile-nav-label">{item.label}</span>
        </Link>
      ))}
    </div>
  );
}

// ============================================
// MOBILE BOTTOM NAV (floating)
// ============================================
function MobileNav() {
  const location = useLocation();
  const { state } = useAppContext();
  const totalUnread = (state.conversations || []).reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  const navItems = [
    { to: '/', icon: '🏠', label: 'Home' },
    { to: '/marketplace', icon: '🛒', label: 'Market' },
    { to: '/messages', icon: '💬', label: 'Chat', badge: totalUnread },
    { to: '/activity', icon: '📡', label: 'Feed' },
    { to: state.currentUser ? '/profile' : '/', icon: '👤', label: 'Me' },
  ];

  return (
    <nav className="mobile-bottom-nav">
      {navItems.map(item => (
        <Link key={item.to} to={item.to}
          className={`mobile-bottom-btn ${location.pathname === item.to ? 'active' : ''}`}>
          <span className="mobile-bottom-icon">
            {item.icon}
            {item.badge > 0 && <span className="mobile-nav-badge">{item.badge}</span>}
          </span>
          <span className="mobile-bottom-label">{item.label}</span>
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
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'developer' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [step, setStep] = useState(1);
  const [showSuccess, setShowSuccess] = useState(false);
  const [authStatus, setAuthStatus] = useState('');
  const navigate = useNavigate();

  useEffect(() => { document.body.classList.add('modal-open'); return () => document.body.classList.remove('modal-open'); }, []);

  const resetForm = () => { setFormData({ name: '', email: '', password: '', confirmPassword: '', role: 'developer' }); setErrors({}); setStep(1); setShowSuccess(false); dispatch({ type: 'SET_AUTH_ERROR', payload: null }); };

  const validateForm = () => {
    const newErrors = {};
    if (authMode === 'signup' && !formData.name.trim()) newErrors.name = 'Full name is required';
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Valid email required';
    if (!formData.password || formData.password.length < 6) newErrors.password = 'Password must be 6+ characters';
    if (authMode === 'signup' && step === 2 && formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
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
        const { data, error } = await supabase.auth.signUp({ email: formData.email, password: formData.password, options: { data: { name: formData.name, role: formData.role } } });
        if (error) { dispatch({ type: 'SET_AUTH_ERROR', payload: error.message }); setLoading(false); return; }
        setShowSuccess(true);
        if (data.session) { setAuthStatus('success'); setTimeout(() => { setShowAuth(false); navigate('/profile'); }, 2000); }
        else setAuthStatus('confirmation');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        if (error) { dispatch({ type: 'SET_AUTH_ERROR', payload: error.message.includes('Invalid') ? 'Invalid email or password.' : error.message }); setLoading(false); return; }
        dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '👋 Welcome back!', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
        setShowAuth(false);
      }
    } catch (error) { dispatch({ type: 'SET_AUTH_ERROR', payload: 'An unexpected error occurred' }); }
    setLoading(false);
  };

  const handleSocialLogin = async (provider) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: window.location.origin } });
      if (error) dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login not configured.` });
    } catch (e) { dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login not available.` }); }
  };

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
              <div className="auth-brand-mark"><span className="auth-brand-icon">🚀</span></div>
              <h2>{authMode === 'login' ? 'Welcome Back' : 'Join DevMarket'}</h2>
              <p>{authMode === 'login' ? 'Sign in to continue' : 'Start your developer journey'}</p>
            </div>
            <div className="social-login">
              <button className="social-btn social-btn-google" onClick={() => handleSocialLogin('google')}><span className="social-icon">G</span> Google</button>
              <button className="social-btn social-btn-github" onClick={() => handleSocialLogin('github')}><span className="social-icon">⌨️</span> GitHub</button>
            </div>
            <div className="auth-divider"><span>or continue with email</span></div>
            {state.authError && <div className="auth-error">⚠️ {state.authError}</div>}
            <form onSubmit={handleSubmit} className="auth-form">
              {authMode === 'signup' && step === 1 && (
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" placeholder="John Doe" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={errors.name ? 'error' : ''} />
                  {errors.name && <span className="error-message">{errors.name}</span>}
                </div>
              )}
              {(authMode === 'login' || step === 1) && (
                <>
                  <div className="form-group">
                    <label>Email</label>
                    <input type="email" placeholder="you@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={errors.email ? 'error' : ''} />
                    {errors.email && <span className="error-message">{errors.email}</span>}
                  </div>
                  <div className="form-group" style={{ position: 'relative' }}>
                    <label>Password</label>
                    <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} className={errors.password ? 'error' : ''} />
                    <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)}>{showPassword ? '👁️' : '👁️‍🗨️'}</button>
                    {errors.password && <span className="error-message">{errors.password}</span>}
                  </div>
                </>
              )}
              {authMode === 'signup' && step === 2 && (
                <>
                  <div className="form-group">
                    <label>Confirm Password</label>
                    <input type="password" placeholder="Confirm password" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} />
                    {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
                  </div>
                  <div className="form-group">
                    <label>Role</label>
                    <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })}>
                      <option value="developer">Developer</option>
                      <option value="buyer">Buyer</option>
                      <option value="both">Both</option>
                    </select>
                  </div>
                  <button type="button" className="btn-secondary" onClick={() => setStep(1)}>← Back</button>
                </>
              )}
              <button type="submit" className="btn-primary btn-full" disabled={loading}>
                {loading ? 'Processing...' : authMode === 'login' ? '🚀 Sign In' : step === 1 ? 'Continue →' : '🎉 Create Account'}
              </button>
            </form>
            <div className="auth-footer">
              {authMode === 'login'
                ? <p>No account? <button onClick={() => { setAuthMode('signup'); resetForm(); }} className="btn-link">Create one</button></p>
                : <p>Have account? <button onClick={() => { setAuthMode('login'); resetForm(); }} className="btn-link">Sign in</button></p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ============================================
// HOME
// ============================================
function Home() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const stats = { listings: (state.listings || []).length, apps: (state.apps || []).length, snippets: (state.codeSnippets || []).length, users: 1250 };
  const featuredListings = (state.listings || []).filter(l => !l.hidden).slice(0, 3);

  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <div className="hero-badge">🚀 The Developer Marketplace</div>
          <h1 className="hero-title">Buy, Sell & Share <span className="hero-highlight">Developer Assets</span></h1>
          <p className="hero-subtitle">Discover websites, apps, and code snippets from talented developers worldwide</p>
          <div className="hero-actions">
            <button className="btn-primary btn-lg" onClick={() => navigate('/marketplace')}>Browse Marketplace →</button>
            <button className="btn-secondary btn-lg" onClick={() => navigate('/code-sharing')}>Share Code 💻</button>
          </div>
          <div className="hero-stats">
            {[
              { value: stats.listings, label: 'Listings', icon: '🛒' },
              { value: stats.apps, label: 'Apps', icon: '📱' },
              { value: stats.snippets, label: 'Snippets', icon: '💻' },
              { value: '1.2K+', label: 'Developers', icon: '👥' },
            ].map((s, i) => (
              <div key={i} className="hero-stat">
                <span className="hero-stat-icon">{s.icon}</span>
                <strong>{s.value}</strong>
                <span>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {featuredListings.length > 0 && (
        <section className="featured-section">
          <div className="section-header">
            <h2>🔥 Featured Listings</h2>
            <button className="btn-link" onClick={() => navigate('/marketplace')}>View all →</button>
          </div>
          <div className="listings-grid">
            {featuredListings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      )}

      <section className="features-section">
        <h2>Everything You Need to Succeed</h2>
        <div className="features-grid">
          {[
            { icon: '🛒', title: 'Marketplace', desc: 'Buy and sell websites, portfolios, and web applications', action: () => navigate('/marketplace') },
            { icon: '📱', title: 'App Advertising', desc: 'Promote your mobile and web apps to thousands of developers', action: () => navigate('/advertise') },
            { icon: '💻', title: 'Code Sharing', desc: 'Share reusable code snippets and learn from the community', action: () => navigate('/code-sharing') },
            { icon: '💬', title: 'Direct Messaging', desc: 'Connect directly with sellers and developers in real-time', action: () => navigate('/messages') },
          ].map((f, i) => (
            <div key={i} className="feature-card" onClick={f.action}>
              <span className="feature-icon">{f.icon}</span>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
              <span className="feature-arrow">→</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================
// LISTING CARD (with admin hide/unhide + confirmation)
// ============================================
function ListingCard({ listing }) {
  const { state, dispatch } = useAppContext();
  const [showContact, setShowContact] = useState(false);
  const [message, setMessage] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHiding] = useState(false);

  const isOwner = state.currentUser && listing.user_id === state.currentUser.id;
  const isAdmin = state.isAdmin;

  // Non-admin users can't see hidden listings
  if (listing.hidden && !isAdmin) return null;

  const handleContact = async () => {
    if (!state.currentUser) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to contact seller', type: 'warning', time: new Date().toLocaleTimeString(), read: false } });
      return;
    }
    if (showContact && message.trim()) {
      try {
        const senderName = state.profile?.name || state.currentUser.email;
        const senderAvatar = state.profile?.avatar_url;
        await supabase.from('messages').insert([{
          from_user: state.currentUser.id, to_user: listing.user_id,
          from_name: senderName, to_name: listing.seller,
          from_avatar: senderAvatar, to_avatar: listing.sellerAvatar,
          subject: `Inquiry about: ${listing.title}`, message: message,
          read: false, created_at: new Date().toISOString()
        }]);
        try { await supabase.from('notifications').insert([{ user_id: listing.user_id, message: `💬 New inquiry about "${listing.title}" from ${senderName}`, type: 'info', read: false, created_at: new Date().toISOString() }]); } catch (e) {}
        dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ Message sent to ${listing.seller}!`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
        analytics.trackListingView(listing.id);
      } catch (error) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to send message', type: 'error', time: new Date().toLocaleTimeString(), read: false } }); }
      setShowContact(false); setMessage('');
    } else { setShowContact(!showContact); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('listings').delete().eq('id', listing.id);
      dispatch({ type: 'DELETE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ Listing deleted`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to delete', type: 'error', time: new Date().toLocaleTimeString(), read: false } }); }
    setDeleting(false); setShowDeleteConfirm(false);
  };

  const handleHide = async () => {
    setHiding(true);
    try {
      await supabase.from('listings').update({ hidden: true }).eq('id', listing.id);
      dispatch({ type: 'HIDE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🙈 Listing hidden from users`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to hide', type: 'error', time: new Date().toLocaleTimeString(), read: false } }); }
    setHiding(false); setShowHideConfirm(false);
  };

  const handleUnhide = async () => {
    try {
      await supabase.from('listings').update({ hidden: false }).eq('id', listing.id);
      dispatch({ type: 'UNHIDE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `👁️ Listing is now visible`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {}
  };

  const handleFavorite = async () => {
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to save favorites', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    const isFav = (state.favorites || []).find(f => f.id === listing.id);
    dispatch({ type: 'TOGGLE_FAVORITE', payload: listing });
    try {
      if (isFav) await supabase.from('favorites').delete().eq('user_id', state.currentUser.id).eq('listing_id', listing.id);
      else await supabase.from('favorites').insert([{ user_id: state.currentUser.id, listing_id: listing.id, created_at: new Date().toISOString() }]);
    } catch (e) {}
  };

  const isFavorited = (state.favorites || []).some(f => f.id === listing.id);

  return (
    <>
      <div className={`listing-card ${listing.hidden ? 'listing-hidden-admin' : ''}`}>
        {listing.hidden && isAdmin && (
          <div className="hidden-badge">🙈 Hidden from users</div>
        )}
        <div className="card-image-wrap">
          <img
            src={listing.imageUrl || listing.image_url || `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=200&fit=crop`}
            alt={listing.title} className="card-image"
            onError={e => { e.target.src = `https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=400&h=200&fit=crop`; }} />
          <div className="card-overlay-actions">
            <button onClick={handleFavorite} className={`fav-btn ${isFavorited ? 'favorited' : ''}`} title={isFavorited ? 'Remove favorite' : 'Add to favorites'}>
              {isFavorited ? '⭐' : '☆'}
            </button>
            {(isOwner || isAdmin) && (
              <button onClick={() => setShowDeleteConfirm(true)} className="delete-overlay-btn" title="Delete listing">🗑️</button>
            )}
          </div>
          {listing.category && <span className="category-badge">{listing.category}</span>}
        </div>
        <div className="card-content">
          <div className="card-header">
            <h3>{listing.title}</h3>
            <span className="price-tag">{listing.price}</span>
          </div>
          <p className="description">{listing.description?.substring(0, 120)}{listing.description?.length > 120 ? '...' : ''}</p>
          <div className="card-meta">
            <span className="seller-info">
              <img src={listing.sellerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(listing.seller || 'User')}&background=667eea&color=fff&size=28`} alt={listing.seller} />
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
            <textarea placeholder="Write your message..." value={message} onChange={e => setMessage(e.target.value)} className="contact-message" rows="3" />
          )}
          <div className="card-actions">
            {listing.url && <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">🔗 View</a>}
            <button onClick={handleContact} className="btn-primary btn-sm" disabled={isOwner} title={isOwner ? 'This is your listing' : 'Contact seller'}>
              {isOwner ? '👤 Yours' : showContact ? '📤 Send' : '📧 Contact'}
            </button>
            {/* Admin-only: Hide / Unhide */}
            {isAdmin && !isOwner && (
              listing.hidden
                ? <button onClick={handleUnhide} className="btn-sm btn-unhide">👁️ Unhide</button>
                : <button onClick={() => setShowHideConfirm(true)} className="btn-sm btn-hide">🙈 Hide</button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete Listing"
        message={`Delete "${listing.title}"? This cannot be undone.`}
        onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)}
        confirmText={deleting ? 'Deleting...' : 'Delete'} type="danger" />

      <ConfirmDialog isOpen={showHideConfirm} title="Hide Listing"
        message={`Are you sure you want to hide "${listing.title}"? Non-admin users won't see it.`}
        onConfirm={handleHide} onCancel={() => setShowHideConfirm(false)}
        confirmText={hiding ? 'Hiding...' : 'Hide Listing'} type="danger" />
    </>
  );
}

// ============================================
// MARKETPLACE
// ============================================
function Marketplace() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [filterPrice, setFilterPrice] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [formData, setFormData] = useState({ title: '', description: '', price: '', url: '', imageUrl: '', category: 'website' });
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search');
    if (search) setSearchTerm(search);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to create a listing', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    if (!formData.title || !formData.description || !formData.price) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please fill in all required fields', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    setSubmitting(true);
    try {
      const listingData = {
        title: formData.title, description: formData.description, price: formData.price,
        url: formData.url || null, image_url: formData.imageUrl || null, category: formData.category,
        seller_name: state.profile?.name || state.currentUser.email,
        seller_avatar: state.profile?.avatar_url || AVATAR_OPTIONS[0].url,
        user_id: state.currentUser.id, views: 0, inquiries: 0, rating: 0, hidden: false,
        created_at: new Date().toISOString()
      };
      const { data, error } = await supabase.from('listings').insert([listingData]).select().single();
      if (error) throw error;
      const newListing = { ...data, seller: data.seller_name, sellerAvatar: data.seller_avatar, imageUrl: data.image_url, date: new Date(data.created_at).toLocaleDateString() };
      dispatch({ type: 'ADD_LISTING', payload: newListing });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ "${formData.title}" published!`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
      setFormData({ title: '', description: '', price: '', url: '', imageUrl: '', category: 'website' });
      setShowForm(false);
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Failed: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
    setSubmitting(false);
  };

  const filteredListings = useMemo(() => (state.listings || [])
    .filter(l => {
      if (l.hidden && !state.isAdmin) return false;
      const matchesSearch = l.title?.toLowerCase().includes(searchTerm.toLowerCase()) || l.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPrice = filterPrice === 'all' ? true : filterPrice === 'free' ? l.price?.toLowerCase().includes('free') : !l.price?.toLowerCase().includes('free');
      const matchesCat = filterCategory === 'all' || l.category === filterCategory;
      return matchesSearch && matchesPrice && matchesCat;
    })
    .sort((a, b) => {
      if (sortBy === 'price') return (a.price || '').localeCompare(b.price || '');
      if (sortBy === 'title') return (a.title || '').localeCompare(b.title || '');
      return new Date(b.created_at || 0) - new Date(a.created_at || 0);
    }), [state.listings, searchTerm, filterPrice, filterCategory, sortBy, state.isAdmin]);

  const paginatedListings = filteredListings.slice(0, page * PER_PAGE);
  const hasMore = paginatedListings.length < filteredListings.length;

  return (
    <div className="marketplace-page">
      <div className="page-header">
        <h1>Website & Portfolio Marketplace</h1>
        <p>Discover and purchase amazing websites and portfolios</p>
        <button className="btn-primary" onClick={() => { if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; } setShowForm(!showForm); }}>
          {showForm ? '❌ Cancel' : '📢 List Your Website'}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large listing-form-modal" onClick={e => e.stopPropagation()}>
            <div className="listing-form-header">
              <span className="listing-form-icon">📢</span>
              <h2>Create New Listing</h2>
              <p>Fill in the details to list your website or portfolio</p>
            </div>
            <form onSubmit={handleSubmit} className="listing-form-styled">
              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <div className="input-wrapper"><span className="input-icon">📝</span>
                  <input type="text" placeholder="e.g., Modern SaaS Dashboard" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required /></div>
              </div>
              <div className="form-group">
                <label>Category</label>
                <select value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
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
                <textarea placeholder="Describe your website..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="4" className="listing-textarea" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price <span className="required">*</span></label>
                  <div className="input-wrapper"><span className="input-icon">💰</span>
                    <input type="text" placeholder="$500 or Negotiable" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} required /></div>
                </div>
                <div className="form-group">
                  <label>Website URL</label>
                  <div className="input-wrapper"><span className="input-icon">🔗</span>
                    <input type="url" placeholder="https://example.com" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} /></div>
                </div>
              </div>
              <div className="form-group">
                <label>Image URL (optional)</label>
                <div className="input-wrapper"><span className="input-icon">🖼️</span>
                  <input type="url" placeholder="https://example.com/image.jpg" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} /></div>
              </div>
              <div className="listing-form-footer">
                <span className="listing-form-note">💡 Your listing will be visible to all DevMarket users</span>
                <div className="listing-form-actions">
                  <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={submitting}>
                    {submitting ? <><span className="loading-spinner"></span> Publishing...</> : <>📤 Publish Listing</>}
                  </button>
                </div>
              </div>
            </form>
            <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input type="text" placeholder="🔍 Search listings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="search-input" />
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="all">All Categories</option>
          <option value="website">Website</option>
          <option value="portfolio">Portfolio</option>
          <option value="ecommerce">E-Commerce</option>
          <option value="blog">Blog</option>
          <option value="saas">SaaS</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
          <option value="date">Newest</option>
          <option value="price">Price</option>
          <option value="title">Title</option>
        </select>
        <select value={filterPrice} onChange={e => setFilterPrice(e.target.value)}>
          <option value="all">All Prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
      </div>

      {!state.dataLoaded ? (
        <SkeletonGrid count={6} />
      ) : (
        <>
          <div className="listings-grid">
            {paginatedListings.map(listing => <ListingCard key={listing.id} listing={listing} />)}
            {filteredListings.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1 / -1' }}>
                <span className="empty-icon">🛒</span>
                <h3>No listings found</h3>
                {searchTerm ? <p>Try different search terms</p> : <><p>Be the first to list a website!</p><button onClick={() => setShowForm(true)} className="btn-primary">Create First Listing</button></>}
              </div>
            )}
          </div>
          {hasMore && (
            <div style={{ textAlign: 'center', marginTop: '32px' }}>
              <button className="btn-secondary" onClick={() => setPage(p => p + 1)}>Load More ({filteredListings.length - paginatedListings.length} more)</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================
// ADVERTISE
// ============================================
function Advertise() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [formData, setFormData] = useState({ appName: '', description: '', platform: '', appUrl: '', contact: '', features: '', price: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to advertise', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    setSubmitting(true);
    try {
      const featuresArray = formData.features.split(',').map(f => f.trim()).filter(f => f);
      const { data, error } = await supabase.from('apps').insert([{
        app_name: formData.appName, description: formData.description, platform: formData.platform,
        app_url: formData.appUrl || null, contact: formData.contact, features: featuresArray,
        price: formData.price || 'Free', developer_name: state.profile?.name || state.currentUser.email,
        developer_avatar: state.profile?.avatar_url, user_id: state.currentUser.id, rating: 0, downloads: 0,
        created_at: new Date().toISOString()
      }]).select().single();
      if (error) throw error;
      dispatch({ type: 'ADD_APP', payload: { ...data, appName: data.app_name, appUrl: data.app_url, developer: data.developer_name, developerAvatar: data.developer_avatar, date: new Date(data.created_at).toLocaleDateString() } });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ App "${formData.appName}" published!`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
      setFormData({ appName: '', description: '', platform: '', appUrl: '', contact: '', features: '', price: '' });
      setShowForm(false);
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Failed: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
    setSubmitting(false);
  };

  const platforms = ['iOS', 'Android', 'Web', 'Desktop', 'Cross-Platform'];
  const filteredApps = (state.apps || []).filter(a => {
    const matchesSearch = a.appName?.toLowerCase().includes(searchTerm.toLowerCase()) || a.app_name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPlatform = filterPlatform === 'all' || a.platform?.toLowerCase() === filterPlatform.toLowerCase();
    return matchesSearch && matchesPlatform;
  });

  return (
    <div className="advertise-page">
      <div className="page-header">
        <h1>App Showcase</h1>
        <p>Discover and promote amazing apps</p>
        <button className="btn-primary" onClick={() => { if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; } setShowForm(!showForm); }}>
          {showForm ? '❌ Cancel' : '📱 Advertise Your App'}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="listing-form-header">
              <span className="listing-form-icon">📱</span>
              <h2>Advertise Your App</h2>
            </div>
            <form onSubmit={handleSubmit} className="listing-form-styled">
              <div className="form-row">
                <div className="form-group">
                  <label>App Name <span className="required">*</span></label>
                  <input type="text" placeholder="My Awesome App" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Platform <span className="required">*</span></label>
                  <select value={formData.platform} onChange={e => setFormData({ ...formData, platform: e.target.value })} required>
                    <option value="">Select Platform</option>
                    {platforms.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label>Description <span className="required">*</span></label>
                <textarea placeholder="What does your app do?" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="3" className="listing-textarea" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Price</label>
                  <input type="text" placeholder="Free / $4.99" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>App URL</label>
                  <input type="url" placeholder="https://myapp.com" value={formData.appUrl} onChange={e => setFormData({ ...formData, appUrl: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Features (comma-separated)</label>
                <input type="text" placeholder="Real-time sync, Offline mode, Dark theme" value={formData.features} onChange={e => setFormData({ ...formData, features: e.target.value })} />
              </div>
              <div className="listing-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Publishing...' : '📱 Publish App'}</button>
              </div>
            </form>
            <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input type="text" placeholder="🔍 Search apps..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="search-input" />
        <select value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
          <option value="all">All Platforms</option>
          {platforms.map(p => <option key={p} value={p.toLowerCase()}>{p}</option>)}
        </select>
      </div>

      <div className="app-grid">
        {filteredApps.map(app => <AppCard key={app.id} app={app} />)}
        {filteredApps.length === 0 && (
          <div className="empty-state"><span className="empty-icon">📱</span><h3>No apps found</h3><button onClick={() => setShowForm(true)} className="btn-primary">Advertise Your App</button></div>
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
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to inquire', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    if (showContact && message.trim()) {
      try {
        await supabase.from('messages').insert([{ from_user: state.currentUser.id, to_user: app.user_id, subject: `Inquiry about ${app.appName || app.app_name}`, message: message, read: false, created_at: new Date().toISOString() }]);
        dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `Inquiry sent!`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
      } catch (e) {}
      setShowContact(false); setMessage('');
    } else { setShowContact(!showContact); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await supabase.from('apps').delete().eq('id', app.id);
      dispatch({ type: 'DELETE_APP', payload: app.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ App deleted`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (e) {}
    setDeleting(false); setShowDeleteConfirm(false);
  };

  const appName = app.appName || app.app_name || 'Unnamed App';

  return (
    <>
      <div className="app-card">
        <div className="app-header">
          <span className={`platform-badge ${app.platform?.toLowerCase()}`}>{app.platform}</span>
          {app.price && <span className="price-badge">{app.price}</span>}
          {isOwner && <button className="btn-sm btn-danger-sm" onClick={() => setShowDeleteConfirm(true)}>🗑️</button>}
        </div>
        <h3>{appName}</h3>
        <p className="description">{app.description?.substring(0, 150)}{app.description?.length > 150 ? '...' : ''}</p>
        <div className="features-list">{(app.features || []).map((f, i) => <span key={i} className="feature-tag">✓ {f}</span>)}</div>
        <div className="app-meta"><span>⭐ {app.rating || 'New'}</span><span>⬇️ {app.downloads || 0}</span></div>
        <div className="developer-info">
          <span>
            <img src={app.developerAvatar || app.developer_avatar || AVATAR_OPTIONS[0].url} alt={app.developer || app.developer_name}
              style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px' }} />
            {app.developer || app.developer_name}
          </span>
          <span>{app.date}</span>
        </div>
        {showContact && <textarea placeholder="Write your inquiry..." value={message} onChange={e => setMessage(e.target.value)} className="contact-message" />}
        <div className="app-actions">
          {(app.appUrl || app.app_url) && <a href={app.appUrl || app.app_url} target="_blank" rel="noopener noreferrer" className="btn-secondary">🔗 Visit</a>}
          <button onClick={handleInquiry} className="btn-primary">{showContact ? '📤 Send' : '💬 Inquire'}</button>
        </div>
      </div>
      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete App" message={`Delete "${appName}"?`} onConfirm={handleDelete} onCancel={() => setShowDeleteConfirm(false)} confirmText={deleting ? 'Deleting...' : 'Delete'} type="danger" />
    </>
  );
}

// ============================================
// CODE SHARING
// ============================================
function CodeSharing() {
  const { state, dispatch } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterLanguage, setFilterLanguage] = useState('all');
  const [formData, setFormData] = useState({ title: '', description: '', language: '', code: '', tags: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to share code', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    setSubmitting(true);
    try {
      const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t);
      const { data, error } = await supabase.from('code_snippets').insert([{
        title: formData.title, description: formData.description, language: formData.language, code: formData.code,
        tags: tagsArray, author_name: state.profile?.name || state.currentUser.email,
        author_avatar: state.profile?.avatar_url, user_id: state.currentUser.id, likes: 0, created_at: new Date().toISOString()
      }]).select().single();
      if (error) throw error;
      dispatch({ type: 'ADD_CODE_SNIPPET', payload: { ...data, author: data.author_name, authorAvatar: data.author_avatar, likedBy: [], date: new Date(data.created_at).toLocaleDateString() } });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ "${formData.title}" shared!`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
      setFormData({ title: '', description: '', language: '', code: '', tags: '' });
      setShowForm(false);
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Failed: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
    setSubmitting(false);
  };

  const handleLike = async (snippet) => {
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to like', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    const userName = state.profile?.name || state.currentUser.email;
    const userLiked = snippet.likedBy?.includes(userName);
    const newLikedBy = userLiked ? snippet.likedBy.filter(u => u !== userName) : [...(snippet.likedBy || []), userName];
    const newLikes = userLiked ? snippet.likes - 1 : snippet.likes + 1;
    dispatch({ type: 'LIKE_SNIPPET', payload: { ...snippet, likes: newLikes, likedBy: newLikedBy } });
    try { await supabase.from('code_snippets').update({ likes: newLikes }).eq('id', snippet.id); } catch (e) {}
  };

  const handleDelete = async (snippet) => {
    try {
      await supabase.from('code_snippets').delete().eq('id', snippet.id);
      dispatch({ type: 'DELETE_SNIPPET', payload: snippet.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ Snippet deleted`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (e) {}
  };

  const filteredSnippets = (state.codeSnippets || []).filter(s => {
    const matchesSearch = s.title?.toLowerCase().includes(searchTerm.toLowerCase()) || s.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLang = filterLanguage === 'all' || s.language?.toLowerCase() === filterLanguage.toLowerCase();
    return matchesSearch && matchesLang;
  });
  const languages = [...new Set((state.codeSnippets || []).map(s => s.language).filter(Boolean))];

  return (
    <div className="code-sharing-page">
      <div className="page-header">
        <h1>Code Sharing Community</h1>
        <p>Share your code, learn from others, grow together</p>
        <button className="btn-primary" onClick={() => { if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to share code', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; } setShowForm(!showForm); }}>
          {showForm ? '❌ Cancel' : '💻 Share Code'}
        </button>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="listing-form-header"><span className="listing-form-icon">💻</span><h2>Share Code Snippet</h2></div>
            <form onSubmit={handleSubmit} className="listing-form-styled">
              <div className="form-group">
                <label>Title <span className="required">*</span></label>
                <input type="text" placeholder="e.g., React Custom Hook for API Calls" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Description <span className="required">*</span></label>
                <textarea placeholder="Briefly explain what this code does..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} required rows="3" className="listing-textarea" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Language <span className="required">*</span></label>
                  <select value={formData.language} onChange={e => setFormData({ ...formData, language: e.target.value })} required>
                    <option value="">Select Language</option>
                    {['JavaScript', 'TypeScript', 'Python', 'React', 'Vue', 'CSS', 'HTML', 'Node.js', 'SQL', 'Other'].map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Tags (comma-separated)</label>
                  <input type="text" placeholder="react, hooks, api" value={formData.tags} onChange={e => setFormData({ ...formData, tags: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label>Code <span className="required">*</span></label>
                <textarea placeholder="Paste your code here..." value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value })} required rows="8" className="listing-textarea code-input" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }} />
              </div>
              <div className="listing-form-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting}>{submitting ? 'Sharing...' : '💻 Share Code'}</button>
              </div>
            </form>
            <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input type="text" placeholder="🔍 Search snippets..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="search-input" />
        <select value={filterLanguage} onChange={e => setFilterLanguage(e.target.value)}>
          <option value="all">All Languages</option>
          {languages.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      <div className="code-grid">
        {filteredSnippets.map(s => <CodeCard key={s.id} snippet={s} onLike={handleLike} onDelete={handleDelete} />)}
        {filteredSnippets.length === 0 && (
          <div className="empty-state"><span className="empty-icon">💻</span><h3>No snippets found</h3><button onClick={() => setShowForm(true)} className="btn-primary">Share First Snippet</button></div>
        )}
      </div>
    </div>
  );
}

function CodeCard({ snippet, onLike, onDelete }) {
  const { state } = useAppContext();
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isOwner = state.currentUser && snippet.user_id === state.currentUser.id;
  const userName = state.profile?.name || state.currentUser?.email;
  const isLiked = snippet.likedBy?.includes(userName);

  const handleCopy = () => { navigator.clipboard.writeText(snippet.code || ''); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <>
      <div className="code-card">
        <div className="code-header">
          <div><h3>{snippet.title}</h3><span className="language-badge">{snippet.language}</span></div>
          {isOwner && <button onClick={() => setShowDeleteConfirm(true)} className="btn-sm btn-danger-sm">🗑️</button>}
        </div>
        <p className="description">{snippet.description}</p>
        <pre className="code-preview"><code>{snippet.code?.substring(0, 250)}{snippet.code?.length > 250 ? '...' : ''}</code></pre>
        <div className="tags-container">{(snippet.tags || []).map((t, i) => <span key={i} className="tag">#{t}</span>)}</div>
        <div className="code-footer">
          <div className="author-info">
            <img src={snippet.authorAvatar || AVATAR_OPTIONS[0].url} alt={snippet.author} style={{ width: '20px', height: '20px', borderRadius: '50%', marginRight: '4px' }} />
            <span>{snippet.author}</span>
            <span style={{ color: 'var(--gray-400)' }}>{snippet.date}</span>
          </div>
          <div className="code-actions">
            <button onClick={() => onLike(snippet)} className={`btn-like ${isLiked ? 'liked' : ''}`}>{isLiked ? '❤️' : '🤍'} {snippet.likes}</button>
            <button onClick={handleCopy} className="btn-copy">{copied ? '✅ Copied!' : '📋 Copy'}</button>
          </div>
        </div>
      </div>
      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete Snippet" message={`Delete "${snippet.title}"?`}
        onConfirm={() => { onDelete(snippet); setShowDeleteConfirm(false); }}
        onCancel={() => setShowDeleteConfirm(false)} confirmText="Delete" type="danger" />
    </>
  );
}

// ============================================
// MESSAGES — Messenger-style UI with typing indicator & presence
// ============================================
function Messages() {
  const { state, dispatch } = useAppContext();
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [convToDelete, setConvToDelete] = useState(null);
  const [deletingConv, setDeletingConv] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);
  const typingChannelRef = useRef(null);

  useEffect(() => {
    setConversations(state.conversations || []);
  }, [state.conversations]);

  useEffect(() => {
    if (activeConv) {
      const updated = (state.conversations || []).find(c => c.userId === activeConv.userId);
      if (updated) setActiveConv(updated);
    }
  }, [state.conversations]);

  useEffect(() => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [activeConv?.messages]);

  // Setup typing presence channel
  useEffect(() => {
    if (!activeConv || !state.currentUser) return;
    const channelName = `typing-${[state.currentUser.id, activeConv.userId].sort().join('-')}`;
    if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
    const channel = supabase.channel(channelName)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload.userId !== state.currentUser.id) {
          setOtherTyping(payload.typing);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => { if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current); };
  }, [activeConv?.userId, state.currentUser?.id]);

  const broadcastTyping = useCallback((typing) => {
    if (!typingChannelRef.current || !state.currentUser) return;
    typingChannelRef.current.send({ type: 'broadcast', event: 'typing', payload: { userId: state.currentUser.id, typing } });
  }, [state.currentUser?.id]);

  const handleTyping = (e) => {
    setReplyMessage(e.target.value);
    if (!isTyping) { setIsTyping(true); broadcastTyping(true); }
    clearTimeout(typingTimeout);
    setTypingTimeout(setTimeout(() => { setIsTyping(false); broadcastTyping(false); }, 2000));
  };

  const handleSendReply = async () => {
    if (!replyMessage.trim() || !activeConv || !state.currentUser || sending) return;
    setSending(true);
    broadcastTyping(false); setIsTyping(false);

    const optimisticMsg = {
      id: `opt-${Date.now()}`, from_user: state.currentUser.id, to_user: activeConv.userId,
      from_name: state.profile?.name || state.currentUser.email, to_name: activeConv.userName,
      message: replyMessage, read: false, created_at: new Date().toISOString(), _optimistic: true
    };
    dispatch({ type: 'ADD_CONVERSATION_MESSAGE', payload: { otherUserId: activeConv.userId, message: optimisticMsg } });
    const sentMessage = replyMessage;
    setReplyMessage('');

    try {
      const senderName = state.profile?.name || state.currentUser.email;
      const senderAvatar = state.profile?.avatar_url;
      const { error } = await supabase.from('messages').insert([{
        from_user: state.currentUser.id, to_user: activeConv.userId,
        from_name: senderName, to_name: activeConv.userName,
        from_avatar: senderAvatar, to_avatar: activeConv.userAvatar,
        message: sentMessage, read: false, created_at: new Date().toISOString()
      }]);
      if (error) throw error;
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to send message', type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
    setSending(false);
  };

  const handleDeleteConversation = async () => {
    if (!convToDelete) return;
    setDeletingConv(true);
    try {
      await supabase.from('messages').delete().or(`and(from_user.eq.${state.currentUser.id},to_user.eq.${convToDelete.userId}),and(from_user.eq.${convToDelete.userId},to_user.eq.${state.currentUser.id})`);
      dispatch({ type: 'SET_CONVERSATIONS', payload: conversations.filter(c => c.userId !== convToDelete.userId) });
      if (activeConv?.userId === convToDelete.userId) { setActiveConv(null); sessionStorage.removeItem('activeConversationId'); }
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '🗑️ Conversation deleted', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (e) {}
    setDeletingConv(false); setShowDeleteConfirm(false); setConvToDelete(null);
  };

  const openConversation = (conv) => {
    setActiveConv(conv);
    dispatch({ type: 'MARK_CONVERSATION_READ', payload: conv.userId });
    sessionStorage.setItem('activeConversationId', conv.userId);
    conv.messages.forEach(async (msg) => {
      if (!msg.read && msg.to_user === state.currentUser?.id) {
        try { await supabase.from('messages').update({ read: true }).eq('id', msg.id); } catch (e) {}
      }
    });
  };

  const activeMessages = (activeConv?.messages || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  function formatTime(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString();
  }

  return (
    <div className="messages-page">
      <div className="page-header" style={{ paddingBottom: '12px' }}>
        <h1>💬 Messages</h1>
        <div className="realtime-indicator">
          {state.realtimeConnected
            ? <span className="realtime-badge connected"><span className="realtime-pulse"></span> Live</span>
            : <span className="realtime-badge disconnected"><span className="realtime-pulse offline"></span> Reconnecting...</span>}
        </div>
      </div>

      <div className="messenger-layout">
        {/* Sidebar */}
        <div className={`messenger-sidebar ${activeConv ? 'mobile-hidden' : ''}`}>
          <div className="messenger-sidebar-header">
            <h3>Chats <span className="conv-count">{conversations.length}</span></h3>
          </div>
          {loadingMessages ? (
            <div>{[1,2,3].map(i => <SkeletonMessage key={i} />)}</div>
          ) : conversations.length === 0 ? (
            <div className="empty-conversations">
              <span>💬</span>
              <p>No conversations yet</p>
              <small>Messages from inquiries appear here</small>
            </div>
          ) : (
            <div className="messenger-conv-list">
              {conversations.map((conv, i) => (
                <div key={conv.userId || i}
                  className={`messenger-conv-item ${activeConv?.userId === conv.userId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => openConversation(conv)}>
                  <div className="conv-avatar-wrap">
                    <img src={conv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.userName || 'U')}&background=667eea&color=fff&size=40`}
                      alt={conv.userName} className="conv-avatar"
                      onError={e => { e.target.src = AVATAR_OPTIONS[0].url; }} />
                    <span className="online-dot"></span>
                  </div>
                  <div className="conv-info">
                    <div className="conv-row">
                      <strong>{conv.userName || 'Unknown'}</strong>
                      <span className="conv-time">{formatTime(conv.lastMessageTime)}</span>
                    </div>
                    <div className="conv-row">
                      <p className="conv-preview">{conv.lastMessage?.substring(0, 40)}{conv.lastMessage?.length > 40 ? '...' : ''}</p>
                      {conv.unreadCount > 0 && <span className="unread-dot">{conv.unreadCount}</span>}
                    </div>
                  </div>
                  <button className="conv-delete-btn" onClick={e => { e.stopPropagation(); setConvToDelete(conv); setShowDeleteConfirm(true); }}>🗑️</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat area */}
        <div className={`messenger-chat ${!activeConv ? 'mobile-hidden' : ''}`}>
          {activeConv ? (
            <div className="chat-inner">
              <div className="chat-topbar">
                <button className="mobile-back-btn" onClick={() => { setActiveConv(null); sessionStorage.removeItem('activeConversationId'); }}>←</button>
                <img src={activeConv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.userName)}&background=667eea&color=fff&size=40`}
                  alt={activeConv.userName} className="chat-topbar-avatar" />
                <div className="chat-topbar-info">
                  <strong>{activeConv.userName}</strong>
                  <p className="online-status">🟢 Online</p>
                </div>
                <button className="btn-sm btn-danger-sm" onClick={() => { setConvToDelete(activeConv); setShowDeleteConfirm(true); }}>🗑️</button>
              </div>

              <div className="chat-messages" ref={chatMessagesRef}>
                {activeMessages.length === 0 && (
                  <div className="chat-start-msg">
                    <span>👋</span>
                    <p>Start the conversation with {activeConv.userName}!</p>
                  </div>
                )}
                {activeMessages.map((msg, idx) => {
                  const isMine = msg.from_user === state.currentUser?.id;
                  const showAvatar = !isMine && (idx === 0 || activeMessages[idx - 1]?.from_user !== msg.from_user);
                  return (
                    <div key={msg.id} className={`chat-bubble-row ${isMine ? 'mine' : 'theirs'}`}>
                      {!isMine && showAvatar && (
                        <img src={activeConv.userAvatar || AVATAR_OPTIONS[0].url} alt={activeConv.userName} className="bubble-avatar" />
                      )}
                      {!isMine && !showAvatar && <div className="bubble-avatar-spacer"></div>}
                      <div className="bubble-col">
                        <div className={`chat-bubble ${isMine ? 'bubble-mine' : 'bubble-theirs'} ${msg._optimistic ? 'bubble-sending' : ''}`}>
                          <p>{msg.message}</p>
                        </div>
                        <div className={`bubble-meta ${isMine ? 'meta-right' : 'meta-left'}`}>
                          <span>{formatTime(msg.created_at)}</span>
                          {isMine && <span className="read-status">{msg._optimistic ? '⏳' : msg.read ? '✓✓' : '✓'}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {otherTyping && (
                  <div className="chat-bubble-row theirs">
                    <img src={activeConv.userAvatar || AVATAR_OPTIONS[0].url} alt="" className="bubble-avatar" />
                    <div className="typing-indicator">
                      <span></span><span></span><span></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-bar">
                <textarea
                  placeholder="Type a message..."
                  value={replyMessage}
                  onChange={handleTyping}
                  className="chat-textarea-msg"
                  rows="1"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
                />
                <button className="send-btn" onClick={handleSendReply} disabled={sending || !replyMessage.trim()}>
                  {sending ? '⏳' : '➤'}
                </button>
              </div>
            </div>
          ) : (
            <div className="chat-empty-state">
              <span className="empty-icon">💬</span>
              <h3>Select a conversation</h3>
              <p>Choose a chat from the sidebar to start messaging.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete Conversation"
        message={`Delete your conversation with ${convToDelete?.userName || 'this user'}? Cannot be undone.`}
        onConfirm={handleDeleteConversation} onCancel={() => { setShowDeleteConfirm(false); setConvToDelete(null); }}
        confirmText={deletingConv ? 'Deleting...' : 'Delete'} type="danger" />
    </div>
  );
}

// ============================================
// PROFILE (with Avatar Picker, Follow/Unfollow, Posts)
// ============================================
function Profile() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('listings');

  if (!state.currentUser) {
    return (
      <div className="profile-page">
        <div className="empty-state"><span className="empty-icon">👤</span><h2>Profile</h2><p>Please login to view your profile</p></div>
      </div>
    );
  }

  const userName = state.profile?.name || state.currentUser.email;
  const userListings = (state.listings || []).filter(l => l.user_id === state.currentUser.id);
  const userApps = (state.apps || []).filter(a => a.user_id === state.currentUser.id);
  const userSnippets = (state.codeSnippets || []).filter(s => s.user_id === state.currentUser.id);

  const handleAvatarUpdate = async (avatarUrl) => {
    dispatch({ type: 'UPDATE_AVATAR', payload: avatarUrl });
    try { await supabase.from('profiles').upsert({ id: state.currentUser.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: 'id' }); } catch (e) {}
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Avatar updated!', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
  };

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-cover"></div>
        <div className="profile-main-info">
          <AvatarPicker currentAvatar={state.profile?.avatar_url} userName={userName} onAvatarUpdate={handleAvatarUpdate} size="large" />
          <div className="profile-details">
            <h1>{userName}</h1>
            <p className="profile-email">{state.currentUser.email}</p>
            {state.profile?.role && <span className="role-badge">{state.profile.role === 'admin' ? '🛡️' : '👨‍💻'} {state.profile.role}</span>}
            {state.profile?.bio && <p className="profile-bio">{state.profile.bio}</p>}
            {state.profile?.website && <a href={state.profile.website} target="_blank" rel="noopener noreferrer" className="profile-link">🌐 {state.profile.website}</a>}
          </div>
          <div className="profile-action-btns">
            <Link to="/settings" className="btn-primary">⚙️ Edit Profile</Link>
            {state.isAdmin && <Link to="/admin" className="btn-secondary">🛡️ Admin</Link>}
          </div>
        </div>
      </div>

      <div className="profile-stats">
        {[
          { value: userListings.length, label: 'Listings' },
          { value: userApps.length, label: 'Apps' },
          { value: userSnippets.length, label: 'Snippets' },
          { value: state.favorites?.length || 0, label: 'Favorites' },
          { value: (state.follows || []).length, label: 'Following' },
          { value: (state.followers || []).length, label: 'Followers' },
        ].map((s, i) => (
          <div key={i} className="stat-box"><h3>{s.value}</h3><p>{s.label}</p></div>
        ))}
      </div>

      <div className="profile-tabs">
        {['listings', 'apps', 'snippets', 'favorites'].map(tab => (
          <button key={tab} className={`profile-tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
            {tab === 'listings' ? '🛒' : tab === 'apps' ? '📱' : tab === 'snippets' ? '💻' : '⭐'} {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="profile-tab-content">
        {activeTab === 'listings' && (
          userListings.length > 0
            ? <div className="listings-grid">{userListings.map(l => <ListingCard key={l.id} listing={l} />)}</div>
            : <div className="empty-state"><span className="empty-icon">🛒</span><h3>No listings yet</h3><Link to="/marketplace" className="btn-primary">Create Listing</Link></div>
        )}
        {activeTab === 'apps' && (
          userApps.length > 0
            ? <div className="app-grid">{userApps.map(a => <AppCard key={a.id} app={a} />)}</div>
            : <div className="empty-state"><span className="empty-icon">📱</span><h3>No apps yet</h3><Link to="/advertise" className="btn-primary">Advertise App</Link></div>
        )}
        {activeTab === 'snippets' && (
          userSnippets.length > 0
            ? <div className="code-grid">{userSnippets.map(s => <CodeCard key={s.id} snippet={s} onLike={() => {}} onDelete={() => {}} />)}</div>
            : <div className="empty-state"><span className="empty-icon">💻</span><h3>No snippets yet</h3><Link to="/code-sharing" className="btn-primary">Share Code</Link></div>
        )}
        {activeTab === 'favorites' && (
          (state.favorites || []).length > 0
            ? <div className="listings-grid">{(state.favorites || []).map(l => <ListingCard key={l.id} listing={l} />)}</div>
            : <div className="empty-state"><span className="empty-icon">⭐</span><h3>No favorites yet</h3></div>
        )}
      </div>
    </div>
  );
}

// ============================================
// PUBLIC PROFILE (view other users)
// ============================================
function PublicProfile() {
  const { state, dispatch } = useAppContext();
  const { userId } = useParams ? require('react-router-dom').useParams() : { userId: null };
  const [profileData, setProfileData] = useState(null);
  const [userListings, setUserListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      try {
        const [profileRes, listingsRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', userId).single(),
          supabase.from('listings').select('*').eq('user_id', userId).eq('hidden', false)
        ]);
        if (profileRes.data) setProfileData(profileRes.data);
        if (listingsRes.data) setUserListings(listingsRes.data.map(l => ({ ...l, seller: l.seller_name, sellerAvatar: l.seller_avatar, imageUrl: l.image_url, date: new Date(l.created_at).toLocaleDateString() })));
      } catch (e) {}
      setLoading(false);
    })();
  }, [userId]);

  const isFollowing = (state.follows || []).includes(userId);

  const handleFollow = async () => {
    if (!state.currentUser) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: 'Please login to follow', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); return; }
    if (isFollowing) {
      dispatch({ type: 'REMOVE_FOLLOW', payload: userId });
      try { await supabase.from('follows').delete().eq('follower_id', state.currentUser.id).eq('following_id', userId); } catch (e) {}
    } else {
      dispatch({ type: 'ADD_FOLLOW', payload: userId });
      try { await supabase.from('follows').insert([{ follower_id: state.currentUser.id, following_id: userId, created_at: new Date().toISOString() }]); } catch (e) {}
    }
  };

  if (loading) return <div className="profile-page"><div className="empty-state"><span>⏳</span><p>Loading profile...</p></div></div>;
  if (!profileData) return <div className="profile-page"><div className="empty-state"><span>👤</span><h2>User not found</h2></div></div>;

  return (
    <div className="profile-page">
      <div className="profile-hero">
        <div className="profile-cover"></div>
        <div className="profile-main-info">
          <img src={profileData.avatar_url || AVATAR_OPTIONS[0].url} alt={profileData.name} style={{ width: '100px', height: '100px', borderRadius: '50%', border: '3px solid var(--primary-light)' }} />
          <div className="profile-details">
            <h1>{profileData.name || 'User'}</h1>
            {profileData.bio && <p className="profile-bio">{profileData.bio}</p>}
            {profileData.website && <a href={profileData.website} target="_blank" rel="noopener noreferrer" className="profile-link">🌐 {profileData.website}</a>}
          </div>
          {state.currentUser && state.currentUser.id !== userId && (
            <button onClick={handleFollow} className={isFollowing ? 'btn-secondary' : 'btn-primary'}>
              {isFollowing ? '✓ Following' : '+ Follow'}
            </button>
          )}
        </div>
      </div>

      {userListings.length > 0 && (
        <div>
          <h2 style={{ marginBottom: '16px' }}>Listings by {profileData.name}</h2>
          <div className="listings-grid">{userListings.map(l => <ListingCard key={l.id} listing={l} />)}</div>
        </div>
      )}
    </div>
  );
}

// ============================================
// ACTIVITY FEED
// ============================================
function ActivityFeed() {
  const { state } = useAppContext();
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('listings')
        .select('*, profiles:user_id (name, avatar_url)')
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) {
        const activities = data.filter(l => !l.hidden).map(l => ({
          id: l.id, type: 'listing', title: l.title, price: l.price,
          userName: l.seller_name || 'Unknown', userAvatar: l.seller_avatar,
          time: l.created_at, userId: l.user_id
        }));
        setFeed(activities);
      }
    } catch (e) {}
    setLoading(false);
  };

  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  return (
    <div className="activity-page">
      <div className="page-header">
        <h1>📡 Activity Feed</h1>
        <p>See what's happening in the community</p>
      </div>
      {loading ? (
        <div className="activity-feed-list">{[1,2,3,4,5].map(i => <SkeletonMessage key={i} />)}</div>
      ) : (
        <div className="activity-feed-list">
          {feed.map(item => (
            <div key={item.id} className="activity-feed-item">
              <img src={item.userAvatar || AVATAR_OPTIONS[0].url} alt={item.userName}
                className="activity-avatar"
                onError={e => { e.target.src = AVATAR_OPTIONS[0].url; }} />
              <div className="activity-content">
                <div className="activity-header">
                  <strong>{item.userName}</strong>
                  <span className="activity-time">{timeAgo(item.time)}</span>
                </div>
                <p className="activity-text">
                  {item.type === 'listing' && <>listed <strong>"{item.title}"</strong> for <span className="activity-price">{item.price}</span></>}
                </p>
              </div>
              <span className="activity-icon">🛒</span>
            </div>
          ))}
          {feed.length === 0 && (
            <div className="empty-state"><span className="empty-icon">📡</span><h3>No activity yet</h3><p>Be the first to post a listing!</p></div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// FAVORITES
// ============================================
function Favorites() {
  const { state } = useAppContext();
  return (
    <div className="favorites-page">
      <div className="page-header"><h1>⭐ My Favorites</h1><p>Your saved listings</p></div>
      {!state.currentUser ? (
        <div className="empty-state"><span className="empty-icon">🔒</span><h3>Please login to view favorites</h3></div>
      ) : (state.favorites || []).length === 0 ? (
        <div className="empty-state"><span className="empty-icon">⭐</span><h3>No favorites yet</h3><p>Browse listings and save your favorites!</p></div>
      ) : (
        <div className="listings-grid">{(state.favorites || []).map(item => <ListingCard key={item.id} listing={item} />)}</div>
      )}
    </div>
  );
}

// ============================================
// SETTINGS — with notification master toggle & avatar picker
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

  const [securityForm, setSecurityForm] = useState({ currentPassword: '', newPassword: '', confirmNewPassword: '' });

  const [notificationPrefs, setNotificationPrefs] = useState({
    allNotifications: state.notificationsEnabled !== false,
    emailNotifications: true,
    messageAlerts: true,
    listingUpdates: true,
    weeklyDigest: false
  });

  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'public', showEmail: false, showActivity: true, allowMessages: true
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
    return <div className="settings-page"><div className="empty-state"><span className="empty-icon">⚙️</span><h2>Settings</h2><p>Please login to access settings</p></div></div>;
  }

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    dispatch({ type: 'UPDATE_PROFILE', payload: profileForm });
    try { await supabase.from('profiles').upsert({ id: state.currentUser.id, ...profileForm, updated_at: new Date().toISOString() }); } catch (e) {}
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Profile updated!', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    setSaving(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (securityForm.newPassword !== securityForm.confirmNewPassword) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Passwords do not match', type: 'error', time: new Date().toLocaleTimeString(), read: false } }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: securityForm.newPassword });
      if (error) throw error;
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Password changed!', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
      setSecurityForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
    } catch (error) { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false } }); }
    setSaving(false);
  };

  const handleAvatarUpdate = async (avatarUrl) => {
    dispatch({ type: 'UPDATE_AVATAR', payload: avatarUrl });
    try { await supabase.from('profiles').upsert({ id: state.currentUser.id, avatar_url: avatarUrl, updated_at: new Date().toISOString() }, { onConflict: 'id' }); } catch (e) {}
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Avatar updated!', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
  };

  const handleNotificationSave = async () => {
    const enabled = notificationPrefs.allNotifications;
    dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: enabled });
    try { await supabase.from('profiles').upsert({ id: state.currentUser.id, notifications_enabled: enabled, updated_at: new Date().toISOString() }, { onConflict: 'id' }); } catch (e) {}
    dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Notification preferences saved!', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
  };

  const tabs = [
    { id: 'profile', label: '👤 Profile' },
    { id: 'avatar', label: '🎨 Avatar' },
    { id: 'security', label: '🔒 Security' },
    { id: 'notifications', label: '🔔 Notifications' },
    { id: 'privacy', label: '🛡️ Privacy' },
    { id: 'appearance', label: '🎨 Appearance' },
    { id: 'danger', label: '⚠️ Danger' },
  ];

  const userName = state.profile?.name || state.currentUser.email;

  return (
    <div className="settings-page">
      <div className="page-header"><h1>⚙️ Settings</h1><p>Manage your account and preferences</p></div>
      <div className="settings-layout">
        <div className="settings-sidebar">
          {tabs.map(tab => (
            <button key={tab.id} className={`settings-tab-btn ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="settings-content">
          {activeTab === 'profile' && (
            <div className="settings-form">
              <h3>Profile Information</h3>
              <form onSubmit={handleProfileUpdate}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" value={profileForm.name} onChange={e => setProfileForm({ ...profileForm, name: e.target.value })} placeholder="Your name" />
                </div>
                <div className="form-group">
                  <label>Bio</label>
                  <textarea value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder="Tell us about yourself..." rows="3" />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Website</label>
                    <input type="url" value={profileForm.website} onChange={e => setProfileForm({ ...profileForm, website: e.target.value })} placeholder="https://yoursite.com" />
                  </div>
                  <div className="form-group">
                    <label>GitHub</label>
                    <input type="text" value={profileForm.github} onChange={e => setProfileForm({ ...profileForm, github: e.target.value })} placeholder="@username" />
                  </div>
                </div>
                <div className="form-group">
                  <label>Twitter</label>
                  <input type="text" value={profileForm.twitter} onChange={e => setProfileForm({ ...profileForm, twitter: e.target.value })} placeholder="@username" />
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
              </form>
            </div>
          )}

          {activeTab === 'avatar' && (
            <div className="settings-form">
              <h3>Choose Your Avatar</h3>
              <p className="settings-description">Select an avatar that represents you on DevMarket.</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '24px' }}>
                <AvatarPicker currentAvatar={state.profile?.avatar_url} userName={userName} onAvatarUpdate={handleAvatarUpdate} size="large" />
              </div>
              <div className="avatar-picker-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                {AVATAR_OPTIONS.map(av => (
                  <button key={av.id} className="avatar-option-btn"
                    onClick={async () => { await handleAvatarUpdate(av.url); }}
                    style={{ background: state.profile?.avatar_url === av.url ? 'var(--primary-light)' : 'var(--gray-100)', border: state.profile?.avatar_url === av.url ? '2px solid var(--primary)' : '2px solid transparent', borderRadius: 'var(--radius-lg)', padding: '12px', cursor: 'pointer', transition: 'all 0.2s' }}>
                    <img src={av.url} alt={av.label} style={{ width: '64px', height: '64px', borderRadius: '50%', display: 'block', margin: '0 auto 8px' }} />
                    <span style={{ display: 'block', textAlign: 'center', fontSize: '0.85rem' }}>{av.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="settings-form">
              <h3>Change Password</h3>
              <form onSubmit={handlePasswordChange}>
                <div className="form-group">
                  <label>New Password</label>
                  <input type="password" value={securityForm.newPassword} onChange={e => setSecurityForm({ ...securityForm, newPassword: e.target.value })} placeholder="New password (6+ chars)" minLength="6" />
                </div>
                <div className="form-group">
                  <label>Confirm New Password</label>
                  <input type="password" value={securityForm.confirmNewPassword} onChange={e => setSecurityForm({ ...securityForm, confirmNewPassword: e.target.value })} placeholder="Confirm new password" />
                </div>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Changing...' : '🔒 Change Password'}</button>
              </form>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="settings-form">
              <h3>Notification Settings</h3>
              <p className="settings-description">Control how and when you receive notifications.</p>

              {/* Master toggle */}
              <div className="setting-item master-toggle">
                <div className="setting-info">
                  <strong>All Notifications</strong>
                  <p>Completely enable or disable all notifications</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={notificationPrefs.allNotifications}
                    onChange={() => setNotificationPrefs({ ...notificationPrefs, allNotifications: !notificationPrefs.allNotifications })} />
                  <span className="toggle-slider"></span>
                </label>
              </div>

              <div className={`notification-settings ${!notificationPrefs.allNotifications ? 'disabled-section' : ''}`}>
                {[
                  { key: 'emailNotifications', label: 'Email Notifications', desc: 'Receive notifications via email' },
                  { key: 'messageAlerts', label: 'Message Alerts', desc: 'Get notified of new messages' },
                  { key: 'listingUpdates', label: 'Listing Updates', desc: 'Updates about your listings' },
                  { key: 'weeklyDigest', label: 'Weekly Digest', desc: 'Weekly summary of activity' },
                ].map(({ key, label, desc }) => (
                  <div className="setting-item" key={key}>
                    <div className="setting-info"><strong>{label}</strong><p>{desc}</p></div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={notificationPrefs[key] && notificationPrefs.allNotifications}
                        disabled={!notificationPrefs.allNotifications}
                        onChange={() => setNotificationPrefs({ ...notificationPrefs, [key]: !notificationPrefs[key] })} />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                ))}
              </div>

              <button onClick={handleNotificationSave} className="btn-primary">💾 Save Preferences</button>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="settings-form">
              <h3>Privacy Settings</h3>
              <div className="form-group">
                <label>Profile Visibility</label>
                <select value={privacySettings.profileVisibility} onChange={e => setPrivacySettings({ ...privacySettings, profileVisibility: e.target.value })}>
                  <option value="public">Public</option>
                  <option value="members">Members Only</option>
                  <option value="private">Private</option>
                </select>
              </div>
              {[
                { key: 'showEmail', label: 'Show Email' },
                { key: 'showActivity', label: 'Show Activity' },
                { key: 'allowMessages', label: 'Allow Messages' }
              ].map(({ key, label }) => (
                <div className="setting-item" key={key}>
                  <div className="setting-info"><strong>{label}</strong></div>
                  <label className="toggle-switch">
                    <input type="checkbox" checked={privacySettings[key]} onChange={() => setPrivacySettings({ ...privacySettings, [key]: !privacySettings[key] })} />
                    <span className="toggle-slider"></span>
                  </label>
                </div>
              ))}
              <button onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Privacy settings saved!', type: 'success', time: new Date().toLocaleTimeString(), read: false } })} className="btn-primary">💾 Save Privacy</button>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="settings-form">
              <h3>Appearance</h3>
              <div className="theme-toggle-section">
                <div className="theme-info"><strong>Theme Mode</strong><p>Choose between light and dark theme</p></div>
                <button type="button" className="theme-toggle" onClick={() => dispatch({ type: 'TOGGLE_THEME' })}>
                  {state.theme === 'light' ? '🌙 Switch to Dark' : '☀️ Switch to Light'}
                </button>
              </div>
              <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>Current: <strong>{state.theme === 'light' ? '☀️ Light' : '🌙 Dark'}</strong></p>
            </div>
          )}

          {activeTab === 'danger' && (
            <div className="settings-form">
              <h3 style={{ color: 'var(--danger)' }}>⚠️ Danger Zone</h3>
              <div className="danger-zone-card">
                <h4 style={{ color: 'var(--danger)' }}>Delete Account</h4>
                <p>Once deleted, there is no going back.</p>
                <button className="btn-primary" onClick={() => setShowDeleteConfirm(true)} style={{ background: 'var(--danger)' }}>🗑️ Delete My Account</button>
              </div>
              <div className="danger-zone-card warning">
                <h4 style={{ color: 'var(--warning)' }}>Export Data</h4>
                <p>Download all your data including listings and messages.</p>
                <button className="btn-secondary" onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '📦 Export started!', type: 'info', time: new Date().toLocaleTimeString(), read: false } })}>📥 Export My Data</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete Account" message="Are you absolutely sure? This cannot be undone."
        onConfirm={() => { dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '⚠️ Account deletion requires admin approval', type: 'warning', time: new Date().toLocaleTimeString(), read: false } }); setShowDeleteConfirm(false); }}
        onCancel={() => setShowDeleteConfirm(false)} confirmText="Delete Forever" type="danger" />
    </div>
  );
}

// ============================================
// ADMIN DASHBOARD (with hide/unhide listing)
// ============================================
function AdminDashboard() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [moderationFilter, setModerationFilter] = useState('all');
  const [platformSettings, setPlatformSettings] = useState({ autoApprove: true, requireEmailVerification: true, allowMessages: true, maintenanceMode: false });

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) loadUsers();
    if (activeTab === 'overview') loadStats();
  }, [activeTab]);

  const loadStats = async () => { try { const stats = await analytics.getDashboardStats(); dispatch({ type: 'SET_ANALYTICS_DATA', payload: stats }); } catch (e) {} };
  const loadUsers = async () => { setLoadingUsers(true); try { const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(50); if (data) setUsers(data); } catch (e) {} setLoadingUsers(false); };

  const handleDeleteListing = async (listingId, title) => {
    try {
      await supabase.from('listings').delete().eq('id', listingId);
      dispatch({ type: 'DELETE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🗑️ Listing "${title}" removed`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (e) {}
  };

  const handleHideListing = async (listingId, title) => {
    try {
      await supabase.from('listings').update({ hidden: true }).eq('id', listingId);
      dispatch({ type: 'HIDE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🙈 "${title}" hidden`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (e) {}
  };

  const handleUnhideListing = async (listingId, title) => {
    try {
      await supabase.from('listings').update({ hidden: false }).eq('id', listingId);
      dispatch({ type: 'UNHIDE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `👁️ "${title}" is now visible`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (e) {}
  };

  if (!state.currentUser || !state.isAdmin) {
    return <div className="admin-page"><div className="empty-state"><span className="empty-icon">🔒</span><h2>Access Denied</h2><p>Admin privileges required.</p></div></div>;
  }

  const stats = state.analyticsData || { totalUsers: 0, totalListings: 0, totalApps: 0, totalSnippets: 0, totalMessages: 0 };
  const filteredListings = moderationFilter === 'all' ? (state.listings || []) : moderationFilter === 'hidden' ? (state.listings || []).filter(l => l.hidden) : (state.listings || []).filter(l => !l.hidden);

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'users', label: '👥 Users' },
    { id: 'listings', label: '🛒 Listings' },
    { id: 'moderation', label: '🛡️ Moderation' },
    { id: 'settings', label: '⚙️ Settings' }
  ];

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1>🛡️ Admin Dashboard</h1>
        <p>Manage your DevMarket platform</p>
        <span className="live-badge">● Live</span>
      </div>

      <div className="admin-tabs">
        {tabs.map(tab => <button key={tab.id} className={`admin-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>{tab.label}</button>)}
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
            <div className="admin-section-header"><h3>📢 Recent Listings</h3><button className="btn-sm btn-secondary" onClick={() => setActiveTab('listings')}>View All</button></div>
            <div className="activity-list">
              {(state.listings || []).slice(0, 5).map(listing => (
                <div key={listing.id} className="activity-item">
                  <span>📢</span>
                  <div><strong>{listing.seller_name || listing.seller || 'Unknown'}</strong><p>Listed "{listing.title}" — {listing.price}</p></div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {listing.hidden && <span className="hidden-label">🙈 Hidden</span>}
                    <small>{listing.date || new Date(listing.created_at).toLocaleDateString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="admin-section-card">
          <div className="admin-section-header"><h3>👥 All Users ({users.length})</h3><button className="btn-sm btn-secondary" onClick={loadUsers}>🔄 Refresh</button></div>
          {loadingUsers ? <div>Loading...</div> : (
            <div className="users-table-wrap">
              <table className="admin-table">
                <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Joined</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="user-cell">
                          <img src={u.avatar_url || AVATAR_OPTIONS[0].url} alt={u.name} style={{ width: '32px', height: '32px', borderRadius: '50%', marginRight: '8px' }} />
                          {u.name || 'Unknown'}
                        </div>
                      </td>
                      <td>{u.email}</td>
                      <td><span className={`role-tag ${u.role}`}>{u.role}</span></td>
                      <td>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'listings' && (
        <div className="admin-section-card">
          <div className="admin-section-header">
            <h3>🛒 All Listings ({(state.listings || []).length})</h3>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select value={moderationFilter} onChange={e => setModerationFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="visible">Visible</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
          </div>
          <div className="admin-listings-list">
            {filteredListings.map(listing => (
              <div key={listing.id} className={`admin-listing-item ${listing.hidden ? 'item-hidden' : ''}`}>
                <div className="admin-listing-info">
                  <strong>{listing.title}</strong>
                  <span>{listing.price} · {listing.seller_name || listing.seller}</span>
                  {listing.hidden && <span className="hidden-label">🙈 Hidden</span>}
                </div>
                <div className="admin-listing-actions">
                  {listing.hidden
                    ? <button className="btn-sm btn-unhide" onClick={() => handleUnhideListing(listing.id, listing.title)}>👁️ Unhide</button>
                    : <HideListingButton listing={listing} onHide={handleHideListing} />
                  }
                  <button className="btn-sm btn-danger-sm" onClick={() => handleDeleteListing(listing.id, listing.title)}>🗑️ Delete</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'moderation' && (
        <div className="admin-section-card">
          <h3>🛡️ Content Moderation</h3>
          <p style={{ color: 'var(--gray-500)', marginBottom: '16px' }}>Review and manage reported content. Use the Listings tab to hide/unhide items.</p>
          <div className="empty-state" style={{ padding: '40px 0' }}>
            <span>✅</span>
            <p>No items pending moderation</p>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="admin-section-card">
          <h3>⚙️ Platform Settings</h3>
          {Object.entries(platformSettings).map(([key, value]) => (
            <div className="setting-item" key={key}>
              <div className="setting-info"><strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</strong></div>
              <label className="toggle-switch">
                <input type="checkbox" checked={value} onChange={() => setPlatformSettings({ ...platformSettings, [key]: !value })} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          ))}
          <button className="btn-primary" onClick={() => dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '✅ Settings saved!', type: 'success', time: new Date().toLocaleTimeString(), read: false } })}>💾 Save Settings</button>
        </div>
      )}
    </div>
  );
}

// Helper for hide with confirmation modal in admin
function HideListingButton({ listing, onHide }) {
  const [showConfirm, setShowConfirm] = useState(false);
  return (
    <>
      <button className="btn-sm btn-hide" onClick={() => setShowConfirm(true)}>🙈 Hide</button>
      <ConfirmDialog isOpen={showConfirm} title="Hide Listing"
        message={`Are you sure you want to hide "${listing.title}"? Non-admin users won't see it.`}
        onConfirm={() => { onHide(listing.id, listing.title); setShowConfirm(false); }}
        onCancel={() => setShowConfirm(false)} confirmText="Hide Listing" type="danger" />
    </>
  );
}

// ============================================
// ANALYTICS PAGE
// ============================================
function AnalyticsPage() {
  const { state, dispatch } = useAppContext();

  useEffect(() => {
    analytics.getDashboardStats().then(stats => dispatch({ type: 'SET_ANALYTICS_DATA', payload: stats })).catch(() => {});
  }, []);

  const stats = state.analyticsData || { totalUsers: 0, totalListings: 0, totalApps: 0, totalSnippets: 0, totalMessages: 0 };

  return (
    <div className="analytics-page">
      <div className="page-header"><h1>📊 Analytics</h1><p>Track your impact on DevMarket</p></div>
      <div className="stats-grid">
        {[
          { icon: '🛒', value: stats.totalListings, label: 'Total Listings', color: '#667eea' },
          { icon: '📱', value: stats.totalApps, label: 'Total Apps', color: '#10b981' },
          { icon: '💻', value: stats.totalSnippets, label: 'Code Snippets', color: '#8b5cf6' },
          { icon: '💬', value: stats.totalMessages, label: 'Messages Sent', color: '#f59e0b' },
          { icon: '👥', value: stats.totalUsers, label: 'Registered Users', color: '#ef4444' },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ borderTop: `3px solid ${s.color}` }}>
            <span className="stat-icon">{s.icon}</span>
            <h3 style={{ color: s.color }}>{s.value}</h3>
            <p>{s.label}</p>
          </div>
        ))}
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
      <div className="footer-compact">
        <div className="footer-brand"><span>🚀</span><span className="footer-brand-name">DevMarket</span></div>
        <div className="footer-links">
          <Link to="/marketplace">Marketplace</Link>
          <Link to="/code-sharing">Code Share</Link>
          <Link to="/advertise">Advertise</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer">GitHub</a>
        </div>
        <p className="footer-copy">&copy; {currentYear} DevMarket</p>
      </div>
    </footer>
  );
}