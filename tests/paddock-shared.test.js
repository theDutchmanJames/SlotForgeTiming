'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
const {Paddock}=require('../paddock'),Discovery=require('../paddock-local-discovery');
async function fixture(t,kind='json'){
 const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-shared-test-')),profile=path.join(root,'paddock');fs.mkdirSync(profile);
 const store=new Store(path.join(profile,'database.json'));store.persist(store.data);
 const host=new LocalLibrary({store,profile,folder:path.join(root,'discovery')});await host.start();assert.equal(host.error,'');
 const db=new(require('../db'))(path.join(root,'timing.json'));db.data.slotcars=[{id:'existing',model:'Original car',lapsDriven:999,custom:{keep:'yes'}}];db.saveNow();const original=fs.readFileSync(db.file);
 let worker,repo,p;
 if(kind==='sqlite'){
  require('../sqlite-migration').migrateCopy({source:db.file,destination:path.join(root,'copy')});require('../sqlite-working').forkCopy(path.join(root,'copy'),path.join(root,'work'));
  worker=new(require('../sqlite-client'))();await worker.openWorking(path.join(root,'work'));repo=new(require('../sqlite-repository'))(worker);p=new Paddock(null,{storage:new(require('../paddock-storage').SqlitePaddockStorage)(repo),deliveryStore:worker});
 }else p=new Paddock(db);
 p.localScan=()=>Discovery.scan({folder:host.folder});p.launcherScan=async()=>[];
 t.after(async()=>{p.stop();await p.idle();host.quiesce();await host.idle();host.close();await worker?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(root,{recursive:true,force:true});});
 const [found]=await p.discoverLocal();await p.connect({mode:'local',...found});clearTimeout(p.timer);clearTimeout(p.localTimer);
 return {p,db,store,host,root,worker,repo,reopen:async()=>{
  if(worker){await worker.close();worker=new(require('../sqlite-client'))();await worker.openWorking(path.join(root,'work'));repo=new(require('../sqlite-repository'))(worker);p.storage=new(require('../paddock-storage').SqlitePaddockStorage)(repo);p.deliveryStore=worker;}
  else p.storage=new(require('../paddock-storage').JsonPaddockStorage)(new(require('../db'))(db.file));
 }};
}
for(const kind of ['json','sqlite'])test(kind+': shared CRUD, conflict, lost acknowledgement and original Timing history',{skip:!fs.existsSync(path.join(source,'src/shared-car-library.cjs'))},async t=>{
 const f=await fixture(t,kind),{p,store}=f,{schema}=await p.sharedCar();
 const save=(action,extra={})=>p.sharedSave({databaseId:schema.databaseId,recoveryId:schema.recoveryId,action,...extra});
 let r=await save('create',{set:{name:'Shared car',maker:'NSR',weight:82.5,pinion:9,gear:27}});assert.equal(r.state,'committed',r.error);const id=r.receipt.car.id;
 const opened=await p.sharedCar(id);assert.equal(opened.car.fields.weight,82.5);
 r=await save('patch',{carId:id,expectedRevision:opened.car.revision,set:{name:'Renamed'}});assert.equal(r.state,'committed',r.error);
 const conflict=await save('patch',{carId:id,expectedRevision:opened.car.revision,set:{name:'Stale'}});assert.equal(conflict.state,'blocked');assert.equal(conflict.code,'REVISION_CONFLICT');assert(conflict.details.current);
 let current=(await p.sharedCar(id)).car;assert.equal(current.fields.name,'Renamed');assert.equal(current.fields.weight,82.5);
 const call=p.call.bind(p);let lost=false,posts=0;
 p.call=async(...args)=>{const result=await call(...args);if(args[0].endsWith('/car-operations')){posts++;if(!lost){lost=true;throw Error('Lost after commit');}}return result;};
 const pending=await save('patch',{carId:id,expectedRevision:current.revision,set:{livery:'Blue'}});assert.equal(pending.state,'pending');
 const recovered=await p.sharedRetry(pending.id);assert.equal(recovered.state,'committed');assert.equal(posts,1);
 current=(await p.sharedCar(id)).car;r=await save('archive',{carId:id,expectedRevision:current.revision});assert.equal(r.state,'committed',r.error);assert.equal((await p.sharedCar(id)).car.archived,true);
 current=(await p.sharedCar(id)).car;r=await save('restore',{carId:id,expectedRevision:current.revision});assert.equal(r.state,'committed',r.error);assert.equal((await p.sharedCar(id)).car.archived,false);
 assert.equal(store.data.cars.length,1);assert.equal(store.data.submissions.length,0);
 assert.equal(f.db.data.slotcars[0].lapsDriven,999);assert.deepEqual(f.db.data.slotcars[0].custom,{keep:'yes'});
});
test('editor only sends changed fields and preserves truncated/unparsed originals',()=>{
 const {changes}=require('../renderer/paddockshared');const fields={name:{type:'string',maxLength:200,clearable:false},weight:{type:'number',minimum:0,maximum:100000,clearable:true},gear:{type:'integer',minimum:1,maximum:1000,clearable:true}};
 assert.deepEqual(changes(fields,{name:'Partial',weight:null,gear:27},{name:'Partial',weight:'',gear:'27'}),{set:{},clear:[]});
 assert.deepEqual(changes(fields,{name:'Original',weight:80},{name:'New',weight:''}),{set:{name:'New'},clear:['weight']});
 assert.throws(()=>changes(fields,{}, {gear:'2.5'}));assert.throws(()=>changes(fields,{name:'Original'},{name:''}));
});
for(const kind of ['json','sqlite'])test(kind+': restoration blocks an uncertain create; journal failure never sends; immutable retries',{skip:!fs.existsSync(path.join(source,'src/shared-car-library.cjs'))},async t=>{
 const {p,store}=await fixture(t,kind),{schema}=await p.sharedCar(),before=store.snapshot(),input={databaseId:schema.databaseId,recoveryId:schema.recoveryId,action:'create',set:{name:'Only once'}};
 const change=p.storage.sharedChange.bind(p.storage),call=p.call.bind(p);let posts=0;
 p.storage.sharedChange=async()=>{throw Error('Disk full');};p.call=async(...args)=>{if(args[0].endsWith('/car-operations'))posts++;return call(...args);};
 await assert.rejects(p.sharedSave(input),/Disk full/);assert.equal(posts,0);p.storage.sharedChange=change;
 p.call=async(...args)=>{const r=await call(...args);if(args[0].endsWith('/car-operations')){posts++;throw Error('Lost response');}return r;};
 const pending=await p.sharedSave(input);assert.equal(pending.state,'pending');const original=structuredClone(pending.request);
 await store.restoreAsync(before,store.data.revision);
 const blocked=await p.sharedRetry(pending.id);assert.equal(blocked.state,'blocked');assert.equal(blocked.code,'RECOVERY_CHANGED');assert.deepEqual(blocked.request,original);assert.equal(posts,1);assert.equal(store.data.cars.length,0);
 const now=await p.sharedCar();await assert.rejects(p.sharedSave({...input,recoveryId:now.schema.recoveryId}),/earlier save/);
 await p.sharedResolve(pending.id);assert.equal((await p.sharedOperations()).find(r=>r.id===pending.id).state,'reconciled');assert.equal(store.data.cars.length,0);
});
test('installed components and unrelated Paddock fields are preserved',{skip:!fs.existsSync(path.join(source,'src/shared-car-library.cjs'))},async t=>{
 const {p,store}=await fixture(t),id=store.mutate('car.save',{data:{name:'Fitted car',notes:'Keep workshop notes'}}).result;
 const part=store.mutate('part.save',{data:{name:'Installed motor',category:'Motor',quantity:1,tracking:'individual',condition:'New'}}).result;
 store.mutate('part.install',{carId:id,partId:part,quantity:1,field:'motor',position:'Motor'});
 let {schema,car}=await p.sharedCar(id);const before=store.snapshot();
 const input={databaseId:schema.databaseId,recoveryId:schema.recoveryId,action:'patch',carId:id,expectedRevision:car.revision,set:{motor:'Different'}};
 const blocked=await p.sharedSave(input);assert.equal(blocked.code,'INSTALLED_PART_CONFLICT');assert.deepEqual(blocked.details.fields,['motor']);assert.deepEqual(store.snapshot(),before);
 const saved=await p.sharedSave({...input,set:{weight:83}});assert.equal(saved.state,'committed');car=(await p.sharedCar(id)).car;assert.equal(car.fields.motor,'Installed motor');const old=before.cars.find(c=>c.id===id),now=store.data.cars.find(c=>c.id===id);for(const k of Object.keys(old).filter(k=>!['technical','revision','updatedAt','updated'].includes(k)))assert.deepEqual(now[k],old[k],k);
});
test('receipt identity/hash failures cannot be accepted as committed',()=>{
 const {validateReceipt}=require('../paddock-shared'),dir=path.join(source,'integration-handoff/shared-car-library-v1/fixtures');
 if(!fs.existsSync(dir))return;
 const r=JSON.parse(fs.readFileSync(path.join(dir,'create-response.json')));const request={version:1,databaseId:r.databaseId,recoveryId:r.recoveryId,sourceId:r.sourceId,operationId:r.operationId,action:r.action,set:{name:'Fixture'}};
 assert.throws(()=>validateReceipt(r,request),/does not match/);
 const valid={...r,requestHash:require('../paddock').hash(request)};assert.equal(validateReceipt(valid,request),valid);
 assert.equal(validateReceipt({...valid,current:{present:false,archived:false,revision:null}},request).current.present,false);
});
for(const kind of ['json','sqlite'])test(kind+': acknowledgement disk failure survives reopen and backup without a duplicate post',{skip:!fs.existsSync(path.join(source,'src/shared-car-library.cjs'))},async t=>{
 const f=await fixture(t,kind),{p,store}=f,{schema}=await p.sharedCar();
 const change=p.storage.sharedChange.bind(p.storage),call=p.call.bind(p);let posts=0;
 p.call=async(...args)=>{if(args[0].endsWith('/car-operations'))posts++;return call(...args);};
 p.storage.sharedChange=async input=>{if(input.receipt)throw Error('Acknowledgement disk failure');return change(input);};
 await assert.rejects(p.sharedSave({databaseId:schema.databaseId,recoveryId:schema.recoveryId,action:'create',set:{name:'Committed remotely'}}),/Acknowledgement disk failure/);
 const [pending]=await p.sharedOperations();assert.equal(pending.state,'pending');assert.equal(store.data.cars.length,1);
 if(kind==='sqlite'){
  const file=path.join(f.root,'backup.json');await f.worker.exportLegacy(file);const data=JSON.parse(fs.readFileSync(file)).data;
  assert.equal(data.sharedCarOperations[0].request.operationId,pending.id);assert.equal(data.sharedCarOperations[0].state,'pending');assert(!Object.hasOwn(data,pending.id),'journal IDs must not create metadata roots');
 }
 await f.reopen();const saved=await p.sharedRetry(pending.id);assert.equal(saved.state,'committed');assert.equal(posts,1);assert.equal(store.data.cars.length,1);
});
test('an unavailable receipt endpoint or mismatched receipt never permits a duplicate create',{skip:!fs.existsSync(path.join(source,'src/shared-car-library.cjs'))},async t=>{
 const {p,store}=await fixture(t),{schema}=await p.sharedCar(),call=p.call.bind(p);let corrupt=true;
 p.call=async(...args)=>{const r=await call(...args);if(corrupt&&r.requestHash)return {...r,requestHash:'0'.repeat(64)};return r;};
 const input={databaseId:schema.databaseId,recoveryId:schema.recoveryId,action:'create',set:{name:'One physical car'}};
 const blocked=await p.sharedSave(input);assert.equal(blocked.code,'RECEIPT_MISMATCH');await assert.rejects(p.sharedSave(input),/earlier save/);assert.equal(store.data.cars.length,1);
 // Another request loses its response. Later lookup permission failure is not
 // proof that the original create was rejected.
 await p.sharedResolve(blocked.id);corrupt=false;
 p.call=async(...args)=>{const r=await call(...args);if(args[0].endsWith('/car-operations'))throw Error('Lost acknowledgement');return r;};
 const pending=await p.sharedSave({...input,set:{name:'Second deliberate physical car'}});assert.equal(pending.state,'pending');
 p.call=async(...args)=>{if(args[0].includes('/car-operations/'))throw Object.assign(Error('Temporarily disabled'),{code:'LOCAL_WRITES_DISABLED'});return call(...args);};
 const disabled=await p.sharedRetry(pending.id);assert.equal(disabled.state,'pending');await assert.rejects(p.sharedSave(input),/earlier save/);
 p.call=call;assert.equal((await p.sharedRetry(pending.id)).state,'committed');assert.equal(store.data.cars.length,2);
});
