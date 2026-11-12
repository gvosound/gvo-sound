// Studio bookings on Square Appointments. Cory's policy: full price up front, no refunds,
// switches no later than 2 hours before the session. Lead time 2 hours, open 24/7, 5 people max.
import { sq, cfg, clean } from './square.js';
import { badRequest } from './orders.js';
import { loadCatalog, classify } from './catalog.js';

export const LEAD_MS = 2 * 3600e3;
export const MAX_PEOPLE = 5;
export const BOOKABLE = ['rec', 'photo', 'holiday'];
// Shortest session that books online, by kind. A 1-hour recording session stays in Square but is request-only.
export const MIN_HRS = { rec: 2 };
// Square team members who never take an online booking for that kind, matched by display name.
// Cory doesn't engineer sessions, and "No Photographer Needed" is a photo-studio placeholder.
const OFF_TEAM = { rec: [/^cory\b/i, /no photographer/i] };

// Rooms. Each studio is one physical room: how many sessions it holds at once, keyed by the service kind
// the catalog assigns. A booking in a room blocks that room for every team member. Add a room here.
export const ROOMS_CAP = { rec: 1, photo: 1, pod: 1 };
// Kinds that use another kind's room. The holiday photoshoot runs in the photo studio.
const ROOM_ALIAS = { holiday: 'photo' };
export const roomOf = kind => (kind && ROOMS_CAP[kind] ? kind : ROOM_ALIAS[kind]) || null;

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

// Room kind for every service variation in the catalog, archived or not bookable online included,
// so bookings made in Square for any studio service count.
const kindMaps = new WeakMap();
function variationKinds(cat) {
  let m = kindMaps.get(cat);
  if (m) return m;
  m = new Map();
  for (const o of (cat.byId ? cat.byId.values() : [])) {
    if (o.type !== 'ITEM' || !o.item_data || o.item_data.product_type !== 'APPOINTMENTS_SERVICE') continue;
    for (const v of o.item_data.variations || []) {
      const vn = (v.item_variation_data || {}).name;
      const full = o.item_data.name + (vn && !/^regular$/i.test(vn) ? ' · ' + vn : '');
      m.set(v.id, classify(full) || classify(o.item_data.name));
    }
  }
  for (const s of cat.services || []) if (!m.has(s.id)) m.set(s.id, s.kind);
  kindMaps.set(cat, m);
  return m;
}

// Sessions on the calendar that hold a room: ACCEPTED and PENDING bookings at the location, made on the
// site or in Square. Returns [{ id, start, end (ms), room, team, status }]. Square lists bookings by start
// time, 31 days per call at most, so longer windows are split; the window starts 12 hours early to catch
// sessions already running. Kept 60 seconds per whole-day window; fresh:true skips the cache.
const ROOM_TTL = 60e3, ROOM_LOOKBACK = 12 * 3600e3, DAY = 864e5;
const roomMemo = new Map();
export async function roomBookings(env, from, to, { cat = null, fresh = false } = {}) {
  const a = Math.floor((new Date(from).getTime() - ROOM_LOOKBACK) / DAY) * DAY;
  const b = Math.ceil(new Date(to).getTime() / DAY) * DAY;
  const key = a + '/' + b;
  const hit = roomMemo.get(key);
  let list;
  if (!fresh && hit && Date.now() - hit.at < ROOM_TTL) list = hit.list;
  else {
    const kinds = variationKinds(cat || await loadCatalog(env));
    const { locationId } = cfg(env);
    const raw = [];
    for (let t = a; t < b; t += 31 * DAY) {
      let cursor;
      do {
        const q = new URLSearchParams({ location_id: locationId, limit: '100',
          start_at_min: new Date(t).toISOString(), start_at_max: new Date(Math.min(b, t + 31 * DAY)).toISOString() });
        if (cursor) q.set('cursor', cursor);
        const r = await sq(env, 'GET', '/v2/bookings?' + q);
        raw.push(...(r.bookings || []));
        cursor = r.cursor;
      } while (cursor);
    }
    const seen = new Set();
    list = [];
    for (const bk of raw) {
      if (seen.has(bk.id) || !['ACCEPTED', 'PENDING'].includes(bk.status)) continue;
      seen.add(bk.id);
      let t = new Date(bk.start_at).getTime();
      for (const sg of bk.appointment_segments || []) {
        const mins = Number(sg.duration_minutes) || 0, room = roomOf(kinds.get(sg.service_variation_id));
        if (room && mins > 0) list.push({ id: bk.id, start: t, end: t + mins * 60e3, room, team: sg.team_member_id || null, status: bk.status });
        t += mins * 60e3;
      }
    }
    roomMemo.set(key, { at: Date.now(), list });
    if (roomMemo.size > 50) roomMemo.delete(roomMemo.keys().next().value);
  }
  const f = new Date(from).getTime(), e = new Date(to).getTime();
  return list.filter(x => x.end > f && x.start < e);
}

// True when [start, start + mins) overlaps as many sessions in the room as it holds.
export function roomFull(bookings, room, start, mins) {
  if (!room) return false;
  const s = new Date(start).getTime(), e = s + mins * 60e3;
  return bookings.filter(x => x.room === room && x.start < e && x.end > s).length >= ROOMS_CAP[room];
}

// Square answers availability for 1 to 32 days. Returns [{start, team, mins}] starting 2+ hours from now.
// Times where the service's room is already full are dropped, whoever the team member (room:false skips that,
// for a caller that checks the room itself).
export async function searchSlots(env, service, { from, days = 14, team = 'any', allowed = null, cat = null, room = true }) {
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
  const rk = room ? roomOf(service.kind) : null;
  const [r, taken] = await Promise.all([
    sq(env, 'POST', '/v2/bookings/availability/search', {
      query: { filter: { start_at_range: { start_at: ymd(start), end_at: ymd(end) }, location_id: locationId, segment_filters: [seg] } },
    }),
    rk ? roomBookings(env, start, new Date(end.getTime() + DAY), { cat }) : [],
  ]);
  return (r.availabilities || [])
    .filter(a => new Date(a.start_at).getTime() >= now + LEAD_MS)
    .filter(a => !allowed || allowed.includes(((a.appointment_segments || [])[0] || {}).team_member_id))
    .map(a => {
      const sgm = (a.appointment_segments || [])[0] || {};
      return { start: a.start_at, team: sgm.team_member_id || null, mins: sgm.duration_minutes || service.mins, version: sgm.service_variation_version };
    })
    .filter(x => !roomFull(taken, rk, x.start, x.mins));
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
