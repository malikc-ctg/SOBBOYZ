import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeRedirectPath } from '@/lib/utils';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = safeRedirectPath(searchParams.get('next'), '/');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // `next` is restricted to same-origin paths, e.g. /reset-password?portal=customer
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=Invalid_or_expired_auth_link`);
}
