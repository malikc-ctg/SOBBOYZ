import { createClient } from '@supabase/supabase-js';

// Fallback to the provided keys if Vercel env vars are missing or misconfigured.
// It is safe to expose the anon/publishable key in the client, as long as RLS is enabled in the database.
const supabaseUrl = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_KNOCKLOG_SUPABASE_URL) || 
  'https://rwuwfevgepigvuihindn.supabase.co';

const supabaseAnonKey = 
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_KNOCKLOG_SUPABASE_ANON_KEY) || 
  'sb_publishable_JYO2wYAlT2MANkchrYlFfw_CISKaut_';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
