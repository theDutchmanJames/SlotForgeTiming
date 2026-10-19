// Delta Timers (0.91.0): the numbers (delta.js), the nine widgets as the live timing page draws them (timing.js), and their place in the widget list.
const { createRace } = require('../renderer/engine.js');
const D = require('../renderer/delta.js');
const T = require('../renderer/timing.js');
const Wd = require('../renderer/widgets.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };

// ---- the size of a difference ----
{
  const f = (ms, d) => D.format(ms, d);
  ok('a negative difference is faster ("fast"), a positive one slower ("slow"), the text has no sign', f(-456).dir === 'fast' && f(-456).text === '0.456' && f(456).dir === 'slow' && f(456).text === '0.456');
  ok('the decimals are 3 by default, and can be 2 or 1 (rounded, not cut)', f(1234).text === '1.234' && f(1234, 2).text === '1.23' && f(1236, 2).text === '1.24' && f(1250, 1).text === '1.3' && f(-125, 1).text === '0.1' && f(1234, '2').text === '1.23');
  ok('a number of decimals that makes no sense becomes 3 (and 0 or less becomes 1, more than 3 stays 3)', f(1234, 'x').text === '1.234' && f(1234, undefined).text === '1.234' && f(1234, 0).text === '1.2' && f(1234, 9).text === '1.234');
  ok('a difference that rounds to nothing is "equal", whatever its sign', f(0).dir === 'equal' && f(0.3).dir === 'equal' && f(-0.4).dir === 'equal' && f(40, 1).dir === 'equal' && f(60, 1).dir === 'slow' && f(0).text === '0.000' && f(0, 1).text === '0.0');
  ok('a minute or more is written with minutes: 1:02.345, and a round minute keeps its zeros', f(62345).text === '1:02.345' && f(-60000).text === '1:00.000' && f(60000, 1).text === '1:00.0' && f(59999.7).text === '1:00.000' && f(125000, 2).text === '2:05.00');
}
ok('the text colour on a badge is black on light colours and white on dark ones, as everywhere else', D.onColor('#2ee57f') === '#000' && D.onColor('#d62828') === '#fff' && D.onColor('#6b7380') === '#fff' && T.contrast('#ffc400') === '#000' && T.contrast('#a45cff') === '#fff' && ['#000000', '#ffffff', '#123456', '#ffc400'].every(c => T.contrast(c) === D.onColor(c)));
ok('only a plain #rrggbb colour is used; anything else becomes the standard colour', D.colorOf({ fasterColor: '#112233' }, 'fasterColor') === '#112233' && ['red', '#123', 'url(x)', '#12345g', 'red;background:url(x)', undefined, 5, '"><script>'].every(v => D.colorOf({ slowerColor: v }, 'slowerColor') === D.DEFAULTS.slowerColor) && D.colorOf(null, 'equalColor') === D.DEFAULTS.equalColor);

// ---- a race to compare in: three lanes ----
const people = [0, 1, 2].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: ['Alex', 'Sam', 'Kim'][i], nickname: '', flag: '', avatar: '', carName: 'car' }));
const eng = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); eng.start(0);
[5000, 10200, 15300].forEach(t => eng.cross(0, t));   // lane 1 (index 0): laps 5000, 5200, 5100: best 5000, average 5100, median 5100, last 5100, leads
[6000, 12100].forEach(t => eng.cross(1, t));          // lane 2: 6000, 6100: best 6000, average 6050, median 6050, last 6100
[4800, 10300].forEach(t => eng.cross(2, t));          // lane 3: 4800, 5500: best 4800, average 5150, median 5150, last 5500
const PB = { d0: 4900, d1: 5900, d2: 4700 };
const pits = { 0: 7000, 1: 8200 };
const S0 = (over = {}) => {
  const e = Object.create(eng); e.pitTime = i => (pits[i] !== undefined ? { ms: pits[i], live: false } : null); // (a stop of 7.000 for lane 1, 8.200 for lane 2, none for lane 3)
  const st = eng.standings();
  return { eng: e, now: 16000, phase: 'running', lights: 0, setup: { sessionType: 'race', laps: 5 }, heat: null, track: {},
    carByLane: l => eng.cars.find(c => c.lane === l) || null, rowOf: c => st.find(r => r.car === c), standings: () => st, flashOf: () => null,
    personalBest: id => PB[id] ?? Infinity, sessionRecord: () => ({ time: 4800, name: 'Kim' }), trackRecord: () => ({ time: 4500, name: 'Old' }), ...over };
};
const S = S0(), car = l => eng.cars[l];
const dm = (type, lane, opt, over) => D.compute(type, opt, car(lane), over || S, 16000);   // the difference in ms (null: nothing to show)
const v = (type, lane, opt, over) => dm(type, lane, opt, over).ms;
ok('the race is as the comments say', car(0).best === 5000 && car(1).laps.join() === '6000,6100' && car(2).laps.join() === '4800,5500' && S.standings()[0].car === car(0));

// ---- Personal Best Delta ----
ok('my value against theirs: lane 2 (personal best 5.900) against lane 1 (4.900) is 1.000 slower', v('drecordlap', 1, { measure: 'static', compare: 'lane', targetLane: '1' }) === 1000 && v('drecordlap', 2, { targetLane: '1' }) === -200);
ok('...the choice is "my value against theirs" when nothing is chosen, and the lane is chosen with a number from 1', v('drecordlap', 1, {}) === v('drecordlap', 1, { measure: 'static' }) && v('drecordlap', 1, { targetLane: '3' }) === 1200 && v('drecordlap', 0, { targetLane: 3 }) === 200);
ok('my latest lap against their value: lane 2\'s last lap 6.100 against lane 1\'s personal best 4.900', v('drecordlap', 1, { measure: 'live', targetLane: '1' }) === 1200 && v('drecordlap', 0, { measure: 'live', targetLane: '3' }) === 5100 - 4700);
ok('my latest lap against my own value: 6.100 against my own personal best 5.900, and no other lane is needed (the lane and the comparison are not used)', v('drecordlap', 1, { measure: 'self' }) === 200 && v('drecordlap', 1, { measure: 'self', compare: 'track', targetLane: '9' }) === 200);
ok('compared with the leader (lane 1 leads): lane 2 is 1.000 slower; the leader itself has nothing to be compared with', v('drecordlap', 1, { compare: 'leader' }) === 1000 && dm('drecordlap', 0, { compare: 'leader' }).why === 'self');
ok('compared with the fastest in this race (lane 3, 4.700): lane 2 is 1.200 slower; the fastest itself has nothing to be compared with', v('drecordlap', 1, { compare: 'fastest' }) === 1200 && v('drecordlap', 0, { compare: 'fastest' }) === 200 && dm('drecordlap', 2, { compare: 'fastest' }).why === 'self');
ok('compared with the track record (4.500) or the session record (4.800)', v('drecordlap', 1, { compare: 'track' }) === 1400 && v('drecordlap', 1, { compare: 'session' }) === 1100 && v('drecordlap', 1, { measure: 'live', compare: 'track' }) === 1600);
ok('without a lane chosen it is compared with the next lane, and the last lane with the first: lane 1 with lane 2 (-1.000), lane 2 with lane 3 (+1.200), lane 3 with lane 1 (-0.200)', v('drecordlap', 0, {}) === -1000 && v('drecordlap', 1, {}) === 1200 && v('drecordlap', 2, {}) === -200 && v('drecordlap', 2, { targetLane: '' }) === -200);
ok('a choice that is not one of the choices falls back to the first: the measure to "my value against theirs", the comparison to a chosen lane', v('drecordlap', 1, { measure: 'bogus', compare: 'bogus', targetLane: '1' }) === 1000 && v('drecordlap', 1, { measure: 'static', compare: 'self', targetLane: '1' }) === 1000);

// ---- Lap to Lap Delta (1.29.0): the last lap against the lap before it ----
{
  ok('Lap to Lap Delta: the last lap against the lap before it: lane 1 (5.200 then 5.100) is 0.100 faster, lane 2 (6.000 then 6.100) 0.100 slower, lane 3 (4.800 then 5.500) 0.700 slower', v('dlaplap', 0) === -100 && v('dlaplap', 1) === 100 && v('dlaplap', 2) === 700 && dm('dlaplap', 0).who === 'the lap before it');
  ok('...it needs no other lane and no choice: the comparison, the lane, the measure and "left value shows" change nothing', [{ compare: 'leader', targetLane: '2' }, { measure: 'static', compare: 'track' }, { measure: 'self', leftShows: 'ref' }, { compare: 'bogus', targetLane: '9' }].every(o => v('dlaplap', 1, o) === 100 && v('dlaplap', 0, o) === -100));
  const fake = laps => ({ lane: 0, laps, best: null });
  const f2 = laps => D.compute('dlaplap', {}, fake(laps), S, 16000);
  ok('...a lane on lap 10 has driven 9 laps: the 9th against the 8th (5.050 after 5.100 is 0.050 faster), and only the last two laps count', f2([5000, 5300, 5200, 5100, 5000, 5400, 5100, 5100, 5050]).ms === -50 && f2([5000, 5300, 5200, 5100, 5000, 5400, 5100, 5100, 5050]).ms === f2([9999, 5100, 5050]).ms && f2([5100, 5100]).ms === 0);
  ok('...with one lap there is nothing to compare with ("before"), with no lap there is no time ("mine"), and a lap that is not a number is no lap', f2([5000]).ms === null && f2([5000]).why === 'before' && f2([]).why === 'mine' && f2([NaN, 5000]).why === 'before' && f2([5000, NaN]).why === 'mine' && D.compute('dlaplap', {}, null, S, 16000).why === 'mine');
  ok('...and the dash says why: two laps are needed', D.badge(f2([5000])).includes('dlt-none') && D.badge(f2([5000])).includes('Needs two laps') && D.WHY.before.endsWith('.'));
  ok('...it has no "left value shows": the value is the last lap, whatever the setting says (also while the lap before is not there yet: no blank left side)', D.leftOf('dlaplap', { leftShows: 'ref' }, car(0), dm('dlaplap', 0)) === null && D.leftOf('dlaplap', {}, car(0), dm('dlaplap', 0)) === null && D.leftOf('dlaplap', { leftShows: 'ref' }, fake([5000]), f2([5000])) === null && D.leftOf('dlaplap', { leftShows: 'ref' }, fake([]), f2([])) === null);
  const k = D.KINDS.dlaplap;
  ok('...its settings: one note about what is compared (no choice, no lane, no "left value shows") and then the look of every Delta Timer', D.optionsFor('dlaplap').map(o => o.key).join() === 'measurenote,direction,decimals,style,badgeScale,badgeOutline,badgeBold,badgeItalic,arrow,fasterColor,slowerColor,equalColor' && D.optionsFor('dlaplap')[0].label === "This lane's last lap against the lap before it." && k.label === 'Lap to Lap Delta' && k.steady === true && !k.record);
}

// ---- the other widgets ----
ok('Laptime Delta compares the last lap: against theirs (lane 1 5.100 against lane 3 5.500 = -0.400), or against the lane\'s own best lap (5.100 against 5.000 = +0.100)', v('dlaptime', 0, { targetLane: '3' }) === -400 && v('dlaptime', 0, { measure: 'self' }) === 100 && v('dlaptime', 2, { measure: 'self' }) === 700);
ok('...it has no "my latest lap against their value" (that is the same thing), and asking for it gives the first choice', v('dlaptime', 0, { measure: 'live', targetLane: '3' }) === -400);
ok('Average Lap Delta: 5.100 against lane 2\'s 6.050 = -0.950; last lap against their average the same here; last lap against its own average 5.100 = equal', v('davglap', 0, { targetLane: '2' }) === -950 && v('davglap', 0, { measure: 'live', targetLane: '2' }) === -950 && v('davglap', 0, { measure: 'self' }) === 0 && v('davglap', 2, { measure: 'self' }) === 350);
ok('Median Lap Delta: 5.100 against lane 3\'s 5.150 = -0.050; last lap 6.100 against its own median 6.050 = +0.050', v('dmedlap', 0, { targetLane: '3' }) === -50 && v('dmedlap', 1, { measure: 'self' }) === 50);
ok('Best Lap Delta: 5.000 against lane 3\'s 4.800 = +0.200; last lap 5.100 against their best 4.800 = +0.300; last lap against its own best +0.100', v('dbestlap', 0, { targetLane: '3' }) === 200 && v('dbestlap', 0, { measure: 'live', targetLane: '3' }) === 300 && v('dbestlap', 0, { measure: 'self' }) === 100 && v('dbestlap', 1, { compare: 'fastest' }) === 1200);
ok('Pitstop Time Delta: 8.200 against lane 1\'s 7.000 = +1.200; against the fastest pit stop (lane 1) the same; lane 3 has not stopped; the lane that is the fastest stop has nothing to be compared with', v('dpitstop', 1, { targetLane: '1' }) === 1200 && v('dpitstop', 1, { compare: 'fastest' }) === 1200 && dm('dpitstop', 2, { targetLane: '1' }).why === 'mine' && dm('dpitstop', 0, { compare: 'fastest' }).why === 'self' && v('dpitstop', 0, { targetLane: '2' }) === -1200);
ok('Pitstop Time Delta has one choice of what is compared (any other value is the same), and no records to compare with', v('dpitstop', 1, { measure: 'self', targetLane: '1' }) === 1200 && v('dpitstop', 1, { compare: 'track', targetLane: '1' }) === 1200);
ok('Session Record Delta: the lane\'s best lap against the session record (4.800): lane 1 +0.200, lane 3 holds it (0); last lap against the record: lane 1 +0.300', v('dsessionrecord', 0, {}) === 200 && v('dsessionrecord', 2, {}) === 0 && v('dsessionrecord', 0, { measure: 'live' }) === 300);
ok('Track Record Delta: the lane\'s personal best against the track record (4.500): lane 1 +0.400; last lap against the record +0.600', v('dtrackrecord', 0, {}) === 400 && v('dtrackrecord', 0, { measure: 'live' }) === 600 && v('dtrackrecord', 1, { measure: 'self' }) === 1400);
ok('the record widgets are always compared with their record: a lane or a leader in their settings changes nothing', v('dsessionrecord', 0, { compare: 'leader', targetLane: '3' }) === 200 && v('dtrackrecord', 0, { compare: 'fastest' }) === 400);

// ---- when there is nothing to show ----
{
  const blank = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); blank.start(0);
  const SB = S0({ eng: blank, carByLane: l => blank.cars.find(c => c.lane === l) || null, standings: () => blank.standings(), personalBest: () => Infinity, sessionRecord: () => null, trackRecord: () => null });
  const w = (type, lane, opt) => D.compute(type, opt, blank.cars[lane], SB, 1000);
  ok('a lane without a lap has no number: "mine"', ['dlaptime', 'davglap', 'dmedlap', 'dbestlap', 'drecordlap', 'dsessionrecord', 'dtrackrecord'].every(t => w(t, 0, {}).ms === null && w(t, 0, {}).why === 'mine'));
  ok('...and a lap against a record that does not exist yet has nothing to compare with: "ref"', (() => { blank.cross(0, 5000); return w('dsessionrecord', 0, {}).why === 'ref' && w('dtrackrecord', 0, { measure: 'live' }).why === 'ref' && w('dbestlap', 0, { compare: 'track' }).why === 'ref' && w('dbestlap', 0, { compare: 'session' }).why === 'ref'; })());
  ok('another lane without a number to compare with is "ref" too', w('dbestlap', 0, { targetLane: '2' }).why === 'ref' && w('dbestlap', 0, { compare: 'leader' }).why === 'self');
}
ok('a chosen lane without a car: "nolane"', dm('drecordlap', 1, { targetLane: '6' }).why === 'nolane' && dm('drecordlap', 1, { targetLane: '8' }).ms === null);
ok('a lane compared with itself: "self"', dm('drecordlap', 1, { targetLane: '2' }).why === 'self' && dm('drecordlap', 1, { targetLane: '2' }).ms === null);
ok('a lane with no car at all gives nothing', D.compute('drecordlap', {}, null, S, 0).ms === null);
ok('each reason has its own words for the badge', Object.keys(D.WHY).sort().join() === 'before,mine,nolane,ref,self' && Object.values(D.WHY).every(t => /\.$/.test(t)));

// ---- the badge ----
{
  const b = (ms, opt, who) => D.badge({ ms, who: who || 'lane 2 (Sam)' }, opt);
  ok('faster: a green badge, an arrow pointing up, a minus sign, black text', b(-45).includes('class="dlt-badge dlt-fast"') && b(-45).includes('background:#2ee57f;color:#000') && b(-45).includes('▲') && b(-45).includes('−0.045') && !b(-45).includes('▼'));
  ok('slower: a red badge, an arrow pointing down, a plus sign, white text', b(321).includes('class="dlt-badge dlt-slow"') && b(321).includes('background:#d62828;color:#fff') && b(321).includes('▼') && b(321).includes('+0.321') && !b(321).includes('▲'));
  ok('equal: a grey badge, no arrow, no sign', b(0).includes('dlt-equal') && b(0).includes('background:#6b7380') && !b(0).includes('▲') && !b(0).includes('▼') && />0\.000<\/span>$/.test(b(0)));
  ok('the arrow can be switched off, the colours and the decimals can be chosen', !b(-45, { arrow: 'none' }).includes('▲') && b(-45, { arrow: 'none' }).includes('−0.045') && b(-45, { fasterColor: '#112233' }).includes('background:#112233;color:#fff') && b(321, { decimals: 1 }).includes('+0.3<') && b(-5, { decimals: 2 }).includes('−0.01'));
  { const o = (ms, opt) => b(ms, { style: 'outlined', ...opt });
    ok('the arrow can also point the other way round (down for faster), and a widget from 0.91.0 (true / false) still works', b(-45, { arrow: 'down' }).includes('▼') && !b(-45, { arrow: 'down' }).includes('▲') && b(321, { arrow: 'down' }).includes('▲') && b(-45, { arrow: false }).includes('−0.045') && !/[▲▼]/.test(b(-45, { arrow: false })) && b(-45, { arrow: true }).includes('▲') && b(-45, { arrow: 'sideways' }).includes('▲')
      && D.arrowOf({ arrow: 'none' }) === 'none' && D.arrowOf(undefined) === 'up' && D.arrowOf({ arrow: 'down' }) === 'down');
    ok('outlined: only the outline and the text have the colour (faster green, slower red, equal grey), the inside is empty, and the class says so', o(-45).includes('class="dlt-badge dlt-fast dlt-outlined"') && o(-45).includes('background:transparent;color:#2ee57f;border-color:#2ee57f') && o(321).includes('background:transparent;color:#d62828;border-color:#d62828') && o(0).includes('background:transparent;color:#6b7380;border-color:#6b7380') && o(-45).includes('▲</span>−0.045'));
    ok('...it uses the colours of the widget, and nothing but a plain colour gets into the page', o(-45, { fasterColor: '#112233' }).includes('color:#112233;border-color:#112233') && o(321, { slowerColor: 'red;x' }).includes('color:#d62828;border-color:#d62828') && !o(321, { slowerColor: 'red;x' }).includes('red;x'));
    ok('...the look is filled unless it says "outlined" (anything else is filled), and the dash for "nothing to show" is the same in both', !b(-45).includes('outlined') && !b(-45, { style: 'filled' }).includes('outlined') && !b(-45, { style: 'neon' }).includes('outlined') && o(-45).includes('dlt-outlined') && D.styleOf({ style: 'outlined' }) === 'outlined' && D.styleOf({}) === 'filled'
      && D.badge({ ms: null, why: 'mine' }, { style: 'outlined' }) === D.badge({ ms: null, why: 'mine' }, {})); }
  ok('a colour that is not a plain colour is not put into the page', !b(-45, { fasterColor: 'red;background:url(x)' }).includes('url') && b(-45, { fasterColor: 'red;background:url(x)' }).includes('background:#2ee57f'));
  { // the size, the line and the text of the badge (1.1.0)
    const style = h => (h.match(/dlt-badge[^"]*" style="([^"]*)"/) || [])[1];
    ok('a badge with none of the new settings looks exactly as before (only the colours in its style)', style(b(-45)) === 'background:#2ee57f;color:#000' && style(b(321, { style: 'outlined' })) === 'background:transparent;color:#d62828;border-color:#d62828' && style(b(-45, { badgeScale: 100, badgeBold: true, badgeItalic: false })) === 'background:#2ee57f;color:#000');
    ok('size: the whole badge is a share of the standard (30% to 200%), its height follows, and a wrong figure is the standard', style(b(-45, { badgeScale: 50 })).includes('font-size:calc(.95em*0.5)') && style(b(-45, { badgeScale: 50 })).includes('height:min(100%,calc((100% - .32em)*0.5))') && style(b(-45, { badgeScale: 50 })).includes('align-self:center') && style(b(-45, { badgeScale: 150 })).includes('*1.5)')
      && style(b(-45, { badgeScale: 5 })).includes('*0.3)') && style(b(-45, { badgeScale: 900 })).includes('*2)') && style(b(-45, { badgeScale: 'abc' })) === style(b(-45)) && D.scaleOf({ badgeScale: '' }) === 100 && D.scaleOf({ badgeScale: 70.4 }) === 70);
    ok('...the dash for "nothing to show" is scaled and styled too', D.badge({ ms: null, why: 'mine' }, { badgeScale: 60, badgeItalic: true }).includes('dlt-none" title') && D.badge({ ms: null, why: 'mine' }, { badgeScale: 60, badgeItalic: true }).includes('font-size:calc(.95em*0.6)') && D.badge({ ms: null, why: 'mine' }, { badgeItalic: true }).includes('font-style:italic'));
    ok('bold is the standard and can be switched off; italic is off and can be switched on', !b(-45).includes('font-weight') && style(b(-45, { badgeBold: false })).includes('font-weight:400') && style(b(-45, { badgeItalic: true })).includes('font-style:italic') && !style(b(-45, { badgeItalic: false })).includes('italic') && D.boldOf({}) === true && D.boldOf({ badgeBold: false }) === false && D.italicOf({}) === false);
    ok('outline, outlined look: the line of the style sheet unless a thickness is chosen; then that thickness in the colour of the badge (0 is no line at all)', !style(b(-45, { style: 'outlined' })).includes('border:') && style(b(-45, { style: 'outlined', badgeOutline: 30 })).includes('border:0.3em solid #2ee57f') && style(b(321, { style: 'outlined', badgeOutline: 30 })).includes('border:0.3em solid #d62828') && style(b(-45, { style: 'outlined', badgeOutline: 0 })).includes('border:0') && !style(b(-45, { style: 'outlined', badgeOutline: 0 })).includes('solid'));
    ok('outline, filled look: no line as standard; a chosen thickness is drawn in the colour of the text (black on green, white on red), without the shadow', !style(b(-45)).includes('border') && style(b(-45, { badgeOutline: 20 })).includes('border:0.2em solid #000') && style(b(321, { badgeOutline: 20 })).includes('border:0.2em solid #fff') && style(b(-45, { badgeOutline: 20 })).includes('box-shadow:none') && !style(b(-45, { badgeOutline: 0 })).includes('border'));
    ok('...the thickness stays between 0 and 40, a wrong figure is the standard of the look', style(b(-45, { badgeOutline: 99 })).includes('border:0.4em') && !style(b(-45, { badgeOutline: -5 })).includes('border') && D.outlineOf({ badgeOutline: 'x' }) === 0 && D.outlineOf({ badgeOutline: -5 }) === 0 && D.outlineOf({ badgeOutline: 99 }) === 40 && D.outlineOf({ style: 'outlined', badgeOutline: 'x' }) === 14 && D.outlineOf({ style: 'outlined' }) === 14);
    ok('the editor shows the new settings (size, outline, bold, italic) and the outline starts at the standard of the chosen look', (() => { const o = D.optionsFor('dbestlap'), line = o.find(x => x.key === 'badgeOutline');
      return ['badgeScale', 'badgeOutline', 'badgeBold', 'badgeItalic'].every(k => o.some(x => x.key === k)) && line.defaultOf({}) === 0 && line.defaultOf({ style: 'outlined' }) === 14 && o.find(x => x.key === 'style').rerender === true && o.find(x => x.key === 'badgeScale').default === 100; })());
  }
  ok('the tooltip says it in words, with the name of the other lane, and escapes what it is given', b(-45).includes('title="0.045 s faster than lane 2 (Sam)"') && b(321).includes('title="0.321 s slower than lane 2 (Sam)"') && b(0).includes('title="The same as lane 2 (Sam)"') && b(-45, {}, 'lane 2 (<b>"Sam"</b>)').includes('&lt;b&gt;&quot;Sam&quot;&lt;/b&gt;') && !b(-45, {}, '<b>').includes('<b>'));
  ok('no number: a dim badge with a dash, and the reason as its tooltip', D.badge({ ms: null, why: 'mine' }).includes('dlt-none') && D.badge({ ms: null, why: 'mine' }).includes('>–<') && D.badge({ ms: null, why: 'self' }).includes(D.WHY.self) && D.badge(null).includes('dlt-none') && D.badge({ ms: null, why: 'nonsense' }).includes(D.WHY.ref));
  ok('the widget is the ordinary content and the badge side by side', D.wrap('4.912', { ms: -45, who: 'x' }, {}) === `<span class="dlt"><span class="dlt-val">4.912</span>${b(-45, {}, 'x')}</span>`);
  ok('the sample in the palette alternates faster and slower by lane', [0, 2].every(l => D.sample('4.9', l, {}).includes('dlt-fast')) && [1, 3].every(l => D.sample('4.9', l, {}).includes('dlt-slow')) && D.sample('4.9', 4, {}).includes('dlt-equal') && D.sample('4.9', 8, {}).includes('dlt-fast') && D.sample('4.9', 11, {}).includes('dlt-slow'));
}

// ---- on the live timing page ----
{
  const C = (type, lane, opt, over, w = {}) => T.content({ type, lane, opt, ...w }, S0(over));
  const ordinary = { dlaptime: 'laptime', davglap: 'avglap', dmedlap: 'medlap', dbestlap: 'bestlap', drecordlap: 'recordlap', dpitstop: 'pitstop', dsessionrecord: 'sessionrecord', dtrackrecord: 'trackrecord' };
  ok('every Delta Timer shows what the ordinary widget shows, on the left', Object.keys(ordinary).every(t => [0, 1].every(l => C(t, l, {}).html.startsWith(`<span class="dlt"><span class="dlt-val">${T.content({ type: ordinary[t], lane: l, opt: {} }, S0()).html}</span>`))));
  const p = C('drecordlap', 1, { measure: 'static', targetLane: '1' });
  ok('Personal Best Delta on lane 2: its personal best 5.900 and a red badge +1.000', p.html.includes('>5.900</span>') && p.html.includes('+1.000') && p.html.includes('dlt-slow') && p.html.includes('▼'));
  const g = C('drecordlap', 2, { targetLane: '1' });
  ok('...on lane 3: 4.700 and a green badge −0.200', g.html.includes('>4.700</span>') && g.html.includes('−0.200') && g.html.includes('dlt-fast') && g.html.includes('▲'));
  ok('...with nothing chosen it is compared with the next lane', C('drecordlap', 0, {}).html.includes('−1.000') && C('drecordlap', 2, {}).html.includes('−0.200'));
  ok('the widget\'s own settings are used: the colours, the decimals, the arrow', (h => h.includes('background:#ff00ff') && h.includes('+1.0<') && !h.includes('▼'))(C('drecordlap', 1, { targetLane: '1', slowerColor: '#ff00ff', decimals: '1', arrow: 'none' }).html));
  ok('a lane without a car shows nothing at all', C('drecordlap', 5, {}).html === '' && C('dlaptime', 6, {}).html === '');
  ok('a lane without a number yet shows a dash on the left and a dim dash in the badge', (h => h.includes('<span class="dlt-val">–</span>') && h.includes('dlt-none'))(C('drecordlap', 1, { targetLane: '1' }, { personalBest: () => Infinity }).html));
  ok('Session Record Delta shows the record and who set it on the left; its Show who set it setting works', C('dsessionrecord', 0, {}).html.includes('4.800<small class="rn">Kim</small>') && !C('dsessionrecord', 0, { showName: false }).html.includes('Kim') && C('dtrackrecord', 0, {}).html.includes('4.500<small class="rn">Old</small>'));
  ok('Laptime Delta keeps the colour of a lap that has just been set: the personal best or record colour of the whole widget', (o => o.bg === '#a45cff' && o.html.includes('dlt-badge'))(T.content({ type: 'dlaptime', lane: 0, opt: { targetLane: '3' } }, S0({ flashOf: c => (c === car(0) ? { at: 15900, time: 5100, kind: 'pb' } : null) }))));
  { // Lap to Lap Delta: the last lap stays on the left for the whole lap (the Laptime widget runs a clock), the badge says how far it is from the lap before it
    const l0 = C('dlaplap', 0, {}).html, l1 = C('dlaplap', 1, {}).html, l2 = C('dlaplap', 2, {}).html;
    ok('Lap to Lap Delta shows the last lap on the left and a badge against the lap before: lane 1 5.100 with a green −0.100, lane 2 6.100 with a red +0.100, lane 3 5.500 with a red +0.700', l0.includes('<span class="dlt-val">5.100</span>') && l0.includes('−0.100') && l0.includes('dlt-fast') && l0.includes('▲') && l1.includes('<span class="dlt-val">6.100</span>') && l1.includes('+0.100') && l1.includes('dlt-slow') && l1.includes('▼') && l2.includes('<span class="dlt-val">5.500</span>') && l2.includes('+0.700'));
    ok('...the left side is not the running clock of the lap that is being driven (the Laptime Delta shows that one)', !l0.includes('0.700<') && C('dlaptime', 0, { targetLane: '3' }).html.includes('<span class="dlt-val">0.700</span>') && C('dlaplap', 0, {}, { now: 19000 }).html.includes('<span class="dlt-val">5.100</span>'));
    ok('...the badge says it in words: "0.100 s faster than the lap before it"', l0.includes('title="0.100 s faster than the lap before it"') && l1.includes('title="0.100 s slower than the lap before it"'));
    ok('...the settings of the badge work as on every Delta Timer (colours, decimals, arrow, top and bottom)', (h => h.includes('background:#ff00ff') && h.includes('+0.7<') && !h.includes('▼') && h.includes('dlt dlt-col'))(C('dlaplap', 2, { slowerColor: '#ff00ff', decimals: '1', arrow: 'none', direction: 'column' }).html));
    const hot = (kind, at, o) => T.content({ type: 'dlaplap', lane: 0, opt: o || {} }, S0({ flashOf: c => (c === car(0) ? { at, time: 5100, kind } : null) }));
    ok('...a lap that has just been set takes the personal best colour (or the record colour) for a few seconds, then the plain widget again', hot('pb', 15900).bg === '#a45cff' && hot('pb', 15900).color === '#fff' && hot('record', 15900).bg === '#ffc400' && hot('record', 15900).color === '#000' && hot('pb', 15900, { pbColor: '#112233' }).bg === '#112233' && hot('pb', 12000).bg === undefined && hot('pb', 12900).bg === undefined && hot('pb', 13100).bg === '#a45cff' && hot('pb', 11100, { holdSeconds: 4 }).bg === undefined && hot('pb', 11100, { holdSeconds: 5 }).bg === '#a45cff' && hot('pb', 15900, { holdSeconds: 0 }).bg === undefined && hot('', 15900).bg === undefined && hot('pb', 15900).html.includes('5.100') && hot('pb', 12000).html.includes('5.100'));
    ok('...a lane without a car shows nothing, as every lane widget does', C('dlaplap', 6, {}).html === '');
    const e3 = createRace({ type: 'race', laps: 5, endRule: 'all', entries: people }); e3.start(0);
    const L = (over, lane = 0) => T.content({ type: 'dlaplap', lane, opt: {} }, S0({ eng: Object.assign(Object.create(e3), { pitTime: () => null }), carByLane: l => e3.cars.find(c => c.lane === l) || null, ...over }));
    const h0 = L().html; e3.cross(0, 5000); const h1 = L().html; e3.cross(0, 10200); const h2 = L().html; e3.cross(0, 15150); const h3 = L().html;
    e3.cars[1].laps.push(NaN); const hn = L({}, 1).html; e3.cars[1].laps.length = 0;
    ok('...a lap that is not a number is no lap: a dash on the left, not NaN', hn.includes('<span class="dlt-val">–</span>') && !hn.includes('NaN'));
    ok('...as the race goes: no lap is a dash with a dim dash; one lap shows it with a dim dash (needs two laps); two laps compare the second with the first (5.200 is 0.200 slower); a third lap (4.950) is compared with the second', h0.includes('<span class="dlt-val">–</span>') && h0.includes('dlt-none') && h1.includes('<span class="dlt-val">5.000</span>') && h1.includes('dlt-none') && h1.includes('Needs two laps') && h2.includes('<span class="dlt-val">5.200</span>') && h2.includes('+0.200') && h2.includes('dlt-slow') && h3.includes('<span class="dlt-val">4.950</span>') && h3.includes('−0.250') && h3.includes('dlt-fast'));
  }
  ok('Pitstop Time Delta shows the pit time and its badge', (h => h.includes('>8.200</span>') && h.includes('+1.200'))(C('dpitstop', 1, { targetLane: '1' }).html));
  ok('the badge says who it is compared with, with a name that cannot break the page', (n => { const old = car(0).driverName; car(0).driverName = 'A<b>"x"'; const h = C('drecordlap', 1, { targetLane: '1' }).html; car(0).driverName = old; return h.includes('lane 1 (A&lt;b&gt;&quot;x&quot;)') && !h.includes('<b>'); })());
  ok('in a Time Token Session a lane whose time is up turns the whole widget the "time is up" colour, as every lane widget does', (o => o.bg === '#ff0000')(T.content({ type: 'drecordlap', lane: 1, opt: {} }, S0({ tokens: { stateOf: l => (l === 1 ? 'out' : 'running'), outColor: '#ff0000' } }))));
  ok('a Delta Timer is also shown in a row of the Leaderboard (a row design gives every row the lane of its car)', (() => { const Rows = require('../renderer/rows.js'); return typeof Rows.html === 'function' && Wd.def('drecordlap').perLane === true; })());
}

// ---- the left side can show the value it is compared with (0.99.0) ----
{
  const C = (type, lane, opt, over, w = {}) => T.content({ type, lane, opt, ...w }, S0(over));
  const left = (type, lane, opt, over) => D.leftOf(type, opt, car(lane), D.compute(type, opt, car(lane), over || S, 16000));
  ok('the left side shows this lane\'s own value unless "the value it is compared with" is chosen (a damaged value counts as own)', D.leftShowsOf({}) === 'own' && D.leftShowsOf(undefined) === 'own' && D.leftShowsOf({ leftShows: 'bogus' }) === 'own' && D.leftShowsOf({ leftShows: 'ref' }) === 'ref' && left('dbestlap', 1, { targetLane: '1' }) === null && left('dbestlap', 1, { targetLane: '1', leftShows: 'own' }) === null);
  // lane 2 (index 1): best lap 6.000. lane 1 best 5.000, lane 3 best 4.800.
  const a = C('dbestlap', 1, { targetLane: '1', leftShows: 'ref' }).html;
  ok('Best Lap Delta on lane 2, left shows lane 1: lane 1\'s 5.000 on the left, and the badge is still lane 2 against lane 1: red +1.000', a.includes('>5.000</span>') && !a.includes('6.000') && a.includes('+1.000') && a.includes('dlt-slow') && a.includes('▼'));
  ok('...the badge is exactly the same as with the own value on the left', (h => h.slice(h.indexOf('<span class="dlt-badge')))(a) === (h => h.slice(h.indexOf('<span class="dlt-badge')))(C('dbestlap', 1, { targetLane: '1' }).html));
  ok('...a tooltip on the left value says whose it is: "Shows lane 1 (Alex)"', a.includes('<span class="dlt-val" title="Shows lane 1 (Alex)">'));
  ok('...and with the own value on the left there is no such tooltip (nothing changed for the widgets you have)', !C('dbestlap', 1, { targetLane: '1' }).html.includes('title="Shows'));
  ok('with no lane chosen it shows the next lane (lane 3 on lane 2): 4.800', C('dbestlap', 1, { leftShows: 'ref' }).html.includes('>4.800</span>'));
  ok('compared with the leader (lane 1): the left shows the leader\'s average lap 5.100; compared with the fastest the fastest\'s', C('davglap', 1, { compare: 'leader', leftShows: 'ref' }).html.includes('>5.100</span>') && C('davglap', 1, { compare: 'fastest', leftShows: 'ref' }).html.includes('>5.100</span>') && C('dbestlap', 0, { compare: 'fastest', leftShows: 'ref' }).html.includes('>4.800</span>'));
  ok('the leader itself (compared with the leader) has nothing but itself, so its own value stays on the left, with a dash in the badge', (h => h.includes('>5.000</span>') && h.includes('dlt-none') && !h.includes('title="Shows'))(C('dbestlap', 0, { compare: 'leader', leftShows: 'ref' }).html));
  ok('compared with the track or session record the left shows that record (without the name), 4.500 or 4.800', (h => h.includes('>4.500</span>') && !h.includes('Old') && h.includes('title="Shows the track record"'))(C('dbestlap', 1, { compare: 'track', leftShows: 'ref' }).html) && C('dbestlap', 1, { compare: 'session', leftShows: 'ref' }).html.includes('>4.800</span>'));
  ok('"last lap against its own best lap" shows that best lap on the left: Laptime Delta on lane 2 shows 6.000 (its best), the badge is the last lap 6.100 against it: +0.100', (h => h.includes('>6.000</span>') && h.includes('+0.100') && h.includes('title="Shows its own best lap"'))(C('dlaptime', 1, { measure: 'self', leftShows: 'ref' }).html));
  ok('"last lap against their average": the left shows their average (lane 1: 5.100), the badge the lane\'s last lap (6.100) against it: +1.000', (h => h.includes('>5.100</span>') && h.includes('+1.000'))(C('davglap', 1, { measure: 'live', targetLane: '1', leftShows: 'ref' }).html));
  ok('the pit stop delta shows the other lane\'s pit stop: lane 2 (8.200) with lane 1 (7.000) on the left, +1.200', (h => h.includes('>7.000</span>') && h.includes('+1.200'))(C('dpitstop', 1, { targetLane: '1', leftShows: 'ref' }).html));
  ok('the laptime widget of the other lane is the ordinary laptime widget: it shows the other lane\'s clock, and the colours of its flash are not taken over', (o => o.bg === undefined && o.color === undefined && o.html.includes('dlt-val'))(T.content({ type: 'dlaptime', lane: 0, opt: { targetLane: '3', leftShows: 'ref' } }, S0({ flashOf: c => (c.lane === 2 ? { kind: 'record', time: 4800, at: 15900 } : null) }))));
  ok('...while with the own value on the left a flash of this lane still colours the whole widget', (o => o.bg === '#ffc400')(T.content({ type: 'dlaptime', lane: 2, opt: { targetLane: '1' } }, S0({ flashOf: c => (c.lane === 2 ? { kind: 'record', time: 4800, at: 15900 } : null) }))));
  ok('a lane without a time yet still shows the other value on the left (lane 2 without a personal best next to lane 1\'s 4.900), with a dim dash in the badge', (h => h.includes('>4.900</span>') && h.includes('dlt-none'))(C('drecordlap', 1, { targetLane: '1', leftShows: 'ref' }, { personalBest: id => (id === 'd0' ? 4900 : Infinity) }).html));
  ok('nothing to show on the left yet (the other lane has no number): a dash, and the badge too', (h => h.includes('<span class="dlt-val">–</span>') && h.includes('dlt-none'))(C('drecordlap', 1, { targetLane: '1', leftShows: 'ref' }, { personalBest: id => (id === 'd1' ? 5900 : Infinity) }).html));
  ok('a lane the chosen lane does not exist for shows a dash as well (no car in lane 6)', (h => h.includes('<span class="dlt-val">–</span>'))(C('drecordlap', 1, { targetLane: '6', leftShows: 'ref' }).html));
  ok('the record Delta Timers do not have the setting (they show the record on the left already) and it changes nothing there', left('dsessionrecord', 0, { leftShows: 'ref' }) === null && C('dsessionrecord', 0, { leftShows: 'ref' }).html === C('dsessionrecord', 0, {}).html && !Wd.def('dsessionrecord').options.some(o => o.key === 'leftShows') && !Wd.def('dtrackrecord').options.some(o => o.key === 'leftShows'));
  ok('the setting is in the six other widgets, after "Which lane", with two choices and a hint for each', ['dlaptime', 'davglap', 'dmedlap', 'dbestlap', 'drecordlap', 'dpitstop'].every(t => { const o = Wd.def(t).options.find(x => x.key === 'leftShows'); return o && o.default === 'own' && o.choices.map(c => c[0]).join() === 'own,ref' && /own value/.test(o.choices[0][1]) && /compared with/.test(o.choices[1][1]) && o.hintOf('ref') !== o.hintOf('own') && Wd.def(t).options.findIndex(x => x.key === 'leftShows') === Wd.def(t).options.findIndex(x => x.key === 'targetLane') + 1; }));
  ok('in the palette and the editor the sample shows another lane\'s value on the left when it is chosen', Wd.sampleOf(Wd.def('dbestlap'), 0, { opt: { leftShows: 'ref' } }) !== Wd.sampleOf(Wd.def('dbestlap'), 0, { opt: {} }) && Wd.sampleOf(Wd.def('dbestlap'), 0, { opt: { leftShows: 'ref' } }).includes('dlt-badge') && Wd.sampleOf(Wd.def('dsessionrecord'), 0, { opt: { leftShows: 'ref' } }) === Wd.sampleOf(Wd.def('dsessionrecord'), 0, { opt: {} }));
  ok('a damaged value is never put into the page: the tooltip is made safe', (n => { const old = car(0).driverName; car(0).driverName = 'A<b>"x"'; const h = C('dbestlap', 1, { targetLane: '1', leftShows: 'ref' }).html; car(0).driverName = old; return h.includes('title="Shows lane 1 (A&lt;b&gt;&quot;x&quot;)"') && !h.includes('<b>'); })());
  ok('wrap keeps its three-argument form (nothing is added without the fourth)', D.wrap('4.9', { ms: -45, who: 'x' }, {}) === D.wrap('4.9', { ms: -45, who: 'x' }, {}, '') && !D.wrap('4.9', { ms: 1, who: 'x' }, {}).includes('title="Shows') && D.wrap('4.9', { ms: 1, who: 'x' }, {}, 'lane 2').includes('title="Shows lane 2"'));
}

// ---- in the widget list and the layout editor ----
{
  const dl = Wd.REGISTRY.filter(d => d.group === 'Delta Timers');
  ok('70 widgets in the register: the 40 before, the 9 Delta Timers (Lap to Lap Delta came with 1.29.0), the Race Laps widget (1.2.0), Balance of Power (1.3.0), Tyres, Weather Forecast and Track Conditions (1.5.0), the Heat List (1.7.0) Team Name and Team Picture (1.8.0), Current Driver, Next Driver and Swap Timer (1.9.0), and Damage and Repair Timer (1.10.0), and Distance Driven, Distance To Go and Laps To Go (1.35.0), and the Swap Signal (1.35.1), and Tyre Degradation (1.40.0), and Available Tyres (1.41.0), and the Car Failure widget (1.43.0), and the Pace meter (1.54.0)', Wd.REGISTRY.length === 70 && dl.length === 9 && new Set(Wd.REGISTRY.map(d => d.type)).size === 70 && Wd.REGISTRY.some(d => d.type === 'racelaps'));
  ok('the Delta Timers folder holds the seven per-lane times and the two records, in this order (Lap to Lap Delta right after Lap Time Delta)', dl.map(d => d.label).join() === 'Lap Time Delta,Lap to Lap Delta,Average Lap Delta,Median Lap Delta,Best Lap Delta,Personal Best Delta,Pitstop Time Delta,Session Record Delta,Track Record Delta');
  ok('the last laps widget has no Delta version (it is a list of times)', !Wd.REGISTRY.some(d => d.type === 'dlastlap') && !Object.keys(D.KINDS).includes('dlastlap'));
  ok('every Delta Timer is a lane widget, wide enough for the time and the badge, with a sample and its own title', dl.every(d => d.perLane && d.w >= 280 && d.h === 60 && String(Wd.sampleOf(d, 0, { opt: {} })).includes('dlt-badge') && /delta$/i.test(d.title)));
  ok('Wd.titleOf gives the title of a Delta Timer', Wd.titleOf({ type: 'drecordlap', title: '' }) === 'Personal best delta' && Wd.titleOf({ type: 'dtrackrecord', title: 'My gap' }) === 'My gap');
  const keys = t => Wd.def(t).options.map(o => o.key).join();
  ok('the settings: what is compared, compare with, which lane, what the left side shows, left and right or top and bottom, decimals, look, arrow, three colours', keys('drecordlap') === 'measure,compare,targetLane,leftShows,direction,decimals,style,badgeScale,badgeOutline,badgeBold,badgeItalic,arrow,fasterColor,slowerColor,equalColor' && keys('dbestlap') === keys('drecordlap') && keys('davglap') === keys('drecordlap'));
  ok('...Laptime Delta also has the settings of the Laptime widget; the records also "Show who set it"; the pit stop one has a note instead of a choice', keys('dlaptime').endsWith(',holdSeconds,pbColor,recordColor') && keys('dsessionrecord') === 'measure,direction,decimals,style,badgeScale,badgeOutline,badgeBold,badgeItalic,arrow,fasterColor,slowerColor,equalColor,showName' && keys('dtrackrecord') === keys('dsessionrecord') && keys('dpitstop').startsWith('measurenote,compare,targetLane'));
  const o = (t, k) => Wd.def(t).options.find(x => x.key === k);
  ok('what is compared has the choices of that widget, in words', o('drecordlap', 'measure').choices.map(c => c[0]).join() === 'static,live,self' && o('dlaptime', 'measure').choices.map(c => c[0]).join() === 'static,self' && o('dsessionrecord', 'measure').choices.map(c => c[0]).join() === 'static,live' && o('drecordlap', 'measure').choices[1][1] === "This lane's last lap against their personal best");
  ok('compare with: lane, leader, fastest, track record, session record; for the pit stop only the first three', o('drecordlap', 'compare').choices.map(c => c[0]).join() === 'lane,leader,fastest,track,session' && o('dpitstop', 'compare').choices.map(c => c[0]).join() === 'lane,leader,fastest' && o('dpitstop', 'compare').choices[2][1] === 'The fastest pit stop');
  ok('which lane: nothing chosen (the next lane) and lane 1 to 8', o('drecordlap', 'targetLane').choices.length === 9 && o('drecordlap', 'targetLane').choices[0][0] === '' && o('drecordlap', 'targetLane').choices[8][0] === '8');
  ok('compare with and which lane are only offered when they matter: not for "its own", and the lane only for "a chosen lane"', o('drecordlap', 'compare').show({}) === true && o('drecordlap', 'compare').show({ measure: 'live' }) === true && o('drecordlap', 'compare').show({ measure: 'self' }) === false && o('drecordlap', 'targetLane').show({}) === true && o('drecordlap', 'targetLane').show({ compare: 'leader' }) === false && o('drecordlap', 'targetLane').show({ measure: 'self' }) === false && o('drecordlap', 'targetLane').show({ compare: 'bogus' }) === true && o('dlaptime', 'compare').show({ measure: 'self' }) === false);
  ok('changing what is compared or the comparison redraws the settings', o('drecordlap', 'measure').rerender === true && o('drecordlap', 'compare').rerender === true && !o('drecordlap', 'targetLane').rerender);
  ok('all the choices of every widget are in words and none is empty', dl.every(d => d.options.every(x => x.type !== 'select' || x.choices.every(c => typeof c[1] === 'string' && c[1].length > 3))));
}

// ---- the average and the median leave out the laps that do not count (the same as the ordinary widgets) ----
{ const bad = { laps: [5000, 5000, 10000], invalid: [2] }, flagged = { laps: [4000, 5000, 90000], bad: [false, false, true] };
  ok('the average lap of a lane leaves out an invalid lap, the median a lap flagged as bad', D.STAT.avglap(bad) === 5000 && D.STAT.avglap(flagged) === 4500 && D.STAT.medlap(flagged) === 4500 && D.STAT.medlap({ laps: [1000, 2000, 9000, 9000] }) === 5500);
  ok('...and a lane without a good lap has no number', D.STAT.avglap({ laps: [5000], invalid: [0] }) === null && D.STAT.medlap({ laps: [] }) === null && D.STAT.bestlap({ best: null }) === null && D.STAT.laptime({ laps: [] }) === null);
  const o = (t, k) => Wd.def(t).options.find(x => x.key === k);
  ok('the settings start as the text says: next lane (no lane chosen), 3 decimals, a filled badge, arrow up for faster, green / red / grey', o('drecordlap', 'targetLane').default === '' && o('drecordlap', 'decimals').default === '3' && o('drecordlap', 'arrow').default === 'up' && o('drecordlap', 'style').default === 'filled'
    && o('drecordlap', 'fasterColor').default === '#2ee57f' && o('drecordlap', 'slowerColor').default === '#d62828' && o('drecordlap', 'equalColor').default === '#6b7380' && o('drecordlap', 'compare').default === 'lane' && o('drecordlap', 'measure').default === 'static');
  ok('every Delta Timer is a widget of one lane with its own sample (a badge in the palette and the editor)', Object.keys(D.KINDS).every(t => Wd.def(t).perLane === true && /dlt-badge/.test(Wd.sampleOf(Wd.def(t), 0, { opt: {} })) && /dlt-fast/.test(Wd.sampleOf(Wd.def(t), 0, { opt: {} })) && /dlt-slow/.test(Wd.sampleOf(Wd.def(t), 1, { opt: {} }))));
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/styles.css'), 'utf8');
  ok('the style sheet has the rules for the widget, the value, the badge, the arrow and the dash', ['.dlt{', '.dlt-val{', '.dlt-badge{', '.dlt-badge .dlt-arrow{', '.dlt-badge.dlt-none{'].every(r => css.includes(r)) && /\.dlt-badge\{[^}]*font-weight:800/.test(css) && /\.dlt-badge\{[^}]*display:inline-flex/.test(css) && /\.dlt-badge\.dlt-outlined\{[^}]*box-shadow:none[^}]*border:\.14em solid/.test(css));
}

// ---- in a Leaderboard row design (every widget of a lane can be a column; the lane is the row's car) ----
{ const Rows = require('../renderer/rows.js');
  const design = { widgets: [{ id: 'n', type: 'name', lane: 0, x: 0, y: 0, w: 300, h: 70, opt: {} }, { id: 'd', type: 'drecordlap', lane: 0, x: 300, y: 0, w: 400, h: 70, opt: {} }, { id: 'e', type: 'dbestlap', lane: 0, x: 700, y: 0, w: 300, h: 70, opt: { compare: 'leader', arrow: false } }] };
  ok('the Leaderboard Editor offers the delta widgets (they are widgets of one lane)', Wd.REGISTRY.filter(x => x.perLane && x.group === 'Delta Timers').length === 9);
  const h = Rows.html(design, S, 99, {});
  const rowsHtml = h.split('<div class="rrow ').slice(1), badges = r => [...r.matchAll(/dlt-badge dlt-(\w+)"[^>]*>((?:<span class="dlt-arrow">[^<]*<\/span>)?[^<]*)<\/span>/g)].map(m => m[1] + ':' + m[2].replace(/<[^>]+>/g, ''));
  ok('every row has its own personal best delta, in race order (lane 1, lane 3, lane 2): lane 1 (4.900) against lane 2 is green, lane 3 against lane 1 green, lane 2 against lane 3 red', rowsHtml.length === 3 && badges(rowsHtml[0])[0] === 'fast:▲−1.000' && badges(rowsHtml[1])[0] === 'fast:▲−0.200' && badges(rowsHtml[2])[0] === 'slow:▼+1.200');
  ok('...and the second delta compares with the leader: the leader has a dash, the others a difference (no arrow when it is switched off)', badges(rowsHtml[0])[1] === 'none:–' && badges(rowsHtml[1])[1] === 'fast:−0.200' && badges(rowsHtml[2])[1] === 'slow:+1.000');
}

// ---- 1.18.0: the value on top and the badge below it ----
{
  const wrapped = (opt, base = '<b>5.123</b>') => D.wrap(base, { ms: -45, who: 'lane 2' }, opt);
  ok('the standard is left and right: the value, then the badge, and no column class (a widget from before looks exactly as before)', D.layoutOf({}) === 'row' && D.layoutOf(null) === 'row' && D.layoutOf({ direction: 'row' }) === 'row' && wrapped({}).startsWith('<span class="dlt"><span class="dlt-val">') && !wrapped({}).includes('dlt-col') && wrapped(undefined) === wrapped({}));
  ok('"column" puts the class on the widget: the value stays first, the badge second, so the stylesheet can stack them', D.layoutOf({ direction: 'column' }) === 'column' && wrapped({ direction: 'column' }).startsWith('<span class="dlt dlt-col"><span class="dlt-val"><b>5.123</b></span><span class="dlt-badge dlt-fast"'));
  ok('...anything else is the standard (a damaged or imported file never gets a strange class)', ['sideways', 'COLUMN', 1, true, '', null, undefined].every(v => D.layoutOf({ direction: v }) === 'row' && !wrapped({ direction: v }).includes('dlt-col')));
  const style = h => (h.match(/dlt-badge[^"]*" style="([^"]*)"/) || [])[1];
  ok('a badge in the column has the same colours and text as in the row', style(wrapped({ direction: 'column' })) === style(wrapped({})) && wrapped({ direction: 'column' }).includes('▲') && wrapped({ direction: 'column' }).includes('−0.045'));
  ok('a scaled badge is a share of the WIDTH of the widget in the column and a share of its HEIGHT in the row; the text scales the same in both', style(wrapped({ direction: 'column', badgeScale: 50 })).includes('width:min(100%,calc((100% - .32em)*0.5))') && !style(wrapped({ direction: 'column', badgeScale: 50 })).includes('height:')
    && style(wrapped({ badgeScale: 50 })).includes('height:min(100%,calc((100% - .32em)*0.5))') && !style(wrapped({ badgeScale: 50 })).includes('width:') && style(wrapped({ direction: 'column', badgeScale: 50 })).includes('font-size:calc(.95em*0.5)') && style(wrapped({ direction: 'column', badgeScale: 50 })).includes('align-self:center'));
  ok('...a badge of 100% in the column has no size in its style (the stylesheet makes it as wide as the widget), and the dash for "nothing to show" follows the column too', !style(wrapped({ direction: 'column' })).includes('width:') && D.sizeStyle({ direction: 'column' }).length === 0 && D.sizeStyle({ direction: 'column', badgeScale: 150 }).some(x => x.startsWith('width:min(100%')) && D.wrap('–', { ms: null, why: 'mine' }, { direction: 'column', badgeScale: 60 }).includes('dlt-col') && D.wrap('–', { ms: null, why: 'mine' }, { direction: 'column', badgeScale: 60 }).includes('width:min(100%'));
  const o = D.optionsFor('dbestlap').find(x => x.key === 'direction'), rec = D.optionsFor('dtrackrecord').find(x => x.key === 'direction');
  ok('the editor offers it in every Delta Timer, also the two record ones: left and right (the standard) or top and bottom, with a hint that follows the choice', !!o && !!rec && o.type === 'select' && o.default === 'row' && o.choices.map(c => c[0]).join() === 'row,column' && /^Left and right/.test(o.choices[0][1]) && /^Top and bottom/.test(o.choices[1][1]) && o.rerender === true && /room/.test(o.hintOf('column')) && /beside/.test(o.hintOf('row')) && o.hintOf('column') !== o.hintOf('row'));
  ok('...every Delta Timer of the widget list has it, and it comes before the look settings', Object.keys(D.KINDS).every(t => { const k = Wd.def(t).options.map(x => x.key); return k.includes('direction') && k.indexOf('direction') < k.indexOf('decimals'); }));
  ok('the setting of the value is called left (or top), because it is on top in the column', D.optionsFor('dbestlap').find(x => x.key === 'leftShows').label === 'Left (or top) value shows');
  ok('the sample of the palette and the editor follows the choice', Wd.sampleOf(Wd.def('dbestlap'), 0, { opt: { direction: 'column' } }).includes('dlt dlt-col') && !Wd.sampleOf(Wd.def('dbestlap'), 0, { opt: {} }).includes('dlt-col'));
  { // the live timing page draws it the same way (timing.js): the widget's content with the badge below the value
    const draw = (type, lane, opt) => T.content({ type, lane, opt }, S0()).html;
    ok('...on the live timing page the column widget carries the class (also with the left side showing another lane) and the row widget does not', draw('dbestlap', 0, { direction: 'column' }).startsWith('<span class="dlt dlt-col"><span class="dlt-val">') && draw('dbestlap', 0, { direction: 'column', leftShows: 'ref' }).includes('class="dlt dlt-col"')
      && draw('dtrackrecord', 1, { direction: 'column' }).includes('class="dlt dlt-col"') && draw('dbestlap', 0, {}).startsWith('<span class="dlt"><span class="dlt-val">') && !draw('dbestlap', 0, {}).includes('dlt-col'));
    ok('...and the number in it is the same as in the row: only the arrangement changes', draw('dbestlap', 0, { direction: 'column' }).replace(' dlt-col', '') === draw('dbestlap', 0, {})); }
}

// ---- 1.18.1: the arrow and the number always fit the badge ----
{
  const fs = require('fs'), src = f => fs.readFileSync(require('path').join(__dirname, '..', 'renderer', f), 'utf8');
  const F = D.fitFactor;
  ok('a badge whose text fits is left alone (a factor of 1), also when it is a hair too wide (rounding of the page)', F({ boxW: 100, boxH: 30, w: 100, h: 30 }) === 1 && F({ boxW: 100, boxH: 30, w: 100.4, h: 30.4 }) === 1 && F({ boxW: 200, boxH: 40, w: 20, h: 10 }) === 1);
  ok('a text that is too wide shrinks to the share that fits, in hundredths, rounded down (so it never sticks out by a hair)', F({ boxW: 100, boxH: 30, w: 150, h: 20 }) === 0.66 && F({ boxW: 120, boxH: 30, w: 152, h: 20 }) === 0.78 && F({ boxW: 100, boxH: 30, w: 101, h: 20 }) === 0.99);
  ok('a text that is too tall shrinks the same way, and when both are too big the stricter one counts', F({ boxW: 200, boxH: 20, w: 100, h: 40 }) === 0.5 && F({ boxW: 100, boxH: 20, w: 150, h: 25 }) === 0.66 && F({ boxW: 100, boxH: 10, w: 150, h: 40 }) === 0.25);
  ok('...never smaller than a fifth, however small the widget', F({ boxW: 10, boxH: 30, w: 1000, h: 20 }) === 0.2 && F({ boxW: 1, boxH: 1, w: 500, h: 500 }) === 0.2);
  ok('a badge that is not on the screen (no size yet) or has nothing to measure gives 1: nothing is changed', [null, undefined, {}, { boxW: 0, boxH: 0, w: 50, h: 20 }, { boxW: 100, boxH: 30, w: 0, h: 0 }, { boxW: NaN, boxH: 30, w: 150, h: 20 }, { boxW: -5, boxH: 30, w: 150, h: 20 }].every(m => F(m) === 1));

  // a badge made of fake parts: its text is 300 px wide at the standard size (.95em) and grows and shrinks with the size; the room is what it is told
  const badge = own => { const props = {}; if (own) props['font-size'] = own; return { dataset: {}, props, style: { getPropertyValue: k => props[k] || '', setProperty(k, v, pr) { props[k] = v; props[k + '!'] = pr || ''; }, removeProperty(k) { delete props[k]; delete props[k + '!']; } } }; };
  const emOf = b => { const v = b.props['font-size'] || ''; const m = /calc\(\.95em\*([\d.]+)\)/.exec(v); return /^[\d.]+em$/.test(v) ? parseFloat(v) : m ? 0.95 * parseFloat(m[1]) : 0.95; };
  const model = (room, extra = 0, calls) => b => { if (calls) calls.n++; const em = emOf(b); return { boxW: room, boxH: 60, w: 300 * em / 0.95 + extra, h: 20 * em / 0.95, em }; };
  const rootOf = list => ({ querySelectorAll: sel => (sel === '.dlt-badge' ? list : []) });

  { const b = badge(''); D.fit(rootOf([b]), model(200));
    ok('a badge that is too narrow gets a smaller text in em of the widget, and the size is set so it wins over the one of the markup', b.props['font-size'] === '0.6270em' && b.props['font-size!'] === 'important' && 300 * emOf(b) / 0.95 <= 200.5);
    D.fit(rootOf([b]), model(400));
    ok('...when the widget gets bigger again the text gets its full size back (the size of the markup is put back, here none)', !('font-size' in b.props) && emOf(b) === 0.95);
    D.fit(rootOf([b]), model(100));
    ok('...and shrinks again when it gets smaller', 300 * emOf(b) / 0.95 <= 100.5 && emOf(b) < 0.4); }
  { const b = badge('calc(.95em*0.6)'); D.fit(rootOf([b]), model(100));
    ok('a badge with its own size (the "Size of the badge" setting) shrinks from that size, and gets it back when it fits', 300 * emOf(b) / 0.95 <= 100.5 && emOf(b) < 0.57 && (D.fit(rootOf([b]), model(500)), b.props['font-size'] === 'calc(.95em*0.6)' && b.props['font-size!'] === '')); }
  { const b = badge(''); D.fit(rootOf([b]), model(500));
    ok('a badge that fits is not touched at all', Object.keys(b.props).length === 0 && b.dataset.fit === ''); }
  { const b = badge(''), calls = { n: 0 }; D.fit(rootOf([b]), model(200, 20, calls));
    ok('when the first try is not enough (a part of the badge does not scale with the text) it is tried again, and then it fits', calls.n >= 2 && calls.n <= 4 && 300 * emOf(b) / 0.95 + 20 <= 200.5); }
  { const b = badge(''), calls = { n: 0 }; D.fit(rootOf([b]), () => { calls.n++; return { boxW: 10, boxH: 10, w: 1000, h: 1000, em: emOf(b) }; });
    ok('it always stops: at most three tries, and the text never goes to nothing', calls.n <= 3 && emOf(b) > 0 && emOf(b) <= 0.95); }
  { const b = badge(''); D.fit(rootOf([b]), b2 => ({ boxW: 100, boxH: 30, w: 300, h: 20, em: 0 }));
    ok('a badge without a known text size (not on the screen) is left as it is', !('font-size' in b.props)); }
  { const a = badge(''), c = badge(''), d2 = badge(''); D.fit(rootOf([a, c, d2]), b => (b === c ? model(500)(b) : model(150)(b)));
    ok('every badge in a canvas is fitted on its own: the one that fits stays, the others shrink', !('font-size' in c.props) && 300 * emOf(a) / 0.95 <= 150.5 && 300 * emOf(d2) / 0.95 <= 150.5); }
  ok('nothing breaks without a canvas, or with something that is no badge (a page that is not drawn yet)', (() => { try { D.fit(null); D.fit(undefined); D.fit({}); D.fit(rootOf([null, {}, { style: {} }, { style: {}, dataset: undefined }]), model(10)); return true; } catch (e) { return false; } })());

  const canvas = src('canvas.js'), editor = src('editor.js'), live = src('liveview.js'), css = src('styles.css');
  ok('the live race page fits the badges after it has drawn a widget with one, and again when the widget changes size (the window, a layout of another size)', /n\.val\.innerHTML = out\.html;[\s\S]{0,900}?out\.html\.includes\('dlt-badge'\)[^\n]*Delta\.fit\(n\.val\)/.test(canvas) && /ResizeObserver[^\n]*Delta\.isDelta\(w\.type\)[^\n]*Delta\.fit\(val\)/.test(canvas));
  ok('the layout editor fits them every time it draws the canvas, so a widget that is dragged to another size keeps its text inside the badge; the live view with row designs does too', /WxW\.fitAll\(\$\('canvas'\)\)[^\n]*\n[^\n]*Delta\.fit\(\$\('canvas'\)\)/.test(editor) && /Delta\.fit\(\$\('lv-board'\)\)/.test(live));
  ok('the fit puts the text in no wrapping and keeps the badge itself as it was: the stylesheet still says nowrap, and the markup has no new parts', /\.dlt-badge\{[^}]*white-space:nowrap/.test(css) && D.wrap('<b>1</b>', { ms: -45 }, { direction: 'column' }).includes('<span class="dlt-badge dlt-fast"') && !/dlt-fit|data-fit/.test(D.wrap('<b>1</b>', { ms: -45 }, { direction: 'column' })));
}

console.log(fails ? `\n${fails} DELTA TESTS FAILED` : '\ndelta: all PASSED');
process.exit(fails ? 1 : 0);
