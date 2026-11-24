'use strict';
// 2.5.0 the second screen before a race (SlotForgeRestyle.md "Audience Home"): Home read-only for the audience until a race is there, Race timing when
// Start race is pressed, Home again when the race computer leaves the race; the line-up follows Home on the race computer.
const test = require('node:test'),
  assert = require('node:assert/strict');
const { code, has } = require('./source.cjs');

test('Home can be drawn read-only into another element, with nothing that acts', () => {
  const L = code('renderer/landing.js');
  assert(has(L, 'async function renderHome(opts = {}) {'));
  assert(has(L, 'const hv = display ? {} : view; // (the second screen: no handlers on its page)'), 'no handlers');
  for (const guard of [
    'if (!display && api.homeChanged) api.homeChanged();',
    "if (!display && typeof mountHwDetect === 'function') mountHwDetect();",
    'if (champAuto && !display) {',
    'if (api.autoBackupStatus && !display)'
  ])
    assert(has(L, guard), guard);
  assert(has(L, 'api.paddockCatalogue && !display ?'), 'the second screen does not ask for Paddock cars (main window only)');
  assert(/if \(!display\)\s+api\.setSettings\(\{ heatSeeds: seeds \}\)/.test(L), 'no heat seed saved by the second screen');
  assert(has(L, "${display ? 'Next race' : 'Start a race'}") && has(L, '${display ? waitHtml : lightsHtml}'));
  const css = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'renderer', 'styles.css'), 'utf8');
  assert(css.includes('.hm-display #hmc-start>.hm-go>:not(.hm-wait){display:none!important}'), 'no Start race on the second screen');
});

test('the second screen: Home first, Race timing on a new race, Home again when the race is left', () => {
  const V = code('renderer/liveview.js');
  assert(has(V, "if (second && page === 'tiles') page = live() ? 'timing' : 'home';"));
  assert(has(V, "if (second && page === 'home') return go('timing');"));
  assert(has(V, 'api.onLiveClosed(() => {') && has(V, "go('home');"));
  assert(has(V, 'if (second && api.onHomeChanged) offs.push(api.onHomeChanged(homeAgain));'));
  assert(has(V, "setClean((page === 'timing' && live() && !timingResults) || page === 'home');"), 'the header hides until the mouse moves');
  assert(has(V, '<button class="btn" id="lv-pages">Live Race pages</button>'));
});

test('the race computer says when its race is left and when Home changed; only the main window may', () => {
  const M = code('main.js');
  assert(has(M, "ipcMain.handle('live:get', () => ({ stat: live.stat, dyn: live.dyn, ...(live.closed ? { closed: true } : {}) }));"));
  assert((M.match(/if \(!mainWin \|\| e\.sender !== mainWin\.webContents\) return;/g) || []).length >= 2);
  assert(has(M, "if (liveWin && !liveWin.isDestroyed()) liveWin.webContents.send('home:changed');"));
  const P = code('preload.js');
  assert(has(P, "liveClosed: () => ipcRenderer.send('live:closed'),") && has(P, "homeChanged: () => ipcRenderer.send('home:changed'),"));
  assert(has(code('renderer/app.js'), 'if (api.liveClosed) api.liveClosed();'));
});
