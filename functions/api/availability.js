// GET /api/availability                      -> the bookable services and who takes them
// GET /api/availability?service=ID&team=ID|any&from=ISO&days=14 -> open start times from Square Appointments
import { json, fail, sq, cfg } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { serviceOf, searchSlots, teamNames, allowedTeam, bookableOnline, LEAD_MS, MAX_PEOPLE } from '../_lib/booking.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  try {
    const cat = await loadCatalog(env);
    // ?debug=team: every booking profile (bookable online or not) and who each bookable service lists.
    // Display names only. Use it to see why someone doesn't show in the booking desk.
    if (url.searchParams.get('debug') === 'team') return json(await teamReport(env, cat), 200, { 'Cache-Control': 'no-store' });
    const id = url.searchParams.get('service');
    if (!id) {
      const names = await teamNames(env);
      const services = cat.services.filter(bookableOnline).map(s => ({
        id: s.id, kind: s.kind, name: s.name, hrs: s.hrs, mins: s.mins, price: s.price / 100,
        team: allowedTeam(s, names).map(t => ({ id: t, n: names.get(t) })),
      }));
      return json({ ok: true, leadHours: LEAD_MS / 3600e3, maxPeople: MAX_PEOPLE, services }, 200, { 'Cache-Control': 'public, max-age=60' });
    }
    const s = serviceOf(cat, id);
    const allowed = allowedTeam(s, await teamNames(env));
    const slots = await searchSlots(env, s, { from: url.searchParams.get('from'), days: Number(url.searchParams.get('days') || 14), team: url.searchParams.get('team') || 'any', allowed });
    // One entry per start time; keep every team member who is free then.
    const by = new Map();
    for (const x of slots) { const e = by.get(x.start) || { start: x.start, team: [] }; if (x.team && !e.team.includes(x.team)) e.team.push(x.team); by.set(x.start, e); }
    return json({ ok: true, service: s.id, mins: s.mins, slots: [...by.values()] });
  } catch (err) {
    return fail(err, 'Live times could not load from Square. Call or text the studio at (443) 292-6753.');
  }
}

async function teamReport(env, cat) {
  const { locationId } = cfg(env);
  const profiles = new Map();
  let cursor;
  do {
    const q = new URLSearchParams({ location_id: locationId, limit: '100' });
    if (cursor) q.set('cursor', cursor);
    const r = await sq(env, 'GET', '/v2/bookings/team-member-booking-profiles?' + q);
    for (const p of r.team_member_booking_profiles || []) profiles.set(p.team_member_id, { name: p.display_name || '', bookableOnline: !!p.is_bookable });
    cursor = r.cursor;
  } while (cursor);
  // Team members without any booking profile yet (Team API). Skipped quietly if the token can't read the team.
  let others = [];
  try {
    const r = await sq(env, 'POST', '/v2/team-members/search', { query: { filter: { location_ids: [locationId], status: 'ACTIVE' } }, limit: 200 });
    others = (r.team_members || []).filter(t => !profiles.has(t.id)).map(t => [t.given_name, t.family_name].filter(Boolean).join(' '));
  } catch (e) { others = ['(team list not readable with this token)']; }
  const nameOf = id => (profiles.get(id) || {}).name || 'unknown ' + id.slice(-4);
  return {
    ok: true,
    profiles: [...profiles.values()],
    noBookingProfile: others,
    services: cat.services.map(s => ({ name: s.name, kind: s.kind, onlineSite: bookableOnline(s), team: s.team.map(nameOf) })),
  };
}
