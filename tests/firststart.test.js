'use strict';
// 2.4.0: the first start with a large race history (2,500 races, 450,000 laps) sat on the opening screen for more than 20 minutes while the car
// library copied the races, and then stopped at the library's 200 MiB limit. Now: the laps of a race are found through the race (one query took
// 273 ms, it takes under 1 ms), the history check no longer builds an error for every shape it tries, the library view is kept from one save to the
// next, the opening screen says how far the copy is, and the limit is 1 GiB.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { code, has } = require('./source.cjs');
const V = 'vendor/slotforge-library/';

const LAP_FILES = [
  'integration/timing-legacy/index.cjs',
  V + 'engine/src/timing-legacy/index.cjs',
  'paddock-historical-store.js',
  'sqlite-bulk.js',
  'sqlite-dashboard.js',
  'sqlite-records.js',
  'sqlite-store.js',
  'sqlite-working.js'
];

test('the laps of a race, a driver or a track are found through the lap index first', () => {
  for (const f of LAP_FILES) {
    const S = code(f);
    assert.ok(!S.includes('FROM lap_index l JOIN records r'), f + ' still lets SQLite walk every lap in order');
    assert.ok(S.includes('FROM lap_index l CROSS JOIN records r'), f);
  }
  // the reason, on a small copy of the working tables: with a plain JOIN and ORDER BY r.ordinal SQLite walks the records in order
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE records(entity TEXT NOT NULL,id TEXT NOT NULL,ordinal INTEGER NOT NULL,shape TEXT NOT NULL,PRIMARY KEY(entity,id),UNIQUE(entity,ordinal));
    CREATE TABLE lap_index(id TEXT PRIMARY KEY,entity TEXT NOT NULL DEFAULT 'laps',sessionId TEXT,carId TEXT,driverId TEXT,trackId TEXT,time REAL,valid INTEGER,pit INTEGER);
    CREATE INDEX lap_session ON lap_index(sessionId,id);CREATE INDEX lap_driver ON lap_index(driverId,valid,pit,time);`);
  const addRecord = db.prepare("INSERT INTO records VALUES('laps',?,?,'[]')"),
    addLap = db.prepare('INSERT INTO lap_index(id,sessionId,driverId) VALUES(?,?,?)');
  db.exec('BEGIN');
  for (let i = 0; i < 6000; i++) {
    addRecord.run('lap' + i, i);
    addLap.run('lap' + i, 's' + (i % 300), 'd' + (i % 40));
  }
  db.exec('COMMIT;ANALYZE');
  const plan = sql =>
    db
      .prepare('EXPLAIN QUERY PLAN ' + sql)
      .all('s7', -1, 101)
      .map(r => r.detail)[0];
  const q = j =>
    `SELECT r.id,r.ordinal FROM lap_index l ${j} records r ON r.entity='laps' AND r.id=l.id WHERE l.sessionId=? AND r.ordinal>? ORDER BY r.ordinal LIMIT ?`;
  assert.match(plan(q('CROSS JOIN')), /^SEARCH l USING COVERING INDEX lap_session/);
  const rows = j => db.prepare(q(j)).all('s7', -1, 101);
  assert.deepEqual(rows('CROSS JOIN'), rows('JOIN'), 'the same laps in the same order');
  assert.equal(rows('CROSS JOIN').length, 20);
});

test('the history check finds the same faults, without an Error for every shape it tries', () => {
  const S = require('../' + V + 'engine/src/timing-schema.cjs');
  const def = { anyOf: [{ type: 'null' }, { type: 'integer', minimum: 0 }, { type: 'string', pattern: '^[a-z]+$' }] };
  for (const ok of [null, 0, 42, 'abc']) assert.doesNotThrow(() => S.validate(ok, def));
  for (const bad of [-1, 1.5, 'ABC', true, {}])
    assert.throws(() => S.validate(bad, def, '$.x'), /^Error: \$\.x: does not match a supported shape$/);
  const obj = {
    type: 'object',
    required: ['a'],
    properties: { a: def, b: { type: 'array', items: { type: 'string', pattern: '^\\d+$' } } }
  };
  assert.throws(
    () => S.validate({ a: 1, b: ['12', 'x'] }, obj),
    /^Error: \$\.b\[1\]: invalid text format$/,
    'the place of a fault is still named'
  );
  assert.throws(() => S.validate({ b: [] }, obj), /missing a/);
  const t = performance.now();
  for (let i = 0; i < 20000; i++) S.validate(i % 2 ? 'abc' : null, def);
  assert.ok(performance.now() - t < 1500, 'trying the shapes is cheap');
});

test('the first-start copy keeps its view of the library between saves, and says how far it is', () => {
  const B = code(V + 'engine/src/shared-library-bootstrap.cjs');
  assert.ok(has(B, 'if (kept && keptCurrent(file, kept)) return kept;'));
  assert.ok(has(B, "if (sessions % 5 === 0 || sessions === 1) tell('sessions', sessions, sessionTotal);"));
  assert.ok(has(code(V + 'engine/src/shared-library-worker.cjs'), 'progress => parentPort.postMessage({ progress })'));
  const I = code(V + 'index.cjs');
  assert.ok(has(I, 'const {thumbnailEncoder,onProgress,...workerOptions}=options;'), 'the function is not sent to the worker');
  assert.ok(has(I, 'if(m&&m.progress&&m.id===undefined){try{onProgress?.(m.progress)}catch{}return;}'));
  const M = code('main.js');
  assert.ok(has(M, 'onProgress: p => startupFeedback?.status?.(libraryProgressText(p))'));
  assert.ok(has(M, '`Copying your race history into the car library: ${n(p.done)}${of} races`'));
});

test('the opening screen shows a new status line and title, the newest replacing the one before', async () => {
  const { EventEmitter } = require('node:events');
  let win;
  const inserted = new Map();
  let key = 0;
  class Window extends EventEmitter {
    constructor(options) {
      super();
      win = this;
      this.webContents = new EventEmitter();
      this.webContents.setWindowOpenHandler = () => {};
      this.webContents.insertCSS = async css => {
        inserted.set(++key, css);
        return key;
      };
      this.webContents.removeInsertedCSS = async k => inserted.delete(k);
    }
    loadFile() {
      return Promise.resolve();
    }
    show() {}
    isVisible() {
      return true;
    }
    setTitle(t) {
      this.title = t;
    }
    isDestroyed() {
      return false;
    }
    destroy() {}
  }
  const f = require('../startup-feedback').create({ BrowserWindow: Window, quit: () => {} });
  f.status('Copying your cars into the car library: 10 of 800');
  await new Promise(r => setImmediate(r));
  f.status('Copying your race history into the car library: 5 of 2,500 races');
  await new Promise(r => setImmediate(r));
  assert.equal(win.title, 'Opening SlotForge Timing · Copying your race history into the car library: 5 of 2,500 races');
  assert.equal(inserted.size, 1, 'one status at a time');
  assert.match([...inserted.values()][0], /\.status::after\{content:"Copying your race history into the car library: 5 of 2,500 races"/);
  f.dispose();
});

test('the library holds up to 1 GiB of race history and other records', () => {
  const R = require('../' + V + 'engine/src/storage-resources.cjs');
  assert.equal(R.METADATA_LIMIT, 1024 * 1024 * 1024);
  assert.doesNotThrow(() => R.checkCollectionSize(400 * 1024 * 1024));
  assert.throws(() => R.checkCollectionSize(R.METADATA_LIMIT + 1), /1 GiB working limit/);
});

test('a car lap count looks only at the races of its own cars, and the original-only races through their index', () => {
  const T = code(V + 'engine/src/shared-library-timing-read.cjs');
  assert.ok(has(T, 'WHERE key IN (SELECT key FROM query_car_results WHERE car_id IN (SELECT value FROM json_each(?)))'));
  assert.ok(has(T, 'r.db.prepare(SERVICE_COUNT(!!from)).get(JSON.stringify(own), ...(from ? [from] : []), carId).n'));
  for (const f of ['shared-library-lap-counts.cjs', 'shared-library-originals.cjs', 'shared-library-raw-history.cjs'])
    assert.ok(code(V + 'engine/src/' + f).includes('FROM record_fields p CROSS JOIN records r ON r.key=p.record'), f);
  const L = code(V + 'engine/src/timing-legacy/index.cjs');
  assert.ok(has(L, 'if (!st) prepared.set(sql, (st = db.prepare(sql)));'), 'the reader prepares its queries once');
  const M = code('main.js');
  assert.ok(has(M, "if (p.phase === 'service') return `Setting the service counters of your cars: ${n(p.done)}${of}`;"));
});
