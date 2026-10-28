const TM = require('../renderer/trackmate.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
const bytes = s => Array.from(s, c => c.charCodeAt(0));
// a fake PC clock that follows the device clock with a little delay (jitter)
function rig(jitter) {
  let pc = 1000, h = 0, arrival = 1000; const out = [];
  const link = TM.createLink({ now: () => arrival });
  link.on(e => out.push(e));
  const tick = ms => { h += ms; pc = 1000 + h; arrival = pc + (jitter ? Math.floor(Math.random() * jitter) : 0); link.feed(bytes(String(ms) + '\n\r')); };
  const letter = c => { arrival = pc + (jitter ? Math.floor(Math.random() * jitter) : 0); return link.feed(bytes(c)); };
  return { link, out, tick, letter, H: () => h, pc: () => pc };
}
{ // the pattern of the real log: a car over lane 1 gives "157 A", then "200", "56 A", "200", "56 A"... until it has gone
  const r = rig(0);
  for (let i = 0; i < 5; i++) r.tick(200);
  r.tick(157); r.letter('A'); const hit1 = r.H();
  for (let i = 0; i < 3; i++) { r.tick(200); r.tick(56); r.letter('A'); }
  r.tick(200);
  ok('one crossing for a car that keeps the sensor busy (repeated A are one hit)', r.out.filter(e => e.type === 'hit').length === 1 && r.out[0].lane === 0);
  for (let i = 0; i < 10; i++) r.tick(200); // 2 seconds of nothing
  r.tick(121); r.letter('A'); const hit2 = r.H();
  const hits = r.out.filter(e => e.type === 'hit');
  ok('a second pass after the sensor was quiet is a new crossing', hits.length === 2);
  ok('the time between crossings is the device clock', hits[1].at - hits[0].at === hit2 - hit1);
  r.tick(177); r.letter('B'); ok('lane 2 is lane index 1', r.out[r.out.length - 1].lane === 1 && r.out[r.out.length - 1].type === 'hit');
  r.letter('W'); ok('the Trackcall button', r.out[r.out.length - 1].type === 'call');
}
{ // delays on the USB side do not disturb the lap times
  const r = rig(15); for (let i = 0; i < 30; i++) r.tick(200);
  r.tick(100); r.letter('A'); const a = r.H(); for (let i = 0; i < 25; i++) r.tick(200); r.tick(60); r.letter('A'); const b = r.H();
  const hits = r.out.filter(e => e.type === 'hit'); ok('with USB delay of up to 15 ms the lap time is within 15 ms', hits.length === 2 && Math.abs((hits[1].at - hits[0].at) - (b - a)) <= 15);
}
{ // the stream can arrive in any pieces, and the status is reported
  const r = rig(0), st = []; r.link.onStatus(on => st.push(on));
  r.link.setConnected(true); r.link.setConnected(true); r.link.setConnected(false);
  ok('status changes are reported once each', st.join() === 'true,false');
  r.link.feed(bytes('1')); r.link.feed(bytes('50\n')); r.link.feed(bytes('\rA')); ok('pieces are put together', r.out.length === 1 && r.out[0].type === 'hit');
}
{ // lane assignments of the sensors
  const id = [0, 1, 2, 3, 4, 5, 6, 7];
  ok('no saved map: sensor n is lane n', TM.laneMap(undefined).join() === id.join() && TM.laneMap([]).join() === id.join());
  ok('a saved swap is used', TM.laneMap([1, 0, 2, 3, 4, 5, 6, 7]).join() === '1,0,2,3,4,5,6,7');
  ok('a broken map (a lane twice, or out of range) falls back to the default', TM.laneMap([1, 1, 2, 3, 4, 5, 6, 7]).join() === id.join() && TM.laneMap([9, 0, 2, 3, 4, 5, 6, 7]).join() === id.join());
  ok('giving sensor 1 lane 2 swaps with the sensor that had it', TM.swapLane(id, 0, 1).join() === '1,0,2,3,4,5,6,7');
  ok('a three-way change keeps every lane once', new Set(TM.swapLane(TM.swapLane(id, 0, 2), 1, 2)).size === 8);
}
// the check lights beside the sensors
{
  const on = (lit, now, hold) => TM.ledsOn(lit, now, hold).map(Number).join('');
  ok('check lights: nothing has sent yet, all eight are off', on([], 5000) === '00000000' && on(undefined, 5000) === '00000000' && on(Array(8).fill(null), 5000) === '00000000');
  ok('a light is on from the moment its sensor sends, for the hold time (a second)', on([5000], 5000) === '10000000' && on([5000], 5999) === '10000000' && on([5000], 6000) === '00000000');
  ok('each of the eight sensors has its own light', [0, 1, 2, 3, 4, 5, 6, 7].every(i => { const lit = []; lit[i] = 100; const r = TM.ledsOn(lit, 150); return r.length === 8 && r.every((v, k) => v === (k === i)); }));
  ok('several lights at once, each with its own time', on([1000, 1500, null, 1900, null, null, null, 1200], 2000) === '01010001');
  ok('another hold time can be given', on([1000], 1400, 500) === '10000000' && on([1000], 1600, 500) === '00000000');
  ok('a time in the future, rubbish or nothing keeps a light off', on([6000, 'x', NaN, {}, true, -1], 5000) === '00000000');
  ok('the lights follow the letters A to H of the real parser', (() => { const lit = []; const p = require('../renderer/hardware.js').trackmateParser(); p.feed(Uint8Array.from([66, 72, 87, 49])).forEach(m => { if (m.type === 'lane') lit[m.lane - 1] = 100; }); return on(lit, 200) === '01000001'; })());
}

// 1.51.1: a car that stands on a sensor is a car in the pits: 'block' when the letters have kept coming for the hold time, 'free' when they stop
{ const stand = (r, cycles) => { r.tick(157); r.letter('A'); for (let i = 0; i < cycles; i++) { r.tick(200); r.tick(56); r.letter('A'); } };
  const kinds = r => r.out.map(e => e.type + ':' + e.lane).join(' ');
  const r = rig(0); for (let i = 0; i < 5; i++) r.tick(200);
  r.tick(157); r.letter('A'); const hitAt = r.out[0].at; let last = r.pc();
  for (let i = 0; i < 7; i++) { r.tick(200); r.tick(56); r.letter('A'); last = r.pc(); }
  ok('1.51.1: a sensor that has been covered for less than the hold time (7 letters, 1.8 seconds) is a crossing and nothing more', kinds(r) === 'hit:0');
  r.tick(200); r.tick(56); r.letter('A'); last = r.pc();
  ok('...at the first letter after 2 seconds (2.05 s on the clock of the box) the car is in the pits: one block, with the time of the first letter, the time of the lap', kinds(r) === 'hit:0 block:0' && r.out[1].at === hitAt);
  for (let i = 0; i < 6; i++) { r.tick(200); r.tick(56); r.letter('A'); last = r.pc(); }
  ok('...and it is said once, however long the car stays', kinds(r) === 'hit:0 block:0');
  r.tick(200); r.tick(200); ok('...the car is still counted as there while the letters have been away for less than half a second', kinds(r) === 'hit:0 block:0');
  r.tick(200); ok('...when they stay away the car has left: free, at the last letter plus half of the time between two letters (128 ms)', kinds(r) === 'hit:0 block:0 free:0' && r.out[2].at === last + 128);
  for (let i = 0; i < 10; i++) r.tick(200);
  stand(r, 8); r.tick(200); r.tick(200); r.tick(200);
  ok('...the next time the car stands on the sensor is another stop, with its own crossing', kinds(r) === 'hit:0 block:0 free:0 hit:0 block:0 free:0'); }
{ const r = rig(0); for (let i = 0; i < 5; i++) r.tick(200);
  r.tick(157); r.letter('A'); for (let i = 0; i < 2; i++) { r.tick(200); r.tick(56); r.letter('A'); } for (let i = 0; i < 5; i++) r.tick(200);
  ok('1.51.1: a car that only passes (a few letters in half a second) never makes a stop: no block, no free', r.out.map(e => e.type).join() === 'hit'); }
{ const r = rig(0); r.link.setHold(3000); for (let i = 0; i < 5; i++) r.tick(200);
  r.tick(157); r.letter('A'); for (let i = 0; i < 9; i++) { r.tick(200); r.tick(56); r.letter('A'); } const n9 = r.out.length;
  for (let i = 0; i < 3; i++) { r.tick(200); r.tick(56); r.letter('A'); }
  ok('1.51.1: the hold time is the pit hold time of the race: with 3 seconds there is no stop after 2.3 seconds, and there is one after 3.1', n9 === 1 && r.out.map(e => e.type).join() === 'hit,block');
  const set = v => { const q = rig(0); q.link.setHold(v); return q.link.holdMs; };
  ok('...never shorter than half a second (a pass can send letters that long), 2 seconds when it is not a number', set(0) === 500 && set(100) === 500 && set(1234.6) === 1235 && set('x') === 2000 && set(undefined) === 2000 && set(-5) === 2000 && rig(0).link.holdMs === 2000); }
{ const r = rig(0); for (let i = 0; i < 5; i++) r.tick(200);
  r.tick(100); r.letter('A'); r.tick(56); r.letter('B'); for (let i = 0; i < 9; i++) { r.tick(200); r.tick(56); r.letter('A'); }
  ok('1.51.1: every sensor has its own stop: lane 1 stands, lane 2 only passed', r.out.map(e => e.type + ':' + e.lane).join(' ') === 'hit:0 hit:1 block:0');
  r.link.reset(); for (let i = 0; i < 4; i++) r.tick(200);
  ok('...and when the connection is made again nothing is left over of it (no free for a car that stood on the sensor)', r.out.map(e => e.type).join() === 'hit,hit,block'); }
{ // the two real logs (docs/trackmate-logs): a normal crossing first, then a hand held on a sensor
  const fs = require('fs'), path = require('path');
  const replay = (name, hold) => {
    let arrival = 0, lastT = null; const link = TM.createLink({ now: () => arrival }), out = [];
    if (hold !== undefined) link.setHold(hold); link.on(e => out.push(e));
    // the monitor leaves out the steady 200 ms ticks: they are put back where the log has a gap (one for every 200 ms of silence)
    for (const l of fs.readFileSync(path.join(__dirname, '..', 'docs', 'trackmate-logs', name), 'utf8').split(/\r?\n/)) {
      const m = /^\s*([\d.]+)\s+<-\s+(\d+) B\s+(.*)$/.exec(l); if (!m) continue;
      const t = Number(m[1]) * 1000, bytes = m[3].trim().split(/\s+/).slice(0, Number(m[2])).map(h => parseInt(h, 16));
      if (lastT !== null && t - lastT > 450 && bytes[bytes.length - 1] === 13) { const k = Math.round((t - lastT) / 200) - 1; for (let j = 1; j <= k; j++) { arrival = lastT + j * 200; link.feed(bytes0(200)); } }
      arrival = t; link.feed(bytes); lastT = t;
    }
    return out;
  };
  const bytes0 = ms => Array.from(String(ms) + '\n\r', c => c.charCodeAt(0));
  const shape = out => out.filter(e => e.type !== 'call').map(e => e.type + ':' + e.lane).join(' ');
  const lin = replay('trackmate-log-linux.txt'), win = replay('trackmate-log-windows.txt');
  ok('1.51.1: Linux log: two normal crossings, then lane 1 held for about 6 seconds: one stop, and the car leaves; lane 2 held and the log ends while it stands', shape(lin) === 'hit:0 hit:1 hit:0 block:0 free:0 hit:1 block:1');
  { const b = lin.find(e => e.type === 'block' && e.lane === 0), f = lin.find(e => e.type === 'free' && e.lane === 0), h = lin.filter(e => e.type === 'hit' && e.lane === 0)[1];
    ok('...the stop starts at the crossing (the time of the lap) and ends when the letters stop: 5.9 seconds on the clock of the box (the letters of the log run from 788.3 to 794.1)', b.at === h.at && f.at - b.at > 5700 && f.at - b.at < 6100); }
  ok('...the two normal crossings at the start are no stop (and the three presses of the Trackcall button before them are calls, nothing else)', lin.filter(e => e.type === 'call').length === 3 && lin.filter(e => e.type !== 'call').slice(0, 2).every(e => e.type === 'hit'));
  ok('1.51.1: Windows log: the crossings by hand (taps of one to three letters) are no stop; lane 1 held for 4.4 seconds is one, and it ends; lane 2 held for 2.05 seconds on the clock of the box is one, and the log ends while it stands', shape(win) === 'hit:0 hit:1 hit:0 hit:1 hit:0 hit:1 hit:0 hit:1 hit:0 hit:0 block:0 free:0 hit:1 block:1');
  ok('...with a pit hold time of 2.5 seconds the short hold of lane 2 is no stop, the long one still is', shape(replay('trackmate-log-windows.txt', 2500)) === 'hit:0 hit:1 hit:0 hit:1 hit:0 hit:1 hit:0 hit:1 hit:0 hit:0 block:0 free:0 hit:1');
  ok('...and with 6 seconds neither is', !replay('trackmate-log-windows.txt', 6000).some(e => e.type === 'block' || e.type === 'free') && !replay('trackmate-log-linux.txt', 7000).some(e => e.type === 'block' || e.type === 'free')); }


{ // how the race screen listens to it (race.js): the pit hold time of the setup is the hold time of the link, a stop is a stop of the engine counted from the crossing, a token session has no pit
  const race = require('fs').readFileSync(require('path').join(__dirname, '..', 'renderer', 'race.js'), 'utf8');
  ok('1.51.1: the race gives the link the pit hold time of its setup when the Trackmate is the timing hardware', /if \(hwUse === 'trackmate'\) Trackmate\.link\.setHold\(pitMs\);/.test(race) && /pitMs = fuelCfg\.pitHold/.test(race));
  ok('...a crossing of the Trackmate is counted at once, and the tyre penalty that may be due waits for the stop (held)', /if \(i >= 0\) crossCar\(i, e\.at, true\); \}/.test(race) && /eng\.cross\(i, tAt, held \? \{ holdDue: true \} : undefined\)/.test(race));
  ok('...a block starts the stop of the engine at the time of the crossing, without a second crossing (crossed), and never later than now', /eng\.block\(i, Math\.min\(at, now\(\)\), true\)/.test(race));
  ok('...a free ends it, at the time the sensor says (never later than now)', /eng\.unblock\(i, at !== undefined \? Math\.min\(at, now\(\)\) : now\(\)\)/.test(race));
  ok('...a token session has no pit: a stand on the sensor does nothing there', /e\.type === 'block' \|\| e\.type === 'free'\) \{[^}]*i >= 0 && !tokens\) \{ if \(e\.type === 'block'\) holdCar\(i, e\.at\); else unblockCar\(i, e\.at\); \}/.test(race));
  ok('...the other hardware does not change: the keys, the Pit button and the Arduino box cross and block as before (no held, no crossed)', /const blockCar = i => \{ if \(live\.phase === 'running'\) \{ eng\.block\(i, now\(\)\);/.test(race)); }

{ const page = require('fs').readFileSync(require('path').join(__dirname, '..', 'renderer', 'hardwareui.js'), 'utf8'), sch = require('../schema.js');
  ok('the Trackmate page points to the real Race Settings sensor confirmation control and explains both behaviours', page.includes('Sensor must be blocked for this long to start a pit stop') && page.includes('Race Setup &gt; Race Settings') && page.includes('With Service Stop off') && sch.racesetups.fields.some(f => f.key === 'pitHold' && f.group === 'length' && f.label.startsWith('Sensor must be blocked for this long')) && sch.racesetups.groups.some(g => g.id === 'service' && g.title === 'Service Stop')); }

console.log(fails ? fails + ' FAILED' : 'trackmate: all PASSED'); process.exit(fails ? 1 : 0);
