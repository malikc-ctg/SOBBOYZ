import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens } from '@/lib/quickbooks/client';

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const realmId = searchParams.get('realmId');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  const redirectBase = new URL('/sobadmin/settings', request.url);
  redirectBase.searchParams.set('tab', 'quickbooks');

  // Verify CSRF state
  const storedState = request.cookies.get('qbo_oauth_state')?.value;
  if (!state || !storedState || state !== storedState) {
    redirectBase.searchParams.set('error', 'invalid_csrf_state');
    const res = NextResponse.redirect(redirectBase);
    res.cookies.delete('qbo_oauth_state');
    return res;
  }

  if (error) {
    redirectBase.searchParams.set('error', errorDescription || error);
    const res = NextResponse.redirect(redirectBase);
    res.cookies.delete('qbo_oauth_state');
    return res;
  }

  if (!code || !realmId) {
    redirectBase.searchParams.set('error', 'missing_code_or_realm_id');
    const res = NextResponse.redirect(redirectBase);
    res.cookies.delete('qbo_oauth_state');
    return res;
  }

  // Exchange code for tokens and store in Supabase
  const result = await exchangeCodeForTokens(code, realmId);

  if (!result.success) {
    redirectBase.searchParams.set('error', result.error || 'token_exchange_failed');
  } else {
    redirectBase.searchParams.set('status', 'connected');
    if (result.companyName) {
      redirectBase.searchParams.set('company', result.companyName);
    }
  }

  const response = NextResponse.redirect(redirectBase);
  response.cookies.delete('qbo_oauth_state');
  return response;
}
