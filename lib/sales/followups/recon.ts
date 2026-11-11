/**
 * Website & LinkedIn Recon Service powered by Claude Haiku 4.5.
 * Scopes ONLY the provided construction company website and the contact's provided LinkedIn URL,
 * caches the structured intel in leads.notes JSON (intel.ai_recon), and builds the Pre-Call Whisper Card.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { callClaudeSonnet, extractJsonFromClaude, CLAUDE_MODEL } from './claudeClient';
import { companyKey } from './company';
import { isPropertyOrAssetManagement } from '@/lib/sales/sectorUtils';

export interface LeadContactVerification {
  still_at_company: string;
  current_title: string;
  tenure?: string;
  projects_or_focus?: string;
}

export interface LeadRecon {
  company_summary: string;
  build_specialty: string;
  notable_projects: string[];
  service_cities: string[];
  contact_role_angle: string;
  proof_sentence: string;
  whisper_card: {
    what_they_build: string;
    company_touch_intel: string;
    lead_intel: string;
    recommended_opener?: string;
  };
  contact_verification?: LeadContactVerification;
  sources: string[];
  scoped_at: string;
  model: string;
}

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'Yahoo.ca',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'live.com',
  'msn.com',
  'rogers.com',
  'bell.net',
  'sympatico.ca',
]);

function normalizeUrl(rawUrl?: string | null, email?: string | null): string | null {
  let candidate = (rawUrl || '').trim();
  if (!candidate && email && email.includes('@')) {
    const domain = email.split('@')[1]?.trim().toLowerCase();
    if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
      candidate = domain;
    }
  }
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    return u.origin;
  } catch {
    return null;
  }
}

function stripHtmlToText(html: string, maxChars = 4500): string {
  if (!html) return '';
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');

  const titleMatch = withoutScripts.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescMatch =
    withoutScripts.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
    withoutScripts.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);

  const plain = withoutScripts
    .replace(/<\/(p|div|h1|h2|h3|h4|li|tr|section|article)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const header = [
    titleMatch ? `Page Title: ${titleMatch[1].trim()}` : '',
    metaDescMatch ? `Meta Description: ${metaDescMatch[1].trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const combined = `${header}\n${plain}`.trim();
  return combined.slice(0, maxChars);
}

async function fetchWebsiteText(
  baseUrl: string,
  isPropertyMgmt = false
): Promise<{ text: string; fetchedUrls: string[] }> {
  const paths = isPropertyMgmt
    ? ['', '/properties', '/portfolio', '/communities', '/buildings', '/services', '/about', '/about-us']
    : ['', '/projects', '/portfolio', '/about', '/about-us', '/services'];
  const fetchedUrls: string[] = [];
  const chunks: string[] = [];

  for (const path of paths) {
    if (chunks.join('\n').length >= 7000) break;
    const url = `${baseUrl}${path}`;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
        },
      });
      clearTimeout(timeout);
      if (!res.ok) continue;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('text/html')) continue;
      const html = await res.text();
      const cleaned = stripHtmlToText(html, path === '' ? 4000 : 2200);
      if (cleaned.length > 120) {
        fetchedUrls.push(url);
        chunks.push(`--- URL: ${url} ---\n${cleaned}`);
      }
    } catch {
      // ignore individual page timeout/fetch errors
    }
  }

  return {
    text: chunks.join('\n\n').slice(0, 8500),
    fetchedUrls,
  };
}

function extractHostname(rawUrl?: string | null): string | null {
  if (!rawUrl) return null;
  let candidate = String(rawUrl).trim();
  if (!candidate) return null;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }
  try {
    const u = new URL(candidate);
    return u.hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return null;
  }
}

async function fetchLinkedinPublicSnippet(linkedinUrl?: string | null): Promise<string> {
  if (!linkedinUrl) return '';
  let url = String(linkedinUrl).trim();
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return '';
    const html = await res.text();
    const cleaned = stripHtmlToText(html, 2000);
    if (cleaned.length > 80 && !/sign in|join linkedin|authwall/i.test(cleaned.slice(0, 300))) {
      return cleaned;
    }
    return '';
  } catch {
    return '';
  }
}

export function parseLeadIntelJson(notesRaw?: string | null): Record<string, any> {
  if (!notesRaw) return {};
  const trimmed = String(notesRaw).trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return { notes: notesRaw };
    }
  }
  return { notes: notesRaw };
}

const RECON_SYSTEM_PROMPT = `You are the Senior Commercial Intelligence Analyst for Sea of Blue Inc. (serving the GTA, Hamilton, Kitchener-Waterloo, London & Southwestern Ontario).

We have TWO distinct service lines depending on the prospect's vertical:
1. FOR CONSTRUCTION BUILDERS & GENERAL CONTRACTORS (Post-Construction):
   - Rough clean, pre-final clean, and final turnover clean for commercial, ICI, retail fit-out, multi-family, and custom residential builders.
2. FOR PROPERTY MANAGERS & ASSET MANAGERS (Sea of Blue Property Services):
   - Core Commitment: ONE VENDOR (one number, one call for cleaning, turnovers and building services), FIXED PRICE (know the cost before we start, no surprise invoices), DOCUMENTED (before and after photos on every job), WSIB Insured.
   - Core Services (book individually or bundle under one agreement for high-rise/low-rise condos, rental portfolios, commercial offices, retail plazas, industrial sites, and new builds):
     * Recurring Building Services: Common area cleaning, garbage rooms, amenity rooms, washrooms, day porter, night porter, building super.
     * Unit Turnover (between tenants): Move-out cleans, move-in cleans, carpet cleaning, appliance cleaning, paint touch-ups, drywall patching, junk removal.
     * Special & Problem Units: Hoarding clean-outs, deep cleans and resets, sanitation cleans, post-pest cleans, fire and flood cleanup.
     * Renovation & Construction Support (units & common areas): Rough/pre-final/final turnover clean, painting, drywall repair, floor prep, strip and wax.
     * Grounds, Exterior & Support Services: Landscaping & grounds, walkway snow & ice, exterior glass & gutters, solar panel cleaning, pressure washing, parking areas & garages, junk & move support (elevator padding), minor repairs (hardware/fixtures/bulbs/caulking), inspections & vacancy checks.

Your job is to scope the prospect's company ONLY using their provided company website and their provided LinkedIn profile link (plus the CRM lead data), and return a concise JSON dossier for our sales reps (Malik Campbell, Raahim Ahmed, and Ayaan Baig) and email drafter.

STRICT RULES:
1. NEVER use em-dashes (—) or en-dashes (–) anywhere. Use commas or periods instead.
2. NEVER search or reference third-party directory sites like ZoomInfo, RocketReach, Apollo, Lusha, SignalHire, ContactOut, or yellow pages. Rely strictly on the provided company website content, the provided LinkedIn URL, and the lead's CRM profile fields.
3. Write in a grounded, practical contractor-to-manager tone. No corporate buzzwords or cheesy flattery.
4. In "lead_intel", summarize:
   - Their role/title at the company (from their LinkedIn/CRM data).
   - If Property/Asset Manager: what buildings, condo corporations, rental portfolios, or commercial plazas they manage or oversee.
   - If Construction/GC: what projects, sectors, or divisions at the company align with their role (e.g. Estimator, Project Manager, Site Super).
5. Return ONLY valid JSON matching this exact schema:
{
  "company_summary": "1-2 sentence factual summary of what this company builds or what properties/portfolios they manage and where they operate",
  "build_specialty": "Short label, e.g. 'Condo & Multi-Family Property Management', 'Commercial & Retail Asset Management', 'Commercial ICI & Retail Fit-Outs', or 'General Contracting'",
  "notable_projects": ["Up to 3 specific property types, named buildings/communities, or construction projects mentioned on their site"],
  "service_cities": ["Cities they operate in, e.g. Mississauga, Oakville, Toronto, Hamilton"],
  "contact_role_angle": "1 sentence on what matters most to this specific contact's job title (e.g. Property Managers want one fixed-price vendor for common areas, day porters, and fast unit turnovers with paint/drywall touch-ups and before/after photos; Asset Managers want fast vacant suite turnovers, bundled building/exterior upkeep, and predictable fixed pricing; Estimators/PMs care about fixed-price rough + final cleans)",
  "proof_sentence": "A natural 1-sentence line for a cold email referencing their specific type of buildings/properties or construction sites and city (no em-dashes, no double spaces)",
  "whisper_card": {
    "what_they_build": "1 punchy bullet for the rep before dialing summarizing what properties they manage or what they build",
    "company_touch_intel": "1 punchy bullet summarizing past calls/colleagues at this company or decision-maker level",
    "lead_intel": "2-3 concise, high-value sentences for the rep: their confirmed role/seniority at the company and the types of properties, portfolios, or projects they oversee",
    "recommended_opener": "1 sentence phone opener tailored to their title and company specialty"
  },
  "contact_verification": {
    "still_at_company": "Yes / Verified / Likely",
    "current_title": "Current confirmed title from LinkedIn or CRM",
    "tenure": "Time at company if found, or 'N/A'",
    "projects_or_focus": "Specific properties, portfolios, or construction divisions they are tied to"
  }
}`;

const inFlightReconByLead = new Map<string, Promise<LeadRecon>>();

export async function getOrRunLeadRecon(
  leadId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<LeadRecon> {
  const rawLeadId = String(leadId).replace(/^lead_/, '');

  if (!options.forceRefresh && inFlightReconByLead.has(rawLeadId)) {
    return inFlightReconByLead.get(rawLeadId)!;
  }

  const runPromise = executeLeadRecon(rawLeadId, options).finally(() => {
    inFlightReconByLead.delete(rawLeadId);
  });

  inFlightReconByLead.set(rawLeadId, runPromise);
  return runPromise;
}

async function executeLeadRecon(
  rawLeadId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<LeadRecon> {
  const supabase = await createServiceClient();

  const { data: lead, error } = await supabase
    .from('leads')
    .select('*')
    .eq('id', rawLeadId)
    .single();

  if (error || !lead) {
    throw new Error(`Lead not found for recon: ${rawLeadId}`);
  }

  const intel = parseLeadIntelJson(lead.notes);

  if (!options.forceRefresh && intel.ai_recon && intel.ai_recon.company_summary) {
    return intel.ai_recon as LeadRecon;
  }

  // Check if another colleague at the same company already has company recon cached
  let siblingRecon: LeadRecon | null = null;
  if (!options.forceRefresh && lead.company_name && lead.company_name !== 'Commercial Prospect') {
    const { data: siblings } = await supabase
      .from('leads')
      .select('id, customer_name, contact_title, notes')
      .ilike('company_name', lead.company_name.trim())
      .neq('id', rawLeadId)
      .limit(10);

    for (const sib of siblings || []) {
      const sibIntel = parseLeadIntelJson(sib.notes);
      if (sibIntel.ai_recon?.company_summary) {
        siblingRecon = sibIntel.ai_recon;
        break;
      }
    }
  }

  // Fetch recent company-wide call events for touch intel
  const cKey = companyKey(lead.company_name);
  const { data: recentCalls } = await supabase
    .from('events')
    .select('created_at, payload')
    .eq('type', 'PHONE_CALL')
    .order('created_at', { ascending: false })
    .limit(200);

  const companyCallSummaries: string[] = [];
  for (const c of recentCalls || []) {
    const p = typeof c.payload === 'string' ? JSON.parse(c.payload) : c.payload || {};
    const cid = String(p.contact_id || '').replace(/^lead_/, '');
    const compMatch = cKey && companyKey(p.company_name) === cKey;
    if (cid === rawLeadId || compMatch) {
      companyCallSummaries.push(
        `${p.contact_name || 'Contact'} (${p.outcome_type || 'CALL'} by ${p.rep_name || 'Rep'}): ${p.notes || p.ai_summary || 'No notes'}`
      );
      if (companyCallSummaries.length >= 6) break;
    }
  }

  const isPropMgmt = isPropertyOrAssetManagement({
    contact_title: lead.contact_title || intel.seniority,
    company_name: lead.company_name,
    industry: intel.industry,
    sector: intel.sector,
    service_type: lead.service_type,
    departments: intel.departments || intel.department,
  });

  // 1. Scrape provided Company Website directly (free via Node fetch) unless siblingRecon already has it
  const baseUrl = normalizeUrl(intel.website, lead.customer_email);
  let websiteScrapedText = '';
  let fetchedUrls: string[] = [];
  if (baseUrl && !siblingRecon) {
    const scraped = await fetchWebsiteText(baseUrl, isPropMgmt);
    websiteScrapedText = scraped.text;
    fetchedUrls = scraped.fetchedUrls;
  } else if (siblingRecon?.sources?.length) {
    fetchedUrls = siblingRecon.sources;
  }

  // 2. Attempt direct metadata fetch on provided LinkedIn URL if present
  const providedLinkedin = intel.linkedin ? String(intel.linkedin).trim() : '';
  const linkedinScrapedText = providedLinkedin
    ? await fetchLinkedinPublicSnippet(providedLinkedin)
    : '';

  // 3. STRICT PROVIDED-LINKS-ONLY POLICY:
  // Never use paid Anthropic web_search ($0.01/search + 15k-30k search snippet tokens).
  // Recon relies 100% on the free direct website scrape + provided LinkedIn snippet + CRM lead data.
  const userPrompt = [
    `Vertical Playbook: ${isPropMgmt ? 'PROPERTY & ASSET MANAGEMENT (Sea of Blue Property Services: One Vendor, Fixed Price, Documented before/after photos for Recurring Building Services, Unit Turnovers with paint/drywall/junk/carpet, Problem Units, Renovation Support, and Grounds/Exterior Upkeep)' : 'POST-CONSTRUCTION CLEANING (Rough, Pre-Final, and Final Turnover Cleans for Builders & General Contractors)'}`,
    `Contact Name: ${lead.customer_name || 'Decision Maker'}`,
    `Contact Title: ${lead.contact_title || intel.seniority || (isPropMgmt ? 'Property Manager' : 'Project Manager')}`,
    `Seniority / Department: ${intel.seniority || 'N/A'} / ${intel.departments || intel.department || (isPropMgmt ? 'Property Management' : 'Construction')}`,
    `Company Name: ${lead.company_name || (isPropMgmt ? 'Property Management Firm' : 'Commercial Builder')}`,
    `City / Region: ${lead.city || 'GTA, Ontario'}`,
    `Industry / Sector: ${intel.industry || intel.sector || lead.service_type || (isPropMgmt ? 'Property Management' : 'Construction')}`,
    `Provided Website URL: ${intel.website || baseUrl || 'Not provided'}`,
    `Provided LinkedIn URL: ${providedLinkedin || 'Not provided'}`,
    `Company Size / Revenue Intel: ${intel.employees ? `${intel.employees} employees` : 'Unknown'} ${intel.annual_revenue || ''}`,
    `Rep Notes: ${intel.notes || intel.rep_notes || 'None'}`,
    `Recent Call / Colleague History at Company:\n${companyCallSummaries.length ? companyCallSummaries.join('\n') : 'No prior connected calls logged yet.'}`,
    siblingRecon
      ? `Existing Company Intel from Colleague Dossier:\nSummary: ${siblingRecon.company_summary}\nSpecialty: ${siblingRecon.build_specialty}\nProjects/Properties: ${(siblingRecon.notable_projects || []).join(', ')}\nCities: ${(siblingRecon.service_cities || []).join(', ')}`
      : '',
    websiteScrapedText
      ? `\nScraped Company Website Content (from ${baseUrl}):\n${websiteScrapedText}`
      : '\nNo additional website HTML scraped.',
    linkedinScrapedText
      ? `\nProvided LinkedIn Profile Content (from ${providedLinkedin}):\n${linkedinScrapedText}`
      : '',
    `\nTASK:`,
    isPropMgmt
      ? `1. Analyze the company and what properties or portfolios they manage or own (high-rise/low-rise condos, multi-family rentals, commercial offices, retail plazas, or industrial sites) in the GTA / Southwestern Ontario using ONLY the scraped website content, colleague dossier, and CRM data provided above.`
      : `1. Analyze the company and what projects they build in the GTA / Ontario using ONLY the scraped website content, colleague dossier, and CRM data provided above.`,
    `2. Using the contact's provided LinkedIn profile (${providedLinkedin || 'CRM role data'}) and title (${lead.contact_title || 'their title'}), summarize their role focus and property/project alignment in 'lead_intel'. Do NOT search external directories like ZoomInfo or RocketReach.`,
    `3. Synthesize the findings into the requested JSON schema.`,
  ]
    .filter(Boolean)
    .join('\n');

  const claudeRes = await callClaudeSonnet({
    model: 'claude-haiku-4-5',
    systemPrompt: RECON_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1200,
    enableWebSearch: false,
  });

  const parsed = extractJsonFromClaude<Partial<LeadRecon>>(claudeRes.text);
  const citationUrls = (claudeRes.citations || []).map((c) => c.url!).filter(Boolean);
  const allSources = Array.from(
    new Set([...fetchedUrls, ...citationUrls, ...(intel.linkedin ? [intel.linkedin] : [])])
  );

  const cleanNoDashes = (str?: string) =>
    String(str || '')
      .replace(/[—–]/g, ', ')
      .replace(/\s{2,}/g, ' ')
      .trim();

  const rawWhisper = parsed.whisper_card as any;
  const rawLeadIntel = cleanNoDashes(rawWhisper?.lead_intel);
  const rawOpener = cleanNoDashes(rawWhisper?.recommended_opener);

  const recon: LeadRecon = {
    company_summary:
      cleanNoDashes(parsed.company_summary) ||
      (isPropMgmt
        ? `${lead.company_name || 'This firm'} manages residential and commercial properties in ${lead.city || 'the GTA'}.`
        : `${lead.company_name || 'This builder'} operates construction projects in ${lead.city || 'the GTA'}.`),
    build_specialty:
      cleanNoDashes(parsed.build_specialty) ||
      (isPropMgmt ? 'Property & Asset Management' : 'Commercial & Post-Construction'),
    notable_projects: Array.isArray(parsed.notable_projects)
      ? parsed.notable_projects.map((p) => cleanNoDashes(p)).filter(Boolean).slice(0, 4)
      : [],
    service_cities: Array.isArray(parsed.service_cities)
      ? parsed.service_cities.map((c) => cleanNoDashes(c)).filter(Boolean)
      : [lead.city || 'GTA'],
    contact_role_angle:
      cleanNoDashes(parsed.contact_role_angle) ||
      (isPropMgmt
        ? 'Focus on one fixed-price vendor for common area cleaning, unit turnovers with paint and drywall touch-ups, and building upkeep with before and after photos.'
        : 'Focus on reliable rough, final, and touch-up clean scheduling with fixed square-foot pricing.'),
    proof_sentence:
      cleanNoDashes(parsed.proof_sentence) ||
      (isPropMgmt
        ? `We give property and asset managers in ${lead.city || 'the GTA'} one fixed-price team for recurring common area cleaning, between-tenant unit turnovers, and building upkeep with before and after photos on every job.`
        : `Most recently we turned over a 35,000 sq ft commercial facility in ${lead.city || 'Mississauga'}.`),
    whisper_card: {
      what_they_build:
        cleanNoDashes(rawWhisper?.what_they_build) ||
        cleanNoDashes(parsed.company_summary) ||
        (isPropMgmt
          ? `Manages properties and building portfolios in ${lead.city || 'the GTA'}.`
          : `Commercial construction in ${lead.city || 'the GTA'}.`),
      company_touch_intel:
        cleanNoDashes(rawWhisper?.company_touch_intel) ||
        (companyCallSummaries[0] ? cleanNoDashes(companyCallSummaries[0]) : 'First touch at this company.'),
      lead_intel:
        rawLeadIntel ||
        (parsed.contact_verification?.current_title
          ? `${lead.customer_name || 'Contact'} (${parsed.contact_verification.current_title}${parsed.contact_verification.still_at_company ? ` - ${parsed.contact_verification.still_at_company}` : ''}): ${parsed.contact_verification.projects_or_focus || parsed.contact_role_angle || 'Active at company'}.`
          : rawOpener ||
            `${lead.customer_name || 'Contact'} is listed as ${lead.contact_title || 'lead'} at ${lead.company_name || 'the company'}.`),
      recommended_opener:
        rawOpener ||
        (isPropMgmt
          ? `Hi ${lead.customer_name?.split(' ')[0] || 'there'}, I'm calling from Sea of Blue. We give property and asset managers in ${lead.city || 'the GTA'} one fixed-price vendor for common area cleaning, unit turnovers, and building upkeep.`
          : `Hi ${lead.customer_name?.split(' ')[0] || 'there'}, I'm calling from Sea of Blue. We handle rough and final post-construction cleans for builders in ${lead.city || 'the GTA'}.`),
    },
    contact_verification: parsed.contact_verification
      ? {
          still_at_company: cleanNoDashes(parsed.contact_verification.still_at_company) || 'Likely',
          current_title: cleanNoDashes(parsed.contact_verification.current_title) || lead.contact_title || 'Role listed',
          tenure: cleanNoDashes(parsed.contact_verification.tenure),
          projects_or_focus: cleanNoDashes(parsed.contact_verification.projects_or_focus),
        }
      : undefined,
    sources: allSources,
    scoped_at: new Date().toISOString(),
    model: CLAUDE_MODEL,
  };

  // Persist into leads.notes JSON so it's cached for future emails and visible in LeadDossierModal
  const updatedIntel = {
    ...intel,
    ai_recon: recon,
  };

  await supabase
    .from('leads')
    .update({
      notes: JSON.stringify(updatedIntel),
      updated_at: new Date().toISOString(),
    })
    .eq('id', rawLeadId);

  return recon;
}
