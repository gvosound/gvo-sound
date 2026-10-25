// Builds Square orders for the shop and for studio bookings. Prices, discounts and tax all come from Square:
// lines point at catalog ids, and pricing_options turns on the automatic discounts and the item taxes.
import { sq, cfg, money, cents, clean, e164 } from './square.js';

export const SHIPPING = {
  US: { cents: 999, label: 'Standard shipping, 3 to 5 business days' },
  INTL: { cents: 1599, label: 'International standard shipping' },
  PICKUP: { cents: 0, label: 'Free pickup at 109 Gibralter Ave, Annapolis' },
};

export function badRequest(msg) { const e = new Error(msg); e.status = 400; e.userMessage = msg; return e; }

// Every shop variation the site may sell, by Square variation id.
export function shopIndex(catalog) {
  const m = new Map();
  for (const p of catalog.shop.products) for (const v of p.vars) m.set(v.id, { p, v });
  return m;
}

export async function stockFor(env, ids) {
  const { locationId } = cfg(env);
  const out = new Map();
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    let cursor;
    do {
      const r = await sq(env, 'POST', '/v2/inventory/counts/batch-retrieve', { catalog_object_ids: chunk, location_ids: [locationId], states: ['IN_STOCK'], cursor });
      for (const c of r.counts || []) out.set(c.catalog_object_id, (out.get(c.catalog_object_id) || 0) + Number(c.quantity || 0));
      cursor = r.cursor;
    } while (cursor);
  }
  return out;
}

// lines: [{v: variationId, q}] from the browser. Returns Square line items, checked against the shop list and stock.
export async function shopLines(env, catalog, lines, { checkStock = true } = {}) {
  if (!Array.isArray(lines) || !lines.length) return [];
  if (lines.length > 30) throw badRequest('That bag is too big for one order. Call or text the studio.');
  const idx = shopIndex(catalog);
  const merged = new Map();
  for (const l of lines) {
    const q = Math.floor(Number(l && l.q));
    if (!idx.has(l && l.v) || !(q >= 1 && q <= 20)) throw badRequest('Something in your bag is no longer for sale. Refresh the page and try again.');
    merged.set(l.v, (merged.get(l.v) || 0) + q);
  }
  if (checkStock) {
    const tracked = [...merged.keys()].filter(id => idx.get(id).v.track);
    const counts = tracked.length ? await stockFor(env, tracked) : new Map();
    for (const [id, q] of merged) {
      const { p, v } = idx.get(id);
      const have = v.track ? (counts.get(id) || 0) : Infinity;
      if (v.soldOut || have < q) {
        const name = p.name + (v.key !== '-' ? ' (' + v.key.split('/').join(', ') + ')' : '');
        throw badRequest(have > 0 && have < q ? `Only ${have} left of ${name}. Lower the quantity and try again.` : `${name} just sold out. Remove it from your bag and try again.`);
      }
    }
  }
  return [...merged].map(([id, q]) => ({ quantity: String(q), catalog_object_id: id }));
}

export function shippingOf(f) {
  if (!f || f.type !== 'ship') return SHIPPING.PICKUP;
  const c = String((f.address && f.address.country) || f.country || 'US').toUpperCase();
  return c !== 'US' ? SHIPPING.INTL : SHIPPING.US;
}

export function contactOf(c) {
  c = c || {};
  return {
    name: clean(c.name, 100),
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(c.email || '').trim()) ? String(c.email).trim().slice(0, 120) : '',
    phone: e164(c.phone),
  };
}

export function addressOf(a) {
  a = a || {};
  const country = clean(a.country || 'US', 2).toUpperCase();
  const out = {
    address_line_1: clean(a.line1, 120), address_line_2: clean(a.line2, 120) || undefined,
    locality: clean(a.city, 60), administrative_district_level_1: clean(a.state, 60) || undefined,
    postal_code: clean(a.zip, 20), country,
  };
  if (!out.address_line_1 || !out.locality || !out.postal_code || !/^[A-Z]{2}$/.test(country)) throw badRequest('Add a full shipping address: street, city, ZIP or postal code and country.');
  if (country === 'US' && !out.administrative_district_level_1) throw badRequest('Add the state for your shipping address.');
  return out;
}

// The order the shop checkout pays for.
export function shopOrder(env, lineItems, fulfillment, contact, ref) {
  const { locationId } = cfg(env);
  const ship = shippingOf(fulfillment);
  const order = {
    location_id: locationId,
    reference_id: ref ? clean(ref, 40) : undefined,
    source: { name: 'gvosound.com' },
    line_items: lineItems,
    pricing_options: { auto_apply_discounts: true, auto_apply_taxes: true },
  };
  const recipient = { display_name: contact.name || 'Website customer' };
  if (contact.email) recipient.email_address = contact.email;
  if (contact.phone) recipient.phone_number = contact.phone;
  if (fulfillment && fulfillment.quote) {
    // Pricing preview only: shipping charge without the buyer's address.
    if (fulfillment.type === 'ship') order.service_charges = [{ name: 'Shipping', amount_money: money(ship.cents), calculation_phase: 'TOTAL_PHASE', taxable: false }];
  } else if (fulfillment && fulfillment.type === 'ship') {
    recipient.address = addressOf(fulfillment.address);
    order.fulfillments = [{ type: 'SHIPMENT', state: 'PROPOSED', shipment_details: { recipient, shipping_note: ship.label } }];
    order.service_charges = [{ name: 'Shipping', amount_money: money(ship.cents), calculation_phase: 'TOTAL_PHASE', taxable: false }];
  } else {
    order.fulfillments = [{ type: 'PICKUP', state: 'PROPOSED', pickup_details: { recipient, schedule_type: 'ASAP', note: 'Website order. Pickup at 109 Gibralter Ave.' } }];
  }
  return order;
}

// A short, readable summary of a calculated or created order for the checkout box.
export function summarize(order) {
  const lines = (order.line_items || []).map(li => ({
    name: li.name + (li.variation_name && !/^regular$/i.test(li.variation_name) ? ' · ' + li.variation_name : ''),
    qty: Number(li.quantity), gross: cents(li.gross_sales_money), discount: cents(li.total_discount_money),
    tax: cents(li.total_tax_money), total: cents(li.total_money),
  }));
  const discounts = (order.discounts || []).filter(d => cents(d.applied_money) > 0).map(d => ({ name: d.name, amount: cents(d.applied_money) }));
  return {
    lines,
    discounts,
    subtotal: lines.reduce((a, l) => a + l.gross, 0),
    discount: cents(order.total_discount_money),
    tax: cents(order.total_tax_money),
    taxes: (order.taxes || []).map(t => ({ name: t.name, pct: t.percentage, amount: cents(t.applied_money) })),
    service: cents(order.total_service_charge_money),
    total: cents(order.total_money),
  };
}

export async function calculate(env, order) {
  const r = await sq(env, 'POST', '/v2/orders/calculate', { order });
  return r.order;
}
