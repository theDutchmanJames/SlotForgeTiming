'use strict';
// 2.4.0 review, "Pit Lights": the Arduino box's pit sensors get their lane in Lane Check (click the light that lit, choose the lane), the choice is
// saved as abPitMap, and the race puts a car in the pits by the same lane, so Lane Check and the race agree.
const test = require('node:test'),
  assert = require('node:assert/strict');
const AB = require('../renderer/arduinobox.js');
const ST = require('../renderer/sensortest.js');
const AR = require('../renderer/arduinorace.js');
const { code, has } = require('./source.cjs');

test('the saved pit map: sensor n is lane n until a lane is chosen, and anything else is cleaned', () => {
  assert.deepEqual(AB.pitMap(null), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(AB.pitMap([1, 0, 'x', 9, -1]), [1, 0, 2, 3, 4, 5, 6, 7]);
});

test('choosing a lane for a pit sensor gives the sensor that had it the old lane', () => {
  assert.deepEqual(ST.pitAssign([0, 1, 2, 3, 4, 5, 6, 7], 2, 1), [0, 2, 1, 3, 4, 5, 6, 7]);
  assert.deepEqual(ST.pitAssign([0, 1, 2, 3, 4, 5, 6, 7], 3, 3), [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("a pit event carries the chosen lane, and the race blocks that lane's car", () => {
  const L = AB.createLink ? AB.createLink() : AB.link;
  L.setPitMap([2, 1, 0, 3, 4, 5, 6, 7]);
  assert.equal(L.pitMap[0], 2);
  const events = [];
  let listener = null;
  const link = { on: f => ((listener = f), () => {}), send: () => {} };
  const blocked = [];
  const b = AR.bind({
    link,
    setup: {},
    cars: () => [{ lane: 0 }, { lane: 1 }, { lane: 2 }],
    phase: () => 'running',
    flag: () => 'green',
    blockCar: i => blocked.push(i),
    unblockCar: () => {},
    crossCar: () => {}
  });
  listener({ type: 'pit', pit: 0, lane: 2, in: true });
  assert.deepEqual(blocked, [2], 'pit sensor 1, chosen for lane 3, puts the car of lane 3 in the pits');
  listener({ type: 'pit', pit: 1, in: true });
  assert.deepEqual(blocked, [2, 1], 'an event without a lane falls back to sensor n = lane n');
  events.length = 0;
  if (b && typeof b.off === 'function') b.off();
});

test('Lane Check draws the pit lights and saves the chosen lane', () => {
  const S = code('renderer/sensortest.js');
  assert.ok(has(S, "key: 'abPitMap',"));
  assert.ok(has(S, 'A pit sensor lights up when a car is on it. Click a light to choose its lane.'));
  assert.ok(has(S, 'const st = await saveMap(src.pitSensors.key, m);'));
  assert.ok(has(code('renderer/arduinoui.js'), 'L.setPitMap('));
  assert.ok(/\.lc-pitsensor\.lc-lit/.test(code('renderer/styles.css')));
});
