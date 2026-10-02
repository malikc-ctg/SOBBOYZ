/** Invite links expire this long after the invite was (re)sent. */
export const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Returns true if the invite stamped in the employee's `notes.invited_at` is older than
 * INVITE_TTL_MS. Invites sent before this stamp existed carry no `invited_at` and are
 * treated as not expired.
 */
export function isInviteExpired(notes: unknown, now: number = Date.now()): boolean {
  let parsed: any = notes;
  if (typeof notes === 'string') {
    try {
      parsed = JSON.parse(notes);
    } catch {
      return false;
    }
  }
  const invitedAt = parsed && typeof parsed === 'object' ? parsed.invited_at : undefined;
  if (!invitedAt) return false;
  const time = new Date(invitedAt).getTime();
  if (Number.isNaN(time)) return false;
  return now - time > INVITE_TTL_MS;
}
