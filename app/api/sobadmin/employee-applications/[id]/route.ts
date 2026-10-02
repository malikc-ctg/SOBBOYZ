import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api-auth';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    const { data, error } = await supabase
      .from('contractor_applications')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) {
      console.error('Error fetching employee application:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in employee application route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const supabase = await createServiceClient();

    // We use the service client for updates, so it bypasses RLS in edge cases,
    // though the caller (admin) should technically have access anyway.
    
    // Only allow updating status and internal_notes
    const updateData: any = {};
    if (body.status) updateData.status = body.status;
    if (body.internal_notes !== undefined) updateData.internal_notes = body.internal_notes;
    
    // Note: moddatetime is missing, so we'll just manually set updated_at
    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('contractor_applications')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating employee application:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in employee application patch route:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
