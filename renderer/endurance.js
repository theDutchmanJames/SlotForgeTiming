// The Endurance Race: teams whose drivers swap in the pits, driving the same car. This file holds the rules and nothing else (no screen, no clock of its own),
// so they can be tested on their own. The race engine (engine.js) keeps one state per car and calls these functions with the time of the race.
//
// Every time is the race clock in milliseconds (the paused time is not in it) and every lap count is the number of laps the car has driven.
// A stint is the time one driver is at the wheel. "unit" is how the setup counts: in minutes, in laps or (1.35.1) in distance (metres: the laps of a car times the length of its lane; stints, swaps,
// the shortest and longest stint, the totals of a driver). The functions that look at the stint take the distance the car has driven (m, metres) as their last argument; only a count in distance uses it.
(function (root) {
  const RaceLimit = typeof module !== 'undefined' ? require('./racelimit.js') : root.RaceLimit; // (what limits a race)
  const num = (v, d) => (v === '' || v === null || !Number.isFinite(Number(v)) ? d : Math.max(0, Number(v)));
  const MODES = ['every', 'moments', 'free'], NEXT = ['order', 'chosen', 'random'], CONFIRM = ['both', 'sensor', 'button'];
  const EPS = 1e-9;

  // "30, 1:30:00, 2:00:00" -> [30, 90, 120] minutes (a number is minutes, m:ss is minutes and seconds, h:mm:ss is hours, minutes and seconds). For laps only whole numbers count; for a distance (metres)
  // any number above zero, with a point or a comma for the decimals ("12.5").
  // The moments are sorted and each is there once; anything that is not a number above zero is left out.
  function parseMoments(text, unit) {
    const out = [];
    String(text ?? '').split(/[;,\s]+/).filter(Boolean).forEach(tok => {
      let n = NaN;
      if (unit === 'laps') n = /^\d+$/.test(tok) ? Number(tok) : NaN;
      else if (unit === 'distance') n = /^\d+(?:\.\d+)?$/.test(tok) ? Number(tok) : NaN;
      else if (/^\d+(?:[.,]\d+)?$/.test(tok)) n = Number(tok.replace(',', '.'));
      else {
        const m = /^(\d+):([0-5]?\d)(?::([0-5]?\d))?$/.exec(tok);
        if (m) n = m[3] === undefined ? Number(m[1]) + Number(m[2]) / 60 : Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60;
      }
      if (Number.isFinite(n) && n > 0) out.push(Math.round(n * 1e6) / 1e6);
    });
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  // The rules of a race setup (the fields of the Endurance folder). Gives null for a race setup that is not an Endurance Race.
  function clean(s) {
    if (!s || s.sessionType !== 'endurance') return null;
    // 1.35.1: counted in distance, the lengths come from the fields of their own (swapEveryDist, ... in metres); where says whether a swap is due at the next crossing of the line ('line') or at the distance itself, anywhere ('anywhere')
    const unit = s.swapUnit === 'laps' ? 'laps' : s.swapUnit === 'distance' ? 'distance' : 'minutes', dist = unit === 'distance', dflt = dist ? 50 : unit === 'laps' ? 20 : 30, every = num(dist ? s.swapEveryDist : s.swapEvery, dflt);
    const of = (a, b) => num(dist ? s[b] : s[a], 0);
    return {
      on: true, unit, mode: MODES.includes(s.swapMode) ? s.swapMode : 'every',
      every: every > 0 ? every : dflt, moments: parseMoments(dist ? s.swapMomentsDist : s.swapMoments, unit),
      stintMin: of('stintMin', 'stintMinDist'), stintMax: of('stintMax', 'stintMaxDist'), totalMin: of('totalMin', 'totalMinDist'), totalMax: of('totalMax', 'totalMaxDist'),
      warn: num(dist ? s.swapWarnDist : s.swapWarn, dist ? 10 : 1), ...(dist ? { where: s.swapWhere === 'anywhere' ? 'anywhere' : 'line', disp: 'm' } : {}), confirm: CONFIRM.includes(s.swapConfirm) ? s.swapConfirm : 'both', seconds: num(s.swapSeconds, 10),
      next: NEXT.includes(s.swapNext) ? s.swapNext : 'order',
      grace: num(s.swapGrace, 30), penalty: Math.floor(num(s.swapPenalty, 0)), repeat: num(s.swapRepeat, 0), late: s.swapLate === 'stop' ? 'stop' : 'count',
      early: s.swapEarly === 'penalty' ? 'penalty' : 'allow', minPenalty: Math.floor(num(s.minPenalty, 0))
    };
  }

  // The race setup as the race screen works with it: an Endurance Race is raced as the kind of race it is made of (a race by laps, a timed race or heats),
  // with the rules of the swaps in setup.endurance; setup.ofType keeps what it really is. Any other setup is given back as it is.
  function effective(setup) {
    if (setup && setup.sessionType === 'race' && setup.raceBy === 'time') return RaceLimit.effective(setup); // (1.62.0: a Race limited by a time is raced as a Timed race)
    if (!setup || setup.sessionType !== 'endurance') return RaceLimit.scoring(setup); // (1.65.0: heats limited by a time have their own scoring choice)
    const by = setup.enduranceBy === 'laps' || setup.enduranceBy === 'distance' ? 'race' : setup.enduranceBy === 'heats' ? 'heats' : 'timed';
    return RaceLimit.scoring({ ...setup, sessionType: by, ofType: 'endurance', endurance: clean(setup), raceBy: setup.enduranceBy === 'distance' ? 'distance' : 'laps', ...(by === 'heats' && !setup.rotation ? { participants: 'teams' } : {}) }); // (raceBy: a long race by distance is a race by distance)
  }

  const cur = st => st.stints[st.stints.length - 1];
  const isOpen = s => s.ms1 === undefined; // (a stint that has not ended: the one at the wheel; after the end of the race every stint is closed)
  // the state of a car at the start of the race: the driver who starts (the first of the roster when the given one is not in it)
  function newCar(cfg, roster, startId) {
    const ids = (roster || []).map(r => r.id), d = ids.includes(startId) ? startId : ids[0] || '';
    return { d, stints: [{ d, ms0: 0, l0: 0, m0: 0 }], tot: {}, mi: 0, due: null, pen: 0, nextId: '', picked: false, swaps: 0, lost: false, warned: false };
  }
  const unitMs = (cfg, ms, laps, m) => (cfg.unit === 'laps' ? laps : cfg.unit === 'distance' ? m || 0 : ms / 60000);
  // what a driver has driven in the stints that are over, and in the one that goes on
  const driven = (st, id, el, laps, m) => {
    const t = st.tot[id] || { ms: 0, laps: 0, m: 0 }, s = cur(st);
    return s.d === id && isOpen(s) ? { ms: t.ms + (el - s.ms0), laps: t.laps + (laps - s.l0), m: (t.m || 0) + ((m || 0) - (s.m0 || 0)) } : { ms: t.ms, laps: t.laps, m: t.m || 0 };
  };

  // How the stint is going: the progress, and whether a swap is due. Changes nothing.
  //   state: 'ok' | 'soon' (due within the warning) | 'due' (the swap has to be made) | 'overdue' (not made within the grace time)
  //   left: how much of the unit is left until the swap is due (negative when it is overdue; null when nothing makes a swap due, in a free swap without a longest stint)
  //   why: what makes the swap due ('interval', 'moment', 'max' or 'total'); allowed: the shortest stint is over, so a swap is fine; over: seconds since the swap was due
  function look(cfg, st, el, laps, m) {
    const s = cur(st), ms = el - s.ms0, nl = laps - s.l0, nm = Math.max(0, (m || 0) - (s.m0 || 0));
    const meas = unitMs(cfg, ms, nl, nm), pos = unitMs(cfg, el, laps, m), mine = driven(st, s.d, el, laps, m), total = unitMs(cfg, mine.ms, mine.laps, mine.m);
    const reasons = [];
    if (cfg.mode === 'every') reasons.push({ why: 'interval', left: cfg.every - meas });
    if (cfg.mode === 'moments' && cfg.moments[st.mi] !== undefined) reasons.push({ why: 'moment', left: cfg.moments[st.mi] - pos });
    if (cfg.stintMax > 0) reasons.push({ why: 'max', left: cfg.stintMax - meas });
    if (cfg.totalMax > 0) reasons.push({ why: 'total', left: cfg.totalMax - total });
    const first = reasons.length ? reasons.reduce((a, b) => (b.left < a.left ? b : a)) : null;
    const due = !!st.due || (!!first && first.left <= EPS);
    // the moment it became due: exactly, when the unit is time (the swap was due before this look); for laps it is now
    const dueMs = st.due ? st.due.ms : due ? (cfg.unit === 'minutes' && first ? el + first.left * 60000 : el) : null;
    const over = due ? Math.max(0, (el - dueMs) / 1000) : 0, overdue = due && over >= cfg.grace - EPS;
    const left = st.due ? (first ? first.left : 0) : first ? first.left : null;
    const soon = !due && first !== null && first.left <= cfg.warn + EPS;
    return { state: overdue ? 'overdue' : due ? 'due' : soon ? 'soon' : 'ok', due, overdue, soon, left, why: st.due ? st.due.why : first ? first.why : '', dueMs, over, meas, pos, total,
      allowed: due || meas + EPS >= cfg.stintMin, stintMs: ms, stintLaps: nl, stintM: nm };
  }

  // The look at a moment of the race, and what changed since the last one (the state is changed): { look, events }.
  //   events: { type: 'soon' } once per stint, { type: 'due', why } when the swap has to be made, { type: 'late', n, total } for every penalty that is owed (n new ones, total so far)
  // st.lost says that laps are not counted any more (the swap is overdue and the setup stops counting).
  function step(cfg, st, el, laps, m) {
    let l = look(cfg, st, el, laps, m);
    const events = [];
    if (l.soon && !st.warned) { st.warned = true; events.push({ type: 'soon' }); }
    if (l.due && !st.due) { st.due = { ms: l.dueMs, laps, why: l.why }; events.push({ type: 'due', why: l.why }); l = look(cfg, st, el, laps, m); }
    if (l.overdue) {
      const owed = cfg.repeat > 0 ? 1 + Math.floor(Math.max(0, l.over - cfg.grace + EPS) / cfg.repeat) : 1;
      if (owed > st.pen) { events.push({ type: 'late', n: owed - st.pen, total: owed }); st.pen = owed; }
      if (cfg.late === 'stop') st.lost = true;
    }
    return { look: l, events };
  }

  // Who may step in next: every driver of the roster, and whether he can. busy: ids of drivers who are at the wheel of another car in this race.
  function choices(cfg, st, roster, busy, el, laps, m) {
    const at = cur(st).d, b = busy instanceof Set ? busy : new Set(busy || []);
    return (roster || []).map(r => {
      if (r.id === at) return { id: r.id, ok: false, why: 'is at the wheel' };
      if (b.has(r.id)) return { id: r.id, ok: false, why: 'drives for another team now' };
      const dr = cfg.totalMax > 0 ? driven(st, r.id, el, laps, m) : null;
      if (dr && unitMs(cfg, dr.ms, dr.laps, dr.m) + EPS >= cfg.totalMax) return { id: r.id, ok: false, why: 'has driven the longest total' };
      return { id: r.id, ok: true, why: '' };
    });
  }
  // The driver who steps in: in turn (the next in the roster who can), or by lot among those who can. When nobody can (everybody else is at the longest total), a driver who is free
  // steps in anyway; '' when there is nobody (a team with one driver, or the others are driving for other teams).
  function suggest(cfg, st, roster, busy, el, laps, rnd, m) {
    const list = roster || [], at = cur(st).d, k = choices(cfg, st, list, busy, el, laps, m), ok = k.filter(x => x.ok).map(x => x.id);
    const free = k.filter(x => x.why !== 'is at the wheel' && x.why !== 'drives for another team now').map(x => x.id);
    const pool = ok.length ? ok : free;
    if (!pool.length) return '';
    if (cfg.next === 'random') return pool[Math.min(pool.length - 1, Math.floor((rnd || Math.random)() * pool.length))];
    const from = Math.max(0, list.findIndex(r => r.id === at));
    for (let n = 1; n < list.length; n++) { const id = list[(from + n) % list.length].id; if (pool.includes(id)) return id; }
    return pool[0];
  }

  // The swap is made: the stint ends, the next driver starts. o: { el, laps, m (the distance driven, metres), to (the driver who steps in; else the one that was picked, else the suggestion), by ('sensor' | 'button'), busy, rnd, roster }
  // Gives { ok, from, to, early (before the shortest stint), over (the driver who steps in is past the longest total), stintMs, stintLaps, stintM, due (the swap was due) } or { ok: false, error }.
  function swap(cfg, st, o) {
    const roster = o.roster || [], s = cur(st), at = s.d, l = look(cfg, st, o.el, o.laps, o.m);
    const k = choices(cfg, st, roster, o.busy, o.el, o.laps, o.m);
    let to = o.to || (st.picked || cfg.next === 'random' ? st.nextId : '') || '', c = k.find(x => x.id === to); // (in turn, the driver is worked out now: who is free may have changed since he was planned)
    if (!c || to === at || c.why === 'drives for another team now') { // nobody was named, or the one who was meant cannot: the driver in turn (or by lot) who can
      to = suggest(cfg, st, roster, o.busy, o.el, o.laps, o.rnd, o.m); c = k.find(x => x.id === to);
      if (!to) return { ok: false, error: 'nobody to step in' };
    }
    const over = c.why === 'has driven the longest total';
    const m1 = o.m || 0, stintM = Math.max(0, m1 - (s.m0 || 0));
    s.ms1 = o.el; s.l1 = o.laps; s.m1 = m1; s.by = o.by || 'button';
    const t = st.tot[at] || { ms: 0, laps: 0, m: 0 };
    st.tot[at] = { ms: t.ms + (o.el - s.ms0), laps: t.laps + (o.laps - s.l0), m: (t.m || 0) + stintM };
    st.stints.push({ d: to, ms0: o.el, l0: o.laps, m0: m1 }); st.d = to;
    const pos = unitMs(cfg, o.el, o.laps, m1); while (cfg.moments[st.mi] !== undefined && cfg.moments[st.mi] <= pos + EPS) st.mi++;
    st.due = null; st.pen = 0; st.lost = false; st.warned = false; st.nextId = ''; st.picked = false; st.swaps++;
    return { ok: true, from: at, to, early: !l.allowed, over, due: l.due, stintMs: o.el - s.ms0, stintLaps: o.laps - s.l0, stintM };
  }

  // The race is over: the stint at the wheel ends with it (what the driver drove is then in his total, and the stints no longer go on).
  function close(cfg, st, el, laps, m) {
    const s = cur(st); if (!isOpen(s)) return false;
    s.ms1 = el; s.l1 = laps; s.m1 = m || 0; s.by = s.by || 'end';
    const t = st.tot[s.d] || { ms: 0, laps: 0, m: 0 };
    st.tot[s.d] = { ms: t.ms + (el - s.ms0), laps: t.laps + (laps - s.l0), m: (t.m || 0) + Math.max(0, (m || 0) - (s.m0 || 0)) };
    return true;
  }

  // The Race Director picks the driver who steps in next (only a driver of the roster who is not at the wheel). Gives true when it was taken.
  function pick(cfg, st, roster, id, busy) {
    if (!(roster || []).some(r => r.id === id) || id === cur(st).d) return false;
    if ((busy instanceof Set ? busy : new Set(busy || [])).has(id)) return false;
    st.nextId = id; st.picked = true; return true;
  }
  // Keeps the driver who is next up to date: in turn, a pick of the Race Director stays while it is possible; by lot the driver is drawn once the swap is due.
  function plan(cfg, st, roster, busy, el, laps, rnd, m) {
    const k = choices(cfg, st, roster, busy, el, laps, m), good = id => !!id && (k.find(x => x.id === id) || {}).ok === true;
    if (st.picked && good(st.nextId)) return st.nextId; // (the Race Director picked a driver, and he can step in)
    st.picked = false;
    if (cfg.next === 'random') { // nobody is drawn before the swap is due; the driver who was drawn stays while he can step in
      if (!st.due) st.nextId = ''; else if (!good(st.nextId)) st.nextId = suggest(cfg, st, roster, busy, el, laps, rnd, m);
      return st.nextId;
    }
    st.nextId = suggest(cfg, st, roster, busy, el, laps, rnd, m);
    return st.nextId;
  }

  // The stints so far, the one that goes on included (it has no end yet): [{ d, ms0, l0, m0, ms1, l1, m1, ms, laps, m, by, now }] (m: the metres driven in the stint; 0 when the race has no lane lengths)
  function stints(st, el, laps, m) {
    return st.stints.map((s, n) => {
      const last = n === st.stints.length - 1 && isOpen(s), ms1 = last ? el : s.ms1, l1 = last ? laps : s.l1, m1 = last ? m || 0 : s.m1 || 0;
      return { d: s.d, ms0: s.ms0, l0: s.l0, m0: s.m0 || 0, ms1, l1, m1, ms: Math.max(0, ms1 - s.ms0), laps: Math.max(0, l1 - s.l0), m: Math.max(0, m1 - (s.m0 || 0)), by: s.by || '', now: last };
    });
  }
  // What every driver has driven in all: [{ id, ms, laps, m, now }] in the order of the roster (a driver who is not in it, but did drive, after them)
  function totals(st, roster, el, laps, m) {
    const ids = (roster || []).map(r => r.id); st.stints.forEach(s => { if (!ids.includes(s.d)) ids.push(s.d); });
    return ids.map(id => { const x = driven(st, id, el, laps, m); return { id, ms: x.ms, laps: x.laps, m: x.m, now: cur(st).d === id }; });
  }
  // The driver at the wheel for lap n (counted from 0): the laps that were driven before a swap belong to the driver who left.
  function driverAtLap(st, n) {
    for (let i = st.stints.length - 1; i > 0; i--) if (n >= st.stints[i].l0) return st.stints[i].d;
    return st.stints[0].d;
  }
  // Drivers of the roster who have driven less than the shortest total at the end of the race: [{ id, ms, laps }]. A driver who did not drive at all counts too.
  function short(cfg, st, roster, el, laps, m) {
    return totals(st, roster, el, laps, m).filter(x => (roster || []).some(r => r.id === x.id) && unitMs(cfg, x.ms, x.laps, x.m) + EPS < cfg.totalMin);
  }

  // ---- words for the screens ----
  const Dst = () => (typeof module !== 'undefined' ? require('./distance.js') : root.Distance), Spd = () => (typeof module !== 'undefined' ? require('./speed.js') : root.Speed);
  // a distance (metres) as the setup counts it, in metres or feet as App Settings say (cfg.disp): "50 m", "7.5 m", "164 ft"; one decimal only for a number under 100 that is not a whole one in that unit
  const distText = (cfg, v) => { const ft = cfg && cfg.disp === 'ft', x = ft ? v / Spd().M_PER_FT : v, whole = Math.abs(x - Math.round(x)) < 0.05; return Dst().text(v, ft ? 'ft' : 'm', whole || x >= 100 ? 0 : 1); };
  const clock = ms => { const s = Math.max(0, Math.round(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
  // how much is left, as the setup counts it: "12:30" (minutes) or "3 laps"
  const leftText = (cfg, left) => (left === null || left === undefined ? '' : cfg.unit === 'distance' ? distText(cfg, Math.max(0, left)) : cfg.unit === 'laps' ? `${Math.max(0, Math.ceil(left - EPS))} ${Math.max(0, Math.ceil(left - EPS)) === 1 ? 'lap' : 'laps'}` : clock(Math.max(0, left) * 60000));
  // how long the setup counts, spoken: "30 minutes", "1 lap"
  const spanText = (cfg, n) => { if (cfg.unit === 'distance') return distText(cfg, n); const v = Math.round(n * 100) / 100; return cfg.unit === 'laps' ? `${v} ${v === 1 ? 'lap' : 'laps'}` : `${v} ${v === 1 ? 'minute' : 'minutes'}`; };
  // the rules of a setup in a few words, for under the title of the race: "a swap every 30 minutes", "swaps at 30 minutes, 90 minutes", "a swap when the team chooses (stints of 10 to 40 minutes)"
  function rulesText(cfg) {
    if (!cfg || !cfg.on) return '';
    const sp = n => spanText(cfg, n), bound = (lo, hi) => (lo > 0 && hi > 0 ? ` (stints of ${sp(lo).replace(/\s*[A-Za-z]+\.?$/, '')} to ${sp(hi)})` : hi > 0 ? ` (a stint of ${sp(hi)} at most)` : lo > 0 ? ` (a stint of ${sp(lo)} at least)` : '');
    const where = cfg.unit === 'distance' ? (cfg.where === 'anywhere' ? ' anywhere on the track' : ' at the line') : ''; // (a swap by distance: at the next crossing of the line, or at the distance itself)
    if (cfg.mode === 'every') return `a swap every ${sp(cfg.every)}${where}`;
    if (cfg.mode === 'moments') return cfg.moments.length ? `swaps after ${cfg.moments.map(sp).join(', ')}${where}` : 'no swaps planned';
    return 'a swap when the team chooses' + bound(cfg.stintMin, cfg.stintMax) + where;
  }
  // The progress of the stint of one car, in words, for a screen: { kind: 'ok'|'soon'|'due'|'overdue', text } (look: what Endurance.look gave, or the engine's enLook)
  function chipOf(cfg, l) {
    if (l.state === 'overdue') return { kind: 'overdue', text: `SWAP NOW: ${Math.round(l.over)} s late${l.lost ? ', laps not counted' : ''}` };
    if (l.state === 'due') return { kind: 'due', text: 'SWAP NOW' };
    if (l.left === null || l.left === undefined) return { kind: l.state, text: l.allowed ? 'Swap when you like' : `Swap from ${leftText(cfg, cfg.stintMin - l.meas)}` };
    if (cfg.mode === 'free' && !l.allowed) return { kind: l.state, text: `Swap from ${leftText(cfg, cfg.stintMin - l.meas)}` };
    return { kind: l.state, text: `Swap in ${leftText(cfg, l.left)}` };
  }
  // The time a driver has driven, as the setup counts it
  // A span as it is said aloud (the audio calls): "5 metres", "1 foot", "16.4 feet"; minutes and laps as spanText has them.
  const WORD = { m: ['metre', 'metres'], ft: ['foot', 'feet'], km: ['kilometre', 'kilometres'], mi: ['mile', 'miles'] };
  const spokenSpan = (cfg, n) => { const t = spanText(cfg, n); if (cfg.unit !== 'distance') return t; const q = /^([\d.]+) (m|ft|km|mi)$/.exec(t); return q ? `${q[1]} ${WORD[q[2]][Number(q[1]) === 1 ? 0 : 1]}` : t; };
  const spentText = (cfg, ms, laps, m) => (cfg.unit === 'laps' ? `${laps} ${laps === 1 ? 'lap' : 'laps'}` : cfg.unit === 'distance' ? distText(cfg, m || 0) : clock(ms));

  // What the swap panel shows (the race screen and the Race Director page): one row per car that swaps. eng: a race engine (the real one, or the copy a viewer follows), t: the time of the screen, phase: the phase of the race screen.
  function view(eng, lanes, t, phase) {
    const cfg = eng && eng.endurance;
    if (!cfg) return { on: false, info: '', rows: [] };
    const racing = phase === 'running' || phase === 'paused', rows = [];
    eng.cars.forEach((c, i) => {
      if (!c.en || (lanes && !lanes.includes(c.lane))) return;
      const l = eng.enLook(i, t); if (!l) return;
      const nameOf = id => { const r = (c.roster || []).find(x => x.id === id); return r ? r.name || '' : ''; }, chip = chipOf(cfg, l);
      rows.push({ lane: c.lane, team: c.teamName || '', driver: c.driverName || '', next: l.next || '', nextName: nameOf(l.next), picked: !!l.picked, chosen: cfg.next === 'chosen',
        stint: `${clock(l.stintMs)} · ${l.stintLaps} ${l.stintLaps === 1 ? 'lap' : 'laps'}${cfg.unit === 'distance' ? ' · ' + distText(cfg, l.stintM || 0) : ''}`, kind: chip.kind, chip: chip.text, why: l.state === 'due' || l.state === 'overdue' ? whyText(l.why) : '',
        standing: l.standLeft === null || l.standLeft === undefined ? null : Math.ceil(l.standLeft / 1000), swaps: l.swaps || 0, lost: !!l.lost,
        choices: (l.choices || []).map(x => ({ id: x.id, name: nameOf(x.id), ok: x.ok, why: x.why })),
        totals: (l.totals || []).map(x => ({ id: x.id, name: nameOf(x.id) || '?', text: spentText(cfg, x.ms, x.laps, x.m), now: !!x.now })),
        button: { show: cfg.confirm !== 'sensor', disabled: !racing || !l.next, text: l.allowed ? 'Swap done' : 'Swap done (too early)' } });
    });
    return { on: rows.length > 0, info: rulesText(cfg), rows };
  }

  const WHY = { interval: 'the stint is over', moment: 'it is time for the swap', max: 'the longest stint is over', total: 'the longest total of the driver is reached' };
  const whyText = why => WHY[why] || '';

  const api = { clean, effective, parseMoments, newCar, look, step, choices, suggest, swap, close, pick, plan, stints, totals, driverAtLap, short, clock, leftText, spanText, spokenSpan, whyText, rulesText, chipOf, spentText, distText, view, cur, MODES, NEXT, CONFIRM };
  root.Endurance = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
