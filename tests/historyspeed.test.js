'use strict';
// 2.4.0: Results and Records (and the Setup pages that read the race list) took 167 s with 2,500 races: the race list skipped this
// computer's races in the car library one by one to find the library's other races, and the records of this computer ranked every one
// of its 450,000 laps. Now the library leaves this computer's races out of its list (except the ones this computer does not hold), and
// a record is the first lap of its group in the lap index.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const fixture = require('./support/shared-library-merge-fixture');
const { RECORDS } = require('../sqlite-history');

const OLD = (group, field, token) =>
  `WITH winners AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY ${group} ORDER BY time,ordinal) AS place,MIN(ordinal) OVER(PARTITION BY ${group}) AS firstOrdinal FROM history_laps WHERE token=? AND ${field}=1 AND time>0 ${token && field === 'personal' ? "AND driverId<>''" : ''}) SELECT w.id FROM winners w LEFT JOIN catalogue_index c ON c.entity='tracks' AND c.id=w.trackId WHERE w.place=1 ORDER BY COALESCE(c.sortKey,?),w.time,w.firstOrdinal LIMIT ? OFFSET ?`;

test('the records of this computer are the same laps in the same order as when every lap was ranked', () => {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE history_laps(id TEXT PRIMARY KEY,ordinal INTEGER NOT NULL,token INTEGER NOT NULL,trackId TEXT NOT NULL,driverId TEXT NOT NULL,time REAL,track INTEGER NOT NULL,personal INTEGER NOT NULL,heat REAL NOT NULL,lap REAL NOT NULL);
    CREATE INDEX history_track ON history_laps(token,track,trackId,time,ordinal);
    CREATE INDEX history_personal ON history_laps(token,personal,trackId,driverId,time,ordinal);
    CREATE TABLE catalogue_index(entity TEXT,id TEXT,sortKey TEXT,PRIMARY KEY(entity,id));`);
  let seed = 7;
  const rnd = n => (seed = (seed * 48271) % 2147483647) % n;
  const add = db.prepare('INSERT INTO history_laps VALUES(?,?,?,?,?,?,?,?,0,0)');
  for (let i = 0; i < 4000; i++) {
    const odd = rnd(30);
    add.run(
      'l' + i,
      i,
      rnd(4) ? 0 : 1,
      't' + rnd(9),
      rnd(7) ? 'd' + rnd(6) : '',
      odd === 0 ? null : odd === 1 ? 0 : 4000 + rnd(300),
      rnd(5) ? 1 : 0,
      rnd(4) ? 1 : 0
    );
  }
  // equal times in a group (the earlier lap wins), tracks without a name (deleted), two tracks with the same name
  for (let k = 0; k < 7; k++)
    db.prepare("INSERT INTO catalogue_index VALUES('tracks',?,?)").run('t' + k, k === 3 ? 'track b' : 'track ' + 'abcab'[k % 5]);
  for (const token of [0, 1])
    for (const [field, group] of [
      ['track', 'trackId'],
      ['personal', 'trackId,driverId']
    ])
      for (const [limit, offset] of [
        [41, 0],
        [5, 3],
        [100000, 0]
      ]) {
        const run = sql =>
          db
            .prepare(sql)
            .all(token, '~deleted', limit, offset)
            .map(x => x.id);
        const a = run(OLD(group, field, token));
        assert.deepEqual(run(RECORDS(group, field, token)), a, [token, field, limit, offset].join(' '));
        if (limit > 1000) assert.ok(a.length > 5);
      }
});

function seed(d) {
  d.tracks = [{ id: 't', name: 'Track', length: 20, lanes: 2 }];
  d.drivers = [{ id: 'd', name: 'Driver' }];
  d.sessions = Array.from({ length: 30 }, (_, i) => ({
    id: 's' + i,
    setupName: 'Race ' + i,
    date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString(),
    sessionType: i % 10 === 9 ? 'tokens' : 'race',
    trackId: 't',
    trackName: 'Track',
    standings: [{ pos: 1, driverId: 'd', driverName: 'Driver', carId: 'old-car', carName: 'Historic', laps: 2 }]
  }));
  d.laps = d.sessions.flatMap((s, i) =>
    [0, 1].map(k => ({
      id: 'l' + i + '-' + k,
      sessionId: s.id,
      trackId: 't',
      carId: 'old-car',
      driverId: 'd',
      time: 5000 + i * 3 + k,
      lapNumber: k + 1,
      lane: 1,
      date: s.date,
      ...(s.sessionType === 'tokens' ? { token: true } : {})
    }))
  );
}
// a store as an older Timing had it: without historyKnown, so each race of this computer is asked about
const asBefore = b =>
  new Proxy(b, { get: (o, k) => (k === 'historyKnown' ? undefined : typeof o[k] === 'function' ? o[k].bind(o) : o[k]) });
// a store that lost one race the library still holds (an older backup restored here)
const without = (b, gone) =>
  new Proxy(b, {
    get(o, k) {
      if (k === 'historyKnown') return async list => (await o.historyKnown(list)).filter(id => id !== gone);
      if (k === 'historySession') return async (pool, id, opts) => (id === gone ? null : o.historySession(pool, id, opts));
      if (k === 'historyPage')
        return async (pool, opts) => {
          const p = await o.historyPage(pool, opts);
          return { ...p, sessions: { ...p.sessions, items: p.sessions.items.filter(s => s.id !== gone) } };
        };
      return typeof o[k] === 'function' ? o[k].bind(o) : o[k];
    }
  });

for (const backend of ['json', 'sqlite'])
  test(backend + ': the race list shows the same races, and a race of this computer that only the library holds still shows', async t => {
    const { client, worker, db } = await fixture(t, backend, seed);
    const base = worker ? new (require('../sqlite-app-repository'))(worker) : new (require('../data-repository'))(db);
    const own = client.installationId;
    const ids = (await client.handle.timingRead({ kind: 'sessionIds', sourceId: own })).ids;
    assert.ok(ids.length >= 27, 'the races were copied into the library');
    assert.deepEqual((await base.historyKnown(ids)).sort(), [...ids].sort(), 'this computer holds them all');
    assert.deepEqual(await base.historyKnown(['nope']), []);
    const left = await client.handle.timingRead({ kind: 'resultSessions', excludeSourceId: own, limit: 50 });
    assert.equal(left.rows.length, 0, "this computer's races are left out");
    const kept = await client.handle.timingRead({ kind: 'resultSessions', excludeSourceId: own, keepSessionIds: [ids[2]], limit: 50 });
    assert.deepEqual(
      kept.rows.map(r => r.sessionId),
      [ids[2]]
    );
    await assert.rejects(client.handle.timingRead({ kind: 'resultSessions', keepSessionIds: [] }), /keepSessionIds/);
    const strip = v => JSON.parse(JSON.stringify(v, (k, x) => (k === 'revision' ? undefined : x)));
    const Reads = require('../shared-library-reads');
    const walk = async (b, pool) => {
      const out = [];
      let p = await Reads.historyPage(b, client, pool, {});
      out.push(strip(p.sessions.items));
      for (let n = 0; p.sessions.next && n < 5; n++)
        out.push(strip((p = await Reads.historyPage(b, client, pool, { sessions: p.sessions.next })).sessions.items));
      return out;
    };
    for (const pool of ['racing', 'tokens']) assert.deepEqual(await walk(base, pool), await walk(asBefore(base), pool), pool);
    const now = await walk(without(base, 's4'), 'racing');
    assert.deepEqual(now, await walk(asBefore(without(base, 's4')), 'racing'));
    assert.ok(
      now.flat().some(s => s.readOnly && s.setupName === 'Race 4'),
      'the library copy is listed'
    );
  });
