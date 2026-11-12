// POST /api/quote: Square prices the bag (or a booking) before the buyer pays.
// Body: { lines:[{v,q}], fulfillment:{type:'ship'|'pickup', country, zip}, service?: variationId }
import { json, fail, readBody } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { shopLines, shopOrder, calculate, summarize, contactOf, badRequest, shopIndex } from '../_lib/orders.js';
import { shipQuote } from '../_lib/shipping.js';
import { bookingOrder } from '../_lib/booking.js';

export async function onRequestPost({ request, env }) {
  try {
    const b = await readBody(request);
    const cat = await loadCatalog(env);
    const lines = await shopLines(env, cat, b.lines || [], { checkStock: false });
    let order, ship = null;
    if (b.service) {
      order = bookingOrder(env, cat, b.service, lines, contactOf(b.contact), null);
    } else {
      if (!lines.length) throw badRequest('Your bag is empty.');
      const bf = b.fulfillment || {};
      const f = { quote: true, type: bf.type === 'ship' ? 'ship' : 'pickup', country: bf.country, zip: bf.zip };
      ship = await shipQuote(env, f, lines, shopIndex(cat));
      order = shopOrder(env, lines, f, contactOf(b.contact), null, ship);
    }
    const calc = await calculate(env, order);
    const quote = summarize(calc);
    if (ship) quote.ship = { label: ship.label, live: ship.live, estimate: ship.estimate };
    return json({ ok: true, quote });
  } catch (err) {
    return fail(err, 'Square could not price this right now. Try again in a minute.');
  }
}
