const { createRace } = require('../renderer/engine.js');
const T = require('../renderer/timing.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// lap classification
ok('faster than every earlier lap on the track = record', T.classifyLap(5000, 5200, 5100) === 'record');
ok('faster than own best only = personal best', T.classifyLap(5000, 5200, 4800) === 'pb');
ok('slower = nothing', T.classifyLap(6000, 5200, 4800) === '');
ok('the very first lap ever is nothing', T.classifyLap(5000, Infinity, Infinity) === '');
ok('first lap by this driver, but beats the track = record', T.classifyLap(4700, Infinity, 4800) === 'record');
ok('mean and median', T.mean([1, 2, 6]) === 3 && T.median([5, 1, 3]) === 3 && T.median([1, 2, 3, 10]) === 2.5);
ok('text colour contrasts with the background', T.contrast('#ffc400') === '#000' && T.contrast('#a45cff') === '#fff');

// content for widgets
const people = [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam'][i], nickname: ['Speedy', ''][i], flag: ['NL', ''][i], avatar: '', carName: 'car' }));
const eng = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); eng.start(0);
[5000, 10200, 15300].forEach(t => eng.cross(0, t)); [6000, 12100].forEach(t => eng.cross(1, t));
const flash = new Map();
const mkS = (now, over = {}) => {
  const st = eng.standings();
  return { eng, now, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 5 }, heat: null,
    carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c),
    flashOf: c => flash.get(c), personalBest: id => (id === 'd0' ? 5000 : Infinity), ...over };
};
const w = (type, lane, opt) => ({ type, lane, opt });
const C = (type, lane, now = 16000, over, opt) => T.content(w(type, lane, opt), mkS(now, over));
ok('nickname falls back to the name', C('nickname', 0).html === 'Speedy' && C('nickname', 1).html === 'Sam');
ok('driver flag icon', C('driverflag', 0).html.includes('fi-nl') && C('driverflag', 1).html === '');
ok('avatar: a driver without a picture gets the standard avatar of the lane', (() => { const Av = require('../renderer/avatars.js'), a = C('avatar', 0).html, b = C('avatar', 1).html;
  return a.includes('class="avframe"') && a.includes(Av.STANDARD[0]) && b.includes(Av.STANDARD[1]) && a !== b && !a.includes('>A<'); })());
ok('avatar: "No avatars" shows the first letter of the name, as before', C('avatar', 0, 16000, undefined, { imageSet: 'none' }).html.includes('>A<') && C('avatar', 1, 16000, undefined, { imageSet: 'none' }).html.includes('>S<'));
ok('avatar: the picture of the driver wins over the avatar of the lane', (() => { const own = 'data:image/png;base64,AAAA', o = [{ ...people[0], avatar: own }, people[1]];
  const e2 = createRace({ type: 'race', laps: 5, endRule: 'all', entries: o }); e2.start(0);
  const h = T.content(w('avatar', 0, {}), { ...mkS(16000), eng: e2, carByLane: l => e2.cars.find(c => c.lane === l) || null }).html;
  return h.includes(own) && !h.includes('svg%2Bxml') && !h.includes('image/svg+xml'); })());
ok('avatar: a picture set of avatars replaces the standard ones lane by lane (an empty lane keeps the standard one)', (() => { const Av = require('../renderer/avatars.js'), Wd = require('../renderer/widgets.js'), mine = 'data:image/png;base64,BBBB';
  const set = { id: 's1', kind: 'avatars', images: { 1: mine } }, o = Wd.resolveOpt({ type: 'avatar', opt: { imageSet: 's1' } }, [set]);
  return C('avatar', 0, 16000, undefined, o).html.includes(mine) && C('avatar', 1, 16000, undefined, o).html.includes(Av.STANDARD[1]) && Wd.resolveOpt({ type: 'avatar', opt: { imageSet: 's1' } }, []).laneAvatars === undefined; })());
ok('avatar: a set of another kind is ignored, and a deleted set falls back to the standard avatars', (() => { const Av = require('../renderer/avatars.js'), Wd = require('../renderer/widgets.js');
  const o = Wd.resolveOpt({ type: 'avatar', opt: { imageSet: 's2' } }, [{ id: 's2', kind: 'flag', images: { 1: 'x' } }]);
  return o.laneAvatars === undefined && C('avatar', 0, 16000, undefined, o).html.includes(Av.STANDARD[0]); })());
ok('avatar: Mirror flips the picture inside its frame (the position and zoom stay), driver pictures too', (() => {
  const a = C('avatar', 0, 16000, undefined, { avatarMirror: true, frame: { zoom: 2, x: 0.5, y: 0 } }).html, b = C('avatar', 0, 16000, undefined, { frame: { zoom: 2, x: 0.5, y: 0 } }).html;
  return a.includes('scale(2) scaleX(-1)') && !b.includes('scaleX') && a.replace(' scaleX(-1)', '') === b; })());
ok('race flag: the pictures of a picture set can be mirrored', (() => { const o = { flagStyle: 'images', img_running: 'data:image/png;base64,CCCC' };
  const a = C('flag', null, 16000, undefined, { ...o, imageMirror: true }).html, b = C('flag', null, 16000, undefined, o).html;
  return a.includes('style="transform:scaleX(-1)"') && !b.includes('transform') && b.includes('<img class="flagimg"') && a.replace(' style="transform:scaleX(-1)"', '') === b; })());
ok('position and gap', C('position', 0).html === '1' && C('position', 1).html === '2' && C('gap', 1).html === '+1.900' && C('gap', 0).html === '');
ok('lap shows lap/total', C('lap', 0).html === '4/5' && C('lap', 1).html === '3/5');
// 1.2.0: Race Laps (the laps of the race, not of one driver)
{ const R = (opt, over) => C('racelaps', null, 16000, over, opt).html;
  ok('race laps counting up: the lap the leader is on and the number of laps of the race (the leader has done 3 of 5, so it is lap 4)', R() === '4/5' && R({ lapCount: 'up' }) === '4/5');
  ok('...without the total when that is switched off', R({ lapTotal: false }) === '4');
  ok('race laps counting down: the laps left (5 - 3)', R({ lapCount: 'down' }) === '2' && R({ lapCount: 'down', lapTotal: false }) === '2');
  ok('it follows the leader, who has the most laps, not lane 1 or the first of the list (lane 2 ahead by a lap)', (() => { const e2 = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); e2.start(0); [5000].forEach(t => e2.cross(0, t)); [4000, 8000, 12000].forEach(t => e2.cross(1, t));
    const S2 = { ...mkS(13000), eng: e2 }; return T.content(w('racelaps', null, {}), S2).html === '4/5' && T.content(w('racelaps', null, { lapCount: 'down' }), S2).html === '2'; })());
  ok('a race without a number of laps (practice, timed): up shows the lap the leader is on, down has nothing to count (a dash)', R({}, { setup: { sessionType: 'practice' } }) === '4' && R({ lapTotal: true }, { setup: { sessionType: 'timed', duration: 5 } }) === '4' && R({ lapCount: 'down' }, { setup: { sessionType: 'practice' } }) === '–');
  ok('a heat race by laps counts too, a heat race by time does not', R({}, { setup: { sessionType: 'heats', heatBy: 'laps', laps: 5 }, heat: { idx: 0 } }) === '4/5' && R({ lapCount: 'down' }, { setup: { sessionType: 'heats', heatBy: 'time', laps: 5 } }) === '–');
  ok('before the start nobody has a lap: lap 1, and all the laps left', (() => { const e0 = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); const S0 = { ...mkS(0), eng: e0, phase: 'ready' }; return T.content(w('racelaps', null, {}), S0).html === '1/5' && T.content(w('racelaps', null, { lapCount: 'down' }), S0).html === '5'; })());
  ok('when the leader has finished it is the last lap, with nothing left (never lap 6 of 5 or minus 1 left)', (() => { const e3 = createRace({ type: 'race', laps: 2, endRule: 'all', entries: people }); e3.start(0); [5000, 10000].forEach(t => e3.cross(0, t));
    const S3 = { ...mkS(11000, { setup: { sessionType: 'race', laps: 2 } }), eng: e3 }; return T.content(w('racelaps', null, {}), S3).html === '2/2' && T.content(w('racelaps', null, { lapCount: 'down' }), S3).html === '0'; })());
  ok('a race without a number of laps: when the leader has finished it stays on the lap he finished (2), not one more', (() => { const e3 = createRace({ type: 'race', laps: 2, endRule: 'all', entries: people }); e3.start(0); [5000, 10000].forEach(t => e3.cross(0, t));
    const S3 = { ...mkS(11000, { setup: { sessionType: 'practice' } }), eng: e3 }; return e3.cars[0].done === true && T.content(w('racelaps', null, {}), S3).html === '2'; })());
  ok('...and never below nothing, whatever the engine says (a car with more laps than the race has: 0 left, lap 2 of 2)', (() => { const S5 = { ...mkS(16000, { setup: { sessionType: 'race', laps: 2 } }), eng: { cars: [{ laps: [5000, 5000, 5000], done: false }, { laps: [5000], done: false }] } }; return T.content(w('racelaps', null, { lapCount: 'down' }), S5).html === '0' && T.content(w('racelaps', null, {}), S5).html === '2/2'; })());
  ok('it never counts past the number of laps of the race (a car that goes on after the flag)', (() => { const e4 = createRace({ type: 'race', laps: 2, endRule: 'leader', entries: people }); e4.start(0); [5000, 10000, 15000].forEach(t => e4.cross(0, t));
    const S4 = { ...mkS(16000, { setup: { sessionType: 'race', laps: 2 } }), eng: e4 }; return T.content(w('racelaps', null, {}), S4).html.endsWith('/2') && Number(T.content(w('racelaps', null, { lapCount: 'down' }), S4).html) >= 0; })()); }
ok('last, best, average, median', C('lastlap', 0).html === '5.100' && C('bestlap', 0).html === '5.000' && C('avglap', 0).html === '5.100' && C('medlap', 0).html === '5.100');
ok('running lap time counts from the last crossing', C('laptime', 0, 16000).html === '0.700' && C('laptime', 0, 20300).html === '5.000');
ok('record lap = the driver\'s personal best', C('recordlap', 0).html === '5.000' && C('recordlap', 1).html === '–');
ok('lane colour widget: the colour set for the lane', T.content(w('lanecolor', 1), { ...mkS(1000), laneColorsOf: l => ({ color: '', bg: ['#aa0000', '#0000aa'][l] }) }).bg === '#0000aa' && T.content(w('lanecolor', 0), mkS(1000)).bg === undefined && C('lanecolor', 3).html === '');
ok('lane colour widget: its own background colour wins, the lane colour itself is untouched', (() => { const S2 = { ...mkS(1000), laneColorsOf: () => ({ color: '', bg: '#aa0000' }) }; return T.content({ type: 'lanecolor', lane: 0, bgColor: '#00ff00' }, S2).bg === undefined && T.content({ type: 'bestlap', lane: 0 }, S2).bg === undefined && S2.laneColorsOf(0).bg === '#aa0000'; })());
// picture sets
{
  const fuelSet = { id: 'FS', kind: 'fuel', name: 'Tank', steps: 4, images: ['a.png', 'b.png', 'c.png', 'd.png'] }, flagSet = { id: 'GS', kind: 'flag', name: 'Flags', images: { running: 'green.png', yellow: 'yellow.png' } };
  const Wd2 = require('../renderer/widgets.js');
  ok('a chosen fuel set stands in for the widget\'s own pictures and turns the pictures mode on', (() => { const o = Wd2.resolveOpt({ type: 'fuel', opt: { imageSet: 'FS', mode: 'number' } }, [fuelSet]); return o.mode === 'images' && o.steps === 4 && o.stepImages[3] === 'd.png'; })());
  ok('a chosen flag set gives a picture per state, none for the others', (() => { const o = Wd2.resolveOpt({ type: 'flag', opt: { imageSet: 'GS' } }, [flagSet]); return o.img_running === 'green.png' && o.img_yellow === 'yellow.png' && !o.img_red; })());
  ok('no set, a missing set or the wrong kind of set: the widget\'s own settings are used', Wd2.resolveOpt({ type: 'fuel', opt: { mode: 'bar' } }, [fuelSet]).mode === 'bar' && Wd2.resolveOpt({ type: 'fuel', opt: { imageSet: 'gone', mode: 'bar' } }, [fuelSet]).mode === 'bar' && Wd2.resolveOpt({ type: 'fuel', opt: { imageSet: 'GS', mode: 'bar' } }, [flagSet]).mode === 'bar');
  const eng2 = createRace({ type: 'race', laps: 5, minLap: 100, fuel: { on: true, tank: 100, perLap: 10, rate: 10, pitHold: 2000, empty: 'warn', extra: 0, saving: 0 }, entries: people }); eng2.start(0);
  const SF = { ...mkS(1000), eng: eng2, carByLane: l => eng2.cars.find(c => c.lane === l) || null, imageSets: [fuelSet, flagSet] };
  ok('the Fuel widget shows the picture of the set for the tank level', T.content({ type: 'fuel', lane: 0, opt: { imageSet: 'FS' } }, SF).html.includes('src="a.png"') && !T.content({ type: 'fuel', lane: 0, opt: {} }, SF).html.includes('a.png'));
  const SG = { ...mkS(1000), imageSets: [fuelSet, flagSet], phase: 'running' };
  ok('the Race flag widget shows the picture of the set', T.content({ type: 'flag', opt: { imageSet: 'GS' } }, SG).html.includes('src="green.png"'));
  ok('...and the state name as text where the set has no picture; with another flag style the set is not used at all', T.content({ type: 'flag', opt: { imageSet: 'GS' } }, { ...SG, phase: 'paused' }).html === 'Paused' && T.content({ type: 'flag', opt: { imageSet: 'GS', flagStyle: 'flags' } }, SG).html.includes('class="flagsvg"') && !T.content({ type: 'flag', opt: { imageSet: 'GS', flagStyle: 'leds' } }, SG).html.includes('green.png'));
}
ok('empty lane shows nothing', C('bestlap', 3).html === '');
ok('widgets without laps show a dash', T.content(w('lastlap', 0), { ...mkS(1000), carByLane: () => ({ laps: [], best: null, driverId: 'x' }) }).html === '–');

// flash on a finished lap
const c0 = eng.cars[0]; flash.set(c0, { at: 15300, time: 5100, kind: 'pb' });
let f = C('laptime', 0, 16000);
ok('finished lap flashes in the personal best colour', f.html === '5.100' && f.bg === '#a45cff' && f.color === '#fff');
f = C('laptime', 0, 16000, null, { recordColor: '#00ff00' }); flash.set(c0, { at: 15300, time: 4900, kind: 'record' });
f = C('laptime', 0, 16000, null, { recordColor: '#00ff00' });
ok('track record uses its own (adjustable) colour', f.bg === '#00ff00');
ok('flash ends after the hold time', C('laptime', 0, 15300 + 3001).html !== '4.900' && C('laptime', 0, 15300 + 3001).bg === undefined);
ok('hold time is adjustable', C('laptime', 0, 15300 + 3001, null, { holdSeconds: 10 }).html === '4.900');

// race widgets
ok('race info: laps left', C('info', null).html === '2 laps left');
ok('race info: heats + laps left', C('info', null, 16000, { heat: { idx: 1, count: 3 } }).html === 'Heat 2 of 3 · 2 laps left');
ok('race info: time left', C('info', null, 16000, { setup: { sessionType: 'timed', duration: 1 } }).html === '0:44 left');
// 0.96.0: finals
{ const fin = (idx, final, more) => ({ heat: { idx, count: 2, total: 4, ...(final ? { final } : {}), ...more } });
  ok('race info: a final is named by its letter, without the heat count', C('info', null, 16000, fin(2, 'B')).html === 'Final B · 2 laps left' && C('info', null, 16000, fin(3, 'A')).html === 'Final A · 2 laps left');
  ok('race info: when the last race is over the number does not run on ("Heat 2 of 2", not "Heat 3 of 2")', C('info', null, 16000, { heat: { idx: 2, count: 2 } }).html === 'Heat 2 of 2 · 2 laps left');
  ok('race info: the last heat of a race with finals is still "Heat 2 of 2"', C('info', null, 16000, fin(1)).html === 'Heat 2 of 2 · 2 laps left');
  ok('race info: the break before a final says "next final B in"', C('info', null, 16000, { ...fin(2, 'B', { breakLeft: 75 }), phase: 'between' }).html.endsWith('next final B in 1:15') && C('info', null, 16000, { ...fin(0, null, { breakLeft: 75 }), phase: 'between' }).html.endsWith('next heat in 1:15'));
  ok('the heat text variable names the final too', C('textrace', null, 16000, { ...fin(3, 'A'), standings: () => eng.standings() }, { text: '{heat}' }).html === 'Final A' && C('textrace', null, 16000, { ...fin(1), standings: () => eng.standings() }, { text: '{heat}' }).html === 'Heat 2 of 2');
}
ok('race info: free practice', C('info', null, 16000, { setup: { sessionType: 'practice' } }).html === 'Free practice');
// 1.62.0: a race setup as it was saved (the live pages get it so): a Race limited by a time has minutes and no laps
ok('a Race limited by a time has no laps to drive and a time to run (the live pages work with the setup as it was saved)', (() => { const raw = { sessionType: 'race', raceBy: 'time', laps: 20, duration: 1 };
  return C('info', null, 16000, { setup: raw }).html === '0:44 left' && C('info', null, 16000, { setup: { sessionType: 'race', raceBy: 'laps', laps: 5 } }).html === '2 laps left' && C('info', null, 16000, { setup: { sessionType: 'race', laps: 5 } }).html === '2 laps left'; })());
ok('the session type in a custom text says "Timed race" for a Race limited by a time (the live pages get the setup as it was saved), and "Race" for a race by laps', (() => { const t = setup => C('textrace', null, 16000, { setup, standings: () => eng.standings() }, { text: '{type}' }).html;
  return t({ sessionType: 'race', raceBy: 'time', duration: 1 }) === 'Timed race' && t({ sessionType: 'race', raceBy: 'laps', laps: 5 }) === 'Race' && t({ sessionType: 'race', laps: 5 }) === 'Race' && t({ sessionType: 'timed', duration: 1 }) === 'Timed race' && t({ sessionType: 'heats', heatBy: 'time' }) === 'Heats'; })());
ok('a race by laps has no time limit, whatever is left in the field Duration (the live pages work with the setup as it was saved)', C('info', null, 16000, { setup: { sessionType: 'race', raceBy: 'laps', laps: 5, duration: 1 } }).html === '2 laps left' && C('info', null, 16000, { setup: { sessionType: 'race', raceBy: 'distance', laps: 5, duration: 1 } }).html !== '0:44 left' && C('info', null, 16000, { setup: { sessionType: 'race', laps: 5, duration: 1 } }).html === '2 laps left');
ok('the Next Heat widget shows a dash in a race that is no heat race, and the next heat in one that is', C('nextheat', null).html === '\u2013'
  && C('nextheat', null, 16000, { phase: 'between', heat: { idx: 1, count: 2, breakLeft: 75, list: [{ name: 'Heat 1', drivers: [] }, { name: 'Heat 2', drivers: [{ lane: 1, name: 'Sam' }, { lane: 0, name: 'Alex' }] }] } }).html
  === '<div class="nhw"><div class="nhw-b"><div class="nhw-t">Next: Heat 2 of 2</div><div class="nhw-d nhw-list"><div>1: Alex</div><div>2: Sam</div></div><div class="nhw-c">Starts in 1:15</div></div></div>');
ok('start lights follow the countdown', C('lights', null, 0, { phase: 'countdown', lights: 2 }).html.match(/sl on/g).length === 2 && (C('lights', null, 0).html.match(/sl on/g) || []).length === 5);
ok('flag widget as text: racing, yellow, red', C('flag', null, 16000, undefined, { flagStyle: 'text' }).html === 'Racing' && (() => { eng.flag = 'yellow'; const y = C('flag', null, 16000, undefined, { flagStyle: 'text' }); eng.flag = 'red'; const r = C('flag', null, 16000, undefined, { flagShow: 'text' }); /* (0.62.0 called it flagShow) */ eng.flag = ''; return y.html === 'YELLOW FLAG' && y.bg === '#ffd400' && r.html === 'RED FLAG' && r.bg === '#d62828'; })());

// ---- batch B widgets ----
eng.cars[0].callsign = 'ALX';
ok('callsign widget', C('callsign', 0).html === 'ALX' && C('callsign', 1).html === '');
const ll = C('lastlap', 0, 16000, undefined, { lapsPerColumn: 2, columns: 2 }).html;
ok('last lap list: newest first (3 laps shown, 5.100 newest)', ll.indexOf('5.100') < ll.indexOf('5.200') && (ll.match(/class="lli"/g) || []).length === 3);
ok('last lap list: 2 rows per column, 2 columns', ll.includes('repeat(2,auto)') && ll.includes('grid-template-columns:repeat(2,auto)'));
const many = { lapsPerColumn: 10, columns: 2 };
const big = require('../renderer/widgets.js').lapListHtml(Array.from({ length: 30 }, (_, i) => 'L' + i), 10, 2);
ok('10 per column x 2 columns = 20 laps', (big.match(/class="lli"/g) || []).length === 20 && big.indexOf('L0') < big.indexOf('L1'));
ok('last lap default: just the newest lap as plain text', C('lastlap', 0).html === '5.100');
const img = 'data:image/png;base64,AAA';
ok('flag picture is used for its state', C('flag', null, 0, undefined, { img_running: img }).html.includes('flagimg'));
ok('with the Image set style a state without a picture shows its name as text; with the Flags style the pictures are ignored', C('flag', null, 0, { phase: 'paused' }, { flagStyle: 'images', img_running: img }).html === 'Paused' && C('flag', null, 0, { phase: 'paused' }, { img_running: img }).html === 'Paused' && C('flag', null, 16000, undefined, { flagStyle: 'flags', img_running: img }).html.includes('flagsvg'));
ok('yellow / red use their own pictures', (() => { eng.flag = 'yellow'; const y = C('flag', null, 0, undefined, { img_yellow: img }).html; eng.flag = ''; return y.includes('flagimg'); })());
ok('1.59.0: a random yellow flag that is about to come makes the Race Flag widget flash yellow, twice a second, in every style: the yellow flag, the LED, the picture of the set, or the text', (() => {
  const W = require('../renderer/widgets.js'), at = (ms, o, over) => C('flag', null, ms, over, o);
  eng.rndSoon = true;
  const fl0 = at(0, { flagStyle: 'flags' }).html, fl1 = at(500, { flagStyle: 'flags' }).html, fl2 = at(1000, { flagStyle: 'flags' }).html;
  const led0 = at(0, { flagStyle: 'leds' }).html, led1 = at(500, { flagStyle: 'leds' }).html;
  const im0 = at(0, { flagStyle: 'images', img_yellow: img, img_running: img }).html, im1 = at(500, { flagStyle: 'images', img_yellow: img, img_running: img }).html;
  const t0 = at(0, { flagStyle: 'text' }), t1 = at(500, { flagStyle: 'text' }), t2 = at(1000, { flagStyle: 'text' });
  const yellowFlag = W.flagHtml('yellow', {});
  const flags = fl0 === yellowFlag && fl1 !== fl0 && /opacity:\.25/.test(fl1) && fl2 === fl0 && !/opacity/.test(fl0) && fl0.includes('flagsvg');
  const leds = led0 === W.ledHtml('yellow') && led1 !== led0 && /opacity:\.25/.test(led1);
  const images = im0.includes('flagimg') && /opacity:\.25/.test(im1) && !/opacity/.test(im0) && im0.includes('Yellow flag soon');
  const text = t0.html === 'YELLOW FLAG SOON' && t0.bg === '#ffd400' && t0.color === '#000' && t1.html === 'YELLOW FLAG SOON' && t1.bg === '#8a7400' && t1.color === '#fff' && t2.bg === '#ffd400';
  eng.safetyCar = { target: 15000 }; const sc = at(0, { flagStyle: 'text' }).html; eng.safetyCar = null;
  const paused = at(0, { flagStyle: 'text' }, { phase: 'paused' }).html;
  eng.flag = 'yellow'; const up = at(0, { flagStyle: 'text' }).html; eng.flag = '';
  eng.rndSoon = false; const none = at(0, { flagStyle: 'text' }).html;
  return flags && leds && images && text && sc === 'SAFETY CAR SOON' && paused === 'Paused' && up === 'YELLOW FLAG' && none !== 'YELLOW FLAG SOON' && none !== 'SAFETY CAR SOON'; })());
ok('the Race Flag widget always shows a flag, never the countdown: Ready before and during the start, the red flag during a restart', (() => {
  const W = require('../renderer/widgets.js'), txt = { flagStyle: 'text' }, start = C('flag', null, 0, { phase: 'countdown', lights: 2 }, txt).html; eng.flag = 'red'; const restart = C('flag', null, 0, { phase: 'countdown', lights: 2 }, txt).html; eng.flag = '';
  return start === 'Ready' && restart === 'RED FLAG' && !W.FLAG_STATES.some(x => x[0] === 'countdown') && W.FLAG_STATES.length === 7; })());
ok('the Race Flag widget draws a flag in the colour of the flag by default, with no yellow or red background', (() => {
  const W = require('../renderer/widgets.js'), at = (st, flag) => { eng.flag = flag || ''; const r = C('flag', null, 0, { phase: st }); eng.flag = ''; return r; };
  const g = at('running'), y = at('running', 'yellow'), r = at('running', 'red'), p = at('paused'), f = at('finished'), b = at('between'), rd = at('ready');
  const fill = o => (o.html.match(/<path d="M[^"]*" fill="(#[0-9a-f]{3,6})"/) || [])[1];
  return fill(g) === '#2ecc40' && fill(y) === '#ffd400' && fill(r) === '#d62828' && fill(rd) === '#4c9aff' && fill(p) === '#8a93a0'
    && g.bg === undefined && y.bg === undefined && r.bg === undefined && !/RED FLAG/.test(r.html) && !/>[^<]*Racing/.test(g.html)
    && f.html.includes('fill="#111"') && b.html.includes('fill="#111"') && !g.html.includes('fill="#111"') && p.html.includes('stroke="#fff"')
    && /aria-label="Yellow flag"/.test(y.html) && /aria-label="Red flag"/.test(r.html) && /aria-label="Racing/.test(g.html) && /aria-label="Finished/.test(f.html); })());
ok('a red flag during a restart countdown still shows the red flag, and the countdown never shows lights', (() => { eng.flag = 'red'; const h = C('flag', null, 0, { phase: 'countdown', lights: 2 }).html; eng.flag = ''; return h.includes('#d62828') && !h.includes('sl on'); })());
ok('the flag and LED pictures are named for a screen reader: the state before the start is Pre-Race', (() => { const W = require('../renderer/widgets.js'), names = { ready: 'Pre-Race', running: 'Racing (green flag)', paused: 'Paused', between: 'Heat finished (chequered flag)', finished: 'Finished (chequered flag)', yellow: 'Yellow flag', red: 'Red flag' };
  return Object.entries(names).every(([k, n]) => W.flagHtml(k).includes('aria-label="' + n + '"') && W.ledHtml(k).includes('aria-label="' + n + '"')); })());
ok('the flag pictures are safe markup: nothing from outside goes in, all paths are numbers', (() => { const W = require('../renderer/widgets.js'); return ['ready', 'running', 'paused', 'between', 'finished', 'yellow', 'red', 'x"<script>'].every(st => { const h = W.flagHtml(st); return h.startsWith('<svg') && h.endsWith('</svg>') && !/<script|onload|href/i.test(h) && !(h.match(/ d="([^"]*)"/g) || []).some(d => /[^0-9MLZVhv .\-]/.test(d.slice(4, -1))); }); })());
ok('the Race Flag widget in the palette shows its style as the sample', (() => { const W = require('../renderer/widgets.js'), d = W.def('flag'), sm = o => W.sampleOf(d, 0, { opt: o });
  return sm({}).includes('flagsvg') && sm({ flagStyle: 'leds' }).includes('<circle') && sm({ flagStyle: 'text' }) === 'Racing' && sm({ flagMirror: true }).includes('matrix(-1 0 0 1 22 0)') && !sm({}).includes('matrix(-1')
    && d.optsLabel === 'Flag style' && d.options[0].key === 'flagStyle' && d.options[0].default === 'flags' && d.options[0].choices.map(c => c[0]).join() === 'flags,leds,text,images'; })());
ok('Flag style: a widget made before the choice keeps its look (pictures: Image set, old text choice: Text, otherwise Flags); a choice made now wins', (() => { const W = require('../renderer/widgets.js'), f = W.flagStyleOf;
  return f({}) === 'flags' && f(undefined) === 'flags' && f({ imageSet: 'S' }) === 'images' && f({ img_red: 'x.png' }) === 'images' && f({ flagShow: 'text' }) === 'text' && f({ flagStyle: 'leds', imageSet: 'S' }) === 'leds' && f({ flagStyle: 'nonsense' }) === 'flags'; })());
ok('the Flags style can be mirrored: same flag, flying to the left from a pole on the right', (() => { const a = C('flag', null, 16000, undefined, { flagMirror: true }).html, b = C('flag', null, 16000, undefined, {}).html;
  return a.includes('<g transform="matrix(-1 0 0 1 22 0)">') && !b.includes('<g ') && a.replace(/<g transform="[^"]*">|<\/g>/g, '') === b && C('flag', null, 16000, undefined, { flagStyle: 'leds', flagMirror: true }).html === C('flag', null, 16000, undefined, { flagStyle: 'leds' }).html; })());
ok('the LED style shows a round lens in the colour of the state: green racing, yellow, red, blue ready, grey with pause bars, a chequered lens at the end', (() => { const W = require('../renderer/widgets.js'), at = (st, flag) => { eng.flag = flag || ''; const r = C('flag', null, 0, { phase: st }, { flagStyle: 'leds' }); eng.flag = ''; return r; };
  const lens = o => (o.html.match(/<circle cx="11" cy="10.4" r="5.6" fill="(#[0-9a-f]{3,6})"/) || [])[1];
  const g = at('running'), y = at('running', 'yellow'), r = at('running', 'red'), rd = at('ready'), p = at('paused'), f = at('finished'), b = at('between');
  return lens(g) === '#2ecc40' && lens(y) === '#ffd400' && lens(r) === '#d62828' && lens(rd) === '#4c9aff' && lens(p) === '#8a93a0' && lens(f) === '#fff' && lens(b) === '#fff'
    && f.html.includes('fill="#111"') && b.html.includes('fill="#111"') && !g.html.includes('fill="#111"') && p.html.includes('stroke="#fff"') && g.bg === undefined && r.bg === undefined && !/flagsvg.*Racing<\/|RED FLAG/.test(r.html)
    && /aria-label="Red flag"/.test(r.html) && /aria-label="Finished/.test(f.html) && !g.html.includes('M5.5 21.5V3'); })());
ok('the chequered squares of the LED stay inside the lens: every corner of every square is on or inside the circle', (() => { const W = require('../renderer/widgets.js'), h = W.ledHtml('finished'), d = (h.match(/fill="#111" stroke="none"/) && h.match(/<path d="([^"]*)" fill="#111"/)[1]) || '';
  const pts = (d.match(/-?\d+(\.\d+)? -?\d+(\.\d+)?/g) || []).map(t => t.split(' ').map(Number)); return pts.length > 20 && pts.every(([x, y]) => Math.hypot(x - 11, y - 10.4) <= 5.6 + 0.02); })());
ok('pictures for ready, between, finished states', ['ready', 'between', 'finished'].every(st => C('flag', null, 0, { phase: st }, { ['img_' + st]: img }).html.includes('flagimg')));
ok('clock turns red / yellow with the flag, or not when switched off', (() => {
  eng.flag = 'red'; const r = C('clock', null), y0 = (eng.flag = 'yellow', C('clock', null)), off = C('clock', null, 16000, undefined, { flagColour: false }); eng.flag = '';
  return r.color === 'var(--clock-red)' && y0.color === 'var(--clock-yellow)' && r.bg===undefined && y0.bg===undefined && off.color===undefined && off.bg === undefined && C('clock', null).color==='var(--clock-green)'; })());
const rec = { sessionRecord: () => ({ time: 4900, name: 'Sam' }), trackRecord: () => ({ time: 4500, name: 'Alex' }) };
ok('session and track record show time and name', C('sessionrecord', null, 0, rec).html.includes('4.900') && C('sessionrecord', null, 0, rec).html.includes('Sam') && C('trackrecord', null, 0, rec).html.includes('Alex'));
ok('record name can be hidden', !C('trackrecord', null, 0, rec, { showName: false }).html.includes('Alex') && C('trackrecord', null, 0, rec, { showName: false }).html.includes('4.500'));
ok('no record yet shows a dash', C('trackrecord', null, 0, { trackRecord: () => null }).html === '–');
const lbS = { standings: () => eng.standings(), laneColorsOf: l => (l === 0 ? { color: '#fff', bg: '#c00' } : {}) };
const lb = C('leaderboard', null, 16000, lbS).html;
ok('leaderboard has a row per car in position order, default columns', (lb.match(/<tr/g) || []).length === 2 && lb.indexOf('Alex') < lb.indexOf('Sam') && lb.includes('lb-best') && lb.includes('lb-gap') && lb.includes('lb-laps') && lb.includes('fi-nl') && !lb.includes('lb-last'));
ok('leaderboard rows use lane colours', lb.includes('background:#c00'));
ok('leaderboard optional columns and driver column choice', (() => {
  const x = C('leaderboard', null, 16000, lbS, { colLast: true, colCurrent: true, colCallsign: true, colNickname: true, driverBy: 'callsign', colGap: false }).html;
  return x.includes('lb-last') && x.includes('lb-current') && x.includes('lb-nickname') && !x.includes('lb-gap') && x.includes('ALX'); })());

eng.cars[0].avatar = 'data:image/png;base64,AAA';
ok('avatar picture is framed by the widget setting', C('avatar', 0, 16000, undefined, { frame: { zoom: 2, x: 1, y: 0 } }).html.includes('translate(50%, 0%) scale(2)') && C('avatar', 0).html.includes('scale(1)'));
eng.cars[0].avatar = '';
// ---- batch E: fuel and pitstop widgets ----
{
  const fe = createRace({ type: 'race', laps: 50, minLap: 100, fuel: { on: true, tank: 100, perLap: 10, rate: 10, empty: 'warn', pitHold: 2000 }, entries: people.map(p => ({ ...p })) });
  fe.start(0); [1000, 2000, 3000].forEach(t => fe.cross(0, t)); // 70 L left
  const st2 = fe.standings();
  const SF = (now, over = {}) => ({ eng: fe, now, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 50 }, heat: null, carByLane: l => fe.cars.find(c => c.lane === l) || null,
    rowOf: c => st2.find(r => r.car === c), flashOf: () => null, personalBest: () => Infinity, standings: () => st2, laneColorsOf: () => ({}), ...over });
  const F = (type, lane, now, opt) => T.content({ type, lane, opt }, SF(now));
  ok('fuel widget: bar with number by default', F('fuel', 0, 3500).html.includes('class="fbar"') && F('fuel', 0, 3500).html.includes('70 L') && F('fuel', 0, 3500).html.includes('width:70%'));
  ok('fuel widget: number only / bar only', (h => h.includes('class="fnum"') && !h.includes('fbar'))(F('fuel', 0, 3500, { mode: 'number' }).html) && !F('fuel', 0, 3500, { mode: 'bar' }).html.includes('ftxt'));
  fe.cars[0].fuel = 20; fe.cars[1].fuel = 5;
  ok('fuel widget: warning colour below a quarter, critical below a tenth (both settable)', F('fuel', 0, 3500, { mode: 'number' }).html.includes('#ffd400') && F('fuel', 1, 3500, { mode: 'number' }).html.includes('#d62828')
    && F('fuel', 0, 3500, { mode: 'number', lowAt: 10 }).html.includes('style') === false && F('fuel', 0, 3500, { mode: 'number', lowAt: 30, lowColor: '#00ff00' }).html.includes('#00ff00'));
  fe.cars[0].fuel = 55;
  const imgs = Array.from({ length: 10 }, (_, i) => 'data:image/png;base64,P' + i);
  ok('fuel widget: your own pictures, one per step from full to empty', F('fuel', 0, 3500, { mode: 'images', steps: 10, stepImages: imgs }).html.includes('base64,P4"') && (fe.cars[0].fuel = 100, F('fuel', 0, 3500, { mode: 'images', steps: 10, stepImages: imgs }).html.includes('base64,P0"')));
  fe.cars[0].fuel = 55;
  ok('fuel widget: a step without a picture falls back to the number', F('fuel', 0, 3500, { mode: 'images', steps: 10, stepImages: [] }).html.includes('55 L'));
  ok('fuel widget: dash when fuel is off', T.content({ type: 'fuel', lane: 0, opt: {} }, mkS(16000)).html === '–');
  ok('fuel left can be a leaderboard column', T.content({ type: 'leaderboard', lane: null, opt: { colFuel: true } }, SF(3500)).html.includes('lb-fuel') && T.content({ type: 'leaderboard', lane: null, opt: { colFuel: true } }, SF(3500)).html.includes('55 L'));
  // pitstop widget
  ok('pitstop time: dash before any stop', F('pitstop', 0, 3500).html === '–');
  fe.block(0, 4000); fe.tick(7000);
  ok('pitstop time: counts live during a stop', F('pitstop', 0, 8000).html === '4.000');
  fe.unblock(0, 9000);
  ok('pitstop time: then shows the last stop', F('pitstop', 0, 12000).html === '5.000');
}

// ---- batch F ----
ok('clock counts down with a time limit, up without, and stops at 00:00.0', (() => { const tl = { setup: { sessionType: 'timed', duration: 1 } };
  return C('clock', null, 16000, tl).html === '00:44.0' && C('clock', null, 90000, tl).html === '00:00.0' && C('clock', null, 16000, tl, { countdown: false }).html === '00:16.0' && C('clock', null, 16000).html === '00:16.0'; })());
ok('the race clock of a race by laps or by a distance counts up, also with minutes left in the field Duration; a Race limited by a time counts down (the live pages get the setup as it was saved)', (() => { const cl = setup => C('clock', null, 16000, { setup }).html;
  return cl({ sessionType: 'race', raceBy: 'laps', laps: 5, duration: 1 }) === '00:16.0' && cl({ sessionType: 'race', raceBy: 'distance', duration: 1 }) === '00:16.0' && cl({ sessionType: 'race', laps: 5, duration: 1 }) === '00:16.0' && cl({ sessionType: 'race', raceBy: 'time', duration: 1 }) === '00:44.0'; })());
ok('race clock always reads 00:00.0', C('clock', null, 16000).html === '00:16.0' && C('clock', null, 0).html === '00:00.0' && C('clock', null, 83400).html === '01:23.4' && C('clock', null, 600000).html === '10:00.0' && C('clock', null, 3725500).html === '62:05.5');
{
  const lapsOf = C('lastlap', 0, 16000, undefined, { lapsPerColumn: 3, columns: 1 }).html;
  ok('last laps show lap numbers (newest first) when more than one lap is shown', lapsOf.indexOf('class="lln">3<') >= 0 && lapsOf.indexOf('>3<') < lapsOf.indexOf('>2<') && lapsOf.indexOf('>2<') < lapsOf.indexOf('>1<'));
  ok('...and the numbers can be switched off', !C('lastlap', 0, 16000, undefined, { lapsPerColumn: 3, columns: 1, lapNumbers: false }).html.includes('lln'));
  ok('a single last lap stays plain text', C('lastlap', 0).html === '5.100');
}
eng.cars[0].carPicture = 'data:image/png;base64,CAR'; eng.cars[0].carName = 'NSR Ford GT40';
ok('slotcar picture widget shows the car\'s picture with its own framing', (h => h.includes('base64,CAR') && h.includes('translate(25%, 0%) scale(1.5)'))(C('carpicture', 0, 16000, undefined, { frame: { zoom: 1.5, x: 1, y: 0 } }).html));
{ const cp = o => C('carpicture', 0, 16000, undefined, o).html;  // 1.30.1: the slotcar picture can be mirrored, as the Avatar can
  ok('1.30.1: the slotcar picture can be mirrored: flipped left to right inside its frame, after the position and zoom', cp({ carMirror: true, frame: { zoom: 1.5, x: 1, y: 0 } }).includes('style="transform:translate(25%, 0%) scale(1.5) scaleX(-1)"') && cp({ carMirror: true }).includes('scaleX(-1)') && cp({ carMirror: true }).includes('base64,CAR'));
  ok('...and it is not mirrored unless asked (not set, or switched off)', !cp({ frame: { zoom: 1.5, x: 1, y: 0 } }).includes('scaleX') && !cp({ carMirror: false }).includes('scaleX') && !cp({}).includes('scaleX') && cp({ frame: { zoom: 1.5, x: 1, y: 0 } }).includes('style="transform:translate(25%, 0%) scale(1.5)"'));
  ok('...the picture of the widget is the same markup as before (a frame with one picture) and a car without a picture shows nothing, mirrored or not', cp({}).startsWith('<span class="avframe"><img class="avimg" src="data:image/png;base64,CAR"') && C('carpicture', 1, 16000, undefined, { carMirror: true }).html === ''); }
ok('slotcar name widget shows brand, make and model', C('carname', 0).html === 'NSR Ford GT40' && C('carpicture', 1).html === '');
ok('custom text (lane) fills in the driver\'s values and escapes the text', (() => { const h = C('textlane', 0, 16000, undefined, { text: '{position}. {name} <b>{best}</b> {car} {nope}' }).html;
  return h.startsWith('1. ') && h.includes('&lt;b&gt;') && !h.includes('<b>') && h.includes('NSR Ford GT40') && h.includes('{nope}') && C('textlane', 0).html.includes(eng.cars[0].driverName); })());
ok('custom text (race) shows time left, laps left, leader and flag', (() => { const o = { standings: () => eng.standings() }, h = C('textrace', null, 16000, { ...o, setup: { sessionType: 'timed', duration: 1 } }, { text: '{timeleft} {lapsleft} {leader} {flag}' }).html;
  return h.startsWith('0:44 – ') && h.endsWith(' Racing') && h.includes(eng.standings()[0].car.driverName); })());
ok('every listed variable of the custom text widgets gets a value', (() => { const lv = require("../renderer/widgets.js").TEXT_LANE_VARS.map(v => '{' + v[0] + '}').join('|'), rv = require("../renderer/widgets.js").TEXT_RACE_VARS.map(v => '{' + v[0] + '}').join('|'), o = { standings: () => eng.standings(), track: { name: 'Monza', length: 10, scale: 32 }, sessionRecord: () => ({ time: 4912, name: 'Sam' }), trackRecord: () => null };
  const a = C('textlane', 0, 16000, o, { text: lv }).html, b = C('textrace', null, 16000, { ...o, setup: { sessionType: 'race', laps: 5, name: 'Club' } }, { text: rv }).html;
  return !/\{\w+\}/.test(a) && !/\{\w+\}/.test(b) && b.includes('Monza') && b.includes('Club') && b.includes('Sam'); })());
ok('the text variable {yellowtarget} is the yellow flag target lap time of the race, and empty when the race has none', (() => { const withY = Object.assign(Object.create(eng), { yellow: { target: 15000, points: 1 } }), noY = Object.assign(Object.create(eng), { yellow: { target: 0, points: 0 } });
  const t = (e, text = '[{yellowtarget}]') => C('textrace', null, 16000, { eng: e, standings: () => eng.standings() }, { text }).html;
  return t(withY) === '[15.000]' && t(noY) === '[]' && t(eng) === '[]' && t(Object.assign(Object.create(eng), { yellow: { target: 7500 } }), 'Yellow {yellowtarget}') === 'Yellow 7.500' && require('../renderer/widgets.js').TEXT_RACE_VARS.some(v => v[0] === 'yellowtarget'); })());
ok('custom image: a rule picks its picture, otherwise the fixed one', (() => { const o = { image: 'FIXED', rules: [{ var: 'position', op: '=', value: '1', image: 'GOLD' }, { var: 'fuelpct', op: '<', value: '30', image: 'LOW' }, { var: 'name', op: '=', value: 'nobody', image: 'NAME' }] };
  const first = C('imagelane', 0, 16000, undefined, o).html, second = C('imagelane', 1, 16000, undefined, o).html;
  return first.includes('src="GOLD"') && second.includes('src="FIXED"') && C('imagelane', 0, 16000, undefined, { rules: [] }).html === '' && C('imagelane', 0, 16000, undefined, { image: 'X', fit: 'cover' }).html.includes('object-fit:cover'); })());
ok('custom image rules compare numbers as numbers and words without capitals, and ignore unknown variables', (() => { const W = require("../renderer/widgets.js"), v = { n: '10', t: 'Red flag', p: '25%' };
  return W.ruleHolds({ var: 'n', op: '>', value: '9' }, v) && !W.ruleHolds({ var: 'n', op: '<', value: '9' }, v) && W.ruleHolds({ var: 't', op: '=', value: 'red FLAG' }, v) && W.ruleHolds({ var: 'p', op: '<=', value: '30' }, v) && !W.ruleHolds({ var: 'zzz', op: '=', value: '' }, v) && !W.ruleHolds({ var: 't', op: '<', value: 'x' }, v); })());
ok('custom image (race) follows the flag', C('imagerace', null, 16000, { standings: () => eng.standings() }, { image: 'FIXED', rules: [{ var: 'flag', op: '=', value: 'Racing', image: 'GREEN' }] }).html.includes('src="GREEN"'));
ok('the logo widget shows its picture, or nothing when there is none', C('logo', null, 16000, undefined, { image: 'LOGO' }).html.includes('src="LOGO"') && C('logo', null).html === '');
ok('a logo widget without a picture shows the club logo from App Settings', C('logo', null, 16000, { clubLogo: 'data:CLUB' }, {}).html.includes('src="data:CLUB"') && C('logo', null, 16000, { clubLogo: 'data:CLUB' }).html.includes('src="data:CLUB"'));
ok('...a picture of its own wins over it, and the fit setting still applies', (() => { const h = C('logo', null, 16000, { clubLogo: 'data:CLUB' }, { image: 'data:OWN', fit: 'cover' }).html; return h.includes('src="data:OWN"') && !h.includes('CLUB') && h.includes('object-fit:cover'); })());
ok('...and with no club logo and no picture it shows nothing', C('logo', null, 16000, { clubLogo: '' }, {}).html === '');
ok('start lights are drawn as circles in one scaling picture, lit one by one', (() => { const W = require('../renderer/widgets.js'), h = W.lightsHtml(3); return (h.match(/<circle/g) || []).length === 5 && (h.match(/class="sl on"/g) || []).length === 3 && h.includes('viewBox="0 0 500 100"') && h.includes('r="42"') && W.lightsHtml(0).indexOf(' on') < 0; })());
ok('start lights with a picture set: its pictures replace the circles, a light without a picture stays a circle', (() => { const W = require('../renderer/widgets.js'), h = W.lightsHtml(2, { on: 'data:on', off: '' }), r = W.resolveOpt({ type: 'lights', opt: { imageSet: 'S1' } }, [{ id: 'S1', kind: 'lights', images: { on: 'data:ON', off: 'data:OFF' } }]);
  return (h.match(/<image/g) || []).length === 2 && (h.match(/<circle/g) || []).length === 3 && h.includes('href="data:on"') && r.lightOn === 'data:ON' && r.lightOff === 'data:OFF'; })());
ok('the Start Lights widget uses the pictures of the chosen set', (() => { const imgs = [{ id: 'S1', kind: 'lights', images: { on: 'data:ON', off: 'data:OFF' } }]; return C('lights', null, 16000, { imageSets: imgs, phase: 'countdown', lights: 1 }, { imageSet: 'S1' }).html.includes('href="data:ON"') && C('lights', null, 16000, { imageSets: imgs, phase: 'ready' }, { imageSet: 'S1' }).html.includes('href="data:OFF"'); })());
{ // the picture grid of a Start lights set: a picture per light and per race state, with fallbacks
  const grid = { on: 'data:ON', off: 'data:OFF', on_2: 'data:ON2', off_4: 'data:OFF4', yellow: 'data:Y', yellow_3: 'data:Y3', red_1: 'data:R1' };
  const sets = [{ id: 'G', kind: 'lights', images: grid }, { id: 'OLD', kind: 'lights', images: { on: 'data:on', off: 'data:off' } }, { id: 'EMPTY', kind: 'lights', images: {} }];
  const pics = (over, opt) => [...C('lights', null, 16000, { imageSets: sets, ...over }, { imageSet: 'G', ...opt }).html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace('data:', '')).join(' ');
  ok('grid: in the countdown the lit lights use Light on (a picture of their own first), the others Light off (their own first)', pics({ phase: 'countdown', lights: 3 }) === 'ON ON2 ON OFF4 OFF');
  ok('grid: a yellow flag uses the Yellow picture of all lights, and the picture of light 3 for light 3', (eng.flag = 'yellow', pics({}, { lights_yellow: '5' })) === 'Y Y Y3 Y Y' && (eng.flag = '', true));
  ok('grid: a state with only some lights on: the lit ones use the state, the others Light off', (eng.flag = 'yellow', pics({}, { lights_yellow: '2' })) === 'Y Y OFF OFF4 OFF' && (eng.flag = '', true));
  ok('grid: a light of a state without a picture of its own is a plain round light (1.28.1: it does not borrow the Countdown picture of the light or of all lights)', (eng.flag = 'red', pics({}, { lights_red: '2' })) === 'R1 OFF OFF4 OFF' && (eng.flag = '', true));
  ok('grid: the race running (green) with no green pictures has plain round lights, and the lights that are off still use Light off', pics({}, { lights_running: '1' }) === 'OFF OFF OFF4 OFF' && !C('lights', null, 16000, { imageSets: sets }, { imageSet: 'G', lights_running: '5' }).html.includes('<image'));
  ok('grid: a set with only Countdown and Lights off pictures: the countdown has them, yellow, red and paused have plain round lights', (() => { const o = [{ id: 'CD', kind: 'lights', images: { on: 'data:ON', off: 'data:OFF' } }], img = h => (h.match(/<image/g) || []).length, p = (over, opt) => C('lights', null, 16000, { imageSets: o, ...over }, { imageSet: 'CD', ...opt }).html;
    const cd = img(p({ phase: 'countdown', lights: 3 })); eng.flag = 'yellow'; const y = p({}, { lights_yellow: '5' }); eng.flag = 'red'; const r = p({}, { lights_red: '5' }); eng.flag = ''; const pa = p({ phase: 'paused' }, { lights_paused: '5' });
    return cd === 5 && img(y) === 0 && (y.match(/<circle/g) || []).length === 5 && img(r) === 0 && img(pa) === 0; })());
  ok('grid: the same pictures for a race setup that lets the lights follow the flag', (eng.flag = 'yellow', pics({ setup: { sessionType: 'race', laps: 5, lightsAfter: 'flags' } }, {})) === 'Y Y Y3 Y Y' && (eng.flag = '', true));
  ok('grid: paused, ready, heat finished and finished are states of their own (a state picture wins when there is one)', (() => { const g2 = [{ id: 'G', kind: 'lights', images: { ...grid, paused: 'data:P', finished_2: 'data:F2', between: 'data:B', ready_5: 'data:R5' } }], p = (over, opt) => [...C('lights', null, 16000, { imageSets: g2, ...over }, { imageSet: 'G', ...opt }).html.matchAll(/href="([^"]+)"/g)].map(m => m[1].replace('data:', '')).join(' ');
    return p({ phase: 'paused' }, { lights_paused: '5' }) === 'P P P P P' && p({ phase: 'review' }, { lights_finished: '5' }) === 'F2' && p({ phase: 'between' }, { lights_between: '1' }) === 'B OFF OFF OFF4 OFF' && p({ phase: 'ready' }, { lights_ready: '5' }) === 'R5'; })());
  ok('grid: a set made before the grid (Light on and Light off only) draws as it always did', pics({ phase: 'countdown', lights: 2 }, { imageSet: 'OLD' }) === 'on on off off off' && pics({ phase: 'ready' }, { imageSet: 'OLD' }) === 'off off off off off');
  ok('grid: a set without pictures draws plain round lights, and no set draws them too', (() => { const h = C('lights', null, 16000, { imageSets: sets, phase: 'countdown', lights: 2 }, { imageSet: 'EMPTY' }).html, n = C('lights', null, 16000, { phase: 'countdown', lights: 2 }, {}).html; return !h.includes('<image') && (h.match(/<circle/g) || []).length === 5 && !n.includes('<image') && (n.match(/<circle/g) || []).length === 5; })());
  ok('grid: a light with a picture in one state and none in another is a picture in one and a circle in the other', (() => { const g3 = [{ id: 'G', kind: 'lights', images: { red_1: 'data:R1' } }], h = (eng.flag = 'red', C('lights', null, 16000, { imageSets: g3 }, { imageSet: 'G', lights_red: '2' }).html); eng.flag = ''; return (h.match(/<image/g) || []).length === 1 && (h.match(/<circle/g) || []).length === 4 && h.includes('href="data:R1"'); })());
}
ok('start lights show the race state: five green lights by default, or the chosen number of lights in the state colour', (() => {
  const on = h => (h.match(/class="sl on"/g) || []).length, run = (over, opt) => C('lights', null, 16000, over, opt).html;
  const none = run(undefined, {}), three = run(undefined, { lights_running: '3' }), red = run(undefined, { lights_running: '3', lights_red: '5', lightcol_red: '#ff0000' });
  const redFlag = (eng.flag = 'red', run(undefined, { lights_running: '3', lights_red: '5', lightcol_red: '#ff0000' })); eng.flag = '';
  const greenDefault = run(undefined, { lights_running: '2' }), paused = run({ phase: 'paused' }, { lights_paused: '1', lights_running: '4' });
  return on(none) === 5 && on(three) === 3 && three.includes('fill:#2ecc40') && on(red) === 3 && on(redFlag) === 5 && redFlag.includes('fill:#ff0000') && on(greenDefault) === 2 && on(paused) === 1; })());
ok('start lights follow flags even for a setup with the retired out setting; the widget\'s own choice still wins', (() => {
  const on = h => (h.match(/class="sl on"/g) || []).length, setup = { sessionType: 'race', laps: 5, lightsAfter: 'flags' }, run = (over, opt) => C('lights', null, 16000, { setup, ...over }, opt).html;
  const green = run({}, {}), out = C('lights', null, 16000, { setup: { sessionType: 'race', laps: 5, lightsAfter: 'out' } }, {}).html;
  eng.flag = 'yellow'; const yellow = run({}, {}); eng.flag = 'red'; const red = run({}, {}), redOwn = run({}, { lights_red: '2' }); eng.flag = '';
  const paused = run({ phase: 'paused' }, {}), cd = run({ phase: 'countdown', lights: 2 }, {});
  return on(green) === 5 && green.includes('fill:#2ecc40') && on(out) === 5 && on(yellow) === 5 && yellow.includes('fill:#ffd400') && on(red) === 5 && red.includes('fill:#d62828') && on(redOwn) === 2 && on(paused) === 0 && on(cd) === 2; })());
ok('the countdown still lights them one by one, whatever the race-state choices', (() => { const h = C('lights', null, 16000, { phase: 'countdown', lights: 2 }, { lights_running: '5' }).html; return (h.match(/class="sl on"/g) || []).length === 2; })());
ok('custom text with no lane car is empty', C('textlane', 7).html === '');
ok('the avatar fills its widget (square frame, no rounding)', (() => { eng.cars[0].avatar = 'data:x'; const h = C('avatar', 0).html; eng.cars[0].avatar = ''; return h.includes('avframe'); })());
{
  const Wd2 = require('../renderer/widgets.js');
  ok('value style: bold by default (older layouts too), italic and normal weight on request', Wd2.valueStyleOf({}).includes('600') && Wd2.valueStyleOf({ valueBold: false }).includes('400') && Wd2.valueStyleOf({ valueItalic: true }).includes('italic') && !Wd2.valueStyleOf({}).includes('italic'));
  ok('title style: normal by default, bold on request, size follows the setting', !Wd2.titleStyleOf({}).includes('bold') && Wd2.titleStyleOf({ titleBold: true }).includes('700') && Wd2.titleStyleOf({ titleSize: 20 }).includes('2cqw'));
  const nw = Wd2.newWidget('bestlap', 0, 0, 0);
  ok('new widgets: title does not take space, title not bold, value bold, not italic', !Object.hasOwn(nw,'titleSpace') && nw.titleBold === false && nw.valueBold === true && nw.valueItalic === false);
}

// ---- batch G: speed widget ----
{
  const Sp = require('../renderer/speed.js');
  const track = { length: 13, scale: '1:32' };
  const SP = (type, lane, opt, over = {}) => T.content({ type, lane, opt }, mkS(16000, { track, ...over }));
  const lastKmh = Sp.kmh(13, 5100), bestKmh = Sp.kmh(13, 5000), avgKmh = Sp.kmh(13, (5000 + 5200 + 5100) / 3);
  ok('speed (default): scaled, km/h, last lap', SP('speed', 0).html === `${(lastKmh * 32).toFixed(0)} km/h`);
  { const lt = { length: 13, lanes: 2, scale: '1:32' }, R = { mode: 'real' }, k = x => parseFloat(x.html);
    const f0 = k(SP('speed', 0, R)), f1 = k(SP('speed', 1, R)), l0 = k(SP('speed', 0, R, { track: lt })), l1 = k(SP('speed', 1, R, { track: lt })), a = k(SP('speed', 0, R, { track: { ...lt, outsideLane: 'first' } }));
    ok('speed uses the length of the car\'s own lane: the outside (last) lane keeps the entered length, the inner lane is shorter', l1 === f1 && l0 < f0 && a === f0);
    ok('...and a larger lane spacing lowers the inner lane further', k(SP('speed', 0, R, { track: { ...lt, laneSpacing: 200 } })) < l0); }
  { const lt = { length: 13, lanes: 2, scale: '1:32', laneModifier: 'none' }, R = { mode: 'real' }, k = x => parseFloat(x.html);
    ok('with no lane length modifier the speed uses the same length for every lane (the lap times only differ)', k(SP('speed', 0, R, { track: lt })) === k(SP('speed', 0, R)) && k(SP('speed', 1, R, { track: lt })) === k(SP('speed', 1, R)) && k(SP('speed', 0, R, { track: { ...lt, laneModifier: 'bends' } })) < k(SP('speed', 0, R, { track: lt })));
    const m = { ...lt, laneModifier: 'measured', laneLengths: '12.5, 13' };
    ok('with measured lane lengths the speed uses the length of the car\'s own lane', k(SP('speed', 0, R, { track: m })) < k(SP('speed', 0, R, { track: lt })) && k(SP('speed', 1, R, { track: m })) === k(SP('speed', 1, R, { track: lt })) && Math.abs(k(SP('speed', 0, R, { track: m })) - k(SP('speed', 0, R, { track: lt })) * 12.5 / 13) < 0.11); }
  ok('real speed has one decimal', SP('speed', 0, { mode: 'real' }).html === `${lastKmh.toFixed(1)} km/h`);
  ok('miles per hour', SP('speed', 0, { mode: 'real', unit: 'mph' }).html === `${(lastKmh * 0.621371).toFixed(1)} mph`);
  ok('based on the best or the average lap', SP('speed', 0, { source: 'best', mode: 'real' }).html === `${bestKmh.toFixed(1)} km/h` && SP('speed', 0, { source: 'average', mode: 'real' }).html === `${avgKmh.toFixed(1)} km/h`);
  ok('the unit can be hidden', SP('speed', 0, { mode: 'real', showUnit: false }).html === lastKmh.toFixed(1));
  eng.cars[0].carScale = '1:24';
  ok('the car\'s own scale wins over the track\'s', SP('speed', 0).html === `${(lastKmh * 24).toFixed(0)} km/h`);
  eng.cars[0].carScale = '';
  ok('dash when the track has no length, no scale (scaled only) or the car has no laps yet', SP('speed', 0, {}, { track: {} }).html === '–' && SP('speed', 0, {}, { track: { length: 13 } }).html === '–' && SP('speed', 0, { mode: 'real' }, { track: { length: 13 } }).html.includes('km/h') && SP('speed', 0, {}, { track: undefined }).html === '–');
}

// controls
const b = (type, phase, over) => C(type, null, 0, { phase, ...over });
ok('start is only available before the race and between heats', !b('start', 'ready').disabled && b('start', 'running').disabled && !b('start', 'between', { heat: { idx: 1, count: 3 } }).disabled);
ok('start is off while the pre-race call is being said, on again afterwards, and on a viewer that has no such flag', b('start', 'ready', { calling: true }).disabled === true && b('start', 'between', { calling: true, heat: { idx: 1, count: 3 } }).disabled === true && !b('start', 'ready', { calling: false }).disabled && !b('start', 'ready').disabled);
ok('start button names the next heat', b('start', 'between', { heat: { idx: 1, count: 3 } }).html === 'Start heat 2');
ok('start button names the final that is next, and is not available while its lanes are being chosen', b('start', 'between', { heat: { idx: 2, count: 2, total: 4, final: 'B' } }).html === 'Start final B' && !b('start', 'between', { heat: { idx: 2, count: 2, total: 4, final: 'B' } }).disabled && b('start', 'between', { heat: { idx: 2, count: 2, total: 4, final: 'B', picking: true } }).disabled === true && b('start', 'between', { heat: { idx: 1, count: 3 } }).html === 'Start heat 2' && !b('start', 'between', { heat: { idx: 1, count: 3 } }).disabled);
ok('pause becomes resume', b('pause', 'running').html === 'Pause' && b('pause', 'paused').html === 'Resume' && b('pause', 'ready').disabled);
ok('stop is available while racing, paused or between heats', !b('stop', 'running').disabled && !b('stop', 'between').disabled && b('stop', 'ready').disabled);
ok('flag buttons light up when their flag is out', (() => { eng.flag = 'yellow'; const y = b('yellow', 'running'); eng.flag = 'red'; const r = b('red', 'paused'); eng.flag = ''; return y.bg === '#ffd400' && r.bg === '#d62828' && !r.disabled; })());
ok('controls are marked as buttons', b('start', 'ready').button === true && C('clock', null).button === undefined);
// championship points
{
  const champ = { on: true, list: [10, 8, 6], done: new Map([['d0', 8], ['d1', 10]]) };
  ok('championship points: finished heats plus what the current positions are worth', C('champpoints', 0, 16000, { champ }).html === '18' && C('champpoints', 1, 16000, { champ }).html === '18');
  ok('...or finished heats only when "live" is switched off', C('champpoints', 0, 16000, { champ }, { live: false }).html === '8' && C('champpoints', 1, 16000, { champ }, { live: false }).html === '10');
  ok('...and not counting the current heat before the start', C('champpoints', 0, 16000, { champ, phase: 'between' }).html === '8');
  ok('a race without points shows a dash', C('champpoints', 0, 16000, { champ: { on: false, list: [], done: new Map() } }).html === '–' && C('champpoints', 0).html === '–');
}
// 1.3.0: Balance of Power
{ const Wd = require('../renderer/widgets.js');
  const fuel = { on: true, tank: 100, perLap: 2, rate: 10, target: 0, extra: 0, saving: 0, empty: 'retire', pitHold: 2000 };
  const e2 = createRace({ type: 'race', laps: 9, endRule: 'all', entries: people, fuel, bop: { mode: 'manual', tank: true } }); e2.start(0); e2.bopSet(0, -20, 0); e2.bopSet(1, 10, 0); [5000, 10000].forEach(t => e2.cross(0, t)); [5000].forEach(t => e2.cross(1, t));
  const S2 = over => ({ ...mkS(11000), eng: e2, carByLane: l => e2.cars.find(c => c.lane === l) || null, rowOf: c => e2.standings().find(r => r.car === c), ...over });
  const B = (lane, opt, over) => T.content(w('bop', lane, opt), S2(over));
  ok('the Balance of Power widget: hindered shows the arrow down and the percentage on the colour, helped the arrow up', B(0).html === 'BoP ▼ −20%' && B(0).bg === '#ff8c00' && B(0).color === '#000' && B(1).html === 'BoP ▲ +10%' && B(1).bg === '#3ddc84');
  ok('...the colours are the ones of the options, with a text that can be read on them', (() => { const x = B(0, { hinderColor: '#7a0000', helpColor: '#ffffff' }), y = B(1, { hinderColor: '#7a0000', helpColor: '#ffffff' }); return x.bg === '#7a0000' && x.color === '#fff' && y.bg === '#ffffff' && y.color === '#000'; })());
  ok('...without the percentage it shows only the arrow', B(0, { showPercent: false }).html === 'BoP ▼' && B(1, { showPercent: false }).html === 'BoP ▲');
  ok('a car without it says "BoP off" (or nothing, when that is switched off), with no colour', (() => { const e3 = createRace({ type: 'race', laps: 9, endRule: 'all', entries: people, fuel, bop: { mode: 'manual' } }); e3.start(0); const o = { eng: e3, carByLane: l => e3.cars.find(c => c.lane === l) || null }; const a = T.content(w('bop', 0, {}), S2(o)), b = T.content(w('bop', 0, { showOff: false }), S2(o)); return a.html === 'BoP off' && !a.bg && b.html === ''; })());
  ok('a race without Balance of Power (no fuel, or the race setup has it off) shows "BoP off", an empty lane nothing', C('bop', 0).html === 'BoP off' && C('bop', 7).html === '');
  ok('the fuel % variable uses the size of the tank of the car (a hindered car has 80 litres, a helped one 110)', (() => { const pct = T.content(w('textlane', 0, { text: '{fuelpct}' }), S2()).html, other = T.content(w('textlane', 1, { text: '{fuelpct}' }), S2()).html; return e2.tankOf(0) === 80 && e2.tankOf(1) === 110 && pct === Math.round(e2.fuelOf(0, 11000) / 80 * 100) + '%' && other === Math.round(e2.fuelOf(1, 11000) / 110 * 100) + '%' && pct === '94%' && other === '89%'; })());
  ok('...and the Fuel widget draws the fuel against that tank too', (() => { const Wd2 = require('../renderer/widgets.js'); return T.content(w('fuel', 0, {}), S2()).html === Wd2.fuelHtml(e2.fuelOf(0, 11000), 80, {}) && T.content(w('fuel', 1, {}), S2()).html === Wd2.fuelHtml(e2.fuelOf(1, 11000), 110, {}); })());
  ok('{bop} in a text is the signed percentage (a dash when there is none), and it is one of the variables of the text widgets', T.content(w('textlane', 0, { text: '{bop}' }), S2()).html === '−20%' && T.content(w('textlane', 1, { text: '{bop}' }), S2()).html === '+10%' && C('textlane', 0, 16000, undefined, { text: '{bop}' }).html === '–' && Wd.TEXT_LANE_VARS.some(v => v[0] === 'bop'));
  const d = Wd.def('bop');
  ok('the widget is in the Slotcar group, is per lane, has its options and a sample for the editor', d && d.group === 'Slotcar' && d.perLane === true && d.options.map(o => o.key).join() === 'showPercent,showOff,hinderColor,helpColor' && d.sample(0) === 'BoP ▼ −20%' && d.sample(1) === 'BoP off' && d.sample(2) === 'BoP ▲ +15%'); }
console.log(fails ? fails + ' TIMING TESTS FAILED' : 'ALL TIMING TESTS PASSED'); process.exit(fails ? 1 : 0);
