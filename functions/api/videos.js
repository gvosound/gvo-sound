// GET /api/videos: every playlist in VIDEO_LISTS, newest first by publish date, Shorts left out.
// With YOUTUBE_API_KEY set it reads the YouTube Data API (every video in the playlist).
// Without it, the public playlist feed (only the first 15 videos in playlist order).
// The whole answer is cached for 1 hour. A playlist that fails comes back as { ok:false }, and the page keeps
// its hand-picked videos for that spot.
import { VIDEO_LISTS, NAME_FIX } from '../_lib/video-lists.js';

const HOUR = 3600, SHORT_TTL = 30 * 86400;
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const unxml = s => String(s || '').replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, k) => k[0] === '#' ? String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : +k.slice(1)) : (ENT[k] ?? m));

async function fromFeed(playlist) {
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlist)}`, { cf: { cacheTtl: 900 } });
  if (!r.ok) throw new Error('feed ' + r.status);
  const xml = await r.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(([, e]) => ({
    id: (e.match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/) || [])[1],
    title: unxml((e.match(/<title>([\s\S]*?)<\/title>/) || [])[1]),
    published: (e.match(/<published>([^<]+)<\/published>/) || [])[1],
  })).filter(v => v.id && v.published);
}

async function fromApi(playlist, key, fetchN) {
  const out = [];
  let page = '';
  for (let i = 0; i < 6; i++) { // 300 videos is plenty for one playlist
    const u = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=${fetchN ? Math.min(50, fetchN) : 50}&playlistId=${encodeURIComponent(playlist)}&key=${encodeURIComponent(key)}${page ? '&pageToken=' + page : ''}`;
    const r = await fetch(u);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error('api ' + r.status + ' ' + ((j.error && j.error.message) || ''));
    for (const it of j.items || []) {
      const id = it.contentDetails && it.contentDetails.videoId, at = it.contentDetails && it.contentDetails.videoPublishedAt;
      if (id && at) out.push({ id, title: it.snippet.title, published: at }); // private and deleted videos have no publish date
    }
    if (fetchN && out.length >= fetchN) break;
    if (!(page = j.nextPageToken)) break;
  }
  return out;
}

// A Short opens at /shorts/<id>. A regular video gets redirected to /watch. One check per video, kept for 30 days.
async function isShort(id, waitUntil) {
  const cache = caches.default, key = new Request('https://gvo-cache.internal/yt-short/' + id);
  const hit = await cache.match(key);
  if (hit) return (await hit.text()) === '1';
  let short = false, known = true;
  try {
    const r = await fetch('https://www.youtube.com/shorts/' + id, { method: 'HEAD', redirect: 'manual' });
    const to = r.headers.get('Location') || '';
    if (r.status === 200) short = true; else if (!(r.status >= 300 && r.status < 400 && /\/watch\?v=/.test(to))) known = false;
  } catch (e) { known = false; }
  if (known) {
    const p = cache.put(key, new Response(short ? '1' : '0', { headers: { 'Cache-Control': `max-age=${SHORT_TTL}` } }));
    waitUntil ? waitUntil(p) : await p;
  }
  return short; // if YouTube doesn't answer, show the video and check again next hour
}

const fix = s => { const t = String(s || '').replace(/^[\s:–-]+|[\s:.–-]+$/g, '').replace(/\s{2,}/g, ' '); return NAME_FIX[t.toUpperCase()] || t; };
const KINDS = [[/official\s+music\s+video|music\s+video/i, 'Music video'], [/live\s+performance/i, 'Live performance'], [/freestyle/i, 'Freestyle'], [/visuali[sz]er/i, 'Visualizer']];

// "The Garden EP 11: LEX BRATCHER" -> { t: 'Lex Bratcher', s: 'The Garden · Ep. 11' }
// "Flawless Breezyy - Love Me (OFFICIAL MUSIC VIDEO) [Prod. Encore Beats]" -> { t: 'Love Me', s: 'Music video' }
export function label(title, artist) {
  const ep = title.match(/^(.+?)[\s:]*\bep(?:isode)?\.?\s*(\d+)\b[\s:]*(.+)$/i);
  if (ep) {
    const who = fix(ep[3]), show = fix(ep[1]);
    // In an artist's own strip, their name on every tile says nothing, so the show leads instead.
    if (artist && who.toLowerCase() === artist.toLowerCase()) return { t: show, s: `Ep. ${+ep[2]}` };
    return { t: who, s: `${show} · Ep. ${+ep[2]}` };
  }
  let kind = '', rest = title.replace(/\[[^\]]*\]/g, ' ');
  rest = rest.replace(/\(([^)]*)\)/g, (m, inner) => {
    const k = KINDS.find(([re]) => re.test(inner));
    if (k) { kind = kind || k[1]; return ' '; }
    return /^(dir|prod)\b/i.test(inner.trim()) ? ' ' : m;
  });
  if (!kind) { const k = KINDS.find(([re]) => re.test(rest)); if (k) { kind = k[1]; rest = rest.replace(k[0], ' '); } }
  rest = rest.replace(/\s+ft\.?\s+([^()\[\]-]+?)\s*$/i, ' (feat. $1)').replace(/\s+ft\.?\s+([^()\[\]-]+?)(?=\s+-\s)/i, ' (feat. $1)');
  const parts = rest.split(/\s*-\s+/);
  let t, by = '';
  if (parts.length > 1) {
    const who = fix(parts[0]), song = fix(parts.slice(1).join(' - '));
    if (!artist) t = `${who}, ${song}`;
    else {
      t = song;
      const esc = artist.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const other = who.replace(new RegExp(`\\(\\s*(feat\\.?|ft\\.?)\\s*${esc}\\s*\\)`, 'i'), '')
        .replace(new RegExp(`^${esc}\\s*(x|&|and|,)\\s*|\\s*(x|&|and|,)\\s*${esc}$|^${esc}$`, 'i'), '').replace(/^@/, '').trim();
      if (other) by = 'With ' + other;
      t = t.replace(new RegExp(`\\s*\\(\\s*(feat\\.?|ft\\.?)\\s*${esc}\\s*\\)`, 'i'), '');
    }
  } else t = fix(rest);
  t = t.replace(/\((feat|ft)\.?\s/gi, '(feat. ');
  return { t, s: [kind, by].filter(Boolean).join(' · ') };
}

async function build(env, waitUntil) {
  const key = env.YOUTUBE_API_KEY;
  const raw = await Promise.all(VIDEO_LISTS.map(async l => {
    try {
      const vids = key ? await fromApi(l.playlist, key, l.fetch) : (await fromFeed(l.playlist)).slice(0, l.fetch || 99);
      return { l, ok: true, vids };
    } catch (e) { console.log('videos: playlist failed', l.key, e && e.message); return { l, ok: false, vids: [] }; }
  }));
  // A video an artist playlist claims is shown only in that artist's strip.
  const claimed = {};
  for (const { l, ok, vids } of raw) if (ok) for (const k of l.takesFrom || []) for (const v of vids) (claimed[k] = claimed[k] || new Set()).add(v.id);

  const ids = [...new Set(raw.filter(x => !x.l.noShorts).flatMap(x => x.vids.map(v => v.id)))];
  const shorts = new Set();
  await Promise.all(ids.map(async id => { if (await isShort(id, waitUntil)) shorts.add(id); }));

  const lists = {};
  for (const { l, ok, vids } of raw) {
    const seen = new Set();
    const videos = vids
      .filter(v => !shorts.has(v.id) && !(claimed[l.key] && claimed[l.key].has(v.id)) && !seen.has(v.id) && seen.add(v.id))
      .sort((a, b) => Date.parse(b.published) - Date.parse(a.published))
      .slice(0, l.max || 12)
      .map(v => ({ id: v.id, title: v.title, published: v.published, ...label(v.title, l.artist) }));
    lists[l.key] = { ok: ok && videos.length > 0, artist: l.artist || null, label: l.label || null, playlist: l.playlist, videos };
  }
  return { ok: true, source: key ? 'api' : 'feed', checked: new Date().toISOString(), lists };
}

export async function onRequestGet({ request, env, waitUntil }) {
  const cache = caches.default;
  const url = new URL(request.url), fresh = url.searchParams.has('fresh');
  // Bump the version when VIDEO_LISTS changes, so every edge drops its old copy at once.
  const key = new Request(url.origin + '/api/videos?v=2');
  if (!fresh) { const hit = await cache.match(key); if (hit) return hit; }
  let body;
  try { body = await build(env, waitUntil); } catch (e) { body = { ok: false, lists: {} }; }
  const allOk = body.ok && VIDEO_LISTS.every(l => body.lists[l.key] && body.lists[l.key].ok);
  // A full answer keeps for an hour. If a playlist failed, try again in 5 minutes.
  const res = new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${allOk ? HOUR : 300}` } });
  const p = cache.put(key, res.clone());
  waitUntil ? waitUntil(p) : await p;
  return res;
}
