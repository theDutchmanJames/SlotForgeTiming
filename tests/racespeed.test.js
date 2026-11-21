'use strict';
// 2.4.0: the race screen with 8 cars spent 190 ms of every second restyling the page, nearly all for one rule, a Page Note without a picture found
// with :has(>.sn-tile:empty); the note is now marked where it is made. The Live Race window keeps full speed when Windows thinks it is covered
// (backgroundThrottling off, as the main window). The Status Lights button has no older pill behind it.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');

test('a Page Note without a picture is a class, not a :has() rule', () => {
  const S = code('renderer/styles.css');
  assert.ok(!/:has\(>\.sn-tile:empty\)/.test(S));
  assert.ok(has(S, '.sn.sn-notile:is(.sy-note,.ss-intro)>*{grid-column:1}'));
  assert.ok(has(code('renderer/systemsheet.js'), "pic ? 'sn sy-note' : 'sn sy-note sn-notile'"));
  assert.ok(has(code('renderer/generalpage.js'), "if (!tile.innerHTML) note.classList.add('sn-notile');"));
});

test('the Live Race window is not slowed down in the background', () => {
  const M = code('main.js');
  const live = M.slice(M.indexOf('function openLiveWindow()'), M.indexOf('liveWin.loadFile('));
  assert.ok(has(live, 'backgroundThrottling: false'));
});

test('the Status Lights button draws no pill of the older lights behind it', () => {
  assert.ok(has(code('renderer/mainbar.js'), "el.classList.add('mb-lights-one');"));
  assert.ok(has(code('renderer/styles.css'), '.mb-lights.mb-lights-one{padding:0;background:none}'));
});
