'use strict';
// 2.4.0: the Track, Driver and Team editors as sheets (renderer/database/sheets.js, schema.js rails, database.js, SlotForgeRestyle.md "Track Sheet", "Driver
// Sheet", "Team Sheet"): the words of the header and the rail, the lane strip instead of a list of lengths, a box per sector name, the record from the saved
// results, the More menu, the question when a driver is deleted (Retire or Merge first, the name typed), and lane boxes in a race setup.
const test = require('node:test'),
  assert = require('node:assert/strict');
global.Speed = require('../renderer/speed.js');
const S = require('../renderer/database/sheets.js');
const schema = require('../schema.js');
const { code, has } = require('./source.cjs');

const oval = {
  name: 'Club Oval',
  lanes: 4,
  scale: '1:32',
  length: 24.5,
  laneModifier: 'bends',
  laneSpacing: 100,
  netTurns: 1,
  outsideLane: 'last'
};

test('the lane strip: every lane worked out from the bends, the difference to the longest, the sentence', () => {
  const { rows, top, low } = S.laneRows(oval);
  assert.deepEqual(
    rows.map(r => [r.lane, Math.round(r.len * 100) / 100, r.from]),
    [
      [0, 22.62, 'worked out'],
      [1, 23.24, 'worked out'],
      [2, 23.87, 'worked out'],
      [3, 24.5, 'the track length']
    ]
  );
  assert.equal(Math.round((top - low) * 100) / 100, 1.88);
  assert.equal(S.laneSay(oval), 'Lane 1 is 1.88 m shorter than lane 4: over a 20-lap race a car in lane 1 drives 37.70 m less.');
  assert.equal(S.laneSay({ ...oval, laneModifier: 'none' }), 'Every lane is 24.50 m.');
  assert.equal(S.laneSay({ lanes: 2 }), 'Give the track a length to get speeds and distances.');
  const measured = S.laneRows({ ...oval, laneModifier: 'measured', laneLengths: '22.4, , 23.9' });
  assert.deepEqual(
    measured.rows.map(r => [r.len, r.from]),
    [
      [22.4, 'measured'],
      [24.5, 'the track length'],
      [23.9, 'measured'],
      [24.5, 'the track length']
    ]
  );
  const html = S.stripHtml({ ...oval, laneModifier: 'measured' }, {}, ['22.4', '23.1']);
  assert(html.includes('data-ts-lane="0" value="22.4"') && html.includes('data-ts-lane="3" value=""'), 'measured: a box per lane');
  assert(S.stripHtml(oval, {}).includes('22.62 m<small>worked out</small>'));
});

test('the header and the rail of a track, a driver and a team', () => {
  const d = S.describe('tracks', { ...oval, sectors: 3 }, {});
  assert.deepEqual(
    d.pills.map(p => p.text),
    ['4 lanes', '1:32', '22.62 m – 24.50 m', '3 sectors']
  );
  assert.deepEqual(d.ready, { ok: true, text: 'Ready to race' });
  assert.deepEqual(S.describe('tracks', { name: 'X', lanes: 2 }, {}).ready, { ok: false, text: 'Length not set' });
  const r = S.rail('tracks', { ...oval, sectors: 3, sectorNames: 'Start, Hairpin', minLap: 2, deslotTime: 5 }, {});
  assert.equal(r.sectors.rail, '3 sectors · 2 named');
  assert.equal(r.laps.rail, 'min 2 s · deslot 5 s');
  assert.equal(r.length.rail, '22.62 m – 24.50 m');
  const dr = S.describe(
    'drivers',
    { name: 'Anna', callsign: 'ann', flag: 'NL', retired: 'retired' },
    { country: c => (c === 'NL' ? 'Netherlands' : '') }
  );
  assert.deepEqual(
    dr.pills.map(p => p.text),
    ['ANN', 'Netherlands']
  );
  assert.deepEqual(dr.ready, { ok: false, text: 'Retired' });
  assert.equal(dr.say.map(p => p.t).join(''), 'Anna shows as ANN on the timing tower.');
  assert.equal(
    S.rail('drivers', { name: 'Anna', driverType: 'virtual' }, {}).virtualrival.state,
    'todo',
    'a virtual driver needs its Rival Setup'
  );
  const tm = S.describe('teams', { name: 'QA Racing' }, { members: () => ['a', 'b'] });
  assert.equal(tm.pills[0].text, '2 drivers');
  assert.deepEqual(S.describe('teams', { name: 'QA Racing' }, { members: () => [] }).ready, { ok: false, text: 'No drivers yet' });
});

test('the record from the saved results: races, wins, best lap and its track, laps, track records', () => {
  const sessions = [
    {
      trackId: 't1',
      trackName: 'Club Oval',
      sessionType: 'race',
      date: '2026-10-01',
      standings: [
        { driverId: 'a', pos: 1, best: 5000, laps: 10, driverName: 'Anna' },
        { driverId: 'b', pos: 2, best: 5100, laps: 10, driverName: 'Bjorn' }
      ]
    },
    {
      trackId: 't2',
      trackName: 'Test Oval',
      sessionType: 'practice',
      date: '2026-09-01',
      standings: [{ driverId: 'a', pos: 1, best: 1206, laps: 4, driverName: 'Anna' }]
    },
    {
      trackId: 't1',
      trackName: 'Club Oval',
      sessionType: 'race',
      date: '2026-11-01',
      standings: [{ driverId: 'b', pos: 1, best: 5200, laps: 9 }]
    }
  ];
  assert.deepEqual(S.recordOf('drivers', 'a', sessions), {
    races: 2,
    wins: 1,
    best: 1206,
    bestTrack: 'Test Oval',
    laps: 14,
    first: '2026-09-01',
    records: 2,
    holder: ''
  });
  const t = S.recordOf('tracks', 't1', sessions);
  assert.equal(t.races, 2);
  assert.equal(t.best, 5000);
  assert.equal(t.holder, 'Anna');
  assert(S.recordHtml('drivers', 'Anna', S.recordOf('drivers', 'a', sessions)).includes('2 track records'));
  assert(S.recordHtml('drivers', 'Zed', S.recordOf('drivers', 'z', sessions)).includes('Zed has no saved race yet.'));
});

test('Delete a driver: what goes, Retire and Merge first, Delete only with the name typed', () => {
  const h = S.deleteDriverHtml('Anna', { races: 17, laps: 230, records: 2 });
  assert(
    h.includes('<h3>Delete Anna?</h3>') && h.includes('<small>Races</small><b>17</b>') && h.includes('<small>Track records</small><b>2</b>')
  );
  assert(h.indexOf('data-del-pick="retire"') < h.indexOf('data-del-pick="merge"'));
  assert(h.includes('data-del-pick="delete" disabled'));
  assert(S.nameMatches(' anna ', 'Anna') && !S.nameMatches('Ann', 'Anna') && !S.nameMatches('', ''));
  assert(!S.deleteDriverHtml('New', { races: 0, laps: 0, records: 0 }).includes(' disabled>'), 'a driver without results needs no name');
  const mgr = code('renderer/database/manager.js');
  assert(has(mgr, "if (pick === 'retire') return garageRetire([it], true);"));
  assert(has(mgr, 'manager.act = gxAct;'));
});

test('the sheets: rails in the schema, the controls over the fields, More, lane boxes in a race setup', () => {
  assert.deepEqual(
    schema.tracks.rail.map(x => x.id),
    ['basics', 'length', 'sectors', 'laps', 'extras']
  );
  assert.deepEqual(schema.tracks.used, { entity: 'racesetups', key: 'track' });
  assert.deepEqual(
    schema.drivers.rail.map(x => x.id),
    ['basics', 'personal', 'avatar', 'virtualrival']
  );
  assert.deepEqual(
    schema.teams.rail.map(x => x.id),
    ['basics', 'picture']
  );
  assert(
    S.moreHtml('drivers', { id: 'a' }).includes('data-sheet-act="merge"') &&
      S.moreHtml('drivers', { id: 'a', retired: 'retired' }).includes('Back to racing')
  );
  assert.equal(S.moreHtml('tracks', null), '', 'a new track has no More');
  assert(S.sectorsHtml(3, ['Start', 'Hairpin']).includes('data-ts-sector="1" value="Hairpin"'));
  assert(S.laneTilesHtml(4).includes('data-ts-lanes="4" aria-pressed="true"'));
  assert.equal(S.joinList(['15.4', '', '16', '', '']), '15.4, , 16');
  const db = code('renderer/database.js');
  assert(has(db, 'sheetUpdate = DbSheet.wire(dlg, e, {'));
  assert(has(db, "DbSheet.listBoxes(dlg, 'laneDistances', {"));
  assert(has(db, "DbSheet.listBoxes(dlg, 'swapMomentsDist', { grow: true,"));
  assert(has(code('renderer/systemsheet.js'), '.rsform:not(.sy):not(.ts-sheet)'));
  assert(has(code('renderer/index.html'), '<script src="database/sheets.js"></script>'));
});
