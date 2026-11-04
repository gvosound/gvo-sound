# How the site got here

Built by Siani Butler (Siani Creates) for GVO Sound LLC, Cory McGhee's studio at 109 Gibralter Ave, Annapolis. The commit log has every change; this is the story behind the decisions. Free support from Siani runs through December 31, 2026.

## Timeline

| Date (2026) | What happened |
| --- | --- |
| Oct 20 to 22 | Demo built: home, studio pages, booking desk, music, events, travel, shop, Build a fit, the bat intro, preview player |
| Oct 24 to 25 | Shop, checkout and bookings connected to Square. Shop locked to the 27 Wix items. Resend confirmations, forms to the Google Sheet, Turnstile, YouTube rows. Wix records downloaded to the GVO financial records folder |
| Oct 27 | Instagram accounts recovered and moved into Meta Business Suite; live feeds through the Meta app. Domain transfer from Wix to Porkbun started. 2-hour recording minimum online |
| Oct 28 | Repo moved to the gvosound GitHub org (broke the Cloudflare Git link once). Cory's album photos and clips went in. Shop review page for Cory. Content studio replaced the podcast page |
| Oct 29 | BagBoy Network row, crew wording, beanie colors |
| Nov 2 | Launch on gvosound.com: noindex removed, nameservers through Porkbun to Cloudflare. Studio artists. Booking alert emails, after the first live booking reached no one. Privacy, terms and SMS alerts pages for Twilio. "PAID ONLINE" seller note |
| Nov 3 | Live Google rating (Places) and sheet-picked reviews, after the Business Profile API was declined twice |

## Decisions and why

- Square over Wix Stores for everything money-related: one system for bookings, register sales, stock and payouts.
- Full price up front, no refunds, 2-hour lead, 5 people max, 6% Maryland tax on sessions: Cory's policy.
- Only the 27 Wix items sell online (`PINNED`), so older Square items (Signature Tees, Essentials, ski mask, tickets) never appear by accident.
- Porkbun as registrar, Cloudflare for DNS and hosting. Wix canceled last, after the transfer, final orders and records.
- A Google Sheet, not a database, for forms: the team already lives in Google, and the sheet doubles as the admin panel (Social posts, Reviews).
- Videos come from playlists so the team controls the site from YouTube without touching code.
- Twilio over Bird for booking texts: tiny volume, simplest setup. Revisit Bird if GVO starts texting event campaigns at scale.
- Music in clips stays muted unless credited and not sampled from other artists.

## Open as of Nov 4, 2026

Twilio verification and the text alert code, music credits per clip, photos for Prove A Point and the Body Set, more podcast links, renaming the "Boobie" variation, canceling Wix, and the README sections still describing the pre-launch plan (Cloudflare Registrar, Email Routing, launch checklist), which are superseded by this folder.
