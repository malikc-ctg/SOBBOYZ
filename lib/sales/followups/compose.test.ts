import { describe, it, expect } from 'vitest';
import { gmailComposeUrl, gmailSearchUrl } from './compose';

describe('gmailComposeUrl & gmailSearchUrl', () => {
  it('encodes with encodeURIComponent, leaving spaces as %20 not +', () => {
    const res = gmailComposeUrl({
      from: 'rep@seaofblue.ca',
      to: 'lead@example.com',
      subject: 'Hello World',
      body: 'Hi John,\n\nTesting spacing.',
    });

    expect(res.url).toContain('to=lead%40example.com');
    expect(res.url).toContain('su=Hello%20World');
    expect(res.url).toContain('body=Hi%20John%2C%0A%0ATesting%20spacing.');
    expect(res.clipboardBody).toBeNull();
  });

  it('triggers clipboard fallback when URL exceeds 2000 chars', () => {
    const longBody = 'A'.repeat(2100);
    const res = gmailComposeUrl({
      to: 'lead@example.com',
      subject: 'Large email',
      body: longBody,
    });

    expect(res.url.length).toBeLessThan(2000);
    expect(res.url).not.toContain('body=');
    expect(res.clipboardBody).toBe(longBody);
  });

  it('generates gmail search url with OR query', () => {
    const url = gmailSearchUrl({
      from: 'rep@seaofblue.ca',
      leadEmail: 'prospect@acme.com',
    });
    expect(url).toContain('#search/from%3Aprospect%40acme.com+OR+to%3Aprospect%40acme.com');
  });
});
