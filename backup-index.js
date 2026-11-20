'use strict';
// (2.4.0, SlotForgeRestyle.md "Backup Vault") What the app knows about its backups, next to the backups themselves: for every backup a kind
// (auto, hand: made with Back up now or Save a backup to…, safety: before a restore or an import), a note ("Before club night") and what it held
// when it was made (drivers, tracks, slot cars, race setups, races). Kept in a small file in the app's folder. A backup saved elsewhere with Save a
// backup to… is remembered here so it shows in the list too. The backups in the backup folder are found by their names (auto-backup.js, list).
const fs = require('node:fs'),
  path = require('node:path'),
  crypto = require('node:crypto');

const KEYS = ['drivers', 'tracks', 'slotcars', 'racesetups', 'sessions'];
const idOf = p => crypto.createHash('sha1').update(path.resolve(p).toLowerCase()).digest('hex').slice(0, 16);

function read(file) {
  try {
    const x = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { items: x && typeof x.items === 'object' && x.items ? x.items : {} };
  } catch {
    return { items: {} };
  }
}
function write(file, index) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // (2.4.0 review) written whole to a file of its own, then renamed over the index: a cut leaves the earlier index, never half of one
  const tmp = file + '.' + crypto.randomUUID() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(index));
  try {
    fs.renameSync(tmp, file);
  } catch (error) {
    fs.rmSync(tmp, { force: true });
    throw error;
  }
}
// a backup that was made: its kind, note, counts and date; outside: a backup saved outside the backup folder (it is listed by its path)
function record(index, p, { kind = 'hand', note = '', counts = null, date = new Date().toISOString(), outside = false } = {}) {
  index.items[idOf(p)] = {
    path: path.resolve(p),
    kind: ['auto', 'hand', 'safety'].includes(kind) ? kind : 'hand',
    note: String(note || '').slice(0, 120),
    counts: counts && typeof counts === 'object' ? Object.fromEntries(KEYS.map(k => [k, Number(counts[k]) || 0])) : null,
    date,
    ...(outside ? { outside: true } : {})
  };
  return index;
}
// the list: the backups in the folder (auto-backup.js list) with what the index knows of them, and the ones saved elsewhere that still exist,
// newest first. exists(p) -> true when it is still there. -> [{ id, path, name, kind, date, note, counts, folder }]
function entries(index, folderList, exists = p => fs.existsSync(p)) {
  const seen = new Set(),
    out = [];
  for (const b of folderList || []) {
    const id = idOf(b.path),
      x = index.items[id] || {};
    seen.add(id);
    out.push({
      id,
      path: b.path,
      name: b.name,
      kind: b.kind,
      date: x.date || b.date,
      note: x.note || '',
      counts: x.counts || null,
      folder: !!b.folder
    });
  }
  for (const [id, x] of Object.entries(index.items || {})) {
    if (seen.has(id) || !x.outside || !exists(x.path)) continue;
    out.push({
      id,
      path: x.path,
      name: path.basename(x.path),
      kind: x.kind,
      date: x.date,
      note: x.note || '',
      counts: x.counts || null,
      folder: !/\.json$/i.test(x.path)
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
// the backups the index knows that are gone are forgotten (the automatic ones the app removed, a file someone deleted)
function tidy(index, exists = p => fs.existsSync(p)) {
  for (const [id, x] of Object.entries(index.items || {})) if (!exists(x.path)) delete index.items[id];
  return index;
}
// are two paths on the same drive (the backups next to the data do not survive a broken disk)
const sameDrive = (a, b) => !!a && !!b && path.parse(path.resolve(a)).root.toLowerCase() === path.parse(path.resolve(b)).root.toLowerCase();

module.exports = { KEYS, idOf, read, write, record, entries, tidy, sameDrive };
