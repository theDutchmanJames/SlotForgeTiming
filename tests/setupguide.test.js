'use strict';
// 2.4.0: the setup guide reworked (renderer/setupwizard.js, SlotForgeRestyle.md "Start Lights"): connect inside the guide (the remembered device, or a port
// chosen there), cars from the shared library, the Lanes & sensors step with the Lane Check, a Commentary step whose set the test race uses, and a pill
// that brings you back to the guide from the page it sent you to.
const test = require('node:test'),
  assert = require('node:assert/strict');
const WZ = require('../renderer/setupwizard.js');
const { code, has } = require('./source.cjs');

test('the steps: Lanes & sensors, then Commentary, then the test race', () => {
  assert.deepEqual(
    WZ.STEPS.map(s => s[0]),
    ['welcome', 'track', 'drivers', 'cars', 'hardware', 'sensors', 'audio', 'finish']
  );
  assert.equal(WZ.STEPS[5][1], 'Lanes & sensors');
  assert.deepEqual(
    WZ.PRESETS.map(p => p[0]),
    ['Essential', 'Club', 'Broadcast']
  );
});

test('a guide from before the Commentary step keeps its place; the commentary choice is kept', () => {
  assert.equal(WZ.progressOf({ setupGuide: { step: 6 } }).step, 7, 'it was at its test race: still the test race');
  assert.equal(WZ.progressOf({ setupGuide: { step: 5 } }).step, 5);
  assert.equal(WZ.progressOf({ setupGuide: { v: WZ.VERSION, step: 6 } }).step, 6, 'a new guide at Commentary');
  assert.deepEqual(WZ.progressOf({ setupGuide: { v: 2, step: 6, audio: { preset: 'Broadcast', voice: 'Hazel', setId: 's1' } } }).audio, {
    preset: 'Broadcast',
    voice: 'Hazel',
    setId: 's1',
    own: '',
    none: false
  });
  assert.equal(WZ.progressOf({ setupGuide: { v: 2, step: 6, audio: { preset: 'Loud' } } }).audio.preset, 'Club', 'an unknown preset: Club');
  assert.deepEqual(WZ.progressOf({ setupGuide: { v: 2, step: 3, carIds: ['c1', '', 'c3'] } }).carIds, ['c1', '', 'c3'], 'a car per lane, in place');
});

test('the guide is wired: connect inside, cars from the library, the commentary set on the test race, the pill', () => {
  const g = code('renderer/setupwizard.js');
  assert(has(g, 'const port = await navigator.serial.requestPort();'), 'Choose its port…');
  assert(has(g, 'ok = await USE_PORT[hw](port);'));
  assert(has(g, "if (on) return go(5);"), 'connected: on to the lanes');
  assert(has(g, 'data-wzcarpick'), 'cars from the shared library');
  assert(has(g, "Sound.profile(Sound.defaultSet(`Commentary · ${A.preset}`), A.preset)"), 'the preset as an audio set');
  assert(has(g, "...(au ? { audioSet: au } : {})"), 'the test race uses it');
  assert(has(g, 'S.guideBack = { step: p.step, title: STEPS[p.step][1] };'));
  assert(has(g, '← Back to the guide'));
  assert(has(code('renderer/app.js'), 'SetupWizard.pill()'));
  assert(has(code('renderer/styles.css'), 'grid-template-columns:repeat(8,minmax(0,1fr));gap:6px;margin:14px 0 0'), 'eight step lights in one row');
});
