-- ============================================
-- Security hardening
--  1. Block privilege escalation through self-service row updates
--     (profiles.role, employee pay/tier fields, partner billing fields)
--  2. Remove anonymous/public access to sales and lead tables (admin only)
--  3. Make the reps / team_property_coverage views respect RLS
--  4. Remove world-writable policies on booking_sessions and audit_logs
--  5. Remove broad access to the (unused) "documents" storage bucket
--
-- Server code using the service role key is unaffected: it bypasses RLS, and the
-- guard triggers below only apply to requests made with an end-user JWT
-- (auth.role() = 'anon' or 'authenticated').
-- ============================================


-- --------------------------------------------
-- Helpers
-- --------------------------------------------

-- True when the current statement comes from an end user (anon key / user session)
-- rather than the service role, the auth server, or a direct database connection.
CREATE OR REPLACE FUNCTION public.is_end_user_request()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(auth.role(), '') IN ('anon', 'authenticated');
$$;

-- Parses text as JSONB, returning NULL instead of raising on invalid JSON.
CREATE OR REPLACE FUNCTION public.try_parse_jsonb(value TEXT)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN value::jsonb;
EXCEPTION WHEN others THEN
  RETURN NULL;
END;
$$;


-- --------------------------------------------
-- 1a. profiles: users may not grant themselves a role
-- --------------------------------------------
-- The "profiles_own" policy (FOR ALL USING auth.uid() = id) lets a user update or
-- re-insert their own profile row, including the role column.

CREATE OR REPLACE FUNCTION public.guard_profile_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role IS DISTINCT FROM 'customer' THEN
      RAISE EXCEPTION 'Not allowed to set profile role' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Not allowed to change profile role' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_columns ON public.profiles;
CREATE TRIGGER guard_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileged_columns();


-- --------------------------------------------
-- 1b. employees: employees may not change their own pay, tier or verification fields
-- --------------------------------------------
-- The "contractors_update_own" policy lets an employee update their own row. Onboarding
-- legitimately updates name, phone, zone, supplies/vehicle, notes and invited -> active.

CREATE OR REPLACE FUNCTION public.guard_employee_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.tier IS DISTINCT FROM OLD.tier
     OR NEW.payout_rate IS DISTINCT FROM OLD.payout_rate
     OR NEW.hourly_wage IS DISTINCT FROM OLD.hourly_wage
     OR NEW.score IS DISTINCT FROM OLD.score
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete
     OR NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled
     OR NEW.background_check_cleared IS DISTINCT FROM OLD.background_check_cleared
     OR NEW.insurance_on_file IS DISTINCT FROM OLD.insurance_on_file
     OR (public.try_parse_jsonb(NEW.notes) ->> 'hourly_wage')
        IS DISTINCT FROM (public.try_parse_jsonb(OLD.notes) ->> 'hourly_wage')
  THEN
    RAISE EXCEPTION 'Not allowed to change protected employee fields' USING ERRCODE = '42501';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status
     AND NOT (OLD.status = 'invited' AND NEW.status = 'active')
  THEN
    RAISE EXCEPTION 'Not allowed to change employee status' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_employee_privileged_columns ON public.employees;
CREATE TRIGGER guard_employee_privileged_columns
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.guard_employee_privileged_columns();


-- --------------------------------------------
-- 1c. partners: partners may not change their own billing/commission fields
-- --------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_partner_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_end_user_request() OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.profile_id IS DISTINCT FROM OLD.profile_id
     OR NEW.partner_type IS DISTINCT FROM OLD.partner_type
     OR NEW.zone_id IS DISTINCT FROM OLD.zone_id
     OR NEW.referral_code IS DISTINCT FROM OLD.referral_code
     OR NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     OR NEW.credit_balance IS DISTINCT FROM OLD.credit_balance
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.invoice_billing IS DISTINCT FROM OLD.invoice_billing
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.qbo_customer_id IS DISTINCT FROM OLD.qbo_customer_id
  THEN
    RAISE EXCEPTION 'Not allowed to change protected partner fields' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_partner_privileged_columns ON public.partners;
CREATE TRIGGER guard_partner_privileged_columns
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.guard_partner_privileged_columns();


-- --------------------------------------------
-- 2. Sales OS and lead tables: admin only
-- --------------------------------------------
-- Previous migrations opened these tables to anon with USING (true). The Sales OS
-- now uses the signed-in admin's session, and public lead capture goes through
-- server routes using the service role. Database triggers that write to these
-- tables are SECURITY DEFINER and are unaffected.

DO $$
DECLARE
  t TEXT;
  pol RECORD;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'leads', 'events', 'day_sessions', 'break_sessions',
    'knock_events', 'street_claims', 'commercial_opportunities'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    FOR pol IN
      SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t
    );
  END LOOP;
END $$;


-- --------------------------------------------
-- 3. Views: run with the caller's permissions so table RLS applies
-- --------------------------------------------
-- Views run as their owner by default, which bypasses RLS on the underlying tables.
-- public.reps exposed every profile's email and role to anon.

ALTER VIEW public.reps SET (security_invoker = true);
REVOKE ALL ON public.reps FROM anon;
GRANT SELECT ON public.reps TO authenticated;

DO $$
BEGIN
  IF to_regclass('public.team_property_coverage') IS NOT NULL THEN
    EXECUTE 'ALTER VIEW public.team_property_coverage SET (security_invoker = true)';
    EXECUTE 'REVOKE ALL ON public.team_property_coverage FROM anon';
    EXECUTE 'GRANT SELECT ON public.team_property_coverage TO authenticated';
  END IF;
END $$;


-- --------------------------------------------
-- 4. World-writable policies
-- --------------------------------------------
-- booking_sessions and audit_logs are only written by server code with the service
-- role (lib/marketing-automation.ts, lib/audit.ts), which bypasses RLS.

DROP POLICY IF EXISTS "booking_sessions_service_only" ON public.booking_sessions;
DROP POLICY IF EXISTS "booking_sessions_update" ON public.booking_sessions;

DROP POLICY IF EXISTS "audit_logs_service_insert" ON public.audit_logs;


-- --------------------------------------------
-- 5. Storage: "documents" bucket
-- --------------------------------------------
-- Any signed-in user (including self-registered customers) could read and upload
-- every object in this bucket. The app does not use it; admins keep full access via
-- the "Admins have full access to storage" policy.

DROP POLICY IF EXISTS "Authenticated users can insert documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can select documents" ON storage.objects;
