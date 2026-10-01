-- ============================================
-- Drop all foreign key constraints referencing auth.users on sales tables
-- ============================================

ALTER TABLE public.commercial_opportunities DROP CONSTRAINT IF EXISTS commercial_opportunities_created_by_rep_id_fkey;
ALTER TABLE public.knock_events DROP CONSTRAINT IF EXISTS knock_events_rep_id_fkey;
ALTER TABLE public.day_sessions DROP CONSTRAINT IF EXISTS day_sessions_rep_id_fkey;
ALTER TABLE public.break_sessions DROP CONSTRAINT IF EXISTS break_sessions_rep_id_fkey;
ALTER TABLE public.street_claims DROP CONSTRAINT IF EXISTS street_claims_rep_id_fkey;
