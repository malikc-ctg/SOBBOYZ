export const FOLLOWUP_CONFIG = {
  timezone: 'America/Toronto',
  company: {
    legalName: 'Sea of Blue Inc.',
    mailingAddress: process.env.NEXT_PUBLIC_COMPANY_MAILING_ADDRESS || process.env.COMPANY_MAILING_ADDRESS || '1108 Bonin Cres, Milton, ON',
    website: 'seaofblue.ca',
    defaultPhone: '(289) 670-3357',
  },
  signOff: 'Best regards,',
  serviceAreaPhrase: 'across the GTA',
  // Ontario statutory holidays (observed dates) through 2027. Extend each year.
  holidays: [
    '2026-10-12', '2026-12-25', '2026-12-28',
    '2027-01-01', '2027-02-15', '2027-03-26', '2027-05-24', '2027-07-01',
    '2027-09-06', '2027-10-11', '2027-12-27', '2027-12-28',
  ],
  emailHour: 9,
  callHour: 10,
  prepHour: 16,
  limits: { callNote: 300, nextStep: 200, projectName: 80, composeUrlMax: 2000 },
  placeholderNames: [
    'decision maker', 'unnamed contact', 'contact', 'project manager', 'prospect', 'owner',
    'manager', 'unknown', 'n/a', 'na', 'team', 'office', 'info', 'admin', 'sales',
  ],
  placeholderCompanies: ['commercial prospect'],
};

export interface SalesRepConfig {
  key: 'malik' | 'raahim' | 'ayaan';
  name: string;
  title: string;
  phone: string;
  email: string;
  gmail_address: string;
  auth_user_id?: string;
}

export const SALES_REPS: Record<'malik' | 'raahim' | 'ayaan', SalesRepConfig> = {
  malik: {
    key: 'malik',
    name: 'Malik Campbell',
    title: 'Founder & CEO',
    phone: '(289) 670-3357',
    email: 'malik@seaofblue.app',
    gmail_address: 'malik@seaofblue.app',
    auth_user_id: 'd616b5ed-d3a0-425d-b0c2-5f47a9320fc5',
  },
  raahim: {
    key: 'raahim',
    name: 'Raahim Ahmed',
    title: 'Co-Founder & COO',
    phone: '(437) 494-1091',
    email: 'raahim@seaofblue.app',
    gmail_address: 'raahim@seaofblue.app',
    auth_user_id: 'fa039375-1c07-4579-890a-6c7000cc0be8',
  },
  ayaan: {
    key: 'ayaan',
    name: 'Ayaan Baig',
    title: 'Co-Founder & CFO',
    phone: '(437) 494-1091',
    email: 'ayaan@seaofblue.app',
    gmail_address: 'ayaan@seaofblue.app',
    auth_user_id: '3b2831b3-7922-4cb5-aa77-1a9b182e77a1',
  },
};

export const SALES_REP_LIST: SalesRepConfig[] = [
  SALES_REPS.malik,
  SALES_REPS.raahim,
  SALES_REPS.ayaan,
];

/**
 * Resolves a sales rep config by key, name, or user id.
 * Defaults to Malik Campbell. Excludes non-sales reps like Joshwa.
 */
export function resolveRepConfig(identifier?: string | null): SalesRepConfig {
  if (!identifier) return SALES_REPS.malik;
  const s = String(identifier).trim().toLowerCase();
  if (s === 'raahim' || s.includes('raahim') || s.includes('ryan') || s === 'fa039375-1c07-4579-890a-6c7000cc0be8') {
    return SALES_REPS.raahim;
  }
  if (s === 'ayaan' || s.includes('ayaan') || s === '3b2831b3-7922-4cb5-aa77-1a9b182e77a1' || s === 'f3596174-5657-4a53-b4b6-e7d4dca9d490') {
    return SALES_REPS.ayaan;
  }
  return SALES_REPS.malik;
}

