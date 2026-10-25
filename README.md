# GVO Sound website

Demo build of the new gvosound.com for GVO Sound LLC, 109 Gibralter Ave, Annapolis, MD.

## What's here

- `index.html` is the whole demo: homepage, recording, photo and podcast studio pages, booking, music, shop and product pages. Pages switch by URL hash (`#recording-studio`, `#music`, `#music/ride-for-me`, `#shop`, `#product-worker-jacket`).
- `img/` holds the studio, team and product photos, pulled from the current Wix site and converted to WebP.
- `robots.txt` and `_headers` keep this preview out of Google. Remove both noindex rules at launch.

## Deploy (Cloudflare Pages)

Workers & Pages > Create application > Pages > Connect to Git > `gvo-sound`.

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Framework preset | None |
| Build command | leave blank |
| Build output directory | `/` |

Every push to `main` redeploys. Other branches get preview URLs.

## Square

The shop, checkout and booking run on GVO's Square account through Pages Functions in `functions/`. The browser never sees the access token.

| Endpoint | What it does |
| --- | --- |
| `GET /api/config` | Application ID and location ID for Square's payment form, and whether the token is set |
| `GET /api/shop` | The 27 items that came from Wix Stores, with live price, sale price, sizes and stock |
| `GET /api/shop?debug=1` | Every Square item, why it is on or off the site, which site page it matched, and the bookable services |
| `POST /api/quote` | Square prices a bag or a session: automatic discounts, 6% tax, shipping |
| `POST /api/checkout` | CreateOrder, then CreatePayment for that order's total. Stock drops when the order is paid |
| `GET /api/availability` | Bookable services and team members, or open start times for one service |
| `POST /api/book` | Checks the time is still open, takes full payment, then creates the booking. If the booking fails, the payment is refunded |

Settings, in Pages > Settings > Variables and Secrets, for Production and Preview:

| Name | Type | Value |
| --- | --- | --- |
| `SQUARE_ACCESS_TOKEN` | Secret | Production access token. Never in code or chat |
| `SQUARE_APPLICATION_ID` | Optional | Defaults to `sq0idp-kalcI2_n6ftWyeUH-1INSw` |
| `SQUARE_LOCATION_ID` | Optional | Defaults to `L7PXJB1MFW1TP` (Gvo Sound Llc, 109 Gibralter Ave) |
| `SHOP_SINCE` | Optional | Items created in Square on or after this date are the Wix items. Defaults to `2026-10-20` |
| `SHOP_ITEM_IDS` | Optional | Comma list of Square item IDs. When set, only these sell on the site |

Which items sell: once `/api/shop?debug=1` shows the right 27, their IDs go in `PINNED` in `functions/_lib/site-products.js`, so a new Square item never lands on the site by accident. Site photos attach by name; the aliases in that file cover the Wix names.

Shipping is rebuilt from the Wix rates: $9.99 US (3 to 5 business days), $15.99 international, free pickup at 109 Gibralter Ave. Booking policy from Cory: full price up front, no refunds, switches no later than 2 hours before. Lead time 2 hours, open 24/7, 5 people max.

Apple Pay shows only after gvosound.com is registered for Apple Pay in the Square Developer Dashboard. Card and Google Pay work without it.

`_redirects` sends the old Wix URLs to the new pages. `_routes.json` runs Functions only on `/api/*`.

## Status

- The static `PRODUCTS` list paints the rack instantly. `/api/shop` replaces it with Square's live catalog a moment later. If Square is down, the rack stays visible and checkout says to call or text.
- The holiday photoshoot special shows Nov 1 to Dec 31 only.
- Music: each release has its own ad landing link (`/music/<release>`) that puts that song in the top slot. Spotify ids checked Oct 20, 2026; "All platforms" opens song.link / album.link. Artist submissions go to a Music table in Airtable for Cory to approve.

## System plan

| Piece | Tool | Owner |
| --- | --- | --- |
| Domain | Cloudflare Registrar (transfer from Wix; registered 2020-03-06, paid through 2027-03-06) | Cory |
| Site | GitHub + Cloudflare Pages | Siani builds, Cory owns |
| Money and stock | Square: bookings, deposits, merch catalog and inventory, studio register, payouts | Cory (existing account) |
| Square bridge | Pages Functions in `functions/` holding the Square access token as a secret (never in browser code) | Siani |
| Forms and leads | Airtable base in Cory's name: podcast quotes, contact, testimonials. Automations email each new entry to his Gmail, so he rarely needs to open Airtable. Siani gives him a short tutorial | Cory |
| Email | Cloudflare Email Routing: hello@gvosound.com forwards to gvosoundllc@gmail.com | Cory |


## Launch checklist

- Split views into static pages: `/recording-studio`, `/photo-studio`, `/podcast-studio`, `/book`, `/shop`, `/shop/<product>`
- Generate `sitemap.xml`, set canonical URLs, remove noindex
- Keep the Meta pixel on booking events
- Transfer gvosound.com to Cloudflare, set up Email Routing to Gmail
- Switch og:image and twitter:image from gvo-sound.pages.dev to https://www.gvosound.com/img/og-image.png
- Cancel Wix only after the domain transfer completes
