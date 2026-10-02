import { requireRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { generateDatesForSchedule, calculateNextRunDate } from '@/lib/recurring-utils';
import { inferTimeWindow } from '@/lib/time-utils';

export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json().catch(() => ({}));
    const lookaheadDays = Number(body.lookahead_days) || 14;

    // 1. Fetch active recurring bookings
    const { data: activeBookings, error: fetchError } = await supabase
      .from('recurring_bookings')
      .select('*')
      .eq('is_active', true);

    if (fetchError) throw fetchError;
    if (!activeBookings || activeBookings.length === 0) {
      return NextResponse.json({ success: true, count: 0, message: 'No active recurring contracts found.' });
    }

    // Default zone fallback if booking has none
    const { data: zones } = await supabase.from('zones').select('id').limit(1);
    const defaultZoneId = zones?.[0]?.id;

    // Get current job count for sequence number
    const { count: currentJobCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    let nextJobSeq = (currentJobCount || 0) + 1;
    const generatedJobs: any[] = [];
    const today = new Date();

    for (const booking of activeBookings) {
      // Find candidate dates in lookahead window
      const candidateDates = generateDatesForSchedule(
        today,
        lookaheadDays,
        booking.frequency,
        booking.days_of_week || [],
        booking.preferred_day_of_week
      );

      for (const scheduledDate of candidateDates) {
        // Check if job already created for this booking & date
        const { data: existing } = await supabase
          .from('jobs')
          .select('id')
          .eq('recurring_booking_id', booking.id)
          .eq('scheduled_date', scheduledDate)
          .maybeSingle();

        if (!existing) {
          const year = new Date().getFullYear();
          const job_number = `SOB-${year}-${String(nextJobSeq++).padStart(4, '0')}`;
          const startTime = booking.preferred_start_time || '09:00';
          const window = inferTimeWindow(startTime);

          const { data: newJob, error: insertError } = await supabase
            .from('jobs')
            .insert({
              job_number,
              customer_id: booking.customer_id,
              recurring_booking_id: booking.id,
              service_type: booking.service_type,
              status: booking.preferred_employee_id ? 'assigned' : 'confirmed',
              scheduled_date: scheduledDate,
              scheduled_window: window,
              scheduled_start_time: startTime,
              estimated_duration_minutes: booking.estimated_duration_minutes || 180,
              address_line1: booking.address_line1,
              city: booking.city,
              postal_code: booking.postal_code,
              quoted_price: booking.quoted_price,
              deposit_amount: 0,
              assigned_employee_id: booking.preferred_employee_id || null,
              assigned_team_id: booking.preferred_team_id || null,
              zone_id: booking.zone_id || defaultZoneId,
              scope_notes: booking.scope_of_work || booking.notes || 'Recurring Service Clean',
            })
            .select()
            .single();

          if (!insertError && newJob) {
            generatedJobs.push(newJob);
          }
        }
      }

      // Update next_job_date for this recurring contract
      const nextDate = calculateNextRunDate(
        candidateDates[candidateDates.length - 1] || today,
        booking.frequency,
        booking.days_of_week || [],
        booking.preferred_day_of_week
      );

      await supabase
        .from('recurring_bookings')
        .update({
          next_job_date: nextDate,
          last_job_date: candidateDates[candidateDates.length - 1] || booking.last_job_date,
        })
        .eq('id', booking.id);
    }

    return NextResponse.json({
      success: true,
      count: generatedJobs.length,
      jobs: generatedJobs,
    });
  } catch (err: unknown) {
    console.error('POST /api/recurring/generate-jobs error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
