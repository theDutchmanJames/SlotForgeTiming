const Wd = require('../renderer/widgets.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const W = Wd.U, H = 562;
const box = (x, y, w, h) => ({ x, y, w, h });

// registry
ok('71 widgets in the register (1.62.0: Next Heat; 1.54.0: Pace meter; 1.43.0: Car Failure; 1.41.0: Available Tyres; 1.40.0: Tyre Degradation; 1.35.1: Swap Signal; 1.35.0: Distance Driven, Distance To Go, Laps To Go; 1.29.0: Lap to Lap Delta; 1.10.0: Damage, Repair Timer; 1.3.0: Balance of Power; 1.5.0: Tyres, Weather Forecast, Track Conditions; 1.7.0: Heat List; 1.8.0: Team Name, Team Picture; 1.9.0: Current Driver, Next Driver, Swap Timer)', Wd.REGISTRY.length === 71 && new Set(Wd.REGISTRY.map(d => d.type)).size === 71);
ok('every widget has sample content', Wd.REGISTRY.every(d => d.type === 'gap' ? true : String(Wd.sampleOf(d, 0)).length > 0));
ok('lane widgets are marked per lane', Wd.def('bestlap').perLane && !Wd.def('clock').perLane && !Wd.def('start').perLane);
ok('lap time widget has hold time and highlight colours', Wd.def('laptime').options.map(o => o.key).join() === 'holdSeconds,pbColor,recordColor');

// moving
let w = box(100, 100, 100, 50);
let m = Wd.moveWidget(w, 13, 7, [], W, H, true);
ok('snap on: moves to the 5-unit grid', m.x === 115 && m.y === 105);
m = Wd.moveWidget(w, 13, 7, [], W, H, false);
ok('snap off: moves freely', m.x === 113 && m.y === 107);
const other = box(300, 100, 100, 50);
m = Wd.moveWidget(box(180, 100, 100, 50), 18, 0, [other], W, H, true); // right edge -> 298, near other's left edge 300 (the magnet reaches 3 units, since 1.46.1)
ok('sticks to the left edge of a neighbour', m.x + 100 === 300);
m = Wd.moveWidget(box(420, 100, 100, 50), -18, 0, [other], W, H, true); // left edge -> 402, near other's right edge 400
ok('sticks to the right edge of a neighbour', m.x === 400);
m = Wd.moveWidget(box(300, 160, 100, 50), 0, -9, [other], W, H, true); // top -> 151, near other's bottom 150
ok('sticks below a neighbour', m.y === 150);
m = Wd.moveWidget(w, -500, -500, [], W, H, true);
ok('cannot leave the canvas (top-left)', m.x === 0 && m.y === 0);
m = Wd.moveWidget(w, 5000, 5000, [], W, H, true);
ok('cannot leave the canvas (bottom-right)', m.x === W - 100 && m.y === H - 50);
m = Wd.moveWidget(box(3, 3, 100, 50), 0, 0, [], W, H, true);
ok('sticks to the canvas edge', m.x === 0 && m.y === 0);

// resizing
let r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 43, 17, [], W, H, true);
ok('resize se snaps to the grid', r.x === 100 && r.y === 100 && r.w === 145 && r.h === 65);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'nw', -23, -11, [], W, H, false);
ok('resize nw keeps the opposite corner fixed', r.x === 77 && r.y === 89 && r.x + r.w === 200 && r.y + r.h === 150);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', -500, -500, [], W, H, true);
ok('cannot shrink below the minimum size', r.w === Wd.MIN && r.h === Wd.MIN && r.x === 100 && r.y === 100);
ok('the smallest size is 5 units, one grid step (0.5% of the width; it was 40 before 1.34.1)', Wd.MIN === 5 && Wd.MIN === Wd.GRID);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', -93, -43, [], W, H, false);
ok('a widget can be pulled in to 7 by 7 without snapping (a size under the old 40)', r.w === 7 && r.h === 7 && r.x === 100 && r.y === 100);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', -97, -47, [], W, H, true);
ok('...and with snapping to 5 by 5 (the grid step)', r.w === 5 && r.h === 5);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', -100, -50, [], W, H, false);
ok('...not smaller than 5: pulled to the corner it stops at 5 by 5', r.w === 5 && r.h === 5 && r.x === 100 && r.y === 100);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'nw', 300, 300, [], W, H, false);
ok('...the top left corner stops at 5 too, with the bottom right corner where it was', r.w === 5 && r.h === 5 && r.x === 195 && r.y === 145);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'ne', -300, 300, [], W, H, false);
ok('...and so do the other two corners', r.w === 5 && r.h === 5 && r.x === 100 && r.y === 145 && (r = Wd.resizeWidget(box(100, 100, 100, 50), 'sw', 300, -300, [], W, H, false), r.w === 5 && r.h === 5 && r.x === 195 && r.y === 100));
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 5000, 5000, [], W, H, true);
ok('cannot grow past the canvas', r.x + r.w === W && r.y + r.h === H);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 97, 0, [other], W, H, true); // right edge -> 297, magnet to 300 (the grid would say 295)
ok('resized edge sticks to a neighbour', r.x + r.w === 300);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'ne', 0, -44, [], W, H, true);
ok('resize ne moves the top edge up, the bottom stays put', r.x === 100 && r.y === 55 && r.w === 100 && r.h === 95 && r.y + r.h === 150);

// default layout
const L = Wd.defaultLayout();
ok('default layout: 16:9 with ' + L.widgets.length + ' widgets', L.ratioW === 16 && L.ratioH === 9 && L.widgets.length === 4 + 6 * 8 + 5);
ok('default layout: everything fits inside the canvas', L.widgets.every(g => g.x >= 0 && g.y >= 0 && g.x + g.w <= W && g.y + g.h <= Wd.heightOf(L)));
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
let clash = 0; for (let i = 0; i < L.widgets.length; i++) for (let j = i + 1; j < L.widgets.length; j++) if (overlap(L.widgets[i], L.widgets[j])) clash++;
ok('default layout: no widgets overlap', clash === 0);
ok('default layout: lane widgets cover lanes 1 to 6', [...new Set(L.widgets.filter(g => g.lane !== null).map(g => g.lane))].length === 6);
ok('heightOf follows the proportions', Wd.heightOf({ ratioW: 16, ratioH: 9 }) === 563 || Wd.heightOf({ ratioW: 16, ratioH: 9 }) === 562);

// ---- batch A ----
ok('grid is 5 units (finer than before)', Wd.GRID === 5);
ok('lanes go up to 8', Wd.LANES === 8);
// guidelines
let g = Wd.guidesFor(2, 'vertical', 1920, 1080);
ok('2 lanes: one vertical line in the middle (960 of 1920)', g.v.length === 1 && g.v[0] === 960 && g.h.length === 0);
g = Wd.guidesFor(3, 'vertical', 1920, 1080);
ok('3 lanes: lines at 640 and 1280', g.v.join() === '640,1280');
g = Wd.guidesFor(8, 'both', 1000, 562);
ok('8 lanes, both directions: 7 vertical and 7 horizontal lines', g.v.length === 7 && g.h.length === 7 && g.h[0] === 70.25);
ok('horizontal only', Wd.guidesFor(4, 'horizontal', 1000, 600).h.join() === '150,300,450' && Wd.guidesFor(4, 'horizontal', 1000, 600).v.length === 0);
const gd = { v: [500], h: [300] };
m = Wd.moveWidget(box(380, 100, 100, 50), 17, 0, [], W, H, true, gd); // right edge -> 497
ok('a widget\'s right edge sticks to a vertical guideline', m.x + 100 === 500);
m = Wd.moveWidget(box(520, 100, 100, 50), -17, 0, [], W, H, true, gd); // left edge -> 503
ok('a widget\'s left edge sticks to a vertical guideline', m.x === 500);
m = Wd.moveWidget(box(100, 245, 100, 50), 0, 6, [], W, H, true, gd);
ok('a widget\'s bottom edge sticks to a horizontal guideline', m.y + 50 === 300);
m = Wd.moveWidget(box(380, 100, 100, 50), 16, 0, [], W, H, false, gd);
ok('guidelines do nothing when snapping is off', m.x === 396);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 297, 0, [], W, H, true, gd);
ok('resizing an edge sticks to a guideline too', r.x + r.w === 500);
// ---- 1.46.1: a smaller magnet, the grid on its own (Ctrl), the lines that show an alignment, Tidy to grid ----
ok('1.46.1: the magnet reaches 3 units, less than one grid step (it was 8, wider than the grid, so the grid could not be reached near an edge)', Wd.MAG === 3 && Wd.MAG < Wd.GRID);
const far = box(300, 100, 100, 50);
m = Wd.moveWidget(box(180, 100, 100, 50), 19, 0, [far], W, H, true); // right edge 299: 1 away from 300
ok('...an edge 1 away is pulled', m.x + 100 === 300);
m = Wd.moveWidget(box(180, 100, 100, 50), 17, 0, [far], W, H, true); // right edge 297: 3 away, the very edge of the reach
ok('...an edge 3 away is still pulled', m.x + 100 === 300);
m = Wd.moveWidget(box(180, 100, 100, 50), 16, 0, [far], W, H, true); // right edge 296: 4 away
ok('...an edge 4 away is not: the grid has it (195 and 295)', m.x === 195 && m.x + 100 === 295);
const odd = box(302, 100, 100, 50); // an edge that is not on the grid (like most of the default layout)
m = Wd.moveWidget(box(180, 100, 100, 50), 19, 0, [odd], W, H, true); // right edge 299: the magnet says 302
ok('grid and magnets: an edge off the grid still pulls', m.x + 100 === 302);
m = Wd.moveWidget(box(180, 100, 100, 50), 19, 0, [odd], W, H, 'grid');
ok('the grid only (Ctrl held): the same drag lands on the grid, the magnets are off', m.x === 200 && m.y === 100);
m = Wd.moveWidget(box(180, 100, 100, 50), 19, 0, [odd], W, H, false);
ok('...and with snapping off it is still free', m.x === 199);
m = Wd.moveWidget(box(380, 100, 100, 50), 17, 0, [], W, H, 'grid', { v: [500], h: [] });
ok('the grid only ignores the guidelines too', m.x === 395);
m = Wd.moveWidget(box(3, 3, 100, 50), 0, 0, [], W, H, 'grid');
ok('the grid only ignores the page edge too (3 units from it goes to 5)', m.x === 5 && m.y === 5);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 99, 0, [box(302, 0, 10, 10)], W, H, 'grid');
ok('resizing with the grid only: the edge goes to the grid, not to the neighbour at 302', r.x + r.w === 300);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 99, 0, [box(302, 0, 10, 10)], W, H, true);
ok('...with the magnets on it goes to the neighbour', r.x + r.w === 302);
// the result is always on the grid or within 3 units of an edge that was offered
{
  let seed = 7, bad = 0; const rnd = n => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed % n; };
  for (let i = 0; i < 400; i++) {
    const o = box(rnd(800), rnd(400), 20 + rnd(150), 20 + rnd(100)), a = box(rnd(800), rnd(400), 20 + rnd(150), 20 + rnd(100));
    const p = Wd.moveWidget(a, rnd(60) - 30, rnd(60) - 30, [o], W, H, true), tx = [0, W, o.x, o.x + o.w], ty = [0, H, o.y, o.y + o.h];
    const okx = p.x % 5 === 0 || tx.some(t => Math.abs(t - p.x) < 0.001 || Math.abs(t - (p.x + a.w)) < 0.001) || p.x === W - a.w, oky = p.y % 5 === 0 || ty.some(t => Math.abs(t - p.y) < 0.001 || Math.abs(t - (p.y + a.h)) < 0.001) || p.y === H - a.h;
    if (!okx || !oky) bad++;
  }
  ok('400 random moves: a widget always ends on the grid or exactly on an edge it was pulled to', bad === 0);
}
m = Wd.moveWidget(box(140, 90, 210, 58), 0, 4.2331932773109235, [box(140, 155, 210, 58)], W, H, true);
ok('a position pulled by a magnet is a clean number (97, not 96.99999999999999, which a pixel to unit conversion gives)', m.y === 97);
// snap lines: where an edge lines up with another widget or a guideline
let sl = Wd.snapLines(box(300, 100, 100, 50), [box(300, 0, 50, 50), box(500, 150, 5, 5)], W, H, { v: [400], h: [] });
ok('snap lines: the left edge with a neighbour (300), the right edge with a guideline (400), the bottom with a neighbour (150)', sl.v.join() === '300,400' && sl.h.join() === '150');
sl = Wd.snapLines(box(301, 101, 100, 50), [box(300, 0, 50, 50)], W, H, { v: [], h: [] });
ok('...one unit off is not lined up: no lines', sl.v.length === 0 && sl.h.length === 0);
sl = Wd.snapLines(box(300.5, 100.5, 100, 50), [box(300, 0, 50, 50)], W, H, { v: [], h: [] });
ok('...half a unit off is not lined up either', sl.v.length === 0 && sl.h.length === 0);
sl = Wd.snapLines(box(299.999999, 100, 100, 50), [box(300, 0, 50, 50)], W, H, null);
ok('...but a rounding error of a millionth of a unit still is', sl.v.join() === '300');
sl = Wd.snapLines(box(100, 100, 100, 50), [box(400, 100, 30, 20)], W, H, null);
ok('...the top edge lines up with the top of a neighbour (a horizontal line at 100)', sl.h.join() === '100' && sl.v.length === 0);

sl = Wd.snapLines(box(0, 0, W, H), [], W, H, null);
ok('...the page\'s own edges get no line', sl.v.length === 0 && sl.h.length === 0);
sl = Wd.snapLines(box(100, 100, 100, 50), [box(100, 300, 40, 40), box(100, 400, 40, 40)], W, H, null);
ok('...two neighbours on the same line give one line', sl.v.join() === '100' && sl.h.length === 0);
// Tidy to grid: every edge to the nearest grid line, or the page's edge when that is closer
let t = Wd.tidy([box(10, 90, 60, 58), box(75, 90, 60, 58)], W, H);
ok('tidy: the edges go to the grid (90 + 58 = 148 becomes 150, so the height is 60)', t[0].x === 10 && t[0].y === 90 && t[0].w === 60 && t[0].h === 60 && t[1].x === 75 && t[1].h === 60);
t = Wd.tidy([box(10, 90, 58, 58), box(68, 90, 60, 58)], W, H);
ok('tidy: widgets that touched still touch (the edge at 68 goes to 70 for both)', t[0].x + t[0].w === 70 && t[1].x === 70);
t = Wd.tidy([box(100, 555, 50, 7)], W, H);
ok('tidy: 562 is closer to the bottom of the page (563) than to the grid (560), so it goes to 563', t[0].y + t[0].h === H);
t = Wd.tidy([box(100, 550, 50, 10)], W, H);
ok('...but an edge on the grid close to the page edge (560) stays where it is', t[0].y + t[0].h === 560);
t = Wd.tidy([box(11, 11, 1, 1)], W, H);
ok('tidy: a widget of 1 by 1 that would be 0 by 0 on the grid becomes 5 by 5, growing to the right and down', t[0].x === 10 && t[0].w === 5 && t[0].y === 10 && t[0].h === 5);
t = Wd.tidy([box(998, 560, 1, 1)], W, H);
ok('...and in the corner of the page it grows to the left and up instead', t[0].x === 995 && t[0].w === 5 && t[0].y === 555 && t[0].h === 5);
t = Wd.tidy([box(3.4, 555, 12, 8)], W, H);
ok('tidy: the page\'s own edge counts (the bottom 563 stays 563, not 565), and 3.4 goes to 5', t[0].x === 5 && t[0].y === 555 && t[0].y + t[0].h === H);
t = Wd.tidy([box(12, 12, 2, 2)], W, H);
ok('tidy: a widget never gets smaller than the smallest size', t[0].w >= Wd.MIN && t[0].h >= Wd.MIN);
t = Wd.tidy([box(997, 560, 3, 3)], W, H);
ok('tidy: ...also in the corner of the page, where it cannot grow outwards', t[0].w >= Wd.MIN && t[0].h >= Wd.MIN && t[0].x + t[0].w <= W && t[0].y + t[0].h <= H && t[0].x >= 0 && t[0].y >= 0);
{
  const dl = Wd.defaultLayout(), once = Wd.tidy(dl.widgets, W, Wd.heightOf(dl));
  const twice = Wd.tidy(once, W, Wd.heightOf(dl));
  ok('tidy on the default layout: every edge is on the grid or the page\'s edge', once.every(q => [q.x, q.y, q.x + q.w, q.y + q.h].every((v, i) => v % 5 === 0 || v === (i % 2 ? Wd.heightOf(dl) : W))));
  ok('...it stays inside the page, nothing is smaller than the smallest size', once.every(q => q.x >= 0 && q.y >= 0 && q.x + q.w <= W && q.y + q.h <= Wd.heightOf(dl) && q.w >= Wd.MIN && q.h >= Wd.MIN));
  ok('...doing it a second time changes nothing', JSON.stringify(once) === JSON.stringify(twice));
  let clash2 = 0; for (let i = 0; i < once.length; i++) for (let j = i + 1; j < once.length; j++) if (overlap(once[i], once[j])) clash2++;
  ok('...and no widget runs into another one that it did not touch before', clash2 === 0);
}
// ---- 1.47.0: align, spread out, mirror, resize several widgets at once ----
{
  const A = box(100, 100, 50, 20), B = box(300, 160, 80, 30), C = box(200, 130, 60, 40), sel3 = [A, B, C], bb = Wd.bbox(sel3); // bb = 100,100 to 380,190
  const col = (list, k) => list.map(q => q[k]).join();
  ok('align left: every left edge goes to the left edge of the selection', col(Wd.alignRects(sel3, 'left', bb), 'x') === '100,100,100');
  ok('align right: every right edge goes to the right edge of the selection (380)', Wd.alignRects(sel3, 'right', bb).every((q, i) => q.x + q.w === 380));
  ok('align center: the middle of every widget is the middle of the selection (240)', Wd.alignRects(sel3, 'center', bb).every(q => q.x + q.w / 2 === 240));
  ok('align top, bottom and middle work the same way down the page', col(Wd.alignRects(sel3, 'top', bb), 'y') === '100,100,100' && Wd.alignRects(sel3, 'bottom', bb).every(q => q.y + q.h === 190) && Wd.alignRects(sel3, 'middle', bb).every(q => q.y + q.h / 2 === 145));
  ok('aligning across leaves the places down and the sizes alone', col(Wd.alignRects(sel3, 'left', bb), 'y') === '100,160,130' && col(Wd.alignRects(sel3, 'left', bb), 'w') === '50,80,60');
  ok('...nothing is changed in the widgets themselves (new places are returned)', A.x === 100 && B.x === 300 && C.x === 200);
  { const q = Wd.alignRects([box(10, 10, 51, 20)], 'center', { x: 0, y: 0, w: W, h: H })[0]; ok('one widget lines up with the page: centered (474.5 across, in hundredths)', q.x === 474.5 && q.y === 10); }
  { const q = Wd.alignRects([box(10, 10, 100, 50)], 'bottom', { x: 0, y: 0, w: W, h: H })[0]; ok('...and to the bottom of the page', q.y + 50 === H); }
  // spread out
  let d3 = Wd.distributeRects([box(0, 0, 50, 20), box(60, 0, 50, 20), box(300, 0, 50, 20)], 'x');
  ok('spread out across: the outer two stay, the one between goes in the middle (the gaps are 100 and 100)', d3.map(q => q.x).join() === '0,150,300');
  d3 = Wd.distributeRects([box(300, 0, 50, 20), box(0, 0, 50, 20), box(60, 0, 50, 20)], 'x');
  ok('...the order of the list does not matter, the answers come back in the order of the list', d3.map(q => q.x).join() === '300,0,150');
  d3 = Wd.distributeRects([box(0, 0, 10, 20), box(20, 0, 40, 20), box(70, 0, 70, 20), box(300, 0, 20, 20)], 'x');
  const gaps = [...d3].sort((a, b) => a.x - b.x).map((q, i, a) => (i ? q.x - (a[i - 1].x + a[i - 1].w) : null)).filter(v => v !== null);
  ok('...widgets of different widths get the same gap between them (4 widgets, 3 equal gaps)', gaps.every(v => Math.abs(v - gaps[0]) < 0.011) && d3.map(q => q.x).sort((a, b) => a - b)[0] === 0 && Math.max(...d3.map(q => q.x + q.w)) === 320);
  ok('spread out down uses the heights', Wd.distributeRects([box(0, 0, 50, 20), box(0, 10, 50, 20), box(0, 300, 50, 20)], 'y').map(q => q.y).join() === '0,150,300');
  ok('wider together than the room: there is no gap, so nothing is done (null)', Wd.distributeRects([box(0, 0, 200, 20), box(100, 0, 200, 20), box(250, 0, 50, 20)], 'x') === null);
  ok('two widgets cannot be spread out: they come back as they are', Wd.distributeRects([box(0, 0, 50, 20), box(60, 0, 50, 20)], 'x').map(q => q.x).join() === '0,60');
  // mirror
  let mr = Wd.mirrorRects([A, B], 'sel-x', W, H); // box 100..380
  ok('mirror in the selection: left to right inside the box that holds them (100..380)', mr[0].x === 330 && mr[1].x === 100 && mr[0].y === 100 && mr[1].y === 160 && mr[0].w === 50 && mr[1].w === 80);
  ok('...mirroring twice gives the places back', JSON.stringify(Wd.mirrorRects(mr, 'sel-x', W, H)) === JSON.stringify([A, B].map(q => ({ x: q.x, y: q.y, w: q.w, h: q.h }))));
  mr = Wd.mirrorRects([A, B], 'page-x', W, H);
  ok('mirror across the page: each widget goes to the other side of the middle (1000 - x - w)', mr[0].x === 850 && mr[1].x === 620 && mr[0].y === 100 && mr[1].y === 160);
  ok('...and stays on the page, whatever its place', Wd.mirrorRects([box(0, 0, 40, 10), box(960, 0, 40, 10)], 'page-x', W, H).map(q => q.x).join() === '960,0');
  mr = Wd.mirrorRects([A, B], 'sel-y', W, H); // box 100..190 down
  ok('flip top to bottom inside the selection (100..190)', mr[0].y === 170 && mr[1].y === 100 && mr[0].x === 100 && mr[1].x === 300);
  // the settings that go with a mirrored widget
  { const q = { type: 'laptime', title: '', titleAlign: '', valueAlign: '' };
    let ms = Wd.mirrorSettings(q);
    ok('mirrored: a title on the left (the standard) goes right, a text in the center stays', ms.titleAlign === 'right' && ms.valueAlign === undefined);
    ms = Wd.mirrorSettings({ type: 'laptime', titleAlign: 'right', valueAlign: 'left' });
    ok('...right becomes left and left becomes right', ms.titleAlign === 'left' && ms.valueAlign === 'right');
    ok('...a Leaderboard has only a title alignment', Wd.mirrorSettings({ type: 'leaderboard', valueAlign: 'left' }).valueAlign === undefined && Wd.mirrorSettings({ type: 'leaderboard' }).titleAlign === 'right');
    ok('...a title or a text in the center gives no key at all (nothing to change)', Wd.mirrorSettings({ type: 'laptime', titleAlign: 'center' }).titleAlign === undefined && Wd.mirrorSettings({ type: 'laptime', valueAlign: 'center' }).valueAlign === undefined);
    ok('...a button has none of it', Object.keys(Wd.mirrorSettings({ type: 'start' })).length === 0);
    ok('...a slotcar picture flips its picture (Mirror on, then off again), without touching its other settings', (() => { const w1 = { type: 'carpicture', opt: { zoom: 3 } }, a = Wd.mirrorSettings(w1), b = Wd.mirrorSettings({ ...w1, ...a }); return a.opt.carMirror === true && a.opt.zoom === 3 && b.opt.carMirror === false && w1.opt.carMirror === undefined; })());
    ok('...an avatar flips avatarMirror, the race flag flips its flag and its pictures', Wd.mirrorSettings({ type: 'avatar' }).opt.avatarMirror === true && (() => { const o = Wd.mirrorSettings({ type: 'flag' }).opt; return o.flagMirror === true && o.imageMirror === true; })());
    ok('...a widget with no picture to flip gets no opt', Wd.mirrorSettings({ type: 'laptime' }).opt === undefined);
    const w2 = { type: 'laptime', titleAlign: 'right' }, once = Wd.mirrorSettings(w2), twice = Wd.mirrorSettings({ ...w2, ...once });
    ok('...mirroring twice reads as it did at the start', Wd.titleAlignOf({ ...w2, ...once, ...twice }) === 'right' && Wd.valueAlignOf({ ...w2, ...once, ...twice }) === 'center');
  }
  // resizing several at once
  const grp = [box(100, 100, 100, 50), box(250, 100, 50, 50)], g0 = Wd.bbox(grp);
  let sg = Wd.scaleGroup(grp, g0, { x: 100, y: 100, w: 402, h: 100 }, true, W, H);
  ok('resizing the selection: the box is 2.01 times as wide and twice as high, the edges follow (left edges on the grid, the box edge exactly)', sg[0].x === 100 && sg[0].w === 200 && sg[1].x === 400 && sg[1].x + sg[1].w === 502 && sg[0].h === 100 && sg[1].h === 100);
  sg = Wd.scaleGroup(grp, g0, { x: 100, y: 100, w: 402, h: 100 }, false, W, H);
  ok('...without snapping the edges go to whole units, not to the grid (a left edge at 250 goes to 401 or 402, the grid says 400)', sg.every(q => Number.isInteger(q.x) && Number.isInteger(q.w)) && sg[1].x % 5 !== 0 && Math.abs(sg[1].x - 401.5) <= 0.5);
  sg = Wd.scaleGroup([box(103, 101, 97, 49), box(251, 101, 49, 49)], { x: 103, y: 101, w: 197, h: 49 }, { x: 103, y: 101, w: 197, h: 49 }, true, W, H);
  ok('...a box that did not change size leaves the widgets alone (nothing jumps to the grid)', sg[0].x === 103 && sg[0].y === 101 && sg[1].x === 251 && sg[1].w === 49);
  sg = Wd.scaleGroup([box(100, 100, 100, 50), box(250, 100, 50, 50)], { x: 100, y: 100, w: 200, h: 50 }, { x: 52, y: 100, w: 248, h: 50 }, true, W, H);
  ok('...the edge of the box that was pulled to a place off the grid (a magnet) is kept exactly (52), the other edges go to the grid', sg[0].x === 52 && sg[1].x + sg[1].w === 300 && sg[1].x % 5 === 0);
  sg = Wd.scaleGroup([box(103, 101, 97, 49)], { x: 103, y: 101, w: 97, h: 49 }, { x: 203, y: 151, w: 97, h: 49 }, true, W, H);
  ok('...a box that only moved moves the widgets by the same amount', sg[0].x === 203 && sg[0].y === 151);
  sg = Wd.scaleGroup(grp, g0, { x: 100, y: 100, w: 5, h: 5 }, true, W, H);
  ok('...squeezed to nothing no widget gets smaller than the smallest size, or leaves the page', sg.every(q => q.w >= Wd.MIN && q.h >= Wd.MIN && q.x >= 0 && q.y >= 0 && q.x + q.w <= W && q.y + q.h <= H));
  sg = Wd.scaleGroup([box(900, 500, 100, 50), box(950, 530, 50, 33)], { x: 900, y: 500, w: 100, h: 50 }, { x: 900, y: 500, w: 300, h: 300 }, true, W, H);
  ok('...grown past the page the widgets stop at the page', sg.every(q => q.x + q.w <= W && q.y + q.h <= H));
}
ok('widget names and folders as chosen (11 folders, the Slotcar folder holds the car widgets, every name says what it shows)', (() => { const g = {}; Wd.REGISTRY.filter(d => !d.hidden).forEach(d => (g[d.group] = g[d.group] || []).push(d.label)); return JSON.stringify(g) === JSON.stringify({
  Race: ['Race Clock', 'Race Lap Counter', 'Token Clock', 'Start Lights', 'Race Flag', 'Race Info', 'Leaderboard', 'Heat List', 'Next Heat', 'Logo'],
  Driver: ['Driver Name', 'Driver Nickname', 'Driver Callsign', 'Driver Avatar', 'Driver Flag', 'Lane Colour'],
  Slotcar: ['Slotcar Picture', 'Slotcar Name', 'Fuel Level', 'Damage', 'Repair Timer', 'Car Failure', 'Penalty Points', 'Balance of Power', 'Slotcar Speed'],
  'Team and Swaps': ['Team Name', 'Team Picture', 'Current Driver', 'Next Driver', 'Driver Swap Timer', 'Driver Swap Signal'],
  'Position and Progress': ['Position in Race', 'Gap to Leader', 'Lap Number', 'Laps To Go', 'Distance Driven', 'Distance To Go', 'Championship Points'],
  'Lap Times and Records': ['Current Lap Time', 'Lap Times List', 'Best Lap (this session)', 'Average Lap', 'Median Lap', 'Pitstop Time', 'Personal Best Lap', 'Session Record Lap', 'Track Record'],
  'Delta Timers': ['Lap Time Delta', 'Lap to Lap Delta', 'Average Lap Delta', 'Median Lap Delta', 'Best Lap Delta', 'Personal Best Delta', 'Pitstop Time Delta', 'Session Record Delta', 'Track Record Delta'],
  Tyres: ['Current Tyres', 'Tyre Degradation', 'Pace meter', 'Available Tyres'],
  Weather: ['Weather Forecast', 'Track Conditions'],
  Controls: ['Start Button', 'Pause / Resume Button', 'Stop Button', 'Yellow Flag Button', 'Red Flag Button'] }); })());
ok('renamed widgets keep the title they showed in existing layouts', Wd.titleOf({ type: 'bestlap', title: '' }) === 'Best lap' && Wd.titleOf({ type: 'fuel', title: '' }) === 'Fuel' && Wd.titleOf({ type: 'position', title: '' }) === 'Position' && Wd.titleOf({ type: 'sessionrecord', title: '' }) === 'Session record lap');
ok('1.42.1: the 19 widgets with a new name show the title they showed before (so a saved layout looks the same)', (() => {
  const want = { nickname: 'Nickname', name: 'Name', callsign: 'Callsign', avatar: 'Avatar', swaptimer: 'Swap timer', swapsignal: 'Swap signal', carname: 'Slotcar', lap: 'Lap', laptime: 'Lap time', lastlap: 'Last lap', recordlap: 'Record lap time', dlaptime: 'Laptime delta', racelaps: 'Race laps', tyre: 'Tyres', start: 'Start', pause: 'Pause / Resume', stop: 'Stop', yellow: 'Yellow flag', red: 'Red flag' };
  return Object.keys(want).every(t => Wd.titleOf({ type: t, title: '' }) === want[t]) && Object.keys(want).length === 19;
})());
ok('1.42.1: every folder of the Add widget list is in the fixed order of the palette (none lands at the end), and there are 71 widgets', (() => {
  const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'renderer', 'editor.js'), 'utf8');
  const order = (src.match(/const GROUP_ORDER = \[([^\]]*)\]/) || [, ''])[1].split(',').map(x => x.trim().replace(/^'|'$/g, '')).filter(Boolean);
  const groups = [...new Set(Wd.REGISTRY.map(d => d.group))];
  return Wd.REGISTRY.length === 71 && groups.every(g => order.includes(g)) && order.join() === 'Race,Driver,Slotcar,Team and Swaps,Position and Progress,Lap Times and Records,Delta Timers,Tyres,Weather,Custom,Controls'
    && groups.join() === order.filter(g => groups.includes(g)).join();
})());
// groups
const grp = [box(100, 100, 50, 50), box(300, 200, 100, 80)];
ok('group box surrounds every widget', JSON.stringify(Wd.bbox(grp)) === JSON.stringify({ x: 100, y: 100, w: 300, h: 180 }));
m = Wd.moveWidget(Wd.bbox(grp), -500, 0, [], W, H, true, gd);
ok('a group stops at the canvas edge as a whole', m.x === 0);
// lane colours
const lay = { laneColors: [{ text: '#111111', bg: '#eeeeee' }, { text: '', bg: '#00ff00' }] };
ok('widget colour wins over lane colour', JSON.stringify(Wd.colorsOf({ lane: 0, textColor: '#ff0000', bgColor: '' }, lay)) === JSON.stringify({ color: '#ff0000', bg: '#eeeeee' }));
ok('lane colour applies when the widget has none', JSON.stringify(Wd.colorsOf({ lane: 1, textColor: '', bgColor: '' }, lay)) === JSON.stringify({ color: '', bg: '#00ff00' }));
ok('widgets without a lane use the theme', JSON.stringify(Wd.colorsOf({ lane: null, textColor: '', bgColor: '' }, lay)) === JSON.stringify({ color: '', bg: '' }));
ok('layouts without lane colours still work', Wd.colorsOf({ lane: 0, textColor: '', bgColor: '' }, {}).bg === '' && Wd.colorsOf({ lane: 0, textColor: '', bgColor: '' }, undefined).color === '');
// titles
const gw = Wd.newWidget('bestlap', 0, 0, 0);
ok('new widgets show their name as the title', Wd.showTitleOf(gw) && Wd.titleOf(gw) === 'Best lap');
ok('titles can be renamed', Wd.titleOf({ ...gw, title: '  Fastest  ' }) === 'Fastest');
ok('titles can be hidden; old widgets without the setting still show one', !Wd.showTitleOf({ ...gw, showTitle: false }) && Wd.showTitleOf({ type: 'bestlap', lane: 0 }));
ok('buttons never show a title', !Wd.showTitleOf(Wd.newWidget('start', null, 0, 0)));
ok('lap time widget title is short', Wd.titleOf(Wd.newWidget('laptime', 0, 0, 0)) === 'Lap time');
// duplicating for the next lane
const a = { ...Wd.newWidget('bestlap', 2, 100, 100), w: 150, h: 60 };
let cp = Wd.duplicateWidgets([a], null, W, H);
ok('duplicate: next lane, directly below by default', cp.length === 1 && cp[0].lane === 3 && cp[0].x === 100 && cp[0].y === 170 && cp[0].id !== a.id);
ok('duplicate leaves the original untouched', a.lane === 2 && a.y === 100);
const step = Wd.stepFrom(Wd.bbox([a]), [{ ...cp[0], x: 260, y: 100 }]);
ok('the step is what you moved the copy by', step.x === 160 && step.y === 0);
cp = Wd.duplicateWidgets([{ ...a, lane: 3 }], step, W, H);
ok('the next duplicate repeats that step on the next lane', cp[0].lane === 4 && cp[0].x === 260 && cp[0].y === 100);
cp = Wd.duplicateWidgets([{ ...a, lane: 7 }], null, W, H);
ok('lane 8 is the last lane', cp[0].lane === 7);
cp = Wd.duplicateWidgets([Wd.newWidget('clock', null, 10, 10)], null, W, H);
ok('widgets without a lane duplicate without one', cp[0].lane === null);
cp = Wd.duplicateWidgets([{ ...a, y: 520 }], null, W, H);
ok('a copy never leaves the canvas', cp[0].y + cp[0].h <= H);
cp = Wd.duplicateWidgets([a, { ...Wd.newWidget('name', 2, 300, 120), w: 100, h: 40 }], null, W, H);
ok('a group duplicates together, one step below the whole group', cp.length === 2 && cp.every(c => c.lane === 3) && cp[0].y === 170 && cp[1].y === 190 && cp[0].x === 100 && cp[1].x === 300);
// picture framing
ok('default frame is centred, no zoom', JSON.stringify(Wd.frameOf(null)) === '{"zoom":1,"x":0,"y":0}' && Wd.frameTransform(null) === 'translate(0%, 0%) scale(1)');
ok('zoom is kept between 1 and 4', Wd.zoomFrame(null, 9).zoom === 4 && Wd.zoomFrame(null, 0.2).zoom === 1 && Wd.zoomFrame({ zoom: 2, x: 0.5 }, 3).x === 0.5);
ok('at maximum pan the picture edge meets the frame edge (zoom 2: half the frame)', Wd.frameTransform({ zoom: 2, x: 1, y: -1 }) === 'translate(50%, -50%) scale(2)');
ok('dragging right moves the picture right, by the same distance', Wd.panFrame({ zoom: 2 }, 0.1, 0).x === 0.2 && Wd.panFrame({ zoom: 3 }, 0.1, 0).x === 0.1);
ok('the picture cannot be dragged past its edge', Wd.panFrame({ zoom: 2, x: 0.9 }, 0.5, 0).x === 1 && Wd.panFrame({ zoom: 2 }, 0, -9).y === -1);
ok('without zoom there is nothing to move', Wd.panFrame({ zoom: 1 }, 0.3, 0.3).x === 0);
ok('the Avatar widget has a picture position setting', Wd.def('avatar').options.some(o => o.key === 'frame' && o.type === 'frame'));
ok('colours: plain colours pass, anything that could break out of a style does not', ['#a45cff', 'var(--accent)', 'rgb(1, 2, 3)', 'red', 'transparent'].every(c => Wd.cssVal(c) === c) && ['red" onmouseover="x', 'a;b', 'url(x)', '<b>', 'x}{y', ''].every(c => Wd.cssVal(c) === ''));
const evil = 'red" onmouseover="alert(1)';
ok('a damaged colour never reaches the page: fuel, leaderboard rows, start lights', !Wd.fuelHtml(5, 100, { critColor: evil }).includes('onmouseover') && !Wd.leaderHtml([{ pos: 1, name: 'A', bg: evil, color: evil }], {}).includes('onmouseover') && !Wd.lightsHtml(5, null, evil).includes('onmouseover'));
ok('...while a normal colour is still used', Wd.fuelHtml(5, 100, { critColor: '#ff0000' }).includes('background:#ff0000') && Wd.leaderHtml([{ pos: 1, name: 'A', bg: '#112233', color: '#fff' }], {}).includes('background:#112233;color:#fff') && Wd.lightsHtml(5, null, '#00ff00').includes('fill:#00ff00'));
// the Logo widget and the club logo from App Settings
{
  const logoW = opt => ({ type: 'logo', opt });
  ok('a Logo widget without a picture uses the club logo', Wd.resolveOpt(logoW({}), [], 'CLUB').image === 'CLUB' && Wd.resolveOpt({ type: 'logo' }, [], 'CLUB').image === 'CLUB' && Wd.resolveOpt(logoW(undefined), [], 'CLUB').image === 'CLUB');
  ok('...a picture of its own wins', Wd.resolveOpt(logoW({ image: 'OWN' }), [], 'CLUB').image === 'OWN');
  ok('...its other settings stay', Wd.resolveOpt(logoW({ fit: 'cover' }), [], 'CLUB').fit === 'cover');
  ok('...without a club logo nothing is added', !Wd.resolveOpt(logoW({}), [], '').image && !Wd.resolveOpt(logoW({}), []).image && !Wd.resolveOpt(logoW({}), [], undefined).image);
  ok('the widget\'s own settings are not changed', (() => { const w = logoW({ fit: 'contain' }); Wd.resolveOpt(w, [], 'CLUB'); return !('image' in w.opt); })());
  ok('only the Logo widget takes the club logo', ['imagelane', 'imagerace', 'flag', 'fuel', 'lights', 'textrace'].every(t => !Wd.resolveOpt({ type: t, opt: {} }, [], 'CLUB').image));
  ok('picture sets still work, with or without a club logo', Wd.resolveOpt({ type: 'lights', opt: { imageSet: 'S' } }, [{ id: 'S', kind: 'lights', images: { on: 'ON', off: 'OFF' } }], 'CLUB').lightOn === 'ON' && Wd.resolveOpt({ type: 'lights', opt: { imageSet: 'S' } }, [{ id: 'S', kind: 'lights', images: { on: 'ON', off: 'OFF' } }]).lightOff === 'OFF');
  const imgOpt = Wd.def('logo').options.find(o => o.key === 'image');
  ok('the picture setting of the Logo widget says the club logo is the fallback', imgOpt.type === 'image' && imgOpt.fallback === 'clubLogo');
  ok('the layout editor draws a Logo widget without a picture with the club logo', Wd.sampleOf(Wd.def('logo'), 0, { ...logoW({}), opt: Wd.resolveOpt(logoW({}), [], 'CLUB') }).includes('src="CLUB"') && Wd.sampleOf(Wd.def('logo'), 0, { ...logoW({}), opt: Wd.resolveOpt(logoW({}), [], '') }).includes('Image'));
}
// the picture grid of a Start lights set
{
  const rows = Wd.LIGHT_ROWS.map(r => r[0]), cols = Wd.LIGHT_COLS.map(c => c[0]);
  ok('the lights grid has the rows off, on and the seven race states, and the columns all lights and lights 1 to 5', rows.join() === 'off,on,ready,running,paused,between,finished,yellow,red' && cols.join() === ',1,2,3,4,5' && Wd.LIGHT_ROWS.every(r => r[1]) && Wd.LIGHT_COLS[0][1] === 'All lights' && Wd.LIGHT_COLS[3][1] === 'Light 3');
  ok('a picture is stored under its row, or the row and the number of the light', Wd.lightKey('yellow', '') === 'yellow' && Wd.lightKey('yellow', '3') === 'yellow_3' && Wd.lightKey('on', '1') === 'on_1');
  ok('for a lit light in a race state the keys run: this state\'s light, this state, and nowhere else (1.28.1: the Countdown pictures are only for the countdown)', Wd.lightKeys('yellow', 1, true).join() === 'yellow_2,yellow' && Wd.lightKeys('red', 4, true).join() === 'red_5,red' && Wd.lightKeys('running', 0, true).join() === 'running_1,running');
  ok('...for the countdown and for a state that has no row: Light on of the light, Light on', Wd.lightKeys('countdown', 0, true).join() === 'on_1,on' && Wd.lightKeys('somethingelse', 4, true).join() === 'on_5,on');
  ok('...and for a light that is off: Light off of the light, Light off', Wd.lightKeys('yellow', 4, false).join() === 'off_5,off' && Wd.lightKeys('countdown', 0, false).join() === 'off_1,off');
  const im = { on: 'ON', off: 'OFF', yellow: 'Y', yellow_2: 'Y2', on_3: 'ON3' };
  ok('the picture of a light: the first key that has one; a race state with no picture of its own has none (a plain round light), the Countdown one is for the countdown', [0, 1, 2, 3, 4].map(i => Wd.lightPic(im, 'yellow', i, true)).join() === 'Y,Y2,Y,Y,Y' && [0, 1, 2, 3, 4].map(i => Wd.lightPic(im, 'red', i, true)).join() === ',,,,' && [0, 1, 2, 3, 4].map(i => Wd.lightPic(im, 'countdown', i, true)).join() === 'ON,ON,ON3,ON,ON' && Wd.lightPic(im, 'red', 0, false) === 'OFF' && Wd.lightPic({}, 'red', 0, true) === '' && Wd.lightPic(null, 'red', 0, true) === '');
  ok('what an empty cell of the grid uses (to show it dimmed): the "All lights" picture of its own row, or nothing; no row borrows from another', Wd.lightBehind(im, 'yellow_3') === 'yellow' && Wd.lightBehind(im, 'red_3') === '' && Wd.lightBehind(im, 'red_1') === '' && Wd.lightBehind(im, 'red') === '' && Wd.lightBehind(im, 'on_2') === 'on' && Wd.lightBehind(im, 'off_2') === 'off' && Wd.lightBehind(im, 'on') === '' && Wd.lightBehind({}, 'red') === '' && Wd.lightBehind(im, 'nonsense!') === '');
  ok('a cell that was emptied (an empty text) counts as no picture: a light falls back to the "All lights" picture of its own row, and a state with none has a plain round light', Wd.lightPic({ on: 'ON', yellow: '', yellow_1: '' }, 'yellow', 0, true) === '' && Wd.lightPic({ yellow: 'Y', yellow_1: '' }, 'yellow', 0, true) === 'Y' && Wd.lightPic({ on: 'ON', on_1: '' }, 'countdown', 0, true) === 'ON' && Wd.lightPic({ off: 'OFF', off_1: '' }, 'yellow', 0, false) === 'OFF' && Wd.lightBehind({ on: 'ON', yellow: '', on_2: '' }, 'yellow_2') === '' && Wd.lightBehind({ on: 'ON', on_2: '' }, 'on_2') === 'on');
  const r = Wd.resolveOpt({ type: 'lights', opt: { imageSet: 'S' } }, [{ id: 'S', kind: 'lights', images: im }]);
  ok('a lights set reaches the widget as lightImages, and Light on and off as before', r.lightImages === im && r.lightOn === 'ON' && r.lightOff === 'OFF');
  ok('lightsHtml: a pick function gives each light its own picture, without one the light stays a circle', (() => { const h = Wd.lightsHtml(2, { pick: i => (i === 0 ? 'data:A' : i === 3 ? 'data:D' : '') }); return (h.match(/<image/g) || []).length === 2 && h.includes('href="data:A"') && h.includes('href="data:D"') && (h.match(/<circle/g) || []).length === 3 && (h.match(/class="sl on"/g) || []).length === 2; })());
  { const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
    ok('the pictures of a lights set are drawn at the size of the light (92 units of the 100 high picture), not at their own pixel size', /\.slsvg image\.sl\{[^}]*width:92px;height:92px/.test(css) && css.indexOf('.slsvg image.sl{') > css.indexOf('.slsvg .sl{')); }
  ok('...and a picture that is not a safe text cannot break out of the page', (() => { const h = Wd.lightsHtml(1, { pick: () => '"><script>alert(1)</script>' }); return !h.includes('<script>'); })());
}

// the layout without its buttons (the Live Race pages, the fullscreen view): controls left out, the empty strip they leave at the bottom cut off
{
  const wd = (type, lane, o) => ({ id: type + lane + o.y, type, lane, x: 0, y: 0, w: 100, h: 60, ...o });
  const L = (widgets, rw = 16, rh = 9) => ({ ratioW: rw, ratioH: rh, laneColors: [], widgets });
  const hOf = l => Wd.heightOf(l);
  const lay = L([wd('clock', null, { y: 20, w: 300 }), wd('name', 0, { y: 100 }), wd('name', 1, { y: 200 }), wd('start', null, { y: 450, w: 140 }), wd('stop', null, { y: 450, x: 200, w: 120 })]);
  const r = Wd.withoutControls(lay, 2);
  ok('buttons at the bottom: the strip below the widgets is cut off, keeping the margin the widgets have at the top (20 above, 20 below)', r.cut > 0 && hOf(r.layout) === 260 + 20 && r.cut === hOf(lay) - 280 && r.layout.ratioW === 16 && r.layout.widgets === lay.widgets);
  ok('the layout that was passed in is not changed, and the new one has the same width and widgets (only the proportions differ)', lay.ratioH === 9 && hOf(lay) === Math.round(1000 * 9 / 16) && r.layout !== lay && r.layout.widgets.length === 5);
  ok('the page still has the widgets inside it: nothing that is shown ends below the new bottom', r.layout.widgets.filter(w => !Wd.def(w.type).button).every(w => w.y + w.h <= hOf(r.layout)));
  const none = L([wd('clock', null, { y: 20 }), wd('name', 0, { y: 100 })]);
  ok('a layout without buttons is left as it is (the same object, nothing cut), even with empty space at the bottom', Wd.withoutControls(none, 2).layout === none && Wd.withoutControls(none, 2).cut === 0);
  const top = L([wd('start', null, { y: 0 }), wd('clock', null, { y: 100 }), wd('name', 0, { y: 520, h: 42 })]);
  ok('buttons at the top leave nothing to cut at the bottom: the layout stays', Wd.withoutControls(top, 2).layout === top && Wd.withoutControls(top, 2).cut === 0);
  const onlyBtn = L([wd('start', null, { y: 0 }), wd('pause', null, { y: 100 })]);
  ok('a layout that is only buttons is left as it is (there is nothing to show instead)', Wd.withoutControls(onlyBtn, 2).layout === onlyBtn);
  const lanes = L([wd('clock', null, { y: 0 }), wd('name', 0, { y: 100 }), wd('name', 1, { y: 200 }), wd('name', 2, { y: 300 }), wd('name', 3, { y: 400 }), wd('start', null, { y: 500 })]);
  ok('widgets of lanes the track does not have do not keep the strip: 2 lanes cut more than 4 lanes', hOf(Wd.withoutControls(lanes, 2).layout) === 260 && hOf(Wd.withoutControls(lanes, 4).layout) === 460 && Wd.withoutControls(lanes, 4).cut === hOf(lanes) - 460);
  const flush = L([wd('clock', null, { y: 0 }), wd('name', 0, { y: 100 }), wd('start', null, { y: 500 })]);
  ok('widgets that start at the very top get no margin below them', hOf(Wd.withoutControls(flush, 2).layout) === 160);
  ok('a different shape (4:3) is cut the same way', (() => { const l = L([wd('clock', null, { y: 10 }), wd('name', 0, { y: 100, h: 50 }), wd('stop', null, { y: 700 })], 4, 3); const x = Wd.withoutControls(l, 2); return hOf(l) === 750 && hOf(x.layout) === 150 + 10 && x.cut === 750 - 160; })());
  ok('the default layout (header, rows and controls at the bottom) gets shorter, and keeps all its widgets', (() => { const d = Wd.defaultLayout(), x = Wd.withoutControls(d, 6); return x.cut > 0 && hOf(x.layout) < hOf(d) && x.layout.widgets.length === d.widgets.length; })());
  ok('buttons are what the Controls group says: Start, Pause / Resume, Stop, Yellow flag and Red flag', Wd.REGISTRY.filter(d => d.button).map(d => d.type).join() === 'start,pause,stop,yellow,red');
  // 1.2.0: the Race Laps widget
  { const d = Wd.def('racelaps');
    ok('Race Laps is a widget of the Race group that is for the whole race (not per lane), with a Count choice and a total tick box', d && d.group === 'Race' && !d.perLane && d.options.map(o => o.key).join() === 'lapCount,lapTotal' && d.options[0].type === 'select' && d.options[0].default === 'up' && d.options[0].choices.map(c => c[0]).join() === 'up,down' && d.options[1].type === 'checkbox' && d.options[1].default === true);
    ok('...the total tick box only shows when counting up, and changing Count redraws the settings', d.options[0].rerender === true && d.options[1].show({}) === true && d.options[1].show({ lapCount: 'up' }) === true && d.options[1].show({ lapCount: 'down' }) === false);
    ok('lapCountOf and lapTotalOn: up and the total are the standard, anything else is the standard too', Wd.lapCountOf({}) === 'up' && Wd.lapCountOf(undefined) === 'up' && Wd.lapCountOf({ lapCount: 'sideways' }) === 'up' && Wd.lapCountOf({ lapCount: 'down' }) === 'down' && Wd.lapTotalOn({}) === true && Wd.lapTotalOn(undefined) === true && Wd.lapTotalOn({ lapTotal: false }) === false && Wd.lapTotalOn({ lapTotal: 0 }) === true);
    ok('its sample in the editor: 7/20, 7 without the total, 13 counting down', Wd.sampleOf(d, 0, { opt: {} }) === '7/20' && Wd.sampleOf(d, 0, { opt: { lapTotal: false } }) === '7' && Wd.sampleOf(d, 0, { opt: { lapCount: 'down' } }) === '13' && Wd.sampleOf(d, 0) === '7/20'); }
  // 1.1.0: aligning the title and the text
  ok('alignment: nothing is added for the standard (title left, text centred), a wrong word is the standard', Wd.alignClassOf({ type: 'clock' }) === '' && Wd.alignClassOf({ type: 'clock', titleAlign: 'up', valueAlign: 5 }) === '' && Wd.titleAlignOf({ type: 'clock' }) === 'left' && Wd.valueAlignOf({ type: 'clock' }) === 'center');
  ok('alignment: each title and text alignment gives its own class', Wd.alignClassOf({ type: 'clock', titleAlign: 'center' }) === ' ta-c' && Wd.alignClassOf({ type: 'clock', titleAlign: 'right' }) === ' ta-r' && Wd.alignClassOf({ type: 'clock', valueAlign: 'left' }) === ' va-l' && Wd.alignClassOf({ type: 'clock', valueAlign: 'right' }) === ' va-r' && Wd.alignClassOf({ type: 'clock', titleAlign: 'right', valueAlign: 'left' }) === ' ta-r va-l');
  ok('alignment: the Leaderboard has only a title alignment (its text is laid out by the board itself), whatever is saved', Wd.valueAlignOf({ type: 'leaderboard', valueAlign: 'right' }) === 'center' && Wd.alignClassOf({ type: 'leaderboard', valueAlign: 'right' }) === '' && Wd.alignClassOf({ type: 'leaderboard', titleAlign: 'center', valueAlign: 'left' }) === ' ta-c');
}

{ const d = Wd.def('carpicture'), mirror = d.options.find(o => o.key === 'carMirror'); // 1.30.1
  ok('1.30.1: the Slotcar Picture widget has a Mirror tick box (off to begin with), before the position and zoom', d.options.map(o => o.key).join() === 'carMirror,frame' && mirror.type === 'checkbox' && mirror.default === false && /Mirror the picture/.test(mirror.label) && /left to right/.test(mirror.label));
  ok('...the Avatar keeps its own Mirror setting under its own name (the two are not the same setting)', Wd.def('avatar').options.some(o => o.key === 'avatarMirror') && !d.options.some(o => o.key === 'avatarMirror')); }

{ // 1.39.3: the Fuel bar can stand up, has a thickness, and the style sheet sizes it with the widget
  const up = Wd.fuelHtml(30, 120, { mode: 'both', dir: 'vertical' }), flat = Wd.fuelHtml(30, 120, { mode: 'bar' }), th = o => (Wd.fuelHtml(30, 120, o).match(/--th:(\d+)/) || [])[1];
  ok('1.39.3: the Fuel bar stands up with Vertical: it is filled in height from the bottom (class fv), the number stays in it', /class="fbar fv"/.test(up) && /class="ffill" style="height:25%/.test(up) && /class="ftxt">30 L/.test(up));
  ok('...and by default, or with a direction that does not exist, it is the horizontal bar of before, filled in width', /class="fbar"/.test(flat) && /class="ffill" style="width:25%/.test(flat) && /class="fbar"/.test(Wd.fuelHtml(30, 120, { dir: 'sideways' })) && !/fv/.test(Wd.fuelHtml(30, 120, { dir: null })));
  ok('...the thickness is a share of the widget from 10 to 100, 60 when it is not set or not a number', th({}) === '60' && th({ thick: 35 }) === '35' && th({ thick: '35' }) === '35' && th({ thick: -5 }) === '10' && th({ thick: 900 }) === '100' && th({ thick: 'abc' }) === '60');
  ok('...the colours still work in a vertical bar (low and critical)', /background:#d62828/.test(Wd.fuelHtml(5, 100, { dir: 'vertical' })) && /background:#ffd400/.test(Wd.fuelHtml(20, 100, { dir: 'vertical' })));
  ok('...a number or a picture has no bar, so no direction and no thickness', !/fbar/.test(Wd.fuelHtml(30, 120, { mode: 'number', dir: 'vertical' })) && !/fbar/.test(Wd.fuelHtml(30, 120, { mode: 'images', dir: 'vertical' })));
  const opts = Wd.def('fuel').options, keys = o => opts.filter(x => !x.show || x.show(o)).map(x => x.key);
  ok('...the side panel offers the direction and the thickness for Bar and for Bar and number (and when nothing is chosen yet), not for Number or Pictures', ['bar', 'both'].every(m => keys({ mode: m }).includes('dir') && keys({ mode: m }).includes('thick')) && keys(undefined).includes('dir') && ['number', 'images'].every(m => !keys({ mode: m }).includes('dir') && !keys({ mode: m }).includes('thick')) && opts.find(o => o.key === 'mode').rerender === true);
  ok('...the sample in the Layout Editor follows the direction', /class="fbar fv"/.test(Wd.sampleOf(Wd.def('fuel'), 0, { opt: { dir: 'vertical' } })));
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
  ok('...the style sheet: the bar is sized by the box of the widget (a size container, a share of its smaller side), the corners and the text grow with it, a vertical bar fills from the bottom', /\.lw-val:has\(\.fbar\)\{[^}]*container-type:size/.test(css) && /\.fbar\{[^}]*height:calc\(var\(--th,60\) \* 1cqmin\)[^}]*border-radius:clamp\(/.test(css) && /\.fbar\.fv\{width:calc\(var\(--th,60\) \* 1cqmin\);height:100%/.test(css) && /\.fbar\.fv \.ffill\{[^}]*bottom:0/.test(css) && /\.ftxt\{[^}]*font-size:min\(/.test(css));
}

console.log(fails ? fails + ' WIDGET TESTS FAILED' : 'ALL WIDGET TESTS PASSED'); process.exit(fails ? 1 : 0);
