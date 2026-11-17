// UI review fixes: unsaved editor drafts on window close, Average lap without pit laps, the 59.9996 s carry in Virtual Rival gaps, and a hardened PDF export window.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const R = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(R, f), 'utf8');
global.RaceEngine = require('../renderer/engine.js');
global.Stats = require('../renderer/stats.js');
let groups = 0; const group = (name, fn) => { fn(); groups++; };

group('Race Results: Average lap leaves pit laps out, as Help and Statistics.figures say', () => {
  const Results = require('../renderer/resultsview.js');
  const car = { laps: [10000, 12000, 40000, 8000, 7000], pitLaps: [2], invalid: [3], bad: [false, false, false, false, true], removed: [] };
  assert.equal(Results.value(null, car, 'average'), 11000, 'pit, invalid and bad laps are not in the average');
  const saved = [{ time: 10000 }, { time: 12000 }, { time: 40000, pit: true }];
  assert.equal(Results.value(null, { laps: [10000, 12000, 40000], pitLaps: [2] }, 'average'), Stats.figures(saved, {}).avg, 'live and saved averages agree');
  assert.equal(Results.value(null, { laps: [40000], pitLaps: [0] }, 'average'), null, 'only a pit lap: no average');
  assert.equal(Results.value(null, car, 'pit'), 1, 'pit laps are still counted as pit laps');
});

group('Multi-Class event rows: Average lap leaves pit laps out', () => {
  const MC = require('../renderer/multiclass.js');
  const H = { overall: () => [{ participant: 0, pos: 1, score: 3, laps: 3, best: 10000 }], classOverall: () => [], kind: () => 'laps' };
  const laps = [{ driverId: 'a', time: 10000 }, { driverId: 'a', time: 12000 }, { driverId: 'a', time: 40000, pit: true }, { driverId: 'a', time: 5000, invalid: true }];
  const [row] = MC.eventRows(H, [{ driverId: 'a', driverName: 'Alex' }], laps, [[0, 67000]]);
  assert.equal(row.resultStats.average, 11000); assert.equal(row.resultStats.pit, 1); assert.equal(row.resultStats.invalid, 1);
});

group('Virtual Rival gaps carry 59.9996 s to the next minute, as RaceEngine.fmtTime', () => {
  const vr = read('renderer/virtualrival.js'), from = vr.indexOf('const fmt = n => {'), line = vr.slice(from, vr.indexOf('\n  };', from) + 5); // the whole declaration, however many lines
  const fmt = vm.runInNewContext(line + ';fmt');
  for (const ms of [59999.6, 119999.6, 8500, 61234, 0.4]) assert.equal(fmt(ms), RaceEngine.fmtTime(ms), 'fmt(' + ms + ')');
  assert.equal(fmt(59999.6), '1:00.000'); assert.equal(fmt(119999.6), '2:00.000');
});

group('PDF reports escape single quotes and need no script', () => {
  const Report = require('../renderer/report.js');
  const html = Report.qrHtml({ title: "O'Brien <x> \"q\"", url: "http://h/?a='b'", svg: '' });
  assert.ok(!html.includes("O'Brien") && html.includes('O&#39;Brien'), 'a single quote is escaped');
  assert.ok(!/<script/i.test(html), 'the report has no script (the PDF window runs none)');
  const sheet = Report.heatSheetHtml({ title: "Kim's race", subtitle: '', list: [], lanes: 2 });
  assert.ok(!sheet.includes("Kim's") && !/<script/i.test(sheet));
});

group('PDF export window: no JavaScript, guarded, may load only its own file', () => {
  const main = read('main.js'), block = main.slice(main.indexOf("ipcMain.handle('pdf:export'"), main.indexOf('const bulkAccess'));
  assert.match(block, /javascript: false/); assert.match(block, /sandbox: true/); assert.match(block, /nodeIntegration: false/);
  assert.match(block, /guardWindow\(printWin\)/); assert.match(block, /onBeforeRequest\(pdfRequest\)/);
  assert.match(block, /pdfFiles\.delete/);
  const src = main.slice(main.indexOf('const pdfFiles'), main.indexOf('// Before the main window closes'));
  const { pdfFiles, pdfRequest } = new Function('path', 'require', src + ';return {pdfFiles,pdfRequest};')(path, require);
  const tmp = path.join(require('node:os').tmpdir(), 'slotforge-timing-1.html'); pdfFiles.add(path.resolve(tmp).toLowerCase());
  const allowed = url => { let c; pdfRequest({ url }, r => { c = r.cancel; }); return !c; };
  assert.ok(allowed(require('node:url').pathToFileURL(tmp).href), 'its own file loads');
  assert.ok(allowed('data:image/png;base64,AAAA'), 'inline data loads');
  assert.ok(!allowed(require('node:url').pathToFileURL(path.join(R, 'main.js')).href), 'another file does not');
  assert.ok(!allowed('https://example.com/x.png') && !allowed('http://127.0.0.1:8080/'), 'the network does not');
});

group('Window close asks about unsaved editor drafts (static wiring and the guard itself)', () => {
  const main = read('main.js'), pre = read('preload.js'), app = read('renderer/app.js'), ed = read('renderer/editor.js');
  assert.match(main, /closeGuard\(win\);/); assert.ok(!require('./source.cjs').has(main, "win.on('close',event=>{if(!shutdown.ready){event.preventDefault();app.quit();}});"), 'the old close handler is replaced');
  assert.match(main, /'Quit without saving', 'Cancel'/); assert.match(main, /setTimeout\(\(\) => done\(\[\]\), 2000\)/);
  assert.match(pre, /onUnsavedQuery:/); assert.match(pre, /ipcRenderer\.send\('app:unsaved-reply', token, list\)/);
  assert.match(app, /api\.onUnsavedQuery\(/);
  for (const n of ['state.editing', 'audEd', 'imgEd', 'wbEd', 'chartEd', 'rotEd', 'chEd', 'resourceEditor', 'multiEditor', 'rivalEditor']) assert.ok(ed.slice(ed.indexOf('function unsavedDrafts'), ed.indexOf('function editorLeave')).includes(n), 'unsavedDrafts checks ' + n);
  // the renderer side: which drafts are dirty
  const ctx = vm.createContext({ state: { editing: { dirty: true } }, audEd: { dirty: true }, imgEd: null, wbEd: { dirty: false }, chartEd: null, rotEd: null, chEd: { dirty: true }, resourceEditor: null, multiEditor: null, rivalEditor: null });
  vm.runInContext(ed.slice(ed.indexOf('function unsavedDrafts'), ed.indexOf('function editorLeave')), ctx);
  assert.equal(vm.runInContext('JSON.stringify(unsavedDrafts())', ctx), JSON.stringify(['Layout editor', 'Audio set', 'Championship']));
  vm.runInContext('state.editing=null;audEd=null;chEd=null', ctx); assert.equal(vm.runInContext('unsavedDrafts().length', ctx), 0);
});

(async () => {
  // the main-process guard with stand-ins: clean quits at once, dirty asks, Cancel keeps the app, a page that does not answer lets it quit after 2 s, a quit on its way is not asked about
  const main = read('main.js'), src = main.slice(main.indexOf('let unsavedSeq'), main.indexOf('async function createWindow'));
  const make = ({ answer, response = 0, quitWaiting = false }) => {
    const ipc = new Map(), log = { quits: 0, dialogs: 0 }, handlers = {};
    const ipcMain = { on: (c, f) => ipc.set(c, f), removeListener: c => ipc.delete(c) };
    const wc = { isCrashed: () => false, isLoading: () => false, send: (c, token) => { if (answer) setTimeout(() => ipc.get('app:unsaved-reply')?.({ sender: wc }, token, answer), 5); } };
    const win = { isDestroyed: () => false, webContents: wc, on: (n, f) => { handlers[n] = f; } };
    const dialog = { showMessageBox: async () => { log.dialogs++; return { response }; } };
    const app = { quit: () => { log.quits++; } };
    const { closeGuard } = new Function('ipcMain', 'dialog', 'app', 'shutdown', 'quitWaiting', 'startupClosing', src + ';return {closeGuard};')(ipcMain, dialog, app, { ready: false }, quitWaiting, false);
    closeGuard(win); let prevented = false; handlers.close({ preventDefault: () => { prevented = true; } });
    return { log, prevented };
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let t = make({ answer: [] }); await wait(30); assert.ok(t.prevented && t.log.quits === 1 && t.log.dialogs === 0, 'nothing unsaved: quits without asking');
  t = make({ answer: ['Layout editor'], response: 0 }); await wait(30); assert.ok(t.log.dialogs === 1 && t.log.quits === 1, 'unsaved + Quit without saving: quits');
  t = make({ answer: ['Layout editor'], response: 1 }); await wait(30); assert.ok(t.log.dialogs === 1 && t.log.quits === 0, 'unsaved + Cancel: stays open');
  t = make({ answer: ['Chart'], quitWaiting: true }); await wait(30); assert.ok(t.log.dialogs === 0 && t.log.quits === 1, 'a quit already on its way is not asked about');
  const start = Date.now(); t = make({ answer: null }); await wait(2100); assert.ok(t.log.quits === 1 && t.log.dialogs === 0 && Date.now() - start >= 2000, 'a page that does not answer does not block quitting');
  groups++;
  console.log(`PASS ${groups} UI review fix groups: unsaved drafts on close, average without pit laps, Virtual Rival time carry, PDF export hardening`);
})().catch(e => { console.error(e); process.exit(1); });
