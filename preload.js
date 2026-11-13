// The only bridge between the app window and the database.
// It carries the database, the live race, the Trackmate permission list and the import, export and backup files.
const { contextBridge, ipcRenderer, webFrame } = require('electron');
const thumbnailListeners=new Set();
ipcRenderer.on('library:thumbnail-job',(_e,job)=>thumbnailListeners.forEach(fn=>fn(job)));
const listeners = { static: new Set(), push: new Set(), command: new Set(), resync: new Set() };
ipcRenderer.on('live:command', (_e, c) => listeners.command.forEach(f => f(c)));
ipcRenderer.on('live:static', (_e, s) => listeners.static.forEach(f => f(s)));
ipcRenderer.on('live:push', (_e, d) => listeners.push.forEach(f => f(d)));
ipcRenderer.on('live:resync', () => listeners.resync.forEach(f => f()));
const call = (channel, ...args) => ipcRenderer.invoke(channel, ...args);
const catalogueCall=async(channel,...args)=>{const value=await call(channel,...args);if(value?.catalogueStale)throw Object.assign(Error('The catalogue changed. Refresh the list before continuing.'),{code:'CATALOGUE_CHANGED'});return value;};

// Sandboxed preload: Web Crypto and browser storage only. Persist identifiers,
// never save payloads or media. An entry is removed only after an acknowledgement.
const editorFlights=new Map(), editorPrefix='slotforge-editor-save-v1:';
const editorCanonical=value=>Array.isArray(value)?'['+value.map(editorCanonical).join(',')+']':value&&typeof value==='object'?'{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+editorCanonical(value[k])).join(',')+'}':JSON.stringify(value);
async function editorSave(operation,channel,...values){
  const args=JSON.parse(JSON.stringify(values)); // Freeze the intent before any awaits.
  const flight=editorCanonical({operation,args});
  if(editorFlights.has(flight))return editorFlights.get(flight);
  // Deferring the body lets the in-flight map be set before any write begins.
  const job=Promise.resolve().then(async()=>{
    const scope=await call('db:editor-scope');
    if(!scope)return call(channel,...(channel==='session:remove'?[args[1]]:args)); // Existing JSON storage is unchanged.
    const bytes=new TextEncoder().encode(editorCanonical({scope,operation,args}));
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    const key=editorPrefix+digest;
    let id;
    try{
      id=localStorage.getItem(key);
      if(id&&!/^[0-9a-f-]{36}$/.test(id))throw Error('Invalid pending save identity.');
      if(!id){
        let count=0;for(let n=0;n<localStorage.length;n++)if(localStorage.key(n)?.startsWith(editorPrefix))count++;
        if(count>=128)throw Error('Too many unconfirmed saves.');
        id=crypto.randomUUID();localStorage.setItem(key,id);
      }
    }catch(error){throw Error('Cannot safely remember this save. '+error.message+' No save was sent.');}
    let reply;
    try{reply=await call('db:editor-save',{id,scope,operation,args});}
    catch(error){throw Error('The save could not be confirmed. Retry the same save to check it safely. '+error.message);}
    if(!reply||typeof reply.ok!=='boolean')throw Error('Save acknowledgement was lost. Retry the same save to check it safely.');
    if(!reply.ok&&reply.retain)throw Object.assign(Error(reply.error),{code:reply.code});
    // Never silently treat a later identical action as a retry after cleanup
    // fails. Explain the known outcome and retain the safe identity.
    try{localStorage.removeItem(key);}catch{throw Error(reply.ok?'The save succeeded, but its retry tracking could not be cleared. Retry the same save to clear it safely.':'The save was rejected and its retry tracking could not be cleared. '+reply.error);}
    if(!reply.ok)throw Error(reply.error||'The save was rejected.');
    return reply.value;
  }).finally(()=>editorFlights.delete(flight));
  editorFlights.set(flight,job);return job;
}

contextBridge.exposeInMainWorld('api', {
  onThumbnailJob:fn=>{thumbnailListeners.add(fn);},
  thumbnailReady:()=>ipcRenderer.send('library:thumbnail-ready'),
  thumbnailResult:(id,data)=>ipcRenderer.send('library:thumbnail-result',id,data),
  paddockStatus: () => call('paddock:status'),
  libraryStatus:()=>call('library:status'),
  libraryCar:id=>call('library:car',id),
  librarySave:input=>call('library:save',input),
  libraryService:input=>call('library:service',input),
  librarySaves:()=>call('library:saves'),
  libraryOriginalHistory:options=>call('library:original-history',options),
  libraryRestore:()=>call('library:restore'),
  libraryRetry:id=>call('library:retry',id),
  libraryResolve:id=>call('library:resolve',id),
  paddockCollectionMigration: options => call('paddock:collection-migration',options),
  paddockHistoricalReview: options => call('paddock:historical-review',options),
  paddockHistory: options => call('paddock:history',options),
  paddockDiscover: () => call('paddock:discover'),
  paddockSharedCar:id=>call('paddock:shared-car',id),
  paddockSharedSave:input=>call('paddock:shared-save',input),
  paddockSharedSaves:()=>call('paddock:shared-saves'),
  paddockSharedResolve:id=>call('paddock:shared-resolve',id),
  paddockSharedRetry:id=>call('paddock:shared-retry',id),
  paddockLocalStart:()=>call('paddock:local-start'),
  paddockLocalDiscover: () => call('paddock:local-discover'),
  paddockTransfers: () => call('paddock:transfers'),
  paddockTransferCreate: items => call('paddock:transfer-create',items),
  paddockTransferRefresh: id => call('paddock:transfer-refresh',id),
  paddockTransferCancel: id => call('paddock:transfer-cancel',id),
  paddockTransferPreview: id => call('paddock:transfer-preview',id),
  paddockTransferOrigin: id => call('paddock:transfer-origin',id),
  paddockTransferAccept: (id,expected) => call('paddock:transfer-accept',id,expected),
  paddockConnect: value => call('paddock:connect',value),
  paddockDisconnect: forget => call('paddock:disconnect',forget),
  paddockBrowse: () => call('paddock:browse'),
  paddockCatalogue: (force=false) => call('paddock:catalogue',force),
  paddockPicture: (id,key) => call('paddock:picture',id,key),
  paddockLocalCars: () => call('paddock:locals'),
  paddockLink: (id,localId) => call('paddock:link',id,localId),
  paddockRefresh: () => call('paddock:refresh'),
  paddockPrepare: ids => call('paddock:prepare',ids),
  paddockRetry: () => call('paddock:retry'),
  paddockCheckReceipt: id => call('paddock:receipt',id),
  pluginDisplayCatalog: () => call('plugins:displayCatalog'),
  pluginRuleCatalog: () => call('plugins:ruleCatalog'),
  pluginRulePrepare: (id,saved) => call('plugins:rulePrepare',id,saved),
  pluginDisplayRender: (snapshot,requests) => call('plugins:displayRender',snapshot,requests),
  pluginDisplayTool: request => call('plugins:displayTool',request),
  pluginTimingList: () => call('plugins:timingList'),
  pluginTimingConnect: value => call('plugins:timingConnect',value),
  pluginTimingClose: () => call('plugins:timingClose'),
  pluginTimingAlive: () => call('plugins:timingAlive'),
  pluginTimingRace: (on,lanes,lease) => call('plugins:timingRace',on,lanes,lease),
  pluginTimingOutputs: (value,lease) => call('plugins:timingOutputs',value,lease),
  pluginTimingSimulate: value => call('plugins:timingSimulate',value),
  onPluginTiming: f => { const listener=(_e,value)=>f(value);ipcRenderer.on('plugins:timing-event',listener);return ()=>ipcRenderer.removeListener('plugins:timing-event',listener); },
  pluginsList: () => call('plugins:list'),
  pluginsOpen: () => call('plugins:open'),
  pluginsCancel: () => call('plugins:cancel'),
  pluginsInstall: () => call('plugins:install'),
  pluginsStart: (id,digest,trust) => call('plugins:start',id,digest,trust),
  pluginsStop: id => call('plugins:stop',id),
  pluginsSettings: (id,values) => call('plugins:settings',id,values),
  pluginsCommand: (id,command) => call('plugins:command',id,command),
  pluginsRollback: id => call('plugins:rollback',id),
  pluginsRemove: (id,deleteData=false) => call('plugins:remove',id,deleteData),
  pluginsDisableAll: () => call('plugins:disableAll'),
  pluginsRestartSafe: () => call('plugins:restartSafe'),
  packsList: () => call('packs:list'),
  packsOpen: () => call('packs:open'),
  packsCancel: () => call('packs:cancel'),
  packsInstall: () => call('packs:install'),
  packsEnable: (id,on) => call('packs:enable',id,on),
  packsRemove: id => call('packs:remove',id),
  packsRollback: id => call('packs:rollback',id),
  packsDisableAll: () => call('packs:disableAll'),
  packsRecover: () => call('packs:recover'),
  packsCopy: id => call('packs:copy',id),
  packsTheme: (id,theme) => call('packs:theme',id,theme),
  packsExport: id => call('packs:export',id),
  packsCreate: (picks,manifest,themes) => call('packs:create',picks,manifest,themes),
  schema: () => call('schema'),
  dbPath: () => call('db:path'),
  voiceReport: () => call('voices:report'), // the voice lists of Windows, as text lines (Audio Settings > Voice report)
  list: entity => call('db:list', entity),
  getRecord: (entity, id) => call('db:get', entity, id),
  homeStatistics: options=>catalogueCall('db:home-statistics',options),
  homeSessions: options=>catalogueCall('db:home-sessions',options),
  raceSeason: options=>catalogueCall('db:race-season',options),
  raceCharts: ids=>catalogueCall('db:race-charts',ids),
  raceInputs: options=>catalogueCall('db:race-inputs',options),
  editorRead: (kind,entity,value)=>catalogueCall('db:editor-read',kind,entity,value),
  referencePage: (entity,options)=>catalogueCall('db:reference-page',entity,options),
  referenceDetails: (entity,ids,revision)=>catalogueCall('db:reference-details',entity,ids,revision),
  historyPage: (pool,options)=>catalogueCall('db:history-page',pool,options),
  historySession: (pool,id,options)=>catalogueCall('db:history-session',pool,id,options),
  carStatistics: id=>call('db:car-statistics',id),
  catalogue: (entity, options) => catalogueCall('db:catalogue',entity,options),
  cataloguePicture: (entity,id,revision) => catalogueCall('db:catalogue-picture',entity,id,revision),
  add: (entity, item) => editorSave('add','db:add', entity, item),
  update: (entity, id, patch) => editorSave('update','db:update', entity, id, patch),
  remove: (entity, id) => editorSave('remove','db:remove', entity, id),
  linkedLaps: (entity, id) => call('db:linked', entity, id),
  saveSession: (session, laps) => call('session:save', session, laps),
  removeSession: id => editorSave('remove','session:remove','sessions', id),
  exportDeps: picks => call('transfer:deps', picks),
  transferChoices: () => call('transfer:choices'),
  nativeBackup: () => call('backup:native-save'),
  nativeRestore: () => call('backup:native-restore'),
  exportData: (picks, extras) => call('transfer:export', picks, extras),
  importOpen: () => call('transfer:open'),
  importApply: () => call('transfer:apply'),
  importCancel: () => call('transfer:cancel'),
  storageStatus: () => call('storage:status'),
  activateSqlite: () => call('storage:activate'),
  backupSave: () => call('backup:save'),
  backupOpen: () => call('backup:open'),
  backupRestore: () => call('backup:restore'),
  backupCancel: () => call('backup:cancel'),
  exportPdf: (html, name) => call('pdf:export', html, name),
  customFields: entity => call('custom:list', entity),
  addCustomField: (entity, field) => editorSave('addCustomField','custom:add', entity, field),
  removeCustomField: (entity, id) => editorSave('removeCustomField','custom:remove', entity, id),
  setCustomFieldGroup: (entity, id, group) => editorSave('setCustomFieldGroup','custom:group', entity, id, group),
  setZoom: factor => { const k = Number(factor); if (k >= 0.5 && k <= 3) webFrame.setZoomFactor(k); }, // the size of the interface of this window (App Settings > General > Display)
  getSettings: () => call('settings:get'),
  setSettings: patch => call('settings:set', patch),
  parallelAlive: () => call('parallel:alive'),
  parallelState: () => call('parallel:state'),
  parallelCheck: config => call('parallel:check', config),
  parallelOpen: config => call('parallel:open', config),
  parallelClose: () => call('parallel:close'),
  parallelArm: on => call('parallel:arm', on),
  parallelTest: (pin, on) => call('parallel:test', pin, on),
  parallelRace: (on, lanes, lease) => call('parallel:race', on, lanes, lease),
  parallelOutputs: (wants, lease) => call('parallel:outputs', wants, lease),
  onParallel: f => { const listener = (_e, value) => f(value); ipcRenderer.on('parallel:event', listener); return () => ipcRenderer.removeListener('parallel:event', listener); },
  // a race that is running is kept in a file, so that a crash or a power cut does not lose it (1.9.0)
  perfStats: () => call('perf:stats'), // how the computer and the app are doing (App Settings > General > Performance)
  resourceBegin:(id,context)=>call('resources:begin',id,context),
  resourceLedger:()=>call('resources:ledger'),
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
