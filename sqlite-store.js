'use strict';
// Base copy-migration format, also used by selected SQLite working generations.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const crypto = require('node:crypto');
const schema = require('./schema');
const FORMAT = 1, APP_ID = 0x5346544d;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const set = (target, key, value) => Object.defineProperty(target, key, { value, enumerable: true, writable: true, configurable: true });
function media(value) {
  if (typeof value !== 'string') return null;
  const m = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(value);
  if (!m) return null;
  const bytes = Buffer.from(m[2], 'base64');
  return { mime: m[1], bytes, digest: hash(bytes), original: value === `data:${m[1]};base64,${bytes.toString('base64')}` ? null : value };
}
function encode(value, entity = '') {
    const leaves = [], assets = [];
    const strip = (v, parts) => {
      const m = media(v);
      if (m) { assets.push([JSON.stringify(parts), m]); return null; }
      if (Array.isArray(v)) return v.map((x, i) => strip(x, [...parts, i]));
      if (object(v)) return Object.fromEntries(Object.entries(v).map(([key, x]) => [key, strip(x, [...parts, key])]));
      return v;
    };
    const shapeOf = (v, parts = []) => {
      if (object(v)) return ['object', Object.entries(v).map(([key, x]) => [key, shapeOf(x, [...parts, key])])];
      const key = JSON.stringify(parts);
      // Arrays remain bounded JSON leaves, but embedded media is extracted.
      leaves.push([key, JSON.stringify(strip(v, parts))]);
      return ['field', key];
    };
    // A measured lap is one historical record, not independently editable fields.
    // Its searchable values live in lap_index; splitting every scalar would add
    // millions of rows without improving the session-correction contract.
    const shape = entity === 'laps' ? ['field', '[]'] : shapeOf(value);
    if (entity === 'laps') leaves.push(['[]', JSON.stringify(strip(value, []))]);
    return { shape, leaves, assets };
}
class SqliteStore {
  constructor(file, { create = false, writable = false } = {}) {
    if (create && writable) throw Error('Create a verified copy before forking a writable database.');
    this.file = file; this.db = null;
    this.statements = new Map();
    if (create) { const fd = fs.openSync(file, 'wx'); fs.closeSync(fd); }
    else if (!fs.statSync(file).isFile()) throw Error('SQLite file is missing.');
    try {
      if (writable) {
        // Validate before opening for writes; never turn a recovery copy into a workspace.
        const probe = new DatabaseSync(file, { readOnly: true, timeout: 5000 });
        try {
          if (probe.prepare('PRAGMA application_id').get().application_id !== APP_ID ||
              probe.prepare('PRAGMA user_version').get().user_version !== FORMAT ||
              !['1', '2', '3', '4', '5', '6'].includes(probe.prepare("SELECT value FROM info WHERE key='workingFormat'").get()?.value))
            throw Error('Not a supported SQLite working database.');
        } finally { probe.close(); }
      }
      this.db = new DatabaseSync(file, { readOnly: !create && !writable, timeout: 5000 });
      if (create) {
        this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
          PRAGMA cache_size=-16384; PRAGMA application_id=${APP_ID}; PRAGMA user_version=${FORMAT};
          CREATE TABLE info(key TEXT PRIMARY KEY,value TEXT NOT NULL);
          CREATE TABLE roots(key TEXT PRIMARY KEY,ordinal INTEGER NOT NULL UNIQUE,kind TEXT NOT NULL);
          CREATE TABLE records(entity TEXT NOT NULL,id TEXT NOT NULL,ordinal INTEGER NOT NULL,shape TEXT NOT NULL,
            PRIMARY KEY(entity,id),UNIQUE(entity,ordinal));
          CREATE TABLE fields(entity TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,json TEXT NOT NULL,
            PRIMARY KEY(entity,id,path),FOREIGN KEY(entity,id) REFERENCES records(entity,id));
          CREATE TABLE assets(entity TEXT NOT NULL,id TEXT NOT NULL,path TEXT NOT NULL,mime TEXT NOT NULL,
            bytes BLOB NOT NULL,digest TEXT NOT NULL,original TEXT,
            PRIMARY KEY(entity,id,path),FOREIGN KEY(entity,id) REFERENCES records(entity,id));
          CREATE TABLE lap_index(id TEXT PRIMARY KEY,entity TEXT NOT NULL DEFAULT 'laps' CHECK(entity='laps'),
            sessionId TEXT,carId TEXT,driverId TEXT,trackId TEXT,time REAL,valid INTEGER,pit INTEGER,
            FOREIGN KEY(entity,id) REFERENCES records(entity,id));
          CREATE INDEX lap_session ON lap_index(sessionId,id);
          CREATE INDEX lap_car ON lap_index(carId,valid,pit,time);
          CREATE INDEX lap_driver ON lap_index(driverId,valid,pit,time);
          CREATE INDEX lap_track ON lap_index(trackId,valid,pit,time);`);
      } else {
        if (this.statement('PRAGMA application_id').get().application_id !== APP_ID ||
            this.statement('PRAGMA user_version').get().user_version !== FORMAT) throw Error('Unsupported Timing SQLite storage format.');
        if (this.statement("SELECT value FROM info WHERE key='verified'").get()?.value !== 'true') throw Error('SQLite migration is incomplete.');
        if (writable) this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA cache_size=-16384;');
      }
    } catch (error) { this.close(); throw error; }
  }
  statement(sql) {
    if (!this.statements.has(sql)) this.statements.set(sql, this.db.prepare(sql));
    return this.statements.get(sql);
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = fn(); this.db.exec('COMMIT'); return result; }
    catch (error) { try { this.db.exec('ROLLBACK'); } catch { /* SQLite may already have rolled back. */ } throw error; }
  }
  putRecord(entity, id, ordinal, value) {
    const { shape, leaves, assets } = encode(value, entity);
    this.statement('INSERT INTO records VALUES(?,?,?,?)').run(entity, id, ordinal, JSON.stringify(shape));
    const field = this.statement('INSERT INTO fields VALUES(?,?,?,?)');
    for (const [key, json] of leaves) field.run(entity, id, key, json);
    const asset = this.statement('INSERT INTO assets VALUES(?,?,?,?,?,?,?)');
    for (const [key, m] of assets) asset.run(entity, id, key, m.mime, m.bytes, m.digest, m.original);
  }
  import(data, checkpoint = () => {}) {
    if (!object(data)) throw Error('Expected a JSON database object.');
    if (data.version !== undefined && data.version !== 1) throw Error('Unsupported legacy database version.');
    if (data.app === 'slotforge-timing-backup' || data.app === 'slot-lap-timer-backup' || data.format === 'slotforge-timing-export' || data.format === 'slot-lap-timer-export')
      throw Error('Use a raw database JSON copy. Backup/export package import is a separate conversion step.');
    if (data.settings !== undefined && !object(data.settings)) throw Error('Invalid database settings.');
    if (data.customFields !== undefined) {
      if (!object(data.customFields)) throw Error('Invalid custom-field definitions.');
      for (const [entity, definitions] of Object.entries(data.customFields)) {
        if (!Array.isArray(definitions)) throw Error(`Invalid custom-field definitions: ${entity}`);
        const ids = new Set();
        for (const definition of definitions) {
          if (!object(definition) || typeof definition.id !== 'string' || !definition.id || ids.has(definition.id)) throw Error(`Missing or duplicate custom-field identity: ${entity}`);
          ids.add(definition.id);
        }
      }
    }
    this.transaction(() => {
      let ordinal = 0, count = 0;
      for (const [key, value] of Object.entries(data)) {
        const collection = Object.hasOwn(schema, key);
        if (collection && !Array.isArray(value)) throw Error(`Invalid collection: ${key}`);
        this.statement('INSERT INTO roots VALUES(?,?,?)').run(key, ordinal++, collection ? 'collection' : 'meta');
        if (!collection) this.putRecord('@meta', key, ordinal, value);
        else {
          const ids = new Set();
          for (const [i, row] of value.entries()) {
            if (!object(row) || typeof row.id !== 'string' || !row.id || ids.has(row.id)) throw Error(`Missing or duplicate identity in ${key} at row ${i + 1}.`);
            ids.add(row.id); this.putRecord(key, row.id, i, row);
            if (key === 'laps') {
              const text = v => typeof v === 'string' ? v : null;
              this.statement('INSERT INTO lap_index VALUES(?,?,?,?,?,?,?,?,?)').run(row.id, 'laps', text(row.sessionId), text(row.carId), text(row.driverId), text(row.trackId), Number.isFinite(row.time) ? row.time : null, row.valid ? 1 : 0, row.pit ? 1 : 0);
            }
            checkpoint(++count);
          }
        }
      }
    });
  }
  get(entity, id, includeMedia = false) {
    if (typeof includeMedia !== 'boolean') throw Error('Invalid media selection.');
    const record = this.statement('SELECT shape FROM records WHERE entity=? AND id=?').get(entity, id);
    if (!record) return null;
    const values = new Map(this.statement('SELECT path,json FROM fields WHERE entity=? AND id=?').all(entity, id).map(f => [f.path, f.json]));
    const used = new Set();
    const build = shape => {
      if (shape[0] === 'field') { if (!values.has(shape[1]) || used.has(shape[1])) throw Error('Invalid stored field shape.'); used.add(shape[1]); return JSON.parse(values.get(shape[1])); }
      return Object.fromEntries(shape[1].map(([key, next]) => [key, build(next)]));
    };
    let value = build(JSON.parse(record.shape));
    if (used.size !== values.size) throw Error('Unexpected stored fields.');
    const assets = this.statement('SELECT path,mime,digest,length(bytes) AS size FROM assets WHERE entity=? AND id=? ORDER BY path').all(entity, id).map(a => ({ ...a, path: JSON.parse(a.path) }));
    if (includeMedia) for (const asset of assets) {
      const a = this.statement('SELECT bytes,original FROM assets WHERE entity=? AND id=? AND path=?').get(entity, id, JSON.stringify(asset.path));
      const uri = a.original ?? `data:${asset.mime};base64,${Buffer.from(a.bytes).toString('base64')}`;
      if (!asset.path.length) value = uri;
      else { let parent = value; for (const key of asset.path.slice(0, -1)) parent = parent[key]; set(parent, asset.path.at(-1), uri); }
    }
    return { value, assets };
  }
  field(entity, id, parts) {
    if (!Array.isArray(parts) || parts.some(p => typeof p !== 'string')) throw Error('Invalid field path.');
    const row = this.statement('SELECT json FROM fields WHERE entity=? AND id=? AND path=?').get(entity, id, JSON.stringify(parts));
    if (!row) return { present: false };
    const assets = this.statement('SELECT path,mime,digest,length(bytes) AS size FROM assets WHERE entity=? AND id=?').all(entity, id)
      .map(a => ({ ...a, path: JSON.parse(a.path) })).filter(a => parts.every((p, i) => a.path[i] === p));
    return { present: true, value: JSON.parse(row.json), ...(assets.length ? { assets } : {}) };
  }
  page(entity, after = -1, limit = 50) {
    if (!Object.hasOwn(schema, entity) || !Number.isSafeInteger(after) || after < -1 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Invalid page query.');
    return this.statement('SELECT id,ordinal FROM records WHERE entity=? AND ordinal>? ORDER BY ordinal LIMIT ?').all(entity, after, limit);
  }
  sessionLaps(sessionId, after = -1, limit = 100) {
    if (typeof sessionId !== 'string' || !Number.isSafeInteger(after) || after < -1 || !Number.isInteger(limit) || limit < 1 || limit > 200) throw Error('Invalid lap query.');
    return this.statement("SELECT r.id,r.ordinal FROM lap_index l JOIN records r ON r.entity='laps' AND r.id=l.id WHERE l.sessionId=? AND r.ordinal>? ORDER BY r.ordinal LIMIT ?").all(sessionId, after, limit);
  }
  asset(entity, id, parts) {
    const a = this.statement('SELECT mime,bytes,digest FROM assets WHERE entity=? AND id=? AND path=?').get(entity, id, JSON.stringify(parts));
    return a ? { ...a, bytes: Buffer.from(a.bytes) } : null;
  }
  verify(data) {
    if (this.statement('PRAGMA integrity_check').get().integrity_check !== 'ok' || this.statement('PRAGMA foreign_key_check').all().length) throw Error('SQLite integrity verification failed.');
    const roots = this.statement('SELECT * FROM roots ORDER BY ordinal').all();
    if (JSON.stringify(roots.map(r => r.key)) !== JSON.stringify(Object.keys(data))) throw Error('Root ordering mismatch.');
    let records = 0;
    for (const root of roots) {
      if (root.kind === 'meta') {
        if (JSON.stringify(this.get('@meta', root.key, true)?.value) !== JSON.stringify(data[root.key])) throw Error(`Metadata verification failed: ${root.key}`);
        records++;
      } else {
        const ids = this.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(root.key);
        if (ids.length !== data[root.key].length) throw Error('Collection count mismatch.');
        ids.forEach((row, i) => {
          if (JSON.stringify(this.get(root.key, row.id, true)?.value) !== JSON.stringify(data[root.key][i])) throw Error(`Record verification failed: ${root.key}/${row.id}`);
          records++;
        });
      }
    }
    if (this.statement('SELECT count(*) AS n FROM records').get().n !== records) throw Error('Unexpected stored records.');
    let assets = 0;
    for (const a of this.statement('SELECT bytes,digest FROM assets').iterate()) { if (hash(a.bytes) !== a.digest) throw Error('Media hash mismatch.'); assets++; }
    const danglingSessions = this.statement("SELECT count(*) AS n FROM lap_index l WHERE l.sessionId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM records r WHERE r.entity='sessions' AND r.id=l.sessionId)").get().n;
    return { records, assets, danglingSessions, exactOrderedJson: true };
  }
  markVerified() { this.statement("INSERT INTO info VALUES('verified','true')").run(); }
  close() { if (this.db) { this.db.close(); this.db = null; this.statements.clear(); } }
}
module.exports = { SqliteStore, FORMAT, APP_ID, hash, object, encode };
