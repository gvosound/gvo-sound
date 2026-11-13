// Builds GVO's link previews: one 1200 x 630 JPEG per page, product and song in /og, plus /og/pages.json,
// which functions/[[path]].js reads to give each clean link (gvosound.com/events) its own title,
// description and image. Run from this folder: npm install, then npm run build. Commit /og afterwards.
//
// Page headlines and photos are in PAGES below. Titles and descriptions come from META in index.html,
// and products and songs come from PRODUCTS, PHOTOS and REL there, so a new product or song only needs
// a rebuild. Playwright must be installed (it is in the Claude workspace).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'img');
const OUT = path.join(ROOT, 'og');
const NM = path.join(__dirname, 'node_modules');
const SRC = path.join(__dirname, 'src');

// h: headline lines; a line starting with ~ is drawn in the lavender outline. img: a file in /img (no
// extension) or src/<file> for photos kept only for previews. grid: several /img covers as tiles.
const PAGES = {
  home: { route: 'home', img: 'booth_dark', eb: 'Annapolis, MD · Open 24/7', h: ['Your Vision.', '~Your Sound.'], fs: 84, sub: 'Recording, photo and content studios on Gibralter Ave.', alt: 'GVO Sound vocal booth' },
  'recording-studio': { route: 'recording-studio', img: 'src/recording-room.jpg', pos: 'center 62%', eb: 'Recording studio', h: ['Record.', 'Mix.', '~Repeat.'], sub: 'An engineer sits in on every session, and the mix is in the rate.', alt: 'The GVO Sound control room' },
  'photo-studio': { route: 'photo-studio', img: 'photo_cyc', eb: 'Photo studio', h: ['Portraits.', 'Product.', '~Promo.'], sub: 'Rent the lit room by the hour, or book a GVO photographer with it.', alt: 'The GVO Sound photo studio' },
  'content-studio': { route: 'content-studio', img: 'pod_set', pos: '60% center', eb: 'Content studio', h: ['Podcasts.', 'Voiceovers.', '~Commercials.'], sub: "Bring your crew, or let GVO's video team shoot and edit.", alt: 'A podcast taping at GVO Sound' },
  book: { route: 'book', img: 's_mic', eb: 'Open 24/7 by appointment', h: ['Book a', '~Session.'], fs: 84, sub: 'Pick the studio, the length, your engineer and a start time.', alt: 'The vocal mic at GVO Sound' },
  music: { route: 'music', grid: ['c_holy', 'c_ride', 'c_sixteen', 'c_need', 'c_wont', 'c_yousaid'], eb: 'Stream it', h: ['Recorded', '~at GVO.'], fs: 84, sub: 'Flawless Breezyy, Mannywellz and the artists who record on Gibralter Ave.', alt: 'Covers of songs recorded at GVO Sound' },
  events: { route: 'events', img: 'src/party-crowd.jpg', pos: '55% center', eb: 'GVO Sound presents', h: ['R&amp;B Nights.', 'Rooftops.', '~County vs. City.'], sub: 'Annapolis, Glen Burnie and Baltimore.', alt: 'The crowd at a GVO Sound party' },
  travel: { route: 'travel', grid: ['ig_tr_dc7jx4cnj6x', 'ig_tr_ddrm_vat4fm', 'ig_tr_dyzmwk0fobg'], eb: '{BEEN} countries and territories', h: ['Group Trips.', 'Private Trips.', '~Custom Plans.'], sub: 'First-time travelers welcome.', alt: 'GVO Sound group trips to Tokyo, Puerto Rico and Korea' },
  shop: { route: 'shop', img: 'lounge', eb: 'GVO apparel', h: ['The', '~Rack.'], fs: 96, sub: 'Designed in Annapolis. Ship it, or pick it up at the studio.', alt: 'The GVO Sound shop at the studio' },
};

// Previews for pages outside the main site (no clean link, not in pages.json). The page sets its own og tags.
const EXTRA = {
  team: { img: 'photo_cyc', eb: 'For the GVO team', h: ['Rates.', 'Hours.', '~Bookings.'], sub: 'Photographers and videographers: update your info for gvosound.com.', alt: 'The GVO Sound photo studio' },
};
// ONLY=team npm run build draws just that preview and leaves the rest of /og alone.
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null;

const fileUrl = f => 'file://' + f;
function imgUrl(n) {
  if (n.startsWith('src/')) return fileUrl(path.join(__dirname, n));
  const f = fs.readdirSync(IMG).find(x => x === n + '.webp' || x === n + '.png' || x === n + '.jpg');
  if (!f) throw new Error('No image ' + n);
  return fileUrl(path.join(IMG, f));
}
const esc = s => String(s).replace(/&(?!amp;)/g, '&amp;').replace(/</g, '&lt;');

const CSS = `
@font-face{font-family:Archivo;src:url(${fileUrl(NM)}/@fontsource-variable/archivo/files/archivo-latin-wdth-normal.woff2) format('woff2');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:Hanken;src:url(${fileUrl(NM)}/@fontsource/hanken-grotesk/files/hanken-grotesk-latin-500-normal.woff2);font-weight:500}
@font-face{font-family:Mono;src:url(${fileUrl(NM)}/@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2);font-weight:600}
*{box-sizing:border-box;margin:0}
html,body{width:1200px;height:630px;background:#07060a;overflow:hidden}
.c{position:relative;width:1200px;height:630px;background:#07060a;color:#f1efea;font-family:Hanken}
.ph{position:absolute;top:0;right:0;bottom:0;width:660px;overflow:hidden}
.ph img.full{width:100%;height:100%;object-fit:cover;display:block}
.ph::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,#07060a 0%,rgba(7,6,10,.82) 16%,rgba(7,6,10,.15) 46%,rgba(7,6,10,0) 70%),linear-gradient(0deg,rgba(7,6,10,.55),rgba(7,6,10,0) 35%)}
.grid{position:absolute;inset:0;display:grid;gap:10px;padding:34px 34px 34px 120px}
.grid img{width:100%;height:100%;object-fit:cover;border-radius:6px;display:block}
.t{position:absolute;left:64px;top:0;bottom:0;width:640px}
.g .t{width:540px}
.mark{position:absolute;top:48px;left:0;height:84px;width:auto}
.mid{position:absolute;left:0;right:0;top:150px;bottom:92px;display:flex;flex-direction:column;justify-content:center}
.eb{font:600 20px/1 Mono;letter-spacing:.2em;text-transform:uppercase;color:#b9b2ff;margin-bottom:22px;display:flex;align-items:center;gap:14px}
.eb::before{content:"";width:34px;height:2px;background:#b9b2ff}
h1{font-family:Archivo;font-weight:900;font-stretch:125%;text-transform:uppercase;line-height:.9;letter-spacing:-.01em;font-size:var(--fs,74px)}
h1 span{display:block;white-space:nowrap}
h1 .o{color:transparent;-webkit-text-stroke:2.4px #b9b2ff}
.sub{margin-top:26px;font-size:28px;line-height:1.35;color:#cfc9da;max-width:540px}
.ft{position:absolute;left:0;bottom:50px;font:600 17px/1 Mono;letter-spacing:.16em;text-transform:uppercase;color:#8d86a0}
.sq .ph{width:630px}
.sq .ph::after{background:linear-gradient(90deg,#07060a 0%,rgba(7,6,10,.5) 10%,rgba(7,6,10,0) 30%)}
.sq .t{width:560px}
.cover .ph{top:60px;bottom:60px;right:60px;width:510px;border-radius:10px;box-shadow:0 30px 80px rgba(0,0,0,.6)}
.cover .ph::after{display:none}
`;

function cardHtml(c) {
  let ph = '';
  if (c.img) ph = `<div class="ph"><img class="full" src="${imgUrl(c.img)}" style="object-position:${c.pos || 'center'}"></div>`;
  if (c.grid) { const cols = c.cols || 3; ph = `<div class="ph"><div class="grid" style="grid-template-columns:repeat(${cols},1fr);grid-template-rows:repeat(${Math.ceil(c.grid.length / cols)},1fr)">${c.grid.map(g => `<img src="${imgUrl(g)}">`).join('')}</div></div>`; }
  const h = c.h.map(l => l.startsWith('~') ? `<span class="o">${l.slice(1)}</span>` : `<span>${l}</span>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style></head><body><div class="c ${c.cls || ''} ${c.grid ? 'g' : ''}">${ph}
  <div class="t"><img class="mark" src="${imgUrl('gvo-mark')}"><div class="mid"><div class="eb">${c.eb}</div><h1 style="--fs:${c.fs || 74}px">${h}</h1>${c.sub ? `<p class="sub">${c.sub}</p>` : ''}</div>
  <div class="ft">${c.ft || 'gvosound.com · Annapolis, MD'}</div></div></div></body></html>`;
}

// Reads the site's own data by loading index.html with the network blocked.
async function siteData(browser) {
  const pg = await browser.newPage();
  await pg.route('**/*', r => {
    const u = new URL(r.request().url());
    if (u.protocol === 'file:' && u.pathname.endsWith('index.html')) return r.continue();
    return r.abort();
  });
  await pg.goto(fileUrl(path.join(ROOT, 'index.html')));
  await pg.waitForFunction(() => typeof window.GVO_DATA === 'function');
  const d = await pg.evaluate(() => { const { META, PRODUCTS, PHOTOS, REL, BEEN } = window.GVO_DATA(); return {
    META, BEEN: BEEN.length,
    products: PRODUCTS.map(p => ({ id: p.id, n: p.n, img: (PHOTOS[p.id] && PHOTOS[p.id][0] && PHOTOS[p.id][0][0]) || p.img[0] })),
    songs: REL.map(r => ({ id: r.id, t: r.t, a: r.a, c: r.c })),
  }; });
  await pg.close();
  return d;
}

// Splits a product name over two headline lines, the second in outline.
function twoLines(name) {
  const w = name.replace(/,/g, '').split(/\s+/);
  if (w.length === 1) return [esc(w[0])];
  let best = 1, diff = 1e9;
  for (let i = 1; i < w.length; i++) { const d = Math.abs(w.slice(0, i).join(' ').length - w.slice(i).join(' ').length); if (d < diff) { diff = d; best = i; } }
  return [esc(w.slice(0, best).join(' ')), '~' + esc(w.slice(best).join(' '))];
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const site = await siteData(browser);
  const jobs = []; // [file, card, meta]
  for (const [k, c] of Object.entries(PAGES)) {
    const m = site.META[c.route];
    const card = { ...c, eb: c.eb.replace('{BEEN}', site.BEEN) };
    jobs.push([k, card, { path: m.path, route: c.route, title: m.title, desc: m.desc, alt: c.alt }]);
  }
  for (const p of site.products) {
    const m = site.META['product-' + p.id];
    if (!m || !p.img) continue;
    jobs.push(['shop-' + p.id, { cls: 'sq', img: p.img, eb: 'GVO apparel', h: twoLines(p.n), fs: 64, sub: 'Ship it, or pick it up at 109 Gibralter Ave.' },
      { path: m.path, route: 'product-' + p.id, title: m.title, desc: m.desc, alt: p.n + ' by GVO Sound' }]);
  }
  for (const s of site.songs) {
    const m = site.META['music/' + s.id];
    if (!m || !s.c) continue;
    jobs.push(['music-' + s.id, { cls: 'sq cover', img: s.c, eb: 'Recorded at GVO', h: [esc(s.t)], fs: 64, sub: esc(s.a), ft: 'Stream it on gvosound.com' },
      { path: m.path, route: 'music/' + s.id, title: m.title, desc: m.desc, alt: `${s.t} by ${s.a}, cover art` }]);
  }

  for (const [k, c] of Object.entries(EXTRA)) jobs.push([k, c, null]);
  if (ONLY) jobs.splice(0, jobs.length, ...jobs.filter(j => ONLY.includes(j[0])));

  const pg = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  const tmp = path.join(__dirname, '.card.html');
  const pages = {};
  for (const [k, card, meta] of jobs) {
    fs.writeFileSync(tmp, cardHtml(card));
    await pg.goto(fileUrl(tmp));
    await pg.evaluate(() => document.fonts.ready);
    await pg.waitForTimeout(120);
    // Shrink the headline until every line fits its column.
    await pg.evaluate(() => { const h = document.querySelector('h1'), m = document.querySelector('.mid'); let fs = parseFloat(getComputedStyle(h).fontSize);
      while ((h.scrollWidth > h.clientWidth + 1 || m.scrollHeight > m.clientHeight + 1) && fs > 36) { fs -= 2; h.style.fontSize = fs + 'px'; } });
    await pg.screenshot({ path: path.join(OUT, k + '.jpg'), type: 'jpeg', quality: 84 });
    if (!meta) continue;
    pages[meta.path] = { route: meta.route, title: meta.title, desc: meta.desc, image: '/og/' + k + '.jpg', alt: meta.alt };
  }
  fs.unlinkSync(tmp);
  if (!ONLY) fs.writeFileSync(path.join(OUT, 'pages.json'), JSON.stringify(pages, null, 1) + '\n');
  await browser.close();
  console.log(jobs.length + ' previews written to /og');
})();
