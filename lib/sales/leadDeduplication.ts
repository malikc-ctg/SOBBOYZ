/**
 * Lead Deduplication & Merge Engine
 *
 * Provides deterministic normalization, matching, and safe enrichment/merging
 * for B2B commercial phone leads and inbound CRM leads.
 *
 * Crucial B2B rule:
 * - Multiple different people at the same company often share a corporate HQ switchboard number.
 * - Therefore, two leads are considered the SAME CONTACT (duplicate) if:
 *   1. Exact email match (case-insensitive, non-empty, valid email)
 *   2. Same normalized 10-digit phone (+ optional extension) AND:
 *      - at least one side has a generic/placeholder contact name ('Decision Maker', 'Main Contact', etc.), OR
 *      - their normalized contact names match (or one name contains the other)
 *   3. Same normalized company name AND same normalized contact name (when name is not a generic placeholder)
 */

export const GENERIC_CONTACT_NAMES = new Set([
  '',
  'decisionmaker',
  'maincontact',
  'commercialprospect',
  'quocontact',
  'unknown',
  'contact',
  'estimator',
  'projectmanager',
  'reception',
  'frontdesk',
  'office',
]);

export const GENERIC_COMPANY_NAMES = new Set([
  '',
  'commercialprospect',
  'commercialaccount',
  'commercialclient',
  'unknown',
  'company',
  'n/a',
  'na',
  'none',
]);

/**
 * Normalizes an email address for comparison.
 */
export function normalizeEmail(email?: string | null): string {
  if (!email) return '';
  const clean = String(email).trim().toLowerCase();
  if (!clean.includes('@') || clean.startsWith('no-email-')) return '';
  return clean;
}

/**
 * Extracts normalized 10-digit North American phone number and optional extension.
 */
export function normalizePhoneAndExt(
  rawPhone?: string | null,
  rawExt?: string | null
): { phone10: string; ext: string } {
  if (!rawPhone && !rawExt) return { phone10: '', ext: '' };
  let str = String(rawPhone || '').trim();
  let ext = String(rawExt || '').replace(/[^0-9]/g, '');

  const extMatch = str.match(/\b(?:ext\.?|extension|x|#)\s*([0-9]{1,6})\b/i);
  if (extMatch) {
    if (!ext) ext = extMatch[1];
    str = str.replace(/\s*\b(?:ext\.?|extension|x|#)\s*[0-9]{1,6}\b/i, '').trim();
  }

  let digits = str.replace(/[^0-9]/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    digits = digits.slice(1);
  }
  if (digits.length < 10) {
    return { phone10: '', ext };
  }
  return { phone10: digits.slice(-10), ext };
}

/**
 * Normalizes a person's full name to lowercase alphanumeric.
 */
export function normalizePersonName(name?: string | null): string {
  if (!name) return '';
  const norm = String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
  if (GENERIC_CONTACT_NAMES.has(norm)) return '';
  return norm;
}

/**
 * Normalizes a company name by stripping legal suffixes and punctuation.
 */
export function normalizeCompanyNameKey(name?: string | null): string {
  if (!name) return '';
  const norm = String(name)
    .toLowerCase()
    .replace(/^(the|a)\s+/i, '')
    .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co|company|holdings|enterprises|construction|contracting|builders|developments|development|design|build)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const fallback = String(name)
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
  const result = norm.length >= 3 ? norm : fallback;
  if (GENERIC_COMPANY_NAMES.has(result)) return '';
  return result;
}

/**
 * Parses a lead's JSON `notes` field safely.
 */
export function parseLeadIntel(notes?: any): Record<string, any> {
  if (!notes) return {};
  if (typeof notes === 'object') return { ...notes };
  if (typeof notes === 'string') {
    const trimmed = notes.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { notes: trimmed, rep_notes: trimmed };
      }
    }
    return { notes: trimmed, rep_notes: trimmed };
  }
  return {};
}

/**
 * Extracts all normalized phones (direct, mobile, primary) associated with a lead.
 * Returns { directPhones: Set<string>, allPhones: Set<string>, ext: string }
 * Note: corporate_phone is kept separate so two colleagues sharing only a corporate switchboard
 * are not falsely flagged as the same person.
 */
export function extractLeadPhones(lead: any): {
  primaryPhone10: string;
  ext: string;
  personalPhones: string[];
  allPhones: string[];
} {
  const intel = parseLeadIntel(lead.notes);
  const explicitExt = intel.extension || intel.ext || lead.extension || '';
  const primary = normalizePhoneAndExt(lead.customer_phone || lead.phone, explicitExt);
  const workDirect = normalizePhoneAndExt(intel.work_direct_phone || lead.work_direct_phone, explicitExt);
  const mobile = normalizePhoneAndExt(intel.mobile_phone || intel.other_phone || lead.mobile_phone, '');
  const corporate = normalizePhoneAndExt(intel.corporate_phone || lead.corporate_phone, '');

  const personalSet = new Set<string>();
  if (primary.phone10 && primary.phone10 !== corporate.phone10) personalSet.add(primary.phone10);
  if (workDirect.phone10 && workDirect.phone10 !== corporate.phone10) personalSet.add(workDirect.phone10);
  if (mobile.phone10) personalSet.add(mobile.phone10);
  // If primary is the only phone on the record, include it in personalSet
  if (personalSet.size === 0 && primary.phone10) {
    personalSet.add(primary.phone10);
  }

  const allSet = new Set<string>(personalSet);
  if (corporate.phone10) allSet.add(corporate.phone10);

  return {
    primaryPhone10: primary.phone10 || workDirect.phone10 || mobile.phone10 || corporate.phone10 || '',
    ext: primary.ext || workDirect.ext || String(explicitExt || '').replace(/[^0-9]/g, ''),
    personalPhones: Array.from(personalSet),
    allPhones: Array.from(allSet),
  };
}

export interface DuplicateMatchResult {
  isDuplicate: boolean;
  reason: 'email' | 'phone' | 'company_and_name' | null;
  confidence: 'exact' | 'high' | null;
  matchedValue?: string;
}

/**
 * Checks whether two lead objects represent the same contact/lead.
 */
export function compareLeadsForDuplicate(leadA: any, leadB: any): DuplicateMatchResult {
  // 1. Exact Email Match
  const emailA = normalizeEmail(leadA.customer_email || leadA.email);
  const emailB = normalizeEmail(leadB.customer_email || leadB.email);
  if (emailA && emailB && emailA === emailB) {
    return {
      isDuplicate: true,
      reason: 'email',
      confidence: 'exact',
      matchedValue: emailA,
    };
  }

  const nameA = normalizePersonName(leadA.customer_name || leadA.name);
  const nameB = normalizePersonName(leadB.customer_name || leadB.name);
  const compA = normalizeCompanyNameKey(leadA.company_name || leadA.company);
  const compB = normalizeCompanyNameKey(leadB.company_name || leadB.company);

  const namesMatch =
    Boolean(nameA && nameB) &&
    (nameA === nameB || (nameA.length >= 5 && nameB.length >= 5 && (nameA.includes(nameB) || nameB.includes(nameA))));
  const oneNameGeneric = !nameA || !nameB;

  // 2. Same Company + Same Person Name
  if (compA && compB && compA === compB && namesMatch) {
    return {
      isDuplicate: true,
      reason: 'company_and_name',
      confidence: 'exact',
      matchedValue: `${leadA.customer_name || leadA.name} @ ${leadA.company_name || leadA.company}`,
    };
  }

  // 3. Phone Number Match
  const phonesA = extractLeadPhones(leadA);
  const phonesB = extractLeadPhones(leadB);

  const sharedPersonalPhone = phonesA.personalPhones.find((p) => phonesB.personalPhones.includes(p));
  if (sharedPersonalPhone) {
    // If both have extensions and the extensions differ, they are different extensions on the same switchboard
    if (phonesA.ext && phonesB.ext && phonesA.ext !== phonesB.ext && !namesMatch) {
      return { isDuplicate: false, reason: null, confidence: null };
    }

    // If both have distinct, non-generic person names (e.g. two different PMs sharing an office line),
    // only treat as duplicate if their names match or one has no specific name
    if (namesMatch || oneNameGeneric) {
      return {
        isDuplicate: true,
        reason: 'phone',
        confidence: namesMatch ? 'exact' : 'high',
        matchedValue: sharedPersonalPhone,
      };
    }
  }

  return { isDuplicate: false, reason: null, confidence: null };
}

/**
 * Pipeline status priority so merging never downgrades a lead's progress.
 */
const STATUS_PRIORITY: Record<string, number> = {
  new: 1,
  no_answer: 2,
  voicemail: 3,
  contacted: 4,
  info_sent: 5,
  walkthrough_booked: 6,
  quoted: 7,
  vendor_list: 8,
  won: 9,
  converted: 10,
  lost: 0,
};

/**
 * Scores a lead's completeness & pipeline maturity to pick the best primary record in a duplicate cluster.
 */
export function scoreLeadCompleteness(lead: any): number {
  let score = 0;
  const statusRank = STATUS_PRIORITY[lead.status || 'new'] ?? 1;
  score += statusRank * 20;

  if (lead.converted_job_id) score += 200;
  if (normalizeEmail(lead.customer_email || lead.email)) score += 15;
  if (normalizePersonName(lead.customer_name || lead.name)) score += 15;
  if (normalizeCompanyNameKey(lead.company_name || lead.company)) score += 10;
  if (lead.contact_title || lead.position) score += 10;
  if (lead.customer_phone || lead.phone) score += 10;

  const intel = parseLeadIntel(lead.notes);
  if (intel.mobile_phone) score += 8;
  if (intel.work_direct_phone) score += 8;
  if (intel.extension || intel.ext) score += 5;
  if (intel.linkedin) score += 4;
  if (intel.website) score += 4;
  if (intel.ai_recon) score += 10;
  if (intel.notes && String(intel.notes).trim().length > 0) score += 10;

  return score;
}

/**
 * Merges fields from `incoming` lead into `existing` lead without losing data.
 * Returns the update payload ready for `supabase.from('leads').update(payload).eq('id', existing.id)`.
 */
export function buildMergedLeadUpdate(existing: any, incoming: any): Record<string, any> {
  const existingIntel = parseLeadIntel(existing.notes);
  const incomingIntel = parseLeadIntel(incoming.notes);

  const mergedIntel: Record<string, any> = { ...existingIntel };
  for (const [k, v] of Object.entries(incomingIntel)) {
    if (v !== undefined && v !== null && v !== '') {
      if (!mergedIntel[k] || mergedIntel[k] === '') {
        mergedIntel[k] = v;
      } else if ((k === 'notes' || k === 'rep_notes') && typeof v === 'string' && typeof mergedIntel[k] === 'string') {
        const cleanExisting = mergedIntel[k].trim();
        const cleanIncoming = v.trim();
        if (cleanIncoming && !cleanExisting.includes(cleanIncoming)) {
          mergedIntel[k] = cleanExisting ? `${cleanExisting}\n${cleanIncoming}` : cleanIncoming;
        }
      }
    }
  }

  const existingNameNorm = normalizePersonName(existing.customer_name);
  const incomingNameNorm = normalizePersonName(incoming.customer_name || incoming.name);
  const bestName =
    existingNameNorm
      ? existing.customer_name
      : incomingNameNorm
      ? (incoming.customer_name || incoming.name)
      : existing.customer_name || incoming.customer_name || incoming.name || 'Decision Maker';

  const existingCompNorm = normalizeCompanyNameKey(existing.company_name);
  const incomingCompNorm = normalizeCompanyNameKey(incoming.company_name || incoming.company);
  const bestCompany =
    existingCompNorm
      ? existing.company_name
      : incomingCompNorm
      ? (incoming.company_name || incoming.company)
      : existing.company_name || incoming.company_name || incoming.company || 'Commercial Prospect';

  const bestTitle = existing.contact_title || incoming.contact_title || incoming.position || null;
  const bestEmail =
    normalizeEmail(existing.customer_email)
      ? existing.customer_email
      : (incoming.customer_email || incoming.email || existing.customer_email || null);

  // Prefer phone with extension or non-empty phone
  let bestPhone = existing.customer_phone || '';
  const incPhone = incoming.customer_phone || incoming.phone || '';
  if (!bestPhone && incPhone) {
    bestPhone = incPhone;
  } else if (bestPhone && incPhone && !bestPhone.toLowerCase().includes('ext') && incPhone.toLowerCase().includes('ext')) {
    bestPhone = incPhone;
  }

  const existingRank = STATUS_PRIORITY[existing.status || 'new'] ?? 1;
  const incomingRank = STATUS_PRIORITY[incoming.status || 'new'] ?? 1;
  const bestStatus = incomingRank > existingRank ? incoming.status : existing.status;

  const bestPrice =
    existing.quoted_price && Number(existing.quoted_price) !== 2500 && Number(existing.quoted_price) !== 950
      ? existing.quoted_price
      : incoming.quoted_price || existing.quoted_price;

  return {
    customer_name: bestName,
    company_name: bestCompany,
    contact_title: bestTitle,
    customer_phone: bestPhone,
    customer_email: bestEmail,
    city: existing.city && existing.city !== 'GTA' ? existing.city : (incoming.city || existing.city || 'GTA'),
    status: bestStatus || 'new',
    quoted_price: bestPrice,
    notes: JSON.stringify(mergedIntel),
    updated_at: new Date().toISOString(),
  };
}

export interface DuplicateGroup {
  key: string;
  reason: 'email' | 'phone' | 'company_and_name';
  matchedValue: string;
  primaryLead: any;
  duplicateLeads: any[];
  allLeads: any[];
}

/**
 * Scans a list of leads and groups any duplicates into clusters,
 * automatically selecting the highest-completeness lead as `primaryLead`.
 */
export function findDuplicateGroups(leads: any[]): DuplicateGroup[] {
  const n = leads.length;
  if (n < 2) return [];

  // Index leads by email, company+name, and phone10 to avoid O(N^2) full scan
  const byEmail = new Map<string, number[]>();
  const byCompName = new Map<string, number[]>();
  const byPhone = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const l = leads[i];
    const em = normalizeEmail(l.customer_email || l.email);
    if (em) {
      const list = byEmail.get(em) || [];
      list.push(i);
      byEmail.set(em, list);
    }

    const name = normalizePersonName(l.customer_name || l.name);
    const comp = normalizeCompanyNameKey(l.company_name || l.company);
    if (comp && name) {
      const ck = `${comp}::${name}`;
      const list = byCompName.get(ck) || [];
      list.push(i);
      byCompName.set(ck, list);
    }

    const phones = extractLeadPhones(l);
    for (const p of phones.personalPhones) {
      const list = byPhone.get(p) || [];
      list.push(i);
      byPhone.set(p, list);
    }
  }

  // Union-Find to group connected duplicate leads
  const parent = Array.from({ length: n }, (_, i) => i);
  const groupReason = new Map<number, { reason: 'email' | 'phone' | 'company_and_name'; matchedValue: string }>();

  function find(i: number): number {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  }

  function union(
    i: number,
    j: number,
    reason: 'email' | 'phone' | 'company_and_name',
    matchedValue: string
  ) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) {
      parent[rootJ] = rootI;
      if (!groupReason.has(rootI)) {
        groupReason.set(rootI, { reason, matchedValue });
      }
    } else if (!groupReason.has(rootI)) {
      groupReason.set(rootI, { reason, matchedValue });
    }
  }

  // 1. Union by exact email
  for (const [em, indices] of Array.from(byEmail.entries())) {
    if (indices.length > 1) {
      for (let k = 1; k < indices.length; k++) {
        union(indices[0], indices[k], 'email', em);
      }
    }
  }

  // 2. Union by exact company + person name
  for (const [, indices] of Array.from(byCompName.entries())) {
    if (indices.length > 1) {
      const first = leads[indices[0]];
      const label = `${first.customer_name || first.name} @ ${first.company_name || first.company}`;
      for (let k = 1; k < indices.length; k++) {
        union(indices[0], indices[k], 'company_and_name', label);
      }
    }
  }

  // 3. Union by personal phone (verifying with compareLeadsForDuplicate so colleagues on a shared line aren't merged)
  for (const [phone, indices] of Array.from(byPhone.entries())) {
    if (indices.length > 1 && indices.length <= 25) {
      for (let a = 0; a < indices.length; a++) {
        for (let b = a + 1; b < indices.length; b++) {
          const cmp = compareLeadsForDuplicate(leads[indices[a]], leads[indices[b]]);
          if (cmp.isDuplicate) {
            union(indices[a], indices[b], cmp.reason || 'phone', cmp.matchedValue || phone);
          }
        }
      }
    }
  }

  // Collect clusters with >= 2 leads
  const clusters = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = clusters.get(root) || [];
    list.push(i);
    clusters.set(root, list);
  }

  const results: DuplicateGroup[] = [];
  for (const [root, indices] of Array.from(clusters.entries())) {
    if (indices.length < 2) continue;

    const clusterLeads = indices.map((idx) => leads[idx]);
    // Sort so the highest completeness score (and older created_at as tiebreaker) is primary
    clusterLeads.sort((a, b) => {
      const scoreDiff = scoreLeadCompleteness(b) - scoreLeadCompleteness(a);
      if (scoreDiff !== 0) return scoreDiff;
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    const info = groupReason.get(root) || { reason: 'phone', matchedValue: '' };
    const primary = clusterLeads[0];
    const duplicates = clusterLeads.slice(1);

    results.push({
      key: `dup_${primary.id}`,
      reason: info.reason,
      matchedValue: info.matchedValue,
      primaryLead: primary,
      duplicateLeads: duplicates,
      allLeads: clusterLeads,
    });
  }

  return results;
}
