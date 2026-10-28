// Push and Save System (1.54.0): how hard a driver drives changes how fast his tyres and his fuel are used up.
// Every lap is compared with a reference: the selected Fuel System's Track or Manual
// reference when there is one, otherwise the driver's best lap on the track (or, without
// one, his best lap so far in the race).
// Driving at the reference is flat out (it wears the most). A normal race lap is a bit slower (normal pace, the best lap plus 3% to begin with): the wear is the usual wear there.
// Slower than that saves: the wear goes down until the most saving pace (the best lap plus 8% to begin with), and stays there for slower laps.
// The wear of a lap is the usual wear of the Tyre Wear System (and the usual litres of the Fuel System) times a number between 1 + extra and 1 - saving. Lap times and grip are never touched.
// This file holds the rules and the words and nothing else (no screen, no clock), so they can be tested on their own; engine.js uses it.
(function (root) {
  const num = (v, d, lo, hi) => { const n = Number(String(v ?? '').replace(',', '.')); return v === '' || v === null || v === undefined || !Number.isFinite(n) ? d : Math.min(hi, Math.max(lo, n)); };
  const r2 = n => Math.round(n * 100) / 100;
  const isPace = p => typeof p === 'number' && p >= 0; // (null and undefined are no pace: null >= 0 is true in JavaScript)
  const BAND = 1; // normal pace is the pace of the setting plus or minus this many percent (PUSH is faster than that, SAVE slower)
  // what a new system starts with (the numbers of the Standard preset)
  // New systems use each driver's selected rolling pace benchmark. Records made before this change
  // have no mode and deliberately retain their original best-lap/reference rules.
  const DEFAULTS = { mode: 'median', normal: 3, pushAt: 3, saveAt: 8, from: 3, slow: 150, yellowSave: 'on', tyres: 'on', tyreExtra: 40, tyreSave: 30, fuel: 'on', fuelExtra: 25, fuelSave: 20 };
  // the ready-made systems of the form: only the four wear numbers change
  const PRESETS = {
    standard: { name: 'Standard', note: 'In between: flat out wears 40% more tyres and 25% more fuel, the most saving wears 30% and 20% less', values: { tyreExtra: 40, tyreSave: 30, fuelExtra: 25, fuelSave: 20 } },
    gentle: { name: 'Gentle', note: 'Changes the wear a little', values: { tyreExtra: 20, tyreSave: 15, fuelExtra: 12, fuelSave: 10 } },
    strong: { name: 'Strong', note: 'Pushing is expensive and saving is worth it', values: { tyreExtra: 80, tyreSave: 50, fuelExtra: 50, fuelSave: 35 } }
  };
  const PRESET_KEYS = ['standard', 'gentle', 'strong'];
  const defaults = () => ({ ...DEFAULTS });
  // App Settings > Calculations chooses the pace reference of new-model systems.
  // "last" is the previous valid lap: a lap cannot use itself as its own reference.
  const BENCHMARKS = [
    ['median', 'Median of recent valid laps', 'The middle pace. One unusually quick or slow lap cannot pull it far.'],
    ['average', 'Average of recent valid laps', 'Every valid lap has equal influence.'],
    ['last', 'Previous valid lap', 'Each lap responds to the driver’s most recent clean pace.'],
    ['best', 'Best valid lap in this race', 'The quickest clean lap sets a demanding reference.'],
    ['track', 'Track target lap time', 'Uses the active track’s saved target time.']
  ];
  const benchmarkOf = v => BENCHMARKS.some(x => x[0] === v) ? v : 'median';
  const benchmarkInfo = v => BENCHMARKS.find(x => x[0] === benchmarkOf(v));
  const average = xs => xs.length ? xs.reduce((sum, n) => sum + n, 0) / xs.length : 0;
  // A zero window means all eligible history; zero minimum keeps method defaults.
  const pacePolicy = (value = {}) => {
    value = value || {};
    const window = Math.round(num(value.window, 0, 0, 1000));
    const minimum = Math.round(num(value.minimum, 0, 0, 1000));
    return { window, minimum: window ? Math.min(window, minimum) : minimum };
  };
  const policyFromSettings = (s = {}, prefix = 'pushSave') => ({
    benchmark: benchmarkOf(s[prefix + 'Benchmark']),
    pacePolicy: pacePolicy({ window: s[prefix + 'Window'], minimum: s[prefix + 'Minimum'] })
  });
  const benchmark = (kind, laps, trackTarget, policy) => {
    const rules = pacePolicy(policy), k = benchmarkOf(kind);
    let list = Array.isArray(laps) ? laps.filter(n => Number.isFinite(n) && n > 0) : [];
    if (rules.window) list = list.slice(-rules.window);
    if (k === 'track') return Number.isFinite(Number(trackTarget)) && Number(trackTarget) > 0 ? Number(trackTarget) : 0;
    const minimum = rules.minimum || (k === 'last' || k === 'best' ? 1 : 3);
    if (list.length < minimum) return 0;
    if (k === 'last') return list.length ? list[list.length - 1] : 0;
    if (k === 'best') return list.length ? Math.min(...list) : 0;
    if (k === 'average') return average(list);
    const sorted = list.slice().sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  };

  // The settings the engine uses, from a record of the database (null: there is no system). Percentages stay percentages (3 is 3%).
  function clean(rec) {
    if (!rec || typeof rec !== 'object') return null;
    const mode = rec.mode === 'median' ? 'median' : 'legacy';
    const normal = r2(num(rec.normal, DEFAULTS.normal, 0, 50));
    const pushAt = r2(num(rec.pushAt, DEFAULTS.pushAt, 0.1, 50));
    let saveAt = r2(num(rec.saveAt, DEFAULTS.saveAt, 0, 100)); if (mode === 'legacy' && saveAt <= normal) saveAt = r2(normal + 1); else if (mode === 'median') saveAt = Math.max(0.1, saveAt); // (the saving needs some room to grow in)
    const side = (on, extra, save, d) => ({ on: rec[on] !== 'off', extra: r2(num(rec[extra], d[0], 0, 500)), save: r2(num(rec[save], d[1], 0, 90)) });
    return { mode, ...(rec.pacePolicy ? { pacePolicy: pacePolicy(rec.pacePolicy) } : {}), benchmark: benchmarkOf(rec.benchmark), trackTarget: Math.max(0, num(rec.trackTarget, 0, 0, 3600) * 1000), normal, pushAt, saveAt, from: Math.round(num(rec.from, DEFAULTS.from, 1, 100)), slow: r2(num(rec.slow, DEFAULTS.slow, 101, 1000)), yellowSave: rec.yellowSave !== 'off',
      tyres: side('tyres', 'tyreExtra', 'tyreSave', [DEFAULTS.tyreExtra, DEFAULTS.tyreSave]), fuel: side('fuel', 'fuelExtra', 'fuelSave', [DEFAULTS.fuelExtra, DEFAULTS.fuelSave]) };
  }
  // The settings of an engine from a config that was cleaned before (clean(), possibly sent to another window): the same numbers, made safe again. null: no system.
  function fromConfig(x) {
    if (!x || typeof x !== 'object') return null;
    const mode = x.mode === 'median' ? 'median' : 'legacy';
    const normal = r2(num(x.normal, DEFAULTS.normal, 0, 50));
    const pushAt = r2(num(x.pushAt, DEFAULTS.pushAt, 0.1, 50));
    let saveAt = r2(num(x.saveAt, DEFAULTS.saveAt, 0, 100)); if (mode === 'legacy' && saveAt <= normal) saveAt = r2(normal + 1); else if (mode === 'median') saveAt = Math.max(0.1, saveAt);
    const side = (s, d) => ({ on: !s || s.on !== false, extra: r2(num(s && s.extra, d[0], 0, 500)), save: r2(num(s && s.save, d[1], 0, 90)) });
    return { mode, ...(x.pacePolicy ? { pacePolicy: pacePolicy(x.pacePolicy) } : {}), benchmark: benchmarkOf(x.benchmark), trackTarget: Math.max(0, num(x.trackTarget, 0, 0, 3600000)), normal, pushAt, saveAt, from: Math.round(num(x.from, DEFAULTS.from, 1, 100)), slow: r2(num(x.slow, DEFAULTS.slow, 101, 1000)), yellowSave: x.yellowSave !== false,
      tyres: side(x.tyres, [DEFAULTS.tyreExtra, DEFAULTS.tyreSave]), fuel: side(x.fuel, [DEFAULTS.fuelExtra, DEFAULTS.fuelSave]) };
  }

  // The ready-made system whose four wear numbers a system has ('' = its own numbers), from a record or the values of the form (1.76.0: the form marks the button of that system). An empty or unreadable
  // box counts as the number a new system starts with, as the race does, so a system with empty boxes is the Standard one.
  function presetOf(rec) {
    const c = clean(rec && typeof rec === 'object' ? rec : {});
    return PRESET_KEYS.find(k => { const p = PRESETS[k].values; return c.tyres.extra === p.tyreExtra && c.tyres.save === p.tyreSave && c.fuel.extra === p.fuelExtra && c.fuel.save === p.fuelSave; }) || '';
  }

  // how many percent a lap is slower than the reference lap (0 for a lap that is as fast or faster; null when there is nothing to compare)
  const paceOf = (lapMs, refMs) => (lapMs > 0 && refMs > 0 ? Math.max(0, Math.round((lapMs / refMs - 1) * 100 * 1000) / 1000) : null);
  // the number the wear is multiplied by at a pace p (percent over the reference), for 'tyres' or 'fuel': 1 + extra at p = 0 (flat out), 1 at normal pace, 1 - saving from the most saving pace on
  function mult(cfg, what, p) {
    const s = cfg && cfg[what]; if (!s || !s.on || !isPace(p)) return 1;
    const m = p <= cfg.normal ? 1 + (s.extra / 100) * (cfg.normal > 0 ? (cfg.normal - p) / cfg.normal : 1) : 1 - (s.save / 100) * Math.min(1, (p - cfg.normal) / (cfg.saveAt - cfg.normal));
    return Math.round(m * 10000) / 10000;
  }
  // Benchmark model: zero is the selected driver pace reference. Negative is
  // faster (push), positive slower (save); both ends ease linearly to the maximum.
  function medianMult(cfg, what, p) {
    const s = cfg && cfg[what]; if (!s || !s.on || !Number.isFinite(p)) return 1;
    const m = p < 0 ? 1 + (s.extra / 100) * Math.min(1, -p / cfg.pushAt) : 1 - (s.save / 100) * Math.min(1, p / cfg.saveAt);
    return Math.round(m * 10000) / 10000;
  }
  // PUSH (faster than normal pace), NORMAL, SAVE (slower)
  function kind(cfg, p) {
    if (!cfg || !isPace(p)) return 'normal';
    const band = Math.min(BAND, cfg.normal / 2);
    return p < cfg.normal - band ? 'push' : p > cfg.normal + band ? 'save' : 'normal';
  }
  const medianKind = p => !Number.isFinite(p) || Math.abs(p) < 0.001 ? 'normal' : p < 0 ? 'push' : 'save';
  // What a lap does to the wear. o: { lapMs, ref (ms, 0 = none), lapNo (1 is the first lap), pit (a lap with a stop), resumed (the first lap after a pause), yellow (a full lap under the yellow flag or the Safety Car) }
  // -> { p, kind, tyres, fuel, why }: why is '' when the pace counts, else 'off', 'pit', 'resumed', 'noref', 'early' or 'slow' (the lap wears as usual).
  function lapEffect(cfg, o) {
    const usual = why => ({ p: null, kind: 'normal', tyres: 1, fuel: 1, why });
    if (!cfg) return usual('off');
    if (o.pit) return usual('pit');
    if (o.resumed) return usual('resumed');
    if (cfg.mode === 'median' && o.red) return usual('red');
    if (cfg.mode === 'median' && o.yellow) return usual('yellow');
    if (!(o.ref > 0) || !(o.lapMs > 0)) return usual(cfg.mode === 'median' && ['median', 'average'].includes(benchmarkOf(cfg.benchmark)) ? 'median' : 'noref');
    if (!(o.lapNo >= cfg.from)) return usual('early');
    if (cfg.mode === 'median') {
      const p = Math.round((o.lapMs / o.ref - 1) * 100 * 1000) / 1000;
      if (!(o.yellow && cfg.yellowSave) && o.lapMs > o.ref * cfg.slow / 100) return { ...usual('slow'), p };
      return { p, kind: medianKind(p), tyres: medianMult(cfg, 'tyres', p), fuel: medianMult(cfg, 'fuel', p), why: '' };
    }
    const p = paceOf(o.lapMs, o.ref);
    if (!(o.yellow && cfg.yellowSave) && o.lapMs > o.ref * cfg.slow / 100) return { ...usual('slow'), p };
    return { p, kind: kind(cfg, p), tyres: mult(cfg, 'tyres', p), fuel: mult(cfg, 'fuel', p), why: '' };
  }

  // ---- the words ----
  const KIND_TEXT = { push: 'PUSH', normal: 'NORMAL', save: 'SAVE' };
  const kindText = k => KIND_TEXT[k] || 'NORMAL';
  const pctText = p => (p === null || p === undefined || !Number.isFinite(p) ? '' : `${p >= 0 ? '+' : ''}${(Math.round(p * 10) / 10).toFixed(1)}%`);
  const multText = m => `×${(Math.round((Number(m) || 0) * 100) / 100).toFixed(2)}`;
  const rangeText = (cfg, what) => { const s = cfg && cfg[what]; return s && s.on ? `${multText(1 + s.extra / 100)} to ${multText(1 - s.save / 100)}` : 'unchanged'; };
  const pctShort = n => String(Math.round(n * 100) / 100);
  // the rules in one line (the Rules of this race card, the race log): "Push and Save: normal pace is the best lap +3%; tyres ×1.40 to ×0.70, fuel ×1.25 to ×0.80"
  function rulesText(cfg) {
    if (!cfg) return '';
    const parts = [];
    if (cfg.tyres.on) parts.push(`tyres ${rangeText(cfg, 'tyres')}`);
    if (cfg.fuel.on) parts.push(`fuel ${rangeText(cfg, 'fuel')}`);
    const pace = cfg.mode === 'median' ? `the selected driver pace benchmark is normal use (full push ${pctShort(cfg.pushAt)}% faster, full save ${pctShort(cfg.saveAt)}% slower)` : `normal pace is the best lap +${pctShort(cfg.normal)}%`;
    return pace + (parts.length ? '; ' + parts.join(', ') : '; no wear is changed');
  }
  // why a lap wears as usual (the lap review and the folder)
  const WHY_TEXT = { pit: 'a lap with a stop', resumed: 'the first lap after a pause', red: 'a red-flag interrupted lap', yellow: 'a yellow-flag lap', noref: 'no reference lap yet', median: 'more eligible laps are needed for the selected pace benchmark', early: 'the effect has not started yet', slow: 'a very slow lap' };
  const whyText = w => WHY_TEXT[w] || '';
  const sourceText = s => (s === 'record' ? 'record' : s === 'race' ? 'this race' : s === 'track' ? 'track target' : s === 'manual' ? 'manual target' : s === 'median' ? 'median' : s === 'average' ? 'average' : s === 'last' ? 'previous lap' : s === 'best' ? 'best race lap' : '');

  const api = { DEFAULTS, PRESETS, PRESET_KEYS, BENCHMARKS, BAND, defaults, pacePolicy, policyFromSettings, benchmarkOf, benchmarkInfo, benchmark, clean, fromConfig, presetOf, paceOf, mult, medianMult, kind, medianKind, lapEffect, kindText, pctText, multText, rangeText, rulesText, whyText, sourceText };
  root.PushSave = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
