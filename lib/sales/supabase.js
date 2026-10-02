import { createClient } from '@/lib/supabase/client';

// Share the signed-in user's cookie session with the rest of the app, so Sales OS
// queries run as that user and are governed by RLS (sales tables are admin-only).
export const supabase = createClient();
