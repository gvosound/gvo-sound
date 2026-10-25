// POST /api/checkout: shop orders. CreateOrder (Square applies the automatic discounts and the 6% tax),
// then CreatePayment for exactly that order's total. Inventory drops in Square when the order is paid.
// Body: { attempt, sourceId, lines:[{v,q}], fulfillment:{type, address}, contact:{name,email,phone}, expectTotal }
import { sq, cfg, json, fail, readBody, idem, money, cents } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { shopLines, shopOrder, summarize, contactOf, badRequest, shopIndex } from '../_lib/orders.js';
import { emailCfg, sendEmail, orderConfirmation, orderAlert } from '../_lib/email.js';

export async function onRequestPost({ request, env, waitUntil }) {
  try {
    const b = await readBody(request);
    const attempt = String(b.attempt || '').replace(/[^\w-]/g, '').slice(0, 36);
    if (!attempt || !b.sourceId) throw badRequest('Payment details are missing. Try again.');
    const contact = contactOf(b.contact);
    if (!contact.name) throw badRequest('Add your name.');
    if (!contact.email) throw badRequest('Add an email for your receipt.');
    const fulfillment = b.fulfillment && b.fulfillment.type === 'ship' ? { type: 'ship', address: b.fulfillment.address } : { type: 'pickup' };

    const cat = await loadCatalog(env);
    const lines = await shopLines(env, cat, b.lines);
    if (!lines.length) throw badRequest('Your bag is empty.');
    const order = shopOrder(env, lines, fulfillment, contact, 'WEB-' + attempt.slice(0, 8).toUpperCase());

    const created = (await sq(env, 'POST', '/v2/orders', { idempotency_key: idem('ord', attempt, JSON.stringify(lines), fulfillment.type), order })).order;
    const total = cents(created.total_money);
    if (b.expectTotal != null && Math.round(Number(b.expectTotal)) !== total) {
      return json({ ok: false, code: 'TOTAL_CHANGED', error: 'The total changed while you were checking out. Check the new total and pay again.', quote: summarize(created) }, 409);
    }

    const pay = {
      idempotency_key: idem('pay', attempt, b.sourceId),
      source_id: String(b.sourceId),
      amount_money: money(total),
      order_id: created.id,
      location_id: cfg(env).locationId,
      autocomplete: true,
      buyer_email_address: contact.email,
      note: 'gvosound.com shop order' + (fulfillment.type === 'ship' ? ', ship' : ', pickup at the studio'),
      reference_id: created.reference_id,
    };
    if (b.verificationToken) pay.verification_token = String(b.verificationToken);
    if (fulfillment.type === 'ship') pay.shipping_address = created.fulfillments[0].shipment_details.recipient.address;
    const payment = (await sq(env, 'POST', '/v2/payments', pay)).payment;

    // Confirmation to the customer and a copy to Cory. Sent after the reply so the buyer never waits on email.
    // Wrapped so an email problem can never turn a paid order into an error screen.
    const mail = (async () => {
      const ecfg = emailCfg(env, new URL(request.url).origin), data = { order: created, idx: shopIndex(cat), contact, fulfillment, payment };
      await Promise.allSettled([sendEmail(env, orderConfirmation(ecfg, data)), sendEmail(env, orderAlert(ecfg, data))]);
    })().catch(e => console.log('email error', e && e.message));
    if (waitUntil) waitUntil(mail); else await mail;

    return json({
      ok: true,
      orderId: created.id,
      ref: created.reference_id,
      paymentId: payment.id,
      receiptUrl: payment.receipt_url || null,
      emailed: !!env.RESEND_API_KEY,
      receiptNumber: payment.receipt_number || null,
      summary: summarize(created),
    });
  } catch (err) {
    return fail(err);
  }
}
