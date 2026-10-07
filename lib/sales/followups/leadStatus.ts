/**
 * Shared lead status rule (spec 0.1). Pure functions, safe on client and server.
 */

export type CanonicalStatus =
  | 'new'
  | 'no_answer'
  | 'contacted'
  | 'walkthrough_booked'
  | 'quoted'
  | 'won'
  | 'lost';

const RANK: Record<string, number> = {
  new: 0,
  no_answer: 1,
  contacted: 2,
  walkthrough_booked: 3,
  quoted: 4,
  won: 5,
};

/**
 * For ranking only. Never use this to rewrite stored values.
 */
export function normalizeStatus(s: string | null | undefined): string {
  const v = String(s ?? '').trim().toLowerCase();
  if (!v) return 'new';
  if (v === 'voicemail' || v === 'no_answers' || v === 'unreachable') return 'no_answer';
  if (v === 'convo') return 'contacted';
  if (v === 'info_sent') return 'quoted';
  if (v === 'job_won') return 'won';
  return v;
}

/** Rank of a status. `lost` and unknown statuses have no rank (null). */
export function statusRank(s: string | null | undefined): number | null {
  const n = normalizeStatus(s);
  return Object.prototype.hasOwnProperty.call(RANK, n) ? RANK[n] : null;
}

/**
 * Returns the new status, or null for "no change".
 */
export function nextLeadStatus(
  current: string | null | undefined,
  outcome: string | null | undefined,
  explicit?: string | null
): string | null {
  if (explicit) return explicit;

  const cur = normalizeStatus(current);
  if (cur === 'won') return null; // Won is sticky; only a drag changes it.

  const rank = statusRank(cur);
  const o = String(outcome ?? '').toUpperCase();

  switch (o) {
    case 'NO_ANSWER':
    case 'VOICEMAIL':
    case 'BAD_NUMBER':
      return rank !== null && rank <= 1 ? 'no_answer' : null;
    case 'CONVO':
    case 'GATEKEEPER':
      return cur === 'lost' || (rank !== null && rank < 2) ? 'convo' : null;
    case 'CALLBACK':
      return cur === 'lost' || (rank !== null && rank < 2) ? 'contacted' : null;
    case 'INFO_SENT':
    case 'SEND_QUOTE':
      return cur === 'walkthrough_booked' ? null : 'quoted';
    case 'WALKTHROUGH':
      return 'walkthrough_booked';
    case 'JOB_WON':
    case 'SALE':
      return 'won';
    case 'NOT_INTERESTED':
      return 'lost';
    default:
      // OUT_OF_SERVICE, STATUS_MOVE without explicit, SMS_*, unknown
      return null;
  }
}
