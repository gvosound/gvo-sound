# Runbook

Fixes for what has gone wrong before or is likely to. Newest lessons first in each section.

## Deploys

| Symptom | Cause | Fix |
| --- | --- | --- |
| A push doesn't show on the live site | Cloudflare's Git link broke (it did when the repo moved from sianibutler-sys to gvosound on Oct 28, 2026), or production rolled back to an older build | Cloudflare, Workers & Pages, gvo-sound, Deployments: check the latest commit. Retry it, or reconnect Settings, Builds, Git repository to gvosound/gvo-sound |
| A new secret has no effect | Secrets apply on the next deployment | Deployments, Retry on the latest |
| `/privacy`, `/terms` or `/sms-alerts` shows the homepage | The static files are missing | Run `python3 legal-src/build.py` and push the three `.html` files |
| A new `/api/x` returns the homepage | No function file at `functions/api/x.js`, or `_routes.json` excludes it | Add the file; keep `"include": ["/api/*"]` |

## Shop and checkout

| Symptom | Fix |
| --- | --- |
| A Square item isn't on the site | Add its item ID to `PINNED` in `functions/_lib/site-products.js`. `/api/shop?debug=1` shows every Square item and why it is on or off |
| Wrong photos on a product | `PHOTOS` in `index.html`, keyed by site product ID, each photo tagged with its Square color name |
| Checkout says the total changed | Square repriced (sale ended, stock moved). Expected; the shopper pays the new total |
| Card works, Apple Pay missing | Register gvosound.com for Apple Pay in the Square Developer Dashboard |

## Bookings

| Symptom | Fix |
| --- | --- |
| Booking shows "$ due" in Square | Expected; see ARCHITECTURE known limits. The seller note says it's paid |
| Booking "isn't on the calendar" | The Square calendar was set to View: Only me, which hides bookings assigned to other team members (found Nov 6, 2026). Set View to all team members. A "Pending confirmation" label on the customer may still show; if a booking stays pending, check the `status` Square returns from `POST /v2/bookings` |
| No booking alert email | Check `RESEND_API_KEY` is set and Cloudflare's function logs for "booking alert skipped". Recipients are `BOOKING_ALERT_TO` |
| Every 2-hour booking lands on the "Boobie" variation | It's the only 2-hour recording variation open for online booking in Square. Rename it there |
| A team member shouldn't take online bookings | Add their display name pattern to `OFF_TEAM` in `functions/_lib/booking.js` |
| Two sessions in one room at the same time | Before Nov 12, 2026 the booking desk asked Square for each team member's free time and never checked the room, so two photographers could each take the photo studio at noon. Now `searchSlots` drops any time where the room is full (`ROOMS_CAP` in `functions/_lib/booking.js`), and `/api/book` checks the room again, fresh, before charging and after. `/api/availability?debug=room&date=YYYY-MM-DD` lists the day's sessions by room. A clash can still come from bookings made by hand in Square, which doesn't know about rooms |
| Booking fails after payment | `/api/book` refunds automatically and logs "booking failed after payment" with the payment ID. If the refund also failed, refund under Square Transactions |

## Forms and the sheet

| Symptom | Fix |
| --- | --- |
| Forms say "not connected" | `FORMS_URL` or `FORMS_SECRET` missing in Cloudflare |
| Forms fail after editing the Apps Script | The script wasn't redeployed. Deploy, Manage deployments, edit, Version: New version. Keep the same deployment so the URL stays |
| A new tab is needed | Add it to `FORMS` in the script; `makeTab` creates it on first use |
| Reviews part missing from `/api/reviews` | The `reviews` action isn't in the deployed script, or `setupReviews` never ran |

## Feeds

| Symptom | Fix |
| --- | --- |
| A video row is empty | `/api/videos?fresh=1` shows each playlist's status. Without `YOUTUBE_API_KEY` only the first 15 in playlist order come through |
| Instagram band stale | `/api/ig` keeps the last good list in KV. A token was revoked if one account fails: generate a new system-user token in the Meta app's "GVO website feed" configuration and replace its secret |
| Rating didn't change | Places is cached 24 hours. Check `GOOGLE_PLACES_KEY` is restricted to Places API (New) and billing is on in the Google Cloud project |

## Domain and email

| Symptom | Fix |
| --- | --- |
| Site down everywhere | Porkbun: domain paid and nameservers are marjory and peyton.ns.cloudflare.com. Cloudflare: zone Active, both custom domains on the Pages project |
| @gvosound.com mail stops | Cloudflare DNS must keep the five Google MX rows (gray cloud) and the SPF TXT `v=spf1 include:_spf.google.com -all` |
| Site emails land in spam | Resend's records in Cloudflare (send, rsend, resend._domainkey, _dmarc) must stay |

## Texts (Twilio)

| Symptom | Fix |
| --- | --- |
| No texts, error 30032 | Toll-free number not verified yet |
| Verification rejected, error 30915 | Registered as a sole proprietor; GVO Sound LLC must be the LLC business type with its EIN |
| Texts stop later | Balance ran out. Add funds or turn on auto-recharge |
