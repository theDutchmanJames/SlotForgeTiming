const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const Database = require('./db');
const schema = require('./schema');
const os = require('os');
const { createServer } = require('./server');
const QR = require('./qr');
const transfer = require('./transfer');
const backup = require('./backup');
const LiveShare = require('./renderer/liveshare.js'); // puts the messages of the race window together (a window or phone that opens late is given the whole state)

// One place for the data, whether the app is started from the folder, installed or run as the portable .exe
require('./migrate').migrate(app.getPath('appData')); // data of the old name "Slot Lap Timer" is copied over once
app.setPath('userData', path.join(app.getPath('appData'), 'slotforge-timing'));
// Only one copy at a time: two copies would write to the same database file and fight over the network port
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

let db, mainWin, resourceStore;
const parallel = require('./parallelport').createController({ onEvent: event => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('parallel:event', event); } });
const phidget = require('./phidgetport').createController({ onEvent: event => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('phidget:event', event); } });
let pendingRestore = null; // a backup file chosen for restoring, waiting for the user to confirm
let pendingImport = null; // a file chosen for import, waiting for the user to confirm

function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800, minWidth: 760, minHeight: 520,
    autoHideMenuBar: true, // press Alt to show the menu (View > Toggle Full Screen)
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false // the box needs its keep-alive every second, also when this window is minimized
    }
  });
  mainWin = win;
  win.webContents.on('render-process-gone', () => { parallel.shutdown(); phidget.shutdown(); });
  win.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => { if (isMainFrame && !inPlace) { parallel.shutdown(); phidget.shutdown(); } });
  // USB timing hardware: Electron lets the page use COM ports and HID devices once the app allows it and the user has chosen one
  let pick = null; // the callback waiting for the user's choice
  const ask = (kind, list, callback) => { if (pick) pick(''); pick = callback; win.webContents.send('hw:choose', kind, list); };
  win.webContents.session.setPermissionCheckHandler(() => true);
  win.webContents.session.setDevicePermissionHandler(d => d.deviceType === 'serial' || d.deviceType === 'hid');
  win.webContents.session.on('select-serial-port', (event, list, _wc, callback) => { event.preventDefault(); ask('serial', list.map(p => ({ portId: p.portId, displayName: p.displayName, portName: p.portName, vendorId: p.vendorId ? Number(p.vendorId) : undefined, productId: p.productId ? Number(p.productId) : undefined })), callback); });
  win.webContents.on('select-hid-device', (event, details, callback) => { event.preventDefault(); ask('hid', details.deviceList.map(d => ({ deviceId: d.deviceId, name: d.name, vendorId: d.vendorId, productId: d.productId })), callback); });
  ipcMain.removeAllListeners('hw:chosen'); ipcMain.on('hw:chosen', (_e, id) => { if (pick) { const cb = pick; pick = null; cb(id || ''); } });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => app.quit()); // closing the main window also closes the Live Race window
}

// The Live Race pages in their own window, on a second screen when there is one.
// The race window pushes snapshots here; they are kept (so a window opened late catches up) and passed on.
let liveWin = null;
let perfCollector = null; // (the Performance report, 1.60.1: it is told when the Live Race window opens and how long that took)
const live = { stat: null, dyn: null };
function relay(channel, payload, from) {
  BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed() && w.webContents !== from) w.webContents.send(channel, payload); });
}
// the date of today on this computer, 2026-10-18 (toISOString is the date in London: after midnight in Amsterdam it is still yesterday)
const localDate = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
// a handler that throws must not become the dialog "A JavaScript error occurred in the main process": it is logged and the app goes on
const safe = (name, f) => (...a) => { try { return f(...a); } catch (x) { console.error('[' + name + ']', x); } };
// Network access: other devices on the wifi follow the race in a browser (App Settings > Network access)
const net = { server: null, port: 0, error: '' };
let netChain = Promise.resolve();
function applyNet() { const run = netChain.then(applyNetNow, applyNetNow); netChain = run.catch(() => {}); return run; } // (one at a time: a second change of the port or the PIN waits for the first)
async function applyNetNow() {
  if (net.server) { await net.server.close(); net.server = null; }
  net.error = ''; net.port = 0;
  const s = db.getSettings();
  if (!s.netOn) return;
  const port = Math.max(1, Math.min(65535, Number(s.netPort) || 8787));
  const server = createServer({ root: path.join(__dirname, 'renderer'), appRoot: __dirname, schema, getSettings: () => db.getSettings(), list: e => db.list(e), customFields: e => db.listCustomFields(e),
    getLive: () => ({ stat: live.stat, dyn: live.dyn }), onCommand: c => relay('live:command', c, null) });
  try { net.port = await server.listen(port); net.server = server; }
  catch (e) { net.error = e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose another port.` : `Could not start: ${e.message}`; }
}
function netStatus() {
  const addrs = [];
  Object.values(os.networkInterfaces()).forEach(list => (list || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) addrs.push(i.address); }));
  return { on: !!net.server, port: net.port, error: net.error, passwordSet: !!db.getSettings().netPassword,
    urls: net.server ? addrs.map(ip => { const url = `http://${ip}:${net.port}/`; return { url, svg: QR.svg(url) }; }) : [] };
}
function openLiveWindow() {
  if (liveWin && !liveWin.isDestroyed()) { liveWin.focus(); return false; }
  const opened = Date.now();
  const displays = screen.getAllDisplays(), primary = screen.getPrimaryDisplay();
  const other = displays.find(d => d.id !== primary.id);
  const b = (other || primary).workArea;
  liveWin = new BrowserWindow({
    x: b.x + 40, y: b.y + 40, width: Math.min(1200, b.width - 80), height: Math.min(800, b.height - 80), minWidth: 600, minHeight: 400,
    title: 'Live Race', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false }
  });
  if (other) liveWin.maximize(); // press F11 for full screen
  liveWin.loadFile(path.join(__dirname, 'renderer', 'index.html'), { hash: 'live' });
  liveWin.on('closed', () => { liveWin = null; if (perfCollector) perfCollector.mark('Live Race window closed'); });
  if (perfCollector) perfCollector.mark(`Live Race window opened (${Date.now() - opened} ms in the core)`);
  return !!other;
}

app.whenReady().then(() => {
  if (!gotLock) return;
  try { db = new Database(path.join(app.getPath('userData'), 'slotforge-timing.json')); } catch (x) {
    // (a database that cannot be read or kept is not started with an empty one: the next save would destroy it)
    dialog.showErrorBox('SlotForge Timing cannot open its data', String(x && x.message || x));
    app.exit(1); return;
  }
  // what keeps the core busy and is worth a note in the Performance report (1.61.1): a full save of the database, a list sent to the window (each from 20 ms)
  const watch = require('./perfstats').createWatcher({ mark: t => { if (perfCollector) perfCollector.mark(t); }, sizeOf: Database.approxSize });
  db.onSave = info => watch.saved(info);
  // since 1.61.2 a change to the database is written to its file in the background: the core goes on while the disk is busy, and the answer to the window comes when the file has the
  // change. The tickbox 'Save changes to the database in the background' (App Settings > General > Performance) switches it off: then the core waits for the disk, as before.
  const backgroundOn = s => !(s && typeof s === 'object' && s.backgroundSave === false);
  db.bg = backgroundOn(db.getSettings());
  ipcMain.handle('schema', () => schema);
  ipcMain.handle('voices:report', () => require('./voicereport').collect()); // what this computer offers for text to speech (Audio Settings > Voice report)
  ipcMain.handle('db:path', () => db.file);
  ipcMain.handle('db:list', (_e, entity) => { const rows = db.list(entity); watch.sent(entity, rows); return rows; });
  ipcMain.handle('db:add', async (_e, entity, item) => { const row = db.add(entity, item); await db.saved(); return row; });
  ipcMain.handle('db:update', async (_e, entity, id, patch) => { const row = db.update(entity, id, patch); await db.saved(); return row; });
  ipcMain.handle('db:remove', async (_e, entity, id) => { db.remove(entity, id); await db.saved(); });
  ipcMain.handle('db:linked', (_e, entity, id) => db.linkedLaps(entity, id));
  resourceStore=new (require('./resource-store'))(db);
  const resourceOwner=e=>{if(!mainWin||mainWin.isDestroyed()||e.sender!==mainWin.webContents||e.senderFrame!==e.sender.mainFrame)throw Error('Resource controls belong to the main app window.');};
  ipcMain.handle('resources:begin',(e,id,context)=>{resourceOwner(e);return resourceStore.begin(id,context);});
  ipcMain.handle('resources:ledger',e=>{resourceOwner(e);return resourceStore.read();});
  ipcMain.handle('session:save', async (_e, session, laps) => {if(session.resourceRunId)return resourceStore.saveSession(session,laps);return db.saveSessionAsync(session, laps);});
  ipcMain.handle('session:remove', async (_e, id) => { db.removeSession(id); await db.saved(); });
  // Turns a report (HTML) into a PDF: print it in a hidden window, then ask where to save it.
  ipcMain.handle('pdf:export', async (event, html, name) => {
    const tmp = path.join(app.getPath('temp'), `slotforge-timing-${Date.now()}.html`);
    fs.writeFileSync(tmp, html);
    const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      await win.loadFile(tmp);
      const pdf = await win.webContents.printToPDF({ pageSize: 'A4', printBackground: true, preferCSSPageSize: true });
      const parent = BrowserWindow.fromWebContents(event.sender);
      const { canceled, filePath } = await dialog.showSaveDialog(parent, { defaultPath: name, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (canceled || !filePath) return { saved: false };
      Database.writeAtomic(filePath, pdf);
      return { saved: true, path: filePath };
    } finally {
      win.destroy();
      try { fs.unlinkSync(tmp); } catch { /* already gone */ }
    }
  });
  // Export and import of items as a file
  ipcMain.handle('transfer:deps', (_e, picks) => transfer.dependencies(db.data, picks));
  ipcMain.handle('transfer:export', async (e, picks, extras) => { // picks: the ticked items; extras: the ticked things they use
    const all = {}; [picks, extras].forEach(src => Object.entries(src || {}).forEach(([k, ids]) => { all[k] = [...new Set([...(all[k] || []), ...ids])]; }));
    const bundle = transfer.collect(db.data, all, false, { version: app.getVersion() });
    const c = transfer.check(bundle); if (!c.ok) return { saved: false, error: c.error };
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: 'slotforge-timing-export.json', filters: [{ name: 'SlotForge Timing export', extensions: ['json'] }] });
    if (canceled || !filePath) return { saved: false };
    Database.writeAtomic(filePath, JSON.stringify(bundle));
    return { saved: true, path: filePath, counts: Object.fromEntries(Object.entries(c.summary).map(([k, v]) => [k, v.count])) };
  });
  ipcMain.handle('transfer:open', async e => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile'], filters: [{ name: 'SlotForge Timing export', extensions: ['json'] }] });
    if (canceled || !filePaths.length) return { canceled: true };
    pendingImport = null;
    try {
      if (fs.statSync(filePaths[0]).size > 500 * 1024 * 1024) return { ok: false, error: 'The file is too big.' };
      const bundle = JSON.parse(fs.readFileSync(filePaths[0], 'utf8')), c = transfer.check(bundle);
      if (c.ok) pendingImport = bundle;
      return { ...c, file: path.basename(filePaths[0]) };
    } catch { return { ok: false, error: 'The file could not be read: it is not an export file from this app.' }; }
  });
  ipcMain.handle('transfer:apply', async () => { if (!pendingImport) throw new Error('No file chosen.'); await db.fileIdle(); if (!pendingImport) throw new Error('No file chosen.'); const counts = transfer.apply(db, pendingImport); pendingImport = null; return counts; }); // (1.61.2: nothing is being written to the database file while the import is saved)
  ipcMain.handle('transfer:cancel', () => { pendingImport = null; });
  // Complete backup: the whole database in one file, and restoring it
  ipcMain.handle('backup:save', async e => {
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: `slotforge-timing-backup-${localDate()}.json`, filters: [{ name: 'SlotForge Timing backup', extensions: ['json'] }] });
    if (canceled || !filePath) return { saved: false };
    await resourceStore.idle();
    Database.writeAtomic(filePath, JSON.stringify(backup.make(db.data, { version: app.getVersion() })));
    return { saved: true, path: filePath };
  });
  ipcMain.handle('backup:open', async e => {
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile'], filters: [{ name: 'SlotForge Timing backup', extensions: ['json'] }] });
    if (canceled || !filePaths.length) return { canceled: true };
    pendingRestore = null;
    try {
      if (fs.statSync(filePaths[0]).size > 1024 * 1024 * 1024) return { ok: false, error: 'The file is too big.' };
      const bundle = JSON.parse(fs.readFileSync(filePaths[0], 'utf8')), c = backup.check(bundle);
      if (c.ok) pendingRestore = bundle;
      return { ...c, file: path.basename(filePaths[0]) };
    } catch { return { ok: false, error: 'The file could not be read: it is not a backup file from this app.' }; }
  });
  ipcMain.handle('backup:restore', async () => {
    await resourceStore.idle();
    if(resourceStore.ledger().checkpoint)throw Error('Finish or discard the unfinished resource event before restoring a database backup.');
    if (!pendingRestore) throw new Error('No backup file chosen.');
    await db.fileIdle(); // (1.61.2: a change that is still on its way to the file is in the safety copy too)
    if (!pendingRestore) throw new Error('No backup file chosen.');
    const safety = path.join(path.dirname(db.file), `slotforge-timing.before-restore-${localDate()}-${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.json`); // (a second restore does not overwrite the copy of the first)
    try { fs.copyFileSync(db.file, safety); } catch { /* nothing to copy yet */ } // the data as it was, in case the restore was a mistake
    db.replaceAll(pendingRestore.data); pendingRestore = null;
    applyNet().finally(() => BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.reload(); }));
    return { safety };
  });
  ipcMain.handle('backup:cancel', () => { pendingRestore = null; });
  ipcMain.handle('custom:list', (_e, entity) => db.listCustomFields(entity));
  ipcMain.handle('custom:add', async (_e, entity, field) => { const f = db.addCustomField(entity, field); await db.saved(); return f; });
  ipcMain.handle('custom:remove', async (_e, entity, id) => { db.removeCustomField(entity, id); await db.saved(); });
  ipcMain.handle('custom:group', async (_e, entity, id, group) => { const f = db.setCustomFieldGroup(entity, id, group); await db.saved(); return f; });
  // how the computer and the app are doing (the Performance line, 1.60.0): it only looks while somebody asks
  const perf = perfCollector = require('./perfstats').createCollector({ app, screen, os, process, db, version: app.getVersion(), readText: p => fs.promises.readFile(p, 'utf8'),
    windows: () => BrowserWindow.getAllWindows().filter(w => !w.isDestroyed()).map(w => { try { return { title: w.getTitle(), pid: w.webContents.getOSProcessId(), visible: w.isVisible(), minimized: w.isMinimized(), focused: w.isFocused(), live: w === liveWin }; } catch { return null; } }).filter(Boolean) });
  ipcMain.handle('perf:stats', () => perf.collect());
  ipcMain.handle('settings:get', () => db.getSettings());
  // A Live Race window or a subframe cannot open a port or drive its pins.
  const parallelOwner = e => { if (!mainWin || mainWin.isDestroyed() || e.sender !== mainWin.webContents || e.senderFrame !== e.sender.mainFrame) throw Error('Parallel-port access belongs to the main app window.'); };
  const phidgetOwner = e => { if (!mainWin || mainWin.isDestroyed() || e.sender !== mainWin.webContents || e.senderFrame !== e.sender.mainFrame) throw Error('Phidget access belongs to the main app window.'); };
  ipcMain.handle('phidget:state', e => { phidgetOwner(e); return phidget.state(); });
  ipcMain.handle('phidget:scan', e => { phidgetOwner(e); return phidget.scan(); });
  ipcMain.handle('phidget:open', (e, value) => { phidgetOwner(e); if (db.getSettings().timingHw !== 'phidget') throw Error('Choose Phidget as the timing hardware first.'); return phidget.open(value); });
  ipcMain.handle('phidget:close', e => { phidgetOwner(e); return phidget.close(); });
  ipcMain.handle('phidget:alive', e => { phidgetOwner(e); return phidget.alive(); });
  ipcMain.handle('phidget:arm', (e, on) => { phidgetOwner(e); return phidget.armTests(on); });
  ipcMain.handle('phidget:test', (e, index) => { phidgetOwner(e); return phidget.test(index); });
  ipcMain.handle('phidget:race', (e, on, lanes, lease) => { phidgetOwner(e); if (on && db.getSettings().timingHw !== 'phidget') throw Error('Phidget is not the timing hardware in use.'); return phidget.setRace(on, lanes, lease); });
  ipcMain.handle('phidget:outputs', (e, wants, lease) => { phidgetOwner(e); if (db.getSettings().timingHw !== 'phidget') throw Error('Phidget is not the timing hardware in use.'); return phidget.outputs(wants, lease); });
  ipcMain.handle('parallel:alive', e => { parallelOwner(e); return parallel.alive(); });
  ipcMain.handle('parallel:state' , e => { parallelOwner(e); return parallel.state(); });
  ipcMain.handle('parallel:check', (e, value) => { parallelOwner(e); return parallel.check(value); });
  ipcMain.handle('parallel:open', (e, value) => { parallelOwner(e); return parallel.open(value); });
  ipcMain.handle('parallel:close', e => { parallelOwner(e); return parallel.close(); });
  ipcMain.handle('parallel:arm', (e, on) => { parallelOwner(e); return parallel.armTests(on); });
  ipcMain.handle('parallel:test', (e, pin, on) => { parallelOwner(e); return parallel.test(pin, on); });
  ipcMain.handle('parallel:race', (e, on, lanes, lease) => { parallelOwner(e); if (on && db.getSettings().timingHw !== 'parallel') throw Error('Parallel Port is not the timing hardware in use.'); return parallel.setRace(on, lanes, lease); });
  ipcMain.handle('parallel:outputs', (e, value, lease) => { parallelOwner(e); if (db.getSettings().timingHw !== 'parallel') throw Error('Parallel Port is not the timing hardware in use.'); return parallel.outputs(value, lease); });
  // the race save is written in the background (1.60.0): the program does not wait for the disk, a read waits for a save that is on its way
  ipcMain.handle('resume:get', async () => { await resourceStore.idle();await db.resumeIdle();return resourceStore.ledger().checkpoint||db.getResume(); });
  ipcMain.handle('resume:save', (e, snap) => {if(snap?.race?.resources){resourceOwner(e);return resourceStore.save(snap);}return db.saveResumeAsync(snap);});
  ipcMain.handle('resume:clear', async e => {resourceOwner(e);await resourceStore.clear();return db.clearResumeAsync();});
  ipcMain.on('live:static', safe('live:static', (e, s) => { live.stat = s; live.dyn = null; relay('live:static', s, null); if (net.server) net.server.broadcast('static', s); }));
  ipcMain.on('live:push', safe('live:push', (e, d) => {
    // the race window sends what changed; the whole state is kept here for a window or phone that opens late
    const r = LiveShare.applyDynamic(live.dyn, d);
    if (!r.ok) { live.dyn = null; e.sender.send('live:resync'); } else if (!r.stale) live.dyn = r.state; // a message that does not fit: the race window is asked to send everything again
    relay('live:push', d, null); if (net.server) net.server.broadcast('push', d);
  }));
  ipcMain.on('live:command', safe('live:command', (e, c) => relay('live:command', c, null))); // Include the sender: the main window can show Race Director while its race is parked.
  ipcMain.handle('live:get', () => ({ stat: live.stat, dyn: live.dyn }));
  // The window that asks (the main window with the race screen, for the fullscreen widget view) goes full screen or back; the answer is how it is now and how it was
  ipcMain.handle('win:fullscreen', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w || w.isDestroyed()) return { on: false, was: false }; const was = w.isFullScreen(); w.setFullScreen(on === undefined ? !was : !!on); return { on: w.isFullScreen(), was }; });
  ipcMain.handle('live:fullscreen', (_e, on) => { if (!liveWin || liveWin.isDestroyed()) return false; liveWin.setFullScreen(on === undefined ? !liveWin.isFullScreen() : !!on); return liveWin.isFullScreen(); });
  ipcMain.handle('live:open', () => ({ second: openLiveWindow() }));
  // a setting is written to the settings file in the background (1.61.0): the core does not wait for the disk, the answer comes when the file is written
  ipcMain.handle('settings:set', async (_e, patch) => { if (Object.prototype.hasOwnProperty.call(patch || {}, 'phidget')) { phidgetOwner(_e); if (phidget.state().connected) throw Error('Disconnect before changing Phidget channel assignments.'); const P = require('./renderer/phidget'), errors = P.validate(P.config(patch.phidget)); if (errors.length) throw Error(errors[0]); } if (phidget.state().race && (Object.prototype.hasOwnProperty.call(patch || {}, 'phidget') || (Object.prototype.hasOwnProperty.call(patch || {}, 'timingHw') && patch.timingHw !== 'phidget'))) throw Error('Leave the race before changing its Phidget setup.'); if (Object.prototype.hasOwnProperty.call(patch || {}, 'parallelPort')) { parallelOwner(_e); if (parallel.state().connected) throw Error('Disconnect before changing parallel-port assignments.'); const P = require('./renderer/parallel'), errors = P.validate(P.config(patch.parallelPort)); if (errors.length) throw Error(errors[0].text); } if (parallel.state().race && (Object.prototype.hasOwnProperty.call(patch || {}, 'parallelPort') || (Object.prototype.hasOwnProperty.call(patch || {}, 'timingHw') && patch.timingHw !== 'parallel'))) throw Error('Finish or leave the race before changing its parallel-port setup.'); const p = db.setSettingsAsync(patch); db.bg = backgroundOn(db.getSettings()); const s = await p; if (Object.keys(patch || {}).some(k => k.startsWith('net'))) await applyNet(); return s; });
  ipcMain.handle('net:status', () => netStatus());
  applyNet().finally(createWindow);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
let quitFlushed = false;
app.on('before-quit', e => {
  if (typeof parallel !== 'undefined') parallel.shutdown();
  phidget.shutdown();
  if (net.server) net.server.close();
  // a race save or a setting that is on its way is written first (at most three seconds): the files then hold the last state, not the one before
  if (!quitFlushed && db && (db.writesPending() || (typeof resourceStore!=='undefined'&&resourceStore?.pending))) { e.preventDefault(); quitFlushed = true; Promise.race([(typeof resourceStore!=='undefined'&&resourceStore?resourceStore.idle():Promise.resolve()).then(()=>db.writesIdle()), new Promise(r => setTimeout(r, 3000))]).catch(() => {}).then(() => app.quit()); }
});
