'use strict';
// 2.5.2 Solo: you alone on the track, one driver and one car, on any lane (renderer/engine/solo.js, schema.js soloSwitch, landing.js, race.js, liveview.js,
// editor.js Followed, report.js and database/results.js "By lane and car").
const test = require('node:test'),
  assert = require('node:assert/strict');
const So = require('../renderer/engine/solo.js');
const { code, has } = require('./source.cjs');

test('a Solo setup runs as a Free practice that knows it is solo', () => {
  assert.equal(So.on({ sessionType: 'solo' }), true);
  assert.equal(So.on({ sessionType: 'practice' }), false);
  const eff = So.effective({ sessionType: 'solo', name: 'Evening test', soloSwitch: 'auto', fuelRules: 'f1', penaltySystem: 'p1' });
  assert.equal(eff.sessionType, 'practice');
  assert.equal(eff.solo, true);
  assert.equal(eff.name, 'Evening test');
  assert.equal(eff.soloSwitch, 'auto');
  assert.equal(eff.fuelRules, '', 'audit 2026-11: a race system left from another kind is not used');
  assert.equal(eff.penaltySystem, '');
  assert.equal(So.on(So.effective({ sessionType: 'solo' })), true);
  const race = { sessionType: 'race' };
  assert.equal(So.effective(race), race, 'any other setup is given back as it is');
  assert.equal(So.auto({ soloSwitch: 'auto' }), true);
  assert.equal(So.auto({}), false, 'the button is the standard');
  const f = require('../schema.js').racesetups.fields;
  assert.deepEqual(
    f.find(x => x.key === 'sessionType').options.map(o => o[0]),
    ['practice', 'qualifying', 'race', 'heats', 'endurance', 'tokens', 'solo']
  );
  const sw = f.find(x => x.key === 'soloSwitch');
  assert.equal(sw.default, 'button');
  assert.deepEqual(sw.showIf, [{ sessionType: ['solo'] }]);
});

test('the lanes: the same driver and car on every lane, a lane switch goes round, a followed widget shows the lane the car is on', () => {
  assert.deepEqual(So.rows({ driverId: 'd1', carId: 'c1' }, 2), [
    { driverId: 'd1', carId: 'c1' },
    { driverId: 'd1', carId: 'c1' }
  ]);
  assert.equal(So.laneOf(1, 2), 1);
  assert.equal(So.laneOf(5, 2), 0, 'a lane the track does not have: lane 1');
  assert.equal(So.next(0, 2), 1);
  assert.equal(So.next(1, 2), 0);
  const lay = { name: 'Mine', widgets: [{ type: 'laptime', lane: 0, follow: true }, { type: 'laptime', lane: 1 }, { type: 'clock' }] };
  const on2 = So.layout(lay, 1);
  assert.deepEqual(
    on2.widgets.map(w => w.lane),
    [1, 1, undefined]
  );
  assert.equal(lay.widgets[0].lane, 0, 'the layout itself is not changed');
  const plain = { widgets: [{ type: 'laptime', lane: 0 }] };
  assert.equal(So.layout(plain, 1), plain, 'a layout without followed widgets is the same');
});

test('by lane and car: laps driven, the best and the average of the laps that count, and all laps together', () => {
  const t = So.table([
    {
      lane: 0,
      carId: 'c1',
      carName: 'NSR Mosler',
      laps: [9100, 9031, 15000, 9200],
      bad: [false, false, true, false],
      invalid: [],
      pitLaps: [],
      removed: []
    },
    { lane: 1, carId: 'c1', carName: 'NSR Mosler', laps: [9180, 9300], bad: [false, false], invalid: [1], pitLaps: [], removed: [] },
    { lane: 2, carId: 'c1', carName: 'NSR Mosler', laps: [], bad: [] }
  ]);
  assert.deepEqual(
    t.rows.map(r => [r.lane, r.laps, r.best, r.avg]),
    [
      [1, 4, 9031, 9110],
      [2, 2, 9180, 9180]
    ]
  );
  assert.deepEqual(t.all, { laps: 6, best: 9031, avg: 9128 });
  const h = So.tableHtml(
    t,
    s => String(s),
    ms => (ms / 1000).toFixed(3),
    'James, all laps'
  );
  assert(h.includes('<td>NSR Mosler</td><td>1</td><td>4</td><td>9.031</td><td>9.110</td>') && h.includes('<b>James, all laps</b>'));
});

test('Home, the race, the second screen and the results are wired', () => {
  const home = code('renderer/landing.js');
  assert(has(home, 'const solo = typeof Solo !== '));
  assert(has(home, 'data-solo-lane="${l}"'), 'the lane it starts on');
  assert(has(home, '...(solo ? { soloLane: soloStart } : {}),'));
  const race = code('renderer/race.js');
  assert(has(race, 'Solo.effective(Endurance.effective(r.setup))'));
  assert(has(race, 'if (live.soloSwitch) return live.soloSwitch();'), 'the call button switches the lane');
  assert(has(race, "if (k === 'tab' && live.soloSwitch) {"), 'and Tab');
  assert(has(race, 'if (live.soloLast >= 0) eng.cars[i].started = false;'), 'a lap never runs across a switch');
  assert(
    has(race, 'if (live.fsView && live.fsView.relayout) live.fsView.relayout(live.soloLayout());'),
    'the full screen view follows too'
  );
  assert(has(race, 'session.soloTable = Solo.table(eng.cars);'));
  assert(has(race, 'follow: solo ? live.soloLane : null,'), 'the second screen and the phones are told the lane');
  assert(has(code('renderer/liveshare.js'), 'follow: Number.isInteger(c.follow) ? c.follow : null,'));
  assert(has(code('renderer/liveview.js'), 'if (!nodes || fresh || follow !== followBuilt) {'));
  assert(has(code('renderer/editor.js'), 'data-lanebtn="follow"'));
  assert(has(code('renderer/database/results.js'), "'<h4>By lane and car</h4>' + Solo.tableHtml(s.soloTable"));
  const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  assert(html.includes('<script src="engine/solo.js"></script>'));
});
