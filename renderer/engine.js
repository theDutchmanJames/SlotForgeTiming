// The race rules, kept free of any screen code so they can be tested on their own.
// Times are in milliseconds; the caller passes the current time `t` into every call.
(function (root) {
  const B = typeof module !== 'undefined' ? require('./bop.js') : root.Bop; // Balance of Power: percentages and the way they change the fuel rules of a car
  const W = typeof module !== 'undefined' ? require('./weather.js') : root.Wx; // Weather: the states, the tyres and what wrong tyres cost
  const En = typeof module !== 'undefined' ? require('./endurance.js') : root.Endurance; // Endurance Race: the swaps of drivers
  const Dm = typeof module !== 'undefined' ? require('./damage.js') : root.Damage; // Damage System: the levels of damage and the repair
  const Fl = typeof module !== 'undefined' ? require('./failures.js') : root.Failures; // Car Failures (1.43.0): the random failures of a Damage System
  const Sc = typeof module !== 'undefined' ? require('./safetycar.js') : root.SafetyCar; // Safety Car (1.53.0): the lap target and the shorter pit work while the yellow flag is up
  const Ps = typeof module !== 'undefined' ? require('./pushsave.js') : root.PushSave; // Push and Save (1.54.0): the wear of the tyres and the fuel follows how hard a driver drives
  const Tw = typeof module !== 'undefined' ? require('./tyrewear.js') : root.TyreWear; // Tyre Wear (1.40.0): the life of the tyres, the grip curve and the rules at 0%
  const WeatherBase = W, TyreBase = Tw;
  const Dist = () => (typeof module !== 'undefined' ? require('./distance.js') : root.Distance); // Distance Racing: the lap time to estimate with (looked up when it is needed: distance.js is loaded after this file in the page)
  const MIN_LAP = 800; // crossings closer together than this are treated as double triggers
  const Ph = typeof module !== 'undefined' ? require('./pithold.js') : root.PitHold;
  const Sys = typeof module !== 'undefined' ? require('./racesystems.js') : root.RaceSystems;
  const Res = typeof module !== 'undefined' ? require('./resources.js') : root.Resources;
  const MC = typeof module !== 'undefined' ? require('./multiclass.js') : root.MultiClass;
  const Rival = typeof module !== 'undefined' ? require('./virtualrival.js') : root.VirtualRival;

  function fmtTime(ms) {
    if (ms === null || ms === undefined || ms === '' || !Number.isFinite(Number(ms))) return '–';
    ms = Number(ms); const neg = ms < 0; if (neg) ms = -ms;
    let m = Math.floor(ms / 60000), t = ((ms % 60000) / 1000).toFixed(3);
    if (Number(t) >= 60) { m += 1; t = '0.000'; } // (59.9996 seconds is 1:00.000, not 60.000)
    return (neg ? '-' : '') + (m ? m + ':' + t.padStart(6, '0') : t);
  }

  // Fuel and pit settings from a race setup (missing or empty values get their defaults).
  const num = (v, d) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
  // rule: the fuel rule chosen in the setup (none = no fuel); track supplies the optional
  // shared Fuel reference lap. Without a rule the old inline setup fields still work.
  function fuelConfig(setup, rule, track) {
    const pitHold = num(setup.pitHold, 2) * 1000;
    if (rule) {
      // targetLap/maxExtra/maxSaving belonged to Fuel Systems before 1.87. Keep a saved
      // old rule behaving exactly as it did, but do not apply that retired calculation to a
      // new Track or Manual reference. Push & Save owns new pace-related fuel changes.
      const legacyPace = rule.legacyPace === true || (rule.paceSource === undefined && num(rule.targetLap, 0) > 0);
      const paceSource = rule.paceSource === 'track' || rule.paceSource === 'manual' ? rule.paceSource : 'constant';
      const target = legacyPace ? num(rule.targetLap, num(rule.paceManual, 0)) : paceSource === 'track' ? num(track && track.targetLap, 0) : paceSource === 'manual' ? num(rule.paceManual, 0) : 0;
      return { on: true, tank: num(rule.tank, 120), perLap: num(rule.perLap, 2), rate: num(rule.rate, 10), paceSource, paceTarget: target * 1000, legacyPace, target: legacyPace ? target * 1000 : 0, extra: legacyPace ? num(rule.maxExtra, 25) / 100 : 0, saving: legacyPace ? Math.min(1, num(rule.maxSaving, 30) / 100) : 0,
        empty: ['retire', 'stop', 'warn'].includes(rule.empty) ? rule.empty : 'retire', pitHold };
    }
    const on = setup.fuel === 'on';
    return { on, tank: num(setup.fuelTank, 120), perLap: num(setup.fuelPerLap, 1), rate: num(setup.fuelRate, 10), paceSource: 'constant', paceTarget: 0, legacyPace: false, target: 0, extra: 0, saving: 0,
      empty: ['retire', 'stop', 'warn'].includes(setup.fuelEmpty) ? setup.fuelEmpty : 'retire', pitHold };
  }
  // The yellow flag target lap time of a race setup: retained as a pure legacy
  // reader for old backups; Race Settings no longer supplies it to a new race.
  function yellowConfig(setup) {
    const s = setup || {}, target = Math.round(num(s.yellowTarget, 0) * 1000);
    return { target, points: target > 0 ? Math.floor(num(s.yellowPoints, 1)) : 0 };
  }
  // Retained only for a Fuel System saved before 1.87. New systems use a fixed amount;
  // Push & Save applies its own multiplier when it is enabled.
  const fuelUse = (F, lapMs) => {
    if (!F.target || !(lapMs > 0)) return F.perLap;
    const factor = Math.min(1 + (F.extra || 0), Math.max(1 - (F.saving || 0), F.target / lapMs));
    return Math.round(F.perLap * factor * 1e6) / 1e6;
  };

  // ---- penalties ----
  // system: a penalty system record (or nothing). Points turn into time by "every X points add Y seconds" or by a steps table.
  function penaltyConfig(system) {
    const s = system || {}, n = (v, d) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? d : Number(v));
    if (!system) return { on: false, mode: 'every', every: 5, seconds: 5, steps: [], rules: null, dq: 0, dqUnserved: false, types: [], fuelPoints: 0 };
    // special penalties (Drivethrough, Stop-and-Go...): what they cost in points, how long to stand still, what leaving early and never serving add
    const types = (Array.isArray(s.types) ? s.types : []).filter(t => t && String(t.name || '').trim()).map(t => {
      // A saved pre-1.88 named penalty spent points and could add points for leaving early.
      // Keep that behaviour intact; new named penalties give points and/or an immediate effect.
      if (t.effect === undefined) return { name: String(t.name).trim(), legacy: true, kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo', seconds: Math.max(0, n(t.seconds, 5)), cost: Math.max(0, Math.round(n(t.cost, 0))), extra: Math.max(0, Math.round(n(t.extra, 1))), unserved: Math.max(0, n(t.unserved, 10)) };
      return { name: String(t.name).trim(), legacy: false, points: Math.max(0, Math.round(n(t.points, 0))), effect: ['time', 'laps', 'pit'].includes(t.effect) ? t.effect : 'none', amount: Math.max(0, n(t.amount, 0)) };
    });
    const steps = String(s.steps || '').split(',').map(x => x.split('=').map(y => Number(String(y).trim().replace(',', '.')))).filter(x => x.length === 2 && x.every(Number.isFinite) && x[0] > 0 && x[1] >= 0).sort((a, b) => a[0] - b[0]);
    const rules = Array.isArray(s.rules) ? s.rules.map(r => ({ from: Math.max(1, Math.round(n(r.from, 1))), time: Math.max(0, n(r.time, 0)), laps: Math.max(0, Math.round(n(r.laps, 0))), pit: Math.max(0, n(r.pit, 0)) })).sort((a, b) => a.from - b.from) : null;
    return { on: true, mode: s.timeRule === 'steps' ? 'steps' : 'every', every: Math.max(1, n(s.everyPoints, 5)), seconds: Math.max(0, n(s.everySeconds, 5)), steps, rules, ruleMode: s.ruleMode || '', dq: s.dqOn === 'off' ? 0 : Math.max(0, n(s.dqPoints, 0)), dqUnserved: s.dqUnserved === 'on', types, fuelPoints: Math.max(0, Math.round(n(s.fuelPoints, 0))) };
  }
  // New ladders use the highest reached row as the total consequence. This is deliberately
  // separate from the legacy time rule above, so existing saved championships do not change.
  const penaltyEffects = (P, points) => {
    const out = { time: 0, laps: 0, pit: 0, from: 0 };
    if (!P || !P.on || !Array.isArray(P.rules)) return out;
    P.rules.forEach(r => { if (points >= r.from) Object.assign(out, { time: r.time, laps: r.laps, pit: r.pit, from: r.from }); });
    return out;
  };
  const penaltyMs = (P, points) => {
    if (!P || !P.on || points <= 0) return 0;
    if (Array.isArray(P.rules)) return penaltyEffects(P, points).time * 1000;
    if (P.mode === 'steps') { let s = 0; P.steps.forEach(([p, sec]) => { if (points >= p) s = sec; }); return s * 1000; }
    return Math.floor(points / P.every) * P.seconds * 1000;
  };

  // lap times without the ones over the track's maximum lap time
  const goodLaps = c => c.laps.filter((_, n) => !(c.bad || [])[n] && !(c.invalid || []).includes(n));
  // the laps the live average and median are made of: as in the saved result, without the laps with a stop in the pits and the laps that were taken out of the records
  const averageLaps = c => c.laps.filter((_, n) => !(c.bad || [])[n] && !(c.invalid || []).includes(n) && !(c.pitLaps || []).includes(n) && !(c.removed || []).includes(n));
  // 1.67.0: what a leaderboard that counts over all heats remembers of a participant after a heat: the lap times that count (the average and the median are made of them, in ms rounded to 3 decimals),
  // the metres (m: of this heat, or not a number when the heat does not know them; dn counts the heats that did, n all heats, so the total is only told when every heat knew its metres)
  // 1.68.0: a short text that changes whenever something that is in the result of a race changes (laps, a finish, penalties, corrections, sectors, the other damage that puts a car out): a leaderboard that counts over the rounds makes its order again only then
  const stampOf = race => race.cars.map(c => [c.laps.length, c.done ? 1 : 0, c.total, c.dq ? 1 : 0, c.retired ? 1 : 0, c.dmgOut ? 1 : 0, c.failOut ? 1 : 0, c.points, c.specialLaps, c.adjMs, c.adjLaps, c.adjPoints, c.removed.length, c.invalid.length, c.extraMs, c.sector, c.secOrder, c.best].join(':')).join('|');
  const memoStep = (a, c, m) => { const p = a || { laps: [], dist: 0, dn: 0, n: 0 }; return { laps: p.laps.concat(averageLaps(c).map(t => Math.round(t * 1000) / 1000)), dist: p.dist + (Number.isFinite(m) ? m : 0), dn: p.dn + (Number.isFinite(m) ? 1 : 0), n: p.n + 1 }; };

  // cfg: { type: practice|qualifying|race|timed, laps, duration (minutes), endRule: all|leader, minLap, fuel: fuelConfig(...), entries: [...] }
  function createRace(cfg) {
    if(Rival&&cfg.virtualRivals?.some(e=>e.grid))cfg={...cfg,...Rival.bindGrid(cfg.entries,cfg.virtualRivals)};
    const W = WeatherBase.withTyres(cfg.tyrewear?.tyres), Tw = TyreBase.withTyres(cfg.tyrewear?.tyres);
    let systemsOff = new Set(Sys ? Sys.clean(cfg.systemsDisabled) : []);
    const systemOn = key => !systemsOff.has(key);
    const pitJob = (c, key) => c.pit && c.pit.systemJobs ? !!c.pit.systemJobs[key] : systemOn(key);
    const PH = Ph && cfg.pitControl && Ph.clean(cfg.pitControl), heldPits = PH && PH.mode !== 'follow';
    const skipFirst = !!cfg.skipFirst, type = cfg.type, minLap = cfg.minLap ?? MIN_LAP, maxLap = Number(cfg.maxLap) > 0 ? Number(cfg.maxLap) : 0;
    const P = { on: false, mode: 'every', every: 5, seconds: 5, steps: [], rules: null, dq: 0, dqUnserved: false, types: [], fuelPoints: 0, ...(cfg.penalty || {}) };
    const penOf = c => c.virtualRival ? 0 : penaltyMs(P, c.points) + (c.extraMs || 0); // time penalty: from the points, plus any time the Race Director added
    // What the Race Director corrects in the review (R.adjust): race time (ms), laps and championship points, added to or taken off what the race gave. They are signed amounts, kept apart from the penalties.
    const addOf = c => penOf(c) + (c.adjMs || 0); // everything that is added to the time of the car: the penalty and the adjustment
    const lapsOf = c => c.virtualRival ? c.laps.length : Math.max(0, c.laps.length + (c.adjLaps || 0) - (c.swapLost || 0) - penaltyEffects(P, c.points).laps - (c.specialLaps || 0)); // scoring laps: driven, review adjustment, endurance loss and penalty deductions; never below zero
    // Sectors (1.66.0, cfg.sectors = { count, names }, from the track): in the review after a race or a heat a car that did not finish gets the sector of the track it was last seen in (car.sector, 1 = the sector that starts at the timing line).
    // Among cars that did not finish and have the same laps (the same distance in a race by distance) the later sector ranks higher; two cars in the same sector are put in order by the Race Director (car.secOrder, valid
    // while the laps and the sector are still the ones it was set for: car.secAt); a car without a sector ranks behind those with one, and with no sector at all the order is how it was: who crossed the line first. Only races (laps, distance, time).
    const SEC = (type === 'race' || type === 'timed') && cfg.sectors && Math.floor(Number(cfg.sectors.count)) >= 2
      ? { count: Math.min(12, Math.floor(Number(cfg.sectors.count))), names: (Array.isArray(cfg.sectors.names) ? cfg.sectors.names : []).map(x => String(x === null || x === undefined ? '' : x).trim()) } : null;
    const F = { on: false, tank: 0, perLap: 0, rate: 0, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...(cfg.fuel || {}) };
    // Balance of Power (cfg.bop, see bop.js): only in a race or a timed race that has fuel, because it works through the fuel rules. Every car has its own percentage (car.bop: negative = hindered, positive = helped).
    const BP = cfg.bop && F.on && (type === 'race' || type === 'timed') ? B.clean(cfg.bop) : null, ONE = { use: 1, rate: 1, tank: 1 };
    // Weather (cfg.weather, see weather.js): only in a race or a timed race. The tyres and the penalty points need no fuel; hurting a car on the wrong tyres (WXH) works through the fuel rules, like Balance of Power.
    const WXC = cfg.weather && (type === 'race' || type === 'timed') ? cfg.weather : null, WXH = WXC && F.on && WXC.hinder ? WXC : null;
    // Tyre Wear (cfg.tyrewear, see tyrewear.js): a race or a timed race (heats are those too), and a practice or qualifying when the system says so. The 0% rule and the display need no fuel; the grip curve (TWH) works through the fuel rules, like Balance of Power and the weather.
    const TWC = cfg.tyrewear && cfg.tyrewear.on && (type === 'race' || type === 'timed' || (type === 'practice' && cfg.tyrewear.practice) || (type === 'qualifying' && cfg.tyrewear.qualifying)) ? cfg.tyrewear : null, TWH = TWC && F.on && TWC.effect ? TWC : null;
    const MAND = TWC && TWC.mand && (type === 'race' || type === 'timed') ? TWC.mand : null; // Tyre Wear mandatory stops (1.52.0): null = no rule (also in practice and qualifying)
    const SETS = TWC && TWC.sets && (TWC.sets.mode === 'car' || TWC.sets.mode === 'team') && TWC.sets.n ? TWC.sets : null; // Tyre Wear sets (1.41.0): null = no limit, every stop gives a fresh set
    const hasFx = c => systemOn('fuel') && !!((BP && systemOn('bop') && c.bop) || (WXH && systemOn('weather') && c.wx) || (TWH && systemOn('tyrewear') && c.tw));
    // what the car gets of the fuel rules now: from Balance of Power (car.bop), from the weather (car.wx) and from its tyres (car.tw), all signed whole percentages (negative: hindered), added up lever by lever
    const fx = c => { const bp = systemOn('bop') ? BP : null, wx = systemOn('weather') ? WXH : null, tw = systemOn('tyrewear') ? TWH : null; return !hasFx(c) ? ONE : (wx && c.wx) || (tw && c.tw) ? B.mix([[bp && c.bop ? c.bop : 0, bp], [wx && c.wx ? c.wx : 0, wx && wx.levers], [tw && c.tw ? c.tw : 0, tw && tw.levers]]) : B.factors(c.bop, bp); };
    const tankOf = c => (hasFx(c) ? Math.round(F.tank * fx(c).tank * 1e6) / 1e6 : F.tank); // (rounded: 100 x 1.1 is not 110.00000000000001 on a screen)
    // Safety Car (1.53.0, cfg.safetycar, see safetycar.js): the yellow flag is the Safety Car. A race with a system uses ITS lap target and points instead of the Yellow flag fields of the race setup, and its pit work is shorter (R.block fixes it for the stop).
    const SCC = Sc.fromConfig(cfg.safetycar);
    // Random flags (1.59.0, SCC.rnd, see safetycar.js): the plan (the places and lengths of the yellow flags) is drawn when the race starts (rnRoll) and kept in the snapshot; rnCheck puts the yellow flag up and
    // takes it down by the plan, and sets R.rndSoon for the warning. It does not look at the drivers at all. RN.up: the flag that is up now because of the plan (yEl: where the flag went up on the race clock, liftAt: when it comes
    // down on the race clock, or null when only the Race Director lifts it).
    const RNC = SCC && SCC.rnd ? SCC.rnd : null, rnRnd = cfg.rnd || Math.random;
    const RN = RNC ? { plan: null, unit: 'ms', i: 0, up: null, lastEnd: -1e9, soon: false, warnedFor: -1 } : null;
    // Push and Save: new systems compare a lap with this driver's rolling median;
    // records without mode retain the former reference-lap behaviour.
    const PSC = Ps.fromConfig(cfg.pushsave);
    const tyreCombination = Ps.responsePolicy(TWC?.pace?.response || {}).combine;
    const Y = SCC ? { target: SCC.target, points: SCC.points } : { target: 0, points: 0, ...(cfg.yellow || {}) }; // the yellow flag target lap time (ms; 0 = none) and the penalty points for a full lap under yellow that is faster
    // Endurance Race (cfg.endurance, see endurance.js): only in a race or a timed race. A car whose entry has a roster of two drivers or more swaps drivers; the state of its swaps is car.en.
    const EN = cfg.endurance && cfg.endurance.on && (type === 'race' || type === 'timed') ? { ...cfg.endurance } : null, enRnd = cfg.rnd || Math.random;
    // Damage System (cfg.damage, see damage.js): only in a race or a timed race. A car collects damage points (a hit by the Race Director, a deslot); the level they reach says how long it must stand in the pits.
    const DM = cfg.damage && cfg.damage.on && (type === 'race' || type === 'timed') ? cfg.damage : null;
    // Car Failures (cfg.damage.failures, see failures.js): a part of the Damage System. Every car is rolled for them when the race starts; a failure starts at its moment and the stop in the pits clears it.
    const FL = DM && DM.failures && DM.failures.on && DM.failures.list.length ? DM.failures : null, flRnd = cfg.rnd || Math.random;
    // Distance Racing (cfg.distance, see distance.js): a race by laps whose lanes drive the laps that make up a distance, so a lane may have to drive more laps than another. Only in a race.
    // DS.lanes[lane] = { length (metres), laps }. The longest time the race may take (DS.max, minutes; 0 = no limit) ends it like the time of a timed race: every car finishes on its next crossing.
    const DS = cfg.distance && type === 'race' && Array.isArray(cfg.distance.lanes) && cfg.distance.lanes.length ? cfg.distance : null;
    // 1.64.0: a timed race (a race, a heat or an Endurance Race limited by a time) whose cars are compared by the distance they drove (cfg.compare = { by: 'distance', lanes: [{ lane, length }] }, see distance.js):
    // the laps times the length of the lane decide the order, and with the same distance the lowest time. It needs the length of every lane: without, the cars are compared by laps. The race itself ends as before (when the time is up).
    const TDS = type === 'timed' && cfg.compare && cfg.compare.by === 'distance' && Array.isArray(cfg.compare.lanes) && cfg.compare.lanes.length && cfg.compare.lanes.every(l => Number(l && l.length) > 0) ? cfg.compare : null;
    const LS = DS || TDS; // the lanes with a length: a Distance Race, or a timed race compared by distance
    const dsLane = c => (LS ? LS.lanes[Math.max(0, Math.min(LS.lanes.length - 1, c.lane | 0))] : null);
    const lenOf = c => { const d = dsLane(c); return d ? Number(d.length) || 0 : 0; };
    const lapLimit = type === 'race' ? (DS ? Math.max(0, ...DS.lanes.map(l => Number(l.laps) || 0)) || Number(cfg.laps) || 0 : Number(cfg.laps) || 0) : 0;
    const limitOf = c => { const d = dsLane(c); return d && Number(d.laps) > 0 ? Number(d.laps) : lapLimit; }; // the laps this car has to drive (0: no limit)
    const timeLimit = (type === 'timed' || type === 'qualifying') ? (Number(cfg.duration) || 0) * 60000 : DS && Number(DS.max) > 0 ? Number(DS.max) * 60000 : 0;
    let startingRules = JSON.parse(JSON.stringify({ ...cfg, entries: undefined, rnd: undefined }, (_, v) => typeof v === 'function' ? undefined : v));
    const R = {
      cfg, rulesSnapshot: () => ({ version: 1, config: JSON.parse(JSON.stringify(startingRules)) }), fuel: F, penalty: P, type, status: 'ready', t0: 0, pausedAt: 0, endAt: 0, timeUp: false, finished: 0, endedBy: '',
      yellow: Y, yellowAt: null, // yellowAt: when the yellow flag that is up now went up (a lap that started before that is not a lap under yellow)
      cars: cfg.entries.map(e => ({ ...e, laps: [], bad: [], points: 0, undoPoints: 0, dq: false, pending: [], served: [], extraMs: 0, specialLaps: 0, penaltyPitTiers: [], adjMs: 0, adjLaps: 0, adjPoints: 0, invalid: [], removed: [], yellowFast: [], ps: [], psNow: null, fuelSamples: [], pitLaps: [], servedNow: false, last: 0, total: 0, best: null, done: false, place: 0, retired: false, sector: null, secOrder: null, secAt: '', fuel: F.on ? F.tank : 0, outOfFuel: false, bop: 0, bopHold: false, bopTo: null, tyreOwn: W.cleanTyre(e.tyre), tyre: W.cleanTyre(e.tyre), wx: 0, wxDue: null, twLife: 100, tw: 0, twStops: 0, twDoneAt: null, twPace: [], twPaceNow: null,
        blockAt: null, pit: null, pits: [], lastPit: null, outlap: false, rndPitExit: false, started: !skipFirst, swapLost: 0, swapLaps: [], psPace: [], dmg: 0, dmgTotal: 0, dmgLvl: -1, dmgDue: null, dmgOut: '', repairs: [], repairMs: 0, repairedAt: null, ...(FL ? { fail: null, failN: 0, failures: [], failMs: 0, failOut: '', flPlan: null } : {}), en: EN && Array.isArray(e.roster) && e.roster.length >= 2 ? En.newCar(EN, e.roster, e.driverId) : null })),
      events: [], // what happened, in order: { type, car, t } (outoffuel, retired, pitstart, fuelfull, pitend, call, callend...)
      calls: [] // calls from a lane to the Race Director: { id, car, t, open, how }; how a call ended: 'penalty' or 'dismiss'
    };
    R.twTeams = {}; // the sets that are left of a team that shares them (Tyre Wear): { teamId: { H: 2, M: 1, ... } }
    let callId = 0;
    const log = (type, i, t, data) => {
      const event = { type, car: i, t, raceMs: Math.max(0, R.elapsed ? R.elapsed(t) : 0), lane: R.cars[i]?.lane ?? -1, driverName: R.cars[i]?.driverName || '', ...data };
      R.events.push(event); return event;
    };
    R.logEvent = log; // Attached systems use the same frozen driver identity and race clock.

    const end = (t, why) => { R.cars.forEach(c=>tempUpdate(c,t)); R.cars.forEach((c, i) => { wxFlush(i, t, true); if (c.blockAt !== null) { pitCheck(i, t); serveCheck(i, t); repairCheck(i, t); twCheck(i, t); closePit(i, t); } if (MAND && why !== 'Stopped') msJudge(c, i, t); }); if (P.dqUnserved && why !== 'Stopped') R.cars.forEach((c, i) => { if (!c.dq && c.pending.some(p => p.mandatory)) { c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, t, { why: 'unserved' }); } }); R.status = 'finished'; R.endAt = t; R.endedBy = why; R.flag = ''; R.yellowAt = null; if (scWas) scEdge(t); R.calls.forEach(c => { c.open = false; }); enEnd(t, why); };
    const checkEnd = t => {
      if (R.status !== 'running') return;
      if (type === 'race' && cfg.endRule === 'leader' && R.finished > 0) return end(t, 'The lead car finished');
      const limited = lapLimit || timeLimit;
      if (limited && R.cars.every(c => c.done) && (type === 'race' || R.timeUp)) end(t, 'Every car finished');
    };

    R.elapsed = t => R.status === 'running' ? t - R.t0 : R.status === 'paused' ? R.pausedAt - R.t0 : R.status === 'finished' ? R.endAt - R.t0 : 0;
    const systemAvailable = { penalty: P.on, damage: !!DM, fuel: F.on, bop: !!BP, weather: !!WXC, tyrewear: !!TWC, safetycar: !!SCC, pushsave: !!PSC };
    const jobFlags = () => Object.fromEntries(Object.keys(systemAvailable).map(k => [k, !!systemAvailable[k] && systemOn(k)]));
    const systemMark = t => ({ elapsed: R.elapsed(t), leader: leaderLaps(), random: RN && R.status !== 'ready' ? rnPos(t).pos : 0, laps: R.cars.map(c => c.laps.length) });
    R.systemEnabled = key => !!systemAvailable[key] && systemOn(key);
    R.systemsOf = () => Object.fromEntries(Object.entries(systemAvailable).map(([key, available]) => [key, { available: !!available, enabled: !!available && systemOn(key), effective: !!available && systemOn(key) && (key !== 'bop' || systemOn('fuel')) }]));
    R.syncSystems = state => {
      if (state) R.systemState = state;
      systemsOff = new Set(Sys ? Sys.clean(state ? state.disabled : cfg.systemsDisabled) : []);
      R.fuel = systemOn('fuel') ? F : { ...F, on: false }; R.penalty = systemOn('penalty') ? P : { ...P, on: false };
      R.bop = systemOn('bop') && systemOn('fuel') ? BP : null; R.weather = systemOn('weather') ? WXC : null;
      R.tyrewear = systemOn('tyrewear') ? TWC : null; R.damage = systemOn('damage') ? DM : null; R.failures = systemOn('damage') ? FL : null;
      R.safetyCar = systemOn('safetycar') ? SCC : null; R.randomFlags = systemOn('safetycar') ? RNC : null; R.pushSave = systemOn('pushsave') ? PSC : null;
      Object.assign(Y, systemOn('safetycar') && SCC ? { target: SCC.target, points: SCC.points } : { target: 0, points: 0, ...(cfg.yellow || {}) });
      if (state && state.weatherPlan) R.wxPlan = state.weatherPlan;
    };
    R.setSystem = (key, enabled, t) => {
      if (!systemAvailable[key] || typeof enabled !== 'boolean' || systemOn(key) === enabled || !['ready', 'running', 'paused'].includes(R.status) || !Number.isFinite(t)) return false;
      if (R.status === 'running') R.tick(t);
      if (!['ready', 'running', 'paused'].includes(R.status)) return false;
      // Settle the old thermal state before changing its enabled/ambient policy.
      R.cars.forEach(c => tempUpdate(c,t));
      R.cars.forEach(c => { if (c.pit && !c.pit.systemJobs) c.pit.systemJobs = jobFlags(); });
      const state = R.systemState || (R.systemState = { disabled: [], marks: {} }); state.marks = state.marks || {};
      if (!enabled) { state.marks[key] = systemMark(t); systemsOff.add(key); if (key === 'weather') R.cars.forEach(c => { c.wxHold = undefined; }); if (key === 'safetycar') { R.rndSoon = false; if (RN) RN.soon = false; clearRandomPitExit(t); } }
      else {
        const m = state.marks[key] || { elapsed: 0, leader: 0, random: 0, laps: R.cars.map(() => 0) }, elapsed = Math.max(0, R.elapsed(t) - m.elapsed), lead = Math.max(0, leaderLaps() - m.leader);
        if (key === 'weather' && R.wxPlan) { R.wxPlan.stages.slice(R.wxStage).forEach(s => { s.at += R.wxPlan.unit === 'laps' ? lead : elapsed; }); state.weatherPlan = R.wxPlan; }
        R.cars.forEach((c, i) => { const laps = Math.max(0, c.laps.length - ((m.laps || [])[i] || 0));
          if (key === 'weather' && c.wxDue) c.wxDue.lap += laps;
          if (key === 'damage') { if (c.dmgDue !== null) c.dmgDue += laps; if (c.fail && c.fail.due !== null) c.fail.due += laps; (c.flPlan || []).forEach(p => { p.at += limitOf(c) > 0 ? laps : elapsed; }); }
        });
        if (key === 'safetycar' && RN && RN.plan) { const shift = RN.unit === 'laps' ? Math.max(0, rnPos(t).pos - m.random) : elapsed; RN.plan.slice(RN.i).forEach(p => { p.at += shift; }); if (RN.up && RN.up.liftAt !== null) RN.up.liftAt += elapsed; RN.lastEnd += elapsed; }
        systemsOff.delete(key); delete state.marks[key];
      }
      state.disabled = [...systemsOff]; R.syncSystems(state);
      if (enabled && ['fuel', 'weather', 'tyrewear'].includes(key)) R.cars.forEach(c => { wxRefresh(c); twRefresh(c); });
      if (key === 'fuel') R.cars.forEach(c => { c.fuelSamples = []; });
      if (key === 'safetycar') scEdge(t);
      log('systemtoggle', -1, t, { system: key, enabled, at: R.elapsed(t) });
      return true;
    };
    R.temperatureRecovered = false;
    const tempWeather = () => systemOn('weather') ? R.wxState : 'dry';
    function thermalConfig() {
      const cfg=TWC?.temperature;
      if(!cfg || cfg.ambientSource==='manual' || !WXC || !systemOn('weather'))return cfg;
      return {...cfg,ambient:Object.fromEntries(Object.keys(cfg.ambient).map(k=>[k,W.conditionsFor(WXC,k,null,'metric')?.air??cfg.ambient[k]]))};
    }
    function tempValue(c,t) {
      if (!TWC?.temperature) return null;
      const TC=TWC.temperature, s=Tw.Temperature.settings(TC,c.tyre), value=Number.isFinite(c.twTemp)?c.twTemp:s.start;
      const cooling=R.status==='paused'||(R.status==='running'&&(c.blockAt!==null||R.flag==='yellow'));
      return cooling && systemOn('tyrewear') && !c.done && !c.retired && !R.temperatureRecovered
        ? Tw.Temperature.cool(thermalConfig(),c.tyre,value,Math.max(0,t-(c.twTempAt??t))/1000,tempWeather()) : value;
    }
    function tempUpdate(c,t) { if (!TWC?.temperature) return; c.twTemp=tempValue(c,t); c.twTempAt=t; }
    function tempReset(c,t) { if (!TWC?.temperature) return; c.twTemp=Tw.Temperature.settings(TWC.temperature,c.tyre).start;c.twTempAt=t;c.twTempWear=1; }
    R.start = t => { if(R.resourceStart&&!R.resourceStart())return false; R.status = 'running'; R.t0 = t; R.cars.forEach(c => { c.last = t; tempReset(c,t); twRefresh(c); if (F.on && hasFx(c)) c.fuel = tankOf(c); }); wxEval(t); flRoll(); rnRoll(); }; // (a car that has Balance of Power, or tyres that help or hinder it, before the start begins with a full tank of its own size)
    R.pause = t => { if (R.status === 'running') { if (heldPits) R.tick(t); if (R.status !== 'running') return;
      if (R.flag === 'red') R.cars.forEach((c, i) => { if (!c.done && c.started) { c.redInterrupted = true; c.resumed = true; const ms = Math.min(3600, num(cfg.redFlagSeconds, 0)) * 1000; if (ms) c.extraMs += ms; log('redlap', i, t, { lap: c.laps.length + 1, ms }); } });
      R.cars.forEach(c=>tempUpdate(c,t)); R.status = 'paused'; R.pausedAt = t; } };
    R.resume = t => {
      if (R.status !== 'paused') return;
      R.cars.forEach(c=>tempUpdate(c,t)); R.temperatureRecovered=false;
      const d = t - R.pausedAt; // the paused time does not count
      R.t0 += d; if (R.yellowAt !== null) R.yellowAt += d;
      R.cars.forEach(c => { // (what is tied to the moment the car stopped moves with it: the swap and the repair of this stop)
        const rep = c.blockAt !== null && c.repairedAt === c.blockAt, sw = c.blockAt !== null && c.enSwapAt === c.blockAt, tyd = c.blockAt !== null && c.twDoneAt === c.blockAt;
        for(const job of Object.keys(c.resourceBlocks||{}))if(c.resourceBlocks[job]===c.blockAt)c.resourceBlocks[job]+=d;
        c.last += d; if (c.blockAt !== null) c.blockAt += d; if (rep) c.repairedAt = c.blockAt; if (tyd) c.twDoneAt = c.blockAt; if (sw) { c.enSwapAt = c.blockAt; if (c.enSwapDoneAt !== undefined) c.enSwapDoneAt += d; } if (c.pit) c.pit.start += d;
      });
      R.status = 'running';
      if (R.flag === 'red') { R.flag = ''; log('raceflag', -1, t, { flag: '', by: 'resume' }); } // resuming also clears a red flag
    };
    // Yellow: only a caution, timing carries on. Red: pauses the race until it is cleared or the race is resumed.
    // Pressing the same flag again clears it.
    R.flag = '';
    // The Safety Car is out while the yellow flag is up (only in a race that has a Safety Car system). Every time that changes it is logged (event 'safetycar': out, and the laps the leader had driven).
    R.safetyCar = SCC; // the settings (or null: this race has no Safety Car system)
    R.pushSave = PSC; // the Push and Save settings (or null: this race has none)
    R.psRef = c => (PSC && c ? psRef(c) : { ms: 0, src: '' }); // the pace benchmark of a car now
    // what the screens show of the pace of car c: the last lap's pace, what the tyres and the fuel are used up by now (a lap), what is usual, and how many laps they last at this pace; null without a system
    R.psInfo = c => {
      if (!PSC || !c) return null;
      const now = c.psNow || { p: null, k: 'normal', t: 1, f: 1, w: 'early' }, ref = psRef(c);
      const tUsual = TWC && c.twLife > 0 ? Tw.wearPerLap(TWC, c.tyre, systemOn('weather') ? R.wxState : 'dry', TWC.laneLen[c.lane] || 0) : 0, fUsual = F.on ? F.perLap * fx(c).use : 0;
      const tNow = tUsual * now.t * (TWC?.temperature ? c.twTempWear || 1 : 1), fNow = fUsual * now.f;
      return { kind: now.k, p: now.p, why: now.w, tyres: now.t, fuel: now.f, ref: ref.ms, src: ref.src, tyreUsual: tUsual, tyreNow: tNow, fuelUsual: fUsual, fuelNow: fNow,
        tyreLaps: tNow > 0 ? c.twLife / tNow : null, fuelLaps: fNow > 0 ? c.fuel / fNow : null };
    };
    R.scOut = () => !!SCC && systemOn('safetycar') && R.flag === 'yellow';
    let scWas = false;
    const scEdge = t => { const now = R.scOut(); if (now === scWas) return; scWas = now; log('safetycar', -1, t, { out: now, laps: R.cars.reduce((m, c) => Math.max(m, c.laps.length), 0) }); };
    // A Random Flag can keep a Service Stop open at the pit exit. It deliberately has no effect without the Service Stop system: a timing interface can observe a sensor, but cannot safely hold a real car on its own.
    const randomPitExit = () => !!(RN && RN.up && RNC && RNC.pitExit && heldPits && systemOn('safetycar'));
    const clearRandomPitExit = t => R.cars.forEach((c, i) => { if (c.rndPitExit) { c.rndPitExit = false; if (c.pitHold && R.status === 'running') holdCheck(i, t); } });
    const scFactor = () => (R.scOut() ? Sc.factor(SCC) : 1); // how long the work of a stop that begins now takes, as a part of the usual time
    R.setFlag = (kind, t) => {
      if(['running','paused'].includes(R.status))R.cars.forEach(c=>tempUpdate(c,t));
      if (R.status === 'finished' || R.status === 'ready') return;
      const was = R.flag;
      if (kind === 'red') {
        if (R.flag === 'red') { R.flag = ''; R.resume(t); } else { R.flag = 'red'; R.yellowAt = null; R.pause(t); }
      } else if (kind === 'yellow' && R.flag !== 'red') { if (R.flag === 'yellow') { R.flag = ''; R.yellowAt = null; } else { R.flag = 'yellow'; R.yellowAt = t; } }
      if (R.flag !== was) log('raceflag', -1, t, { flag: R.flag, by: 'director' });
      scEdge(t);
    };
    // A call from the lane of car i (a marshal call button): the yellow flag goes up, unless a flag is already up (a yellow is never switched off by a call), and the call waits for the
    // Race Director. A lane that calls again while its call is still waiting does not make a second call. Returns the call, or null when the race is not running.
    R.call = (i, t) => {
      if (!R.cars[i] || !['running', 'paused'].includes(R.status)) return null;
      if (R.flag === '') { R.cars.forEach(c=>tempUpdate(c,t)); R.flag = 'yellow'; R.yellowAt = t; log('raceflag', -1, t, { flag: 'yellow', by: 'call' }); scEdge(t); }
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
    R.stop = t => { if (R.status === 'running' || R.status === 'paused') { R.cars.forEach(c=>tempUpdate(c,t)); end(R.status === 'paused' ? R.pausedAt : t, 'Stopped'); } }; // (a race stopped while it is paused ends where its clock stands: the pause is not racing time)
    R.tick = t => {
      if (R.status === 'running') R.cars.forEach(c=>tempUpdate(c,t));
      if (R.status === 'running') R.cars.forEach((_, i) => { pitCheck(i, t); if (heldPits) holdCheck(i, t); serveCheck(i, t); enEval(i, t); flCheck(R.cars[i], i, t); repairCheck(i, t); twCheck(i, t); wxFlush(i, t); });
      rnCheck(t);
      if (R.status === 'running' && timeLimit && !R.timeUp && t - R.t0 >= timeLimit) R.timeUp = true;
      wxEval(t);
      if (R.status === 'running') R.cars.forEach((_, i) => fuelNotice(i, t));
      checkEnd(t);
    };
    // After the time is up, each car finishes on its next crossing, and that lap still counts.
    // o.holdDue (a Trackmate sensor, which is also where a car stops for the pits): the car may be on its way into the pits, which is only known when the sensor stays covered, so the penalty for tyres that are due
    // waits for that (see wxFlush). Everything else about the crossing is counted at once.
    R.cross = (i, t, o) => {
      if (R.status !== 'running') return false;
      const c = R.cars[i];
      if (!c || c.done) return false;
      if (heldPits && (c.pitHold || c.pitRearm)) return false;
      const fuelOn = F.on && systemOn('fuel');
      wxFlush(i, t, true);
      if (!c.started) { c.started = true; c.last = t; return false; } // the car starts just behind the line: its first crossing only starts the timing
      const dt = t - c.last, lapStart = c.last;
      if (dt < minLap) return false;
      R.tick(t);
      const pse = PSC && systemOn('pushsave') ? psLap(c, dt, lapStart) : null; // (what the pace of this lap does to the wear)
      const use = fx(c).use, need = !fuelOn ? 0 : PSC ? Math.round(F.perLap * (pse ? pse.fuel : 1) * use * 1e6) / 1e6 : (use === 1 ? fuelUse(F, dt) : Math.round(fuelUse(F, dt) * use * 1e6) / 1e6); // litres this lap took (a car with Balance of Power uses more or less)
      const fuelShort = fuelOn && c.fuel < need - 1e-9; // the tank did not hold enough for this lap
      if (fuelShort) { // not enough fuel to have driven this lap
        if (!c.outOfFuel) { c.outOfFuel = true; log('outoffuel', R.cars.indexOf(c), t); }
        if (F.empty === 'retire') { c.done = true; c.retired = true; log('retired', R.cars.indexOf(c), t); checkEnd(t); return false; }
        if (F.empty === 'stop') return false; // the lap does not count until the car has refuelled
      }
      const twGone = !!TWC && systemOn('tyrewear') && c.twLife <= 0; // the tyres were worn out when this lap began
      if (twGone && TWC.zero === 'lap') return false; // the lap does not count until the car has pitted and has new tyres
      if (twGone && TWC.zero === 'retire') { c.done = true; c.retired = true; log('retired', i, t, { why: 'tyres' }); checkEnd(t); return false; }
      if (fuelOn) c.fuel = Math.max(0, Math.round((c.fuel - need) * 1e6) / 1e6);
      fuelNotice(i, t);
      const pitLap = c.outlap; c.outlap = false; // (the lap in which the car stood in the pits)
      const wasResumed = !!c.resumed, slow = (maxLap > 0 && dt > maxLap) || wasResumed; c.resumed = false; // too slow to be a real lap time: it counts as a lap, but is left out of best laps and averages
      if (fuelShort && F.empty === 'warn' && P.fuelPoints > 0) R.addPoints(R.cars.indexOf(c), P.fuelPoints, t); // a car that carries on with an empty tank gets the points of the penalty system for every such lap
      if (pitLap) c.pitLaps.push(c.laps.length);
      const deslot = DM && DM.deslotMs > 0 && dt > DM.deslotMs && !pitLap && !wasResumed && !c.dmgOut; // (a lap with a stop in the pits, or the first lap after a resume, is slow for other reasons)
      const wasRedInterrupted = !!c.redInterrupted;
      if (c.redInterrupted) { c.invalid.push(c.laps.length); (c.redLaps || (c.redLaps = [])).push(c.laps.length); c.redInterrupted = false; }
      // Keep bounded, actual consumption samples for the range display. Never reconstruct
      // historical use from today's fuel/weather/pace settings.
      if (fuelOn && !fuelShort && !pitLap && !slow && !wasRedInterrupted && need > 0) {
        c.fuelSamples = (c.fuelSamples || []).concat({ lap: c.laps.length, used: need }).slice(-20);
      }
      ensurePaceEligibility(c);
      const paceClean = !pitLap && !slow && !wasRedInterrupted && !(R.flag === 'yellow' && R.yellowAt !== null && lapStart >= R.yellowAt);
      c.paceEligibility.push({ ps: !!PSC && PSC.mode === 'median' && paceClean, tw: !!TWC && systemOn('tyrewear') && paceClean });
      c.laps.push(dt); c.bad.push(slow); c.last = t; c.total = t - R.t0;
      if (pse) { c.psNow = { p: pse.p, k: pse.kind, t: pse.tyres, f: pse.fuel, w: pse.why }; (c.ps || (c.ps = [])).push(c.psNow); } // (kept for every lap: the lap review and the folder)
      if (PSC && !pse) { c.psNow = null; c.ps.push(null); }
      // The current lap never moves its own pace benchmark. Only clean green laps are kept.
      if (PSC && PSC.mode === 'median' && paceClean) (c.psPace || (c.psPace = [])).push(dt);
      if (c.en && c.en.lost) { c.swapLost++; c.swapLaps.push(c.laps.length - 1); } // a swap that was refused: this lap is driven, but it does not count
      if (!slow && !wasRedInterrupted && (c.best === null || dt < c.best)) c.best = dt;
      // the yellow flag target: a lap that began after the yellow flag went up, and ended with it still up, must not be faster than the target (a lap that was part green does not count)
      if (Y.target > 0 && R.flag === 'yellow' && R.yellowAt !== null && lapStart >= R.yellowAt && dt < Y.target) {
        const i = R.cars.indexOf(c), e = log('yellowfast', i, t, { lap: c.laps.length, ms: dt, target: Y.target, points: 0 }); // (logged before the penalty, so it is called out first)
        c.yellowFast.push(c.laps.length - 1);
        if (Y.points > 0 && R.addPoints(i, Y.points, t)) e.points = Y.points;
      }
      if (!c.dq && ((limitOf(c) && c.laps.length - c.swapLost >= limitOf(c)) || (timeLimit && R.timeUp))) { c.done = true; c.place = ++R.finished; } // a car disqualified on this lap (fuel points) has not finished
      if (DM) { damageLap(c, R.cars.indexOf(c), t, deslot); flCheck(c, i, t); }
      if (TWC && systemOn('tyrewear')) twLap(c, i, t, twGone, dt, paceClean);
      if (TWC && !systemOn('tyrewear')) { const st = twStint(c); st.laps++; st.m += TWC.laneLen[c.lane] || 0; st.life = c.twLife; }
      if (MAND && c.done) msJudge(c, i, t); // (a car that has finished is judged for the mandatory stops, after its last lap was counted; the end of the race is checked at the end of this crossing)
      wxEval(t); if (!wxEntering) { if (o && o.holdDue && WXC && c.wxDue && c.laps.length >= c.wxDue.lap) c.wxHold = t; else wxDueCheck(c, i, t); } // (a car that comes into the pits on this crossing is judged by its stop, or by its next crossing)
      enEval(R.cars.indexOf(c), t); // (the laps of a stint are counted: a swap that is due by laps, or a swap by the sensor, may come with this crossing)
      bopEval(t);
      checkEnd(t);
      return true;
    };

    // A new stint on a lane (time tokens): the car of this lane starts again with nothing driven (and, when given, for another driver). Its first crossing only starts the timing.
    // The car object stays the same one, so everything that points to it keeps working.
    R.restartCar = (i, t, who) => {
      const c = R.cars[i]; if (!c) return false;
      if (c.redInterrupted !== undefined) c.redInterrupted = false; if (c.redLaps) c.redLaps = []; if (c.resumed !== undefined) c.resumed = false;
      Object.assign(c, who || {}, { laps: [], bad: [], points: 0, undoPoints: 0, dq: false, pending: [], served: [], extraMs: 0, specialLaps: 0, penaltyPitTiers: [], adjMs: 0, adjLaps: 0, adjPoints: 0, invalid: [], removed: [], yellowFast: [], ps: [], psNow: null, fuelSamples: [], pitLaps: [], servedNow: false, last: t, total: 0, best: null, done: false, place: 0, retired: false,
        fuel: F.on ? F.tank : 0, pitFuelLevel: 0, outOfFuel: false, blockAt: null, pit: null, pits: [], lastPit: null, outlap: false, rndPitExit: false, twPace: [], twPaceNow: null, psPace: [], paceEligibility: [], started: false });
      return true;
    };

    // ---- pit stops ----
    // A car stopping on the sensor breaks the beam: that counts as a normal crossing. Once the sensor has been
    // blocked for pitHold, the pit stop starts (refuelling begins). The stop lasts until the car leaves.
    function pitCheck(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null || c.pit || t - c.blockAt < F.pitHold) return;
      c.resourceBlocks = {}; c.resourceBlocked = ''; // Blocked work belongs to this stop, not a previous visit.
      const quick = !!TWC && systemOn('tyrewear') && TWC.changeMs <= 0; // Tyre Wear without a time to change tyres: the fresh set is on from the start of the stop
      const tyres = TWC && systemOn('tyrewear') ? null : wxTyres(c,c.blockAt+F.pitHold); // (the tyres are changed when the stop starts; with Tyre Wear: at once when it takes no time, else when the time is up: twCheck)
      const fit = quick ? twFit(c,c.blockAt+F.pitHold) : null;
      if(quick)tempUpdate(c,t); // (the new set is on before the stop works out the refuelling speed and the tank)
      c.pit = { start: c.blockAt + F.pitHold, fuel0: c.fuel, full: false, ...(hasFx(c) ? { rate: F.rate * fx(c).rate, tank: tankOf(c) } : {}) }; // (the refuelling speed and the tank of a car with Balance of Power are fixed for the whole stop)
      if (R.systemState) c.pit.systemJobs = jobFlags();
      if ((c.scf || 1) !== 1) c.pit.rate = (c.pit.rate ?? F.rate) / c.scf; // (under the Safety Car the tank fills faster: the work takes less time)
      if (heldPits) {
        c.pitHold = Ph.begin(c.pit.start - R.t0, c.pitSensor);
        const rate = c.pit.rate ?? F.rate, need = Math.max(0, (c.pit.tank ?? F.tank) - c.fuel), lv = dmgLevel(c), fj = flJob(c), duration = PH.seconds * 1000;
        c.pit.work = Ph.servicePlan({ fuel: F.on && pitJob(c, 'fuel') && need > 0 ? (rate > 0 ? need / rate * 1000 : duration) : 0,
          repair: pitJob(c, 'damage') ? Math.max(lv ? lv.ms : 0, fj ? fj.ms : 0) * (c.scf || 1) : 0, repairAdd: PH.work === 'add' || (PH.work === 'systems' && !!DM && DM.stop === 'add'),
          tyres: TWC && pitJob(c, 'tyrewear') ? TWC.changeMs * (c.scf || 1) : 0, tyreAdd: PH.work === 'add' || (PH.work === 'systems' && !!TWC && TWC.stop === 'add') }, duration);
        if (F.on && need > 0) c.pit.rate = need / Math.max(1, c.pit.work.fuel) * 1000;
        holdPenalty(c);
      }
      log('pitstart', i, c.pit.start);
      if (tyres) log('tyres', i, c.pit.start, tyres);
      if (fit) twFitLog(i, c.pit.start, 0, fit);
    }
    function fuelAt(i, t) {
      const c = R.cars[i];
      if (!F.on || (!systemOn('fuel') && !(c.pit && pitJob(c, 'fuel')))) return null;
      if (!c.pit || !pitJob(c, 'fuel')) return c.fuel;
      const te = R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t;
      return Math.min(c.pit.tank ?? F.tank, c.pit.fuel0 + (c.pit.rate ?? F.rate) * Math.max(0, te - c.pit.start) / 1000);
    }
    function fuelNotice(i, t) {
      const c = R.cars[i];
      if (!systemOn('fuel') || !F.on || c.virtualRival || c.virtual) return;
      const fuel = fuelAt(i, t), tank = tankOf(c), percent = tank > 0 && fuel !== null ? fuel / tank * 100 : NaN;
      if (!Number.isFinite(percent)) return;
      const level = percent <= 10 ? 2 : percent <= 25 ? 1 : 0, before = c.pitFuelLevel || 0;
      if (level === before) return;
      c.pitFuelLevel = level;
      log(level > before ? 'fuelwarning' : 'fuelrecovered', i, t, { level, percent });
    }
    function closePit(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null) return;
      const wasHeld = heldPits && !!c.pitHold;
      if (c.pit) {
        const fuelWork = F.on && pitJob(c, 'fuel'), fuel = fuelWork ? fuelAt(i, t) : c.fuel, got = fuelWork ? fuel - c.pit.fuel0 : 0;
        if (fuelWork) { c.fuel = fuel; if (c.fuel >= F.perLap * (1 - (F.saving || 0)) * fx(c).use - 1e-9) c.outOfFuel = false; }
        if (fuelWork) fuelNotice(i, t); // A sensor exit can refill between two timer ticks.
        c.lastPit = { at: c.blockAt, duration: t - c.blockAt, refuelled: Math.round(got * 1000) / 1000 };
        c.pits.push(c.lastPit); c.outlap = true;
        log('pitend', i, t, { duration: c.lastPit.duration, refuelled: c.lastPit.refuelled });
      }
      c.blockAt = null; c.pit = null;
      if (wasHeld) { c.pitHold = null; c.pitRearm = c.pitSensor !== false; }
    }
    R.fuelOf = fuelAt;
    R.factorsOf = i => (R.cars[i] ? fx(R.cars[i]) : ONE); // how much more or less fuel car i uses, how much slower or faster it refuels, and how big its tank is (Balance of Power and the weather together)
    R.tankOf = i => (R.cars[i] ? tankOf(R.cars[i]) : F.tank); // the size of the tank of car i (smaller or bigger with Balance of Power)

    // ---- Balance of Power ----
    R.bop = BP; // the settings (or null: this race has no Balance of Power)
    R.bopActive = false; R.bopSpread = 0; // at the last look: was the difference between the fastest and slowest car big enough, and how big (seconds)
    // Give car i a percentage (negative: hindered, positive: helped, 0: none). It counts from the next lap and the next pit stop. Every change is in the race log.
    R.bopSet = (i, pct, t, by) => {
      const c = R.cars[i]; if (!BP || !c || !systemOn('bop') || !systemOn('fuel') || R.status === 'finished') return false;
      const n = Math.round(Math.max(-B.MAXP, Math.min(B.MAXP, Number(pct) || 0))), was = c.bop || 0;
      if (n === was) return false;
      c.bop = n === 0 ? 0 : n;
      if (F.on && !c.pit) c.fuel = Math.min(c.fuel, tankOf(c)); // a tank that gets smaller keeps only what fits
      log(!was ? 'bopon' : !n ? 'bopoff' : 'bopchange', i, t || 0, { pct: c.bop, lap: c.laps.length, by: by || 'director', ...(was && n ? { was } : {}) });
      return true;
    };
    // What the Race Director presses for a lane: hinder, help, off (these stay until he says auto), auto (the system decides again), accept (take over the suggestion)
    R.bopPress = (i, how, t) => {
      const c = R.cars[i]; if (!BP || !c || !systemOn('bop') || !systemOn('fuel')) return false;
      if (how === 'hinder' || how === 'help' || how === 'off') { c.bopHold = true; return R.bopSet(i, how === 'off' ? 0 : how === 'hinder' ? -BP.percent : BP.percent, t, 'director'); }
      if (how === 'auto') { c.bopHold = false; return BP.mode === 'auto' && typeof c.bopTo === 'number' ? R.bopSet(i, c.bopTo, t, 'auto') : false; }
      if (how === 'accept') return typeof c.bopTo === 'number' && R.bopSet(i, c.bopTo, t, 'accepted');
      return false;
    };
    // After every lap: the pace of every car still racing, who should get how much (suggested, or applied in automatic mode). Not under a flag, and not before two cars have enough laps.
    function bopEval(t) {
      if (!systemOn('bop')) return;
      if (!BP || !systemOn('fuel') || BP.mode === 'manual' || R.status !== 'running' || R.flag) return;
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
      if (!systemOn('weather')) return;
      if (!WXC || R.status !== 'running' || !R.wxPlan || R.wxPlan.director) return;
      const x = R.wxPlan.unit === 'laps' ? leaderLaps() : t - R.t0, st = R.wxPlan.stages;
      while (R.wxStage < st.length && x >= st[R.wxStage].at) R.wxSet(st[R.wxStage++].state, t, 'forecast');
    }
    // The weather becomes state ('dry' | 'cloudy' | 'wet' | 'clearing'). Cars that have to change tyres now get the reaction time (the laps they have to pit in); the cars are hindered, or not, for their tyres.
    R.wxSet = (state, t, by) => {
      if (!systemOn('weather') || !WXC || !W.STATES.some(s => s[0] === state) || state === R.wxState || R.status === 'finished') return false;
      if(['running','paused'].includes(R.status))R.cars.forEach(c=>tempUpdate(c,t));
      const was = R.wxState; R.wxState = state;
      log('weather', -1, t || 0, { state, was, lap: leaderLaps(), at: R.status === 'ready' ? 0 : (t || 0) - R.t0, by: by || 'director' });
      R.cars.forEach(c => { c.wxDue = null; const k = W.need(state, c.tyre, c.tyreOwn); if (k) c.wxDue = { kind: k, lap: c.laps.length + WXC.react }; wxRefresh(c); });
      return true;
    };
    // the percentage the weather takes from a car on its tyres (negative: hindered); a tank that gets smaller keeps only what fits
    function wxRefresh(c) {
      if (!systemOn('weather')) return;
      if (!WXH || !systemOn('fuel')) return;
      const pct = -W.hinderOf(WXH, R.wxState, c.tyre);
      if (pct === (c.wx || 0)) return;
      c.wx = pct === 0 ? 0 : pct;
      if (F.on && !c.pit) c.fuel = Math.min(c.fuel, tankOf(c));
    }
    // A pit stop starts: the car gets the tyres the weather asks for. (A stop is the only way to change tyres.)
    function wxTyres(c, at) { // (gives what the log says when the tyres changed, so that it comes after the pit stop in the log)
      if (!WXC || !systemOn('weather')) return null;
      const to = W.tyreFor(WXC, R.wxState, c.tyreOwn); let said = null;
      if (to !== c.tyre && R.resourceCost && !R.resourceCost(c,'tyre:'+to,at)) return null;
      if (to !== c.tyre) { const was = c.tyre; c.tyre = to; said = { tyre: to, was, state: R.wxState, lap: c.laps.length }; }
      if (c.wxDue && !W.need(R.wxState, c.tyre, c.tyreOwn)) c.wxDue = null;
      wxRefresh(c);
      return said;
    }
    // The Race Director gives a car another tyre (1.31.0; in every race since 1.32.0): the driver took off one set and fitted another, for example Soft for Hard in an Endurance Race.
    // It is the tyre the car races on, and in a race with weather the tyre it goes back to when the track is dry: a car that is on its own tyres is on the new ones now, a car on Wet or Intermediate tyres keeps them until it changes.
    // In a race with weather only a dry compound can be chosen (Wet and Intermediate come from the weather); without weather every tyre can. Only for this race: the Slotcar in the Database is not changed here (the race screen does that when he asks).
    R.setTyre = (i, code, t) => {
      const c = R.cars[i], to = W.tyreOf(code);
      if (!c || !to || R.status === 'finished' || (WXC && to.cls !== 'dry')) return false;
      const was = W.cleanTyre(c.tyreOwn); if (to.code === was) return false;
      const onOwn = W.cleanTyre(c.tyre) === was;
      if(onOwn&&R.resources?.profile.tyresOn&&c.resourceStarted){
        if(!R.resourceCorrectTyre(c,was,to.code,t||0))return false;
      }
      c.tyreOwn = to.code; if (onOwn) c.tyre = to.code;
      if (onOwn && SETS && !R.resources?.profile.tyresOn) { twGive(c, was); twTake(c, to.code); } // (a correction: the set on the car was another one than the box said)
      if (c.twNext === to.code) c.twNext = '';
      if (WXC) {
        const k = W.need(R.wxState, c.tyre, c.tyreOwn); // (a car whose own tyre was a Wet one is on a dry one now: in the rain it has to change, like any car on the wrong tyres when the rain starts)
        if (!k) c.wxDue = null; else if (!c.wxDue) c.wxDue = { kind: k, lap: c.laps.length + WXC.react };
        wxRefresh(c);
      }
      if (TWC && onOwn) twTyre(c); // (the stint of the results: the tyre is another one now, the life stays)
      twRefresh(c); // (the life stays as it is: this is a correction, not a new set)
      log('tyreset', i, t || 0, { tyre: to.code, was, lap: c.laps.length, state: R.wxState, onOwn, by: 'director' });
      return true;
    };
    // After the reaction time a car that is still on the wrong tyres gets the penalty points (once, or every lap), and it is logged even when there are no points
    function wxDueCheck(c, i, t) {
      if (!systemOn('weather')) return;
      const d = c.wxDue; if (!WXC || !d || c.laps.length < d.lap) return;
      if (!W.need(R.wxState, c.tyre, c.tyreOwn)) { c.wxDue = null; return; }
      const pts = d.kind === 'wet' ? WXC.wetPoints : WXC.dryPoints, added = pts > 0 && R.addPoints(i, pts, t, 'tyres');
      log('tyredue', i, t, { kind: d.kind, points: added ? pts : 0, lap: c.laps.length, tyre: c.tyre });
      if (WXC.repeat === 'every') d.lap = c.laps.length + 1; else c.wxDue = null;
    }
    // The tyre check of a crossing that was held back (R.cross with holdDue) is made now: the car did not stop on the sensor (a car that does has its stop judged instead, R.block clears the hold), so it was
    // only passing. It is made as of the crossing, not as of now. force: at the next crossing and at the end of the race, otherwise only when the time to stop has gone by (the pit hold time, and a little more for the sensor to say so).
    function wxFlush(i, t, force) {
      const c = R.cars[i]; if (!c || c.wxHold === undefined) return;
      if (!force && (c.blockAt !== null || t - c.wxHold < Math.max(F.pitHold, 500) + 700)) return;
      const h = c.wxHold; c.wxHold = undefined; wxDueCheck(c, i, h);
    }
    // what a screen needs to know of car i: its tyre, its own tyre, whether it should change tyres now ('wet' | 'dry' | ''), how many percent the weather hinders it
    R.wxOf = i => { const c = R.cars[i]; return c ? { tyre: c.tyre, own: c.tyreOwn, need: WXC ? W.need(R.wxState, c.tyre, c.tyreOwn) : '', hinder: -(c.wx || 0) } : null; };
    R.tyreNoteOf = i => [W.noteOf(R.events, i), Tw.mandNote(R.events, i)].filter(Boolean).join(', '); // what the tyres did to car i in this race, in words (empty when nothing), with a mandatory stop that was missed
    R.weatherNote = () => (WXC ? W.forecastNote(R.events, WXC.unit) : ''); // what the weather did in this race, in words

    // ---- Tyre Wear (see tyrewear.js) ----
    // The life of the tyres of a car (car.twLife, 100 to 0) goes down with every lap that counts, by the wear of the tyre it is on in the weather it is racing in. The grip curve (what the life does to the car) works through the fuel levers
    // as car.tw, a signed whole percentage, added to Balance of Power and the weather. A pit stop gives a fresh set: when the tyre change time (TWC.changeMs) is up, from the moment the car stops (at the same time as the other work)
    // or after the other work (one after the other). A car that leaves before that keeps its worn tyres. At 0% the rule of the system applies on every following lap: penalty points, a lap that does not count until the car has
    // pitted, or the car retires. Nothing here changes a measured lap time.
    R.tyrewear = TWC;
    // the percentage the tyres of a car give it now (negative: hinder); a tank that gets smaller keeps only what fits
    function twRefresh(c) {
      if (!systemOn('tyrewear')) return;
      if (!TWH || !systemOn('fuel')) return;
      const pct = Tw.effectLever(TWC, c.tyre, c.twLife);
      if (pct === (c.tw || 0)) return;
      c.tw = pct === 0 ? 0 : pct;
      if (F.on && !c.pit) c.fuel = Math.min(c.fuel, tankOf(c));
    }
    // The tyre stints of a car, for the results (1.42.0): one for every set that was on the car, with the laps driven, the metres of lane, the laps driven on worn out tyres and the life at the end (the last one is the set on the car now)
    const twStint = c => { if (!c.twS) c.twS = []; if (!c.twS.length) c.twS.push({ tyre: W.cleanTyre(c.tyre), laps: 0, m: 0, worn: 0, life: c.twLife }); return c.twS[c.twS.length - 1]; };
    // the tyre of the car is another one now (a new set, or a correction by the Race Director): a stint with no laps is only renamed, else a new stint begins on the life the car has now
    function twTyre(c) {
      const s = twStint(c), code = W.cleanTyre(c.tyre);
      if (s.laps === 0) { s.tyre = code; s.life = c.twLife; return; }
      c.twS.push({ tyre: code, laps: 0, m: 0, worn: 0, life: c.twLife });
    }
    // what the results need to know of the tyres of car i: the stints (with laps), the stops, the time the tyres took in the pits, the laps on worn out tyres and the tyre at the flag; null when the race has no tyre wear or the car drove no lap
    R.twStintsOf = i => {
      const c = R.cars[i]; if (!TWC || !c) return null;
      const list = (c.twS || []).filter(q => q.laps > 0).map(q => ({ tyre: q.tyre, laps: q.laps, m: Math.round(q.m), life: Tw.shownLife(q.life), worn: q.worn }));
      if (!list.length) return null;
      return { unit: TWC.unit, warn: TWC.warn, crit: TWC.crit, stints: list, stops: c.twStops || 0, ms: Math.round(c.twMs || 0), worn: list.reduce((n, q) => n + q.worn, 0), last: W.cleanTyre(c.tyre) };
    };
    // a wear level that the audio set calls (1.42.0): the first level of the system that the life has gone down to; every level once for every set (a life that falls past several levels at once says the lowest)
    function twLevels(c, i, t) {
      const calls = Array.isArray(TWC.calls) ? TWC.calls : []; // (a race that was interrupted before 1.42.0 has no levels)
      if (!calls.length) return;
      const done = c.twCalled || (c.twCalled = []), hit = calls.filter(L => c.twLife <= L && !done.includes(L));
      if (!hit.length) return;
      hit.forEach(L => done.push(L));
      if (c.twLife <= 0) return; // (a set that is worn out has its own call)
      const lf = Tw.left(TWC, c.tyre, systemOn('weather') ? R.wxState : 'dry', c.twLife, TWC.laneLen[c.lane] || 0);
      log('tyrelevel', i, t, { tyre: c.tyre, level: Math.min(...hit), life: Tw.shownLife(c.twLife), lap: c.laps.length, laps: Number.isFinite(lf.laps) ? Math.max(0, Math.ceil(lf.laps - 1e-9)) : null, dist: Number.isFinite(lf.dist) ? Math.max(0, Math.round(lf.dist)) : null });
    }
    // ---- Push and Save (1.54.0) ----
    // New-model systems use the App Settings pace calculation over this driver's
    // own clean green laps. The legacy reader stays below for existing saved systems.
    const psRef = (c, extra) => {
      if (PSC && PSC.mode === 'median') {
        const kind = Ps.benchmarkOf(PSC.benchmark), laps = c.psPace || [];
        return { ms: Ps.benchmark(kind, laps, PSC.trackTarget, PSC.pacePolicy), src: kind };
      }
      if (!F.legacyPace && F.paceTarget > 0 && (F.paceSource === 'track' || F.paceSource === 'manual')) return { ms: F.paceTarget, src: F.paceSource };
      const rec = Number(c.psRec) > 0 ? Number(c.psRec) : Infinity, race = Math.min(c.best === null || c.best === undefined ? Infinity : c.best, extra > 0 ? extra : Infinity);
      return rec === Infinity && race === Infinity ? { ms: 0, src: '' } : rec <= race ? { ms: rec, src: 'record' } : { ms: race, src: 'race' };
    };
    // The current lap is compared before it joins the rolling pace history.
    function psLap(c, lapMs, lapStart) {
      const slowLap = maxLap > 0 && lapMs > maxLap;
      const ref = psRef(c, slowLap ? 0 : lapMs);
      const effect = Ps.lapEffect(PSC, { lapMs, ref: ref.ms, lapNo: c.laps.length + 1, pit: !!c.outlap, resumed: !!c.resumed, red: !!c.redInterrupted, yellow: R.flag === 'yellow' && R.yellowAt !== null && lapStart >= R.yellowAt });
      if (tyreCombination === 'tyres') effect.tyres = 1;
      return effect;
    }
    // after a lap that counted: the penalty points of a car that drove it on worn out tyres, then the wear of the lap
    function twLap(c, i, t, gone, lapMs, paceValid) {
      if (gone && TWC.zero === 'points' && TWC.zeroPoints > 0) R.addPoints(i, TWC.zeroPoints, t, 'tyres');
      const st = twStint(c); st.laps++; st.m += TWC.laneLen[c.lane] || 0; if (gone) st.worn++;
      if (MAND && !(c.msUsed || (c.msUsed = [])).includes(st.tyre)) c.msUsed.push(st.tyre); // (the tyres that laps were driven on, for the mandatory stop rule)
      const pace = paceValid && tyreCombination !== 'pushsave' ? Tw.paceMultiplier(TWC, c.twPace || [], lapMs) : { multiplier: 1, median: Tw.paceReference(TWC, c.twPace || []), ready: false };
      c.twPaceNow = { ...pace, valid: !!paceValid, lap: lapMs };
      let thermalWear=1;
      if(TWC.temperature){
        const before=Number.isFinite(c.twTemp)?c.twTemp:Tw.Temperature.settings(TWC.temperature,c.tyre).start;
        const kind=systemOn('pushsave')?Tw.Temperature.intensity(PSC,c.psNow):0;
        if(paceValid && R.flag!=='yellow' && !c.pit)c.twTemp=Tw.Temperature.lap(thermalConfig(),c.tyre,before,kind,tempWeather());
        thermalWear=Tw.Temperature.view(TWC.temperature,c.tyre,(before+(c.twTemp??before))/2).multiplier;
        c.twTempWear=thermalWear;c.twTempAt=t;
      }
      if (c.twLife > 0) {
        const base = Tw.wearPerLap(TWC, c.tyre, systemOn('weather') ? R.wxState : 'dry', TWC.laneLen[c.lane] || 0);
        c.twLife = Math.max(0, Math.round((c.twLife - base * pace.multiplier * (PSC && c.psNow ? c.psNow.t : 1) * thermalWear) * 1e6) / 1e6);
        if (c.twLife <= 0) log('tyreworn', i, t, { tyre: c.tyre, lap: c.laps.length, rule: TWC.zero });
        twLevels(c, i, t);
      }
      if (paceValid) (c.twPace || (c.twPace = [])).push(lapMs);
      st.life = c.twLife;
      twRefresh(c);
    }
    // the moment the tyres of the car on the sensor are changed (null: no change is under way: no stop yet, the change is done, or it takes no time)
    function twAt(c) {
      if (!TWC || !pitJob(c, 'tyrewear') || TWC.changeMs <= 0 || c.blockAt === null || !c.pit || c.twDoneAt === c.blockAt) return null;
      if (heldPits && c.pit.work) return c.pit.start + c.pit.work.tyres;
      let from = c.blockAt;
      if (TWC.stop === 'add') { // one after the other: after the refuelling and a driver swap, and after a repair of damage
        from = Math.max(from, otherDoneAt(c));
        const rep = c.repairedAt === c.blockAt ? c.blockAt + ((c.repairs[c.repairs.length - 1] || {}).ms || 0) : repairAt(c);
        if (rep !== null) from = Math.max(from, rep);
      }
      return Math.max(c.pit.start, from + Math.round(TWC.changeMs * (c.scf || 1)));
    }
    // ---- the sets (1.41.0): the box of a car or a team, the tyre queued for the next stop, and which set goes on ----
    const twKey = c => (SETS && SETS.mode === 'team' && c.teamId ? String(c.teamId) : null);
    // the sets that are left in the box of car c (the box of its team when the team shares them); null: no limit
    function twPool(c) {
      if(R.resources?.profile.tyresOn)return Object.fromEntries(W.TYRES.map(k=>[k.code,Res.available(R.resources,c,R.resourceHeat,'tyre:'+k.code)]));
      if (!SETS) return null;
      const k = twKey(c);
      if (k) return R.twTeams[k] || (R.twTeams[k] = { ...SETS.n });
      return c.twSets || (c.twSets = { ...SETS.n });
    }
    const twTake = (c, code) => { const p = twPool(c); if (p) p[code] = Math.max(0, (Number(p[code]) || 0) - 1); };
    const twGive = (c, code) => { const p = twPool(c); if (p) p[code] = (Number(p[code]) || 0) + 1; };
    // the tyre the weather asks for at the next stop (Intermediate or Wet), or '' when it asks for none (a dry compound goes on: the one that was queued, or the same one)
    function twForced(c) {
      if (!WXC || !pitJob(c, 'weather')) return '';
      const to = W.tyreFor(WXC, R.wxState, c.tyreOwn);
      if (W.classOf(to) === 'dry') return '';
      const queued = c.twNext ? W.tyreOf(c.twNext) : W.tyreOf(c.tyre);
      return queued?.custom && queued.cls === W.classOf(to) ? queued.code : to;
    }
    // what goes on at the next stop of car c: { code, kind: 'weather' | 'queued' | 'same' }
    function twNextOf(c) {
      const f = twForced(c);
      if (f) return { code: f, kind: 'weather' };
      if (c.twNext && (!WXC || W.classOf(c.twNext) === 'dry')) return { code: c.twNext, kind: 'queued' };
      return { code: W.cleanTyre(c.tyreOwn), kind: 'same' };
    }
    // the tyre that goes on when the tyres are changed now (null: there is no set to fit)
    function twWill(c) {
      const f = twForced(c), pk = Tw.pickFit(twPool(c), twNextOf(c).code, c.tyreOwn, !!f, !WXC);
      return pk ? pk.code : null;
    }
    // The Race Director queues a tyre for the next stop ('' or the tyre the car races on: nothing queued, the same tyre goes on). With weather only a dry compound can be queued (the rain's tyres come from the weather),
    // and with sets only a tyre that has a set left. The weather's Intermediate or Wet tyres go on before a queued tyre, which stays queued for the stop after that.
    R.twQueue = (i, code, t) => {
      const c = R.cars[i]; if (!TWC || !c || R.status === 'finished') return false;
      const was = c.twNext || '';
      const to = code ? W.tyreOf(code) : null;
      if (code && (!to || (WXC && to.cls !== 'dry' && !to.custom))) return false;
      const want = !to || to.code === W.cleanTyre(c.tyreOwn) ? '' : to.code; // (queueing the tyre it is on is the same as nothing queued)
      const p = twPool(c);
      if (want && p && (Number(p[want]) || 0) <= 0) return false; // (no set left of it)
      if (want === was) return false;
      c.twNext = want;
      log('tyrequeue', i, t || 0, { tyre: want, was, lap: c.laps.length, by: 'director' });
      return true;
    };
    // The set goes on: the tyre that is wanted (weather first, then the queued one, then the same tyre), or one that is left when there is none of it. Gives what the log says (null: nothing changed).
    function twFit(c, at) {
      const forced = twForced(c), ask = twNextOf(c).code, p = twPool(c);
      const pick = Tw.pickFit(p, ask, c.tyreOwn, !!forced, !WXC);
      if (!pick) { c.twDoneAt = c.blockAt; if(R.resources?.profile.tyresOn)c.resourceBlocked='tyre:'+ask; return { none: true, asked: ask, tyre: c.tyre }; } // An exhausted stop does not count as a tyre change.
      let said = null;
      if(R.resources?.profile.tyresOn){if(!R.resourceCost(c,'tyre:'+pick.code,at))return {none:true,asked:ask,tyre:c.tyre};p[pick.code]=Res.available(R.resources,c,R.resourceHeat,'tyre:'+pick.code);}
      else if (p) p[pick.code] = Math.max(0, (Number(p[pick.code]) || 0) - 1);
      if (pick.code !== c.tyre) { const was = c.tyre; c.tyre = pick.code; said = { tyre: pick.code, was, state: R.wxState, lap: c.laps.length }; }
      if (!forced) { c.tyreOwn = pick.code; if (!c.twNext || !WXC || W.classOf(c.twNext) === 'dry') c.twNext = ''; }
      else if (c.twNext === pick.code && W.tyreOf(pick.code)?.custom) c.twNext = '';
      if (WXC) { if (c.wxDue && !W.need(R.wxState, c.tyre, c.tyreOwn)) c.wxDue = null; wxRefresh(c); }
      tempReset(c,at ?? c.twTempAt); c.twLife = 100; c.twStops++; c.twDoneAt = c.blockAt; c.twCalled = []; twTyre(c); twRefresh(c);
      return { tyre: c.tyre, said, ...(p ? { sets: Number(p[pick.code]) || 0 } : {}), ...(p && !(Number(p[pick.code]) > 0) ? { last: pick.code } : {}), ...(pick.asked ? { asked: pick.asked } : {}) };
    }
    function twFitLog(i, at, ms, fit) {
      const c = R.cars[i];
      if (fit.none) { log('tyrenone', i, at, { tyre: fit.tyre, asked: fit.asked, lap: c.laps.length }); return; }
      if (fit.said) log('tyres', i, at, fit.said);
      c.twMs = (c.twMs || 0) + ms; // (the time the tyre changes took, for the results)
      log('tyrefresh', i, at, { tyre: fit.tyre, lap: c.laps.length, ms, ...(fit.sets !== undefined ? { sets: fit.sets } : {}), ...(fit.asked ? { asked: fit.asked } : {}) });
      if (fit.last) log('tyrelast', i, at, { tyre: fit.last, lap: c.laps.length });
    }
    // ---- mandatory stops (1.52.0, see tyrewear.js) ----
    // The rule is judged once for a car: when it finishes, or when the race ends (a race that the Race Director stops by hand is not judged). A car that retired or was disqualified is out of the race and is not judged,
    // nor is a car that drove no lap. What it gets is the system's choice: seconds on its race time, penalty points (when the race has a penalty system), or the car is out of the race. The 'mandatory' event says what happened.
    function msJudge(c, i, t) {
      if (!systemOn('tyrewear')) return;
      if (!MAND || c.msDone || c.dq || c.retired || !c.laps.length) return;
      c.msDone = true;
      const chk = Tw.mandCheck(MAND, c.twStops || 0, c.msUsed || []);
      const e = { ok: chk.ok, stops: c.twStops || 0, need: MAND.stops, two: MAND.two, dry: chk.dry, wet: chk.wet, missed: chk.missed, how: chk.ok ? '' : MAND.penalty };
      if (!chk.ok && MAND.penalty === 'time' && MAND.seconds > 0) { e.ms = Math.round(MAND.seconds * 1000); c.extraMs = (c.extraMs || 0) + e.ms; }
      if (!chk.ok && MAND.penalty === 'points' && MAND.points > 0) { if (P.on) e.points = MAND.points; else e.noSystem = true; }
      log('mandatory', i, t, e);
      if (e.points) R.addPoints(i, e.points, t, 'mandatory');
      if (!chk.ok && MAND.penalty === 'dq') { c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, t); }
    }
    // what a screen needs to know of the mandatory stops of car i (null: this race has no such rule)
    R.mandOf = i => {
      const c = R.cars[i]; if (!MAND || !c) return null;
      const chk = Tw.mandCheck(MAND, c.twStops || 0, c.msUsed || []);
      return { stops: c.twStops || 0, need: MAND.stops, two: MAND.two, dry: chk.dry, wet: chk.wet, stopsOk: chk.stopsOk, tyresOk: chk.tyresOk, ok: chk.ok, judged: !!c.msDone, rule: Tw.mandText(MAND) };
    };
    // the car stands in the pits and the time has come: the fresh set goes on
    function twCheck(i, t) {
      const c = R.cars[i], at = twAt(c);
      if (at === null || t < at) return;
      twFitLog(i, at, at - c.blockAt, twFit(c, at));
      tempUpdate(c,t);
    }
    if (SETS && !cfg.resources?.profile.tyresOn) R.cars.forEach(c => twTake(c, W.cleanTyre(c.tyre))); // every car starts on a set of its tyre (a restored race brings its own boxes back)
    // what a screen needs to know of the tyres of car i: the tyre, its life, the level (ok, warn, crit, out), what it does to the car (null: not through the fuel rules), what is left, the stops, and while the tyres are being changed the tyre that goes on and the time that is left
    R.temperatureOf = (i, t) => TWC?.temperature && R.cars[i] ? Tw.Temperature.view(TWC.temperature,R.cars[i].tyre,tempValue(R.cars[i],t)) : null;
    R.twOf = (i, t) => {
      const c = R.cars[i]; if (!TWC || !c) return null;
      const resourceSets = R.resources?.profile.tyresOn;
      const initial = resourceSets ? (R.resources.accounts[Res.key(R.resources, c, R.resourceHeat)]?.initial || Res.limits(R.resources.profile)) : null;
      const at = twAt(c), te = R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t, busy = at !== null && R.status !== 'finished';
      return { temperature: R.temperatureOf(i,t), tyre: c.tyre, life: c.twLife, level: Tw.levelOf(TWC, c.twLife), effect: TWH ? c.tw || 0 : null, left: Tw.left(TWC, c.tyre, systemOn('weather') ? R.wxState : 'dry', c.twLife, TWC.laneLen[c.lane] || 0), pace: c.twPaceNow ? { ...c.twPaceNow, samples: (c.twPace || []).length } : null, stops: c.twStops,
        ...(resourceSets ? { setsMode: R.resources.profile.owner, setsStart: Object.fromEntries(Object.entries(initial).filter(([k]) => k.startsWith('tyre:')).map(([k,n]) => [k.slice(5), n])) } : {}),
        fitting: busy ? twWill(c) : null, fitLeft: busy && Number.isFinite(te) ? Math.max(0, at - te) : null,
        own: W.cleanTyre(c.tyreOwn), next: twNextOf(c), queued: c.twNext || '', sets: (SETS || R.resources?.profile.tyresOn) ? { ...twPool(c) } : null };
    };
    // ---- penalty points ----
    R.penMs = penOf;
    R.penaltyEffects = c => penaltyEffects(P, c && c.points);
    // Adds (or with a negative n takes back) penalty points. Reaching the disqualify limit puts the car out of the race.
    R.addPoints = (i, n, t, why) => {
      const c = R.cars[i];
      if (!P.on || (!systemOn('penalty') && why !== 'existing-penalty') || !c || R.status === 'ready' || !Number.isFinite(n) || n === 0) return false;
      const before = c.points;
      c.points = Math.max(0, c.points + n);
      if (c.points === before) return false;
      const effect = penaltyEffects(P, c.points), beforeEffect = penaltyEffects(P, before);
      log('penalty', i, t, { delta: c.points - before, points: c.points, ms: penaltyMs(P, c.points), laps: effect.laps, ...(why ? { why } : {}) });
      // A ladder's pit row is mandatory once when its threshold is crossed. Higher rows
      // replace the former duration; they do not queue both durations.
      if (effect.pit > 0 && effect.from > beforeEffect.from && !(c.penaltyPitTiers || []).some(tier => tier >= effect.from)) {
        if (R.status === 'running') serveCheck(i, t);
        const previousTier = p => p.ladderTier || (p.mandatory && /^Penalty points · (\d+) points$/.test(p.name) && R.events.some(e => e.type === 'assigned' && e.automatic && e.car === i && e.t === p.at && e.name === p.name) ? Number(/^Penalty points · (\d+) points$/.exec(p.name)[1]) : 0);
        const replaceAt = c.pending.findIndex(p => previousTier(p) > 0 && previousTier(p) < effect.from);
        c.pending = c.pending.filter(p => !(previousTier(p) > 0 && previousTier(p) < effect.from));
        c.penaltyPitTiers = c.penaltyPitTiers || []; c.penaltyPitTiers.push(effect.from);
        c.pending.splice(replaceAt < 0 ? c.pending.length : replaceAt, 0, { name: `Penalty points · ${effect.from} points`, kind: 'stopgo', seconds: effect.pit, extra: 0, unserved: 0, mandatory: true, ladderTier: effect.from, at: t });
        if (heldPits) holdPenalty(c);
        log('assigned', i, t, { name: `Penalty points · ${effect.from} points`, automatic: true });
      }
      if (P.dq && c.points >= P.dq && !c.dq) {
        c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, t); checkEnd(t);
      } else if (c.dq && !c.dmgOut && !c.failOut && (!P.dq || c.points < P.dq) && R.status !== 'finished') { // a mistaken point can still be taken back (not for a car that damage put out: that is for the damage points)
        c.dq = false; c.done = !!c.dqWasDone; c.retired = !!c.dqWasRetired; log('reinstated', i, t);
      }
      return true;
    };
    R.goodLaps = goodLaps;
    // the car stops over the sensor. crossed: the crossing was counted when the car arrived (a Trackmate sensor: it is only known later that the car stays), t is that moment, and only the stop is started
    R.block = (i, t, crossed) => {
      if (R.status !== 'running') return false;
      const c = R.cars[i];
      if (!c || c.done || c.blockAt !== null || (heldPits && (c.pitHold || c.pitRearm))) return false;
      if (crossed) c.wxHold = undefined; // (the tyres that were due are judged by the stop, as for a car that comes in with this crossing)
      else { wxEntering = true; R.cross(i, t); wxEntering = false; }
      if (c.done) return true;
      tempUpdate(c,t); c.blockAt = t; c.pit = null; c.servedNow = false; c.scf = scFactor(); if (randomPitExit()) c.rndPitExit = true; // (a stop is as short as the Safety Car makes it at the moment the car comes in)
      return true;
    };
    // the car leaves; a block shorter than pitHold is no pit stop
    R.unblock = (i, t, release) => {
      const c = R.cars[i];
      if (!c || c.blockAt === null) return false;
      tempUpdate(c,t);
      if (c.rndPitExit && randomPitExit()) { if (R.status === 'running') { pitCheck(i, t); serveCheck(i, t); repairCheck(i, t); twCheck(i, t); } return false; }
      if (heldPits && !release) { if (R.status === 'running') pitCheck(i, t); if (c.pitHold) return false; }
      if (R.status === 'running') { pitCheck(i, t); serveCheck(i, t); enSensor(i, t); repairCheck(i, t); twCheck(i, t); }
      if (TWC && pitJob(c, 'tyrewear') && R.status === 'running' && c.pit && TWC.changeMs > 0 && c.twDoneAt !== c.blockAt) log('tyreearly', i, t, { tyre: c.tyre, life: Math.round(c.twLife), lap: c.laps.length }); // left before the tyres were changed: the car keeps its worn tyres
      if (c.pending.length && (heldPits || !c.servedNow) && R.status === 'running') { // left before the penalty was served
        const p = c.pending[0]; log('leftearly', i, t, { name: p.name, extra: p.extra }); if (p.extra) R.addPoints(i, p.extra, t, 'existing-penalty');
      }
      if (DM && pitJob(c, 'damage') && R.status === 'running' && c.pit && !c.dmgOut && !c.failOut && c.repairedAt !== c.blockAt && (Dm.levelOf(DM, c.dmg) || flJob(c))) { // left before the repair was done (a stop that was no pit stop is not counted)
        const lv = Dm.levelOf(DM, c.dmg), fj = flJob(c), extra = DM.earlyPoints; // (the penalty points are given once, also when the damage and a failure were both left unrepaired)
        if (lv) log('repairearly', i, t, { name: lv.name, points: c.dmg, extra });
        if (fj) log('failureearly', i, t, { name: fj.name, extra: lv ? 0 : extra });
        if (extra > 0) R.addPoints(i, extra, t, lv ? 'damage' : 'failure');
      }
      closePit(i, t);
      return true;
    };
    // Only the race consumes these observations; hardware monitors and protocol event streams stay live.
    function holdPenalty(c) {
      if (!c.pitHold) return;
      const old = c.pitHold.extraMs || 0;
      c.pitHold.extraMs = (c.pit && c.pit.penaltyMs || 0) + c.pending.reduce((n, p) => n + (p.kind === 'stopgo' ? p.seconds * 1000 : 0), 0);
      if (c.pitHold.extraMs > old) c.pitHold.returned = false;
    }
    function holdCheck(i, t) {
      const c = R.cars[i]; if (!c.pitHold || c.done || R.status !== 'running') return;
      if (c.rndPitExit && randomPitExit()) return;
      holdPenalty(c);
      const at = Ph.advance(c.pitHold, PH, R.elapsed(t));
      if (at !== null) R.pitRelease(i, R.t0 + at, false, 'sensor');
    }
    R.pitControl = PH;
    R.pitExitHeld = () => randomPitExit();
    R.pitHoldOf = (i, t) => {
      const c = R.cars[i]; if (!heldPits || !c) return null;
      const view = Ph.view(c.pitHold, PH, R.elapsed(t));
      return c.rndPitExit && (R.sharedPitExitHeld ?? randomPitExit()) ? { ...view, ready: false, randomHold: true, text: 'Held at pit exit until the Random Flag ends' } : view;
    };
    R.pitSensor = (i, on, t) => {
      const c = R.cars[i]; if (!heldPits || !c || !['running', 'paused'].includes(R.status) || (on !== null && typeof on !== 'boolean') || !Number.isFinite(t)) return false;
      const at = R.elapsed(t); if (c.pitSensorAt !== undefined && at < c.pitSensorAt) return false;
      if (R.status === 'running') pitCheck(i, t);
      c.pitSensor = on; c.pitSensorAt = at;
      if (c.pitHold) { holdPenalty(c); if (on === null) { c.pitHold.covered = null; c.pitHold.returned = false; } else Ph.observe(c.pitHold, PH, at, on); holdCheck(i, t); }
      else if (on === false) c.pitRearm = false;
      return true;
    };
    R.pitRelease = (i, t, early = false, by = 'button') => {
      const c = R.cars[i]; if (!heldPits || !c || c.done || R.status !== 'running' || !c.pitHold) return false;
      if (c.rndPitExit && randomPitExit()) return false;
      holdPenalty(c); const remaining = Ph.due(c.pitHold, PH) - R.elapsed(t);
      if (!early && remaining > 1e-6) return false;
      if (by === 'button' && c.pitSensor == null) c.pitSensor = false; // button-only pits: Release car is the director's confirmation
      if (!R.unblock(i, t, true)) return false;
      log('pitrelease', i, t, { mode: PH.mode, early: remaining > 1e-6, by });
      return true;
    };
    // ---- Endurance Race: the swaps of drivers ----
    // A car with a roster of two drivers or more has a state (car.en, see endurance.js): who is at the wheel, the stints, when the swap is due. The swap is made when the car stands on the sensor long enough
    // (the Stop-and-Go way) or when the Race Director presses Swap done; the driver at the wheel is then another one, in the car (driverId, driverName, nickname... are his), and the log says so.
    R.endurance = EN;
    const enBusy = i => new Set(R.cars.filter((o, j) => j !== i && o.driverId && !o.done).map(o => o.driverId)); // (drivers who are at the wheel of another car now)
    const enClock = t => (R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t) - R.t0;
    // 1.35.1: the distance (metres) a car has driven, for swaps counted in distance: its laps times the length of its lane (cfg.laneLengths, else the lanes of a distance race; a lane with no known length has driven nothing).
    // At the line: as of the last crossing. Anywhere: between two crossings it goes on, estimated from the time since the last crossing and the lap time to expect (never past the next crossing).
    const enLen = c => Number((cfg.laneLengths || [])[c.lane]) || lenOf(c) || 0;
    const enOdo = (c, t) => {
      if (!EN || EN.unit !== 'distance') return 0;
      const L = enLen(c); if (!(L > 0)) return 0;
      const exact = c.laps.length * L; if (EN.where !== 'anywhere' || c.done || R.status === 'finished') return exact;
      const lap = Dist().expectedLap(c.laps, c.bad), since = enClock(t) - c.total;
      return lap && since > 0 ? exact + Math.min(since / lap, 0.99) * L : exact;
    };
    R.enOdo = enOdo;
    const enName = (c, id) => { const r = (c.roster || []).find(x => x.id === id); return r ? r.name || '' : ''; };
    const enWheel = (c, id) => { const r = (c.roster || []).find(x => x.id === id); if (r) Object.assign(c, { driverId: r.id, driverName: r.name || '', nickname: r.nickname || '', callsign: r.callsign || '', flag: r.flag || '', avatar: r.avatar || '' }); };
    // the swap is made (by: 'sensor' or 'button'); gives the result of Endurance.swap, or null when it can not be made
    function enSwap(i, t, by, to) {
      const c = R.cars[i], el = enClock(t), laps = c.laps.length, m = enOdo(c, t);
      const was = c.driverId, wasName = c.driverName, res = En.swap(EN, c.en, { el, laps, m, to, by, roster: c.roster, busy: enBusy(i), rnd: enRnd });
      if (!res.ok) return null;
      enWheel(c, res.to);
      if (c.blockAt !== null) { c.enSwapAt = c.blockAt; c.enSwapDoneAt = t; } // (one swap in a stop; the repair of damage can wait for it)
      log('swapdone', i, t, { from: was, fromName: wasName, to: res.to, toName: enName(c, res.to), by, early: res.early, over: res.over, stintMs: res.stintMs, stintLaps: res.stintLaps, stintM: res.stintM, m, lap: laps });
      if (res.early && EN.early === 'penalty') R.addPoints(i, EN.penalty, t, 'swap');
      En.plan(EN, c.en, c.roster, enBusy(i), el, laps, enRnd, m);
      return res;
    }
    // the sensor: the car stands still for the swap time, and a swap is wanted (it is due; in a free swap also when the shortest stint is over)
    function enSensor(i, t) {
      const c = R.cars[i];
      if (!c.en || EN.confirm === 'button' || c.blockAt === null || c.done || c.enSwapAt === c.blockAt || t - c.blockAt < EN.seconds * 1000) return; // (the caller looks at a race that is running)
      const l = En.look(EN, c.en, enClock(t), c.laps.length, enOdo(c, t));
      if (l.due || (EN.mode === 'free' && l.allowed)) enSwap(i, t, 'sensor');
    }
    // every look at a car: the swap that is due (once), the penalty for a swap that is refused, the laps that stop counting, who is next, and the sensor
    function enEval(i, t) {
      const c = R.cars[i];
      if (!c.en || c.done || R.status !== 'running') return;
      const el = enClock(t), laps = c.laps.length, m = enOdo(c, t), res = En.step(EN, c.en, el, laps, m);
      En.plan(EN, c.en, c.roster, enBusy(i), el, laps, enRnd, m);
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
        const el = c.done && c.laps.length ? c.total : t - R.t0, m = EN.unit === 'distance' ? enLen(c) * c.laps.length : 0; // (a race is over at a crossing of the line, or stopped: the exact distance)
        En.close(EN, c.en, el, c.laps.length, m);
        if (why === 'Stopped') return; // a race that was stopped early: nobody can be short
        En.short(EN, c.en, c.roster, el, c.laps.length, m).forEach(x => {
          const pts = EN.minPenalty, added = R.addPoints(i, pts, t, 'swap');
          log('swapshort', i, t, { driver: x.id, driverName: enName(c, x.id), ms: x.ms, laps: x.laps, m: x.m, points: added ? pts : 0 });
        });
      });
    }
    // What a screen needs to show of the swaps of car i: the look at the stint ({ state, left, why, allowed, ... }), who is at the wheel and next, and the totals and stints. Null for a car that does not swap.
    R.enLook = (i, t) => {
      const c = R.cars[i]; if (!EN || !c || !c.en) return null;
      const el = R.status === 'ready' ? 0 : enClock(t), laps = c.laps.length, m = enOdo(c, t), standing = c.blockAt !== null && R.status === 'running' ? Math.max(0, EN.seconds * 1000 - (t - c.blockAt)) : null; // (standing: how long the car has to stand still for a swap by the sensor)
      return { ...En.look(EN, c.en, el, laps, m), dist: m, driver: c.driverId, next: c.en.nextId, picked: c.en.picked, swaps: c.en.swaps, choices: En.choices(EN, c.en, c.roster, enBusy(i), el, laps, m), totals: En.totals(c.en, c.roster, el, laps, m), stints: En.stints(c.en, el, laps, m), lost: !!c.en.lost, lostLaps: c.swapLost || 0, standLeft: standing };
    };

    R.cars.forEach(c => { if (c.en && c.driverId !== c.en.d) enWheel(c, c.en.d); }); // (a team that has no starting driver, or one who is not of the roster, starts with the first of the roster)

    // ---- special penalties (Drivethrough, Stop-and-Go) ----
    // A penalty is served by stopping on the sensor: a Drivethrough once the pit stop starts (the pit hold time), a Stop-and-Go once the car has stood still for its seconds.
    function serveCheck(i, t) {
      const c = R.cars[i];
      if (c.blockAt === null || !c.pending.length) return;
      if (heldPits) {
        if (!c.pit || !c.pitHold) return;
        holdPenalty(c);
        while (c.pending.length) {
          const p = c.pending[0], ms = p.kind === 'stopgo' ? p.seconds * 1000 : 0, at = c.pit.start + PH.seconds * 1000 + (c.pit.penaltyMs || 0) + ms;
          if (t < at) break;
          c.pending.shift(); c.pit.penaltyMs = (c.pit.penaltyMs || 0) + ms;
          c.served.push({ ...p, servedAt: at }); c.servedNow = true; log('served', i, at, { name: p.name });
        }
        return;
      }
      const p = c.pending[0], need = p.kind === 'drivethrough' ? F.pitHold : p.seconds * 1000;
      if (t - c.blockAt < need) return;
      c.pending.shift(); c.served.push({ ...p, servedAt: t }); c.servedNow = true; log('served', i, t, { name: p.name });
    }
    // A named special penalty can either retain the legacy point-cost pit behaviour or
    // give points plus an immediate time, scoring-lap or mandatory-pit consequence.
    R.assign = (i, typeIndex, t) => {
      const c = R.cars[i], ty = P.types[typeIndex];
      const legacy = ty && (ty.legacy === true || ty.effect === undefined);
      if (!P.on || !systemOn('penalty') || !c || !ty || c.dq || (R.status !== 'running' && R.status !== 'paused') || (legacy && c.points < ty.cost)) return false;
      if (legacy) {
        if (ty.cost) R.addPoints(i, -ty.cost, t);
        c.pending.push({ name: ty.name, kind: ty.kind, seconds: ty.seconds, extra: ty.extra, unserved: ty.unserved, at: t });
      } else {
        if (ty.points) R.addPoints(i, ty.points, t, 'special');
        if (ty.effect === 'time' && ty.amount) c.extraMs = (c.extraMs || 0) + ty.amount * 1000;
        if (ty.effect === 'laps' && ty.amount) c.specialLaps = (c.specialLaps || 0) + Math.round(ty.amount);
        if (ty.effect === 'pit' && ty.amount) c.pending.push({ name: ty.name, kind: 'stopgo', seconds: ty.amount, extra: 0, unserved: 0, mandatory: true, at: t });
      }
      if (heldPits) holdPenalty(c);
      log('assigned', i, t, { name: ty.name, points: legacy ? 0 : ty.points, effect: ty.effect, amount: ty.amount });
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
      if (c.pit && F.on && pitJob(c, 'fuel')) { const rate = c.pit.rate ?? F.rate, tank = c.pit.tank ?? F.tank; if (rate > 0) at = Math.max(at, c.pit.start + Math.max(0, tank - c.pit.fuel0) / rate * 1000); }
      if (c.en && EN && EN.confirm !== 'button') {
        if (c.enSwapAt === c.blockAt) at = Math.max(at, c.enSwapDoneAt ?? at);
        else { const l = En.look(EN, c.en, enClock(c.blockAt), c.laps.length, enOdo(c, c.blockAt)); if (l.due || (EN.mode === 'free' && l.allowed)) at = Math.max(at, c.blockAt + EN.seconds * 1000); }
      }
      return at;
    }
    // the failure of car c that asks something of the stop (null: it has none): its rules from the system (failures.js)
    const flJob = c => (FL && c.fail ? FL.list[c.fail.k] || null : null);
    // the moment the repair of the car on the sensor is done (null: nothing to repair). The damage and a failure are worked on at the same time: the longest of the two counts
    function repairAt(c) {
      if (!pitJob(c, 'damage')) return null;
      const lv = dmgLevel(c), fj = flJob(c);
      if (heldPits && c.pit && c.pit.work && (lv || fj) && !c.dmgOut && !c.failOut) return c.pit.start + c.pit.work.repair;
      return (lv || fj) && c.blockAt !== null && !c.dmgOut && !c.failOut ? Dm.doneAt(DM, { ms: Math.round(Math.max(lv ? lv.ms : 0, fj ? fj.ms : 0) * (c.scf || 1)) }, c.blockAt, DM.stop === 'add' ? otherDoneAt(c) : undefined) : null;
    }
    // the car stands in the pits and the time has come: repair it, or retire or disqualify it
    function repairCheck(i, t) {
      const c = R.cars[i];
      if (!DM || c.blockAt === null || !c.pit || c.dmgOut || c.failOut || c.repairedAt === c.blockAt) return; // (a stop that has not started as a pit stop yet repairs nothing; one stop repairs once)
      const lv = dmgLevel(c), fj = flJob(c), at = repairAt(c);
      if ((!lv && !fj) || at === null || t < at) return;
      let blocked=false;
      const ms = Math.max(0, at - c.blockAt);
      if (lv) {
        const info = { name: lv.name, points: c.dmg, level: Dm.levelAt(DM, c.dmg), ms };
        if(lv.action==='repair' && R.resourceCost && !R.resourceCost(c,'damage',t)) { blocked=true; }
        else if (lv.action === 'repair') {
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
      if(fj?.action==='repair'&&R.resourceCost&&!R.resourceCost(c,'failure',t))blocked=true;
      else if (fj) flRepair(c, i, t, fj, ms);
      if(!blocked)c.repairedAt=c.blockAt; // (a failure is cleared, or it ends the car, in the same stop as the damage)
    }
    // after every lap: the automatic damage points of a deslot, and the penalty points of a car that is late for the pits
    function damageLap(c, i, t, deslot) {
      if (!systemOn('damage')) return;
      if (c.dmgOut || c.failOut || c.done) return;
      if (deslot && DM.deslotPoints > 0) R.addDamage(i, DM.deslotPoints, t, 'deslot');
      if (c.dmg > 0 && c.dmgDue !== null && c.laps.length > c.dmgDue) {
        const lv = dmgLevel(c), added = DM.latePoints > 0 && R.addPoints(i, DM.latePoints, t, 'damagelate'); // (no points, or no penalty system: nothing is added)
        log('damagelate', i, t, { name: lv ? lv.name : '', points: added ? DM.latePoints : 0, lap: c.laps.length, due: c.dmgDue });
      }
      if (c.fail && c.fail.due !== null && c.laps.length > c.fail.due) { // a failure that is not repaired by its deadline costs penalty points for every lap, like a level
        const added = DM.latePoints > 0 && R.addPoints(i, DM.latePoints, t, 'failurelate');
        log('failurelate', i, t, { name: c.fail.name, points: added ? DM.latePoints : 0, lap: c.laps.length, due: c.fail.due });
      }
    }
    // Adds (or with a negative n takes back) damage points to car i. A hit is made more or less by the damage factor of the car (a fragile car); points that are taken back are not. A level that is reached for
    // the first time is logged, and its deadline is worked out. Gives true when the damage changed.
    R.addDamage = (i, n, t, why) => {
      if (!systemOn('damage')) return false;
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

    // ---- Car Failures (see failures.js) ----
    // Every car is rolled when the race starts: which failures it will get (a chance for each, times the Failure factor of the slot car) and at which lap (or time) they come. A failure borrows the rules of a level
    // (pit whenever you can or as fast as you can, a deadline in laps, repair / retire / disqualify) and has its own seconds to stand still. It adds no damage points. The car is repaired by the stop in the pits,
    // together with its damage (the longest job counts). A failure that is not repaired by its deadline costs the penalty points of the system for every lap, like a level.
    R.failures = FL;
    // ---- Random flags (1.59.0) ----
    R.randomFlags = RNC; // the settings (or null: this race has no random flags)
    R.rndSoon = false; // a random flag is about to come (the warning): the Race Flag widget flashes, and the call is said
    R.rndInfo = () => (RN && RN.plan ? { unit: RN.unit, plan: RN.plan.map(p => ({ ...p })), next: RN.i, up: RN.up ? { ...RN.up } : null } : null); // (for the tests: the plan is not shown on the screens)
    function rnRoll() {
      if (!RN || RN.plan) return;
      const r = Sc.roll(RNC, { laps: type === 'race' ? lapLimit : 0, ms: timeLimit }, rnRnd);
      RN.unit = r.unit; RN.plan = r.plan;
    }
    // where the race is now, in the unit of the plan: the laps of the leader and the part of his lap (from the time since his last crossing, by what his last laps took), or the milliseconds of the race clock
    function rnPos(t) {
      if (RN.unit !== 'laps') return { pos: t - R.t0, lap: 0 };
      let lead = null; R.cars.forEach(c => { if (!lead || c.laps.length > lead.laps.length) lead = c; });
      if (!lead) return { pos: 0, lap: 0 };
      const last = lead.laps.slice(-3), lap = last.length ? last.reduce((a, b) => a + b, 0) / last.length : 0;
      return { pos: lead.laps.length + (lap > 0 ? Math.min(0.999, Math.max(0, (t - lead.last) / lap)) : 0), lap };
    }
    function rnEnd(t, how) {
      log('randomend', -1, t, { n: RN.up.n, by: how }); RN.up = null; RN.lastEnd = t - R.t0; clearRandomPitExit(t);
    }
    function rnCheck(t) {
      if (!systemOn('safetycar')) { R.rndSoon = false; return; }
      if (!RN || !RN.plan || R.status !== 'running') { R.rndSoon = !!(RN && RN.soon && R.status === 'paused'); return; }
      const el = t - R.t0;
      if (RN.up) {
        if (!(R.flag === 'yellow' && R.yellowAt !== null && R.yellowAt - R.t0 === RN.up.yEl)) rnEnd(t, 'hand'); // lifted by hand (or another flag went up): the plan is done with it
        else if (RN.up.liftAt !== null && el >= RN.up.liftAt) { R.flag = ''; R.yellowAt = null; log('raceflag', -1, t, { flag: '', by: 'random' }); scEdge(t); rnEnd(t, 'time'); }
      }
      if (RN.up || RN.i >= RN.plan.length || R.timeUp || (timeLimit > 0 && el >= timeLimit) || R.cars.some(c => c.done)) { RN.soon = false; R.rndSoon = false; return; } // (no new flag once the time is up, or a car has finished)
      const nx = RN.plan[RN.i], at = rnPos(t), toGo = nx.at - at.pos; // (toGo in laps, or in ms)
      if (toGo <= 0) { // its moment has come: it waits while any flag is up, and until the gap since the last flag has gone by
        if (R.flag === '' && el - RN.lastEnd >= RNC.gap) {
          R.flag = 'yellow'; R.yellowAt = t; log('raceflag', -1, t, { flag: 'yellow', by: 'random' }); scEdge(t);
          RN.up = { yEl: el, liftAt: RNC.end === 'timer' ? el + nx.len : null, n: RN.i + 1, ...(RNC.note ? { note: RNC.note } : {}) };
          if (randomPitExit()) R.cars.forEach(c => { if (c.blockAt !== null) c.rndPitExit = true; });
          log('randomflag', -1, t, { n: RN.i + 1, of: RN.plan.length, len: RNC.end === 'timer' ? nx.len : null, ...(RNC.note ? { note: RNC.note } : {}) });
          RN.i++; RN.soon = false; R.rndSoon = false;
          return;
        }
      }
      const ms = RN.unit === 'laps' ? (at.lap > 0 ? toGo * at.lap : Infinity) : toGo;
      RN.soon = RNC.warn > 0 && ms <= RNC.warn;
      if (RN.soon && RN.warnedFor !== RN.i) { RN.warnedFor = RN.i; log('randomsoon', -1, t, { n: RN.i + 1 }); }
      R.rndSoon = RN.soon;
    }
    function flRoll() {
      if (!FL) return;
      R.cars.forEach(c => { if (!c.flPlan) c.flPlan = Fl.roll(FL, { laps: limitOf(c), ms: limitOf(c) > 0 ? 0 : timeLimit }, c.failureFactor, flRnd); });
    }
    // the next failure of the car starts when its lap (or time) has come; not while the car stands in the pits, not while it has a failure already, and not for a car that is out
    function flCheck(c, i, t) {
      if (!systemOn('damage')) return;
      if (!FL || R.status !== 'running' || !c.flPlan || !c.flPlan.length || c.fail || c.done || c.dq || c.dmgOut || c.failOut || c.blockAt !== null) return;
      const nx = c.flPlan[0];
      if (limitOf(c) > 0 ? c.laps.length - (c.swapLost || 0) < nx.at : !(R.elapsed(t) >= nx.at)) return;
      c.flPlan.shift(); flStart(c, i, t, nx.k);
    }
    function flStart(c, i, t, k, by) {
      if (!systemOn('damage')) return;
      const f = FL.list[k]; if (!f) return;
      c.fail = { k, name: f.name, lap: c.laps.length, due: Dm.dueLap(null, c.laps.length, f) };
      c.failN = (c.failN || 0) + 1;
      log('failure', i, t, { name: f.name, level: f.level, lap: c.laps.length, seconds: f.seconds, urgent: f.urgent, within: f.within, action: f.action, due: c.fail.due, ...(by ? { by } : {}) });
    }
    // the stop has done its time: the failure is cleared, or it ends the car (retire or disqualify), as the level it borrows its rules from says
    function flRepair(c, i, t, fj, ms) {
      const rec = { at: c.blockAt, ms, name: fj.name, lap: c.fail.lap };
      c.failMs += ms; c.fail = null;
      if (fj.action === 'repair') { c.failures.push(rec); log('failurerepaired', i, t, { name: fj.name, ms }); return; }
      c.failures.push({ ...rec, out: fj.action });
      if (!c.dmgOut) { // (a car that the damage put out in this same stop is out already)
        c.failOut = fj.action; c.failWas = { done: c.done, retired: c.retired };
        if (fj.action === 'dq') { c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; }
        c.done = true; c.retired = true;
      }
      log('failureout', i, t, { name: fj.name, ms, how: fj.action });
      checkEnd(t);
    }
    // What a screen needs to know of the failure of car i: whether it has one, its name and what it asks, the laps left to the deadline (negative: late), and while the car stands on the sensor how long the repair still takes.
    R.failureOf = (i, t) => {
      const c = R.cars[i]; if (!FL || !c) return null;
      const fj = flJob(c), at = repairAt(c), te = R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t;
      const pitAt = c.blockAt !== null && !c.pit ? c.blockAt + F.pitHold : null, ready = at === null ? null : Math.max(at, pitAt ?? at);
      const lapsLeft = fj && c.fail.due !== null ? c.fail.due - c.laps.length : null, last = c.failures && c.failures.length ? c.failures[c.failures.length - 1] : null;
      return { active: !!fj, name: fj ? fj.name : '', level: fj ? fj.level : '', urgent: !!(fj && fj.urgent), action: fj ? fj.action : '', seconds: fj ? fj.seconds : 0, within: fj ? fj.within : 0, lapsLeft,
        standLeft: fj && ready !== null && c.repairedAt !== c.blockAt && R.status === 'running' ? Math.max(0, ready - te) : null, tone: Fl.toneOf(fj, lapsLeft !== null && lapsLeft < 0),
        out: c.failOut || '', count: c.failN || 0, repaired: (c.failures || []).filter(x => !x.out).length, last: last ? last.name : '' };
    };

    // What the Race Director can do with the failure of car i right now: give it one (it is racing, has no failure and does not stand on the sensor) or clear the one it has (also a failure that put the car out).
    R.failureCan = i => {
      const c = R.cars[i]; if (!FL || !c || !['running', 'paused'].includes(R.status)) return { give: false, clear: false };
      return { give: !c.fail && !c.failOut && !c.done && !c.dq && !c.dmgOut && c.blockAt === null, clear: !!c.fail || !!c.failOut };
    };
    // The Race Director gives car i a failure: k is its number in the list of the Damage System, or -1 (or nothing) for one at random (by the chances of the list; all alike when none has a chance).
    // It counts for the car like the ones that were rolled at the start (the limit for a car in a race is for those), and the failures of the plan that are left still come.
    R.giveFailure = (i, k, t) => {
      if (!systemOn('damage')) return false;
      const c = R.cars[i]; if (!R.failureCan(i).give) return false;
      let n = Number.isInteger(k) && k >= 0 ? k : -1;
      if (n >= FL.list.length) return false;
      if (n < 0) {
        const total = FL.list.reduce((a, f) => a + f.chance, 0);
        if (total > 0) { let r = flRnd() * total; n = FL.list.findIndex(f => (r -= f.chance) < 0); if (n < 0) n = FL.list.length - 1; } else n = Math.min(FL.list.length - 1, Math.floor(flRnd() * FL.list.length));
      }
      flStart(c, i, t, n, 'director'); return true;
    };
    // The Race Director clears the failure of car i (a mistake, or a car that does not need to stop). A car that a failure put out is back in the race, as a car is when the damage that put it out is taken back.
    R.clearFailure = (i, t) => {
      const c = R.cars[i]; if (!R.failureCan(i).clear) return false;
      if (c.fail) {
        const name = c.fail.name; c.failures.push({ at: t, ms: 0, name, lap: c.fail.lap, cleared: true }); c.fail = null;
        log('failurecleared', i, t, { name, by: 'director' }); return true;
      }
      const rec = [...c.failures].reverse().find(x => x.out), was = c.failWas || {};
      const stillDq = !!(P.dq && c.points >= P.dq); // (a car that has too many penalty points is out for that reason)
      if (rec) { delete rec.out; rec.cleared = true; }
      c.failOut = ''; c.failWas = null;
      if (!stillDq) { c.dq = false; c.done = !!was.done; c.retired = !!was.retired; c.repairedAt = null; }
      log('failurecleared', i, t, { name: rec ? rec.name : '', by: 'director', out: true });
      if (!stillDq) log('reinstated', i, t, { by: 'failure' });
      return true;
    };
    R.failureNoteOf = i => (FL && R.cars[i] ? Fl.noteOf(R.cars[i], R.events, i) : ''); // what the failures did to car i in this race, in words (empty when nothing)

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
    // The time a car has been racing (the Total Time widget, 1.63.0). Before the car has finished it is the race clock, so it counts up; once the car is done it is the time of its last crossing
    // (a car that is out keeps the time of its last lap), and a car that is still racing when the race is stopped has the time the race lasted. t: the moment to read it at.
    // penalties: plus the time penalties and the corrections of the review (the time the results count); without them it is the time on the clock.
    R.spentOf = (c, t, penalties) => (c.done ? c.total : R.elapsed(t)) + (penalties ? addOf(c) : 0);
    R.compare = TDS; R.distOf = c => (TDS ? prog(c) : null); // (1.64.0: the settings of a timed race that is compared by distance, or null; the metres a car has driven in it, laps times the length of its lane)
    R.lapLimit = lapLimit; R.limitOf = limitOf; R.distance = DS; // (limitOf: the laps this car has to drive; distance: the settings of a Distance Race, or null)
    // Did the car finish a race by laps? It drove all the laps, and was not retired or disqualified.
    R.finishedLaps = c => limitOf(c) > 0 && c.done && !c.retired && !c.dq && c.laps.length - (c.swapLost || 0) >= limitOf(c);
    // The time the car would have needed for all the laps: what it has, plus the laps it still had to drive at its own average lap (the laps that count for averages).
    // Null when it has no lap to average, or when it was retired or disqualified (such a car has no finish time to guess).
    R.estimateOf = c => {
      if (!(limitOf(c) > 0) || c.retired || c.dq) return null;
      if (R.finishedLaps(c)) return R.timeOf(c);
      const g = goodLaps(c); if (!g.length) return null;
      return R.timeOf(c) + Math.max(0, limitOf(c) - c.laps.length) * (g.reduce((a, b) => a + b, 0) / g.length);
    };
    R.addTime = (i, ms) => { const c = R.cars[i]; if (!c || !(ms > 0)) return false; c.extraMs = (c.extraMs || 0) + ms; log('timeadded', i, R.endAt, { ms }); return true; };
    R.setDq = (i, on) => {
      const c = R.cars[i]; if (!c || c.dq === !!on) return false;
      if (on) { c.dq = true; c.dqWasDone = c.done; c.dqWasRetired = c.retired; c.done = true; c.retired = true; log('disqualified', i, R.endAt); }
      else { c.dq = false; c.done = !!c.dqWasDone; c.retired = !!c.dqWasRetired; log('reinstated', i, R.endAt); }
      return true;
    };
    // Keep sample identity, not just lap times: review edits must change future
    // benchmarks without rewriting fuel or wear already consumed. Older snapshots
    // have only time arrays. Recover unambiguous groups; ambiguous equal-time
    // samples warm up again rather than guessing which yellow/off-system lap counts.
    function ensurePaceEligibility(c) {
      if (Array.isArray(c.paceEligibility) && c.paceEligibility.length === c.laps.length) return;
      c.paceEligibility = c.laps.map(() => ({ ps: false, tw: false }));
      const candidates = new Map();
      c.laps.forEach((ms, n) => {
        if ((c.bad || [])[n] || (c.pitLaps || []).includes(n) || (c.redLaps || []).includes(n)) return;
        if (!candidates.has(ms)) candidates.set(ms, []);
        candidates.get(ms).push(n);
      });
      for (const [key, history] of [['ps', c.psPace], ['tw', c.twPace]]) {
        const counts = new Map();
        (history || []).forEach(ms => counts.set(ms, (counts.get(ms) || 0) + 1));
        counts.forEach((count, ms) => { const ns = candidates.get(ms) || []; if (ns.length === count) ns.forEach(n => { c.paceEligibility[n][key] = true; }); });
      }
    }
    function rebuildPace(c) {
      ensurePaceEligibility(c);
      const excluded = new Set([...(c.invalid || []), ...(c.removed || []), ...(c.redLaps || [])]);
      const samples = key => c.laps.filter((ms, n) => ms > 0 && !excluded.has(n) && !(c.bad || [])[n] && c.paceEligibility[n]?.[key]);
      c.psPace = samples('ps'); c.twPace = samples('tw');
    }
    R.setInvalid = (i, n, on) => {
      const c = R.cars[i]; if (!c || !(n >= 0 && n < c.laps.length)) return false;
      if (!on && (c.redLaps || []).includes(n)) return false;
      const has = c.invalid.includes(n); if (!!on === has) return false;
      ensurePaceEligibility(c);
      c.invalid = on ? [...c.invalid, n].sort((a, b) => a - b) : c.invalid.filter(x => x !== n); rebest(c); rebuildPace(c); return true;
    };
    // recalc: the lap also leaves the race (one lap fewer, less time); otherwise it only leaves the records
    R.removeLap = (i, n, recalc) => {
      const c = R.cars[i]; if (!c || !(n >= 0 && n < c.laps.length)) return false;
      ensurePaceEligibility(c);
      if (!recalc) { if (!c.removed.includes(n)) c.removed = [...c.removed, n].sort((a, b) => a - b); rebuildPace(c); return true; }
      const gone = c.laps[n]; c.laps.splice(n, 1); c.bad.splice(n, 1); c.paceEligibility.splice(n, 1); if (c.ps) c.ps.splice(n, 1);
      const shift = list => list.filter(x => x !== n).map(x => (x > n ? x - 1 : x));
      c.invalid = shift(c.invalid); c.removed = shift(c.removed); c.yellowFast = shift(c.yellowFast || []); c.pitLaps = shift(c.pitLaps || []);
      if (c.redLaps) c.redLaps = shift(c.redLaps);
      if (c.fuelSamples) c.fuelSamples = c.fuelSamples.filter(x => x.lap !== n).map(x => ({ ...x, lap: x.lap > n ? x.lap - 1 : x.lap }));
      c.total = Math.max(0, c.total - gone); rebest(c); rebuildPace(c); return true; // (every crossing after it comes that much sooner; the time before the first crossing, when the first lap is skipped, stays in the total)
    };

    // the time of the pit stop in progress (or the last one): { live, ms } or null
    R.pitTime = (i, t) => {
      const c = R.cars[i];
      if (c.blockAt !== null && c.pit) return { live: true, ms: (R.status === 'paused' ? R.pausedAt : R.status === 'finished' ? R.endAt : t) - c.blockAt };
      return c.lastPit ? { live: false, ms: c.lastPit.duration } : null;
    };

    const cum = (car, n) => car.laps.slice(0, n).reduce((a, b) => a + b, 0);
    // The race clock at the first crossing of the line, when the first lap is skipped (0 otherwise): a car that crossed 3 seconds later is 3 seconds behind with equal laps. The order is by the clock at the last crossing, so the gaps are too.
    const startOf = c => (Number.isFinite(c.total) && c.laps.length ? Math.max(0, c.total - cum(c, c.laps.length)) : 0);
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
    const STATE = ['status', 't0', 'pausedAt', 'endAt', 'timeUp', 'finished', 'endedBy', 'yellowAt', 'flag', 'bopActive', 'bopSpread', 'wxState', 'wxStage', 'twTeams', 'resumes', 'systemState'];
    R.resumes = 0; // how many times this race was continued after an interruption
    // (a car is kept as what differs from its entry: the names, the pictures and the roster of the entry are made again from the entry, so a snapshot stays small)
    // 1.60.4: a field is the entry's own when it is the very same value (a picture is the same text as the entry's: it is not turned into text, twice, to see that). Only values that are not the same are compared as text, as before.
    const sameField = (a, b) => a === b || (typeof a === 'string' && typeof b === 'string' ? false : JSON.stringify(a) === JSON.stringify(b));
    R.snapshot = t => {
      if(R.status==='paused')R.cars.forEach(c=>tempUpdate(c,t));
      const cars = R.cars.map((c, i) => { const e = cfg.entries[i] || {}, d = {}; Object.keys(c).forEach(k => { if (!(k in e) || !sameField(c[k], e[k])) d[k] = c[k]; }); return d; });
      const snap = { ...(R.resources?{resources:R.resources}:{}), v: 1, at: t, callId, cars, events: R.events, calls: R.calls, rulesSnapshot: R.rulesSnapshot() }; STATE.forEach(k => { snap[k] = R[k]; });
      if (RN && RN.plan) snap.rn = { plan: RN.plan, unit: RN.unit, i: RN.i, up: RN.up, lastEnd: RN.lastEnd, warnedFor: RN.warnedFor, soon: RN.soon };
      return JSON.parse(JSON.stringify(snap));
    };
    R.restore = snap => {
      if (!snap || snap.v !== 1 || !Array.isArray(snap.cars) || snap.cars.length !== R.cars.length || !['running', 'paused', 'finished', ...(R.resources?['ready']:[])].includes(snap.status)) return false;
      const x = JSON.parse(JSON.stringify(snap));
      if(R.resources&&x.resources)Object.assign(R.resources,x.resources);
      if (x.rulesSnapshot?.version === 1 && x.rulesSnapshot.config && typeof x.rulesSnapshot.config === 'object') startingRules = x.rulesSnapshot.config;
      STATE.forEach(k => { if (x[k] !== undefined) R[k] = x[k]; });
      scWas = R.scOut(); // (the Safety Car that was out stays out, without a new line in the log)
      if (RN && x.rn && Array.isArray(x.rn.plan)) { // (the random flags go on by the same plan: the places that were passed stay passed)
        const q = x.rn, up = q.up && Number.isFinite(Number(q.up.yEl)) ? { yEl: Number(q.up.yEl), liftAt: q.up.liftAt === null ? null : Number(q.up.liftAt), n: Number(q.up.n) || 1, ...(String(q.up.note || '').trim() ? { note: String(q.up.note).trim().slice(0, 180) } : {}) } : null;
        RN.plan = q.plan.filter(p => p && Number.isFinite(Number(p.at)) && Number.isFinite(Number(p.len))).map(p => ({ at: Number(p.at), len: Number(p.len) })); RN.unit = q.unit === 'laps' ? 'laps' : 'ms';
        RN.i = Math.max(0, Math.min(RN.plan.length, Number(q.i) || 0)); RN.up = up && (up.liftAt === null || Number.isFinite(up.liftAt)) ? up : null; RN.lastEnd = Number.isFinite(Number(q.lastEnd)) ? Number(q.lastEnd) : -1e9; RN.warnedFor = Number.isFinite(Number(q.warnedFor)) ? Number(q.warnedFor) : -1; RN.soon = !!q.soon; R.rndSoon = RN.soon;
      }
      R.cars.length = 0; R.cars.push(...x.cars.map((d, i) => ({ ...(cfg.entries[i] || {}), ...d }))); R.events.length = 0; R.events.push(...(x.events || [])); R.calls.length = 0; R.calls.push(...(x.calls || []));
      R.cars.forEach(rebuildPace);
      R.temperatureRecovered=true; // Offline time is not simulated; the saved temperature resumes unchanged.
      callId = Number(x.callId) || 0; R.resumes = (Number(x.resumes) || 0) + 1;
      if (R.status === 'running') { R.status = 'paused'; R.pausedAt = Number.isFinite(x.at) ? x.at : R.pausedAt; } // (it was racing: it waits, with the clock where it was)
      if (R.systemState) R.syncSystems(R.systemState);
      if (R.status !== 'finished') R.cars.forEach(c => { c.resumed = true; if (heldPits) { c.pitSensor = null; c.pitSensorAt = undefined; if (c.pitHold) { c.pitHold.covered = null; c.pitHold.returned = false; } else if (c.pitRearm) c.pitRearm = true; } });
      return true;
    };
    // Distance Racing: the lanes differ in length, so the laps of two cars do not say who is ahead. A car that has driven its distance ranks first (the first to finish first); the others rank by the
    // distance they have driven (the laps times the length of their lane). A gap is the time between the two cars at the same distance, worked out between the crossings of the line.
    const reached = c => limitOf(c) > 0 && lapsOf(c) >= limitOf(c) && !c.dq;
    const prog = c => Math.round(lapsOf(c) * lenOf(c) * 1e6) / 1e6; // (rounded to a millionth of a metre: 5 laps of 8.2 m and 4 laps of 10.25 m are the same distance)
    const timeAt = (x, d) => { // the time (ms) at which car x had driven distance d, from the laps it has; null when it has not driven that far
      const L = lenOf(x); if (!(L > 0) || !(d >= 0)) return null;
      const full = Math.floor(d / L + 1e-9);
      if (full > x.laps.length) return null;
      if (full === x.laps.length || d / L - full < 1e-9) return cum(x, full);
      return cum(x, full) + (d / L - full) * x.laps[full];
    };
    const distGap = (c, ref) => { // how long after ref car c was at the same distance (null: ref has not driven that far)
      const n = c.laps.length, mine = cum(c, n) + startOf(c) + addOf(c);
      const theirs = reached(c) && reached(ref) ? cum(ref, ref.laps.length) : timeAt(ref, Math.min(n * lenOf(c), ref.laps.length * lenOf(ref)));
      return theirs === null ? null : Math.max(0, mine - (theirs + startOf(ref) + addOf(ref)));
    };
    R.distanceGapTo = (car, reference) => LS && car.laps.length ? distGap(car, reference) : null;
    // ---- Sectors (1.66.0) ----
    // The places a group of cars (all that did not finish, are still in the race and have the same laps, or the same distance) take stay the same; the cars in them are put in order of the sector they were last seen in
    // (the later sector first), then the order the Race Director gave, then how they were (who crossed the line first). A total order, so the sort of the standings stays right.
    R.sectors = SEC;
    const secLive = c => !c.done && !c.retired && !c.dq; // a car that did not finish and is still in the race
    const secGroupKey = c => (LS ? prog(c) : lapsOf(c)) + ':' + (c.sector || 0);
    const secValid = c => Number.isFinite(c.secOrder) && c.secAt === secGroupKey(c);
    const secRefine = order => {
      const same = (a, b) => (LS ? prog(a) === prog(b) : lapsOf(a) === lapsOf(b));
      let i = 0;
      while (i < order.length) {
        let j = i; while (j + 1 < order.length && same(R.cars[order[j + 1]], R.cars[order[i]])) j++;
        const slots = [], list = [];
        for (let k = i; k <= j; k++) if (secLive(R.cars[order[k]])) { slots.push(k); list.push(order[k]); }
        if (list.length > 1) {
          const at = new Map(list.map((x, n) => [x, n]));
          list.sort((x, y) => { const a = R.cars[x], b = R.cars[y]; return (b.sector || 0) - (a.sector || 0) || (secValid(a) ? a.secOrder : 1e9) - (secValid(b) ? b.secOrder : 1e9) || at.get(x) - at.get(y); });
          slots.forEach((k, n) => { order[k] = list[n]; });
        }
        i = j + 1;
      }
    };
    R.sectorName = n => (SEC && n >= 1 && n <= SEC.count ? SEC.names[n - 1] || '' : '');
    // the sector a car was last seen in (a whole number from 1, or null for none): only in the review of a race, and only for a car that did not finish
    R.setSector = (i, n) => {
      const c = R.cars[i]; if (!SEC || !c || R.status !== 'finished' || !secLive(c)) return false;
      const v = n === null || n === undefined || n === '' || Number(n) === 0 ? null : Math.floor(Number(n));
      if (v !== null && !(v >= 1 && v <= SEC.count)) return false;
      if ((c.sector || null) === v) return false;
      c.sector = v; c.secOrder = null; c.secAt = '';
      return true;
    };
    // the cars that are in the same sector with the same laps as this car, in the order of the standings (the Race Director can put one ahead of the other); [] for a car with no sector
    R.sectorGroup = i => {
      const c = R.cars[i]; if (!SEC || !c || !c.sector || !secLive(c)) return [];
      return R.standings().map(x => x.index).filter(k => { const o = R.cars[k]; return secLive(o) && secGroupKey(o) === secGroupKey(c); });
    };
    // dir -1: one place up in its group, 1: one place down
    R.moveSector = (i, dir) => {
      const g = R.sectorGroup(i), p = g.indexOf(i), q = p + dir;
      if (R.status !== 'finished' || (dir !== -1 && dir !== 1) || p < 0 || q < 0 || q >= g.length) return false;
      [g[p], g[q]] = [g[q], g[p]];
      g.forEach((k, n) => { const o = R.cars[k]; o.secOrder = n + 1; o.secAt = secGroupKey(o); });
      return true;
    };
    R.standings = () => {
      const byBest = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12) || (a.best !== null && b.best !== null ? bestAt(a) - bestAt(b) : 0);
      const eff = c => c.total + addOf(c); // total time including time penalties and the adjustment
      const byLaps = (a, b) => lapsOf(b) - lapsOf(a) || eff(a) - eff(b);
      const order = R.cars.map((_, i) => i).sort((x, y) => {
        const a = R.cars[x], b = R.cars[y];
        if (a.retired !== b.retired) return a.retired ? 1 : -1; // retired cars rank behind the rest
        if (LS) { const ra = reached(a), rb = reached(b); if (ra !== rb) return ra ? -1 : 1; if (ra) return eff(a) - eff(b) || a.place - b.place || x - y; return prog(b) - prog(a) || eff(a) - eff(b) || x - y; }
        if (type === 'race' && (a.adjLaps || b.adjLaps) && lapsOf(a) !== lapsOf(b)) return lapsOf(b) - lapsOf(a); // (laps added or taken off in the review count before who finished first)
        if (type === 'race' && a.done !== b.done) return a.done ? -1 : 1;
        if (type === 'race' && a.done && b.done) return lapsOf(b) - lapsOf(a) || eff(a) - eff(b) || a.place - b.place; // (a car that lost a lap in the review, or that retired early, ranks behind the cars that drove more laps: the time only decides between equal laps)
        return ((type === 'practice' || type === 'qualifying') ? byBest(a, b) : byLaps(a, b)) || x - y;
      });
      if (SEC && R.cars.some(c => c.sector)) secRefine(order); // (1.66.0: the cars that did not finish, with the same laps, by the sector they were last seen in; nothing changes until a sector is given)
      const lead = R.cars[order[0]];
      return order.map((i, p) => {
        const c = R.cars[i];
        let gap = '';
        if (c.dq) gap = 'DQ';
        else if (c.retired) gap = 'Out';
        else if (p > 0) {
          if (type === 'practice' || type === 'qualifying') gap = c.best === null ? '' : '+' + fmtTime(c.best - lead.best);
          // always a time: how long after the leader this car reached the lap it has completed (a lapped car is compared at its own lap count)
          else if (LS) { const g = c.laps.length ? distGap(c, lead) : null; if (g !== null) gap = '+' + fmtTime(g); }
          else if (c.laps.length) gap = '+' + fmtTime(Math.max(0, cum(c, c.laps.length) + startOf(c) + addOf(c) - cum(lead, c.laps.length) - startOf(lead) - addOf(lead)));
        }
        return { pos: p + 1, index: i, car: c, gap };
      });
    };
    // Numbers for the spoken calls (see announcer.js): for every car, by its index, the gap to the leader and to the car in front in milliseconds
    // (null when there is none, or the car is out), and how many full laps the car is behind the leader. Practice and qualifying compare best laps.
    R.gapInfo = () => {
      const st = R.standings(), byBest = type === 'practice' || type === 'qualifying', out = new Array(R.cars.length).fill(null);
      const val = (c, k) => cum(c, k) + startOf(c) + addOf(c);
      st.forEach((row, p) => {
        const c = row.car; if (c.dq || c.retired) return;
        let lead = null, ahead = null, down = 0;
        if (p > 0) {
          const L = st[0].car, A = st[p - 1].car;
          if (byBest) { if (c.best !== null && L.best !== null) lead = Math.max(0, c.best - L.best); if (c.best !== null && A.best !== null) ahead = Math.max(0, c.best - A.best); }
          else if (LS) { if (c.laps.length) { lead = distGap(c, L); ahead = distGap(c, A); down = lenOf(L) > 0 ? Math.max(0, Math.floor((prog(L) - prog(c)) / lenOf(L) + 1e-9)) : 0; } }
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
    if (systemsOff.size) { R.systemState = { disabled: [...systemsOff], marks: Object.fromEntries([...systemsOff].map(k => [k, systemMark(0)])) }; R.syncSystems(R.systemState); }
    R.finishByRival = t => end(t, 'Virtual rival reached the finish');
    if (Rival) Rival.attach(R, cfg.multiclass?{...cfg,virtualRivals:(cfg.virtualRivals||[]).map(e=>({...e,profile:{...e.profile,mode:'comparison',canFinish:false}}))}:cfg);
    if(Res) Res.attach(R,cfg);
    if (MC) MC.attach(R, cfg);
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
      byTime: typeof s.byTime === 'boolean' ? s.byTime : s.resultBy === 'time' && s.heatBy !== 'time', // (a settled answer is kept: the heat race is made from the answer of the setup, which knows heatBy)
      // a heat that was not finished: the driver ranks below the finishers ('below', by laps), or the finish time is estimated from the average lap of the driver ('estimate')
      unfinished: s.unfinished === 'estimate' ? 'estimate' : 'below',
      // 1.65.0: heats limited by a time counted by the most laps first, then the lowest total time (lapsFirst); byDistance: the furthest distance first instead of the most laps (the cars are compared by distance)
      lapsFirst: typeof s.lapsFirst === 'boolean' ? s.lapsFirst : s.heatBy === 'time' && s.resultByTime === 'lapstime' && s.resultBy !== 'points',
      byDistance: typeof s.byDistance === 'boolean' ? s.byDistance : s.heatBy === 'time' && s.resultByTime === 'lapstime' && s.resultBy !== 'points' && s.compareBy === 'distance'
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
    if(cfg.multiclass?.pointsMode==='class')cfg={...cfg,classResultBy:cfg.resultBy,classPointsTable:cfg.points,resultBy:cfg.resultBy==='points'?'laps':cfg.resultBy,points:[]};
    const { participants, schedule } = cfg, points = cfg.points || [], sc = scoringOf(cfg), fin = finalsOf(cfg), byTime = sc.byTime, byPoints = !byTime && cfg.resultBy === 'points';
    const lanes = Math.max(1, Math.floor(Number(cfg.lanes)) || schedule.reduce((m, h) => h.reduce((n, e) => Math.max(n, e.lane + 1), m), 1));
    const sizes = finalSizes(participants.filter(p=>!p.virtualRival).length, lanes, fin.finals), names = sizes.length === 2 ? ['B', 'A'] : sizes.length === 1 ? ['A'] : [], rnd = cfg.rnd || Math.random;
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
    const build = race => { // (the result of a race, as H.record keeps it; 1.67.0: H.preview gives the same for the race that is racing now, without keeping it)
      const rows = race.standings().map(r => { // (what the Race Director adjusted in the review is in the row: the laps and the time are the adjusted ones, the championship points come on top of the points of the place)
        const a = race.adjOf ? race.adjOf(r.car) : { ms: 0, laps: 0, points: 0 }; // (a race that is not an engine race, such as a stand-in of a test, has no adjustments)
        const note = race.bopNoteOf && race.cars ? race.bopNoteOf(race.cars.indexOf(r.car)) : ''; // what Balance of Power did to the car, in words
        const tyres = race.tyreNoteOf && race.cars ? race.tyreNoteOf(race.cars.indexOf(r.car)) : ''; // what the tyres did to the car (weather), in words
        const dnote = race.damageNoteOf && race.cars ? race.damageNoteOf(race.cars.indexOf(r.car)) : ''; // what the damage did to the car (the Damage System), in words
        const fnote = race.failureNoteOf && race.cars ? race.failureNoteOf(race.cars.indexOf(r.car)) : ''; // what the failures did to the car (Car Failures), in words
        // result by total race time: did the car finish its laps, and the time of the heat (the finish time, or an estimate for a car that did not finish when the setup asks for one)
        const fin = byTime && race.finishedLaps ? race.finishedLaps(r.car) : false, est = byTime && !fin && sc.unfinished === 'estimate' && race.estimateOf ? race.estimateOf(r.car) : null;
        const tm = fin ? (race.timeOf ? race.timeOf(r.car) : r.car.total + a.ms) : est;
        return { raceClass:r.car.raceClass||'', dq:!!r.car.dq, retired:!!r.car.retired, outOfFuel:!!r.car.outOfFuel, participant: r.car.participant, pos: r.pos, laps: race.lapsOf ? race.lapsOf(r.car) : r.car.laps.length, total: race.timeOf && Number.isFinite(race.timeOf(r.car)) ? race.timeOf(r.car) : a.ms && Number.isFinite(r.car.total) ? r.car.total + a.ms : r.car.total, best: r.car.best, points: r.car.dq ? 0 : (points[r.pos - 1] || 0) + (byPoints ? a.points : 0),
          ...(race.spentOf && Number.isFinite(race.spentOf(r.car, race.endAt, false)) ? { spent: race.spentOf(r.car, race.endAt, false), spentPen: race.spentOf(r.car, race.endAt, true) } : {}), // (1.63.0: the time the car raced in this heat, without and with penalties: the Total Time widget adds up the heats)
          ...(race.compare && race.distOf && Number.isFinite(race.distOf(r.car)) ? { dist: race.distOf(r.car) } : {}), // (1.64.0: heats compared by distance: the metres the car drove in this heat)
          ...(r.car.sector && race.sectorName ? { sector: r.car.sector, ...(race.sectorName(r.car.sector) ? { sectorName: race.sectorName(r.car.sector) } : {}) } : {}), // (1.66.0: the sector the car was last seen in, when the Race Director gave one in the review)
          ...(byTime ? { fin, tm: Number.isFinite(tm) ? tm : null, ...(est !== null && Number.isFinite(est) ? { est: true } : {}) } : {}),
          ...(a.ms ? { adjMs: a.ms } : {}), ...(a.laps ? { adjLaps: a.laps } : {}), ...((byPoints || cfg.classResultBy === 'points') && a.points ? { adjPoints: a.points } : {}), ...(note ? { bopNote: note } : {}), ...(tyres ? { tyreNote: tyres } : {}),
          ...(dnote ? { damageNote: dnote, damagePoints: r.car.dmgTotal || 0, repairs: (r.car.repairs || []).filter(q => !q.out).length, repairMs: r.car.repairMs || 0, ...(r.car.dmgOut ? { damageOut: r.car.dmgOut } : {}) } : {}),
          ...(fnote ? { failureNote: fnote, failures: r.car.failN || 0, failureRepairs: Fl.repairsOf(r.car), failureMs: r.car.failMs || 0, ...(r.car.failOut ? { failureOut: r.car.failOut } : {}) } : {}) };
      });
      if (byPoints && sc.fastestBonus > 0) { // the driver with the fastest lap of this heat gets the bonus (with the same lap time, the one who finished higher)
        let top = null; for (const r of rows) if (!r.dq && Number.isFinite(r.best) && (top === null || r.best < top.best)) top = r;
        if (top) { top.bonus = sc.fastestBonus; top.points += sc.fastestBonus; }
      }
      const wnote = race.weatherNote ? race.weatherNote() : ''; // what the weather did in this heat, in words
      const result = { heat: H.idx + 1, ...(H.idx >= H.count ? { final: names[H.idx - H.count] } : {}), ...(wnote ? { weatherNote: wnote } : {}), rows };
      return result;
    };
    H.preview = build;
    // 1.67.0, for a leaderboard that counts over all heats: what the overall result counts (to tell the gap in it: time, points, metres or laps; metres only when the heats really counted them),
    // and a short text that changes whenever something that is in the result of the race that is racing now changes (laps, a finish, penalties, corrections, sectors), to see when the order has to be made again
    H.kind = rows => (byTime ? 'time' : byPoints ? 'points' : rows && rows.some(o => o.measure === 'distance') ? 'distance' : 'laps');
    H.stamp = race => H.results.length + ':' + (race ? stampOf(race) : '-');
    H.record = race => {
      const result = build(race);
      H.results.push(result); H.idx++;
      if (H.idx === H.count && names.length) H.finalPlan = planFinals();
      return result;
    };
    // The time every participant has raced in the races that are done, for the Total Time widget (1.63.0): [[participant, ms with penalties, ms without penalties]], in the order the participants first raced.
    // A result from before 1.63.0 (a heat race that was interrupted and is picked up again) has no such figures: its race time counts, without the correction of the review for the "without" figure.
    H.spentBy = () => {
      const by = new Map();
      for (const hr of H.results) for (const r of hr.rows) {
        const pen = Number.isFinite(r.spentPen) ? r.spentPen : r.total, clock = Number.isFinite(r.spent) ? r.spent : Number.isFinite(r.total) ? r.total - (r.adjMs || 0) : NaN;
        if (!Number.isFinite(pen) || !Number.isFinite(clock)) continue;
        const a = by.get(r.participant) || [0, 0]; a[0] += pen; a[1] += clock; by.set(r.participant, a);
      }
      return [...by].map(([p, a]) => [p, a[0], a[1]]);
    };
    H.overall = extra => { // (extra: the result of the race that is racing now, from H.preview, to see where everybody stands if it ended now; 1.67.0)
      const rs = extra ? H.results.concat([extra]) : H.results, heatsOf = participants.map(() => []), finalOf = participants.map(() => null), groupOf = participants.map(() => null), added = fin.finalMode === 'added';
      for (const hr of rs) for (const r of (hr === extra && byTime ? hr.rows.filter(x => x.fin) : hr.rows)) { // (heats scored by time: a car of the race that is racing counts when it has finished, as in the saved result)
        if (!heatsOf[r.participant]) continue;
        if (hr.final) finalOf[r.participant] = { ...r, name: hr.final }; else heatsOf[r.participant].push({ ...r, heat: hr.heat });
      }
      if (H.finalPlan) for (const g of H.finalPlan) for (const p of g.drivers) groupOf[p] = g.name;
      // the better heat first: more of what the result counts, then more of the other measure, then the lower total time, then the earlier heat (of two equal heats the later one is the worse)
      // (by total race time the better heat is the faster one: a heat that was not finished ranks after the finished ones, by laps, or by its estimated time when the setup estimates)
      const missing = h => h.tm === null || h.tm === undefined;
      const betterTime = (a, b) => (sc.unfinished === 'estimate' ? (missing(a) - missing(b)) || (missing(a) ? 0 : a.tm - b.tm) : (!a.fin - !b.fin) || (a.fin ? a.tm - b.tm : 0)) || b.laps - a.laps || a.heat - b.heat;
      // 1.65.0, heats limited by a time (lapsFirst): the most laps, or the furthest distance when the cars are compared by distance (every heat holds its metres), then the lowest total time. Without the metres of every heat the laps count.
      const lf = sc.lapsFirst && !byTime && !byPoints, useDist = lf && sc.byDistance && rs.length > 0 && rs.every(hr => hr.rows.every(r => Number.isFinite(r.dist))), msr = h => (useDist ? h.dist : h.laps);
      const better = byTime ? betterTime : lf ? (a, b) => msr(b) - msr(a) || (a.total ?? Infinity) - (b.total ?? Infinity) || a.heat - b.heat : (a, b) => (byPoints ? b.points - a.points || b.laps - a.laps : b.laps - a.laps || b.points - a.points) || (a.total ?? Infinity) - (b.total ?? Infinity) || a.heat - b.heat;
      const acc = participants.map((p, i) => {
        // A DQ heat remains a zero/worst result for dropping and averages, but
        // cannot contribute laps, times, records, adjustments or bonuses.
        const exclude = h => h?.dq ? {...h,laps:0,points:0,best:null,total:null,tm:null,fin:false,est:false,dist:0,adjMs:0,adjLaps:0,adjPoints:0} : h;
        const raw = heatsOf[i], hs = raw.map(exclude), ranked = hs.slice().sort((a,b)=>Number(!!a.dq)-Number(!!b.dq)||better(a,b)), f = exclude(finalOf[i]);
        const attempts=raw.concat(finalOf[i]?[finalOf[i]]:[]), disqualified=(!added&&!!finalOf[i]?.dq)||(attempts.length>0&&attempts.every(h=>h.dq));
        let counted = ranked;
        if (sc.dropWorst && counted.length >= 2) counted = counted.slice(0, -1);
        if (sc.countBy === 'best') counted = counted.slice(0, sc.bestHeats);
        const sum = (list, k) => list.reduce((t, h) => t + h[k], 0), div = sc.countBy === 'average' && counted.length ? counted.length : 1;
        const all = f ? hs.concat([f]) : hs, best = all.reduce((m, h) => (Number.isFinite(h.best) && (m === null || h.best < m) ? h.best : m), null);
        const heatLaps = sum(counted, 'laps') / div, heatPoints = sum(counted, 'points') / div, heatM = counted.reduce((t, h) => t + msr(h), 0) / div; // (what the heats count; a final that is added comes on top of it, and is not averaged, dropped or limited to the best heats)
        // by total race time: the time of the heats that count (a heat without a time counts as not finished), and the final when it is added
        const timed = counted.filter(h => !missing(h)), notFin = counted.length - timed.length, heatTime = timed.length ? sum(timed, 'tm') / (sc.countBy === 'average' ? timed.length : 1) : null;
        const finalMs = f && !missing(f) ? f.tm : null, addFinal = added && f, timeScore = heatTime === null && !(addFinal && finalMs !== null) ? null : (heatTime || 0) + (addFinal && finalMs !== null ? finalMs : 0);
        const adj = k => all.reduce((t, h) => t + (h[k] || 0), 0), am = adj('adjMs'), al = adj('adjLaps'), ap = Math.round(adj('adjPoints') * 100) / 100; // (what was adjusted in the reviews of its races, added up)
        const dmNote = Dm.totalNote(hs, f); // what the damage did to the driver in all its heats and the final, in words
        const flNote = Fl.totalNote(hs, f); // what the failures did to the driver in all its heats and the final, in words
        return { participant: i, ...p, ...(disqualified?{dq:true}:{}), laps: sum(all, 'laps'), points: sum(all, 'points'), best, heats: hs.length, ...(am ? { adjMs: am } : {}), ...(al ? { adjLaps: al } : {}), ...(ap ? { adjPoints: ap } : {}),
          ...(dmNote ? { damageNote: dmNote, damagePoints: all.reduce((t, h) => t + (h.damagePoints || 0), 0), repairs: all.reduce((t, h) => t + (h.repairs || 0), 0), repairMs: all.reduce((t, h) => t + (h.repairMs || 0), 0) } : {}),
          ...(flNote ? { failureNote: flNote, failures: all.reduce((t, h) => t + (h.failures || 0), 0), failureRepairs: all.reduce((t, h) => t + (h.failureRepairs || 0), 0), failureMs: all.reduce((t, h) => t + (h.failureMs || 0), 0) } : {}),
          counted: counted.length, dropped: hs.filter(h => !counted.includes(h)).map(h => h.heat).sort((x, y) => x - y),
          heatScore: byTime ? heatTime : byPoints ? heatPoints : lf ? heatM : heatLaps, scoreLaps: heatLaps + (added && f ? f.laps : 0), scorePoints: heatPoints + (added && f ? f.points : 0), scoreM: heatM + (added && f ? msr(f) : 0),
          ...(useDist ? { measure: 'distance', finalDist: f ? f.dist : null } : {}), ...(lf ? { timeAll: counted.length && counted.every(h => Number.isFinite(h.total)) ? counted.reduce((t, h) => t + h.total, 0) / div : null } : {}),
          ...(byTime ? { timeScore, incomplete: notFin + (addFinal && finalMs === null ? 1 : 0), estimated: counted.filter(h => h.est).length + (addFinal && f.est ? 1 : 0), finalTime: f ? finalMs : null } : {}),
          finalName: groupOf[i], finalPos: f ? f.pos : null, finalLaps: f ? f.laps : null, finalPoints: f ? f.points : null,
          wins: counted.filter(h => !h.dq && h.pos === 1).length, time: counted.reduce((t, h) => t + (h.total ?? Infinity), 0) };
      }).filter(p=>!p.virtualRival);
      const desc = k => (a, b) => b[k] - a[k], bestAsc = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12), timeAsc = (a, b) => (a.time === b.time ? 0 : a.time - b.time);
      const main = byPoints ? 'scorePoints' : lf ? 'scoreM' : 'scoreLaps', other = desc(byPoints ? 'scoreLaps' : 'scorePoints');
      // by total race time: those who finished all the heats that count rank by their time, the lowest first; those with a heat that was not finished come after them (by laps, then fewer heats not finished, then time)
      const done = a => a.incomplete === 0 && a.timeScore !== null;
      const byTimeScore = (a, b) => (done(a) && done(b) ? a.timeScore - b.timeScore : done(a) !== done(b) ? (done(a) ? -1 : 1) : (b.scoreLaps - a.scoreLaps) || (a.incomplete - b.incomplete) || (a.time - b.time)) || 0;
      const chain = [byTime ? byTimeScore : desc(main), ...(lf ? [timeAsc] : []), ...({ default: [other, bestAsc], bestlap: [bestAsc, other], wins: [desc('wins'), other, bestAsc], time: [timeAsc, other, bestAsc] })[sc.tieBreak]];
      // the A final drivers are placed above the B final drivers, and these above everybody else. In a final that is driven, 'places' puts its drivers in the order of that final.
      const tier = a => (a.finalName === 'A' ? 0 : a.finalName === 'B' ? 1 : 2);
      acc.sort((a, b) => {
        if (!!a.dq !== !!b.dq) return a.dq ? 1 : -1;
        const t = tier(a) - tier(b); if (t) return t;
        if (!added && a.finalPos !== null && b.finalPos !== null) return a.finalPos - b.finalPos;
        for (const f of chain) { const v = f(a, b); if (v) return v; }
        return a.participant - b.participant;
      });
      return acc.map(({ time, ...a }, i) => ({ ...a, pos: i + 1, score: byTime ? a.timeScore : byPoints ? a.scorePoints : lf ? a.scoreM : a.scoreLaps }));
    };
    if (MC && cfg.multiclass) H.classOverall = extra => MC.heatStandings(H,cfg,extra,createHeatRace);
    return H;
  }

  const api = { penaltyEffects, fuelUse, goodLaps, averageLaps, memoStep, stampOf, penaltyConfig, penaltyMs, fuelConfig, yellowConfig, createRace, createHeatRace, scoringOf, finalsOf, finalSizes, buildSchedule, fmtTime, MIN_LAP };
  root.RaceEngine = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
