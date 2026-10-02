import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl, hasQuickBooksCredentials } from '@/lib/quickbooks/client';

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    if (!hasQuickBooksCredentials()) {
      return NextResponse.redirect(
        new URL('/sobadmin/settings?tab=quickbooks&error=missing_credentials', request.url)
      );
    }

    // Generate secure CSRF state
    const state = crypto.randomUUID();
    const authUrl = getAuthorizationUrl(state);

    const response = NextResponse.redirect(authUrl);

    // Save CSRF state in secure cookie for validation in callback
    response.cookies.set('qbo_oauth_state', state, {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });

    return response;
  } catch (err) {
    return NextResponse.redirect(
      new URL(`/sobadmin/settings?tab=quickbooks&error=${encodeURIComponent((err as Error).message)}`, request.url)
    );
  }
}
