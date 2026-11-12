# How gvosound.com is built

Written November 4, 2026 for whoever maintains the site next. Start here, then read `RUNBOOK.md` for fixes and `HISTORY.md` for why things are the way they are. The team-facing version is the "GVO website handbook" Google Doc in GVO's Drive.

## The short version

- A static site on Cloudflare Pages, deployed from `main` of `gvosound/gvo-sound`. No build step: Pages serves the repo root as is.
- Server code is Cloudflare Pages Functions in `functions/`, run only on `/api/*` (`_routes.json`).
- Square is the system of record for money, stock and bookings. A Google Sheet is the system of record for forms, social approvals and featured reviews.
- Every secret lives in Cloudflare (Workers & Pages, gvo-sound, Settings, Variables and Secrets). The browser never sees one.

## Request flow

```
Browser ── index.html (hash-routed views) ──┐
                                            ├── /api/shop, /api/quote, /api/checkout ──► Square Catalog, Orders, Payments
                                            ├── /api/availability, /api/book ──────────► Square Bookings (+ Payments, Refunds)
                                            ├── /api/form ──► Turnstile check ──► Apps Script web app ──► Form sheet (+ alert email)
                                            ├── /api/videos ──► YouTube Data API (or public feed) ── cached 1 h
                                            ├── /api/ig ──► graph.facebook.com ── cached 1 h, last good list in KV (IG_KV)
                                            └── /api/reviews ──► Places API (New) 24 h + Apps Script "reviews" action 1 h
Emails: functions/_lib/email.js ──► Resend (from clothing@ and info@)
Texts:  booking alerts ──► Twilio (pending toll-free verification as of Nov 4, 2026)
```

## Files

| Path | What it is |
| --- | --- |
| `index.html` | The whole front end in one file (about 380 KB): CSS, markup templates and JS. Views switch on the URL hash (`#recording-studio`, `#shop`, `#product-<id>`, `#music/<release>`). `parse()` and the `hashchange` listener near the bottom do the routing; `MOVED` maps old view names to new ones |
| `functions/api/*.js` | One file per endpoint. Each has a comment header saying what it does and in what order |
| `functions/_lib/square.js` | Square fetch wrapper, config defaults (application and location IDs), idempotency keys, customer lookup |
| `functions/_lib/catalog.js` | Loads Square's catalog, matches Square items to site products, splits colors, builds bookable services |
| `functions/_lib/site-products.js` | `PINNED`: the Square item IDs that sell on the site. A new Square item stays off until its ID is added here. Also aliases and site display names |
| `functions/_lib/booking.js` | Booking rules: 2-hour lead, 5 people max, which services book online, which team members never take online bookings (`OFF_TEAM`), and how many sessions each room holds at once (`ROOMS_CAP`, 1 per studio; the holiday shoot uses the photo room). A session in a room blocks that time for every team member in it, including bookings made in Square |
| `functions/_lib/orders.js` | Shop line building, contact cleanup, order summaries |
| `functions/_lib/email.js` | Every email template and the Resend sender. Booking alerts go to `BOOKING_ALERT_TO` |
| `functions/_lib/video-lists.js` | Every YouTube playlist or channel row and where it shows. New row = one line |
| `functions/_lib/ig-accounts.js` | Every Instagram account and the Cloudflare secret holding its token. New account = one line + one secret |
| `apps-script/FormSubmissions.gs` | The Apps Script bound to the "GVO Website Form Submissions" sheet. Not deployed by git: paste it into the sheet's script editor, then Deploy, Manage deployments, New version |
| `legal-src/build.py` | Builds `privacy.html`, `terms.html` and `sms-alerts.html`. Run `python3 legal-src/build.py` after editing |
| `review/` | The team-only shop photo review page at `/review/` (noindex in `_headers`) |
| `photographers/` | The team-only photographer info page at `/photographers/`: rates, contact preferences, holiday special. Posts form `team` to `/api/form`, which lands on the Photographers tab (noindex in `_headers`) |
| `img/`, `vid/`, `aud/` | WebP images, MP4 clips with WebP posters, audio previews. Cached 7 days |
| `_redirects` | Old Wix URLs to the new hash routes |
| `_headers` | Security headers, cache rules, and the `/review/*` and `/photographers/*` noindex |

## Data written into `index.html`

These change only by editing the file. The team asks for these by name.

| Constant | What it holds |
| --- | --- |
| `REC`, `PHOTO`, `TAX` | Rate tables shown on studio pages (checkout prices come from Square) |
| `TEAM`, `ROOMS`, `BROOMS`, `POLICY` | Staff, studio page content, booking desk rooms, policy line |
| `PRODUCTS` | Snapshot that paints the shop instantly before `/api/shop` replaces it |
| `PHOTOS`, `CLIPS`, `CLIP_EXTRA`, `CLIP_COLORS`, `CLIP_MUSIC`, `WORN` | Product galleries, clips by color, Worn at GVO tiles, music credits per clip |
| `FIT_RAW`, `FIT_PRESETS`, `LOOKS` | Build a fit board |
| `REL`, `ARTISTS`, `LISTEN`, `FEATURED` | Music page releases, studio artists, listen links |
| `EVENTS`, `TRIPS`, `NEXT`, `CRUISE` | Events and travel |
| `REVIEWS`, `GOOG` | Fallback reviews and rating, used until `/api/reviews` answers |
| `SEASON` | Holiday photoshoot special window (Nov 23 to Dec 23). The server holds the same dates in `HOLIDAY_WINDOW` |
| `META` | Page titles and descriptions per view |

## Secrets and settings

The full table with defaults is in the root `README.md`. Required for production: `SQUARE_ACCESS_TOKEN`, `FORMS_URL`, `FORMS_SECRET`, `RESEND_API_KEY`, `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET`, `YOUTUBE_API_KEY`, `GOOGLE_PLACES_KEY`, the four `IG_TOKEN_*`, and the `IG_KV` binding. Twilio adds `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY_SID`, `TWILIO_API_KEY_SECRET`, `TWILIO_FROM`, `BOOKING_SMS_TO`. After changing any secret, retry the latest deployment so it takes effect.

## Known platform limits

- Square: bookings created through the Bookings API skip staff notifications, and there is no API link between a booking and its payment. The site sends its own alert, and starts the seller note with "PAID ONLINE ... Do not check out."
- Square sends no receipt email for API orders, so `email.js` sends confirmations.
- Google declined Business Profile API access (Oct 25 and Nov 2, 2026), so reviews use Places for the rating and the sheet for the text.
- Instagram tokens are Facebook-login system-user tokens and only work on `graph.facebook.com`, not `graph.instagram.com`.
- US texts need a verified toll-free number (Twilio) before any message sends.

## Local preview

Static pages: `python3 -m http.server` in the repo root, then open `http://localhost:8000`. The `/api/*` routes need Cloudflare: `npx wrangler pages dev .` with a `.dev.vars` file holding test values. Never commit `.dev.vars`.
