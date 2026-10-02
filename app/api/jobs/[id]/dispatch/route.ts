import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { getSmartDispatchSuggestions } from '@/lib/smart-dispatch';

/**
 * GET /api/jobs/[id]/dispatch — Smart dispatch suggestions
 * Returns a ranked list of employees with drive times.
 */
export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  try {
    const supabase = await createServiceClient();
    const { id } = params;

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, customer:customers(full_name)')
      .eq('id', id)
      .single();

    if (error || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    const suggestions = await getSmartDispatchSuggestions(job);
    return NextResponse.json({ suggestions, job_id: id });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

/**
 * POST /api/jobs/[id]/dispatch — Dispatch offers to employees or directly assign crew
 */
export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  try {
    const supabase = await createServiceClient();
    const { id } = params;
    const body = await request.json();
    const { mode, employee_id, employee_ids, drive_times } = body;

    // Get job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // 1. Direct Assignment (Primary Flow) - supports 1 or MORE cleaners
    if (mode === 'direct_assign' || employee_id) {
      const targetEmpIds: string[] = Array.isArray(employee_ids) && employee_ids.length > 0
        ? employee_ids
        : (employee_id ? [employee_id] : []);

      if (targetEmpIds.length === 0) {
        return NextResponse.json({ error: 'At least one cleaner required for direct assignment' }, { status: 400 });
      }

      const primaryEmpId = targetEmpIds[0];

      const { data: updatedJob, error: updateError } = await supabase
        .from('jobs')
        .update({
          assigned_employee_id: primaryEmpId,
          assigned_employee_ids: targetEmpIds,
          status: 'assigned',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select('*, employee:employees(*)')
        .single();

      if (updateError) throw updateError;

      // Fetch all assigned employees for crew
      const { data: crew } = await supabase
        .from('employees')
        .select('*')
        .in('id', targetEmpIds);

      if (updatedJob) {
        updatedJob.assigned_employees = crew || [];
      }

      // Expire/cancel any pending offers on this job
      await supabase
        .from('job_offers')
        .update({ status: 'declined', decline_reason: 'Assigned directly by dispatch' })
        .eq('job_id', id)
        .eq('status', 'pending');

      return NextResponse.json({ success: true, job: updatedJob, crew_count: targetEmpIds.length });
    }

    // 2. Broadcast Offers Flow (Secondary)
    if (!employee_ids || !Array.isArray(employee_ids) || employee_ids.length === 0) {
      return NextResponse.json({ error: 'employee_ids required' }, { status: 400 });
    }

    if (employee_ids.length > 5) {
      return NextResponse.json({ error: 'Max 5 employees per dispatch' }, { status: 400 });
    }

    // Create offers with drive time data
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 60 min window
    const offers = employee_ids.map((cid: string, idx: number) => ({
      job_id: id,
      employee_id: cid,
      status: 'pending',
      expires_at: expiresAt,
      estimated_drive_minutes: drive_times?.[idx] ?? null,
      dispatch_reason: 'smart_dispatch',
    }));

    const { data: createdOffers, error: offerError } = await supabase
      .from('job_offers')
      .insert(offers)
      .select();

    if (offerError) throw offerError;

    // Update job status to offered
    await supabase
      .from('jobs')
      .update({ status: 'offered', updated_at: new Date().toISOString() })
      .eq('id', id);

    // Audit log
    logAudit({
      actorId: 'admin',
      actorEmail: 'admin@seaofblue.app',
      actorRole: 'admin',
      action: 'job.dispatched',
      entityType: 'job',
      entityId: id,
      oldValues: { status: job.status },
      newValues: { status: 'offered', employee_ids },
      request,
      metadata: { offer_count: employee_ids.length, assignment_type: 'broadcast_offers' },
    });

    return NextResponse.json({ success: true, offers: createdOffers });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
