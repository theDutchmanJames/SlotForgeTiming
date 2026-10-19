// 1.54.0: the Pace meter widget and the Pace cells (pacewidgets.js): the looks, the options, the colours, the words, the sample of the layout editor, and the place in the register of the widgets.
const Pw = require('../renderer/pacewidgets.js'), Ps = require('../renderer/pushsave.js'), Wd = require('../renderer/widgets.js'), E = require('../renderer/engine.js'), T = require('../renderer/tyrewear.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const cfg = Ps.clean({});
const info = (p, o = {}) => { const e = Ps.lapEffect(cfg, { lapMs: 10000 * (1 + p / 100), ref: 10000, lapNo: 5 }); return { kind: e.kind, p: e.p, why: e.why, tyres: e.tyres, fuel: e.fuel, ref: 10000, src: 'record', ...o }; };

ok('four looks to choose from, the badge first (the cell look is not one to choose)', same(Pw.LOOKS.map(l => l[0]), ['badge', 'gauge', 'bar', 'wear']) && Pw.OPTIONS[0].key === 'look' && Pw.OPTIONS[0].default === 'badge' && Pw.OPTIONS[0].rerender === true && Pw.look({ look: 'cell' }) === 'cell' && Pw.look({ look: 'nonsense' }) === 'badge' && Pw.look({}) === 'badge' && Pw.look(null) === 'badge');
ok('the options: the percentage, the wear and the reference lap (off to begin with), the three colours', same(Pw.OPTIONS.map(o => o.key), ['look', 'showPct', 'showWear', 'showRef', 'pushColor', 'normalColor', 'saveColor']) && Pw.DEFAULTS.showPct === true && Pw.DEFAULTS.showWear === true && Pw.DEFAULTS.showRef === false && Pw.OPTIONS.every(o => o.label && o.type));

{ const h = Pw.rowHtml(info(0.4), cfg, {}).html;
  ok('the badge: the kind, how far over the best lap, and the wear under it', h.includes('class="pspill psk-push"') && h.includes('>PUSH<') && h.includes('+0.4%') && h.includes('tyres ×1.35 · fuel ×1.22') && !h.includes('psgauge') && !h.includes('record'));
  ok('...with the colour of the kind (PUSH red, NORMAL grey, SAVE green) that you can change', h.includes('background:#ff6b6f') && Pw.rowHtml(info(3), cfg, {}).html.includes('background:#c9ced6') && Pw.rowHtml(info(6), cfg, {}).html.includes('background:#3ecf8e') && Pw.rowHtml(info(0.4), cfg, { pushColor: '#112233' }).html.includes('background:#112233'));
  ok('...a colour that is not a colour is the standard one (nothing can be slipped into the style)', Pw.rowHtml(info(0.4), cfg, { pushColor: 'red;background:url(x)' }).html.includes('background:#ff6b6f') && !Pw.rowHtml(info(0.4), cfg, { pushColor: 'red;background:url(x)' }).html.includes('url('));
  ok('...the percentage, the wear and the reference lap can be switched', !Pw.rowHtml(info(0.4), cfg, { showPct: false }).html.includes('+0.4%') && !Pw.rowHtml(info(0.4), cfg, { showWear: false }).html.includes('×1.35') && Pw.rowHtml(info(0.4), cfg, { showRef: true }).html.includes('10.000 s, record') && Pw.rowHtml(info(0.4, { ref: 0, src: '' }), cfg, { showRef: true }).html.includes('no reference lap yet') && Pw.rowHtml(info(0.4, { src: 'race' }), cfg, { showRef: true }).html.includes('10.000 s, this race')); }
{ const g = Pw.rowHtml(info(0.4), cfg, { look: 'gauge' }).html, b = Pw.rowHtml(info(0.4), cfg, { look: 'bar' }).html, w = Pw.rowHtml(info(0.4), cfg, { look: 'wear' }).html, c = Pw.rowHtml(info(0.4), cfg, { look: 'cell' }).html;
  ok('the gauge: a half circle with the three zones and a needle, and the words under it', g.includes('<svg class="psgauge"') && (g.match(/<path d="M[^"]*A40 40/g) || []).length === 3 && g.includes('<circle') && g.includes('PUSH') && g.includes('+0.4%'));
  ok('the bar: a strip with the three zones and a marker at the pace', b.includes('class="psbar"') && b.includes('linear-gradient') && b.includes('class="psmark"') && /left:[\d.]+%/.test(b) && b.includes('PUSH'));
  ok('the wear look: the numbers of the tyres and the fuel only (and only for what the system changes)', w.includes('pswear') && w.includes('Tyres') && w.includes('×1.35') && w.includes('Fuel') && w.includes('×1.22') && !w.includes('PUSH')
    && !Pw.rowHtml(info(0.4), Ps.clean({ tyres: 'off' }), { look: 'wear' }).html.includes('Tyres') && Pw.rowHtml(info(0.4), Ps.clean({ tyres: 'off', fuel: 'off' }), { look: 'wear' }).html.includes('–'));
  ok('the cell of the grids: the pill and the percentage on one line (no wear, no reference)', c.includes('class="pscell"') && c.includes('PUSH') && c.includes('+0.4%') && !c.includes('×')); }
{ const early = info(0, { kind: 'normal', p: null, why: 'early', tyres: 1, fuel: 1 });
  ok('a car with no pace (the first laps, a lap with a stop...) shows NORMAL and the reason, and the needle and the marker are left out', Pw.rowHtml(early, cfg, {}).html.includes('NORMAL') && Pw.rowHtml(early, cfg, {}).html.includes('the effect has not started yet') && !Pw.rowHtml(early, cfg, { look: 'gauge' }).html.includes('<circle') && !Pw.rowHtml(early, cfg, { look: 'bar' }).html.includes('psmark'));
  ok('...no engine, no system or no car is a dash, never an error', Pw.rowHtml(null, cfg, {}).html === '–' && Pw.rowHtml(info(1), null, {}).html === '–' && Pw.content({}, null, { eng: { pushSave: cfg, psInfo: () => info(1) } }).html === '–' && Pw.content({}, {}, { eng: { pushSave: null } }).html === '–' && Pw.content({}, {}, null).html === '–'); }
ok('the scale: PUSH from 0 to a percent under normal pace, NORMAL around it, SAVE after, the scale ending a quarter after the most saving pace; the needle stays on it', same(Pw.scale(cfg), { max: 10, a: 0.2, b: 0.4 }) && Pw.share(cfg, 0) === 0 && Pw.share(cfg, 5) === 0.5 && Pw.share(cfg, 99) === 1 && Pw.share(cfg, null) === 0);
ok('...a small normal pace has a small band (half of it)', same(Pw.scale(Ps.clean({ normal: 1, saveAt: 4 })), { max: 5, a: 0.1, b: 0.3 }));
ok('the words for a list or the audio', Pw.cellText(info(0.4), cfg) === 'PUSH +0.4%, tyres ×1.35 · fuel ×1.22' && Pw.cellText(info(0.4), Ps.clean({ fuel: 'off' })) === 'PUSH +0.4%, tyres ×1.35' && Pw.cellText({ ...info(0), p: null, why: 'pit', tyres: 1, fuel: 1 }, cfg) === 'a lap with a stop, tyres ×1.00 · fuel ×1.00' && Pw.cellText(null, cfg) === '');
ok('...a side that the system leaves alone is left out of the words (and of the wear line of the badge)', Pw.cellText(info(0.4), Ps.clean({ tyres: 'off' })) === 'PUSH +0.4%, fuel ×1.22' && Pw.wearLine(info(0.4), Ps.clean({ tyres: 'off' })) === 'fuel ×1.22' && Pw.wearLine(info(0.4), Ps.clean({ fuel: 'off' })) === 'tyres ×1.35' && Pw.wearLine(info(0.4), Ps.clean({ tyres: 'off', fuel: 'off' })) === '');
ok('the sample of the layout editor: a different pace for every lane, from the made-up values', [0, 1, 2, 3].map(l => Pw.sample(l, { opt: {} })).every(h => h.includes('pspill')) && Pw.sample(0, { opt: {} }).includes('PUSH') && Pw.sample(1, { opt: {} }).includes('NORMAL') && Pw.sample(2, { opt: {} }).includes('SAVE') && Pw.sample(0, { opt: { look: 'gauge' } }).includes('psgauge') && Pw.sample(0).includes('pspill'));

// a real engine
{ const entries = [0, 1].map(i => ({ lane: i, driverId: 'd' + i, driverName: 'D' + i, tyre: 'S', psRec: 10000 }));
  const r = E.createRace({ type: 'race', laps: 60, duration: 30, endRule: 'all', entries, fuel: { on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000 }, tyrewear: T.clean({}), pushsave: cfg });
  r.start(0); r.cars.forEach(c => { c.started = true; }); let t = 0; [10000, 10000, 10040].forEach(ms => { t += ms; r.cross(0, t); });
  const h = Pw.content({ look: 'badge', showRef: true }, r.cars[0], { eng: r }).html;
  ok('the widget of a car in a race: the pace of its last lap, the wear and the reference lap', h.includes('PUSH') && h.includes('+0.4%') && h.includes('tyres ×1.35') && h.includes('10.000 s, record'));
  ok('...a car that has not driven is NORMAL', Pw.content({}, r.cars[1], { eng: r }).html.includes('NORMAL')); }

// the register of the widgets
{ const d = Wd.def('pace'), tyres = Wd.REGISTRY.filter(x => x.group === 'Tyres').map(x => x.type);
  ok('the Pace meter is a widget of every lane, in the folder Tyres of the Add widget list, with its options and its sample', d && d.label === 'Pace meter' && d.group === 'Tyres' && d.perLane === true && same(d.options, Pw.OPTIONS) && typeof d.sample === 'function' && same(tyres, ['tyre', 'tyrelife', 'pace', 'tyresets']));
  ok('...a sample in the layout editor is the same as the sample of the module', d.sample(0, { opt: {} }) === Pw.sample(0, { opt: {} }));
  ok('the Leaderboard has a Pace column: a classic option, off to begin with, and the cell that was made is shown as it is', Wd.def('leaderboard').options.find(o => o.key === 'colPace').classic === true && Wd.leaderHtml([{ pos: 1, name: 'A', pace: '<b>P</b>' }], { colPace: true }).includes('<td class="lb-pace"><b>P</b></td>') && Wd.leaderHtml([{ pos: 1, name: 'A' }], { colPace: true }).includes('<td class="lb-pace">–</td>')); }

if (fails) { console.log(`\n${fails} PACE WIDGET TESTS FAILED`); process.exit(1); } else console.log('\nPACE WIDGET TESTS PASSED');
