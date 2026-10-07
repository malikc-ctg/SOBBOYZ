import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { loadPlannerState, applyPlannerActions } from '@/lib/sales/followups/executor';

const BackfillSchema = z.object({
  dryRun: z.boolean().default(true),
});

export async function POST(request: NextRequest) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = BackfillSchema.safeParse(body);
    const dryRun = parsed.success ? parsed.data.dryRun : true;

    const supabase = await createServiceClient();
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

    // Find NO_ANSWER call events in the last 14 days
    const { data: events } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'PHONE_CALL')
      .gte('created_at', fourteenDaysAgo)
      .order('created_at', { ascending: false });

    const candidateLeadIds = new Map<string, string>(); // leadId -> lastNoAnswerAt
    for (const e of events || []) {
      const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
      if (String(p?.outcome_type || '').toUpperCase() === 'NO_ANSWER') {
        const contactId = String(p?.contact_id || '').replace(/^lead_/, '');
        if (contactId && !candidateLeadIds.has(contactId)) {
          candidateLeadIds.set(contactId, e.created_at || p?.timestamp || new Date().toISOString());
        }
      }
    }

    const eligibleLeads: Array<{ id: string; name: string; email: string; anchorAt: string }> = [];

    for (const [leadId, lastNoAnswerAt] of Array.from(candidateLeadIds.entries())) {
      try {
        const state = await loadPlannerState(supabase, leadId);
        // Must be cold, have an email, never had drip, not DNC/unsubscribed
        if (
          !state.isWarm &&
          !state.flags?.warm_at &&
          !state.hadDripEver &&
          !state.flags?.do_not_contact_at &&
          !state.flags?.email_opt_out_at &&
          state.lead.customer_email &&
          state.lead.customer_email.includes('@') &&
          state.openEnrollments.length === 0
        ) {
          eligibleLeads.push({
            id: leadId,
            name: state.lead.customer_name || 'Prospect',
            email: state.lead.customer_email,
            anchorAt: lastNoAnswerAt,
          });
        }
      } catch {
        // Skip leads that don't exist
      }
    }

    if (dryRun) {
      return NextResponse.json({
        success: true,
        dryRun: true,
        count: eligibleLeads.length,
        leads: eligibleLeads.map((l) => ({ id: l.id, name: l.name, email: l.email })),
      });
    }

    // Real run: enroll each lead
    const started: string[] = [];
    const now = new Date();

    for (const item of eligibleLeads) {
      const anchor = new Date(item.anchorAt);
      const actions = [
        {
          type: 'start_enrollment' as const,
          sequenceKey: 'no_answer_drip' as const,
          lane: 'prospect' as const,
          status: 'active' as const,
          anchorAt: anchor,
          context: {},
          initialTasks: [
            {
              stepKey: 'drip_email_1',
              kind: 'email' as const,
              templateKey: 'drip_1',
              title: 'Email 1: Who handles closeout cleaning?',
              dueAt: now,
            },
          ],
        },
      ];

      await applyPlannerActions(supabase, item.id, actions, user.id);
      started.push(item.id);
    }

    return NextResponse.json({
      success: true,
      dryRun: false,
      startedCount: started.length,
      startedLeadIds: started,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/backfill] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
