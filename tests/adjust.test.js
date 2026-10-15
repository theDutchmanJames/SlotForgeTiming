// 1.2.0: in the review of a race the Race Director can add or take off race time, laps and championship points of a driver.
// Here: the engine (R.adjust), the heat race that carries it into the heat result, the text for it (Stats.adjustedText) and the review panel (review.js).
global.RaceEngine = require('../renderer/engine.js');
global.Stats = require('../renderer/stats.js');
global.Icons = require('../renderer/icons.js');
global.esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const { createRace, createHeatRace } = RaceEngine, Review = require('../renderer/review.js'), S = Stats;
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const names = ['A', 'B', 'C'];
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: names[i], carName: 'car' + names[i] }));
// a race of 2 laps in which A is faster: A finishes at 10 s, B at 12 s
const race = (o = {}) => { const r = createRace({ type: 'race', laps: 2, endRule: 'all', entries: entries(o.cars || 2), ...o }); r.start(0); r.cross(0, 5000); r.cross(0, 10000); r.cross(1, 6000); r.cross(1, 12000); return r; };
const order = r => r.standings().map(x => x.index).join('');

// ---- the text ----
ok('the text says laps, then time, then points, with a real minus sign', S.adjustedText({ adjLaps: -1, adjMs: 5000, adjPoints: 3 }) === '−1 lap, +5 s, +3 pts');
ok('...one lap or one point is singular, and what is zero is left out', S.adjustedText({ adjLaps: 2 }) === '+2 laps' && S.adjustedText({ adjPoints: -1 }) === '−1 pt' && S.adjustedText({ adjLaps: 0, adjMs: 0, adjPoints: 0 }) === '');
ok('...the time is in seconds, with the milliseconds that are there', S.adjustedText({ adjMs: -1500 }) === '−1.5 s' && S.adjustedText({ adjMs: 1234 }) === '+1.234 s' && S.adjustedText({ adjMs: 60000 }) === '+60 s' && S.adjustedText({ adjMs: 1234.5678 }) === '+1.235 s');
ok('...nothing, or something that is not a row, gives nothing', S.adjustedText(null) === '' && S.adjustedText(undefined) === '' && S.adjustedText({}) === '' && S.adjustedText({ adjMs: 'x' }) === '');

// ---- time ----
let r = race();
ok('without an adjustment A wins, and the cars carry no adjustment', order(r) === '01' && r.cars.every(c => !c.adjMs && !c.adjLaps && !c.adjPoints) && r.lapsOf(r.cars[0]) === 2);
ok('adding 3 s to A (13 s against 12 s) puts B first', r.adjust(0, { ms: 3000 }) === true && r.cars[0].adjMs === 3000 && order(r) === '10');
ok('...the laps and the lap times are not touched, and the penalty is a different thing', r.cars[0].total === 10000 && r.cars[0].laps.join() === '5000,5000' && r.penMs(r.cars[0]) === 0);
ok('taking 4 s off A puts A first again (stacking: +3 s, then -4 s = -1 s)', r.adjust(0, { ms: -4000 }) && r.cars[0].adjMs === -1000 && order(r) === '01');
ok('the gap of the second car counts the adjustment (A 9 s, B 12 s: +3.000)', r.standings()[1].gap === '+3.000');
ok('the gaps for the spoken calls count the adjustment too (B is 2.000 behind A; A gets +1 s: 1.000 behind, and the gap to the car in front is the same)', (() => { const q = race(); const before = q.gapInfo()[1]; q.adjust(0, { ms: 1000 }); const g = q.gapInfo()[1]; return before.lead === 2000 && g.lead === 1000 && g.ahead === 1000; })());
ok('a deduction cannot take the time below zero', r.adjust(1, { ms: -99000 }) === true && r.cars[1].adjMs === -12000 && r.cars[1].total + r.cars[1].adjMs === 0);
ok('...and when it is at zero another deduction changes nothing', r.adjust(1, { ms: -1000 }) === false && r.cars[1].adjMs === -12000);
ok('...adding gives it back', r.adjust(1, { ms: 2500 }) && r.cars[1].adjMs === -9500);
ok('a deduction counts the penalty too: a car with a time penalty cannot go below zero in the sum either', (() => {
  const p = race({ penalty: { on: true, mode: 'every', every: 1, seconds: 2 } }); p.addPoints(0, 3, 9000); const pen = p.penMs(p.cars[0]);
  p.adjust(0, { ms: -99000 }); return pen > 0 && p.cars[0].adjMs === -(10000 + pen);
})());
ok('milliseconds are whole numbers: 1.4 ms is 1 ms', (() => { const q = race(); q.adjust(0, { ms: 1.4 }); return q.cars[0].adjMs === 1; })());

// ---- laps ----
r = race();
ok('taking a lap off A (the winner, with 2 laps) puts B first, with the full race', r.adjust(0, { laps: -1 }) && r.lapsOf(r.cars[0]) === 1 && r.cars[0].laps.length === 2 && order(r) === '10');
ok('...the laps driven stay as they were (no lap time is invented or lost)', r.cars[0].laps.join() === '5000,5000' && r.cars[0].best === 5000);
ok('adding a lap to A gives it back (and more: 3 laps counts before the time)', r.adjust(0, { laps: 2 }) && r.lapsOf(r.cars[0]) === 3 && order(r) === '01');
ok('laps cannot go below none', r.adjust(1, { laps: -9 }) && r.lapsOf(r.cars[1]) === 0 && r.cars[1].adjLaps === -2 && r.adjust(1, { laps: -1 }) === false);
ok('laps are whole numbers: 1.6 laps is 2', (() => { const q = race(); q.adjust(1, { laps: 1.6 }); return q.cars[1].adjLaps === 2; })());
{ const t = createRace({ type: 'timed', duration: 1, entries: entries(2) }); t.start(0); t.cross(0, 5000); t.cross(0, 10000); t.cross(1, 6000); t.cross(1, 12000);
  ok('in a timed race the laps count first, then the time: B with 2 laps and a time of 12 s is behind A with 2 laps in 10 s', order(t) === '01');
  t.adjust(1, { laps: 1 }); ok('...a lap added to B puts B first', order(t) === '10' && t.lapsOf(t.cars[1]) === 3);
  t.adjust(1, { laps: -1 }); t.adjust(1, { ms: -3000 }); ok('...the time decides when the laps are equal: -3 s makes B (9 s) faster than A', order(t) === '10');
}
{ const q = createRace({ type: 'race', laps: 3, endRule: 'leader', entries: entries(2) }); q.start(0); q.cross(0, 4000); q.cross(1, 6000); q.cross(0, 8000); q.cross(1, 11000); q.cross(0, 12000);
  ok('(a race that ended when the leader finished: the car with fewer laps is second, as before)', order(q) === '01');
  q.adjust(0, { laps: -2 }); ok('...an adjustment of laps puts the leader (1 lap now) behind the car with 2 laps, finished or not', order(q) === '10'); }
{ const p = createRace({ type: 'qualifying', duration: 1, entries: entries(2) }); p.start(0); p.cross(0, 5000); p.cross(0, 9000); p.cross(1, 6000); p.cross(1, 11000);
  const before = order(p); p.adjust(0, { laps: -1, ms: 99000 });
  ok('qualifying and practice are about the best lap: an adjustment does not change their order', before === '01' && order(p) === before); }

// ---- points, reset, wrong input ----
r = race();
ok('championship points stack, with up to two decimals', r.adjust(0, { points: 3 }) && r.adjust(0, { points: 2.555 }) && r.cars[0].adjPoints === 5.56 && r.adjust(0, { points: -7 }) && r.cars[0].adjPoints === -1.44);
ok('...the points can go below zero (a deduction is a deduction)', r.cars[0].adjPoints < 0);
r.adjust(0, { laps: 1, ms: 500 });
ok('adjOf gives the three', JSON.stringify(r.adjOf(r.cars[0])) === JSON.stringify({ ms: 500, laps: 1, points: -1.44 }));
ok('Reset takes all three away at once, and says false when there is nothing to reset', r.adjustReset(0) === true && JSON.stringify(r.adjOf(r.cars[0])) === JSON.stringify({ ms: 0, laps: 0, points: 0 }) && order(r) === '01' && r.adjustReset(0) === false);
ok('an adjustment of nothing changes nothing', r.adjust(0, {}) === false && r.adjust(0, { ms: 0, laps: 0, points: 0 }) === false);
ok('wrong input changes nothing: not a number, empty, null, text', [{ ms: NaN }, { ms: '' }, { laps: null }, { points: 'many' }, { ms: Infinity }, { ms: undefined }].every(a => r.adjust(0, a) === false) && !r.cars[0].adjMs);
ok('...a car that is not there, or nothing at all', r.adjust(7, { ms: 1 }) === false && r.adjust(-1, { ms: 1 }) === false && r.adjust(0) === false && r.adjust(0, null) === false && r.adjustReset(7) === false);
ok('...and so is something that only looks like a number: true, a list with one number, a blank text', [{ ms: true }, { ms: [5] }, { laps: ' ' }, { points: [] }, { ms: {} }].every(a => r.adjust(0, a) === false) && !r.cars[0].adjMs && !r.cars[0].adjLaps && !r.cars[0].adjPoints);
ok('numbers that come as text are understood (they come from a field)', r.adjust(0, { ms: '2000', laps: '1' }) && r.cars[0].adjMs === 2000 && r.cars[0].adjLaps === 1);

ok('every adjustment is in the race log (what changed, not the total), and so is a reset', (() => { const q = race(); q.adjust(0, { ms: 3000, laps: -1 }); q.adjust(0, { ms: -1000 }); q.adjustReset(0); const e = q.events.filter(x => x.type === 'adjusted');
  return e.length === 3 && e[0].car === 0 && e[0].ms === 3000 && e[0].laps === -1 && e[0].points === 0 && e[1].ms === -1000 && e[2].reset === true; })());
ok('a change that did nothing is not logged', (() => { const q = race(); q.adjust(0, {}); q.adjust(0, { ms: NaN }); q.adjustReset(0); return !q.events.some(x => x.type === 'adjusted'); })());

// ---- a heat race: the heat result carries the adjustment ----
const people = names.map((x, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: x, carName: 'car' + x }));
const plan = [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]];
const heat = (resultBy, extra = {}) => createHeatRace({ participants: people, schedule: plan, resultBy, points: resultBy === 'points' ? [10, 8, 6] : [], ...extra });
const run = H => { const q = createRace({ type: 'race', laps: 2, endRule: 'all', entries: H.entries() }); q.start(0); q.cross(0, 5000); q.cross(0, 10000); q.cross(1, 6000); q.cross(1, 12000); return q; };
{ const H = heat('points'), q = run(H); const plain = JSON.stringify(H.record(run(heat('points'))).rows);
  ok('a heat without adjustments has the rows it always had (no adjustment fields)', !/adj/.test(plain));
  q.adjust(0, { points: 5 }); q.adjust(1, { laps: -1, ms: 2000, points: -3 });
  const rows = H.record(q).rows, a = rows.find(x => x.participant === 0), b = rows.find(x => x.participant === 1);
  ok('the points of the place plus the points adjusted: A is first (10 + 5), B second (8 - 3)', a.pos === 1 && a.points === 15 && b.pos === 2 && b.points === 5);
  ok('...B drove 2 laps and has 1 counted, and a time with 2 s on it', b.laps === 1 && b.total === 14000 && a.laps === 2 && a.total === 10000);
  ok('...the row says what was adjusted, and only what was', a.adjPoints === 5 && a.adjMs === undefined && a.adjLaps === undefined && b.adjLaps === -1 && b.adjMs === 2000 && b.adjPoints === -3);
  const H2 = heat('points'), q2 = run(H2); q2.adjust(0, { points: 5 }); H2.record(q2); const q3 = run(H2); H2.record(q3);
  const ov = H2.overall(), oa = ov.find(x => x.participant === 0);
  ok('the overall result adds it up: A has 15 + 8 (heat 2: place 2) = 23 points, and says it adjusted 5', oa.points === 23 && oa.adjPoints === 5 && oa.pos === 1);
  ok('...the others have no adjustment fields', ov.filter(x => x.participant !== 0).every(x => x.adjPoints === undefined && x.adjMs === undefined && x.adjLaps === undefined));
  { const Hm = heat('points'), qm = run(Hm); qm.adjust(0, { ms: 2000, points: 0.1 }); Hm.record(qm); const qn = run(Hm); qn.adjust(1, { ms: -500, points: 0.2 }); Hm.record(qn);
    const om = Hm.overall().find(x => x.participant === 0);
    ok('the overall result adds up the time of the adjustments of the heats too (+2 s, then -0.5 s)', om.adjMs === 1500 && Hm.overall().filter(x => x.participant !== 0).every(x => x.adjMs === undefined));
    ok('...and the points of the adjustments without the rounding errors of adding 0.1 and 0.2 (0.3)', om.adjPoints === 0.3); }
  const H3 = heat('points'), q4 = run(H3); q4.adjust(0, { laps: -1 }); H3.record(q4);
  ok('the overall laps are the adjusted ones too', H3.overall().find(x => x.participant === 0).laps === 1 && H3.overall().find(x => x.participant === 0).adjLaps === -1);
  const H4 = heat('points'), q5 = run(H4); q5.adjust(1, { points: 20 }); H4.record(q5); H4.record(run(H4));
  ok('enough championship points change the overall order (B 28 beats A 18)', H4.overall()[0].participant === 1);
}
{ const Hf = heat('points', { finals: 'a', lanes: 2, rnd: () => 0 }); Hf.record(run(Hf)); Hf.record(run(Hf)); const qf = run(Hf), who = qf.cars[0].participant; qf.adjust(0, { points: 4, ms: 1000, laps: -1 }); Hf.record(qf);
  const fo = Hf.overall().find(x => x.participant === who);
  ok('what was adjusted in a final counts in the overall result too (the final is not a heat)', Hf.results[2].final === 'A' && fo.adjPoints === 4 && fo.adjMs === 1000 && fo.adjLaps === -1 && fo.heats === (Hf.results.slice(0, 2).filter(r => r.rows.some(x => x.participant === who)).length)); }
{ const H = heat('laps'), q = run(H); q.adjust(0, { points: 5, laps: 1 }); const rows = H.record(q).rows, a = rows.find(x => x.participant === 0);
  ok('a race that is not decided on points ignores championship points (no points, no field), but the laps count', a.points === 0 && a.adjPoints === undefined && a.laps === 3 && a.adjLaps === 1); }
{ const H = heat('points', { fastestBonus: 2 }), q = run(H); q.adjust(1, { points: 1 }); const rows = H.record(q).rows;
  ok('the bonus for the fastest lap and the adjustment both come on top of the points of the place', rows.find(x => x.participant === 0).points === 12 && rows.find(x => x.participant === 1).points === 9); }

{ const fake = c => ({ standings: () => [{ pos: 1, car: { participant: 0, laps: [4000, 5000], total: null, best: 4000, ...c } }] });
  const row = heat('points').record({ ...fake(), adjOf: () => ({ ms: 1000, laps: 0, points: 0 }), lapsOf: c => c.laps.length }).rows[0];
  ok('a heat without a known time stays without it when time is added (the adjustment is in the row, the unknown time is not made up)', row.total === null && row.adjMs === 1000);
  const plain = heat('points').record(fake({ total: 9000 })).rows[0];
  ok('a stand-in race that has no adjustments (as in other tests) gives plain rows', plain.laps === 2 && plain.total === 9000 && plain.points === 10 && !('adjMs' in plain) && !('adjLaps' in plain) && !('adjPoints' in plain)); }

// ---- the review panel ----
const rev = (o = {}) => { const q = race(o); q.finish && q.finish(); return q; };
const champ = { on: true, list: [10, 8, 6] };
r = rev();
let h = Review.html(r, {});
ok('the review has an Adjust button for every driver of a race', (h.match(/data-rv="adjopen"/g) || []).length === 2 && />Adjust<\/button>/.test(h) && !h.includes('data-rva'));
ok('...and no Points column without championship points', !h.includes('<th>Points</th>'));
for (const type of ['practice', 'qualifying']) { const q = createRace({ type, duration: 1, entries: entries(2) }); q.start(0); q.cross(0, 5000); ok('no Adjust in ' + type + ' (it is about the best lap)', !Review.html(q, { champ }).includes('adjopen')); }
{ const q = createRace({ type: 'timed', duration: 1, entries: entries(2) }); q.start(0); q.cross(0, 5000); ok('a timed race can be adjusted', Review.html(q, {}).includes('adjopen')); }
Review.ui.adjust.add(1); h = Review.html(r, {});
const panel = h.split('Adjust the result of B')[1] || '';
ok('an open panel has the time and laps fields of that driver, each with Add and Deduct', panel.includes('data-rva="1:time"') && panel.includes('data-rva="1:laps"') && (panel.match(/data-sign="1"/g) || []).length === 2 && (panel.match(/data-sign="-1"/g) || []).length === 2 && !h.includes('data-rva="0:'));
ok('...the fields have names for a screen reader, and the panel says nothing is adjusted yet', /aria-label="Seconds to add to or take off the race time of B"/.test(h) && panel.includes('nothing adjusted yet') && !panel.includes('adjustreset'));
ok('...the button of the open panel says Hide adjust and is marked open', /data-rv="adjopen" data-car="1" aria-expanded="true"[^>]*>Hide adjust</.test(h));
ok('...no points field without championship points', !panel.includes(':points'));
h = Review.html(r, { champ }); ok('with championship points there is a Points column, with the points of the place, and a points field', h.includes('<th>Points</th>') && /<td class="num">10<\/td>/.test(h) && /<td class="num">8<\/td>/.test(h) && h.includes('data-rva="1:points"') && h.includes('Championship points'));
ok('a championship that is not on shows nothing of it', !Review.html(r, { champ: { on: false, list: [10] } }).includes('Points</th>') && !Review.html(r, { champ: null }).includes(':points'));
r.adjust(1, { laps: -1, ms: 2000, points: 3 }); h = Review.html(r, { champ });
ok('an adjusted driver shows the adjusted laps (with the laps driven), the time with the adjustment, the points, and what was adjusted', /<td class="num">1<br><small class="muted">2 driven<\/small><\/td>/.test(h) && h.includes('adjusted: −1 lap, +2 s, +3 pts') && h.includes('<strong>14.000</strong>') && /<td class="num">11<\/td>/.test(h));
ok('...the panel says so and offers Reset', (h.split('Adjust the result of B')[1] || '').includes('adjusted now: −1 lap, +2 s, +3 pts') && (h.split('Adjust the result of B')[1] || '').includes('data-rv="adjustreset" data-car="1"'));
ok('...the order of the table follows the adjustment (B with 1 lap is second behind A, who has 2)', /<td>1<\/td><td>(<svg[^>]*>.*?<\/svg> )?A/.test(h) && !/<td>1<\/td><td>(<svg[^>]*>.*?<\/svg> )?B/.test(h));
ok('the winner\'s cup follows the adjusted laps: a winner who has no laps left has no cup', (() => { const q = race(); q.adjust(0, { laps: -2 }); const cups = (Review.html(q, {}).match(/<svg class="trophy"/g) || []).length; return cups === 1 && /<td>1<\/td><td><svg class="trophy"[^>]*>.*?<\/svg> B/.test(Review.html(q, {})); })());
ok('text in the panel is safe', (() => { const q = race(); q.cars[1].driverName = 'Z<b>'; Review.ui.adjust.add(1); const x = Review.html(q, {}); return !x.includes('Z<b>') && x.includes('Z&lt;b&gt;'); })());

// the clicks
const sent = [], redraws = []; let box;
const inputs = {};
const root = { querySelector: sel => { const m = /data-rva="([^"]+)"/.exec(sel); return m && m[1] in inputs ? { value: inputs[m[1]] } : null; } };
Review.bind(root, c => sent.push(c), () => redraws.push(1));
const click = d => root.onclick({ target: { closest: () => ({ dataset: d }) } });
Review.ui.adjust.clear();
click({ rv: 'adjopen', car: '1' }); ok('Adjust opens the panel (only on screen: nothing is sent, the screen is redrawn)', Review.ui.adjust.has(1) && sent.length === 0 && redraws.length === 1);
click({ rv: 'adjopen', car: '1' }); ok('...and closes it again', !Review.ui.adjust.has(1) && redraws.length === 2);
inputs['0:time'] = '5'; click({ rv: 'adjust', car: '0', what: 'time', sign: '1' });
ok('Add with 5 in the time field sends +5000 ms for that car, and nothing else', sent.length === 1 && sent[0].op === 'adjust' && sent[0].car === 0 && sent[0].ms === 5000 && sent[0].laps === undefined && sent[0].points === undefined);
inputs['0:time'] = '1.25'; click({ rv: 'adjust', car: '0', what: 'time', sign: '-1' });
ok('Deduct with 1.25 sends -1250 ms', sent[1].ms === -1250);
inputs['1:laps'] = '2'; click({ rv: 'adjust', car: '1', what: 'laps', sign: '-1' }); click({ rv: 'adjust', car: '1', what: 'laps', sign: '1' });
ok('laps: Deduct 2 sends -2 and Add 2 sends +2', sent[2].laps === -2 && sent[2].ms === undefined && sent[3].laps === 2);
inputs['1:points'] = '2.5'; click({ rv: 'adjust', car: '1', what: 'points', sign: '-1' });
ok('points: Deduct 2.5 sends -2.5', sent[4].points === -2.5 && sent[4].car === 1);
const n = sent.length;
['', '0', '-3', 'abc', ' ', 'Infinity', '1e999'].forEach(v => { inputs['0:time'] = v; click({ rv: 'adjust', car: '0', what: 'time', sign: '1' }); click({ rv: 'adjust', car: '0', what: 'time', sign: '-1' }); });
click({ rv: 'adjust', car: '0', what: 'laps', sign: '1' });
ok('an empty field, zero, a minus sign or text sends nothing (Deduct is how to take off), and a missing field neither', sent.length === n);
click({ rv: 'adjustreset', car: '1' });
ok('Reset sends the reset for that car', sent[sent.length - 1].op === 'adjustreset' && sent[sent.length - 1].car === 1);
Review.reset(); ok('a new race closes every panel', Review.ui.adjust.size === 0);

// what the engine does with those commands (they also come from the Director page on another device)
r = rev();
ok('apply: adjust changes the car', Review.apply(r, { op: 'adjust', car: 0, ms: 4000 }) === true && r.cars[0].adjMs === 4000 && Review.apply(r, { op: 'adjust', car: 0, laps: -1, points: 2 }) && r.cars[0].adjLaps === -1 && r.cars[0].adjPoints === 2);
ok('apply: adjustreset clears them', Review.apply(r, { op: 'adjustreset', car: 0 }) === true && !r.cars[0].adjMs && !r.cars[0].adjLaps && !r.cars[0].adjPoints);
ok('apply: a car that is not a whole number of a car is refused, nothing breaks', ['1', 1.5, -1, 9, null, undefined, {}, 'length', NaN].every(c => !Review.apply(r, { op: 'adjust', car: c, ms: 1000 })) && r.cars.every(c => !c.adjMs));
ok('apply: wrong amounts are refused', [{ ms: 'x' }, { ms: {} }, {}, { laps: Infinity }].every(a => !Review.apply(r, { op: 'adjust', car: 1, ...a })) && !r.cars[1].adjMs && !r.cars[1].adjLaps);
ok('apply: reset with a bad car', !Review.apply(r, { op: 'adjustreset', car: '0' }) && !Review.apply(r, { op: 'adjustreset' }));

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL ADJUST TESTS PASSED');
