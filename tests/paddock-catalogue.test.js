const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),{Paddock}=require('../paddock');
function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-catalogue-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const db=new Database(path.join(dir,'db.json')),client=new Paddock(db);t.after(()=>client.stop());
  client.state().connection={databaseId:'host',name:'Club',timing:true};client.code='password';
  let revision=1,cars=[{id:'a',name:'First',raceClass:'GT3'}],calls=[];
  client.call=async route=>{calls.push(route);return route==='/v1/status'?{id:'host',revision}:{id:'host',revision,cars,nextOffset:null};};
  return {db,client,calls,setRevision:v=>revision=v,setCars:v=>cars=v};
}
test('shared 30 second gate checks revisions and downloads only changed catalogues',async t=>{
  const {client,calls,setRevision}=setup(t);
  assert.equal((await client.catalogue()).cars.length,1);assert.equal(calls.length,2);
  await client.catalogue();assert.equal(calls.length,2);
  client.nextCatalogueCheck=0;await client.catalogue();assert.equal(calls.length,3);assert.equal(calls.at(-1),'/v1/status');
  setRevision(2);client.nextCatalogueCheck=0;await client.catalogue();assert.equal(calls.length,5);
  await client.catalogue(true);assert.equal(calls.length,7);
});
test('empty outbox and racing cause no background network calls',async t=>{
  const {client,calls}=setup(t);await client.flush();assert.equal(calls.length,0);
  client.isRacing=()=>true;await client.catalogue(true);assert.equal(calls.length,0);
});
test('fresh installations and forgotten hosts show an empty browser without leaking old cars',async t=>{
  const {db,client}=setup(t);db.add('slotcars',{model:'Local'});client.state().connection=null;client.code='';
  assert.deepEqual((await client.catalogue()).cars,[]);
  client.state().catalogue={databaseId:'previous',cars:[{id:'old',name:'Old collection'}]};
  assert.deepEqual(client.catalogueView().cars,[]);
});
test('existing linked cars remain browsable offline after upgrading without a catalogue cache',async t=>{
  const {db,client}=setup(t);const car=db.add('slotcars',{model:'Existing',paddock:{databaseId:'host',carId:'a',name:'Existing shared car',configuration:{capturedAt:'2026-11-01T10:00:00.000Z'}}});
  client.code='';const view=await client.catalogue();assert.equal(view.cars[0].linked,car.id);assert.equal(view.cars[0].name,'Existing shared car');assert.ok(view.cars[0].capturedAt);
});
test('network failures retain complete cache, back off and survive restart without credentials',async t=>{
  const {db,client}=setup(t);await client.catalogue();const cache=structuredClone(client.state().catalogue);
  let calls=0;client.call=async()=>{calls++;throw Error('Offline');};client.nextCatalogueCheck=0;
  const failed=await client.catalogue();assert.equal(failed.cars[0].name,'First');assert.match(failed.error,/Offline/);assert.ok(failed.nextCheckAt>=Date.now()+59000);
  await client.catalogue();assert.equal(calls,1);assert.deepEqual(client.state().catalogue,cache);
  const restarted=new Paddock(new Database(db.file));t.after(()=>restarted.stop());const view=await restarted.catalogue();assert.equal(view.cars.length,1);assert.equal(view.connected,false);assert.equal(restarted.code,'');
});
test('rename and archive update identity without modifying pinned configuration or local cars',async t=>{
  const {db,client,setCars}=setup(t),snapshot={carId:'a',capturedAt:'old',technical:{gear:'27'}};
  const linked=db.add('slotcars',{model:'First',paddock:{databaseId:'host',carId:'a',name:'First',configuration:snapshot}}),local=db.add('slotcars',{model:'Local'});
  setCars([{id:'a',name:'Renamed',raceClass:'Prototype',technical:{gear:'30'}}]);await client.catalogue(true);
  assert.equal(linked.paddock.name,'Renamed');assert.deepEqual(linked.paddock.configuration,snapshot);assert.equal(client.catalogueView().cars[0].linked,linked.id);
  assert.equal(db.data.raceclasses.find(c=>c.id===linked.raceClass).name,'Prototype');assert.equal(linked.gearing,'30');
  setCars([]);await client.catalogue(true);assert.equal(linked.paddock.archived,true);assert.ok(db.data.slotcars.includes(linked));assert.equal(local.paddock,undefined);
});
test('a newly changed remote class cannot silently race using an old class or offline fallback',async t=>{
  const {db,client}=setup(t);const cls=db.add('raceclasses',{name:'GT3'}),car=db.add('slotcars',{raceClass:cls.id,paddock:{databaseId:'host',carId:'a',name:'Car',configuration:{capturedAt:'old'}}});
  client.profile=async()=>({car:{id:'a',raceClass:'Prototype'},configuration:{capturedAt:'new'}});
  await assert.rejects(client.prepare([car.id]),e=>e.code==='CAR_CLASS_CHANGED');assert.equal(car.paddock.configuration.capturedAt,'old');
});
test('failed pagination and failed disk commits leave catalogue and links unchanged',async t=>{
  const {db,client}=setup(t);db.add('slotcars',{paddock:{databaseId:'host',carId:'a',name:'First'}});await client.catalogue();
  const previous=structuredClone(client.state().catalogue),link=structuredClone(db.data.slotcars[0].paddock);
  client.call=async route=>{if(route==='/v1/status')return {id:'host',revision:2};if(route.includes('?'))throw Error('Page failed');return {id:'host',revision:2,cars:[{id:'b',name:'Other'}],nextOffset:1};};
  await client.catalogue(true);assert.deepEqual(client.state().catalogue,previous);assert.deepEqual(db.data.slotcars[0].paddock,link);
  client.call=async route=>route==='/v1/status'?{id:'host',revision:2}:{id:'host',revision:2,cars:[],nextOffset:null};client.commit=async()=>{throw Error('disk full');};
  await client.catalogue(true);assert.deepEqual(client.state().catalogue,previous);assert.deepEqual(db.data.slotcars[0].paddock,link);
});
test('one changed-transfer restart is bounded and never publishes half a catalogue',async t=>{
  const {client}=setup(t);let pages=0;
  client.call=async route=>{if(route==='/v1/status')return {id:'host',revision:1};pages++;if(pages===2)throw Object.assign(Error('Changed'),{httpStatus:409});return {id:'host',revision:pages<3?1:2,cars:[{id:pages<3?'a':'b',name:'Complete'}],nextOffset:pages<3?1:null};};
  assert.deepEqual((await client.catalogue()).cars.map(c=>c.id),['b']);assert.equal(pages,3);
});
test('identity mismatch cannot replace cache or route results to a new host',async t=>{
  const {client}=setup(t);await client.catalogue();client.call=async()=>({id:'different',revision:99});
  const view=await client.catalogue(true);assert.equal(view.cars[0].id,'a');assert.equal(client.code,'');assert.equal(client.state().connection.databaseId,'host');
});
test('concurrent browser requests share the in-flight check',async t=>{
  const {client}=setup(t);let resolve,calls=0;client.call=async route=>{calls++;if(route==='/v1/status')await new Promise(r=>resolve=r);return route==='/v1/status'?{id:'host',revision:1}:{id:'host',revision:1,cars:[],nextOffset:null};};
  const first=client.catalogue();await client.catalogue();assert.equal(calls,1);resolve();await first;assert.equal(calls,2);
});
test('optional public catalogue revision avoids reloads for result-only database updates',async t=>{
  const {client}=setup(t);let revision=1,catalogueRevision=3,pages=0;
  client.call=async route=>{if(route==='/v1/status')return {id:'host',revision,catalogueRevision};pages++;return {id:'host',revision,catalogueRevision,cars:[],nextOffset:null};};
  await client.catalogue();assert.equal(pages,1);revision++;client.nextCatalogueCheck=0;await client.catalogue();assert.equal(pages,1);
  catalogueRevision++;client.nextCatalogueCheck=0;await client.catalogue();assert.equal(pages,2);
  catalogueRevision=undefined;revision++;client.nextCatalogueCheck=0;await client.catalogue();assert.equal(pages,3,'fallback works after downgrade');
});
