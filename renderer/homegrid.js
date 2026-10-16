// The cards of the Home tab in a grid (1.25.0). Which card sits in which cell is set under Customize on Home, the way the Leaderboard page sets its boards (livegrid.js):
// the grid is picked with the little squares (up to 6 columns by 4 rows), a card is chosen for every cell, and a card can cover more cells (wider, taller).
// Pure rules, no page and no settings store. The grid is { cols, rows, boards: [{ c, r, w, h, opt }] } as in livegrid.js, and opt.card says which card the board is
// (plus the options of that card). The rules of the grid itself (limits, no overlap, reading order) are those of livegrid.js; this file adds:
// - the list of cards, and the options of each card;
// - every card at most once, and a card it does not know is dropped;
// - the Start a race card is always there (a grid that lost it gets it back in the first free cell);
// - the grid that is used until one is saved: the Home of before 1.25.0 (Start a race on the left, three cards on the right).
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

  // The value of an option of a board: what was chosen when it is one of the choices, else the default. A "check" is true or false.
  function optionOf(board, name) {
    const card = info(cardOf(board)), o = card && card.options.find(x => x.key === name);
    if (!o) return undefined;
    const v = board && board.opt ? board.opt[name] : undefined;
    if (o.type === 'check') return typeof v === 'boolean' ? v : o.default;
    return o.choices.some(([k]) => k === String(v)) ? String(v) : o.default;
  }
  // The pages that are on in a Shortcuts card, in the order of the list.
  const shortcutsOf = board => SHORTCUTS.filter(s => optionOf(board, 'go_' + s.key));

  // The changes. Each gives a new grid and leaves the old one alone; a change that cannot be made gives the grid back as it was.
  const resize = (g, cols, rows) => tidy(LG.resize(g, cols, rows));
  function add(g, c, r, key) { const card = info(key); return !card || card.fixed || used(g).has(key) ? g : tidy(LG.add(g, c, r, { card: key })); }
  function remove(g, i) { const b = g.boards[i]; return !b || cardOf(b) === 'start' ? g : tidy(LG.remove(g, i)); }
  function setCard(g, i, key) { const b = g.boards[i], card = info(key); return !b || cardOf(b) === 'start' || !card || card.fixed || (used(g).has(key) && cardOf(b) !== key) ? g : cardOf(b) === key ? g : tidy(LG.setOptAll(g, i, { card: key })); }
  function setOpt(g, i, patch) { // only the options of the card of that board
    const b = g.boards[i], card = b && info(cardOf(b)); if (!card) return g;
    const keep = {}; Object.keys(patch || {}).forEach(k => { if (card.options.some(o => o.key === k)) keep[k] = patch[k]; });
    return tidy(LG.setOpt(g, i, keep));
  }
  const setSpan = (g, i, w, h) => tidy(LG.setSpan(g, i, w, h));

  const api = { CARDS, KEYS, SHORTCUTS, DEFAULT, MAXC: LG.MAXC, MAXR: LG.MAXR, info, cardOf, tidy, gridOf, same, isDefault, used, available, optionOf, shortcutsOf,
    cells: LG.cells, maxSpan: LG.maxSpan, sizeText: LG.sizeText, where: LG.where, resize, add, remove, setCard, setOpt, setSpan };
  root.HomeGrid = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
