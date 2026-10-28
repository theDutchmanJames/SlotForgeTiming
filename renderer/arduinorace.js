// Connects a running race to the SlotForge box: crossings, pit sensors, the buttons and the speed trap come in; the start lights, the track power and the
// buzzer follow the race. Pure: it is given the race screen's functions and reads the phase back, so it can be tested with fakes. race.js calls
// ArduinoRace.bind(...) once a race opens, sync() whenever the phase, the lights or a flag change (update() is enough), power(on) where it switches the Trackmate relay, and off() on leaving.
//
// bind(o):
//   o.link       ArduinoBox.link (or a test link; it must have send())
//   o.cars       () => eng.cars (each with .lane 0..7, .retired, .dq, .blockAt)
//   o.crossCar(i, at), o.blockCar(i), o.unblockCar(i), o.actions ({ call(lane), yellow(), red() }), o.trackcall()   the race screen's own functions
//   o.phase      () => live.phase ('ready' | 'countdown' | 'running' | 'paused' | 'between' | 'finished' | 'review')
//   o.lights     () => live.lights (0..5 during the countdown)
//   o.flag       () => eng.flag ('' | 'yellow' | 'red')
//   o.setup      the race setup: startPower ('on' | 'off'), trackcall (the Trackmate choices), and the box fields below
//   o.onJump(lane, at)   optional: a crossing during the countdown (a jump start); without it the crossing is ignored
//   o.onTrap(lane, ms)   optional: the speed trap figure of a lane
// Race setup fields (optional): boxPit 'sensor' | 'button' | 'both' (what starts a pit stop; default both), boxLanePower 'off' | 'retired' (cut a lane's power when its car
// retires or is disqualified; default retired), boxBeeps true (countdown beeps and GO; default true), boxLaneLights true (status pixels in the lane colours; default false).
(function (root) {
  const B = typeof module !== 'undefined' ? require('./arduinobox.js') : root.ArduinoBox;
  const DEFAULTS = { boxPit: 'both', boxLanePower: 'retired', boxBeeps: true, boxLaneLights: false };
  const C = B.C;

  // the lights for a phase: '0'..'5' during the countdown (the app's own countdown, random lights-out included), G running, Y yellow, S red / paused / over
  function lightsFor(phase, lights, flag) {
    if (phase === 'countdown') return String(Math.max(0, Math.min(5, lights | 0)));
    if (phase === 'running') return flag === 'red' ? 'S' : flag === 'yellow' ? 'Y' : 'G';
    if (phase === 'paused') return 'S';
    if (phase === 'ready' || phase === 'between') return '0';
    return 'S'; // finished, review
  }

  function bind(o) {
    const L = o.link, setup = { ...DEFAULTS, ...(o.setup || {}) }, pitBySensor = setup.boxPit !== 'button';
    const carOf = lane => { const cars = o.cars() || []; return cars.findIndex(c => c && c.lane === lane); };
    let lastLights = null, lastCount = -1, lanePowerOff = new Set(), keep = null;
    const sync = () => {
      const phase = o.phase(), lights = o.lights ? o.lights() : 0, flag = o.flag();
      const want = lightsFor(phase, lights, flag); let sent = false;
      if (want !== lastLights) {
        L.send(C.lights(want)); sent = true;
        if (setup.boxBeeps !== false) { if (phase === 'countdown' && (lights | 0) > lastCount && (lights | 0) > 0) L.send(C.beep(1)); else if (want === 'G' && /^[1-5]$/.test(lastLights || '')) L.send(C.beep(3)); } // (GO sounds after a countdown, not when a flag is cleared)
        lastLights = want;
      }
      lastCount = phase === 'countdown' ? (lights | 0) : -1;
      if (setup.boxLanePower === 'retired') (o.cars() || []).forEach(c => { if (c && (c.retired || c.dq) && !lanePowerOff.has(c.lane)) { lanePowerOff.add(c.lane); L.send(C.lanePower(c.lane, false)); sent = true; } });
      return sent;
    };
    const off = L.on(e => {
      if (e.type === 'hit') {
        const phase = o.phase(); if (phase === 'countdown') { if (o.onJump) o.onJump(e.lane, e.at); return; }
        if (phase === 'ready') return; const i = carOf(e.lane); if (i >= 0) o.crossCar(i, e.at);
      } else if (e.type === 'pit') { if (!pitBySensor) return; const i = carOf(e.pit); if (i >= 0) (e.in ? o.blockCar : o.unblockCar)(i); } // pit sensor n belongs to lane n
      else if (e.type === 'call') { if (o.trackcall) o.trackcall(); }
      else if (e.type === 'button') { if (o.actions && o.actions.call) o.actions.call(e.lane); }
      else if (e.type === 'trap') { if (o.onTrap) o.onTrap(e.lane, e.ms); }
      else if (e.type === 'safe' && !e.on) { L.send(C.mainPower(wantPower)); L.setPower(wantPower); lastLights = null; sync(); } // the box is back from its safe state (it cut the track power when it lost us): tell it the lights and the track power again
    });
    // the keep-alive: every second while bound (the page sends one too while its tab is open; two are harmless)
    if (typeof setInterval === 'function' && o.keepalive !== false) keep = setInterval(() => L.send(C.keepalive()), B.KEEPALIVE_MS);
    L.send(C.readings(false)); // the live readings of the Arduino page cost serial time on the box: never during a race
    // the track power at the start, as the Trackmate setting says (on or off; race.js calls power(true) at lights out when it is its choice)
    let wantPower = setup.startPower !== 'off'; // the track power the race wants now (a box that comes back from its safe state is told)
    L.send(C.mainPower(wantPower));
    sync();
    return {
      sync,
      power: on => { wantPower = !!on; L.send(C.mainPower(wantPower)); L.setPower(wantPower); },
      lanePower: (lane, on) => { L.send(C.lanePower(lane, !!on)); if (on) lanePowerOff.delete(lane); else lanePowerOff.add(lane); },
      laneLight: (lane, hex) => { if (setup.boxLaneLights) L.send(C.lanePixel(lane, hex)); },
      beep: n => L.send(C.beep(n)),
      off: () => { off(); if (keep) clearInterval(keep); L.send(C.lights('S')); lanePowerOff.forEach(lane => L.send(C.lanePower(lane, true))); lanePowerOff.clear(); },
      lightsFor: () => lightsFor(o.phase(), o.lights ? o.lights() : 0, o.flag())
    };
  }
  const api = { DEFAULTS, lightsFor, bind };
  root.ArduinoRace = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
