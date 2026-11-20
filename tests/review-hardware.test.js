'use strict';
// 2.4.0 review: timing hardware fixes. Connect presses connect also with "connect when the app starts" off, a plugged-in device respects that choice, the Plugin Interface page does not edit the saved lane map,
// a port question survives a redraw, the Arduino start-up commands and late bytes belong to their own connection, and a Disconnect during a
// parallel-port connect is no error.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { EventEmitter } = require('node:events'),
  { PassThrough } = require('node:stream');
const { code, has } = require('./source.cjs');

test('Timing Desk Connect connects also when "connect when the app starts" is off', () => {
  const desk = code('renderer/hwdeskview.js');
  assert(has(desk, 'ppAutoConnect(true)'));
  assert(has(desk, 'tmAutoConnect(true)'));
  assert(has(desk, 'abAutoConnect(true)'));
  assert(has(desk, "plugin: () => typeof ptConnect === 'function' && ptConnect()"));
  assert(has(code('renderer/parallelclient.js'), '(!ppSettings().autoConnect && !force)'));
  assert(has(code('renderer/hardwareui.js'), '(!t.auto && !force)'));
  assert(has(code('renderer/arduinoui.js'), '(!t.auto && !force)'));
});

test('a remembered device is not connected by itself when its auto-connect is off', () => {
  const D = require('../renderer/hwdetect.js'),
    info = { usbVendorId: 0x2341, usbProductId: 0x43 },
    dev = { vid: 0x2341, pid: 0x43 };
  assert.equal(D.decide({ tmDevice: dev }, info, { chosen: 'trackmate' }).action, 'connect');
  assert.equal(D.decide({ tmDevice: dev, tmAuto: false }, info, { chosen: 'trackmate' }).action, 'none');
  assert.equal(D.decide({ abDevice: dev, abAuto: false }, info, { chosen: 'arduino' }).action, 'none');
  assert.equal(D.decide({ dsDevice: dev }, info, { chosen: 'ds' }).action, 'connect');
});

test('the Plugin Interface draft does not share the saved lane maps', () => {
  const T = require('../renderer/timingplugin.js'),
    saved = { id: 'a.b', lanes: 2, lapMap: [0, 1, 2, 3, 4, 5, 6, 7], pitMap: [0, 1, 2, 3, 4, 5, 6, 7] },
    s = T.config(saved);
  s.lapMap[0] = 1;
  s.pitMap[0] = 1;
  assert.equal(saved.lapMap[0], 0);
  assert.equal(saved.pitMap[0], 0);
});

test('the port question of the Trackmate and DS pages is kept for a redraw, and a dropped one answers nothing', () => {
  const tm = code('renderer/hardwareui.js'),
    ds = code('renderer/dsui.js');
  assert(has(tm, 'hw.pick = { list, res };') && has(tm, 'function tmDrawPick()') && has(tm, 'if (hw.pick) hw.pick.res(null);'));
  assert(has(ds, 'dsc.pick = { list, res };') && has(ds, 'function dscDrawPick()') && has(ds, 'if (dsc.pick) dsc.pick.res(null);'));
  for (const c of [tm, ds]) assert(has(c, 'if (id !== null) api.hwChosen(id);'));
});

test('Arduino start-up commands and bytes read after Disconnect belong to their own connection', () => {
  const ab = code('renderer/arduinoui.js');
  assert(has(ab, 'if (!ab.open || ab.gen !== gen) return;'));
  assert(has(ab, 'if (ab.open && ab.gen === gen && value && value.length) abReceive(value);'));
  assert(has(code('renderer/hardwareui.js'), 'if (hw.open && value && value.length) tmReceive(value);'));
});

test('parallel port: a Disconnect while connecting leaves no error', async () => {
  const { createController } = require('../parallelport'),
    P = require('../renderer/parallel');
  const launch = () => {
    const c = new EventEmitter();
    c.stdout = new PassThrough();
    c.stderr = new PassThrough();
    c.stdin = new PassThrough();
    c.stdin.resume();
    c.stdin.on('finish', () => setImmediate(() => c.emit('exit', 0)));
    c.killed = false;
    c.kill = () => {
      c.killed = true;
      c.emit('exit', 0);
    };
    setImmediate(() => c.stdout.write(JSON.stringify({ type: 'hello', protocol: 1 }) + '\n'));
    return c; // (never answers the clock questions: the connect stays open until the Disconnect)
  };
  const c = createController({ spawn: launch, platform: 'win32' });
  const opening = assert.rejects(c.open(P.defaults()));
  await new Promise(r => setTimeout(r, 50));
  await c.close();
  await opening;
  assert.equal(c.state().error, '');
  assert.equal(c.state().connected, false);
});
