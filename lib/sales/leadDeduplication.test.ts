import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhoneAndExt,
  normalizeCompanyNameKey,
  compareLeadsForDuplicate,
  buildMergedLeadUpdate,
  findDuplicateGroups,
} from './leadDeduplication';

describe('leadDeduplication engine', () => {
  it('normalizes North American phone numbers and extensions cleanly', () => {
    expect(normalizePhoneAndExt('+1 (416) 555-0199 ext 204')).toEqual({
      phone10: '4165550199',
      ext: '204',
    });
    expect(normalizePhoneAndExt('416.555.0199 x12')).toEqual({
      phone10: '4165550199',
      ext: '12',
    });
  });

  it('normalizes emails and ignores placeholder emails', () => {
    expect(normalizeEmail('  Dan.Miller@EllisDon.com ')).toBe('dan.miller@ellisdon.com');
    expect(normalizeEmail('no-email-1700000@seaofblue.local')).toBe('');
  });

  it('normalizes company names across legal suffixes', () => {
    expect(normalizeCompanyNameKey('The Dineen Construction Corp.')).toBe(
      normalizeCompanyNameKey('Dineen Construction Inc')
    );
  });

  it('detects exact email duplicates', () => {
    const a = {
      customer_name: 'Jordan Oats',
      company_name: 'Dineen Construction',
      customer_email: 'joats@dineen.com',
      customer_phone: '416-675-7676',
    };
    const b = {
      customer_name: 'J. Oats',
      company_name: 'Dineen Construction Corp.',
      customer_email: 'JOATS@dineen.com',
      customer_phone: '',
    };
    const res = compareLeadsForDuplicate(a, b);
    expect(res.isDuplicate).toBe(true);
    expect(res.reason).toBe('email');
  });

  it('detects same person at same company even when phone or email is missing on one row', () => {
    const a = {
      customer_name: 'Jordan Oats',
      company_name: 'Dineen Construction Corp.',
      customer_phone: '416-675-7676',
    };
    const b = {
      customer_name: 'Jordan Oats',
      company_name: 'Dineen Construction Inc',
      customer_email: 'joats@dineen.com',
    };
    const res = compareLeadsForDuplicate(a, b);
    expect(res.isDuplicate).toBe(true);
    expect(res.reason).toBe('company_and_name');
  });

  it('does NOT falsely flag two different colleagues sharing a company switchboard number', () => {
    const colleagueA = {
      id: '1',
      customer_name: 'Jordan Oats',
      company_name: 'Dineen Construction',
      customer_phone: '416-675-7676',
    };
    const colleagueB = {
      id: '2',
      customer_name: 'Sarah Jenkins',
      company_name: 'Dineen Construction',
      customer_phone: '416-675-7676',
    };
    const res = compareLeadsForDuplicate(colleagueA, colleagueB);
    expect(res.isDuplicate).toBe(false);
  });

  it('flags phone duplicates when one contact has a generic placeholder name ("Decision Maker")', () => {
    const genericLead = {
      id: '1',
      customer_name: 'Decision Maker',
      company_name: 'Dineen Construction',
      customer_phone: '416-675-7676',
    };
    const namedLead = {
      id: '2',
      customer_name: 'Jordan Oats',
      company_name: 'Dineen Construction',
      customer_phone: '(416) 675-7676',
    };
    const res = compareLeadsForDuplicate(genericLead, namedLead);
    expect(res.isDuplicate).toBe(true);
    expect(res.reason).toBe('phone');
  });

  it('merges lead fields without losing higher pipeline status, extension, or notes', () => {
    const existing = {
      id: '1',
      customer_name: 'Decision Maker',
      company_name: 'Dineen Construction',
      contact_title: '',
      customer_phone: '416-675-7676',
      customer_email: '',
      status: 'contacted',
      quoted_price: 2500,
      notes: JSON.stringify({ notes: 'Spoke with receptionist', sector: 'post_construction' }),
    };
    const incoming = {
      customer_name: 'Jordan Oats',
      company_name: 'Dineen Construction',
      contact_title: 'Senior Project Manager',
      customer_phone: '416-675-7676 ext 204',
      customer_email: 'joats@dineen.com',
      status: 'new',
      quoted_price: 2500,
      notes: JSON.stringify({
        notes: 'Handles Toronto high-rise tenders',
        mobile_phone: '647-555-1234',
        linkedin: 'https://linkedin.com/in/joats',
      }),
    };

    const merged = buildMergedLeadUpdate(existing, incoming);
    expect(merged.customer_name).toBe('Jordan Oats');
    expect(merged.contact_title).toBe('Senior Project Manager');
    expect(merged.customer_phone).toBe('416-675-7676 ext 204');
    expect(merged.customer_email).toBe('joats@dineen.com');
    expect(merged.status).toBe('contacted'); // Kept higher stage!

    const parsedNotes = JSON.parse(merged.notes);
    expect(parsedNotes.mobile_phone).toBe('647-555-1234');
    expect(parsedNotes.linkedin).toBe('https://linkedin.com/in/joats');
    expect(parsedNotes.notes).toContain('Spoke with receptionist');
    expect(parsedNotes.notes).toContain('Handles Toronto high-rise tenders');
  });

  it('groups duplicate clusters and selects the richest record as primaryLead', () => {
    const leads = [
      {
        id: 'dup_sparse',
        customer_name: 'Decision Maker',
        company_name: 'EllisDon',
        customer_phone: '416-555-9000',
        status: 'new',
      },
      {
        id: 'primary_rich',
        customer_name: 'Dan Miller',
        company_name: 'EllisDon Construction',
        contact_title: 'Project Manager',
        customer_phone: '416-555-9000',
        customer_email: 'dmiller@ellisdon.com',
        status: 'info_sent',
      },
      {
        id: 'unrelated',
        customer_name: 'Alice Wong',
        company_name: 'PCL Constructors',
        customer_phone: '416-555-1111',
        status: 'new',
      },
    ];

    const groups = findDuplicateGroups(leads);
    expect(groups.length).toBe(1);
    expect(groups[0].primaryLead.id).toBe('primary_rich');
    expect(groups[0].duplicateLeads.map((d) => d.id)).toEqual(['dup_sparse']);
  });
});
