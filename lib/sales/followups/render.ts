import { FOLLOWUP_CONFIG, resolveRepConfig } from './config';
import { TEMPLATES, TemplateContext } from './templates';
import {
  toTorontoDate,
  formatTorontoDay,
  formatTorontoTime,
  formatWhenFuture,
  formatWhenPast,
  isSameTorontoDate,
  formatPastDaySimple,
} from './schedule';

/**
 * Extracts and normalizes the first name from a customer name.
 * Returns null if unusable or placeholder.
 */
export function parseFirstName(name: string | null | undefined): string | null {
  if (!name) return null;
  let clean = String(name).trim();
  if (!clean) return null;

  // Remove honorifics
  clean = clean.replace(/^(mr|mrs|ms|miss|dr)\.?\s+/i, '').trim();
  if (!clean) return null;

  const fullLower = clean.toLowerCase();
  if (
    FOLLOWUP_CONFIG.placeholderNames.some(
      (p) => fullLower === p || fullLower.startsWith(p) || p.startsWith(fullLower)
    )
  ) {
    return null;
  }

  const firstToken = clean.split(/[\s,]+/)[0];
  if (!firstToken || firstToken.length < 2) return null;

  // Must not contain digits or @
  if (/[0-9@]/.test(firstToken)) return null;

  const lower = firstToken.toLowerCase();
  if (FOLLOWUP_CONFIG.placeholderNames.includes(lower)) {
    return null;
  }

  // If all upper or all lower, title-case (support hyphenated like Mary-Anne)
  if (firstToken === firstToken.toUpperCase() || firstToken === firstToken.toLowerCase()) {
    return lower
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join('-');
  }

  return firstToken;
}

/**
 * Cleans text for insertion into sentences (collapses newlines, trims trailing punctuation).
 */
export function cleanSnippet(text: string | null | undefined, maxLen: number): string {
  if (!text) return '';
  let s = String(text).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  s = s.replace(/[.!?;,]+$/, '').trim();
  if (s.length > maxLen) {
    s = s.slice(0, maxLen).trim().replace(/[.!?;,]+$/, '');
  }
  return s;
}

/**
 * Checks if a site address is usable (not empty and doesn't match modal default /job site$/i).
 */
export function isUsableSiteAddress(address: string | null | undefined): boolean {
  if (!address) return false;
  const s = String(address).trim();
  if (!s) return false;
  if (/job site$/i.test(s)) return false;
  return true;
}

export interface RenderInput {
  templateKey: string;
  lead: {
    customer_name?: string | null;
    company_name?: string | null;
    city?: string | null;
    sector?: string | null;
  };
  rep: {
    signature_name?: string | null;
    signature_title?: string | null;
    signature_phone?: string | null;
  };
  context?: Record<string, any>;
  now?: Date;
  anchorAt?: Date | string;
  mailingAddressOverride?: string;
}

export interface RenderResult {
  subject: string;
  body: string;
}

/**
 * Renders an email given a template and context, validates output and returns { subject, body }.
 */
export function renderEmail(input: RenderInput): RenderResult {
  const templateFn = TEMPLATES[input.templateKey];
  if (!templateFn) {
    throw new Error(`Unknown email template: ${input.templateKey}`);
  }

  const now = input.now || new Date();
  const ctx = input.context || {};
  const anchorDate = input.anchorAt ? new Date(input.anchorAt) : now;

  const firstName = parseFirstName(input.lead.customer_name);
  const repConfig = resolveRepConfig(input.rep.signature_name || (input.rep as any)?.rep_id);
  const repName = input.rep.signature_name || repConfig.name;
  const repTitle =
    input.rep.signature_title !== undefined && input.rep.signature_title !== null
      ? String(input.rep.signature_title).trim()
      : repConfig.title;
  const repPhone = input.rep.signature_phone || repConfig.phone;
  const mailingAddress =
    input.mailingAddressOverride !== undefined
      ? input.mailingAddressOverride
      : FOLLOWUP_CONFIG.company.mailingAddress;

  // Site address checking
  const rawSiteAddress = ctx.siteAddress || ctx.site_address;
  const hasUsableAddress = isUsableSiteAddress(rawSiteAddress);
  const siteAddress = hasUsableAddress ? String(rawSiteAddress).trim() : '';

  // Site contact sentence
  let siteContactSentence = '';
  const siteContactName = ctx.siteContactName || ctx.site_contact_name;
  if (siteContactName && String(siteContactName).trim()) {
    const contactClean = String(siteContactName).trim();
    const leadNameClean = String(input.lead.customer_name || '').trim();
    if (contactClean.toLowerCase() !== leadNameClean.toLowerCase()) {
      siteContactSentence = ` We will ask for ${contactClean} when we arrive.`;
    }
  }

  // Date merge fields
  let targetDate: Date | null = null;
  if (ctx.walkthroughAt || ctx.callbackAt) {
    targetDate = new Date(ctx.walkthroughAt || ctx.callbackAt);
  }

  const dayStr = targetDate ? formatTorontoDay(targetDate) : '';
  const timeStr = targetDate ? formatTorontoTime(targetDate) : '';
  const whenFutureStr = targetDate ? formatWhenFuture(targetDate, now) : '';
  const whenPastStr = targetDate ? formatWhenPast(targetDate, now) : '';

  // Original month for recheck
  let originalMonth = '';
  if (ctx.notInterestedAt || ctx.not_interested_at) {
    const d = toTorontoDate(ctx.notInterestedAt || ctx.not_interested_at);
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const nowTz = toTorontoDate(now);
    if (d.getFullYear() !== nowTz.getFullYear()) {
      originalMonth = `${months[d.getMonth()]} ${d.getFullYear()}`;
    } else {
      originalMonth = months[d.getMonth()];
    }
  }

  // Referrer parsing
  const referrerFullName = ctx.referrerName || ctx.referrer_full_name || '';
  const referrerFirstName = parseFirstName(referrerFullName) || '';

  const rawCity = input.lead.city || ctx.city || '';
  const city = cleanSnippet(rawCity, 40);
  const companyName = cleanSnippet(input.lead.company_name || ctx.companyName || ctx.company_name || '', 60);
  const repFirstName = parseFirstName(repName) || 'Malik';
  const callDaySimple = formatPastDaySimple(anchorDate, now);

  const tCtx: TemplateContext = {
    service_area: FOLLOWUP_CONFIG.serviceAreaPhrase,
    is_same_day: isSameTorontoDate(now, anchorDate),
    call_note: cleanSnippet(ctx.callNote || ctx.call_note, FOLLOWUP_CONFIG.limits.callNote),
    next_step: cleanSnippet(ctx.nextStep || ctx.next_step, FOLLOWUP_CONFIG.limits.nextStep),
    project_name: cleanSnippet(ctx.projectName || ctx.project_name, FOLLOWUP_CONFIG.limits.projectName),
    site_address: siteAddress,
    has_usable_site_address: hasUsableAddress,
    site_contact_sentence: siteContactSentence,
    day: dayStr,
    time: timeStr,
    when_future: whenFutureStr,
    when_past: whenPastStr,
    quote_amount: ctx.quoteAmount || ctx.quote_amount || '',
    scope_phase: ctx.scopePhase || ctx.scope_phase || '',
    job_date: ctx.jobDate || ctx.job_date || '',
    original_month: originalMonth,
    referrer_first_name: referrerFirstName,
    referrer_full_name: referrerFullName,
    city: city,
    company_name: companyName,
    rep_first_name: repFirstName,
    call_day_simple: callDaySimple,
  };

  const rendered = templateFn(tCtx);

  // Subject: capitalize first letter
  let subject = rendered.subject.trim();
  if (subject) {
    subject = subject.charAt(0).toUpperCase() + subject.slice(1);
  }

  // Assemble full email body
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const titleLine = repTitle ? `${repTitle}, ${FOLLOWUP_CONFIG.company.legalName}` : FOLLOWUP_CONFIG.company.legalName;
  const addressLine = mailingAddress || '{company_mailing_address}';

  const fullBody = [
    greeting,
    '',
    rendered.body,
    '',
    FOLLOWUP_CONFIG.signOff,
    repName,
    titleLine,
    repPhone,
    '',
    `${FOLLOWUP_CONFIG.company.legalName}, ${addressLine}, ${FOLLOWUP_CONFIG.company.website}`,
  ].join('\n');

  // Validate output (spec 5.3)
  validateRenderedOutput(subject, fullBody, !mailingAddress);

  return {
    subject,
    body: fullBody,
  };
}

/**
 * Validates rendered text against formatting rules (spec 5.3 and Rule 6).
 */
export function validateRenderedOutput(subject: string, body: string, allowMailingPlaceholder: boolean = false): void {
  const checkText = `${subject}\n${body}`;

  if (checkText.includes('{{') || checkText.includes('}}')) {
    throw new Error('Render output contains unmerged template brackets {{ or }}');
  }
  if (/\bundefined\b/.test(checkText)) {
    throw new Error('Render output contains undefined literal');
  }
  if (/\bnull\b/.test(checkText)) {
    throw new Error('Render output contains null literal');
  }
  if (/ {2,}/.test(checkText)) {
    throw new Error('Render output contains multiple consecutive spaces');
  }
  if (/\s[.,?!;]/.test(checkText)) {
    throw new Error('Render output contains space before punctuation');
  }
  if (checkText.includes('—') || checkText.includes('–')) {
    throw new Error('Render output contains em dash or en dash');
  }
  if (!allowMailingPlaceholder && checkText.includes('{company_mailing_address}')) {
    throw new Error('Add the company mailing address in follow-up settings');
  }
}
