import { requireRole } from '@/lib/api-auth';
import * as Sentry from '@sentry/nextjs';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const trigger = searchParams.get('trigger');

  if (trigger === 'error') {
    throw new Error('Sentry test error — verified from /api/sentry-test');
  }

  if (trigger === 'capture') {
    const eventId = Sentry.captureException(
      new Error('Sentry test exception captured via Sentry.captureException')
    );
    return NextResponse.json({
      status: 'captured',
      eventId,
      message: 'Test exception sent to Sentry',
    });
  }

  return NextResponse.json({
    status: 'ready',
    dsnConfigured: Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN),
    environment: process.env.NODE_ENV,
    usage: 'Query ?trigger=error to throw an unhandled error, or ?trigger=capture to test Sentry.captureException',
  });
}
