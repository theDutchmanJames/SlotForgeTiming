'use strict';
const http=require('node:http');
const Discovery=require('./paddock-local-discovery');
const automaticStates=new Set(['queued','pending','approved','unavailable']);
function safeError(e){return ['UNAUTHENTICATED','INSTANCE_CHANGED'].includes(e.code)?'Paddock restarted or changed its local credential. Timing will rediscover the selected library.':e.message;}
module.exports={
 async negotiateHistory(d){
  const H=require('./paddock-history-write'),status=await this.hostRequest(d.address,'/v1/status',d.token,d.databaseId,undefined,131072,d.instanceId,undefined,'shared-history-v1');
  this.historyGuardContext=null;this.historyCapability=null;
  if(status.id!==d.databaseId||status.localInstanceId!==d.instanceId)throw Error('Local history identity changed.');
  if(!H.capability(status.capabilities?.sharedHistory)){const current=await this.connection(),c=current.connection;if(c?.mode==='local'&&c.databaseId===d.databaseId&&c.historyGuard){const next={...c};delete next.historyGuard;await this.storage.setConnection(next,current.revision);}return;}
  const ctx=H.context(await this.hostRequest(d.address,H.ROOT+'/status',d.token,d.databaseId,undefined,131072,d.instanceId),d.databaseId);
  this.historyGuardContext=ctx;this.historyCapability=status.capabilities.sharedHistory;
  const current=await this.connection(),c=current.connection;
  if(c?.mode==='local'&&c.databaseId===d.databaseId&&JSON.stringify(c.historyGuard)!==JSON.stringify(ctx))await this.storage.setConnection({...c,historyGuard:ctx},current.revision);
 },
 async discoverLocal(){const entries=await this.localChoices();return entries.map(d=>({key:d.key,databaseId:d.databaseId,name:d.name}));},
 async ensureLocal(connection){
  if(connection?.mode!=='local'||connection.automatic===false)throw Error('Reconnect the local Paddock library first.');
  const entries=await (this.localScan||Discovery.scan)(),d=entries.find(x=>x.key===connection.localKey);
  if(!d)throw Object.assign(Error('Local library unavailable. Keep Paddock running and enable Local library access in its Connections page.'),{code:'LOCAL_UNAVAILABLE'});
  if(d.databaseId!==connection.databaseId)throw Object.assign(Error('This Paddock profile now contains a different database. Reconnect deliberately; old results and transfers still belong to their original library.'),{code:'DATABASE_MISMATCH'});
  const status=await this.hostRequest(d.address,'/v1/status',d.token,d.databaseId,undefined,65536,d.instanceId);
  const capability=status.capabilities?.localLibrary;
  if(status.id!==d.databaseId||status.localInstanceId!==d.instanceId||typeof status.name!=='string'||status.name.length>200||capability?.version!==1||capability.imports!=='/v1/local-library/imports'||!status.permissions?.browse)throw Object.assign(Error('Local Paddock identity or permissions could not be verified.'),{code:'DATABASE_MISMATCH'});
  this.active();if(this.quiescing)throw Error('Timing is closing.');
  if(this.localDescriptor?.instanceId!==d.instanceId){this.closeLocalEvents();this.localDirty=true;}
  this.localDescriptor=d;this.code=d.token;this.connected=true;this.error='';this.negotiate(status);
  this.localCapabilities=status.capabilities.localLibrary;await this.negotiateHistory(d);
  return status;
 },
 connectLocal(input){return this.exclusive(async()=>{
  if(!Discovery.KEY.test(input.key)||typeof input.databaseId!=='string')throw Error('Select a discovered local Paddock library.');
  const before=await this.connection(),old=before.connection;
  if(old&&(old.mode!=='local'||old.databaseId!==input.databaseId||old.localKey!==input.key))throw Error('Forget the current connection before selecting a different Paddock library. Saved results and links remain intact.');
  const selection={mode:'local',localKey:input.key,databaseId:input.databaseId,automatic:true};
  try{
   let status;try{status=await this.ensureLocal(selection);}catch(e){if(!['LOCAL_UNAVAILABLE','ECONNREFUSED','ECONNRESET','ETIMEDOUT'].includes(e.code))throw e;await this.launchSelected(selection);status=await this.ensureLocal(selection);}const d=this.localDescriptor;
   await this.storage.setConnection({...selection,address:d.address,name:status.name,...(this.historyGuardContext?{historyGuard:this.historyGuardContext}:{}),results:!!status.permissions?.timingResults,timing:!!status.capabilities?.timing?.versions?.includes(1)},(await this.connection()).revision);
   await this.storage.sharedChange({action:'policy',disabled:false});await this.connection();this.nextCatalogueCheck=0;this.catalogueError='';this.schedule(0);this.startLocal();this.openLocalEvents(status);return this.status();
  }catch(e){this.closeLocalEvents();this.localDescriptor=null;this.code='';this.connected=false;throw e;}
 });},
 async localCall(connection,route,body,limit,recoveryId,method){
  if(this.isRacing?.())throw Error('Local Paddock updates are paused during racing.');
  if(connection.automatic===false)throw Error('Reconnect the local Paddock library first.');
  if(!this.localDescriptor||this.localDescriptor.databaseId!==connection.databaseId)await this.ensureLocal(connection);
  const d=this.localDescriptor;
  try{return await this.hostRequest(d.address,route,d.token,connection.databaseId,body,limit,d.instanceId,recoveryId,'scalable-v1',method);}
  catch(e){
   if(['UNAUTHENTICATED','INSTANCE_CHANGED'].includes(e.code)){this.localDescriptor=null;this.code='';this.connected=false;this.closeLocalEvents();}
   if(e.message?.includes(d.token))e.message='Paddock rejected the local request.';
   throw e;
  }
 },
 startLocal(){clearTimeout(this.localTimer);if(!this.stopped&&!this.quiescing)this.localTimer=setTimeout(()=>this.localTick(),1000).unref();},
 async localTick(){
  try{
   if(this.stopped||this.quiescing||this.sharedStarting||this.busy||this.isRacing?.())return;
   const c=(await this.connection()).connection;if(c?.mode!=='local'||c.automatic===false||this.stopped||this.quiescing||this.busy||this.isRacing?.())return;
   await this.exclusive(async()=>{
    const status=await this.ensureLocal(c),hadStream=!!this.localStream;this.openLocalEvents(status);
    if((this.localDirty||!hadStream)&&this.scalable&&!this.isRacing?.()){const cursor=this.localEventCursor;await this.browseScalable(status);if(cursor===this.localEventCursor)this.localDirty=false;}
    await this.syncSharedOperations?.();await this.syncLocalTransfers(false);await this.syncHistory();await this.syncHistoricalReviews?.();await this.syncCollectionMigration?.();
   });this.schedule(0);
  }catch(e){this.connected=false;this.error=safeError(e);this.localDescriptor=null;this.code='';this.closeLocalEvents();}
  finally{if(!this.stopped&&!this.quiescing)this.localTimer=setTimeout(()=>this.localTick(),this.collectionPending||this.historySyncPending&&!this.historySyncError?1000:30000).unref();}
 },
 closeLocalEvents(){this.localStream?.destroy();this.localStream=null;},
 openLocalEvents(status){
  if(this.localStream||status.capabilities?.scalable?.events!=='/v1/scalable/events'||!this.localDescriptor)return;
  const d=this.localDescriptor;
  const req=http.get(new URL('/v1/scalable/events',d.address),{headers:{Authorization:'Bearer '+d.token,'X-SlotForge-Instance':d.instanceId,'X-SlotForge-Database':d.databaseId,'X-SlotForge-Extensions':'scalable-v1',Accept:'text/event-stream'}},res=>{
   if(res.statusCode!==200||!String(res.headers['content-type']).startsWith('text/event-stream')){res.resume();req.destroy();return;}
   let pending='';res.setEncoding('utf8');res.on('data',chunk=>{
    pending+=chunk;if(Buffer.byteLength(pending)>32768){req.destroy();return;}
    for(let split;(split=pending.indexOf('\n\n'))>=0;){const event=pending.slice(0,split);pending=pending.slice(split+2);const data=event.split('\n').filter(s=>s.startsWith('data:')).map(s=>s.slice(5).trim()).join('\n');if(!data)continue;
     try{const v=JSON.parse(data);if(v.version!==1||v.databaseId!==d.databaseId||typeof v.cursor!=='string'||v.cursor.length>512){req.destroy();return;}if(v.cursor!==this.localEventCursor){this.localEventCursor=v.cursor;this.localDirty=true;}}catch{req.destroy();return;}
    }
   });res.on('error',()=>req.destroy());
  });
  this.localStream=req;req.setTimeout(45000,()=>req.destroy());req.on('error',()=>{});req.on('close',()=>{if(this.localStream===req)this.localStream=null;});
 },
 async localTransfers(){const entries=await this.storage.localRead({kind:'list'});return entries.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));},
 createLocalTransfers(selections){return this.exclusive(async()=>{
  const c=(await this.connection()).connection;if(c?.mode!=='local')throw Error('Connect to a local Paddock library first.');
  // Journal commit precedes all network work. A failed send remains resumable.
  await this.storage.localChange({action:'create',databaseId:c.databaseId,selections});
  await this.syncSharedOperations?.();await this.syncLocalTransfers(false);return this.localTransfers();
 });},
 async syncLocalTransfers(manual=false,id){
  const c=(await this.connection()).connection;if(c?.mode!=='local'||c.automatic===false)return;
  const list=(await this.localTransfers()).filter(s=>s.databaseId===c.databaseId&&(id?s.id===id:automaticStates.has(s.state))).sort((a,b)=>a.updatedAt.localeCompare(b.updatedAt)).slice(0,25);
  for(const summary of list){
   if(this.stopped||this.quiescing||this.isRacing?.())break;
   const x=await this.storage.localRead({kind:'get',id:summary.id});if(!x)continue;
   const route='/v1/local-library/imports/'+encodeURIComponent(x.request.sourceId)+'/'+encodeURIComponent(x.request.transferId);
   try{
    if(x.recoveryId&&x.recoveryId!==c.historyGuard?.recoveryId)throw Object.assign(Error('Paddock was restored. This transfer will not be recreated; reconcile the saved review.'),{code:'LOCAL_RECONCILE'});
    let r;
    try{r=await this.call(route,undefined,262144);}catch(e){
     if(e.code!=='IMPORT_NOT_FOUND')throw e;
     if(x.receipt)throw Object.assign(Error('Paddock no longer has this previously acknowledged transfer. Reconcile the original library or backup; Timing will not create the car again.'),{code:'LOCAL_RECONCILE'});
     const full=await this.storage.localRead({kind:'get',id:summary.id,full:true});
     r=await this.call('/v1/local-library/imports',full.request,262144);
    }
    require('./paddock-local-transfers').receipt(r,x.request,x.receipt,x.requestHash);
    if(x.cancelRequested&&r.cars.some(v=>v.status==='pending'))r=await this.call(route+'/cancel',{version:1,itemIds:r.cars.filter(v=>v.status==='pending').map(v=>v.itemId)},262144);
    await this.storage.localChange({action:'receipt',transferId:summary.id,receipt:r});
    if(r.cars[0].status==='approved'&&x.summary.state!=='linked'&&!this.isRacing?.()){
     if(!r.cars[0].present||r.cars[0].archived)await this.storage.localChange({action:'apply',transferId:summary.id});
     else {const profile=await this.profile(r.cars[0].paddockCarId);await this.storage.localChange({action:'apply',transferId:summary.id,profile});}
    }
   }catch(e){
    const attention=['IMPORT_CONFLICT','ORIGIN_CONFLICT','TARGET_CHANGED','LOCAL_RECONCILE','LOCAL_RECEIPT_MISMATCH','INVALID_IMPORT','INVALID_PAYLOAD','PAYLOAD_TOO_LARGE'].includes(e.code);
    await this.storage.localChange({action:'error',transferId:summary.id,attention,message:safeError(e)});
    if(manual)throw e;
    if(!attention)break;
   }
  }
 },
 refreshLocalTransfer(id){return this.exclusive(async()=>{await this.syncLocalTransfers(true,id);return this.localTransfers();});},
 cancelLocalTransfer(id){return this.exclusive(async()=>{await this.storage.localChange({action:'cancel',transferId:id});await this.syncLocalTransfers(true,id);return this.localTransfers();});},
 previewLocalTransfer(id){return this.storage.localRead({kind:'preview',id});},
 findLocalOrigin(id){return this.exclusive(async()=>{
  const x=await this.storage.localRead({kind:'get',id});if(!x)throw Error('Choose a saved transfer.');
  const r=await this.call('/v1/local-library/origins/'+encodeURIComponent(x.request.sourceId)+'?timingCarId='+encodeURIComponent(x.summary.localId),undefined,262144);
  const car=Array.isArray(r?.cars)&&r.cars.find(c=>c.timingCarId===x.summary.localId);
  if(r?.version!==1||r.databaseId!==x.request.databaseId||r.sourceId!==x.request.sourceId||!(/^[A-Za-z0-9_-]{1,100}$/).test(r.transferId)||!car||!['pending','approved','rejected','cancelled'].includes(car.status)||!(/^[A-Za-z0-9_-]{1,100}$/).test(car.paddockCarId))throw Error('Paddock returned an unexpected original review.');
  // An origin is evidence for reconciliation, never authority to invent the
  // missing original request or bypass its local revision/receipt checks.
  return {transferId:r.transferId,carId:car.paddockCarId,status:car.status};
 });},
 acceptLocalTransfer(id,expected){return this.exclusive(async()=>{await this.storage.localChange({action:'acceptChanged',transferId:id,expected});await this.syncLocalTransfers(true,id);return this.localTransfers();});}
};
