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

let db;
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
const live = { stat: null, dyn: null };
function relay(channel, payload, from) {
  BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed() && w.webContents !== from) w.webContents.send(channel, payload); });
}
// Network access: other devices on the wifi follow the race in a browser (App Settings > Network access)
const net = { server: null, port: 0, error: '' };
async function applyNet() {
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
  liveWin.on('closed', () => { liveWin = null; });
  return !!other;
}

app.whenReady().then(() => {
  if (!gotLock) return;
  db = new Database(path.join(app.getPath('userData'), 'slotforge-timing.json'));
  ipcMain.handle('schema', () => schema);
  ipcMain.handle('voices:report', () => require('./voicereport').collect()); // what this computer offers for text to speech (Audio Settings > Voice report)
  ipcMain.handle('db:path', () => db.file);
  ipcMain.handle('db:list', (_e, entity) => db.list(entity));
  ipcMain.handle('db:add', (_e, entity, item) => db.add(entity, item));
  ipcMain.handle('db:update', (_e, entity, id, patch) => db.update(entity, id, patch));
  ipcMain.handle('db:remove', (_e, entity, id) => db.remove(entity, id));
  ipcMain.handle('db:linked', (_e, entity, id) => db.linkedLaps(entity, id));
  ipcMain.handle('session:save', (_e, session, laps) => db.saveSession(session, laps));
  ipcMain.handle('session:remove', (_e, id) => db.removeSession(id));
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
      fs.writeFileSync(filePath, pdf);
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
    fs.writeFileSync(filePath, JSON.stringify(bundle));
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
  ipcMain.handle('transfer:apply', () => { if (!pendingImport) throw new Error('No file chosen.'); const counts = transfer.apply(db, pendingImport); pendingImport = null; return counts; });
  ipcMain.handle('transfer:cancel', () => { pendingImport = null; });
  // Complete backup: the whole database in one file, and restoring it
  ipcMain.handle('backup:save', async e => {
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: `slotforge-timing-backup-${new Date().toISOString().slice(0, 10)}.json`, filters: [{ name: 'SlotForge Timing backup', extensions: ['json'] }] });
    if (canceled || !filePath) return { saved: false };
    fs.writeFileSync(filePath, JSON.stringify(backup.make(db.data, { version: app.getVersion() })));
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
  ipcMain.handle('backup:restore', () => {
    if (!pendingRestore) throw new Error('No backup file chosen.');
    const safety = path.join(path.dirname(db.file), 'slotforge-timing.before-restore.json');
    try { fs.copyFileSync(db.file, safety); } catch { /* nothing to copy yet */ } // the data as it was, in case the restore was a mistake
    db.replaceAll(pendingRestore.data); pendingRestore = null;
    applyNet().finally(() => BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.reload(); }));
    return { safety };
  });
  ipcMain.handle('backup:cancel', () => { pendingRestore = null; });
  ipcMain.handle('custom:list', (_e, entity) => db.listCustomFields(entity));
  ipcMain.handle('custom:add', (_e, entity, field) => db.addCustomField(entity, field));
  ipcMain.handle('custom:remove', (_e, entity, id) => db.removeCustomField(entity, id));
  ipcMain.handle('custom:group', (_e, entity, id, group) => db.setCustomFieldGroup(entity, id, group));
  ipcMain.handle('settings:get', () => db.getSettings());
  ipcMain.handle('resume:get', () => db.getResume());
  ipcMain.handle('resume:save', (_e, snap) => db.setResume(snap));
  ipcMain.handle('resume:clear', () => db.clearResume());
  ipcMain.on('live:static', (e, s) => { live.stat = s; live.dyn = null; relay('live:static', s, e.sender); if (net.server) net.server.broadcast('static', s); });
  ipcMain.on('live:push', (e, d) => {
    // the race window sends what changed; the whole state is kept here for a window or phone that opens late
    const r = LiveShare.applyDynamic(live.dyn, d);
    if (!r.ok) { live.dyn = null; e.sender.send('live:resync'); } else if (!r.stale) live.dyn = r.state; // a message that does not fit: the race window is asked to send everything again
    relay('live:push', d, e.sender); if (net.server) net.server.broadcast('push', d);
  });
  ipcMain.on('live:command', (e, c) => relay('live:command', c, e.sender)); // Race Director buttons -> the race window
  ipcMain.handle('live:get', () => ({ stat: live.stat, dyn: live.dyn }));
  // The window that asks (the main window with the race screen, for the fullscreen widget view) goes full screen or back; the answer is how it is now and how it was
  ipcMain.handle('win:fullscreen', (e, on) => { const w = BrowserWindow.fromWebContents(e.sender); if (!w || w.isDestroyed()) return { on: false, was: false }; const was = w.isFullScreen(); w.setFullScreen(on === undefined ? !was : !!on); return { on: w.isFullScreen(), was }; });
  ipcMain.handle('live:fullscreen', (_e, on) => { if (!liveWin || liveWin.isDestroyed()) return false; liveWin.setFullScreen(on === undefined ? !liveWin.isFullScreen() : !!on); return liveWin.isFullScreen(); });
  ipcMain.handle('live:open', () => ({ second: openLiveWindow() }));
  ipcMain.handle('settings:set', async (_e, patch) => { const s = db.setSettings(patch); if (Object.keys(patch || {}).some(k => k.startsWith('net'))) await applyNet(); return s; });
  ipcMain.handle('net:status', () => netStatus());
  applyNet().finally(createWindow);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => { if (net.server) net.server.close(); });
