import { requireRole } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { disconnectQuickBooks } from '@/lib/quickbooks/client';

export async function POST() {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await disconnectQuickBooks();
    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
