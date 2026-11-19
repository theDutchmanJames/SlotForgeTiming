'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const U = require('../update-check.cjs');

const HOME = 'https://github.com/theDutchmanJames/SlotForgeCircuit';
const REPO = 'theDutchmanJames/SlotForgeCircuit';

function answer(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}
const files = tag => {
  const v = tag.replace(/^v/, '');
  return ['Setup-x64.exe', 'Portable-x64.exe', 'mac-universal.dmg', 'linux-x86_64.AppImage', 'linux-amd64.deb'].map(
    (end, i) => ({ name: `SlotForgeCircuit-${v}-${end}`, size: 1000 + i, digest: `sha256:${'a'.repeat(64)}` })
  );
};
const latest = (tag, extra = {}) => ({
  assets: files(tag),
  tag_name: tag,
  html_url: `${HOME}/releases/tag/${tag}`,
  name: `Release ${tag}`,
  published_at: '2026-11-17T08:00:00Z',
  draft: false,
  prerelease: false,
  ...extra,
});

function fixture(
  t,
  {
    current = '1.6.0',
    reply = () => answer(latest('v1.7.0')),
    automatic = true,
    edition = { platform: 'win32', arch: 'x64' },
  } = {}
) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-update-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  const clock = { now: Date.UTC(2026, 10, 17, 12) };
  const calls = [];
  const make = () =>
    new U.UpdateCheck({
      profile,
      current,
      homepage: HOME,
      automatic,
      edition,
      downloads: path.join(profile, 'Downloads'),
      now: () => clock.now,
      fetch: async (url, init) => {
        calls.push({ url, init });
        return reply(url, init);
      },
    });
  return { profile, clock, calls, make, u: make() };
}

test('version numbers are compared numerically', () => {
  assert.equal(U.compare('1.10.0', '1.9.9'), 1);
  assert.equal(U.compare('v1.6.0', '1.6.0'), 0);
  assert.equal(U.compare('1.6.0', '1.6.1'), -1);
  assert.equal(U.compare('2.0.0', '1.99.99'), 1);
  assert.equal(U.parse('1.7.0-beta.1'), null);
  assert.equal(U.repository(HOME), REPO);
  assert.equal(U.repository(HOME + '.git'), REPO);
  assert.throws(() => U.repository('https://example.com/x/y'), /releases/);
});

test('finds a newer release and asks GitHub only for the latest release', async t => {
  const f = fixture(t);
  const s = await f.u.check();
  assert.equal(f.calls.length, 1);
  assert.equal(f.calls[0].url, `https://api.github.com/repos/${REPO}/releases/latest`);
  assert.equal(f.calls[0].init.headers['User-Agent'], 'SlotForge-Circuit/1.6.0');
  assert.equal(s.latest.version, '1.7.0');
  assert.equal(s.checking, false, 'the returned status is final');
  assert.equal(s.notify, true);
  assert.equal(s.lastCheck, f.clock.now);
  assert.equal(f.u.releaseUrl(), `${HOME}/releases/tag/v1.7.0`);
  // Remembered across restarts.
  assert.equal(f.make().status().latest.version, '1.7.0');
});

test('same or older release: up to date, no notice', async t => {
  for (const tag of ['v1.6.0', 'v1.5.9']) {
    const f = fixture(t, { reply: () => answer(latest(tag)) });
    const s = await f.u.check();
    assert.equal(s.latest, null);
    assert.equal(s.upToDate, true);
    assert.equal(s.notify, false);
    assert.throws(() => f.u.releaseUrl(), /no newer version/);
  }
});

test('after updating Circuit the stored newer release no longer shows', async t => {
  const f = fixture(t);
  await f.u.check();
  const updated = new U.UpdateCheck({
    profile: f.profile,
    current: '1.7.0',
    homepage: HOME,
    fetch: async () => answer(latest('v1.7.0')),
    now: () => f.clock.now,
  });
  assert.equal(updated.status().latest, null);
  assert.equal(updated.status().notify, false);
  assert.equal(updated.status().upToDate, true);
});

test('Skip hides the pop-up until an even newer version appears', async t => {
  let tag = 'v1.7.0';
  const f = fixture(t, { reply: () => answer(latest(tag)) });
  await f.u.check();
  assert.throws(() => f.u.skip('1.8.0'), /no longer the latest/);
  const s = f.u.skip('1.7.0');
  assert.equal(s.notify, false);
  assert.equal(s.latest.version, '1.7.0', 'still offered in Settings');
  assert.equal(f.make().status().notify, false);
  tag = 'v1.8.0';
  const later = await f.u.startupCheck();
  assert.equal(later.latest.version, '1.8.0');
  assert.equal(later.notify, true);
});

test('checks once at start when it is on, never when off or in development; Check now always works', async t => {
  const f = fixture(t);
  const s1 = await f.u.startupCheck();
  assert.equal(f.calls.length, 1);
  assert.equal(s1.notify, true);
  // Every start checks again; there is no timer in between.
  await f.make().startupCheck();
  assert.equal(f.calls.length, 2);
  f.u.setEnabled(false);
  assert.equal(await f.make().startupCheck(), null);
  assert.equal(f.calls.length, 2);
  assert.equal(f.u.status().notify, false, 'no pop-up when turned off');
  const offline = fixture(t, { reply: () => Promise.reject(Error('offline')) });
  assert.equal(await offline.u.startupCheck(), null, 'a failure at start is not thrown');
  assert.match(offline.u.status().lastError, /could not reach GitHub/);
  const dev = fixture(t, { automatic: false });
  await dev.u.startupCheck();
  assert.equal(dev.calls.length, 0);
  await dev.u.check();
  assert.equal(dev.calls.length, 1, 'Check now still works');
});

test('rejects unexpected answers without changing the known release', async t => {
  const cases = [
    [answer('not json'), /unexpected answer/],
    [answer(latest('v1.7.0', { draft: true })), /unpublished/],
    [answer(latest('v1.7.0', { prerelease: true })), /unpublished/],
    [answer(latest('nightly')), /version number/],
    [answer(latest('v1.7.0/../../../evil')), /version number/],
    [answer(latest('1.7.0-beta')), /version number/],
    [answer('x'.repeat(1024 * 1024 + 1)), /large/],
    [answer('', 404), /No published release/],
    [answer('', 403), /wait/],
    [answer('', 500), /\(500\)/],
  ];
  for (const [reply, message] of cases) {
    const f = fixture(t, { reply: () => reply });
    await assert.rejects(f.u.check(), message);
    assert.equal(f.u.status().latest, null);
    assert.equal(f.u.status().lastCheck, null);
  }
});

test('a damaged settings file falls back to safe defaults', t => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.profile, 'update-check.json'), '{broken');
  assert.equal(f.make().status().enabled, true);
  fs.writeFileSync(
    path.join(f.profile, 'update-check.json'),
    JSON.stringify({
      version: 1,
      enabled: 'no',
      latest: { tag: 'v9.9.9/../../evil', url: 'https://evil.example/x' },
      skipped: 'all',
    })
  );
  const s = f.make().status();
  assert.equal(s.enabled, true);
  assert.equal(s.latest, null, 'an unsafe stored tag is ignored');
});

test('the page to open is built from this repository and the version only', async t => {
  const f = fixture(t, { reply: () => answer(latest('v1.7.0', { html_url: 'https://evil.example/x' })) });
  await f.u.check();
  assert.equal(f.u.releaseUrl(), `${HOME}/releases/tag/v1.7.0`);
  assert.equal(U.pageUrl(REPO, '1.7.0'), `${HOME}/releases/tag/1.7.0`);
});

test('the pop-up waits until the file for this copy is attached to the release', async t => {
  let assets = files('v1.7.0').filter(a => /Setup|Portable/.test(a.name));
  const f = fixture(t, {
    edition: { platform: 'darwin', arch: 'arm64' },
    reply: () => answer(latest('v1.7.0', { assets })),
  });
  let s = await f.u.check();
  assert.equal(s.latest.version, '1.7.0', 'Settings already shows it');
  assert.equal(s.latest.file, null);
  assert.equal(s.notify, false);
  assets = files('v1.7.0');
  s = await f.u.check();
  assert.equal(s.latest.file.name, 'SlotForgeCircuit-1.7.0-mac-universal.dmg');
  assert.equal(s.notify, true);
});

test('Skip stays quiet if the newest release is withdrawn and an older one becomes latest', async t => {
  let tag = 'v1.8.0';
  const f = fixture(t, { reply: () => answer(latest(tag)) });
  await f.u.check();
  f.u.skip('1.8.0');
  tag = 'v1.7.0';
  const s = await f.u.check();
  assert.equal(s.latest.version, '1.7.0');
  assert.equal(s.notify, false);
});

test('a missing or odd homepage never stops Circuit from opening', async t => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-update-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  const u = new U.UpdateCheck({
    profile,
    current: '1.6.0',
    homepage: undefined,
    fetch: async () => {
      throw Error('no');
    },
  });
  assert.match(u.status().lastError, /does not know/);
  assert.equal(u.status().automatic, false);
  assert.equal(await u.startupCheck(), null);
  await assert.rejects(u.check(), /does not know/);
  assert.equal(U.repository(HOME + '#readme'), REPO);
});

test('a timeout or a quit abandons the check with a clear message', async t => {
  const f = fixture(t, {
    reply: (url, init) =>
      new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('aborted')))),
  });
  const pending = f.u.check();
  f.u.stop();
  await assert.rejects(pending, /could not reach GitHub/);
  await assert.rejects(f.u.check(), /closing/);
  assert.equal(await f.u.startupCheck(), null);
});

test('a result that cannot be saved to disk is still used for this session', async t => {
  const f = fixture(t);
  fs.mkdirSync(path.join(f.profile, 'update-check.json.tmp')); // Makes the save fail.
  const s = await f.u.check();
  assert.equal(s.latest.version, '1.7.0');
  assert.equal(s.lastError, null);
});

test('setting validation', t => {
  const f = fixture(t);
  assert.throws(() => f.u.setEnabled('yes'), /Choose/);
  assert.equal(f.u.setEnabled(false).enabled, false);
  assert.equal(f.make().status().enabled, false);
});

test("What's new: only that section of the release notes, as a few plain lines", () => {
  const body = [
    'A small update.',
    '',
    "## What's new",
    '',
    '- **One car per lane:** Live preview drives a car on every lane, up to 8.',
    '  Lane 1 stays red.',
    '- A [link](https://evil.example) and `code` and <img src=x onerror=alert(1)> words',
    '',
    '## Verification',
    '',
    '- 57 unit test files passed.',
  ].join('\n');
  assert.deepEqual(U.whatsNew(body), [
    { title: 'One car per lane', text: 'Live preview drives a car on every lane, up to 8. Lane 1 stays red.' },
    { text: 'A link and code and words' },
  ]);
  assert.deepEqual(U.whatsNew('No section here.'), []);
  assert.equal(U.whatsNew('### What’s new\n' + '- x\n'.repeat(20)).length, 6, 'at most six lines');
  assert.ok(U.whatsNew("## What's new\n- " + 'y'.repeat(2000))[0].text.length <= 280, 'long lines are cut');
});

test('the download is the file for this copy of Circuit', () => {
  const r = U.release(latest('v1.7.0'));
  const pick = edition => U.fileFor(r, edition)?.name.replace('SlotForgeCircuit-1.7.0-', '');
  assert.equal(pick({ platform: 'win32', arch: 'x64' }), 'Setup-x64.exe');
  assert.equal(pick({ platform: 'win32', arch: 'x64', portable: true }), 'Portable-x64.exe');
  assert.equal(pick({ platform: 'darwin', arch: 'arm64' }), 'mac-universal.dmg');
  assert.equal(pick({ platform: 'linux', arch: 'x64', appImage: true }), 'linux-x86_64.AppImage');
  assert.equal(pick({ platform: 'linux', arch: 'x64' }), 'linux-amd64.deb');
  assert.equal(pick({ platform: 'win32', arch: 'arm64' }), undefined, 'no arm64 Windows build');
  // Odd or other names are never offered.
  const odd = U.release(
    latest('v1.7.0', {
      assets: [
        { name: '../SlotForgeCircuit-1.7.0-Setup-x64.exe', size: 5 },
        { name: 'SlotForgeCircuit-1.6.0-Setup-x64.exe', size: 5 },
        { name: 'SlotForgeCircuit-1.7.0-Setup-x64.exe', size: -1 },
      ],
    })
  );
  assert.deepEqual(odd.assets, []);
  assert.equal(
    U.fileUrl(REPO, 'v1.7.0', 'SlotForgeCircuit-1.7.0-Setup-x64.exe'),
    `${HOME}/releases/download/v1.7.0/SlotForgeCircuit-1.7.0-Setup-x64.exe`
  );
});

// A download answer that sends `bytes` in two pieces.
const stream = bytes => ({
  ok: true,
  status: 200,
  body: {
    getReader() {
      const parts = [bytes.subarray(0, 3), bytes.subarray(3)];
      return { read: async () => (parts.length ? { done: false, value: parts.shift() } : { done: true }) };
    },
  },
});
const sha = bytes => require('node:crypto').createHash('sha256').update(bytes).digest('hex');

test('Download saves the checked file in Downloads and nowhere else', async t => {
  const bytes = Buffer.from('circuit installer');
  const release = latest('v1.7.0', {
    assets: [{ name: 'SlotForgeCircuit-1.7.0-Setup-x64.exe', size: bytes.length, digest: `sha256:${sha(bytes)}` }],
  });
  const f = fixture(t, { reply: url => (url.includes('/releases/download/') ? stream(bytes) : answer(release)) });
  await f.u.check();
  const s = await f.u.startDownload();
  assert.equal(f.calls[1].url, `${HOME}/releases/download/v1.7.0/SlotForgeCircuit-1.7.0-Setup-x64.exe`);
  assert.equal(s.download.state, 'done');
  const saved = path.join(f.profile, 'Downloads', 'SlotForgeCircuit-1.7.0-Setup-x64.exe');
  assert.equal(f.u.downloadedFile(), saved);
  assert.deepEqual(fs.readFileSync(saved), bytes);
  assert.deepEqual(fs.readdirSync(path.join(f.profile, 'Downloads')), ['SlotForgeCircuit-1.7.0-Setup-x64.exe']);
});

test('a download that does not match the release is removed', async t => {
  const bytes = Buffer.from('circuit installer');
  for (const [asset, message] of [
    [{ size: bytes.length, digest: `sha256:${'0'.repeat(64)}` }, /does not match/],
    [{ size: bytes.length + 5, digest: `sha256:${sha(bytes)}` }, /incomplete/],
    [{ size: 4 }, /larger/],
  ]) {
    const release = latest('v1.7.0', { assets: [{ name: 'SlotForgeCircuit-1.7.0-Setup-x64.exe', ...asset }] });
    const f = fixture(t, { reply: url => (url.includes('/releases/download/') ? stream(bytes) : answer(release)) });
    await f.u.check();
    await assert.rejects(f.u.startDownload(), message);
    assert.equal(f.u.status().download.state, 'failed');
    assert.deepEqual(fs.readdirSync(path.join(f.profile, 'Downloads')), [], 'nothing is left behind');
    assert.throws(() => f.u.downloadedFile(), /no longer there/);
  }
});

test('a download can be cancelled, and there is none without a file for this copy', async t => {
  const release = latest('v1.7.0');
  const f = fixture(t, {
    reply: (url, init) =>
      url.includes('/releases/download/')
        ? Promise.resolve({
            ok: true,
            status: 200,
            body: {
              getReader: () => ({
                read: () =>
                  new Promise((_, reject) => init.signal.addEventListener('abort', () => reject(Error('aborted')))),
              }),
            },
          })
        : answer(release),
  });
  await f.u.check();
  const pending = f.u.startDownload();
  await new Promise(r => setTimeout(r, 10));
  assert.equal(f.u.status().download.state, 'downloading');
  f.u.cancelDownload();
  await assert.rejects(pending, /cancelled/);
  assert.equal(f.u.status().download.state, 'idle');
  const none = fixture(t, { edition: { platform: 'win32', arch: 'arm64' } });
  await none.u.check();
  await assert.rejects(none.u.startDownload(), /no download for this copy/);
});

test("What's new and the files are remembered, and checked again when read back", async t => {
  const f = fixture(t, { reply: () => answer(latest('v1.7.0', { body: "## What's new\n- **Lanes:** more cars" })) });
  await f.u.check();
  const again = f.make().status();
  assert.deepEqual(again.latest.notes, [{ title: 'Lanes', text: 'more cars' }]);
  assert.equal(again.latest.file.name, 'SlotForgeCircuit-1.7.0-Setup-x64.exe');
  const file = path.join(f.profile, 'update-check.json');
  const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  saved.latest.assets = [{ name: '../../evil.exe', size: 5 }];
  saved.latest.notes = [{ text: 5 }, { text: '<b>ok</b>' }];
  fs.writeFileSync(file, JSON.stringify(saved));
  const read = f.make().status();
  assert.equal(read.latest.file, null);
  assert.deepEqual(read.latest.notes, [{ text: 'ok' }]);
});

test('another SlotForge app uses the same code with its own names', async t => {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-update-'));
  t.after(() => fs.rmSync(profile, { recursive: true, force: true }));
  const calls = [];
  const u = new U.UpdateCheck({
    profile,
    current: '2.3.0',
    homepage: 'https://github.com/someone/SlotForgeTiming',
    appName: 'Timing',
    artifactPrefix: 'SlotForgeTiming',
    userAgent: 'SlotForge-Timing',
    edition: { platform: 'win32', arch: 'x64', portable: true },
    fetch: async (url, init) => {
      calls.push({ url, init });
      return answer({
        tag_name: 'v2.4.0',
        draft: false,
        prerelease: false,
        assets: [
          { name: 'SlotForgeCircuit-2.4.0-Portable-x64.exe', size: 9 },
          { name: 'SlotForgeTiming-2.4.0-Portable-x64.exe', size: 9 },
        ],
      });
    },
  });
  const s = await u.check();
  assert.equal(calls[0].url, 'https://api.github.com/repos/someone/SlotForgeTiming/releases/latest');
  assert.equal(calls[0].init.headers['User-Agent'], 'SlotForge-Timing/2.3.0');
  assert.equal(s.latest.file.name, 'SlotForgeTiming-2.4.0-Portable-x64.exe', 'only its own files');
  assert.equal(s.kindLabel, 'Windows · portable app');
  u.stop();
  await assert.rejects(u.check(), /Timing is closing/);
});
