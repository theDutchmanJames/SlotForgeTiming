// Heat-based races: the plan (which driver races in which heat and in which lane), as the Home tab shows it before the race, and what it
// means for the drivers (how many heats each one gets, in which lanes). Pure: no screen in here. The engine (engine.js) builds the groups
// and runs the heats; this file chooses how, remembers the shuffle (a seed) and works the numbers out for the preview.
(function (root) {
  const E = typeof module !== 'undefined' ? require('./engine.js') : root.RaceEngine;

  // A shuffle that can be played again: the same seed gives the same plan, so the plan on Home is the plan that is raced.
  const makeRng = seed => {
    let a = (Math.floor(Number(seed)) >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  const newSeed = () => Math.floor(Math.random() * 4294967295) + 1;

  const distText = (m, unit) => (typeof module !== 'undefined' ? require('./distance.js') : root.Distance).text(m, unit); // (a distance in words: 100 m; distance.js is loaded after this file in the page, so it is looked up when needed)
  const whole = (v, d, lo, hi) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d; };
  // The heat settings of a race setup, with a default for everything that is missing (a setup from an older version has no such field).
  const PLANS = ['manual', 'perdriver', 'roundrobin', 'rotation'];
  function optionsOf(setup) {
    const s = setup || {};
    return {
      plan: PLANS.includes(s.heatPlan) ? s.heatPlan : 'manual',
      heats: whole(s.heats, 3, 1, 200),
      each: whole(s.heatsEach, 3, 1, 50), // (perdriver: the number of heats of every driver)
      even: s.heatEven === 'yes' || s.heatEven === true, // (roundrobin: the same number of heats for everyone)
      seeding: s.heatSeeding === 'mixed' || s.heatSeeding === 'speed' ? s.heatSeeding : 'random',
      by: s.heatBy === 'time' ? 'time' : s.heatBy === 'distance' ? 'distance' : 'laps',
      laps: whole(s.laps, 10, 1, 10000),
      distance: Math.max(0, Number(s.distance) || 0),
      minutes: Math.max(0, Number(s.duration) || 0)
    };
  }

  // ---- building blocks ----
  const shuffle = (list, rnd) => { const x = [...list]; for (let i = x.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [x[i], x[j]] = [x[j], x[i]]; } return x; };
  const pairKey = (a, b) => (a < b ? a + '-' + b : b + '-' + a);
  const evenSizes = (slots, heats) => { const base = Math.floor(slots / heats), extra = slots % heats; return Array.from({ length: heats }, (_, i) => base + (i < extra ? 1 : 0)); };

  // Fills the heats one after the other. sizes: the number of cars of every heat; need[p]: how many heats participant p has to race.
  // Every heat takes the participants who still have to race the most heats (so everybody ends on exactly their number), and from those
  //   mode "random": the ones who have met the others in this heat the least (so the opponents change);
  //   mode "speed": the best ones (by ranks, lower is better), so the best race together;
  //   mode "mixed": the best, then the worst, then the second best... so every heat has fast and slow drivers.
  // Gives the groups (arrays of participants), or null when it did not work out (the caller tries again with another shuffle).
  function groupsByNeed({ count, sizes, need, mode, ranks, rnd }) {
    const left = need.slice(), met = Array.from({ length: count }, () => Array(count).fill(0));
    const base = shuffle([...Array(count).keys()], rnd), at = Array(count); base.forEach((p, n) => { at[p] = n; });
    const rank = p => (ranks && Number.isFinite(ranks[p]) ? ranks[p] : Infinity);
    const byRank = (a, b) => rank(a) - rank(b) || at[a] - at[b]; // (those without a rank come last, in the shuffled order)
    const groups = [];
    for (const size of sizes) {
      const g = [];
      while (g.length < size) {
        const pool = base.filter(p => left[p] > 0 && !g.includes(p));
        if (!pool.length) return null;
        const most = Math.max(...pool.map(p => left[p])), top = pool.filter(p => left[p] === most);
        let pick;
        if (mode === 'speed') pick = top.sort(byRank)[0];
        else if (mode === 'mixed') { const sorted = top.sort(byRank); pick = g.length % 2 === 0 ? sorted[0] : sorted[sorted.length - 1]; }
        else { let bs = null; for (const p of top) { const sc = g.reduce((a, m) => a + met[p][m], 0); if (bs === null || sc < bs) { bs = sc; pick = p; } } }
        g.push(pick);
      }
      for (let a = 0; a < g.length; a++) { left[g[a]]--; for (let b = a + 1; b < g.length; b++) { met[g[a]][g[b]]++; met[g[b]][g[a]]++; } }
      groups.push(g);
    }
    return left.every(n => n === 0) ? groups : null;
  }
  const tryGroups = args => { for (let t = 0; t < 40; t++) { const g = groupsByNeed(args); if (g) return g; } return null; };

  // Everyone races the same number of heats (the number the participants need is the same for all), in heats of the size of the track.
  function groupsPerDriver({ count, lanes, each, mode, ranks, rnd }) {
    const k = Math.min(lanes, count), slots = count * each, heats = Math.ceil(slots / k), sizes = evenSizes(slots, heats);
    return tryGroups({ count, sizes, need: Array(count).fill(each), mode, ranks, rnd });
  }
  // A number of heats that you choose, every heat full: the drivers who race one heat more than the others are chosen at random.
  function groupsManual({ count, lanes, heats, mode, ranks, rnd }) {
    const k = Math.min(lanes, count), slots = heats * k, per = Math.floor(slots / count), extra = slots % count;
    const order = shuffle([...Array(count).keys()], rnd), need = Array(count).fill(per);
    order.slice(0, extra).forEach(p => { need[p]++; });
    return tryGroups({ count, sizes: Array(heats).fill(k), need, mode, ranks, rnd });
  }
  // Round robin leaves some drivers with one heat more than others: more heats are added, until everybody has raced as many as the busiest driver.
  function evenOut(groups, count, lanes, rnd) {
    const k = Math.min(lanes, count), drove = Array(count).fill(0), met = new Map(), out = groups.map(g => g.slice());
    const meet = (a, b) => met.get(pairKey(a, b)) || 0; // (how often two participants have raced in the same heat so far)
    out.forEach(g => { g.forEach(p => { drove[p]++; }); for (let a = 0; a < g.length; a++) for (let b = a + 1; b < g.length; b++) met.set(pairKey(g[a], g[b]), meet(g[a], g[b]) + 1); });
    let target = Math.max(...drove), raised = 0;
    const deficit = () => drove.reduce((a, n) => a + (target - n), 0);
    // (a last heat with one car on its own would be no race: then everybody gets one more heat, so that the last heat has more cars)
    while (k > 1 && deficit() % k === 1 && raised < 20) { target++; raised++; }
    const order = shuffle([...Array(count).keys()], rnd);
    while (deficit() > 0) {
      const g = [];
      while (g.length < k) {
        const pool = order.filter(p => drove[p] < target && !g.includes(p));
        if (!pool.length) break;
        const most = Math.max(...pool.map(p => target - drove[p])), top = pool.filter(p => target - drove[p] === most);
        let pick = top[0], bs = null;
        for (const p of top) { const sc = g.reduce((t, m) => t + meet(p, m), 0); if (bs === null || sc < bs) { bs = sc; pick = p; } }
        g.push(pick);
      }
      for (let a = 0; a < g.length; a++) { drove[g[a]]++; for (let b = a + 1; b < g.length; b++) met.set(pairKey(g[a], g[b]), meet(g[a], g[b]) + 1); }
      out.push(g);
    }
    return out;
  }

  // Colours the edges of a graph of drivers and heats with as many colours as the busiest driver or heat has edges, so that no driver and no heat has
  // a colour twice. A colour is a lane: this gives every driver a lane of their own in every heat, and every heat a lane of its own for every driver.
  // edges: [driver, heat] pairs (a driver is in a heat once). Gives the colour of every edge.
  function colourEdges(edges, drivers, heats, colours) {
    const U = Array.from({ length: drivers }, () => Array(colours).fill(-1)), V = Array.from({ length: heats }, () => Array(colours).fill(-1));
    const free = row => row.indexOf(-1);
    for (const [u, v] of edges) {
      const a = free(U[u]), b = free(V[v]);
      if (V[v][a] === -1) { U[u][a] = v; V[v][a] = u; continue; }
      if (U[u][b] === -1) { U[u][b] = v; V[v][b] = u; continue; }
      // a is used at the heat and b is used at the driver: turn the chain of edges that goes a, b, a, b... from the heat around, which frees a at the heat
      const path = []; let cur = v, onHeat = true, c = a;
      for (;;) { const nxt = onHeat ? V[cur][c] : U[cur][c]; if (nxt === -1) break; path.push(onHeat ? [nxt, cur, c] : [cur, nxt, c]); cur = nxt; onHeat = !onHeat; c = c === a ? b : a; }
      path.forEach(([x, y, cc]) => { U[x][cc] = -1; V[y][cc] = -1; });
      path.forEach(([x, y, cc]) => { const nc = cc === a ? b : a; U[x][nc] = y; V[y][nc] = x; });
      U[u][a] = v; V[v][a] = u;
    }
    return edges.map(([u, v]) => U[u].indexOf(v));
  }

  // The lane of every driver in every heat, so that every driver uses the lanes as evenly as can be: with at most as many heats as lanes, every lane at most once;
  // with more heats, every lane the same number of times, give or take one. This always works out (it does not depend on luck), because the heats of a driver are
  // taken in sets of as many heats as there are lanes, and every set can be coloured (see colourEdges).
  function assignLanes(groups, lanes, rnd) {
    const seen = {}, id = new Map(), edges = []; let virtual = 0;
    groups.forEach((g, h) => g.forEach(p => {
      const j = seen[p] = (seen[p] || 0) + 1, key = p + ':' + Math.floor((j - 1) / lanes);
      if (!id.has(key)) id.set(key, virtual++);
      edges.push({ u: id.get(key), h, p });
    }));
    const order = shuffle(edges.map((_, n) => n), rnd), colour = colourEdges(order.map(n => [edges[n].u, edges[n].h]), virtual, groups.length, lanes);
    const label = shuffle([...Array(lanes).keys()], rnd), lane = new Map();
    order.forEach((n, i) => lane.set(edges[n].h + ':' + edges[n].p, label[colour[i]]));
    return groups.map((g, h) => g.map(p => ({ p, lane: lane.get(h + ':' + p) })));
  }

  // Lane rotation: every driver races once in every lane. With at least as many drivers as lanes, there are as many heats as drivers, and everybody
  // races as many heats as the track has lanes; with fewer drivers than lanes every heat has every driver, in as many heats as there are lanes.
  // (This gives the groups; assignLanes then gives every driver every lane once.)
  function rotation({ count, lanes, rnd }) {
    return count >= lanes ? tryGroups({ count, sizes: Array(count).fill(lanes), need: Array(count).fill(lanes), mode: 'random', ranks: null, rnd })
      : Array.from({ length: lanes }, () => shuffle([...Array(count).keys()], rnd));
  }

  // The schedule of a setup for this many participants and lanes: one array per heat, each with { p: participant number, lane } entries.
  // ranks[p]: how well participant p did in the latest qualifying (0 is best, null or missing when unknown); it is used when the setup asks for seeding.
  function plan({ count, lanes, setup, seed, ranks }) {
    count = whole(count, 0, 0, 1000); lanes = whole(lanes, 1, 1, 64);
    if (!count) return [];
    const o = optionsOf(setup), rnd = makeRng(seed), mode = o.seeding;
    let groups = null;
    if (o.plan === 'rotation') groups = rotation({ count, lanes, rnd });
    else if (o.plan === 'roundrobin') {
      groups = E.buildSchedule({ count, lanes, plan: 'roundrobin', rnd }).map(h => h.map(e => e.p));
      if (o.even) groups = evenOut(groups, count, lanes, rnd);
    } else groups = o.plan === 'perdriver' ? groupsPerDriver({ count, lanes, each: o.each, mode, ranks, rnd }) : groupsManual({ count, lanes, heats: o.heats, mode, ranks, rnd });
    if (!groups) return E.buildSchedule({ count, lanes, plan: 'manual', heats: o.heats, rnd }); // (cannot happen with sensible numbers: the plan of the engine is the safety net)
    if (mode === 'speed' && (o.plan === 'manual' || o.plan === 'perdriver')) groups.reverse(); // the heat of the best drivers comes last
    return assignLanes(groups, lanes, rnd);
  }

  // Is this a schedule that can be raced with these participants and lanes? (a saved plan that no longer fits is thrown away)
  function fits(schedule, count, lanes) {
    if (!Array.isArray(schedule) || !schedule.length) return false;
    return schedule.every(h => Array.isArray(h) && h.length > 0 && h.length <= lanes
      && h.every(e => e && Number.isInteger(e.p) && e.p >= 0 && e.p < count && Number.isInteger(e.lane) && e.lane >= 0 && e.lane < lanes)
      && new Set(h.map(e => e.p)).size === h.length && new Set(h.map(e => e.lane)).size === h.length);
  }

  // A key for a plan: the same key means the same plan. A plan that was changed by hand is only kept for the key it was changed under, so it goes away when the
  // number of participants or the lanes change, when the heat settings change, when the plan is shuffled again or when the qualifying that it was seeded by changes.
  function planKey({ count, lanes, setup, seed, ranks, extra }) {
    const o = optionsOf(setup);
    return JSON.stringify([count, lanes, o.plan, o.heats, o.each, o.even, o.seeding, seed, ranks || null, ...(extra ? [extra] : [])]); // (extra: what else the plan is made from, such as a rotation setup)
  }

  // Swaps two places of a plan: a and b are { heat, lane } (both counted from 0). A place can be empty: then the driver of the other place moves there.
  // Gives { schedule } (the changed plan, as a new object) or { error } (a sentence for the person).
  function swap(schedule, a, b, count, lanes) {
    const ok = x => x && Number.isInteger(x.heat) && Number.isInteger(x.lane) && x.heat >= 0 && x.heat < (schedule || []).length && x.lane >= 0 && x.lane < lanes;
    if (!ok(a) || !ok(b)) return { error: 'That place is not in the plan.' };
    if (a.heat === b.heat && a.lane === b.lane) return { error: 'Those are the same place.' };
    const at = x => schedule[x.heat].find(e => e.lane === x.lane) || null, ea = at(a), eb = at(b);
    if (!ea && !eb) return { error: 'Both places are empty.' };
    const next = schedule.map(h => h.map(e => ({ p: e.p, lane: e.lane })));
    const drop = (x, e) => { if (e) next[x.heat] = next[x.heat].filter(f => f.p !== e.p); };
    drop(a, ea); drop(b, eb);
    if (ea) next[b.heat].push({ p: ea.p, lane: b.lane });
    if (eb) next[a.heat].push({ p: eb.p, lane: a.lane });
    next.forEach(h => h.sort((x, y) => x.lane - y.lane));
    const twice = (ea && next[b.heat].filter(f => f.p === ea.p).length > 1) || (eb && next[a.heat].filter(f => f.p === eb.p).length > 1);
    if (twice) return { error: 'That would put a driver in the same heat twice.' };
    if (next.some(h => !h.length)) return { error: 'A heat needs at least one driver.' };
    if (!fits(next, count, lanes)) return { error: 'That change does not fit the plan.' };
    return { schedule: next };
  }

  // What a schedule means for the participants.
  //   per[p]: { heats, lanes: [times in lane 0, lane 1, ...], meets: number of other participants met at least once }
  //   minHeats, maxHeats: the fewest and the most heats a participant drives; equal: everybody drives the same number
  //   laneSpread: the largest difference, for one participant, between the lane used most and the lane used least (of the lanes that participant could use)
  function stats(schedule, count, lanes) {
    const per = Array.from({ length: count }, () => ({ heats: 0, lanes: Array(lanes).fill(0), met: new Set() }));
    for (const h of schedule) for (const e of h) {
      const x = per[e.p]; if (!x) continue;
      x.heats++; x.lanes[e.lane]++;
      for (const f of h) if (f.p !== e.p) x.met.add(f.p);
    }
    const counts = per.map(x => x.heats);
    const spread = per.reduce((m, x) => { const u = x.lanes; return x.heats ? Math.max(m, Math.max(...u) - Math.min(...u)) : m; }, 0);
    let missing = 0; for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) if (!per[a].met.has(b)) missing++;
    return {
      heats: schedule.length, count, lanes,
      per: per.map(x => ({ heats: x.heats, lanes: x.lanes, meets: x.met.size })),
      minHeats: count ? Math.min(...counts) : 0, maxHeats: count ? Math.max(...counts) : 0,
      equal: count ? Math.min(...counts) === Math.max(...counts) : true,
      laneSpread: spread, missingPairs: missing,
      everyLaneOnce: count > 0 && per.every(x => x.lanes.every(n => n === 1)) // (every driver raced once in every lane)
    };
  }

  // Seconds as minutes and seconds: 65 is 1:05.
  const clock = sec => { const n = Math.max(0, Math.ceil(Number(sec) || 0)); return Math.floor(n / 60) + ':' + String(n % 60).padStart(2, '0'); };

  // The break between two heats. seconds: 0 is no break timer (the race waits until you press Start, as before); auto: start the lights when the break is over.
  function breakOf(setup) {
    const s = setup || {}, n = Math.floor(Number(s.breakSeconds));
    return { seconds: Number.isFinite(n) ? Math.max(0, Math.min(3600, n)) : 0, auto: s.breakAuto === 'yes' || s.breakAuto === true };
  }

  // How the overall result is counted, in words (for Home, the race screen and the report). Empty when it is the standard: all heats added up, no bonus, the standard tie-breaker.
  // sc: the settings of scoringOf (engine.js); byPoints: is the result counted by points?
  const plural = (n, w) => (n === 1 ? `1 ${w}` : `${n} ${w}s`);
  function scoringText(sc, byPoints) {
    const parts = [];
    if (sc.byTime) parts.push(sc.unfinished === 'estimate' ? 'the lowest total race time wins; the finish time of a driver who did not finish a heat is estimated from their own average lap' : 'the lowest total race time wins; a driver who did not finish a heat ranks below the drivers who did, by laps');
    if (sc.countBy === 'average') parts.push('the average per heat');
    else if (sc.countBy === 'best') parts.push(`only the best ${plural(sc.bestHeats, 'heat')} of every driver count${sc.bestHeats === 1 ? 's' : ''}`);
    if (sc.dropWorst) parts.push('the worst heat of every driver is dropped');
    if (byPoints && sc.fastestBonus > 0) parts.push(`${plural(sc.fastestBonus, 'bonus point')} for the fastest lap of every heat`);
    const tie = { bestlap: 'the fastest lap', wins: 'the most heat wins', time: 'the lowest total time' }[sc.tieBreak];
    if (tie) parts.push(`a tie is decided by ${tie} first`);
    return parts.length ? `Overall result: ${parts.join('; ')}.` : '';
  }
  // The result of a driver as it is shown in the Result column: the number that counts, and how many of the heats counted.
  // row: a row of the overall result ({ score, counted, heats }); sc: the settings of scoringOf.
  const num = x => String(Math.round(Number(x) * 100) / 100);
  // fin (optional): { finalMode, byPoints }. When the final is added to the heat result: "28 (2 of 3 heats) + 5 final = 25".
  const scoreText = (row, sc, fin) => {
    const added = !!fin && fin.finalMode === 'added' && row.finalPos !== null && row.finalPos !== undefined;
    if (sc && sc.byTime) { // the result by total race time: the time that counts, and whether it is an estimate or a heat was not finished
      const t = x => (x === null || x === undefined ? '–' : E.fmtTime(x));
      return t(added ? row.heatScore : row.score) + (sc.countBy === 'average' ? ' avg' : '') + (row.estimated ? ' (estimated)' : '') + (row.incomplete ? ` (${row.incomplete} not finished)` : '') + (row.counted < row.heats ? ` (${row.counted} of ${row.heats} heats)` : '')
        + (added ? ` + ${t(row.finalTime)} final = ${t(row.score)}` : '');
    }
    return num(added ? row.heatScore : row.score) + (sc && sc.countBy === 'average' ? ' avg' : '') + (row.counted < row.heats ? ` (${row.counted} of ${row.heats} heats)` : '')
      + (added ? ` + ${num(fin.byPoints ? row.finalPoints : row.finalLaps)} final = ${num(row.score)}` : '');
  };
  const ordinal = n => { const t = n % 100, u = n % 10; return n + (t >= 11 && t <= 13 ? 'th' : u === 1 ? 'st' : u === 2 ? 'nd' : u === 3 ? 'rd' : 'th'); };
  // The Final column of the overall result: "Final A: 1st", or "Final A" while that final has not been raced, or nothing for a driver who is in no final.
  const finalCell = row => (row.finalName ? `Final ${row.finalName}` + (row.finalPos !== null && row.finalPos !== undefined ? `: ${ordinal(row.finalPos)}` : '') : '');
  // One sentence for the results: what the finals did.
  const finalsSaid = fin => (fin && fin.finalMode === 'added' ? 'What a driver scores in a final is added to the heat result.' : 'The finals decide the final places.');
  // The name of a race: "Heat 2", or "Final A" (a saved heat result that has a final field is a final).
  const raceName = h => (h && h.final ? `Final ${h.final}` : `Heat ${h ? h.heat : ''}`);
  // Does every driver count the same number of heats? (the average always does; so does "best N" when nobody has fewer than N heats; dropping the worst heat takes one away from everyone with two or more)
  const countedHeats = (n, sc) => { let c = n; if (sc.dropWorst && c >= 2) c--; if (sc.countBy === 'best') c = Math.min(c, sc.bestHeats); return c; };

  // What happens after the heats, in words (the Home tab). Nothing is known about who races in a final before the heats are raced, so the lines are about the rules.
  function finalsLines(st, setup, o, unit) {
    const f = E.finalsOf(setup), sizes = E.finalSizes(st.count, st.lanes, f.finals);
    if (f.finals === 'none') return [];
    if (!sizes.length) return ['No finals: with one lane or one driver nobody can race against anybody.'];
    const lines = [];
    let first = `Then a final A with the best ${plural(sizes[0], 'driver')} of the heat result`;
    if (sizes.length === 2) first += `, after a final B with the next ${plural(sizes[1], 'driver')}`;
    else if (f.finals === 'ab') first += st.count <= sizes[0] ? ' (all the drivers, so there is no final B)' : ' (only one driver is left over, so there is no final B)';
    lines.push(first + '. In a final the best-placed driver chooses a lane first.');
    lines.push(f.finalMode === 'added' ? 'What a driver scores in a final is added to the heat result.' : 'The finals decide the final places: the heat result only decides who races in which final.');
    const own = o.by === 'time' ? Number(setup.finalDuration) > 0 && `${Number(setup.finalDuration)} minutes` : o.by === 'distance' ? Number(setup.finalDistance) > 0 && distText(Number(setup.finalDistance), unit) : Number(setup.finalLaps) > 0 && `${Number(setup.finalLaps)} laps`;
    if (own) lines.push(`A final is ${own} long.`);
    return lines;
  }

  // The lines of text above the preview. names: the names of the participants. Plain strings (the screen escapes them).
  function summary({ stats: st, setup, names, custom, unit }) { // (custom: the heats come from a rotation setup, so there is no setting to advise about; unit: 'm' or 'ft' for a distance)
    const o = optionsOf(setup), sc = E.scoringOf(setup), lines = [];
    const heatWord = n => (n === 1 ? '1 heat' : n + ' heats');
    const each = o.by === 'time' ? `${o.minutes} minutes` : o.by === 'distance' ? distText(o.distance, unit) : `${o.laps} laps`;
    let head = `${heatWord(st.heats)}, each ${each}`;
    if (o.by === 'time' && o.minutes) head += ` (${st.heats * o.minutes} minutes of racing in total)`;
    lines.push(head + '.');
    if (st.equal) lines.push(st.count > 1 ? `Every driver races ${heatWord(st.maxHeats)}.` : '');
    else if (sc.countBy === 'average') lines.push(`The drivers race ${st.minHeats} to ${st.maxHeats} heats. The result is the average per heat, so that is fair.`);
    else if (countedHeats(st.minHeats, sc) === countedHeats(st.maxHeats, sc)) lines.push(`The drivers race ${st.minHeats} to ${st.maxHeats} heats, but the same number of heats counts for everyone, so that is fair.`);
    else {
      const most = st.per.map((x, i) => [x.heats, i]).filter(([n]) => n === st.maxHeats).map(([, i]) => names[i]);
      const few = st.per.filter(x => x.heats === st.minHeats).length;
      const fix = custom ? '' : o.plan === 'manual' ? ' To avoid it, choose the plan "Every driver races the same number of heats".' : o.plan === 'roundrobin' ? ' To avoid it, set "Same number of heats for everyone" to Yes.' : '';
      const fair = ' Or count the average per heat.';
      lines.push(`The drivers do not race the same number of heats: ${st.minHeats} to ${st.maxHeats} (${few} race${few === 1 ? 's' : ''} ${st.minHeats}, ${most.length} race${most.length === 1 ? 's' : ''} ${st.maxHeats}). The overall result adds the heats up, so a driver with an extra heat has an advantage.${fix}${fair}`);
    }
    if (st.everyLaneOnce) lines.push('Every driver races once in every lane.');
    else if (st.laneSpread >= 2) lines.push('The lanes are not shared evenly: some drivers race more often in one lane than in another (see the table below).');
    else if (st.maxHeats >= 2 && st.lanes > 1) lines.push('The lanes are shared evenly.');
    if (sc.countBy === 'best' && !st.equal && st.minHeats < sc.bestHeats && countedHeats(st.minHeats, sc) !== countedHeats(st.maxHeats, sc)) lines.push(`Some drivers race fewer than ${plural(sc.bestHeats, 'heat')} (${st.minHeats}): all their heats count, so they have fewer than the others.`);
    const how = scoringText(sc, !!setup && setup.resultBy === 'points');
    if (how) lines.push(how);
    if (setup && setup.resultBy === 'time' && !sc.byTime) lines.push('Total race time needs heats that are limited by laps. The heats here are limited by time, so the result is counted by laps.');
    lines.push(...finalsLines(st, setup, o, unit));
    return lines.filter(Boolean);
  }


  // ---- the heat list: every heat (and final) with its drivers, who won it, and what it gave ----
  // h: the heat race of the engine (schedule, results, idx, count, total, finalPlan, picks, raceName); people: the participants (driverName);
  // opts: { live: a heat is racing now (otherwise the heat at idx is the next one), labels: the names of the heats of a rotation setup }.
  // state: done | current (racing now) | next (waits for Start) | later
  function listOf(h, people, opts = {}) {
    const nameOf = p => { const x = people && people[p]; return (x && ((x.asTeam && x.teamName) || x.driverName || x.name)) || ''; }; // (a team that races as a team is named by its team name)
    const total = h.total || h.count || (h.schedule || []).length, out = [];
    for (let i = 0; i < total; i++) {
      const isFinal = i >= h.count;
      let drivers = [];
      if (!isFinal) drivers = (h.schedule[i] || []).slice().sort((a, b) => a.lane - b.lane).map(e => ({ p: e.p, lane: e.lane, name: nameOf(e.p) }));
      else if (h.finalPlan && h.finalPlan[i - h.count]) {
        const f = h.finalPlan[i - h.count], picks = (h.picks && h.picks[f.name]) || [];
        drivers = f.drivers.map(p => { const k = picks.find(x => x.p === p); return { p, lane: k ? k.lane : null, name: nameOf(p) }; });
        if (picks.length) drivers.sort((a, b) => (a.lane === null) - (b.lane === null) || a.lane - b.lane);
      }
      const res = h.results[i] || null, rows = res ? res.rows.map(r => ({ ...r, name: nameOf(r.participant), lane: (drivers.find(d => d.p === r.participant) || {}).lane ?? null })).sort((a, b) => a.pos - b.pos) : [];
      const top = rows.find(r => r.pos === 1) || null;
      const state = i < h.idx ? 'done' : i === h.idx ? (opts.live ? 'current' : 'next') : 'later';
      const label = !isFinal && opts.labels && opts.labels[i] ? String(opts.labels[i]) : '';
      out.push({ n: i + 1, name: h.raceName ? h.raceName(i) : (isFinal ? 'Final' : 'Heat ' + (i + 1)), final: isFinal ? (h.raceName ? h.raceName(i).slice(6) : '') : '', label, state, drivers, rows, winner: top ? { p: top.participant, name: top.name } : null });
    }
    return out;
  }
  // the list of a plan that is not raced yet (the Home tab): names are the participants in the order of the plan
  const planList = (schedule, names, labels) => listOf({ schedule, results: [], idx: 0, count: schedule.length, total: schedule.length }, (names || []).map(driverName => ({ driverName })), { labels });
  // the heat list as it is sent to the other screens (the Heat List widget): short, and without what a screen does not show
  const listLite = list => list.map(x => ({ name: x.name, ...(x.label ? { label: x.label } : {}),
    drivers: x.drivers.map(d => ({ lane: Number.isInteger(d.lane) ? d.lane : -1, name: d.name })),
    rows: x.rows.map(r => ({ pos: r.pos, name: r.name, points: r.points || 0, laps: r.laps, ...(r.tm !== undefined && r.tm !== null ? { tm: r.tm } : {}), ...(r.fin !== undefined ? { fin: r.fin ? 1 : 0 } : {}) })) }));
  const andList = list => (list.length < 2 ? list.join('') : list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1]);
  // "Alex in lane 1, Sam in lane 2 and Kim in lane 3" (a driver without a lane yet is named alone); say: how a driver is named (a function of the driver)
  const lineupText = (entry, say) => andList(((entry && entry.drivers) || []).map(d => (say ? say(d) : d.name) + (Number.isInteger(d.lane) && d.lane >= 0 ? ` in lane ${d.lane + 1}` : '')));
  // the figures of one finished heat for a driver: points and/or the heat time (what the result is counted by)
  function rowFigure(row, o = {}) {
    const bits = [];
    if (o.points) bits.push(`${row.points} ${row.points === 1 ? 'point' : 'points'}`);
    if (o.time && row.tm !== undefined && row.tm !== null) bits.push(E.fmtTime(row.tm) + (row.fin === false ? ' (estimated)' : ''));
    else if (o.time && row.fin === false) bits.push('not finished');
    return bits.join(', ');
  }

  // ---- teams in a heat race (1.8.0): who of a team drives in a heat ----
  // When the participants are teams, the driver is not chosen on Home: every heat has a driver from the roster of the team (the order the team has in the database).
  //   rule 'order':  the drivers take turns in the order of the roster (the first heat of a team the first driver, then the one after the driver who drove last...)
  //   rule 'random': a driver of the team by lot; the drivers who have driven the fewest heats first, and not the same one twice in a row when there is a choice
  //   rule 'chosen': the Race Director chooses before the heat; what is not chosen follows the order
  // A driver can be in more than one team, and can not drive for two teams in the same heat: a driver who is taken is skipped.
  //   o: { rosters: { p: [driver ids] }, heat: [p, ...] (the participants in this heat, in lane order), rule, history: { p: [driver ids of the heats before] }, chosen: { p: driver id }, rnd }
  // Gives { picks: { p: driver id }, clash: [p, ...] (participants that had no free driver: the first of the roster is used anyway), empty: [p, ...] (no drivers at all) }
  function driversForHeat(o) {
    const rosters = o.rosters || {}, hist = o.history || {}, chosen = o.chosen || {}, rnd = o.rnd || Math.random, rule = o.rule === 'random' || o.rule === 'chosen' ? o.rule : 'order';
    const picks = {}, clash = [], empty = [], taken = new Set(), heat = o.heat || [];
    const mine = p => Array.from(new Set((rosters[p] || []).filter(Boolean)));
    for (const p of heat) { // (what the Race Director chose comes first, and only a driver of the team counts)
      if (chosen[p] && mine(p).includes(chosen[p]) && !taken.has(chosen[p])) { picks[p] = chosen[p]; taken.add(chosen[p]); }
    }
    for (const p of heat) {
      if (picks[p] !== undefined) continue;
      const roster = mine(p), done = hist[p] || [];
      if (!roster.length) { empty.push(p); picks[p] = ''; continue; }
      const free = roster.filter(id => !taken.has(id));
      let id;
      if (!free.length) { clash.push(p); id = roster[done.length % roster.length]; }
      else if (rule === 'random') {
        const count = d => done.filter(x => x === d).length, fewest = Math.min(...free.map(count));
        let pool = free.filter(d => count(d) === fewest);
        const last = done[done.length - 1];
        if (pool.length > 1 && pool.includes(last)) pool = pool.filter(d => d !== last);
        id = pool[Math.min(pool.length - 1, Math.floor(rnd() * pool.length))];
      } else { // (in turn: from the driver after the one who drove last, the first one who is free; a team that has not raced starts with its first driver)
        const at = roster.indexOf(done[done.length - 1]), start = at >= 0 ? (at + 1) % roster.length : done.length % roster.length;
        id = roster.map((_, k) => roster[(start + k) % roster.length]).find(d => !taken.has(d));
      }
      picks[p] = id; taken.add(id);
    }
    return { picks, clash, empty };
  }

  const api = { driversForHeat, listOf, listLite, planList, lineupText, rowFigure, andList, makeRng, newSeed, optionsOf, breakOf, clock, planKey, swap, scoringText, scoreText, finalsSaid, finalCell, ordinal, raceName, finalsLines, countedHeats, plan, fits, stats, summary, PLANS, assignLanes, colourEdges, evenOut, groupsByNeed, rotation };
  root.Heats = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
