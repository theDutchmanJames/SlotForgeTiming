// Championship points (1.56.0): what a race gives to the drivers and the teams of a championship, the standings, and what the panel after a race says.
// Pure rules (no screen in here); the rules themselves are in the championship record (championship.js: the table, the bonuses, the dropped results, the teams, the ties).
// - The points of a race come from the saved result of the session (its standings) and from the qualifying session of the same round (for the pole bonus).
//   They are worked out when they are asked for, from the sessions that are awarded, so the standings are always what the saved sessions say.
// - A session is awarded by a flag in its tag (champ.awarded = the time). A session that is awarded counts; a session that is not awarded does not (yet).
//   champ.off = true takes a session out of the championship altogether ("Do not count this race").
// - Only a race gives points. A driver who is not in the roster (from the round he joins) is a guest. A car that is out (disqualified, retired, out by damage or a failure) gets no points
//   for its place; it still gets the bonus for starting (not when it was disqualified).
// - A race that was driven by teams (an Endurance Race, a heat race for teams) is scored too (1.57.0): the team is the entrant, it gets the points of its place once (in the Teams standings),
//   and the drivers who drove for it get points in the Drivers standings by the rule teamRace (every driver gets the points of the place, the drivers share them by their laps, or only the team
//   gets them). The bonuses go to the team and to the driver who earned them (the fastest lap: the driver who set it; the pole: the pole sitter if he drove; the start: every driver who drove).
(function (root) {
  const C = typeof module !== 'undefined' ? require('./championship.js') : root.Champ;

  const round2 = n => Math.round(n * 100) / 100;
  // 26, 12.5, 0.25 (at most two decimals, no trailing zeros)
  const fmt = n => String(round2(Number(n) || 0) || 0);
  // +14, −5, 0
  const signed = n => { const v = round2(Number(n) || 0); return v > 0 ? '+' + fmt(v) : v < 0 ? '−' + fmt(-v) : '0'; };
  // "A", "A and B", "A, B and C", "A, B and 2 more"
  function joinNames(list, max) {
    const l = list.filter(Boolean), m = max || 3;
    if (l.length <= 1) return l.join('');
    if (l.length <= m) return l.slice(0, -1).join(', ') + ' and ' + l[l.length - 1];
    return l.slice(0, m - 1).join(', ') + ' and ' + (l.length - (m - 1)) + ' more';
  }

  // What a race of teams gives (1.57.0), in words, for the panel after a race and for the standings. `noMin`: without the sentence about the minimum share of the laps.
  function teamRaceText(c, noMin) {
    const t = {
      every: 'A race of teams gives the team the points of its place (in the Teams standings, once) and every driver who drove for it the same points (in the Drivers standings).',
      split: 'A race of teams gives the team the points of its place (in the Teams standings, once); the drivers who drove for it share these points by their laps (in the Drivers standings).',
      team: 'A race of teams gives the points of its place to the team (in the Teams standings). The drivers get no points from it.'
    }[c.teamRace] || '';
    return t + (!noMin && c.teamMin > 0 && c.teamRace !== 'team' ? ` A driver who drove less than ${c.teamMin}% of the laps of his team gets nothing.` : '');
  }

  // A race gives its full points (100), or a part of them (a sprint: 50). The rounding of the part is a rule of the championship.
  function scaled(raw, share, mode) {
    if (!share) return 0;
    if (share === 100) return round2(raw);
    const v = raw * share / 100;
    switch (mode) {
      case 'up': return Math.ceil(v - 1e-9);
      case 'down': return Math.floor(v + 1e-9);
      case 'none': return round2(v);
      default: return Math.floor(v + 0.5 + 1e-9);
    }
  }

  const outOf = r => !!(r.dq || r.retired || r.damageOut || r.failureOut);
  // the rows of a session that are drivers, in the order of the result
  const driverRows = s => (s && Array.isArray(s.standings) ? s.standings : []).filter(r => r && r.driverId && !r.asTeam).slice().sort((a, b) => (Number(a.pos) || 0) - (Number(b.pos) || 0));
  // 1.57.0: every row of a session that can score (a driver, or a team that raced as a team), in the order of the result
  const entrantsOf = s => (s && Array.isArray(s.standings) ? s.standings : []).filter(r => r && (r.asTeam || r.driverId)).slice().sort((a, b) => (Number(a.pos) || 0) - (Number(b.pos) || 0));
  const entrantName = r => (r.asTeam ? r.teamName || r.driverName || '' : r.driverName || '');
  const OUT_TEXT = r => (r.dq ? 'DQ' : r.retired ? 'Out' : r.damageOut ? 'Out (damage)' : r.failureOut ? 'Out (failure)' : '');

  // The qualifying session of a round that was driven (the last one, when there are more): the saved session, or null.
  function qualifyingOf(c, sessions, ri, driven) {
    const r = c.rounds[ri]; if (!r) return null;
    const done = driven || C.driven(c, sessions);
    for (let k = r.sessions.length - 1; k >= 0; k--) { const d = done.get(C.keyOf(r.id, r.sessions[k].id)); if (d && d.champ && d.champ.kind === 'qualifying') return d; }
    return null;
  }
  // the roster entries by driver
  const rosterOf = c => new Map(c.roster.map((x, i) => [x.driver, { ...x, order: i }]));

  // The result of one saved race: who gets what.
  // { ok: true, ri, round, share, rows: [entrant], contrib, guests: [names], fastest, pole }
  // an entrant: { kind: 'driver' | 'team', driverId, teamId, name, shown, place, out, outText, guest, best, base, fastest, pole, start, raw, pts, members }
  //   (members: only for a team that raced as a team, the drivers who drove for it: { driverId, name, laps, guest, base, fastest, pole, start, raw, pts })
  // contrib: Map(driverId -> { pts, fast, places }) = what the Drivers standings get from this race (a driver can be in more than one row: the heats of a race of teams)
  // or { ok: false, reason: 'notfound' | 'practice' | 'qualifying' | 'noshare' | 'none' }.
  // `qual` is the saved qualifying session of the round, or null.
  function sessionResult(c, s, qual) {
    if(s?.multiclass?.pointsMode==='class'&&!s.classScope)return {ok:false,reason:'noshare'};
    if(s?.classScope){if(s.multiclass?.pointsMode==='overall')return {ok:false,reason:'noshare'};const t=s.multiclass?.classes?.find(x=>x.id===s.classScope)?.points;if(t?.length)c={...c,pointsMode:'table',points:t};}
    const tag = s && s.champ, at = C.find(c, tag);
    if (!at) return { ok: false, reason: 'notfound' };
    if (tag.kind !== 'race') return { ok: false, reason: tag.kind === 'practice' || tag.kind === 'qualifying' ? tag.kind : 'none' };
    const share = c.rounds[at.ri].sessions[at.si].share; // (the share that the championship says now, so that a correction to the championship counts for races that were driven)
    if (!share) return { ok: false, reason: 'noshare' };
    const all = entrantsOf(s), round = at.ri + 1, by = rosterOf(c);
    const teamsIn = new Set(c.roster.filter(x => x.team && x.from <= round).map(x => x.team)); // (the teams of the championship in this round)
    const driverCounts = id => { const x = by.get(id); return !!x && x.from <= round; };
    const counts = r => (r.asTeam ? !!r.teamId && teamsIn.has(r.teamId) : driverCounts(r.driverId));
    const list = c.guestRule ? all.filter(counts) : all; // (a guest who is not counted at all, or who keeps his place and gives the points to nobody)
    const guests = c.guestRule ? all.filter(r => !counts(r)).map(entrantName) : [];
    const fin = list.filter(r => !outOf(r));
    const placeOf = new Map(fin.map((r, i) => [r, i + 1]));
    // fastest lap: the best lap of the finishers; the bonus is for him only when he finishes in the first places
    const lapsOf = fin.filter(r => Number(r.best) > 0);
    const fastRow = lapsOf.length ? lapsOf.reduce((a, b) => (Number(b.best) < Number(a.best) ? b : a)) : null;
    const fastGets = !!(fastRow && c.bonusFast > 0 && counts(fastRow) && placeOf.get(fastRow) <= c.bonusFastTop);
    // pole: the fastest of the qualifying session (of the roster, when guests are not counted); he has to start the race (for a team: the team of the pole sitter has to start it)
    const qrows = driverRows(qual).filter(r => Number(r.best) > 0), qpool = c.guestRule ? qrows.filter(r => driverCounts(r.driverId)) : qrows, poleQ = qpool[0] || null;
    const poleTeam = poleQ ? ((by.get(poleQ.driverId) || {}).team || poleQ.teamId || '') : '';
    const poleRow = poleQ ? list.find(r => (r.asTeam ? !!poleTeam && r.teamId === poleTeam : r.driverId === poleQ.driverId)) || null : null;
    const poleGets = !!(poleRow && c.bonusPole > 0 && counts(poleRow) && !poleRow.dq);
    const scale = raw => scaled(raw, share, c.sprintRound);
    const rows = list.map((r, i) => {
      const team = !!r.asTeam, guest = !counts(r), out = outOf(r), place = out ? 0 : placeOf.get(r);
      let base = 0, fastest = 0, pole = 0, start = 0;
      if (!guest) {
        if (!out) base = c.pointsMode === 'beaten' ? list.length - 1 - i : place <= c.points.length ? c.points[place - 1] : c.pointsRest;
        if (fastGets && r === fastRow) fastest = c.bonusFast;
        if (poleGets && r === poleRow) pole = c.bonusPole;
        if (!r.dq) start = c.bonusStart;
      }
      const raw = round2(base + fastest + pole + start);
      const row = { kind: team ? 'team' : 'driver', driverId: team ? '' : r.driverId, teamId: team ? r.teamId || '' : '', name: entrantName(r), shown: i + 1, place, out, outText: OUT_TEXT(r), guest, best: Number(r.best) > 0 ? Number(r.best) : 0, base, fastest, pole, start, raw, pts: guest ? 0 : scale(raw) };
      if (team) row.members = membersOf(r, row);
      return row;
    });
    // the drivers of a team that raced as a team: who drove (with a minimum share of the laps of the team, when the championship says so), and what each of them gets
    function membersOf(r, row) {
      const ds = (Array.isArray(r.drivers) ? r.drivers : []).filter(d => d && d.driverId && ((Number(d.laps) || 0) > 0 || (Number(d.ms) || 0) > 0));
      const total = ds.reduce((a, d) => a + (Number(d.laps) || 0), 0), min = c.teamMin || 0;
      const eligible = ds.filter(d => !min || (Number(d.laps) || 0) * 100 >= min * total); // (a team with no lap at all: nobody is short, everyone who drove counts)
      const eligLaps = eligible.reduce((a, d) => a + (Number(d.laps) || 0), 0);
      return ds.map(d => {
        const laps = Number(d.laps) || 0, ok = eligible.includes(d), guest = !driverCounts(d.driverId) || row.guest, gets = ok && !guest && c.teamRace !== 'team';
        let base = 0, fastest = 0, pole = 0, start = 0;
        if (gets) {
          base = c.teamRace === 'split' ? round2(eligLaps > 0 ? row.base * laps / eligLaps : row.base / eligible.length) : row.base;
          if (row.fastest > 0 && r.bestBy === d.driverId) fastest = row.fastest;
          if (row.pole > 0 && poleQ && poleQ.driverId === d.driverId) pole = row.pole;
          start = row.start;
        }
        const raw = round2(base + fastest + pole + start);
        return { driverId: d.driverId, name: d.driverName || '', laps, guest, short: !ok, noPoints: c.teamRace === 'team', base, fastest, pole, start, raw, pts: gets ? scale(raw) : 0 };
      });
    }
    // what the Drivers standings get: a driver entrant, and every driver of a team that raced as a team
    const contrib = new Map();
    const give = (id, pts, fast, place) => { const k = contrib.get(id) || { pts: 0, fast: false, places: [] }; k.pts = round2(k.pts + pts); if (fast) k.fast = true; if (place > 0) k.places.push(place); contrib.set(id, k); };
    rows.forEach(x => {
      if (x.guest) return;
      if (x.kind === 'driver') give(x.driverId, x.pts, x.fastest > 0, x.place);
      else if (c.teamRace !== 'team') x.members.forEach(m => { if (!m.guest && !m.short) give(m.driverId, m.pts, m.fastest > 0, x.place); });
    });
    const fname = fastRow && fastRow.asTeam ? ((fastRow.drivers || []).find(d => d && d.driverId === fastRow.bestBy) || {}).driverName || '' : '';
    return { ok: true, ri: at.ri, round, share, rows, contrib, guests,
      fastest: fastRow ? { driverId: fastRow.asTeam ? fastRow.bestBy || '' : fastRow.driverId, name: fastRow.asTeam ? fname || entrantName(fastRow) : fastRow.driverName || '', team: fastRow.asTeam ? entrantName(fastRow) : '', ms: Number(fastRow.best), got: fastGets, shown: list.indexOf(fastRow) + 1 } : null,
      pole: poleQ ? { driverId: poleQ.driverId, name: poleQ.driverName || '', team: poleRow && poleRow.asTeam ? entrantName(poleRow) : '', ms: Number(poleQ.best), got: poleGets } : null };
  }

  // the results the championship has in it: the awarded sessions, one for every session of a round (the latest, when a session was driven more than once and awarded more than once)
  function awardedOf(c, sessions) {
    const out = new Map();
    (Array.isArray(sessions) ? sessions : []).forEach(s => {
      const t = s && s.champ; if (!t || t.id !== c.id || !t.awarded || t.off || !C.find(c, t)) return;
      const k = C.keyOf(t.roundId, t.sessionId), old = out.get(k);
      if (!old || String(s.date || '') >= String(old.date || '')) out.set(k, s);
    });
    return out;
  }

  // the dropped results: in a list of cells in the order of the rounds, the worst ones (the earlier round first when they are equal) are marked, leaving `keep` results
  function drop(cells, keep) {
    const sc = cells.filter(x => x.state === 'score'), n = sc.length - keep; if (n <= 0) return;
    sc.map((x, i) => ({ x, i })).sort((a, b) => a.x.pts - b.x.pts || a.i - b.i).slice(0, n).forEach(e => { e.x.dropped = true; });
  }
  const sumOf = cells => round2(cells.reduce((a, x) => a + (x.state === 'score' && !x.dropped ? x.pts : 0), 0));
  // more is better, the first place counts most: [wins, seconds, thirds, ...]
  const vecCmp = (a, b) => { const n = Math.max(a.length, b.length); for (let i = 0; i < n; i++) { const d = (b[i] || 0) - (a[i] || 0); if (d) return d; } return 0; };
  const raceSessions = (c, ri, setups) => c.rounds[ri].sessions.filter(s => s.share > 0 && (!setups || C.kindOf(setups.find(x => x.id === s.setup)) === 'race'));

  // The standings of a championship, from its saved sessions. ctx (all optional): drivers, teams (the lists from the database, for the names), setups (to know which rounds have a race).
  // { cols: [{ ri, label, decided }], drivers: [row], teams: [row] | null, board: [round], decided, last, dropNote, results }
  // a driver row: { id, name, team, teamName, from, pos, cells: [{ state: 'open' | 'na' | 'score', pts, dropped, fast }], total, behind, wins, places, qplaces }
  function standings(c, sessions, ctx) {
    ctx = ctx || {};
    if(ctx.classId){
      const M=typeof module!=='undefined'?require('./multiclass.js'):root.MultiClass;
      const scoped=(sessions||[]).map(s=>M.scopedSession(s,ctx.classId));
      const result=standings(c,scoped,{...ctx,classId:''});
      const ids=new Set(scoped.flatMap(s=>s.standings||[]).flatMap(r=>[r.driverId,...(r.drivers||r.stints||[]).map(x=>x.driverId)])),teams=new Set(scoped.flatMap(s=>s.standings||[]).map(r=>r.teamId).filter(Boolean));
      result.drivers=result.drivers.filter(r=>ids.has(r.id)).map((r,i)=>({...r,pos:i+1}));if(result.teams)result.teams=result.teams.filter(r=>teams.has(r.id)||result.drivers.some(d=>d.team===r.id)).map((r,i)=>({...r,pos:i+1}));return result;
    }
    const list = Array.isArray(sessions) ? sessions : [], aw = awardedOf(c, list), by = rosterOf(c);
    const roundRes = c.rounds.map(() => []), done = C.driven(c, list), quals = c.rounds.map((_, ri) => qualifyingOf(c, list, ri, done));
    c.rounds.forEach((r, ri) => {
      const qual = quals[ri];
      r.sessions.forEach(ses => { const s = aw.get(C.keyOf(r.id, ses.id)); if (!s) return; const res = sessionResult(c, s, qual); if (res.ok) roundRes[ri].push(res); });
    });
    const cols = [];
    c.rounds.forEach((r, ri) => {
      const decided = roundRes[ri].length > 0;
      if (decided || (ctx.setups ? raceSessions(c, ri, ctx.setups).length > 0 : r.sessions.some(s => s.share > 0))) cols.push({ ri, label: 'R' + (ri + 1), name: C.roundLabel(c, ri), decided });
    });
    const decidedN = cols.filter(x => x.decided).length, keep = c.drops > 0 ? Math.max(1, decidedN - c.drops) : Infinity;
    const names = new Map(), tnames = new Map();
    roundRes.forEach(rs => rs.forEach(res => res.rows.forEach(x => {
      if (x.kind === 'team') { if (x.name && x.teamId) tnames.set(x.teamId, x.name); (x.members || []).forEach(m => { if (m.name) names.set(m.driverId, m.name); }); } else if (x.name) names.set(x.driverId, x.name);
    })));
    const nameOf = id => { const d = (ctx.drivers || []).find(x => x.id === id); return (d && d.name) || names.get(id) || '(removed driver)'; };
    const teamName = id => { const t = (ctx.teams || []).find(x => x.id === id); return (t && t.name) || tnames.get(id) || '(removed team)'; };
    // the places in qualifying of a round (the same list as for the pole: the roster, or everybody when guests keep their place)
    const qplaceOf = (ri, id) => {
      const q = quals[ri]; if (!q) return 0;
      const rows = driverRows(q).filter(r => Number(r.best) > 0), pool = c.guestRule ? rows.filter(r => { const x = by.get(r.driverId); return !!x && x.from <= ri + 1; }) : rows;
      return pool.findIndex(r => r.driverId === id) + 1;
    };
    const drivers = c.roster.map((x, order) => {
      const cells = cols.map(col => {
        if (!col.decided) return { state: 'open' };
        if (x.from > col.ri + 1) return { state: 'na' };
        let pts = 0, fast = false;
        roundRes[col.ri].forEach(res => { const k = res.contrib.get(x.driver); if (k) { pts += k.pts; if (k.fast) fast = true; } });
        return { state: 'score', pts: round2(pts), fast };
      });
      const places = [], qplaces = [];
      roundRes.forEach(rs => rs.forEach(res => { const k = res.contrib.get(x.driver); if (k) k.places.forEach(p => { places[p - 1] = (places[p - 1] || 0) + 1; }); }));
      cols.forEach(col => { if (!col.decided) return; const q = qplaceOf(col.ri, x.driver); if (q > 0) qplaces[q - 1] = (qplaces[q - 1] || 0) + 1; });
      drop(cells, keep);
      return { id: x.driver, name: nameOf(x.driver), team: x.team, teamName: x.team ? teamName(x.team) : '', from: x.from, order, cells, total: sumOf(cells), wins: places[0] || 0, places, qplaces };
    });
    const cellPts = (row, i) => (row.cells[i] && row.cells[i].state === 'score' ? row.cells[i].pts : 0);
    function tie(a, b) {
      if (c.tie === 'last') { for (let i = cols.length - 1; i >= 0; i--) { if (!cols[i].decided) continue; const d = cellPts(b, i) - cellPts(a, i); if (d) return d; } }
      if (c.tie === 'qual') { const d = vecCmp(a.qplaces, b.qplaces); if (d) return d; }
      return vecCmp(a.places, b.places) || vecCmp(a.qplaces, b.qplaces);
    }
    drivers.sort((a, b) => b.total - a.total || tie(a, b) || a.order - b.order);
    drivers.forEach((d, i) => { d.pos = i + 1; d.behind = i ? round2(d.total - drivers[0].total) : 0; });

    // the teams: in a race of drivers the best N drivers of a team (or all of them) count; a team that raced as a team gets the points of its place, once; the dropped results are the team's own
    let teams = null;
    if (c.teamMode !== 'none') {
      const ids = []; c.roster.forEach(x => { if (x.team && !ids.includes(x.team)) ids.push(x.team); });
      teams = ids.map((id, order) => {
        const members = c.roster.filter(x => x.team === id);
        const cells = cols.map(col => {
          if (!col.decided) return { state: 'open' };
          if (!members.some(m => m.from <= col.ri + 1)) return { state: 'na' };
          let pts = 0;
          roundRes[col.ri].forEach(res => {
            const mine = res.rows.filter(x => x.kind === 'driver' && !x.guest && (by.get(x.driverId) || {}).team === id).map(x => x.pts).sort((a, b) => b - a);
            (c.teamMode === 'all' ? mine : mine.slice(0, c.teamBest)).forEach(v => { pts += v; });
            res.rows.forEach(x => { if (x.kind === 'team' && !x.guest && x.teamId === id) pts += x.pts; });
          });
          return { state: 'score', pts: round2(pts) };
        });
        drop(cells, keep);
        const places = []; // (the places of the drivers of the team in races of drivers, and the places of the team in races of teams: nobody is counted twice)
        roundRes.forEach(rs => rs.forEach(res => res.rows.forEach(x => {
          if (x.guest || !(x.place > 0)) return;
          if (x.kind === 'team' ? x.teamId === id : (by.get(x.driverId) || {}).team === id) places[x.place - 1] = (places[x.place - 1] || 0) + 1;
        })));
        return { id, name: teamName(id), drivers: members.map(m => nameOf(m.driver)), cells, total: sumOf(cells), places, order };
      });
      teams.sort((a, b) => b.total - a.total || vecCmp(a.places, b.places) || a.order - b.order);
      teams.forEach((t, i) => { t.pos = i + 1; t.behind = i ? round2(t.total - teams[0].total) : 0; });
    }

    // the rounds: the winner of the main race of every round (the race that counts most, the later one when they are equal)
    let last = 0;
    const board = c.rounds.map((r, ri) => {
      const rs = roundRes[ri], decided = rs.length > 0;
      if (decided) last = ri + 1;
      let main = null; rs.forEach(res => { if (!main || res.share >= main.share) main = res; });
      const win = main && main.rows.find(x => x.place === 1 && !x.guest);
      return { ri, label: C.roundLabel(c, ri), date: r.date, decided, winner: win ? (win.kind === 'team' ? teamName(win.teamId) : nameOf(win.driverId)) : '', winnerId: win ? win.driverId || win.teamId : '', winnerTeam: !!(win && win.kind === 'team'), races: rs.length };
    });
    const total = cols.length;
    const teamRaces = roundRes.reduce((a, rs) => a + rs.filter(res => res.rows.some(x => x.kind === 'team')).length, 0); // (the awarded races that were driven by teams)
    return { cols, drivers, teams, board, decided: decidedN, total, last, teamRaces, dropNote: c.drops > 0 && total ? `Best ${Math.max(1, total - c.drops)} of ${total} rounds count` : '', results: roundRes, awarded: aw };
  }

  // "Maria leads by 5", "Maria and Dutch are level"; nothing before a race is awarded
  function leadText(st) {
    const d = st && st.drivers; if (!d || !d.length || !st.decided) return '';
    if (d.length === 1) return `${d[0].name} leads`;
    const level = d.filter(x => x.total === d[0].total);
    if (level.length > 1) return `${joinNames(level.map(x => x.name))} are level`;
    return `${d[0].name} leads by ${fmt(d[0].total - d[1].total)}`;
  }
  // The most a driver can still score in the rounds that are left (every race of them: the best place and all the bonuses).
  function reachOf(c, st, setups) {
    const maxPlace = c.pointsMode === 'beaten' ? Math.max(0, c.roster.length - 1) : Math.max(c.pointsRest, ...c.points);
    const raw = maxPlace + c.bonusFast + c.bonusPole + c.bonusStart;
    let left = 0, reach = 0;
    st.cols.forEach(col => { if (col.decided) return; left++; reach += raceSessions(c, col.ri, setups).reduce((a, s) => a + scaled(raw, s.share, c.sprintRound), 0); });
    return { left, reach: round2(reach) };
  }
  // The note under the standings: who can still pass the leader, or that nobody can.
  function remainingNote(c, st, setups) {
    const d = st && st.drivers; if (!d || !d.length || !st.decided) return '';
    const { left, reach } = reachOf(c, st, setups);
    if (!left) return `${d[0].name} is the champion.`;
    if (d.length === 1) return '';
    const others = d.slice(1).filter(x => d[0].total - x.total <= reach);
    if (!others.length) return `${d[0].name} can no longer be caught.`;
    return `${left === 1 ? 'One round is left' : left + ' rounds are left'}: ${left === 1 ? 'it gives' : 'they give'} up to ${fmt(reach)} points a driver, so ${joinNames(others.map(x => x.name))} can still pass ${d[0].name}.`;
  }

  // the sessions with one session marked as awarded or not; a session of the same round and session that is awarded is replaced when the new one is awarded
  function marked(c, sessions, s, on) {
    const t = s.champ, same = x => x.champ && x.champ.id === t.id && x.champ.roundId === t.roundId && x.champ.sessionId === t.sessionId;
    const flag = (x, v) => { const g = { ...x.champ }; delete g.off; if (v) g.awarded = g.awarded || 'now'; else delete g.awarded; return { ...x, champ: g }; };
    return (Array.isArray(sessions) ? sessions : []).filter(x => x.id !== s.id).map(x => (on && same(x) && x.champ.awarded ? flag(x, false) : x)).concat([flag(s, on)]);
  }

  // What the panel after a race says. state: 'notfound' | 'off' | 'practice' | 'qualifying' | 'noshare' | 'race'.
  // For a race: { rows, guests, fastest, pole, awarded, share, lead, after (the standings after), notes }, every row with the points of this race, the round and the total now.
  // A row is a driver or (1.57.0) a team that raced as a team: the team has the drivers who drove for it in `members`, each with his own points, round, total and place in the Drivers standings;
  // the figures of the team itself (round, total, place) are those of the Teams standings.
  function awardView(c, s, sessions, ctx) {
    ctx = ctx || {};
    if(ctx.classId){
      const M=typeof module!=='undefined'?require('./multiclass.js'):root.MultiClass;
      const scoped=(sessions||[]).map(x=>M.scopedSession(x,ctx.classId));
      return awardView(c,M.scopedSession(s,ctx.classId),scoped,{...ctx,classId:''});
    }
    const tag = s && s.champ, at = C.find(c, tag), head = { name: c.name, round: at ? at.ri + 1 : (tag && tag.round) || 0, roundLabel: at ? C.roundLabel(c, at.ri) : '' };
    if (!tag || !at) return { state: 'notfound', ...head };
    if (tag.off) return { state: 'off', ...head };
    if (tag.kind === 'practice' || tag.kind === 'qualifying') {
      const by = rosterOf(c), rows = tag.kind === 'qualifying' ? driverRows(s).filter(r => Number(r.best) > 0) : [], pool = c.guestRule ? rows.filter(r => { const x = by.get(r.driverId); return !!x && x.from <= at.ri + 1; }) : rows, q = pool[0];
      return { state: tag.kind, ...head, pole: q ? q.driverName || '' : '', poleBonus: c.bonusPole };
    }
    const ses = c.rounds[at.ri].sessions[at.si];
    if (!ses.share) return { state: 'noshare', ...head };
    const list = Array.isArray(sessions) ? sessions : [], res = sessionResult(c, s, qualifyingOf(c, list, at.ri));
    if (!res.ok) return { state: 'notfound', ...head };
    const before = standings(c, marked(c, list, s, false), ctx), after = standings(c, marked(c, list, s, true), ctx);
    const col = after.cols.findIndex(x => x.ri === at.ri), b = new Map(before.drivers.map(d => [d.id, d])), a = new Map(after.drivers.map(d => [d.id, d]));
    const tb = new Map((before.teams || []).map(t => [t.id, t])), ta = new Map((after.teams || []).map(t => [t.id, t]));
    const ofDriver = x => { // the figures of a driver (an entrant, or one who drove for a team) in the Drivers standings
      if (x.guest) return { round: 0, roundDropped: false, total: null, change: 0, pos: 0, posBefore: 0 }; // (a guest who keeps his place when the guest rule is off)
      const now = a.get(x.driverId), was = b.get(x.driverId), cell = now && col >= 0 ? now.cells[col] : null;
      return { name: now ? now.name : x.name, round: cell && cell.state === 'score' ? cell.pts : x.pts, roundDropped: !!(cell && cell.dropped), total: now ? now.total : 0, change: now && was ? round2(now.total - was.total) : x.pts, pos: now ? now.pos : 0, posBefore: was ? was.pos : 0 };
    };
    const ofTeam = x => { // the figures of a team in the Teams standings (nothing when the championship has no team standings)
      const now = ta.get(x.teamId), was = tb.get(x.teamId), cell = now && col >= 0 ? now.cells[col] : null;
      if (!now) return { round: x.pts, roundDropped: false, total: null, change: 0, pos: 0, posBefore: 0 };
      return { name: now.name, round: cell && cell.state === 'score' ? cell.pts : x.pts, roundDropped: !!(cell && cell.dropped), total: now.total, change: was ? round2(now.total - was.total) : x.pts, pos: now.pos, posBefore: was ? was.pos : 0 };
    };
    const rows = res.rows.map(x => {
      if (x.kind === 'team') return { ...x, ...ofTeam(x), members: x.members.map(m => ({ ...m, ...ofDriver(m) })) };
      return { ...x, ...ofDriver(x) };
    });
    const notes = [];
    const tracked = [];
    rows.forEach(x => { if (!x.guest && x.total !== null) tracked.push(x); (x.members || []).forEach(m => { if (!m.guest && !m.noPoints && !m.short && m.total !== null) tracked.push(m); }); });
    const differ = tracked.filter(x => x.change !== x.round);
    if (differ.length) notes.push(`With dropped results the total does not always grow by the points of the round: ${joinNames(differ.map(x => `${x.name} scored ${fmt(x.round)} and gains ${fmt(x.change)}`), 6)}.`);
    const gnames = c.guestRule ? res.guests : res.rows.filter(x => x.guest).map(x => x.name);
    if (gnames.length) notes.push(`${joinNames(gnames)} ${gnames.length === 1 ? 'is a guest' : 'are guests'}: no points${c.guestRule ? ', and the drivers behind move up' : ''}.`);
    const teamRows = rows.filter(x => x.kind === 'team');
    if (teamRows.length) {
      notes.push(teamRaceText(c, true));
      if (c.teamMode === 'none') notes.push('This championship has no team standings (Race Setup > Championships, Points), so only the drivers get points from this race.');
      const guestDrivers = teamRows.flatMap(x => (x.guest ? [] : x.members.filter(m => m.guest).map(m => m.name)));
      if (guestDrivers.length) notes.push(`${joinNames(guestDrivers)} ${guestDrivers.length === 1 ? 'is a guest' : 'are guests'} and drove for a team: the team gets its points, he gets none.`);
      const shorts = teamRows.flatMap(x => (x.guest ? [] : x.members.filter(m => m.short && !m.guest).map(m => m.name)));
      if (shorts.length) notes.push(`${joinNames(shorts)} drove less than ${c.teamMin}% of the laps of the team and get no points.`);
    }
    const teams = after.teams && col >= 0 ? after.teams.map(t => ({ name: t.name, pts: t.cells[col].state === 'score' ? t.cells[col].pts : 0 })).sort((x, y) => y.pts - x.pts) : null;
    return { state: 'race', ...head, share: ses.share, awarded: tag.awarded || '', rows, guests: res.guests, fastest: res.fastest, pole: res.pole, teams, notes, lead: leadText(after),
      decided: after.decided, total: after.total, before, after };
  }

  // The changes to the saved sessions that an action makes: [{ id, champ }], each the whole new tag of a session (a session is written with api.update('sessions', id, { champ })).
  // 'award' marks the session as awarded (and takes the mark off a session of the same round and session that was awarded before: it is replaced), 'undo' takes the mark off,
  // 'off' takes the session out of the championship ("do not count this race"), 'on' brings it back (not awarded).
  function awardPatches(sessions, s, mode, now) {
    const t = s && s.champ; if (!t) return [];
    const strip = (g, ...keys) => { const o = { ...g }; keys.forEach(k => delete o[k]); return o; };
    const same = x => x && x.id !== s.id && x.champ && x.champ.id === t.id && x.champ.roundId === t.roundId && x.champ.sessionId === t.sessionId;
    if (mode === 'award') return [...(Array.isArray(sessions) ? sessions : []).filter(x => same(x) && x.champ.awarded).map(x => ({ id: x.id, champ: strip(x.champ, 'awarded') })), { id: s.id, champ: { ...strip(t, 'off'), awarded: now } }];
    if (mode === 'undo') return [{ id: s.id, champ: strip(t, 'awarded') }];
    if (mode === 'off') return [{ id: s.id, champ: { ...strip(t, 'awarded'), off: true } }];
    if (mode === 'on') return [{ id: s.id, champ: strip(t, 'off') }];
    return [];
  }
  // the races that were driven for the championship and are not awarded (they are not in the standings yet): the latest of every session of a round
  function pendingOf(c, sessions) {
    return [...C.driven(c, sessions).values()].filter(s => { const t = s.champ, at = C.find(c, t); return t.kind === 'race' && !t.awarded && at && c.rounds[at.ri].sessions[at.si].share > 0; });
  }

  // The standings as a table, for the screen and for the PDF: which = 'drivers' | 'teams' | 'rounds'.
  // { title, note, columns: [{ label, r }], rows: [{ lead, cells: [{ t, b, cls }] }], legend: [{ cls, text }] }; cls: 'dr' (a dropped result), 'fl' (a fastest lap bonus is in it), 'mu' (nothing to show)
  function tableOf(c, st, which) {
    const after = st.decided ? `after round ${st.last} of ${st.total}` : 'no race is awarded yet';
    const cellOf = x => (x.state === 'open' ? { t: '\u2013', cls: 'mu' } : x.state === 'na' ? { t: 'n/a', cls: 'mu' } : { t: fmt(x.pts), cls: x.dropped ? 'dr' : x.fast ? 'fl' : '' });
    const roundCols = st.cols.map(x => ({ label: x.label, r: true, title: x.name }));
    const behind = (r, i) => (i ? signed(r.behind) : '\u2013');
    const legend = [], note = st.teamRaces ? (st.dropNote ? st.dropNote + '. ' : '') + teamRaceText(c) : st.dropNote; // (a championship with a race of teams says what such a race gave)
    const anyDrop = [...st.drivers, ...(st.teams || [])].some(r => r.cells.some(x => x.dropped)), anyFast = c.bonusFast > 0 && st.drivers.some(r => r.cells.some(x => x.fast));
    if (anyDrop) legend.push({ cls: 'dr', text: 'a dropped result' });
    if (anyFast) legend.push({ cls: 'fl', text: 'includes the fastest lap bonus' });
    if (st.cols.some(x => !x.decided)) legend.push({ cls: 'mu', text: '\u2013 the round has not been driven' });
    if (st.drivers.some(r => r.cells.some(x => x.state === 'na'))) legend.push({ cls: 'mu', text: 'n/a the driver joins later' });
    if (which === 'teams') {
      const rows = (st.teams || []).map((t, i) => ({ lead: i === 0 && st.decided > 0, cells: [{ t: String(t.pos) }, { t: t.name, b: true }, { t: t.drivers.join(', ') }, ...t.cells.map(cellOf), { t: fmt(t.total), b: true, big: true }, { t: behind(t, i) }] }));
      return { title: `Teams: ${c.teamMode === 'all' ? 'all drivers of a team count in a race' : `the ${c.teamBest} best ${c.teamBest === 1 ? 'driver' : 'drivers'} of a team count in a race`}`, note,
        columns: [{ label: 'Pos' }, { label: 'Team' }, { label: 'Drivers' }, ...roundCols, { label: 'Points', r: true }, { label: 'Behind', r: true }], rows, legend: legend.filter(x => x.cls !== 'fl') };
    }
    if (which === 'rounds') {
      return { title: 'Rounds', note: 'Winner of each race', columns: [{ label: 'Round' }, { label: 'Winner' }, { label: 'Date' }],
        rows: st.board.map(b => ({ lead: false, cells: [{ t: b.label }, { t: b.decided ? b.winner || '\u2013' : 'not driven', b: !!b.winner, cls: b.decided ? '' : 'mu' }, { t: b.date || '' }] })), legend: [] };
    }
    const rows = st.drivers.map((d, i) => ({ lead: i === 0 && st.decided > 0, cells: [{ t: String(d.pos) }, { t: d.name, b: true }, { t: d.teamName }, ...d.cells.map(cellOf), { t: fmt(d.total), b: true, big: true }, { t: behind(d, i) }, { t: String(d.wins) }] }));
    return { title: `Drivers: ${after}`, note, columns: [{ label: 'Pos' }, { label: 'Driver' }, { label: 'Team' }, ...roundCols, { label: 'Points', r: true }, { label: 'Behind', r: true }, { label: 'Wins', r: true }], rows, legend };
  }

  const api = { teamRaceText, awardPatches, pendingOf, tableOf, fmt, signed, joinNames, scaled, outOf, driverRows, qualifyingOf, sessionResult, awardedOf, standings, leadText, reachOf, remainingNote, marked, awardView };
  root.ChampPts = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
