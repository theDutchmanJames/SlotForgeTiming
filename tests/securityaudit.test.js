// Audit fixes (2.2.5): what a race layout, the Live Race window and the local-network pages may do with text that users or files supply.
// - a custom tyre name (and the weather words) reach the "Text for a lane/race" widgets escaped, like every other {variable}
// - the app windows have a Content-Security-Policy and only ever show index.html (no navigation, no new windows)
// - the network server only answers local addresses, drops a browser that stops reading the live updates, and keeps a driver's date of birth on this computer
const fs = require('fs'), path = require('path'), net = require('net');
const Wx = require('../renderer/weather.js'), WW = require('../renderer/weatherwidgets.js'), Wd = require('../renderer/widgets.js');
const { createServer, localHost, publicList } = require('../server.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = path.join(__dirname, '..');

// ---- the text widgets ----
const evil = '<img src=x onerror=alert(1)>';
const tyres = { C_0123456789ABCDEF: { name: evil, icon: 'S', cls: 'dry' } };
const eng = { cfg: { tyrewear: { tyres } } };
const vars = WW.laneVars({ tyre: 'C_0123456789ABCDEF' }, eng);
ok('a custom tyre name is escaped in the {tyre} variable', vars.tyre === '&lt;img src=x onerror=alert(1)&gt;');
const html = Wd.fillText('Tyre: {tyre}', vars);
ok('...so a "Text for a lane" widget shows the name and adds no element', html === 'Tyre: &lt;img src=x onerror=alert(1)&gt;' && !/<img/i.test(html));
ok('a standard tyre still reads as before', WW.laneVars({ tyre: 'S' }, { cfg: {} }).tyre === Wx.tyreName('S') && WW.laneVars(null, eng).tyre === '–');
const rv = WW.raceVars({ weather: null }, 0);
ok('the weather words are plain text without a weather system', rv.weather === '–' && rv.nextweather === '');
const amp = { cfg: { tyrewear: { tyres: { C_00000000000000AA: { name: 'Soft & Sticky', icon: 'S', cls: 'dry' } } } } };
const rule = value => ({ image: 'base', rules: [{ image: 'hit', var: 'tyre', op: '=', value }] });
ok('an image rule on the tyre name still matches a standard tyre', Wd.pickImage(rule(Wx.tyreName('S')), WW.laneVars({ tyre: 'S' }, { cfg: {} })) === 'hit');
ok('...and a custom name with & in it (rules compare the plain text)', WW.laneVars({ tyre: 'C_00000000000000AA' }, amp).tyre === 'Soft &amp; Sticky' && Wd.pickImage(rule('Soft & Sticky'), WW.laneVars({ tyre: 'C_00000000000000AA' }, amp)) === 'hit' && Wd.pickImage(rule('Hard'), WW.laneVars({ tyre: 'C_00000000000000AA' }, amp)) === 'base');

// ---- the app windows ----
const index = fs.readFileSync(path.join(R, 'renderer/index.html'), 'utf8');
const csp = (index.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/) || [])[1] || '';
ok('index.html has a Content-Security-Policy', !!csp);
ok("...scripts only from the app itself (no inline script, no eval)", /script-src 'self'(;|$)/.test(csp) && !/unsafe-eval/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp));
ok('...no plugins, frames, base or form targets', /object-src 'none'/.test(csp) && /frame-src 'none'/.test(csp) && /base-uri 'none'/.test(csp) && /form-action 'none'/.test(csp));
ok('...pictures and sounds may still be data and blob links (picture and audio sets)', /img-src 'self' data: blob:/.test(csp) && /media-src 'self' data: blob:/.test(csp));
ok('index.html has no inline script the policy would block', !/<script(?![^>]*\ssrc=)[^>]*>/i.test(index));
const main = fs.readFileSync(path.join(R, 'main.js'), 'utf8');
ok('main.js guards the main window and the Live Race window', (main.match(/guardWindow\((win|liveWin)\)/g) || []).length === 2);
ok('...they deny new windows and navigation to any other page than the one they show', /setWindowOpenHandler\(\(\) => \(\{ action: 'deny' \}\)\)/.test(main) && /'will-navigate', \(event, url\) => \{ if \(page\(url\) !== page\(w\.webContents\.getURL\(\)\)\) event\.preventDefault\(\); \}/.test(main));
{ // the guard itself, with a stand-in window: the same page (another #view) passes, any other page is stopped; Windows paths with a lower-case drive or % pass as Electron wrote them
  const src = main.slice(main.indexOf('function guardWindow'), main.indexOf('async function createWindow'));
  const guard = new Function('path', src + '; return guardWindow;')(path);
  const check = (loaded, to) => { let h = null, stopped = false; guard({ webContents: { setWindowOpenHandler: () => {}, on: (n, f) => { h = f; }, getURL: () => loaded } }); h({ preventDefault: () => { stopped = true; } }, to); return !stopped; };
  const home = 'file:///c:/Program%20Files/Slot%Forge/resources/app.asar/renderer/index.html';
  ok('the window guard lets the page go to another part of itself', check(home, home + '#live') && check(home + '#live', home) && check(home + '?qa=1', home + '#x'));
  ok('...and stops any other page, file or web address', !check(home, 'file:///c:/Users/me/Downloads/evil.html') && !check(home, 'https://example.com/') && !check(home, home.replace('index.html', 'startup.html')));
}

// ---- the browser on another device: after the live stream reconnects it fetches the whole state again ----
{
  const vm = require('vm'), fetched = [], statics = [];
  let es = null;
  class FakeES { constructor(u) { this.url = u; this.l = {}; es = this; } addEventListener(n, f) { (this.l[n] = this.l[n] || []).push(f); } fire(n, e) { (this.l[n] || []).forEach(f => f(e || {})); } }
  const ctx = { window: {}, location: { hash: '#live' }, EventSource: FakeES, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} }, localStorage: { getItem: () => null, setItem() {} },
    fetch: async u => { fetched.push(u); return { ok: true, json: async () => ({ stat: { raceId: 'r', v: fetched.length } }) }; }, Promise, JSON, setTimeout };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync(path.join(R, 'renderer/webapi.js'), 'utf8'), ctx);
  ctx.window.api.onLiveStatic(s => statics.push(s));
  es.fire('open');
  ok('the first connection of the live stream fetches nothing extra', fetched.length === 0);
  es.fire('open');
  setTimeout(() => ok('...a reconnect fetches the live state and hands the picture snapshot to the page again', fetched.join() === '/api/live' && statics.length === 1 && statics[0].raceId === 'r'), 20);
}

// ---- the network server ----
ok('local addresses are accepted', ['192.168.1.20:8080', '10.0.0.5', 'localhost:3000', 'localhost.', '[::1]:80', 'fe80::1', 'pit-pc:8080', 'timing.local', 'timing.lan', 'box.home.arpa', 'racepc.fritz.box', 'racepc.localdomain', require('os').hostname() + '.example.com', '', undefined].every(localHost));
ok('a public web address is refused (DNS rebinding)', !['evil.com', 'a.b.evil.com:8080', 'timing.example.org'].some(localHost));
ok("a driver's date of birth is left out of the list other devices read", JSON.stringify(publicList('drivers', [{ id: 'd', name: 'Ann', dateOfBirth: '2001-02-03', flag: 'nl' }])) === '[{"id":"d","name":"Ann","flag":"nl"}]');
ok('...other lists are unchanged', JSON.stringify(publicList('tracks', [{ id: 't', dateOfBirth: 'x' }])) === '[{"id":"t","dateOfBirth":"x"}]' && publicList('drivers', null) === null);

const srv = createServer({ maxLagMs: 300, root: path.join(R, 'renderer'), appRoot: R, schema: {}, getSettings: () => ({}), list: e => [{ id: 'd1', name: 'Ann', dateOfBirth: '2001-02-03' }], customFields: () => [], getLive: () => ({}), command: () => true });
const raw = (port, text) => new Promise(resolve => { const s = net.connect(port, '127.0.0.1', () => s.write(text)); const parts = []; s.on('data', d => parts.push(d)); s.on('end', () => resolve(Buffer.concat(parts).toString())); s.on('error', () => resolve(Buffer.concat(parts).toString())); });
const wait = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const port = await srv.listen(0, '127.0.0.1');
  let r = await raw(port, 'GET /api/list/drivers HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
  ok('the drivers list is served to a local address, without the date of birth', r.startsWith('HTTP/1.1 200') && r.includes('"Ann"') && !r.includes('2001-02-03'));
  r = await raw(port, 'GET /api/list/drivers HTTP/1.1\r\nHost: evil.example.com\r\nConnection: close\r\n\r\n');
  ok('...and refused when the browser came through a public name', r.startsWith('HTTP/1.1 421') && !r.includes('"Ann"'));

  // a browser that opens the live updates and then stops reading
  const stalled = net.connect(port, '127.0.0.1', () => stalled.write('GET /events HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n'));
  stalled.on('error', () => {});
  await wait(150); stalled.pause();
  ok('a browser that opens the live updates is a client', srv.clientCount() === 1);
  const big = { pad: 'x'.repeat(1024 * 1024) };
  for (let i = 0; i < 400 && srv.clientCount(); i++) { srv.broadcast('push', big); await wait(5); }
  ok('...and is dropped once it has stayed far behind, instead of growing the memory of Timing', srv.clientCount() === 0);
  stalled.destroy();

  // a browser that keeps reading is not dropped
  const reader = net.connect(port, '127.0.0.1', () => reader.write('GET /events HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n'));
  let got = 0; reader.on('data', d => { got += d.length; }); reader.on('error', () => {});
  await wait(150);
  for (let i = 0; i < 40; i++) { srv.broadcast('push', big); await wait(15); }
  await wait(300);
  ok('a browser that keeps up stays connected and gets every update', srv.clientCount() === 1 && got > 40 * 1024 * 1024);
  // one very big picture snapshot is not a stall: a reader stays connected while it arrives
  srv.broadcast('static', { pad: 'y'.repeat(24 * 1024 * 1024) }); for (let i = 0; i < 10; i++) { srv.broadcast('push', { n: i }); await wait(40); }
  await wait(600); srv.broadcast('push', { n: 'last' }); await wait(200);
  ok('...also after a picture snapshot larger than the backlog limit', srv.clientCount() === 1 && got > 64 * 1024 * 1024);
  reader.destroy(); await wait(50);
  // more browsers than the limit: the oldest connection makes room for the newest
  const many = [], closed = new Set(); for (let i = 0; i < 65; i++) { const s = net.connect(port, '127.0.0.1', () => s.write('GET /events HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n')); s.on('error', () => {}); s.on('data', () => {}); s.on('close', () => closed.add(i)); many.push(s); await wait(8); }
  await wait(200);
  ok('at most 64 browsers follow at once; the oldest makes room for the newest', srv.clientCount() === 64 && closed.has(0) && closed.size === 1);
  many.forEach(s => s.destroy()); await wait(50);
  await srv.close();
  console.log(fails ? `${fails} FAILED` : 'SECURITY AUDIT TESTS PASSED');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
