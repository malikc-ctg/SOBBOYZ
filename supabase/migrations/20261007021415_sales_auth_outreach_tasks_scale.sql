-- ============================================================
-- Migration: sales_auth_outreach_tasks_scale
-- 1. Add title to profiles and update public.reps view with title
-- 2. Create public.outreach_tasks table (with due_at timestamp and lead_id index)
-- 3. Add performance indexes for sales scaling
-- ============================================================

-- 1. Add title to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS title TEXT DEFAULT 'Sales Representative';

-- Update known rep titles
UPDATE public.profiles 
SET title = 'Managing Partner' 
WHERE email = 'malik@seaofblue.app' AND (title IS NULL OR title = 'Sales Representative');

UPDATE public.profiles 
SET title = 'Senior Account Executive' 
WHERE email = 'raahim@seaofblue.app' AND (title IS NULL OR title = 'Sales Representative');

UPDATE public.profiles 
SET title = 'Account Executive' 
WHERE email = 'ayaan@seaofblue.app' AND (title IS NULL OR title = 'Sales Representative');

-- Recreate public.reps view to include title
CREATE OR REPLACE VIEW public.reps WITH (security_invoker = true) AS
SELECT 
  id AS user_id, 
  COALESCE(full_name, split_part(email, '@', 1)) AS display_name, 
  email, 
  role,
  COALESCE(title, CASE WHEN role = 'admin' THEN 'Managing Partner' ELSE 'Sales Representative' END) AS title
FROM public.profiles;

GRANT SELECT ON public.reps TO authenticated, anon;

-- 2. Create outreach_tasks table
CREATE TABLE IF NOT EXISTS public.outreach_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  task_type TEXT NOT NULL DEFAULT 'callback',
  status TEXT NOT NULL DEFAULT 'pending',
  due_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index outreach_tasks on lead_id, rep_id, due_at, status
CREATE INDEX IF NOT EXISTS idx_outreach_tasks_lead_id ON public.outreach_tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tasks_rep_id ON public.outreach_tasks(rep_id);
CREATE INDEX IF NOT EXISTS idx_outreach_tasks_due_at ON public.outreach_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_outreach_tasks_status ON public.outreach_tasks(status);

-- Enable RLS on outreach_tasks
ALTER TABLE public.outreach_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "outreach_tasks_select_policy" ON public.outreach_tasks
    FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "outreach_tasks_insert_policy" ON public.outreach_tasks
    FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "outreach_tasks_update_policy" ON public.outreach_tasks
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "outreach_tasks_delete_policy" ON public.outreach_tasks
    FOR DELETE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

GRANT ALL ON public.outreach_tasks TO authenticated;
GRANT SELECT ON public.outreach_tasks TO anon;

-- 3. Optimization indexes on events & leads for scale
CREATE INDEX IF NOT EXISTS idx_events_type_created ON public.events(type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON public.events(((payload->>'contact_id')));
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);
