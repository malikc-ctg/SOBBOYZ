import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api-auth';
import { sendEmail } from '@/lib/resend';
import EmployeeInvite from '@/emails/employee/EmployeeInvite';
import React from 'react';

export async function POST(request: Request) {
  // Admin-only action
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {

    const body = await request.json();
    const { full_name, email, phone, zone_id, tier, payout_rate, hourly_wage, brings_own_supplies, has_vehicle, max_jobs_per_day } = body;

    if (!email || !full_name || !phone) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // Check if an employee record already exists with this email
    const { data: existingEmployee } = await supabase
      .from('employees')
      .select('id, status, notes')
      .eq('email', email)
      .maybeSingle();

    let employeeId = existingEmployee?.id;

    // Create or update employee metadata with hourly_wage
    const wageNum = parseFloat(hourly_wage) || 25.00;
    let existingNotes: Record<string, any> = {};
    if (existingEmployee?.notes) {
      try {
        existingNotes = typeof existingEmployee.notes === 'string' 
          ? JSON.parse(existingEmployee.notes) 
          : existingEmployee.notes;
        if (typeof existingNotes !== 'object' || existingNotes === null) {
          existingNotes = { text: String(existingEmployee.notes) };
        }
      } catch {
        existingNotes = { text: existingEmployee.notes };
      }
    }
    const updatedNotes = JSON.stringify({
      ...existingNotes,
      hourly_wage: wageNum,
      invited_at: new Date().toISOString(),
    });

    if (existingEmployee) {
      // Re-invite or update the employee record
      const { error: updateError } = await supabase
        .from('employees')
        .update({
          full_name,
          phone,
          zone_id: zone_id || null,
          tier: tier || 'basic',
          payout_rate: parseFloat(payout_rate) || 0.7,
          brings_own_supplies: !!brings_own_supplies,
          has_vehicle: !!has_vehicle,
          max_jobs_per_day: parseInt(max_jobs_per_day) || 2,
          notes: updatedNotes,
        })
        .eq('id', employeeId);
        
      if (updateError) throw new Error(`Failed to update employee record: ${updateError.message}`);
    } else {
      // Create new employee invite
      const { data: newEmployee, error: insertError } = await supabase
        .from('employees')
        .insert({
          profile_id: null,
          full_name,
          email,
          phone,
          zone_id: zone_id || null,
          status: 'invited',
          tier: tier || 'basic',
          payout_rate: parseFloat(payout_rate) || 0.7,
          brings_own_supplies: !!brings_own_supplies,
          has_vehicle: !!has_vehicle,
          max_jobs_per_day: parseInt(max_jobs_per_day) || 2,
          notes: updatedNotes,
        })
        .select('id')
        .single();

      if (insertError) throw new Error(`Failed to create employee record: ${insertError.message}`);
      employeeId = newEmployee.id;
    }

    // 4. Generate the invite link
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const actionLink = `${appUrl}/employee/onboarding?invite_id=${employeeId}`;

    // 5. Send Email via React Email
    const { success, error: emailError } = await sendEmail({
      to: email,
      subject: 'You have been invited to Sea of Blue',
      react: React.createElement(EmployeeInvite, { fullName: full_name, inviteLink: actionLink })
    });

    if (!success) {
      throw new Error(`Failed to send email: ${(emailError as any)?.message || 'Unknown error'}`);
    }

    return NextResponse.json({ success: true, inviteId: employeeId });

  } catch (err: any) {
    console.error('Invite error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
