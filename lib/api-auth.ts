import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/**
 * Verifies the request is from an authenticated user.
 * Returns the user object or a 401 NextResponse.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // authenticated user
 */
export async function requireAuth(): Promise<
  { id: string; email?: string; role?: string; full_name?: string; title?: string; [key: string]: any } | NextResponse
> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      );
    }

    // Attach role and profile info if available
    const { createServiceClient } = await import('@/lib/supabase/server');
    const serviceClient = await createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role, full_name, title')
      .eq('id', user.id)
      .maybeSingle();

    return {
      ...user,
      role: profile?.role || user.app_metadata?.role || user.user_metadata?.role || 'authenticated',
      full_name: profile?.full_name || user.user_metadata?.full_name || null,
      title: profile?.title || null,
    };
  } catch {
    return NextResponse.json(
      { error: 'Unauthorized: Authentication required' },
      { status: 401 }
    );
  }
}

/**
 * Verifies the request is from an authenticated user with a specific role.
 * Checks the `profiles` table for the role.
 */
export async function requireRole(allowedRoles: string[]): Promise<
  { id: string; email?: string; role: string; [key: string]: any } | NextResponse
> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // If already identified as an allowed role
  if (auth.role && allowedRoles.includes(auth.role)) {
    return auth as any;
  }

  try {
    const { createServiceClient } = await import('@/lib/supabase/server');
    const supabase = await createServiceClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name, title')
      .eq('id', auth.id)
      .single();

    if (!profile || !allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Forbidden: insufficient permissions' },
        { status: 403 }
      );
    }

    return { ...auth, role: profile.role, full_name: profile.full_name, title: profile.title };
  } catch {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions' },
      { status: 403 }
    );
  }
}
