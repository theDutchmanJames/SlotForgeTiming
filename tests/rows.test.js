// Leaderboard row designs: the rows built from a design, their colours and the leaderboard widget using a design.
const { createRace } = require('../renderer/engine.js');
const T = require('../renderer/timing.js'), Wd = require('../renderer/widgets.js'), Rows = require('../renderer/rows.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

const people = [0, 1, 2].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam', 'Kim'][i], nickname: '', flag: ['NL', '', ''][i], avatar: '', carName: 'car' }));
const eng = createRace({ type: 'race', laps: 5, endRule: 'all', minLap: 100, penalty: { on: true, mode: 'every', every: 5, seconds: 5, dq: 0, types: [] }, entries: people }); eng.start(0);
[5000, 10200].forEach(t => eng.cross(0, t)); [6000].forEach(t => eng.cross(1, t));
const S = (over = {}) => { const st = eng.standings(); return { eng, now: 12000, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 5 }, heat: null, standings: () => st,
  carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, laneColorsOf: () => ({}), ...over }; };

// the starting design
const D = Rows.defaultDesign();
ok('a new design has the usual cells', D.widgets.map(w => w.type).join() === 'position,driverflag,name,lap,bestlap,gap' && D.ratioH === 70 && D.ratioW === 1000);
ok('settings fall back to defaults', Rows.settings({}).rowH === 70 && Rows.settings({}).gap === 6 && Rows.settings({}).states === true && Rows.settings({ ratioH: 5 }).rowH === 20 && Rows.settings({ ratioH: 9000 }).rowH === 400);

// rows: one per driver in race order, each cell the driver's own value
const h = Rows.html(D, S());
ok('one row per driver', (h.match(/class="rrow /g) || []).length === 3);
ok('rows follow the race order and show the right values', h.indexOf('>Alex<') < h.indexOf('>Sam<') && h.indexOf('>Sam<') < h.indexOf('>Kim<') && h.includes('fi-nl') && h.includes('5.000'));
ok('each row has all its cells', (h.match(/rcell/g) || []).length === 18);
ok('a cell is placed by its position in the row', h.includes('left:0.5%') && h.includes('width:30%') && h.includes('aspect-ratio:1000 / 70'));
ok('the space between rows', h.includes('margin-top:0.6%'));
ok('no header unless asked', !h.includes('rrow-head'));

// rounded corners: the colour sits on its own layer; the radius is a % of the row height, in the row's own width units
ok('corners are rounded by default (25% of the row height)', Rows.settings({}).radius === 25 && h.includes('class="rrow-bg"') && h.includes('border-radius:1.75cqw'));
ok('...a radius of 0 is square, and it is limited to 50%', Rows.html({ ...D, radius: 0 }, S()).includes('border-radius:0cqw') && Rows.settings({ radius: 90 }).radius === 50 && Rows.settings({ radius: 0 }).radius === 0);
ok('the colour is on the layer, the text colour on the row', Rows.html({ ...D, states: false, rowBg: '#101010', rowText: '#fafafa' }, S()).includes('style="aspect-ratio:1000 / 70;margin-top:0.6%;color:#fafafa"><i class="rrow-bg" style="background:#101010'));

// header
const hd = Rows.html({ ...D, header: true, headerH: 40, headerBg: '#112233', headerText: '#eeeeee' }, S());
ok('header row has the cell titles', hd.includes('rrow-head') && hd.includes('>Name<') && hd.includes('>Position<') && hd.includes('background:#112233') && hd.includes('aspect-ratio:1000 / 40'));
const w1 = { ...D.widgets[2], title: 'Driver' };
ok('...or the title you gave it', Rows.html({ ...D, header: true, widgets: [w1] }, S()).includes('>Driver<'));

// states
ok('the leader row is coloured, the others are plain', h.includes('rrow-leader') && (h.match(/rrow-plain/g) || []).length === 2 && h.includes('background:#b8860b'));
eng.cross(2, 7000); eng.addPoints(2, 3, 7000); // Kim: penalty (no pending yet), then in the pits
ok('state of a car: leader, plain', Rows.stateOf(eng.cars[0], 1) === 'leader' && Rows.stateOf(eng.cars[1], 2) === '');
eng.cars[1].blockAt = 8000; ok('...in the pits', Rows.stateOf(eng.cars[1], 2) === 'pit');
eng.cars[1].blockAt = null; eng.cars[1].pending = [{ name: 'Drive-through' }]; ok('...a penalty to serve', Rows.stateOf(eng.cars[1], 2) === 'pen');
eng.cars[1].retired = true; ok('...out of the race beats the rest', Rows.stateOf(eng.cars[1], 2) === 'out'); eng.cars[1].retired = false; eng.cars[1].pending = [];
ok('nothing is leader before the first lap', Rows.stateOf({ laps: [], blockAt: null }, 1) === '');
const off = Rows.html({ ...D, states: false }, S());
ok('states can be turned off', !off.includes('rrow-leader') && (off.match(/rrow-plain/g) || []).length === 3);
const col = Rows.html({ ...D, states: false, rowBg: '#101010', rowText: '#fafafa', altBg: '#202020' }, S());
ok('row colours and every second row', col.includes('background:#101010') && col.includes('color:#fafafa') && col.includes('background:#202020'));
ok('your own state colours', Rows.html({ ...D, leaderBg: '#00ff00', leaderText: '#000000' }, S()).includes('background:#00ff00'));
const own = { ...D, states: false, widgets: [{ ...D.widgets[2], bgColor: '#abcdef', textColor: '#123456' }] };
ok('a widget\'s own colour is used in its cell', Rows.html(own, S()).includes('color:#123456;background:#abcdef'));
ok('a lap-time flash colours its cell', Rows.html({ ...D, widgets: [Wd.newWidget('laptime', 0, 0, 0)] }, S({ flashOf: c => (c === eng.cars[0] ? { at: 11000, time: 5200, kind: 'record' } : null) })).includes('background:#ffc400'));

// widgets that are not per driver are left out
ok('only driver widgets can be cells', !Rows.html({ ...D, widgets: [Wd.newWidget('clock', null, 0, 0), D.widgets[0]] }, S()).includes('00:'));

// lane colour widget in a row: the lane's colour, or its own colour
const lcw = Wd.newWidget('lanecolor', 0, 0, 0), laneS = S({ laneColorsOf: () => ({ color: '', bg: '#aa0000' }) });
ok('lane colour cell shows the lane colour', Rows.html({ ...D, states: false, widgets: [lcw] }, laneS).includes('background:#aa0000'));
ok('...or its own colour, without touching the lane colour', Rows.html({ ...D, states: false, widgets: [{ ...lcw, bgColor: '#00ff00' }] }, laneS).includes('background:#00ff00') && !Rows.html({ ...D, states: false, widgets: [{ ...lcw, bgColor: '#00ff00' }] }, laneS).includes('#aa0000'));

// the preview in the designer
const pv = Rows.sampleHtml({ ...D, header: true },8);
ok('preview shows sample rows in each state', (pv.match(/class="rrow /g) || []).length === 9 && ['leader', 'plain', 'pit', 'pen', 'out'].every(k => pv.includes('rrow-' + k)) && pv.includes('>Alex<'));

// the leaderboard widget uses a design
const lb = (opt, rd) => T.content({ type: 'leaderboard', opt }, S({ rowDesigns: rd })).html;
const design = { id: 'R1', name: 'Mine', ...D };
ok('the leaderboard widget shows the chosen row design', lb({ design: 'R1' }, [design]).includes('rrows') && !lb({ design: 'R1' }, [design]).includes('<table'));
ok('...the classic table when none is chosen', lb({}, [design]).includes('<table class="lb">'));
ok('...and when the design was deleted', lb({ design: 'gone' }, [design]).includes('<table class="lb">') && lb({ design: 'R1' }, undefined).includes('<table'));
ok('the space between the columns flows from the widget to the rows too', lb({ design: 'R1', gaps: 0 }, [design]).includes('--rw:985') && !lb({ design: 'R1' }, [design]).includes('--rw') && !lb({ design: 'R1', gaps: 100 }, [design]).includes('--rw'));
ok('the size of the rows flows from the widget to the rows', lb({ design: 'R1', scale: 50 }, [design]).includes('--rk:0.5') && lb({ design: 'R1' }, [design]).includes('--rk:1') && !lb({ scale: 50 }, [design]).includes('--rk'));
ok('the old column choices are untouched', lb({ colLast: true }, []).includes('lb-last'));
ok('the widget has a row design option, and the column options are marked classic', Wd.def('leaderboard').options[0].type === 'rowdesign' && Wd.def('leaderboard').options.filter(o => o.classic).length === 12);
{
  const sc = Wd.def('leaderboard').options.find(o => o.key === 'scale');
  ok('the widget has a size slider for the rows, from 20 to 100 percent, shown only with a row design', sc && sc.type === 'range' && sc.min === 20 && sc.max === 100 && sc.default === 100 && sc.unit === '%' && sc.rowsOnly === true && !sc.classic && Wd.def('leaderboard').options.filter(o => o.rowsOnly).length === 3);
  const gp = Wd.def('leaderboard').options.find(o => o.key === 'gaps');
  ok('...and one for the space between the columns, from 0 to 100 percent, 100 when not set, also only with a design', gp && gp.type === 'range' && gp.min === 0 && gp.max === 100 && gp.default === 100 && gp.unit === '%' && gp.rowsOnly === true && !gp.classic);
}

// fitting the rows into the widget's frame: the style sheet needs the height of all the rows (in row units) and the size choice
ok('the height of the rows: every row and the gaps between them (none above the first row)', Rows.totalH(D, 3) === 3 * 70 + 2 * 6 && Rows.totalH(D, 1) === 70 && Rows.totalH(D, 8) === 8 * 70 + 7 * 6);
ok('...a header adds its height and one more gap', Rows.totalH({ ...D, header: true, headerH: 40 }, 3) === 40 + 3 * 70 + 3 * 6 && Rows.totalH({ ...D, header: true, headerH: 40 }, 0) === 40);
ok('...nothing at all is still a height the style sheet can divide by', Rows.totalH(D, 0) === 1 && Rows.totalH(D, -4) === 1 && Rows.totalH(D, 'x') === 1 && Rows.totalH({ ...D, ratioH: 100, gap: 10 }, 2) === 210);
ok('the size choice is 20 to 100 percent, 100 when not set', Rows.scaleOf() === 1 && Rows.scaleOf('') === 1 && Rows.scaleOf(null) === 1 && Rows.scaleOf(50) === 0.5 && Rows.scaleOf('60') === 0.6 && Rows.scaleOf(5) === 0.2 && Rows.scaleOf(500) === 1 && Rows.scaleOf('abc') === 1);
ok('the style for the sheet has both', Rows.fitStyle(D, 3) === '--rtot:222;--rk:1' && Rows.fitStyle(D, 3, { scale: 40 }) === '--rtot:222;--rk:0.4');
const fit = (o, n = 3) => Rows.html(D, S(), undefined, o).includes(Rows.fitStyle(D, n, o));
ok('the rows carry it: the height of the drivers there are, and the size choice', fit() && fit({ scale: 50 }) && Rows.html(D, S(), undefined, { scale: 50 }).includes('--rk:0.5') && Rows.html(D, S()).includes('--rtot:222;--rk:1'));
ok('...fewer rows when limited, so the rows fit by their own height', Rows.html(D, S(), 2).includes('--rtot:146;') && Rows.html({ ...D, header: true, headerH: 40 }, S()).includes('--rtot:268;'));
ok('...an empty race is not a division by zero', Rows.html(D, S({ standings: () => [] })).includes('--rtot:1;'));
const sm8 = Rows.sampleHtml(D, 8);
ok('the preview shows up to eight sample drivers, each with its cells', (sm8.match(/class="rrow /g) || []).length === 8 && (sm8.match(/rcell/g) || []).length === 48 && (Rows.sampleHtml(D, 20).match(/class="rrow /g) || []).length === 8 && (Rows.sampleHtml(D, 0).match(/class="rrow /g) || []).length === 5 && (Rows.sampleHtml(D, 1).match(/class="rrow /g) || []).length === 1);
ok('...with the height and size choice of the rows shown, so it fits the frame like the race does', sm8.includes('--rtot:602;--rk:1') && Rows.sampleHtml(D, 8, [], { scale: 30 }).includes('--rk:0.3') && Rows.sampleHtml({ ...D, header: true, headerH: 40 }, 8).includes('--rtot:648;'));
ok('...more drivers than there are sample names still show something in every cell (no empty or broken text)', !/undefined|NaN/.test(sm8) && sm8.includes('>Alex<'));

// text wider than its cell is made smaller. (The page measures; here the measuring is replaced by numbers.)
{
  const cell = () => ({ style: { fontSize: 'old' } });
  const mk = list => ({ querySelectorAll: sel => (sel === '.rrow .rcell > .lw-val' ? list : []) });
  const cs = [cell(), cell(), cell(), cell(), cell()], sizes = [{ box: 100, text: 80 }, { box: 100, text: 200 }, { box: 100, text: 100.4 }, { box: 0, text: 50 }, { box: 100, text: 1000 }];
  Rows.fitText(mk(cs), c => sizes[cs.indexOf(c)]);
  ok('a cell whose text fits keeps the size of its row (and an old fit is taken away)', cs[0].style.fontSize === '' && cs[2].style.fontSize === '');
  ok('...a text twice as wide as its cell gets half the size', cs[1].style.fontSize === '50%');
  ok('...never smaller than a fifth, and a cell without width (hidden) is left alone', cs[4].style.fontSize === '20%' && cs[3].style.fontSize === '');
  const t = []; Rows.fitText(mk([cell(), cell()]), c => { t.push('m'); return { box: 10, text: 5 }; });
  ok('every cell is measured', t.length === 2);
  const order = []; const c2 = [{ style: { set fontSize(v) { order.push('set'); } } }, { style: { set fontSize(v) { order.push('set'); } } }];
  Rows.fitText(mk(c2), () => { order.push('measure'); return { box: 10, text: 20 }; });
  ok('...all of them first and then the sizes are set (one layout of the page, not one for every cell)', order.slice(0, 4).join() === 'set,set,measure,measure' && order.slice(4).join() === 'set,set');
}


// closing up the blank space between the columns: a design with position, flag and callsign at the left and the points far away at the right
{
  const cell = (type, x, w, y = 5) => ({ ...Wd.newWidget(type, 0, x, y), x, y, w, h: 60, textSize: 30, showTitle: false });
  const far = { ...D, widgets: [cell('position', 5, 70), cell('driverflag', 80, 70), cell('callsign', 155, 100), cell('champpoints', 780, 200)] };
  const near = Rows.layoutOf(far, { gaps: 0 }), half = Rows.layoutOf(far, { gaps: 50 }), as = Rows.layoutOf(far, { gaps: 100 });
  ok('the share of blank space kept is 0 to 100 percent, all of it when not set', Rows.gapsOf() === 1 && Rows.gapsOf('') === 1 && Rows.gapsOf(null) === 1 && Rows.gapsOf(0) === 0 && Rows.gapsOf('50') === 0.5 && Rows.gapsOf(150) === 1 && Rows.gapsOf(-5) === 0 && Rows.gapsOf('abc') === 1);
  ok('at 100% (or not set) the design is left exactly as it is', as.W === 1000 && as.k === 1 && as.map(780) === 780 && Rows.layoutOf(far).W === 1000 && Rows.layoutOf(far, {}).W === 1000 && Rows.layoutOf(far, { gaps: 'x' }).W === 1000);
  ok('at 0% the blank space between the columns shrinks to a small gap, and so do the edges: the row gets that much narrower', near.W === 470 && Math.abs(near.k - 1000 / 470) < 1e-9);
  ok('...the columns keep their width and their place in relation to each other (the points column now follows the callsign after a small gap)', [5, 80, 155].every(x => near.map(x) === x) && near.map(255) === 255 && near.map(780) === 265 && near.map(980) === 465 && near.map(980) - near.map(780) === 200);
  ok('at 50% half of the extra blank space is kept', half.W === 735 && half.map(780) === 522.5 && half.map(980) === 722.5);
  ok('a point inside the blank space moves in proportion, one outside the row moves with the edge, and the order never changes', near.map(500) > 255 && near.map(500) < 265 && near.map(-10) === -10 && near.map(1100) === 570 && [...Array(220).keys()].map(i => near.map(i * 5)).every((v, i, a) => i === 0 || v >= a[i - 1]));
  const stacked = { ...D, widgets: [cell('callsign', 155, 100, 5), cell('position', 5, 70), cell('carname', 200, 150, 40), cell('champpoints', 780, 200)] };
  ok('cells above each other or touching are one column (whatever order they are in): only the blank space around them closes up', Rows.layoutOf(stacked, { gaps: 0 }).W === 495 && Rows.layoutOf(stacked, { gaps: 0 }).map(780) === 290 && Rows.layoutOf(stacked, { gaps: 0 }).map(155) === 85 && Rows.layoutOf(stacked, { gaps: 0 }).map(350) === 280 && Rows.layoutOf({ ...D, widgets: [cell('position', 5, 70), cell('driverflag', 75, 70), cell('champpoints', 800, 100)] }, { gaps: 0 }).map(75) === 75);
  { const inner = { ...far, widgets: [...far.widgets, cell('lap', 160, 40, 40), cell('bestlap', 155, 100, 40)] };
    ok('a cell inside another one, or exactly under it, changes nothing', Rows.layoutOf(inner, { gaps: 0 }).W === 470 && Rows.layoutOf(inner, { gaps: 0 }).map(780) === 265 && Rows.layoutOf(inner, { gaps: 50 }).W === 735); }
  ok('a design with no gaps to close, or without cells, is not changed', Rows.layoutOf(D, { gaps: 0 }).W === 985 && Rows.layoutOf({ ...D, widgets: [] }, { gaps: 0 }).W === 1000 && Rows.layoutOf({}, { gaps: 0 }).W === 1000 && Rows.layoutOf(undefined, { gaps: 0 }).W === 1000);
  ok('only the cells of a driver count (a clock in the design does not hold a gap open), and cells without width are ignored', Rows.layoutOf({ ...far, widgets: [...far.widgets, Wd.newWidget('clock', null, 400, 5), { ...cell('lap', 500, 0) }] }, { gaps: 0 }).W === 470);
  ok('a cell outside the row cannot make the row wider than designed or give it no width', Rows.layoutOf({ ...far, widgets: [cell('position', -50, 100), cell('lap', 950, 200)] }, { gaps: 0 }).W <= 1000 && Rows.layoutOf({ ...far, widgets: [cell('position', -50, 100), cell('lap', 950, 200)] }, { gaps: 0 }).W >= 1);
  { const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/styles.css'), 'utf8'), rule = (css.match(/\.lw-val > \.rrows\{[^}]*\}/) || [''])[0];
    ok('the style sheet fits the rows by the height of all rows, the width of a row (1000 unless closed up) and the size choice', /min\(100cqw, 100cqh \* var\(--rw, 1000\) \/ var\(--rtot, 1000\)\) \* var\(--rk, 1\)/.test(rule) && rule.includes('margin:0 auto')); }
  // the rows
  const sq = Rows.html(far, S(), undefined, { gaps: 0 }), same = Rows.html(far, S(), undefined, { gaps: 100 });
  ok('squeezed rows are 470 wide: their shape, the space between the rows and the corner radius follow', sq.includes('aspect-ratio:470 / 70') && sq.includes('margin-top:1.27659') && sq.includes('border-radius:3.72cqw') && !sq.includes('aspect-ratio:1000 / 70'));
  ok('...each cell is placed in the new width: the points cell follows the callsign, and the text is larger in relation to the row', sq.includes('left:56.3829') && sq.includes('width:42.5531') && sq.includes('left:1.06382') && sq.includes('font-size:6.38297'));
  ok('...the style for the sheet says the row is 470 wide (and says nothing when it is as designed)', sq.includes('--rtot:222;--rk:1;--rw:470"') && same.includes('--rtot:222;--rk:1"') && !same.includes('--rw') && same === Rows.html(far, S()));
  ok('...the same drivers, in the same order, with the same values', ['Alex', 'Sam', 'Kim'].every(n => sq.includes('>' + n + '<') || !same.includes('>' + n + '<')) && (sq.match(/class="rrow /g) || []).length === 3 && Rows.fitStyle(far, 8, { gaps: 0 }) === '--rtot:602;--rk:1;--rw:470' && Rows.fitStyle(far, 8, { gaps: 0, scale: 50 }) === '--rtot:602;--rk:0.5;--rw:470');
  const hq = Rows.html({ ...far, header: true, headerH: 40 }, S(), undefined, { gaps: 0 });
  ok('the header row is squeezed like the rows: its width, its cells and its text', hq.includes('aspect-ratio:470 / 40') && /left:56\.3829\d*%;top:0;width:42\.5531/.test(hq) && hq.includes('font-size:3.5744') && hq.includes('>Points<'));
  const pq = Rows.sampleHtml(far, 8, [], { gaps: 0 });
  ok('the preview in the editor is squeezed in the same way', pq.includes('aspect-ratio:470 / 70') && pq.includes('--rtot:602;--rk:1;--rw:470') && (pq.match(/class="rrow /g) || []).length === 8 && !Rows.sampleHtml(far, 8, []).includes('--rw'));
}


// Fill the frame (0.76.0): off (the rows keep their shape), taller rows, or the free height between the rows
{ const cell = (type, x, w, y = 5) => ({ ...Wd.newWidget(type, 0, x, y), x, y, w, h: 60, textSize: 30, showTitle: false }), far = { ...D, widgets: [cell('position', 5, 70), cell('driverflag', 80, 70), cell('callsign', 155, 100), cell('champpoints', 780, 200)] };
  const fl = Wd.def('leaderboard').options.find(o => o.key === 'fill');
  ok('the widget has a Fill the frame choice: Off, Taller rows, More space between the rows; off to begin with, and only with a row design', fl && fl.type === 'select' && fl.default === 'off' && fl.rowsOnly === true && !fl.classic && fl.label === 'Fill the frame' && fl.choices.map(c => c[0]).join() === 'off,rows,gaps' && fl.choices[1][1] === 'Taller rows' && fl.choices[2][1] === 'More space between the rows');
  ok('...the hint says what each choice does, and that a full frame does not change', /Taller rows/.test(fl.hint) && /More space between the rows/.test(fl.hint) && /does not change/.test(fl.hint) && /Size of the rows/.test(fl.hint));
  ok('anything but rows and gaps is off', ['', undefined, null, 'off', 'ROWS', 'Gaps', 'x', 1, true].every(v => Rows.fillOf(v) === '') && Rows.fillOf('rows') === 'rows' && Rows.fillOf('gaps') === 'gaps');
  const plain = Rows.html(D, S()), mark = f => Rows.html(D, S(), undefined, { fill: f });
  ok('the rows say which fill they have (the sheet does the rest)', mark('rows').includes('<div class="rrows" data-fill="rows" style="') && mark('gaps').includes('<div class="rrows" data-fill="gaps" style="'));
  ok('...and nothing about it when it is off, or not known (the rows are exactly as before)', ['off', '', undefined, 'x'].every(f => mark(f) === plain) && !plain.includes('data-fill'));
  ok('...the rows themselves are the same in every fill: only the one attribute differs (the shape, the cells, the colours)', mark('rows').replace(' data-fill="rows"', '') === plain && mark('gaps').replace(' data-fill="gaps"', '') === plain);
  ok('...also with a header, a size choice and closed-up columns (the sheet still gets the same height, size and width)', (() => { const o = { scale: 50, gaps: 0 }, hd2 = { ...far, header: true, headerH: 40 }, a = Rows.html(hd2, S(), undefined, o), b = Rows.html(hd2, S(), undefined, { ...o, fill: 'rows' }); return b.includes('data-fill="rows"') && b.replace(' data-fill="rows"', '') === a && b.includes('--rtot:268;--rk:0.5;--rw:470') && b.includes('rrow-head'); })());
  ok('...and in the preview of the editor', Rows.sampleHtml(D, 8, [], { fill: 'gaps' }).includes('<div class="rrows" data-fill="gaps" style="--rtot:602;--rk:1') && !Rows.sampleHtml(D, 8, [], {}).includes('data-fill') && Rows.sampleHtml(D, 8, [], { fill: 'rows' }).replace(' data-fill="rows"', '') === Rows.sampleHtml(D, 8));
  ok('an empty race with a fill is still not a division by zero', Rows.html(D, S({ standings: () => [] }), undefined, { fill: 'rows' }).includes('--rtot:1;'));
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/styles.css'), 'utf8'), has = t => css.includes(t);
  ok('the style sheet makes the board as tall as the frame times the size choice, with the rows below each other', has('.lw-val > .rrows[data-fill]{height:calc(100cqh * var(--rk, 1));display:flex;flex-direction:column}') && has('.rrows[data-fill] > .rrow{flex:none}'));
  ok('...taller rows share the height (the header keeps its shape, and the row\'s own shape is let go)', has('.rrows[data-fill=rows] > .rrow:not(.rrow-head){flex:1 1 0;aspect-ratio:auto!important}'));
  ok('...more space: the rows after a row (not the one after the header) take the free height as their space', has('.rrows[data-fill=gaps] > .rrow:not(.rrow-head) + .rrow{margin-top:auto!important}'));
  ok('...and a frame without a fill is sized as before', /\.lw-val > \.rrows\{width:calc\(min\(100cqw, 100cqh \* var\(--rw, 1000\) \/ var\(--rtot, 1000\)\) \* var\(--rk, 1\)\);margin:0 auto\}/.test(css) && !/\.lw-val > \.rrows\{[^}]*height/.test(css)); }

// ---- 1.19.0: a board in the order of a value (Order by) ----
{
  // Kim 2 laps (6.000 and 3.000, done at 9.000), Alex 2 laps (5.000 and 5.000, done at 10.000), Sam 1 lap (4.000); Sam has 3 penalty points. Race order: Kim, Alex, Sam.
  const e2 = createRace({ type: 'race', laps: 5, endRule: 'all', minLap: 100, penalty: { on: true, mode: 'every', every: 5, seconds: 5, dq: 0, types: [] }, entries: people }); e2.start(0);
  [5000, 10000].forEach(t => e2.cross(0, t)); e2.cross(1, 4000); [6000, 9000].forEach(t => e2.cross(2, t)); e2.addPoints(1, 3, 9500);
  const S2 = (over = {}) => { const st = e2.standings(); return { eng: e2, now: 12000, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 5 }, heat: null, standings: () => st,
    carByLane: l => e2.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, laneColorsOf: () => ({}), rowDesigns: [{ id: 'R1', name: 'Mine', ...D }], ...over }; };
  const board = (opt, over) => T.content({ type: 'leaderboard', opt }, S2(over)).html;
  const order = h => ['Alex', 'Sam', 'Kim'].map(n => [n, h.indexOf('>' + n + '<')]).filter(x => x[1] >= 0).sort((a, b) => a[1] - b[1]).map(x => x[0]).join(' ');
  const classic = opt => order(board(opt)), design = opt => order(board({ design: 'R1', ...opt }));
  ok('the race order to begin with: Kim, Alex, Sam (the board follows the race)', classic({}) === 'Kim Alex Sam' && design({}) === 'Kim Alex Sam');
  ok('ordered by the best lap: the fastest first (Kim 3.000, Sam 4.000, Alex 5.000), in the classic table and in a row design', classic({ orderBy: 'best' }) === 'Kim Sam Alex' && design({ orderBy: 'best' }) === 'Kim Sam Alex');
  ok('...Worst first turns it round', classic({ orderBy: 'best', orderDir: 'worst' }) === 'Alex Sam Kim' && design({ orderBy: 'best', orderDir: 'worst' }) === 'Alex Sam Kim');
  ok('the average lap (Sam 4.000, Kim 4.500, Alex 5.000) and the last lap (Kim 3.000, Sam 4.000, Alex 5.000)', classic({ orderBy: 'avg' }) === 'Sam Kim Alex' && design({ orderBy: 'avg' }) === 'Sam Kim Alex' && classic({ orderBy: 'last' }) === 'Kim Sam Alex');
  ok('the laps (Kim and Alex 2, then Sam 1, the tie in race order), and the lane (Alex, Sam, Kim) and the name', classic({ orderBy: 'laps' }) === 'Kim Alex Sam' && classic({ orderBy: 'laps', orderDir: 'worst' }) === 'Sam Kim Alex'
    && classic({ orderBy: 'lane' }) === 'Alex Sam Kim' && design({ orderBy: 'lane' }) === 'Alex Sam Kim' && classic({ orderBy: 'name' }) === 'Alex Kim Sam' && design({ orderBy: 'name', orderDir: 'worst' }) === 'Sam Kim Alex');
  ok('the penalty points: the cleanest first (Kim and Alex 0 in race order, Sam 3), and the most first with Worst first (Sam, then the others in race order)', classic({ orderBy: 'penpoints' }) === 'Kim Alex Sam' && classic({ orderBy: 'penpoints', orderDir: 'worst' }) === 'Sam Kim Alex'
    && design({ orderBy: 'penpoints', orderDir: 'worst' }) === 'Sam Kim Alex');
  ok('a value this race has not got (no fuel rule, no damage rule, no championship points, no speed without a track length) leaves the race order', ['fuel', 'damage', 'champ', 'speed', 'pits', 'record'].every(k => classic({ orderBy: k }) === 'Kim Alex Sam' && design({ orderBy: k }) === 'Kim Alex Sam'));
  ok('...and so does a setting that is not a value (a damaged file)', classic({ orderBy: 'bogus' }) === 'Kim Alex Sam' && design({ orderBy: 7, orderDir: 'sideways' }) === 'Kim Alex Sam');
  ok('a board that follows the race is drawn exactly as before: the same text with the settings left out, "Race position" chosen or a direction without a value', board({}) === board({ orderBy: 'position' }) && board({}) === board({ orderDir: 'worst' }) && board({ design: 'R1' }) === board({ design: 'R1', orderBy: 'position', orderDir: 'worst' }));
  ok('the From place and To place count in the order of the board: places 2 to 2 of the best-lap order is Sam, 1 to 1 is Kim, from 3 is Alex', classic({ orderBy: 'best', from: 2, to: 2 }) === 'Sam' && design({ orderBy: 'best', from: 2, to: 2 }) === 'Sam'
    && classic({ orderBy: 'best', to: 1 }) === 'Kim' && design({ orderBy: 'best', from: 3 }) === 'Alex' && classic({ orderBy: 'lane', from: 2 }) === 'Sam Kim');
  { // the Position cell and the leader look of an ordered board
    const rowsOf = h => h.split('class="rrow ').slice(1), cls = r => r.slice(0, r.indexOf('"')), pos = r => (/class="lw live rcell[^"]*"[^>]*><span class="lw-val"[^>]*>(\d+)</.exec(r) || [])[1];
    const lane = rowsOf(board({ design: 'R1', orderBy: 'lane' })), race = rowsOf(board({ design: 'R1' }));
    ok('the Position cell of an ordered board counts its rows (1, 2, 3), the board of the race shows the places of the race', lane.map(pos).join() === '1,2,3' && race.map(pos).join() === '1,2,3' && rowsOf(board({ design: 'R1', orderBy: 'lane', orderDir: 'worst' })).map(pos).join() === '1,2,3');
    ok('...so in the lane order Alex is first (position 1) though Kim leads the race, and Kim is third', lane[0].includes('>Alex<') && pos(lane[0]) === '1' && lane[2].includes('>Kim<') && pos(lane[2]) === '3');
    ok('the first row of an ordered board has the leader look (the leader of that order), the race leader does not keep it', cls(lane[0]).includes('rrow-leader') && !cls(lane[2]).includes('rrow-leader') && cls(race[0]).includes('rrow-leader') && race[0].includes('>Kim<'));
    const cl = board({ orderBy: 'lane' }).split('<tr>').slice(1), posOf = r => (/lb-pos">(\d+)</.exec(r) || [])[1];
    ok('the classic table counts its rows too: Pos 1 for Alex, 2 for Sam, 3 for Kim (Kim leads the race)', cl.length === 3 && cl.map(posOf).join() === '1,2,3' && cl[0].includes('>Alex<') && cl[2].includes('>Kim<') && board({}).split('<tr>').slice(1)[0].includes('>Kim<')); }
  { const alexGap = e2.standings().find(x => x.car.driverName === 'Alex').gap;
    ok('the other cells keep their own values in an ordered board: Kim\'s best lap is still 3.000 and Alex has the gap of the race, not a gap in the order of the board', !!alexGap && board({ orderBy: 'lane' }).includes('>3.000<') && board({ orderBy: 'lane' }).includes('>' + alexGap + '<') && board({ design: 'R1', orderBy: 'lane' }).includes('>3.000<')); }
  ok('the Leaderboard widget has "Order by" (a choice of values, the race position as the standard) and "Best or worst on top" that only shows when a value is chosen', (() => {
    const o = Wd.def('leaderboard').options, by = o.find(x => x.key === 'orderBy'), dir = o.find(x => x.key === 'orderDir');
    return by && dir && by.type === 'select' && by.default === 'position' && by.rerender === true && by.choices[0][0] === 'position' && by.choices.length === 18 && by.choices.some(c => c[0] === 'totaltime') && by.choices.some(c => c[0] === 'totaltimeall') && typeof by.hintOf === 'function' && by.hintOf('best').includes('fastest lap')
      && dir.type === 'select' && dir.default === 'best' && dir.choices.map(c => c[0]).join() === 'best,worst' && dir.show({}) === false && dir.show({ orderBy: 'position' }) === false && dir.show({ orderBy: 'best' }) === true && !by.classic && !by.rowsOnly && !dir.classic && !dir.rowsOnly;
  })());
}

console.log(fails ? fails + ' ROW TESTS FAILED' : 'ALL ROW TESTS PASSED'); process.exit(fails ? 1 : 0);
