'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const D=require('../db'),Runtime=require('../sqlite-runtime'),{migrateCopy}=require('../sqlite-migration'),{forkCopy}=require('../sqlite-working');
async function fixture(t,seed=()=>{}){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-app-')),source=path.join(dir,'source.json'),db=new D(source);db.data.drivers=[{id:'old',name:'Original'}];db.saveNow();
 seed(db);db.saveNow();const original=fs.readFileSync(source),profile=path.join(dir,'profile');fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'sqlite-test-profile.json'),JSON.stringify({format:Runtime.FORMAT,version:1}));
 migrateCopy({source,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(profile,'working'));
 const runtime=await Runtime.open(profile);t.after(async()=>{await runtime.lifecycle.shutdown();await db.writesIdle();assert.deepEqual(fs.readFileSync(source),original);fs.rmSync(dir,{recursive:true,force:true});});return {dir,profile,runtime};
}
test('application write adapter preserves editor return shapes, custom fields, media and reopening',async t=>{
 const {runtime:r,profile}=await fixture(t),repo=r.records,field=await repo.addCustomField('drivers',{label:'Club',type:'text',group:'personal'});
 const row=await repo.add('drivers',{name:'New',avatar:'data:image/png;base64,YWJj',custom:{[field.id]:'Club'},unknown:{x:[{},null]}});assert(row.id);assert.equal(row.custom[field.id],'Club');
 const snapshot=r.client.snapshot;r.client.snapshot=()=>{throw Error('Revision checks must not reconstruct the record.');};
 const patch={name:'Edited',unknown:{keep:1}},save=repo.update('drivers',row.id,patch);patch.unknown.keep=99;assert.equal((await save).unknown.keep,1);r.client.snapshot=snapshot;
 assert.equal((await repo.setCustomFieldGroup('drivers',field.id,'avatar')).group,'avatar');
 await r.lifecycle.updateSettings({theme:'light'});await r.lifecycle.shutdown();
 const reopened=await Runtime.open(profile);try{assert.equal(reopened.lifecycle.settings().theme,'light');assert.equal((await reopened.records.get('drivers',row.id)).avatar,'data:image/png;base64,YWJj');await reopened.records.removeCustomField('drivers',field.id);assert.equal((await reopened.records.get('drivers',row.id)).custom[field.id],undefined);await reopened.records.remove('drivers',row.id);assert.equal(await reopened.records.get('drivers',row.id),null);}finally{await reopened.lifecycle.shutdown();}
});
test('sessions, lap exclusions, championship awards and removal use domain commands',async t=>{
 const {runtime:r}=await fixture(t),car=await r.records.add('slotcars',{model:'Car'}),session=await r.records.saveSession({date:'2026-11-03',setupName:'Race',standings:[]},[{carId:car.id,driverId:'old',trackId:'t',time:1000,valid:true}]);
 assert.equal(typeof session,'string');const lap=(await r.records.list('laps'))[0];assert.equal((await r.records.update('laps',lap.id,{noTrackRecord:true})).noTrackRecord,true);
 await assert.rejects(r.records.update('laps',lap.id,{time:20}),/eligibility/);
 assert.deepEqual((await r.records.update('sessions',session,{champ:{id:'champ',awarded:true}})).champ,{id:'champ',awarded:true});
 await assert.rejects(r.records.update('sessions',session,{date:'bad'}),/championship/);assert.equal((await r.records.get('slotcars',car.id)).lapsDriven,1);
 await r.records.removeSession(session);assert.equal((await r.records.list('laps')).length,0);assert.equal((await r.records.get('slotcars',car.id)).lapsDriven,0);
});
test('runtime shutdown drains accepted editor writes and refuses new ones',async t=>{
 const {runtime:r,profile}=await fixture(t);const saves=Array.from({length:12},(_,i)=>r.records.add('tracks',{name:'Track '+i,lanes:2}));const stop=r.lifecycle.shutdown();await assert.rejects(r.records.add('tracks',{name:'Late'}),/shutting down/);await Promise.all([...saves,stop]);
 const other=await Runtime.open(profile);try{assert.equal((await other.records.list('tracks')).length,12);}finally{await other.lifecycle.shutdown();}
});
test('test profile selection refuses normal data, unmarked, packaged and invalid databases',async t=>{
 const {runtime:r,dir,profile}=await fixture(t);assert.equal(Runtime.validateProfile(profile,path.join(dir,'normal')),fs.realpathSync(profile));
 assert.throws(()=>Runtime.validateProfile(profile,profile),/existing application/);assert.throws(()=>Runtime.validateProfile(profile,path.join(dir,'normal'),true),/packaged/);
 fs.writeFileSync(path.join(profile,'slotforge-timing.json'),'{}');assert.throws(()=>Runtime.validateProfile(profile,path.join(dir,'normal')),/existing application/);fs.unlinkSync(path.join(profile,'slotforge-timing.json'));
 assert.throws(()=>Runtime.validateProfile(dir,path.join(dir,'normal')),/ENOENT/);
 await r.lifecycle.shutdown();fs.writeFileSync(path.join(profile,'working','working.sqlite'),'bad database');await assert.rejects(Runtime.open(profile));assert.equal(fs.readFileSync(path.join(profile,'working','working.sqlite'),'utf8'),'bad database');
});
test('runtime wires Paddock and export without JSON and protects its live files',async t=>{
 const {runtime:r,dir,profile}=await fixture(t),paddock=r.createPaddock();try{assert.equal((await paddock.status()).connected,false);}finally{paddock.stop();}
 await r.records.add('slotcars',{brand:'Brand',model:'Car',picture:'data:image/png;base64,YWJj'});const locals=await r.records.localCars();assert.equal(locals[0].model,'Car');assert(!JSON.stringify(locals).includes('base64'));
 assert.throws(()=>r.bulk.assertExportTarget(r.file),/protect/);assert.throws(()=>r.bulk.assertExportTarget(path.join(profile,'sqlite-test-profile.json')),/protect/);
 const alias=path.join(dir,'profile-alias');fs.symlinkSync(profile,alias,process.platform==='win32'?'junction':'dir');
 assert.throws(()=>r.bulk.assertExportTarget(path.join(alias,'working','working.sqlite')),/protect/);assert.throws(()=>r.bulk.assertExportTarget(path.join(alias,'new.json')),/protect/);fs.unlinkSync(alias);
 const exportFile=path.join(dir,'backup.json');await r.bulk.backup(exportFile,{});assert.equal(JSON.parse(fs.readFileSync(exportFile)).data.slotcars[0].model,'Car');assert.throws(()=>r.bulk.restore({}),/separate working copy/);
});

test('application resource finalization stays idempotent and recovery survives runtime reopen',async t=>{
 const {runtime:r,profile}=await fixture(t),Resources=require('../renderer/resources'),Engine=require('../renderer/engine');
 const supply=await r.records.add('resourcesystems',{name:'Supplies',...Resources.clean({owner:'car',tyres:{M:3}})});
 const state=await r.resources.begin(supply.id,{runId:'resource-race'}),engine=Engine.createRace({type:'race',laps:10,resources:state,entries:[{lane:0,driverId:'old',carId:'car',tyre:'M'}]});engine.start(0);
 const snap={v:1,race:{resources:structuredClone(engine.resources)},eng:engine.snapshot(1000),phase:'paused'};await r.lifecycle.saveResume(snap);await r.lifecycle.shutdown();
 const reopened=await Runtime.open(profile);try{
  assert.equal((await reopened.lifecycle.resume()).race.resources.runId,'resource-race');
  const ids=await Promise.all([reopened.records.saveSession({resourceRunId:'resource-race',standings:[]},[]),reopened.records.saveSession({resourceRunId:'resource-race',standings:[]},[])]);
  assert.equal(ids[0],ids[1]);assert.equal((await reopened.records.list('sessions')).length,1);assert.equal(await reopened.lifecycle.resume(),null);assert.equal((await reopened.resources.read()).history.length,1);
 }finally{await reopened.lifecycle.shutdown();}
});

test('orphan lap exclusions are durable and rejected writes do not poison the application queue',async t=>{
 const {runtime:r,profile}=await fixture(t,db=>{db.data.laps=[{id:'orphan',time:1500,valid:true}];});
 await assert.rejects(r.records.update('laps','orphan',{noPersonalBest:'yes'}),/eligibility/);
 assert.equal((await r.records.get('laps','orphan')).noPersonalBest,undefined);
 await r.records.update('laps','orphan',{noPersonalBest:true});await r.records.add('tracks',{name:'After failure',lanes:2});await r.lifecycle.shutdown();
 const reopened=await Runtime.open(profile);try{assert.equal((await reopened.records.get('laps','orphan')).noPersonalBest,true);assert.equal((await reopened.records.list('tracks'))[0].name,'After failure');}finally{await reopened.lifecycle.shutdown();}
});

test('application session save queues Paddock delivery and reopen retains acknowledgement',async t=>{
 const {runtime:r,profile}=await fixture(t),p=r.createPaddock(),remote=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json'))),sent=[];
 p.hostRequest=async(_base,route,_code,_id,body)=>{
  if(route==='/v1/status')return {id:remote.databaseId,name:'Fixture',permissions:{timingResults:true},capabilities:{timing:{versions:[1]}}};
  if(route.startsWith('/v1/timing/cars/'))return remote;
  if(body){sent.push(body);return {ok:true,databaseId:body.databaseId,sourceId:body.source.id,sessionId:body.sessionId,revision:body.revision,state:body.state,contentHash:require('../paddock').hash(body)};}
  return {};
 };
 try{
  await p.connect({address:'127.0.0.1:5000',code:'password'});const car=await r.records.add('slotcars',{model:'Local'});await p.link(remote.car.id,car.id);
  const journal={captures:{[car.id]:{name:'Car',configuration:remote.configuration}},lanes:[20],heats:[{id:'1',name:'Heat',startedAt:100000,endedAt:120000,entries:[{carId:car.id,driverId:'old',driverName:'Original',lane:1,laps:[{number:1,time:10000,at:110000,driverId:'old',valid:true}]}]}]};
  const id=await r.records.saveSession({setupName:'Delivery race',paddockJournal:journal,standings:[{carId:car.id,laps:1,pos:1,total:10000}]},[{carId:car.id,driverId:'old',time:10000,valid:true}]);assert.equal(typeof id,'string');
  await p.flush();assert.equal((await p.status()).deliveries[0].status,'sent');assert.equal(sent.length,1);
 }finally{p.stop();await p.idle();}
 await r.lifecycle.shutdown();const reopened=await Runtime.open(profile),again=reopened.createPaddock();try{assert.equal((await again.status()).deliveries[0].status,'sent');assert.equal((await reopened.records.list('slotcars'))[0].lapsDriven,1);}finally{again.stop();await again.idle();await reopened.lifecycle.shutdown();}
});
