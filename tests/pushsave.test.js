// 1.54.0: the Push and Save System: the rules and words (pushsave.js), the record and the race setup field (schema.js), and the race engine (engine.js):
// the pace of a lap (against the reference lap of the driver) changes how fast the tyres and the fuel are used up. Lap times and grip are never touched.
const fs = require('fs'), os = require('os'), path = require('path');
const E = require('../renderer/engine.js'), Ps = require('../renderer/pushsave.js'), T = require('../renderer/tyrewear.js'), S = require('../schema.js'), LS = require('../renderer/liveshare.js');
const Database = require('../db.js'), Tr = require('../transfer.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;
const r2 = n => Math.round(n * 100) / 100;

// ---- the rules and the words ----
ok('a new system starts with normal pace at the best lap +3%, the most saving at +8%, the effect from lap 3 and laps over 150% as usual, yellow laps saving, and the numbers of the Standard preset',
  same(Ps.DEFAULTS, { normal: 3, saveAt: 8, from: 3, slow: 150, yellowSave: 'on', tyres: 'on', tyreExtra: 40, tyreSave: 30, fuel: 'on', fuelExtra: 25, fuelSave: 20 }) && same(Ps.defaults(), Ps.DEFAULTS) && Ps.defaults() !== Ps.DEFAULTS);
ok('three ready-made systems, in this order, that only change the four wear numbers (Standard is the starting value of the form)', same(Ps.PRESET_KEYS, ['standard', 'gentle', 'strong'])
  && Ps.PRESET_KEYS.every(k => same(Object.keys(Ps.PRESETS[k].values), ['tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave']) && Ps.PRESETS[k].name && Ps.PRESETS[k].note)
  && same(Ps.PRESETS.standard.values, { tyreExtra: 40, tyreSave: 30, fuelExtra: 25, fuelSave: 20 }) && Ps.PRESETS.gentle.values.tyreExtra < 40 && Ps.PRESETS.strong.values.tyreExtra > 40);
ok('no record, no system (and a record that is not a record is none either)', Ps.clean(null) === null && Ps.clean(undefined) === null && Ps.clean('x') === null && Ps.clean(5) === null);
ok('an empty record gets the standard numbers', same(Ps.clean({}), { normal: 3, saveAt: 8, from: 3, slow: 150, yellowSave: true, tyres: { on: true, extra: 40, save: 30 }, fuel: { on: true, extra: 25, save: 20 } }));
ok('the numbers of a record are kept (text with a comma too), and an empty or text value is the standard',
  same(Ps.clean({ normal: '2,5', saveAt: 6, from: 5, slow: 200, tyreExtra: 10, tyreSave: 5, fuelExtra: 60, fuelSave: 45 }), { normal: 2.5, saveAt: 6, from: 5, slow: 200, yellowSave: true, tyres: { on: true, extra: 10, save: 5 }, fuel: { on: true, extra: 60, save: 45 } })
  && Ps.clean({ normal: '' }).normal === 3 && Ps.clean({ normal: 'abc' }).normal === 3 && Ps.clean({ tyreExtra: '' }).tyres.extra === 40);
ok('...within their limits: normal pace 0 to 50, the saving pace to 100, the first lap 1 to 100 (whole), the slow limit 101 to 1000, extra to 500 and saving to 90',
  Ps.clean({ normal: 99 }).normal === 50 && Ps.clean({ normal: -3 }).normal === 0 && Ps.clean({ saveAt: 500 }).saveAt === 100 && Ps.clean({ from: 0 }).from === 1 && Ps.clean({ from: 2.6 }).from === 3 && Ps.clean({ from: 900 }).from === 100
  && Ps.clean({ slow: 50 }).slow === 101 && Ps.clean({ slow: 5000 }).slow === 1000 && Ps.clean({ tyreExtra: 900 }).tyres.extra === 500 && Ps.clean({ tyreSave: 99 }).tyres.save === 90 && Ps.clean({ fuelSave: -5 }).fuel.save === 0);
ok('...the most saving pace is always more than normal pace (the saving needs room to grow in): it is made 1 more', Ps.clean({ normal: 5, saveAt: 5 }).saveAt === 6 && Ps.clean({ normal: 5, saveAt: 2 }).saveAt === 6 && Ps.clean({ normal: 50, saveAt: 60 }).saveAt === 60);
ok('the tyres and the fuel can each be switched off, and so can the saving under yellow', Ps.clean({ tyres: 'off' }).tyres.on === false && Ps.clean({ tyres: 'off' }).fuel.on === true && Ps.clean({ fuel: 'off' }).fuel.on === false && Ps.clean({ yellowSave: 'off' }).yellowSave === false && Ps.clean({ yellowSave: 'on' }).yellowSave === true);
{ const c = Ps.clean({ normal: 2, saveAt: 6, tyres: 'off', fuelExtra: 33 });
  ok('a config that was cleaned before (and sent to another window) is made safe again, and is the same when it was safe already', Ps.fromConfig(null) === null && Ps.fromConfig('x') === null && same(Ps.fromConfig(c), c) && same(Ps.fromConfig(JSON.parse(JSON.stringify(c))), c)
    && Ps.fromConfig({ normal: 5, saveAt: 1 }).saveAt === 6 && Ps.fromConfig({}).tyres.on === true && Ps.fromConfig({ tyres: { on: false } }).tyres.on === false); }
ok('...with the same limits as the record: saving to 90, extra to 500, on both sides', Ps.fromConfig({ tyres: { save: 99 } }).tyres.save === 90 && Ps.fromConfig({ fuel: { save: 99 } }).fuel.save === 90 && Ps.fromConfig({ tyres: { extra: 900 } }).tyres.extra === 500 && Ps.fromConfig({ fuel: { extra: 900 } }).fuel.extra === 500 && Ps.fromConfig({ fuel: { save: 93 } }).tyres.save === 30);
ok('the pace of a lap is how many percent it is slower than the reference lap: 0 for a lap that is as fast or faster, nothing when there is nothing to compare',
  Ps.paceOf(10300, 10000) === 3 && Ps.paceOf(10000, 10000) === 0 && Ps.paceOf(9800, 10000) === 0 && near(Ps.paceOf(10043, 10000), 0.43) && Ps.paceOf(10000, 0) === null && Ps.paceOf(0, 10000) === null && Ps.paceOf(10000, undefined) === null);

// the numbers of the wear at a pace (the Standard system), as they are on the mock-up
{ const c = Ps.clean({}), m = (what, p) => r2(Ps.mult(c, what, p));
  ok('flat out (the reference lap) wears the tyres 40% and the fuel 25% more', m('tyres', 0) === 1.4 && m('fuel', 0) === 1.25);
  ok('...between flat out and normal pace the wear goes down in a straight line: +0.4% is x1.35 and x1.22, +1.3% x1.23 and x1.14', m('tyres', 0.4) === 1.35 && m('fuel', 0.4) === 1.22 && m('tyres', 1.3) === 1.23 && m('fuel', 1.3) === 1.14 && m('tyres', 1.5) === 1.2 && m('fuel', 1.5) === 1.13);
  ok('...the number is kept to four decimals (+0.7% is x1.3067), so a lap of many hundredths is not rounded to a whole percent', Ps.mult(c, 'tyres', 0.7) === 1.3067 && Ps.mult(c, 'fuel', 0.7) === 1.1917);
  ok('normal pace (the best lap +3%) is the usual wear', Ps.mult(c, 'tyres', 3) === 1 && Ps.mult(c, 'fuel', 3) === 1);
  ok('...slower than that saves, in a straight line to the most saving pace: +4.3% is x0.92 and x0.95, +5% x0.88 and x0.92, +7.1% x0.75 and x0.84', m('tyres', 4.3) === 0.92 && m('fuel', 4.3) === 0.95 && m('tyres', 5) === 0.88 && m('fuel', 5) === 0.92 && m('tyres', 7.1) === 0.75 && m('fuel', 7.1) === 0.84);
  ok('...from the most saving pace (+8%) on it stays there: x0.70 and x0.80, however slow the lap', m('tyres', 8) === 0.7 && m('fuel', 8) === 0.8 && m('tyres', 40) === 0.7 && m('fuel', 99) === 0.8);
  ok('a side that is switched off, no system and no pace do not change anything', Ps.mult(Ps.clean({ tyres: 'off' }), 'tyres', 0) === 1 && Ps.mult(Ps.clean({ tyres: 'off' }), 'fuel', 0) === 1.25 && Ps.mult(null, 'tyres', 0) === 1 && Ps.mult(c, 'tyres', null) === 1 && Ps.mult(c, 'tyres', undefined) === 1);
  ok('normal pace at 0% (the best lap itself) saves from the first bit of slowness, and the best lap itself is still flat out', Ps.mult(Ps.clean({ normal: 0, saveAt: 4 }), 'tyres', 0) === 1.4 && r2(Ps.mult(Ps.clean({ normal: 0, saveAt: 4 }), 'tyres', 2)) === 0.85);
  ok('PUSH is more than a percent faster than normal pace, SAVE more than a percent slower, in between is NORMAL (a band of one percent; half of a small normal pace)',
    Ps.kind(c, 0) === 'push' && Ps.kind(c, 1.9) === 'push' && Ps.kind(c, 2) === 'normal' && Ps.kind(c, 3) === 'normal' && Ps.kind(c, 4) === 'normal' && Ps.kind(c, 4.1) === 'save' && Ps.kind(c, 30) === 'save'
    && Ps.kind(Ps.clean({ normal: 1 }), 0.4) === 'push' && Ps.kind(Ps.clean({ normal: 1 }), 0.5) === 'normal' && Ps.kind(Ps.clean({ normal: 1 }), 1.5) === 'normal' && Ps.kind(Ps.clean({ normal: 1 }), 1.6) === 'save' && Ps.kind(c, null) === 'normal' && Ps.kind(null, 5) === 'normal'); }

// what a lap does
{ const c = Ps.clean({}), lap = (o = {}) => Ps.lapEffect(c, { lapMs: 10040, ref: 10000, lapNo: 5, ...o }), usual = e => e.tyres === 1 && e.fuel === 1 && e.kind === 'normal';
  const e = lap();
  ok('a lap that counts: the pace, the kind and the numbers of the wear', e.why === '' && e.p === 0.4 && e.kind === 'push' && r2(e.tyres) === 1.35 && r2(e.fuel) === 1.22);
  ok('no system, a lap with a stop, the first lap after a pause, no reference lap yet and a lap before the effect starts all wear as usual (and say why)',
    usual(Ps.lapEffect(null, { lapMs: 10040, ref: 10000, lapNo: 5 })) && Ps.lapEffect(null, { lapMs: 10040, ref: 10000, lapNo: 5 }).why === 'off'
    && usual(lap({ pit: true })) && lap({ pit: true }).why === 'pit' && usual(lap({ resumed: true })) && lap({ resumed: true }).why === 'resumed' && usual(lap({ ref: 0 })) && lap({ ref: 0 }).why === 'noref' && lap({ lapMs: 0 }).why === 'noref'
    && usual(lap({ lapNo: 2 })) && lap({ lapNo: 2 }).why === 'early' && lap({ lapNo: 3 }).why === '' && lap({ lapNo: 3 }).kind === 'push' && e.p === 0.4);
  ok('...the effect starts at the lap the system says (lap 3 to begin with; 1 is from the first lap)', Ps.lapEffect(Ps.clean({ from: 6 }), { lapMs: 10040, ref: 10000, lapNo: 5 }).why === 'early' && Ps.lapEffect(Ps.clean({ from: 6 }), { lapMs: 10040, ref: 10000, lapNo: 6 }).why === '' && Ps.lapEffect(Ps.clean({ from: 1 }), { lapMs: 10040, ref: 10000, lapNo: 1 }).why === '');
  ok('a very slow lap (over 150% of the best lap to begin with) wears as usual, and still says the pace; exactly the limit counts', lap({ lapMs: 15001 }).why === 'slow' && usual(lap({ lapMs: 15001 })) && lap({ lapMs: 15001 }).p === 50.01 && lap({ lapMs: 15000 }).why === '' && lap({ lapMs: 15000 }).kind === 'save' && r2(lap({ lapMs: 15000 }).tyres) === 0.7);
  ok('...under yellow (a full lap under the yellow flag or the Safety Car) it is saving instead, when the system says so; with that switched off a slow lap is a slow lap', lap({ lapMs: 30000, yellow: true }).why === '' && lap({ lapMs: 30000, yellow: true }).kind === 'save' && r2(lap({ lapMs: 30000, yellow: true }).tyres) === 0.7 && r2(lap({ lapMs: 30000, yellow: true }).fuel) === 0.8
    && Ps.lapEffect(Ps.clean({ yellowSave: 'off' }), { lapMs: 30000, ref: 10000, lapNo: 5, yellow: true }).why === 'slow' && Ps.lapEffect(Ps.clean({ yellowSave: 'off' }), { lapMs: 10500, ref: 10000, lapNo: 5, yellow: true }).why === ''); }

ok('the words: kinds, percentages, multipliers', Ps.kindText('push') === 'PUSH' && Ps.kindText('normal') === 'NORMAL' && Ps.kindText('save') === 'SAVE' && Ps.kindText('x') === 'NORMAL' && Ps.pctText(0.4) === '+0.4%' && Ps.pctText(3) === '+3.0%' && Ps.pctText(7.14) === '+7.1%' && Ps.pctText(null) === '' && Ps.pctText(undefined) === ''
  && Ps.multText(1.35) === '×1.35' && Ps.multText(1) === '×1.00' && Ps.multText(0.7) === '×0.70' && Ps.multText(1.2267) === '×1.23');
ok('the rules in one line: normal pace and the ranges of the wear', Ps.rulesText(Ps.clean({})) === 'normal pace is the best lap +3%; tyres ×1.40 to ×0.70, fuel ×1.25 to ×0.80' && Ps.rulesText(Ps.clean({ normal: 2.5, tyres: 'off' })) === 'normal pace is the best lap +2.5%; fuel ×1.25 to ×0.80'
  && Ps.rulesText(Ps.clean({ tyres: 'off', fuel: 'off' })) === 'normal pace is the best lap +3%; no wear is changed' && Ps.rulesText(null) === '' && Ps.rangeText(Ps.clean({ tyres: 'off' }), 'tyres') === 'unchanged');
ok('why a lap wears as usual, and where the reference lap comes from', Ps.whyText('pit') === 'a lap with a stop' && Ps.whyText('resumed') === 'the first lap after a pause' && Ps.whyText('noref') === 'no reference lap yet' && Ps.whyText('early') === 'the effect has not started yet' && Ps.whyText('slow') === 'a very slow lap' && Ps.whyText('') === '' && Ps.whyText('off') === ''
  && Ps.sourceText('record') === 'record' && Ps.sourceText('race') === 'this race' && Ps.sourceText('') === '');

// ---- the record (the form) and the field of the race setup ----
{ const sys = S.pushsavesystems, f = k => sys.fields.find(x => x.key === k), setup = k => S.racesetups.fields.find(x => x.key === k), g = sys.groups.map(x => x.id);
  const shown = (fld, rec) => !fld.showIf || fld.showIf.some(c => Object.entries(c).every(([k, vs]) => vs.includes(rec[k] ?? '')));
  ok('the push and save systems are a table of the database, with a name and cards that show the two paces', sys && sys.label === 'Push and save system' && sys.plural === 'Push and save systems' && same(sys.title, ['name']) && same(sys.list, ['name', 'normal', 'saveAt']) && same(sys.card, ['normal', 'saveAt']) && sys.extra === false && sys.linked === false);
  ok('...the form has four folders: Basics, Pace, Wear and Which laps count', same(g, ['basics', 'pace', 'wear', 'laps']) && sys.groups.every(x => x.title && x.note));
  ok('...the ready-made systems are buttons in the Basics folder (a field that is not kept), the paces are in Pace and the four wear numbers in Wear, with the standard numbers as starting values',
    f('presets').group === 'basics' && f('presets').type === 'pspresets' && f('normal').group === 'pace' && f('normal').default === 3 && f('saveAt').group === 'pace' && f('saveAt').default === 8 && ['tyreExtra', 'tyreSave', 'fuelExtra', 'fuelSave'].every(k => f(k).group === 'wear' && f(k).type === 'number' && f(k).default === Ps.DEFAULTS[k])
    && f('from').group === 'laps' && f('from').default === 3 && f('slow').group === 'laps' && f('slow').default === 150 && f('yellowSave').group === 'laps' && f('yellowSave').default === 'on');
  ok('...the limits of the form are those of the rules (so the form never keeps a number the rules would change)', f('normal').min === 0 && f('normal').max === 50 && f('saveAt').min === 1 && f('saveAt').max === 100 && f('tyreExtra').max === 500 && f('tyreSave').max === 90 && f('fuelExtra').max === 500 && f('fuelSave').max === 90 && f('from').min === 1 && f('from').max === 100 && f('slow').min === 101 && f('slow').max === 1000);
  ok('...the extra and saving numbers are shown while their switch is on, and hidden when the tyres or the fuel are switched off', ['tyreExtra', 'tyreSave'].every(k => shown(f(k), {}) === false || shown(f(k), { tyres: 'on' })) && ['tyreExtra', 'tyreSave'].every(k => shown(f(k), { tyres: 'on' }) && !shown(f(k), { tyres: 'off' }))
    && ['fuelExtra', 'fuelSave'].every(k => shown(f(k), { fuel: 'on' }) && !shown(f(k), { fuel: 'off' })));
  ok('...the hints say what the paces mean, that the tyres need a Tyre wear system, and that the fuel replaces the target of the Fuel setup', /best lap/.test(f('normal').hint) && /straight line/.test(f('saveAt').hint) && /Tyre wear system/.test(f('tyreExtra').hint) && /target lap time/.test(f('fuelExtra').hint));
  ok('every setting of the form is one of the rules that clean() reads (no setting without a rule)', same(sys.fields.map(x => x.key), ['name', 'presets', 'normal', 'saveAt', 'tyres', 'tyreExtra', 'tyreSave', 'fuel', 'fuelExtra', 'fuelSave', 'from', 'slow', 'yellowSave']));
  ok('a race setup has a Push and save system field in the rules, a choice of the systems, "No push and save" to begin with, for the sessions that race', setup('pushSave') && setup('pushSave').group === 'rules' && setup('pushSave').type === 'ref' && setup('pushSave').ref === 'pushsavesystems' && setup('pushSave').blank === 'No push and save'
    && same(setup('pushSave').showIf, setup('safetyCar').showIf));
  ok('...it sits with the other systems (before the pit stop sensor time), and its hint says what it does with the Fuel setup and where to make one', S.racesetups.fields.filter(x => x.group === 'rules').map(x => x.key).indexOf('pushSave') < S.racesetups.fields.filter(x => x.group === 'rules').map(x => x.key).indexOf('pitHold')
    && /Fuel setup/.test(setup('pushSave').hint) && /not used/.test(setup('pushSave').hint) && /Race Setup > Push and Save Systems/.test(setup('pushSave').hint));
  ok('...and the hint of the target lap time of a Fuel setup says that a Push and save system replaces it', /Push and save system/.test(S.fuelrules.fields.find(x => x.key === 'targetLap').hint)); }

// ---- the race engine ----
const fuel = (x = {}) => ({ on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000, ...x });
const entries = (n, rec) => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: 'S', ...(rec && rec[i] ? { psRec: rec[i] } : {}) }));
// rec: the record of the Push and Save System (null: none); o: { cars, laps, rec: [the record lap (ms) of every driver], fuel (false: none), tyres (false: no Tyre Wear), cfg }
const race = (rec, o = {}) => {
  const r = E.createRace({ type: 'race', laps: o.laps || 60, duration: 30, endRule: 'all', entries: entries(o.cars || 2, o.rec), fuel: o.fuel === false ? undefined : fuel(o.fuel), tyrewear: o.tyres === false ? undefined : T.clean({}),
    pushsave: rec === null ? undefined : Ps.clean(rec), ...(o.cfg || {}) });
  r.start(0); r.cars.forEach(c => { c.started = true; }); return r;
};
const clocks = new WeakMap(), clock = r => { if (!clocks.has(r)) { const t = r.cars.map(() => 0); clocks.set(r, (i, ms) => { t[i] += ms; return r.cross(i, t[i]); }); } return clocks.get(r); };
const lapsOf = (r, i, times) => { const go = clock(r); times.forEach(ms => go(i, ms)); };
const lit = (r, i) => Math.round(r.fuelOf(i, 1e9) * 1e6) / 1e6;
const life = (r, i) => r.cars[i].twLife;
const USUAL = 4.5; // what the Tyre Wear System takes in a lap on the Soft (the standard system)

// no system: nothing changes
{ const r = race(null, { rec: [10000, 10000] }); lapsOf(r, 0, [10000, 10000, 10000, 10000]);
  const f = race(null, { rec: [10000, 10000], tyres: false }); lapsOf(f, 0, [10000, 10000, 10000, 10000]);
  ok('a race without a Push and Save System has none: no pace on the laps, the tyres wear and the fuel is used as usual', r.pushSave === null && r.psInfo(r.cars[0]) === null && r.psRef(r.cars[0]).ms === 0 && near(life(r, 0), 100 - 4 * USUAL) && lit(f, 0) === 92 && r.cars[0].ps.length === 0 && r.cars[0].psNow === null);
  const q = race(null, { cfg: { pushsave: 'nonsense' } });
  ok('...also when the setting that came with the race is not a setting (it is no system)', q.pushSave === null); }

// the tyres, with a record
{ const r = race({ fuel: 'off' }, { rec: [10000, 10000] }); lapsOf(r, 0, [10000, 10000, 10000, 10000, 10300]);
  ok('a race with a system keeps its cleaned settings, and a driver with a record has that as his reference lap', same(r.pushSave, Ps.clean({ fuel: 'off' })) && r.psRef(r.cars[0]).ms === 10000 && r.psRef(r.cars[0]).src === 'record' && r.psRef(r.cars[1]).ms === 10000);
  const d = [USUAL, USUAL, USUAL * 1.4, USUAL * 1.4, USUAL * 1];
  ok('the first two laps wear as usual, the laps at the reference lap (flat out) 40% more, and a lap at normal pace the usual wear: life = 100 - the sum', near(life(r, 0), 100 - d.reduce((a, b) => a + b, 0)) && r.cars[0].ps.length === 5);
  ok('...every lap keeps what its pace did: kind, percentage and the two numbers (tyres, fuel), or why it wore as usual', same(r.cars[0].ps.map(x => x.w), ['early', 'early', '', '', '']) && same(r.cars[0].ps.map(x => x.k), ['normal', 'normal', 'push', 'push', 'normal']) && r.cars[0].ps[2].p === 0 && r.cars[0].ps[4].p === 3 && r.cars[0].ps[2].t === 1.4 && r.cars[0].ps[4].t === 1
    && r.cars[0].ps[2].f === 1 && r.cars[0].psNow === r.cars[0].ps[4]);
  const f = race({ fuel: 'off' }, { rec: [10000, 10000], tyres: false }); lapsOf(f, 0, [10000, 10000, 10000, 10000, 10300]);
  ok('...the fuel is not touched when the system does not change it (the switch is off): the litres of the fuel setup (without tyre wear: new tyres help a car through its fuel)', lit(f, 0) === 100 - 5 * 2);
  ok('the other car, which has not driven, is as it was', life(r, 1) === 100 && r.cars[1].ps.length === 0);
  ok('lap times are never touched', same(r.cars[0].laps, [10000, 10000, 10000, 10000, 10300]) && r.cars[0].best === 10000); }
{ const times = [10000, 10000, 10000, 10000, 10300, 10800, 12000], f = [1, 1, 1.5, 1.5, 1, 0.6, 0.6].map(x => x * 2);
  const a = race({ tyres: 'off', fuelExtra: 50, fuelSave: 40 }, { rec: [10000, 10000], tyres: false }); lapsOf(a, 0, times);
  const b = race({ tyres: 'off', fuelExtra: 50, fuelSave: 40 }, { rec: [10000, 10000] }); lapsOf(b, 0, times);
  ok('the fuel follows the pace in the same way (here 50% more flat out and 40% less when saving)', near(lit(a, 0), 100 - f.reduce((x, y) => x + y, 0)));
  ok('...and the tyres wear as usual when the system leaves them alone', near(life(b, 0), 100 - 7 * USUAL)); }

// the fuel setup: with a system its target lap time, most extra and most saving are not used
{ const F = { target: 10000, extra: 25, saving: 30 };
  const a = race(null, { rec: [10000], fuel: F, cars: 1, tyres: false }), b = race({ tyres: 'off' }, { rec: [10000], fuel: F, cars: 1, tyres: false });
  lapsOf(a, 0, [10800, 10800, 10800]); lapsOf(b, 0, [10800, 10800, 10800]);
  ok('without a system the Fuel setup works from its target lap time (a slow lap uses less); with a system it is the pace that decides: the litres of the fuel setup times the number of the pace',
    lit(a, 0) !== lit(b, 0) && near(lit(a, 0), 100 - 3 * 2 * 10000 / 10800) && near(lit(b, 0), 100 - (2 + 2 + 2 * 0.8)));
  const c = race({ tyres: 'off' }, { rec: [10000], fuel: false, cars: 1 }); lapsOf(c, 0, [10000, 10000, 10000, 10000]);
  ok('a race with a system but no fuel has no fuel to use, and nothing breaks', c.cars[0].laps.length === 4 && c.cars[0].fuel === 0 && c.cars[0].ps[3].f === 1.25); }

{ const r = race({ tyres: 'off' }, { rec: [10000], cars: 1, tyres: false, cfg: { bop: { mode: 'manual' } } }); r.bopSet(0, -20, 0); lapsOf(r, 0, [10000, 10000, 10000]);
  ok('a car that Balance of Power hinders by 20% uses 1.2 times the fuel, and the pace works on top of that: 2.4 + 2.4 + 3.0 litres (the third lap is flat out)', near(lit(r, 0), 100 - (2.4 + 2.4 + 3)) && r.cars[0].ps[2].f === 1.25); }

// no Tyre Wear System: the pace is still told, the fuel still works
{ const r = race({}, { rec: [10000], tyres: false, cars: 1 }); lapsOf(r, 0, [10000, 10000, 10000, 10000]);
  ok('without a Tyre Wear System there are no tyres to wear (the pace and the fuel are there)', r.tyrewear === null && life(r, 0) === 100 && r.cars[0].ps.length === 4 && near(lit(r, 0), 100 - (2 + 2 + 2.5 + 2.5)) && r.psInfo(r.cars[0]).tyreUsual === 0 && r.psInfo(r.cars[0]).tyreLaps === null); }

// the reference lap: the record, or the best lap of the race, whichever is faster
{ const r = race({}, { cars: 2 });
  ok('a driver without a record has no reference lap before his first lap', r.psRef(r.cars[0]).ms === 0 && r.psRef(r.cars[0]).src === '');
  lapsOf(r, 0, [11000, 10500, 10500]);
  ok('...then his best lap of the race (it counts for the lap itself: the first laps are early, and lap 3 at his best is flat out)', r.psRef(r.cars[0]).ms === 10500 && r.psRef(r.cars[0]).src === 'race' && r.cars[0].ps[0].w === 'early' && r.cars[0].ps[2].w === '' && r.cars[0].ps[2].p === 0 && r.cars[0].ps[2].t === 1.4);
  lapsOf(r, 0, [10400]);
  ok('...a lap that beats the reference is the new reference: that lap is flat out', r.psRef(r.cars[0]).ms === 10400 && r.cars[0].ps[3].p === 0 && r.cars[0].ps[3].k === 'push');
  lapsOf(r, 0, [10700]);
  ok('...and the next lap is judged against it (10700 against 10400 is +2.9%: normal pace)', near(r.cars[0].ps[4].p, 2.885, 0.001) && r.cars[0].ps[4].k === 'normal');
  const q = race({}, { rec: [10500, 0] }); lapsOf(q, 0, [10600, 10600, 10000]);
  ok('a record that is slower than the driver drives is beaten by the lap (the reference is the faster of the two, and the source says which)', q.psRef(q.cars[0]).ms === 10000 && q.psRef(q.cars[0]).src === 'race' && q.cars[0].ps[2].p === 0 && q.psRef(q.cars[1]).src === '');
  const s = race({}, { rec: [10000, 10000] }); lapsOf(s, 0, [10000, 10000, 10300]);
  ok('a record that is faster than any lap of the race stays the reference (source: record)', s.psRef(s.cars[0]).ms === 10000 && s.psRef(s.cars[0]).src === 'record' && s.cars[0].ps[2].p === 3 && s.cars[0].ps[2].k === 'normal'); }

// the laps that wear as usual
{ const r = race({}, { rec: [10000, 10000] }); lapsOf(r, 0, [10000, 10000]);
  r.block(0, 20500); r.tick(23000); r.unblock(0, 23000); lapsOf(r, 0, [11000]);
  ok('a lap with a stop in the pits wears as usual (the tyres are changed in the stop, the lap is slow for other reasons)', r.cars[0].ps[2].w === 'pit' && r.cars[0].ps[2].t === 1 && r.cars[0].ps[2].f === 1 && r.cars[0].ps[2].p === null);
  lapsOf(r, 0, [10000]);
  ok('...and the lap after it is a lap again', r.cars[0].ps[3].w === '' && r.cars[0].ps[3].t === 1.4);
  const q = race({}, { rec: [10000, 10000] }); lapsOf(q, 0, [10000, 10000, 20000]);
  ok('a very slow lap (200% of the reference) wears as usual, and does not count as a lap that could be the reference either', q.cars[0].ps[2].w === 'slow' && q.cars[0].ps[2].t === 1 && q.cars[0].ps[2].p === 100 && q.psRef(q.cars[0]).ms === 10000);
  const s = race({ slow: 400 }, { rec: [10000, 10000] }); lapsOf(s, 0, [10000, 10000, 20000]);
  ok('...unless the system allows it: with the limit at 400% that lap is saving, x0.70', s.cars[0].ps[2].w === '' && s.cars[0].ps[2].k === 'save' && s.cars[0].ps[2].t === 0.7); }
{ const r = race({ from: 1 }, { cars: 1, cfg: { maxLap: 20000 } }); lapsOf(r, 0, [25000]);
  ok('a lap that is longer than the longest lap time of the race is no real lap time: it is never the reference lap, so a driver without a record has none after it and the lap wears as usual', r.cars[0].ps[0].w === 'noref' && r.cars[0].ps[0].t === 1 && r.cars[0].ps[0].p === null && r.psRef(r.cars[0]).ms === 0);
  lapsOf(r, 0, [10000]);
  { const q = race({ from: 1 }, { cars: 1, cfg: { maxLap: 20000 } }); lapsOf(q, 0, [20000]);
    ok('...a lap of exactly that time is a real lap time: it is the reference and flat out', q.cars[0].ps[0].w === '' && q.cars[0].ps[0].p === 0 && q.psRef(q.cars[0]).ms === 20000); }
  ok('...and his next lap is the reference: flat out', r.cars[0].ps[1].p === 0 && r.cars[0].ps[1].t === 1.4 && r.psRef(r.cars[0]).ms === 10000 && r.psRef(r.cars[0]).src === 'race'); }
{ const r = race({}, { rec: [10000, 10000] }); lapsOf(r, 0, [10000, 10000, 10000]);
  const q = race({}, { rec: [10000, 10000] }); q.restore(r.snapshot(31000)); q.resume(60000); const t = q.cars[0].last; q.cross(0, t + 12000); q.cross(0, t + 22000);
  ok('the first lap after an interruption (the race comes back from a snapshot) wears as usual and is left out of the paces, the next lap counts again', q.cars[0].ps.length === 5 && q.cars[0].ps[3].w === 'resumed' && q.cars[0].ps[3].t === 1 && q.cars[0].ps[3].p === null && q.cars[0].ps[4].w === '' && q.cars[0].ps[4].t === 1.4);
  const p = race({}, { rec: [10000, 10000] }); lapsOf(p, 0, [10000, 10000, 10000]); p.pause(31000); p.resume(50000); const tp = p.cars[0].last; p.cross(0, tp + 10000);
  ok('a pause that is carried on in the same race does not make a slow lap (the paused time does not count): that lap counts', p.cars[0].ps[3].w === '' && p.cars[0].ps[3].p === 0); }

// under yellow
{ const r = race({}, { rec: [10000, 10000], cfg: { maxLap: 0 } }); lapsOf(r, 0, [10000, 10000, 10000]);
  const t = r.cars[0].last; r.setFlag('yellow', t); lapsOf(r, 0, [25000]);
  ok('a full lap under the yellow flag is saving when it is slow, whatever the slow limit: x0.70 and x0.80, even at 250% of the reference lap', r.cars[0].ps[3].w === '' && r.cars[0].ps[3].k === 'save' && r.cars[0].ps[3].t === 0.7 && r.cars[0].ps[3].f === 0.8 && r.cars[0].ps[3].p === 150);
  const q = race({ yellowSave: 'off' }, { rec: [10000, 10000] }); lapsOf(q, 0, [10000, 10000, 10000]);
  const t2 = q.cars[0].last; q.setFlag('yellow', t2); lapsOf(q, 0, [25000]);
  ok('...with that switched off it is a slow lap like any other: the usual wear', q.cars[0].ps[3].w === 'slow' && q.cars[0].ps[3].t === 1);
  const s = race({}, { rec: [10000, 10000] }); lapsOf(s, 0, [10000, 10000]); s.setFlag('yellow', s.cars[0].last + 4000); lapsOf(s, 0, [25000]);
  ok('a lap that began before the yellow flag went up is no lap under yellow: a slow lap is a slow lap', s.cars[0].ps[2].w === 'slow'); }

// what the screens show
{ const r = race({}, { rec: [10000, 10000] }), none = r.psInfo(r.cars[0]);
  ok('before the first lap the screens get a car without a pace, with the reference lap and what the tyres and the fuel use usually', none.kind === 'normal' && none.p === null && none.why === 'early' && none.tyres === 1 && none.fuel === 1 && none.ref === 10000 && none.src === 'record' && near(none.tyreUsual, USUAL) && near(none.fuelUsual, 2, 0.2) && near(race({}, { rec: [10000], tyres: false }).psInfo(race({}, { rec: [10000], tyres: false }).cars[0]).fuelUsual, 2) && near(none.tyreNow, USUAL));
  lapsOf(r, 0, [10000, 10000, 10040]);
  const v = r.psInfo(r.cars[0]);
  ok('after a lap at +0.4%: PUSH, x1.40 is not it, x1.35 and x1.22: what a lap takes now, what it takes usually, and how many laps the tyres and the fuel last at this pace', v.kind === 'push' && v.p === 0.4 && r2(v.tyres) === 1.35 && r2(v.fuel) === 1.22 && v.why === '' && near(v.tyreNow, USUAL * v.tyres) && near(v.fuelNow, v.fuelUsual * v.fuel) && near(v.tyreLaps, life(r, 0) / v.tyreNow) && near(v.fuelLaps, r.cars[0].fuel / v.fuelNow) && r.cars[0].ps.length === 3 && v.ref === 10000);
  ok('psRef without a system, or for no car, is nothing (and psInfo says null)', race(null).psRef(race(null).cars[0]).ms === 0 && r.psInfo(null) === null && r.psRef(null).ms === 0); }

// the snapshot, a lap taken out, and the engine of a phone
{ const r = race({}, { rec: [10000, 10000] }); lapsOf(r, 0, [10000, 10000, 10000, 10300, 10040]);
  const snap = r.snapshot(60000), q = race({}, { rec: [10000, 10000] }); const ok2 = q.restore(snap);
  ok('an interrupted race comes back with the pace of every lap (and the reference lap of the entry), and the wear it had', ok2 && same(q.cars[0].ps, r.cars[0].ps) && q.cars[0].psNow.k === 'push' && near(life(q, 0), life(r, 0)) && q.psRef(q.cars[0]).ms === 10000);
  ok('...the entry holds the record of the driver (it is not in the snapshot), the pace of the laps is', snap.cars[0].psRec === undefined && Array.isArray(snap.cars[0].ps) && snap.cars[0].ps.length === 5);
  const before = r.cars[0].ps.map(x => x.k).join(); r.removeLap(0, 3, true);
  ok('a lap taken out of the race (recalculated) takes its pace with it: the list stays as long as the laps, and the other laps keep theirs', r.cars[0].laps.length === 4 && r.cars[0].ps.length === 4 && r.cars[0].ps.map(x => x.k).join() === before.split(',').filter((_, i) => i !== 3).join() && r.cars[0].ps[3].p === 0.4);
  const wire = m => JSON.parse(JSON.stringify(m)), base = { personal: new Map(), track: Infinity, trackName: '' };
  const cx = t => ({ raceId: 'x', eng: r, phase: 'running', calling: false, lights: 5, heat: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, champ: null });
  const V = LS.viewer(); V.feedStatic(wire(LS.packStatic({ raceId: 'x', eng: r, base }))); const fed = V.feedDynamic(wire(LS.packDynamic(cx(70000))), 70000), w = V.engine();
  ok('a viewer (a phone, the Race Director page) builds an engine that has the same Push and Save System, the reference laps, the pace of every lap and the same numbers', fed === true && same(w.pushSave, r.pushSave) && same(w.cars[0].ps, r.cars[0].ps) && w.psRef(w.cars[0]).ms === 10000 && same({ ...w.psInfo(w.cars[0]), tyreLaps: 0, fuelLaps: 0 }, { ...r.psInfo(r.cars[0]), tyreLaps: 0, fuelLaps: 0 }) && near(w.psInfo(w.cars[0]).tyreLaps, r.psInfo(r.cars[0]).tyreLaps, 0.01) && near(w.psInfo(w.cars[0]).fuelLaps, r.psInfo(r.cars[0]).fuelLaps, 0.01) && w.cars[1].ps.length === 0); }

// a restart of a car (a Race Director correction) starts its pace again
{ const r = race({}, { rec: [10000, 10000] }); lapsOf(r, 0, [10000, 10000, 10000]);
  r.restartCar(0, 40000);
  ok('a car that is restarted has no paces left (and keeps its reference lap)', r.cars[0].ps.length === 0 && r.cars[0].psNow === null && r.psRef(r.cars[0]).ms === 10000); }

// ---- the database, the export and the web server ----
{ const w = new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));
  const sys = w.add('pushsavesystems', { name: 'Strong', normal: 3, tyreExtra: 80 }), setup = w.add('racesetups', { name: 'Club race', pushSave: sys.id, weather: 'w1' }), other = w.add('racesetups', { name: 'Plain' });
  ok('push and save systems can be added', w.list('pushsavesystems').length === 1 && w.list('pushsavesystems')[0].tyreExtra === 80);
  w.remove('pushsavesystems', sys.id);
  ok('deleting a push and save system clears it from the setups (and leaves the other settings and setups alone)', w.list('pushsavesystems').length === 0 && w.list('racesetups').find(r => r.id === setup.id).pushSave === '' && w.list('racesetups').find(r => r.id === setup.id).weather === 'w1' && w.list('racesetups').find(r => r.id === other.id).pushSave === undefined); }
{ const tmp = () => new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json'));
  const x = tmp(), sy = x.add('pushsavesystems', { name: 'Strong', tyreExtra: 80, saveAt: 10 }), st = x.add('racesetups', { name: 'Club race', pushSave: sy.id });
  const out = Tr.collect(x.data, { racesetups: [st.id] }, true), dp = Tr.dependencies(x.data, { racesetups: [st.id] });
  ok('a race setup brings its push and save system when it is exported, and the dependencies list it', (out.items.pushsavesystems || []).length === 1 && out.items.pushsavesystems[0].name === 'Strong' && dp.pushsavesystems && dp.pushsavesystems.length === 1 && dp.pushsavesystems[0].required === false);
  const y = tmp(); y.add('pushsavesystems', { name: 'Strong' }); Tr.apply(y, JSON.parse(JSON.stringify(out)));
  const imp = y.data.pushsavesystems.find(q => q.name === 'Strong (imported)'), ns = y.data.racesetups[0];
  ok('...an import keeps the link (to the imported copy, with a new id), the numbers, and marks the clash of names', y.data.pushsavesystems.length === 2 && imp && imp.tyreExtra === 80 && imp.saveAt === 10 && ns.pushSave === imp.id && imp.id !== sy.id);
  ok('...a push and save system can also be exported on its own', (Tr.collect(x.data, { pushsavesystems: [sy.id] }, false).items.pushsavesystems || []).length === 1); }
{ const server = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8'), html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8'), sc2 = html.indexOf('src="safetycar.js"'), ps = html.indexOf('src="pushsave.js"'), eng = html.indexOf('src="engine.js"');
  const pw = html.indexOf('src="pacewidgets.js"'), wd = html.indexOf('src="widgets.js"'), pu = html.indexOf('src="pushsaveui.js"');
  ok('a phone that runs a race can read the push and save systems from the web server', /const READABLE = \[[^\]]*'pushsavesystems'/.test(server));
  ok('the page loads the rules before the engine and the screens that use them, the widget before the register of the widgets, and the folder before the app starts', sc2 > 0 && ps > sc2 && ps < eng && pw > 0 && pw < wd && pu > 0 && pu < html.indexOf('src="app.js"') && html.indexOf('src="pacewidgets.js"') < html.indexOf('src="timing.js"')); }
{ const t = fs.readFileSync(path.join(__dirname, '..', 'transfer.js'), 'utf8'), ui = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'transferui.js'), 'utf8');
  ok('export and import know the table, in the order that a setup finds it first', /ORDER = \[[^\]]*'safetycarsystems', 'pushsavesystems', 'weathersystems'/.test(t) && /TR_GROUPS = [^;]*'pushsavesystems'/.test(ui) && /ORDER_DEPS = \[[^\]]*'pushsavesystems'/.test(ui)); }

if (fails) { console.log(`\n${fails} PUSH AND SAVE TESTS FAILED`); process.exit(1); } else console.log('\nPUSH AND SAVE TESTS PASSED');
