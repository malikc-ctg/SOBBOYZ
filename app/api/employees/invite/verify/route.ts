import { NextResponse } from 'next/server';
import { isInviteExpired } from '@/lib/employee-invites';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('id');

    if (!inviteId) {
      return NextResponse.json({ error: 'Missing invite ID' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { data: employee, error } = await supabase
      .from('employees')
      .select('id, full_name, email, phone, status, notes')
      .eq('id', inviteId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to verify invite: ${error.message}`);
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

    return NextResponse.json({ employee });

  } catch (err: any) {
    console.error('Verify invite error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
