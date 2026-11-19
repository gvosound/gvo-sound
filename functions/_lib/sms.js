// Booking alert texts to GVO staff, through Twilio. The program is the one registered with Twilio and
// described at gvosound.com/sms-alerts: staff only, one text per booking, no marketing, nothing to customers.
//
// Secrets (Cloudflare): TWILIO_ACCOUNT_SID, TWILIO_API_KEY and TWILIO_API_SECRET (an API key made in the
// Twilio console; TWILIO_AUTH_TOKEN works in their place), TWILIO_FROM (the verified toll-free number,
// +18773025139) and BOOKING_SMS_TO (staff mobile numbers, comma separated, like +14435550101).
// With any of them missing, no text is sent and the booking goes ahead as usual.

const e164 = s => { const d = String(s || '').replace(/[^\d+]/g, ''); if (/^\+\d{10,15}$/.test(d)) return d; const n = d.replace(/\D/g, ''); return n.length === 10 ? '+1' + n : n.length === 11 && n[0] === '1' ? '+' + n : ''; };

export function smsCfg(env) {
  const user = env.TWILIO_API_KEY || env.TWILIO_ACCOUNT_SID;
  const pass = env.TWILIO_API_KEY ? env.TWILIO_API_SECRET : env.TWILIO_AUTH_TOKEN;
  const to = String(env.BOOKING_SMS_TO || '').split(/[\s,]+/).map(e164).filter(Boolean);
  const from = e164(env.TWILIO_FROM);
  if (!env.TWILIO_ACCOUNT_SID || !user || !pass || !from || !to.length) return null;
  return { sid: env.TWILIO_ACCOUNT_SID, auth: 'Basic ' + btoa(user + ':' + pass), from, to };
}

// One message to one number. Returns { ok, to, status, code } and never throws.
async function send(c, to, body) {
  try {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`, {
      method: 'POST', headers: { Authorization: c.auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ To: to, From: c.from, Body: body }),
    });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, to: to.slice(-4), status: j.status || r.status, code: j.code || null };
  } catch (e) {
    return { ok: false, to: to.slice(-4), status: 'error', code: e && e.message };
  }
}

// The booking text: session, date and time, the customer's first name and phone, the amount paid.
// Kept short enough for one or two segments.
export function bookingText({ session, when, contact, total, ref, status }) {
  const first = String((contact && contact.name) || '').trim().split(/\s+/)[0] || 'A customer';
  const phone = (contact && contact.phone) || 'no phone';
  const paid = '$' + (total / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `GVO booking: ${session}, ${when}. ${first}, ${phone}. Paid ${paid} online, ${ref}.` +
    (status && status !== 'ACCEPTED' ? ' Pending in Square: accept it in Appointments.' : '') +
    ' Reply STOP to opt out.';
}

// Texts every number in BOOKING_SMS_TO. Logs the last 4 digits and Twilio's status, never the message.
export async function bookingSms(env, alert) {
  const c = smsCfg(env);
  if (!c) { console.log('booking text skipped: Twilio settings not complete', alert.ref); return []; }
  const body = bookingText(alert);
  const out = await Promise.all(c.to.map(n => send(c, n, body)));
  for (const r of out) console.log(r.ok ? 'booking text sent' : 'booking text not sent', alert.ref, '…' + r.to, r.status, r.code || '');
  return out;
}
