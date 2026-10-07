import { TZDate } from '@date-fns/tz';

export const TORONTO_TZ = 'America/Toronto';

/**
 * Parses a timestamp into a real instant.
 * - Strings with a zone designator (Z or +hh:mm) are parsed as-is.
 * - Zoneless strings ("YYYY-MM-DD HH:MM" or "YYYY-MM-DDTHH:MM") are Toronto local time.
 * - A bare date ("YYYY-MM-DD") is Toronto local 9:00 AM.
 * Returns null when it cannot be parsed.
 */
export function parseTorontoLocal(input: string | Date | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  const s = String(input).trim();
  if (!s) return null;
  if (/(Z|[+-]\d{2}:?\d{2})$/i.test(s) && /T|\s/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const [, y, mo, d, h = '9', mi = '0', sec = '0'] = m;
  const z = new TZDate(+y, +mo - 1, +d, +h, +mi, +sec, 0, TORONTO_TZ);
  return Number.isNaN(z.getTime()) ? null : new Date(z.getTime());
}
