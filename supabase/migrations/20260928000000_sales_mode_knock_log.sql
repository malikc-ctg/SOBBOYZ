-- ============================================
-- Sea of Blue: Sales OS — KnockLog Integration
-- Combines KnockLog Field Engine + Odoo-style Commercial CRM Pipeline
-- ============================================

-- 1. Day Sessions (Shift tracking for field reps)
CREATE TABLE IF NOT EXISTS public.day_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  end_time TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED')),
  export_status TEXT DEFAULT 'PENDING',
  export_url TEXT,
  doors_count INTEGER DEFAULT 0,
  convos_count INTEGER DEFAULT 0,
  sales_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Break Sessions
CREATE TABLE IF NOT EXISTS public.break_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.day_sessions(id) ON DELETE CASCADE NOT NULL,
  break_start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  break_end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER -- seconds
);

-- 3. Events Table (Anti-Gravity Outbox Destination for Offline Sync)
CREATE TABLE IF NOT EXISTS public.events (
  event_id UUID PRIMARY KEY,
  rep_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Knock Events (Immutable structured log with Residential & Commercial attributes)
CREATE TABLE IF NOT EXISTS public.knock_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.day_sessions(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'residential' CHECK (mode IN ('residential', 'commercial')),
  
  -- Location & Address
  street_name TEXT NOT NULL,
  house_number TEXT,
  unit_number TEXT,
  postal_code TEXT,
  city TEXT DEFAULT 'Toronto',
  lat REAL,
  lng REAL,
  
  -- Interaction Outcome
  outcome_type TEXT NOT NULL CHECK (outcome_type IN (
    'NO_ANSWER', 'CONVO', 'SALE', 
    'GATEKEEPER', 'WALKTHROUGH_BOOKED', 'PROPOSAL_REQUESTED', 'EXISTING_CONTRACT'
  )),
  convo_status TEXT,
  objection_type TEXT,
  callback_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  
  -- Commercial B2B specifics (Odoo data model)
  company_name TEXT,
  facility_type TEXT,
  contact_name TEXT,
  contact_title TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  decision_maker_status TEXT CHECK (decision_maker_status IN ('DIRECT', 'GATEKEEPER', 'NOT_IN')),
  walkthrough_date TIMESTAMP WITH TIME ZONE,
  contract_mrr NUMERIC(10, 2),
  square_footage INTEGER,
  cleaning_frequency TEXT,
  competitor_vendor TEXT,
  competitor_contract_expires_at DATE,
  
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Street & Plaza Claims (Real-time team territory protection)
CREATE TABLE IF NOT EXISTS public.street_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rep_name TEXT NOT NULL DEFAULT '',
  street_name TEXT NOT NULL,
  territory_type TEXT NOT NULL DEFAULT 'residential' CHECK (territory_type IN ('residential', 'commercial_plaza')),
  street_center_lat REAL,
  street_center_lng REAL,
  session_date DATE NOT NULL DEFAULT CURRENT_DATE,
  claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Commercial Opportunities (Odoo CRM Pipeline)
CREATE TABLE IF NOT EXISTS public.commercial_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by_rep_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  facility_type TEXT,
  address TEXT NOT NULL,
  unit_number TEXT,
  city TEXT DEFAULT 'Toronto',
  lat REAL,
  lng REAL,
  
  -- Contacts (Decision Maker & Staff)
  dm_name TEXT,
  dm_title TEXT,
  dm_phone TEXT,
  dm_email TEXT,
  gatekeeper_name TEXT,
  gatekeeper_notes TEXT,
  
  -- Odoo Pipeline Stages
  stage TEXT NOT NULL DEFAULT 'knocked' CHECK (stage IN (
    'knocked',               -- Stage 1: Cold contact / Initial conversation
    'walkthrough_scheduled', -- Stage 2: Assessment booked
    'proposal_sent',         -- Stage 3: Scope and quote delivered
    'negotiation',           -- Stage 4: Reviewing terms/COI/insurance
    'won',                   -- Stage 5: Contract signed
    'lost'                   -- Lost / Postponed
  )),
  walkthrough_date TIMESTAMP WITH TIME ZONE,
  expected_mrr NUMERIC(10, 2),
  one_time_value NUMERIC(10, 2),
  cleaning_frequency TEXT,
  square_footage INTEGER,
  
  -- Competitor Radar
  competitor_vendor TEXT,
  competitor_contract_expires_at DATE,
  lost_reason TEXT,
  
  -- Linked records in Sea of Blue
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique index on street claims: 1 claim per rep per street per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_street_claims_unique 
  ON public.street_claims (rep_id, street_name, session_date);

CREATE INDEX IF NOT EXISTS idx_street_claims_date
  ON public.street_claims (session_date, street_name);

CREATE INDEX IF NOT EXISTS idx_knock_events_session
  ON public.knock_events (session_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_knock_events_rep
  ON public.knock_events (rep_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_comm_opps_stage
  ON public.commercial_opportunities (stage, updated_at DESC);

-- 7. Team Property Coverage View (GeoJSON ready)
CREATE OR REPLACE VIEW public.team_property_coverage AS
SELECT DISTINCT ON (
  lower(trim(
    coalesce(payload->>'house_number', coalesce(payload->>'unit_number', '')) || ' ' ||
    coalesce(payload->>'street_name', '')
  ))
)
  lower(trim(
    coalesce(payload->>'house_number', coalesce(payload->>'unit_number', '')) || ' ' ||
    coalesce(payload->>'street_name', '')
  ))                                          AS address_key,
  payload->>'mode'                            AS mode,
  payload->>'company_name'                    AS company_name,
  payload->>'house_number'                    AS house_number,
  payload->>'unit_number'                     AS unit_number,
  payload->>'street_name'                     AS street_name,
  (payload->>'timestamp')::timestamptz        AS last_knocked_at,
  payload->>'outcome_type'                    AS outcome_type,
  payload->>'convo_status'                    AS convo_status,
  payload->>'objection_type'                  AS objection_type,
  (payload->>'lat')::real                     AS lat,
  (payload->>'lng')::real                     AS lng,
  rep_id
FROM public.events
WHERE
  type = 'KNOCK'
  AND (payload->>'lat') IS NOT NULL
  AND (payload->>'lng') IS NOT NULL
  AND trim(
    coalesce(payload->>'house_number', coalesce(payload->>'unit_number', '')) || ' ' ||
    coalesce(payload->>'street_name', '')
  ) != ''
ORDER BY
  lower(trim(
    coalesce(payload->>'house_number', coalesce(payload->>'unit_number', '')) || ' ' ||
    coalesce(payload->>'street_name', '')
  )),
  (payload->>'timestamp')::timestamptz DESC NULLS LAST;

-- 8. Enable Row Level Security (RLS)
ALTER TABLE public.day_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knock_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.street_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_opportunities ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies
-- Day sessions: Users read/write own; authenticated can view for team metrics
CREATE POLICY "sessions_own_rw" ON public.day_sessions FOR ALL USING (auth.uid() = rep_id);
CREATE POLICY "sessions_team_read" ON public.day_sessions FOR SELECT TO authenticated USING (true);

-- Events outbox: Reps insert own, team reads for radar/leaderboards
CREATE POLICY "events_insert_own" ON public.events FOR INSERT WITH CHECK (auth.uid() = rep_id);
CREATE POLICY "events_select_all" ON public.events FOR SELECT TO authenticated USING (true);
CREATE POLICY "events_update_all" ON public.events FOR UPDATE TO authenticated USING (true);

-- Knock events: Reps insert own, team reads
CREATE POLICY "knock_events_rw_own" ON public.knock_events FOR ALL USING (auth.uid() = rep_id);
CREATE POLICY "knock_events_team_read" ON public.knock_events FOR SELECT TO authenticated USING (true);

-- Street claims: Viewable by whole team, managed by claim owner
CREATE POLICY "street_claims_read_all" ON public.street_claims FOR SELECT TO authenticated USING (true);
CREATE POLICY "street_claims_insert_own" ON public.street_claims FOR INSERT WITH CHECK (auth.uid() = rep_id);
CREATE POLICY "street_claims_delete_own" ON public.street_claims FOR DELETE USING (auth.uid() = rep_id);

-- Commercial opportunities: All authenticated team members can read/manage
CREATE POLICY "comm_opps_team_all" ON public.commercial_opportunities FOR ALL TO authenticated USING (true);

GRANT SELECT ON public.team_property_coverage TO authenticated;

-- 10. Outbox Projection Trigger (Projects events into structured tables)
CREATE OR REPLACE FUNCTION project_sales_event()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.type = 'DAY_START' THEN
    INSERT INTO public.day_sessions (id, rep_id, session_date, start_time, status)
    VALUES (
      (NEW.payload->>'session_id')::uuid,
      NEW.rep_id,
      (NEW.payload->>'session_date')::date,
      (NEW.payload->>'start_time')::timestamp with time zone,
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
      (NEW.payload->>'session_id')::uuid,
      COALESCE(NEW.payload->>'mode', 'residential'),
      NEW.payload->>'street_name',
      NEW.payload->>'house_number',
      NEW.payload->>'unit_number',
      NEW.payload->>'postal_code',
      COALESCE(NEW.payload->>'city', 'Toronto'),
      (NEW.payload->>'lat')::real,
      (NEW.payload->>'lng')::real,
      NEW.payload->>'outcome_type',
      NEW.payload->>'convo_status',
      NEW.payload->>'objection_type',
      (NEW.payload->>'callback_time')::timestamp with time zone,
      NEW.payload->>'notes',
      NEW.payload->>'company_name',
      NEW.payload->>'facility_type',
      NEW.payload->>'contact_name',
      NEW.payload->>'contact_title',
      NEW.payload->>'contact_phone',
      NEW.payload->>'contact_email',
      NEW.payload->>'decision_maker_status',
      (NEW.payload->>'walkthrough_date')::timestamp with time zone,
      (NEW.payload->>'contract_mrr')::numeric,
      (NEW.payload->>'square_footage')::integer,
      NEW.payload->>'cleaning_frequency',
      NEW.payload->>'competitor_vendor',
      (NEW.payload->>'competitor_contract_expires_at')::date,
      (NEW.payload->>'timestamp')::timestamp with time zone
    ) ON CONFLICT (id) DO NOTHING;

    -- If outcome is WALKTHROUGH_BOOKED or commercial proposal, also upsert commercial_opportunities
    IF (NEW.payload->>'mode' = 'commercial' AND NEW.payload->>'company_name' IS NOT NULL) THEN
      INSERT INTO public.commercial_opportunities (
        created_by_rep_id, company_name, facility_type, address, unit_number,
        city, lat, lng, dm_name, dm_title, dm_phone, dm_email,
        stage, walkthrough_date, expected_mrr, square_footage,
        cleaning_frequency, competitor_vendor, competitor_contract_expires_at
      ) VALUES (
        NEW.rep_id,
        NEW.payload->>'company_name',
        NEW.payload->>'facility_type',
        NEW.payload->>'street_name',
        NEW.payload->>'unit_number',
        COALESCE(NEW.payload->>'city', 'Toronto'),
        (NEW.payload->>'lat')::real,
        (NEW.payload->>'lng')::real,
        NEW.payload->>'contact_name',
        NEW.payload->>'contact_title',
        NEW.payload->>'contact_phone',
        NEW.payload->>'contact_email',
        CASE 
          WHEN NEW.payload->>'outcome_type' = 'WALKTHROUGH_BOOKED' THEN 'walkthrough_scheduled'
          WHEN NEW.payload->>'outcome_type' = 'PROPOSAL_REQUESTED' THEN 'proposal_sent'
          WHEN NEW.payload->>'outcome_type' = 'SALE' THEN 'won'
          ELSE 'knocked'
        END,
        (NEW.payload->>'walkthrough_date')::timestamp with time zone,
        (NEW.payload->>'contract_mrr')::numeric,
        (NEW.payload->>'square_footage')::integer,
        NEW.payload->>'cleaning_frequency',
        NEW.payload->>'competitor_vendor',
        (NEW.payload->>'competitor_contract_expires_at')::date
      );
    END IF;

  ELSIF NEW.type = 'BREAK_START' THEN
    INSERT INTO public.break_sessions (id, rep_id, session_id, break_start_time)
    VALUES (
      (NEW.payload->>'break_id')::uuid,
      NEW.rep_id,
      (NEW.payload->>'session_id')::uuid,
      (NEW.payload->>'break_start_time')::timestamp with time zone
    ) ON CONFLICT (id) DO NOTHING;

  ELSIF NEW.type = 'BREAK_END' THEN
    UPDATE public.break_sessions
    SET break_end_time = (NEW.payload->>'break_end_time')::timestamp with time zone,
        duration = (NEW.payload->>'duration')::integer
    WHERE id = (NEW.payload->>'break_id')::uuid;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_project_sales_event ON public.events;
CREATE TRIGGER trg_project_sales_event
AFTER INSERT ON public.events
FOR EACH ROW EXECUTE FUNCTION project_sales_event();
