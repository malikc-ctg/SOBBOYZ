-- Claude Sonnet 5.5 Sales Follow-Up Agent, Website/LinkedIn Recon & Multi-Rep Gmail Integration
-- Note: Runtime code also stores OAuth tokens and Inbox Alerts in sales_followup_processed_events
-- and recon in leads.notes JSON so everything works seamlessly even before running DDL.

alter table if exists public.sales_rep_followup_settings
  add column if not exists gmail_refresh_token text,
  add column if not exists gmail_access_token text,
  add column if not exists gmail_token_expiry timestamptz,
  add column if not exists gmail_connected_at timestamptz,
  add column if not exists last_inbox_scan_at timestamptz,
  add column if not exists auto_send_no_answer boolean not null default true,
  add column if not exists auto_send_delay_mins integer not null default 20;

alter table if exists public.sales_followup_tasks
  add column if not exists ai_draft_subject text,
  add column if not exists ai_draft_body text,
  add column if not exists ai_recon_summary jsonb,
  add column if not exists auto_send_at timestamptz,
  add column if not exists gmail_message_id text,
  add column if not exists gmail_thread_id text;

create table if not exists public.sales_inbox_alerts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  rep_id uuid not null,
  rep_email text not null,
  from_email text not null,
  subject text,
  snippet text,
  classification text not null check (classification in (
    'interested', 'question', 'out_of_office', 'referral', 'not_interested', 'unanswered_reminder'
  )),
  ai_summary text,
  ai_suggested_reply text,
  ooo_return_date timestamptz,
  referral_contact jsonb,
  gmail_message_id text unique,
  gmail_thread_id text,
  status text not null default 'unread' check (status in ('unread', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sales_inbox_alerts enable row level security;
revoke all on public.sales_inbox_alerts from anon, authenticated;
