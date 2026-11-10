'use strict';
// Normal Timing read shapes backed by the common catalogue. Local IDs are
// aliases, never another editable copy of canonical car specifications.
const C=require('./catalogue-read');
async function boundedMap(items,fn){const result=new Array(items.length);let next=0;await Promise.all(Array.from({length:Math.min(8,items.length)},async()=>{for(;;){const i=next++;if(i>=items.length)return;result[i]=await fn(items[i]);}}));return result;}
async function consistent(fn){try{return await fn();}catch(e){if(['QUERY_CHANGED','SNAPSHOT_CHANGED'].includes(e.code))throw C.stale();throw e;}}
const encode=token=>JSON.stringify(token);
function decode(revision){let token;try{if(typeof revision!=='string'||revision.length>1024)throw Error();token=JSON.parse(revision);}catch{throw Error('Invalid shared catalogue revision.');}if(typeof token?.id!=='string'||typeof token.epoch!=='string'||!Number.isSafeInteger(token.revision))throw Error('Invalid shared catalogue revision.');return token;}
function projection(car,{localId=car.id,original={},classes=[]}={}){
 const f=car.fields,cls=classes.find(c=>c.name===f.raceClass),row={...original,id:localId,name:f.name,brand:f.maker,manufacturer:f.marque,model:f.model||f.name,reference:f.reference,scale:f.scale,number:f.number,livery:f.livery,motor:f.motor,tyres:f.rearTyres,gearing:f.pinion!==null&&f.gear!==null?`${f.pinion}/${f.gear}`:'',weight:f.weight??car.unparsed?.weight??'',raceClass:cls?.id||'',raceClassName:f.raceClass,sharedLibrary:{carId:car.id,revision:car.revision,archived:car.archived}};
 delete row.paddock;delete row.picture;delete row.extraPictures;
 if(Object.hasOwn(car,'picture'))row.picture=car.picture;
 if(Array.isArray(car.photos))row.extraPictures=car.photos.map(p=>p.data);
 return row;
}
function wrap(base,client){
 const Fields=require('./shared-library-fields'),classes=()=>Fields.classes(base,client);
 const Reads=require('./shared-library-reads');
 client.localMatches=async rows=>Object.fromEntries((await boundedMap(rows,async r=>r.sourceId===client.installationId&&await base.get('sessions',r.sessionId)?[JSON.stringify([r.sourceId,r.sessionId]),r.sessionId]:null)).filter(Boolean));
 const mapped=async(car,original,cl)=>{const binding=await client.currentSettings(car.id);const row=projection(car,{localId:binding?.localCarId||client.localId(car.id),original:{...original,...binding?.effective,...await Fields.hydrate(client,car)},classes:cl||await classes()});if(binding)row.sharedLibrary.settingsBinding={bindingToken:binding.bindingToken,revision:binding.revision,mergeRevision:binding.mergeRevision};return row;};
 const adapter={
  async customFields(entity){return entity==='slotcars'?Fields.definitions(client):base.customFields(entity);},
  async addCustomField(entity,f,operationId){return entity==='slotcars'?Fields.write(client,{label:f.label,type:f.type==='list'?'choice':f.type,group:f.group||'',options:f.options||[]},null,operationId):base.addCustomField(entity,f);},
  async setCustomFieldGroup(entity,id,group,operationId){if(entity!=='slotcars')return base.setCustomFieldGroup(entity,id,group);const old=(await client.handle.customSchema()).definitions.find(f=>f.id===id||f.legacy?.sourceId===client.installationId&&f.legacy.fieldId===id);if(!old)throw Error('The shared field no longer exists.');return Fields.write(client,{label:old.label,type:old.type,group,options:old.options},old,operationId);},
  async removeCustomField(entity,id){if(entity==='slotcars')throw Error('Shared field deletion is not supported by this engine. Existing values remain safe.');return base.removeCustomField(entity,id);},
  homeStatistics(options){return Reads.homeStatistics(base,client,options);},
  historyPage(pool,options){return Reads.historyPage(base,client,pool,options);},
  historySession(pool,id,options){return Reads.historySession(base,client,pool,id,options);},
  async carStatistics(id){return Reads.carStatistics(client,id,await adapter.get('slotcars',id));},
  async transferChoices(entity){if(entity==='raceclasses')return classes();if(entity!=='slotcars')return base.transferChoices(entity);const rows=[];let cursor;do{const p=await adapter.catalogue(entity,{limit:48,cursor});rows.push(...p.items.map(({record:r})=>({id:r.id,brand:r.brand,manufacturer:r.manufacturer,model:r.model||r.name})));cursor=p.next;}while(cursor);return rows;},
  async get(entity,id){if(entity==='raceclasses')return (await classes()).find(c=>c.id===id)||null;if(entity!=='slotcars')return base.get(entity,id);const [car,extra]=await Promise.all([client.currentCar(id,{includeMedia:true}),client.original(id,{omitMedia:true})]);const row=await mapped(car,extra?.value);return {...row,...(client.aliases.has(id)?{id}:{}),sharedLibrary:{...row.sharedLibrary,carId:car.id,revision:car.revision,archived:car.archived,databaseId:car.databaseId,recoveryId:car.recoveryId,extrasRevision:extra?.revision||0}};},
  async catalogue(entity,options={}){
   if(entity!=='slotcars')return base.catalogue(entity,options);
   const {query,limit,cursor}=C.options(entity,options);
   if(cursor&&(cursor.query!==query||!Number.isSafeInteger(cursor.offset)||cursor.offset<0))throw Error('Invalid shared catalogue cursor.');
   let page;try{page=await client.catalogue({search:query,limit,offset:cursor?.offset||0,...(cursor?{token:decode(cursor.revision)}:{})});}catch(e){if(['QUERY_CHANGED','SNAPSHOT_CHANGED'].includes(e.code))throw C.stale();throw e;}
   const cl=await classes(),items=await boundedMap(page.cars,async car=>{const original=await client.original(client.localId(car.id),{omitMedia:true});return {record:await mapped(car,original?.value,cl),hasPicture:!!car.hasPicture,galleryCount:car.galleryCount||0};});
   await consistent(()=>client.catalogue({limit:1,token:page.token}));
   return {items,revision:encode(page.token),next:page.nextOffset===null?null:{entity,query,revision:encode(page.token),offset:page.nextOffset,key:'shared',id:page.cars.at(-1).id}};
  },
  async cataloguePicture(entity,id,revision){
   if(entity!=='slotcars')return base.cataloguePicture(entity,id,revision);
   // Validate the catalogue token on both sides of the media read.
   try{const token=decode(revision);await client.catalogue({limit:1,token});const car=await client.car(id,{includeMedia:true});await client.catalogue({limit:1,token});return car.picture||null;}catch(e){if(['QUERY_CHANGED','SNAPSHOT_CHANGED'].includes(e.code))throw C.stale();throw e;}
  },
  async referencePage(entity,options={}){
   if(entity!=='slotcars')return base.referencePage(entity,options);
   const R=require('./reference-read'),o=R.options(entity,options),page=await consistent(()=>client.catalogue({limit:o.limit,offset:o.cursor?o.cursor.ordinal+1:0,...(o.cursor?{token:decode(o.cursor.revision)}:{})})),cl=await classes();
   const items=client.merges?await boundedMap(page.cars,c=>mapped(c,{},cl)):page.cars.map(c=>projection(c,{localId:client.localId(c.id),classes:cl}));if(client.merges)await consistent(()=>client.catalogue({limit:1,token:page.token}));return {items,scope:'shared-cars',revision:encode(page.token),next:page.nextOffset===null?null:R.cursor(entity,encode(page.token),page.nextOffset-1)};
  },
  async referenceDetails(entity,ids,revision){if(entity!=='slotcars')return base.referenceDetails(entity,ids,revision);require('./reference-read').selection(entity,ids,revision);return consistent(async()=>{const token=decode(revision);await client.catalogue({limit:1,token});const rows=await boundedMap(ids,id=>adapter.get(entity,id));await client.catalogue({limit:1,token});return rows;});},
  async list(entity){
   if(entity==='raceclasses')return classes();if(entity!=='slotcars')return base.list(entity);const rows=[];let cursor=null;
   do{const p=await adapter.referencePage(entity,{limit:200,cursor});rows.push(...p.items);cursor=p.next;if(rows.length>10000)throw Error('Use the paged slotcar catalogue for this collection.');}while(cursor);return rows;
  },
  async raceInputs(options){return consistent(async()=>{const token=options.carRevision?decode(options.carRevision):null;if(token)await client.catalogue({limit:1,token});const input=await base.raceInputs({...options,rows:options.rows.map(r=>({...r,carId:''}))});input.collections.raceclasses=await classes();input.collections.slotcars=await boundedMap([...new Set(options.rows.map(r=>r.carId).filter(Boolean))],id=>adapter.get('slotcars',id));if(input.collections.slotcars.some(c=>c.sharedLibrary.archived))throw Error('An archived car cannot start a new race.');if(token)await client.catalogue({limit:1,token});return input;});},
  async editorRead(kind,entity,value){if(kind!=='sample'||entity!=='slotcars')return base.editorRead(kind,entity,value);let offset=0,token;for(;;){const p=await client.catalogue({offset,limit:100,...(token?{token}:{})});token=p.token;const row=p.cars.find(c=>c.hasPicture);if(row){const car=await client.car(row.id,{includeMedia:true});await client.catalogue({token,limit:1});return [{id:client.localId(car.id),picture:car.picture}];}if(p.nextOffset===null)return [];offset=p.nextOffset;}},
  // Until atomic canonical + companion writes are qualified, never silently
  // send a normal form to the old private slotcar table.
  add(entity,item){if(entity==='slotcars')throw Error('Shared car editing is still under qualification.');return base.add(entity,item);},
  async update(entity,id,patch){if(entity==='slotcars'){
    // Race-time tyre selection is a Timing simulation setting, never a fitted
    // physical tyre change. Preserve other companion fields with a small patch.
    if(Object.keys(patch).length!==1||!Object.hasOwn(patch,'tyreCompound')||typeof patch.tyreCompound!=='string'||patch.tyreCompound.length>100)throw Error('Use the Slotcar editor to change this shared car.');
    if(client.merges)await client.merges.assertCurrent(id);
    const car=await client.car(id),binding=await client.currentSettings(id),extra=binding?null:await client.original(id,{selectedFields:['tyreCompound']}),s=await client.status();
    const r=await client.save({...s,action:'patch',carId:car.id,expectedRevision:car.revision,set:{},clear:[],...(binding?{timingSettings:{expectedRevision:binding.revision,expectedBindingToken:binding.bindingToken,set:patch}}:{timingExtras:{sourceId:client.installationId,originalId:client.localId(car.id),expectedRevision:extra?.revision||0,patch}})});
    if(r.state!=='committed')throw Error(r.error||'Tyre choice retained for retry.');return adapter.get('slotcars',id);
   }if(entity==='laps'||entity==='sessions'){const sid=entity==='sessions'?id:(await base.get(entity,id))?.sessionId;if(sid)await require('./shared-library-adopted-history').prepare(base,client,sid);}const value=await base.update(entity,id,patch);client.scheduleHistory();return value;},
  async remove(entity,id){if(entity==='raceclasses'&&String(id).startsWith('shared-class-'))throw Error('This class is used by shared cars. Change their Race class labels before removing it.');if(entity==='slotcars'){const s=await client.status(),car=await client.car(id),r=await client.save({...s,action:'archive',carId:car.id,expectedRevision:car.revision});if(r.state!=='committed')throw Error(r.error||'Archive retained for retry.');return;}if(entity==='sessions')return adapter.removeSession(id);if(['tracks','drivers'].includes(entity))for(const sid of await base.affectedSharedSessions(entity,id))await require('./shared-library-adopted-history').prepare(base,client,sid);if(entity==='laps'){const sid=(await base.get(entity,id))?.sessionId;if(sid)await require('./shared-library-adopted-history').prepare(base,client,sid);}const value=await base.remove(entity,id);client.scheduleHistory();return value;},
  async saveSession(session,laps){const id=await base.saveSession(session,laps);client.scheduleHistory();return id;},
  async removeSession(id){await require('./shared-library-adopted-history').prepare(base,client,id);const value=await base.removeSession(id);client.scheduleHistory();return value;},
  async editorSave(request){if(request?.args?.[0]==='slotcars'){if(['addCustomField','setCustomFieldGroup','removeCustomField'].includes(request.operation)){const prior=await client.storage.sharedRead({kind:'get',id:request.id});if(prior){if(prior.transport!=='engine'||prior.request.engineMethod!=='customDefinitionWrite')throw Error('Editor request identity conflict.');const result=prior.state==='pending'?await client.retry(prior.id):prior;if(result.state!=='committed')throw Error(result.error||'Resolve the retained field save.');return {ok:true,value:result.receipt.field};}return {ok:true,value:await adapter[request.operation](...request.args,request.id)};}throw Error('Use the shared car editor for canonical car changes.');}if(request.operation==='remove'&&['tracks','drivers','laps','sessions'].includes(request.args?.[0]))return {ok:true,value:await adapter.remove(...request.args)};const value=await base.editorSave(request);client.scheduleHistory();return value;}
 };
 return new Proxy(base,{get(target,key){return key in adapter?adapter[key]:typeof target[key]==='function'?target[key].bind(target):target[key];}});
}
module.exports={wrap,projection};
