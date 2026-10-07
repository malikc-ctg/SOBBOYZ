import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { FOLLOWUP_CONFIG } from '@/lib/sales/followups/config';
import { isTaskOverdue, getDueBucket } from '@/lib/sales/followups/schedule';

export async function GET(request: NextRequest) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    }

    const supabase = await createServiceClient();
    const now = new Date();
    const nowIso = now.toISOString();

    // 1. Lazily reactivate paused enrollments whose paused_until has passed
    await supabase
      .from('sales_followup_enrollments')
      .update({ status: 'active', paused_until: null, updated_at: nowIso })
      .eq('status', 'paused')
      .lte('paused_until', nowIso);

    // 2. Fetch signed-in rep's follow-up settings
    const { data: repSettings } = await supabase
      .from('sales_rep_followup_settings')
      .select('*')
      .eq('rep_id', user.id)
      .maybeSingle();

    // 3. Fetch active/held/paused enrollments + finished drips
    const { data: allEnrollments } = await supabase
      .from('sales_followup_enrollments')
      .select('*')
      .or('status.in.(active,held,paused),sequence_key.eq.no_answer_drip')
      .order('created_at', { ascending: false });

    // 4. Fetch all pending tasks
    const { data: allPendingTasks } = await supabase
      .from('sales_followup_tasks')
      .select('*')
      .eq('status', 'pending')
      .order('due_at', { ascending: true });

    // 5. Fetch all sales_lead_flags
    const { data: allFlags } = await supabase
      .from('sales_lead_flags')
      .select('*');

    // Group by lead_id
    const enrollmentsByLead = new Map<string, any[]>();
    for (const e of allEnrollments || []) {
      if (!enrollmentsByLead.has(e.lead_id)) enrollmentsByLead.set(e.lead_id, []);
      enrollmentsByLead.get(e.lead_id)!.push(e);
    }

    const tasksByLead = new Map<string, any[]>();
    for (const t of allPendingTasks || []) {
      if (!tasksByLead.has(t.lead_id)) tasksByLead.set(t.lead_id, []);
      tasksByLead.get(t.lead_id)!.push(t);
    }

    const flagsByLead = new Map<string, any>();
    for (const f of allFlags || []) {
      flagsByLead.set(f.lead_id, f);
    }

    // Collect all unique lead IDs
    const leadIds = new Set<string>();
    for (const id of Array.from(enrollmentsByLead.keys())) leadIds.add(id);
    for (const id of Array.from(tasksByLead.keys())) leadIds.add(id);
    for (const id of Array.from(flagsByLead.keys())) leadIds.add(id);

    const leadsFollowup: Record<string, any> = {};
    const bucketCounts = {
      mine: { overdue: 0, due_today: 0, upcoming: 0, later: 0, needs_attention: 0 },
      all: { overdue: 0, due_today: 0, upcoming: 0, later: 0, needs_attention: 0 },
    };

    for (const leadId of Array.from(leadIds)) {
      const enrs = enrollmentsByLead.get(leadId) || [];
      const openEnrs = enrs.filter((e) => ['active', 'held', 'paused'].includes(e.status));
      const lastEndedDrip = enrs.find(
        (e) => e.sequence_key === 'no_answer_drip' && ['completed', 'cancelled'].includes(e.status)
      );

      const tasks = tasksByLead.get(leadId) || [];
      const nextTask = tasks.length > 0 ? tasks[0] : null;
      const otherPendingCount = Math.max(0, tasks.length - 1);
      const flags = flagsByLead.get(leadId) || null;

      leadsFollowup[leadId] = {
        leadId,
        enrollments: lastEndedDrip ? [...openEnrs, lastEndedDrip] : openEnrs,
        nextTask,
        otherPendingCount,
        flags,
      };

      // Bucketing
      const isMine = nextTask?.assigned_rep_id === user.id || (!nextTask && openEnrs[0]?.owner_rep_id === user.id);

      // Check needs_attention state:
      const hasHeld = openEnrs.some((e) => e.status === 'held');
      const hasPaused = openEnrs.some((e) => e.status === 'paused');
      const hasBounced = Boolean(flags?.bounced_email);
      const hasNeedsEmail = Boolean(flags?.needs_email_since && !flags?.email_opt_out_at);
      const hasOpenedUnsent = nextTask?.kind === 'email' && Boolean(nextTask.opened_at);

      if (hasHeld || hasPaused || hasBounced || hasNeedsEmail || hasOpenedUnsent) {
        bucketCounts.all.needs_attention++;
        if (isMine) bucketCounts.mine.needs_attention++;
      }

      if (nextTask) {
        const bucket = getDueBucket(nextTask, now);
        if (bucket === 'overdue') {
          bucketCounts.all.overdue++;
          if (isMine) bucketCounts.mine.overdue++;
        } else if (bucket === 'due_today') {
          bucketCounts.all.due_today++;
          if (isMine) bucketCounts.mine.due_today++;
        } else if (bucket === 'upcoming') {
          bucketCounts.all.upcoming++;
          if (isMine) bucketCounts.mine.upcoming++;
        } else {
          bucketCounts.all.later++;
          if (isMine) bucketCounts.mine.later++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      repSettings: repSettings || {
        rep_id: user.id,
        signature_name: user.user_metadata?.full_name || 'Malik Campbell',
        signature_title: 'Account Executive',
        signature_phone: FOLLOWUP_CONFIG.company.defaultPhone,
        gmail_address: user.email || null,
      },
      meta: {
        mailingAddressSet: Boolean(FOLLOWUP_CONFIG.company.mailingAddress),
        bucketCounts,
      },
      leads: leadsFollowup,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/board] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
