// SETUP FOR THIS VERSION: after pasting it, run setupReviews once, then Deploy > Manage deployments > edit > Version: New version.
/**
 * GVO Website Form Submissions: receives each form from gvosound.com, adds a row to the right tab,
 * and emails the GVO Gmail.
 *
 * Setup (signed in as gvosoundllc@gmail.com):
 *   1. Open the sheet, then Extensions > Apps Script. Replace everything in Code.gs with this file. Save.
 *   2. Pick "makeSecret" in the function menu and click Run. Approve the permissions.
 *      Copy the value it prints in the Execution log and save it in Cloudflare as the FORMS_SECRET secret.
 *   3. Pick "setup" and click Run. It sends a test email to the GVO Gmail.
 *   4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Deploy.
 *      Copy the Web app URL into Cloudflare as the FORMS_URL secret.
 *   After editing this code later: Deploy > Manage deployments > edit > Version: New version.
 *   That keeps the same URL.
 *
 * Instagram approvals (Social posts tab):
 *   5. Pick "setupSocial" and click Run, once. Approve the new permissions (it reaches the website).
 *      It adds an hourly trigger that asks the site to read @gvo.sound, so new posts land in the tab
 *      even when nobody visits. Tick Approved on a row and pick Show on (Music, Podcast or Both).
 *      The post shows on the site within the hour.
 *
 * Reviews on the site (Reviews tab):
 *   6. Pick "setupReviews" and click Run, once. It makes the Reviews tab with today's six site reviews, all ticked.
 *      Tick Show to put a review on the site, untick to take it off. Changes show within the hour.
 *      Every shown review is in the home page slider. Show on picks the room page that shows the full review:
 *      Recording, Photo or Podcast. Home = home page only. All = any room page that has no review of its own.
 */

const ALERT_TO = 'gvosoundllc@gmail.com';
const SITE = 'https://gvo-sound-329.pages.dev'; // keeps working after launch, same Cloudflare project
const SOCIAL_TAB = 'Social posts';
// Social posts columns: A Post link, B Account, C Date, D Caption, E Media type, F Approved, G Show on, H Post ID
const REVIEWS_TAB = 'Reviews';
// Reviews columns: A Name, B Stars, C Review, D Date, E Source, F Short quote, G Show on, H Show
const REVIEW_ON = ['Home', 'Recording', 'Photo', 'Podcast', 'All'];
const KINDS = { IMAGE: 'Photo', VIDEO: 'Reel or video', CAROUSEL_ALBUM: 'Carousel' };

// Tab name and column order for each form. "Received" is always column A.
const FORMS = {
  quote:  { tab: 'Podcast quotes',    label: 'Podcast or video quote', cols: ['name', 'phone', 'email', 'type', 'details'] },
  event:  { tab: 'Event inquiries',   label: 'Event inquiry',          cols: ['type', 'name', 'email', 'phone', 'org', 'when', 'city', 'details'] },
  travel: { tab: 'Travel requests',   label: 'Travel request',         cols: ['trip', 'name', 'email', 'phone', 'where', 'when', 'pax', 'details'] },
  music:  { tab: 'Music submissions', label: 'Music submission',       cols: ['artist', 'email', 'title', 'type', 'links', 'ig', 'tiktok', 'yt', 'gvo', 'engineer', 'notes'] },
  notify: { tab: 'Notify list',       label: 'Notify list sign-up',    cols: ['list', 'contact'] },
  review: { tab: 'Review answers',    label: 'Shop review answer',     cols: ['who', 'item', 'answer', 'notes'] },
};
// Review answers also go to Siani, who updates the site from them.
const REVIEW_TO = 'sianibutler@gmail.com';
// Status column to start as "New", by tab (1-based column number), so new rows stand out.
const STATUS_COL = { quote: 7, event: 10, travel: 10 };

const LABELS = { name: 'Name', phone: 'Phone', email: 'Email', type: 'Type', details: 'Details', org: 'Company or venue',
  when: 'When', city: 'City', trip: 'Trip', where: 'Where to', pax: 'Travelers', artist: 'Artist', title: 'Song or project',
  links: 'Links', ig: 'Instagram', tiktok: 'TikTok', yt: 'YouTube', gvo: 'Recorded at GVO', engineer: 'GVO engineer or producer',
  notes: 'Anything else', list: 'List', contact: 'Email or phone', who: 'From', item: 'About', answer: 'Answer' };

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('FORM_SECRET');
  if (!secret || body.secret !== secret) return out({ ok: false, error: 'forbidden' });
  if (body.action === 'social') return out(social(body));
  if (body.action === 'reviews') return out(reviews());
  const form = FORMS[body.form];
  if (!form) return out({ ok: false, error: 'unknown form' });
  const f = body.fields || {};

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let row;
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(form.tab) || makeTab(form);
    // Leading ' keeps the sheet from turning text like 2/14 or +1410 into dates or formulas.
    const values = [new Date()].concat(form.cols.map(k => f[k] == null || f[k] === '' ? '' : "'" + String(f[k]).slice(0, 2000)));
    sheet.appendRow(values);
    row = sheet.getLastRow();
    if (STATUS_COL[body.form]) sheet.getRange(row, STATUS_COL[body.form]).setValue('New');
  } finally {
    lock.releaseLock();
  }

  try {
    const who = body.form === 'review' ? (f.who || 'Cory') + ' on ' + f.item : (f.name || f.artist || f.contact || 'Someone');
    const lines = form.cols.filter(k => f[k]).map(k => LABELS[k] + ': ' + f[k]);
    const url = SpreadsheetApp.getActive().getUrl() + '#gid=' + SpreadsheetApp.getActive().getSheetByName(form.tab).getSheetId();
    const opts = { name: 'GVO Sound website' };
    if (f.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) opts.replyTo = f.email;
    MailApp.sendEmail(body.form === 'review' ? ALERT_TO + ',' + REVIEW_TO : ALERT_TO, `${form.label}: ${who}`,
      `${form.label} from gvosound.com\n\n${lines.join('\n')}\n\nRow ${row} in "${form.tab}": ${url}\n` +
      (opts.replyTo ? '\nReply to this email to answer them.' : ''), opts);
  } catch (err) {
    console.log('alert email failed: ' + err);
  }
  // How many rows this email address sent in the last hour, across every tab. The site uses it to cap confirmations.
  let recent = 0;
  try { recent = recentFor(String(f.email || f.contact || '').toLowerCase()); } catch (err) { recent = 1; }
  return out({ ok: true, row, recent });
}

// Adds a tab the first time a form needs it: a title row, then the column headers on row 2, like the others.
function makeTab(form) {
  const sh = SpreadsheetApp.getActive().insertSheet(form.tab);
  sh.getRange(1, 1).setValue(form.label + 's from the website');
  sh.getRange(2, 1, 1, form.cols.length + 1).setValues([['Received'].concat(form.cols.map(k => LABELS[k] || k))]).setFontWeight('bold');
  sh.setFrozenRows(2);
  return sh;
}

function recentFor(addr) {
  if (!addr || addr.indexOf('@') < 0) return 0;
  const since = Date.now() - 3600 * 1000;
  let n = 0;
  Object.keys(FORMS).forEach(k => {
    const form = FORMS[k], col = form.cols.indexOf(k === 'notify' ? 'contact' : 'email');
    if (col < 0) return;
    const sh = SpreadsheetApp.getActive().getSheetByName(form.tab), last = sh.getLastRow();
    if (last < 3) return;
    const start = Math.max(3, last - 99);
    sh.getRange(start, 1, last - start + 1, col + 2).getValues().forEach(r => {
      const when = r[0] instanceof Date ? r[0].getTime() : 0;
      if (when >= since && String(r[col + 1]).replace(/^'/, '').toLowerCase() === addr) n++;
    });
  });
  return n;
}

// The site sends the newest posts from an account. New ones become rows, unticked. The answer lists every
// ticked row so the site can show it.
function social(body) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(SOCIAL_TAB) || makeSocialTab(ss);
    // Approved is a checkbox on every row, so the last used row comes from the Post ID column, not getLastRow.
    const ids = sh.getMaxRows() > 2 ? sh.getRange(3, 8, sh.getMaxRows() - 2, 1).getValues() : [];
    let n = ids.length; while (n > 0 && !String(ids[n - 1][0]).trim()) n--;
    const rows = n ? sh.getRange(3, 1, n, 8).getValues() : [];
    const have = new Set(rows.map(r => String(r[7]).replace(/^'/, '')));
    const add = (body.posts || [])
      .filter(p => p && p.id && !have.has(String(p.id)))
      .sort((a, b) => new Date(a.at) - new Date(b.at)) // oldest first, so the newest ends up at the bottom
      .map(p => ["'" + String(p.link || '').slice(0, 300), "'" + String(body.account || '').slice(0, 60), new Date(p.at),
        "'" + String(p.caption || '').slice(0, 500), KINDS[p.kind] || p.kind || '', false, 'Both', "'" + String(p.id)]);
    if (add.length) {
      const at = 3 + n;
      if (at + add.length - 1 > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), add.length + 200);
      sh.getRange(at, 1, add.length, 8).setValues(add);
      sh.getRange(at, 6, add.length, 1).insertCheckboxes();
    }
    const approved = rows.concat(add).filter(r => r[5] === true)
      .map(r => ({ id: String(r[7]).replace(/^'/, ''), link: String(r[0]).replace(/^'/, ''), show: String(r[6] || 'Both') }));
    return { ok: true, added: add.length, approved };
  } finally {
    lock.releaseLock();
  }
}

// Only used if the tab was deleted. The styled tab already exists in the sheet.
function makeSocialTab(ss) {
  const sh = ss.insertSheet(SOCIAL_TAB);
  sh.getRange(1, 1).setValue('New @gvo.sound posts land here each hour. Tick Approved to show one on the site, and pick where in Show on.');
  sh.getRange(2, 1, 1, 8).setValues([['Post link', 'Account', 'Date', 'Caption', 'Media type', 'Approved', 'Show on', 'Post ID']]).setFontWeight('bold');
  sh.setFrozenRows(2);
  return sh;
}

// Run once from the editor. Adds the hourly trigger and runs it once right away.
function setupSocial() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshSocial').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshSocial').timeBased().everyHours(1).create();
  refreshSocial();
}

// Asks the site to read Instagram now. The site then sends any new posts back to doPost above.
function refreshSocial() {
  const secret = PropertiesService.getScriptProperties().getProperty('FORM_SECRET');
  const r = UrlFetchApp.fetch(SITE + '/api/ig?refresh=1', { headers: { 'X-Refresh-Key': secret }, muteHttpExceptions: true });
  console.log('Site answered ' + r.getResponseCode());
}

// The site asks for the ticked rows, in sheet order. Show is a checkbox on every row, so the last row comes from Name.
function reviews() {
  const sh = SpreadsheetApp.getActive().getSheetByName(REVIEWS_TAB);
  if (!sh) return { ok: true, reviews: [] };
  const last = sh.getLastRow();
  if (last < 3) return { ok: true, reviews: [] };
  const rows = sh.getRange(3, 1, last - 2, 8).getValues();
  const tz = Session.getScriptTimeZone();
  const list = rows.filter(r => String(r[0]).trim() && String(r[2]).trim() && r[7] === true).map(r => ({
    name: String(r[0]).trim(),
    stars: Number(r[1]) || 5,
    text: String(r[2]).trim(),
    date: r[3] instanceof Date ? Utilities.formatDate(r[3], tz, 'yyyy-MM-dd') : String(r[3] || '').trim(),
    source: String(r[4] || '').trim(),
    quote: String(r[5] || '').trim(),
    on: String(r[6] || 'Home').trim(),
  }));
  return { ok: true, reviews: list };
}

// Run once from the editor. Makes the Reviews tab and fills it with the six reviews on the site today, all ticked.
// If the tab already exists it is left alone.
function setupReviews() {
  const ss = SpreadsheetApp.getActive();
  if (ss.getSheetByName(REVIEWS_TAB)) { console.log('The Reviews tab already exists. Nothing changed.'); return; }
  const sh = ss.insertSheet(REVIEWS_TAB);
  const ROWS = 200;
  if (sh.getMaxRows() < ROWS + 2) sh.insertRowsAfter(sh.getMaxRows(), ROWS + 2 - sh.getMaxRows());
  sh.getRange(1, 1).setValue('Reviews on gvosound.com. Tick Show to put one on the site, untick to take it off (shows within the hour). ' +
    'Every shown review is in the home page slider. Show on picks the room page for the full review: Home = home only, All = any room page without its own. ' +
    'Copy Google reviews word for word. Short quote is optional: a line from the review for the home slider.').setFontWeight('bold').setWrap(true);
  sh.getRange(1, 1, 1, 8).merge();
  sh.setRowHeight(1, 60);
  sh.getRange(2, 1, 1, 8).setValues([['Name', 'Stars', 'Review', 'Date', 'Source', 'Short quote', 'Show on', 'Show']]).setFontWeight('bold');
  sh.setFrozenRows(2);
  const seed = [
    ["William Marsters Jr.", 5, "My first time at GVO and the studio had Great Energy and absolutely incredible talent to work with and produced exactly how I envisioned my song ending up. 100% recommend any artist going here!", "", "Other", "Produced exactly how I envisioned my song ending up.", "Recording"],
    ["Good News Threads", 5, "Best studio in the DMV! The location is perfect for any area in the DMV. The space is amazing & perfect for any artist to perform, host a listening party, have a photoshoot, record a podcast, host a girls in the studio night, and more!", "", "Google", "Best studio in the DMV!", "Podcast"],
    ["Janisse Sellman", 5, "GREAT EXPERIENCE very fun for my daughter’s 7th birthday they made so many songs the engineer was GREAT really patient and calm. Loved everything", "", "Google", "The engineer was GREAT really patient and calm.", "Home"],
    ["Kennedy Trusty", 5, "I have used the photography studio multiple times! It is always clean and ready to go at booking time! Owner is very flexible with your needs. All times I brought my own photographer and only utilized the space. Equipment is in great condition and available to use! I will be returning!", "", "Google", "Always clean and ready to go at booking time!", "Photo"],
    ["MyCityM", 5, "Amazing full service sound studio, and photography studio. Great athleisurewear as well. The owner Cory aka Flawless is one of the most genuine, dedicated, hard working and community oriented business owners in the region.", "", "Other", "Amazing full service sound studio.", "Home"],
    ["Nyia C", 5, "GVO Sounds Studios is an awesome multifaceted makers space. You can record music, learn how to make music, take photos, buy clothing, and a lot more. The owner and his colleagues are amazing. They always provide excellent service at GVO Sounds Studio.", "", "Other", "They always provide excellent service.", "Home"]
  ];
  sh.getRange(3, 1, seed.length, 7).setValues(seed);
  sh.getRange(3, 8, ROWS, 1).insertCheckboxes();
  sh.getRange(3, 8, seed.length, 1).check();
  const list = vals => SpreadsheetApp.newDataValidation().requireValueInList(vals, true).setAllowInvalid(false).build();
  sh.getRange(3, 7, ROWS, 1).setDataValidation(list(REVIEW_ON));
  sh.getRange(3, 5, ROWS, 1).setDataValidation(list(['Google', 'Other']));
  sh.getRange(3, 2, ROWS, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireNumberBetween(1, 5).setAllowInvalid(false).build());
  sh.getRange(3, 4, ROWS, 1).setNumberFormat('mmm d, yyyy');
  sh.getRange(3, 3, ROWS, 1).setWrap(true);
  sh.getRange(3, 6, ROWS, 1).setWrap(true);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 60); sh.setColumnWidth(3, 420); sh.setColumnWidth(4, 100);
  sh.setColumnWidth(5, 80); sh.setColumnWidth(6, 260); sh.setColumnWidth(7, 100); sh.setColumnWidth(8, 60);
  sh.getRange(2, 1, ROWS + 1, 8).setVerticalAlignment('top');
  console.log('Reviews tab made with ' + seed.length + ' reviews, all ticked.');
}

function doGet() { return out({ ok: true, service: 'GVO form submissions' }); }

function out(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// Run once: creates the shared secret and prints it for Cloudflare. Running it again replaces the secret.
function makeSecret() {
  const v = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty('FORM_SECRET', v);
  console.log('Save this in Cloudflare as FORMS_SECRET: ' + v);
}

// Run once from the editor to approve permissions and send a test alert.
function setup() {
  if (!PropertiesService.getScriptProperties().getProperty('FORM_SECRET')) throw new Error('Add the FORM_SECRET script property first.');
  MailApp.sendEmail(ALERT_TO, 'GVO website forms are connected', 'Form alerts from gvosound.com will arrive at this address.');
}
