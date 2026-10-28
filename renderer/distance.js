// Distance Racing (1.35.0): a race that is driven for a distance, instead of laps or time. This file holds the sums and nothing else (no screen, no clock of its own),
// so they can be tested on their own. A timing sensor sees a car once a lap, so a distance is always worked out from the laps: the laps a car has driven times the length of its lane.
// The race engine (engine.js) is given the laps every lane has to drive (cfg.distance); the widgets (timing.js) use look() and text().
//
// All lengths are metres here. How a length is shown (metres or feet) is the setting Distance unit of App Settings: text() takes the unit.
(function (root) {
  const Sp = typeof module !== 'undefined' ? require('./speed.js') : root.Speed;
  const MODES = ['same', 'laps', 'manual'], ROUNDS = ['up', 'nearest'];
  const EPS = 1e-6;
  const pos = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; };

  // Is the race limited by a distance? For a race setup as it was saved (an Endurance Race "by distance" or with heats by distance), and for the setup the race screen works with.
  function isOn(s) {
    if (!s) return false;
    const t = s.sessionType;
    return (t === 'race' && s.raceBy === 'distance') || (t === 'heats' && s.heatBy === 'distance') || (t === 'endurance' && (s.enduranceBy === 'distance' || (s.enduranceBy === 'heats' && s.heatBy === 'distance')));
  }

  const modeOf = s => (s && MODES.includes(s.distanceMode) ? s.distanceMode : 'same');
  const roundOf = s => (s && ROUNDS.includes(s.distanceRound) ? s.distanceRound : 'up');

  // The length that is meant when it is said "the track": the length of the track (the outside lane), or without one the longest lane.
  function reference(track, lanes) {
    const own = pos(track && track.length);
    if (own) return own;
    let best = 0;
    for (let l = 0; l < Math.max(1, Math.floor(Number(lanes)) || 1); l++) best = Math.max(best, pos(Sp.laneLength(track || {}, l)));
    return best;
  }

  // How many laps it takes to drive a distance on a lane of this length: at least the distance ('up', the default) or the number of laps that comes closest ('nearest'). Never less than one lap.
  function lapsFor(distance, length, round) {
    const d = pos(distance), l = pos(length);
    if (!d || !l) return 0;
    const x = d / l;
    return Math.max(1, round === 'nearest' ? Math.round(x + EPS) : Math.ceil(x - EPS));
  }

  // The distance the race setup asks for, per lane (setup: the race setup as the race screen has it; the final of a heat race passes its own distance in setup.distance).
  //   mode 'same':   every lane drives the same distance (the laps differ with the length of the lane)
  //   mode 'laps':   every lane drives the same number of laps: the laps it takes to drive the distance on a lane of the track length
  //   mode 'manual': every lane has the distance typed in setup.laneDistances (lane 1 first); a lane without one drives the distance of the setup
  // -> null when the race is not limited by a distance. Otherwise { mode, round, distance (the asked one), max (minutes, 0 = no limit), lanes: [{ lane, length, asked, laps, distance }] } with one entry for every lane:
  //   length: the lane in metres (0 when it is not known), asked: the distance the lane was asked to drive, laps: the laps it has to drive (0 when it cannot be worked out),
  //   distance: what it really drives, the laps times the length (it is a little more than asked when the distance is not a whole number of laps, and a little less with 'nearest').
  function config(setup, track, lanes) {
    if (!isOn(setup)) return null;
    const n = Math.max(1, Math.floor(Number(lanes)) || 1), mode = modeOf(setup), round = roundOf(setup), main = pos(setup.distance), ref = reference(track, n);
    const own = Sp.parseLaneLengths(setup.laneDistances);
    const out = Array.from({ length: n }, (_, l) => {
      const length = pos(Sp.laneLength(track || {}, l)), asked = mode === 'manual' ? pos(own[l]) || main : main;
      const laps = mode === 'laps' ? lapsFor(main, ref, round) : lapsFor(asked, length, round);
      return { lane: l, length, asked: mode === 'laps' ? (length ? laps * length : 0) : asked, laps: length && laps ? laps : 0, distance: length && laps ? laps * length : 0 };
    });
    return { mode, round, distance: main, max: pos(setup.distanceMax), lanes: out };
  }

  // Cars compared by distance (1.64.0): a race, a heat or an Endurance Race that is limited by a TIME can rank its cars by the distance they drove (the laps times the length of their lane) instead of by laps.
  // The race still ends when the time is up; only the order changes. Works for a saved setup (race and raceBy 'time', heats and heatBy 'time', endurance by time or heat-based by time) and for the setup the race screen works with ('timed').
  function timeLimited(s) {
    const t = s && s.sessionType;
    return t === 'timed' || (t === 'race' && s.raceBy === 'time') || (t === 'heats' && s.heatBy === 'time') || (t === 'endurance' && (s.enduranceBy === 'time' || (s.enduranceBy === 'heats' && s.heatBy === 'time')));
  }
  const compareOn = s => !!s && s.compareBy === 'distance' && timeLimited(s);
  // -> null when the cars are compared by laps. Otherwise { by: 'distance', lanes: [{ lane, length }] }, one entry for every lane (length 0 when it is not known; the engine then compares by laps).
  function compare(setup, track, lanes) {
    if (!compareOn(setup)) return null;
    const n = Math.max(1, Math.floor(Number(lanes)) || 1);
    return { by: 'distance', lanes: Array.from({ length: n }, (_, l) => ({ lane: l, length: pos(Sp.laneLength(track || {}, l)) })) };
  }
  // Every lane needs a length for it, as a sentence for the Home tab ('no length' is in every sentence, as in swapProblem); '' when nothing is missing.
  function compareProblem(setup, track, lanes) {
    if (!compareOn(setup) || !track) return '';
    const n = Math.max(1, Math.floor(Number(lanes)) || 1), missing = []; for (let l = 0; l < n; l++) if (!pos(Sp.laneLength(track, l))) missing.push(l + 1);
    if (!missing.length) return '';
    return `The cars are compared by distance, so the lane lengths are needed. ${missing.length === n ? 'The track has no length' : missing.length === 1 ? 'Lane ' + missing[0] + ' has no length' : 'Lanes ' + missing.join(', ') + ' have no length'}. Add ${missing.length === n ? 'the track length' : 'the lane lengths'} in the Database.`;
  }

  // Sectors (1.66.0): the track says how many sectors it has (a whole number from 2; empty, 0 or 1 = none) and, if it wants, a name for each, separated by commas, in driving order. Sector 1 starts at the timing line.
  // -> null (no sectors) or { count, names: [one name for every sector, '' for a sector without one] }
  const MAX_SECTORS = 12;
  function sectors(track) {
    const n = Math.floor(Number(track && track.sectors));
    if (!(n >= 2)) return null;
    const count = Math.min(MAX_SECTORS, n), given = String((track && track.sectorNames) || '').split(',').map(x => x.trim());
    return { count, names: Array.from({ length: count }, (_, i) => given[i] || '') };
  }
  // "Sector 3" or "Sector 3 · Hairpin" (a name that was given): how a sector is called in the review
  const sectorLabel = (sec, n) => `Sector ${n}${sec && sec.names && sec.names[n - 1] ? ` \u00b7 ${sec.names[n - 1]}` : ''}`;

  // What keeps a distance race from being raced on this track, as a sentence for the Home tab; '' when nothing does.
  function problem(setup, track, lanes) {
    if (!isOn(setup)) return compareProblem(setup, track, lanes); // (a race by time that is compared by distance needs the lane lengths too)
    const n = Math.max(1, Math.floor(Number(lanes)) || 1), mode = modeOf(setup);
    if (!pos(setup.distance)) return 'This race setup has no distance. Add it in Race Setup.';
    if (!track) return '';
    if (mode === 'laps') return reference(track, n) ? '' : 'The track has no length, so the laps for the distance cannot be worked out. Add the track length in the Database.';
    const missing = []; for (let l = 0; l < n; l++) if (!pos(Sp.laneLength(track, l))) missing.push(l + 1);
    if (!missing.length) return '';
    return missing.length === n ? 'The track has no length, so the laps for the distance cannot be worked out. Add the track length in the Database.'
      : `${missing.length === 1 ? 'Lane ' + missing[0] + ' has' : 'Lanes ' + missing.join(', ') + ' have'} no length, so the laps for the distance cannot be worked out. Add the lane lengths in the Database.`;
  }

  // What keeps driver swaps that are counted in distance (1.35.1) from working: the distance a car has driven is its laps times the length of its lane, so every lane needs a length. '' when nothing does.
  function swapProblem(setup, track, lanes) {
    if (!setup || (setup.sessionType !== 'endurance' && setup.ofType !== 'endurance') || setup.swapUnit !== 'distance' || !track) return ''; // (the race screen and Home work with the setup as Endurance.effective makes it: a race, with ofType 'endurance')
    const n = Math.max(1, Math.floor(Number(lanes)) || 1), missing = []; for (let l = 0; l < n; l++) if (!pos(Sp.laneLength(track, l))) missing.push(l + 1);
    if (!missing.length) return '';
    return `The driver swaps are counted in distance, so the lane lengths are needed. ${missing.length === n ? 'The track has no length' : missing.length === 1 ? 'Lane ' + missing[0] + ' has no length' : 'Lanes ' + missing.join(', ') + ' have no length'}. Add ${missing.length === n ? 'the track length' : 'the lane lengths'} in the Database.`;
  }

  // The laps a car has to drive in this setup's lane (0 when it has no limit), for the engine and for the widgets.
  const lapsOfLane = (cfg, lane) => { const l = cfg && Array.isArray(cfg.lanes) ? cfg.lanes[Math.max(0, Math.min(cfg.lanes.length - 1, Math.floor(Number(lane)) || 0))] : null; return l ? l.laps : 0; };

  // The lap time to estimate with: the average of the last three laps that count (a lap that was too slow is left out), else the last lap; null without a lap.
  function expectedLap(laps, bad) {
    const good = (laps || []).map((ms, i) => ({ ms, bad: !!(bad && bad[i]) })).filter(x => Number.isFinite(x.ms) && x.ms > 0), ok = good.filter(x => !x.bad), pick = (ok.length ? ok : good).slice(-3);
    return pick.length ? pick.reduce((a, b) => a + b.ms, 0) / pick.length : null;
  }

  // The look at the distance of a car.
  //   length: its lane in metres; laps: the laps that count; limit: the laps it has to drive (0 = no limit)
  //   est: null for the exact distance (it changes when the car crosses the line), or { lapMs, sinceMs } for the smooth one: the part of the lap the car is in, from the time it has taken since it crossed the line and the lap time to expect
  // -> { length, laps, exact (metres at the last crossing), driven (metres, with the estimate), target (metres at the finish line, 0 = no limit), left, lapsLeft, lapsTarget, pct } ; the fields that need a length or a limit are null without one
  function look(length, laps, limit, est) {
    const L = pos(length), n = Math.max(0, Number(laps) || 0), lim = Math.max(0, Math.floor(Number(limit)) || 0);
    if (!L) return { length: 0, laps: n, exact: null, driven: null, target: 0, left: null, lapsLeft: lim ? Math.max(0, lim - n) : null, lapsTarget: lim, pct: null };
    const exact = n * L, running = !lim || n < lim, part = est && running && pos(est.lapMs) && Number(est.sinceMs) > 0 ? Math.min(est.sinceMs / est.lapMs, 0.99) : 0, driven = exact + part * L;
    const target = lim ? lim * L : 0;
    return { length: L, laps: n, exact, driven, target, left: lim ? Math.max(0, target - driven) : null, lapsLeft: lim ? Math.max(0, lim - n) : null, lapsTarget: lim, pct: lim ? Math.min(100, driven / target * 100) : null };
  }

  // A distance as a widget or a table shows it: 84 m, 84.3 m (decimals), 1.23 km; or 276 ft, 1.24 mi. unit: 'm' or 'ft' (anything but 'ft' is metres).
  function text(m, unit, decimals) {
    const v = Number(m); if (!Number.isFinite(v)) return '–';
    const dec = Math.max(0, Math.min(2, Math.floor(Number(decimals)) || 0)), fix = x => (dec ? x.toFixed(dec) : String(Math.round(x)));
    if (unit === 'ft') return v < Sp.M_PER_MILE ? fix(v / Sp.M_PER_FT) + ' ft' : (v / Sp.M_PER_MILE).toFixed(2) + ' mi';
    return v < 1000 ? fix(v) + ' m' : (v / 1000).toFixed(2) + ' km';
  }

  // The length of a race in words, for a summary: "100 m", "328 ft", with what is special about it ("the same laps in every lane", "a distance for each lane").
  function lengthText(setup, unit) {
    const base = text(pos(setup && setup.distance), unit), mode = modeOf(setup);
    return mode === 'laps' ? `${base}, the same laps in every lane` : mode === 'manual' ? `${base} (a distance for each lane)` : base;
  }

  // ---- the widgets ----
  const UNIT = { key: 'unit', label: 'Unit', type: 'select', default: 'setting', choices: [['setting', 'As chosen in App Settings (metres or feet)'], ['m', 'Metres and kilometres'], ['ft', 'Feet and miles']] };
  const UPDATE = { key: 'update', label: 'The distance changes', type: 'select', default: 'smooth', choices: [['smooth', 'Smoothly: estimated between two crossings of the line'], ['exact', 'Only when the car crosses the line (exact)']] };
  const DECIMALS = { key: 'decimals', label: 'Decimals', type: 'select', default: '0', choices: [['0', 'None (84 m)'], ['1', 'One (84.3 m)'], ['2', 'Two (84.27 m)']] };
  const DISTANCE_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'driven', choices: [['driven', 'The distance driven (84 m)'], ['both', 'The distance driven and the distance of the race (84 of 103 m)'], ['percent', 'How much of the race is driven (81%)']] },
    UPDATE, DECIMALS, UNIT];
  const DISTLEFT_OPTIONS = [UPDATE, DECIMALS, UNIT,
    { key: 'words', label: 'Put "to go" behind it (19 m to go)', type: 'checkbox', default: false }];
  const LAPSTOGO_OPTIONS = [
    { key: 'show', label: 'Show', type: 'select', default: 'words', choices: [['words', 'Words (5 laps to go)'], ['number', 'Only the number (5)']] },
    { key: 'lastLap', label: 'Say "Last lap" when one lap is left', type: 'checkbox', default: true }];
  const unitOf = (opt, setting) => (opt && (opt.unit === 'm' || opt.unit === 'ft') ? opt.unit : setting === 'ft' ? 'ft' : 'm');
  const smoothOn = opt => !(opt && opt.update === 'exact');

  const api = { MODES, ROUNDS, isOn, modeOf, roundOf, reference, lapsFor, config, problem, swapProblem, timeLimited, compareOn, compare, compareProblem, sectors, sectorLabel, MAX_SECTORS, lapsOfLane, expectedLap, look, text, lengthText,
    DISTANCE_OPTIONS, DISTLEFT_OPTIONS, LAPSTOGO_OPTIONS, unitOf, smoothOn };
  root.Distance = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
