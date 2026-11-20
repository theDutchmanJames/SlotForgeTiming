'use strict';
// 2.4.0: the Trackmate page's Live monitor and Track power (renderer/tmmonitor.js, hardwareui.js, SlotForgeRestyle.md "Sensor Bench"): a pass per car
// over a sensor, the time between two passes of a lane and the best, the Trackcall button, what came in, a sensor switched off by the lane count; the
// state of the power, a switch, what a race does with it (from the race setup), the relay.
const test = require('node:test'),
  assert = require('node:assert/strict');
const M = require('../renderer/tmmonitor.js');
const { code, has } = require('./source.cjs');

test('passes, lap times and the best; a car on a sensor is one pass', () => {
  const st = M.create(),
    o = { laneMap: [0, 1, 2, 3, 4, 5, 6, 7], lanesOn: 2 };
  assert.equal(M.hit(st, 0, 1000, o), 'pass');
  assert.equal(M.hit(st, 0, 1100, o), 'still', 'letters while the car is over it');
  assert.equal(M.hit(st, 0, 1350, o), 'still');
  assert.equal(M.hit(st, 0, 11200, o), 'pass');
  assert.equal(M.hit(st, 0, 21000, o), 'pass');
  assert.equal(M.hit(st, 0, 21300, o), 'still');
  assert.equal(M.hit(st, 0, 21800, o), 'bounce', 'gone and back within a second: the same car');
  assert.deepEqual({ passes: st.lanes[0].passes, lap: st.lanes[0].lap, best: st.lanes[0].best }, { passes: 3, lap: 9800, best: 9800 });
  assert.deepEqual(
    st.log.map(e => [e.who, e.what]),
    [
      ['Lane 1', '9.800 s · best'],
      ['Lane 1', '10.200 s · best'],
      ['Lane 1', 'first pass']
    ]
  );
  // the lane of a sensor follows the lane order; a sensor the Trackmate is not told about is flagged
  const st2 = M.create();
  M.hit(st2, 0, 1000, { laneMap: [1, 0], lanesOn: 2 });
  assert.equal(st2.lanes[1].passes, 1, 'sensor A counts for lane 2');
  M.hit(st2, 3, 2000, { laneMap: [1, 0, 2, 3], lanesOn: 2 });
  assert.match(st2.log[0].what, /switched off by the lane count/);
  assert.equal(st2.log[0].who, 'Sensor D');
  for (let i = 0; i < 20; i++) M.hit(st2, 1, 5000 + i * 2000, { lanesOn: 2 });
  assert.equal(st2.log.length, 12, 'the last twelve lines are kept');
});

test('the Trackcall button and the monitor as drawn', () => {
  const st = M.create();
  M.call(st, 5000);
  M.call(st, 7500);
  assert.deepEqual([st.call.count, st.call.gap], [2, 2500]);
  assert.equal(st.log[0].what, '2.500 s after the press before');
  M.hit(st, 1, 9000, { lanesOn: 2 });
  M.hit(st, 1, 19100, { lanesOn: 2 });
  const h = M.html(st, { lanesOn: 2, open: true, now: 20000, wall: 0, lit: [false, true] });
  assert(h.includes('● Listening') && h.includes('Nothing is saved; this is not a race.'));
  assert(h.includes('<span class="tmx-led on" data-tmx-led="1"'), 'lane 2 is lit');
  assert(h.includes('<b>10.100</b><span>last lap · best <em>10.100</em></span>'));
  assert(h.includes('2 passes · now'));
  assert(h.includes('2 presses'));
  assert(M.html(st, { open: false }).includes('Not connected'));
});

test('what a race does with the power, read from the race setup', () => {
  const r = s => M.rules(s).map(([w, v]) => w + ': ' + v);
  assert.deepEqual(r(null), [
    'While the lights count down: ON',
    'Lights out, racing: ON',
    'Yellow flag: ON',
    'Red flag: ON',
    'The interface is lost in a race: OFF'
  ]);
  assert.deepEqual(r({ startPower: 'off', trackCallAction: 'red', trackCallRedPower: 'off' }), [
    'While the lights count down: OFF',
    'Lights out, racing: ON',
    'Red flag: OFF',
    'The interface is lost in a race: OFF'
  ]);
  assert(r({ trackCallAction: 'power' }).includes('The Trackcall button: BUTTON'));
  assert(!r({ trackCallAction: 'none' }).some(x => /flag/.test(x)), 'no button: no flag rules');
  const h = M.powerHtml({ power: true, at: '18:24', relayNC: false, open: true, setupName: 'QA heats' });
  assert(h.includes('<h3>Power on</h3>') && h.includes('Switched on at 18:24 · relay normally open'));
  assert(h.includes('In a race the app switches it · QA heats'));
  assert(h.includes('data-tmx-power="1" aria-pressed="true" class="on"'));
  assert(M.powerHtml({ power: null }).includes('Not switched yet'));
  assert(M.powerHtml({ power: false, open: false }).includes('disabled'), 'not connected: the switch waits');
});

test('the Trackmate page draws them and keeps them out of the sheet', () => {
  const ui = code('renderer/hardwareui.js');
  assert(has(ui, '<div class="tmx" id="tmx-mon">'));
  assert(has(ui, '<div class="tmx" id="tmx-pw">'));
  assert(has(ui, "if (b.dataset.tmxPower !== undefined) return tmPower(b.dataset.tmxPower === '1');"));
  assert(has(ui, 'How long a sensor must stay changed before the Trackmate reports it.'));
  assert(has(code('renderer/generalpage.js'), ":scope > .pl, :scope > .bv, :scope > .tmx'"));
  assert(has(code('renderer/index.html'), '<script src="tmmonitor.js"></script>'));
});
