'use strict';
// Optional joint qualification against the adjacent Paddock checkout, always using
// synthetic profiles. Portable contract/regression tests live in paddock-local.test.js.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
test('joint local-library host: protected discovery, approval, offline capture, restart and resumed transfer',{skip:!fs.existsSync(path.join(source,'src/local-library.cjs'))},async t=>{
 const {Store}=require(path.join(source,'src/store.cjs')),{LocalLibrary}=require(path.join(source,'src/local-library.cjs'));
 const Database=require('../db'),{Paddock}=require('../paddock'),Discovery=require('../paddock-local-discovery');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-paddock-joint-')),profile=path.join(root,'paddock');fs.mkdirSync(profile);
 const store=new Store(path.join(profile,'database.json'));store.persist(store.data);
 let host=new LocalLibrary({store,profile,folder:path.join(root,'discovery')});await host.start();assert.equal(host.error,'');
 // A malformed descriptor from another profile must not hide this protected host.
 fs.writeFileSync(path.join(host.folder,'f'.repeat(64)+'.json'),'{broken discovery');
 const db=new Database(path.join(root,'timing.json'));db.data.slotcars=[{id:'timing-car',brand:'NSR',model:'GT3',lapsDriven:42,raceClass:'gt3'}];db.data.raceclasses=[{id:'gt3',name:'GT3'}];db.saveNow();
 const p=new Paddock(db);p.localScan=()=>Discovery.scan({folder:host.folder});
 t.after(async()=>{p.stop();await p.idle();host.quiesce();await host.idle();host.close();await db.writesIdle();fs.rmSync(root,{recursive:true,force:true});});
 const [found]=await p.discoverLocal();assert(!JSON.stringify(found).includes(host.token));await p.connect({mode:'local',...found});clearTimeout(p.localTimer);clearTimeout(p.timer);
 const [transfer]=await p.createLocalTransfers([{localId:'timing-car'}]);assert.equal(transfer.state,'pending');assert.equal(store.data.cars.length,0);
 const sub=store.data.submissions[0],incoming=sub.package.cars[0];await store.mutateAsync('submission.review',{id:sub.id,carId:incoming.id,decision:'accept',revision:0,fields:['name','maker','model','raceClass','technical'],note:''},{snapshot:false});
 await p.refreshLocalTransfer(transfer.id);assert.equal((await p.localTransfers())[0].state,'linked');assert.equal(db.data.slotcars[0].lapsDriven,42);
 assert.equal((await p.findLocalOrigin(transfer.id)).status,'approved');
 assert.equal(db.data.slotcars[0].paddock.configuration.carId,store.data.cars[0].id);
 const browse=await p.catalogue(true,false);assert.equal(browse.cars.length,1);
 const captured=(await p.prepare(['timing-car'])).captures;
 const sessionId=await db.saveSessionAsync({setupName:'Local library race',sessionType:'race',trackId:'track',trackName:'Club circuit',date:'2026-11-09',standings:[{carId:'timing-car',driverId:'driver',pos:1,laps:1,total:10000}],paddockJournal:{captures:captured,lanes:[20],heats:[{id:'heat-1',name:'Race',startedAt:100000,endedAt:120000,entries:[{carId:'timing-car',driverId:'driver',driverName:'Driver',lane:1,laps:[{number:1,time:10000,at:110000,driverId:'driver',valid:true,pit:false}]}]}]}},[{carId:'timing-car',driverId:'driver',trackId:'track',lane:1,lapNumber:1,time:10000,valid:true}]);
 await p.flush();assert.equal(db.data.sessions.find(s=>s.id===sessionId).paddockDelivery.status,'sent');assert.equal(store.data.timing.sessions.length,1);
 await p.checkReceipt(sessionId);assert(db.data.sessions.find(s=>s.id===sessionId).paddockDelivery.receiptCheckedAt);
 const oldToken=host.token;host.quiesce();await host.idle();host.close();p.localDescriptor=null;p.code='';p.connected=false;
 const offline=await p.prepare(['timing-car']);assert.equal(offline.warnings.length,1);assert.equal(offline.captures['timing-car'].configuration.carId,incoming.id);
 host=new LocalLibrary({store,profile,folder:path.join(root,'discovery')});await host.start();assert.notEqual(host.token,oldToken);await p.ensureLocal((await p.connection()).connection);
 await p.refreshLocalTransfer(transfer.id);assert.equal(store.data.cars.length,1);
 // A separately owned physical car uses the reviewed link route and keeps all
 // Paddock fields/revision unchanged. Timing keeps its own ID and prior mileage.
 const target=(await store.mutateAsync('car.save',{data:{name:'Existing physical car',maker:'Original maker'}},{snapshot:false})).result;
 const prior=structuredClone(store.data.cars.find(c=>c.id===target));db.data.slotcars.push({id:'timing-second',model:'Different local wording',lapsDriven:77});db.saveNow();
 const [linked]=await p.createLocalTransfers([{localId:'timing-second',target:{carId:target,revision:prior.revision}}]);assert.equal(linked.state,'pending');const linkSub=store.data.submissions.find(s=>s.localTransfer.transferId===linked.id);
 await store.mutateAsync('submission.review',{id:linkSub.id,carId:target,decision:'accept',revision:prior.revision,fields:['name','maker']},{snapshot:false});await p.refreshLocalTransfer(linked.id);
 assert.deepEqual(store.data.cars.find(c=>c.id===target),prior);assert.equal(db.data.slotcars.find(c=>c.id==='timing-second').paddock.carId,target);assert.equal(db.data.slotcars.find(c=>c.id==='timing-second').lapsDriven,77);
 await p.disconnect(false);assert.equal((await p.connection()).connection.automatic,false);
});
