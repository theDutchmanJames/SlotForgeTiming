'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),http=require('node:http');
const methods=require('../paddock-local');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('re-establishing a stream requires catch-up even when its first cursor repeats',async()=>{
 const d={key:'selected',databaseId:'db',instanceId:'restarted',token:'secret',address:'http://127.0.0.1:12345'};
 const status={id:'db',name:'Library',localInstanceId:d.instanceId,permissions:{browse:true},capabilities:{localLibrary:{version:1,imports:'/v1/local-library/imports'}}};
 const p={...methods,localScan:async()=>[d],connection:async()=>({connection:null}),hostRequest:async()=>status,active(){},negotiate(){},localEventCursor:'unchanged',localDirty:false};
 await p.ensureLocal({mode:'local',localKey:'selected',databaseId:'db'});
 assert.equal(p.localDirty,true);
 p.localDirty=false;await p.ensureLocal({mode:'local',localKey:'selected',databaseId:'db'});assert.equal(p.localDirty,false);
});
async function until(check){for(let i=0;i<100;i++){if(check())return;await wait(10);}throw Error('Timed out waiting for local notification');}
test('local event stream authenticates, coalesces unchanged hints and rejects another database',async t=>{
 let response,headers;const server=http.createServer((req,res)=>{headers=req.headers;response=res;res.writeHead(200,{'Content-Type':'text/event-stream'});res.write('data: '+JSON.stringify({version:1,databaseId:'db',cursor:'initial'})+'\n\n');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const p={...methods,localDescriptor:{address:'http://127.0.0.1:'+server.address().port,token:'secret',instanceId:'instance',databaseId:'db'}};
 t.after(async()=>{p.closeLocalEvents();response?.destroy();await new Promise(r=>server.close(r));});
 p.openLocalEvents({capabilities:{scalable:{events:'/v1/scalable/events'}}});await until(()=>p.localDirty);
 assert.equal(headers.authorization,'Bearer secret');assert.equal(headers['x-slotforge-instance'],'instance');assert.equal(headers['x-slotforge-database'],'db');assert.equal(headers.origin,undefined);
 p.localDirty=false;response.write('data: '+JSON.stringify({version:1,databaseId:'db',cursor:'initial'})+'\n\n');await wait(30);assert.equal(p.localDirty,false);
 response.write('data: '+JSON.stringify({version:1,databaseId:'db',cursor:'next'})+'\n\n');await until(()=>p.localDirty);assert.equal(p.localEventCursor,'next');
 response.write('data: '+JSON.stringify({version:1,databaseId:'wrong',cursor:'bad'})+'\n\n');await until(()=>!p.localStream);assert.equal(p.localEventCursor,'next');
});
test('unterminated or oversized event frames are bounded',async t=>{
 const server=http.createServer((_req,res)=>{res.writeHead(200,{'Content-Type':'text/event-stream'});res.end('data: '+'x'.repeat(33000));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const p={...methods,localDescriptor:{address:'http://127.0.0.1:'+server.address().port,token:'secret',instanceId:'instance',databaseId:'db'}};t.after(async()=>{p.closeLocalEvents();await new Promise(r=>server.close(r));});
 p.openLocalEvents({capabilities:{scalable:{events:'/v1/scalable/events'}}});await until(()=>!p.localStream);assert.equal(p.localDirty,undefined);
});
test('poll fallback works without SSE; a hint arriving during catch-up is retained',async()=>{
 let reads=0;const p={...methods,scalable:{},localEventCursor:'first',localDirty:true,connection:async()=>({connection:{mode:'local',automatic:true}}),exclusive:async fn=>fn(),ensureLocal:async()=>({}),openLocalEvents(){},browseScalable:async()=>{reads++;p.localEventCursor='arrived-during-read';},syncLocalTransfers:async()=>{},schedule(){}};
 await p.localTick();clearTimeout(p.localTimer);assert.equal(reads,1);assert.equal(p.localDirty,true);
 p.localDirty=false;p.browseScalable=async()=>{reads++;};await p.localTick();clearTimeout(p.localTimer);assert.equal(reads,2);
 p.isRacing=()=>true;await p.localTick();clearTimeout(p.localTimer);assert.equal(reads,2);
});
