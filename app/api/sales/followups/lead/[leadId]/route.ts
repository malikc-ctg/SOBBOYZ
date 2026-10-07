import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { runEngineForLeadSignal } from '@/lib/sales/followups/executor';

export async function GET(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
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
    const rawLeadId = String(params.leadId).replace(/^lead_/, '');

    // 1. Fetch enrollments & all tasks
    const { data: enrollments } = await supabase
      .from('sales_followup_enrollments')
      .select('*')
      .eq('lead_id', rawLeadId)
      .order('created_at', { ascending: false });

    const enrollmentIds = (enrollments || []).map((e: any) => e.id);

    const { data: tasks } = await supabase
      .from('sales_followup_tasks')
      .select('*')
      .in('enrollment_id', enrollmentIds.length > 0 ? enrollmentIds : ['00000000-0000-0000-0000-000000000000'])
      .order('due_at', { ascending: true });

    // 2. Fetch flags
    const { data: flags } = await supabase
      .from('sales_lead_flags')
      .select('*')
      .eq('lead_id', rawLeadId)
      .maybeSingle();

    // 3. Sent snapshots
    const sentEmails = (tasks || [])
      .filter((t: any) => t.status === 'done' && t.result === 'sent')
      .map((t: any) => ({
        id: t.id,
        step_key: t.step_key,
        sent_to: t.sent_to,
        subject: t.rendered_subject,
        body: t.rendered_body,
        completed_at: t.completed_at,
        completed_by: t.completed_by,
      }));

    // Attach tasks to enrollments
    const enrollmentsWithTasks = (enrollments || []).map((e: any) => ({
      ...e,
      tasks: (tasks || []).filter((t: any) => t.enrollment_id === e.id),
    }));

    return NextResponse.json({
      success: true,
      leadId: rawLeadId,
      enrollments: enrollmentsWithTasks,
      flags,
      sentEmails,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/lead/[leadId]] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

const LeadActionSchema = z.object({
  action: z.enum([
    'replied',
    'bounced',
    'unsubscribe',
    'do_not_contact',
    'clear_flag',
    'pause',
    'resume',
    'stop',
    'start_held',
    'skip_held',
    'start_drip',
    'walkthrough_reschedule',
    'callback_reschedule',
    'quote_details',
    'add_referral',
  ]),
  kind: z.string().optional(),
  flag: z.string().optional(),
  until: z.string().optional(),
  enrollmentId: z.string().optional(),
  walkthroughAt: z.string().optional(),
  siteAddress: z.string().optional(),
  siteContactName: z.string().optional(),
  siteContactPhone: z.string().optional(),
  scopePhase: z.string().optional(),
  siteNotes: z.string().optional(),
  callbackAt: z.string().optional(),
  sendConfirmation: z.boolean().optional(),
  amount: z.string().optional(),
  scope: z.string().optional(),
  newLeadId: z.string().optional(),
  referrerName: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { leadId: string } }
) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = LeadActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request', details: parsed.error.issues }, { status: 400 });
    }

    const rawLeadId = String(params.leadId).replace(/^lead_/, '');
    const supabase = await createServiceClient();
    const { action, ...payload } = parsed.data;

    if (action === 'clear_flag') {
      const flagName = payload.flag;
      if (flagName === 'bounced') {
        await supabase
          .from('sales_lead_flags')
          .update({ bounced_email: null, bounced_at: null, updated_at: new Date().toISOString() })
          .eq('lead_id', rawLeadId);
      } else if (flagName === 'do_not_contact') {
        await supabase
          .from('sales_lead_flags')
          .update({ do_not_contact_at: null, updated_at: new Date().toISOString() })
          .eq('lead_id', rawLeadId);
      } else if (flagName === 'unsubscribe') {
        await supabase
          .from('sales_lead_flags')
          .update({ email_opt_out_at: null, updated_at: new Date().toISOString() })
          .eq('lead_id', rawLeadId);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'add_referral') {
      // Starts referral intro on the new lead
      if (payload.newLeadId) {
        await runEngineForLeadSignal(payload.newLeadId, 'start_referral' as any, user.id, {
          referrerName: payload.referrerName,
          referrerLeadId: rawLeadId,
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'quote_details') {
      // Save quote details onto active walkthrough enrollment
      const { data: enr } = await supabase
        .from('sales_followup_enrollments')
        .select('*')
        .eq('lead_id', rawLeadId)
        .eq('sequence_key', 'walkthrough')
        .eq('status', 'active')
        .maybeSingle();

      if (enr) {
        await supabase
          .from('sales_followup_enrollments')
          .update({
            context: {
              ...enr.context,
              quoteAmount: payload.amount || enr.context.quoteAmount,
              scopePhase: payload.scope || enr.context.scopePhase,
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', enr.id);
      }
      return NextResponse.json({ success: true });
    }

    const res = await runEngineForLeadSignal(rawLeadId, action, user.id, payload);

    return NextResponse.json({
      success: true,
      result: res,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/lead/[leadId]] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
