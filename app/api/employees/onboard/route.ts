import { NextResponse } from 'next/server';
import { isInviteExpired } from '@/lib/employee-invites';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      invite_id, 
      password, 
      fullName, 
      phone, 
      hqAddress, 
      hqCoords, 
      maxRadius, 
      primaryZoneId, 
      additionalZoneIds, 
      bringsOwnSupplies, 
      hasVehicle 
    } = body;

    if (!invite_id || !password || !fullName || !phone || !primaryZoneId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // 1. Verify Invite
    const { data: employee, error: inviteError } = await supabase
      .from('employees')
      .select('*')
      .eq('id', invite_id)
      .maybeSingle();

    if (inviteError) {
      throw new Error(`Failed to verify invite: ${inviteError.message}`);
    }

    if (!employee) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    if (employee.status !== 'invited') {
      return NextResponse.json({ error: 'This invite has already been accepted or is no longer valid.' }, { status: 400 });
    }

    if (isInviteExpired(employee.notes)) {
      return NextResponse.json({ error: 'This invite has expired. Ask an admin to send a new one.' }, { status: 410 });
    }

    // 2. Create the Auth User
    let authUserId: string;
    let linkedExistingAccount = false;
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: employee.email,
      password: password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone
      }
    });

    if (authError) {
      // An account already exists for this email. Never change its password from an
      // invite link: the person must be signed in to that account to link it.
      const sessionClient = await createClient();
      const { data: { user: sessionUser } } = await sessionClient.auth.getUser();
      if (!sessionUser || sessionUser.email?.toLowerCase() !== String(employee.email).toLowerCase()) {
        return NextResponse.json(
          { error: 'An account with this email already exists. Sign in to that account first, then open your invite link again.' },
          { status: 409 }
        );
      }
      authUserId = sessionUser.id;
      linkedExistingAccount = true;
    } else {
      authUserId = authData.user.id;
    }

    // 3. Ensure Profile Exists
    // Never downgrade an elevated role (e.g. admin) through onboarding
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUserId)
      .maybeSingle();
    const keepRole = existingProfile?.role && !['customer', 'employee'].includes(existingProfile.role);

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: authUserId, 
        email: employee.email,
        role: keepRole ? existingProfile.role : 'employee', 
        full_name: fullName, 
        phone: phone 
      }, { onConflict: 'id' });

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }

    // 4. Update Employee Record
    let existingNotes: any = {};
    if (employee.notes) {
      try {
        existingNotes = typeof employee.notes === 'string' ? JSON.parse(employee.notes) : employee.notes;
      } catch {
        existingNotes = { text: employee.notes };
      }
    }
    const updatedNotes = {
        ...existingNotes,
        hq_address: hqAddress,
        hq_coords: hqCoords,
        max_radius: maxRadius
    };

    const { error: updateError } = await supabase
      .from('employees')
      .update({
        profile_id: authUserId,
        full_name: fullName,
        phone: phone,
        status: 'active',
        zone_id: primaryZoneId,
        brings_own_supplies: bringsOwnSupplies,
        has_vehicle: hasVehicle,
        notes: JSON.stringify(updatedNotes)
      })
      .eq('id', invite_id);

    if (updateError) {
      throw new Error(`Failed to link employee record: ${updateError.message}`);
    }

    // 5. Insert Additional Zones
    if (additionalZoneIds && additionalZoneIds.length > 0) {
      await supabase.from('contractor_zones').delete().eq('contractor_id', invite_id);
      const zoneInserts = additionalZoneIds.map((zId: string) => ({
        contractor_id: invite_id,
        zone_id: zId
      }));
      await supabase.from('contractor_zones').insert(zoneInserts);
    }

    return NextResponse.json({ success: true, email: employee.email, linkedExistingAccount });

  } catch (err: any) {
    console.error('Onboard error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
