'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const {WorkGate,Shutdown}=require('../work-gate');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const turn=()=>new Promise(setImmediate);
test('shutdown tracks accepted work before storage, rejects new work and waits beyond three seconds',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const gate=new WorkGate(),before=deferred(),save=deferred(),order=[];
 const accepted=gate.run(async()=>{await before.promise;order.push('write');await save.promise;order.push('saved');});
 const close=new Shutdown({gate,quiesce:()=>order.push('stop'),drain:async()=>{await gate.idle();order.push('closed');}});
 const finish=close.run();await assert.rejects(gate.run(()=>order.push('late')),e=>e.code==='APP_CLOSING');
 t.mock.timers.tick(10000);await turn();assert.equal(close.ready,false);before.resolve();await turn();assert.deepEqual(order,['stop','write']);
 save.resolve();await accepted;await finish;assert.deepEqual(order,['stop','write','saved','closed']);assert(close.ready);
});
test('shutdown failure does not allow exit and can retry without accepting new work',async()=>{
 const gate=new WorkGate();let attempts=0;
 const close=new Shutdown({gate,quiesce(){},async drain(){if(++attempts===1)throw Error('disk unavailable');}});
 const first=close.run();assert.equal(close.run(),first);await assert.rejects(first,/disk unavailable/);assert(!close.ready);assert(gate.closing);
 await close.run();assert(close.ready);assert.equal(attempts,2);
});
test('failed accepted operations settle without an unhandled cleanup rejection',async()=>{
 const gate=new WorkGate(),job=gate.run(()=>{throw Error('rejected save');});gate.stop();await assert.rejects(job,/rejected save/);await gate.idle();assert.equal(gate.jobs.size,0);
});
test('lifecycle close failures are retryable',async()=>{
 let attempts=0;const {StorageLifecycle}=require('../storage-lifecycle'),life=new StorageLifecycle({idle:async()=>{},close:async()=>{if(++attempts===1)throw Error('busy');}});
 await assert.rejects(life.shutdown(),/busy/);await life.shutdown();assert.equal(attempts,2);
});
test('worker close rejection does not terminate storage and permits retry',async()=>{
 const Client=require('../sqlite-client');let attempts=0,terminated=0;
 const client={request:async()=>{if(++attempts===1)throw Error('close failed');return true;},worker:{terminate:async()=>{terminated++;}}};
 await assert.rejects(Client.prototype.close.call(client),/close failed/);assert.equal(terminated,0);
 await Client.prototype.close.call(client);assert.equal(terminated,1);assert.equal(attempts,2);
});
function makeServer(list){return require('../server').createServer({root:__dirname,appRoot:__dirname,schema:{},getSettings:()=>({}),list,customFields:()=>[],getLive:()=>({}),onCommand(){}});}
function get(port,url){return new Promise((resolve,reject)=>{http.get({host:'127.0.0.1',port,path:url,agent:false},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject);});}
test('network shutdown retains disconnected in-flight reads and rejects later requests',async t=>{
 const entered=deferred(),reading=deferred(),server=makeServer(async()=>{entered.resolve();await reading.promise;return [];});t.after(()=>{reading.resolve();return server.close();});
 const port=await server.listen(0,'127.0.0.1'),request=http.get({host:'127.0.0.1',port,path:'/api/list/drivers',agent:false});request.on('error',()=>{});
 await entered.promise;request.destroy();server.quiesce();assert.equal(await get(port,'/api/list/drivers'),503);
 let closed=false;const finish=server.close().then(()=>closed=true);await turn();assert(!closed);reading.resolve();await finish;assert(closed);
});
test('network shutdown closes event streams and partial requests',async()=>{
 const server=makeServer(()=>[]),port=await server.listen(0,'127.0.0.1');
 const stream=deferred(),request=http.get({host:'127.0.0.1',port,path:'/events',agent:false},res=>{res.on('data',()=>stream.resolve());});request.on('error',()=>{});await stream.promise;
 const partial=http.request({host:'127.0.0.1',port,path:'/api/auth',method:'POST',headers:{'Content-Length':'100'},agent:false});partial.on('error',()=>{});partial.write('{');await turn();await server.close();partial.destroy();request.destroy();
});
test('Paddock quiesce preserves credentials for accepted work and disables rescheduling',()=>{
 const {Paddock}=require('../paddock'),p=new Paddock(null,{storage:{},deliveryStore:{}});p.code='secret';p.schedule();p.quiesce();assert.equal(p.code,'secret');assert.equal(p.timer,null);assert.doesNotThrow(()=>p.active());p.schedule();assert.equal(p.timer,null);p.stop();assert.equal(p.code,'');
});
