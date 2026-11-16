// 1.68.0: a leaderboard that counts over the rounds of a championship: what the earlier rounds left behind (Season.past) and where everybody stands if the race that is racing now ended now (Season.now).
const C = require('../renderer/championship.js'), P = require('../renderer/champpoints.js'), S = require('../renderer/season.js'), E = require('../renderer/engine.js');
let fails = 0; const ok = (m, c) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const tracks = [{ id: 't1', name: 'Short', lanes: 2, length: 10, laneModifier: 'measured', laneLengths: '10, 12' }, { id: 't2', name: 'No lengths', lanes: 2 }];
const rec = over => C.clean({ id: 'ch1', name: 'Club Cup', rounds: [
  { id: 'r1', name: 'One', track: 't1', date: '', sessions: [{ id: 'a0', setup: 'sq', share: 100 }, { id: 'a1', setup: 'sr', share: 100 }] },
  { id: 'r2', name: 'Two', track: 't1', date: '', sessions: [{ id: 'b1', setup: 'sr', share: 100 }] },
  { id: 'r3', name: 'Three', track: 't1', date: '', sessions: [{ id: 'c1', setup: 'sr', share: 100 }] }],
  roster: [{ driver: 'd1', team: 'tm1' }, { driver: 'd2', team: 'tm1' }, { driver: 'd3', team: 'tm2' }], ...over }, true);
const raw = rec(), c = C.clean(raw, true);
const tag = (ri, si, extra) => ({ id: 'ch1', name: 'Club Cup', round: ri + 1, roundId: ['r1', 'r2', 'r3'][ri], session: si + 1, sessionId: [['a0', 'a1'], ['b1'], ['c1']][ri][si], kind: ri === 0 && si === 0 ? 'qualifying' : 'race', share: 100, ...(extra || {}) });
const row = (pos, d, o) => ({ pos, driverId: d, driverName: d.toUpperCase(), laps: 3, best: 5000 + pos * 100, ...(o || {}) });
const sess = (id, date, ri, si, rows, extra) => ({ id, date, trackId: 't1', standings: rows, champ: tag(ri, si, { awarded: '2026-10-01T00:00:00Z', ...(extra || {}) }) });
const lap = (sessionId, driverId, n, time, o) => ({ sessionId, driverId, trackId: 't1', lane: 1, lapNumber: n, time, ...(o || {}) });

// round 1: qualifying (does not count), the race a1 (counts); round 2: the race b1 (counts); an earlier run of the race of round 3 (c1), which the race that is racing now replaces
const sessions = [
  sess('Q1', '2026-10-01T10:00:00Z', 0, 0, [row(1, 'd2'), row(2, 'd1')]),
  sess('R1', '2026-10-01T12:00:00Z', 0, 1, [row(1, 'd1', { laps: 3, best: 5000, adjMs: 500 }), row(2, 'd2', { laps: 2, best: 5300, penalty: 2000 }), row(3, 'd3', { laps: 3, best: 5500, adjLaps: 1 })]),
  sess('R2', '2026-10-08T12:00:00Z', 1, 0, [row(1, 'd2', { best: 4900 }), row(2, 'd1', { best: 5200 })]),
  sess('R3old', '2026-10-15T12:00:00Z', 2, 0, [row(1, 'd3'), row(2, 'd1')]),
  { ...sess('R2x', '2026-10-09T12:00:00Z', 1, 0, [row(1, 'd3')]), champ: tag(1, 0, { off: true }) }, // (set to "do not count": not driven, as far as the championship goes; the one of the same date above is the latest)
  { id: 'N1', date: '2026-10-02T12:00:00Z', trackId: 't1', standings: [row(1, 'd1')] } // (not a race of the championship)
];
const laps = [
  lap('R1', 'd1', 1, 5000), lap('R1', 'd1', 2, 5100, { pit: true }), lap('R1', 'd1', 3, 5200),
  lap('R1', 'd2', 1, 5300), lap('R1', 'd2', 2, 5400, { invalid: true }),
  lap('R1', 'd3', 1, 5500, { lane: 2 }), lap('R1', 'd3', 2, 5600, { lane: 2, tooSlow: true }), lap('R1', 'd3', 3, 5700, { lane: 2 }),
  lap('R2', 'd1', 1, 5200), lap('R2', 'd1', 2, 5250.12345), lap('R2', 'd2', 1, 4900), lap('R2', 'd2', 2, 5000),
  lap('Q1', 'd1', 1, 4000), lap('R3old', 'd1', 1, 4100), lap('X', 'd1', 1, 1)
];
const people = [{ driverId: 'd1', teamId: 'tm1' }, { driverId: 'd2', teamId: 'tm1' }, { driverId: 'd3', teamId: 'tm2' }, { driverId: 'd4', teamId: '' }]; // (the participants of the race: d4 is not in the championship)
const T3 = tag(2, 0);

// ---- of(): the races whose board can count over the rounds ----
ok('a race of a round that gives points has a championship to count over (the record is cleaned, with the id)', !!S.of(raw, T3) && S.of(raw, T3).c.id === 'ch1' && S.of(raw, T3).tag === T3);
ok('...a qualifying or a practice does not', S.of(raw, tag(0, 0)) === null && S.of(raw, { ...T3, kind: 'practice' }) === null);
ok('...nor a race of a championship that is not there, a tag of another championship, a round or session that was deleted, nor a race that gives no points', S.of(null, T3) === null && S.of(raw, null) === null && S.of(raw, { ...T3, id: 'zz' }) === null && S.of(raw, { ...T3, roundId: 'gone' }) === null && S.of(raw, { ...T3, sessionId: 'gone' }) === null
  && S.of(rec({ rounds: raw.rounds.map((r, i) => (i === 2 ? { ...r, sessions: [{ ...r.sessions[0], share: 0 }] } : r)) }), T3) === null);
ok('...a record that is not an object is no championship', S.of('x', T3) === null && S.of([], T3) === null && S.of(raw, 'x') === null);

// ---- counted(): the earlier races that count ----
const cnt = S.counted(c, sessions, T3);
ok('the races that count are the awarded races of the championship, the earliest first: here round 1 and round 2', same(cnt.map(s => s.id), ['R1', 'R2']));
ok('...a qualifying does not count, nor a race that is not awarded yet, nor a race that is set to "do not count", nor a session that is not of the championship', !cnt.some(s => ['Q1', 'R2x', 'N1'].includes(s.id)) && S.counted(c, [{ ...sessions[1], champ: { ...sessions[1].champ, awarded: undefined } }], T3).length === 0);
ok('...an earlier run of this very race is left out (the race that is racing now takes its place), and when it is not the same session it is counted', !cnt.some(s => s.id === 'R3old') && same(S.counted(c, sessions, tag(1, 0)).map(s => s.id), ['R1', 'R3old']) && S.counted(c, sessions, tag(0, 1)).map(s => s.id).join() === 'R2,R3old');
ok('...no sessions at all, or a list that is not a list, count for nothing', S.counted(c, [], T3).length === 0 && S.counted(c, null, T3).length === 0);
ok('others() leaves out the sessions of the same round and session and keeps all the rest', S.others(c, sessions, T3).length === sessions.length - 1 && S.others(c, sessions, tag(0, 1)).length === sessions.length - 1 && S.others(c, null, T3).length === 0);

// ---- past(): what the earlier rounds left behind ----
const pa = S.past(c, sessions, laps, T3, people, tracks), by = p => pa.find(x => x.p === p);
ok('every participant who took part in an earlier round has an entry, the one who did not has none (d4)', pa.length === 3 && !by(3) && [0, 1, 2].every(p => !!by(p)));
ok('d1: the laps of the results (3 + 3, as the results say), the best of the two races, and the lap times that count (the lap with a pit stop is not one of them)', by(0).laps === 6 && by(0).best === 5000 && same(by(0).valid, [5000, 5200, 5200, 5250.123]));
ok('...the lap times are in milliseconds with 3 decimals, as the heats of 1.67.0 keep them', by(0).valid.every(t => t === Math.round(t * 1000) / 1000));
ok('...the time is that of the saved laps (the lap with a pit stop counts for the time), and with the penalties it has what the Race Director added (500) on top', by(0).t1 === 5000 + 5100 + 5200 + 5200 + 5250.123 && by(0).t0 === by(0).t1 + 500);
ok('d2: 2 + 3 laps, the best 4900, the invalid lap is not one that counts for the average, and the penalty time of the result (2000) is on top of the time with penalties', by(1).laps === 5 && by(1).best === 4900 && same(by(1).valid, [5300, 4900, 5000]) && by(1).t1 === 5300 + 5400 + 4900 + 5000 && by(1).t0 === by(1).t1 + 2000);
ok('d3 raced in round 1 only: the lap that was too slow is not one that counts; the lap in the second lane is 12 m', by(2).laps === 3 && by(2).best === 5500 && same(by(2).valid, [5500, 5700]) && by(2).dist === 3 * 12 + 12); // (3 laps of 12 m, and the lap that was added by the Race Director in the lane of the last lap)
ok('...the metres of d1: the laps of the first lane (10 m) in both races, 5 laps saved', by(0).dist === 50 && by(1).dist === 40);
ok('...a race on a track without lane lengths has no metres: the total cannot be added up, so there is none', !('dist' in S.past(c, sessions, laps, T3, people, [{ id: 't1', name: 'x', lanes: 2 }])[0]) && !('dist' in S.past(c, sessions, laps, T3, people, [])[0]));
ok('a lap that has its own track is measured on that track (the track of the session is the other one)', (() => { const q = S.past(c, sessions, laps.map(l => (l.sessionId === 'R2' && l.driverId === 'd2' ? { ...l, trackId: 't2' } : l)), T3, people, tracks); return !('dist' in q.find(x => x.p === 1)) && q.find(x => x.p === 0).dist === 50; })());
ok('the laps of a driver are those of the saved laps of the session of his row: laps of the same driver in other sessions (the qualifying, the old run of this race) do not count', !by(0).valid.includes(4000) && !by(0).valid.includes(4100) && by(0).laps === 6);
ok('a participant is found by his driver, or by his team when he races as a team: a team that raced as a team in an earlier round has the row of the team, a driver does not match a row of a team', (() => {
  const ts = sessions.concat([sess('T1', '2026-10-09T12:00:00Z', 1, 0, [{ pos: 1, asTeam: true, driverId: '', teamId: 'tm1', driverName: 'Foxes', laps: 4, best: 4800, drivers: [] }, row(2, 'd3')])]);
  const tl = laps.concat([{ sessionId: 'T1', teamId: 'tm1', driverId: 'd1', trackId: 't1', lane: 1, lapNumber: 1, time: 4800 }, { sessionId: 'T1', teamId: 'tm1', driverId: 'd2', trackId: 't1', lane: 1, lapNumber: 2, time: 4900 }]);
  const q = S.past(c, ts, tl, T3, [{ driverId: '', teamId: 'tm1', asTeam: true }, { driverId: 'd1', teamId: 'tm1' }, { driverId: 'd3', teamId: 'tm2' }], tracks);
  return q.find(x => x.p === 0) && q.find(x => x.p === 0).laps === 4 && q.find(x => x.p === 0).best === 4800 && same(q.find(x => x.p === 0).valid, [4800, 4900]) && q.find(x => x.p === 1).laps === 3 && !q.find(x => x.p === 1).valid.includes(4800)
    && q.find(x => x.p === 2).laps === 6; })()); // (the team session T1 is the latest of round 2: it replaces R2 there, so d1 has R1 only (3 laps: the row of the team is not his), and d3 has R1 (3 laps) and his row of T1 (3 laps))
ok('a participant without a driver or a team (a guest of the heats, nothing to find) has nothing', S.past(c, sessions, laps, T3, [{ driverId: '', teamId: '' }, { driverId: '', teamId: '', asTeam: true }], tracks).length === 0);
ok('no sessions, no laps, no participants, no tracks: nothing and no error', S.past(c, [], laps, T3, people, tracks).length === 0 && S.past(c, sessions, null, T3, people, tracks).every(x => x.valid.length === 0) && S.past(c, sessions, laps, T3, [], tracks).length === 0 && S.past(c, sessions, laps, T3, people, null).length === 3);
ok('the result of past() is plain data (it goes to another window as text)', same(JSON.parse(JSON.stringify(pa)), pa));

// ---- found by the mutation check: who is who in a saved result, laps that are not laps, the order of the sessions, the laps that were added in the review ----
ok('rowOf: a team is the row of that team only (not the row of another team, not the row of a driver who carries the id of the team); a driver is his own row', (() => {
  const rows = [{ pos: 1, asTeam: true, teamId: 'tm2', driverId: '' }, { pos: 2, driverId: 'd1', teamId: 'tm1' }, { pos: 3, asTeam: true, teamId: 'tm1', driverId: '' }];
  return S.rowOf(rows, { asTeam: true, teamId: 'tm1' }) === rows[2] && S.rowOf(rows.slice(0, 2), { asTeam: true, teamId: 'tm1' }) === null && S.rowOf(rows, { driverId: 'd1', teamId: 'tm1' }) === rows[1]
    && S.rowOf(rows, { asTeam: true, teamId: '' }) === null && S.rowOf(null, { driverId: 'd1' }) === null && S.rowOf(rows, { driverId: '' }) === null; })());
ok('laps that are not laps in the list of saved laps (nothing, an empty object, a number) are skipped: the result is the same', same(S.past(c, sessions, laps.concat([null, {}, 5, undefined]), T3, people, tracks), pa));
ok('the sessions are used in the order of their dates, whatever the order they are in the list (the lap times that count come in that order)', same(S.past(c, sessions.slice().reverse(), laps, T3, people, tracks), pa) && same(S.past(c, sessions.slice().reverse(), laps, T3, people, tracks).find(x => x.p === 0).valid, [5000, 5200, 5200, 5250.123]));
ok('laps added in the review of a race of which no laps are saved: the metres cannot be known, so there are none (a total of 0 m would be wrong); the laps of the result are there', (() => {
  const q = S.past(c, sessions, laps.filter(l => l.driverId !== 'd3'), T3, people, tracks).find(x => x.p === 2); return !!q && q.laps === 3 && !('dist' in q) && q.valid.length === 0; })());

ok('a race of the championship that gives no points (a share of 0) is not an earlier round that counts', (() => {
  const c0 = C.clean(rec({ rounds: raw.rounds.map((r, i) => (i === 0 ? { ...r, sessions: [r.sessions[0], { ...r.sessions[1], share: 0 }] } : r)) }), true);
  return same(S.counted(c0, sessions, T3).map(x => x.id), ['R2']) && S.past(c0, sessions, laps, T3, people, tracks).find(x => x.p === 0).laps === 3; })());
ok('a result with no best lap (0) or no time (a lap of 0) does not make a best lap or a lap that counts', (() => {
  const ss = sessions.map(x => (x.id === 'R1' ? { ...x, standings: x.standings.map(r => (r.driverId === 'd1' ? { ...r, best: 0 } : r)) } : x)), q = S.past(c, ss, laps.concat([lap('R1', 'd1', 4, 0)]), T3, people, tracks).find(x => x.p === 0);
  return q.best === 5200 && !q.valid.includes(0) && q.valid.length === 4; })());

// ---- now(): the standings, with this race counted as if it ended now ----
// the points after rounds 1 and 2 (25 18 15 ...): d1: 25 + 18 = 43, d2: 18 + 25 = 43, d3: guests of nothing: 15 in round 1 as the third of three; but with the roster d3 is in (team tm2)
const before = P.standings(c, S.others(c, sessions, T3)), tot = id => before.drivers.find(d => d.id === id).total;
ok('(the standings of the championship from the earlier races: d1, d2 and d3 have points, by the table and the places)', tot('d1') > 0 && tot('d2') > 0 && tot('d3') > 0);
const live = [{ pos: 1, driverId: 'd3', driverName: 'D3', laps: 2, best: 5100 }, { pos: 2, driverId: 'd1', driverName: 'D1', laps: 2, best: 5200 }, { pos: 3, driverId: 'd2', driverName: 'D2', laps: 1, best: 5300 }, { pos: 4, driverId: 'd4', driverName: 'D4', laps: 1, best: 5400 }];
const nw = S.now(c, sessions, T3, people, live);
const ptsOf = (res, p) => res.pts.find(x => x[0] === p);
ok('the points now are the points before plus what the race is worth as it stands (d3 first: 25, d1 second: 18, d2 third: 15), as the Standings page would say after the race', ptsOf(nw, 2)[2] === tot('d3') && ptsOf(nw, 2)[1] === tot('d3') + 25 && ptsOf(nw, 0)[1] === tot('d1') + 18 && ptsOf(nw, 1)[1] === tot('d2') + 15);
ok('...a participant who is not in the championship (a guest) has no points, now or before', ptsOf(nw, 3)[1] === null && ptsOf(nw, 3)[2] === null);
{ const st = P.standings(c, S.others(c, sessions, T3).concat([{ id: 'x', date: '9999', champ: { ...T3, awarded: 'now' }, standings: live }])); ok('...and that is exactly what the standings of the championship say when this race is saved and awarded', st.drivers.every(d => ptsOf(nw, ['d1', 'd2', 'd3'].indexOf(d.id))[1] === d.total)); }
ok('the order of the board is the order of the standings (the one with the most points first), the guest after all of them', same(nw.order.map(x => x[0]), nw.order.map(x => x[0]).slice().sort((a, b) => (ptsOf(nw, b)[1] ?? -1) - (ptsOf(nw, a)[1] ?? -1) || a - b)) && nw.order[nw.order.length - 1][0] === 3 && nw.order.every((x, i) => x[1] === ptsOf(nw, x[0])[1]));
ok('...every participant is in the order once', nw.order.length === 4 && same(nw.order.map(x => x[0]).slice().sort(), [0, 1, 2, 3]));
ok('no race yet (nothing driven): the points now are the points before, and the order is the order of the standings', (() => { const r0 = S.now(c, sessions, T3, people, null), r1 = S.now(c, sessions, T3, people, []); return same(r0, r1) && r0.pts.every(x => x[1] === x[2]) && r0.order.length === 4 && r0.order[3][0] === 3; })());
ok('a championship without any earlier race: everybody has 0 before, the race that is racing gives the points, the order is that of the race while the points are level', (() => {
  const r = S.now(c, [], T3, people, live), v = p => ptsOf(r, p);
  return v(2)[2] === 0 && v(2)[1] === 25 && v(0)[1] === 18 && v(1)[1] === 15 && same(r.order.map(x => x[0]), [2, 0, 1, 3]); })());
ok('a guest who stays out of the points is behind everybody, in the order of the race (here the guest d4 is 4th in the race and last in the order, d3 is first)', S.now(c, [], T3, people, live).order[3][0] === 3);
ok('guests (not in the championship) stay behind the others, in the order of the race', (() => {
  const pp = people.concat([{ driverId: 'd5', teamId: '' }, { driverId: 'd6', teamId: '' }]), rows = [{ pos: 1, driverId: 'd3', driverName: 'D3', laps: 2, best: 5100 }, { pos: 2, driverId: 'd1', driverName: 'D1', laps: 2, best: 5200 }, { pos: 3, driverId: 'd2', driverName: 'D2', laps: 2, best: 5300 },
    { pos: 4, driverId: 'd6', driverName: 'D6', laps: 1, best: 5400 }, { pos: 5, driverId: 'd5', driverName: 'D5', laps: 1, best: 5500 }, { pos: 6, driverId: 'd4', driverName: 'D4', laps: 1, best: 5600 }];
  return same(S.now(c, [], T3, pp, rows).order.map(x => x[0]), [2, 0, 1, 5, 4, 3]) && same(S.now(c, [], T3, pp, null).order.map(x => x[0]), [0, 1, 2, 3, 4, 5]); })());
ok('a result with no place (0) is not a place: such a guest is behind the guest who has one', (() => {
  const pp = people.concat([{ driverId: 'd5', teamId: '' }]), rows = [{ pos: 1, driverId: 'd3', driverName: 'D3', laps: 2, best: 5100 }, { pos: 0, driverId: 'd4', driverName: 'D4', laps: 1, best: 5600 }, { pos: 5, driverId: 'd5', driverName: 'D5', laps: 1, best: 5500 }];
  return same(S.now(c, [], T3, pp, rows).order.map(x => x[0]).slice(-2), [4, 3]); })());
ok('level on points: the rules of the championship decide (more wins first), then the order of the race, then the roster (a championship with no earlier race and no live race: the order of the roster)', same(S.now(c, [], T3, people, null).order.map(x => x[0]), [0, 1, 2, 3]));
ok('the live race is a race of its own place: an earlier run of this session in the saved sessions does not count twice (d3 won the old run of round 3, and the new race has d3 second)', (() => {
  const l2 = [{ pos: 1, driverId: 'd1', driverName: 'D1', laps: 2, best: 5000 }, { pos: 2, driverId: 'd3', driverName: 'D3', laps: 2, best: 5100 }];
  const r = S.now(c, sessions, T3, people, l2); return ptsOf(r, 2)[1] === tot('d3') + 18 && ptsOf(r, 0)[1] === tot('d1') + 25; })());
ok('a car that is out gets nothing for its place (a disqualified car, a retired car), the places behind move up', (() => {
  const l3 = [{ pos: 1, driverId: 'd1', driverName: 'D1', laps: 2, best: 5000, dq: true }, { pos: 2, driverId: 'd2', driverName: 'D2', laps: 2, best: 5100 }, { pos: 3, driverId: 'd3', driverName: 'D3', laps: 2, best: 5200, retired: true }];
  const r = S.now(c, [], T3, people, l3); return ptsOf(r, 0)[1] === 0 && ptsOf(r, 1)[1] === 25 && ptsOf(r, 2)[1] === 0; })());
ok('the bonuses of the championship are in it (a point for the fastest lap), and the dropped results (the worst of the rounds does not count)', (() => {
  const c2 = C.clean(rec({ bonusFast: 2 }), true), r = S.now(c2, [], T3, people, live); return ptsOf(r, 2)[1] === 27 && ptsOf(r, 0)[1] === 18; // (the fastest lap of the finishers is d3's 5100)
})() && (() => {
  const c3 = C.clean(rec({ drops: 1 }), true), r = S.now(c3, sessions, T3, people, live), st = P.standings(c3, S.others(c3, sessions, T3).concat([{ id: 'x', date: '9999', champ: { ...T3, awarded: 'now' }, standings: live }]));
  return st.drivers.every(d => ptsOf(r, ['d1', 'd2', 'd3'].indexOf(d.id))[1] === d.total); })());
ok('a sprint (a race of 50%) gives half of the points', (() => {
  const c4 = C.clean(rec({ rounds: raw.rounds.map((r, i) => (i === 2 ? { ...r, sessions: [{ ...r.sessions[0], share: 50 }] } : r)) }), true), t4 = { ...T3, share: 50 }, r = S.now(c4, [], t4, people, live);
  return ptsOf(r, 2)[1] === 13 && ptsOf(r, 0)[1] === 9; })()); // (25 and 18 at half, rounded to the nearest: 12.5 -> 13, 9)
ok('a team that races as a team has the points of the Teams standings; a driver the points of the Drivers standings', (() => {
  const tp = [{ driverId: '', teamId: 'tm1', asTeam: true }, { driverId: '', teamId: 'tm2', asTeam: true }, { driverId: 'd1', teamId: 'tm1' }];
  const rows = [{ pos: 1, asTeam: true, driverId: '', teamId: 'tm2', driverName: 'Arrows', laps: 3, best: 5000, bestBy: 'd3', drivers: [{ driverId: 'd3', driverName: 'D3', laps: 3 }] }, { pos: 2, asTeam: true, driverId: '', teamId: 'tm1', driverName: 'Foxes', laps: 3, best: 5200, bestBy: 'd1', drivers: [{ driverId: 'd1', driverName: 'D1', laps: 2 }, { driverId: 'd2', driverName: 'D2', laps: 1 }] }];
  const r = S.now(c, [], T3, tp, rows); return ptsOf(r, 1)[1] === 25 && ptsOf(r, 0)[1] === 18 && ptsOf(r, 2)[1] === 18 && same(r.order.map(x => x[0]), [1, 0, 2].sort((a, b) => ptsOf(r, b)[1] - ptsOf(r, a)[1] || a - b)); })());
ok('a championship without team points has no points for a team that races as a team (null, not 0)', (() => {
  const c5 = C.clean(rec({ teamMode: 'none' }), true), r = S.now(c5, [], T3, [{ driverId: '', teamId: 'tm1', asTeam: true }], [{ pos: 1, asTeam: true, driverId: '', teamId: 'tm1', driverName: 'Foxes', laps: 3, best: 5200, bestBy: '', drivers: [] }]);
  return r.pts[0][1] === null && r.pts[0][2] === null; })());
ok('the result is plain data, and every participant has one entry in pts (in the order of the participants)', same(JSON.parse(JSON.stringify(nw)), nw) && same(nw.pts.map(x => x[0]), [0, 1, 2, 3]));
ok('no participants: an empty order, no error', same(S.now(c, sessions, T3, [], live), { order: [], pts: [] }));

// ---- the stamp of a race (a short text that changes when the result changes) ----
{ const q = E.createRace({ type: 'race', laps: 3, endRule: 'all', entries: [{ lane: 0, driverId: 'd1', driverName: 'A' }, { lane: 1, driverId: 'd2', driverName: 'B' }] }); q.start(100000);
  const s0 = E.stampOf(q); q.cross(0, 100000 + 5000); const s1 = E.stampOf(q); q.cross(1, 100000 + 5100); const s2 = E.stampOf(q);
  ok('stampOf(race) changes with every lap, and stays the same when nothing changes', s0 !== s1 && s1 !== s2 && E.stampOf(q) === s2 && typeof s0 === 'string');
  q.adjust(0, { laps: 1 }); ok('...and with what the Race Director corrects', E.stampOf(q) !== s2); }

console.log(fails ? fails + ' SEASON TESTS FAILED' : 'ALL SEASON TESTS PASSED'); process.exit(fails ? 1 : 0);
