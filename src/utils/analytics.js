import { supabase } from './supabase';

export const analytics = {
  trackEvent: async (eventName, eventData = {}) => {
    try {
      await supabase.from('analytics_events').insert([{
        event_name: eventName,
        event_data: eventData,
        user_agent: navigator.userAgent,
        timestamp: new Date().toISOString()
      }]);
    } catch (error) {
      console.log('Analytics error:', error);
    }
  },

  trackPageView: async (page) => {
    await analytics.trackEvent('page_view', { page });
  },

  trackClick: async (element, page) => {
    await analytics.trackEvent('click', { element, page });
  },

  trackSearch: async (query, filters) => {
    await analytics.trackEvent('search', { query, filters });
  },

  trackListingView: async (listingId) => {
    await analytics.trackEvent('listing_view', { listing_id: listingId });
    try {
      await supabase.rpc('increment_listing_views', { listing_id: listingId });
    } catch (error) {
      console.log('Could not increment views:', error);
    }
  },

  getDashboardStats: async () => {
    try {
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });
      
      const { count: totalListings } = await supabase
        .from('listings')
        .select('*', { count: 'exact', head: true });
      
      const { count: totalApps } = await supabase
        .from('apps')
        .select('*', { count: 'exact', head: true });
      
      const { count: totalSnippets } = await supabase
        .from('code_snippets')
        .select('*', { count: 'exact', head: true });
      
      const { count: totalMessages } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true });

      return {
        totalUsers: totalUsers || 0,
        totalListings: totalListings || 0,
        totalApps: totalApps || 0,
        totalSnippets: totalSnippets || 0,
        totalMessages: totalMessages || 0
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return {
        totalUsers: 0,
        totalListings: 0,
        totalApps: 0,
        totalSnippets: 0,
        totalMessages: 0
      };
    }
  }
};