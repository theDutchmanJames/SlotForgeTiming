'use strict';
// 2.4.0: the status lights of the main menu (renderer/racecheck.js, mainbar.js, SlotForgeRestyle.md "Status Lights"): Timing · Next race · Sharing,
// red to fix, amber to know, green ready; the drop-down with the check before the start. And the Setup Sheet of the race setup form: the six kinds,
// the new sections, Track Call and the start lights together.
const test = require('node:test'),
  assert = require('node:assert/strict');
const RC = require('../renderer/racecheck.js'),
  HS = require('../renderer/homestats.js'),
  SW = require('../renderer/setupwords.js');
const { code, has } = require('./source.cjs');

const chips = o => HS.chips({ hardware: 'none', netOn: true, hasSetup: true, drivers: 34, cars: 62, tracks: 9, ...o });
const next = o => ({ hasSetup: true, setupName: 'Check race', issues: [], entries: 4, lanes: 4, trackName: 'Club Oval', systems: ['Penalties'], layoutName: 'Default layout', audioName: 'Club voice', names: 'Anna, Bjorn', ...o });

test('the next race: what must be fixed first (red, Start stays off), then what is good to know, then what is ready', () => {
  const c = RC.build({ ...next({ issues: ['A car is used more than once.', 'Every heat needs at least one human driver. Adjust the heat plan.'], audioName: '' }), chips: chips() });
  const race = c.sections.find(s => s.key === 'race');
  assert.deepEqual(
    race.items.map(x => x.level),
    ['bad', 'bad', 'warn', 'ok', 'ok', 'ok'],
    'bad first, then warn, then ok'
  );
  assert.equal(race.items[0].title, 'A car is used more than once.');
  assert.deepEqual(race.items[0].fix, { go: 'home', label: 'Choose a car' });
  assert.deepEqual(race.items[1].fix, { go: 'home', label: 'Adjust the plan' });
  assert.equal(race.note, 'Not ready: 2 to fix');
  assert.equal(race.title, 'Next race · Check race');
  assert.equal(c.ready, false);
  assert.equal(c.lights.race, 'bad');
  assert(!race.items.some(x => /^Drivers and cars/.test(x.title)), 'a problem with the drivers or cars: no tick for them');
  // all fine: ticks, the audio set, Ready to start
  const ok = RC.build({ ...next(), chips: chips() });
  assert.equal(ok.sections[0].note, 'Ready to start');
  assert.equal(ok.lights.race, 'ok');
  assert.deepEqual(
    ok.sections[0].items.map(x => x.title),
    ['Drivers and cars on all 4 lanes', 'Club Oval · 4 lanes', 'Race systems ready', 'Race screen', 'Audio set']
  );
  // no audio set: amber, still ready
  const amber = RC.build({ ...next({ audioName: '' }), chips: chips() });
  assert.deepEqual([amber.lights.race, amber.ready, amber.sections[0].note], ['warn', true, 'Ready to start · 1 to know']);
  // a race that is on, and no setup at all
  assert.equal(RC.build({ raceOn: true, chips: chips() }).sections[0].title, 'This race');
  assert.equal(RC.build({ chips: chips() }).sections[0].items[0].title, 'No race setup chosen');
});

test('timing and sharing: no hardware is red, connected is green; results waiting are amber; the database counts along the bottom', () => {
  const none = RC.build({ ...next(), chips: chips() });
  assert.equal(none.lights.timing, 'bad');
  assert.deepEqual(none.sections[1].items[0].fix, { go: 'hardware', label: 'Choose hardware' });
  assert.equal(none.sections[1].note, 'Not counting laps');
  const tm = RC.build({ ...next(), chips: chips({ hardware: 'trackmate', trackmate: true }) });
  assert.deepEqual([tm.lights.timing, tm.sections[1].items[0].title, tm.sections[1].note], ['ok', 'Trackmate connected', 'Counting laps']);
  assert.deepEqual(tm.sections[1].items[0].fix, { go: 'sensors', label: 'Test sensors' });
  const unused = RC.build({ ...next(), chips: chips({ hardware: 'trackmate', trackmate: true, unused: ['DS Electronics'] }) });
  assert.equal(unused.sections[1].items[1].level, 'warn');
  const lib = RC.build({ ...next(), chips: chips({ libraryWaiting: 9 }) });
  assert.deepEqual([lib.lights.sharing, lib.sections[2].note], ['warn', '9 results to send']);
  assert.equal(RC.build({ ...next(), chips: chips() }).lights.sharing, 'ok');
  assert.equal(RC.build({ ...next(), chips: chips({ netOn: false }) }).lights.sharing, 'off', 'sharing that is off is a choice: grey, not red');
  assert.equal(lib.foot, '34 drivers · 62 slotcars · 9 tracks');
});

test('the button of the main menu and its drop-down', () => {
  const c = RC.build({ ...next({ audioName: '' }), chips: chips({ libraryWaiting: 2 }) });
  const btn = RC.lightsHtml(c, false);
  assert.match(btn, /^<button type="button" class="mb-st" id="mb-st" aria-haspopup="dialog" aria-expanded="false"/);
  assert.deepEqual(
    [...btn.matchAll(/<i class="([a-z]+)"/g)].map(m => m[1]),
    ['bad', 'warn', 'warn'],
    'Timing, Next race, Sharing'
  );
  assert.match(btn, /aria-label="Status: Timing: needs you, Next race: good to know, Sharing: good to know"/);
  const panel = RC.panelHtml(c);
  assert.deepEqual(
    [...panel.matchAll(/data-sec="([a-z]+)"/g)].map(m => m[1]),
    ['race', 'timing', 'sharing']
  );
  assert.match(panel, /<li class="warn"><i aria-hidden="true">i<\/i><span>No audio set<small>Nothing is announced during the race<\/small><\/span><button type="button" class="btn" data-st-go="setup">Choose one<\/button><\/li>/);
  assert.match(panel, /<div class="mbs-foot"><span>34 drivers · 62 slotcars · 9 tracks<\/span>/);
  const mb = code('renderer/mainbar.js'),
    home = code('renderer/landing.js');
  assert(has(mb, 'const c = statusNow(list);') && has(mb, 'openStatus: () => toggleStatus(true)'));
  assert(has(home, 'state.raceCheckInput = {') && has(home, 'data-open-status'), 'Home tells the lights what it sees, and the pill opens them');
  assert(!home.includes('id="hm-chips"'), 'the strip of chips is in the drop-down now');
  assert(code('renderer/styles.css').includes('html #hmc-start{margin-bottom:16px}'), 'the start card keeps its gap to the cards under it');
});

test('the Setup Sheet: six kinds, the Race card is one race, Heats and Endurance are kinds; the sections of the rail; Track Call and the lights together', () => {
  assert.deepEqual(
    SW.PICKER.kinds.map(k => k[0]),
    ['practice', 'qualifying', 'race', 'heats', 'endurance', 'tokens']
  );
  assert.deepEqual(SW.pick({ sessionType: 'heats' }, { kind: 'race' }), { sessionType: 'race' }, 'Race on a heat setup is one race now');
  assert.equal(SW.pick({ sessionType: 'race' }, { kind: 'heats' }).sessionType, 'heats');
  assert.equal(SW.pick({ sessionType: 'practice' }, { kind: 'endurance' }).sessionType, 'endurance');
  const S = require('../schema.js').racesetups;
  assert.deepEqual(
    S.rail.map(r => r.id + ':' + r.groups.join('+')),
    ['race:session+length', 'heats:heats+scoring', 'start:lights+start+call', 'endurance:endurance', 'rules:rules', 'screens:screens', 'service:service', 'advanced:trackmate+box']
  );
  const groupOf = k => S.fields.find(f => f.key === k).group;
  assert.deepEqual(['lightsMin', 'lightsMax'].map(groupOf), ['lights', 'lights']);
  assert.deepEqual(['trackCallAction', 'trackCallYellowPower', 'trackCallRedPower', 'trackcallWindow'].map(groupOf), ['call', 'call', 'call', 'call']);
  assert.deepEqual(['points', 'countBy', 'finals'].map(groupOf), ['scoring', 'scoring', 'scoring'], 'the scoring of heats is with the heats');
  assert.equal(groupOf('pitHold'), 'service');
  const r = SW.rail({ sessionType: 'race', name: 'Club', laps: 50, lightsMin: 1, lightsMax: 5, trackCallAction: 'yellowred' }, { track: { name: 'Club Oval' } });
  assert.equal(r.start.rail, 'Lights 1–5 s · Track Call yellow, then red');
  assert.match(r.race.rail, /^Race · one race · 50 laps/);
  const db = code('renderer/database.js');
  assert(has(db, "e === 'racesetups' ? 'This race in one line' : 'In plain words'"), 'a race setup in one line, with chips');
  assert(has(db, "slot.innerHTML = '<span>On at the start</span>';"), 'a system and its switch on one row');
  assert(has(db, 'data-trackpick') && has(db, 'data-quick-key'), 'the tracks as cards, quick picks for the length');
});
