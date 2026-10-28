// Checks the SlotForge box firmware by RUNNING it: node tools/fwhost/run.js [--strict]
// The sketch is compiled with g++ against a desktop stand-in for the Arduino (shim/, host.cpp: a simulated clock, a scripted ADC, the AVR's 64-byte serial buffer at 9600 baud,
// the two button interrupts, EEPROM), cars are played over the sensors, and what the box sends is read by the app's own parser (renderer/arduinobox.js).
// It checks the logic and the timing of the firmware. It does NOT replace compiling in the Arduino IDE or a test on a board (electrical behaviour, the AVR compiler, ADC crosstalk).
// "known" lines are problems that are written down but not fixed yet: they do not fail the run, unless you pass --strict. When one is fixed the line says so.
// Needs a desktop g++ (not on every machine: without it this prints SKIPPED and exits 0). Run it after every change in firmware/SlotForgeBox.
const { Scen, build, runBox, throughLink, os, path, fs } = require('./drive.js');
const strict = process.argv.includes('--strict');
let fails = 0, knownOpen = 0;
const ok = (name, cond, extra) => { console.log((cond ? 'ok   ' : 'FAIL ') + name + (extra ? '  (' + extra + ')' : '')); if (!cond) fails++; };
const known = (name, cond, extra) => { if (cond) console.log('ok   (was a known issue, now fixed) ' + name); else { console.log((strict ? 'FAIL ' : 'known ') + name + (extra ? '  (' + extra + ')' : '')); if (strict) fails++; else knownOpen++; } };
const info = t => console.log('     ' + t);

const dir = path.join(os.tmpdir(), 'sfb-fwhost-' + process.pid); fs.mkdirSync(dir, { recursive: true });
const nano = build('nano', dir);
if (!nano) { console.log('SKIPPED: no g++ on this machine (the firmware is not run). Install g++ (or build-essential / Xcode command line tools) to run this check.'); process.exit(0); }
const mega = build('mega', dir);

// ---- small helpers for the scripts ----
const track = (s, pins, level = 800) => { for (let p = 0; p < pins; p++) s.adc(0, p, level); };           // an empty track: every sensor reads `level`
const connect = (s, at = 3.0e6) => s.rx(at, 'V\n');                                                     // the app asks for SlotForge mode
const keepAlive = (s, from, until) => { for (let t = from; t < until; t += 1e6) s.rx(t, '!\n'); };         // the app's keep-alive, every second
const roles = (s, board, at) => { let t = at; const line = l => { s.rx(t, l + '\n'); t += 0.12e6; };         // lanes 1..n on A0.., pit sensors after them, as the app's page would set them
  if (board === 'mega') { for (let l = 0; l < 8; l++) line(`P${l} L${l + 1} 0`); for (let l = 0; l < 8; l++) line(`P${8 + l} P${l + 1} 0`); } else { for (let l = 0; l < 4; l++) line(`P${4 + l} P${l + 1} 0`); } return t; };
const hitsOf = (events, lane) => events.filter(e => e.type === 'hit' && e.lane === lane).map(e => e.at);
const maxLapError = (hits, truthUs) => { const n = Math.min(hits.length, truthUs.length); let w = 0; for (let i = 1; i < n; i++) w = Math.max(w, Math.abs((hits[i] - hits[i - 1]) - (truthUs[i] - truthUs[i - 1]) / 1000)); return w; };

// 1. four lanes, six laps each, different lap times and pass lengths
{
  const s = new Scen(); track(s, 8); s.adc(0, 4, 1023); connect(s); s.rx(3.1e6, '?\n'); keepAlive(s, 3.2e6, 40e6);
  const periods = [5.0e6, 5.5e6, 6.1e6, 6.7e6], truth = [[], [], [], []], dur = [30e3, 35e3, 40e3, 45e3];
  for (let L = 0; L < 4; L++) for (let n = 0; n < 6; n++) { const t = 4.0e6 + L * 0.37e6 + n * periods[L] + n * n * 13e3; truth[L].push(t); s.pass(t, L, dur[L]); }
  s.end(40e6); const { events } = throughLink(runBox(nano, s));
  for (let L = 0; L < 4; L++) { const h = hitsOf(events, L); ok(`four lanes: lane ${L + 1} counts all 6 laps, lap times within 10 ms of the truth (with 12 ms of USB jitter)`, h.length === 6 && maxLapError(h, truth[L]) <= 10, `${h.length} laps, worst error ${maxLapError(h, truth[L]).toFixed(1)} ms`); }
  const v = events.find(e => e.type === 'version'); ok('the box answers V with its version, board and pin count', !!v && /^\d+\.\d+\.\d+$/.test(v.version) && v.board === 'nano' && v.pins === 8, v && `${v.version} ${v.board} ${v.pins}`);
  ok('the box answers every keep-alive', events.filter(e => e.type === 'ack').length >= 30);
  const traps = events.filter(e => e.type === 'trap'), bias = traps.map(e => e.ms - dur[e.lane] / 1000), worst = Math.max(...bias.map(Math.abs));
  ok('every pass gives a speed-trap figure', traps.length === 24);
  known('the speed-trap figure is how long the car covered the sensor (not that plus the release time)', worst <= 3, `it reads ${Math.min(...bias).toFixed(0)} to ${Math.max(...bias).toFixed(0)} ms too long`);
}

// 2. the Start and Track call buttons pressed at odd moments while cars lap
{
  const s = new Scen(); track(s, 8); s.adc(0, 4, 1023); connect(s); keepAlive(s, 3.2e6, 40e6); const truth = [];
  for (let n = 0; n < 10; n++) { const t = 4.0e6 + n * 3.0e6; truth.push(t); s.pass(t, 0, 30e3); }
  for (let k = 0; k < 20; k++) s.btn(5.0e6 + k * 1.37e6 + k * 3100, k % 2 ? 3 : 2);
  s.end(36e6); const { events, msgs } = throughLink(runBox(nano, s)); const ticks = msgs.filter(m => m.type === 'tick').map(m => m.ms), h = hitsOf(events, 0);
  ok('buttons: all 20 presses arrive as the Track call', events.filter(e => e.type === 'call').length === 20);
  ok('buttons: no tick is ever larger than a second (a negative delta would print as 4294967295)', Math.max(...ticks) <= 1000, 'largest ' + Math.max(...ticks));
  ok('buttons: all 10 laps are still counted, within 10 ms', h.length === 10 && maxLapError(h, truth) <= 10);
}

// 3. the readings stream (the Arduino page) must never hold the sensors up, also with 16 sensors on a Mega
for (const [board, exe, nLanes, label] of [['nano', nano, 4, 'Nano with 8 sensors'], ['mega', mega, 8, 'Mega with 16 sensors']]) {
  const s = new Scen(); track(s, board === 'mega' ? 16 : 8); connect(s); const t0 = roles(s, board, 3.2e6); s.rx(t0, '?\n').rx(t0 + 0.12e6, 'Z1\n'); keepAlive(s, 5.0e6, 62e6);
  const truth = Array.from({ length: nLanes }, () => []);
  for (let L = 0; L < nLanes; L++) for (let n = 0; n < 9; n++) { const at = 8.0e6 + L * 0.31e6 + n * (5.0e6 + L * 0.2e6) + ((n * 7919 + L * 104729) % 1000) * 100; truth[L].push(at); s.pass(at, L, 12e3); }
  s.end(62e6); const { events } = throughLink(runBox(exe, s), { jitterMs: 1 }); let found = 0, err = 0;
  truth.forEach((tl, L) => { const h = hitsOf(events, L); found += h.length; err = Math.max(err, maxLapError(h, tl)); });
  ok(`readings stream on, ${label}: every 12 ms pass is counted (${nLanes * 9} of ${nLanes * 9}), lap times within 10 ms`, found === nLanes * 9 && err <= 10, `${found} found, worst error ${err.toFixed(1)} ms, ${events.filter(e => e.type === 'reading').length} readings`);
}

// 4. how short a pass can be and still be seen: Nano with 8 sensors, Mega with all 16 (every other lane/pit pin in use)
{
  const seen = (board, exe, passUs) => {
    const s = new Scen(); const nLane = board === 'mega' ? 8 : 4; track(s, board === 'mega' ? 16 : 8); connect(s); roles(s, board, 3.2e6); keepAlive(s, 5.0e6, 50e6); let n = 0;
    for (let L = 0; L < nLane; L++) for (let i = 0; i < 12; i++) { s.pass(8.0e6 + L * 0.31e6 + i * 3.0e6 + (((i * 7919 + L * 104729) % 997) * 311), L, passUs); n++; }
    s.end(50e6); return Math.round(100 * throughLink(runBox(exe, s), { jitterMs: 1 }).events.filter(e => e.type === 'hit').length / n);
  };
  const passes = [2e3, 3e3, 4e3, 6e3, 8e3, 15e3], row = (b, e) => passes.map(p => seen(b, e, p)), N = row('nano', nano), M = row('mega', mega);
  info('share of passes seen (%) by how long the car covers the sensor: ' + passes.map(p => p / 1000 + ' ms').join('  '));
  info('Nano, 8 sensors:  ' + N.join('  ')); info('Mega, 16 sensors: ' + M.join('  '));
  ok('Nano: every pass of 4 ms or longer is seen', N.slice(2).every(x => x === 100));
  ok('Mega with 16 sensors: every pass of 8 ms or longer is seen', M.slice(4).every(x => x === 100));
  known('Mega with 16 sensors: every pass of 4 ms or longer is seen', M.slice(2).every(x => x === 100), 'at 4 ms ' + M[2] + '%, at 6 ms ' + M[3] + '%');
}

// 5. the PC goes away: safe state after 3 s, laps buffered, delivered with their own times when the PC is back
{
  const s = new Scen(); track(s, 8); s.adc(0, 4, 1023); connect(s); for (let k = 0; k < 8; k++) s.rx(3.2e6 + k * 1e6, '!\n'); keepAlive(s, 16.0e6, 41e6);
  const truth = [12.0e6, 13.5e6, 14.4e6, 15.2e6, 17.0e6]; truth.forEach(t => s.pass(t, 0, 30e3)); s.end(30e6);
  const out = runBox(nano, s), { events } = throughLink(out, { jitterMs: 1 }), safe = events.filter(e => e.type === 'safe'), h = events.filter(e => e.type === 'hit' && e.lane === 0);
  ok('safe state: entered 3 s after the last keep-alive and left when the PC is back', safe.length === 2 && safe[0].on && Math.abs(safe[0].pcNow / 1000 - 13.2) < 0.15 && !safe[1].on && Math.abs(safe[1].pcNow / 1000 - 16.0) < 0.15);
  ok('safe state: the laps made while the PC was away arrive, marked as buffered, with their own times (within 5 ms)', h.length === 5 && h.filter(e => e.buffered).length === 3 && h.every((e, i) => Math.abs((e.at - h[0].at) - (truth[i] - truth[0]) / 1000) < 5));
  ok('safe state: the main relay (D4) is switched to its safe position', out.pins.some(p => p.pin === 4 && p.what === 'write' && p.t > 13.1e6 && p.t < 13.4e6 && p.v === 0));
}

// 6. settings kept in the EEPROM: a new box calibrates once; a saved box keeps its thresholds and is not blind after power-up
{
  const ee = path.join(dir, 'eeprom.bin'); try { fs.unlinkSync(ee); } catch (e) { /* none */ }
  const pin0 = events => { const o = events.filter(e => e.type === 'option' && e.key === 'pin' && Number(e.values[0]) === 0).pop(); return o ? o.values.map(Number) : []; };
  let s = new Scen(); track(s, 8, 800); s.adc(0, 4, 1023); connect(s); s.rx(3.1e6, '?\n').rx(3.6e6, 'W\n').end(5e6);
  let r = throughLink(runBox(nano, s, '', ee)); let p = pin0(r.events);
  ok('a new box calibrates itself once: lane 1 reads 800 empty, so arm 680 and trigger 480', p[4] === 680 && p[5] === 480, p.join(' '));
  s = new Scen(); track(s, 8, 800); s.adc(0, 4, 1023); s.pass(1.0e6, 0, 30e3).pass(4.0e6, 0, 30e3); connect(s); s.rx(3.1e6, '?\n').end(6e6);
  r = throughLink(runBox(nano, s, ee)); p = pin0(r.events);
  ok('a saved box keeps its thresholds over a power-up (no new calibration)', p[4] === 680 && p[5] === 480 && r.events.filter(e => e.type === 'calibrated').length === 0, p.join(' '));
  ok('...and sees a car 1 s after power-up (it is not blind while it calibrates)', r.events.filter(e => e.type === 'hit').length === 2);
  s = new Scen(); track(s, 8, 600); s.adc(0, 4, 1023); [1.0e6, 3.0e6, 5.0e6].forEach(t => s.pass(t, 0, 30e3, 600, 200)); connect(s); s.end(8e6);
  const o3 = runBox(nano, s, ee); r = throughLink(o3); const letters = o3.tx.filter(x => x[1] >= 65 && x[1] <= 72).length;
  known('saved thresholds and a lane whose empty level has fallen below the saved arm level (the light changed): a pass still ends and every lap counts', r.events.filter(e => e.type === 'hit').length === 3 && letters < 60, `${r.events.filter(e => e.type === 'hit').length} of 3 laps, ${letters} letters in 8 s: the lane stays covered`);
}

// 7. two cars close behind each other on one lane
{
  const s = new Scen(); track(s, 8); s.adc(0, 4, 1023); connect(s); keepAlive(s, 3.2e6, 25e6); s.pass(20.0e6, 1, 30e3).pass(20.42e6, 1, 30e3); s.end(24e6);
  const n = throughLink(runBox(nano, s), { jitterMs: 1 }).events.filter(e => e.type === 'hit' && e.lane === 1).length;
  known('two cars 0.42 s apart on one lane are two laps (the app counts a lane as free again after 500 ms without its letter, the box after 300 ms)', n === 2, n + ' lap');
}

// 8. a car stalls on a sensor (or the sensor is blocked): one lap when it arrived, a message after 3 s, and no further laps until the sensor is free again
{
  const run = (stallUs, tEnd) => { const s = new Scen(); track(s, 8); s.adc(0, 4, 1023); connect(s); keepAlive(s, 3.2e6, tEnd); s.pass(5.0e6, 0, stallUs).pass(5.0e6 + stallUs + 4e6, 0, 30e3); s.end(tEnd);
    const e = throughLink(runBox(nano, s), { jitterMs: 1 }).events; return { laps: e.filter(x => x.type === 'hit' && x.lane === 0).length, said: e.some(x => /blocked for 3 s/.test(JSON.stringify(x))) }; };
  const r = run(10e6, 24e6);
  ok('a car stalled on a sensor for 10 s: one lap on arrival, one when it has left and a car comes again (not one lap every 3.3 s)', r.laps === 2 && r.said, r.laps + ' laps' + (r.said ? '' : ', no "blocked" message'));
}

// 9. a car stands in the pits for longer than 3 s (a refuel): the PC hears when it arrives and when it LEAVES, so the stop is timed right and the next car is seen
{
  const run = stopS => { const s = new Scen(); track(s, 8); s.adc(0, 4, 1023); connect(s); s.rx(3.2e6, 'P4 P1 0\n'); keepAlive(s, 3.4e6, 60e6); s.pass(8e6, 4, stopS * 1e6).pass(30e6, 4, 1e6); s.end(60e6);
    return throughLink(runBox(nano, s), { jitterMs: 1 }).events.filter(e => e.type === 'pit'); };
  const p = run(8), outAt = p.filter(e => !e.in).map(e => e.at / 1000), inAt = p.filter(e => e.in).map(e => e.at / 1000);
  ok('a pit stop of 8 s (longer than the 3 s of a blocked lane sensor): in at 8 s and out at 16 s, and the next car is seen at 30 s', inAt.length === 2 && outAt.length === 2 && Math.abs(inAt[0] - 8) < 0.1 && Math.abs(outAt[0] - 16) < 0.2 && Math.abs(inAt[1] - 30) < 0.1, JSON.stringify({ inAt, outAt }));
  const long = new Scen(); track(long, 8); long.adc(0, 4, 1023); connect(long); long.rx(3.2e6, 'P4 P1 0\n'); keepAlive(long, 3.4e6, 150e6); long.pass(8e6, 4, 140e6); long.end(150e6);
  const q = throughLink(runBox(nano, long), { jitterMs: 1 }).events.filter(e => e.type === 'pit'), qOut = q.filter(e => !e.in);
  ok('a pit sensor that stays covered for 2 minutes is told as free again (the pit does not stay occupied for ever)', q.filter(e => e.in).length === 1 && qOut.length === 1 && Math.abs(qOut[0].at / 1000 - 128) < 1, JSON.stringify(q.map(e => [e.in, Math.round(e.at / 1000)])));
}

// 10. the box has been on for 49.7 days: millis() wraps, and the box goes on as before (no flood of ticks, no lap lost)
{
  const base = (4294967296 - 15000) * 1000; // 15 s before the wrap, in microseconds
  const wrapped = build('nano', dir, base);
  const T = t => base + t, s = new Scen(); track(s, 8); s.adc(T(0), 4, 1023); s.rx(T(3.0e6), 'V\n'); for (let t = 3.2e6; t < 80e6; t += 1e6) s.rx(T(t), '!\n');
  for (let n = 0; n < 20; n++) s.pass(T(5e6 + n * 3.0e6), 0, 30e3); s.end(T(80e6));
  const out = runBox(wrapped, s), { events, msgs } = throughLink(out, { jitterMs: 1 }), ticks = msgs.filter(m => m.type === 'tick'), hits = events.filter(e => e.type === 'hit' && e.lane === 0);
  const plain = new Scen(); track(plain, 8); plain.adc(0, 4, 1023); plain.rx(3.0e6, 'V\n'); for (let t = 3.2e6; t < 80e6; t += 1e6) plain.rx(t, '!\n'); for (let n = 0; n < 20; n++) plain.pass(5e6 + n * 3.0e6, 0, 30e3); plain.end(80e6);
  const before = runBox(nano, plain);
  ok('millis() wraps in the middle of a race: all 20 laps are counted, 3 s apart (within 10 ms)', hits.length === 20 && hits.every((h, i) => i === 0 || Math.abs((h.at - hits[i - 1].at) - 3000) < 10), hits.length + ' laps');
  ok('...and the ticks go on as they did before (the same number of bytes as without a wrap: no flood of "0" ticks)', out.tx.length < before.tx.length * 1.1, out.tx.length + ' bytes, ' + before.tx.length + ' without the wrap');
  ok('...no tick is larger than a second', ticks.every(t => t.ms <= 1000), 'largest ' + Math.max(...ticks.map(t => t.ms)));
}

// 11. laps buffered while the PC was away when the box clock is above 2^31 ms (24.8 days): the time is sent as a positive number (on the AVR a (long) cast of it would turn negative)
{
  const base = (2147483648 + 5000) * 1000; // just above 2^31 ms
  const high = build('nano', dir, base);
  const T = t => base + t, s = new Scen(); track(s, 8); s.adc(T(0), 4, 1023); s.rx(T(3.0e6), 'V\n'); for (let k = 0; k < 8; k++) s.rx(T(3.2e6 + k * 1e6), '!\n'); keepAlive(s, T(16.0e6), T(30e6));
  s.pass(T(14.0e6), 0, 30e3); s.end(T(25e6));
  const text = Buffer.from(runBox(high, s).tx.map(x => x[1])).toString('latin1');
  ok('a lap buffered while the PC was away, with the box clock above 2^31 ms: the box sends how long ago it was, as a positive number ([B1 2000]: 2 s before the PC came back; up to 1.0.4 the absolute box time, 2147502648)', text.includes('[B1 2000]') && !/\[B\d -/.test(text), (text.match(/\[B[^\]]*\]/g) || []).join(' '));
}

// 12. a board that does NOT reset when the port opens (a Mega with the auto-reset disabled, a Nano with a capacitor on RESET): its clock is already well along when the PC connects.
//     The laps buffered while the PC is away must still arrive with the right times. (The ticks carry deltas, so the PC's picture of the box clock starts at 0 at the connection; a buffered lap
//     sent as an absolute box time would then be mapped 500 s off.)
{
  const base = 500e6; // the box has been on for 500 s when the PC connects
  const late = build('nano', dir, base);
  const T = t => base + t, s = new Scen(); track(s, 8); s.adc(T(0), 4, 1023); connect(s, T(3.0e6)); for (let k = 0; k < 8; k++) s.rx(T(3.2e6 + k * 1e6), '!\n'); keepAlive(s, T(16.0e6), T(41e6));
  const truth = [12.0e6, 13.5e6, 14.4e6, 15.2e6, 17.0e6]; truth.forEach(t => s.pass(T(t), 0, 30e3)); s.end(T(30e6));
  const h = throughLink(runBox(late, s), { jitterMs: 1 }).events.filter(e => e.type === 'hit' && e.lane === 0);
  ok('a board that did not reset at the connection: the buffered laps still arrive with their own times (within 5 ms)', h.length === 5 && h.filter(e => e.buffered).length === 3 && h.every((e, i) => Math.abs((e.at - h[0].at) - (truth[i] - truth[0]) / 1000) < 5), h.map((e, i) => Math.round((e.at - h[0].at) - (truth[i] - truth[0]) / 1000) + ' ms off').join(', '));
}

console.log(fails ? `\n${fails} FAILED` : `\nall passed${knownOpen ? ` (${knownOpen} known issue${knownOpen > 1 ? 's' : ''} still open: run with --strict to fail on them)` : ''}`);
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) { /* the temp folder stays */ }
process.exit(fails ? 1 : 0);
