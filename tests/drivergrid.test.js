// 1.36.0: the grid of the Driver stats page. The pure rules (drivergrid.js): the cells there are, the grid that is used until one is saved, a grid that always holds together,
// what to draw for a race (a cell the race has nothing for is blank, a row of blank cells is left out), the lane a device remembers; and the part of webapi.js that lets a
// phone keep a layout of its own and go back to the computer's.
const vm = require('vm'), fs = require('fs'), path = require('path');
const D = require('../renderer/drivergrid.js'), LG = require('../renderer/livegrid.js'), Wd = require('../renderer/widgets.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const board = (c, r, w, h, cell, label) => ({ c, r, w, h, opt: { cell, label: label !== false } });
const spots = g => g.boards.map(b => `${b.c}.${b.r}:${b.w}x${b.h}=${b.opt.cell}`).join(' ');
const drawn = L => L.cells.map(x => `${x.key}@${x.c}.${x.r}:${x.w}x${x.h}${x.quiet ? 'q' : ''}`).join(' ');

// ---- the cells ----
ok('there are 26 cells, each with a key of its own, a name and a group that exists', D.CELLS.length === 26 && new Set(D.CELLS.map(c => c.key)).size === 26 && D.CELLS.every(c => c.label && D.GROUPS.includes(c.group)));
ok('the groups are Race, Swaps, Car, Track and Other, and none is empty', same(D.GROUPS, ['Race', 'Swaps', 'Car', 'Track', 'Other']) && D.GROUPS.every(g => D.CELLS.some(c => c.group === g)));
ok('every cell is made by a widget that exists, or on the page itself (the last lap), and a cell that needs something says what in words', D.CELLS.every(c => (c.own === 'last' ? c.key === 'last' : !!Wd.def(c.type)) && (!c.needs || (typeof D.NEEDS[c.needs] === 'string' && D.NEEDS[c.needs].length > 10))));
ok('...and every need that is explained is a need of some cell', Object.keys(D.NEEDS).every(k => D.CELLS.some(c => c.needs === k)));
ok('the numbers of before are all there: position, lap, lap time, best, average and median lap, gap, record lap, speed, fuel, pitstop, penalty and points, and the list of laps',
  ['position', 'lap', 'laptime', 'bestlap', 'avglap', 'medlap', 'gap', 'recordlap', 'speed', 'fuel', 'pitstop', 'penalty', 'champpoints', 'laplist'].every(k => D.cellOf(k)));
ok('...and the new ones: laps to go, the swap signal and timer, the current and next driver, tyres, damage, the flag and the start lights', ['lapstogo', 'swapsignal', 'swaptimer', 'currentdriver', 'nextdriver', 'tyre', 'damage', 'flag', 'lights'].every(k => D.cellOf(k)));
ok('...the distance cells of Distance Racing too (they show when the lane has a length)', D.cellOf('distance').needs === 'driven' && D.cellOf('distleft').needs === 'togo');
ok('the lap list is a list of the Last lap widget with its own settings; the last lap is made on the page', D.cellOf('laplist').list === true && D.cellOf('laplist').type === 'lastlap' && D.cellOf('laplist').opt.lapsPerColumn === 8 && D.cellOf('last').own === 'last');
ok('laps to go is just the number and the swap timer just the clock (the label above says the rest)', D.cellOf('lapstogo').opt.show === 'number' && D.cellOf('swaptimer').opt.show === 'clock');
ok('a cell that is not there is null, and a name like toString is not a cell', D.cellOf('nope') === null && D.cellOf('toString') === null && D.cellOf('') === null && D.cellOf(undefined) === null);

// ---- the size, and the other grids ----
ok('the grid is up to 4 columns by 8 rows; the Leaderboard and Home grids are still 6 by 4', D.MAXC === 4 && D.MAXR === 8 && LG.MAXC === 6 && LG.MAXR === 4 && typeof LG.make === 'function');
ok('the size is a whole number from 1 to 4 columns and from 1 to 8 rows', same([D.clean({ cols: 9, rows: 99 }), D.clean({ cols: 0, rows: -3 }), D.clean({ cols: '3.7', rows: '2' })].map(g => [g.cols, g.rows]), [[4, 8], [1, 1], [3, 2]]));
ok('make gives the same rules for another size, and does not change the grid of the Leaderboard', (() => { const A = LG.make(2, 2), g = A.clean({ cols: 5, rows: 5, boards: [{ c: 3, r: 1, opt: {} }, { c: 2, r: 2, opt: {} }] }); return g.cols === 2 && g.rows === 2 && g.boards.length === 1 && LG.clean({ cols: 5, rows: 5 }).cols === 5; })());

// ---- the grid until one is saved ----
const def = D.DEFAULT();
ok('the default is 4 columns by 8 rows with 12 cells, every one of them kept by the rules (none dropped or cut)', def.cols === 4 && def.rows === 8 && def.boards.length === 12 && same(D.clean(def), def));
ok('...a swap signal across the top, with no label', spots(def).startsWith('1.1:4x1=swapsignal') && def.boards[0].opt.label === false && def.boards.slice(1).every(b => b.opt.label === true));
ok('...the position big (2 by 2) beside the last lap and the best lap, the gap and laps to go, the swap timer, fuel and damage, the tyres and the flag, and the lap list across the bottom',
  spots(def) === '1.1:4x1=swapsignal 1.2:2x2=position 3.2:2x1=last 3.3:2x1=bestlap 1.4:2x1=gap 3.4:2x1=lapstogo 1.5:2x1=swaptimer 3.5:1x1=fuel 4.5:1x1=damage 1.6:2x1=tyre 3.6:2x1=flag 1.7:4x2=laplist');
ok('no saved grid: the default; a saved grid wins; a copy each time (changing one does not change the next)', same(D.gridOf({}), def) && same(D.gridOf(null), def) && same(D.gridOf({ driverGrid: { cols: 2, rows: 1, boards: [board(1, 1, 1, 1, 'fuel')] } }), { cols: 2, rows: 1, boards: [board(1, 1, 1, 1, 'fuel')] })
  && (() => { const a = D.gridOf({}); a.boards[0].opt.cell = 'fuel'; return D.gridOf({}).boards[0].opt.cell === 'swapsignal'; })());
ok('a saved grid with no cells is kept as it is (you may take every cell away), but something that is not a grid is not used', same(D.gridOf({ driverGrid: { cols: 3, rows: 2, boards: [] } }), { cols: 3, rows: 2, boards: [] })
  && same(D.gridOf({ driverGrid: 5 }), def) && same(D.gridOf({ driverGrid: {} }), def) && same(D.gridOf({ driverGrid: { cols: 2, rows: 2 } }), def) && same(D.gridOf({ driverGrid: null }), def) && same(D.gridOf({ driverGrid: 'x' }), def));

// ---- a grid that holds together ----
ok('a cell that does not exist is dropped, with the rules of every grid kept: a cell outside the grid is dropped, one that sticks out is cut back, the later of two on the same place is dropped',
  spots(D.clean({ cols: 3, rows: 2, boards: [board(1, 1, 1, 1, 'nope'), board(2, 1, 1, 1, 'fuel'), board(4, 1, 1, 1, 'gap'), board(2, 2, 5, 5, 'lap'), board(3, 2, 1, 1, 'speed')] })) === '2.1:1x1=fuel 2.2:2x1=lap');
ok('the settings of a cell are its cell and its label; a label is on unless it is false; anything else is left out', same(D.clean({ cols: 2, rows: 1, boards: [{ c: 1, r: 1, opt: { cell: 'fuel', label: 0, junk: 1 } }, { c: 2, r: 1, opt: { cell: 'gap', label: false } }, { c: 3, r: 1, opt: { cell: 'lap' } }] }).boards.map(b => b.opt),
  [{ cell: 'fuel', label: true }, { cell: 'gap', label: false }]));
ok('...a cell with no settings at all is dropped (there is nothing for it to show)', D.clean({ cols: 2, rows: 1, boards: [{ c: 1, r: 1 }, { c: 2, r: 1, opt: [] }, null, 7] }).boards.length === 0);
ok('cleaning gives a copy: the grid it came from is not changed', (() => { const src = { cols: 2, rows: 1, boards: [board(1, 1, 1, 1, 'fuel')] }, g = D.clean(src); g.boards[0].opt.cell = 'gap'; return src.boards[0].opt.cell === 'fuel'; })());

// ---- the changes ----
{ const g = D.clean({ cols: 3, rows: 2, boards: [board(1, 1, 2, 1, 'position'), board(3, 1, 1, 1, 'gap')] }), before = JSON.stringify(g);
  const added = D.add(g, 1, 2, 'fuel');
  ok('a cell for an empty place: one cell wide and high, with its label on', spots(added) === '1.1:2x1=position 3.1:1x1=gap 1.2:1x1=fuel' && added.boards[2].opt.label === true);
  ok('...not for a place that is taken (also one that a wider cell covers), not outside the grid, and not for a cell that does not exist', D.add(g, 2, 1, 'fuel') === g && D.add(g, 1, 1, 'fuel') === g && D.add(g, 4, 1, 'fuel') === g && D.add(g, 1, 3, 'fuel') === g && D.add(g, 1, 2, 'nope') === g && D.add(g, 1, 2, '') === g);
  ok('another number for a cell, and a cell that is not there is no change', spots(D.setCell(g, 1, 'lap')) === '1.1:2x1=position 3.1:1x1=lap' && D.setCell(g, 1, 'nope') === g && D.setCell(g, 9, 'lap') === g);
  ok('taking a cell away', spots(D.remove(g, 0)) === '3.1:1x1=gap' && D.remove(g, 5) === g);
  ok('wider and taller where there is room, and the same when there is none', spots(D.setSpan(g, 1, 1, 2)) === '1.1:2x1=position 3.1:1x2=gap' && D.setSpan(g, 0, 3, 1) === g && D.setSpan(g, 0, 2, 2).boards[0].h === 2 && D.setSpan(g, 7, 1, 1) === g);
  ok('...a cell cannot grow over another one', D.setSpan(D.add(g, 1, 2, 'fuel'), 0, 2, 2).boards[0].h === 1);
  ok('the label on or off (a label is on unless it is switched off)', D.setLabel(g, 0, undefined).boards[0].opt.label === true && D.setLabel(g, 0, false).boards[0].opt.label === false && D.setLabel(D.setLabel(g, 0, false), 0, true).boards[0].opt.label === true && D.setLabel(g, 9, false) === g);
  ok('a smaller grid cuts back or drops the cells that no longer fit, a bigger one keeps them', spots(D.resize(g, 2, 1)) === '1.1:2x1=position' && spots(D.resize(g, 4, 8)) === spots(g) && D.resize(g, 1, 1).boards.length === 1 && D.resize(g, 1, 1).boards[0].w === 1);
  ok('none of the changes touched the grid they started from', JSON.stringify(g) === before); }
ok('the size, the place and the cells in words and in order (what the page draws)', D.sizeText({ cols: 4, rows: 8 }) === '4 columns × 8 rows' && D.sizeText({ cols: 1, rows: 1 }) === '1 column × 1 row' && D.where({ c: 2, r: 3 }) === 'column 2, row 3'
  && D.cells(D.clean({ cols: 2, rows: 2, boards: [board(1, 1, 1, 2, 'position')] })).map(x => (x.board ? 'B' : 'e') + x.c + '.' + x.r).join(' ') === 'B1.1 e2.1 e2.2');

// ---- what a race has ----
ok('a cell with no need always shows; a cell with a need shows when the race has it; an unknown cell never', D.applies('position', {}) && D.applies('position', null) && !D.applies('fuel', {}) && !D.applies('fuel', null) && D.applies('fuel', { fuel: true })
  && !D.applies('fuel', { tyres: true }) && !D.applies('nope', { fuel: true }) && D.applies('swapsignal', { swaps: true }) && D.applies('nextdriver', { swaps: true }) && D.applies('currentdriver', { x: 1 }));

// ---- what to draw ----
const all = () => true;
ok('everything shows: all rows and all cells, where the grid has them', drawn(D.layout(def, all)) === 'swapsignal@1.1:4x1 position@1.2:2x2 last@3.2:2x1 bestlap@3.3:2x1 gap@1.4:2x1 lapstogo@3.4:2x1 swaptimer@1.5:2x1 fuel@3.5:1x1 damage@4.5:1x1 tyre@1.6:2x1 flag@3.6:2x1 laplist@1.7:4x2' && D.layout(def, all).rows === 8 && D.layout(def, all).cols === 4);
ok('...the cells say what they are: their number, their label, and where they sit in the grid they came from', (() => { const L = D.layout(def, all); return L.cells[0].key === 'swapsignal' && L.cells[0].label === false && L.cells[1].label === true && L.cells.every((x, i) => x.index === i && x.quiet === false); })());
{ const facts = {}, L = D.layout(def, k => D.applies(k, facts));
  ok('a race with nothing special (no swaps, fuel, damage, tyres...): the swap signal row and the row of the swap timer, fuel and damage are not drawn, the rows after them move up',
    drawn(L) === 'position@1.1:2x2 last@3.1:2x1 bestlap@3.2:2x1 gap@1.3:2x1 lapstogo@3.3:2x1q tyre@1.4:2x1q flag@3.4:2x1 laplist@1.5:4x2' && L.rows === 6);
  ok('...a cell that has nothing to show stays blank (quiet) in a row that is drawn: the place stays, the next cells do not move', L.cells.filter(x => x.quiet).map(x => x.key).join() === 'lapstogo,tyre'); }
{ const L = D.layout(def, k => D.applies(k, { laps: true, swaps: true, fuel: true, damage: true, tyres: true }));
  ok('a race with swaps, fuel, damage, tyres and laps: every row is drawn, no cell is blank', L.rows === 8 && L.cells.length === 12 && L.cells.every(x => !x.quiet)); }
{ const L = D.layout(def, k => D.applies(k, { swaps: true }));
  ok('swaps only: the swap rows are drawn (all 8 rows have something), with fuel and damage blank beside the swap timer, and the flag still with the tyres blank', L.rows === 8 && drawn(L).startsWith('swapsignal@1.1:4x1 ') && drawn(L).includes('swaptimer@1.5:2x1 fuel@3.5:1x1q damage@4.5:1x1q') && drawn(L).includes('tyre@1.6:2x1q flag@3.6:2x1')); }
{ const g = D.clean({ cols: 2, rows: 4, boards: [board(1, 1, 1, 3, 'swapsignal'), board(2, 1, 1, 1, 'position'), board(2, 3, 1, 1, 'gap'), board(1, 4, 2, 1, 'fuel')] }), L = D.layout(g, k => k === 'position' || k === 'gap');
  ok('a tall cell that shows nothing, with a row inside it that nothing else needs: the row is left out and the cell is as tall as the rows of it that are drawn', drawn(L) === 'swapsignal@1.1:1x2q position@2.1:1x1 gap@2.2:1x1' && L.rows === 2); }
{ const g = D.clean({ cols: 2, rows: 3, boards: [board(1, 1, 1, 3, 'position'), board(2, 2, 1, 1, 'fuel')] }), L = D.layout(g, k => k === 'position');
  ok('a tall cell that shows keeps all its rows, and a blank cell inside them is drawn blank', drawn(L) === 'position@1.1:1x3 fuel@2.2:1x1q' && L.rows === 3); }
ok('nothing to show anywhere: no rows and no cells (the page says so); an empty grid the same', same(D.layout(def, () => false), { cols: 4, rows: 0, cells: [] }) && same(D.layout(D.clean({ cols: 2, rows: 2, boards: [] }), all), { cols: 2, rows: 0, cells: [] }));
ok('layout does not change the grid', (() => { const g = D.DEFAULT(), s = JSON.stringify(g); D.layout(g, () => false); D.layout(g, all); return JSON.stringify(g) === s; })());

// ---- the lane of a device ----
ok('the lane that is on stays while it is in the race; then the lane the device remembers; then the first', D.laneFor([0, 1, 2], 1, 2) === 1 && D.laneFor([0, 1, 2], 5, 2) === 2 && D.laneFor([0, 1, 2], null, 2) === 2 && D.laneFor([0, 1, 2], 5, 7) === 0 && D.laneFor([3, 1], null, null) === 3 && D.laneFor([], 1, 2) === null);
ok('...lane 0 counts as a lane, and a lane that is not in the race (a smaller race now) is skipped', D.laneFor([0, 1], 0, 1) === 0 && D.laneFor([0, 1], null, 0) === 0 && D.laneFor([1, 2], null, 0) === 1);
ok('a device remembers its lane unless it was told not to: a whole number from 0, and nothing else', D.savedLane({ driverLane: 2 }) === 2 && D.savedLane({ driverLane: 0 }) === 0 && D.savedLane({ driverLane: 2, driverRemember: true }) === 2 && D.savedLane({ driverLane: 2, driverRemember: false }) === null
  && D.savedLane({}) === null && D.savedLane(null) === null && D.savedLane({ driverLane: null }) === null && D.savedLane({ driverLane: -1 }) === null && D.savedLane({ driverLane: '2' }) === null && D.savedLane({ driverLane: 1.5 }) === null);
ok('remembering is on unless it is switched off', D.rememberOn({}) && D.rememberOn(null) && D.rememberOn({ driverRemember: true }) && !D.rememberOn({ driverRemember: false }));

// ---- the page loads it, and the style sheet has the cells ----
{ const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8'), css = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
  ok('the page loads the Driver stats grid after the grid rules of the Leaderboard (which it uses) and before the Live Race pages', html.indexOf('livegrid.js') >= 0 && html.indexOf('livegrid.js') < html.indexOf('drivergrid.js') && html.indexOf('drivergrid.js') < html.indexOf('liveview.js'));
  ok('the style sheet has the grid, a blank cell, the big and the small cell, the list, and the buttons of the map', ['.lv-dgrid{', '.lv-dg{', '.lv-dg.big strong', '.lv-dg.small strong', '.lv-dg.list{', '.lv-dgc{', '.lv-dgc.sel{', '.lv-dgmap{'].every(c => css.includes(c)));
  ok('a blank cell has no box (it is a div without the stat look)', !/\.lv-dg\.quiet\{[^}]*border/.test(css)); }

// ---- a phone keeps its own layout (webapi.js) ----
{ // the browser of another device, in a stand-in: the computer's settings come over the network, what the device chooses stays in its own storage
  const mem = new Map(), computer = { theme: 'dark', driverGrid: { cols: 2, rows: 1, boards: [board(1, 1, 1, 1, 'fuel')] }, driverLane: 3 };
  const win = {}, ctx = vm.createContext({ window: win, localStorage: { getItem: k => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) }, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    fetch: async () => ({ ok: true, json: async () => JSON.parse(JSON.stringify(computer)) }), location: { hash: '#live' }, JSON, Promise, Error });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'webapi.js'), 'utf8'), ctx);
  const api = win.api, mine = () => JSON.parse(mem.get('slt-viewer') || '{}');
  (async () => {
    const first = await api.getSettings();
    ok('a phone that chose nothing gets the settings of the computer: its grid and its lane', first.driverGrid.boards[0].opt.cell === 'fuel' && first.driverLane === 3 && first.theme === 'dark' && same(api.ownSettings(), {}));
    const own = { cols: 1, rows: 1, boards: [board(1, 1, 1, 1, 'gap')] }, s1 = await api.setSettings({ driverGrid: own });
    ok('a grid saved on the phone stays on the phone (the computer is not asked to keep it), wins over the computer\'s, and shows as the phone\'s own', s1.driverGrid.boards[0].opt.cell === 'gap' && mine().driverGrid.boards[0].opt.cell === 'gap' && api.ownSettings().driverGrid.boards[0].opt.cell === 'gap' && (await api.getSettings()).driverGrid.boards[0].opt.cell === 'gap');
    const s2 = await api.setSettings({ driverGrid: null });
    ok('null takes it out again: the computer\'s grid shows, and nothing of it is left on the phone', s2.driverGrid.boards[0].opt.cell === 'fuel' && !('driverGrid' in mine()) && !('driverGrid' in api.ownSettings()) && (await api.getSettings()).driverGrid.boards[0].opt.cell === 'fuel');
    const s3 = await api.setSettings({ driverLane: 1, driverRemember: true });
    ok('the lane of the phone is its own too, and null (not remembering) takes it out so the computer\'s shows', s3.driverLane === 1 && mine().driverLane === 1 && (await api.setSettings({ driverLane: null })).driverLane === 3 && !('driverLane' in mine()) && mine().driverRemember === true);
    ok('other settings of the phone are not touched by taking one out', (await api.setSettings({ liveBoard: { design: 'R' }, driverGrid: own })).liveBoard.design === 'R' && (await api.setSettings({ driverGrid: null })).liveBoard.design === 'R' && mine().liveBoard.design === 'R');
    console.log(fails ? `\n${fails} FAILED` : '\nALL DRIVER GRID TESTS PASSED');
    process.exit(fails ? 1 : 0);
  })().catch(e => { console.log('FAIL ' + (e.stack || e)); process.exit(1); });
}
