// 1.40.0: the Tyre Degradation widget (tyrewidgets.js), its place in the register, the Leaderboard column, the cells of the Driver stats grid, and what the Tyre Change folder shows (tyreui.js).
const E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js'), Wx = require('../renderer/weather.js'), Tyw = require('../renderer/tyrewidgets.js'), Wd = require('../renderer/widgets.js'),
  Tm = require('../renderer/timing.js'), Dg = require('../renderer/drivergrid.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: ['S', 'M', 'H', 'W'][i] }));
const race = (rec, o = {}) => { const r = E.createRace({ type: o.type || 'race', laps: 60, duration: 30, endRule: 'all', entries: entries(2), tyrewear: rec === null ? undefined : T.clean(rec, o.ctx) }); r.start(0); return r; };
const S = (eng, at = 20000) => ({ eng, now: at, phase: 'running', setup: { sessionType: 'race', laps: 60 }, heat: null, rowDesigns: [], carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => eng.standings().find(x => x.car === c), standings: () => eng.standings(), laneColorsOf: () => ({}), flashOf: () => null, personalBest: () => Infinity });
const row = (life, o = {}) => ({ lane: 0, code: 'S', tyre: 'Soft', color: '#e8002d', life, shown: T.shownLife(life), level: T.levelOf({ warn: 25, crit: 10 }, life), effect: 2, effectText: '+2%', leftText: '14 laps', lapsLeft: 14, fitting: null, fitLeft: null, stops: 0, ...o });
const html = (r, opt) => Tyw.rowHtml(r, opt).html;

// ---- the options ----
{ const o = Tyw.OPTIONS, keys = o.map(x => x.key);
  ok('the widget has every option that was approved: the look, the bar direction and thickness, the percentage, laps left, grip effect, tyre name, BOX NOW, and the three colours', ['look', 'dir', 'thick', 'showPct', 'showLeft', 'showGrip', 'showName', 'showBox', 'okColor', 'warnColor', 'critColor'].every(k => keys.includes(k)) && keys.includes('imageSet'));
  ok('...four looks: the tyre that wears away, the tyre with a ring, a bar, a number only', Tyw.LOOKS.map(x => x[0]).join() === 'wear,ring,bar,number');
  ok('...the bar options show only for the bar look', o.find(x => x.key === 'dir').show({ look: 'bar' }) && !o.find(x => x.key === 'dir').show({ look: 'wear' }) && o.find(x => x.key === 'thick').show({ look: 'bar' }) && !o.find(x => x.key === 'thick').show({}));
  ok('...the defaults: wears away, percentage, laps left and grip on, the name off, BOX NOW on', Tyw.DEFAULTS.look === 'wear' && Tyw.DEFAULTS.showPct === true && Tyw.DEFAULTS.showLeft === true && Tyw.DEFAULTS.showGrip === true && Tyw.DEFAULTS.showName === false && Tyw.DEFAULTS.showBox === true);
  ok('...the picture set choice is the one of the Tyres widget (kind tyres)', o.find(x => x.key === 'imageSet').kind === 'tyres'); }

// ---- the tyre that wears away ----
{ const a = Tyw.wearSvg('S', 100), b = Tyw.wearSvg('S', 50), c = Tyw.wearSvg('S', 0), d = Tyw.wearSvg('S', 12);
  const tread = s => { const m = /<circle cx="50" cy="50" r="([\d.]+)" fill="none" stroke="#5b616c" stroke-width="([\d.]+)" pathLength="16" stroke-dasharray="0.45 0.55"\/>/.exec(s); return m ? { r: Number(m[1]), w: Number(m[2]) } : null; };
  ok('a new tyre has the full tread: r = 41, width 12 (the outside stays at 47)', tread(a) && near(tread(a).r, 41) && near(tread(a).w, 12) && near(tread(a).r + tread(a).w / 2, 47));
  ok('...at 50% the tread is half as deep: r = 44, width 6, the outside still at 47', tread(b) && near(tread(b).r, 44) && near(tread(b).w, 6) && near(tread(b).r + tread(b).w / 2, 47));
  ok('...at 0% there is no tread at all (a bald tyre)', tread(c) === null && c.includes('r="47"') && c.includes('r="31"'));
  ok('...the ring and the letter keep the colour of the compound whatever the life is', [a, b, c, d].every(s => s.includes('stroke="#e8002d" stroke-width="8"') && s.includes('>S</text>')));
  ok('...a Wet tyre has its own colour and an Intermediate shows an I', Tyw.wearSvg('W', 60).includes('#0067ff') && Tyw.wearSvg('INT', 60).includes('>I</text>'));
  ok('...it says what it is for a screen reader', b.includes('aria-label="Soft tyres, 50% life"')); }

// ---- the ring ----
{ const r = Tyw.ringSvg(62, '#3ecf8e'), z = Tyw.ringSvg(0, '#e5484d');
  ok('the ring is a circle of r=46 with pathLength 100, a dash of the life, turned to start at the top', r.includes('r="46"') && r.includes('pathLength="100"') && r.includes('stroke-dasharray="62.00 100"') && r.includes('rotate(-90 50 50)'));
  ok('...at 0% only the empty track is drawn', !z.includes('stroke-dasharray')); }

// ---- the content of a lane ----
{ const wear = html(row(62), {}), ring = html(row(62), { look: 'ring' }), bar = html(row(62), { look: 'bar' }), vbar = html(row(62), { look: 'bar', dir: 'vertical', thick: 40 }), num = html(row(62), { look: 'number' });
  ok('the tyre that wears away shows the picture, the percentage, what is left and the grip effect', wear.includes('twpic') && wear.includes('>62%<') && wear.includes('14 laps left') && wear.includes('grip +2%') && !wear.includes('Soft<'));
  ok('...the ring look has the ring and the tyre in it (the drawn tyre without a picture set)', ring.includes('twringw') && ring.includes('stroke-dasharray="62.00 100"') && ring.includes('twin'));
  ok('...a picture set tyre goes inside the ring', Tyw.rowHtml(row(62), { look: 'ring', tyreImages: { S: 'data:image/png;base64,AAA' } }).html.includes('src="data:image/png;base64,AAA"'));
  ok('...the bar is the bar of the Fuel widget (fbar, ffill, ftxt) with the percentage and what is left in it, and the tyre chip in front', bar.includes('class="fbar"') && bar.includes('width:62%') && bar.includes('62% · 14 laps') && bar.includes('twchip2'));
  ok('...the vertical bar stands up (fv, height), has the thickness, and no chip', vbar.includes('fbar fv') && vbar.includes('height:62%') && vbar.includes('--th:40') && !vbar.includes('twchip2'));
  ok('...a bar that stands up is narrow, so it has one short thing in it: the percentage (BOX at 0%, what is left when the percentage is off)', /class="ftxt">62%</.test(vbar) && !vbar.includes('laps') && /class="ftxt">BOX</.test(html(row(0, { level: 'out', leftText: '0 laps' }), { look: 'bar', dir: 'vertical' })) && /class="ftxt">14 laps</.test(html(row(62), { look: 'bar', dir: 'vertical', showPct: false })));
  ok('...number only: "62% · 14 laps"', num.includes('62% · 14 laps') && !num.includes('twpic'));
  ok('...number only with just the laps ticked is "14 laps"; with nothing ticked it is still the percentage', html(row(62), { look: 'number', showPct: false }).includes('>14 laps<') && html(row(62), { look: 'number', showPct: false, showLeft: false, showGrip: false }).includes('62%')); }

// ---- the switches ----
{ const w = (o, r = row(62)) => html(r, o);
  ok('the percentage switch', !w({ showPct: false }).includes('twpct') && w({}).includes('twpct'));
  ok('the laps left switch', !w({ showLeft: false }).includes('laps left') && w({}).includes('laps left'));
  ok('the grip effect switch (and a car that is not helped or hindered through the fuel rules shows none)', !w({ showGrip: false }).includes('grip') && !w({}, row(62, { effect: null })).includes('grip'));
  ok('the tyre name switch', w({ showName: true }).includes('twnm">Soft<') && !w({}).includes('twnm'));
  ok('the grip effect says minus with a real minus sign and has the colours', w({}, row(30, { effect: -9, effectText: T.effectText(-9) })).includes('grip −9%') && w({}, row(30, { effect: -9, effectText: '−9%' })).includes('twgr down') && w({}).includes('twgr up'));
  const out = row(0, { level: 'out', leftText: '0 laps', effect: -30, effectText: '−30%' });
  ok('at 0% it says BOX NOW instead of the laps left, and the widget turns dark red', w({}, out).includes('BOX NOW') && !w({}, out).includes('laps left') && Tyw.rowHtml(out, {}).bg === '#4a1f22');
  ok('...with the switch off it says what is left (0 laps), the widget still turns dark red', !w({ showBox: false }, out).includes('BOX NOW') && w({ showBox: false }, out).includes('0 laps left') && Tyw.rowHtml(out, { showBox: false }).bg !== undefined);
  ok('...the number only look says BOX', html(out, { look: 'number' }).includes('0% · BOX') && html(out, { look: 'bar' }).includes('0% · BOX'));
  ok('...above 0% the widget keeps its own background', Tyw.rowHtml(row(62), {}).bg === undefined && Tyw.rowHtml(row(8, { level: 'crit' }), {}).bg === undefined); }

// ---- the colours follow the warning levels ----
{ const col = (life, o) => { const m = /class="twpct" style="color:([^"]+)"/.exec(html(row(life), o)); return m && m[1]; };
  ok('green above the warning level, amber at it and below, red at the critical level and below, red at 0%', col(80) === '#3ecf8e' && col(25) === '#ffb84d' && col(11) === '#ffb84d' && col(10) === '#e5484d' && col(3) === '#e5484d');
  ok('...the colours are the ones of the widget, and a colour that is not a colour is the standard', col(80, { okColor: '#00ff00' }) === '#00ff00' && col(80, { okColor: 'red;background:url(x)' }) === '#3ecf8e'); }

// ---- Distance Racing says metres ----
{ const r = race({ unit: 'distance' }, { ctx: { laneLen: [15, 15], disp: 'm' } }); r.cross(0, 10000);
  const h = Tyw.content({}, r.cars[0], S(r), 10000).html;
  ok('in a race that counts per distance the words say "m left" (and feet when the app says feet)', /\d+ m left/.test(h) && !h.includes('laps left'));
  const f = race({ unit: 'distance' }, { ctx: { laneLen: [15, 15], disp: 'ft' } }); f.cross(0, 10000);
  ok('...feet', /\d+ ft left/.test(Tyw.content({}, f.cars[0], S(f), 10000).html)); }

// ---- from a race ----
{ const r = race({}); r.cross(0, 10000); r.cross(0, 20000);
  const c = Tyw.content({}, r.cars[0], S(r), 20000), c1 = Tyw.content({ look: 'number' }, r.cars[1], S(r), 20000);
  ok('the widget reads the life from the race: a Soft after two laps is 91%, a Medium that has not driven is 100%', c.html.includes('>91%<') && c1.html.includes('100%'));
  ok('a race without Tyre Wear shows a dash, and so does a lane that is not in the race', Tyw.content({}, race(null).cars[0], S(race(null)), 0).html === '–' && Tyw.content({}, { lane: 9 }, S(r), 0).html === '–');
  const pit = race({ changeSeconds: 4 }); pit.cross(0, 10000); pit.block(0, 12000); pit.tick(15000);
  const fit = Tyw.content({}, pit.cars[0], S(pit), 15000).html;
  ok('while the tyres are being changed it says Fitting, with the seconds that are left', fit.includes('twfit') && /Fitting Soft · 1\.0 s/.test(fit)); }

// ---- the sample of the layout editor ----
{ const s = l => Tyw.sample(l, {});
  ok('the layout editor shows made-up lanes from new to worn out (100%, 62%, 35%, 12%, BOX NOW)', s(0).includes('100%') && s(1).includes('62%') && s(2).includes('35%') && s(3).includes('12%') && s(4).includes('BOX NOW'));
  ok('...in every look (the picture, the ring, the bar, the number)', Tyw.sample(1, { opt: { look: 'wear' } }).includes('twpic') && Tyw.sample(1, { opt: { look: 'ring' } }).includes('twringw') && Tyw.sample(1, { opt: { look: 'bar' } }).includes('fbar') && Tyw.sample(1, { opt: { look: 'number' } }).includes('62% · 14 laps')); }

// ---- the cell of the grids ----
{ const c = Tyw.cellHtml(row(62)), w = Tyw.cellHtml(row(20, { level: 'warn' })), x = Tyw.cellHtml(row(5, { level: 'crit' }));
  ok('the Tyres cell: a tyre chip, the life and a small bar', c.includes('twchip2') && c.includes('>62%<') && c.includes('twmini') && c.includes('width:62.0%'));
  ok('...amber and red follow the warning levels', w.includes('#ffb84d') && x.includes('#e5484d') && c.includes('#3ecf8e'));
  ok('...no tyre wear: a dash; plain text for a PDF', Tyw.cellHtml(null) === '–' && Tyw.cellText(row(62)) === 'S 62%' && Tyw.cellText(null) === '–'); }

// ---- the register ----
{ const def = Wd.REGISTRY.find(x => x.type === 'tyrelife');
  ok('the register has the Tyre Degradation widget: per lane, in the Weather group, with the options and a sample', !!def && def.perLane && def.group === 'Weather' && def.options === Tyw.OPTIONS && typeof def.sample === 'function' && def.label === 'Tyre Degradation');
  ok('...a picture set of tyres chosen in the widget gives its pictures', (Wd.resolveOpt({ type: 'tyrelife', opt: { imageSet: 's1' } }, [{ id: 's1', kind: 'tyres', images: { S: 'data:x' } }]).tyreImages || {}).S === 'data:x');
  ok('...the Leaderboard has a Tyre life column that is off to begin with', (Wd.REGISTRY.find(x => x.type === 'leaderboard').options.find(o => o.key === 'colTyres') || {}).default === false);
  const rows = [{ pos: 1, name: 'A', laps: '3', best: '9.1', gap: '', tyres: '<b>T</b>' }];
  ok('...and puts the cell in the table when it is ticked, nothing when it is not', Wd.leaderHtml(rows, { colTyres: true }).includes('<td class="lb-tyres"><b>T</b></td>') && !Wd.leaderHtml(rows, {}).includes('lb-tyres')); }

// ---- in the live page ----
{ const r = race({}); r.cross(0, 10000); r.cross(1, 10000);
  const out = Tm.content({ type: 'tyrelife', lane: 0, opt: {} }, S(r, 10000)), none = Tm.content({ type: 'tyrelife', lane: 0, opt: {} }, S(race(null), 10000));
  ok('the timing page draws the widget for a lane (a Soft after one lap: 96%) and a dash when the race has no Tyre Wear', (out.html || '').includes('>96%<') && none.html === '–');
  const lb = Tm.content({ type: 'leaderboard', opt: { colTyres: true } }, S(r, 10000)), lb0 = Tm.content({ type: 'leaderboard', opt: {} }, S(r, 10000));
  ok('the Leaderboard shows the Tyre life column when it is ticked: a chip, the life and a bar for every driver', (lb.html.match(/class="lb-tyres"><span class="twcell/g) || []).length === 2 && lb.html.includes('>96%<') && lb.html.includes('>97%<') && !lb0.html.includes('lb-tyres'));
  const lbNo = Tm.content({ type: 'leaderboard', opt: { colTyres: true } }, S(race(null), 10000));
  ok('...in a race without Tyre Wear the column shows dashes', lbNo.html.includes('lb-tyres') && !lbNo.html.includes('twcell')); }

// ---- the Driver stats grid ----
{ const cells = Dg.CELLS || [], a = cells.find(x => x.key === 'tyrelife'), b = cells.find(x => x.key === 'tyreleft');
  ok('the Driver stats grid has two new cells: Tyre life (chip, life, bar) and Tyre laps left (a number)', !!a && !!b && a.type === 'tyrelife' && a.opt.look === 'cell' && b.type === 'tyrelife' && b.opt.look === 'number' && b.opt.showPct === false);
  ok('...they show only in a race with Tyre Wear (not with just a weather system)', Dg.applies('tyrelife', { tyrewear: true }) && !Dg.applies('tyrelife', { tyres: true }) && Dg.applies('tyreleft', { tyrewear: true }) && !Dg.applies('tyreleft', {}) && Dg.NEEDS.tyrewear.includes('Tyre Wear System'));
  ok('...a saved grid with them keeps them', Dg.clean({ cols: 4, rows: 8, boards: [{ c: 1, r: 1, w: 2, h: 1, opt: { cell: 'tyrelife', label: true } }] }).boards.length === 1); }

console.log(fails ? `${fails} TYRE WIDGET TESTS FAILED` : 'ALL TYRE WIDGET TESTS PASSED');
process.exit(fails ? 1 : 0);
