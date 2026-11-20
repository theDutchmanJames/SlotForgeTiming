'use strict';
// (2.4.0 review) SQLite storage layer: shared-import name clashes, revisions that only go stale for their own
// collections, restore epochs, request timers, Home track order, collection roots and the field lookup index.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const Database = require('../db'),
  Transfer = require('../transfer'),
  schema = require('../schema'),
  Client = require('../sqlite-client'),
  Bulk = require('../sqlite-bulk'),
  Catalogue = require('../sqlite-catalogue');
const { migrateCopy } = require('../sqlite-migration'),
  { forkCopy, WorkingStore } = require('../sqlite-working');
async function fixture(t, mutate = () => {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-review-sqlite-')),
    db = new Database(path.join(dir, 'source.json'));
  mutate(db.data);
  db.saveNow();
  await db.writesIdle?.();
  migrateCopy({ source: db.file, destination: path.join(dir, 'copy') });
  forkCopy(path.join(dir, 'copy'), path.join(dir, 'work'));
  const stores = [];
  const open = (dirName = 'work') => {
    const s = new WorkingStore(path.join(dir, dirName));
    stores.push(s);
    return s;
  };
  t.after(() => {
    for (const s of stores) s.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { dir, db, open };
}
let n = 0;
const id = () => 'review-' + ++n + '-' + Math.random();
const resume = s =>
  s.command({
    id: id(),
    type: 'setRaceResume',
    snapshot: { v: 1, race: { name: 'x' }, eng: { v: 1 } },
    expectedRevision: s.revision('@meta', 'raceResume')
  });
const names = (s, e) =>
  s
    .statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal')
    .all(e)
    .map(r => s.get(e, r.id).value.name);

test('S1: a shared-library private import marks a clash with a local name, as JSON storage does', async t => {
  const f = await fixture(t, d => (d.drivers = [{ id: 'local', name: 'Ann', custom: {} }]));
  const s = f.open(),
    facade = { customFields: {} };
  for (const k of Object.keys(schema)) ((facade[k] = []), (facade.customFields[k] = []));
  Transfer.apply(
    { data: facade, saveNow() {} },
    { format: Transfer.FORMAT, fileVersion: 1, items: { drivers: [{ id: 'D9', name: 'Ann' }] } }
  );
  const command = { id: 'shared-import', type: 'importSharedPrepared', items: facade };
  s.command(command);
  assert.deepEqual(names(s, 'drivers'), ['Ann', 'Ann (imported)']);
  // A resumed import (a new command over the same journal) recognises the row it added.
  s.command({ ...command, id: 'shared-import-again' });
  assert.deepEqual(names(s, 'drivers'), ['Ann', 'Ann (imported)']);
});

test('S2: reference, history and Paddock car revisions survive unrelated writes and go stale on their own', async t => {
  const f = await fixture(t, d => {
    d.tracks = Array.from({ length: 3 }, (_, i) => ({ id: 't' + i, name: 'Track ' + i, custom: {} }));
    d.drivers = Array.from({ length: 3 }, (_, i) => ({ id: 'd' + i, name: 'Driver ' + i, custom: {} }));
  });
  const s = f.open();
  const page = s.referencePage('drivers', { limit: 1 }),
    history = s.historySession('racing', 'missing', {}),
    rev = page.revision;
  assert.ok(page.next);
  resume(s);
  assert.equal(s.referencePage('drivers', { cursor: page.next, limit: 1 }).items.length, 1);
  assert.equal(s.referenceDetails('tracks', ['t1'], rev)[0].name, 'Track 1');
  assert.doesNotThrow(() => s.paddockRead('cars', { revision: rev }));
  assert.equal(history, null);
  assert.doesNotThrow(() => s.historySession('racing', 'missing', { revision: rev }));
  s.command({
    id: id(),
    type: 'updateRecord',
    entity: 'tracks',
    recordId: 't1',
    patch: { name: 'Renamed' },
    expectedRevision: s.revision('tracks', 't1')
  });
  assert.throws(() => s.referenceDetails('tracks', ['t1'], rev), { code: 'CATALOGUE_CHANGED' });
  assert.doesNotThrow(() => s.referenceDetails('drivers', ['d1'], rev));
  s.command({
    id: id(),
    type: 'updateRecord',
    entity: 'drivers',
    recordId: 'd1',
    patch: { name: 'Renamed' },
    expectedRevision: s.revision('drivers', 'd1')
  });
  assert.throws(() => s.referencePage('drivers', { cursor: page.next, limit: 1 }), { code: 'CATALOGUE_CHANGED' });
});

test('S3: after a native restore an old revision is stale, even once the journal numbers come back', async t => {
  const f = await fixture(t);
  const s = f.open();
  for (let i = 0; i < 3; i++) s.command({ id: id(), type: 'addRecord', entity: 'drivers', item: { name: 'D' + i } });
  Bulk.snapshot(s, path.join(f.dir, 'snap'));
  for (let i = 0; i < 3; i++) s.command({ id: id(), type: 'addRecord', entity: 'drivers', item: { name: 'X' + i } });
  const live = Catalogue.revision(s);
  Bulk.restore(path.join(f.dir, 'snap'), path.join(f.dir, 'restored'));
  const r = f.open('restored');
  assert.equal(Catalogue.unchangedSince(r, ['tracks'], live), false);
  for (let i = 0; i < 3; i++) r.command({ id: id(), type: 'addRecord', entity: 'tracks', item: { name: 'Y' + i } });
  assert.notEqual(Catalogue.revision(r), live);
  assert.equal(Catalogue.unchangedSince(r, ['drivers'], live), false);
  // A cursor from beyond the journal is stale too.
  const now = Catalogue.revision(r);
  assert.equal(Catalogue.unchangedSince(r, ['drivers'], now.replace(/:\d+$/, ':' + (Number(now.split(':').pop()) + 5))), false);
});

test('S4: a request waiting behind another is timed from when the worker begins it', async t => {
  const client = new Client({ timeoutMs: 60000 });
  t.after(() => client.close().catch(() => {}));
  const first = client.get('drivers', 'a'),
    second = client.get('drivers', 'b');
  const jobs = [...client.pending.values()];
  assert.ok(jobs[0].timer, 'the request sent to an idle worker is timed at once');
  assert.equal(jobs[1].timer, null, 'the queued request is not timed while it waits');
  await assert.rejects(first, /No SQLite/);
  await assert.rejects(second, /No SQLite/);
  assert.equal(client.pending.size, 0);
  const timed = new Client({ timeoutMs: 1 });
  t.after(() => timed.close().catch(() => {}));
  await assert.rejects(timed.page('drivers'), /timed out/);
});

test('S5: Home orders tracks by their first lap of any kind, as JSON storage does', async t => {
  const f = await fixture(t, d => {
    d.tracks = [
      { id: 'a', name: 'A' },
      { id: 'b', name: 'B' }
    ];
    d.laps = [
      { id: 'l1', trackId: 'a', time: 5000, invalid: true },
      { id: 'l2', trackId: 'b', time: 5000 },
      { id: 'l3', trackId: 'a', time: 5000 }
    ];
  });
  const s = f.open();
  const o = { boards: [{ key: 'glance' }], driverIds: [], grid: [], trackId: '' };
  const result = s.transaction(() =>
    require('../sqlite-home').summary(s, o, { last: null, cars: new Map(), tracks: new Map(), now: Date.now() })
  );
  assert.deepEqual([...result.trackOrder.keys()], ['a', 'b']);
});

test('S6: a new record of a collection joins its collection root; the field lookup index exists', async t => {
  const f = await fixture(t);
  const s = f.open();
  s.transaction(() => {
    s.changed = new Map();
    s.replace('fuelrules', 'new-rule', { id: 'new-rule', name: 'Rule' });
  });
  const roots = s.statement('SELECT key,kind FROM roots').all();
  assert.ok(!roots.some(r => r.key === 'new-rule'));
  assert.ok(roots.some(r => r.key === 'fuelrules' && r.kind === 'collection'));
  const out = path.join(f.dir, 'export.json');
  s.exportLegacy(out, {});
  assert.deepEqual(
    JSON.parse(fs.readFileSync(out, 'utf8')).data.fuelrules.map(r => r.id),
    ['new-rule']
  );
  assert.ok(s.statement("SELECT 1 FROM sqlite_master WHERE type='index' AND name='field_path'").get());
});
