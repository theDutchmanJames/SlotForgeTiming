'use strict';
// Phase 1: the check for a newer release on GitHub (notify only), the Home notice, and Save diagnostics.
const { test } = require('node:test'),
  assert = require('node:assert/strict');
const U = require('../update-check'),
  D = require('../diagnostics'),
  N = require('../renderer/updatenotice');

const release = (tag, extra = {}) => ({ tag_name: tag, name: 'SlotForge Timing ' + tag, html_url: U.PAGE + 'tag/' + tag, published_at: '2026-12-01T10:00:00Z', draft: false, prerelease: false, ...extra });
const fakeFetch = (answer, calls = []) => async (url, opts) => {
  calls.push({ url, opts });
  if (answer instanceof Error) throw answer;
  return { ok: answer.status ? answer.status < 400 : true, status: answer.status || 200, json: async () => answer.body };
};
const memory = (start = null) => {
  let v = start;
  return { read: () => v, write: x => (v = JSON.parse(JSON.stringify(x))), get: () => v };
};

test('versions compare by number, a leading v and a pre-release tag do not matter', () => {
  assert.equal(U.newer('2.10.0', '2.9.3'), true);
  assert.equal(U.newer('v2.2.5', '2.2.4'), true);
  assert.equal(U.newer('2.2.4', '2.2.4'), false);
  assert.equal(U.newer('2.2.3', '2.2.4'), false);
  assert.equal(U.newer('3.0.0-beta.1', '2.9.9'), true);
  assert.equal(U.newer('nonsense', '2.2.4'), false);
});

test('only a real release of this app is offered: no draft, no pre-release, and the link must be its release page', () => {
  assert.equal(U.releaseOf(release('v2.3.0')).version, '2.3.0');
  assert.equal(U.releaseOf(release('v2.3.0', { draft: true })), null);
  assert.equal(U.releaseOf(release('v2.3.0', { prerelease: true })), null);
  assert.equal(U.releaseOf(release('v2.3.0', { html_url: 'https://evil.example/download' })), null);
  assert.equal(U.releaseOf({ tag_name: 'x' }), null);
});

test('a newer release is reported; the request carries only the app version; the answer is kept', async () => {
  const calls = [],
    store = memory();
  const c = U.createUpdateChecker({ currentVersion: '2.2.4', fetch: fakeFetch({ body: release('v2.3.0') }, calls), store, now: () => Date.parse('2026-12-02T00:00:00Z') });
  const s = await c.check();
  assert.equal(s.available, true);
  assert.equal(s.latest.version, '2.3.0');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, U.RELEASES);
  assert.deepEqual(Object.keys(calls[0].opts.headers).sort(), ['Accept', 'User-Agent']);
  assert.equal(calls[0].opts.headers['User-Agent'], 'SlotForge-Timing/2.2.4');
  assert.equal(store.get().latest.version, '2.3.0');
});

test('at most one request in 12 hours, also after a restart; Check now always asks', async () => {
  let t = Date.parse('2026-12-02T00:00:00Z');
  const calls = [],
    store = memory();
  const make = () => U.createUpdateChecker({ currentVersion: '2.2.4', fetch: fakeFetch({ body: release('v2.2.4') }, calls), store, now: () => t });
  await make().check();
  t += 60 * 60 * 1000;
  const again = make(); // (a restart: the answer comes from the profile)
  assert.equal((await again.check()).available, false);
  assert.equal(calls.length, 1, 'no second request within 12 hours');
  await again.check(true);
  assert.equal(calls.length, 2, 'Check now asks');
  t += 13 * 60 * 60 * 1000;
  await again.check();
  assert.equal(calls.length, 3, 'after 12 hours it asks again');
});

test('offline or an error from GitHub: no notice, the reason is kept, nothing breaks', async () => {
  const c1 = U.createUpdateChecker({ currentVersion: '2.2.4', fetch: fakeFetch(new Error('getaddrinfo ENOTFOUND')), store: memory() });
  const s1 = await c1.check();
  assert.equal(s1.available, false);
  assert.match(s1.error, /ENOTFOUND/);
  const c2 = U.createUpdateChecker({ currentVersion: '2.2.4', fetch: fakeFetch({ status: 403, body: {} }), store: memory() });
  assert.match((await c2.check()).error, /403/);
  // a release known from before stays known when a later check fails
  const store = memory({ checkedAt: '2026-01-01T00:00:00Z', latest: { version: '2.3.0', url: U.PAGE + 'tag/v2.3.0', name: 'x', publishedAt: '' } });
  const c3 = U.createUpdateChecker({ currentVersion: '2.2.4', fetch: fakeFetch(new Error('offline')), store });
  assert.equal((await c3.check()).available, true);
});

test('the Home notice shows a newer version once, says to back up first, and Not now hides that version', () => {
  const s = { available: true, enabled: true, current: '2.2.4', latest: { version: '2.3.0', url: U.PAGE + 'tag/v2.3.0', publishedAt: '2026-12-01T10:00:00Z' } };
  const html = N.homeHtml(s, {});
  assert.match(html, /SlotForge Timing 2\.3\.0 is available/);
  assert.match(html, /You have 2\.2\.4/);
  assert.match(html, /Back up first/);
  assert.match(html, /data-update="open"/);
  assert.match(html, /data-update="later"/);
  assert.equal(N.homeHtml(s, { updateDismissed: '2.3.0' }), '', 'Not now hides this version');
  assert.notEqual(N.homeHtml({ ...s, latest: { ...s.latest, version: '2.4.0' } }, { updateDismissed: '2.3.0' }), '', 'an even newer one shows again');
  assert.equal(N.homeHtml({ ...s, enabled: false }, {}), '', 'checks switched off: no notice');
  assert.equal(N.homeHtml({ available: false }, {}), '');
  assert.match(N.statusText({ ...s, checkedAt: '2026-12-02T00:00:00Z' }), /Version 2\.3\.0 is available/);
  assert.match(N.statusText({ enabled: false }), /off/);
});

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

test('the app wires it: settings folder, preload calls, main handlers, Home', () => {
  const { code, has } = require('./source.cjs');
  assert(has(code('preload.js'), "updateStatus: () => call('update:status')") && has(code('preload.js'), "diagnosticsSave: () => call('diagnostics:save')"));
  const main = code('main.js');
  for (const ch of ["'update:status'", "'update:check'", "'update:open'", "'diagnostics:save'"]) assert(has(main, 'ipcMain.handle(' + ch), ch);
  assert(has(main, 'lifecycle.settings().updateCheck !== false'), 'the switch in App Settings is obeyed');
  assert(has(code('renderer/app.js'), 'id="updcheck"') && has(code('renderer/app.js'), 'id="diagsave"'));
  assert(has(code('renderer/landing.js'), '<div id="hm-update" hidden></div>'));
});
