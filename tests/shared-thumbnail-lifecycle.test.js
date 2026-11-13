'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const thumbnails=require('../vendor/slotforge-library/thumbnail-client.cjs');
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const turn=()=>new Promise(r=>setImmediate(r));

test('queued thumbnail requests retain the submitted car, hash and nested snapshot token',async()=>{
 const entered=deferred(),release=deferred(),reads=[];
 const client=thumbnails(async(method,input)=>{reads.push(structuredClone(input));if(reads.length===1){entered.resolve();await release.promise;}return {data:'preview'};});
 const first=client.get({carId:'first'});await entered.promise;
 const input={carId:'second',expectedHash:'a'.repeat(64),token:{id:'library',epoch:'epoch',revision:2}};
 const next=client.get(input);input.carId='wrong';input.expectedHash='b'.repeat(64);input.token.revision=99;
 release.resolve();await Promise.all([first,next]);await client.close();
 assert.deepEqual(reads[1],{carId:'second',expectedHash:'a'.repeat(64),token:{id:'library',epoch:'epoch',revision:2}});
});

test('thumbnail admission is bounded, duplicates share work, and overflow does not prevent shutdown',async()=>{
 const entered=deferred(),reads=[];
 const client=thumbnails(async(method,input)=>{reads.push(input);entered.resolve();return {data:'preview'};});
 // All requests enter before the promise queue begins running.
 const jobs=Array.from({length:128},(_,i)=>client.get({carId:'car-'+i}));
 const duplicate=client.get({carId:'car-0'});
 await assert.rejects(client.get({carId:'overflow'}),{code:'WORKER_BUSY'});
 await Promise.all([...jobs,duplicate]);assert.equal(reads.length,128);
 assert.equal(await client.get({carId:'later'}),'preview');await client.close();
 await assert.rejects(client.get({carId:'later'}),{code:'LIBRARY_CLOSED'});
});

test('closing cancels an active encoder and queued jobs and releases its lease',async()=>{
 const entered=deferred(),encoding=deferred(),writes=[];
 const client=thumbnails(async(method,input)=>{if(method==='thumbnailStore'){writes.push(input);return {stored:true};}return {key:'key',lease:'lease',source:'original'};},()=>{entered.resolve();return encoding.promise;});
 const first=client.get({carId:'one'}),second=client.get({carId:'two'});
 const checked=[assert.rejects(first,{code:'LIBRARY_CLOSED'}),assert.rejects(second,{code:'LIBRARY_CLOSED'})];
 await entered.promise;await client.close();await Promise.all(checked);
 assert.deepEqual(writes,[{key:'key',lease:'lease',data:null}]);
 encoding.resolve('too late');await turn();assert.equal(writes.length,1);
});

test('closing cancels a competing lease wait rather than returning a missing photograph',async()=>{
 const entered=deferred();let reads=0;
 const client=thumbnails(async()=>{reads++;entered.resolve();return {pending:true};});
 const job=client.get({carId:'one'}),checked=assert.rejects(job,{code:'LIBRARY_CLOSED'});
 await entered.promise;await turn();await client.close();await checked;assert.equal(reads,1);
});

test('a stalled encoder times out, releases its lease and allows the next preview',async()=>{
 const writes=[];let stalled=true;
 const client=thumbnails(async(method,input)=>{if(method==='thumbnailStore'){writes.push(input);return {stored:true};}return {key:'key',lease:'lease',source:'original'};},()=>stalled?new Promise(()=>{}):'preview',{timeout:25});
 await assert.rejects(client.get({carId:'one'}),{code:'THUMBNAIL_TIMEOUT'});
 stalled=false;assert.equal(await client.get({carId:'one'}),'preview');await client.close();
 assert.deepEqual(writes.map(w=>w.data),[null,'preview']);
});

// Exercise the production admission wrapper with deterministic worker replies.
// The fake worker clones at postMessage, just like worker_threads does.
function workerHarness(){
 let worker;
 class Worker extends EventEmitter{
  constructor(){super();worker=this;this.sent=[];}
  postMessage(message){this.sent.push(structuredClone(message));if(['open','close'].includes(message.method))queueMicrotask(()=>this.reply(message.id,{}));}
  reply(id,value){this.emit('message',{id,value});}
  terminate(){this.emit('exit',0);return Promise.resolve(0);}
 }
 const filename=require.resolve('../vendor/slotforge-library/index.cjs'),module={exports:{}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,__dirname:path.dirname(filename),structuredClone,require:id=>id==='node:worker_threads'?{Worker}:id==='./thumbnail-client.cjs'?thumbnails:require(id)});
 return {open:module.exports.open,get worker(){return worker;}};
}

test('ordinary queued writes retain call-time payloads and drain before handle close',async()=>{
 const h=workerHarness(),handle=await h.open({application:'test',installationId:'test'});
 const active=Array.from({length:8},()=>handle.status());
 const input={operationId:'original',set:{name:'Original'}};
 const write=handle.carWrite(input);input.operationId='mutated';input.set.name='Changed';
 const first=h.worker.sent.find(m=>m.method==='status');h.worker.reply(first.id,{});
 const sent=h.worker.sent.find(m=>m.method==='carWrite');assert.deepEqual(sent.input,{operationId:'original',set:{name:'Original'}});
 const closing=handle.close();await assert.rejects(handle.status(),{code:'LIBRARY_CLOSED'});
 for(const m of h.worker.sent.filter(m=>m.method==='status'&&m.id!==first.id))h.worker.reply(m.id,{});
 h.worker.reply(sent.id,{});await Promise.all([...active,write,closing]);
 await assert.rejects(handle.thumbnail({carId:'one'}),{code:'LIBRARY_CLOSED'});
});

test('worker failure cancels an active thumbnail encoder and rejects later requests',async()=>{
 const entered=deferred(),h=workerHarness(),handle=await h.open({application:'test',installationId:'test',thumbnailEncoder:()=>{entered.resolve();return new Promise(()=>{});}});
 const job=handle.thumbnail({carId:'one'}),checked=assert.rejects(job,{code:'LIBRARY_CLOSED'});
 await turn();const read=h.worker.sent.find(m=>m.method==='thumbnailRead');h.worker.reply(read.id,{key:'key',lease:'lease',source:'original'});
 await entered.promise;h.worker.emit('error',Error('Worker stopped'));await checked;
 await handle.close();await assert.rejects(handle.status(),{code:'LIBRARY_CLOSED'});
});
