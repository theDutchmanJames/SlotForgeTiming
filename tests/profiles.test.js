'use strict';
// 2.4.0: Balance of Power and Time Tokens as named profiles (renderer/profiles.js, SlotForgeRestyle.md "Profile Cards"): the Club default (the settings) and
// profiles a race setup chooses (bopSystem, tokenSystem); "Used by"; Delete blocked while used; the race uses the profile of its setup; the profiles travel
// with backups and Import and Export.
const test = require('node:test'),
  assert = require('node:assert/strict');
const P = require('../renderer/profiles.js');
const Bop = require('../renderer/bop.js');
const { code, has } = require('./source.cjs');
const schema = (m => m.schema || m)(require('../schema.js'));

test('a profile holds the same keys as the settings, so the same readers read both', () => {
  const profile = { name: 'Endurance', bopMode: 'auto', bopPercent: 12, unrelated: 1 };
  assert.deepEqual(P.copyOf('bop', profile), { bopMode: 'auto', bopPercent: 12 });
  const s = Bop.settingsOf(profile);
  assert.equal(s.mode, 'auto');
  assert.equal(s.percent, 12);
  assert.deepEqual(P.copyOf('tokens', { tokenWarnSeconds: 30, bopMode: 'auto' }), { tokenWarnSeconds: 30 });
  assert(
    P.BOP_KEYS.every(k => Object.values(Bop.KEYS).includes(k)),
    'every key of the Balance of Power settings'
  );
});

test('used by: the setups that choose a profile; the Club default for the rest (and for a profile that is gone)', () => {
  const setups = [
    { name: 'Club night', bop: 'on', sessionType: 'race' },
    { name: 'Endurance 6h', bop: 'on', sessionType: 'endurance', bopSystem: 'p1' },
    { name: 'Old link', bop: 'on', sessionType: 'race', bopSystem: 'gone' },
    { name: 'Off', bop: 'off', sessionType: 'race', bopSystem: 'p1' },
    { name: 'Practice', bop: 'on', sessionType: 'practice' },
    { name: 'Token night', sessionType: 'tokens', tokenSystem: 't1' }
  ];
  assert.deepEqual(P.usedBy('bop', setups, 'p1', ['p1']), ['Endurance 6h']);
  assert.deepEqual(P.usedBy('bop', setups, '', ['p1']), ['Club night', 'Old link']);
  assert.deepEqual(P.usedBy('tokens', setups, 't1', ['t1']), ['Token night']);
  assert.deepEqual(P.usedBy('tokens', setups, '', ['t1']), []);
});

test('a profile name', () => {
  assert.equal(P.nameError('', []), 'Give the profile a name.');
  assert.equal(P.nameError('club default', []), 'That name is kept for the Club default.');
  assert.equal(P.nameError('Endurance', ['endurance']), 'Another profile has that name.');
  assert.equal(P.nameError('Kids night', ['Endurance']), '');
});

test('the schema: two profile kinds, and a race setup chooses one', () => {
  assert(schema.bopsystems && schema.tokensystems);
  const f = k => schema.racesetups.fields.find(x => x.key === k);
  assert.equal(f('bopSystem').ref, 'bopsystems');
  assert.equal(f('bopSystem').blank, 'Club default');
  assert.deepEqual(f('bopSystem').showIf, [{ sessionType: ['race', 'heats', 'endurance'], bop: ['on'] }]);
  assert.equal(f('tokenSystem').ref, 'tokensystems');
  assert.deepEqual(f('tokenSystem').showIf, [{ sessionType: ['tokens'] }]);
});

test('the race uses the profile of its setup; the profiles travel with Import and Export, content packs and the race read', () => {
  const race = code('renderer/race.js');
  assert(has(race, 'bopSource: (setup.bopSystem && find(bopProfiles || [], setup.bopSystem)) || null,'));
  assert(has(race, 'bopSource || state.settings,'));
  assert(has(race, 'Tokens.settingsOf(tokenSource || state.settings)'));
  assert(has(code('transfer.js'), "field('bopSystem', 'bopsystems');"));
  assert(has(code('transfer.js'), "field('tokenSystem', 'tokensystems');"));
  assert(has(code('race-read.js'), "bopsystems: 'bopSystem',"));
  assert(code('contentpacks.js').includes("'bopsystems'") && code('server.js').includes("'tokensystems'"));
  assert(has(code('renderer/bopui.js'), "await Profiles.save('bop', patch);"));
  assert(has(code('renderer/tokenui.js'), "await Profiles.save('tokens', patch);"));
});
