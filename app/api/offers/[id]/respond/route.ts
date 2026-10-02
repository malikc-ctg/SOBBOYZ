import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { linkEmployeeByVerifiedEmail } from '@/lib/employee-link';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
  // Auth check
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { id } = params;
    const { action, decline_reason } = await request.json();

    if (!action || !['accept', 'decline'].includes(action)) {
      return NextResponse.json({ error: 'action must be accept or decline' }, { status: 400 });
    }

    const { data: offer, error: offerError } = await supabase
      .from('job_offers')
      .select('*, job:jobs(*)')
      .eq('id', id)
      .single();

    if (offerError || !offer) {
      return NextResponse.json({ error: 'Offer not found' }, { status: 404 });
    }

    // Only the employee the offer was made to may respond (same lookup as GET /api/offers)
    let { data: employee } = await supabase
      .from('employees')
      .select('id')
      .eq('profile_id', auth.id)
      .maybeSingle();

    if (!employee) {
      const linkedId = await linkEmployeeByVerifiedEmail(supabase, auth);
      if (linkedId) employee = { id: linkedId };
    }

    if (!employee || offer.employee_id !== employee.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (offer.status !== 'pending') {
      return NextResponse.json({ error: 'Offer is no longer pending' }, { status: 422 });
    }

    // Check if expired
    if (offer.expires_at && new Date(offer.expires_at) < new Date()) {
      await supabase.from('job_offers').update({ status: 'expired' }).eq('id', id);
      return NextResponse.json({ error: 'Offer has expired' }, { status: 422 });
    }

    if (action === 'accept') {
      // Accept this offer
      await supabase
        .from('job_offers')
        .update({ status: 'accepted', responded_at: new Date().toISOString() })
        .eq('id', id);

      // Decline all other pending offers for this job
      await supabase
        .from('job_offers')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('job_id', offer.job_id)
        .neq('id', id)
        .eq('status', 'pending');

      // Update job status to accepted and assign employee
      await supabase
        .from('jobs')
        .update({
          status: 'accepted',
          assigned_employee_id: offer.employee_id,
          updated_at: new Date().toISOString(),
        })
        .eq('id', offer.job_id);

      return NextResponse.json({ status: 'accepted' });
    } else {
      // Decline
      await supabase
        .from('job_offers')
        .update({
          status: 'declined',
          responded_at: new Date().toISOString(),
          decline_reason,
        })
        .eq('id', id);

      // Check if all offers are now declined/expired
      const { data: remaining } = await supabase
        .from('job_offers')
        .select('id')
        .eq('job_id', offer.job_id)
        .eq('status', 'pending');

      if (!remaining || remaining.length === 0) {
        await supabase
          .from('jobs')
          .update({ status: 'confirmed', updated_at: new Date().toISOString() })
          .eq('id', offer.job_id);
      }

      return NextResponse.json({ status: 'declined' });
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
