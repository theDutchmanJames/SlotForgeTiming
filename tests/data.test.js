'use strict';
// Phase 3 (data, 2.3.0): automatic backups, records of races that did not reach the shared library, sharing results (CSV, web page, text),
// and driver progress.
process.env.TZ = 'Europe/Amsterdam';
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const AB = require('../auto-backup.js'),
  DP = require('../driver-progress.js'),
  DPV = require('../renderer/driverprogress.js'),
  R = require('../renderer/report.js'),
  SR = require('../shared-library-reads.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'sf-autobackup-'));

// ---- automatic backups ----
test('automatic backups are on by standard, every day, keeping 7, in the standard folder', () => {
  assert.deepEqual(AB.config({}, 'D:\\Backups'), { on: true, every: 'day', keep: 7, folder: 'D:\\Backups' });
  assert.deepEqual(
    AB.config({ autoBackup: { on: false, every: 'week', keep: 3, folder: 'relative' } }, 'D:\\B'),
    {
      on: false,
      every: 'week',
      keep: 3,
      folder: 'D:\\B'
    },
    'a folder that is not a whole path is not used'
  );
  assert.equal(AB.config({ autoBackup: { keep: 500 } }, 'x').keep, 7);
});

test('a backup is due a day (or a week) after the last one, with an hour of slack', () => {
  const day = 24 * 3600e3,
    at = Date.parse('2026-11-10T20:05:00Z'),
    cfg = AB.config({}, 'x');
  assert.equal(AB.due(cfg, '', at), true, 'never made one');
  assert.equal(AB.due(cfg, new Date(at).toISOString(), at + day - 2 * 3600e3), false);
  assert.equal(AB.due(cfg, new Date(at).toISOString(), at + day - 1800e3), true, 'club night half an hour earlier than yesterday');
  assert.equal(AB.due({ ...cfg, every: 'week' }, new Date(at).toISOString(), at + 3 * day), false);
  assert.equal(AB.due({ ...cfg, on: false }, '', at), false);
});

test('only the automatic backups are ever removed, the oldest first', () => {
  const dir = tmp();
  const names = ['2026-11-01-200000', '2026-11-02-200000', '2026-11-03-200000'].map(d => 'SlotForge-Timing-auto-' + d + '.json');
  names.forEach(n => fs.writeFileSync(path.join(dir, n), '{}'));
  fs.mkdirSync(path.join(dir, 'SlotForge-Timing-auto-2026-11-04-200000.slotforge-backup'));
  fs.writeFileSync(path.join(dir, 'SlotForge-Timing-auto-2026-11-04-200000.slotforge-backup', 'manifest.json'), '{}');
  ['my-own-backup.json', 'SlotForge-Timing-auto-notes.txt', 'SlotForge-Timing-auto-2026-11-01.json'].forEach(n =>
    fs.writeFileSync(path.join(dir, n), 'x')
  );
  assert.deepEqual(AB.prune(dir, 2), [names[1], names[0]]);
  assert.deepEqual(fs.readdirSync(dir).sort(), [
    'SlotForge-Timing-auto-2026-11-01.json',
    'SlotForge-Timing-auto-2026-11-03-200000.json',
    'SlotForge-Timing-auto-2026-11-04-200000.slotforge-backup',
    'SlotForge-Timing-auto-notes.txt',
    'my-own-backup.json'
  ]);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('a run makes the backup, keeps the newest, says what happened; a failure leaves no half backup; a race waits', async () => {
  const dir = tmp(),
    stateFile = path.join(dir, 'state', 'auto-backup.json');
  let t = Date.parse('2026-11-10T19:00:00Z'),
    fail = false,
    busy = '';
  const changes = [];
  const ab = AB.createAutoBackup({
    settings: () => ({ autoBackup: { keep: 2, folder: path.join(dir, 'out') } }),
    defaultFolder: path.join(dir, 'unused'),
    stateFile,
    busy: () => busy,
    now: () => t,
    make: async target => {
      fs.writeFileSync(target, fail ? 'half' : '{"app":"slotforge-timing-backup"}');
      if (fail) throw Error('Disk full');
    },
    onChange: st => changes.push(st)
  });
  for (let i = 0; i < 3; i++) {
    const r = await ab.run();
    assert.equal(r.ok, true);
    t += 24 * 3600e3;
  }
  assert.equal(AB.own(path.join(dir, 'out')).length, 2);
  assert.equal(ab.status().count, 2);
  assert(ab.status().bytes > 0);
  fail = true;
  const bad = await ab.run();
  assert.equal(bad.ok, false);
  assert.equal(bad.error, 'Disk full');
  assert.equal(AB.own(path.join(dir, 'out')).length, 2, 'the failed one is gone, the good ones stay');
  assert.equal(ab.status().lastAt, new Date(t - 24 * 3600e3).toISOString(), 'the last good one is still named');
  assert.equal(await ab.tick(), null, 'a failure is not tried again at once');
  fail = false;
  busy = 'a race is open';
  t += 7 * 3600e3;
  assert.deepEqual(await ab.tick(), { skipped: 'a race is open' });
  busy = '';
  assert.equal((await ab.tick()).ok, true);
  assert(changes.length >= 5);
  fs.rmSync(dir, { recursive: true, force: true });
});

// ---- records of races the shared library does not have ----
test('a faster record of a race that did not reach the library replaces the library one; it never counts twice', () => {
  const lib = [
    { id: 'L1', trackId: 't1', driverId: 'a', time: 5000 },
    { id: 'L2', trackId: 't2', driverId: 'a', time: 6000 }
  ];
  const local = [
    { id: 'P1', trackId: 't1', driverId: 'a', time: 4900, pendingLibrary: true },
    { id: 'P2', trackId: 't2', driverId: 'a', time: 6100, pendingLibrary: true },
    { id: 'P3', trackId: 't3', driverId: 'a', time: 7000, pendingLibrary: true }
  ];
  assert.deepEqual(
    SR.mergeRecords('tracks', lib, local, false).map(r => r.id),
    ['P1', 'L2'],
    'not the last page: a track that is not on it may be on the next one'
  );
  assert.deepEqual(
    SR.mergeRecords('tracks', lib, local, true).map(r => r.id),
    ['P1', 'L2', 'P3']
  );
  assert.deepEqual(
    SR.mergeRecords('personal', lib, [{ id: 'P4', trackId: 't1', driverId: 'b', time: 4000 }], true).map(r => r.id),
    ['L1', 'L2', 'P4'],
    'personal bests are per driver'
  );
});

test('only the sessions of this computer that the library does not have (or has an older copy of) count', async () => {
  const lap = (id, sessionId, time, trackId = 't1', driverId = 'a') => ({ id, sessionId, time, trackId, driverId });
  const base = {
    historyPage: async () => ({
      revision: 'r1',
      tracks: {
        items: [lap('1', 'sent', 4000), lap('2', 'held', 4500, 't2'), lap('3', 'new', 4600, 't3'), lap('4', 'gone', 3000, 't4')],
        next: null
      },
      personal: { items: [lap('5', 'held', 4500, 't2')], next: null },
      refs: { tracks: [], drivers: [], slotcars: [], sessions: [] }
    }),
    historySession: async (pool, id) => ({ deliveryStatus: { sent: 'delivered', held: 'attention', gone: null }[id] || null })
  };
  const rows = { sent: { state: 'active' }, held: { state: 'active' }, gone: { state: 'withdrawn' } };
  const client = {
    installationId: 'me',
    status: async () => ({ databaseId: 'db', recoveryId: 'rc' }),
    handle: { timingRead: async o => ({ databaseId: 'db', recoveryId: 'rc', row: rows[o.sessionId] || null }) }
  };
  const r = await SR.undeliveredRecords(base, client, 'racing', 'tok');
  assert.deepEqual(
    r.tracks.map(x => x.id),
    ['2', '3']
  );
  assert(r.tracks.every(x => x.pendingLibrary));
  assert.deepEqual(
    r.personal.map(x => x.id),
    ['5']
  );
  const one = await SR.undeliveredRecords(base, client, 'racing', 'tok', { trackId: 't3' });
  assert.deepEqual(
    one.tracks.map(x => x.id),
    ['3']
  );
});

// ---- sharing results ----
const st = [
  { pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Alex', carName: 'NSR Ford GT40', laps: 3, best: 5000, total: 16000 },
  { pos: 2, driverId: 'd2', carId: 'c2', driverName: '=Sam, "the rocket"', carName: 'Slot.it Porsche', laps: 2, best: 5600, total: 12000 }
];
const session = {
  id: 's1',
  setupName: 'Friday Sprint',
  sessionType: 'race',
  trackName: 'Living room',
  date: '2026-10-11T18:30:00Z',
  standings: st
};
const laps = [
  { driverId: 'd1', carId: 'c1', lapNumber: 1, time: 5200 },
  { driverId: 'd1', carId: 'c1', lapNumber: 2, time: 5000 },
  { driverId: 'd2', carId: 'c2', lapNumber: 1, time: 5600 },
  { driverId: 'd2', carId: 'c2', lapNumber: 2, time: 4800, invalid: true }
];

test('the CSV has the results table as the PDF has it, safe for a spreadsheet', () => {
  const csv = R.sessionCsv({ session, laps });
  assert(csv.startsWith('\ufeff'), 'Excel reads accents right');
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[0], 'Friday Sprint,Race,Living room,11 October 2026 at 20:30');
  assert.match(lines[2], /^Pos,Driver,Car,Laps,Best lap,Total time/);
  assert.match(lines[3], /^1,Alex,NSR Ford GT40,3,5\.000,16\.000/);
  assert.match(lines[4], /^2,"'=Sam, ""the rocket""",Slot\.it Porsche,2,5\.600/, 'quoted, and a leading = is not run as a formula');
  const t = R.sessionTable({ session, laps });
  assert.equal(t.rows.length, 2);
  assert(!t.rows.flat().some(c => /<|&amp;/.test(c)), 'plain text, no HTML');
});

test('the text for a chat has the podium, the laps and the fastest valid lap', () => {
  const txt = R.sessionText({ session, laps });
  assert.equal(
    txt,
    [
      '🏁 Friday Sprint · Living room',
      '11 October 2026 at 20:30',
      '',
      '🥇 Alex (NSR Ford GT40) · 3 laps, best 5.000',
      '🥈 =Sam, "the rocket" (Slot.it Porsche) · 2 laps, best 5.600',
      '',
      '⏱ Fastest lap: Alex, 5.000'
    ].join('\n')
  );
  assert.equal(R.shareName({ setupName: 'A/B race', date: session.date }, 'csv'), 'A-B race 2026-10-11.csv');
});

test('the web page is the report, readable on a phone, and the PDF report did not change its table', () => {
  const h = R.sessionHtml({ session, laps });
  assert(h.includes('<meta name="viewport" content="width=device-width, initial-scale=1">'));
  assert(h.includes('<td>=Sam, &quot;the rocket&quot;</td>'), 'escaped in HTML');
  assert(/<svg[^>]*>.*<\/svg> Alex<\/td>/.test(h), 'the cup is still next to the winner');
});

// ---- driver progress ----
test('driver progress: per track and month, the best, the average of the real pace, the consistency and the change', () => {
  const L = (time, date, more = {}) => ({ trackId: 't1', time, date, sessionId: date.slice(0, 10), ...more });
  const laps = [
    L(5400, '2026-09-05T19:00:00Z'),
    L(5500, '2026-09-05T19:01:00Z'),
    L(5600, '2026-09-05T19:02:00Z'),
    L(9000, '2026-09-05T19:03:00Z'), // (a crash: more than 130% of the best, not pace)
    L(5100, '2026-10-03T19:00:00Z'),
    L(5150, '2026-10-03T19:01:00Z'),
    L(5200, '2026-10-03T19:02:00Z'),
    L(4000, '2026-10-03T19:03:00Z', { invalid: true }),
    L(5000, '2026-10-03T19:04:00Z', { pit: true }),
    { trackId: 't2', time: 7000, sessionId: 'x' } // (the date comes from the session)
  ];
  const p = DP.progress(laps, {
    dateOf: sid => (sid === 'x' ? '2026-10-10T18:00:00Z' : ''),
    trackName: id => ({ t1: 'Club oval', t2: 'Garage' })[id]
  });
  assert.equal(p.laps, 8);
  assert.equal(p.sessions, 3);
  const t1 = p.tracks[0];
  assert.equal(t1.name, 'Club oval');
  assert.deepEqual(
    t1.months.map(m => [m.month, m.laps, m.best, m.avg, m.median]),
    [
      ['2026-09', 4, 5400, 5500, 5500],
      ['2026-10', 3, 5100, 5150, 5150]
    ]
  );
  assert(t1.months[1].consistency > t1.months[0].consistency, 'steadier in October');
  assert.deepEqual({ best: t1.change.best, avg: t1.change.avg }, { best: 300, avg: 350 });
  assert.equal(p.tracks[1].change, null, 'one month: no trend yet');
  const html = DPV.html(p);
  assert.match(html, /Since Sep 2026: the best lap is 0\.300 s faster, the average is 0\.350 s faster; [\d.]+ points steadier\./);
  assert(html.includes('<svg class="dp-chart"'), 'a chart for two months or more');
  // 2.4.0 Record Card: the figures as tiles, the trend as chips (better is up), the months folded away
  assert(html.includes('<span class="dp-tile"><b>8</b><small>clean laps</small></span>'), 'the clean laps as a tile');
  assert(html.includes('<span class="dp-chip up">Best 0.300 s faster</span>') && html.includes('<span class="dp-chip up">Average 0.350 s faster</span>'), 'the trend as chips');
  assert(html.includes('<details class="dp-months"><summary>Month by month · 2 months</summary>'), 'the months folded away');
  assert(html.includes('<p class="dp-legend">') && !DPV.html({ laps: 1, sessions: 1, tracks: [{ name: 'X', best: 5000, laps: 1, months: [{ month: '2026-10', laps: 1, best: 5000, avg: 5000, consistency: null }], change: null }] }).includes('dp-legend'), 'a legend with the chart, none for one month');
  assert.match(DPV.html(null), /No laps yet/);
});

test('driver progress from JSON storage reads the laps of that driver only', () => {
  const db = {
    data: {
      drivers: [{ id: 'a' }, { id: 'b' }],
      tracks: [{ id: 't1', name: 'Club oval' }],
      sessions: [{ id: 's', date: '2026-11-01T19:00:00Z' }],
      laps: [
        { driverId: 'a', trackId: 't1', sessionId: 's', time: 5000 },
        { driverId: 'b', trackId: 't1', sessionId: 's', time: 4000 },
        { driverId: 'a', trackId: 't1', sessionId: 's', time: 5100, token: true }
      ]
    }
  };
  const p = DP.jsonDriver(db, 'a');
  assert.equal(p.laps, 1);
  assert.equal(p.tracks[0].best, 5000);
  assert.equal(DP.jsonDriver(db, 'nobody'), null);
});
