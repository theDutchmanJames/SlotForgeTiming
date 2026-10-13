const { createRace, penaltyConfig, fuelConfig } = require('../renderer/engine.js');
const A = require('../renderer/announcer.js');
const Sound = require('../renderer/sound.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const ent = [{ lane: 0, driverId: 'a', driverName: 'Alex', nickname: 'Speedy', callsign: 'ALX' }, { lane: 1, driverId: 'b', driverName: 'Sam', nickname: '', callsign: 'SAM' }];
const mk = (o = {}) => { const r = createRace({ type: 'race', laps: 3, minLap: 1000, entries: ent, ...o }); return r; };
const namesAll = ev => ev.map(e => e.call).join(), names = ev => ev.filter(e => e.call !== 'firstlap').map(e => e.call).join(); // (the first lap call has its own tests further down)

// words and times
ok('fill: placeholders and tidy spaces', A.fill('{driver} takes {x} the lead!', { driver: 'Alex' }) === 'Alex takes the lead!');
ok('time spoken with two decimals', A.speakTime(5123) === '5.12' && A.speakTime(65120) === '1 minute 5.12');
ok('ordinal', A.ordinal(2) === 'second' && A.ordinal(11) === '11th');

// a race from lights to the winner
{
  const eng = mk(), an = A.create({ driverBy: 'nickname', lapLimit: 3 });
  let ev = an.observe(eng, { phase: 'ready' }); ok('nothing before the start', ev.length === 0);
  ev = an.observe(eng, { phase: 'countdown', lights: 0 }); ok('the lights beginning says nothing by itself (the pre-race call is said before them, when Start is pressed)', names(ev) === '');
  const cd = []; for (let n = 1; n <= 5; n++) { cd.push(names(an.observe(eng, { phase: 'countdown', lights: n }))); cd.push(names(an.observe(eng, { phase: 'countdown', lights: n }))); }
  ok('each light says its number once: 5, 4, 3, 2, 1', cd.join('|') === 'countdown5||countdown4||countdown3||countdown2||countdown1|');
  eng.start(0); ev = an.observe(eng, { phase: 'running' }); ok('lights out', names(ev) === 'lightsout');
  eng.cross(0, 5000); ev = an.observe(eng, { phase: 'running' });
  ok('first lap of the race: no best lap call, the first to lap is the leader (no change announced)', names(ev) === '' );
  eng.cross(1, 5500); ev = an.observe(eng, { phase: 'running' });
  ok('a slower first lap by another driver: nothing', names(ev) === '');
  eng.cross(1, 9000); ev = an.observe(eng, { phase: 'running' }); // Sam 3500 (faster than Alex 5000), 2 laps vs 1 -> new leader
  ok('fastest lap, new leader and the last lap', names(ev).replace(',distance', '') === 'fastestlap,newleader,lastlap');
  ok('placeholders: nickname style, time, other driver', ev[0].vars.driver === 'Sam' && ev[0].vars.time === '3.50' && ev[1].vars.other === 'Speedy');
  eng.cross(0, 12000); ev = an.observe(eng, { phase: 'running' });
  ok('a slower lap by the trailing driver: only that he starts the last lap (the other driver is on it already)', names(ev) === 'lastlapother' && ev[0].vars.driver === 'Speedy' && ev[0].vars.laps === 3);
  eng.cross(1, 14000); eng.cross(0, 18000); ev = an.observe(eng, { phase: 'running' });
  ok('the end: finished then winner with name', /finished,winner(,podium)?$/.test(names(ev)) && ev.find(e => e.call === 'winner').vars.name === 'Sam');
  ev = an.observe(eng, { phase: 'review' }); ok('nothing more afterwards', ev.length === 0);
}
// flags
{
  const eng = mk({ laps: 50 }), an = A.create({}); eng.start(0); an.observe(eng, { phase: 'running' });
  eng.setFlag('yellow', 100); ok('yellow', names(an.observe(eng, { phase: 'running' })) === 'yellowflag');
  eng.setFlag('yellow', 200); ok('yellow over = green', names(an.observe(eng, { phase: 'running' })) === 'greenflag');
  eng.setFlag('red', 300); ok('red', names(an.observe(eng, { phase: 'paused' })) === 'redflag');
  eng.setFlag('red', 400); ok('red over = green', names(an.observe(eng, { phase: 'running' })) === 'greenflag');
}
// records
{
  const eng = mk({ laps: 50 }), an = A.create({ base: { personal: new Map([['a', 6000]]), track: 4000 } }); eng.start(0); an.observe(eng, { phase: 'running' });
  eng.cross(0, 5000); ok('personal best against history', names(an.observe(eng, { phase: 'running' })) === 'personalbest');
  eng.cross(1, 3500 + 100); // 3600: beats the track record 4000
  const ev = an.observe(eng, { phase: 'running' }); ok('track record', names(ev).split(',')[0] === 'trackrecord');
}
// too slow laps are never announced
{
  const eng = mk({ laps: 50, maxLap: 4000 }), an = A.create({ base: { personal: new Map([['a', 9000]]), track: 9000 } }); eng.start(0); an.observe(eng, { phase: 'running' });
  eng.cross(0, 6000); ok('a too slow lap is not a record', !/record|personalbest|fastest/.test(names(an.observe(eng, { phase: 'running' }))));
}

// penalties, pits, fuel, halfway, podium
{
  const P = penaltyConfig({ timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 3, types: [{ name: 'Drivethrough', kind: 'drivethrough', cost: 1 }] });
  const F = fuelConfig({ pitHold: 0 }, { tank: 10, perLap: 3, rate: 5, empty: 'retire' });
  const eng = createRace({ type: 'race', laps: 6, minLap: 1000, penalty: P, fuel: F, entries: [...ent, { lane: 2, driverId: 'c', driverName: 'Kim' }] }), an = A.create({ lapLimit: 6 });
  eng.start(0); an.observe(eng, { phase: 'running', now: 0 });
  eng.addPoints(1, 1, 100); let ev = an.observe(eng, { phase: 'running', now: 100 });
  ok('penalty points are announced with the amount', names(ev) === 'penalty' && ev[0].vars.points === 1 && ev[0].vars.driver === 'Sam');
  eng.assign(1, 0, 200); ev = an.observe(eng, { phase: 'running', now: 200 });
  ok('a special penalty is announced with its name', names(ev) === 'specialpenalty' && ev[0].vars.penalty === 'drivethrough');
  eng.addPoints(1, 3, 300); ev = an.observe(eng, { phase: 'running', now: 300 });
  ok('reaching the disqualification limit', names(ev) === 'penalty,disqualified');
  eng.cross(2, 4000); eng.cross(2, 8000); ev = an.observe(eng, { phase: 'running', now: 8000 }); // Kim: 10 - 3 - 3 = 4 left, still enough
  ok('plenty of fuel left: silent', !names(ev).includes('fuellow'));
  eng.cross(2, 12000); ev = an.observe(eng, { phase: 'running', now: 12000 }); // 1 left
  ok('low fuel is announced once', names(ev).includes('fuellow') && ev.find(e => e.call === 'fuellow').vars.fuel === 1);
  ev = an.observe(eng, { phase: 'running', now: 12100 });
  ok('...and only once', !names(ev).includes('fuellow'));
  eng.cross(2, 16000); ev = an.observe(eng, { phase: 'running', now: 16000 }); // needs 3, has 1: out of fuel
  ok('out of fuel', names(ev).includes('outoffuel'));
  const e2 = createRace({ type: 'race', laps: 6, minLap: 1000, fuel: F, entries: ent }), a2 = A.create({ lapLimit: 6 }); e2.start(0); a2.observe(e2, { phase: 'running', now: 0 });
  e2.block(0, 1000); ev = a2.observe(e2, { phase: 'running', now: 1000 }); e2.tick(1100); e2.tick(3000); e2.unblock(0, 4000); ev = ev.concat(a2.observe(e2, { phase: 'running', now: 4000 }));
  ok('pit stop: in, then out', names(ev).includes('pitin') && names(ev).includes('pitout') || names(ev) === 'pitin');
  // halfway and podium
  const e3 = createRace({ type: 'race', laps: 4, minLap: 1000, entries: [...ent, { lane: 2, driverId: 'c', driverName: 'Kim' }] }), a3 = A.create({ lapLimit: 4 }); e3.start(0); a3.observe(e3, { phase: 'running', now: 0 });
  e3.cross(0, 3000); e3.cross(0, 6000); ev = a3.observe(e3, { phase: 'running', now: 6000 });
  ok('race distance: 50 percent by default, the leader finished half the laps', names(ev).includes('distance') && ev.find(e => e.call === 'distance').vars.percent === 50 && ev.find(e => e.call === 'distance').vars.left === '2 laps');
  ev = a3.observe(e3, { phase: 'running', now: 6100 }); ok('...only once', !names(ev).includes('distance'));
  [[1, 4000], [2, 5000], [0, 9000], [0, 12000], [1, 8000], [1, 12500], [1, 16000], [1, 20000], [2, 10000], [2, 15000], [2, 21000]].forEach(([i, t]) => e3.cross(i, t));
  e3.stop(25000); ev = a3.observe(e3, { phase: 'review', now: 25000 });
  ok('the end: finished, winner, then second and third place', /finished,winner,podium,podium$/.test(names(ev)) && ev.filter(e => e.call === 'podium').map(e => e.vars.position).join() === 'second,third');
  const e4 = createRace({ type: 'timed', duration: 2, minLap: 1000, entries: ent }), a4 = A.create({}); e4.start(0); a4.observe(e4, { phase: 'running', now: 0 });
  ok('timed race: halfway at half the time', !names(a4.observe(e4, { phase: 'running', now: 50000 })).includes('distance') && names(a4.observe(e4, { phase: 'running', now: 60000 })).includes('distance'));
}

// overtakes with many cars: the driver passed is named, a car dropping into the pits is not "passed"
{
  const names8 = 'ABCDEFGH', E8 = names8.split('').map((n, i) => ({ lane: i, driverId: 'd' + i, driverName: n }));
  const eng = createRace({ type: 'race', laps: 50, minLap: 1000, entries: E8 }), an = A.create({});
  eng.start(0); an.observe(eng, { phase: 'running', now: 0 });
  E8.forEach((_, i) => eng.cross(i, 5000 + i * 100)); an.observe(eng, { phase: 'running', now: 5700 }); // order A B C D E F G H
  eng.cross(4, 10000); eng.cross(0, 10100); eng.cross(1, 10200); eng.cross(2, 10300); eng.cross(3, 10400); // E now ahead of A..D
  let ev = an.observe(eng, { phase: 'running', now: 10400 });
  ok('a driver passing a car in the middle of the field: the passed driver is named', ev.some(e => e.call === 'overtake' || e.call === 'newleader'));
  const ov = ev.find(e => e.call === 'newleader'); ok('...the new leader names the old leader', ov && ov.vars.driver === 'E' && ov.vars.other === 'A');
  // a leader that pits drops down: the cars that moved up were not overtaking him
  const e2 = createRace({ type: 'race', laps: 50, minLap: 1000, entries: E8 }), a2 = A.create({}); e2.start(0); a2.observe(e2, { phase: 'running', now: 0 });
  E8.forEach((_, i) => e2.cross(i, 5000 + i * 100)); a2.observe(e2, { phase: 'running', now: 5700 });
  e2.block(1, 6000); // B stops in the pits (counts as a lap)
  ev = a2.observe(e2, { phase: 'running', now: 6000 });
  ok('a car in the pits is not announced as passed', !ev.some(e => e.call === 'overtake' && e.vars.other === 'B'));
}

// own race distances
{
  const E2 = [{ lane: 0, driverId: 'a', driverName: 'Alex' }], eng = createRace({ type: 'race', laps: 10, minLap: 1000, entries: E2 }), an = A.create({ lapLimit: 10, distances: [25, 75] });
  eng.start(0); an.observe(eng, { phase: 'running', now: 0 }); const got = [];
  for (let n = 1; n <= 9; n++) { eng.cross(0, n * 4000); an.observe(eng, { phase: 'running', now: n * 4000 }).forEach(e => e.call === 'distance' && got.push(e.vars.percent + ':' + e.vars.left)); }
  ok('the chosen distances (25 and 75 percent of 10 laps) are called once each', got.join() === '25:7 laps,75:2 laps');
  ok('percent list: parsed, 100 and nonsense ignored, nothing filled in = 50', Sound.distances('25, 50 75;100,x').join() === '25,50,75' && Sound.distances(undefined).join() === '50' && Sound.distances('').length === 0);
  ok('a set from before the distance call uses its halfway sentences', Sound.choose({ calls: { halfway: { on: true, lines: [{ text: 'Old {percent}', file: '' }] } } }, 'distance', { percent: 50 }, () => 0).text === 'Old 50');
}

// the sound set: choosing a line and playing in turn
{
  const set = Sound.defaultSet('T'); ok('default set has every call', Object.keys(set.calls).length === A.CALLS.length);
  ok('choose: text with placeholders', Sound.choose(set, 'winner', { driver: 'Sam' }, () => 0).text === 'Sam wins the race!');
  ok('choose: random variant', Sound.choose(set, 'winner', { driver: 'Sam' }, () => 0.99).text === 'Victory for Sam');
  set.calls.winner.lines[0].file = 'data:audio/wav;base64,AAAA'; ok('choose: a file wins over the text', Sound.choose(set, 'winner', {}, () => 0).file === 'data:audio/wav;base64,AAAA');
  delete set.calls.countdown3; ok('a call missing from an older set uses its ready-made sentence', Sound.choose(set, 'countdown3', {}, () => 0).text === '3');
  set.calls.redflag.on = false; ok('a call that is off says nothing', Sound.choose(set, 'redflag', {}) === null);
  set.calls.yellowflag.lines = [{ text: '  ', file: '' }]; ok('empty lines say nothing', Sound.choose(set, 'yellowflag', {}) === null);
  const played = [], waiting = []; Sound.state.backend = { speak: (t, o, done) => { played.push(t + '@' + o.rate); waiting.push(done); }, file: (u, o, done) => { played.push('file'); waiting.push(done); }, stop: () => { waiting.length = 0; } };
  const s2 = Sound.defaultSet('S'); s2.rate = 1.5;
  Sound.say(s2, 'newleader', { driver: 'A' }, () => 0); Sound.say(s2, 'overtake', { driver: 'B', other: 'C', position: 'second' }, () => 0);
  ok('calls wait for each other', played.length === 1 && played[0] === 'A takes the lead@1.5');
  waiting.shift()(); ok('the next one plays when the first is done', played.length === 2 && played[1].startsWith('B passes C for position second'));
  Sound.say(s2, 'redflag', {}, () => 0); ok('a flag goes first', played[2].startsWith('Red flag, the race is stopped'));
}
// the pre-race call: said when Start is pressed, before the start lights
{
  const pre = A.CALLS.find(c => c.id === 'prerace'), startCalls = A.CALLS.filter(c => c.group === 'Start').map(c => c.id);
  ok('the Pre-race call is the first call of the Start group, with the sentence you asked for, and the heat and the track as variables', pre && startCalls[0] === 'prerace' && pre.lines.length === 1 && pre.lines[0] === 'Drivers, get ready. The race is about to start!' && pre.vars.join() === 'heat,heats,final,track' && /^Before the start/.test(pre.label));
  ok('the old "Start lights begin" call is gone (it was cut off by the 5 a moment later): the Start group is the pre-race call, 5 to 1 and lights out', !A.CALLS.some(c => c.id === 'getready') && startCalls.join() === 'prerace,countdown5,countdown4,countdown3,countdown2,countdown1,lightsout');
  const set = Sound.defaultSet('P');
  ok('a new audio set has it on, with the sentence, and a pause of 1 second', set.calls.prerace.on === true && set.calls.prerace.lines[0].text === 'Drivers, get ready. The race is about to start!' && set.preDelay === 1 && A.CALLS.every(c => set.calls[c.id].on === (c.defaultOn !== false)) && Object.keys(set.calls).length === A.CALLS.length);
  ok('...it is what is said', Sound.choose(set, 'prerace', {}, () => 0).text === 'Drivers, get ready. The race is about to start!');
  ok('an audio set from before this version says it too, with the ready-made sentence', Sound.choose({ calls: { winner: { on: true, lines: [{ text: 'x', file: '' }] } } }, 'prerace', {}, () => 0).text === 'Drivers, get ready. The race is about to start!');
  const off = { ...set, calls: { ...set.calls, prerace: { on: false, lines: set.calls.prerace.lines } } }, none = { ...set, calls: { ...set.calls, prerace: { on: true, lines: [{ text: '  ', file: '' }] } } };
  ok('turned off, or without a sentence, it says nothing (so nothing is waited for)', Sound.choose(off, 'prerace', {}) === null && Sound.choose(none, 'prerace', {}) === null);
  ok('your own sentence or sound file is said instead', Sound.choose({ calls: { prerace: { on: true, lines: [{ text: 'Engines ready', file: '' }] } } }, 'prerace', {}, () => 0).text === 'Engines ready' && Sound.choose({ calls: { prerace: { on: true, lines: [{ text: 'x', file: 'data:audio/wav;base64,AAAA' }] } } }, 'prerace', {}, () => 0).file === 'data:audio/wav;base64,AAAA');
  ok('the pause: 1 second when not set, otherwise 0 to 10', Sound.pauseOf() === 1 && Sound.pauseOf({}) === 1 && Sound.pauseOf({ preDelay: '' }) === 1 && Sound.pauseOf({ preDelay: 'x' }) === 1 && Sound.pauseOf({ preDelay: 0 }) === 0 && Sound.pauseOf({ preDelay: 2.5 }) === 2.5 && Sound.pauseOf({ preDelay: 99 }) === 10 && Sound.pauseOf({ preDelay: -4 }) === 0 && Sound.pauseOf({ preDelay: '3' }) === 3);
  // saying it: the callback comes when it has been said
  const played = [], waiting = []; Sound.state.backend = { speak: (t, o, done) => { played.push(t); waiting.push(done); }, file: (u, o, done) => { played.push('file'); waiting.push(done); }, stop: () => { waiting.length = 0; } };
  Sound.stop(); played.length = 0; let after = 0; const said = Sound.say(set, 'prerace', {}, () => 0, () => { after++; });
  ok('it is spoken at once, and the callback has not come yet', said && said.text.startsWith('Drivers, get ready') && played.length === 1 && after === 0);
  waiting.shift()(); ok('...the callback comes when it has been said, once', after === 1 && (Sound.state.busy === false));
  Sound.say(set, 'newleader', { driver: 'A' }, () => 0); const n0 = played.length; Sound.say(set, 'overtake', { driver: 'B', other: 'C', position: 'second' }, () => 0); let a2 = 0;
  Sound.say(set, 'prerace', {}, () => 0, () => { a2++; });
  ok('it goes first: what was being said or waiting is dropped', played.length === n0 + 1 && played[played.length - 1].startsWith('Drivers, get ready') && Sound.state.queue.length === 0 && a2 === 0);
  waiting.shift()(); ok('...and its callback still comes when it is finished', a2 === 1);
  let a3 = 0; ok('a call with nothing to say gives no callback and returns null (the caller must not wait)', Sound.say(off, 'prerace', {}, () => 0, () => { a3++; }) === null && a3 === 0 && waiting.length === 0);
  let a4 = 0; Sound.say(set, 'prerace', {}, () => 0, () => { a4++; throw new Error('boom'); }); let ok4 = true; try { waiting.shift()(); } catch (e) { ok4 = false; }
  ok('a callback that breaks does not break the sound', ok4 && a4 === 1 && Sound.state.busy === false);
  let a5 = 0; Sound.say(set, 'prerace', {}, () => 0, () => { a5++; }); const w5 = waiting[0]; w5(); w5(); ok('the callback comes only once, even if the sound reports twice', a5 === 1);
  Sound.stop(); Sound.state.backend = null;
}
{ const bad = Object.keys(A.VARS).filter(k => !A.CALLS.some(c => c.vars.includes(k) || (A.EVERY_DRIVER.includes(k) && c.vars.includes('driver'))) && !A.EVERY_CALL.includes(k));
  ok('every variable in the help is used by at least one call', bad.length === 0, bad.join());
  ok('...and every variable a call lists, and every example, is in the help', A.CALLS.every(c => c.vars.every(v => v in A.VARS)) && Object.keys(A.VARS).every(k => k in A.SAMPLE) && A.EVERY_DRIVER.concat(A.EVERY_CALL).every(k => k in A.VARS)); }

// ============ 0.87.0: race progress, gaps and battles, new variables ============
const lapsOf = (eng, an, id, n, step, from = 0, who = 0) => { const got = []; for (let k = 1; k <= n; k++) { eng.cross(who, from + k * step); an.observe(eng, { phase: 'running', now: from + k * step }).forEach(e => e.call === id && got.push(e)); } return got; };
const one = [{ lane: 0, driverId: 'a', driverName: 'Alex', nickname: 'Speedy', callsign: 'ALX', carName: 'NSR GT40' }];
const two = [...one, { lane: 1, driverId: 'b', driverName: 'Sam', nickname: 'Sammy', callsign: 'SAM', carName: 'Porsche 956' }];
const mk2 = (o = {}, ents = one) => createRace({ type: 'race', laps: 10, minLap: 1000, entries: ents, ...o });
// laps to go
{
  const e1 = mk2(), a1 = A.create({ lapLimit: 10, lapsToGo: [5, 3, 1] }); e1.start(0); a1.observe(e1, { phase: 'running', now: 0 });
  const g1 = lapsOf(e1, a1, 'lapstogo', 9, 4000);
  ok('laps to go: said when the leader has that many laps left (5 and 3), once each, and 1 is left to the last lap call', g1.length === 2 && g1[0].vars.left === '5 laps' && g1[1].vars.left === '3 laps' && g1[0].vars.driver === 'Alex' && g1[0].vars.laps === 10);
  const e2 = mk2(), a2 = A.create({ lapLimit: 10, lapsToGo: [] }); e2.start(0); a2.observe(e2, { phase: 'running', now: 0 });
  ok('...an empty list says nothing, and so does no list at all', lapsOf(e2, a2, 'lapstogo', 9, 4000).length === 0 && lapsOf(mk2(), A.create({ lapLimit: 10 }), 'lapstogo', 9, 4000).length === 0);
  const e3 = mk2(), a3 = A.create({ lapLimit: 10, lapsToGo: [10, 12, 2] }); e3.start(0); a3.observe(e3, { phase: 'running', now: 0 });
  const g3 = lapsOf(e3, a3, 'lapstogo', 9, 4000);
  ok('...a number as big as the race (or bigger) is left out', g3.length === 1 && g3[0].vars.left === '2 laps');
  const e4 = mk2(), a4 = A.create({ lapLimit: 10, lapsToGo: [5, 3] }); e4.start(0); a4.observe(e4, { phase: 'running', now: 0 });
  [1, 2, 3, 4].forEach(k => e4.cross(0, k * 4000)); a4.observe(e4, { phase: 'running', now: 16000 });
  [5, 6, 7].forEach(k => e4.cross(0, k * 4000)); const g4 = a4.observe(e4, { phase: 'running', now: 28000 }).filter(e => e.call === 'lapstogo');
  ok('...if two are passed before the next look, only the nearest is called, and the other is not called later', g4.length === 1 && g4[0].vars.left === '3 laps' && lapsOf(e4, a4, 'lapstogo', 2, 4000, 28000).length === 0);
  const e5 = createRace({ type: 'practice', minLap: 1000, entries: one }), a5 = A.create({ lapsToGo: [3] }); e5.start(0);
  ok('...a race without a lap limit has no laps to go', lapsOf(e5, a5, 'lapstogo', 6, 4000).length === 0);
  const e6 = mk2(), a6 = A.create({ lapLimit: 10, lapsToGo: [3] }); e6.start(0); a6.observe(e6, { phase: 'paused', now: 0 });
  ok('...and nothing is said before the race runs', (e6.cross(0, 4000), a6.observe(e6, { phase: 'ready', now: 4000 }).filter(e => e.call === 'lapstogo').length === 0));
}
// minutes to go
{
  const timed = (o = {}) => createRace({ type: 'timed', duration: 10, minLap: 1000, entries: two, ...o });
  const e1 = timed(), a1 = A.create({ minutesToGo: [5, 1] }); e1.start(0); e1.cross(0, 5000); e1.cross(1, 5500); a1.observe(e1, { phase: 'running', now: 5500 });
  const at = t => a1.observe(e1, { phase: 'running', now: t }).filter(e => e.call === 'timetogo');
  ok('minutes to go: nothing before the time is reached', at(299000).length === 0);
  const m5 = at(300000); ok('...5 minutes: said when 5 minutes are left, with the leader', m5.length === 1 && m5[0].vars.left === '5 minutes' && m5[0].vars.driver === 'Alex');
  ok('...once only', at(300500).length === 0 && at(400000).length === 0);
  const m1 = at(540000); ok('...and 1 minute: singular', m1.length === 1 && m1[0].vars.left === '1 minute');
  ok('...nothing after the time is up', at(600000).length === 0 && at(650000).length === 0);
  const e2 = timed(), a2 = A.create({ minutesToGo: [10, 15, 2] }); e2.start(0); e2.cross(0, 5000); const got2 = [];
  for (const t of [5000, ...Array.from({ length: 21 }, (_, k) => k * 30000)]) a2.observe(e2, { phase: 'running', now: t }).forEach(e => e.call === 'timetogo' && got2.push(e.vars.left));
  ok('...a number as big as the race (or bigger) is left out', got2.join() === '2 minutes');
  const e3 = timed(); e3.start(0); e3.cross(0, 5000); e3.pause(100000); const a3 = A.create({ minutesToGo: [5] });
  ok('...a paused race does not use up its time (the clock stands still)', a3.observe(e3, { phase: 'paused', now: 500000 }).filter(e => e.call === 'timetogo').length === 0);
  const q = createRace({ type: 'qualifying', duration: 5, minLap: 1000, entries: one }), aq = A.create({ minutesToGo: [1] }); q.start(0); q.cross(0, 5000); aq.observe(q, { phase: 'running', now: 5000 });
  ok('...a qualifying has it too', aq.observe(q, { phase: 'running', now: 240000 }).filter(e => e.call === 'timetogo').length === 1);
  const r = mk2(), ar = A.create({ lapLimit: 10, minutesToGo: [1] }); r.start(0); r.cross(0, 5000);
  ok('...a race by laps has none (it is about laps)', ar.observe(r, { phase: 'running', now: 999999 }).filter(e => e.call === 'timetogo').length === 0);
  const rd = mk2({ duration: 10 }), ard = A.create({ lapLimit: 10, minutesToGo: [1, 5] }); rd.start(0); rd.cross(0, 5000);
  ok('...even when the race setup has a duration filled in', ard.observe(rd, { phase: 'running', now: 400000 }).filter(e => e.call === 'timetogo').length === 0);
  const eu = timed(), au = A.create({ minutesToGo: [5, 1] }); eu.start(0); eu.cross(0, 5000);
  ok('...and when the time is already up nothing is said about the minutes left', au.observe(eu, { phase: 'running', now: 650000 }).filter(e => e.call === 'timetogo').length === 0);
}
// another driver starts the last lap
{
  const e = mk2({ laps: 3 }, two), a = A.create({ lapLimit: 3 }); e.start(0); a.observe(e, { phase: 'running', now: 0 });
  e.cross(0, 4000); e.cross(0, 8000); let ev = a.observe(e, { phase: 'running', now: 8000 });
  ok('another driver starts the last lap: the leader gets the last lap call and not this one', names(ev).includes('lastlap') && !names(ev).includes('lastlapother') && ev.find(x => x.call === 'lastlap').vars.driver === 'Alex');
  e.cross(1, 5000); e.cross(1, 10000); ev = a.observe(e, { phase: 'running', now: 10000 });
  ok('...the other driver gets this one, with the laps', names(ev) === 'lastlapother' && ev[0].vars.driver === 'Sam' && ev[0].vars.laps === 3);
  e.cross(1, 14000); e.cross(1, 17000); ev = a.observe(e, { phase: 'running', now: 17000 }); ok('...once', !names(ev).includes('lastlapother'));
  const e2 = mk2({ laps: 3 }, two), a2 = A.create({ lapLimit: 3 }); e2.start(0); a2.observe(e2, { phase: 'running', now: 0 });
  e2.cross(0, 4000); e2.cross(0, 8000); a2.observe(e2, { phase: 'running', now: 8000 }); e2.cross(1, 5000); e2.cross(1, 10000); a2.observe(e2, { phase: 'running', now: 10000 });
  e2.cars[1].laps.pop(); a2.observe(e2, { phase: 'running', now: 11000 }); e2.cars[1].laps.push(5000);
  ok('...and not again when a lap was taken out in a review and the driver completes it again', !names(a2.observe(e2, { phase: 'running', now: 15000 })).includes('lastlapother'));
}
// heats
{
  const e = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a = A.create({ lapLimit: 1, trackName: 'Living room' });
  e.start(0); a.observe(e, { phase: 'running', now: 0, heat: { idx: 1, count: 3 } });
  e.cross(0, 4000); e.cross(1, 4500); const ev = a.observe(e, { phase: 'running', now: 4500, heat: { idx: 1, count: 3 } });
  ok('a heat that is not the last says the heat is finished (with its winner), not that the race is', names(ev).includes('heatend') && !names(ev).includes('finished') && names(ev).includes('winner') && ev.find(x => x.call === 'heatend').vars.heat === 2 && ev.find(x => x.call === 'heatend').vars.heats === 3);
  const e2 = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a2 = A.create({ lapLimit: 1 }); e2.start(0); a2.observe(e2, { phase: 'running', now: 0, heat: { idx: 2, count: 3 } });
  e2.cross(0, 4000); e2.cross(1, 4500); const ev2 = a2.observe(e2, { phase: 'running', now: 4500, heat: { idx: 2, count: 3 } });
  ok('...the last heat says the race is finished', names(ev2).includes('finished') && !names(ev2).includes('heatend') && ev2.find(x => x.call === 'finished').vars.heat === 3);
  const e3 = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a3 = A.create({ lapLimit: 1 }); e3.start(0); a3.observe(e3, { phase: 'running', now: 0 }); e3.cross(0, 4000); e3.cross(1, 4500);
  const ev3 = a3.observe(e3, { phase: 'running', now: 4500 });
  ok('...a race that is not in heats always says it is finished, and the heat variables are empty', names(ev3).includes('finished') && ev3.find(x => x.call === 'finished').vars.heat === '' && ev3.find(x => x.call === 'finished').vars.heats === '');
  const e4 = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a4 = A.create({}); let ev4 = a4.observe(e4, { phase: 'between', now: 0, heat: { idx: 2, count: 3 } });
  ok('between two heats: the next heat is announced, once (heat 3 of 3)', names(ev4) === 'nextheat' && ev4[0].vars.heat === 3 && ev4[0].vars.heats === 3 && a4.observe(e4, { phase: 'between', now: 100, heat: { idx: 2, count: 3 } }).length === 0);
  ok('...and not in a race without heats', names(A.create({}).observe(e4, { phase: 'between', now: 0 })) === '');
  ok('every call can say the track', ev[0].vars.track === 'Living room' && ev4[0].vars.track === '');
}
// 0.96.0: finals (a heat race with a final B and a final A after two heats: 4 races)
{
  const fin = (idx, final) => ({ idx, count: 2, total: 4, ...(final ? { final } : {}) });
  const endOf = heat => { const e = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a = A.create({ lapLimit: 1, trackName: 'Living room' }); e.start(0); a.observe(e, { phase: 'running', now: 0, heat }); e.cross(0, 4000); e.cross(1, 4500); return a.observe(e, { phase: 'running', now: 4500, heat }); };
  const last2 = endOf(fin(1)), b = endOf(fin(2, 'B')), a = endOf(fin(3, 'A'));
  ok('the last heat, with the finals still to come, says that the heat is finished (heat 2 of 2), not that the race is', names(last2).includes('heatend') && !names(last2).includes('finished') && last2.find(x => x.call === 'heatend').vars.heat === 2 && last2.find(x => x.call === 'heatend').vars.final === '');
  ok('a final that is not the last says the final is finished, with its letter, and no heat number', names(b).includes('finalend') && !names(b).includes('finished') && !names(b).includes('heatend') && b.find(x => x.call === 'finalend').vars.final === 'B' && b.find(x => x.call === 'finalend').vars.heat === '' && b.find(x => x.call === 'finalend').vars.heats === '');
  ok('...the last final says the race is finished (and knows which final it was)', names(a).includes('finished') && !names(a).includes('finalend') && a.find(x => x.call === 'finished').vars.final === 'A');
  const e4 = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a4 = A.create({}), ev4 = a4.observe(e4, { phase: 'between', now: 0, heat: fin(2, 'B') });
  ok('between the last heat and the final B: "next final" is announced, once, with the letter', names(ev4) === 'nextfinal' && ev4[0].vars.final === 'B' && ev4[0].vars.heat === '' && a4.observe(e4, { phase: 'between', now: 100, heat: fin(2, 'B') }).length === 0);
  const e5 = createRace({ type: 'race', laps: 1, minLap: 1000, entries: two }), a5 = A.create({});
  ok('...and a heat is still announced as a heat (between heat 1 and heat 2)', names(a5.observe(e5, { phase: 'between', now: 0, heat: fin(1) })) === 'nextheat');
  const call = id => A.CALLS.find(c => c.id === id);
  ok('the two calls exist in the Race progress folder, next to the heat calls, with the sentences that use the letter', call('nextfinal').group === 'Race progress' && call('finalend').group === 'Race progress' && call('nextfinal').vars.join() === 'final' && call('finalend').vars.join() === 'final' && call('nextfinal').lines.every(l => l.includes('{final}')) && call('finalend').lines.every(l => l.includes('{final}')));
  ok('...and the start calls and the finish call can say the final too', ['prerace', 'lightsout', 'finished'].every(id => call(id).vars.includes('final')) && 'final' in A.VARS && A.SAMPLE.final === 'A');
}
// closing in, battles and lapped cars
{
  const gapCalls = ev => ev.filter(x => ['closing', 'battle', 'lapped'].includes(x.call));
  const race = (o = {}) => { const e = mk2({ laps: 50 }, two); e.start(0); const a = A.create({ lapLimit: 50, closeGap: 1, battleLaps: 3, ...o }); a.observe(e, { phase: 'running', now: 0 }); return [e, a]; };
  const lapPair = (e, a, k, behind, mid) => { e.cross(0, k * 5000); a.observe(e, { phase: 'running', now: k * 5000 }); if (mid) mid(); e.cross(1, k * 5000 + behind); return gapCalls(a.observe(e, { phase: 'running', now: k * 5000 + behind })); };
  let [e, a] = race(); const log = [];
  for (let k = 1; k <= 5; k++) lapPair(e, a, k, 400).forEach(x => log.push(k + ':' + x.call));
  ok('a driver who is close to the car in front: "closing in" once, then the battle after 3 laps in a row, and nothing more', log.join() === '1:closing,3:battle');
  [e, a] = race(); const ev = lapPair(e, a, 1, 400);
  ok('closing in says who, who is in front, the gap and the place that is fought for', ev.length === 1 && ev[0].call === 'closing' && ev[0].vars.driver === 'Sam' && ev[0].vars.other === 'Alex' && ev[0].vars.gap === '0.4 seconds' && ev[0].vars.position === 'first' && ev[0].vars.car === 'Porsche 956');
  [e, a] = race(); ok('a gap above the limit says nothing', lapPair(e, a, 1, 1500).length === 0 && lapPair(e, a, 2, 1200).length === 0);
  [e, a] = race({ closeGap: 2 }); ok('...and the limit is the one of the set (2 seconds: 1.5 seconds is close)', names(lapPair(e, a, 1, 1500)) === 'closing');
  [e, a] = race({ closeGap: 0 }); ok('without a limit there are no closing in or battle calls', lapPair(e, a, 1, 300).length === 0 && lapPair(e, a, 2, 300).length === 0 && lapPair(e, a, 3, 300).length === 0);
  [e, a] = race(); const l2 = [];
  [[1, 400], [2, 1200], [3, 1600], [4, 500]].forEach(([k, g]) => lapPair(e, a, k, g).forEach(x => l2.push(k + ':' + x.call)));
  ok('closing in is said again after the gap grew to 1.6 seconds and shrank again, and not when it only went to 1.2 seconds (between the limit and one and a half times it)', l2.join() === '1:closing,4:closing');
  [e, a] = race({ battleLaps: 2 }); const l3 = []; for (let k = 1; k <= 3; k++) lapPair(e, a, k, 300).forEach(x => l3.push(k + ':' + x.call));
  ok('the number of laps for a battle is the one of the set (2)', l3.join() === '1:closing,2:battle');
  [e, a] = race({ battleLaps: 3 }); const l4 = []; [[1, 300], [2, 300], [3, 1100], [4, 300], [5, 300]].forEach(([k, g]) => lapPair(e, a, k, g).forEach(x => l4.push(k + ':' + x.call)));
  ok('a lap just above the limit breaks the run of battle laps: no battle after laps 4 and 5, and no second closing in either', l4.join() === '1:closing');
  [e, a] = race(); ok('a car in front that is in the pits is not chased', lapPair(e, a, 1, 400, () => { e.cars[0].blockAt = 12345; }).length === 0);
  [e, a] = race(); ok('...and a car in front that has finished is not either', lapPair(e, a, 1, 400, () => { e.cars[0].done = true; }).length === 0);
  [e, a] = race(); ok('...nor is a car that is in the pits itself calling for a battle', lapPair(e, a, 1, 400, () => { e.cars[1].blockAt = 12345; }).length === 0);
  // lapped
  const e5 = mk2({ laps: 50 }, two); e5.start(0); const a5 = A.create({ lapLimit: 50 }); a5.observe(e5, { phase: 'running', now: 0 });
  const lp = [], at5 = (car, t) => { e5.cross(car, t); gapCalls(a5.observe(e5, { phase: 'running', now: t })).forEach(x => lp.push(`${t}:${x.vars.driver}:${x.vars.other}:${x.vars.lapsdown}`)); };
  at5(0, 4000); at5(0, 8000); at5(1, 9000); at5(0, 12000); at5(0, 16000); at5(0, 20000); at5(1, 21000);
  ok('a driver who is lapped by the leader: said when a lap is completed, with who lapped him and how many laps he is down, and again for the next lap', lp.join(' ') === '9000:Sam:Alex:1 lap 21000:Sam:Alex:3 laps');
  const pe = createRace({ type: 'practice', minLap: 1000, entries: two }), pa = A.create({ closeGap: 1 }); pe.start(0); pa.observe(pe, { phase: 'running', now: 0 });
  const pl = []; for (let k = 1; k <= 6; k++) { pe.cross(0, k * 4000); pa.observe(pe, { phase: 'running', now: k * 4000 }).forEach(x => pl.push(x.call)); if (k % 3 === 0) { pe.cross(1, k * 4000 + 9000); pa.observe(pe, { phase: 'running', now: k * 4000 + 9000 }).forEach(x => pl.push(x.call)); } }
  ok('practice has no lapped cars (it is about the best lap)', !pl.includes('lapped'));
}
// the variables
{
  const e = mk2({ laps: 3 }, two), a = A.create({ lapLimit: 3, driverBy: 'callsign' }); e.start(0); a.observe(e, { phase: 'running', now: 0 });
  e.cross(0, 4000); const ev = a.observe(e, { phase: 'running', now: 4000 }); e.cross(1, 5000); const ev2 = a.observe(e, { phase: 'running', now: 5000 });
  e.cross(0, 8000); const ev3 = a.observe(e, { phase: 'running', now: 8000 });
  const lastlap = ev3.find(x => x.call === 'lastlap');
  ok('the car and the best lap are in the values (the best lap as spoken, the car as entered)', lastlap && lastlap.vars.car === 'NSR GT40' && lastlap.vars.best === '4.00' && lastlap.vars.driver === 'ALX');
  ok('a driver without a lap has an empty best lap', !!A.create({}) && A.speakGap(NaN) === '');
  ok('a gap as it is spoken: tenths under 10 seconds, whole seconds above, "1 second" for one', A.speakGap(400) === '0.4 seconds' && A.speakGap(1000) === '1 second' && A.speakGap(1040) === '1 second' && A.speakGap(1500) === '1.5 seconds' && A.speakGap(9960) === '10 seconds' && A.speakGap(9940) === '9.9 seconds' && A.speakGap(12400) === '12 seconds' && A.speakGap(0) === '0 seconds' && A.speakGap(3000) === '3 seconds');
  ok('the new variables are explained and have an example', ['gap', 'lapsdown', 'heat', 'heats', 'car', 'best', 'track'].every(k => typeof A.VARS[k] === 'string' && A.VARS[k].length > 10 && typeof A.SAMPLE[k] === 'string' && A.SAMPLE[k].length > 0));
}
// the audio set: which of the new calls are on, and the new settings
{
  const set = Sound.defaultSet('x');
  const off = ['lastlapother', 'closing', 'battle', 'lapped'], on = ['lapstogo', 'timetogo', 'nextheat', 'heatend', 'lastlap', 'distance'];
  ok('a new audio set has the calls that talk a lot (another driver on the last lap, closing in, battles, lapped) off, and the other new calls on', off.every(id => set.calls[id].on === false) && on.every(id => set.calls[id].on === true));
  ok('...every call has sentences, off or on', A.CALLS.every(c => set.calls[c.id].lines.length === c.lines.length && c.lines.length > 0));
  const old = { calls: { winner: { on: true, lines: [{ text: 'x', file: '' }] } } };
  ok('a set from before this version stays quiet for the calls that are off by default, and says the ready-made sentence of the others', off.every(id => Sound.choose(old, id, {}, () => 0) === null) && on.filter(id => id !== 'lastlap' && id !== 'distance').every(id => Sound.choose(old, id, { left: '3 laps', driver: 'Alex', heat: 2, heats: 3 }, () => 0).text.length > 3));
  ok('...but a set that has such a call turned on says it', Sound.choose({ calls: { closing: { on: true, lines: [{ text: '{driver} is {gap} behind {other}', file: '' }] } } }, 'closing', { driver: 'Sam', gap: '0.4 seconds', other: 'Alex' }, () => 0).text === 'Sam is 0.4 seconds behind Alex');
  ok('the settings of a new set: 3 laps and 1 minute to go, a gap of 1 second, a battle after 3 laps', set.lapsToGo === '3' && set.minutesToGo === '1' && set.closeGap === 1 && set.battleLaps === 3);
  ok('whole-number lists: sorted, doubles and nonsense left out, nothing filled in = the fallback, empty = none', Sound.counts('5, 3 3;x 1.5 0 -2 1', [9]).join() === '1,3,5' && Sound.counts(undefined, [3]).join() === '3' && Sound.counts('', [3]).length === 0 && Sound.counts(null, [1]).join() === '1');
  ok('numbers with limits: the fallback for nothing or nonsense, and the limits', Sound.bounded(undefined, 1, 0.1, 30) === 1 && Sound.bounded('', 1, 0.1, 30) === 1 && Sound.bounded('x', 3, 2, 20) === 3 && Sound.bounded(50, 1, 0.1, 30) === 30 && Sound.bounded(0, 1, 0.1, 30) === 0.1 && Sound.bounded('2.5', 1, 0.1, 30) === 2.5);
}

// ---------- 0.88.0: laps and records, pits and fuel, penalties, safety, and the new words ----------
{
  const run = (e, a, t, ctx = {}) => a.observe(e, { phase: 'running', now: t, ...ctx });
  const of = (ev, id) => ev.filter(x => x.call === id);
  // the first lap
  { const e = mk2({ laps: 5 }, two), a = A.create({ lapLimit: 5 }); e.start(0); run(e, a, 0);
    e.cross(0, 5000); let ev = run(e, a, 5000);
    ok('first lap: said when a driver completes the first lap, with the time and the lap', of(ev, 'firstlap').length === 1 && of(ev, 'firstlap')[0].vars.time === '5.00' && of(ev, 'firstlap')[0].vars.lap === 1 && of(ev, 'firstlap')[0].vars.driver === 'Alex');
    e.cross(0, 10000); ev = run(e, a, 10000); ok('...not for the second lap', of(ev, 'firstlap').length === 0);
    e.cross(1, 6000); ev = run(e, a, 6000); ok('...and every driver gets his own first lap', of(ev, 'firstlap').length === 1 && of(ev, 'firstlap')[0].vars.driver === 'Sam');
    const e2 = mk2({ laps: 5, minLap: 4000 }, two), a2 = A.create({ lapLimit: 5 }); e2.start(0); run(e2, a2, 0); e2.cross(0, 2000);
    ok('...a lap that was too slow or too fast to count is not announced as the first', of(run(e2, a2, 2000), 'firstlap').length === 0);
    const e3 = mk2({ laps: 5 }, two), a3 = A.create({ lapLimit: 5, base: { track: 9000, personal: new Map() } }); e3.start(0); run(e3, a3, 0); e3.cross(0, 5000);
    ok('...if the first lap is also a track record, the record call comes first', namesAll(run(e3, a3, 5000)) === 'trackrecord,firstlap');
  }
  // improved by, the record, and a lap close to the record
  { const mkr = (o = {}) => { const e = mk2({ laps: 9 }, two), a = A.create({ lapLimit: 9, base: { track: 5000, personal: new Map([['a', 5600]]) }, ...o }); e.start(0); run(e, a, 0); return [e, a]; };
    let [e, a] = mkr(); e.cross(0, 5480); let ev = run(e, a, 5480);
    ok('a personal best says how much better it is than the best before (against the history here)', of(ev, 'personalbest').length === 1 && of(ev, 'personalbest')[0].vars.improved === '0.12 seconds' && of(ev, 'personalbest')[0].vars.record === '5.00');
    [e, a] = mkr({ base: { track: 4000, personal: new Map() } }); e.cross(0, 5000); run(e, a, 5000); e.cross(1, 11000); ev = run(e, a, 11000); // Sam: 6.00 (slower), nothing
    e.cross(1, 15700); ev = run(e, a, 15700);
    ok('the fastest lap of the race says how much faster it is than the one before', of(ev, 'fastestlap').length === 1 && of(ev, 'fastestlap')[0].vars.improved === '0.30 seconds', JSON.stringify(of(ev, 'fastestlap')));
    [e, a] = mkr({ base: { track: 5200, personal: new Map() } }); e.cross(0, 5000); ev = run(e, a, 5000);
    ok('a track record says how much faster than the old record, and {record} is the old one', of(ev, 'trackrecord').length === 1 && of(ev, 'trackrecord')[0].vars.improved === '0.20 seconds' && of(ev, 'trackrecord')[0].vars.record === '5.20');
    ev = [e.cross(0, 9800), run(e, a, 9800)][1]; // 4.80: the record is 5.00 now
    ok('...and after that the record is the new time in every call', of(ev, 'trackrecord')[0].vars.record === '5.00' && A.create({ base: { track: 5000 } }).observe(mk2({}, two), { phase: 'ready' }).length === 0);
    // near record
    [e, a] = mkr({ nearRecord: 0.1, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 5090); ev = run(e, a, 5090);
    ok('close to the record: a lap 0.09 seconds slower than the record is announced with the difference', of(ev, 'nearrecord').length === 1 && of(ev, 'nearrecord')[0].vars.off === '0.09 seconds' && of(ev, 'nearrecord')[0].vars.record === '5.00' && of(ev, 'nearrecord')[0].vars.time === '5.09');
    e.cross(0, 10290); ev = run(e, a, 10290); ok('...a lap 0.2 seconds slower is not', of(ev, 'nearrecord').length === 0);
    [e, a] = mkr({ nearRecord: 0.1, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 5100); ev = run(e, a, 5100);
    ok('...a lap exactly at the limit is', of(ev, 'nearrecord').length === 1 && of(ev, 'nearrecord')[0].vars.off === '0.10 seconds');
    [e, a] = mkr({ nearRecord: 0.1, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 5000); ev = run(e, a, 5000);
    ok('...exactly the record is also close (0 seconds off)', of(ev, 'nearrecord').length === 1 && of(ev, 'nearrecord')[0].vars.off === '0.00 seconds' && of(ev, 'trackrecord').length === 0);
    [e, a] = mkr({ nearRecord: 0.1, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 4900); ev = run(e, a, 4900);
    ok('...a lap that beats the record is a track record, not "close"', of(ev, 'trackrecord').length === 1 && of(ev, 'nearrecord').length === 0);
    [e, a] = mkr({ nearRecord: 0, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 5050); ev = run(e, a, 5050); ok('...a distance of 0 turns it off', of(ev, 'nearrecord').length === 0);
    [e, a] = mkr({ nearRecord: 9, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 9800); ev = run(e, a, 9800); ok('...a big distance still works', of(ev, 'nearrecord').length === 1 && of(ev, 'nearrecord')[0].vars.off === '4.80 seconds');
    e.cross(0, 20800); ev = run(e, a, 20800); ok('...but it is limited to 5 seconds (a lap 6 seconds off is not close)', of(ev, 'nearrecord').length === 0);
    [e, a] = mkr({ nearRecord: 5, base: { track: 5000, personal: new Map([['a', 4000]]) } }); e.cross(0, 10100); ev = run(e, a, 10100); ok('...and 5.1 seconds is too far', of(ev, 'nearrecord').length === 0);
    [e, a] = mkr({ nearRecord: 0.1, base: { personal: new Map([['a', 4000]]) } }); e.cross(0, 5050); ev = run(e, a, 5050); ok('...a track without a record has no close laps, and no {record}', of(ev, 'nearrecord').length === 0 && ev.every(x => x.vars.record === ''));
    ok('a difference as it is spoken: two decimals, 1 second, minutes', A.speakDiff(120) === '0.12 seconds' && A.speakDiff(1000) === '1 second' && A.speakDiff(4996) === '5.00 seconds' && A.speakDiff(-300) === '0.30 seconds' && A.speakDiff(65000) === '1 minute 5.00' && A.speakDiff(NaN) === '');
  }
  // time spans and gaps as they are spoken
  ok('a time added as it is spoken: seconds, minutes, both', A.speakSpan(30000) === '30 seconds' && A.speakSpan(60000) === '1 minute' && A.speakSpan(300000) === '5 minutes' && A.speakSpan(90000) === '1 minute 30 seconds' && A.speakSpan(1000) === '1 second' && A.speakSpan(0) === '' && A.speakSpan(-5) === '' && A.speakSpan(NaN) === '');
  ok('a whole gap is spoken without decimals', A.speakGap(3000) === '3 seconds' && A.speakGap(2960) === '3 seconds' && A.speakGap(3040) === '3 seconds' && A.speakGap(3200) === '3.2 seconds' && A.speakGap(1000) === '1 second');
  // pits and fuel
  { const P = penaltyConfig({ timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 9, types: [{ name: 'Drivethrough', kind: 'drivethrough', cost: 1 }] });
    const F = fuelConfig({ pitHold: 0 }, { tank: 10, perLap: 3, rate: 5, empty: 'retire' });
    const mkf = (o = {}) => { const e = createRace({ type: 'race', laps: 9, minLap: 1000, penalty: P, fuel: F, entries: two, ...o }), a = A.create({ lapLimit: 9 }); e.start(0); run(e, a, 0); return [e, a]; };
    let [e, a] = mkf(); e.cross(0, 4000); let ev = run(e, a, 4000);
    ok('half tank: not yet with 7 of 10 litres left', of(ev, 'fuelhalf').length === 0);
    e.cross(0, 8000); ev = run(e, a, 8000);
    ok('...said once when 5 litres or less are left, with the litres', of(ev, 'fuelhalf').length === 1 && of(ev, 'fuelhalf')[0].vars.fuel === 4 && of(ev, 'fuelhalf')[0].vars.driver === 'Alex');
    ev = run(e, a, 8100); e.cross(0, 12000); ev = ev.concat(run(e, a, 12000)); ok('...and not again (the low fuel call comes later)', of(ev, 'fuelhalf').length === 0 && of(ev, 'fuellow').length === 1);
    [e, a] = mkf(); e.cross(0, 4000); run(e, a, 4000); e.cross(0, 8000); run(e, a, 8000); e.block(0, 8500); e.tick(8600); e.tick(12000); e.unblock(0, 13000); ev = run(e, a, 13000);
    ok('a refuel: the call says the litres and how long the stop took, and comes before "leaves the pits"', namesAll(ev) === 'pitin,refuelled,pitout' && of(ev, 'refuelled')[0].vars.refuelled === 6 && of(ev, 'refuelled')[0].vars.pit === '4.5 seconds' && of(ev, 'pitout')[0].vars.pit === '4.5 seconds' && of(ev, 'pitout')[0].vars.fuel === 10 && of(ev, 'refuelled')[0].vars.fuel === 10);
    e.cross(0, 17000); run(e, a, 17000); e.cross(0, 21000); ev = run(e, a, 21000); e.cross(0, 25000); ev = ev.concat(run(e, a, 25000));
    ok('...and after the tank is filled again the half tank call is possible again', of(ev, 'fuelhalf').length === 1);
    { const e5 = mk2({ laps: 9 }, two), a5 = A.create({ lapLimit: 9 }); e5.start(0); run(e5, a5, 0); e5.block(0, 1000); e5.tick(1100); e5.tick(3000); e5.unblock(0, 4000); ev = run(e5, a5, 4000);
      ok('a stop with nothing put in (a race without fuel) has no refuel call, and the stop time is still said', of(ev, 'refuelled').length === 0 && of(ev, 'pitout').length === 1 && of(ev, 'pitout')[0].vars.pit === '3 seconds' && of(ev, 'pitout')[0].vars.fuel === ''); }
    const e0 = createRace({ type: 'race', laps: 9, minLap: 1000, penalty: P, fuel: F, entries: two }); e0.start(0); e0.cross(0, 4000); e0.cross(0, 8000);
    const a0 = A.create({ lapLimit: 9 }); ok('a car that is at half a tank when the call starts is not told', of(run(e0, a0, 8000), 'fuelhalf').length === 0 && of(run(e0, a0, 8100), 'fuelhalf').length === 0);
    // penalties
    [e, a] = mkf(); e.addPoints(1, 1, 100); e.assign(1, 0, 200); ev = run(e, a, 200); e.block(1, 300); e.tick(400); e.tick(900); e.unblock(1, 1000); ev = run(e, a, 1000);
    ok('a served special penalty is announced with its name and the driver', of(ev, 'penaltyserved').length === 1 && of(ev, 'penaltyserved')[0].vars.penalty === 'drivethrough' && of(ev, 'penaltyserved')[0].vars.driver === 'Sam');
    e.addPoints(0, 1, 1100); e.assign(0, 0, 1200); run(e, a, 1200); ev = [e.forgive(0, 0), run(e, a, 1300)][1];
    ok('a forgiven penalty is announced during the race', of(ev, 'penaltyforgiven').length === 1 && of(ev, 'penaltyforgiven')[0].vars.penalty === 'drivethrough' && of(ev, 'penaltyforgiven')[0].vars.driver === 'Alex');
    e.stop(30000); ev = run(e, a, 30000, { phase: 'review' }); e.addPoints(0, 1, 30100);
    ev = [e.addTime(1, 5000), a.observe(e, { phase: 'review', now: 30100 })][1];
    ok('time added by the Race Director (also in the review after the race) is announced with the time', of(ev, 'penaltytime').length === 1 && of(ev, 'penaltytime')[0].vars.added === '5 seconds' && of(ev, 'penaltytime')[0].vars.driver === 'Sam');
    e.assign; e.cars[1].pending.push({ name: 'Stopgo', kind: 'stopgo', seconds: 5 }); ev = [e.forgive(1, 0), a.observe(e, { phase: 'review', now: 30200 })][1];
    ok('...and a forgiven penalty in the review', of(ev, 'penaltyforgiven').length === 1 && of(ev, 'penaltyforgiven')[0].vars.penalty === 'stopgo');
    ev = [e.addTime(0, 90000), a.observe(e, { phase: 'finished', now: 30300 })][1]; ok('...but once the result is final nothing more is said', ev.length === 0);
    ev = [e.addTime(0, 90000), a.observe(e, { phase: 'ready', now: 30400 })][1]; ok('...nor between heats', ev.length === 0);
    e.nullify(0); e.restorePoints(0); ev = a.observe(e, { phase: 'review', now: 30500 }); ok('points taken off or given back in the review are still not announced', ev.length === 0);
  }
  // safety: a lane's call, no lap for a while, the Trackmate
  { const mks = (o = {}) => { const e = mk2({ laps: 50 }, two), a = A.create({ lapLimit: 50, noLapSeconds: 20, ...o }); e.start(0); run(e, a, 0, { trackmate: true }); return [e, a]; };
    let [e, a] = mks(); e.call(1, 500); let ev = run(e, a, 500);
    ok('a call from a lane: the driver and the lane (after the yellow flag)', namesAll(ev) === 'yellowflag,lanecall' && ev[1].vars.driver === 'Sam' && ev[1].vars.lane === 2);
    e.call(1, 600); ok('...once per call', of(run(e, a, 600), 'lanecall').length === 0);
    [e, a] = mks(); e.cross(0, 5000); run(e, a, 5000);
    ok('no lap: not yet after 19.9 seconds', of(run(e, a, 19900), 'nolap').length === 0);
    ev = run(e, a, 20000); ok('...said after 20 seconds, for the car that has not crossed yet, with the driver, lane and seconds', of(ev, 'nolap').length === 1 && of(ev, 'nolap')[0].vars.driver === 'Sam' && of(ev, 'nolap')[0].vars.lane === 2 && of(ev, 'nolap')[0].vars.seconds === 20);
    ok('...once, not at every look', of(run(e, a, 20500), 'nolap').length === 0 && of(run(e, a, 21000), 'nolap').length === 0);
    ev = run(e, a, 25000); ok('...the other car is counted from its own last lap', of(ev, 'nolap').length === 1 && of(ev, 'nolap')[0].vars.driver === 'Alex');
    ok('...also once', of(run(e, a, 90000), 'nolap').length === 0);
    [e, a] = mks(); e.cross(1, 18000); run(e, a, 18000); e.cross(1, 30000); run(e, a, 30000); ev = run(e, a, 38000); ok('...a car that keeps lapping is not called', of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 0);
    ev = run(e, a, 50000); ok('...but again 20 seconds after his last lap', of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 1);
    ev = run(e, a, 70000); ok('...a new stretch is announced again', of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 0);
    e.cross(1, 71000); run(e, a, 71000); ev = run(e, a, 91000); ok('...after a lap, the next quiet stretch is', of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 1);
    [e, a] = mks(); e.block(1, 1000); ev = run(e, a, 25000); ok('...a car in the pits is not asked about', of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 0);
    [['finished', c => { c.done = true; }], ['retired', c => { c.retired = true; }], ['disqualified', c => { c.dq = true; }], ['out of fuel', c => { c.outOfFuel = true; }]].forEach(([why, f]) => {
      [e, a] = mks(); f(e.cars[1]); ev = run(e, a, 25000); ok(`...nor a car that is ${why}`, of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 0 && of(ev, 'nolap').filter(x => x.vars.driver === 'Alex').length === 1);
    });
    [e, a] = mks(); ev = run(e, a, 25000, { idle: c => c.driverName === 'Sam' }); ok('...nor a lane without paid time (a Time Token Session)', of(ev, 'nolap').filter(x => x.vars.driver === 'Sam').length === 0 && of(ev, 'nolap').filter(x => x.vars.driver === 'Alex').length === 1);
    [e, a] = mks(); ev = a.observe(e, { phase: 'paused', now: 25000 }); ok('...nothing while the race is paused', of(ev, 'nolap').length === 0);
    [e, a] = mks({ noLapSeconds: 0 }); ev = run(e, a, 99000); ok('...0 seconds means never', of(ev, 'nolap').length === 0);
    [e, a] = mks({ noLapSeconds: 9999 }); ev = run(e, a, 590000); ok('...at most 600 seconds', of(ev, 'nolap').length === 0 && of(run(e, a, 600000), 'nolap').length === 2);
    [e, a] = mks(); ev = a.observe(e, { phase: 'running' }); ok('...and without a clock nothing', of(ev, 'nolap').length === 0);
    // Trackmate
    { const e9 = mk2({ laps: 50 }, two), a9 = A.create({ lapLimit: 50 }); e9.start(0);
      ok('the first look at the connection says nothing, whichever way it is', run(e9, a9, 0, { trackmate: true }).length === 0 && A.create({}).observe(e9, { phase: 'running', now: 0, trackmate: false }).length === 0); }
    [e, a] = mks(); ev = run(e, a, 100, { trackmate: false }); ok('the Trackmate connection lost during a race', namesAll(ev) === 'trackmatelost');
    ok('...said once', run(e, a, 200, { trackmate: false }).length === 0); ev = run(e, a, 300, { trackmate: true }); ok('...and when it is back', namesAll(ev) === 'trackmateback');
    ok('...and not again', run(e, a, 400, { trackmate: true }).length === 0);
    [e, a] = mks(); ev = a.observe(e, { phase: 'ready', trackmate: false }); ev = ev.concat(a.observe(e, { phase: 'ready', trackmate: true })); ok('before the start nothing is said about the connection (it is normal to connect then)', ev.length === 0);
    ev = a.observe(e, { phase: 'ready', trackmate: false }); a.observe(e, { phase: 'running', now: 1, trackmate: false }); ev = a.observe(e, { phase: 'running', now: 2, trackmate: true });
    ok('...but the state is remembered: a connection lost before the start and found again during the race is said', namesAll(ev) === 'trackmateback');
    [e, a] = mks(); ev = run(e, a, 100, {}); ok('without any Trackmate information nothing is said', ev.length === 0);
    [e, a] = mks(); ev = a.observe(e, { phase: 'paused', now: 100, trackmate: false }); ok('...it is said while the race is paused too', namesAll(ev) === 'trackmatelost');
  }
  // the words every call about a driver has
  { const P = penaltyConfig({ timeRule: 'every', everyPoints: 5, everySeconds: 5, dqPoints: 9, types: [] }), F = fuelConfig({ pitHold: 0 }, { tank: 10, perLap: 3, rate: 5, empty: 'retire' });
    const e = createRace({ type: 'race', laps: 9, minLap: 1000, penalty: P, fuel: F, entries: two }), a = A.create({ lapLimit: 9, trackName: 'Attic', base: { track: 4010, personal: new Map() } }); e.start(0); run(e, a, 0);
    e.cross(0, 5000); run(e, a, 5000); e.cross(1, 5400); run(e, a, 5400); e.addPoints(1, 2, 5500); run(e, a, 5500); e.block(1, 5600); e.tick(5700); const ev = run(e, a, 5700), pin = of(ev, 'pitin')[0];
    ok('every call about a driver has his lane, penalty points, fuel and the gap to the car in front', pin && pin.vars.lane === 2 && pin.vars.points === 2 && pin.vars.fuel === 7 && pin.vars.gapahead === '0.4 seconds' && pin.vars.car === 'Porsche 956', JSON.stringify(pin));
    ok('...the leader has no gap to the car in front', of(run(e, a, 5800), 'pitin').length === 0 && (() => { e.block(0, 5900); e.tick(6000); const l = of(run(e, a, 6000), 'pitin')[0]; return l && l.vars.gapahead === '' && l.vars.lane === 1 && l.vars.points === 0; })());
    ok('...every call has the track and the track record', ev.length > 0 && ev.every(x => x.vars.track === 'Attic' && x.vars.record === '4.01'));
    const p2 = (() => { const e2 = createRace({ type: 'race', laps: 9, minLap: 1000, penalty: P, entries: two }), a2 = A.create({ lapLimit: 9 }); e2.start(0); a2.observe(e2, { phase: 'running', now: 0 }); e2.addPoints(1, 2, 100); return a2.observe(e2, { phase: 'running', now: 100 })[0]; })();
    ok('in the penalty call {points} is what was just given, not the total (and a race without fuel has no {fuel})', p2.call === 'penalty' && p2.vars.points === 2 && p2.vars.fuel === '' && p2.vars.record === '');
    const e3 = createRace({ type: 'race', laps: 9, minLap: 1000, penalty: P, entries: two }); e3.start(0); e3.addPoints(1, 2, 100); const a3 = A.create({ lapLimit: 9 }); a3.observe(e3, { phase: 'running', now: 0 });
    e3.addPoints(1, 1, 200); const pp = a3.observe(e3, { phase: 'running', now: 200 })[0]; ok('...and the second time it is again what was just given (1), not the 3 in total', pp.vars.points === 1);
    const e4 = mk2({ laps: 9 }, [...two, { lane: 2, driverId: 'c', driverName: 'Kim' }]); e4.start(0); const a4 = A.create({}); a4.observe(e4, { phase: 'running', now: 0 });
    ok('a race before its first lap does not break the gap words (nobody has a gap yet)', (() => { e4.block(2, 100); e4.tick(150); return a4.observe(e4, { phase: 'running', now: 200 }).every(x => x.vars.gapahead === ''); })());
  }
  // the lists of the calls
  { const n = A.CALLS.length, groups = [...new Set(A.CALLS.map(c => c.group))];
    ok('52 calls in 11 folders, the Safety folder after the flags', n === 52 && groups.join() === 'Start,Positions,Race progress,Gaps and battles,Laps and records,Pit and fuel,Penalties,Flags,Safety,Finish,Time tokens');
    const set = Sound.defaultSet('x'), fresh = ['firstlap', 'nearrecord', 'fuelhalf', 'refuelled', 'penaltyserved', 'penaltyforgiven', 'penaltytime', 'lanecall', 'nolap', 'trackmatelost', 'trackmateback', 'tokenadded', 'tokenfree'];
    ok('the 13 new calls exist, have sentences, and are off in a new audio set', fresh.every(id => A.CALLS.some(c => c.id === id) && set.calls[id].on === false && set.calls[id].lines.length > 0));
    const old = { calls: { winner: { on: true, lines: [{ text: 'x', file: '' }] } } };
    ok('...a set from before stays quiet for them', fresh.every(id => Sound.choose(old, id, {}, () => 0) === null));
    ok('...a set that has one on says it, with the words filled in', Sound.say && Sound.choose({ calls: { nolap: { on: true, lines: [{ text: 'No lap from {driver} for {seconds} seconds', file: '' }] } } }, 'nolap', { driver: 'Sam', seconds: 20 }, () => 0).text === 'No lap from Sam for 20 seconds');
    ok('the settings of a new set: close to the record 0.1 seconds, no lap after 30 seconds', set.nearRecord === 0.1 && set.noLapSeconds === 30);
    ok('every call that has a setting says so in its label', A.CALLS.find(c => c.id === 'nearrecord').label.includes('how close') && A.CALLS.find(c => c.id === 'nolap').label.includes('how long'));
  }
}


// ---------- 0.89.0: conditions of a sentence, and "not again within" ----------
{
  const L = (text, only) => (only ? { text, file: '', only } : { text, file: '' }), pick = (lines, facts, rnd = () => 0, extra = {}) => Sound.choose({ calls: { newleader: { on: true, lines, ...extra } } }, 'newleader', { driver: 'Alex' }, rnd, facts);
  // the conditions one by one
  ok('no conditions, or empty ones, always hold', Sound.passes(undefined, {}) && Sound.passes({}, {}) && Sound.passes({ driver: '', top: 0, time: 0, gap: 0 }, undefined) && Sound.hasOnly({ driver: '' }) === false && Sound.hasOnly({ top: 3 }) === true);
  ok('only for a driver: his id must be the one in the facts', Sound.passes({ driver: 'a' }, { driverId: 'a' }) && !Sound.passes({ driver: 'a' }, { driverId: 'b' }) && !Sound.passes({ driver: 'a' }, {}) && !Sound.passes({ driver: 'a' }, undefined));
  ok('in the top 3: positions 1 to 3 hold, 4 does not, an unknown position does not', Sound.passes({ top: 3 }, { place: 1 }) && Sound.passes({ top: 3 }, { place: 3 }) && !Sound.passes({ top: 3 }, { place: 4 }) && !Sound.passes({ top: 3 }, { place: null }) && !Sound.passes({ top: 3 }, {}) && !Sound.passes({ top: 3 }, { place: 0 }));
  ok('lap time under: strictly under, in seconds against milliseconds, an unknown time does not hold', Sound.passes({ time: 5.2 }, { time: 5199 }) && !Sound.passes({ time: 5.2 }, { time: 5200 }) && !Sound.passes({ time: 5.2 }, { time: 5201 }) && !Sound.passes({ time: 5.2 }, { time: null }) && !Sound.passes({ time: 5.2 }, {}));
  ok('gap under: strictly under, a gap of 0 holds, nobody in front (null) does not', Sound.passes({ gap: 2 }, { gap: 1999 }) && Sound.passes({ gap: 2 }, { gap: 0 }) && !Sound.passes({ gap: 2 }, { gap: 2000 }) && !Sound.passes({ gap: 2 }, { gap: null }) && !Sound.passes({ gap: 2 }, {}));
  ok('several conditions must all hold', Sound.passes({ driver: 'a', top: 2, time: 6, gap: 3 }, { driverId: 'a', place: 2, time: 5000, gap: 2000 }) && [{ driverId: 'b' }, { place: 3 }, { time: 7000 }, { gap: 4000 }].every(bad => !Sound.passes({ driver: 'a', top: 2, time: 6, gap: 3 }, { driverId: 'a', place: 2, time: 5000, gap: 2000, ...bad })));
  // choosing
  ok('without conditions nothing changes: a random sentence', pick([L('one'), L('two')], undefined, () => 0).text === 'one' && pick([L('one'), L('two')], undefined, () => 0.99).text === 'two');
  ok('a sentence whose conditions hold is said instead of the ones without', pick([L('plain'), L('special', { driver: 'a' })], { driverId: 'a' }).text === 'special' && pick([L('plain'), L('special', { driver: 'a' })], { driverId: 'a' }, () => 0.99).text === 'special');
  ok('...and for another driver the one without conditions is said', pick([L('plain'), L('special', { driver: 'a' })], { driverId: 'b' }, () => 0.99).text === 'plain');
  ok('...with several that hold, one of them is picked at random (the plain ones are left out)', pick([L('plain'), L('s1', { top: 3 }), L('s2', { top: 3 }), L('s3', { top: 1 })], { place: 2 }, () => 0).text === 's1' && pick([L('plain'), L('s1', { top: 3 }), L('s2', { top: 3 }), L('s3', { top: 1 })], { place: 2 }, () => 0.99).text === 's2' && pick([L('plain'), L('s1', { top: 3 }), L('s2', { top: 3 }), L('s3', { top: 1 })], { place: 1 }, () => 0.99).text === 's3');
  ok('a call whose sentences all have conditions that do not hold says nothing', pick([L('a', { driver: 'a' }), L('b', { driver: 'b' })], { driverId: 'c' }) === null && pick([L('a', { top: 1 })], undefined) === null);
  ok('a sentence with an empty condition counts as one without', pick([L('plain'), L('empty', { driver: '', top: 0 })], undefined, () => 0.99).text === 'empty' && pick([L('plain', {})], undefined).text === 'plain');
  ok('a sound file sentence has conditions too', Sound.choose({ calls: { newleader: { on: true, lines: [{ text: '', file: 'data:audio/wav;base64,AAAA', only: { driver: 'a' } }, L('plain')] } } }, 'newleader', {}, () => 0, { driverId: 'a' }).file === 'data:audio/wav;base64,AAAA');
  ok('an empty sentence is not chosen, whatever its conditions', pick([L('  ', { driver: 'a' }), L('plain')], { driverId: 'a' }).text === 'plain');
  ok('the words are filled in as before', pick([L('{driver} leads', { top: 1 })], { place: 1 }).text === 'Alex leads');
  ok('a call that is off says nothing, with or without conditions', pick([L('x', { top: 1 })], { place: 1 }, () => 0, { on: false }) === null);
  // facts of the events of a race
  { const e = mk2({ laps: 5 }, two), a = A.create({ lapLimit: 5, base: { track: 9000, personal: new Map() } }); e.start(0); a.observe(e, { phase: 'running', now: 0 });
    e.cross(0, 5000); const ev = a.observe(e, { phase: 'running', now: 5000 }), rec = ev.find(x => x.call === 'trackrecord'), fl = ev.find(x => x.call === 'firstlap');
    ok('a lap call carries the facts: the driver, his position, the lap time in ms and the gap (nobody in front of the leader)', rec && rec.facts.driverId === 'a' && rec.facts.place === 1 && rec.facts.time === 5000 && rec.facts.gap === null && fl.facts.time === 5000);
    ok('...the facts do not show up among the words', !('_c' in rec.vars) && !('_time' in rec.vars) && Object.keys(rec.vars).every(k => !k.startsWith('_')));
    e.cross(1, 5400); const ev2 = a.observe(e, { phase: 'running', now: 5400 }), f2 = ev2.find(x => x.call === 'firstlap');
    ok('...the driver behind has position 2 and the gap to the car in front', f2.facts.driverId === 'b' && f2.facts.place === 2 && f2.facts.gap === 400 && f2.facts.time === 5400);
    e.addPoints; const fl2 = a.observe(e, { phase: 'ready' }); ok('a call that is not about a driver (or before the start) has empty facts', fl2.length === 0);
    const yl = mk2({ laps: 5 }, two); yl.start(0); const ay = A.create({}); ay.observe(yl, { phase: 'running', now: 0 }); yl.setFlag('yellow', 100); const fy = ay.observe(yl, { phase: 'running', now: 100 })[0];
    ok('...a flag call has no driver, no position, no time and no gap', fy.call === 'yellowflag' && fy.facts.driverId === '' && fy.facts.place === null && fy.facts.time === null && fy.facts.gap === null);
    // a pit stop of the driver behind: his position and gap
    yl.cross(0, 5000); yl.cross(1, 5400); ay.observe(yl, { phase: 'running', now: 5400 }); yl.block(1, 5500); yl.tick(8000); const pit = ay.observe(yl, { phase: 'running', now: 8000 }).find(x => x.call === 'pitin');
    ok('a pit call has his position and the gap to the car in front', pit && pit.facts.driverId === 'b' && pit.facts.place === 2 && typeof pit.facts.gap === 'number');
  }
  ok('which conditions a call can have: the driver and position in calls about a driver, the lap time where a time is said, the gap in calls about a driver, nothing for the flags', (() => {
    const c = id => A.conditionsOf(A.CALLS.find(x => x.id === id));
    return JSON.stringify(c('fastestlap')) === '{"driver":true,"top":true,"time":true,"gap":true}' && JSON.stringify(c('newleader')) === '{"driver":true,"top":true,"time":false,"gap":true}' && JSON.stringify(c('yellowflag')) === '{"driver":false,"top":false,"time":false,"gap":false}' && JSON.stringify(c('tokenwarning')) === '{"driver":true,"top":false,"time":false,"gap":false}' && JSON.stringify(c('finished')) === '{"driver":false,"top":false,"time":false,"gap":false}' && JSON.stringify(A.conditionsOf(undefined)) === '{"driver":false,"top":false,"time":false,"gap":false}';
  })());
  // from the race to the sentence
  { const set = { calls: { fastestlap: { on: true, lines: [L('{driver} sets the fastest lap'), L('Quick lap, {driver}!', { time: 5.5 })] }, newleader: { on: true, lines: [L('{driver} leads'), L('The champion leads again', { driver: 'a', top: 1 })] } } };
    const e = mk2({ laps: 5 }, two), a = A.create({ lapLimit: 5 }); e.start(0); a.observe(e, { phase: 'running', now: 0 });
    e.cross(0, 6000); a.observe(e, { phase: 'running', now: 6000 }); e.cross(0, 11000); let ev = a.observe(e, { phase: 'running', now: 11000 }).find(x => x.call === 'fastestlap'); // 5.00: the fastest so far
    ok('a fast lap gets its own sentence (the lap time is under 5.5 seconds)', Sound.choose(set, ev.call, ev.vars, () => 0, ev.facts).text === 'Quick lap, Alex!');
    e.cross(0, 18000); a.observe(e, { phase: 'running', now: 18000 }); e.cross(0, 22800); ev = a.observe(e, { phase: 'running', now: 22800 }).find(x => x.call === 'fastestlap'); // 4.8 s: fastest again; still under 5.5
    ok('...and a slower fastest lap would get the plain one', !!ev && Sound.choose(set, ev.call, ev.vars, () => 0, { ...ev.facts, time: 6000 }).text === 'Alex sets the fastest lap');
    e.cross(1, 23000); a.observe(e, { phase: 'running', now: 23000 }); e.cross(1, 24000); e.cross(1, 25000); e.cross(1, 26000); e.cross(1, 27000); const nl = a.observe(e, { phase: 'running', now: 27000 }).find(x => x.call === 'newleader');
    ok('a new leader: driver b (second to reach the top) gets the plain sentence, and the champion sentence is only for driver a in first place', !!nl && nl.facts.driverId === 'b' && Sound.choose(set, nl.call, nl.vars, () => 0, nl.facts).text === 'Sam leads' && Sound.choose(set, nl.call, nl.vars, () => 0, { ...nl.facts, driverId: 'a' }).text === 'The champion leads again');
  }
  // not again within
  { const sets = (calls, id = 'S1') => ({ id, calls: Object.fromEntries(Object.entries(calls).map(([k, v]) => [k, { on: true, lines: [L(k)], ...v }])) });
    const played = [], waiting = []; Sound.state.backend = { speak: (t, o, done) => { played.push(t); waiting.push(done); }, file: (u, o, done) => { played.push('file'); waiting.push(done); }, stop: () => { waiting.length = 0; } };
    let clock = 1000; Sound.state.now = () => clock; Sound.stop(); Sound.resetCool();
    const say = (set, id, facts, vars = { driver: 'Alex' }) => { const r = Sound.say(set, id, vars, () => 0, undefined, facts); while (waiting.length) waiting.shift()(); return r; };
    let set = sets({ overtake: { cooldown: 10 } });
    ok('not again within 10 seconds: said the first time', !!say(set, 'overtake', { driverId: 'a' }) && played.length === 1);
    clock += 9999; ok('...held back 9.999 seconds later (nothing is said, and null comes back)', say(set, 'overtake', { driverId: 'a' }) === null && played.length === 1);
    clock += 1; ok('...said again 10 seconds after the first', !!say(set, 'overtake', { driverId: 'a' }) && played.length === 2);
    clock += 5000; say(set, 'overtake', { driverId: 'a' }); clock += 5000; ok('...a call that was held back does not start a new wait (10 seconds after the last one that was said)', !!say(set, 'overtake', { driverId: 'a' }) && played.length === 3);
    clock += 100; ok('...for anyone: another driver is held back too', say(set, 'overtake', { driverId: 'b' }, { driver: 'Sam' }) === null);
    set = sets({ overtake: { cooldown: 10, coolFor: 'driver' } }); Sound.resetCool(); played.length = 0;
    say(set, 'overtake', { driverId: 'a' }); ok('counted for each driver: another driver is said at once', !!say(set, 'overtake', { driverId: 'b' }, { driver: 'Sam' }) && played.length === 2);
    ok('...the same driver again is held back', say(set, 'overtake', { driverId: 'a' }) === null && say(set, 'overtake', { driverId: 'b' }, { driver: 'Sam' }) === null && played.length === 2);
    ok('...a call without a driver id uses the name', (() => { Sound.resetCool(); played.length = 0; say(set, 'overtake', undefined, { driver: 'Kim' }); return say(set, 'overtake', undefined, { driver: 'Kim' }) === null && !!say(set, 'overtake', undefined, { driver: 'Lee' }); })());
    set = sets({ overtake: { cooldown: 10 }, newleader: { cooldown: 10 }, pitin: {} }); Sound.resetCool(); played.length = 0;
    say(set, 'overtake', {}); ok('each call has its own wait', !!say(set, 'newleader', {}) && !!say(set, 'pitin', {}) && !!say(set, 'pitin', {}) && played.length === 4);
    ok('...and so has each audio set', (() => { Sound.resetCool(); played.length = 0; say(sets({ overtake: { cooldown: 10 } }, 'S1'), 'overtake', {}); return !!say(sets({ overtake: { cooldown: 10 } }, 'S2'), 'overtake', {}) && say(sets({ overtake: { cooldown: 10 } }, 'S1'), 'overtake', {}) === null; })());
    ok('a new race starts without waits', (() => { Sound.resetCool(); played.length = 0; const st = sets({ overtake: { cooldown: 10 } }); say(st, 'overtake', {}); Sound.resetCool(); return !!say(st, 'overtake', {}); })());
    ok('no wait, 0, nothing or nonsense: no limit', ['', 0, undefined, 'x', -5, null].every(v => { const st = sets({ overtake: { cooldown: v } }); Sound.resetCool(); return !!say(st, 'overtake', {}) && !!say(st, 'overtake', {}); }));
    ok('...at most an hour', (() => { const st = sets({ overtake: { cooldown: 99999 } }); Sound.resetCool(); say(st, 'overtake', {}); clock += 3599000; const held = say(st, 'overtake', {}) === null; clock += 1000; return held && !!say(st, 'overtake', {}); })());
    ok('a call that has nothing to say does not start a wait', (() => { const st = { id: 'S3', calls: { overtake: { on: true, cooldown: 10, lines: [L('x', { top: 1 })] } } }; Sound.resetCool(); const no = say(st, 'overtake', { place: 5 }); return no === null && !!say(st, 'overtake', { place: 1 }); })());
    ok('a call that is off does not start a wait either', (() => { const st = sets({ overtake: { cooldown: 10, on: false } }); Sound.resetCool(); return say(st, 'overtake', {}) === null && !Sound.state.cool.size; })());
    ok('the callback does not come for a call that is held back (the caller must not wait)', (() => { const st = sets({ overtake: { cooldown: 10 } }); Sound.resetCool(); say(st, 'overtake', {}); let n = 0; const r = Sound.say(st, 'overtake', {}, () => 0, () => { n++; }, {}); return r === null && n === 0; })());
    ok('a held-back urgent call does not clear what is waiting to be said', (() => { const st = sets({ yellowflag: { cooldown: 30 }, pitin: {} }); Sound.resetCool(); Sound.stop(); played.length = 0; say(st, 'yellowflag', {}); Sound.say(st, 'pitin', {}, () => 0); Sound.say(st, 'pitin', {}, () => 0); const queued = Sound.state.queue.length; const r = Sound.say(st, 'yellowflag', {}, () => 0); const after = Sound.state.queue.length; while (waiting.length) waiting.shift()(); return r === null && queued === after && queued >= 1; })());
    Sound.stop(); Sound.resetCool(); Sound.state.backend = null; Sound.state.now = () => Date.now();
  }
  ok('the real clock is the default', Math.abs(Sound.state.now() - Date.now()) < 1000);
}

console.log(fails ? `${fails} FAILED` : 'audio: all PASSED'); process.exit(fails ? 1 : 0);
