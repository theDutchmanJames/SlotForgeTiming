// The cards of the Home tab in a grid (1.25.0). Which card sits in which cell is set under Customize on Home, the way the Leaderboard page sets its boards (livegrid.js):
// the grid is picked with the little squares (up to 6 columns by 4 rows), a card is chosen for every cell, and a card can cover more cells (wider, taller).
// Pure rules, no page and no settings store. The grid is { cols, rows, boards: [{ c, r, w, h, opt }] } as in livegrid.js, and opt.card says which card the board is
// (plus the options of that card). The rules of the grid itself (limits, no overlap, reading order) are those of livegrid.js; this file adds:
// - the list of cards, and the options of each card;
// - every card at most once, and a card it does not know is dropped;
// - the Start a race card is always there (a grid that lost it gets it back in the first free cell);
// - the grid that is used until one is saved: the Home of before 1.25.0 (Start a race on the left, three cards on the right).
// 1.26.0: two cards that are for show, set by hand under Customize: Weather (the weather and the conditions of the track) and Tyres Available (tyres of the weather
// system with a name of your own). Their options have more kinds than the others: a number, a line of text, a picture set, and rows (a tyre is one row of three options).
(function (root) {
  const LG = typeof module !== 'undefined' ? require('./livegrid.js') : root.LiveGrid;

  const yesNo = (key, label, on) => ({ key, label, type: 'check', default: on });
  const COUNTS = [['3', '3'], ['5', '5'], ['8', '8'], ['10', '10']];
  // Where a shortcut goes: a tab, and maybe a page inside it. 'live' opens the Live Race window.
  const SHORTCUTS = [
    { key: 'results', label: 'Results and Records', on: true, to: { tab: 'database', sub: 'results' } }, { key: 'drivers', label: 'Drivers', on: true, to: { tab: 'database', sub: 'drivers' } },
    { key: 'slotcars', label: 'Slotcars', on: true, to: { tab: 'database', sub: 'slotcars' } }, { key: 'tracks', label: 'Tracks', on: true, to: { tab: 'database', sub: 'tracks' } },
    { key: 'teams', label: 'Teams', on: false, to: { tab: 'database', sub: 'teams' } }, { key: 'setup', label: 'Race Setup', on: true, to: { tab: 'setup' } },
    { key: 'custom', label: 'Customization', on: false, to: { tab: 'custom' } }, { key: 'settings', label: 'App Settings', on: false, to: { tab: 'settings' } },
    { key: 'rules', label: 'Racing Rules', on: false, to: { tab: 'rules' } }, { key: 'live', label: 'Live Race', on: false, to: null }, // (Live Race opens its own window)
    { key: 'help', label: 'Help', on: true, to: { tab: 'settings', settingsSub: 'help' } }
  ];
  const CARDS = [
    { key: 'start', label: 'Start a race', note: 'The race setup, the lanes and the Start button. It is always on Home.', fixed: true, options: [] },
    { key: 'record', label: 'Record to beat', note: 'The fastest lap on the track of the race setup, and who on the grid is closest', options: [] },
    { key: 'last', label: 'Last race', note: 'The podium of the last race and its fastest lap', options: [] },
    { key: 'glance', label: 'At a glance', note: 'Races, laps and distance, and who won most', options: [] },
    { key: 'recent', label: 'Recent races', note: 'The latest races with their winners; click one to open its results',
      options: [{ key: 'count', label: 'How many races', type: 'select', choices: COUNTS, default: '5' }] },
    { key: 'fastest', label: 'Fastest laps this week', note: 'The best lap of every driver since Monday',
      options: [{ key: 'scope', label: 'Tracks', type: 'select', choices: [['track', 'The track of the race setup'], ['all', 'All tracks (a list for every track)']], default: 'track' },
        { key: 'count', label: 'Laps per track', type: 'select', choices: COUNTS, default: '5' }] },
    { key: 'records', label: 'Records on all tracks', note: 'The fastest lap of every track', options: [] },
    { key: 'top', label: 'Top drivers', note: 'Who has won the most races',
      options: [{ key: 'period', label: 'Count the wins of', type: 'select', choices: [['year', 'This year'], ['all', 'All time']], default: 'year' },
        { key: 'count', label: 'How many drivers', type: 'select', choices: COUNTS, default: '5' }] },
    { key: 'bests', label: 'Personal bests of the drivers on the grid', note: 'The best lap on this track of every driver in the lanes', options: [] },
    { key: 'rules', label: 'Rules of this race', note: 'Length, penalties, damage, fuel and weather of the race setup', options: [] },
    { key: 'shortcuts', label: 'Shortcuts', note: 'One click to the pages you use most',
      options: SHORTCUTS.map(s => yesNo('go_' + s.key, s.label, s.on)) }
  ];
  // 1.26.0 Weather: the states of the weather system, and where the four values go
  const WEATHER_STATES = [['dry', 'Dry'], ['cloudy', 'Cloudy'], ['wet', 'Wet'], ['clearing', 'Clearing']];
  // The tyres of the weather system (weather.js), in its order. A card of tyres has a row for each (a test keeps this list the same as weather.js has).
  const TYRE_PRESETS = [['H', 'Hard'], ['M', 'Medium'], ['S', 'Soft'], ['SS', 'Supersoft'], ['INT', 'Intermediate'], ['W', 'Wet']];
  const TYRES_ON = ['H', 'M', 'S']; // (the tyres that are ticked in a new card)
  const IMAGES = (key, label, kind) => ({ key, label: label + ' (a picture set made under Customization > Image Settings; none: they are drawn)', type: 'imageset', kind, default: '' });
  CARDS.push(
    { key: 'weather', label: 'Weather', note: 'The weather and the conditions of the track, as you type them here. The card is for show: it does not follow a race',
      options: [{ key: 'state', label: 'The weather', type: 'select', choices: WEATHER_STATES, default: 'dry' },
        { key: 'line', label: 'A line under it (your own words, or empty)', type: 'text', max: 40, default: '', placeholder: 'Clearing after lunch' },
        { key: 'units', label: 'Units (the numbers below change with them)', type: 'select', choices: [['metric', 'Celsius and km/h'], ['imperial', 'Fahrenheit and mph']], default: 'metric' },
        { key: 'track', label: 'Track temperature', type: 'number', min: -60, max: 150, default: 30, unit: 'temp' },
        { key: 'air', label: 'Air temperature', type: 'number', min: -60, max: 150, default: 24, unit: 'temp' },
        { key: 'wind', label: 'Wind speed', type: 'number', min: 0, max: 400, default: 10, unit: 'speed' },
        { key: 'dir', label: 'Wind comes from (degrees: 0 north, 90 east, 180 south, 270 west)', type: 'number', min: 0, max: 359, default: 225 },
        yesNo('showTrack', 'Show the track temperature', true), yesNo('showAir', 'Show the air temperature', true), yesNo('showWind', 'Show the wind speed', true),
        yesNo('showDir', 'Show the wind direction (SW)', true), yesNo('showDegrees', 'Show the wind direction in degrees too (SW 225°)', false),
        { key: 'layout', label: 'Put the four values', type: 'select', choices: [['grid', 'Two by two'], ['row', 'In a row'], ['column', 'In a column']], default: 'grid' },
        IMAGES('weatherSet', 'Pictures of the weather', 'weather'), IMAGES('condSet', 'Icons of the four values', 'conditions')] },
    { key: 'tyres', label: 'Tyres Available', note: 'Tyres of the weather system with a name of your own, and how many you have. The card is for show: it does not follow a race',
      options: [...TYRE_PRESETS.flatMap(([code, name]) => [
        { key: 'on_' + code, label: name, type: 'check', default: TYRES_ON.includes(code), row: code },
        { key: 'name_' + code, label: `Your name for ${name}`, type: 'text', max: 24, default: '', placeholder: `Name (${name})`, row: code },
        { key: 'count_' + code, label: `How many sets of ${name}`, type: 'number', min: 0, max: 99, default: 4, suffix: 'sets', row: code }]),
        yesNo('showCount', 'Show how many there are of each', false),
        { key: 'layout', label: 'Put the tyres', type: 'select', choices: [['column', 'In a column'], ['row', 'In a row']], default: 'column' },
        IMAGES('tyreSet', 'Pictures of the tyres', 'tyres')] });
  const KEYS = CARDS.map(c => c.key);
  const info = key => CARDS.find(c => c.key === key) || null;
  const cardOf = b => (b && b.opt && typeof b.opt.card === 'string' ? b.opt.card : '');

  // The Home of before 1.25.0 as a grid: Start a race over two columns and three rows, the three cards in the third column.
  const DEFAULT = { cols: 3, rows: 3, boards: [
    { c: 1, r: 1, w: 2, h: 3, opt: { card: 'start' } }, { c: 3, r: 1, w: 1, h: 1, opt: { card: 'record' } },
    { c: 3, r: 2, w: 1, h: 1, opt: { card: 'last' } }, { c: 3, r: 3, w: 1, h: 1, opt: { card: 'glance' } }] };

  // Any grid (from the settings, a file, a mistake) made into one that holds together: only known cards, each once, the grid rules of livegrid.js, and Start a race in it.
  function tidy(g) {
    const seen = new Set();
    const boards = (g && Array.isArray(g.boards) ? g.boards : []).filter(b => { const k = cardOf(b); if (!KEYS.includes(k) || seen.has(k)) return false; seen.add(k); return true; });
    let out = LG.clean({ cols: g && g.cols, rows: g && g.rows, boards });
    if (!out.boards.some(b => cardOf(b) === 'start')) { // Start a race went missing (a smaller grid, a damaged file): it takes the first free cell, else the place of the first card
      let at = null;
      for (let r = 1; r <= out.rows && !at; r++) for (let c = 1; c <= out.cols && !at; c++) if (!LG.boardAt(out, c, r)) at = { c, r };
      if (!at) { const first = out.boards[0]; at = first ? { c: first.c, r: first.r } : { c: 1, r: 1 }; out = LG.remove(out, 0); }
      out = LG.add(out, at.c, at.r, { card: 'start' });
    }
    return out;
  }
  const gridOf = s => tidy(s && s.homeGrid && typeof s.homeGrid === 'object' && !Array.isArray(s.homeGrid) ? s.homeGrid : DEFAULT);
  const same = (a, b) => JSON.stringify(tidy(a)) === JSON.stringify(tidy(b));
  const isDefault = g => same(g, DEFAULT);

  const used = g => new Set((g && g.boards ? g.boards : []).map(cardOf));
  // The cards a cell can have: the ones that are not in the grid yet (Start a race is never offered, it has its cell already), and the card the cell has now.
  const available = (g, i) => { const u = used(g), now = g.boards[i] ? cardOf(g.boards[i]) : ''; return CARDS.filter(c => !c.fixed && (!u.has(c.key) || c.key === now)); };

  // A number in the other units (1.26.0): a temperature in Celsius or Fahrenheit, a speed in km/h or mph; whole, and inside the limits of the option (the same sums as weather.js).
  const convert = (o, v, to) => {
    const n = o.unit === 'temp' ? (to === 'imperial' ? v * 9 / 5 + 32 : (v - 32) * 5 / 9) : (to === 'imperial' ? v * 0.621371 : v / 0.621371);
    return Math.min(o.max, Math.max(o.min, Math.round(n)));
  };
  // The value of an option of a board: what was chosen when it is one of the choices, else the default. A "check" is true or false; a "number" is a whole number
  // inside its limits (its default, in the units of the card, when it was never typed); a "text" is a line of at most `max` characters; a picture set is the id of a set.
  function optionOf(board, name) {
    const card = info(cardOf(board)), o = card && card.options.find(x => x.key === name);
    if (!o) return undefined;
    const v = board && board.opt ? board.opt[name] : undefined;
    if (o.type === 'check') return typeof v === 'boolean' ? v : o.default;
    if (o.type === 'text') return typeof v === 'string' ? v.trim().slice(0, o.max) : o.default;
    if (o.type === 'imageset') return typeof v === 'string' && v.length <= 64 ? v : '';
    if (o.type === 'number') {
      const n = typeof v === 'string' && v.trim() !== '' ? Number(v.replace(',', '.')) : v;
      if (typeof n === 'number' && Number.isFinite(n)) return Math.min(o.max, Math.max(o.min, Math.round(n)));
      return o.unit && optionOf(board, 'units') === 'imperial' ? convert(o, o.default, 'imperial') : o.default;
    }
    return o.choices.some(([k]) => k === String(v)) ? String(v) : o.default;
  }
  // The pages that are on in a Shortcuts card, in the order of the list.
  const shortcutsOf = board => SHORTCUTS.filter(s => optionOf(board, 'go_' + s.key));
  // The tyres that are ticked in a Tyres Available card, in the order of the weather system: { code, preset (Soft), name (the name you gave it, else the preset), count }.
  const tyresOf = board => TYRE_PRESETS.filter(([code]) => optionOf(board, 'on_' + code)).map(([code, preset]) => ({ code, preset, name: optionOf(board, 'name_' + code) || preset, count: optionOf(board, 'count_' + code) }));

  // The changes. Each gives a new grid and leaves the old one alone; a change that cannot be made gives the grid back as it was.
  const resize = (g, cols, rows) => tidy(LG.resize(g, cols, rows));
  function add(g, c, r, key) { const card = info(key); return !card || card.fixed || used(g).has(key) ? g : tidy(LG.add(g, c, r, { card: key })); }
  function remove(g, i) { const b = g.boards[i]; return !b || cardOf(b) === 'start' ? g : tidy(LG.remove(g, i)); }
  function setCard(g, i, key) { const b = g.boards[i], card = info(key); return !b || cardOf(b) === 'start' || !card || card.fixed || (used(g).has(key) && cardOf(b) !== key) ? g : cardOf(b) === key ? g : tidy(LG.setOptAll(g, i, { card: key })); }
  function setOpt(g, i, patch) { // only the options of the card of that board
    const b = g.boards[i], card = b && info(cardOf(b)); if (!card) return g;
    const keep = {}; Object.keys(patch || {}).forEach(k => { if (card.options.some(o => o.key === k)) keep[k] = patch[k]; });
    const u = card.options.find(o => o.key === 'units');
    if (u && keep.units !== undefined) { // other units: the numbers that go with them are changed too (31 °C becomes 88 °F), unless the same change brings its own number
      const from = optionOf(b, 'units'), to = u.choices.some(([k]) => k === String(keep.units)) ? String(keep.units) : from;
      if (to !== from) card.options.filter(o => o.unit).forEach(o => { if (!(o.key in keep)) keep[o.key] = convert(o, optionOf(b, o.key), to); });
    }
    return tidy(LG.setOpt(g, i, keep));
  }
  const setSpan = (g, i, w, h) => tidy(LG.setSpan(g, i, w, h));

  const api = { CARDS, KEYS, SHORTCUTS, DEFAULT, MAXC: LG.MAXC, MAXR: LG.MAXR, info, cardOf, tidy, gridOf, same, isDefault, used, available, optionOf, shortcutsOf, tyresOf, TYRE_PRESETS, WEATHER_STATES,
    cells: LG.cells, maxSpan: LG.maxSpan, sizeText: LG.sizeText, where: LG.where, resize, add, remove, setCard, setOpt, setSpan };
  root.HomeGrid = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
