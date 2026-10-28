// Studio bookings on Square Appointments. Cory's policy: full price up front, no refunds,
// switches no later than 2 hours before the session. Lead time 2 hours, open 24/7, 5 people max.
import { sq, cfg, clean } from './square.js';
import { badRequest } from './orders.js';

export const LEAD_MS = 2 * 3600e3;
export const MAX_PEOPLE = 5;
export const BOOKABLE = ['rec', 'photo', 'holiday'];
// Shortest session that books online, by kind. A 1-hour recording session stays in Square but is request-only.
export const MIN_HRS = { rec: 2 };
// Square team members who never take an online booking for that kind, matched by display name.
// Cory doesn't engineer sessions, and "No Photographer Needed" is a photo-studio placeholder.
const OFF_TEAM = { rec: [/^cory\b/i, /no photographer/i] };

export function serviceOf(cat, id) {
  const s = cat.services.find(x => x.id === id);
  if (!s || !BOOKABLE.includes(s.kind)) throw badRequest('That session type is not bookable online. Call or text the studio at (443) 292-6753.');
  if (s.price == null) throw badRequest('That session has no set price in Square yet. Call or text the studio at (443) 292-6753.');
  if (MIN_HRS[s.kind] && s.hrs < MIN_HRS[s.kind]) throw badRequest('Recording sessions book online from 2 hours. To request 1 hour, call or text the studio at (443) 292-6753.');
  return s;
}

export const bookableOnline = s => BOOKABLE.includes(s.kind) && s.price != null && !(MIN_HRS[s.kind] && s.hrs < MIN_HRS[s.kind]);

// Who can take this service online: its Square team, minus OFF_TEAM, and only people with a booking profile.
export function allowedTeam(s, names) {
  const off = OFF_TEAM[s.kind] || [];
  return (s.team.length ? s.team : [...names.keys()]).filter(t => names.has(t) && !off.some(re => re.test(names.get(t))));
}

export function bookingOrder(env, cat, serviceId, merchLines, contact, customerId, ref) {
  const s = serviceOf(cat, serviceId);
  const { locationId } = cfg(env);
  const order = {
    location_id: locationId,
    source: { name: 'gvosound.com' },
    reference_id: ref || undefined,
    customer_id: customerId || undefined,
    line_items: [{ quantity: '1', catalog_object_id: s.id }, ...merchLines],
    pricing_options: { auto_apply_discounts: true, auto_apply_taxes: true },
  };
  if (s.variable) order.line_items[0].base_price_money = { amount: s.price, currency: 'USD' };
  if (merchLines.length) {
    order.fulfillments = [{ type: 'PICKUP', state: 'PROPOSED', pickup_details: {
      recipient: { display_name: (contact && contact.name) || 'Website customer', phone_number: (contact && contact.phone) || undefined, email_address: (contact && contact.email) || undefined },
      schedule_type: 'ASAP', note: 'Merch bagged at the front desk for a studio session.' } }];
  }
  return order;
}

const ymd = d => d.toISOString().slice(0, 19) + 'Z';

// Square answers availability for 1 to 32 days. Returns [{start, team, mins}] starting 2+ hours from now.
export async function searchSlots(env, service, { from, days = 14, team = 'any', allowed = null }) {
  const { locationId } = cfg(env);
  const now = Date.now();
  let start = from ? new Date(from) : new Date(now);
  if (isNaN(start)) start = new Date(now);
  if (start.getTime() < now + LEAD_MS) start = new Date(now + LEAD_MS);
  start = new Date(Math.ceil(start.getTime() / 60000) * 60000);
  const end = new Date(start.getTime() + Math.min(31, Math.max(1, days)) * 864e5);
  const seg = { service_variation_id: service.id };
  if (team && team !== 'any') {
    if ((service.team.length && !service.team.includes(team)) || (allowed && !allowed.includes(team))) throw badRequest('That team member does not take this session type.');
    seg.team_member_id_filter = { any: [team] };
  } else if (allowed) {
    if (!allowed.length) return [];
    seg.team_member_id_filter = { any: allowed };
  }
  const r = await sq(env, 'POST', '/v2/bookings/availability/search', {
    query: { filter: { start_at_range: { start_at: ymd(start), end_at: ymd(end) }, location_id: locationId, segment_filters: [seg] } },
  });
  return (r.availabilities || [])
    .filter(a => new Date(a.start_at).getTime() >= now + LEAD_MS)
    .filter(a => !allowed || allowed.includes(((a.appointment_segments || [])[0] || {}).team_member_id))
    .map(a => {
      const sgm = (a.appointment_segments || [])[0] || {};
      return { start: a.start_at, team: sgm.team_member_id || null, mins: sgm.duration_minutes || service.mins, version: sgm.service_variation_version };
    });
}

export async function teamNames(env) {
  const { locationId } = cfg(env);
  const out = new Map();
  let cursor;
  do {
    const q = new URLSearchParams({ bookable_only: 'true', location_id: locationId, limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const r = await sq(env, 'GET', '/v2/bookings/team-member-booking-profiles?' + q);
    for (const p of r.team_member_booking_profiles || []) out.set(p.team_member_id, clean(p.display_name || '', 60));
    cursor = r.cursor;
  } while (cursor);
  return out;
}
