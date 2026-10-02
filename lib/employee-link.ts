import type { SupabaseClient } from '@supabase/supabase-js';

/** Escapes LIKE/ILIKE wildcards so an email is matched literally (case-insensitively). */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (c) => '\\' + c);
}

/**
 * Links an invited employee record to a signed-in user by email, and returns its id.
 *
 * Only links when the user's email is verified and the employee record is not already
 * linked to another account; otherwise returns null.
 */
export async function linkEmployeeByVerifiedEmail(
  serviceClient: SupabaseClient,
  user: { id: string; email?: string | null; email_confirmed_at?: string | null }
): Promise<string | null> {
  if (!user.email || !user.email_confirmed_at) return null;

  const { data: employee } = await serviceClient
    .from('employees')
    .select('id')
    .ilike('email', escapeLikePattern(user.email))
    .is('profile_id', null)
    .maybeSingle();

  if (!employee) return null;

  const { data: linked } = await serviceClient
    .from('employees')
    .update({ profile_id: user.id })
    .eq('id', employee.id)
    .is('profile_id', null)
    .select('id')
    .maybeSingle();

  return linked?.id ?? null;
}
