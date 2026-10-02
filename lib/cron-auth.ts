import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';

/**
 * Verifies a cron request carries `Authorization: Bearer <CRON_SECRET>`.
 * Returns null when authorized, otherwise an error response. Rejects everything when
 * CRON_SECRET is not configured (otherwise "Bearer undefined" would be accepted).
 */
export function verifyCronRequest(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('CRON_SECRET is not set; rejecting cron request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const provided = Buffer.from(request.headers.get('authorization') ?? '');
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
