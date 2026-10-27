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
 */

const ALERT_TO = 'gvosoundllc@gmail.com';
const SITE = 'https://gvo-sound-329.pages.dev'; // keeps working after launch, same Cloudflare project
const SOCIAL_TAB = 'Social posts';
// Social posts columns: A Post link, B Account, C Date, D Caption, E Media type, F Approved, G Show on, H Post ID
const KINDS = { IMAGE: 'Photo', VIDEO: 'Reel or video', CAROUSEL_ALBUM: 'Carousel' };

// Tab name and column order for each form. "Received" is always column A.
const FORMS = {
  quote:  { tab: 'Podcast quotes',    label: 'Podcast or video quote', cols: ['name', 'phone', 'email', 'type', 'details'] },
  event:  { tab: 'Event inquiries',   label: 'Event inquiry',          cols: ['type', 'name', 'email', 'phone', 'org', 'when', 'city', 'details'] },
  travel: { tab: 'Travel requests',   label: 'Travel request',         cols: ['trip', 'name', 'email', 'phone', 'where', 'when', 'pax', 'details'] },
  music:  { tab: 'Music submissions', label: 'Music submission',       cols: ['artist', 'email', 'title', 'type', 'links', 'ig', 'tiktok', 'yt', 'gvo', 'engineer', 'notes'] },
  notify: { tab: 'Notify list',       label: 'Notify list sign-up',    cols: ['list', 'contact'] },
};
// Status column to start as "New", by tab (1-based column number), so new rows stand out.
const STATUS_COL = { quote: 7, event: 10, travel: 10 };

const LABELS = { name: 'Name', phone: 'Phone', email: 'Email', type: 'Type', details: 'Details', org: 'Company or venue',
  when: 'When', city: 'City', trip: 'Trip', where: 'Where to', pax: 'Travelers', artist: 'Artist', title: 'Song or project',
  links: 'Links', ig: 'Instagram', tiktok: 'TikTok', yt: 'YouTube', gvo: 'Recorded at GVO', engineer: 'GVO engineer or producer',
  notes: 'Anything else', list: 'List', contact: 'Email or phone' };

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('FORM_SECRET');
  if (!secret || body.secret !== secret) return out({ ok: false, error: 'forbidden' });
  if (body.action === 'social') return out(social(body));
  const form = FORMS[body.form];
  if (!form) return out({ ok: false, error: 'unknown form' });
  const f = body.fields || {};

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let row;
  try {
    const sheet = SpreadsheetApp.getActive().getSheetByName(form.tab);
    // Leading ' keeps the sheet from turning text like 2/14 or +1410 into dates or formulas.
    const values = [new Date()].concat(form.cols.map(k => f[k] == null || f[k] === '' ? '' : "'" + String(f[k]).slice(0, 2000)));
    sheet.appendRow(values);
    row = sheet.getLastRow();
    if (STATUS_COL[body.form]) sheet.getRange(row, STATUS_COL[body.form]).setValue('New');
  } finally {
    lock.releaseLock();
  }

  try {
    const who = f.name || f.artist || f.contact || 'Someone';
    const lines = form.cols.filter(k => f[k]).map(k => LABELS[k] + ': ' + f[k]);
    const url = SpreadsheetApp.getActive().getUrl() + '#gid=' + SpreadsheetApp.getActive().getSheetByName(form.tab).getSheetId();
    const opts = { name: 'GVO Sound website' };
    if (f.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) opts.replyTo = f.email;
    MailApp.sendEmail(ALERT_TO, `${form.label}: ${who}`,
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
