// GET /api/ig-partner?u=foracesonly: recent public posts from a collab partner's Instagram, for their product page.
// Uses Instagram's Business Discovery through GVO's own clothing account token, so it only works for partner
// accounts that are Business or Creator accounts. Partners are listed in PARTNERS with their permission.
// Media URLs from Instagram expire, so the answer is cached for 1 hour and fetched again after that.
// A stopgap until the partner sends the files: then they go in img/ and vid/ like every other product photo.
import { IG_ACCOUNTS, GRAPH } from '../_lib/ig-accounts.js';
import { shape } from './ig.js';

// handle -> the site product it shows on. Added with For Aces Only's permission, Nov 6, 2026.
const PARTNERS = { foracesonly: 'gvo-x-ace-distressed-tee' };
const HOUR = 3600;

export async function onRequestGet({ request, env, waitUntil }) {
  const u = String(new URL(request.url).searchParams.get('u') || '').toLowerCase();
  if (!PARTNERS[u]) return Response.json({ ok: false, error: 'Unknown partner' }, { status: 404 });
  const cache = caches.default, key = new Request('https://gvo-cache.internal/ig-partner/v1/' + u);
  const hit = await cache.match(key);
  if (hit) return hit;
  const acct = IG_ACCOUNTS.find(a => a.key === 'clothing'), tok = env[acct.token];
  let body, ttl = HOUR;
  try {
    if (!tok) throw new Error(acct.token + ' is not set');
    const fields = `business_discovery.username(${u}){username,name,media.limit(40){id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,children{id,media_type,media_url,thumbnail_url}}}`;
    const r = await fetch(`${GRAPH}/${acct.id}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(tok)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error(`graph ${r.status} ${j.error ? j.error.code + ' ' + String(j.error.message || '').split(tok).join('[token]').slice(0, 160) : ''}`);
    const bd = j.business_discovery || {}, list = (bd.media && bd.media.data) || [];
    const posts = list.map(m => {
      const p = shape(m, u);
      if (!p) return null;
      if (m.media_type === 'VIDEO' && m.media_url) p.src = m.media_url;
      // Carousel slides: the pictures and videos inside the post.
      if (m.children && m.children.data) p.slides = m.children.data.map(c => ({ kind: c.media_type, img: c.media_type === 'VIDEO' ? (c.thumbnail_url || '') : (c.media_url || ''), src: c.media_type === 'VIDEO' ? (c.media_url || '') : '' })).filter(c => c.img || c.src);
      return p;
    }).filter(Boolean);
    body = { ok: true, handle: bd.username || u, product: PARTNERS[u], posts };
  } catch (e) {
    console.log('ig-partner:', u, e.message);
    body = { ok: false, handle: u, product: PARTNERS[u], posts: [], error: e.message.slice(0, 200) };
    ttl = 300;
  }
  let t = JSON.stringify(body);
  if (tok && t.includes(tok)) t = JSON.stringify({ ok: false, posts: [] });
  const res = new Response(t, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': `public, max-age=${ttl}` } });
  const put = cache.put(key, res.clone());
  waitUntil ? waitUntil(put) : await put;
  return res;
}
