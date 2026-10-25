// Confirmation emails, sent through Resend (resend.com) with the RESEND_API_KEY secret.
// Square sends no receipt email for orders placed through its API, so the site sends its own:
//   - the customer gets an order confirmation
//   - Cory gets a copy of every web order, and a front-desk note when a booking includes merch
// Bookings themselves are confirmed by Square Appointments (text and email), so no customer email for those.
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
    replyTo: env.EMAIL_REPLY_TO || STUDIO.gmail,
    site: (env.SITE_URL || origin || 'https://www.gvosound.com').replace(/\/$/, ''),
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

/* ---------- front-desk note when a booking includes merch ---------- */
export function bookingMerchAlert(cfg, { order, idx, contact, when, session, team }) {
  const lines = emailLines(order, idx).slice(1); // first line is the session
  if (!lines.length) return null;
  const ref = order.reference_id || order.id;
  const body = [
    h1('Bag merch for a session'),
    p(`<b>${esc(contact.name)}</b> · ${esc(when)}${team ? ' with ' + esc(team) : ''}<br>${esc(session)} · booking ${esc(ref)}`, `color:${C.mute};font-size:14px;`),
    label('Have these at the front desk'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${lines.map(l => `<tr><td style="padding:7px 0;border-bottom:1px solid ${C.line};"><b>${esc(l.name)}</b>${l.opts ? ` · ${esc(l.opts)}` : ''}</td><td align="right" style="padding:7px 0;border-bottom:1px solid ${C.line};">× ${l.qty}</td></tr>`).join('')}</table>`,
    p('Paid online with the session. Mark the order picked up in Square when they collect it.', `color:${C.mute};font-size:13px;`),
  ].join('\n');
  return {
    from: cfg.infoFrom, to: cfg.alertTo, reply_to: contact.email || cfg.replyTo,
    subject: `Bag merch for ${contact.name}, ${when}`,
    html: shell({ site: cfg.site, preheader: `${lines.length} item(s) for a session`, body, staff: true }),
    text: [`Bag merch for ${contact.name}, ${when}`, ...lines.map(l => `${l.name}${l.opts ? ' (' + l.opts + ')' : ''} x ${l.qty}`)].join('\n'),
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
  return (FORM_LABELS[form] || []).filter(([k]) => f[k]).map(([k, l]) => [l, String(f[k])]);
}

export function formConfirmation(cfg, form, f) {
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
    subject = "You're on the list for the next GVO event";
    intro = "You're on the list for the next GVO Sound event. When the date and flyer drop, you get one email about it. That's all this list is for.";
    close = 'Want off the list? Reply "remove" and you\'re out.'; closeText = close;
  } else if (form === 'notify' && f.list === 'Africa trip') {
    subject = "You're on the list for the Africa trip";
    intro = "You're on the list for the GVO Sound group trip to Africa. When the dates are set, you get one email with the details. That's all this list is for.";
    close = 'Want off the list? Reply "remove" and you\'re out.'; closeText = close;
  } else return null;

  const ans = answers(form, form === 'notify' ? { contact: f.contact } : f);
  const row = ([l, v]) => `<tr><td style="padding:7px 12px 7px 0;border-bottom:1px solid ${C.line};color:${C.mute};white-space:nowrap;vertical-align:top;">${esc(l)}</td><td style="padding:7px 0;border-bottom:1px solid ${C.line};vertical-align:top;">${esc(v).replace(/\n/g, '<br>')}</td></tr>`;
  const body = [
    hi ? p(esc(hi)) : '',
    p(esc(intro)),
    label('What you sent'),
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="font-size:14px;">${ans.map(row).join('')}</table>`,
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
