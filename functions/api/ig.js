// GET /api/ig: the latest posts from each account in IG_ACCOUNTS, plus the @gvo.sound posts approved for the
// music and podcast pages.
// 1. Each feed is read at most once an hour. With the IG_KV binding, the last list that loaded is kept in KV,
//    and shown whenever Instagram fails. Without it, the whole answer is cached for an hour.
// 2. Posts Instagram serves without media (removed, flagged, or not public) are left out.
// 3. Every new @gvo.sound post goes to the Social posts tab of the form sheet through the forms Apps Script
//    (FORMS_URL, FORMS_SECRET), which answers with the rows ticked Approved and their Show on choice.
// 4. ?refresh=1 with the X-Refresh-Key header set to FORMS_SECRET reads everything fresh. The sheet's
//    hourly trigger uses it, so new posts reach the tab even when nobody visits the site.
// Tokens stay in env. They're never logged or returned.
import { IG_ACCOUNTS, GRAPH, FIELDS } from '../_lib/ig-accounts.js';

const HOUR = 3600e3, MAX_POSTS = 24, MAX_APPROVED = 12;
let TOKENS = [];
// Last check before anything leaves: a response that somehow holds a token is never sent.
const json = (b, s = 200, cc = 'public, max-age=300') => {
  let t = JSON.stringify(b);
  if (TOKENS.some(k => k && t.includes(k))) { console.log('ig: blocked a response that held a token'); t = JSON.stringify({ ok: false, accounts: {}, approved: { music: [], podcast: [] } }); cc = 'no-store'; }
  return new Response(t, { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': cc } });
};

function scrubber(env) {
  const toks = IG_ACCOUNTS.map(a => env[a.token]).filter(Boolean);
  return s => toks.reduce((t, k) => t.split(k).join('[token]'), String(s || '')).slice(0, 200);
}

// One Instagram media object -> one tile. Null when Instagram gave no usable media.
export function shape(m, handle) {
  if (!m || !m.media_url || !m.permalink) return null; // no media_url: removed, flagged, or not public
  const code = (m.permalink.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|tv)\/([\w-]+)/) || [])[1];
  const img = m.media_type === 'VIDEO' ? m.thumbnail_url : m.media_url;
  if (!code || !img) return null;
  const first = String(m.caption || '').split('\n').map(s => s.trim()).find(Boolean) || '';
  const alt = first.replace(/(^|\s)[#@][\w.]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 110) || `Post from @${handle}`;
  return { id: String(m.id), code, reel: /\/reel\//.test(m.permalink) ? 1 : 0, video: m.media_type === 'VIDEO' ? 1 : 0, kind: m.media_type, img, alt, at: String(m.timestamp || '').replace(/([+-]\d\d)(\d\d)$/, '$1:$2'), link: m.permalink, caption: String(m.caption || '').slice(0, 500) };
}

async function graph(env, acct, path, scrub) {
  const tok = env[acct.token];
  if (!tok) throw new Error(`${acct.token} is not set`);
  const r = await fetch(`${GRAPH}/${path}${path.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(tok)}`);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(`graph ${r.status} ${j.error ? j.error.code + ' ' + scrub(j.error.message) : ''}`);
  return j;
}

const STATS = {};
async function liveFeed(env, acct, scrub) {
  const j = await graph(env, acct, `${acct.id}/media?fields=${FIELDS}&limit=${MAX_POSTS}`, scrub);
  const raw = j.data || [], posts = raw.map(m => shape(m, acct.handle)).filter(Boolean);
  STATS[acct.key] = { fromInstagram: raw.length, shown: posts.length,
    noMediaUrl: raw.filter(m => !m.media_url).length, noMediaUrlButThumb: raw.filter(m => !m.media_url && m.thumbnail_url).length,
    types: raw.reduce((o, m) => (o[m.media_type] = (o[m.media_type] || 0) + 1, o), {}) };
  return posts;
}

async function kvGet(env, k) { if (!env.IG_KV) return null; try { return await env.IG_KV.get(k, 'json'); } catch (e) { return null; } }
async function kvPut(env, k, v) { if (env.IG_KV) try { await env.IG_KV.put(k, JSON.stringify(v)); } catch (e) { console.log('ig: kv write failed', k); } }

async function feedFor(env, acct, force, scrub) {
  const saved = await kvGet(env, 'ig:feed:' + acct.key);
  if (!force && saved && Date.now() - saved.at < HOUR) return { ok: true, from: 'cache', posts: saved.posts, fetched: false };
  try {
    const posts = await liveFeed(env, acct, scrub);
    await kvPut(env, 'ig:feed:' + acct.key, { at: Date.now(), posts });
    return { ok: true, from: 'live', posts, fetched: true };
  } catch (e) {
    console.log('ig: feed failed', acct.key, e.message);
    if (saved) return { ok: true, from: 'saved', savedAt: new Date(saved.at).toISOString(), posts: saved.posts, fetched: false };
    return { ok: false, from: 'none', posts: [], fetched: false };
  }
}

// Sends the newest posts to the Social posts tab and gets back what's approved. Runs only when the feed was
// just read from Instagram, so at most once an hour. Otherwise the last answer comes from KV.
async function approvalsFor(env, acct, feed, scrub) {
  const key = 'ig:approved:' + acct.key, saved = await kvGet(env, key);
  if (!feed.fetched || !env.FORMS_URL || !env.FORMS_SECRET) return saved ? saved.posts : [];
  try {
    const r = await fetch(env.FORMS_URL, {
      method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: env.FORMS_SECRET, action: 'social', account: '@' + acct.handle,
        posts: feed.posts.map(p => ({ id: p.id, link: p.link, at: p.at, caption: p.caption, kind: p.kind })) }),
    });
    const j = JSON.parse(await r.text());
    if (!j.ok) throw new Error('script ' + (j.error || r.status));
    const byId = new Map(feed.posts.map(p => [p.id, p]));
    const picked = (j.approved || []).slice(0, MAX_APPROVED * 2);
    const posts = (await Promise.all(picked.map(async a => {
      let p = byId.get(String(a.id));
      if (!p) { // approved but older than the latest 24: read that one post
        try { p = shape(await graph(env, acct, `${encodeURIComponent(a.id)}?fields=${FIELDS}`, scrub), acct.handle); } catch (e) { p = null; }
      }
      return p ? { ...p, show: /podcast/i.test(a.show) ? 'Podcast' : /music/i.test(a.show) ? 'Music' : 'Both' } : null;
    }))).filter(Boolean);
    await kvPut(env, key, { at: Date.now(), posts });
    return posts;
  } catch (e) {
    console.log('ig: approval sync failed', acct.key, scrub(e.message));
    return saved ? saved.posts : [];
  }
}

const strip = p => { const { caption, ...rest } = p; return rest; };
const newest = (a, b) => Date.parse(b.at) - Date.parse(a.at);

async function build(env, force) {
  const scrub = scrubber(env);
  const accounts = {}, approved = { music: [], podcast: [] };
  await Promise.all(IG_ACCOUNTS.map(async acct => {
    const feed = await feedFor(env, acct, force, scrub);
    accounts[acct.key] = { ok: feed.ok && feed.posts.length > 0, handle: acct.handle, from: feed.from, savedAt: feed.savedAt, posts: feed.posts.map(strip) };
    if (acct.approval) {
      const ok = await approvalsFor(env, acct, feed, scrub);
      for (const p of ok) {
        if (p.show !== 'Podcast') approved.music.push(strip(p));
        if (p.show !== 'Music') approved.podcast.push(strip(p));
      }
    }
  }));
  approved.music = approved.music.sort(newest).slice(0, MAX_APPROVED);
  approved.podcast = approved.podcast.sort(newest).slice(0, MAX_APPROVED);
  return { ok: true, checked: new Date().toISOString(), kv: !!env.IG_KV, accounts, approved };
}

export async function onRequestGet({ request, env, waitUntil }) {
  TOKENS = IG_ACCOUNTS.map(a => env[a.token]).filter(Boolean);
  const url = new URL(request.url);
  if (url.searchParams.has('debug')) { // counts only: what Instagram sent and what the site kept
    for (const k in STATS) delete STATS[k];
    const scrub = scrubber(env);
    await Promise.all(IG_ACCOUNTS.map(a => liveFeed(env, a, scrub).catch(e => { STATS[a.key] = { error: e.message }; })));
    return json({ ok: true, kv: !!env.IG_KV, stats: STATS }, 200, 'no-store');
  }
  const force = url.searchParams.has('refresh') && !!env.FORMS_SECRET && request.headers.get('X-Refresh-Key') === env.FORMS_SECRET;
  if (env.IG_KV) {
    try { return json(await build(env, force), 200, force ? 'no-store' : 'public, max-age=300'); }
    catch (e) { console.log('ig: build failed'); return json({ ok: false, accounts: {}, approved: { music: [], podcast: [] } }, 200, 'no-store'); }
  }
  // No KV yet: cache the whole answer for an hour instead.
  const cache = caches.default, key = new Request(url.origin + '/api/ig');
  if (!force) { const hit = await cache.match(key); if (hit) return hit; }
  let body;
  try { body = await build(env, true); } catch (e) { body = { ok: false, accounts: {}, approved: { music: [], podcast: [] } }; }
  const allOk = body.ok && IG_ACCOUNTS.every(a => body.accounts[a.key] && body.accounts[a.key].ok);
  const res = json(body, 200, `public, max-age=${allOk ? 3600 : 300}`);
  const p = cache.put(key, res.clone()); waitUntil ? waitUntil(p) : await p;
  return res;
}
