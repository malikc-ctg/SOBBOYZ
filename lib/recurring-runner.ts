import { createServiceClient } from '@/lib/supabase/server';
import { generateDatesBetween, calculateNextRunDate } from '@/lib/recurring-utils';
import { inferTimeWindow } from '@/lib/time-utils';
import { addDays, format, parseISO, startOfDay, isBefore, isAfter } from 'date-fns';

export interface MaterializeOptions {
  bookingId?: string;
  lookaheadDays?: number;
  backfillFromStart?: boolean;
}

export interface MaterializeResult {
  success: boolean;
  totalEvaluated: number;
  newJobsCreated: number;
  existingJobsLinked: number;
  jobs: any[];
  errors: string[];
}

/**
 * Materializes recurring service visits into confirmed/completed jobs.
 * Supports forward rolling horizons and historical backfills.
 */
export async function materializeRecurringJobs(
  options: MaterializeOptions = {}
): Promise<MaterializeResult> {
  const { bookingId, lookaheadDays = 14, backfillFromStart = false } = options;
  const supabase = await createServiceClient();

  const result: MaterializeResult = {
    success: true,
    totalEvaluated: 0,
    newJobsCreated: 0,
    existingJobsLinked: 0,
    jobs: [],
    errors: [],
  };

  try {
    let query = supabase.from('recurring_bookings').select('*');
    if (bookingId) {
      query = query.eq('id', bookingId);
    } else {
      query = query.eq('is_active', true);
    }

    const { data: bookings, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;
    if (!bookings || bookings.length === 0) {
      return result;
    }

    // Default zone fallback
    const { data: zones } = await supabase.from('zones').select('id').limit(1);
    const defaultZoneId = zones?.[0]?.id;

    // Get current job count for sequence numbers
    const { count: currentJobCount } = await supabase
      .from('jobs')
      .select('*', { count: 'exact', head: true });

    let nextJobSeq = (currentJobCount || 0) + 1;
    const today = startOfDay(new Date());
    const todayStr = format(today, 'yyyy-MM-dd');
    const horizonEnd = addDays(today, lookaheadDays);
    const horizonEndStr = format(horizonEnd, 'yyyy-MM-dd');

    for (const booking of bookings) {
      result.totalEvaluated++;

      // Determine date window
      let windowStartStr = todayStr;
      if (backfillFromStart && booking.contract_start_date) {
        windowStartStr = booking.contract_start_date;
      }

      // Generate all target dates across window
      const targetDates = generateDatesBetween(
        windowStartStr,
        horizonEndStr,
        booking.frequency,
        booking.days_of_week || [],
        booking.preferred_day_of_week
      );

      let latestPastDate: string | null = booking.last_job_date || null;
      let earliestFutureDate: string | null = null;

      for (const scheduledDate of targetDates) {
        const isPast = scheduledDate < todayStr;
        if (isPast) {
          if (!latestPastDate || scheduledDate > latestPastDate) {
            latestPastDate = scheduledDate;
          }
        } else {
          if (!earliestFutureDate || scheduledDate < earliestFutureDate) {
            earliestFutureDate = scheduledDate;
          }
        }

        // Check if job already exists for this recurring booking on this date
        const { data: existingRecJob } = await supabase
          .from('jobs')
          .select('id, job_number, status')
          .eq('recurring_booking_id', booking.id)
          .eq('scheduled_date', scheduledDate)
          .maybeSingle();

        if (existingRecJob) {
          continue;
        }

        // Check if customer already has a job on this date (e.g. manually logged previously)
        if (booking.customer_id) {
          const { data: existingCustJob } = await supabase
            .from('jobs')
            .select('id, job_number, status, recurring_booking_id')
            .eq('customer_id', booking.customer_id)
            .eq('scheduled_date', scheduledDate)
            .maybeSingle();

          if (existingCustJob) {
            // Link existing job to this recurring booking
            if (!existingCustJob.recurring_booking_id) {
              await supabase
                .from('jobs')
                .update({ recurring_booking_id: booking.id })
                .eq('id', existingCustJob.id);
              result.existingJobsLinked++;
            }
            continue;
          }
        }

        // Create new job
        const year = new Date().getFullYear();
        const job_number = `SOB-${year}-${String(nextJobSeq++).padStart(4, '0')}`;
        const startTime = booking.preferred_start_time || '09:00';
        const window = inferTimeWindow(startTime);
        const status = isPast
          ? 'completed'
          : booking.preferred_employee_id
          ? 'assigned'
          : 'confirmed';

        const jobPayload: Record<string, any> = {
          job_number,
          customer_id: booking.customer_id,
          recurring_booking_id: booking.id,
          service_type: booking.service_type || 'standard_clean',
          status,
          scheduled_date: scheduledDate,
          scheduled_window: window,
          scheduled_start_time: startTime,
          estimated_duration_minutes: booking.estimated_duration_minutes || 180,
          address_line1: booking.address_line1,
          city: booking.city || 'Toronto',
          postal_code: booking.postal_code || 'M5V 2T6',
          quoted_price: booking.quoted_price,
          deposit_amount: 0,
          assigned_employee_id: booking.preferred_employee_id || null,
          assigned_team_id: booking.preferred_team_id || null,
          zone_id: booking.zone_id || defaultZoneId,
          scope_notes: booking.scope_of_work || booking.notes || 'Recurring Service Clean',
        };

        if (isPast) {
          jobPayload.employee_started_at = `${scheduledDate}T09:00:00Z`;
          jobPayload.employee_completed_at = `${scheduledDate}T12:00:00Z`;
        }

        const { data: newJob, error: insertError } = await supabase
          .from('jobs')
          .insert(jobPayload)
          .select()
          .single();

        if (insertError) {
          result.errors.push(`Failed to insert job for date ${scheduledDate}: ${insertError.message}`);
        } else if (newJob) {
          result.newJobsCreated++;
          result.jobs.push(newJob);
        }
      }

      // Compute next run date if earliestFutureDate wasn't found in current window
      const finalNextDate =
        earliestFutureDate ||
        calculateNextRunDate(
          latestPastDate || todayStr,
          booking.frequency,
          booking.days_of_week || [],
          booking.preferred_day_of_week
        );

      await supabase
        .from('recurring_bookings')
        .update({
          last_job_date: latestPastDate,
          next_job_date: finalNextDate,
        })
        .eq('id', booking.id);
    }
  } catch (err: any) {
    result.success = false;
    result.errors.push(err.message || 'Unknown error');
  }

  return result;
}
