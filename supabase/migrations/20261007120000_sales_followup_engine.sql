-- Sales follow-up engine. New tables have RLS on, no policies and no grants to anon or
-- authenticated. Access only through API routes that check the session and use the service role.

create table if not exists public.sales_followup_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  sequence_key text not null check (sequence_key in (
    'no_answer_drip','pickup_followup','info_sent_followup','walkthrough','quote_followup',
    'callback','job_won','recheck','referral_intro','reply_call','reply_info')),
  lane text not null check (lane in ('prospect','callback','customer')),
  status text not null default 'active'
    check (status in ('active','held','paused','completed','cancelled')),
  hold_reason text,
  paused_until timestamptz,
  owner_rep_id uuid,
  trigger_event_id uuid,
  anchor_at timestamptz not null default now(),
  company_key text,
  context jsonb not null default '{}'::jsonb,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- At most one open enrollment per lead in the prospect lane and in the callback lane.
-- The customer lane allows several (a customer can win more than one job).
create unique index if not exists sales_fu_enr_one_open_per_lane
  on public.sales_followup_enrollments (lead_id, lane)
  where status in ('active','held','paused') and lane in ('prospect','callback');

-- The no-answer drip happens once per lead, ever.
create unique index if not exists sales_fu_enr_drip_once
  on public.sales_followup_enrollments (lead_id)
  where sequence_key = 'no_answer_drip';

create index if not exists sales_fu_enr_lead on public.sales_followup_enrollments (lead_id);
create index if not exists sales_fu_enr_company_open
  on public.sales_followup_enrollments (company_key)
  where status in ('active','held','paused');

create table if not exists public.sales_followup_tasks (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.sales_followup_enrollments(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  step_key text not null,
  kind text not null check (kind in ('email','call','todo')),
  template_key text,
  title text not null,
  details text,
  due_at timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending','done','skipped','cancelled')),
  result text,
  assigned_rep_id uuid,
  opened_at timestamptz,
  completed_at timestamptz,
  completed_by uuid,
  sent_to text,
  rendered_subject text,
  rendered_body text,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists sales_fu_task_step_once
  on public.sales_followup_tasks (enrollment_id, step_key);
create index if not exists sales_fu_task_pending_rep
  on public.sales_followup_tasks (assigned_rep_id, due_at) where status = 'pending';
create index if not exists sales_fu_task_lead on public.sales_followup_tasks (lead_id, status);

create table if not exists public.sales_lead_flags (
  lead_id uuid primary key references public.leads(id) on delete cascade,
  email_opt_out_at timestamptz,
  bounced_email text,
  bounced_at timestamptz,
  do_not_contact_at timestamptz,
  needs_email_since timestamptz,
  last_no_answer_at timestamptz,
  warm_at timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.sales_rep_followup_settings (
  rep_id uuid primary key,
  signature_name text not null,
  signature_title text,
  signature_phone text not null default '(437) 475-1622',
  gmail_address text,
  updated_at timestamptz not null default now()
);

-- Seed Malik Campbell
insert into public.sales_rep_followup_settings (rep_id, signature_name, signature_title)
select 'd616b5ed-d3a0-425d-b0c2-5f47a9320fc5'::uuid, 'Malik Campbell', 'Founder & CEO'
where exists (select 1 from public.profiles where id = 'd616b5ed-d3a0-425d-b0c2-5f47a9320fc5'::uuid)
on conflict (rep_id) do nothing;

create table if not exists public.sales_followup_processed_events (
  event_id uuid primary key,
  lead_id uuid,
  outcome_type text,
  summary jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists events_phone_contact_id_idx
  on public.events ((payload->>'contact_id')) where type = 'PHONE_CALL';

alter table public.sales_followup_enrollments enable row level security;
alter table public.sales_followup_tasks enable row level security;
alter table public.sales_lead_flags enable row level security;
alter table public.sales_rep_followup_settings enable row level security;
alter table public.sales_followup_processed_events enable row level security;

revoke all on public.sales_followup_enrollments from anon, authenticated;
revoke all on public.sales_followup_tasks from anon, authenticated;
revoke all on public.sales_lead_flags from anon, authenticated;
revoke all on public.sales_rep_followup_settings from anon, authenticated;
revoke all on public.sales_followup_processed_events from anon, authenticated;

-- Phase 0.7: cards hidden by unmatched statuses.
update public.leads set status = 'no_answer', updated_at = now()
  where status = 'voicemail'
    and (source in ('phone_sales_os','contact_import','apollo') or company_name ilike '%Apex Edge%');
update public.leads set status = 'quoted', updated_at = now()
  where status = 'info_sent'
    and (source in ('phone_sales_os','contact_import','apollo') or company_name ilike '%Apex Edge%');
update public.leads set status = 'won', updated_at = now()
  where status = 'job_won'
    and (source in ('phone_sales_os','contact_import','apollo') or company_name ilike '%Apex Edge%');
