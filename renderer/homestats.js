// The figures of the Home tab (1.17.0): the record to beat on the track of the race setup, the last race with its podium, the totals ("At a glance"),
// the status chips of the welcome band and the colour of a lane. Pure: it only works out numbers and text from the saved sessions and laps, so it can be
// tested without a screen. It counts the same way as Results and Records (database.js): the Racing pool only (a Time Token Session never counts here),
// and a lap that was taken out of the records (noTrackRecord) is not the record.
(function (root) {
  const S = typeof module !== 'undefined' ? require('./stats.js') : root.Stats;
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;

  // ---- lane colours ----
  // The colour of a lane: the colour the layout of the race setup gives it on the race screen, else one of eight colours (a Trackmate has up to eight lanes).
  // A colour is only used when it is plain colour text (a hex colour, rgb() or hsl()), because it goes into a style.
  const PALETTE = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a46bff', '#ff7a3d', '#22c5d6', '#e879b9'];
  const SAFE = /^(#[0-9a-f]{3,8}|(rgb|hsl)a?\([0-9 ,.%/]+\))$/i;
  const laneColor = (layout, i) => {
    const c = layout && Array.isArray(layout.laneColors) && layout.laneColors[i] ? layout.laneColors[i].bg : '';
    return typeof c === 'string' && SAFE.test(c.trim()) ? c.trim() : PALETTE[Math.abs(Math.floor(Number(i)) || 0) % PALETTE.length];
  };

  const okTime = l => Number.isFinite(Number(l && l.time)) && Number(l.time) > 0;
  const racing = l => !!l && !l.token; // (a lap of a Time Token Session is in the other pool)
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

  // ---- the record to beat ----
  // the fastest lap on a track that counts for the track record (a lap that was removed from the records, an invalid or a too slow lap, does not)
  function trackRecord(laps, trackId) {
    let best = null;
    if (!trackId) return null;
    for (const l of laps || []) {
      if (!racing(l) || l.trackId !== trackId || l.noTrackRecord || !okTime(l)) continue;
      if (!best || Number(l.time) < Number(best.time)) best = l;
    }
    return best;
  }
  // the quickest personal best on this track among the drivers who are on the grid
  function bestOnGrid(laps, trackId, driverIds) {
    const ids = new Set((driverIds || []).filter(Boolean));
    let best = null;
    if (!trackId || !ids.size) return null;
    for (const l of laps || []) {
      if (!racing(l) || l.trackId !== trackId || l.noPersonalBest || !ids.has(l.driverId) || !okTime(l)) continue;
      if (!best || Number(l.time) < Number(best.time)) best = l;
    }
    return best;
  }
  // ctx: { laps, sessions, trackId, driverIds (the drivers on the grid), driverName(id), carName(id) }
  // -> null when the setup has no track; else { record: null | { time, text, driver, car, date, setupName }, line }
  function recordCard(ctx) {
    const { laps, sessions, trackId, driverIds } = ctx,
      nameOf = id => (ctx.driverName && ctx.driverName(id)) || (id ? '(deleted)' : 'Guest');
    if (!trackId) return null;
    const rec = trackRecord(laps, trackId);
    if (!rec) return { record: null, line: '' };
    const ses = (sessions || []).find(s => s.id === rec.sessionId);
    const record = {
      time: Number(rec.time),
      text: E.fmtTime(Number(rec.time)),
      driver: nameOf(rec.driverId),
      car: (ctx.carName && ctx.carName(rec.carId)) || '',
      date: rec.date || (ses && ses.date) || '',
      setupName: ses ? ses.setupName || '' : ''
    };
    const ids = (driverIds || []).filter(Boolean);
    if (!ids.length) return { record, line: '' };
    const mine = bestOnGrid(laps, trackId, ids);
    if (!mine) return { record, line: 'Nobody on the grid has a lap on this track yet.' };
    const gap = Number(mine.time) - record.time,
      who = nameOf(mine.driverId);
    return {
      record,
      line:
        gap <= 0
          ? `${who} is on the grid and holds the record.`
          : `Closest on the grid: ${who}, ${E.fmtTime(Number(mine.time))} (+${E.fmtTime(gap)}).`
    };
  }

  // ---- the last race ----
  const KIND = {
    race: 'Last race',
    timed: 'Last race',
    heats: 'Last race',
    endurance: 'Last race',
    qualifying: 'Last qualifying',
    practice: 'Last free practice'
  };
  function lastSession(sessions) {
    let last = null;
    for (const s of sessions || []) {
      if (!s || s.sessionType === 'tokens') continue;
      if (!last || String(s.date || '') >= String(last.date || '')) last = s;
    }
    return last;
  }
  // the first three of the standings: a race says how many laps (or points), qualifying and practice say the best lap
  function podium(session) {
    const winner = S.WINNER_TYPES.includes(session.sessionType),
      byPts = session.resultBy === 'points';
    const rows = (session.standings || []).filter(
      x => x && !x.dq && (winner ? Number(x.laps) > 0 : Number.isFinite(Number(x.best)) && Number(x.best) > 0)
    );
    rows.sort((a, b) => (Number(a.pos) || 999) - (Number(b.pos) || 999));
    // a race whose winner was deleted from the database has no first place left: the runner-up stays second
    const gap =
      winner && rows.length && !(session.standings || []).some(x => x && Number(x.pos) === 1)
        ? Math.max(0, Math.floor(Number(rows[0].pos)) - 1 || 0)
        : 0;
    return rows.slice(0, 3).map((x, i) => ({
      pos: i + 1 + gap,
      name: (x.asTeam ? x.teamName || x.driverName : x.driverName) || 'Guest',
      ...(x.carName ? { car: x.carName } : {}),
      detail: winner
        ? byPts && Number.isFinite(Number(x.points))
          ? `${x.points} pts`
          : plural(Number(x.laps), 'lap', 'laps')
        : E.fmtTime(Number(x.best))
    }));
  }
  // ctx: { sessions, laps, driverName(id) } -> null (nothing raced yet) or { label, date, setupName, trackName, podium, fastest: null | { time, text, driver } }
  function lastRace(ctx) {
    const s = lastSession(ctx.sessions);
    if (!s) return null;
    let fast = null;
    for (const l of ctx.laps || []) {
      if (!racing(l) || l.sessionId !== s.id || l.invalid || l.tooSlow || l.late || !okTime(l)) continue;
      if (!fast || Number(l.time) < Number(fast.time)) fast = l;
    }
    return {
      label: KIND[s.sessionType] || 'Last session',
      date: s.date || '',
      setupName: s.setupName || '',
      trackName: s.trackName || '',
      podium: podium(s),
      fastest: fast
        ? { time: Number(fast.time), text: E.fmtTime(Number(fast.time)), driver: (ctx.driverName && ctx.driverName(fast.driverId)) || '' }
        : null
    };
  }

  // ---- at a glance ----
  // ctx: { sessions, laps, tracks, driverName(id) } -> { races, laps, distance (metres or null), wins: null | { name, count } }
  function glance(ctx) {
    const sessions = (ctx.sessions || []).filter(s => s && s.sessionType !== 'tokens'),
      laps = (ctx.laps || []).filter(racing);
    const races = sessions.filter(s => S.WINNER_TYPES.includes(s.sessionType)).length;
    const valid = laps.filter(l => okTime(l) && !(l.invalid || l.tooSlow || l.late)).length;
    const byTrack = new Map();
    laps.forEach(l => {
      if (!byTrack.has(l.trackId)) byTrack.set(l.trackId, []);
      byTrack.get(l.trackId).push(l);
    });
    let distance = null;
    byTrack.forEach((list, id) => {
      const d = S.figures(list, (ctx.tracks || []).find(t => t.id === id) || {}, '').distance;
      if (d !== null) distance = (distance || 0) + d;
    });
    const top = winners({ sessions, driverName: ctx.driverName })[0];
    return { races, laps: valid, distance, wins: top ? { name: top.name, count: top.count } : null };
  }

  // ---- car mileage (1.28.0) ----
  // ctx: { laps, tracks, carName(id), carPicture(id), since (a Date or a date text: only the laps from then on count) }
  // -> [{ carId, name, picture, laps, distance (metres or null) }] the car with the most laps first (then the most distance, then A to Z). The laps are the ones of At a glance (a lap of a
  // Time Token Session is not counted, nor a lap that does not count), so the cars add up to that card; the distance is worked out per track with the length of the lane of every lap.
  // A lap without a car, a car that is not in the database any more (no name) and a car without a lap in the period are not in the list.
  function mileage(ctx) {
    const from = ctx.since ? new Date(ctx.since).getTime() : NaN,
      cars = new Map();
    (ctx.laps || []).filter(racing).forEach(l => {
      if (!l.carId || !okTime(l) || l.invalid || l.tooSlow || l.late) return;
      if (Number.isFinite(from) && !(Date.parse(l.date) >= from)) return;
      if (!cars.has(l.carId)) cars.set(l.carId, new Map());
      const byTrack = cars.get(l.carId);
      if (!byTrack.has(l.trackId)) byTrack.set(l.trackId, []);
      byTrack.get(l.trackId).push(l);
    });
    const out = [];
    cars.forEach((byTrack, carId) => {
      const name = (ctx.carName && ctx.carName(carId)) || '';
      if (!name) return;
      let laps = 0,
        distance = null;
      byTrack.forEach((list, trackId) => {
        laps += list.length;
        const d = S.figures(list, (ctx.tracks || []).find(t => t.id === trackId) || {}, '').distance;
        if (d !== null) distance = (distance || 0) + d;
      });
      out.push({ carId, name, picture: (ctx.carPicture && ctx.carPicture(carId)) || '', laps, distance });
    });
    return out.sort((a, b) => b.laps - a.laps || (b.distance || 0) - (a.distance || 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  // ---- who won how often ----
  // ctx: { sessions, driverName(id), since (a Date or a date text: only the races from then on count) }
  // -> [{ name, count, date }] the one with the most wins first; a tie goes to the one who won last, and then to the one who was counted first.
  // A driver, or a team that raced as a team; a Guest has no name to count under. A Time Token Session never counts.
  function winners(ctx) {
    const from = ctx.since ? new Date(ctx.since).getTime() : NaN,
      wins = new Map();
    (ctx.sessions || [])
      .filter(s => s && s.sessionType !== 'tokens')
      .forEach(s => {
        if (Number.isFinite(from) && !(Date.parse(s.date) >= from)) return;
        (s.standings || []).forEach(x => {
          if (!S.isWinner(s, x)) return;
          const key = x.asTeam ? 't:' + (x.teamId || x.teamName || x.driverName || '') : x.driverId ? 'd:' + x.driverId : '';
          if (!key || key === 't:') return;
          const w = wins.get(key) || { count: 0, date: '', name: '' };
          w.count++;
          if (String(s.date || '') >= w.date) {
            w.date = String(s.date || '');
            w.name = (x.asTeam ? x.teamName || x.driverName : (ctx.driverName && ctx.driverName(x.driverId)) || x.driverName) || '';
          }
          wins.set(key, w);
        });
      });
    return [...wins.values()].filter(w => w.name).sort((a, b) => b.count - a.count || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  // ---- the week and the year ----
  // Monday 00:00 of the week of `now` (local time): the week of the fastest laps starts there.
  function weekStart(now) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }
  const yearStart = now => {
    const d = new Date(now);
    return new Date(d.getFullYear(), 0, 1);
  };
  const whole = (v, lo, hi, d) => {
    const n = Math.floor(Number(v));
    return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };

  // ---- recent races ----
  const KINDS = {
    practice: 'Free practice',
    qualifying: 'Qualifying',
    race: 'Race',
    timed: 'Timed race',
    heats: 'Heat-based race',
    endurance: 'Endurance Race'
  };
  // ctx: { sessions, count } -> [{ id, date, name, kind, result }] the newest first; a race says who won, qualifying and free practice the best lap. Time Token Sessions never show.
  function recent(ctx) {
    const n = whole(ctx.count, 1, 20, 5);
    return (ctx.sessions || [])
      .map((s, i) => ({ s, i }))
      .filter(x => x.s && x.s.sessionType !== 'tokens')
      .sort((a, b) => String(b.s.date || '').localeCompare(String(a.s.date || '')) || b.i - a.i)
      .slice(0, n)
      .map(({ s }) => {
        const p = podium(s)[0],
          winner = S.WINNER_TYPES.includes(s.sessionType);
        return {
          id: s.id,
          date: s.date || '',
          name: s.setupName || KINDS[s.sessionType] || 'Race',
          kind: KINDS[s.sessionType] || '',
          type: s.sessionType || '',
          result: !p ? '' : winner && p.pos === 1 ? p.name + ' won' : winner ? p.name + ', ' + p.detail : p.name + ', ' + p.detail
        };
      });
  }

  // ---- the fastest laps of this week ----
  // ctx: { laps, sessions, trackId (the track of the race setup), scope ('track' or 'all'), count (per track), now, driverName(id), trackName(id) }
  // -> { since, tracks: [{ trackId, trackName, rows: [{ driverId, driver, time, text }] }] } the best lap of every driver on a track, the fastest first; tracks A to Z.
  // The laps of a session are dated by the lap itself, else by its session. An invalid, too slow or late lap does not count (as in the last race).
  function fastestWeek(ctx) {
    const since = weekStart(ctx.now || new Date()),
      count = whole(ctx.count, 1, 20, 5),
      all = ctx.scope === 'all',
      dateOf = new Map((ctx.sessions || []).map(s => [s.id, s.date]));
    const best = new Map(); // track|driver -> the lap
    for (const l of ctx.laps || []) {
      if (!racing(l) || !okTime(l) || l.invalid || l.tooSlow || l.late || !l.trackId || !l.driverId || (!all && l.trackId !== ctx.trackId))
        continue;
      if (!(Date.parse(l.date || dateOf.get(l.sessionId)) >= since.getTime())) continue;
      const k = l.trackId + '|' + l.driverId,
        b = best.get(k);
      if (!b || Number(l.time) < Number(b.time)) best.set(k, l);
    }
    const tracks = new Map();
    best.forEach(l => {
      if (!tracks.has(l.trackId)) tracks.set(l.trackId, []);
      tracks.get(l.trackId).push(l);
    });
    const out = [...tracks.entries()].map(([trackId, list]) => ({
      trackId,
      trackName: (ctx.trackName && ctx.trackName(trackId)) || '(deleted)',
      rows: list
        .sort((a, b) => Number(a.time) - Number(b.time))
        .slice(0, count)
        .map(l => ({
          driverId: l.driverId,
          driver: (ctx.driverName && ctx.driverName(l.driverId)) || '(deleted)',
          time: Number(l.time),
          text: E.fmtTime(Number(l.time))
        }))
    }));
    out.sort((a, b) => a.trackName.localeCompare(b.trackName));
    return { since, tracks: out };
  }

  // ---- the records of all tracks ----
  // ctx: { laps, sessions, trackName(id), driverName(id), carName(id) } -> [{ trackId, trackName, time, text, driver, car, date }] tracks A to Z; a track without a lap is not in it.
  function allRecords(ctx) {
    const ids = [...new Set((ctx.laps || []).filter(l => racing(l) && l.trackId).map(l => l.trackId))],
      out = [];
    ids.forEach(id => {
      const rec = trackRecord(ctx.laps, id);
      if (!rec) return;
      const ses = (ctx.sessions || []).find(s => s.id === rec.sessionId);
      out.push({
        trackId: id,
        trackName: (ctx.trackName && ctx.trackName(id)) || '(deleted)',
        time: Number(rec.time),
        text: E.fmtTime(Number(rec.time)),
        driver: (ctx.driverName && ctx.driverName(rec.driverId)) || (rec.driverId ? '(deleted)' : 'Guest'),
        car: (ctx.carName && ctx.carName(rec.carId)) || '',
        date: rec.date || (ses && ses.date) || ''
      });
    });
    return out.sort((a, b) => a.trackName.localeCompare(b.trackName));
  }

  // ---- personal bests of the drivers on the grid ----
  // The best lap of a driver on a track that counts as a personal best (a lap taken out of the personal bests does not).
  function personalBest(laps, trackId, driverId) {
    let best = null;
    if (!trackId || !driverId) return null;
    for (const l of laps || []) {
      if (!racing(l) || l.trackId !== trackId || l.driverId !== driverId || l.noPersonalBest || !okTime(l)) continue;
      if (!best || Number(l.time) < Number(best.time)) best = l;
    }
    return best;
  }
  // ctx: { laps, trackId, grid: [{ driverId, color }], driverName(id) } -> [{ driverId, name, color, time (null: no lap yet), text }] in the order of the lanes; a driver once
  function gridBests(ctx) {
    const seen = new Set(),
      out = [];
    (ctx.grid || []).forEach(g => {
      if (!g || !g.driverId || seen.has(g.driverId)) return;
      seen.add(g.driverId);
      const b = personalBest(ctx.laps, ctx.trackId, g.driverId);
      out.push({
        driverId: g.driverId,
        name: (ctx.driverName && ctx.driverName(g.driverId)) || '(deleted)',
        color: g.color || '',
        time: b ? Number(b.time) : null,
        text: b ? E.fmtTime(Number(b.time)) : '–'
      });
    });
    return out;
  }

  // ---- the rules of a race setup ----
  // names: { typeLabel, rotation, penalty, damage, fuel, weather, safetyCar, pushSave, tyreWear, tyreWearHere } the words for the session type and for the rule sets the setup points at ('' = it points at none, or at one that is gone)
  // -> [[label, text]]. Only what applies to the kind of session: a free practice has no weather, a Time Token Session no penalties.
  function rules(setup, names) {
    if (!setup) return [];
    const t = setup.sessionType,
      n = names || {},
      out = [],
      num = (v, d) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? d : Number(v));
    const heated = t === 'heats' || (t === 'endurance' && setup.enduranceBy === 'heats'),
      laps = num(setup.laps, 10),
      mins = num(setup.duration, 5);
    out.push(['Race', n.typeLabel || t || '']);
    let length = '';
    const dist = () => (typeof module !== 'undefined' ? require('./distance.js') : root.Distance).lengthText(setup, n.distUnit); // (a race by distance: 100 m; n.distUnit is 'm' or 'ft')
    if (t === 'race')
      length =
        setup.raceBy === 'time' ? plural(mins, 'minute', 'minutes') : setup.raceBy === 'distance' ? dist() : plural(laps, 'lap', 'laps');
    else if (t === 'timed' || t === 'qualifying') length = plural(mins, 'minute', 'minutes');
    else if (t === 'endurance' && !heated)
      length =
        setup.enduranceBy === 'laps'
          ? plural(laps, 'lap', 'laps')
          : setup.enduranceBy === 'distance'
            ? dist()
            : plural(mins, 'minute', 'minutes');
    else if (heated) {
      const each =
        setup.heatBy === 'time' ? plural(mins, 'minute', 'minutes') : setup.heatBy === 'distance' ? dist() : plural(laps, 'lap', 'laps');
      length = setup.rotation
        ? `${n.rotation ? 'Rotation "' + n.rotation + '"' : 'A rotation setup'}, heats of ${each}`
        : setup.heatPlan === 'perdriver'
          ? `${plural(num(setup.heatsEach, 3), 'heat', 'heats')} for every driver, each ${each}`
          : setup.heatPlan === 'roundrobin'
            ? `Round robin, heats of ${each}`
            : setup.heatPlan === 'rotation'
              ? `Lane rotation, heats of ${each}`
              : `${plural(num(setup.heats, 3), 'heat', 'heats')} of ${each}`;
    } else length = 'As long as you like';
    out.push(['Length', length]);
    if (heated && (setup.finals === 'a' || setup.finals === 'ab'))
      out.push(['Finals', setup.finals === 'ab' ? 'A final and a B final' : 'A final']);
    if (t === 'endurance') {
      const unit = setup.swapUnit === 'laps' ? 'laps' : 'minutes',
        mode = setup.swapMode || 'every';
      if (setup.swapUnit === 'distance') {
        // (1.35.1: swaps by distance; the lengths are kept in metres, n.distUnit says how to show them)
        const Ds = typeof module !== 'undefined' ? require('./distance.js') : root.Distance,
          at = setup.swapWhere === 'anywhere' ? ', anywhere on the track' : ', at the line',
          one = v =>
            Ds.text(
              v,
              n.distUnit,
              Math.abs(v * (n.distUnit === 'ft' ? 3.28084 : 1) - Math.round(v * (n.distUnit === 'ft' ? 3.28084 : 1))) < 0.05 ? 0 : 1
            );
        const list = String(setup.swapMomentsDist ?? '100, 200')
          .split(/[;,\s]+/)
          .filter(x => x !== '' && Number(x) > 0)
          .map(x => one(Number(x)))
          .join(', ');
        out.push([
          'Driver swaps',
          (mode === 'moments' ? 'At ' + list : mode === 'free' ? 'When the team chooses' : `Every ${one(num(setup.swapEveryDist, 50))}`) +
            at
        ]);
      } else
        out.push([
          'Driver swaps',
          mode === 'moments'
            ? 'At ' + String(setup.swapMoments || '30, 1:00:00, 2:00:00').trim()
            : mode === 'free'
              ? 'When the team chooses'
              : `Every ${num(setup.swapEvery, 30)} ${unit}`
        ]);
    }
    const racing6 = ['practice', 'qualifying', 'race', 'timed', 'heats', 'endurance'].includes(t),
      full = ['race', 'timed', 'heats', 'endurance'].includes(t);
    if (racing6) out.push(['Penalties', n.penalty || 'Off']);
    if (full) out.push(['Damage', n.damage || 'Off']);
    if (racing6) out.push(['Fuel', n.fuel || 'Off']);
    if (full) out.push(['Weather', n.weather || 'Off'], ['Balance of Power', setup.bop === 'on' ? 'On' : 'Off']);
    if (full)
      out.push(['Tyre wear', n.tyreWear || 'Off']); // (1.40.0)
    else if (racing6 && n.tyreWear && n.tyreWearHere) out.push(['Tyre wear', n.tyreWear]); // (a practice or a qualifying has it only when the system says so)
    if (racing6 && n.safetyCar) out.push(['Safety car', n.safetyCar]); // (1.53.0: only when the setup has one; most setups have none)
    if (racing6 && n.pushSave) out.push(['Push and save', n.pushSave]); // (1.54.0: the same)
    return out;
  }

  // ---- the chips of the welcome band ----
  // ctx: { hardware ('none', 'trackmate' or 'arduino': the timing hardware that was chosen; missing = trackmate), trackmate (connected), arduino (connected), virtual (the virtual box is the Arduino Sketch),
  //   netOn, netError, hasSetup, audioName (the audio set of the selected setup, '' = none), drivers, cars, tracks (how many) }
  // -> [{ key, text, state }]  state: 'on' (green light), 'off' (dim light), 'warn' (red light), '' (no light)
  // The first chip is the timing hardware that was chosen (one at a time): green when it is connected, red when it is chosen and not connected, dim when none is chosen.
  // The same words are used on the race screen.
  function timing(ctx) {
    const hw = ctx.hardware || 'trackmate';
    if (hw === 'none') return { key: 'tm', text: 'No timing hardware chosen', state: 'off' };
    const name =
        hw === 'ds'
          ? 'DS Electronics'
          : hw === 'plugin'
            ? ctx.pluginName || 'Plugin interface'
            : hw === 'parallel'
              ? 'Parallel Port'
              : hw === 'arduino'
                ? ctx.virtual
                  ? 'Virtual Arduino Sketch'
                  : 'Arduino Sketch'
                : 'Trackmate',
      on =
        hw === 'ds'
          ? !!ctx.ds
          : hw === 'plugin'
            ? !!ctx.plugin
            : hw === 'parallel'
              ? !!ctx.parallel
              : hw === 'arduino'
                ? !!ctx.arduino
                : !!ctx.trackmate;
    return { key: 'tm', text: name + (on ? ' connected' : ' not connected'), state: on ? 'on' : 'warn' };
  }
  function chips(ctx) {
    const out = [timing(ctx)];
    // what would otherwise go wrong without a word: timing hardware that is connected but does not count laps, and finished races that
    // could not reach the shared library (go: where a click on the chip takes you to put it right)
    if (ctx.unused && ctx.unused.length)
      out.push({
        key: 'unused',
        text: ctx.unused.join(' and ') + (ctx.unused.length > 1 ? ' are' : ' is') + ' connected but not counting laps',
        state: 'warn',
        go: 'hardware',
        title: 'Only the timing hardware in use counts race laps. Open Timing Hardware to choose it.'
      });
    if (ctx.backupFailed)
      out.push({
        key: 'backup',
        text: 'The automatic backup failed',
        state: 'warn',
        go: 'backup',
        title: 'Open Import and Export to see why, and to make a backup now.'
      });
    if (ctx.libraryWaiting > 0)
      out.push({
        key: 'library',
        text: plural(ctx.libraryWaiting, 'result', 'results') + ' waiting for the shared library',
        state: 'warn',
        go: 'connections',
        title:
          'These finished races have not reached the shared library yet, so their records are missing there. Open Connections to see why and retry.'
      });
    out.push(
      ctx.netError
        ? { key: 'net', text: 'Network sharing could not start', state: 'warn' }
        : { key: 'net', text: ctx.netOn ? 'Shared on the network' : 'Not shared on the network', state: ctx.netOn ? 'on' : 'off' }
    );
    if (ctx.hasSetup)
      out.push(
        ctx.audioName ? { key: 'audio', text: 'Audio: ' + ctx.audioName, state: 'on' } : { key: 'audio', text: 'No audio', state: 'off' }
      );
    out.push({
      key: 'count',
      text: [
        plural(ctx.drivers || 0, 'driver', 'drivers'),
        plural(ctx.cars || 0, 'slotcar', 'slotcars'),
        plural(ctx.tracks || 0, 'track', 'tracks')
      ].join(' · '),
      state: ''
    });
    return out;
  }

  // ---- the start lights ----
  // Is a row of the grid filled in? The same rule as the sentences "Lane 1 needs a driver and a car" on the Home tab: a team (heats with teams, an Endurance Race) needs a team and a car,
  // a Time Token Session needs nothing, anything else needs a driver and a car. mode: { byTeam, enduSingle, tokens }
  const rowReady = (r, mode) => {
    const m = mode || {};
    return m.tokens ? true : m.byTeam || m.enduSingle ? !!(r && r.teamId && r.carId) : !!(r && r.driverId && r.carId);
  };
  // how many places are ready, with the words for it: "3 of 4 lanes are ready". A participant that is not here today (a rotation) is not counted.
  // blocked: something else stops the race (a driver on two lanes, a team without drivers...): then a full grid is "filled in", not "ready".
  function lights(rows, mode, noun, blocked) {
    const list = (rows || []).filter(r => !(r && r.absent)),
      ok = list.map(r => mode?.ready?.(r) ?? rowReady(r, mode)),
      n = ok.filter(Boolean).length,
      word = noun || 'lane',
      all = n === list.length;
    const text = !list.length
      ? ''
      : all
        ? list.length === 1
          ? `The ${word} is ${blocked ? 'filled in' : 'ready'}.`
          : `All ${list.length} ${word}s are ${blocked ? 'filled in' : 'ready'}.`
        : `${n} of ${list.length} ${word}s ${n === 1 ? 'is' : 'are'} ready.`;
    return { ok, ready: n, total: list.length, text };
  }

  // ---- 2.4.0: the figures of the new Home cards ----
  // races a week: the number of races (the types that have a winner) in each of the last `weeks` weeks, the oldest first; the last one is this week (from Monday)
  function racesPerWeek(sessions, now, weeks) {
    const n = whole(weeks, 1, 52, 12),
      start = weekStart(now || new Date()).getTime(),
      WEEK = 7 * 864e5,
      out = new Array(n).fill(0);
    (sessions || []).forEach(s => {
      if (!s || !S.WINNER_TYPES.includes(s.sessionType)) return;
      const t = Date.parse(s.date);
      if (!Number.isFinite(t)) return;
      const back = t >= start ? 0 : Math.floor((start - t) / WEEK) + 1;
      if (back < n) out[n - 1 - back]++;
    });
    return out;
  }
  // Lane balance: the best lap and the number of laps of every lane on a track. laps: the laps (a lap of a Time Token Session, an invalid, too slow or late lap does not count)
  // -> [{ lane (1 is the first), time, text, laps }] by lane
  function laneBalance(ctx) {
    const by = new Map();
    for (const l of ctx.laps || []) {
      if (!racing(l) || !okTime(l) || l.invalid || l.tooSlow || l.late || l.trackId !== ctx.trackId) continue;
      const lane = Math.round(Number(l.lane));
      if (!(lane >= 1 && lane <= 64)) continue;
      const b = by.get(lane) || { lane, time: Infinity, laps: 0 };
      b.laps++;
      if (Number(l.time) < b.time) b.time = Number(l.time);
      by.set(lane, b);
    }
    return laneRows([...by.values()]);
  }
  // (the same rows from rows of { lane, time (best), laps } that a database worked out itself)
  const laneRows = rows =>
    (rows || [])
      .filter(r => r && Number(r.lane) >= 1 && Number.isFinite(Number(r.time)) && Number(r.time) > 0)
      .map(r => ({
        lane: Math.round(Number(r.lane)),
        time: Number(r.time),
        text: E.fmtTime(Number(r.time)),
        laps: Math.max(0, Math.round(Number(r.laps)) || 0)
      }))
      .sort((a, b) => a.lane - b.lane);
  // the races of the drivers, the newest first: [{ date, standings }] of the session types that have a winner, a driver as himself (not in a team)
  const races = sessions =>
    (sessions || [])
      .filter(s => s && S.WINNER_TYPES.includes(s.sessionType) && Array.isArray(s.standings) && s.standings.length)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const placeOf = (s, id) => {
    const x = s.standings.find(r => r && !r.asTeam && r.driverId === id);
    if (!x) return null;
    if (x.dq) return 'dq';
    const p = Math.floor(Number(x.pos));
    return p >= 1 ? p : null;
  };
  // Grid form: for every driver of the grid, the places of his last `count` races (the newest first; 'dq' for a disqualification), how many races and wins he has.
  // ctx: { sessions, driverIds, count, driverName(id) } -> [{ driverId, name, places, races, wins }] in the order of the grid
  function gridForm(ctx) {
    const n = whole(ctx.count, 1, 20, 10),
      list = races(ctx.sessions);
    return [...new Set((ctx.driverIds || []).filter(Boolean))].map(id => {
      const all = list.map(s => placeOf(s, id)).filter(p => p !== null);
      return {
        driverId: id,
        name: (ctx.driverName && ctx.driverName(id)) || '',
        places: all.slice(0, n),
        races: all.length,
        wins: all.filter(p => p === 1).length
      };
    });
  }
  // Head to head: of every two drivers of the grid, how often the one finished ahead of the other in a race they both drove, when they last met, and the best lap of each in those races.
  // ctx: { sessions, driverIds, driverName(id) } -> { ids, names, wins: [[n]] (wins[a][b]: a ahead of b), met: [[n]], last: [[date]], best: [time | null] }
  function headToHead(ctx) {
    const ids = [...new Set((ctx.driverIds || []).filter(Boolean))].slice(0, 8),
      k = ids.length,
      grid = () => ids.map(() => new Array(k).fill(0));
    const wins = grid(),
      met = grid(),
      last = ids.map(() => new Array(k).fill('')),
      best = new Array(k).fill(null);
    races(ctx.sessions).forEach(s => {
      const place = ids.map(id => placeOf(s, id)),
        rowOf = ids.map(id => s.standings.find(r => r && !r.asTeam && r.driverId === id));
      for (let a = 0; a < k; a++) {
        if (place[a] === null) continue;
        const b0 = Number(rowOf[a] && rowOf[a].best);
        for (let b = 0; b < k; b++) {
          if (a === b || place[b] === null) continue;
          met[a][b]++;
          if (!last[a][b]) last[a][b] = s.date || '';
          const pa = place[a] === 'dq' ? Infinity : place[a],
            pb = place[b] === 'dq' ? Infinity : place[b];
          if (pa < pb) wins[a][b]++;
          if (Number.isFinite(b0) && b0 > 0 && (best[a] === null || b0 < best[a])) best[a] = b0;
        }
      }
    });
    return { ids, names: ids.map(id => (ctx.driverName && ctx.driverName(id)) || ''), wins, met, last, best };
  }
  // Milestones: the next round number of races and wins of every driver of the grid, and of laps of the cars of the grid; the nearest first.
  // ctx: { sessions, driverIds, driverName(id), cars: [{ id, name, laps }] } -> [{ kind ('races' | 'wins' | 'laps'), name, at (the round number), now (where it is), left, tonight }]
  const STEPS = {
    races: [10, 25, 50, 75, 100, 150, 200, 250, 300, 400, 500, 750, 1000],
    wins: [1, 5, 10, 25, 50, 75, 100, 150, 200, 300, 500],
    laps: [500, 1000, 2000, 2500, 5000, 7500, 10000, 15000, 20000, 25000, 50000, 100000]
  };
  const nextStep = (kind, v) => STEPS[kind].find(x => x > v) || null;
  function milestones(ctx) {
    const list = races(ctx.sessions),
      out = [];
    [...new Set((ctx.driverIds || []).filter(Boolean))].forEach(id => {
      const name = (ctx.driverName && ctx.driverName(id)) || '';
      if (!name) return;
      const places = list.map(s => placeOf(s, id)).filter(p => p !== null),
        n = places.length,
        w = places.filter(p => p === 1).length;
      const r = nextStep('races', n);
      if (r) out.push({ kind: 'races', name, at: r, now: n, left: r - n, tonight: r - n === 1 });
      const v = nextStep('wins', w);
      if (v && v - w <= Math.max(2, Math.ceil(v * 0.2))) out.push({ kind: 'wins', name, at: v, now: w, left: v - w, tonight: false });
    });
    (ctx.cars || []).forEach(c => {
      const laps = Math.max(0, Math.round(Number(c && c.laps)) || 0),
        at = nextStep('laps', laps);
      if (c && c.name && at) out.push({ kind: 'laps', name: c.name, at, now: laps, left: at - laps, tonight: false });
    });
    return sortMilestones(out);
  }
  // the nearest first: tonight, then by the share of the way still to go
  const sortMilestones = list => {
    const share = m => m.left / Math.max(1, m.at);
    return (list || []).slice().sort((a, b) => b.tonight - a.tonight || share(a) - share(b) || a.left - b.left);
  };

  // Heat standings: the overall standings of the last heat-based race (sessions of type heats). ctx: { sessions, count, driverName(id) }
  // -> null (no heat race yet) or { id, date, setupName, trackName, byPoints, rows: [{ pos, name, driverId, car, laps, points, best, bestText, dq }] }
  function heatStandings(ctx) {
    const s = (ctx.sessions || [])
      .filter(x => x && x.sessionType === 'heats' && Array.isArray(x.standings) && x.standings.length)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))[0];
    if (!s) return null;
    const n = whole(ctx.count, 1, 20, 8),
      byPoints = s.resultBy === 'points';
    const rows = s.standings
      .filter(Boolean)
      .slice()
      .sort((a, b) => (a.dq ? 1 : 0) - (b.dq ? 1 : 0) || (Number(a.pos) || 999) - (Number(b.pos) || 999))
      .slice(0, n)
      .map(x => {
        const best = Number(x.best);
        return {
          pos: Math.floor(Number(x.pos)) || null,
          name: (x.asTeam ? x.teamName || x.driverName : (ctx.driverName && ctx.driverName(x.driverId)) || x.driverName) || 'Guest',
          driverId: x.asTeam ? '' : x.driverId || '',
          car: x.carName || '',
          laps: Math.max(0, Math.round(Number(x.laps)) || 0),
          points: Number.isFinite(Number(x.points)) ? Number(x.points) : null,
          best: Number.isFinite(best) && best > 0 ? best : null,
          bestText: Number.isFinite(best) && best > 0 ? E.fmtTime(best) : '',
          dq: !!x.dq
        };
      });
    return { id: s.id || '', date: s.date || '', setupName: s.setupName || '', trackName: s.trackName || '', byPoints, rows };
  }

  const api = {
    heatStandings,
    racesPerWeek,
    laneBalance,
    laneRows,
    gridForm,
    headToHead,
    milestones,
    sortMilestones,
    PALETTE,
    laneColor,
    trackRecord,
    bestOnGrid,
    recordCard,
    lastSession,
    podium,
    lastRace,
    glance,
    chips,
    timing,
    rowReady,
    lights,
    winners,
    weekStart,
    yearStart,
    recent,
    fastestWeek,
    allRecords,
    personalBest,
    gridBests,
    rules,
    mileage
  };
  root.HomeStats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
