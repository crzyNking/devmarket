// ============================================
// src/App.js (COMPLETE ENHANCED VERSION - FIXED)
// ============================================
import React, { useState, useEffect, createContext, useContext, useReducer, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate, useParams } from 'react-router-dom';
import { supabase } from './utils/supabase';
import { realtimeManager } from './utils/realtime';
import { analytics } from './utils/analytics';
import './App.css';

async function createNotificationIfEnabled({ userId, message, type = 'info' }) {
  if (!userId || !message) return;
  try {
    const { data: recipientProfile } = await supabase
      .from('profiles')
      .select('notifications_enabled')
      .eq('id', userId)
      .maybeSingle();

    if (recipientProfile?.notifications_enabled === false) return;

    await supabase.from('notifications').insert([{
      user_id: userId,
      message,
      type,
      read: false,
      created_at: new Date().toISOString()
    }]);
  } catch (error) {
    console.log('Could not create notification:', error);
  }
}

async function logActivity({ userId, type, title, message, targetUserId = null }) {
  if (!userId) return;
  try {
    await supabase.from('activity_feed').insert([{
      user_id: userId,
      target_user_id: targetUserId,
      type,
      title,
      message,
      created_at: new Date().toISOString()
    }]);
  } catch (error) {
    // Optional analytics stream; no-op if table is unavailable.
  }
}

// ============================================
// GLOBAL CONTEXT
// ============================================
const AppContext = createContext();

const getStoredNotificationPreferenceRaw = () => {
  try {
    return localStorage.getItem('devMarketNotificationsEnabled');
  } catch (error) {
    return null;
  }
};

const getStoredNotificationPreference = () => {
  try {
    const raw = localStorage.getItem('devMarketNotificationsEnabled');
    if (raw === null) return true;
    return raw !== 'false';
  } catch (error) {
    return true;
  }
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
  follows: [],
  followers: [],
  activityFeed: [],
  searchHistory: [],
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
  notificationsEnabled: getStoredNotificationPreference()
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
      return { ...state, profile: { ...state.profile, avatar_url: action.payload } };
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
    case 'ADD_NOTIFICATION': 
      if (state.notificationsEnabled === false) return state;
      return { ...state, notifications: [{...action.payload, id: Date.now() + Math.random()}, ...(state.notifications || [])].slice(0, 50) };
    case 'REMOVE_NOTIFICATION': 
      return { ...state, notifications: (state.notifications || []).filter(n => n.id !== action.payload) };
    case 'CLEAR_NOTIFICATIONS': 
      return { ...state, notifications: [] };
    case 'MARK_NOTIFICATIONS_READ': 
      return { ...state, notifications: (state.notifications || []).map(n => ({ ...n, read: true })) };
    case 'SET_NOTIFICATIONS_ENABLED':
      return { ...state, notificationsEnabled: action.payload };
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
          if (c.userId !== action.payload.otherUserId && !state.conversations.find(conv => conv.userId === action.payload.otherUserId)) {
            return c;
          }
          return c;
        })
      };
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
    case 'SET_FOLLOWS':
      return { ...state, follows: action.payload || [] };
    case 'SET_FOLLOWERS':
      return { ...state, followers: action.payload || [] };
    case 'SET_ACTIVITY_FEED':
      return { ...state, activityFeed: action.payload || [] };
    case 'TOGGLE_FAVORITE': {
      const favExists = (state.favorites || []).find(f => f.id === action.payload.id);
      return { ...state, favorites: favExists ? (state.favorites || []).filter(f => f.id !== action.payload.id) : [...(state.favorites || []), action.payload] };
    }
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
      return { ...state, currentUser: null, profile: null, session: null, notifications: [], messages: [], conversations: [], activeConversation: null, favorites: [], isAdmin: false };
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('devMarketTheme', newTheme);
      return { ...state, theme: newTheme };
    }
    case 'SET_THEME': {
      localStorage.setItem('devMarketTheme', action.payload);
      return { ...state, theme: action.payload };
    }
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
// ENHANCED AVATAR UPLOAD WITH SUPABASE STORAGE
// ============================================
function AvatarUpload({ currentAvatar, userName, onAvatarUpdate, size = 'large' }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError('Please select a valid image file (JPEG, PNG, GIF, WebP, SVG)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setPreview(event.target.result);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop().toLowerCase();
      const fileName = `avatar-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `public/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
          contentType: file.type
        });

      if (uploadError) {
        console.log('Storage upload error, trying alternative method...');
        
        const { data: uploadData2, error: uploadError2 } = await supabase.storage
          .from('avatars')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError2) {
          const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;
          onAvatarUpdate(avatarUrl);
          setPreview(null);
          setUploading(false);
          return;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(fileName);

        onAvatarUpdate(publicUrl);
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('avatars')
          .getPublicUrl(filePath);

        onAvatarUpdate(publicUrl);
      }

      setPreview(null);
      setError(null);
    } catch (error) {
      console.error('Upload error:', error);
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;
      onAvatarUpdate(avatarUrl);
      setPreview(null);
      setError('Upload failed, using generated avatar instead');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const displayAvatar = preview || currentAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`;

  const sizeClasses = {
    small: { wrapper: '60px', fontSize: '0.7rem' },
    medium: { wrapper: '80px', fontSize: '0.8rem' },
    large: { wrapper: '100px', fontSize: '0.85rem' }
  };

  const currentSize = sizeClasses[size] || sizeClasses.large;

  return (
    <div className="avatar-upload-container">
      <div 
        className="avatar-preview-wrapper" 
        onClick={() => !uploading && fileInputRef.current?.click()}
        style={{ width: currentSize.wrapper, height: currentSize.wrapper }}
      >
        <img 
          src={displayAvatar} 
          alt={userName || 'User'} 
          className="avatar-upload-preview"
          style={{ width: currentSize.wrapper, height: currentSize.wrapper }}
          onError={(e) => { 
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`; 
          }}
        />
        <div className="avatar-upload-overlay" style={{ fontSize: currentSize.fontSize }}>
          <span>📷</span>
          <span>{uploading ? 'Uploading...' : 'Change'}</span>
        </div>
      </div>
      {error && (
        <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '4px 0 0 0', textAlign: 'center' }}>
          {error}
        </p>
      )}
      <input 
        ref={fileInputRef}
        type="file" 
        accept="image/*" 
        onChange={handleFileSelect} 
        style={{ display: 'none' }}
      />
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
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

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
        const storedPref = getStoredNotificationPreferenceRaw();
        const notificationsEnabled = storedPref === null ? profile.notifications_enabled !== false : storedPref !== 'false';
        dispatch({ type: 'SET_PROFILE', payload: profile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...profile } });
        dispatch({ type: 'SET_IS_ADMIN', payload: profile.role === 'admin' });
        dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: notificationsEnabled });
        localStorage.setItem('devMarketNotificationsEnabled', notificationsEnabled ? 'true' : 'false');
        if (storedPref !== null && profile.notifications_enabled !== notificationsEnabled) {
          supabase.from('profiles').upsert({ id: user.id, notifications_enabled: notificationsEnabled, updated_at: new Date().toISOString() }, { onConflict: 'id' }).then(() => {}).catch(() => {});
        }
        return profile;
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
        const storedPref = getStoredNotificationPreferenceRaw();
        const notificationsEnabled = storedPref === null ? true : storedPref !== 'false';
        dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: notificationsEnabled });
        localStorage.setItem('devMarketNotificationsEnabled', notificationsEnabled ? 'true' : 'false');
        return defaultProfile;
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      return null;
    }
  }

  async function loadUserData(userId, notificationsEnabled = true) {
    try {
      const [msgsResult, favsResult, notifsResult, followsResult, followersResult, activityResult] = await Promise.all([
        supabase.from('messages').select('*').or(`from_user.eq.${userId},to_user.eq.${userId}`).order('created_at', { ascending: false }),
        supabase.from('favorites').select('*, listing:listing_id (*)').eq('user_id', userId),
        notificationsEnabled
          ? supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
          : Promise.resolve({ data: [] }),
        supabase.from('follows').select('following_id').eq('follower_id', userId),
        supabase.from('follows').select('follower_id').eq('following_id', userId),
        supabase.from('activity_feed').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(100)
      ]);

      if (notificationsEnabled && notifsResult.data) {
        dispatch({ type: 'SET_NOTIFICATIONS', payload: notifsResult.data.map(n => ({
          ...n,
          read: n.read || false
        })) });
      } else {
        dispatch({ type: 'CLEAR_NOTIFICATIONS' });
      }

      if (msgsResult.data) {
        dispatch({ type: 'SET_MESSAGES', payload: msgsResult.data });
        buildConversations(msgsResult.data, userId);
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

      dispatch({ type: 'SET_FOLLOWS', payload: (followsResult.data || []).map(f => f.following_id) });
      dispatch({ type: 'SET_FOLLOWERS', payload: (followersResult.data || []).map(f => f.follower_id) });
      dispatch({ type: 'SET_ACTIVITY_FEED', payload: activityResult.data || [] });

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
      (payload) => {
        const newMsg = payload.new;
        console.log('📨 New real-time message:', newMsg);
        
        dispatch({ type: 'ADD_MESSAGE', payload: newMsg });
        
        const otherUserId = newMsg.from_user;
        const otherUserName = newMsg.from_name || 'User';
        
        dispatch({
          type: 'ADD_CONVERSATION_MESSAGE',
          payload: {
            otherUserId,
            message: newMsg
          }
        });
        
        // Only notify if the conversation is NOT currently open (not being read)
        const currentState = (() => { try { return null; } catch(e) { return null; } })();
        // We use a workaround: check via sessionStorage flag set by Messages component
        const activeConvId = sessionStorage.getItem('activeConversationId');
        const isConversationOpen = activeConvId === otherUserId;
        
        const notificationsAllowed = localStorage.getItem('devMarketNotificationsEnabled') !== 'false';
        if (!isConversationOpen && notificationsAllowed) {
          dispatch({ type: 'ADD_NOTIFICATION', payload: {
            message: `💬 New message from ${otherUserName}: ${newMsg.subject || newMsg.message?.substring(0, 50)}`,
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
        const notificationsAllowed = localStorage.getItem('devMarketNotificationsEnabled') !== 'false';
        if (!notificationsAllowed) return;
        console.log('🔔 New real-time notification:', payload.new);
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
        if (payload.eventType === 'INSERT') {
          dispatch({ type: 'ADD_LISTING', payload: payload.new });
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'DELETE_LISTING', payload: payload.old.id });
        } else if (payload.eventType === 'UPDATE') {
          dispatch({ type: 'UPDATE_LISTING', payload: payload.new });
        }
        loadPublicData();
      }
    );

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
          userId: otherUserId,
          userName: otherUserName || 'Unknown User',
          userAvatar: otherUserAvatar,
          lastMessage: msg.message,
          lastMessageTime: msg.created_at,
          unreadCount: 0,
          messages: []
        });
      }
      
      const conv = conversationMap.get(otherUserId);
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
            const loadedProfile = await loadProfile(session.user);
            const notificationsEnabled = loadedProfile?.notifications_enabled !== false;
            await loadUserData(session.user.id, notificationsEnabled);
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        dispatch({ type: 'SET_SESSION', payload: session });
        
        if (event === 'SIGNED_IN' && session?.user) {
          const loadedProfile = await loadProfile(session.user);
          const notificationsEnabled = loadedProfile?.notifications_enabled !== false;
          await loadUserData(session.user.id, notificationsEnabled);
        } else if (event === 'SIGNED_OUT') {
          dispatch({ type: 'LOGOUT' });
          realtimeManager.unsubscribeAll();
        }
      }
    });

    if (!hasShownLoader) {
      initialize().then(() => {
        sessionStorage.setItem('devMarketLoaderShown', 'true');
        setTimeout(() => setIsInitialLoading(false), 500);
      });
      
      const safetyTimeout = setTimeout(() => {
        setIsInitialLoading(false);
        sessionStorage.setItem('devMarketLoaderShown', 'true');
      }, 6000);
      
      return () => {
        clearTimeout(safetyTimeout);
        mounted = false;
        subscription?.unsubscribe();
        realtimeManager.unsubscribeAll();
      };
    } else {
      initialize().then(() => setIsInitialLoading(false));
    }

    return () => {
      mounted = false;
      subscription?.unsubscribe();
      realtimeManager.unsubscribeAll();
    };
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem('devMarketTheme');
    if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark') && savedTheme !== state.theme) {
      dispatch({ type: 'SET_THEME', payload: savedTheme });
    }
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
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
          {isOffline && <div className="offline-banner">📴 You are offline. Cached content is shown.</div>}
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
          <Footer />
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
// ENHANCED HEADER WITH REAL-TIME INDICATOR
// ============================================
function Header() {
  const { state, dispatch } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showSearch, setShowSearch] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
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
      setShowSearch(false);
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
    setIsMenuOpen(false);
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
        <AdvancedSearch 
          isOpen={showAdvancedSearch} 
          onClose={() => setShowAdvancedSearch(false)} 
          onSearch={handleAdvancedSearch}
          searchType="all"
        />
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
      const { error } = await supabase.auth.signInWithOAuth({ 
        provider, 
        options: { 
          redirectTo: window.location.origin,
          queryParams: provider === 'facebook' ? {
            access_type: 'offline',
            prompt: 'consent',
          } : undefined
        } 
      });
      if (error) {
        dispatch({ type: 'SET_AUTH_ERROR', payload: `${provider} login not configured. Please check your Supabase settings.` });
      }
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
    <div className="modal-overlay auth-overlay" onClick={() => setShowAuth(false)}>
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
  <button 
    className="social-btn social-btn-google" 
    onClick={() => handleSocialLogin('google')}
    type="button"
  >
    <svg className="social-icon-img" viewBox="0 0 24 24" width="20" height="20">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
    Google
  </button>
  
  <button 
    className="social-btn social-btn-github" 
    onClick={() => handleSocialLogin('github')}
    type="button"
  >
    <svg className="social-icon-img" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
    </svg>
    GitHub
  </button>
  
  <button 
    className="social-btn social-btn-facebook" 
    onClick={() => handleSocialLogin('facebook')}
    type="button"
  >
    <svg className="social-icon-img" viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
    Facebook
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
                    <input type={showConfirmPassword ? "text" : "password"} placeholder="Confirm password" value={formData.confirmPassword} onChange={e => setFormData({...formData, confirmPassword: e.target.value})} className={errors.confirmPassword ? 'error' : ''} />
                    <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? '👁️' : '👁️‍🗨️'}</button>
                    {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
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
  const [pendingAction, setPendingAction] = useState(null);

  useEffect(() => {
    if (activeTab === 'users' && users.length === 0) {
      loadUsers();
    }
    if (activeTab === 'overview') {
      loadStats();
    }
  }, [activeTab]);

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
    try {
      await supabase.from('listings').delete().eq('id', listingId);
      dispatch({ type: 'DELETE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: `🗑️ Listing "${title}" removed`, type: 'success', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    } catch (e) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Could not remove listing', type: 'error', 
        time: new Date().toLocaleTimeString(), read: false 
      }});
    }
  };

  const handleSaveSettings = () => {
    (async () => {
      try {
        await supabase.from('platform_settings').upsert([{ key: 'global', value: platformSettings, updated_at: new Date().toISOString() }], { onConflict: 'key' });
      } catch (error) {
        localStorage.setItem('devMarketPlatformSettings', JSON.stringify(platformSettings));
      }
      setSettingsSaved(true);
      dispatch({ type: 'ADD_NOTIFICATION', payload: {
        message: '✅ Platform settings saved!', type: 'success',
        time: new Date().toLocaleTimeString(), read: false
      }});
      setTimeout(() => setSettingsSaved(false), 3000);
    })();
  };

  const handleBanUser = async (userId, userName) => {
    try {
      await supabase.from('profiles').update({ banned: true, updated_at: new Date().toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: true } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🚫 ${userName || 'User'} was banned`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to ban user', type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
  };

  const handleUnbanUser = async (userId, userName) => {
    try {
      await supabase.from('profiles').update({ banned: false, updated_at: new Date().toISOString() }).eq('id', userId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, banned: false } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ ${userName || 'User'} was unbanned`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to unban user', type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
  };

  const handleToggleAdminRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'developer' : 'admin';
    try {
      await supabase.from('profiles').update({ role: nextRole, updated_at: new Date().toISOString() }).eq('id', user.id);
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: nextRole } : u));
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ ${user.name || 'User'} is now ${nextRole}`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to update role', type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
  };

  const handleApproveListing = async (listing) => {
    try {
      await supabase.from('listings').update({ hidden: false, moderated: true, updated_at: new Date().toISOString() }).eq('id', listing.id);
      dispatch({ type: 'UPDATE_LISTING', payload: { ...listing, hidden: false, moderated: true } });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `✅ "${listing.title}" approved`, type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to approve listing', type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
  };

  const confirmDangerAction = (action) => setPendingAction(action);

  const runPendingAction = async () => {
    if (!pendingAction) return;
    const { type, payload } = pendingAction;
    if (type === 'delete-listing') await handleDeleteListing(payload.id, payload.title);
    if (type === 'ban-user') await handleBanUser(payload.id, payload.name);
    if (type === 'unban-user') await handleUnbanUser(payload.id, payload.name);
    if (type === 'toggle-role') await handleToggleAdminRole(payload.user);
    if (type === 'toggle-hide') {
      try {
        await supabase.from('listings').update({ hidden: payload.nextHidden }).eq('id', payload.listing.id);
        dispatch({ type: 'UPDATE_LISTING', payload: { ...payload.listing, hidden: payload.nextHidden } });
      } catch (error) {}
    }
    setPendingAction(null);
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
                      {user.id !== state.currentUser.id && (
                        <>
                          <button
                            className="btn-sm"
                            style={{ background: user.banned ? 'var(--success)' : 'var(--danger)', color: 'white', border: 'none' }}
                            onClick={() => confirmDangerAction({
                              type: user.banned ? 'unban-user' : 'ban-user',
                              payload: { id: user.id, name: user.name }
                            })}
                          >
                            {user.banned ? '✅ Unban' : '🚫 Ban'}
                          </button>
                          <button
                            className="btn-sm btn-secondary"
                            onClick={() => confirmDangerAction({
                              type: 'toggle-role',
                              payload: { user }
                            })}
                          >
                            {user.role === 'admin' ? '↩️ Remove Admin' : '🛡️ Make Admin'}
                          </button>
                        </>
                      )}
                      {user.id === state.currentUser.id && (
                        <span style={{ color: 'var(--gray-400)', fontSize: '0.8rem' }}>You</span>
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
                <div key={listing.id} className="admin-listing-item">
                  <div className="admin-listing-info">
                    <h4>{listing.title}</h4>
                    <p>{listing.description?.substring(0, 80)}...</p>
                    <small>By {listing.seller_name || listing.seller} · {listing.price} · {listing.category}</small>
                  </div>
                  <div className="admin-listing-actions">
                    {listing.url && (
                      <a href={listing.url} target="_blank" rel="noopener noreferrer" className="btn-sm btn-secondary">
                        👁 View
                      </a>
                    )}
                    <button
                      className="btn-sm btn-secondary"
                      onClick={() => confirmDangerAction({
                        type: 'toggle-hide',
                        payload: { listing, nextHidden: !listing.hidden }
                      })}
                    >
                      {listing.hidden ? '👁️ Unhide' : '🙈 Hide'}
                    </button>
                    <button 
                      className="btn-sm" 
                      style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                      onClick={() => confirmDangerAction({
                        type: 'delete-listing',
                        payload: { id: listing.id, title: listing.title }
                      })}
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
        </div>
      )}

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
                    onClick={() => handleApproveListing(listing)}
                  >
                    ✅ Approve
                  </button>
                  <button 
                    className="btn-sm" 
                    style={{ background: 'var(--danger)', color: 'white', border: 'none' }}
                    onClick={() => confirmDangerAction({
                      type: 'delete-listing',
                      payload: { id: listing.id, title: listing.title }
                    })}
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
              { key: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Temporarily disable public access for maintenance' }
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
      <ConfirmDialog
        isOpen={!!pendingAction}
        title="Confirm Action"
        message="Are you sure you want to continue? This action can affect users or content."
        onConfirm={runPendingAction}
        onCancel={() => setPendingAction(null)}
        confirmText="Yes, Continue"
        type="danger"
      />
    </div>
  );
}

// ============================================
// ANALYTICS PAGE
// ============================================
function AnalyticsPage() {
  const { state } = useAppContext();

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

  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>📊 Your Analytics</h1>
        <p>Track your activity and engagement</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-icon">🛒</span>
          <h3>{userListings.length}</h3>
          <p>Your Listings</p>
          <small>{userListings.reduce((sum, l) => sum + (l.views || 0), 0)} total views</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon">📱</span>
          <h3>{userApps.length}</h3>
          <p>Your Apps</p>
          <small>{userApps.reduce((sum, a) => sum + (a.downloads || 0), 0)} downloads</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon">💻</span>
          <h3>{userSnippets.length}</h3>
          <p>Code Snippets</p>
          <small>{userSnippets.reduce((sum, s) => sum + (s.likes || 0), 0)} total likes</small>
        </div>
        <div className="stat-card">
          <span className="stat-icon">💬</span>
          <h3>{userMessages.length}</h3>
          <p>Messages Received</p>
          <small>{userMessages.filter(m => !m.read).length} unread</small>
        </div>
      </div>

      <div className="analytics-charts">
        <div className="chart-container">
          <h3>Listing Performance</h3>
          <div className="chart-placeholder">
            <div className="bar-chart">
              {userListings.slice(0, 5).map((listing, i) => (
                <div key={i} className="bar-item">
                  <div className="bar-label">{listing.title?.substring(0, 20)}</div>
                  <div className="bar-wrapper">
                    <div 
                      className="bar-fill" 
                      style={{ 
                        width: `${Math.min((listing.views || 0) * 10, 100)}%`,
                        background: `hsl(${240 + i * 30}, 70%, 60%)`
                      }}
                    >
                      <span>{listing.views || 0} views</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// ENHANCED MESSAGES WITH REAL-TIME INDICATOR
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
  const messagesEndRef = useRef(null);
  const chatMessagesRef = useRef(null);

  const scrollToBottom = useCallback(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [state.activeConversation, scrollToBottom]);

  // Auto-scroll on new messages only if we're near the bottom
  useEffect(() => {
    if (chatMessagesRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
      if (isNearBottom) scrollToBottom();
    }
  }, [state.messages.length, scrollToBottom]);

  // Real-time: update active conversation when new messages arrive
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

      const { error } = await supabase.from('messages').insert([msgData]);
      
      if (!error) {
        await createNotificationIfEnabled({
          userId: replyingTo.userId,
          message: `💬 New reply from ${state.profile?.name || state.currentUser.email}`,
          type: 'info'
        });
        
        // Refresh messages
        const { data: msgsResult } = await supabase
          .from('messages')
          .select('*')
          .or(`from_user.eq.${state.currentUser.id},to_user.eq.${state.currentUser.id}`)
          .order('created_at', { ascending: false });
        
        if (msgsResult) {
          dispatch({ type: 'SET_MESSAGES', payload: msgsResult });
          buildConversationsLocal(msgsResult, state.currentUser.id);
        }
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
          userName: (msg.from_user === userId ? msg.to_name : msg.from_name) || 'Unknown User',
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
    dispatch({ type: 'MARK_CONVERSATION_READ', payload: conv.userId });
    sessionStorage.setItem('activeConversationId', conv.userId);
    
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

  const activeMessages = (activeConv?.messages || [])
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  return (
    <div className="messages-page">
      <div className="page-header">
        <h1>💬 Messages</h1>
        <p>Your conversations and inquiries</p>
        <div className="realtime-indicator">
          {state.realtimeConnected ? (
            <span className="realtime-badge connected">
              <span className="realtime-pulse"></span> Live
            </span>
          ) : (
            <span className="realtime-badge disconnected">
              <span className="realtime-pulse offline"></span> Reconnecting...
            </span>
          )}
        </div>
      </div>
      
      <div className="messages-layout">
        <div className="conversations-sidebar">
          <h3>Conversations {conversations.length > 0 && <span className="conv-count">{conversations.length}</span>}</h3>
          {loadingMessages ? (
            <div className="conversations-skeleton">
              {[1,2,3,4,5].map(i => <SkeletonMessage key={i} />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-conversations">
              <span>💬</span>
              <p>No conversations yet</p>
              <small>Messages from inquiries will appear here</small>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conv, index) => (
                <div
                  key={conv.userId || index}
                  className={`conversation-item ${activeConv?.userId === conv.userId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => openConversation(conv)}
                >
                  <img 
                    src={conv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.userName || 'User')}&background=667eea&color=fff&size=40`} 
                    alt={conv.userName} 
                    className="conversation-avatar"
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=40`; }}
                  />
                  <div className="conversation-info">
                    <div className="conversation-header">
                      <strong>{conv.userName || 'Unknown User'}</strong>
                      <span className="conversation-time">
                        {new Date(conv.lastMessageTime).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="conversation-preview">
                      {conv.lastMessage?.substring(0, 45)}
                      {conv.lastMessage?.length > 45 ? '...' : ''}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="unread-badge">{conv.unreadCount}</span>
                  )}
                  <button 
                    className="conv-delete-btn"
                    onClick={(e) => confirmDeleteConversation(e, conv)}
                    title="Delete conversation"
                    aria-label="Delete conversation"
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-area-wrapper">
          {activeConv ? (
            <>
              <div className="chat-header">
                <img 
                  src={activeConv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.userName || 'User')}&background=667eea&color=fff&size=40`} 
                  alt={activeConv.userName} 
                  className="chat-avatar"
                />
                <div className="chat-header-info">
                  <strong>{activeConv.userName || 'Unknown User'}</strong>
                  <p>{activeMessages.length} messages{state.realtimeConnected ? ' · Live' : ''}</p>
                </div>
                <button 
                  className="btn-secondary btn-sm chat-delete-btn"
                  onClick={() => { setConvToDelete(activeConv); setShowDeleteConfirm(true); }}
                  title="Delete this conversation"
                >
                  🗑️ Delete
                </button>
              </div>
              <div className="chat-messages-scrollable" ref={chatMessagesRef}>
                {activeMessages.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`chat-message ${msg.from_user === state.currentUser.id ? 'sent' : 'received'} ${msg._optimistic ? 'optimistic' : ''}`}
                  >
                    <div className="message-bubble">
                      <p>{msg.message}</p>
                      <small className="message-time">
                        {new Date(msg.created_at).toLocaleString()}
                        {msg.from_user === state.currentUser.id && (
                          <span className="message-status">
                            {msg._optimistic ? ' ⏳' : msg.read ? ' ✓✓' : ' ✓'}
                          </span>
                        )}
                      </small>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="chat-input-area">
                <textarea
                  placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  className="chat-textarea"
                  rows="2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button 
                  className="btn-primary chat-send-btn" 
                  onClick={handleSendReply} 
                  disabled={sending || !replyMessage.trim()}
                >
                  {sending ? '⏳' : '📤 Send'}
                </button>
              </div>
            </>
          ) : (
            <div className="chat-empty">
              <span className="empty-icon">💬</span>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the sidebar to start chatting.</p>
              {state.realtimeConnected && (
                <p className="realtime-note">🟢 Connected — new messages arrive instantly!</p>
              )}
            </div>
          )}
        </div>
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
    l => l.user_id === state.currentUser.id
  );
  const userApps = (state.apps || []).filter(
    a => a.user_id === state.currentUser.id
  );
  const userSnippets = (state.codeSnippets || []).filter(
    s => s.user_id === state.currentUser.id
  );

  const handleAvatarUpdate = async (avatarUrl) => {
    dispatch({ type: 'UPDATE_AVATAR', payload: avatarUrl });
    
    try {
      const { error } = await supabase.from('profiles').upsert({
        id: state.currentUser.id,
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      
      if (error) {
        console.error('Error saving avatar:', error);
      }
    } catch (error) {
      console.error('Could not save avatar:', error);
    }
    
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: '✅ Profile picture updated successfully!', 
      type: 'success', 
      time: new Date().toLocaleTimeString(), 
      read: false 
    }});
  };

  const handleDeleteAccount = async () => {
    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
      message: '⚠️ Account deletion requires admin approval. Contact support.', 
      type: 'warning', 
      time: new Date().toLocaleTimeString(), 
      read: false 
    }});
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <AvatarUpload 
          currentAvatar={state.profile?.avatar_url} 
          userName={userName} 
          onAvatarUpdate={handleAvatarUpdate}
          size="large"
        />
        <div>
          <h1>{userName}</h1>
          <p>{state.currentUser.email}</p>
          {state.profile?.role && (
            <p className="profile-role">
              <span className="role-icon">
                {state.profile.role === 'developer' ? '👨‍💻' : 
                 state.profile.role === 'admin' ? '🛡️' : '👤'}
              </span>
              {state.profile.role.charAt(0).toUpperCase() + state.profile.role.slice(1)}
            </p>
          )}
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
          <h3>{state.favorites?.length || 0}</h3>
          <p>Favorites</p>
        </div>
      </div>

      <div className="profile-actions">
        <Link to="/analytics" className="btn-secondary">
          📊 View Analytics
        </Link>
        <Link to="/settings" className="btn-secondary">
          ⚙️ Settings
        </Link>
        {state.isAdmin && (
          <Link to="/admin" className="btn-secondary">
            🛡️ Admin Panel
          </Link>
        )}
        <button onClick={handleDeleteAccount} className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
          🗑️ Delete Account
        </button>
      </div>
      
      {userListings.length > 0 && (
        <div className="profile-section">
          <h2>Your Listings ({userListings.length})</h2>
          <div className="listings-grid">
            {userListings.slice(0, 3).map(l => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          {userListings.length > 3 && (
            <button className="btn-text" style={{ marginTop: '16px' }}>
              View all {userListings.length} listings →
            </button>
          )}
        </div>
      )}

      {userApps.length > 0 && (
        <div className="profile-section">
          <h2>Your Apps ({userApps.length})</h2>
          <div className="app-grid">
            {userApps.slice(0, 3).map(app => <AppCard key={app.id} app={app} />)}
          </div>
        </div>
      )}

      {userSnippets.length > 0 && (
        <div className="profile-section">
          <h2>Your Posts ({userSnippets.length})</h2>
          <div className="admin-section-card">
            <div className="activity-list">
              {userSnippets.slice(0, 5).map(snippet => (
                <div key={snippet.id} className="activity-item">
                  <span>💻</span>
                  <div>
                    <strong>{snippet.title}</strong>
                    <p>{snippet.description?.substring(0, 120)}</p>
                  </div>
                  <small>{snippet.language}</small>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// PUBLIC PROFILE + FOLLOW SYSTEM
// ============================================
function PublicProfile() {
  const { userId } = useParams();
  const { state, dispatch } = useAppContext();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (alive) setProfile(data || null);
      } catch (error) {
        if (alive) setProfile(null);
      }
      if (alive) setLoading(false);
    };
    if (userId) load();
    return () => { alive = false; };
  }, [userId]);

  const isOwn = state.currentUser?.id === userId;
  const isFollowing = (state.follows || []).includes(userId);
  const listings = (state.listings || []).filter(l => l.user_id === userId && (!l.hidden || state.isAdmin));
  const apps = (state.apps || []).filter(a => a.user_id === userId);
  const snippets = (state.codeSnippets || []).filter(s => s.user_id === userId);

  const handleFollowToggle = async () => {
    if (!state.currentUser || isOwn) return;
    setBusy(true);
    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', state.currentUser.id).eq('following_id', userId);
        dispatch({ type: 'SET_FOLLOWS', payload: (state.follows || []).filter(id => id !== userId) });
      } else {
        await supabase.from('follows').insert([{ follower_id: state.currentUser.id, following_id: userId, created_at: new Date().toISOString() }]);
        dispatch({ type: 'SET_FOLLOWS', payload: [...(state.follows || []), userId] });
        await logActivity({
          userId: state.currentUser.id,
          type: 'follow',
          title: 'Started following',
          message: `${state.profile?.name || 'A user'} followed ${profile?.name || 'a user'}`,
          targetUserId: userId
        });
        await createNotificationIfEnabled({
          userId,
          message: `👤 ${state.profile?.name || state.currentUser.email} started following you`,
          type: 'info'
        });
      }
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '❌ Failed to update follow status', type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
    setBusy(false);
  };

  if (loading) return <div className="profile-page"><div className="empty-state"><h3>Loading profile...</h3></div></div>;
  if (!profile) return <div className="profile-page"><div className="empty-state"><h3>Profile not found</h3></div></div>;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.name || 'User')}&background=667eea&color=fff&size=120`} alt={profile.name} style={{ width: '110px', height: '110px', borderRadius: '50%' }} />
        <div>
          <h1>{profile.name || 'User'}</h1>
          <p>{profile.bio || 'No bio yet.'}</p>
          {!isOwn && state.currentUser && (
            <button onClick={handleFollowToggle} className="btn-primary" disabled={busy}>
              {busy ? 'Updating...' : isFollowing ? 'Unfollow' : 'Follow'}
            </button>
          )}
        </div>
      </div>

      <div className="profile-stats">
        <div className="stat-box"><h3>{listings.length}</h3><p>Listings</p></div>
        <div className="stat-box"><h3>{apps.length}</h3><p>Apps</p></div>
        <div className="stat-box"><h3>{snippets.length}</h3><p>Snippets</p></div>
      </div>

      {listings.length > 0 && (
        <div className="profile-section">
          <h2>Listings</h2>
          <div className="listings-grid">{listings.slice(0, 6).map(l => <ListingCard key={l.id} listing={l} />)}</div>
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
    let alive = true;
    const load = async () => {
      if (!state.currentUser) return;
      setLoading(true);
      try {
        const { data } = await supabase
          .from('activity_feed')
          .select('*')
          .or(`user_id.eq.${state.currentUser.id},target_user_id.eq.${state.currentUser.id}`)
          .order('created_at', { ascending: false })
          .limit(100);
        if (alive) setFeed(data || []);
      } catch (error) {
        if (alive) setFeed(state.activityFeed || []);
      }
      if (alive) setLoading(false);
    };
    load();
    return () => { alive = false; };
  }, [state.currentUser, state.activityFeed]);

  if (!state.currentUser) return <div className="favorites-page"><div className="empty-state"><h3>Please login to view activity</h3></div></div>;

  return (
    <div className="favorites-page">
      <div className="page-header">
        <h1>📡 Activity Feed</h1>
        <p>Latest actions from your network</p>
      </div>
      {loading ? (
        <div className="empty-state"><p>Loading activity...</p></div>
      ) : feed.length === 0 ? (
        <div className="empty-state"><p>No activity yet.</p></div>
      ) : (
        <div className="admin-section-card">
          <div className="activity-list">
            {feed.map(item => (
              <div key={item.id || `${item.type}-${item.created_at}`} className="activity-item">
                <span>⚡</span>
                <div>
                  <strong>{item.title || item.type || 'Activity'}</strong>
                  <p>{item.message || 'New update available.'}</p>
                </div>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// HOME COMPONENT
// ============================================
function Home() {
  const { state } = useAppContext();
  const navigate = useNavigate();
  const [installPrompt, setInstallPrompt] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };
  
  const stats = {
    listings: (state.listings || []).length,
    apps: (state.apps || []).length,
    snippets: (state.codeSnippets || []).length,
    users: 1250
  };
  
  const featuredListings = (state.listings || [])
    .filter(l => !l.hidden || state.isAdmin)
    .slice(0, 3);

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
            {installPrompt && (
              <button onClick={handleInstallApp} className="btn-secondary btn-large">📱 Download App</button>
            )}
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
  const [showHideConfirm, setShowHideConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [hiding, setHiding] = useState(false);
  const isFavorited = (state.favorites || []).some(f => f.id === listing.id);
  const isOwner = state.currentUser && listing.user_id === state.currentUser.id;
  const isAdmin = state.isAdmin;

  if (listing.hidden && !isAdmin) return null;

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
        
        await createNotificationIfEnabled({
          userId: listing.user_id,
          message: `💬 New inquiry about "${listing.title}" from ${state.profile?.name || state.currentUser.email}`,
          type: 'info'
        });
        
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

  const handleHide = async () => {
    setHiding(true);
    try {
      const { error } = await supabase
        .from('listings')
        .update({ hidden: true })
        .eq('id', listing.id);
      if (error) throw error;
      dispatch({ type: 'HIDE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '🙈 Listing hidden from users', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Failed to hide: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
    setHiding(false);
    setShowHideConfirm(false);
  };

  const handleUnhide = async () => {
    try {
      const { error } = await supabase
        .from('listings')
        .update({ hidden: false })
        .eq('id', listing.id);
      if (error) throw error;
      dispatch({ type: 'UNHIDE_LISTING', payload: listing.id });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '👁️ Listing is now visible', type: 'success', time: new Date().toLocaleTimeString(), read: false } });
    } catch (error) {
      dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `❌ Failed to unhide: ${error.message}`, type: 'error', time: new Date().toLocaleTimeString(), read: false } });
    }
  };

  return (
    <>
      <div className={`listing-card ${listing.hidden ? 'listing-hidden-admin' : ''}`}>
        {listing.hidden && isAdmin && (
          <div className="hidden-badge">🙈 Hidden from users</div>
        )}
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
          {(isOwner || isAdmin) && (
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
              <Link to={`/profile/${listing.user_id}`}>{listing.seller}</Link>
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
            {isAdmin && !isOwner && (
              listing.hidden
                ? <button onClick={handleUnhide} className="btn-sm btn-unhide">👁️ Unhide</button>
                : <button onClick={() => setShowHideConfirm(true)} className="btn-sm btn-hide">🙈 Hide</button>
            )}
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
      <ConfirmDialog
        isOpen={showHideConfirm}
        title="Hide Listing"
        message="Are you sure you want to hide this listing?"
        onConfirm={handleHide}
        onCancel={() => setShowHideConfirm(false)}
        confirmText={hiding ? 'Hiding...' : 'Hide Listing'}
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
  const [visibleCount, setVisibleCount] = useState(12);
  const loadMoreRef = useRef(null);

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
      await logActivity({
        userId: state.currentUser.id,
        type: 'listing_created',
        title: 'New listing posted',
        message: `"${formData.title}" was published`
      });
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
  const visibleListings = filteredListings.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(12);
  }, [searchTerm, sortBy, filterPrice, state.listings?.length]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 12, filteredListings.length));
      }
    }, { rootMargin: '200px' });
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredListings.length]);

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
    <div className="modal-content listing-form-modal" onClick={e => e.stopPropagation()}>
      <div className="listing-form-wrapper">
        <button className="btn-close" onClick={() => setShowForm(false)}>✕</button>
        
        <div className="listing-form-header">
          <span className="listing-form-icon">📢</span>
          <h2>Create New Listing</h2>
          <p>Fill in the details below to list your website or portfolio</p>
        </div>
        
        <form onSubmit={handleSubmit} className="listing-form-styled">
          <div className="form-section">
            <div className="form-section-title">
              <span>📝</span> Basic Information
            </div>
            
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
              <label>Category <span className="required">*</span></label>
              <div className="input-wrapper">
                <span className="input-icon">📂</span>
                <select 
                  className="category-select"
                  value={formData.category} 
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="website">🌐 Website</option>
                  <option value="portfolio">📁 Portfolio</option>
                  <option value="ecommerce">🛍️ E-Commerce</option>
                  <option value="blog">📝 Blog</option>
                  <option value="saas">☁️ SaaS</option>
                  <option value="app">📱 App</option>
                  <option value="other">📦 Other</option>
                </select>
              </div>
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
          </div>
          
          <div className="form-section">
            <div className="form-section-title">
              <span>💰</span> Pricing & Links
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
                <label>Website URL <span className="optional">(optional)</span></label>
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
          </div>
          
          <div className="form-section">
            <div className="form-section-title">
              <span>🖼️</span> Media
            </div>
            
            <div className="form-group">
              <label>Image URL <span className="optional">(optional)</span></label>
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
            
            <div className="file-upload-area" style={{ marginTop: '12px' }}>
              <div className="file-upload-icon">📁</div>
              <div className="file-upload-text">Drag & drop an image or click to browse</div>
              <div className="file-upload-hint">Supported formats: JPG, PNG, GIF, WebP (Max 5MB)</div>
            </div>
          </div>
          
          <div className="listing-form-footer">
            <span className="listing-form-note">
              <span>💡</span> Your listing will be visible to all DevMarket users
            </span>
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
      </div>
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
        {visibleListings.map(listing => (
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
      {visibleCount < filteredListings.length && (
        <div ref={loadMoreRef} className="infinite-loader">Loading more listings...</div>
      )}
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
      await logActivity({
        userId: state.currentUser.id,
        type: 'app_created',
        title: 'New app published',
        message: `"${formData.appName}" was published`
      });
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
        
        await createNotificationIfEnabled({
          userId: app.user_id,
          message: `💬 New inquiry about "${app.appName}" from ${state.profile?.name || state.currentUser.email}`,
          type: 'info'
        });
        
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
      await logActivity({
        userId: state.currentUser.id,
        type: 'snippet_created',
        title: 'New snippet shared',
        message: `"${formData.title}" was shared`
      });
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
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [showComments, setShowComments] = useState(false);
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

  useEffect(() => {
    let alive = true;
    const loadComments = async () => {
      try {
        const { data } = await supabase
          .from('snippet_comments')
          .select('*')
          .eq('snippet_id', snippet.id)
          .order('created_at', { ascending: false })
          .limit(20);
        if (alive) setComments(data || []);
      } catch (error) {
        if (alive) setComments([]);
      }
    };
    if (showComments) loadComments();
    return () => { alive = false; };
  }, [snippet.id, showComments]);

  const handleAddComment = async () => {
    if (!state.currentUser || !commentText.trim()) return;
    const payload = {
      snippet_id: snippet.id,
      user_id: state.currentUser.id,
      author_name: state.profile?.name || state.currentUser.email,
      message: commentText.trim(),
      created_at: new Date().toISOString()
    };
    setComments(prev => [payload, ...prev]);
    setCommentText('');
    try {
      await supabase.from('snippet_comments').insert([payload]);
    } catch (error) {}
  };

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
            <button onClick={() => setShowComments(v => !v)} className="btn-copy" aria-label="Toggle comments">
              💬 {showComments ? 'Hide' : 'Comments'}
            </button>
          </div>
        </div>
        {showComments && (
          <div className="snippet-comments">
            <div className="snippet-comment-input">
              <input
                type="text"
                placeholder={state.currentUser ? 'Write a comment...' : 'Login to comment'}
                value={commentText}
                disabled={!state.currentUser}
                onChange={e => setCommentText(e.target.value)}
              />
              <button className="btn-primary btn-sm" onClick={handleAddComment} disabled={!commentText.trim() || !state.currentUser}>
                Post
              </button>
            </div>
            <div className="snippet-comment-list">
              {comments.length === 0 ? <small>No comments yet.</small> : comments.map((c, idx) => (
                <div key={c.id || `${c.created_at}-${idx}`} className="snippet-comment-item">
                  <strong>{c.author_name || 'User'}</strong>
                  <p>{c.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
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
    allNotifications: state.notificationsEnabled !== false,
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

  useEffect(() => {
    setNotificationPrefs(prev => ({
      ...prev,
      allNotifications: state.notificationsEnabled !== false
    }));
  }, [state.notificationsEnabled]);

  useEffect(() => {
    if (state.profile?.notification_preferences && typeof state.profile.notification_preferences === 'object') {
      setNotificationPrefs(prev => ({
        ...prev,
        ...state.profile.notification_preferences,
        allNotifications: state.notificationsEnabled !== false
      }));
    }
  }, [state.profile, state.notificationsEnabled]);

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

  const handleNotificationPreferencesSave = async () => {
    const enabled = notificationPrefs.allNotifications !== false;
    localStorage.setItem('devMarketNotificationsEnabled', enabled ? 'true' : 'false');
    dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: enabled });
    if (!enabled) {
      dispatch({ type: 'CLEAR_NOTIFICATIONS' });
    }

    try {
      await supabase.from('profiles').upsert({
        id: state.currentUser.id,
        notifications_enabled: enabled,
        notification_preferences: notificationPrefs,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (error) {
      console.error('Could not save notification preferences:', error);
    }

    dispatch({ type: 'ADD_NOTIFICATION', payload: {
      message: '✅ Notification preferences saved!',
      type: 'success',
      time: new Date().toLocaleTimeString(),
      read: false
    }});
  };

  const handleMasterNotificationToggle = async () => {
    const nextEnabled = !notificationPrefs.allNotifications;
    setNotificationPrefs(prev => ({ ...prev, allNotifications: nextEnabled }));
    localStorage.setItem('devMarketNotificationsEnabled', nextEnabled ? 'true' : 'false');
    dispatch({ type: 'SET_NOTIFICATIONS_ENABLED', payload: nextEnabled });
    if (!nextEnabled) dispatch({ type: 'CLEAR_NOTIFICATIONS' });

    try {
      await supabase.from('profiles').upsert({
        id: state.currentUser.id,
        notifications_enabled: nextEnabled,
        notification_preferences: { ...notificationPrefs, allNotifications: nextEnabled },
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
    } catch (error) {
      console.error('Could not persist master notification toggle:', error);
    }
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

                <div className="setting-item master-toggle">
                  <div className="setting-info">
                    <strong>All Notifications</strong>
                    <p>Completely enable or disable all notifications.</p>
                  </div>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={notificationPrefs.allNotifications}
                      onChange={handleMasterNotificationToggle}
                    />
                    <span className="toggle-slider"></span>
                  </label>
                </div>

                <div className={`notification-settings ${!notificationPrefs.allNotifications ? 'disabled-section' : ''}`}>
                  {Object.entries(notificationPrefs).filter(([key]) => key !== 'allNotifications').map(([key, value]) => (
                    <div className="setting-item" key={key}>
                      <div className="setting-info">
                        <strong>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</strong>
                      </div>
                      <label className="toggle-switch">
                        <input
                          type="checkbox"
                          checked={value && notificationPrefs.allNotifications}
                          disabled={!notificationPrefs.allNotifications}
                          onChange={() => setNotificationPrefs({ ...notificationPrefs, [key]: !value })}
                        />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={handleNotificationPreferencesSave}
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
        <p className="footer-copy">&copy; {currentYear} DevMarket</p>
      </div>
    </footer>
  );
}

export default App;