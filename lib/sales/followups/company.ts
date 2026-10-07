import { FOLLOWUP_CONFIG } from './config';

/**
 * Normalizes company names into canonical grouping keys.
 * Lowercase, drop the words inc, incorporated, ltd, limited, corp, corporation, group, llc, gsc, co,
 * then drop every non-alphanumeric character.
 * Returns null for empty, whitespace, or placeholder ("Commercial Prospect").
 */
export function companyKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const raw = String(name).trim().toLowerCase();
  if (!raw) return null;

  if (FOLLOWUP_CONFIG.placeholderCompanies.includes(raw)) {
    return null;
  }

  const strippedWords = raw.replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co)\b/gi, '');
  const alphanumeric = strippedWords.replace(/[^a-z0-9]/gi, '').trim();

  if (!alphanumeric || alphanumeric === 'commercialprospect') {
    return null;
  }

  return alphanumeric;
}
