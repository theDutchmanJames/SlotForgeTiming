// Weather: a race can have a spell of rain, and a car has to be on the right tyres for it.
// The track goes through four weather states: Dry, Cloudy (the warning before the rain), Wet and Clearing (the rain has stopped, the track is drying), then Dry again.
// A car is on its own tyres (the compound of its Slotcar) or on Wet or Intermediate tyres; it changes them in a pit stop, to what the weather is then.
// The wrong tyres can cost penalty points and slow a car down (more fuel per lap, slower refuelling, a smaller tank: the levers Balance of Power uses).
// Pure: no screen, no clock. The engine (engine.js) runs it; the settings page (the forms), the controls (weatherui.js) and the widgets show it.
(function (root) {
  const STATES = [['dry', 'Dry'], ['cloudy', 'Cloudy'], ['wet', 'Wet'], ['clearing', 'Clearing']];
  const STATE_KEYS = STATES.map(x => x[0]);
  // The tyres, with the colours of Formula 1: hard white, medium yellow, soft red, intermediate green, wet blue (a Supersoft, which F1 no longer has, is purple like the old Ultrasoft).
  // cls: dry (a compound for a dry track), inter, wet
  const TYRES = [
    { code: 'H', name: 'Hard', cls: 'dry', color: '#f4f4f4' },
    { code: 'M', name: 'Medium', cls: 'dry', color: '#ffd12e' },
    { code: 'S', name: 'Soft', cls: 'dry', color: '#e8002d' },
    { code: 'SS', name: 'Supersoft', cls: 'dry', color: '#9b4dff' },
    { code: 'INT', name: 'Intermediate', cls: 'inter', color: '#43b02a' },
    { code: 'W', name: 'Wet', cls: 'wet', color: '#0067ff' }
  ];
  const CLASSES = ['dry', 'inter', 'wet'];
  const DEFAULT_TYRE = 'M';
  const MAXP = 90; // the most a car can be hindered (the same limit as Balance of Power)

  const tyreOf = code => TYRES.find(t => t.code === String(code || '').toUpperCase()) || null;
  const cleanTyre = code => { const t = tyreOf(code); return t ? t.code : DEFAULT_TYRE; }; // (a Slotcar without a tyre choice, or an old one, has a Medium)
  const classOf = code => (tyreOf(code) || tyreOf(DEFAULT_TYRE)).cls;
  const tyreName = code => (tyreOf(code) || tyreOf(DEFAULT_TYRE)).name;
  const stateName = s => (STATES.find(x => x[0] === s) || STATES[0])[1];

  // ---- the settings of a weather system (a record of the Weather Systems page) ----
  // The hindrance table: how many percent a car on a kind of tyre is hindered in a weather state (0 = not at all). Keys: dryOnDry, dryOnInter, dryOnWet, cloudyOnDry...
  const HKEYS = {}; STATE_KEYS.forEach(s => CLASSES.forEach(c => { HKEYS[s + '/' + c] = s + 'On' + c[0].toUpperCase() + c.slice(1); }));
  const TABLE = { dry: { dry: 0, inter: 10, wet: 20 }, cloudy: { dry: 0, inter: 5, wet: 10 }, wet: { dry: 25, inter: 10, wet: 0 }, clearing: { dry: 10, inter: 0, wet: 10 } };
  const DEFAULTS = { unit: 'laps', startMode: 'point', startAt: 8, startFrom: 5, startTo: 12, rainMode: 'fixed', rainFor: 6, rainMin: 4, rainMax: 10, cloudyFor: 2, clearingFor: 2, sameInHeats: 'same',
    cloudyTyre: 'wet', clearingTyre: 'dry', react: 2, wetPoints: 2, dryPoints: 2, repeat: 'once', hinder: 'on', hUse: 'on', hRate: 'on', hTank: 'off' };
  STATE_KEYS.forEach(s => CLASSES.forEach(c => { DEFAULTS[HKEYS[s + '/' + c]] = TABLE[s][c]; }));

  // The conditions on the track: every weather state has its own track temperature, air temperature, wind speed and wind direction (the Track Conditions widget shows them, the audio says them).
  // The numbers are in the units of the weather system: metric (degrees Celsius, kilometres per hour) or imperial (degrees Fahrenheit, miles per hour). The direction is where the wind comes FROM, in degrees: 0 north, 90 east, 180 south, 270 west.
  const COND_ITEMS = [['track', 'trackTemp', 'Track temperature'], ['air', 'airTemp', 'Air temperature'], ['wind', 'windSpeed', 'Wind speed'], ['dir', 'windDir', 'Wind direction']];
  const CKEYS = {}; STATE_KEYS.forEach(s => COND_ITEMS.forEach(([item, base]) => { CKEYS[s + '/' + item] = base + s[0].toUpperCase() + s.slice(1); })); // trackTempDry, airTempCloudy, windSpeedWet, windDirClearing...
  const COND = { dry: { track: 30, air: 24, wind: 10, dir: 225 }, cloudy: { track: 25, air: 20, wind: 16, dir: 250 }, wet: { track: 17, air: 15, wind: 22, dir: 270 }, clearing: { track: 21, air: 17, wind: 14, dir: 295 } }; // (metric)
  STATE_KEYS.forEach(s => COND_ITEMS.forEach(([item]) => { DEFAULTS[CKEYS[s + '/' + item]] = COND[s][item]; }));
  DEFAULTS.units = 'metric';

  const num = (v, d, lo, hi) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v;
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const pick = (v, list, d) => (list.includes(v) ? v : d);

  // the conditions of a record: { units, dry: { track, air, wind, dir }, cloudy: ... } in the units of the record (a temperature from -60 to 150, a speed from 0 to 400, a direction 0 to 359 degrees; whole numbers)
  function cleanCond(r) {
    const units = r.units === 'imperial' ? 'imperial' : 'metric', out = { units };
    STATE_KEYS.forEach(s => {
      const g = item => num(r[CKEYS[s + '/' + item]], DEFAULTS[CKEYS[s + '/' + item]], item === 'wind' ? 0 : item === 'dir' ? -1e6 : -60, item === 'wind' ? 400 : item === 'dir' ? 1e6 : 150);
      const dir = Math.round(g('dir')); out[s] = { track: Math.round(g('track')), air: Math.round(g('air')), wind: Math.round(g('wind')), dir: ((dir % 360) + 360) % 360 };
    });
    return out;
  }
  // The settings of the record, cleaned into what the engine gets. seed: a whole number for the random choices (the same seed gives the same weather).
  // In laps all the numbers are whole laps (of the leader); in time they are minutes.
  function clean(rec, seed) {
    const r = rec || {}, unit = r.unit === 'time' ? 'time' : 'laps', laps = unit === 'laps';
    const q = (v, d, lo) => (laps ? Math.round(num(v, d, lo, 999)) : Math.round(num(v, d, lo, 1000) * 60) / 60); // (minutes: to a whole second)
    const lo = laps ? 1 : 0.1, point = laps ? 0 : 0;
    const table = {}; STATE_KEYS.forEach(s => { table[s] = {}; CLASSES.forEach(c => { table[s][c] = Math.round(num(r[HKEYS[s + '/' + c]], DEFAULTS[HKEYS[s + '/' + c]], 0, MAXP)); }); });
    const from = q(r.startFrom, DEFAULTS.startFrom, point), to = q(r.startTo, DEFAULTS.startTo, point), rmin = q(r.rainMin, DEFAULTS.rainMin, lo), rmax = q(r.rainMax, DEFAULTS.rainMax, lo);
    return {
      unit,
      start: { mode: pick(r.startMode, ['point', 'random', 'director'], DEFAULTS.startMode), at: q(r.startAt, DEFAULTS.startAt, point), from: Math.min(from, to), to: Math.max(from, to) },
      rain: { mode: pick(r.rainMode, ['fixed', 'random'], DEFAULTS.rainMode), for: q(r.rainFor, DEFAULTS.rainFor, lo), min: Math.min(rmin, rmax), max: Math.max(rmin, rmax) },
      cloudy: q(r.cloudyFor, DEFAULTS.cloudyFor, point), clearing: q(r.clearingFor, DEFAULTS.clearingFor, point),
      same: r.sameInHeats !== 'new',
      cloudyTyre: pick(r.cloudyTyre, ['wet', 'inter'], DEFAULTS.cloudyTyre), clearingTyre: pick(r.clearingTyre, ['dry', 'inter'], DEFAULTS.clearingTyre),
      react: Math.round(num(r.react, DEFAULTS.react, 0, 20)), wetPoints: Math.round(num(r.wetPoints, DEFAULTS.wetPoints, 0, 100)), dryPoints: Math.round(num(r.dryPoints, DEFAULTS.dryPoints, 0, 100)),
      repeat: pick(r.repeat, ['once', 'every'], DEFAULTS.repeat),
      hinder: r.hinder !== 'off', levers: { use: r.hUse !== 'off', rate: r.hRate !== 'off', tank: r.hTank === 'on' }, table,
      cond: cleanCond(r),
      seed: Math.floor(Number(seed)) || 0
    };
  }

  // ---- the forecast: when each state starts ----
  // A small random number generator (the same seed gives the same numbers on every device)
  function rng(seed) {
    let a = (Math.floor(Number(seed)) || 0) >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // cfg: from clean(). Gives { unit, director, stages: [{ state, at }] }: at is a lap count of the leader (laps) or milliseconds from the start (time); a state begins when the leader has completed that many laps / that much time has gone.
  // A state with no length is left out (no Cloudy when the warning is 0, no Clearing when it is 0).
  function plan(cfg, seed) {
    if (!cfg) return null;
    const laps = cfg.unit === 'laps', rnd = rng(seed === undefined ? cfg.seed : seed), to = v => (laps ? Math.round(v) : Math.round(v * 60) * 1000);
    if (cfg.start.mode === 'director') return { unit: cfg.unit, director: true, stages: [] };
    const between = (a, b) => (laps ? a + Math.floor(rnd() * (b - a + 1)) : Math.round((a + rnd() * (b - a)) * 60) / 60);
    const wet = to(cfg.start.mode === 'random' ? between(cfg.start.from, cfg.start.to) : cfg.start.at);
    const len = Math.max(laps ? 1 : 1000, to(cfg.rain.mode === 'random' ? between(cfg.rain.min, cfg.rain.max) : cfg.rain.for));
    const warn = to(cfg.cloudy), clear = to(cfg.clearing), cloudyAt = Math.max(0, wet - warn), stages = [];
    if (wet - cloudyAt > 0) stages.push({ state: 'cloudy', at: cloudyAt });
    stages.push({ state: 'wet', at: wet });
    if (clear > 0) stages.push({ state: 'clearing', at: wet + len });
    stages.push({ state: 'dry', at: wet + len + clear });
    return { unit: cfg.unit, director: false, stages };
  }
  // the progress of a race for a plan: the laps of the leader, or the milliseconds since the start
  const progress = (unit, laps, ms) => (unit === 'laps' ? laps : ms);
  // what is left until the next state: { state, left } (left in laps or ms), null when there is none (or the Race Director decides)
  function nextStage(p, stage, laps, ms) {
    if (!p || p.director || !p.stages || stage >= p.stages.length) return null;
    const s = p.stages[stage]; return { state: s.state, left: Math.max(0, s.at - progress(p.unit, laps, ms)) };
  }
  // the time to the start of a state, in words (3 laps, 1 lap, 2 minutes 10 seconds, 30 seconds); '' when it is not known
  function span(unit, left) {
    if (!Number.isFinite(left)) return '';
    if (unit === 'laps') { const n = Math.round(left); return `${n} lap${n === 1 ? '' : 's'}`; }
    const t = Math.round(left / 1000), m = Math.floor(t / 60), s = t % 60;
    return [m ? `${m} minute${m === 1 ? '' : 's'}` : '', s || !m ? `${s} second${s === 1 ? '' : 's'}` : ''].filter(Boolean).join(' ');
  }
  // when a given state starts, from the stages of a plan (null when it does not)
  const stageOf = (p, state) => ((p && p.stages) || []).find(s => s.state === state) || null;

  // ---- tyres ----
  // The tyre a car gets in a pit stop in a weather state: Wet in Cloudy (or Intermediate, when the system says so) and in Wet; its own tyre in Dry and in Clearing (or Intermediate in Clearing)
  function tyreFor(cfg, state, own) {
    if (!cfg) return cleanTyre(own);
    if (state === 'wet') return 'W';
    if (state === 'cloudy') return cfg.cloudyTyre === 'inter' ? 'INT' : 'W';
    if (state === 'clearing') return cfg.clearingTyre === 'inter' ? 'INT' : cleanTyre(own);
    return cleanTyre(own);
  }
  // Does a car have to change tyres? 'wet': it is raining and the car is on a dry compound. 'dry': the track is dry again and the car is not on its own tyres. '': it is fine.
  function need(state, tyre, own) {
    if (state === 'wet' && classOf(tyre) === 'dry') return 'wet';
    if (state === 'dry' && cleanTyre(tyre) !== cleanTyre(own)) return 'dry';
    return '';
  }
  // How many percent a car is hindered, by the weather and its tyres (0 to 90; 0 when the system does not hinder)
  const hinderOf = (cfg, state, tyre) => (cfg && cfg.hinder && cfg.table[state] ? Math.min(MAXP, Math.max(0, Number(cfg.table[state][classOf(tyre)]) || 0)) : 0);

  // ---- the words ----
  const when = (e, unit) => {
    if (unit === 'time') { const s = Math.floor((Number(e.at) || 0) / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
    return `lap ${(Number(e.lap) || 0) + 1}`;
  };
  // What the weather did in a race, from the race log: "Cloudy from lap 8, rain from lap 10, clearing from lap 16, dry from lap 18"
  function forecastNote(events, unit) {
    const word = { cloudy: 'cloudy', wet: 'rain', clearing: 'clearing', dry: 'dry' };
    const parts = (events || []).filter(e => e && e.type === 'weather' && word[e.state] && !(e.state === 'dry' && !e.was)).map(e => `${word[e.state]} from ${when(e, unit)}`);
    return parts.length ? parts[0][0].toUpperCase() + parts.join(', ').slice(1) : '';
  }
  // What the tyres did to a car: "Wet tyres after lap 13, Medium tyres after lap 22, 2 penalty points for the tyres after lap 17"
  function noteOf(events, car) {
    const out = [];
    (events || []).forEach(e => {
      if (!e || e.car !== car) return;
      if (e.type === 'tyres') out.push(`${tyreName(e.tyre)} tyres after lap ${Number(e.lap) || 0}`);
      else if (e.type === 'tyreset') out.push(`${tyreName(e.tyre)} tyres, set by the Race Director ${Number(e.lap) > 0 ? `after lap ${Number(e.lap)}` : 'before the first lap'}`);
      else if (e.type === 'tyredue' && e.points > 0) out.push(`${e.points} penalty point${e.points === 1 ? '' : 's'} for the tyres after lap ${Number(e.lap) || 0}`);
    });
    return out.join(', ');
  }

  // ---- the conditions on the track ----
  // the units to show: the widget's own choice ('metric' | 'imperial'), else the units of the weather system, else metric
  const unitsOf = (cfg, want) => (want === 'metric' || want === 'imperial' ? want : cfg && cfg.cond && cfg.cond.units === 'imperial' ? 'imperial' : 'metric');
  // a value of one kind ('track' and 'air': a temperature, 'wind': a speed, 'dir': a direction) in other units
  const toUnits = (item, v, from, to) => {
    if (from === to || !Number.isFinite(v)) return v;
    if (item === 'track' || item === 'air') return to === 'imperial' ? v * 9 / 5 + 32 : (v - 32) * 5 / 9;
    if (item === 'wind') return to === 'imperial' ? v * 0.621371 : v / 0.621371;
    return v;
  };
  const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const COMPASS_WORDS = ['north', 'north north east', 'north east', 'east north east', 'east', 'east south east', 'south east', 'south south east', 'south', 'south south west', 'south west', 'west south west', 'west', 'west north west', 'north west', 'north north west'];
  const degOf = d => (((Math.round(Number(d)) || 0) % 360) + 360) % 360;
  const compass = d => COMPASS[Math.round(degOf(d) / 22.5) % 16], compassWord = d => COMPASS_WORDS[Math.round(degOf(d) / 22.5) % 16];
  // The conditions of a weather state for a screen: { units, state, track, air, wind, dir } in whole numbers, in the units to show (want: 'metric' | 'imperial' | anything else for the units of the system).
  // over: values of the widget itself ({ dry: { track, air, wind, dir }, ... }, in the units to show) instead of the ones of the weather system. null when there is nothing to show (no weather system and no values of its own).
  function conditionsFor(cfg, state, over, want) {
    const st = STATE_KEYS.includes(state) ? state : 'dry', units = unitsOf(cfg, want), base = over ? over[st] : cfg && cfg.cond && cfg.cond[st];
    if (!base) return null;
    const from = over ? units : cfg.cond.units, conv = (item, v) => Math.round(toUnits(item, Number(v) || 0, from, units));
    return { units, state: st, track: conv('track', base.track), air: conv('air', base.air), wind: conv('wind', base.wind), dir: degOf(base.dir) };
  }
  // the conditions as they are printed: { track: '30 °C', air: '24 °C', wind: '10 km/h', dir: 'SW', degrees: '225°' }
  function condText(c) {
    if (!c) return { track: '–', air: '–', wind: '–', dir: '–', degrees: '–' };
    const imp = c.units === 'imperial', deg = imp ? '°F' : '°C';
    return { track: `${c.track} ${deg}`, air: `${c.air} ${deg}`, wind: `${c.wind} ${imp ? 'mph' : 'km/h'}`, dir: compass(c.dir), degrees: `${degOf(c.dir)}°` };
  }
  // the conditions as they are spoken: { tracktemp: '30 degrees', airtemp: '24 degrees', windspeed: '10 kilometres per hour', winddir: 'south west' }
  function condSpeech(c) {
    if (!c) return { tracktemp: '', airtemp: '', windspeed: '', winddir: '' };
    const imp = c.units === 'imperial', one = n => Math.abs(n) === 1, deg = n => (n < 0 ? `minus ${-n} ${one(n) ? 'degree' : 'degrees'}` : `${n} ${one(n) ? 'degree' : 'degrees'}`);
    return { tracktemp: deg(c.track), airtemp: deg(c.air), windspeed: `${c.wind} ${imp ? (one(c.wind) ? 'mile per hour' : 'miles per hour') : (one(c.wind) ? 'kilometre per hour' : 'kilometres per hour')}`, winddir: compassWord(c.dir) };
  }

  // ---- what the Weather Forecast widget shows ----
  const NEXT_WORD = { cloudy: 'Cloudy', wet: 'Rain', clearing: 'Clearing', dry: 'Dry' };
  // how far a race is: the laps of the leader, and the milliseconds of racing
  const progressOf = (eng, t) => ({ laps: Math.max(0, ...(eng.cars || []).map(c => (c.laps || []).length)), ms: eng.status === 'ready' ? 0 : (eng.elapsed ? eng.elapsed(t) : 0) });
  // { state, name, director, next: { state, left, text } | null }: the weather now, and when the forecast changes it next ("Rain in 3 laps"; nothing when the Race Director decides or when there is nothing left to come). null when the race has no weather.
  function outlook(eng, t) {
    const cfg = eng && eng.weather; if (!cfg) return null;
    const p = progressOf(eng, t), state = eng.wxState || 'dry', director = !!(eng.wxPlan && eng.wxPlan.director) || cfg.start.mode === 'director';
    const nx = director ? null : nextStage(eng.wxPlan, eng.wxStage || 0, p.laps, p.ms);
    return { state, name: stateName(state), director, next: nx ? { state: nx.state, left: nx.left, text: nx.left > 0 ? `${NEXT_WORD[nx.state] || ''} in ${span(eng.wxPlan.unit, nx.left)}` : `${NEXT_WORD[nx.state] || ''} now` } : null };
  }

  // ---- what the controls of the Race Director show ----
  const OPEN = ['ready', 'countdown', 'running', 'paused', 'between'];
  // eng: the engine (or the one of a viewer); phase: the phase of the race screen; t: now; lanes: the lanes to list (all when not given).
  // { on, mode, state, name, info, rows: [{ lane, who, code, tyre, color, own, todo, hinder, hinderText }], buttons: [{ state, text, on, disabled }] }
  function view(eng, phase, t, lanes) {
    const cfg = eng && eng.weather;
    if (!cfg) return { on: false, mode: '', state: '', name: '', info: '', rows: [], buttons: [] };
    const open = OPEN.includes(phase) && eng.status !== 'finished', director = !!(eng.wxPlan && eng.wxPlan.director) || cfg.start.mode === 'director';
    const pr = progressOf(eng, t), nx = nextStage(eng.wxPlan, eng.wxStage || 0, pr.laps, pr.ms), name = stateName(eng.wxState || 'dry');
    const says = { cloudy: 'clouds build up', wet: 'rain starts', clearing: 'the rain stops, the track clears', dry: 'the track is dry again' };
    const info = director ? `${name}. The Race Director decides: press a state.` : `${name}.${nx ? ` Next: ${says[nx.state]} in ${span(eng.wxPlan.unit, nx.left)}.` : ''}`;
    const state = eng.wxState || 'dry';
    const rows = (eng.cars || []).filter(c => !lanes || lanes.includes(c.lane)).map(c => { // the cars: their tyres, what they have to do, how much they are hindered
      const k = need(state, c.tyre, c.tyreOwn), pct = Math.round(-(c.wx || 0)), t = tyreOf(c.tyre) || tyreOf(DEFAULT_TYRE);
      return { lane: c.lane, who: c.driverName || `Lane ${c.lane + 1}`, code: t.code, tyre: t.name, color: t.color, own: tyreName(c.tyreOwn),
        todo: k === 'wet' ? 'Has to switch to Wet' : k === 'dry' ? `Has to switch back to ${tyreName(c.tyreOwn)}` : '', hinder: pct, hinderText: pct > 0 ? `Hindered ${pct}%` : '' };
    });
    return { on: true, mode: director ? 'director' : cfg.start.mode, state, name, info, rows,
      buttons: STATES.map(([st, text]) => ({ state: st, text, on: state === st, disabled: !open || !director })) };
  }

  // ---- what the Tyre Change folder of the Race Director shows (1.32.0; every race, with or without weather) ----
  // eng: the engine (or the one of a viewer); phase: the phase of the race screen; lanes: the lanes to list (all when not given).
  // { on, open (a tyre can be given now), weather (the race has weather: Wet and Intermediate can not be chosen), rows: [{ lane, who, code, tyre, color, ownCode, ownName }] }
  // (code and tyre are the tyres the car is on; ownCode and ownName its own tyre: the one it races on, and goes back to after Wet or Intermediate tyres)
  function tyreView(eng, phase, lanes) {
    if (!eng || !Array.isArray(eng.cars)) return { on: false, open: false, weather: false, rows: [] };
    const rows = eng.cars.filter(c => !lanes || lanes.includes(c.lane)).map(c => { const t = tyreOf(c.tyre) || tyreOf(DEFAULT_TYRE);
      return { lane: c.lane, who: c.driverName || `Lane ${c.lane + 1}`, code: t.code, tyre: t.name, color: t.color, ownCode: cleanTyre(c.tyreOwn), ownName: tyreName(c.tyreOwn) }; });
    return { on: true, open: OPEN.includes(phase) && eng.status !== 'finished', weather: !!eng.weather, rows };
  }

  const api = { STATES, TYRES, CLASSES, DEFAULTS, DEFAULT_TYRE, HKEYS, TABLE, MAXP, COND_ITEMS, CKEYS, COND, COMPASS, unitsOf, toUnits, compass, compassWord, conditionsFor, condText, condSpeech, outlook, progressOf, tyreOf, cleanTyre, classOf, tyreName, stateName, clean, rng, plan, nextStage, span, stageOf, tyreFor, need, hinderOf, forecastNote, noteOf, view, tyreView };
  root.Wx = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
