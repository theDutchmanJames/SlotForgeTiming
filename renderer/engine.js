// The race rules, kept free of any screen code so they can be tested on their own.
// Times are in milliseconds; the caller passes the current time `t` into every call.
(function (root) {
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
    const F = { on: false, tank: 0, perLap: 0, rate: 0, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...(cfg.fuel || {}) };
    const Y = { target: 0, points: 0, ...(cfg.yellow || {}) }; // the yellow flag target lap time (ms; 0 = none) and the penalty points for a full lap under yellow that is faster
    const lapLimit = type === 'race' ? Number(cfg.laps) || 0 : 0;
    const timeLimit = (type === 'timed' || type === 'qualifying') ? (Number(cfg.duration) || 0) * 60000 : 0;
    const R = {
      cfg, fuel: F, penalty: P, type, status: 'ready', t0: 0, pausedAt: 0, endAt: 0, timeUp: false, finished: 0, endedBy: '',
      yellow: Y, yellowAt: null, // yellowAt: when the yellow flag that is up now went up (a lap that started before that is not a lap under yellow)
      cars: cfg.entries.map(e => ({ ...e, laps: [], bad: [], points: 0, undoPoints: 0, dq: false, pending: [], served: [], extraMs: 0, invalid: [], removed: [], yellowFast: [], pitLaps: [], servedNow: false, last: 0, total: 0, best: null, done: false, place: 0, retired: false, fuel: F.on ? F.tank : 0, outOfFuel: false,
        blockAt: null, pit: null, pits: [], lastPit: null, outlap: false, started: !skipFirst })),
      events: [], // what happened, in order: { type, car, t } (outoffuel, retired, pitstart, fuelfull, pitend, call, callend...)
      calls: [] // calls from a lane to the Race Director: { id, car, t, open, how }; how a call ended: 'penalty' or 'dismiss'
    };
    let callId = 0;
    const log = (type, i, t, data) => R.events.push({ type, car: i, t, ...data });

    const end = (t, why) => { R.cars.forEach((c, i) => { if (c.blockAt !== null) { pitCheck(i, t); serveCheck(i, t); closePit(i, t); } }); R.status = 'finished'; R.endAt = t; R.endedBy = why; R.flag = ''; R.yellowAt = null; R.calls.forEach(c => { c.open = false; }); };
    const checkEnd = t => {
      if (R.status !== 'running') return;
      if (type === 'race' && cfg.endRule === 'leader' && R.finished > 0) return end(t, 'The lead car finished');
      const limited = lapLimit || timeLimit;
      if (limited && R.cars.every(c => c.done) && (type === 'race' || R.timeUp)) end(t, 'Every car finished');
    };

    R.elapsed = t => R.status === 'running' ? t - R.t0 : R.status === 'paused' ? R.pausedAt - R.t0 : R.status === 'finished' ? R.endAt - R.t0 : 0;
    R.start = t => { R.status = 'running'; R.t0 = t; R.cars.forEach(c => { c.last = t; }); };
    R.pause = t => { if (R.status === 'running') { R.status = 'paused'; R.pausedAt = t; } };
    R.resume = t => {
      if (R.status !== 'paused') return;
      const d = t - R.pausedAt; // the paused time does not count
      R.t0 += d; if (R.yellowAt !== null) R.yellowAt += d; R.cars.forEach(c => { c.last += d; if (c.blockAt !== null) c.blockAt += d; if (c.pit) c.pit.start += d; }); R.status = 'running';
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
      if (R.status === 'running') R.cars.forEach((_, i) => { pitCheck(i, t); serveCheck(i, t); });
      if (R.status === 'running' && timeLimit && !R.timeUp && t - R.t0 >= timeLimit) R.timeUp = true;
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
      const need = F.on ? fuelUse(F, dt) : 0; // litres this lap took
      const fuelShort = F.on && c.fuel < need - 1e-9; // the tank did not hold enough for this lap
      if (fuelShort) { // not enough fuel to have driven this lap
        if (!c.outOfFuel) { c.outOfFuel = true; log('outoffuel', R.cars.indexOf(c), t); }
        if (F.empty === 'retire') { c.done = true; c.retired = true; log('retired', R.cars.indexOf(c), t); checkEnd(t); return false; }
        if (F.empty === 'stop') return false; // the lap does not count until the car has refuelled
      }
      if (F.on) c.fuel = Math.max(0, Math.round((c.fuel - need) * 1e6) / 1e6);
      const pitLap = c.outlap; c.outlap = false; // (the lap in which the car stood in the pits)
      const slow = maxLap > 0 && dt > maxLap; // too slow to be a real lap time: it counts as a lap, but is left out of best laps and averages
      if (fuelShort && F.empty === 'warn' && P.fuelPoints > 0) R.addPoints(R.cars.indexOf(c), P.fuelPoints, t); // a car that carries on with an empty tank gets the points of the penalty system for every such lap
      if (pitLap) c.pitLaps.push(c.laps.length);
      c.laps.push(dt); c.bad.push(slow); c.last = t; c.total = t - R.t0;
      if (!slow && (c.best === null || dt < c.best)) c.best = dt;
      // the yellow flag target: a lap that began after the yellow flag went up, and ended with it still up, must not be faster than the target (a lap that was part green does not count)
      if (Y.target > 0 && R.flag === 'yellow' && R.yellowAt !== null && lapStart >= R.yellowAt && dt < Y.target) {
        const i = R.cars.indexOf(c), e = { type: 'yellowfast', car: i, t, lap: c.laps.length, ms: dt, target: Y.target, points: 0 }; // (logged before the penalty, so it is called out first)
        c.yellowFast.push(c.laps.length - 1); R.events.push(e);
        if (Y.points > 0 && R.addPoints(i, Y.points, t)) e.points = Y.points;
      }
      if (!c.dq && ((lapLimit && c.laps.length >= lapLimit) || (timeLimit && R.timeUp))) { c.done = true; c.place = ++R.finished; } // a car disqualified on this lap (fuel points) has not finished
      checkEnd(t);
      return true;
    };

    // A new stint on a lane (time tokens): the car of this lane starts again with nothing driven (and, when given, for another driver). Its first crossing only starts the timing.
    // The car object stays the same one, so everything that points to it keeps working.
    R.restartCar = (i, t, who) => {
      const c = R.cars[i]; if (!c) return false;
      Object.assign(c, who || {}, { laps: [], bad: [], points: 0, undoPoints: 0, dq: false, pending: [], served: [], extraMs: 0, invalid: [], removed: [], yellowFast: [], pitLaps: [], servedNow: false, last: t, total: 0, best: null, done: false, place: 0, retired: false,
        fuel: F.on ? F.tank : 0, outOfFuel: false, blockAt: null, pit: null, pits: [], lastPit: null, outlap: false, started: false });
      return true;
    };

    // ---- pit stops ----
    // A car stopping on the sensor breaks the beam: that counts as a normal crossing. Once the sensor has been
    // blocked for pitHold, the pit stop starts (refuelling begins). The stop lasts until the car leaves.
    function pitCheck(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null || c.pit || t - c.blockAt < F.pitHold) return;
      c.pit = { start: c.blockAt + F.pitHold, fuel0: c.fuel, full: false };
      log('pitstart', i, c.pit.start);
    }
    function fuelAt(i, t) {
      const c = R.cars[i];
      if (!F.on) return null;
      if (!c.pit) return c.fuel;
      const te = R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t;
      return Math.min(F.tank, c.pit.fuel0 + F.rate * Math.max(0, te - c.pit.start) / 1000);
    }
    function closePit(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null) return;
      if (c.pit) {
        const fuel = fuelAt(i, t), got = F.on ? fuel - c.pit.fuel0 : 0;
        if (F.on) { c.fuel = fuel; if (c.fuel >= F.perLap * (1 - (F.saving || 0)) - 1e-9) c.outOfFuel = false; }
        c.lastPit = { at: c.blockAt, duration: t - c.blockAt, refuelled: Math.round(got * 1000) / 1000 };
        c.pits.push(c.lastPit); c.outlap = true;
        log('pitend', i, t, { duration: c.lastPit.duration, refuelled: c.lastPit.refuelled });
      }
      c.blockAt = null; c.pit = null;
    }
    R.fuelOf = fuelAt;
    // ---- penalty points ----
    R.penMs = penOf;
    // Adds (or with a negative n takes back) penalty points. Reaching the disqualify limit puts the car out of the race.
    R.addPoints = (i, n, t) => {
      const c = R.cars[i];
      if (!P.on || !c || R.status === 'ready' || !Number.isFinite(n) || n === 0) return false;
      const before = c.points;
      c.points = Math.max(0, c.points + n);
      if (c.points === before) return false;
      log('penalty', i, t, { delta: c.points - before, points: c.points, ms: penaltyMs(P, c.points) });
      if (P.dq && c.points >= P.dq && !c.dq) {
        c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, t); checkEnd(t);
      } else if (c.dq && (!P.dq || c.points < P.dq) && R.status !== 'finished') { // a mistaken point can still be taken back
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
      R.cross(i, t);
      if (c.done) return true;
      c.blockAt = t; c.pit = null; c.servedNow = false;
      return true;
    };
    // the car leaves; a block shorter than pitHold is no pit stop
    R.unblock = (i, t) => {
      const c = R.cars[i];
      if (!c || c.blockAt === null) return false;
      if (R.status === 'running') { pitCheck(i, t); serveCheck(i, t); }
      if (c.pending.length && !c.servedNow && R.status === 'running') { // left before the penalty was served
        const p = c.pending[0]; log('leftearly', i, t, { name: p.name, extra: p.extra }); if (p.extra) R.addPoints(i, p.extra, t);
      }
      closePit(i, t);
      return true;
    };
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

    // ---- the end-of-race review: the Race Director corrects the result before it is saved ----
    const rebest = c => { const g = goodLaps(c); c.best = g.length ? Math.min(...g) : null; };
    R.nullify = i => { const c = R.cars[i]; if (!c || !c.points) return false; const was = c.points; c.points = 0; c.undoPoints = was; log('penalty', i, R.endAt, { delta: -was, points: 0, ms: 0 }); return true; };
    R.restorePoints = i => { const c = R.cars[i]; if (!c || !c.undoPoints) return false; c.points = c.undoPoints; c.undoPoints = 0; log('penalty', i, R.endAt, { delta: c.points, points: c.points, ms: penaltyMs(P, c.points) }); return true; };
    R.forgive = (i, k) => { const c = R.cars[i]; if (!c || !c.pending[k]) return false; const [p] = c.pending.splice(k, 1); log('forgiven', i, R.endAt, { name: p.name }); return true; };
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
    R.standings = () => {
      const byBest = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12);
      const eff = c => c.total + penOf(c); // total time including time penalties
      const byLaps = (a, b) => b.laps.length - a.laps.length || eff(a) - eff(b);
      const order = R.cars.map((_, i) => i).sort((x, y) => {
        const a = R.cars[x], b = R.cars[y];
        if (a.retired !== b.retired) return a.retired ? 1 : -1; // retired cars rank behind the rest
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
          else if (c.laps.length) gap = '+' + fmtTime(Math.max(0, cum(c, c.laps.length) + penOf(c) - cum(lead, c.laps.length) - penOf(lead)));
        }
        return { pos: p + 1, index: i, car: c, gap };
      });
    };
    // Numbers for the spoken calls (see announcer.js): for every car, by its index, the gap to the leader and to the car in front in milliseconds
    // (null when there is none, or the car is out), and how many full laps the car is behind the leader. Practice and qualifying compare best laps.
    R.gapInfo = () => {
      const st = R.standings(), byBest = type === 'practice' || type === 'qualifying', out = new Array(R.cars.length).fill(null);
      const val = (c, k) => cum(c, k) + penOf(c);
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
      tieBreak: TIEBREAKS.includes(s.tieBreak) ? s.tieBreak : 'default'
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
    const { participants, schedule } = cfg, points = cfg.points || [], sc = scoringOf(cfg), fin = finalsOf(cfg), byPoints = cfg.resultBy === 'points';
    const lanes = Math.max(1, Math.floor(Number(cfg.lanes)) || schedule.reduce((m, h) => h.reduce((n, e) => Math.max(n, e.lane + 1), m), 1));
    const sizes = finalSizes(participants.length, lanes, fin.finals), names = sizes.length === 2 ? ['B', 'A'] : sizes.length === 1 ? ['A'] : [], rnd = cfg.rnd || Math.random;
    const H = { schedule, idx: 0, results: [], count: schedule.length, total: schedule.length + names.length, lanes, scoring: sc, finals: fin, finalPlan: null, picks: {} };
    H.hasNext = () => H.idx < H.total;
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
      const rows = race.standings().map(r => ({
        participant: r.car.participant, pos: r.pos, laps: r.car.laps.length, total: r.car.total, best: r.car.best, points: points[r.pos - 1] || 0
      }));
      if (byPoints && sc.fastestBonus > 0) { // the driver with the fastest lap of this heat gets the bonus (with the same lap time, the one who finished higher)
        let top = null; for (const r of rows) if (Number.isFinite(r.best) && (top === null || r.best < top.best)) top = r;
        if (top) { top.bonus = sc.fastestBonus; top.points += sc.fastestBonus; }
      }
      const result = { heat: H.idx + 1, ...(H.idx >= H.count ? { final: names[H.idx - H.count] } : {}), rows };
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
      const better = (a, b) => (byPoints ? b.points - a.points || b.laps - a.laps : b.laps - a.laps || b.points - a.points) || (a.total ?? Infinity) - (b.total ?? Infinity) || a.heat - b.heat;
      const acc = participants.map((p, i) => {
        const hs = heatsOf[i], ranked = hs.slice().sort(better), f = finalOf[i];
        let counted = ranked;
        if (sc.dropWorst && counted.length >= 2) counted = counted.slice(0, -1);
        if (sc.countBy === 'best') counted = counted.slice(0, sc.bestHeats);
        const sum = (list, k) => list.reduce((t, h) => t + h[k], 0), div = sc.countBy === 'average' && counted.length ? counted.length : 1;
        const all = f ? hs.concat([f]) : hs, best = all.reduce((m, h) => (Number.isFinite(h.best) && (m === null || h.best < m) ? h.best : m), null);
        const heatLaps = sum(counted, 'laps') / div, heatPoints = sum(counted, 'points') / div; // (what the heats count; a final that is added comes on top of it, and is not averaged, dropped or limited to the best heats)
        return { participant: i, ...p, laps: sum(all, 'laps'), points: sum(all, 'points'), best, heats: hs.length,
          counted: counted.length, dropped: hs.filter(h => !counted.includes(h)).map(h => h.heat).sort((x, y) => x - y),
          heatScore: byPoints ? heatPoints : heatLaps, scoreLaps: heatLaps + (added && f ? f.laps : 0), scorePoints: heatPoints + (added && f ? f.points : 0),
          finalName: groupOf[i], finalPos: f ? f.pos : null, finalLaps: f ? f.laps : null, finalPoints: f ? f.points : null,
          wins: counted.filter(h => h.pos === 1).length, time: counted.reduce((t, h) => t + (h.total ?? Infinity), 0) };
      });
      const desc = k => (a, b) => b[k] - a[k], bestAsc = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12), timeAsc = (a, b) => (a.time === b.time ? 0 : a.time - b.time);
      const main = byPoints ? 'scorePoints' : 'scoreLaps', other = desc(byPoints ? 'scoreLaps' : 'scorePoints');
      const chain = [desc(main), ...({ default: [other, bestAsc], bestlap: [bestAsc, other], wins: [desc('wins'), other, bestAsc], time: [timeAsc, other, bestAsc] })[sc.tieBreak]];
      // the A final drivers are placed above the B final drivers, and these above everybody else. In a final that is driven, 'places' puts its drivers in the order of that final.
      const tier = a => (a.finalName === 'A' ? 0 : a.finalName === 'B' ? 1 : 2);
      acc.sort((a, b) => {
        const t = tier(a) - tier(b); if (t) return t;
        if (!added && a.finalPos !== null && b.finalPos !== null) return a.finalPos - b.finalPos;
        for (const f of chain) { const v = f(a, b); if (v) return v; }
        return a.participant - b.participant;
      });
      return acc.map(({ time, ...a }, i) => ({ ...a, pos: i + 1, score: byPoints ? a.scorePoints : a.scoreLaps }));
    };
    return H;
  }

  const api = { fuelUse, goodLaps, penaltyConfig, penaltyMs, fuelConfig, yellowConfig, createRace, createHeatRace, scoringOf, finalsOf, finalSizes, buildSchedule, fmtTime, MIN_LAP };
  root.RaceEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
