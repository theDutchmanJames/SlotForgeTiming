// A complete backup: the whole database in one file (every item, layout, picture, setting, session and lap), and restoring it.
const schema = require('./schema');
const MARK = 'slotforge-timing-backup';
const OLD_MARKS = ['slot-lap-timer-backup']; // backups made before the app was renamed still restore
const SAFE_ID = /^[\w-]{1,64}$/; // the ids of custom fields are made by the app (8 hex digits); anything else in a file could add HTML to a screen
const plain = x => typeof x === 'object' && x !== null && !Array.isArray(x);

// info: { version } the app version that makes the backup
function make(data, info = {}) {
  return { app: MARK, appVersion: info.version || '', date: new Date().toISOString(), data };
}

// Is this a backup file from this app? On success: a summary with the number of items per kind.
function check(bundle) {
  if (!bundle || typeof bundle !== 'object' || bundle.app !== MARK && !OLD_MARKS.includes(bundle.app)) return { ok: false, error: 'This is not a backup file from this app. (Items exported with Export are added with Import instead.)' };
  const d = bundle.data;
  if (!plain(d)) return { ok: false, error: 'The backup file is damaged: it has no data.' };
  for (const name of Object.keys(schema)) {
    if (d[name] === undefined) continue;
    if (!Array.isArray(d[name])) return { ok: false, error: `The backup file is damaged: "${name}" is not a list.` };
    if (!d[name].every(plain)) return { ok: false, error: `The backup file is damaged: "${name}" has an item that cannot be read.` };
  }
  if (d.settings !== undefined && !plain(d.settings)) return { ok: false, error: 'The backup file is damaged: the settings are not readable.' };
  if (d.customFields !== undefined && !(plain(d.customFields) && Object.values(d.customFields).every(list => Array.isArray(list) && list.every(f => plain(f) && typeof f.id === 'string' && SAFE_ID.test(f.id))))) return { ok: false, error: 'The backup file is damaged: the custom fields are not readable.' };
  const counts = {}; for (const name of Object.keys(schema)) if (Array.isArray(d[name]) && d[name].length) counts[name] = d[name].length;
  return { ok: true, date: bundle.date || '', appVersion: bundle.appVersion || '', counts, laps: Array.isArray(d.laps) ? d.laps.length : 0 };
}

module.exports = { make, check, MARK };
