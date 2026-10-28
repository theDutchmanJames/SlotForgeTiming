// Balance of Power (BoP): a car that is too fast is held back, a car that is too slow is helped, by changing its fuel rules in a race that has fuel:
// how much fuel a lap uses, how fast it refuels in the pits and (when that is switched on) how big its tank is.
// Pure: no screen, no clock. The engine (engine.js) applies the percentages; the settings page and the controls (bopui.js) show them.
//
// A percentage is a signed whole number: negative = the car is hindered, positive = the car is helped. 0 = nothing.
//   hindered by p %: fuel per lap x (1 + p), refuelling speed x (1 - p), tank x (1 - p)
//   helped by p %:   fuel per lap x (1 - p), refuelling speed x (1 + p), tank x (1 + p)
// (each of the three can be switched off in the settings; a car never gets more than 90 %).
(function (root) {
  const MAXP = 90;
  const MODES = [['manual', 'Manual: the Race Director decides'], ['suggest', 'Suggest: the app proposes, the Race Director accepts'], ['auto', 'Automatic: the app applies and removes it']];
  const WHO = [['both', 'Hinder the fastest car and help the slowest car'], ['hinder', 'Only hinder the fastest car'], ['help', 'Only help the slowest car']];
  const GRADE = [['extremes', 'Only the fastest and the slowest car'], ['graded', 'Every car, by how far it is from the middle of the field']];
  const SCALE = [['fixed', 'Always the percentage above'], ['scaled', 'Less when the difference is small: it grows with the difference, up to the percentage above']];
  const MEASURE = [['median', 'Median lap (one slow lap hardly counts)'], ['average', 'Average lap']];
  const DEFAULTS = { mode: 'manual', who: 'both', grade: 'extremes', percent: 20, scale: 'fixed', full: 1, measure: 'median', window: 5, minLaps: 3, apply: 0.3, remove: 0.15, lanes: true, use: true, rate: true, tank: false };

  const pick = (v, list, d) => (list.some(x => x[0] === v) ? v : d);
  const num = (v, d, lo, hi) => { const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v; return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const bool = (v, d) => (v === true || v === 'true' || v === 1 ? true : v === false || v === 'false' || v === 0 ? false : d);
  const blank = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');

  // A set of settings in the short form ({ mode, who, ... }, as the engine has them), cleaned: anything wrong becomes the standard, numbers are kept inside their limits.
  function clean(o) {
    o = o || {};
    const apply = num(o.apply, DEFAULTS.apply, 0.01, 600), window = Math.round(num(o.window, DEFAULTS.window, 3, 50));
    const remove = blank(o.remove) ? apply / 2 : Math.min(apply, num(o.remove, apply / 2, 0, 600));
    const c = { mode: pick(o.mode, MODES, DEFAULTS.mode), who: pick(o.who, WHO, DEFAULTS.who), grade: pick(o.grade, GRADE, DEFAULTS.grade), percent: Math.round(num(o.percent, DEFAULTS.percent, 1, MAXP)),
      scale: pick(o.scale, SCALE, DEFAULTS.scale), full: num(o.full, DEFAULTS.full, 0.1, 600), measure: pick(o.measure, MEASURE, DEFAULTS.measure), window, minLaps: Math.min(window, Math.round(num(o.minLaps, DEFAULTS.minLaps, 1, 50))),
      apply, remove, lanes: bool(o.lanes, DEFAULTS.lanes), use: bool(o.use, DEFAULTS.use), rate: bool(o.rate, DEFAULTS.rate), tank: bool(o.tank, DEFAULTS.tank) };
    if (Array.isArray(o.laneFactors)) c.laneFactors = o.laneFactors.map(f => (typeof f === 'number' && f > 0 && Number.isFinite(f) ? f : 1));
    return c;
  }
  // The settings page's values (the free-form settings of the app, bopMode, bopWho...) with their defaults
  function settingsOf(s) {
    s = s || {};
    return clean({ mode: s.bopMode, who: s.bopWho, grade: s.bopGrade, percent: s.bopPercent, scale: s.bopScale, full: s.bopFull, measure: s.bopMeasure, window: s.bopWindow, minLaps: s.bopMinLaps,
      apply: s.bopApply, remove: s.bopRemove, lanes: s.bopLanes, use: s.bopUse, rate: s.bopRate, tank: s.bopTank });
  }
  const KEYS = { mode: 'bopMode', who: 'bopWho', grade: 'bopGrade', percent: 'bopPercent', scale: 'bopScale', full: 'bopFull', measure: 'bopMeasure', window: 'bopWindow', minLaps: 'bopMinLaps', apply: 'bopApply', remove: 'bopRemove', lanes: 'bopLanes', use: 'bopUse', rate: 'bopRate', tank: 'bopTank' };
  const standardSettings = () => { const o = {}; Object.keys(KEYS).forEach(k => { o[KEYS[k]] = DEFAULTS[k]; }); return o; };

  // What the engine gets: the settings, with how long every lane is compared with the others when lane lengths are to be corrected for (lengths: metres per lane, lane 1 first)
  function engineConfig(settings, lengths) {
    const c = settingsOf(settings), L = Array.isArray(lengths) ? lengths.map(Number).filter(x => x > 0 && Number.isFinite(x)) : [];
    if (c.lanes && L.length === (lengths || []).length && L.length > 1) { const mean = L.reduce((a, b) => a + b, 0) / L.length; c.laneFactors = L.map(x => Math.round(x / mean * 1e6) / 1e6); }
    return c;
  }

  // how much of the fuel rules a car gets: multipliers for the fuel used per lap, the refuelling speed and the size of the tank
  function factors(pct, cfg) {
    const n = Number(pct) || 0, p = Math.min(MAXP, Math.abs(n)) / 100, c = cfg || {};
    if (!p) return { use: 1, rate: 1, tank: 1 };
    const hinder = n < 0, up = 1 + p, down = 1 - p;
    return { use: c.use === false ? 1 : hinder ? up : down, rate: c.rate === false ? 1 : hinder ? down : up, tank: c.tank === true ? (hinder ? down : up) : 1 };
  }

  // Several things can hinder or help a car at once (Balance of Power, the weather): mix([[percentage, { use, rate, tank }], ...]) adds up the percentages of the sources, lever by lever
  // (a source only counts for the levers that are switched on for it; the total of a lever is kept between -90 and 90), and gives the multipliers like factors().
  function mix(parts) {
    let u = 0, r = 0, t = 0;
    (parts || []).forEach(([pct, c]) => {
      const n = Math.max(-MAXP, Math.min(MAXP, Math.round(Number(pct) || 0)));
      if (!n || !c) return;
      if (c.use !== false) u += n;
      if (c.rate !== false) r += n;
      if (c.tank === true) t += n;
    });
    const cap = v => Math.max(-MAXP, Math.min(MAXP, v));
    return { use: 1 - cap(u) / 100, rate: 1 + cap(r) / 100, tank: 1 + cap(t) / 100 };
  }

  // The pace of a car: the median or the average of its last laps that count (not too slow, not invalid, not taken out, not a lap with a pit stop), in ms.
  // null while the car has fewer of them than the settings ask for. laneFactor: how long its lane is compared with the others (1 = the same): the pace is divided by it.
  function paceOf(car, cfg, laneFactor) {
    const laps = (car && car.laps) || [], bad = (car && car.bad) || [], inv = (car && car.invalid) || [], rem = (car && car.removed) || [], pit = (car && car.pitLaps) || [], ok = [];
    for (let k = 0; k < laps.length; k++) if (!bad[k] && !inv.includes(k) && !rem.includes(k) && !pit.includes(k) && Number.isFinite(laps[k])) ok.push(laps[k]);
    const last = ok.slice(-cfg.window);
    if (last.length < cfg.minLaps) return null;
    let v;
    if (cfg.measure === 'average') v = last.reduce((a, b) => a + b, 0) / last.length;
    else { const s = last.slice().sort((a, b) => a - b), m = s.length >> 1; v = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
    return v / (laneFactor > 0 ? laneFactor : 1);
  }

  // Who gets how much. paces: one number per car (ms), null for a car that takes no part (no pace yet, finished, out). wasActive: was BoP on at the last look
  // (it comes on at the "apply" difference and goes off at the lower "remove" difference, so it does not flicker on and off).
  // Gives { active, spread (s), percent (the strength now), pct: one signed percentage per car }.
  function plan(paces, cfg, wasActive) {
    const pct = paces.map(() => 0), idx = []; paces.forEach((p, i) => { if (typeof p === 'number' && Number.isFinite(p)) idx.push(i); });
    if (idx.length < 2) return { active: false, spread: 0, percent: 0, pct };
    const lo = Math.min(...idx.map(i => paces[i])), hi = Math.max(...idx.map(i => paces[i])), spread = (hi - lo) / 1000;
    if (!(spread > 0) || spread < (wasActive ? cfg.remove : cfg.apply)) return { active: false, spread, percent: 0, pct };
    const P = cfg.scale === 'scaled' ? cfg.percent * Math.min(1, spread / cfg.full) : cfg.percent, mid = (lo + hi) / 2, half = (hi - lo) / 2;
    idx.forEach(i => {
      const w = cfg.grade === 'graded' ? (paces[i] - mid) / half : paces[i] === hi ? 1 : paces[i] === lo ? -1 : 0; // positive: slower than the middle (helped), negative: faster (hindered)
      if ((cfg.who === 'hinder' && w > 0) || (cfg.who === 'help' && w < 0)) return;
      const v = Math.round(P * w); pct[i] = v === 0 ? 0 : v;
    });
    return { active: true, spread, percent: Math.round(P), pct };
  }

  // ---- words ----
  const MINUS = '−';
  const signed = pct => { const n = Number(pct) || 0; return n === 0 ? '0%' : (n < 0 ? MINUS : '+') + Math.abs(n) + '%'; }; // −20%, +10%
  const kindOf = pct => { const n = Number(pct) || 0; return n < 0 ? 'hindered' : n > 0 ? 'helped' : 'off'; };
  const shortText = pct => { const n = Number(pct) || 0; return n === 0 ? 'BoP off' : `BoP ${n < 0 ? '▼' : '▲'} ${signed(n)}`; };

  // in words, what a percentage does to a car, given which effects are switched on: "uses 20% more fuel per lap, refuels 20% slower and has a 20% smaller tank" (nothing: '')
  const list = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
  function effectText(pct, cfg) {
    const n = Number(pct) || 0; if (!n) return '';
    const f = factors(n, cfg), p = Math.min(MAXP, Math.abs(n)), parts = [];
    if (f.use !== 1) parts.push(`uses ${p}% ${n < 0 ? 'more' : 'less'} fuel per lap`);
    if (f.rate !== 1) parts.push(`refuels ${p}% ${n < 0 ? 'slower' : 'faster'}`);
    if (f.tank !== 1) parts.push(`has a ${p}% ${n < 0 ? 'smaller' : 'bigger'} tank`);
    return list(parts);
  }

  // What the controls of the lanes show (race screen and Race Director page), from an engine (or the engine of a viewer) and the phase of the race screen.
  // { on (this race has Balance of Power), mode, info, rows: [{ lane, show, who, now, kind, held, to, hinder, help, off, auto, accept }] }, each button { text, disabled, on }
  const OPEN = ['ready', 'countdown', 'running', 'paused', 'between'];
  function view(eng, lanes, phase) {
    const cfg = eng && eng.bop;
    if (!cfg) return { on: false, mode: '', info: '', rows: [] };
    const open = OPEN.includes(phase) && eng.status !== 'finished', sec = x => (Math.round(x * 100) / 100).toFixed(2) + ' s';
    const info = cfg.mode === 'manual' ? 'Manual: press Hinder or Help for a lane.'
      : (cfg.mode === 'auto' ? 'Automatic' : 'Suggest') + ': ' + (eng.bopActive ? `the fastest and slowest car are ${sec(eng.bopSpread)} apart, so it applies (from ${sec(cfg.apply)}).`
        : eng.bopSpread > 0 ? `the fastest and slowest car are ${sec(eng.bopSpread)} apart, below ${sec(cfg.apply)}: nothing applies.` : 'waiting for laps from at least two cars.');
    const rows = (lanes || []).map(lane => {
      const c = (eng.cars || []).find(x => x.lane === lane), btn = (text, dis, on) => ({ text, disabled: !!dis, on: !!on });
      if (!c) return { lane, show: false };
      const bop = c.bop || 0, out = !open || c.done || c.retired || c.dq, to = cfg.mode === 'manual' || typeof c.bopTo !== 'number' || c.bopTo === bop ? '' : (c.bopTo === 0 ? 'off' : signed(c.bopTo));
      return { lane, show: true, who: c.driverName || 'Guest', now: shortText(bop), kind: kindOf(bop), held: cfg.mode === 'auto' && !!c.bopHold, to,
        hinder: btn(`Hinder ${cfg.percent}%`, out, bop < 0), help: btn(`Help ${cfg.percent}%`, out, bop > 0), off: btn('Off', out, bop === 0 && !!c.bopHold),
        auto: { ...btn('Auto', out || !c.bopHold, false), show: cfg.mode === 'auto' }, accept: { ...btn('Accept', out || !to, false), show: cfg.mode === 'suggest' } };
    });
    return { on: true, mode: cfg.mode, info, rows };
  }

  // The periods in which a car had BoP, from the race log: events { type: bopon|bopoff|bopchange, car, pct, lap (laps it had finished at that moment) }.
  // Gives [{ pct, from (the first lap it applied to), to (the last lap it applied to, or null while it still applies) }].
  function periodsOf(events, car) {
    const out = []; let cur = null;
    (events || []).forEach(e => {
      if (!e || e.car !== car || !['bopon', 'bopoff', 'bopchange'].includes(e.type)) return;
      const lap = Number(e.lap) || 0;
      if (cur) { cur.to = lap; out.push(cur); cur = null; }
      if (e.type !== 'bopoff' && Number(e.pct)) cur = { pct: Number(e.pct), from: lap + 1, to: null };
    });
    if (cur) out.push(cur);
    return out.filter(p => p.to === null || p.to >= p.from);
  }
  // "hindered 20% (from the start to lap 12), helped 10% (from lap 14)", "hindered 20% (laps 5 to 12)", "helped 10% (lap 7)"
  const when = p => (p.to === null ? (p.from === 1 ? 'from the start' : 'from lap ' + p.from) : p.from === p.to ? 'lap ' + p.from : p.from === 1 ? 'from the start to lap ' + p.to : 'laps ' + p.from + ' to ' + p.to);
  function noteOf(periods) {
    return (periods || []).map(p => `${kindOf(p.pct)} ${Math.abs(p.pct)}% (${when(p)})`).join(', ');
  }

  const api = { MAXP, MODES, WHO, GRADE, SCALE, MEASURE, DEFAULTS, KEYS, clean, settingsOf, standardSettings, engineConfig, factors, mix, paceOf, plan, signed, kindOf, shortText, effectText, view, periodsOf, noteOf };
  root.Bop = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
