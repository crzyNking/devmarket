// src/utils/supabase.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables. Make sure REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_PUBLISHABLE_KEY are set.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);
