// GET /api/shop: the merch that came from Wix Stores, with live price, sale price, options and stock from Square.
// GET /api/shop?debug=1 also lists every Square item with why it was kept or left out, and which site page it matched.
import { json, fail } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { stockFor } from '../_lib/orders.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const debug = url.searchParams.has('debug');
  try {
    const cat = await loadCatalog(env, { fresh: debug });
    const tracked = cat.shop.products.flatMap(p => p.vars.filter(v => v.track).map(v => v.id));
    const counts = tracked.length ? await stockFor(env, tracked) : new Map();
    const products = cat.shop.products.map(p => {
      const vs = p.vars.slice().sort((a, b) => a.ord - b.ord);
      const qty = v => v.soldOut ? 0 : v.track ? (counts.get(v.id) || 0) : null; // null: not tracked, always sellable
      const base = Math.min(...vs.map(v => v.base)), sale = Math.min(...vs.map(v => v.sale));
      return {
        id: p.id, siteId: p.siteId, n: p.name, cat: p.cat, d: p.desc, img: p.img, o: p.o,
        p: base / 100, s: sale < base ? sale / 100 : undefined,
        vars: Object.fromEntries(vs.map(v => [v.key, { id: v.id, p: v.base / 100, s: v.sale < v.base ? v.sale / 100 : undefined, q: qty(v) }])),
        av: vs.filter(v => qty(v) === null || qty(v) > 0).map(v => v.key),
      };
    });
    const body = { ok: true, at: cat.at, count: products.length, products };
    if (debug) {
      body.debug = {
        rule: cat.shop.rule,
        items: cat.shop.report.map(r => ({ ...r, pages: cat.shop.products.filter(x => x.itemId === r.id).map(x => ({ page: x.siteId || 'none, uses the Square photo', match: x.match, variations: x.vars.length, squareSale: x.squareSale })) })),
        discountRules: cat.rules,
        services: cat.services.map(s => ({ id: s.id, name: s.name, kind: s.kind || 'not used on the site', hours: s.hrs, price: s.price == null ? null : s.price / 100, team: s.team.length })),
        unmatchedSitePages: (await import('../_lib/site-products.js')).SITE_PRODUCTS.map(s => s.id).filter(id => !products.some(p => p.siteId === id)),
      };
    }
    return json(body, 200, debug ? {} : { 'Cache-Control': 'public, max-age=30' });
  } catch (err) {
    return fail(err, 'The shop could not load from Square.');
  }
}
