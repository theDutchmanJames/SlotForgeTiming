// Race Settings rewrite (1.86.0): this deliberately checks the contract of the
// new form rather than the old controls it replaces.
const assert = require('assert');
const schema = require('../schema.js').racesetups;
const RaceSystems = require('../renderer/racesystems.js');
const Words = require('../renderer/setupwords.js');

const keys = schema.fields.map(f => f.key);
const field = key => schema.fields.find(f => f.key === key);
const group = id => schema.groups.find(g => g.id === id);

assert.equal(group('length').title, 'Race Settings');
assert.equal(group('screens').title, 'Race UI and Audio');
assert(!schema.groups.some(g => ['start', 'yellow', 'pads'].includes(g.id)));
assert(!keys.some(k => ['lightsAfter', 'yellowTarget', 'yellowPoints', 'padPoints', 'padDamage', 'padSeconds', 'padLaps', 'padChamp', 'trackcall'].includes(k)));

assert.equal(field('pitHold').group, 'length');
assert.equal(field('restartAfterRed').group, 'length');
assert.equal(field('firstLap').group, 'length');
assert.deepEqual(field('trackCallAction').options.map(x => x[0]), ['yellowred', 'yellow', 'red', 'power', 'none']);
assert.equal(field('trackCallYellowPower').group, 'length');
assert.equal(field('trackCallRedPower').group, 'length');
assert.equal(field('trackcallWindow').group, 'length');

assert.deepEqual(RaceSystems.ITEMS.map(x => x.key), ['fuel', 'penalty', 'damage', 'safetycar', 'tyrewear', 'weather', 'pushsave', 'bop']);
assert(RaceSystems.setupHtml({ fuelRules: 'fuel-1', disabledSystems: '' }).includes('system-fuel'));

const rail = Words.rail({ sessionType: 'race', raceBy: 'laps', laps: 10, lightsMin: 1, lightsMax: 5, trackCallAction: 'yellowred' }, { defaults: {}, shown: () => true });
assert(rail.length.rail.includes('10 laps'));
assert(!Object.prototype.hasOwnProperty.call(rail, 'start'));
assert.equal(rail.advanced.rail, 'Timing hardware · Box');

console.log('RACE SETUP REWRITE TESTS PASSED');
