// The grid of the Driver stats page (Live Race), 1.36.0. What the page shows about one driver is a grid of cells, set the way the Leaderboard page sets its boards (livegrid.js):
// you pick the grid with the little squares (up to 4 columns by 8 rows), give every cell a number, and a cell can cover more cells (wider, taller).
// Pure rules, no page and no settings store. The grid is { cols, rows, boards: [{ c, r, w, h, opt }] } as in livegrid.js, and opt = { cell, label }:
// cell says what the cell shows (a key of CELLS) and label whether its name is written above the number.
// - The grid is saved in the setting driverGrid. The computer's grid is the default for every device (the server hands the settings to the phones); a phone that changes
//   it keeps its own on that phone (webapi.js), and goes back to the computer's by dropping it. No grid saved at all: DEFAULT.
// - A cell can need something the race does not have (a swap signal in a race without driver swaps, fuel with Fuel off). Such a cell is left blank, and a row where
//   nothing is left to show is not drawn at all, so a phone does not waste a row on it (layout below).
// - The lane a device was on is remembered too (driverLane), unless the device is told not to (driverRemember).
(function (root) {
  const LG = typeof module !== 'undefined' ? require('./livegrid.js') : root.LiveGrid;
  const G = LG.make(4, 8);

  // What a cell can show. type: the widget that makes the number (widgets.js, drawn by timing.js) and opt its settings for the cell (the label above the number says the rest, so Laps to go
  // is just the number and Swap timer just the clock); own: a number that is made on the page itself; list: a list, not a number.
  // needs: what the race must have for the cell to show anything (a key of NEEDS).
  const GROUPS = ['Race', 'Swaps', 'Car', 'Track', 'Other'];
  const CELLS = [
    { key: 'position', label: 'Position', group: 'Race', type: 'position' },
    { key: 'lap', label: 'Lap', group: 'Race', type: 'lap' },
    { key: 'laptime', label: 'Lap time', group: 'Race', type: 'laptime' },
    { key: 'last', label: 'Last lap', group: 'Race', own: 'last' },
    { key: 'bestlap', label: 'Best lap', group: 'Race', type: 'bestlap' },
    { key: 'avglap', label: 'Average lap', group: 'Race', type: 'avglap' },
    { key: 'medlap', label: 'Median lap', group: 'Race', type: 'medlap' },
    { key: 'gap', label: 'Gap to leader', group: 'Race', type: 'gap' },
    { key: 'recordlap', label: 'Record lap time', group: 'Race', type: 'recordlap' },
    { key: 'speed', label: 'Speed', group: 'Race', type: 'speed' },
    { key: 'lapstogo', label: 'Laps to go', group: 'Race', type: 'lapstogo', needs: 'laps', opt: { show: 'number' } },
    { key: 'distance', label: 'Distance driven', group: 'Race', type: 'distance', needs: 'driven' },
    { key: 'distleft', label: 'Distance to go', group: 'Race', type: 'distleft', needs: 'togo' },
    { key: 'swapsignal', label: 'Swap signal', group: 'Swaps', type: 'swapsignal', needs: 'swaps' },
    { key: 'swaptimer', label: 'Swap timer', group: 'Swaps', type: 'swaptimer', needs: 'swaps', opt: { show: 'clock' } },
    { key: 'currentdriver', label: 'Current driver', group: 'Swaps', type: 'currentdriver' },
    { key: 'nextdriver', label: 'Next driver', group: 'Swaps', type: 'nextdriver', needs: 'swaps' },
    { key: 'fuel', label: 'Fuel', group: 'Car', type: 'fuel', needs: 'fuel' },
    { key: 'tyre', label: 'Tyres', group: 'Car', type: 'tyre', needs: 'tyres' },
    { key: 'tyrelife', label: 'Tyre life', group: 'Car', type: 'tyrelife', needs: 'tyrewear', opt: { look: 'cell' } },
    { key: 'tyreleft', label: 'Tyre laps left', group: 'Car', type: 'tyrelife', needs: 'tyrewear', opt: { look: 'number', showPct: false, showLeft: true, showGrip: false, showName: false, showBox: false } },
    { key: 'damage', label: 'Damage', group: 'Car', type: 'damage', needs: 'damage' },
    { key: 'pitstop', label: 'Pitstop time', group: 'Car', type: 'pitstop' },
    { key: 'penalty', label: 'Penalty', group: 'Car', type: 'penalty', needs: 'penalty' },
    { key: 'flag', label: 'Flag', group: 'Track', type: 'flag' },
    { key: 'lights', label: 'Start lights', group: 'Track', type: 'lights' },
    { key: 'champpoints', label: 'Points', group: 'Other', type: 'champpoints', needs: 'champ' },
    { key: 'laplist', label: 'Lap list', group: 'Other', type: 'lastlap', list: true, opt: { lapsPerColumn: 8, columns: 1, lapNumbers: true } }
  ];
  const NEEDS = {
    swaps: 'Shows in a race with driver swaps (Endurance Race).',
    fuel: 'Shows when Fuel is on in the race.', tyres: 'Shows when the race has a weather system.', tyrewear: 'Shows when the race has a Tyre Wear System.', damage: 'Shows when the Damage System is on.',
    penalty: 'Shows when Penalties are on.', champ: 'Shows in a championship race.',
    laps: 'Shows in a race with a number of laps or a distance.', driven: 'Shows when the lane has a length (Distance Racing).', togo: 'Shows in a race with a distance or laps and a lane length.'
  };
  const BY = {}; CELLS.forEach(c => { BY[c.key] = c; });
  const cellOf = key => (Object.prototype.hasOwnProperty.call(BY, key) ? BY[key] : null);

  // The grid until a device has its own (and the computer has saved one): the layout of the mock-up, a swap signal across the top, the position, the laps, the gaps, the swaps,
  // the car, the flag, and the list of laps at the bottom. Cells that the race does not need (no swaps, no fuel...) leave no gap.
  const b = (c, r, w, h, cell, label) => ({ c, r, w, h, opt: { cell, label: label !== false } });
  const DEFAULT_BOARDS = [
    b(1, 1, 4, 1, 'swapsignal', false),
    b(1, 2, 2, 2, 'position'), b(3, 2, 2, 1, 'last'), b(3, 3, 2, 1, 'bestlap'),
    b(1, 4, 2, 1, 'gap'), b(3, 4, 2, 1, 'lapstogo'),
    b(1, 5, 2, 1, 'swaptimer'), b(3, 5, 1, 1, 'fuel'), b(4, 5, 1, 1, 'damage'),
    b(1, 6, 2, 1, 'tyre'), b(3, 6, 2, 1, 'flag'),
    b(1, 7, 4, 2, 'laplist')
  ];

  // Any grid (from the settings, a file, a mistake) made into one that holds together: the rules of livegrid.js, and then only the cells it knows, with a cell and a label each.
  function clean(g) {
    const c = G.clean(g);
    return G.clean({ cols: c.cols, rows: c.rows, boards: c.boards.filter(x => cellOf(x.opt.cell)).map(x => ({ c: x.c, r: x.r, w: x.w, h: x.h, opt: { cell: x.opt.cell, label: x.opt.label !== false } })) });
  }
  const DEFAULT = () => clean({ cols: 4, rows: 8, boards: DEFAULT_BOARDS });
  // The grid the settings ask for: the saved one (an empty grid too: you may take every cell away), or DEFAULT when none was saved or what was saved is not a grid.
  const gridOf = s => (s && s.driverGrid && typeof s.driverGrid === 'object' && Array.isArray(s.driverGrid.boards) ? clean(s.driverGrid) : DEFAULT());

  // The changes. Each gives a new grid and leaves the old one alone; a change that cannot be made gives the grid back as it was.
  const next = (g, r) => (r === g ? g : clean(r)); // (a change that could not be made gives the same grid back)
  const resize = (g, cols, rows) => next(g, G.resize(g, cols, rows));
  const add = (g, c, r, key) => (cellOf(key) ? next(g, G.add(g, c, r, { cell: key, label: true })) : g);
  const remove = (g, i) => next(g, G.remove(g, i));
  const setSpan = (g, i, w, h) => next(g, G.setSpan(g, i, w, h));
  const setCell = (g, i, key) => (cellOf(key) ? next(g, G.setOpt(g, i, { cell: key })) : g);
  const setLabel = (g, i, on) => next(g, G.setOpt(g, i, { label: on !== false }));

  // What to draw. show(key) says whether a cell has something to show in this race. A row where no cell shows anything is left out (the rows after it move up), a cell that
  // shows nothing stays blank (quiet) in a row that is drawn, and a cell is as tall as the rows of it that are drawn (none: it is not drawn). Rows: how many rows are drawn.
  function layout(g, show) {
    const on = g.boards.map(x => !!show(x.opt.cell)), rows = [];
    for (let r = 1; r <= g.rows; r++) if (g.boards.some((x, i) => on[i] && r >= x.r && r < x.r + x.h)) rows.push(r);
    const cells = [];
    g.boards.forEach((x, i) => {
      const mine = rows.filter(r => r >= x.r && r < x.r + x.h);
      if (mine.length) cells.push({ index: i, key: x.opt.cell, label: x.opt.label !== false, c: x.c, w: x.w, r: rows.indexOf(mine[0]) + 1, h: mine.length, quiet: !on[i] });
    });
    return { cols: g.cols, rows: rows.length, cells };
  }
  const applies = (key, facts) => { const d = cellOf(key); return !!d && (!d.needs || !!(facts && facts[d.needs])); };

  // The lane to show: the one that is on (while it is in the race), else the one this device remembers, else the first. lanes: the lanes in the race.
  const laneFor = (lanes, current, saved) => (lanes.includes(current) ? current : lanes.includes(saved) ? saved : lanes.length ? lanes[0] : null);
  const rememberOn = s => !s || s.driverRemember !== false;
  const savedLane = s => (rememberOn(s) && s && Number.isInteger(s.driverLane) && s.driverLane >= 0 ? s.driverLane : null);

  const api = { MAXC: G.MAXC, MAXR: G.MAXR, GROUPS, CELLS, NEEDS, cellOf, DEFAULT, clean, gridOf, resize, add, remove, setSpan, setCell, setLabel, layout, applies, laneFor, rememberOn, savedLane,
    cells: G.cells, maxSpan: G.maxSpan, boardAt: G.boardAt, sizeText: G.sizeText, where: G.where };
  root.DriverGrid = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
