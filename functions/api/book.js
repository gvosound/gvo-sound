// POST /api/book: pays for a studio session in full, then puts it on the Square Appointments calendar.
// Order: check the time is still open (team member in Square, then the room, read fresh), create the order (tax applied by Square), take the payment,
// create the booking. If the booking fails after payment, the payment is refunded in full automatically.
// Square Appointments confirms with the customer, but sends the studio nothing for API bookings, so every
// booking sends its own studio alert (bookingAlert, to BOOKING_ALERT_TO). That email never blocks the booking.
// Body: { attempt, sourceId, service, start, team, contact:{name,phone,email}, people, notes, photographer, lines:[{v,q}], expectTotal }
import { sq, cfg, json, fail, readBody, idem, money, cents, clean, findOrCreateCustomer } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { shopLines, summarize, contactOf, badRequest, shopIndex } from '../_lib/orders.js';
import { emailCfg, sendEmail, bookingAlert } from '../_lib/email.js';
import { serviceOf, bookingOrder, searchSlots, teamNames, allowedTeam, roomBookings, roomFull, roomOf, LEAD_MS, MAX_PEOPLE } from '../_lib/booking.js';

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
    const open = (await searchSlots(env, s, { from: new Date(start.getTime() - 60e3).toISOString(), days: 1, team: want, allowed, cat, room: false }))
      .filter(x => new Date(x.start).getTime() === start.getTime());
    if (!open.length) return json({ ok: false, code: 'SLOT_TAKEN', error: 'That time was just booked. Pick another start time.' }, 409);
    const slot = open[0];
    // One room per studio: any session already in this room at this time, with any team member, blocks it.
    const room = roomOf(s.kind), slotMins = slot.mins || s.mins;
    const roomTaken = async () => room && roomFull(await roomBookings(env, start, new Date(start.getTime() + slotMins * 60e3), { cat, fresh: true }), room, start, slotMins);
    if (await roomTaken()) return json({ ok: false, code: 'ROOM_TAKEN', error: 'That time was just booked. Pick another time.' }, 409);

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
      // The room could have filled while the card was charged. Square doesn't know about rooms, so check
      // again; if it's taken, the catch below refunds the payment in full.
      if (await roomTaken()) throw Object.assign(new Error('room taken after payment'), { code: 'ROOM_TAKEN' });
      const sellerNote = [
        // First line staff see. Appointments can't link a booking to its payment, so it shows the session as due.
        `PAID ONLINE: $${(total / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} on gvosound.com. Do not check out. Ref ${ref}.`,
        `Order ${created.id}, payment ${payment.id}.`,
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

    // Square should accept web bookings on its own. Anything else (PENDING) needs someone to accept it in Appointments.
    console.log('booking created', ref, 'status', booking.status, 'id', booking.id);

    const teamName = names || await teamNames(env).catch(() => new Map());

    // Studio alert for every booking. Runs after the response; any error is logged and the booking stands.
    const mail = (async () => {
      if (!env.RESEND_API_KEY) { console.log('booking alert skipped: RESEND_API_KEY not set', ref); return; }
      const msg = bookingAlert(emailCfg(env, new URL(request.url).origin), {
        order: created, idx: shopIndex(cat), contact, when, session: s.name, team: teamName.get(slot.team),
        mins: slot.mins || s.mins, people, notes: clean(b.notes || '', 2000), photographer: b.photographer ? clean(b.photographer, 60) : '', total, ref, status: booking.status,
      });
      const r = await sendEmail(env, msg);
      console.log(r && r.ok ? 'booking alert sent' : 'booking alert not sent', ref);
    })().catch(e => console.log('booking alert error', ref, e && e.message));
    if (waitUntil) waitUntil(mail); else await mail;
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

// GET /api/book?debug=recent&key=DEBUG_KEY: team-only view of the last 20 bookings (status, start, team member, BK ref),
// plus the Square settings that decide whether a web booking is accepted. No customer phone numbers or emails.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  if (url.searchParams.get('debug') !== 'recent') return json({ ok: false, error: 'Not found' }, 404);
  const key = url.searchParams.get('key') || '';
  if (!env.DEBUG_KEY || !(await sameKey(key, env.DEBUG_KEY))) return json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { locationId } = cfg(env);
    const safe = p => sq(env, 'GET', p).catch(e => ({ error: (e && e.message) || 'failed' }));
    const [tok, biz, loc, names] = await Promise.all([
      sq(env, 'POST', '/oauth2/token/status', {}).catch(e => ({ error: (e && e.message) || 'failed' })),
      safe('/v2/bookings/business-booking-profile'),
      safe('/v2/bookings/location-booking-profiles'),
      teamProfiles(env, locationId),
    ]);
    // Square lists bookings by start time, at most 31 days at a time: from 7 days ago to 24 days ahead.
    const now = Date.now(), list = [];
    let cursor;
    do {
      const q = new URLSearchParams({ location_id: locationId, limit: '100',
        start_at_min: new Date(now - 7 * 864e5).toISOString(), start_at_max: new Date(now + 24 * 864e5).toISOString() });
      if (cursor) q.set('cursor', cursor);
      const r = await sq(env, 'GET', '/v2/bookings?' + q);
      list.push(...(r.bookings || []));
      cursor = r.cursor;
    } while (cursor && list.length < 500);
    list.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    const recent = list.slice(0, 20);
    // First names only, to tell bookings apart.
    const ids = [...new Set(recent.map(b => b.customer_id).filter(Boolean))];
    const first = new Map();
    if (ids.length) {
      const r = await sq(env, 'POST', '/v2/customers/bulk-retrieve', { customer_ids: ids }).catch(() => ({}));
      for (const [id, x] of Object.entries(r.responses || {})) if (x.customer) first.set(id, x.customer.given_name || '');
    }
    const b0 = biz.business_booking_profile || {};
    return json({
      ok: true,
      // A personal access token lists no scopes: it carries every permission of the account that made it.
      token: tok.error ? { error: tok.error } : { scopes: tok.scopes || 'none listed (personal access token)', expires: tok.expires_at || 'never' },
      business: biz.error ? { error: biz.error } : {
        bookingEnabled: b0.booking_enabled, bookingPolicy: b0.booking_policy, supportSellerLevelWrites: b0.support_seller_level_writes,
        customerTimezoneChoice: b0.customer_timezone_choice,
      },
      location: loc.error ? { error: loc.error } : (loc.location_booking_profiles || []).filter(l => l.location_id === locationId).map(l => ({ onlineBookingEnabled: l.online_booking_enabled })),
      bookings: recent.map(b => {
        const seg = (b.appointment_segments || [])[0] || {}, tm = names.get(seg.team_member_id);
        return {
          id: b.id, status: b.status, created: b.created_at, start: b.start_at, location: b.location_id,
          source: b.source, creator: b.creator_details ? { type: b.creator_details.creator_type, teamMember: names.has(b.creator_details.team_member_id) ? names.get(b.creator_details.team_member_id).name : b.creator_details.team_member_id ? 'id ' + b.creator_details.team_member_id : undefined } : null,
          customer: first.get(b.customer_id) || '',
          teamMember: tm ? tm.name : seg.team_member_id || '', teamMemberBookable: tm ? tm.bookable : null,
          ref: ((b.seller_note || '').match(/BK-[A-Z0-9]{8}/) || [])[0] || '',
          web: /^PAID ONLINE|Paid in full online/.test(b.seller_note || ''),
        };
      }),
    }, 200, { 'Cache-Control': 'no-store' });
  } catch (err) {
    return fail(err);
  }
}

async function teamProfiles(env, locationId) {
  const out = new Map();
  let cursor;
  do {
    const q = new URLSearchParams({ location_id: locationId, limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const r = await sq(env, 'GET', '/v2/bookings/team-member-booking-profiles?' + q);
    for (const p of r.team_member_booking_profiles || []) out.set(p.team_member_id, { name: (p.display_name || '').trim(), bookable: !!p.is_bookable });
    cursor = r.cursor;
  } while (cursor);
  return out;
}

// Compares hashes so the check takes the same time whatever the key.
async function sameKey(a, b) {
  const h = async s => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s))));
  const [x, y] = await Promise.all([h(a), h(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
