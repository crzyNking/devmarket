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
    analytics.trackEvent('page_view', { page });
  },

  trackClick: async (element, page) => {
    analytics.trackEvent('click', { element, page });
  },

  trackSearch: async (query, filters) => {
    analytics.trackEvent('search', { query, filters });
  },

  trackListingView: async (listingId) => {
    analytics.trackEvent('listing_view', { listing_id: listingId });
    try {
      await supabase.rpc('increment_listing_views', { listing_id: listingId });
    } catch (error) {
      console.log('Could not increment views:', error);
    }
  },

  getDashboardStats: async () => {
    try {
      const { data: totalUsers } = await supabase.from('profiles').select('count', { count: 'exact' });
      const { data: totalListings } = await supabase.from('listings').select('count', { count: 'exact' });
      const { data: totalApps } = await supabase.from('apps').select('count', { count: 'exact' });
      const { data: totalSnippets } = await supabase.from('code_snippets').select('count', { count: 'exact' });
      const { data: totalMessages } = await supabase.from('messages').select('count', { count: 'exact' });

      return {
        totalUsers: totalUsers?.count || 0,
        totalListings: totalListings?.count || 0,
        totalApps: totalApps?.count || 0,
        totalSnippets: totalSnippets?.count || 0,
        totalMessages: totalMessages?.count || 0
      };
    } catch (error) {
      console.error('Dashboard stats error:', error);
      return null;
    }
  }
};