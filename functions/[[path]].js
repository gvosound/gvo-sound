// Clean page links for sharing: gvosound.com/events, /travel, /shop/<product>, /music/<song> and the rest.
//
// Texting apps, Instagram and search engines never see anything after a "#", so every /#page link
// showed the homepage preview. For a path listed in /og/pages.json (built by og-src/build.cjs), this
// serves the normal site with that page's title, description and preview image in the <head>, plus a
// one-line script that moves the browser to the /#page it uses. Any other path falls through untouched.
// Which paths reach this file is set in _routes.json.

let cache = null; // pages.json, kept for a minute per worker
async function pages(env, origin) {
  if (cache && Date.now() - cache.at < 60e3) return cache.v;
  const r = await env.ASSETS.fetch(new URL('/og/pages.json', origin));
  const v = r.ok ? await r.json() : {};
  cache = { at: Date.now(), v };
  return v;
}

const attr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

export async function onRequest({ request, env, next }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') return next();
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  if (path === '/') return next();
  let m;
  try { m = (await pages(env, url.origin))[path]; } catch (e) { m = null; }
  if (!m) return next();

  const page = await env.ASSETS.fetch(new URL('/', url.origin));
  const abs = u => new URL(u, url.origin).href;
  const set = (sel, a, v) => [sel, { element(el) { el.setAttribute(a, v); } }];
  const rules = [
    ['title', { element(el) { el.setInnerContent(m.title); } }],
    set('meta[name="description"]', 'content', m.desc),
    set('link[rel="canonical"]', 'href', abs(path)),
    set('meta[property="og:url"]', 'content', abs(path)),
    set('meta[property="og:title"]', 'content', m.title),
    set('meta[property="og:description"]', 'content', m.desc),
    set('meta[property="og:image"]', 'content', abs(m.image)),
    set('meta[property="og:image:alt"]', 'content', m.alt || m.title),
    set('meta[name="twitter:image"]', 'content', abs(m.image)),
    // Before the site's script runs: show this page in the address bar the way the site routes it.
    ['head', { element(el) { el.prepend(`<script>if(!location.hash)history.replaceState(null,'','/'+location.search+'#${attr(m.route)}')</script>`, { html: true }); } }],
  ];
  let rw = new HTMLRewriter();
  for (const [sel, h] of rules) rw = rw.on(sel, h);
  const res = rw.transform(page);
  const out = new Response(res.body, res);
  out.headers.set('Cache-Control', 'no-cache');
  out.headers.delete('Content-Length');
  return out;
}
