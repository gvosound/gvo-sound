// Square API helpers for Cloudflare Pages Functions.
// The access token lives only in the SQUARE_ACCESS_TOKEN secret (Pages > Settings > Variables and Secrets).
// It is read on the server and never sent to the browser.

export const SQUARE_VERSION = '2025-01-23';
export const TZ = 'America/New_York';
export const DEFAULTS = {
  appId: 'sq0idp-kalcI2_n6ftWyeUH-1INSw', // public: the Web Payments SDK needs it in the browser
  locationId: 'L7PXJB1MFW1TP',              // Gvo Sound Llc, 109 Gibralter Ave
};

export const cfg = env => ({
  token: env.SQUARE_ACCESS_TOKEN || '',
  appId: env.SQUARE_APPLICATION_ID || DEFAULTS.appId,
  locationId: env.SQUARE_LOCATION_ID || DEFAULTS.locationId,
  base: env.SQUARE_ENV === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com',
});

export class SquareError extends Error {
  constructor(status, errors, path) {
    const first = (errors && errors[0]) || {};
    super(first.detail || first.code || `Square ${status} on ${path}`);
    this.status = status; this.errors = errors || []; this.path = path;
    this.code = first.code || 'SQUARE_ERROR'; this.category = first.category || '';
  }
}

export async function sq(env, method, path, body) {
  const c = cfg(env);
  if (!c.token) throw new SquareError(500, [{ code: 'NO_TOKEN', detail: 'SQUARE_ACCESS_TOKEN is not set for this deployment' }], path);
  const res = await fetch(c.base + path, {
    method,
    headers: {
      'Authorization': 'Bearer ' + c.token,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = {}; }
  if (!res.ok || (data.errors && data.errors.length)) throw new SquareError(res.status, data.errors, path);
  return data;
}

// Follows cursors on list endpoints. getPage(cursor) returns {items, cursor}.
export async function allPages(getPage, max = 50) {
  const out = []; let cursor; let n = 0;
  do { const p = await getPage(cursor); out.push(...(p.items || [])); cursor = p.cursor; n++; } while (cursor && n < max);
  return out;
}

export const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

// Turns any thrown error into a JSON reply the page can show. Square's own detail stays in the logs.
export function fail(err, fallback = 'Something went wrong. Call or text the studio at (443) 292-6753.') {
  const status = err && err.status && err.status < 500 && err.status !== 401 ? 400 : 502;
  console.log('square error', err && err.path, err && err.code, err && err.message, JSON.stringify((err && err.errors) || []));
  const card = err && err.category === 'PAYMENT_METHOD_ERROR';
  const msg = err && err.userMessage ? err.userMessage
    : card ? cardMessage(err.code)
    : err && err.code === 'NO_TOKEN' ? 'Checkout is not connected yet. Call or text the studio at (443) 292-6753.'
    : fallback;
  return json({ ok: false, error: msg, code: (err && err.code) || 'ERROR' }, card ? 402 : status);
}

function cardMessage(code) {
  const m = {
    CARD_DECLINED: 'Your card was declined. Try another card.',
    INSUFFICIENT_FUNDS: 'Your card was declined for insufficient funds. Try another card.',
    CVV_FAILURE: 'The security code did not match. Check it and try again.',
    ADDRESS_VERIFICATION_FAILURE: 'The billing ZIP code did not match. Check it and try again.',
    INVALID_EXPIRATION: 'The expiration date is not valid. Check it and try again.',
    GENERIC_DECLINE: 'Your card was declined. Try another card.',
    CARD_DECLINED_VERIFICATION_REQUIRED: 'Your bank needs to verify this card. Try again and follow its prompt.',
  };
  return m[code] || 'The payment did not go through. Try another card.';
}

export const money = cents => ({ amount: Math.round(cents), currency: 'USD' });
export const cents = m => (m && typeof m.amount === 'number' ? m.amount : m && m.amount ? Number(m.amount) : 0);

export function idem(...parts) {
  // Square allows up to 45 characters. Same inputs give the same key, so a double click cannot charge twice.
  const s = parts.join('|');
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619) >>> 0; h2 = Math.imul(h2 + c, 2246822519) >>> 0; }
  return (parts[0] + '-' + h1.toString(36) + h2.toString(36) + '-' + s.length.toString(36)).slice(0, 45);
}

export async function readBody(request) {
  try { return await request.json(); } catch (e) { const err = new Error('Bad request'); err.status = 400; err.userMessage = 'Bad request'; throw err; }
}

export const clean = (s, n = 200) => String(s == null ? '' : s).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, n);

export function e164(phone) {
  const d = String(phone || '').replace(/\D/g, '');
  if (d.length === 10) return '+1' + d;
  if (d.length === 11 && d[0] === '1') return '+' + d;
  return '';
}

// Finds a customer by email, then phone, or creates one.
export async function findOrCreateCustomer(env, { name, email, phone, note }) {
  const tryFind = async filter => {
    try {
      const r = await sq(env, 'POST', '/v2/customers/search', { limit: 1, query: { filter } });
      return r.customers && r.customers[0];
    } catch (e) { return null; }
  };
  let c = null;
  if (email) c = await tryFind({ email_address: { exact: email } });
  if (!c && phone) c = await tryFind({ phone_number: { exact: phone } });
  if (c) return c;
  const parts = clean(name, 100).split(/\s+/);
  const body = { idempotency_key: idem('cust', email || phone || name), given_name: parts.shift() || 'Guest', note: note || 'Added by gvosound.com' };
  if (parts.length) body.family_name = parts.join(' ');
  if (email) body.email_address = email;
  if (phone) body.phone_number = phone;
  const r = await sq(env, 'POST', '/v2/customers', body);
  return r.customer;
}
