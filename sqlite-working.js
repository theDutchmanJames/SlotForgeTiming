'use strict';
// Working generations, selected explicitly after verified conversion or restore.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { SqliteStore, object, hash } = require('./sqlite-store');
const { openCopy } = require('./sqlite-migration');
const CarStats = require('./renderer/carstats');
const PaddockRecords = require('./paddockrecords');
const { applyCheckpoint } = require('./resource-checkpoint');
const Records = require('./sqlite-records');
const Outbox = require('./sqlite-outbox');
const Catalogue = require('./sqlite-catalogue');
const History = require('./sqlite-history');
const PaddockWrites = require('./sqlite-paddock');
const schema = require('./schema');

const WORKING_SCHEMA = `
  CREATE TABLE command_receipts(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result TEXT NOT NULL);
  CREATE TABLE changes(sequence INTEGER PRIMARY KEY AUTOINCREMENT,commandId TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL,changed TEXT NOT NULL,FOREIGN KEY(commandId) REFERENCES command_receipts(id));
  CREATE TABLE revisions(entity TEXT NOT NULL,id TEXT NOT NULL,revision INTEGER NOT NULL,PRIMARY KEY(entity,id));
  CREATE TABLE field_versions(entity TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,version INTEGER NOT NULL,PRIMARY KEY(entity,id,path));
  CREATE TABLE ordinals(entity TEXT PRIMARY KEY,next INTEGER NOT NULL);
  INSERT INTO ordinals SELECT entity,MAX(ordinal)+1 FROM records GROUP BY entity;
  CREATE TABLE resource_sessions(runId TEXT PRIMARY KEY,sessionId TEXT NOT NULL,fingerprint TEXT);
  INSERT INTO info VALUES('workingFormat','1');`;

function forkCopy(source, destination) {
  const verified = openCopy(source); verified.close();
  // Only a fresh directory may receive a fork. Incomplete forks cannot be opened.
  fs.mkdirSync(destination);
  const staging = path.join(destination, 'staging.sqlite'), target = path.join(destination, 'working.sqlite');
  fs.copyFileSync(path.join(source, 'timing.sqlite'), staging, fs.constants.COPYFILE_EXCL);
  const manifest = JSON.parse(fs.readFileSync(path.join(source, 'manifest.json'), 'utf8'));
  const digest = crypto.createHash('sha256'), fd = fs.openSync(staging, 'r'), buffer = Buffer.alloc(65536);
  try { let n; while ((n = fs.readSync(fd, buffer, 0, buffer.length, null))) digest.update(buffer.subarray(0, n)); }
  finally { fs.closeSync(fd); }
  if (digest.digest('hex') !== manifest.sqliteSha256) throw Error('Recovery copy changed while creating working fork.');
  const db = new DatabaseSync(staging);
  try {
    db.exec('PRAGMA foreign_keys=ON; PRAGMA synchronous=FULL; BEGIN IMMEDIATE;');
    db.exec(WORKING_SCHEMA);
    // Imported resource identities also prevent replay of an already saved run.
    const store = new SqliteStore(staging);
    try {
      for (const row of db.prepare("SELECT id FROM records WHERE entity='sessions'").iterate()) {
        const run = store.field('sessions', row.id, ['resourceRunId']);
        if (run.present && run.value) db.prepare('INSERT INTO resource_sessions VALUES(?,?,NULL)').run(run.value, row.id);
      }
    } finally { store.close(); }
    db.exec('COMMIT');
  } catch (error) { try { db.exec('ROLLBACK'); } catch {} throw error; }
  finally { db.close(); }
  // Keep the verified recovery source untouched; bring its sidecar into the working fork.
  const resumeSource=manifest.sources?.find(row=>row.name==='race-resume.json');
  if(resumeSource){
    const bytes=fs.readFileSync(path.join(source,'race-resume.json'));
    if(hash(bytes)!==resumeSource.sha256)throw Error('Race recovery copy checksum mismatch.');
    const snapshot=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),writer=new SqliteStore(staging,{writable:true});
    try{writer.transaction(()=>{
      const existing=writer.get('@meta','raceResume',true);
      if(existing){if(JSON.stringify(existing.value)!==JSON.stringify(snapshot))throw Error('Conflicting embedded and sidecar race recovery.');return;}
      const ordinal=writer.statement("SELECT coalesce(max(ordinal),-1)+1 n FROM records WHERE entity='@meta'").get().n;
      writer.statement("INSERT INTO roots VALUES('raceResume',(SELECT coalesce(max(ordinal),-1)+1 FROM roots),'meta')").run();
      writer.putRecord('@meta','raceResume',ordinal,snapshot);
      writer.statement("INSERT INTO ordinals VALUES('@meta',?) ON CONFLICT(entity) DO UPDATE SET next=excluded.next").run(ordinal+1);
    });}finally{writer.close();}
  }
  fs.renameSync(staging, target);
  return { file: target, sourceSha256: manifest.sqliteSha256 };
}

function identity(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200) throw Error('Invalid command or record identity.');
  return value;
}
function version(value) { if (!Number.isSafeInteger(value) || value < 0) throw Error('Invalid expected version.'); }
function canonical(value, depth = 0) {
  if (depth > 80) throw Error('Command nesting is too deep.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) if (!Object.hasOwn(value, i)) throw Error('Commands cannot contain sparse arrays.');
    return '[' + value.map(v => canonical(v, depth + 1)).join(',') + ']';
  }
  if (object(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)))
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical(value[k], depth + 1)).join(',') + '}';
  throw Error('Commands must contain only finite JSON values.');
}

class WorkingStore extends SqliteStore {
  constructor(directory, { checkpoint = () => {}, clock = Date.now } = {}) {
    super(path.join(directory, 'working.sqlite'), { writable: true });
    this.checkpoint = checkpoint; this.clock = clock;
    try { Outbox.upgrade(this); Catalogue.upgrade(this); History.upgrade(this); require('./sqlite-finalization').upgrade(this); } catch (error) { this.close(); throw error; }
  }
  homeStatistics(options) { return require('./sqlite-dashboard').home(this,options); }
  homeSessions(options) { return require('./sqlite-dashboard').navigation(this,options); }
  raceSeason(options) { return require('./sqlite-dashboard').season(this,options); }
  raceCharts(ids) { return require('./sqlite-dashboard').charts(this,ids); }
  raceInputs(options) { return require('./sqlite-dashboard').race(this,options); }
  referencePage(entity,options) { return require('./sqlite-references').page(this,entity,options); }
  referenceDetails(entity,ids,revision) { return require('./sqlite-references').details(this,entity,ids,revision); }
  historyPage(pool,options) { return History.page(this,pool,options); }
  historySession(pool,id,options) { return History.session(this,pool,id,options); }
  carStatistics(id) { return History.car(this,id); }
  catalogue(entity, options) { return Catalogue.page(this,entity,options); }
  cataloguePicture(entity,id,revision) { return Catalogue.picture(this,entity,id,revision); }
  outbox(databaseId, options) { return Outbox.page(this, databaseId, options); }
  deliveryPayload(key, token) { return Outbox.payload(this, key, token); }
  deliverySnapshot(key) { return Outbox.snapshot(this,key); }
  snapshot(entity, id, includeMedia = false) {
    return this.transaction(() => ({ record: this.get(entity, id, includeMedia), revision: this.revision(entity, id) }));
  }
  paddockRead(kind, options) { return require('./sqlite-paddock-read').read(this,kind,options); }
  bulkCollect(picks,deps,info) { return require('./sqlite-bulk').collect(this,picks,deps,info); }
  bulkDependencies(picks) { return require('./sqlite-bulk').dependencies(this,picks); }
  bulkImport(file,commandId,digest) { return require('./sqlite-bulk').importFile(this,file,commandId,digest); }
  backupSnapshot(destination,info) { return require('./sqlite-bulk').snapshot(this,destination,info); }
  exportLegacy(file,info) { return require('./sqlite-bulk').exportLegacy(this,file,info); }
  compatibilityRead(kind,entity,value) { return require('./sqlite-compatibility').read(this,kind,entity,value); }
  lifecycleBarrier() { return true; } // Worker message ordering drains every earlier request.
  lifecycleDiagnostics() { return require('./sqlite-lifecycle').diagnostics(this); }
  resourceState() { return this.transaction(() => ({ ledger: this.ledger(), revision: this.revision('@meta', 'resourceLedger') })); }
  resourceBegin(profileId, context) {
    return this.transaction(() => {
      const ledger = this.ledger(); if (ledger.checkpoint) throw Error('Resume or discard the unfinished resource race first.');
      const profile = this.get('resourcesystems', profileId)?.value;
      return { state: require('./renderer/resources').prepare(profile, context, ledger), revision: this.revision('@meta', 'resourceLedger') };
    });
  }
  revision(entity, id) { return this.statement('SELECT revision FROM revisions WHERE entity=? AND id=?').get(entity, id)?.revision ?? 0; }
  fieldVersion(entity, id, parts) { return this.statement('SELECT version FROM field_versions WHERE entity=? AND id=? AND path=?').get(entity, id, JSON.stringify(parts))?.version ?? 0; }
  receipt(id) { const row = this.statement('SELECT result FROM command_receipts WHERE id=?').get(identity(id)); return row ? JSON.parse(row.result) : null; }
  changes(after = 0, limit = 50) {
    if (!Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Invalid change query.');
    return this.statement('SELECT * FROM changes WHERE sequence>? ORDER BY sequence LIMIT ?').all(after, limit).map(r => ({ ...r, changed: JSON.parse(r.changed) }));
  }
  touch(entity, id) {
    const key = JSON.stringify([entity, id]);
    if (this.changed.has(key)) return;
    this.changed.set(key, { entity, id });
    this.statement('INSERT INTO revisions VALUES(?,?,1) ON CONFLICT(entity,id) DO UPDATE SET revision=revision+1').run(entity, id);
  }
  expect(entity, id, expected) {
    version(expected);
    if (this.revision(entity, id) !== expected) throw Error('Record version conflict. Reload before editing.');
    if (!this.get(entity, id)) throw Error('Record not found.');
  }
  nextOrdinal(entity) {
    this.statement('INSERT OR IGNORE INTO ordinals VALUES(?,0)').run(entity);
    const next = this.statement('SELECT next FROM ordinals WHERE entity=?').get(entity).next;
    this.statement('UPDATE ordinals SET next=next+1 WHERE entity=?').run(entity);
    return next;
  }
  root(entity, kind = 'collection') {
    this.statement('INSERT OR IGNORE INTO roots VALUES(?,(SELECT COALESCE(MAX(ordinal),-1)+1 FROM roots),?)').run(entity, kind);
  }
  insert(entity, row) {
    this.root(entity); this.putRecord(entity, row.id, this.nextOrdinal(entity), row);
    if (entity === 'laps') this.indexLap(row);
    this.touch(entity, row.id);
  }
  indexLap(row) {
    const text = v => typeof v === 'string' ? v : null;
    this.statement('INSERT INTO lap_index VALUES(?,?,?,?,?,?,?,?,?)').run(row.id, 'laps', text(row.sessionId), text(row.carId), text(row.driverId), text(row.trackId), Number.isFinite(row.time) ? row.time : null, row.valid ? 1 : 0, row.pit ? 1 : 0);
  }
  erase(entity, id) {
    if (entity === 'laps') this.statement('DELETE FROM lap_index WHERE id=?').run(id);
    for (const table of ['fields', 'assets', 'records']) this.statement(`DELETE FROM ${table} WHERE entity=? AND id=?`).run(entity, id);
    this.touch(entity, id); // Keep revision tombstones after deletion.
  }
  replace(entity, id, value) {
    const old = this.statement('SELECT ordinal FROM records WHERE entity=? AND id=?').get(entity, id);
    if (old) this.erase(entity, id);
    else { this.root(id, 'meta'); this.touch(entity, id); }
    this.putRecord(entity, id, old?.ordinal ?? this.nextOrdinal(entity), value);
    if (entity === 'laps') this.indexLap(value);
  }
  scalar(entity, id, parts, value) {
    // Change a single scalar leaf without reading/replacing unchanged media BLOBs.
    const row = this.statement('SELECT shape FROM records WHERE entity=? AND id=?').get(entity, id);
    if (!row) throw Error('Record not found.');
    const shape = JSON.parse(row.shape); let current = shape;
    for (let i = 0; i < parts.length; i++) {
      if (current[0] !== 'object') throw Error('Cannot edit through a non-object field.');
      let member = current[1].find(([key]) => key === parts[i]);
      if (!member) { member = [parts[i], i === parts.length - 1 ? ['field', JSON.stringify(parts)] : ['object', []]]; current[1].push(member); }
      if (i === parts.length - 1 && (member[1][0] !== 'field' || member[1][1] !== JSON.stringify(parts))) throw Error('Expected a scalar field.');
      current = member[1];
    }
    const key = JSON.stringify(parts);
    if (this.statement('SELECT 1 FROM assets WHERE entity=? AND id=? AND path=?').get(entity, id, key)) throw Error('Media requires a separate asset command.');
    this.statement('INSERT INTO fields VALUES(?,?,?,?) ON CONFLICT(entity,id,path) DO UPDATE SET json=excluded.json').run(entity, id, key, JSON.stringify(value));
    this.statement('UPDATE records SET shape=? WHERE entity=? AND id=?').run(JSON.stringify(shape), entity, id);
    this.statement('INSERT INTO field_versions VALUES(?,?,?,1) ON CONFLICT(entity,id,path) DO UPDATE SET version=version+1').run(entity, id, key);
    this.touch(entity, id);
  }
  command(input) {
    if (!object(input)) throw Error('Invalid storage command.');
    identity(input.id);
    const encoded = canonical(input);
    if (Buffer.byteLength(encoded) > 64 * 1024 * 1024) throw Error('Storage command exceeds the experimental 64 MiB bound.');
    const fingerprint = hash(encoded);
    return this.transaction(() => {
      const old = this.statement('SELECT fingerprint,result FROM command_receipts WHERE id=?').get(input.id);
      if (old) {
        if (old.fingerprint !== fingerprint) throw Error('Command identity was already used with different content.');
        return JSON.parse(old.result);
      }
      this.changed = new Map();
      let result;
      switch (input.type) {
        case 'setLapEligibility': result = this.lapEligibility(input); break;
        case 'setRaceResume': result = require('./sqlite-lifecycle').setResume(this,input); break;
        case 'importItems': result = require('./sqlite-bulk').importItems(this,input); break;
        case 'finalizeSession': result = this.finalize(input); break;
        case 'setCustomValue': result = this.custom(input); break;
        case 'setRecordEligibility': result = this.eligibility(input); break;
        case 'deleteSession': result = this.deleteSession(input); break;
        case 'resourceCheckpoint': result = this.resourceCheckpoint(input); break;
        case 'resourceClear': result = this.resourceClear(input); break;
        default:
          if (Object.hasOwn(Records.commands, input.type)) result = Records.commands[input.type](this, input);
          else if (Object.hasOwn(Outbox.commands, input.type)) result = Outbox.commands[input.type](this, input);
          else if (Object.hasOwn(PaddockWrites.commands, input.type)) result = PaddockWrites.commands[input.type](this, input);
          else throw Error('Unsupported storage command.');
      }
      Outbox.syncChanges(this);
      Catalogue.sync(this); History.sync(this);
      this.checkpoint('domain-written');
      this.statement('INSERT INTO command_receipts VALUES(?,?,?)').run(input.id, fingerprint, JSON.stringify(result));
      // A large result must not turn a 200-entry journal page into millions of IDs.
      // Consumers must refresh affected entities when the identity list is truncated.
      const records = [], counts = {};
      for (const change of this.changed.values()) {
        counts[change.entity] = (counts[change.entity] || 0) + 1;
        if (records.length < 128) records.push(change);
      }
      const changed = { records, counts, requiresRefresh: this.changed.size > records.length };
      this.statement('INSERT INTO changes(commandId,kind,changed) VALUES(?,?,?)').run(input.id, input.type, JSON.stringify(changed));
      this.checkpoint('before-commit');
      return result;
    });
  }
  custom({ entity, recordId, fieldId, expectedVersion, value }) {
    if (!Object.hasOwn(schema,entity) || ['sessions','laps'].includes(entity)) throw Error('Unsupported custom-value entity.');
    identity(recordId); identity(fieldId); version(expectedVersion);
    if (!(value === null || ['string', 'number', 'boolean'].includes(typeof value)) || (typeof value === 'string' && value.length > 10000)) throw Error('Expected a bounded scalar custom value.');
    const definitions = this.get('@meta', 'customFields')?.value?.[entity];
    const definition = Array.isArray(definitions) && definitions.find(f => f.id === fieldId);
    if (!definition) throw Error('Unknown custom-field definition.');
    if (!['text', 'number', 'date', 'list'].includes(definition.type)) throw Error('Unsupported custom-field type.');
    if (value !== null && value !== '') {
      if (definition.type === 'number' ? typeof value !== 'number' : typeof value !== 'string') throw Error('Custom value does not match its field type.');
      if (definition.type === 'list' && !definition.options?.includes(value)) throw Error('Custom value is not an available choice.');
      if (definition.type === 'date' && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value)) throw Error('Invalid custom date.');
    }
    const row = this.get(entity, recordId)?.value;
    if (!row) throw Error('Record not found.');
    const parts = ['custom', fieldId];
    if (this.fieldVersion(entity, recordId, parts) !== expectedVersion) throw Error('Field version conflict. Reload before editing.');
    if (row.custom === null) Records.setPath(this,entity,recordId,['custom'],{});
    this.scalar(entity, recordId, parts, value);
    return { version: this.fieldVersion(entity, recordId, parts), revision: this.revision(entity, recordId) };
  }
  counters(laps, session, direction) {
    const cars = new Map();
    for (const lap of laps) {
      if (!cars.has(lap.carId)) {
        const exists = typeof lap.carId === 'string' && this.statement("SELECT 1 FROM records WHERE entity='slotcars' AND id=?").get(lap.carId);
        cars.set(lap.carId, exists ? Object.fromEntries(['lapsDriven', 'lapsSinceService', 'serviceDate'].map(k => [k, this.field('slotcars', lap.carId, [k]).value])) : null);
      }
      const car = cars.get(lap.carId); if (!car) continue;
      const date = session instanceof Map ? session.get(lap.sessionId) : session.date;
      if (CarStats.afterService(car, lap, date)) car.lapsSinceService = Math.max(0, CarStats.sinceOf(car) + direction);
      car.lapsDriven = direction > 0 ? (car.lapsDriven || 0) + 1 : Math.max(0, (car.lapsDriven || 0) - 1);
    }
    for (const [id, car] of cars) if (car) {
      if (car.lapsSinceService !== undefined) this.scalar('slotcars', id, ['lapsSinceService'], car.lapsSinceService);
      this.scalar('slotcars', id, ['lapsDriven'], car.lapsDriven);
    }
    this.checkpoint('counters-written');
  }
  paddockState() {
    const source = this.field('@meta', 'paddock', ['sourceId']);
    // Catalogue caches, connection settings and photos are not part of result writes.
    return { paddock: source.present ? { sourceId: source.value, withdrawals: this.field('@meta', 'paddock', ['withdrawals']).value || [] } : undefined };
  }
  savePaddock(state, before) {
    if (JSON.stringify(state.paddock) === before) return;
    if (!this.statement("SELECT 1 FROM records WHERE entity='@meta' AND id='paddock'").get()) this.replace('@meta', 'paddock', state.paddock);
    else {
      const old = before ? JSON.parse(before) : {};
      if (old.sourceId !== state.paddock.sourceId) this.scalar('@meta', 'paddock', ['sourceId'], state.paddock.sourceId);
      if (JSON.stringify(old.withdrawals) !== JSON.stringify(state.paddock.withdrawals)) this.scalar('@meta', 'paddock', ['withdrawals'], state.paddock.withdrawals);
    }
  }
  ledger() { return this.get('@meta', 'resourceLedger', true)?.value || { v: 1, accounts: {}, runs: {}, history: [], checkpoint: null }; }
  expectLedger(expected) {
    version(expected);
    if (this.revision('@meta', 'resourceLedger') !== expected) throw Error('Resource ledger version conflict. Reload before saving.');
  }
  closeResourceRun(ledger, runId) {
    const run = object(ledger.runs) && Object.hasOwn(ledger.runs, runId) && ledger.runs[runId];
    if (ledger.v !== 1 || !object(run) || !Number.isSafeInteger(run.count) || run.count < 0) throw Error('Invalid or unsupported resource run state.');
    run.closed = true; ledger.checkpoint = null;
  }
  resourceCheckpoint({ snapshot, expectedRevision }) {
    this.expectLedger(expectedRevision);
    const runId = identity(snapshot?.race?.resources?.runId);
    if (this.statement('SELECT 1 FROM resource_sessions WHERE runId=?').get(runId)) throw Error('Resource run was already finalized.');
    this.replace('@meta', 'resourceLedger', applyCheckpoint(this.ledger(), snapshot));
    this.checkpoint('resources-written');
    return { revision: this.revision('@meta', 'resourceLedger') };
  }
  resourceClear({ runId, expectedRevision }) {
    identity(runId); this.expectLedger(expectedRevision);
    const next = this.ledger();
    if (next.checkpoint?.race?.resources?.runId !== runId) throw Error('Resource checkpoint belongs to another run or is already closed.');
    this.closeResourceRun(next, runId);
    this.replace('@meta', 'resourceLedger', next);
    return { revision: this.revision('@meta', 'resourceLedger') };
  }
  finalize({ session, laps, resourceCheckpoint, expectedResourceRevision }) {
    if (!object(session) || !Array.isArray(laps) || laps.length > 100000 || laps.some(l => !object(l))) throw Error('Invalid session/laps or experimental 100,000 lap command bound exceeded.');
    if (session.paddockDelivery !== undefined) throw Error('Delivery state is generated by Timing.');
    if(session.saveKey!==undefined){
      if(typeof session.saveKey!=='string'||!session.saveKey||session.saveKey.length>200)throw Error('Invalid finalization identity.');
      const prior=require('./sqlite-finalization').saved(this,session.saveKey);
      if(prior){if(!this.get('sessions',prior.sessionId))throw Error('This race was already finalized and its result deleted.');return {sessionId:prior.sessionId};}
    }
    if (resourceCheckpoint && !session.resourceRunId) throw Error('A resource checkpoint needs a resource run identity.');
    const fingerprint = hash(canonical({ session, laps, resourceCheckpoint: resourceCheckpoint ?? null }));
    if (session.resourceRunId) {
      identity(session.resourceRunId);
      const old = this.statement('SELECT * FROM resource_sessions WHERE runId=?').get(session.resourceRunId);
      if (old) {
        if (old.fingerprint && old.fingerprint !== fingerprint) throw Error('Resource run was already finalized with different content.');
        if (!this.get('sessions', old.sessionId)) throw Error('Resource run was already finalized and its session deleted.');
        return { sessionId: old.sessionId };
      }
      let ledger = this.ledger();
      if (resourceCheckpoint || ledger.checkpoint?.race?.resources?.runId === session.resourceRunId) {
        this.expectLedger(expectedResourceRevision);
        if (resourceCheckpoint) {
          if (resourceCheckpoint.race?.resources?.runId !== session.resourceRunId) throw Error('Resource checkpoint does not match this session.');
          ledger = applyCheckpoint(ledger, resourceCheckpoint);
        }
        this.closeResourceRun(ledger, session.resourceRunId);
        this.replace('@meta', 'resourceLedger', ledger); this.checkpoint('resources-written');
      }
    }
    // Caller objects are never mutated. IDs are generated once and preserved by the receipt.
    const s = { ...JSON.parse(JSON.stringify(session)), id: crypto.randomUUID() };
    const rows = laps.map(l => ({ ...l, id: crypto.randomUUID(), sessionId: s.id }));
    const state = this.paddockState();
    const before = JSON.stringify(state.paddock);
    PaddockRecords.prepare(state, s, rows);
    this.insert('sessions', s); this.checkpoint('session-written');
    for (const row of rows) this.insert('laps', row);
    this.checkpoint('laps-written');
    this.counters(rows, s, 1);
    this.savePaddock(state, before);
    if (session.resourceRunId) this.statement('INSERT INTO resource_sessions VALUES(?,?,?)').run(session.resourceRunId, s.id, fingerprint);
    if(session.saveKey)require('./sqlite-finalization').complete(this,session.saveKey,s.id);
    return { sessionId: s.id };
  }
  lapsFor(id) {
    return this.statement("SELECT l.id FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE l.sessionId=? ORDER BY r.ordinal").all(id).map(r => this.get('laps', r.id, true).value);
  }
  lapEligibility({lapId,expectedRevision,flags}) {
    this.expect('laps',lapId,expectedRevision);
    if(!object(flags)||!Object.keys(flags).length||Object.keys(flags).some(k=>!['noTrackRecord','noPersonalBest'].includes(k)||typeof flags[k]!=='boolean'))throw Error('Only record eligibility flags can be corrected here.');
    const lap=this.get('laps',lapId,true).value;
    if(lap.sessionId&&this.get('sessions',lap.sessionId))return this.eligibility({sessionId:lap.sessionId,expectedRevision:this.revision('sessions',lap.sessionId),edits:[{lapId,flags}]});
    this.replace('laps',lapId,{...lap,...flags});return {lapId,revision:this.revision('laps',lapId)};
  }
  eligibility({ sessionId, expectedRevision, edits }) {
    identity(sessionId); this.expect('sessions', sessionId, expectedRevision);
    if (!Array.isArray(edits) || !edits.length || edits.length > 100000) throw Error('Invalid eligibility edits.');
    const rows = this.lapsFor(sessionId), byId = new Map(rows.map(r => [r.id, r])), seen = new Set();
    for (const edit of edits) {
      if (!object(edit) || !object(edit.flags) || !Object.keys(edit.flags).length || Object.keys(edit.flags).some(k => !['noTrackRecord', 'noPersonalBest'].includes(k) || typeof edit.flags[k] !== 'boolean')) throw Error('Only record eligibility flags can be corrected here.');
      const row = byId.get(edit.lapId);
      if (!row || seen.has(row.id)) throw Error('Unknown or duplicate lap in session correction.');
      seen.add(row.id); Object.assign(row, edit.flags); this.replace('laps', row.id, row);
    }
    const s = this.get('sessions', sessionId, true).value;
    const state = { ...this.paddockState(), laps: rows };
    const before = JSON.stringify(state.paddock);
    PaddockRecords.revise(state, s);
    this.replace('sessions', s.id, s);
    this.savePaddock(state, before);
    return { sessionId, revision: this.revision('sessions', sessionId) };
  }
  deleteSession({ sessionId, expectedRevision }) {
    identity(sessionId); this.expect('sessions', sessionId, expectedRevision);
    const session = this.get('sessions', sessionId, true).value, rows = this.lapsFor(sessionId);
    const state = this.paddockState();
    const before = JSON.stringify(state.paddock);
    PaddockRecords.withdraw(state, session, 'Session deleted in Timing.');
    this.counters(rows, session, -1);
    for (const row of rows) this.erase('laps', row.id);
    this.erase('sessions', sessionId);
    this.savePaddock(state, before);
    return { sessionId, deleted: true };
  }
}
module.exports = { WorkingStore, forkCopy };
