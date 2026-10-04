-- Migration: Create ad_spend_logs table and calculate_weekly_pnl RPC function

CREATE TABLE IF NOT EXISTS ad_spend_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES zones(id) ON DELETE SET NULL, -- NULL indicates global / all-zone campaign
  channel TEXT NOT NULL CHECK (channel IN ('lsa', 'meta', 'google_ads', 'tiktok', 'flyers', 'other')),
  week_start_date DATE NOT NULL,
  week_end_date DATE NOT NULL,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

-- Indexes for date range and channel performance querying
CREATE INDEX IF NOT EXISTS idx_ad_spend_dates ON ad_spend_logs(week_start_date, week_end_date);
CREATE INDEX IF NOT EXISTS idx_ad_spend_zone ON ad_spend_logs(zone_id);
CREATE INDEX IF NOT EXISTS idx_ad_spend_channel ON ad_spend_logs(channel);

-- Enable RLS
ALTER TABLE ad_spend_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Admins have full access to ad_spend_logs" ON ad_spend_logs;
CREATE POLICY "Admins have full access to ad_spend_logs" ON ad_spend_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- Dynamic Weekly PNL RPC Function
CREATE OR REPLACE FUNCTION calculate_weekly_pnl(
  p_start_date DATE,
  p_end_date DATE,
  p_zone_id UUID DEFAULT NULL
)
RETURNS TABLE (
  zone_id UUID,
  period_label TEXT,
  jobs_completed BIGINT,
  gross_revenue NUMERIC,
  total_employee_payouts NUMERIC,
  gross_profit NUMERIC,
  total_ad_spend NUMERIC,
  net_profit NUMERIC,
  gross_margin_pct NUMERIC,
  net_margin_pct NUMERIC,
  roas NUMERIC,
  avg_ticket NUMERIC,
  recurring_jobs BIGINT,
  one_time_jobs BIGINT,
  new_customers_count BIGINT,
  cac NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH job_stats AS (
    SELECT
      j.zone_id,
      COUNT(j.id) AS completed_count,
      COALESCE(SUM(COALESCE(j.final_price, j.quoted_price)), 0) AS rev,
      COALESCE(SUM(COALESCE(j.employee_payout_amount, 0)), 0) AS payouts,
      COALESCE(AVG(COALESCE(j.final_price, j.quoted_price)), 0) AS avg_tkt,
      COUNT(j.id) FILTER (WHERE j.recurring_booking_id IS NOT NULL) AS rec_count,
      COUNT(j.id) FILTER (WHERE j.recurring_booking_id IS NULL) AS single_count
    FROM jobs j
    WHERE j.status IN ('completed', 'reviewed', 'paid_out')
      AND j.scheduled_date::DATE >= p_start_date
      AND j.scheduled_date::DATE <= p_end_date
      AND (p_zone_id IS NULL OR j.zone_id = p_zone_id)
    GROUP BY j.zone_id
  ),
  ad_stats AS (
    SELECT
      a.zone_id,
      COALESCE(SUM(a.amount), 0) AS ad_spend
    FROM ad_spend_logs a
    WHERE a.week_start_date <= p_end_date
      AND a.week_end_date >= p_start_date
      AND (p_zone_id IS NULL OR a.zone_id = p_zone_id OR a.zone_id IS NULL)
    GROUP BY a.zone_id
  ),
  new_cust AS (
    SELECT
      c.zone_id,
      COUNT(c.id) AS cust_count
    FROM customers c
    WHERE c.created_at::DATE >= p_start_date
      AND c.created_at::DATE <= p_end_date
      AND (p_zone_id IS NULL OR c.zone_id = p_zone_id)
    GROUP BY c.zone_id
  )
  SELECT
    js.zone_id,
    'weekly'::TEXT AS period_label,
    js.completed_count,
    js.rev,
    js.payouts,
    (js.rev - js.payouts) AS gross_profit,
    COALESCE(ads.ad_spend, 0) AS total_ad_spend,
    (js.rev - js.payouts - COALESCE(ads.ad_spend, 0)) AS net_profit,
    CASE WHEN js.rev > 0 THEN ((js.rev - js.payouts) / js.rev) * 100 ELSE 0 END AS gross_margin_pct,
    CASE WHEN js.rev > 0 THEN ((js.rev - js.payouts - COALESCE(ads.ad_spend, 0)) / js.rev) * 100 ELSE 0 END AS net_margin_pct,
    CASE WHEN COALESCE(ads.ad_spend, 0) > 0 THEN js.rev / ads.ad_spend ELSE 0 END AS roas,
    js.avg_tkt,
    js.rec_count,
    js.single_count,
    COALESCE(nc.cust_count, 0) AS new_customers_count,
    CASE WHEN COALESCE(nc.cust_count, 0) > 0 THEN COALESCE(ads.ad_spend, 0) / nc.cust_count ELSE 0 END AS cac
  FROM job_stats js
  LEFT JOIN ad_stats ads ON js.zone_id = ads.zone_id OR ads.zone_id IS NULL
  LEFT JOIN new_cust nc ON js.zone_id = nc.zone_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION calculate_weekly_pnl(DATE, DATE, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_weekly_pnl(DATE, DATE, UUID) TO service_role;

-- Seed Historical LSA Ad Spend Logs (June 16 - August 31, 2026)
INSERT INTO ad_spend_logs (channel, week_start_date, week_end_date, amount, conversions, notes)
VALUES
  ('lsa', '2026-08-25', '2026-08-31', 790.47, 23, 'Google LSA Activity (23 leads). Includes promotion credit adjustment'),
  ('lsa', '2026-08-18', '2026-08-24', 501.00, 11, 'Google LSA Activity (11 leads)'),
  ('lsa', '2026-08-11', '2026-08-17', 220.41, 5, 'Google LSA Activity (5 leads)'),
  ('lsa', '2026-08-04', '2026-08-10', 444.00, 11, 'Google LSA Activity (11 leads)'),
  ('lsa', '2026-07-28', '2026-08-03', 342.25, 18, 'Google LSA Activity (18 leads). Includes promotion credit adjustment'),
  ('lsa', '2026-07-21', '2026-07-27', 679.27, 31, 'Google LSA Activity (31 leads)'),
  ('lsa', '2026-07-14', '2026-07-20', 750.10, 35, 'Google LSA Activity (35 leads)'),
  ('lsa', '2026-07-07', '2026-07-13', 866.21, 35, 'Google LSA Activity (35 leads)'),
  ('lsa', '2026-06-30', '2026-07-06', 373.44, 21, 'Google LSA Activity (21 leads)'),
  ('lsa', '2026-06-23', '2026-06-29', 402.45, 19, 'Google LSA Activity (19 leads)'),
  ('lsa', '2026-06-16', '2026-06-22', 272.15, 9, 'Google LSA Activity (9 leads)')
ON CONFLICT DO NOTHING;
