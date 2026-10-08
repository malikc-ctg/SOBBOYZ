export const FOLLOWUP_CONFIG = {
  timezone: 'America/Toronto',
  company: {
    legalName: 'Sea of Blue Inc.',
    mailingAddress: process.env.NEXT_PUBLIC_COMPANY_MAILING_ADDRESS || process.env.COMPANY_MAILING_ADDRESS || '1108 Bonin Cres, Milton, ON',
    website: 'seaofblue.ca',
    defaultPhone: '(437) 475-1622',
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
