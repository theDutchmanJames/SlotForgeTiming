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
    return rows.slice(0, 3).map((x, i) => ({
      pos: i + 1, name: (x.asTeam ? x.teamName || x.driverName : x.driverName) || 'Guest',
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
    const wins = new Map(); // who won how often: a driver, or a team that raced as a team; a Guest has no name to count under
    sessions.forEach(s => (s.standings || []).forEach(x => {
      if (!S.isWinner(s, x)) return;
      const key = x.asTeam ? 't:' + (x.teamId || x.teamName || x.driverName || '') : x.driverId ? 'd:' + x.driverId : '';
      if (!key || key === 't:') return;
      const w = wins.get(key) || { count: 0, date: '', name: '' };
      w.count++; if (String(s.date || '') >= w.date) { w.date = String(s.date || ''); w.name = (x.asTeam ? x.teamName || x.driverName : (ctx.driverName && ctx.driverName(x.driverId)) || x.driverName) || ''; }
      wins.set(key, w);
    }));
    let top = null; wins.forEach(w => { if (w.name && (!top || w.count > top.count || (w.count === top.count && w.date > top.date))) top = w; }); // (a tie goes to the one who won last)
    return { races, laps: valid, distance, wins: top ? { name: top.name, count: top.count } : null };
  }

  // ---- the chips of the welcome band ----
  // ctx: { trackmate (connected), netOn, netError, hasSetup, audioName (the audio set of the selected setup, '' = none), drivers, cars, tracks (how many) }
  // -> [{ key, text, state }]  state: 'on' (green light), 'off' (dim light), 'warn' (red light), '' (no light)
  function chips(ctx) {
    const out = [{ key: 'tm', text: ctx.trackmate ? 'Trackmate connected' : 'Trackmate not connected', state: ctx.trackmate ? 'on' : 'off' }];
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

  const api = { PALETTE, laneColor, trackRecord, bestOnGrid, recordCard, lastSession, podium, lastRace, glance, chips, rowReady, lights };
  root.HomeStats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
