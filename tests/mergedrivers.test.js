'use strict';
// (2.4) Merging a duplicate driver into the driver that is kept (db.mergeDrivers, record-cascades.merge).
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Database = require('../db');
const Repository = require('../data-repository');

const seed = () => ({
  drivers: [
    { id: 'anna', name: 'Anna', custom: {} },
    { id: 'dup', name: 'Anna A.', custom: {} },
    { id: 'bob', name: 'Bob', custom: {} }
  ],
  slotcars: [{ id: 'car1', name: 'Car', lapsDriven: 3, lapsSinceService: 3, custom: {} }],
  sessions: [
    {
      id: 's1',
      date: '2026-01-01',
      standings: [
        { pos: 1, driverId: 'dup', driverName: 'Anna A.', carId: 'car1' },
        { pos: 2, driverId: 'bob', driverName: 'Bob', carId: 'car1' }
      ],
      paddockJournal: {
        heats: [{ entries: [{ driverId: 'bob', driverName: 'Bob', changes: [{ driverId: 'dup', driverName: 'Anna A.' }] }] }]
      }
    },
    { id: 's2', date: '2026-01-02', standings: [{ pos: 1, driverId: 'bob', carId: 'car1' }] }
  ],
  laps: [
    { id: 'l1', sessionId: 's1', driverId: 'dup', carId: 'car1', time: 5 },
    { id: 'l2', sessionId: 's1', driverId: 'dup', carId: 'car1', time: 6, driverName: 'Anna A.' },
    { id: 'l3', sessionId: 's2', driverId: 'bob', carId: 'car1', time: 7 }
  ],
  teams: [
    { id: 't1', name: 'Both', drivers: ['anna', 'dup', 'bob'], custom: {} },
    { id: 't2', name: 'Dup only', drivers: ['dup'], custom: {} }
  ],
  championships: [
    { id: 'c1', name: 'Both', roster: [{ driver: 'anna', team: 't1' }, { driver: 'dup', team: 't2' }], custom: {} },
    { id: 'c2', name: 'Dup only', roster: [{ driver: 'dup', team: 't2' }], custom: {} }
  ],
  multiclasssystems: [
    { id: 'm1', name: 'Both', classes: [], driverClasses: [{ driverId: 'anna', classId: 'x' }, { driverId: 'dup', classId: 'y' }], custom: {} },
    { id: 'm2', name: 'Dup only', classes: [], driverClasses: [{ driverId: 'dup', classId: 'y' }], custom: {} }
  ]
});

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-merge-'));
  const file = path.join(dir, 'database.json');
  fs.writeFileSync(file, JSON.stringify(seed()));
  const db = new Database(file);
  t.after(async () => {
    await db.writesIdle();
    // This exact directory was created above, never derived from application data.
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return db;
}
const snapshot = db => JSON.stringify(db.data);

test('the kept driver takes over all of the duplicate and the duplicate is removed', async t => {
  const db = fixture(t);
  const result = await new Repository(db).mergeDrivers('dup', 'anna');
  assert.deepEqual(result, { merged: true, fromId: 'dup', intoId: 'anna', laps: 2 });
  for (const d of [db, new Database(db.file)]) {
    const laps = d.list('laps');
    assert.deepEqual(laps.map(l => l.driverId), ['anna', 'anna', 'bob'], 'laps relabelled');
    assert.equal(laps[1].driverName, 'Anna', 'a lap that carries a name gets the kept name');
    assert.equal(Object.hasOwn(laps[0], 'driverName'), false, 'a lap without a name gets none');
    const s1 = d.list('sessions')[0];
    assert.deepEqual(s1.standings[0], { pos: 1, driverId: 'anna', driverName: 'Anna', carId: 'car1' }, 'standings relabelled with name');
    assert.deepEqual(s1.paddockJournal.heats[0].entries[0].changes[0], { driverId: 'anna', driverName: 'Anna' }, 'journal driver changes');
    const [t1, t2] = d.list('teams');
    assert.deepEqual(t1.drivers, ['anna', 'bob'], 'team without duplicate');
    assert.deepEqual(t2.drivers, ['anna']);
    const [c1, c2] = d.list('championships');
    assert.deepEqual(c1.roster, [{ driver: 'anna', team: 't1' }], 'roster dedupe keeps the kept driver entry');
    assert.deepEqual(c2.roster, [{ driver: 'anna', team: 't2' }]);
    const [m1, m2] = d.list('multiclasssystems');
    assert.deepEqual(m1.driverClasses, [{ driverId: 'anna', classId: 'x' }], 'multiclass dedupe');
    assert.deepEqual(m2.driverClasses, [{ driverId: 'anna', classId: 'y' }]);
    assert.deepEqual(d.list('drivers').map(r => r.id), ['anna', 'bob'], 'duplicate removed');
    assert.equal(d.list('slotcars')[0].lapsDriven, 3, 'car lap counters unchanged');
    assert.equal(d.linkedLaps('drivers', 'anna'), 2);
  }
});

test('invalid merges throw clear errors and change nothing', async t => {
  const db = fixture(t),
    before = snapshot(db);
  assert.throws(() => db.mergeDrivers('anna', 'anna'), /cannot be merged into itself/);
  assert.throws(() => db.mergeDrivers('missing', 'anna'), /driver to merge was not found/);
  assert.throws(() => db.mergeDrivers('dup', 'missing'), /driver to keep was not found/);
  assert.throws(() => db.mergeDrivers('', 'anna'), /Choose two drivers/);
  await assert.rejects(new Repository(db).mergeDrivers('dup', 'dup'), /itself/);
  assert.equal(snapshot(db), before);
  assert.equal(new Database(db.file).list('drivers').length, 3);
});

test('a merge that fails half-way leaves nothing half-done', async t => {
  const db = fixture(t),
    before = snapshot(db);
  Object.freeze(db.data.championships[1].roster[0]); // (the roster change throws after the laps, standings and teams were changed)
  assert.throws(() => db.mergeDrivers('dup', 'anna'), TypeError);
  assert.equal(snapshot(db), before);
});

test('a merge whose write fails is taken back', async t => {
  const db = fixture(t),
    before = snapshot(db),
    commit = db.commit;
  db.commit = () => {
    throw new Error('disk full');
  };
  assert.throws(() => db.mergeDrivers('dup', 'anna'), /disk full/);
  db.commit = commit;
  assert.equal(snapshot(db), before);
});

test('the IPC handler merges when the backend can and says unsupported when it cannot', async () => {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const start = source.indexOf("ipcMain.handle('db:merge-drivers'");
  assert.ok(start > 0);
  const handlerOf = records => {
    let fn;
    const chunk = source.slice(start, source.indexOf('\n  );', start) + 5);
    new Function('ipcMain', 'records', chunk)({ handle: (_n, f) => (fn = f) }, records);
    return fn;
  };
  assert.deepEqual(await handlerOf({ mergeDrivers: (a, b) => ({ merged: true, a, b }) })(null, 'x', 'y'), { merged: true, a: 'x', b: 'y' });
  assert.deepEqual(handlerOf({})(null, 'x', 'y'), {
    unsupported: true,
    reason: 'Merging drivers needs the standard database. It is not available with SQLite storage yet.'
  });
  assert.match(fs.readFileSync(path.join(__dirname, '../preload.js'), 'utf8'), /mergeDrivers: \(from, into\) => call\('db:merge-drivers', from, into\)/);
});

// ---- SQLite: the same rules as a storage command (sqlite-records.mergeDrivers), through SqliteAppRepository ----
function sqliteFixture(t) {
  const { migrateCopy } = require('../sqlite-migration');
  const { WorkingStore, forkCopy } = require('../sqlite-working');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-merge-sqlite-')),
    file = path.join(dir, 'source.json'),
    copy = path.join(dir, 'copy'),
    work = path.join(dir, 'work');
  const source = seed();
  source.tracks = [{ id: 'tr', name: 'Track' }];
  source.laps = source.laps.map(l => ({ ...l, trackId: 'tr', lane: 1, lapNumber: 1, valid: true, time: l.time * 1000 }));
  fs.writeFileSync(file, JSON.stringify(source));
  migrateCopy({ source: file, destination: copy });
  forkCopy(copy, work);
  const store = new WorkingStore(work);
  t.after(() => {
    store.close();
    // This exact directory was created above, never derived from application data.
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return store;
}
const rows = (s, table) =>
  s
    .statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal')
    .all(table)
    .map(r => s.get(table, r.id, true).value);

test('SQLite: the kept driver takes over all of the duplicate and the duplicate is removed', async t => {
  const s = sqliteFixture(t),
    SqliteAppRepository = require('../sqlite-app-repository');
  const client = { snapshot: (e, id) => s.snapshot(e, id), command: input => s.command(input) };
  const repo = new SqliteAppRepository(client);
  const beforeAnna = s.driverProgress('anna');
  assert.equal(beforeAnna.laps, 0);
  const result = await repo.mergeDrivers('dup', 'anna');
  assert.deepEqual(result, { merged: true, fromId: 'dup', intoId: 'anna', laps: 2 });
  assert.deepEqual(rows(s, 'laps').map(l => [l.id, l.driverId]), [['l1', 'anna'], ['l2', 'anna'], ['l3', 'bob']], 'laps relabelled in place');
  assert.equal(rows(s, 'laps')[1].driverName, 'Anna');
  assert.deepEqual(
    s.statement('SELECT id, driverId FROM lap_index ORDER BY id').all().map(r => [r.id, r.driverId]),
    [['l1', 'anna'], ['l2', 'anna'], ['l3', 'bob']],
    'lap_index follows'
  );
  const progress = s.driverProgress('anna');
  assert.equal(progress.laps, 2, 'driver progress reads the kept driver');
  assert.equal(progress.tracks[0].best, 5000, 'personal best of the kept driver');
  assert.equal(s.driverProgress('dup'), null);
  const s1 = rows(s, 'sessions')[0];
  assert.deepEqual(s1.standings[0], { pos: 1, driverId: 'anna', driverName: 'Anna', carId: 'car1' }, 'standings relabelled with name');
  assert.deepEqual(s1.paddockJournal.heats[0].entries[0].changes[0], { driverId: 'anna', driverName: 'Anna' });
  assert.deepEqual(rows(s, 'teams').map(r => r.drivers), [['anna', 'bob'], ['anna']], 'team without duplicate');
  assert.deepEqual(
    rows(s, 'championships').map(c => c.roster),
    [[{ driver: 'anna', team: 't1' }], [{ driver: 'anna', team: 't2' }]],
    'roster dedupe'
  );
  assert.deepEqual(
    rows(s, 'multiclasssystems').map(m => m.driverClasses),
    [[{ driverId: 'anna', classId: 'x' }], [{ driverId: 'anna', classId: 'y' }]],
    'multiclass dedupe'
  );
  assert.deepEqual(rows(s, 'drivers').map(r => r.id), ['anna', 'bob'], 'duplicate removed');
  assert.equal(rows(s, 'slotcars')[0].lapsDriven, 3, 'car lap counters unchanged');
});

test('SQLite: invalid or stale merges throw and change nothing', async t => {
  const s = sqliteFixture(t),
    SqliteAppRepository = require('../sqlite-app-repository');
  const repo = new SqliteAppRepository({ snapshot: (e, id) => s.snapshot(e, id), command: input => s.command(input) });
  const state = () => JSON.stringify(['drivers', 'laps', 'sessions', 'teams', 'championships', 'multiclasssystems'].map(t => rows(s, t)));
  const before = state();
  await assert.rejects(repo.mergeDrivers('anna', 'anna'), /cannot be merged into itself/);
  await assert.rejects(repo.mergeDrivers('missing', 'anna'), /driver to merge was not found/);
  await assert.rejects(repo.mergeDrivers('dup', 'missing'), /driver to keep was not found/);
  assert.throws(
    () => s.command({ id: 'stale', type: 'mergeDrivers', fromId: 'dup', intoId: 'anna', expectedFromRevision: 5, expectedIntoRevision: 0 }),
    /version conflict/
  );
  assert.equal(state(), before);
  assert.deepEqual(s.statement("SELECT driverId FROM lap_index WHERE id='l1'").get().driverId, 'dup');
});
