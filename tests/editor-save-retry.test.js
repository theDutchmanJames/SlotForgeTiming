'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),crypto=require('node:crypto');
const Database=require('../db'),Runtime=require('../sqlite-runtime'),{migrateCopy}=require('../sqlite-migration'),{forkCopy}=require('../sqlite-working');
function storage(){const map=new Map();return {map,get length(){return map.size;},key:n=>[...map.keys()][n],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};}
function bridge(invoke,localStorage=storage()){
  let api;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../preload.js'),'utf8'),{require:name=>{assert.equal(name,'electron');return {contextBridge:{exposeInMainWorld:(_name,value)=>api=value},ipcRenderer:{on(){},invoke},webFrame:{}};},localStorage,crypto:crypto.webcrypto,TextEncoder});
  return api;
}
async function fixture(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-save-retry-')),source=path.join(dir,'source.json'),db=new Database(source);db.data.drivers=[{id:'original',name:'Original'}];db.saveNow();await db.writesIdle();const original=fs.readFileSync(source),profile=path.join(dir,'profile');fs.mkdirSync(profile);
  migrateCopy({source,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(profile,'working'));
  let runtime=await Runtime.open(profile);
  t.after(async()=>{await runtime.lifecycle.shutdown();assert.deepEqual(fs.readFileSync(source),original);fs.rmSync(dir,{recursive:true,force:true});});
  return {profile,get runtime(){return runtime;},async reopen(){await runtime.lifecycle.shutdown();runtime=await Runtime.open(profile);},invoke:(channel,request)=>channel==='db:editor-scope'?runtime.records.editorScope():runtime.records.editorSave(request)};
}
test('lost create acknowledgement survives renderer and worker reopen without duplicate records or media',async t=>{
  const f=await fixture(t),local=storage();let lose=true;const seen=[];
  const invoke=async(channel,request)=>{if(request)seen.push(request.id);const value=await f.invoke(channel,request);if(request&&lose){lose=false;throw Error('connection lost after commit');}return value;};
  const item={name:'Saved once',avatar:'data:image/png;base64,YWJj',custom:{club:'Secret club'}};
  await assert.rejects(bridge(invoke,local).add('drivers',item),/lost/);
  assert.equal(local.length,1);assert(!JSON.stringify([...local.map]).includes('Saved once'));assert(!JSON.stringify([...local.map]).includes('base64'));
  await f.reopen();const api=bridge(invoke,local),saved=await api.add('drivers',{custom:{club:'Secret club'},avatar:item.avatar,name:item.name});
  assert.equal(seen[0],seen[1]);assert.equal((await f.runtime.records.list('drivers')).length,2);assert.equal(saved.avatar,item.avatar);assert.equal(local.length,0);
  const another=await api.add('drivers',item);assert.notEqual(another.id,saved.id);assert.notEqual(seen[1],seen[2]);
});
test('replayed update cannot overwrite a later edit; custom definitions are created exactly once',async t=>{
  const f=await fixture(t),local=storage();let lose=true;
  const invoke=async(c,r)=>{const v=await f.invoke(c,r);if(r&&lose){lose=false;throw Error('lost');}return v;};
  await assert.rejects(bridge(invoke,local).update('drivers','original',{name:'First'}),/lost/);
  const revision=await f.runtime.client.revision('drivers','original');
  await f.runtime.records.update('drivers','original',{name:'Later'});
  await f.reopen();const api=bridge(invoke,local);assert.equal((await api.update('drivers','original',{name:'First'})).name,'Later');assert.equal(await f.runtime.client.revision('drivers','original'),revision+1);
  lose=true;const field={label:'Club',type:'text'};await assert.rejects(api.addCustomField('drivers',field),/lost/);
  const saved=await bridge(invoke,local).addCustomField('drivers',field);assert(saved.id);assert.equal((await f.runtime.records.customFields('drivers')).length,1);
  await api.setCustomFieldGroup('drivers',saved.id,'personal');assert.equal((await f.runtime.records.customFields('drivers'))[0].group,'personal');
  lose=true;await assert.rejects(api.removeCustomField('drivers',saved.id),/lost/);await bridge(invoke,local).removeCustomField('drivers',saved.id);assert.equal((await f.runtime.records.customFields('drivers')).length,0);
});
test('pre-commit transport failure retries the same intent; rejected validation releases it',async t=>{
  const f=await fixture(t),local=storage(),ids=[];let lose=true;
  const invoke=async(c,r)=>{if(r){ids.push(r.id);if(lose){lose=false;throw Error('before dispatch');}}return f.invoke(c,r);};
  await assert.rejects(bridge(invoke,local).add('tracks',{name:'Retry'}),/before dispatch/);
  await bridge(invoke,local).add('tracks',{name:'Retry'});assert.equal(ids[0],ids[1]);assert.equal((await f.runtime.records.list('tracks')).length,1);
  const api=bridge(invoke,local);await assert.rejects(api.update('laps','missing',{time:1}));assert.equal(local.length,0);
});
test('changed payload or database uses a different identity; identical concurrent submissions coalesce',async()=>{
  const local=storage(),ids=[];let scope='first';const invoke=async(c,r)=>{if(c==='db:editor-scope')return scope;ids.push(r.id);throw Error('lost');};
  const api=bridge(invoke,local);await Promise.allSettled([api.add('drivers',{name:'One'}),api.add('drivers',{name:'One'})]);assert.equal(ids.length,1);
  await assert.rejects(api.add('drivers',{name:'Two'}));scope='second';await assert.rejects(api.add('drivers',{name:'One'}));assert.equal(new Set(ids).size,3);
});
test('journal failures block dispatch; cleanup failure retains the original identity',async()=>{
  const local=storage();let sent=0;const invoke=async(c)=>c==='db:editor-scope'?'db':(sent++,{ok:true,value:1});
  local.setItem=()=>{throw Error('quota');};await assert.rejects(bridge(invoke,local).add('drivers',{}),/No save was sent/);assert.equal(sent,0);
  const second=storage();second.removeItem=()=>{throw Error('quota');};await assert.rejects(bridge(invoke,second).add('drivers',{}),/save succeeded/);assert.equal(second.length,1);
  const full=storage();for(let i=0;i<128;i++)full.setItem('slotforge-editor-save-v1:'+i,crypto.randomUUID());await assert.rejects(bridge(invoke,full).add('drivers',{}),/Too many/);assert.equal(sent,1);
});
test('JSON saves retain their old IPC contract without creating a retry journal',async()=>{
  const local=storage(),calls=[],api=bridge(async(c,...args)=>{calls.push([c,...args]);return c==='db:editor-scope'?null:{id:'json'};},local);
  assert.equal((await api.add('drivers',{name:'JSON'})).id,'json');assert.equal(calls[1][0],'db:add');assert.equal(local.length,0);
  await api.removeSession('session');assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))),['session:remove','session']);
});
test('receipt fingerprint rejects ID reuse with changed content; wrong database scope cannot write',async t=>{
  const f=await fixture(t),repo=f.runtime.records,scope=await repo.editorScope(),id=crypto.randomUUID();
  const first={id,scope,operation:'add',args:['drivers',{name:'Once'}]};assert.equal((await repo.editorSave(first)).ok,true);
  await assert.rejects(repo.editorSave({...first,args:['drivers',{name:'Changed'}]}),/different content/);
  assert.equal((await repo.editorSave({...first,id:crypto.randomUUID(),scope:'other'})).ok,false);assert.equal((await repo.list('drivers')).length,2);
});

test('generation rejection reaches the editor with review guidance and retains its pending identity',async t=>{
  const f=await fixture(t),local=storage(),ids=[];
  const invoke=async(channel,request)=>{
    if(channel==='db:editor-scope')return 'old-generation';
    ids.push(request.id);return f.invoke(channel,request);
  };
  for(let n=0;n<2;n++)await assert.rejects(bridge(invoke,local).add('drivers',{name:'Stale'}),error=>error.code==='EDITOR_GENERATION_CHANGED'&&/Review the current data/.test(error.message));
  assert.equal(local.length,1);assert.equal(ids[0],ids[1]);
  assert.equal((await f.runtime.records.list('drivers')).length,1);
  assert.equal(await f.runtime.client.receipt(ids[0]),null);
});
test('delete retry preserves cascades, counters and history once',async t=>{
  const f=await fixture(t),repo=f.runtime.records,car=await repo.add('slotcars',{model:'Car'}),session=await repo.saveSession({standings:[]},[{carId:car.id,driverId:'original',time:1000}]),local=storage();let lose=true;
  const invoke=async(c,r)=>{const result=await f.invoke(c,r);if(r&&lose){lose=false;throw Error('lost');}return result;};
  await assert.rejects(bridge(invoke,local).removeSession(session),/lost/);await f.reopen();await bridge(invoke,local).removeSession(session);
  assert.equal((await f.runtime.records.list('sessions')).length,0);assert.equal((await f.runtime.records.list('laps')).length,0);assert.equal((await f.runtime.records.get('slotcars',car.id)).lapsDriven,0);
});
test('post-commit read failure and worker unavailability retain the save identity',async t=>{
  const f=await fixture(t),local=storage(),repo=f.runtime.records,get=repo.get;let fail=true;
  repo.get=async(...args)=>{if(fail){fail=false;throw Error('read response lost');}return get.apply(repo,args);};
  await assert.rejects(bridge(f.invoke,local).add('drivers',{name:'Read retry'}),/read response lost/);assert.equal(local.length,1);
  await bridge(f.invoke,local).add('drivers',{name:'Read retry'});assert.equal((await repo.list('drivers')).filter(r=>r.name==='Read retry').length,1);
  const command=f.runtime.client.command,receipt=f.runtime.client.receipt;
  f.runtime.client.command=async()=>{throw Error('worker unavailable');};f.runtime.client.receipt=async()=>{throw Error('worker unavailable');};
  await assert.rejects(bridge(f.invoke,local).add('drivers',{name:'Unavailable'}),/worker unavailable/);assert.equal(local.length,1);
  f.runtime.client.command=command;f.runtime.client.receipt=receipt;await bridge(f.invoke,local).add('drivers',{name:'Unavailable'});assert.equal(local.length,0);
});
test('editor retries retain lap corrections, championship awards and Paddock ownership',async t=>{
  const f=await fixture(t),r=f.runtime,api=bridge(f.invoke),car=await r.records.add('slotcars',{model:'Local'});
  const remote=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json')));
  await r.records.commands.paddockConnection({databaseId:remote.databaseId,name:'Test',address:'127.0.0.1:51235',timing:true,results:true},{commandId:crypto.randomUUID(),expectedRevision:await r.client.revision('@meta','paddock')});
  await r.records.commands.linkPaddock(remote,{commandId:crypto.randomUUID(),localId:car.id,expectedRevision:await r.client.revision('slotcars',car.id)});
  const linked=await r.records.get('slotcars',car.id);await api.update('slotcars',car.id,{model:'Overwrite attempt',paddock:null,lapsSinceService:4});
  const edited=await r.records.get('slotcars',car.id);assert.equal(edited.model,linked.model);assert.deepEqual(edited.paddock,linked.paddock);assert.equal(edited.lapsSinceService,4);
  const session=await r.records.saveSession({standings:[]},[{carId:car.id,driverId:'original',time:1200}]);
  const lap=(await r.records.list('laps'))[0],scope=await r.records.editorScope();
  const command={scope,id:crypto.randomUUID(),operation:'update',args:['laps',lap.id,{noPersonalBest:true}]};
  await r.records.editorSave(command);const revision=await r.client.revision('laps',lap.id);await r.records.editorSave(command);assert.equal(await r.client.revision('laps',lap.id),revision);
  assert.equal((await r.records.get('laps',lap.id)).noPersonalBest,true);assert.equal((await r.records.carStatistics(car.id)).mileage.laps,1);
  await api.update('sessions',session,{champ:{id:'champ',awarded:true}});assert.equal((await r.records.get('sessions',session)).champ.awarded,true);
  await assert.rejects(api.update('sessions',session,{date:'changed'}),/championship/);await assert.rejects(api.update('laps',lap.id,{time:20}),/eligibility/);
});
test('save snapshots are immutable while scope lookup is pending',async()=>{
  const local=storage();let release,seen;const gate=new Promise(resolve=>release=resolve);
  const api=bridge(async(c,r)=>{if(c==='db:editor-scope'){await gate;return 'db';}seen=r;return {ok:true,value:{}};},local);
  const item={name:'Before',custom:{club:'Original'}},promise=api.add('drivers',item);item.name='After';item.custom.club='Changed';release();await promise;
  assert.equal(seen.args[1].name,'Before');assert.equal(seen.args[1].custom.club,'Original');
});
test('failed transaction rolls back the editor record and receipt together, then same ID can succeed',async t=>{
  const f=await fixture(t);await f.runtime.lifecycle.shutdown();let fail=true;
  const s=new(require('../sqlite-working').WorkingStore)(path.join(f.profile,'working'),{checkpoint:phase=>{if(fail&&phase==='before-commit')throw Error('simulated disk failure');}});
  try{
    const input={id:crypto.randomUUID(),scope:s.editorScope(),type:'editorSave',operation:'add',args:['drivers',{name:'Atomic'}]};
    assert.throws(()=>s.command(input),/disk failure/);assert.equal(s.receipt(input.id),null);assert.equal(s.statement("SELECT COUNT(*) n FROM records WHERE entity='drivers'").get().n,1);
    fail=false;const saved=s.command(input);assert.equal(s.command(input).recordId,saved.recordId);assert.equal(s.statement("SELECT COUNT(*) n FROM records WHERE entity='drivers'").get().n,2);
    assert.equal(s.statement('PRAGMA integrity_check').get().integrity_check,'ok');
  }finally{s.close();}
  await f.reopen();
});
