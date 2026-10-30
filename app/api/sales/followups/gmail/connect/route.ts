import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getGmailOAuthUrl, getAllRepsGmailStatus } from '@/lib/sales/followups/gmailAgent';

export async function GET(request: NextRequest) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const statusOnly = searchParams.get('status');

    if (statusOnly) {
      const reps = await getAllRepsGmailStatus();
      return NextResponse.json({
        success: true,
        oauthConfigured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        reps,
      });
    }

    const supabaseUserClient = await createClient();
    const {
      data: { user },
    } = await supabaseUserClient.auth.getUser();

    const repParam = searchParams.get('rep') || user?.id || 'malik';
    const redirectUri = `${origin}/api/sales/followups/gmail/callback`;
    const authUrl = getGmailOAuthUrl(repParam, redirectUri);

    return NextResponse.redirect(authUrl);
  } catch (err: any) {
    console.error('[API /api/sales/followups/gmail/connect] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
