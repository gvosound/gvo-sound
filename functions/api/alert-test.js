// TEMPORARY: sends one sample booking alert to BOOKING_ALERT_TO and returns what Resend said.
// Recipients are fixed by the env var, so this can only ever email the studio. Remove after the alert is confirmed.
import { emailCfg, bookingAlert } from '../_lib/email.js';

export async function onRequestPost({ request, env }) {
  const cfg = emailCfg(env, new URL(request.url).origin);
  const out = { keySet: !!env.RESEND_API_KEY, from: cfg.infoFrom, to: cfg.bookingAlertTo };
  if (!env.RESEND_API_KEY) return Response.json({ ...out, sent: false, why: 'RESEND_API_KEY not set' });
  const msg = bookingAlert(cfg, {
    order: { line_items: [{ name: 'Session', quantity: '1' }] }, idx: null,
    contact: { name: 'Test Customer', phone: '4432926753', email: '' },
    when: 'Sat, Nov 7, 2:00 PM', session: 'TEST alert (no booking)', team: 'Test', mins: 120, people: 1,
    notes: 'This is a test of the booking alert. No booking was made.', photographer: '', total: 0, ref: 'BK-TEST0000',
  });
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(msg),
  });
  return Response.json({ ...out, sent: r.ok, status: r.status, resend: await r.text().catch(() => '') });
}
