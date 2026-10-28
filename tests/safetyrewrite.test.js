// 1.89.0: the Safety Car editor keeps its rules global to yellow, with optional
// Random Flag pit-exit holds that only use the existing Service Stop mechanism.
const assert = require('assert');
const E = require('../renderer/engine.js'), Sc = require('../renderer/safetycar.js'), S = require('../schema.js'), W = require('../renderer/systemwords.js');

let fails = 0;
const ok = (name, fn) => {
  try { fn(); console.log('ok   ' + name); }
  catch (err) { fails++; console.log('FAIL ' + name + '\n' + err.message); }
};
const words = d => d.say.map(x => x.t).join('');
const rec = { name: 'Club Safety Car', safetyTrack: 'club', targetOn: 'on', target: 15, pointsOn: 'on', points: 2, pitOn: 'on', pitPercent: 50,
  rndOn: 'on', rndMode: 'exact', rndMin: 1, rndFrom: 0, rndTo: 0, rndLen: 20, rndPitExit: 'on', rndNote: 'Pit lane closed — wait for green' };

ok('the redesigned form has the reference Track, global-rule toggles and Random Flag conditions', () => {
  const f = k => S.safetycarsystems.fields.find(x => x.key === k);
  assert.equal(S.safetycarsystems.groups.find(x => x.id === 'random').title, 'Random Flags');
  assert.equal(f('safetyTrack').ref, 'tracks');
  assert.deepEqual(f('targetOn').options.map(x => x[0]), ['off', 'on']);
  assert.deepEqual(f('pointsOn').options.map(x => x[0]), ['off', 'on']);
  assert.deepEqual(f('pitOn').options.map(x => x[0]), ['off', 'on']);
  assert.equal(f('rndPitExit').default, 'off');
  assert.equal(f('rndNote').maxLength, 180);
});

ok('the three global rules can independently be switched off without changing legacy systems', () => {
  assert.deepEqual(Sc.clean({ targetOn: 'off', pitOn: 'off' }), { target: 0, points: 0, pit: 0 });
  assert.deepEqual(Sc.clean({ target: 18, pointsOn: 'off', pitPercent: 40 }), { target: 18000, points: 0, pit: 40 });
  assert.deepEqual(Sc.clean({ target: 18, points: 3, pitPercent: 40 }), { target: 18000, points: 3, pit: 40 });
});

ok('plain words make the Track reference, yellow Track Call scope and Random Flag instructions explicit', () => {
  const d = W.describe('safetycarsystems', rec, { track: { id: 'club', name: 'Club Circuit', targetLap: 8.5 } });
  const line = words(d);
  assert.ok(line.includes('yellow Track Call'));
  assert.ok(line.includes('Club Circuit (8.5 seconds)'));
  assert.ok(line.includes('held at pit exit'));
  assert.ok(line.includes('Pit lane closed'));
  assert.ok(W.rail('safetycarsystems', rec, { track: { id: 'club', name: 'Club Circuit' } }).flags.row.includes('hold at pit exit'));
});

const race = pitControl => {
  const r = E.createRace({ type: 'timed', duration: 1, entries: [{ lane: 0, driverName: 'Alex' }], safetycar: Sc.clean(rec), ...(pitControl ? { pitControl } : {}) });
  r.start(0); return r;
};

ok('a Random Flag holds cars already in the pits until it ends, then returns to the Service Stop release rule', () => {
  const r = race({ mode: 'manual', seconds: 5, waitReturn: false });
  assert.equal(r.block(0, 0), true);
  r.tick(0);
  assert.equal(r.flag, 'yellow');
  assert.equal(r.cars[0].rndPitExit, true);
  assert.equal(r.pitHoldOf(0, 0).randomHold, true);
  assert.equal(r.events.find(x => x.type === 'randomflag').note, rec.rndNote);
  r.tick(6000);
  assert.equal(r.pitRelease(0, 6000), false);
  r.setFlag('yellow', 10000); r.tick(10000);
  assert.equal(r.cars[0].rndPitExit, false);
  assert.equal(r.pitHoldOf(0, 10000).text, 'Ready to release');
  assert.equal(r.pitRelease(0, 10000), true);
});

ok('without Service Stop, the same condition stays an instruction rather than pretending to restrain a car', () => {
  const r = race(null);
  r.block(0, 0); r.tick(0);
  assert.equal(r.cars[0].rndPitExit, false);
  assert.equal(r.unblock(0, 1000), true);
});

ok('switching Safety Car off during a Random Flag clears a pit-exit hold instead of trapping the car', () => {
  const r = race({ mode: 'manual', seconds: 5, waitReturn: false });
  r.block(0, 0); r.tick(0); r.tick(2000);
  assert.equal(r.pitHoldOf(0, 2000).randomHold, true);
  assert.equal(r.setSystem('safetycar', false, 3000), true);
  assert.equal(r.cars[0].rndPitExit, false);
  assert.equal(r.pitHoldOf(0, 3000).randomHold, undefined);
});

console.log(fails ? `\n${fails} SAFETY REWRITE TESTS FAILED` : '\nALL SAFETY REWRITE TESTS PASSED');
process.exitCode = fails ? 1 : 0;
