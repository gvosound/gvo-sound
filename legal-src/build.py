# Builds the static pages (privacy.html, terms.html, sms-alerts.html, accessibility.html) from one template.
# They are real files so /privacy, /terms and /sms-alerts load as their own pages, without the hash router.
# Run: python3 legal-src/build.py
import os, html
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
UPDATED = 'November 2, 2026'
EMAIL = 'gvosoundllc@gmail.com'
PHONE, TEL = '(443) 292-6753', '+14432926753'
ADDR = 'GVO Sound LLC<br>109 Gibralter Ave<br>Annapolis, MD 21401'
MAIL = f'<a href="mailto:{EMAIL}">{EMAIL}</a>'
CALL = f'<a href="tel:{TEL}">{PHONE}</a>'

CSS = """
:root{--ink:#07060a;--panel:#17141e;--line:#2b2635;--bone:#f3f0ea;--mute:#9e98aa;--lav:#b9b2ff;
--display:"Archivo","Arial Black",Impact,sans-serif;--body:"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;--mono:"JetBrains Mono",ui-monospace,Menlo,Consolas,monospace;color-scheme:dark}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--ink);color:var(--bone);font:17px/1.65 var(--body)}
a{color:var(--lav);text-underline-offset:3px}
a[href^="tel:"]{white-space:nowrap}
.wrap{max-width:760px;margin:0 auto;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
header{border-bottom:1px solid var(--line);padding-top:env(safe-area-inset-top,0px)}
header .wrap{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:68px}
.logo{display:inline-flex;align-items:center}
.logo .mark{display:inline-block;width:62px;aspect-ratio:672/507;background:var(--bone);-webkit-mask:url(/img/gvo-mark.png) center/contain no-repeat;mask:url(/img/gvo-mark.png) center/contain no-repeat}
.home{font:600 .75rem/1 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--bone);text-decoration:none;border:1px solid var(--line);border-radius:4px;padding:11px 14px}
.home:hover,.home:focus-visible{border-color:var(--lav);color:var(--lav)}
main{padding-block:48px 64px}
.eyebrow{font:600 .75rem/1 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--lav);margin:0 0 16px}
h1{font-family:var(--display);font-stretch:125%;font-weight:900;text-transform:uppercase;line-height:.95;letter-spacing:-.01em;font-size:clamp(2rem,7vw,3.2rem);margin:0 0 14px;text-wrap:balance}
.updated{font:.8rem var(--mono);color:var(--mute);margin:0 0 36px}
h2{font:700 1.2rem/1.3 var(--body);margin:40px 0 10px}
p,ul{margin:0 0 14px}
ul{padding-left:1.2em}
li{margin-bottom:6px}
.quote{border-left:3px solid var(--lav);padding:4px 0 4px 16px;margin:0 0 14px}
address{font-style:normal}
.skip{position:fixed;left:16px;top:-60px;z-index:10;background:var(--lav);color:#100c24;padding:10px 14px;border-radius:4px;font:700 .8rem var(--mono);text-decoration:none}
.skip:focus{top:calc(12px + env(safe-area-inset-top,0px))}
main:focus{outline:0}
:focus-visible{outline:2px solid var(--lav);outline-offset:3px}
.a11y-bar{background:#14111a;border-bottom:1px solid var(--line);text-align:center;padding:12px 16px;margin:-28px 0 28px;font:500 .85rem/1.5 var(--body);color:var(--bone)}
.a11y-bar a{color:var(--bone);font-weight:700;text-decoration:underline;text-underline-offset:3px}
.wrap.wide{max-width:1040px}
.hero-p{font-size:1.15rem;color:var(--bone);max-width:62ch;margin:0 0 8px}
.a11y{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:48px;align-items:start}
.help{position:sticky;top:24px;border:1px solid var(--line);border-radius:4px;background:var(--panel);padding:22px 22px 18px;margin-top:40px}
.help h2{margin:0 0 10px}
.help p{font-size:.95rem}
.help .btns{display:grid;gap:10px;margin-top:16px}
.help .btns a{display:flex;align-items:center;justify-content:center;min-height:46px;border:1px solid var(--line);border-radius:4px;font:600 .75rem var(--mono);letter-spacing:.1em;text-transform:uppercase;text-decoration:none;color:var(--bone);text-align:center;padding:8px 10px}
.help .btns a.lav{background:var(--lav);border-color:var(--lav);color:#100c24}
@media (max-width:860px){.a11y{grid-template-columns:1fr;gap:0}.help{position:static}}
.facts{border:1px solid var(--line);border-radius:4px;background:var(--panel);padding:18px 20px;margin:0 0 14px}
.facts p{margin:0 0 10px;display:grid;grid-template-columns:9.5em minmax(0,1fr);gap:2px 12px;align-items:baseline}.facts p:last-child{margin:0}
.facts b{color:var(--mute);font:600 .72rem var(--mono);letter-spacing:.08em;text-transform:uppercase}
@media (max-width:520px){.facts p{grid-template-columns:1fr}}
footer{border-top:1px solid var(--line);padding-block:28px calc(28px + env(safe-area-inset-bottom,0px));color:var(--mute);font:.75rem/1.7 var(--mono)}
footer .wrap{display:flex;flex-wrap:wrap;gap:10px 24px;justify-content:space-between}
footer a{color:var(--mute)}
footer nav{display:flex;gap:18px;flex-wrap:wrap}
"""

def page(slug, title, desc, eyebrow, h1, body, index=True, updated=None, wide=False, lede='', reviewed=None):
    canon = f'https://gvosound.com/{slug}'
    robots = '' if index else '\n<meta name="robots" content="noindex">'
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">{robots}
<link rel="canonical" href="{canon}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="64x64" href="/img/favicon-64.png">
<meta name="theme-color" content="#07060a">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap">
<style>{CSS}</style>
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header><div class="wrap"><a class="logo" href="/" aria-label="GVO Sound home"><span class="mark"></span></a><a class="home" href="/">Back to home</a></div></header>
<main id="main" tabindex="-1"><div class="wrap{' wide' if wide else ''}">
<p class="eyebrow">{eyebrow}</p>
<h1>{h1}</h1>
{f'<p class="hero-p">{lede}</p>' if lede else ''}<p class="updated">{'Last reviewed: ' + reviewed if reviewed else 'Last updated: ' + (updated or UPDATED)}</p>
{body.strip()}
</div></main>
<footer><p class="a11y-bar">We want this site to work for everyone. <a href="/accessibility">Read the accessibility statement</a></p><div class="wrap"><span>GVO Sound LLC · 109 Gibralter Ave, Annapolis, MD 21401 · {PHONE}</span><nav aria-label="Legal"><a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a><a href="/accessibility">Accessibility</a></nav></div></footer>
</body>
</html>
"""

SMS_FACTS = f"""
<div class="facts">
<p><b>Program</b><span>GVO Sound booking alerts</span></p>
<p><b>Who gets texts</b><span>GVO Sound staff only</span></p>
<p><b>Frequency</b><span>One message per booking</span></p>
<p><b>Cost</b><span>Message and data rates may apply</span></p>
<p><b>Opt out</b><span>Reply STOP</span></p>
<p><b>Help</b><span>Reply HELP, email {MAIL} or call {CALL}</span></p>
</div>
"""

sms = page('sms-alerts', 'SMS Booking Alerts | GVO Sound', 'GVO Sound booking alerts: one-way text alerts sent to GVO Sound staff when a studio session is booked on gvosound.com.',
  'GVO Sound LLC', 'SMS booking alerts', f"""
{SMS_FACTS}
<h2>What this program is</h2>
<p>GVO Sound LLC sends one-way text alerts to its own staff when a customer books a studio session on gvosound.com. Recipients are only GVO staff who give their own mobile number to the business to receive these alerts.</p>
<h2>What the texts contain</h2>
<p>Each alert covers one booking:</p>
<ul>
<li>The session booked</li>
<li>The date and time of the session</li>
<li>The customer's first name and phone number</li>
<li>The amount paid</li>
</ul>
<h2 id="opt-in">How staff sign up</h2>
<p>Staff opt in verbally. Before a number is added, the GVO Sound manager reads this script to the staff member, in person or on a call:</p>
<blockquote>"GVO Sound LLC can text you an alert each time a customer books a studio session on gvosound.com. It's one text per booking, with the session, the date and time, the customer's first name and phone number, and the amount paid. Message and data rates may apply. Reply STOP at any time to stop, or HELP for help. Do you agree to get these booking alerts at this number?"</blockquote>
<p>A number is added only after the staff member says yes. The manager records their name, the number and the date they agreed. The first alert they receive includes "Reply STOP to opt out."</p>
<h2>How often</h2>
<p>One message per booking. Message and data rates may apply.</p>
<h2>What this program does not send</h2>
<p>No marketing messages. No texts to customers.</p>
<h2>Opting out and getting help</h2>
<p>Reply STOP to any alert to stop receiving them. Reply HELP for help. You can also reach us at {MAIL} or {CALL}.</p>
<h2>Privacy and terms</h2>
<p>Read how GVO Sound handles information in the <a href="/privacy">privacy policy</a>, and the program terms in the <a href="/terms">terms of service</a>.</p>
<h2>Contact</h2>
<address>{ADDR}<br>{MAIL}<br>{CALL}</address>
""", index=False, updated='November 19, 2026')

privacy = page('privacy', 'Privacy Policy | GVO Sound', 'How GVO Sound LLC collects, uses and protects information from bookings, shop orders and forms on gvosound.com.',
  'GVO Sound LLC', 'Privacy policy', f"""
<h2>Who we are</h2>
<p>This site, gvosound.com, is run by GVO Sound LLC, 109 Gibralter Ave, Annapolis, MD 21401.</p>
<h2>What the site collects</h2>
<ul>
<li>Booking and order details: your name, email, phone number, and what you booked or bought.</li>
<li>What you send through the site's forms, such as quote requests, event inquiries, travel inquiries and music submissions.</li>
<li>Payment details, which go straight to Square for processing. The site never sees or stores full card numbers.</li>
</ul>
<h2>How it is used</h2>
<ul>
<li>To provide your booking or order, and to reply to what you send us.</li>
<li>To send booking and order confirmations.</li>
<li>To send internal alerts to GVO Sound staff when a booking or order comes in.</li>
</ul>
<h2>Service providers</h2>
<p>These companies handle parts of the work for us:</p>
<ul>
<li>Square: payments and bookings</li>
<li>Google: form storage and email</li>
<li>Resend: email delivery</li>
<li>Twilio: text alerts to GVO Sound staff</li>
<li>Cloudflare: hosting and spam protection</li>
</ul>
<h2>Text messaging</h2>
<p class="quote">No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Text messaging originator opt-in data and consent will not be shared with any third parties.</p>
<p>The only texts this site's systems send are booking alerts to GVO Sound staff. See <a href="/terms#sms">the SMS terms</a> for how that program works.</p>
<h2>Deleting or correcting your information</h2>
<p>To ask us to delete or correct information we hold about you, email {MAIL}.</p>
<h2>Contact</h2>
<address>{ADDR}<br>{MAIL}<br>{CALL}</address>
""")

terms = page('terms', 'Terms of Service | GVO Sound', 'Terms for studio bookings, shop orders and SMS booking alerts at GVO Sound LLC in Annapolis, MD.',
  'GVO Sound LLC', 'Terms of service', f"""
<p>These terms cover studio bookings and shop orders on gvosound.com, and the GVO Sound booking alerts text program. GVO Sound LLC runs the site and the studio at 109 Gibralter Ave, Annapolis, MD 21401.</p>
<h2>Studio bookings</h2>
<ul>
<li>You pay the full session price when you book. That holds your time slot.</li>
<li>Sessions book at least 2 hours ahead.</li>
<li>Up to 5 people per session.</li>
<li>Maryland sales tax of 6% is added at checkout.</li>
</ul>
<h2>Cancellations and changes</h2>
<p>Full price is paid up front, and there are no refunds. To switch to another time, call or text {CALL} no later than 2 hours before your session.</p>
<h2>Shop orders</h2>
<ul>
<li>Shipping in the US is $9.99. International shipping is $15.99. Orders ship in 3 to 5 business days.</li>
<li>Pickup at the studio is free. Your order waits at 109 Gibralter Ave, and the studio lets you know when it is ready.</li>
<li>You choose shipping or pickup at checkout.</li>
</ul>
<h2 id="sms">SMS booking alerts</h2>
{SMS_FACTS}
<p>GVO Sound booking alerts are one-way texts sent only to GVO Sound staff who give their own mobile number to the business to receive them. Each text covers one booking: the session, date and time, the customer's first name and phone number, and the amount paid. No marketing messages are sent, and no texts go to customers.</p>
<p>Reply STOP to opt out. Reply HELP for help. Message and data rates may apply. Carriers are not liable for delayed or undelivered messages.</p>
<h2>Contact</h2>
<address>{ADDR}<br>{MAIL}<br>{CALL}</address>
""")

access = page('accessibility', 'Accessibility | GVO Sound', 'How gvosound.com works with screen readers, keyboards, magnification and voice control, and how to reach GVO Sound if something on the site gets in your way.',
  'Accessibility', 'Good vibes, open to everyone', f"""
<div class="a11y"><div>
<h2>The standard</h2>
<p>We build gvosound.com to WCAG 2.2 Level AA. Every page is tested with automated accessibility checks, then by hand with a keyboard and a screen reader before changes go live.</p>
<h2>What's built in</h2>
<ul>
<li>A "Skip to content" link is the first thing a keyboard reaches on every page.</li>
<li>Everything works from a keyboard, including the studio cards, the booking desk, search, the bag and checkout. Whatever has focus gets a lavender outline.</li>
<li>Search, the bag, checkout and pop-ups are announced as dialogs with names, and close with the Escape key.</li>
<li>Screen readers hear booking and checkout errors as they happen, and the studio artist picker works as a set of tabs.</li>
<li>Photos carry text descriptions. Video clips are silent, so no sound plays without you choosing it.</li>
<li>Text meets AA contrast against GVO's dark background.</li>
<li>If your device is set to reduce motion, the homepage and studio videos are replaced with still photos and the animations stop.</li>
<li>On phones, a bar at the bottom calls or texts the studio in one tap, and addresses open directions in Google Maps.</li>
<li>Forms say exactly what's missing, like "Add your street address," and move you to that field.</li>
</ul>
<h2>Still being worked on</h2>
<ul>
<li>Some content comes from other companies and works the way they built it: Square's card payment fields, Instagram posts, YouTube sessions, Spotify and Apple Music players, Eventbrite tickets and Google Maps.</li>
<li>The studio walkthrough and session clips have no captions or audio description. They're silent, and each studio page describes the room, the gear and the rates in text.</li>
<li>Pins on the travel map are small. The list of places under the map opens each one, and works with a keyboard.</li>
</ul>
</div>
<aside class="help" aria-labelledby="helpT">
<h2 id="helpT">Something not working?</h2>
<p>Tell us what happened and where on the site. We'll help you book a session, place an order or get what you came for another way.</p>
<div class="btns"><a class="lav" href="mailto:{EMAIL}?subject=Accessibility%20on%20gvosound.com">Email {EMAIL}</a><a href="tel:{TEL}">Call {PHONE}</a><a href="sms:{TEL}">Text {PHONE}</a></div>
</aside></div>
""", wide=True, reviewed='November 2026', lede="gvosound.com should work for you whether you use a screen reader, a keyboard, magnification or voice control, to book a session, buy apparel, find the next party or stream music recorded here.")

for name, doc in [('sms-alerts', sms), ('privacy', privacy), ('terms', terms), ('accessibility', access)]:
    open(os.path.join(ROOT, name + '.html'), 'w').write(doc)
    print('wrote', name + '.html')
