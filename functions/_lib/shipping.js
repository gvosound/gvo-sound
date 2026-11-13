// Shop shipping: USPS retail prices (what the Post Office counter charges), live from the USPS Prices APIs.
//
// Turns on when the USPS_CLIENT_ID and USPS_CLIENT_SECRET secrets are set (an app on developers.usps.com in
// GVO's name). Until then, or whenever USPS can't answer, every order gets the flat rates in FLAT below,
// the same rates the shop charged before.
//
// Weights are estimates, in ounces, of each garment alone; pack() adds the poly mailer. They round up on
// purpose, so the buyer's price covers the counter price. Change a number here after weighing the real thing.
// A product not listed uses its category's weight.

export const FLAT = {
  US: { cents: 999, label: 'Standard shipping, 3 to 5 business days' },
  INTL: { cents: 1599, label: 'International standard shipping' },
  PICKUP: { cents: 0, label: 'Free pickup at 109 Gibralter Ave, Annapolis' },
};

const ORIGIN_ZIP = '21403';
const ESTIMATE_ZIP = '60601'; // Chicago, a middle distance from Annapolis, for the price before a ZIP is in

export const WEIGHT_OZ = {
  'gvo-x-ace-distressed-tee': 9.5, 'no-deadbeats-oversized-pink': 9.5, 'no-deadbeats-oversized-grey': 9.5,
  'prove-a-point-tee': 6.5, 'world-tour-tee-white': 6.5, 'world-tour-tee-black': 6.5, 'no-art-for-today-tee': 6.5,
  'never-see-the-haters-here-tee': 6.5, 'gvo-muscle-tee': 5.5, 'music-is-a-drug-long-sleeve': 8.5,
  'pain-is-temporary-dirtbike-jersey': 7.5, 'gvo-golf-set-shirt': 7.5, 'gvo-golf-set-shorts': 8.5,
  'collective-set-shirt': 8.5, 'collective-set-pants': 16.5, 'gvo-skater-shorts': 10.5,
  'world-tour-cheetah-hoodie': 24.5, 'world-tour-cozy-hoodie': 24.5, 'world-tour-cozy-pants': 18.5,
  'world-tour-tracksuit-jacket': 16.5, 'world-tour-tracksuit-pants': 14.5, 'worker-jacket': 34.5,
  'gvo-bodysuit': 5.5, 'gvo-body-set-top': 4.5, 'gvo-body-set-bottoms': 6.5, 'gvo-beanie': 2.5,
};
const CAT_OZ = { Shirts: 6.5, 'Cold weather': 24.5, Bottoms: 16.5, Headwear: 2.5 };

// GVO ships in poly mailers. The mailer size goes by what's inside: 10 x 13 for one or two light pieces,
// 14.5 x 19 for a hoodie or a set, 19 x 24 for big orders. Inches, filled depth, and the mailer's own ounces.
function pack(oz) {
  if (oz <= 24) return { oz: oz + 1, l: 13, w: 10, h: 2 };
  if (oz <= 64) return { oz: oz + 1.5, l: 19, w: 14.5, h: 4 };
  return { oz: oz + 2, l: 24, w: 19, h: 6 };
}

// Packed weight of Square line items [{catalog_object_id, quantity}], using the shop index from orders.js.
export function packedOz(lines, idx) {
  let oz = 0;
  for (const l of lines) {
    const hit = idx.get(l.catalog_object_id);
    const p = hit && hit.p;
    const w = p ? (WEIGHT_OZ[p.siteId || p.id] ?? CAT_OZ[p.cat] ?? 8) : 8;
    oz += w * Number(l.quantity || 1);
  }
  return pack(oz);
}

// OAuth token for the USPS APIs, kept in memory until a minute before it expires.
let tok = null;
async function token(env) {
  if (tok && tok.until > Date.now()) return tok.v;
  const r = await fetch('https://apis.usps.com/oauth2/v3/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: env.USPS_CLIENT_ID, client_secret: env.USPS_CLIENT_SECRET, grant_type: 'client_credentials' }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('usps token ' + r.status + ' ' + String(j.error_description || j.error || '').slice(0, 120));
  tok = { v: j.access_token, until: Date.now() + Math.max(60, (Number(j.expires_in) || 3600) - 60) * 1000 };
  return tok.v;
}

async function usps(env, path, body) {
  const r = await fetch('https://apis.usps.com' + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await token(env) }, body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) tok = null;
  if (!r.ok) throw new Error('usps ' + path + ' ' + r.status + ' ' + JSON.stringify(j.error || j).slice(0, 200));
  return j;
}

// The lowest price in a base-rates or base-rates-list answer, in dollars.
function lowest(j) {
  const all = [];
  if (typeof j.totalBasePrice === 'number') all.push(j.totalBasePrice);
  for (const o of j.rateOptions || []) if (typeof o.totalBasePrice === 'number') all.push(o.totalBasePrice);
  for (const x of j.rates || []) if (typeof x.price === 'number') all.push(x.price);
  return all.length ? Math.min(...all) : null;
}

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

// Prices are kept 6 hours per destination and weight, so a buyer who goes back and forth sees one price.
const memo = new Map(), TTL = 6 * 3600e3;

async function liveRate(env, { country, zip }, pk) {
  const lbs = Math.ceil(pk.oz) / 16;
  const key = [country, zip || '', Math.ceil(pk.oz)].join('|');
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v;
  const dims = { length: pk.l, width: pk.w, height: pk.h };
  let v;
  if (country === 'US') {
    const j = await usps(env, '/prices/v3/base-rates/search', {
      originZIPCode: ORIGIN_ZIP, destinationZIPCode: zip, weight: lbs, ...dims,
      mailClass: 'USPS_GROUND_ADVANTAGE', processingCategory: 'MACHINABLE', rateIndicator: 'SP',
      destinationEntryFacilityType: 'NONE', priceType: 'RETAIL', mailingDate: today(),
    });
    v = { price: lowest(j), label: 'USPS Ground Advantage' };
  } else {
    // First-Class Package International up to 4 lb, Priority Mail International above that.
    const fc = lbs <= 4;
    const base = { originZIPCode: ORIGIN_ZIP, destinationCountryCode: country, weight: lbs, ...dims, priceType: 'RETAIL', mailingDate: today() };
    if (zip) base.foreignPostalCode = zip;
    const mailClass = fc ? 'FIRST-CLASS_PACKAGE_INTERNATIONAL_SERVICE' : 'PRIORITY_MAIL_INTERNATIONAL';
    let j;
    try {
      j = await usps(env, '/international-prices/v3/base-rates/search', { ...base, mailClass, processingCategory: 'NON_MACHINABLE', rateIndicator: 'SP', destinationEntryFacilityType: 'NONE' });
    } catch (e) {
      // The list search needs fewer package details; take its lowest price for the same mail class.
      j = await usps(env, '/international-prices/v3/base-rates-list/search', { ...base, mailClass });
    }
    v = { price: lowest(j), label: fc ? 'USPS First-Class Package International' : 'USPS Priority Mail International' };
  }
  if (!(v.price > 0)) throw new Error('usps returned no price');
  memo.set(key, { at: Date.now(), v });
  if (memo.size > 500) memo.delete(memo.keys().next().value);
  return v;
}

// What shipping costs for this order. dest: { country, zip }. Returns { cents, label, live, estimate }.
// live: priced by USPS. estimate: priced to a stand-in ZIP because the buyer hasn't entered theirs yet.
export async function shipQuote(env, f, lines, idx) {
  if (!f || f.type !== 'ship') return { ...FLAT.PICKUP, live: false, estimate: false };
  const country = String((f.address && f.address.country) || f.country || 'US').toUpperCase().slice(0, 2);
  let zip = String((f.address && f.address.zip) || f.zip || '').trim().slice(0, 12);
  if (country === 'US') zip = (zip.match(/^\d{5}/) || [''])[0];
  const flat = country === 'US' ? FLAT.US : FLAT.INTL;
  if (!env.USPS_CLIENT_ID || !env.USPS_CLIENT_SECRET ) return { ...flat, live: false, estimate: false };
  const estimate = country === 'US' && !zip;
  try {
    const v = await liveRate(env, { country, zip: estimate ? ESTIMATE_ZIP : zip }, packedOz(lines, idx));
    return { cents: Math.round(v.price * 100), label: v.label, live: true, estimate };
  } catch (e) {
    console.log('shipping: USPS price failed, using the flat rate.', e && e.message);
    return { ...flat, live: false, estimate: false };
  }
}

export const shipLive = env => !!(env.USPS_CLIENT_ID && env.USPS_CLIENT_SECRET);
