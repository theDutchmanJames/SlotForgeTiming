'use strict';
// 2.4.0: the Home cards for a USB device that was plugged in (renderer/hwdetect.js, SlotForgeRestyle.md "Plugged In"): why they ask, a failed connect that
// stays on the card with what went wrong, the DS model chosen on the card, Undo after "Not timing hardware", and when a remembered device was last used.
const test = require('node:test'),
  assert = require('node:assert/strict');
const HD = require('../renderer/hwdetect.js');
const { code, has } = require('./source.cjs');

const ch340 = { key: '1A86:7523', info: { usbVendorId: 0x1a86, usbProductId: 0x7523 } };
const arduino = { key: '2341:0043', info: { usbVendorId: 0x2341, usbProductId: 0x0043 } };

test('a new device: why it asks, the three answers (the likely one first), the DS model on the card', () => {
  const r = HD.reason({ ...ch340, action: 'ask' });
  assert.equal(r.kicker, 'Plugged in · new to Timing');
  assert.deepEqual(r.chips, ['CH340 USB serial', '1A86:7523', 'Many Arduino Nano boards use this chip']);
  const html = HD.homeHtml([{ ...arduino, action: 'ask', hw: 'arduino' }]);
  assert.match(html, /What is this device\?/);
  assert(html.indexOf('data-detect-use="arduino"') < html.indexOf('data-detect-use="trackmate"'), 'the likely one first');
  assert.match(html, /<em>Likely<\/em>/);
  assert.match(html, /data-detect-ds="ds300" aria-pressed="true"/, 'DS-300 unless DS-200 is chosen');
  assert.match(HD.homeHtml([{ ...ch340, action: 'ask', hw: null, ds: 'ds200' }]), /data-detect-ds="ds200" aria-pressed="true"/);
  assert(html.includes('data-detect-ignore') && html.includes('data-detect-later'));
});

test('a remembered device: what races use now, and when it was last used', () => {
  const ctx = { chosen: 'trackmate', chosenOn: false, names: { trackmate: 'Trackmate Interface' }, lastUsed: id => (id === 'arduino' ? '12 Nov' : '') };
  const r = HD.reason({ ...arduino, action: 'switch', hw: 'arduino' }, ctx);
  assert.deepEqual(r.chips, ['Races use: Trackmate Interface (not connected)', 'Arduino box last used 12 Nov']);
  const html = HD.homeHtml([{ ...arduino, action: 'switch', hw: 'arduino' }], ctx);
  assert.match(html, /The Arduino box is here/);
  assert.match(html, /Use Arduino Sketch for races/);
  assert.match(html, /Keep the Trackmate/);
});

test('a failed connect stays on the card, in plain words, with Try again and It is something else', () => {
  const html = HD.homeHtml([{ ...ch340, action: 'failed', hw: 'trackmate', error: 'Failed to open serial port.' }]);
  assert.match(html, /Could not connect the Trackmate/);
  assert.match(html, /The port is in use by another program/);
  assert(html.includes('data-detect-use="trackmate"') && html.includes('data-detect-other') && html.includes('data-detect-page="trackmate"'));
  assert.match(HD.failText('arduino', 'no answer'), /did not answer as an Arduino box/);
  assert.match(HD.failText('ds', ''), /did not open as a DS Electronics/);
});

test('set aside: Undo and Forgotten devices on the card', () => {
  const html = HD.homeHtml([{ ...ch340, action: 'aside' }]);
  assert.match(html, /is set aside: Timing will not ask about it again/);
  assert(html.includes('data-detect-undo') && html.includes('data-detect-forgotten'));
});

test('the app: the use answers ok or the error, the DS model is saved, Undo takes the device off the list, the day it was used is noted', () => {
  const app = code('renderer/app.js');
  assert(has(app, "if (id === 'ds') patch.dsType = o.ds === 'ds200' ? 'ds200' : 'ds300';"));
  assert(has(app, 'if (!ok) return { ok: false, error };'));
  assert(has(app, "state.settings = await api.setSettings({ hwIgnored: (state.settings.hwIgnored || []).filter(k => k !== offer.key) });"));
  assert(has(app, 'hwNoteUsed(id).catch(() => {});'));
  assert(has(app, 'lastUsed: hwLastUsed'));
});
