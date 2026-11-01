const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const Database=require('../db'),{Paddock,hash}=require('../paddock'),Records=require('../paddockrecords'),Journal=require('../renderer/paddockrace'),Engine=require('../renderer/engine'),En=require('../renderer/endurance');
const fixture=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures',n+'.json')));
function dbFor(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'paddock-audit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return new Database(path.join(dir,'db.json'));}
function clientFor(t){const db=dbFor(t),client=new Paddock(db);t.after(()=>client.stop());client.state().connection={databaseId:'paddock-demo',timing:true};client.code='test';return {db,client};}
function raceJournal(){let wall=100000;const j={captures:{a:{configuration:fixture('profile-car-a').configuration,name:'Test car'}},lanes:[20],heats:[]};const e=Journal.attach(Engine.createRace({type:'race',laps:50,minLap:100,endurance:En.clean({sessionType:'endurance'}),paddockClock:t=>100000+t,entries:[{carId:'a',driverId:'d',driverName:'First',lane:0,roster:[{id:'d',name:'First'},{id:'second',name:'Second'}]}]}),j,'1',()=>wall,t=>100000+t);return {e,j,at(t){wall=100000+t;}};}
function queued(db){const {e,j,at}=raceJournal();e.start(0);at(10000);e.cross(0,10000);e.stop(10000);e.paddockReview();const sid=db.saveSession({setupName:'Audit race',trackId:'track',trackName:'Track',sessionType:'race',paddockJournal:j,standings:[{carId:'a',laps:1,pos:1,total:10000}]},[]);return db.data.sessions.find(s=>s.id===sid).paddockDelivery;}
const status={id:'paddock-demo',permissions:{timingResults:true}};
const receipt=p=>({ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,contentHash:hash(p)});

test('receipt warnings persist and refresh through GET without resending a delivered result',async t=>{
  const {db,client}=clientFor(t),d=queued(db);let warns=[{code:'CAR_ARCHIVED',carId:'car-a'}],posts=0;
  client.call=async(route,p)=>{if(route==='/v1/status')return status;if(p)posts++;return {...receipt(d.payload),warnings:warns};};
  await client.flush();assert.equal(client.status().deliveries[0].warnings[0].code,'CAR_ARCHIVED');assert.equal(client.status().deliveries[0].warnings[0].carName,d.payload.participants[0].displayName);
  warns=[{code:'SESSION_REQUIRES_CORRECTION',carId:'car-a'}];await client.checkReceipt(d.payload.sessionId);
  assert.equal(posts,1);assert.equal(d.status,'sent');assert.equal(client.status().deliveries[0].warnings[0].code,'SESSION_REQUIRES_CORRECTION');assert.ok(d.receiptCheckedAt);
  assert.equal(new Database(db.file).data.sessions[0].paddockDelivery.receipt.warnings[0].code,'SESSION_REQUIRES_CORRECTION');
  await client.retry();assert.equal(posts,1,'warnings must not trigger an unchanged upload');
});

test('receipt checks reject mismatched identities, revisions and content while preserving accepted data',async t=>{
  const {db,client}=clientFor(t),d=queued(db);d.status='sent';d.receipt=receipt(d.payload);const previous=structuredClone(d.receipt);
  for(const patch of [{databaseId:'other'},{sourceId:'other'},{sessionId:'other'},{revision:99},{state:'withdrawn'},{contentHash:'bad'},{warnings:[{code:'BAD',carId:'bad/id'}]}]){
    client.call=async()=>({...previous,...patch});await assert.rejects(client.checkReceipt(d.payload.sessionId),/does not match/);assert.deepEqual(d.receipt,previous);assert.equal(d.status,'sent');
  }
  client.call=async()=>{throw Object.assign(Error('missing'),{code:'SESSION_NOT_FOUND'});};await assert.rejects(client.checkReceipt(d.payload.sessionId));assert.match(d.receiptCheckError,/no longer has a receipt/);assert.deepEqual(d.receipt,previous);
});

test('receipt checking rejects other databases, pending results and racing without network work',async t=>{
  const {db,client}=clientFor(t),d=queued(db);let calls=0;client.call=async()=>{calls++;};
  await assert.rejects(client.checkReceipt(d.payload.sessionId),/delivered result/);d.status='sent';client.state().connection.databaseId='other';await assert.rejects(client.checkReceipt(d.payload.sessionId),/delivered result/);
  client.state().connection.databaseId='paddock-demo';client.isRacing=()=>true;await assert.rejects(client.checkReceipt(d.payload.sessionId),/Finish the race/);assert.equal(calls,0);
});

test('in-flight receipt checks cannot overwrite local corrections or withdrawals',async t=>{
  const {db,client}=clientFor(t),d=queued(db);d.status='sent';let release;client.call=()=>new Promise(r=>release=r);
  const pending=client.checkReceipt(d.payload.sessionId);const session=db.data.sessions[0];Records.revise(db.data,session);release({...receipt(d.payload),warnings:[{code:'SESSION_REQUIRES_CORRECTION',carId:'car-a'}]});await pending;
  assert.equal(session.paddockDelivery.status,'pending');assert.equal(session.paddockDelivery.payload.revision,2);assert.equal(session.paddockDelivery.receipt,null);
  const next=session.paddockDelivery;next.status='sent';const checking=client.checkReceipt(next.payload.sessionId);db.removeSession(session.id);release(receipt(next.payload));await checking;
  assert.equal(db.data.sessions.length,0);assert.equal(db.data.paddock.withdrawals[0].status,'pending');
});

test('receipt refresh rolls back cached warnings on failed local persistence',async t=>{
  const {db,client}=clientFor(t),d=queued(db);d.status='sent';d.receipt=receipt(d.payload);const old=d.receipt;
  client.call=async()=>({...old,warnings:[{code:'SESSION_REQUIRES_CORRECTION',carId:'car-a'}]});db.commit=()=>{throw Error('disk full');};await assert.rejects(client.checkReceipt(d.payload.sessionId),/disk full/);assert.equal(d.receipt,old);assert.equal(d.receiptCheckedAt,undefined);
});

test('actual Paddock reports historical overlap warnings and clears them after a deliberate correction',{skip:!process.env.PADDOCK_SOURCE},async t=>{
  const root=process.env.PADDOCK_SOURCE,{Network}=require(path.join(root,'src/network.cjs')),{Store,migrate}=require(path.join(root,'src/store.cjs')),timing=require(path.join(root,'src/timing-integration.cjs'));
  const store=new Store();store.data=migrate(fixture('demo-database'));timing.receive(store,fixture('normal'));
  const old=store.snapshot(),record=old.timing.sessions[0],p=record.payload,entry=p.participants[0];
  p.heats.push({...p.heats[0],id:'heat-2'});entry.stints[0].endedAtMs=10000;entry.stints.push({...entry.stints[0],id:'stint-2',heatId:'heat-2',startedAtMs:10000,endedAtMs:60000});
  entry.laps=[entry.laps[0],{...entry.laps[1],number:1,stintId:'stint-2',durationMs:15000,endedAtMs:20000}];delete entry.summary;record.contentHash=timing.digest(p);store.data=migrate(old);
  const host=new Network(store);await host.start();host.controls({allowTimingResults:true});t.after(()=>host.stop());const {db,client}=clientFor(t);client.state().connection=null;
  await client.connect({address:'127.0.0.1:'+host.port,code:host.timingCode});
  db.data.sessions.push({id:p.sessionId,paddockDelivery:{payload:structuredClone(p),status:'sent',receipt:{...receipt(p),warnings:[]}}});await client.commit();
  await client.checkReceipt(p.sessionId);const d=db.data.sessions[0].paddockDelivery;assert.equal(d.receipt.warnings[0].code,'SESSION_REQUIRES_CORRECTION');assert.equal(d.receipt.summaries[0].included,false);
  const fixed=structuredClone(p);fixed.revision++;fixed.participants[0].laps[1].durationMs=10000;db.data.sessions[0].paddockDelivery={payload:fixed,status:'pending'};await client.commit();await client.flush();
  assert.equal(db.data.sessions[0].paddockDelivery.status,'sent');assert.deepEqual(client.status().deliveries[0].warnings,[]);assert.equal(store.data.timing.sessions.length,1);assert.equal(store.data.timing.sessions[0].payload.revision,2);
});
test('review deletion keeps the surviving lap timestamps and original drivers',()=>{const {e,j,at}=raceJournal();e.start(0);at(10000);e.cross(0,10000);at(12000);e.swap(0,12000);at(23000);e.cross(0,23000);at(33000);e.cross(0,33000);e.stop(33000);assert.equal(e.removeLap(0,0,true),true);e.paddockReview((c,n)=>En.driverAtLap(c.en,n));assert.deepEqual(j.heats[0].entries[0].laps.map(l=>l.at),[123000,133000]);assert.deepEqual(j.heats[0].entries[0].laps.map(l=>l.driverId),['second','second']);assert.doesNotThrow(()=>Records.build({paddock:{sourceId:'source'}},{id:'race',paddockJournal:j},[]));});
test('sensor input after the finish does not extend the recorded heat',()=>{const {e,j,at}=raceJournal();e.start(0);at(10000);e.cross(0,10000);e.stop(10000);at(20000);e.cross(0,20000);assert.equal(j.heats[0].endedAt,110000);});
test('fractional sensor clocks produce offsets inside UTC millisecond bounds',()=>{const {e,j,at}=raceJournal();e.start(0.2);at(10000.8);e.cross(0,10000.8);e.stop(10000.8);e.paddockReview();const p=Records.build({paddock:{sourceId:'source'}},{id:'fractional',paddockJournal:j},[]);assert.ok(p.heats[0].endedAtMs<=Date.parse(p.endedAt)-Date.parse(p.startedAt));});
test('a socket reset during upload remains pending for automatic retry',async t=>{const {db,client}=clientFor(t),d=queued(db);client.call=async route=>{if(route==='/v1/status')return status;throw Object.assign(Error('reset'),{code:'ECONNRESET'});};await client.flush();assert.equal(d.status,'pending');client.call=async(route,p)=>route==='/v1/status'?status:receipt(p);await client.flush();assert.equal(d.status,'sent');});
test('failed receipt persistence leaves the delivery retryable',async t=>{const {db,client}=clientFor(t),d=queued(db);const commit=client.commit.bind(client);let fail=false;client.call=async(route,p)=>{if(route==='/v1/status')return status;fail=true;return receipt(p);};client.commit=async()=>{if(fail){fail=false;throw Error('disk full');}return commit();};await client.flush();assert.equal(d.status,'pending');});
test('offline preparation probes once and uses dated cached configurations for the remaining cars',async t=>{const {db,client}=clientFor(t);for(const id of ['a','b'])db.data.slotcars.push({id,paddock:{databaseId:'paddock-demo',carId:id,name:id,configuration:fixture('profile-car-a').configuration}});let calls=0;client.profile=async()=>{calls++;throw Object.assign(Error('offline'),{code:'ECONNREFUSED'});};const capture=await client.prepare(['a','b']);assert.equal(calls,1);assert.equal(Object.keys(capture.captures).length,2);assert.equal(capture.warnings.length,2);});
test('configuration cache write failures are reported and restore the previous capture',async t=>{const {db,client}=clientFor(t),old=fixture('profile-car-a');db.data.raceclasses.push({id:'gt3',name:'GT3'});db.data.slotcars.push({id:'a',raceClass:'gt3',paddock:{databaseId:old.databaseId,carId:old.car.id,name:'Car',configuration:old.configuration}});const fresh=structuredClone(old);fresh.configuration.capturedAt='2026-10-31T12:00:00.000Z';client.profile=async()=>fresh;db.commit=()=>{throw Error('disk full');};await assert.rejects(client.prepare(['a']),/disk full/);assert.equal(db.data.slotcars[0].paddock.configuration.capturedAt,old.configuration.capturedAt);});
test('pagination bounds never silently return a partial catalogue',async t=>{const {client}=clientFor(t);let n=0;client.call=async()=>({id:'paddock-demo',revision:1,cars:[{id:'car-'+n,name:'Car'}],nextOffset:++n});await assert.rejects(client.browse(),/catalogue|pagination/i);});

test('failed host forgetting preserves the saved database identity',async t=>{const {db,client}=clientFor(t);db.commit=()=>{throw Error('disk full');};await assert.rejects(client.disconnect(true),/disk full/);assert.equal(client.state().connection?.databaseId,'paddock-demo');});
test('deleting a classified car with no completed lap withdraws its session',t=>{const db=dbFor(t);const d=queued(db),s=db.data.sessions[0];s.standings.push({carId:'dns-car',driverId:'dns-driver',laps:0,pos:2});db.data.slotcars.push({id:'dns-car'});db.remove('slotcars','dns-car');assert.equal(d.payload.state,'active');assert.equal(db.data.paddock.withdrawals.length,1);});
test('failed result conversion remains identifiable in delivery status',t=>{const {db,client}=clientFor(t);queued(db);const s=db.data.sessions[0];delete s.paddockJournal.heats[0].entries[0].laps[0].at;Records.revise(db.data,s);const status=client.status().deliveries[0];assert.equal(status.name,'Audit race');assert.equal(status.sessionId,s.id);});
test('uploads stop when a race starts while the status request is in flight',async t=>{const {db,client}=clientFor(t);queued(db);let racing=false,posts=0;client.isRacing=()=>racing;client.call=async route=>{if(route==='/v1/status'){racing=true;return status;}posts++;};await client.flush();assert.equal(posts,0);});

test('real host accepts reviewed fractional-clock laps and retries a lost acknowledgement without duplicate statistics',{skip:!process.env.PADDOCK_SOURCE},async t=>{
  const http=require('node:http'),{Network}=require(path.join(process.env.PADDOCK_SOURCE,'src/network.cjs')),{Store,migrate}=require(path.join(process.env.PADDOCK_SOURCE,'src/store.cjs'));
  const store=new Store();store.data=migrate(fixture('demo-database'));const host=new Network(store);await host.start();host.controls({allowTimingResults:true});t.after(()=>host.stop());
  const {db,client}=clientFor(t);client.state().connection=null;await client.connect({address:'127.0.0.1:'+host.port,code:host.timingCode});const car=await client.link('car-a');
  const {e,j,at}=raceJournal();e.cars[0].carId=car.id;j.captures={[car.id]:{name:'Test car',configuration:car.paddock.configuration}};
  e.start(0.2);at(10000.8);e.cross(0,10000.8);at(12000.8);e.swap(0,12000.8);at(23000.8);e.cross(0,23000.8);at(33000.8);e.cross(0,33000.8);e.stop(33000.8);e.removeLap(0,0,true);e.paddockReview((c,n)=>En.driverAtLap(c.en,n));
  const sid=await db.saveSessionAsync({setupName:'Fractional corrected endurance',sessionType:'endurance',trackId:'track',trackName:'Track',paddockJournal:j,standings:[{carId:car.id,pos:1,laps:2,total:23000}]},[]);
  let drop=true;const proxy=http.createServer((req,res)=>{
    const upstream=http.request({hostname:'127.0.0.1',port:host.port,path:req.url,method:req.method,headers:req.headers},reply=>{const parts=[];reply.on('data',p=>parts.push(p));reply.on('end',()=>{if(req.method==='POST'&&drop){drop=false;res.destroy();return;}res.writeHead(reply.statusCode,reply.headers);res.end(Buffer.concat(parts));});});upstream.on('error',()=>res.destroy());req.pipe(upstream);
  });await new Promise(r=>proxy.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>{proxy.close(r);proxy.closeAllConnections();}));client.state().connection.address='http://127.0.0.1:'+proxy.address().port;
  await client.flush();const d=db.data.sessions.find(s=>s.id===sid).paddockDelivery;assert.equal(d.status,'pending');assert.equal(store.data.timing.sessions.length,1);
  await client.flush();assert.equal(d.status,'sent',d.error);assert.equal(d.receipt.duplicate,true);assert.equal(store.data.timing.sessions.length,1);
  const p=store.data.timing.sessions[0].payload,entry=p.participants[0];assert.equal(entry.laps.length,2);assert.equal(entry.stints.find(s=>s.id===entry.laps[0].stintId).driverId,'second');assert.deepEqual(entry.laps.map(l=>l.endedAtMs),[23001,33001]);
});

test('a driver change inside a crossing is attributed at lap completion',()=>{const {e,j,at}=raceJournal();e.start(0);const tick=e.tick;e.tick=t=>{if(t===10000)e.swap(0,t);return tick(t);};at(10000);e.cross(0,10000);e.stop(10000);e.paddockReview();assert.equal(j.heats[0].entries[0].laps[0].driverId,'second');});

test('older checkpoints without crossing driver metadata survive lap deletion',()=>{const {e,j,at}=raceJournal();e.start(0);at(10000);e.cross(0,10000);at(12000);e.swap(0,12000);at(23000);e.cross(0,23000);e.stop(23000);j.heats[0].crossings['0'].forEach(x=>{delete x.driverId;delete x.driverName;});e.removeLap(0,0,true);e.paddockReview((c,n)=>En.driverAtLap(c.en,n));assert.equal(j.heats[0].entries[0].laps[0].driverId,'second');});
test('recovery preserves wall-clock crossings when the renderer clock restarts at zero',()=>{const {e,j,at}=raceJournal();e.start(0);at(10000);e.cross(0,10000);const snapshot=e.snapshot(15000);let wall=235000;const recovered=Journal.attach(Engine.createRace(e.cfg),j,'1',()=>wall,t=>235000+t);assert.equal(recovered.restore(snapshot),true);recovered.resume(0);wall=245000;recovered.cross(0,10000);recovered.stop(10000);recovered.paddockReview();assert.deepEqual(j.heats[0].entries[0].laps.map(l=>l.at),[110000,245000]);assert.doesNotThrow(()=>Records.build({paddock:{sourceId:'source'}},{id:'recovered',paddockJournal:j},[]));});

test('lap deletion keeps local endurance driver attribution and stint totals consistent',()=>{const {e,at}=raceJournal();e.start(0);at(10000);e.cross(0,10000);at(12000);e.swap(0,12000);at(23000);e.cross(0,23000);at(33000);e.cross(0,33000);e.stop(33000);e.removeLap(0,0,true);const c=e.cars[0];assert.deepEqual(c.laps.map((_,n)=>En.driverAtLap(c.en,n)),['second','second']);assert.deepEqual(En.totals(c.en,c.roster,33000,2,0).map(x=>x.laps),[0,2]);assert.deepEqual(En.stints(c.en,33000,2,0).map(x=>x.ms),[12000,21000]);});

test('endurance lap corrections preserve distance boundaries and the open driver stint',()=>{const cfg=En.clean({sessionType:'endurance',swapUnit:'distance'}),roster=[{id:'a'},{id:'b'}],st=En.newCar(cfg,roster,'a');En.swap(cfg,st,{el:12000,laps:1,m:24,to:'b',roster,busy:[]});En.removeLap(st,0,20);assert.deepEqual(En.stints(st,23000,1,20).map(s=>[s.laps,s.m,s.ms]),[[0,4,12000],[1,16,11000]]);assert.deepEqual(En.totals(st,roster,23000,1,20).map(s=>[s.laps,s.m]),[[0,4],[1,16]]);En.close(cfg,st,23000,1,20);En.removeLap(st,0,20);assert.deepEqual(En.totals(st,roster,23000,0,0).map(s=>[s.laps,s.m]),[[0,0],[0,0]]);});
