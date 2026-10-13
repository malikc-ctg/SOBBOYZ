import { describe, it, expect } from 'vitest';
import { matchContactSearch } from './searchUtils';

describe('Sales OS matchContactSearch', () => {
  const sampleContact = {
    id: 'lead-1',
    name: 'Jordan Oats',
    company: 'Dineen Construction Inc.',
    position: 'Senior Project Manager',
    seniority: 'Manager',
    phone: '(416) 675-7676',
    customer_phone: '(416) 675-7676',
    work_direct_phone: '416-675-7677',
    mobile_phone: '647-555-8989',
    corporate_phone: '416-675-7600',
    email: 'joats@dineen.com',
    city: 'Toronto',
    address: '70 Growth Road, Toronto, ON',
    sector: 'post_construction',
    service_type: 'post_construction_clean',
    status: 'walkthrough_booked',
    notes: '{"notes": "Looking for post-con cleaning for 5-storey midrise downtown", "technologies": "Procore"}',
    last_notes: 'Spoke with Jordan, confirmed walkthrough for Friday 10am',
    ai_summary: 'Site supers need window cleaning and final polish',
    last_rep_name: 'Malik Campbell',
    website: 'dineen.com',
    departments: 'Operations, Project Management'
  };

  it('returns true on empty or null query', () => {
    expect(matchContactSearch(sampleContact, '')).toBe(true);
    expect(matchContactSearch(sampleContact, '   ')).toBe(true);
    expect(matchContactSearch(sampleContact, null)).toBe(true);
  });

  it('returns false for null contact', () => {
    expect(matchContactSearch(null, 'Jordan')).toBe(false);
  });

  it('matches by contact name (single term, case-insensitive)', () => {
    expect(matchContactSearch(sampleContact, 'jordan')).toBe(true);
    expect(matchContactSearch(sampleContact, 'OATS')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Steve')).toBe(false);
  });

  it('matches by company name', () => {
    expect(matchContactSearch(sampleContact, 'dineen')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Construction')).toBe(true);
  });

  it('matches by title and seniority', () => {
    expect(matchContactSearch(sampleContact, 'project manager')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Senior')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Estimator')).toBe(false);
  });

  it('matches across multiple terms (AND search: name + company)', () => {
    expect(matchContactSearch(sampleContact, 'Jordan Dineen')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Jordan Toronto')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Oats Procore')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Jordan Apex')).toBe(false);
  });

  it('matches formatted phone numbers by unformatted digits', () => {
    expect(matchContactSearch(sampleContact, '4166757676')).toBe(true);
    expect(matchContactSearch(sampleContact, '6757676')).toBe(true);
    expect(matchContactSearch(sampleContact, '416-675')).toBe(true);
    expect(matchContactSearch(sampleContact, '(416)')).toBe(true);
  });

  it('matches alternate phones (direct phone, mobile, corporate)', () => {
    expect(matchContactSearch(sampleContact, '6475558989')).toBe(true);
    expect(matchContactSearch(sampleContact, '647-555')).toBe(true);
    expect(matchContactSearch(sampleContact, '7677')).toBe(true); // direct phone
    expect(matchContactSearch(sampleContact, '7600')).toBe(true); // corporate phone
  });

  it('matches email and domain', () => {
    expect(matchContactSearch(sampleContact, 'joats@dineen.com')).toBe(true);
    expect(matchContactSearch(sampleContact, 'joats')).toBe(true);
    expect(matchContactSearch(sampleContact, 'dineen.com')).toBe(true);
  });

  it('matches city and address', () => {
    expect(matchContactSearch(sampleContact, 'Toronto')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Growth Road')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Montreal')).toBe(false);
  });

  it('matches notes, last notes, and AI summary', () => {
    expect(matchContactSearch(sampleContact, 'midrise')).toBe(true);
    expect(matchContactSearch(sampleContact, 'walkthrough for Friday')).toBe(true);
    expect(matchContactSearch(sampleContact, 'window cleaning')).toBe(true);
    expect(matchContactSearch(sampleContact, 'Procore')).toBe(true);
  });

  it('matches sector by key or natural keywords', () => {
    expect(matchContactSearch(sampleContact, 'post_construction')).toBe(true);
    expect(matchContactSearch(sampleContact, 'construction')).toBe(true);
    expect(matchContactSearch(sampleContact, 'contractor')).toBe(true);
    expect(matchContactSearch(sampleContact, 'franchise')).toBe(false);
  });

  it('matches status by stage key or human labels', () => {
    expect(matchContactSearch(sampleContact, 'walkthrough_booked')).toBe(true);
    expect(matchContactSearch(sampleContact, 'walkthrough')).toBe(true);
    expect(matchContactSearch(sampleContact, 'booked')).toBe(true);
    expect(matchContactSearch(sampleContact, 'site visit')).toBe(true);
  });

  it('matches rep attribution', () => {
    expect(matchContactSearch(sampleContact, 'Malik')).toBe(true);
  });

  it('supports prefix filters (company:, city:, title:, phone:, status:)', () => {
    expect(matchContactSearch(sampleContact, 'company:dineen')).toBe(true);
    expect(matchContactSearch(sampleContact, 'company:apex')).toBe(false);
    expect(matchContactSearch(sampleContact, 'city:toronto')).toBe(true);
    expect(matchContactSearch(sampleContact, 'city:vaughan')).toBe(false);
    expect(matchContactSearch(sampleContact, 'title:manager')).toBe(true);
    expect(matchContactSearch(sampleContact, 'phone:6757676')).toBe(true);
    expect(matchContactSearch(sampleContact, 'status:booked')).toBe(true);
    expect(matchContactSearch(sampleContact, 'status:won')).toBe(false);
    expect(matchContactSearch(sampleContact, 'company:dineen Jordan')).toBe(true);
  });

  it('matches extension in contact phone or dedicated extension field', () => {
    const contactWithExt = {
      ...sampleContact,
      extension: '223'
    };
    expect(matchContactSearch(contactWithExt, 'ext 223')).toBe(true);
    expect(matchContactSearch(contactWithExt, 'x223')).toBe(true);
    expect(matchContactSearch(contactWithExt, 'ext:223')).toBe(true);
    expect(matchContactSearch(contactWithExt, 'extension:223')).toBe(true);
  });
});
