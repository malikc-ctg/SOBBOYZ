import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api-auth';

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    // Admin-only action
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const supabase = await createServiceClient();

    // 1. Get the employee to find their profile_id
    const { data: employee, error: fetchError } = await supabase
      .from('employees')
      .select('profile_id, email')
      .eq('id', id)
      .single();

    if (fetchError || !employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // 2. Safety check: block deletion if employee has active/in-progress jobs
    const { count: activeJobCount } = await supabase
      .from('jobs')
      .select('id', { count: 'exact', head: true })
      .eq('assigned_employee_id', id)
      .in('status', ['confirmed', 'assigned', 'on_the_way', 'in_progress']);

    if (activeJobCount && activeJobCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete employee with ${activeJobCount} active job(s). Complete or reassign them first.` },
        { status: 400 }
      );
    }

    // 3. Soft delete the employee record instead of hard delete to preserve foreign key constraints
    const { error: deleteEmployeeError } = await supabase
      .from('employees')
      .update({ 
        status: 'deleted',
        email: `deleted_${Date.now()}_${employee.email}`
      })
      .eq('id', id);

    if (deleteEmployeeError) {
      throw deleteEmployeeError;
    }

    // 4. Completely delete the user from Auth (this cascades to profiles)
    // Only do this if they actually have an auth account attached
    if (employee.profile_id) {
      const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(employee.profile_id);
      if (deleteAuthError) {
        console.error('Failed to delete auth user, but employee record was removed:', deleteAuthError);
        // We still return success because the employee profile is gone
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting employee:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const body = await request.json();
    
    const supabase = await createServiceClient();

    const updatePayload: Record<string, any> = { ...body };

    // If hourly_wage is present, ensure both the column and notes JSON are kept in sync
    if (body.hourly_wage !== undefined) {
      const wage = parseFloat(body.hourly_wage);
      updatePayload.hourly_wage = isNaN(wage) ? 25.00 : Math.round(wage * 100) / 100;

      // Fetch existing notes
      const { data: emp } = await supabase
        .from('employees')
        .select('notes')
        .eq('id', id)
        .single();

      if (emp) {
        let notesObj: Record<string, any> = {};
        try {
          notesObj = typeof emp.notes === 'string' ? JSON.parse(emp.notes) : (emp.notes || {});
        } catch {}
        notesObj.hourly_wage = updatePayload.hourly_wage;
        updatePayload.notes = JSON.stringify(notesObj);
      }
    }
    
    const { data, error } = await supabase
      .from('employees')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();
      
    if (error) throw error;
    
    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error updating employee:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}

