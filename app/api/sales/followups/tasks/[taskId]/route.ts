import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { runEngineForTaskAction } from '@/lib/sales/followups/executor';

const TaskActionSchema = z.object({
  action: z.enum(['open', 'not_sent', 'sent', 'skip', 'done', 'reschedule', 'reassign', 'undo']),
  subject: z.string().optional(),
  body: z.string().optional(),
  to: z.string().optional(),
  result: z.string().optional(),
  note: z.string().optional(),
  dueAt: z.string().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: { taskId: string } }
) {
  try {
    const supabaseUserClient = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseUserClient.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'sign_in_required' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = TaskActionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'invalid_request', details: parsed.error.issues }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const taskId = params.taskId;
    const { action, ...payload } = parsed.data;
    const nowIso = new Date().toISOString();

    // 1. open action
    if (action === 'open') {
      await supabase
        .from('sales_followup_tasks')
        .update({ opened_at: nowIso, updated_at: nowIso })
        .eq('id', taskId);
      return NextResponse.json({ success: true });
    }

    // 2. not_sent action
    if (action === 'not_sent') {
      await supabase
        .from('sales_followup_tasks')
        .update({ opened_at: null, updated_at: nowIso })
        .eq('id', taskId);
      return NextResponse.json({ success: true });
    }

    // 3. reassign
    if (action === 'reassign') {
      await supabase
        .from('sales_followup_tasks')
        .update({ assigned_rep_id: user.id, updated_at: nowIso })
        .eq('id', taskId);
      return NextResponse.json({ success: true });
    }

    // 4. reschedule
    if (action === 'reschedule') {
      if (!payload.dueAt) {
        return NextResponse.json({ error: 'missing_due_at' }, { status: 400 });
      }
      await supabase
        .from('sales_followup_tasks')
        .update({ due_at: payload.dueAt, updated_at: nowIso })
        .eq('id', taskId);
      return NextResponse.json({ success: true });
    }

    // 5. undo
    if (action === 'undo') {
      const { data: currentTask } = await supabase
        .from('sales_followup_tasks')
        .select('*')
        .eq('id', taskId)
        .single();

      if (!currentTask || !currentTask.completed_at) {
        return NextResponse.json({ error: 'task_not_completed' }, { status: 400 });
      }

      // Check 10-second window
      const completedTime = new Date(currentTask.completed_at).getTime();
      const diffMs = Date.now() - completedTime;
      if (diffMs > 10000) {
        return NextResponse.json({ error: 'undo_expired' }, { status: 400 });
      }

      // Check if subsequent task created by this task has been opened
      const { data: createdTasks } = await supabase
        .from('sales_followup_tasks')
        .select('*')
        .eq('enrollment_id', currentTask.enrollment_id)
        .gt('created_at', currentTask.completed_at);

      if (createdTasks && createdTasks.some((t: any) => t.opened_at)) {
        return NextResponse.json({ error: 'subsequent_task_opened' }, { status: 400 });
      }

      // Delete subsequent created tasks
      if (createdTasks && createdTasks.length > 0) {
        const ids = createdTasks.map((t: any) => t.id);
        await supabase.from('sales_followup_tasks').delete().in('id', ids);
      }

      // Revert current task to pending
      await supabase
        .from('sales_followup_tasks')
        .update({
          status: 'pending',
          result: null,
          completed_at: null,
          completed_by: null,
          sent_to: null,
          rendered_subject: null,
          rendered_body: null,
          updated_at: nowIso,
        })
        .eq('id', taskId);

      // Revert enrollment to active if it was completed
      await supabase
        .from('sales_followup_enrollments')
        .update({ status: 'active', ended_at: null, end_reason: null, updated_at: nowIso })
        .eq('id', currentTask.enrollment_id)
        .eq('status', 'completed');

      return NextResponse.json({ success: true, undone: true });
    }

    // 6. sent / skip / done
    // Concurrency check: Ensure task is pending
    const updateSnapshot: any = {
      completed_at: nowIso,
      completed_by: user.id,
      updated_at: nowIso,
    };

    if (action === 'sent') {
      updateSnapshot.sent_to = payload.to || null;
      updateSnapshot.rendered_subject = payload.subject || null;
      updateSnapshot.rendered_body = payload.body || null;
    }

    // Atomic update checking status = 'pending'
    const { data: updatedTask, error: updateError } = await supabase
      .from('sales_followup_tasks')
      .update(updateSnapshot)
      .eq('id', taskId)
      .eq('status', 'pending')
      .select()
      .maybeSingle();

    if (updateError || !updatedTask) {
      // 409 already handled! (spec 5.6 and scenario 49)
      return NextResponse.json({ error: 'already_handled' }, { status: 409 });
    }

    // Now execute engine planner for next step
    const engineResult = await runEngineForTaskAction(
      taskId,
      action as 'sent' | 'skip' | 'done',
      user.id,
      payload
    );

    return NextResponse.json({
      success: true,
      result: engineResult,
    });
  } catch (err: any) {
    console.error('[API /api/sales/followups/tasks/[taskId]] POST error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
