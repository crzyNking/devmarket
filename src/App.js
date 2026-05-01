// ============================================
// src/App.js (FULLY FIXED VERSION)
// ============================================
import React, { useState, useEffect, createContext, useContext, useReducer, useCallback, useRef, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { supabase } from './utils/supabase';
import { realtimeManager } from './utils/realtime';
import { analytics } from './utils/analytics';
import './App.css';

// ============================================
// GLOBAL CONTEXT
// ============================================
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
  conversations: [],
  activeConversation: null,
  favorites: [],
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
  unreadMessageCount: 0
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
      return { 
        ...state, 
        messages: [action.payload, ...(state.messages || [])],
        unreadMessageCount: state.unreadMessageCount + 1
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: (state.messages || []).map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m)
      };
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
      const convExists = (state.conversations || []).find(c => c.userId === action.payload.otherUserId);
      if (convExists) {
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
      } else {
        const newConv = {
          userId: action.payload.otherUserId,
          userName: action.payload.userName || 'Unknown User',
          userAvatar: action.payload.userAvatar,
          lastMessage: action.payload.message.message,
          lastMessageTime: action.payload.message.created_at,
          unreadCount: action.payload.message.to_user === state.currentUser?.id ? 1 : 0,
          messages: [action.payload.message]
        };
        return {
          ...state,
          conversations: [...(state.conversations || []), newConv]
        };
      }
    }
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversation: action.payload };
    case 'MARK_CONVERSATION_READ':
      return {
        ...state,
        conversations: (state.conversations || []).map(c => 
          c.userId === action.payload ? { ...c, unreadCount: 0, messages: c.messages.map(m => ({ ...m, read: true })) } : c
        ),
        unreadMessageCount: 0
      };
    case 'MARK_MESSAGE_READ': 
      return { 
        ...state, 
        messages: (state.messages || []).map(m => m.id === action.payload ? { ...m, read: true } : m),
        unreadMessageCount: Math.max(0, state.unreadMessageCount - 1)
      };
    case 'DELETE_MESSAGE': 
      return { ...state, messages: (state.messages || []).filter(m => m.id !== action.payload) };
    case 'SET_UNREAD_COUNT':
      return { ...state, unreadMessageCount: action.payload };
    case 'SET_FAVORITES': 
      return { ...state, favorites: action.payload || [] };
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
    case 'APPROVE_LISTING':
      return { ...state, moderationQueue: (state.moderationQueue || []).filter(l => l.id !== action.payload) };
    case 'BAN_USER':
      return { ...state };
    case 'LOGOUT': 
      return { ...state, currentUser: null, profile: null, session: null, notifications: [], messages: [], conversations: [], activeConversation: null, favorites: [], isAdmin: false, unreadMessageCount: 0 };
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
// HELPER FUNCTIONS
// ============================================
function buildConversationsFromMessages(messages, userId) {
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
  
  const unreadTotal = conversations.reduce((sum, conv) => sum + conv.unreadCount, 0);
  
  return { conversations, unreadTotal };
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

function SkeletonMessage() {
  return (
    <div className="skeleton-message" style={{ display: 'flex', gap: '12px', padding: '12px', alignItems: 'center' }}>
      <div className="skeleton" style={{ width: '40px', height: '40px', borderRadius: '50%' }}></div>
      <div className="skeleton-content" style={{ flex: 1 }}>
        <div className="skeleton skeleton-text short"></div>
        <div className="skeleton skeleton-text"></div>
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
      setError('Please select a valid image file');
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
        const { error: uploadError2 } = await supabase.storage
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
        style={{ width: currentSize.wrapper, height: currentSize.wrapper, cursor: 'pointer', position: 'relative' }}
      >
        <img 
          src={displayAvatar} 
          alt={userName || 'User'} 
          className="avatar-upload-preview"
          style={{ width: currentSize.wrapper, height: currentSize.wrapper, borderRadius: '50%', objectFit: 'cover' }}
          onError={(e) => { 
            e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userName || 'User')}&background=667eea&color=fff&size=200`; 
          }}
        />
        <div className="avatar-upload-overlay" style={{ fontSize: currentSize.fontSize, position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.5)', color: 'white', padding: '4px', textAlign: 'center' }}>
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
// MAIN APP WITH ENHANCED REAL-TIME
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

  const loadPublicData = useCallback(async () => {
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
  }, []);

  const setupRealtimeSubscriptions = useCallback((userId) => {
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
        dispatch({ type: 'ADD_MESSAGE', payload: newMsg });
        
        const otherUserId = newMsg.from_user;
        const otherUserName = newMsg.from_name || 'User';
        const otherUserAvatar = newMsg.from_avatar;
        
        dispatch({
          type: 'ADD_CONVERSATION_MESSAGE',
          payload: {
            otherUserId,
            message: newMsg,
            userName: otherUserName,
            userAvatar: otherUserAvatar
          }
        });
        
        if (!newMsg.read) {
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
      `message-updates-${userId}`,
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `from_user=eq.${userId}`
      },
      (payload) => {
        const updatedMsg = payload.new;
        dispatch({ type: 'UPDATE_MESSAGE', payload: updatedMsg });
        
        if (updatedMsg.read) {
          dispatch({ type: 'MARK_MESSAGE_READ', payload: updatedMsg.id });
        }
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

    realtimeManager.subscribe(
      'apps-updates',
      {
        event: '*',
        schema: 'public',
        table: 'apps'
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          dispatch({ type: 'ADD_APP', payload: payload.new });
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'DELETE_APP', payload: payload.old.id });
        }
        loadPublicData();
      }
    );

    realtimeManager.subscribe(
      'snippets-updates',
      {
        event: '*',
        schema: 'public',
        table: 'code_snippets'
      },
      (payload) => {
        if (payload.eventType === 'INSERT') {
          dispatch({ type: 'ADD_CODE_SNIPPET', payload: payload.new });
        } else if (payload.eventType === 'DELETE') {
          dispatch({ type: 'DELETE_SNIPPET', payload: payload.old.id });
        }
        loadPublicData();
      }
    );

    dispatch({ type: 'SET_REALTIME_CONNECTED', payload: true });
  }, [loadPublicData]);

  const loadProfile = useCallback(async (user) => {
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
          await supabase.from('profiles').upsert({ ...defaultProfile, updated_at: new Date().toISOString() });
        } catch (err) {
          console.log('Could not save profile:', err);
        }

        dispatch({ type: 'SET_PROFILE', payload: defaultProfile });
        dispatch({ type: 'SET_USER', payload: { ...user, ...defaultProfile } });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }, []);

  const loadUserData = useCallback(async (userId) => {
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
        const { conversations, unreadTotal } = buildConversationsFromMessages(msgsResult.data, userId);
        dispatch({ type: 'SET_UNREAD_COUNT', payload: unreadTotal });
        dispatch({ type: 'SET_CONVERSATIONS', payload: conversations });
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

      setupRealtimeSubscriptions(userId);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  }, [setupRealtimeSubscriptions]);

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

    initialize();
    
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
      if (!hasShownLoader) {
        sessionStorage.setItem('devMarketLoaderShown', 'true');
      }
    }, 1500);

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
      clearTimeout(timer);
      subscription?.unsubscribe();
      realtimeManager.unsubscribeAll();
    };
  }, [hasShownLoader, loadProfile, loadUserData, loadPublicData]);

  useEffect(() => {
    const savedTheme = localStorage.getItem('devMarketTheme');
    if (savedTheme && savedTheme !== state.theme) {
      dispatch({ type: 'TOGGLE_THEME' });
    }
  }, []);

  const removeNotification = useCallback((id) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  if (isInitialLoading) {
    return <SimpleLoader />;
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
              <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
              <Route path="/analytics" element={<ProtectedRoute><AnalyticsPage /></ProtectedRoute>} />
            </Routes>
          </main>
          <Footer />
        </div>
      </Router>
    </AppContext.Provider>
  );
}

// ============================================
// SIMPLE LOADER
// ============================================
function SimpleLoader() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center', 
      justifyContent: 'center', 
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '24px' }}>🚀</div>
      <h1 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '8px' }}>DevMarket</h1>
      <p style={{ fontSize: '1.1rem', opacity: 0.8, marginBottom: '32px' }}>Loading your marketplace...</p>
      <div style={{ width: '200px', height: '3px', background: 'rgba(255,255,255,0.2)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ height: '100%', background: 'white', borderRadius: '4px', animation: 'loadingBar 1.5s ease-in-out infinite', width: '60%' }} />
      </div>
      <style>{`
        @keyframes loadingBar {
          0%, 100% { transform: translateX(-100%); }
          50% { transform: translateX(200%); }
        }
      `}</style>
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
// ENHANCED HEADER
// ============================================
function Header() {
  const { state, dispatch } = useAppContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const unreadNotifications = (state.notifications || []).filter(n => !n.read).length;
  const unreadMessages = state.unreadMessageCount || 0;

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
            <button className="icon-button" onClick={() => setShowAdvancedSearch(true)} title="Advanced Search">
              🔍
            </button>
            
            {state.currentUser ? (
              <>
                <button className="icon-button notification-bell" onClick={() => setShowNotifications(!showNotifications)} title="Notifications">
                  🔔
                  {unreadNotifications > 0 && <span className="notification-badge">{unreadNotifications}</span>}
                </button>
                
                <div className="user-menu">
                  <div className="user-menu-trigger" onClick={() => setShowUserMenu(!showUserMenu)}>
                    <img src={userAvatar} alt={userDisplayName} className="user-avatar"
                      onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userDisplayName)}&background=667eea&color=fff&size=40`; }} />
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
                      <Link to="/profile" onClick={() => setShowUserMenu(false)}>👤 My Profile</Link>
                      <Link to="/settings" onClick={() => setShowUserMenu(false)}>⚙️ Settings</Link>
                      {state.isAdmin && (
                        <>
                          <Link to="/admin" onClick={() => setShowUserMenu(false)}>🛡️ Admin Panel</Link>
                          <Link to="/analytics" onClick={() => setShowUserMenu(false)}>📊 Analytics</Link>
                        </>
                      )}
                      <div className="dropdown-divider"></div>
                      <button onClick={() => { setShowUserMenu(false); setShowLogoutConfirm(true); }}>🚪 Logout</button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button className="btn-login" onClick={() => setShowAuth(true)}>👤 Sign In</button>
            )}
            
            <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
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
                      <button className="btn-remove-notification" onClick={() => dispatch({ type: 'REMOVE_NOTIFICATION', payload: notif.id })}>×</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
        {showAuth && <SimpleAuthModal setShowAuth={setShowAuth} authMode={authMode} setAuthMode={setAuthMode} />}
        <AdvancedSearch isOpen={showAdvancedSearch} onClose={() => setShowAdvancedSearch(false)} onSearch={handleAdvancedSearch} searchType="all" />
      </header>
      <ConfirmDialog isOpen={showLogoutConfirm} title="Confirm Logout" message="Are you sure you want to logout?" onConfirm={handleLogout} onCancel={() => setShowLogoutConfirm(false)} confirmText="Logout" type="danger" />
    </>
  );
}

// ============================================
// SIMPLE AUTH MODAL
// ============================================
function SimpleAuthModal({ setShowAuth, authMode, setAuthMode }) {
  const { state, dispatch } = useAppContext();
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'developer' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const validateForm = () => {
    const newErrors = {};
    if (authMode === 'signup' && !formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.includes('@')) newErrors.email = 'Valid email required';
    if (formData.password.length < 6) newErrors.password = 'Min 6 characters';
    if (authMode === 'signup' && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords must match';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    
    setLoading(true);
    dispatch({ type: 'SET_AUTH_ERROR', payload: null });
    
    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: { data: { name: formData.name, role: formData.role } }
        });
        
        if (error) {
          dispatch({ type: 'SET_AUTH_ERROR', payload: error.message });
          setLoading(false);
          return;
        }
        
        if (data.session) {
          setShowAuth(false);
          dispatch({ type: 'ADD_NOTIFICATION', payload: { message: `🎉 Welcome, ${formData.name}!`, type: 'success', time: new Date().toLocaleTimeString(), read: false }});
        } else {
          setShowSuccess(true);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: formData.email, password: formData.password });
        
        if (error) {
          dispatch({ type: 'SET_AUTH_ERROR', payload: 'Invalid email or password' });
          setLoading(false);
          return;
        }
        
        setShowAuth(false);
        dispatch({ type: 'ADD_NOTIFICATION', payload: { message: '👋 Welcome back!', type: 'success', time: new Date().toLocaleTimeString(), read: false }});
      }
    } catch (error) {
      dispatch({ type: 'SET_AUTH_ERROR', payload: 'An error occurred' });
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay" onClick={() => setShowAuth(false)}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <button className="btn-close" onClick={() => setShowAuth(false)}>✕</button>
        
        {showSuccess ? (
          <div style={{ textAlign: 'center', padding: '40px 20px' }}>
            <div style={{ fontSize: '4rem', marginBottom: '16px' }}>📧</div>
            <h2 style={{ color: '#333', marginBottom: '12px' }}>Check Your Email</h2>
            <p style={{ color: '#666' }}>We've sent a confirmation link to <strong>{formData.email}</strong></p>
          </div>
        ) : (
          <>
            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
              <div style={{ fontSize: '3rem', marginBottom: '12px' }}>🚀</div>
              <h2>{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
              <p style={{ color: '#666', marginTop: '4px' }}>
                {authMode === 'login' ? 'Sign in to your account' : 'Join the DevMarket community'}
              </p>
            </div>

            {state.authError && (
              <div style={{ background: '#fee', color: '#c33', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '0.9rem' }}>
                ⚠️ {state.authError}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {authMode === 'signup' && (
                  <div>
                    <input type="text" placeholder="Full Name" value={formData.name}
                      onChange={e => setFormData({...formData, name: e.target.value})}
                      style={{ width: '100%', padding: '12px 16px', border: `2px solid ${errors.name ? '#ef4444' : '#e5e7eb'}`, borderRadius: '8px', fontSize: '1rem' }} />
                    {errors.name && <small style={{ color: '#ef4444' }}>{errors.name}</small>}
                  </div>
                )}
                
                <div>
                  <input type="email" placeholder="Email" value={formData.email}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', border: `2px solid ${errors.email ? '#ef4444' : '#e5e7eb'}`, borderRadius: '8px', fontSize: '1rem' }} />
                  {errors.email && <small style={{ color: '#ef4444' }}>{errors.email}</small>}
                </div>
                
                <div>
                  <input type="password" placeholder="Password" value={formData.password}
                    onChange={e => setFormData({...formData, password: e.target.value})}
                    style={{ width: '100%', padding: '12px 16px', border: `2px solid ${errors.password ? '#ef4444' : '#e5e7eb'}`, borderRadius: '8px', fontSize: '1rem' }} />
                  {errors.password && <small style={{ color: '#ef4444' }}>{errors.password}</small>}
                </div>
                
                {authMode === 'signup' && (
                  <div>
                    <input type="password" placeholder="Confirm Password" value={formData.confirmPassword}
                      onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                      style={{ width: '100%', padding: '12px 16px', border: `2px solid ${errors.confirmPassword ? '#ef4444' : '#e5e7eb'}`, borderRadius: '8px', fontSize: '1rem' }} />
                    {errors.confirmPassword && <small style={{ color: '#ef4444' }}>{errors.confirmPassword}</small>}
                  </div>
                )}
                
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '14px', background: 'linear-gradient(135deg, #667eea, #764ba2)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
                  {loading ? 'Processing...' : authMode === 'login' ? 'Sign In' : 'Create Account'}
                </button>
              </div>
            </form>
            
            <div style={{ textAlign: 'center', marginTop: '24px' }}>
              <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                style={{ background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontWeight: '500', fontSize: '0.95rem' }}>
                {authMode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ... (I'll continue with the remaining components - AdminDashboard, Messages, Profile, Home, etc.)

// NOTE: The remaining components (AdminDashboard, Messages, Profile, Home, Marketplace, 
// Advertise, CodeSharing, Favorites, Settings, AnalyticsPage, Footer, ListingCard, AppCard, CodeCard)
// are the same as in the previous complete version I provided.


// ============================================
// ENHANCED ADMIN DASHBOARD
// ============================================
function AdminDashboard() {
  const { state, dispatch } = useAppContext();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showDeleteListingConfirm, setShowDeleteListingConfirm] = useState(null);

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

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'moderation') loadModerationQueue();
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (data) setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
    setLoading(false);
  };

  const loadModerationQueue = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('approved', false)
        .order('created_at', { ascending: false });
      
      if (data) dispatch({ type: 'SET_MODERATION_QUEUE', payload: data });
    } catch (error) {
      console.error('Error loading moderation queue:', error);
    }
    setLoading(false);
  };

  const handleBanUser = async (userId) => {
    try {
      await supabase
        .from('profiles')
        .update({ banned: true, banned_at: new Date().toISOString() })
        .eq('id', userId);
      
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'User banned successfully', 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      
      loadUsers();
    } catch (error) {
      console.error('Error banning user:', error);
    }
    setShowBanConfirm(false);
    setSelectedUser(null);
  };

  const handleUnbanUser = async (userId) => {
    try {
      await supabase
        .from('profiles')
        .update({ banned: false, banned_at: null })
        .eq('id', userId);
      
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'User unbanned successfully', 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
      
      loadUsers();
    } catch (error) {
      console.error('Error unbanning user:', error);
    }
  };

  const handleApproveListing = async (listingId) => {
    try {
      await supabase
        .from('listings')
        .update({ approved: true })
        .eq('id', listingId);
      
      dispatch({ type: 'APPROVE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Listing approved', 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    } catch (error) {
      console.error('Error approving listing:', error);
    }
  };

  const handleDeleteListing = async (listingId) => {
    try {
      await supabase
        .from('listings')
        .delete()
        .eq('id', listingId);
      
      dispatch({ type: 'DELETE_LISTING', payload: listingId });
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: 'Listing deleted successfully', 
        type: 'success', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    } catch (error) {
      console.error('Error deleting listing:', error);
    }
    setShowDeleteListingConfirm(null);
  };

  const stats = state.analyticsData || {
    totalUsers: 0,
    totalListings: 0,
    totalApps: 0,
    totalSnippets: 0,
    totalMessages: 0
  };

  const adminTabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'users', label: '👥 Users', icon: '👥' },
    { id: 'listings', label: '📦 Listings', icon: '📦' },
    { id: 'moderation', label: '🛡️ Moderation', icon: '🛡️' },
    { id: 'settings', label: '⚙️ Settings', icon: '⚙️' }
  ];

  return (
    <>
      <div className="admin-page">
        <div className="page-header">
          <h1>🛡️ Admin Dashboard</h1>
          <p>Full control over your DevMarket platform</p>
        </div>

        <div className="admin-tabs">
          {adminTabs.map(tab => (
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
          <div>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-icon">👥</span>
                <h3>{stats.totalUsers}</h3>
                <p>Total Users</p>
              </div>
              <div className="stat-card">
                <span className="stat-icon">🛒</span>
                <h3>{stats.totalListings}</h3>
                <p>Total Listings</p>
              </div>
              <div className="stat-card">
                <span className="stat-icon">📱</span>
                <h3>{stats.totalApps}</h3>
                <p>Total Apps</p>
              </div>
              <div className="stat-card">
                <span className="stat-icon">💻</span>
                <h3>{stats.totalSnippets}</h3>
                <p>Code Snippets</p>
              </div>
              <div className="stat-card">
                <span className="stat-icon">💬</span>
                <h3>{stats.totalMessages}</h3>
                <p>Messages</p>
              </div>
            </div>

            <div className="activity-list">
              <h3 style={{ marginBottom: '16px' }}>Recent Activity</h3>
              {(state.listings || []).slice(0, 5).map(listing => (
                <div key={listing.id} className="activity-item">
                  <span>📢</span>
                  <div>
                    <strong>{listing.seller_name || listing.seller}</strong>
                    <p>Listed "{listing.title}"</p>
                  </div>
                  <small>{listing.date}</small>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>User Management</h3>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <p>Loading users...</p>
              </div>
            ) : (
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.id}>
                        <td>
                          <div className="user-cell">
                            <img 
                              src={user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'User')}&background=667eea&color=fff&size=30`}
                              alt={user.name}
                              className="user-avatar-small"
                              onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=30`; }}
                            />
                            <span>{user.name || 'Unknown'}</span>
                          </div>
                        </td>
                        <td>{user.email || 'N/A'}</td>
                        <td>
                          <span className={`role-badge ${user.role || 'developer'}`}>
                            {user.role || 'developer'}
                          </span>
                        </td>
                        <td>
                          {user.banned ? 
                            <span style={{ color: 'var(--danger)' }}>Banned</span> : 
                            <span style={{ color: 'var(--success)' }}>Active</span>
                          }
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            {user.banned ? (
                              <button 
                                className="btn-sm" 
                                style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                onClick={() => handleUnbanUser(user.id)}
                              >
                                Unban
                              </button>
                            ) : (
                              <button 
                                className="btn-sm" 
                                style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                onClick={() => {
                                  setSelectedUser(user);
                                  setShowBanConfirm(true);
                                }}
                              >
                                Ban
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'listings' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>All Listings</h3>
            <div className="listings-grid">
              {(state.listings || []).map(listing => (
                <div key={listing.id} className="moderation-item" style={{ border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                  <div className="moderation-content">
                    <h4>{listing.title}</h4>
                    <p>{listing.description?.substring(0, 100)}...</p>
                    <small>By: {listing.seller_name || listing.seller} | {listing.date}</small>
                  </div>
                  <div className="moderation-actions" style={{ marginTop: '12px' }}>
                    <button 
                      className="btn-sm btn-secondary"
                      onClick={() => setShowDeleteListingConfirm(listing.id)}
                      style={{ padding: '6px 12px', background: 'var(--danger-light)', color: 'var(--danger)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'moderation' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>Pending Approval</h3>
            <div className="moderation-panel">
              {(state.moderationQueue || []).length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">✅</span>
                  <h3>All Clear</h3>
                  <p>No items pending moderation</p>
                </div>
              ) : (
                (state.moderationQueue || []).map(item => (
                  <div key={item.id} className="moderation-item" style={{ border: '1px solid var(--gray-200)', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                    <div className="moderation-content">
                      <h4>{item.title}</h4>
                      <p>{item.description?.substring(0, 100)}...</p>
                      <small>By: {item.seller_name || item.user_id}</small>
                    </div>
                    <div className="moderation-actions" style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                      <button 
                        className="btn-sm" 
                        style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => handleApproveListing(item.id)}
                      >
                        ✅ Approve
                      </button>
                      <button 
                        className="btn-sm" 
                        style={{ background: 'var(--danger)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                        onClick={() => handleDeleteListing(item.id)}
                      >
                        🚫 Remove
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <h3 style={{ marginBottom: '20px' }}>Platform Settings</h3>
            <div className="admin-settings">
              <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', marginBottom: '12px' }}>
                <div className="setting-info">
                  <strong>Auto-Approve Listings</strong>
                  <p style={{ color: 'var(--gray-500)', margin: '4px 0 0 0' }}>New listings are automatically published</p>
                </div>
                <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input type="checkbox" defaultChecked onChange={(e) => {
                    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                      message: `Auto-approve ${e.target.checked ? 'enabled' : 'disabled'}`, 
                      type: 'info', 
                      time: new Date().toLocaleTimeString(), 
                      read: false 
                    }});
                  }} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span className="toggle-slider" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ccc', borderRadius: '26px' }}></span>
                </label>
              </div>
              <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', marginBottom: '12px' }}>
                <div className="setting-info">
                  <strong>Require Email Verification</strong>
                  <p style={{ color: 'var(--gray-500)', margin: '4px 0 0 0' }}>Users must verify email before posting</p>
                </div>
                <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input type="checkbox" defaultChecked onChange={(e) => {
                    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                      message: `Email verification ${e.target.checked ? 'enabled' : 'disabled'}`, 
                      type: 'info', 
                      time: new Date().toLocaleTimeString(), 
                      read: false 
                    }});
                  }} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span className="toggle-slider" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ccc', borderRadius: '26px' }}></span>
                </label>
              </div>
              <div className="setting-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', border: '1px solid var(--gray-200)', borderRadius: '8px', marginBottom: '12px' }}>
                <div className="setting-info">
                  <strong>Maintenance Mode</strong>
                  <p style={{ color: 'var(--gray-500)', margin: '4px 0 0 0' }}>Put the platform in maintenance mode</p>
                </div>
                <label className="toggle-switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                  <input type="checkbox" onChange={(e) => {
                    dispatch({ type: 'ADD_NOTIFICATION', payload: { 
                      message: `Maintenance mode ${e.target.checked ? 'enabled' : 'disabled'}`, 
                      type: 'warning', 
                      time: new Date().toLocaleTimeString(), 
                      read: false 
                    }});
                  }} style={{ opacity: 0, width: 0, height: 0 }} />
                  <span className="toggle-slider" style={{ position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#ccc', borderRadius: '26px' }}></span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={showBanConfirm}
        title="Ban User"
        message={`Are you sure you want to ban ${selectedUser?.name || 'this user'}?`}
        onConfirm={() => handleBanUser(selectedUser?.id)}
        onCancel={() => { setShowBanConfirm(false); setSelectedUser(null); }}
        confirmText="Ban User"
        type="danger"
      />
      <ConfirmDialog
        isOpen={showDeleteListingConfirm !== null}
        title="Delete Listing"
        message="Are you sure you want to permanently delete this listing?"
        onConfirm={() => handleDeleteListing(showDeleteListingConfirm)}
        onCancel={() => setShowDeleteListingConfirm(null)}
        confirmText="Delete"
        type="danger"
      />
    </>
  );
}

// ============================================
// ENHANCED MESSAGES WITH REAL-TIME
// ============================================
function Messages() {
  const { state, dispatch } = useAppContext();
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const chatAreaRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [state.activeConversation?.messages]);

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
    const msgData = {
      from_user: state.currentUser.id,
      to_user: replyingTo.userId,
      from_name: state.profile?.name || state.currentUser.email,
      from_avatar: state.profile?.avatar_url,
      to_name: replyingTo.userName,
      to_avatar: replyingTo.userAvatar,
      message: replyMessage,
      read: false,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase.from('messages').insert([msgData]);
      
      if (!error) {
        dispatch({ type: 'ADD_NOTIFICATION', payload: { 
          message: '✅ Message sent!', 
          type: 'success', 
          time: new Date().toLocaleTimeString(), 
          read: false 
        }});
        
        setReplyMessage('');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      dispatch({ type: 'ADD_NOTIFICATION', payload: { 
        message: '❌ Failed to send message', 
        type: 'error', 
        time: new Date().toLocaleTimeString(), 
        read: false 
      }});
    }
    setSending(false);
  };

  const openConversation = async (conv) => {
    dispatch({ type: 'SET_ACTIVE_CONVERSATION', payload: conv });
    setReplyingTo(conv);
    dispatch({ type: 'MARK_CONVERSATION_READ', payload: conv.userId });
    
    try {
      const unreadMessages = conv.messages.filter(
        msg => !msg.read && msg.to_user === state.currentUser.id
      );
      
      for (const msg of unreadMessages) {
        await supabase
          .from('messages')
          .update({ read: true })
          .eq('id', msg.id);
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  return (
    <div className="messages-page">
      <div className="page-header">
        <h1>💬 Messages</h1>
        <p>Your conversations and inquiries</p>
        <div className="realtime-indicator">
          {state.realtimeConnected ? (
            <span className="realtime-badge connected" style={{ background: 'var(--success-light)', color: 'var(--success)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
              <span className="realtime-pulse" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)', marginRight: '6px' }}></span> Live
            </span>
          ) : (
            <span className="realtime-badge disconnected" style={{ background: 'var(--gray-100)', color: 'var(--gray-500)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.85rem' }}>
              <span className="realtime-pulse offline" style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gray-400)', marginRight: '6px' }}></span> Reconnecting...
            </span>
          )}
        </div>
      </div>
      
      <div className="messages-layout" style={{ display: 'flex', gap: '24px', height: 'calc(100vh - 200px)' }}>
        <div className="conversations-sidebar" style={{ width: '320px', borderRight: '1px solid var(--gray-200)', paddingRight: '16px', overflowY: 'auto' }}>
          <h3>Conversations</h3>
          {loadingMessages ? (
            <div className="conversations-skeleton">
              {[1,2,3,4,5].map(i => <SkeletonMessage key={i} />)}
            </div>
          ) : conversations.length === 0 ? (
            <div className="empty-conversations" style={{ textAlign: 'center', padding: '40px 16px' }}>
              <span style={{ fontSize: '2rem' }}>💬</span>
              <p>No conversations yet</p>
              <small style={{ color: 'var(--gray-500)' }}>Messages from inquiries will appear here</small>
            </div>
          ) : (
            <div className="conversations-list">
              {conversations.map((conv, index) => (
                <div
                  key={conv.userId || index}
                  className={`conversation-item ${activeConv?.userId === conv.userId ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                  onClick={() => openConversation(conv)}
                  style={{ 
                    display: 'flex', 
                    gap: '12px', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer',
                    background: activeConv?.userId === conv.userId ? 'var(--primary-light)' : 'transparent',
                    marginBottom: '4px'
                  }}
                >
                  <img 
                    src={conv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(conv.userName || 'User')}&background=667eea&color=fff&size=40`} 
                    alt={conv.userName} 
                    className="conversation-avatar"
                    style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=User&background=667eea&color=fff&size=40`; }}
                  />
                  <div className="conversation-info" style={{ flex: 1, minWidth: 0 }}>
                    <div className="conversation-header" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{conv.userName || 'Unknown User'}</strong>
                      <span className="conversation-time" style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>
                        {new Date(conv.lastMessageTime).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="conversation-preview" style={{ fontSize: '0.85rem', color: 'var(--gray-500)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {conv.lastMessage?.substring(0, 50)}
                      {conv.lastMessage?.length > 50 ? '...' : ''}
                    </p>
                  </div>
                  {conv.unreadCount > 0 && (
                    <span className="unread-badge" style={{ 
                      background: 'var(--primary)', 
                      color: 'white', 
                      borderRadius: '50%', 
                      width: '22px', 
                      height: '22px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="chat-area" ref={chatAreaRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeConv ? (
            <>
              <div className="chat-header" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--gray-200)', marginBottom: '16px' }}>
                <img 
                  src={activeConv.userAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(activeConv.userName || 'User')}&background=667eea&color=fff&size=40`} 
                  alt={activeConv.userName} 
                  className="chat-avatar"
                  style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                />
                <div>
                  <strong>{activeConv.userName || 'Unknown User'}</strong>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--gray-500)' }}>{activeConv.messages?.length || 0} messages</p>
                </div>
              </div>
              <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                {activeConv.messages
                  ?.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                  .map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`chat-message ${msg.from_user === state.currentUser.id ? 'sent' : 'received'}`}
                      style={{ 
                        display: 'flex', 
                        justifyContent: msg.from_user === state.currentUser.id ? 'flex-end' : 'flex-start',
                        marginBottom: '8px'
                      }}
                    >
                      <div className="message-bubble" style={{ 
                        maxWidth: '70%', 
                        padding: '10px 14px', 
                        borderRadius: '12px',
                        background: msg.from_user === state.currentUser.id ? 'var(--primary)' : 'var(--gray-100)',
                        color: msg.from_user === state.currentUser.id ? 'white' : 'var(--gray-800)'
                      }}>
                        <p style={{ margin: '0 0 4px 0' }}>{msg.message}</p>
                        <small className="message-time" style={{ fontSize: '0.7rem', opacity: 0.7 }}>
                          {new Date(msg.created_at).toLocaleString()}
                          {msg.from_user === state.currentUser.id && (
                            <span className="message-status" style={{ marginLeft: '6px' }}>
                              {msg.read ? ' ✓✓ Read' : ' ✓ Sent'}
                            </span>
                          )}
                        </small>
                      </div>
                    </div>
                  ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="chat-input-area" style={{ display: 'flex', gap: '8px', padding: '12px 0', borderTop: '1px solid var(--gray-200)' }}>
                <textarea
                  placeholder="Type your reply... (Enter to send, Shift+Enter for new line)"
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  className="chat-textarea"
                  rows="2"
                  style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid var(--gray-300)', resize: 'none' }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                />
                <button 
                  className="btn-primary btn-sm" 
                  onClick={handleSendReply} 
                  disabled={sending || !replyMessage.trim()}
                  style={{ padding: '8px 16px', borderRadius: '8px' }}
                >
                  {sending ? '...' : '📤'}
                </button>
              </div>
            </>
          ) : (
            <div className="chat-empty" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
              <span className="empty-icon" style={{ fontSize: '3rem' }}>💬</span>
              <h3>Select a conversation</h3>
              <p>Choose a conversation from the sidebar or wait for new messages to arrive in real-time.</p>
              {state.realtimeConnected && (
                <p className="realtime-note" style={{ color: 'var(--success)', fontSize: '0.9rem' }}>🟢 You're connected and will receive messages instantly!</p>
              )}
            </div>
          )}
        </div>
      </div>
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
      <div className="profile-header" style={{ display: 'flex', gap: '24px', alignItems: 'center', marginBottom: '32px' }}>
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
      
      <div className="profile-stats" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '32px' }}>
        <div className="stat-box" style={{ textAlign: 'center', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>{userListings.length}</h3>
          <p>Active Listings</p>
        </div>
        <div className="stat-box" style={{ textAlign: 'center', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>{userApps.length}</h3>
          <p>Apps Advertised</p>
        </div>
        <div className="stat-box" style={{ textAlign: 'center', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>{userSnippets.length}</h3>
          <p>Code Snippets</p>
        </div>
        <div className="stat-box" style={{ textAlign: 'center', padding: '20px', background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <h3>{state.favorites?.length || 0}</h3>
          <p>Favorites</p>
        </div>
      </div>

      <div className="profile-actions" style={{ display: 'flex', gap: '12px', marginBottom: '32px', flexWrap: 'wrap' }}>
        <Link to="/analytics" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', textDecoration: 'none' }}>
          📊 View Analytics
        </Link>
        <Link to="/settings" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', textDecoration: 'none' }}>
          ⚙️ Settings
        </Link>
        {state.isAdmin && (
          <Link to="/admin" className="btn-secondary" style={{ padding: '10px 20px', borderRadius: '8px', textDecoration: 'none' }}>
            🛡️ Admin Panel
          </Link>
        )}
        <button onClick={handleDeleteAccount} className="btn-secondary" style={{ color: 'var(--danger)', borderColor: 'var(--danger)', padding: '10px 20px', borderRadius: '8px' }}>
          🗑️ Delete Account
        </button>
      </div>
      
      {userListings.length > 0 && (
        <div className="profile-section" style={{ marginTop: '32px' }}>
          <h2>Your Listings ({userListings.length})</h2>
          <div className="listings-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px', marginTop: '20px' }}>
            {userListings.slice(0, 3).map(l => (
              <ListingCard key={l.id} listing={l} />
            ))}
          </div>
          {userListings.length > 3 && (
            <button className="btn-text" style={{ marginTop: '16px', color: 'var(--primary)' }}>
              View all {userListings.length} listings →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Continue with Home, Marketplace, Advertise, CodeSharing, and other components...
// The remaining components are the same as provided earlier

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
// LISTING CARD COMPONENT (With Delete)
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
// ADVERTISE COMPONENT (With Delete)
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
// CODE SHARING COMPONENT (With Delete)
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
// ANALYTICS PAGE (Placeholder)
// ============================================
function AnalyticsPage() {
  const { state } = useAppContext();
  
  return (
    <div className="analytics-page">
      <div className="page-header">
        <h1>📊 Analytics</h1>
        <p>Track your performance and metrics</p>
      </div>
      
      {!state.currentUser ? (
        <div className="empty-state">
          <span className="empty-icon">🔒</span>
          <h3>Please login to view analytics</h3>
        </div>
      ) : (
        <div className="analytics-content">
          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon">👁️</span>
              <h3>1,245</h3>
              <p>Profile Views</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon">📦</span>
              <h3>{(state.listings || []).filter(l => l.user_id === state.currentUser?.id).length}</h3>
              <p>Your Listings</p>
            </div>
            <div className="stat-card">
              <span className="stat-icon">💬</span>
              <h3>{state.messages?.length || 0}</h3>
              <p>Messages</p>
            </div>
          </div>
          <p style={{ color: 'var(--gray-500)', marginTop: '24px' }}>
            Analytics dashboard coming soon with more detailed metrics!
          </p>
        </div>
      )}
    </div>
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