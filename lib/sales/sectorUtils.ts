import { ServiceType } from '@/types';

export const VALID_SERVICE_TYPES: readonly ServiceType[] = [
  'standard_clean',
  'standard_plus_clean',
  'deep_clean',
  'reset_clean',
  'move_in_clean',
  'move_out_clean',
  'recurring_standard',
  'recurring_deep',
  'post_construction_clean',
  'commercial_cleaning',
  'strip_and_wax',
  'carpet_clean',
  'junk_removal',
  'painting',
] as const;

export const VALID_SERVICE_TYPE_SET = new Set<string>(VALID_SERVICE_TYPES);

/**
 * Normalizes any service type string, B2B sector, or user scope into a valid PostgreSQL service_type enum value.
 * Prevents "invalid input value for enum service_type" errors when creating/updating leads or converting to jobs.
 */
export function toValidServiceType(serviceTypeOrSector?: string | null): ServiceType {
  if (!serviceTypeOrSector) return 'commercial_cleaning';
  const clean = String(serviceTypeOrSector).trim().toLowerCase();

  if (VALID_SERVICE_TYPE_SET.has(clean)) {
    return clean as ServiceType;
  }

  // Common aliases & sector-to-service mapping
  if (
    clean === 'post_construction' ||
    clean.includes('construction') ||
    clean.includes('builder') ||
    clean.includes('contractor') ||
    clean.includes('turnover') ||
    clean.includes('rough clean') ||
    clean.includes('final clean')
  ) {
    return 'post_construction_clean';
  }

  if (clean.includes('carpet')) {
    return 'carpet_clean';
  }

  if (clean.includes('strip') || clean.includes('wax')) {
    return 'strip_and_wax';
  }

  if (clean.includes('junk')) {
    return 'junk_removal';
  }

  if (clean.includes('paint')) {
    return 'painting';
  }

  if (clean.includes('deep')) {
    return 'deep_clean';
  }

  if (clean.includes('move_in') || clean.includes('move in')) {
    return 'move_in_clean';
  }

  if (clean.includes('move_out') || clean.includes('move out')) {
    return 'move_out_clean';
  }

  // Commercial B2B sectors (franchise_owners, commercial_office, property_management, industrial_warehouse, medical_healthcare, retail_hospitality)
  return 'commercial_cleaning';
}

/**
 * Canonical sectors supported in the Sales Kanban & dialer
 */
export type CanonicalSector =
  | 'post_construction'
  | 'franchise_owners'
  | 'commercial_office'
  | 'property_management'
  | 'industrial_warehouse'
  | 'medical_healthcare'
  | 'retail_hospitality'
  | (string & {});

/**
 * Normalizes an arbitrary sector or classification string into a slug-friendly key.
 */
export function slugifySector(input: string): string {
  return String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolves any sector, industry string, or service type into one of the canonical sales sectors,
 * or formats a new dynamic sector slug if provided.
 */
export function resolveCanonicalSector(input?: string | null): string {
  if (!input) return 'post_construction';
  const s = String(input).trim().toLowerCase();

  if (
    s === 'franchise_owners' ||
    s.includes('franchise') ||
    s.includes('franchisee') ||
    s.includes('owner-operator') ||
    s.includes('multi-unit')
  ) {
    return 'franchise_owners';
  }

  if (
    s === 'commercial_office' ||
    s.includes('office') ||
    s.includes('corporate') ||
    s.includes('financial') ||
    s.includes('law firm') ||
    s.includes('accounting')
  ) {
    return 'commercial_office';
  }

  if (
    s === 'property_management' ||
    s.includes('property') ||
    s.includes('real estate') ||
    s.includes('residential') ||
    s.includes('hoa') ||
    s.includes('landlord') ||
    s.includes('strata') ||
    s.includes('condo')
  ) {
    return 'property_management';
  }

  if (
    s === 'industrial_warehouse' ||
    s.includes('industrial') ||
    s.includes('warehouse') ||
    s.includes('logistics') ||
    s.includes('plant') ||
    s.includes('manufacturing') ||
    s.includes('distribution') ||
    s.includes('factory')
  ) {
    return 'industrial_warehouse';
  }

  if (
    s === 'medical_healthcare' ||
    s.includes('medical') ||
    s.includes('healthcare') ||
    s.includes('clinic') ||
    s.includes('dental') ||
    s.includes('doctor') ||
    s.includes('hospital') ||
    s.includes('pharma')
  ) {
    return 'medical_healthcare';
  }

  if (
    s === 'retail_hospitality' ||
    s.includes('retail') ||
    s.includes('hospitality') ||
    s.includes('restaurant') ||
    s.includes('storefront') ||
    s.includes('hotel') ||
    s.includes('bar') ||
    s.includes('dining') ||
    s.includes('gym') ||
    s.includes('fitness')
  ) {
    return 'retail_hospitality';
  }

  if (
    s === 'post_construction' ||
    s.includes('construction') ||
    s.includes('builder') ||
    s.includes('contractor') ||
    s.includes('developer') ||
    s.includes('site super')
  ) {
    return 'post_construction';
  }

  // If a specific custom classification was passed (e.g. "educational_facilities", "auto_dealers")
  const slug = slugifySector(s);
  return slug || 'post_construction';
}

/**
 * Intelligently classifies a lead into a sector based on available lead fields
 * (job title, company name, industry, departments, sub-departments).
 */
export function classifyLeadSector(lead: {
  contact_title?: string | null;
  company_name?: string | null;
  industry?: string | null;
  sector?: string | null;
  departments?: string | null;
  sub_departments?: string | null;
}): string {
  const combined = [
    lead.industry,
    lead.sector,
    lead.contact_title,
    lead.company_name,
    lead.sub_departments,
    lead.departments,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  // 1. Property Management & Condos
  if (
    combined.includes('property manager') ||
    combined.includes('property management') ||
    combined.includes('condominium manager') ||
    combined.includes('condo manager') ||
    combined.includes('realty') ||
    combined.includes('residential') ||
    combined.includes('landlord') ||
    combined.includes('hoa') ||
    combined.includes('strata')
  ) {
    return 'property_management';
  }

  // 2. Franchise & Multi-Unit
  if (
    combined.includes('franchise') ||
    combined.includes('franchisee') ||
    combined.includes('multi-unit') ||
    combined.includes('store manager') ||
    combined.includes('general manager') && (combined.includes('restaurant') || combined.includes('retail'))
  ) {
    return 'franchise_owners';
  }

  // 3. Medical & Healthcare
  if (
    combined.includes('clinic') ||
    combined.includes('dental') ||
    combined.includes('doctor') ||
    combined.includes('medical') ||
    combined.includes('healthcare') ||
    combined.includes('hospital') ||
    combined.includes('pharma')
  ) {
    return 'medical_healthcare';
  }

  // 4. Industrial & Warehouses
  if (
    combined.includes('warehouse') ||
    combined.includes('logistics') ||
    combined.includes('distribution center') ||
    combined.includes('plant manager') ||
    combined.includes('manufacturing')
  ) {
    return 'industrial_warehouse';
  }

  // 5. Retail & Hospitality
  if (
    combined.includes('hotel') ||
    combined.includes('hospitality') ||
    combined.includes('dining') ||
    combined.includes('gym') ||
    combined.includes('fitness') ||
    combined.includes('showroom')
  ) {
    return 'retail_hospitality';
  }

  // 6. Post-Construction
  if (
    combined.includes('construction') ||
    combined.includes('contractor') ||
    combined.includes('builder') ||
    combined.includes('site super') ||
    combined.includes('project manager') && (combined.includes('build') || combined.includes('general contractor')) ||
    combined.includes('developments') ||
    combined.includes('estimating')
  ) {
    return 'post_construction';
  }

  // 7. Commercial Office
  if (
    combined.includes('law firm') ||
    combined.includes('accounting') ||
    combined.includes('corporate office') ||
    combined.includes('commercial office')
  ) {
    return 'commercial_office';
  }

  // Fallback to resolving whatever raw industry/sector was given
  return resolveCanonicalSector(lead.industry || lead.sector || '');
}
