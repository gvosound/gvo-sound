# GVO Sound website

Demo build of the new gvosound.com for GVO Sound LLC, 109 Gibralter Ave, Annapolis, MD.

## What's here

- `index.html` is the whole demo: homepage, recording, photo and podcast studio pages, booking, shop and product pages. Pages switch by URL hash (`#recording-studio`, `#shop`, `#product-worker-jacket`).
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

## Status

- Catalog is a snapshot of the live Wix store (26 in-stock products, Oct 20, 2026). Production pulls it from Square.
- Booking and checkout are demo flows. Production writes to the Square Bookings and Payments APIs.
- The holiday photoshoot special shows Nov 1 to Dec 31 only.

## Launch checklist

- Split views into static pages: `/recording-studio`, `/photo-studio`, `/podcast-studio`, `/book`, `/shop`, `/shop/<product>`
- Generate `sitemap.xml`, set canonical URLs, remove noindex
- Connect Square (catalog, bookings, payments) and keep the Meta pixel on booking events
- Point gvosound.com at Cloudflare and 301-redirect the old Wix URLs
