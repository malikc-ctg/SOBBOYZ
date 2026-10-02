import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function DELETE(
  request: NextRequest,
  props: { params: Promise<{ id: string; memberId: string }> }
) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    const { error } = await supabase
      .from('employee_team_members')
      .delete()
      .eq('team_id', params.id)
      .eq('id', params.memberId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
