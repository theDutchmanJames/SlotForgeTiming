// Heat-based races: the schedule of the heats, how heats are scored and combined, finals, and the overall result.
// A heat itself is an ordinary race (createRace in renderer/engine.js); this keeps the event around it.
(function (root) {
  const B = typeof module !== 'undefined' ? require('../bop.js') : root.Bop; // Balance of Power
  const Dm = typeof module !== 'undefined' ? require('../damage.js') : root.Damage; // Damage System
  const Fl = typeof module !== 'undefined' ? require('../failures.js') : root.Failures; // Car Failures
  const MC = typeof module !== 'undefined' ? require('../multiclass.js') : root.MultiClass; // Multi-Class
  const Basics = typeof module !== 'undefined' ? require('./basics.js') : root.RaceEngineBasics;
  const { stampOf } = Basics;

  // ---- heat-based races ----
  const shuffle = (list, rnd = Math.random) => {
    const x = [...list];
    for (let i = x.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [x[i], x[j]] = [x[j], x[i]];
    }
    return x;
  };
  const pairKey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);

  // Returns one array per heat; each holds { p: participant number, lane } entries.
  // plan 'manual': `heats` heats, taking the next group from a shuffled order and wrapping around.
  // plan 'roundrobin': as many heats as it takes for every pair of participants to share a heat.
  function buildSchedule({ count, lanes, plan, heats, rnd }) {
    count = Math.max(0, Math.floor(Number(count)) || 0);
    lanes = Math.max(1, Math.floor(Number(lanes)) || 1); // whole numbers only: a track saved with 0 or 2.5 lanes must not break the schedule
    const k = Math.min(lanes, count);
    const order = shuffle([...Array(count).keys()], rnd);
    const groups = [];
    if (plan === 'roundrobin') {
      if (count <= lanes) groups.push(order);
      else if (k < 2)
        order.forEach(i => groups.push([i])); // one lane: nobody meets anybody, so every driver gets one heat on their own (the pairing below would never finish)
      else {
        const uncovered = new Set();
        for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) uncovered.add(pairKey(a, b));
        const drove = Array(count).fill(0);
        const degree = i => order.filter(j => j !== i && uncovered.has(pairKey(i, j))).length;
        const better = (x, y) => {
          for (let n = 0; n < x.length; n++) if (x[n] !== y[n]) return x[n] > y[n];
          return false;
        };
        const pick = (pool, score) => {
          let best = null,
            bs = null;
          for (const i of pool) {
            const s = score(i);
            if (!bs || better(s, bs)) {
              best = i;
              bs = s;
            }
          }
          return best;
        };
        while (uncovered.size) {
          const g = [pick(order, i => [degree(i), -drove[i]])];
          while (g.length < k) {
            const pool = order.filter(j => !g.includes(j));
            g.push(pick(pool, j => [g.filter(m => uncovered.has(pairKey(j, m))).length, degree(j), -drove[j]]));
          }
          for (let a = 0; a < g.length; a++) {
            drove[g[a]]++;
            for (let b = a + 1; b < g.length; b++) uncovered.delete(pairKey(g[a], g[b]));
          }
          groups.push(g);
        }
      }
    } else {
      let pos = 0;
      for (let h = 0; h < Math.max(1, heats); h++) {
        const g = [];
        for (let j = 0; j < k; j++) g.push(order[pos++ % count]);
        groups.push(g);
      }
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
        free.splice(free.indexOf(best), 1);
        use[p][best]++;
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
    const s = src || {},
      n = Math.floor(Number(s.bestHeats));
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
      lapsFirst:
        typeof s.lapsFirst === 'boolean' ? s.lapsFirst : s.heatBy === 'time' && s.resultByTime === 'lapstime' && s.resultBy !== 'points',
      byDistance:
        typeof s.byDistance === 'boolean'
          ? s.byDistance
          : s.heatBy === 'time' && s.resultByTime === 'lapstime' && s.resultBy !== 'points' && s.compareBy === 'distance'
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
    count = Math.max(0, Math.floor(Number(count)) || 0);
    lanes = Math.max(1, Math.floor(Number(lanes)) || 1);
    const k = Math.min(lanes, count),
      out = [];
    if ((finals !== 'a' && finals !== 'ab') || k < 2) return out;
    out.push(k);
    if (finals === 'ab' && count - k >= 2) out.push(Math.min(k, count - k));
    return out;
  }

  // cfg: { participants: [{driverId, carId, driverName, carName}], schedule, resultBy: laps|points, points: [10, 8, ...], lanes, rnd, and the settings of scoringOf and finalsOf }
  function createHeatRace(cfg) {
    if (cfg.multiclass?.pointsMode === 'class')
      cfg = {
        ...cfg,
        classResultBy: cfg.resultBy,
        classPointsTable: cfg.points,
        resultBy: cfg.resultBy === 'points' ? 'laps' : cfg.resultBy,
        points: []
      };
    const { participants, schedule } = cfg,
      points = cfg.points || [],
      sc = scoringOf(cfg),
      fin = finalsOf(cfg),
      byTime = sc.byTime,
      byPoints = !byTime && cfg.resultBy === 'points';
    const lanes = Math.max(
      1,
      Math.floor(Number(cfg.lanes)) || schedule.reduce((m, h) => h.reduce((n, e) => Math.max(n, e.lane + 1), m), 1)
    );
    const sizes = finalSizes(participants.filter(p => !p.virtualRival).length, lanes, fin.finals),
      names = sizes.length === 2 ? ['B', 'A'] : sizes.length === 1 ? ['A'] : [],
      rnd = cfg.rnd || Math.random;
    const H = {
      schedule,
      idx: 0,
      results: [],
      count: schedule.length,
      total: schedule.length + names.length,
      lanes,
      scoring: sc,
      finals: fin,
      finalPlan: null,
      picks: {}
    };
    H.hasNext = () => H.idx < H.total;
    // A heat race that was interrupted (1.24.0): the state of the heats as plain data, and back. snapshot() holds what changes while the heats are raced: the schedule (to see that it is the same race), the heats that are done, the finals and the lanes chosen for them.
    // restore(snap) puts it into a heat race that was made with the same settings; it says false (and changes nothing) when the schedule, the number of races or the finals do not fit.
    H.snapshot = () =>
      JSON.parse(JSON.stringify({ v: 1, schedule: H.schedule, idx: H.idx, results: H.results, finalPlan: H.finalPlan, picks: H.picks }));
    H.restore = snap => {
      if (
        !snap ||
        snap.v !== 1 ||
        !Array.isArray(snap.results) ||
        !Number.isInteger(snap.idx) ||
        snap.idx < 0 ||
        snap.idx > H.total ||
        snap.results.length !== snap.idx
      )
        return false;
      if (JSON.stringify(snap.schedule) !== JSON.stringify(H.schedule)) return false; // (not the same heats any more: other drivers, other lanes)
      const plan = snap.finalPlan;
      if (names.length && snap.idx >= H.count) {
        if (
          !Array.isArray(plan) ||
          plan.length !== names.length ||
          !plan.every(
            (g, i) =>
              g &&
              g.name === names[i] &&
              Array.isArray(g.drivers) &&
              g.drivers.every(p => Number.isInteger(p) && p >= 0 && p < participants.length)
          )
        )
          return false;
      } else if (plan !== null && plan !== undefined && !Array.isArray(plan)) return false;
      if (snap.picks !== undefined && (snap.picks === null || typeof snap.picks !== 'object' || Array.isArray(snap.picks))) return false;
      const x = JSON.parse(JSON.stringify(snap));
      H.idx = x.idx;
      H.results.length = 0;
      H.results.push(...x.results);
      H.finalPlan = Array.isArray(x.finalPlan) ? x.finalPlan : null;
      H.picks = x.picks || {};
      return true;
    };
    // the finals are known when the last heat is recorded: the best of the heat result race the A final, the next ones the B final (the drivers of a final are listed best first)
    const planFinals = () => {
      const ranked = H.overall().map(o => o.participant),
        a = ranked.slice(0, sizes[0]),
        b = ranked.slice(sizes[0], sizes[0] + (sizes[1] || 0));
      return sizes.length === 2
        ? [
            { name: 'B', drivers: b },
            { name: 'A', drivers: a }
          ]
        : [{ name: 'A', drivers: a }];
    };
    // the final that is next, with the lanes its drivers have chosen so far: { name, drivers, picks: [{p, lane}], next: who chooses now (null when all have), free: the free lanes }
    H.finalNow = () => {
      if (H.idx < H.count || H.idx >= H.total || !H.finalPlan) return null;
      const f = H.finalPlan[H.idx - H.count],
        picks = H.picks[f.name] || [],
        taken = picks.map(x => x.lane);
      const left = f.drivers.filter(p => !picks.some(x => x.p === p));
      return {
        name: f.name,
        drivers: f.drivers,
        picks,
        next: left.length ? left[0] : null,
        free: [...Array(lanes).keys()].filter(l => !taken.includes(l))
      };
    };
    H.raceName = i => (i < H.count ? 'Heat ' + (i + 1) : i < H.total ? 'Final ' + names[i - H.count] : '');
    H.isFinal = () => H.idx >= H.count && H.idx < H.total;
    H.picksDone = () => {
      const f = H.finalNow();
      return !f || f.next === null;
    };
    // the best-placed driver who has not chosen yet takes a free lane. The last driver gets the last free lane by himself: that is no choice.
    H.pick = lane => {
      const f = H.finalNow();
      if (!f) return { error: 'There is no final to choose lanes for.' };
      if (f.next === null) return { error: 'All lanes of this final are chosen.' };
      if (typeof lane === 'string' && lane.trim() !== '') lane = Number(lane); // (a lane from a button comes as text; nothing, null or true is no lane)
      if (!Number.isInteger(lane) || lane < 0 || lane >= lanes) return { error: 'That lane does not exist.' };
      if (!f.free.includes(lane)) return { error: 'That lane is taken.' };
      const list = (H.picks[f.name] = f.picks.concat([{ p: f.next, lane }])),
        rest = f.drivers.filter(p => !list.some(x => x.p === p));
      if (rest.length === 1 && f.free.length === 2) list.push({ p: rest[0], lane: f.free.find(l => l !== lane) });
      return { ok: true };
    };
    // the drivers who have not chosen yet get the free lanes by lot
    H.randomRest = () => {
      const f = H.finalNow();
      if (!f || f.next === null) return false;
      const free = f.free.slice();
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      H.picks[f.name] = f.picks.concat(f.drivers.filter(p => !f.picks.some(x => x.p === p)).map((p, n) => ({ p, lane: free[n] })));
      return true;
    };
    H.clearPicks = () => {
      const f = H.finalNow();
      if (f) H.picks[f.name] = [];
    };
    H.entries = () => {
      const f = H.finalNow();
      if (!f) return schedule[H.idx].map(({ p, lane }) => ({ lane, participant: p, ...participants[p] }));
      // (lanes not chosen yet are given out in the order of the heat result, only to show a full grid: the race does not start before every driver has chosen)
      const free = f.free.slice(),
        all = f.picks.concat(f.drivers.filter(p => !f.picks.some(x => x.p === p)).map(p => ({ p, lane: free.shift() })));
      return all.sort((a, b) => a.lane - b.lane).map(({ p, lane }) => ({ lane, participant: p, ...participants[p] }));
    };
    const build = race => {
      // (the result of a race, as H.record keeps it; 1.67.0: H.preview gives the same for the race that is racing now, without keeping it)
      const rows = race.standings().map(r => {
        // (what the Race Director adjusted in the review is in the row: the laps and the time are the adjusted ones, the championship points come on top of the points of the place)
        const a = race.adjOf ? race.adjOf(r.car) : { ms: 0, laps: 0, points: 0 }; // (a race that is not an engine race, such as a stand-in of a test, has no adjustments)
        const note = race.bopNoteOf && race.cars ? race.bopNoteOf(race.cars.indexOf(r.car)) : ''; // what Balance of Power did to the car, in words
        const tyres = race.tyreNoteOf && race.cars ? race.tyreNoteOf(race.cars.indexOf(r.car)) : ''; // what the tyres did to the car (weather), in words
        const dnote = race.damageNoteOf && race.cars ? race.damageNoteOf(race.cars.indexOf(r.car)) : ''; // what the damage did to the car (the Damage System), in words
        const fnote = race.failureNoteOf && race.cars ? race.failureNoteOf(race.cars.indexOf(r.car)) : ''; // what the failures did to the car (Car Failures), in words
        // result by total race time: did the car finish its laps, and the time of the heat (the finish time, or an estimate for a car that did not finish when the setup asks for one)
        const fin = byTime && race.finishedLaps ? race.finishedLaps(r.car) : false,
          est = byTime && !fin && sc.unfinished === 'estimate' && race.estimateOf ? race.estimateOf(r.car) : null;
        const tm = fin ? (race.timeOf ? race.timeOf(r.car) : r.car.total + a.ms) : est;
        return {
          raceClass: r.car.raceClass || '',
          dq: !!r.car.dq,
          retired: !!r.car.retired,
          outOfFuel: !!r.car.outOfFuel,
          participant: r.car.participant,
          pos: r.pos,
          laps: race.lapsOf ? race.lapsOf(r.car) : r.car.laps.length,
          total:
            race.timeOf && Number.isFinite(race.timeOf(r.car))
              ? race.timeOf(r.car)
              : a.ms && Number.isFinite(r.car.total)
                ? r.car.total + a.ms
                : r.car.total,
          best: r.car.best,
          ...(race.cfg?.rulePlugin ? { pluginPoints: race.pluginPointsOf(r.car, r.pos), pluginTimeMs: race.pluginTimeOf(r.car) } : {}),
          points: r.car.dq ? 0 : (points[r.pos - 1] || 0) + (byPoints ? a.points + (race.pluginPointsOf?.(r.car, r.pos) || 0) : 0),
          ...(race.spentOf && Number.isFinite(race.spentOf(r.car, race.endAt, false))
            ? { spent: race.spentOf(r.car, race.endAt, false), spentPen: race.spentOf(r.car, race.endAt, true) }
            : {}), // (1.63.0: the time the car raced in this heat, without and with penalties: the Total Time widget adds up the heats)
          ...(race.compare && race.distOf && Number.isFinite(race.distOf(r.car)) ? { dist: race.distOf(r.car) } : {}), // (1.64.0: heats compared by distance: the metres the car drove in this heat)
          ...(r.car.sector && race.sectorName
            ? { sector: r.car.sector, ...(race.sectorName(r.car.sector) ? { sectorName: race.sectorName(r.car.sector) } : {}) }
            : {}), // (1.66.0: the sector the car was last seen in, when the Race Director gave one in the review)
          ...(byTime ? { fin, tm: Number.isFinite(tm) ? tm : null, ...(est !== null && Number.isFinite(est) ? { est: true } : {}) } : {}),
          ...(a.ms ? { adjMs: a.ms } : {}),
          ...(a.laps ? { adjLaps: a.laps } : {}),
          ...((byPoints || cfg.classResultBy === 'points') && a.points ? { adjPoints: a.points } : {}),
          ...(note ? { bopNote: note } : {}),
          ...(tyres ? { tyreNote: tyres } : {}),
          ...(dnote
            ? {
                damageNote: dnote,
                damagePoints: r.car.dmgTotal || 0,
                repairs: (r.car.repairs || []).filter(q => !q.out).length,
                repairMs: r.car.repairMs || 0,
                ...(r.car.dmgOut ? { damageOut: r.car.dmgOut } : {})
              }
            : {}),
          ...(fnote
            ? {
                failureNote: fnote,
                failures: r.car.failN || 0,
                failureRepairs: Fl.repairsOf(r.car),
                failureMs: r.car.failMs || 0,
                ...(r.car.failOut ? { failureOut: r.car.failOut } : {})
              }
            : {})
        };
      });
      if (byPoints && sc.fastestBonus > 0) {
        // the driver with the fastest lap of this heat gets the bonus (with the same lap time, the one who finished higher)
        let top = null;
        for (const r of rows) if (!r.dq && Number.isFinite(r.best) && (top === null || r.best < top.best)) top = r;
        if (top) {
          top.bonus = sc.fastestBonus;
          top.points += sc.fastestBonus;
        }
      }
      const wnote = race.weatherNote ? race.weatherNote() : ''; // what the weather did in this heat, in words
      const result = {
        ...(race.cfg?.rulePlugin ? { rulePlugin: race.cfg.rulePlugin } : {}),
        heat: H.idx + 1,
        ...(H.idx >= H.count ? { final: names[H.idx - H.count] } : {}),
        ...(wnote ? { weatherNote: wnote } : {}),
        rows
      };
      return result;
    };
    H.preview = build;
    // 1.67.0, for a leaderboard that counts over all heats: what the overall result counts (to tell the gap in it: time, points, metres or laps; metres only when the heats really counted them),
    // and a short text that changes whenever something that is in the result of the race that is racing now changes (laps, a finish, penalties, corrections, sectors), to see when the order has to be made again
    H.kind = rows => (byTime ? 'time' : byPoints ? 'points' : rows && rows.some(o => o.measure === 'distance') ? 'distance' : 'laps');
    H.stamp = race => H.results.length + ':' + (race ? stampOf(race) : '-');
    H.record = race => {
      const result = build(race);
      H.results.push(result);
      H.idx++;
      if (H.idx === H.count && names.length) H.finalPlan = planFinals();
      return result;
    };
    // The time every participant has raced in the races that are done, for the Total Time widget (1.63.0): [[participant, ms with penalties, ms without penalties]], in the order the participants first raced.
    // A result from before 1.63.0 (a heat race that was interrupted and is picked up again) has no such figures: its race time counts, without the correction of the review for the "without" figure.
    H.spentBy = () => {
      const by = new Map();
      for (const hr of H.results)
        for (const r of hr.rows) {
          const pen = Number.isFinite(r.spentPen) ? r.spentPen : r.total,
            clock = Number.isFinite(r.spent) ? r.spent : Number.isFinite(r.total) ? r.total - (r.adjMs || 0) : NaN;
          if (!Number.isFinite(pen) || !Number.isFinite(clock)) continue;
          const a = by.get(r.participant) || [0, 0];
          a[0] += pen;
          a[1] += clock;
          by.set(r.participant, a);
        }
      return [...by].map(([p, a]) => [p, a[0], a[1]]);
    };
    H.overall = extra => {
      // (extra: the result of the race that is racing now, from H.preview, to see where everybody stands if it ended now; 1.67.0)
      const rs = extra ? H.results.concat([extra]) : H.results,
        heatsOf = participants.map(() => []),
        finalOf = participants.map(() => null),
        groupOf = participants.map(() => null),
        added = fin.finalMode === 'added';
      for (const hr of rs)
        for (const r of hr === extra && byTime ? hr.rows.filter(x => x.fin) : hr.rows) {
          // (heats scored by time: a car of the race that is racing counts when it has finished, as in the saved result)
          if (!heatsOf[r.participant]) continue;
          if (hr.final) finalOf[r.participant] = { ...r, name: hr.final };
          else heatsOf[r.participant].push({ ...r, heat: hr.heat });
        }
      if (H.finalPlan) for (const g of H.finalPlan) for (const p of g.drivers) groupOf[p] = g.name;
      // the better heat first: more of what the result counts, then more of the other measure, then the lower total time, then the earlier heat (of two equal heats the later one is the worse)
      // (by total race time the better heat is the faster one: a heat that was not finished ranks after the finished ones, by laps, or by its estimated time when the setup estimates)
      const missing = h => h.tm === null || h.tm === undefined;
      const betterTime = (a, b) =>
        (sc.unfinished === 'estimate'
          ? missing(a) - missing(b) || (missing(a) ? 0 : a.tm - b.tm)
          : !a.fin - !b.fin || (a.fin ? a.tm - b.tm : 0)) ||
        b.laps - a.laps ||
        a.heat - b.heat;
      // 1.65.0, heats limited by a time (lapsFirst): the most laps, or the furthest distance when the cars are compared by distance (every heat holds its metres), then the lowest total time. Without the metres of every heat the laps count.
      const lf = sc.lapsFirst && !byTime && !byPoints,
        useDist = lf && sc.byDistance && rs.length > 0 && rs.every(hr => hr.rows.every(r => Number.isFinite(r.dist))),
        msr = h => (useDist ? h.dist : h.laps);
      const better = byTime
        ? betterTime
        : lf
          ? (a, b) => msr(b) - msr(a) || (a.total ?? Infinity) - (b.total ?? Infinity) || a.heat - b.heat
          : (a, b) =>
              (byPoints ? b.points - a.points || b.laps - a.laps : b.laps - a.laps || b.points - a.points) ||
              (a.total ?? Infinity) - (b.total ?? Infinity) ||
              a.heat - b.heat;
      const acc = participants
        .map((p, i) => {
          // A DQ heat remains a zero/worst result for dropping and averages, but
          // cannot contribute laps, times, records, adjustments or bonuses.
          const exclude = h =>
            h?.dq
              ? {
                  ...h,
                  laps: 0,
                  points: 0,
                  ...(h.pluginPoints !== undefined ? { pluginPoints: 0 } : {}),
                  best: null,
                  total: null,
                  tm: null,
                  fin: false,
                  est: false,
                  dist: 0,
                  adjMs: 0,
                  adjLaps: 0,
                  adjPoints: 0
                }
              : h;
          const raw = heatsOf[i],
            hs = raw.map(exclude),
            ranked = hs.slice().sort((a, b) => Number(!!a.dq) - Number(!!b.dq) || better(a, b)),
            f = exclude(finalOf[i]);
          const attempts = raw.concat(finalOf[i] ? [finalOf[i]] : []),
            disqualified = (!added && !!finalOf[i]?.dq) || (attempts.length > 0 && attempts.every(h => h.dq));
          let counted = ranked;
          if (sc.dropWorst && counted.length >= 2) counted = counted.slice(0, -1);
          if (sc.countBy === 'best') counted = counted.slice(0, sc.bestHeats);
          const sum = (list, k) => list.reduce((t, h) => t + h[k], 0),
            div = sc.countBy === 'average' && counted.length ? counted.length : 1;
          const all = f ? hs.concat([f]) : hs,
            best = all.reduce((m, h) => (Number.isFinite(h.best) && (m === null || h.best < m) ? h.best : m), null);
          const heatLaps = sum(counted, 'laps') / div,
            heatPoints = sum(counted, 'points') / div,
            heatM = counted.reduce((t, h) => t + msr(h), 0) / div; // (what the heats count; a final that is added comes on top of it, and is not averaged, dropped or limited to the best heats)
          // by total race time: the time of the heats that count (a heat without a time counts as not finished), and the final when it is added
          const timed = counted.filter(h => !missing(h)),
            notFin = counted.length - timed.length,
            heatTime = timed.length ? sum(timed, 'tm') / (sc.countBy === 'average' ? timed.length : 1) : null;
          const finalMs = f && !missing(f) ? f.tm : null,
            addFinal = added && f,
            timeScore =
              heatTime === null && !(addFinal && finalMs !== null) ? null : (heatTime || 0) + (addFinal && finalMs !== null ? finalMs : 0);
          const adj = k => all.reduce((t, h) => t + (h[k] || 0), 0),
            am = adj('adjMs'),
            al = adj('adjLaps'),
            ap = Math.round(adj('adjPoints') * 100) / 100; // (what was adjusted in the reviews of its races, added up)
          const dmNote = Dm.totalNote(hs, f); // what the damage did to the driver in all its heats and the final, in words
          const flNote = Fl.totalNote(hs, f); // what the failures did to the driver in all its heats and the final, in words
          return {
            participant: i,
            ...p,
            ...(all.some(h => h.pluginPoints !== undefined)
              ? {
                  pluginPoints:
                    !added && f
                      ? f.pluginPoints || 0
                      : counted.reduce((n, h) => n + (h.pluginPoints || 0), 0) / div + (added && f ? f.pluginPoints || 0 : 0)
                }
              : {}),
            ...(disqualified ? { dq: true } : {}),
            laps: sum(all, 'laps'),
            points: sum(all, 'points'),
            best,
            heats: hs.length,
            ...(am ? { adjMs: am } : {}),
            ...(al ? { adjLaps: al } : {}),
            ...(ap ? { adjPoints: ap } : {}),
            ...(dmNote
              ? {
                  damageNote: dmNote,
                  damagePoints: all.reduce((t, h) => t + (h.damagePoints || 0), 0),
                  repairs: all.reduce((t, h) => t + (h.repairs || 0), 0),
                  repairMs: all.reduce((t, h) => t + (h.repairMs || 0), 0)
                }
              : {}),
            ...(flNote
              ? {
                  failureNote: flNote,
                  failures: all.reduce((t, h) => t + (h.failures || 0), 0),
                  failureRepairs: all.reduce((t, h) => t + (h.failureRepairs || 0), 0),
                  failureMs: all.reduce((t, h) => t + (h.failureMs || 0), 0)
                }
              : {}),
            counted: counted.length,
            dropped: hs
              .filter(h => !counted.includes(h))
              .map(h => h.heat)
              .sort((x, y) => x - y),
            heatScore: byTime ? heatTime : byPoints ? heatPoints : lf ? heatM : heatLaps,
            scoreLaps: heatLaps + (added && f ? f.laps : 0),
            scorePoints: heatPoints + (added && f ? f.points : 0),
            scoreM: heatM + (added && f ? msr(f) : 0),
            ...(useDist ? { measure: 'distance', finalDist: f ? f.dist : null } : {}),
            ...(lf
              ? {
                  timeAll:
                    counted.length && counted.every(h => Number.isFinite(h.total)) ? counted.reduce((t, h) => t + h.total, 0) / div : null
                }
              : {}),
            ...(byTime
              ? {
                  timeScore,
                  incomplete: notFin + (addFinal && finalMs === null ? 1 : 0),
                  estimated: counted.filter(h => h.est).length + (addFinal && f.est ? 1 : 0),
                  finalTime: f ? finalMs : null
                }
              : {}),
            finalName: groupOf[i],
            finalPos: f ? f.pos : null,
            finalLaps: f ? f.laps : null,
            finalPoints: f ? f.points : null,
            wins: counted.filter(h => !h.dq && h.pos === 1).length,
            time: counted.reduce((t, h) => t + (h.total ?? Infinity), 0)
          };
        })
        .filter(p => !p.virtualRival);
      const desc = k => (a, b) => b[k] - a[k],
        bestAsc = (a, b) => (a.best ?? 1e12) - (b.best ?? 1e12),
        timeAsc = (a, b) => (a.time === b.time ? 0 : a.time - b.time);
      const main = byPoints ? 'scorePoints' : lf ? 'scoreM' : 'scoreLaps',
        other = desc(byPoints ? 'scoreLaps' : 'scorePoints');
      // by total race time: those who finished all the heats that count rank by their time, the lowest first; those with a heat that was not finished come after them (by laps, then fewer heats not finished, then time)
      // (a sum of heat times is only comparable between drivers who count the same number of heats: with countBy 'total' or 'best' and an uneven plan, the one with more heats that count ranks first, as more laps rank
      //  first when the laps are added up, so an extra heat is an advantage and not a handicap; 'average' compares the time per heat and is fair. With the same number of heats for everyone nothing changes.)
      const done = a => a.incomplete === 0 && a.timeScore !== null,
        moreHeats = (a, b) => (sc.countBy === 'average' ? 0 : b.counted - a.counted);
      const byTimeScore = (a, b) =>
        (done(a) && done(b)
          ? moreHeats(a, b) || a.timeScore - b.timeScore
          : done(a) !== done(b)
            ? done(a)
              ? -1
              : 1
            : b.scoreLaps - a.scoreLaps || a.incomplete - b.incomplete || a.time - b.time) || 0;
      const chain = [
        byTime ? byTimeScore : desc(main),
        ...(lf ? [timeAsc] : []),
        ...{ default: [other, bestAsc], bestlap: [bestAsc, other], wins: [desc('wins'), other, bestAsc], time: [timeAsc, other, bestAsc] }[
          sc.tieBreak
        ]
      ];
      // the A final drivers are placed above the B final drivers, and these above everybody else. In a final that is driven, 'places' puts its drivers in the order of that final.
      const tier = a => (a.finalName === 'A' ? 0 : a.finalName === 'B' ? 1 : 2);
      acc.sort((a, b) => {
        if (!!a.dq !== !!b.dq) return a.dq ? 1 : -1;
        const t = tier(a) - tier(b);
        if (t) return t;
        if (!added && a.finalPos !== null && b.finalPos !== null) return a.finalPos - b.finalPos;
        for (const f of chain) {
          const v = f(a, b);
          if (v) return v;
        }
        return a.participant - b.participant;
      });
      return acc.map(({ time, ...a }, i) => ({
        ...a,
        pos: i + 1,
        score: byTime ? a.timeScore : byPoints ? a.scorePoints : lf ? a.scoreM : a.scoreLaps
      }));
    };
    if (MC && cfg.multiclass) H.classOverall = extra => MC.heatStandings(H, cfg, extra, createHeatRace);
    return H;
  }
  const api = { buildSchedule, scoringOf, finalsOf, finalSizes, createHeatRace };
  root.RaceEngineHeats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
