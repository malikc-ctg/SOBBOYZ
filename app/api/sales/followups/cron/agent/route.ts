import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  runNoAnswerAutoSender,
  scanRepInboxesAndRemind,
  getActiveInboxAlerts,
  getAllRepsGmailStatus,
} from '@/lib/sales/followups/gmailAgent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const repId = searchParams.get('repId');
    const runCycle = searchParams.get('run') === '1';

    let cycleResult = null;
    if (runCycle) {
      const [sendResult, inboxResult] = await Promise.all([
        runNoAnswerAutoSender({ limit: 8 }),
        scanRepInboxesAndRemind({ sendEmailDigest: searchParams.get('digest') === '1' }),
      ]);
      cycleResult = { sendResult, inboxResult };
    }

    const [alerts, repsGmail] = await Promise.all([
      getActiveInboxAlerts(repId),
      getAllRepsGmailStatus(),
    ]);

    return NextResponse.json({
      success: true,
      alerts,
      repsGmail,
      cycleResult,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/cron/agent] GET error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action = 'run_all', alertId, forceTaskId, sendDigest } = body;

    if (action === 'dismiss_alert' && alertId) {
      const supabase = await createServiceClient();
      const { data: existing } = await supabase
        .from('sales_followup_processed_events')
        .select('*')
        .eq('event_id', alertId)
        .maybeSingle();

      if (existing?.summary) {
        await supabase
          .from('sales_followup_processed_events')
          .update({
            summary: { ...existing.summary, status: 'resolved' },
          })
          .eq('event_id', alertId);
      }
      return NextResponse.json({ success: true });
    }

    if (action === 'auto_send_only') {
      const sendResult = await runNoAnswerAutoSender({ forceTaskId, limit: 10 });
      return NextResponse.json({ success: true, sendResult });
    }

    if (action === 'scan_inbox_only') {
      const inboxResult = await scanRepInboxesAndRemind({ sendEmailDigest: Boolean(sendDigest) });
      return NextResponse.json({ success: true, inboxResult });
    }

    const [sendResult, inboxResult] = await Promise.all([
      runNoAnswerAutoSender({ forceTaskId, limit: 10 }),
      scanRepInboxesAndRemind({ sendEmailDigest: Boolean(sendDigest) }),
    ]);

    return NextResponse.json({
      success: true,
      sendResult,
      inboxResult,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/cron/agent] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
