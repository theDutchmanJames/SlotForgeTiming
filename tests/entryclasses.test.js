'use strict';
// 2.4.0: Multi-Class classes from the entry list of the race, and a virtual rival added in a lane (renderer/multiclass.js, landing.js, multiclassui.js,
// SlotForgeRestyle.md "Home Lanes"): the class of an entry is chosen on Home and kept with the race setup's entry list; the system's driver list is the
// default; the check that the car carries the class; class counts; copy to the system; a Rival Setup picked in a lane, with its reason in that lane.
const test = require('node:test'),
  assert = require('node:assert/strict');
const MC = require('../renderer/multiclass.js');
const { code, has } = require('./source.cjs');

const gt = { id: 'gt', name: 'GT3' },
  lmp = { id: 'lmp', name: 'LMP' };
const p = MC.clean({ name: 'GT and LMP', assignment: 'roster', classes: [{ id: 'gt' }, { id: 'lmp' }], driverClasses: [{ driverId: 'anna', classId: 'gt' }] });
const db = {
  cars: [
    { id: 'c1', raceClass: 'gt' },
    { id: 'c2', raceClass: 'lmp' }
  ],
  drivers: [{ id: 'anna' }, { id: 'bjorn' }],
  teams: []
};

test('the class chosen in the lane wins; the system gives the default', () => {
  assert.equal(MC.resolve({ driverId: 'anna' }, p, db), 'gt', 'the default of the system');
  assert.equal(MC.resolve({ driverId: 'anna', raceClass: 'lmp' }, p, db), 'lmp', 'chosen for this race');
  assert.equal(MC.resolve({ driverId: 'bjorn', raceClass: 'lmp' }, p, db), 'lmp', 'a driver without a default can race too');
  assert.equal(MC.resolve({ driverId: 'anna', raceClass: 'gone' }, p, db), 'gt', 'a class that is not in the system: the default');
  assert.deepEqual(
    MC.carsFor({ driverId: 'bjorn', raceClass: 'lmp' }, p, db).map(c => c.id),
    ['c2'],
    'only cars with the label of the class'
  );
});

test('an entry without a class says so, in words for the lane', () => {
  assert.deepEqual(MC.entryIssues(p, [{ driverId: 'bjorn', carId: 'c1' }], db), ['Entry 1 needs a class: choose it here.']);
  assert.deepEqual(MC.entryIssues(p, [{ driverId: 'bjorn', carId: 'c2', raceClass: 'lmp' }], db), []);
  assert.match(MC.entryIssues(p, [{ driverId: 'anna', carId: 'c2' }], db)[0], /needs a slotcar labelled/);
});

test('Home: the class pick, its check, the counts, copy to the system', () => {
  const home = code('renderer/landing.js');
  assert(has(home, 'data-mc-pick="${i}" data-val="${esc(c.id)}"'));
  assert(has(home, '✓ Car is ${esc(cls ? cls.name : \'\')}'));
  assert(has(home, 'hs-classchip'));
  assert(has(home, "await api.update('multiclasssystems', sys.id, { driverClasses: [...keep, ...add] });"));
  assert(!home.includes('Assign this driver in Multi-Class setup'), 'no more sending to the system');
});

test('Home: a Rival Setup picked in a lane makes its virtual driver once; its reason is said in its lane', () => {
  const home = code('renderer/landing.js');
  assert(has(home, '<optgroup label="Add a virtual rival">'));
  assert(has(home, "if (!d) d = await api.add('drivers', { name: prof.name || 'Virtual Rival', driverType: 'virtual', virtualRivalSystem: pid });"));
  assert(has(home, 'rowMsg(i, label(i) + (rivalRowErr[i]'));
  assert(has(home, "state.setupSub = 'virtualrivals';"), 'From a race… opens the Virtual Rivals page');
});

test('the Multi-Class editor: Defaults, and no driver is required any more', () => {
  const ui = code('renderer/multiclassui.js');
  assert(has(ui, "title: 'Defaults',"));
  assert(!ui.includes("errors.push('Assign at least one driver to a selected class.')"));
});
