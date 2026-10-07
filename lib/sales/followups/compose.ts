/**
 * Gmail Compose and Search link generation (spec 5.4).
 */

const enc = encodeURIComponent;

export function gmailComposeUrl(o: { from?: string; to: string; subject: string; body: string }) {
  const base =
    'https://mail.google.com/mail/?' +
    (o.from ? `authuser=${enc(o.from)}&` : '') +
    `view=cm&fs=1&to=${enc(o.to)}&su=${enc(o.subject)}`;
  const full = `${base}&body=${enc(o.body)}`;
  return full.length <= 2000 ? { url: full, clipboardBody: null } : { url: base, clipboardBody: o.body };
}

export function gmailSearchUrl(o: { from?: string; leadEmail: string }) {
  const q = enc(`from:${o.leadEmail} OR to:${o.leadEmail}`).replace(/%20/g, '+');
  return 'https://mail.google.com/mail/' + (o.from ? `?authuser=${enc(o.from)}` : '') + `#search/${q}`;
}
