const Wd = require('../renderer/widgets.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const W = Wd.U, H = 562;
const box = (x, y, w, h) => ({ x, y, w, h });

// registry
ok('53 widgets in the register (1.3.0: Balance of Power; 1.5.0: Tyres, Weather Forecast, Track Conditions)', Wd.REGISTRY.length === 53 && new Set(Wd.REGISTRY.map(d => d.type)).size === 53);
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
m = Wd.moveWidget(box(180, 100, 100, 50), 16, 0, [other], W, H, true); // right edge -> 296, near other's left edge 300
ok('sticks to the left edge of a neighbour', m.x + 100 === 300);
m = Wd.moveWidget(box(420, 100, 100, 50), -16, 0, [other], W, H, true); // left edge -> 404, near other's right edge 400
ok('sticks to the right edge of a neighbour', m.x === 400);
m = Wd.moveWidget(box(300, 160, 100, 50), 0, -9, [other], W, H, true); // top -> 151, near other's bottom 150
ok('sticks below a neighbour', m.y === 150);
m = Wd.moveWidget(w, -500, -500, [], W, H, true);
ok('cannot leave the canvas (top-left)', m.x === 0 && m.y === 0);
m = Wd.moveWidget(w, 5000, 5000, [], W, H, true);
ok('cannot leave the canvas (bottom-right)', m.x === W - 100 && m.y === H - 50);
m = Wd.moveWidget(box(5, 5, 100, 50), 0, 0, [], W, H, true);
ok('sticks to the canvas edge', m.x === 0 && m.y === 0);

// resizing
let r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 43, 17, [], W, H, true);
ok('resize se snaps to the grid', r.x === 100 && r.y === 100 && r.w === 145 && r.h === 65);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'nw', -23, -11, [], W, H, false);
ok('resize nw keeps the opposite corner fixed', r.x === 77 && r.y === 89 && r.x + r.w === 200 && r.y + r.h === 150);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', -500, -500, [], W, H, true);
ok('cannot shrink below the minimum size', r.w === Wd.MIN && r.h === Wd.MIN && r.x === 100 && r.y === 100);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 5000, 5000, [], W, H, true);
ok('cannot grow past the canvas', r.x + r.w === W && r.y + r.h === H);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 96, 0, [other], W, H, true); // right edge -> 296, magnet to 300
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
m = Wd.moveWidget(box(380, 100, 100, 50), 16, 0, [], W, H, true, gd);
ok('a widget\'s right edge sticks to a vertical guideline', m.x + 100 === 500);
m = Wd.moveWidget(box(520, 100, 100, 50), -16, 0, [], W, H, true, gd);
ok('a widget\'s left edge sticks to a vertical guideline', m.x === 500);
m = Wd.moveWidget(box(100, 245, 100, 50), 0, 6, [], W, H, true, gd);
ok('a widget\'s bottom edge sticks to a horizontal guideline', m.y + 50 === 300);
m = Wd.moveWidget(box(380, 100, 100, 50), 16, 0, [], W, H, false, gd);
ok('guidelines do nothing when snapping is off', m.x === 396);
r = Wd.resizeWidget(box(100, 100, 100, 50), 'se', 296, 0, [], W, H, true, gd);
ok('resizing an edge sticks to a guideline too', r.x + r.w === 500);
ok('widget names and groups as chosen', (() => { const g = {}; Wd.REGISTRY.filter(d => !d.hidden).forEach(d => (g[d.group] = g[d.group] || []).push(d.label)); return JSON.stringify(g) === JSON.stringify({
  Driver: ['Nickname', 'Name', 'Callsign', 'Lane Colour', 'Avatar', 'Driver Flag'], Slotcar: ['Slotcar Picture', 'Slotcar Description'],
  Timing: ['Position in Race', 'Lap of Lap', 'Laptime', 'Last lap', 'Average Lap', 'Median Lap', 'Best Lap (this session)', 'Gap to Leader', 'Fuel Level', 'Balance of Power', 'Slotcar Speed', 'Penalty Points', 'Championship Points', 'Pitstop Time'],
  'Timing Records': ['Record Lap Time', 'Session Record Lap', 'Track Record'], 'Delta Timers': ['Laptime Delta', 'Average Lap Delta', 'Median Lap Delta', 'Best Lap Delta', 'Personal Best Delta', 'Pitstop Time Delta', 'Session Record Delta', 'Track Record Delta'], Race: ['Race Clock', 'Race Laps', 'Start Lights', 'Race Info', 'Race Flag', 'Leaderboard', 'Logo'], 'Time Tokens': ['Token Clock'], Weather: ['Tyres', 'Weather Forecast', 'Track Conditions'], Controls: ['Start', 'Pause / Resume', 'Stop', 'Yellow flag', 'Red flag'] }); })());
ok('renamed widgets keep the title they showed in existing layouts', Wd.titleOf({ type: 'bestlap', title: '' }) === 'Best lap' && Wd.titleOf({ type: 'fuel', title: '' }) === 'Fuel' && Wd.titleOf({ type: 'position', title: '' }) === 'Position' && Wd.titleOf({ type: 'sessionrecord', title: '' }) === 'Session record lap');
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
  ok('for a lit light in a race state the keys run: this state\'s light, this state, Light on of the light, Light on', Wd.lightKeys('yellow', 1, true).join() === 'yellow_2,yellow,on_2,on');
  ok('...for the countdown and for a state that has no row: Light on of the light, Light on', Wd.lightKeys('countdown', 0, true).join() === 'on_1,on' && Wd.lightKeys('somethingelse', 4, true).join() === 'on_5,on');
  ok('...and for a light that is off: Light off of the light, Light off', Wd.lightKeys('yellow', 4, false).join() === 'off_5,off' && Wd.lightKeys('countdown', 0, false).join() === 'off_1,off');
  const im = { on: 'ON', off: 'OFF', yellow: 'Y', yellow_2: 'Y2', on_3: 'ON3' };
  ok('the picture of a light: the first key that has one', [0, 1, 2, 3, 4].map(i => Wd.lightPic(im, 'yellow', i, true)).join() === 'Y,Y2,Y,Y,Y' && [0, 1, 2, 3, 4].map(i => Wd.lightPic(im, 'red', i, true)).join() === 'ON,ON,ON3,ON,ON' && Wd.lightPic(im, 'red', 0, false) === 'OFF' && Wd.lightPic({}, 'red', 0, true) === '' && Wd.lightPic(null, 'red', 0, true) === '');
  ok('what an empty cell of the grid uses (to show it dimmed): the next picture behind it, or nothing', Wd.lightBehind(im, 'yellow_3') === 'yellow' && Wd.lightBehind(im, 'red_3') === 'on_3' && Wd.lightBehind(im, 'red_1') === 'on' && Wd.lightBehind(im, 'red') === 'on' && Wd.lightBehind(im, 'on_2') === 'on' && Wd.lightBehind(im, 'off_2') === 'off' && Wd.lightBehind(im, 'on') === '' && Wd.lightBehind({}, 'red') === '' && Wd.lightBehind(im, 'nonsense!') === '');
  ok('a cell that was emptied (an empty text) counts as no picture: the light falls back, and an empty cell shows what is behind it', Wd.lightPic({ on: 'ON', yellow: '', yellow_1: '' }, 'yellow', 0, true) === 'ON' && Wd.lightPic({ off: 'OFF', off_1: '' }, 'yellow', 0, false) === 'OFF' && Wd.lightBehind({ on: 'ON', yellow: '', on_2: '' }, 'yellow_2') === 'on');
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

console.log(fails ? fails + ' WIDGET TESTS FAILED' : 'ALL WIDGET TESTS PASSED'); process.exit(fails ? 1 : 0);
