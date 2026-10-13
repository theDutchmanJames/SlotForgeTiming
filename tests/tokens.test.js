const Tokens = require('../renderer/tokens.js');
const { createRace } = require('../renderer/engine.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const MIN = 60000, SEC = 1000;
const guest = { driverId: '', driverName: 'Guest', carId: 'c1', carName: 'Ford' };
const alex = { driverId: 'd1', driverName: 'Alex', carId: 'c1', carName: 'Ford' };
const mk = (over = {}) => Tokens.create({ lanes: 4, warnSeconds: 60, ...over });

// ---- settings ----
ok('increments: a list of minutes', JSON.stringify(Tokens.parseIncrements('5, 10, 15, 30, 60')) === '[5,10,15,30,60]');
ok('increments: junk, zero, negative and doubles are dropped', JSON.stringify(Tokens.parseIncrements('5, x, 0, -3, 5, 20')) === '[5,20]');
ok('increments: spaces and semicolons separate too', JSON.stringify(Tokens.parseIncrements('2 5;10 20')) === '[2,5,10,20]' && JSON.stringify(Tokens.parseIncrements('7.5, 10')) === '[7.5,10]');
ok('increments: nothing usable gives the six standard buttons (+1 is one of them)', JSON.stringify(Tokens.parseIncrements('')) === '[1,5,10,15,30,60]' && JSON.stringify(Tokens.parseIncrements('abc')) === '[1,5,10,15,30,60]' && JSON.stringify(Tokens.parseIncrements(undefined)) === '[1,5,10,15,30,60]');
ok('increments: at most eight buttons, and nothing absurdly long', Tokens.parseIncrements('1,2,3,4,5,6,7,8,9,10').length === 8 && JSON.stringify(Tokens.parseIncrements('5, 99999')) === '[5]');
ok('decrements: the standard buttons take 1, 5 and 10 minutes off; nothing set gives them, an empty field means no minus buttons at all', JSON.stringify(Tokens.parseDecrements(undefined)) === '[1,5,10]' && JSON.stringify(Tokens.parseDecrements(null)) === '[1,5,10]' && JSON.stringify(Tokens.parseDecrements('')) === '[]' && JSON.stringify(Tokens.parseDecrements('abc')) === '[]' && JSON.stringify(Tokens.parseDecrements('2, x, 2, 15')) === '[2,15]' && Tokens.parseDecrements('1,2,3,4,5,6,7,8,9').length === 8);
ok('settings: the plus and minus buttons come from their own settings', (() => { const d = Tokens.settingsOf({}), e = Tokens.settingsOf({ tokenIncrements: '2, 4', tokenDecrements: '3' }), n = Tokens.settingsOf({ tokenDecrements: '' }); return JSON.stringify(d.increments) === '[1,5,10,15,30,60]' && JSON.stringify(d.decrements) === '[1,5,10]' && JSON.stringify(e.increments) === '[2,4]' && JSON.stringify(e.decrements) === '[3]' && n.decrements.length === 0; })());
ok('minus button text', Tokens.decLabel(1) === '−1 min' && Tokens.decLabel(2.5) === '−2,5 min');
ok('settings: defaults for everything that is missing or wrong', (() => { const s = Tokens.settingsOf({}); return s.warnSeconds === 60 && s.warnColor === '#ffb300' && s.outColor === '#d62828'; })());
ok('settings: colours must be #rrggbb, seconds are kept within 0 and an hour', (() => { const s = Tokens.settingsOf({ tokenWarnColor: 'red', tokenOutColor: '#00FF00', tokenWarnSeconds: 99999 }); return s.warnColor === '#ffb300' && s.outColor === '#00ff00' && s.warnSeconds === 3600; })());
ok('settings: a warning of 0 seconds is allowed (no warning)', Tokens.settingsOf({ tokenWarnSeconds: 0 }).warnSeconds === 0 && Tokens.settingsOf({ tokenWarnSeconds: '' }).warnSeconds === 60);
ok('button text', Tokens.incLabel(5) === '+5 min' && Tokens.incLabel(2.5) === '+2,5 min');
ok('clock text: minutes and seconds, hours only when needed, rounded up', Tokens.clockText(5 * MIN) === '05:00' && Tokens.clockText(59 * MIN + 59 * SEC) === '59:59' && Tokens.clockText(65 * MIN) === '1:05:00' && Tokens.clockText(1) === '00:01' && Tokens.clockText(0) === '00:00' && Tokens.clockText(-5) === '00:00' && Tokens.clockText(4 * MIN + 59500) === '05:00');

// ---- the states of a lane ----
{
  const t = mk();
  ok('a new lane is idle: no time, nothing to count down', t.stateOf(0, 0) === 'idle' && t.left(0, 0) === 0 && t.stateOf(3, 5 * MIN) === 'idle');
  ok('a lane the track does not have is idle and cannot be given time', t.stateOf(9, 0) === 'idle' && t.add(9, 5 * MIN, 0).ok === false);
  const r = t.add(1, 10 * MIN, 1000, '2026-01-01T10:00:00Z');
  ok('buying time starts a stint and the lane runs', r.ok && r.started && !r.ended && t.stateOf(1, 1000) === 'running' && t.left(1, 1000) === 10 * MIN);
  ok('the clock runs down with the race clock', t.left(1, 1000 + 4 * MIN) === 6 * MIN && t.stateOf(1, 1000 + 4 * MIN) === 'running');
  ok('other lanes are not touched', t.stateOf(0, 5000) === 'idle' && t.stateOf(2, 5000) === 'idle');
  const end = 1000 + 10 * MIN;
  ok('the warning starts when 60 seconds are left (exactly on the edge too)', t.stateOf(1, end - 61 * SEC) === 'running' && t.stateOf(1, end - 60 * SEC) === 'warning' && t.stateOf(1, end - 1) === 'warning');
  ok('the time is up when the clock reaches zero', t.stateOf(1, end) === 'out' && t.stateOf(1, end + 5000) === 'out' && t.left(1, end + 5000) === 0);
  ok('time only depends on the race clock: asking again for the same moment gives the same answer, and nothing is used up by looking', t.left(1, 1000 + 4 * MIN) === 6 * MIN && t.left(1, 1000 + 4 * MIN) === 6 * MIN && t.left(1, 1000) === 10 * MIN);
  const z = mk({ warnSeconds: 0 });
  z.add(0, MIN, 0);
  ok('no warning when the warning is set to 0 seconds', z.stateOf(0, MIN - 1) === 'running' && z.stateOf(0, MIN) === 'out');
}

// ---- buying more time ----
{
  const t = mk(); t.assign(0, alex);
  t.add(0, 5 * MIN, 0);
  const r = t.add(0, 15 * MIN, 2 * MIN);
  ok('time stacks on a running lane: the same stint goes on', r.ok && !r.started && t.left(0, 2 * MIN) === 18 * MIN && t.stintOf(0).bought === 20 * MIN);
  ok('...and a lane in its warning is lifted out of it', (() => { const u = mk(); u.add(0, 2 * MIN, 0); const before = u.stateOf(0, 90 * SEC); u.add(0, 10 * MIN, 90 * SEC); return before === 'warning' && u.stateOf(0, 90 * SEC) === 'running'; })());
  ok('wrong amounts are refused', !t.add(0, 0, 0).ok && !t.add(0, -5, 0).ok && !t.add(0, NaN, 0).ok && !t.add(0, 'x', 0).ok && t.stintOf(0).bought === 20 * MIN);
}
{
  const t = mk(); t.assign(2, alex);
  t.add(2, 5 * MIN, 0, 'first');
  t.lap(2, 5000, MIN); t.lap(2, 4800, 2 * MIN);
  const r = t.add(2, 10 * MIN, 8 * MIN, 'second');
  ok('buying time for a lane that is out starts a new stint from now', r.ok && r.started && !!r.ended && t.left(2, 8 * MIN) === 10 * MIN && t.stateOf(2, 8 * MIN) === 'running');
  ok('...and the old stint is finished with its laps and best lap', r.ended.id === 1 && r.ended.laps.length === 2 && r.ended.best === 4800 && r.ended.bought === 5 * MIN && r.ended.closedBy === 'expired' && r.ended.startAt === 'first' && r.ended.who.driverName === 'Alex');
  ok('...the new stint starts without laps and has its own number', t.stintOf(2).id === 2 && t.stintOf(2).laps.length === 0 && t.stintOf(2).startAt === 'second');
  ok('finished stints wait to be saved, once', t.hasPending() && t.takeClosed().length === 1 && !t.hasPending() && t.takeClosed().length === 0);
}

// ---- undo and end now ----
{
  const t = mk();
  t.add(0, 60 * MIN, 0); t.add(0, 5 * MIN, 0);
  ok('undo takes back the last time added', t.canUndo(0, 0) && t.undo(0, 0) && t.left(0, 0) === 60 * MIN && t.stintOf(0).bought === 60 * MIN);
  ok('...and again, back to nothing: the lane is idle again', t.undo(0, 0) && t.stateOf(0, 0) === 'idle' && !t.hasPending());
  ok('nothing left to undo', !t.canUndo(0, 0) && !t.undo(0, 0) && !t.canUndo(1, 0));
  const u = mk(); u.add(0, 10 * MIN, 0); u.lap(0, 5000, MIN);
  ok('undoing the only time bought, after laps were driven, ends the time at once but keeps the stint', u.undo(0, 3 * MIN) && u.stateOf(0, 3 * MIN) === 'out' && u.stintOf(0).laps.length === 1);
  const v = mk(); v.add(0, 5 * MIN, 0);
  ok('an add cannot be undone once the time is up', !v.canUndo(0, 5 * MIN) && !v.undo(0, 5 * MIN) && v.stintOf(0).bought === 5 * MIN);
  const w = mk(); w.add(0, 5 * MIN, 0); w.add(0, 5 * MIN, 0);
  ok('undo only takes back what was added in the same stint', w.undo(0, MIN) && w.left(0, MIN) === 4 * MIN && w.stintOf(0).bought === 5 * MIN);
}
{
  const t = mk(); t.add(1, 10 * MIN, 0);
  ok('end now: the lane is out at once', t.endNow(1, 2 * MIN) && t.stateOf(1, 2 * MIN) === 'out' && t.left(1, 2 * MIN) === 0);
  ok('...a second time does nothing', !t.endNow(1, 3 * MIN));
  ok('...and it can be undone: the time comes back', t.canUndo(1, 2 * MIN) && t.undo(1, 2 * MIN) && t.left(1, 2 * MIN) === 8 * MIN && t.stateOf(1, 2 * MIN) === 'running');
  ok('end now on an idle lane does nothing', !t.endNow(0, 0));
  t.endNow(1, 2 * MIN);
  const c = t.clear(1, 2 * MIN);
  ok('clear finishes the stint and the lane is neutral again', c && t.stateOf(1, 2 * MIN) === 'idle' && t.hasPending() && t.takeClosed()[0].closedBy === 'cleared');
  ok('clear on an idle lane does nothing', !t.clear(1, 3 * MIN));
}

// ---- drivers ----
{
  const t = mk(); t.assign(0, alex); t.assign(1, guest);
  t.add(0, 30 * MIN, 0); t.lap(0, 5100, 2 * MIN);
  const r = t.setWho(0, { driverId: 'd2', driverName: 'Sam', carId: 'c1', carName: 'Ford' }, 10 * MIN, 'later');
  ok('another driver takes over the time that is left, in a new stint', r.changed && r.started && r.ended.who.driverName === 'Alex' && r.ended.laps.length === 1 && r.ended.closedBy === 'driver' && r.ended.left === 20 * MIN);
  ok('...the clock goes on where it was', t.left(0, 10 * MIN) === 20 * MIN && t.stateOf(0, 10 * MIN) === 'running' && t.stintOf(0).who.driverName === 'Sam' && t.stintOf(0).laps.length === 0);
  ok('...and the time carried over is counted as that stint\'s time', t.stintOf(0).bought === 20 * MIN && t.stintOf(0).carried === 20 * MIN);
  ok('undo cannot take away the carried time, only time added after it', (() => { t.add(0, 5 * MIN, 10 * MIN); t.undo(0, 10 * MIN); const ok1 = t.left(0, 10 * MIN) === 20 * MIN; const none = !t.canUndo(0, 10 * MIN); return ok1 && none && t.stintOf(0) !== null; })());
  t.takeClosed();
  ok('choosing the same driver again changes nothing: no new stint, nothing to save', (() => { const id = t.stintOf(0).id, r2 = t.setWho(0, { driverId: 'd2', driverName: 'Sam', carId: 'c1', carName: 'Ford' }, 11 * MIN); return !r2.changed && !r2.started && !r2.ended && t.stintOf(0).id === id && !t.hasPending(); })());
  ok('the same driver and car under another name (a car renamed) updates the running stint without starting a new one', (() => { const id = t.stintOf(0).id, r2 = t.setWho(0, { driverId: 'd2', driverName: 'Sam', carId: 'c1', carName: 'Ford GT' }, 11 * MIN); return !r2.changed && t.stintOf(0).who.carName === 'Ford GT' && t.stintOf(0).id === id && t.whoOf(0).carName === 'Ford GT'; })());
  const g = mk(); g.assign(0, alex); g.add(0, MIN, 0);
  const o = g.setWho(0, guest, 5 * MIN);
  ok('a driver change on a lane that is out: the lane becomes idle (the red goes away), nothing is carried', o.changed && !o.started && o.ended && g.stateOf(0, 5 * MIN) === 'idle' && g.whoOf(0).driverName === 'Guest');
  const h = mk(); h.setWho(3, alex, 0);
  ok('a driver on an idle lane is just remembered for the next stint', h.whoOf(3).driverName === 'Alex' && h.stateOf(3, 0) === 'idle' && !h.hasPending());
  h.add(3, MIN, 0);
  ok('...and the next stint is his', h.stintOf(3).who.driverName === 'Alex');
  const f = mk(); f.add(0, MIN, 0);
  ok('a lane nobody was assigned to is a Guest', f.stintOf(0).who.driverName === 'Guest' && f.stintOf(0).who.driverId === '');
}

// ---- laps ----
{
  const t = mk(); t.add(0, 2 * MIN, 0);
  ok('a lap on an idle lane is ignored', t.lap(1, 5000, 0) === null && t.stintOf(1) === null);
  ok('a lap while the time runs counts', t.lap(0, 5000, 30 * SEC).late === false && t.lap(0, 4900, 90 * SEC).late === false);
  ok('a lap after the time is up is kept but marked late', t.lap(0, 4800, 2 * MIN + SEC).late === true && t.stintOf(0).laps.length === 3 && t.stintOf(0).laps[2].late === true);
  const s = t.clear(0, 3 * MIN) && t.takeClosed()[0];
  ok('the best lap of a stint ignores late laps and too slow laps', s.best === 4900 && s.laps.length === 3);
  const u = mk(); u.add(0, MIN, 0); u.lap(0, 9000, 1, true); u.lap(0, 8000, 2);
  ok('...and ignores laps the track calls too slow', u.clear(0, 3) && u.takeClosed()[0].best === 8000);
  const n = mk(); n.add(0, MIN, 0); n.lap(0, 5000, MIN + 1);
  ok('a stint with only late laps has no best lap', n.clear(0, MIN + 2) && n.takeClosed()[0].best === null);
}

// ---- end of the session ----
{
  const t = mk(); t.add(0, 5 * MIN, 0); t.add(2, 5 * MIN, 0); t.lap(0, 5000, 10 * SEC);
  t.closeAll(MIN);
  const c = t.takeClosed();
  ok('closing the session finishes every open stint', c.length === 2 && c.every(x => x.closedBy === 'session') && c.map(x => x.lane).join() === '0,2' && t.stateOf(0, MIN) === 'idle' && t.stateOf(2, MIN) === 'idle');
  ok('...time that was left is on the record', c[0].left === 4 * MIN);
  const u = mk(); u.add(0, MIN, 0); u.clear(0, 0); const list = u.takeClosed(); u.putBack(list);
  ok('stints that could not be saved are offered again', u.hasPending() && u.takeClosed().length === 1);
}

// ---- what other screens get ----
{
  const t = mk({ warnColor: '#ffaa00', outColor: '#cc0000' }); t.add(0, 3 * MIN, 1000); t.add(2, 10 * MIN, 0);
  const snap = t.snapshot(), v = Tokens.view(JSON.parse(JSON.stringify(snap)));
  let same = true;
  for (let tt = 0; tt < 12 * MIN; tt += 7 * SEC) for (let l = 0; l < 4; l++) if (v.stateOf(l, tt) !== t.stateOf(l, tt) || v.left(l, tt) !== t.left(l, tt)) same = false;
  ok('a screen that is sent the snapshot shows the same state and time as the race window at any moment', same);
  ok('...with the colours and the warning', v.warnColor === '#ffaa00' && v.outColor === '#cc0000' && v.warnMs === 60000 && v.lanes === 4);
  ok('the snapshot is small: one number per lane', JSON.stringify(snap.ends) === '[181000,null,600000,null]' && JSON.stringify(snap).length < 150);
  ok('the snapshot does not change while the clock runs (only when time is bought)', JSON.stringify(t.snapshot()) === JSON.stringify(snap));
  ok('no snapshot yet: a view of nothing', Tokens.view(null).stateOf(0, 0) === 'idle' && Tokens.view(undefined).left(3, 5) === 0);
  ok('t.view() is the same thing', (() => { const x = t.view(); return x.stateOf(0, 100 * SEC) === 'running' && x.stateOf(0, 125 * SEC) === 'warning' && x.stateOf(0, 3 * MIN + 1000) === 'out'; })());
}

// ---- keeping the session across a restart ----
{
  const t = mk(); t.assign(0, alex); t.assign(1, guest);
  t.add(0, 20 * MIN, 5 * MIN); t.lap(0, 5000, 6 * MIN); t.add(1, MIN, 0); t.lap(1, 4000, 2 * MIN); t.add(2, MIN, 0); t.clear(2, 30 * SEC);
  const data = JSON.parse(JSON.stringify(t.serialise(9 * MIN))); // (as it is kept in the settings file)
  const u = mk();
  ok('a saved session can be put back', u.restore(data, 0));
  ok('the time that was left comes back, counted from the new start', u.left(0, 0) === 16 * MIN && u.stateOf(0, 0) === 'running' && u.left(0, 5 * MIN) === 11 * MIN);
  ok('a lane that was out is still out', u.stateOf(1, 0) === 'out' && u.left(1, 0) === 0 && u.stateOf(1, 5 * MIN) === 'out');
  ok('an idle lane is still idle', u.stateOf(3, 0) === 'idle');
  ok('laps, drivers and the stint numbers come back', u.stintOf(0).laps.length === 1 && u.stintOf(0).who.driverName === 'Alex' && u.whoOf(1).driverName === 'Guest' && u.stintOf(0).id === t.stintOf(0).id && u.stintOf(1).laps[0].late === true);
  ok('stints that were not saved yet come back too', u.hasPending() && u.takeClosed().length === 1);
  ok('the next stint gets a new number', (() => { u.add(3, MIN, 0); return u.stintOf(3).id > 3; })());
  ok('undo still works on a restored lane', (() => { u.add(0, 5 * MIN, 0); return u.canUndo(0, 0) && u.undo(0, 0) && u.left(0, 0) === 16 * MIN; })());
  ok('rubbish is refused', !mk().restore(null, 0) && !mk().restore({ v: 2, lanes: [] }, 0) && !mk().restore({ v: 1 }, 0));
  const fewer = Tokens.create({ lanes: 2 });
  ok('a track with fewer lanes than the saved session simply leaves the extra lanes out', fewer.restore(data, 0) && fewer.stateOf(0, 0) === 'running' && fewer.stateOf(3, 0) === 'idle');
}

// ---- the engine: a fresh stint on a lane ----
{
  const R = createRace({ type: 'practice', skipFirst: true, entries: [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i })) });
  R.start(0);
  const car0 = R.cars[0];
  [1000, 6000, 11500, 16200].forEach(t => R.cross(0, t)); // (the first crossing only starts the timing)
  R.cross(1, 1000); R.cross(1, 7000);
  ok('before: laps and a best lap', car0.laps.length === 3 && car0.best === 4700 && R.cars[1].laps.length === 1);
  ok('restart: refused for a car that does not exist', R.restartCar(5, 20000) === false);
  const r = R.restartCar(0, 20000, { driverId: 'dX', driverName: 'Guest' });
  ok('restart: the same car object, a new driver, nothing driven', r && R.cars[0] === car0 && car0.driverId === 'dX' && car0.driverName === 'Guest' && car0.carId === 'c0' && car0.laps.length === 0 && car0.best === null && car0.total === 0 && !car0.done && car0.bad.length === 0 && car0.invalid.length === 0);
  ok('restart: the other lane is not touched', R.cars[1].laps.length === 1 && R.cars[1].driverId === 'd1');
  ok('restart: the first crossing only starts the timing again', R.cross(0, 22000) === false && car0.laps.length === 0 && car0.last === 22000 && R.cross(0, 27100) === true && car0.laps[0] === 5100 && car0.best === 5100);
  R.cars[0].invalid.push(0); R.restartCar(0, 30000);
  ok('restart: flags on earlier laps are gone too', car0.invalid.length === 0 && car0.removed.length === 0);
  const P = createRace({ type: 'practice', penalty: { on: true, mode: 'every', every: 5, seconds: 5, steps: [], dq: 3, types: [], fuelPoints: 0 }, entries: [{ lane: 0, driverId: 'd', carId: 'c' }] });
  P.start(0); P.addPoints(0, 3, 10);
  ok('restart: a car that was disqualified drives again', P.cars[0].dq === true && P.restartCar(0, 50) && P.cars[0].dq === false && P.cars[0].points === 0 && P.cars[0].done === false && P.cars[0].retired === false);
}

// ---- tokens and the engine together, the way the race window uses them ----
{
  const R = createRace({ type: 'practice', skipFirst: true, entries: [0, 1].map(i => ({ lane: i, driverId: 'd' + i, carId: 'c' + i, driverName: 'D' + i })) });
  const t = Tokens.create({ lanes: 2, warnSeconds: 10 });
  const wall = { now: 0 }; // the real clock; the race clock is R.elapsed(wall.now)
  const T = () => R.elapsed(wall.now);
  R.start(0);
  t.add(0, 60 * SEC, T()); R.restartCar(0, T());
  wall.now = 10 * SEC; const first = R.cross(0, wall.now); // starts the timing
  wall.now = 15 * SEC; R.cross(0, wall.now); t.lap(0, R.cars[0].laps[0], T());
  ok('lane 0 runs, lane 1 is idle', t.stateOf(0, T()) === 'running' && t.stateOf(1, T()) === 'idle' && first === false);
  R.pause(wall.now); const frozen = T(), left = t.left(0, frozen);
  wall.now = 5 * MIN; // a long break
  ok('a paused race keeps every token clock where it was', T() === frozen && t.left(0, T()) === left && left === 45 * SEC && t.stateOf(0, T()) === 'running');
  R.resume(wall.now);
  ok('...and they go on from there after resuming', T() === frozen && t.left(0, T()) === 45 * SEC);
  wall.now += 40 * SEC;
  ok('the warning begins 10 seconds before the end', t.stateOf(0, T()) === 'warning' && t.left(0, T()) === 5 * SEC);
  wall.now += 6 * SEC;
  ok('then the time is up', t.stateOf(0, T()) === 'out');
  const crossed = R.cross(0, wall.now + 100); if (crossed) t.lap(0, R.cars[0].laps[R.cars[0].laps.length - 1], T());
  ok('a lap after the time is up is recorded by the engine and marked late by the tokens', crossed && t.stintOf(0).laps.length === 2 && t.stintOf(0).laps[1].late === true && t.stintOf(0).laps[0].late === false);
}

{ // what another screen needs to enable the Undo button: the snapshot carries the last thing done to each lane
  const t = Tokens.create({ lanes: 3, warnSeconds: 60 }); t.assign(0, { driverId: 'a', driverName: 'A' });
  ok('a snapshot says what Undo would take back on every lane (nothing: null)', JSON.stringify(t.snapshot().lastOp) === '[null,null,null]');
  t.add(0, 5 * MIN, 0); t.add(1, 5 * MIN, 0); t.endNow(1, MIN);
  ok('...an add, or an End time now', JSON.stringify(t.snapshot().lastOp) === '["add","end",null]');
  const v = (T) => Tokens.view(JSON.parse(JSON.stringify(t.snapshot())));
  ok('a view answers canUndo like the clocks themselves do: on a lane with time, after End time now, not on an idle lane', [0, 1, 2].every(n => v().canUndo(n, MIN) === t.canUndo(n, MIN)) && v().canUndo(0, MIN) === true && v().canUndo(1, MIN) === true && v().canUndo(2, MIN) === false);
  ok('...and not for an add once the time is up', v().canUndo(0, 6 * MIN) === false && t.canUndo(0, 6 * MIN) === false);
  t.undo(1, MIN);
  ok('...after an Undo the one before it is next', JSON.stringify(t.snapshot().lastOp) === '["add","add",null]');
}
// ---- taking time off ----
{
  const t = mk(); t.assign(0, alex); t.add(0, 10 * MIN, 0, 'x');
  ok('taking time off a lane that is on: the end comes closer, the time bought goes down', (() => { const r = t.reduce(0, MIN, 2 * MIN); return r.ok && r.taken === MIN && !r.out && t.left(0, 2 * MIN) === 7 * MIN && t.stintOf(0).bought === 9 * MIN; })());
  ok('...a lane that is idle or out has nothing to take off', t.reduce(1, MIN, 0).ok === false && (() => { const u = mk(); u.add(0, MIN, 0); return u.reduce(0, 30 * SEC, 2 * MIN).ok === false; })());
  ok('...an amount that makes no sense does nothing', [0, -1, NaN, 'x', undefined, null].every(v => t.reduce(0, v, 2 * MIN).ok === false) && t.left(0, 2 * MIN) === 7 * MIN);
  ok('...the lane can be reduced into its warning', (() => { const w = mk(); w.add(0, 10 * MIN, 0); w.reduce(0, 9 * MIN + 30 * SEC, 0); return w.stateOf(0, 0) === 'warning' && w.left(0, 0) === 30 * SEC; })());
  ok('Undo gives the time back, and the time bought with it', t.canUndo(0, 2 * MIN) && t.undo(0, 2 * MIN) && t.left(0, 2 * MIN) === 8 * MIN && t.stintOf(0).bought === 10 * MIN);
  ok('...and a second Undo takes back the +10 min that started the lane, as before', t.undo(0, 2 * MIN) === true && t.stateOf(0, 2 * MIN) === 'idle');
  const u = mk(); u.assign(0, alex); u.add(0, 5 * MIN, 0); u.add(0, 10 * MIN, 0);
  const r2 = u.reduce(0, 60 * MIN, 4 * MIN);
  ok('more than what is left: the time is up at once, and only what was left is taken', r2.ok && r2.out && r2.taken === 11 * MIN && u.stateOf(0, 4 * MIN) === 'out' && u.stintOf(0).bought === 4 * MIN);
  ok('...like End time now, that can be taken back while the lane is out', u.canUndo(0, 4 * MIN) && u.undo(0, 4 * MIN) && u.stateOf(0, 4 * MIN) === 'running' && u.left(0, 4 * MIN) === 11 * MIN && u.stintOf(0).bought === 15 * MIN);
  const v = mk(); v.add(0, 10 * MIN, 0); v.reduce(0, MIN, 0);
  ok('a smaller reduction that is followed by the time running out cannot be undone (as with a +time)', v.canUndo(0, 5 * MIN) && !v.canUndo(0, 20 * MIN) && v.undo(0, 20 * MIN) === false);
  ok('a reduction is in the closed stint: the time bought is what is left to pay for', (() => { const c = mk(); c.assign(0, alex); c.add(0, 10 * MIN, 0); c.reduce(0, 3 * MIN, MIN); c.lap(0, 5000, 2 * MIN); c.clear(0, 3 * MIN); const rec = c.takeClosed()[0]; return rec.bought === 7 * MIN && rec.laps.length === 1; })());
  ok('what other screens get: Undo is possible after a reduction, also when it took all the time', (() => {
    const w = mk(); w.add(0, 5 * MIN, 0); w.add(1, 5 * MIN, 0); w.reduce(0, MIN, 0); w.reduce(1, 10 * MIN, 0);
    const sn = w.snapshot(), vw = Tokens.view(sn); return sn.lastOp[0] === 'sub' && sn.lastOp[1] === 'end' && vw.canUndo(0, 0) && vw.canUndo(1, MIN) && !vw.canUndo(2, 0) && sn.ends[0] === 4 * MIN && sn.ends[1] === 0; })());
  ok('a reduction survives being kept and restored', (() => { const k = mk(); k.assign(0, alex); k.add(0, 10 * MIN, 0); k.reduce(0, 2 * MIN, 0); const data = JSON.parse(JSON.stringify(k.serialise(MIN))); const k2 = mk(); k2.restore(data, 0); return k2.left(0, 0) === 7 * MIN && k2.stintOf(0).bought === 8 * MIN && k2.undo(0, 0) && k2.left(0, 0) === 9 * MIN; })());
  ok('...and so does an End time now that can still be taken back', (() => { const k = mk(); k.assign(0, alex); k.add(0, 10 * MIN, 0); k.endNow(0, 2 * MIN); const data = JSON.parse(JSON.stringify(k.serialise(3 * MIN))); const k2 = mk(); k2.restore(data, 0); return k2.stateOf(0, 0) === 'out' && k2.canUndo(0, 0) && k2.undo(0, 0) && k2.left(0, 0) === 7 * MIN; })());
}

// ---- correcting laps, and stints that wait to be saved ----
{
  const t = mk(); t.assign(0, alex); t.add(0, 10 * MIN, 0, 'x');
  t.lap(0, 9000, MIN); t.lap(0, 6000, 2 * MIN); t.lap(0, 7000, 3 * MIN);
  ok('a lap of the stint that is running can be marked invalid, and valid again; nothing else changes', t.fixLap(0, 1, { invalid: true }) && t.stintOf(0).laps[1].invalid === true && t.fixLap(0, 1, { invalid: true }) === false && t.fixLap(0, 1, { invalid: false }) && !t.stintOf(0).laps[1].invalid && t.stintOf(0).laps.length === 3);
  ok('...nothing is corrected on a lane without a stint, on a lap that is not there, or with an operation that does not exist', t.fixLap(2, 0, { invalid: true }) === false && t.fixLap(0, 3, { invalid: true }) === false && t.fixLap(0, -1, { invalid: true }) === false && t.fixLap(0, 0, {}) === false && t.fixLap(0, 0, null) === false && t.fixLap(0, 0, { remove: 'everything' }) === false);
  t.clear(0, 4 * MIN);
  const rec = () => t.closedList().find(x => x.lane === 0);
  ok('a finished stint waits to be saved: it can be looked at, and it is a copy', t.hasPending() && rec().laps.length === 3 && rec().best === 6000 && rec().bought === 10 * MIN && (() => { const l = t.closedList(); l[0].laps.length = 0; return t.closedList()[0].laps.length === 3; })());
  const id = rec().id;
  ok('a lap of a finished stint: invalid leaves the best lap of the stint, valid brings it back', t.fixClosed(id, 1, { invalid: true }) && rec().best === 7000 && rec().laps[1].invalid === true && t.fixClosed(id, 1, { invalid: true }) === false && t.fixClosed(id, 1, { invalid: false }) && rec().best === 6000);
  ok('...taken out of the records only: it stays in the stint (still three laps) but is not a best lap, once', t.fixClosed(id, 1, { remove: 'records' }) && rec().laps.length === 3 && rec().laps[1].removed === true && rec().best === 7000 && t.fixClosed(id, 1, { remove: 'records' }) === false);
  ok('...taken out of the stint too: one lap fewer, the laps after it move up', t.fixClosed(id, 0, { remove: 'stint' }) && rec().laps.length === 2 && rec().laps[0].removed === true && rec().laps[1].t === 7000);
  ok('...a stint that is not there, a lap that is not there', t.fixClosed(999, 0, { invalid: true }) === false && t.fixClosed(id, 5, { remove: 'stint' }) === false && t.fixClosed(id, 0, undefined) === false);
  ok('corrections are kept when the session is kept and restored, and the stint can still be saved', (() => { const data = JSON.parse(JSON.stringify(t.serialise(0))); const k = mk(); k.restore(data, 0); const r = k.closedList()[0]; return r.laps.length === 2 && r.laps[0].removed === true && r.best === 7000; })());
  ok('a stint that is not wanted can be thrown away; nothing is left to save', (() => { t.discardClosed(); return !t.hasPending() && t.closedList().length === 0 && t.takeClosed().length === 0; })());
  const u = mk(); u.assign(0, alex); u.add(0, 5 * MIN, 0); u.lap(0, 5000, MIN); u.lap(0, 6000, 2 * MIN); u.fixLap(0, 0, { invalid: true }); u.fixLap(0, 1, { remove: 'records' }); u.clear(0, 3 * MIN);
  ok('the best lap of a stint leaves out invalid and removed laps (and late and too slow laps, as before)', u.closedList()[0].best === null);

  // a lap that was driven after the time was up
  const v = mk(); v.assign(0, alex); v.assign(1, guest); v.add(0, MIN, 0); v.add(1, MIN, 0); v.lap(0, 5000, 10 * SEC); v.lap(0, 6000, 2 * MIN); v.lap(1, 4000, 3 * SEC);
  const vv = Tokens.view(v.snapshot());
  ok('the snapshot says which laps were driven after the time was up, and a screen can ask', JSON.stringify(v.snapshot().lates) === '[[1],[],[],[]]' && vv.lateAt(0, 1) === true && vv.lateAt(0, 0) === false && vv.lateAt(1, 0) === false && vv.lateAt(7, 0) === false && vv.lateAt(0, 9) === false && Tokens.view({ ends: [] }).lateAt(0, 0) === false && Tokens.view(null).lateAt(0, 0) === false);
  ok('a lap after the time was up stays invalid: it can not be made valid, not even when it was marked invalid by hand', v.fixLap(0, 1, { invalid: false }) === false && v.stintOf(0).laps[1].late === true && v.fixLap(0, 1, { invalid: true }) === true && v.fixLap(0, 1, { invalid: false }) === false && v.stintOf(0).laps[1].invalid === true);
  ok('...but it can be taken out of the records, and a lap on time can be made invalid and valid again', v.fixLap(0, 1, { remove: 'records' }) === true && v.stintOf(0).laps[1].removed === true && v.fixLap(0, 0, { invalid: true }) === true && v.fixLap(0, 0, { invalid: false }) === true && v.stintOf(0).laps[0].invalid === false);
  v.clear(0, 3 * MIN); const vid = v.closedList()[0].id;
  ok('...the same in a finished stint that waits for the review', v.fixClosed(vid, 1, { invalid: false }) === false && v.closedList()[0].laps[1].late === true && v.fixClosed(vid, 0, { invalid: true }) === true && v.closedList()[0].best === null);
  ok('the lap flags of a running stint survive being kept and restored (invalid, removed and late)', (() => { const k = mk(); k.restore(JSON.parse(JSON.stringify(v.serialise(3 * MIN))), 0); const r = k.closedList()[0]; return r.laps[0].invalid === true && r.laps[1].removed === true && r.laps[1].late === true; })());
}

console.log(fails ? fails + ' TOKEN TESTS FAILED' : 'ALL TOKEN TESTS PASSED'); process.exit(fails ? 1 : 0);
