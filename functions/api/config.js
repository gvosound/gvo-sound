// Public settings the browser needs to start Square's payment form. No secrets here.
import { cfg, json } from '../_lib/square.js';

export async function onRequestGet({ env }) {
  const c = cfg(env);
  return json({ appId: c.appId, locationId: c.locationId, live: !!c.token, sandbox: env.SQUARE_ENV === 'sandbox', turnstileSiteKey: env.TURNSTILE_SITE_KEY || '' });
}
