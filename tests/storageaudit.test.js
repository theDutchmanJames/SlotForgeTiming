// Audit fixes (2.2.5) in storage: a failed JSON save is taken back, a half-applied restore puts the old file back, the app can close after the
// SQLite worker failed, a list that needs several pages can be read during a race, the conversion to SQLite treats race recovery as JSON
// storage does, and a confirmed editor save lets go of a stale retry identity of the same record.
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path'), vm = require('vm');
const R = path.join(__dirname, '..') + path.sep;
const Database = require(R + 'db'), Repo = require(R + 'data-repository');
const { migrateCopy } = require(R + 'sqlite-migration'), { forkCopy, WorkingStore } = require(R + 'sqlite-working');
const Client = require(R + 'sqlite-client'), Life = require(R + 'storage-lifecycle'), { SqliteCompatibilityReads } = require(R + 'compatibility-read');
let groups = 0; const done = n => { groups++; console.log('ok   ' + n); };
const tmp = name => fs.mkdtempSync(path.join(os.tmpdir(), 'sa-' + name + '-'));
const onDisk = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const quiet = f => { const e = console.error; console.error = () => {}; try { return f(); } finally { console.error = e; } };

(async () => {
  { // ---- JSON: written in the program's own time ----
    const dir = tmp('sync'), file = path.join(dir, 'slotforge-timing.json'), db = new Database(file);
    fs.mkdirSync(file + '.tmp'); // the disk will not take it
    assert.throws(() => quiet(() => db.add('drivers', { name: 'Alice' })));
    assert.throws(() => quiet(() => db.add('drivers', { name: 'Alice' })));
    assert.equal(db.data.drivers.length, 0);
    fs.rmdirSync(file + '.tmp');
    db.add('drivers', { name: 'Alice' });
    assert.deepEqual(onDisk(file).drivers.map(d => d.name), ['Alice']);
    done('JSON: an "Add" whose write fails leaves nothing behind; retrying it gives one record, not two');

    const id = db.data.drivers[0].id;
    db.add('tracks', { name: 'T' }); const track = db.data.tracks[0].id;
    db.data.sessions.push({ id: 's1', trackId: track, standings: [{ driverId: id }] }); db.data.laps.push({ id: 'l1', sessionId: 's1', driverId: id, trackId: track, time: 1 }); db.save();
    fs.mkdirSync(file + '.tmp');
    assert.throws(() => quiet(() => db.remove('drivers', id)));
    fs.rmdirSync(file + '.tmp');
    assert.deepEqual(db.data.drivers.map(d => d.id), [id]); assert.equal(db.data.laps.length, 1); assert.equal(db.data.sessions[0].standings.length, 1);
    done('JSON: a removal whose write fails is taken back with everything it changed (laps, standings)');

    fs.mkdirSync(file + '.tmp');
    assert.throws(() => quiet(() => db.addCustomField('drivers', { label: 'Club', type: 'text' })));
    fs.rmdirSync(file + '.tmp');
    assert.equal(db.data.customFields.drivers.length, 0);
    done('JSON: an extra field whose write fails is not kept');
  }
  { // ---- JSON: written in the background (through DataRepository) ----
    const dir = tmp('bg'), file = path.join(dir, 'slotforge-timing.json'), db = new Database(file);
    const repo = new Repo(db); const row = await repo.add('drivers', { name: 'Alice' }); db.bg = true;
    fs.mkdirSync(file + '.bg.tmp');
    await assert.rejects(quiet(() => repo.update('drivers', row.id, { name: 'Renamed', nickname: 'R' })));
    fs.rmdirSync(file + '.bg.tmp');
    assert.equal(db.data.drivers[0].name, 'Alice'); assert.equal(Object.hasOwn(db.data.drivers[0], 'nickname'), false);
    await repo.add('tracks', { name: 'Another' });
    assert.equal(onDisk(file).drivers[0].name, 'Alice');
    done('JSON (background): a rejected update is taken back and never written later');

    fs.mkdirSync(file + '.bg.tmp');
    const first = quiet(() => repo.update('drivers', row.id, { name: 'One' }));
    db.data.drivers[0].name = 'Two'; db.touch(db.data.drivers[0]); // (someone changed it again before the failure came back)
    await assert.rejects(first);
    fs.rmdirSync(file + '.bg.tmp');
    assert.equal(db.data.drivers[0].name, 'Two');
    done('...but a value that was changed again since is left as it is');

    fs.mkdirSync(file + '.bg.tmp');
    await assert.rejects(quiet(() => repo.remove('drivers', row.id)));
    fs.rmdirSync(file + '.bg.tmp');
    assert.equal(db.data.drivers.length, 1);
    fs.mkdirSync(file + '.bg.tmp');
    const gone = quiet(() => repo.remove('drivers', row.id)); db.data.tracks[0].name = 'X'; db.touch(db.data.tracks[0]);
    await assert.rejects(gone);
    fs.rmdirSync(file + '.bg.tmp');
    assert.equal(db.data.drivers.length, 0);
    done('JSON (background): a rejected removal comes back, unless anything was changed after it (then nothing is overwritten)');
  }
  { // ---- JSON restore that can not write the settings ----
    const dir = tmp('restore'), file = path.join(dir, 'slotforge-timing.json'), db = new Database(file);
    db.add('drivers', { name: 'Current' });
    fs.mkdirSync(db.settingsPath + '.tmp');
    assert.throws(() => quiet(() => db.replaceAll({ drivers: [{ id: 'x', name: 'FromBackup' }], settings: { theme: 'light' } })));
    fs.rmdirSync(db.settingsPath + '.tmp');
    assert.deepEqual(db.data.drivers.map(d => d.name), ['Current']); assert.deepEqual(onDisk(file).drivers.map(d => d.name), ['Current']);
    assert.deepEqual(new Database(file).data.drivers.map(d => d.name), ['Current']);
    done('JSON restore: when the settings can not be written, the earlier database file is put back too');
  }
  { // ---- SQLite: closing after the worker failed ----
    const dir = tmp('fail'), file = path.join(dir, 'slotforge-timing.json');
    new Database(file); migrateCopy({ source: file, destination: path.join(dir, 'copy') }); forkCopy(path.join(dir, 'copy'), path.join(dir, 'work'));
    const client = new Client(); await client.openWorking(path.join(dir, 'work'));
    const life = await new Life.StorageLifecycle(new Life.SqliteLifecycleBackend(client)).initialize(); client.timeoutMs = 30;
    const big = { v: 1, race: { name: 'x', rows: Array.from({ length: 200000 }, (_, i) => ({ i, s: 'lap' + i })) }, eng: { v: 1 } };
    await assert.rejects(life.saveResume(big), /timed out/);
    await life.shutdown(); await life.shutdown();
    done('SQLite: after the worker failed (a time-out), the app can still close');
    const c2 = new Client(); await c2.openWorking(path.join(dir, 'work')); await c2.close();
    done('...and the database opens again afterwards');
  }
  { // ---- SQLite: a list of several pages while a race saves its recovery point ----
    const dir = tmp('list'), file = path.join(dir, 'slotforge-timing.json'), db = new Database(file);
    db.data.tracks = Array.from({ length: 100 }, (_, i) => ({ id: 't' + i, name: 'Track ' + i, custom: {} })); db.saveNow();
    migrateCopy({ source: file, destination: path.join(dir, 'copy') }); forkCopy(path.join(dir, 'copy'), path.join(dir, 'work'));
    const store = new WorkingStore(path.join(dir, 'work'));
    const writeBetween = mode => { let pages = 0; return { compatibilityRead: async (...a) => { const v = store.compatibilityRead(...a); if (++pages === 1 && a[0] === 'page') {
      if (mode === 'resume') store.command({ id: 'resume-' + pages + Math.random(), type: 'setRaceResume', snapshot: { v: 1, race: { name: 'x' }, eng: { v: 1 } }, expectedRevision: store.revision('@meta', 'raceResume') });
      else store.command({ id: 'edit-' + Math.random(), type: 'updateRecord', entity: 'tracks', recordId: 't5', patch: { name: 'Renamed' }, expectedRevision: store.revision('tracks', 't5') }); }
      return structuredClone(v); } }; };
    const a = await new SqliteCompatibilityReads(writeBetween('resume')).list('tracks');
    assert.equal(a.length, 100);
    done('SQLite: a list of several pages is read while the race saves its recovery point (another collection)');
    const b = await new SqliteCompatibilityReads(writeBetween('track')).list('tracks');
    assert.equal(b.length, 100); assert.equal(b.find(t => t.id === 't5').name, 'Renamed');
    done('...and when its own collection changes between two pages it is read again from the start, with the change');
    const p1 = store.compatibilityRead('page', 'tracks', { mode: 'full' });
    store.command({ id: 'resume-direct', type: 'setRaceResume', snapshot: { v: 1, race: { name: 'y' }, eng: { v: 1 } }, expectedRevision: store.revision('@meta', 'raceResume') });
    assert.ok(store.compatibilityRead('page', 'tracks', { mode: 'full', cursor: p1.next }).items.length > 0);
    store.command({ id: 'edit-direct', type: 'updateRecord', entity: 'tracks', recordId: 't6', patch: { name: 'Again' }, expectedRevision: store.revision('tracks', 't6') });
    assert.throws(() => store.compatibilityRead('page', 'tracks', { mode: 'full', cursor: p1.next }), e => e.code === 'CATALOGUE_CHANGED');
    done('...a page cursor is only stale when its own collection changed (checked page by page, without a retry)');
    store.close();
  }
  { // ---- conversion to SQLite and race recovery ----
    const convert = (main, sidecar) => { const dir = tmp('conv'), file = path.join(dir, 'slotforge-timing.json'); fs.writeFileSync(file, JSON.stringify(main));
      if (sidecar !== undefined) fs.writeFileSync(path.join(dir, 'race-resume.json'), sidecar);
      migrateCopy({ source: file, destination: path.join(dir, 'copy') }); forkCopy(path.join(dir, 'copy'), path.join(dir, 'work'));
      const store = new WorkingStore(path.join(dir, 'work')); try { return store.snapshot('@meta', 'raceResume', true).record?.value ?? null; } finally { store.close(); } };
    const side = { v: 1, race: { name: 'interrupted' }, eng: { v: 1 } }, old = { v: 1, race: { name: 'from an old backup' }, eng: { v: 1 } };
    assert.deepEqual(convert({ raceResume: null, drivers: [] }, JSON.stringify(side)), side);
    assert.deepEqual(convert({ raceResume: old, drivers: [] }, JSON.stringify(side)), side);
    done('conversion: a "raceResume" key in the JSON file no longer blocks the conversion; the recovery file is the race to resume, as in JSON storage');
    assert.equal(convert({ raceResume: old, drivers: [] }), null);
    done('...and a database without a recovery file does not offer to resume a race from an old backup');
    assert.equal(convert({ drivers: [] }, '{not json'), null); assert.equal(convert({ drivers: [] }, JSON.stringify({ v: 2 })), null);
    done('...a damaged or unknown recovery file does not block the conversion either (JSON storage ignores it too)');
  }
  { // ---- editor saves: retry identities ----
    const store = new Map(), sent = [], api = {};
    const localStorage = { get length() { return store.size; }, key: n => [...store.keys()][n] ?? null, getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
    let lose = false;
    const ipcRenderer = { invoke: async (ch, ...a) => { if (ch === 'db:editor-scope') return 'scope'; if (ch === 'db:editor-save') { sent.push(a[0]); if (lose) throw Error('lost'); return { ok: true, value: a[0].args }; } return null; }, send() {}, on() {}, removeListener() {} };
    const ctx = { require: m => m === 'electron' ? { contextBridge: { exposeInMainWorld: (_n, v) => Object.assign(api, v) }, ipcRenderer, webUtils: {} } : require(m), localStorage, crypto: require('crypto').webcrypto, TextEncoder, console, setTimeout, clearTimeout, Promise, structuredClone, process: { platform: process.platform } };
    ctx.crypto.randomUUID = () => require('crypto').randomUUID();
    vm.createContext(ctx); vm.runInContext(fs.readFileSync(R + 'preload.js', 'utf8'), ctx);
    lose = true; await assert.rejects(api.update('drivers', 'd1', { flag: true })); lose = false;
    const retained = sent.at(-1).id;
    await api.update('drivers', 'd1', { flag: true });
    assert.equal(sent.at(-1).id, retained);
    done('editor save: retrying a save whose answer was lost uses the same identity (the database can tell it was done)');
    lose = true; await assert.rejects(api.update('drivers', 'd1', { flag: true })); lose = false;
    const again = sent.at(-1).id;
    await api.update('drivers', 'd1', { flag: false });
    await api.update('drivers', 'd1', { flag: true });
    assert.notEqual(sent.at(-1).id, again);
    done('...but after a confirmed save of the same record, repeating the older edit is a new save (not answered with the old receipt)');
    lose = true; await assert.rejects(api.add('drivers', { name: 'A' })); lose = false; const addId = sent.at(-1).id;
    await api.update('drivers', 'd2', { name: 'B' }); await api.add('drivers', { name: 'A' });
    assert.equal(sent.at(-1).id, addId);
    done('...an unconfirmed "Add" keeps its identity (it is about no known record yet)');
  }
  console.log(`STORAGE AUDIT TESTS PASSED (${groups} checks)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
