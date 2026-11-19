// Race Settings rewrite (1.86.0): this deliberately checks the contract of the
// new form rather than the old controls it replaces.
const assert = require('assert');
const schema = require('../schema.js').racesetups;
const RaceSystems = require('../renderer/racesystems.js');
const Words = require('../renderer/setupwords.js');

const keys = schema.fields.map(f => f.key);
const field = key => schema.fields.find(f => f.key === key);
const group = id => schema.groups.find(g => g.id === id);

// (2.4.0, Setup Sheet) Race Settings is split: Length, Points and finals, Start lights, The first lap and a red flag, Track Call
assert.equal(group('length').title, 'Length');
assert.equal(group('scoring').title, 'Points and finals');
assert.equal(group('lights').title, 'Start lights');
assert.equal(group('start').title, 'The first lap and a red flag');
assert.equal(group('call').title, 'Track Call');
assert.equal(group('screens').title, 'Screen and sound');
assert(!schema.groups.some(g => ['yellow', 'pads'].includes(g.id)));
assert(!keys.some(k => ['lightsAfter', 'yellowTarget', 'yellowPoints', 'padPoints', 'padDamage', 'padSeconds', 'padLaps', 'padChamp', 'trackcall'].includes(k)));

assert.equal(field('pitHold').group, 'service');
assert.equal(field('restartAfterRed').group, 'start');
assert.equal(field('firstLap').group, 'start');
assert.equal(field('lightsMin').group, 'lights');
assert.equal(field('lightsMax').group, 'lights');
assert.deepEqual(field('trackCallAction').options.map(x => x[0]), ['yellowred', 'yellow', 'red', 'power', 'none']);
assert.equal(field('trackCallAction').group, 'call');
assert.equal(field('trackCallYellowPower').group, 'call');
assert.equal(field('trackCallRedPower').group, 'call');
assert.equal(field('trackcallWindow').group, 'call');

assert.deepEqual(RaceSystems.ITEMS.map(x => x.key), ['fuel', 'penalty', 'damage', 'safetycar', 'tyrewear', 'weather', 'pushsave', 'bop']);
assert(RaceSystems.setupHtml({ fuelRules: 'fuel-1', disabledSystems: '' }).includes('system-fuel'));

const rail = Words.rail({ sessionType: 'race', raceBy: 'laps', laps: 10, lightsMin: 1, lightsMax: 5, trackCallAction: 'yellowred' }, { defaults: {}, shown: () => true });
assert(rail.length.rail.includes('10 laps'));
assert(rail.race.rail.includes('10 laps'));
assert.equal(rail.start.rail, 'Lights 1–5 s · Track Call yellow, then red');
assert.equal(rail.advanced.rail, 'Timing hardware · Arduino Sketch');

console.log('RACE SETUP REWRITE TESTS PASSED');
