# SOB Sales Follow-Up Engine: Build Prompt for Antigravity

Repo: `malikc-ctg/SOBBOYZ` (Next.js 14 app router, Supabase, sales UI in JS/JSX, API routes in TS).
Surface: Sales OS, Phone tab, Kanban board at `/sobadmin/sales` (`components/sales/phone/`).

---

## 0. How to run this task

1. If this text was pasted into chat, first save it verbatim as `docs/sales-followups/SPEC.md`. Re-read that file whenever you need a detail. It is the source of truth for every rule, timing and string below.
2. Work in Planning mode. Before changing any code, produce an Implementation Plan and a Task List covering Phases 0 to 6, then stop and wait for my approval.
3. Create branch `feature/sales-followups`. Commit at the end of each phase. After each phase run `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build`. All four must pass before you start the next phase.
4. Ask me these before Phase 2. They block the build:
   - a. The company mailing address for the email footer (Canada's anti-spam law requires it in every commercial email). Do not invent one. Until it is set, every "Open in Gmail" button stays disabled with the message "Add the company mailing address in follow-up settings".
   - b. Email signature titles for Raahim Ahmed and Ayaan Baig. Malik Campbell's is "Founder & CEO".
   - c. Where to apply the migration. Never run SQL against production. If `.env.local` points at a local or dev Supabase project you may apply it there. Otherwise hand me the file and wait.
5. Do not reformat or reorganize existing files. `PhoneTab.jsx` (1,632 lines) and `LeadDossierModal.jsx` (1,776 lines) get small, surgical edits only. Put new UI in new files under `components/sales/phone/followups/`. Put new logic under `lib/sales/followups/`.
6. Every user-facing string in this spec (email copy, button labels, card text, toasts) is final. Use it exactly. Never put an em dash or en dash in any copy.
7. One new dependency is allowed: `@date-fns/tz` (time zone support for the installed date-fns v4). Ask before adding anything else.
8. When everything is built, use the browser on localhost to run the scenarios in Appendix F and produce a walkthrough with screenshots.

---

## 1. What we are building

A follow-up engine for the B2B phone sales board. When a rep logs a call outcome, the engine starts, changes or stops a follow-up sequence for that lead. Each sequence step is a task with a due date:

- an email the rep sends through a pre-filled Gmail compose link (the rep reviews it and clicks Send in Gmail; nothing sends automatically),
- a call, or
- an internal to-do.

Tasks show up on the existing kanban lead cards (a follow-up strip at the bottom of each card) and in a new Follow-ups view of the same board, where columns are due buckets.

Decisions already made. Do not re-ask or change them:

- Sending is manual through Gmail compose links from the rep's own Google Workspace mailbox. No Gmail API. Do not use Resend for these emails.
- Only a rep-logged No Answer starts the no-answer drip. Voicemail never starts it and never stops it.
- A lead gets the no-answer drip at most once, ever. Repeat No Answer dials never restart or duplicate it.
- Leads without an email are not enrolled. They get an "Add email" prompt instead.
- "Info Sent / Spec Sheet" means the rep already sent the info.
- Every email is plain text and short: one direct question or one confirmation. It never asks for a meeting or a block of the prospect's time, makes no invented claims, and never uses abbreviations like PM, CM or GC.
- Every email carries the sender's signature and a footer with the mailing address and an unsubscribe line.
- Logged outcomes keep the existing +1 dial rule. Follow-up emails, replies and task actions never add dials.
- Sequences and templates live in code for this version (reviewable in git). No template editor.

---

## 2. Verified repo facts

Read these before planning. Line numbers are approximate.

### 2.1 Outcome logging paths

- **Dossier "Log Outcome" menu.** `components/sales/phone/LeadDossierModal.jsx`: `OUTCOME_OPTIONS` (line 41) and `handleSelectOutcome` (line 199). The 9 rep outcomes: `NO_ANSWER`, `VOICEMAIL`, `CONVO` (label "Pick Up / Connected"), `INFO_SENT`, `WALKTHROUGH`, `JOB_WON`, `CALLBACK`, `NOT_INTERESTED`, `OUT_OF_SERVICE`.
  - `OUT_OF_SERVICE`: confirm dialog, then `PhoneTab.handleKanbanDeleteLead` (line 555) logs the event and hard-deletes the lead.
  - `WALKTHROUGH`: opens `WalkthroughModal`; `PhoneTab.confirmWalkthroughBooking` (line 680) logs it with `callbackTime = "YYYY-MM-DD HH:MM"` (Toronto local time, no zone) and `saleDetails { estimated_value, site_address, scope }`. Site contact name and phone only exist inside the notes string. The modal's default site address is `"<city> Job Site"`.
  - Every other outcome calls `PhoneTab.handleKanbanOneClickOutcome` (line 458) with canned notes and no capture. There is no callback date or time input anywhere in the UI. `JOB_WON` logs no amount.
- **Kanban drag.** `SalesKanbanBoard.handleDrop` calls `PhoneTab.handleKanbanUpdateStatus` (line 398). It PATCHes the status, then logs an event whose outcome is `JOB_WON` for won, `INFO_SENT` for quoted, `NO_ANSWER` for no_answer and `CONVO` for every other column.
- `PhoneTab.handleDisposition` is dead code (never called), and it is the only thing that opens the Sale modal, so the Sale modal is unreachable too. Leave both alone.
- **Quo webhook** `app/api/sales/webhooks/quo/route.ts` writes `PHONE_CALL` events straight to the events table, not through `/api/sales/calls`. It labels a missed INBOUND call as `NO_ANSWER` (line 110) and logs `SMS_INBOUND` and `SMS_OUTBOUND` events. It matches leads by phone number.
- **Offline path.** `lib/sales/phoneService.js` `logCallEvent` saves the event locally with a client UUID, then POSTs `/api/sales/calls`. If that POST fails, `lib/sales/syncEngine.js` later upserts the raw event through `app/api/sales/sync/route.ts`, which writes the events table only (no lead status update).

### 2.2 Server behavior in `app/api/sales/calls/route.ts` POST

- Generates its own `event_id` and ignores the client one.
- Sets `leads.status = outcome_type.toLowerCase()`, except WALKTHROUGH to `walkthrough_booked`, SEND_QUOTE to `quoted`, CALLBACK to `contacted`, SALE to `won`, NOT_INTERESTED to `lost`.
- Overwrites `leads.notes` with the call notes whenever notes are present.
- Writes `callback_time` into `leads.preferred_date`, which is a DATE column, so the time of day is lost.

### 2.3 Board columns

`SalesKanbanBoard.jsx` `STAGES` (line 26): `new`, `no_answer` (also matches `no_answers`, `unreachable`), `contacted` (also matches `convo`), `walkthrough_booked`, `quoted`, `won`, `lost`.

### 2.4 Bugs this causes (Phase 0 fixes all of them)

1. VOICEMAIL writes status `voicemail`, INFO_SENT writes `info_sent`, JOB_WON writes `job_won`. No column matches, so those cards vanish from the board after a reload.
2. Dragging to Walkthrough Booked, Lost or New logs CONVO, and the server then overwrites the dropped status with `convo`, so the card jumps to Contacted on reload. Dragging to Won or Quote Sent writes `job_won` or `info_sent` and the card vanishes.
3. Every logged outcome replaces `leads.notes` with canned text such as "Outbound call: No Answer / Rang out". That erases the rep's Live Rep Notes and the Apollo intel JSON stored in the same column (direct and mobile phones, LinkedIn, website, address).
4. A no-answer dial on a lead that is already in Walkthrough Booked or Quote Sent moves it back to No Answer.
5. `logCallEvent` never sends `companyName` (it is not destructured), so `events.payload.company_name` is always empty and the company-wide timeline never matches colleagues.
6. `SalesKanbanBoard.jsx` calls `setOpenMoreActionsId(null)` (line 691), but that state does not exist. Clicking a card's sector chip throws a ReferenceError.

### 2.5 Data and auth

- Lead fields used here: `leads.customer_name` (UI `name`), `customer_email` (UI `email`), `contact_title` (UI `position`), `company_name` (UI `company`; placeholder "Commercial Prospect" when missing), `city`, `status`, `source`. The board loads sources `phone_sales_os`, `contact_import`, `apollo` (plus company names like "Apex Edge").
- `leads` and `events` are readable and writable with the anon key (permissive RLS plus GRANT ALL). Do not copy that pattern for the new tables.
- `lib/api-auth.ts` `requireAuth` never returns 401. With no session it falls back to an admin profile. Do not use it for new routes.
- `lib/supabase/server.ts`: `createClient()` reads the cookie session that `/sobadmin/login` sets; `createServiceClient()` uses the service role.
- `/sobadmin/sales` loads without login and falls back to Malik's UUID `07853cdf-ed2c-4f3b-b713-cde7c40e20a1` when signed out.
- `LeadDossierModal` and `WalkthroughModal` return null before their hooks run (a rules-of-hooks violation that exists today). Do not add hooks to them. New panels are separate components with their own hooks.
- Toasts: `sonner` is mounted in `app/layout.tsx`. Use `import { toast } from 'sonner'`.
- Tests: vitest, pattern `lib/**/*.test.ts`.
- Rep identity in PhoneTab: `activeRepId = user?.id || fallback`; `activeRepName` comes from `normalizeRepName`.

---

## 3. Phase 0: Fix the outcome pipeline

Required before any follow-up code, because the engine trusts outcome events and lead status.

### 0.1 Shared status rule

Create `lib/sales/followups/leadStatus.ts` with `normalizeStatus(s)` and `nextLeadStatus(current, outcome, explicit)`.

`normalizeStatus` is for ranking only (never rewrite stored values with it): `voicemail`, `no_answers`, `unreachable` become `no_answer`; `convo` becomes `contacted`; `info_sent` becomes `quoted`; `job_won` becomes `won`; null or empty becomes `new`.

Rank: `new` 0, `no_answer` 1, `contacted` 2, `walkthrough_booked` 3, `quoted` 4, `won` 5. `lost` has no rank.

`nextLeadStatus` returns the new status or null for "no change":

| Outcome | Result |
|---|---|
| any, with `explicit` set (board drag) | `explicit` |
| any, when current normalizes to `won` | null (Won is sticky; only a drag changes it) |
| NO_ANSWER, VOICEMAIL, BAD_NUMBER | `no_answer` if current rank is 0 or 1; else null (Lost stays Lost) |
| CONVO, GATEKEEPER | `convo` if current rank is below 2 or current is `lost`; else null |
| CALLBACK | `contacted`, same condition as CONVO |
| INFO_SENT, SEND_QUOTE | `quoted`, unless current is `walkthrough_booked` (then null; the engine decides, see rule R6) |
| WALKTHROUGH | `walkthrough_booked` |
| JOB_WON, SALE | `won` |
| NOT_INTERESTED | `lost` |
| OUT_OF_SERVICE, STATUS_MOVE without explicit, SMS_* | null |

### 0.2 `app/api/sales/calls/route.ts` POST

- Accept `event_id` from the body when it is a valid UUID, otherwise generate one. Insert the event. On a unique violation, treat it as already processed and return 200 with `{ success: true, duplicate: true }` and no side effects.
- Read the lead's current status, then apply `nextLeadStatus(lead.status, outcome_type, body.lead_status)`. Skip the update when it returns null. Keep the existing `preferred_date` write.
- Stop writing `leads.notes`. Call notes already live in the event payload, and the board reads `last_notes` from events.
- After the status update, run the follow-up engine (Phase 5). Catch engine errors, report them with `Sentry.captureException`, and never fail the request because of them. Add the engine summary to the JSON response as `followup`.

### 0.3 `lib/sales/phoneService.js` `logCallEvent`

Add parameters `companyName`, `leadStatus`, `followup`. Send `event_id: eventId`, `company_name: companyName`, `lead_status: leadStatus` and `followup` in the POST body. Include `company_name` and `followup` in the local payload so offline sync carries them. Return `{ success, event_id, followup }` using the server JSON when the POST succeeds.

### 0.4 Kanban drag

A drop no longer changes status immediately. Route by target column:

| Target column | Behavior |
|---|---|
| No Answer | log `NO_ANSWER` now |
| New | log `STATUS_MOVE` with `leadStatus: 'new'` now (keeps the +1 dial rule; the engine ignores it) |
| Contacted / In Progress | small menu at the drop point: "Pick Up / Connected" (opens the Pick-Up modal) or "Schedule Callback" (opens the Callback modal) |
| Walkthrough Booked | open the existing `WalkthroughModal` (the `onOpenWalkthrough` prop already exists) |
| Quote Sent | log `INFO_SENT` now |
| Won | open the Job Won modal |
| Lost | open the Not Interested modal |

If the rep cancels a modal, nothing is logged and the card stays where it was. Every confirmed drop sends `leadStatus` equal to the target column, so the card lands where it was dropped.

### 0.5 One shared outcome function

In PhoneTab, add `logOutcome(contact, outcomeKey, capture)`, used by the dossier menu, the board drag and the new modals. It calls `logCallEvent`, updates local state from the response, refreshes follow-ups and shows the engine toast.

`handleKanbanOneClickOutcome` becomes: if the outcome needs a capture modal (CONVO, CALLBACK, NOT_INTERESTED, JOB_WON), open it and return `{ pending: true }`; otherwise call `logOutcome`. In `LeadDossierModal.handleSelectOutcome`, show the "Logged" feedback only when the result is not pending. Capture modals open above the dossier (higher z-index); the dossier stays open underneath.

### 0.6 ReferenceError

Remove the `setOpenMoreActionsId(null)` call in `SalesKanbanBoard.jsx`.

### 0.7 Hidden cards data fix

Part of the Phase 1 migration: move B2B leads with status `voicemail` to `no_answer`, `info_sent` to `quoted`, `job_won` to `won`. Before applying, run a SELECT and report the counts to me.

### Phase 0 acceptance

- Log each of the 9 outcomes from the dossier on a test lead, reload, and confirm: No Answer to No Answer; Voicemail to No Answer (cold lead) or unchanged; Pick Up to Contacted; Info Sent to Quote Sent; Walkthrough to Walkthrough Booked; Job Won to Won; Callback to Contacted; Not Interested to Lost; Out of Service deletes the lead.
- Drag to each column and reload: the card stays where it was dropped.
- Rep notes saved in the dossier survive logging any outcome.
- A lead in Walkthrough Booked that gets No Answer stays in Walkthrough Booked.
- Dials still increase by exactly 1 per logged outcome or completed drag.

---

## 4. Phase 1: Migration

File: `supabase/migrations/20261007120000_sales_followup_engine.sql`. Keep these semantics; adjust names only if they collide.

```sql
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

insert into public.sales_rep_followup_settings (rep_id, signature_name, signature_title)
select '07853cdf-ed2c-4f3b-b713-cde7c40e20a1'::uuid, 'Malik Campbell', 'Founder & CEO'
where exists (select 1 from public.profiles where id = '07853cdf-ed2c-4f3b-b713-cde7c40e20a1'::uuid)
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

-- Phase 0.7: cards hidden by unmatched statuses. Report counts before applying.
update public.leads set status = 'no_answer', updated_at = now()
  where status = 'voicemail'
    and (source in ('phone_sales_os','contact_import','apollo') or company_name ilike '%Apex Edge%');
update public.leads set status = 'quoted', updated_at = now()
  where status = 'info_sent'
    and (source in ('phone_sales_os','contact_import','apollo') or company_name ilike '%Apex Edge%');
update public.leads set status = 'won', updated_at = now()
  where status = 'job_won'
    and (source in ('phone_sales_os','contact_import','apollo') or company_name ilike '%Apex Edge%');
```

---

## 5. Phase 2: Engine (`lib/sales/followups/`)

### 5.1 Modules

| File | Purpose |
|---|---|
| `config.ts` | Appendix E values |
| `types.ts` | shared types |
| `leadStatus.ts` | Phase 0.1 |
| `company.ts` | `companyKey(name)`: lowercase, drop the words inc, incorporated, ltd, limited, corp, corporation, group, llc, gsc, co, then drop every non-alphanumeric character. Returns null for empty or "Commercial Prospect" |
| `schedule.ts` | Toronto time, business days, due dates, overdue state, buckets |
| `sequences.ts` | Appendix A as data |
| `templates.ts` | Appendix C as functions `(ctx) => { subject, body }` |
| `render.ts` | builds the merge context, assembles greeting, body, sign-off, signature and footer, validates the result |
| `compose.ts` | Gmail compose URL and inbox search URL |
| `rules.ts` | pure planner: `planForOutcome`, `planForTaskAction`, `planForSignal`. State in, list of actions out. No I/O |
| `executor.ts` | server only: loads state, calls the planner, writes actions, records the processed event |

`templates.ts`, `render.ts`, `compose.ts`, `schedule.ts`, `sequences.ts` and `config.ts` must not import server-only code: the client imports them to render previews and build links.

### 5.2 Scheduling (rule R8)

- All date math in America/Toronto with `@date-fns/tz`. Daylight saving time ends Nov 1, 2026; tests must cover it.
- Business day: Monday to Friday and not in `config.holidays`.
- Email step at "Day N": target is the anchor's Toronto date plus N calendar days at 9:00 AM, moved forward to the next business day. Day 0 is due immediately at the trigger time and is never moved.
- Spacing: steps are created one at a time, when the previous step completes (sent or skipped). Step n+1 is due at the later of (a) its own target and (b) step n's completion date plus (offset of n+1 minus offset of n) days, at 9:00 AM. Then move it to a business day. A late send therefore pushes the rest of the sequence back instead of stacking emails.
- Exact-time steps (callbacks, the walkthrough visit) are never moved.
- Helpers: "next business day at HH:MM", "N business days later at HH:MM", "previous business day at HH:MM".
- If a computed due time is already past (for example after a resume), the task is due now.
- Overdue: email and to-do tasks at the end of their due day (11:59 PM Toronto); call tasks 30 minutes after due; per-step overrides in Appendix A.
- Buckets for the Follow-ups view: Overdue; Due today (due by the end of today, not overdue); Upcoming (due in the next 7 days); Later.

### 5.3 Rendering

See the Appendix C header for merge fields and assembly. The renderer must throw (and the UI must disable the send button with the error) if the output contains `{{`, `}}`, `undefined`, `null`, two spaces in a row, or a space before punctuation.

### 5.4 Gmail links (`compose.ts`)

Encode with `encodeURIComponent` (not `URLSearchParams`, which turns spaces into `+`).

```ts
const enc = encodeURIComponent;

export function gmailComposeUrl(o: { from?: string; to: string; subject: string; body: string }) {
  const base =
    'https://mail.google.com/mail/?' +
    (o.from ? `authuser=${enc(o.from)}&` : '') +
    `view=cm&fs=1&to=${enc(o.to)}&su=${enc(o.subject)}`;
  const full = `${base}&body=${enc(o.body)}`;
  return full.length <= 2000 ? { url: full, clipboardBody: null } : { url: base, clipboardBody: o.body };
}

export function gmailSearchUrl(o: { from?: string; leadEmail: string }) {
  const q = enc(`from:${o.leadEmail} OR to:${o.leadEmail}`).replace(/%20/g, '+');
  return 'https://mail.google.com/mail/' + (o.from ? `?authuser=${enc(o.from)}` : '') + `#search/${q}`;
}
```

When `clipboardBody` is set, copy the body to the clipboard on click and toast "Body copied. Paste it into the email." Test both links in a real browser during Phase 6.

### 5.5 Planner algorithm (`rules.ts`)

`planForOutcome(input)`, where input holds the event, the outcome, the capture (`payload.followup`), now, and the lead state (lead, flags, open enrollments with pending tasks, warm flag, company and duplicate-email guard results):

1. Ignore `STATUS_MOVE`, `SMS_*`, `BAD_NUMBER` and unknown outcomes.
2. Normalize legacy keys: `SEND_QUOTE` to `INFO_SENT`, `SALE` to `JOB_WON`, `GATEKEEPER` to `CONVO` with "log without follow-up".
3. `OUT_OF_SERVICE`: cancel every open enrollment (end_reason `out_of_service`) and stop. The lead delete then cascades.
4. If the lead is marked do not contact: plan nothing and report `blocked_dnc`.
5. Resolve due call tasks (rule R3, then R4 for callbacks).
6. Apply the outcome row of the Appendix B matrix.
7. If the outcome is `NO_ANSWER`, try rule R1 (drip start).
8. If the outcome is a connected outcome, set `warm_at` (rule R2).

`planForTaskAction` handles sent, skip, done with a result, reschedule and undo, using Appendix A. `planForSignal` handles replies, inbound calls and texts, bounce, unsubscribe, do not contact, pause, resume, stop, held decisions, manual drip start and backfill.

An enrollment is completed when it has no pending tasks and no dynamic step is waiting to be created.

### 5.6 Executor

- Idempotency first: insert into `sales_followup_processed_events`. If the row already exists, return `{ skipped: 'duplicate' }`.
- Writes are sequential. Unique indexes block duplicates. On a unique violation while creating an enrollment, reload state and re-plan once.
- Task updates use `where status = 'pending'`, so double clicks and two reps cannot complete the same task twice. Return 409 to the second caller; the UI toasts "Already handled".
- Every cancellation sets `ended_at` and `end_reason` on the enrollment and `cancel_reason` on its pending tasks.
- Repeatable dynamic steps get numbered keys (`wt_rescheduled_2`, `inbound_call_3`) so the per-enrollment unique index holds.
- Return a summary: `{ started, cancelled, held, notes, statusOverride, toast }`. Toast copy is in Appendix D.
- `assigned_rep_id` is the signed-in user when known, otherwise the event's `rep_id`. `owner_rep_id` on the enrollment is the same.

### 5.7 Unit tests (must exist and pass)

Every row of the Appendix B matrix, rules R1 to R8, the DST boundary, every holiday in config, spacing after late and skipped sends, every template variant in Appendix C (exact text match), the output validator, first-name parsing (Appendix C cases), company keys, compose URL encoding and the 2,000 character fallback, and `nextLeadStatus` for every row in 0.1.

---

## 6. Phase 3: API routes

Every new route checks the session with `createClient()` and `auth.getUser()` and returns 401 `{ error: 'sign_in_required' }` when there is no user. Data access uses `createServiceClient()`. Validate bodies with zod (already installed).

- `GET /api/sales/followups/board`: the signed-in rep's settings; config flags (`mailingAddressSet`); and for every lead with an open enrollment, a pending task, a flag or a finished drip: `{ leadId, enrollments (open ones plus the last ended drip), nextTask, otherPendingCount, flags }`; plus bucket counts for Mine and All reps. Lazily reactivate paused enrollments whose `paused_until` has passed.
- `GET /api/sales/followups/lead/[leadId]`: every enrollment with all of its tasks, flags, saved notes and sent-email snapshots (for the dossier panel).
- `POST /api/sales/followups/tasks/[taskId]` with `{ action, ... }`:
  - `open`: set `opened_at`.
  - `sent { subject, body, to }`: status done, result `sent`, store the snapshots and `completed_by`, then plan the next step.
  - `not_sent`: clear `opened_at`.
  - `skip`: status skipped, then plan the next step.
  - `done { result?, note? }`: call and to-do tasks. Results for the visit and job checks are in Appendix A.
  - `reschedule { dueAt }`: call and to-do tasks. Callbacks and walkthroughs use their own actions below.
  - `reassign`: `assigned_rep_id` becomes the caller.
  - `undo`: allowed within 10 seconds of sent, skip or done, and only if the step it created has not been opened. Reverts the task and deletes the created step.
- `POST /api/sales/followups/lead/[leadId]` with `{ action, ... }`:
  - `replied { kind }` (rule R7)
  - `bounced`, `unsubscribe`, `do_not_contact`, `clear_flag { flag }`
  - `pause { until? }`, `resume`, `stop { enrollmentId }`
  - `start_held { enrollmentId }`, `skip_held { enrollmentId }`
  - `start_drip` (manual start for a "needs email" lead once an email exists; anchor is `last_no_answer_at`)
  - `walkthrough_reschedule { walkthroughAt, siteAddress, siteContactName, siteContactPhone, scopePhase, siteNotes }`
  - `callback_reschedule { callbackAt, sendConfirmation }`
  - `quote_details { amount, scope }` (saved before the quote email opens)
  - `add_referral { newLeadId, referrerName }` (after the UI creates the new lead through the existing `POST /api/sales/leads` with `source: 'phone_sales_os'` and the same company)
- `GET` and `PUT /api/sales/followups/settings`: the signed-in rep's signature name, title, phone and Gmail address.
- `POST /api/sales/followups/backfill { dryRun }`: cold leads with a `NO_ANSWER` event in the last 14 days, an email, no drip ever, not unsubscribed and not do-not-contact. A dry run returns the count and names. A real run starts each drip anchored at that lead's last `NO_ANSWER`, so Email 1 renders the "recently" variant.
- Internal function, not a route: `recordInboundSignal(leadId, kind, eventId)` for the Quo hook.

---

## 7. Phase 4: UI

All new components live in `components/sales/phone/followups/`. Match the dark slate and blue Tailwind style of `SalesKanbanBoard.jsx` and `WalkthroughModal.jsx` (`phone-modal-overlay`, `phone-modal-content`).

### 7.1 Loading

PhoneTab fetches `/api/sales/followups/board` alongside `fetchSalesContacts`, after every logged outcome and after every follow-up action. It passes a `followupsByLeadId` map and `followupMeta` to `SalesKanbanBoard` and the dossier. On 401, each card shows one muted line, "Sign in to use follow-ups", linking to `/sobadmin/login`. The pipeline board itself keeps working.

### 7.2 Card strip (`FollowupStrip.jsx`)

Rendered at the bottom of every kanban card in both views. Clicks inside it call `stopPropagation` (cards are draggable and double-click opens the dossier).

- **Line 1:** sequence label and progress (Appendix D), and on the right a due chip: "Due now", "Due today", "Overdue 2d", "Due Fri", "Due Oct 20", or the exact time for calls and visits ("Today 2:30 PM").
- **Line 2:** the next task title (for emails, "Email 2: Next closeout").
- **Buttons by task kind:**
  - Email: "Open in Gmail" is an `<a target="_blank" rel="noopener noreferrer">` whose href is computed during render. Never call `window.open` after an await (popup blockers stop it). The click also fires the `open` action without awaiting it. After opening, show "Mark sent" and "Not sent", plus "Opened 3m ago". "Skip" is always available. From the second email of a sequence on, show a small "Check inbox for a reply" link (Gmail search URL) above the button.
  - Call: "Call" (tel link through the existing `startCall`), "Reschedule", and the hint "Log the outcome after the call".
  - To-do: "Done", or the result chooser for the walkthrough visit and the job completion check.
- **Overflow menu:** They replied, Out of office, Email bounced, Unsubscribe, Pause, Stop this follow-up, Reassign to me, View all steps.
- **States without a task:**
  - Held: "Held: {other lead name} at this company is already in follow-up." or "Held: another lead uses this email." with "Start anyway" and "Skip".
  - Needs email: "No email on file" with "Add email" (opens dossier edit). Once an email exists: "Start drip".
  - Bounced: "Email bounced. Update the email, then Resume."
  - Paused: "Paused until Oct 14" with "Resume".
  - Ended drip: muted "Drip finished" or "Drip stopped: {reason}".
- **Badges:** "Do not contact" (red; hides every follow-up action), "Unsubscribed" (amber; hides email buttons).
- **Disabled email button tooltips:** "No email on file", "Email bounced", "Unsubscribed", "Do not contact", "Add the company mailing address in follow-up settings", "Sign in to use follow-ups".
- When a lead has more than one pending task (for example a callback and a customer task), show the earliest and "+1 more".
- When the task belongs to another rep, show "Assigned to {name}" and still allow every action.

### 7.3 Board controls

In the `SalesKanbanBoard` header: a segmented control "Pipeline | Follow-ups"; in the Follow-ups view also "Mine | All reps" (default Mine); a "Due today: N" chip; a gear button for Follow-up settings. Remember the view choice in localStorage inside try/catch.

### 7.4 Follow-ups view

Same card component. Columns: Overdue, Due today, Upcoming, Later, Needs attention (held, paused, bounced, needs email, opened but not confirmed). Sorted by due time. Drag and drop is off in this view. Empty column text: "Nothing here". The existing search and sector filter still apply.

### 7.5 Dossier panel (`FollowupPanel.jsx`)

Rendered by `LeadDossierModal` above the Outreach Timeline, as its own component (it fetches `/api/sales/followups/lead/[leadId]` itself). Shows open enrollments with every step (done with date, due, upcoming, skipped, cancelled with reason); a live preview of the next email (subject and body, pre-wrap); the same actions as the card; flags with toggles (Unsubscribed, Do not contact, Bounced with "Clear"); a collapsed history of ended enrollments with end reasons; and an "Emails sent" list from the sent snapshots.

### 7.6 Modals

Copy for all of them is in Appendix D: `PickupModal`, `CallbackModal` (also used for callback reschedule), `NotInterestedModal`, `JobWonModal` (also sends `saleDetails { job_total, service_type }` so revenue stats count it), `ReplyModal`, `ReferralModal`, `VisitResultModal`, walkthrough reschedule (reuse `WalkthroughModal` with prefilled values), `QuoteDetailsModal`, `JobResultModal`, `OutOfOfficeModal`, `FollowupSettingsModal`.

### 7.7 Toasts

After an outcome, show the engine summary toast (Appendix D). After Mark sent, Skip and Done, show the toast with an "Undo" action for 10 seconds.

---

## 8. Phase 5: Hooks

- `POST /api/sales/calls`: after the status update, `await runEngineForEvent(eventRow, { sessionUserId })`. If the summary has `statusOverride`, apply it to the lead.
- `POST /api/sales/sync`: for each `PHONE_CALL` event in the batch, apply `nextLeadStatus` only when the event's `created_at` is later than the lead's `updated_at`, then run the engine (deduplicated by event id).
- Quo webhook: after a lead is matched, for an inbound call (any status) or `SMS_INBOUND`, call `recordInboundSignal(leadId, 'inbound_call' | 'inbound_sms', eventId)`. Never start the drip from Quo events: Quo labels a missed inbound call as `NO_ANSWER`, and that prospect was calling us.
- Out of Service: the lead delete cascades. Nothing else is needed.

---

## 9. Phase 6: Verification

- `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` all pass.
- Run Appendix F on localhost in the browser. Produce a walkthrough with screenshots of: a card in each state, the Follow-ups view, each modal, and a pre-filled Gmail compose window.
- Report anything in this spec you could not implement exactly, and why.

Out of scope for this task: the Gmail API (send confirmation, reply detection), SMS follow-ups, a template editor, locking down the existing sales API routes and verifying the Quo webhook signature (a separate task), push notifications.

---

## Appendix A: Sequences

Lanes: `prospect` (at most one open), `callback` (at most one open), `customer` (several allowed).
Types: nurture (emails that stop on a reply), appointment (a scheduled event), waiting (one task, then done).

### A.1 `no_answer_drip` (prospect, nurture)

Anchor: the No Answer event time.

| # | step_key | kind | template | due | overdue |
|---|---|---|---|---|---|
| 1 | drip_email_1 | email | drip_1 | Day 0, immediately | end of day |
| 2 | drip_email_2 | email | drip_2 | Day 4 | end of day |
| 3 | drip_email_3 | email | drip_3 | Day 9 | end of day |
| 4 | drip_email_4 | email | drip_4 | Day 14 | end of day |

Ends (completed) after step 4 is sent or skipped.

### A.2 `pickup_followup` (prospect, nurture)

Anchor: the Pick Up event time. Context: `callNote`, `nextStep`, `projectName` (optional), `notes[]`.

| # | step_key | kind | template | due | overdue |
|---|---|---|---|---|---|
| 1 | pickup_recap | email | pickup_recap | Day 0, immediately | 2 hours after due |
| 2 | pickup_day3 | email | pickup_day3 | Day 3 | end of day |
| 3 | pickup_day7 | email | pickup_day7 | Day 7 | end of day |
| 4 | pickup_day14 | email | pickup_day14 | Day 14 | end of day |
| 5 | pickup_checkin | call | none | 30 days after step 4 completes, 10:00 AM, business day | 30 minutes |

### A.3 `info_sent_followup` (prospect, nurture)

Anchor: the Info Sent event time.

| # | step_key | kind | template | due |
|---|---|---|---|---|
| 1 | info_day2 | email | info_day2 | Day 2 |
| 2 | info_day6 | email | info_day6 | Day 6 |
| 3 | info_day12 | email | info_day12 | Day 12 |
| 4 | info_checkin | call | none | 30 days after step 3 completes, 10:00 AM, business day |

### A.4 `walkthrough` (prospect, appointment)

Context: `walkthroughAt` (parse the modal's "YYYY-MM-DD HH:MM" as Toronto local time and store ISO with offset), `siteAddress`, `siteContactName`, `siteContactPhone`, `scopePhase`, `estimatedValue`, `siteNotes`, `quoteAmount`, `notes[]`.

| # | step_key | kind | template | due | notes |
|---|---|---|---|---|---|
| 1 | wt_confirm | email | wt_confirm | immediately | auto-skipped with result `time_passed` if `walkthroughAt` has passed when it would open |
| 2 | wt_prep | todo | none | previous business day at 4:00 PM before `walkthroughAt`; immediately if that is already past | |
| 3 | wt_visit | todo | none | exactly `walkthroughAt` | overdue 4 hours after; result required: completed, no_show, rescheduled, cancelled |

Dynamic steps:

- `completed`: create `wt_quote` (email, template wt_quote) due 24 hours after the visit is marked done; overdue at that moment.
- `no_show`: create `wt_no_show` (email) due immediately and `wt_reschedule` (to-do) due next business day at 10:00 AM.
- `rescheduled` (from the visit result, the `walkthrough_reschedule` action, or a new Walkthrough outcome while this one is open): cancel pending `wt_prep`, `wt_visit` and `wt_reschedule`; update the context; create `wt_rescheduled` (email) due immediately plus new `wt_prep` and `wt_visit`.
- `cancelled`: create `wt_cancelled_call` (call) due next business day at 10:00 AM.

Ends: when `wt_quote` is sent, the walkthrough completes, `quote_followup` starts with the quote context, and the lead status becomes `quoted` (statusOverride). When `wt_cancelled_call` resolves, the walkthrough completes.

### A.5 `quote_followup` (prospect, nurture)

Anchor: the moment the quote was marked sent. Context: `quoteAmount`, `scopePhase`, `siteAddress`.

| # | step_key | kind | template | due |
|---|---|---|---|---|
| 1 | quote_day2 | email | quote_day2 | Day 2 |
| 2 | quote_day5 | email | quote_day5 | Day 5 |
| 3 | quote_day10 | email | quote_day10 | Day 10 |
| 4 | quote_checkin | call | none | 7 days after step 3 completes, 10:00 AM, business day |

### A.6 `callback` (callback lane, appointment)

Context: `callbackAt`, `note`, `sendConfirmation`.

| # | step_key | kind | template | due | notes |
|---|---|---|---|---|---|
| 1 | cb_confirm | email | cb_confirm | immediately | auto-skipped with result `too_soon` when `callbackAt` is less than 2 hours away at creation or open time, or when the rep unticked "Send a confirmation email" |
| 2 | cb_call | call | none | exactly `callbackAt` | overdue 30 minutes after |

Dynamic steps (rule R4):

- `cb_call` answered by No Answer or Voicemail: create `cb_missed` (email) due immediately and `cb_retry_1` (call) due next business day at the same time of day as `callbackAt`.
- `cb_retry_1` answered by No Answer or Voicemail: create `cb_retry_2` (call) 2 business days later at the same time of day. No second email.
- `cb_retry_2` answered by No Answer or Voicemail: the callback completes with end_reason `callback_unreachable`.

Ends: any connected outcome completes it (result `connected`). A new Callback outcome cancels it (superseded) and starts a new one.

### A.7 `job_won` (customer lane)

Context: `jobTotal`, `scope`, `siteAddress`, `jobDate` (all optional).

| # | step_key | kind | template | due | notes |
|---|---|---|---|---|---|
| 1 | won_thanks | email | won_thanks | immediately | |
| 2 | won_ops_handoff | todo | none | immediately | |
| 3 | won_completion_check | todo | none | 1 business day after `jobDate` at 10:00 AM; with no `jobDate`, 14 days after the win at 10:00 AM | result required: completed, completed_with_issues, rescheduled (new date), cancelled |

Dynamic steps:

- `completed`: create `won_referral` (email) 2 business days later at 9:00 AM and `won_next_project` (email) 30 days later at 9:00 AM, moved to a business day.
- `completed_with_issues`: create `won_issue_call` (call) next business day at 10:00 AM and `won_next_project` 30 days later. No referral email.
- `rescheduled`: create a new completion check for the new date.
- `cancelled`: cancel the enrollment with end_reason `job_cancelled`.

### A.8 `recheck` (prospect, waiting)

Created by Not Interested with "No projects right now". Context: `notInterestedAt`.

| # | step_key | kind | due |
|---|---|---|---|
| 1 | recheck_call | call | 90 days after the Not Interested log, 10:00 AM, business day |

Dynamic: `recheck_call` answered by No Answer or Voicemail creates `recheck_email` (email) due immediately. Ends after `recheck_email` is sent or skipped, or on any connected outcome.

### A.9 `referral_intro` (prospect, nurture, on the new lead)

Context: `referrerName`, `referrerLeadId`.

| # | step_key | kind | template | due | notes |
|---|---|---|---|---|---|
| 1 | ref_intro | email | ref_intro | immediately | auto-skipped if the new lead has no email |
| 2 | ref_call | call | none | next business day at 10:00 AM | |

Ends when `ref_call` resolves. If it resolves with No Answer, run rule R1 for this lead after the referral ends (the new contact is cold, so the drip can start).

### A.10 `reply_call` and `reply_info` (prospect, waiting)

- `reply_call`: one call step, due immediately. Title depends on the source (Appendix D). Ends when any outcome resolves it or the rep marks it done.
- `reply_info`: one to-do, due immediately: "Send the one-pager, then log Info Sent". Ends when Info Sent is logged (superseded) or the rep marks it done.

### A.11 Extra steps on an open enrollment

When a rule says "attach a task", add a step with a numbered key to the open prospect enrollment (or create a `reply_call` enrollment when the prospect lane is empty). Used for inbound calls and texts (`inbound_call_n`) and the optional one-off recap (`extra_recap_n`, template pickup_recap, using the new call note and next step).

---

## Appendix B: Rules

### Definitions

- **Connected outcomes:** CONVO, CALLBACK, INFO_SENT, WALKTHROUGH, JOB_WON, NOT_INTERESTED (plus legacy SEND_QUOTE, SALE, GATEKEEPER).
- **Open enrollment:** status active, held or paused.

### R1 Drip start

Runs only on a rep-logged No Answer that arrives through `/api/sales/calls` or `/api/sales/sync`. Never from the Quo webhook. Checks run in order; the first that fails decides:

1. The lead is cold (R2 is false). Otherwise: no drip, no toast.
2. The lead never had a `no_answer_drip` enrollment in any status. Otherwise: no drip; toast "No-answer drip already finished for this lead." only if the last drip completed or was cancelled.
3. The lead has no open prospect-lane enrollment. Otherwise: no drip.
4. Not do-not-contact and not unsubscribed. Otherwise: no drip, toast with the reason.
5. Email present, valid, and not equal to `bounced_email`. If missing: set `needs_email_since` and `last_no_answer_at`, create nothing, toast "No email on file. Drip not started." If bounced: toast "Email bounced. Drip not started."
6. Guards. When one matches, create the enrollment with status held and no tasks:
   - `company_active`: another lead with the same `companyKey` has an open enrollment in any lane or a `warm_at` within the last 30 days.
   - `duplicate_email`: another lead with the same email (case-insensitive) has any enrollment.
7. Otherwise: create the enrollment as active, anchor at the event time, and create `drip_email_1` due now.

Always update `last_no_answer_at` on a No Answer.

### R2 Warm

A lead is warm when `sales_lead_flags.warm_at` is set, or when any `PHONE_CALL` event for it (`payload.contact_id` equals the lead id or `lead_` plus the id) has a connected outcome. Set `warm_at` whenever the engine processes a connected outcome, an inbound call or text, or a marked reply. No Answer, Voicemail, Out of Service, STATUS_MOVE and SMS_OUTBOUND never make a lead warm.

### R3 Resolving call tasks

When any outcome other than STATUS_MOVE or OUT_OF_SERVICE is logged, every pending call task on the lead due at or before now plus 30 minutes is resolved:

- connected outcome: done with result `connected`;
- No Answer or Voicemail: done with result `no_answer`, then the step's follow-on: callback retries (A.6), recheck email (A.8), drip check (A.9); check-in calls end their sequence; `reply_call` ends.

Call tasks due later than now plus 30 minutes are untouched by No Answer and Voicemail.

### R4 Missed callback

See A.6. A Voicemail at the callback time counts as the callback attempt, the same as No Answer.

### R5 Supersede

Cancel the open prospect-lane enrollment (end_reason `superseded:<OUTCOME>`) and its pending tasks (cancel_reason `superseded`), then start the new one.

### R6 Quote sent through Info Sent

If Info Sent is logged while the open walkthrough has a pending `wt_quote` task: mark `wt_quote` done with result `sent_outside_app`, complete the walkthrough, start `quote_followup`, and return statusOverride `quoted`. Marking `wt_quote` sent in the app follows the same path.

### R7 They replied

The rep picks a kind in the Reply modal. Nothing changes until the rep confirms the final step (for kinds that open a second modal, that modal's confirm).

1. Stop (cancel with end_reason `replied`) these open enrollments: `no_answer_drip`, `pickup_followup`, `info_sent_followup`, `quote_followup`, `recheck`, `referral_intro`, `reply_call`, `reply_info`. For `walkthrough`, `callback` and `job_won`, only save a note.
2. Then by kind:

| Kind | Result |
|---|---|
| wants_call | `reply_call`, title "They replied and want to talk" |
| wants_info | `reply_info` |
| booked_walkthrough | open `WalkthroughModal`, then the normal Walkthrough log |
| not_now | open `NotInterestedModal` with "No projects right now" selected |
| not_interested | open `NotInterestedModal` with "Not interested" selected |
| referred | open `ReferralModal` |
| unsubscribe | same as Unsubscribe (below) |
| out_of_office | stops nothing; `OutOfOfficeModal` pauses the open nurture enrollments (drip, Pick-up, Info Sent, Quote, Referral intro) until the return date |
| other | `reply_call`, title "They replied: read it and log the outcome" |

### Inbound call or text (Quo)

Same stop list as R7 step 1, then attach a call task due now ("They called you" or "They texted you") to the open prospect enrollment, or create a `reply_call` when the prospect lane is empty. Walkthrough, callback and customer enrollments keep running. Deduplicate by the Quo event id.

### Flags

- **Bounced:** set `bounced_email` (the current email) and `bounced_at`. Email tasks show "Email bounced" and cannot open. Nothing is cancelled. When the lead's email changes and the rep clicks Resume, the flag clears and the task becomes due now if it was overdue.
- **Unsubscribe:** set `email_opt_out_at`. Cancel every pending email task (cancel_reason `opted_out`); create future email steps as skipped; cancel `no_answer_drip` and `referral_intro` outright. Calls and to-dos continue. Badge "Unsubscribed". The law allows up to 10 business days; this takes effect immediately.
- **Do not contact:** set `do_not_contact_at`, cancel every open enrollment in every lane, block every future enrollment, badge "Do not contact".
- **Pause, resume, stop:** manual. Pause takes an optional until date; resume reactivates; stop cancels with end_reason `manual_stop`.

### Outcome matrix

Columns: what is open on the lead when the event arrives. "Cold" means not warm and nothing open. Callback and Customer are separate lanes and can be open at the same time as a prospect-lane enrollment.

| Event | Cold, nothing open | Drip open (active or held) | Pick-up, Recheck, Referral or Reply open | Info Sent open | Walkthrough open | Quote open | Callback lane | Customer lane |
|---|---|---|---|---|---|---|---|---|
| No Answer | R1 | no change | R3 on due calls; else no change | R3 on due calls; else no change | R3 on due calls; else no change | R3 on due calls; else no change | R4 if the call is due; else no change | no change |
| Voicemail | no change | no change | R3 on due calls; else no change | R3 on due calls; else no change | R3 on due calls; else no change | R3 on due calls; else no change | R4 if the call is due; else no change | no change |
| Pick Up, with follow-up | start Pick-up | cancel drip, start Pick-up | R5: new Pick-up | keep; save note; optional one-off recap | keep; save note; optional one-off recap | keep; save note; optional one-off recap | complete (connected) | no change |
| Pick Up, log without follow-up | mark warm only | cancel drip | resolve due calls; Recheck and Reply complete; Pick-up and Referral keep running | no change | no change | no change | complete (connected) | no change |
| Schedule Callback | start Callback | cancel drip, start Callback | no change | no change | no change | no change | replace with the new time | no change |
| Info Sent | start Info Sent | cancel drip, start Info Sent | R5: new Info Sent | R5: restart Info Sent | R6 if `wt_quote` is pending; else keep and save note | keep; save note | complete (connected) | no change |
| Book Walkthrough | start Walkthrough | cancel drip, start Walkthrough | R5: Walkthrough | R5: Walkthrough | treat as reschedule (A.4) | R5: Walkthrough | complete (connected) | no change |
| Job Won | start Customer | cancel drip, start Customer | cancel, start Customer | cancel, start Customer | cancel, start Customer | cancel, start Customer | cancel | start another Customer enrollment |
| Not Interested: no projects | start Recheck | cancel drip, start Recheck | R5: Recheck | R5: Recheck | cancel, start Recheck | cancel, start Recheck | cancel | no change |
| Not Interested: not interested | nothing | cancel | cancel | cancel | cancel | cancel | cancel | no change |
| Not Interested: do not contact | set flag | set flag, cancel everything in every lane, block future enrollments | same | same | same | same | same | same |
| Out of Service | lead deleted | lead deleted; rows cascade | same | same | same | same | same | same |
| They replied (R7) | n/a | cancel drip, route by kind | cancel, route by kind | cancel, route by kind | note only | cancel quote emails, route by kind | note only | note only |
| Inbound call or text | create reply_call | cancel drip, attach call task | cancel nurture, attach call task | cancel, attach call task | attach call task | cancel quote emails, attach call task | keep; attach call task to prospect lane | keep |
| Bounced | flag | flag; emails blocked | flag; emails blocked | flag; emails blocked | flag; emails blocked | flag; emails blocked | flag; emails blocked | flag; emails blocked |
| Unsubscribe | flag | flag; drip cancelled | flag; emails cancelled, calls continue | same | same | same | same | same |
| Drag to New | no follow-up change | no change | no change | no change | no change | no change | no change | no change |
| Out of office | n/a | pause until the date | Pick-up and Referral pause until the date; Recheck and Reply note only | pause until the date | note only | pause until the date | note only | note only |

Lead status for every event comes from `nextLeadStatus` (0.1), plus statusOverride from R6 and A.4.

---

## Appendix C: Email templates (exact copy)

### C.0 Assembly and merge fields

Every email body is assembled like this (blank lines exactly as shown):

```
Hi {first_name},

{template body}

Best regards,
{rep_name}
{rep_title}, Sea of Blue Inc.
{rep_phone}

Sea of Blue Inc., {company_mailing_address}, seaofblue.ca
Reply "unsubscribe" to stop these emails.
```

- Greeting: "Hi {first_name}," or "Hi," when there is no usable first name.
- Signature title line: "{rep_title}, Sea of Blue Inc." or "Sea of Blue Inc." when the rep has no title.
- `first_name`: first token of `customer_name`, after removing Mr, Mrs, Ms, Miss, Dr (with or without a period). Unusable (null) when missing, shorter than 2 letters, containing a digit or "@", or in `config.placeholderNames`. When the token is all upper case or all lower case, title-case it ("JOHN" to "John", "mary-anne" to "Mary-Anne").
- `rep_name`, `rep_title`, `rep_phone`: from the signed-in sender's follow-up settings. Fallbacks: profile full name or the active rep name; no title; `(437) 475-1622`. The sender is whoever opens the compose link.
- `company_mailing_address`: `config.company.mailingAddress`. Sending stays disabled while it is empty.
- `service_area`: `config.serviceAreaPhrase`.
- Dates in America/Toronto. `{day}` is "Thursday, October 8". `{time}` is "10:00 AM" (minutes always shown).
- `{when_future}`, relative to the moment of rendering: "today at 2:30 PM", "tomorrow at 2:30 PM", "Thursday at 2:30 PM" (2 to 6 days ahead), "Thursday, October 22 at 2:30 PM" (7 or more days ahead).
- `{when_past}`, relative to the moment of rendering: "today at 2:30 PM", "yesterday at 2:30 PM", "on Thursday at 2:30 PM" (2 to 6 days ago), "on Thursday, October 8 at 2:30 PM" (older).
- `{site_address}`: unusable when empty or when it matches `/job site$/i` (the modal default "Mississauga Job Site").
- `{site_contact_sentence}`: " We will ask for {site_contact_name} when we arrive." Only when the site contact name is set and differs (case-insensitive) from the lead's name. Otherwise empty.
- `{call_note}`, `{next_step}`, `{project_name}`: trimmed, newlines collapsed to spaces, trailing `. ! ? ; ,` removed. Limits in config.
- `{original_month}`: month name of the Not Interested log, with the year added only when it differs from the current year.
- Same-day rule: a "today" variant is used only when the Toronto date at rendering equals the Toronto date of the anchor event.
- Subjects start with a capital letter. Uppercase the first character after merging.

### C.1 No-answer drip (approved copy)

**drip_1**
Subject: `Who handles closeout cleaning?`

Same day as the call:
```
I called you today and missed you. Sea of Blue Inc. does post-construction deep cleans for non-residential sites {service_area}.

Who handles the final clean on your projects?
```
Any later day:
```
I called you recently and missed you. Sea of Blue Inc. does post-construction deep cleans for non-residential sites {service_area}.

Who handles the final clean on your projects?
```

**drip_2**
Subject: `Next closeout`
```
Do you hire out the final clean, or does your own crew do it?
```

**drip_3**
Subject: `Project finishing soon?`
```
When does your next project finish, and is a cleaner confirmed for it?
```

**drip_4**
Subject: `Right person for closeout cleaning?`
```
This is my last email. If someone else on your team handles closeout cleaning, send me their name and I will contact them directly.
```

### C.2 Pick-up follow-up

**pickup_recap**
Subject: `Following up on our call`

Same day as the call:
```
Thanks for taking my call today. You mentioned {call_note}.

Next step: {next_step}.

So you have it on file: we are WSIB insured with $5 million liability coverage, and each cleaning phase is booked separately at a fixed price.
```
Any later day: identical, except the first sentence is `Thanks for taking my call.`

**pickup_day3**
With `project_name`:
Subject: `Update on {project_name}?`
```
Is {project_name} still on schedule, and when will it be ready for the final clean?
```
Without `project_name`:
Subject: `Your next project`
```
Which of your projects finishes next, and when?
```

**pickup_day7**
Subject: `Pricing by phase`
```
We price the rough clean, pre-final clean, and final turnover clean separately. Which phases should I price for your next project?
```

**pickup_day14**
Subject: `Should I check back later?`
```
If nothing is coming up soon, what month should I check back with you?
```

### C.3 Info sent follow-up

**info_day2**
Subject: `The info I sent`
```
Did the info I sent cover what you need, or should I also send our WSIB clearance certificate and insurance certificate?
```

**info_day6**
Subject: `Fixed price for your next project`
```
Which project should I price? Send me the address and square footage, and I will send back a fixed price.
```

**info_day12**
Subject: `Closing the loop`
```
Is a cleaner already lined up for your next closeout, or should I check back closer to the date?
```

### C.4 Walkthrough

**wt_confirm**
Subject: `Walkthrough confirmed for {day} at {time}`

With a usable site address:
```
Confirming our walkthrough at {site_address} on {day} at {time}.{site_contact_sentence} If anything changes on your end, reply here.
```
Without one:
```
Confirming our walkthrough on {day} at {time}.{site_contact_sentence} What is the site address?
```

**wt_no_show** (the time is the walkthrough time, `when_past`)
Subject: `Missed you at the walkthrough`

With a usable site address:
```
We came to {site_address} {when_past} and missed you. What day works to reschedule?
```
Without one:
```
We came by for the walkthrough {when_past} and missed you. What day works to reschedule?
```

**wt_rescheduled**
Subject: `New walkthrough time: {day} at {time}`

With a usable site address:
```
Confirming the new time for our walkthrough at {site_address}: {day} at {time}. If that changes, reply here.
```
Without one:
```
Confirming the new time for our walkthrough: {day} at {time}. What is the site address?
```

**wt_quote** (card note: "Attach your quote PDF in Gmail before you send.")
Subject: `Your quote for {site_address}`, or `Your quote` without a usable address.

Amount and scope:
```
Your quote is attached: {quote_amount} for the {scope_phase}. The price is fixed. What date do you need the clean done?
```
Amount, no scope:
```
Your quote is attached: {quote_amount}. The price is fixed. What date do you need the clean done?
```
No amount:
```
Your quote is attached. The price is fixed. What date do you need the clean done?
```

### C.5 Quote follow-up

**quote_day2**
Subject: `Questions on the quote?`

With a usable site address:
```
Any questions on the quote for {site_address}?
```
Without one:
```
Any questions on the quote I sent?
```

**quote_day5**
Subject: `Locking in your date`
```
What date do you need the clean done? Once you confirm, I will book the crew for that day.
```

**quote_day10**
Subject: `Should I keep the quote open?`

With a usable site address:
```
Should I keep the quote for {site_address} open, or has the project changed?
```
Without one:
```
Should I keep your quote open, or has the project changed?
```

### C.6 Callback

**cb_confirm** (`when_future` of the callback time)
Subject: `Talk {when_future}`
```
Confirming I will call you {when_future}. If that time stops working, reply with a better one.
```

**cb_missed** (`when_past` of the attempted callback time)
Subject: `Missed you {when_past}`
```
I called you {when_past} as planned and missed you. What time works better?
```

### C.7 Customer (Job Won)

**won_thanks**
Subject: `Thanks for choosing Sea of Blue`

Date and usable address:
```
Thanks for choosing Sea of Blue Inc. Your clean is booked for {job_date} at {site_address}. Who should our crew contact on site that day?
```
Date, no usable address:
```
Thanks for choosing Sea of Blue Inc. Your clean is booked for {job_date}. Who should our crew contact on site that day?
```
No date:
```
Thanks for choosing Sea of Blue Inc. What date should we book your clean, and who should our crew contact on site?
```

**won_referral**
Subject: `Who else should I talk to?`

With a usable site address:
```
Thanks again for having us at {site_address}. Who else on your team, or at another company you work with, should I talk to about their next closeout?
```
Without one:
```
Thanks again for having us on your project. Who else on your team, or at another company you work with, should I talk to about their next closeout?
```

**won_next_project**
Subject: `Your next closeout`
```
When does your next project finish? Send me the date and I will book the crew.
```

### C.8 Recheck

**recheck_email**
Subject: `Checking back`
```
When we spoke in {original_month}, you had no projects coming up. Is anything finishing in the next few months?
```

### C.9 Referral intro (sent to the new contact)

**ref_intro**
Subject: `{referrer_first_name} gave me your name`, or `Closeout cleaning on your projects` when the referrer has no usable first name.
```
{referrer_full_name} gave me your name. Sea of Blue Inc. does post-construction cleaning for non-residential sites {service_area}.

When does your next project need a final clean?
```

Template count: 25 templates, 38 written variants.

---

## Appendix D: Labels, task cards, modals, toasts

### D.1 Sequence labels (card line 1)

| Sequence | Label |
|---|---|
| no_answer_drip | `No-answer drip {n}/4` |
| pickup_followup | `Pick-up follow-up` |
| info_sent_followup | `Info sent follow-up` |
| walkthrough | `Walkthrough {Mon d}, {time}` (example "Walkthrough Oct 8, 10:00 AM") |
| quote_followup | `Quote follow-up {n}/3` |
| callback | `Callback {when_future}` (example "Callback today at 2:30 PM") |
| job_won | `Customer` |
| recheck | `Recheck {Mon d}` |
| referral_intro | `Referral intro` |
| reply_call, reply_info | `Reply` |

### D.2 Task titles and details

| step_key | Title | Details |
|---|---|---|
| drip_email_n | `Email {n}: {subject}` | |
| pickup_recap, extra_recap_n | `Send the call recap (within 2 hours)` | |
| pickup_day3, pickup_day7, pickup_day14 | `Email: {subject}` | |
| pickup_checkin | `Check-in call` | `Ask when their next project finishes.` |
| info_day2, info_day6, info_day12 | `Email: {subject}` | |
| info_checkin | `Check-in call` | `Ask if the info covered what they need and when their next project finishes.` |
| wt_confirm | `Send the walkthrough confirmation` | |
| wt_prep | `Prep for the walkthrough` | `{day} at {time}, {site_address}. Site contact: {name} {phone}. Scope: {scope}. Notes: {notes}. Confirm the site contact can meet you.` (omit empty parts) |
| wt_visit | `Walkthrough at {site_address}` (or `Walkthrough on site`) | result buttons: `Completed`, `No-show`, `Rescheduled`, `Cancelled` |
| wt_quote | `Send the quote` | `Attach your quote PDF in Gmail before you send.` |
| wt_no_show | `Email: Missed you at the walkthrough` | |
| wt_reschedule | `Reschedule the walkthrough` | |
| wt_rescheduled | `Send the new walkthrough time` | |
| wt_cancelled_call | `Walkthrough cancelled: call to find out what changed` | |
| quote_day2, quote_day5, quote_day10 | `Email: {subject}` | |
| quote_checkin | `Call about the quote` | |
| cb_confirm | `Send the callback confirmation` | |
| cb_call | `Callback` | the rep's note |
| cb_missed | `Email: Missed you` | |
| cb_retry_1 | `Retry callback (attempt 2)` | |
| cb_retry_2 | `Retry callback (attempt 3)` | |
| won_thanks | `Send the thank-you email` | |
| won_ops_handoff | `Hand off to operations` | `Create the job, assign the crew, confirm site access. Value: {jobTotal}. Scope: {scope}. Site: {siteAddress}. Date: {jobDate}.` (omit empty parts) |
| won_completion_check | `Was the job completed?` | result buttons: `Completed`, `Completed, client had issues`, `Rescheduled`, `Cancelled` |
| won_referral | `Email: Who else should I talk to?` | |
| won_next_project | `Email: Your next closeout` | |
| won_issue_call | `Call to resolve the client's issues` | |
| recheck_call | `90-day recheck call` | `They had no projects on {date}. Ask about upcoming projects.` |
| recheck_email | `Email: Checking back` | |
| ref_intro | `Send the referral intro` | |
| ref_call | `Call {first_name}, referred by {referrer_full_name}` | |
| reply_call, inbound_call_n | `They replied and want to talk`, `They called you`, `They texted you`, or `They replied: read it and log the outcome` | |
| reply_info | `Send the one-pager, then log Info Sent` | |

### D.3 Modals

**PickupModal** (Pick Up / Connected)
- Title: `Pick Up / Connected`. Subtitle: `{name} at {company}` (company omitted when it is the placeholder).
- `What did they tell you?` (required, 10 to 300 characters). Helper: `This finishes the sentence "You mentioned ..." in the recap email. Example: two fit-outs finishing in November, and their own crew does the final clean.`
- `Agreed next step` (required, 5 to 200 characters). Helper: `This finishes "Next step: ...". Example: you will send me the address and square footage for the Mississauga project.`
- `Project they mentioned (optional)`. Helper: `Used in the Day 3 email. Example: the Square One fit-out.`
- `Their email` (prefilled, editable). Helper: `Saved to the lead.`
- Checkbox `They referred me to someone else`. When checked, show `Referred contact name` (required), `Title`, `Phone`, `Email`. On submit, create the new lead and call `add_referral`.
- Live preview headed `Recap email preview`.
- When the lead has an open Info Sent, Walkthrough or Quote follow-up, show: `This lead has an open {Info sent | Walkthrough | Quote} follow-up. Your note is saved to it and no new sequence starts.` and a checkbox `Send a recap email` (default on), which attaches `extra_recap_n`.
- Buttons: `Log and start follow-up` (or `Log and save note` in the note case), `Log without follow-up`, `Cancel`.

**CallbackModal**
- Title: `Schedule Callback` (reschedule: `Reschedule Callback`).
- `Date` (required, today or later), `Time` (required, 15-minute steps), `Note (optional)`.
- Checkbox `Send a confirmation email` (default on). Disabled with `No email on file` when there is no email. Unticked automatically with `Less than 2 hours away` when that applies.
- Validation message: `Pick a time in the future.`
- Buttons: `Schedule callback`, `Cancel`.

**NotInterestedModal**
- Title: `Not Interested`.
- Choice (required):
  - `No projects right now`. Helper: `A recheck call is set for 90 days from today.`
  - `Not interested`. Helper: `All follow-ups stop.`
  - `Do not contact`. Helper: `No calls or emails, ever. Use this only when they ask.`
- `Note (optional)`.
- Buttons: `Log Not Interested`, `Cancel`.

**JobWonModal**
- Title: `Job Won`.
- `Contract value ($)` (prefilled from the estimated value), `Scope or phase` (prefilled `Final Turnover Clean`), `Site address`, `Scheduled clean date`, `Note`.
- Buttons: `Log Job Won`, `Log without details`, `Cancel`.

**ReplyModal**
- Title: `They replied`. Question: `What did they say?`
- Options: `They want to talk`, `They asked for info`, `They booked a walkthrough`, `Gave me another contact`, `Not right now`, `Not interested`, `Stop emailing me`, `Out of office`, `Something else`.
- Buttons: `Continue`, `Cancel`.

**ReferralModal**
- Title: `Add referred contact`.
- `Name` (required), `Title`, `Phone`, `Email`, `Referred by` (required, prefilled with the current lead's name).
- Info line: `Creates a new lead at {company} and schedules an intro email that says "{referred by} gave me your name."`
- Buttons: `Add contact`, `Cancel`.

**VisitResultModal**
- Title: `How did the walkthrough go?`
- Options with helpers: `Completed` (`The quote email is due within 24 hours.`), `No-show` (`Sends a reschedule email.`), `Rescheduled` (opens the walkthrough form), `Cancelled by them` (`Sets a call for the next business day.`).

**QuoteDetailsModal** (before the quote email opens)
- Title: `Quote details`.
- `Quote amount, written the way it should appear` (placeholder `$3,200 plus HST`), `Scope or phase` (prefilled).
- Note: `Attach your quote PDF in Gmail before you send.`
- The `Continue to Gmail` button is the compose link, rebuilt on every render from the current field values. Clicking it saves `quote_details` and fires `open` without awaiting.

**JobResultModal**
- Title: `Was the job completed?`
- Options: `Completed`, `Completed, client had issues`, `Rescheduled` (with a date field), `Cancelled`.

**OutOfOfficeModal**
- Title: `Out of office`.
- `Back on` (date, default 7 days from today).
- Buttons: `Pause follow-ups`, `Cancel`.

**FollowupSettingsModal**
- Title: `Follow-up settings`.
- `Name in signature`, `Title`, `Phone` (default `(437) 475-1622`), `Gmail address you send from`.
- Note: `Turn off the automatic Gmail signature for new emails, or Gmail adds a second signature.`
- Status line: `Company mailing address: set` or `Company mailing address: missing (sending is disabled)`.
- Signature preview.
- Section `Launch tools`: `Start the drip for recent no-answer leads`, which shows the dry-run count, then `Start for {N} leads` to confirm.

### D.4 Toasts

| When | Toast |
|---|---|
| Drip started | `No-answer drip started. Email 1 is due now.` |
| Drip held (company) | `Drip held: {name} at this company is already in follow-up.` |
| Drip held (duplicate email) | `Drip held: another lead uses this email.` |
| No email | `No email on file. Drip not started.` |
| Bounced | `Email bounced. Drip not started.` |
| Unsubscribed | `Unsubscribed. Drip not started.` |
| Drip already done | `No-answer drip already finished for this lead.` |
| Pick-up started | `Pick-up follow-up started. Send the recap within 2 hours.` |
| Pick-up note only | `Note saved to the {Info sent | Walkthrough | Quote} follow-up.` |
| Info Sent started | `Info sent follow-up started. First email in 2 days.` |
| Walkthrough started | `Walkthrough follow-up started. Send the confirmation now.` |
| Walkthrough rescheduled | `Walkthrough moved to {day} at {time}.` |
| Quote started | `Quote follow-up started. First email in 2 days.` |
| Callback set | `Callback set for {when_future}.` |
| Callback missed | `Callback missed. Send the "Missed you" email. Retry set for {when_future}.` |
| Customer started | `Customer follow-up started. Send the thank-you email.` |
| Recheck set | `Recheck call set for {Mon d}.` |
| Not interested | `Follow-ups stopped.` |
| Do not contact | `Marked do not contact. All follow-ups stopped.` |
| Reply recorded | `Reply recorded. Follow-up emails stopped.` |
| Marked sent | `Marked sent. Next: {next title}, {due label}.` with `Undo` |
| Skipped | `Skipped. Next: {next title}, {due label}.` with `Undo` |
| Sequence finished | `Follow-up finished.` |
| Second click | `Already handled.` |

### D.5 End reason labels (card and dossier history)

Never show raw end_reason codes. Map them:

| end_reason | Label |
|---|---|
| completed (drip) | `Drip finished` |
| completed (other) | `Finished` |
| replied | `Stopped: they replied` |
| superseded:<OUTCOME> | `Stopped: new outcome logged` |
| inbound_call, inbound_sms | `Stopped: they called or texted` |
| unsubscribed, opted_out | `Stopped: unsubscribed` |
| do_not_contact | `Stopped: do not contact` |
| manual_stop | `Stopped by a rep` |
| held_skipped | `Skipped` |
| callback_unreachable | `Ended: no answer after 3 attempts` |
| walkthrough_cancelled | `Ended: walkthrough cancelled` |
| job_cancelled | `Ended: job cancelled` |
| out_of_service | `Ended: number out of service` |

For the drip, prefix with `Drip ` (example `Drip stopped: they replied`). Use `held_skipped` as the end_reason when a rep clicks Skip on a held drip.

---

## Appendix E: Config (`lib/sales/followups/config.ts`)

```ts
export const FOLLOWUP_CONFIG = {
  timezone: 'America/Toronto',
  company: {
    legalName: 'Sea of Blue Inc.',
    mailingAddress: '', // REQUIRED. Ask the owner. Sending is disabled while this is empty.
    website: 'seaofblue.ca',
    defaultPhone: '(437) 475-1622',
  },
  signOff: 'Best regards,',
  serviceAreaPhrase: 'across the GTA',
  // Ontario statutory holidays (observed dates) through 2027. Extend each year.
  holidays: [
    '2026-10-12', '2026-12-25', '2026-12-28',
    '2027-01-01', '2027-02-15', '2027-03-26', '2027-05-24', '2027-07-01',
    '2027-09-06', '2027-10-11', '2027-12-27', '2027-12-28',
  ],
  emailHour: 9,
  callHour: 10,
  prepHour: 16,
  limits: { callNote: 300, nextStep: 200, projectName: 80, composeUrlMax: 2000 },
  placeholderNames: [
    'decision maker', 'unnamed contact', 'contact', 'project manager', 'prospect', 'owner',
    'manager', 'unknown', 'n/a', 'na', 'team', 'office', 'info', 'admin', 'sales',
  ],
  placeholderCompanies: ['commercial prospect'],
};
```

---

## Appendix F: Acceptance scenarios

Each must pass, as a unit test where it is pure logic and in the browser where it involves UI.

1. Cold lead with an email, log No Answer: drip active, Email 1 due now, card `No-answer drip 1/4`, toast `No-answer drip started. Email 1 is due now.`
2. Same lead, No Answer again: nothing changes and no duplicate rows exist.
3. Same lead, Voicemail: nothing changes.
4. Open Email 1 the same day: subject `Who handles closeout cleaning?`, body starts `I called you today and missed you.`
5. Open Email 1 the next day: body starts `I called you recently and missed you.`
6. Mark Email 1 sent on day 0: Email 2 due day 4 at 9:00 AM (business day).
7. Mark Email 1 sent on day 2: Email 2 due day 6.
8. An Email 2 target on a Saturday moves to Monday. A target on Oct 12, 2026 moves to Oct 13.
9. Email 4 sent: drip completed, card shows muted `Drip finished` and no buttons.
10. Drip finished, No Answer again: nothing.
11. Cold lead without an email, No Answer: no enrollment, `No email on file` with `Add email`. After adding an email, `Start drip` creates Email 1 with the `recently` variant.
12. Two leads at one company: the second gets No Answer while the first is in follow-up. The second is held with the banner. `Start anyway` activates it. `Skip` cancels it, and it never enrolls again.
13. A second lead with the same email: held with `duplicate_email`.
14. Lead in the drip, log Pick Up with capture: drip cancelled (`superseded:CONVO`), Pick-up started, recap due now, preview shows the call note and next step.
15. Pick Up with `Log without follow-up` during the drip: drip cancelled, nothing new, lead warm. A later No Answer does nothing.
16. Lead in the drip, Schedule Callback tomorrow 2:30 PM: drip cancelled, confirmation email due now with subject `Talk tomorrow at 2:30 PM`, call task tomorrow at 2:30 PM.
17. Callback set 1 hour ahead: the confirmation is auto-skipped.
18. At the callback time, No Answer: callback task done with `no_answer`, `Missed you today at 2:30 PM` email due now, retry next business day at 2:30 PM. Retry with No Answer: retry 2 two business days later, no email. Retry 2 with No Answer: callback ended `callback_unreachable`.
19. No Answer 3 hours before a callback: nothing changes.
20. Pick Up at callback time: callback completed (`connected`), Pick-up starts.
21. Info Sent on a cold lead: Info Sent follow-up, first email day 2.
22. Pick Up during Info Sent: Info Sent continues, the note is saved, and `Send a recap email` creates a one-off recap task.
23. Walkthrough booked with address `Mississauga Job Site`: confirmation due now asks `What is the site address?`, prep reminder previous business day at 4:00 PM, visit task at the walkthrough time.
24. Visit marked Completed: quote email due 24 hours later. Quote details collected, marked sent: Quote follow-up starts and the card moves to Quote Sent.
25. Info Sent logged while the quote email is pending: rule R6 path, same result as 24.
26. Visit No-show: `Missed you at the walkthrough` email and a reschedule to-do.
27. Reschedule: old prep and visit cancelled, new ones created, `New walkthrough time` email due now.
28. Visit Cancelled: call task next business day at 10:00 AM. Resolving it ends the walkthrough.
29. A new Walkthrough outcome while one is open: handled as a reschedule.
30. Job Won with a date: thank-you email, operations to-do, completion check the business day after the date. Completed: referral email 2 business days later and next-project email 30 days later. Completed with issues: issue call, no referral email.
31. Job Won while a callback and a quote follow-up are open: both cancelled, Customer starts.
32. Pick Up on a won customer about a new project: Pick-up starts in the prospect lane, the Customer lane is untouched, the card stays in Won.
33. Not Interested, no projects: recheck call 90 days later at 10:00 AM on a business day. At the recheck, No Answer creates the `Checking back` email.
34. Not Interested, not interested: prospect follow-ups cancelled, nothing new.
35. Not Interested, do not contact: everything cancelled in every lane, red badge, and a later No Answer does nothing.
36. They replied, asked for info: drip cancelled, to-do `Send the one-pager, then log Info Sent`. Logging Info Sent closes it and starts the Info Sent follow-up.
37. They replied, gave another contact: a new lead at the same company (source `phone_sales_os`) with `ref_intro` due now saying `{referrer} gave me your name.` The original lead's drip ends with `replied`.
38. Referral lead: `ref_call` due next business day at 10:00 AM. No Answer at that time ends the referral and starts the drip for the new lead.
39. They replied, out of office until a date: enrollments paused, card `Paused until ...`. After that date the follow-up resumes and the next email is due.
40. Bounced: the email button shows `Email bounced`. After the email is edited and Resume is clicked, the button works.
41. Unsubscribe during Pick-up: pending emails cancelled, the check-in call stays, badge `Unsubscribed`.
42. Quo inbound text from a lead in the drip: drip cancelled (`inbound_sms`), call task `They texted you`.
43. Quo missed inbound call from a cold lead: no drip, call task `They called you`.
44. Out of Service on a lead with open follow-ups: the lead and its follow-up rows are gone.
45. Drag to Lost opens Not Interested. Cancel leaves the card where it was.
46. Drag to Won opens Job Won. Confirm keeps the card in Won after a reload.
47. Drag to New: status `new`, +1 dial, follow-ups unchanged.
48. Offline: block `/api/sales/calls`, log No Answer, restore the network, let sync run. The drip starts exactly once.
49. Two reps click Mark sent on the same task: one succeeds, the other sees `Already handled.`
50. Undo within 10 seconds of Mark sent: the task is pending again and the next step is gone.
51. Mailing address empty: every `Open in Gmail` is disabled with the settings message.
52. Signed out: the board works and the strips show `Sign in to use follow-ups`.
53. Name `JOHN SMITH` renders `Hi John,`. Name `Decision Maker` renders `Hi,`.
54. The compose link opens the rep's Gmail account with to, subject and body filled. A body that would push the URL past 2,000 characters triggers the clipboard fallback.
55. Due dates across Nov 1, 2026 (end of daylight saving time) stay at 9:00 AM Toronto time.
