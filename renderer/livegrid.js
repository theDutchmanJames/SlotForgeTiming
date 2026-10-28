// The grid of the Leaderboard page (Live Race): which board sits in which cell. Pure rules, no page and no settings store.
// A grid is { cols, rows, boards: [{ c, r, w, h, opt }] }: c and r count from 1 (column, row), w and h are the cells a board covers,
// and opt are the settings of that board (the Leaderboard widget's settings: row design, columns, from and to position).
// A cell that no board covers is empty. The boards are kept in reading order (row by row), so "board 3" is always the third one you read.
(function (root) {
  'use strict';
  // make(maxColumns, maxRows) gives the rules for a grid of that most size. The Leaderboard and Home grids are 6 x 4 (the LiveGrid below); the Driver stats grid (drivergrid.js) is 4 x 8.
  function make(MAXC, MAXR) {
  const whole = (v, lo, hi, d) => { const n = Math.floor(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
  const plain = o => (o && typeof o === 'object' && !Array.isArray(o) ? { ...o } : {});
  const overlaps = (a, b) => a.c < b.c + b.w && b.c < a.c + a.w && a.r < b.r + b.h && b.r < a.r + a.h;
  const covers = (b, c, r) => c >= b.c && c < b.c + b.w && r >= b.r && r < b.r + b.h;
  const reading = (a, b) => a.r - b.r || a.c - b.c;

  // Any grid (from the settings, a file, a mistake) made into one that holds together: the size within the limits, every board inside the grid
  // (a board whose corner is outside is dropped, one that sticks out is cut back), no two boards on the same cell (the later one is dropped).
  function clean(g) {
    const cols = whole(g && g.cols, 1, MAXC, 1), rows = whole(g && g.rows, 1, MAXR, 1), boards = [];
    const list = (g && Array.isArray(g.boards) ? g.boards : []).filter(x => x && typeof x === 'object').map(x => ({ c: Math.floor(Number(x.c)), r: Math.floor(Number(x.r)), x }));
    list.sort(reading).forEach(({ c, r, x }) => {
      if (!(c >= 1 && c <= cols && r >= 1 && r <= rows)) return;
      const b = { c, r, w: whole(x.w, 1, cols - c + 1, 1), h: whole(x.h, 1, rows - r + 1, 1), opt: plain(x.opt) };
      if (!boards.some(o => overlaps(o, b))) boards.push(b);
    });
    return { cols, rows, boards };
  }

  // Before 1.11.0 the page had one or two boards (one under the other, or side by side): the same thing as a grid of 1 x 1, 1 x 2 or 2 x 1.
  function legacy(s) {
    const cfg = (s && s.liveBoards) || {}, two = cfg.count === 2, side = cfg.side === true;
    const first = { c: 1, r: 1, w: 1, h: 1, opt: plain(s && s.liveBoard) };
    if (!two) return { cols: 1, rows: 1, boards: [first] };
    return { cols: side ? 2 : 1, rows: side ? 1 : 2, boards: [first, { c: side ? 2 : 1, r: side ? 1 : 2, w: 1, h: 1, opt: plain(s && s.liveBoard2) }] };
  }
  // The grid the settings ask for (the saved grid, or the old one or two boards when none was saved yet).
  const gridOf = s => clean(s && s.liveGrid && typeof s.liveGrid === 'object' ? s.liveGrid : legacy(s));

  const boardAt = (g, c, r) => g.boards.find(b => covers(b, c, r)) || null;
  const fits = (g, b, w, h) => b.c + w - 1 <= g.cols && b.r + h - 1 <= g.rows && !g.boards.some(o => o !== b && overlaps({ c: b.c, r: b.r, w, h }, o));
  // The most columns and rows a board can cover where it is (the cells next to it must be free).
  function maxSpan(g, b) { let w = 1, h = 1; while (fits(g, b, w + 1, b.h)) w++; while (fits(g, b, b.w, h + 1)) h++; return { w, h }; }

  // What to draw, in reading order: a board at its corner cell, an empty cell where no board is, and nothing for the cells a bigger board covers.
  function cells(g) {
    const out = [];
    for (let r = 1; r <= g.rows; r++) for (let c = 1; c <= g.cols; c++) {
      const b = boardAt(g, c, r);
      if (!b) out.push({ empty: true, c, r });
      else if (b.c === c && b.r === r) out.push({ board: b, index: g.boards.indexOf(b), c, r });
    }
    return out;
  }

  // The changes. Each gives a new grid and leaves the old one alone; a change that cannot be made gives the grid back as it was.
  const resize = (g, cols, rows) => clean({ cols, rows, boards: g.boards });
  function add(g, c, r, opt) {
    if (!(c >= 1 && c <= g.cols && r >= 1 && r <= g.rows) || boardAt(g, c, r)) return g;
    return clean({ cols: g.cols, rows: g.rows, boards: [...g.boards, { c, r, w: 1, h: 1, opt: plain(opt) }] });
  }
  const remove = (g, i) => (g.boards[i] ? clean({ cols: g.cols, rows: g.rows, boards: g.boards.filter((_, j) => j !== i) }) : g);
  function setSpan(g, i, w, h) {
    const b = g.boards[i]; if (!b) return g;
    const nw = whole(w, 1, g.cols, b.w), nh = whole(h, 1, g.rows, b.h);
    if (!fits(g, b, nw, nh)) return g;
    return clean({ cols: g.cols, rows: g.rows, boards: g.boards.map((x, j) => (j === i ? { ...x, w: nw, h: nh } : x)) });
  }
  const setOpt = (g, i, patch) => (g.boards[i] ? clean({ cols: g.cols, rows: g.rows, boards: g.boards.map((x, j) => (j === i ? { ...x, opt: { ...x.opt, ...patch } } : x)) }) : g);
  const setOptAll = (g, i, opt) => (g.boards[i] ? clean({ cols: g.cols, rows: g.rows, boards: g.boards.map((x, j) => (j === i ? { ...x, opt: plain(opt) } : x)) }) : g);

  const sizeText = g => `${g.cols} ${g.cols === 1 ? 'column' : 'columns'} × ${g.rows} ${g.rows === 1 ? 'row' : 'rows'}`;
  const where = b => `column ${b.c}, row ${b.r}`;

  return { MAXC, MAXR, clean, legacy, gridOf, boardAt, maxSpan, cells, resize, add, remove, setSpan, setOpt, setOptAll, sizeText, where };
  }

  const api = make(6, 4);
  api.make = make;
  root.LiveGrid = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
