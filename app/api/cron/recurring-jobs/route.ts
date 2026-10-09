import { NextRequest, NextResponse } from 'next/server';
import { materializeRecurringJobs } from '@/lib/recurring-runner';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow call if CRON_SECRET matches, or in development if not configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await materializeRecurringJobs({ lookaheadDays: 14 });
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      contracts_evaluated: result.totalEvaluated,
      new_jobs_created: result.newJobsCreated,
      existing_jobs_linked: result.existingJobsLinked,
      errors: result.errors,
    });
  } catch (err: unknown) {
    console.error('GET /api/cron/recurring-jobs error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
