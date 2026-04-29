// src/utils/supabase.js
import { createClient } from '@supabase/supabase-js';

// Use environment variables with fallback
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || 'https://iosaukezcsouefeaiblf.supabase.co';
const supabaseKey = process.env.REACT_APP_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_TLWXxsizvtmo3JKAt-MM6A_sSI-tt_m';

export const supabase = createClient(supabaseUrl, supabaseKey);