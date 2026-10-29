const assert=require('node:assert/strict'),{TimingHost}=require('../plugintiming'),C=require('../renderer/timingplugin'),P=require('../pluginpackage');
const {make}=require('../tools/fixtures/timing-plugin.cjs');
const pack=P.validate(make(),'1.99.2'),d=pack.manifest.timing,c=C.config({id:d?'example.simulated-timing':'',outputsOn:true});
const wait=()=>new Promise(r=>setImmediate(r));
function fixture(){
 let now=10000,selected=true,racing=false,ack=true;
 const calls=[],events=[],record={current:{manifest:pack.manifest,digest:'abc',settings:{}}};
 const runtime={store:{state:{plugins:[record]}},state:()=>({state:'running'}),hardwarePulse(){},hardware:async(id,op,p)=>{calls.push({op,p});if(op==='clock')return {now:now-1000};if(op==='connect'||op==='arm')return {at:now-1000,inputs:C.channels(d).map(x=>({...x,on:false}))};return {ack};}};
 const h=new TimingHost(runtime,{clock:()=>now,emit:e=>events.push(e),selected:()=>selected,isRacing:()=>racing});
 return {h,runtime,events,calls,record,advance:n=>now+=n,selected:v=>selected=v,racing:v=>racing=v,ack:v=>ack=v,input:(extra={})=>h.receive(c.id,{type:'timing-input',connection:h.connection,generation:h.generation,sequence:h.sequence+1,kind:'lap',channel:0,on:true,at:now-1000,...extra})};
}
(async()=>{
 assert.deepEqual(C.validateConfig(c,d),c);assert.throws(()=>C.validateConfig({...c,lapMap:Array(8).fill(0)},d),/unique/);assert.throws(()=>C.descriptor({...d,channels:9}));assert.throws(()=>C.descriptor({...d,outputs:['unknown']}));assert.throws(()=>C.validateConfig({...c,pitMode:'separate'},{...d,inputs:['lap']}));assert.throws(()=>C.validateConfig({...c,outputsOn:'yes'},d));
 // Old package normalization remains unchanged when no timing contribution exists.
 const ordinary=make();delete ordinary.manifest.timing;assert(!Object.hasOwn(P.validate(ordinary,'1.99.2').manifest,'timing'));
 let f=fixture(),h=f.h;
 try{
  f.selected(false);await assert.rejects(()=>h.connect(c),/Choose Plugin/);f.selected(true);await h.connect(c);assert(h.connected);assert.equal(h.offset,1000);assert(f.calls.some(x=>x.op==='outputs'&&Object.values(x.p.values).every(v=>!v)));
  const first=h.generation;f.advance(10);f.input();assert.equal(f.events.at(-1).at,10010);assert.equal(f.events.at(-1).type,'sample');f.input({sequence:1});assert.equal(h.rejected,1);
  const {lease}=await h.race(true,2);assert.notEqual(h.generation,first);f.input({generation:first});assert.equal(h.rejected,2);
  await assert.rejects(()=>h.outputs({master:true},'wrong'),/ownership/);await assert.rejects(()=>h.outputs({unknown:true},lease),/Invalid/);await h.outputs({master:true,relay1:true,relay2:false},lease);assert.equal(h.values.master,true);
  await assert.rejects(()=>h.race(true,2),/Another race/);await h.race(false,2,'wrong');assert(h.reservation);
  const before=f.events.length;f.advance(10);f.input({connection:'old'});assert.equal(f.events.length,before);
  h.lost(c.id,'Cable removed');assert(!h.connected&&h.reservation);f.racing(true);await assert.rejects(()=>h.connect({...c,rearm:1}),/same plugin/);await h.connect(c);assert(Object.values(h.values).every(x=>!x));assert(h.reservation);
  await h.race(true,2,lease);const newer=h.reservation.lease;assert.notEqual(newer,lease);await h.race(false,2,lease);assert(h.reservation);await h.race(false,2,newer);assert(!h.reservation);
  f.advance(20);f.input({at:-5000});assert(!h.connected);assert.match(h.error,/timestamp/);await h.tail;
 }finally{await h.shutdown();}
 f=fixture();h=f.h;
 try{await h.connect(c);const {lease}=await h.race(true,2);f.ack(false);await assert.rejects(()=>h.outputs({master:true},lease),/acknowledged/);assert(!h.connected);assert(h.reservation);await h.tail;}finally{await h.shutdown();}
 f=fixture();h=f.h;
 try{await h.connect({...c,outputsOn:false});const {lease}=await h.race(true,2);await h.outputs({master:true,relay1:true},lease);assert(Object.values(h.values).every(v=>!v));await h.race(false,2,lease);f.advance(30);f.input();f.input({at:9000});assert(!h.connected);assert.match(h.error,/order/);}finally{await h.shutdown();}
 f=fixture();h=f.h;
 try{f.runtime.hardware=async(id,op)=>op==='clock'?{now:9000}:op==='connect'?{at:9000,inputs:[]}:{ack:true};await assert.rejects(()=>h.connect(c),/incomplete/);assert(!h.connected);}finally{await h.shutdown();}
 console.log('PLUGIN TIMING HOST PASSED: descriptors, configuration, clock conversion, complete baselines, stale messages, ownership, recovery identity, disabled outputs and failures.');
})().catch(e=>{console.error(e);process.exitCode=1;});
