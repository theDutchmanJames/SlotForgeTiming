'use strict';
// 2.4.0: the Garage lists of the Database (renderer/garage.js, database/manager.js, database/garageactions.js, SlotForgeRestyle.md "Garage") and the
// Build Sheet of a car (renderer/paddockshared.js, schema.js slotcars rail): drawn cars, helmets and tracks instead of letter tiles, figures from the races,
// filters and sorts, the list with ticks, retire and merge, a club list from CSV, the gearing worked out, the service log.
const test = require('node:test'),
  assert = require('node:assert/strict');
const G = require('../renderer/garage.js');
const { code, has } = require('./source.cjs');

const sessions = [
  {
    date: '2026-11-01T19:00:00Z',
    sessionType: 'race',
    trackId: 't1',
    standings: [
      { pos: 1, driverId: 'd1', carId: 'c1', driverName: 'Anna Andersson', best: 4652, laps: 20 },
      { pos: 2, driverId: 'd2', carId: 'c2', driverName: 'Bjorn', best: 4701, laps: 20 }
    ]
  },
  {
    date: '2026-11-12T19:00:00Z',
    sessionType: 'qualifying',
    trackId: 't1',
    standings: [{ pos: 1, driverId: 'd2', carId: 'c1', driverName: 'Bjorn', best: 4590, laps: 5 }]
  },
  {
    date: '2026-11-13T19:00:00Z',
    sessionType: 'race',
    trackId: 't2',
    standings: [{ pos: 1, driverId: 'd1', carId: 'c2', best: 6000, laps: 10, dq: true }]
  }
];

test('the figures from the races: races, wins (a race, not qualifying, not disqualified), the best lap, last raced; a track record and its holder', () => {
  const s = G.statsOf(sessions);
  assert.deepEqual([s.drivers.get('d1').races, s.drivers.get('d1').wins, s.drivers.get('d1').best], [2, 1, 4652]);
  assert.deepEqual([s.drivers.get('d2').races, s.drivers.get('d2').wins, s.drivers.get('d2').best], [2, 0, 4590]);
  assert.equal(s.cars.get('c1').last, '2026-11-12T19:00:00Z');
  assert.deepEqual([s.tracks.get('t1').races, s.tracks.get('t1').best, s.tracks.get('t1').holder], [2, 4590, 'Bjorn']);
  assert.equal(G.lap(4590), '4.590');
  assert.equal(G.lap(64590), '1:04.590');
  assert.equal(G.short('Anna Andersson'), 'Anna A.');
});

test('a car is drawn in its livery with its number; a driver gets a helmet in their colour; a track is drawn with its lanes', () => {
  assert.deepEqual(G.carColors({ id: 'x' }, ['#1f6feb', '#f5c211']), ['#1f6feb', '#f5c211']);
  assert.equal(G.carColors({ id: 'x', livery: 'Gulf blue with orange' })[0], '#1f6feb');
  assert.equal(G.carColors({ id: 'x' }, ['#ffffff'])[1], '#22262c', 'a dark stripe on a white car');
  assert.equal(G.numberOf({ name: 'BRM Chevron B19 #18' }, 'BRM Chevron B19 #18'), '18');
  assert.equal(G.numberOf({ number: '7' }, 'Car #18'), '7');
  const svg = G.carSvg(['#1f6feb', '#f5c211'], '18', 'c1');
  assert.match(svg, /<svg[^>]+class="gx-carsvg"/);
  assert.match(svg, />18<\/text>/);
  assert.equal((G.trackSvg(4).match(/stroke-width="1.8"/g) || []).length, 4, 'a lane per lane');
  assert.equal((G.trackSvg(12).match(/stroke-width="1.8"/g) || []).length, 8, 'at most 8');
  assert.equal(G.helmetOf({ color: '#3b82f6' }), 2, 'the lane colour picks its helmet');
  assert.equal(G.helmetOf({ color: '#3a80f0' }), 2, 'the nearest lane colour');
  assert.ok(G.helmetOf({ id: 'any' }) >= 1 && G.helmetOf({ id: 'any' }) <= 8);
});

const ctx = (o = {}) => ({
  title: i => i.name,
  stat: () => null,
  laps: i => i.lapsDriven || 0,
  due: i => !!i.due,
  archived: i => !!i.archived,
  className: () => '',
  colors: () => undefined,
  dist: n => n + ' m',
  ...o
});

test('the filters with their counts, and the sorts', () => {
  const cars = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B', due: true },
    { id: 'c', name: 'C', availability: 'Out for repair' },
    { id: 'd', name: 'D', archived: true }
  ];
  const f = G.filters('slotcars', cars, ctx());
  assert.deepEqual(
    f.map(x => [x.id, x.n]),
    [
      ['all', 4],
      ['ready', 2],
      ['due', 1],
      ['off', 1],
      ['archived', 1]
    ]
  );
  assert.deepEqual(
    G.filterItems('slotcars', 'ready', cars, ctx()).map(i => i.id),
    ['a', 'b']
  );
  const drivers = [
    { id: '1', name: 'A' },
    { id: '2', name: 'B', retired: 'retired' },
    { id: '3', name: 'C', driverType: 'virtual' }
  ];
  assert.deepEqual(
    G.filters('drivers', drivers, ctx()).map(x => [x.id, x.n]),
    [
      ['racing', 1],
      ['virtual', 1],
      ['retired', 1],
      ['all', 3]
    ]
  );
  const tracks = [
    { id: 'x', lanes: 2 },
    { id: 'y', lanes: 4 },
    { id: 'z', lanes: 4 }
  ];
  assert.deepEqual(
    G.filters('tracks', tracks, ctx()).map(x => x.label),
    ['All', '2 lanes', '4 lanes']
  );
  assert.equal(G.filterItems('tracks', 'lanes4', tracks, ctx()).length, 2);
  const st = { a: { wins: 1, best: 5000 }, b: { wins: 3, best: 4800 }, c: { wins: 0 } };
  const c2 = ctx({ stat: i => st[i.id] });
  assert.deepEqual(
    G.sortItems('slotcars', 'best', cars.slice(0, 3), c2).map(i => i.id),
    ['b', 'a', 'c']
  );
  assert.deepEqual(
    G.sortItems('drivers', 'wins', [{ id: 'a' }, { id: 'c' }, { id: 'b' }], c2).map(i => i.id),
    ['b', 'a', 'c']
  );
  assert.equal(G.sortItems('drivers', 'name', drivers, c2), drivers, 'name keeps the order of the database');
});

test('a card: the drawing, badges, the line over the name, three figures, Edit and More (no red on the card)', () => {
  const car = { id: 'c1', name: 'BRM Chevron B19 #18', maker: 'Thunderslot', scale: '1:32', lapsDriven: 1204, due: true };
  const html = G.cardHtml(
    'slotcars',
    car,
    ctx({ stat: () => ({ best: 4812, last: '2026-11-12T19:00:00Z', races: 3 }), className: () => 'Sports 70' })
  );
  assert.match(html, /^<article class="gx-card" data-view="c1"/);
  assert.match(html, /gx-carsvg/);
  assert.match(html, /<span class="gx-badge l">Sports 70<\/span>/);
  assert.match(html, /gx-badge r due/);
  assert.match(html, /<span class="gx-eye">Thunderslot · 1:32<\/span><h3>BRM Chevron B19 #18<\/h3>/);
  assert.match(html, /<small>Laps<\/small><b class="">1,204<\/b>/);
  assert.match(html, /<small>Best<\/small><b class="fl">4.812<\/b>/);
  assert.match(html, /data-edit="c1"/);
  assert.match(html, /data-more="c1" aria-haspopup="menu"/);
  assert.doesNotMatch(html, /danger|Archive…|data-del/);
  const d = G.cardHtml(
    'drivers',
    { id: 'd1', name: 'Anna', callsign: 'ANN', flag: 'se', retired: 'retired' },
    ctx({ stat: () => ({ races: 23, wins: 7, best: 4652 }) })
  );
  assert.match(d, /avatars\/Lane\d\.png/);
  assert.match(d, /<b class="">ANN<\/b><span class="gx-flag"><span class="fi fi-se"><\/span>SE<\/span>/);
  assert.match(d, /gx-badge l off">Retired/);
  assert.match(d, /7 wins · 30 %/);
  assert.match(
    G.cardHtml(
      'tracks',
      { id: 't', name: 'Club Oval', lanes: 4, length: 24.6 },
      ctx({ most: 't', stat: () => ({ best: 4590, holder: 'Erik Lund', races: 61 }) })
    ),
    /Raced most.*Record.*4\.590.*Erik L\./s
  );
  const row = G.rowHtml('slotcars', car, ctx(), { picked: true, cells: ['GT'] });
  assert.match(row, /class="gx-tr sel"/);
  assert.match(row, /data-pick="c1" aria-label="Choose BRM Chevron B19 #18" checked/);
  assert.match(row, /<span class="x">GT<\/span>/);
  assert.match(G.bulkHtml('slotcars', 2, { direct: true }), /2 chosen.*data-bulk="class".*data-bulk="service".*data-bulk="archive"/);
  assert.match(G.bulkHtml('drivers', 1), /data-bulk="retire".*data-bulk="unretire"/);
  assert.equal(G.bulkHtml('drivers', 0), '');
  assert.match(G.emptyHtml('teams'), /No teams yet.*Add a team/s);
  assert.match(G.emptyHtml('drivers'), /data-gx-import/);
  assert.match(G.emptyHtml('drivers', { searching: 'zz', plural: 'drivers' }), /No drivers match “zz”/);
  const strip = G.stripHtml({
    e: 'slotcars',
    label: 'slot car',
    plural: 'slotcars',
    filters: G.filters('slotcars', [car], ctx()),
    filter: 'all',
    sort: 'laps',
    mode: 'grid'
  });
  assert.match(strip, /id="add">.*Add slot car/s);
  assert.match(strip, /data-catalogue-search/);
  assert.match(strip, /<option value="laps" selected>Most laps<\/option>/);
  assert.match(strip, /id="vgrid" aria-pressed="true"/);
  assert.match(strip, /data-gx-page-more/);
});

test('the gearing worked out: ratio, one motor turn, top speed in theory', () => {
  const g = G.gearing({ pinion: 12, gear: 36, rearDiameter: 20.5, ratedRpm: 21000 }, '1:32');
  assert.equal(g.ratioText, '3.00 : 1');
  assert.equal(g.perText, '21.5 mm');
  assert.equal(g.kmhText, '27 km/h');
  assert.equal(g.scaleText, '866 km/h at scale');
  assert.equal(G.gearing({ gearing: '11:33' }).ratioText, '3.00 : 1', 'a typed gearing');
  assert.equal(G.gearing({}), null);
  assert.equal(G.gearing({ pinion: 12, gear: 36 }).perText, '', 'no tyre size: no distance');
});

test('a club list from a CSV file: columns by name, the same name skipped, callsigns and countries', () => {
  const csv = '﻿Name;Nickname;Callsign;Country\n"Anna Andersson";Flash;ann;SE\nBjorn;;bjo1;Norway\nAnna Andersson;;;\n;;;\nBob;;;\n';
  const r = G.roster(csv, [{ name: 'bob' }], [['NO', 'Norway']]);
  assert.deepEqual(r.drivers, [
    { name: 'Anna Andersson', nickname: 'Flash', callsign: 'ANN', flag: 'SE' },
    { name: 'Bjorn', callsign: 'BJO', flag: 'NO' }
  ]);
  assert.deepEqual(
    r.skipped.map(s => s.why),
    ['twice in the file', 'already in the database']
  );
  const plain = G.roster('Chris Hale,Hammer\nDana Ruiz\n');
  assert.deepEqual(
    plain.drivers.map(d => d.name),
    ['Chris Hale', 'Dana Ruiz'],
    'no header: name, nickname, callsign, country'
  );
  assert.deepEqual(G.roster('First name,Last name\nErik,Lund\n').drivers, [{ name: 'Erik Lund' }]);
  assert.deepEqual(G.parseCsv('a,"b ""c""",d\r\n1,2,3'), [
    ['a', 'b "c"', 'd'],
    ['1', '2', '3']
  ]);
  assert.deepEqual(
    G.lookAlikes({ id: '1', name: 'Anna A.' }, [
      { id: '1', name: 'Anna A.' },
      { id: '2', name: 'Anna' },
      { id: '3', name: 'Bob' }
    ]).map(d => d.id),
    ['2']
  );
  const log = G.logAdd([{ date: '2026-10-02', note: 'old' }], { date: '2026-11-19', note: 'New braids', laps: 164 });
  assert.deepEqual(
    log.map(x => x.note),
    ['New braids', 'old']
  );
});

test('the page: Garage lists in the manager, the menus, retire and merge; the Build Sheet of a car; retired drivers not offered on Home', () => {
  const m = code('renderer/database/manager.js'),
    a = code('renderer/database/garageactions.js'),
    p = code('renderer/paddockshared.js'),
    html = code('renderer/index.html');
  assert(has(m, "const garage = typeof Garage !== 'undefined' && VIEW_ENTITIES.includes(e);"));
  assert(has(m, "Garage.statsOf(await api.list('sessions').catch(() => []))"), 'the figures come from the saved races');
  assert(has(m, 'garageMenu(b, garageCardMenu(e, it, direct), act => gxAct(act, it))'));
  assert(has(m, "if (act === 'merge') return gxTry(async () => garageMerge(it, await referenceList('drivers')), 'merge the drivers');"));
  assert(has(a, 'const r = await api.mergeDrivers(from.id, v);'));
  assert(has(a, "await api.update('drivers', i.id, { retired: retired ? 'retired' : '' });"));
  assert(
    has(a, 'state.settings = await api.setSettings({ garage: { ...g, cars } });'),
    'livery colours and the service log are kept by Timing'
  );
  assert(html.indexOf('garage.js') < html.indexOf('database/manager.js') && html.includes('database/garageactions.js'));
  assert(has(p, "d.className = 'paddock-dialog shared-car-dialog bs-dialog';"));
  assert(has(p, 'data-bs-calc') && has(p, 'data-look') && has(p, 'data-avail') && has(p, 'opts.copyOf'));
  assert(has(p, '<details class="bs-more"><summary class="btn">More</summary>'), 'Archive, Reload and Save history under More');
  assert(has(code('renderer/landing.js'), "allDrivers.filter(d => d.driverType !== 'virtual' && !d.retired)"));
  const S = require('../schema.js');
  assert.deepEqual(
    S.slotcars.rail.map(r => r.id),
    ['basics', 'technical', 'pictures', 'stats']
  );
  assert(['color', 'retired'].every(k => S.drivers.fields.some(f => f.key === k)));
  assert(['number', 'availability', 'colour'].every(k => S.slotcars.fields.some(f => f.key === k)));
  assert(has(code('renderer/database.js'), 'track.picture'), 'a track photo shows on its card in the race setup');
});
