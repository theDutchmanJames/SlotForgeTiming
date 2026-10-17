const B = require('../renderer/arduinobox.js'), Sim = require('../renderer/arduinosim.js');
let fails = 0; const ok = (n, c) => { console.log((c ? 'ok   ' : 'FAIL ') + n); if (!c) fails++; };
function rig(cars) {
  let pc = 50000; const now = () => pc, rnd = (() => { let s = 11; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
  const sim = Sim.createSim({ now, cars, random: rnd }), link = B.createLink({ now }), out = [];
  sim.onData(b => link.feed(b)); link.on(e => out.push(e)); link.setConnected(true); link.setSender(b => sim.write(b));
  const step = (ms, keep = true) => { for (let i = 0; i < ms; i += 10) { pc += 10; if (keep && pc % 1000 === 0) sim.write(B.C.keepalive()); sim.tick(); } };
  return { sim, link, out, step, now };
}
{ // Trackmate mode: laps as letters with ticks, nothing bracketed until V
  const r = rig(); r.sim.start(); r.step(30000);
  const hits = r.out.filter(e => e.type === 'hit');
  ok('four cars lap in Trackmate mode (about 4-5 laps each in 30 s)', hits.length >= 14 && hits.length <= 24 && new Set(hits.map(h => h.lane)).size === 4);
  ok('no bracketed events before V', !r.out.some(e => ['pit', 'trap', 'version'].includes(e.type)) && !r.link.slotforge);
  const c0 = hits.filter(h => h.lane === 0), gaps = c0.slice(1).map((h, i) => h.at - c0[i].at);
  ok('lap times are about the car\'s lap time (5.8 s ± noise, pits apart)', gaps.filter(g => g < 9000).every(g => g > 5200 && g < 6500));
  r.sim.trackCall(); ok('the Track call button is a call', r.out[r.out.length - 1].type === 'call');
  r.sim.write(B.C.trackmateInit({ lanes: 2, closed: true, debounce: 1 })[0]); r.step(100); ok('the Trackmate A<n> command limits the lanes reported', r.sim.compatLanes === 2);
}
{ // SlotForge mode: version, pits, traps, readings, calibration, settings, save
  const r = rig(); r.sim.start(); r.step(500);
  r.sim.write(B.C.version()); r.step(50);
  ok('V answers with the version and switches the mode', r.link.slotforge && r.link.version.version === '1.0.0' && r.link.version.board === 'virtual');
  r.step(90000);
  ok('pit sensors report in and out', r.out.some(e => e.type === 'pit' && e.in) && r.out.some(e => e.type === 'pit' && !e.in));
  ok('every pass ends with a speed-trap figure', r.out.filter(e => e.type === 'trap').length >= 10 && r.out.filter(e => e.type === 'trap').every(t => t.ms >= 40 && t.ms <= 60));
  r.sim.write(B.C.readings(true)); r.step(600);
  ok('the readings stream gives a value per sensor pin', Object.keys(r.link.readings).length === 8 && r.out.some(e => e.type === 'reading'));
  r.sim.write(B.C.calibrate()); r.step(2200);
  ok('calibration sets arm and trigger from the empty level', r.out.filter(e => e.type === 'calibrated').length === 8 && r.link.pins[0].arm > r.link.pins[0].trig);
  r.sim.write(B.C.pinRole(7, 'K', 0, 0)); r.sim.write(B.C.option('lights', 2)); r.sim.write(B.C.thresholds(1, 650, 450)); r.sim.write(B.C.list()); r.step(50);
  ok('pin roles, options and thresholds are taken and listed back', r.link.pins[7].role === 'K' && r.link.options.lights[0] === 2 && r.link.pins[1].arm === 650 && r.link.pins[1].trig === 450);
  r.sim.write(B.C.save()); r.step(50); ok('W saves (the virtual box counts it)', r.sim.saved === 1 && r.out[r.out.length - 1].type === 'message');
  r.sim.write(B.C.lights('3')); r.sim.write(B.C.mainPower(true)); r.sim.write(B.C.lanePower(1, false)); r.sim.write(B.C.beep(2)); r.sim.write(B.C.lanePixel(0, '#00ff00')); r.step(50);
  ok('lights, power, lane power, beep and lane pixel reach the box', r.sim.lights === '3' && r.sim.mainPower === true && r.sim.lanePower[1] === false && r.sim.beeps.includes(2) && r.sim.pixels['1'] === '00ff00');
  r.sim.pressLaneButton(3); ok('a lane call button', r.out[r.out.length - 1].type === 'button' && r.out[r.out.length - 1].lane === 2);
  const acks = r.out.filter(e => e.type === 'ack').length; r.step(2000);
  ok('every keep-alive is answered in SlotForge mode', r.out.filter(e => e.type === 'ack').length >= acks + 2);
  r.sim.reboot(); const acks2 = r.out.filter(e => e.type === 'ack').length; r.step(2000);
  ok('after a reboot the box is silent on keep-alives (back in Trackmate mode) while laps still count', r.out.filter(e => e.type === 'ack').length === acks2 && !r.sim.slotforge);
}
{ // the keep-alive: the PC goes away, laps are buffered, the box comes back
  const r = rig([{ lane: 1, lapMs: 3000, noise: 0, coverMs: 45, pitEvery: 0, pitMs: 0 }]); r.sim.start();
  r.sim.write(B.C.version()); r.sim.write(B.C.mainPower(true)); r.step(1000);
  r.step(4000, false); // no keep-alives
  ok('no keep-alive for 3 s: the safe state, lights STOP, power cut', r.link.safe && r.sim.lights === 'S' && r.sim.mainPower === false && r.sim.beeps.includes(1));
  const before = r.out.filter(e => e.type === 'hit' && !e.buffered).length; r.step(9000, false);
  ok('laps while away are not sent as letters', r.out.filter(e => e.type === 'hit' && !e.buffered).length === before && r.sim.buffered.length >= 2);
  r.sim.write(B.C.keepalive()); r.step(50);
  ok('the first line from the PC ends the safe state and the buffered laps arrive as hits', !r.link.safe && r.out.filter(e => e.type === 'hit' && e.buffered).length >= 2 && r.sim.buffered.length === 0);
}
{ // asPort(): streams, as the page uses it
  (async () => {
    const sim = Sim.createSim({ cars: [{ lane: 1, lapMs: 800, noise: 0, coverMs: 40, pitEvery: 0, pitMs: 0 }] }), port = sim.asPort(5), L = B.createLink(), out = [];
    L.on(e => out.push(e)); L.setConnected(true);
    await port.open(); const w = port.writable.getWriter(), reader = port.readable.getReader(); L.setSender(b => w.write(b));
    await w.write(B.C.version());
    const t = Date.now(); while (Date.now() - t < 5000) { const { value } = await reader.read(); if (value) L.feed(value); if (out.some(e => e.type === 'hit') && out.some(e => e.type === 'trap')) break; }
    reader.releaseLock(); w.releaseLock(); await port.close();
    ok('through the port: the version, a lap and a trap arrive', L.slotforge && out.some(e => e.type === 'hit') && out.some(e => e.type === 'trap'));
    console.log(fails ? `${fails} FAILED` : 'all passed'); process.exit(fails ? 1 : 0);
  })();
}
