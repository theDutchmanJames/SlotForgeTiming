'use strict';
// Phase 1 status on Home: problems that used to pass without a word are chips that open the page where they are put right.
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const HS = require('../renderer/homestats');
const base = { hardware: 'trackmate', trackmate: true, netOn: false, hasSetup: false, drivers: 1, cars: 1, tracks: 1 };

test('nothing wrong: no problem chips', () => {
  const keys = HS.chips(base).map(c => c.key);
  assert(!keys.includes('unused') && !keys.includes('library'));
});

test('connected timing hardware that is not in use is a warning chip that opens Timing Hardware', () => {
  const c = HS.chips({ ...base, unused: ['DS Electronics'] }).find(x => x.key === 'unused');
  assert.equal(c.text, 'DS Electronics is connected but not counting laps');
  assert.equal(c.state, 'warn');
  assert.equal(c.go, 'hardware');
  assert.equal(HS.chips({ ...base, unused: ['DS Electronics', 'Arduino Sketch'] }).find(x => x.key === 'unused').text, 'DS Electronics and Arduino Sketch are connected but not counting laps');
});

test('races that could not reach the shared library are counted in a chip that opens Connections', () => {
  const one = HS.chips({ ...base, libraryWaiting: 1 }).find(x => x.key === 'library');
  assert.equal(one.text, '1 result waiting for the shared library');
  assert.equal(one.go, 'connections');
  assert.equal(HS.chips({ ...base, libraryWaiting: 3 }).find(x => x.key === 'library').text, '3 results waiting for the shared library');
  assert.equal(HS.chips({ ...base, libraryWaiting: 0 }).find(x => x.key === 'library'), undefined);
});

test('Home passes both and makes such chips buttons', () => {
  const { code, has } = require('./source.cjs'),
    landing = code('renderer/landing.js');
  assert(has(landing, 'libraryWaiting: homeLibraryWaiting'));
  assert(has(landing, "unusedTimingConnected(state.settings).map(id => TIMING_NAMES[id] || id)"));
  assert(has(landing, 'class="hm-chip hm-chip-go"'));
  assert(has(landing, "if (b.dataset.go === 'connections') {"));
});
