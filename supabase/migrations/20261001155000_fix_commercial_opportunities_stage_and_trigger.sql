-- ============================================
-- Fix Commercial Opportunities Stage Check & Trigger Compatibility
-- ============================================

-- 1. Drop the restrictive stage check constraint on commercial_opportunities
ALTER TABLE public.commercial_opportunities DROP CONSTRAINT IF EXISTS commercial_opportunities_stage_check;

-- 2. Add expanded stage check constraint supporting both CRM and UI stages
ALTER TABLE public.commercial_opportunities ADD CONSTRAINT commercial_opportunities_stage_check 
CHECK (stage IN (
  'knocked', 'cold', 'contacted', 'dm_identified', 'identified', 
  'walkthrough_scheduled', 'walkthrough_booked', 'proposal_sent', 
  'quoted', 'negotiation', 'won', 'lost',
  'COLD', 'CONTACTED', 'DM_IDENTIFIED', 'WALKTHROUGH_BOOKED', 'QUOTED', 'WON', 'LOST'
));

-- 3. Set permissive RLS on commercial_opportunities
ALTER TABLE public.commercial_opportunities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "commercial_opportunities_select" ON public.commercial_opportunities;
DROP POLICY IF EXISTS "commercial_opportunities_insert" ON public.commercial_opportunities;
DROP POLICY IF EXISTS "commercial_opportunities_update" ON public.commercial_opportunities;
DROP POLICY IF EXISTS "commercial_opportunities_all" ON public.commercial_opportunities;

CREATE POLICY "commercial_opportunities_all" ON public.commercial_opportunities
FOR ALL TO public USING (true) WITH CHECK (true);

GRANT ALL ON public.commercial_opportunities TO anon, authenticated, service_role;

-- 4. Update project_sales_event trigger function
CREATE OR REPLACE FUNCTION project_sales_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'DAY_START' THEN
    INSERT INTO public.day_sessions (id, rep_id, session_date, start_time, status)
    VALUES (
      (NEW.payload->>'session_id')::uuid,
      NEW.rep_id,
      COALESCE((NEW.payload->>'session_date')::date, CURRENT_DATE),
      COALESCE((NEW.payload->>'start_time')::timestamp with time zone, NOW()),
      'OPEN'
    ) ON CONFLICT (id) DO NOTHING;

  ELSIF NEW.type = 'DAY_END' THEN
    UPDATE public.day_sessions
    SET status = 'CLOSED',
        end_time = (NEW.payload->>'end_time')::timestamp with time zone,
        export_status = NEW.payload->>'export_status',
        export_url = NEW.payload->>'export_url'
    WHERE id = (NEW.payload->>'session_id')::uuid;

  ELSIF NEW.type = 'KNOCK' THEN
    INSERT INTO public.knock_events (
      id, rep_id, session_id, mode, street_name, house_number, unit_number,
      postal_code, city, lat, lng, outcome_type, convo_status, objection_type,
      callback_time, notes, company_name, facility_type, contact_name,
      contact_title, contact_phone, contact_email, decision_maker_status,
      walkthrough_date, contract_mrr, square_footage, cleaning_frequency,
      competitor_vendor, competitor_contract_expires_at, timestamp
    ) VALUES (
      NEW.event_id,
      NEW.rep_id,
      NULLIF(NEW.payload->>'session_id', '')::uuid,
      COALESCE(NEW.payload->>'mode', 'residential'),
      COALESCE(NEW.payload->>'street_name', 'Unknown Street'),
      NEW.payload->>'house_number',
      COALESCE(NEW.payload->>'unit_number', NEW.payload->>'suite'),
      NEW.payload->>'postal_code',
      COALESCE(NEW.payload->>'city', 'Toronto'),
      (NEW.payload->>'lat')::real,
      (NEW.payload->>'lng')::real,
      COALESCE(NEW.payload->>'outcome_type', 'NO_ANSWER'),
      NEW.payload->>'convo_status',
      NEW.payload->>'objection_type',
      (NEW.payload->>'callback_time')::timestamp with time zone,
      NEW.payload->>'notes',
      COALESCE(NEW.payload->>'company_name', NEW.payload->>'business_name'),
      NEW.payload->>'facility_type',
      COALESCE(NEW.payload->>'contact_name', NEW.payload->'lead_details'->>'contact_name'),
      NEW.payload->>'contact_title',
      COALESCE(NEW.payload->>'contact_phone', NEW.payload->'lead_details'->>'phone'),
      NEW.payload->>'contact_email',
      NEW.payload->>'decision_maker_status',
      (COALESCE(NEW.payload->>'walkthrough_date', NEW.payload->'lead_details'->>'walkthrough_at'))::timestamp with time zone,
      COALESCE((NEW.payload->>'contract_mrr')::numeric, (NEW.payload->'lead_details'->>'est_monthly_value')::numeric),
      (NEW.payload->>'square_footage')::integer,
      COALESCE(NEW.payload->>'cleaning_frequency', NEW.payload->'lead_details'->>'frequency'),
      COALESCE(NEW.payload->>'competitor_vendor', NEW.payload->'lead_details'->>'current_vendor'),
      (NEW.payload->>'competitor_contract_expires_at')::date,
      COALESCE((NEW.payload->>'timestamp')::timestamp with time zone, NOW())
    ) ON CONFLICT (id) DO NOTHING;

    -- If commercial target, also project into commercial_opportunities
    IF (NEW.payload->>'mode' = 'commercial' AND (NEW.payload->>'company_name' IS NOT NULL OR NEW.payload->>'business_name' IS NOT NULL)) THEN
      INSERT INTO public.commercial_opportunities (
        created_by_rep_id, company_name, facility_type, address, unit_number,
        city, lat, lng, dm_name, dm_title, dm_phone, dm_email,
        stage, walkthrough_date, expected_mrr, square_footage,
        cleaning_frequency, competitor_vendor, competitor_contract_expires_at
      ) VALUES (
        NEW.rep_id,
        COALESCE(NEW.payload->>'company_name', NEW.payload->>'business_name'),
        NEW.payload->>'facility_type',
        COALESCE(NEW.payload->>'street_name', 'Unknown Street'),
        COALESCE(NEW.payload->>'unit_number', NEW.payload->>'suite'),
        COALESCE(NEW.payload->>'city', 'Toronto'),
        (NEW.payload->>'lat')::real,
        (NEW.payload->>'lng')::real,
        COALESCE(NEW.payload->>'contact_name', NEW.payload->'lead_details'->>'contact_name'),
        NEW.payload->>'contact_title',
        COALESCE(NEW.payload->>'contact_phone', NEW.payload->'lead_details'->>'phone'),
        NEW.payload->>'contact_email',
        CASE 
          WHEN NEW.payload->>'outcome_type' = 'WALKTHROUGH_BOOKED' THEN 'walkthrough_scheduled'
          WHEN NEW.payload->>'outcome_type' = 'PROPOSAL_REQUESTED' THEN 'proposal_sent'
          WHEN NEW.payload->>'outcome_type' = 'SALE' THEN 'won'
          WHEN NEW.payload->>'outcome_type' IN ('DECISION_MAKER', 'DM_INTERESTED') THEN 'dm_identified'
          WHEN NEW.payload->>'outcome_type' = 'GATEKEEPER' THEN 'contacted'
          ELSE 'knocked'
        END,
        (COALESCE(NEW.payload->>'walkthrough_date', NEW.payload->'lead_details'->>'walkthrough_at'))::timestamp with time zone,
        COALESCE((NEW.payload->>'contract_mrr')::numeric, (NEW.payload->'lead_details'->>'est_monthly_value')::numeric),
        (NEW.payload->>'square_footage')::integer,
        COALESCE(NEW.payload->>'cleaning_frequency', NEW.payload->'lead_details'->>'frequency'),
        COALESCE(NEW.payload->>'competitor_vendor', NEW.payload->'lead_details'->>'current_vendor'),
        (NEW.payload->>'competitor_contract_expires_at')::date
      ) ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
