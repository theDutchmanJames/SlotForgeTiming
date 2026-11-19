'use strict';
// Save diagnostics, and (2.4.0) the wiring of the update check of every SlotForge app (update-check.cjs and renderer/update-ui.js, as Circuit has
// them: their own tests are in update-check.test.cjs). The update check of before (update-check.js and the notice on Home) is gone.
const { test } = require('node:test'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
const D = require('../diagnostics');

test('diagnostics leave out passwords, names, pictures and long texts, and hide the user folder', () => {
  const settings = {
    netPassword: '1234',
    directorPin: '9999',
    paddockToken: 'abc',
    appName: 'Club Sint Anna',
    welcome: 'Welcome James',
    clubLogo: 'data:image/png;base64,AAAA',
    theme: 'dark',
    timingHw: 'ds',
    notes: 'x'.repeat(500),
    nested: { apiKey: 'k', ok: 1 }
  };
  const text = D.report({ settings, app: { profile: 'C:\\Users\\Jan\\AppData\\Roaming\\slotforge-timing' }, errors: ['ERROR at C:/Users/Jan/x.js'] }, 'C:\\Users\\Jan');
  for (const secret of ['1234', '9999', 'abc', 'Club Sint Anna', 'Welcome James', 'base64', 'Jan']) assert(!text.includes(secret), 'leaves out ' + secret);
  assert.match(text, /"theme": "dark"/);
  assert.match(text, /"timingHw": "ds"/);
  assert.match(text, /\[text, 500 characters\]/);
  assert.match(text, /%USERPROFILE%/);
  assert.match(text, /"ok": 1/);
  // other user folders too: the short Windows form, doubled backslashes inside JSON, macOS and Linux homes
  const other = D.redactPaths('a C:\\Users\\THEDUT~1\\AppData b {"p":"C:\\\\Users\\\\Piet\\\\x"} c /Users/marie/Library d /home/kees/.config', 'C:\\Users\\Jan');
  for (const name of ['THEDUT', 'Piet', 'marie', 'kees']) assert(!other.includes(name), 'hides ' + name);
  assert.match(other, /%USERPROFILE%\\AppData/);
  const log = D.createErrorLog(3);
  ['a', 'b', 'c', 'd'].forEach(x => log.add('ERROR', x));
  assert.deepEqual(log.lines().map(l => l.split(' ').pop()), ['b', 'c', 'd'], 'only the newest are kept');
});

test('the app wires the update check: one channel for its own page, the preload, the window on the page, Settings, the names of the release files', () => {
  const { code, has } = require('./source.cjs');
  const main = code('main.js'),
    pre = code('preload.js');
  assert(has(main, "ipcMain.handle('update:action'") && has(main, "ipcMain.handle('diagnostics:save'"), 'the channels');
  assert(has(main, "appName: 'Timing'") && has(main, "artifactPrefix: 'SlotForgeTiming'") && has(main, "userAgent: 'SlotForge-Timing'"), 'the names of this app');
  assert(has(main, 'e.sender !== mainWin.webContents'), 'only the own page may ask');
  assert(has(main, 'updateCheck?.stop()'), 'a check or a download is abandoned when the app quits');
  assert(has(main, 'lifecycle.settings().updateCheck === false'), 'a switch that was off before 2.4.0 stays off');
  assert(has(pre, "updateCheck: (action, payload) => call('update:action', String(action), payload)") && has(pre, "ipcRenderer.on('update:changed'"));
  assert(!/updateStatus|updateOpen|onUpdateStatus/.test(pre), 'the old preload calls are gone');
  const html = fs.readFileSync(path.join(__dirname, '..', 'renderer', 'index.html'), 'utf8');
  assert(html.includes('<script src="update-ui.js"></script>') && html.includes('<link rel="stylesheet" href="update-window.css">') && !html.includes('updatenotice.js'));
  assert(fs.readFileSync(path.join(__dirname, '..', 'renderer', 'update-ui.js'), 'utf8').includes('const desktop = root.api;'), 'update-ui.js reads window.api');
  const app = code('renderer/app.js');
  assert(has(app, 'id="updatehost"') && has(app, 'UpdateUI.start(UPDATE_UI)') && has(app, "keeps: 'your races, drivers and cars stay where they are'"));
  assert(!code('renderer/landing.js').includes('hm-update'), 'the notice on Home is gone');
  const pkg = require('../package.json');
  assert.equal(pkg.build.nsis.artifactName, 'SlotForgeTiming-${version}-Setup-${arch}.${ext}');
  assert.equal(pkg.build.portable.artifactName, 'SlotForgeTiming-${version}-Portable-${arch}.${ext}');
  assert.equal(pkg.build.linux.artifactName, 'SlotForgeTiming-${version}-linux-${arch}.${ext}');
  assert.equal(pkg.build.mac.artifactName, 'SlotForgeTiming-${version}-mac-${arch}.${ext}');
  assert(pkg.build.files.includes('update-check.cjs'), 'the update check is in the build');
});
