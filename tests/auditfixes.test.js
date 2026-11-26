'use strict';
// The fixes of the app-wide audit of 26 November 2026 (docs/audit-2026-11-26.md): each test names the finding it covers.
const test = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  os = require('node:os'),
  path = require('node:path');
const { code, has } = require('./source.cjs');

test('SQLite: after the worker crashed, the next request starts a new worker and opens the same database again', async t => {
  const Database = require('../db'),
    Client = require('../sqlite-client'),
    { migrateCopy } = require('../sqlite-migration'),
    { forkCopy } = require('../sqlite-working');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'timing-revive-')),
    db = new Database(path.join(dir, 'source.json'));
  db.data.tracks = [{ id: 't', name: 'Circuit', lanes: 2 }];
  db.data.drivers = [{ id: 'd', name: 'James' }];
  db.data.slotcars = [{ id: 'c', model: 'GT3' }];
  db.saveNow();
  const copy = path.join(dir, 'copy'),
    work = path.join(dir, 'working');
  migrateCopy({ source: db.file, destination: copy });
  forkCopy(copy, work);
  const client = new Client();
  t.after(async () => {
    await client.close();
    await db.writesIdle();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  const ask = () =>
    client.raceInputs({ trackId: 't', championship: false, setup: { sessionType: 'race' }, rows: [{ driverId: 'd', carId: 'c' }] });
  await client.openWorking(work);
  const before = await ask();
  await client.worker.terminate(); // (a crash: the worker is gone)
  await new Promise(r => setTimeout(r, 50));
  assert(client.failure, 'the crash is seen');
  assert.deepEqual(await ask(), before, 'the next request works, on the same database');
  assert.equal(client.failure, null);
});

test('Resume asks the timing hardware about the lanes of the race that was interrupted', () => {
  assert(
    has(
      code('renderer/landing.js'),
      "if (b.id === 'resumego' && !(await timingReady(Math.floor(Number(resume.race.track && resume.race.track.lanes)) || (resume.race.rows || []).length))) return;"
    )
  );
});

test('the Arduino pit sensor works on the lane chosen for it in Lane Check, for the stop and for the hold', () => {
  global.window = undefined;
  const P = require('../renderer/pitsensors.js');
  const seen = [];
  const listeners = [];
  const link = { connected: true, pitCovered: [true, false], pitMap: [1, 0], on: f => (listeners.push(f), () => {}) };
  const eng = { cars: [{ lane: 0 }, { lane: 1 }], pitSensor: (i, on) => seen.push([i, on]) };
  const ps = (P.bind || (globalThis.PitSensors && globalThis.PitSensors.bind))({
    link,
    hardware: 'arduino',
    eng: () => eng,
    now: () => 1,
    map: () => [0, 1]
  });
  listeners[0]({ type: 'pit', pit: 0, lane: 1, in: true, at: 1 });
  assert.deepEqual(seen.at(-1), [1, true], 'sensor 0 set to lane 2: the car on lane 2');
  if (ps && ps.sync) ps.sync();
});

test('two copies of the app share the backup folder: each keeps its own newest automatic backups and leaves the other one alone', async () => {
  const AB = require('../auto-backup.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sf-twocopies-')),
    folder = path.join(dir, 'backups');
  let t = Date.parse('2026-11-01T19:00:00Z');
  const copy = name =>
    AB.createAutoBackup({
      settings: () => ({ autoBackup: { keep: 2, folder } }),
      defaultFolder: folder,
      stateFile: path.join(dir, name + '-state.json'),
      now: () => t,
      make: async target => fs.writeFileSync(target, name)
    });
  const a = copy('installed'),
    b = copy('portable');
  for (let k = 0; k < 4; k++) {
    await a.run('scheduled');
    t += 1000;
    await b.run('scheduled');
    t += 1000;
  }
  const left = fs.readdirSync(folder).map(n => fs.readFileSync(path.join(folder, n), 'utf8'));
  assert.equal(left.filter(x => x === 'installed').length, 2, 'the installed app keeps its 2');
  assert.equal(left.filter(x => x === 'portable').length, 2, 'the portable app keeps its 2');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('importing races that are already here skips them, so the same file twice does not double every race', () => {
  const T = code('renderer/transferui.js');
  assert(has(T, "(unseen.has(m) || (m.e === 'sessions' && m.how === 'id') ? 'skip'"));
  assert(has(T, 'already here</b> and skipped'));
});

test('Solo and the second screen: the slips of 2.5.1 and 2.5.2', () => {
  const So = require('../renderer/engine/solo.js');
  assert.equal(So.effective({ sessionType: 'solo', fuelRules: 'f', multiClass: 'm' }).fuelRules, '', 'no race systems in Solo');
  assert(has(code('renderer/database/views.js'), "['solo', 'Solo']"), 'the Solo filter on Race Setups');
  assert(has(code('renderer/database/views.js'), "solo: 'driver'"), 'and its picture');
  assert(has(code('renderer/setupwords.js'), "solo: 'Solo', race: 'Race' }[p.kind]"), 'the note on the side list');
  assert(has(code('renderer/timing.js'), "sessionLabel[(S.setup.solo && 'solo') ||"), 'the race type text');
  assert(has(code('renderer/database/results.js'), "SESSION_LABEL[s.solo ? 'solo' : s.sessionType]"), 'the results list');
  assert(has(code('renderer/championship.js'), "'a Solo session' : 'a Time Token Session'"));
  assert(
    has(code('renderer/race.js'), 'solo && eng.cars.find(c => c.driverId === x.driverId && eng.lapsOf(c) === x.laps && c.best === x.best)'),
    'Race over: the lane of each Solo row'
  );
  const W = require('../renderer/widgets.js');
  const [copy] = W.duplicateWidgets([{ id: 'a', type: 'laptime', lane: 0, follow: true, x: 0, y: 0, w: 10, h: 10 }], null, 1000, 1000);
  assert.equal(copy.lane, 1);
  assert.equal('follow' in copy, false, 'a copy for the next lane is not Followed');
  const lv = code('renderer/liveview.js');
  assert(
    has(lv, "if (second && page === 'home' && live()) return go('timing');"),
    'the second screen leaves Home when the race data arrives later'
  );
  assert(has(lv, 'api.onSettingsChanged(() => {'), 'and follows the theme');
  assert(has(code('main.js'), "liveWin.webContents.send('settings:changed');"));
});
