import { createServiceClient } from '@/lib/supabase/server';
import { isValidTransition } from '@/lib/job-state-machine';
import { NextRequest, NextResponse } from 'next/server';
import type { JobStatus } from '@/types';
import { requireAuth } from '@/lib/api-auth';
import { sendEmail } from '@/lib/resend';
import { logAudit } from '@/lib/audit';
import JobAssigned from '@/emails/employee/JobAssigned';
import EmployeeJobCancelled from '@/emails/employee/JobCancelled';
import React from 'react';
import { sendJobAssignedPush, sendGenericPush } from '@/lib/web-push';
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Auth check
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { id } = params;
    const { status: newStatus, ...extraFields } = await request.json();

    // requireAuth() resolves the app role from profiles
    const isAdmin = auth.role === 'admin';

    // Get current job
    const { data: job, error: fetchError } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    let employeeId = null;
    if (!isAdmin && auth.id) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('profile_id', auth.id)
        .maybeSingle();
      employeeId = employee?.id;
    }

    // Security Check: Only admin or the assigned employee can update this job
    if (!isAdmin) {
      const isDirectlyAssigned = job.assigned_employee_id === employeeId;
      const isAssignedArray = Array.isArray(job.assigned_employee_ids) && job.assigned_employee_ids.includes(employeeId);
      
      let isMultiCleanerAssigned = false;
      if (!isDirectlyAssigned && !isAssignedArray && employeeId) {
        try {
          const { data: cleanerRow } = await supabase
            .from('job_cleaners')
            .select('id')
            .eq('job_id', id)
            .eq('employee_id', employeeId)
            .maybeSingle();
          isMultiCleanerAssigned = !!cleanerRow;
        } catch {}
      }

      if (!isDirectlyAssigned && !isAssignedArray && !isMultiCleanerAssigned) {
        return NextResponse.json({ error: 'Unauthorized to update this job' }, { status: 403 });
      }
    }

    // Validate transition
    if (!isValidTransition(job.status as JobStatus, newStatus as JobStatus)) {
      return NextResponse.json(
        { error: `Invalid status transition: ${job.status} → ${newStatus}` },
        { status: 422 }
      );
    }

    // Build update object
    const updateData: Record<string, any> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Handle specific transitions
    if (newStatus === 'in_progress') {
      updateData.employee_started_at = new Date().toISOString();
    }
    if (newStatus === 'completed') {
      updateData.employee_completed_at = new Date().toISOString();
    }
    if (newStatus === 'cancelled' && extraFields.cancellation_reason) {
      updateData.cancellation_reason = extraFields.cancellation_reason;
    }
    if (newStatus === 'disputed' && extraFields.dispute_reason) {
      updateData.dispute_reason = extraFields.dispute_reason;
    }

    // Merge any additional admin-only fields
    if (isAdmin) {
      if (extraFields.final_price !== undefined) updateData.final_price = extraFields.final_price;
      if (extraFields.admin_notes !== undefined) updateData.admin_notes = extraFields.admin_notes;
      if (extraFields.assigned_employee_id !== undefined) {
        updateData.assigned_employee_id = extraFields.assigned_employee_id;
      }
    }

    const { data, error } = await supabase
      .from('jobs')
      .update(updateData)
      .eq('id', id)
      .select('*, customer:customers(*), employee:employees(*)')
      .single();

    if (error) throw error;

    // ----- AUDIT LOG -----
    logAudit({
      actorId: auth.id,
      actorEmail: auth.email,
      actorRole: isAdmin ? 'admin' : 'employee',
      action: 'job.status_changed',
      entityType: 'job',
      entityId: id,
      oldValues: { status: job.status },
      newValues: { status: newStatus },
      request,
      metadata: extraFields.cancellation_reason ? { cancellation_reason: extraFields.cancellation_reason } : undefined,
    });

    // ----- EMAIL DISPATCH LOGIC -----
    try {
      const contObj = Array.isArray(data.employee) ? data.employee[0] : data.employee;
      const contName = contObj?.full_name || 'Employee';
      const contEmail = contObj?.email;
      const date = data.scheduled_date || 'TBD';
      const time = data.scheduled_window || 'TBD';
      
      // 1. If an employee was just assigned
      if (extraFields.assigned_employee_id && job.assigned_employee_id !== extraFields.assigned_employee_id) {
         if (contEmail) {
           await sendEmail({
             to: contEmail,
             subject: 'New Job Assigned',
             react: React.createElement(JobAssigned, {
               employeeName: contName,
               date,
               timeWindow: time,
               location: `${data.address_line1}, ${data.city}`,
               jobDetails: data.service_type || 'Standard Clean',
               dashboardLink: 'https://seaofblue.app/employee'
             })
           });
         }
      }

       // ---- WEB PUSH to assigned employee ----
       if (extraFields.assigned_employee_id && job.assigned_employee_id !== extraFields.assigned_employee_id) {
         try {
           const { data: assignedEmp } = await supabase
             .from('employees')
             .select('notes, full_name')
             .eq('id', extraFields.assigned_employee_id)
             .single();

           if (assignedEmp?.notes) {
             let empNotes: any = {};
             try {
               empNotes = typeof assignedEmp.notes === 'string'
                 ? JSON.parse(assignedEmp.notes)
                 : assignedEmp.notes;
             } catch {}

             if (empNotes.push_subscription) {
               await sendJobAssignedPush(
                 empNotes.push_subscription,
                 id,
                 `${data.address_line1}, ${data.city}`,
                 data.service_type || 'Standard Clean',
                 date,
                 time
               );
             }
           }
         } catch (pushErr) {
           console.error('Failed to send job assignment push:', pushErr);
         }
       }

      // 2. If job status progressed
      if (newStatus && newStatus !== job.status) {
         if (newStatus === 'completed') {
           // Auto-sync completed job to QuickBooks Online
           try {
             const { syncJobToQBO } = await import('@/lib/quickbooks/sync');
             await syncJobToQBO(id);
           } catch {
             // Non-blocking: fail quietly if QuickBooks is not configured
           }
         } else if (newStatus === 'cancelled') {
           // Expire pending offers if the job is cancelled
           const serviceClient = await createServiceClient();
           await serviceClient.from('job_offers').update({ status: 'expired' }).eq('job_id', id).eq('status', 'pending');
           
           if (contEmail) {
             await sendEmail({
               to: contEmail,
               subject: `Job Cancelled - ${date}`,
               react: React.createElement(EmployeeJobCancelled, { employeeName: contName, date })
             });
           }
         }
      }
    } catch (emailError) {
      console.error('Failed to send status update emails:', emailError);
    }
    // --------------------------------

    // Refresh finance PnL if status changed to something that affects financials
    if (newStatus && newStatus !== job.status) {
      if (['completed', 'reviewed', 'paid_out', 'refunded', 'cancelled'].includes(newStatus)) {
        try {
          await supabase.rpc('refresh_zone_monthly_pnl');
        } catch (pnlError) {
          console.error('Failed to refresh PnL view:', pnlError);
        }
      }
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
