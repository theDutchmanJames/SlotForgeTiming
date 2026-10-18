// Time tokens: a lane is switched on for a paid time, and when the time runs out the lane turns red.
// Pure: no screen, no clock of its own. Every call is given `T`, the time of the race clock (RaceEngine's elapsed time), so the token clocks
// stand still when the race is paused (or under a red flag) and run again when it goes on.
// A lane is idle (nothing bought), running, in its warning (the last seconds) or out (the time is up). One paid period of one driver on one lane is a
// "stint". A stint ends when the lane is cleared, when the driver changes, when new time is bought for a lane that is out, or when the session ends;
// a finished stint is handed over (takeClosed) to be saved with its laps. Laps driven after the time was up are kept but marked "late".
(function (root) {
  const MIN = 60000;
  const LN = typeof module !== 'undefined' ? require('./listnum.js') : root.ListNum; // (a decimal comma: 0,5 minutes)
  const DEFAULTS = { increments: [1, 5, 10, 15, 30, 60], decrements: [1, 5, 10], warnSeconds: 60, warnColor: '#ffb300', outColor: '#d62828' };
  const hex = (v, d) => (/^#[0-9a-fA-F]{6}$/.test(String(v || '')) ? String(v).toLowerCase() : d);
  const clean = (v, d, lo, hi) => { const n = v === '' || v === null || v === undefined ? NaN : Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

  // "5, 10, 15, 30, 60" -> minutes. Anything that is not a number above zero is dropped; at most 8; nothing usable gives the default buttons.
  const minutesIn = text => {
    const seen = new Set(), list = [];
    (Array.isArray(text) ? text : LN.items(text)).forEach(x => {
      const n = Number(String(x).replace(',', '.'));
      if (String(x).trim() !== '' && Number.isFinite(n) && n > 0 && n <= 1440 && !seen.has(n)) { seen.add(n); list.push(n); }
    });
    return list.slice(0, 8);
  };
  function parseIncrements(text) { const list = minutesIn(text); return list.length ? list : DEFAULTS.increments.slice(); }
  // the buttons that take time off: nothing set gives the standard ones, an empty field means no such buttons at all
  function parseDecrements(text) { return text === undefined || text === null ? DEFAULTS.decrements.slice() : minutesIn(text); }
  // the settings page's values (the free-form settings of the app) with their defaults
  function settingsOf(s) {
    s = s || {};
    return { increments: parseIncrements(s.tokenIncrements), decrements: parseDecrements(s.tokenDecrements), warnSeconds: clean(s.tokenWarnSeconds, DEFAULTS.warnSeconds, 0, 3600), warnColor: hex(s.tokenWarnColor, DEFAULTS.warnColor), outColor: hex(s.tokenOutColor, DEFAULTS.outColor) };
  }
  // black or white text for a background colour (the same rule the timing widgets use)
  const onColor = h => { const n = parseInt(String(h).slice(1), 16) || 0; return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 150 ? '#000' : '#fff'; };
  const incLabel = m => '+' + (Number.isInteger(m) ? m : String(m).replace('.', ',')) + ' min';
  const decLabel = m => '\u2212' + (Number.isInteger(m) ? m : String(m).replace('.', ',')) + ' min'; // (a real minus sign)

  // the time left as it is shown: 05:00, 59:59, 1:05:00 (whole seconds, rounded up so a clock never shows 00:00 while time is left)
  function clockText(ms) {
    const s = Math.max(0, Math.ceil((ms - 1e-6) / 1000)), p2 = n => String(n).padStart(2, '0');
    return s >= 3600 ? `${Math.floor(s / 3600)}:${p2(Math.floor(s / 60) % 60)}:${p2(s % 60)}` : `${p2(Math.floor(s / 60))}:${p2(s % 60)}`;
  }
  const stateAt = (endT, T, warnMs) => (endT === null || endT === undefined ? 'idle' : endT - T <= 1e-6 ? 'out' : endT - T <= warnMs ? 'warning' : 'running');

  // What a screen needs to draw the clocks: ends[lane] is the race-clock time at which that lane's time runs out (null: nothing bought).
  // It is small, it only changes when someone buys time, and it travels with the live data to the other screens and phones.
  function view(snap) {
    const S = snap || { ends: [] }, warnMs = (Number(S.warnMs) || 0);
    return {
      on: true, warnMs, warnColor: hex(S.warnColor, DEFAULTS.warnColor), outColor: hex(S.outColor, DEFAULTS.outColor), lanes: (S.ends || []).length,
      endOf: lane => ((S.ends || [])[lane] === undefined ? null : S.ends[lane]),
      stateOf: (lane, T) => stateAt((S.ends || [])[lane], T, warnMs),
      left: (lane, T) => { const e = (S.ends || [])[lane]; return e === null || e === undefined ? 0 : Math.max(0, e - T); },
      // can Undo take something back on this lane (the same rule as create().canUndo)
      canUndo: (lane, T) => { const k = (S.lastOp || [])[lane]; return !!k && (k === 'end' || stateAt((S.ends || [])[lane], T, warnMs) !== 'out'); },
      // was this lap of the stint on the lane driven after the time was up (it can't be made valid again)
      lateAt: (lane, n) => ((S.lates || [])[lane] || []).includes(n)
    };
  }

  // cfg: { lanes, warnSeconds, warnColor, outColor, increments }
  function create(cfg) {
    cfg = cfg || {};
    const set = settingsOf({ tokenWarnSeconds: cfg.warnSeconds, tokenWarnColor: cfg.warnColor, tokenOutColor: cfg.outColor });
    const warnMs = set.warnSeconds * 1000, count = Math.max(0, Math.floor(Number(cfg.lanes)) || 0);
    let seq = 0, closed = [];
    const lanes = Array.from({ length: count }, () => ({ who: null, stint: null }));
    const bestOf = s => { const g = s.laps.filter(l => !l.late && !l.bad && !l.invalid && !l.removed).map(l => l.t); return g.length ? Math.min(...g) : null; };
    // correcting a lap (the Race Director): mark it invalid (or valid again), or take it out - of the records only (it stays in the stint) or of the stint too (one lap fewer)
    const fixLaps = (laps, n, op) => {
      if (!(n >= 0 && n < laps.length) || !op) return false;
      // (a lap that was driven after the time was up stays invalid)
      if (op.invalid !== undefined) { if (!!laps[n].invalid === !!op.invalid || (!op.invalid && laps[n].late)) return false; laps[n].invalid = !!op.invalid; return true; }
      if (op.remove === 'stint') { laps.splice(n, 1); return true; }
      if (op.remove === 'records') { if (laps[n].removed) return false; laps[n].removed = true; return true; }
      return false;
    };
    const copy = x => JSON.parse(JSON.stringify(x));
    const lane = n => lanes[n];

    const stateOf = (n, T) => (lane(n) && lane(n).stint ? stateAt(lane(n).stint.endT, T, warnMs) : 'idle');
    const left = (n, T) => (lane(n) && lane(n).stint ? Math.max(0, lane(n).stint.endT - T) : 0);

    // a finished stint goes to the list of stints to save
    function close(n, T, why) {
      const ln = lane(n), s = ln.stint; if (!s) return null;
      const rec = { id: s.id, lane: n, who: copy(s.who), startAt: s.startAt, bought: s.bought, carried: s.carried, left: Math.max(0, s.endT - T), closedBy: why, laps: copy(s.laps), best: bestOf(s) };
      closed.push(rec); ln.stint = null; return rec;
    }
    function begin(n, ms, T, at, carried) {
      const ln = lane(n);
      ln.stint = { id: ++seq, who: copy(ln.who || { driverId: '', driverName: 'Guest' }), startAt: at || '', endT: T + ms, bought: ms, carried: carried || 0, ops: [], laps: [] };
      if (!carried) ln.stint.ops.push({ k: 'add', ms });
      return ln.stint;
    }

    const api = {
      lanes: count, warnMs, warnColor: set.warnColor, outColor: set.outColor,
      stateOf, left,
      // the driver (and car) of a lane: { driverId, driverName, carId, carName }; used by the next stint, or change it with setWho
      whoOf: n => (lane(n) && lane(n).who ? copy(lane(n).who) : null),
      stintOf: n => (lane(n) && lane(n).stint ? copy(lane(n).stint) : null),
      assign(n, who) { if (lane(n)) lane(n).who = copy(who); },
      // buy time: adds to a lane that is running (the same stint goes on), starts a stint on a lane that is idle, and starts a new stint (from now) on a lane that is out.
      // Returns { ok, started, ended } - started: a new stint began (the car starts again), ended: the stint of the earlier driver was finished.
      add(n, ms, T, at) {
        ms = Number(ms); if (!lane(n) || !Number.isFinite(ms) || !(ms > 0)) return { ok: false };
        const ln = lane(n), st = stateOf(n, T);
        if (st === 'idle' || st === 'out') { const ended = st === 'out' ? close(n, T, 'expired') : null; begin(n, ms, T, at); return { ok: true, started: true, ended }; }
        ln.stint.endT += ms; ln.stint.bought += ms; ln.stint.ops.push({ k: 'add', ms });
        return { ok: true, started: false, ended: null };
      },
      // take back the last thing done to this lane's time: the last time added (not once the time is up) or "End time now"
      canUndo(n, T) { const s = lane(n) && lane(n).stint, op = s && s.ops[s.ops.length - 1]; return !!op && (op.k === 'end' || (op.k === 'sub' && op.zero) || stateOf(n, T) !== 'out'); },
      undo(n, T) {
        if (!api.canUndo(n, T)) return false;
        const s = lane(n).stint, op = s.ops.pop();
        if (op.k === 'end') { s.endT = op.was; return true; }
        if (op.k === 'sub') { s.endT = op.was; s.bought += op.ms; return true; }
        s.endT -= op.ms; s.bought -= op.ms;
        if (!s.ops.length && !s.carried) { // the time that started this stint is taken back: nothing is left of it
          if (!s.laps.length) lane(n).stint = null; else s.endT = Math.min(s.endT, T);
        }
        return true;
      },
      // take time off a lane that is on (a mistake, a refund). Never more than what is left: the lane is then out at once. Returns { ok, taken, out }.
      // The time bought goes down by what was taken, and Undo gives it back.
      reduce(n, ms, T) {
        ms = Number(ms); if (!lane(n) || !Number.isFinite(ms) || !(ms > 0)) return { ok: false };
        const st = stateOf(n, T); if (st === 'idle' || st === 'out') return { ok: false };
        const s = lane(n).stint, was = s.endT, taken = Math.min(ms, Math.max(0, s.endT - T)), zero = taken >= s.endT - T - 1e-6;
        s.endT -= taken; s.bought = Math.max(0, s.bought - taken); s.ops.push({ k: 'sub', ms: taken, was, zero });
        return { ok: true, taken, out: zero };
      },
      // the time is over now (the lane turns red)
      endNow(n, T) { const st = stateOf(n, T); if (st === 'idle' || st === 'out') return false; const s = lane(n).stint; s.ops.push({ k: 'end', was: s.endT }); s.endT = T; return true; },
      // finish the lane's stint: it becomes idle again (neutral)
      clear(n, T) { return !!close(n, T, 'cleared'); },
      // another driver on this lane. Time that is left goes with the lane to the new driver (a new stint); a lane that is out becomes idle.
      // Returns { changed, started, ended }.
      setWho(n, who, T, at) {
        const ln = lane(n); if (!ln) return { changed: false };
        const same = ln.who && who && ln.who.driverId === who.driverId && ln.who.driverName === who.driverName && (ln.who.carId || '') === (who.carId || '');
        ln.who = copy(who);
        if (!ln.stint || same) { if (ln.stint) ln.stint.who = copy(who); return { changed: !same, started: false, ended: null }; }
        const st = stateOf(n, T), remaining = left(n, T), ended = close(n, T, 'driver');
        if (st === 'running' || st === 'warning') { begin(n, remaining, T, at, remaining); return { changed: true, started: true, ended }; }
        return { changed: true, started: false, ended };
      },
      // a car crossed the line on this lane: null when the lane has no time (the crossing is ignored); otherwise { late } - late: after the time was up
      lap(n, ms, T, bad) {
        const s = lane(n) && lane(n).stint; if (!s) return null;
        const late = stateOf(n, T) === 'out';
        s.laps.push({ t: ms, late, bad: !!bad });
        return { late };
      },
      // corrections of laps: of the stint that is running on a lane, or of a stint that is finished and waits to be saved. n: the lap (from 0). Return true when something changed.
      fixLap(n, lapNo, op) { const s = lane(n) && lane(n).stint; return !!s && fixLaps(s.laps, lapNo, op); },
      fixClosed(id, lapNo, op) { const rec = closed.find(x => x.id === id); if (!rec || !fixLaps(rec.laps, lapNo, op)) return false; rec.best = bestOf(rec); return true; },
      closedList: () => copy(closed),
      closedMeta: () => closed.map(r => ({ id: r.id, lane: r.lane, closedBy: r.closedBy, driverName: r.who && r.who.driverName, driverId: r.who && r.who.driverId })), // (small: who closed how, for the spoken calls)
      discardClosed() { closed = []; },
      closeAll(T) { lanes.forEach((_, n) => close(n, T, 'session')); },
      hasPending: () => closed.length > 0,
      takeClosed() { const c = closed; closed = []; return c; },
      putBack(list) { closed = list.concat(closed); }, // saving did not work: they are offered again
      view: () => view(api.snapshot()),
      snapshot: () => ({ warnMs, warnColor: set.warnColor, outColor: set.outColor, ends: lanes.map(l => (l.stint ? l.stint.endT : null)), lastOp: lanes.map(l => { const op = l.stint && l.stint.ops.length ? l.stint.ops[l.stint.ops.length - 1] : null; return op ? (op.k === 'sub' && op.zero ? 'end' : op.k) : null; }),
        lates: lanes.map(l => (l.stint ? l.stint.laps.map((x, n) => (x.late ? n : -1)).filter(n => n >= 0) : [])) }), // (which laps of the running stints were driven after the time was up: they stay invalid)
      // for keeping across a restart: the time left instead of the clock time (the clock of the next session starts again at zero)
      serialise(T) {
        return { v: 1, seq, closed: copy(closed), lanes: lanes.map(l => ({ who: l.who ? copy(l.who) : null, stint: l.stint ? { ...copy(l.stint), endT: undefined, left: Math.max(0, l.stint.endT - T), ops: l.stint.ops.map(o => (o.was === undefined ? { ...o } : { ...o, was: undefined, wasLeft: o.was - T })) } : null })) }; // (what Undo goes back to is kept relative too: the clock of the next session starts again at zero)
      },
      restore(data, T) {
        if (!data || data.v !== 1 || !Array.isArray(data.lanes)) return false;
        seq = Math.max(seq, Number(data.seq) || 0); closed = Array.isArray(data.closed) ? copy(data.closed) : [];
        data.lanes.forEach((l, n) => {
          if (!lane(n)) return;
          lane(n).who = l && l.who ? copy(l.who) : null;
          if (l && l.stint) { const s = copy(l.stint); s.endT = T + (Number(s.left) || 0); delete s.left; s.laps = Array.isArray(s.laps) ? s.laps : []; s.ops = (Array.isArray(s.ops) ? s.ops : []).map(o => { if (o.wasLeft === undefined) return o; const x = { ...o, was: T + o.wasLeft }; delete x.wasLeft; return x; }); lane(n).stint = s; } else lane(n).stint = null;
        });
        return true;
      }
    };
    return api;
  }

  const api = { create, view, parseIncrements, parseDecrements, settingsOf, incLabel, decLabel, clockText, onColor, stateAt, DEFAULTS, MIN };
  root.Tokens = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
