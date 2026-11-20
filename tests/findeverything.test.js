'use strict';
// 2.4.0: Find (Ctrl K) reworked (renderer/findindex.js, mainbar.js, SlotForgeRestyle.md "Find Everything"): every kind of thing of the app, ranked by
// word and word start with a little room for typing errors, the things linked to the best match, a count per kind for the chips, the actions of each
// thing (Enter: the first), Recent and Do when nothing is typed.
const test = require('node:test'),
  assert = require('node:assert/strict');
const F = require('../renderer/findindex.js');
const { code, has } = require('./source.cjs');

const D = {
  drivers: [
    { id: 'a', name: 'Anna' },
    { id: 'b', name: 'Bjorn' }
  ],
  slotcars: [{ id: 'c1', name: 'BRM Chevron' }],
  tracks: [
    { id: 't', name: 'Club Oval', lanes: 4, laneLengths: '22.6, 24.5' },
    { id: 't2', name: 'Big Wood', lanes: 2, length: 15 }
  ],
  teams: [{ id: 'tm', name: 'QA Racing', drivers: ['a', 'b'] }],
  racesetups: [{ id: 'su', name: 'Check race', sessionType: 'race', track: 't' }],
  championships: [{ id: 'ch', name: 'Winter Cup', rounds: [{}, {}], roster: [{ driver: 'a' }] }],
  sessions: [
    {
      id: 's1',
      setupName: 'Check race',
      sessionType: 'race',
      trackId: 't',
      trackName: 'Club Oval',
      date: '2026-11-19T19:00:00Z',
      standings: [
        { pos: 2, driverId: 'b', driverName: 'Bjorn', carId: 'c1', laps: 10, best: 5100 },
        { pos: 1, driverId: 'a', driverName: 'Anna', carId: 'c1', laps: 10, best: 5000 }
      ]
    },
    {
      id: 's0',
      setupName: 'Club night',
      sessionType: 'race',
      trackId: 't2',
      trackName: 'Big Wood',
      date: '2026-10-01T19:00:00Z',
      standings: [{ pos: 1, driverId: 'b', driverName: 'Bjorn', laps: 8, best: 6000 }]
    }
  ],
  layouts: [{ id: 'l1', name: 'Club night TV', widgets: [{}] }],
  systems: [{ e: 'fuelrules', sub: 'fuel', label: 'Fuel System', list: [{ id: 'f1', name: 'Club fuel' }] }],
  help: [{ id: 'find', title: 'Find (Ctrl K)', note: 'Every driver' }],
  pages: [{ t: 'Tracks', w: 'Database', go: { tab: 'database', sub: 'tracks' } }],
  actions: [
    { id: 'backup', t: 'Back up now', w: 'Backups' },
    { id: 'add:drivers', t: 'Add a driver', w: 'Database' }
  ]
};
const items = F.build(D, { champ: () => ({ leader: 'Anna', driven: 1, next: 'Round 2' }) });
const titles = r => r.list.map(x => x.t);

test('every kind of thing is found, each with a line of facts', () => {
  const kinds = new Set(items.map(x => x.kind));
  ['driver', 'car', 'track', 'team', 'race', 'setup', 'champ', 'system', 'custom', 'help', 'page', 'do'].forEach(k =>
    assert(kinds.has(k), k)
  );
  const t = items.find(x => x.key === 'track:t');
  assert.equal(t.sub, '4 lanes · 22.6–24.5 m · best 5.000 Anna');
  assert.equal(t.kicker, 'Track · raced on 1 time');
  assert.equal(items.find(x => x.key === 'track:t2').sub, '2 lanes · 15 m · best 6.000 Bjorn', 'one length: the track length');
  assert.equal(items.find(x => x.key === 'driver:a').sub, 'Team QA Racing · 1 race · best 5.000');
  const race = items.find(x => x.key === 'race:s1');
  assert.match(race.sub, /^Thu 19 Nov · Club Oval · Anna won · 2 drivers$/);
  assert.deepEqual(race.facts[0], ['Winner', 'Anna']);
  assert.equal(race.setupId, 'su', 'the race setup of a race, by its name: Race it again');
  assert.equal(items.find(x => x.key === 'champ:ch').sub, '2 rounds · 1 driver · Anna leads · next Round 2');
  assert.equal(F.build({ tracks: [{ id: 'x', name: 'X', lanes: 2, length: 10 }] }, { unit: 'ft' })[0].sub, '2 lanes · 32.8 ft');
});

test('the best match first, with what is linked to it', () => {
  const r = F.search(items, 'club');
  assert.equal(r.best.t, 'Club Oval');
  assert.equal(r.list[0].g, 'Best match');
  assert.equal(r.list[1].g, 'Races on Club Oval');
  assert.equal(r.list[1].t, 'Check race');
  assert.equal(F.search(items, 'clb').best.t, 'Club Oval', 'the letters in order');
  assert.equal(F.search(items, 'anan').best.t, 'Anna', 'one letter wrong');
  const anna = F.search(items, 'anna');
  assert.deepEqual(
    anna.list.filter(x => x.g === 'With Anna').map(x => x.t),
    ['QA Racing', 'Winter Cup', 'Check race'],
    'a driver: the team, the championships and the races'
  );
  assert.deepEqual(
    F.search(items, 'qa racing')
      .list.filter(x => x.g === 'Drivers of QA Racing')
      .map(x => x.t),
    ['Anna', 'Bjorn']
  );
  assert.equal(F.search(items, 'nov').best.key, 'race:s1', 'a race by its month');
  assert.deepEqual(F.search(items, 'zzzz').list, []);
});

test('the chips: a count per kind, one kind at a time, the races of one thing', () => {
  const r = F.search(items, 'club');
  assert.equal(r.counts.track, 1);
  assert.equal(r.counts.custom, 1);
  assert.equal(r.counts.system, 1);
  assert(r.counts.all >= 6);
  assert.deepEqual(titles(F.search(items, 'club', { kind: 'custom' })), ['Club night TV']);
  const of = F.search(items, '', { of: { id: 'b', kind: 'driver', t: 'Bjorn' } });
  assert.deepEqual(titles(of), ['Check race', 'Club night'], 'newest first');
  assert.equal(of.list[0].g, 'With Bjorn');
  assert.deepEqual(
    titles(F.search(items, '', { kind: 'race' })),
    ['Check race', 'Club night'],
    'a chip with nothing typed lists all of its kind'
  );
});

test('nothing typed: Recent and Do; ">" only the things to do', () => {
  let recent = F.remember(
    [],
    items.find(x => x.key === 'track:t')
  );
  recent = F.remember(
    recent,
    items.find(x => x.key === 'driver:a')
  );
  recent = F.remember(
    recent,
    items.find(x => x.key === 'track:t')
  );
  recent = F.remember(recent, {
    kind: 'setting',
    key: 'setting:Club logo@Home',
    t: 'Club logo',
    w: 'App Settings',
    setting: { t: 'Club logo' }
  });
  recent.push({ key: 'driver:gone', kind: 'driver', t: 'Gone' });
  assert.equal(
    F.remember(
      recent,
      items.find(x => x.kind === 'do')
    ),
    recent,
    'a thing to do is not remembered'
  );
  const r = F.search(items, '', { recent });
  assert.deepEqual(
    r.list.filter(x => x.g === 'Recent').map(x => x.t),
    ['Club logo', 'Club Oval', 'Anna'],
    'the newest first, each once; a setting kept as it was; a record that is gone left out'
  );
  assert.deepEqual(
    r.list.filter(x => x.g === 'Do').map(x => x.t),
    ['Back up now', 'Add a driver']
  );
  assert.deepEqual(titles(F.search(items, '>', { recent })), ['Back up now', 'Add a driver']);
  assert.deepEqual(titles(F.search(items, '>add')), ['Add a driver']);
  assert.equal(F.remember([], null).length, 0);
  assert.equal(
    Array.from({ length: 12 }, (_, i) => i).reduce((l, i) => F.remember(l, { kind: 'page', key: 'p' + i, t: 'P' + i }), []).length,
    8
  );
});

test('the actions of each kind: Enter is the first', () => {
  const ids = k => F.actionsOf(items.find(x => x.key === k)).map(a => a.id);
  assert.deepEqual(ids('track:t'), ['edit', 'races', 'book']);
  assert.deepEqual(ids('driver:a'), ['edit', 'races', 'book']);
  assert.deepEqual(ids('race:s1'), ['open', 'again']);
  assert.deepEqual(ids('race:s0'), ['open'], 'no setup of that name: no Race it again');
  assert.deepEqual(ids('setup:su'), ['edit', 'home']);
  assert.deepEqual(ids('champ:ch'), ['standings', 'edit', 'home', 'races']);
  assert.deepEqual(ids('help:find'), ['open']);
  assert(F.near('anan', 'anna') && F.near('club', 'clubs') && !F.near('club', 'cart'));
  assert(F.inOrder('clb', 'club') && !F.inOrder('lcb', 'club'));
});

test('the panel: chips, the preview, the keys, and every action wired', () => {
  const mb = code('renderer/mainbar.js');
  assert(has(code('renderer/index.html'), '<script src="findindex.js"></script>'));
  assert(has(mb, 'res = F.search(index, query(), { kind, of, recent: readRecent(), settings: settingsOf(query()) });'));
  assert(has(mb, "if (ev.key === 'Tab') {"));
  assert(has(mb, "if (a.id === 'races') {"));
  assert(has(mb, "return to({ focusSession: x.id, resultsSub: x.tokens ? 'tokens' : 'racing', tab: 'database', sub: 'results' });"));
  assert(has(mb, "if (a.id === 'again') return raceWith({ lastSetupId: x.setupId, champId: null, champTag: null });"));
  assert(has(mb, "const r = await api.backupMake({ kind: 'hand', note: 'Made from Find' });"));
  assert(has(mb, 'Help.view().select(x.id);'));
  assert(has(mb, '<aside class="fd-pv" aria-live="polite"></aside>'));
  assert(has(code('renderer/helpview.js'), "'find',"), 'the Help article is in the navigation');
});
