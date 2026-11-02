# Builds the static legal pages (privacy.html, terms.html, sms-alerts.html) from one template.
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
.facts{border:1px solid var(--line);border-radius:4px;background:var(--panel);padding:18px 20px;margin:0 0 14px}
.facts p{margin:0 0 10px;display:grid;grid-template-columns:9.5em minmax(0,1fr);gap:2px 12px;align-items:baseline}.facts p:last-child{margin:0}
.facts b{color:var(--mute);font:600 .72rem var(--mono);letter-spacing:.08em;text-transform:uppercase}
@media (max-width:520px){.facts p{grid-template-columns:1fr}}
footer{border-top:1px solid var(--line);padding-block:28px calc(28px + env(safe-area-inset-bottom,0px));color:var(--mute);font:.75rem/1.7 var(--mono)}
footer .wrap{display:flex;flex-wrap:wrap;gap:10px 24px;justify-content:space-between}
footer a{color:var(--mute)}
footer nav{display:flex;gap:18px;flex-wrap:wrap}
"""

def page(slug, title, desc, eyebrow, h1, body, index=True):
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
<header><div class="wrap"><a class="logo" href="/" aria-label="GVO Sound home"><span class="mark"></span></a><a class="home" href="/">Back to home</a></div></header>
<main><div class="wrap">
<p class="eyebrow">{eyebrow}</p>
<h1>{h1}</h1>
<p class="updated">Last updated: {UPDATED}</p>
{body.strip()}
</div></main>
<footer><div class="wrap"><span>GVO Sound LLC · 109 Gibralter Ave, Annapolis, MD 21401 · {PHONE}</span><nav aria-label="Legal"><a href="/">Home</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></div></footer>
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
""", index=False)

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

for name, doc in [('sms-alerts', sms), ('privacy', privacy), ('terms', terms)]:
    open(os.path.join(ROOT, name + '.html'), 'w').write(doc)
    print('wrote', name + '.html')
