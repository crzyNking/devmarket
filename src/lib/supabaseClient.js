// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

// Helper functions for common operations
export const supabaseHelpers = {
  // Auth
  signUp: async (email, password, userData) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: userData
      }
    })
    return { data, error }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  getCurrentUser: async () => {
    const { data: { user }, error } = await supabase.auth.getUser()
    return { user, error }
  },

  // Listings
  getListings: async (filters = {}) => {
    let query = supabase
      .from('listings')
      .select('*, profiles:user_id (name, avatar_url)')
      .order('created_at', { ascending: false })

    if (filters.category && filters.category !== 'all') {
      query = query.eq('category', filters.category)
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }
    if (filters.priceFilter === 'free') {
      query = query.ilike('price', '%free%')
    } else if (filters.priceFilter === 'paid') {
      query = query.not('price', 'ilike', '%free%')
    }

    const { data, error } = await query
    return { data, error }
  },

  createListing: async (listingData) => {
    const { data, error } = await supabase
      .from('listings')
      .insert([listingData])
      .select()
    return { data, error }
  },

  updateListing: async (id, updates) => {
    const { data, error } = await supabase
      .from('listings')
      .update(updates)
      .eq('id', id)
      .select()
    return { data, error }
  },

  deleteListing: async (id) => {
    const { error } = await supabase
      .from('listings')
      .delete()
      .eq('id', id)
    return { error }
  },

  // Apps
  getApps: async (filters = {}) => {
    let query = supabase
      .from('apps')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.platform && filters.platform !== 'all') {
      query = query.eq('platform', filters.platform)
    }
    if (filters.search) {
      query = query.or(`app_name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    return { data, error }
  },

  createApp: async (appData) => {
    const { data, error } = await supabase
      .from('apps')
      .insert([appData])
      .select()
    return { data, error }
  },

  // Code Snippets
  getCodeSnippets: async (filters = {}) => {
    let query = supabase
      .from('code_snippets')
      .select('*')
      .order('created_at', { ascending: false })

    if (filters.language && filters.language !== 'all') {
      query = query.eq('language', filters.language)
    }
    if (filters.search) {
      query = query.or(`title.ilike.%${filters.search}%,description.ilike.%${filters.search}%`)
    }

    const { data, error } = await query
    return { data, error }
  },

  createCodeSnippet: async (snippetData) => {
    const { data, error } = await supabase
      .from('code_snippets')
      .insert([snippetData])
      .select()
    return { data, error }
  },

  likeSnippet: async (snippetId, userId) => {
    // Check if already liked
    const { data: existingLike } = await supabase
      .from('snippet_likes')
      .select()
      .eq('snippet_id', snippetId)
      .eq('user_id', userId)
      .single()

    if (existingLike) {
      // Unlike
      await supabase
        .from('snippet_likes')
        .delete()
        .eq('id', existingLike.id)
      
      // Decrement likes count
      const { data } = await supabase
        .from('code_snippets')
        .select('likes')
        .eq('id', snippetId)
        .single()
      
      await supabase
        .from('code_snippets')
        .update({ likes: Math.max(0, (data?.likes || 1) - 1) })
        .eq('id', snippetId)
      
      return { liked: false }
    } else {
      // Like
      await supabase
        .from('snippet_likes')
        .insert([{ snippet_id: snippetId, user_id: userId }])
      
      // Increment likes count
      const { data } = await supabase
        .from('code_snippets')
        .select('likes')
        .eq('id', snippetId)
        .single()
      
      await supabase
        .from('code_snippets')
        .update({ likes: (data?.likes || 0) + 1 })
        .eq('id', snippetId)
      
      return { liked: true }
    }
  },

  // Messages
  getMessages: async (userId) => {
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`from_user.eq.${userId},to_user.eq.${userId}`)
      .order('created_at', { ascending: false })
    return { data, error }
  },

  sendMessage: async (messageData) => {
    const { data, error } = await supabase
      .from('messages')
      .insert([messageData])
      .select()
    return { data, error }
  },

  // Favorites
  getFavorites: async (userId) => {
    const { data, error } = await supabase
      .from('favorites')
      .select('*, listings:listing_id (*)')
      .eq('user_id', userId)
    return { data, error }
  },

  toggleFavorite: async (userId, listingId) => {
    // Check if already favorited
    const { data: existing } = await supabase
      .from('favorites')
      .select()
      .eq('user_id', userId)
      .eq('listing_id', listingId)
      .single()

    if (existing) {
      await supabase
        .from('favorites')
        .delete()
        .eq('id', existing.id)
      return { favorited: false }
    } else {
      await supabase
        .from('favorites')
        .insert([{ user_id: userId, listing_id: listingId }])
      return { favorited: true }
    }
  },

  // Notifications
  getNotifications: async (userId) => {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    return { data, error }
  },

  createNotification: async (notificationData) => {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
    return { data, error }
  },

  markNotificationsRead: async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    return { error }
  },

  clearNotifications: async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('user_id', userId)
    return { error }
  },

  // Profile
  getProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    return { data, error }
  },

  updateProfile: async (userId, updates) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
    return { data, error }
  }
}