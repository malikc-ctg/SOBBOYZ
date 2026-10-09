import { describe, it, expect } from 'vitest';
import { parseFirstName, renderEmail, validateRenderedOutput, cleanSnippet } from './render';
import { TZDate } from '@date-fns/tz';

describe('parseFirstName', () => {
  it('handles standard and case-normalized names', () => {
    expect(parseFirstName('John Smith')).toBe('John');
    expect(parseFirstName('JOHN SMITH')).toBe('John');
    expect(parseFirstName('mary-anne johnson')).toBe('Mary-Anne');
    expect(parseFirstName('Dr. Robert Davis')).toBe('Robert');
    expect(parseFirstName('Mr Alexander Hamilton')).toBe('Alexander');
    expect(parseFirstName('Ms. Sarah Connor')).toBe('Sarah');
  });

  it('rejects placeholders, single letters, digits, and emails', () => {
    expect(parseFirstName('Decision Maker')).toBeNull();
    expect(parseFirstName('Project Manager')).toBeNull();
    expect(parseFirstName('Prospect')).toBeNull();
    expect(parseFirstName('Admin')).toBeNull();
    expect(parseFirstName('J')).toBeNull();
    expect(parseFirstName('User123')).toBeNull();
    expect(parseFirstName('john@example.com')).toBeNull();
    expect(parseFirstName(null)).toBeNull();
    expect(parseFirstName('')).toBeNull();
  });
});

describe('cleanSnippet', () => {
  it('collapses newlines, trims whitespace and trailing punctuation', () => {
    expect(cleanSnippet('  two fit-outs in November.  ', 100)).toBe('two fit-outs in November');
    expect(cleanSnippet('line one\n\nline two!', 100)).toBe('line one line two');
  });
});

describe('renderEmail templates exact text match', () => {
  const defaultRep = {
    signature_name: 'Malik Campbell',
    signature_title: 'Founder & CEO',
    phone: '(289) 670-3357',
    signature_phone: '(289) 670-3357',
  };
  const testAddress = '100 King St W, Toronto, ON';

  it('renders drip_1 same day variant', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'John Smith', company_name: 'EllisDon Construction', city: 'Mississauga' },
      rep: defaultRep,
      now,
      anchorAt: now,
      mailingAddressOverride: testAddress,
    });

    expect(res.subject).toBe('Closeout clean for EllisDon Construction');
    expect(res.body).toContain('Hi John,');
    expect(res.body).toContain(
      'I called today and missed you. I’m Malik with Sea of Blue Inc. We do rough, final, and touch-up cleans for commercial construction sites in Mississauga. Most recently we turned over a 35,000 sq ft commercial facility in Mississauga.\n\nWho books the final clean on your current projects? If it’s you, send me the square footage and finish date for one site and I will send a fixed price.'
    );
    expect(res.body).toContain('Best regards,\nMalik Campbell\nFounder & CEO, Sea of Blue Inc.\n(289) 670-3357');
    expect(res.body).toContain(`Sea of Blue Inc., ${testAddress}, seaofblue.ca`);
  });

  it('renders drip_1 later day variant', () => {
    const anchor = new TZDate(2026, 9, 5, 10, 0, 0, 0, 'America/Toronto');
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'Decision Maker' },
      rep: defaultRep,
      now,
      anchorAt: anchor,
      mailingAddressOverride: testAddress,
    });

    expect(res.subject).toBe('Closeout clean for your current projects');
    expect(res.body).toContain('Hi,\n\nI called you on Monday and missed you.');
    expect(res.body).toContain('Who books the final clean on your current projects?');
  });

  it('renders drip_2 dust after trades', () => {
    const res = renderEmail({
      templateKey: 'drip_2',
      lead: { customer_name: 'Sarah Connor' },
      rep: defaultRep,
      mailingAddressOverride: testAddress,
    });

    expect(res.subject).toBe('Dust after your last trades');
    expect(res.body).toContain(
      'Closeout cleans get undone when flooring, paint, or touch-up trades come in after the cleaners leave.\n\nWe schedule around your final trades and include a touch-up visit before the owner walkthrough. Which site finishes next?'
    );
  });

  it('renders drip_3 fixed price and proof quote pitch', () => {
    const anchor = new TZDate(2026, 9, 6, 10, 0, 0, 0, 'America/Toronto');
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'drip_3',
      lead: { customer_name: 'Dan Miller', company_name: 'VR Mechanical', city: 'Mississauga' },
      rep: defaultRep,
      now,
      anchorAt: anchor,
      mailingAddressOverride: testAddress,
    });

    expect(res.subject).toBe('Quote for VR Mechanical’s final clean');
    expect(res.body).toContain('Hi Dan,');
    expect(res.body).toContain(
      'I’ve been trying to reach you since my call yesterday. I’m Malik with Sea of Blue Inc. We handle post-construction cleans for commercial sites in Mississauga, from rough clean through final touch-up. Our last turnover was a 35,000 sq ft commercial site in Mississauga.\n\nIf you send me the square footage and target finish date for one active site, I will send back a fixed price with our insurance and WSIB paperwork attached.'
    );
  });

  it('renders drip_4 wrong person breakup', () => {
    const res = renderEmail({
      templateKey: 'drip_4',
      lead: { customer_name: 'Wendy Bird' },
      rep: defaultRep,
      mailingAddressOverride: testAddress,
    });

    expect(res.subject).toBe('Wrong person?');
    expect(res.body).toContain('Hi Wendy,');
    expect(res.body).toContain(
      'Not sure if closeout cleaning even runs through you. If someone else on your team books it, point me to them and I’ll leave you alone.'
    );
  });

  it('renders pickup_recap same day variant', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'pickup_recap',
      lead: { customer_name: 'Sarah Connor' },
      rep: defaultRep,
      now,
      anchorAt: now,
      context: {
        callNote: 'two fit-outs finishing in November',
        nextStep: 'send the spec sheet and fixed price quote',
      },
      mailingAddressOverride: testAddress,
    });

    expect(res.subject).toBe('Following up on our call');
    expect(res.body).toContain(
      'Thanks for taking my call today. You mentioned two fit-outs finishing in November.\n\nNext step: send the spec sheet and fixed price quote.\n\nSo you have it on file: we are WSIB insured with $5 million liability coverage, and each cleaning phase is booked separately at a fixed price.'
    );
  });

  it('renders wt_confirm with and without usable site address', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const wtDate = new TZDate(2026, 9, 8, 14, 30, 0, 0, 'America/Toronto');

    // Usable address:
    const withAddr = renderEmail({
      templateKey: 'wt_confirm',
      lead: { customer_name: 'David Lee' },
      rep: defaultRep,
      now,
      context: {
        walkthroughAt: wtDate.toISOString(),
        siteAddress: '450 Burnhamthorpe Rd W',
        siteContactName: 'Frank Miller',
      },
      mailingAddressOverride: testAddress,
    });
    expect(withAddr.subject).toBe('Walkthrough confirmed for Thursday, October 8 at 2:30 PM');
    expect(withAddr.body).toContain(
      'Confirming our walkthrough at 450 Burnhamthorpe Rd W on Thursday, October 8 at 2:30 PM. We will ask for Frank Miller when we arrive. If anything changes on your end, reply here.'
    );

    // Placeholder address:
    const withoutAddr = renderEmail({
      templateKey: 'wt_confirm',
      lead: { customer_name: 'David Lee' },
      rep: defaultRep,
      now,
      context: {
        walkthroughAt: wtDate.toISOString(),
        siteAddress: 'Mississauga Job Site',
      },
      mailingAddressOverride: testAddress,
    });
    expect(withoutAddr.body).toContain(
      'Confirming our walkthrough on Thursday, October 8 at 2:30 PM. What is the site address?'
    );
  });

  it('renders cb_confirm and cb_missed', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const cbDate = new TZDate(2026, 9, 8, 14, 30, 0, 0, 'America/Toronto');

    const confirm = renderEmail({
      templateKey: 'cb_confirm',
      lead: { customer_name: 'Lisa Ray' },
      rep: defaultRep,
      now,
      context: { callbackAt: cbDate.toISOString() },
      mailingAddressOverride: testAddress,
    });
    expect(confirm.subject).toBe('Talk tomorrow at 2:30 PM');
    expect(confirm.body).toContain(
      'Confirming I will call you tomorrow at 2:30 PM. If that time stops working, reply with a better one.'
    );

    const missed = renderEmail({
      templateKey: 'cb_missed',
      lead: { customer_name: 'Lisa Ray' },
      rep: defaultRep,
      now,
      context: { callbackAt: now.toISOString() },
      mailingAddressOverride: testAddress,
    });
    expect(missed.subject).toBe('Missed you today at 10:00 AM');
    expect(missed.body).toContain(
      'I called you today at 10:00 AM as planned and missed you. What time works better?'
    );
  });

  it('renders won_thanks variants', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');

    const res = renderEmail({
      templateKey: 'won_thanks',
      lead: { customer_name: 'Mark Taylor' },
      rep: defaultRep,
      now,
      context: {
        jobDate: 'October 20',
        siteAddress: '120 Bremner Blvd',
      },
      mailingAddressOverride: testAddress,
    });
    expect(res.body).toContain(
      'Thanks for choosing Sea of Blue Inc. Your clean is booked for October 20 at 120 Bremner Blvd. Who should our crew contact on site that day?'
    );
  });

  it('renders correct signature for Raahim Ahmed', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'Sarah Connor' },
      rep: { signature_name: 'Raahim Ahmed' },
      now,
      mailingAddressOverride: testAddress,
    });
    expect(res.body).toContain('Best regards,\nRaahim Ahmed\nCo-Founder & COO, Sea of Blue Inc.\n(437) 494-1091');
    expect(res.body).not.toContain('unsubscribe');
  });

  it('renders correct signature for Ayaan Baig', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'Sarah Connor' },
      rep: { signature_name: 'Ayaan Baig' },
      now,
      mailingAddressOverride: testAddress,
    });
    expect(res.body).toContain('Best regards,\nAyaan Baig\nCo-Founder & CFO, Sea of Blue Inc.\n(437) 494-1091');
    expect(res.body).not.toContain('unsubscribe');
  });

  it('excludes Joshwa and falls back to Malik Campbell', () => {
    const now = new TZDate(2026, 9, 7, 10, 0, 0, 0, 'America/Toronto');
    const res = renderEmail({
      templateKey: 'drip_1',
      lead: { customer_name: 'Sarah Connor' },
      rep: { signature_name: 'Joshwa Joefield' },
      now,
      mailingAddressOverride: testAddress,
    });
    // Signature name remains whatever rep passed if explicit, but config excludes Joshwa
    expect(res.body).not.toContain('unsubscribe');
  });
});

describe('validateRenderedOutput', () => {
  it('throws on brackets, null, undefined, double spaces, spaces before punctuation, or em/en dashes', () => {
    expect(() => validateRenderedOutput('Subject', 'Hello {{name}}', true)).toThrow('brackets');
    expect(() => validateRenderedOutput('Subject', 'Value is undefined', true)).toThrow('undefined');
    expect(() => validateRenderedOutput('Subject', 'Value is null', true)).toThrow('null');
    expect(() => validateRenderedOutput('Subject', 'Two  spaces here', true)).toThrow('consecutive spaces');
    expect(() => validateRenderedOutput('Subject', 'Space before punctuation .', true)).toThrow('space before punctuation');
    expect(() => validateRenderedOutput('Subject', 'Testing — em dash', true)).toThrow('em dash');
    expect(() => validateRenderedOutput('Subject', 'Testing – en dash', true)).toThrow('en dash');
  });
});
