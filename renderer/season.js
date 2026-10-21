// A leaderboard that counts over the rounds of a championship (1.68.0).
// The setting "Count over: All heats and rounds so far" of a leaderboard (1.67.0 made it count over the heats of a race) also counts the races of the championship that were driven before this one.
// Pure rules (no screen in here). What the board needs of the championship, per participant of the race that is racing:
// - past(): what the earlier rounds left behind, from the saved results and the saved laps of the races that count in the standings (awarded, not set to "do not count"):
//   the laps, the best lap, the lap times that count (the average and the median are made of them), the time raced and the metres.
// - now(): where everybody stands in the championship if this race ended now (the points table, the bonuses, the dropped results and the tie rules of the championship, as on the Standings page),
//   and the order of the board that follows from it.
// A race counts once: an earlier run of this same session of the championship (a race that was driven again) is left out, because the race that is racing now takes its place.
(function (root) {
  const C = typeof module !== 'undefined' ? require('./championship.js') : root.Champ;
  const P = typeof module !== 'undefined' ? require('./champpoints.js') : root.ChampPts;
  const speed = () => (typeof module !== 'undefined' ? require('./speed.js') : root.Speed); // (looked up when it is used: the order in which the scripts are loaded does not matter)

  const r3 = v => (Number.isFinite(v) ? Math.round(v * 1000) / 1000 : null);
  const rounded = v => Math.round(v * 100) / 100;

  // The championship of a race, when its board can count over the rounds: the race is a race of a round of a championship that exists, and it gives points (a practice, a qualifying or a race of no points does not).
  // raw: the record from the database; tag: the tag of the race (the champ of the race). { c, tag } or null.
  function of(raw, tag) {
    if (!raw || typeof raw !== 'object' || !tag || typeof tag !== 'object' || tag.kind !== 'race' || tag.id !== raw.id) return null;
    const c = C.clean(raw, true), at = C.find(c, tag);
    return at && c.rounds[at.ri].sessions[at.si].share > 0 ? { c, tag } : null;
  }
  // the saved sessions without the earlier runs of this session of the championship
  const others = (c, sessions, tag) => (Array.isArray(sessions) ? sessions : []).filter(s => !(s && s.champ && s.champ.id === c.id && s.champ.roundId === tag.roundId && s.champ.sessionId === tag.sessionId));
  // the races that count in the standings, the earliest first
  function counted(c, sessions, tag) {
    return [...P.awardedOf(c, others(c, sessions, tag)).values()].filter(s => {
      const at = C.find(c, s.champ); return s.champ.kind === 'race' && !!at && c.rounds[at.ri].sessions[at.si].share > 0;
    }).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
  }
  // the row of a participant in a saved result: a driver is a row of a driver, a team that raced as a team is the row of that team
  const rowOf = (rows, p) => (Array.isArray(rows) ? rows : []).find(r => r && (p.asTeam ? r.asTeam === true && !!p.teamId && r.teamId === p.teamId : !r.asTeam && !!p.driverId && r.driverId === p.driverId)) || null;

  // What the earlier rounds left behind, for the participants of this race: [{ p, laps, best, valid, t0, t1, dist? }] (a participant who took part in none of them has no entry).
  // laps: the laps that count (as the result says); best: the best lap of the results; valid: the lap times that count for the average and the median (not the laps of a pit stop, the laps that do not count or that were too slow);
  // t1: the time of the saved laps; t0: that time plus the penalty time and what the Race Director added or took off; dist: the metres, when the length of the lane is known for every lap.
  // people: the participants (driverId, teamId, asTeam); laps: the saved laps; tracks: the tracks (for the length of the lanes).
  function past(c, sessions, laps, tag, people, tracks) {
    const list = counted(c, sessions, tag), byS = new Map(), trackOf = new Map((Array.isArray(tracks) ? tracks : []).map(t => [t.id, t]));
    (Array.isArray(laps) ? laps : []).forEach(l => { if (l && l.sessionId) { const a = byS.get(l.sessionId); if (a) a.push(l); else byS.set(l.sessionId, [l]); } });
    const out = [];
    (Array.isArray(people) ? people : []).forEach((p, i) => {
      let n = 0, best = null, valid = [], t0 = 0, t1 = 0, dist = 0, known = true, any = false;
      list.forEach(s => {
        const row = rowOf(s.standings, p); if (!row) return;
        any = true;
        const mine = (byS.get(s.id) || []).filter(l => (p.asTeam ? l.teamId === p.teamId : l.driverId === p.driverId));
        n += Number(row.laps) || 0;
        const b = Number(row.best); if (b > 0 && (best === null || b < best)) best = b;
        mine.forEach(l => { if (!l.pit && !l.invalid && !l.tooSlow && l.time > 0) valid.push(r3(l.time)); });
        const sum = mine.reduce((a, l) => a + (Number(l.time) || 0), 0);
        t1 += sum; t0 += sum + (Number(row.adjMs) || 0) + (Number(row.penalty) || 0);
        const len = l => { const tr = trackOf.get(l.trackId || s.trackId); return tr ? Number(speed().laneLength(tr, (l.lane | 0) - 1)) || 0 : 0; };
        mine.forEach(l => { const m = len(l); if (m > 0) dist += m; else known = false; });
        if (row.adjLaps) { const last = mine[mine.length - 1], m = last ? len(last) : 0; if (m > 0) dist += row.adjLaps * m; else known = false; } // (the laps that the Race Director added or took off, in the lane of the last lap)
      });
      if (any) out.push({ p: i, laps: n, best: r3(best), valid, t0: r3(t0), t1: r3(t1), ...(known ? { dist: r3(dist) } : {}) });
    });
    return out;
  }

  // Where everybody stands in the championship, with this race counted as if it ended now (`rows`: the rows of the race as they stand, in the shape of a saved result, or null when nothing was driven yet),
  // and before it. Gives { order: [[participant, points or null]], pts: [[participant, points now, points before]] }.
  // The order is that of the standings (drivers; for a team that raced as a team: the teams), a participant who is not in the standings (a guest) comes after them in the order of the race.
  function now(c, sessions, tag, people, rows) {
    const rest = others(c, sessions, tag), before = P.standings(c, rest), live = rows && rows.length ? P.standings(c, rest.concat([{ id: '(racing now)', date: '9999', champ: { ...tag, awarded: 'now' }, standings: rows }])) : before;
    const entry = (st, p) => (st ? (p.asTeam ? (st.teams || []).find(x => x.id === p.teamId && !!p.teamId) : (st.drivers || []).find(x => x.id === p.driverId && !!p.driverId)) || null : null);
    const list = (Array.isArray(people) ? people : []).map((p, i) => {
      const a = entry(live, p), b = entry(before, p), r = rowOf(rows, p);
      return { i, pos: a ? a.pos : Infinity, rank: r && Number(r.pos) > 0 ? Number(r.pos) : Infinity, now: a ? rounded(a.total) : null, was: b ? rounded(b.total) : null };
    });
    list.sort((x, y) => (x.pos - y.pos) || (x.rank - y.rank) || (x.i - y.i));
    return { order: list.map(x => [x.i, x.now]), pts: list.slice().sort((x, y) => x.i - y.i).map(x => [x.i, x.now, x.was]) };
  }

  const api = { of, others, counted, rowOf, past, now };
  root.Season = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
