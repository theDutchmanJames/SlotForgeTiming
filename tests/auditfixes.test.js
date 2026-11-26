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

test('the race: judged when stopped after the end, abort start, review kept, the break waits, restart lights, stopping kept, tokens saved in turn', () => {
  const eng = code('renderer/engine.js');
  assert(has(eng, "const judged = why !== 'Stopped' || !!R.timeUp || R.finished > 0;"));
  assert(has(eng, 'if (MAND && judged) msJudge(c, i, t);') && has(eng, 'if (P.dqUnserved && judged)'));
  const race = code('renderer/race.js');
  assert(has(race, 'function cancelStart() {') && has(race, 'red() { if (cancelStart()) return;'), 'R aborts the start');
  assert(has(race, 'checkpoint(true); // (audit 2026-11: every change of the review'));
  assert(has(race, 'if (l === 0 && dialogOpen()) return;'), 'no automatic start under an open question');
  assert(
    has(
      race,
      "if (live.phase === 'paused' && eng.flag === 'red' && setup.restartAfterRed !== 'resume' && !tokens) return restartCountdown();"
    )
  );
  assert(has(race, '...(live.stopping ? { stopping: true } : {})') && has(race, 'if (hs.stopping === true) live.stopping = true;'));
  assert(has(race, "live.phase = heats && heat.idx > 0 ? 'between' : 'ready'; // (audit 2026-11: heat 2"));
  assert(has(race, 'if (c && c.carId === carId) c.tyre = code;'), 'Swap Seats tyre');
  assert(has(race, 'Stop the event now?'));
  assert(has(race, 'live.tkWrites = (live.tkWrites || Promise.resolve())'), 'token clocks saved one after another');
  assert(has(race, 'The race could not be saved for recovery'));
  assert(has(race, "if (lapsOnly && box.dataset.hover === '1') {"), 'Review laps waits for the pointer');
});

test('hardware: power off when the device comes back in a fault, at the finish and in a pause; locks, watchdog, reboot, debounce, heartbeats', () => {
  const race = code('renderer/race.js');
  assert(has(race, 'if (back) power(false);'), 'power off at the moment the device comes back in a fault');
  assert(has(race, "live.phase = 'review'; power(false);"), 'power off after the finish');
  assert(has(race, "if (live.phase === 'paused' && eng.flag !== 'red') power(false);"), 'and during a pause');
  assert(has(race, 'if (speed === 1 && pressAt - callLast < 120) return;'), 'Track Call debounce');
  assert(has(race, 'The Trackmate did not take the power'));
  assert(has(race, 'onReboot: () => {') && has(code('renderer/arduinorace.js'), 'if (o.onReboot) o.onReboot();'));
  assert(has(race, 'No data for a few seconds: the interface stopped sending.'));
  assert(has(code('renderer/trackmate.js'), 'L.lastDataAt ='));
  assert(has(code('renderer/arduinorace.js'), 'L.setPower(wantPower); // (audit 2026-11'));
  assert(has(code('renderer/hardwareui.js'), "const tmLocked = () => typeof raceKept === 'function' && raceKept();"));
  assert(
    has(
      code('renderer/hwdeskview.js'),
      "(act === 'disconnect' || act === 'order' || act === 'use') && typeof raceKept === 'function' && raceKept()"
    )
  );
  assert(has(code('plugintiming.js'), 'this.clock() - this.lastAlive > 4000'));
  assert(has(code('native/parallel/SlotForgeParallel.cs'), 'Clock() - LastHeartbeat > 4000'));
  const HD = require('../renderer/hwdetect.js');
  const info = { usbVendorId: 1, usbProductId: 2 },
    settings = { tmDevice: { vid: 1, pid: 2 } };
  assert.equal(HD.decide(settings, info, { chosen: 'trackmate', open: false, racing: true }).action, 'none', 'not during a race...');
  assert.equal(
    HD.decide(settings, info, { chosen: 'trackmate', open: false, racing: true, faulted: true }).action,
    'connect',
    '...unless the race lost exactly this device'
  );
});

test('Home and Race Setup: hidden values not used, lane cars kept, wording, plan lanes, two teams, a deleted rotation, used by, a stale check', () => {
  const SS = require('../renderer/heats/swapseats.js');
  assert.equal(SS.on({ sessionType: 'heats', heatCars: 'lanes' }), true);
  assert.equal(
    SS.on({ sessionType: 'heats', ofType: 'endurance', heatCars: 'lanes' }),
    false,
    'an Endurance Race of heats is no Swap Seats race'
  );
  assert.deepEqual(SS.problems(['a', '', '', 'd'], new Set([0, 3])), [], 'lanes no heat uses need no car');
  assert.equal(SS.problems(['a', '', '', ''], new Set([0, 3])).length, 1);
  const So = require('../renderer/engine/solo.js');
  assert.equal(So.withoutSystems({ sessionType: 'tokens', fuelRules: 'f' }).fuelRules, '');
  const MC = require('../renderer/multiclass.js');
  const p = { classes: [{ id: 'g' }], heats: 'separate' };
  assert.deepEqual(MC.validate(p, [], { sessionType: 'race', finals: 'a' }), [], 'a plain race with a hidden finals value is not blocked');
  const L = code('renderer/landing.js');
  assert(has(L, 'next = SwapSeats.laneIds(nowCars, lanes);'), 'lane cars from the settings as they are now');
  assert(has(L, 'a driver in two teams is allowed'), 'a shared team driver is handled by the swaps, not refused');
  assert(has(L, 'The rotation setup of this race setup was deleted'));
  assert(has(L, "kind: heats ? (byTeam ? 'teams' : seats ? 'seats' : 'heats') : solo ? 'solo' : '',"));
  const RC = require('../renderer/racecheck.js');
  const titles = o => RC.build(o).sections.find(x => x.key === 'race').items.map(x => x.title);
  assert(titles({ hasSetup: true, entries: 8, lanes: 4, kind: 'heats' }).includes('8 participants with a car'));
  assert(titles({ hasSetup: true, stale: true, entries: 2, lanes: 2 }).includes('Open Home to check the next race again'));
  assert(
    has(code('renderer/database/manager.js'), "f.type === 'ref' && f.ref === e"),
    'the delete question names the race setups that use it'
  );
});

test('Live screens and phones: the race-over screen once, commands for the right heat, a one-way Pause, logins that last, private settings', async () => {
  const LS = require('../renderer/liveshare.js'),
    E = require('../renderer/engine.js');
  const r = E.createRace({ type: 'race', laps: 3, entries: [{ lane: 0 }] });
  r.start(0);
  const s = LS.sender({ heartbeat: 0 }),
    after = { key: 'k1', html: '<p>' + 'x'.repeat(5000) + '</p>' };
  const ctx = t => ({ raceId: 'x', eng: r, phase: 'between', calling: false, lights: 0, heat: null, season: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: t, after });
  const m1 = JSON.parse(JSON.stringify(s.pack(ctx(1000), 1000))),
    m2 = JSON.parse(JSON.stringify(s.pack(ctx(3000), 3000)));
  assert.equal(m1.after.html.length > 4000, true, 'the first message holds the screen');
  assert.deepEqual(m2.after, { key: 'k1', keep: true }, 'later ones only name it');
  const a = LS.applyDynamic(null, m1),
    b = LS.applyDynamic(a.state, m2);
  assert.equal(b.ok, true);
  assert.equal(b.state.after.html, after.html, 'the receiver keeps the one it has');
  assert.equal(LS.applyDynamic(null, m2).ok, false, 'without it, the message does not fit: the whole state is fetched');
  const S = require('../server.js');
  assert.equal(S.cleanCommand({ type: 'pause', want: 'resume', raceId: 'abc123' }).want, 'resume');
  assert.equal(S.cleanCommand({ type: 'pause', raceId: 'abc123' }).raceId, 'abc123');
  assert.equal(S.cleanCommand({ type: 'start', raceId: '<x>' }).raceId, undefined, 'only a plain race id is passed on');
  const race = code('renderer/race.js');
  assert(has(race, 'if (cmd.raceId && cmd.raceId !== live.raceId && !(live.heatIds || []).includes(cmd.raceId))') && has(race, "That heat had already ended. Nothing was changed."), 'a command for an earlier heat is not done, and the phone is told (2.5.2)');
  assert(has(race, "if (cmd.type === 'pause' && cmd.want && (cmd.want === 'resume') !== (live.phase === 'paused')) return answer(true);"), 'a second tap of Pause does not resume');
  const view = code('renderer/liveview.js');
  assert(has(view, 'if (held.length < 200) held.push(d);'), 'messages during a resync are kept');
  assert(has(view, "if ((V.stat() ? V.stat().raceId : '') !== asked) {") && has(view, 'Not sent: the race changed while you decided'), 'the Stop question is about one heat (follow-up audit: and says so)');
  const web = code('renderer/webapi.js');
  assert(has(web, 'retryT = setTimeout(stream, retryMs);'), 'a closed stream is made again');
  assert(has(code('main.js'), "relay('live:push', d, e.sender);"), 'not echoed to the race window');
  // logins: 12 h after the last use, and kept over a restart of the server
  const http = require('node:http'),
    tokens = new Map(),
    settings = { netPassword: 'pw', netPort: 9, autoBackup: { folder: 'C:/x' }, exportFolder: 'C:/y', theme: 'dark' };
  const serve = () => {
    const sv = S.createServer({ getSettings: () => settings, schema: {}, getLive: () => ({}), list: async () => [], customFields: async () => [], onCommand: async () => {}, root: path.join(__dirname, '..', 'renderer'), appRoot: path.join(__dirname, '..'), failDelay: 1, lockMs: 1, tokenMs: 400, tokens });
    return sv.listen(0, '127.0.0.1').then(port => ({ sv, port }));
  };
  const req = (port, method, p, data) =>
    new Promise((resolve, reject) => {
      const body = data ? JSON.stringify(data) : '';
      const q = http.request({ host: '127.0.0.1', port, path: p, method, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), Host: '127.0.0.1:' + port, Origin: 'http://127.0.0.1:' + port } }, res => {
        let t = '';
        res.on('data', c => (t += c));
        res.on('end', () => resolve({ code: res.statusCode, body: JSON.parse(t || '{}') }));
      });
      q.on('error', reject);
      q.end(body);
    });
  const wait = ms => new Promise(f => setTimeout(f, ms));
  let { sv, port } = await serve();
  try {
    const got = (await req(port, 'GET', '/api/settings')).body;
    assert.deepEqual(Object.keys(got), ['theme'], 'no password, network, backup or folder settings for a phone');
    const token = (await req(port, 'POST', '/api/auth', { password: 'pw' })).body.token;
    for (let i = 0; i < 3; i++) {
      await wait(250);
      assert.equal((await req(port, 'POST', '/api/command', { token, cmd: { type: 'yellow' } })).code, 200, 'used within the time: still logged in');
    }
    await sv.close();
    ({ sv, port } = await serve());
    assert.equal((await req(port, 'POST', '/api/command', { token, cmd: { type: 'yellow' } })).code, 200, 'a new server (a network setting changed) keeps the login');
    await wait(500);
    assert.equal((await req(port, 'POST', '/api/command', { token, cmd: { type: 'yellow' } })).code, 401, 'unused for longer: logged out');
  } finally {
    await sv.close();
  }
});

test('Speed: results remembered while nothing changed, one query per session, one request per records page, paint in two phases', () => {
  const E = require('../renderer/engine.js'),
    M = require('../renderer/multiclass.js');
  // the overall result of heats: remembered, but each caller gets copies, and a new heat counts
  const people = ['A', 'B', 'C'].map((x, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: x, carName: 'car' + x }));
  const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }], [{ p: 2, lane: 0 }, { p: 0, lane: 1 }]], resultBy: 'points', points: [10, 8, 6] });
  const run = () => {
    const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: H.entries() });
    q.start(0);
    q.cross(0, 5000);
    q.cross(0, 10000);
    q.cross(1, 6000);
    q.cross(1, 12000);
    return q;
  };
  H.record(run());
  const a = H.overall();
  a[0].points = 999;
  assert.notEqual(H.overall()[0].points, 999, 'a caller cannot change what is remembered');
  const before = JSON.stringify(H.overall());
  H.record(run());
  assert.notEqual(JSON.stringify(H.overall()), before, 'a new heat is counted');
  // class standings: a crossing changes them at once
  const p = M.clean({ name: 'x', classes: [{ id: 'gt', name: 'GT' }, { id: 'pr', name: 'P' }] });
  const r = E.createRace({ type: 'race', laps: 10, endRule: 'all', skipFirst: false, multiclass: p, entries: [{ lane: 0, driverId: 'a', raceClass: 'gt' }, { lane: 1, driverId: 'b', raceClass: 'gt' }], classPoints: [10, 8] });
  r.start(100);
  r.cross(1, 8100);
  assert.equal(r.classStandings()[0].car.driverId, 'b');
  r.cross(0, 8200);
  r.cross(0, 12000);
  assert.equal(r.classStandings()[0].car.driverId, 'a', 'not the remembered order');
  // one query for the fields of a session, as the field-by-field read gives them
  const C = require('../sqlite-catalogue.js');
  const rows = [
    ['["id"]', '"s1"'],
    ['["date"]', '"2026-11-26"'],
    ['["champ","id"]', '"c1"'],
    ['["champ","round"]', '2'],
    ['["standings","0","pos"]', '1'],
    ['["laps","0"]', '5000']
  ];
  const fake = {
    statement: sql => ({
      get: (e, id, path) => {
        const x = rows.find(y => y[0] === path);
        return x ? { json: x[1] } : undefined;
      },
      all: (e, id, n, prefix) => rows.filter(y => (prefix === undefined ? true : y[0].slice(0, n) === prefix)).map(([path, json]) => ({ path, json }))
    })
  };
  const keys = ['id', 'date', 'champ', 'standings', 'trackId'];
  const old = Object.fromEntries(keys.map(k => [k, C.read(fake, 'sessions', 's1', [k])]).filter(([, v]) => v !== undefined));
  assert.deepEqual(JSON.parse(JSON.stringify(C.readFields(fake, 'sessions', 's1', keys))), JSON.parse(JSON.stringify(old)));
  assert(has(code('sqlite-dashboard.js'), "yield C.readFields(s, 'sessions', id, D.SESSION);"));
  assert(has(code('shared-library-reads.js'), 'looked.push(...(await base.historyReferences(wanted.slice(at, at + 100))));'), 'the records page asks for its references together');
  const canvas = code('renderer/canvas.js');
  assert(has(canvas, 'fits.forEach(([n, fit]) => protect(n, fit));'), 'widgets are written first, then fitted');
  assert(has(code('renderer/race.js'), "racehost.classList.contains('parked')"), 'a parked race does not paint its widgets');
  assert(has(code('renderer/rows.js'), 'root.WidgetView.fitCells(viewCells);'), 'leaderboard cells fitted together');
  assert(has(code('renderer/landing.js'), 'homeLists.epoch === epoch'), 'a lane edit uses the lists of a moment ago');
});

test('Safety nets (2.5.2) and the follow-up audit: Retire, Stop with a choice, rescued results, command answers, writes counted', () => {
  const E = require('../renderer/engine.js');
  // Retire car: out with its laps, the race no longer waits; Undo starts the timing again; the last car ends the race
  const r = E.createRace({ type: 'race', laps: 5, endRule: 'all', entries: [{ lane: 0 }, { lane: 1 }] });
  r.start(0);
  r.cross(0, 100);
  r.cross(1, 100);
  r.cross(0, 5000);
  r.cross(1, 5200);
  assert.equal(r.retire(1, 6000), true);
  assert.equal(r.cars[1].retiredBy, 'director');
  assert.equal(r.cross(1, 10000), false, 'a retired car counts no laps');
  assert.equal(r.unretire(1, 11000), true);
  assert.equal(r.cross(1, 12000), false, 'its first crossing after Undo starts the timing');
  assert.equal(r.cross(1, 17000), true);
  const q = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: [{ lane: 0 }, { lane: 1 }] });
  q.start(0);
  q.cross(0, 100);
  q.cross(1, 100);
  q.cross(0, 5000);
  q.cross(0, 9000);
  q.retire(1, 9500);
  assert.equal(q.status, 'finished', 'retiring the last car still racing ends the race');
  // a DNF is kept in the heat result
  const people = ['A', 'B'].map((x, i) => ({ driverId: 'd' + i, carId: 'c' + i, driverName: x }));
  const H = E.createHeatRace({ participants: people, schedule: [[{ p: 0, lane: 0 }, { p: 1, lane: 1 }]], resultBy: 'laps' });
  const h = E.createRace({ type: 'race', laps: 2, endRule: 'all', entries: H.entries() });
  h.start(0);
  h.cross(0, 100);
  h.cross(1, 100);
  h.cross(0, 5000);
  h.retire(1, 6000);
  h.cross(0, 9000);
  assert.equal(H.record(h).rows.find(x => x.participant === 1).dnf, true);
  // the server passes the new fields on, checked
  const S = require('../server.js');
  assert.equal(S.cleanCommand({ type: 'stop', how: 'heat' }).how, 'heat');
  assert.equal(S.cleanCommand({ type: 'stop', how: 'x' }).how, undefined);
  assert.equal(S.cleanCommand({ type: 'retire', lane: 1 }).lane, 1);
  assert.equal(S.cleanCommand({ type: 'yellow', cid: 'abc123' }).cid, 'abc123');
  assert.equal(S.cleanCommand({ type: 'yellow', cid: '<b>' }).cid, undefined);
  // the answers travel with the live data; a viewer's clock can be held
  const LS = require('../renderer/liveshare.js'),
    sender = LS.sender({ heartbeat: 0 }),
    race = E.createRace({ type: 'race', laps: 3, entries: [{ lane: 0 }] });
  race.start(0);
  const ctx = { raceId: 'x', eng: race, phase: 'review', calling: false, lights: 0, heat: null, season: null, flash: new Map(), bestAll: Infinity, bestAllName: '', bestBy: new Map(), now: 1000, acks: [['cid001', false, 'The race is over.']] };
  const m = JSON.parse(JSON.stringify(sender.pack(ctx, 1000)));
  assert.deepEqual(m.acks, [['cid001', false, 'The race is over.']]);
  const V = LS.viewer();
  V.freeze(500);
  assert.equal(V.clock(9999), 500, 'held');
  V.freeze(null);
  assert.equal(V.clock(9999), 9999);
  // a rescued race is skipped on import when it was saved here after all; the links it keeps stay
  const T = require('../transfer.js');
  const bundle = {
    format: T.FORMAT,
    fileVersion: 1,
    items: { sessions: [{ id: 'rescued-1', rescueKey: 'run-1', setupName: 'Club night', standings: [{ driverId: 'd1' }] }], laps: [{ id: 'l1', sessionId: 'rescued-1', driverId: 'd1' }] },
    keep: { drivers: { d1: 'd1' } }
  };
  const mk = sessions => ({ data: { sessions, laps: [], customFields: {}, ...Object.fromEntries(T.ORDER.filter(e => e !== 'sessions' && e !== 'laps').map(e => [e, []])) }, saveNow() {} });
  const here = mk([{ id: 's9', saveKey: 'run-1', standings: [] }]);
  T.apply(here, bundle);
  assert.equal(here.data.sessions.length, 1, 'saved here after all: not added twice');
  assert.equal(here.data.laps.length, 0);
  const elsewhere = mk([]);
  T.apply(elsewhere, bundle);
  assert.equal(elsewhere.data.sessions.length, 1);
  assert.equal(elsewhere.data.sessions[0].standings[0].driverId, 'd1', 'the driver link is kept, not blanked');
  const planned = T.plan(bundle, [], {});
  assert.equal(planned.bundle.keep.drivers.d1, 'd1', 'Import keeps the links the file names');
  // the race side: tyres from a phone before the start, answers sent at once, Retire only in races, heat checks
  const raceCode = code('renderer/race.js');
  assert(has(raceCode, "// (not tyre: the Tyre Change folder works before the start and in the break too)"));
  assert(has(raceCode, "if (live === L && L.alive !== false) share();"), 'an answer goes out at once');
  assert(has(raceCode, "eng.type === 'race' && !solo"), 'Retire only in races');
  assert(has(raceCode, "if (live.raceId !== asked && !(live.heatIds || []).includes(asked)) return;"), 'Retire does not land on the next heat');
  assert(has(raceCode, "const late = performance.now() - tmTickAt > 1500;"), 'a window that stood still is no silent Trackmate');
  // every editor save is a write (JSON storage too); SQLite keeps its error when it cannot reopen
  assert(has(code('preload.js'), 'writeEpoch++; // (follow-up audit 2026-11: every add, update and remove is a write'));
  assert(has(code('sqlite-client.js'), 'this.failure = x;'));
  assert(has(code('main.js'), "if (typeof bulkStorage.assertExportTarget === 'function') bulkStorage.assertExportTarget(filePath);"), 'checked before the old backup is moved');
});
