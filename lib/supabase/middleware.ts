import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Middleware: Missing Supabase environment variables');
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh the session — this is critical for keeping cookies in sync
  // between the browser and the server.
  const { data: { user } } = await supabase.auth.getUser();

  // Protect admin routes: redirect unauthenticated users to admin login
  const pathname = request.nextUrl.pathname;
  
  const isAdminRoute = pathname.startsWith('/sobadmin');
  const isAdminLogin = pathname === '/sobadmin/login';
  const isAdminApi = pathname.startsWith('/api/sobadmin');

  const isEmployeeRoute = pathname.startsWith('/employee');
  const isEmployeeLogin = pathname === '/employee/login';
  const isEmployeeOnboarding = pathname === '/employee/onboarding';

  const isPartnerRoute = pathname.startsWith('/partner');
  const isPartnerLogin = pathname === '/partner/login'; // assuming this exists or will exist

  // Protect admin & sales routes: redirect unauthenticated users to admin login
  if ((isAdminRoute || pathname === '/sales') && !isAdminLogin && !isAdminApi && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/sobadmin/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isEmployeeRoute && !isEmployeeLogin && !isEmployeeOnboarding && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/employee/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPartnerRoute && !isPartnerLogin && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/partner/login';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
