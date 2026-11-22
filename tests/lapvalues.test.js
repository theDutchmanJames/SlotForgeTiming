'use strict';
// 2.4.0: the car library's statistics (Home, car statistics, records) read about a dozen values out of the stored text of every lap for every
// request: Home took 88 s over 260,000 laps, a car's statistics a minute. The values of each lap are now kept in query_lap_values, filled by
// SQLite whenever a lap is saved, changed or removed, and one request builds its list of cars in races and their laps once.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const { code, has } = require('./source.cjs');
const fixture = require('./support/shared-library-merge-fixture');
const E = '../vendor/slotforge-library/engine/src/';
const L = require(E + 'query-lap-values.cjs');

function exact(db) {
  const direct = db
    .prepare(
      `SELECT key,participant,position,${L.columns.map(c => `json_extract(json,'${L.values[c]}') ${c}`).join(',')} FROM query_laps ORDER BY 1,2,3`
    )
    .all();
  const kept = db.prepare(`SELECT key,participant,position,${L.columns.join(',')} FROM query_lap_values ORDER BY 1,2,3`).all();
  assert.deepEqual(kept, direct);
  // the same types as well: a lap id "12" stays text, true stays 1
  for (let i = 0; i < kept.length; i++) for (const c of L.columns) assert.equal(typeof kept[i][c], typeof direct[i][c], c);
  return kept.length;
}

test('the values of a lap follow every save, change and removal of the lap, also through a removed race', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON; CREATE TABLE records(key TEXT PRIMARY KEY)');
  require(E + 'query-timing.cjs').schema(db);
  L.schema(db);
  db.exec("INSERT INTO records VALUES('a'),('b')");
  const put = db.prepare('INSERT INTO query_laps(key,participant,position,ended,json) VALUES(?,?,?,?,?)');
  const laps = [
    { id: '12', number: 1, durationMs: 5012, endedAtMs: 1, valid: true, pit: false, recordEligible: true, stintId: 's1' },
    { id: 'x', number: 2, durationMs: 5012.5, valid: false, pit: true, countsForDistance: true, distanceM: 21.4, lane: 3, driverId: 'd' },
    { id: 7, personalRecordEligible: true, trackRecordEligible: false, originLapId: 'o', stintId: 4 },
    {}
  ];
  laps.forEach((l, i) => put.run('a', 'p1', i, i, JSON.stringify(l)));
  put.run('b', 'p1', 0, 0, JSON.stringify(laps[0]));
  assert.equal(exact(db), 5);
  db.prepare('UPDATE query_laps SET json=? WHERE key=? AND participant=? AND position=?').run(
    JSON.stringify({ id: 'changed', durationMs: 4999, valid: true, pit: false }),
    'a',
    'p1',
    1
  );
  db.prepare("UPDATE query_laps SET position=9 WHERE key='a' AND position=3").run();
  db.prepare('INSERT INTO query_laps VALUES(?,?,?,?,?) ON CONFLICT(key,participant,position) DO UPDATE SET json=excluded.json').run(
    'a',
    'p1',
    0,
    0,
    JSON.stringify({ id: 'upserted', durationMs: 1 })
  );
  assert.equal(exact(db), 5);
  db.exec("DELETE FROM query_laps WHERE key='a' AND position=2");
  assert.equal(exact(db), 4);
  db.exec("DELETE FROM records WHERE key='a'"); // the laps of a removed race go with it
  assert.equal(exact(db), 1);
  db.exec("DELETE FROM query_lap_values; INSERT INTO records VALUES('c')");
  put.run('c', 'p2', 0, 0, JSON.stringify(laps[1]));
  L.rebuild(db);
  assert.equal(exact(db), 2, 'rebuilt from the laps');
  assert.ok(require(E + 'query-index.cjs').structure(db).laps);
  db.exec('DROP TRIGGER query_lap_values_update');
  assert.equal(require(E + 'query-index.cjs').structure(db).laps, false, 'a missing trigger is noticed and the table rebuilt');
});

test('an existing car library gets the lap values when it opens, and its statistics stay the same', async t => {
  const seed = d => {
    d.drivers = [{ id: 'd', name: 'Driver' }];
    d.tracks = [{ id: 't', name: 'Track', length: 20, lanes: 2 }];
    d.sessions = Array.from({ length: 3 }, (_, i) => ({
      id: 's' + i,
      setupName: 'Race ' + i,
      date: '2026-10-0' + (i + 1),
      sessionType: 'race',
      trackId: 't',
      trackName: 'Track',
      standings: [{ pos: 1, driverId: 'd', driverName: 'Driver', carId: 'old-car', carName: 'Historic', laps: 20 }]
    }));
    d.laps = Array.from({ length: 60 }, (_, i) => ({
      id: 'l' + i,
      sessionId: 's' + (i % 3),
      trackId: 't',
      carId: 'old-car',
      driverId: 'd',
      time: 5000 + i * 7,
      lapNumber: Math.floor(i / 3) + 1,
      lane: 1 + (i % 2),
      date: '2026-10-0' + ((i % 3) + 1),
      pit: i % 11 === 0,
      invalid: i % 13 === 0
    }));
  };
  const { client } = await fixture(t, 'sqlite', seed);
  const car = client.canonicalId('old-car'),
    file = (await client.status()).file;
  const reads = async () => {
    const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'token' ? undefined : x)));
    return strip([
      await client.handle.timingRead({ kind: 'home', weekStart: '2026-09-28T00:00:00.000Z' }),
      await client.handle.timingRead({ kind: 'carStatistics', carId: car }),
      await client.handle.timingRead({ kind: 'records', scope: 'personal' }),
      await client.handle.timingRead({ kind: 'records', scope: 'track', sort: 'time' })
    ]);
  };
  const before = await reads();
  assert.ok(before[1].summary.recordedLaps > 0, 'the race history was copied into the library');
  assert.equal(before[1].summary.recordedLaps, before[0].summary.recordedLaps);
  const db = new DatabaseSync(file);
  assert.equal(exact(db), db.prepare('SELECT count(*) n FROM query_laps').get().n);
  // a library saved by an earlier Timing or Paddock: no lap values yet
  db.exec(L.TRIGGERS.map(x => `DROP TRIGGER ${x};`).join('') + 'DROP TABLE query_lap_values;');
  const { Store } = require(E + 'store.cjs');
  new Store(file, { deferred: true });
  assert.ok(require(E + 'query-index.cjs').structure(db).laps);
  assert.ok(exact(db) > 0);
  db.close();
  assert.deepEqual(await reads(), before);
  assert.ok(fs.existsSync(file));
});

test('a statistics request builds its cars in races and laps once, and a car looks only at the races of its own cars', () => {
  const T = code('vendor/slotforge-library/engine/src/shared-library-timing-read.cjs');
  assert.ok(has(T, 'JOIN query_lap_values v ON v.key=p.sessionKey AND v.participant=p.participantId'));
  assert.ok(has(T, "'CREATE TEMP TABLE timing_physical AS ' + physical(!input.carId, own.length > 0, narrow)"));
  assert.ok(
    has(T, 'if (input.trackId !== undefined) (narrow += " AND json_extract(s.json,\'$.payload.track.id\')=?"), args.push(input.trackId);')
  );
  assert.ok(has(T, "r.db.prepare('CREATE TEMP TABLE timing_page AS ' + q.sql + sql).run(...q.args, ...args);"));
  assert.ok(!T.includes("json_extract(l.json,'$.durationMs')"), 'no lap value is read from its stored text');
  assert.ok(
    has(code('vendor/slotforge-library/engine/src/query-index.cjs'), "if (!ready.laps) require('./query-lap-values.cjs').rebuild(db);")
  );
});
