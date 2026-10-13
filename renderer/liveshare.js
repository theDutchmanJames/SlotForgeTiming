// Shares the running race with other windows (and later other devices).
// The heavy part (layout, pictures, drivers) is sent once per heat as the "static" snapshot; the light part
// (laps, fuel, flags, phase) is the "dynamic" data. Both are plain data.
// The receiving side rebuilds a real engine from them, so it draws exactly what the race window draws.
// The dynamic data does not grow with the length of the race: the sender() sends a message only when something changed (and a small
// one every second to keep the clocks right), and of the lists that grow (the lap times) only what is new since the last message.
// Every message has a number (seq); a receiver that misses one asks for the whole state again instead of guessing.
const LiveShare = (() => {
  const Tk = typeof module !== 'undefined' ? require('./tokens.js') : Tokens; // the token clocks of a Time Token Session
  const CAR = ['laps', 'bad', 'last', 'total', 'best', 'done', 'place', 'retired', 'fuel', 'outOfFuel', 'blockAt', 'pit', 'pits', 'lastPit', 'outlap', 'points', 'undoPoints', 'dq', 'pending', 'served', 'extraMs', 'invalid', 'removed'];
  const ENG = ['status', 't0', 'pausedAt', 'endAt', 'timeUp', 'finished', 'endedBy', 'flag', 'calls'];
  const fin = v => (Number.isFinite(v) ? v : null); // Infinity does not survive being sent as text

  // ctx: { eng, track, now, phase, calling (the pre-race call is being said), lights, setup, heat, flash: Map(car -> {at,time,kind}), layout, bestAll, bestAllName, bestBy: Map, base: {personal: Map, track, trackName}, tokens (the snapshot of the token clocks, or nothing) }
  // builds the object the widgets are drawn from (the same for the race window and for a viewer)
  function makeShared(ctx) {
    const { eng, layout, base } = ctx;
    const st = eng.standings(), tk = ctx.tokens ? Tk.view(ctx.tokens) : null;
    const champ = ctx.champ ? { on: !!ctx.champ.on, list: ctx.champ.list || [], done: new Map(ctx.champ.done || []) } : { on: false, list: [], done: new Map() };
    return { champ, rowDesigns: ctx.rowDesigns || [], imageSets: ctx.imageSets || [], clubLogo: ctx.clubLogo || '', eng, track: ctx.track, now: ctx.now, phase: ctx.phase, calling: !!ctx.calling, lights: ctx.lights, setup: ctx.setup, heat: ctx.heat,
      carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(x => x.car === c),
      flashOf: c => ctx.flash.get(c), standings: () => st, tokens: tk,
      laneColorsOf: lane => { // (a lane whose time is up is the colour for that, whatever colour the lane has)
        if (tk && tk.stateOf(lane, eng.elapsed(ctx.now)) === 'out') return { color: Tk.onColor(tk.outColor), bg: tk.outColor };
        const lc = (layout.laneColors || [])[lane] || {}; return { color: lc.text || '', bg: lc.bg || '' }; },
      sessionRecord: () => (Number.isFinite(ctx.bestAll) ? { time: ctx.bestAll, name: ctx.bestAllName } : null),
      trackRecord: () => { const t = Math.min(base.track, ctx.bestAll); return Number.isFinite(t) ? { time: t, name: ctx.bestAll < base.track ? ctx.bestAllName : base.trackName } : null; },
      personalBest: id => Math.min(base.personal.get(id) ?? Infinity, ctx.bestBy.get(id) ?? Infinity) };
  }

  // sent once per engine (a new heat has new cars): c = { raceId, title, eng, setup, layout, track, lanes, base }
  function packStatic(c) {
    return { raceId: c.raceId, title: c.title, cfg: c.eng.cfg, setup: c.setup, layout: c.layout, track: c.track, lanes: c.lanes, rowDesigns: c.rowDesigns || [], imageSets: c.imageSets || [], clubLogo: c.clubLogo || '', tokenUi: c.tokenUi || null,
      base: { personal: [...c.base.personal], track: fin(c.base.track), trackName: c.base.trackName } };
  }

  // Numbers are sent with at most 3 decimals: the lap times are in milliseconds, and a thousandth of a millisecond is far more than is ever shown.
  // The one exception: when cutting a number short would change what a screen shows of it (it lies right on the edge between two thousandths of a second),
  // it is sent as it is, so that every screen shows exactly what the race window shows.
  const shown = ms => Math.floor(ms / 60000) + ':' + ((ms % 60000) / 1000).toFixed(3); // the digits of a time on a screen (the same as RaceEngine.fmtTime)
  const cap = v => { if (typeof v !== 'number' || !Number.isFinite(v)) return v; const r = Math.round(v * 1000) / 1000; return r === v || shown(r) === shown(v) ? r : v; };
  // everything of the dynamic data that is not a list that grows: c = { raceId, eng, phase, calling, lights, heat, flash, bestAll, bestAllName, bestBy, now }
  function core(c) {
    const e = c.eng, d = { raceId: c.raceId, sentNow: cap(c.now), phase: c.phase, calling: !!c.calling, lights: c.lights, heat: c.heat, bestAll: cap(fin(c.bestAll)), bestAllName: c.bestAllName, bestBy: [...c.bestBy].map(([k, v]) => [k, cap(v)]), champ: c.champ || null, tokens: c.tokens ? { ...c.tokens, ends: c.tokens.ends.map(cap) } : null,
      flash: [...c.flash].map(([car, f]) => [e.cars.indexOf(car), cap(f.at), cap(f.time), f.kind]).filter(x => x[0] >= 0) };
    ENG.forEach(k => { d[k] = cap(e[k]); });
    return d;
  }
  const GROWING = ['laps', 'bad'];
  const carCore = car => { const o = {}; CAR.forEach(k => { if (!GROWING.includes(k)) o[k] = cap(car[k]); }); return o; };

  // the whole state in one go (what a window that opens late is given; also what the tests compare with)
  function packDynamic(c) {
    const e = c.eng, d = core(c);
    d.events = (e.events || []).slice();
    d.cars = e.cars.map(car => ({ ...carCore(car), laps: car.laps.map(cap), bad: car.bad.slice() }));
    return d;
  }

  // The sending side of the dynamic data, one per race window. pack(c, now) gives the next message, or null when nothing changed and no message is due.
  // A list is sent as { from, tail }: "keep the first `from` entries you have and put these after them". A lap that is removed from the middle of the list
  // simply gives a smaller `from`, so nothing needs to be told separately. After reset() (or for a new race) the first message holds everything (from: 0).
  function sender(opts = {}) {
    const heartbeat = opts.heartbeat === undefined ? 1000 : opts.heartbeat;
    let seq = 0, last = null, lastKey = null, lastAt = -Infinity;
    const prefix = (prev, cur) => { const n = Math.min(prev.length, cur.length); let p = 0; while (p < n && prev[p] === cur[p]) p++; return p; }; // compared as the race has them (the baseline keeps those); only what is sent is cut short
    const same = x => x;
    return {
      reset() { last = null; lastKey = null; },
      pack(c, nowMs) {
        const e = c.eng, t = nowMs === undefined ? c.now : nowMs;
        if (last && (last.raceId !== c.raceId || last.cars.length !== e.cars.length)) last = null;
        const first = !last, base = last || { raceId: c.raceId, events: [], cars: e.cars.map(() => ({ laps: [], bad: [] })) };
        const d = core(c), cars = e.cars.map(carCore), { sentNow, ...rest } = d;
        const key = JSON.stringify([rest, cars]);
        let changed = first || key !== lastKey;
        const part = (prev, cur, map) => { const from = prefix(prev, cur), raw = cur.slice(from); if (raw.length || from < prev.length) changed = true; return { from, raw, tail: raw.map(map) }; };
        const lapParts = e.cars.map((car, i) => ({ laps: part(base.cars[i].laps, car.laps, cap), bad: part(base.cars[i].bad, car.bad, same) }));
        const evStr = (e.events || []).map(x => JSON.stringify(x)), evFrom = prefix(base.events, evStr);
        if (evStr.length > evFrom || evFrom < base.events.length) changed = true;
        if (!changed && t - lastAt < heartbeat) return null;
        // this message goes out: what the other side now has is what the lists hold now
        base.cars.forEach((b, i) => { ['laps', 'bad'].forEach(k => { const x = lapParts[i][k]; b[k].length = x.from; x.raw.forEach(v => b[k].push(v)); }); });
        base.events = evStr; last = base; lastKey = key; lastAt = t;
        d.seq = ++seq; d.events = { from: evFrom, tail: (e.events || []).slice(evFrom) };
        d.cars = cars.map((o, i) => ({ ...o, laps: { from: lapParts[i].laps.from, tail: lapParts[i].laps.tail }, bad: { from: lapParts[i].bad.from, tail: lapParts[i].bad.tail } }));
        return d;
      }
    };
  }

  // The receiving side: put a message on the state that was built so far (null for none). Returns { ok, state, stale }.
  // ok is false when the message does not fit (one was missed, or this is the first and it is not a whole state): ask for the whole state again.
  // A message without numbers and with whole lists (an older sender, or a state fetched from the app) is always accepted.
  function applyDynamic(state, d) {
    if (!d || typeof d !== 'object' || !Array.isArray(d.cars)) return { ok: false, state };
    const mine = !!state && state.raceId === d.raceId && Number.isFinite(state.seq);
    if (mine && Number.isFinite(d.seq) && d.seq <= state.seq) return { ok: true, state, stale: true };
    const base = mine && Number.isFinite(d.seq) && d.seq === state.seq + 1 && state.cars.length === d.cars.length ? state : null; // lists that start after the first entry only fit on the state they were made for
    const join = (prev, x) => {
      if (Array.isArray(x)) return x;
      if (!x || !Array.isArray(x.tail) || !Number.isInteger(x.from)) return null;
      if (x.from === 0) return x.tail;
      if (!prev || x.from > prev.length) return null;
      return x.from === prev.length ? (x.tail.length ? prev.concat(x.tail) : prev) : prev.slice(0, x.from).concat(x.tail);
    };
    const events = join(base && base.events, d.events === undefined ? [] : d.events);
    if (!events) return { ok: false, state };
    const cars = [];
    for (let i = 0; i < d.cars.length; i++) {
      const c = d.cars[i], b = base && base.cars[i], laps = join(b && b.laps, c.laps), bad = join(b && b.bad, c.bad);
      if (!laps || !bad) return { ok: false, state };
      cars.push({ ...c, laps, bad });
    }
    return { ok: true, state: { ...d, events, cars } };
  }

  // A viewer keeps one of these per window. feed() takes what arrives, shared(now) gives the object to draw from.
  function viewer() {
    let stat = null, dyn = null, eng = null, offset = 0, personal = null, need = false;
    const v = {
      hasRace: () => !!(stat && dyn && stat.raceId === dyn.raceId),
      stat: () => stat, dyn: () => dyn,
      feedStatic(s) { stat = s; dyn = null; need = false; eng = RaceEngine.createRace({ ...s.cfg, entries: s.cfg.entries.map(e => ({ ...e })) }); personal = new Map(s.base.personal); },
      // true when there is something new to draw. When a message did not fit (one was missed), needsSync() says: fetch the whole state and feed that.
      feedDynamic(d, localNow) {
        if (!stat || d.raceId !== stat.raceId) { dyn = null; return false; }
        const r = applyDynamic(dyn, d);
        if (!r.ok) { need = true; return false; }
        if (r.stale) return false; // this one (or a newer one) is in the state already
        need = false; dyn = r.state; offset = localNow - dyn.sentNow; // the race window's clock is not ours: remember the difference
        ENG.forEach(k => { eng[k] = dyn[k]; }); eng.events = dyn.events || []; eng.calls = dyn.calls || [];
        dyn.cars.forEach((c, i) => Object.assign(eng.cars[i], c));
        return true;
      },
      needsSync: () => need,
      // the race window's idea of "now", given our clock
      clock: localNow => localNow - offset,
      engine: () => eng,
      shared(localNow) {
        const d = dyn, t = v.clock(localNow), flash = new Map();
        d.flash.forEach(([i, at, time, kind]) => { if (eng.cars[i]) flash.set(eng.cars[i], { at, time, kind }); });
        return makeShared({ eng, track: stat.track, now: t, phase: d.phase, calling: !!d.calling, lights: d.lights, setup: stat.setup, heat: d.heat, flash, layout: stat.layout, rowDesigns: stat.rowDesigns, imageSets: stat.imageSets, clubLogo: stat.clubLogo,
          champ: d.champ, tokens: d.tokens || null, bestAll: d.bestAll === null ? Infinity : d.bestAll, bestAllName: d.bestAllName, bestBy: new Map(d.bestBy),
          base: { personal, track: stat.base.track === null ? Infinity : stat.base.track, trackName: stat.base.trackName } });
      }
    };
    return v;
  }
  return { makeShared, packStatic, packDynamic, sender, applyDynamic, cap, shown, viewer };
})();
if (typeof module !== 'undefined') module.exports = LiveShare;
