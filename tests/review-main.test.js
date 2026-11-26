'use strict';
// 2.4.0 review: the fixes of the main process and its storage (import with replace, merging drivers, saves that retry, driver progress with
// many laps, track links in an export, replaced teams, the network server, automatic backups, PDF temp files, restore staging, the backup index).
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path'),
  crypto = require('node:crypto');
const { code, has } = require('./source.cjs');
const temp = t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-review-main-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};

test('F1: an import checks every item to replace first, and is not pending any more once its copies are in', () => {
  const main = code('main.js');
  assert(has(main, 'for (const r of p.replace) if (!(await records.get(r.e, r.id))) throw Error('));
  const flat = main.replace(/\s+/g, '');
  const imported = flat.indexOf('constcounts=has?awaitbulkStorage.importItems(p.bundle):{};'),
    cleared = flat.indexOf('pendingImport=null;pendingImportList=null;', imported),
    replaced = flat.indexOf('awaitrecords.update(r.e,r.id,r.row);');
  // (audit 2026-11) the replacements first (a plain update, harmless to do again), then the copies, and the pending file is cleared right after them
  assert(imported > 0 && cleared > imported && replaced > 0 && replaced < imported, 'replaced, then the copies, then the pending file cleared');
});

test('F2: merging drivers relabels team members, stints, best lap by, class and heat rows, and virtual rivals', () => {
  const RC = require('../record-cascades');
  const d = Object.fromEntries(Object.keys(require('../schema')).map(k => [k, []]));
  d.drivers = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' }
  ];
  const standings = [{ driverId: 't', drivers: [{ driverId: 'a' }], stints: [{ driverId: 'a' }], bestBy: 'a' }];
  d.sessions = [
    {
      id: 's',
      standings,
      classStandings: [{ driverId: 'a' }],
      heatResults: [{ rows: [{ driverId: 'a' }] }],
      rivalClassification: [{ driverId: 'a' }]
    }
  ];
  RC.merge(d, 'a', 'b', () => {});
  const s = d.sessions[0];
  assert.equal(JSON.stringify(s).includes('"a"'), false, JSON.stringify(s));
  assert.equal(s.standings[0].stints[0].driverId, 'b');
  assert.equal(s.heatResults[0].rows[0].driverId, 'b');
  assert.equal(standings[0].stints[0].driverId, 'a', 'the old objects are not changed in place (a failed merge puts them back)');
});

test('F3: a save in the program’s own time tries the rename again when the file is held for a moment', t => {
  const Database = require('../db'),
    dir = temp(t),
    file = path.join(dir, 'x.json');
  const real = fs.renameSync;
  let fails = 2;
  fs.renameSync = (...a) => {
    if (fails-- > 0) throw Object.assign(Error('busy'), { code: 'EBUSY' });
    return real(...a);
  };
  try {
    Database.writeAtomic(file, 'kept');
  } finally {
    fs.renameSync = real;
  }
  assert.equal(fs.readFileSync(file, 'utf8'), 'kept');
  fs.renameSync = () => {
    throw Object.assign(Error('denied'), { code: 'ENOENT' });
  };
  try {
    assert.throws(() => Database.writeAtomic(file, 'new'), /denied/);
  } finally {
    fs.renameSync = real;
  }
  assert.equal(fs.existsSync(file + '.tmp'), false, 'a rename that fails removes its temporary file');
  assert(has(code('db.js'), 'renameSyncWithRetry(tmp, file);'));
});

test('F4: driver progress works for a driver with very many laps on one track', () => {
  const P = require('../driver-progress');
  const laps = Array.from({ length: 200000 }, (_, i) => ({ trackId: 't', time: 5000 + (i % 300), date: '2025-03-01' }));
  const r = P.progress(laps);
  assert.equal(r.tracks[0].best, 5000);
  assert.equal(r.tracks[0].months[0].best, 5000);
});

test('F5: the track of a fuel rule, a safety car system and a push and save system goes along with an export', () => {
  const T = require('../transfer');
  const data = {
    tracks: [{ id: 't1', name: 'Home' }],
    fuelrules: [{ id: 'f1', name: 'F', paceSource: 'track', paceTrack: 't1' }],
    safetycarsystems: [{ id: 's1', name: 'SC', safetyTrack: 't1' }],
    pushsavesystems: [{ id: 'p1', name: 'PS', previewTrack: 't1' }],
    customFields: {}
  };
  const b = T.collect(data, { fuelrules: ['f1'], safetycarsystems: ['s1'], pushsavesystems: ['p1'] }, true);
  assert.deepEqual(
    b.items.tracks.map(x => x.id),
    ['t1']
  );
  const row = { id: 'f', paceSource: 'track', paceTrack: 'gone' };
  T.refsOf('fuelrules', row).forEach(r => r.set(''));
  assert.equal(row.paceSource, 'constant', 'a fuel rule whose track did not come along uses a constant amount');
});

test('F6: a replaced team or championship keeps no empty drivers', () => {
  const T = require('../transfer');
  const bundle = {
    format: T.FORMAT,
    fileVersion: 1,
    items: {
      teams: [{ id: 'ft', name: 'Team X', drivers: ['fd1', 'fd2'] }],
      championships: [{ id: 'fc', name: 'Cup', roster: [{ driver: 'fd1', team: '' }] }]
    }
  };
  const list = T.matches(bundle, { teams: [{ id: 'mine', name: 'Team X' }], championships: [{ id: 'cup', name: 'Cup' }] });
  const p = T.plan(bundle, list, { 'teams:ft': 'replace', 'championships:fc': 'replace' });
  assert.deepEqual(p.replace.find(r => r.e === 'teams').row.drivers, []);
  assert.deepEqual(p.replace.find(r => r.e === 'championships').row.roster, []);
});

test('F7: a network server that could not start is closed again', async () => {
  const { createServer } = require('../server');
  const o = { root: __dirname, appRoot: __dirname, schema: {}, getSettings: () => ({}), list: () => [], customFields: () => [] };
  const first = createServer(o),
    port = await first.listen(0, '127.0.0.1');
  const second = createServer(o);
  await assert.rejects(second.listen(port, '127.0.0.1'), e => e.code === 'EADDRINUSE');
  await second.close(); // (resolves for a server that never listened)
  await first.close();
  assert(has(code('main.js'), 'server.close().catch(() => {});'));
});

test('F8: a backup of another kind asked for during a run is made after it, and idle() waits for both', async t => {
  const A = require('../auto-backup'),
    dir = temp(t),
    made = [];
  let release;
  const gate = new Promise(r => (release = r));
  const ab = A.createAutoBackup({
    settings: () => ({ autoBackup: { folder: dir } }),
    defaultFolder: dir,
    stateFile: path.join(dir, 'state.json'),
    make: async target => {
      made.push(path.basename(target).split('-')[2]);
      if (made.length === 1) await gate;
      fs.writeFileSync(target, '{}');
    }
  });
  const auto = ab.run('scheduled'),
    hand = ab.run('by hand', { kind: 'hand', note: 'Before club night' }),
    again = ab.run('scheduled');
  let idle = false;
  const waiting = ab.idle().then(() => (idle = true));
  await new Promise(r => setImmediate(r));
  assert.equal(idle, false, 'idle waits for the run');
  release();
  await Promise.all([auto, hand, again, waiting]);
  assert.deepEqual(made, ['auto', 'hand'], 'the second automatic request joins the running one; the hand backup is made after it');
  const main = code('main.js');
  assert(has(main, 'backupRunner?.stop(); await backupRunner?.idle();'));
});

test('F9: every PDF export has a temporary file of its own', () => {
  assert(has(code('main.js'), "`slotforge-timing-${require('node:crypto').randomUUID()}.html`"));
});

test('F10: a restore that could not be staged leaves no copy of the backup', async t => {
  const Activation = require('../storage-activation'),
    profile = temp(t),
    generation = crypto.randomUUID(),
    working = path.join(profile, 'sqlite', generation, 'working');
  fs.mkdirSync(working, { recursive: true });
  fs.writeFileSync(path.join(working, 'working.sqlite'), '');
  fs.writeFileSync(
    path.join(profile, 'storage-backend.json'),
    JSON.stringify({ format: Activation.FORMAT, version: 1, backend: 'sqlite', generation })
  );
  const backup = path.join(profile, 'backup.json');
  fs.writeFileSync(backup, '{"app":"slotforge-timing-backup","data":{}}');
  await assert.rejects(Activation.requestRestore(profile, backup, 'not-the-reviewed-file'), /changed after it was reviewed/);
  await assert.rejects(
    Activation.requestRestore(profile, backup, await Activation.digest(backup), {
      beforePublish: () => {
        throw Error('busy now');
      }
    }),
    /busy now/
  );
  assert.deepEqual(
    fs.readdirSync(path.join(profile, 'sqlite')).filter(n => n.startsWith('restore-input-')),
    []
  );
  assert(has(code('storage-activation.js'), 'fs.rmSync(target, { recursive: true, force: true });'));
});

test('F11: the backup index is written whole, and a backup note reads the index only after counting', t => {
  const BI = require('../backup-index'),
    dir = temp(t),
    file = path.join(dir, 'sub', 'backup-index.json');
  const ix = BI.record({ items: {} }, path.join(dir, 'a.json'), { kind: 'hand', note: 'x' });
  BI.write(file, ix);
  assert.equal(Object.keys(BI.read(file).items).length, 1);
  assert.deepEqual(fs.readdirSync(path.dirname(file)), ['backup-index.json']);
  assert(has(code('main.js'), 'const counts = await holdsNow().catch(() => null); const ix = BackupIndex.read(backupIndexFile);'));
});
