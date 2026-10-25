// POST /api/form: the site's forms (podcast quote, event inquiry, travel request, music submission, notify lists).
// Checks the fields, screens out bots, then hands the row to the Apps Script on the GVO Website Form Submissions
// sheet (FORMS_URL), which adds the row and emails the GVO Gmail. FORMS_SECRET proves the request came from here.
// Body: { form, fields:{...}, hp, t }  hp = hidden field bots fill, t = ms the form was open
import { json, clean } from '../_lib/square.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phone = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const fmtPhone = s => { const d = phone(s); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : clean(s, 30); };

// field: [max length, required]
const SPEC = {
  quote:  { name: [100, 1], phone: [30, 1], email: [120, 0], type: [40, 1], details: [2000, 0] },
  event:  { type: [40, 1], name: [100, 1], email: [120, 1], phone: [30, 0], org: [120, 0], when: [80, 0], city: [80, 0], details: [2000, 1] },
  travel: { trip: [60, 1], name: [100, 1], email: [120, 1], phone: [30, 0], where: [120, 0], when: [80, 0], pax: [4, 0], details: [2000, 0] },
  music:  { artist: [100, 1], email: [120, 1], link: [300, 1] },
  notify: { list: [40, 1], contact: [120, 1] },
};
const LISTS = ['Next event', 'Africa trip'];

const bad = msg => json({ ok: false, error: msg }, 400);

export async function onRequestPost({ request, env }) {
  let b;
  try { b = await request.json(); } catch (e) { return bad('Something went wrong. Try again.'); }
  const spec = SPEC[b && b.form];
  if (!spec) return bad('Unknown form.');
  // Bots fill every field, or submit faster than a person can type. Pretend it worked.
  if ((b.hp && String(b.hp).trim()) || (typeof b.t === 'number' && b.t < 2500)) return json({ ok: true });

  const f = {};
  for (const [k, [max, req]] of Object.entries(spec)) {
    const v = clean((b.fields || {})[k], max);
    if (req && !v) return bad('Fill in every required field.');
    f[k] = v;
  }
  if (f.email && !EMAIL.test(f.email)) return bad('Check the email address.');
  if (f.phone) { if (phone(f.phone).length !== 10) return bad('Add a 10-digit phone number.'); f.phone = fmtPhone(f.phone); }
  if (b.form === 'music' && !/^https:\/\/(open\.spotify\.com|music\.apple\.com|spotify\.link)\//.test(f.link)) return bad('Paste a Spotify or Apple Music link that starts with https://');
  if (b.form === 'notify') {
    if (!LISTS.includes(f.list)) return bad('Unknown list.');
    const d = phone(f.contact);
    if (!EMAIL.test(f.contact) && d.length !== 10) return bad('Add an email or a 10-digit phone number.');
    if (!EMAIL.test(f.contact)) f.contact = fmtPhone(f.contact);
  }
  if (f.pax && !/^\d{1,3}$/.test(f.pax)) return bad('Travelers should be a number.');

  if (!env.FORMS_URL || !env.FORMS_SECRET) {
    console.log('form not sent: FORMS_URL or FORMS_SECRET missing', b.form);
    return json({ ok: false, error: 'This form is not connected yet. Call or text the studio at (443) 292-6753.' }, 503);
  }
  try {
    const r = await fetch(env.FORMS_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: env.FORMS_SECRET, form: b.form, fields: f }),
    });
    const t = await r.text();
    let j = {}; try { j = JSON.parse(t); } catch (e) { j = {}; }
    if (!j.ok) { console.log('form script error', r.status, t.slice(0, 300)); throw new Error('script'); }
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: 'That did not send. Try again, or call or text the studio at (443) 292-6753.' }, 502);
  }
}
