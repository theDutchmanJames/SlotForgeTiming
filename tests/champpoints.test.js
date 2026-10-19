// 1.56.0: championship points (champpoints.js and the rules in championship.js): the rules of the record, what a race gives (table, bonuses, guests, cars that are out, sprints),
// the standings (rounds, dropped results, teams, ties), the sentences ("Maria leads by 5") and what the panel after a race says.
const C = require('../renderer/championship.js'), P = require('../renderer/champpoints.js');
let fails = 0; const ok = (n, c) => { if (c) console.log('ok  ', n); else { console.log('FAIL', n); fails++; } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const setups = [{ id: 'sp', name: 'Practice', sessionType: 'practice' }, { id: 'sq', name: 'Qualifying', sessionType: 'qualifying' }, { id: 'sr', name: 'Race', sessionType: 'race' }, { id: 'se', name: 'Day race', sessionType: 'endurance' }];
const ctx = { setups, tracks: [{ id: 't1', name: 'Brands Hatch' }] };

// ---------- the rules in the record ----------
{ const b = C.blank();
  ok('a new championship has the 25-18-15 table, no bonuses, no dropped results, the best 2 drivers of a team, ties by wins, a sprint rounded to the nearest',
    same(b.points, [25, 18, 15, 12, 10, 8, 6, 4, 2, 1]) && b.pointsMode === 'table' && b.pointsRest === 0 && b.bonusFast === 0 && b.bonusFastTop === 10 && b.bonusPole === 0 && b.bonusStart === 0 && b.drops === 0
    && b.teamMode === 'best' && b.teamBest === 2 && b.tie === 'wins' && b.sprintRound === 'nearest' && b.guestRule === true);
  ok('...cleaning a clean record changes nothing, an old record (without the rules) gets the defaults', same(C.clean(b, true), { ...b }) && same(C.clean({ name: 'Old', rounds: [], roster: [], guestRule: false }).points, C.DEFAULT_POINTS) && C.clean({ guestRule: false }).guestRule === false);
  const w = C.clean({ points: [5, '3', -1, 'a', 5000, ' 2.456 '], pointsRest: '0.5', bonusFast: 'x', bonusFastTop: 0, bonusPole: -3, bonusStart: 1.239, drops: 99, teamBest: 0, tie: 'zzz', teamMode: 'zzz', sprintRound: 'zzz', pointsMode: 'zzz' });
  ok('clean: the places hold numbers from 0 to 1000 with two decimals (a number that is not one is 0), a table has at most 20 places and at least 1', same(w.points, [5, 3, 0, 0, 1000, 2.46]) && C.clean({ points: Array.from({ length: 30 }, () => 1) }).points.length === 20 && same(C.clean({ points: [] }).points, C.DEFAULT_POINTS) && same(C.clean({ points: 'x' }).points, C.DEFAULT_POINTS));
  ok('...the other numbers are kept in range (fastest lap places 1 to 99, drops 0 to 10, team drivers 1 to 20), the kinds are one of the known ones', w.pointsRest === 0.5 && w.bonusFast === 0 && w.bonusFastTop === 1 && w.bonusPole === 0 && w.bonusStart === 1.24 && w.drops === 10 && w.teamBest === 1
    && w.tie === 'wins' && w.teamMode === 'best' && w.sprintRound === 'nearest' && w.pointsMode === 'table' && C.clean({ bonusFastTop: 500 }).bonusFastTop === 99 && C.clean({ drops: -4 }).drops === 0 && C.clean({ teamBest: 99 }).teamBest === 20 && C.clean({ drops: 2.9 }).drops === 2);
  ok('...the kinds that are allowed', C.clean({ tie: 'last' }).tie === 'last' && C.clean({ tie: 'qual' }).tie === 'qual' && C.clean({ teamMode: 'all' }).teamMode === 'all' && C.clean({ teamMode: 'none' }).teamMode === 'none' && ['up', 'down', 'none'].every(m => C.clean({ sprintRound: m }).sprintRound === m) && C.clean({ pointsMode: 'beaten' }).pointsMode === 'beaten');
  ok('presetOf: the ready-made tables are found by their numbers, anything else is "own", one point per car beaten is its own mode', C.presetOf(b) === 'f1' && C.presetOf(C.applyPreset(b, 'ten').rec) === 'ten' && C.presetOf(C.applyPreset(b, 'beaten').rec) === 'beaten'
    && C.presetOf(C.setPlace(b, 0, 26).rec) === 'own' && C.presetOf(C.setRule(b, 'pointsRest', 1).rec) === 'own');
  const ten = C.applyPreset(b, 'ten').rec;
  ok('applyPreset: a table replaces the numbers (and the points for the rest), "My own" keeps the numbers and uses the table, an unknown one is refused, the old record is left alone',
    same(ten.points, [10, 8, 6, 5, 4, 3, 2, 1]) && ten.pointsMode === 'table' && C.applyPreset(C.setRule(b, 'pointsRest', 2).rec, 'f1').rec.pointsRest === 0 && C.applyPreset(C.applyPreset(b, 'beaten').rec, 'own').rec.pointsMode === 'table'
    && same(C.applyPreset(C.applyPreset(b, 'beaten').rec, 'own').rec.points, b.points) && C.applyPreset(b, 'zzz').error && same(b.points, C.DEFAULT_POINTS));
  ok('...going to "One point per car beaten" keeps the numbers of the table for when it is changed back', same(C.applyPreset(b, 'beaten').rec.points, b.points));
  ok('setPlace: a place gets a number (two decimals, 0 to 1000), a text that is not a number or a place that is not there is refused', C.setPlace(b, 1, '17.556').rec.points[1] === 17.56 && C.setPlace(b, 1, 5000).rec.points[1] === 1000 && C.setPlace(b, 1, -2).rec.points[1] === 0 && C.setPlace(b, 1, 'x').error && C.setPlace(b, 1, '').error && C.setPlace(b, 10, 1).error && C.setPlace(b, -1, 1).error && b.points[1] === 18);
  ok('addPlace / removePlace: one place more (0 points) up to 20, one less down to 1', C.addPlace(b).rec.points.length === 11 && C.addPlace(b).rec.points[10] === 0 && C.addPlace(C.clean({ points: Array.from({ length: 20 }, () => 1) })).error && C.removePlace(b).rec.points.length === 9 && C.removePlace(C.clean({ points: [4] })).error);
  ok('setRule: one rule at a time, cleaned like everything; the record keeps its id; a number that is not one, or a rule that is not one, is refused', C.setRule({ ...b, id: 'k1' }, 'drops', '3').rec.drops === 3 && C.setRule({ ...b, id: 'k1' }, 'drops', 3).rec.id === 'k1' && C.setRule(b, 'drops', 'x').error && C.setRule(b, 'drops', '').error && C.setRule(b, 'name', 'x').error
    && C.setRule(b, 'tie', 'last').rec.tie === 'last' && C.setRule(b, 'guestRule', false).rec.guestRule === false && C.setRule(b, 'bonusFast', '1.5').rec.bonusFast === 1.5 && C.setRule(b, 'bonusFastTop', 500).rec.bonusFastTop === 99 && C.setRule(b, 'teamMode', 'none').rec.teamMode === 'none' && b.drops === 0);
  ok('...a kind that is not a kind is refused too', C.setRule(b, 'tie', 'zzz').error && C.setRule(b, 'teamMode', 'zzz').error && C.setRule(b, 'sprintRound', 'zzz').error && C.setRule(b, 'pointsMode', 'zzz').error && !C.setRule(b, 'sprintRound', 'up').error); }

// ---------- examples ----------
// four drivers (a and c in team T1, b and d in T2), three rounds of qualifying + race
const champ = (over, n) => C.clean({ name: 'Cup', rounds: Array.from({ length: n || 3 }, (_, i) => ({ name: 'Round ' + (i + 1), track: 't1', sessions: [{ setup: 'sp' }, { setup: 'sq' }, { setup: 'sr' }] })),
  roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2' }, { driver: 'c', team: 'T1' }, { driver: 'd', team: 'T2' }], ...(over || {}), id: 'c1' }, true);
const R = (pos, id, best, extra) => ({ pos, driverId: id, driverName: id.toUpperCase(), carId: 'car' + id, laps: 10, best: best === undefined ? 9000 + pos : best, total: 100000 + pos, ...(extra || {}) });
let sid = 0;
// a saved session of round ri (0 based), session si (0 practice, 1 qualifying, 2 race), awarded unless said otherwise
const S = (c, ri, si, rows, o) => { o = o || {}; const n = ++sid, tag = C.tagOf(c, ri, si, ctx);
  return { id: 's' + n, date: o.date || `2026-10-${String(10 + n).padStart(2, '0')}T12:00:00.000Z`, standings: rows, champ: { ...tag, ...(o.awarded === false ? {} : { awarded: '2026-10-20T10:00:00.000Z' }), ...(o.off ? { off: true } : {}) } }; };
const race = (c, ri, ids, o) => S(c, ri, 2, ids.map((x, i) => (typeof x === 'string' ? R(i + 1, x) : x)), o);
const pts = (res, id) => res.rows.find(x => x.driverId === id).pts;
const all = res => res.rows.map(x => x.pts).join();
const withRule = (c, key, v) => C.setRule(c, key, v).rec;

// ---------- what a race gives ----------
{ const c = champ();
  const r = P.sessionResult(c, race(c, 0, ['a', 'b', 'c', 'd']), null);
  ok('a race gives the points of the table to the finishing places', r.ok && all(r) === '25,18,15,12' && r.rows.map(x => x.place).join() === '1,2,3,4' && r.rows.map(x => x.base).join() === '25,18,15,12' && r.share === 100 && r.round === 1);
  ok('...the order of the result decides (not the order of the rows)', all(P.sessionResult(c, S(c, 0, 2, [R(3, 'c'), R(1, 'a'), R(4, 'd'), R(2, 'b')]), null)) === '25,18,15,12'
    && P.sessionResult(c, S(c, 0, 2, [R(3, 'c'), R(1, 'a'), R(4, 'd'), R(2, 'b')]), null).rows.map(x => x.driverId).join('') === 'abcd');
  const few = C.clean({ ...withRule(c, 'pointsRest', 1), points: [5, 3] }, true);
  ok('every finisher after the last place of the table gets the points for the rest', same(few.points, [5, 3]) && all(P.sessionResult(few, race(few, 0, ['a', 'b', 'c', 'd']), null)) === '5,3,1,1');
  ok('...a table with more places than there are cars gives the points to those who are there', all(P.sessionResult(c, race(c, 0, ['a', 'b']), null)) === '25,18');
  const beaten = C.applyPreset(c, 'beaten').rec;
  ok('one point per car beaten: the cars behind you, the first of four gets 3', all(P.sessionResult(beaten, race(beaten, 0, ['a', 'b', 'c', 'd']), null)) === '3,2,1,0');
  ok('...a car that is out was beaten too (so the finisher in front of it gets its point), and a car that is out gets nothing', all(P.sessionResult(beaten, race(beaten, 0, ['a', 'b', R(3, 'c', 9000, { retired: true }), R(4, 'd', 9000, { dq: true })]), null)) === '3,2,0,0');
  ok('...a guest is not a car that was beaten (the guest rule on)', all(P.sessionResult(beaten, race(beaten, 0, ['a', R(2, 'z'), 'b', 'c', 'd']), null)) === '3,2,1,0');

  // cars that are out
  const out = flag => P.sessionResult(c, race(c, 0, [R(1, 'a'), R(2, 'b', 9000, flag), R(3, 'c'), R(4, 'd', 9000, { failureOut: 'Out' })]), null);
  ok('a car that retired, was disqualified, or is out by damage or a failure gets no points for its place; the cars behind move up', all(out({ retired: true })) === '25,0,18,0'
    && all(out({ dq: true })) === '25,0,18,0' && all(out({ damageOut: 'Out' })) === '25,0,18,0' && all(out({ failureOut: 'Out' })) === '25,0,18,0');
  ok('...it has no place, and says why', out({ retired: true }).rows[1].place === 0 && out({ retired: true }).rows[1].out && out({ retired: true }).rows[1].outText === 'Out' && out({ dq: true }).rows[1].outText === 'DQ' && out({ damageOut: 1 }).rows[1].outText === 'Out (damage)' && out({ failureOut: 1 }).rows[1].outText === 'Out (failure)' && out({ retired: true }).rows[2].place === 2 && out({ retired: true }).rows[0].outText === '');
  const st1 = withRule(c, 'bonusStart', 2);
  ok('the bonus for starting goes to every driver, also one who retired, but not to one who was disqualified', all(P.sessionResult(st1, race(st1, 0, [R(1, 'a'), R(2, 'b', 9000, { retired: true }), R(3, 'c', 9000, { dq: true }), R(4, 'd')]), null)) === '27,2,0,20'
    && P.sessionResult(st1, race(st1, 0, ['a', 'b', 'c', 'd']), null).rows.every(x => x.start === 2));

  // guests
  const roster3 = champ({ roster: [{ driver: 'a' }, { driver: 'b' }, { driver: 'c' }, { driver: 'd' }] }), withGuest = ['a', R(2, 'z'), 'b', 'c', 'd'];
  const g = P.sessionResult(roster3, race(roster3, 0, withGuest), null);
  ok('a guest (not in the roster) gets no points, and the drivers behind him move up (the guest rule on)', all(g) === '25,18,15,12' && g.rows.map(x => x.driverId).join('') === 'abcd' && g.guests.join() === 'Z' && g.rows.every(x => !x.guest));
  const g2 = P.sessionResult(withRule(roster3, 'guestRule', false), race(roster3, 0, withGuest), null);
  ok('...with the rule off the guest keeps his place, nobody moves up, and he gets nothing', all(g2) === '25,0,15,12,10' && g2.rows[1].guest && g2.rows[1].driverId === 'z' && g2.rows[1].place === 2 && g2.guests.length === 0);
  const late = champ({ roster: [{ driver: 'a' }, { driver: 'b' }, { driver: 'c' }, { driver: 'd', from: 3 }] });
  ok('a driver who joins in round 3 is a guest in rounds 1 and 2 and counts from round 3', all(P.sessionResult(late, race(late, 1, ['a', 'd', 'b', 'c']), null)) === '25,18,15' && P.sessionResult(late, race(late, 1, ['a', 'd', 'b', 'c']), null).guests.join() === 'D'
    && all(P.sessionResult(late, race(late, 2, ['a', 'd', 'b', 'c']), null)) === '25,18,15,12');
  ok('...the start bonus is not for a guest', all(P.sessionResult(withRule(roster3, 'bonusStart', 1), race(roster3, 0, withGuest), null)) === '26,19,16,13' && P.sessionResult(withRule(withRule(roster3, 'bonusStart', 1), 'guestRule', false), race(roster3, 0, withGuest), null).rows[1].start === 0);

  // fastest lap
  const fl = withRule(withRule(c, 'bonusFast', 1), 'bonusFastTop', 3), lap = (b1, b2, b3, b4, ex) => race(fl, 0, [R(1, 'a', b1), R(2, 'b', b2, ex && ex.b), R(3, 'c', b3), R(4, 'd', b4, ex && ex.d)]);
  const f1 = P.sessionResult(fl, lap(9000, 8000, 9500, 9900), null);
  ok('the fastest lap of the race gives its bonus to the driver, when he finishes in the first places', all(f1) === '25,19,15,12' && f1.rows[1].fastest === 1 && f1.fastest.driverId === 'b' && f1.fastest.got && f1.fastest.ms === 8000);
  const f2 = P.sessionResult(fl, lap(9000, 8800, 9500, 7000), null);
  ok('...when the fastest lap is by a driver further back, nobody gets it (it is not passed on)', all(f2) === '25,18,15,12' && f2.fastest.driverId === 'd' && !f2.fastest.got);
  ok('...the limit is the place, so a car that is out in front does not use a place up', all(P.sessionResult(fl, race(fl, 0, [R(1, 'a', 9000), R(2, 'b', 9100, { retired: true }), R(3, 'c', 9200), R(4, 'd', 7000)]), null)) === '25,0,18,16');
  ok('...a lap of a car that is out does not count, nor a car without a lap', all(P.sessionResult(fl, lap(9000, 5000, 9500, 9900, { b: { retired: true } }), null)) === '26,0,18,15' && P.sessionResult(fl, lap(9000, 5000, 9500, 9900, { b: { retired: true } }), null).fastest.driverId === 'a'
    && all(P.sessionResult(fl, lap(9000, null, 0, 9900), null)) === '26,18,15,12');
  ok('...a tie goes to the driver who finished in front', all(P.sessionResult(fl, lap(9000, 8000, 8000, 9900), null)) === '25,19,15,12');
  const flg = race(fl, 0, [R(1, 'a', 9000), R(2, 'z', 100), R(3, 'b', 9500), R(4, 'c', 9900), R(5, 'd', 9900)]);
  ok('...the lap of a guest does not count (the guest rule on)', all(P.sessionResult(fl, flg, null)) === '26,18,15,12' && P.sessionResult(fl, flg, null).fastest.driverId === 'a');
  const flg2 = P.sessionResult(withRule(fl, 'guestRule', false), flg, null);
  ok('...with the rule off the guest has the fastest lap and nobody gets the bonus', flg2.fastest.driverId === 'z' && !flg2.fastest.got && flg2.rows.every(x => x.fastest === 0));
  ok('...with no bonus (0 points) nobody gets one', all(P.sessionResult(withRule(fl, 'bonusFast', 0), lap(9000, 8000, 9500, 9900), null)) === '25,18,15,12' && !P.sessionResult(withRule(fl, 'bonusFast', 0), lap(9000, 8000, 9500, 9900), null).fastest.got);

  // pole
  const pl = withRule(c, 'bonusPole', 3), qual = (rows, o) => S(pl, 0, 1, rows, o);
  const q1 = qual([R(1, 'c', 8000), R(2, 'a', 8100), R(3, 'b', 8200), R(4, 'd', 8300)]);
  const p1 = P.sessionResult(pl, race(pl, 0, ['a', 'b', 'c', 'd']), q1);
  ok('the driver who was fastest in qualifying gets the pole bonus', all(p1) === '25,18,18,12' && p1.rows[2].pole === 3 && p1.pole.driverId === 'c' && p1.pole.got);
  ok('...there is none without a qualifying session', all(P.sessionResult(pl, race(pl, 0, ['a', 'b', 'c', 'd']), null)) === '25,18,15,12' && P.sessionResult(pl, race(pl, 0, ['a', 'b', 'c', 'd']), null).pole === null);
  const p2 = P.sessionResult(pl, race(pl, 0, ['a', 'b', 'd']), q1);
  ok('...he has to start the race (the bonus is not passed on to the next in qualifying)', all(p2) === '25,18,15' && !p2.pole.got && p2.pole.driverId === 'c');
  ok('...a driver who was disqualified from the race does not get it', all(P.sessionResult(pl, race(pl, 0, ['a', 'b', R(3, 'c', 9000, { dq: true }), 'd']), q1)) === '25,18,0,15');
  const qg = qual([R(1, 'z', 7000), R(2, 'c', 8000), R(3, 'a', 8100)]);
  ok('...a guest on pole gives it to the first driver of the roster (the guest rule on); with the rule off nobody gets it', P.sessionResult(pl, race(pl, 0, ['a', 'b', 'c', 'd']), qg).pole.driverId === 'c' && all(P.sessionResult(pl, race(pl, 0, ['a', 'b', 'c', 'd']), qg)) === '25,18,18,12'
    && !P.sessionResult(withRule(pl, 'guestRule', false), race(pl, 0, ['a', 'b', 'c', 'd']), qg).pole.got && P.sessionResult(withRule(pl, 'guestRule', false), race(pl, 0, ['a', 'b', 'c', 'd']), qg).pole.driverId === 'z');
  ok('...a driver without a lap in qualifying is not on pole', P.sessionResult(pl, race(pl, 0, ['a', 'b', 'c', 'd']), qual([R(1, 'c', null), R(2, 'a', 0), R(3, 'b', 8200)])).pole.driverId === 'b');
  ok('...with no bonus (0 points) nobody gets one', all(P.sessionResult(withRule(pl, 'bonusPole', 0), race(pl, 0, ['a', 'b', 'c', 'd']), q1)) === '25,18,15,12');
  { const two = C.clean({ ...pl, rounds: [{ name: 'x', sessions: [{ setup: 'sq' }, { setup: 'sq' }, { setup: 'sr' }] }] }, true);
    const qa = S(two, 0, 0, [R(1, 'a', 8000)]), qb = S(two, 0, 1, [R(1, 'b', 8000)]), qoff = S(two, 0, 1, [R(1, 'b', 8000)], { off: true });
    ok('the qualifying session of a round is the last one that was driven (one that is not counted is not driven)', P.qualifyingOf(two, [qa, qb], 0) === qb && P.qualifyingOf(two, [qa], 0) === qa && P.qualifyingOf(two, [qa, qoff], 0) === qa && P.qualifyingOf(two, [], 0) === null && P.qualifyingOf(two, [qa], 5) === null);
    const cc = champ(), other = S(cc, 1, 1, [R(1, 'a')]);
    ok('...a qualifying session of another round or of another championship is not it', P.qualifyingOf(cc, [other], 0) === null && P.qualifyingOf(cc, [other], 1) === other && P.qualifyingOf(cc, [{ ...other, champ: { ...other.champ, id: 'other' } }], 1) === null); }
  { const all2 = C.setRule(C.setRule(C.setRule(c, 'bonusFast', 1).rec, 'bonusPole', 2).rec, 'bonusStart', 1).rec, q2 = S(all2, 0, 1, [R(1, 'a', 8000)]);
    ok('the bonuses come on top of the points of the place (pole for a, the fastest lap for b, the start for all)', all(P.sessionResult(all2, race(all2, 0, [R(1, 'a', 9000), R(2, 'b', 8000), R(3, 'c', 9500), R(4, 'd', 9900)]), q2)) === '28,20,16,13'); }

  // sprints
  const sp = (mode, share) => { let x = C.setSession(c, 0, 2, { share: share === undefined ? 50 : share }).rec; return withRule(x, 'sprintRound', mode); };
  const raw = ['a', 'b', 'c', 'd'];
  ok('a race at 50% gives half of the points, rounded to the nearest (a half goes up)', all(P.sessionResult(sp('nearest'), race(sp('nearest'), 0, raw), null)) === '13,9,8,6');
  ok('...rounded up', all(P.sessionResult(sp('up'), race(sp('up'), 0, raw), null)) === '13,9,8,6');
  ok('...rounded down', all(P.sessionResult(sp('down'), race(sp('down'), 0, raw), null)) === '12,9,7,6');
  ok('...not rounded', all(P.sessionResult(sp('none'), race(sp('none'), 0, raw), null)) === '12.5,9,7.5,6');
  ok('...rounding up and down only matter when there is something to round (18 halved is 9 either way)', all(P.sessionResult(sp('up'), race(sp('up'), 0, ['b', 'a']), null)) === '13,9' && all(P.sessionResult(sp('down'), race(sp('down'), 0, ['b', 'a']), null)) === '12,9');
  ok('...the bonuses are halved with the rest', all(P.sessionResult(withRule(withRule(sp('none'), 'bonusFast', 1), 'bonusFastTop', 4), race(sp('none'), 0, [R(1, 'a', 9000), R(2, 'b', 8000), R(3, 'c', 9500), R(4, 'd', 9900)]), null)) === '12.5,9.5,7.5,6');
  { const dec = C.setPlace(c, 0, 12.5).rec;
    ok('...a full race is not rounded at all (also with decimals in the table)', P.sessionResult(dec, race(dec, 0, raw), null).rows[0].pts === 12.5 && all(P.sessionResult(sp('nearest', 100), race(sp('nearest', 100), 0, raw), null)) === '25,18,15,12'); }
  ok('a race that counts for nothing (0%) gives no points', P.sessionResult(sp('nearest', 0), race(sp('nearest', 0), 0, raw), null).reason === 'noshare');
  ok('...the share is the one the championship says now, not the one the race was saved with (a full race that is a sprint now, and the other way round)', race(c, 0, raw).champ.share === 100 && all(P.sessionResult(sp('nearest'), race(c, 0, raw), null)) === '13,9,8,6'
    && all(P.sessionResult(c, { ...race(c, 0, raw), champ: { ...race(c, 0, raw).champ, share: 50 } }, null)) === '25,18,15,12');

  // what is not scored
  const pr = P.sessionResult(c, S(c, 0, 0, [R(1, 'a')]), null), qq = P.sessionResult(c, S(c, 0, 1, [R(1, 'a')]), null);
  ok('only a race gives points: a practice and a qualifying say what they are', !pr.ok && pr.reason === 'practice' && !qq.ok && qq.reason === 'qualifying');
  const tm = C.clean({ ...c, rounds: [{ name: 'x', sessions: [{ setup: 'se' }] }] }, true), teamsRace = S(tm, 0, 0, [{ pos: 1, driverId: '', driverName: 'Team A', asTeam: true, drivers: [{ driverId: 'a' }] }]);
  ok('a race that was driven by teams (an Endurance Race) has no drivers to give points to', P.sessionResult(tm, teamsRace, null).reason === 'teams' && P.awardView(tm, teamsRace, [teamsRace], ctx).state === 'teams');
  ok('a session of a round that is not in the championship any more, or of another championship, gives nothing', P.sessionResult(c, { ...race(c, 0, raw), champ: { ...race(c, 0, raw).champ, roundId: 'gone' } }, null).reason === 'notfound' && P.sessionResult(c, { id: 'x', standings: [] }, null).reason === 'notfound'
    && P.sessionResult(c, { ...race(c, 0, raw), champ: { ...race(c, 0, raw).champ, id: 'other' } }, null).reason === 'notfound');
  ok('rows without a driver (a team row) are left out, the rest is scored', all(P.sessionResult(c, S(c, 0, 2, [R(1, 'a'), { pos: 2, driverId: '', driverName: 'Team', asTeam: false }, R(3, 'b')]), null)) === '25,18'); }

// ---------- the standings ----------
{ const c = champ(), nm = P.standings(c, [], ctx);
  ok('with nothing awarded: every driver of the roster at 0, every round open, nothing decided, no lead sentence', nm.drivers.length === 4 && nm.drivers.every(d => d.total === 0 && d.cells.length === 3 && d.cells.every(x => x.state === 'open')) && nm.decided === 0 && nm.total === 3 && nm.cols.length === 3 && P.leadText(nm) === '' && P.remainingNote(c, nm, setups) === ''
    && nm.drivers.map(d => d.id).join('') === 'abcd' && nm.drivers.map(d => d.pos).join() === '1,2,3,4');
  const r1 = race(c, 0, ['a', 'b', 'c', 'd']), r2 = race(c, 1, ['b', 'a', 'd', 'c']);
  const st = P.standings(c, [r1, r2], ctx), by = id => st.drivers.find(d => d.id === id);
  ok('the points of the rounds are added up per driver', by('a').total === 43 && by('b').total === 43 && by('c').total === 27 && by('d').total === 27 && by('a').cells.map(x => x.pts).join() === '25,18,' && st.decided === 2 && st.last === 2);
  ok('...a round that was not driven yet is open, a round that was driven is a score', by('a').cells.map(x => x.state).join() === 'score,score,open' && st.cols.map(x => x.decided).join() === 'true,true,false' && st.cols.map(x => x.label).join() === 'R1,R2,R3');
  ok('...the positions are 1, 2, 3, 4 (a tie still has an order), and the points behind the leader are worked out', st.drivers.map(d => d.pos).join() === '1,2,3,4' && st.drivers.map(d => d.behind).join() === '0,0,-16,-16');
  ok('...wins and the places they were got in', by('a').wins === 1 && by('a').places.join() === '1,1' && by('c').places.join() === ',,1,1' && by('b').wins === 1);
  ok('a session that is not awarded does not count, a session that is not counted does not count, a session of another championship does not count',
    P.standings(c, [r1, race(c, 1, ['b', 'a', 'd', 'c'], { awarded: false })], ctx).decided === 1 && P.standings(c, [r1, race(c, 1, ['b', 'a', 'd', 'c'], { off: true })], ctx).decided === 1
    && P.standings(c, [r1, { ...r2, champ: { ...r2.champ, id: 'other' } }], ctx).decided === 1 && P.standings(c, [r1, { ...r2, champ: { ...r2.champ, roundId: 'gone' } }], ctx).decided === 1);
  const again = race(c, 0, ['d', 'c', 'b', 'a'], { date: '2027-01-01T00:00:00.000Z' });
  ok('a race that was driven again and awarded again replaces the first one (the latest counts), also in any order of the list', P.standings(c, [r1, again], ctx).drivers.find(d => d.id === 'd').total === 25 && P.standings(c, [again, r1], ctx).drivers.find(d => d.id === 'd').total === 25 && P.standings(c, [r1, again], ctx).drivers.find(d => d.id === 'a').total === 12);
  ok('...a second run that is not awarded does not replace the first, which stays awarded', P.standings(c, [r1, race(c, 0, ['d', 'c', 'b', 'a'], { date: '2027-01-01T00:00:00.000Z', awarded: false })], ctx).drivers.find(d => d.id === 'a').total === 25);
  ok('the names come from the drivers of the database, else from the saved result', by('a').name === 'A' && P.standings(c, [r1], { ...ctx, drivers: [{ id: 'a', name: 'Maria' }] }).drivers.find(d => d.id === 'a').name === 'Maria' && P.standings(c, [], { drivers: [] }).drivers[0].name === '(removed driver)');
  const sw = P.standings(c, [r1, S(c, 0, 1, [R(1, 'a')]), S(c, 0, 0, [R(1, 'a')])], ctx);
  ok('a practice and a qualifying in the round change nothing (and the round is driven by the race only)', sw.decided === 1 && sw.drivers.find(d => d.id === 'a').total === 25);
  ok('a driver who is not in the roster is not in the standings', P.standings(c, [race(c, 0, ['a', R(2, 'z'), 'b', 'c', 'd'])], ctx).drivers.length === 4 && P.standings(c, [race(c, 0, ['a', R(2, 'z'), 'b', 'c', 'd'])], ctx).drivers.map(d => d.total).join() === '25,18,15,12');

  // columns: rounds without a race
  const mix = C.clean({ ...c, rounds: [{ name: 'a', sessions: [{ setup: 'sp' }, { setup: 'sr' }] }, { name: 'b', sessions: [{ setup: 'sp' }] }, { name: 'c', sessions: [{ setup: 'sr', share: 0 }] }, { name: 'd', sessions: [] }, { name: 'e', sessions: [{ setup: 'sr', share: 50 }] }] }, true);
  ok('only the rounds with a race that counts are columns (when the race setups are known; else every round with a session that counts), and they keep the number of their round', P.standings(mix, [], ctx).cols.map(x => x.label).join() === 'R1,R5' && P.standings(mix, [], {}).cols.map(x => x.label).join() === 'R1,R2,R5');

  // late joiners
  const lt = champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2', from: 2 }] });
  const ls = P.standings(lt, [race(lt, 0, ['a', 'b']), race(lt, 1, ['b', 'a'])], ctx);
  ok('a driver who joins later has n/a before that round, is a guest there (gets nothing), and scores from then on', ls.drivers.find(d => d.id === 'b').cells.map(x => x.state).join() === 'na,score,open' && ls.drivers.find(d => d.id === 'b').total === 25 && ls.drivers.find(d => d.id === 'a').total === 43
    && ls.drivers.find(d => d.id === 'b').cells[0].pts === undefined);

  // dropped results
  const dr = champ({ drops: 1 }), pl = (a, b, c3, d) => [a, b, c3, d];
  const d1 = [race(dr, 0, ['a', 'b', 'c', 'd']), race(dr, 1, ['b', 'c', 'd', 'a']), race(dr, 2, ['b', 'a', 'c', 'd'])];
  const ds = P.standings(dr, d1, ctx), dby = id => ds.drivers.find(d => d.id === id);
  ok('the worst result of a driver is dropped (one dropped result: the best 2 of 3 rounds count)', dby('a').cells.map(x => x.pts + (x.dropped ? 'x' : '')).join() === '25,12x,18' && dby('a').total === 43 && dby('b').cells.map(x => x.pts + (x.dropped ? 'x' : '')).join() === '18x,25,25' && dby('b').total === 50);
  ok('...with the note of the rule; without dropped results there is no note', ds.dropNote === 'Best 2 of 3 rounds count' && P.standings(withRule(dr, 'drops', 0), d1, ctx).dropNote === '' && P.standings(withRule(dr, 'drops', 2), d1, ctx).dropNote === 'Best 1 of 3 rounds count' && P.standings(withRule(dr, 'drops', 5), d1, ctx).dropNote === 'Best 1 of 3 rounds count');
  ok('...when two results are equal the earlier round is the one that is dropped', (() => { const e = champ({ drops: 1 }), s = P.standings(e, [race(e, 0, ['b', 'a']), race(e, 1, ['b', 'a']), race(e, 2, ['a', 'b'])], ctx); return s.drivers.find(d => d.id === 'a').cells.map(x => !!x.dropped).join() === 'true,false,false' && s.drivers.find(d => d.id === 'a').total === 43; })());
  ok('...a round a driver missed is a result of 0, which is dropped first', (() => { const e = champ({ drops: 1 }), s = P.standings(e, [race(e, 0, ['a', 'b']), race(e, 1, ['b']), race(e, 2, ['a', 'b'])], ctx), a = s.drivers.find(d => d.id === 'a'); return a.cells.map(x => x.pts + (x.dropped ? 'x' : '')).join() === '25,0x,25' && a.total === 50; })());
  ok('...after the first round nothing is dropped yet (the best 1 of 1 counts)', P.standings(dr, [d1[0]], ctx).drivers.every(d => d.cells.every(x => !x.dropped)) && P.standings(dr, [d1[0], d1[1]], ctx).drivers.find(d => d.id === 'a').total === 25);
  { const s2 = P.standings(withRule(dr, 'drops', 2), d1, ctx); ok('...two dropped results of three leave the best one', s2.drivers.find(d => d.id === 'a').total === 25 && s2.drivers.find(d => d.id === 'b').total === 25 && s2.drivers.find(d => d.id === 'd').total === 15); }
  ok('...(c and d: 15x, 18, 15 and 12x, 15, 12x)', dby('c').cells.map(x => x.pts + (x.dropped ? 'x' : '')).join() === '15x,18,15' && dby('c').total === 33 && dby('d').total === 27);
  ok('a driver who joined later keeps all his results when he has fewer than the number that count', (() => { const e = champ({ drops: 1, roster: [{ driver: 'a' }, { driver: 'b', from: 3 }] }), s = P.standings(e, [race(e, 0, ['a']), race(e, 1, ['a']), race(e, 2, ['b', 'a'])], ctx); return s.drivers.find(d => d.id === 'b').total === 25 && s.drivers.find(d => d.id === 'b').cells.every(x => !x.dropped); })());

  // ties
  const tie = (kind) => { const e = champ({ points: [5, 3, 2, 1], tie: kind, roster: [{ driver: 'b', team: 'T2' }, { driver: 'a', team: 'T1' }, { driver: 'c', team: 'T1' }, { driver: 'd', team: 'T2' }] });
    return { e, sessions: [race(e, 0, ['a', 'b', 'c', 'd']), race(e, 1, ['c', 'b', 'd', 'a'])] }; };
  { const t = tie('wins'), s = P.standings(t.e, t.sessions, ctx);
    ok('equal points: most wins first (a has 5+1, b has 3+3, c has 2+5 = 7)', s.drivers.map(d => d.id).join('') === 'cabd' && s.drivers.map(d => d.total).join() === '7,6,6,3'); }
  { const t = tie('last'), s = P.standings(t.e, t.sessions, ctx);
    ok('equal points: the best result of the last round (b 3 against a 1)', s.drivers.map(d => d.id).join('') === 'cbad'); }
  { const t = tie('qual'), q1 = S(t.e, 0, 1, [R(1, 'b', 8000), R(2, 'c', 8100), R(3, 'a', 8200)]), q2 = S(t.e, 1, 1, [R(1, 'c', 8000), R(2, 'b', 8100), R(3, 'a', 8200)]), s = P.standings(t.e, [...t.sessions, q1, q2], ctx);
    ok('equal points: the best qualifying results (b: 1st and 2nd, a: 3rd and 3rd)', s.drivers.map(d => d.id).join('') === 'cbad');
    ok('...a qualifying session that was driven but is not counted does not count', P.standings(t.e, [...t.sessions, S(t.e, 0, 1, [R(1, 'b', 8000)], { off: true })], ctx).drivers.map(d => d.id).join('') === 'cabd'); }
  { const e = champ({ points: [5, 3, 2, 1], roster: [{ driver: 'd' }, { driver: 'c' }, { driver: 'b' }, { driver: 'a' }] }), s = P.standings(e, [race(e, 0, ['a', 'b', 'c', 'd']), race(e, 1, ['d', 'c', 'b', 'a'])], ctx);
    ok('equal in everything (a: 5+1, d: 1+5 with a win each; b: 3+2, c: 2+3 with a second and a third each): the order of the roster decides, d before a and c before b', s.drivers.map(d => d.id).join('') === 'dacb' && s.drivers.map(d => d.total).join() === '6,6,5,5'); }

  // teams
  const ts = P.standings(c, [r1, r2], ctx), tm1 = ts.teams.find(t => t.id === 'T1'), tm2 = ts.teams.find(t => t.id === 'T2');
  ok('the points of a team: the best 2 drivers of the team in a race are added up (T1 has a and c, T2 has b and d)', tm1.cells.map(x => x.pts).join() === '40,30,' && tm2.cells.map(x => x.pts).join() === '30,40,' && tm1.total === 70 && tm2.total === 70);
  ok('...equal teams: the one with the most wins of its drivers, else the roster order; the positions follow', ts.teams.map(t => t.pos).join() === '1,2' && ts.teams[0].id === 'T1' && ts.teams[1].behind === 0 && same(ts.teams[0].drivers, ['A', 'C']) && same(tm2.drivers, ['B', 'D']));
  const one = P.standings(withRule(c, 'teamBest', 1), [r1, r2], ctx);
  ok('...the best 1 driver of a team counts: T1 25, T2 18, then T2 25, T1 18', one.teams.find(t => t.id === 'T1').cells.map(x => x.pts).join() === '25,18,' && one.teams.find(t => t.id === 'T2').cells.map(x => x.pts).join() === '18,25,');
  const e3 = champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2' }, { driver: 'c', team: 'T1' }, { driver: 'd', team: 'T2' }, { driver: 'e', team: 'T1' }] });
  ok('...all drivers of a team count when it says so (T1 has three: 25 + 15 + 10)', P.standings(withRule(e3, 'teamMode', 'all'), [race(e3, 0, ['a', 'b', 'c', 'd', 'e'])], ctx).teams.find(t => t.id === 'T1').cells[0].pts === 50
    && P.standings(e3, [race(e3, 0, ['a', 'b', 'c', 'd', 'e'])], ctx).teams.find(t => t.id === 'T1').cells[0].pts === 40);
  ok('...a team with one driver in the race has his points only', P.standings(c, [race(c, 0, ['a', 'b', 'd'])], ctx).teams.find(t => t.id === 'T1').cells[0].pts === 25);
  ok('...there are no team standings when the championship says so', P.standings(withRule(c, 'teamMode', 'none'), [r1], ctx).teams === null);
  ok('...a driver without a team scores for nobody; a team without drivers is not there', P.standings(champ({ roster: [{ driver: 'a' }, { driver: 'b', team: 'T2' }] }), [r1], ctx).teams.map(t => t.id).join() === 'T2');
  ok('...the bonuses and the guests count as they do for the drivers (a guest is not a team member)', P.standings(withRule(c, 'bonusStart', 1), [race(c, 0, [R(1, 'a'), R(2, 'z'), 'b', 'c', 'd'])], ctx).teams.find(t => t.id === 'T1').cells[0].pts === 42);
  ok('a team has n/a before any of its drivers has joined', (() => { const e = champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2', from: 2 }] }), s = P.standings(e, [race(e, 0, ['a', 'b']), race(e, 1, ['b', 'a'])], ctx); return s.teams.find(t => t.id === 'T2').cells.map(x => x.state).join() === 'na,score,open'; })());
  ok('the dropped results of a team are its own: the team drops its worst round, whatever its drivers dropped', (() => {
    const e = champ({ drops: 1 }), s = P.standings(e, [race(e, 0, ['a', 'b', 'c', 'd']), race(e, 1, ['b', 'd', 'a', 'c']), race(e, 2, ['c', 'a', 'd', 'b'])], ctx), t1 = s.teams.find(t => t.id === 'T1'), t2 = s.teams.find(t => t.id === 'T2');
    // T1 (a, c): 25+15 = 40, 15+12 = 27, 25+18 = 43. T2 (b, d): 18+12 = 30, 25+18 = 43, 15+12 = 27. The driver d drops round 1 (12), the team T2 drops round 3 (27).
    return t1.cells.map(x => x.pts).join() === '40,27,43' && t1.cells.map(x => !!x.dropped).join() === 'false,true,false' && t1.total === 83 && t2.cells.map(x => x.pts).join() === '30,43,27' && t2.cells.map(x => !!x.dropped).join() === 'false,false,true' && t2.total === 73
      && s.drivers.find(d => d.id === 'd').cells.map(x => !!x.dropped).join() === 'true,false,false'; })());

  // the rounds
  ok('the winner of every round (of its main race), and which rounds are driven', ts.board.map(x => x.winner).join() === 'A,B,' && ts.board.map(x => x.decided).join() === 'true,true,false' && ts.board[0].label === 'Round 1 · Round 1' && ts.board[0].winnerId === 'a');
  { const e = C.clean({ ...champ(), rounds: [{ name: 'x', sessions: [{ setup: 'sr', share: 50 }, { setup: 'sr', share: 100 }] }] }, true), s = P.standings(e, [S(e, 0, 0, [R(1, 'a'), R(2, 'b')]), S(e, 0, 1, [R(1, 'b'), R(2, 'a')])], ctx);
    ok('...the main race is the one that counts most (the full race, not the sprint before it), and a sprint and a race are added up in the round', s.board[0].winner === 'B' && s.board[0].races === 2 && s.drivers.find(d => d.id === 'a').cells[0].pts === 13 + 18 && s.drivers.find(d => d.id === 'b').cells[0].pts === 9 + 25); } }

// ---------- sentences ----------
{ const c = champ(), mk = (names, totals) => ({ decided: 1, drivers: names.map((n, i) => ({ name: n, total: totals[i] })) });
  ok('"Maria leads by 5"', P.leadText(mk(['Maria', 'Dutch', 'Sam'], [89, 84, 77])) === 'Maria leads by 5' && P.leadText(mk(['Maria', 'Dutch'], [10.5, 10])) === 'Maria leads by 0.5');
  ok('...level: the names of those at the top', P.leadText(mk(['Maria', 'Dutch', 'Sam'], [84, 84, 77])) === 'Maria and Dutch are level' && P.leadText(mk(['A', 'B', 'C'], [4, 4, 4])) === 'A, B and C are level' && P.leadText(mk(['A', 'B', 'C', 'D'], [4, 4, 4, 4])) === 'A, B and 2 more are level');
  ok('...a driver alone leads, and before a race is awarded there is nothing to say', P.leadText(mk(['Maria'], [10])) === 'Maria leads' && P.leadText({ decided: 0, drivers: [{ name: 'A', total: 0 }] }) === '' && P.leadText(null) === '' && P.leadText({ decided: 1, drivers: [] }) === '');
  ok('joinNames: one, two, three, more', P.joinNames(['A']) === 'A' && P.joinNames(['A', 'B']) === 'A and B' && P.joinNames(['A', 'B', 'C']) === 'A, B and C' && P.joinNames(['A', 'B', 'C', 'D', 'E']) === 'A, B and 3 more' && P.joinNames([]) === '' && P.joinNames(['A', '', 'B']) === 'A and B' && P.joinNames(['A', 'B', 'C', 'D'], 6) === 'A, B, C and D');
  ok('fmt and signed: at most two decimals, a minus sign, a plus for a gain', P.fmt(26) === '26' && P.fmt(12.5) === '12.5' && P.fmt(0.1 + 0.2) === '0.3' && P.fmt('x') === '0' && P.signed(14) === '+14' && P.signed(-5) === '−5' && P.signed(0) === '0' && P.signed(0.5) === '+0.5');
  // the rounds that are left
  const e = champ({ roster: [{ driver: 'a' }, { driver: 'b' }, { driver: 'c' }] }, 3);
  const two = P.standings(e, [race(e, 0, ['a', 'b', 'c']), race(e, 1, ['a', 'c', 'b'])], ctx);
  ok('what can still be won: the rounds that are left and the most they give (25 a round)', P.reachOf(e, two, setups).left === 1 && P.reachOf(e, two, setups).reach === 25 && P.reachOf(withRule(e, 'bonusFast', 1), two, setups).reach === 26 && P.reachOf(withRule(withRule(withRule(e, 'bonusFast', 1), 'bonusPole', 2), 'bonusStart', 3), two, setups).reach === 31);
  ok('...a sprint gives half, the best place of "one point per car beaten" is the number of other drivers, the best of the table is the most it gives', P.reachOf(C.setSession(e, 2, 2, { share: 50 }).rec, two, setups).reach === 13 && P.reachOf(C.applyPreset(e, 'beaten').rec, two, setups).reach === 2 && P.reachOf(C.setPlace(e, 3, 40).rec, two, setups).reach === 40 && P.reachOf(withRule(e, 'pointsRest', 30), two, setups).reach === 30);
  ok('...nobody has driven: all the rounds are left', P.reachOf(e, P.standings(e, [], ctx), setups).left === 3 && P.reachOf(e, P.standings(e, [], ctx), setups).reach === 75);
  ok('...the note names the drivers who can still pass the leader (A has 50, B and C 33: 17 behind, and one round gives up to 25)', P.remainingNote(e, two, setups) === 'One round is left: it gives up to 25 points a driver, so B and C can still pass A.');
  const far = P.standings(e, [race(e, 0, ['a', 'b', 'c']), race(e, 1, ['a', 'b', 'c']), race(e, 2, ['a', 'b', 'c'])], ctx);
  ok('...when every round is driven there is a champion', P.remainingNote(e, far, setups) === 'A is the champion.');
  { const x = champ({ points: [50, 1], roster: [{ driver: 'a' }, { driver: 'b' }] }, 2), s = P.standings(x, [race(x, 0, ['a', 'b'])], ctx);
    ok('...the most a round gives is the table\'s best (50): B, 49 behind, can still pass', P.remainingNote(x, s, setups) === 'One round is left: it gives up to 50 points a driver, so B can still pass A.'); }
  { const x = champ({ points: [10, 1], roster: [{ driver: 'a' }, { driver: 'b' }] }, 3), s = P.standings(x, [race(x, 0, ['a', 'b']), race(x, 1, ['a', 'b'])], ctx);
    ok('...a lead that is bigger than what is left (18 against 10): can no longer be caught', P.remainingNote(x, s, setups) === 'A can no longer be caught.');
    const y = champ({ points: [10, 9], roster: [{ driver: 'a' }, { driver: 'b' }] }, 4), s2 = P.standings(y, [race(y, 0, ['a', 'b'])], ctx);
    ok('...more rounds left: they give up to 30 points a driver', P.remainingNote(y, s2, setups) === '3 rounds are left: they give up to 30 points a driver, so B can still pass A.'); }
  { const one = champ({ roster: [{ driver: 'a' }] }); ok('...a single driver has nobody to pass', P.remainingNote(one, P.standings(one, [race(one, 0, ['a'])], ctx), setups) === ''); } }

// ---------- the panel after a race ----------
{ const c = champ({ drops: 1, bonusFast: 1 }), early = [race(c, 0, ['a', 'b', 'c', 'd']), race(c, 1, [R(1, 'b', 9000), R(2, 'a', 9100), R(3, 'd', 9200), R(4, 'c', 9300)])];
  const nv = race(c, 2, [R(1, 'd', 8000), R(2, 'a', 9000), R(3, 'b', 9100), R(4, 'c', 9200)], { awarded: false });
  const v = P.awardView(c, nv, [...early, nv], ctx);
  ok('the panel for a race: the places, the points of the race, the fastest lap, the round, the total now, and not awarded yet', v.state === 'race' && !v.awarded && v.rows.map(x => x.driverId).join('') === 'dabc' && v.rows.map(x => x.base).join() === '25,18,15,12' && v.rows[0].fastest === 1 && v.rows[0].pts === 26 && v.fastest.driverId === 'd' && v.fastest.got
    && v.rows.map(x => x.round).join() === '26,18,15,12' && v.share === 100 && v.roundLabel === 'Round 3 · Round 3');
  // before: a 25+18-ish... a: 25, 18 (R2 2nd); b: 18, 25; c: 15, 12; d: 12, 15. D=1, 2 decided -> keep 1
  // before (2 rounds, the best 1 counts): a 26, b 26, c 15, d 15. After (3 rounds, the best 2 count): a 26+18, b 26+18 (15 dropped), c 15+12, d 26+15
  const tot = Object.fromEntries(v.rows.map(x => [x.driverId, x.total])), chg = Object.fromEntries(v.rows.map(x => [x.driverId, x.change])), at = Object.fromEntries(v.rows.map(x => [x.driverId, x.pos + '/' + x.posBefore]));
  ok('...the total now has these points in it, and the change is what the total grows by', tot.a === 44 && tot.b === 44 && tot.c === 27 && tot.d === 41 && chg.a === 18 && chg.b === 18 && chg.c === 12 && chg.d === 26);
  ok('...the place after and the place before (d goes from 4th to 3rd)', at.a === '1/1' && at.b === '2/2' && at.d === '3/4' && at.c === '4/3');
  ok('...a note says that with dropped results the total grows by something else than the points of the round (b scored 15 and gains 18)', v.notes.length === 1 && /dropped results/.test(v.notes[0]) && /B scored 15 and gains 18/.test(v.notes[0]) && !/A scored/.test(v.notes[0]));
  ok('...the lead sentence is the one of the standings after (a and b are level at 44)', v.lead === 'A and B are level' && v.lead === P.leadText(v.after) && v.decided === 3 && v.total === 3);
  ok('...the standings before and after are there for the screen', v.before.decided === 2 && v.after.decided === 3 && v.after.drivers.find(d => d.id === 'd').total === 41);

  const done = { ...nv, champ: { ...nv.champ, awarded: '2026-10-20T11:00:00.000Z' } }, v2 = P.awardView(c, done, [...early, done], ctx);
  ok('an awarded race says so, with the same numbers (the points are in the total once, not twice)', v2.awarded === '2026-10-20T11:00:00.000Z' && v2.rows.map(x => x.total).join() === v.rows.map(x => x.total).join() && v2.rows.map(x => x.change).join() === v.rows.map(x => x.change).join());
  const old = race(c, 2, ['a', 'b', 'c', 'd'], { date: '2026-10-01T00:00:00.000Z' }), v3 = P.awardView(c, nv, [...early, old, nv], ctx);
  ok('a race that is awarded again replaces the one that was awarded before, it does not add to it', v3.rows.find(x => x.driverId === 'a').total === v.rows.find(x => x.driverId === 'a').total && P.marked(c, [...early, old, nv], nv, true).filter(x => x.champ.awarded).length === 3 && P.marked(c, [...early, old, nv], nv, true).find(x => x.id === old.id).champ.awarded === undefined);
  ok('...marking a session does not change the sessions it was given', old.champ.awarded && nv.champ.awarded === undefined && P.marked(c, [old], nv, false).length === 2 && P.marked(c, [old], nv, false).find(x => x.id === nv.id).champ.awarded === undefined && P.marked(c, [old], old, false).find(x => x.id === old.id).champ.awarded === undefined && P.marked(c, [old], old, false).length === 1);
  ok('...marking as awarded with a flag that is not there gives it a time, and a session that is not counted is counted again', P.marked(c, [], nv, true)[0].champ.awarded && P.marked(c, [], { ...nv, champ: { ...nv.champ, off: true } }, true)[0].champ.off === undefined);

  // the other states
  const pr = S(c, 0, 0, [R(1, 'a')]), qu = S(c, 0, 1, [R(1, 'c', 8000), R(2, 'a', 8500)]), off = race(c, 0, ['a'], { off: true }), gone = { ...nv, champ: { ...nv.champ, roundId: 'gone' } };
  ok('a practice, a qualifying, a race that is not counted, and a race that is not in the championship say what they are', P.awardView(c, pr, [pr], ctx).state === 'practice' && P.awardView(c, qu, [qu], ctx).state === 'qualifying' && P.awardView(c, qu, [qu], ctx).pole === 'C' && P.awardView(c, off, [off], ctx).state === 'off' && P.awardView(c, gone, [gone], ctx).state === 'notfound' && P.awardView(c, { id: 'x' }, [], ctx).state === 'notfound' && P.awardView(c, null, [], ctx).state === 'notfound');
  ok('...a qualifying says the bonus for pole, and a guest does not take the pole', P.awardView(withRule(c, 'bonusPole', 2), qu, [qu], ctx).poleBonus === 2 && P.awardView(c, S(c, 0, 1, [R(1, 'z', 100), R(2, 'a', 8500)]), [], ctx).pole === 'A' && P.awardView(withRule(c, 'guestRule', false), S(c, 0, 1, [R(1, 'z', 100), R(2, 'a', 8500)]), [], ctx).pole === 'Z');
  const c0 = C.setSession(c, 0, 2, { share: 0 }).rec;
  ok('...a race that counts for nothing (0%) says so', P.awardView(c0, race(c0, 0, ['a', 'b']), [], ctx).state === 'noshare');

  // guests and teams in the panel
  const gs = race(c, 0, [R(1, 'a'), R(2, 'z'), R(3, 'b'), R(4, 'c')], { awarded: false }), gv = P.awardView(c, gs, [gs], ctx);
  const gOff = P.awardView(withRule(c, 'guestRule', false), gs, [gs], ctx);
  ok('a guest is not in the list of drivers, and a note says so (and that the drivers behind move up)', gv.rows.map(x => x.driverId).join('') === 'abc' && gv.guests.join() === 'Z' && gv.notes.some(n => /^Z is a guest: no points, and the drivers behind move up\.$/.test(n)));
  ok('...with the guest rule off the guest is in the list with his place and no points, and nobody moves up', gOff.rows.map(x => x.driverId).join('') === 'azbc' && gOff.rows[1].guest && gOff.rows[1].total === null && gOff.rows[1].pts === 0 && gOff.rows[2].base === 15 && gOff.notes.some(n => /^Z is a guest: no points\.$/.test(n)));
  { const named = P.awardView(c, gs, [gs], { ...ctx, teams: [{ id: 'T1', name: 'Foxes' }, { id: 'T2', name: 'Arrows' }] });
    ok('the teams of the round, the best first, with their names (a 25 + 1 for the fastest lap and c 15 for Foxes, b 18 for Arrows)', named.teams.map(t => t.name + ' ' + t.pts).join() === 'Foxes 41,Arrows 18' && P.awardView(withRule(c, 'teamMode', 'none'), gs, [gs], ctx).teams === null); }
  ok('scaled: nothing for a share of 0, the whole for 100, a part rounded the way it says', P.scaled(25, 0, 'nearest') === 0 && P.scaled(25, 100, 'down') === 25 && P.scaled(25, 50, 'nearest') === 13 && P.scaled(25, 50, 'down') === 12 && P.scaled(25, 50, 'up') === 13 && P.scaled(25, 50, 'none') === 12.5 && P.scaled(25, 50, undefined) === 13 && P.scaled(10, 50, 'up') === 5 && P.scaled(10, 50, 'down') === 5 && P.scaled(1, 50, 'nearest') === 1 && P.scaled(0.9, 50, 'nearest') === 0);
}

// ---------- the progress of the championship does not see a race that is not counted ----------
{ const c = champ(), a = race(c, 0, ['a', 'b']), b = race(c, 0, ['b', 'a'], { off: true, date: '2027-01-01T00:00:00.000Z' });
  ok('a race that was set to "do not count" is not driven: the next session is offered again, an earlier race of the same session stays', C.driven(c, [a, b]).get(C.keyOf(a.champ.roundId, a.champ.sessionId)) === a && C.driven(c, [b]).size === 0 && C.progress(c, [b]).next.session === 0 && C.progress(c, [b]).driven === 0
    && C.progress(c, [a]).driven === 1); }

// ---------- awarding, undoing and not counting: what is written to the saved races ----------
{ const c = champ(), now = '2026-10-21T09:00:00.000Z';
  const a = race(c, 0, ['a', 'b'], { awarded: false }), a2 = race(c, 0, ['b', 'a'], { awarded: true }), other = race(c, 1, ['a', 'b'], { awarded: true }), qu = S(c, 0, 1, [R(1, 'a', 8000)], { awarded: true });
  const award = P.awardPatches([a, a2, other, qu], a, 'award', now);
  ok('award: the race gets the time of the award in its tag, and nothing else changes in the tag', award.length === 2 && award[1].id === a.id && award[1].champ.awarded === now && same({ ...award[1].champ, awarded: undefined }, { ...a.champ, awarded: undefined }));
  ok('...a race of the same session that was awarded before loses its award (a session counts once); other sessions and other rounds are left alone', award[0].id === a2.id && !('awarded' in award[0].champ) && award[0].champ.roundId === a2.champ.roundId && !award.some(x => x.id === other.id || x.id === qu.id));
  ok('...awarding a race that was set to "do not count" takes that away', (() => { const off = race(c, 0, ['a', 'b'], { off: true }), w = P.awardPatches([off], off, 'award', now); return w.length === 1 && w[0].champ.awarded === now && !('off' in w[0].champ); })());
  ok('...the sessions in the list are not changed (the patches are new records)', !('awarded' in a.champ) && a2.champ.awarded === '2026-10-20T10:00:00.000Z');
  const undo = P.awardPatches([a, a2], a2, 'undo', now);
  ok('undo: only this race loses its award, the others stay as they are', undo.length === 1 && undo[0].id === a2.id && !('awarded' in undo[0].champ) && undo[0].champ.sessionId === a2.champ.sessionId);
  const off = P.awardPatches([a, a2], a2, 'off', now);
  ok('do not count: the award is taken away and the tag says off', off.length === 1 && off[0].champ.off === true && !('awarded' in off[0].champ));
  const on = P.awardPatches([a], race(c, 0, ['a'], { off: true, awarded: false }), 'on', now);
  ok('count it again: the tag is not off any more, and not awarded', on.length === 1 && !('off' in on[0].champ) && !('awarded' in on[0].champ));
  ok('a mode that does not exist, a session without a tag or no session gives nothing to write', P.awardPatches([a], a, 'zzz', now).length === 0 && P.awardPatches([a], { id: 'x' }, 'award', now).length === 0 && P.awardPatches([a], null, 'award', now).length === 0);
  ok('...and the patches, applied, give the standings the same as marked() does for the panel', (() => { const list = [a, a2], patches = P.awardPatches(list, a, 'award', now), applied = list.map(x => { const p = patches.find(q => q.id === x.id); return p ? { ...x, champ: p.champ } : x; });
    return same(P.standings(c, applied, ctx).drivers.map(d => d.id + d.total), P.standings(c, P.marked(c, list, a, true), ctx).drivers.map(d => d.id + d.total)) && P.standings(c, applied, ctx).drivers[0].id === 'a'; })()); }

// ---------- the races that are saved and not awarded ----------
{ const c = champ(), r1 = race(c, 0, ['a', 'b']), r2 = race(c, 1, ['a', 'b'], { awarded: false }), r3 = race(c, 2, ['a', 'b'], { off: true }), q = S(c, 0, 1, [R(1, 'a', 8000)], { awarded: false });
  ok('pending: a race that is saved and not awarded is pending; an awarded race, a race that is not counted and a qualifying are not', P.pendingOf(c, [r1, r2, r3, q]).map(x => x.id).join() === r2.id);
  const c0 = C.setSession(c, 1, 2, { share: 0 }).rec;
  ok('...a race that counts for nothing (0%) is not pending', P.pendingOf(c0, [r1, r2]).length === 0);
  const r2b = race(c, 1, ['b', 'a'], { awarded: false, date: '2027-01-01T00:00:00.000Z' });
  ok('...only the latest run of a session is pending', P.pendingOf(c, [r2, r2b]).map(x => x.id).join() === r2b.id);
  ok('...a championship without a race has nothing pending', P.pendingOf(c, []).length === 0); }

// ---------- the table of the standings (the screen and the PDF) ----------
{ const c = withRule(withRule(champ(), 'drops', 1), 'bonusFast', 1), r1 = race(c, 0, ['a', 'b', 'c', 'd']), r2 = race(c, 1, ['b', 'a', 'd', 'c']), st = P.standings(c, [r1, r2], { ...ctx, teams: [{ id: 'T1', name: 'Foxes' }, { id: 'T2', name: 'Arrows' }] });
  const t = P.tableOf(c, st, 'drivers');
  ok('drivers: the title says how far it is, the columns are the places, the rounds, the points, the lead and the wins', t.title === 'Drivers: after round 2 of 3' && t.columns.map(x => x.label).join() === 'Pos,Driver,Team,R1,R2,R3,Points,Behind,Wins' && t.columns.filter(x => x.r).map(x => x.label).join() === 'R1,R2,R3,Points,Behind,Wins' && t.rows.length === 4);
  ok('...the leader is marked, the first row has no "behind", a tie is 0 behind, the others have the gap with a minus sign', t.rows.map(r => r.lead).join() === 'true,false,false,false' && t.rows[0].cells[t.rows[0].cells.length - 2].t === '–' && t.rows[1].cells[t.rows[1].cells.length - 2].t === '0' && t.rows[2].cells[t.rows[2].cells.length - 2].t === '−11');
  ok('...a round that is not driven is a dash, a dropped result is "dr", the legend tells both', t.rows[0].cells[5].t === '–' && t.rows[0].cells[5].cls === 'mu' && t.rows.some(r => r.cells.some(x => x.cls === 'dr')) && t.legend.some(l => l.cls === 'dr' && l.text === 'a dropped result') && t.legend.some(l => l.cls === 'mu' && /not been driven/.test(l.text)));
  ok('...the fastest lap bonus is "fl" and is in the legend (when the championship has the bonus)', t.rows.some(r => r.cells.some(x => x.cls === 'fl')) && t.legend.some(l => l.cls === 'fl'));
  const tt = P.tableOf(c, st, 'teams');
  ok('teams: the title, the columns with the drivers of a team, the best team first with its drivers', tt.title === 'Teams: the 2 best drivers of a team count in a race' && tt.columns.map(x => x.label).join() === 'Pos,Team,Drivers,R1,R2,R3,Points,Behind' && tt.rows.length === 2 && tt.rows[0].cells[1].b === true && /,/.test(tt.rows[0].cells[2].t) && !tt.legend.some(l => l.cls === 'fl'));
  const tr = P.tableOf(c, st, 'rounds');
  ok('rounds: the winner of each round, "not driven" for a round that is not', tr.title === 'Rounds' && tr.note === 'Winner of each race' && tr.rows.length === 3 && tr.rows[0].cells[1].t === 'A' && tr.rows[1].cells[1].t === 'B' && tr.rows[2].cells[1].t === 'not driven' && tr.rows[2].cells[1].cls === 'mu');
  const none = P.tableOf(c, P.standings(c, [], ctx), 'drivers');
  ok('before a race is awarded the title says so and nobody leads', none.title === 'Drivers: no race is awarded yet' && none.rows.every(r => !r.lead));
  // the PDF page
  const Rp = require('../renderer/report.js'), html = Rp.standingsHtml({ championship: 'Cup <2026> & "Co"', table: t, lead: 'A leads by 5.' });
  ok('the PDF page: A4 landscape, the name of the championship (escaped), the title, the note, the lead, the table and the legend', html.startsWith('<!DOCTYPE html>') && html.includes('@page { size: A4 landscape') && html.includes('<h1>Cup &lt;2026&gt; &amp; &quot;Co&quot;</h1>') && html.includes('Drivers: after round 2 of 3') && html.includes('A leads by 5.') && html.includes('Best 2 of 3 rounds count') && html.includes('<tr class="lead">') && html.includes('a dropped result') && html.includes('Made with SlotForge Timing'));
  ok('...every cell of the table is on the page, a dropped result with its class, the points big and bold, the numbers to the right', t.rows.every(r => html.includes('>' + r.cells[1].t + '<') || html.includes('<b>' + r.cells[1].t + '</b>')) && html.includes('class="r dr"') && html.includes('<b class="big">') && html.includes('<th class="r">Points</th>'));
  ok('...an empty table still makes a page', Rp.standingsHtml({ championship: 'X' }).includes('<h1>X</h1>') && Rp.standingsHtml({}).includes('<table>'));
  ok('the file name: the championship and what the page shows, without the characters a file name can not have', Rp.standingsFileName('Club Cup 2026', 'drivers') === 'Club Cup 2026 drivers standings.pdf' && Rp.standingsFileName('Club Cup', 'teams') === 'Club Cup teams standings.pdf' && Rp.standingsFileName('Club Cup', 'rounds') === 'Club Cup rounds standings.pdf' && Rp.standingsFileName('A/B: "C"', 'x') === 'A-B- -C- drivers standings.pdf' && Rp.standingsFileName('', 'teams') === 'Championship teams standings.pdf'); }

// ---------- more cases (found with the mutation check) ----------
{ // a pole sitter who is disqualified in the race does not get the bonus; one who retired did start the race
  const c = withRule(champ(), 'bonusPole', 2), q = S(c, 0, 1, [R(1, 'b', 8000), R(2, 'a', 8100)]);
  const dq = P.sessionResult(c, race(c, 0, [R(1, 'a'), R(2, 'c'), R(3, 'b', 9000, { dq: true })]), q), rt = P.sessionResult(c, race(c, 0, [R(1, 'a'), R(2, 'c'), R(3, 'b', 9000, { retired: true })]), q);
  ok('pole: a pole sitter who was disqualified does not get the bonus (and the result says he did not get it)', dq.rows.every(x => x.pole === 0) && dq.pole.got === false && dq.pole.name === 'B');
  ok('...one who retired did start the race: he gets the bonus (and nothing for a place)', rt.rows.find(x => x.driverId === 'b').pole === 2 && rt.rows.find(x => x.driverId === 'b').pts === 2 && rt.pole.got === true); }
{ // with the guest rule off a guest can sit on pole, and the bonus is not given to him
  const c = withRule(withRule(champ(), 'bonusPole', 2), 'guestRule', false), q = S(c, 0, 1, [R(1, 'z', 7000), R(2, 'a', 8000)]), r = P.sessionResult(c, race(c, 0, [R(1, 'a'), R(2, 'z')]), q);
  ok('a guest on pole (guest rule off) does not get the bonus, and nobody else gets it either', r.pole.name === 'Z' && r.pole.got === false && r.rows.every(x => x.pole === 0)); }
{ // a tie in points and in places is decided by the qualifying results (b is first in both qualifyings)
  const c = champ(), q0 = S(c, 0, 1, [R(1, 'b', 8000), R(2, 'a', 8100)]), q1 = S(c, 1, 1, [R(1, 'b', 8000), R(2, 'a', 8100)]), r0 = race(c, 0, ['a', 'b', 'c', 'd']), r1 = race(c, 1, ['b', 'a', 'd', 'c']);
  const st = P.standings(c, [q0, q1, r0, r1], ctx), by = id => st.drivers.find(d => d.id === id);
  ok('a tie in points and in places goes to the better qualifying results (the order of the roster is the last thing)', by('a').total === by('b').total && same(by('a').places, by('b').places) && st.drivers[0].id === 'b' && st.drivers[1].id === 'a' && by('b').qplaces[0] === 2 && !by('a').qplaces[0] && by('a').qplaces[1] === 2);
  ok('...the qualifying places of a driver count his place in the qualifying of each round that was driven (b: two poles, a: two seconds)', by('b').qplaces[0] === 2 && by('b').qplaces.length === 1 && by('a').qplaces[1] === 2 && by('c').qplaces.length === 0);
  const w = P.standings(c, [r0, race(c, 1, ['a', 'c', 'b', 'd'])], ctx);
  ok('wins and places are counted from the races (a won both: 2 wins and the places [2])', w.drivers[0].id === 'a' && w.drivers[0].wins === 2 && same(w.drivers[0].places, [2]) && w.drivers.find(d => d.id === 'b').wins === 0 && (pl => !pl[0] && pl[1] === 1 && pl[2] === 1)(w.drivers.find(d => d.id === 'b').places)); }
{ // teams: a tie in points goes to the team with the better places; and a team has its "behind"
  const c = withRule(C.clean({ ...champ(), points: [10, 10, 10, 10] }, true), 'teamBest', 2), st = P.standings(c, [race(c, 0, ['b', 'a', 'd', 'c'])], ctx);
  ok('a tie between teams goes to the team that won (T2 has the winner, T1 is first in the roster)', st.teams[0].total === st.teams[1].total && st.teams[0].id === 'T2' && st.teams[1].id === 'T1');
  const c2 = champ(), st2 = P.standings(c2, [race(c2, 0, ['a', 'b', 'c', 'd'])], ctx);
  ok('...a team that is not first is behind the leader by the difference', st2.teams[0].behind === 0 && st2.teams[1].behind === st2.teams[1].total - st2.teams[0].total && st2.teams[1].behind < 0); }
{ // the winner of a round: the later race when two races count the same, a guest is not a winner
  const c = C.addSession(champ(), 0, 'sr').rec, a = S(c, 0, 2, [R(1, 'a'), R(2, 'b')]), b = S(c, 0, 3, [R(1, 'b'), R(2, 'a')]);
  ok('the winner of a round is the winner of the race that counts most; when two count the same, the later one', P.standings(c, [a, b], ctx).board[0].winner === 'B' && P.standings(c, [a, b], ctx).board[0].races === 2);
  const off = withRule(champ(), 'guestRule', false), on = champ();
  ok('...a guest does not win a round: with the guest rule off, a guest who finished first leaves no winner; with it on the first of the roster wins', P.standings(off, [race(off, 0, [R(1, 'z'), R(2, 'a')])], ctx).board[0].winner === '' && P.standings(on, [race(on, 0, [R(1, 'z'), R(2, 'a')])], ctx).board[0].winner === 'A'); }
{ // what is left: a driver who is exactly as far behind as the rest can give can still pass (a tie)
  const c = C.clean({ ...champ(undefined, 2), points: [10, 4] }, true), st = P.standings(c, [race(c, 0, ['a', 'b', 'c', 'd'])], ctx);
  ok('"can still pass": a driver as far behind as the rounds that are left can give is still in it (10 behind with 10 to win)', st.drivers[0].total === 10 && P.remainingNote(c, st, setups) === 'One round is left: it gives up to 10 points a driver, so B, C and D can still pass A.'); }
{ // a race that is driven again: the points that it replaces are in the standings before, so the change is the difference
  const c = champ(), first = race(c, 0, ['a', 'b', 'c', 'd'], { awarded: true, date: '2026-10-01T10:00:00.000Z' }), second = race(c, 0, ['b', 'a', 'c', 'd'], { awarded: false, date: '2026-10-02T10:00:00.000Z' });
  const v = P.awardView(c, second, [first, second], ctx), row = id => v.rows.find(x => x.driverId === id);
  ok('a second run of an awarded race: the change is the difference to the first run (B gains 7, A loses 7), the total is the points of the second run', row('b').change === 7 && row('a').change === -7 && row('b').total === 25 && row('a').total === 18 && row('c').change === 0);
  const dr = withRule(champ(), 'drops', 1), r1 = race(dr, 0, ['a', 'b', 'c', 'd']), r2 = race(dr, 1, ['b', 'c', 'd', 'a'], { awarded: false }), dv = P.awardView(dr, r2, [r1, r2], ctx), da = dv.rows.find(x => x.driverId === 'a');
  ok('a result that is dropped: the row says so, the round has its points and the total does not grow', da.roundDropped === true && da.round === 12 && da.change === 0 && da.total === 25 && dv.notes.some(n => n.startsWith('With dropped results the total does not always grow by the points of the round: ') && n.includes('A scored 12 and gains 0'))); }
{ // the changes written to a session: only the sessions that were awarded are touched
  const c = champ(), a = race(c, 0, ['a', 'b'], { awarded: false }), a2 = race(c, 0, ['b', 'a'], { awarded: true }), a3 = race(c, 0, ['a', 'b'], { awarded: false });
  ok('award: a race of the same session that was never awarded is not written again (only the awarded one loses its mark)', P.awardPatches([a, a2, a3], a, 'award', 'now').map(x => x.id).join() === a2.id + ',' + a.id); }
{ // a race of teams is not waiting to be awarded
  const c = C.clean({ ...champ(), rounds: [{ name: 'x', sessions: [{ setup: 'se' }] }] }, true), team = S(c, 0, 0, [{ pos: 1, driverId: '', driverName: 'Team A', asTeam: true, drivers: [{ driverId: 'a' }] }], { awarded: false });
  ok('a race that was driven by teams is not pending (it can not be scored)', C.driven(c, [team]).size === 1 && P.pendingOf(c, [team]).length === 0); }
{ // the table: a fastest lap bonus that was dropped is shown as dropped; a driver who joins later is "n/a" and the legend says so
  const c = withRule(withRule(champ(), 'drops', 1), 'bonusFast', 1), r1 = race(c, 0, [R(1, 'b', 9100), R(2, 'a', 8000), R(3, 'c', 9300), R(4, 'd', 9400)]), r2 = race(c, 1, [R(1, 'a', 9000), R(2, 'b', 8500), R(3, 'c', 9300), R(4, 'd', 9400)]);
  const t = P.tableOf(c, P.standings(c, [r1, r2], ctx), 'drivers'), arow = t.rows.find(r => r.cells[1].t === 'A');
  ok('a result that has the fastest lap bonus and is dropped shows as dropped (A: 18 + 1 in round 1 is dropped, 25 in round 2 counts)', arow.cells[3].t === '19' && arow.cells[3].cls === 'dr' && arow.cells[4].t === '25' && arow.cells[4].cls === '' && arow.cells[arow.cells.length - 3].t === '25');
  const late = champ({ roster: [{ driver: 'a', team: 'T1' }, { driver: 'b', team: 'T2', from: 2 }, { driver: 'c', team: 'T1' }, { driver: 'd', team: 'T2' }] }), tl = P.tableOf(late, P.standings(late, [race(late, 0, ['a', 'b', 'c', 'd']), race(late, 1, ['a', 'b', 'c', 'd'])], ctx), 'drivers');
  ok('...a driver who joins in round 2 has "n/a" in round 1, and the legend says what it means', tl.rows.find(r => r.cells[1].t === 'B').cells[3].t === 'n/a' && tl.legend.some(l => l.cls === 'mu' && l.text === 'n/a the driver joins later')); }
{ const Rp = require('../renderer/report.js'), html = Rp.standingsHtml({ championship: 'X', table: { title: 't', columns: [{ label: 'a' }], rows: [], legend: [] } });
  ok('the PDF page: a dropped result is crossed out and grey, the leader\'s row is shaded', html.includes('.dr { color: #888; text-decoration: line-through; }') && html.includes('tr.lead td { background: #fde8f1;')); }

console.log(fails ? fails + ' CHAMPIONSHIP POINTS TESTS FAILED' : 'ALL CHAMPIONSHIP POINTS TESTS PASSED');
process.exit(fails ? 1 : 0);
