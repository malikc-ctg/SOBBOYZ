import { createClient } from '@supabase/supabase-js';

// Fallback to the provided keys if Vercel env vars are missing or misconfigured.
// It is safe to expose the anon/publishable key in the client, as long as RLS is enabled in the database.
const supabaseUrl = 
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_URL || process.env?.NEXT_PUBLIC_KNOCKLOG_SUPABASE_URL)) || 
  'https://lhpclmglzyemisgjrgts.supabase.co';

const supabaseAnonKey = 
  (typeof process !== 'undefined' && (process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env?.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env?.NEXT_PUBLIC_KNOCKLOG_SUPABASE_ANON_KEY)) || 
  'sb_publishable_SFHDsj7L0zEu-QFYnMzgug_sM9kcA2K';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
