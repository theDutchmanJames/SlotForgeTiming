// Audit fixes (2.2.5) for the serial timing boxes: a lost byte must not create a lap or a pit release, and a cut-off event of the
// SlotForge box must not swallow the lap letters after it. (The race-level faults, a disconnect or the box's safe state, are in boxscreen.test.js.)
const assert = require('assert/strict');
const HW = require('../renderer/hardware.js'), TM = require('../renderer/trackmate.js'), AB = require('../renderer/arduinobox.js'), AR = require('../renderer/arduinorace.js');
let groups = 0; const test = (n, f) => { f(); groups++; console.log('ok   ' + n); };
const enc = s => Uint8Array.from([...s].map(c => c.charCodeAt(0)));
const ticks = (P, s) => P.feed(enc(s)).filter(m => m.type === 'tick').map(m => m.ms);

test('Trackmate: a normal tick is one tick, as before (also a tick without its LF)', () => {
  const P = HW.trackmateParser();
  assert.deepEqual(ticks(P, '200\n\r'), [200]); assert.deepEqual(ticks(P, '56\n\r'), [56]); assert.deepEqual(ticks(P, '0\n\r'), [0]); assert.deepEqual(ticks(P, '170\r'), [170]);
  const m = P.feed(enc('200\n\r'))[0]; assert.deepEqual(m.raw, [50, 48, 48, 10, 13]);
});
test('Trackmate: two ticks that arrive as one because a CR was lost count as two ticks', () => {
  const P = HW.trackmateParser();
  assert.deepEqual(ticks(P, '200\n200\n\r'), [200, 200]);
  assert.deepEqual(ticks(P, '\n92\n\r'), [92]); // (a stray LF before the digits)
});
test('Trackmate: three ticks merged by lost CRs still count, and the monitor sees the bytes as they came', () => {
  const P = HW.trackmateParser();
  assert.deepEqual(ticks(P, '200\n200\n200\n\r'), [200, 200, 200]);
  const m = P.feed(enc('200\r\n56\n\r')); // (CR LF in the wrong order: still two ticks, the stray LF goes with the second)
  assert.deepEqual(m.map(x => x.ms), [200, 56]); assert.deepEqual(m[1].raw, [10, 53, 54, 10, 13]);
  const raw = P.feed(enc('\n\n92\n\r'))[0].raw; assert.deepEqual(raw, [10, 10, 57, 50, 10, 13]);
});
test('Trackmate: something that cannot be a clock step is no tick (the clock does not jump)', () => {
  const P = HW.trackmateParser();
  for (const s of ['200200\n\r', '99999\r', '\n\r', '6000\n\r']) assert.deepEqual(ticks(P, s), [], s);
  assert.equal(P.feed(enc('200200\n\r'))[0].type, 'other');
  assert.deepEqual(ticks(P, '5000\n\r'), [5000]);
});
test('Trackmate: a car that stands on the pit sensor stays there when a CR is lost (no release dated in the past, no extra lap)', () => {
  let t = 0; const L = TM.createLink({ now: () => t }); L.setConnected(true); L.setHold(2000);
  const ev = []; L.on(e => ev.push(e.type));
  const tick = (ms, cr = true) => { t += ms; L.feed(enc(String(ms) + '\n' + (cr ? '\r' : ''))); };
  for (let i = 0; i < 20; i++) tick(200);
  for (let i = 0; i < 20; i++) { tick(200); L.feed(enc('A')); }
  assert.deepEqual(ev, ['hit', 'block']); ev.length = 0;
  tick(200, false); t += 200; L.feed(enc('200\n\r')); L.feed(enc('A'));
  for (let i = 0; i < 5; i++) { tick(200); L.feed(enc('A')); }
  assert.deepEqual(ev, []);
  for (let i = 0; i < 5; i++) tick(200); // the car drives off: one release, at the right time
  assert.deepEqual(ev, ['free']);
});
test('SlotForge box: a cut-off "[...]" event ends at the next line or "[" and the lap letters after it still count', () => {
  let t = 0; const L = AB.createLink({ now: () => t }); L.setConnected(true);
  const hits = []; L.on(e => { if (e.type === 'hit') hits.push(e.lane); });
  const feed = s => L.feed(enc(s));
  feed('200\n\r[!'); feed('5\n\rA'); for (let i = 0; i < 3; i++) feed('200\n\r'); feed('3\n\rB'); for (let i = 0; i < 3; i++) feed('200\n\r'); feed('0\n\r[!]');
  assert.deepEqual(hits, [0, 1]);
  const P = AB.parser();
  const out = P.feed(enc('[S+ 1234][P2+]A'));
  assert.deepEqual(out.map(m => m.type), ['ext', 'ext', 'lane']); assert.equal(out[0].text, 'S+ 1234');
  const cut = P.feed(enc('[T1 12[V 1.0.7 nano 8]B'));
  assert.deepEqual(cut.map(m => m.type), ['other', 'ext', 'lane']); assert.equal(cut[1].text, 'V 1.0.7 nano 8');
  assert.deepEqual(P.feed(enc('200\n200\n\r')).map(m => m.ms), [200, 200]);
});
test('SlotForge box: the race binding is told when the box enters its safe state', () => {
  const subs = []; let safe = 0; const sent = [];
  const link = { connected: true, on: f => { subs.push(f); return () => {}; }, send: b => sent.push(b), setPower() {}, onStatus: () => () => {} };
  const b = AR.bind({ link, cars: () => [], crossCar() {}, blockCar() {}, unblockCar() {}, actions: {}, trackcall() {}, phase: () => 'running', lights: () => 0, flag: () => '', setup: {}, keepalive: false, onSafe: () => safe++ });
  subs.forEach(f => f({ type: 'safe', on: true })); assert.equal(safe, 1);
  subs.forEach(f => f({ type: 'safe', on: false })); assert.equal(safe, 1);
  if (b && b.off) b.off();
});
console.log(`HARDWARE AUDIT TESTS PASSED (${groups} groups)`);
