// Race engine basics: time formatting, the fuel, yellow-flag and penalty settings of a race, and which laps count.
// Plain functions without race state; renderer/engine.js (the race) and renderer/engine/heats.js use them.
(function (root) {
  const MIN_LAP = 800; // crossings closer together than this are treated as double triggers
  function fmtTime(ms) {
    if (ms === null || ms === undefined || ms === '' || !Number.isFinite(Number(ms))) return '–';
    ms = Number(ms);
    const neg = ms < 0;
    if (neg) ms = -ms;
    let m = Math.floor(ms / 60000),
      t = ((ms % 60000) / 1000).toFixed(3);
    if (Number(t) >= 60) {
      m += 1;
      t = '0.000';
    } // (59.9996 seconds is 1:00.000, not 60.000)
    return (neg && (m || Number(t)) ? '-' : '') + (m ? m + ':' + t.padStart(6, '0') : t); // (-0.4 ms rounds to 0.000, without a minus)
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
      const target = legacyPace
        ? num(rule.targetLap, num(rule.paceManual, 0))
        : paceSource === 'track'
          ? num(track && track.targetLap, 0)
          : paceSource === 'manual'
            ? num(rule.paceManual, 0)
            : 0;
      return {
        on: true,
        tank: num(rule.tank, 120),
        perLap: num(rule.perLap, 2),
        rate: num(rule.rate, 10),
        paceSource,
        paceTarget: target * 1000,
        legacyPace,
        target: legacyPace ? target * 1000 : 0,
        extra: legacyPace ? num(rule.maxExtra, 25) / 100 : 0,
        saving: legacyPace ? Math.min(1, num(rule.maxSaving, 30) / 100) : 0,
        empty: ['retire', 'stop', 'warn'].includes(rule.empty) ? rule.empty : 'retire',
        pitHold
      };
    }
    const on = setup.fuel === 'on';
    return {
      on,
      tank: num(setup.fuelTank, 120),
      perLap: num(setup.fuelPerLap, 1),
      rate: num(setup.fuelRate, 10),
      paceSource: 'constant',
      paceTarget: 0,
      legacyPace: false,
      target: 0,
      extra: 0,
      saving: 0,
      empty: ['retire', 'stop', 'warn'].includes(setup.fuelEmpty) ? setup.fuelEmpty : 'retire',
      pitHold
    };
  }
  // The yellow flag target lap time of a race setup: retained as a pure legacy
  // reader for old backups; Race Settings no longer supplies it to a new race.
  function yellowConfig(setup) {
    const s = setup || {},
      target = Math.round(num(s.yellowTarget, 0) * 1000);
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
    const s = system || {},
      n = (v, d) => (v === '' || v === undefined || v === null || !Number.isFinite(Number(v)) ? d : Number(v));
    if (!system)
      return { on: false, mode: 'every', every: 5, seconds: 5, steps: [], rules: null, dq: 0, dqUnserved: false, types: [], fuelPoints: 0 };
    // special penalties (Drivethrough, Stop-and-Go...): what they cost in points, how long to stand still, what leaving early and never serving add
    const types = (Array.isArray(s.types) ? s.types : [])
      .filter(t => t && String(t.name || '').trim())
      .map(t => {
        // A saved pre-1.88 named penalty spent points and could add points for leaving early.
        // Keep that behaviour intact; new named penalties give points and/or an immediate effect.
        if (t.effect === undefined)
          return {
            name: String(t.name).trim(),
            legacy: true,
            kind: t.kind === 'drivethrough' ? 'drivethrough' : 'stopgo',
            seconds: Math.max(0, n(t.seconds, 5)),
            cost: Math.max(0, Math.round(n(t.cost, 0))),
            extra: Math.max(0, Math.round(n(t.extra, 1))),
            unserved: Math.max(0, n(t.unserved, 10))
          };
        return {
          name: String(t.name).trim(),
          legacy: false,
          points: Math.max(0, Math.round(n(t.points, 0))),
          effect: ['time', 'laps', 'pit'].includes(t.effect) ? t.effect : 'none',
          amount: Math.max(0, n(t.amount, 0))
        };
      });
    const steps = String(s.steps || '')
      .split(',')
      .map(x => x.split('=').map(y => Number(String(y).trim().replace(',', '.'))))
      .filter(x => x.length === 2 && x.every(Number.isFinite) && x[0] > 0 && x[1] >= 0)
      .sort((a, b) => a[0] - b[0]);
    const rules = Array.isArray(s.rules)
      ? s.rules
          .map(r => ({
            from: Math.max(1, Math.round(n(r.from, 1))),
            time: Math.max(0, n(r.time, 0)),
            laps: Math.max(0, Math.round(n(r.laps, 0))),
            pit: Math.max(0, n(r.pit, 0))
          }))
          .sort((a, b) => a.from - b.from)
      : null;
    return {
      on: true,
      mode: s.timeRule === 'steps' ? 'steps' : 'every',
      every: Math.max(1, n(s.everyPoints, 5)),
      seconds: Math.max(0, n(s.everySeconds, 5)),
      steps,
      rules,
      ruleMode: s.ruleMode || '',
      dq: s.dqOn === 'off' ? 0 : Math.max(0, n(s.dqPoints, 0)),
      dqUnserved: s.dqUnserved === 'on',
      types,
      fuelPoints: Math.max(0, Math.round(n(s.fuelPoints, 0)))
    };
  }
  // New ladders use the highest reached row as the total consequence. This is deliberately
  // separate from the legacy time rule above, so existing saved championships do not change.
  const penaltyEffects = (P, points) => {
    const out = { time: 0, laps: 0, pit: 0, from: 0 };
    if (!P || !P.on || !Array.isArray(P.rules)) return out;
    P.rules.forEach(r => {
      if (points >= r.from) Object.assign(out, { time: r.time, laps: r.laps, pit: r.pit, from: r.from });
    });
    return out;
  };
  const penaltyMs = (P, points) => {
    if (!P || !P.on || points <= 0) return 0;
    if (Array.isArray(P.rules)) return penaltyEffects(P, points).time * 1000;
    if (P.mode === 'steps') {
      let s = 0;
      P.steps.forEach(([p, sec]) => {
        if (points >= p) s = sec;
      });
      return s * 1000;
    }
    return Math.floor(points / P.every) * P.seconds * 1000;
  };

  // lap times without the ones over the track's maximum lap time
  const goodLaps = c => c.laps.filter((_, n) => !(c.bad || [])[n] && !(c.invalid || []).includes(n));
  // the laps the live average and median are made of: as in the saved result, without the laps with a stop in the pits and the laps that were taken out of the records
  const averageLaps = c =>
    c.laps.filter(
      (_, n) => !(c.bad || [])[n] && !(c.invalid || []).includes(n) && !(c.pitLaps || []).includes(n) && !(c.removed || []).includes(n)
    );
  // 1.67.0: what a leaderboard that counts over all heats remembers of a participant after a heat: the lap times that count (the average and the median are made of them, in ms rounded to 3 decimals),
  // the metres (m: of this heat, or not a number when the heat does not know them; dn counts the heats that did, n all heats, so the total is only told when every heat knew its metres)
  // 1.68.0: a short text that changes whenever something that is in the result of a race changes (laps, a finish, penalties, corrections, sectors, the other damage that puts a car out): a leaderboard that counts over the rounds makes its order again only then
  const stampOf = race =>
    race.cars
      .map(c =>
        [
          c.laps.length,
          c.done ? 1 : 0,
          c.total,
          c.dq ? 1 : 0,
          c.retired ? 1 : 0,
          c.dmgOut ? 1 : 0,
          c.failOut ? 1 : 0,
          c.points,
          c.specialLaps,
          c.adjMs,
          c.adjLaps,
          c.adjPoints,
          c.removed.length,
          c.invalid.length,
          c.extraMs,
          c.sector,
          c.secOrder,
          c.best
        ].join(':')
      )
      .join('|');
  const memoStep = (a, c, m) => {
    const p = a || { laps: [], dist: 0, dn: 0, n: 0 };
    return {
      laps: p.laps.concat(averageLaps(c).map(t => Math.round(t * 1000) / 1000)),
      dist: p.dist + (Number.isFinite(m) ? m : 0),
      dn: p.dn + (Number.isFinite(m) ? 1 : 0),
      n: p.n + 1
    };
  };

  // cfg: { type: practice|qualifying|race|timed, laps, duration (minutes), endRule: all|leader, minLap, fuel: fuelConfig(...), entries: [...] }
  const api = {
    fmtTime,
    num,
    fuelConfig,
    yellowConfig,
    fuelUse,
    penaltyConfig,
    penaltyEffects,
    penaltyMs,
    goodLaps,
    averageLaps,
    stampOf,
    memoStep,
    MIN_LAP
  };
  root.RaceEngineBasics = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
