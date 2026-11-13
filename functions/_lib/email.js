// Confirmation emails, sent through Resend (resend.com) with the RESEND_API_KEY secret.
// Square sends no receipt email for orders placed through its API, so the site sends its own:
//   - the customer gets an order confirmation
//   - Cory gets a copy of every web order
//   - the studio gets an alert for every booking (BOOKING_ALERT_TO), with any merch to bag in the same email
// Square sends no staff notification for bookings created through the Bookings API, so that alert is the only
// heads-up the studio gets. Square Appointments still texts and emails the customer their confirmation.
// Email never blocks a sale: if the key is missing or Resend is down, the order still goes through.
import { cents } from './square.js';
import { SITE_NAMES } from './site-products.js';

export const STUDIO = {
  name: 'GVO Sound',
  street: '109 Gibralter Ave',
  city: 'Annapolis, MD 21401',
  phone: '(443) 292-6753',
  tel: '+14432926753',
  gmail: 'gvosoundllc@gmail.com',
};

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = c => '$' + (c / 100).toFixed(2);
const phoneFmt = e => { const d = String(e || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : String(e || ''); };
const DAY = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

export function emailCfg(env, origin) {
  return {
    key: env.RESEND_API_KEY || '',
    from: env.EMAIL_FROM || 'GVO Sound Clothing <clothing@gvosound.com>', // shop orders
    infoFrom: env.EMAIL_FROM_INFO || 'GVO Sound <info@gvosound.com>',   // forms and studio notes
    alertTo: (env.ORDER_ALERT_TO || STUDIO.gmail).split(/[\s,]+/).filter(Boolean),
    bookingAlertTo: (env.BOOKING_ALERT_TO || 'gvosoundllc@gmail.com,cmcghee@gvosound.com').split(/[\s,]+/).filter(Boolean),
    replyTo: env.EMAIL_REPLY_TO || STUDIO.gmail,
    site: (env.SITE_URL || 'https://gvosound.com').replace(/\/$/, ''), // links in emails always point at the live domain
  };
}

export async function sendEmail(env, msg) {
  if (!env.RESEND_API_KEY) { console.log('email skipped: RESEND_API_KEY not set', msg.subject); return { skipped: true }; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  if (!r.ok) { console.log('email failed', r.status, await r.text().catch(() => '')); return { ok: false }; }
  return { ok: true };
}

// One line per item as the site names it: "Worker Jacket · L, Tan × 1".
export function emailLines(order, idx) {
  return (order.line_items || []).map(li => {
    const hit = idx && idx.get(li.catalog_object_id);
    const name = hit ? (SITE_NAMES[hit.p.siteId] || hit.p.name) : li.name;
    const opts = hit ? (hit.v.key !== '-' ? hit.v.key.split('/').join(', ') : '') : (li.variation_name && !/^regular$/i.test(li.variation_name) ? li.variation_name : '');
    return { name, opts, qty: Number(li.quantity), gross: cents(li.gross_sales_money), discount: cents(li.total_discount_money) };
  });
}

function totalsOf(order) {
  const discount = cents(order.total_discount_money);
  const gross = (order.line_items || []).reduce((a, li) => a + cents(li.gross_sales_money), 0);
  return { gross, discount, ship: cents(order.total_service_charge_money), tax: cents(order.total_tax_money), total: cents(order.total_money) };
}

function addressLines(a) {
  if (!a) return [];
  const cityLine = [a.locality, [a.administrative_district_level_1, a.postal_code].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  return [a.address_line_1, a.address_line_2, cityLine, a.country && a.country !== 'US' ? a.country : ''].filter(Boolean);
}

/* ---------- layout: table-based, inline styles, works in Gmail, Apple Mail and Outlook ---------- */
const C = { ink: '#07060a', bone: '#f3f0ea', paper: '#ffffff', text: '#1b1820', mute: '#6b6475', line: '#e3dee6', lav: '#b9b2ff', lavInk: '#120f26', tag: '#c62a23' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

function shell({ site, preheader, body, staff = false, footer = true }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>GVO Sound</title></head>
<body style="margin:0;padding:0;background:${C.bone};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.bone};">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.bone}" style="background:${C.bone};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
<tr><td bgcolor="${C.ink}" style="background:${C.ink};padding:22px 28px;border-radius:8px 8px 0 0;">
 <a href="${site}" style="text-decoration:none;"><img src="${site}/img/email-logo.png" width="80" height="60" alt="GVO Sound" style="display:block;border:0;"></a>
</td></tr>
<tr><td bgcolor="${C.paper}" style="background:${C.paper};padding:28px 28px 8px;font-family:${FONT};color:${C.text};font-size:15px;line-height:1.55;">
${body}
</td></tr>
<tr><td bgcolor="${C.paper}" style="background:${C.paper};padding:8px 28px 28px;border-radius:0 0 8px 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.mute};">
 ${!footer ? `<p style="margin:0;border-top:1px solid ${C.line};padding-top:4px;"></p>` : staff ? `<p style="margin:0;border-top:1px solid ${C.line};padding-top:18px;">Sent by gvosound.com. Reply to reach the customer.</p>` : `<p style="margin:0;border-top:1px solid ${C.line};padding-top:18px;">Questions? Call or text <a href="sms:${STUDIO.tel}" style="color:${C.text};">${STUDIO.phone}</a>, or reply to this email.</p>`}
</td></tr>
<tr><td align="center" style="padding:18px 12px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${C.mute};">
 GVO Sound LLC · ${STUDIO.street} · ${STUDIO.city}<br>Good Vibes Only
</td></tr>
</table></td></tr></table></body></html>`;
}

const h1 = t => `<h1 style="margin:0 0 6px;font-family:${FONT};font-size:24px;line-height:1.2;font-weight:800;color:${C.text};">${esc(t)}</h1>`;
const p = (t, extra = '') => `<p style="margin:0 0 16px;${extra}">${t}</p>`;
const label = t => `<p style="margin:22px 0 8px;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.mute};">${esc(t)}</p>`;

function itemsTable(lines, t, shipLabel) {
  const row = (l, r, style = '') => `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};${style}">${l}</td><td align="right" style="padding:7px 0 7px 12px;border-bottom:1px solid ${C.line};white-space:nowrap;${style}">${r}</td></tr>`;
  const items = lines.map(l => row(`<b>${esc(l.name)}</b>${l.opts ? `<br><span style="color:${C.mute};font-size:13px;">${esc(l.opts)}</span>` : ''}${l.qty > 1 ? `<span style="color:${C.mute};"> × ${l.qty}</span>` : ''}`, usd(l.gross))).join('');
  const sums = [
    t.discount ? row('Sale', '−' + usd(t.discount), `color:${C.tag};`) : '',
    shipLabel ? row(esc(shipLabel), t.ship ? usd(t.ship) : 'Free') : '',
    t.tax ? row('MD sales tax 6%', usd(t.tax)) : '',
  ].join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${items}${sums}
<tr><td style="padding:12px 0 0;font-size:17px;font-weight:800;">Total</td><td align="right" style="padding:12px 0 0 12px;font-size:17px;font-weight:800;white-space:nowrap;">${usd(t.total)}</td></tr></table>`;
}

const button = (href, text) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 18px;"><tr><td bgcolor="${C.ink}" style="background:${C.ink};border-radius:6px;"><a href="${esc(href)}" style="display:inline-block;padding:13px 22px;font-family:${FONT};font-size:14px;font-weight:700;color:${C.bone};text-decoration:none;">${esc(text)}</a></td></tr></table>`;

/* ---------- customer order confirmation ---------- */
export function orderConfirmation(cfg, { order, idx, contact, fulfillment, payment }) {
  const ship = fulfillment.type === 'ship';
  const lines = emailLines(order, idx), t = totalsOf(order);
  const first = (contact.name || '').split(/\s+/)[0] || 'there';
  const ref = order.reference_id || order.id;
  const when = DAY.format(new Date(order.created_at || Date.now()));
  const intl = ship && order.fulfillments && order.fulfillments[0].shipment_details.recipient.address.country !== 'US';
  const addr = ship ? addressLines(order.fulfillments[0].shipment_details.recipient.address) : [];
  const getIt = ship
    ? p(`${intl ? 'International standard shipping' : 'Standard shipping, 3 to 5 business days'}, to:<br><b>${esc(contact.name)}</b><br>${addr.map(esc).join('<br>')}`)
    : p(`Pick it up at the studio, <b>${STUDIO.street}, ${STUDIO.city}</b>. The studio lets you know when it is ready. Bring this email or your order number.`);
  const body = [
    h1(`Thanks for your order, ${first}.`),
    p(`Order <b>${esc(ref)}</b> · ${esc(when)}`, `color:${C.mute};font-size:14px;`),
    label('Your order'),
    itemsTable(lines, t, ship ? 'Shipping' : 'Pickup at GVO'),
    label(ship ? 'Shipping to' : 'Pickup'),
    getIt,
    payment && payment.receipt_url ? button(payment.receipt_url, 'View your Square receipt') : '',
  ].join('\n');
  const text = [
    `Thanks for your order, ${first}.`, `Order ${ref} · ${when}`, '',
    ...lines.map(l => `${l.name}${l.opts ? ' (' + l.opts + ')' : ''}${l.qty > 1 ? ' x ' + l.qty : ''}  ${usd(l.gross)}`),
    t.discount ? `Sale  -${usd(t.discount)}` : '', `${ship ? 'Shipping' : 'Pickup at GVO'}  ${t.ship ? usd(t.ship) : 'Free'}`, t.tax ? `MD sales tax 6%  ${usd(t.tax)}` : '', `Total  ${usd(t.total)}`, '',
    ship ? `Shipping to: ${contact.name}, ${addr.join(', ')}` : `Pickup: ${STUDIO.street}, ${STUDIO.city}. The studio lets you know when it is ready.`,
    payment && payment.receipt_url ? `Receipt: ${payment.receipt_url}` : '', '',
    `Questions? Call or text ${STUDIO.phone}, or reply to this email.`, `GVO Sound LLC · ${STUDIO.street} · ${STUDIO.city}`,
  ].filter(x => x !== '').join('\n');
  return {
    from: cfg.from, to: [contact.email], reply_to: cfg.replyTo,
    subject: `Your GVO Sound order ${ref}`,
    html: shell({ site: cfg.site, preheader: `${usd(t.total)} · ${ship ? 'ships in 3 to 5 business days' : 'pickup at 109 Gibralter Ave'}`, body }),
    text,
  };
}

/* ---------- Cory's copy: what to pull, where it goes ---------- */
export function orderAlert(cfg, { order, idx, contact, fulfillment }) {
  const ship = fulfillment.type === 'ship';
  const lines = emailLines(order, idx), t = totalsOf(order);
  const ref = order.reference_id || order.id;
  const addr = ship ? addressLines(order.fulfillments[0].shipment_details.recipient.address) : [];
  const ad = ship ? order.fulfillments[0].shipment_details.recipient.address : null;
  const where = ship ? `Ship to ${[ad.locality, ad.country === 'US' ? ad.administrative_district_level_1 : ad.country].filter(Boolean).join(', ')}` : 'Pickup at the studio';
  const body = [
    h1(`New web order: ${ship ? 'ship it' : 'pickup'}`),
    p(`Order <b>${esc(ref)}</b> · paid ${usd(t.total)}`, `color:${C.mute};font-size:14px;`),
    label('Pull these'),
    itemsTable(lines, t, ship ? 'Shipping paid' : 'Pickup'),
    label('Customer'),
    p(`<b>${esc(contact.name)}</b><br><a href="mailto:${esc(contact.email)}" style="color:${C.text};">${esc(contact.email)}</a>${contact.phone ? `<br>${esc(phoneFmt(contact.phone))}` : ''}`),
    label(ship ? 'Ship to' : 'Next step'),
    ship ? p(`${esc(contact.name)}<br>${addr.map(esc).join('<br>')}`) : p('Bag it, then text or email the customer that it is ready.'),
    button('https://app.squareup.com/dashboard/orders/overview', 'Open orders in Square'),
    p(ship ? 'Mark it shipped in Square once it goes out.' : 'Mark it picked up in Square when they collect it.', `color:${C.mute};font-size:13px;`),
  ].join('\n');
  return {
    from: cfg.from, to: cfg.alertTo, reply_to: contact.email || cfg.replyTo,
    subject: `New web order ${ref} · ${where} · ${usd(t.total)}`,
    html: shell({ site: cfg.site, preheader: `${lines.reduce((a, l) => a + l.qty, 0)} item(s) · ${where}`, body, staff: true }),
    text: [`New web order ${ref}, paid ${usd(t.total)}`, where, '', ...lines.map(l => `${l.name}${l.opts ? ' (' + l.opts + ')' : ''} x ${l.qty}`), '', `${contact.name} · ${contact.email}${contact.phone ? ' · ' + phoneFmt(contact.phone) : ''}`, ship ? addr.join(', ') : 'Pickup at the studio'].join('\n'),
  };
}

/* ---------- studio alert for every web booking, with any merch to bag ---------- */
const hrs = m => { const h = m / 60; return h === 1 ? '1 hour' : Number.isInteger(h) ? `${h} hours` : `${m} minutes`; };
export function bookingAlert(cfg, { order, idx, contact, when, session, team, mins, people, notes, photographer, total, ref, status }) {
  const PENDING = "Square shows this booking as pending. Open it in Square Appointments and accept it so it holds the time.";
  const pending = !!status && status !== 'ACCEPTED';
  const merch = emailLines(order, idx).slice(1); // first line is the session
  const tel = String(contact.phone || '').replace(/\D/g, '').replace(/^(?=\d{10}$)/, '1');
  const photo = photographer && photographer !== 'none' ? String(photographer) : '';
  const row = (k, v) => `<tr><td valign="top" style="padding:7px 12px 7px 0;border-bottom:1px solid ${C.line};color:${C.mute};white-space:nowrap;">${k}</td><td style="padding:7px 0;border-bottom:1px solid ${C.line};">${v}</td></tr>`;
  const body = [
    pending ? p(`<b>${PENDING}</b>`, `background:#fde4e1;border-left:3px solid #c62a23;padding:10px 12px;font-size:14px;`) : '',
    h1(`New booking: ${esc(session)}`),
    p(`<b>${esc(when)}</b> (Eastern) · booking ${esc(ref)}`, `color:${C.mute};font-size:14px;`),
    p(`<b>This booking is paid. In Square Appointments it will still show as due. Don't check it out.</b>`, `background:#fff4d6;border-left:3px solid #c98a00;padding:10px 12px;font-size:14px;`),
    label('Session'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${[
      row('Session', esc(session)),
      row('When', `${esc(when)} ET`),
      row('Length', esc(hrs(mins))),
      row('With', esc(team || 'Any available')),
      row('People', esc(people)),
      photo ? row('Photographer', `${esc(photo)} (paid separately)`) : '',
      row('Paid', `${usd(total)} online`),
      row('Code', esc(ref)),
    ].join('')}</table>`,
    label('Customer'),
    p(`<b>${esc(contact.name)}</b>${contact.phone ? `<br><a href="tel:+${tel}" style="color:${C.text};">${esc(phoneFmt(contact.phone))}</a>` : ''}${contact.email ? `<br><a href="mailto:${esc(contact.email)}" style="color:${C.text};">${esc(contact.email)}</a>` : ''}`),
    notes ? label('Customer notes') : '',
    notes ? p(esc(notes).replace(/\n/g, '<br>')) : '',
    merch.length ? label('Bag these items') : '',
    merch.length ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${merch.map(l => `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};"><b>${esc(l.name)}</b>${l.opts ? ` · ${esc(l.opts)}` : ''}</td><td align="right" style="padding:7px 0;border-bottom:1px solid ${C.line};">× ${l.qty}</td></tr>`).join('')}</table>` : '',
    merch.length ? p('Paid with the session. Have them at the front desk and mark the order picked up in Square when they collect it.', `color:${C.mute};font-size:13px;`) : '',
    button('https://app.squareup.com/appointments/calendar', 'Open the Appointments calendar'),
  ].filter(Boolean).join('\n');
  const text = [
    pending ? PENDING : '',
    `New booking: ${session}, ${when} ET`,
    "This booking is paid. In Square Appointments it will still show as due. Don't check it out.",
    `Length: ${hrs(mins)}`, `With: ${team || 'Any available'}`, `People: ${people}`,
    photo ? `Photographer: ${photo} (paid separately)` : '',
    `Paid: ${usd(total)}`, `Code: ${ref}`, '',
    contact.name, contact.phone ? phoneFmt(contact.phone) : '', contact.email || '',
    notes ? `\nNotes: ${notes}` : '',
    merch.length ? '\nBag these items:\n' + merch.map(l => `${l.name}${l.opts ? ' (' + l.opts + ')' : ''} x ${l.qty}`).join('\n') : '',
    '', 'Calendar: https://app.squareup.com/appointments/calendar',
  ].filter(x => x !== '').join('\n');
  return {
    from: cfg.infoFrom, to: cfg.bookingAlertTo, reply_to: contact.email || cfg.replyTo,
    subject: `New booking: ${session}, ${when}, ${contact.name}`,
    html: shell({ site: cfg.site, preheader: `${hrs(mins)} · ${people} ${people === 1 ? 'person' : 'people'} · ${usd(total)} paid${merch.length ? ' · merch to bag' : ''}`, body, staff: true }),
    text,
  };
}

/* ---------- form confirmations: sent to the person who filled in a form ---------- */
const FORM_LABELS = {
  quote: [['type', 'Project'], ['name', 'Name or show'], ['phone', 'Phone'], ['email', 'Email'], ['details', 'Details']],
  event: [['type', 'Inquiry type'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['org', 'Company or venue'], ['when', 'Event date'], ['city', 'City'], ['details', 'Details']],
  travel: [['trip', 'Trip'], ['name', 'Name'], ['email', 'Email'], ['phone', 'Phone'], ['where', 'Where to'], ['when', 'When'], ['pax', 'Travelers'], ['details', 'Details']],
  music: [['artist', 'Artist'], ['email', 'Email'], ['title', 'Song or project'], ['type', 'Type'], ['links', 'Links'], ['ig', 'Instagram'], ['tiktok', 'TikTok'], ['yt', 'YouTube'], ['gvo', 'Recorded at GVO'], ['engineer', 'GVO engineer or producer'], ['notes', 'Anything else']],
  notify: [['contact', 'Email']],
};
const TRIP_PHRASE = { "Valentine's cruise": "the Valentine's cruise", 'Next group trip': 'the next group trip', 'Private trip': 'a private trip', 'Custom itinerary': 'a custom itinerary' };

function answers(form, f) {
  return (FORM_LABELS[form] || []).filter(([k]) => f[k]).map(([k, l, asked]) => [asked || l, String(f[k])]);
}

export function formConfirmation(cfg, form, f, columns) {
  const first = String(f.name || f.artist || '').trim().split(/\s+/)[0];
  const hi = first ? `Hi ${first},` : '';
  const call = (lead) => `${lead} Call or text <a href="sms:${STUDIO.tel}" style="color:${C.text};">${STUDIO.phone}</a>.`;
  let subject, intro, close = '', closeText = '';
  if (form === 'quote') {
    subject = 'We got your quote request';
    intro = `Thanks for reaching out to GVO Sound. Your podcast and video request is in. Expect a call at ${f.phone} from ${STUDIO.phone} within 48 hours with your quote.`;
    close = call('Need something sooner?'); closeText = `Need something sooner? Call or text ${STUDIO.phone}.`;
  } else if (form === 'event') {
    subject = 'Your event inquiry is in';
    intro = `Thanks for reaching out about ${f.when ? 'your event on ' + f.when : 'your event'}. Someone from the GVO team will reply by email within 48 hours.`;
    close = call('Anything urgent?'); closeText = `Anything urgent? Call or text ${STUDIO.phone}.`;
  } else if (form === 'travel') {
    subject = 'Your trip request is in';
    intro = `Thanks for your interest in ${TRIP_PHRASE[f.trip] || 'your trip'}. The GVO team will reply by email within 48 hours with details for that trip.`;
    close = call('Questions before then?'); closeText = `Questions before then? Call or text ${STUDIO.phone}.`;
  } else if (form === 'music') {
    subject = 'We got your music';
    intro = 'Thanks for sending your music to GVO Sound. Songs picked for the site go up on the music page at gvosound.com/music.';
  } else if (form === 'notify' && f.list === 'Next event') {
    subject = "You're on the GVO events list";
    intro = "You're on the list for GVO Sound events. When a new date drops, you get an email with the flyer and ticket link. That's all this list is for.";
    close = 'Want off the list? Reply "remove" and you\'re out.'; closeText = close;
  } else if (form === 'notify' && f.list === 'Africa trip') {
    subject = "You're on the list for the Africa trip";
    intro = "You're on the list for the GVO Sound group trip to Africa. When the dates are set, you get one email with the details. That's all this list is for.";
    close = 'Want off the list? Reply "remove" and you\'re out.'; closeText = close;
  } else if (form === 'team') {
    // Team info form: a record of every answer they gave, in the form's own words (columns from team-form.js)
    subject = 'Your GVO Sound team info, for your records';
    intro = `Thanks for sending your rates and details to GVO Sound. Here is a copy of everything you submitted, signed ${f.signed}. Keep it for your records.`;
    close = `Need to change something? Call or text the studio at <a href="sms:${STUDIO.tel}" style="color:${C.text};">${STUDIO.phone}</a>.`;
    closeText = `Need to change something? Call or text the studio at ${STUDIO.phone}.`;
  } else return null;

  const skip = ['role', 'formversion', 'signed', 'agree'];
  const ans = form === 'team'
    ? (columns || []).filter(([k]) => f[k] && !skip.includes(k)).map(([k, l, asked]) => [asked || l, String(f[k])])
    : answers(form, form === 'notify' ? { contact: f.contact } : f);
  // Team answers have long questions, so each one stacks: the question, then the answer under it.
  const stack = ([l, v]) => `<tr><td style="padding:9px 0;border-bottom:1px solid ${C.line};vertical-align:top;"><div style="font-size:12px;line-height:1.4;color:${C.mute};">${esc(l)}</div><div style="font-size:14px;line-height:1.45;margin-top:2px;">${esc(v).replace(/\n/g, '<br>')}</div></td></tr>`;
  const row = ([l, v]) => `<tr><td style="padding:7px 12px 7px 0;border-bottom:1px solid ${C.line};color:${C.mute};white-space:nowrap;vertical-align:top;">${esc(l)}</td><td style="padding:7px 0;border-bottom:1px solid ${C.line};vertical-align:top;">${esc(v).replace(/\n/g, '<br>')}</td></tr>`;
  const body = [
    hi ? p(esc(hi)) : '',
    p(esc(intro)),
    label('What you sent'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${ans.map(form === 'team' ? stack : row).join('')}</table>`,
    close ? p(close, 'margin-top:18px;') : '',
  ].join('\n');
  const text = [hi, intro, '', 'What you sent', ...ans.map(([l, v]) => `${l}: ${v.replace(/\n/g, ', ')}`), '', closeText,
    '', `GVO Sound LLC · ${STUDIO.street} · ${STUDIO.city}`].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim();
  return {
    from: cfg.infoFrom, to: [f.email || f.contact], reply_to: cfg.replyTo,
    subject,
    html: shell({ site: cfg.site, preheader: intro.slice(0, 110), body, footer: false }),
    text,
  };
}
