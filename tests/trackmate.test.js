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
console.log(fails ? fails + ' FAILED' : 'trackmate: all PASSED'); process.exit(fails ? 1 : 0);
