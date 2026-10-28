/**
 * Sales OS Contact & Lead Search Utility
 *
 * Capabilities:
 * - Multi-token / multi-word "AND" search (e.g. "Jordan Dineen", "Estimator Toronto")
 * - Smart phone number digit matching (matches (416) 675-7676 with 416675, 675-7676, 416, etc.)
 * - Alternate phone search (phone, customer_phone, work_direct_phone, mobile_phone, corporate_phone)
 * - Deep metadata search: Name, Company, Position/Title, Seniority, Email, City, Address,
 *   Notes/Rep notes, AI summary, Transcript, Sector & Industry, Status/Stage, Rep name, Website, Departments
 * - Field-specific prefix filters: "company:", "city:", "title:", "phone:", "status:", "sector:", "rep:", "email:", "notes:"
 * - Accent and punctuation-insensitive matching
 */

// Sector label mapping for friendly keyword search
export const SECTOR_KEYWORDS = {
  post_construction: ['post-construction', 'post construction', 'construction', 'builder', 'contractor', 'gc', 'super'],
  franchise_owners: ['franchise', 'franchisee', 'multi-unit', 'store', 'operator'],
  commercial_office: ['office', 'corporate', 'commercial office', 'business center', 'commercial'],
  property_management: ['property management', 'property mgmt', 'condo', 'hoa', 'landlord', 'multi-family'],
  industrial_warehouse: ['industrial', 'warehouse', 'logistics', 'manufacturing', 'plant'],
  medical_healthcare: ['medical', 'healthcare', 'clinic', 'dental', 'doctor'],
  retail_hospitality: ['retail', 'hospitality', 'restaurant', 'storefront', 'hotel'],
};

// Status label mapping for friendly keyword search
export const STATUS_KEYWORDS = {
  new: ['new', 'fresh', 'uncontacted'],
  no_answer: ['no answer', 'no-answer', 'na', 'unanswered'],
  contacted: ['contacted', 'in progress', 'convo', 'spoke'],
  info_sent: ['info sent', 'info', 'spec sheet', 'capabilities', 'brochure'],
  walkthrough_booked: ['walkthrough', 'walkthrough booked', 'booked', 'site visit', 'meeting'],
  quoted: ['quote', 'quoted', 'quote sent', 'pricing', 'estimate', 'proposal'],
  won: ['won', 'contract won', 'sale', 'closed won', 'deal'],
  lost: ['lost', 'not interested', 'closed lost'],
  callback: ['callback', 'call back', 'follow up', 'follow-up'],
  voicemail: ['voicemail', 'vm', 'left message'],
};

function normalizeString(val) {
  if (val === null || val === undefined) return '';
  return String(val)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function normalizeDigits(val) {
  if (!val) return '';
  return String(val).replace(/[^0-9]/g, '');
}

function extractNotesText(notes) {
  if (!notes) return '';
  if (typeof notes === 'string') {
    if (notes.startsWith('{') && notes.endsWith('}')) {
      try {
        const parsed = JSON.parse(notes);
        return Object.values(parsed).filter(v => typeof v === 'string').join(' ');
      } catch {
        return notes;
      }
    }
    return notes;
  }
  if (typeof notes === 'object') {
    return Object.values(notes).filter(v => typeof v === 'string').join(' ');
  }
  return '';
}

/**
 * Checks if a contact object matches a free-form search query.
 *
 * @param {object} contact - Contact/lead object from Phone Sales OS
 * @param {string} query - User search query string
 * @returns {boolean} - True if matches all query criteria
 */
export function matchContactSearch(contact, query) {
  if (!contact) return false;
  if (!query || typeof query !== 'string') return true;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  // Split query into terms / tokens
  const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  // Prepare normalized contact fields
  const nameNorm = normalizeString(contact.name || contact.customer_name);
  const companyNorm = normalizeString(contact.company || contact.company_name);
  const positionNorm = normalizeString(contact.position || contact.contact_title);
  const seniorityNorm = normalizeString(contact.seniority);
  const emailNorm = normalizeString(contact.email || contact.customer_email);
  const cityNorm = normalizeString(contact.city);
  const addressNorm = normalizeString(contact.address);
  const notesNorm = normalizeString(
    extractNotesText(contact.notes) + ' ' + 
    (contact.last_notes || '') + ' ' + 
    (contact.ai_summary || '') + ' ' + 
    (contact.transcript || '')
  );
  const repNorm = normalizeString(contact.last_rep_name || contact.assigned_rep_name || contact.rep_name);
  const websiteNorm = normalizeString((contact.website || '') + ' ' + (contact.linkedin || ''));
  const deptNorm = normalizeString((contact.departments || '') + ' ' + (contact.sub_departments || ''));

  // Sector and keywords
  const sectorRaw = normalizeString(contact.sector || contact.service_type || contact.industry);
  const sectorKeywords = (SECTOR_KEYWORDS[contact.sector] || []).map(normalizeString);
  const sectorFull = `${sectorRaw} ${sectorKeywords.join(' ')}`;

  // Status and keywords
  const statusRaw = normalizeString(contact.status);
  const statusKeywords = (STATUS_KEYWORDS[contact.status] || []).map(normalizeString);
  const statusFull = `${statusRaw} ${statusKeywords.join(' ')}`;

  // Phones & digits & extensions
  const extNorm = normalizeString(contact.extension);
  const phoneFields = [
    contact.phone,
    contact.customer_phone,
    contact.work_direct_phone,
    contact.mobile_phone,
    contact.corporate_phone,
    contact.extension ? `ext ${contact.extension}` : '',
    contact.extension ? `x${contact.extension}` : ''
  ].filter(Boolean);

  const phoneStrings = phoneFields.map(normalizeString);
  const phoneDigitsList = phoneFields.map(normalizeDigits).filter(Boolean);

  // Combined searchable text for general matching
  const allText = [
    nameNorm,
    companyNorm,
    positionNorm,
    seniorityNorm,
    emailNorm,
    cityNorm,
    addressNorm,
    notesNorm,
    repNorm,
    websiteNorm,
    deptNorm,
    sectorFull,
    statusFull,
    ...phoneStrings
  ].join(' ');

  // For a match, EVERY token must match
  return tokens.every(token => {
    // Check for field-specific prefix filters (e.g. "company:dineen", "city:toronto")
    if (token.includes(':')) {
      const colonIdx = token.indexOf(':');
      const prefix = token.slice(0, colonIdx);
      const val = token.slice(colonIdx + 1);
      if (!val) return true; // empty prefix value doesn't filter out

      switch (prefix) {
        case 'name':
          return nameNorm.includes(val);
        case 'company':
        case 'org':
          return companyNorm.includes(val);
        case 'title':
        case 'position':
        case 'role':
          return positionNorm.includes(val) || seniorityNorm.includes(val);
        case 'city':
        case 'location':
          return cityNorm.includes(val);
        case 'address':
          return addressNorm.includes(val);
        case 'phone':
        case 'tel': {
          const valDigits = normalizeDigits(val);
          if (valDigits) {
            return phoneDigitsList.some(p => p.includes(valDigits));
          }
          return phoneStrings.some(p => p.includes(val));
        }
        case 'ext':
        case 'extension':
          return extNorm.includes(val) || phoneStrings.some(p => p.includes(val));
        case 'email':
          return emailNorm.includes(val);
        case 'status':
        case 'stage':
          return statusFull.includes(val);
        case 'sector':
        case 'service':
        case 'industry':
          return sectorFull.includes(val);
        case 'rep':
          return repNorm.includes(val);
        case 'notes':
        case 'note':
          return notesNorm.includes(val);
        default:
          break;
      }
    }

    // Phone digit matching (if token contains 3+ digits)
    const tokenDigits = normalizeDigits(token);
    if (tokenDigits.length >= 3) {
      if (phoneDigitsList.some(digits => digits.includes(tokenDigits))) {
        return true;
      }
    }

    // General text substring search
    if (allText.includes(token)) {
      return true;
    }

    // Punctuation-stripped fallback (e.g. token "ellisdon" matches "ellis-don")
    const cleanToken = token.replace(/[^a-z0-9]/g, '');
    if (cleanToken && cleanToken.length >= 3) {
      const cleanAllText = allText.replace(/[^a-z0-9]/g, '');
      if (cleanAllText.includes(cleanToken)) {
        return true;
      }
    }

    return false;
  });
}

/**
 * Checks if a call event object matches a search query
 */
export function matchCallEventSearch(callEvent, query) {
  if (!callEvent) return false;
  if (!query || typeof query !== 'string') return true;

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return true;

  const tokens = trimmedQuery.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const contactName = normalizeString(callEvent.contact_name);
  const companyName = normalizeString(callEvent.company_name);
  const repName = normalizeString(callEvent.rep_name);
  const outcome = normalizeString(callEvent.outcome_type);
  const notes = normalizeString(callEvent.notes);
  const phone = normalizeString(callEvent.phone_number);
  const phoneDigits = normalizeDigits(callEvent.phone_number);

  const allText = [contactName, companyName, repName, outcome, notes, phone].join(' ');

  return tokens.every(token => {
    const tokenDigits = normalizeDigits(token);
    if (tokenDigits.length >= 3 && phoneDigits.includes(tokenDigits)) {
      return true;
    }
    return allText.includes(token);
  });
}
