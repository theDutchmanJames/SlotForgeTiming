'use strict';
// 2.4.0: Results and Records as a Record Book (renderer/recordbook.js, database/recordbookview.js, SlotForgeRestyle.md "Record Book"): track records as cards
// with their history, the races by month with filters, a driver's history, a result corrected after it was saved (also in SQLite), the list as CSV.
const test = require('node:test'),
  assert = require('node:assert/strict');
const R = require('../renderer/recordbook.js');
const { code, has } = require('./source.cjs');

const S = (id, date, type, trackId, rows, o = {}) => ({
  id,
  date,
  sessionType: type,
  trackId,
  trackName: trackId === 't1' ? 'Club Oval' : 'Garage Ring',
  setupName: o.name || 'Club night',
  standings: rows,
  ...o
});
const row = (pos, driverId, best, o = {}) => ({
  pos,
  driverId,
  driverName: { a: 'Anna', b: 'Bjorn', c: 'Chris' }[driverId],
  carId: 'c' + driverId,
  carName: 'Car ' + driverId,
  laps: 20,
  total: 100000 + pos * 1000,
  best,
  ...o
});
const sessions = [
  S('s1', '2026-09-01T19:00:00Z', 'race', 't1', [row(1, 'a', 5200), row(2, 'b', 5300)]),
  S('s2', '2026-10-01T19:00:00Z', 'practice', 't1', [row(1, 'b', 5100), row(2, 'a', 5150)]),
  S('s3', '2026-11-10T19:00:00Z', 'race', 't1', [row(1, 'b', 5050), row(2, 'a', 4990), row(3, 'c', 5500)], {
    champ: { id: 'ch1', round: 5 }
  }),
  S('s4', '2026-11-12T19:00:00Z', 'heats', 't2', [row(1, 'c', 6000), row(2, 'a', 6100)]),
  { id: 'tok', date: '2026-11-13T10:00:00Z', sessionType: 'tokens', standings: [] }
];

test('the history of a track record: each time it was beaten, a lap taken out of the records left out, the record of now at the end', () => {
  const h = R.history(sessions, 't1', { time: 5050, driverId: 'b', driverName: 'Bjorn', date: '2026-11-10T19:00:00Z', sessionId: 's3' });
  assert.deepEqual(
    h.map(x => [x.time, x.name]),
    [
      [5200, 'Anna'],
      [5100, 'Bjorn'],
      [5050, 'Bjorn']
    ],
    "Anna's 4.990 was taken out of the records, so it is not in the history"
  );
  const card = R.recordCard(
    { track: { id: 't1', name: 'Club Oval', lanes: 4 }, races: 3, history: h },
    { now: '2026-11-11T19:00:00Z', trackSvg: () => '<svg></svg>', helmet: () => '' }
  );
  assert.match(card, /^<article class="rb-rec" data-rec="t1"/);
  assert.match(card, /<span class="rb-new">New<\/span>/);
  assert.match(card, /<div class="rb-time">5\.050<\/div>/);
  assert.match(card, /Beaten 2×/);
  assert.match(card, /data-rec-more="t1" aria-haspopup="menu"/);
  assert.doesNotMatch(card, /danger|Remove/);
});

test('the filters: track, driver, kind, period and search; the kinds with counts; the months; a row', () => {
  const now = '2026-11-20T12:00:00Z';
  assert.deepEqual(
    R.filter(sessions, {}, now).map(s => s.id),
    ['s4', 's3', 's2', 's1'],
    'newest first, no token stints'
  );
  assert.deepEqual(
    R.filter(sessions, { track: 't1', driver: 'c' }, now).map(s => s.id),
    ['s3']
  );
  assert.deepEqual(
    R.filter(sessions, { kind: 'champ' }, now).map(s => s.id),
    ['s3']
  );
  assert.deepEqual(
    R.filter(sessions, { period: 'month' }, now).map(s => s.id),
    ['s4', 's3']
  );
  assert.deepEqual(
    R.filter(sessions, { q: 'chris' }, now).map(s => s.id),
    ['s4', 's3'],
    'a driver name finds their races'
  );
  assert.deepEqual(
    R.kinds(R.filter(sessions, {}, now)).map(k => k.id + ':' + k.n),
    ['all:4', 'race:2', 'heats:1', 'practice:1', 'champ:1']
  );
  assert.deepEqual(
    R.months(R.filter(sessions, {}, now)).map(g => g.label + ':' + g.sessions.length),
    ['November 2026:2', 'October 2026:1', 'September 2026:1']
  );
  const r = R.rowHtml(sessions[2], { champName: () => 'Winter Cup' });
  assert.match(r, /^<button type="button" class="rb-row" data-open-race="s3">/);
  assert.match(r, /<span class="rb-tag ch">Winter Cup · R5<\/span>/);
  assert.match(r, /<span class="rb-pos p1">1<\/span><b>Bjorn<\/b><\/span><small>Anna · Chris<\/small>/);
  assert.match(r, /<span class="rb-best">4\.990/);
  assert.match(R.rowHtml(sessions[1]), /<b>Bjorn<\/b><\/span><small>fastest<\/small>/, 'practice: the fastest, not a winner');
});

test("a driver's history: races, wins, podiums, best lap, form, the places as a line; the list and the driver as CSV", () => {
  const d = R.driver(sessions, 'a');
  assert.deepEqual([d.races, d.wins, d.podiums, d.best, d.last], [4, 1, 3, 4990, '2026-11-12T19:00:00Z']);
  assert.deepEqual(d.form, [2, 2, 1], 'races and heats only, newest first');
  const line = R.formLine([2, 1, 3]);
  assert.equal(line.points.length, 3);
  assert.equal(line.points[0].pos, 3, 'oldest on the left');
  const csv = R.csv(R.filter(sessions, {}, '2026-11-20T12:00:00Z'));
  assert.match(csv, /^Date,Session,Kind,Track,Championship round,Winner,Second,Third,Best lap,Best lap by\r\n/);
  assert.match(csv, /2026-11-10 19:00,Club night,Race,Club Oval,5,Bjorn,Anna,Chris,4\.990,Anna\r\n/);
  assert.match(R.driverCsv(d, 'Anna'), /2026-11-12 19:00,Club night,Heats,Garage Ring,2,20,6\.100,/);
});

test('correct a saved result: time added, laps taken, a car out; the new order; what is saved and what the report says', () => {
  const s = sessions[2];
  assert.equal(R.canCorrect(s), true);
  assert.equal(R.canCorrect(sessions[3]), false, 'heats take their order from the heats');
  assert.equal(R.canCorrect({ ...s, resultBy: 'points' }), false);
  const time = R.correct(s.standings, { 0: { ms: 1500 } });
  assert.deepEqual(
    time.map(x => [x.driverId, x.pos, x.wasPos]),
    [
      ['a', 1, 2],
      ['b', 2, 1],
      ['c', 3, 3]
    ]
  );
  assert.equal(time.find(x => x.driverId === 'b').adjMs, 1500);
  const laps = R.correct(s.standings, { 0: { laps: 2 } });
  assert.deepEqual([laps[2].driverId, laps[2].laps, laps[2].adjLaps], ['b', 18, -2]);
  const out = R.correct(s.standings, { 1: { dq: true } });
  assert.deepEqual(
    out.map(x => x.driverId + (x.dq ? ' out' : '')),
    ['b', 'c', 'a out']
  );
  const c = R.correction(s, { 0: { ms: 1500 } }, 'Jump start', '2026-11-20T10:00:00Z');
  assert.deepEqual(
    c.standings.map(x => [x.driverId, x.pos, 'wasPos' in x]),
    [
      ['a', 1, false],
      ['b', 2, false],
      ['c', 3, false]
    ]
  );
  assert.deepEqual(c.entry, {
    date: '2026-11-20T10:00:00Z',
    reason: 'Jump start',
    changes: [
      { driverId: 'a', name: 'Anna', from: 2, to: 1 },
      { driverId: 'b', name: 'Bjorn', from: 1, to: 2, ms: 1500 }
    ]
  });
  assert.equal(R.correctionText({ correction: [c.entry] }), 'Corrected on 20 Nov: Jump start (Anna 2 → 1, Bjorn 1 → 2).');
});

test('the page: the Record Book for Racing Records, a race opened in place, Correct the result, and the backends that save it', () => {
  const res = code('renderer/database/results.js'),
    view = code('renderer/database/recordbookview.js'),
    html = code('renderer/index.html');
  assert(
    has(
      res,
      "if (pool === 'racing' && api.historyPage && typeof RecordBook !== 'undefined' && typeof renderRecordBook === 'function') return renderRecordBook(body);"
    )
  );
  assert(has(res, 'if (supplied && supplied.only) box.innerHTML = sessionCards;'), 'a race opened from the book shows only its report');
  assert(has(res, 'data-correct=') && has(res, 'return rbCorrect(corr.dataset.correct, reload);'));
  assert(has(res, 'RecordBook.correctionText(s)'), 'the report says it was corrected');
  assert(
    has(view, "await api.update('laps', lapId, isTrack ? { noTrackRecord: true } : { noPersonalBest: true });"),
    'take a lap out of the records, from a menu'
  );
  assert(has(view, "rbSaveCsv(RecordBook.csv(list), 'SlotForge results.csv')"));
  assert(
    html.indexOf('recordbook.js') < html.indexOf('database/results.js') &&
      html.indexOf('database/recordbookview.js') > html.indexOf('database/results.js')
  );
  assert(has(code('sqlite-records.js'), 'function correctResult(s, { sessionId, standings, correction, expectedRevision }) {'));
  assert(has(code('sqlite-app-repository.js'), "await this.commands.execute(commandId, 'correctResult', {"));
  assert(
    has(
      code('sqlite-editor-save.js'),
      "command('correctResult', { sessionId: id, standings: value.standings, correction: value.correction || [], expectedRevision });"
    )
  );
});
