import { NextRequest, NextResponse } from 'next/server';
import { exchangeGmailCodeAndSave } from '@/lib/sales/followups/gmailAgent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state') || '';
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(`${origin}/sales?gmail_error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return NextResponse.redirect(`${origin}/sales?gmail_error=missing_code`);
    }

    const redirectUri = `${origin}/api/sales/followups/gmail/callback`;
    const stored = await exchangeGmailCodeAndSave(code, state, redirectUri);

    return NextResponse.redirect(
      `${origin}/sales?gmail_connected=${encodeURIComponent(stored.gmail_address)}&rep=${encodeURIComponent(stored.rep_key)}`
    );
  } catch (err: any) {
    console.error('[API /api/sales/followups/gmail/callback] Error:', err);
    const { origin } = new URL(request.url);
    return NextResponse.redirect(
      `${origin}/sales?gmail_error=${encodeURIComponent(err.message || 'oauth_failed')}`
    );
  }
}
