'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const { SqliteStore, hash } = require('../sqlite-store');
const { migrateCopy, openCopy } = require('../sqlite-migration');
const Client = require('../sqlite-client');
const Database = require('../db');
function setup(t, data) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-sqlite-copy-'));
  const clients = [];
  t.after(async () => { for (const client of clients) await client.close().catch(() => {}); fs.rmSync(dir, { recursive: true, force: true }); });
  const source = path.join(dir, 'copy.json'), destination = path.join(dir, 'converted');
  fs.writeFileSync(source, JSON.stringify(data));
  return { dir, source, destination, client(options) { const c = new Client(options); clients.push(c); return c; } };
}
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jBkcAAAAASUVORK5CYII=';
function sample() {
  return JSON.parse(JSON.stringify({ version: 1, settings: { theme: 'dark' },
    drivers: [{ id: 'd', name: 'James', picture: image, custom: { club: 'SlotForge', empty: '', nil: null } }],
    slotcars: [{ id: 'c', model: 'Car', picture: image, custom: { chassis: 'Carbon' }, lapsDriven: 2, paddock: { configuration: { signature: 'exact', nested: ['a', null] } } }],
    tracks: [{ id: 't', name: 'Track', trackDesign: { unknown: [1, 2] }, gallery: [{ src: image }] }],
    sessions: [{ id: 's', standings: [], paddockJournal: { raw: { b: 1, a: 2 } }, paddockDelivery: { status: 'pending', payload: { revision: 3, state: 'finalized' } } }],
    laps: [{ id: 'l', sessionId: 's', carId: 'c', driverId: 'd', trackId: 't', time: 12345, valid: true, pit: false }],
    customFields: { drivers: [{ id: 'club', label: 'Club', type: 'text' }], slotcars: [{ id: 'chassis', label: 'Chassis', type: 'text' }] },
    layouts: [{ id: 'layout', widgets: [{ custom: { future: true }, width: 500 }] }],
    audiosets: [{ id: 'audio', sounds: { future: { source: 'data:audio/wav;base64,UklGRg==' } } }],
    paddock: { sourceId: 'stable-source', connection: { databaseId: 'host' }, withdrawals: [{ sessionId: 'old', revision: 2 }] },
    resourceLedger: { v: 1, accounts: { c: { balance: 4 } } }, future: { list: [null, false, ''], unknown: 'preserve' }
  }));
}
function migrate(f, hooks) { return migrateCopy(f, () => {}, hooks); }

test('copy conversion preserves ordered records, media, custom fields, settings and original bytes', t => {
  const data = sample(), f = setup(t, data), before = fs.readFileSync(f.source);
  const settings = Buffer.from('{ "theme": "light", "unknown": 7 }');
  fs.writeFileSync(path.join(f.dir, 'copy.settings.json'), settings);
  fs.writeFileSync(path.join(f.dir, 'race-resume.json'), '{"race":{"phase":"paused"}}');
  const result = migrate(f);
  assert.equal(result.settingsSidecarApplied, true);
  assert.equal(result.resumePreserved, true);
  assert.equal(result.verification.assets, 4);
  assert.deepEqual(fs.readFileSync(f.source), before);
  assert.deepEqual(fs.readFileSync(path.join(f.destination, 'source.json')), before);
  assert.deepEqual(fs.readFileSync(path.join(f.destination, 'source.settings.json')), settings);
  const db = openCopy(f.destination);
  try {
    data.settings = JSON.parse(settings);
    assert.equal(db.verify(data).exactOrderedJson, true);
    assert.deepEqual(db.get('sessions', 's', true).value, data.sessions[0]);
    assert.deepEqual(db.get('@meta', 'paddock', true).value, data.paddock);
    assert.equal(db.get('drivers', 'd').value.picture, null);
    assert.equal(db.get('drivers', 'd').assets[0].mime, 'image/png');
    assert.deepEqual(db.field('drivers', 'd', ['custom', 'club']), { present: true, value: 'SlotForge' });
    assert.deepEqual(db.field('drivers', 'd', ['custom', 'nil']), { present: true, value: null });
    assert.deepEqual(db.field('drivers', 'd', ['custom', 'missing']), { present: false });
    assert.deepEqual(db.sessionLaps('s').map(x => x.id), ['l']);
    assert.equal(db.get('drivers', 'absent'), null);
    assert.throws(() => db.page('drivers', -1, 201), /Invalid/);
    assert.throws(() => db.page('constructor'), /Invalid/);
  } finally { db.close(); }
});

test('unusual media spelling, arrays, empty objects and special keys round-trip exactly', t => {
  const data = JSON.parse('{"version":1,"drivers":[{"id":"d","__proto__":{"safe":true},"custom":{},"picture":"data:image/png;base64,YQ==\\r\\n","gallery":[{"data":"data:image/png;base64,Yg=="}],"other":"data:image/png;charset=utf-8;base64,YQ=="}],"empty":{}}');
  const f = setup(t, data); migrate(f); const db = openCopy(f.destination);
  try { assert.equal(db.verify(data).assets, 2); assert.equal(JSON.stringify(db.get('drivers', 'd', true).value), JSON.stringify(data.drivers[0])); assert.equal({}.safe, undefined); }
  finally { db.close(); }
});

test('already-normalized legacy database remains compatible with production views and Paddock payloads', t => {
  const f = setup(t, sample()); const legacy = new Database(f.source);
  const before = JSON.stringify(legacy.data); migrate(f);
  const db = openCopy(f.destination);
  try {
    db.verify(legacy.data);
    for (const entity of ['drivers', 'slotcars', 'tracks', 'sessions', 'laps', 'layouts'])
      assert.deepEqual(db.page(entity).map(r => db.get(entity, r.id, true).value), legacy.list(entity));
    assert.equal(JSON.stringify(legacy.data), before);
  } finally { db.close(); }
});

test('existing destination is never overwritten', t => {
  const f = setup(t, sample()); fs.mkdirSync(f.destination); fs.writeFileSync(path.join(f.destination, 'keep'), 'original');
  assert.throws(() => migrate(f), /EEXIST/);
  assert.equal(fs.readFileSync(path.join(f.destination, 'keep'), 'utf8'), 'original');
});

for (const [name, data] of [
  ['future version', { version: 99 }], ['bad collection', { version: 1, drivers: {} }],
  ['duplicate identity', { drivers: [{ id: 'x' }, { id: 'x' }] }], ['missing identity', { drivers: [{}] }],
  ['duplicate custom definition', { customFields: { drivers: [{ id: 'x' }, { id: 'x' }] } }],
  ['wrapped backup', { app: 'slotforge-timing-backup', data: sample() }]
]) test(`refuses ${name} without publishing or altering source`, t => {
  const f = setup(t, data), before = hash(fs.readFileSync(f.source));
  assert.throws(() => migrate(f)); assert.equal(fs.existsSync(path.join(f.destination, 'manifest.json')), false);
  assert.equal(hash(fs.readFileSync(f.source)), before); assert.throws(() => openCopy(f.destination));
});

test('corrupt source/settings/recovery stop migration, retaining all original bytes', t => {
  const f = setup(t, sample()); fs.writeFileSync(path.join(f.dir, 'copy.settings.json'), '{bad');
  const before = fs.readFileSync(f.source); assert.throws(() => migrate(f), /Settings/);
  assert.deepEqual(fs.readFileSync(f.source), before); assert(!fs.existsSync(path.join(f.destination, 'manifest.json')));
  const next = { ...f, destination: path.join(f.dir, 'bad-main') };
  fs.writeFileSync(f.source, '{bad'); assert.throws(() => migrate(next), /Database/);
});

test('source or newly appeared settings changing during migration is detected', t => {
  for (const sidecar of [false, true]) {
    const f = setup(t, sample());
    assert.throws(() => migrate(f, { beforeSourceCheck() { fs.writeFileSync(sidecar ? path.join(f.dir, 'copy.settings.json') : f.source, '{}'); } }), /Source changed/);
    assert(!fs.existsSync(path.join(f.destination, 'manifest.json')));
  }
});

test('import exception rolls back all records and does not publish', t => {
  const f = setup(t, sample());
  assert.throws(() => migrate(f, { record() { throw Error('injected interruption'); } }), /injected/);
  const raw = new DatabaseSync(path.join(f.destination, 'staging.sqlite'), { readOnly: true });
  try { assert.equal(raw.prepare('SELECT count(*) AS n FROM records').get().n, 0); } finally { raw.close(); }
  assert.throws(() => openCopy(f.destination));
});

test('SQLite disk-full failure rolls back import and retains recovery copies', t => {
  const data = sample(); data.drivers[0].notes = 'large'.repeat(20000); const f = setup(t, data);
  assert.throws(() => migrate(f, { beforeImport(store) { const pages = store.db.prepare('PRAGMA page_count').get().page_count; store.db.exec(`PRAGMA max_page_count=${pages}`); } }), /full/i);
  assert(fs.existsSync(path.join(f.destination, 'source.json'))); assert(!fs.existsSync(path.join(f.destination, 'manifest.json')));
});

test('verification catches altered fields and media before publication', t => {
  for (const sql of ["UPDATE fields SET json='123' WHERE entity='drivers'", "UPDATE assets SET digest='wrong'", `INSERT INTO fields VALUES('drivers','d','["extra"]','1')`]) {
    const f = setup(t, sample()); assert.throws(() => migrate(f, { afterImport(store) { store.db.exec(sql); } }), /verification|mismatch|Unexpected stored fields/i);
    assert(!fs.existsSync(path.join(f.destination, 'manifest.json')));
  }
});

test('failure just before publication never exposes a completed bundle', t => {
  const f = setup(t, sample()); assert.throws(() => migrate(f, { beforePublish() { throw Error('publish interrupted'); } }), /publish interrupted/);
  assert.throws(() => openCopy(f.destination)); assert(fs.existsSync(path.join(f.destination, 'source.json')));
});

test('manifest failure after SQLite publication is still an incomplete bundle', t => {
  const f = setup(t, sample());
  assert.throws(() => migrate(f, { beforePublish() { fs.mkdirSync(path.join(f.destination, 'manifest.pending')); } }), /EEXIST/);
  assert(fs.existsSync(path.join(f.destination, 'timing.sqlite')));
  assert(!fs.existsSync(path.join(f.destination, 'manifest.json')));
  assert.throws(() => openCopy(f.destination));
});

test('a damaged recovery copy prevents publication even if the database verifies', t => {
  const f = setup(t, sample()), before = hash(fs.readFileSync(f.source));
  assert.throws(() => migrate(f, { beforeSourceCheck() { fs.writeFileSync(path.join(f.destination, 'source.json'), '{}'); } }), /Recovery copy verification/);
  assert.equal(hash(fs.readFileSync(f.source)), before); assert.throws(() => openCopy(f.destination));
});

test('unknown SQLite versions and foreign databases fail closed without modifying them', t => {
  const f = setup(t, sample()); migrate(f); const file = path.join(f.destination, 'timing.sqlite');
  const raw = new DatabaseSync(file); raw.exec('PRAGMA user_version=999'); raw.close();
  const before = hash(fs.readFileSync(file)); assert.throws(() => openCopy(f.destination), /hash mismatch/); assert.throws(() => new SqliteStore(file), /Unsupported/); assert.equal(hash(fs.readFileSync(file)), before);
  const other = path.join(f.dir, 'other.sqlite'); const x = new DatabaseSync(other); x.close(); assert.throws(() => new SqliteStore(other), /Unsupported/);
});

test('historical orphan laps are preserved and explicitly reported rather than silently dropped', t => {
  const data = sample(); data.laps.push({ id: 'manual', sessionId: 'deleted', time: 6000 });
  const f = setup(t, data), result = migrate(f); assert.equal(result.verification.danglingSessions, 1); assert.equal(result.warnings.length, 1);
  const db = openCopy(f.destination); try { assert.deepEqual(db.get('laps', 'manual', true).value, data.laps[1]); } finally { db.close(); }
});

test('all captured Paddock result forms retain their exact ordered JSON hashes', t => {
  const data = sample(), names = ['normal', 'correction', 'withdrawal', 'endurance', 'multi-heat'];
  data.sessions = names.map(id => ({ id, paddockDelivery: { payload: JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/paddock/fixtures', id + '.json'))) } }));
  data.laps = [];
  const f = setup(t, data); migrate(f); const db = openCopy(f.destination);
  try {
    for (const session of data.sessions) assert.equal(hash(JSON.stringify(db.get('sessions', session.id, true).value.paddockDelivery.payload)), hash(JSON.stringify(session.paddockDelivery.payload)));
  } finally { db.close(); }
});

test('field reads identify extracted media rather than presenting it as a real null', t => {
  const f = setup(t, sample()); migrate(f); const db = openCopy(f.destination);
  try { const f = db.field('drivers', 'd', ['picture']); assert.equal(f.value, null); assert.equal(f.assets[0].mime, 'image/png'); }
  finally { db.close(); }
});

test('an altered published copy is rejected before any records are exposed', t => {
  const f = setup(t, sample()); migrate(f);
  const raw = new DatabaseSync(path.join(f.destination, 'timing.sqlite'));
  raw.exec("UPDATE fields SET json='null' WHERE entity='drivers'"); raw.close();
  assert.throws(() => openCopy(f.destination), /hash mismatch/);
});

test('persistent worker migrates, serializes operations, returns bounded reads and closes idempotently', async t => {
  const f = setup(t, sample()), progress = [], client = f.client({ onProgress: p => progress.push(p.phase) });
  t.after(() => client.close().catch(() => {}));
  const migration = client.migrate(f.source, f.destination), opened = client.open(f.destination);
  await migration; await opened;
  assert.deepEqual(progress, ['import', 'verify']);
  assert.equal((await client.get('drivers', 'd', true)).value.picture, image);
  assert.deepEqual(await client.field('drivers', 'd', ['custom', 'club']), { present: true, value: 'SlotForge' });
  assert.equal((await client.asset('drivers', 'd', ['picture'])).mime, 'image/png');
  await assert.rejects(client.open(f.destination), /already open/);
  await assert.rejects(client.request('exec', 'DROP TABLE records'), /Unsupported/);
  assert.equal((await client.page('drivers')).length, 1);
  const jobs = Array.from({ length: 32 }, () => client.get('drivers', 'd'));
  const closed = client.close(); await Promise.all(jobs); await closed; await client.close();
  await assert.rejects(client.page('drivers'), /closing|exited/);
});

test('worker errors, cancellation, timeout and uncloneable messages settle pending requests', async t => {
  const client = new Client(); t.after(() => client.close().catch(() => {}));
  await assert.rejects(client.request('get', () => {}), /clone/i); assert.equal(client.pending.size, 0);
  await assert.rejects(client.get('drivers', 'd'), /No SQLite/);
  const pending = client.get('drivers', 'd'); const rejected = assert.rejects(pending); await client.cancel(); await rejected;
  assert.equal(client.pending.size, 0);
  const timed = new Client({ timeoutMs: 1 }); t.after(() => timed.close().catch(() => {}));
  await assert.rejects(timed.page('drivers'), /timed out/); assert.equal(timed.pending.size, 0);
});

test('worker termination during import cannot publish a partial database', async t => {
  const data = sample(); data.laps = Array.from({ length: 15000 }, (_, i) => ({ id: 'lap-' + i, sessionId: 's', time: i }));
  const f = setup(t, data); let cancelled;
  const client = f.client({ onProgress: p => { if (p.records >= 1000 && !cancelled) cancelled = client.cancel(); } });
  t.after(() => client.close().catch(() => {}));
  await assert.rejects(client.migrate(f.source, f.destination), /cancelled|exited/);
  await cancelled;
  assert(!fs.existsSync(path.join(f.destination, 'manifest.json'))); assert.equal(JSON.parse(fs.readFileSync(f.source)).laps.length, 15000);
});

test('graceful shutdown drains accepted migration even when the observer throws', async t => {
  const f = setup(t, sample()), client = f.client({ onProgress() { throw Error('UI observer'); } });
  const migration = client.migrate(f.source, f.destination), closed = client.close();
  await migration; await closed;
  const db = openCopy(f.destination); try { assert.equal(db.get('drivers', 'd').value.name, 'James'); } finally { db.close(); }
});

test('one rejected conversion does not poison the worker queue', async t => {
  const f = setup(t, sample()), client = f.client();
  fs.mkdirSync(f.destination); await assert.rejects(client.migrate(f.source, f.destination), /EEXIST/);
  const fresh = path.join(f.dir, 'fresh'); await client.migrate(f.source, fresh); await client.open(fresh);
  assert.equal((await client.get('drivers', 'd')).value.name, 'James');
});
