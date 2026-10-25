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
 */

const ALERT_TO = 'gvosoundllc@gmail.com';

// Tab name and column order for each form. "Received" is always column A.
const FORMS = {
  quote:  { tab: 'Podcast quotes',    label: 'Podcast or video quote', cols: ['name', 'phone', 'email', 'type', 'details'] },
  event:  { tab: 'Event inquiries',   label: 'Event inquiry',          cols: ['type', 'name', 'email', 'phone', 'org', 'when', 'city', 'details'] },
  travel: { tab: 'Travel requests',   label: 'Travel request',         cols: ['trip', 'name', 'email', 'phone', 'where', 'when', 'pax', 'details'] },
  music:  { tab: 'Music submissions', label: 'Music submission',       cols: ['artist', 'email', 'link'] },
  notify: { tab: 'Notify list',       label: 'Notify list sign-up',    cols: ['list', 'contact'] },
};
// Status column to start as "New", by tab (1-based column number), so new rows stand out.
const STATUS_COL = { quote: 7, event: 10, travel: 10 };

const LABELS = { name: 'Name', phone: 'Phone', email: 'Email', type: 'Type', details: 'Details', org: 'Company or venue',
  when: 'When', city: 'City', trip: 'Trip', where: 'Where to', pax: 'Travelers', artist: 'Artist', link: 'Link',
  list: 'List', contact: 'Email or phone' };

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, error: 'bad json' }); }
  const secret = PropertiesService.getScriptProperties().getProperty('FORM_SECRET');
  if (!secret || body.secret !== secret) return out({ ok: false, error: 'forbidden' });
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
  return out({ ok: true, row });
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
