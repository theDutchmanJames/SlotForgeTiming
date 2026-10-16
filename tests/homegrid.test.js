// 1.25.0: the cards of Home in a grid. The pure rules (homegrid.js): the list of cards and their options, a grid that always holds together (every card at most once,
// Start a race always there), the changes Customize makes, and the grid Home has until one is saved (the Home of before 1.25.0).
const fs = require('fs');
const G = require('../renderer/homegrid.js');
const LG = require('../renderer/livegrid.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const board = (card, c, r, w = 1, h = 1, opt = {}) => ({ c, r, w, h, opt: { card, ...opt } });
const cards = g => g.boards.map(G.cardOf).join();
const spots = g => g.boards.map(b => `${G.cardOf(b)}@${b.c}.${b.r}:${b.w}x${b.h}`).join(' ');

// ---- the cards ----
ok('there are eleven cards: Start a race, the three of before, and the seven new ones', G.CARDS.length === 11 && G.KEYS.join() === 'start,record,last,glance,recent,fastest,records,top,bests,rules,shortcuts');
ok('...every card has a name and a line of words, and the keys are all different', G.CARDS.every(c => c.label && c.note) && new Set(G.KEYS).size === 11);
ok('...only Start a race is fixed (it cannot be taken away)', G.CARDS.filter(c => c.fixed).map(c => c.key).join() === 'start');
ok('...a choice has a default that is one of its choices; a tick has a default of yes or no', G.CARDS.every(c => c.options.every(o => (o.type === 'check' ? typeof o.default === 'boolean' : o.choices.some(([k]) => k === o.default)))));
ok('...the options: Recent races has how many; Fastest laps has the tracks and the laps per track; Top drivers the period and how many; Shortcuts has a tick for every page',
  G.info('recent').options.map(o => o.key).join() === 'count' && G.info('fastest').options.map(o => o.key).join() === 'scope,count' && G.info('top').options.map(o => o.key).join() === 'period,count' && G.info('shortcuts').options.length === G.SHORTCUTS.length && G.info('nope') === null);

// ---- the grid Home has to begin with: the Home of before ----
const d0 = G.gridOf({});
ok('without a saved grid Home is the Home it was: Start a race over two columns and three rows, and the record, the last race and the totals in the third column', d0.cols === 3 && d0.rows === 3 && spots(d0) === 'start@1.1:2x3 record@3.1:1x1 last@3.2:1x1 glance@3.3:1x1');
ok('...also when there are no settings at all, or the saved grid is not a grid', same(G.gridOf(null), d0) && same(G.gridOf(undefined), d0) && same(G.gridOf({ homeGrid: 'x' }), d0) && same(G.gridOf({ homeGrid: [1, 2] }), d0) && same(G.gridOf({ homeGrid: null }), d0));
ok('...it is the default, and the default is not changed by asking for it', G.isDefault(d0) && same(G.DEFAULT, JSON.parse(JSON.stringify(G.DEFAULT))) && (() => { const g = G.gridOf({}); g.boards[0].opt.card = 'x'; return G.gridOf({}).boards[0].opt.card === 'start'; })());

// ---- a grid that holds together ----
const wild = { cols: 4, rows: 2, boards: [board('recent', 1, 1), board('recent', 2, 1), board('bogus', 3, 1), board('top', 3, 1, 2), { c: 4, r: 2, w: 1, h: 1, opt: {} }, null, 'x', board('glance', 9, 9)] };
const t1 = G.tidy(wild);
ok('a card that is not known, a board without a card and a card that is in twice are dropped (the first one stays)', cards(t1) === 'recent,start,top');
ok('...a card outside the grid is dropped, as in the Leaderboard grid', !cards(t1).includes('glance'));
ok('...Start a race is put back in the first free cell when the grid has lost it', spots(G.tidy({ cols: 3, rows: 1, boards: [board('record', 1, 1), board('last', 2, 1)] })) === 'record@1.1:1x1 last@2.1:1x1 start@3.1:1x1');
ok('...a grid with no card at all gets Start a race in its first cell', spots(G.tidy({ cols: 2, rows: 2, boards: [] })) === 'start@1.1:1x1' && spots(G.tidy(null)) === 'start@1.1:1x1');
ok('...and when every cell is taken it takes the place of the first card', spots(G.tidy({ cols: 2, rows: 1, boards: [board('record', 1, 1), board('last', 2, 1)] })) === 'start@1.1:1x1 last@2.1:1x1');
ok('...a wide card that covers the whole grid is replaced by Start a race in its corner', spots(G.tidy({ cols: 2, rows: 2, boards: [board('records', 1, 1, 2, 2)] })) === 'start@1.1:1x1');
ok('...a card that sticks out is cut back and two cards never share a cell (the rules of the Leaderboard grid)', spots(G.tidy({ cols: 3, rows: 1, boards: [board('start', 1, 1, 9, 9), board('record', 2, 1)] })) === 'start@1.1:3x1');
ok('...tidy is idempotent: a tidy grid stays as it is', same(G.tidy(t1), t1) && same(G.tidy(d0), d0));
ok('...the options of a card are kept, and a grid is made of copies (the one that was given is not changed)', (() => { const src = { cols: 3, rows: 1, boards: [board('start', 1, 1), board('recent', 2, 1, 1, 1, { count: '8' })] }, out = G.tidy(src); out.boards[1].opt.count = '3'; return src.boards[1].opt.count === '8' && G.optionOf(G.tidy(src).boards[1], 'count') === '8'; })());

// ---- the size ----
ok('the size is the one of the Leaderboard grid: up to 6 columns by 4 rows', G.MAXC === 6 && G.MAXR === 4 && G.sizeText(d0) === '3 columns × 3 rows' && G.sizeText({ cols: 1, rows: 1 }) === '1 column × 1 row' && G.where({ c: 2, r: 3 }) === 'column 2, row 3');
const big = G.resize(d0, 6, 4);
ok('a bigger grid keeps the cards where they are, in cells that are empty', big.cols === 6 && big.rows === 4 && spots(big) === spots(d0));
const small = G.resize(d0, 2, 2);
ok('a smaller grid drops the cards that no longer fit, and Start a race stays (cut back to the grid)', small.cols === 2 && small.rows === 2 && spots(small) === 'start@1.1:2x2');
ok('...Start a race that was in a column that is gone comes back in the first free cell', spots(G.resize({ cols: 3, rows: 1, boards: [board('record', 1, 1), board('start', 3, 1)] }, 2, 1)) === 'record@1.1:1x1 start@2.1:1x1');

// ---- the changes ----
const base = { cols: 4, rows: 2, boards: [board('start', 1, 1, 2, 1), board('record', 3, 1)] };
const a1 = G.add(base, 4, 1, 'recent');
ok('a card for an empty cell: it is in the grid at that cell, with the options of the card to be chosen', spots(a1) === 'start@1.1:2x1 record@3.1:1x1 recent@4.1:1x1' && !('count' in a1.boards[2].opt) && G.optionOf(a1.boards[2], 'count') === '5');
ok('...the old grid is not changed', spots(base) === 'start@1.1:2x1 record@3.1:1x1');
ok('...a card that is in the grid already, Start a race, an unknown card and a cell that is taken or not there change nothing', G.add(a1, 1, 2, 'recent') === a1 && G.add(a1, 1, 2, 'start') === a1 && G.add(a1, 1, 2, 'nope') === a1 && same(G.add(a1, 3, 1, 'last'), a1) && same(G.add(a1, 9, 9, 'last'), a1));
ok('...a card in a cell that was empty and that is below another is found at its own cell', spots(G.add(base, 1, 2, 'bests')) === 'start@1.1:2x1 record@3.1:1x1 bests@1.2:1x1');
ok('the cards are kept in reading order, so "Card 3" is always the third one you read', spots(G.add(G.add(base, 1, 2, 'bests'), 4, 1, 'top')) === 'start@1.1:2x1 record@3.1:1x1 top@4.1:1x1 bests@1.2:1x1');
ok('taking a card away: the cell is empty, the others stay', spots(G.remove(a1, 1)) === 'start@1.1:2x1 recent@4.1:1x1');
ok('...Start a race cannot be taken away, and a card that is not there changes nothing', G.remove(a1, 0) === a1 && G.remove(a1, 9) === a1);
const c1 = G.setCard(a1, 1, 'last');
ok('another card for a cell: the cell is the same, the options of the old card are gone', spots(c1) === 'start@1.1:2x1 last@3.1:1x1 recent@4.1:1x1' && same(c1.boards[1].opt, { card: 'last' }));
ok('...a card that is somewhere else already, Start a race (in either place), an unknown card, or the same card change nothing', G.setCard(a1, 1, 'recent') === a1 && G.setCard(a1, 1, 'start') === a1 && G.setCard(a1, 0, 'last') === a1 && G.setCard(a1, 1, 'nope') === a1 && G.setCard(a1, 1, 'record') === a1 && G.setCard(a1, 9, 'last') === a1);
const o1 = G.setOpt(a1, 2, { count: '8', bogus: 1, card: 'top' });
ok('an option of a card: only the options of that card can be set (not the card itself)', G.cardOf(o1.boards[2]) === 'recent' && G.optionOf(o1.boards[2], 'count') === '8' && !('bogus' in o1.boards[2].opt) && G.setOpt(a1, 9, { count: '8' }) === a1);
ok('...a value that is not one of the choices is the default', G.optionOf({ opt: { card: 'recent', count: '7' } }, 'count') === '5' && G.optionOf({ opt: { card: 'recent', count: 8 } }, 'count') === '8' && G.optionOf({ opt: { card: 'recent' } }, 'count') === '5' && G.optionOf({ opt: { card: 'recent' } }, 'nope') === undefined && G.optionOf(null, 'count') === undefined);
ok('...a tick is a yes or a no, and anything else is the default of that page', G.optionOf({ opt: { card: 'shortcuts', go_help: false } }, 'go_help') === false && G.optionOf({ opt: { card: 'shortcuts', go_help: 'yes' } }, 'go_help') === true && G.optionOf({ opt: { card: 'shortcuts', go_rules: true } }, 'go_rules') === true && G.optionOf({ opt: { card: 'shortcuts' } }, 'go_rules') === false);
ok('a taller card: the cells below must be free; a card that would cover a cell of another changes nothing, and one that is too tall is cut to the grid', spots(G.setSpan(a1, 1, 1, 2)) === 'start@1.1:2x1 record@3.1:1x2 recent@4.1:1x1' && spots(G.setSpan(a1, 1, 2, 1)) === spots(a1) && spots(G.setSpan(a1, 1, 1, 9)) === 'start@1.1:2x1 record@3.1:1x2 recent@4.1:1x1');
ok('...and Start a race can be made narrower or wider like any card', spots(G.setSpan(a1, 0, 1, 2)) === 'start@1.1:1x2 record@3.1:1x1 recent@4.1:1x1' && G.maxSpan(a1, a1.boards[0]).w === 2 && G.maxSpan(a1, a1.boards[0]).h === 2);

// ---- the cards a cell can have ----
ok('a cell can have the cards that are not in the grid, and the card it has now; never Start a race', G.available(a1, 1).map(c => c.key).join() === 'record,last,glance,fastest,records,top,bests,rules,shortcuts' && G.available(a1, -1).map(c => c.key).join() === 'last,glance,fastest,records,top,bests,rules,shortcuts');
ok('...the cards that are in the grid', G.used(a1).has('start') && G.used(a1).has('recent') && !G.used(a1).has('top') && G.used(null).size === 0);

// ---- the default ----
ok('a grid that was changed is not the default; one with the same cards in the same cells is', !G.isDefault(a1) && !G.isDefault(small) && G.isDefault(G.DEFAULT) && G.same(G.DEFAULT, d0) && !G.same(a1, d0));
ok('...a grid that is saved is the grid that comes back', same(G.gridOf({ homeGrid: a1 }), a1) && same(G.gridOf({ homeGrid: JSON.parse(JSON.stringify(a1)) }), a1));

// ---- the shortcuts ----
const sc = (opt = {}) => ({ opt: { card: 'shortcuts', ...opt } });
ok('the pages of a Shortcuts card: Results, Drivers, Slotcars, Tracks, Race Setup and Help to begin with, in the order of the list', G.shortcutsOf(sc()).map(s => s.key).join() === 'results,drivers,slotcars,tracks,setup,help');
ok('...every tick adds or takes away a page, and the order stays that of the list', G.shortcutsOf(sc({ go_rules: true, go_results: false, go_live: true })).map(s => s.key).join() === 'drivers,slotcars,tracks,setup,rules,live,help' && G.shortcutsOf(sc(Object.fromEntries(G.SHORTCUTS.map(s => ['go_' + s.key, false])))).length === 0);
ok('...every page says where it goes: a tab, and maybe a page of that tab; Live Race opens its own window', G.SHORTCUTS.every(s => s.key === 'live' ? s.to === null : s.to && typeof s.to.tab === 'string') && G.SHORTCUTS.find(s => s.key === 'help').to.settingsSub === 'help' && G.SHORTCUTS.find(s => s.key === 'results').to.sub === 'results');
const TABS_OF_APP = ['home', 'database', 'setup', 'custom', 'settings', 'rules'], SUBS_OF_DATABASE = ['tracks', 'drivers', 'teams', 'slotcars', 'results'];
ok('...and the places exist: the tabs of the app and the pages of the Database', G.SHORTCUTS.filter(s => s.to).every(s => TABS_OF_APP.includes(s.to.tab) && (s.to.tab !== 'database' || SUBS_OF_DATABASE.includes(s.to.sub))));

// ---- the stylesheet and the page ----
{ const css = fs.readFileSync(__dirname + '/../renderer/styles.css', 'utf8'), html = fs.readFileSync(__dirname + '/../renderer/index.html', 'utf8'), app = fs.readFileSync(__dirname + '/../renderer/app.js', 'utf8');
  ok('the cards sit in a grid of their own; a cell without a card takes no room', /\.hm-grid\{display:grid;gap:16px/.test(css) && /\.hm-cell:empty\{display:none\}/.test(css));
  ok('...the Start a race card lets its lanes stack when the card is narrow (a container query, as the Leaderboard boards use)', /\.hm-start\{container-type:inline-size\}/.test(css) && /@container \(max-width:560px\)\{\.hm-start \.lane/.test(css));
  ok('...in a narrow window every card has a line to itself, wherever the grid put it', /@media \(max-width:960px\)\{\.hm-grid\{grid-template-columns:minmax\(0,1fr\)!important\}\.hm-grid>\*\{grid-column:1!important;grid-row:auto!important\}\}/.test(css));
  ok('...the picker and the map of cells are the ones of the Leaderboard page (same squares, same cells)', /\.lv-gp\.on\{/.test(css) && /\.lv-gcell\.sel\{/.test(css) && !/\.hm-cols|\.hm-side/.test(css));
  ok('the page loads the grid rules and the cards before Home, after the grid rules of the Leaderboard', html.indexOf('livegrid.js') < html.indexOf('homegrid.js') && html.indexOf('homegrid.js') < html.indexOf('homecards.js') && html.indexOf('homecards.js') < html.indexOf('landing.js'));
  ok('the tabs the shortcuts name are the tabs of the app', TABS_OF_APP.every(t => app.includes(`['${t}',`))); }

console.log(fails ? fails + ' HOME GRID TESTS FAILED' : 'ALL HOME GRID TESTS PASSED');
process.exit(fails ? 1 : 0);
