/**
 * Server-only executor for SOB Sales Follow-Up Engine (spec 5.6).
 * Loads state, executes pure planner, and writes atomic updates with deduplication.
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  PlannerInputState,
  PlannerAction,
  FollowupEnrollment,
  FollowupTask,
} from './types';
import { planForOutcome, planForTaskAction, planForSignal } from './rules';
import { companyKey } from './company';

export interface EngineResult {
  started?: string[];
  cancelled?: string[];
  held?: string[];
  statusOverride?: string | null;
  toast?: any;
  notes?: string | null;
  duplicate?: boolean;
}

/**
 * Loads current planner state for a lead from Supabase.
 */
export async function loadPlannerState(
  supabase: any,
  leadId: string
): Promise<PlannerInputState> {
  // 1. Fetch lead
  const { data: lead } = await supabase
    .from('leads')
    .select('id, customer_name, customer_email, customer_phone, company_name, contact_title, city, status, source, notes, preferred_date')
    .eq('id', leadId)
    .single();

  if (!lead) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // 2. Fetch flags
  const { data: flags } = await supabase
    .from('sales_lead_flags')
    .select('*')
    .eq('lead_id', leadId)
    .maybeSingle();

  // 3. Fetch open enrollments & all pending tasks
  const { data: enrollments } = await supabase
    .from('sales_followup_enrollments')
    .select('*')
    .eq('lead_id', leadId)
    .in('status', ['active', 'held', 'paused']);

  const openEnrollmentsWithTasks: (FollowupEnrollment & { pendingTasks: FollowupTask[] })[] = [];
  if (enrollments && enrollments.length > 0) {
    const enrIds = enrollments.map((e: any) => e.id);
    const { data: tasks } = await supabase
      .from('sales_followup_tasks')
      .select('*')
      .in('enrollment_id', enrIds)
      .eq('status', 'pending');

    for (const e of enrollments) {
      const eTasks = (tasks || []).filter((t: any) => t.enrollment_id === e.id);
      openEnrollmentsWithTasks.push({ ...e, pendingTasks: eTasks });
    }
  }

  // 4. Check if ever had a no_answer_drip
  const { data: drips } = await supabase
    .from('sales_followup_enrollments')
    .select('*')
    .eq('lead_id', leadId)
    .eq('sequence_key', 'no_answer_drip')
    .order('created_at', { ascending: false });

  const hadDripEver = Boolean(drips && drips.length > 0);
  const lastEndedDrip = drips && drips.length > 0 ? drips[0] : null;

  // 5. Check if warm: flags.warm_at or connected phone call event
  let isWarm = Boolean(flags?.warm_at);
  if (!isWarm) {
    const { data: connectedCalls } = await supabase
      .from('events')
      .select('payload')
      .eq('type', 'PHONE_CALL')
      .filter('payload->>contact_id', 'in', `(${leadId},lead_${leadId})`)
      .limit(20);

    if (connectedCalls) {
      for (const c of connectedCalls) {
        const p = typeof c.payload === 'string' ? JSON.parse(c.payload) : c.payload;
        const o = String(p?.outcome_type || '').toUpperCase();
        if (['CONVO', 'CALLBACK', 'INFO_SENT', 'WALKTHROUGH', 'JOB_WON', 'NOT_INTERESTED', 'SEND_QUOTE', 'SALE', 'GATEKEEPER'].includes(o)) {
          isWarm = true;
          break;
        }
      }
    }
  }

  // 6. Check company guard: other lead with same companyKey
  let companyActiveLeadName: string | null = null;
  const cKey = companyKey(lead.company_name);
  if (cKey) {
    const { data: companyEnrs } = await supabase
      .from('sales_followup_enrollments')
      .select('lead_id, leads(customer_name)')
      .eq('company_key', cKey)
      .neq('lead_id', leadId)
      .in('status', ['active', 'held', 'paused'])
      .limit(1);

    if (companyEnrs && companyEnrs.length > 0) {
      companyActiveLeadName = (companyEnrs[0] as any).leads?.customer_name || 'Another contact';
    }
  }

  // 7. Check duplicate email guard
  let duplicateEmailLeadName: string | null = null;
  if (lead.customer_email && lead.customer_email.includes('@')) {
    const { data: emailEnrs } = await supabase
      .from('leads')
      .select('id, customer_name, sales_followup_enrollments(id)')
      .ilike('customer_email', lead.customer_email.trim())
      .neq('id', leadId)
      .limit(1);

    if (emailEnrs && emailEnrs.length > 0 && (emailEnrs[0] as any).sales_followup_enrollments?.length > 0) {
      duplicateEmailLeadName = emailEnrs[0].customer_name || 'Another contact';
    }
  }

  return {
    lead,
    flags,
    openEnrollments: openEnrollmentsWithTasks,
    hadDripEver,
    lastEndedDrip,
    isWarm,
    companyActiveLeadName,
    duplicateEmailLeadName,
  };
}

/**
 * Applies planner actions to the database.
 */
export async function applyPlannerActions(
  supabase: any,
  leadId: string,
  actions: PlannerAction[],
  repId: string | null
): Promise<{ started: string[]; cancelled: string[]; held: string[] }> {
  const started: string[] = [];
  const cancelled: string[] = [];
  const held: string[] = [];

  for (const action of actions) {
    if (action.type === 'start_enrollment') {
      const { data: lead } = await supabase.from('leads').select('company_name').eq('id', leadId).single();
      const cKey = companyKey(lead?.company_name);

      const { data: enr, error: enrError } = await supabase
        .from('sales_followup_enrollments')
        .insert({
          lead_id: leadId,
          sequence_key: action.sequenceKey,
          lane: action.lane,
          status: action.status,
          hold_reason: action.holdReason || null,
          anchor_at: action.anchorAt.toISOString(),
          company_key: cKey,
          context: action.context,
          owner_rep_id: repId,
        })
        .select()
        .single();

      if (enrError) {
        console.warn('[Followup Engine] Enrollment insert error:', enrError);
        continue;
      }

      if (action.status === 'held') {
        held.push(action.sequenceKey);
      } else {
        started.push(action.sequenceKey);
      }

      // Insert initial tasks
      if (action.initialTasks && action.initialTasks.length > 0) {
        const tasksToInsert = action.initialTasks.map((t) => ({
          enrollment_id: enr.id,
          lead_id: leadId,
          step_key: t.stepKey,
          kind: t.kind,
          template_key: t.templateKey || null,
          title: t.title,
          details: t.details || null,
          due_at: t.dueAt.toISOString(),
          assigned_rep_id: repId,
          status: 'pending',
        }));

        await supabase.from('sales_followup_tasks').insert(tasksToInsert);
      }
    } else if (action.type === 'cancel_enrollment') {
      const nowIso = new Date().toISOString();
      await supabase
        .from('sales_followup_enrollments')
        .update({
          status: 'cancelled',
          ended_at: nowIso,
          end_reason: action.endReason,
          updated_at: nowIso,
        })
        .eq('id', action.enrollmentId);

      await supabase
        .from('sales_followup_tasks')
        .update({
          status: 'cancelled',
          cancel_reason: action.cancelTasksReason || 'cancelled',
          updated_at: nowIso,
        })
        .eq('enrollment_id', action.enrollmentId)
        .eq('status', 'pending');

      cancelled.push(action.enrollmentId);
    } else if (action.type === 'complete_enrollment') {
      const nowIso = new Date().toISOString();
      await supabase
        .from('sales_followup_enrollments')
        .update({
          status: 'completed',
          ended_at: nowIso,
          end_reason: action.endReason || 'completed',
          updated_at: nowIso,
        })
        .eq('id', action.enrollmentId);
    } else if (action.type === 'pause_enrollment') {
      const nowIso = new Date().toISOString();
      await supabase
        .from('sales_followup_enrollments')
        .update({
          status: 'paused',
          paused_until: action.until ? action.until.toISOString() : null,
          updated_at: nowIso,
        })
        .eq('id', action.enrollmentId);
    } else if (action.type === 'resume_enrollment') {
      const nowIso = new Date().toISOString();
      await supabase
        .from('sales_followup_enrollments')
        .update({
          status: 'active',
          paused_until: null,
          updated_at: nowIso,
        })
        .eq('id', action.enrollmentId);
    } else if (action.type === 'create_task') {
      await supabase.from('sales_followup_tasks').insert({
        enrollment_id: action.enrollmentId,
        lead_id: leadId,
        step_key: action.stepKey,
        kind: action.kind,
        template_key: action.templateKey || null,
        title: action.title,
        details: action.details || null,
        due_at: action.dueAt.toISOString(),
        assigned_rep_id: repId,
        status: 'pending',
      });
    } else if (action.type === 'update_task') {
      const updatePayload: any = { updated_at: new Date().toISOString() };
      if (action.status) updatePayload.status = action.status;
      if (action.result) updatePayload.result = action.result;
      if (action.cancelReason) updatePayload.cancel_reason = action.cancelReason;
      if (action.dueAt) updatePayload.due_at = action.dueAt.toISOString();
      if (action.details) updatePayload.details = action.details;

      await supabase
        .from('sales_followup_tasks')
        .update(updatePayload)
        .eq('id', action.taskId);
    } else if (action.type === 'set_flag') {
      const { data: existingFlag } = await supabase
        .from('sales_lead_flags')
        .select('lead_id')
        .eq('lead_id', leadId)
        .maybeSingle();

      const flagPayload = {
        ...action.updates,
        updated_at: new Date().toISOString(),
        updated_by: repId,
      };

      if (existingFlag) {
        await supabase
          .from('sales_lead_flags')
          .update(flagPayload)
          .eq('lead_id', leadId);
      } else {
        await supabase
          .from('sales_lead_flags')
          .insert({ lead_id: leadId, ...flagPayload });
      }
    } else if (action.type === 'update_context') {
      await supabase
        .from('sales_followup_enrollments')
        .update({
          context: action.context,
          updated_at: new Date().toISOString(),
        })
        .eq('id', action.enrollmentId);
    }
  }

  return { started, cancelled, held };
}

/**
 * Runs the engine for a logged call event.
 */
export async function runEngineForEvent(
  eventRow: any,
  options: { sessionUserId?: string | null } = {}
): Promise<EngineResult> {
  const supabase = await createServiceClient();
  const eventId = eventRow.event_id || eventRow.id;
  const payload = typeof eventRow.payload === 'string' ? JSON.parse(eventRow.payload) : eventRow.payload || {};
  const contactId = payload.contact_id || eventRow.contact_id;

  if (!contactId) {
    return { duplicate: false };
  }

  const rawLeadId = String(contactId).replace(/^lead_/, '');

  // 1. Idempotency check with sales_followup_processed_events
  const { error: procError } = await supabase
    .from('sales_followup_processed_events')
    .insert({
      event_id: eventId,
      lead_id: rawLeadId,
      outcome_type: payload.outcome_type,
    });

  if (procError && (procError as any).code === '23505') {
    return { duplicate: true };
  }

  // 2. Load state
  const state = await loadPlannerState(supabase, rawLeadId);

  // 3. Plan
  const plan = planForOutcome({
    outcome: payload.outcome_type,
    capture: payload.followup || {
      callNote: payload.notes,
      callbackAt: payload.callback_time,
      saleDetails: payload.sale_details,
    },
    now: new Date(payload.timestamp || eventRow.created_at || Date.now()),
    state,
  });

  // 4. Apply
  const repId = options.sessionUserId || payload.rep_id || eventRow.rep_id || null;
  const applied = await applyPlannerActions(supabase, rawLeadId, plan.actions, repId);

  // 5. Update summary in processed_events
  await supabase
    .from('sales_followup_processed_events')
    .update({ summary: { ...applied, toast: plan.toast, statusOverride: plan.statusOverride } })
    .eq('event_id', eventId);

  return {
    ...applied,
    statusOverride: plan.statusOverride,
    toast: plan.toast,
  };
}

/**
 * Runs engine for a task action (sent, skip, done, reschedule, etc.).
 */
export async function runEngineForTaskAction(
  taskId: string,
  action: 'sent' | 'skip' | 'done' | 'reschedule' | 'reassign',
  sessionUserId: string,
  payload: Record<string, any> = {}
): Promise<EngineResult> {
  const supabase = await createServiceClient();

  const { data: task } = await supabase
    .from('sales_followup_tasks')
    .select('*, sales_followup_enrollments(*)')
    .eq('id', taskId)
    .single();

  if (!task) {
    throw new Error('Task not found');
  }

  const enrollment = task.sales_followup_enrollments;
  const state = await loadPlannerState(supabase, task.lead_id);

  const plan = planForTaskAction({
    task,
    enrollment: { ...enrollment, pendingTasks: state.openEnrollments.find(e => e.id === enrollment.id)?.pendingTasks || [] },
    action,
    payload,
    now: new Date(),
    state,
  });

  const applied = await applyPlannerActions(supabase, task.lead_id, plan.actions, sessionUserId);

  return {
    ...applied,
    statusOverride: plan.statusOverride,
    toast: plan.toast,
  };
}

/**
 * Runs engine for a lead signal (replied, inbound, bounce, unsubscribe, etc.).
 */
export async function runEngineForLeadSignal(
  leadId: string,
  signal: any,
  sessionUserId: string,
  payload: Record<string, any> = {}
): Promise<EngineResult> {
  const supabase = await createServiceClient();
  const state = await loadPlannerState(supabase, leadId);

  const plan = planForSignal({
    signal,
    payload,
    now: new Date(),
    state,
  });

  const applied = await applyPlannerActions(supabase, leadId, plan.actions, sessionUserId);

  return {
    ...applied,
    toast: plan.toast,
  };
}

/**
 * Inbound signal for Quo webhook (spec 4.6).
 */
export async function recordInboundSignal(
  leadId: string,
  kind: 'inbound_call' | 'inbound_sms',
  eventId: string
): Promise<EngineResult> {
  const supabase = await createServiceClient();

  // Deduplicate by event_id in processed_events
  const { error: procError } = await supabase
    .from('sales_followup_processed_events')
    .insert({
      event_id: eventId,
      lead_id: leadId,
      outcome_type: kind,
    });

  if (procError && (procError as any).code === '23505') {
    return { duplicate: true };
  }

  return await runEngineForLeadSignal(leadId, kind, 'system', { eventId });
}
