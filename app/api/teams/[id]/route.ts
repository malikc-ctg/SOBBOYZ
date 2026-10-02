import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const { name, lead_employee_id, zone_id, max_jobs_per_day, payout_split, notes, status } = body;

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (lead_employee_id !== undefined) updateData.lead_employee_id = lead_employee_id;
    if (zone_id !== undefined) updateData.zone_id = zone_id;
    if (max_jobs_per_day !== undefined) updateData.max_jobs_per_day = max_jobs_per_day;
    if (payout_split !== undefined) updateData.payout_split = payout_split;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;

    const { data, error } = await supabase
      .from('employee_teams')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // If lead changed, ensure the lead is present in team_members with role 'lead'
    if (lead_employee_id) {
      await supabase
        .from('employee_team_members')
        .update({ role: 'member' })
        .eq('team_id', params.id)
        .eq('role', 'lead');

      const { data: existing } = await supabase
        .from('employee_team_members')
        .select('id')
        .eq('team_id', params.id)
        .eq('employee_id', lead_employee_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('employee_team_members')
          .update({ role: 'lead' })
          .eq('id', existing.id);
      } else {
        await supabase.from('employee_team_members').insert({
          team_id: params.id,
          employee_id: lead_employee_id,
          role: 'lead',
        });
      }
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    // Delete members first
    await supabase.from('employee_team_members').delete().eq('team_id', params.id);

    // Delete team
    const { error } = await supabase.from('employee_teams').delete().eq('id', params.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
