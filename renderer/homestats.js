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
    for (const l of laps || []) { if (!racing(l) || l.trackId !== trackId || l.noTrackRecord || !okTime(l)) continue; if (!best || Number(l.time) < Number(best.time)) best = l; }
    return best;
  }
  // the quickest personal best on this track among the drivers who are on the grid
  function bestOnGrid(laps, trackId, driverIds) {
    const ids = new Set((driverIds || []).filter(Boolean)); let best = null;
    if (!trackId || !ids.size) return null;
    for (const l of laps || []) { if (!racing(l) || l.trackId !== trackId || l.noPersonalBest || !ids.has(l.driverId) || !okTime(l)) continue; if (!best || Number(l.time) < Number(best.time)) best = l; }
    return best;
  }
  // ctx: { laps, sessions, trackId, driverIds (the drivers on the grid), driverName(id), carName(id) }
  // -> null when the setup has no track; else { record: null | { time, text, driver, car, date, setupName }, line }
  function recordCard(ctx) {
    const { laps, sessions, trackId, driverIds } = ctx, nameOf = id => (ctx.driverName && ctx.driverName(id)) || (id ? '(deleted)' : 'Guest');
    if (!trackId) return null;
    const rec = trackRecord(laps, trackId);
    if (!rec) return { record: null, line: '' };
    const ses = (sessions || []).find(s => s.id === rec.sessionId);
    const record = { time: Number(rec.time), text: E.fmtTime(Number(rec.time)), driver: nameOf(rec.driverId), car: (ctx.carName && ctx.carName(rec.carId)) || '', date: rec.date || (ses && ses.date) || '', setupName: ses ? ses.setupName || '' : '' };
    const ids = (driverIds || []).filter(Boolean);
    if (!ids.length) return { record, line: '' };
    const mine = bestOnGrid(laps, trackId, ids);
    if (!mine) return { record, line: 'Nobody on the grid has a lap on this track yet.' };
    const gap = Number(mine.time) - record.time, who = nameOf(mine.driverId);
    return { record, line: gap <= 0 ? `${who} is on the grid and holds the record.` : `Closest on the grid: ${who}, ${E.fmtTime(Number(mine.time))} (+${E.fmtTime(gap)}).` };
  }

  // ---- the last race ----
  const KIND = { race: 'Last race', timed: 'Last race', heats: 'Last race', endurance: 'Last race', qualifying: 'Last qualifying', practice: 'Last free practice' };
  function lastSession(sessions) {
    let last = null;
    for (const s of sessions || []) { if (!s || s.sessionType === 'tokens') continue; if (!last || String(s.date || '') >= String(last.date || '')) last = s; }
    return last;
  }
  // the first three of the standings: a race says how many laps (or points), qualifying and practice say the best lap
  function podium(session) {
    const winner = S.WINNER_TYPES.includes(session.sessionType), byPts = session.resultBy === 'points';
    const rows = (session.standings || []).filter(x => x && !x.dq && (winner ? Number(x.laps) > 0 : Number.isFinite(Number(x.best)) && Number(x.best) > 0));
    rows.sort((a, b) => (Number(a.pos) || 999) - (Number(b.pos) || 999));
    // a race whose winner was deleted from the database has no first place left: the runner-up stays second
    const gap = winner && rows.length && !(session.standings || []).some(x => x && Number(x.pos) === 1) ? Math.max(0, Math.floor(Number(rows[0].pos)) - 1 || 0) : 0;
    return rows.slice(0, 3).map((x, i) => ({
      pos: i + 1 + gap, name: (x.asTeam ? x.teamName || x.driverName : x.driverName) || 'Guest',
      detail: winner ? (byPts && Number.isFinite(Number(x.points)) ? `${x.points} pts` : plural(Number(x.laps), 'lap', 'laps')) : E.fmtTime(Number(x.best))
    }));
  }
  // ctx: { sessions, laps, driverName(id) } -> null (nothing raced yet) or { label, date, setupName, trackName, podium, fastest: null | { time, text, driver } }
  function lastRace(ctx) {
    const s = lastSession(ctx.sessions);
    if (!s) return null;
    let fast = null;
    for (const l of ctx.laps || []) { if (!racing(l) || l.sessionId !== s.id || l.invalid || l.tooSlow || l.late || !okTime(l)) continue; if (!fast || Number(l.time) < Number(fast.time)) fast = l; }
    return { label: KIND[s.sessionType] || 'Last session', date: s.date || '', setupName: s.setupName || '', trackName: s.trackName || '', podium: podium(s),
      fastest: fast ? { time: Number(fast.time), text: E.fmtTime(Number(fast.time)), driver: (ctx.driverName && ctx.driverName(fast.driverId)) || '' } : null };
  }

  // ---- at a glance ----
  // ctx: { sessions, laps, tracks, driverName(id) } -> { races, laps, distance (metres or null), wins: null | { name, count } }
  function glance(ctx) {
    const sessions = (ctx.sessions || []).filter(s => s && s.sessionType !== 'tokens'), laps = (ctx.laps || []).filter(racing);
    const races = sessions.filter(s => S.WINNER_TYPES.includes(s.sessionType)).length;
    const valid = laps.filter(l => okTime(l) && !(l.invalid || l.tooSlow || l.late)).length;
    const byTrack = new Map(); laps.forEach(l => { if (!byTrack.has(l.trackId)) byTrack.set(l.trackId, []); byTrack.get(l.trackId).push(l); });
    let distance = null;
    byTrack.forEach((list, id) => { const d = S.figures(list, (ctx.tracks || []).find(t => t.id === id) || {}, '').distance; if (d !== null) distance = (distance || 0) + d; });
    const top = winners({ sessions, driverName: ctx.driverName })[0];
    return { races, laps: valid, distance, wins: top ? { name: top.name, count: top.count } : null };
  }

  // ---- car mileage (1.28.0) ----
  // ctx: { laps, tracks, carName(id), carPicture(id), since (a Date or a date text: only the laps from then on count) }
  // -> [{ carId, name, picture, laps, distance (metres or null) }] the car with the most laps first (then the most distance, then A to Z). The laps are the ones of At a glance (a lap of a
  // Time Token Session is not counted, nor a lap that does not count), so the cars add up to that card; the distance is worked out per track with the length of the lane of every lap.
  // A lap without a car, a car that is not in the database any more (no name) and a car without a lap in the period are not in the list.
  function mileage(ctx) {
    const from = ctx.since ? new Date(ctx.since).getTime() : NaN, cars = new Map();
    (ctx.laps || []).filter(racing).forEach(l => {
      if (!l.carId || !okTime(l) || l.invalid || l.tooSlow || l.late) return;
      if (Number.isFinite(from) && !(Date.parse(l.date) >= from)) return;
      if (!cars.has(l.carId)) cars.set(l.carId, new Map());
      const byTrack = cars.get(l.carId); if (!byTrack.has(l.trackId)) byTrack.set(l.trackId, []); byTrack.get(l.trackId).push(l);
    });
    const out = [];
    cars.forEach((byTrack, carId) => {
      const name = (ctx.carName && ctx.carName(carId)) || ''; if (!name) return;
      let laps = 0, distance = null;
      byTrack.forEach((list, trackId) => { laps += list.length; const d = S.figures(list, (ctx.tracks || []).find(t => t.id === trackId) || {}, '').distance; if (d !== null) distance = (distance || 0) + d; });
      out.push({ carId, name, picture: (ctx.carPicture && ctx.carPicture(carId)) || '', laps, distance });
    });
    return out.sort((a, b) => b.laps - a.laps || (b.distance || 0) - (a.distance || 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  }

  // ---- who won how often ----
  // ctx: { sessions, driverName(id), since (a Date or a date text: only the races from then on count) }
  // -> [{ name, count, date }] the one with the most wins first; a tie goes to the one who won last, and then to the one who was counted first.
  // A driver, or a team that raced as a team; a Guest has no name to count under. A Time Token Session never counts.
  function winners(ctx) {
    const from = ctx.since ? new Date(ctx.since).getTime() : NaN, wins = new Map();
    (ctx.sessions || []).filter(s => s && s.sessionType !== 'tokens').forEach(s => {
      if (Number.isFinite(from) && !(Date.parse(s.date) >= from)) return;
      (s.standings || []).forEach(x => {
        if (!S.isWinner(s, x)) return;
        const key = x.asTeam ? 't:' + (x.teamId || x.teamName || x.driverName || '') : x.driverId ? 'd:' + x.driverId : '';
        if (!key || key === 't:') return;
        const w = wins.get(key) || { count: 0, date: '', name: '' };
        w.count++; if (String(s.date || '') >= w.date) { w.date = String(s.date || ''); w.name = (x.asTeam ? x.teamName || x.driverName : (ctx.driverName && ctx.driverName(x.driverId)) || x.driverName) || ''; }
        wins.set(key, w);
      });
    });
    return [...wins.values()].filter(w => w.name).sort((a, b) => b.count - a.count || (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  // ---- the week and the year ----
  // Monday 00:00 of the week of `now` (local time): the week of the fastest laps starts there.
  function weekStart(now) { const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d; }
  const yearStart = now => { const d = new Date(now); return new Date(d.getFullYear(), 0, 1); };
  const whole = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

  // ---- recent races ----
  const KINDS = { practice: 'Free practice', qualifying: 'Qualifying', race: 'Race by laps or distance', timed: 'Timed race', heats: 'Heat-based race', endurance: 'Endurance Race' };
  // ctx: { sessions, count } -> [{ id, date, name, kind, result }] the newest first; a race says who won, qualifying and free practice the best lap. Time Token Sessions never show.
  function recent(ctx) {
    const n = whole(ctx.count, 1, 20, 5);
    return (ctx.sessions || []).map((s, i) => ({ s, i })).filter(x => x.s && x.s.sessionType !== 'tokens')
      .sort((a, b) => String(b.s.date || '').localeCompare(String(a.s.date || '')) || b.i - a.i).slice(0, n).map(({ s }) => {
        const p = podium(s)[0], winner = S.WINNER_TYPES.includes(s.sessionType);
        return { id: s.id, date: s.date || '', name: s.setupName || KINDS[s.sessionType] || 'Race', kind: KINDS[s.sessionType] || '', result: !p ? '' : winner && p.pos === 1 ? p.name + ' won' : winner ? p.name + ', ' + p.detail : p.name + ', ' + p.detail };
      });
  }

  // ---- the fastest laps of this week ----
  // ctx: { laps, sessions, trackId (the track of the race setup), scope ('track' or 'all'), count (per track), now, driverName(id), trackName(id) }
  // -> { since, tracks: [{ trackId, trackName, rows: [{ driverId, driver, time, text }] }] } the best lap of every driver on a track, the fastest first; tracks A to Z.
  // The laps of a session are dated by the lap itself, else by its session. An invalid, too slow or late lap does not count (as in the last race).
  function fastestWeek(ctx) {
    const since = weekStart(ctx.now || new Date()), count = whole(ctx.count, 1, 20, 5), all = ctx.scope === 'all', dateOf = new Map((ctx.sessions || []).map(s => [s.id, s.date]));
    const best = new Map(); // track|driver -> the lap
    for (const l of ctx.laps || []) {
      if (!racing(l) || !okTime(l) || l.invalid || l.tooSlow || l.late || !l.trackId || !l.driverId || (!all && l.trackId !== ctx.trackId)) continue;
      if (!(Date.parse(l.date || dateOf.get(l.sessionId)) >= since.getTime())) continue;
      const k = l.trackId + '|' + l.driverId, b = best.get(k);
      if (!b || Number(l.time) < Number(b.time)) best.set(k, l);
    }
    const tracks = new Map();
    best.forEach(l => { if (!tracks.has(l.trackId)) tracks.set(l.trackId, []); tracks.get(l.trackId).push(l); });
    const out = [...tracks.entries()].map(([trackId, list]) => ({ trackId, trackName: (ctx.trackName && ctx.trackName(trackId)) || '(deleted)',
      rows: list.sort((a, b) => Number(a.time) - Number(b.time)).slice(0, count).map(l => ({ driverId: l.driverId, driver: (ctx.driverName && ctx.driverName(l.driverId)) || '(deleted)', time: Number(l.time), text: E.fmtTime(Number(l.time)) })) }));
    out.sort((a, b) => a.trackName.localeCompare(b.trackName));
    return { since, tracks: out };
  }

  // ---- the records of all tracks ----
  // ctx: { laps, sessions, trackName(id), driverName(id), carName(id) } -> [{ trackId, trackName, time, text, driver, car, date }] tracks A to Z; a track without a lap is not in it.
  function allRecords(ctx) {
    const ids = [...new Set((ctx.laps || []).filter(l => racing(l) && l.trackId).map(l => l.trackId))], out = [];
    ids.forEach(id => {
      const rec = trackRecord(ctx.laps, id); if (!rec) return;
      const ses = (ctx.sessions || []).find(s => s.id === rec.sessionId);
      out.push({ trackId: id, trackName: (ctx.trackName && ctx.trackName(id)) || '(deleted)', time: Number(rec.time), text: E.fmtTime(Number(rec.time)), driver: (ctx.driverName && ctx.driverName(rec.driverId)) || (rec.driverId ? '(deleted)' : 'Guest'),
        car: (ctx.carName && ctx.carName(rec.carId)) || '', date: rec.date || (ses && ses.date) || '' });
    });
    return out.sort((a, b) => a.trackName.localeCompare(b.trackName));
  }

  // ---- personal bests of the drivers on the grid ----
  // The best lap of a driver on a track that counts as a personal best (a lap taken out of the personal bests does not).
  function personalBest(laps, trackId, driverId) {
    let best = null;
    if (!trackId || !driverId) return null;
    for (const l of laps || []) { if (!racing(l) || l.trackId !== trackId || l.driverId !== driverId || l.noPersonalBest || !okTime(l)) continue; if (!best || Number(l.time) < Number(best.time)) best = l; }
    return best;
  }
  // ctx: { laps, trackId, grid: [{ driverId, color }], driverName(id) } -> [{ driverId, name, color, time (null: no lap yet), text }] in the order of the lanes; a driver once
  function gridBests(ctx) {
    const seen = new Set(), out = [];
    (ctx.grid || []).forEach(g => {
      if (!g || !g.driverId || seen.has(g.driverId)) return;
      seen.add(g.driverId);
      const b = personalBest(ctx.laps, ctx.trackId, g.driverId);
      out.push({ driverId: g.driverId, name: (ctx.driverName && ctx.driverName(g.driverId)) || '(deleted)', color: g.color || '', time: b ? Number(b.time) : null, text: b ? E.fmtTime(Number(b.time)) : '–' });
    });
    return out;
  }

  // ---- the rules of a race setup ----
  // names: { typeLabel, rotation, penalty, damage, fuel, weather, safetyCar, pushSave, tyreWear, tyreWearHere } the words for the session type and for the rule sets the setup points at ('' = it points at none, or at one that is gone)
  // -> [[label, text]]. Only what applies to the kind of session: a free practice has no weather, a Time Token Session no penalties.
  function rules(setup, names) {
    if (!setup) return [];
    const t = setup.sessionType, n = names || {}, out = [], num = (v, d) => (v === '' || v === null || v === undefined || !Number.isFinite(Number(v)) ? d : Number(v));
    const heated = t === 'heats' || (t === 'endurance' && setup.enduranceBy === 'heats'), laps = num(setup.laps, 10), mins = num(setup.duration, 5);
    out.push(['Race', n.typeLabel || t || '']);
    let length = '';
    const dist = () => (typeof module !== 'undefined' ? require('./distance.js') : root.Distance).lengthText(setup, n.distUnit); // (a race by distance: 100 m; n.distUnit is 'm' or 'ft')
    if (t === 'race') length = setup.raceBy === 'distance' ? dist() : plural(laps, 'lap', 'laps');
    else if (t === 'timed' || t === 'qualifying') length = plural(mins, 'minute', 'minutes');
    else if (t === 'endurance' && !heated) length = setup.enduranceBy === 'laps' ? plural(laps, 'lap', 'laps') : setup.enduranceBy === 'distance' ? dist() : plural(mins, 'minute', 'minutes');
    else if (heated) {
      const each = setup.heatBy === 'time' ? plural(mins, 'minute', 'minutes') : setup.heatBy === 'distance' ? dist() : plural(laps, 'lap', 'laps');
      length = setup.rotation ? `${n.rotation ? 'Rotation "' + n.rotation + '"' : 'A rotation setup'}, heats of ${each}`
        : setup.heatPlan === 'perdriver' ? `${plural(num(setup.heatsEach, 3), 'heat', 'heats')} for every driver, each ${each}`
          : setup.heatPlan === 'roundrobin' ? `Round robin, heats of ${each}` : setup.heatPlan === 'rotation' ? `Lane rotation, heats of ${each}` : `${plural(num(setup.heats, 3), 'heat', 'heats')} of ${each}`;
    } else length = 'As long as you like';
    out.push(['Length', length]);
    if (heated && (setup.finals === 'a' || setup.finals === 'ab')) out.push(['Finals', setup.finals === 'ab' ? 'A final and a B final' : 'A final']);
    if (t === 'endurance') {
      const unit = setup.swapUnit === 'laps' ? 'laps' : 'minutes', mode = setup.swapMode || 'every';
      if (setup.swapUnit === 'distance') { // (1.35.1: swaps by distance; the lengths are kept in metres, n.distUnit says how to show them)
        const Ds = typeof module !== 'undefined' ? require('./distance.js') : root.Distance, at = setup.swapWhere === 'anywhere' ? ', anywhere on the track' : ', at the line', one = v => Ds.text(v, n.distUnit, Math.abs(v * (n.distUnit === 'ft' ? 3.28084 : 1) - Math.round(v * (n.distUnit === 'ft' ? 3.28084 : 1))) < 0.05 ? 0 : 1);
        const list = String(setup.swapMomentsDist ?? '100, 200').split(/[;,\s]+/).filter(x => x !== '' && Number(x) > 0).map(x => one(Number(x))).join(', ');
        out.push(['Driver swaps', (mode === 'moments' ? 'At ' + list : mode === 'free' ? 'When the team chooses' : `Every ${one(num(setup.swapEveryDist, 50))}`) + at]);
      } else out.push(['Driver swaps', mode === 'moments' ? 'At ' + (String(setup.swapMoments || '30, 1:00:00, 2:00:00').trim()) : mode === 'free' ? 'When the team chooses' : `Every ${num(setup.swapEvery, 30)} ${unit}`]);
    }
    const racing6 = ['practice', 'qualifying', 'race', 'timed', 'heats', 'endurance'].includes(t), full = ['race', 'timed', 'heats', 'endurance'].includes(t);
    if (racing6) out.push(['Penalties', n.penalty || 'Off']);
    if (full) out.push(['Damage', n.damage || 'Off']);
    if (racing6) out.push(['Fuel', n.fuel || 'Off']);
    if (full) out.push(['Weather', n.weather || 'Off'], ['Balance of Power', setup.bop === 'on' ? 'On' : 'Off']);
    if (full) out.push(['Tyre wear', n.tyreWear || 'Off']); // (1.40.0)
    else if (racing6 && n.tyreWear && n.tyreWearHere) out.push(['Tyre wear', n.tyreWear]); // (a practice or a qualifying has it only when the system says so)
    if (racing6 && n.safetyCar) out.push(['Safety car', n.safetyCar]); // (1.53.0: only when the setup has one; most setups have none)
    if (racing6 && n.pushSave) out.push(['Push and save', n.pushSave]); // (1.54.0: the same)
    return out;
  }

  // ---- the chips of the welcome band ----
  // ctx: { hardware ('none', 'trackmate' or 'arduino': the timing hardware that was chosen; missing = trackmate), trackmate (connected), arduino (connected), virtual (the virtual box is the Arduino box),
  //   netOn, netError, hasSetup, audioName (the audio set of the selected setup, '' = none), drivers, cars, tracks (how many) }
  // -> [{ key, text, state }]  state: 'on' (green light), 'off' (dim light), 'warn' (red light), '' (no light)
  // The first chip is the timing hardware that was chosen (one at a time): green when it is connected, red when it is chosen and not connected, dim when none is chosen.
  // The same words are used on the race screen.
  function timing(ctx) {
    const hw = ctx.hardware || 'trackmate';
    if (hw === 'none') return { key: 'tm', text: 'No timing hardware chosen', state: 'off' };
    const name = hw === 'arduino' ? (ctx.virtual ? 'Virtual Arduino box' : 'Arduino box') : 'Trackmate', on = hw === 'arduino' ? !!ctx.arduino : !!ctx.trackmate;
    return { key: 'tm', text: name + (on ? ' connected' : ' not connected'), state: on ? 'on' : 'warn' };
  }
  function chips(ctx) {
    const out = [timing(ctx)];
    out.push(ctx.netError ? { key: 'net', text: 'Network sharing could not start', state: 'warn' } : { key: 'net', text: ctx.netOn ? 'Shared on the network' : 'Not shared on the network', state: ctx.netOn ? 'on' : 'off' });
    if (ctx.hasSetup) out.push(ctx.audioName ? { key: 'audio', text: 'Audio: ' + ctx.audioName, state: 'on' } : { key: 'audio', text: 'No audio', state: 'off' });
    out.push({ key: 'count', text: [plural(ctx.drivers || 0, 'driver', 'drivers'), plural(ctx.cars || 0, 'slotcar', 'slotcars'), plural(ctx.tracks || 0, 'track', 'tracks')].join(' · '), state: '' });
    return out;
  }

  // ---- the start lights ----
  // Is a row of the grid filled in? The same rule as the sentences "Lane 1 needs a driver and a car" on the Home tab: a team (heats with teams, an Endurance Race) needs a team and a car,
  // a Time Token Session needs nothing, anything else needs a driver and a car. mode: { byTeam, enduSingle, tokens }
  const rowReady = (r, mode) => { const m = mode || {}; return m.tokens ? true : m.byTeam || m.enduSingle ? !!(r && r.teamId && r.carId) : !!(r && r.driverId && r.carId); };
  // how many places are ready, with the words for it: "3 of 4 lanes are ready". A participant that is not here today (a rotation) is not counted.
  // blocked: something else stops the race (a driver on two lanes, a team without drivers...): then a full grid is "filled in", not "ready".
  function lights(rows, mode, noun, blocked) {
    const list = (rows || []).filter(r => !(r && r.absent)), ok = list.map(r => rowReady(r, mode)), n = ok.filter(Boolean).length, word = noun || 'lane', all = n === list.length;
    const text = !list.length ? '' : all ? (list.length === 1 ? `The ${word} is ${blocked ? 'filled in' : 'ready'}.` : `All ${list.length} ${word}s are ${blocked ? 'filled in' : 'ready'}.`) : `${n} of ${list.length} ${word}s ${n === 1 ? 'is' : 'are'} ready.`;
    return { ok, ready: n, total: list.length, text };
  }

  const api = { PALETTE, laneColor, trackRecord, bestOnGrid, recordCard, lastSession, podium, lastRace, glance, chips, timing, rowReady, lights,
    winners, weekStart, yearStart, recent, fastestWeek, allRecords, personalBest, gridBests, rules, mileage };
  root.HomeStats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
