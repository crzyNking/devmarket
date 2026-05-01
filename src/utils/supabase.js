import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || '',
  {
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
);