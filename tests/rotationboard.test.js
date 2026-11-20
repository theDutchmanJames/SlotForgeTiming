'use strict';
// 2.4.0: Rotation Setups reworked (renderer/rotation.js, rotationui.js, SlotForgeRestyle.md "Rotation Board"): the lanes from a track, the participants and
// their names from an entry list or picked drivers, lane fairness in a table with the words of what is uneven, and a warning on the card when a race setup
// that uses the rotation races on a track with fewer lanes.
const test = require('node:test'),
  assert = require('node:assert/strict');
const Rot = require('../renderer/rotation.js');
const { code, has } = require('./source.cjs');

const rec = heats => Rot.clean({ name: 'R', participants: 3, lanes: 4, names: ['Anna', 'Bjorn', 'Chris'], heats });

test('lane fairness: who races a lane too often, and who never races a lane they could have', () => {
  const lopsided = rec(
    [0, 1, 2, 3].map(h => ({ places: [{ p: 0, lane: 0 }, { p: 1, lane: (h % 3) + 1 }] }))
  );
  const f = Rot.fairness(lopsided);
  assert.deepEqual(
    f.uneven.map(u => [u.p, u.over, u.none]),
    [
      [0, [0], [1, 2, 3]],
      [1, [1], [0]]
    ]
  );
  assert.equal(f.text, 'Anna races lane 1 4 times and never lanes 2, 3 and 4; Bjorn races lane 2 twice and never lane 1.');
  const fair = rec([0, 1, 2, 3].map(h => ({ places: [{ p: 0, lane: h }, { p: 1, lane: (h + 1) % 4 }, { p: 2, lane: (h + 2) % 4 }] })));
  assert.deepEqual(Rot.fairness(fair).uneven, []);
  assert.equal(Rot.fairness(fair).text, 'Every participant races the lanes about equally often.');
  const few = rec([{ places: [{ p: 0, lane: 0 }] }, { places: [{ p: 0, lane: 1 }] }]);
  assert.deepEqual(Rot.fairness(few).uneven, [], 'two heats on four lanes: not racing two lanes is not uneven');
  assert.equal(Rot.fairness(Rot.evenLanes(lopsided).rec).uneven.length < f.uneven.length, true, 'Even out the lanes makes it better');
});

test('a rotation remembers the track its lanes come from', () => {
  assert.equal(Rot.clean({ participants: 4, lanes: 4, trackId: 't1' }).trackId, 't1');
  assert.equal('trackId' in Rot.clean({ participants: 4, lanes: 4 }), false, 'none: as before');
});

test('the editor: lanes from a track, participants from an entry list or picked, the fairness table, the card warning', () => {
  const ui = code('renderer/rotationui.js');
  assert(has(ui, "optCard('data-ro-track',"));
  assert(has(ui, "optCard('data-ro-pickdrivers', '1', 'Pick drivers…', 'from the database', false)"));
  assert(has(ui, 'res.rec.trackId = t.id;'));
  assert(has(ui, "res.rec.names = Array.from({ length: n }, (_, i) => names[i] || '');"));
  assert(has(ui, "driverType !== 'virtual'"), 'a virtual rival is not a participant');
  assert(has(ui, 'function fairHead(d)') && has(ui, 'id="ro-even2"'));
  assert(has(ui, "' ro-zero'") && has(ui, "' ro-over'"));
  assert(has(ui, 'this rotation uses ${used}.'));
});
