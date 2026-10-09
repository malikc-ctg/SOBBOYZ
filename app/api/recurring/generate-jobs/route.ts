import { NextRequest, NextResponse } from 'next/server';
import { materializeRecurringJobs } from '@/lib/recurring-runner';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const lookaheadDays = Number(body.lookahead_days) || 14;
    const backfillFromStart = Boolean(body.backfill_from_start);
    const bookingId = body.booking_id ? String(body.booking_id) : undefined;

    const result = await materializeRecurringJobs({
      bookingId,
      lookaheadDays,
      backfillFromStart,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.errors.join(', ') || 'Failed to generate recurring jobs' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: result.newJobsCreated,
      linked: result.existingJobsLinked,
      total_evaluated: result.totalEvaluated,
      jobs: result.jobs,
    });
  } catch (err: unknown) {
    console.error('POST /api/recurring/generate-jobs error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
