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
  assert.equal(one.text, '1 result waiting in Paddock');
  assert.equal(one.go, 'connections');
  assert.equal(HS.chips({ ...base, libraryWaiting: 3 }).find(x => x.key === 'library').text, '3 results waiting in Paddock');
  assert.equal(HS.chips({ ...base, libraryWaiting: 0 }).find(x => x.key === 'library'), undefined);
});

// (2.4.0, Status Lights) the chips are in the drop-down of the status lights of the main menu now: mainbar.js passes both, racecheck.js makes them buttons
test('the status lights pass both and make such chips buttons that open the page where they are put right', () => {
  const { code, has } = require('./source.cjs'),
    mainbar = code('renderer/mainbar.js'),
    RC = require('../renderer/racecheck.js');
  assert(has(mainbar, "libraryWaiting: typeof homeLibraryWaiting !== 'undefined' ? homeLibraryWaiting : 0"));
  assert(has(mainbar, 'unusedTimingConnected(state.settings).map(id => TIMING_NAMES[id] || id)'));
  assert(has(mainbar, "if (go === 'connections' && typeof connectionsTab !== 'undefined') connectionsTab = 'paddock';"));
  const c = RC.build({ chips: HS.chips({ ...base, unused: ['DS Electronics'], libraryWaiting: 2 }) }),
    html = RC.panelHtml(c);
  assert(html.includes('DS Electronics is connected but not counting laps'));
  assert(html.includes('2 results waiting in Paddock'));
  assert(html.includes('data-st-go="hardware"'));
  assert(html.includes('data-st-go="connections"'));
});
