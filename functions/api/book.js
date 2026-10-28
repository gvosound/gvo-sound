// POST /api/book: pays for a studio session in full, then puts it on the Square Appointments calendar.
// Order: check the time is still open, create the order (tax applied by Square), take the payment,
// create the booking. If the booking fails after payment, the payment is refunded in full automatically.
// Body: { attempt, sourceId, service, start, team, contact:{name,phone,email}, people, notes, photographer, lines:[{v,q}], expectTotal }
import { sq, cfg, json, fail, readBody, idem, money, cents, clean, findOrCreateCustomer } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { shopLines, summarize, contactOf, badRequest, shopIndex } from '../_lib/orders.js';
import { emailCfg, sendEmail, bookingMerchAlert } from '../_lib/email.js';
import { serviceOf, bookingOrder, searchSlots, teamNames, allowedTeam, LEAD_MS, MAX_PEOPLE } from '../_lib/booking.js';

const ET = { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };

export async function onRequestPost({ request, env, waitUntil }) {
  let payment = null;
  try {
    const b = await readBody(request);
    const attempt = String(b.attempt || '').replace(/[^\w-]/g, '').slice(0, 36);
    if (!attempt || !b.sourceId) throw badRequest('Payment details are missing. Try again.');
    const contact = contactOf(b.contact);
    if (!contact.name) throw badRequest('Add the name for the booking.');
    if (!contact.phone) throw badRequest('Add a 10-digit mobile number.');
    const people = Math.floor(Number(b.people || 1));
    if (!(people >= 1 && people <= MAX_PEOPLE)) throw badRequest(`Up to ${MAX_PEOPLE} people per session.`);
    const start = new Date(b.start);
    if (isNaN(start)) throw badRequest('Pick a start time.');
    if (start.getTime() < Date.now() + LEAD_MS) throw badRequest('Sessions book at least 2 hours ahead. Pick a later time.');

    const cat = await loadCatalog(env);
    const s = serviceOf(cat, b.service);
    const merch = await shopLines(env, cat, b.lines || []);

    // Still open? Ask Square for that exact start.
    const want = b.team && b.team !== 'any' ? String(b.team) : 'any';
    const names = await teamNames(env).catch(() => null);
    const allowed = names ? allowedTeam(s, names) : null;
    const open = (await searchSlots(env, s, { from: new Date(start.getTime() - 60e3).toISOString(), days: 1, team: want, allowed }))
      .filter(x => new Date(x.start).getTime() === start.getTime());
    if (!open.length) return json({ ok: false, code: 'SLOT_TAKEN', error: 'That time was just booked. Pick another start time.' }, 409);
    const slot = open[0];

    const customer = await findOrCreateCustomer(env, { name: contact.name, email: contact.email, phone: contact.phone });
    const ref = 'BK-' + attempt.slice(0, 8).toUpperCase();
    const order = bookingOrder(env, cat, s.id, merch, contact, customer.id, ref);
    const created = (await sq(env, 'POST', '/v2/orders', { idempotency_key: idem('bko', attempt, s.id, slot.start, JSON.stringify(merch)), order })).order;
    const total = cents(created.total_money);
    if (b.expectTotal != null && Math.round(Number(b.expectTotal)) !== total) {
      return json({ ok: false, code: 'TOTAL_CHANGED', error: 'The total changed while you were booking. Check the new total and pay again.', quote: summarize(created) }, 409);
    }

    const when = start.toLocaleString('en-US', ET);
    const pay = {
      idempotency_key: idem('bkp', attempt, b.sourceId),
      source_id: String(b.sourceId),
      amount_money: money(total),
      order_id: created.id,
      customer_id: customer.id,
      location_id: cfg(env).locationId,
      autocomplete: true,
      reference_id: ref,
      note: clean(`Studio booking: ${s.name}, ${when}`, 500),
    };
    if (contact.email) pay.buyer_email_address = contact.email;
    if (b.verificationToken) pay.verification_token = String(b.verificationToken);
    payment = (await sq(env, 'POST', '/v2/payments', pay)).payment;

    let booking;
    try {
      const sellerNote = [
        `Paid in full online: ${(total / 100).toFixed(2)} USD. Order ${created.id}, payment ${payment.id}.`,
        b.photographer && b.photographer !== 'none' ? `Photographer requested: ${clean(b.photographer, 60)} (paid separately).` : '',
        merch.length ? 'Merch to bag at the front desk: see the order.' : '',
      ].filter(Boolean).join(' ');
      booking = (await sq(env, 'POST', '/v2/bookings', {
        idempotency_key: idem('bkg', attempt, payment.id),
        booking: {
          start_at: slot.start,
          location_id: cfg(env).locationId,
          customer_id: customer.id,
          customer_note: clean(`${people} ${people === 1 ? 'person' : 'people'}. ${b.notes || ''}`, 4000),
          seller_note: clean(sellerNote, 4000),
          appointment_segments: [{
            duration_minutes: slot.mins || s.mins,
            service_variation_id: s.id,
            service_variation_version: Number(slot.version || s.version),
            team_member_id: slot.team,
          }],
        },
      })).booking;
    } catch (bookErr) {
      // The card was charged but the calendar said no. Give the money back right away.
      let refunded = false;
      try {
        await sq(env, 'POST', '/v2/refunds', { idempotency_key: idem('rfd', payment.id), payment_id: payment.id, amount_money: money(total), reason: 'Website booking could not be placed on the calendar' });
        refunded = true;
      } catch (e) { console.log('refund failed', payment.id, e && e.message); }
      console.log('booking failed after payment', payment.id, bookErr && bookErr.code, bookErr && bookErr.message);
      return json({ ok: false, code: 'BOOKING_FAILED', error: refunded
        ? 'That time could not be booked, so your payment was refunded in full. Pick another time, or call or text the studio at (443) 292-6753.'
        : 'Your payment went through but the calendar did not take the booking. Call or text the studio at (443) 292-6753 and give this code: ' + ref + '.' }, 409);
    }

    const teamName = names || await teamNames(env).catch(() => new Map());

    // Square Appointments texts and emails the customer. Cory gets a front-desk note only when merch rides along.
    if (merch.length) {
      const mail = (async () => {
        const msg = bookingMerchAlert(emailCfg(env, new URL(request.url).origin), { order: created, idx: shopIndex(cat), contact, when, session: s.name, team: teamName.get(slot.team) });
        if (msg) await sendEmail(env, msg);
      })().catch(e => console.log('email error', e && e.message));
      if (waitUntil) waitUntil(mail); else await mail;
    }
    return json({
      ok: true,
      bookingId: booking.id,
      code: ref,
      start: booking.start_at,
      when,
      team: teamName.get(slot.team) || null,
      receiptUrl: payment.receipt_url || null,
      summary: summarize(created),
    });
  } catch (err) {
    return fail(err);
  }
}
