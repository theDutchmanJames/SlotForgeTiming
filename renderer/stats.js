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
    { key: 'pos', label: 'Pos', on: true }, { key: 'driver', label: 'Driver', on: true }, { key: 'car', label: 'Car', on: true }, { key: 'laps', label: 'Laps', on: true },
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
  function forSession(session, laps, tracks, cars) {
    const track = (tracks || []).find(t => t.id === session.trackId) || {};
    return (session.standings || []).map(x => {
      const car = (cars || []).find(c => c.id === x.carId);
      const mine = (laps || []).filter(l => l.driverId === x.driverId && (l.sessionId === undefined || l.sessionId === session.id));
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
    const heats = session.sessionType === 'heats', st = session.standings || [];
    const applies = { points: session.resultBy === 'points', result: heats && !!session.scoring && st.some(x => x.score !== undefined), final: heats && !!session.finals, total: !heats };
    return SESSION_COLUMNS.filter(c => (c.key in applies ? applies[c.key] : FIGURE_KEYS.includes(c.key) ? hasAny(c.key, figs) : true));
  }

  // The sentences under a table that explain the figures in it (keys: the columns that are shown)
  function notes(keys) {
    const k = new Set(keys), out = [];
    if (['avg', 'median', 'spread', 'speed', 'scalespeed'].some(x => k.has(x))) out.push('Lap figures count the valid laps only: laps that are invalid, too slow, late or that include a pit stop are left out.');
    if (k.has('spread')) out.push('Consistency is how much the lap times vary (the standard deviation): the lower, the steadier.');
    if (k.has('speed') || k.has('scalespeed') || k.has('distance')) out.push('Speeds and the distance come from the length of the lane the car drove in' + (k.has('scalespeed') ? '; the scale speed is that speed at full size.' : '.'));
    return out;
  }

  const api = { SESSION_COLUMNS, STINT_COLUMNS, RECORD_COLUMNS, FIGURE_KEYS, figures, forSession, lapSpeed, lapLength, valueOf, text, hasAny, sessionColumns, notes, fmtSpeed, fmtScale, fmtDist, fmtSpread, fmtMs };
  root.Stats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
