'use strict';
// 2.4.0: App Settings > Connections > Shared Library. Retry converts a race whose conversion failed again (a race saved before a fix converts now),
// and Remove takes a race that never reached the library off the list. On both storage types (JSON and SQLite).
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const H = require('../shared-library-history'),
  { deliverySummary } = require('../paddock-storage');
const saved = '2026-10-25T12:34:56.789Z';
const lib = () => ({ sharedLibrary: { version: 1, databaseId: 'library', recoveryId: 'epoch', sourceId: 'source' }, adoptedCarIds: { c: 'canonical-car' } });
const adopted = () => ({ transport: 'engine', status: 'adopted', baseline: { version: 1, provenance: 'historical', expected: { revision: 1, state: 'active', contentHash: 'a'.repeat(64) } } });
function race(id) {
  const session = { id, sessionType: 'qualifying', date: saved, setupName: 'Test race ' + id, trackId: 't', trackName: 'Club', standings: [{ carId: 'c', driverId: 'd', driverName: 'James', laps: 2, best: 6795, pos: 1 }] };
  const laps = [7021, 6795].map((time, i) => ({ id: id + '-lap-' + i, sessionId: id, carId: 'c', driverId: 'd', trackId: 't', lane: 2, lapNumber: i + 1, time, date: saved }));
  return { session, laps };
}
// a race whose conversion failed in an older version: the race itself is fine now
function failedOnce(id, old) {
  const e = race(id);
  e.session.paddockJournal = lib();
  e.session.paddockJournal.sharedLibrary.recoveryId = 'not valid!';
  H.prepare(e.session, e.laps, old);
  e.session.paddockJournal.sharedLibrary.recoveryId = 'epoch';
  return e;
}

test('the history module: a failed conversion is prepared again, a never-shared one can be removed, a shared one cannot', () => {
  const a = failedOnce('a', adopted()),
    b = failedOnce('b', undefined);
  assert.equal(H.failed(a.session.paddockDelivery), true);
  assert.equal(H.neverShared(a.session.paddockDelivery), false, 'its earlier version is in the library');
  assert.equal(H.neverShared(b.session.paddockDelivery), true);
  assert.equal(deliverySummary(b.session.paddockDelivery).neverShared, true);
  assert.equal(H.reconvert({ laps: a.laps, paddock: {} }, a.session), true);
  assert.equal(a.session.paddockDelivery.status, 'pending', a.session.paddockDelivery.error);
  assert.equal(H.reconvert({ laps: a.laps, paddock: {} }, a.session), false, 'a converted race is left alone');
  assert.throws(() => H.dismiss(a.session), /already in the shared library/);
  H.dismiss(b.session);
  assert.equal(b.session.paddockDelivery.status, 'withdrawn');
  assert.equal(H.failed(b.session.paddockDelivery), false);
  H.revise({ laps: b.laps, paddock: {} }, b.session);
  assert.equal(b.session.paddockDelivery.status, 'withdrawn', 'a removed race is not brought back by a later edit');
});

function source() {
  const a = failedOnce('a', adopted()),
    b = failedOnce('b', undefined);
  return {
    version: 1,
    drivers: [{ id: 'd', name: 'James' }],
    tracks: [{ id: 't', name: 'Club' }],
    slotcars: [{ id: 'c', model: 'Car' }],
    sessions: [a.session, b.session],
    laps: [...a.laps, ...b.laps],
    customFields: {},
    paddock: { sourceId: 'source', withdrawals: [] }
  };
}

test('JSON database: Retry converts the race again, Remove drops a never-shared one from the list', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-libres-'));
  try {
    const DB = require('../db'),
      file = path.join(dir, 'db.json');
    fs.writeFileSync(file, JSON.stringify(source()));
    const db = new DB(file),
      repo = new (require('../data-repository'))(db, {});
    assert.equal(await repo.libraryResult('a', 'reconvert'), true);
    assert.equal(await repo.libraryResult('b', 'reconvert'), true, 'tried again (it still cannot be converted)');
    assert.equal(H.failed(db.data.sessions.find(x => x.id === 'b').paddockDelivery), true);
    assert.equal(await repo.libraryResult('a', 'reconvert'), false, 'a converted race is left alone');
    assert.equal(await repo.libraryResult('b', 'remove'), true);
    await db.saved?.();
    const again = new DB(file),
      list = new (require('../paddock-storage').JsonPaddockStorage)(again).summary().deliveries;
    assert.deepEqual(
      list.map(d => [d.sessionId, d.status]),
      [['a', 'pending']]
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('SQLite database: the same two actions as storage commands', t => {
  const { migrateCopy } = require('../sqlite-migration'),
    { WorkingStore, forkCopy } = require('../sqlite-working');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-libres-sql-'));
  let s;
  t.after(() => {
    s?.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const src = path.join(dir, 'source.json'),
    copy = path.join(dir, 'copy'),
    work = path.join(dir, 'work');
  fs.writeFileSync(src, JSON.stringify(source()));
  migrateCopy({ source: src, destination: copy });
  forkCopy(copy, work);
  s = new WorkingStore(work);
  assert.deepEqual(s.command({ id: 'r1', type: 'libraryResult', sessionId: 'a', action: 'reconvert' }), { changed: true });
  assert.deepEqual(s.command({ id: 'r2', type: 'libraryResult', sessionId: 'b', action: 'reconvert' }), { changed: true });
  assert.equal(H.failed(s.get('sessions', 'b', true).value.paddockDelivery), true, 'it still cannot be converted');
  assert.deepEqual(s.command({ id: 'r2b', type: 'libraryResult', sessionId: 'a', action: 'reconvert' }), { changed: false });
  assert.deepEqual(s.command({ id: 'r3', type: 'libraryResult', sessionId: 'b', action: 'remove' }), { changed: true });
  assert.equal(s.get('sessions', 'a', true).value.paddockDelivery.status, 'pending');
  assert.equal(s.get('sessions', 'b', true).value.paddockDelivery.status, 'withdrawn');
  const rows = s.statement('SELECT sessionId,status FROM delivery_outbox WHERE current=1 ORDER BY sessionId').all();
  assert.deepEqual(
    rows.map(r => [r.sessionId, r.status]),
    [['a', 'pending']]
  );
  assert.throws(() => s.command({ id: 'r4', type: 'libraryResult', sessionId: 'a', action: 'remove' }), /already in the shared library/);
});
