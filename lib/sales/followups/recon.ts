/**
 * Website & LinkedIn Recon Service powered by Claude Sonnet 5.5.
 * Scopes a construction company's website and the contact's LinkedIn/role profile,
 * caches the structured intel in leads.notes JSON (intel.ai_recon), and builds the Pre-Call Whisper Card.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { callClaudeSonnet, extractJsonFromClaude } from './claudeClient';
import { companyKey } from './company';

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
    recommended_opener: string;
  };
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

async function fetchWebsiteText(baseUrl: string): Promise<{ text: string; fetchedUrls: string[] }> {
  const paths = ['', '/projects', '/portfolio', '/about', '/about-us', '/services'];
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

const RECON_SYSTEM_PROMPT = `You are the Senior Construction Intelligence Analyst for Sea of Blue Inc., a commercial and post-construction cleaning contractor serving the Greater Toronto Area (GTA: Toronto, Mississauga, Brampton, Vaughan, Oakville, Burlington, Markham, Milton, Hamilton).

Your job is to scope a prospect's construction/development company website, LinkedIn profile context, and call history, then return a concise JSON dossier that our sales reps (Malik Campbell, Raahim Ahmed, and Ayaan Baig) and email drafter can use immediately.

STRICT WRITING RULES:
1. NEVER use em-dashes (—) or en-dashes (–) anywhere. Use commas or periods instead.
2. Write in a grounded, practical contractor-to-contractor tone. No corporate buzzwords or cheesy flattery.
3. Return ONLY valid JSON matching this exact schema:
{
  "company_summary": "1-2 sentence factual summary of what this builder/company constructs and where they operate",
  "build_specialty": "Short label, e.g. 'Commercial ICI & Retail Fit-Outs', 'Custom Luxury Homes', 'Multi-Family & Condo Developments', or 'General Contracting'",
  "notable_projects": ["Up to 3 specific project types, named projects, or sectors mentioned on their site/web"],
  "service_cities": ["Cities they build in, e.g. Mississauga, Oakville, Toronto"],
  "contact_role_angle": "1 sentence on what matters most to this specific contact's job title (e.g. Estimators care about fast fixed-price per sq ft + WSIB/insurance; Site Supers care about crews showing up on schedule and zero dust punch-list items before handover; Project Managers care about reliable rough + final + touch-up scheduling)",
  "proof_sentence": "A natural 1-sentence line for a cold email referencing their specific type of builds or city (no em-dashes, no double spaces, e.g. 'We handle rough, final, and pre-handover touch-up cleans for commercial fit-out and ICI builders across Mississauga and the GTA.')",
  "whisper_card": {
    "what_they_build": "1 punchy bullet for the rep before dialing",
    "company_touch_intel": "1 punchy bullet summarizing past calls/colleagues at this company or decision-maker level",
    "recommended_opener": "Exact 1-2 sentence phone opener tailored to their title and company specialty"
  }
}`;

export async function getOrRunLeadRecon(
  leadId: string,
  options: { forceRefresh?: boolean } = {}
): Promise<LeadRecon> {
  const supabase = await createServiceClient();
  const rawLeadId = String(leadId).replace(/^lead_/, '');

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

  // 1. Scrape Website if available
  const baseUrl = normalizeUrl(intel.website, lead.customer_email);
  let websiteScrapedText = '';
  let fetchedUrls: string[] = [];
  if (baseUrl) {
    const scraped = await fetchWebsiteText(baseUrl);
    websiteScrapedText = scraped.text;
    fetchedUrls = scraped.fetchedUrls;
  }

  // Enable Claude web_search if website text is sparse or LinkedIn URL is present
  const shouldUseWebSearch = Boolean(
    (!websiteScrapedText || websiteScrapedText.length < 400) &&
      lead.company_name &&
      lead.company_name !== 'Commercial Prospect'
  );

  const userPrompt = [
    `Contact Name: ${lead.customer_name || 'Decision Maker'}`,
    `Contact Title: ${lead.contact_title || intel.seniority || 'Project Manager'}`,
    `Company Name: ${lead.company_name || 'Commercial Builder'}`,
    `City / Region: ${lead.city || 'GTA, Ontario'}`,
    `Industry / Sector: ${intel.industry || intel.sector || lead.service_type || 'Construction'}`,
    `Website URL: ${intel.website || baseUrl || 'Not listed'}`,
    `LinkedIn URL: ${intel.linkedin || 'Not listed'}`,
    `Company Size / Revenue Intel: ${intel.employees ? `${intel.employees} employees` : 'Unknown'} ${intel.annual_revenue || ''}`,
    `Rep Notes: ${intel.notes || intel.rep_notes || 'None'}`,
    `Recent Call / Colleague History at Company:\n${companyCallSummaries.length ? companyCallSummaries.join('\n') : 'No prior connected calls logged yet.'}`,
    siblingRecon
      ? `Existing Company Intel from Colleague Dossier:\nSummary: ${siblingRecon.company_summary}\nSpecialty: ${siblingRecon.build_specialty}\nProjects: ${(siblingRecon.notable_projects || []).join(', ')}`
      : '',
    websiteScrapedText
      ? `\nScraped Company Website Content:\n${websiteScrapedText}`
      : '\nNo direct website HTML scraped. If needed, use web_search to check the company and contact in Ontario/GTA.',
  ]
    .filter(Boolean)
    .join('\n');

  const claudeRes = await callClaudeSonnet({
    systemPrompt: RECON_SYSTEM_PROMPT,
    userPrompt,
    maxTokens: 1500,
    enableWebSearch: shouldUseWebSearch,
    maxWebSearches: 2,
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

  const recon: LeadRecon = {
    company_summary:
      cleanNoDashes(parsed.company_summary) ||
      `${lead.company_name || 'This builder'} operates construction projects in ${lead.city || 'the GTA'}.`,
    build_specialty: cleanNoDashes(parsed.build_specialty) || 'Commercial & Post-Construction',
    notable_projects: Array.isArray(parsed.notable_projects)
      ? parsed.notable_projects.map((p) => cleanNoDashes(p)).filter(Boolean).slice(0, 4)
      : [],
    service_cities: Array.isArray(parsed.service_cities)
      ? parsed.service_cities.map((c) => cleanNoDashes(c)).filter(Boolean)
      : [lead.city || 'GTA'],
    contact_role_angle:
      cleanNoDashes(parsed.contact_role_angle) ||
      'Focus on reliable rough, final, and touch-up clean scheduling with fixed square-foot pricing.',
    proof_sentence:
      cleanNoDashes(parsed.proof_sentence) ||
      `Most recently we turned over a 35,000 sq ft commercial facility in ${lead.city || 'Mississauga'}.`,
    whisper_card: {
      what_they_build:
        cleanNoDashes(parsed.whisper_card?.what_they_build) ||
        cleanNoDashes(parsed.company_summary) ||
        `Commercial construction in ${lead.city || 'the GTA'}.`,
      company_touch_intel:
        cleanNoDashes(parsed.whisper_card?.company_touch_intel) ||
        (companyCallSummaries[0] ? cleanNoDashes(companyCallSummaries[0]) : 'First touch at this company.'),
      recommended_opener:
        cleanNoDashes(parsed.whisper_card?.recommended_opener) ||
        `Hi ${lead.customer_name?.split(' ')[0] || 'there'}, I'm calling from Sea of Blue. We handle rough and final post-construction cleans for builders in ${lead.city || 'the GTA'}.`,
    },
    sources: allSources,
    scoped_at: new Date().toISOString(),
    model: 'claude-sonnet-5-5',
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
