// POST /api/quote: Square prices the bag (or a booking) before the buyer pays.
// Body: { lines:[{v,q}], fulfillment:{type:'ship'|'pickup', address}, service?: variationId }
import { json, fail, readBody } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { shopLines, shopOrder, calculate, summarize, contactOf, badRequest } from '../_lib/orders.js';
import { bookingOrder } from '../_lib/booking.js';

export async function onRequestPost({ request, env }) {
  try {
    const b = await readBody(request);
    const cat = await loadCatalog(env);
    const lines = await shopLines(env, cat, b.lines || [], { checkStock: false });
    let order;
    if (b.service) {
      order = bookingOrder(env, cat, b.service, lines, contactOf(b.contact), null);
    } else {
      if (!lines.length) throw badRequest('Your bag is empty.');
      const f = { quote: true, type: b.fulfillment && b.fulfillment.type === 'ship' ? 'ship' : 'pickup', country: b.fulfillment && b.fulfillment.country };
      order = shopOrder(env, lines, f, contactOf(b.contact), null);
    }
    const calc = await calculate(env, order);
    return json({ ok: true, quote: summarize(calc) });
  } catch (err) {
    return fail(err, 'Square could not price this right now. Try again in a minute.');
  }
}
