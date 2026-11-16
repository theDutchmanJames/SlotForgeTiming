// 1.39.1: the checks for the faults found in the full audit (one block per fault, each fails without its fix).
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const Eng = require('../renderer/engine.js');
const { createRace, createHeatRace, scoringOf, finalsOf, fmtTime } = Eng;
const E = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i }));

// ---- the race engine ----
{
  // a lap taken out of a finished car in the review ("from the race too") must not put that car in front of the cars that drove more laps
  const r = createRace({ type: 'race', laps: 3, entries: E(2), skipFirst: false }); r.start(0);
  [5000, 10000, 15000].forEach(t => r.cross(0, t)); [5100, 10100, 15100].forEach(t => r.cross(1, t));
  r.removeLap(1, 2, true);
  const st = r.standings();
  ok('a finished car that lost a lap in the review ranks behind the car with all its laps', st[0].index === 0 && st[1].index === 1 && r.cars[1].laps.length === 2);
  ok('...and its time loses that lap (15100 less 5000)', r.cars[1].total === 10100 && r.timeOf(r.cars[1]) === 10100);
  const s2 = createRace({ type: 'race', laps: 2, entries: E(2), skipFirst: true }); s2.start(0);
  s2.cross(0, 1000); s2.cross(1, 4000); s2.cross(0, 6000); s2.cross(1, 9000); s2.cross(0, 11000); s2.cross(1, 14000);
  s2.removeLap(0, 0, true);
  ok('with the first lap skipped the time before the first crossing stays in the total (11000 less 5000)', s2.cars[0].total === 6000 && s2.cars[0].laps.length === 1 && s2.cars[1].total === 14000);
  ok('...and the car with both laps is still ahead of the one that lost a lap', s2.standings()[0].index === 1);
}
{
  // retired and disqualified cars: the one that drove more laps ranks first among them
  const r = createRace({ type: 'race', laps: 20, entries: E(3), skipFirst: false }); r.start(0);
  r.cross(0, 5000); r.cross(1, 5000); r.cross(1, 10000); r.cross(1, 15000); r.cross(1, 20000); r.cross(2, 5000); r.cross(2, 10000);
  r.setDq(0, true, 21000); r.setDq(1, true, 21000);
  const order = r.standings().map(x => x.index);
  ok('among disqualified cars the one with more laps ranks first (3 laps... above 1 lap), the car still racing is ahead of both', order[0] === 2 && order[1] === 1 && order[2] === 0);
}
{
  // Stop while paused: the race ends where the clock stands, the pause is not racing time
  const r = createRace({ type: 'race', laps: 50, entries: E(2), skipFirst: false }); r.start(0); r.cross(0, 5000);
  r.pause(12000); r.stop(100000);
  ok('stopping a paused race ends it at the moment of the pause', r.status === 'finished' && r.endAt === 12000 && r.elapsed(100000) === 12000);
  const q = createRace({ type: 'race', laps: 50, entries: E(2), skipFirst: false }); q.start(0); q.stop(7000);
  ok('stopping a running race ends it now', q.endAt === 7000);
}
{
  // the gap to the leader counts from the moments the cars crossed the line, the time before the first crossing included
  const r = createRace({ type: 'race', laps: 2, entries: E(2), skipFirst: true }); r.start(0);
  r.cross(0, 1000); r.cross(1, 4000); r.cross(0, 6000); r.cross(1, 9000); r.cross(0, 11000); r.cross(1, 14000);
  const g = r.standings().map(x => x.gap), gi = r.gapInfo();
  ok('equal laps, the second car crossed the first line 3 seconds later: it is 3 seconds behind (not +0.000)', g[0] === '' && g[1] === '+3.000');
  ok('...the spoken numbers say the same (3000 ms to the leader and to the car in front)', gi[1].lead === 3000 && gi[1].ahead === 3000);
  const n = createRace({ type: 'race', laps: 2, entries: E(2), skipFirst: false }); n.start(0);
  n.cross(0, 5000); n.cross(1, 5300); n.cross(0, 10000); n.cross(1, 10300);
  ok('without a skipped first lap nothing changed (the gap is still the difference of the crossings)', n.standings()[1].gap === '+0.300');
}
{
  // the total of a heat row has the time penalty in it, so "the lowest total time" counts it
  const people = [0, 1].map(i => ({ driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i }));
  const setup = { resultBy: 'laps', heatBy: 'laps', tieBreak: 'time' };
  const heat = createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], lanes: 2, resultBy: 'laps', points: [], ...scoringOf(setup), ...finalsOf(setup) });
  const r = createRace({ type: 'race', laps: 2, entries: heat.entries(), skipFirst: false }); r.start(0);
  r.cross(0, 5000); r.cross(0, 10000); r.cross(1, 5250); r.cross(1, 10500); r.addTime(0, 2000);
  heat.record(r);
  const rows = heat.results[0].rows;
  ok('the heat row total of the car with a 2 second time penalty is 12.000 (10.000 + 2.000)', rows.find(x => x.participant === 0).total === 12000 && rows.find(x => x.participant === 1).total === 10500);
  ok('...so with "the lowest total time" breaking the tie the car without the penalty is first overall', heat.overall()[0].participant === 1);
}
{
  ok('a time just below a whole minute rounds up to the minute (59999.6 ms is 1:00.000, 119999.6 ms is 2:00.000)', fmtTime(59999.6) === '1:00.000' && fmtTime(119999.6) === '2:00.000' && fmtTime(59999.4) === '59.999');
  ok('...the usual times are as they were', fmtTime(0) === '0.000' && fmtTime(1234) === '1.234' && fmtTime(61234) === '1:01.234' && fmtTime(600000) === '10:00.000');
  ok('...a missing or broken value is a dash, a negative time keeps its sign', fmtTime(NaN) === '–' && fmtTime(undefined) === '–' && fmtTime(null) === '–' && fmtTime('') === '–' && fmtTime(-5000) === '-5.000');
}

// ---- the live viewer ----
{
  global.Tokens = global.Tokens || require('../renderer/tokens.js'); global.RaceEngine = Eng;
  const LS = require('../renderer/liveshare.js');
  const mkEng = () => Eng.createRace({ type: 'race', laps: 5, entries: [{ lane: 0, driverName: 'A', driverId: 'a' }, { lane: 1, driverName: 'B', driverId: 'b' }] });
  const base = { personal: new Map(), track: Infinity, trackName: '' }, layout = { widgets: [], laneColors: [] };
  const stat = (id, eng) => LS.packStatic({ raceId: id, title: 't', eng, setup: {}, layout, track: { lanes: 2 }, lanes: 2, base });
  const dyn = (id, eng, now) => ({ raceId: id, eng, phase: 'running', calling: false, lights: 0, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now });
  const wire = x => JSON.parse(JSON.stringify(x));
  const e1 = mkEng(); e1.start(1000); const snd = LS.sender(), V = LS.viewer();
  V.feedStatic(wire(stat('R1', e1)));
  ok('a viewer takes the messages of its race', V.feedDynamic(wire(snd.pack(dyn('R1', e1, 1100), 1100)), 50) === true && V.hasRace());
  const e2 = mkEng(); e2.start(5000); snd.reset();
  const m2 = wire(snd.pack(dyn('R2', e2, 5100), 5100));
  ok('a viewer that missed the start of the next race asks for the whole state (it used to wait for the next start)', V.feedDynamic(m2, 100) === false && V.needsSync() === true);
  V.feedStatic(wire(stat('R2', e2)));
  ok('...and once it has the start of that race, it does not ask again and takes the messages', V.needsSync() === false && V.feedDynamic(m2, 100) === true && V.hasRace());
  const V2 = LS.viewer();
  ok('a viewer that has no race yet asks for the state when a message arrives', V2.feedDynamic(m2, 100) === false && V2.needsSync() === true);
}

// ---- lists with a decimal comma ----
{
  const LN = require('../renderer/listnum.js'), AP = require('../renderer/adjustpad.js');
  const L = t => LN.numbers(t).join('|');
  ok('a list with a decimal comma: "0,5, 1, 2,5" is 0.5, 1 and 2.5', L('0,5, 1, 2,5') === '0.5|1|2.5');
  ok('...also separated by spaces or semicolons', L('0,5 1 2,5') === '0.5|1|2.5' && L('0,5; 1; 2,5') === '0.5|1|2.5');
  ok('...a lone 0,5 is half (a list never holds a 0)', L('0,5') === '0.5' && L('0,25') === '0.25');
  ok('the usual lists are as they were: "1, 2.5, 5", "10,8,6", "1,3,10"', L('1, 2.5, 5') === '1|2.5|5' && L('10,8,6') === '10|8|6' && L('1,3,10') === '1|3|10' && L('10, 8, 6') === '10|8|6');
  ok('nothing, null and rubbish give a short or empty list', L('') === '' && L(null) === '' && L(undefined) === '' && L(' , ;') === '');
  ok('tidy makes a clean list of it, and leaves text that is no list alone', LN.tidy('15,4, 15,8') === '15.4, 15.8' && LN.tidy('10,8,6') === '10,8,6' && LN.tidy('11.55, 12.08,12.5') === '11.55, 12.08,12.5' && LN.tidy('10, abc') === '10, abc' && LN.tidy('') === '');
  ok('the penalty pads take a decimal comma (0,5 s is half a second, not 5)', AP.clean('time', '0,5, 1, 2,5').join() === '0.5,1,2.5' && AP.ownOf({ padSeconds: '0,5' }, 'time').join() === '0.5');
  const Tk = require('../renderer/tokens.js');
  ok('the minutes of the time token buttons take a decimal comma too', Tk.parseIncrements('0,5, 5, 10').join() === '0.5,5,10' && Tk.parseIncrements('5, 10, 15').join() === '5,10,15');
  // the undo of a pad takes back what really moved
  const h = AP.history(30, 2500); let dmg = 0;
  h.push({ lane: 0, group: 'damage', amount: 1, text: '+1', before: 0, at: 0 }); dmg = 2; // (a driver with a damage factor of 2: +1 asked, 2 happened)
  h.settle(() => dmg, 100);
  const u = h.undo();
  ok('Undo takes back what the car really got (2 points when 1 was asked and the factor doubled it)', u && u.amount === -2);
  const h2 = AP.history(30, 2500); h2.push({ lane: 0, group: 'damage', amount: 5, text: '+5', before: 0, at: 0 }); h2.settle(() => 3, 100);
  ok('...and when the pad hit a limit it takes back what moved (3 of 5)', h2.undo().amount === -3);
}

// ---- the announcer ----
{
  const A = require('../renderer/announcer.js'), Sound = require('../renderer/sound.js');
  const names = ['Alex', 'Sam', 'Kim', 'Lee'], ent = n => names.slice(0, n).map((nm, i) => ({ lane: i, driverId: 'd' + i, driverName: nm }));
  ok('a time is spoken from hundredths: 59.999 s is 1 minute, 119.999 s is 2 minutes, 65.123 s is 1 minute 5.12', A.speakTime(59999) === '1 minute' && A.speakTime(119999) === '2 minutes' && A.speakTime(65123) === '1 minute 5.12' && A.speakTime(5123) === '5.12' && A.speakTime(59994) === '59.99');
  ok('...a difference of 59.996 s is a minute too, a tiny gap is "less than a tenth"', A.speakDiff(59996) === '1 minute' && A.speakDiff(120) === '0.12 seconds' && A.speakGap(40) === 'less than a tenth of a second' && A.speakGap(400) === '0.4 seconds');
  { // nobody is ever passed on the track: lap 1 is completed in the order Sam, Kim, Lee, Alex
    const eng = createRace({ type: 'race', laps: 10, minLap: 1000, entries: ent(4) }), an = A.create({ lapLimit: 10 }), calls = [];
    eng.start(0); an.observe(eng, { phase: 'running' });
    [0, 1, 2, 3].forEach(i => eng.cross(i, 1)); an.observe(eng, { phase: 'running' });
    [[6000, 1], [6100, 2], [6200, 3], [6300, 0]].forEach(([t, i]) => { eng.cross(i, t); an.observe(eng, { phase: 'running' }).forEach(e => calls.push(e.call)); });
    ok('the order of the first lap makes no overtake calls (nobody was passed)', !calls.includes('overtake'));
  }
  { // red flag, restart: lights out, then no "back to green" over it
    const eng = createRace({ type: 'race', laps: 50, minLap: 1000, entries: ent(2) }), an = A.create({});
    eng.start(0); an.observe(eng, { phase: 'running' }); eng.setFlag('red', 100); an.observe(eng, { phase: 'paused' });
    for (let n = 0; n <= 5; n++) an.observe(eng, { phase: 'countdown', lights: n });
    eng.setFlag('red', 9000);
    const batch = an.observe(eng, { phase: 'running' }).map(e => e.call);
    ok('after a red flag restart the lights out are said and "back to green" does not cut them off', batch.includes('lightsout') && !batch.includes('greenflag'));
    const e2 = createRace({ type: 'race', laps: 50, minLap: 1000, entries: ent(2) }), a2 = A.create({});
    e2.start(0); a2.observe(e2, { phase: 'running' }); e2.setFlag('yellow', 100); a2.observe(e2, { phase: 'running' }); e2.setFlag('yellow', 200);
    ok('a yellow flag that is lifted while racing still says "back to green"', a2.observe(e2, { phase: 'running' }).map(e => e.call).includes('greenflag'));
  }
  { // a race that ends under the yellow flag: the end is said, not "back to green"
    const eng = createRace({ type: 'race', laps: 2, minLap: 1000, entries: ent(2) }), an = A.create({ lapLimit: 2 });
    eng.start(0); an.observe(eng, { phase: 'running' }); [0, 1].forEach(i => eng.cross(i, 1));
    eng.cross(0, 5000); eng.cross(1, 5500); an.observe(eng, { phase: 'running' });
    eng.setFlag('yellow', 6000); an.observe(eng, { phase: 'running' }); eng.cross(0, 10000); eng.cross(1, 10600);
    const batch = an.observe(eng, { phase: 'review', heat: { idx: 0, count: 3 } }).map(e => e.call);
    ok('a heat that ends under the yellow flag says that the heat is over, not "back to green"', batch.includes('heatend') && !batch.includes('greenflag'));
  }
  { // a disqualified car is no podium finisher
    const eng = createRace({ type: 'race', laps: 3, minLap: 1000, entries: ent(3) }), an = A.create({ lapLimit: 3 });
    eng.start(0); an.observe(eng, { phase: 'running' });
    const t = [1, 1, 1]; for (let k = 0; k < 4; k++) for (let i = 0; i < 3; i++) { t[i] += 5000 + i * 300; eng.cross(i, t[i]); }
    eng.setDq(1, true);
    const ev = an.observe(eng, { phase: 'running' }).filter(e => /winner|podium/.test(e.call)).map(e => `${e.call}:${e.vars.driver}`);
    ok('winner and podium leave out a disqualified car (Alex wins, Kim is second, Sam is not third)', ev.includes('winner:Alex') && ev.includes('podium:Kim') && !ev.some(x => x.endsWith(':Sam')));
  }
  { // Guests are not one driver
    const eng = createRace({ type: 'practice', minLap: 1000, entries: [{ lane: 0, driverId: '', driverName: 'Guest' }, { lane: 1, driverId: '', driverName: 'Guest' }] }), an = A.create({}), calls = [];
    eng.start(0); an.observe(eng, { phase: 'running' }); eng.cross(0, 1); eng.cross(1, 1);
    [[0, 8001], [0, 14001], [1, 12001], [1, 21001]].forEach(([i, t]) => { eng.cross(i, t); an.observe(eng, { phase: 'running' }).forEach(e => calls.push(e.call)); });
    ok('a Guest has no personal best (and the Guests do not share one)', !calls.includes('personalbest'));
  }
  { // the laps of an earlier heat are known to the next one
    const base = { personal: new Map([['d0', 5200], ['d1', 5300]]), track: 5000 }, e2 = ent(2);
    const heat = (b, a, s) => { const eng = createRace({ type: 'race', laps: 5, minLap: 1000, entries: e2 }), an = A.create({ base: b, lapLimit: 5 }), out = [];
      eng.start(0); an.observe(eng, { phase: 'running' }); eng.cross(0, 1); eng.cross(1, 1); let ta = 1, ts = 1;
      for (let i = 0; i < 2; i++) { ta += a[i]; eng.cross(0, ta); ts += s[i]; eng.cross(1, ts); an.observe(eng, { phase: 'running' }).forEach(e => { if (/record/.test(e.call)) out.push(e.call + ':' + e.vars.driver); }); } return out; };
    const first = heat(base, [4500, 4400], [5400, 5400]);
    const second = heat({ personal: new Map([['d0', 4400], ['d1', 5300]]), track: 4400 }, [5600, 5600], [4800, 4900]);
    ok('with the records of the database, heat 1 sets a track record; a next heat that knows heat 1 does not set one with 4.800', first.some(x => x.endsWith('Alex')) && !second.some(x => x.startsWith('trackrecord')));
  }
  { // the sound: a recorded file that plays is stopped by an urgent call or by Stop, and a call that was cut off does not release the next
    const events = []; let audio = null, utter = null;
    global.Audio = function () { audio = this; this.play = () => { events.push('play'); return Promise.resolve(); }; this.pause = () => { events.push('pause'); }; };
    global.speechSynthesis = { cancel() { events.push('cancel'); }, speak(u) { utter = u; events.push('speak:' + u.text); }, getVoices: () => [] };
    global.SpeechSynthesisUtterance = function (t) { this.text = t; };
    const reset = () => { Sound.state.backend = null; Sound.state.queue = []; Sound.state.busy = false; events.length = 0; };
    const set = { id: 's', name: 's', calls: { podium: { on: true, lines: [{ text: '', file: 'data:audio/wav;base64,AAAA' }] }, redflag: { on: true, lines: [{ text: 'Red flag' }] }, winner: { on: true, lines: [{ text: 'Alex wins' }] }, newleader: { on: true, lines: [{ text: 'Kim leads' }] } } };
    reset(); let after = 0;
    Sound.say(set, 'podium', {}, undefined, () => { after++; });
    ok('a recorded file plays', events.join() === 'play' && Sound.state.busy === true);
    Sound.say(set, 'redflag', {});
    ok('an urgent call stops the file that plays (it used to play on, over the call)', events.includes('pause') && events.includes('cancel'));
    ok('...the call that was cut off is finished (what follows it is done)', after === 1);
    ok('...and the urgent call is being said (the old file did not release the queue)', events[events.length - 1] === 'speak:Red flag' && Sound.state.busy === true);
    Sound.say(set, 'winner', {}); Sound.say(set, 'newleader', {});
    ok('...the calls after it wait their turn (only the red flag is spoken so far)', events.filter(e => e.startsWith('speak:')).length === 1);
    utter.onend(); ok('...and go on one at a time when the voice has finished', events.filter(e => e.startsWith('speak:')).length === 2 && events[events.length - 1] === 'speak:Alex wins');
    Sound.stop(); ok('Stop empties the queue and cancels the voice', Sound.state.queue.length === 0 && Sound.state.busy === false && events.includes('cancel'));
    reset(); Sound.say(set, 'podium', {}); Sound.stop();
    ok('Stop also pauses a recorded file that plays', events.includes('pause'));
    reset(); for (let i = 0; i < 500; i++) Sound.state.log.push('x'); Sound.say(set, 'winner', {});
    ok('the log of what was said does not grow without limit', Sound.state.log.length <= 201);
    reset(); delete global.Audio; delete global.speechSynthesis; delete global.SpeechSynthesisUtterance;
  }
}

// ---- the rules of a custom image ----
{
  const W = require('../renderer/widgets.js'), rule = (v, op, value) => W.ruleHolds({ var: 'x', op, value }, { x: v });
  ok('a rule on a temperature compares the numbers ("30 °C" is more than 25)', rule('30 °C', '>', '25') && !rule('20 °C', '>', '25') && rule('30 °C', '=', '30'));
  ok('...a speed, a distance and a time penalty ("10 km/h" at least 10, "84 m" more than 50, "+2 s" more than 0)', rule('10 km/h', '>=', '10') && rule('84 m', '>', '50') && rule('+2 s', '>', '0') && !rule('+0 s', '>', '0'));
  ok('...a lap time of more than a minute ("1:05.123" less than 70)', rule('1:05.123', '<', '70') && !rule('1:05.123', '<', '60') && rule('59.5', '<', '60'));
  ok('...a name with an & or a < in it is compared as typed', rule('Tom &amp; Jerry', '=', 'Tom & Jerry') && rule('A &lt; B', '=', 'A < B') && !rule('Tom &amp; Jerry', '=', 'Tom'));
  ok('...a decimal comma in the rule works ("2,5")', rule('3', '>', '2,5') && rule('2.5', '=', '2,5'));
  ok('...two texts that start with a number are texts ("2 Fast" is not "2 Furious"), and text with "<" is never true', !rule('2 Fast', '=', '2 Furious') && rule('2 Fast', '=', '2 fast') && !rule('Alex', '<', '5'));
  ok('the heat list writes a time like everything else (59.999 s carried to the minute: 1:00.000)', W.heatListHtml({ idx: 1, by: 'time', list: [{ name: 'Heat 1', drivers: [{ lane: 0, name: 'A' }], rows: [{ pos: 1, name: 'A', tm: 59999.6, fin: 1 }] }, { name: 'Heat 2', drivers: [], rows: [] }] }, 'running', { detail: 'winner' }).includes('1:00.000'));
}

// ---- later finds of the audit ----
{
  // heats limited by time and the overall result "by total race time": everybody drives the same time, so the laps count - also when the heat race is made from the answer of the setup
  const setup = { resultBy: 'time', heatBy: 'time' };
  ok('heats limited by time are counted by laps (scoringOf of the setup says so, and the heat race made from that answer keeps it)', scoringOf(setup).byTime === false && scoringOf({ ...scoringOf(setup), resultBy: 'time' }).byTime === false && scoringOf({ resultBy: 'time', heatBy: 'laps' }).byTime === true);
  // the live average and median lap are those of the saved result: a lap with a pit stop and a lap taken out of the records are not in them
  const c = { laps: [5000, 5000, 5000, 16000, 5000, 5000, 9000], bad: [], invalid: [], pitLaps: [3], removed: [6] };
  ok('the lap with a pit stop and the lap taken out of the records are left out of the live average (5 laps of 5.000)', Eng.averageLaps(c).length === 5 && Eng.averageLaps(c).every(x => x === 5000) && Eng.goodLaps(c).length === 7);
  ok('...a car without those fields (an older save) averages all its good laps', Eng.averageLaps({ laps: [4000, 6000] }).length === 2);
  const En = require('../renderer/endurance.js'), cfgE = { on: true, mode: 'choice', unit: 'distance', stintMin: 30, stintMax: 100, where: 'line' };
  ok('the stints of a swap by distance are said in one unit (metres, or feet when the display is feet)', /stints of 30 to 100 m\)/.test(En.rulesText(cfgE)) && /stints of 98\.4 to 328 ft\)/.test(En.rulesText({ ...cfgE, disp: 'ft' })) && /stints of 10 to 40 minutes\)/.test(En.rulesText({ ...cfgE, unit: 'time', stintMin: 10, stintMax: 40 })));
}

console.log(fails ? fails + ' AUDIT TESTS FAILED' : 'ALL AUDIT TESTS PASSED');
process.exit(fails ? 1 : 0);
