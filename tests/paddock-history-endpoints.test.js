'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const U=require('../paddock-history-upload'),R=require('../paddock-history-read-v1'),H=require('../paddock-history-write');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock-history-write',n+'.json')));
test('older host negotiation disables new routes without rewriting saved operations',async()=>{
 const local=require('../paddock-local'),op=read('create'),saved=structuredClone(op);let connection={mode:'local',databaseId:op.databaseId,historyGuard:{version:1,databaseId:op.databaseId,recoveryId:op.recoveryId,reads:true,statistics:true}};
 const client={hostRequest:async()=>({id:op.databaseId,localInstanceId:'instance',capabilities:{}}),connection:async()=>({connection,revision:1}),storage:{setConnection:async v=>{connection=v;}}};
 await local.negotiateHistory.call(client,{databaseId:op.databaseId,instanceId:'instance'});assert.equal(connection.historyGuard,undefined);assert.equal(client.historyCapability,null);assert.deepEqual(op,saved);
});
test('shared read fixtures validate and normalize without inventing session statistics',()=>{
 const db='paddock-demo',list=R.validate(read('list'),{kind:'list'},db),r=list.results[0],o={sourceId:r.sourceId,sessionId:r.sessionId,token:r.resultToken};
 assert.equal(list.protocol,'shared');assert.equal(list.results[0].revision,r.accepted.revision);
 const h=R.validate(read('head'),{kind:'head',...o},db);assert.deepEqual(h.summaries,[]);assert.equal(h.summaryCoverage,'unavailable');
 assert.equal(R.validate(read('laps'),{kind:'laps',...o,participantId:'entry-1'},db).laps.length,3);
 assert.equal(R.validate(read('statistics'),{kind:'statistics',carId:'car-a'},db).measuredLaps,3);
 assert.throws(()=>R.validate(read('statistics'),{kind:'statistics',carId:'different'},db));
 assert.throws(()=>R.validate(read('head'),{kind:'head',...o,recoveryId:'restored'},db),{code:'RECOVERY_CHANGED'});
 assert.throws(()=>R.validate({...read('list'),entries:[r,r]},{kind:'list'},db));
 assert.throws(()=>R.validate({...read('statistics'),validLaps:100},{kind:'statistics',carId:'car-a'},db));
 const broken=read('head');broken.body.payload.participants=null;
 assert.throws(()=>R.validate(broken,{kind:'head',...o},db),{code:'HISTORY_INVALID'});
 assert.throws(()=>R.validate({...read('list'),entries:[null]},{kind:'list'},db),{code:'HISTORY_INVALID'});
});
test('shared routes preserve opaque continuations, scope track/driver identities, reject unsafe filters',()=>{
 assert.equal(R.route({kind:'list',q:'',state:'all'}),R.route({kind:'list'}),'default UI and background refresh share their offline page');
 assert.equal(R.route({kind:'list',page:'signed_token.signature',q:'a&b',limit:2}),'/v1/shared-history/sessions?q=a%26b&limit=2&page=signed_token.signature');
 for(const o of [{kind:'list',limit:51},{kind:'list',trackId:'track'},{kind:'list',page:'../bad'},{kind:'list',from:'2026-02-30T00:00:00Z'},{kind:'statistics',carId:'car-a',driverId:'driver'},{kind:'statistics',carId:'car-a',lane:0}])assert.throws(()=>R.route(o));
 const o={kind:'head',sourceId:'s',sessionId:'r',token:'a'.repeat(64)};assert(!R.route(o,true).includes('?'));assert(R.route(o).includes('?token='));
 assert.doesNotThrow(()=>R.route({kind:'list',from:'2026-11-09T12:00:00Z',to:'2026-11-09T12:00:00.001Z'}));
});
test('shared heads support zero-lap entries without inventing eligible bests',()=>{
 const head=read('head'),p=head.body.payload;head.lapCounts=[];
 const out=R.validate(head,{kind:'head',sourceId:p.source.id,sessionId:p.sessionId,token:head.resultToken},head.databaseId);
 assert.deepEqual(out.lapCounts,[{participantId:'entry-1',count:0}]);assert.equal(out.summaries.length,0);
 const duplicate=read('head');duplicate.lapCounts.push(duplicate.lapCounts[0]);assert.throws(()=>R.validate(duplicate,{kind:'head',sourceId:p.source.id,sessionId:p.sessionId,token:head.resultToken},head.databaseId));
});
function mock(){
 const op=read('create');op.bundle.payload.notes='large'.repeat(70000);let guard={operations:[op]},stored=null,prepared=0,interrupted=false,accepted=false;const calls=[],received=new Set();
 const prepare=async(id,replace)=>{prepared++;const next=U.prepare(guard,id,replace);guard=next.guard;stored=next.upload;return stored;};
 const receipt=()=>({version:1,...Object.fromEntries(['databaseId','recoveryId','operationId','sourceId','sessionId'].map(k=>[k,op[k]])),status:'committed',requestHash:require('../paddock').hash(op),accepted:H.tuple(op.bundle.payload),current:H.tuple(op.bundle.payload),committedAt:new Date().toISOString(),duplicate:false});
 const status=()=>({version:1,...Object.fromEntries(['databaseId','recoveryId','uploadId','byteLength','sha256'].map(k=>[k,stored.manifest[k]])),state:accepted?'committed':'staging',chunkBytes:U.CHUNK,received:[...received],expiresAt:new Date(Date.now()+86400000).toISOString(),receipt:accepted?receipt():null});
 const call=async(route,body,_limit,_recovery,method)=>{calls.push({route,body,method});if(route.startsWith(H.ROOT+'/operations/')){if(accepted)return receipt();throw Object.assign(Error('Missing'),{code:'OPERATION_NOT_FOUND'});}if(route.includes('/chunks/')){assert.equal(method,'PUT');assert(stored,'bytes persisted before network');assert.equal(U.sha(Buffer.from(body.data,'base64')),body.sha256);received.add(body.index);if(!interrupted){interrupted=true;throw Error('Lost chunk reply');}return status();}if(route.endsWith('/commit'))accepted=true;return status();};
 return {op,prepare,call,calls,status,get stored(){return stored;},get guard(){return guard;},get prepared(){return prepared;}};
}
test('portable upload resumes exact bytes and missing chunks; only commit is acceptance',async()=>{
 const m=mock(),cap=read('capability');await assert.rejects(U.send(m.call,m.op,m.prepare,()=>false,cap),/Lost chunk/);const before=structuredClone(m.stored);assert.equal(m.status().state,'staging');
 const r=await U.send(m.call,m.op,m.prepare,()=>false,cap);assert.equal(r.status,'committed');assert.deepEqual(m.stored,before);assert.equal(m.calls.filter(x=>x.route.endsWith('/chunks/0')).length,1);assert.equal(m.calls.filter(x=>x.route.endsWith('/commit')).length,1);H.receipt(r,m.op,m.op.bundle.payload);
});
test('raw upload hashes stay stable when SQLite reconstructs equivalent object keys in another order',()=>{
 const op=read('create'),u=U.prepare({operations:[op]},op.operationId).upload;
 const reordered=Object.fromEntries(Object.entries(op).reverse());assert.equal(U.verify(u,reordered).toString(),u.serialized);
 assert.throws(()=>U.verify({...u,serialized:u.serialized+' '},op));assert.throws(()=>U.verify(u,{...op,reason:'changed'}));
 assert.throws(()=>U.verify({...u,serialized:'{',manifest:{...u.manifest,byteLength:1,sha256:U.sha('{')}},op),{code:'HISTORY_REVIEW_REQUIRED'});
});
test('pause, failed durable preparation, mismatched status and changed recovery cannot commit',async()=>{
 const m=mock(),cap=read('capability');await assert.rejects(U.send(m.call,m.op,async()=>{throw Error('disk full');},()=>false,cap),/disk full/);assert.equal(m.calls.length,0);
 await assert.rejects(U.send(m.call,m.op,m.prepare,()=>true,cap),{code:'DELIVERY_PAUSED'});assert.equal(m.calls.length,0);
 await assert.rejects(U.send(async()=>({...m.status(),databaseId:'other'}),m.op,m.prepare,()=>false,cap),{code:'HISTORY_REVIEW_REQUIRED'});
 await assert.rejects(U.send(async()=>{throw Object.assign(Error('restored'),{code:'RECOVERY_CHANGED'});},m.op,m.prepare,()=>false,cap),{code:'RECOVERY_CHANGED'});
 assert.equal(m.prepared,3);assert.equal(m.guard.operations[0].operationId,m.op.operationId);
 assert.throws(()=>U.status({...m.status(),state:'expired'},m.stored),{code:'UPLOAD_EXPIRED'});
});
test('expired transport checks original receipt first and can recover already accepted history',async()=>{
 const m=mock(),cap=read('capability');let accepted;
 try{await U.send(m.call,m.op,m.prepare,()=>false,cap);}catch{}accepted=await U.send(m.call,m.op,m.prepare,()=>false,cap);
 const r=await U.send(async route=>{if(route.startsWith(H.ROOT+'/operations/'))return accepted;throw Object.assign(Error('expired'),{code:'UPLOAD_EXPIRED'});},m.op,m.prepare,()=>false,cap);
 assert.equal(r.operationId,m.op.operationId);assert.equal(m.prepared,3,'no replacement transport for accepted result');
});
test('statistics renderer labels central totals, unknown distance, quarantines and escapes car names',()=>{
 const ui=require('../renderer/paddockhistory'),v={...read('statistics'),distanceComplete:false,unknownDistanceLaps:2,quarantinedSessions:1};const html=ui.statisticsHtml(v,'<script>');assert(html.includes('&lt;script&gt;'));assert(html.includes('never added again'));assert(html.includes('unknown distance'));assert(html.includes('conflicting sessions'));assert(html.includes('Class wins are separate from overall wins'));
});
