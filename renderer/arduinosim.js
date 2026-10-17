// A virtual SlotForge box, for working on the app without an Arduino. It behaves as the firmware does on the wire: Trackmate mode until V, then the
// bracketed events too; four imaginary cars that lap, cover the sensor for a while (letters repeat), use the pit sensors, and a settings table that
// answers ? and takes P/H/O/W. The keep-alive rule applies: no line from the PC for 3 s in SlotForge mode = safe state, laps buffered, sent on return.
// Pure apart from asPort(): the page drives it with tick(now) and write(bytes); what the box "sends" comes out of onData(cb).
(function (root) {
  const DEFAULT_CARS = [
    { lane: 1, lapMs: 5800, noise: 300, coverMs: 45, pitEvery: 11, pitMs: 4000 },
    { lane: 2, lapMs: 6100, noise: 350, coverMs: 50, pitEvery: 9, pitMs: 4500 },
    { lane: 3, lapMs: 5650, noise: 250, coverMs: 42, pitEvery: 14, pitMs: 3800 },
    { lane: 4, lapMs: 6400, noise: 500, coverMs: 55, pitEvery: 8, pitMs: 5000 }
  ];
  const text = s => Uint8Array.from(Array.from(s, c => c.charCodeAt(0)));

  function createSim(o = {}) {
    const clock = o.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now())), rnd = o.random || Math.random;
    const cars = (o.cars || DEFAULT_CARS).map(c => ({ ...c, nextCross: null, coveredUntil: 0, laps: 0, inPitUntil: 0, pitOn: false }));
    const pins = Array.from({ length: 8 }, (_, i) => ({ role: i < 4 ? 'L' : 'P', index: i < 4 ? i + 1 : i - 3, kind: 0, arm: 700, trig: 500, base: 820 + Math.round(rnd() * 100) }));
    const S = { cars, pins, slotforge: false, lights: 'S', mainPower: false, lanePower: Array(8).fill(true), pixels: {}, readings: false, blackout: 300, options: { lights: [1, 8, 64, 0], relay: [0, 0, 0], buzzer: [1], safeoff: [1], ladder: [0] }, saved: 0, beeps: [], away: false, buffered: [], running: false, log: [], compatLanes: 8, calibUntil: 0 };
    const subs = new Set(); let lastTick = clock(), lastLetters = 0, lastReadings = 0, lastFromPc = clock(), lineBuf = '';
    S.onData = f => { subs.add(f); return () => subs.delete(f); };
    const out = s => subs.forEach(f => f(text(s)));
    const tick = now => { out(String(Math.round(now - lastTick)) + '\n\r'); lastTick = now; };
    const ev = (now, s) => { if (S.slotforge) { tick(now); out('[' + s + ']'); } };
    const laneOf = l => pins.find(p => p.role === 'L' && p.index === l);
    S.start = () => { S.running = true; const now = clock(); cars.forEach(c => { c.nextCross = now + c.lapMs * (0.5 + rnd() * 0.5); }); };
    S.stop = () => { S.running = false; cars.forEach(c => { c.nextCross = null; }); };

    // ---- lines from the PC ----
    const handle = (line, now) => {
      lastFromPc = now;
      if (S.away) { S.away = false; ev(now, 'S-'); S.buffered.forEach(b => ev(now, `B${b.lane} ${b.at}`)); S.buffered = []; }
      const c = line[0], rest = line.slice(1).trim(); S.log.push(line);
      if (c === 'V') { S.slotforge = true; out('[V 1.0.0 virtual 8]'); }
      else if (c === 'G') { S.slotforge = false; S.readings = false; }
      else if (c === 'A') S.compatLanes = Math.max(1, Math.min(8, Number(rest) || 8));
      else if (c === 'L') S.lights = rest[0] || '0';
      else if (c === 'B') S.beeps.push(Number(rest));
      else if (c === 'M') S.mainPower = rest === '1';
      else if (c === 'E') S.mainPower = true; else if (c === 'R') S.mainPower = false;
      else if (c === 'Q') S.lanePower[Number(rest[0]) - 1] = rest[1] === '1';
      else if (c === 'N') { const [l, hex] = rest.split(/\s+/); S.pixels[l] = hex; }
      else if (c === 'X') { S.calibUntil = now + 2000; ev(now, 'E calibrating'); }
      else if (c === 'H') { const [pin, arm, trig] = rest.split(/\s+/).map(Number); if (pins[pin]) { pins[pin].arm = arm; pins[pin].trig = trig; } }
      else if (c === 'P') { const [pin, spec, kind] = rest.split(/\s+/); const p = pins[Number(pin)]; if (p) { p.role = spec[0]; p.index = Number(spec.slice(1)) || 0; p.kind = Number(kind) || 0; } }
      else if (c === 'O') { const [key, ...vals] = rest.split(/\s+/); const v = Number(vals[0]);
        if (key === 'blackout') S.blackout = v; else if (key === 'lights') S.options.lights[0] = v; else if (key === 'pixels') S.options.lights[1] = v; else if (key === 'bright') S.options.lights[2] = v; else if (key === 'lanepix') S.options.lights[3] = v;
        else if (key === 'relaync') S.options.relay[0] = v; else if (key === 'lanerelays') S.options.relay[1] = v; else if (key === 'lanerelaysnc') S.options.relay[2] = v; else if (key === 'buzzer') S.options.buzzer = [v]; else if (key === 'safeoff') S.options.safeoff = [v]; else if (key === 'ladder') S.options.ladder = [v]; }
      else if (c === 'W') { S.saved++; ev(now, 'E saved'); }
      else if (c === '?') { pins.forEach((p, i) => out(`[O pin ${i} ${['N', 'L', 'P', 'K'].indexOf(p.role)} ${p.index} ${p.kind} ${p.arm} ${p.trig}]`)); out(`[O blackout ${S.blackout}]`); out(`[O lights ${S.options.lights.join(' ')}]`); out(`[O relay ${S.options.relay.join(' ')}]`); out(`[O buzzer ${S.options.buzzer[0]}]`); out(`[O safeoff ${S.options.safeoff[0]}]`); out(`[O ladder ${S.options.ladder[0]}]`); }
      else if (c === 'Z') S.readings = rest === '1';
      else if (c === '!') { if (S.slotforge) out('[!]'); }
    };
    S.write = bytes => { Array.from(bytes).forEach(b => { const ch = String.fromCharCode(b); if (ch === '\n' || ch === '\r') { if (lineBuf) handle(lineBuf, clock()); lineBuf = ''; } else if (lineBuf.length < 64) lineBuf += ch; }); };

    // ---- the cars and the box live ----
    S.tick = () => {
      const now = clock();
      if (S.calibUntil && now >= S.calibUntil) { S.calibUntil = 0; pins.forEach((p, i) => { if (p.role === 'L' || p.role === 'P') { p.arm = Math.round(p.base * 0.85); p.trig = Math.round(p.base * 0.6); ev(now, `C${i} ${p.base} ${p.arm} ${p.trig}`); } }); }
      if (S.running) cars.forEach(c => {
        if (c.nextCross !== null && now >= c.nextCross) {
          c.laps++; c.coveredUntil = now + c.coverMs; const p = laneOf(c.lane);
          if (p && c.lane <= S.compatLanes) { if (S.away) S.buffered.push({ lane: c.lane, at: Math.round(now) }); else { tick(now); out(String.fromCharCode(64 + c.lane)); } }
          const pit = c.pitEvery && c.laps % c.pitEvery === 0;
          c.nextCross = now + c.lapMs + (rnd() - 0.5) * 2 * c.noise + (pit ? c.pitMs : 0);
          if (pit) { c.inPitUntil = now + 1500 + c.pitMs - 500; c.pitOn = false; c.pitInAt = now + 1500; }
        }
        if (c.pitInAt && now >= c.pitInAt && !c.pitOn) { c.pitOn = true; c.pitInAt = 0; ev(now, `P${c.lane}+`); }
        if (c.pitOn && now >= c.inPitUntil) { c.pitOn = false; ev(now, `P${c.lane}-`); }
        if (c.coveredUntil && now >= c.coveredUntil) { c.coveredUntil = 0; ev(now, `T${c.lane} ${c.coverMs}`); }
      });
      if (now - lastTick >= 200) tick(now);
      if (now - lastLetters >= 50) { cars.forEach(c => { if (c.coveredUntil && now < c.coveredUntil && !S.away && laneOf(c.lane)) out(String.fromCharCode(64 + c.lane)); }); lastLetters = now; }
      if (S.readings && S.slotforge && now - lastReadings >= 250) { pins.forEach((p, i) => { if (p.role === 'L' || p.role === 'P') { const car = cars.find(c => (p.role === 'L' ? c.lane === p.index && c.coveredUntil && now < c.coveredUntil : c.pitOn && c.lane === p.index)); out(`[Z${i} ${car ? Math.round(p.trig * 0.6) : p.base + Math.round((rnd() - 0.5) * 30)}]`); } }); lastReadings = now; }
      if (S.slotforge && !S.away && now - lastFromPc > 3000) { S.away = true; S.lights = 'S'; if (S.options.safeoff[0]) S.mainPower = false; S.beeps.push(1); ev(now, 'S+'); }
    };
    S.trackCall = () => { const now = clock(); tick(now); out('W'); };
    S.pressLaneButton = lane => ev(clock(), `K${lane}`);
    S.reboot = () => { S.slotforge = false; S.readings = false; S.lights = 'S'; S.away = false; S.buffered = []; }; // (a brown-out: back in Trackmate mode, settings from EEPROM)
    S.crossNow = lane => { const c = cars.find(x => x.lane === lane); if (c && c.nextCross !== null) c.nextCross = clock(); };

    // ---- as a Web Serial port ----
    S.asPort = (tickMs = 10) => {
      let ctrl = null, timer = null, off = null;
      const port = {
        virtual: true, getInfo: () => ({ usbVendorId: 0x1A86, usbProductId: 0x7523, virtual: true }),
        async open() {
          port.readable = new ReadableStream({ start(c) { ctrl = c; off = S.onData(b => { try { ctrl.enqueue(b); } catch (x) { /* closed */ } }); }, cancel() { if (off) off(); } });
          port.writable = new WritableStream({ write(chunk) { S.write(chunk); } });
          timer = setInterval(S.tick, tickMs); if (!S.running) S.start();
        },
        async close() { clearInterval(timer); timer = null; if (off) { off(); off = null; } try { if (ctrl) ctrl.close(); } catch (x) { /* already closed */ } ctrl = null; port.readable = null; port.writable = null; },
        async setSignals() {}, async getSignals() { return { clearToSend: true, dataSetReady: true, dataCarrierDetect: false, ringIndicator: false }; },
        readable: null, writable: null, sim: S
      };
      return port;
    };
    return S;
  }
  const api = { createSim, DEFAULT_CARS };
  root.ArduinoSim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
