// The only bridge between the app window and the database.
// It carries the database, the live race, the Trackmate permission list and the import, export and backup files.
const { contextBridge, ipcRenderer, webFrame } = require('electron');
const listeners = { static: new Set(), push: new Set(), command: new Set(), resync: new Set() };
ipcRenderer.on('live:command', (_e, c) => listeners.command.forEach(f => f(c)));
ipcRenderer.on('live:static', (_e, s) => listeners.static.forEach(f => f(s)));
ipcRenderer.on('live:push', (_e, d) => listeners.push.forEach(f => f(d)));
ipcRenderer.on('live:resync', () => listeners.resync.forEach(f => f()));
const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('api', {
  schema: () => call('schema'),
  dbPath: () => call('db:path'),
  voiceReport: () => call('voices:report'), // the voice lists of Windows, as text lines (Audio Settings > Voice report)
  list: entity => call('db:list', entity),
  add: (entity, item) => call('db:add', entity, item),
  update: (entity, id, patch) => call('db:update', entity, id, patch),
  remove: (entity, id) => call('db:remove', entity, id),
  linkedLaps: (entity, id) => call('db:linked', entity, id),
  saveSession: (session, laps) => call('session:save', session, laps),
  removeSession: id => call('session:remove', id),
  exportDeps: picks => call('transfer:deps', picks),
  exportData: (picks, extras) => call('transfer:export', picks, extras),
  importOpen: () => call('transfer:open'),
  importApply: () => call('transfer:apply'),
  importCancel: () => call('transfer:cancel'),
  backupSave: () => call('backup:save'),
  backupOpen: () => call('backup:open'),
  backupRestore: () => call('backup:restore'),
  backupCancel: () => call('backup:cancel'),
  exportPdf: (html, name) => call('pdf:export', html, name),
  customFields: entity => call('custom:list', entity),
  addCustomField: (entity, field) => call('custom:add', entity, field),
  removeCustomField: (entity, id) => call('custom:remove', entity, id),
  setCustomFieldGroup: (entity, id, group) => call('custom:group', entity, id, group),
  setZoom: factor => { const k = Number(factor); if (k >= 0.5 && k <= 3) webFrame.setZoomFactor(k); }, // the size of the interface of this window (App Settings > General > Display)
  getSettings: () => call('settings:get'),
  setSettings: patch => call('settings:set', patch),
  // a race that is running is kept in a file, so that a crash or a power cut does not lose it (1.9.0)
  getResume: () => call('resume:get'),
  saveResume: snap => call('resume:save', snap),
  clearResume: () => call('resume:clear'),
  // the running race, shared with the Live Race window
  liveStatic: s => ipcRenderer.send('live:static', s),
  livePush: d => ipcRenderer.send('live:push', d),
  liveCommand: c => ipcRenderer.send('live:command', c),
  onCommand: f => { listeners.command.add(f); return () => listeners.command.delete(f); },
  liveGet: () => call('live:get'),
  liveFullscreen: on => call('live:fullscreen', on),
  windowFullscreen: on => call('win:fullscreen', on),
  liveOpen: () => call('live:open'),
  netStatus: () => call('net:status'),
  // choosing a USB device (the main process lists them, this window shows the list)
  onHwChoose: f => { ipcRenderer.removeAllListeners('hw:choose'); ipcRenderer.on('hw:choose', (_e, kind, list) => f(kind, list)); },
  hwChosen: id => ipcRenderer.send('hw:chosen', id),
  onLiveStatic: f => { listeners.static.add(f); return () => listeners.static.delete(f); },
  onLive: f => { listeners.push.add(f); return () => listeners.push.delete(f); },
  onLiveResync: f => { listeners.resync.add(f); return () => listeners.resync.delete(f); } // the app asks the race window to send the whole state again
});
