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
  
  const isAdminRoute = pathname === '/sobadmin' || pathname.startsWith('/sobadmin/');
  const isAdminPublic = pathname === '/sobadmin/login' || pathname === '/sobadmin/forgot-password';

  const isEmployeeRoute = pathname === '/employee' || pathname.startsWith('/employee/');
  const isEmployeePublic =
    pathname === '/employee/login' ||
    pathname === '/employee/forgot-password' ||
    pathname === '/employee/onboarding';

  const isPartnerRoute = pathname === '/partner' || pathname.startsWith('/partner/');
  const isPartnerLogin = pathname === '/partner/login';

  const redirectToLogin = (loginPath: string) => {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = loginPath;
    loginUrl.search = '';
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  };

  if (isAdminRoute && !isAdminPublic) {
    if (!user) return redirectToLogin('/sobadmin/login');

    // Admin console requires the admin app role (readable via the profiles_own RLS policy)
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (profile?.role !== 'admin') return redirectToLogin('/sobadmin/login');
  }

  if (isEmployeeRoute && !isEmployeePublic && !user) {
    return redirectToLogin('/employee/login');
  }

  if (isPartnerRoute && !isPartnerLogin && !user) {
    return redirectToLogin('/partner/login');
  }

  return supabaseResponse;
}
