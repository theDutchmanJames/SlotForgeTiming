// 1.9.0: a race that is interrupted (a crash, a power cut) can be carried on. The engine makes a snapshot of everything that changes in a race and puts it back into an engine made with the same
// settings; the race comes back paused with its clock where it was. The file that keeps the snapshot sits next to the database.
const fs = require('fs'), os = require('os'), path = require('path');
const RE = require('../renderer/engine.js'), En = require('../renderer/endurance.js'), Database = require('../db.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const SEC = 1000, MIN = 60000;
const roster = [{ id: 'a', name: 'Alex' }, { id: 'b', name: 'Bea' }, { id: 'c', name: 'Cy' }];
const entry = (lane, over) => ({ lane, driverId: 'a', driverName: 'Alex', carId: 'car' + lane, teamId: 'T' + lane, teamName: 'Team ' + lane, roster, ...over });
const mk = (o = {}) => RE.createRace({ type: o.type || 'timed', duration: o.duration === undefined ? 20 : o.duration, laps: o.laps || 0,
  endurance: o.endurance === null ? undefined : En.clean({ sessionType: 'endurance', swapUnit: 'minutes', swapMode: 'every', swapEvery: 5, swapWarn: 1, swapGrace: 30, swapPenalty: 2, swapConfirm: 'button', ...(o.endurance || {}) }),
  penalty: RE.penaltyConfig({ everyPoints: 5, everySeconds: 5 }), entries: o.entries || [entry(0), entry(1, { driverId: 'b', driverName: 'Bea' })], minLap: 800 });
const drive = (R, i, from, to, lapMs = 30 * SEC) => { for (let t = from + lapMs; t <= to; t += lapMs) R.cross(i, t); };
const types = (R, ty) => R.events.filter(e => e.type === ty);
const through = R => JSON.parse(JSON.stringify(R.snapshot(0))); // (plain data, like the file)

// ---- the snapshot ----
{ const R = mk(); R.start(1000);
  drive(R, 0, 1000, 1000 + 4 * MIN); drive(R, 1, 1000, 1000 + 3 * MIN, 40 * SEC);
  R.tick(1000 + 4 * MIN + 10 * SEC); R.swap(0, 1000 + 4 * MIN + 20 * SEC); R.addPoints(1, 3, 1000 + 4 * MIN + 25 * SEC, 'test');
  const at = 1000 + 4 * MIN + 30 * SEC, snap = R.snapshot(at);
  ok('a snapshot is plain data: it goes through JSON and comes back the same', same(JSON.parse(JSON.stringify(snap)), snap) && snap.v === 1 && snap.at === at);
  ok('...it holds the cars with their laps, the swap state, the events and the clock, and not the settings', snap.cars.length === 2 && snap.cars[0].laps.length === R.cars[0].laps.length && snap.cars[0].en.swaps === 1 && snap.events.length === R.events.length && snap.status === 'running' && snap.t0 === 1000 && !('cfg' in snap) && !('endurance' in snap));
  ok('...taking it changes nothing in the race (the race goes on as before)', R.status === 'running' && R.cars[0].driverId === 'c' && !R.cars.some(c => c.resumed));
  R.cars[0].laps.push(1); ok('...and it is a copy: later laps are not in it', snap.cars[0].laps.length === R.cars[0].laps.length - 1); R.cars[0].laps.pop();
}

// ---- the restore ----
{ const A = mk(); A.start(1000);
  drive(A, 0, 1000, 1000 + 4 * MIN); drive(A, 1, 1000, 1000 + 3 * MIN, 40 * SEC); A.tick(1000 + 4 * MIN + 10 * SEC); A.swap(0, 1000 + 4 * MIN + 20 * SEC); A.addPoints(1, 3, 1000 + 4 * MIN + 25 * SEC, 'test');
  const at = 1000 + 4 * MIN + 30 * SEC, file = JSON.parse(JSON.stringify(A.snapshot(at)));
  const B = mk();
  ok('a snapshot is put into an engine made with the same settings', B.restore(file) === true);
  ok('...the race is back, paused, with its clock where it was (the race was running when the snapshot was made)', B.status === 'paused' && B.pausedAt === at && B.t0 === 1000 && B.elapsed(0) === at - 1000);
  ok('...the cars have their laps, the driver at the wheel, the points and the swap state', same(B.cars.map(c => c.laps), A.cars.map(c => c.laps)) && B.cars[0].driverId === 'c' && B.cars[0].driverName === 'Cy' && B.cars[0].en.swaps === 1 && B.cars[1].points === 3 && same(B.cars[0].en, A.cars[0].en));
  ok('...the log of the race is back, and the engine says how often the race was continued', same(B.events, A.events) && B.resumes === 1 && A.resumes === 0);
  ok('...the standings are those of the race when it was saved', same(B.standings().map(x => [x.pos, x.car.lane, B.lapsOf(x.car)]), A.standings().map(x => [x.pos, x.car.lane, A.lapsOf(x.car)])));
  // carry on: 90 seconds went by while the app was away (the new clock starts at 500)
  B.resume(500 + 90 * SEC); ok('...resuming shifts the clock, as after any pause: the race time goes on from where it was', B.status === 'running' && B.elapsed(500 + 90 * SEC) === at - 1000 && B.elapsed(500 + 100 * SEC) === at - 1000 + 10 * SEC);
  const n0 = B.cars[1].laps.length, last0 = B.cars[1].last;
  ok('...a car that was driving has its lap counted from where it was in the lap', last0 === A.cars[1].last + (500 + 90 * SEC - at));
  B.cross(1, 500 + 90 * SEC + 20 * SEC);
  ok('...the first lap after the restart counts as a lap, and is left out of the records (too slow)', B.cars[1].laps.length === n0 + 1 && B.cars[1].bad[n0] === true && B.cars[1].resumed === false);
  B.cross(1, 500 + 90 * SEC + 60 * SEC);
  ok('...the lap after that is a lap like any other', B.cars[1].bad[n0 + 1] === false && B.cars[1].best !== null && B.cars[1].best === Math.min(...B.cars[1].laps.filter((_, n) => !B.cars[1].bad[n])));
  // the swap rules go on with the race clock: the next swap of car 0 is due 5 minutes after the first swap
  const first = B.cars[0].en.stints[1];
  ok('...the stints are in the race clock, so the next swap is still due 5 minutes after the first one', first.ms0 === 4 * MIN + 20 * SEC && En.look(B.endurance, B.cars[0].en, first.ms0 + 4 * MIN + 59 * SEC, 8).state !== 'due' && En.look(B.endurance, B.cars[0].en, first.ms0 + 5 * MIN + 1, 8).state === 'due');
  // the race ends on time: the 20 minutes are those of the race clock, not of the wall clock
  B.tick(500 + 90 * SEC + 14 * MIN); ok('...the time of the race is still the 20 minutes of the race clock (not up at 14 minutes of racing)', B.timeUp === false && B.status === 'running');
  B.tick(500 + 90 * SEC + 16 * MIN); ok('...and it is up at 20 minutes of the race clock', B.timeUp === true);
}

// ---- what is in the snapshot, and what is made again ----
{ const A = mk(); A.start(1000); drive(A, 0, 1000, 1000 + 2 * MIN); A.call(1, 1000 + 2 * MIN + 100);
  const snap = JSON.parse(JSON.stringify(A.snapshot(1000 + 2 * MIN + 200)));
  ok('a car in the snapshot is only what differs from its entry: the roster, the team and the other things of the entry are not in it, the laps and the driver at the wheel are', !('roster' in snap.cars[0]) && !('teamName' in snap.cars[0]) && !('carId' in snap.cars[0]) && !('lane' in snap.cars[0]) && snap.cars[0].laps.length === 4 && 'en' in snap.cars[0] && 'points' in snap.cars[0]);
  ok('...a field of the entry that the race changed is in it (the driver after a swap)', (() => { const S = mk(); S.start(0); drive(S, 0, 0, 3 * MIN); S.swap(0, 3 * MIN + 100); const x = S.snapshot(3 * MIN + 200); return x.cars[0].driverId === 'c' && x.cars[0].driverName === 'Cy' && !('driverId' in x.cars[1]); })());
  const B = mk(); B.restore(snap);
  ok('...and the cars are whole again after the restore: the entry (roster, team, car) and what the race did', B.cars[0].roster.length === 3 && B.cars[0].teamName === 'Team 0' && B.cars[0].carId === 'car0' && B.cars[0].lane === 0 && B.cars[0].laps.length === 4 && B.cars[1].driverName === 'Bea');
  ok('...the calls of the lanes to the Race Director are back, and the next call goes on counting from there', B.calls.length === 1 && B.calls[0].open === true && B.calls[0].car === 1 && (() => { B.resume(5000); const n = B.call(0, 5100); return n && B.calls.length === 2 && B.calls[1].id === B.calls[0].id + 1; })());
  const noEvents = JSON.parse(JSON.stringify(snap)); delete noEvents.events; delete noEvents.calls; const C = mk();
  ok('...a snapshot without a log or calls (an old one) still comes back, with an empty log', C.restore(noEvents) === true && C.events.length === 0 && C.calls.length === 0 && C.cars[0].laps.length === 4);
  const D = mk(); D.restore(JSON.parse(JSON.stringify(B.snapshot(6000))));
  const E = mk(); E.restore(JSON.parse(JSON.stringify(D.snapshot(7000))));
  ok('a race that is carried on again and again counts how often', A.resumes === 0 && B.resumes === 1 && D.resumes === 2 && E.resumes === 3);
  ok('...a snapshot of another version, or one whose cars are not a list, is not taken', (() => { const v2 = JSON.parse(JSON.stringify(snap)); v2.v = 2; const nl = JSON.parse(JSON.stringify(snap)); nl.cars = 'x'; const bad = JSON.parse(JSON.stringify(snap)); bad.status = 'ready'; return mk().restore(v2) === false && mk().restore(nl) === false && mk().restore(bad) === false && mk().restore(snap) === true; })());
}

// ---- a race that was paused, a race that was finished, a race that does not fit ----
{ const A = mk(); A.start(0); drive(A, 0, 0, 3 * MIN); A.pause(3 * MIN + 5 * SEC);
  const B = mk(); B.restore(JSON.parse(JSON.stringify(A.snapshot(3 * MIN + 40 * SEC))));
  ok('a race that was paused stays paused, with the pause where it was', B.status === 'paused' && B.pausedAt === 3 * MIN + 5 * SEC);
  const D = mk({ type: 'race', duration: 0, laps: 2, endurance: { swapEvery: 50 } }); D.start(0); drive(D, 0, 0, MIN); drive(D, 1, 0, MIN);
  ok('(the race by laps finished)', D.status === 'finished');
  const E = mk({ type: 'race', duration: 0, laps: 2, endurance: { swapEvery: 50 } }); E.restore(JSON.parse(JSON.stringify(D.snapshot(MIN))));
  ok('a race that had finished comes back finished, with its result and the end', E.status === 'finished' && E.endedBy === D.endedBy && E.endAt === D.endAt && E.cars[0].done === true && E.cars[0].place === D.cars[0].place && E.resumes === 1 && !E.cars.some(c => c.resumed));
  const F = mk({ entries: [entry(0)] });
  ok('a snapshot of a race with other cars does not fit', F.restore(JSON.parse(JSON.stringify(A.snapshot(0)))) === false && F.status === 'ready' && F.resumes === 0);
  ok('...and neither does nothing, or something that is not a snapshot', mk().restore(null) === false && mk().restore({}) === false && mk().restore({ v: 2, cars: [], status: 'running' }) === false);
  const G = mk(); ok('...a race that has not started cannot be restored from a snapshot of a race that had not started', G.restore(JSON.parse(JSON.stringify(mk().snapshot(0)))) === false);
}

// ---- the same race, with and without an interruption ----
{ const run = cut => {
    let R = mk({ endurance: { swapEvery: 5, swapConfirm: 'button' } }); R.start(0); let shift = 0;
    for (let t = 30 * SEC; t <= 12 * MIN; t += 30 * SEC) {
      if (cut && t === 6 * MIN) { const snap = JSON.parse(JSON.stringify(R.snapshot(t))); R = mk({ endurance: { swapEvery: 5, swapConfirm: 'button' } }); R.restore(snap); R.resume(t); }
      R.tick(t + shift); R.cross(0, t + shift); R.cross(1, t + shift + 7 * SEC);
      if (t === 5 * MIN + 30 * SEC) { R.swap(0, t + shift); R.swap(1, t + shift); }
    }
    return R;
  };
  const plain = run(false), cut = run(true);
  ok('a race that was interrupted and carried on ends where the same race without the interruption ends: the same laps, swaps and drivers', same(plain.cars.map(c => [c.laps.length, c.en.swaps, c.driverId]), cut.cars.map(c => [c.laps.length, c.en.swaps, c.driverId])));
  ok('...only the lap that was being driven is left out of the records (one lap per car)', cut.cars.every(c => c.bad.filter(Boolean).length === 1) && plain.cars.every(c => c.bad.every(b => !b)));
  ok('...the stints are the same too', same(plain.cars.map(c => c.en.stints.map(q => [q.d, q.l0])), cut.cars.map(c => c.en.stints.map(q => [q.d, q.l0]))));
}

// ---- the file ----
{ const db = new Database(path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'slt-')), 'db.json')), R = mk(); R.start(0); drive(R, 0, 0, 3 * MIN);
  ok('there is no kept race in a new database', db.getResume() === null);
  const snap = { v: 1, savedAt: '2026-10-16T10:00:00.000Z', name: 'Day race', race: { setup: { name: 'Day race' }, track: { id: 't1' }, rows: [] }, eng: R.snapshot(3 * MIN) };
  ok('a snapshot is kept in a file next to the database', db.setResume(snap) === true && fs.existsSync(path.join(path.dirname(db.file), 'race-resume.json')) && !fs.existsSync(db.file + '.tmp'));
  ok('...and comes back the same', same(db.getResume(), JSON.parse(JSON.stringify(snap))));
  const E = mk(); ok('...an engine takes what comes back from the file', E.restore(db.getResume().eng) === true && E.cars[0].laps.length === R.cars[0].laps.length);
  ok('...the race list of the database and its settings do not hold it', !JSON.stringify(db.data).includes('Day race'));
  ok('something that is not a snapshot is not kept', db.setResume(null) === false && db.setResume({ v: 2 }) === false && db.setResume('x') === false && db.getResume() !== null);
  fs.writeFileSync(db.resumeFile(), '{"v":1,"eng":'); ok('a file that was cut in the middle (a power cut while writing) is nothing, not an error', db.getResume() === null);
  fs.writeFileSync(db.resumeFile(), JSON.stringify({ v: 1, name: 'no engine' })); ok('...and neither is a file without a race in it', db.getResume() === null);
  fs.writeFileSync(db.resumeFile(), JSON.stringify({ v: 1, eng: snap.eng })); ok('...a file with an engine but without the race (setup, track, lanes) is nothing either: it can not be opened again', db.getResume() === null);
  fs.writeFileSync(db.resumeFile(), JSON.stringify({ v: 1, race: snap.race })); ok('...and the same for a race without an engine', db.getResume() === null);
  db.setResume(snap); ok('clearing removes the file (and clearing twice is fine)', db.clearResume() === true && db.getResume() === null && !fs.existsSync(db.resumeFile()) && db.clearResume() === true);
  const main = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8'), pre = fs.readFileSync(path.join(__dirname, '..', 'preload.js'), 'utf8');
  ok('the main program and the preload script have the three calls (get, save, clear)', ['resume:get', 'resume:save', 'resume:clear'].every(c => main.includes("ipcMain.handle('" + c + "'") && pre.includes("call('" + c + "'")) && /getResume: \(\) =>/.test(pre) && /saveResume: snap =>/.test(pre) && /clearResume: \(\) =>/.test(pre));
}

console.log(fails ? fails + ' RESUME TESTS FAILED' : 'ALL RESUME TESTS PASSED'); process.exit(fails ? 1 : 0);
