// 1.11.0: the grid of the Leaderboard page. The pure rules (livegrid.js): a grid that always holds together, the old one or two boards read as a grid,
// boards that cover more cells, and what to draw; plus the places a leaderboard shows (rows.js range) and the two new settings of the Leaderboard widget.
const G = require('../renderer/livegrid.js');
const Rows = require('../renderer/rows.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const spots = g => g.boards.map(b => `${b.c}.${b.r}:${b.w}x${b.h}`).join(' ');
const board = (c, r, w = 1, h = 1, opt = {}) => ({ c, r, w, h, opt });

// ---- a grid that holds together ----
ok('nothing at all is a grid of one cell without a board', same(G.clean(null), { cols: 1, rows: 1, boards: [] }) && same(G.clean('x'), { cols: 1, rows: 1, boards: [] }));
ok('the size is a whole number from 1 to 6 columns and from 1 to 4 rows', same([G.clean({ cols: 9, rows: 9 }), G.clean({ cols: 0, rows: -3 }), G.clean({ cols: '3.7', rows: '2' }), G.clean({ cols: 'x', rows: null })].map(g => g.cols + 'x' + g.rows), ['6x4', '1x1', '3x2', '1x1']));
ok('...the limits are 6 and 4', G.MAXC === 6 && G.MAXR === 4);
{ const g = G.clean({ cols: 3, rows: 2, boards: [board(3, 2), board(1, 1), board(2, 1), board(2, 2)] });
  ok('the boards are kept in reading order, row by row', spots(g) === '1.1:1x1 2.1:1x1 2.2:1x1 3.2:1x1'); }
ok('a board whose corner is outside the grid is dropped; a board that sticks out is cut back', spots(G.clean({ cols: 2, rows: 2, boards: [board(3, 1), board(1, 3), board(0, 1), board(1, 1, 5, 5)] })) === '1.1:2x2');
ok('two boards on the same cell: the first stays, the later one is dropped', spots(G.clean({ cols: 3, rows: 1, boards: [board(1, 1, 2, 1), board(2, 1), board(3, 1)] })) === '1.1:2x1 3.1:1x1');
ok('what is not a board is ignored, a missing or odd settings object becomes an empty one', same(G.clean({ cols: 2, rows: 1, boards: [null, 5, 'x', { c: 1, r: 1, opt: [1] }, { c: 2, r: 1, opt: { design: 'D' } }] }).boards.map(b => b.opt), [{}, { design: 'D' }]));
{ const src = { cols: 2, rows: 1, boards: [board(1, 1, 1, 1, { design: 'A' })] }, g = G.clean(src); g.boards[0].opt.design = 'B';
  ok('cleaning gives a copy: the settings it came from are not changed', src.boards[0].opt.design === 'A'); }

// ---- the grid the settings ask for ----
ok('no saved grid and no old boards: one board with the classic table, as before', same(G.gridOf({}), { cols: 1, rows: 1, boards: [board(1, 1)] }) && same(G.gridOf(null), { cols: 1, rows: 1, boards: [board(1, 1)] }));
ok('the old settings: one board with its settings', same(G.gridOf({ liveBoard: { design: 'R1', colLast: true } }), { cols: 1, rows: 1, boards: [board(1, 1, 1, 1, { design: 'R1', colLast: true })] }));
ok('...two boards, one under the other, is a grid of 1 column and 2 rows', same(G.gridOf({ liveBoards: { count: 2 }, liveBoard: { design: 'A' }, liveBoard2: { design: 'B' } }), { cols: 1, rows: 2, boards: [board(1, 1, 1, 1, { design: 'A' }), board(1, 2, 1, 1, { design: 'B' })] }));
ok('...two boards side by side is a grid of 2 columns and 1 row', same(G.gridOf({ liveBoards: { count: 2, side: true }, liveBoard: {}, liveBoard2: { design: 'B' } }), { cols: 2, rows: 1, boards: [board(1, 1), board(2, 1, 1, 1, { design: 'B' })] }));
ok('a saved grid wins over the old settings', same(G.gridOf({ liveGrid: { cols: 4, rows: 1, boards: [board(1, 1), board(4, 1)] }, liveBoards: { count: 2 }, liveBoard2: { design: 'B' } }), { cols: 4, rows: 1, boards: [board(1, 1), board(4, 1)] }));
ok('a saved grid that is not a grid (a number, a list) is not used: the old boards are', same(G.gridOf({ liveGrid: 5, liveBoard: { design: 'R' } }), { cols: 1, rows: 1, boards: [board(1, 1, 1, 1, { design: 'R' })] }) && G.gridOf({ liveGrid: 'x' }).boards.length === 1);

// ---- what is where ----
const four = G.clean({ cols: 4, rows: 1, boards: [board(1, 1), board(2, 1), board(3, 1), board(4, 1)] });
ok('4 boards side by side: each cell has its board', four.boards.length === 4 && G.cells(four).every((x, i) => x.board && x.index === i && x.c === i + 1 && x.r === 1));
{ const g = G.clean({ cols: 3, rows: 2, boards: [board(1, 1, 2, 2), board(3, 1)] }), cs = G.cells(g);
  ok('a board that covers more cells is drawn once, at its corner; the cells it covers are not drawn on their own', cs.length === 3 && same(cs.map(x => (x.board ? 'B' + x.index : 'e') + x.c + '.' + x.r), ['B01.1', 'B13.1', 'e3.2']));
  ok('...a cell without a board is empty', cs[2].empty === true && !cs[2].board);
  ok('...boardAt finds the board that covers a cell, from any of its cells', G.boardAt(g, 2, 2) === g.boards[0] && G.boardAt(g, 1, 2) === g.boards[0] && G.boardAt(g, 3, 2) === null && G.boardAt(g, 3, 1) === g.boards[1]); }
ok('the size and the place in words', G.sizeText({ cols: 4, rows: 1 }) === '4 columns × 1 row' && G.sizeText({ cols: 1, rows: 2 }) === '1 column × 2 rows' && G.where(board(2, 3)) === 'column 2, row 3');

// ---- changes ----
ok('a bigger grid keeps the boards and adds empty cells', spots(G.resize(four, 4, 2)) === spots(four) && G.cells(G.resize(four, 4, 2)).filter(x => x.empty).length === 4);
ok('a smaller grid drops the boards outside it', spots(G.resize(four, 2, 1)) === '1.1:1x1 2.1:1x1');
{ const g = G.resize(G.clean({ cols: 3, rows: 2, boards: [board(1, 1, 3, 2)] }), 2, 1);
  ok('...and cuts a board that is bigger than the new grid back to fit', spots(g) === '1.1:2x1'); }
{ const g = G.add(G.clean({ cols: 2, rows: 1, boards: [] }), 2, 1, { design: 'D' });
  ok('a board for an empty cell', spots(g) === '2.1:1x1' && g.boards[0].opt.design === 'D');
  ok('...not for a cell that has a board, or one outside the grid (the grid comes back as it was)', G.add(g, 2, 1, {}) === g && G.add(g, 3, 1, {}) === g && G.add(g, 1, 2, {}) === g && G.add(g, 0, 1, {}) === g);
  ok('...and not for a cell that another board covers', (x => G.add(x, 2, 2, {}) === x)(G.clean({ cols: 2, rows: 2, boards: [board(1, 1, 2, 2)] }))); }
ok('a board is removed by its number', spots(G.remove(four, 1)) === '1.1:1x1 3.1:1x1 4.1:1x1' && G.remove(four, 9) === four && G.remove(four, -1) === four);
{ const g = G.clean({ cols: 4, rows: 2, boards: [board(1, 1), board(3, 1), board(1, 2)] });
  ok('how far a board can grow: over the free cells next to it, not over another board', same(G.maxSpan(g, g.boards[0]), { w: 2, h: 1 }) && same(G.maxSpan(g, g.boards[1]), { w: 2, h: 2 }) && same(G.maxSpan(g, g.boards[2]), { w: 4, h: 1 }));
  const w = G.setSpan(g, 0, 2, 1);
  ok('a board gets wider over free cells', spots(w) === '1.1:2x1 3.1:1x1 1.2:1x1' && w.boards[0].w === 2);
  ok('...but not over a board, and not out of the grid (nothing changes)', G.setSpan(g, 0, 3, 1) === g && G.setSpan(g, 0, 1, 2) === g && G.setSpan(g, 1, 3, 1) === g);
  ok('...taller works the same way', spots(G.setSpan(G.clean({ cols: 2, rows: 3, boards: [board(1, 1)] }), 0, 1, 3)) === '1.1:1x3');
  ok('...a number that is not a number leaves the size as it is', G.setSpan(g, 0, 'x', 'y') .boards[0].w === 1 && G.setSpan(g, 7, 1, 1) === g);
  ok('a smaller size is always possible', spots(G.setSpan(w, 0, 1, 1)) === '1.1:1x1 3.1:1x1 1.2:1x1');
  ok('...and the old grid is never changed by a change', spots(g) === '1.1:1x1 3.1:1x1 1.2:1x1' && g.boards[0].w === 1); }
{ const g = G.clean({ cols: 2, rows: 1, boards: [board(1, 1, 1, 1, { design: 'A', from: 5 })] }), g2 = G.setOpt(g, 0, { to: 8, design: 'B' });
  ok('settings of a board are merged into what it has', same(g2.boards[0].opt, { design: 'B', from: 5, to: 8 }) && g.boards[0].opt.design === 'A' && G.setOpt(g, 4, { to: 1 }) === g);
  ok('...or replaced', same(G.setOptAll(g, 0, { design: 'C' }).boards[0].opt, { design: 'C' })); }

// ---- the places a leaderboard shows (rows.js) ----
{ const list = [1, 2, 3, 4, 5, 6, 7, 8].map(pos => ({ pos }));
  const pos = o => Rows.range(list, o).map(x => x.pos).join();
  ok('no places chosen: everybody', Rows.range(list, undefined) === list && Rows.range(list, {}) === list && Rows.range(list, { from: 1, to: 0 }) === list && Rows.range(list, { from: '', to: '' }) === list);
  ok('places 5 to 8, or 1 to 4', pos({ from: 5, to: 8 }) === '5,6,7,8' && pos({ from: 1, to: 4 }) === '1,2,3,4');
  ok('...from a place to the last, or to a place from the first', pos({ from: 6 }) === '6,7,8' && pos({ to: 3 }) === '1,2,3');
  ok('...as text, as the input of a page gives it', pos({ from: '3', to: '4' }) === '3,4' && pos({ from: ' 7 ', to: '' }) === '7,8');
  ok('...more places than there are, or a "to" before the "from", is nobody or what there is', pos({ from: 7, to: 20 }) === '7,8' && pos({ from: 9, to: 12 }) === '' && pos({ from: 5, to: 2 }) === '' && pos({ from: 'x', to: 'y' }) === '1,2,3,4,5,6,7,8');
  ok('...the list it came from is not changed', list.length === 8); }

// ---- the Leaderboard widget has the two settings ----
{ const W = require('../renderer/widgets.js'), o = W.def('leaderboard').options, from = o.find(x => x.key === 'from'), to = o.find(x => x.key === 'to');
  ok('the Leaderboard widget has From place (1) and To place (0 = to the last), numbers from 0 or 1 to 99', from && to && from.type === 'number' && from.default === 1 && from.min === 1 && to.type === 'number' && to.default === 0 && to.min === 0 && to.max === 99 && from.max === 99);
  ok('...they apply to a row design and to the classic table (they are not "classic only" or "rows only")', !from.classic && !to.classic && !from.rowsOnly && !to.rowsOnly); }

// ---- 1.67.0: the board can count over all heats ----
{ const W = require('../renderer/widgets.js'), G = require('../renderer/livegrid.js'), fs = require('fs'), view = fs.readFileSync(__dirname + '/../renderer/liveview.js', 'utf8');
  const co = W.def('leaderboard').options.find(x => x.key === 'countOver');
  ok('the Leaderboard widget has "Count over": this race or heat (the standard, so every layout stays as it was) or all heats so far', !!co && co.type === 'select' && co.default === 'heat' && co.choices.map(c => c[0]).join() === 'heat,all' && /heat/i.test(co.choices[0][1]) && /all heats/i.test(co.choices[1][1]));
  ok('...it is not one of the classic-only settings (the board settings have their own choice for it, so it is not shown twice)', !co.classic);
  ok('...the board settings of the Live Race page have the choice, once, and a change is saved with the board (data-lb="countOver")', (view.match(/data-lb="countOver"/g) || []).length === 1 && /id="lb-over"/.test(view));
  const g0 = G.gridOf({ liveGrid: { cols: 1, rows: 1, boards: [{ c: 1, r: 1, w: 1, h: 1, opt: { from: 2, to: 4 } }] } }), g1 = G.gridOf({ liveGrid: G.setOpt(g0, 0, { countOver: 'all' }) });
  ok('...the grid keeps it with the board, and the other settings of the board stay', g1.boards.length === 1 && g1.boards[0].opt.countOver === 'all' && g1.boards[0].opt.from === 2 && g1.boards[0].opt.to === 4 && g0.boards[0].opt.countOver === undefined); }

// ---- the stylesheet and the page ----
{ const fs = require('fs'), css = fs.readFileSync(__dirname + '/../renderer/styles.css', 'utf8'), html = fs.readFileSync(__dirname + '/../renderer/index.html', 'utf8');
  ok('the boards sit in a grid, each in its own cells, and the classic table grows with its own board (not with the screen)', /\.lv-grid\{display:grid;gap:16px/.test(css) && /\.lv-grid \.lv-board\{min-width:0;container-type:inline-size\}/.test(css) && /\.lv-grid \.lv-board > table\{font-size:clamp\(13px,2\.4cqw,38px\)\}/.test(css));
  ok('...the picker has squares that light up, and the map of cells marks the selected board', /\.lv-gp\.on\{background:var\(--accent\)/.test(css) && /\.lv-gridpick\{display:grid;grid-template-columns:repeat\(6,28px\)/.test(css) && /\.lv-gcell\.sel\{border:2px solid var\(--accent\)/.test(css));
  ok('the page loads the grid rules before the Live Race pages', html.indexOf('livegrid.js') > 0 && html.indexOf('livegrid.js') < html.indexOf('liveview.js'));
  const view = fs.readFileSync(__dirname + '/../renderer/liveview.js', 'utf8');
  ok('...and the old one-or-two boards code is gone (no boardKey, no liveBoards count/side choice)', !/boardKey|lbcfg|lb-count|lb-side/.test(view)); }

console.log(fails ? fails + ' LIVE GRID TESTS FAILED' : 'ALL LIVE GRID TESTS PASSED');
process.exit(fails ? 1 : 0);
