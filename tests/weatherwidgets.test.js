// 1.5.0: the weather widgets (weatherwidgets.js): Tyres, Weather Forecast and Track Conditions: what they show in a race and in the layout editor, the pictures that are drawn,
// the picture sets (Tyres, Weather, Conditions), the values of the widget itself, the units, and the {variables} of the custom text.
const E = require('../renderer/engine.js'), W = require('../renderer/weather.js'), WW = require('../renderer/weatherwidgets.js'), Wd = require('../renderer/widgets.js'), T = require('../renderer/timing.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const TYRES = ['S', 'M', 'H', 'W'];
const entries = n => Array.from({ length: n }, (_, i) => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i, carName: 'car' + i, tyre: TYRES[i] }));
const REC = { startAt: 3, rainFor: 3, cloudyFor: 1, clearingFor: 2 }; // cloudy@2 wet@3 clearing@6 dry@8
const race = (rec, o = {}) => { const r = E.createRace({ type: 'race', laps: 60, duration: 30, endRule: 'all', entries: entries(o.cars || 2), weather: rec === null ? undefined : W.clean(rec, 1) }); r.start(0); return r; };
const at = (r, i, t) => r.cross(i, t), pit = (r, i, tb, held = 2500) => { r.block(i, tb); r.tick(tb + held); };
const S = (eng, over = {}) => ({ eng, now: 20000, phase: 'running', setup: { sessionType: 'race', laps: 60 }, carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => eng.standings().find(x => x.car === c), flashOf: () => null, personalBest: () => Infinity, ...over });
const wd = (type, lane, opt) => ({ type, lane, opt });
const C = (eng, type, lane, opt, over) => T.content(wd(type, lane, opt), S(eng, over));
const count = (h, re) => (h.match(re) || []).length;
// the race is at the end of the first lap: 'laps' crossings for both cars
const lap = (r, n) => { for (let k = 1; k <= n; k++) r.cars.forEach((_, i) => at(r, i, k * 10000)); };

// ---- the pictures that are drawn ----
{ const tyres = W.TYRES.map(t => WW.tyreSvg(t.code, 'x')), svgs = W.STATES.map(([s]) => WW.stateSvg(s, 'x')), conds = ['tracktemp', 'airtemp', 'windspeed', 'winddir'].map(k => WW.condSvg(k, 0, 'x'));
  ok('a tyre is drawn for each of the six tyres: the ring and the letter in the colour of Formula 1 (hard white, medium yellow, soft red, supersoft purple, intermediate green, wet blue), and its name for a screen reader', W.TYRES.every((t, i) => tyres[i].startsWith('<svg') && tyres[i].includes(`stroke="${t.color}"`) && tyres[i].includes(`fill="${t.color}"`) && tyres[i].includes(`aria-label="${t.name} tyres"`)));
  ok('...the letter is the code of the tyre, the intermediate an I; a tyre that does not exist is drawn as a Medium', ['H', 'M', 'S', 'SS', 'I', 'W'].every((l, i) => tyres[i].includes('>' + l + '</text>')) && WW.tyreSvg('x', 'x').includes('aria-label="Medium tyres"') && WW.tyreSvg(undefined, 'x').includes('>M</text>'));
  ok('...the class is the one that is asked for', tyres.every(h => h.includes('class="x"')) && WW.tyreSvg('S', 'wxic').includes('class="wxic"'));
  ok('the weather is drawn for the four states, each with its own picture and its name (the sun, a cloud, a cloud with rain, the sun behind a cloud)', svgs.length === 4 && new Set(svgs).size === 4 && W.STATES.every(([s, n], i) => svgs[i].includes(`aria-label="${n}"`)) && svgs[0].includes('#ffc400') && !svgs[1].includes('#ffc400') && svgs[2].includes('#3b82f6') && svgs[3].includes('#ffc400') && svgs[3].includes('#cdd5e0') && WW.stateSvg('x', 'c').includes('aria-label="Dry"'));
  ok('the conditions are drawn: a thermometer by a road, a thermometer, the wind, an arrow; each with its name', new Set(conds).size === 4 && ['Track temperature', 'Air temperature', 'Wind speed', 'Wind direction'].every((n, i) => conds[i].includes(`aria-label="${n}"`)) && conds[0].includes('#6b7280') && !conds[1].includes('#6b7280'));
  ok('the arrow points the way the wind blows: a wind from the north (0) points south (turned 180), from the east (90) points west (270), from the south (180) points north (0), from the west (270) points east (90); any number of degrees', [[0, 180], [90, 270], [180, 0], [270, 90], [225, 45], [360, 180], [-90, 90], [450, 270]].every(([d, r]) => WW.rotationOf(d) === r) && WW.rotationOf('x') === 180 && WW.condSvg('winddir', 90, 'x').includes('rotate(270deg)') && !WW.condSvg('airtemp', 90, 'x').includes('rotate')); }

// ---- the icon: a picture of the set when it has one, else the drawn one ----
{ const set = { S: 'data:S', INT: 'data:INT' };
  ok('a tyre comes from the picture set where the set has its picture, and is drawn where it has not', WW.icon('tyre', 'S', set, 0, false).startsWith('<img class="wxic" src="data:S"') && WW.icon('tyre', 'M', set, 0, false).startsWith('<svg') && WW.icon('tyre', 'INT', set, 0, true).startsWith('<img class="flagimg" src="data:INT"') && WW.icon('tyre', 'M', set, 0, true).includes('class="flagsvg"'));
  ok('...the picture says what it is (Soft tyres, Cloudy, Wind speed) for a screen reader', WW.icon('tyre', 'S', set, 0, false).includes('alt="Soft tyres"') && WW.icon('state', 'cloudy', { cloudy: 'data:C' }, 0, false).includes('alt="Cloudy"') && WW.icon('cond', 'windspeed', { windspeed: 'data:W' }, 0, false).includes('alt="Wind speed"'));
  ok('...the picture of the wind direction is turned with the wind, and the other pictures are not', WW.icon('cond', 'winddir', { winddir: 'data:D' }, 90, false).includes('transform:rotate(270deg)') && !WW.icon('cond', 'airtemp', { airtemp: 'data:A' }, 90, false).includes('rotate') && WW.icon('cond', 'winddir', null, 90, false).includes('rotate(270deg)'));
  ok('...the address of a picture is made safe (a quote in it cannot get out of the page)', WW.icon('tyre', 'S', { S: 'a"b<c' }, 0, false).includes('src="a&quot;b&lt;c"'));
  ok('the standard picture of a slot of a set (shown dimmed in the set editor): a tyre, a weather, a condition', WW.slotIcon('tyres', 'SS') === WW.icon('tyre', 'SS', null, 0, false) && WW.slotIcon('weather', 'wet') === WW.icon('state', 'wet', null, 0, false) && WW.slotIcon('conditions', 'windspeed') === WW.icon('cond', 'windspeed', null, 0, false) && WW.slotIcon('tyres', 'W').includes('class="wxic"')); }

// ---- the Tyres widget in a race ----
{ const r = race(REC, { cars: 3 });
  ok('the Tyres widget shows the tyre of the Slotcar of the lane: its picture (Soft for the first car, Medium for the second)', C(r, 'tyre', 0).html.includes('aria-label="Soft tyres"') && C(r, 'tyre', 1).html.includes('aria-label="Medium tyres"') && C(r, 'tyre', 0).html.includes('class="flagsvg"') && C(r, 'tyre', 0).bg === undefined);
  ok('...a lane without a car shows nothing', C(r, 'tyre', 5).html === '');
  const n = C(r, 'tyre', 0, { tyreShow: 'name' }), b = C(r, 'tyre', 0, { tyreShow: 'both' });
  ok('as a name it is the name of the tyre on the colour of the tyre, the letters black or white to be read (Soft red: white; Medium yellow: black)', n.html === 'Soft' && n.bg === '#e8002d' && n.color === '#fff' && C(r, 'tyre', 1, { tyreShow: 'name' }).bg === '#ffd12e' && C(r, 'tyre', 1, { tyreShow: 'name' }).color === '#000' && C(r, 'tyre', 2, { tyreShow: 'name' }).html === 'Hard' && C(r, 'tyre', 2, { tyreShow: 'name' }).bg === '#f4f4f4');
  ok('...or the picture and the name together', b.html.includes('class="wxw"') && b.html.includes('aria-label="Soft tyres"') && b.html.includes('<span class="wxt">Soft</span>') && b.bg === undefined);
  ok('...anything else is the picture', C(r, 'tyre', 0, { tyreShow: 'x' }).html === C(r, 'tyre', 0).html);
  lap(r, 3); // lap 3: it is Wet (at lap 3), so the dry cars have to change
  const w0 = C(r, 'tyre', 0);
  ok('when it rains the car on dry tyres has to change: the widget turns amber and says so', r.wxState === 'wet' && w0.bg === '#ffb300' && w0.color === '#000' && w0.html.includes('Change<small>tyres</small>') && w0.html.includes('aria-label="Soft tyres"'));
  ok('...by name or with both it says "Change tyres" too', C(r, 'tyre', 0, { tyreShow: 'name' }).html === '<span class="wxt ctr">Soft<small>Change tyres</small></span>' && C(r, 'tyre', 0, { tyreShow: 'name' }).bg === '#ffb300' && C(r, 'tyre', 0, { tyreShow: 'both' }).html.includes('<small>Change tyres</small>') && C(r, 'tyre', 0, { tyreShow: 'both' }).bg === '#ffb300');
  ok('...the warning can be switched off (then it only shows the tyre)', C(r, 'tyre', 0, { tyreWarn: false }).bg === undefined && !C(r, 'tyre', 0, { tyreWarn: false }).html.includes('Change') && C(r, 'tyre', 0, { tyreWarn: false, tyreShow: 'name' }).bg === '#e8002d');
  pit(r, 0, 31000); r.unblock(0, 34000);
  ok('after the pit stop the car is on Wet tyres, the widget shows them and the amber is gone', r.cars[0].tyre === 'W' && C(r, 'tyre', 0).html.includes('aria-label="Wet tyres"') && C(r, 'tyre', 0).bg === undefined && !C(r, 'tyre', 0).html.includes('Change')); }
{ const r = race(null);
  ok('without a weather system the widget shows the tyre of the Slotcar (and never asks for a change)', C(r, 'tyre', 0).html.includes('aria-label="Soft tyres"') && C(r, 'tyre', 0).bg === undefined && C(r, 'tyre', 1).html.includes('aria-label="Medium tyres"'));
  const r2 = E.createRace({ type: 'race', laps: 5, endRule: 'all', entries: [{ lane: 0, driverId: 'd', carId: 'c', driverName: 'D', carName: 'car' }] }); r2.start(0);
  ok('...a car that has no tyre is on Medium', C(r2, 'tyre', 0).html.includes('aria-label="Medium tyres"')); }
{ const r = race(REC), sets = [{ id: 't1', kind: 'tyres', images: { S: 'data:SOFT', W: 'data:WET' } }, { id: 'f1', kind: 'fuel', images: {} }];
  ok('a picture set of the kind Tyres is used, tyre by tyre (the Soft has its picture, the Medium is still drawn)', C(r, 'tyre', 0, { imageSet: 't1' }, { imageSets: sets }).html.includes('src="data:SOFT"') && C(r, 'tyre', 1, { imageSet: 't1' }, { imageSets: sets }).html.includes('<svg'));
  ok('...a set of another kind, or a set that has been deleted, is ignored', C(r, 'tyre', 0, { imageSet: 'f1' }, { imageSets: sets }).html.includes('<svg') && C(r, 'tyre', 0, { imageSet: 'gone' }, { imageSets: sets }).html.includes('<svg') && C(r, 'tyre', 0, { imageSet: 't1' }).html.includes('<svg'));
  ok('...a picture set of the Tyres is only for the Tyres widget', Wd.resolveOpt({ type: 'tyre', opt: { imageSet: 't1' } }, sets).tyreImages.S === 'data:SOFT' && Wd.resolveOpt({ type: 'wxforecast', opt: { imageSet: 't1' } }, sets).tyreImages === undefined && Wd.resolveOpt({ type: 'wxconditions', opt: { imageSet: 't1' } }, sets).condImages === undefined);
  lap(r, 3);
  ok('...and the picture is a part of the amber warning too', C(r, 'tyre', 0, { imageSet: 't1' }, { imageSets: sets }).html.includes('src="data:SOFT"') && C(r, 'tyre', 0, { imageSet: 't1' }, { imageSets: sets }).bg === '#ffb300'); }

// ---- the Weather Forecast widget ----
{ const r = race(REC);
  const f = C(r, 'wxforecast', null);
  ok('the Weather Forecast widget shows the weather now and the next change: a sun, "Dry", "Cloudy in 2 laps" (before the first lap)', f.html.includes('class="wxw"') && f.html.includes('aria-label="Dry"') && f.html.includes('<span class="wxt">Dry<small>Cloudy in 2 laps</small></span>'));
  lap(r, 1);
  ok('...the time to the next change counts down with the laps of the leader', C(r, 'wxforecast', null).html.includes('Cloudy in 1 lap'));
  lap(r, 2);
  ok('...Cloudy: a cloud and "Rain in 1 lap"', C(r, 'wxforecast', null).html.includes('aria-label="Cloudy"') && C(r, 'wxforecast', null).html.includes('Cloudy<small>Rain in 1 lap</small>'));
  lap(r, 3);
  ok('...Wet: a rain cloud and "Clearing in 3 laps"', r.wxState === 'wet' && C(r, 'wxforecast', null).html.includes('aria-label="Wet"') && C(r, 'wxforecast', null).html.includes('Wet<small>Clearing in 3 laps</small>'));
  ok('only the text, or only the picture', C(r, 'wxforecast', null, { show: 'text' }).html === '<span class="wxt">Wet<small>Clearing in 3 laps</small></span>' && C(r, 'wxforecast', null, { show: 'icon' }).html.includes('class="flagsvg"') && !C(r, 'wxforecast', null, { show: 'icon' }).html.includes('Clearing') && C(r, 'wxforecast', null, { show: 'x' }).html === C(r, 'wxforecast', null).html);
  ok('...what comes next can be switched off', C(r, 'wxforecast', null, { showNext: false, show: 'text' }).html === '<span class="wxt">Wet</span>' && !C(r, 'wxforecast', null, { showNext: false }).html.includes('small'));
  lap(r, 9);
  ok('when the forecast is done there is nothing next (the weather is Dry again)', r.wxState === 'dry' && C(r, 'wxforecast', null, { show: 'text' }).html === '<span class="wxt">Dry</span>');
  const d = race({ startMode: 'director' });
  ok('when the Race Director decides there is no forecast to show, only the weather now', C(d, 'wxforecast', null, { show: 'text' }).html === '<span class="wxt">Dry</span>' && (d.wxSet('wet', 5000, 'director'), C(d, 'wxforecast', null, { show: 'text' }).html === '<span class="wxt">Wet</span>'));
  ok('without a weather system it shows Dry', C(race(null), 'wxforecast', null, { show: 'text' }).html === '<span class="wxt">Dry</span>' && C(race(null), 'wxforecast', null).html.includes('aria-label="Dry"'));
  const rt = race(REC), sets = [{ id: 'w1', kind: 'weather', images: { dry: 'data:DRY', wet: 'data:WETC' } }];
  ok('a picture set of the kind Weather is used for the weather now, state by state (Dry has its picture, Cloudy is drawn)', C(rt, 'wxforecast', null, { imageSet: 'w1' }, { imageSets: sets }).html.includes('src="data:DRY"') && (lap(rt, 2), rt.wxState === 'cloudy') && C(rt, 'wxforecast', null, { imageSet: 'w1' }, { imageSets: sets }).html.includes('<svg') && (lap(rt, 3), C(rt, 'wxforecast', null, { imageSet: 'w1' }, { imageSets: sets }).html.includes('src="data:WETC"')));
  ok('...as the only picture of the widget it fills it', C(rt, 'wxforecast', null, { imageSet: 'w1', show: 'icon' }, { imageSets: sets }).html.startsWith('<img class="flagimg" src="data:WETC"') && Wd.resolveOpt({ type: 'wxforecast', opt: { imageSet: 'w1' } }, sets).stateImages.dry === 'data:DRY'); }

// ---- the Track Conditions widget ----
{ const r = race(REC);
  const h = C(r, 'wxconditions', null).html;
  ok('the Track Conditions widget shows the track temperature, the air temperature, the wind speed and where the wind comes from, with a picture for each (Dry: 30 °C, 24 °C, 10 km/h, SW)', h.startsWith('<span class="cdw cd-row">') && count(h, /class="cdi"/g) === 4 && h.includes('<span class="cdt">30 °C</span>') && h.includes('<span class="cdt">24 °C</span>') && h.includes('<span class="cdt">10 km/h</span>') && h.includes('<span class="cdt">SW</span>')
    && ['Track temperature', 'Air temperature', 'Wind speed', 'Wind direction'].every(n => h.includes(`aria-label="${n}"`)) && h.indexOf('30 °C') < h.indexOf('24 °C') && h.indexOf('24 °C') < h.indexOf('10 km/h') && h.indexOf('10 km/h') < h.indexOf('SW'));
  ok('...the arrow is turned with the wind (from 225, so it points to 45)', h.includes('rotate(45deg)'));
  lap(r, 3);
  const w = C(r, 'wxconditions', null).html;
  ok('the numbers follow the weather: when it rains the track is colder and the wind harder (Wet: 17 °C, 15 °C, 22 km/h, W)', r.wxState === 'wet' && w.includes('17 °C') && w.includes('15 °C') && w.includes('22 km/h') && w.includes('<span class="cdt">W</span>') && w.includes('rotate(90deg)'));
  ok('...each part can be left out; with nothing left it shows a dash', !C(r, 'wxconditions', null, { showTrack: false }).html.includes('17 °C') && count(C(r, 'wxconditions', null, { showTrack: false }).html, /class="cdi"/g) === 3 && count(C(r, 'wxconditions', null, { showAir: false, showWind: false }).html, /class="cdi"/g) === 2 && !C(r, 'wxconditions', null, { showDir: false }).html.includes('>W<') && C(r, 'wxconditions', null, { showTrack: false, showAir: false, showWind: false, showDir: false }).html === '–');
  ok('...the direction in degrees too (W 270°)', C(r, 'wxconditions', null, { showDegrees: true }).html.includes('<span class="cdt">W 270°</span>') && !w.includes('270°'));
  ok('...in a row, a column, or two by two', C(r, 'wxconditions', null, { layout: 'column' }).html.includes('cd-column') && C(r, 'wxconditions', null, { layout: 'grid' }).html.includes('cd-grid') && C(r, 'wxconditions', null, { layout: 'x' }).html.includes('cd-row'));
  ok('...in the other units (Fahrenheit and miles per hour) when the widget says so: 63 °F, 59 °F, 14 mph', C(r, 'wxconditions', null, { units: 'imperial' }).html.includes('63 °F') && C(r, 'wxconditions', null, { units: 'imperial' }).html.includes('59 °F') && C(r, 'wxconditions', null, { units: 'imperial' }).html.includes('14 mph') && C(r, 'wxconditions', null, { units: 'metric' }).html.includes('17 °C'));
  const imp = race({ ...REC, units: 'imperial', trackTempDry: 86, airTempDry: 75, windSpeedDry: 6, windDirDry: 90 });
  ok('with a weather system in imperial the widget shows what the system says (86 °F, 75 °F, 6 mph, E), unless it asks for the other units (30 °C, 24 °C, 10 km/h)', C(imp, 'wxconditions', null).html.includes('86 °F') && C(imp, 'wxconditions', null).html.includes('6 mph') && C(imp, 'wxconditions', null).html.includes('>E<') && C(imp, 'wxconditions', null, { units: 'system' }).html.includes('86 °F') && C(imp, 'wxconditions', null, { units: 'metric' }).html.includes('30 °C') && C(imp, 'wxconditions', null, { units: 'metric' }).html.includes('10 km/h'));
  ok('without a weather system there is nothing to show (a dash)', C(race(null), 'wxconditions', null).html === '–'); }
{ const rn = race(null), own = { values: 'own', ownDryTrack: 40, ownDryAir: 31, ownDryWind: 5, ownDryDir: 90 };
  ok('with values of its own the widget needs no weather system: it shows them (40 °C, 31 °C, 5 km/h, E) and ignores a system', C(rn, 'wxconditions', null, own).html.includes('40 °C') && C(rn, 'wxconditions', null, own).html.includes('31 °C') && C(rn, 'wxconditions', null, own).html.includes('5 km/h') && C(rn, 'wxconditions', null, own).html.includes('>E<') && C(race(REC), 'wxconditions', null, own).html.includes('40 °C'));
  ok('...the states without a number of its own have the standard numbers (wet: 17 °C), in the units that are shown (imperial: 63 °F)', (r => { lap(r, 3); return C(r, 'wxconditions', null, { values: 'own', ownDryTrack: 40 }).html.includes('17 °C') && C(r, 'wxconditions', null, { values: 'own', units: 'imperial' }).html.includes('63 °F'); })(race(REC)));
  ok('...the numbers of the widget are in the units that are shown: 90 with imperial is 90 °F, not converted', C(rn, 'wxconditions', null, { values: 'own', units: 'imperial', ownDryTrack: 90 }).html.includes('90 °F'));
  ok('...nonsense and empty fields are the standard numbers', C(rn, 'wxconditions', null, { values: 'own', ownDryTrack: 'x', ownDryAir: '' }).html.includes('30 °C') && C(rn, 'wxconditions', null, { values: 'own', ownDryTrack: 'x', ownDryAir: '' }).html.includes('24 °C'));
  const o = WW.ownOf({ ownWetWind: 60, ownCloudyDir: 123 }, 'metric'), oi = WW.ownOf({}, 'imperial');
  ok('the values of the widget itself, for every state: the ones that are there, the standard for the rest, in the units that are shown (the standard dry wind of 10 km/h is 6 mph)', o.wet.wind === 60 && o.cloudy.dir === 123 && o.dry.track === 30 && o.clearing.dir === 295 && oi.dry.wind === 6 && oi.dry.track === 86 && oi.wet.air === 59 && WW.ownKey('dry', 'track') === 'ownDryTrack' && WW.ownKey('clearing', 'dir') === 'ownClearingDir' && WW.OWN_ITEMS.map(x => x[0]).join() === 'track,air,wind,dir');
  const rs = race(REC), sets = [{ id: 'c1', kind: 'conditions', images: { tracktemp: 'data:TT', winddir: 'data:WD' } }];
  const h = C(rs, 'wxconditions', null, { imageSet: 'c1' }, { imageSets: sets }).html;
  ok('a picture set of the kind Conditions is used picture by picture (track temperature and wind direction are the set\'s, the air temperature and the wind speed are drawn); the picture of the direction is turned with the wind', h.includes('src="data:TT"') && h.includes('src="data:WD"') && h.includes('transform:rotate(45deg)') && count(h, /<svg/g) === 2 && Wd.resolveOpt({ type: 'wxconditions', opt: { imageSet: 'c1' } }, sets).condImages.tracktemp === 'data:TT'); }

// ---- what the layout editor shows (made-up values) ----
{ const tyre = i => WW.tyreSample(i, {});
  ok('the samples: the tyres of the lanes are Soft, Medium, Hard, Supersoft, Intermediate and Wet, one after the other', ['Soft', 'Medium', 'Hard', 'Supersoft', 'Intermediate', 'Wet'].every((n, i) => tyre(i).includes(`aria-label="${n} tyres"`)) && tyre(6).includes('aria-label="Soft tyres"') && WW.tyreSample(0, { tyreShow: 'name' }).includes('class="tyrechip"') && WW.tyreSample(0, { tyreShow: 'name' }).includes('background:#e8002d;color:#fff') && WW.tyreSample(1, { tyreShow: 'both' }).includes('<span class="wxt">Medium</span>'));
  ok('...the sample of the forecast is rain with "Clearing in 3 laps", as the options say', WW.forecastSample({}).includes('aria-label="Wet"') && WW.forecastSample({}).includes('Clearing in 3 laps') && !WW.forecastSample({ showNext: false }).includes('Clearing') && WW.forecastSample({ show: 'text' }) === '<span class="wxt">Wet<small>Clearing in 3 laps</small></span>' && WW.forecastSample({ show: 'icon' }).includes('flagsvg'));
  ok('...the sample of the conditions is the dry weather of the standard weather system, and shows what the options say', WW.conditionsSample({}).includes('30 °C') && WW.conditionsSample({}).includes('10 km/h') && WW.conditionsSample({ units: 'imperial' }).includes('86 °F') && WW.conditionsSample({ showTrack: false }).includes('24 °C') && !WW.conditionsSample({ showTrack: false }).includes('30 °C') && WW.conditionsSample({ values: 'own', ownDryTrack: 12 }).includes('12 °C') && WW.conditionsSample({ values: 'own', units: 'imperial' }).includes('86 °F'));
  ok('the widgets of the register use them (and every widget has a sample)', ['tyre', 'wxforecast', 'wxconditions'].every(t => String(Wd.sampleOf(Wd.def(t), 0, { opt: {} })).length > 20) && Wd.sampleOf(Wd.def('wxconditions'), 0, { opt: { units: 'imperial' } }).includes('°F') && Wd.sampleOf(Wd.def('tyre'), 1, { opt: {} }).includes('Medium')); }

// ---- the register ----
{ const d = ['tyre', 'wxforecast', 'wxconditions'].map(Wd.def);
  ok('three widgets in a group Weather: Tyres (one for each lane), Weather Forecast, Track Conditions', d.every(x => x.group === 'Weather') && d[0].perLane === true && !d[1].perLane && !d[2].perLane && d.map(x => x.label).join() === 'Tyres,Weather Forecast,Track Conditions');
  ok('...each has a picture set option of its own kind, with its own "none"', d.map(x => x.options[0]).every(o => o.key === 'imageSet' && o.type === 'imageset') && d.map(x => x.options[0].kind).join() === 'tyres,weather,conditions' && d.every(x => /^None/.test(x.options[0].noneLabel)));
  ok('...the options of the Tyres: how it is shown, the warning; of the forecast: how it is shown, what is next; of the conditions: the values, the units, the four parts, the degrees, the layout, the note, and 16 numbers of its own', d[0].options.map(o => o.key).join() === 'imageSet,tyreShow,tyreWarn' && d[1].options.map(o => o.key).join() === 'imageSet,show,showNext'
    && d[2].options.map(o => o.key).slice(0, 10).join() === 'imageSet,values,units,showTrack,showAir,showWind,showDir,showDegrees,layout,ownnote' && d[2].options.length === 26 && d[2].options.filter(o => o.type === 'number').length === 16);
  const val = d[2].options.find(o => o.key === 'values'), un = d[2].options.find(o => o.key === 'units'), note = d[2].options.find(o => o.key === 'ownnote'), nums = d[2].options.filter(o => o.type === 'number');
  ok('...the choice of the values and of the units redraws the options (the numbers of its own show only when it says so, and their standard follows the units)', val.rerender === true && un.rerender === true && val.default === 'system' && un.default === 'system' && note.show({ values: 'own' }) === true && note.show({ values: 'system' }) === false && nums.every(o => o.show({ values: 'own' }) === true && o.show({}) === false)
    && nums[0].key === 'ownDryTrack' && nums[0].default === 30 && nums[0].defaultOf({}) === 30 && nums[0].defaultOf({ units: 'imperial' }) === 86 && nums[2].defaultOf({ units: 'imperial' }) === 6 && nums[3].defaultOf({ units: 'imperial' }) === 225 && nums[3].max === 359 && nums[3].min === 0 && nums[0].min === -60 && nums[2].min === 0);
  ok('...the options of the Tyres and of the Weather Forecast offer the choices that are explained', d[0].options[1].choices.map(c => c[0]).join() === 'icon,name,both' && d[0].options[2].default === true && d[1].options[1].choices.map(c => c[0]).join() === 'icon,text,both' && d[1].options[1].default === 'both' && d[1].options[2].default === true && d[2].options[8].choices.map(c => c[0]).join() === 'row,column,grid'); }

// ---- the Tyres widget in the rows of a Leaderboard row design (the only one of the three that belongs to one lane) ----
{ const Rows = require('../renderer/rows.js'), r = race(REC, { cars: 3 }), design = { ...Rows.defaultDesign(), widgets: [{ id: 'n', type: 'name', lane: 0, x: 0, y: 0, w: 400, h: 70, opt: {} }, { id: 'ty', type: 'tyre', lane: 0, x: 400, y: 0, w: 140, h: 70, opt: {} }, { id: 'ty2', type: 'tyre', lane: 0, x: 560, y: 0, w: 200, h: 70, opt: { tyreShow: 'name' } }] };
  const rowsHtml = () => { const st = r.standings(); return Rows.html(design, S(r, { standings: () => st, rowOf: c => st.find(x => x.car === c) })); };
  let h = rowsHtml();
  ok('a row design can have a Tyres cell and shows the tyre of the car of each row (Soft, Medium, Hard)', (h.match(/class="rrow /g) || []).length === 3 && ['Soft', 'Medium', 'Hard'].every(n => h.includes(`aria-label="${n} tyres"`)) && h.includes('background:#e8002d') && h.includes('background:#ffd12e'));
  lap(r, 3); h = rowsHtml();
  ok('...in the rain the cells of the cars that have to change are amber', r.wxState === 'wet' && (h.match(/background:#ffb300/g) || []).length >= 4 && h.includes('Change tyres'));
  ok('...the row designer shows the Tyres cell with made-up tyres, and does not offer the other two widgets', Rows.sampleHtml(design, 4, []).includes('aria-label="Soft tyres"') && !Wd.REGISTRY.filter(d => d.perLane).some(d => d.type === 'wxforecast' || d.type === 'wxconditions') && Wd.REGISTRY.filter(d => d.perLane).some(d => d.type === 'tyre')); }

// ---- the {variables} of the custom text widgets ----
{ const r = race(REC), lane = Wd.TEXT_LANE_VARS.map(v => v[0]), rv = Wd.TEXT_RACE_VARS.map(v => v[0]);
  ok('custom text: {tyre} for a lane, and {weather}, {nextweather}, {tracktemp}, {airtemp}, {windspeed}, {winddir} for the race are listed (with an explanation)', lane.includes('tyre') && ['weather', 'nextweather', 'tracktemp', 'airtemp', 'windspeed', 'winddir'].every(v => rv.includes(v)) && [...Wd.TEXT_LANE_VARS, ...Wd.TEXT_RACE_VARS].every(v => v[1] && v[1].length > 3));
  ok('...{tyre} is the name of the tyre of the car', C(r, 'textlane', 0, { text: '{tyre}' }).html === 'Soft' && C(r, 'textlane', 1, { text: '{tyre}/{name}' }).html === 'Medium/D1' && WW.laneVars(null).tyre === '–' && WW.laneVars({ tyre: 'SS' }).tyre === 'Supersoft' && WW.laneVars({}).tyre === 'Medium');
  const o = { standings: () => r.standings() };
  ok('...the race words say the weather and the conditions (Dry, Cloudy in 2 laps, 30 °C, 24 °C, 10 km/h, SW)', C(r, 'textrace', null, { text: '{weather}|{nextweather}|{tracktemp}|{airtemp}|{windspeed}|{winddir}' }, o).html === 'Dry|Cloudy in 2 laps|30 °C|24 °C|10 km/h|SW');
  lap(r, 3);
  ok('...and they follow the weather (Wet, Clearing in 3 laps, 17 °C, 15 °C, 22 km/h, W)', C(r, 'textrace', null, { text: '{weather}|{nextweather}|{tracktemp}|{airtemp}|{windspeed}|{winddir}' }, o).html === 'Wet|Clearing in 3 laps|17 °C|15 °C|22 km/h|W');
  const rn = race(null);
  ok('...in a race without weather they are dashes or empty ({weather} –, {nextweather} nothing, the numbers –)', C(rn, 'textrace', null, { text: '{weather}|{nextweather}|{tracktemp}|{airtemp}|{windspeed}|{winddir}' }, { standings: () => rn.standings() }).html === '–||–|–|–|–' && same(WW.raceVars(rn, 0), { weather: '–', nextweather: '', tracktemp: '–', airtemp: '–', windspeed: '–', winddir: '–' }));
  const imp = race({ ...REC, units: 'imperial', trackTempDry: 86, windSpeedDry: 6 });
  ok('...in the units of the weather system', WW.raceVars(imp, 0).tracktemp === '86 °F' && WW.raceVars(imp, 0).windspeed === '6 mph'); }

// ---- 1.5.0: what the mutation check asked for ----
{ const colours = W.TYRES.map(t => WW.onColor(t.color)), r = race(REC, { cars: 1 });
  ok('black or white letters, whichever reads better: black on the hard (white) and the medium (yellow), white on soft red, supersoft purple, intermediate green and wet blue', same(colours, ['#000', '#000', '#fff', '#fff', '#fff', '#fff']));
  ok('...in between: a grey of 60% is still white, a lighter grey is black; something that is not a colour (nothing, a word, a short code) is white', WW.onColor('#999999') === '#fff' && WW.onColor('#aaaaaa') === '#000' && WW.onColor('#808080') === '#fff' && WW.onColor('#bbbbbb') === '#000' && WW.onColor('') === '#fff' && WW.onColor(undefined) === '#fff' && WW.onColor('red') === '#fff' && WW.onColor('#fff') === '#fff');
  const names = ['S', 'M', 'H', 'SS', 'INT', 'W'].map(code => { const e = E.createRace({ type: 'race', laps: 5, endRule: 'all', entries: [{ lane: 0, driverId: 'd', carId: 'c', driverName: 'D', carName: 'x', tyre: code }] }); e.start(0); return C(e, 'tyre', 0, { tyreShow: 'name' }); });
  ok('the tyre as a name: the right colours for all six (Hard black on white, Medium black on yellow, Soft, Supersoft, Intermediate and Wet white on their colour)', names.map(n => n.bg).join() === '#e8002d,#ffd12e,#f4f4f4,#9b4dff,#43b02a,#0067ff' && names.map(n => n.color).join() === '#fff,#000,#000,#fff,#fff,#fff' && names.map(n => n.html).join() === 'Soft,Medium,Hard,Supersoft,Intermediate,Wet'); }
{ const conds = ['tracktemp', 'airtemp', 'windspeed', 'winddir'].map(k => WW.condSvg(k, 0, 'x'));
  ok('the wind speed is drawn as wind (curls, no arrow, never turned); only the direction is an arrow that turns', !conds[2].includes('rotate') && conds[2].includes('stroke-linecap="round"') && conds[3].includes('rotate(180deg)') && conds[3].includes('fill="currentColor"') && !conds[0].includes('rotate') && !conds[1].includes('rotate') && !conds[2].includes('M24 5l12 33')); }
ok('the arrow turns round whatever the number: -200 degrees is 340, 90.4 is 270 (the number is rounded), 90.6 is 271, 540 is 0', [[-200, 340], [90.4, 270], [90.6, 271], [540, 0], [-540, 0], [719, 179]].every(([d, r]) => WW.rotationOf(d) === r));
{ const d = ['tyre', 'wxforecast', 'wxconditions'].map(Wd.def);
  ok('the standard of the options: the tyre as a picture, the forecast as picture and text, the conditions in a row without the degrees, from the weather system and in its units', d[0].options[1].default === 'icon' && d[1].options[1].default === 'both' && d[2].options.find(o => o.key === 'layout').default === 'row' && d[2].options.find(o => o.key === 'showDegrees').default === false && d[2].options.find(o => o.key === 'values').default === 'system' && d[2].options.find(o => o.key === 'units').default === 'system'
    && d[2].options.filter(o => /^show[TAWD]/.test(o.key) && o.key !== 'showDegrees').every(o => o.default === true)); }
{ const r = race(REC, { cars: 1 });
  ok('with the picture and the name the tyre is a small icon beside the name; with a picture only it fills the widget (a drawn tyre has the class of an icon, or of a whole picture)', C(r, 'tyre', 0, { tyreShow: 'both' }).html.includes('class="wxic"') && !C(r, 'tyre', 0, { tyreShow: 'both' }).html.includes('flagsvg') && C(r, 'tyre', 0).html.includes('class="flagsvg"') && WW.tyreSample(0, { tyreShow: 'both' }).includes('class="wxic"') && WW.tyreSample(0, {}).includes('class="flagsvg"') && !WW.tyreSample(0, {}).includes('class="wxic"'));
  ok('...the sample of the forecast with only a picture is the rain', WW.forecastSample({ show: 'icon' }).includes('aria-label="Wet"') && !WW.forecastSample({ show: 'icon' }).includes('aria-label="Dry"')); }
{ const imp = race({ ...REC, units: 'imperial', trackTempDry: 90 });
  ok('own values in a race whose weather system is imperial: the numbers of the widget are taken in those units, and the states you leave empty start from the standard in those units too (track 90 °F as typed; air 75 °F, not 24)', C(imp, 'wxconditions', null, { values: 'own', ownDryTrack: 91 }).html.includes('91 °F') && C(imp, 'wxconditions', null, { values: 'own', ownDryTrack: 91 }).html.includes('75 °F') && C(imp, 'wxconditions', null, { values: 'own', ownDryTrack: 91 }).html.includes('6 mph') && !C(imp, 'wxconditions', null, { values: 'own', ownDryTrack: 91 }).html.includes('24 °F')); }
{ const r = E.createRace({ type: 'race', laps: 60, endRule: 'all', entries: entries(2), weather: W.clean({ unit: 'time', startAt: 2, cloudyFor: 0, rainFor: 1 }, 1) }); r.start(0);
  const at30 = { now: 30000 };
  ok('a forecast in minutes counts the time of the race, as the timing page draws it (30 seconds in: "Rain in 1 minute 30 seconds"; the weather widget and the custom text agree)', C(r, 'wxforecast', null, { show: 'text' }, at30).html === '<span class="wxt">Dry<small>Rain in 1 minute 30 seconds</small></span>' && C(r, 'textrace', null, { text: '{nextweather}' }, { ...at30, standings: () => r.standings() }).html === 'Rain in 1 minute 30 seconds'
    && C(r, 'wxforecast', null, { show: 'text' }, { now: 90000 }).html.includes('Rain in 30 seconds')); }
{ const r = race(REC, { cars: 2 }), h = C(r, 'wxforecast', null, { show: 'text' }).html;
  ok('...and a forecast in laps does not care about the clock', h.includes('Cloudy in 2 laps') && C(r, 'wxforecast', null, { show: 'text' }, { now: 900000 }).html.includes('Cloudy in 2 laps')); }

if (fails) { console.log(fails + ' FAILED'); process.exit(1); }
console.log('ALL WEATHER WIDGET TESTS PASSED');
