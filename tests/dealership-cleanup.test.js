'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const DB=require('../db'),{Paddock,hash}=require('../paddock');
for(const kind of ['json','sqlite'])test(kind+': migration backoff and changed address retain queue, identities and exact result',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-dealership-test-')),file=path.join(dir,'source.json'),db=new DB(file);db.saveNow();const original=fs.readFileSync(file);let worker,repo,client;
 if(kind==='sqlite'){
  require('../sqlite-migration').migrateCopy({source:file,destination:path.join(dir,'copy')});require('../sqlite-working').forkCopy(path.join(dir,'copy'),path.join(dir,'work'));
  worker=new(require('../sqlite-client'))();await worker.openWorking(path.join(dir,'work'));repo=new(require('../sqlite-repository'))(worker);client=new Paddock(null,{storage:new(require('../paddock-storage').SqlitePaddockStorage)(repo),deliveryStore:worker});
 }else client=new Paddock(db);
 const servers=[];t.after(async()=>{client.stop();await client.idle();for(const s of servers)await new Promise(r=>s.close(r));await worker?.close();await db.writesIdle();if(kind==='sqlite')assert.deepEqual(fs.readFileSync(file),original);fs.rmSync(dir,{recursive:true,force:true});});
 let phase='ready',hits=0,identity='paddock-demo';const received=[];
 const host=async(stable=false)=>{const s=http.createServer((req,res)=>{hits++;res.setHeader('Content-Type','application/json');if(phase==='migration'&&!stable){res.writeHead(503,{'Retry-After':'2'});return res.end(JSON.stringify({code:'HOST_MIGRATING',error:'Host changing sharing mode'}));}
 if(phase==='new'&&req.headers.authorization!=='Bearer new password'){res.writeHead(401);return res.end(JSON.stringify({code:'UNAUTHENTICATED',error:'Use new password'}));}
 if(req.url==='/v1/status')return res.end(JSON.stringify({id:identity,name:'Club',permissions:{timingResults:true},capabilities:{timing:{versions:[1]}}}));
 let body='';req.on('data',x=>body+=x);req.on('end',()=>{const p=JSON.parse(body);received.push(p);res.end(JSON.stringify({ok:true,databaseId:p.databaseId,sourceId:p.source.id,sessionId:p.sessionId,revision:p.revision,state:p.state,contentHash:hash(p)}));});});servers.push(s);await new Promise(r=>s.listen(0,'127.0.0.1',r));return '127.0.0.1:'+s.address().port;};
 const oldAddress=await host();await client.connect({address:oldAddress,code:'old password'});
 const p=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json'))),data={setupName:'Race',standings:[{carId:'local',laps:1,pos:1,total:10000}],paddockJournal:{captures:{local:{name:'Car',configuration:p.configuration}},lanes:[20],heats:[{id:'1',name:'Heat',startedAt:100000,endedAt:120000,entries:[{carId:'local',driverId:'d',driverName:'Driver',lane:1,laps:[{number:1,time:10000,at:110000,driverId:'d',valid:true}]}]}]}};
 if(repo)await repo.saveSession(data,[],{commandId:'save'});else await db.saveSessionAsync(data,[]);
 const before=await client.status(),source=await client.storage.localRead({kind:'source'});
 phase='migration';await client.flush();let status=await client.status();assert.equal(status.deliveries[0].status,'pending');assert.equal(status.cooldowns[0].code,'HOST_MIGRATING');const count=hits;
 await assert.rejects(client.browse(),e=>e.code==='HOST_MIGRATING'&&e.retryAfterMs>0);await client.retry();await assert.rejects(client.connect({address:oldAddress,code:'new password'}),e=>e.code==='HOST_MIGRATING');assert.equal(hits,count);await assert.rejects(client.hostRequest(oldAddress.replace('127.0.0.1','localhost'),'/v1/status','old password'),e=>e.code==='HOST_MIGRATING');assert.equal(hits,count);
 assert.equal((await client.connection()).connection.databaseId,'paddock-demo');assert.equal(await client.storage.localRead({kind:'source'}),source);assert.equal((await client.status()).deliveries[0].sessionId,before.deliveries[0].sessionId);
 const otherService=await host(true);assert.equal((await client.hostRequest(otherService,'/v1/status','local credential','paddock-demo')).id,'paddock-demo');
 client.migrationCooldowns.set('http://'+oldAddress,Date.now()-1);phase='new';const newAddress=await host();await assert.rejects(client.connect({address:newAddress,code:'old password'}),e=>e.httpStatus===401);
 identity='another-database';await assert.rejects(client.connect({address:newAddress,code:'new password'}),/different Paddock database/);assert.equal((await client.connection()).connection.address,'http://'+oldAddress);
 identity='paddock-demo';await client.connect({address:newAddress,code:'new password'});await client.retry();status=await client.status();assert.equal(status.deliveries[0].status,'sent');assert.equal(received.length,1);assert.equal(received[0].sessionId,before.deliveries[0].sessionId);assert.equal(received[0].revision,1);assert.equal(await client.storage.localRead({kind:'source'}),source);
 assert(!JSON.stringify(status).includes('new password'));assert(!fs.readFileSync(file,'utf8').includes('new password'));
});
