import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { getDisputeWithMessages, addDisputeMessage, resolveDispute } from '@/lib/dispute-engine';
import { requireRole } from '@/lib/api-auth';

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const result = await getDisputeWithMessages(params.id);
    return NextResponse.json(result);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  // Add message to dispute thread
  try {
    const body = await request.json();
    const { sender_id, sender_role, message, attachments } = body;

    if (!sender_id || !sender_role || !message) {
      return NextResponse.json({ error: 'sender_id, sender_role, message required' }, { status: 400 });
    }

    await addDisputeMessage({
      dispute_id: params.id,
      sender_id, sender_role, message,
      attachments: attachments ?? [],
    });

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  // Resolve dispute
  try {
    const body = await request.json();
    const { resolved_by, resolution_notes, refund_amount, employee_penalty, new_status } = body;

    if (!resolved_by || !resolution_notes || !new_status) {
      return NextResponse.json({ error: 'resolved_by, resolution_notes, new_status required' }, { status: 400 });
    }

    await resolveDispute({
      dispute_id: params.id,
      resolved_by, resolution_notes,
      refund_amount: refund_amount ?? undefined,
      employee_penalty: employee_penalty ?? undefined,
      new_status,
    });

    // If refund, issue via Stripe
    if (refund_amount && refund_amount > 0) {
      const supabase = await createServiceClient();
      const { data: dispute } = await supabase
        .from('disputes')
        .select('job:jobs(stripe_charge_id)')
        .eq('id', params.id)
        .single();

      if (dispute?.job) {
        const job = dispute.job as unknown as { stripe_charge_id: string | null };
        if (job.stripe_charge_id) {
          // Stripe refund integration pending — refund amount is tracked in dispute record
          console.warn(`[STRIPE_REFUND_PENDING] charge=${job.stripe_charge_id} amount=$${refund_amount} dispute=${params.id}`);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
