// The browser side of network access (renderer/webapi.js) against a real server on this computer.
const vm = require('vm'), fs = require('fs'), http = require('http'), path = require('path');
const { createServer } = require('../server.js');
let fails = 0;
const ok = (name, cond) => { console.log((cond ? 'ok   ' : 'FAIL ') + name); if (!cond) fails++; };
const R = path.join(__dirname, '..');
const settings = { theme: 'forest', netPassword: 'pw', rules: 'Rules!' }, cmds = [], live = { stat: { raceId: 'r1' }, dyn: { raceId: 'r1', n: 0 } };
const srv = createServer({ root: path.join(R, 'renderer'), appRoot: R, schema: { tracks: {} }, getSettings: () => settings, list: e => [{ id: 1, e }], customFields: () => [], getLive: () => live, onCommand: c => cmds.push(c), failDelay: 5 });

(async () => {
  const port = await srv.listen(0, '127.0.0.1'), origin = `http://127.0.0.1:${port}`;
  const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; };
  class EventSource { // just enough of the browser's EventSource
    constructor(url) { this.h = {}; this.req = http.get(origin + url, res => { let buf = ''; res.on('data', c => { buf += c; let i; while ((i = buf.indexOf('\n\n')) >= 0) { const blk = buf.slice(0, i); buf = buf.slice(i + 2); const ev = /event: (.*)/.exec(blk), d = /data: (.*)/.exec(blk); if (ev && d && this.h[ev[1]]) this.h[ev[1]]({ data: d[1] }); } }); }); }
    addEventListener(n, f) { this.h[n] = f; } close() { this.req.destroy(); }
  }
  const win = { location: { hash: '' } }, sandbox = { fetch: (u, o) => fetch(origin + u, o), EventSource, sessionStorage: mem(), localStorage: mem(), document: { fullscreenElement: null }, console };
  Object.assign(win, sandbox); win.window = win; vm.createContext(win);
  vm.runInContext(fs.readFileSync(R + '/renderer/webapi.js', 'utf8'), win, { filename: 'webapi.js' });
  const api = win.api;
  ok('a browser gets the api and opens on the Live Race pages', !!api && api.web === true && win.location.hash === '#live');
  const app = { api: { x: 1 } }; const w2 = { api: app.api, location: { hash: '' } }; w2.window = w2; vm.createContext(w2); vm.runInContext(fs.readFileSync(R + '/renderer/webapi.js', 'utf8'), w2);
  ok('in the app itself it does nothing', w2.api === app.api && w2.location.hash === '');
  const s = await api.getSettings(); ok('settings come from the app without the password', s.theme === 'forest' && s.rules === 'Rules!' && !('netPassword' in s));
  const s2 = await api.setSettings({ liveBoard: { design: 'R1' }, theme: 'light' });
  ok('a choice made on this device stays on this device', s2.liveBoard.design === 'R1' && s2.theme === 'light' && settings.theme === 'forest' && !('liveBoard' in settings) && (await api.getSettings()).liveBoard.design === 'R1');
  ok('the database can be read', (await api.list('drivers'))[0].e === 'drivers' && (await api.schema()).tracks !== undefined);
  let failed = false; try { await api.add('drivers', {}); } catch { failed = true; } ok('...but not written', failed);
  { const refused = []; for (const f of ['addCustomField', 'removeCustomField', 'setCustomFieldGroup']) { try { await api[f]('slotcars', 'x', 'basics'); refused.push(false); } catch { refused.push(true); } } ok('...and the extra fields (adding, deleting, moving to another group) cannot be changed from a browser either', refused.every(x => x)); }
  const g = await api.liveGet(); ok('the running race is fetched', g.stat.raceId === 'r1' && g.dyn.n === 0);
  const seen = []; const off = api.onLive(d => seen.push(d)); const offS = api.onLiveStatic(d => seen.push({ s: d }));
  await new Promise(r => setTimeout(r, 100)); srv.broadcast('static', { raceId: 'r2' }); srv.broadcast('push', { raceId: 'r2', n: 5 }); await new Promise(r => setTimeout(r, 150));
  ok('live messages arrive in the browser', seen.some(x => x.s && x.s.raceId === 'r2') && seen.some(x => x.n === 5));
  off(); offS();
  ok('the Race Director asks for a login first', api.directorAuthed() === false && (await api.directorInfo()).passwordSet === true);
  await api.liveCommand({ type: 'start' }); ok('commands are refused before logging in', cmds.length === 0);
  let code = ''; try { await api.directorLogin('wrong'); } catch (e) { code = e.code; } ok('a wrong password is refused', code === 'wrong' && !api.directorAuthed());
  await api.directorLogin('pw'); ok('the right password logs in', api.directorAuthed() === true);
  await api.liveCommand({ type: 'pause' }); await api.liveCommand({ type: 'penalty', lane: 0, n: 1 }); await new Promise(r => setTimeout(r, 50));
  ok('commands reach the race', cmds.length === 2 && cmds[0].type === 'pause' && cmds[1].lane === 0);
  { // the Tokens page (Time Token Sessions) uses the same login and the same way to the race
    const before = cmds.length, send = async c => { await api.liveCommand(c); await new Promise(r => setTimeout(r, 15)); };
    for (const c of [{ type: 'addtime', lane: 1, minutes: 10 }, { type: 'addtime', lane: 0, minutes: 7.5 }, { type: 'reducetime', lane: 1, minutes: 2 }, { type: 'undotime', lane: 1 }, { type: 'endtime', lane: 1 }, { type: 'cleartime', lane: 1 }, { type: 'setdriver', lane: 2, driverId: 'd3' }, { type: 'setdriver', lane: 2, driverId: '' }]) await send(c);
    ok('the Tokens page commands (add time, take time off, undo, end now, clear, driver) reach the race after the login', cmds.slice(before).map(c => c.type).join() === 'addtime,addtime,reducetime,undotime,endtime,cleartime,setdriver,setdriver' && cmds[before].minutes === 10 && cmds[before + 1].minutes === 7.5 && cmds[before + 2].minutes === 2 && cmds[before + 6].driverId === 'd3' && cmds[before + 7].driverId === '');
    const n = cmds.length;
    for (const bad of [{ type: 'addtime', lane: 1, minutes: 0 }, { type: 'addtime', lane: 1, minutes: -5 }, { type: 'addtime', lane: 1, minutes: 1441 }, { type: 'addtime', lane: 1, minutes: '10' }, { type: 'addtime', lane: 1 }, { type: 'addtime', lane: 1, minutes: null }, { type: 'addtime', lane: -1, minutes: 5 }, { type: 'addtime', lane: 16, minutes: 5 }, { type: 'addtime', lane: 1.5, minutes: 5 }, { type: 'addtime', lane: '1', minutes: 5 }, { type: 'addtime', minutes: 5 }, { type: 'reducetime', lane: 1, minutes: 0 }, { type: 'reducetime', lane: 1, minutes: -1 }, { type: 'reducetime', lane: 1, minutes: 1441 }, { type: 'reducetime', lane: 1, minutes: '5' }, { type: 'reducetime', lane: 16, minutes: 5 }, { type: 'reducetime', minutes: 5 },
      { type: 'undotime' }, { type: 'endtime', lane: 'x' }, { type: 'cleartime', lane: null }, { type: 'setdriver', lane: 1, driverId: 5 }, { type: 'setdriver', lane: 1 }, { type: 'setdriver', lane: 1, driverId: 'x'.repeat(81) }, { type: 'settime', lane: 1, minutes: 5 }]) await send(bad);
    ok('...a lane or a number that makes no sense is refused by the server and never reaches the race (24 tries)', cmds.length === n);
    const T = require('../server.js').tokenCommand;
    ok('...the check itself: only the Tokens page commands are looked at, the others pass as before', T({ type: 'start' }) && T({ type: 'penalty', lane: 'x', n: 1 }) && T({ type: 'addtime', lane: 15, minutes: 1440 }) && T({ type: 'reducetime', lane: 3, minutes: 1 }) && !T({ type: 'reducetime', lane: 3, minutes: Infinity }) && T({ type: 'addtime', lane: 0, minutes: 0.5 }) && !T({ type: 'addtime', lane: 0, minutes: Infinity }) && !T({ type: 'addtime', lane: 0, minutes: NaN }));
  }
  { // Balance of Power (the lane controls of the Race Director page) uses the same login and the same way to the race
    const before = cmds.length, send = async c => { await api.liveCommand(c); await new Promise(r => setTimeout(r, 15)); };
    for (const c of [{ type: 'bop', lane: 0, how: 'hinder' }, { type: 'bop', lane: 1, how: 'help' }, { type: 'bop', lane: 1, how: 'off' }, { type: 'bop', lane: 0, how: 'auto' }, { type: 'bop', lane: 15, how: 'accept' }]) await send(c);
    ok('the Balance of Power commands (Hinder, Help, Off, Auto, Accept for a lane) reach the race after the login', cmds.slice(before).map(c => c.how).join() === 'hinder,help,off,auto,accept' && cmds.slice(before).every(c => c.type === 'bop') && cmds[before + 4].lane === 15);
    const n = cmds.length;
    for (const bad of [{ type: 'bop', lane: 1, how: 'dance' }, { type: 'bop', lane: 1 }, { type: 'bop', lane: 1, how: 5 }, { type: 'bop', lane: 1, how: null }, { type: 'bop', how: 'off' }, { type: 'bop', lane: -1, how: 'off' }, { type: 'bop', lane: 16, how: 'off' }, { type: 'bop', lane: 1.5, how: 'off' }, { type: 'bop', lane: '1', how: 'off' }, { type: 'bop', lane: null, how: 'off' }]) await send(bad);
    ok('...a lane or a button that makes no sense is refused by the server and never reaches the race (10 tries)', cmds.length === n); }
  { // the weather (the buttons of the Race Director page)
    const before = cmds.length, send = async c => { await api.liveCommand(c); await new Promise(r => setTimeout(r, 15)); };
    for (const c of [{ type: 'weather', state: 'dry' }, { type: 'weather', state: 'cloudy' }, { type: 'weather', state: 'wet' }, { type: 'weather', state: 'clearing' }]) await send(c);
    ok('the weather commands (Dry, Cloudy, Wet, Clearing) reach the race after the login', cmds.slice(before).map(c => c.state).join() === 'dry,cloudy,wet,clearing' && cmds.slice(before).every(c => c.type === 'weather'));
    const n = cmds.length;
    for (const bad of [{ type: 'weather' }, { type: 'weather', state: 'sunny' }, { type: 'weather', state: 5 }, { type: 'weather', state: null }, { type: 'weather', state: ['wet'] }, { type: 'weather', state: 'WET' }, { type: 'weather', state: '' }]) await send(bad);
    ok('...a weather that is not one is refused by the server and never reaches the race (7 tries)', cmds.length === n);
    ok('...the check itself is exported, and looks only at the weather command', require('../server.js').weatherCommand({ type: 'weather', state: 'wet' }) && !require('../server.js').weatherCommand({ type: 'weather', state: 'hail' }) && require('../server.js').weatherCommand({ type: 'start' })); }
  { // 1.9.0: the swaps of an Endurance Race can be pressed on the Race Director page (a lane, and for the driver who steps in the id of a driver)
    const before = cmds.length, send = async c => { await api.liveCommand(c); await new Promise(r => setTimeout(r, 15)); };
    for (const c of [{ type: 'swap', lane: 0 }, { type: 'swap', lane: 3, to: 'd2' }, { type: 'swapnext', lane: 1, id: 'd3' }]) await send(c);
    ok('the swap commands (Swap done with or without the driver who steps in, and the choice of the next driver) reach the race after the login', cmds.slice(before).map(c => c.type + (c.to || c.id || '')).join() === 'swap,swapd2,swapnextd3');
    const n = cmds.length;
    for (const bad of [{ type: 'swap' }, { type: 'swap', lane: -1 }, { type: 'swap', lane: 16 }, { type: 'swap', lane: 1.5 }, { type: 'swap', lane: '1' }, { type: 'swap', lane: 0, to: 5 }, { type: 'swap', lane: 0, to: 'x'.repeat(81) }, { type: 'swapnext', lane: 0 }, { type: 'swapnext', lane: 0, id: '' }, { type: 'swapnext', lane: 0, id: 7 }, { type: 'swapnext', id: 'd1' }, { type: 'swapnext', lane: 99, id: 'd1' }]) await send(bad);
    ok('...a lane that is not a whole number from 0 to 15, a driver that is not an id, or a missing choice is refused by the server and never reaches the race (12 tries)', cmds.length === n);
    const S = require('../server.js');
    ok('...the check itself is exported, and looks only at the swap commands', S.swapCommand({ type: 'swap', lane: 2 }) && S.swapCommand({ type: 'swapnext', lane: 2, id: 'a' }) && !S.swapCommand({ type: 'swap', lane: 99 }) && !S.swapCommand({ type: 'swapnext', lane: 0 }) && S.swapCommand({ type: 'start' }) && S.swapCommand({ type: 'penalty', lane: 99 })); }
  settings.netPassword = 'new'; await api.liveCommand({ type: 'stop' });
  ok('after the password changes the login is gone', cmds.length === 2 + 8 + 5 + 4 + 3 && api.directorAuthed() === false);
  await srv.close();
  console.log(fails ? fails + ' WEB TESTS FAILED' : 'ALL WEB TESTS PASSED'); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('ERROR', e.stack); process.exit(1); });
