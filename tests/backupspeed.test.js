'use strict';
// 2.4.0: a backup of a large history (1.1 GB working database) took 200 s for Timing's part, and Timing could not read or save anything
// meanwhile: VACUUM INTO rebuilt every index (54 s), then the full check of the copy ran in the database worker (140 s). Now the file is
// copied after its write log was moved into it, and the same checks run in a helper thread while the worker answers Timing.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const Database = require('../db'),
  Bulk = require('../sqlite-bulk'),
  Client = require('../sqlite-client');
const { migrateCopy } = require('../sqlite-migration'),
  { WorkingStore, forkCopy } = require('../sqlite-working');
const { code, has } = require('./source.cjs');

test('a backup made through the database worker is checked aside, holds the latest saves and restores', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-backupspeed-')),
    db = new Database(path.join(dir, 'source.json'));
  db.data.drivers = [{ id: 'd', name: 'Driver' }];
  db.data.tracks = [{ id: 't', name: 'Track' }];
  db.data.sessions = [{ id: 's', trackId: 't', standings: [{ driverId: 'd', laps: 3 }] }];
  db.data.laps = [0, 1, 2].map(i => ({ id: 'l' + i, sessionId: 's', driverId: 'd', trackId: 't', time: 5000 + i, valid: true }));
  db.saveNow();
  migrateCopy({ source: db.file, destination: path.join(dir, 'copy') });
  const work = path.join(dir, 'work');
  forkCopy(path.join(dir, 'copy'), work);
  const client = new Client();
  t.after(async () => {
    await client.close();
    await db.writesIdle();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await client.openWorking(work);
  await client.command({
    id: 'edit',
    type: 'updateRecord',
    entity: 'drivers',
    recordId: 'd',
    expectedRevision: 0,
    patch: { name: 'Latest' }
  });
  const target = path.join(dir, 'backup');
  // another request while the backup is being checked: both answer
  const [report, page] = await Promise.all([client.backupSnapshot(target, { version: 'test' }), client.historyPage('racing')]);
  assert.equal(page.sessions.items.length, 1);
  assert.equal(report.state, 'verified');
  assert.equal(report.appVersion, 'test');
  assert.ok(report.records >= 6);
  assert.deepEqual(fs.readdirSync(target).sort(), ['manifest.json', 'snapshot.sqlite'], 'a sealed copy: no write log beside it');
  const dest = path.join(dir, 'restore');
  Bulk.restore(target, dest);
  const restored = new WorkingStore(dest);
  try {
    assert.equal(restored.get('drivers', 'd').value.name, 'Latest');
    assert.equal(restored.sessionLaps('s').length, 3);
  } finally {
    restored.close();
  }
  await assert.rejects(client.backupSnapshot(target, {}), /EEXIST/, 'never over an existing backup');
});

test('the worker answers a request that finishes later, and the backup is published only after its checks', () => {
  const W = code('sqlite-worker.js');
  assert.ok(has(W, "if (value && typeof value.then === 'function')"));
  const B = code('sqlite-bulk.js');
  assert.ok(has(B, "const done = free * 10 <= pages ? store.statement('PRAGMA wal_checkpoint(TRUNCATE)').get() : null;"));
  assert.ok(
    has(
      W,
      "operation === 'backupSnapshot' && store instanceof WorkingStore ? store.backupSnapshotAside(...args) : store[operation](...args);"
    )
  );
  assert.ok(has(B, "else store.db.prepare('VACUUM INTO ?').run(staging);"), 'the old copy when the log cannot be emptied');
  assert.ok(has(B, 'return publish(destination, staging, checked.counts, checked.sha256, info);'));
  assert.ok(has(code('sqlite-bulk-check.js'), 'const counts = Bulk.verify(workerData.file);'));
});

test("Timing's part and the library's part of a backup run side by side, and either failing leaves no finished backup", async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-backupboth-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const events = [];
  const client = {
    installationId: 'timing-test',
    status: async () => ({ databaseId: 'db', recoveryId: 'rc', revision: 3 }),
    handle: {
      backup: async input => {
        events.push('library start');
        fs.writeFileSync(input.destination, 'library');
        events.push('library done');
        return { databaseId: 'db', recoveryId: 'rc', revision: 3 };
      }
    }
  };
  const privateBackup = fail => async target => {
    events.push('timing start');
    await new Promise(r => setTimeout(r, 150));
    if (fail) throw Error('check failed');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'snapshot.sqlite'), 'x');
    events.push('timing done');
  };
  const { create } = require('../shared-library-backup');
  const ok = path.join(dir, 'ok');
  await create({ client, destination: ok, privateBackup: privateBackup(false), backend: 'sqlite' });
  assert.ok(events.indexOf('library done') < events.indexOf('timing done'), events.join(', '));
  assert.ok(fs.existsSync(path.join(ok, 'manifest.json')));
  const bad = path.join(dir, 'bad');
  await assert.rejects(create({ client, destination: bad, privateBackup: privateBackup(true), backend: 'sqlite' }), /check failed/);
  assert.ok(!fs.existsSync(path.join(bad, 'manifest.json')));
  const lib = path.join(dir, 'lib');
  client.handle.backup = async () => {
    throw Error('library full');
  };
  await assert.rejects(create({ client, destination: lib, privateBackup: privateBackup(false), backend: 'sqlite' }), /library full/);
  assert.ok(!fs.existsSync(path.join(lib, 'manifest.json')));
});

test('a restore uses the collection that staging validated, the same as opening the staged library again', async t => {
  const fixture = require('./support/shared-library-merge-fixture');
  const { client } = await fixture(t, 'sqlite');
  const s = await client.status(),
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-stage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const source = path.join(dir, 'library.sfpbackup');
  await client.handle.backup({ databaseId: s.databaseId, recoveryId: s.recoveryId, revision: s.revision, destination: source });
  const E = '../vendor/slotforge-library/engine/src/';
  const staged = require(E + 'portable-backup.cjs').stageBackup(source, path.join(dir, 'stage.sqlite'), { keepData: true });
  assert.ok(staged.data, 'kept');
  assert.ok(!Object.keys(staged).includes('data'), 'not part of the result');
  const again = new (require(E + 'store.cjs').Store)(path.join(dir, 'stage.sqlite')).data;
  assert.deepEqual(JSON.parse(JSON.stringify(staged.data)), JSON.parse(JSON.stringify(again)));
  assert.equal(require(E + 'portable-backup.cjs').stageBackup(source, path.join(dir, 'plain.sqlite')).data, undefined);
  const R = code('vendor/slotforge-library/engine/src/shared-library-restore.cjs');
  assert.ok(has(R, 'const validated = keyed === false && staged.data ? staged.data : new Store(stage).data;'));
  assert.ok(has(code('main.js'), "startupFeedback?.status?.('Restoring the car library from your backup."));
});
