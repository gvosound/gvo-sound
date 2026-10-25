// GET /api/availability                      -> the bookable services and who takes them
// GET /api/availability?service=ID&team=ID|any&from=ISO&days=14 -> open start times from Square Appointments
import { json, fail } from '../_lib/square.js';
import { loadCatalog } from '../_lib/catalog.js';
import { BOOKABLE, serviceOf, searchSlots, teamNames, LEAD_MS, MAX_PEOPLE } from '../_lib/booking.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  try {
    const cat = await loadCatalog(env);
    const id = url.searchParams.get('service');
    if (!id) {
      const names = await teamNames(env);
      const services = cat.services.filter(s => BOOKABLE.includes(s.kind) && s.price != null).map(s => ({
        id: s.id, kind: s.kind, name: s.name, hrs: s.hrs, mins: s.mins, price: s.price / 100,
        team: (s.team.length ? s.team : [...names.keys()]).filter(t => names.has(t)).map(t => ({ id: t, n: names.get(t) })),
      }));
      return json({ ok: true, leadHours: LEAD_MS / 3600e3, maxPeople: MAX_PEOPLE, services }, 200, { 'Cache-Control': 'public, max-age=60' });
    }
    const s = serviceOf(cat, id);
    const slots = await searchSlots(env, s, { from: url.searchParams.get('from'), days: Number(url.searchParams.get('days') || 14), team: url.searchParams.get('team') || 'any' });
    // One entry per start time; keep every team member who is free then.
    const by = new Map();
    for (const x of slots) { const e = by.get(x.start) || { start: x.start, team: [] }; if (x.team && !e.team.includes(x.team)) e.team.push(x.team); by.set(x.start, e); }
    return json({ ok: true, service: s.id, mins: s.mins, slots: [...by.values()] });
  } catch (err) {
    return fail(err, 'Live times could not load from Square. Call or text the studio at (443) 292-6753.');
  }
}
