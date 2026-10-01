-- ============================================
-- Relax foreign key on events and allow leads insert
-- ============================================

-- 1. Events table: drop strict auth.users foreign key so offline/custom rep IDs can sync
ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_rep_id_fkey;
ALTER TABLE public.day_sessions DROP CONSTRAINT IF EXISTS day_sessions_rep_id_fkey;
ALTER TABLE public.break_sessions DROP CONSTRAINT IF EXISTS break_sessions_rep_id_fkey;
ALTER TABLE public.knock_events DROP CONSTRAINT IF EXISTS knock_events_rep_id_fkey;

-- 2. Leads table RLS policies
DROP POLICY IF EXISTS "leads_admin" ON public.leads;
DROP POLICY IF EXISTS "leads_insert_all" ON public.leads;
DROP POLICY IF EXISTS "leads_select_all" ON public.leads;

CREATE POLICY "leads_insert_all" ON public.leads FOR INSERT WITH CHECK (true);
CREATE POLICY "leads_select_all" ON public.leads FOR SELECT USING (true);
CREATE POLICY "leads_update_admin" ON public.leads FOR UPDATE USING (true);
CREATE POLICY "leads_delete_admin" ON public.leads FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

GRANT ALL ON public.leads TO anon, authenticated;
GRANT ALL ON public.events TO anon, authenticated;
GRANT ALL ON public.knock_events TO anon, authenticated;
