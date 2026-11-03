'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const Database = require('../db');
const Repository = require('../data-repository');
const ResourceStore = require('../resource-store');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-repository-'));
  const db = new Database(path.join(dir, 'database.json'));
  t.after(async () => {
    await db.writesIdle();
    // This exact directory was created above, never derived from application data.
    fs.rmSync(dir, { recursive: true, force: true });
  });
  db.bg = true;
  const resources = new ResourceStore(db);
  return { db, records: new Repository(db, { getResourceStore: () => resources }) };
}
function handlers(records, paddock = null) {
  const source = fs.readFileSync(path.join(__dirname, '../main.js'), 'utf8');
  const lines = source.split('\n').filter(line => /^\s*ipcMain.handle\('(db:(list|get|add|update|remove|linked)|session:(save|remove)|custom:(list|add|remove|group))'/.test(line));
  const registered = new Map();
  vm.runInNewContext(lines.join('\n'), { records, paddock, watch: { sent() {} }, ipcMain: { handle: (name, fn) => registered.set(name, fn) } });
  assert.equal(registered.size, 12);
  return (name, ...args) => registered.get(name)(null, ...args);
}

test('actual IPC handlers preserve CRUD, custom fields, unknown properties and save/reopen', async t => {
  const { db, records } = fixture(t), call = handlers(records);
  const field = await call('custom:add', 'drivers', { label: 'Club', type: 'text', group: 'personal' });
  const row = await call('db:add', 'drivers', { name: 'James', custom: { [field.id]: 'SlotForge' }, future: { nested: [1, null, ''] } });
  await call('db:update', 'drivers', row.id, { name: 'Joanne' });
  await call('custom:group', 'drivers', field.id, 'avatar');
  const reopened = new Database(db.file);
  assert.equal(reopened.list('drivers')[0].name, 'Joanne');
  assert.deepEqual(reopened.list('drivers')[0].future, { nested: [1, null, ''] });
  assert.equal(reopened.listCustomFields('drivers')[0].group, 'avatar');
  assert.deepEqual(await call('db:list', 'drivers'), reopened.list('drivers'));
  assert.equal(call('db:linked', 'drivers', row.id), 0);
  assert.equal(call('custom:list', 'drivers')[0].id, field.id);
  const detached = call('db:get', 'drivers', row.id);
  detached.future.nested.push('changed');
  assert.equal(records.get('drivers', row.id).future.nested.length, 3);
  assert.equal(call('db:get', 'drivers', 'missing'), null);
  await call('custom:remove', 'drivers', field.id);
  assert.deepEqual(new Database(db.file).list('drivers')[0].custom, {});
  await call('db:remove', 'drivers', row.id);
  assert.deepEqual(new Database(db.file).list('drivers'), []);
});

test('every mutation acknowledgement waits for its persistence and propagates rejection', async () => {
  const cases = [
    ['db:add', 'add', ['drivers', {}]], ['db:update', 'update', ['drivers', 'd', {}]],
    ['db:remove', 'remove', ['drivers', 'd']], ['session:remove', 'removeSession', ['s']],
    ['custom:add', 'addCustomField', ['drivers', {}]], ['custom:remove', 'removeCustomField', ['drivers', 'f']],
    ['custom:group', 'setCustomFieldGroup', ['drivers', 'f', 'personal']]
  ];
  for (const [channel, method, args] of cases) for (const fail of [false, true]) {
    let release, reject;
    const disk = new Promise((resolve, no) => { release = resolve; reject = no; });
    const repo = new Repository({ [method]: () => ({ id: 'result' }), saved: () => disk });
    const promise = handlers(repo)(channel, ...args);
    let settled = false;
    promise.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false, channel);
    if (fail) { reject(new Error('disk full')); await assert.rejects(promise, /disk full/); }
    else { release(); await promise; }
  }
});

test('linked-car edits retain Paddock ownership without cloning photos or captures', async t => {
  const { db, records } = fixture(t);
  const row = await records.add('slotcars', { model: 'Original', paddock: { databaseId: 'host', carId: 'a' } });
  // Guard against accidental whole-car cloning in the ownership check.
  Object.defineProperty(row, 'picture', { get() { throw Error('photo was accessed'); }, configurable: true });
  const saved = db.saved, update = db.update;
  let received;
  db.update = (_entity, _id, patch) => { received = patch; return row; };
  db.saved = async () => true;
  const patch = { model: 'Attempt', paddock: null, lapsSinceService: 12 };
  await records.update('slotcars', row.id, patch);
  assert.equal(received.model, undefined);
  assert.equal(received.paddock, undefined);
  assert.equal(received.lapsSinceService, 12);
  assert.equal(patch.model, 'Attempt');
  const local = records.localCars();
  assert.deepEqual(local[0].paddock, { databaseId: 'host', carId: 'a' });
  assert.equal(Object.hasOwn(local[0], 'picture'), false);
  local[0].paddock.carId = 'mutated';
  assert.equal(row.paddock.carId, 'a');
  delete row.picture; db.update = update; db.saved = saved;
  const ordinary = await records.add('slotcars', { model: 'Local' });
  await records.update('slotcars', ordinary.id, { model: 'Changed', paddock: { carId: 'forged' } });
  assert.equal(records.get('slotcars', ordinary.id).model, 'Changed');
  assert.equal(records.get('slotcars', ordinary.id).paddock, undefined);
});

test('targeted reads reject inherited table names and do not read unrelated records', async t => {
  const { db, records } = fixture(t);
  const first = await records.add('drivers', { name: 'First' });
  db.data.drivers.push({ id: 'unrelated', get picture() { throw Error('unrelated media'); } });
  assert.equal(records.get('drivers', first.id).name, 'First');
  db.data.drivers.pop();
  for (const entity of ['__proto__', 'constructor', 'toString', 'missing']) {
    assert.throws(() => records.get(entity, first.id), /Unknown item type/);
    assert.throws(() => records.list(entity), /Unknown item type/);
  }
});

test('resource finalization uses the existing deduplication queue, including IPC', async t => {
  const { db, records } = fixture(t), call = handlers(records);
  const session = { name: 'Resource race', resourceRunId: 'run-1', date: '2026-11-03', standings: [] };
  const ids = await Promise.all([call('session:save', session, []), call('session:save', session, [])]);
  assert.equal(ids[0], ids[1]);
  assert.equal(new Database(db.file).list('sessions').length, 1);
  await assert.rejects(new Repository(db).saveSession(session, []), /not ready/);
});

test('failed finalization leaves no session or laps and restores car counters', async t => {
  const { db, records } = fixture(t), call = handlers(records);
  const car = await records.add('slotcars', { model: 'Car', lapsDriven: 3, lapsSinceService: 2 });
  const save = db.commit;
  db.commit = () => { throw Error('disk full'); };
  await assert.rejects(call('session:save', { date: '2026-11-03' }, [{ carId: car.id, time: 5000 }]), /disk full/);
  db.commit = save;
  assert.equal(db.list('sessions').length, 0);
  assert.equal(db.list('laps').length, 0);
  assert.equal(car.lapsDriven, 3);
  assert.equal(car.lapsSinceService, 2);
});

test('Paddock delivery, correction, withdrawal and source identity survive the new boundary', async t => {
  const { db, records } = fixture(t), call = handlers(records);
  const profile = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/paddock/fixtures/profile-car-a.json'), 'utf8'));
  const car = await records.add('slotcars', { model: 'Car' });
  const laps = [{ carId: car.id, driverId: 'd', lane: 1, lapNumber: 1, time: 10000 }];
  const session = { date: '2026-11-03', setupName: 'Race', sessionType: 'race', trackId: 'track', trackName: 'Club',
    standings: [{ carId: car.id, pos: 1, laps: 1, total: 10000 }], paddockJournal: {
      captures: { [car.id]: { name: profile.car.name, configuration: profile.configuration } }, lanes: [20, 21],
      heats: [{ id: '1', name: 'Heat 1', startedAt: 100000, endedAt: 130000, entries: [{ carId: car.id,
        driverId: 'd', driverName: 'Driver', lane: 1, laps: [{ number: 1, time: 10000, at: 110000, driverId: 'd', driverName: 'Driver', valid: true, pit: false }] }] }]
    } };
  const id = await call('session:save', session, laps);
  let stored = new Database(db.file);
  const source = stored.data.paddock.sourceId;
  assert.equal(stored.list('sessions')[0].paddockDelivery.status, 'pending');
  assert.deepEqual(stored.list('sessions')[0].paddockJournal.captures, session.paddockJournal.captures);
  await call('db:update', 'laps', db.list('laps')[0].id, { noTrackRecord: true });
  stored = new Database(db.file);
  const delivery = stored.list('sessions')[0].paddockDelivery;
  assert.equal(delivery.payload.revision, 2);
  assert.equal(delivery.payload.participants[0].laps[0].recordEligible, false);
  await call('session:remove', id);
  stored = new Database(db.file);
  assert.equal(stored.data.paddock.sourceId, source);
  assert.equal(stored.list('slotcars')[0].lapsDriven, 0);
  assert.equal(stored.data.paddock.withdrawals[0].payload.revision, 3);
  assert.equal(stored.data.paddock.withdrawals[0].payload.state, 'withdrawn');
});

test('cascade deletion and opaque widget/layout definitions remain intact', async t => {
  const { db, records } = fixture(t);
  const system = await records.add('fuelrules', { name: 'Fuel' });
  const setup = await records.add('racesetups', { name: 'Race', fuelRules: system.id, sessionType: 'race' });
  const content = { widgets: [{ id: 'w', custom: { future: true }, style: { gradient: [1, 2, 3] } }] };
  const layout = await records.add('layouts', { name: 'Saved layout', ...content });
  await records.remove('fuelrules', system.id);
  assert.equal(records.get('racesetups', setup.id).fuelRules, '');
  const reopened = new Database(db.file);
  assert.deepEqual(reopened.getRecord('layouts', layout.id).widgets, content.widgets);
});

test('session delivery is scheduled only after successful durable finalization',async t=>{
 const {records}=fixture(t);let release,scheduled=0;
 const pending=new Promise(r=>release=r);records.saveSession=()=>pending;
 const call=handlers(records,{schedule:delay=>{assert.equal(delay,0);scheduled++;}});
 const save=call('session:save',{},[]);assert.equal(scheduled,0);release('saved-id');assert.equal(await save,'saved-id');assert.equal(scheduled,1);
 records.saveSession=async()=>{throw Error('Disk full');};await assert.rejects(call('session:save',{},[]),/Disk full/);assert.equal(scheduled,1);
});
