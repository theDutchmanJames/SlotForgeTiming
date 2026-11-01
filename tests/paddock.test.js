const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Database=require('../db'),Records=require('../paddockrecords'),{Paddock,address,privateIP,request}=require('../paddock'),Journal=require('../renderer/paddockrace'),Engine=require('../renderer/engine');
const fixture=name=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures',name+'.json'),'utf8'));
function database(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-paddock-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Database(path.join(dir,'database.json'));}
function sessionData(){const p=fixture('profile-car-a');return {setupName:'Test race',sessionType:'race',trackId:'track',trackName:'Club',standings:[{carId:'local-a',pos:1,laps:2,total:21000}],paddockJournal:{captures:{'local-a':{name:p.car.name,configuration:p.configuration}},lanes:[20,21],heats:[{id:'1',name:'Heat 1',startedAt:100000,endedAt:130000,entries:[{carId:'local-a',driverId:'d',driverName:'Driver',lane:1,laps:[{number:1,time:10000,at:110000,driverId:'d',driverName:'Driver',valid:true,pit:false},{number:2,time:11000,at:121000,driverId:'d',driverName:'Driver',valid:true,pit:false}]}]}]}};}
test('LAN addresses reject external hosts, credentials, redirects and missing ports',()=>{for(const s of ['https://192.168.1.2:44','8.8.8.8:80','example.com:80','http://user@127.0.0.1:9','127.0.0.1','127.0.0.1:44/path'])assert.throws(()=>address(s));assert.equal(address('192.168.1.2:5678'),'http://192.168.1.2:5678');assert.equal(privateIP('172.31.1.2'),true);assert.equal(privateIP('172.32.1.2'),false);});
test('saved results and pending delivery persist together, corrections increment and deletion withdraws',async t=>{let db=database(t);const data=sessionData();const rows=[{carId:'local-a',driverId:'d',lane:1,lapNumber:1,time:10000},{carId:'local-a',driverId:'d',lane:1,lapNumber:2,time:11000}];const id=await db.saveSessionAsync(data,rows);db=new Database(db.file);const s=db.data.sessions.find(s=>s.id===id);assert.equal(s.paddockDelivery.status,'pending');assert.equal(s.paddockDelivery.payload.participants[0].laps.length,2);db.update('laps',db.data.laps[0].id,{noTrackRecord:true});assert.equal(s.paddockDelivery.payload.revision,2);assert.equal(s.paddockDelivery.payload.participants[0].laps[0].recordEligible,false);db.removeSession(id);db=new Database(db.file);assert.equal(db.data.sessions.length,0);assert.equal(db.data.paddock.withdrawals[0].payload.revision,3);assert.equal(db.data.paddock.withdrawals[0].payload.state,'withdrawn');});
test('incomplete legacy timing remains local with a useful delivery error',t=>{const db=database(t),s=sessionData();delete s.paddockJournal.heats[0].entries[0].laps[0].at;const id=db.saveSession(s,[]);assert.equal(db.data.sessions.find(s=>s.id===id).paddockDelivery.status,'attention');assert.match(db.data.sessions[0].paddockDelivery.error,/timestamp/);});
test('engine journal captures real crossings, pauses, removed laps and recovery',()=>{let at=100000;const j={captures:{},heats:[]};const make=()=>Journal.attach(Engine.createRace({type:'practice',minLap:100,entries:[{carId:'a',driverId:'d',driverName:'Driver',lane:0}]}),j,'1',()=>at);let e=make();e.start(0);at+=10000;e.cross(0,10000);e.pause(10000);at+=60000;e.resume(70000);at+=10000;e.cross(0,80000);const snap=e.snapshot(80000);e=make();assert.equal(e.restore(snap),true);at+=60000;e.resume(140000);at+=10000;e.cross(0,150000);e.stop(150000);e.paddockReview();const laps=j.heats[0].entries[0].laps;assert.equal(laps.length,3);assert.equal(laps[1].at-laps[0].at,70000);assert.equal(laps[1].time,10000);assert.equal(laps[2].at,250000);});
test('stint boundaries retain captured driver change time',()=>{const s=sessionData();s.id='test';const entry=s.paddockJournal.heats[0].entries[0];entry.changes=[{at:115000,driverId:'d2',driverName:'Second'}];entry.laps[1].driverId='d2';const p=Records.build({paddock:{sourceId:'source'}},s,[]);assert.equal(p.participants[0].stints[0].endedAtMs,15000);assert.equal(p.participants[0].stints[1].startedAtMs,15000);assert.equal(p.participants[0].laps[1].stintId,'stint-1');});
test('source identity persists; credentials never enter database',async t=>{const db=database(t),client=new Paddock(db);t.after(()=>client.stop());await client.commit();const source=db.data.paddock.sourceId;client.code='temporary-secret';assert.equal(new Database(db.file).data.paddock.sourceId,source);assert.ok(!fs.readFileSync(db.file,'utf8').includes('temporary-secret'));});
test('failed result save leaves neither session nor delivery in memory',async t=>{const db=database(t);db.commit=()=>{throw Error('disk full');};await assert.rejects(db.saveSessionAsync(sessionData(),[]),/disk full/);assert.equal(db.data.sessions.length,0);});

const paddockSource=process.env.PADDOCK_SOURCE;
test('actual Paddock HTTP: link, offline race, duplicate delivery, correction, withdrawal and restart',{skip:!paddockSource},async t=>{
  const {Network}=require(path.join(paddockSource,'src/network.cjs')),{Store,migrate}=require(path.join(paddockSource,'src/store.cjs'));
  const hostStore=new Store();hostStore.data=migrate(fixture('demo-database'));const host=new Network(hostStore);await host.start();host.controls({allowTimingResults:true});t.after(()=>host.stop());
  const db=database(t),client=new Paddock(db);t.after(()=>client.stop());await client.connect({address:'127.0.0.1:'+host.port,code:host.timingCode});const cars=await client.browse();assert.equal(cars.length,2);const car=await client.link('car-a');assert.equal(db.data.slotcars.length,1);await client.link('car-a');assert.equal(db.data.slotcars.length,1);
  const capture=await client.prepare([car.id]);await client.disconnect();const s=sessionData();s.paddockJournal.captures={[car.id]:capture.captures[car.id]};s.paddockJournal.heats[0].entries[0].carId=car.id;s.standings[0].carId=car.id;const rows=s.paddockJournal.heats[0].entries[0].laps.map(l=>({carId:car.id,driverId:'d',lane:1,lapNumber:l.number,time:l.time}));const sid=await db.saveSessionAsync(s,rows);
  // Paddock's current setup changes after the race; captured configuration remains authentic.
  const remote=hostStore.data.cars.find(c=>c.id==='car-a');hostStore.mutate('car.save',{id:remote.id,revision:remote.revision,data:{technical:{gear:'30'}}});
  await client.connect({address:'127.0.0.1:'+host.port,code:host.timingCode});await client.flush();const saved=db.data.sessions.find(s=>s.id===sid);assert.equal(saved.paddockDelivery.status,'sent',client.error);assert.equal(hostStore.data.timing.sessions[0].payload.participants[0].configuration.technical.gear,'27');saved.paddockDelivery.status='pending';await client.flush();assert.equal(hostStore.data.timing.sessions.length,1);
  db.update('laps',db.data.laps[0].id,{noTrackRecord:true});await client.flush();assert.equal(hostStore.data.timing.sessions[0].payload.revision,2);db.removeSession(sid);await client.flush();assert.equal(hostStore.data.timing.sessions[0].payload.state,'withdrawn');assert.equal(db.data.paddock.withdrawals[0].status,'sent');
  // Exercise real endurance swaps, paused clocks and lane rotation against Paddock's validator.
  const En=require('../renderer/endurance'),journal={captures:s.paddockJournal.captures,lanes:[20,21],heats:[]};let wall=200000;
  const roster=[{id:'d',name:'Driver'},{id:'d2',name:'Second'}];
  const make=(heatId,lane)=>Journal.attach(Engine.createRace({type:'race',laps:50,minLap:100,endurance:En.clean({sessionType:'endurance',swapEvery:30}),paddockClock:t=>200000+t,entries:[{carId:car.id,driverId:'d',driverName:'Driver',roster,lane}]}),journal,heatId,()=>wall,t=>200000+t);
  let engine=make('1',0);engine.start(0);wall=210000;engine.cross(0,10000);wall=215000;assert.equal(engine.swap(0,15000).ok,true);wall=220000;engine.cross(0,20000);engine.pause(20000);wall=280000;engine.resume(80000);wall=290000;engine.cross(0,90000);engine.stop(90000);engine.paddockReview((c,n)=>En.driverAtLap(c.en,n));
  wall=300000;engine=make('2',1);engine.start(100000);wall=310000;engine.cross(0,110000);engine.stop(110000);engine.paddockReview((c,n)=>En.driverAtLap(c.en,n));
  const multi={...sessionData(),setupName:'Two heats with swaps',sessionType:'endurance',paddockJournal:journal,standings:[{carId:car.id,pos:1,laps:4,total:40000}]};
  const multiId=await db.saveSessionAsync(multi,[]);await client.flush();const multiSaved=db.data.sessions.find(x=>x.id===multiId);assert.equal(multiSaved.paddockDelivery.status,'sent',multiSaved.paddockDelivery.error||client.error);
  const received=hostStore.data.timing.sessions.find(x=>x.payload.sessionId===multiId).payload;assert.equal(received.heats.length,2);assert.equal(received.participants.length,1);assert.equal(received.participants[0].drivers.length,2);assert.equal(received.participants[0].laps.length,4);assert.equal(received.participants[0].stints[2].lane,2);assert.equal(received.participants[0].laps[2].endedAtMs,90000);assert.equal(received.participants[0].laps[2].durationMs,10000);
  const reopened=new Paddock(new Database(db.file));t.after(()=>reopened.stop());assert.equal(reopened.state().sourceId,client.state().sourceId);assert.equal(reopened.status().hasCode,false);
});

test('delayed sensor delivery retains measured crossing timestamps',()=>{
  const j={heats:[]};let now=100000;
  const e=Journal.attach(Engine.createRace({type:'practice',minLap:100,entries:[{carId:'a',driverId:'d',lane:0}]}),j,'1',()=>now,t=>100000+t);
  e.start(0);now=110080;e.cross(0,10000);now=120010;e.cross(0,20000);e.stop(20000);e.paddockReview();
  assert.deepEqual(j.heats[0].entries[0].laps.map(l=>l.at),[110000,120000]);
});
test('a failed correction retains the previous delivery identity for withdrawal',()=>{
  const db={paddock:{sourceId:'source',withdrawals:[]},laps:[]},s=sessionData();s.id='corrected';Records.prepare(db,s,[]);s.paddockDelivery.status='sent';delete s.paddockJournal.heats[0].entries[0].laps[0].at;Records.revise(db,s);
  assert.equal(s.paddockDelivery.status,'attention');assert.equal(s.paddockDelivery.payload,null);Records.withdraw(db,s,'Deleted');assert.equal(db.paddock.withdrawals[0].payload.sessionId,'corrected');assert.equal(db.paddock.withdrawals[0].payload.revision,2);
});
test('oversize sessions report a terminal payload limit before opening a connection',async()=>{
  await assert.rejects(request('http://127.0.0.1:9','/v1/timing/sessions','code','db',{data:'x'.repeat(8*1024*1024)}),e=>e.code==='PAYLOAD_TOO_LARGE');
});

test('repaired corrections advance beyond the retained revision',()=>{
  const db={paddock:{sourceId:'source',withdrawals:[]},laps:[]},s=sessionData();s.id='corrected';Records.prepare(db,s,[]);const lap=s.paddockJournal.heats[0].entries[0].laps[0];delete lap.at;Records.revise(db,s);lap.at=110000;Records.revise(db,s);assert.equal(s.paddockDelivery.status,'pending');assert.equal(s.paddockDelivery.payload.revision,2);
});
test('ordinary exports and imports cannot clone a live Paddock link or outbox',t=>{
  const T=require('../transfer'),db=database(t),car=db.add('slotcars',{model:'Linked',paddock:{databaseId:'host',carId:'remote'}}),sid=db.saveSession({...sessionData(),standings:[{carId:car.id,pos:1,laps:2,total:21000}]},[]);
  const bundle=T.collect(db.data,{slotcars:[car.id],sessions:[sid]},false);assert.equal(bundle.items.slotcars[0].paddock,undefined);assert.equal(bundle.items.sessions[0].paddockJournal,undefined);assert.equal(bundle.items.sessions[0].paddockDelivery,undefined);
  bundle.items.slotcars[0].paddock={databaseId:'other',carId:'remote'};bundle.items.sessions[0].paddockDelivery={payload:{}};const before=db.data.slotcars.length;T.apply(db,bundle);assert.equal(db.data.slotcars[before].paddock,undefined);assert.equal(db.data.sessions.at(-1).paddockDelivery,undefined);assert.ok(db.data.slotcars[0].paddock);
});
test('connection changes cannot interleave with an active catalogue or capture operation',async t=>{
  const client=new Paddock(database(t));t.after(()=>client.stop());let release;const pending=client.exclusive(()=>new Promise(r=>release=r));await assert.rejects(client.disconnect(),/Wait for/);await assert.rejects(client.browse(),/Wait for/);release();await pending;assert.equal(client.busy,false);
});

test('one physical Paddock car cannot race as two entries at once',async t=>{const db=database(t);const car=db.add('slotcars',{model:'Linked',paddock:{databaseId:'host',carId:'remote'}}),client=new Paddock(db);t.after(()=>client.stop());await assert.rejects(client.prepare([car.id,car.id]),/one entry/);});

test('an unsaved correction or withdrawal is never uploaded after a disk failure',async t=>{const db=database(t);await db.saveSessionAsync(sessionData(),[]);const client=new Paddock(db);t.after(()=>client.stop());client.state().connection={databaseId:'paddock-demo'};client.code='test';let posted=0;client.call=async(route)=>{if(route==='/v1/status')return {id:'paddock-demo',permissions:{timingResults:true}};posted++;throw Error('Should not upload');};db.commit=()=>{throw Error('disk full');};await client.flush();assert.equal(posted,0);assert.match(client.error,/disk full/);});

test('credentials preserve case and repeated spaces, reject invalid header text and support generated codes',()=>{
  const {credential}=require('../paddock');
  for(const code of ['a'.repeat(24),'Club  Timing #42','A'.repeat(128),'12345678','Ab!4','five5','six!66','seven77','A  b'])assert.equal(credential(code),code);
  for(const code of [null,12345678,'','a','ab','abc','x'.repeat(129),' password','password ','password\r\nHeader: injected','pass\tword','Café racing'])assert.throws(()=>credential(code),/4–128/);
});

test('Retry-After supports seconds and dates with a safe fallback for missing or malformed values',()=>{
  const {retryDelay}=require('../paddock'),now=Date.parse('2026-10-31T12:00:00Z');
  assert.equal(retryDelay('125',now),125000);assert.equal(retryDelay('Sat, 31 Oct 2026 12:02:00 GMT',now),120000);
  for(const v of [undefined,'','nonsense','-1','1.5'])assert.equal(retryDelay(v,now),60000);
  assert.equal(retryDelay('0',now),1000);assert.equal(retryDelay('999999999999',now),86400000);
});

test('HTTP 429 protects all client requests, survives disconnect and preserves queued results',async t=>{
  const http=require('node:http');let hits=0,blocked=false;
  const host=http.createServer((req,res)=>{hits++;res.setHeader('Content-Type','application/json');if(blocked){res.writeHead(429,{'Retry-After':'120'});res.end('temporarily unavailable');}else if(req.url==='/v1/status')res.end(JSON.stringify({id:'paddock-demo',name:'Test',permissions:{timingResults:true}}));else res.end(JSON.stringify({id:'paddock-demo',revision:1,cars:[]}));});
  await new Promise(r=>host.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>host.close(r)));
  const base='127.0.0.1:'+host.address().port,db=database(t),client=new Paddock(db);t.after(()=>client.stop());
  await client.connect({address:base,code:'Club  Timing #42'});await db.saveSessionAsync(sessionData(),[]);
  blocked=true;await client.flush();const count=hits;
  assert.equal(db.data.sessions[0].paddockDelivery.status,'pending');assert.equal(client.status().cooldowns.length,1);assert.ok(client.timer._idleTimeout>115000);
  await assert.rejects(client.browse(),/cooldown/);await client.retry();await assert.rejects(client.connect({address:base,code:'New password'}),/cooldown/);
  await client.disconnect();await assert.rejects(client.connect({address:'localhost:9',code:'New password'}),/cooldown/);assert.equal(hits,count);
  assert.ok(!JSON.stringify(client.status()).includes('Club  Timing #42'));assert.ok(!fs.readFileSync(db.file,'utf8').includes('Club  Timing #42'));
  // Expire the same clock boundary without a two-minute test sleep.
  client.cooldowns.set('127.0.0.1',Date.now()-1);blocked=false;await client.connect({address:base,code:'New password'});assert.equal(client.status().cooldowns.length,0);assert.equal(hits,count+1);
});

test('failed initial pairing records a cooldown even before any host is saved',async t=>{
  const http=require('node:http');let hits=0;
  const host=http.createServer((req,res)=>{hits++;res.writeHead(429,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'AUTH_RATE_LIMITED',error:'Wait'}));});
  await new Promise(r=>host.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>host.close(r)));
  const client=new Paddock(database(t));t.after(()=>client.stop());const input={address:'127.0.0.1:'+host.address().port,code:'Club password'};
  await assert.rejects(client.connect(input),e=>e.httpStatus===429);assert.ok(client.status().cooldowns[0].until>Date.now()+55000);assert.equal(client.status().connection,null);
  await assert.rejects(client.connect(input),/cooldown/);assert.equal(hits,1);
});

test('actual Paddock accepts custom Timing passwords and retains results through authentication limits',{skip:!paddockSource},async t=>{
  const {Network}=require(path.join(paddockSource,'src/network.cjs')),{Store}=require(path.join(paddockSource,'src/store.cjs'));
  const host=new Network(new Store());await host.start();t.after(()=>host.stop());host.controls({allowTimingResults:true,access:'timing',password:'Timing  Club #42'});
  const client=new Paddock(database(t));t.after(()=>client.stop());const base='127.0.0.1:'+host.port;
  await client.connect({address:base,code:'Timing  Club #42'});assert.equal(client.status().connection.results,true);
  await assert.rejects(client.connect({address:base,code:'timing  Club #42'}),e=>e.code==='UNAUTHENTICATED');
  await assert.rejects(client.connect({address:base,code:'Timing Club #42'}),e=>e.code==='UNAUTHENTICATED');
  for(let i=0;i<8;i++)await assert.rejects(request('http://'+base,'/v1/status','incorrect password'),e=>e.httpStatus===401);
  await assert.rejects(client.connect({address:base,code:'Timing  Club #42'}),e=>e.httpStatus===429&&e.retryAfterMs>0);
  assert.ok(client.status().cooldowns.length);host.controls({access:'timing',password:'Replacement password'});
  client.cooldowns.set('127.0.0.1',Date.now()-1);await client.connect({address:base,code:'Replacement password'});assert.equal(client.status().connected,true);
});

test('actual Paddock JSON export imports independent cars, images and shared classes and survives reopening',{skip:!paddockSource},async t=>{
  const {Store}=require(path.join(paddockSource,'src/store.cjs')),{timingExport}=require(path.join(paddockSource,'src/timing-export.cjs')),T=require('../transfer');
  const store=new Store(),image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
  const ids=['First','Second'].map(name=>store.mutate('car.save',{data:{name,maker:'NSR',marque:'Aston Martin',model:name,raceClass:'GT3',picture:image,technical:{rearTyres:'Rear rubber',frontTyres:'Front foam',pinion:'9',gear:'27',motor:'King',weight:'84'}}}).result);
  store.data.cars[0].photos=[{id:'photo',name:'Extra',data:image}];
  const bundle=timingExport(store.data,ids,{photos:true}),db=database(t);assert.equal(T.check(bundle).ok,true);
  T.apply(db,bundle);await db.saved();const firstIds=db.data.slotcars.map(c=>c.id),cl=db.data.raceclasses[0].id;
  for(const c of db.data.slotcars){assert.equal(c.raceClass,cl);assert.equal(c.tyres,'Rear rubber');assert.equal(c.gearing,'9/27');assert.equal(c.picture,image);assert.equal(c.motor,'King');assert.equal(c.weight,'84');assert.equal(c.paddock,undefined);}
  assert.deepEqual(db.data.slotcars[0].extraPictures,[image]);T.apply(db,bundle);await db.saved();
  const reopened=new Database(db.file);assert.equal(reopened.data.slotcars.length,4);assert.equal(new Set(reopened.data.slotcars.map(c=>c.id)).size,4);assert.deepEqual(reopened.data.slotcars.slice(0,2).map(c=>c.id),firstIds);
  assert.ok(reopened.data.slotcars.slice(2).every(c=>c.raceClass!==cl&&reopened.data.raceclasses.some(x=>x.id===c.raceClass)&&!c.paddock));
});

test('four-character Dealership password reaches HTTP pairing unchanged and is not persisted',async t=>{
  const http=require('node:http');let authorization;
  const host=http.createServer((req,res)=>{authorization=req.headers.authorization;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({id:'dealership',name:'Club dealership',permissions:{browse:true,timingResults:true},capabilities:{timing:{versions:[1]},club:1}}));});
  await new Promise(r=>host.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>host.close(r)));
  const db=database(t),client=new Paddock(db);t.after(()=>client.stop());
  await client.connect({address:'127.0.0.1:'+host.address().port,code:'A  b'});
  assert.equal(authorization,'Bearer A  b');assert.equal(client.status().connection.results,true);assert.equal(client.status().connection.timing,true);
  assert.ok(!JSON.stringify(client.status()).includes('A  b'));assert.ok(!fs.readFileSync(db.file,'utf8').includes('A  b'));
});
