// Reads GVO's Square catalog once a minute and shapes it for the site:
// the shop (the 27 items that came from Wix Stores) and the bookable studio services.
import { sq, cfg, allPages, cents } from './square.js';
import { SITE_PRODUCTS, PINNED, OLD_ITEM_PATTERNS } from './site-products.js';

const TTL = 60e3;
let memo = null; // { at, data } per isolate

// Items created in Square before this date are the older Square merch. The 27 Wix items were added Oct 2026.
const DEFAULT_SINCE = '2026-10-20T00:00:00Z';

export async function loadCatalog(env, { fresh = false } = {}) {
  if (!fresh && memo && Date.now() - memo.at < TTL) return memo.data;
  const data = await build(env);
  memo = { at: Date.now(), data };
  return data;
}

async function build(env) {
  const { locationId } = cfg(env);
  const types = 'ITEM,ITEM_OPTION,IMAGE,CATEGORY,DISCOUNT,PRICING_RULE,PRODUCT_SET,TAX';
  const objects = await allPages(async cursor => {
    const q = new URLSearchParams({ types }); if (cursor) q.set('cursor', cursor);
    const r = await sq(env, 'GET', '/v2/catalog/list?' + q);
    return { items: r.objects || [], cursor: r.cursor };
  });
  const byId = new Map(objects.map(o => [o.id, o]));
  const atLoc = o => o && !o.is_deleted && (o.present_at_all_locations !== false
    ? !(o.absent_at_location_ids || []).includes(locationId)
    : (o.present_at_location_ids || []).includes(locationId));

  const items = objects.filter(o => o.type === 'ITEM' && atLoc(o) && !(o.item_data && o.item_data.is_archived));
  const merch = items.filter(o => !o.item_data.product_type || o.item_data.product_type === 'REGULAR');
  const services = items.filter(o => o.item_data.product_type === 'APPOINTMENTS_SERVICE');

  const discounts = activeDiscounts(objects, byId);
  const shop = buildShop(env, merch, byId, atLoc, discounts);
  const svc = buildServices(services, atLoc);
  return { shop, services: svc, byId, at: new Date().toISOString() };
}

/* ---------- discounts: automatic pricing rules, for display only. Square applies the real ones at checkout. ---------- */
function activeDiscounts(objects, byId) {
  const today = new Date().toISOString().slice(0, 10);
  const rules = [];
  for (const o of objects) {
    if (o.type !== 'PRICING_RULE' || o.is_deleted) continue;
    const r = o.pricing_rule_data || {};
    if (r.valid_from_date && r.valid_from_date > today) continue;
    if (r.valid_until_date && r.valid_until_date < today) continue;
    const d = byId.get(r.discount_id);
    const dd = d && d.discount_data;
    if (!dd) continue;
    const set = byId.get(r.apply_products_id || r.match_products_id);
    const ids = new Set(); let all = false;
    const walk = (s, depth) => {
      if (!s || depth > 3) return;
      const p = s.product_set_data || {};
      if (p.all_products) all = true;
      for (const id of [...(p.product_ids_any || []), ...(p.product_ids_all || [])]) {
        const x = byId.get(id);
        if (x && x.type === 'PRODUCT_SET') walk(x, depth + 1); else ids.add(id);
      }
    };
    walk(set, 0);
    const exclude = new Set();
    const ex = byId.get(r.exclude_products_id);
    if (ex && ex.product_set_data) (ex.product_set_data.product_ids_any || []).forEach(id => exclude.add(id));
    rules.push({ name: dd.name || r.name || '', type: dd.discount_type, pct: Number(dd.percentage || 0), amount: cents(dd.amount_money), ids, all, exclude });
  }
  return rules;
}

function salePrice(base, itemId, varId, catIds, rules) {
  let best = base;
  for (const r of rules) {
    const hit = r.all || r.ids.has(itemId) || r.ids.has(varId) || catIds.some(c => r.ids.has(c));
    if (!hit || r.exclude.has(itemId) || r.exclude.has(varId)) continue;
    let p = base;
    if (r.type === 'FIXED_PERCENTAGE') p = base - Math.round(base * r.pct / 100);
    else if (r.type === 'FIXED_AMOUNT') p = Math.max(0, base - r.amount);
    else continue;
    if (p < best) best = p;
  }
  return best;
}

/* ---------- shop ---------- */
const norm = s => String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/\bgrey\b/g, 'gray').replace(/[^a-z0-9]+/g, ' ').trim();
const toks = s => norm(s).split(' ').filter(Boolean);
function sim(a, b) {
  const A = norm(a), Bn = norm(b);
  if (!A || !Bn) return 0;
  if (A === Bn) return 1;
  const ta = new Set(toks(a)), tb = new Set(toks(b));
  let both = 0; ta.forEach(t => { if (tb.has(t)) both++; });
  return (2 * both) / (ta.size + tb.size);
}
const SIZE_RE = /^(xxs|xs|s|m|l|xl|xxl|xxxl|[2-6]xl|small|medium|large|x-?large|xx-?large|one size|os|o\/s|\d{1,2})$/i;
const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
const sizeFix = v => {
  const k = String(v).trim().toLowerCase().replace(/-/g, '');
  const m = { small: 'S', medium: 'M', large: 'L', xlarge: 'XL', xxlarge: '2XL', xxl: '2XL', xxxl: '3XL' };
  return m[k] || String(v).trim().toUpperCase();
};
const COLORS = ['black', 'white', 'gray', 'pink', 'navy', 'blue', 'light blue', 'navy blue', 'olive', 'tan', 'purple', 'cream', 'beige', 'khaki', 'brown', 'maroon', 'mustard', 'pearl', 'red', 'green'];

function category(name) {
  const n = norm(name);
  if (/\b(hoodie|jacket|crewneck|sweatshirt|coat)\b/.test(n)) return 'Cold weather';
  if (/\b(pants|shorts|bottoms?|joggers?|sweatpants)\b/.test(n)) return 'Bottoms';
  if (/\b(beanie|hat|cap|mask|durag)\b/.test(n)) return 'Headwear';
  return 'Shirts';
}
const slug = s => norm(s).replace(/ /g, '-').slice(0, 60);

// Reads options for one Square item: titles (Size, Color) and each variation's values in that order.
function optionsOf(item, byId) {
  const vars = item.item_data.variations || [];
  const optIds = (item.item_data.item_options || []).map(x => x.item_option_id).filter(id => byId.get(id));
  if (optIds.length) {
    const titles = optIds.map(id => { const d = byId.get(id).item_option_data || {}; return d.display_name || d.name || 'Option'; });
    const valName = new Map();
    optIds.forEach(id => (byId.get(id).item_option_data.values || []).forEach(v => valName.set(v.id, (v.item_option_value_data || {}).name || '')));
    const rows = vars.map(v => {
      const sel = (v.item_variation_data.item_option_values || []);
      return optIds.map(oid => { const s = sel.find(x => x.item_option_id === oid); return s ? valName.get(s.item_option_value_id) || '' : ''; });
    });
    return { titles, rows };
  }
  // No item options: split variation names like "M / Black", "M, Black" or "Medium".
  const split = vars.map(v => String(v.item_variation_data.name || '').split(/\s*[\/,|]\s*|\s+-\s+/).map(s => s.trim()).filter(Boolean));
  const n = Math.max(0, ...split.map(s => s.length));
  if (!n || (vars.length === 1 && /^regular$/i.test(split[0].join(' ')))) return { titles: [], rows: vars.map(() => []) };
  const titles = [];
  for (let i = 0; i < n; i++) {
    const col = split.map(s => s[i] || '');
    titles.push(col.every(x => !x || SIZE_RE.test(x)) ? 'Size' : col.every(x => !x || COLORS.includes(norm(x))) ? 'Color' : (i === 0 ? 'Option' : 'Style'));
  }
  return { titles, rows: split.map(s => titles.map((_, i) => s[i] || '')) };
}

function buildShop(env, merch, byId, atLoc, rules) {
  const pinned = Object.keys(PINNED);
  const envIds = String(env.SHOP_ITEM_IDS || '').split(/[\s,]+/).filter(Boolean);
  const allow = envIds.length ? new Set(envIds) : pinned.length ? new Set(pinned) : null;
  const since = env.SHOP_SINCE || DEFAULT_SINCE;
  const hasCreated = merch.some(o => o.created_at);
  const report = [];

  const picked = merch.filter(o => {
    const name = o.item_data.name || '';
    let why;
    if (allow) why = allow.has(o.id) ? '' : 'not in pinned list';
    else if (hasCreated) why = o.created_at >= since ? '' : 'created ' + o.created_at.slice(0, 10) + ', before the Wix move';
    else why = OLD_ITEM_PATTERNS.some(re => re.test(name.trim())) ? 'older Square item (name rule)' : '';
    report.push({ id: o.id, name, created: o.created_at || null, included: !why, why: why || 'Wix item' });
    return !why;
  });

  // Match each Square item to the site page that carries its photos.
  const cands = [];
  for (const o of picked) for (const sp of SITE_PRODUCTS) {
    let s = 0; for (const a of sp.a) s = Math.max(s, sim(o.item_data.name, a));
    if (sp.color) { const n = norm(o.item_data.name); if (n.includes(norm(sp.color))) s += .15; else if (COLORS.some(c => c !== norm(sp.color) && n.split(' ').includes(c))) s -= .4; }
    if (s >= .5) cands.push({ o, sp, s });
  }
  cands.sort((a, b) => b.s - a.s);
  const usedItem = new Map(), usedSite = new Set();
  for (const c of cands) {
    if (PINNED[c.o.id] && PINNED[c.o.id] !== c.sp.id) continue;
    if (usedSite.has(c.sp.id)) continue;
    const list = usedItem.get(c.o.id);
    if (!list) { usedItem.set(c.o.id, [c]); usedSite.add(c.sp.id); continue; }
    // A second page for the same item only when both pages are one color of it (World Tour Tee black and white).
    if (c.sp.color && list.every(x => x.sp.color) && c.s >= list[0].s - .05) { list.push(c); usedSite.add(c.sp.id); }
  }
  for (const [itemId, siteId] of Object.entries(PINNED)) {
    const o = picked.find(x => x.id === itemId), sp = SITE_PRODUCTS.find(x => x.id === siteId);
    if (o && sp && !usedItem.has(itemId)) { usedItem.set(itemId, [{ o, sp, s: 1 }]); usedSite.add(siteId); }
  }

  const products = [];
  for (const o of picked) {
    const d = o.item_data;
    const { titles, rows } = optionsOf(o, byId);
    const catIds = [...(d.categories || []).map(c => c.id), d.category_id].filter(Boolean);
    const matches = usedItem.get(o.id) || [];
    const colorIdx = titles.findIndex(t => /colou?r/i.test(t));
    const groups = matches.length > 1 && colorIdx >= 0
      ? matches.map(m => ({ m, keep: r => norm(r[colorIdx]) === norm(m.sp.color) }))
      : [{ m: matches[0], keep: () => true }];
    const sqImgs = (d.image_ids || [o.image_id]).filter(Boolean).map(id => byId.get(id)).filter(Boolean).map(x => x.image_data && x.image_data.url).filter(Boolean);

    for (const g of groups) {
      const vars = [];
      (d.variations || []).forEach((v, i) => {
        const vd = v.item_variation_data || {};
        if (!atLoc(v) || !rows[i] || !g.keep(rows[i])) return;
        if (vd.pricing_type === 'VARIABLE_PRICING' || !vd.price_money) return;
        const ov = (vd.location_overrides || []).find(x => x.location_id === cfg(env).locationId) || {};
        const base = cents(vd.price_money);
        let vals = rows[i].map((x, k) => /size/i.test(titles[k] || '') ? sizeFix(x) : x);
        if (g.m && matches.length > 1 && colorIdx >= 0) vals = vals.filter((_, k) => k !== colorIdx);
        vars.push({
          id: v.id, key: vals.join('/') || '-', base, sale: salePrice(base, o.id, v.id, catIds, rules),
          track: ov.track_inventory != null ? ov.track_inventory : !!vd.track_inventory,
          soldOut: !!ov.sold_out, ord: vd.ordinal || i,
        });
      });
      if (!vars.length) continue;
      const tl = (g.m && matches.length > 1 && colorIdx >= 0) ? titles.filter((_, k) => k !== colorIdx) : titles;
      const o2 = tl.map((t, k) => {
        const seen = []; vars.forEach(v => { const x = v.key.split('/')[k]; if (x && !seen.includes(x)) seen.push(x); });
        if (/size/i.test(t)) seen.sort((a, b) => (SIZE_ORDER.indexOf(a) + 1 || 99) - (SIZE_ORDER.indexOf(b) + 1 || 99));
        return { t: /size/i.test(t) ? 'Size' : /colou?r/i.test(t) ? 'Color' : t, v: seen };
      }).filter(x => x.v.length);
      products.push({
        id: g.m ? g.m.sp.id : 'sq-' + slug(d.name),
        siteId: g.m ? g.m.sp.id : null,
        match: g.m ? Math.round(g.m.s * 100) / 100 : 0,
        itemId: o.id,
        name: d.name,
        desc: d.description_plaintext || '',
        cat: category(d.name),
        img: sqImgs,
        o: o2,
        vars,
      });
    }
  }
  return { products, report, rule: allow ? (envIds.length ? 'SHOP_ITEM_IDS' : 'pinned list') : hasCreated ? 'created on or after ' + since.slice(0, 10) : 'name rules' };
}

/* ---------- services ---------- */
function classify(name) {
  const n = norm(name);
  if (/holiday|christmas|xmas|santa/.test(n)) return 'holiday';
  if (/podcast|video|content|commercial/.test(n)) return 'pod';
  if (/photo|shoot|backdrop/.test(n)) return 'photo';
  if (/record|recording|session|sound|engineer|mix|vocal|studio/.test(n)) return 'rec';
  return null;
}
function buildServices(services, atLoc) {
  const out = [];
  for (const o of services) {
    const d = o.item_data;
    for (const v of d.variations || []) {
      const vd = v.item_variation_data || {};
      if (!atLoc(v) || vd.available_for_booking === false) continue;
      const mins = Math.round((vd.service_duration || 0) / 60000);
      const full = d.name + (vd.name && !/^regular$/i.test(vd.name) ? ' · ' + vd.name : '');
      out.push({
        id: v.id, version: v.version, itemId: o.id, name: full,
        kind: classify(full) || classify(d.name), mins, hrs: Math.round(mins / 30) / 2,
        price: vd.pricing_type === 'FIXED_PRICING' ? cents(vd.price_money) : (vd.price_money ? cents(vd.price_money) : null),
        variable: vd.pricing_type !== 'FIXED_PRICING',
        team: vd.team_member_ids || [],
      });
    }
  }
  return out;
}
