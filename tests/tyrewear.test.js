// 1.40.0: Tyre Wear. The pure part (tyrewear.js): the defaults per tyre, the ready-made systems, cleaning a record, the wear of a lap (per lap and per distance, with the weather),
// the grip curve (bonus when new, nothing at the cliff, hindrance when worn out), the levels and the words.
const T = require('../renderer/tyrewear.js'), W = require('../renderer/weather.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const near = (a, b, d = 1e-6) => Math.abs(a - b) < d;

// ---- the defaults ----
ok('the six tyres of the weather module have the four numbers each', same(T.CODES, ['H', 'M', 'S', 'SS', 'INT', 'W']) && T.CODES.every(c => ['wear', 'bonus', 'cliff', 'hind'].every(k => Number.isFinite(T.DEFAULT_TYRES[c][k]))));
ok('my defaults: Hard 2/0/20/25, Medium 3/2/25/25, Soft 4.5/5/30/30, Supersoft 7/8/35/35, Intermediate 3/0/25/25, Wet 2.5/0/25/25',
  same(T.DEFAULT_TYRES, { H: { wear: 2, bonus: 0, cliff: 20, hind: 25 }, M: { wear: 3, bonus: 2, cliff: 25, hind: 25 }, S: { wear: 4.5, bonus: 5, cliff: 30, hind: 30 }, SS: { wear: 7, bonus: 8, cliff: 35, hind: 35 }, INT: { wear: 3, bonus: 0, cliff: 25, hind: 25 }, W: { wear: 2.5, bonus: 0, cliff: 25, hind: 25 } }));
ok('three ready-made systems: Standard, Sprint (wears faster), Endurance (wears slower), the same bonus and cliff',
  same(T.PRESET_KEYS, ['standard', 'sprint', 'endurance']) && T.CODES.every(c => T.PRESETS.sprint.tyres[c].wear > T.PRESETS.standard.tyres[c].wear && T.PRESETS.endurance.tyres[c].wear < T.PRESETS.standard.tyres[c].wear
    && T.PRESETS.sprint.tyres[c].bonus === T.PRESETS.standard.tyres[c].bonus && T.PRESETS.endurance.tyres[c].cliff === T.PRESETS.standard.tyres[c].cliff));
ok('the weather table: dry x1/2/3, cloudy x1/1.5/2, wet x2.5/0.7/0.5, clearing x1.5/0.8/1.5 (dry, intermediate and wet tyres)',
  same(T.MULT, { dry: { dry: 1, inter: 2, wet: 3 }, cloudy: { dry: 1, inter: 1.5, wet: 2 }, wet: { dry: 2.5, inter: 0.7, wet: 0.5 }, clearing: { dry: 1.5, inter: 0.8, wet: 1.5 } }));
ok('a new record starts as the Standard system, and is a copy (changing it leaves the defaults alone)', (() => { const d = T.defaults(); d.tyres.S.wear = 99; d.mult.dry.dry = 9; return T.DEFAULT_TYRES.S.wear === 4.5 && T.MULT.dry.dry === 1 && T.defaults().tyres.S.wear === 4.5; })());

// ---- cleaning a record ----
{ const C = T.clean({});
  ok('nothing in the record: the standard settings (per lap, grip through the fuel levers use and rate, 2 penalty points at 0%, 4 seconds to change, at the same time, warn 25, critical 10)',
    C.on && C.unit === 'lap' && C.effect === true && same(C.levers, { use: true, rate: true, tank: false }) && C.zero === 'points' && C.zeroPoints === 2 && C.changeMs === 4000 && C.stop === 'overlap' && C.warn === 25 && C.crit === 10 && C.practice === false && C.qualifying === false);
  ok('...and the tyres and the weather table of the Standard system', same(C.tyres, T.DEFAULT_TYRES) && same(C.mult, T.MULT));
  ok('no record, or not an object: null', T.clean(null) === null && T.clean(undefined) === null && T.clean('x') === null && T.clean(5) === null); }
{ const C = T.clean({ unit: 'distance', practice: 'on', qualifying: 'on', effect: 'off', eUse: 'off', eRate: 'off', eTank: 'on', zero: 'retire', zeroPoints: '3', changeSeconds: '2,5', stop: 'add', warn: '30', crit: 12.4,
    tyres: { S: { wear: '6,5', bonus: 99, cliff: -4, hind: 'x' }, M: null }, mult: { wet: { dry: 4, inter: -1, wet: 'a' } } });
  ok('every setting is read: distance, practice and qualifying on, no effect, tank only, retire, 3 points, 2.5 seconds, one after the other, 30 and 12', C.unit === 'distance' && C.practice && C.qualifying && C.effect === false && same(C.levers, { use: false, rate: false, tank: true })
    && C.zero === 'retire' && C.zeroPoints === 3 && C.changeMs === 2500 && C.stop === 'add' && C.warn === 30 && C.crit === 12);
  ok('a number is limited (a bonus to 90, a cliff from 0), a comma is a decimal comma, nonsense is the default', C.tyres.S.wear === 6.5 && C.tyres.S.bonus === 90 && C.tyres.S.cliff === 0 && C.tyres.S.hind === 30 && same(C.tyres.M, T.DEFAULT_TYRES.M));
  ok('...in the weather table too (no negative, the default for nonsense)', C.mult.wet.dry === 4 && C.mult.wet.inter === 0 && C.mult.wet.wet === 0.5 && C.mult.dry.dry === 1);
  ok('nonsense for the choices gives the defaults', (() => { const D = T.clean({ unit: 'x', zero: 'x', stop: 'x', effect: 'x', eUse: 'x', eRate: 'x', eTank: 'x', practice: 'x' }); return D.unit === 'lap' && D.zero === 'points' && D.stop === 'overlap' && D.effect === true && D.levers.use && D.levers.rate && !D.levers.tank && !D.practice; })()); }
ok('the lane lengths and the unit are kept (a length that is not a number is 0)', (() => { const C = T.clean({}, { laneLen: [15.4, 'x', -2, 16], disp: 'ft' }); return same(C.laneLen, [15.4, 0, 0, 16]) && C.disp === 'ft' && T.clean({}, { disp: 'x' }).disp === 'm' && same(T.clean({}).laneLen, []); })());

// ---- the wear of a lap ----
{ const C = T.clean({});
  ok('per lap: the wear of the tyre, in dry weather: Soft loses 4.5% of its life in a lap, Hard 2%', near(T.wearPerLap(C, 'S', 'dry'), 4.5) && near(T.wearPerLap(C, 'H', 'dry'), 2));
  ok('the weather changes it: a Soft in the wet wears x2.5, an Intermediate in the wet x0.7, a Wet tyre on a dry track x3', near(T.wearPerLap(C, 'S', 'wet'), 4.5 * 2.5) && near(T.wearPerLap(C, 'INT', 'wet'), 3 * 0.7) && near(T.wearPerLap(C, 'W', 'dry'), 2.5 * 3));
  ok('an unknown weather state counts as dry, an unknown tyre as a Medium', near(T.wearPerLap(C, 'S', 'snow'), 4.5) && near(T.wearPerLap(C, 'x', 'dry'), 3));
  const D = T.clean({ unit: 'distance' }, { laneLen: [15.4], disp: 'm' });
  ok('per distance: the wear is per 100 m, so a lane of 15.4 m wears 15.4% of it in a lap (Soft: 4.5% per 100 m: 0.693% a lap)', near(T.wearPerLap(D, 'S', 'dry', 15.4), 4.5 * 0.154));
  ok('...a longer lane wears the tyres faster, a shorter lane slower', T.wearPerLap(D, 'S', 'dry', 20) > T.wearPerLap(D, 'S', 'dry', 15.4) && T.wearPerLap(D, 'S', 'dry', 10) < T.wearPerLap(D, 'S', 'dry', 15.4));
  ok('...a lane without a length counts the lap as the distance (the numbers are per lap)', near(T.wearPerLap(D, 'S', 'dry', 0), 4.5) && near(T.wearPerLap(D, 'S', 'dry'), 4.5));
  const F = T.clean({ unit: 'distance' }, { disp: 'ft' });
  ok('in feet the wear is per 100 ft (30.48 m)', near(T.unitM(F), 30.48) && near(T.wearPerLap(F, 'S', 'dry', 30.48), 4.5) && near(T.unitM(D), 100)); }

// ---- the grip curve ----
{ const C = T.clean({}), S = 'S';
  ok('a new Soft helps the car by its bonus (+5%), the bonus is gone at the cliff (30% life left), a worn out Soft hinders it by -30%', near(T.effectPct(C, S, 100), 5) && near(T.effectPct(C, S, 30), 0) && near(T.effectPct(C, S, 0), -30));
  ok('...in a straight line between: at 65% half the bonus, at 15% half the hindrance', near(T.effectPct(C, S, 65), 2.5) && near(T.effectPct(C, S, 15), -15));
  ok('a Hard tyre has no bonus: 0% when new, hindering only below 20%: -25% at 0%', near(T.effectPct(C, 'H', 100), 0) && near(T.effectPct(C, 'H', 50), 0) && near(T.effectPct(C, 'H', 10), -12.5) && near(T.effectPct(C, 'H', 0), -25));
  ok('life below 0 or above 100 is kept in range, nonsense is 0%', near(T.effectPct(C, S, 140), 5) && near(T.effectPct(C, S, -10), -30) && near(T.effectPct(C, S, 'x'), -30));
  const Z = T.clean({ tyres: { M: { wear: 3, bonus: 4, cliff: 0, hind: 20 } } });
  ok('a cliff of 0: the bonus fades all the way, and the hindrance comes only at 0%', near(T.effectPct(Z, 'M', 100), 4) && near(T.effectPct(Z, 'M', 50), 2) && near(T.effectPct(Z, 'M', 1), 0.04) && near(T.effectPct(Z, 'M', 0), -20));
  ok('the lever is a whole percentage (rounded) and never more than 90 either way', T.effectLever(C, S, 65) === 3 && T.effectLever(C, S, 15) === -15 && T.effectLever(T.clean({ tyres: { S: { hind: 90, bonus: 90, cliff: 50, wear: 1 } } }), S, 0) === -90 && T.effectLever(T.clean({ tyres: { S: { bonus: 90, cliff: 0, hind: 0, wear: 1 } } }), S, 100) === 90); }

// ---- the levels and the words ----
{ const C = T.clean({});
  ok('the life has a level: ok above the warning, warn from 25%, crit from 10%, out at 0%', T.levelOf(C, 80) === 'ok' && T.levelOf(C, 26) === 'ok' && T.levelOf(C, 25) === 'warn' && T.levelOf(C, 11) === 'warn' && T.levelOf(C, 10) === 'crit' && T.levelOf(C, 0.4) === 'crit' && T.levelOf(C, 0) === 'out');
  ok('the shown life is whole: a tyre with a little life left is never 0%, only a worn out tyre is', T.shownLife(100) === 100 && T.shownLife(62.4) === 62 && T.shownLife(0.2) === 1 && T.shownLife(0) === 0 && T.shownLife(-3) === 0 && T.shownLife(180) === 100);
  ok('the effect in words has a plus, or a real minus sign', T.effectText(2.4) === '+2%' && T.effectText(-12.4) === '−12%' && T.effectText(0) === '0%' && T.effectText(0.2) === '0%');
  const lp = T.left(C, 'S', 'dry', 62);
  ok('what is left: 62% of a Soft (4.5% a lap) is 13.8 laps, said as 14 laps; nothing left is 0 laps', near(lp.laps, 62 / 4.5) && T.leftText(C, lp) === '14 laps' && T.leftText(C, T.left(C, 'S', 'dry', 0)) === '0 laps' && T.leftText(C, T.left(C, 'S', 'dry', 4)) === '1 lap');
  ok('...it follows the weather (the same tyre in the wet has fewer laps left)', T.left(C, 'S', 'wet', 62).laps < lp.laps);
  const D = T.clean({ unit: 'distance' }, { laneLen: [15.4] });
  ok('per distance it is said in metres: 62% of a Soft (4.5% per 100 m) is 1378 m... on a lane of 15.4 m that is 89 laps of 0.69% each', near(T.left(D, 'S', 'dry', 62, 15.4).dist, 62 / 4.5 * 100) && T.leftText(D, T.left(D, 'S', 'dry', 62, 15.4)) === '1378 m');
  const F = T.clean({ unit: 'distance' }, { laneLen: [15.4], disp: 'ft' });
  ok('...and in feet', T.leftText(F, T.left(F, 'S', 'dry', 62, 15.4)) === `${Math.round(62 / 4.5 * 100)} ft`);
  const N = T.clean({ tyres: { H: { wear: 0 } } });
  ok('a tyre that does not wear has no end', T.leftText(N, T.left(N, 'H', 'dry', 50)) === 'no wear' && T.lasts({ tyres: { H: { wear: 0 } } }, 'H') === Infinity);
  ok('what a new set lasts, for the form (Standard Soft: 22 laps, Hard: 50)', Math.round(T.lasts({}, 'S')) === 22 && T.lasts({}, 'H') === 50 && Math.round(T.lasts({ tyres: { SS: { wear: 7 } } }, 'SS')) === 14);
  ok('1.40.0: what a set lasts, in words: laps ("22 laps", "1 lap", "no wear"), or metres (feet) when the system counts per distance: 30% per 100 m lasts 333 m', T.lastsText('lap', 'm', 4.5) === '22 laps' && T.lastsText('lap', 'm', 150) === '1 lap' && T.lastsText('lap', 'm', 0) === 'no wear' && T.lastsText('distance', 'm', 30) === '333 m' && T.lastsText('distance', 'ft', 30) === '333 ft' && T.lastsText('distance', 'm', 10) === '1000 m' && T.lastsText('distance', 'm', 0) === 'no wear');
  ok('...the grip curve picture: the three points (+bonus when new, 0 at the cliff, -hindrance at 0%), with their words, and it never breaks on odd numbers', (() => { const v = T.curveSvg({ bonus: 5, cliff: 30, hind: 30 }); return v.startsWith('<svg') && v.endsWith('</svg>') && v.includes('+5% new') && v.includes('cliff at 30%') && v.includes('−30% at 0%') && v.includes('<polyline') && v.includes('aria-label="Grip curve: +5% when new, 0% at 30% life left, −30% at 0% life"') && ['', null, undefined, { bonus: 'x' }, { bonus: 90, cliff: 99, hind: 90 }, { bonus: 0, cliff: 0, hind: 0 }].every(o => T.curveSvg(o).startsWith('<svg') && !/NaN|undefined|Infinity/.test(T.curveSvg(o))); })());
  ok('...what a car is doing with its tyres in words: Driving, Box soon (critical level), Box now (0%), Fitting with the tyre and the seconds', T.stateOf({ level: 'ok' }).text === 'Driving' && T.stateOf({ level: 'warn' }).text === 'Driving' && T.stateOf({ level: 'crit' }).text === 'Box soon' && T.stateOf({ level: 'out' }).text === 'Box now' && T.stateOf({ level: 'out', fitting: 'W', fitLeft: 2400 }).text === 'Fitting Wet · 2.4 s' && T.stateOf({ level: 'out', fitting: 'W', fitLeft: 2400 }).cls === 'fit' && T.stateOf(null).text === '');
  ok('the rules in a line', /lap/.test(T.rulesText(C)) && /2 penalty points a lap at 0%/.test(T.rulesText(C)) && /4 s/.test(T.rulesText(C)) && T.rulesText(null) === ''
    && /no time/.test(T.rulesText(T.clean({ changeSeconds: 0 }))) && /100 m/.test(T.rulesText(D)) && /100 ft/.test(T.rulesText(F)) && /retires/.test(T.zeroText(T.clean({ zero: 'retire' }))) && /does not count/.test(T.zeroText(T.clean({ zero: 'lap' }))) && /nothing/.test(T.zeroText(T.clean({ zero: 'none' }))) && /1 penalty point a lap/.test(T.zeroText(T.clean({ zeroPoints: 1 })))); }

console.log(fails ? `${fails} FAILED` : 'ALL OK');
process.exit(fails ? 1 : 0);
