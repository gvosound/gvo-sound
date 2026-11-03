// GET /api/reviews: the Google rating and review count, plus the reviews the team ticked in the sheet.
// Answer: { ok, rating, count, url, write, reviews:[{ name, stars, text, date, source, quote, on }] | null }
//
// Rating and count: Places API (New) Place Details with the GOOGLE_PLACES_KEY secret, three fields only.
//   Cached 24 hours, so the site makes about one Places call a day. Without the key, or if Google fails,
//   the answer carries the same values the page already shows (FALLBACK below, kept in step with GOOG in index.html).
// Reviews: the "Reviews" tab of the form sheet, through the Apps Script (FORMS_URL, action "reviews").
//   Cached 1 hour, so ticking or unticking a row shows within the hour. If the sheet can't be read,
//   reviews is null and the page keeps its own list.
// Google's Business Profile API (full review text) isn't available to GVO, so review text comes from the sheet.

const PLACE_ID = 'ChIJDbG7oHH3t4kRyg4SLB9TxSs';
const FALLBACK = {
  rating: '5.0',
  count: 47,
  url: 'https://maps.app.goo.gl/wXxp3d9VncWKfWJi9',
  write: 'https://search.google.com/local/writereview?placeid=' + PLACE_ID,
};
const DAY = 86400, HOUR = 3600, RETRY = 300; // a failed call is tried again after 5 minutes
const ON = ['Home', 'Recording', 'Photo', 'Podcast', 'All'];

const json = (obj, maxAge = 60) => new Response(JSON.stringify(obj), {
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${maxAge}` },
});

// One cached piece: read it, or make it and keep it for ttl seconds (ok) or RETRY seconds (failed).
async function cached(name, ttl, make, waitUntil) {
  const cache = caches.default, key = new Request('https://gvo-cache.internal/reviews/' + name);
  const hit = await cache.match(key);
  if (hit) return hit.json();
  const { value, ok } = await make();
  const p = cache.put(key, new Response(JSON.stringify(value), { headers: { 'Cache-Control': `max-age=${ok ? ttl : RETRY}` } }));
  waitUntil ? waitUntil(p) : await p;
  return value;
}

async function placeInfo(env) {
  if (!env.GOOGLE_PLACES_KEY) { console.log('reviews: GOOGLE_PLACES_KEY not set, using fallback rating'); return { value: null, ok: false }; }
  try {
    const r = await fetch('https://places.googleapis.com/v1/places/' + PLACE_ID, {
      headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_KEY, 'X-Goog-FieldMask': 'rating,userRatingCount,googleMapsUri' },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || typeof j.rating !== 'number' || !(j.userRatingCount > 0)) {
      console.log('reviews: Places answered', r.status, (j.error && j.error.message) || '');
      return { value: null, ok: false };
    }
    return { value: { rating: j.rating.toFixed(1), count: j.userRatingCount, url: j.googleMapsUri || '' }, ok: true };
  } catch (e) {
    console.log('reviews: Places call failed', e && e.message);
    return { value: null, ok: false };
  }
}

const str = (v, n) => String(v == null ? '' : v).replace(/^'/, '').trim().slice(0, n);

async function sheetReviews(env) {
  if (!env.FORMS_URL || !env.FORMS_SECRET) return { value: null, ok: false };
  try {
    const r = await fetch(env.FORMS_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: env.FORMS_SECRET, action: 'reviews' }),
    });
    const t = await r.text();
    let j = {};
    try { j = JSON.parse(t); } catch (e) {}
    if (!j.ok || !Array.isArray(j.reviews)) { console.log('reviews: sheet answered', r.status, t.slice(0, 200)); return { value: null, ok: false }; }
    const list = j.reviews.map(x => ({
      name: str(x.name, 80),
      stars: Math.max(1, Math.min(5, Math.round(Number(x.stars) || 5))),
      text: str(x.text, 1500),
      date: str(x.date, 20),
      source: /^google$/i.test(str(x.source, 20)) ? 'Google' : 'Other',
      quote: str(x.quote, 200),
      on: ON.find(o => o.toLowerCase() === str(x.on, 20).toLowerCase()) || 'Home',
    })).filter(x => x.name && x.text).slice(0, 40);
    return { value: list, ok: true };
  } catch (e) {
    console.log('reviews: sheet call failed', e && e.message);
    return { value: null, ok: false };
  }
}

export async function onRequestGet({ env, waitUntil }) {
  const [place, reviews] = await Promise.all([
    cached('place-v1', DAY, () => placeInfo(env), waitUntil),
    cached('sheet-v1', HOUR, () => sheetReviews(env), waitUntil),
  ]);
  return json({
    ok: true,
    rating: (place && place.rating) || FALLBACK.rating,
    count: (place && place.count) || FALLBACK.count,
    url: (place && place.url) || FALLBACK.url,
    write: FALLBACK.write,
    live: !!place,
    reviews: reviews && reviews.length ? reviews : null,
  });
}
