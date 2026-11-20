'use strict';
// 2.4.0 review: the parallel port's and the timing plugin's input times are stamped with the main process's clock; the window measures its offset to
// that clock (the quickest of a few round trips) instead of assuming both processes started their clocks at the same wall-clock moment.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');
const MC = require('../renderer/mainclock.js');

test("a main clock that started 2.5 s apart from this one: a stamp turns into this window's time, not 2.5 s off", async () => {
  MC.reset();
  const skew = 2500; // (Windows corrected its clock between the two starts)
  const api = { mainClock: async () => performance.timeOrigin + skew + performance.now() };
  await MC.sync(api);
  const now = performance.now(),
    stamp = performance.timeOrigin + skew + now;
  assert.ok(Math.abs(MC.toLocal(stamp) - now) < 100, 'within the round trip, not off by the skew'); // (generous: a busy machine slows the round trip)
});

test('the quickest round trip is kept', async () => {
  MC.reset();
  let n = 0;
  const api = {
    mainClock: () =>
      new Promise(r => {
        const slow = n++ === 0; // (the first answer is late: its reading is 30 ms old when it arrives)
        const at = performance.timeOrigin + performance.now();
        setTimeout(() => r(at), slow ? 400 : 0);
      })
  };
  await MC.sync(api);
  assert.ok(Math.abs(MC.offset() - performance.timeOrigin) < 150, 'not the late answer, which is 200 ms off');
});

test('without the main process (a browser) a stamp is taken as before', async () => {
  MC.reset();
  await MC.sync({});
  assert.equal(MC.offset(), null);
  assert.equal(MC.toLocal(performance.timeOrigin + 1234), 1234);
});

test('the main process answers with its clock and both clients use the offset', () => {
  assert.ok(has(code('main.js'), "ipcMain.handle('clock:now', () => performance.timeOrigin + performance.now());"));
  assert.ok(has(code('preload.js'), "mainClock: () => call('clock:now'),"));
  for (const f of ['renderer/parallelclient.js', 'renderer/timingpluginclient.js']) {
    assert.ok(has(code(f), 'MainClock.sync(api);'), f);
    assert.ok(/MainClock\.toLocal\(e(vent)?\.at\)/.test(code(f)), f);
  }
  assert.ok(code('renderer/index.html').indexOf('mainclock.js') < code('renderer/index.html').indexOf('parallelclient.js'));
});
