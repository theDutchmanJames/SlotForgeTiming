// Heat plans (0.92.0): the plan that Home shows before the race (heats.js), and what it means for every driver.
const H = require('../renderer/heats.js');
const E = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const seeded = seed => () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };

// ---- the shuffle that can be played again ----
{ const draw = (seed, n = 6) => { const r = H.makeRng(seed); return Array.from({ length: n }, r); };
  ok('the same seed gives the same numbers, another seed other numbers', JSON.stringify(draw(7)) === JSON.stringify(draw(7)) && JSON.stringify(draw(7)) !== JSON.stringify(draw(8)));
  ok('every number is at least 0 and under 1, and they are not all alike', draw(123, 500).every(x => x >= 0 && x < 1) && new Set(draw(123, 500)).size > 490);
  ok('a seed that is no number (or 0) still works', draw('x').length === 6 && draw(undefined).every(x => x >= 0 && x < 1) && draw(0).every(x => x >= 0 && x < 1));
  const seeds = new Set(Array.from({ length: 30 }, () => H.newSeed()));
  ok('a new seed is a whole number from 1, and they differ', seeds.size > 25 && [...seeds].every(s => Number.isInteger(s) && s >= 1 && s <= 4294967295));
}

// ---- the heat settings of a setup ----
{ const o = H.optionsOf;
  ok('a setup with nothing set gets the standards: I choose, 3 heats, 10 laps', JSON.stringify(o({})) === JSON.stringify({ plan: 'manual', heats: 3, each: 3, even: false, seeding: 'random', by: 'laps', laps: 10, minutes: 0 }) && o(undefined).plan === 'manual' && o(null).heats === 3);
  ok('round robin, a time limit and numbers are taken over (a number that is no number, or too small, is mended)', o({ heatPlan: 'roundrobin', heatBy: 'time', duration: 4, heats: '5', laps: 7 }).plan === 'roundrobin' && o({ heatBy: 'time', duration: '4.5' }).minutes === 4.5 && o({ heats: '5' }).heats === 5 && o({ heats: 0 }).heats === 1 && o({ heats: 'x' }).heats === 3 && o({ laps: -3 }).laps === 1 && o({ heatPlan: 'weird' }).plan === 'manual' && o({ heats: 2.9 }).heats === 2);
}

// ---- the plan ----
const people = n => n, setupOf = (over = {}) => ({ heatPlan: 'manual', heats: 3, heatBy: 'laps', laps: 5, ...over });
{ const a = H.plan({ count: 6, lanes: 2, setup: setupOf(), seed: 11 }), b = H.plan({ count: 6, lanes: 2, setup: setupOf(), seed: 11 }), c = H.plan({ count: 6, lanes: 2, setup: setupOf(), seed: 12 });
  ok('the same seed gives the same plan, another seed another plan', JSON.stringify(a) === JSON.stringify(b) && JSON.stringify(a) !== JSON.stringify(c));
  ok('"I choose" 3 heats for 6 drivers on 2 lanes: 3 heats of 2 drivers, everyone races once', a.length === 3 && a.every(h => h.length === 2) && H.stats(a, 6, 2).per.every(x => x.heats === 1));
  const rr = H.plan({ count: 6, lanes: 2, setup: setupOf({ heatPlan: 'roundrobin' }), seed: 3 });
  ok('round robin: every pair of the 6 drivers on 2 lanes meets (15 heats)', rr.length === 15 && H.stats(rr, 6, 2).missingPairs === 0);
}

// ---- is a saved plan still usable ----
{ const good = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }]];
  ok('a plan that fits the drivers and the lanes is usable', H.fits(good, 3, 2));
  ok('no plan, an empty plan, or something else is not', !H.fits(undefined, 3, 2) && !H.fits([], 3, 2) && !H.fits('x', 3, 2) && !H.fits([[]], 3, 2) && !H.fits([null], 3, 2));
  ok('a driver that is not there (any more) makes it unusable', !H.fits(good, 2, 2) && !H.fits([[{ p: -1, lane: 0 }]], 3, 2) && !H.fits([[{ p: 1.5, lane: 0 }]], 3, 2));
  ok('so does a lane that the track does not have (any more), or more cars than lanes', !H.fits(good, 3, 1) && !H.fits([[{ p: 0, lane: 2 }]], 3, 2) && !H.fits([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }]], 3, 2));
  ok('...and a driver twice in a heat, or two cars in a lane', !H.fits([[{ p: 0, lane: 0 }, { p: 0, lane: 1 }]], 3, 2) && !H.fits([[{ p: 0, lane: 0 }, { p: 1, lane: 0 }]], 3, 2));
}

// ---- what a plan means for the drivers ----
{ const sch = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }, { p: 3, lane: 2 }]];
  const st = H.stats(sch, 4, 3);
  ok('heats, heats per driver and the lanes of every driver', st.heats === 3 && st.per.map(x => x.heats).join() === '2,2,2,1' && st.per[0].lanes.join() === '1,1,0' && st.per[1].lanes.join() === '1,1,0' && st.per[3].lanes.join() === '0,0,1');
  ok('the fewest and the most heats, and that they are not equal', st.minHeats === 1 && st.maxHeats === 2 && st.equal === false);
  ok('with whom every driver races (driver 0: 1 and 2; driver 3: 1 and 2)', st.per[0].meets === 2 && st.per[3].meets === 2 && st.per[2].meets === 3);
  ok('pairs that never race together are counted (0-3 never meet)', st.missingPairs === 1);
  ok('lane spread: the biggest difference between the lane a driver used most and least', st.laneSpread === 1 && H.stats([[{ p: 0, lane: 0 }], [{ p: 0, lane: 0 }], [{ p: 0, lane: 1 }]], 1, 2).laneSpread === 1 && H.stats([[{ p: 0, lane: 0 }], [{ p: 0, lane: 0 }]], 1, 2).laneSpread === 2);
  const eq = H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 2);
  ok('everybody racing the same number of heats is equal', eq.equal && eq.minHeats === 1 && eq.maxHeats === 1 && H.stats([], 0, 2).equal);
}

// ---- the lines above the preview ----
{ const names = ['Alex', 'Sam', 'Kim', 'Lee'], one = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 3, lane: 1 }]];
  const eq = H.summary({ stats: H.stats(one, 4, 2), setup: setupOf({ heats: 2, laps: 8 }), names });
  ok('equal heats: how many heats of how many laps, and that every driver races one', eq.join(' ') === '2 heats, each 8 laps. Every driver races 1 heat.');
  const tm = H.summary({ stats: H.stats(one, 4, 2), setup: setupOf({ heatBy: 'time', duration: 4 }), names });
  ok('heats of a duration: the time of every heat and of all of them together', tm[0] === '2 heats, each 4 minutes (8 minutes of racing in total).');
  const uneven = H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]], 3, 2), setup: setupOf({ heats: 2 }), names });
  ok('unequal heats: a warning with the fewest and the most, why it matters, and what to choose instead (for "I choose")', /do not race the same number of heats: 1 to 2 \(2 race 1, 1 races 2\)/.test(uneven[1]) && /extra heat has an advantage/.test(uneven[1]) && /choose the plan "Every driver races the same number of heats"/.test(uneven[1]));
  ok('...for round robin it says to set "Same number of heats for everyone" to Yes, and for the plans that are always equal it says nothing more', /set "Same number of heats for everyone" to Yes/.test(H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]], 3, 2), setup: setupOf({ heatPlan: 'roundrobin' }), names })[1]) && !/To avoid it/.test(H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]], 3, 2), setup: setupOf({ heatPlan: 'perdriver' }), names })[1]));
  ok('one heat is "1 heat", not "1 heats"', H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 2), setup: setupOf({ heats: 1 }), names })[0] === '1 heat, each 5 laps.');
  const real = H.plan({ count: 13, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin' }), seed: 5 }), rs = H.stats(real, 13, 4);
  ok('round robin with 13 drivers on 4 lanes: every pair meets, and the preview warns that not everyone races the same number of heats', rs.missingPairs === 0 && !rs.equal && H.summary({ stats: rs, setup: setupOf({ heatPlan: 'roundrobin' }), names: Array.from({ length: 13 }, (_, i) => 'D' + i) }).some(t => /do not race the same number/.test(t)));
}


// ---- the plans: a lot of sizes, a few shuffles ----
const sizes = []; for (let count = 2; count <= 14; count++) for (let lanes = 1; lanes <= 6; lanes++) sizes.push([count, lanes]);
const valid = (sch, count, lanes) => H.fits(sch, count, lanes);
const every = (fn) => sizes.every(([c, l]) => [1, 2, 3].every(seed => fn(c, l, seed)));
{
  // same number of heats for everyone
  ok('"every driver races the same number of heats": everybody races exactly that many (1 to 4), at any number of drivers and lanes', [1, 2, 3, 4].every(n => every((c, l, seed) => { const sc = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'perdriver', heatsEach: n }), seed }); return valid(sc, c, l) && H.stats(sc, c, l).per.every(x => x.heats === n); })));
  ok('...the number of heats follows (drivers x heats each, shared over the places of a heat) and the heats are as full as they can be (sizes differ by at most one)', [2, 3].every(n => every((c, l, seed) => { const sc = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'perdriver', heatsEach: n }), seed }), k = Math.min(l, c), sz = sc.map(h => h.length); return sc.length === Math.ceil(c * n / k) && Math.max(...sz) - Math.min(...sz) <= 1 && Math.max(...sz) <= k; })));
  const e = H.plan({ count: 7, lanes: 4, setup: setupOf({ heatPlan: 'perdriver', heatsEach: 3 }), seed: 1 });
  ok('7 drivers on 4 lanes with 3 heats each: 6 heats of 4, 4, 4, 3, 3, 3 cars', e.length === 6 && e.map(h => h.length).sort().join() === '3,3,3,4,4,4');
  ok('heats of a driver are against changing opponents: with 8 drivers on 4 lanes and 3 heats each nobody races the same three drivers twice in a row', every((c, l, seed) => c !== 8 || l !== 4 || (() => { const sc = H.plan({ count: 8, lanes: 4, setup: setupOf({ heatPlan: 'perdriver', heatsEach: 3 }), seed }); return new Set(sc.map(h => h.map(x => x.p).sort().join())).size === sc.length; })()));
  // I choose
  ok('"I choose": the number of heats you choose, every heat as full as the track allows, nobody twice in a heat, and at most one heat apart', every((c, l, seed) => { const sc = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'manual', heats: 5 }), seed }), st = H.stats(sc, c, l); return valid(sc, c, l) && sc.length === 5 && sc.every(h => h.length === Math.min(l, c)) && st.maxHeats - st.minHeats <= 1; }));
  // round robin
  ok('round robin still makes every pair meet (and a track with one lane gives every driver a heat of their own)', every((c, l, seed) => { const sc = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'roundrobin' }), seed }); return valid(sc, c, l) && (l === 1 ? sc.length === c : H.stats(sc, c, l).missingPairs === 0); }));
  ok('"Same number of heats for everyone" makes them equal, keeps every pair meeting, and adds few heats (never more than one per driver)', every((c, l, seed) => { if (l === 1) return true; const plain = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'roundrobin' }), seed }), even = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'roundrobin', heatEven: 'yes' }), seed }), st = H.stats(even, c, l); return valid(even, c, l) && st.equal && st.missingPairs === 0 && even.length >= plain.length && even.length <= plain.length + c && even.slice(0, plain.length).length === plain.length; }));
  ok('...13 drivers on 4 lanes: 16 heats with 4 to 6 each become 20 heats with 6 each; 7 drivers: 5 heats with 2 to 3 become 7 heats with 4 each', (a => a.length === 20 && H.stats(a, 13, 4).per.every(x => x.heats === 6))(H.plan({ count: 13, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin', heatEven: 'yes' }), seed: 3 })) && (a => a.length === 7 && H.stats(a, 7, 4).per.every(x => x.heats === 4))(H.plan({ count: 7, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin', heatEven: 'yes' }), seed: 3 })));
  ok('...the setting off (or missing) leaves round robin as it was', JSON.stringify(H.plan({ count: 7, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin', heatEven: 'no' }), seed: 3 })) === JSON.stringify(H.plan({ count: 7, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin' }), seed: 3 })));
}

// ---- lane rotation ----
{
  ok('lane rotation: every driver races once in every lane, in as many heats as there are lanes (any number of drivers from 2 to 14, lanes 1 to 6)', every((c, l, seed) => { const sc = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'rotation' }), seed }), st = H.stats(sc, c, l); return valid(sc, c, l) && st.everyLaneOnce && st.per.every(x => x.heats === l && x.lanes.every(n => n === 1)); }));
  ok('...with as many drivers as lanes or more, there are as many heats as drivers, every heat full; with fewer drivers, as many heats as lanes, every driver in every heat', every((c, l, seed) => { const sc = H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: 'rotation' }), seed }); return c >= l ? sc.length === c && sc.every(h => h.length === l) : sc.length === l && sc.every(h => h.length === c); }));
  const r4 = H.plan({ count: 4, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 2 });
  ok('4 drivers on 4 lanes: 4 heats, everybody in every heat (with the others in the other lanes), every lane once', r4.length === 4 && r4.every(h => h.length === 4) && H.stats(r4, 4, 4).missingPairs === 0 && H.stats(r4, 4, 4).everyLaneOnce);
  const r13 = H.stats(H.plan({ count: 13, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 9 }), 13, 4);
  ok('13 drivers on 4 lanes: 13 heats, 4 each, and they meet most of the others (at most 20 of the 78 pairs never race together)', r13.heats === 13 && r13.equal && r13.maxHeats === 4 && r13.missingPairs <= 20);
  ok('another shuffle makes another rotation, the same seed the same one', JSON.stringify(H.plan({ count: 9, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 1 })) !== JSON.stringify(H.plan({ count: 9, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 2 })) && JSON.stringify(H.plan({ count: 9, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 1 })) === JSON.stringify(H.plan({ count: 9, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 1 })));
}

// ---- the lanes of every plan are shared as evenly as can be ----
{
  ok('in every plan, every driver uses the lanes evenly: no lane is used more than once more than another (all sizes, three shuffles each)', ['manual', 'perdriver', 'roundrobin', 'rotation'].every(plan => every((c, l, seed) => H.stats(H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: plan, heats: 7, heatsEach: 4 }), seed }), c, l).laneSpread <= 1)));
  ok('...and a driver who races no more heats than there are lanes never uses a lane twice', ['manual', 'perdriver', 'roundrobin'].every(plan => every((c, l, seed) => H.stats(H.plan({ count: c, lanes: l, setup: setupOf({ heatPlan: plan, heats: 3, heatsEach: 2 }), seed }), c, l).per.every(x => x.heats > l || x.lanes.every(n => n <= 1)))));
  const g = [[0, 1], [0, 1], [0, 1], [0, 1]], lanesOf = H.assignLanes(g, 2, H.makeRng(1));
  ok('two drivers in four heats on two lanes: each driver two times in each lane, and never two in a lane', lanesOf.every(h => h.length === 2 && new Set(h.map(e => e.lane)).size === 2) && H.stats(lanesOf, 2, 2).per.every(x => x.lanes.join() === '2,2'));
  ok('a heat that has fewer cars than lanes leaves lanes empty, and nobody is put in a lane the track does not have', H.assignLanes([[0], [0], [0]], 4, H.makeRng(5)).every(h => h.length === 1 && h[0].lane >= 0 && h[0].lane < 4) && H.assignLanes([], 3, H.makeRng(1)).length === 0);
}

// ---- colouring the edges (what gives every driver a lane of their own) ----
{ const rnd = H.makeRng(77); let good = true;
  for (let t = 0; t < 200 && good; t++) {
    const drivers = 1 + Math.floor(rnd() * 8), heats = 1 + Math.floor(rnd() * 8), colours = 1 + Math.floor(rnd() * 5), edges = [], dd = Array(drivers).fill(0), hd = Array(heats).fill(0);
    const all = []; for (let u = 0; u < drivers; u++) for (let v = 0; v < heats; v++) all.push([u, v]);
    all.sort(() => rnd() - 0.5);
    for (const [u, v] of all) if (dd[u] < colours && hd[v] < colours) { edges.push([u, v]); dd[u]++; hd[v]++; }
    const col = H.colourEdges(edges, drivers, heats, colours), seenU = new Set(), seenV = new Set();
    good = col.length === edges.length && edges.every(([u, v], n) => { const a = u + ':' + col[n], b = v + ':' + col[n]; const dup = seenU.has(a) || seenV.has(b); seenU.add(a); seenV.add(b); return col[n] >= 0 && col[n] < colours && !dup; });
  }
  ok('colouring: for 200 random graphs, no driver and no heat has a colour twice, with as many colours as the busiest has edges', good);
}

// ---- who races together: seeding by a qualifying ----
{ const ranks8 = [3, 6, 0, 7, 1, 5, 2, 4]; // participant 2 was fastest, then 4, then 6, 0, ...
  const fast4 = new Set([2, 4, 6, 0]);
  const sp = H.plan({ count: 8, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 2, heatSeeding: 'speed' }), seed: 3, ranks: ranks8 });
  ok('"by qualifying": the four fastest drivers race together, and their heat is the last one', sp.length === 2 && sp[1].every(e => fast4.has(e.p)) && sp[0].every(e => !fast4.has(e.p)));
  const mx = H.plan({ count: 8, lanes: 2, setup: setupOf({ heatPlan: 'manual', heats: 4, heatSeeding: 'mixed' }), seed: 3, ranks: ranks8 });
  ok('"mixed": every heat has one of the four fastest and one of the four slowest', mx.length === 4 && mx.every(h => h.filter(e => fast4.has(e.p)).length === 1));
  const same = JSON.stringify(H.plan({ count: 8, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 2, heatSeeding: 'speed' }), seed: 3, ranks: ranks8 })) === JSON.stringify(sp);
  ok('the same seed and qualifying give the same plan', same);
  const none = H.plan({ count: 8, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 2, heatSeeding: 'speed' }), seed: 3 }), shuffled = H.plan({ count: 8, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 2 }), seed: 3 });
  ok('without a qualifying (no ranks) the drivers are shuffled, and the heats are still full', none.length === 2 && none.every(h => h.length === 4) && valid(none, 8, 4) && shuffled.length === 2);
  const part = H.plan({ count: 6, lanes: 3, setup: setupOf({ heatPlan: 'manual', heats: 2, heatSeeding: 'speed' }), seed: 4, ranks: [0, null, 1, null, 2, undefined] });
  ok('drivers who were not in the qualifying (no rank) are placed last: the three who were race together in the last heat', part[1].map(e => e.p).sort().join() === '0,2,4' && part[0].map(e => e.p).sort().join() === '1,3,5');
  ok('with the same number of heats for everyone, "by qualifying" keeps the best drivers together heat after heat', (pd => pd.every(h => { const rs = h.map(e => ranks8[e.p]); return Math.max(...rs) - Math.min(...rs) <= 5; }) && H.stats(pd, 8, 4).per.every(x => x.heats === 2))(H.plan({ count: 8, lanes: 4, setup: setupOf({ heatPlan: 'perdriver', heatsEach: 2, heatSeeding: 'speed' }), seed: 3, ranks: ranks8 })));
  ok('round robin and lane rotation ignore the seeding (they choose the heats to make everyone meet)', JSON.stringify(H.plan({ count: 6, lanes: 3, setup: setupOf({ heatPlan: 'rotation', heatSeeding: 'speed' }), seed: 3, ranks: [0, 1, 2, 3, 4, 5] })) === JSON.stringify(H.plan({ count: 6, lanes: 3, setup: setupOf({ heatPlan: 'rotation' }), seed: 3 })));
  ok('the seeding of a setup: shuffled unless it says mixed or speed', H.optionsOf({ heatSeeding: 'mixed' }).seeding === 'mixed' && H.optionsOf({ heatSeeding: 'speed' }).seeding === 'speed' && H.optionsOf({ heatSeeding: 'x' }).seeding === 'random' && H.optionsOf({}).seeding === 'random');
}

// ---- the new lines above the preview ----
{ const names = ['A', 'B', 'C', 'D'], sc = H.plan({ count: 4, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 1 });
  ok('lane rotation: the preview says every driver races once in every lane', H.summary({ stats: H.stats(sc, 4, 4), setup: setupOf({ heatPlan: 'rotation' }), names }).includes('Every driver races once in every lane.'));
  const even = H.plan({ count: 6, lanes: 4, setup: setupOf({ heatPlan: 'perdriver', heatsEach: 3 }), seed: 1 });
  ok('other plans with several heats: the preview says the lanes are shared evenly', H.summary({ stats: H.stats(even, 6, 4), setup: setupOf({ heatPlan: 'perdriver', heatsEach: 3 }), names: Array(6).fill('x') }).includes('The lanes are shared evenly.'));
  const bad = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]];
  ok('a plan that uses one lane again and again (from a saved plan, say) is flagged in the preview', H.summary({ stats: H.stats(bad, 2, 2), setup: setupOf(), names }).some(t => /not shared evenly/.test(t)));
}

// ---- found by the deliberate-breakage run of 0.93.0 ----
{ const o = H.optionsOf;
  ok('"heats for every driver" is at least 1 (0 and a minus number are mended), and the "same number" setting also accepts a plain true', o({ heatsEach: 0 }).each === 1 && o({ heatsEach: -4 }).each === 1 && o({ heatsEach: 4 }).each === 4 && o({ heatEven: true }).even === true && o({ heatEven: 'yes' }).even === true && o({ heatEven: 'no' }).even === false && o({}).even === false);
  const rep = pl => { const c = {}; pl.forEach(g => { for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) { const k = Math.min(g[a].p, g[b].p) + '-' + Math.max(g[a].p, g[b].p); c[k] = (c[k] || 0) + 1; } }); return Object.values(c).reduce((s, x) => s + Math.max(0, x - 1), 0); };
  let tot = 0, n = 0; for (const [count, lanes, heats] of [[8, 2, 8], [6, 2, 6], [9, 3, 9], [12, 4, 6]]) for (let seed = 1; seed <= 40; seed++) { tot += rep(H.plan({ count, lanes, setup: setupOf({ heatPlan: 'manual', heats }), seed })); n++; }
  ok('the heats are filled with drivers who have not met yet: on average fewer than 4 repeated meetings in 160 plans (choosing the ones who have met most gives about 11)', tot / n < 4);
  // the extra heats of an even round robin: [0,1] raced twice, 2 with 3 and 4 with 5 once; the two extra heats must not be [2,3] and [4,5] again
  const extra = H.evenOut([[0, 1], [0, 1], [2, 3], [4, 5]], 6, 2, H.makeRng(5)).slice(4).map(g => g.slice().sort().join('-'));
  ok('the extra heats of a round robin that is made even match drivers who have met the fewest times', extra.length === 2 && !extra.includes('2-3') && !extra.includes('4-5') && [...extra.join('-').split('-')].sort().join() === '2,3,4,5');
  const two = (l0, l1) => [[{ p: 0, lane: l0[0] }, { p: 1, lane: l1[0] }], [{ p: 0, lane: l0[1] }, { p: 1, lane: l1[1] }], [{ p: 0, lane: l0[2] }, { p: 1, lane: l1[2] }]];
  const st = H.stats(two([0, 0, 1], [1, 1, 0]), 2, 2);
  ok('"every driver raced once in every lane" is only true when it is exactly once (2 and 1 is not)', st.everyLaneOnce === false && st.laneSpread === 1 && H.stats(two([0, 1, 0], [1, 0, 1]), 2, 2).everyLaneOnce === false && H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 1 }, { p: 1, lane: 0 }]], 2, 2).everyLaneOnce === true);
  const names = ['A', 'B'], text = sch => H.summary({ stats: H.stats(sch, 2, 2), setup: setupOf(), names });
  ok('a spread of 1 lane use is "shared evenly", a spread of 2 is flagged (3 heats in the same lane, 0 in the other, also 2 in one and 0 in the other)', text(two([0, 0, 1], [1, 1, 0])).includes('The lanes are shared evenly.')
    && text([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 0, lane: 0 }, { p: 1, lane: 1 }]]).some(t => /not shared evenly/.test(t)));
  ok('one heat only says nothing about lanes being shared, and one driver on their own gets no "every driver races" line', !H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 2), setup: setupOf(), names }).some(t => /shared evenly|not shared/.test(t))
    && !H.summary({ stats: H.stats(H.plan({ count: 1, lanes: 4, setup: setupOf(), seed: 1 }), 1, 4), setup: setupOf(), names: ['A'] }).some(t => /Every driver races/.test(t)));
}

// ---- 0.94.0: the preview and the way of counting ----
{ const uneven = H.plan({ count: 7, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 3 }), seed: 1 }), st = H.stats(uneven, 7, 4), names = Array.from({ length: 7 }, (_, i) => 'D' + i);
  const lines = over => H.summary({ stats: st, setup: setupOf({ heatPlan: 'manual', heats: 3, ...over }), names });
  ok('uneven heats added up: the red warning, with both ways out', lines({}).some(t => /do not race the same number/.test(t) && /Every driver races the same number of heats/.test(t) && /count the average per heat/.test(t)) && !lines({}).some(t => /^Overall result/.test(t)));
  ok('uneven heats as an average: it is fair, said without the red words', lines({ countBy: 'average' }).some(t => /result is the average per heat, so that is fair/.test(t)) && !lines({ countBy: 'average' }).some(t => /do not race the same/.test(t)));
  ok('uneven heats, only the best 1 counts or the worst is dropped: the same number counts, so it is fair', lines({ countBy: 'best', bestHeats: 1 }).some(t => /same number of heats counts for everyone/.test(t)) && lines({ dropWorst: 'yes' }).some(t => /same number of heats counts for everyone/.test(t)) && !lines({ dropWorst: 'yes' }).some(t => /do not race the same/.test(t)));
  ok('the best 2 while some drivers race 1: not fair, and the line about fewer heats', lines({ countBy: 'best', bestHeats: 2 }).some(t => /do not race the same/.test(t)) && lines({ countBy: 'best', bestHeats: 2 }).some(t => /Some drivers race fewer than 2 heats \(1\)/.test(t)));
  ok('the way of counting is the last line, by points only for the bonus', lines({ countBy: 'average', resultBy: 'points', fastestBonus: 2 }).slice(-1)[0] === 'Overall result: the average per heat; 2 bonus points for the fastest lap of every heat.' && lines({ countBy: 'average', resultBy: 'laps', fastestBonus: 2 }).slice(-1)[0] === 'Overall result: the average per heat.');
  const eq = H.stats(H.plan({ count: 4, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 2 }), seed: 1 }), 4, 4);
  ok('equal heats say so, whatever the counting, and the fewer-heats line is only for "best N" when heats are uneven and some have fewer than N', H.summary({ stats: eq, setup: setupOf({ heatPlan: 'manual', heats: 2, countBy: 'average' }), names: ['A', 'B', 'C', 'D'] }).some(t => /Every driver races 2 heats/.test(t)) && !H.summary({ stats: eq, setup: setupOf({ heatPlan: 'manual', heats: 2, countBy: 'best', bestHeats: 3 }), names: ['A', 'B', 'C', 'D'] }).some(t => /fewer than/.test(t)));
}

// ---- 0.95.0: the break between heats ----
{ const b = H.breakOf;
  ok('a setup with nothing set has no break and no automatic start', JSON.stringify(b({})) === '{"seconds":0,"auto":false}' && JSON.stringify(b(undefined)) === '{"seconds":0,"auto":false}' && JSON.stringify(b(null)) === '{"seconds":0,"auto":false}');
  ok('the seconds are whole numbers from 0 to 3600 (a text, a minus number or nothing is mended)', b({ breakSeconds: '90' }).seconds === 90 && b({ breakSeconds: 90.9 }).seconds === 90 && b({ breakSeconds: -5 }).seconds === 0 && b({ breakSeconds: 'x' }).seconds === 0 && b({ breakSeconds: 99999 }).seconds === 3600 && b({ breakSeconds: '' }).seconds === 0);
  ok('the clock of a break: seconds as minutes and seconds (65 is 1:05, 5 is 0:05, 600 is 10:00; nothing or a minus number is 0:00, a part of a second counts as the next second)', H.clock(65) === '1:05' && H.clock(5) === '0:05' && H.clock(600) === '10:00' && H.clock(0) === '0:00' && H.clock(-3) === '0:00' && H.clock('x') === '0:00' && H.clock(undefined) === '0:00' && H.clock(59.2) === '1:00' && H.clock(3600) === '60:00' && H.clock(90) === '1:30' && H.clock(119) === '1:59' && H.clock(121) === '2:01');
  ok('automatic start is only "yes" (or true)', b({ breakAuto: 'yes' }).auto === true && b({ breakAuto: true }).auto === true && b({ breakAuto: 'no' }).auto === false && b({ breakAuto: 'x' }).auto === false);
}

// ---- 0.95.0: changing the plan by hand ----
{ const plan0 = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }, { p: 2, lane: 2 }], [{ p: 3, lane: 0 }, { p: 4, lane: 1 }], [{ p: 5, lane: 2 }, { p: 0, lane: 1 }, { p: 3, lane: 0 }]];
  const copy = JSON.stringify(plan0), sw = (a, b, sch = plan0) => H.swap(sch, { heat: a[0], lane: a[1] }, { heat: b[0], lane: b[1] }, 6, 3);
  const lanesOf = (sch, h) => sch[h].map(e => e.p + '@' + e.lane).join();
  let r = sw([0, 0], [0, 2]);
  ok('two places in the same heat swap their lanes (drivers 0 and 2 in heat 1)', r.schedule && lanesOf(r.schedule, 0) === '2@0,1@1,0@2' && lanesOf(r.schedule, 1) === lanesOf(plan0, 1));
  r = sw([0, 1], [1, 1]);
  ok('two places in different heats swap the drivers: driver 1 (heat 1, lane 2) and driver 4 (heat 2, lane 2)', r.schedule && lanesOf(r.schedule, 0) === '0@0,4@1,2@2' && lanesOf(r.schedule, 1) === '3@0,1@1');
  r = sw([1, 2], [0, 2]);
  ok('a driver moves to an empty place in another heat when the other place is empty (heat 2 has no one in lane 3: driver 2 swaps with the empty place)', r.schedule && lanesOf(r.schedule, 0) === '0@0,1@1' && lanesOf(r.schedule, 1) === '3@0,4@1,2@2');
  r = sw([1, 1], [1, 2]);
  ok('...and within a heat a driver moves into the empty lane', r.schedule && lanesOf(r.schedule, 1) === '3@0,4@2');
  ok('the plan that was given is not changed', JSON.stringify(plan0) === copy);
  ok('a changed plan still fits (no driver twice in a heat, no lane twice, no empty heat)', [sw([0, 0], [0, 2]), sw([0, 1], [1, 1]), sw([1, 2], [0, 2]), sw([1, 1], [1, 2])].every(x => H.fits(x.schedule, 6, 3)));
  ok('a driver who would be in the same heat twice is refused, with a sentence (driver 0 of heat 1 swaps with driver 5 of heat 3, where driver 0 already races)', (x => x.error === 'That would put a driver in the same heat twice.' && !x.schedule)(sw([0, 0], [2, 2])));
  ok('...also when it is the other driver who would be there twice (driver 3 of heat 2 swaps with driver 5 of heat 3, where driver 3 already races)', sw([1, 0], [2, 2]).error === 'That would put a driver in the same heat twice.');
  const lone = [[{ p: 0, lane: 0 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }]];
  ok('a heat can not be left without drivers (the only driver of heat 1 moves into an empty place of heat 2)', H.swap(lone, { heat: 0, lane: 0 }, { heat: 1, lane: 2 }, 3, 3).error === 'A heat needs at least one driver.');
  ok('...and the other way round (driver 5 of heat 3 swaps with driver 3 of heat 2: driver 3 would be in heat 3 twice)', sw([2, 2], [1, 0]).error === 'That would put a driver in the same heat twice.');
  ok('the same place twice, two empty places and places that are not in the plan are refused', sw([0, 0], [0, 0]).error === 'Those are the same place.' && sw([1, 2], [1, 2]).error === 'Those are the same place.' && H.swap(lone, { heat: 0, lane: 1 }, { heat: 0, lane: 2 }, 3, 3).error === 'Both places are empty.'
    && sw([0, 0], [9, 0]).error === 'That place is not in the plan.' && sw([0, 0], [0, 3]).error === 'That place is not in the plan.' && sw([-1, 0], [0, 0]).error === 'That place is not in the plan.' && H.swap(undefined, { heat: 0, lane: 0 }, { heat: 0, lane: 1 }, 1, 2).error === 'That place is not in the plan.' && H.swap(plan0, { heat: 0.5, lane: 0 }, { heat: 0, lane: 1 }, 6, 3).error === 'That place is not in the plan.');
  const many = H.plan({ count: 9, lanes: 4, setup: setupOf({ heatPlan: 'rotation' }), seed: 5 });
  let good = 0, bad = 0, tries = 0;
  for (let h1 = 0; h1 < many.length; h1++) for (let l1 = 0; l1 < 4; l1++) for (let h2 = 0; h2 < many.length; h2++) for (let l2 = 0; l2 < 4; l2++) { const x = H.swap(many, { heat: h1, lane: l1 }, { heat: h2, lane: l2 }, 9, 4); tries++; if (x.schedule) { good++; if (!H.fits(x.schedule, 9, 4) || H.stats(x.schedule, 9, 4).per.map(q => q.heats).join() !== H.stats(many, 9, 4).per.map(q => q.heats).join()) bad++; } }
  ok(`every swap that is allowed keeps the plan valid and every driver's number of heats (${good} of ${tries} swaps in a rotation of 9 drivers are allowed)`, good > 0 && bad === 0);
}
{ const k = (over = {}) => H.planKey({ count: 6, lanes: 4, setup: setupOf({ heatPlan: 'manual', heats: 3 }), seed: 9, ranks: null, ...over });
  ok('the key of a plan: the same for the same plan', k() === k() && k({ ranks: null }) === k({ ranks: undefined }));
  ok('...another for another number of drivers, lanes, seed or qualifying', k() !== k({ count: 7 }) && k() !== k({ lanes: 3 }) && k() !== k({ seed: 10 }) && k() !== k({ ranks: [0, 1, 2, 3, 4, 5] }) && k({ ranks: [0, 1, 2, 3, 4, 5] }) !== k({ ranks: [1, 0, 2, 3, 4, 5] }));
  ok('...another for other heat settings (plan, heats, heats for every driver, equal heats, seeding)', k() !== k({ setup: setupOf({ heatPlan: 'rotation' }) }) && k() !== k({ setup: setupOf({ heatPlan: 'manual', heats: 4 }) }) && H.planKey({ count: 6, lanes: 4, setup: setupOf({ heatPlan: 'perdriver', heatsEach: 2 }), seed: 9 }) !== H.planKey({ count: 6, lanes: 4, setup: setupOf({ heatPlan: 'perdriver', heatsEach: 3 }), seed: 9 })
    && H.planKey({ count: 6, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin', heatEven: 'no' }), seed: 9 }) !== H.planKey({ count: 6, lanes: 4, setup: setupOf({ heatPlan: 'roundrobin', heatEven: 'yes' }), seed: 9 }) && k() !== k({ setup: setupOf({ heatPlan: 'manual', heats: 3, heatSeeding: 'speed' }) }));
  ok('...but not for the length of a heat, the points, the way of counting or the break (a changed plan stays)', k() === k({ setup: setupOf({ heatPlan: 'manual', heats: 3, laps: 12, heatBy: 'time', duration: 4, resultBy: 'points', countBy: 'average', dropWorst: 'yes', fastestBonus: 2, tieBreak: 'wins', breakSeconds: 60, breakAuto: 'yes' }) }));
}

// ---- 0.96.0: finals in words ----
{ const names = ['Alex', 'Sam', 'Kim', 'Lee', 'Max', 'Eva'], sch = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 3, lane: 1 }], [{ p: 4, lane: 0 }, { p: 5, lane: 1 }]];
  const sum = over => H.summary({ stats: H.stats(sch, 6, 2), setup: setupOf({ heats: 3, laps: 8, ...over }), names });
  ok('without finals nothing is said about them', sum({}).join(' ') === sum({ finals: 'none' }).join(' ') && !sum({}).some(l => /final/i.test(l)));
  ok('a final A: how many drivers, and that the best-placed driver chooses a lane first', sum({ finals: 'a' }).includes('Then a final A with the best 2 drivers of the heat result. In a final the best-placed driver chooses a lane first.'));
  ok('...the finals decide the places by default', sum({ finals: 'a' }).includes('The finals decide the final places: the heat result only decides who races in which final.'));
  ok('...or the final is added to the heat result', sum({ finals: 'a', finalMode: 'added' }).includes('What a driver scores in a final is added to the heat result.') && !sum({ finals: 'a', finalMode: 'added' }).some(l => /decide the final places/.test(l)));
  ok('a final B races before the final A and is said first (6 drivers on 2 lanes: 2 and 2)', sum({ finals: 'ab' }).includes('Then a final A with the best 2 drivers of the heat result, after a final B with the next 2 drivers. In a final the best-placed driver chooses a lane first.'));
  const three = H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]], 3, 2), setup: setupOf({ heats: 2, finals: 'ab' }), names });
  ok('with one driver left over there is no final B, and it says why', three.some(l => /^Then a final A with the best 2 drivers of the heat result \(only one driver is left over, so there is no final B\)\./.test(l)));
  const all = H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 2), setup: setupOf({ heats: 1, finals: 'ab' }), names });
  ok('...and when everybody is in the final A, that there is no final B', all.some(l => /all the drivers, so there is no final B/.test(l)));
  const one = H.summary({ stats: H.stats([[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], 2, 1), setup: setupOf({ heats: 1, finals: 'a' }), names });
  ok('with one lane there are no finals, and it says so', one.includes('No finals: with one lane or one driver nobody can race against anybody.'));
  ok('a final of its own length is mentioned (laps, or minutes for a race by time); the length of a heat is not', sum({ finals: 'a', finalLaps: 12 }).includes('A final is 12 laps long.') && sum({ finals: 'a', heatBy: 'time', duration: 4, finalDuration: 6 }).includes('A final is 6 minutes long.') && !sum({ finals: 'a', finalLaps: 0 }).some(l => /long\./.test(l)) && !sum({ finals: 'a', heatBy: 'time', finalLaps: 12 }).some(l => /laps long/.test(l)));
  ok('a race by time says nothing about a length of 0 minutes (and not about laps either)', !sum({ finals: 'a', heatBy: 'time', duration: 4 }).some(l => /long\./.test(l)) && !sum({ finals: 'a', heatBy: 'time', duration: 4, finalDuration: 0 }).some(l => /long\./.test(l)));
  ok('the finals do not change the plan: the plan key stays the same', H.planKey({ count: 6, lanes: 2, setup: setupOf({ heats: 3 }), seed: 1 }) === H.planKey({ count: 6, lanes: 2, setup: setupOf({ heats: 3, finals: 'ab', finalMode: 'added', finalLaps: 5 }), seed: 1 }));
}
{ const fin = { finalMode: 'added', byPoints: true };
  ok('ordinals: 1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 101st 111th', [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(H.ordinal).join() === '1st,2nd,3rd,4th,11th,12th,13th,21st,22nd,23rd,101st,111th');
  ok('the Final column: the final and the place, just the final before it was raced, nothing for a driver who is in no final', H.finalCell({ finalName: 'A', finalPos: 1 }) === 'Final A: 1st' && H.finalCell({ finalName: 'B', finalPos: 3 }) === 'Final B: 3rd' && H.finalCell({ finalName: 'A', finalPos: null }) === 'Final A' && H.finalCell({ finalName: 'A' }) === 'Final A' && H.finalCell({ finalName: null, finalPos: null }) === '' && H.finalCell({}) === '');
  ok('race names: heats and finals (a saved result with a final field is a final)', H.raceName({ heat: 2 }) === 'Heat 2' && H.raceName({ heat: 3, final: 'B' }) === 'Final B' && H.raceName({ heat: 4, final: 'A', rows: [] }) === 'Final A');
  ok('what the finals did, in one sentence', H.finalsSaid({ finalMode: 'added' }) === 'What a driver scores in a final is added to the heat result.' && H.finalsSaid({ finalMode: 'places' }) === 'The finals decide the final places.' && H.finalsSaid({}) === 'The finals decide the final places.' && H.finalsSaid(undefined) === 'The finals decide the final places.');
  const row = { score: 25, heatScore: 20, counted: 2, heats: 3, finalPos: 1, finalPoints: 5, finalLaps: 5 };
  ok('the Result column of a final that is added: the heat part, the final and the sum', H.scoreText(row, { countBy: 'total' }, fin) === '20 (2 of 3 heats) + 5 final = 25' && H.scoreText(row, { countBy: 'average' }, fin) === '20 avg (2 of 3 heats) + 5 final = 25');
  ok('...a saved row of a driver who was in no final has no final fields at all: nothing is added (and no NaN)', H.scoreText({ score: 9, counted: 2, heats: 2 }, { countBy: 'total' }, fin) === '9' && H.scoreText({ score: 9, heatScore: 9, counted: 2, heats: 2, finalName: 'B' }, { countBy: 'total' }, fin) === '9');
  ok('...by laps it is the laps of the final that come on top', H.scoreText({ ...row, finalLaps: 7, score: 27 }, { countBy: 'total' }, { finalMode: 'added', byPoints: false }) === '20 (2 of 3 heats) + 7 final = 27');
  ok('...nothing is added for a driver who is in no final, and nothing when the finals decide the places or the caller has no final information (as before)', H.scoreText({ score: 9, heatScore: 9, counted: 3, heats: 3, finalPos: null }, { countBy: 'total' }, fin) === '9' && H.scoreText(row, { countBy: 'total' }, { finalMode: 'places', byPoints: true }) === '25 (2 of 3 heats)' && H.scoreText(row, { countBy: 'total' }) === '25 (2 of 3 heats)' && H.scoreText({ score: 9, counted: 2, heats: 2 }, { countBy: 'average' }) === '9 avg');
}

// ---- 1.24.0: a heat race that was interrupted: the state of the heats as plain data, and back ----
{ const people = [0, 1, 2].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i }));
  const sched = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 1, lane: 0 }, { p: 2, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
  const mkH = (o = {}) => E.createHeatRace({ participants: people, schedule: o.schedule || sched, resultBy: 'laps', points: [], lanes: 2, finals: o.finals || 'none' });
  const fake = (a, b) => ({ standings: () => [{ pos: 1, car: { participant: a, laps: [1, 1], total: 2, best: 1 } }, { pos: 2, car: { participant: b, laps: [1], total: 2, best: 1 } }] });
  const A = mkH({ finals: 'a' }); A.record(fake(0, 1)); A.record(fake(1, 2));
  const snap = A.snapshot(), plain = JSON.parse(JSON.stringify(snap));
  ok('the snapshot of the heats is plain data: it goes through JSON and comes back the same', JSON.stringify(plain) === JSON.stringify(snap) && snap.v === 1 && snap.idx === 2 && snap.results.length === 2 && JSON.stringify(snap.schedule) === JSON.stringify(sched));
  ok('...it is a copy: later heats are not in it', (A.record(fake(2, 0)), snap.results.length === 2 && snap.idx === 2));
  const B = mkH({ finals: 'a' }), done = JSON.parse(JSON.stringify(snap));
  ok('it goes back into a heat race made with the same settings: the heats that are done, and the same overall result', B.restore(done) === true && B.idx === 2 && B.results.length === 2 && JSON.stringify(B.overall()) === JSON.stringify((() => { const C = mkH({ finals: 'a' }); C.record(fake(0, 1)); C.record(fake(1, 2)); return C.overall(); })()));
  ok('...the next heat is the one after the heats that are done', B.hasNext() && B.raceName(B.idx) === 'Heat 3' && JSON.stringify(B.entries().map(e => e.participant)) === JSON.stringify([2, 0]));
  done.results.push({ heat: 3, rows: [] }); done.idx = 3; const F = mkH({ finals: 'a' });
  ok('the finals come back: the plan of the final and the lanes that were chosen', (A.finalPlan !== null) && (F.restore({ ...JSON.parse(JSON.stringify(A.snapshot())), picks: { A: [{ p: 0, lane: 1 }] } }) === true) && F.idx === 3 && F.finalPlan.length === 1 && F.finalPlan[0].name === 'A' && F.finalNow().picks.length === 1 && F.finalNow().picks[0].lane === 1 && F.isFinal());
  const bad = (name, change, mk2 = () => mkH({ finals: 'a' })) => { const t = mk2(), before = JSON.stringify(t.snapshot()), s2 = JSON.parse(JSON.stringify(snap)); change(s2); return t.restore(s2) === false && JSON.stringify(t.snapshot()) === before; };
  ok('a snapshot that does not fit is refused and changes nothing: nothing at all, another version, no list of results', [null, undefined, 'x', {}].every(x => mkH().restore(x) === false) && bad('v', s2 => { s2.v = 2; }) && bad('results', s2 => { delete s2.results; }));
  ok('...a number of heats that is not the number of results, or more than there are', bad('count', s2 => { s2.idx = 1; }) && bad('many', s2 => { s2.idx = 9; s2.results = new Array(9).fill({ rows: [] }); }) && bad('neg', s2 => { s2.idx = -1; s2.results = []; }));
  ok('...other heats (another plan, so other drivers or lanes)', bad('plan', s2 => { s2.schedule = sched.slice(0, 2); }) && bad('lane', s2 => { s2.schedule = [[{ p: 0, lane: 1 }, { p: 1, lane: 0 }], ...sched.slice(1)]; }));
  ok('...a final that is missing or is another one, a driver that is not there, lanes that are no list of choices', (() => { const T = mkH({ finals: 'a' }); const s3 = JSON.parse(JSON.stringify(A.snapshot())); const t1 = mkH({ finals: 'a' }); const f1 = JSON.parse(JSON.stringify(s3)); f1.finalPlan = null; const f2 = JSON.parse(JSON.stringify(s3)); f2.finalPlan[0].name = 'B'; const f3 = JSON.parse(JSON.stringify(s3)); f3.finalPlan[0].drivers = [0, 9]; const f4 = JSON.parse(JSON.stringify(s3)); f4.picks = []; return t1.restore(f1) === false && T.restore(f2) === false && mkH({ finals: 'a' }).restore(f3) === false && mkH({ finals: 'a' }).restore(f4) === false && T.idx === 0 && T.results.length === 0; })());
  ok('a heat race without finals needs no plan of the final', mkH().restore(JSON.parse(JSON.stringify(snap))) === true && (() => { const N = mkH(); N.restore({ v: 1, schedule: sched, idx: 1, results: [{ heat: 1, rows: [] }], finalPlan: null, picks: {} }); return N.idx === 1 && N.finalPlan === null && Object.keys(N.picks).length === 0; })()); }

console.log(fails ? `\n${fails} HEAT PLAN TESTS FAILED` : '\nheats: all PASSED');
process.exit(fails ? 1 : 0);
