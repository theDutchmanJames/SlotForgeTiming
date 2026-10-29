const assert=require('node:assert/strict'),path=require('node:path'),{fork}=require('node:child_process');
const {Store}=require('../pluginstore'),{Runtime}=require('../pluginruntime'),{TimingHost}=require('../plugintiming'),C=require('../renderer/timingplugin'),{make}=require('../tools/fixtures/timing-plugin.cjs');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 // Verify that heartbeats actually renew writes, not merely a software status.
 const writes=[],messages=[],driver={connect:()=>[{kind:'lap',channel:0,on:false}],arm:()=>[{kind:'lap',channel:0,on:false}],outputs:async(_c,p)=>{writes.push(p);return true;},disconnect:()=>{}};
 const protocol=require('../plugintimingworker').create({timing:driver},{},{inputs:['lap'],channels:1,outputs:['master'],simulation:false},m=>messages.push(m));
 const token={connection:'connection',generation:'one'};
 await protocol.handle('connect',token);await protocol.handle('outputs',{...token,values:{master:true}});await wait(380);protocol.pulse(token);await wait(20);
 assert.equal(writes.length,2);assert.equal(writes[1].values.master,true);assert.equal(writes[1].expiresInMs,1500);
 await protocol.handle('arm',{...token,generation:'two',active:true,lanes:1});await assert.rejects(()=>protocol.handle('outputs',{...token,values:{master:true}}),/Stale/);
 await protocol.close();assert.equal(writes.at(-1).values.master,false);assert.equal(writes.at(-1).expiresInMs,0);
 assert.deepEqual(messages,[]);
 const store=new Store(path.resolve(__dirname,'../.tmp-test/timing-worker-'+process.pid),'1.99.2'),pack=make();store.install(pack);
 let racing=false;const host=new Runtime(store,init=>{const p=fork(path.resolve(__dirname,'../pluginworker.js'),[],{cwd:init.dataDir,stdio:['ignore','pipe','pipe','ipc']});p.postMessage=m=>p.send(m);return p;},{canStart:()=>!racing});
 const events=[],h=new TimingHost(host,{selected:()=>true,isRacing:()=>racing,emit:e=>events.push(e)}),c=C.config({id:pack.manifest.id,outputsOn:true});let heartbeat;
 try{
  await host.start(c.id);await h.connect(c);assert(h.connected);heartbeat=setInterval(()=>h.alive(),100);
  const {lease}=await h.race(true,2);await h.outputs({master:true,relay1:true},lease);
  await h.simulate({kind:'lap',channel:0,on:true});await h.simulate({kind:'lap',channel:0,on:false});assert.equal(events.filter(e=>e.type==='sample').length,2);
  await wait(1800);assert(h.connected,'continuous heartbeat renews the connection and output lease');
  racing=true;await h.simulate({kind:'disconnect'});await h.tail;assert(!h.connected&&h.reservation);await h.connect(c);assert(Object.values(h.values).every(v=>!v));await h.race(true,2,lease);
  const old=h.reservation.lease;host.workers.get(c.id).child.kill();await wait(160);assert(!h.connected&&h.reservation);assert.equal(host.state(c.id).state,'failed');
  await h.connect(c);assert(h.connected,'explicit reconnect restarts same trusted driver during held race');await h.race(true,2,old);
  clearInterval(heartbeat);await wait(1900);assert(!h.connected,'lost renderer heartbeat stops the connection');assert(h.reservation);await h.reset();assert(!h.reservation);
  console.log('PLUGIN TIMING WORKER PASSED: real processes, sensor levels, lease renewal, device loss, crash recovery, no automatic output restoration and renderer watchdog.');
 }finally{clearInterval(heartbeat);await host.shutdown();}
})().catch(e=>{console.error(e);process.exitCode=1;});
