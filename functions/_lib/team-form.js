// The team info form at /team/ (gvosound.com/photographers/ redirects there): the one place its questions live.
// The page draws itself from this list (GET /api/form?schema=team), the server checks answers against it,
// and the sheet adds a column for any new question on its own. To add, change or drop a question, edit QUESTIONS.
// Never reuse a key for a different question: the key names the sheet column.
//
// Question fields
//   key        sheet column id, stable forever
//   label      what the page asks; sheet  the column header (defaults to label)
//   type       text | email | tel | url | money | number | long | one (pick one) | many (pick any) | check | sign
//   required   true unless the question is optional
//   options    for one and many: plain text, or { v, note } to explain a choice under it
//   show       only asked when another answer matches: { key, is: [...] } or { key, has: 'option' } or { key, not: [...] }
//   requiredWhen  optional until another answer matches (same shape as show)
//   section note  a short line under a section title; section show hides the whole section
//   hint, placeholder, half (sits beside the next half field on wide screens), checked (check starts ticked)

export const TEAM_FORM = {
  version: 5,
  role: 'photo-video',
  title: 'Your rates and how clients reach you',
  intro: 'Your answers set the photo and video prices clients see and decide how bookings reach you. Mostly taps, about 3 minutes.',
  privacy: {
    title: 'Privacy notice',
    lines: [
      'Your answers are confidential. Only GVO Sound management and staff review them, and they are used to set photo and video pricing, schedule shoots and route client bookings.',
      'Nothing you share is published on gvosound.com without your consent, given in the Clients and the website section.',
      'Each person submits this form once. To update or remove your information, contact the studio at (443) 292-6753.',
    ],
  },
  sections: [
    { title: 'About you', questions: [
      { key: 'name', label: 'Full name', type: 'text', required: true, half: true, autocomplete: 'name' },
      { key: 'ig', label: 'Instagram', type: 'text', required: true, half: true, placeholder: '@yourhandle' },
      { key: 'usename', label: 'Use my full name on gvosound.com', type: 'check', checked: true, sheet: 'Site name is full name' },
      { key: 'shootname', label: 'Name to show on gvosound.com', type: 'text', required: true, show: { key: 'usename', is: ['No'] }, placeholder: 'The name clients know you by', sheet: 'Site name' },
      { key: 'phone', label: 'Phone', type: 'tel', required: true, half: true, placeholder: '(443) 555-0123' },
      { key: 'email', label: 'Email', type: 'email', required: true, half: true },
      { key: 'portfolio', label: 'Website', type: 'url', placeholder: 'yoursite.com', sheet: 'Website', requiredWhen: { key: 'contactby', has: 'Website' } },
    ] },
    { title: 'What you shoot', questions: [
      { key: 'services', label: 'What do you offer?', type: 'one', required: true, options: ['Photo only', 'Video only', 'Photo and video'], sheet: 'Offers' },
      { key: 'shoots', label: 'Shoot types', type: 'many', required: true, options: ['Artist and music promo', 'Portraits and headshots', 'Brand and product', 'Grads', 'Maternity', 'Couples', 'Events', 'Music videos', 'Behind-the-scenes content', 'Other'] },
      { key: 'shootsother', label: 'Other shoot types', type: 'text', required: true, show: { key: 'shoots', has: 'Other' }, placeholder: 'Pets, real estate, food', sheet: 'Other shoot types' },
    ] },
    { title: 'Pricing', note: 'Clients pay GVO for the studio room only. Your rate is between you and the client, and they pay you directly.', questions: [
      { key: 'rate', label: 'Your hourly rate, paid to you', type: 'money', required: true, half: true, sheet: 'Studio rate' },
      { key: 'perhour', label: 'Edited photos per hour', type: 'number', required: true, half: true, placeholder: '15', show: { key: 'services', not: ['', 'Video only'] }, sheet: 'Edited photos per hour' },
      { key: 'videoout', label: 'What clients get from a video shoot', type: 'text', required: true, show: { key: 'services', is: ['Video only', 'Photo and video'] }, placeholder: '1 edited 60-second reel per hour', sheet: 'Video deliverables' },
      { key: 'minimum', label: 'Minimum booking', type: 'one', required: true, options: ['1 hour', '2 hours', 'No minimum'] },
      { key: 'delivery', label: 'How fast clients get their finished work', type: 'one', required: true, options: ['1–3 days', '4–7 days', '1–2 weeks'], sheet: 'Delivery time' },
      { key: 'deposit', label: 'Deposit', type: 'one', required: true, options: ['No deposit', '25%', '50%', 'Full upfront'] },
      { key: 'payment', label: 'How clients pay you', hint: 'GVO does not collect your fee.', type: 'many', required: true, options: ['Cash App', 'Zelle', 'Venmo', 'Apple Pay', 'Card', 'Cash'], sheet: 'Gets paid by' },
      { key: 'packages', label: 'Packages or extra costs', type: 'long', placeholder: '2 hrs, 30 edits, $___ · rush delivery +$___ · on location $___/hr', sheet: 'Packages and extras' },
    ] },
    { title: 'Holiday photo special', show: { key: 'services', not: ['', 'Video only'] }, special: {
        text: 'A quick seasonal shoot in the GVO photo studio, Nov 23 to Dec 23. This one works differently from your regular shoots: the client pays GVO one price for the room and the photos, and GVO pays you $100 per shoot.',
        deal: [['30 min', 'Shoot'], ['5–10', 'Edited photos'], ['$150', 'Client pays'], ['$100', 'You get']] },
      questions: [
      { key: 'holiday', label: 'Want to shoot holiday specials?', type: 'one', required: true, options: ['Yes', 'Maybe', 'No'], sheet: 'Holiday special' },
      { key: 'holidaynotes', label: 'Days and times you can take them', type: 'text', required: true, show: { key: 'holiday', is: ['Yes', 'Maybe'] }, placeholder: 'Weekends, weeknights after 5', sheet: 'Holiday availability' },
    ] },
    { title: 'Availability', questions: [
      { key: 'days', label: "When you're usually free", type: 'many', required: true, options: ['Weekdays', 'Weeknights', 'Saturdays', 'Sundays'], sheet: 'Usually free' },
      { key: 'notice', label: 'Notice you need', type: 'one', required: true, options: ['Same day', '24 hours', '2–3 days', '1 week'], sheet: 'Notice needed' },
      { key: 'monthly', label: 'GVO shoots you want a month', type: 'one', required: true, options: ['1–3', '4–8', '9 or more', 'As many as possible'], sheet: 'GVO shoots a month' },
    ] },
    { title: 'Clients and the website', questions: [
      { key: 'profile', label: 'Want a profile on gvosound.com?', hint: "Your name, Instagram and the shoots you do, on gvosound.com.", type: 'one', required: true, options: ['Yes', 'Not right now'], sheet: 'Profile on site' },
      { key: 'bookvia', label: 'How should clients book you?', type: 'one', required: true, show: { key: 'profile', is: ['Yes'] }, sheet: 'Clients book', options: [
        { v: 'Through GVO', note: 'Clients pick you when they book the photo studio on gvosound.com. They pay GVO for the room and pay you directly for the shoot. GVO sends you the booking.' },
        { v: 'Directly with me', note: 'Your profile shows how to reach you, and you set up the shoot yourself.' },
        { v: 'Either way', note: 'Clients can book you with the studio or reach out to you.' },
      ] },
      { key: 'contactby', label: 'How clients should reach you', type: 'many', required: true, show: { key: 'bookvia', is: ['Directly with me', 'Either way'] }, options: ['Instagram DM', 'Text', 'Call', 'Email', 'Booking link', 'Website'], sheet: 'Clients reach them by' },
      { key: 'public', label: 'OK to show your phone or email on your profile?', type: 'one', required: true, show: { key: 'bookvia', is: ['Directly with me', 'Either way'] }, options: ['Yes', 'No'], sheet: 'Contact info public' },
      { key: 'booking', label: 'Your booking link', type: 'url', required: true, show: { key: 'contactby', has: 'Booking link' }, placeholder: 'yourbookingsite.com', sheet: 'Booking link' },
    ] },
    { title: 'Using your work', questions: [
      { key: 'usage', label: 'Can GVO use your photos and video from studio shoots on its site and in ads, with credit to you?', type: 'one', required: true, options: ['Yes', 'Ask me first', 'No'], sheet: 'GVO can use their work' },
      { key: 'credit', label: 'How the credit should read', type: 'text', required: true, show: { key: 'usage', not: ['', 'No'] }, placeholder: 'Shot by @yourhandle', sheet: 'Credit as' },
      { key: 'notes', label: 'Anything else GVO should know', type: 'long', sheet: 'Anything else' },
    ] },
    { title: 'Sign and send', questions: [
      { key: 'agree', label: "My answers are accurate, and I'll tell GVO when my rates or availability change.", type: 'check', required: true, sheet: 'Confirmed' },
      { key: 'signature', label: 'Type your full name to sign', type: 'sign', required: true, sheet: 'Signature' },
    ] },
  ],
};

const ALL = TEAM_FORM.sections.flatMap(s => s.questions.map(q => (s.show && !q.show ? { ...q, show: s.show } : q)));
const opts = q => (q.options || []).map(o => (typeof o === 'string' ? o : o.v));
const MAX = { long: 1500, text: 120, url: 300, email: 120, tel: 30, money: 12, number: 4, one: 60, many: 300, check: 4, sign: 120 };
const URL_RE = /^https:\/\/[^\s/$.?#][^\s]*\.[^\s]+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const digits = s => String(s || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');

const matches = (c, a) => {
  const v = a[c.key] || '';
  if (c.is) return c.is.includes(v);
  if (c.not) return !c.not.includes(v);
  if (c.has) return v.split(', ').includes(c.has);
  return true;
};
export const shown = (q, a) => !q.show || matches(q.show, a);
export const needed = (q, a) => !!q.required || (!!q.requiredWhen && matches(q.requiredWhen, a));

// Checks the answers. Returns { fields, columns } or { error }. Hidden questions are blanked.
export function checkTeam(raw, clean) {
  const a = {};
  for (const q of ALL) {
    let v = raw && raw[q.key] != null ? String(raw[q.key]) : '';
    v = q.type === 'long' ? clean(v.replace(/\r?\n/g, ' '), MAX.long) : clean(v, MAX[q.type] || 120);
    if (q.type === 'check') v = v === 'Yes' ? 'Yes' : 'No';
    a[q.key] = v;
  }
  for (const q of ALL) {
    if (!shown(q, a)) { a[q.key] = ''; continue; }
    const v = a[q.key];
    if (needed(q, a) && (!v || (q.type === 'check' && v !== 'Yes'))) return { error: `Answer "${q.label}" before sending.` };
    if (!v) continue;
    if (q.type === 'one' && !opts(q).includes(v)) return { error: 'Pick an answer from the list.' };
    if (q.type === 'many' && v.split(', ').some(x => !opts(q).includes(x))) return { error: 'Pick answers from the list.' };
    if (q.type === 'email' && !EMAIL.test(v)) return { error: 'Check the email address.' };
    if (q.type === 'tel') { const d = digits(v); if (d.length !== 10) return { error: 'Add a 10-digit phone number.' }; a[q.key] = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`; }
    if (q.type === 'url') { const u = /^https?:\/\//i.test(v) ? v.replace(/^http:/i, 'https:') : 'https://' + v; if (!URL_RE.test(u)) return { error: `Check the link for "${q.label}".` }; a[q.key] = u; }
    if (q.type === 'money') { const m = v.match(/^\$?\s*(\d{1,4})(?:\.\d{1,2})?\s*$/); if (!m || +m[1] < 1) return { error: 'Add your hourly rate as a number.' }; a[q.key] = '$' + m[1] + '/hr'; }
    if (q.type === 'number' && (!/^\d{1,3}$/.test(v) || +v < 1)) return { error: `Add a number for "${q.label}".` };
    if (q.type === 'sign' && v.replace(/[^a-z]/gi, '').length < 2) return { error: 'Type your full name to sign.' };
  }
  a.ig = a.ig ? '@' + a.ig.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').replace(/^@?/, '') : '';
  a.role = TEAM_FORM.role;
  a.signed = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' }) + ' ET';
  a.formversion = String(TEAM_FORM.version);
  a.sid = clean(String((raw && raw.sid) || ''), 40).replace(/[^\w-]/g, '');
  // [key, sheet column header, question as asked]. The sheet uses the first two; the confirmation email the third.
  const columns = [['role', 'Role']].concat(ALL.map(q => [q.key, q.sheet || q.label, q.label]), [['signed', 'Signed at'], ['formversion', 'Form version'], ['sid', 'Submission ID']]);
  return { fields: a, columns };
}

// What the page needs to draw the form. No server-only details.
export const teamSchema = () => TEAM_FORM;
