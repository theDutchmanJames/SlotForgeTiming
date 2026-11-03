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
const normalProfile=path.join(app.getPath('appData'),'slotforge-timing');
const testProfileArgs=process.argv.filter(a=>a.startsWith('--sqlite-test-profile='));
let sqliteTestProfile=null,profileError=null;
try{if(testProfileArgs.length>1)throw Error('Choose one SQLite test profile.');if(testProfileArgs.length)sqliteTestProfile=require('./sqlite-runtime').validateProfile(testProfileArgs[0].slice('--sqlite-test-profile='.length),normalProfile,app.isPackaged);}catch(error){profileError=error;}
if(!testProfileArgs.length&&!fs.existsSync(path.join(normalProfile,'storage-backend.json'))&&!fs.existsSync(path.join(normalProfile,'sqlite-activation-request.json')))require('./migrate').migrate(app.getPath('appData'));
app.setPath('userData',sqliteTestProfile||normalProfile);
// Only one copy at a time: two copies would write to the same database file and fight over the network port
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });

let db, sqliteRuntime, records, bulkStorage, lifecycle, mainWin, resourceStore, pluginHost, paddock;
const parallel = require('./parallelport').createController({ onEvent: event => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('parallel:event', event); } });
const phidget = require('./phidgetport').createController({ onEvent: event => { if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('phidget:event', event); } });
let pendingRestore = null; // a backup file chosen for restoring, waiting for the user to confirm
let pendingRestoreSource = null;
let pendingImport = null; // a file chosen for import, waiting for the user to confirm

function createWindow() {
  const win = new BrowserWindow({
    icon: path.join(__dirname, 'build', 'icon.png'),
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
  win.webContents.on('render-process-gone', () => { parallel.shutdown(); phidget.shutdown(); pluginHost?.timing?.reset().catch(()=>{}); });
  win.webContents.on('did-start-navigation', (_event, _url, inPlace, isMainFrame) => { if (isMainFrame && !inPlace) { parallel.shutdown(); phidget.shutdown(); pluginHost?.timing?.reset().catch(()=>{}); } });
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
  const s = lifecycle.settings();
  if (!s.netOn) return;
  const port = Math.max(1, Math.min(65535, Number(s.netPort) || 8787));
  const server = createServer({ root: path.join(__dirname, 'renderer'), appRoot: __dirname, schema, getSettings: () => lifecycle.settings(), list: e => records.list(e), customFields: e => records.customFields(e),
    getLive: () => ({ stat: live.stat, dyn: live.dyn }), onCommand: c => relay('live:command', c, null) });
  try { net.port = await server.listen(port); net.server = server; }
  catch (e) { net.error = e.code === 'EADDRINUSE' ? `Port ${port} is already in use. Choose another port.` : `Could not start: ${e.message}`; }
}
function netStatus() {
  const addrs = [];
  Object.values(os.networkInterfaces()).forEach(list => (list || []).forEach(i => { if (i.family === 'IPv4' && !i.internal) addrs.push(i.address); }));
  return { on: !!net.server, port: net.port, error: net.error, passwordSet: !!lifecycle.settings().netPassword,
    urls: net.server ? addrs.map(ip => { const url = `http://${ip}:${net.port}/`; return { url, svg: QR.svg(url) }; }) : [] };
}
function openLiveWindow() {
  if (liveWin && !liveWin.isDestroyed()) { liveWin.focus(); return false; }
  const opened = Date.now();
  const displays = screen.getAllDisplays(), primary = screen.getPrimaryDisplay();
  const other = displays.find(d => d.id !== primary.id);
  const b = (other || primary).workArea;
  liveWin = new BrowserWindow({
    icon: path.join(__dirname, 'build', 'icon.png'),
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

app.whenReady().then(async () => {
  if (!gotLock) return;
  try {
    if(profileError)throw profileError;
    const profile=app.getPath('userData'),selection=sqliteTestProfile?null:await require('./storage-activation').startup(profile);
    if(sqliteTestProfile||selection){sqliteRuntime=await require('./sqlite-runtime').open(sqliteTestProfile||selection.directory,{profileRoot:profile});({records,bulk:bulkStorage,lifecycle,resources:resourceStore}=sqliteRuntime);}
    else db = new Database(path.join(profile, 'slotforge-timing.json'));
  } catch (x) {
    // (a database that cannot be read or kept is not started with an empty one: the next save would destroy it)
    const activation=require('./storage-activation');
    if(!testProfileArgs.length&&activation.canCancel(app.getPath('userData'))){
      const answer=await dialog.showMessageBox({type:'error',title:'Storage conversion could not finish',message:String(x?.message||x),detail:'Your previously selected database and recovery copies are retained. Close to retry on the next launch, or cancel the pending conversion/restore and reopen the previous database.',buttons:['Close','Cancel pending change and reopen'],defaultId:0,cancelId:0});
      if(answer.response===1){activation.cancel(app.getPath('userData'));app.relaunch();}app.exit(1);return;
    }
    dialog.showErrorBox('SlotForge Timing cannot open its data', String(x && x.message || x));
    app.exit(1); return;
  }
  // what keeps the core busy and is worth a note in the Performance report (1.61.1): a full save of the database, a list sent to the window (each from 20 ms)
  const watch = require('./perfstats').createWatcher({ mark: t => { if (perfCollector) perfCollector.mark(t); }, sizeOf: Database.approxSize });
  if(db)db.onSave = info => watch.saved(info);
  // since 1.61.2 a change to the database is written to its file in the background: the core goes on while the disk is busy, and the answer to the window comes when the file has the
  // change. The tickbox 'Save changes to the database in the background' (App Settings > General > Performance) switches it off: then the core waits for the disk, as before.
  const backgroundOn = s => !(s && typeof s === 'object' && s.backgroundSave === false);
  const Life=require('./storage-lifecycle');
  if(!sqliteRuntime){lifecycle=new Life.StorageLifecycle(new Life.JsonLifecycleBackend(db));await lifecycle.initialize();
  db.bg = backgroundOn(lifecycle.settings());
  bulkStorage = new (require('./bulk-storage').JsonBulkStorage)(db);
  records = new (require('./data-repository'))(db, { getResourceStore: () => resourceStore });}
  ipcMain.handle('schema', () => schema);
  paddock = (sqliteRuntime?sqliteRuntime.createPaddock():new (require('./paddock').Paddock)(db));
  paddock.isRacing=()=>!!live.dyn&&['countdown','running','paused','between'].includes(live.dyn.phase);
  const paddockOwner=e=>{if(!mainWin||e.sender!==mainWin.webContents||e.senderFrame!==mainWin.webContents.mainFrame)throw Error('Use the main Timing window.');};
  const paddockIdle=e=>{paddockOwner(e);if(paddock.isRacing())throw Error('Finish the race before changing Paddock connections or cars.');};
  ipcMain.handle('paddock:status',(e)=>{paddockOwner(e);return paddock.status();});
  ipcMain.handle('paddock:discover',(e)=>{paddockIdle(e);return require('./paddock').discover();});
  ipcMain.handle('paddock:connect',(e,input)=>{paddockIdle(e);return paddock.connect(input);});
  ipcMain.handle('paddock:disconnect',(e,forget)=>{paddockIdle(e);return paddock.disconnect(forget);});
  ipcMain.handle('paddock:browse',(e)=>{paddockIdle(e);return paddock.browse();});
  ipcMain.handle('paddock:catalogue',(e,force)=>{paddockOwner(e);return paddock.catalogue(force,false);});
  ipcMain.handle('paddock:picture',(e,id,key)=>{paddockOwner(e);return paddock.picture(id,key);});
  ipcMain.handle('paddock:locals',e=>{paddockOwner(e);return records.localCars();});
  ipcMain.handle('paddock:link',(e,id,local)=>{paddockIdle(e);return paddock.link(id,local);});
  ipcMain.handle('paddock:refresh',(e)=>{paddockIdle(e);return paddock.refresh();});
  ipcMain.handle('paddock:prepare',(e,ids)=>{paddockIdle(e);return paddock.prepare(ids);});
  ipcMain.handle('paddock:retry',(e)=>{paddockIdle(e);return paddock.retry();});
  ipcMain.handle('paddock:receipt',(e,id)=>{paddockIdle(e);return paddock.checkReceipt(id);});
  require('./packipc').register({ipcMain,dialog,BrowserWindow,db,lifecycle,records,bulk:bulkStorage,packFile:path.join(app.getPath('userData'),'slotforge-timing.packs.json'),waitStorage:()=>lifecycle.idle(),getMain:()=>mainWin,isRacing:()=>!!live.dyn && ['countdown','running','paused','between','review'].includes(live.dyn.phase),appVersion:require('./package.json').version});
  pluginHost = require('./pluginipc').register({ipcMain,dialog,BrowserWindow,app,utilityProcess:require('electron').utilityProcess,getMain:()=>mainWin,isRacing:()=>!!live.dyn && ['countdown','running','paused','between','review'].includes(live.dyn.phase),appVersion:require('./package.json').version,root:path.join(app.getPath('userData'),'plugins'),getSettings:()=>lifecycle.settings(),onTiming:event=>{if(mainWin&&!mainWin.isDestroyed())mainWin.webContents.send('plugins:timing-event',event);}});
  ipcMain.handle('voices:report', () => require('./voicereport').collect()); // what this computer offers for text to speech (Audio Settings > Voice report)
  ipcMain.handle('db:path', () => sqliteRuntime?.file||db.file);
  ipcMain.handle('storage:status',()=>({backend:sqliteRuntime?'sqlite':'json',testProfile:!!sqliteTestProfile}));
  ipcMain.handle('storage:activate',async e=>{
    paddockOwner(e);
    const idle=()=>{if(sqliteRuntime||live.dyn&&['countdown','running','paused','between','review'].includes(live.dyn.phase)||paddock?.busy||pluginHost?.timing?.reservation)throw Error('Finish the race and Paddock operations before changing storage.');};
    idle();const answer=await dialog.showMessageBox(mainWin,{type:'question',title:'Switch to SQLite',message:'Convert a verified copy and restart Timing?',detail:'Your JSON database and recovery files will be kept. After conversion, new changes go to SQLite only. Older builds will not see them; export a current backup before downgrading. Conversion may take time and needs space for both copies.',buttons:['Cancel','Convert and restart'],defaultId:0,cancelId:0});
    if(answer.response!==1)return {restarting:false};idle();await lifecycle.idle();idle();
    require('./storage-activation').request(app.getPath('userData'));app.relaunch();app.quit();return {restarting:true};
  });
  ipcMain.handle('db:list', async (_e, entity) => { const rows = await records.list(entity); watch.sent(entity, rows); return rows; });
  ipcMain.handle('db:get', (_e, entity, id) => records.get(entity, id));
  const catalogueRead=async work=>{try{return await work();}catch(error){if(error.code==='CATALOGUE_CHANGED')return {catalogueStale:true};throw error;}};
  ipcMain.handle('db:home-statistics', (_e,options)=>catalogueRead(()=>records.homeStatistics(options)));
  ipcMain.handle('db:home-sessions', (_e,options)=>catalogueRead(()=>records.homeSessions(options)));
  ipcMain.handle('db:race-season', (_e,options)=>catalogueRead(()=>records.raceSeason(options)));
  ipcMain.handle('db:race-charts', (_e,ids)=>catalogueRead(()=>records.raceCharts(ids)));
  ipcMain.handle('db:race-inputs', (_e,options)=>catalogueRead(()=>records.raceInputs(options)));
  ipcMain.handle('db:reference-page', (_e,entity,options)=>catalogueRead(()=>records.referencePage(entity,options)));
  ipcMain.handle('db:reference-details', (_e,entity,ids,revision)=>catalogueRead(()=>records.referenceDetails(entity,ids,revision)));
  ipcMain.handle('db:history-page', (_e,pool,options)=>catalogueRead(()=>records.historyPage(pool,options)));
  ipcMain.handle('db:history-session', (_e,pool,id,options)=>catalogueRead(()=>records.historySession(pool,id,options)));
  ipcMain.handle('db:car-statistics', (_e,id)=>records.carStatistics(id));
  ipcMain.handle('db:catalogue', (_e, entity, options) => catalogueRead(()=>records.catalogue(entity, options)));
  ipcMain.handle('db:catalogue-picture', (_e, entity, id, revision) => catalogueRead(()=>records.cataloguePicture(entity,id,revision)));
  ipcMain.handle('db:add', (_e, entity, item) => records.add(entity, item));
  ipcMain.handle('db:update', (_e, entity, id, patch) => records.update(entity, id, patch));
  ipcMain.handle('db:remove', (_e, entity, id) => records.remove(entity, id));
  ipcMain.handle('db:linked', (_e, entity, id) => records.linkedLaps(entity, id));
  if(!sqliteRuntime)resourceStore=new (require('./resource-store'))(db);lifecycle.resources=resourceStore;
  const resourceOwner=e=>{if(!mainWin||mainWin.isDestroyed()||e.sender!==mainWin.webContents||e.senderFrame!==e.sender.mainFrame)throw Error('Resource controls belong to the main app window.');};
  ipcMain.handle('resources:begin',(e,id,context)=>{resourceOwner(e);return resourceStore.begin(id,context);});
  ipcMain.handle('resources:ledger',e=>{resourceOwner(e);return resourceStore.read();});
  ipcMain.handle('session:save', async (_e, session, laps) => {const id=await records.saveSession(session,laps);paddock?.schedule(0);return id;});
  ipcMain.handle('session:remove', (_e, id) => records.removeSession(id));
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
  const bulkAccess = require('./bulk-access')({ipcMain,getMain:()=>mainWin,isRacing:()=>!!live.dyn && ['countdown','running','paused','between','review'].includes(live.dyn.phase)});
  // Export and import of items as a file
  bulkAccess.handle('transfer:deps', (_e, picks) => bulkStorage.dependencies(picks));
  bulkAccess.handle('transfer:choices',async()=>{const items={};for(const entity of transfer.ORDER)if(entity!=='laps')items[entity]=await records.transferChoices(entity);return items;});
  bulkAccess.handle('transfer:export', async (e, picks, extras) => { // picks: the ticked items; extras: the ticked things they use
    const all = {}; [picks, extras].forEach(src => Object.entries(src || {}).forEach(([k, ids]) => { all[k] = [...new Set([...(all[k] || []), ...ids])]; }));
    const bundle = await bulkStorage.collect(all, false, { version: app.getVersion() });
    const c = transfer.check(bundle); if (!c.ok) return { saved: false, error: c.error };
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: 'slotforge-timing-export.json', filters: [{ name: 'SlotForge Timing export', extensions: ['json'] }] });
    if (canceled || !filePath) return { saved: false };
    bulkStorage.assertExportTarget(filePath);
    Database.writeAtomic(filePath, JSON.stringify(bundle));
    return { saved: true, path: filePath, counts: Object.fromEntries(Object.entries(c.summary).map(([k, v]) => [k, v.count])) };
  });
  bulkAccess.handle('transfer:open', async e => {
    pendingImport = null;
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile'], filters: [{ name: 'SlotForge Timing export', extensions: ['json'] }] });
    bulkAccess.idle();
    if (canceled || !filePaths.length) return { canceled: true };
    pendingImport = null;
    try {
      if (fs.statSync(filePaths[0]).size > 500 * 1024 * 1024) return { ok: false, error: 'The file is too big.' };
      const bundle = JSON.parse(fs.readFileSync(filePaths[0], 'utf8')), c = transfer.check(bundle);
      if (c.ok) pendingImport = bundle;
      return { ...c, file: path.basename(filePaths[0]) };
    } catch { return { ok: false, error: 'The file could not be read: it is not an export file from this app.' }; }
  });
  bulkAccess.handle('transfer:apply', async () => { if (!pendingImport) throw new Error('No file chosen.'); await lifecycle.idle(); bulkAccess.idle(); if (!pendingImport) throw new Error('No file chosen.'); const counts = await bulkStorage.importItems(pendingImport); pendingImport = null; return counts; }); // (1.61.2: nothing is being written to the database file while the import is saved)
  bulkAccess.handle('transfer:cancel', () => { pendingImport = null; });
  // Complete backup: the whole database in one file, and restoring it
  bulkAccess.handle('backup:save', async e => {
    const { canceled, filePath } = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender), { defaultPath: `slotforge-timing-backup-${localDate()}.json`, filters: [{ name: 'SlotForge Timing backup', extensions: ['json'] }] });
    if (canceled || !filePath) return { saved: false };
    await resourceStore.idle();
    await lifecycle.idle();
    await bulkStorage.backup(filePath, { version: app.getVersion() });
    return { saved: true, path: filePath };
  });
  bulkAccess.handle('backup:open', async e => {
    pendingRestore = null;pendingRestoreSource=null;
    const { canceled, filePaths } = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender), { properties: ['openFile'], filters: [{ name: 'SlotForge Timing backup', extensions: ['json'] }] });
    bulkAccess.idle();
    if (canceled || !filePaths.length) return { canceled: true };
    pendingRestore = null;
    try {
      if (fs.statSync(filePaths[0]).size > 1024 * 1024 * 1024) return { ok: false, error: 'The file is too big.' };
      const bytes=fs.readFileSync(filePaths[0]),bundle = JSON.parse(bytes.toString('utf8')), c = backup.check(bundle);
      if (c.ok) {pendingRestore = bundle;pendingRestoreSource={file:filePaths[0],sha256:require('node:crypto').createHash('sha256').update(bytes).digest('hex')};}
      return { ...c, file: path.basename(filePaths[0]) };
    } catch { return { ok: false, error: 'The file could not be read: it is not a backup file from this app.' }; }
  });
  bulkAccess.handle('backup:restore', async () => {
    if(sqliteTestProfile)throw Error('Restore into a separate working copy with the SQLite tools for a test profile.');
    if(paddock?.busy)throw Error('Wait for the Paddock operation before restoring a backup.');
    if(pluginHost?.timing?.reservation)throw Error('Finish or leave the race before restoring a backup.');
    await pluginHost?.timing?.reset();
    await resourceStore.idle();
    if((await resourceStore.read()).checkpoint)throw Error('Finish or discard the unfinished resource event before restoring a database backup.');
    if (!pendingRestore) throw new Error('No backup file chosen.');
    if(sqliteRuntime){
      await lifecycle.idle();bulkAccess.idle();
      if(!pendingRestoreSource||paddock?.busy)throw Error('Reopen the backup and wait for Paddock before restoring.');
      const source=pendingRestoreSource;await require('./storage-activation').requestRestore(app.getPath('userData'),source.file,source.sha256,{beforePublish:()=>{bulkAccess.idle();if(pendingRestoreSource!==source||paddock?.busy||pluginHost?.timing?.reservation)throw Error('Restore was cancelled or Paddock or timing hardware became busy. Open the backup again.');}});
      app.relaunch();app.quit();return {restarting:true};
    }
    await lifecycle.idle(); // (1.61.2: a change that is still on its way to the file is in the safety copy too)
    if (!pendingRestore) throw new Error('No backup file chosen.');
    await lifecycle.idle();
    const safety = await bulkStorage.safetyCopy();
    bulkAccess.idle();
    if (!pendingRestore) throw Error('Backup restore was cancelled.');
    if(paddock?.busy)throw Error('Wait for the Paddock operation before restoring a backup.');
    paddock.stop();
    try{await bulkStorage.restore(pendingRestore);await lifecycle.refreshSettings();pendingRestore=null;}
    finally{paddock=(sqliteRuntime?sqliteRuntime.createPaddock():new (require('./paddock').Paddock)(db));paddock.isRacing=()=>!!live.dyn&&['countdown','running','paused','between'].includes(live.dyn.phase);}
    applyNet().finally(() => BrowserWindow.getAllWindows().forEach(w => { if (!w.isDestroyed()) w.webContents.reload(); }));
    return { safety };
  });
  bulkAccess.handle('backup:cancel', () => { pendingRestore = null;pendingRestoreSource=null; });
  bulkAccess.handle('backup:native-save',async e=>{
    if(!sqliteRuntime)throw Error('Native backups require SQLite storage.');
    const choice=await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender),{title:'Create a new native SQLite backup folder',defaultPath:'SlotForge-Timing-'+localDate()+'.sqlite-backup'});
    if(choice.canceled||!choice.filePath)return {canceled:true};bulkAccess.idle();bulkStorage.assertExportTarget(choice.filePath);await lifecycle.idle();bulkAccess.idle();
    await sqliteRuntime.client.backupSnapshot(choice.filePath,{version:app.getVersion()});return {saved:true,path:choice.filePath};
  });
  bulkAccess.handle('backup:native-restore',async e=>{
    if(!sqliteRuntime||sqliteTestProfile)throw Error('Use a production SQLite profile for native restore.');
    const idle=()=>{bulkAccess.idle();if(paddock?.busy||pluginHost?.timing?.reservation)throw Error('Finish Paddock and timing operations before restoring.');};idle();
    const choice=await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender),{title:'Choose a native SQLite backup folder',properties:['openDirectory']});
    if(choice.canceled||!choice.filePaths?.length)return {canceled:true};idle();
    const answer=await dialog.showMessageBox(BrowserWindow.fromWebContents(e.sender),{type:'question',title:'Restore native SQLite backup',message:'Replace the database with this backup on restart?',detail:'Timing will copy and verify the backup before switching. The current database and a before-restore snapshot are kept. Allow disk space for all copies. This backup is for SQLite-capable builds.',buttons:['Cancel','Restore and restart'],defaultId:0,cancelId:0});
    if(answer.response!==1)return {canceled:true};await lifecycle.idle();idle();await resourceStore.idle();if((await resourceStore.read()).checkpoint)throw Error('Finish or discard the unfinished resource event before restoring.');
    await require('./storage-activation').requestNativeRestore(app.getPath('userData'),choice.filePaths[0],{beforePublish:async()=>{idle();if((await resourceStore.read()).checkpoint)throw Error('An unfinished resource event appeared. Finish or discard it before restoring.');idle();}});app.relaunch();app.quit();return {restarting:true};
  });
  ipcMain.handle('custom:list', (_e, entity) => records.customFields(entity));
  ipcMain.handle('custom:add', (_e, entity, field) => records.addCustomField(entity, field));
  ipcMain.handle('custom:remove', (_e, entity, id) => records.removeCustomField(entity, id));
  ipcMain.handle('custom:group', (_e, entity, id, group) => records.setCustomFieldGroup(entity, id, group));
  // how the computer and the app are doing (the Performance line, 1.60.0): it only looks while somebody asks
  const perf = perfCollector = require('./perfstats').createCollector({ app, screen, os, process, db, storage: lifecycle, version: app.getVersion(), readText: p => fs.promises.readFile(p, 'utf8'),
    windows: () => BrowserWindow.getAllWindows().filter(w => !w.isDestroyed()).map(w => { try { return { title: w.getTitle(), pid: w.webContents.getOSProcessId(), visible: w.isVisible(), minimized: w.isMinimized(), focused: w.isFocused(), live: w === liveWin }; } catch { return null; } }).filter(Boolean) });
  ipcMain.handle('perf:stats', () => perf.collect());
  ipcMain.handle('settings:get', () => lifecycle.settings());
  // A Live Race window or a subframe cannot open a port or drive its pins.
  const parallelOwner = e => { if (!mainWin || mainWin.isDestroyed() || e.sender !== mainWin.webContents || e.senderFrame !== e.sender.mainFrame) throw Error('Parallel-port access belongs to the main app window.'); };
  const phidgetOwner = e => { if (!mainWin || mainWin.isDestroyed() || e.sender !== mainWin.webContents || e.senderFrame !== e.sender.mainFrame) throw Error('Phidget access belongs to the main app window.'); };
  ipcMain.handle('phidget:state', e => { phidgetOwner(e); return phidget.state(); });
  ipcMain.handle('phidget:scan', e => { phidgetOwner(e); return phidget.scan(); });
  ipcMain.handle('phidget:open', (e, value) => { phidgetOwner(e); if (lifecycle.settings().timingHw !== 'phidget') throw Error('Choose Phidget as the timing hardware first.'); return phidget.open(value); });
  ipcMain.handle('phidget:close', e => { phidgetOwner(e); return phidget.close(); });
  ipcMain.handle('phidget:alive', e => { phidgetOwner(e); return phidget.alive(); });
  ipcMain.handle('phidget:arm', (e, on) => { phidgetOwner(e); return phidget.armTests(on); });
  ipcMain.handle('phidget:test', (e, index) => { phidgetOwner(e); return phidget.test(index); });
  ipcMain.handle('phidget:race', (e, on, lanes, lease) => { phidgetOwner(e); if (on && lifecycle.settings().timingHw !== 'phidget') throw Error('Phidget is not the timing hardware in use.'); return phidget.setRace(on, lanes, lease); });
  ipcMain.handle('phidget:outputs', (e, wants, lease) => { phidgetOwner(e); if (lifecycle.settings().timingHw !== 'phidget') throw Error('Phidget is not the timing hardware in use.'); return phidget.outputs(wants, lease); });
  ipcMain.handle('parallel:alive', e => { parallelOwner(e); return parallel.alive(); });
  ipcMain.handle('parallel:state' , e => { parallelOwner(e); return parallel.state(); });
  ipcMain.handle('parallel:check', (e, value) => { parallelOwner(e); return parallel.check(value); });
  ipcMain.handle('parallel:open', (e, value) => { parallelOwner(e); return parallel.open(value); });
  ipcMain.handle('parallel:close', e => { parallelOwner(e); return parallel.close(); });
  ipcMain.handle('parallel:arm', (e, on) => { parallelOwner(e); return parallel.armTests(on); });
  ipcMain.handle('parallel:test', (e, pin, on) => { parallelOwner(e); return parallel.test(pin, on); });
  ipcMain.handle('parallel:race', (e, on, lanes, lease) => { parallelOwner(e); if (on && lifecycle.settings().timingHw !== 'parallel') throw Error('Parallel Port is not the timing hardware in use.'); return parallel.setRace(on, lanes, lease); });
  ipcMain.handle('parallel:outputs', (e, value, lease) => { parallelOwner(e); if (lifecycle.settings().timingHw !== 'parallel') throw Error('Parallel Port is not the timing hardware in use.'); return parallel.outputs(value, lease); });
  // the race save is written in the background (1.60.0): the program does not wait for the disk, a read waits for a save that is on its way
  ipcMain.handle('resume:get', () => lifecycle.resume());
  ipcMain.handle('resume:save', (e, snap) => {resourceOwner(e);return lifecycle.saveResume(snap);});
  ipcMain.handle('resume:clear', e => {resourceOwner(e);return lifecycle.clearResume();});
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
  ipcMain.handle('settings:set', async (_e, patch) => {
    if(patch&&('pluginTiming' in patch||'timingHw' in patch)){
      if(!mainWin||_e.sender!==mainWin.webContents||_e.senderFrame!==mainWin.webContents.mainFrame)throw Error('Change timing settings in the main app window.');
      const timing=pluginHost?.timing;
      if(live.dyn&&['countdown','running','paused','between','review'].includes(live.dyn.phase)&&('pluginTiming' in patch||patch.timingHw&&patch.timingHw!==lifecycle.settings().timingHw))throw Error('Finish or leave the race before changing timing settings.');
      if(timing?.reservation&&('pluginTiming' in patch||('timingHw' in patch&&patch.timingHw!=='plugin')))throw Error('Finish or leave the race before changing plugin timing.');
      if('pluginTiming' in patch){if(timing?.connected||timing?.connection)throw Error('Disconnect before changing plugin lane assignments.');patch={...patch,pluginTiming:timing.validate(patch.pluginTiming)};}
      if('timingHw' in patch&&patch.timingHw!=='plugin'&&timing?.connected)await timing.disconnect();
    }
     if (Object.prototype.hasOwnProperty.call(patch || {}, 'phidget')) { phidgetOwner(_e); if (phidget.state().connected) throw Error('Disconnect before changing Phidget channel assignments.'); const P = require('./renderer/phidget'), errors = P.validate(P.config(patch.phidget)); if (errors.length) throw Error(errors[0]); } if (phidget.state().race && (Object.prototype.hasOwnProperty.call(patch || {}, 'phidget') || (Object.prototype.hasOwnProperty.call(patch || {}, 'timingHw') && patch.timingHw !== 'phidget'))) throw Error('Leave the race before changing its Phidget setup.'); if (Object.prototype.hasOwnProperty.call(patch || {}, 'parallelPort')) { parallelOwner(_e); if (parallel.state().connected) throw Error('Disconnect before changing parallel-port assignments.'); const P = require('./renderer/parallel'), errors = P.validate(P.config(patch.parallelPort)); if (errors.length) throw Error(errors[0].text); } if (parallel.state().race && (Object.prototype.hasOwnProperty.call(patch || {}, 'parallelPort') || (Object.prototype.hasOwnProperty.call(patch || {}, 'timingHw') && patch.timingHw !== 'parallel'))) throw Error('Finish or leave the race before changing its parallel-port setup.'); const s = await lifecycle.updateSettings(patch); if(db)db.bg = backgroundOn(s); if (Object.keys(patch || {}).some(k => k.startsWith('net'))) await applyNet(); return s; });
  ipcMain.handle('net:status', () => netStatus());
  applyNet().finally(createWindow);
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => app.quit());
app.on('before-quit',()=>paddock?.stop());
let quitFlushed = false;
let quitWaiting = false;
app.on('before-quit', e => {
  if (quitWaiting) { e.preventDefault(); return; }
  if (typeof parallel !== 'undefined') parallel.shutdown();
  phidget.shutdown();
  if (net.server) net.server.close();
  // a race save or a setting that is on its way is written first (at most three seconds): the files then hold the last state, not the one before
  if (!quitFlushed && (db || sqliteRuntime) && (pluginHost || paddock?.busy || lifecycle.pending() || (typeof resourceStore!=='undefined'&&resourceStore?.pending))) {
    e.preventDefault();
    quitWaiting = true;
    const saveDone = Promise.all([paddock?.idle(),typeof resourceStore!=='undefined'&&resourceStore ? resourceStore.idle() : Promise.resolve()]).then(()=>lifecycle.shutdown());
    Promise.allSettled([
      pluginHost?.shutdown(),
      Promise.race([saveDone, new Promise(r => setTimeout(r, 3000))])
    ]).then(() => { quitWaiting = false; quitFlushed = true; app.quit(); });
  }
});
