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
ok('there are fifteen cards: Start a race, the three of before, the seven of 1.25.0, Weather and Tyres Available since 1.26.0 and, since 1.28.0, Notes and Car Mileage', G.CARDS.length === 15 && G.KEYS.join() === 'start,record,last,glance,recent,fastest,records,top,bests,rules,shortcuts,weather,tyres,notes,mileage');
ok('...every card has a name and a line of words, and the keys are all different', G.CARDS.every(c => c.label && c.note) && new Set(G.KEYS).size === 15);
ok('...only Start a race is fixed (it cannot be taken away)', G.CARDS.filter(c => c.fixed).map(c => c.key).join() === 'start');
ok('...a choice has a default that is one of its choices; a tick has a default of yes or no; a number a whole default inside its limits; a line of text a default that fits; a picture set has none',
  G.CARDS.every(c => c.options.every(o => (o.type === 'check' ? typeof o.default === 'boolean' : o.type === 'number' ? Number.isInteger(o.default) && o.default >= o.min && o.default <= o.max
    : (o.type === 'text' || o.type === 'longtext') ? typeof o.default === 'string' && o.default.length <= o.max : o.type === 'imageset' ? o.default === '' && typeof o.kind === 'string' : o.choices.some(([k]) => k === o.default)))));
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
ok('a cell can have the cards that are not in the grid, and the card it has now; never Start a race', G.available(a1, 1).map(c => c.key).join() === 'record,last,glance,fastest,records,top,bests,rules,shortcuts,weather,tyres,notes,mileage' && G.available(a1, -1).map(c => c.key).join() === 'last,glance,fastest,records,top,bests,rules,shortcuts,weather,tyres,notes,mileage');
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
  ok('1.26.1: the heading of a card contains its floated tag, so a title that wraps in a 1x1 cell cannot push the tag over the first row (the first time would sit left of the others)', /\.hm-tag\{float:right/.test(css) && /\.hm-grid \.card>h3\{display:flow-root\}/.test(css));
  ok('1.28.0: the words of a Notes card keep their lines (pre-wrap) and wrap long words, the large size is bigger, and the text box of Customize takes the whole row', /\.hm-ntext\{white-space:pre-wrap;overflow-wrap:anywhere/.test(css) && /\.hm-n-large \.hm-ntext\{font-size:21px/.test(css) && /\.hm-wide\{grid-column:1\/-1\}/.test(css));
  ok('the page loads the grid rules and the cards before Home, after the grid rules of the Leaderboard', html.indexOf('livegrid.js') < html.indexOf('homegrid.js') && html.indexOf('homegrid.js') < html.indexOf('homecards.js') && html.indexOf('homecards.js') < html.indexOf('landing.js'));
  ok('the tabs the shortcuts name are the tabs of the app', TABS_OF_APP.every(t => app.includes(`['${t}',`))); }

// ---- 1.26.0: the Weather card and the Tyres Available card (for show: set by hand under Customize) ----
const W = require('../renderer/weather.js');
const mk = (card, opt = {}) => ({ c: 1, r: 1, w: 1, h: 1, opt: { card, ...opt } }), o = (b, k) => G.optionOf(b, k);
ok('the tyre rows are the tyres of the weather system, in its order, with its names', same(G.TYRE_PRESETS, W.TYRES.map(t => [t.code, t.name])));
ok('the states of the weather are those of the weather system', same(G.WEATHER_STATES, W.STATES));
ok('the Weather card has the weather, a line, the units, the four numbers, five ticks, the way to put them and two picture sets', G.info('weather').options.map(x => x.key).join() === 'state,line,units,track,air,wind,dir,showTrack,showAir,showWind,showDir,showDegrees,layout,weatherSet,condSet');
ok('...its numbers begin with the dry values of the weather system (30, 24, 10 and 225), Celsius and km/h, two by two, no line', ['track', 'air', 'wind', 'dir'].every(k => o(mk('weather'), k) === W.COND.dry[k]) && o(mk('weather'), 'units') === 'metric' && o(mk('weather'), 'layout') === 'grid' && o(mk('weather'), 'line') === '' && o(mk('weather'), 'state') === 'dry');
ok('...the four values and the picture sets: the ticks are on (not the degrees), a set is none', ['showTrack', 'showAir', 'showWind', 'showDir'].every(k => o(mk('weather'), k) === true) && o(mk('weather'), 'showDegrees') === false && o(mk('weather'), 'weatherSet') === '' && o(mk('weather'), 'condSet') === '');
ok('a number is whole and stays inside its limits: 31.6 is 32, 500 °C is 150, -90 is -60, a wind of -5 is 0, a direction of 400 is 359; a number as text counts; anything else is the default',
  o(mk('weather', { track: 31.6 }), 'track') === 32 && o(mk('weather', { track: 500 }), 'track') === 150 && o(mk('weather', { air: -90 }), 'air') === -60 && o(mk('weather', { wind: -5 }), 'wind') === 0 && o(mk('weather', { dir: 400 }), 'dir') === 359
  && o(mk('weather', { track: '28' }), 'track') === 28 && o(mk('weather', { track: '28,4' }), 'track') === 28 && o(mk('weather', { track: 'warm' }), 'track') === 30 && o(mk('weather', { track: '' }), 'track') === 30 && o(mk('weather', { track: null }), 'track') === 30 && o(mk('weather', { track: NaN }), 'track') === 30 && o(mk('weather', { track: Infinity }), 'track') === 30);
ok('a line of text is cut at its length and trimmed; text that is not text is the default', o(mk('weather', { line: '  Rain after lunch  ' }), 'line') === 'Rain after lunch' && o(mk('weather', { line: 'x'.repeat(100) }), 'line').length === 40 && o(mk('weather', { line: 5 }), 'line') === '' && o(mk('weather', { line: null }), 'line') === '');
ok('a state that is not one of the four is Dry; units that are not known are Celsius and km/h; a layout that is not known is two by two', o(mk('weather', { state: 'snow' }), 'state') === 'dry' && o(mk('weather', { state: 'wet' }), 'state') === 'wet' && o(mk('weather', { units: 'x' }), 'units') === 'metric' && o(mk('weather', { layout: 'x' }), 'layout') === 'grid');
ok('a picture set is the id of a set (text of a sensible length), else none', o(mk('weather', { weatherSet: 'abc123' }), 'weatherSet') === 'abc123' && o(mk('weather', { weatherSet: 5 }), 'weatherSet') === '' && o(mk('weather', { weatherSet: 'x'.repeat(65) }), 'weatherSet') === '' && o(mk('tyres', { tyreSet: 's9' }), 'tyreSet') === 's9');
ok('an option the card does not have is nothing (a Weather card has no tyres, a Tyres card has no wind)', o(mk('weather'), 'on_S') === undefined && o(mk('tyres'), 'wind') === undefined && o(mk('record'), 'state') === undefined);

// the units: a number that was never typed is the default in the units of the card; other units change the numbers that were typed
ok('without numbers of its own an imperial card has the dry values in Fahrenheit and mph (86 °F, 75 °F, 6 mph)', o(mk('weather', { units: 'imperial' }), 'track') === 86 && o(mk('weather', { units: 'imperial' }), 'air') === 75 && o(mk('weather', { units: 'imperial' }), 'wind') === 6 && o(mk('weather', { units: 'imperial' }), 'dir') === 225);
ok('...the same sums as weather.js (a temperature, a speed)', o(mk('weather', { units: 'imperial' }), 'track') === Math.round(W.toUnits('track', 30, 'metric', 'imperial')) && o(mk('weather', { units: 'imperial' }), 'wind') === Math.round(W.toUnits('wind', 10, 'metric', 'imperial')) && o(mk('weather', { units: 'imperial', track: 100 }), 'track') === 100);
{ const g = G.add(G.resize(G.DEFAULT, 4, 3), 4, 1, 'weather'), i = g.boards.findIndex(b => G.cardOf(b) === 'weather');
  const f = G.setOpt(g, i, { units: 'imperial', track: 31 }).boards[i];
  ok('other units change the numbers: 24 °C becomes 75 °F and 10 km/h 6 mph; a number typed with the change is kept as it is (31); the direction does not change', o(f, 'units') === 'imperial' && o(f, 'track') === 31 && o(f, 'air') === 75 && o(f, 'wind') === 6 && o(f, 'dir') === 225 && f.opt.air === 75);
  const typed = G.setOpt(G.setOpt(g, i, { track: 31, air: 22, wind: 12, dir: 90 }), i, { units: 'imperial' }).boards[i];
  ok('...typed numbers: 31 °C is 88 °F, 22 °C is 72 °F, 12 km/h is 7 mph, and 90 degrees stays 90', o(typed, 'track') === 88 && o(typed, 'air') === 72 && o(typed, 'wind') === 7 && o(typed, 'dir') === 90);
  const back = G.setOpt(G.setOpt(g, i, { units: 'imperial' }), i, { units: 'metric' }).boards[i];
  ok('...and back again: Celsius and km/h with the first numbers', o(back, 'units') === 'metric' && o(back, 'track') === 30 && o(back, 'air') === 24 && o(back, 'wind') === 10);
  const same2 = G.setOpt(G.setOpt(g, i, { track: 31 }), i, { units: 'metric' }).boards[i];
  ok('...the same units again change nothing (31 stays 31), and units that are not known change nothing either', o(same2, 'track') === 31 && o(G.setOpt(G.setOpt(g, i, { track: 31 }), i, { units: 'furlongs' }).boards[i], 'track') === 31);
  const lim = G.setOpt(G.setOpt(g, i, { track: 150 }), i, { units: 'imperial' }).boards[i];
  ok('...a number that does not fit the other units stays inside the limits (150 °C is 150 °F at most)', o(lim, 'track') === 150);
  ok('...the card of another kind has no units to change: its options are kept as they are', same(G.setOpt(G.DEFAULT, 1, { units: 'imperial' }), G.DEFAULT));
  ok('...the grid that was changed is a new grid; the old one is as it was', !('track' in g.boards[i].opt) && !('units' in g.boards[i].opt)); }

// Tyres Available: a row for every tyre of the weather system
ok('the Tyres Available card has a row of three options for every tyre (a tick, your name, how many), then how many to show, the way to put the tyres and a picture set',
  G.info('tyres').options.length === 6 * 3 + 3 && G.info('tyres').options.slice(0, 18).every((x, k) => x.row === G.TYRE_PRESETS[Math.floor(k / 3)][0]) && G.info('tyres').options.slice(18).map(x => x.key).join() === 'showCount,layout,tyreSet');
ok('...the keys of a row are on_, name_ and count_ with the code of the tyre', G.info('tyres').options.slice(0, 3).map(x => x.key).join() === 'on_H,name_H,count_H' && G.info('tyres').options.slice(15, 18).map(x => x.key).join() === 'on_W,name_W,count_W');
ok('...to begin with the Hard, Medium and Soft tyres are ticked, with their own names, 4 of each, no counts and in a column', same(G.tyresOf(mk('tyres')), [{ code: 'H', preset: 'Hard', name: 'Hard', count: 4 }, { code: 'M', preset: 'Medium', name: 'Medium', count: 4 }, { code: 'S', preset: 'Soft', name: 'Soft', count: 4 }]) && o(mk('tyres'), 'showCount') === false && o(mk('tyres'), 'layout') === 'column');
{ const t = G.tyresOf(mk('tyres', { on_H: false, on_SS: true, on_W: true, name_S: ' Grippy ', name_W: 'Rain tyres', count_S: '6', count_W: 2, count_SS: 120, name_M: '' }));
  ok('the tyres that are ticked come in the order of the weather system, with the name you gave (trimmed), else the name of the preset, and how many (a number as text counts, 120 is 99)',
    t.map(x => x.code).join() === 'M,S,SS,W' && t.map(x => x.name).join() === 'Medium,Grippy,Supersoft,Rain tyres' && t.map(x => x.preset).join() === 'Medium,Soft,Supersoft,Wet' && t.map(x => x.count).join() === '4,6,99,2'); }
ok('...no tyre ticked is an empty list; a count is never below 0 and a name never longer than 24 characters', G.tyresOf(mk('tyres', { on_H: false, on_M: false, on_S: false })).length === 0 && o(mk('tyres', { count_H: -3 }), 'count_H') === 0 && o(mk('tyres', { name_H: 'n'.repeat(60) }), 'name_H').length === 24);
ok('a tick of a tyre is yes or no (text is not a tick)', o(mk('tyres', { on_SS: 'yes' }), 'on_SS') === false && o(mk('tyres', { on_H: 'no' }), 'on_H') === true);
{ const g = G.add(G.resize(G.DEFAULT, 4, 3), 4, 1, 'tyres'), i = g.boards.findIndex(b => G.cardOf(b) === 'tyres');
  const g2 = G.setOpt(G.setOpt(g, i, { name_S: 'Grippy' }), i, { count_S: '7', layout: 'row', showCount: true, nonsense: 1 }).boards[i];
  ok('Customize changes one option at a time and keeps the others; a key the card does not have is not kept', g2.opt.name_S === 'Grippy' && o(g2, 'count_S') === 7 && o(g2, 'layout') === 'row' && o(g2, 'showCount') === true && !('nonsense' in g2.opt) && g2.opt.card === 'tyres');
  ok('...the card is in the grid once: a second one is not added, and the card can be taken away and put back (its settings start again)', cards(G.add(g, 4, 3, 'tyres')).split(',').filter(x => x === 'tyres').length === 1);
  const gone = G.remove(g, i); ok('...taken away, the card and its settings are gone', !cards(gone).includes('tyres') && same(G.tyresOf(G.add(gone, 4, 1, 'tyres').boards.find(b => G.cardOf(b) === 'tyres')), G.tyresOf(mk('tyres')))); }
ok('both cards are offered for a cell, and a card that is in the grid is not offered again', G.available(G.DEFAULT, 0).some(c => c.key === 'weather') && G.available(G.DEFAULT, 0).some(c => c.key === 'tyres')
  && !G.available(G.add(G.resize(G.DEFAULT, 4, 3), 4, 1, 'weather'), 1).some(c => c.key === 'weather') && G.available(G.add(G.resize(G.DEFAULT, 4, 3), 4, 1, 'weather'), 1).some(c => c.key === 'tyres'));
ok('a saved grid with the new cards holds together (known cards, each once)', cards(G.tidy({ cols: 4, rows: 1, boards: [board('start', 1, 1), board('weather', 2, 1), board('weather', 3, 1), board('tyres', 4, 1)] })) === 'start,weather,tyres');

// ---- 1.28.0: the Notes card and the Car Mileage card ----
ok('Notes has a title (Notes to begin with), the words, a size and a tick for the title; Car Mileage has what to show, how many cars, the period, the picture and the bar',
  G.info('notes').options.map(x => x.key).join() === 'title,text,size,showTitle' && G.info('mileage').options.map(x => x.key).join() === 'show,count,period,pics,bars' && o(mk('notes'), 'title') === 'Notes' && o(mk('notes'), 'text') === '' && o(mk('notes'), 'size') === 'normal' && o(mk('notes'), 'showTitle') === true);
ok('...Car Mileage starts with laps and distance, 5 cars, all time, the picture and the bar', o(mk('mileage'), 'show') === 'both' && o(mk('mileage'), 'count') === '5' && o(mk('mileage'), 'period') === 'all' && o(mk('mileage'), 'pics') === true && o(mk('mileage'), 'bars') === true);
ok('the words of Notes keep their lines (a Windows line break too), are trimmed, and are cut at 600 characters', o(mk('notes', { text: '  Doors open 19:00\r\nFirst heat 19:30\n\nBring tyres  ' }), 'text') === 'Doors open 19:00\nFirst heat 19:30\n\nBring tyres' && o(mk('notes', { text: 'x'.repeat(700) }), 'text').length === 600 && o(mk('notes', { text: 42 }), 'text') === '' && o(mk('notes', { text: null }), 'text') === '');
ok('...the title is a line of at most 40 characters, the size one of its two, anything else the standard', o(mk('notes', { title: '  Club night  ' }), 'title') === 'Club night' && o(mk('notes', { title: 'y'.repeat(60) }), 'title').length === 40 && o(mk('notes', { size: 'large' }), 'size') === 'large' && o(mk('notes', { size: 'huge' }), 'size') === 'normal' && o(mk('notes', { showTitle: false }), 'showTitle') === false && o(mk('notes', { showTitle: 'no' }), 'showTitle') === true);
ok('...Car Mileage takes only the choices it has (a value that is not one is the standard)', o(mk('mileage', { show: 'distance' }), 'show') === 'distance' && o(mk('mileage', { show: 'laps' }), 'show') === 'laps' && o(mk('mileage', { show: 'cars' }), 'show') === 'both' && o(mk('mileage', { count: '8' }), 'count') === '8' && o(mk('mileage', { count: '9' }), 'count') === '5' && o(mk('mileage', { period: 'year' }), 'period') === 'year' && o(mk('mileage', { period: 'month' }), 'period') === 'all' && o(mk('mileage', { bars: false }), 'bars') === false);
{ const g0 = G.add(G.DEFAULT, 1, 1, 'notes') === G.DEFAULT ? G.DEFAULT : G.resize(G.DEFAULT, 4, 3), g1 = G.add(G.add(g0, 4, 1, 'notes'), 4, 2, 'mileage');
  const i = g1.boards.findIndex(b => G.cardOf(b) === 'notes'), g2 = G.setOpt(g1, i, { text: 'Line 1\nLine 2', title: 'Club night', size: 'large', nonsense: 1 });
  ok('both cards can be put in the grid, and a change of the settings of Notes is saved with its lines; what is not an option of the card is left out', g1.boards.some(b => G.cardOf(b) === 'mileage') && g1.boards.some(b => G.cardOf(b) === 'notes') && g2.boards[i].opt.text === 'Line 1\nLine 2' && g2.boards[i].opt.title === 'Club night' && g2.boards[i].opt.size === 'large' && !('nonsense' in g2.boards[i].opt)); }

console.log(fails ? fails + ' HOME GRID TESTS FAILED' : 'ALL HOME GRID TESTS PASSED');
process.exit(fails ? 1 : 0);
