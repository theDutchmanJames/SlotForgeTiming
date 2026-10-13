// How the heats add up to the overall result (0.94.0): average per heat, the best heats only, dropping the worst heat, a bonus for the fastest lap, the tie-breakers.
const E = require('../renderer/engine.js');
const H_ = require('../renderer/heats.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const people = n => Array.from({ length: n }, (_, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
// a finished heat without the real race: rows in finishing order, { p: participant, laps, total (ms), best (ms) }
const fake = rows => ({ standings: () => rows.map((r, i) => ({ pos: i + 1, car: { participant: r.p, laps: Array(r.laps).fill(0), total: r.total === undefined ? null : r.total, best: r.best === undefined ? null : r.best } })) });
// heats: list of lists of rows; returns the heat race after all of them
const run = (n, heats, cfg = {}) => {
  const H = E.createHeatRace({ participants: people(n), schedule: heats.map(h => h.map(r => ({ p: r.p, lane: 0 }))), resultBy: 'points', points: [10, 8, 6, 5, 4, 3], ...cfg });
  heats.forEach(h => H.record(fake(h)));
  return H;
};
const order = H => H.overall().map(o => o.participant).join();

// ---- the settings ----
{ const d = E.scoringOf({}), ex = E.scoringOf;
  ok('a setup with nothing set gets the standards: all heats added up, nothing dropped, no bonus, the standard tie-breaker', JSON.stringify(d) === JSON.stringify({ countBy: 'total', bestHeats: 2, dropWorst: false, fastestBonus: 0, tieBreak: 'default' }) && JSON.stringify(ex(undefined)) === JSON.stringify(d) && JSON.stringify(ex(null)) === JSON.stringify(d));
  ok('the choices are taken over, and something that is no choice is mended', ex({ countBy: 'average' }).countBy === 'average' && ex({ countBy: 'best' }).countBy === 'best' && ex({ countBy: 'weird' }).countBy === 'total' && ex({ dropWorst: 'yes' }).dropWorst === true && ex({ dropWorst: true }).dropWorst === true && ex({ dropWorst: 'no' }).dropWorst === false && ex({ tieBreak: 'wins' }).tieBreak === 'wins' && ex({ tieBreak: 'time' }).tieBreak === 'time' && ex({ tieBreak: 'bestlap' }).tieBreak === 'bestlap' && ex({ tieBreak: 'x' }).tieBreak === 'default');
  ok('the numbers are mended: heats that count are 1 to 50 (2 when it is no number), a bonus is 0 or more', ex({ bestHeats: '3' }).bestHeats === 3 && ex({ bestHeats: 0 }).bestHeats === 1 && ex({ bestHeats: 900 }).bestHeats === 50 && ex({ bestHeats: 'x' }).bestHeats === 2 && ex({ bestHeats: 2.9 }).bestHeats === 2 && ex({ fastestBonus: '2' }).fastestBonus === 2 && ex({ fastestBonus: -3 }).fastestBonus === 0 && ex({ fastestBonus: 'x' }).fastestBonus === 0 && ex({ fastestBonus: 0.5 }).fastestBonus === 0.5);
  ok('the heats module hands out the same function', H_.optionsOf && typeof E.scoringOf === 'function');
}

// ---- the standard did not change: the same result as the sort of before 0.94.0 ----
{
  // a reference of the old rule, written out here: sort by laps (or points) then the other, then the best lap
  const reference = (n, heats, resultBy) => {
    const acc = Array.from({ length: n }, (_, i) => ({ i, laps: 0, points: 0, best: null }));
    heats.forEach(h => h.forEach((r, k) => { const a = acc[r.p]; a.laps += r.laps; a.points += [10, 8, 6, 5, 4, 3][k] || 0; if (r.best !== null && (a.best === null || r.best < a.best)) a.best = r.best; }));
    acc.sort((a, b) => (resultBy === 'points' ? b.points - a.points || b.laps - a.laps : b.laps - a.laps || b.points - a.points) || (a.best ?? 1e12) - (b.best ?? 1e12));
    return acc.map(a => a.i).join();
  };
  let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  let same = 0, total = 0;
  for (let t = 0; t < 300; t++) {
    const n = 2 + Math.floor(rnd() * 5), hn = 1 + Math.floor(rnd() * 4), heats = [];
    for (let h = 0; h < hn; h++) { const ps = [...Array(n).keys()].sort(() => rnd() - 0.5).slice(0, 1 + Math.floor(rnd() * Math.min(n, 4))); heats.push(ps.map(p => ({ p, laps: Math.floor(rnd() * 6), total: 1000 * (5 + Math.floor(rnd() * 20)), best: rnd() < 0.15 ? null : 1000 * (2 + Math.floor(rnd() * 3)) }))); }
    for (const resultBy of ['points', 'laps']) {
      // heats are recorded in finishing order, so sort each heat the way the race does (more laps first)
      const sorted = heats.map(h => h.slice().sort((a, b) => b.laps - a.laps));
      const H = run(n, sorted, { resultBy });
      total++; if (order(H) === reference(n, sorted, resultBy)) same++;
    }
  }
  ok(`the standard gives the same order as the rule of before (${total} random results, by laps and by points)`, same === total);
}

// ---- the average per heat ----
{ // A raced two heats (10 and 8 points), B one heat (10 points)
  const heats = [[{ p: 1, laps: 5, best: 3000 }, { p: 0, laps: 4, best: 3100 }], [{ p: 0, laps: 5, best: 3000 }]];
  const tot = run(2, heats), avg = run(2, heats, { countBy: 'average' });
  ok('added up, the driver with the extra heat wins (A 8+10=18 points against B 10)', order(tot) === '0,1' && tot.overall()[0].score === 18);
  ok('by the average per heat, the driver with one heat can win: A 9 points a heat, B 10', order(avg) === '1,0' && avg.overall()[0].score === 10 && avg.overall()[1].score === 9);
  ok('the laps and points columns still show everything that was driven (A: 9 laps, 18 points)', avg.overall()[1].laps === 9 && avg.overall()[1].points === 18 && avg.overall()[1].heats === 2 && avg.overall()[1].counted === 2);
  const lap = run(2, heats, { resultBy: 'laps', countBy: 'average' });
  ok('by laps the average is in laps a heat: A 4.5, B 5; B wins', order(lap) === '1,0' && lap.overall()[0].score === 5 && lap.overall()[1].score === 4.5);
  ok('a driver who has not raced yet has an average of 0 (no division by nothing)', (h => h.overall().every(o => Number.isFinite(o.score)) && h.overall().find(o => o.participant === 2).score === 0)(run(3, heats, { countBy: 'average' })));
}

// ---- only the best heats count ----
{ // three heats, six drivers
  const h2 = [[{ p: 0, laps: 5 }, { p: 1, laps: 4 }], [{ p: 2, laps: 5 }, { p: 3, laps: 4 }, { p: 4, laps: 3 }, { p: 5, laps: 2 }, { p: 1, laps: 1 }, { p: 0, laps: 1 }], [{ p: 1, laps: 5 }, { p: 0, laps: 4 }]];
  // A: heat 1 10 points, heat 2 3 points (6th place), heat 3 8 points. B: heat 1 8, heat 2 4 (5th place), heat 3 10.
  const best2 = run(6, h2, { countBy: 'best', bestHeats: 2 }), all = run(6, h2);
  const a = best2.overall().find(o => o.participant === 0), b = best2.overall().find(o => o.participant === 1);
  ok('best 2 of 3: A counts 10 and 8 (18), B counts 10 and 8 (18); all three added up it is A 21 and B 22', a.score === 18 && b.score === 18 && a.counted === 2 && b.counted === 2 && all.overall().find(o => o.participant === 0).score === 21 && all.overall().find(o => o.participant === 1).score === 22);
  ok('the heats that did not count are named (A: heat 2, B: heat 2)', JSON.stringify(a.dropped) === '[2]' && JSON.stringify(b.dropped) === '[2]');
  const best1 = run(6, h2, { countBy: 'best', bestHeats: 1 });
  ok('best 1 of 3: only the best heat counts (A 10, B 10)', best1.overall().find(o => o.participant === 0).score === 10 && best1.overall().find(o => o.participant === 1).score === 10);
  const many = run(6, h2, { countBy: 'best', bestHeats: 9 });
  ok('more heats than a driver raced: all of them count', many.overall().every(o => o.counted === o.heats) && many.overall().find(o => o.participant === 0).score === 21);
}

// ---- dropping the worst heat ----
{ const heats = [[{ p: 0, laps: 5 }, { p: 1, laps: 4 }], [{ p: 1, laps: 5 }, { p: 0, laps: 2 }], [{ p: 0, laps: 5 }, { p: 1, laps: 4 }]];
  // A: 10, 8, 10 points (second in heat 2). B: 8, 10, 8.
  const drop = run(2, heats, { dropWorst: 'yes' }), plain = run(2, heats);
  const A = drop.overall().find(o => o.participant === 0), B = drop.overall().find(o => o.participant === 1);
  ok('without dropping A has 28 and B 26; dropping the worst heat A has 20 (10+10) and B 18 (10+8)', plain.overall().find(o => o.participant === 0).score === 28 && plain.overall().find(o => o.participant === 1).score === 26 && A.score === 20 && B.score === 18 && A.counted === 2 && B.counted === 2);
  ok('the heat that was dropped is named, and of equal heats the later one is dropped (A: heat 2; B: heat 3 as the heats 1 and 3 are equal)', JSON.stringify(A.dropped) === '[2]' && JSON.stringify(B.dropped) === '[3]');
  const one = run(2, [[{ p: 0, laps: 5 }, { p: 1, laps: 4 }]], { dropWorst: 'yes' });
  ok('a driver with one heat does not drop it', one.overall().every(o => o.counted === 1 && o.dropped.length === 0) && one.overall()[0].score === 10);
  const combo = run(2, heats, { dropWorst: 'yes', countBy: 'average' });
  ok('dropping and the average together: the average of the heats that count (A 10, B 9)', combo.overall().find(o => o.participant === 0).score === 10 && combo.overall().find(o => o.participant === 1).score === 9);
  const combo2 = run(2, heats, { dropWorst: 'yes', countBy: 'best', bestHeats: 1 });
  ok('dropping and the best heats together: first the worst goes, then the best one counts', combo2.overall().every(o => o.counted === 1 && o.score === 10));
  const byLaps = run(2, heats, { resultBy: 'laps', dropWorst: 'yes' });
  ok('by laps the worst heat is the one with the fewest laps (A: 5, 2, 5 laps -> 10 laps; B: 4, 5, 4 -> 9)', byLaps.overall().find(o => o.participant === 0).score === 10 && byLaps.overall().find(o => o.participant === 1).score === 9 && JSON.stringify(byLaps.overall().find(o => o.participant === 0).dropped) === '[2]');
}

// ---- the bonus for the fastest lap ----
{ const heat = [{ p: 0, laps: 5, best: 3200 }, { p: 1, laps: 4, best: 3000 }, { p: 2, laps: 3, best: 3100 }];
  const H = run(3, [heat], { fastestBonus: 2 }), rows = H.results[0].rows;
  ok('the driver with the fastest lap of the heat gets the bonus in that heat: 2nd place 8 + 2 = 10, and the row says so', rows[1].points === 10 && rows[1].bonus === 2 && rows[0].points === 10 && rows[0].bonus === undefined && rows[2].points === 6 && rows[2].bonus === undefined);
  ok('the bonus is part of the points of the overall result', H.overall().find(o => o.participant === 1).points === 10 && H.overall().find(o => o.participant === 1).score === 10);
  const tie = run(2, [[{ p: 0, laps: 5, best: 3000 }, { p: 1, laps: 5, best: 3000 }]], { fastestBonus: 1 });
  ok('the same fastest lap: the bonus goes to the one who finished higher, and only one bonus is given', tie.results[0].rows[0].bonus === 1 && tie.results[0].rows[1].bonus === undefined);
  const none = run(2, [[{ p: 0, laps: 0 }, { p: 1, laps: 0 }]], { fastestBonus: 1 });
  ok('nobody set a lap: no bonus', none.results[0].rows.every(r => r.bonus === undefined) && none.overall().every(o => o.points === [10, 8][o.pos - 1]));
  const laps = run(3, [heat], { resultBy: 'laps', points: [], fastestBonus: 5 });
  ok('a result by laps has no bonus (it is points)', laps.results[0].rows.every(r => r.bonus === undefined && r.points === 0));
  const off = run(3, [heat]);
  ok('no bonus set (0): nothing is added', off.results[0].rows.every(r => r.bonus === undefined) && off.results[0].rows[1].points === 8);
  // the bonus is part of the points of a heat, so it also decides which heat is the worst
  const heats = [[{ p: 0, laps: 5, best: 3100 }, { p: 1, laps: 4, best: 3000 }], [{ p: 1, laps: 5, best: 3200 }, { p: 0, laps: 4, best: 3000 }]];
  // heat 1: A first (10), the fastest lap is B's (8 + 3 = 11); heat 2: B first (10), the fastest lap is A's (8 + 3 = 11)
  const mix = run(2, heats, { fastestBonus: 3, dropWorst: 'yes' }), plain = run(2, heats, { dropWorst: 'yes' });
  const A = mix.overall().find(o => o.participant === 0), B = mix.overall().find(o => o.participant === 1);
  ok('with the bonus A has 10 and 11 (drops the 10, keeps 11) and B has 11 and 10 (drops the 10, keeps 11)', A.score === 11 && B.score === 11 && JSON.stringify(A.dropped) === '[1]' && JSON.stringify(B.dropped) === '[2]');
  ok('without the bonus A drops the 8 of heat 2 (keeps 10), so the bonus did change which heat is dropped', plain.overall().find(o => o.participant === 0).score === 10 && JSON.stringify(plain.overall().find(o => o.participant === 0).dropped) === '[2]');
}

// ---- who wins a tie ----
{ // A and B: 10 + 8 = 18 points and 9 laps each; the heats were won by A (heat 1) and B (heat 2); A has the best lap, B the lower total time
  const heats = [[{ p: 0, laps: 5, total: 20000, best: 3000 }, { p: 1, laps: 4, total: 21000, best: 3300 }], [{ p: 1, laps: 5, total: 19000, best: 3500 }, { p: 0, laps: 4, total: 22000, best: 3600 }]];
  ok('standard: the same points and laps, then the best lap: A (3.000) before B', order(run(2, heats)) === '0,1');
  ok('"the fastest lap first": A', order(run(2, heats, { tieBreak: 'bestlap' })) === '0,1');
  // heat wins: give B two wins and A one with the same points: use three heats with points 10, 8, 6...
  const w = [[{ p: 0, laps: 5, total: 20000, best: 3000 }, { p: 1, laps: 5, total: 21000, best: 3100 }, { p: 2, laps: 5, total: 22000, best: 3200 }],
    [{ p: 1, laps: 5, total: 20000, best: 3000 }, { p: 2, laps: 5, total: 21000, best: 3100 }, { p: 0, laps: 5, total: 22000, best: 3200 }],
    [{ p: 2, laps: 5, total: 20000, best: 3000 }, { p: 0, laps: 5, total: 21000, best: 3100 }, { p: 1, laps: 5, total: 22000, best: 3200 }]];
  const cyc = run(3, w, { tieBreak: 'wins' });
  ok('three drivers with the same laps and points: the standard puts them in the order of their best lap, which is equal here, so the order of the drivers', order(run(3, w)) === '0,1,2');
  ok('"the most heat wins": each has one win here, so it falls back to the standard order', order(cyc) === '0,1,2' && cyc.overall().every(o => o.wins === 1));
  // equal drivers, with the points 6, 4, 2: A wins heat 1 and is last in heat 2 (6+2), B is second twice (4+4), C is last in heat 1 and wins heat 2 (2+6)
  const p2 = { points: [6, 4, 2] };
  const e = [[{ p: 0, laps: 5, total: 20000, best: 3500 }, { p: 1, laps: 5, total: 21000, best: 3000 }, { p: 2, laps: 5, total: 22000, best: 3100 }],
    [{ p: 2, laps: 5, total: 20000, best: 3100 }, { p: 1, laps: 5, total: 21000, best: 3000 }, { p: 0, laps: 5, total: 22000, best: 3500 }]];
  // A: 6 + 2 = 8 (one win), B: 4 + 4 = 8 (no win, best lap 3.000, total 42 s), C: 2 + 6 = 8 (one win)
  const std = run(3, e, p2), wins = run(3, e, { ...p2, tieBreak: 'wins' }), time = run(3, e, { ...p2, tieBreak: 'time' }), bl = run(3, e, { ...p2, tieBreak: 'bestlap' });
  ok('equal points and laps: the standard goes by the best lap (B 3.000, C 3.100, A 3.500)', order(std) === '1,2,0');
  ok('"the fastest lap first" gives the same here', order(bl) === '1,2,0');
  ok('"the most heat wins": A and C have a win, B has none, so B goes last; A and C by the best lap (C 3.100 before A 3.500)', order(wins) === '2,0,1' && wins.overall().map(o => o.wins).join() === '1,1,0');
  ok('"the lowest total time": A 20+22 = 42 s, B 21+21 = 42 s, C 22+20 = 42 s: equal, so the standard follows (B, C, A)', order(time) === '1,2,0');
  const e2 = e.map(h => h.map(r => ({ ...r, total: r.p === 2 ? r.total - 1000 : r.total })));
  ok('"the lowest total time" with C 2 s quicker: C first, then the standard (B before A)', order(run(3, e2, { ...p2, tieBreak: 'time' })) === '2,1,0');
  ok('the points decide before any tie-breaker: a driver with more points wins whatever the tie-breaker', ['default', 'bestlap', 'wins', 'time'].every(t => order(run(2, [[{ p: 0, laps: 4, total: 30000, best: 4000 }, { p: 1, laps: 4, total: 20000, best: 2000 }]], { tieBreak: t })) === '0,1'));
  const tl = run(2, [[{ p: 0, laps: 4 }, { p: 1, laps: 3 }]], { resultBy: 'laps', tieBreak: 'time' });
  ok('with no times at all it still works (no laps driven, times are unknown)', order(tl) === '0,1');
}

// ---- the order of equal heats, and what the columns show when heats are left out ----
{ // points 10 only: second and third place get nothing, so two heats can be worth the same
  const eqPts = run(2, [[{ p: 0, laps: 5 }, { p: 1, laps: 4 }], [{ p: 1, laps: 5 }, { p: 0, laps: 3 }], [{ p: 1, laps: 5 }, { p: 0, laps: 4 }]], { points: [10], dropWorst: 'yes' });
  ok('heats with the same points: the one with fewer laps is the worse (A: 10, then 0 with 3 laps, then 0 with 4 laps -> the 3-lap heat goes, though it is the earlier one)', JSON.stringify(eqPts.overall().find(o => o.participant === 0).dropped) === '[2]');
  const eqLaps = run(2, [[{ p: 0, laps: 5 }, { p: 1, laps: 4 }], [{ p: 1, laps: 5, total: 30000 }, { p: 0, laps: 4, total: 41000 }], [{ p: 1, laps: 5 }, { p: 0, laps: 4, total: 36000 }]], { points: [10], dropWorst: 'yes' });
  ok('heats with the same points and laps: the higher total time is the worse (A: 0 points with 4 laps in 41 s and in 36 s -> the 41 s goes)', JSON.stringify(eqLaps.overall().find(o => o.participant === 0).dropped) === '[2]');
  const heats = [[{ p: 0, laps: 5 }, { p: 1, laps: 4 }], [{ p: 1, laps: 5 }, { p: 0, laps: 2 }], [{ p: 0, laps: 5 }, { p: 1, laps: 4 }]];
  const A = run(2, heats, { dropWorst: 'yes' }).overall().find(o => o.participant === 0);
  ok('what was driven is still shown when a heat is dropped: A has 12 laps and 28 points over 3 heats, with 2 counting', A.laps === 12 && A.points === 28 && A.heats === 3 && A.counted === 2 && A.score === 20);
  const best1 = run(2, heats, { countBy: 'best', bestHeats: 1 }).overall().find(o => o.participant === 1);
  ok('the heats that did not count are listed from the first to the last (best 1 of 3: heats 2 and 3 are left out for B, who was second twice and first once)', JSON.stringify(best1.dropped) === '[1,3]');
}
{ // a win in a heat that is dropped does not count as a win; the tie-breakers follow each other in order
  // laps: A 2 (wins), 5, 6 (wins); B 1, 6 (wins), 5. The worst heat goes (A's 2 laps, B's 1 lap): both 11 laps and 1 counted win each
  const w = [[{ p: 0, laps: 2, best: 3600 }, { p: 1, laps: 1, best: 3500 }], [{ p: 1, laps: 6, best: 3000 }, { p: 0, laps: 5, best: 3500 }], [{ p: 0, laps: 6, best: 3600 }, { p: 1, laps: 5, best: 3200 }]];
  const r = run(2, w, { resultBy: 'laps', points: [], dropWorst: 'yes', tieBreak: 'wins' });
  ok('A won a heat that was dropped: that win does not count (1 win each), so the best lap decides (B 3.000 before A 3.500)', r.overall().map(o => o.wins).join() === '1,1' && order(r) === '1,0');
  // equal points (10 each), 1 win each, A more laps (11 against 9) but the worse best lap (3.500 against 3.000)
  const t = [[{ p: 0, laps: 6, best: 3500 }, { p: 1, laps: 4, best: 3000 }], [{ p: 1, laps: 5, best: 3000 }, { p: 0, laps: 5, best: 3500 }]];
  const std = run(2, t, { points: [6, 4] }), wins = run(2, t, { points: [6, 4], tieBreak: 'wins' }), bl = run(2, t, { points: [6, 4], tieBreak: 'bestlap' });
  ok('equal points: the standard looks at the laps first (A 11 laps before B 9), "the most heat wins" falls back to the same when the wins are equal', order(std) === '0,1' && order(wins) === '0,1');
  ok('"the fastest lap first" puts the better lap before the laps (B 3.000 before A 3.500)', order(bl) === '1,0');
  // total times: the heat with no laps has no time at all, which is the worst time
  const n = [[{ p: 0, laps: 5, total: 20000 }, { p: 1, laps: 5, total: 21000 }], [{ p: 1, laps: 5, total: 22000 }, { p: 0, laps: 0 }]];
  const tm = run(2, n, { points: [6, 4], tieBreak: 'time' });
  ok('a heat without a time makes the total time unknown (the worst): B (43 s) before A (20 s and nothing)', order(tm) === '1,0');
}

// ---- before any heat, and the saved heats ----
{ const H = E.createHeatRace({ participants: people(3), schedule: [[{ p: 0, lane: 0 }]], resultBy: 'points', points: [10], countBy: 'average', dropWorst: 'yes', fastestBonus: 1, tieBreak: 'wins' });
  const o = H.overall();
  ok('before the first heat everybody has 0, in the order of the drivers, nothing is NaN', o.length === 3 && o.map(x => x.participant).join() === '0,1,2' && o.every(x => x.score === 0 && x.counted === 0 && x.heats === 0 && x.dropped.length === 0 && x.best === null));
  ok('the engine says which settings it uses', H.scoring.countBy === 'average' && H.scoring.dropWorst === true && H.scoring.fastestBonus === 1 && H.scoring.tieBreak === 'wins');
}

// ---- the words ----
{ const t = (cfg, by = true) => H_.scoringText(E.scoringOf(cfg), by);
  ok('the standard has no words', t({}) === '' && t({ fastestBonus: 2 }, false) === '');
  ok('the average, the best heats, dropping, the bonus and the tie-breaker are each named', t({ countBy: 'average' }) === 'Overall result: the average per heat.' && t({ countBy: 'best', bestHeats: 2 }) === 'Overall result: only the best 2 heats of every driver count.' && t({ countBy: 'best', bestHeats: 1 }).includes('only the best 1 heat of every driver counts') && t({ dropWorst: 'yes' }) === 'Overall result: the worst heat of every driver is dropped.' && t({ fastestBonus: 1 }) === 'Overall result: 1 bonus point for the fastest lap of every heat.' && t({ fastestBonus: 2 }).includes('2 bonus points') && t({ tieBreak: 'wins' }) === 'Overall result: a tie is decided by the most heat wins first.' && t({ tieBreak: 'bestlap' }).includes('the fastest lap first') && t({ tieBreak: 'time' }).includes('the lowest total time first'));
  ok('all together in one line', t({ countBy: 'average', dropWorst: 'yes', fastestBonus: 1, tieBreak: 'wins' }) === 'Overall result: the average per heat; the worst heat of every driver is dropped; 1 bonus point for the fastest lap of every heat; a tie is decided by the most heat wins first.');
  const sc = E.scoringOf({ countBy: 'average' });
  ok('the Result column: the number that counts (two decimals at most), "avg" for an average, and how many heats counted', H_.scoreText({ score: 9, counted: 2, heats: 2 }, sc) === '9 avg' && H_.scoreText({ score: 8.3333333, counted: 3, heats: 3 }, sc) === '8.33 avg' && H_.scoreText({ score: 18, counted: 2, heats: 3 }, E.scoringOf({ countBy: 'best' })) === '18 (2 of 3 heats)' && H_.scoreText({ score: 9.5, counted: 2, heats: 3 }, sc) === '9.5 avg (2 of 3 heats)');
  ok('the fair-or-not lines: counted heats per driver', H_.countedHeats(3, E.scoringOf({})) === 3 && H_.countedHeats(3, E.scoringOf({ dropWorst: 'yes' })) === 2 && H_.countedHeats(1, E.scoringOf({ dropWorst: 'yes' })) === 1 && H_.countedHeats(5, E.scoringOf({ countBy: 'best', bestHeats: 2 })) === 2 && H_.countedHeats(1, E.scoringOf({ countBy: 'best', bestHeats: 2 })) === 1 && H_.countedHeats(5, E.scoringOf({ countBy: 'best', bestHeats: 3, dropWorst: 'yes' })) === 3 && H_.countedHeats(3, E.scoringOf({ countBy: 'best', bestHeats: 3, dropWorst: 'yes' })) === 2);
}

console.log(fails ? `\n${fails} SCORING TESTS FAILED` : '\nscoring: all PASSED');
process.exit(fails ? 1 : 0);
