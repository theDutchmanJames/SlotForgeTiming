'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { SqliteStore, hash } = require('../sqlite-store');
const { migrateCopy, openCopy } = require('../sqlite-migration');
const { WorkingStore, forkCopy } = require('../sqlite-working');
const Client = require('../sqlite-client');
const Database = require('../db');
const PaddockRecords = require('../paddockrecords');
const image = 'data:image/png;base64,YWJjZA==';
function data() {
  return { version: 1, drivers: [{ id: 'd', name: 'Driver', picture: image, custom: { club: 'A', team: 'X' } }],
    tracks: [{ id: 't', name: 'Track' }],
    slotcars: [{ id: 'c', model: 'Car', picture: image, gallery: [{ src: image }], lapsDriven: 5, lapsSinceService: 2, serviceDate: '2026-10-30' }],
    sessions: [], laps: [],
    customFields: { drivers: [{ id: 'club', type: 'text' }, { id: 'team', type: 'text' }], slotcars: [{ id: 'club', type: 'text' }] },
    paddock: { sourceId: 'stable-source', connection: { databaseId: 'paddock-demo' }, withdrawals: [] } };
}
function fixture(t, sourceData = data()) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-sqlite-working-'));
  const clients = [], stores = [];
  t.after(async () => {
    for (const c of clients) await c.close().catch(() => {});
    for (const s of stores) s.close();
    fs.rmSync(dir, { recursive: true, force: true }); // Only this test's exact mkdtemp directory.
  });
  const source = path.join(dir, 'source.json'), copy = path.join(dir, 'copy'), work = path.join(dir, 'work');
  fs.writeFileSync(source, JSON.stringify(sourceData)); migrateCopy({ source, destination: copy }); forkCopy(copy, work);
  return { dir, source, copy, work, sourceData,
    store(options) { const s = new WorkingStore(work, options); stores.push(s); return s; },
    client() { const c = new Client(); clients.push(c); return c; } };
}
function finalize(id = 'save', extra = {}) {
  return { id, type: 'finalizeSession', session: { date: '2026-11-03', setupName: 'Race', sessionType: 'race', standings: [] },
    laps: [{ carId: 'c', driverId: 'd', trackId: 't', time: 10000, valid: true, lane: 1, lapNumber: 1 },
      { carId: 'c', time: 11000, pit: true, date: '2026-10-29' }, { carId: 'guest', time: 12000, invalid: true }], ...extra };
}
function custom(id, fieldId, value, expectedVersion = 0) { return { id, type: 'setCustomValue', entity: 'drivers', recordId: 'd', fieldId, value, expectedVersion }; }
function paddockSession() {
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/paddock/fixtures/profile-car-a.json')));
  return { date: '2026-11-03', setupName: 'Linked race', sessionType: 'race', trackId: 't', trackName: 'Club',
    standings: [{ carId: 'c', pos: 1, laps: 1, total: 10000 }],
    paddockJournal: { captures: { c: { name: profile.car.name, configuration: profile.configuration } }, lanes: [20],
      heats: [{ id: '1', name: 'Heat 1', startedAt: 100000, endedAt: 120000,
        entries: [{ carId: 'c', driverId: 'd', driverName: 'Driver', lane: 1,
          laps: [{ number: 1, time: 10000, at: 110000, driverId: 'd', valid: true, pit: false }] }] }] } };
}

test('working writes leave source and verified recovery bundle unchanged', t => {
  const f = fixture(t), s = f.store(), before = hash(fs.readFileSync(path.join(f.copy, 'timing.sqlite')));
  s.command(custom('edit', 'club', 'B')); s.command(finalize()); s.close();
  assert.equal(hash(fs.readFileSync(path.join(f.copy, 'timing.sqlite'))), before);
  const copy = openCopy(f.copy); try { copy.verify(f.sourceData); } finally { copy.close(); }
  assert.deepEqual(JSON.parse(fs.readFileSync(f.source)), f.sourceData);
  const reopened = f.store(); assert.equal(reopened.field('drivers', 'd', ['custom', 'club']).value, 'B');
  assert.throws(() => forkCopy(f.copy, f.work), /EEXIST/);
  assert.throws(() => new SqliteStore(path.join(f.copy, 'timing.sqlite'), { writable: true }), /working database/);
});

test('finalization and removal preserve JSON session, lap and service-counter behaviour', async t => {
  const f = fixture(t), sql = f.store(), legacy = new Database(path.join(f.dir, 'legacy.json'));
  legacy.replaceAll(f.sourceData);
  const command = finalize(), result = sql.command(command), legacyId = await legacy.saveSessionAsync(command.session, command.laps);
  const actual = sql.get('sessions', result.sessionId, true).value;
  assert.deepEqual({ ...actual, id: legacyId }, legacy.getRecord('sessions', legacyId));
  const laps = sql.sessionLaps(result.sessionId).map(r => sql.get('laps', r.id, true).value);
  assert.deepEqual(laps.map(({ id, sessionId, ...rest }) => rest), legacy.list('laps').map(({ id, sessionId, ...rest }) => rest));
  for (const key of ['lapsDriven', 'lapsSinceService']) assert.equal(sql.field('slotcars', 'c', [key]).value, legacy.getRecord('slotcars', 'c')[key]);
  assert.equal(sql.asset('slotcars', 'c', ['picture']).digest, hash(Buffer.from('abcd')));
  sql.command({ id: 'delete', type: 'deleteSession', sessionId: result.sessionId, expectedRevision: 1 });
  legacy.removeSession(legacyId); await legacy.saved();
  for (const key of ['lapsDriven', 'lapsSinceService']) assert.equal(sql.field('slotcars', 'c', [key]).value, legacy.getRecord('slotcars', 'c')[key]);
  assert.equal(sql.get('sessions', result.sessionId), null); assert.equal(sql.sessionLaps(result.sessionId).length, 0);
  await legacy.writesIdle();
});

test('receipt survives close/reopen and lost acknowledgement; changed retry is refused', t => {
  const f = fixture(t), s = f.store(), command = finalize(), result = s.command(command); s.close();
  const reopened = f.store(); assert.deepEqual(reopened.receipt(command.id), result);
  assert.deepEqual(reopened.command(command), result); assert.equal(reopened.page('sessions').length, 1);
  assert.equal(reopened.field('slotcars', 'c', ['lapsDriven']).value, 7);
  assert.throws(() => reopened.command({ ...command, laps: [] }), /different content/);
  assert.equal(reopened.changes().length, 1);
});

for (const stage of ['session-written', 'laps-written', 'counters-written', 'domain-written', 'before-commit']) {
  test(`failure at ${stage} rolls back session, laps, counters, delivery, receipt and journal`, t => {
    const f = fixture(t), s = f.store({ checkpoint: at => { if (at === stage) throw Error('injected disk failure'); } });
    assert.throws(() => s.command(finalize('failure', { session: paddockSession() })), /injected/);
    assert.equal(s.page('sessions').length, 0); assert.equal(s.page('laps').length, 0);
    assert.equal(s.field('slotcars', 'c', ['lapsDriven']).value, 5);
    assert.equal(s.revision('slotcars', 'c'), 0); assert.equal(s.receipt('failure'), null); assert.equal(s.changes().length, 0);
    s.checkpoint = () => {}; assert.ok(s.command(finalize('failure', { session: paddockSession() })).sessionId);
  });
}

test('independent custom fields succeed, stale and changed-away-and-back writes conflict', t => {
  const f = fixture(t), s = f.store();
  assert.equal(s.command(custom('a', 'club', 'B')).version, 1);
  assert.equal(s.command(custom('b', 'team', 'Y')).version, 1);
  s.command(custom('c', 'club', 'A', 1));
  assert.throws(() => s.command(custom('d', 'club', 'C', 0)), /version conflict/);
  assert.equal(s.field('drivers', 'd', ['custom', 'club']).value, 'A');
  assert.equal(s.asset('drivers', 'd', ['picture']).digest, hash(Buffer.from('abcd')));
  assert.equal(s.receipt('d'), null); assert.equal(s.revision('drivers', 'd'), 3);
  const before = s.db.prepare('SELECT total_changes() AS n').get().n;
  assert.equal(s.get('slotcars', 'c', true).value.picture, image);
  assert.equal(s.db.prepare('SELECT total_changes() AS n').get().n, before);
});

test('custom edits retain local ownership on linked cars and reject missing definitions and object paths', t => {
  const source = data(); source.slotcars[0].paddock = { carId: 'remote' };
  const s = fixture(t, source).store();
  s.command({ ...custom('a', 'club', 'B'), entity: 'slotcars', recordId: 'c' });
  assert.equal(s.field('slotcars','c',['custom','club']).value,'B');
  assert.equal(s.field('slotcars','c',['paddock','carId']).value,'remote');
  assert.throws(() => s.command(custom('b', 'unknown', 'B')), /Unknown custom/);
  assert.throws(() => s.command(custom('c', 'club', {})), /scalar/);
  assert.throws(() => s.command({ ...custom('d', 'club', 'B'), entity: 'laps' }), /Unsupported/);
});

test('Paddock correction and withdrawal match existing builder, preserving frozen signatures', t => {
  const f = fixture(t), s = f.store(), cmd = finalize('linked', { session: paddockSession(), laps: [finalize().laps[0]] });
  const { sessionId } = s.command(cmd), saved = s.get('sessions', sessionId, true).value;
  const expected = { ...cmd.session, id: sessionId }, state = { paddock: structuredClone(f.sourceData.paddock) };
  PaddockRecords.prepare(state, expected, cmd.laps);
  assert.deepEqual(saved, expected); assert.equal(saved.paddockDelivery.status, 'pending');
  const lapId = s.sessionLaps(sessionId)[0].id;
  const correction = { id: 'exclude', type: 'setRecordEligibility', sessionId, expectedRevision: 1, edits: [{ lapId, flags: { noTrackRecord: true } }] };
  s.command(correction);
  state.laps = [{ ...cmd.laps[0], id: lapId, sessionId, noTrackRecord: true }]; PaddockRecords.revise(state, expected);
  assert.deepEqual(s.get('sessions', sessionId, true).value, expected);
  assert.equal(expected.paddockDelivery.payload.revision, 2);
  assert.equal(s.get('laps', lapId).value.time, 10000);
  assert.throws(() => s.command({ ...correction, id: 'stale' }), /version conflict/);
  assert.throws(() => s.command({ ...correction, id: 'duration', expectedRevision: 2, edits: [{ lapId, flags: { time: 1 } }] }), /eligibility flags/);
  s.command({ id: 'withdraw', type: 'deleteSession', sessionId, expectedRevision: 2 });
  PaddockRecords.withdraw(state, expected, 'Session deleted in Timing.');
  assert.deepEqual(s.get('@meta', 'paddock', true).value, state.paddock);
  assert.equal(state.paddock.withdrawals[0].payload.revision, 3);
});

test('resource runs deduplicate across different command IDs and retain deletion tombstone', t => {
  const s = fixture(t).store(), command = finalize(); command.session.resourceRunId = 'run';
  const result = s.command(command);
  assert.deepEqual(s.command({ ...command, id: 'retry' }), result);
  assert.throws(() => s.command({ ...command, id: 'mismatch', laps: [] }), /different content/);
  s.command({ id: 'remove', type: 'deleteSession', sessionId: result.sessionId, expectedRevision: 1 });
  assert.throws(() => s.command({ ...command, id: 'late' }), /session deleted/);
  assert.equal(s.field('slotcars', 'c', ['lapsDriven']).value, 5);
});

test('imported finalized resource run is recognized without generating a duplicate', t => {
  const source = data(); source.sessions = [{ id: 'old', resourceRunId: 'run' }];
  const s = fixture(t, source).store(), command = finalize(); command.session.resourceRunId = 'run';
  assert.equal(s.command(command).sessionId, 'old'); assert.equal(s.page('sessions').length, 1);
});

test('monotonic ordinals survive deleting the last record', t => {
  const s = fixture(t).store(), one = s.command(finalize());
  const cursor = s.page('sessions')[0].ordinal;
  s.command({ id: 'remove', type: 'deleteSession', sessionId: one.sessionId, expectedRevision: 1 });
  const two = s.command(finalize('two'));
  assert.equal(s.page('sessions', cursor)[0].id, two.sessionId);
});

test('worker serializes concurrent commands and only exposes writes on working forks', async t => {
  const f = fixture(t), c = f.client(); await c.openWorking(f.work);
  const results = await Promise.allSettled([c.command(custom('a', 'club', 'B')), c.command(custom('b', 'club', 'C'))]);
  assert.equal(results[0].status, 'fulfilled'); assert.equal(results[1].status, 'rejected');
  assert.equal(await c.fieldVersion('drivers', 'd', ['custom', 'club']), 1);
  assert.equal((await c.changes()).length, 1); await c.close();
  const readOnly = f.client(); await readOnly.open(f.copy);
  await assert.rejects(readOnly.command(finalize()), /Unsupported/);
  await assert.rejects(readOnly.request('exec', 'DELETE FROM records'), /Unsupported/);
});

test('malformed and nonfinite commands fail without writes', t => {
  const s = fixture(t).store();
  for (const input of [null, {}, { id: 'unknown', type: 'exec' }, custom('nan', 'club', NaN), custom('undefined', 'club', undefined), finalize('bad', { laps: [null] })]) assert.throws(() => s.command(input));
  assert.equal(s.changes().length, 0);
});

test('future working formats are rejected without modifying file bytes', t => {
  const f = fixture(t), file = path.join(f.work, 'working.sqlite'), db = new DatabaseSync(file);
  db.exec("UPDATE info SET value='99' WHERE key='workingFormat'"); db.close();
  const before = hash(fs.readFileSync(file)); assert.throws(() => f.store(), /supported/);
  assert.equal(hash(fs.readFileSync(file)), before);
});

function resourceSnapshot() {
  const R = require('../renderer/resources');
  const state = R.prepare({ id: 'profile', owner: 'car', scope: 'event', tyres: { M: 3 } }, { runId: 'run' });
  R.spend(state, { carId: 'c', carName: 'Car' }, 0, { 'tyre:M': 1 }, 'Starting tyre set');
  return { v: 1, race: { resources: state }, eng: { v: 1 }, phase: 'paused' };
}

test('resource checkpoint agrees with JSON backend, rejects tampering and closes atomically with finalization', async t => {
  const f = fixture(t), s = f.store(), snapshot = resourceSnapshot();
  const ResourceStore = require('../resource-store'), legacy = new Database(path.join(f.dir, 'resource.json'));
  legacy.replaceAll(f.sourceData); const resources = new ResourceStore(legacy);
  await resources.save(snapshot);
  s.command({ id: 'checkpoint', type: 'resourceCheckpoint', snapshot, expectedRevision: 0 });
  const withoutDates = ledger => ({ ...ledger, history: ledger.history.map(({ date, ...e }) => e) });
  assert.deepEqual(withoutDates(s.ledger()), withoutDates(await resources.read()));
  const altered = structuredClone(snapshot); altered.race.resources.events[0].reason = 'Changed';
  assert.throws(() => s.command({ id: 'tamper', type: 'resourceCheckpoint', snapshot: altered, expectedRevision: 1 }), /cannot be changed/);
  await assert.rejects(resources.save(altered), /cannot be changed/);
  assert.throws(() => s.command({ id: 'stale', type: 'resourceCheckpoint', snapshot, expectedRevision: 0 }), /version conflict/);
  const cmd = finalize(); cmd.session.resourceRunId = 'run'; cmd.expectedResourceRevision = 1;
  const result = s.command(cmd);
  assert.equal(s.ledger().checkpoint, null); assert.equal(s.ledger().runs.run.closed, true);
  assert.equal(s.ledger().history.length, 1);
  assert.throws(() => s.command({ id: 'late', type: 'resourceCheckpoint', snapshot, expectedRevision: 2 }), /finalized/);
  s.command({ id: 'delete', type: 'deleteSession', sessionId: result.sessionId, expectedRevision: 1 });
  assert.equal(s.ledger().history.length, 1, 'Deleting results never refunds consumed stock');
  await legacy.writesIdle();
});

test('final checkpoint, ledger closure and results all roll back together', t => {
  const f = fixture(t), snapshot = resourceSnapshot(), s = f.store({ checkpoint: stage => { if (stage === 'before-commit') throw Error('disk failure'); } });
  const command = finalize(); command.session.resourceRunId = 'run'; command.resourceCheckpoint = snapshot; command.expectedResourceRevision = 0;
  assert.throws(() => s.command(command), /disk failure/);
  assert.equal(s.get('@meta', 'resourceLedger'), null); assert.equal(s.receipt(command.id), null); assert.equal(s.page('sessions').length, 0);
  s.checkpoint = () => {}; s.command(command);
  assert.equal(s.ledger().runs.run.closed, true); assert.equal(s.ledger().history.length, 1);
  assert.equal(s.ledger().checkpoint, null);
});

test('resource clear checks run identity and version, preserving stock after reopen', t => {
  const f = fixture(t), s = f.store();
  s.command({ id: 'checkpoint', type: 'resourceCheckpoint', snapshot: resourceSnapshot(), expectedRevision: 0 });
  assert.throws(() => s.command({ id: 'bad-clear', type: 'resourceClear', runId: 'other', expectedRevision: 1 }), /another run/);
  s.command({ id: 'clear', type: 'resourceClear', runId: 'run', expectedRevision: 1 }); s.close();
  const reopened = f.store(); assert.equal(reopened.ledger().checkpoint, null); assert.equal(reopened.ledger().history.length, 1);
  assert.equal(reopened.ledger().runs.run.closed, true);
});

test('database full rolls back data, receipts and change journal', t => {
  const s = fixture(t).store(), pages = s.db.prepare('PRAGMA page_count').get().page_count;
  s.db.exec(`PRAGMA max_page_count=${pages}`);
  const cmd = custom('full', 'club', 'x'.repeat(10000));
  assert.throws(() => s.command(cmd), /full/);
  assert.equal(s.receipt('full'), null); assert.equal(s.fieldVersion('drivers', 'd', ['custom', 'club']), 0);
  assert.equal(s.field('drivers', 'd', ['custom', 'club']).value, 'A'); assert.equal(s.changes().length, 0);
});

test('Paddock result writes do not load or rewrite catalogue cache and photo data', t => {
  const source = data(); source.paddock.catalogue = { cars: [{ id: 'remote', picture: image }] };
  const s = fixture(t, source).store();
  const get = s.get.bind(s); s.get = (entity, id, media) => {
    assert.ok(!(entity === '@meta' && id === 'paddock'), 'No full Paddock state reads');
    assert.ok(!(entity === 'slotcars'), 'No full car reads for counters');
    return get(entity, id, media);
  };
  s.db.exec(`CREATE TEMP TRIGGER protect_catalogue BEFORE UPDATE ON fields WHEN OLD.entity='@meta' AND OLD.id='paddock' AND OLD.path='["catalogue","cars"]' BEGIN SELECT RAISE(ABORT,'catalogue rewritten'); END;
    CREATE TEMP TRIGGER protect_assets BEFORE DELETE ON assets BEGIN SELECT RAISE(ABORT,'asset deleted'); END;`);
  const { sessionId } = s.command(finalize('paddock', { session: paddockSession() }));
  s.command({ id: 'delete', type: 'deleteSession', sessionId, expectedRevision: 1 });
  assert.deepEqual(get('@meta', 'paddock', true).value.catalogue, source.paddock.catalogue);
});

test('working forks refuse duplicate imported resource-run identities', t => {
  const f = fixture(t), altered = path.join(f.dir, 'duplicates.json'), copy = path.join(f.dir, 'duplicates');
  const source = data(); source.sessions = [{ id: 'a', resourceRunId: 'same' }, { id: 'b', resourceRunId: 'same' }];
  fs.writeFileSync(altered, JSON.stringify(source)); migrateCopy({ source: altered, destination: copy });
  const destination = path.join(f.dir, 'refused'); assert.throws(() => forkCopy(copy, destination), /UNIQUE/);
  assert.equal(fs.existsSync(path.join(destination, 'working.sqlite')), false);
  const immutable = openCopy(copy); try { immutable.verify(source); } finally { immutable.close(); }
});

test('unknown metadata, original media and signatures survive correction and failure', t => {
  const source = data(); source.unknown = { nested: { __data: ['unchanged'] } };
  const s = fixture(t, source).store(), command = finalize('paddock', { session: paddockSession() });
  const { sessionId } = s.command(command), before = s.get('sessions', sessionId, true).value;
  s.checkpoint = stage => { if (stage === 'before-commit') throw Error('fail'); };
  assert.throws(() => s.command({ id: 'delete', type: 'deleteSession', sessionId, expectedRevision: 1 }), /fail/);
  assert.deepEqual(s.get('sessions', sessionId, true).value, before);
  assert.deepEqual(s.get('@meta', 'unknown').value, source.unknown);
  assert.equal(s.get('@meta', 'paddock').value.withdrawals.length, 0);
});

test('legacy service-counter fallback follows saved lap order when removing history', async t => {
  const source = data(); delete source.slotcars[0].lapsSinceService;
  source.sessions = [{ id: 'old', date: '2026-11-03' }];
  source.laps = [ { id: 'z', sessionId: 'old', carId: 'c', date: '2026-10-29', time: 10000 },
    { id: 'a', sessionId: 'old', carId: 'c', date: '2026-11-03', time: 11000 } ];
  const f = fixture(t, source), s = f.store(), legacy = new Database(path.join(f.dir, 'legacy-order.json'));
  legacy.replaceAll(source);
  // Database.ensure backfills missing counters; remove that value to exercise the actual legacy fallback.
  delete legacy.data.slotcars[0].lapsSinceService;
  legacy.removeSession('old'); await legacy.saved();
  s.command({ id: 'delete', type: 'deleteSession', sessionId: 'old', expectedRevision: 0 });
  for (const key of ['lapsDriven', 'lapsSinceService']) assert.equal(s.field('slotcars', 'c', [key]).value, legacy.data.slotcars[0][key]);
  await legacy.writesIdle();
});

test('terminating a writer inside a transaction recovers all-or-nothing on reopen', async t => {
  const { Worker } = require('node:worker_threads'), { once } = require('node:events');
  const f = fixture(t), command = finalize('interrupted', { session: paddockSession() });
  const worker = new Worker(`
    const { parentPort, workerData } = require('node:worker_threads');
    const { WorkingStore } = require(workerData.module);
    const store = new WorkingStore(workerData.work, { checkpoint(stage) {
      if (stage === 'before-commit') { parentPort.postMessage('uncommitted'); Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0); }
    } });
    store.command(workerData.command);
  `, { eval: true, workerData: { module: path.resolve(__dirname, '../sqlite-working.js'), work: f.work, command } });
  try { await once(worker, 'message', { signal: AbortSignal.timeout(10000) }); }
  finally { await worker.terminate(); }
  const s = f.store();
  assert.equal(s.receipt(command.id), null); assert.equal(s.changes().length, 0);
  assert.equal(s.page('sessions').length, 0); assert.equal(s.page('laps').length, 0);
  assert.equal(s.field('slotcars', 'c', ['lapsDriven']).value, 5);
  const result = s.command(command); assert.ok(result.sessionId);
  assert.deepEqual(s.command(command), result);
});

test('separate worker connections cannot both commit the same field version', async t => {
  const f = fixture(t), a = f.client(), b = f.client();
  await a.openWorking(f.work); await b.openWorking(f.work);
  const results = await Promise.allSettled([a.command(custom('a', 'club', 'B')), b.command(custom('b', 'club', 'C'))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.filter(r => r.status === 'rejected' && /version conflict/.test(r.reason.message)).length, 1);
  assert.equal((await a.changes()).length, 1);
});

test('custom values validate their definition and preserve missing, empty and null distinctions', t => {
  const source = data(); source.customFields.drivers.push({ id: 'number', type: 'number' }, { id: 'date', type: 'date' }, { id: 'list', type: 'list', options: ['GT3'] });
  const s = fixture(t, source).store();
  assert.equal(s.field('drivers', 'd', ['custom', 'number']).present, false);
  s.command(custom('null', 'number', null));
  assert.deepEqual(s.field('drivers', 'd', ['custom', 'number']), { present: true, value: null });
  s.command(custom('empty', 'number', '', 1));
  assert.equal(s.field('drivers', 'd', ['custom', 'number']).value, '');
  s.command(custom('number', 'number', 42, 2));
  assert.throws(() => s.command(custom('bad-number', 'number', '42', 3)), /field type/);
  assert.throws(() => s.command(custom('bad-date', 'date', '2026-02-31')), /custom date/);
  assert.throws(() => s.command(custom('bad-list', 'list', 'GT4')), /available choice/);
  s.command(custom('date', 'date', '2026-11-03')); s.command(custom('list', 'list', 'GT3'));
});

test('checkpoint transition does not retain mutable references to caller snapshots', () => {
  const { applyCheckpoint } = require('../resource-checkpoint'), snapshot = resourceSnapshot();
  const next = applyCheckpoint({ v: 1, accounts: {}, runs: {}, history: [], checkpoint: null }, snapshot);
  snapshot.race.resources.events[0].delta['tyre:M'] = -99;
  assert.equal(next.history[0].delta['tyre:M'], -1);
  assert.equal(next.checkpoint.race.resources.events[0].delta['tyre:M'], -1);
});

test('large finalizations have bounded journal entries with explicit refresh semantics', t => {
  const s = fixture(t).store();
  s.command(finalize('many', { laps: Array.from({ length: 300 }, (_, i) => ({ carId: 'c', time: 10000, lapNumber: i + 1 })) }));
  const change = s.changes()[0].changed;
  assert.equal(change.records.length, 128); assert.equal(change.counts.laps, 300);
  assert.equal(change.requiresRefresh, true); assert.equal(change.counts.slotcars, 1);
});

test('malformed imported resource state cannot close inherited keys or future ledger formats', t => {
  const source = data(); source.resourceLedger = { v: 1, accounts: {}, runs: {}, history: [], checkpoint: { race: { resources: { runId: 'constructor' } } } };
  const s = fixture(t, source).store();
  assert.throws(() => s.command({ id: 'clear', type: 'resourceClear', runId: 'constructor', expectedRevision: 0 }), /resource run state/);
  assert.equal(Object.closed, undefined); assert.equal(s.receipt('clear'), null);
  const { applyCheckpoint } = require('../resource-checkpoint');
  assert.throws(() => applyCheckpoint({ ...source.resourceLedger, v: 2 }, resourceSnapshot()), /unsupported resource ledger/);
});
