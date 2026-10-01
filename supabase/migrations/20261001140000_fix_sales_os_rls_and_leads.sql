-- ============================================
-- Fix Sales OS RLS Policies & Leads Insertion
-- Enables field reps to sync events, log leads, and share team activity
-- ============================================

-- 1. Leads Table (allow D2D/KnockLog leads to be inserted from field clients)
DROP POLICY IF EXISTS "leads_insert_all" ON public.leads;
CREATE POLICY "leads_insert_all" ON public.leads FOR INSERT WITH CHECK (true);
GRANT INSERT, SELECT ON public.leads TO anon, authenticated;

-- 2. Events Outbox Table (allow sync engine to push and pull events)
DROP POLICY IF EXISTS "events_insert_own" ON public.events;
DROP POLICY IF EXISTS "events_select_all" ON public.events;
DROP POLICY IF EXISTS "events_update_all" ON public.events;
DROP POLICY IF EXISTS "events_insert_all" ON public.events;

CREATE POLICY "events_insert_all" ON public.events FOR INSERT WITH CHECK (true);
CREATE POLICY "events_select_all" ON public.events FOR SELECT USING (true);
CREATE POLICY "events_update_all" ON public.events FOR UPDATE USING (true);
GRANT ALL ON public.events TO anon, authenticated;

-- 3. Day Sessions Table
DROP POLICY IF EXISTS "sessions_own_rw" ON public.day_sessions;
DROP POLICY IF EXISTS "sessions_team_read" ON public.day_sessions;
DROP POLICY IF EXISTS "sessions_all_rw" ON public.day_sessions;

CREATE POLICY "sessions_all_rw" ON public.day_sessions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.day_sessions TO anon, authenticated;

-- 4. Break Sessions Table
DROP POLICY IF EXISTS "break_sessions_all_rw" ON public.break_sessions;
CREATE POLICY "break_sessions_all_rw" ON public.break_sessions FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.break_sessions TO anon, authenticated;

-- 5. Knock Events Table
DROP POLICY IF EXISTS "knock_events_rw_own" ON public.knock_events;
DROP POLICY IF EXISTS "knock_events_team_read" ON public.knock_events;
DROP POLICY IF EXISTS "knock_events_all_rw" ON public.knock_events;

CREATE POLICY "knock_events_all_rw" ON public.knock_events FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.knock_events TO anon, authenticated;

-- 6. Street Claims Table
DROP POLICY IF EXISTS "street_claims_read_all" ON public.street_claims;
DROP POLICY IF EXISTS "street_claims_insert_own" ON public.street_claims;
DROP POLICY IF EXISTS "street_claims_delete_own" ON public.street_claims;
DROP POLICY IF EXISTS "street_claims_all_rw" ON public.street_claims;

CREATE POLICY "street_claims_all_rw" ON public.street_claims FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.street_claims TO anon, authenticated;

-- 7. Commercial Opportunities Table
DROP POLICY IF EXISTS "comm_opps_team_all" ON public.commercial_opportunities;
DROP POLICY IF EXISTS "comm_opps_all_rw" ON public.commercial_opportunities;

CREATE POLICY "comm_opps_all_rw" ON public.commercial_opportunities FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON public.commercial_opportunities TO anon, authenticated;

-- 8. Views
GRANT SELECT ON public.team_property_coverage TO anon, authenticated;
