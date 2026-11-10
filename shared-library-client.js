'use strict';
// Direct common-engine client. Network credentials, discovery and Review are
// deliberately outside this boundary; no HTTP fallback is possible here.
const {randomUUID}=require('node:crypto');
const rejectCodes=new Set(['INVALID_OPERATION','INVALID_FIELD','FIELD_TYPE_CONFLICT','FIELD_LIMIT','INVALID_ORIGIN','RECOVERY_REQUIRED','DATABASE_MISMATCH','RECOVERY_CHANGED','REVISION_CONFLICT','CAR_ARCHIVED','CAR_REBUILT','INSTALLED_PART_CONFLICT','CAR_NOT_FOUND','OPERATION_CONFLICT','COMMAND_CONFLICT','PAYLOAD_TOO_LARGE','RECEIPT_MISMATCH']);
const fail=(code,message)=>Object.assign(Error(message),{code});
for(const code of ['CAR_MERGED','MERGE_SETTINGS_REQUIRED','MERGE_ENGINE_REQUIRED','MERGE_COMPATIBILITY_REQUIRED','MERGE_FENCE_INVALID','MERGE_LINEAGE_CONFLICT','SETTINGS_CONFLICT','SOURCE_MISMATCH'])rejectCodes.add(code);
class SharedLibraryClient {
 static async open({installationId,storage,mergeCompatibility=true,engine=require('./vendor/slotforge-library/index.cjs'),...options}){
  if(!storage?.sharedRead||!storage?.sharedChange)throw Error('A durable save journal is required.');
  let handle=await engine.open({...options,application:'SlotForge Timing',installationId});
  try{
   const bootstrap=await handle.bootstrapInfo?.(),original=bootstrap?.adoption?.find(r=>r.originKey===options.originKey);
   if(original&&original.sourceId!==installationId){installationId=original.sourceId;await handle.close();handle=await engine.open({...options,application:'SlotForge Timing',installationId});}
   const client=new SharedLibraryClient(handle,installationId,storage);client.bootstrap=bootstrap;client.initial=await handle.status();await client.loadAliases();if(mergeCompatibility){client.merges=new(require('./shared-library-merges').MergeView)(client);await client.merges.refresh();}return client;
  }catch(e){await handle.close();throw e;}
 }
 constructor(handle,installationId,storage){this.handle=handle;this.installationId=installationId;this.storage=storage;this.aliases=new Map();this.reverse=new Map();this.tail=Promise.resolve();this.closed=false;}
 exclusive(fn){if(this.closed)return Promise.reject(Error('Shared library is closing.'));const run=this.tail.then(fn);this.tail=run.catch(()=>{});return run;}
 async status(){const s=await this.handle.status();if(this.initial&&s.databaseId!==this.initial.databaseId)throw fail('DATABASE_MISMATCH','The shared library changed. Reopen it deliberately.');return s;}
 async loadAliases({commit=true}={}){
  for(let attempt=0;attempt<3;attempt++)try{
  const aliases=new Map(),reverse=new Map();let offset=0,token;
  for(;;){const page=await this.handle.adoptionStatus({sourceId:this.installationId,entity:'car',offset,limit:200,...(token?{token}:{})});token=page.token;
   for(const row of page.rows)if(row.entity==='car'){aliases.set(row.originalId,row.carId);if(!reverse.has(row.carId))reverse.set(row.carId,row.originalId);}
   if(page.nextOffset===null)break;if(!Number.isSafeInteger(page.nextOffset)||page.nextOffset<=offset)throw Error('Invalid adoption continuation.');offset=page.nextOffset;
  }
  if(commit){this.aliases=aliases;this.reverse=reverse;}return {aliases,reverse};
  }catch(e){if(e.code!=='QUERY_CHANGED'||attempt===2)throw e;}
 }
 canonicalId(id){return this.aliases.get(id)||id;}
 localId(id){return this.reverse.get(id)||id;}
 async car(id,options){return this.handle.car(this.canonicalId(id),options);}
 async currentCar(id,options){if(!this.merges)return this.car(id,options);const binding=await this.merges.binding(id);return this.handle.car(binding.carId,options);}
 async currentSettings(id){return this.merges?this.merges.binding(id):null;}
 async contributions(options){
  if(!this.merges)throw Error('Merge contribution reads are not activated for this client.');
  const before=await this.status(),value=await this.handle.mergeContributions(options);
  if(value.databaseId!==before.databaseId||value.recoveryId!==before.recoveryId)throw fail('QUERY_CHANGED','Contribution ownership changed. Refresh this session.');
  return value; // The engine's object token is opaque; never stringify/rebuild it.
 }
 async schema(){if(!this.handle.carSchema)throw Error('Update the common engine to supply its car field rules.');return this.handle.carSchema();}
 async catalogue(options={}){await this.merges?.refresh();return this.handle.catalogue(options);}
 async original(id,options={}){return this.handle.extensionRead({namespace:'timing.carExtras',sourceId:this.installationId,originalId:this.aliases.has(id)?id:this.localId(this.canonicalId(id)),...options});}
 async profile(id,includePicture=false){return this.handle.profile({carId:this.canonicalId(id),includePicture});}
 async editor(id,tyreSystems=[]){
  const schema=await this.schema(),car=id?await this.currentCar(id):null,binding=car?await this.currentSettings(car.id):null;
  const fields=structuredClone(require('./schema').slotcars.fields.filter(f=>['tyreCompound','damageFactor','failureFactor','serviceInterval'].includes(f.key)));
  const extra=binding?{revision:binding.revision,value:binding.fields}:id?await this.original(id,{selectedFields:fields.map(f=>f.key)}):null;
  if(binding)fields.find(f=>f.key==='serviceInterval').max=Number.MAX_SAFE_INTEGER;
  const tyre=fields.find(f=>f.key==='tyreCompound'),choices=new Map(tyre.options);
  for(const system of tyreSystems)for(const item of require('./renderer/weather').withTyres(system.tyres).TYRES.filter(t=>t.custom))choices.set(item.code,`${item.name} — ${system.name}`);
  if(extra?.value.tyreCompound&&!choices.has(extra.value.tyreCompound))choices.set(extra.value.tyreCompound,'Previously selected custom tyre (system unavailable)');tyre.options=[...choices];
  const custom=car?await this.handle.customRead({carId:car.id}):{...(await this.handle.customSchema()),values:{}},service=car?await this.handle.serviceRead({carId:car.id}):null;
  return {schema,car,custom,service,timing:{sourceId:this.installationId,originalId:id?this.localId(car.id):randomUUID(),revision:extra?.revision||0,values:extra?.value||{},fields,...(binding?{binding}:{})}};
 }
 async prepare(ids){
  if(this.paused)throw Error('The shared library is preparing to restart.');
  if(!Array.isArray(ids)||ids.length>32||ids.some(id=>typeof id!=='string'))throw Error('Choose the cars for this race.');
  const unique=ids.filter(Boolean);await this.merges?.refresh();const canonical=unique.map(id=>this.merges?this.merges.resolve(this.canonicalId(id)):this.canonicalId(id));
  if(new Set(canonical).size!==canonical.length)throw Error('A physical car can only be assigned to one entry.');
  const settings={};if(this.merges)for(const id of unique){await this.merges.assertCurrent(id);settings[id]=await this.currentSettings(id);}
  const before=await this.status(),captures={};
  for(const id of unique){const p=await this.profile(id);if(p.car.archived)throw Error('An archived car cannot start a race.');if(p.databaseId!==before.databaseId)throw fail('DATABASE_MISMATCH','Car configuration belongs to another library.');captures[id]={name:p.car.name,configuration:p.configuration};}
  // First capture may persist the library signing key. Check car revisions,
  // then bracket those checks with a stable catalogue generation.
  const checking=await this.status();
  for(const id of unique){const car=await this.car(id);if(car.archived||car.revision!==captures[id].configuration.carRevision)throw fail('QUERY_CHANGED','A selected car changed while preparing this race.');}
  if(this.merges)for(const id of unique){await this.merges.assertCurrent(id);const now=await this.currentSettings(id);if(now.bindingToken!==settings[id].bindingToken||now.mergeRevision!==settings[id].mergeRevision)throw fail('QUERY_CHANGED','Timing settings changed while preparing this race.');}
  const after=await this.status();if(after.recoveryId!==before.recoveryId||after.revision!==checking.revision)throw fail('QUERY_CHANGED','The library changed while preparing this race. Check the cars and start again.');
  return {captures,warnings:[],heats:[],...(this.merges?{timingSettings:settings}:{}),sharedLibrary:{version:1,databaseId:before.databaseId,recoveryId:before.recoveryId,sourceId:this.installationId}};
 }
 async history(options={kind:'list'}){
  const s=await this.status();
  if(options.kind==='hint')return {databaseId:s.databaseId,cursor:s.changeCursor,connected:true,history:{cursor:s.changeCursor},error:''};
  const o={...options,protocol:'shared',recoveryId:s.recoveryId};
  require('./paddock-history-read-v1').route(o); // Reuse the qualified input rules.
  const raw=await this.handle.historyRead({...o,kind:{list:'sessions',head:'detail'}[o.kind]||o.kind,...(o.carId?{carId:this.canonicalId(o.carId)}:{})});
  const value=require('./paddock-history-read-v1').validate(raw,{...o,...(o.carId?{carId:this.canonicalId(o.carId)}:{})},s.databaseId);
  return {available:true,databaseId:s.databaseId,offline:false,warning:'',checkedAt:new Date().toISOString(),value,...(o.kind==='list'&&this.localMatches?{localMatches:await this.localMatches(value.results)}:{})};
 }
 async operations(){return (await this.storage.sharedRead({kind:'list'})).filter(r=>r.transport==='engine');}
 async originalHistory(options={}){const before=await this.status(),value=await this.handle.originalHistory(options);if(value.databaseId!==before.databaseId||value.recoveryId!==before.recoveryId)throw fail('RECOVERY_CHANGED','The library changed. Refresh history.');return value;}
 async recoverSaves(){return this.exclusive(async()=>{if(this.paused||this.isRacing?.())return;for(const row of (await this.operations()).filter(r=>r.state==='pending').slice(0,32)){if(this.closed||this.paused||this.isRacing?.())break;await this.send(row.id);}});}
 startDelivery(store,isRacing){this.isRacing=isRacing;this.delivery=new(require('./shared-library-delivery'))(this,store,{isRacing:()=>this.paused||isRacing()});this.scheduleHistory();}
 async pause(){this.paused=true;clearTimeout(this.historyTimer);await this.delivery?.running?.catch(()=>{});await this.tail;}
 scheduleHistory(delay=0){clearTimeout(this.historyTimer);if(this.closed||this.paused||!this.delivery)return;this.historyTimer=setTimeout(()=>{void this.recoverSaves().then(()=>this.delivery.flush()).then(()=>{this.deliveryError='';},e=>{this.deliveryError=String(e.message);}).finally(()=>this.scheduleHistory(30000));},delay);this.historyTimer.unref?.();}
 save(input){return this.exclusive(async()=>{
  if(this.paused)throw Error('The shared library is preparing to restart.');
  const s=await this.status();
  if(input.databaseId!==s.databaseId||input.recoveryId!==s.recoveryId)throw fail('RECOVERY_CHANGED','The library changed or was restored. Reopen the draft before saving.');
  const outstanding=(await this.operations()).find(r=>r.request.databaseId===s.databaseId&&(r.state==='pending'||r.state==='blocked'&&['RECOVERY_CHANGED','RECEIPT_MISMATCH','OPERATION_CONFLICT','COMMAND_CONFLICT','CAR_MERGED','MERGE_SETTINGS_REQUIRED','SETTINGS_CONFLICT'].includes(r.code))&&(input.action==='create'?r.request.action==='create':r.request.carId===input.carId));
  if(outstanding)throw Error('Resolve the earlier save for this car before changing it again.');
  const request={version:1,databaseId:s.databaseId,recoveryId:s.recoveryId,sourceId:this.installationId,operationId:randomUUID(),action:input.action};
  for(const k of ['carId','expectedRevision','set','clear','timingExtras','timingSettings','customValues'])if(Object.hasOwn(input,k))request[k]=structuredClone(input[k]);
  if(request.timingSettings&&!this.merges)throw Error('Effective settings compatibility is not activated for this client.');
  if(request.timingExtras&&request.timingExtras.sourceId!==this.installationId)throw Error('Timing settings must use this installation’s original identity.');
  // Commit the exact bytes and recovery generation BEFORE invoking the engine.
  await this.storage.sharedChange({action:'create',transport:'engine',request});
  return this.send(request.operationId);
 });}
 retry(id){return this.exclusive(()=>this.send(id));}
 stateSave(method,input){return this.exclusive(async()=>{
  if(this.paused)throw Error('The shared library is preparing to restart.');if(!['serviceWrite','customDefinitionWrite','timingSettingsWrite'].includes(method))throw Error('Unknown shared state operation.');
  if(method==='timingSettingsWrite'&&!this.merges)throw Error('Effective settings compatibility is not activated for this client.');
  if(method==='timingSettingsWrite'&&input.sourceId!==undefined&&input.sourceId!==this.installationId)throw fail('SOURCE_MISMATCH','Settings belong to this installation only.');
  const s=await this.status();if(input.databaseId!==s.databaseId||input.recoveryId!==s.recoveryId)throw fail('RECOVERY_CHANGED','Reopen this editor after the library changed.');
  if((await this.operations()).some(r=>r.request.databaseId===s.databaseId&&['pending','blocked'].includes(r.state)&&(input.carId?r.request.carId===input.carId:r.request.action==='definition')))throw Error('Resolve the earlier retained save before changing this record again.');
  const request={...structuredClone(input),sourceId:this.installationId,operationId:input.operationId||randomUUID(),engineMethod:method,action:method==='customDefinitionWrite'?'definition':input.action};
  await this.storage.sharedChange({action:'create',transport:'engine',request});return this.send(request.operationId);
 });}
 async send(id){
  const row=await this.storage.sharedRead({kind:'get',id});if(!row||row.transport!=='engine')throw Error('Not a direct shared-library operation.');if(row.state!=='pending')return row;
  const r=row.request;if(r.sourceId!==this.installationId)throw Error('This operation belongs to another Timing installation.');let result;
  try{
   const s=await this.status();if(r.databaseId!==s.databaseId)throw fail('DATABASE_MISMATCH','Reconnect the original shared database.');if(r.recoveryId!==s.recoveryId)throw fail('RECOVERY_CHANGED','The shared database was restored. Do not automatically repeat this save.');
   try{result=await this.handle.receipt({operationId:r.operationId,databaseId:r.databaseId,recoveryId:r.recoveryId});}
   catch(e){if(e.code!=='OPERATION_NOT_FOUND')throw e;if(!this.merges&&(r.timingSettings||r.engineMethod==='timingSettingsWrite'))throw fail('MERGE_COMPATIBILITY_REQUIRED','This client has not activated effective settings writes. The saved request is retained.');const {engineMethod,...input}=r;if(engineMethod==='customDefinitionWrite')delete input.action;result=await this.handle[engineMethod||'carWrite'](input);}
   if(r.engineMethod==='timingSettingsWrite'){
    require('./shared-library-merges').settings(result,r);
    if(result.revision!==(r.action==='bind'?r.expectedRevision||1:r.expectedRevision+1)||r.action==='patch'&&Object.entries(r.set||{}).some(([k,v])=>result.fields[k]!==v))throw fail('RECEIPT_MISMATCH','Timing settings receipt does not match the saved change.');
   }else if(r.engineMethod){
    if(r.engineMethod==='serviceWrite'?(result?.carId!==r.carId||result.service?.revision!==r.expectedRevision+1||result.carRevision!==r.expectedCarRevision+1):(result?.field?.revision!==r.expectedRevision+1||r.fieldId&&result.field.id!==r.fieldId))throw fail('RECEIPT_MISMATCH','The shared state receipt does not match the retained operation.');
   }else{
   const expected={...r};delete expected.timingExtras;delete expected.timingSettings;delete expected.customValues;
   if(!result||['databaseId','recoveryId','sourceId','operationId','action'].some(k=>result[k]!==r[k])||result.requestHash!==require('./paddock-value-hash')(expected)||!result.car?.id||typeof result.car.fields?.name!=='string'||r.carId&&result.car.id!==r.carId)throw fail('RECEIPT_MISMATCH','The receipt does not match the retained save.');
   if(r.timingExtras&&(!result.timingExtras||['sourceId','originalId'].some(k=>result.timingExtras[k]!==r.timingExtras[k])||result.timingExtras.revision!==r.timingExtras.expectedRevision+1||!/^[a-f0-9]{64}$/.test(result.timingExtras.hash)))throw fail('RECEIPT_MISMATCH','The Timing settings receipt does not match the retained save.');
   if(r.timingSettings){require('./shared-library-merges').settings(result.timingSettings,r);if(result.timingSettings.revision!==r.timingSettings.expectedRevision+1||Object.entries(r.timingSettings.set||{}).some(([k,v])=>result.timingSettings.fields[k]!==v))throw fail('RECEIPT_MISMATCH','Effective settings receipt does not match the saved change.');}
   }
  }catch(e){return this.storage.sharedChange({action:'result',operationId:id,blocked:rejectCodes.has(e.code),code:e.code||'WRITE_UNCERTAIN',error:e.message,...(e.details?{details:e.details}:{})});}
  const saved=await this.storage.sharedChange({action:'result',operationId:id,receipt:result});
  if(r.timingExtras){this.aliases.set(r.timingExtras.originalId,result.car.id);if(!this.reverse.has(result.car.id))this.reverse.set(result.car.id,r.timingExtras.originalId);}return saved;
 }
 async close(){if(this.closed)return;this.closed=true;clearTimeout(this.historyTimer);await this.delivery?.close().catch(()=>{});await this.tail;await this.handle.close();}
}
module.exports={SharedLibraryClient};
