const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),{Paddock,hash}=require('../paddock');
function setup(t){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-paddock-perf-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const db=new Database(path.join(dir,'db.json')),client=new Paddock(db);t.after(()=>client.stop());
  client.storage.state().connection={databaseId:'host',timing:true};client.code='password';
  return {db,client};
}
function watch(db,row){let calls=0;Object.defineProperty(row,'toJSON',{configurable:true,value(){calls++;return {...this};}});db.touch(row);db.fileChunks();calls=0;return ()=>calls;}
function queued(db){const payload={databaseId:'host',source:{id:'timing'},sessionId:'race',revision:1,state:'active',participants:[]};const d={status:'pending',payload};db.data.sessions.push({id:'race',paddockDelivery:d});db.commit();return d;}
const receipt=p=>({ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,contentHash:hash(p)});

test('Paddock metadata saves reuse unchanged photo and lap serialization',async t=>{
  const {db,client}=setup(t),car={id:'photo',picture:'A'.repeat(1024*1024)},lap={id:'lap',time:10000};
  db.data.slotcars.push(car);db.data.laps.push(lap);const carWrites=watch(db,car),lapWrites=watch(db,lap);
  client.storage.state().connection.name='Updated';await client.storage.commit();
  assert.equal(carWrites(),0);assert.equal(lapWrites(),0);
  assert.equal(JSON.parse(fs.readFileSync(db.file)).paddock.connection.name,'Updated');
});
test('result receipts invalidate their owning session and persist without touching other rows',async t=>{
  const {db,client}=setup(t),d=queued(db),unrelated={id:'old',standings:[]};db.data.sessions.push(unrelated);
  const writes=watch(db,unrelated);client.call=async(route,p)=>p?receipt(p):{id:'host',permissions:{timingResults:true}};
  await client.flush();assert.equal(d.status,'sent');assert.equal(writes(),0);
  const saved=JSON.parse(fs.readFileSync(db.file)).sessions.find(s=>s.id==='race');assert.equal(saved.paddockDelivery.status,'sent');assert.equal(saved.paddockDelivery.receipt.contentHash,hash(d.payload));
  await assert.rejects(client.checkReceipt('race'),/receipt does not match/); // a bad GET response must not lose the accepted receipt
  assert.equal(JSON.parse(fs.readFileSync(db.file)).sessions.find(s=>s.id==='race').paddockDelivery.status,'sent');
});
test('withdrawal acknowledgements persist in top-level state',async t=>{
  const {db,client}=setup(t),d=queued(db);db.data.sessions=[];d.payload={...d.payload,state:'withdrawn'};client.storage.state().withdrawals.push(d);
  client.call=async(route,p)=>p?receipt(p):{id:'host',permissions:{timingResults:true}};
  await client.flush();assert.equal(JSON.parse(fs.readFileSync(db.file)).paddock.withdrawals[0].status,'sent');
});
test('catalogue metadata omits photo payloads and picture keys reject stale images and hosts',async t=>{
  const {client}=setup(t),picture='data:image/png;base64,'+'A'.repeat(1024*1024);
  client.call=async route=>route==='/v1/status'?{id:'host',revision:1}:{id:'host',revision:1,cars:[{id:'a',name:'A',picture}],nextOffset:null};
  const first=await client.catalogue(false,false),key=first.cars[0].pictureKey;
  assert.ok(JSON.stringify(first).length<2000);assert.equal(first.cars[0].picture,'');assert.equal((await client.picture('a',key)),picture);
  assert.equal((await client.catalogue(false,false)).cars[0].pictureKey,key);
  client.catalog[0].picture='data:image/png;base64,BBBB';const second=(await client.catalogueView(false));
  assert.notEqual(second.cars[0].pictureKey,key);assert.equal((await client.picture('a',key)),'');
  client.storage.state().connection.databaseId='other';assert.equal((await client.picture('a',second.cars[0].pictureKey)),'');
});
test('cached offline pictures remain accessible but removed cars release image cache',async t=>{
  const {db,client}=setup(t);db.data.slotcars.push({id:'local',picture:'data:image/png;base64,AAAA',paddock:{databaseId:'host',carId:'a',configuration:{capturedAt:'today'}}});
  client.code='';const view=await client.catalogue(false,false);assert.equal((await client.picture('a',view.cars[0].pictureKey)),'data:image/png;base64,AAAA');
  client.storage.state().catalogue={databaseId:'host',cars:[]};(await client.catalogueView(false));assert.equal(client.images.size,0);
});
test('catalogue refresh only invalidates changed linked cars',async t=>{
  const {db,client}=setup(t),remote={id:'a',name:'First',maker:'Maker',model:'Model',picture:'data:image/png;base64,AAAA'};
  const row={id:'local',...require('../paddock').profilePatch({car:remote,databaseId:'host',configuration:{technical:{}}},db.data.raceclasses)};db.data.slotcars.push(row);
  const writes=watch(db,row);client.call=async()=>({id:'host',revision:1,cars:[remote],nextOffset:null});
  await client.browse();assert.equal(writes(),0);
  remote.name='Renamed';await client.browse();assert.equal(writes(),1);assert.equal(JSON.parse(fs.readFileSync(db.file)).slotcars[0].paddock.name,'Renamed');
});
test('failed linked-car save restores cached serialization before the next successful save',async t=>{
  const {db,client}=setup(t),row={id:'local',model:'Original',paddock:{databaseId:'host',carId:'a',name:'Original'}};db.data.slotcars.push(row);db.commit();
  client.profile=async()=>({databaseId:'host',car:{id:'a',name:'Changed'},configuration:{technical:{}}});
  const commit=db.commit.bind(db);db.commit=()=>{db.fileChunks();throw Error('disk full');};
  await assert.rejects(client.link('a'),/disk full/);assert.equal(row.model,'Original');db.commit=commit;await client.storage.commit();
  assert.equal(JSON.parse(fs.readFileSync(db.file)).slotcars[0].model,'Original');
});
