// The extra figures of Results and Records (average and median lap, consistency, speed, distance, pit stops, penalty points) and the columns the tables can show.
// Pure: it only works out numbers and text, so it can be tested without a screen. The screen (database.js) and the PDF (report.js) both use it.
//
// What the figures mean:
//  - A lap counts for the lap figures (average, median, consistency, speed) when it is a valid lap: not invalid, not too slow, not driven after the time was up,
//    and not the lap in which the car stood in the pits (that lap holds the pit stop, so it would spoil the average).
//  - Consistency is how much the valid laps vary: the standard deviation of their times. Lower is steadier.
//  - Distance is what the car drove: every lap that counts (also a pit lap) times the length of the lane it drove in.
//  - Average speed is that distance on the valid laps divided by their time. The scale speed is the same speed at full size (times the scale of the car, or else of the track).
//  - A lap saved without its lane (older sessions) is measured on the track length.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;
  const Sp = typeof module !== 'undefined' ? require('./speed.js') : root.Speed;

  // ---- the columns ----
  // key, label, and whether it is shown until the person turns it off (on). Sessions: the table of a finished race, practice, qualifying or heat race.
  const SESSION_COLUMNS = [
    { key: 'pos', label: 'Pos', on: true }, { key: 'driver', label: 'Driver', on: true }, { key: 'team', label: 'Team', on: true, note: 'only when the race had teams' }, { key: 'car', label: 'Car', on: true }, { key: 'laps', label: 'Laps', on: true },
    { key: 'points', label: 'Points', on: true, note: 'only in a race that is decided on points' }, { key: 'result', label: 'Result', on: true, note: 'only in a heat race with its own scoring' },
    { key: 'final', label: 'Final', on: true, note: 'only in a heat race with finals' },
    { key: 'best', label: 'Best lap', on: true }, { key: 'total', label: 'Total time', on: true, note: 'not in a heat race' },
    { key: 'avg', label: 'Average lap', on: true }, { key: 'median', label: 'Median lap', on: false }, { key: 'spread', label: 'Consistency', on: true },
    { key: 'speed', label: 'Average speed', on: true }, { key: 'scalespeed', label: 'Average scale speed', on: false }, { key: 'distance', label: 'Distance', on: false },
    { key: 'pits', label: 'Pit stops', on: true, note: 'only when the race had fuel or pit stops' }, { key: 'pittime', label: 'Pit time', on: true, note: 'only when the race had fuel or pit stops' },
    { key: 'penalty', label: 'Penalty points', on: true, note: 'only with a penalty system' }
  ];
  // A stint of a Time Token Session (one driver, one lane, one paid time)
  const STINT_COLUMNS = [
    { key: 'driver', label: 'Driver', on: true }, { key: 'car', label: 'Car', on: true }, { key: 'lane', label: 'Lane', on: true }, { key: 'bought', label: 'Time bought', on: true },
    { key: 'laps', label: 'Laps', on: true }, { key: 'late', label: 'Late laps', on: true }, { key: 'best', label: 'Best lap', on: true }, { key: 'total', label: 'Total time', on: true },
    { key: 'avg', label: 'Average lap', on: true }, { key: 'median', label: 'Median lap', on: false }, { key: 'spread', label: 'Consistency', on: false },
    { key: 'speed', label: 'Average speed', on: true }, { key: 'scalespeed', label: 'Average scale speed', on: false }, { key: 'distance', label: 'Distance', on: false }
  ];
  // The track records and personal bests
  const RECORD_COLUMNS = [
    { key: 'track', label: 'Track', on: true }, { key: 'driver', label: 'Driver', on: true }, { key: 'time', label: 'Lap time', on: true }, { key: 'car', label: 'Car', on: true },
    { key: 'speed', label: 'Average speed', on: true }, { key: 'scalespeed', label: 'Average scale speed', on: false }, { key: 'session', label: 'Session', on: true },
    { key: 'lane', label: 'Lane', on: false }, { key: 'lapno', label: 'Lap number', on: false }, { key: 'date', label: 'Set on', on: true }
  ];
  // the columns that are worked out from the laps and the saved figures (the rest the screen already had)
  const FIGURE_KEYS = ['avg', 'median', 'spread', 'speed', 'scalespeed', 'distance', 'pits', 'pittime', 'penalty'];

  // A session that was raced in heats: a heat-based race, or an Endurance Race that was raced heat by heat (1.9.0; its heats are saved the same way)
  const heated = session => !!session && (session.sessionType === 'heats' || (session.sessionType === 'endurance' && Array.isArray(session.heatResults)));

  // ---- the winner ----
  // Who gets the trophy: the first of a race, a timed race or a heat race (practice and qualifying have fastest laps, not winners; a car that was disqualified or out is not a winner).
  const WINNER_TYPES = ['race', 'timed', 'heats', 'endurance'];
  const isWinner = (session, row) => !!session && !!row && WINNER_TYPES.includes(session.sessionType) && Number(row.pos) === 1 && !row.dq && !row.retired && Number(row.laps) > 0;
  // the first of a heat (or final) in the summary of the heats: those rows have no dq or retired
  const isHeatWinner = (session, row) => !!session && !!row && heated(session) && Number(row.pos) === 1 && Number(row.laps) > 0;

  // ---- the time of a heat (a result by total race time) ----
  // The text for the line of a heat in the summary of the heats: ", 1:02.345" for a car that finished, ", 1:03.100 estimated, not finished" for a car that did not (when the setup estimates), ", not finished" otherwise.
  // Only for a session that was counted by time (resultBy 'time'); a result row of a heat has fin (did it finish), tm (the time) and est (the time is an estimate).
  const heatTimeText = (session, row) => {
    if (!session || session.resultBy !== 'time' || !row || row.fin === undefined) return '';
    if (row.fin) return row.tm === null || row.tm === undefined ? '' : ', ' + E.fmtTime(row.tm);
    return row.est && row.tm !== null && row.tm !== undefined ? `, ${E.fmtTime(row.tm)} estimated, not finished` : ', not finished';
  };

  // ---- what the Race Director adjusted ----
  // In the review of a race the Race Director can add or take off race time, laps and championship points of a driver. A result row (or a car of the engine) has them as adjMs, adjLaps and adjPoints.
  // The text for it: "−1 lap, +5 s, +3 pts" (laps, then time, then points; what is zero is left out; nothing adjusted gives '').
  // What Balance of Power did to a car in a race (a result row has it as bopNote, such as "hindered 20% (from the start to lap 12)"): the text to show with the name, or ''
  const bopText = x => (x && x.bopNote ? 'Balance of Power: ' + x.bopNote : '');
  // What the tyres did to a car in a race with a weather system (a result row has it as tyreNote, such as "Wet tyres after lap 9, 2 penalty points for the tyres after lap 11")
  const tyreText = x => (x && x.tyreNote ? 'Tyres: ' + x.tyreNote : '');
  // everything that was done to a car on top of the race, to show with its name
  // What the damage did to a car in a race with a Damage System (a result row has it as damageNote)
  const damageText = x => (x && x.damageNote ? 'Damage: ' + x.damageNote : '');
  // why a car is out of the results, as it is shown after its name: disqualified, or retired (out of fuel, or too much damage); '' for a car that is not out
  const outText = x => (!x ? '' : x.dq ? (x.damageOut === 'dq' ? 'disqualified, too much damage' : 'disqualified') : x.retired ? (x.damageOut ? 'retired, too much damage' : 'retired, out of fuel') : '');
  const notesText = x => [bopText(x), tyreText(x), damageText(x)].filter(Boolean).join('; ');
  // what the weather did in a race or heat (a session or heat result has it as weatherNote, such as "Cloudy from lap 8, rain from lap 10"), or ''
  const weatherText = x => (x && x.weatherNote ? 'Weather: ' + x.weatherNote : '');
  const adjustedText = x => {
    if (!x) return '';
    const part = (v, one, many, show) => { const n = Number(v) || 0; if (!n) return ''; const a = Math.abs(n); return (n < 0 ? '\u2212' : '+') + (show ? show(a) : a) + ' ' + (a === 1 ? one : many); };
    return [part(x.adjLaps, 'lap', 'laps'), part(x.adjMs, 's', 's', ms => Number((ms / 1000).toFixed(3))), part(x.adjPoints, 'pt', 'pts')].filter(Boolean).join(', ');
  };

  // ---- the figures ----
  const clean = l => !(l.invalid || l.tooSlow || l.late);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const mean = a => (a.length ? sum(a) / a.length : null);
  const median = a => {
    if (!a.length) return null;
    const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const spreadOf = a => { // the standard deviation of a sample; it needs two laps
    if (a.length < 2) return null;
    const m = mean(a);
    return Math.sqrt(sum(a.map(x => (x - m) * (x - m))) / (a.length - 1));
  };
  // the length in metres of the lane of one lap (lane: 1 = lane 1); without a lane the track length
  function lapLength(track, lap) {
    const lane = Math.round(Number(lap && lap.lane));
    if (lane >= 1) return Sp.laneLength(track || {}, lane - 1);
    const len = Number(track && track.length);
    return len > 0 ? len : Sp.laneLength(track || {}, 0);
  }
  const factorOf = (track, carScale) => Sp.scaleFactor(carScale) || Sp.scaleFactor(track && track.scale) || null;

  // The figures of the laps of one driver in one session. laps: lap rows; track: the track of the session; carScale: the scale of the car ("1:32") if known.
  function figures(laps, track, carScale) {
    const list = (laps || []).filter(l => Number.isFinite(Number(l.time)) && Number(l.time) > 0);
    const valid = list.filter(l => clean(l) && !l.pit), times = valid.map(l => Number(l.time));
    let dist = 0, haveDist = false, ms = 0, vdist = 0;
    for (const l of list.filter(clean)) { const len = lapLength(track, l); if (len > 0) { dist += len; haveDist = true; } }
    for (const l of valid) { const len = lapLength(track, l); if (len > 0) { vdist += len; ms += Number(l.time); } }
    const speed = ms > 0 ? vdist / (ms / 1000) * 3.6 : null, f = factorOf(track, carScale);
    return { count: valid.length, avg: mean(times), median: median(times), spread: spreadOf(times), distance: haveDist ? dist : null, speed, scalespeed: speed !== null && f ? speed * f : null };
  }
  // The figures of every row of the standings of a session: figures of the laps, plus the pit stops and penalty points that were saved with the session.
  // laps: the lap rows of that session; tracks / cars: the lists of tracks and slotcars (to find the length and the scale).
  // the laps that belong to a row of the standings: a driver's own laps, or all the laps of a team that raced as a team (1.8.0: the laps of every driver who drove for it)
  const ownLaps = (x, laps) => (laps || []).filter(l => (x.asTeam ? !!x.teamId && l.teamId === x.teamId : l.driverId === x.driverId));
  function forSession(session, laps, tracks, cars) {
    const track = (tracks || []).find(t => t.id === session.trackId) || {};
    return (session.standings || []).map(x => {
      const car = (cars || []).find(c => c.id === x.carId);
      const mine = ownLaps(x, laps).filter(l => l.sessionId === undefined || l.sessionId === session.id);
      return { ...figures(mine, track, car && car.scale), pits: x.pits, pitTime: x.pitTime, penalty: x.penaltyPoints };
    });
  }
  // speed of a single lap (a record), real and at scale
  function lapSpeed(lap, tracks, cars) {
    const track = (tracks || []).find(t => t.id === lap.trackId) || {}, car = (cars || []).find(c => c.id === lap.carId);
    const len = lapLength(track, lap), speed = Sp.kmh(len, lap.time), f = factorOf(track, car && car.scale);
    return { speed, scalespeed: speed !== null && f ? speed * f : null };
  }

  // ---- text ----
  const dash = '–';
  const fmtSpeed = v => (v === null || v === undefined ? dash : v.toFixed(1) + ' km/h');
  const fmtScale = v => (v === null || v === undefined ? dash : Math.round(v) + ' km/h');
  const fmtDist = m => (m === null || m === undefined ? dash : m < 1000 ? Math.round(m) + ' m' : (m / 1000).toFixed(2) + ' km');
  const fmtSpread = ms => (ms === null || ms === undefined ? dash : '±' + (ms / 1000).toFixed(3) + ' s');
  const fmtMs = ms => (ms === null || ms === undefined ? dash : E.fmtTime(Math.round(ms)));
  // The value of one of the worked-out columns for one row (fig = a row of forSession); undefined when there is nothing for it
  function valueOf(key, fig) {
    if (!fig) return undefined;
    switch (key) {
      case 'avg': case 'median': case 'spread': case 'speed': case 'scalespeed': case 'distance': return fig[key] === null ? undefined : fig[key];
      case 'pits': return fig.pits;
      case 'pittime': return fig.pits === undefined ? undefined : fig.pitTime || 0;
      case 'penalty': return fig.penalty;
      default: return undefined;
    }
  }
  function text(key, fig) {
    const v = valueOf(key, fig);
    if (v === undefined || v === null) return dash;
    switch (key) {
      case 'avg': case 'median': return fmtMs(v);
      case 'spread': return fmtSpread(v);
      case 'speed': return fmtSpeed(v);
      case 'scalespeed': return fmtScale(v);
      case 'distance': return fmtDist(v);
      case 'pittime': return v > 0 ? fmtMs(v) : dash;
      default: return String(v);
    }
  }
  // does any row have something to show in this column? (a column with nothing in it is left out of the table)
  const hasAny = (key, figs) => (figs || []).some(f => valueOf(key, f) !== undefined);

  // The columns of the table of one session: the ones that apply to it (Points only in a race decided on points, Pit stops only when it was saved with them...)
  function sessionColumns(session, figs) {
    const heats = heated(session), st = session.standings || [];
    const applies = { points: session.resultBy === 'points', result: heats && !!session.scoring && st.some(x => x.score !== undefined), final: heats && !!session.finals, total: !heats, team: st.some(x => x.teamName && !x.asTeam) };
    return SESSION_COLUMNS.filter(c => (c.key in applies ? applies[c.key] : FIGURE_KEYS.includes(c.key) ? hasAny(c.key, figs) : true));
  }

  // the drivers who drove for a team that raced as a team: "Anna (7 laps), Ben (5 laps)" (nothing for a row that is a driver)
  // (an Endurance Race adds the time at the wheel: "Anna (7 laps, 12:30)")
  const clockOf = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  const lapsText = n => `${n} ${Number(n) === 1 ? 'lap' : 'laps'}`;
  const driversText = x => (x && x.asTeam && Array.isArray(x.drivers) && x.drivers.length ? x.drivers.map(d => `${d.driverName || '?'} (${lapsText(d.laps)}${d.ms > 0 ? ', ' + clockOf(d.ms) : ''})`).join(', ') : '');
  // what an Endurance Race adds to a team's row: the swaps, the laps lost to swaps that were not made, and the drivers who drove less than the least they had to
  function enduranceText(x) {
    if (!x || !x.asTeam) return '';
    const out = [];
    if (Number(x.swaps) > 0) out.push(`${x.swaps} ${Number(x.swaps) === 1 ? 'swap' : 'swaps'}`);
    if (Number(x.swapLost) > 0) out.push(`${lapsText(x.swapLost)} not counted for swaps that were not made`);
    if (Array.isArray(x.short) && x.short.length) out.push('drove too little: ' + x.short.map(d => `${d.driverName || '?'} (${lapsText(d.laps)}, ${clockOf(d.ms)})`).join(', '));
    return out.join('; ');
  }
  // the stints of an Endurance Race, per team: [{ team, stints: [{ n, text }] }] (a heat race adds the heat; the time is the race clock)
  function stintLines(session) {
    return ((session && session.standings) || []).filter(x => x.asTeam && Array.isArray(x.stints) && x.stints.length).map(x => ({ team: x.teamName || x.driverName || '', stints: x.stints.map((q, n) => ({ n: n + 1,
      text: `${q.heat ? (q.final ? 'Final ' + q.final : 'Heat ' + q.heat) + ', ' : ''}${q.driverName || '?'}${q.from !== undefined && q.to !== undefined ? ', ' + clockOf(q.from) + ' to ' + clockOf(q.to) : ''}, ${lapsText(q.laps)} (${clockOf(q.ms)})` })) }));
  }

  // The sentences under a table that explain the figures in it (keys: the columns that are shown)
  function notes(keys) {
    const k = new Set(keys), out = [];
    if (['avg', 'median', 'spread', 'speed', 'scalespeed'].some(x => k.has(x))) out.push('Lap figures count the valid laps only: laps that are invalid, too slow, late or that include a pit stop are left out.');
    if (k.has('spread')) out.push('Consistency is how much the lap times vary (the standard deviation): the lower, the steadier.');
    if (k.has('speed') || k.has('scalespeed') || k.has('distance')) out.push('Speeds and the distance come from the length of the lane the car drove in' + (k.has('scalespeed') ? '; the scale speed is that speed at full size.' : '.'));
    return out;
  }

  // a race that was interrupted (a crash, a power cut) and carried on says so under its result (1.9.0)
  const resumeText = session => (session && Number(session.resumed) > 0 ? `This race was interrupted and carried on${Number(session.resumed) > 1 ? ' ' + Number(session.resumed) + ' times' : ''}. The first lap of every car after it is not counted for records.` : '');
  const api = { resumeText, heated, clockOf, enduranceText, stintLines, driversText, ownLaps, SESSION_COLUMNS, STINT_COLUMNS, RECORD_COLUMNS, FIGURE_KEYS, WINNER_TYPES, isWinner, isHeatWinner, heatTimeText, adjustedText, bopText, tyreText, damageText, outText, notesText, weatherText, figures, forSession, lapSpeed, lapLength, valueOf, text, hasAny, sessionColumns, notes, fmtSpeed, fmtScale, fmtDist, fmtSpread, fmtMs };
  root.Stats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
