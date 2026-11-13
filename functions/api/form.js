// POST /api/form: the site's forms (podcast quote, event inquiry, travel request, music submission, notify lists,
// and Cory's answers on the shop review page).
// Also the team-only photographer info page at /photographers/ (form "team").
// 1. Screens out bots: Cloudflare Turnstile when TURNSTILE_SECRET is set, plus a hidden field and a minimum fill time.
// 2. Checks the fields.
// 3. Hands the row to the Apps Script on the GVO Website Form Submissions sheet (FORMS_URL, FORMS_SECRET),
//    which adds the row, emails the GVO Gmail, and says how many submissions that email address made in the last hour.
// 4. Only after the row is saved: a confirmation to the person through Resend (RESEND_API_KEY), at most
//    3 per hour to one address, so the form can't be used to flood a stranger's inbox.
// Body: { form, fields:{...}, hp, t, ts }  hp = hidden field bots fill, t = ms the form was open, ts = Turnstile token
import { json, clean } from '../_lib/square.js';
import { emailCfg, sendEmail, formConfirmation } from '../_lib/email.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i;
const phone = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
const fmtPhone = s => { const d = phone(s); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : clean(s, 30); };
const handle = s => { const v = clean(s, 80).replace(/^https?:\/\/(www\.)?(instagram|tiktok)\.com\//i, '').replace(/[/?].*$/, '').replace(/^@?/, ''); return v ? '@' + v : ''; };
export const MAX_CONFIRMATIONS_PER_HOUR = 3;

// field: [max length, required]
const SPEC = {
  quote:  { name: [100, 1], phone: [30, 1], email: [120, 0], type: [40, 1], details: [2000, 0] },
  event:  { type: [40, 1], name: [100, 1], email: [120, 1], phone: [30, 0], org: [120, 0], when: [80, 0], city: [80, 0], details: [2000, 1] },
  travel: { trip: [60, 1], name: [100, 1], email: [120, 1], phone: [30, 0], where: [120, 0], when: [80, 0], pax: [4, 0], details: [2000, 0] },
  music:  { artist: [100, 1], email: [120, 1], title: [150, 1], type: [30, 0], links: [1600, 1], ig: [80, 0], tiktok: [80, 0], yt: [300, 0], gvo: [10, 0], engineer: [100, 0], notes: [1000, 0] },
  notify: { list: [40, 1], contact: [120, 1] },
  review: { who: [60, 0], item: [200, 1], answer: [40, 0], notes: [2000, 0] }, // the shop review page at /review/
  // The team-only photographer info page at /photographers/. Unused keys (shootname, portfolio, extras, location)
  // stay so the sheet's columns keep lining up with older rows.
  team:   { name: [100, 1], shootname: [100, 0], ig: [80, 1], portfolio: [300, 0], phone: [30, 1], email: [120, 1],
            shoots: [400, 1], video: [10, 1], rate: [20, 1], minimum: [40, 1], packages: [1500, 0], perhour: [10, 1],
            delivery: [40, 1], extras: [800, 0], deposit: [40, 1], location: [400, 0], payment: [200, 1],
            holiday: [10, 1], holidaynotes: [400, 0], days: [200, 1], notice: [40, 1], monthly: [40, 1],
            listing: [60, 1], contactby: [200, 0], booking: [300, 0], public: [10, 0],
            usage: [20, 1], credit: [120, 0], notes: [2000, 0] },
};
// Answers the photographer page offers. Anything else is refused. Keep in step with photographers/index.html.
const TEAM_ONE = {
  video: ['Yes', 'No'], public: ['Yes', 'No'],
  minimum: ['1 hour', '2 hours', 'No minimum'],
  delivery: ['1–3 days', '4–7 days', '1–2 weeks'],
  deposit: ['No deposit', '25%', '50%', 'Paid in full upfront'],
  holiday: ['Yes', 'Maybe', 'No'],
  notice: ['Same day', '24 hours', '2–3 days', '1 week'],
  monthly: ['1–3', '4–8', '9 or more', 'As many as possible'],
  listing: ['Yes, clients contact me', 'Yes, bookings go through GVO', 'Not right now'],
  usage: ['Yes', 'Ask me first', 'No'],
};
const TEAM_MANY = {
  shoots: ['Artist and music promo', 'Portraits and headshots', 'Brand and product', 'Grads', 'Maternity', 'Couples', 'Events', 'Behind-the-scenes content'],
  payment: ['Cash App', 'Zelle', 'Venmo', 'Apple Pay', 'Card', 'Cash'],
  days: ['Weekdays', 'Weeknights', 'Saturdays', 'Sundays'],
  contactby: ['Instagram DM', 'Text', 'Call', 'Email', 'Booking link'],
};
const withHttps = s => !s ? '' : /^https?:\/\//i.test(s) ? s.replace(/^http:/i, 'https:') : 'https://' + s;
const LISTS = ['Next event', 'Africa trip'];
const MUSIC_TYPES = ['Single', 'EP', 'Album or mixtape', 'Music video'];
const GVO_ANSWERS = ['Yes', 'Partly', 'No'];

const bad = msg => json({ ok: false, error: msg }, 400);

async function turnstileOk(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return true; // not set up yet: hidden field and timing still apply
  if (!token) return false;
  const body = new FormData();
  body.append('secret', env.TURNSTILE_SECRET); body.append('response', String(token).slice(0, 2048));
  if (ip) body.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    const j = await r.json();
    return !!j.success;
  } catch (e) { console.log('turnstile check failed', e && e.message); return false; }
}

export async function onRequestPost({ request, env, waitUntil }) {
  let b;
  try { b = await request.json(); } catch (e) { return bad('Something went wrong. Try again.'); }
  const spec = SPEC[b && b.form];
  if (!spec) return bad('Unknown form.');
  // Bots fill every field, or submit faster than a person can type. Pretend it worked.
  if ((b.hp && String(b.hp).trim()) || (typeof b.t === 'number' && b.t < 2500)) return json({ ok: true });
  if (!(await turnstileOk(env, b.ts, request.headers.get('CF-Connecting-IP')))) return json({ ok: false, code: 'TURNSTILE', error: "We couldn't confirm you're a person. Wait a second and try again." }, 400);

  const f = {};
  for (const [k, [max, req]] of Object.entries(spec)) {
    const v = clean((b.fields || {})[k] == null ? '' : String(b.fields[k]).replace(/\r?\n/g, k === 'links' ? '\n' : ' '), max);
    if (req && !v) return bad('Fill in every required field.');
    f[k] = v;
  }
  if (f.email && !EMAIL.test(f.email)) return bad('Check the email address.');
  if (f.phone) { if (phone(f.phone).length !== 10) return bad('Add a 10-digit phone number.'); f.phone = fmtPhone(f.phone); }
  if (b.form === 'music') {
    const links = String((b.fields || {}).links || '').split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
    if (!links.length) return bad('Add at least one link to your music.');
    if (links.length > 5) return bad('Add up to 5 links.');
    const badLink = links.find(x => !URL_RE.test(x) || x.length > 300);
    if (badLink) return bad('Each link should be a full address that starts with https://');
    f.links = links.join('\n');
    if (f.type && !MUSIC_TYPES.includes(f.type)) return bad('Pick a release type from the list.');
    if (f.gvo && !GVO_ANSWERS.includes(f.gvo)) return bad('Pick Yes, Partly or No for recorded at GVO.');
    if (f.gvo !== 'Yes' && f.gvo !== 'Partly') f.engineer = '';
    f.ig = handle(f.ig); f.tiktok = handle(f.tiktok);
    if (f.yt && !URL_RE.test(f.yt)) return bad('The YouTube channel should be a full link that starts with https://');
  }
  if (b.form === 'notify') {
    if (!LISTS.includes(f.list)) return bad('Unknown list.');
    const d = phone(f.contact);
    if (!EMAIL.test(f.contact) && d.length !== 10) return bad('Add an email or a 10-digit phone number.');
    if (!EMAIL.test(f.contact)) f.contact = fmtPhone(f.contact);
  }
  if (b.form === 'team') {
    const pick = 'Pick an answer from the list.';
    for (const [k, list] of Object.entries(TEAM_ONE)) if (f[k] && !list.includes(f[k])) return bad(pick);
    for (const [k, list] of Object.entries(TEAM_MANY)) if (f[k] && f[k].split(', ').some(x => !list.includes(x))) return bad(pick);
    f.ig = handle(f.ig.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, ''));
    const rate = f.rate.match(/^\$?\s*(\d{1,4})(?:\.\d{1,2})?\s*$/);
    if (!rate || +rate[1] < 1) return bad('Add your hourly rate as a number.');
    f.rate = '$' + rate[1] + '/hr';
    if (!/^\d{1,3}$/.test(f.perhour) || +f.perhour < 1) return bad('Add how many edited photos per hour as a number.');
    if (f.holiday === 'Yes' || f.holiday === 'Maybe') { if (!f.holidaynotes) return bad('Add the days and times you can take holiday shoots.'); }
    else f.holidaynotes = '';
    if (f.listing === 'Yes, clients contact me') {
      if (!f.contactby || !f.public) return bad('Say how clients should reach you.');
      f.booking = withHttps(f.booking);
      if (f.booking && !URL_RE.test(f.booking)) return bad('Check the booking link.');
    } else { f.contactby = ''; f.public = ''; f.booking = ''; }
    if (f.usage === 'No') f.credit = '';
    else if (!f.credit) return bad('Add how your photo credit should read.');
    f.shootname = ''; f.portfolio = ''; f.extras = ''; f.location = '';
  }
  if (f.pax && !/^\d{1,3}$/.test(f.pax)) return bad('Travelers should be a number.');
  if (b.form === 'review' && !f.answer && !f.notes) return bad('Pick an answer or add a note.');

  if (!env.FORMS_URL || !env.FORMS_SECRET) {
    console.log('form not sent: FORMS_URL or FORMS_SECRET missing', b.form);
    return json({ ok: false, error: 'This form is not connected yet. Call or text the studio at (443) 292-6753.' }, 503);
  }
  let saved;
  try {
    const r = await fetch(env.FORMS_URL, {
      method: 'POST', redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ secret: env.FORMS_SECRET, form: b.form, fields: f }),
    });
    const t = await r.text();
    try { saved = JSON.parse(t); } catch (e) { saved = {}; }
    if (!saved.ok) { console.log('form script error', r.status, t.slice(0, 300)); throw new Error('script'); }
  } catch (e) {
    return json({ ok: false, error: 'That did not send. Try again, or call or text the studio at (443) 292-6753.' }, 502);
  }

  // Confirmation: only after the row is saved, only to a real email, only while the key is set, and capped per address.
  const to = b.form === 'notify' ? f.contact : f.email;
  const recent = Number(saved.recent || 1);
  let confirmation = 'off';
  if (env.RESEND_API_KEY && EMAIL.test(to || '')) {
    if (recent > MAX_CONFIRMATIONS_PER_HOUR) { confirmation = 'limited'; console.log('confirmation skipped: limit', b.form, recent); }
    else {
      confirmation = 'sent';
      const mail = (async () => {
        const msg = formConfirmation(emailCfg(env, new URL(request.url).origin), b.form, f);
        if (msg) await sendEmail(env, msg);
      })().catch(e => console.log('confirmation error', e && e.message));
      if (waitUntil) waitUntil(mail); else await mail;
    }
  }
  return json({ ok: true, confirmation });
}
