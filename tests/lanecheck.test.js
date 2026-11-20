'use strict';
// 2.4.0: the Lane Check reworked (renderer/sensortest.js, SlotForgeRestyle.md "Lane Check"): the lanes asked for one at a time, so a sensor on the wrong lane
// is caught and swapped in one click; the pit sensors, the Track call button and the track power as checks; Connect when the hardware is not connected.
const test = require('node:test'),
  assert = require('node:assert/strict');
const ST = require('../renderer/sensortest.js');
const { code, has } = require('./source.cjs');

test('in order: lane 1 first; another lane lighting is a swap to suggest, not a crossing', () => {
  const T = ST.createTally(4, { order: true });
  assert.equal(ST.expected(T), 0);
  assert.equal(ST.summary(T).text, 'No lane has seen a car yet. Drive a car over the line in lane 1 first.');
  assert.equal(ST.hit(T, 0, 1000), 0);
  assert.equal(ST.hit(T, 1, 2000), 1);
  assert.equal(ST.summary(T).text, 'Now lane 3: drive a car over its line. (1 more after it.)');
  assert.equal(ST.hit(T, 3, 3000, undefined, 3), -2, 'lane 3 was asked for, the sensor of lane 4 lit');
  assert.deepEqual(T.swap, { lane: 2, lit: 3, sensor: 3 });
  assert.equal(T.wrong[2], 3);
  assert.equal(T.hits[3], 0, 'not counted for lane 4');
  assert.equal(ST.summary(T).text, 'Lane 4 has not seen a car yet · lanes 3 and 4 may be swapped.');
  const w = ST.swapText(T, true);
  assert.equal(w.head, 'Lane 3 lit lane 4');
  assert.equal(w.button, 'Swap 3 and 4');
  assert.match(ST.swapText(T, false).text, /Check the cables of lanes 3 and 4/);
  ST.swapped(T, 4000);
  assert.equal(T.swap, null);
  assert.equal(T.hits[2], 1, 'the swap counts the car of lane 3');
  assert.equal(ST.expected(T), 3);
  ST.hit(T, 3, 5000);
  assert.equal(ST.summary(T).ok, true);
});

test('driving a lane again is fine; Not now stops asking in order', () => {
  const T = ST.createTally(3, { order: true });
  ST.hit(T, 0, 1000);
  assert.equal(ST.hit(T, 0, 6000), 0, 'lane 1 again: counted');
  assert.equal(T.hits[0], 2);
  ST.hit(T, 2, 7000);
  assert(T.swap);
  ST.noOrder(T);
  assert.equal(T.swap, null);
  assert.equal(ST.hit(T, 2, 8000), 2, 'now every lane counts where its sensor is');
  assert.equal(ST.createTally(1, { order: true }).order, false, 'one lane: nothing to put in order');
  assert.equal(ST.createTally(4).order, false, 'not asked: as before');
});

test('the checks: lanes, then the pit lane, the Track call button and the track power when the hardware has them', () => {
  const T = ST.createTally(2, { order: true });
  const caps = { pit: true, call: true, power: true };
  assert.deepEqual(
    ST.steps(T, caps).map(s => [s.id, s.done, s.note]),
    [
      ['lanes', false, '0 of 2'],
      ['pit', false, '0 of 2'],
      ['call', false, ''],
      ['power', false, '']
    ]
  );
  ST.hit(T, 0, 1);
  ST.hit(T, 1, 2);
  ST.pitSeen(T, 0);
  ST.pitSeen(T, 1);
  assert.equal(ST.pitSeen(T, 7), -1, 'a pit sensor of a lane this race does not have');
  ST.callSeen(T, 5);
  ST.powerSet(T, false);
  assert.equal(ST.steps(T, caps)[3].done, false, 'off, not on again yet');
  ST.powerSet(T, true);
  assert(ST.steps(T, caps).every(s => s.done));
  assert.deepEqual(
    ST.steps(T, {}).map(s => s.id),
    ['lanes'],
    'hardware without them: only the lanes'
  );
});

test('the source says what the hardware has: pit sensors, the call button, power and the lane map', () => {
  const link = () => {
    const subs = new Set();
    return { connected: true, power: null, on: f => (subs.add(f), () => subs.delete(f)), onStatus: () => () => {}, emit: e => subs.forEach(f => f(e)) };
  };
  const tm = link(),
    ab = link();
  ab.map = [1, 0, 2, 3];
  const g = {
    Trackmate: { link: tm, laneMap: (m, n = 8) => (Array.isArray(m) ? m.concat(Array.from({ length: n }, (_, i) => i).slice(m.length)) : Array.from({ length: n }, (_, i) => i)), swapLane: () => [] },
    tmPower: async () => true,
    ArduinoBox: { link: ab, C: { mainPower: on => [on ? 1 : 0] } },
    abSend: async () => true
  };
  const t = ST.source('trackmate', { tmLaneMap: [1, 0] }, g);
  assert.equal(t.map.key, 'tmLaneMap');
  assert(t.power && t.pits && t.calls);
  const got = [];
  t.listen((lane, at, ms, sensor) => got.push(['hit', lane, sensor]));
  t.pits(lane => got.push(['pit', lane]));
  t.calls(() => got.push(['call']));
  tm.emit({ type: 'hit', lane: 0, at: 1 });
  tm.emit({ type: 'block', lane: 0, at: 2 });
  tm.emit({ type: 'call', at: 3 });
  assert.deepEqual(got, [['hit', 1, 0], ['pit', 1], ['call']], 'the Trackmate: its sensor, mapped to the lane');
  const a = ST.source('arduino', {}, g);
  assert.equal(a.map.key, 'abLaneMap');
  const pits = [];
  a.pits(l => pits.push(l));
  ab.emit({ type: 'pit', pit: 0, in: true });
  ab.emit({ type: 'pit', pit: 0, in: false });
  assert.deepEqual(pits, [1], 'the Arduino box: a covered pit sensor, on its lane');
  const ds = ST.source('ds', {}, { DsTiming: { link: link() } });
  assert(!ds.pits && !ds.calls && !ds.power && !ds.map, 'DS: the lanes only');
});

test('the panel is wired: Connect, Open Timing Hardware, Swap, Not now, the power switch, Done', () => {
  const s = code('renderer/sensortest.js');
  for (const k of ['data-lc-connect', 'data-lc-hw', 'data-lc-swap', 'data-lc-notnow', 'data-lc-power', 'data-stclose', 'data-lc-pill'])
    assert(s.includes(k), k);
  assert(has(s, "if (typeof DESK_CONNECT !== 'undefined' && DESK_CONNECT[o.hw]) return DESK_CONNECT[o.hw]();"), 'the same connect as the Timing Desk');
  assert(has(s, 'const racing = () =>'), 'no power switching or swapping during a race');
  assert(has(code('renderer/styles.css'), '.lc-swap{'));
});
