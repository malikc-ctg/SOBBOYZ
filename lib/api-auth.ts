import { createClient, createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export type AuthUser = { id: string; email?: string; role?: string; [key: string]: any };

/**
 * Verifies the request is from an authenticated user.
 * Returns the user object (with `role` set to the app role from `profiles`)
 * or a 401 NextResponse.
 *
 * Usage:
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *   const user = auth; // authenticated user
 */
export async function requireAuth(): Promise<AuthUser | NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Supabase's `user.role` is the Postgres role ("authenticated"), not the app role.
    // Replace it with the role stored in `profiles` so callers can rely on it.
    const serviceClient = await createServiceClient();
    const { data: profile } = await serviceClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    return { ...user, role: profile?.role ?? undefined };
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

/**
 * Verifies the request is from an authenticated user with one of the given app roles
 * (from the `profiles` table).
 */
export async function requireRole(allowedRoles: string[]): Promise<
  AuthUser & { role: string } | NextResponse
> {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  if (!auth.role || !allowedRoles.includes(auth.role)) {
    return NextResponse.json(
      { error: 'Forbidden: insufficient permissions' },
      { status: 403 }
    );
  }

  return auth as AuthUser & { role: string };
}
