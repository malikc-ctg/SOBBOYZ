import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getOrRunLeadRecon, parseLeadIntelJson } from '@/lib/sales/followups/recon';
import { draftDossierEmailWithClaude, runTranscriptAutopilot } from '@/lib/sales/followups/aiDrafter';
import { sendEmailViaRepGmail } from '@/lib/sales/followups/gmailAgent';
import { runEngineForTaskAction } from '@/lib/sales/followups/executor';
import { resolveRepConfig } from '@/lib/sales/followups/config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const leadId = searchParams.get('leadId');
    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const rawLeadId = String(leadId).replace(/^lead_/, '');
    const supabase = await createServiceClient();
    const { data: lead } = await supabase
      .from('leads')
      .select('id, notes')
      .eq('id', rawLeadId)
      .maybeSingle();

    const intel = parseLeadIntelJson(lead?.notes);
    return NextResponse.json({
      success: true,
      recon: intel.ai_recon || null,
      lastAutopilot: intel.last_autopilot || null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
    } = await supabaseUserClient.auth.getUser();

    const body = await request.json();
    const {
      action = 'draft',
      leadId,
      templateKey,
      taskId,
      repIdentifier,
      customInstruction,
      forceReconRefresh,
      subject,
      emailBody,
      to,
      transcript,
    } = body;

    if (!leadId) {
      return NextResponse.json({ error: 'leadId is required' }, { status: 400 });
    }

    const rawLeadId = String(leadId).replace(/^lead_/, '');
    const effectiveRepId = repIdentifier || user?.id || 'malik';

    // 1. Recon only (Website + LinkedIn + Pre-Call Whisper Card)
    if (action === 'recon') {
      const recon = await getOrRunLeadRecon(rawLeadId, {
        forceRefresh: Boolean(forceReconRefresh),
      });
      return NextResponse.json({
        success: true,
        recon,
      });
    }

    // 2. Post-Call Transcript Autopilot
    if (action === 'autopilot') {
      const result = await runTranscriptAutopilot(rawLeadId, transcript || '');
      return NextResponse.json({
        success: true,
        autopilot: result,
      });
    }

    // 3. Cancel / Hold 20-minute Auto-Send on a no_answer_drip task
    if (action === 'cancel_auto_send') {
      const supabase = await createServiceClient();
      const { data: enr } = await supabase
        .from('sales_followup_enrollments')
        .select('*')
        .eq('lead_id', rawLeadId)
        .eq('status', 'active')
        .maybeSingle();

      if (enr) {
        const stepKey = body.stepKey || 'drip_email_1';
        await supabase
          .from('sales_followup_enrollments')
          .update({
            context: {
              ...(enr.context || {}),
              auto_send_cancelled: {
                ...(enr.context?.auto_send_cancelled || {}),
                [stepKey]: true,
              },
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', enr.id);
      }
      return NextResponse.json({ success: true, autoSendCancelled: true });
    }

    // 4. Send directly via Rep's connected Gmail (or Resend fallback) & advance sequence
    if (action === 'send_now') {
      const supabase = await createServiceClient();
      let finalSubject = subject;
      let finalBody = emailBody;
      let recipient = to;

      if (!recipient) {
        const { data: l } = await supabase
          .from('leads')
          .select('customer_email')
          .eq('id', rawLeadId)
          .maybeSingle();
        recipient = l?.customer_email;
      }

      if (!recipient) {
        return NextResponse.json({ error: 'Lead does not have an email address' }, { status: 400 });
      }

      if (!finalSubject || !finalBody) {
        const drafted = await draftDossierEmailWithClaude({
          leadId: rawLeadId,
          templateKey,
          taskId,
          repIdentifier: effectiveRepId,
          customInstruction,
        });
        finalSubject = drafted.subject;
        finalBody = drafted.body;
      }

      const sendRes = await sendEmailViaRepGmail({
        repIdentifier: effectiveRepId,
        to: recipient,
        subject: finalSubject,
        body: finalBody,
      });

      if (taskId) {
        const nowIso = new Date().toISOString();
        const repCfg = resolveRepConfig(effectiveRepId);
        await supabase
          .from('sales_followup_tasks')
          .update({
            completed_at: nowIso,
            completed_by: user?.id || repCfg.auth_user_id,
            sent_to: recipient,
            rendered_subject: finalSubject,
            rendered_body: finalBody,
            updated_at: nowIso,
          })
          .eq('id', taskId)
          .eq('status', 'pending');

        await runEngineForTaskAction(
          taskId,
          'sent',
          user?.id || repCfg.auth_user_id || 'system',
          {
            to: recipient,
            subject: finalSubject,
            body: finalBody,
          }
        );
      }

      return NextResponse.json({
        success: true,
        sent: true,
        channel: sendRes.channel,
        from: sendRes.from,
        subject: finalSubject,
        body: finalBody,
      });
    }

    // Default: Scope Website/LinkedIn + Draft Personalized Email with Claude Sonnet 5.5
    const draft = await draftDossierEmailWithClaude({
      leadId: rawLeadId,
      templateKey,
      taskId,
      repIdentifier: effectiveRepId,
      customInstruction,
      forceReconRefresh: Boolean(forceReconRefresh),
    });

    return NextResponse.json({
      success: true,
      draft,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/ai-draft] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
