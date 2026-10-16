// The race rules, kept free of any screen code so they can be tested on their own.
// Times are in milliseconds; the caller passes the current time `t` into every call.
(function (root) {
  const B = typeof module !== 'undefined' ? require('./bop.js') : root.Bop; // Balance of Power: percentages and the way they change the fuel rules of a car
  const W = typeof module !== 'undefined' ? require('./weather.js') : root.Wx; // Weather: the states, the tyres and what wrong tyres cost
  const En = typeof module !== 'undefined' ? require('./endurance.js') : root.Endurance; // Endurance Race: the swaps of drivers
  const Dm = typeof module !== 'undefined' ? require('./damage.js') : root.Damage; // Damage System: the levels of damage and the repair
  const MIN_LAP = 800; // crossings closer together than this are treated as double triggers

  function fmtTime(ms) {
    if (ms === null || ms === undefined || ms === '') return '–';
    const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000;
    return m ? m + ':' + s.toFixed(3).padStart(6, '0') : s.toFixed(3);
  }

  // Fuel and pit settings from a race setup (missing or empty values get their defaults).
  const num = (v, d) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
  // rule: the fuel rule chosen in the setup (none = no fuel). Without a rule the old inline setup fields (fuel: 'on', fuelTank...) still work.
  function fuelConfig(setup, rule) {
    const pitHold = num(setup.pitHold, 2) * 1000;
    if (rule) {
      return { on: true, tank: num(rule.tank, 120), perLap: num(rule.perLap, 2), rate: num(rule.rate, 10), target: num(rule.targetLap, 0) * 1000, extra: num(rule.maxExtra, 25) / 100, saving: Math.min(1, num(rule.maxSaving, 30) / 100),
        empty: ['retire', 'stop', 'warn'].includes(rule.empty) ? rule.empty : 'retire', pitHold };
    }
    const on = setup.fuel === 'on';
    return { on, tank: num(setup.fuelTank, 120), perLap: num(setup.fuelPerLap, 1), rate: num(setup.fuelRate, 10), target: 0, extra: 0, saving: 0,
      empty: ['retire', 'stop', 'warn'].includes(setup.fuelEmpty) ? setup.fuelEmpty : 'retire', pitHold };
  }
  // The yellow flag target lap time of a race setup: yellowTarget in seconds (0 or empty = none), yellowPoints = the penalty points for a full lap under yellow that is faster than the target
  // (they need a penalty system; without one the lap is only marked and called out). Gives { target: ms, points: whole number }.
  function yellowConfig(setup) {
    const s = setup || {}, target = Math.round(num(s.yellowTarget, 0) * 1000);
    return { target, points: target > 0 ? Math.floor(num(s.yellowPoints, 1)) : 0 };
  }
  // litres used by a lap of this length: perLap at the target time, more when faster, less when slower, within the limits
  const fuelUse = (F, lapMs) => {
    if (!F.target || !(lapMs > 0)) return F.perLap;
    const factor = Math.min(1 + (F.extra || 0), Math.max(1 - (F.saving || 0), F.target / lapMs));
    return Math.round(F.perLap * factor * 1e6) / 1e6;
  };

  // ---- penalties ----
  // system: a penalty system record (or nothing). Points turn into time by "every X points add Y seconds" or by a steps table.
  function penaltyConfig(system) {
    const s = system || {}, n = (v, d) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? d : Number(v));
    if (!system) return { on: false, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [], fuelPoints: 0 };
    // special penalties (Drivethrough, Stop-and-Go...): what they cost in points, how long to stand still, what leaving early and never serving add
    const types = (Array.isArray(s.types) ? s.types : []).filter(t => t && String(t.name || '').trim()).map(t => ({
      name: String(t.name).trim(), kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo', seconds: Math.max(0, n(t.seconds, 5)),
      cost: Math.max(0, Math.round(n(t.cost, 0))), extra: Math.max(0, Math.round(n(t.extra, 1))), unserved: Math.max(0, n(t.unserved, 10)) }));
    const steps = String(s.steps || '').split(',').map(x => x.split('=').map(y => Number(String(y).trim().replace(',', '.')))).filter(x => x.length === 2 && x.every(Number.isFinite) && x[0] > 0 && x[1] >= 0).sort((a, b) => a[0] - b[0]);
    return { on: true, mode: s.timeRule === 'steps' ? 'steps' : 'every', every: Math.max(1, n(s.everyPoints, 5)), seconds: Math.max(0, n(s.everySeconds, 5)), steps, dq: Math.max(0, n(s.dqPoints, 0)), types, fuelPoints: Math.max(0, Math.round(n(s.fuelPoints, 0))) };
  }
  const penaltyMs = (P, points) => {
    if (!P || !P.on || points <= 0) return 0;
    if (P.mode === 'steps') { let s = 0; P.steps.forEach(([p, sec]) => { if (points >= p) s = sec; }); return s * 1000; }
    return Math.floor(points / P.every) * P.seconds * 1000;
  };

  // lap times without the ones over the track's maximum lap time
  const goodLaps = c => c.laps.filter((_, n) => !(c.bad || [])[n] && !(c.invalid || []).includes(n));

  // cfg: { type: practice|qualifying|race|timed, laps, duration (minutes), endRule: all|leader, minLap, fuel: fuelConfig(...), entries: [...] }
  function createRace(cfg) {
    const skipFirst = !!cfg.skipFirst, type = cfg.type, minLap = cfg.minLap ?? MIN_LAP, maxLap = Number(cfg.maxLap) > 0 ? Number(cfg.maxLap) : 0;
    const P = { on: false, mode: 'every', every: 5, seconds: 5, steps: [], dq: 0, types: [], fuelPoints: 0, ...(cfg.penalty || {}) };
    const penOf = c => penaltyMs(P, c.points) + (c.extraMs || 0); // time penalty: from the points, plus any time the Race Director added
    // What the Race Director corrects in the review (R.adjust): race time (ms), laps and championship points, added to or taken off what the race gave. They are signed amounts, kept apart from the penalties.
    const addOf = c => penOf(c) + (c.adjMs || 0); // everything that is added to the time of the car: the penalty and the adjustment
    const lapsOf = c => c.laps.length + (c.adjLaps || 0) - (c.swapLost || 0); // the laps that count: the laps driven, plus or minus the adjustment, and not the laps of an Endurance Race that a swap that was refused took away
    const F = { on: false, tank: 0, perLap: 0, rate: 0, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...(cfg.fuel || {}) };
    // Balance of Power (cfg.bop, see bop.js): only in a race or a timed race that has fuel, because it works through the fuel rules. Every car has its own percentage (car.bop: negative = hindered, positive = helped).
    const BP = cfg.bop && F.on && (type === 'race' || type === 'timed') ? B.clean(cfg.bop) : null, ONE = { use: 1, rate: 1, tank: 1 };
    // Weather (cfg.weather, see weather.js): only in a race or a timed race. The tyres and the penalty points need no fuel; hurting a car on the wrong tyres (WXH) works through the fuel rules, like Balance of Power.
    const WXC = cfg.weather && (type === 'race' || type === 'timed') ? cfg.weather : null, WXH = WXC && F.on && WXC.hinder ? WXC : null;
    const hasFx = c => !!((BP && c.bop) || (WXH && c.wx));
    // what the car gets of the fuel rules now: from Balance of Power (car.bop) and from the weather (car.wx), both signed whole percentages (negative: hindered), added up lever by lever
    const fx = c => (!hasFx(c) ? ONE : WXH && c.wx ? B.mix([[BP && c.bop ? c.bop : 0, BP], [c.wx, WXH.levers]]) : B.factors(c.bop, BP));
    const tankOf = c => (hasFx(c) ? Math.round(F.tank * fx(c).tank * 1e6) / 1e6 : F.tank); // (rounded: 100 x 1.1 is not 110.00000000000001 on a screen)
    const Y = { target: 0, points: 0, ...(cfg.yellow || {}) }; // the yellow flag target lap time (ms; 0 = none) and the penalty points for a full lap under yellow that is faster
    // Endurance Race (cfg.endurance, see endurance.js): only in a race or a timed race. A car whose entry has a roster of two drivers or more swaps drivers; the state of its swaps is car.en.
    const EN = cfg.endurance && cfg.endurance.on && (type === 'race' || type === 'timed') ? { ...cfg.endurance } : null, enRnd = cfg.rnd || Math.random;
    // Damage System (cfg.damage, see damage.js): only in a race or a timed race. A car collects damage points (a hit by the Race Director, a deslot); the level they reach says how long it must stand in the pits.
    const DM = cfg.damage && cfg.damage.on && (type === 'race' || type === 'timed') ? cfg.damage : null;
    const lapLimit = type === 'race' ? Number(cfg.laps) || 0 : 0;
    const timeLimit = (type === 'timed' || type === 'qualifying') ? (Number(cfg.duration) || 0) * 60000 : 0;
    const R = {
      cfg, fuel: F, penalty: P, type, status: 'ready', t0: 0, pausedAt: 0, endAt: 0, timeUp: false, finished: 0, endedBy: '',
      yellow: Y, yellowAt: null, // yellowAt: when the yellow flag that is up now went up (a lap that started before that is not a lap under yellow)
      cars: cfg.entries.map(e => ({ ...e, laps: [], bad: [], points: 0, undoPoints: 0, dq: false, pending: [], served: [], extraMs: 0, adjMs: 0, adjLaps: 0, adjPoints: 0, invalid: [], removed: [], yellowFast: [], pitLaps: [], servedNow: false, last: 0, total: 0, best: null, done: false, place: 0, retired: false, fuel: F.on ? F.tank : 0, outOfFuel: false, bop: 0, bopHold: false, bopTo: null, tyreOwn: W.cleanTyre(e.tyre), tyre: W.cleanTyre(e.tyre), wx: 0, wxDue: null,
        blockAt: null, pit: null, pits: [], lastPit: null, outlap: false, started: !skipFirst, swapLost: 0, swapLaps: [], dmg: 0, dmgTotal: 0, dmgLvl: -1, dmgDue: null, dmgOut: '', repairs: [], repairMs: 0, repairedAt: null, en: EN && Array.isArray(e.roster) && e.roster.length >= 2 ? En.newCar(EN, e.roster, e.driverId) : null })),
      events: [], // what happened, in order: { type, car, t } (outoffuel, retired, pitstart, fuelfull, pitend, call, callend...)
      calls: [] // calls from a lane to the Race Director: { id, car, t, open, how }; how a call ended: 'penalty' or 'dismiss'
    };
    let callId = 0;
    const log = (type, i, t, data) => R.events.push({ type, car: i, t, ...data });

    const end = (t, why) => { R.cars.forEach((c, i) => { if (c.blockAt !== null) { pitCheck(i, t); serveCheck(i, t); repairCheck(i, t); closePit(i, t); } }); R.status = 'finished'; R.endAt = t; R.endedBy = why; R.flag = ''; R.yellowAt = null; R.calls.forEach(c => { c.open = false; }); enEnd(t, why); };
    const checkEnd = t => {
      if (R.status !== 'running') return;
      if (type === 'race' && cfg.endRule === 'leader' && R.finished > 0) return end(t, 'The lead car finished');
      const limited = lapLimit || timeLimit;
      if (limited && R.cars.every(c => c.done) && (type === 'race' || R.timeUp)) end(t, 'Every car finished');
    };

    R.elapsed = t => R.status === 'running' ? t - R.t0 : R.status === 'paused' ? R.pausedAt - R.t0 : R.status === 'finished' ? R.endAt - R.t0 : 0;
    R.start = t => { R.status = 'running'; R.t0 = t; R.cars.forEach(c => { c.last = t; if (F.on && hasFx(c)) c.fuel = tankOf(c); }); wxEval(t); }; // (a car that has Balance of Power before the start begins with a full tank of its own size)
    R.pause = t => { if (R.status === 'running') { R.status = 'paused'; R.pausedAt = t; } };
    R.resume = t => {
      if (R.status !== 'paused') return;
      const d = t - R.pausedAt; // the paused time does not count
      R.t0 += d; if (R.yellowAt !== null) R.yellowAt += d;
      R.cars.forEach(c => { // (what is tied to the moment the car stopped moves with it: the swap and the repair of this stop)
        const rep = c.blockAt !== null && c.repairedAt === c.blockAt, sw = c.blockAt !== null && c.enSwapAt === c.blockAt;
        c.last += d; if (c.blockAt !== null) c.blockAt += d; if (rep) c.repairedAt = c.blockAt; if (sw) { c.enSwapAt = c.blockAt; if (c.enSwapDoneAt !== undefined) c.enSwapDoneAt += d; } if (c.pit) c.pit.start += d;
      });
      R.status = 'running';
      if (R.flag === 'red') R.flag = ''; // resuming also clears a red flag
    };
    // Yellow: only a caution, timing carries on. Red: pauses the race until it is cleared or the race is resumed.
    // Pressing the same flag again clears it.
    R.flag = '';
    R.setFlag = (kind, t) => {
      if (R.status === 'finished' || R.status === 'ready') return;
      if (kind === 'red') {
        if (R.flag === 'red') { R.flag = ''; R.resume(t); } else { R.flag = 'red'; R.yellowAt = null; R.pause(t); }
      } else if (kind === 'yellow' && R.flag !== 'red') { if (R.flag === 'yellow') { R.flag = ''; R.yellowAt = null; } else { R.flag = 'yellow'; R.yellowAt = t; } }
    };
    // A call from the lane of car i (a marshal call button): the yellow flag goes up, unless a flag is already up (a yellow is never switched off by a call), and the call waits for the
    // Race Director. A lane that calls again while its call is still waiting does not make a second call. Returns the call, or null when the race is not running.
    R.call = (i, t) => {
      if (!R.cars[i] || !['running', 'paused'].includes(R.status)) return null;
      if (R.flag === '') { R.flag = 'yellow'; R.yellowAt = t; }
      let c = R.calls.find(x => x.open && x.car === i);
      if (!c) { c = { id: ++callId, car: i, t, open: true, how: '' }; R.calls.push(c); log('call', i, t, { id: c.id }); }
      return c;
    };
    // The Race Director decides: how = 'penalty' (one penalty point for that car; only with a penalty system) or 'dismiss'. A call that cannot be settled stays waiting.
    R.resolveCall = (id, how, t) => {
      const c = R.calls.find(x => x.id === id && x.open);
      if (!c || !['penalty', 'dismiss'].includes(how) || (how === 'penalty' && !R.addPoints(c.car, 1, t))) return false;
      c.open = false; c.how = how; log('callend', c.car, t, { id, how });
      return true;
    };
    // running time of the current lap for car i
    R.lapElapsed = (i, t) => R.status === 'running' ? t - R.cars[i].last : R.status === 'paused' ? R.pausedAt - R.cars[i].last : 0;
    R.stop = t => { if (R.status === 'running' || R.status === 'paused') end(t, 'Stopped'); };
    R.tick = t => {
      if (R.status === 'running') R.cars.forEach((_, i) => { pitCheck(i, t); serveCheck(i, t); enEval(i, t); repairCheck(i, t); });
      if (R.status === 'running' && timeLimit && !R.timeUp && t - R.t0 >= timeLimit) R.timeUp = true;
      wxEval(t);
      checkEnd(t);
    };
    // After the time is up, each car finishes on its next crossing, and that lap still counts.
    R.cross = (i, t) => {
      if (R.status !== 'running') return false;
      const c = R.cars[i];
      if (!c || c.done) return false;
      if (!c.started) { c.started = true; c.last = t; return false; } // the car starts just behind the line: its first crossing only starts the timing
      const dt = t - c.last, lapStart = c.last;
      if (dt < minLap) return false;
      R.tick(t);
      const use = fx(c).use, need = F.on ? (use === 1 ? fuelUse(F, dt) : Math.round(fuelUse(F, dt) * use * 1e6) / 1e6) : 0; // litres this lap took (a car with Balance of Power uses more or less)
      const fuelShort = F.on && c.fuel < need - 1e-9; // the tank did not hold enough for this lap
      if (fuelShort) { // not enough fuel to have driven this lap
        if (!c.outOfFuel) { c.outOfFuel = true; log('outoffuel', R.cars.indexOf(c), t); }
        if (F.empty === 'retire') { c.done = true; c.retired = true; log('retired', R.cars.indexOf(c), t); checkEnd(t); return false; }
        if (F.empty === 'stop') return false; // the lap does not count until the car has refuelled
      }
      if (F.on) c.fuel = Math.max(0, Math.round((c.fuel - need) * 1e6) / 1e6);
      const pitLap = c.outlap; c.outlap = false; // (the lap in which the car stood in the pits)
      const wasResumed = !!c.resumed, slow = (maxLap > 0 && dt > maxLap) || wasResumed; c.resumed = false; // too slow to be a real lap time: it counts as a lap, but is left out of best laps and averages
      if (fuelShort && F.empty === 'warn' && P.fuelPoints > 0) R.addPoints(R.cars.indexOf(c), P.fuelPoints, t); // a car that carries on with an empty tank gets the points of the penalty system for every such lap
      if (pitLap) c.pitLaps.push(c.laps.length);
      const deslot = DM && DM.deslotMs > 0 && dt > DM.deslotMs && !pitLap && !wasResumed && !c.dmgOut; // (a lap with a stop in the pits, or the first lap after a resume, is slow for other reasons)
      c.laps.push(dt); c.bad.push(slow); c.last = t; c.total = t - R.t0;
      if (c.en && c.en.lost) { c.swapLost++; c.swapLaps.push(c.laps.length - 1); } // a swap that was refused: this lap is driven, but it does not count
      if (!slow && (c.best === null || dt < c.best)) c.best = dt;
      // the yellow flag target: a lap that began after the yellow flag went up, and ended with it still up, must not be faster than the target (a lap that was part green does not count)
      if (Y.target > 0 && R.flag === 'yellow' && R.yellowAt !== null && lapStart >= R.yellowAt && dt < Y.target) {
        const i = R.cars.indexOf(c), e = { type: 'yellowfast', car: i, t, lap: c.laps.length, ms: dt, target: Y.target, points: 0 }; // (logged before the penalty, so it is called out first)
        c.yellowFast.push(c.laps.length - 1); R.events.push(e);
        if (Y.points > 0 && R.addPoints(i, Y.points, t)) e.points = Y.points;
      }
      if (!c.dq && ((lapLimit && c.laps.length - c.swapLost >= lapLimit) || (timeLimit && R.timeUp))) { c.done = true; c.place = ++R.finished; } // a car disqualified on this lap (fuel points) has not finished
      if (DM) damageLap(c, R.cars.indexOf(c), t, deslot);
      wxEval(t); if (!wxEntering) wxDueCheck(c, i, t); // (a car that comes into the pits on this crossing is judged by its stop, or by its next crossing)
      enEval(R.cars.indexOf(c), t); // (the laps of a stint are counted: a swap that is due by laps, or a swap by the sensor, may come with this crossing)
      bopEval(t);
      checkEnd(t);
      return true;
    };

    // A new stint on a lane (time tokens): the car of this lane starts again with nothing driven (and, when given, for another driver). Its first crossing only starts the timing.
    // The car object stays the same one, so everything that points to it keeps working.
    R.restartCar = (i, t, who) => {
      const c = R.cars[i]; if (!c) return false;
      Object.assign(c, who || {}, { laps: [], bad: [], points: 0, undoPoints: 0, dq: false, pending: [], served: [], extraMs: 0, adjMs: 0, adjLaps: 0, adjPoints: 0, invalid: [], removed: [], yellowFast: [], pitLaps: [], servedNow: false, last: t, total: 0, best: null, done: false, place: 0, retired: false,
        fuel: F.on ? F.tank : 0, outOfFuel: false, blockAt: null, pit: null, pits: [], lastPit: null, outlap: false, started: false });
      return true;
    };

    // ---- pit stops ----
    // A car stopping on the sensor breaks the beam: that counts as a normal crossing. Once the sensor has been
    // blocked for pitHold, the pit stop starts (refuelling begins). The stop lasts until the car leaves.
    function pitCheck(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null || c.pit || t - c.blockAt < F.pitHold) return;
      const tyres = wxTyres(c); // (the tyres are changed when the stop starts)
      c.pit = { start: c.blockAt + F.pitHold, fuel0: c.fuel, full: false, ...(hasFx(c) ? { rate: F.rate * fx(c).rate, tank: tankOf(c) } : {}) }; // (the refuelling speed and the tank of a car with Balance of Power are fixed for the whole stop)
      log('pitstart', i, c.pit.start);
      if (tyres) log('tyres', i, c.pit.start, tyres);
    }
    function fuelAt(i, t) {
      const c = R.cars[i];
      if (!F.on) return null;
      if (!c.pit) return c.fuel;
      const te = R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t;
      return Math.min(c.pit.tank ?? F.tank, c.pit.fuel0 + (c.pit.rate ?? F.rate) * Math.max(0, te - c.pit.start) / 1000);
    }
    function closePit(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null) return;
      if (c.pit) {
        const fuel = fuelAt(i, t), got = F.on ? fuel - c.pit.fuel0 : 0;
        if (F.on) { c.fuel = fuel; if (c.fuel >= F.perLap * (1 - (F.saving || 0)) * fx(c).use - 1e-9) c.outOfFuel = false; }
        c.lastPit = { at: c.blockAt, duration: t - c.blockAt, refuelled: Math.round(got * 1000) / 1000 };
        c.pits.push(c.lastPit); c.outlap = true;
        log('pitend', i, t, { duration: c.lastPit.duration, refuelled: c.lastPit.refuelled });
      }
      c.blockAt = null; c.pit = null;
    }
    R.fuelOf = fuelAt;
    R.factorsOf = i => (R.cars[i] ? fx(R.cars[i]) : ONE); // how much more or less fuel car i uses, how much slower or faster it refuels, and how big its tank is (Balance of Power and the weather together)
    R.tankOf = i => (R.cars[i] ? tankOf(R.cars[i]) : F.tank); // the size of the tank of car i (smaller or bigger with Balance of Power)

    // ---- Balance of Power ----
    R.bop = BP; // the settings (or null: this race has no Balance of Power)
    R.bopActive = false; R.bopSpread = 0; // at the last look: was the difference between the fastest and slowest car big enough, and how big (seconds)
    // Give car i a percentage (negative: hindered, positive: helped, 0: none). It counts from the next lap and the next pit stop. Every change is in the race log.
    R.bopSet = (i, pct, t, by) => {
      const c = R.cars[i]; if (!BP || !c || R.status === 'finished') return false;
      const n = Math.round(Math.max(-B.MAXP, Math.min(B.MAXP, Number(pct) || 0))), was = c.bop || 0;
      if (n === was) return false;
      c.bop = n === 0 ? 0 : n;
      if (F.on && !c.pit) c.fuel = Math.min(c.fuel, tankOf(c)); // a tank that gets smaller keeps only what fits
      log(!was ? 'bopon' : !n ? 'bopoff' : 'bopchange', i, t || 0, { pct: c.bop, lap: c.laps.length, by: by || 'director', ...(was && n ? { was } : {}) });
      return true;
    };
    // What the Race Director presses for a lane: hinder, help, off (these stay until he says auto), auto (the system decides again), accept (take over the suggestion)
    R.bopPress = (i, how, t) => {
      const c = R.cars[i]; if (!BP || !c) return false;
      if (how === 'hinder' || how === 'help' || how === 'off') { c.bopHold = true; return R.bopSet(i, how === 'off' ? 0 : how === 'hinder' ? -BP.percent : BP.percent, t, 'director'); }
      if (how === 'auto') { c.bopHold = false; return BP.mode === 'auto' && typeof c.bopTo === 'number' ? R.bopSet(i, c.bopTo, t, 'auto') : false; }
      if (how === 'accept') return typeof c.bopTo === 'number' && R.bopSet(i, c.bopTo, t, 'accepted');
      return false;
    };
    // After every lap: the pace of every car still racing, who should get how much (suggested, or applied in automatic mode). Not under a flag, and not before two cars have enough laps.
    function bopEval(t) {
      if (!BP || BP.mode === 'manual' || R.status !== 'running' || R.flag) return;
      const paces = R.cars.map(c => (c.done || c.retired || c.dq ? null : B.paceOf(c, BP, (BP.laneFactors || [])[c.lane]))), p = B.plan(paces, BP, R.bopActive);
      R.bopActive = p.active; R.bopSpread = p.spread;
      R.cars.forEach((c, i) => {
        if (paces[i] === null) { c.bopTo = null; return; } // (a car that has no pace yet, or has finished, gets no suggestion)
        c.bopTo = p.pct[i];
        if (BP.mode === 'auto' && !c.bopHold) R.bopSet(i, p.pct[i], t, 'auto');
      });
    }
    R.bopNoteOf = i => B.noteOf(B.periodsOf(R.events, i)); // what BoP did to car i in this race, in words (empty when nothing)
    // ---- Weather ----
    R.weather = WXC; // the settings (or null: this race has no weather)
    let wxEntering = false; // true while a car that stopped on the sensor is counted as having crossed
    R.wxState = 'dry'; R.wxStage = 0; // the weather now, and how many of the states of the forecast have begun
    R.wxPlan = WXC ? W.plan(WXC, WXC.seed) : null; // the forecast: { unit, director, stages: [{ state, at }] }
    const leaderLaps = () => R.cars.reduce((m, c) => Math.max(m, c.laps.length), 0);
    // The forecast: a state begins when the leader has completed its laps, or when its time has gone (when the Race Director decides, nothing happens by itself)
    function wxEval(t) {
      if (!WXC || R.status !== 'running' || !R.wxPlan || R.wxPlan.director) return;
      const x = R.wxPlan.unit === 'laps' ? leaderLaps() : t - R.t0, st = R.wxPlan.stages;
      while (R.wxStage < st.length && x >= st[R.wxStage].at) R.wxSet(st[R.wxStage++].state, t, 'forecast');
    }
    // The weather becomes state ('dry' | 'cloudy' | 'wet' | 'clearing'). Cars that have to change tyres now get the reaction time (the laps they have to pit in); the cars are hindered, or not, for their tyres.
    R.wxSet = (state, t, by) => {
      if (!WXC || !W.STATES.some(s => s[0] === state) || state === R.wxState || R.status === 'finished') return false;
      const was = R.wxState; R.wxState = state;
      R.events.push({ type: 'weather', car: -1, t: t || 0, state, was, lap: leaderLaps(), at: R.status === 'ready' ? 0 : (t || 0) - R.t0, by: by || 'director' });
      R.cars.forEach(c => { c.wxDue = null; const k = W.need(state, c.tyre, c.tyreOwn); if (k) c.wxDue = { kind: k, lap: c.laps.length + WXC.react }; wxRefresh(c); });
      return true;
    };
    // the percentage the weather takes from a car on its tyres (negative: hindered); a tank that gets smaller keeps only what fits
    function wxRefresh(c) {
      if (!WXH) return;
      const pct = -W.hinderOf(WXH, R.wxState, c.tyre);
      if (pct === (c.wx || 0)) return;
      c.wx = pct === 0 ? 0 : pct;
      if (F.on && !c.pit) c.fuel = Math.min(c.fuel, tankOf(c));
    }
    // A pit stop starts: the car gets the tyres the weather asks for. (A stop is the only way to change tyres.)
    function wxTyres(c) { // (gives what the log says when the tyres changed, so that it comes after the pit stop in the log)
      if (!WXC) return null;
      const to = W.tyreFor(WXC, R.wxState, c.tyreOwn); let said = null;
      if (to !== c.tyre) { const was = c.tyre; c.tyre = to; said = { tyre: to, was, state: R.wxState, lap: c.laps.length }; }
      if (c.wxDue && !W.need(R.wxState, c.tyre, c.tyreOwn)) c.wxDue = null;
      wxRefresh(c);
      return said;
    }
    // After the reaction time a car that is still on the wrong tyres gets the penalty points (once, or every lap), and it is logged even when there are no points
    function wxDueCheck(c, i, t) {
      const d = c.wxDue; if (!WXC || !d || c.laps.length < d.lap) return;
      if (!W.need(R.wxState, c.tyre, c.tyreOwn)) { c.wxDue = null; return; }
      const pts = d.kind === 'wet' ? WXC.wetPoints : WXC.dryPoints, added = pts > 0 && R.addPoints(i, pts, t, 'tyres');
      log('tyredue', i, t, { kind: d.kind, points: added ? pts : 0, lap: c.laps.length, tyre: c.tyre });
      if (WXC.repeat === 'every') d.lap = c.laps.length + 1; else c.wxDue = null;
    }
    // what a screen needs to know of car i: its tyre, its own tyre, whether it should change tyres now ('wet' | 'dry' | ''), how many percent the weather hinders it
    R.wxOf = i => { const c = R.cars[i]; return c ? { tyre: c.tyre, own: c.tyreOwn, need: WXC ? W.need(R.wxState, c.tyre, c.tyreOwn) : '', hinder: -(c.wx || 0) } : null; };
    R.tyreNoteOf = i => W.noteOf(R.events, i); // what the tyres did to car i in this race, in words (empty when nothing)
    R.weatherNote = () => (WXC ? W.forecastNote(R.events, WXC.unit) : ''); // what the weather did in this race, in words
    // ---- penalty points ----
    R.penMs = penOf;
    // Adds (or with a negative n takes back) penalty points. Reaching the disqualify limit puts the car out of the race.
    R.addPoints = (i, n, t, why) => {
      const c = R.cars[i];
      if (!P.on || !c || R.status === 'ready' || !Number.isFinite(n) || n === 0) return false;
      const before = c.points;
      c.points = Math.max(0, c.points + n);
      if (c.points === before) return false;
      log('penalty', i, t, { delta: c.points - before, points: c.points, ms: penaltyMs(P, c.points), ...(why ? { why } : {}) });
      if (P.dq && c.points >= P.dq && !c.dq) {
        c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, t); checkEnd(t);
      } else if (c.dq && !c.dmgOut && (!P.dq || c.points < P.dq) && R.status !== 'finished') { // a mistaken point can still be taken back (not for a car that damage put out: that is for the damage points)
        c.dq = false; c.done = !!c.dqWasDone; c.retired = !!c.dqWasRetired; log('reinstated', i, t);
      }
      return true;
    };
    R.goodLaps = goodLaps;
    // the car stops over the sensor
    R.block = (i, t) => {
      if (R.status !== 'running') return false;
      const c = R.cars[i];
      if (!c || c.done || c.blockAt !== null) return false;
      wxEntering = true; R.cross(i, t); wxEntering = false;
      if (c.done) return true;
      c.blockAt = t; c.pit = null; c.servedNow = false;
      return true;
    };
    // the car leaves; a block shorter than pitHold is no pit stop
    R.unblock = (i, t) => {
      const c = R.cars[i];
      if (!c || c.blockAt === null) return false;
      if (R.status === 'running') { pitCheck(i, t); serveCheck(i, t); enSensor(i, t); repairCheck(i, t); }
      if (c.pending.length && !c.servedNow && R.status === 'running') { // left before the penalty was served
        const p = c.pending[0]; log('leftearly', i, t, { name: p.name, extra: p.extra }); if (p.extra) R.addPoints(i, p.extra, t);
      }
      if (DM && R.status === 'running' && c.pit && !c.dmgOut && c.repairedAt !== c.blockAt && Dm.levelOf(DM, c.dmg)) { // left before the repair was done (a stop that was no pit stop is not counted)
        const lv = Dm.levelOf(DM, c.dmg); log('repairearly', i, t, { name: lv.name, points: c.dmg, extra: DM.earlyPoints }); if (DM.earlyPoints > 0) R.addPoints(i, DM.earlyPoints, t, 'damage');
      }
      closePit(i, t);
      return true;
    };
    // ---- Endurance Race: the swaps of drivers ----
    // A car with a roster of two drivers or more has a state (car.en, see endurance.js): who is at the wheel, the stints, when the swap is due. The swap is made when the car stands on the sensor long enough
    // (the Stop-and-Go way) or when the Race Director presses Swap done; the driver at the wheel is then another one, in the car (driverId, driverName, nickname... are his), and the log says so.
    R.endurance = EN;
    const enBusy = i => new Set(R.cars.filter((o, j) => j !== i && o.driverId && !o.done).map(o => o.driverId)); // (drivers who are at the wheel of another car now)
    const enClock = t => (R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t) - R.t0;
    const enName = (c, id) => { const r = (c.roster || []).find(x => x.id === id); return r ? r.name || '' : ''; };
    const enWheel = (c, id) => { const r = (c.roster || []).find(x => x.id === id); if (r) Object.assign(c, { driverId: r.id, driverName: r.name || '', nickname: r.nickname || '', callsign: r.callsign || '', flag: r.flag || '', avatar: r.avatar || '' }); };
    // the swap is made (by: 'sensor' or 'button'); gives the result of Endurance.swap, or null when it can not be made
    function enSwap(i, t, by, to) {
      const c = R.cars[i], el = enClock(t), laps = c.laps.length;
      const was = c.driverId, wasName = c.driverName, res = En.swap(EN, c.en, { el, laps, to, by, roster: c.roster, busy: enBusy(i), rnd: enRnd });
      if (!res.ok) return null;
      enWheel(c, res.to);
      if (c.blockAt !== null) { c.enSwapAt = c.blockAt; c.enSwapDoneAt = t; } // (one swap in a stop; the repair of damage can wait for it)
      log('swapdone', i, t, { from: was, fromName: wasName, to: res.to, toName: enName(c, res.to), by, early: res.early, over: res.over, stintMs: res.stintMs, stintLaps: res.stintLaps, lap: laps });
      if (res.early && EN.early === 'penalty') R.addPoints(i, EN.penalty, t, 'swap');
      En.plan(EN, c.en, c.roster, enBusy(i), el, laps, enRnd);
      return res;
    }
    // the sensor: the car stands still for the swap time, and a swap is wanted (it is due; in a free swap also when the shortest stint is over)
    function enSensor(i, t) {
      const c = R.cars[i];
      if (!c.en || EN.confirm === 'button' || c.blockAt === null || c.done || c.enSwapAt === c.blockAt || t - c.blockAt < EN.seconds * 1000) return; // (the caller looks at a race that is running)
      const l = En.look(EN, c.en, enClock(t), c.laps.length);
      if (l.due || (EN.mode === 'free' && l.allowed)) enSwap(i, t, 'sensor');
    }
    // every look at a car: the swap that is due (once), the penalty for a swap that is refused, the laps that stop counting, who is next, and the sensor
    function enEval(i, t) {
      const c = R.cars[i];
      if (!c.en || c.done || R.status !== 'running') return;
      const el = enClock(t), laps = c.laps.length, res = En.step(EN, c.en, el, laps);
      En.plan(EN, c.en, c.roster, enBusy(i), el, laps, enRnd);
      res.events.forEach(e => {
        const base = { driver: c.driverId, driverName: c.driverName, next: c.en.nextId, nextName: enName(c, c.en.nextId) };
        if (e.type === 'soon') log('swapsoon', i, t, base);
        else if (e.type === 'due') log('swapdue', i, t, { ...base, why: e.why });
        else if (e.type === 'late') {
          const pts = EN.penalty * e.n, added = R.addPoints(i, pts, t, 'swaplate'); // (no points, or no penalty system: nothing is added)
          log('swaplate', i, t, { ...base, n: e.n, total: e.total, points: added ? pts : 0, stop: EN.late === 'stop' });
        }
      });
      enSensor(i, t);
    }
    // The Race Director says the swap is made (the button). to: the driver who steps in (else the one that was picked, or the one in turn). Not when the setup wants the sensor.
    R.swap = (i, t, to) => {
      const c = R.cars[i];
      if (!c || !c.en || c.done || (R.status !== 'running' && R.status !== 'paused') || EN.confirm === 'sensor') return null;
      return enSwap(i, t, 'button', EN.next === 'chosen' ? to : undefined);
    };
    // The Race Director picks who steps in next (only when the setup lets him choose). Gives true when it was taken.
    R.swapNext = (i, id) => {
      const c = R.cars[i];
      if (!c || !c.en || EN.next !== 'chosen' || c.done || R.status === 'finished') return false;
      const ok = En.pick(EN, c.en, c.roster, id, enBusy(i));
      if (ok) log('swappick', i, 0, { to: id, toName: enName(c, id) });
      return ok;
    };
    // The race is over: every stint at the wheel ends where its car finished (or where the race was stopped), and a driver who drove less than the shortest total is told (and gets his penalty points)
    function enEnd(t, why) {
      R.cars.forEach((c, i) => {
        if (!c.en) return;
        const el = c.done && c.laps.length ? c.total : t - R.t0;
        En.close(EN, c.en, el, c.laps.length);
        if (why === 'Stopped') return; // a race that was stopped early: nobody can be short
        En.short(EN, c.en, c.roster, el, c.laps.length).forEach(x => {
          const pts = EN.minPenalty, added = R.addPoints(i, pts, t, 'swap');
          log('swapshort', i, t, { driver: x.id, driverName: enName(c, x.id), ms: x.ms, laps: x.laps, points: added ? pts : 0 });
        });
      });
    }
    // What a screen needs to show of the swaps of car i: the look at the stint ({ state, left, why, allowed, ... }), who is at the wheel and next, and the totals and stints. Null for a car that does not swap.
    R.enLook = (i, t) => {
      const c = R.cars[i]; if (!EN || !c || !c.en) return null;
      const el = R.status === 'ready' ? 0 : enClock(t), laps = c.laps.length, standing = c.blockAt !== null && R.status === 'running' ? Math.max(0, EN.seconds * 1000 - (t - c.blockAt)) : null; // (standing: how long the car has to stand still for a swap by the sensor)
      return { ...En.look(EN, c.en, el, laps), driver: c.driverId, next: c.en.nextId, picked: c.en.picked, swaps: c.en.swaps, choices: En.choices(EN, c.en, c.roster, enBusy(i), el, laps), totals: En.totals(c.en, c.roster, el, laps), stints: En.stints(c.en, el, laps), lost: !!c.en.lost, lostLaps: c.swapLost || 0, standLeft: standing };
    };

    R.cars.forEach(c => { if (c.en && c.driverId !== c.en.d) enWheel(c, c.en.d); }); // (a team that has no starting driver, or one who is not of the roster, starts with the first of the roster)

    // ---- special penalties (Drivethrough, Stop-and-Go) ----
    // A penalty is served by stopping on the sensor: a Drivethrough once the pit stop starts (the pit hold time), a Stop-and-Go once the car has stood still for its seconds.
    function serveCheck(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null || !c.pending.length) return;
      const p = c.pending[0], need = p.kind === 'drivethrough' ? F.pitHold : p.seconds * 1000;
      if (t - c.blockAt < need) return;
      c.pending.shift(); c.served.push({ ...p, servedAt: t }); c.servedNow = true; log('served', i, t, { name: p.name });
    }
    // The Race Director gives a driver a special penalty. It costs penalty points (they are taken off) and must then be served in the pits.
    R.assign = (i, typeIndex, t) => {
      const c = R.cars[i], ty = P.types[typeIndex];
      if (!P.on || !c || !ty || c.dq || (R.status !== 'running' && R.status !== 'paused') || c.points < ty.cost) return false;
      if (ty.cost) R.addPoints(i, -ty.cost, t);
      c.pending.push({ name: ty.name, kind: ty.kind, seconds: ty.seconds, extra: ty.extra, unserved: ty.unserved, at: t });
      log('assigned', i, t, { name: ty.name });
      return true;
    };

    // ---- Damage System (see damage.js) ----
    // A car collects damage points: the Race Director gives them (a hit, an incident of the Damage System) or a deslot does (a lap that is slower than the deslot time of the track). The highest level they
    // have reached says how long the car must stand still on the sensor in the pits; that repairs the damage (the points go back to 0), or retires or disqualifies the car. A level can have a deadline in laps:
    // a car that is not in the pits by then gets penalty points for every lap. A car that leaves the pits before the repair is done gets points too, and the damage stays.
    R.damage = DM;
    const dmgLevel = c => (DM ? Dm.levelOf(DM, c.dmg) : null);
    // when the other work of this stop is done (for a repair "one after the other"): the pit stop has started, the tank is full, and a driver swap by the sensor is made
    function otherDoneAt(c) {
      let at = c.pit ? Math.max(c.blockAt, c.pit.start) : c.blockAt + F.pitHold;
      if (c.pit && F.on) { const rate = c.pit.rate ?? F.rate, tank = c.pit.tank ?? F.tank; if (rate > 0) at = Math.max(at, c.pit.start + Math.max(0, tank - c.pit.fuel0) / rate * 1000); }
      if (c.en && EN && EN.confirm !== 'button') {
        if (c.enSwapAt === c.blockAt) at = Math.max(at, c.enSwapDoneAt ?? at);
        else { const l = En.look(EN, c.en, enClock(c.blockAt), c.laps.length); if (l.due || (EN.mode === 'free' && l.allowed)) at = Math.max(at, c.blockAt + EN.seconds * 1000); }
      }
      return at;
    }
    // the moment the repair of the car on the sensor is done (null: nothing to repair)
    function repairAt(c) {
      const lv = dmgLevel(c);
      return lv && c.blockAt !== null && !c.dmgOut ? Dm.doneAt(DM, lv, c.blockAt, DM.stop === 'add' ? otherDoneAt(c) : undefined) : null;
    }
    // the car stands in the pits and the time has come: repair it, or retire or disqualify it
    function repairCheck(i, t) {
      const c = R.cars[i];
      if (!DM || c.blockAt === null || !c.pit || c.dmgOut || c.repairedAt === c.blockAt) return; // (a stop that has not started as a pit stop yet repairs nothing; one stop repairs once)
      const lv = dmgLevel(c), at = repairAt(c);
      if (!lv || at === null || t < at) return;
      c.repairedAt = c.blockAt;
      const info = { name: lv.name, points: c.dmg, level: Dm.levelAt(DM, c.dmg), ms: Math.max(0, at - c.blockAt) };
      if (lv.action === 'repair') {
        c.repairs.push({ at: c.blockAt, ms: info.ms, name: lv.name, points: c.dmg }); c.repairMs += info.ms;
        c.dmg = 0; c.dmgLvl = -1; c.dmgDue = null;
        log('repaired', i, t, info);
      } else {
        c.repairs.push({ at: c.blockAt, ms: info.ms, name: lv.name, points: c.dmg, out: lv.action }); c.repairMs += info.ms;
        c.dmgOut = lv.action; c.dmgWas = { done: c.done, retired: c.retired };
        if (lv.action === 'dq') { c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; }
        c.done = true; c.retired = true;
        log('damageout', i, t, { ...info, how: lv.action });
        checkEnd(t);
      }
    }
    // after every lap: the automatic damage points of a deslot, and the penalty points of a car that is late for the pits
    function damageLap(c, i, t, deslot) {
      if (c.dmgOut || c.done) return;
      if (deslot && DM.deslotPoints > 0) R.addDamage(i, DM.deslotPoints, t, 'deslot');
      if (c.dmg > 0 && c.dmgDue !== null && c.laps.length > c.dmgDue) {
        const lv = dmgLevel(c), added = DM.latePoints > 0 && R.addPoints(i, DM.latePoints, t, 'damagelate'); // (no points, or no penalty system: nothing is added)
        log('damagelate', i, t, { name: lv ? lv.name : '', points: added ? DM.latePoints : 0, lap: c.laps.length, due: c.dmgDue });
      }
    }
    // Adds (or with a negative n takes back) damage points to car i. A hit is made more or less by the damage factor of the car (a fragile car); points that are taken back are not. A level that is reached for
    // the first time is logged, and its deadline is worked out. Gives true when the damage changed.
    R.addDamage = (i, n, t, why) => {
      const c = R.cars[i];
      if (!DM || !c || !['running', 'paused'].includes(R.status) || !Number.isFinite(n) || n === 0 || (c.done && !c.dmgOut) || (c.dq && !c.dmgOut) || (c.dmgOut && n > 0)) return false; // (a car that damage put out takes no more damage; only a hit that is taken back can bring it back)
      const pts = Dm.scale(n, c.damageFactor);
      if (!pts) return false;
      const before = c.dmg;
      c.dmg = Math.max(0, c.dmg + pts);
      if (c.dmg === before) return false;
      const delta = c.dmg - before, k = Dm.levelAt(DM, c.dmg), was = c.dmgLvl, lv = k >= 0 ? DM.levels[k] : null;
      if (delta > 0) c.dmgTotal += delta;
      log('damage', i, t, { delta, points: c.dmg, level: k, name: lv ? lv.name : '', ...(why ? { why } : {}) });
      c.dmgLvl = k;
      if (k > was && lv) { c.dmgDue = Dm.dueLap(c.dmgDue, c.laps.length, lv); log('damagelevel', i, t, { level: k, name: lv.name, points: c.dmg, urgent: lv.urgent, action: lv.action, seconds: lv.seconds, within: lv.within }); }
      else if (k < 0) c.dmgDue = null;
      if (c.dmgOut && (!lv || lv.action === 'repair') && R.status !== 'finished') { // a mistaken hit can still be taken back: the car that damage put out is in the race again
        if (c.dmgOut === 'dq') c.dq = false;
        c.done = !!(c.dmgWas && c.dmgWas.done); c.retired = !!(c.dmgWas && c.dmgWas.retired); c.dmgOut = ''; c.repairedAt = null; log('reinstated', i, t, { by: 'damage' });
      }
      return true;
    };
    // What a screen needs to know of the damage of car i: the points, the level and what it asks, the laps left to the deadline (negative: late), and while the car stands on the sensor how long the repair still takes.
    R.damageNoteOf = i => (DM && R.cars[i] ? Dm.noteOf(R.cars[i], R.events, i) : ''); // what the damage did to car i in this race, in words (empty when nothing)
    R.damageOf = (i, t) => {
      const c = R.cars[i]; if (!DM || !c) return null;
      const lv = dmgLevel(c), at = repairAt(c), te = R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t;
      const pitAt = c.blockAt !== null && !c.pit ? c.blockAt + F.pitHold : null; // (the stop only starts as a pit stop after the pit hold time)
      const ready = at === null ? null : Math.max(at, pitAt ?? at);
      return { points: c.dmg, total: c.dmgTotal, level: c.dmgLvl, name: lv ? lv.name : '', urgent: !!(lv && lv.urgent), action: lv ? lv.action : '', seconds: lv ? lv.seconds : 0, within: lv ? lv.within : 0,
        tone: Dm.toneOf(lv, c.dmg), lapsLeft: c.dmgDue !== null && c.dmg > 0 ? c.dmgDue - c.laps.length : null, standLeft: ready !== null && c.repairedAt !== c.blockAt && R.status === 'running' ? Math.max(0, ready - te) : null,
        out: c.dmgOut, repairs: c.repairs.length, repairMs: c.repairMs };
    };

    // ---- the end-of-race review: the Race Director corrects the result before it is saved ----
    const rebest = c => { const g = goodLaps(c); c.best = g.length ? Math.min(...g) : null; };
    R.nullify = i => { const c = R.cars[i]; if (!c || !c.points) return false; const was = c.points; c.points = 0; c.undoPoints = was; log('penalty', i, R.endAt, { delta: -was, points: 0, ms: 0 }); return true; };
    R.restorePoints = i => { const c = R.cars[i]; if (!c || !c.undoPoints) return false; c.points = c.undoPoints; c.undoPoints = 0; log('penalty', i, R.endAt, { delta: c.points, points: c.points, ms: penaltyMs(P, c.points) }); return true; };
    R.forgive = (i, k) => { const c = R.cars[i]; if (!c || !c.pending[k]) return false; const [p] = c.pending.splice(k, 1); log('forgiven', i, R.endAt, { name: p.name }); return true; };
    // The adjustment of one car: how much race time (ms), how many laps and how many championship points are added (a positive number) or taken off (a negative one). It stacks with what was adjusted before.
    // The time cannot go below zero and the laps cannot go below none (a lap that was never driven has no lap time, so only the count changes). Returns true when something changed.
    R.adjust = (i, a) => {
      const c = R.cars[i]; if (!c || !a) return false;
      const num = v => { const x = typeof v === 'string' && v.trim() !== '' ? Number(v) : v; return typeof x === 'number' && Number.isFinite(x) ? x : 0; }; // (a number, or a text with one in it: it comes from a field; nothing else is an amount)
      const ms = Math.round(num(a.ms)), laps = Math.round(num(a.laps)), pts = num(a.points);
      const was = [c.adjMs || 0, c.adjLaps || 0, c.adjPoints || 0];
      c.adjMs = Math.max(was[0] + ms, -(c.total + penOf(c)));
      c.adjLaps = Math.max(was[1] + laps, -c.laps.length);
      c.adjPoints = Math.round((was[2] + pts) * 100) / 100;
      const now = [c.adjMs, c.adjLaps, c.adjPoints];
      if (now.every((v, k) => v === was[k])) return false;
      log('adjusted', i, R.endAt, { ms: now[0] - was[0], laps: now[1] - was[1], points: now[2] - was[2] });
      return true;
    };
    R.adjustReset = i => { const c = R.cars[i]; if (!c || !(c.adjMs || c.adjLaps || c.adjPoints)) return false; c.adjMs = 0; c.adjLaps = 0; c.adjPoints = 0; log('adjusted', i, R.endAt, { reset: true }); return true; };
    R.lapsOf = lapsOf; R.adjOf = c => ({ ms: c.adjMs || 0, laps: c.adjLaps || 0, points: c.adjPoints || 0 });
    // The race time of a car: the time of its last crossing, plus time penalties and the adjustment of the review (what the standings call the effective time).
    R.timeOf = c => c.total + addOf(c);
    R.lapLimit = lapLimit;
    // Did the car finish a race by laps? It drove all the laps, and was not retired or disqualified.
    R.finishedLaps = c => lapLimit > 0 && c.done && !c.retired && !c.dq && c.laps.length - (c.swapLost || 0) >= lapLimit;
    // The time the car would have needed for all the laps: what it has, plus the laps it still had to drive at its own average lap (the laps that count for averages).
    // Null when it has no lap to average, or when it was retired or disqualified (such a car has no finish time to guess).
    R.estimateOf = c => {
      if (!(lapLimit > 0) || c.retired || c.dq) return null;
      if (R.finishedLaps(c)) return R.timeOf(c);
      const g = goodLaps(c); if (!g.length) return null;
      return R.timeOf(c) + Math.max(0, lapLimit - c.laps.length) * (g.reduce((a, b) => a + b, 0) / g.length);
    };
    R.addTime = (i, ms) => { const c = R.cars[i]; if (!c || !(ms > 0)) return false; c.extraMs = (c.extraMs || 0) + ms; log('timeadded', i, R.endAt, { ms }); return true; };
    R.setDq = (i, on) => {
      const c = R.cars[i]; if (!c || c.dq === !!on) return false;
      if (on) { c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, R.endAt); }
      else { c.dq = false; c.done = !!c.dqWasDone; c.retired = !!c.dqWasRetired; log('reinstated', i, R.endAt); }
      return true;
    };
    R.setInvalid = (i, n, on) => {
      const c = R.cars[i]; if (!c || !(n >= 0 && n < c.laps.length)) return false;
      const has = c.invalid.includes(n); if (!!on === has) return false;
      c.invalid = on ? [...c.invalid, n].sort((a, b) => a - b) : c.invalid.filter(x => x !== n); rebest(c); return true;
    };
    // recalc: the lap also leaves the race (one lap fewer, less time); otherwise it only leaves the records
    R.removeLap = (i, n, recalc) => {
      const c = R.cars[i]; if (!c || !(n >= 0 && n < c.laps.length)) return false;
      if (!recalc) { if (!c.removed.includes(n)) c.removed = [...c.removed, n].sort((a, b) => a - b); return true; }
      c.laps.splice(n, 1); c.bad.splice(n, 1);
      const shift = list => list.filter(x => x !== n).map(x => (x > n ? x - 1 : x));
      c.invalid = shift(c.invalid); c.removed = shift(c.removed); c.yellowFast = shift(c.yellowFast || []); c.pitLaps = shift(c.pitLaps || []);
      c.total = c.laps.reduce((a, b) => a + b, 0); rebest(c); return true;
    };

    // the time of the pit stop in progress (or the last one): { live, ms } or null
    R.pitTime = (i, t) => {
      const c = R.cars[i];
      if (c.blockAt !== null && c.pit) return { live: true, ms: (R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t) - c.blockAt };
      return c.lastPit ? { live: false, ms: c.lastPit.duration } : null;
    };

    const cum = (car, n) => car.laps.slice(0, n).reduce((a, b) => a + b, 0);
    // The moment (on the race clock) at which a car set its best lap: the end of the first lap that is as fast as the best one and counts. Two cars with the same best lap:
    // the one that set it first ranks higher, as with the track records (the first to set a time keeps it).
    const bestAt = c => {
      const n = c.laps.findIndex((t, k) => t === c.best && !(c.bad || [])[k] && !(c.invalid || []).includes(k));
      return n < 0 ? Infinity : c.total - c.laps.slice(n + 1).reduce((a, b) => a + b, 0);
    };
    // ---- A race that was interrupted (a crash, a power cut): keep it, and carry on later (1.9.0) ----
    // snapshot(t): everything that changes during a race, as plain data (t: the race page's clock now). restore(snap): puts it back into an engine made with the same settings. The race comes back
    // paused, with its clock standing where it was at t; resume() then shifts every time by the time that went by, as after any pause. A lap that was being driven is not counted for records: its time
    // includes the time that was lost.
    const STATE = ['status', 't0', 'pausedAt', 'endAt', 'timeUp', 'finished', 'endedBy', 'yellowAt', 'flag', 'bopActive', 'bopSpread', 'wxState', 'wxStage', 'resumes'];
    R.resumes = 0; // how many times this race was continued after an interruption
    // (a car is kept as what differs from its entry: the names, the pictures and the roster of the entry are made again from the entry, so a snapshot stays small)
    R.snapshot = t => {
      const cars = R.cars.map((c, i) => { const e = cfg.entries[i] || {}, d = {}; Object.keys(c).forEach(k => { if (!(k in e) || JSON.stringify(c[k]) !== JSON.stringify(e[k])) d[k] = c[k]; }); return d; });
      const snap = { v: 1, at: t, callId, cars, events: R.events, calls: R.calls }; STATE.forEach(k => { snap[k] = R[k]; });
      return JSON.parse(JSON.stringify(snap));
    };
    R.restore = snap => {
      if (!snap || snap.v !== 1 || !Array.isArray(snap.cars) || snap.cars.length !== R.cars.length || !['running', 'paused', 'finished'].includes(snap.status)) return false;
      const x = JSON.parse(JSON.stringify(snap));
      STATE.forEach(k => { if (x[k] !== undefined) R[k] = x[k]; });
      R.cars.length = 0; R.cars.push(...x.cars.map((d, i) => ({ ...(cfg.entries[i] || {}), ...d }))); R.events.length = 0; R.events.push(...(x.events || [])); R.calls.length = 0; R.calls.push(...(x.calls || []));
      callId = Number(x.callId) || 0; R.resumes = (Number(x.resumes) || 0) + 1;
      if (R.status === 'running') { R.status = 'paused'; R.pausedAt = Number.isFinite(x.at) ? x.at : R.pausedAt; } // (it was racing: it waits, with the clock where it was)
      if (R.status !== 'finished') R.cars.forEach(c => { c.resumed = true; });
      return true;
    };
    R.standings = () => {
      const byBest = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12) || (a.best !== null && b.best !== null ? bestAt(a) - bestAt(b) : 0);
      const eff = c => c.total + addOf(c); // total time including time penalties and the adjustment
      const byLaps = (a, b) => lapsOf(b) - lapsOf(a) || eff(a) - eff(b);
      const order = R.cars.map((_, i) => i).sort((x, y) => {
        const a = R.cars[x], b = R.cars[y];
        if (a.retired !== b.retired) return a.retired ? 1 : -1; // retired cars rank behind the rest
        if (type === 'race' && (a.adjLaps || b.adjLaps) && lapsOf(a) !== lapsOf(b)) return lapsOf(b) - lapsOf(a); // (laps added or taken off in the review count before who finished first)
        if (type === 'race' && a.done !== b.done) return a.done ? -1 : 1;
        if (type === 'race' && a.done && b.done) return eff(a) - eff(b) || a.place - b.place;
        return ((type === 'practice' || type === 'qualifying') ? byBest(a, b) : byLaps(a, b)) || x - y;
      });
      const lead = R.cars[order[0]];
      return order.map((i, p) => {
        const c = R.cars[i];
        let gap = '';
        if (c.dq) gap = 'DQ';
        else if (c.retired) gap = 'Out';
        else if (p > 0) {
          if (type === 'practice' || type === 'qualifying') gap = c.best === null ? '' : '+' + fmtTime(c.best - lead.best);
          // always a time: how long after the leader this car reached the lap it has completed (a lapped car is compared at its own lap count)
          else if (c.laps.length) gap = '+' + fmtTime(Math.max(0, cum(c, c.laps.length) + addOf(c) - cum(lead, c.laps.length) - addOf(lead)));
        }
        return { pos: p + 1, index: i, car: c, gap };
      });
    };
    // Numbers for the spoken calls (see announcer.js): for every car, by its index, the gap to the leader and to the car in front in milliseconds
    // (null when there is none, or the car is out), and how many full laps the car is behind the leader. Practice and qualifying compare best laps.
    R.gapInfo = () => {
      const st = R.standings(), byBest = type === 'practice' || type === 'qualifying', out = new Array(R.cars.length).fill(null);
      const val = (c, k) => cum(c, k) + addOf(c);
      st.forEach((row, p) => {
        const c = row.car; if (c.dq || c.retired) return;
        let lead = null, ahead = null, down = 0;
        if (p > 0) {
          const L = st[0].car, A = st[p - 1].car;
          if (byBest) { if (c.best !== null && L.best !== null) lead = Math.max(0, c.best - L.best); if (c.best !== null && A.best !== null) ahead = Math.max(0, c.best - A.best); }
          else if (c.laps.length) {
            const n = c.laps.length, mine = val(c, n);
            lead = Math.max(0, mine - val(L, n)); ahead = Math.max(0, mine - val(A, n));
            while (L.laps.length >= n + down + 1 && val(L, n + down + 1) <= mine) down++;
          }
        }
        out[row.index] = { pos: p + 1, lead, ahead, down };
      });
      return out;
    };
    return R;
  }

  // ---- heat-based races ----
  const shuffle = (list, rnd = Math.random) => {
    const x = [...list];
    for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; }
    return x;
  };
  const pairKey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

  // Returns one array per heat; each holds { p: participant number, lane } entries.
  // plan 'manual': `heats` heats, taking the next group from a shuffled order and wrapping around.
  // plan 'roundrobin': as many heats as it takes for every pair of participants to share a heat.
  function buildSchedule({ count, lanes, plan, heats, rnd }) {
    count = Math.max(0, Math.floor(Number(count)) || 0); lanes = Math.max(1, Math.floor(Number(lanes)) || 1); // whole numbers only: a track saved with 0 or 2.5 lanes must not break the schedule
    const k = Math.min(lanes, count);
    const order = shuffle([...Array(count).keys()], rnd);
    const groups = [];
    if (plan === 'roundrobin') {
      if (count <= lanes) groups.push(order);
      else if (k < 2) order.forEach(i => groups.push([i])); // one lane: nobody meets anybody, so every driver gets one heat on their own (the pairing below would never finish)
      else {
        const uncovered = new Set();
        for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) uncovered.add(pairKey(a, b));
        const drove = Array(count).fill(0);
        const degree = i => order.filter(j => j !== i && uncovered.has(pairKey(i, j))).length;
        const better = (x, y) => { for (let n = 0; n < x.length; n++) if (x[n] !== y[n]) return x[n] > y[n]; return false; };
        const pick = (pool, score) => { let best = null, bs = null; for (const i of pool) { const s = score(i); if (!bs || better(s, bs)) { best = i; bs = s; } } return best; };
        while (uncovered.size) {
          const g = [pick(order, i => [degree(i), -drove[i]])];
          while (g.length < k) {
            const pool = order.filter(j => !g.includes(j));
            g.push(pick(pool, j => [g.filter(m => uncovered.has(pairKey(j, m))).length, degree(j), -drove[j]]));
          }
          for (let a = 0; a < g.length; a++) { drove[g[a]]++; for (let b = a + 1; b < g.length; b++) uncovered.delete(pairKey(g[a], g[b])); }
          groups.push(g);
        }
      }
    } else {
      let pos = 0;
      for (let h = 0; h < Math.max(1, heats); h++) { const g = []; for (let j = 0; j < k; j++) g.push(order[pos++ % count]); groups.push(g); }
    }
    // spread the lanes: each driver takes the lane they have used least so far
    const use = Array.from({ length: count }, () => Array(lanes).fill(0));
    return groups.map((g, h) => {
      const free = [...Array(lanes).keys()];
      return g.map(p => {
        let best = null;
        for (let n = 0; n < free.length; n++) {
          const l = free[(n + h) % free.length];
          if (best === null || use[p][l] < use[p][best]) best = l;
        }
        free.splice(free.indexOf(best), 1); use[p][best]++;
        return { p, lane: best };
      });
    });
  }

  // How the heats add up to the overall result. Every setting has a standard that is the result of before 0.94.0.
  //   countBy: 'total' (all heats added up), 'average' (the average per heat, so a driver with an extra heat has no advantage) or 'best' (only the best bestHeats heats of every driver count)
  //   dropWorst: the worst heat of every driver (who raced at least two) does not count
  //   fastestBonus: extra points for the fastest lap of every heat (a result by points only)
  //   tieBreak: what decides between drivers with the same result: 'default' (the other measure, then the best lap), 'bestlap' (the best lap first), 'wins' (the most heat wins first) or 'time' (the lowest total time first)
  const TIEBREAKS = ['default', 'bestlap', 'wins', 'time'];
  function scoringOf(src) {
    const s = src || {}, n = Math.floor(Number(s.bestHeats));
    return {
      countBy: s.countBy === 'average' || s.countBy === 'best' ? s.countBy : 'total',
      bestHeats: Number.isFinite(n) ? Math.max(1, Math.min(50, n)) : 2,
      dropWorst: s.dropWorst === 'yes' || s.dropWorst === true,
      fastestBonus: Math.max(0, Math.min(1000, Number(s.fastestBonus) || 0)),
      tieBreak: TIEBREAKS.includes(s.tieBreak) ? s.tieBreak : 'default',
      // the result by total race time (the lowest time wins) needs heats that are limited by laps: with heats limited by time everybody drives the same time, so the laps count
      byTime: s.byTime === true || (s.resultBy === 'time' && s.heatBy !== 'time'),
      // a heat that was not finished: the driver ranks below the finishers ('below', by laps), or the finish time is estimated from the average lap of the driver ('estimate')
      unfinished: s.unfinished === 'estimate' ? 'estimate' : 'below'
    };
  }

  // Finals after the heats. finals: 'none' (the standard), 'a' (a final A) or 'ab' (a final B first, then a final A).
  //   finalMode: 'places' (the finals decide the places; the heat result only decides who races in which final) or 'added' (what a driver scores in the final is added to the heat result)
  function finalsOf(src) {
    const s = src || {};
    return { finals: s.finals === 'a' || s.finals === 'ab' ? s.finals : 'none', finalMode: s.finalMode === 'added' ? 'added' : 'places' };
  }
  // How many drivers race in each final: [A] or [A, B]. A final holds as many drivers as the track has lanes (or all drivers, when there are fewer).
  // The B final is the next group, and only when at least two drivers are left for it. With one lane nobody can race against anybody, so there are no finals.
  function finalSizes(count, lanes, finals) {
    count = Math.max(0, Math.floor(Number(count)) || 0); lanes = Math.max(1, Math.floor(Number(lanes)) || 1);
    const k = Math.min(lanes, count), out = [];
    if ((finals !== 'a' && finals !== 'ab') || k < 2) return out;
    out.push(k);
    if (finals === 'ab' && count - k >= 2) out.push(Math.min(k, count - k));
    return out;
  }

  // cfg: { participants: [{driverId, carId, driverName, carName}], schedule, resultBy: laps|points, points: [10, 8, ...], lanes, rnd, and the settings of scoringOf and finalsOf }
  function createHeatRace(cfg) {
    const { participants, schedule } = cfg, points = cfg.points || [], sc = scoringOf(cfg), fin = finalsOf(cfg), byTime = sc.byTime, byPoints = !byTime && cfg.resultBy === 'points';
    const lanes = Math.max(1, Math.floor(Number(cfg.lanes)) || schedule.reduce((m, h) => h.reduce((n, e) => Math.max(n, e.lane + 1), m), 1));
    const sizes = finalSizes(participants.length, lanes, fin.finals), names = sizes.length === 2 ? ['B', 'A'] : sizes.length === 1 ? ['A'] : [], rnd = cfg.rnd || Math.random;
    const H = { schedule, idx: 0, results: [], count: schedule.length, total: schedule.length + names.length, lanes, scoring: sc, finals: fin, finalPlan: null, picks: {} };
    H.hasNext = () => H.idx < H.total;
    // A heat race that was interrupted (1.24.0): the state of the heats as plain data, and back. snapshot() holds what changes while the heats are raced: the schedule (to see that it is the same race), the heats that are done, the finals and the lanes chosen for them.
    // restore(snap) puts it into a heat race that was made with the same settings; it says false (and changes nothing) when the schedule, the number of races or the finals do not fit.
    H.snapshot = () => JSON.parse(JSON.stringify({ v: 1, schedule: H.schedule, idx: H.idx, results: H.results, finalPlan: H.finalPlan, picks: H.picks }));
    H.restore = snap => {
      if (!snap || snap.v !== 1 || !Array.isArray(snap.results) || !Number.isInteger(snap.idx) || snap.idx < 0 || snap.idx > H.total || snap.results.length !== snap.idx) return false;
      if (JSON.stringify(snap.schedule) !== JSON.stringify(H.schedule)) return false; // (not the same heats any more: other drivers, other lanes)
      const plan = snap.finalPlan;
      if (names.length && snap.idx >= H.count) { if (!Array.isArray(plan) || plan.length !== names.length || !plan.every((g, i) => g && g.name === names[i] && Array.isArray(g.drivers) && g.drivers.every(p => Number.isInteger(p) && p >= 0 && p < participants.length))) return false; }
      else if (plan !== null && plan !== undefined && !Array.isArray(plan)) return false;
      if (snap.picks !== undefined && (snap.picks === null || typeof snap.picks !== 'object' || Array.isArray(snap.picks))) return false;
      const x = JSON.parse(JSON.stringify(snap));
      H.idx = x.idx; H.results.length = 0; H.results.push(...x.results); H.finalPlan = Array.isArray(x.finalPlan) ? x.finalPlan : null; H.picks = x.picks || {};
      return true;
    };
    // the finals are known when the last heat is recorded: the best of the heat result race the A final, the next ones the B final (the drivers of a final are listed best first)
    const planFinals = () => {
      const ranked = H.overall().map(o => o.participant), a = ranked.slice(0, sizes[0]), b = ranked.slice(sizes[0], sizes[0] + (sizes[1] || 0));
      return sizes.length === 2 ? [{ name: 'B', drivers: b }, { name: 'A', drivers: a }] : [{ name: 'A', drivers: a }];
    };
    // the final that is next, with the lanes its drivers have chosen so far: { name, drivers, picks: [{p, lane}], next: who chooses now (null when all have), free: the free lanes }
    H.finalNow = () => {
      if (H.idx < H.count || H.idx >= H.total || !H.finalPlan) return null;
      const f = H.finalPlan[H.idx - H.count], picks = H.picks[f.name] || [], taken = picks.map(x => x.lane);
      const left = f.drivers.filter(p => !picks.some(x => x.p === p));
      return { name: f.name, drivers: f.drivers, picks, next: left.length ? left[0] : null, free: [...Array(lanes).keys()].filter(l => !taken.includes(l)) };
    };
    H.raceName = i => (i < H.count ? 'Heat ' + (i + 1) : i < H.total ? 'Final ' + names[i - H.count] : '');
    H.isFinal = () => H.idx >= H.count && H.idx < H.total;
    H.picksDone = () => { const f = H.finalNow(); return !f || f.next === null; };
    // the best-placed driver who has not chosen yet takes a free lane. The last driver gets the last free lane by himself: that is no choice.
    H.pick = lane => {
      const f = H.finalNow();
      if (!f) return { error: 'There is no final to choose lanes for.' };
      if (f.next === null) return { error: 'All lanes of this final are chosen.' };
      if (typeof lane === 'string' && lane.trim() !== '') lane = Number(lane); // (a lane from a button comes as text; nothing, null or true is no lane)
      if (!Number.isInteger(lane) || lane < 0 || lane >= lanes) return { error: 'That lane does not exist.' };
      if (!f.free.includes(lane)) return { error: 'That lane is taken.' };
      const list = H.picks[f.name] = f.picks.concat([{ p: f.next, lane }]), rest = f.drivers.filter(p => !list.some(x => x.p === p));
      if (rest.length === 1 && f.free.length === 2) list.push({ p: rest[0], lane: f.free.find(l => l !== lane) });
      return { ok: true };
    };
    // the drivers who have not chosen yet get the free lanes by lot
    H.randomRest = () => {
      const f = H.finalNow(); if (!f || f.next === null) return false;
      const free = f.free.slice(); for (let i = free.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [free[i], free[j]] = [free[j], free[i]]; }
      H.picks[f.name] = f.picks.concat(f.drivers.filter(p => !f.picks.some(x => x.p === p)).map((p, n) => ({ p, lane: free[n] })));
      return true;
    };
    H.clearPicks = () => { const f = H.finalNow(); if (f) H.picks[f.name] = []; };
    H.entries = () => {
      const f = H.finalNow();
      if (!f) return schedule[H.idx].map(({ p, lane }) => ({ lane, participant: p, ...participants[p] }));
      // (lanes not chosen yet are given out in the order of the heat result, only to show a full grid: the race does not start before every driver has chosen)
      const free = f.free.slice(), all = f.picks.concat(f.drivers.filter(p => !f.picks.some(x => x.p === p)).map(p => ({ p, lane: free.shift() })));
      return all.sort((a, b) => a.lane - b.lane).map(({ p, lane }) => ({ lane, participant: p, ...participants[p] }));
    };
    H.record = race => {
      const rows = race.standings().map(r => { // (what the Race Director adjusted in the review is in the row: the laps and the time are the adjusted ones, the championship points come on top of the points of the place)
        const a = race.adjOf ? race.adjOf(r.car) : { ms: 0, laps: 0, points: 0 }; // (a race that is not an engine race, such as a stand-in of a test, has no adjustments)
        const note = race.bopNoteOf && race.cars ? race.bopNoteOf(race.cars.indexOf(r.car)) : ''; // what Balance of Power did to the car, in words
        const tyres = race.tyreNoteOf && race.cars ? race.tyreNoteOf(race.cars.indexOf(r.car)) : ''; // what the tyres did to the car (weather), in words
        const dnote = race.damageNoteOf && race.cars ? race.damageNoteOf(race.cars.indexOf(r.car)) : ''; // what the damage did to the car (the Damage System), in words
        // result by total race time: did the car finish its laps, and the time of the heat (the finish time, or an estimate for a car that did not finish when the setup asks for one)
        const fin = byTime && race.finishedLaps ? race.finishedLaps(r.car) : false, est = byTime && !fin && sc.unfinished === 'estimate' && race.estimateOf ? race.estimateOf(r.car) : null;
        const tm = fin ? (race.timeOf ? race.timeOf(r.car) : r.car.total + a.ms) : est;
        return { participant: r.car.participant, pos: r.pos, laps: race.lapsOf ? race.lapsOf(r.car) : r.car.laps.length, total: a.ms && Number.isFinite(r.car.total) ? r.car.total + a.ms : r.car.total, best: r.car.best, points: (points[r.pos - 1] || 0) + (byPoints ? a.points : 0),
          ...(byTime ? { fin, tm: Number.isFinite(tm) ? tm : null, ...(est !== null && Number.isFinite(est) ? { est: true } : {}) } : {}),
          ...(a.ms ? { adjMs: a.ms } : {}), ...(a.laps ? { adjLaps: a.laps } : {}), ...(byPoints && a.points ? { adjPoints: a.points } : {}), ...(note ? { bopNote: note } : {}), ...(tyres ? { tyreNote: tyres } : {}),
          ...(dnote ? { damageNote: dnote, damagePoints: r.car.dmgTotal || 0, repairs: (r.car.repairs || []).filter(q => !q.out).length, repairMs: r.car.repairMs || 0, ...(r.car.dmgOut ? { damageOut: r.car.dmgOut } : {}) } : {}) };
      });
      if (byPoints && sc.fastestBonus > 0) { // the driver with the fastest lap of this heat gets the bonus (with the same lap time, the one who finished higher)
        let top = null; for (const r of rows) if (Number.isFinite(r.best) && (top === null || r.best < top.best)) top = r;
        if (top) { top.bonus = sc.fastestBonus; top.points += sc.fastestBonus; }
      }
      const wnote = race.weatherNote ? race.weatherNote() : ''; // what the weather did in this heat, in words
      const result = { heat: H.idx + 1, ...(H.idx >= H.count ? { final: names[H.idx - H.count] } : {}), ...(wnote ? { weatherNote: wnote } : {}), rows };
      H.results.push(result); H.idx++;
      if (H.idx === H.count && names.length) H.finalPlan = planFinals();
      return result;
    };
    H.overall = () => {
      const heatsOf = participants.map(() => []), finalOf = participants.map(() => null), groupOf = participants.map(() => null), added = fin.finalMode === 'added';
      for (const hr of H.results) for (const r of hr.rows) {
        if (!heatsOf[r.participant]) continue;
        if (hr.final) finalOf[r.participant] = { ...r, name: hr.final }; else heatsOf[r.participant].push({ ...r, heat: hr.heat });
      }
      if (H.finalPlan) for (const g of H.finalPlan) for (const p of g.drivers) groupOf[p] = g.name;
      // the better heat first: more of what the result counts, then more of the other measure, then the lower total time, then the earlier heat (of two equal heats the later one is the worse)
      // (by total race time the better heat is the faster one: a heat that was not finished ranks after the finished ones, by laps, or by its estimated time when the setup estimates)
      const missing = h => h.tm === null || h.tm === undefined;
      const betterTime = (a, b) => (sc.unfinished === 'estimate' ? (missing(a) - missing(b)) || (missing(a) ? 0 : a.tm - b.tm) : (!a.fin - !b.fin) || (a.fin ? a.tm - b.tm : 0)) || b.laps - a.laps || a.heat - b.heat;
      const better = byTime ? betterTime : (a, b) => (byPoints ? b.points - a.points || b.laps - a.laps : b.laps - a.laps || b.points - a.points) || (a.total ?? Infinity) - (b.total ?? Infinity) || a.heat - b.heat;
      const acc = participants.map((p, i) => {
        const hs = heatsOf[i], ranked = hs.slice().sort(better), f = finalOf[i];
        let counted = ranked;
        if (sc.dropWorst && counted.length >= 2) counted = counted.slice(0, -1);
        if (sc.countBy === 'best') counted = counted.slice(0, sc.bestHeats);
        const sum = (list, k) => list.reduce((t, h) => t + h[k], 0), div = sc.countBy === 'average' && counted.length ? counted.length : 1;
        const all = f ? hs.concat([f]) : hs, best = all.reduce((m, h) => (Number.isFinite(h.best) && (m === null || h.best < m) ? h.best : m), null);
        const heatLaps = sum(counted, 'laps') / div, heatPoints = sum(counted, 'points') / div; // (what the heats count; a final that is added comes on top of it, and is not averaged, dropped or limited to the best heats)
        // by total race time: the time of the heats that count (a heat without a time counts as not finished), and the final when it is added
        const timed = counted.filter(h => !missing(h)), notFin = counted.length - timed.length, heatTime = timed.length ? sum(timed, 'tm') / (sc.countBy === 'average' ? timed.length : 1) : null;
        const finalMs = f && !missing(f) ? f.tm : null, addFinal = added && f, timeScore = heatTime === null && !(addFinal && finalMs !== null) ? null : (heatTime || 0) + (addFinal && finalMs !== null ? finalMs : 0);
        const adj = k => all.reduce((t, h) => t + (h[k] || 0), 0), am = adj('adjMs'), al = adj('adjLaps'), ap = Math.round(adj('adjPoints') * 100) / 100; // (what was adjusted in the reviews of its races, added up)
        const dmNote = Dm.totalNote(hs, f); // what the damage did to the driver in all its heats and the final, in words
        return { participant: i, ...p, laps: sum(all, 'laps'), points: sum(all, 'points'), best, heats: hs.length, ...(am ? { adjMs: am } : {}), ...(al ? { adjLaps: al } : {}), ...(ap ? { adjPoints: ap } : {}),
          ...(dmNote ? { damageNote: dmNote, damagePoints: all.reduce((t, h) => t + (h.damagePoints || 0), 0), repairs: all.reduce((t, h) => t + (h.repairs || 0), 0), repairMs: all.reduce((t, h) => t + (h.repairMs || 0), 0) } : {}),
          counted: counted.length, dropped: hs.filter(h => !counted.includes(h)).map(h => h.heat).sort((x, y) => x - y),
          heatScore: byTime ? heatTime : byPoints ? heatPoints : heatLaps, scoreLaps: heatLaps + (added && f ? f.laps : 0), scorePoints: heatPoints + (added && f ? f.points : 0),
          ...(byTime ? { timeScore, incomplete: notFin + (addFinal && finalMs === null ? 1 : 0), estimated: counted.filter(h => h.est).length + (addFinal && f.est ? 1 : 0), finalTime: f ? finalMs : null } : {}),
          finalName: groupOf[i], finalPos: f ? f.pos : null, finalLaps: f ? f.laps : null, finalPoints: f ? f.points : null,
          wins: counted.filter(h => h.pos === 1).length, time: counted.reduce((t, h) => t + (h.total ?? Infinity), 0) };
      });
      const desc = k => (a, b) => b[k] - a[k], bestAsc = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12), timeAsc = (a, b) => (a.time === b.time ? 0 : a.time - b.time);
      const main = byPoints ? 'scorePoints' : 'scoreLaps', other = desc(byPoints ? 'scoreLaps' : 'scorePoints');
      // by total race time: those who finished all the heats that count rank by their time, the lowest first; those with a heat that was not finished come after them (by laps, then fewer heats not finished, then time)
      const done = a => a.incomplete === 0 && a.timeScore !== null;
      const byTimeScore = (a, b) => (done(a) && done(b) ? a.timeScore - b.timeScore : done(a) !== done(b) ? (done(a) ? -1 : 1) : (b.scoreLaps - a.scoreLaps) || (a.incomplete - b.incomplete) || (a.time - b.time)) || 0;
      const chain = [byTime ? byTimeScore : desc(main), ...({ default: [other, bestAsc], bestlap: [bestAsc, other], wins: [desc('wins'), other, bestAsc], time: [timeAsc, other, bestAsc] })[sc.tieBreak]];
      // the A final drivers are placed above the B final drivers, and these above everybody else. In a final that is driven, 'places' puts its drivers in the order of that final.
      const tier = a => (a.finalName === 'A' ? 0 : a.finalName === 'B' ? 1 : 2);
      acc.sort((a, b) => {
        const t = tier(a) - tier(b); if (t) return t;
        if (!added && a.finalPos !== null && b.finalPos !== null) return a.finalPos - b.finalPos;
        for (const f of chain) { const v = f(a, b); if (v) return v; }
        return a.participant - b.participant;
      });
      return acc.map(({ time, ...a }, i) => ({ ...a, pos: i + 1, score: byTime ? a.timeScore : byPoints ? a.scorePoints : a.scoreLaps }));
    };
    return H;
  }

  const api = { fuelUse, goodLaps, penaltyConfig, penaltyMs, fuelConfig, yellowConfig, createRace, createHeatRace, scoringOf, finalsOf, finalSizes, buildSchedule, fmtTime, MIN_LAP };
  root.RaceEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
