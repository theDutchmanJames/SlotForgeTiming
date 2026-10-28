// Finals after the heats (0.96.0): a final A or finals B and A, the lanes the finalists choose, and the two ways the finals count.
const E = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const people = n => Array.from({ length: n }, (_, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
// a finished race without the real race: rows in finishing order, { p: participant, laps, best (ms) }
const fake = rows => ({ standings: () => rows.map((r, i) => ({ pos: i + 1, car: { participant: r.p, laps: Array(r.laps === undefined ? 5 : r.laps).fill(0), total: null, best: r.best === undefined ? null : r.best } })) });
const lanesOf = n => Array.from({ length: n }, (_, i) => i);
// six drivers on a track with four lanes, three heats (points 10, 8, 6, 5, 4, 3):
//   heat 1: 0 1 2 3   heat 2: 0 4 5 1   heat 3: 2 0 4 5   -> points 0:28  2:16  4:14  1:13  5:11  3:5
const HEATS = [[0, 1, 2, 3], [0, 4, 5, 1], [2, 0, 4, 5]];
const make = (cfg = {}, n = 6, lanes = 4, heats = HEATS) => {
  const H = E.createHeatRace({ participants: people(n), schedule: heats.map(h => h.map((p, i) => ({ p, lane: i }))), resultBy: 'points', points: [10, 8, 6, 5, 4, 3], lanes, rnd: () => 0, ...cfg });
  return H;
};
const heatsDone = (cfg, n, lanes, heats = HEATS) => { const H = make(cfg, n, lanes, heats); heats.forEach(h => H.record(fake(h.map(p => ({ p }))))); return H; };
const order = H => H.overall().map(o => o.participant).join();

// ---- the settings ----
ok('finals: none is the standard, the final mode is places', JSON.stringify(E.finalsOf({})) === JSON.stringify({ finals: 'none', finalMode: 'places' }) && JSON.stringify(E.finalsOf()) === JSON.stringify({ finals: 'none', finalMode: 'places' }));
ok('a, ab and added are taken over; anything else is mended', E.finalsOf({ finals: 'a' }).finals === 'a' && E.finalsOf({ finals: 'ab', finalMode: 'added' }).finalMode === 'added' && E.finalsOf({ finals: 'abc', finalMode: 'x' }).finals === 'none' && E.finalsOf({ finals: 'abc', finalMode: 'x' }).finalMode === 'places');

// ---- who races in the finals ----
{ const S = E.finalSizes;
  ok('no finals when the setting is none, or the value is not known', S(6, 4, 'none').length === 0 && S(6, 4, undefined).length === 0 && S(6, 4, 'c').length === 0);
  ok('a final A holds as many drivers as the track has lanes', JSON.stringify(S(6, 4, 'a')) === '[4]' && JSON.stringify(S(8, 6, 'a')) === '[6]');
  ok('with fewer drivers than lanes, everybody races the final A and there is no final B', JSON.stringify(S(3, 6, 'a')) === '[3]' && JSON.stringify(S(3, 6, 'ab')) === '[3]' && JSON.stringify(S(4, 4, 'ab')) === '[4]');
  ok('the final B is the next group: 4 and 2 of 6 drivers on 4 lanes, 4 and 4 of 8', JSON.stringify(S(6, 4, 'ab')) === '[4,2]' && JSON.stringify(S(8, 4, 'ab')) === '[4,4]');
  ok('one driver left over has nobody to race against: no final B (5 drivers on 4 lanes)', JSON.stringify(S(5, 4, 'ab')) === '[4]');
  ok('two left over is enough for a final B; nobody gets a final C (10 drivers on 4 lanes: 4 and 4)', JSON.stringify(S(6, 4, 'ab')) === '[4,2]' && JSON.stringify(S(10, 4, 'ab')) === '[4,4]');
  ok('with one lane, or one driver, nobody races against anybody: no finals', S(6, 1, 'ab').length === 0 && S(1, 4, 'a').length === 0 && S(0, 4, 'a').length === 0);
  ok('the numbers are mended like the schedule does it (2.5 lanes is 2, text counts as 1 lane)', JSON.stringify(S(6, 2.5, 'a')) === '[2]' && S(6, 'x', 'a').length === 0);
}

// ---- no finals: nothing changes ----
{ const H = heatsDone({}, 6, 4);
  ok('without finals the race is over after the last heat: total is the number of heats, nothing is next', H.total === 3 && H.count === 3 && !H.hasNext() && H.finalPlan === null && !H.isFinal() && H.finalNow() === null);
  ok('the result rows know of no final', H.overall().every(o => o.finalName === null && o.finalPos === null && o.finalLaps === null && o.finalPoints === null));
  ok('the order is the heat result (0 2 4 1 5 3)', order(H) === '0,2,4,1,5,3');
  ok('the names of the races: Heat 1 to Heat 3, and nothing after', H.raceName(0) === 'Heat 1' && H.raceName(2) === 'Heat 3' && H.raceName(3) === '');
  ok('there are no lanes to choose', H.pick(0).error && H.picksDone() && H.randomRest() === false);
  const A = heatsDone({ finals: 'ab' }, 6, 4), a = make({ finals: 'ab' });
  ok('the first heats do not know the finals yet (they are decided by the heat result), but the count of races is known from the start', a.total === 5 && a.count === 3 && a.finalPlan === null && a.finalNow() === null && A.total === 5);
}

// ---- the finals are known after the last heat ----
{ const a = make({ finals: 'ab' });
  a.record(fake(HEATS[0].map(p => ({ p })))); a.record(fake(HEATS[1].map(p => ({ p }))));
  ok('after two of three heats there are no finals yet, and the third heat is not a final', a.finalPlan === null && !a.isFinal() && a.hasNext());
  a.record(fake(HEATS[2].map(p => ({ p }))));
  ok('after the last heat the final B (5 and 3) comes first, then the final A (0, 2, 4, 1; best first)', JSON.stringify(a.finalPlan) === JSON.stringify([{ name: 'B', drivers: [5, 3] }, { name: 'A', drivers: [0, 2, 4, 1] }]));
  ok('the next race is a final: B', a.isFinal() && a.hasNext() && a.raceName(a.idx) === 'Final B' && a.raceName(4) === 'Final A' && a.raceName(5) === '');
  const f = a.finalNow();
  ok('finalNow tells who chooses first (the best-placed driver of that final) and which lanes are free', f.name === 'B' && f.next === 5 && f.picks.length === 0 && JSON.stringify(f.free) === '[0,1,2,3]' && JSON.stringify(f.drivers) === '[5,3]');
  const only = heatsDone({ finals: 'a' }, 6, 4);
  ok('with only a final A there are four drivers in it, and the other two do not race again', JSON.stringify(only.finalPlan) === JSON.stringify([{ name: 'A', drivers: [0, 2, 4, 1] }]) && only.total === 4 && only.raceName(3) === 'Final A');
}

// ---- choosing lanes ----
{ const a = heatsDone({ finals: 'ab' }, 6, 4);
  ok('lane -1 and lane 4 (of 4) do not exist: the message says so', a.pick(-1).error === 'That lane does not exist.' && a.pick(4).error === 'That lane does not exist.' && a.pick(3.5).error === 'That lane does not exist.');
  ok('a lane that does not exist, or no lane, is refused', a.pick(-1).error && a.pick(4).error && a.pick(1.5).error && a.pick('x').error && a.pick(undefined).error && a.pick(null).error && a.pick('').error && a.pick(' ').error && a.pick(true).error && a.finalNow().picks.length === 0);
  const txt = heatsDone({ finals: 'ab' }, 6, 4);
  ok('a lane from a button comes as text: "2" is lane 2', txt.pick('2').ok && txt.finalNow().picks[0].lane === 2);
  ok('the best-placed driver (5) takes lane 3', a.pick(3).ok && a.finalNow().next === 3 && JSON.stringify(a.finalNow().picks) === '[{"p":5,"lane":3}]');
  ok('a lane that is taken is refused, the choice is still with the same driver', a.pick(3).error === 'That lane is taken.' && a.finalNow().next === 3);
  ok('before everybody has chosen the picks are not done; the grid shows a full row with the lanes not chosen yet given out in order', !a.picksDone() && JSON.stringify(a.entries().map(e => [e.participant, e.lane])) === '[[3,0],[5,3]]');
  ok('the second driver chooses lane 1; both have chosen', a.pick(1).ok && a.picksDone() && a.finalNow().next === null && a.pick(0).error === 'All lanes of this final are chosen.');
  ok('the grid is ordered by lane and has the names of the drivers', JSON.stringify(a.entries().map(e => [e.lane, e.participant, e.driverName])) === '[[1,3,"D3"],[3,5,"D5"]]');
  a.record(fake([{ p: 5 }, { p: 3 }]));
  ok('then the final A: nobody has chosen yet (the choices of the final B are its own)', a.finalNow().name === 'A' && a.finalNow().picks.length === 0 && a.finalNow().next === 0 && !a.picksDone());
  a.pick(3); a.pick(0); a.pick(2);
  ok('when only one lane is left for the last driver, that is no choice: he gets it', a.picksDone() && JSON.stringify(a.finalNow().picks) === '[{"p":0,"lane":3},{"p":2,"lane":0},{"p":4,"lane":2},{"p":1,"lane":1}]');
  ok('the grid of the A final is in lane order: 2 on lane 0, 1 on lane 1, 4 on lane 2, 0 on lane 3', JSON.stringify(a.entries().map(e => e.participant)) === '[2,1,4,0]');
  a.clearPicks();
  ok('Clear picks starts again', a.finalNow().picks.length === 0 && a.finalNow().next === 0 && !a.picksDone());
  a.pick(1);
  ok('the drivers who did not choose get the free lanes by lot: nobody twice, the choice kept', a.randomRest() === true && a.picksDone() && (l => l.length === 4 && new Set(l.map(x => x.lane)).size === 4 && l[0].p === 0 && l[0].lane === 1 && l.every(x => x.lane >= 0 && x.lane < 4))(a.finalNow().picks));
  ok('drawing again when everybody has chosen does nothing', a.randomRest() === false);
  const b = heatsDone({ finals: 'ab', rnd: () => 0.999 }, 6, 4), c = heatsDone({ finals: 'ab', rnd: () => 0 }, 6, 4);
  b.randomRest(); c.randomRest();
  ok('the lot depends on the random numbers (so the two draws differ), and each is a complete grid', JSON.stringify(b.entries().map(e => e.lane)) !== JSON.stringify(c.entries().map(e => e.lane)) && b.entries().length === 2 && c.entries().length === 2);
  // a final on a track with more lanes than drivers: the last driver still has a choice
  const w = heatsDone({ finals: 'a' }, 3, 6, [[0, 1, 2]]);
  w.pick(5); w.pick(4);
  ok('with 3 drivers on 6 lanes the third driver still chooses among 4 lanes (nothing is forced)', !w.picksDone() && w.finalNow().next === 2 && w.finalNow().free.length === 4);
  w.pick(0);
  ok('and then everybody has chosen', w.picksDone());
}

// ---- the results of the finals ----
{ const a = heatsDone({ finals: 'ab' }, 6, 4);
  const rb = a.record(fake([{ p: 5, laps: 5, best: 3000 }, { p: 3, laps: 4, best: 3100 }]));
  ok('a final is recorded as a race of its own: the number of the race, the name of the final, and the same rows as a heat', rb.heat === 4 && rb.final === 'B' && rb.rows.length === 2 && rb.rows[0].participant === 5 && rb.rows[0].points === 10 && rb.rows[1].points === 8);
  ok('the heats have no final field', a.results.slice(0, 3).every(r => r.final === undefined) && a.results[3].final === 'B');
  const ra = a.record(fake([{ p: 1 }, { p: 2 }, { p: 4 }, { p: 0 }]));
  ok('the final A: heat number 5, points 10 8 6 5, and now nothing is left', ra.heat === 5 && ra.final === 'A' && ra.rows.map(r => r.points).join() === '10,8,6,5' && !a.hasNext() && !a.isFinal());
  ok('...there is no final to choose lanes for any more (and nothing breaks asking)', a.finalNow() === null && a.picksDone() === true && a.pick(0).error === 'There is no final to choose lanes for.' && a.randomRest() === false && a.raceName(a.idx) === '' && (a.clearPicks(), true));
}

// ---- the finals decide the places ----
{ const mk = () => { const a = heatsDone({ finals: 'ab' }, 6, 4); return a; };
  const a = mk();
  ok('before the finals the order is the heat result and the drivers know their final', order(a) === '0,2,4,1,5,3' && a.overall().map(o => o.finalName).join() === 'A,A,A,A,B,B');
  a.record(fake([{ p: 3 }, { p: 5 }]));
  ok('when only the final B has been raced: the final A is still in the order of the heat result, the B final in the order of its final', order(a) === '0,2,4,1,3,5');
  a.record(fake([{ p: 1 }, { p: 2 }, { p: 4 }, { p: 0 }]));
  ok('after the final A the places are the places of the finals: A (1 2 4 0) above B (3 5)', order(a) === '1,2,4,0,3,5' && a.overall().map(o => o.pos).join() === '1,2,3,4,5,6');
  const rows = a.overall();
  ok('the rows tell the final and the place in it', rows.map(o => o.finalName + o.finalPos).join() === 'A1,A2,A3,A4,B1,B2');
  ok('when the finals decide the places, the score is still what the heats counted (driver 1: 13 points, 10 laps; the final is not in it)', rows[0].score === 13 && rows[0].heatScore === 13 && rows.find(o => o.participant === 0).score === 28);
  const lp = E.createHeatRace({ participants: people(2), schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps', lanes: 2, finals: 'a', finalMode: 'places' });
  lp.record(fake([{ p: 0, laps: 5 }, { p: 1, laps: 4 }])); lp.record(fake([{ p: 1, laps: 6 }, { p: 0, laps: 5 }]));
  ok('...also by laps: the score is the laps of the heats (5 and 4), the laps column has everything (10 and 10)', lp.overall().map(o => o.score).join() === '4,5' && lp.overall().map(o => o.laps).join() === '10,10');
  ok('laps and points count everything that was driven (driver 1: 13 + 10 points, 10 + 5 laps)', rows[0].points === 23 && rows[0].laps === 15 && rows[0].finalPoints === 10 && rows[0].finalLaps === 5);
  ok('the number of heats is the number of heats, without the final (driver 1 raced two heats, driver 3 one)', rows[0].heats === 2 && rows.find(o => o.participant === 3).heats === 1 && rows.find(o => o.participant === 0).heats === 3);
  const same = heatsDone({ finals: 'a' }, 6, 4);
  same.record(fake([{ p: 4 }, { p: 0 }, { p: 1 }, { p: 2 }]));
  ok('with only a final A the others stay below it in the order of the heat result', order(same) === '4,0,1,2,5,3');
}

// ---- the finals are added to the heat result ----
{ const a = heatsDone({ finals: 'ab', finalMode: 'added' }, 6, 4);
  a.record(fake([{ p: 5 }, { p: 3 }]));
  a.record(fake([{ p: 1 }, { p: 2 }, { p: 4 }, { p: 0 }]));
  const o = a.overall(), by = p => o.find(x => x.participant === p);
  ok('the points of the final come on top of the heat points (0: 28+5, 1: 13+10, 2: 16+8, 4: 14+6, 5: 11+10, 3: 5+8)', [[0, 33], [1, 23], [2, 24], [4, 20], [5, 21], [3, 13]].every(([p, s]) => by(p).score === s));
  ok('the heat part is still there (heatScore)', [[0, 28], [1, 13], [2, 16], [4, 14], [5, 11], [3, 5]].every(([p, s]) => by(p).heatScore === s));
  ok('the A final drivers are above the B drivers, even when a B driver has more (5 has 21, 4 has 20)', order(a) === '0,2,1,4,5,3');
  const plain = heatsDone({ finals: 'ab' }, 6, 4);
  ok('without the final part the places are those of the heat result', plain.overall().every(x => x.heatScore === x.score));
  // averages and dropped heats do not touch the final
  const avg = heatsDone({ finals: 'a', finalMode: 'added', countBy: 'average' }, 6, 4);
  avg.record(fake([{ p: 1 }, { p: 2 }, { p: 4 }, { p: 0 }]));
  const x0 = avg.overall().find(x => x.participant === 0);
  ok('with the average per heat the final is added to the average (28 / 3 + 5), not averaged with the heats', Math.abs(x0.heatScore - 28 / 3) < 1e-9 && Math.abs(x0.score - (28 / 3 + 5)) < 1e-9);
  const drop = heatsDone({ finals: 'a', finalMode: 'added', dropWorst: 'yes' }, 6, 4);
  drop.record(fake([{ p: 1 }, { p: 2 }, { p: 4 }, { p: 0 }]));
  const d0 = drop.overall().find(y => y.participant === 0);
  ok('a dropped heat stays dropped and the final is never dropped (28 - 8 + 5 = 25; the final does not count as a heat)', d0.score === 25 && d0.counted === 2 && d0.dropped.length === 1 && d0.heats === 3);
  const best = heatsDone({ finals: 'a', finalMode: 'added', countBy: 'best', bestHeats: 1 }, 6, 4);
  best.record(fake([{ p: 1 }, { p: 2 }, { p: 4 }, { p: 0 }]));
  ok('with the best heat only, the final comes on top of the best heat (10 + 5)', best.overall().find(y => y.participant === 0).score === 15);
}

// ---- by laps ----
{ const heats = [[0, 1], [1, 0]], mk = mode => { const a = E.createHeatRace({ participants: people(2), schedule: heats.map(h => h.map((p, i) => ({ p, lane: i }))), resultBy: 'laps', lanes: 2, finals: 'a', finalMode: mode });
    a.record(fake([{ p: 0, laps: 5 }, { p: 1, laps: 4 }])); a.record(fake([{ p: 1, laps: 5 }, { p: 0, laps: 4 }])); return a; };
  const places = mk('places'), added = mk('added');
  places.record(fake([{ p: 1, laps: 6 }, { p: 0, laps: 5 }])); added.record(fake([{ p: 1, laps: 6 }, { p: 0, laps: 5 }]));
  ok('by laps, the heats were level (9 laps each), and the final decides the places: 1 wins', order(places) === '1,0' && places.overall()[0].finalLaps === 6);
  ok('by laps, added: the laps of the final come on top: 1 has 9 + 6 = 15, 0 has 9 + 5 = 14', added.overall().map(o => o.score).join() === '15,14' && order(added) === '1,0');
  ok('both finalists race the A final: no B', places.total === 3 && places.finalPlan.length === 1);
}

// ---- the fastest lap and the best lap ----
{ const a = heatsDone({ finals: 'a', fastestBonus: 2 }, 6, 4);
  const r = a.record(fake([{ p: 1, best: 3000 }, { p: 2, best: 2900 }, { p: 4, best: 3200 }, { p: 0, best: 3100 }]));
  ok('the fastest lap of a final earns the bonus too (2 has 8 + 2 points)', r.rows.find(x => x.participant === 2).bonus === 2 && r.rows.find(x => x.participant === 2).points === 10 && r.rows.filter(x => x.bonus).length === 1);
  ok('the best lap of a driver includes the final', a.overall().find(x => x.participant === 2).best === 2900);
}

// ---- other ----
{ const a = make({ finals: 'a' }, 6, 4);
  ok('lanes that are not in the config are taken from the schedule (4 here)', make({ finals: 'a', lanes: undefined }).lanes === 4 && a.lanes === 4);
  const b = E.createHeatRace({ participants: people(3), schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps', finals: 'a' });
  ok('with no lanes and a schedule of two lanes the final has 2 lanes (A is 2 of 3 drivers)', b.lanes === 2 && b.total === 2);
  ok('a race with an unknown participant row does not break the overall', (() => { const x = make({ finals: 'a' }, 2, 2, [[0, 1]]); x.record({ standings: () => [{ pos: 1, car: { participant: 9, laps: [], total: null, best: null } }] }); return x.overall().length === 2; })());
}

console.log(fails ? `\n${fails} FINALS TESTS FAILED` : '\nfinals: all PASSED');
process.exit(fails ? 1 : 0);
