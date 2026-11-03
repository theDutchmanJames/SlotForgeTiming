'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const Database = require('../db'), schema = require('../schema');
const { migrateCopy,openCopy } = require('../sqlite-migration');
const { WorkingStore,forkCopy } = require('../sqlite-working');
const Client = require('../sqlite-client'), Repository = require('../sqlite-repository'), Delivery = require('../sqlite-delivery');
const Paddock = require('../paddock');
const image = 'data:image/png;base64,YWJjZA==';
const profile = () => JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json')));
function data() {
  return {version:1,settings:{theme:'dark',unknown:{keep:true}},drivers:[{id:'d',name:'Driver',picture:image,custom:{club:'A'}}],tracks:[{id:'t',name:'Track'}],
    slotcars:[{id:'c',model:'Car',picture:image,lapsDriven:0,lapsSinceService:0,custom:{club:'A'}}],sessions:[],laps:[],raceclasses:[],
    customFields:{drivers:[{id:'club',type:'text',label:'Club'}],slotcars:[{id:'club',type:'text',label:'Club'}]},
    paddock:{sourceId:'stable',connection:{databaseId:profile().databaseId,address:'http://127.0.0.1:51234',name:'Host',timing:true,results:true},withdrawals:[]}};
}
function fixture(t,source = data()) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-sqlite-adapter-')), copy=path.join(dir,'copy'),work=path.join(dir,'work'),file=path.join(dir,'source.json');
  const stores=[],clients=[];
  t.after(async()=>{for(const c of clients)await c.close().catch(()=>{});for(const s of stores)s.close();fs.rmSync(dir,{recursive:true,force:true});});
  fs.writeFileSync(file,JSON.stringify(source));migrateCopy({source:file,destination:copy});forkCopy(copy,work);
  return {dir,copy,work,file,store(options){const s=new WorkingStore(work,options);stores.push(s);return s;},client(){const c=new Client();clients.push(c);return c;}};
}
function final(id='save') {
  const p=profile();
  return {id,type:'finalizeSession',session:{setupName:'Test',sessionType:'race',date:'2026-11-03',trackId:'t',trackName:'Track',standings:[{carId:'c',driverId:'d',pos:1,laps:1,total:10000}],
    paddockJournal:{captures:{c:{name:p.car.name,configuration:p.configuration}},lanes:[20],heats:[{id:'1',name:'Heat',startedAt:100000,endedAt:120000,entries:[{carId:'c',driverId:'d',driverName:'Driver',lane:1,laps:[{number:1,time:10000,at:110000,driverId:'d',valid:true,pit:false}]}]}]}},
    laps:[{carId:'c',driverId:'d',trackId:'t',lane:1,lapNumber:1,time:10000,valid:true}]};
}
function ack(p) {return {ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,contentHash:Paddock.hash(p),receivedAt:'2026-11-03T12:00:00.000Z'};}
function claim(s,id='claim') {const row=s.outbox(profile().databaseId,{status:'pending'}).at(-1);return s.command({id,type:'claimDelivery',deliveryKey:row.key,databaseId:row.databaseId});}
function all(s,table) {return s.statement('SELECT id FROM records WHERE entity=? ORDER BY ordinal').all(table).map(r=>s.get(table,r.id,true).value);}

test('all editable schema collections support add, patch, delete and durable retry', t=>{
  const s=fixture(t).store();
  for(const entity of Object.keys(schema).filter(k=>!['sessions','laps'].includes(k))) {
    const add={id:'add-'+entity,type:'addRecord',entity,item:{name:'New',unknown:{future:[1,null]},picture:image}};
    const result=s.command(add);assert.deepEqual(s.command(add),result);
    s.command({id:'update-'+entity,type:'updateRecord',entity,recordId:result.recordId,expectedRevision:1,patch:{name:'Changed'}});
    const row=s.get(entity,result.recordId,true).value;assert.equal(row.name,'Changed');assert.equal(row.picture,image);assert.deepEqual(row.unknown,{future:[1,null]});
    s.command({id:'remove-'+entity,type:'removeRecord',entity,recordId:result.recordId,expectedRevision:2});assert.equal(s.get(entity,result.recordId),null);
  }
});

test('small patches do not read or rewrite unrelated media; scalar versions cannot be bypassed', t=>{
  const s=fixture(t).store();
  s.db.exec("CREATE TEMP TRIGGER protect_assets BEFORE DELETE ON asset_refs BEGIN SELECT RAISE(ABORT,'asset rewritten'); END;");
  s.command({id:'name',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:0,patch:{name:'Updated'}});
  s.command({id:'custom',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:1,patch:{custom:{club:'B'}}});
  assert.throws(()=>s.command({id:'stale',type:'setCustomValue',entity:'drivers',recordId:'d',fieldId:'club',value:'C',expectedVersion:0}),/version conflict/);
  assert.equal(s.get('drivers','d',true).value.picture,image);
  assert.throws(()=>s.command({id:'stale-record',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:0,patch:{name:'Stale'}}),/version conflict/);
});

test('explicit media replacement and unknown nested properties survive reopen', t=>{
  const f=fixture(t),s=f.store();
  const second='data:image/png;base64,YWJjZGU=';
  s.command({id:'photo',type:'updateRecord',entity:'drivers',recordId:'d',expectedRevision:0,patch:{picture:second,gallery:[{src:image,extra:{flag:true}}]}});s.close();
  const row=f.store().get('drivers','d',true).value;assert.equal(row.picture,second);assert.equal(row.gallery[0].src,image);assert.equal(row.gallery[0].extra.flag,true);
});

test('linked cars protect catalogue fields and source identity while local maintenance remains editable', t=>{
  const source=data();source.slotcars[0].paddock={databaseId:'host',carId:'remote'};const s=fixture(t,source).store();
  s.command({id:'edit',type:'updateRecord',entity:'slotcars',recordId:'c',expectedRevision:0,patch:{model:'Forged',paddock:null,lapsSinceService:9}});
  const car=s.get('slotcars','c').value;assert.equal(car.model,'Car');assert.equal(car.paddock.carId,'remote');assert.equal(car.lapsSinceService,9);
});

test('custom definitions, groups and deletion preserve IDs, other fields and images', t=>{
  const s=fixture(t).store(),added=s.command({id:'add-field',type:'addCustomDefinition',entity:'drivers',expectedRevision:0,field:{label:'Team',type:'list',options:['Red','Blue'],group:'unknown'}});
  assert.equal(added.field.group,'');s.command({id:'value',type:'setCustomValue',entity:'drivers',recordId:'d',fieldId:added.field.id,value:'Red',expectedVersion:0});
  s.command({id:'group',type:'setCustomGroup',entity:'drivers',fieldId:added.field.id,group:'avatar',expectedRevision:1});
  s.command({id:'remove-field',type:'removeCustomDefinition',entity:'drivers',fieldId:added.field.id,expectedRevision:2});
  const driver=s.get('drivers','d',true).value;assert.deepEqual(driver.custom,{club:'A'});assert.equal(driver.picture,image);
  assert.equal(s.fieldVersion('drivers','d',['custom',added.field.id]),2);
  assert.throws(()=>s.command({id:'stale-definition',type:'setCustomGroup',entity:'drivers',fieldId:'club',group:'avatar',expectedRevision:0}),/revision conflict/);
});

test('service reset, settings and championship awards are versioned and transactional', t=>{
  const s=fixture(t).store({clock:()=>Date.parse('2026-11-03T12:00:00Z')});
  s.command({id:'reset',type:'resetService',carId:'c',expectedRevision:0});const car=s.get('slotcars','c').value;
  assert.equal(car.servicesDone,1);assert.equal(car.lapsSinceService,0);assert.equal(car.serviceDate,'2026-11-03T12:00:00.000Z');
  s.command({id:'settings',type:'setSettings',patch:{theme:'light'},expectedRevision:0});assert.deepEqual(s.get('@meta','settings').value,{theme:'light',unknown:{keep:true}});
  const a=s.command(final('a')).sessionId,b=s.command(final('b')).sessionId;
  assert.throws(()=>s.command({id:'awards-fail',type:'setChampionshipAwards',edits:[{sessionId:a,expectedRevision:1,champ:{awarded:true}},{sessionId:b,expectedRevision:0,champ:{awarded:true}}]}),/version conflict/);
  assert.equal(s.get('sessions',a).value.champ,undefined);
  s.command({id:'awards',type:'setChampionshipAwards',edits:[{sessionId:a,expectedRevision:1,champ:{awarded:true}},{sessionId:b,expectedRevision:1,champ:{awarded:true}}]});
  assert.equal(s.get('sessions',b).value.champ.awarded,true);
});

for(const type of ['drivers','slotcars','tracks','laps','raceclasses','resourcesystems','multiclasssystems','virtualrivalsystems','layouts','fuelrules']) {
  test('cascade parity with JSON for '+type,async t=>{
    const source=data();source.raceclasses=[{id:'class',name:'GT3'}];source.slotcars[0].raceClass='class';source.drivers[0].raceClass='class';source.drivers[0].virtualRivalSystem='vr';
    source.teams=[{id:'team',drivers:['d'],raceClass:'class'}];source.resourcesystems=[{id:'resource'}];source.multiclasssystems=[{id:'multi',classes:[{id:'class'}],driverClasses:[{driverId:'d',classId:'class'}]}];source.virtualrivalsystems=[{id:'vr'}];source.layouts=[{id:'layout'}];source.fuelrules=[{id:'fuel',paceTrack:'t',paceSource:'track'}];
    source.racesetups=[{id:'setup',track:'t',resourceSystem:'resource',multiClass:'multi',layout:'layout',layout2:'layout',fuelRules:'fuel'}];source.championships=[{id:'champ',rounds:[{track:'t',picture:image}],roster:[{driver:'d',team:'team'}]}];
    const f=fixture(t,source),legacy=new Database(path.join(f.dir,'legacy.json'));legacy.replaceAll(source);const sql=f.store();
    const command=final();const sid=sql.command(command).sessionId, oldId=await legacy.saveSessionAsync(command.session,command.laps);
    const lap=sql.sessionLaps(sid)[0].id;
    const ids={drivers:'d',slotcars:'c',tracks:'t',laps:lap,raceclasses:'class',resourcesystems:'resource',multiclasssystems:'multi',virtualrivalsystems:'vr',layouts:'layout',fuelrules:'fuel'};
    sql.command({id:'remove',type:'removeRecord',entity:type,recordId:ids[type],expectedRevision:type==='laps'?1:type==='slotcars'?1:0});
    legacy.remove(type,type==='laps'?legacy.data.laps[0].id:ids[type]);await legacy.saved();
    for(const entity of ['racesetups','teams','championships','multiclasssystems']) {
      const actual=all(sql,entity),expected=legacy.data[entity];
      for(const row of actual) {const other=expected.find(r=>r.id===row.id);for(const key of Object.keys(row))assert.deepEqual(row[key],other?.[key],entity+'/'+key);}
      assert.equal(actual.length,expected.length,entity);
    }
    if(type!=='slotcars'){for(const key of ['lapsDriven','lapsSinceService'])assert.equal(sql.field('slotcars','c',[key]).value,legacy.data.slotcars[0][key]);}
    assert.equal(sql.page('laps').length,legacy.data.laps.length);assert.equal(sql.page('sessions').length,legacy.data.sessions.length);
    if(legacy.data.paddock.withdrawals.length){const actual=sql.get('@meta','paddock',true).value.withdrawals[0].payload, expected=legacy.data.paddock.withdrawals[0].payload;assert.deepEqual({...actual,sessionId:oldId},expected);}
    await legacy.writesIdle();
  });
}

test('cascade failure rolls back deleted records, counters, references, withdrawals and outbox', t=>{
  const s=fixture(t).store();s.command(final());s.checkpoint=stage=>{if(stage==='cascade-written')throw Error('injected failure');};
  assert.throws(()=>s.command({id:'delete',type:'removeRecord',entity:'drivers',recordId:'d',expectedRevision:0}),/injected/);
  assert.ok(s.get('drivers','d'));assert.equal(s.page('laps').length,1);assert.equal(s.field('slotcars','c',['lapsDriven']).value,1);
  assert.equal(s.get('@meta','paddock').value.withdrawals.length,0);assert.equal(s.outbox(profile().databaseId).length,1);assert.equal(s.receipt('delete'),null);
});

test('claims, exact acknowledgements and receipt checks persist after reopen', t=>{
  const f=fixture(t),s=f.store(),{sessionId}=s.command(final()),attempt=claim(s),payload=s.deliveryPayload(attempt.deliveryKey,attempt.attemptToken);
  assert.throws(()=>s.command({id:'wrong',type:'acknowledgeDelivery',...attempt,receipt:{...ack(payload),contentHash:'wrong'}}),/does not match/);
  const command={id:'ack',type:'acknowledgeDelivery',deliveryKey:attempt.deliveryKey,attemptToken:attempt.attemptToken,receipt:ack(payload)};
  assert.equal(s.command(command).applied,true);assert.deepEqual(s.command(command),{applied:true,superseded:false});s.close();
  const reopened=f.store();assert.equal(reopened.outbox(payload.databaseId)[0].status,'sent');assert.equal(reopened.get('sessions',sessionId).value.paddockDelivery.receipt.contentHash,Paddock.hash(payload));
  reopened.command({id:'check-missing',type:'recordDeliveryCheck',deliveryKey:attempt.deliveryKey,expectedHash:Paddock.hash(payload),error:'No receipt on host'});
  assert.equal(reopened.outbox(payload.databaseId)[0].status,'sent');assert.equal(reopened.outbox(payload.databaseId)[0].receiptCheckError,'No receipt on host');
  reopened.command({id:'check',type:'recordDeliveryCheck',deliveryKey:attempt.deliveryKey,expectedHash:Paddock.hash(payload),receipt:ack(payload)});
  assert.equal(reopened.outbox(payload.databaseId)[0].receiptCheckError,'');
});

for(const operation of ['correct','delete']) test('an old upload acknowledgement cannot overwrite a '+operation+' result',t=>{
  const s=fixture(t).store(),{sessionId}=s.command(final()),attempt=claim(s),payload=s.deliveryPayload(attempt.deliveryKey,attempt.attemptToken);
  if(operation==='correct') s.command({id:'change',type:'setRecordEligibility',sessionId,expectedRevision:1,edits:[{lapId:s.sessionLaps(sessionId)[0].id,flags:{noTrackRecord:true}}]});
  else s.command({id:'change',type:'deleteSession',sessionId,expectedRevision:1});
  const result=s.command({id:'late-ack',type:'acknowledgeDelivery',deliveryKey:attempt.deliveryKey,attemptToken:attempt.attemptToken,receipt:ack(payload)});
  assert.equal(result.applied,false);const current=s.outbox(payload.databaseId);assert.equal(current.length,1);assert.equal(current[0].status,'pending');assert.equal(current[0].revision,2);
  const next=claim(s,'claim-new'),nextPayload=s.deliveryPayload(next.deliveryKey,next.attemptToken);s.command({id:'ack-new',type:'acknowledgeDelivery',deliveryKey:next.deliveryKey,attemptToken:next.attemptToken,receipt:ack(nextPayload)});
  assert.equal(s.outbox(payload.databaseId)[0].status,'sent');
});

test('leases recover after restart, stale tokens cannot acknowledge a newer attempt, and failures back off',t=>{
  let now=100000;const f=fixture(t),s=f.store({clock:()=>now});s.command(final());const first=claim(s);
  assert.throws(()=>claim(s,'busy'),/leased/);s.close();now+=31000;
  const reopened=f.store({clock:()=>now}),second=claim(reopened,'second'),p=reopened.deliveryPayload(second.deliveryKey,second.attemptToken);
  assert.equal(reopened.command({id:'old',type:'acknowledgeDelivery',deliveryKey:first.deliveryKey,attemptToken:first.attemptToken,receipt:ack(p)}).stale,true);
  reopened.command({id:'failure',type:'failDelivery',deliveryKey:second.deliveryKey,attemptToken:second.attemptToken,code:'AUTH_RATE_LIMITED',message:'Wait',retryAfterMs:60000});
  assert.throws(()=>claim(reopened,'early'),/retry/);now+=60001;const third=claim(reopened,'third');
  reopened.command({id:'terminal',type:'failDelivery',deliveryKey:third.deliveryKey,attemptToken:third.attemptToken,code:'CONFIGURATION_MISMATCH',message:'Changed'});
  const row=reopened.outbox(p.databaseId)[0];assert.equal(row.status,'attention');
  reopened.command({id:'retry',type:'retryDelivery',deliveryKey:row.key,expectedHash:row.payloadHash});assert.equal(claim(reopened,'fourth').payloadHash,row.payloadHash);
});

test('failed acknowledgement persistence leaves the exact payload retryable',t=>{
  const s=fixture(t).store();s.command(final());const a=claim(s),p=s.deliveryPayload(a.deliveryKey,a.attemptToken);
  const c={id:'ack',type:'acknowledgeDelivery',deliveryKey:a.deliveryKey,attemptToken:a.attemptToken,receipt:ack(p)};
  s.checkpoint=stage=>{if(stage==='delivery-acknowledged')throw Error('disk full');};assert.throws(()=>s.command(c),/disk full/);
  assert.equal(s.outbox(p.databaseId)[0].status,'pending');assert.equal(s.receipt('ack'),null);s.checkpoint=()=>{};
  assert.equal(s.command(c).applied,true);
});

test('outbox pages are bounded and do not include lap payloads or receipts',t=>{
  const s=fixture(t).store();for(let i=0;i<3;i++)s.command(final('save-'+i));
  const rows=s.outbox(profile().databaseId,{limit:2});assert.equal(rows.length,2);assert.equal(rows[0].payload,undefined);assert.equal(rows[0].receipt,undefined);
  assert.equal(s.outbox(profile().databaseId,{after:rows[1].sequence}).length,1);assert.throws(()=>s.outbox(profile().databaseId,{limit:201}),/Invalid/);
});

test('worker adapters execute saves and authenticated-transport acknowledgements end to end',async t=>{
  const f=fixture(t),client=f.client();await client.openWorking(f.work);const repo=new Repository(client);
  const c=final();const result=await repo.saveSession(c.session,c.laps,{commandId:c.id});
  const sent=[];const deliver=new Delivery(client,{call:async(route,payload)=>{
    if(route==='/v1/status')return {id:profile().databaseId,permissions:{timingResults:true}};
    sent.push(payload);return ack(payload);
  }});
  assert.deepEqual(await deliver.flush(profile().databaseId),{sent:1,verified:true});assert.equal(sent.length,1);
  assert.deepEqual(await deliver.flush(profile().databaseId),{sent:0});assert.equal((await repo.get('sessions',result.sessionId)).record.value.paddockDelivery.status,'sent');
  const added=await repo.add('drivers',{name:'New'},{commandId:'new'});await repo.update('drivers',added.recordId,{name:'Changed'},{commandId:'edit',expectedRevision:1});
  assert.equal((await repo.get('drivers',added.recordId)).record.value.name,'Changed');
  await assert.rejects(repo.update('drivers',added.recordId,{name:'Stale'},{commandId:'stale',expectedRevision:1}),/version conflict/);
});

test('delivery transport respects race holds and rejects a different host before upload',async t=>{
  const f=fixture(t),client=f.client();await client.openWorking(f.work);await client.command(final());let racing=true,uploads=0;
  const d=new Delivery(client,{isRacing:()=>racing,call:async route=>{if(route==='/v1/status')return {id:'other',permissions:{timingResults:true}};uploads++;}});
  assert.equal((await d.flush(profile().databaseId)).deferred,true);racing=false;await assert.rejects(d.flush(profile().databaseId),/identity changed/);assert.equal(uploads,0);
});

test('Paddock profile linking, catalogue batches and captured configurations preserve local and historical data',t=>{
  const s=fixture(t).store(),p=profile();const result=s.command({id:'link',type:'linkPaddockCar',profile:p,localId:'c',expectedRevision:0});
  assert.equal(result.recordId,'c');assert.equal(s.field('slotcars','c',['custom','club']).value,'A');
  const historical=s.command(final()).sessionId,original=s.get('sessions',historical,true).value.paddockJournal;
  const updated=structuredClone(p);updated.configuration.capturedAt='2026-11-04T12:00:00Z';
  s.command({id:'capture',type:'cachePaddockConfigurations',updates:[{recordId:'c',expectedRevision:2,profile:updated}]});
  assert.deepEqual(s.get('sessions',historical,true).value.paddockJournal,original);
  s.command({id:'catalogue',type:'applyPaddockCatalogue',databaseId:p.databaseId,expectedRevision:0,cache:{databaseId:p.databaseId,revision:2,cars:[]},updates:[{recordId:'c',expectedRevision:3,archived:true}]});
  assert.equal(s.field('slotcars','c',['paddock','archived']).value,true);assert.equal(s.get('sessions',historical,true).value.paddockJournal.captures.c.configuration.signature,p.configuration.signature);
});

test('failed catalogue batches roll back linked profiles, created classes and catalogue state',t=>{
  const s=fixture(t).store(),p=profile();s.command({id:'link',type:'linkPaddockCar',profile:p,localId:'c',expectedRevision:0});
  const before=s.get('slotcars','c',true).value,classes=all(s,'raceclasses');const changed=structuredClone(p);changed.car.raceClass='NEW CLASS';changed.car.model='Changed';
  s.checkpoint=stage=>{if(stage==='catalogue-written')throw Error('disk failure');};
  assert.throws(()=>s.command({id:'catalogue',type:'applyPaddockCatalogue',databaseId:p.databaseId,expectedRevision:0,cache:{databaseId:p.databaseId,revision:2,cars:[]},updates:[{recordId:'c',expectedRevision:1,profile:changed}]}),/disk failure/);
  assert.deepEqual(s.get('slotcars','c',true).value,before);assert.deepEqual(all(s,'raceclasses'),classes);assert.equal(s.get('@meta','paddock').value.catalogue,undefined);
});

test('connection writes never persist passwords and retain source and pending deliveries',t=>{
  const s=fixture(t).store();s.command(final());
  s.command({id:'forget',type:'setPaddockConnection',connection:null,expectedRevision:0});
  const connection={address:'127.0.0.1:51235',databaseId:'other',name:'Other',timing:true,results:true,password:'DO NOT STORE'};
  s.command({id:'connect',type:'setPaddockConnection',connection,expectedRevision:1});
  const state=s.get('@meta','paddock').value;assert.equal(state.connection.password,undefined);assert.equal(state.sourceId,'stable');assert.equal(s.outbox(profile().databaseId).length,1);
  assert.throws(()=>claim(s),/original Paddock/);
});

test('working schema upgrades atomically from format 1 without touching recovery copies',t=>{
  const f=fixture(t),file=path.join(f.work,'working.sqlite');const db=new DatabaseSync(file);
  assert.equal(db.prepare("SELECT value FROM info WHERE key='workingFormat'").get().value,'1');db.close();
  const s=f.store();assert.equal(s.statement("SELECT value FROM info WHERE key='workingFormat'").get().value,'6');
  const copy=openCopy(f.copy);try{assert.equal(copy.statement("SELECT value FROM info WHERE key='workingFormat'").get(),undefined);}finally{copy.close();}
});

test('failed result conversion stays visible but cannot be claimed or retried without review',t=>{
  const s=fixture(t).store(),command=final();delete command.session.paddockJournal.heats[0].entries[0].laps[0].at;
  s.command(command);const rows=s.outbox(profile().databaseId);assert.equal(rows.length,1);assert.equal(rows[0].status,'attention');assert.equal(rows[0].state,'blocked');
  assert.throws(()=>s.command({id:'retry',type:'retryDelivery',deliveryKey:rows[0].key,expectedHash:rows[0].payloadHash}),/needs review/);
  assert.equal(s.outbox(profile().databaseId,{status:'pending'}).length,0);
});

test('simultaneous first opens serialize the working-schema upgrade',async t=>{
  const f=fixture(t),a=f.client(),b=f.client();await Promise.all([a.openWorking(f.work),b.openWorking(f.work)]);
  assert.deepEqual(await a.outbox(profile().databaseId),[]);assert.deepEqual(await b.outbox(profile().databaseId),[]);
});

test('custom-definition deletion tolerates legacy null custom containers',t=>{
  const source=data();source.drivers[0].custom=null;const s=fixture(t,source).store();
  s.command({id:'remove',type:'removeCustomDefinition',entity:'drivers',fieldId:'club',expectedRevision:0});
  assert.equal(s.get('drivers','d').value.custom,null);assert.equal(s.get('drivers','d',true).value.picture,image);
});

test('track deletion removes all laps of deleted sessions even in inconsistent old history',t=>{
  const source=data();source.sessions=[{id:'old',trackId:'t'}];source.slotcars[0].lapsDriven=2;source.slotcars[0].lapsSinceService=2;
  source.laps=[{id:'a',sessionId:'old',trackId:'t',carId:'c',time:10000},{id:'b',sessionId:'old',trackId:'other',carId:'c',time:10001}];
  const s=fixture(t,source).store();s.command({id:'remove',type:'removeRecord',entity:'tracks',recordId:'t',expectedRevision:0});
  assert.equal(s.page('laps').length,0);assert.equal(s.page('sessions').length,0);assert.equal(s.field('slotcars','c',['lapsDriven']).value,0);
});

test('recovery adapters retain resource balances and reject stale checkpoints',async t=>{
  const source=data();source.resourcesystems=[{id:'p',name:'Supply',owner:'car',scope:'event',tyres:{M:3}}];
  const f=fixture(t,source),c=f.client();await c.openWorking(f.work);const r=new Repository(c),R=require('../renderer/resources');
  const begin=await r.beginResources('p',{runId:'run'});R.spend(begin.state,{carId:'c'},0,{'tyre:M':1},'Start');
  const snapshot={v:1,race:{resources:begin.state},eng:{v:1}};
  await r.checkpoint(snapshot,{commandId:'checkpoint',expectedRevision:begin.revision});
  await assert.rejects(r.checkpoint(snapshot,{commandId:'stale',expectedRevision:begin.revision}),/version conflict/);
  await assert.rejects(r.beginResources('p',{runId:'other'}),/unfinished/);
  await r.clearResources('run',{commandId:'clear',expectedRevision:1});
  const saved=await r.resources();assert.equal(saved.ledger.checkpoint,null);assert.equal(saved.ledger.history.length,1);
});

test('loopback HTTP lost acknowledgement retries the identical result without duplicate host records',async t=>{
  const http=require('node:http'),{once}=require('node:events');let now=100000,posts=0;
  const f=fixture(t),s=f.store({clock:()=>now});s.command(final());const accepted=new Map();
  const server=http.createServer((req,res)=>{
    assert.equal(req.headers.authorization,'Bearer test-password');
    if(req.url==='/v1/status'){res.end(JSON.stringify({id:profile().databaseId,permissions:{timingResults:true}}));return;}
    if(req.method==='GET'){res.end(JSON.stringify([...accepted.values()][0]));return;}
    let raw='';req.on('data',b=>raw+=b);req.on('end',()=>{const p=JSON.parse(raw),key=p.sessionId+':'+p.revision,digest=Paddock.hash(p);posts++;
      if(accepted.has(key))assert.equal(accepted.get(key).contentHash,digest);else accepted.set(key,ack(p));
      if(posts===1){req.socket.destroy();return;}res.end(JSON.stringify(accepted.get(key)));
    });
  });server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base='http://127.0.0.1:'+server.address().port;
  const client={outbox:(...args)=>s.outbox(...args),command:c=>s.command(c),deliveryPayload:(...args)=>s.deliveryPayload(...args),deliverySnapshot:k=>s.deliverySnapshot(k)};
  const d=new Delivery(client,{call:(route,payload)=>Paddock.request(base,route,'test-password',profile().databaseId,payload)});
  await assert.rejects(d.flush(profile().databaseId));assert.equal(accepted.size,1);assert.equal(s.outbox(profile().databaseId)[0].status,'pending');
  now+=60001;assert.deepEqual(await d.flush(profile().databaseId),{sent:1,verified:true});assert.equal(posts,2);assert.equal(accepted.size,1);
  const key=s.outbox(profile().databaseId)[0].key;assert.equal((await d.checkReceipt(key)).applied,true);
});

test('a receipt check in flight cannot update a corrected session',async t=>{
  const f=fixture(t),c=f.client();await c.openWorking(f.work);const {sessionId}=await c.command(final());
  const row=(await c.outbox(profile().databaseId))[0],a=await c.command({id:'claim',type:'claimDelivery',deliveryKey:row.key,databaseId:row.databaseId}),p=await c.deliveryPayload(row.key,a.attemptToken);
  await c.command({id:'ack',type:'acknowledgeDelivery',deliveryKey:row.key,attemptToken:a.attemptToken,receipt:ack(p)});
  let release;const gate=new Promise(r=>release=r);let entered;const ready=new Promise(r=>entered=r);
  const d=new Delivery(c,{call:async()=>{entered();await gate;return ack(p);}});const checking=d.checkReceipt(row.key);await ready;
  await c.command({id:'correct',type:'setRecordEligibility',sessionId,expectedRevision:2,edits:[{lapId:(await c.sessionLaps(sessionId))[0].id,flags:{noTrackRecord:true}}]});release();
  assert.equal((await checking).stale,true);const current=(await c.outbox(profile().databaseId))[0];assert.equal(current.revision,2);assert.equal(current.status,'pending');
});

test('malformed working format 2 fails closed before accepting writes',t=>{
  const f=fixture(t),s=f.store();s.close();const db=new DatabaseSync(path.join(f.work,'working.sqlite'));db.exec('DROP TABLE delivery_outbox');db.close();
  assert.throws(()=>f.store(),/no such table/);
});

test('bulk history deletion writes counters once per car rather than once per lap',t=>{
  const s=fixture(t).store(),command=final();command.laps=Array.from({length:500},(_,i)=>({carId:'c',driverId:'d',trackId:'t',time:10000,lapNumber:i+1}));s.command(command);
  s.db.exec(`CREATE TEMP TABLE counter_writes(n INTEGER); INSERT INTO counter_writes VALUES(0);
    CREATE TEMP TRIGGER count_counters AFTER UPDATE ON fields WHEN NEW.entity='slotcars' AND NEW.path IN ('["lapsDriven"]','["lapsSinceService"]') BEGIN UPDATE counter_writes SET n=n+1; END;`);
  s.command({id:'delete-driver',type:'removeRecord',entity:'drivers',recordId:'d',expectedRevision:0});
  assert.equal(s.field('slotcars','c',['lapsDriven']).value,0);assert.equal(s.statement('SELECT n FROM counter_writes').get().n,2);
});

test('invalid checked receipts retain the delivered result and persist the check error',async t=>{
  const f=fixture(t),c=f.client();await c.openWorking(f.work);const {sessionId}=await c.command(final());
  const row=(await c.outbox(profile().databaseId))[0],attempt=await c.command({id:'claim',type:'claimDelivery',deliveryKey:row.key,databaseId:row.databaseId});
  const payload=await c.deliveryPayload(row.key,attempt.attemptToken),receipt=ack(payload);
  await c.command({id:'ack',type:'acknowledgeDelivery',deliveryKey:row.key,attemptToken:attempt.attemptToken,receipt});
  const d=new Delivery(c,{call:async()=>({...receipt,revision:receipt.revision+1})});
  await assert.rejects(d.checkReceipt(row.key),{code:'RECEIPT_MISMATCH'});
  await c.close();const reopened=f.client();await reopened.openWorking(f.work);
  const saved=(await reopened.outbox(row.databaseId))[0];assert.equal(saved.status,'sent');assert.match(saved.receiptCheckError,/does not match/);
  assert.deepEqual((await reopened.get('sessions',sessionId)).value.paddockDelivery.receipt,receipt);
});

test('track deletion withdraws affected deliveries even when old lap and session track labels disagree',t=>{
  const s=fixture(t).store(),command=final();command.session.trackId='different';const {sessionId}=s.command(command);
  s.command({id:'remove-track',type:'removeRecord',entity:'tracks',recordId:'t',expectedRevision:0});
  assert.equal(s.page('laps').length,0);assert.ok(s.get('sessions',sessionId));
  const rows=s.outbox(profile().databaseId);assert.equal(rows.length,1);assert.equal(rows[0].state,'withdrawn');assert.equal(rows[0].status,'pending');
});

