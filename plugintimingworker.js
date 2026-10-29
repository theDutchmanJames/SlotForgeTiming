// First-party protocol layer around a trusted timing driver. A physical output
// controller still needs its own watchdog: a dead process cannot switch a relay.
const {performance}=require('node:perf_hooks');
function create(plugin,context,descriptor,send){
 const driver=plugin.timing;
 for(const name of ['connect','arm','disconnect',...(descriptor.outputs.length?['outputs']:[])])if(typeof driver?.[name]!=='function')throw Error('Missing timing driver method: '+name);
 let session=null,lastPulse=0,watch=null,closing=null,tail=Promise.resolve(),renewing=false,renewAt=0,lastWrite=0,values={};
 const serial=fn=>{const result=tail.then(fn);tail=result.catch(()=>{});return result;};
 const off=()=>Object.fromEntries(descriptor.outputs.map(k=>[k,false]));
 function makeSession(p){
  let sequence=0;const {connection,generation}=p;
  return Object.freeze({connection,generation,now:()=>performance.now(),
   sensor(kind,channel,on,at=performance.now()){send({type:'timing-input',connection,generation,sequence:++sequence,kind,channel,on,at});},
   disconnected(reason='Device disconnected'){send({type:'timing-lost',connection,generation,reason:String(reason).slice(0,500)});}
  });
 }
 async function close(){
  if(closing)return closing;clearInterval(watch);watch=null;session=null;
  values=off();closing=serial(async()=>{try{if(descriptor.outputs.length)await driver.outputs(context,{values:off(),expiresInMs:0});}finally{await driver.disconnect(context);}});
  try{return await closing;}finally{closing=null;}
 }
 const valid=p=>{if(!session||p.connection!==session.connection||p.generation!==session.generation)throw Error('Stale timing connection or race session.');};
 function pulse(p){
  if(!session||p.connection!==session.connection||p.generation!==session.generation)return;
  lastPulse=performance.now();
  if(descriptor.outputs.length&&!renewing&&lastPulse-lastWrite>=350){
   renewing=true;renewAt=lastPulse;const owner=session;
   serial(async()=>{if(session!==owner)return;const ack=await driver.outputs(context,{values:{...values},expiresInMs:1500});if(ack!==true)throw Error('Output lease renewal was not acknowledged.');lastWrite=performance.now();}).catch(e=>send({type:'fatal',message:String(e.message).slice(0,500)})).finally(()=>{renewing=false;});
  }
 }
 async function handle(operation,p){
  if(operation==='clock')return {now:performance.now()};
  if(operation==='disconnect'){await close();return {ack:true};}
  if(operation==='connect'){
   if(session||closing)throw Error('Timing driver is already connected or closing.');
   session=makeSession(p);
   try{
    values=off();const inputs=await serial(()=>driver.connect(context,session));lastPulse=performance.now();
    watch=setInterval(()=>{if(renewing&&performance.now()-renewAt>1000)send({type:'fatal',message:'Output lease renewal timed out.'});if(session&&performance.now()-lastPulse>1500){const old=session;session=null;old.disconnected('Host heartbeat expired; outputs requested off.');close().catch(e=>send({type:'fatal',message:String(e.message).slice(0,500)}));}},100);
    return {inputs,at:performance.now()};
   }catch(e){await close().catch(()=>{});throw e;}
  }
  if(operation==='arm'){
   if(!session||p.connection!==session.connection)throw Error('Timing connection is not available.');
   session=makeSession(p);lastPulse=performance.now();const inputs=await serial(()=>driver.arm(context,session,{active:p.active,lanes:p.lanes}));return {inputs,at:performance.now()};
  }
  valid(p);lastPulse=performance.now();
  if(operation==='outputs'){
   if(!descriptor.outputs.length)return {ack:true,values:{}};
   await serial(async()=>{valid(p);values={...p.values};const ack=await driver.outputs(context,{values:{...values},expiresInMs:1500});if(ack!==true)throw Error('Output write was not acknowledged.');lastWrite=performance.now();});return {ack:true,values:p.values};
  }
  if(operation==='simulate'&&descriptor.simulation&&typeof driver.simulate==='function')return await driver.simulate(context,session,p.event);
  throw Error('Unsupported timing operation.');
 }
 return {handle,pulse,close};
}
module.exports={create};
