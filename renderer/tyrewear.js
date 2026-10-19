// Tyre Wear (1.40.0): a tyre loses life from 100% to 0% while a car drives, and a pit stop gives it a fresh set.
// The rules live here and nothing else (no screen, no clock of its own), so they can be tested on their own. The race engine (engine.js) keeps the life of the tyres of every car and calls these
// functions; the Tyre Wear Systems form (database.js) uses the defaults and the texts; the widgets, cells and the Tyre Change folder show what view() and the engine give.
//
// A Tyre Wear System (a record of Race Setup > Tyre Wear Systems) has, for every tyre (Hard, Medium, Soft, Supersoft, Intermediate, Wet), four numbers that you can change:
//   wear   the % of life it loses in a lap (or in 100 m / 100 ft, when the system counts per distance),
//   bonus  the % it helps the car while it is new (any tyre can have one, not only the Soft),
//   cliff  the life (%) at which the bonus is gone and the tyre starts to hinder the car,
//   hind   the % it hinders the car when it is worn out (0% life).
// The grip curve is a straight line from +bonus at 100% life to 0 at the cliff, and from 0 at the cliff to -hind at 0% life. It works through the fuel levers (the fuel used in a lap, the refuelling
// speed, the size of the tank), the ones that Balance of Power and the weather use too, so it needs a Fuel setup. A rule for 0% life works without fuel. Measured lap times are never changed.
// Release 2 (1.41.0): the sets. A system can say how many sets of each tyre a car (or a team) has: a stop takes one set out of the box, a set that was taken off is not used again, and a tyre with no sets left
// can not be fitted or queued. The Race Director queues a tyre for the next stop; the weather's Intermediate or Wet tyres come before a queued tyre. Without a limit a stop gives a fresh set of the same tyre, as in 1.40.0.
(function (root) {
  const Wx = typeof module !== 'undefined' ? require('./weather.js') : root.Wx;
  const CODES = Wx.TYRES.map(t => t.code);
  const STATE_KEYS = Wx.STATES.map(s => s[0]);
  const CLASSES = Wx.CLASSES;
  const NUMS = [['wear', 'Wear per lap (%)'], ['bonus', 'Fresh bonus (%)'], ['cliff', 'Grip drops from (% life left)'], ['hind', 'Hindrance at 0% (%)']];
  const LIMITS = { wear: [0, 100], bonus: [0, 90], cliff: [0, 99], hind: [0, 90] };
  const MAXP = 90; // the most a car can be hindered (the same limit as Balance of Power)
  const FT = 0.3048;

  // my defaults (a Hard tyre lasts long and gives nothing, a Supersoft is fast and gone in 14 laps)
  const row = (wear, bonus, cliff, hind) => ({ wear, bonus, cliff, hind });
  const PRESETS = {
    standard: { name: 'Standard', note: 'in between', tyres: { H: row(2, 0, 20, 25), M: row(3, 2, 25, 25), S: row(4.5, 5, 30, 30), SS: row(7, 8, 35, 35), INT: row(3, 0, 25, 25), W: row(2.5, 0, 25, 25) } },
    sprint: { name: 'Sprint', note: 'wears the tyres quickly: short races, many stops', tyres: { H: row(3.5, 0, 20, 25), M: row(5, 2, 25, 25), S: row(8, 5, 30, 30), SS: row(12, 8, 35, 35), INT: row(5, 0, 25, 25), W: row(4.5, 0, 25, 25) } },
    endurance: { name: 'Endurance', note: 'wears the tyres slowly', tyres: { H: row(1, 0, 20, 25), M: row(1.5, 2, 25, 25), S: row(2.2, 5, 30, 30), SS: row(3.5, 8, 35, 35), INT: row(1.5, 0, 25, 25), W: row(1.2, 0, 25, 25) } }
  };
  const PRESET_KEYS = Object.keys(PRESETS);
  const DEFAULT_TYRES = PRESETS.standard.tyres;
  // how much more or less a tyre wears in a weather (x1 = normal): the weather state by the kind of tyre. Slicks in the rain wear fast, Intermediate and Wet tyres wear slower there.
  const MULT = { dry: { dry: 1, inter: 2, wet: 3 }, cloudy: { dry: 1, inter: 1.5, wet: 2 }, wet: { dry: 2.5, inter: 0.7, wet: 0.5 }, clearing: { dry: 1.5, inter: 0.8, wet: 1.5 } };
  const ZERO = [['none', 'Nothing, only show it'], ['points', 'Penalty points every lap'], ['lap', 'The lap does not count until the car pits'], ['retire', 'The car retires']];
  // the sets: how many sets of each tyre a car (or a team) has, the one it starts on counted; 0 = that tyre is not allowed in the race. setsMode: none (no limit, as in 1.40.0), car, team
  const DEFAULT_SETS = { H: 2, M: 2, S: 2, SS: 1, INT: 2, W: 2 };
  const SETS_MODES = [['none', 'No limit: every stop gives fresh tyres'], ['car', 'Each car has its own sets'], ['team', 'The team shares its sets']];
  const DEFAULTS = { setsMode: 'car', unit: 'lap', practice: 'off', qualifying: 'off', effect: 'on', eUse: 'on', eRate: 'on', eTank: 'off', zero: 'points', zeroPoints: 2, changeSeconds: 4, stop: 'overlap', warn: 25, crit: 10 };

  const num = (v, d, lo, hi) => {
    const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v;
    return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d;
  };
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const r1 = n => Math.round(n * 10) / 10;
  const clone = x => JSON.parse(JSON.stringify(x));

  // the table of tyres of a record, cleaned: every tyre has the four numbers (a number that is missing, or is not a number, is the default of the Standard system)
  function cleanTyres(t) {
    const out = {};
    CODES.forEach(code => {
      const src = (t && typeof t === 'object' && t[code]) || {}, d = DEFAULT_TYRES[code];
      out[code] = {};
      NUMS.forEach(([k]) => { out[code][k] = r1(num(src[k], d[k], LIMITS[k][0], LIMITS[k][1])); });
    });
    return out;
  }
  // the sets of a record, cleaned: every tyre has a whole number from 0 to 99 (missing: the default)
  function cleanSets(sets) {
    const out = {};
    CODES.forEach(code => { out[code] = Math.round(num(sets && typeof sets === 'object' ? sets[code] : undefined, DEFAULT_SETS[code], 0, 99)); });
    return out;
  }
  // the weather table of a record, cleaned: x0 to x20
  function cleanMult(m) {
    const out = {};
    STATE_KEYS.forEach(s => { out[s] = {}; CLASSES.forEach(c => { out[s][c] = Math.round(num(m && m[s] && m[s][c], MULT[s][c], 0, 20) * 100) / 100; }); });
    return out;
  }
  // what a new record starts with: the Standard system
  const defaults = () => ({ ...DEFAULTS, tyres: clone(DEFAULT_TYRES), mult: clone(MULT), sets: clone(DEFAULT_SETS) });

  // The settings of a record, cleaned into what the engine gets. ctx: { laneLen: [metres of every lane], disp: 'm' | 'ft' (the distance unit of the app) }. Gives null when there is no record.
  function clean(rec, ctx) {
    if (!rec || typeof rec !== 'object') return null;
    const c = ctx || {}, unit = rec.unit === 'distance' ? 'distance' : 'lap';
    return {
      on: true, unit, disp: c.disp === 'ft' ? 'ft' : 'm', laneLen: (Array.isArray(c.laneLen) ? c.laneLen : []).map(n => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : 0)),
      practice: rec.practice === 'on', qualifying: rec.qualifying === 'on',
      tyres: cleanTyres(rec.tyres), mult: cleanMult(rec.mult),
      sets: { mode: rec.setsMode === 'car' || rec.setsMode === 'team' ? rec.setsMode : 'none', n: cleanSets(rec.sets) }, // (a record from before 1.41.0 has no sets: no limit)
      effect: rec.effect !== 'off', levers: { use: rec.eUse !== 'off', rate: rec.eRate !== 'off', tank: rec.eTank === 'on' },
      zero: pick(rec.zero, ZERO.map(z => z[0]), DEFAULTS.zero), zeroPoints: Math.round(num(rec.zeroPoints, DEFAULTS.zeroPoints, 0, 100)),
      changeMs: Math.round(num(rec.changeSeconds, DEFAULTS.changeSeconds, 0, 600) * 1000), stop: rec.stop === 'add' ? 'add' : 'overlap',
      warn: Math.round(num(rec.warn, DEFAULTS.warn, 0, 100)), crit: Math.round(num(rec.crit, DEFAULTS.crit, 0, 100))
    };
  }

  // ---- the numbers ----
  const tyreOf = (cfg, code) => cfg.tyres[Wx.cleanTyre(code)];
  const unitM = cfg => (cfg.disp === 'ft' ? 100 * FT : 100); // the distance the wear is counted over, in metres: 100 m, or 100 ft
  // the % of life a tyre loses in one lap: its wear, times how much more or less it wears in this weather (a system that counts per distance: for the length of the lane of the car, in metres; without a length the lap counts as the distance)
  function wearPerLap(cfg, code, state, laneM) {
    const t = tyreOf(cfg, code), cls = Wx.classOf(code), m = (cfg.mult[STATE_KEYS.includes(state) ? state : 'dry'] || cfg.mult.dry)[cls];
    const per = t.wear * m;
    if (cfg.unit !== 'distance') return per;
    return per * (laneM > 0 ? laneM / unitM(cfg) : 1);
  }
  // how many percent a car is helped (+) or hindered (-) by its tyre at this life (0 to 100): +bonus when new, 0 at the cliff, -hindrance when worn out
  function effectPct(cfg, code, life) {
    const t = tyreOf(cfg, code), L = Math.max(0, Math.min(100, Number(life) || 0));
    if (L > t.cliff) return t.bonus * (L - t.cliff) / (100 - t.cliff);
    return t.cliff > 0 ? -t.hind * (t.cliff - L) / t.cliff : (L <= 0 ? -t.hind : 0);
  }
  // the whole percentage the fuel levers get (a car is never helped or hindered by more than 90%)
  const effectLever = (cfg, code, life) => Math.max(-MAXP, Math.min(MAXP, Math.round(effectPct(cfg, code, life))));
  // the colour of the life: ok, warn (the warning level and below), crit (the critical level and below), out (0%)
  function levelOf(cfg, life) {
    const L = Number(life) || 0;
    return L <= 0 ? 'out' : L <= cfg.crit ? 'crit' : L <= cfg.warn ? 'warn' : 'ok';
  }
  // how much a tyre has left: laps (at the pace of wear now), and the distance in the unit of the app (metres or feet)
  function left(cfg, code, state, life, laneM) {
    const per = wearPerLap(cfg, code, state, laneM), L = Math.max(0, Number(life) || 0), laps = per > 0 ? L / per : Infinity;
    const lap = laneM > 0 ? laneM : unitM(cfg), dist = Number.isFinite(laps) ? laps * lap / (cfg.disp === 'ft' ? FT : 1) : Infinity;
    return { laps, dist };
  }
  // what a new set lasts (the "Lasts about" of the form): laps, or metres (feet) when the record counts per distance
  function lasts(rec, code) {
    const t = cleanTyres(rec && rec.tyres)[Wx.cleanTyre(code)];
    if (!(t.wear > 0)) return Infinity;
    return 100 / t.wear;
  }

  // what a new set lasts, in words (the "Lasts about" column of the form): "50 laps", or "333 m" ("1094 ft") when the system counts per distance (the wear is then per 100 m / 100 ft: 100 / wear of them)
  function lastsText(unit, disp, wear) {
    const w = Number(wear);
    if (!(w > 0)) return 'no wear';
    if (unit === 'distance') return `${Math.round(10000 / w)} ${disp === 'ft' ? 'ft' : 'm'}`;
    const n = Math.max(1, Math.round(100 / w)); return `${n} ${n === 1 ? 'lap' : 'laps'}`;
  }
  // the grip curve of one tyre as a picture (SVG text): +bonus when new, 0 at the cliff, -hindrance at 0% life. t: { bonus, cliff, hind } (cleaned numbers)
  function curveSvg(t) {
    const bonus = Math.max(0, Number(t && t.bonus) || 0), hind = Math.max(0, Number(t && t.hind) || 0), cliff = Math.max(0, Math.min(99, Number(t && t.cliff) || 0));
    const W = 440, H = 235, L = 44, R = 14, T = 26, B = 40, top = Math.max(10, Math.ceil(bonus / 10) * 10), bot = -Math.max(10, Math.ceil(hind / 10) * 10);
    const X = life => L + (100 - life) / 100 * (W - L - R), Y = v => T + (top - v) / (top - bot) * (H - T - B);
    const grid = [];
    for (let v = bot; v <= top; v += 10) grid.push(`<line x1="${L}" y1="${Y(v).toFixed(1)}" x2="${W - R}" y2="${Y(v).toFixed(1)}" stroke="${v === 0 ? '#5b616c' : '#343b47'}" stroke-width="1"/><text x="${L - 6}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#98a0ab">${v > 0 ? '+' + v : v < 0 ? MINUS + -v : 0}</text>`);
    const ticks = [100, 75, 50, 25, 0].map(l => `<text x="${X(l).toFixed(1)}" y="${H - B + 16}" text-anchor="${l === 100 ? 'start' : l === 0 ? 'end' : 'middle'}" font-size="11" fill="#98a0ab">${l}%</text>`).join('');
    const p = (l, v) => `${X(l).toFixed(1)},${Y(v).toFixed(1)}`;
    const up = bonus > 0 ? `<polygon points="${p(100, 0)} ${p(100, bonus)} ${p(cliff, 0)}" fill="rgba(62,207,142,.28)"/>` : '';
    const down = hind > 0 ? `<polygon points="${p(cliff, 0)} ${p(0, -hind)} ${p(0, 0)}" fill="rgba(229,72,77,.32)"/>` : '';
    const dot = (l, v, c) => `<circle cx="${X(l).toFixed(1)}" cy="${Y(v).toFixed(1)}" r="4.5" fill="${c}"/>`;
    const lab = (l, v, text, c, anchor, dy) => `<text x="${X(l).toFixed(1)}" y="${(Y(v) + dy).toFixed(1)}" text-anchor="${anchor}" font-size="12" font-weight="700" fill="${c}">${text}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Grip curve: ${effectText(bonus)} when new, 0% at ${cliff}% life left, ${effectText(-hind)} at 0% life" style="max-width:100%;height:auto">${grid.join('')}${up}${down}`
      + `<polyline points="${p(100, bonus)} ${p(cliff, 0)} ${p(0, -hind)}" fill="none" stroke="#e8e6e1" stroke-width="2.5" stroke-linejoin="round"/>${dot(100, bonus, '#3ecf8e')}${dot(cliff, 0, '#ffb84d')}${dot(0, -hind, '#e5484d')}`
      + `${lab(100, bonus, `${effectText(bonus)} new`, '#6fe0ae', 'start', -9)}${lab(cliff, 0, `cliff at ${cliff}%`, '#ffc870', cliff < 12 ? 'end' : 'middle', -9)}${lab(0, -hind, `${effectText(-hind)} at 0%`, '#ff8a8e', 'end', -9)}${ticks}`
      + `<text x="${(L + (W - L - R) / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#98a0ab">tyre life left</text></svg>`;
  }

  // ---- the sets (1.41.0) ----
  // Which set goes on at a stop. pool: the sets that are left in the box ({ H: 2, ... }), or null when there is no limit; ask: the tyre that is wanted (the weather's, the one the Race Director queued, or the same tyre);
  // own: the tyre the car races on; forced: the weather asks for it (Intermediate or Wet), so there is nothing else to take; anyTyre: the race has no weather, so every tyre can be fitted.
  // Gives { code } (and asked: the tyre that was wanted, when another one goes on because there is no set of it left), or null: no set can go on, the car keeps its worn tyres.
  function pickFit(pool, ask, own, forced, anyTyre) {
    const want = Wx.cleanTyre(ask);
    if (!pool) return { code: want };
    const has = c => (Number(pool[c]) || 0) > 0;
    if (has(want)) return { code: want };
    if (forced) return null; // (no Intermediate or Wet set: the car stays on the tyres it has)
    const order = [Wx.cleanTyre(own)].concat(CODES.filter(c => anyTyre || Wx.classOf(c) === 'dry'));
    const code = order.find(c => c !== want && has(c));
    return code ? { code, asked: want } : null;
  }
  // how many sets are left in all (a pool, or null for no limit)
  const setsTotal = pool => (pool ? CODES.reduce((n, c) => n + Math.max(0, Number(pool[c]) || 0), 0) : null);
  // what the sets of a system say in words (the Help, the Home tab)
  function setsText(cfg) {
    if (!cfg || !cfg.sets || cfg.sets.mode === 'none') return 'no limit on the sets';
    const n = CODES.filter(c => cfg.sets.n[c] > 0).map(c => `${cfg.sets.n[c]} ${Wx.tyreOf(c).name}`).join(', ');
    return `sets ${cfg.sets.mode === 'team' ? 'shared by the team' : 'per car'}: ${n || 'none'}`;
  }

  // The choices of the "Next stop" list of a car in the Tyre Change folder: "Same (the tyre it races on)" first, then the tyres with their sets. row: a row of view(); weather: the race has weather
  // (the rain's tyres come from the weather, so only dry tyres can be queued). A tyre with no sets left can not be picked (but a tyre that is queued stays in the list); the tyre the car races on is the first choice, so it is left out.
  function nextChoices(row, weather) {
    const lim = !!(row && row.sets), nm = n => `${n} ${n === 1 ? 'set' : 'sets'}`, own = (row && row.own) || Wx.DEFAULT_TYRE;
    const out = [{ value: '', text: `Same (${Wx.tyreName(own)}${lim ? ` \u00b7 ${nm(Math.max(0, Number(row.sets[own]) || 0))}` : ''})`, disabled: false, hidden: false }];
    Wx.TYRES.forEach(t => {
      const n = lim ? Math.max(0, Number(row.sets[t.code]) || 0) : null;
      out.push({ value: t.code, text: `${t.name}${lim ? ` (${nm(n)})` : ''}`, disabled: (!!weather && t.cls !== 'dry') || (lim && n <= 0 && row.queued !== t.code), hidden: t.code === own });
    });
    return out;
  }
  // what is said under the "Next stop" list: who decided what goes on at the next stop
  function nextNote(row) {
    if (!row) return '';
    if (row.fitting) return 'The tyres are being changed now';
    const n = row.next || {};
    if (n.kind === 'weather') return `${Wx.tyreName(n.code)} from the weather${row.queued ? `, then ${Wx.tyreName(row.queued)}` : ''}`;
    if (n.kind === 'queued') return 'Queued by the Race Director';
    return 'Nothing queued';
  }

  // ---- words ----
  const MINUS = '−';
  const lapsWord = n => `${n} ${n === 1 ? 'lap' : 'laps'}`;
  const effectText = pct => { const n = Math.round(Number(pct) || 0); return n > 0 ? `+${n}%` : n < 0 ? `${MINUS}${-n}%` : '0%'; };
  const shownLife = life => { const L = Number(life) || 0; return L <= 0 ? 0 : Math.max(1, Math.min(100, Math.round(L))); };
  // "14 laps" / "205 m", for what is left; a tyre that does not wear says so
  function leftText(cfg, l) {
    if (!Number.isFinite(l.laps)) return 'no wear';
    if (cfg.unit === 'distance') return `${Math.max(0, Math.round(l.dist))} ${cfg.disp === 'ft' ? 'ft' : 'm'}`;
    const n = Math.max(0, Math.ceil(l.laps - 1e-9)); return lapsWord(n);
  }
  const zeroText = cfg => (cfg.zero === 'points' ? `${cfg.zeroPoints} penalty point${cfg.zeroPoints === 1 ? '' : 's'} a lap at 0%` : cfg.zero === 'lap' ? 'the lap does not count at 0% until the car pits' : cfg.zero === 'retire' ? 'the car retires at 0%' : 'nothing happens at 0%');
  // one line for the Home tab and the Help
  function rulesText(cfg) {
    if (!cfg) return '';
    return `Wear per ${cfg.unit === 'distance' ? (cfg.disp === 'ft' ? '100 ft' : '100 m') : 'lap'}; ${cfg.effect ? 'the grip helps and hinders through the fuel rules' : 'no effect on the fuel rules'}; ${zeroText(cfg)}; changing tyres takes ${cfg.changeMs / 1000} s${cfg.changeMs ? '' : ' (no time)'}${cfg.sets && cfg.sets.mode !== 'none' ? `; ${setsText(cfg)}` : ''}.`;
  }

  // what a car is doing with its tyres, in words, for the Tyre Change folder: the tyre that goes on while the tyres are being changed, "Box now" at 0%, "Box soon" at the critical level. cls: fit, out, crit, ok
  function stateOf(r) {
    if (!r) return { text: '', cls: '' };
    if (r.fitting) { const sec = Number.isFinite(r.fitLeft) ? ` · ${(Math.max(0, r.fitLeft) / 1000).toFixed(1)} s` : ''; return { text: `Fitting ${(Wx.tyreOf(r.fitting) || {}).name || ''}${sec}`.trim(), cls: 'fit' }; }
    if (r.level === 'out') return { text: 'Box now', cls: 'out' };
    if (r.level === 'crit') return { text: 'Box soon', cls: 'crit' };
    return { text: 'Driving', cls: 'ok' };
  }

  // ---- what the screens show (the Tyre Change folder, the widgets, the grids) ----
  // eng: the engine (the race window's, or the one a viewer follows); lanes: the lane numbers (0...); t: the clock of the screen (as performance.now()).
  // Gives { on, cfg, rows: [{ lane, who, code, tyre, color, life, shown, level, effect, effectText, leftText, lapsLeft, fitting, fitText, stops }] }.
  function view(eng, lanes, t) {
    const cfg = eng && eng.tyrewear;
    if (!cfg) return { on: false, cfg: null, rows: [] };
    const rows = [];
    (lanes || []).forEach(l => {
      const i = eng.cars.findIndex(c => c.lane === l); if (i < 0) return;
      const c = eng.cars[i], d = eng.twOf(i, t); if (!d) return;
      const ty = Wx.tyreOf(d.tyre) || Wx.tyreOf(Wx.DEFAULT_TYRE);
      const team = d.sets && cfg.sets.mode === 'team' && c.teamId ? eng.cars.filter(x => x.teamId === c.teamId) : null; // (the cars that share the sets)
      rows.push({ lane: l, who: c.teamName ? `${c.teamName} · ${c.driverName}` : c.driverName || '', code: ty.code, tyre: ty.name, color: ty.color, life: d.life, shown: shownLife(d.life), level: d.level,
        effect: d.effect, effectText: d.effect === null ? '' : effectText(d.effect), leftText: leftText(cfg, d.left), lapsLeft: d.left.laps, fitting: d.fitting, fitLeft: d.fitLeft, stops: d.stops,
        own: d.own, next: d.next, queued: d.queued || '', sets: d.sets, setsStart: d.sets ? cfg.sets.n : null, setsTotal: setsTotal(d.sets), setsMode: cfg.sets.mode, teamName: team ? c.teamName || '' : '', teamDrivers: team ? team.map(x => x.driverName || `Lane ${x.lane + 1}`) : [] });
    });
    return { on: true, cfg, rows };
  }

  const api = { nextChoices, nextNote, DEFAULT_SETS, SETS_MODES, cleanSets, pickFit, setsTotal, setsText, CODES, NUMS, LIMITS, MAXP, PRESETS, PRESET_KEYS, DEFAULT_TYRES, MULT, ZERO, DEFAULTS, defaults, cleanTyres, cleanMult, clean, wearPerLap, effectPct, effectLever, levelOf, left, lasts, effectText, shownLife, leftText, zeroText, rulesText, view, unitM, lastsText, curveSvg, stateOf };
  root.TyreWear = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
