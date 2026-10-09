import { calculateMonthlyMRR, calculateNextRunDate } from '@/lib/recurring-utils';
import { materializeRecurringJobs } from '@/lib/recurring-runner';
import { resolveOrCreateZone } from '@/lib/zone-matcher';
import { format, addDays } from 'date-fns';

export interface WonSalePayload {
  job_total?: number;
  price_per_visit?: number;
  service_type?: string;
  site_address?: string;
  scheduled_clean_date?: string;
  note?: string;
  is_recurring?: boolean;
  frequency?: 'weekly' | 'biweekly' | 'monthly';
  days_of_week?: string[];
  preferred_day_of_week?: string | null;
  preferred_start_time?: string;
}

export interface AutoLogResult {
  success: boolean;
  customerId?: string;
  jobId?: string;
  recurringBookingId?: string;
  isRecurring: boolean;
  error?: string;
}

/**
 * Automatically provisions a customer account, schedules jobs,
 * and sets up recurring agreements when a deal is closed as WON.
 */
export async function autoLogWonSale(
  supabase: any,
  params: {
    rawLeadId: string;
    saleDetails: WonSalePayload | null;
    repId?: string;
  }
): Promise<AutoLogResult> {
  const { rawLeadId, saleDetails, repId } = params;

  try {
    // 1. Fetch lead record
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', rawLeadId)
      .maybeSingle();

    if (leadErr) {
      console.error('[autoLogWonSale] Failed to fetch lead:', leadErr);
    }

    const contactName = (lead?.contact_name || 'Customer').trim();
    const companyName = (lead?.company_name || '').trim();
    const phone = (lead?.phone_number || '').trim();
    const email = (lead?.email || '').trim();
    const address = (saleDetails?.site_address || lead?.address || '').trim() || 'Toronto, ON';
    const city = (lead?.city || '').trim() || 'Toronto';

    // 2. Customer resolution (phone, email, or company match)
    let customerId: string | null = null;

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      const { data: existingByPhone } = await supabase
        .from('customers')
        .select('id, phone')
        .limit(10);

      const found = existingByPhone?.find((c: any) => {
        const cPhone = (c.phone || '').replace(/[^0-9]/g, '');
        return cPhone.length >= 7 && (cPhone.includes(cleanPhone) || cleanPhone.includes(cPhone));
      });
      if (found) customerId = found.id;
    }

    if (!customerId && email && email.includes('@')) {
      const { data: existingByEmail } = await supabase
        .from('customers')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      if (existingByEmail) customerId = existingByEmail.id;
    }

    if (!customerId && companyName) {
      const { data: existingByCompany } = await supabase
        .from('customers')
        .select('id')
        .ilike('company_name', companyName)
        .maybeSingle();
      if (existingByCompany) customerId = existingByCompany.id;
    }

    // If still no customer found, create customer
    if (!customerId) {
      const customerType = companyName ? 'commercial' : 'residential';
      const fallbackEmail = email || `customer-${Date.now()}@seaofblue.local`;

      const { data: newCustomer, error: custErr } = await supabase
        .from('customers')
        .insert({
          full_name: contactName,
          company_name: companyName || null,
          customer_type: customerType,
          phone: phone || '000-000-0000',
          email: fallbackEmail,
          address_line1: address,
          city,
          province: 'ON',
          is_active: true,
        })
        .select('id')
        .single();

      if (custErr) {
        console.error('[autoLogWonSale] Customer insert error:', custErr);
      } else if (newCustomer) {
        customerId = newCustomer.id;
      }
    }

    // 3. Resolve Zone
    let zoneId: string | null = null;
    try {
      const resolved = await resolveOrCreateZone({
        address_line1: address,
        city,
      });
      zoneId = resolved.zoneId;
    } catch {
      const { data: fallbackZones } = await supabase.from('zones').select('id').limit(1);
      zoneId = fallbackZones?.[0]?.id || null;
    }

    // 4. Determine if Recurring vs One-Off
    const isRecurring = Boolean(saleDetails?.is_recurring);
    let createdJobId: string | null = null;
    let recurringBookingId: string | null = null;

    if (isRecurring) {
      const frequency = saleDetails?.frequency || 'weekly';
      const pricePerVisit = Number(saleDetails?.price_per_visit || saleDetails?.job_total || 180);
      const daysOfWeek = saleDetails?.days_of_week || [];
      const preferredDay = saleDetails?.preferred_day_of_week || null;
      const startDate = saleDetails?.scheduled_clean_date || format(new Date(), 'yyyy-MM-dd');
      const monthlyAmount = calculateMonthlyMRR(pricePerVisit, frequency, daysOfWeek);
      const nextDate = calculateNextRunDate(startDate, frequency, daysOfWeek, preferredDay);

      const { data: booking, error: bookingErr } = await supabase
        .from('recurring_bookings')
        .insert({
          customer_id: customerId,
          service_type: saleDetails?.service_type || 'standard_clean',
          frequency,
          days_of_week: daysOfWeek,
          preferred_day_of_week: preferredDay,
          preferred_start_time: saleDetails?.preferred_start_time || '09:00',
          estimated_duration_minutes: 180,
          address_line1: address,
          city,
          postal_code: 'M5V 2T6',
          quoted_price: pricePerVisit,
          monthly_amount: monthlyAmount,
          contract_start_date: startDate,
          next_job_date: nextDate,
          scope_of_work: saleDetails?.note || 'Recurring Service Clean',
          zone_id: zoneId,
          is_active: true,
        })
        .select('id')
        .single();

      if (bookingErr) {
        console.error('[autoLogWonSale] Recurring contract insert error:', bookingErr);
      } else if (booking) {
        recurringBookingId = booking.id;
        // Materialize upcoming jobs immediately
        const runRes = await materializeRecurringJobs({
          bookingId: booking.id,
          lookaheadDays: 14,
          backfillFromStart: true,
        });
        if (runRes.jobs.length > 0) {
          createdJobId = runRes.jobs[0].id;
        }
      }
    } else {
      // One-off clean: insert into jobs table
      const { count: jobCount } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true });
      const nextSeq = (jobCount || 0) + 1;
      const year = new Date().getFullYear();
      const jobNumber = `SOB-${year}-${String(nextSeq).padStart(4, '0')}`;
      const scheduledDate =
        saleDetails?.scheduled_clean_date || format(addDays(new Date(), 1), 'yyyy-MM-dd');
      const quotedPrice = Number(saleDetails?.job_total || 200);

      const { data: newJob, error: jobErr } = await supabase
        .from('jobs')
        .insert({
          job_number: jobNumber,
          customer_id: customerId,
          lead_id: rawLeadId,
          service_type: saleDetails?.service_type || 'standard_clean',
          status: 'confirmed',
          scheduled_date: scheduledDate,
          scheduled_window: 'morning',
          scheduled_start_time: '09:00',
          estimated_duration_minutes: 180,
          address_line1: address,
          city,
          postal_code: 'M5V 2T6',
          quoted_price: quotedPrice,
          deposit_amount: 0,
          zone_id: zoneId,
          scope_notes: saleDetails?.note || 'Won Deal Clean',
        })
        .select('id')
        .single();

      if (jobErr) {
        console.error('[autoLogWonSale] Job insert error:', jobErr);
      } else if (newJob) {
        createdJobId = newJob.id;
      }
    }

    // 5. Update lead converted_job_id
    if (createdJobId) {
      await supabase
        .from('leads')
        .update({
          converted_job_id: createdJobId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rawLeadId);
    }

    return {
      success: true,
      customerId: customerId || undefined,
      jobId: createdJobId || undefined,
      recurringBookingId: recurringBookingId || undefined,
      isRecurring,
    };
  } catch (err: any) {
    console.error('[autoLogWonSale] Exception:', err);
    return {
      success: false,
      isRecurring: false,
      error: err.message || 'Auto log sale failed',
    };
  }
}
