const assert = require('assert/strict');
const E = require('../renderer/engine');
const T = require('../renderer/timing');
const W = require('../renderer/widgets');

let groups = 0;
const test = (name, fn) => { fn(); groups++; console.log('ok  ' + name); };

function raceState() {
  const eng = E.createRace({ type: 'race', laps: 20, minLap: 100, entries: [{ lane: 0, driverName: 'Alex' }, { lane: 1, driverName: 'Sam' }] });
  eng.start(0); eng.cross(0, 5000); eng.cross(1, 6000);
  const standings = () => eng.standings();
  return { eng, setup: { sessionType: 'race', laps: 20 }, now: 6000, phase: 'running', standings, rowOf: c => standings().find(r => r.car === c), carByLane: lane => eng.cars[lane], flashOf: () => null };
}

test('Gap to Leader keeps the familiar time gap by default', () => {
  const s = raceState(), w = { ...W.newWidget('gap', 1), opt: {} };
  assert.equal(T.content(w, s).html, '+1.000');
});
test('Gap to Leader converts the adjusted timing gap with the leader median and can show both', () => {
  const s = raceState(), car = s.eng.cars[1];
  assert.equal(T.gapLaps(s, car), '+0.2 laps');
  assert.equal(T.content({ ...W.newWidget('gap', 1), opt: { display: 'laps' } }, s).html, '+0.2 laps');
  assert.equal(T.content({ ...W.newWidget('gap', 1), opt: { display: 'both' } }, s).html, '+1.000 · +0.2 laps');
});
test('Gap in laps falls back to time until the leader has a valid lap', () => {
  const s = raceState();
  s.eng.cars[0].bad = [true];
  assert.equal(T.gapText(s, s.eng.cars[1], { display: 'laps' }), '+1.000');
});
test('Race Clock offers Original, Digital and Pit Wall with legacy aliases', () => {
  assert.deepEqual(W.CLOCK_STYLES.map(x => x[0]), ['classic', 'digital', 'pitwall']);
  assert.equal(W.clockStyleOf({ type: 'clock', opt: {} }), 'classic');
  assert.equal(W.clockClassOf({ type: 'clock', opt: { style: 'timing' } }), ' clock-pitwall');
  assert.equal(W.clockStyleOf({type:'clock',opt:{style:'minimal'}}),'classic');
  assert.equal(W.clockClassOf({ type: 'clock', opt: { style: '<script>' } }), '');
  assert.equal(W.clockClassOf({ type: 'gap', opt: { style: 'timing' } }), '');
  assert.equal(W.def('clock').options[0].key, 'style');
});
test('layer order moves a selected group predictably while keeping its internal order', () => {
  const a = { id: 'a' }, b = { id: 'b' }, c = { id: 'c' }, d = { id: 'd' }, all = [a, b, c, d];
  assert.deepEqual(W.stackWidgets(all, [b, d], 'front'), [a, c, b, d]);
  assert.deepEqual(W.stackWidgets(all, [b, d], 'back'), [b, d, a, c]);
  assert.deepEqual(W.stackWidgets(all, [b, d], 'forward'), [a, c, b, d]);
  assert.deepEqual(W.stackWidgets(all, [b, d], 'backward'), [b, a, d, c]);
  assert.deepEqual(all, [a, b, c, d]);
});
test('Digital draws true segments and Pit Wall labels its time direction and state', () => {
  const digital=W.clockHtml({type:'clock',opt:{style:'digital'}},'01:23.4','yellow');
  assert.equal((digital.match(/class="rc-digit"/g)||[]).length,5);
  assert(digital.includes('01:23.4 · CAUTION'));
  const wall=W.clockHtml({type:'clock',opt:{style:'pitwall'}},'123:59.9','red',true);
  assert(wall.includes('123:59')&&wall.includes('.9')&&wall.includes('REMAINING')&&wall.includes('STOPPED'));
  assert.equal(W.clockHtml({type:'clock'},'01:23.4'),'01:23.4');
});
test('every clock style preserves countdown, expiry and elapsed-time behavior',()=>{
  for(const style of ['classic','digital','pitwall']){
    const s=raceState(),w={...W.newWidget('clock'),opt:{style}},before=JSON.stringify(s.eng.cars);
    s.setup={sessionType:'timed',duration:1};s.now=16000;
    const output=T.content(w,s);assert(output.html.includes(style==='pitwall'?'00:44':style==='digital'?'00:44.0 ·':'00:44.0'));assert.equal(output.bg,undefined);
    s.now=90000;assert(T.content(w,s).html.includes(style==='pitwall'?'00:00':style==='digital'?'00:00.0 ·':'00:00.0'));
    w.opt.countdown=false;assert(T.content(w,s).html.includes(style==='pitwall'?'01:30':style==='digital'?'01:30.0 ·':'01:30.0'));
    w.opt.flagColour=false;assert.equal(T.content(w,s).color,undefined);assert.equal(JSON.stringify(s.eng.cars),before);
  }
});
test('title overlays and the displayed value owns the full visual centre of every widget', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/styles.css'), 'utf8');
  assert.match(W.titleStyleOf({ type: 'laptime', titleAlign: 'left', titleSpace: true }), /left:12px;right:12px;top:6px;text-align:left/);
  assert.match(W.titleStyleOf({ type: 'laptime', titleAlign: 'right', titleSpace: true }), /left:12px;right:12px;top:6px;text-align:right/);
  assert.match(W.titleStyleOf({ type: 'laptime', titleAlign: 'center' }), /left:12px;right:12px;top:6px;text-align:center/);
  assert.match(W.valueStyleOf({ type: 'laptime', valueAlign: 'left' }), /justify-content:flex-start;text-align:left/);
  assert.match(W.valueStyleOf({ type: 'laptime', valueAlign: 'right' }), /justify-content:flex-end;text-align:right/);
  assert(css.includes('.lw-val{position:absolute;inset:0;'));
  assert(!css.includes('.lw.lcstripe-top .lw-title,.lw.lcstripe-top .lw-lane,.lw.lcstripe-side .lw-title,.lw.lcstripe-side .lw-lane,.lw.lcstripe-right .lw-title,.lw.lcstripe-right .lw-lane{position:relative'));
});
test('a lane stripe follows the widget corner setting instead of imposing a separate curve', () => {
  const F = require('../renderer/frame');
  assert.equal(F.corner({ w: 100, h: 100 }, { radius: 2 }, 1000), '0.2cqw');
  assert.equal(F.corner({ w: 100, h: 100 }, { radius: 14 }, 1000), '1.4cqw');
  assert.equal(typeof F.stripeCorner, 'undefined');
});
test('tyre and Pace keep text readable while their artwork gives it room', () => {
  const css = require('fs').readFileSync(require('path').join(__dirname, '../renderer/styles.css'), 'utf8');
  const TyreW = require('../renderer/tyrewidgets');
  const PaceW = require('../renderer/pacewidgets');
  assert.equal(TyreW.pictureScale({}), 55);
  assert.equal(TyreW.pictureScale({ pictureScale: 4 }), 20);
  assert.equal(TyreW.pictureScale({ pictureScale: 99 }), 80);
  assert.equal(PaceW.gaugeScale({}), 55);
  assert.equal(PaceW.gaugeScale({ gaugeScale: 4 }), 20);
  assert.equal(PaceW.gaugeScale({ gaugeScale: 99 }), 80);
  assert.match(TyreW.sample(0, { opt: { look: 'wear' } }), /--tw-media:55%/);
  assert.match(PaceW.sample(0, { opt: { look: 'gauge' } }), /psbox-gauge.*--ps-media:55%/);
  assert(css.includes('.twbox2{display:grid;grid-template-rows:minmax(0,var(--tw-media,55%)) auto;'));
  assert(css.includes('.psbox-gauge{display:grid;grid-template-rows:minmax(0,var(--ps-media,55%)) auto auto;'));
  assert(!css.includes('font-size:min(1em,8cqmin)'));
});

console.log('Widget polish: ' + groups + ' groups passed.');
