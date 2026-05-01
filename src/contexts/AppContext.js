// src/contexts/AppContext.js
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import { supabase } from '../utils/supabase';

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
  isAdmin: false,
  analytics: {
    totalUsers: 0,
    totalListings: 0,
    totalMessages: 0,
    activeUsersToday: 0
  }
};

export function appReducer(state, action) {
  switch (action.type) {
    case 'INITIALIZED':
      return { ...state, initialized: true, loading: false };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_USER':
      return { ...state, currentUser: action.payload };
    case 'SET_PROFILE':
      return { ...state, profile: action.payload };
    case 'UPDATE_AVATAR':
      return { ...state, profile: { ...state.profile, avatar_url: action.payload } };
    case 'SET_LISTINGS':
      return { ...state, listings: action.payload || [] };
    case 'ADD_LISTING':
      return { ...state, listings: [action.payload, ...(state.listings || [])] };
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
    case 'UPDATE_MESSAGE':
      return { ...state, messages: (state.messages || []).map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m) };
    case 'SET_CONVERSATIONS':
      return { ...state, conversations: action.payload || [] };
    case 'ADD_TO_CONVERSATION': {
      const { conversationId, message } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map(conv => {
          if (conv.userId === conversationId) {
            return {
              ...conv,
              messages: [...conv.messages, message],
              lastMessage: message.message,
              lastMessageTime: message.created_at,
              unreadCount: message.to_user === state.currentUser?.id ? conv.unreadCount + 1 : conv.unreadCount
            };
          }
          return conv;
        })
      };
    }
    case 'UPDATE_CONVERSATION_UNREAD': {
      const { conversationId, unreadCount } = action.payload;
      return {
        ...state,
        conversations: state.conversations.map(conv => 
          conv.userId === conversationId ? { ...conv, unreadCount } : conv
        )
      };
    }
    case 'SET_ACTIVE_CONVERSATION':
      return { ...state, activeConversation: action.payload };
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
    case 'SET_IS_ADMIN':
      return { ...state, isAdmin: action.payload };
    case 'SET_ANALYTICS':
      return { ...state, analytics: { ...state.analytics, ...action.payload } };
    case 'LOGOUT':
      return { ...state, currentUser: null, profile: null, session: null, notifications: [], messages: [], conversations: [], activeConversation: null, favorites: [], isAdmin: false };
    case 'TOGGLE_THEME': {
      const newTheme = state.theme === 'light' ? 'dark' : 'light';
      localStorage.setItem('devMarketTheme', newTheme);
      return { ...state, theme: newTheme };
    }
    default:
      return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('devMarketTheme');
    if (savedTheme && savedTheme !== state.theme) {
      dispatch({ type: 'TOGGLE_THEME' });
    }
  }, []);

  // Initialize app
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
            checkAdminStatus(session.user.id);
          }
        }

        await loadPublicData();
        
        if (mounted) {
          dispatch({ type: 'INITIALIZED' });
        }
      } catch (error) {
        console.error('Init error:', error);
        if (mounted) {
          dispatch({ type: 'INITIALIZED' });
        }
      }
    }

    async function loadPublicData() {
      try {
        const [listingsResult, appsResult, snippetsResult] = await Promise.all([
          supabase.from('listings').select('*').order('created_at', { ascending: false }),
          supabase.from('apps').select('*').order('created_at', { ascending: false }),
          supabase.from('code_snippets').select('*').order('created_at', { ascending: false })
        ]);

        if (listingsResult.data) {
          dispatch({ type: 'SET_LISTINGS', payload: formatListings(listingsResult.data) });
        }
        if (appsResult.data) {
          dispatch({ type: 'SET_APPS', payload: formatApps(appsResult.data) });
        }
        if (snippetsResult.data) {
          dispatch({ type: 'SET_CODE_SNIPPETS', payload: formatSnippets(snippetsResult.data) });
        }
      } catch (error) {
        console.error('Error loading public data:', error);
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
        } else {
          const defaultProfile = createDefaultProfile(user);
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
          dispatch({ type: 'SET_NOTIFICATIONS', payload: notifsResult.data });
        }
        if (msgsResult.data) {
          dispatch({ type: 'SET_MESSAGES', payload: msgsResult.data });
          buildConversations(msgsResult.data, userId);
        }
        if (favsResult.data) {
          const favorites = favsResult.data.map(f => f.listing).filter(Boolean);
          dispatch({ type: 'SET_FAVORITES', payload: formatListings(favorites) });
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    }

    async function checkAdminStatus(userId) {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .single();
        
        dispatch({ type: 'SET_IS_ADMIN', payload: data?.role === 'admin' });
      } catch (error) {
        console.error('Error checking admin status:', error);
      }
    }

    function buildConversations(messages, userId) {
      const conversationMap = new Map();
      
      messages.forEach(msg => {
        const otherUserId = msg.from_user === userId ? msg.to_user : msg.from_user;
        
        if (!conversationMap.has(otherUserId)) {
          conversationMap.set(otherUserId, {
            userId: otherUserId,
            userName: msg.from_user === userId ? msg.to_name : msg.from_name || 'Unknown',
            userAvatar: msg.from_user === userId ? msg.to_avatar : msg.from_avatar,
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

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        dispatch({ type: 'SET_SESSION', payload: session });
        
        if (event === 'SIGNED_IN' && session?.user) {
          dispatch({ type: 'SET_USER', payload: session.user });
          await loadProfile(session.user);
          await loadUserData(session.user.id);
          await loadPublicData();
          checkAdminStatus(session.user.id);
        } else if (event === 'SIGNED_OUT') {
          dispatch({ type: 'LOGOUT' });
          await loadPublicData();
        }
      }
    });

    initialize();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// Helper functions
function formatListings(data) {
  return data.map(item => ({
    ...item,
    seller: item.seller_name,
    sellerAvatar: item.seller_avatar,
    imageUrl: item.image_url,
    date: new Date(item.created_at).toLocaleDateString()
  }));
}

function formatApps(data) {
  return data.map(item => ({
    ...item,
    appName: item.app_name,
    appUrl: item.app_url,
    developer: item.developer_name,
    developerAvatar: item.developer_avatar,
    date: new Date(item.created_at).toLocaleDateString()
  }));
}

function formatSnippets(data) {
  return data.map(item => ({
    ...item,
    author: item.author_name,
    authorAvatar: item.author_avatar,
    likedBy: [],
    date: new Date(item.created_at).toLocaleDateString()
  }));
}

function createDefaultProfile(user) {
  const meta = user.user_metadata || {};
  return {
    id: user.id,
    name: meta.name || user.email?.split('@')[0] || 'User',
    email: user.email,
    role: meta.role || 'developer',
    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(meta.name || 'User')}&background=667eea&color=fff&size=200`
  };
}

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};

export default AppContext;