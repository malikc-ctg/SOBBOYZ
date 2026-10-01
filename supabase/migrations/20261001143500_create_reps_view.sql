-- ============================================
-- Create public.reps view from profiles for team sales radar and leaderboard
-- ============================================

CREATE OR REPLACE VIEW public.reps AS
SELECT 
  id AS user_id, 
  COALESCE(full_name, split_part(email, '@', 1)) AS display_name, 
  email, 
  role
FROM public.profiles;

GRANT SELECT ON public.reps TO anon, authenticated;
