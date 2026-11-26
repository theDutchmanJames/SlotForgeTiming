'use strict';
// 2.4.0: Import and Export reworked (auto-backup.js, backup-index.js, transfer.js, main.js, renderer/transferui.js, SlotForgeRestyle.md "Backup Vault"):
// every backup in a list (automatic, by hand with a note, for safety before a restore or an import) with what it holds and Restore on each, the restore
// question with what is lost, the export picker with Your file, and an import that marks what is already here with Add a copy, Replace mine or Skip.
const test = require('node:test'),
  assert = require('node:assert/strict');
const fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const AB = require('../auto-backup.js'),
  IX = require('../backup-index.js'),
  Transfer = require('../transfer.js'),
  DB = require('../db.js');
const { code, has } = require('./source.cjs');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-vault-'));

test('backups by hand and for safety: their own names, listed with the automatic ones, never removed by the app', async () => {
  const dir = tmp(),
    out = path.join(dir, 'out');
  let t = Date.parse('2026-11-10T19:00:00Z');
  const made = [];
  const ab = AB.createAutoBackup({
    settings: () => ({ autoBackup: { keep: 1, folder: out } }),
    defaultFolder: path.join(dir, 'unused'),
    stateFile: path.join(dir, 'state.json'),
    busy: () => 'an import or restore is running',
    now: () => t,
    make: async target => fs.writeFileSync(target, '{}'),
    afterMake: async (target, o) => made.push([path.basename(target).split('-')[2], o.kind, o.note])
  });
  assert.deepEqual(await ab.run('scheduled'), { skipped: 'an import or restore is running' }, 'an automatic backup waits for an import');
  const r = await ab.run('by hand', { kind: 'hand', note: 'Before club night' });
  assert.equal(r.ok, true, 'a backup by hand is made while an import is busy');
  t += 1000;
  await ab.run('for safety', { kind: 'safety', note: 'Before a restore' });
  assert.deepEqual(made, [
    ['hand', 'hand', 'Before club night'],
    ['safety', 'safety', 'Before a restore']
  ]);
  assert.deepEqual(
    AB.list(out).map(b => b.kind),
    ['safety', 'hand'],
    'newest first'
  );
  assert.equal(AB.own(out).length, 0, 'none of them is an automatic one, so none is removed');
  assert.match(AB.nameOf(new Date(2026, 10, 20, 21, 4, 5), true, 'hand'), /^SlotForge-Timing-hand-2026-11-20-210405\.slotforge-backup$/);
  assert(ab.status().next, 'when the next one is due');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the index: what a backup held, its note, a backup saved elsewhere, the same drive', () => {
  const dir = tmp(),
    folder = path.join(dir, 'backups');
  fs.mkdirSync(folder);
  const a = path.join(folder, 'SlotForge-Timing-auto-2026-11-17-083204.json'),
    outside = path.join(dir, 'usb', 'club.json');
  fs.writeFileSync(a, '{}');
  fs.mkdirSync(path.dirname(outside));
  fs.writeFileSync(outside, '{}');
  const ix = { items: {} };
  IX.record(ix, a, { kind: 'auto', counts: { drivers: 36, tracks: 9, sessions: 418 }, date: '2026-11-17T07:32:04.000Z' });
  IX.record(ix, outside, { kind: 'hand', note: 'Before club night', date: '2026-11-20T20:00:00.000Z', outside: true });
  IX.record(ix, path.join(dir, 'gone.json'), { kind: 'hand', outside: true });
  const list = IX.entries(IX.tidy(ix), AB.list(folder));
  assert.deepEqual(
    list.map(x => [x.kind, x.note, x.counts && x.counts.sessions]),
    [
      ['hand', 'Before club night', null],
      ['auto', '', 418]
    ]
  );
  assert.equal(Object.keys(ix.items).length, 2, 'a backup that is gone is forgotten');
  assert.equal(IX.sameDrive('C:\\data', 'c:\\backups'), true);
  assert.equal(IX.sameDrive('C:\\data', 'E:\\backups'), process.platform === 'win32' ? false : true);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('import: what is already here (by identity, else by name), and Add a copy, Replace mine or Skip with the links kept', () => {
  const dir = tmp();
  const mine = new DB(path.join(dir, 'mine.json'));
  const track = mine.add('tracks', { name: 'Club Oval', lanes: 4, surface: 'LOCAL' });
  const bundle = {
    format: Transfer.FORMAT,
    fileVersion: 1,
    items: {
      tracks: [{ id: track.id, name: 'Club Oval', lanes: 4 }],
      drivers: [{ id: 'd-new', name: 'Mila X.' }],
      racesetups: [
        { id: 'r1', name: 'Club night', track: track.id, sessionType: 'race' },
        { id: 'r2', name: 'Other night', track: track.id, sessionType: 'race' }
      ]
    }
  };
  const list = Transfer.matches(bundle, {
    tracks: mine.list('tracks'),
    drivers: mine.list('drivers'),
    racesetups: mine.list('racesetups')
  });
  assert.deepEqual(
    list.map(m => [m.e, m.title, m.match ? m.match.title : null, m.how]),
    [
      ['tracks', 'Club Oval', 'Club Oval', 'id'],
      ['drivers', 'Mila X.', null, ''],
      ['racesetups', 'Club night', null, ''],
      ['racesetups', 'Other night', null, '']
    ]
  );
  // the track replaces mine, the driver is skipped, one race setup is added: it links to my track
  const p = Transfer.plan(
    bundle,
    list,
    { [`tracks:${track.id}`]: 'replace', 'drivers:d-new': 'skip', 'racesetups:r2': 'skip' },
    () => 'new-' + Math.random().toString(36).slice(2)
  );
  assert.equal(p.skipped, 2);
  assert.deepEqual(
    p.replace.map(r => [r.e, r.id, r.row.name, r.row.surface]),
    [['tracks', track.id, 'Club Oval', '']],
    'what the file does not have is emptied in mine'
  );
  Transfer.apply(mine, p.bundle);
  mine.update(p.replace[0].e, p.replace[0].id, p.replace[0].row);
  assert.equal(mine.list('drivers').length, 0);
  assert.equal(mine.list('racesetups').length, 1);
  assert.equal(mine.list('racesetups')[0].track, track.id, 'the copy uses my track');
  assert.equal(mine.list('racesetups')[0].id, p.bundle.keep.racesetups.r1, 'the id chosen beforehand');
  assert.equal(mine.list('tracks')[0].surface, '');
  // all skipped: nothing to add
  const none = Transfer.plan(bundle, list, Object.fromEntries(list.map(m => [m.e + ':' + m.id, 'skip'])));
  assert.equal(
    Object.values(none.bundle.items).every(l => !l.length),
    true
  );
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the page: how safe the backups are, what a restore loses, the file name', () => {
  global.esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const T = require('../renderer/transferui.js');
  const now = Date.parse('2026-11-20T21:30:00');
  const list = [{ date: new Date(2026, 10, 20, 21, 4).toISOString() }];
  const ok = T.bvHealth({ on: true, every: 'week', keep: 5, next: new Date(2026, 10, 27, 20, 4).toISOString() }, list, now);
  assert.equal(ok.tone, 'ok');
  // the time as this computer writes it: 21:04 on a Dutch computer, 09:04 PM on an English one
  const at = new Date(2026, 10, 20, 21, 4).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  assert.equal(ok.title, 'Backed up today, ' + at);
  assert.match(ok.line, /^Every week by itself, the newest 5 kept\. The next one is due on /);
  assert.equal(T.bvHealth({ on: true, ok: false, error: 'Disk full' }, list, now).tone, 'bad');
  assert.equal(T.bvHealth({ on: true, next: new Date(2026, 10, 10).toISOString() }, list, now).tone, 'late');
  assert.equal(T.bvHealth({ on: false }, [], now).title, 'No backup yet');
  assert.equal(
    T.bvLost(
      { drivers: 35, racesetups: 14 },
      { drivers: 36, racesetups: 15 },
      { races: 22, last: { name: 'QA heats', date: '2026-11-20T19:00:00Z' } }
    ).replace(/\(the last on [^“]+“/, '(the last on X, “'), // the date as this computer writes it ("Thu 20 Nov", "Thu, Nov 20")
    '22 races raced since then (the last on X, “QA heats”), 1 driver added since, 1 race setup added since.'
  );
  assert.equal(T.bvHolds({ drivers: 1, tracks: 9, sessions: 418 }), '1 driver · 9 tracks · 418 races');
  assert.equal(T.trFileName('Club night heats', 2), 'Club night heats + 1.json');
  assert.equal(T.trFileName('A/B: race', 1), 'A B  race.json');
  const q = T.bvRestoreHtml({ entry: { date: '2026-11-10T19:55:00Z' }, now: { drivers: 36 }, lost: { races: 0 } }, { drivers: 35 });
  assert(q.includes('class="bv-diff">36') && q.includes('Before a restore') && q.includes('data-bv-answer="yes"'));
});

test('the main process, the bridge and the page are wired', () => {
  const main = code('main.js');
  ['backups:list', 'backups:summary', 'backups:make', 'backups:show', 'backups:pick'].forEach(c =>
    assert(has(main, `bulkAccess.handle('${c}'`), c)
  );
  assert(
    has(main, "const picked = typeof backupId === 'string' && backupId ? backupById(backupId) : null;"),
    'library:restore takes a backup of the list'
  );
  assert(has(main, 'const p = transfer.plan(pendingImport,'));
  assert(
    has(main, 'await records.update(r.e, r.id, r.row);') &&
      main.indexOf('await records.update(r.e, r.id, r.row);') <
        main.indexOf('const counts = has ? await bulkStorage.importItems(p.bundle) : {};'),
    'audit 2026-11: replaced first, then the copies'
  );
  assert(has(code('bulk-access.js'), "'backups:pick'"), 'picking a backup to restore is guarded like the other restores');
  const pre = code('preload.js');
  assert(has(pre, "backupPick: id => call('backups:pick', id),") && has(pre, "importApply: choices => call('transfer:apply', choices),"));
  const ui = code('renderer/transferui.js');
  assert(has(ui, "await safety('Before a restore')") && has(ui, "await safety('Before an import')"), 'a backup first');
  assert(has(code('renderer/settingspage.js'), "['backups', 'Backups', 'Made by itself and by hand', 'clock'],"));
  assert(has(code('renderer/generalpage.js'), ':scope > .bv'));
});

test('opening the page asks for the backups while the items to export are read', () => {
  const T = code('renderer/transferui.js');
  const ask = T.indexOf('const bvJob = api.backupList ? api.backupList().catch(() => null) : null;');
  assert.ok(ask > 0 && ask < T.indexOf('await api.transferChoices()'));
  assert.ok(has(T, 'const bv = await bvJob,'));
});
