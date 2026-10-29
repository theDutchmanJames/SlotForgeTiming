const crypto=require('node:crypto'),{performance}=require('node:perf_hooks');
const C=require('./renderer/timingplugin');
const ok=(v,m)=>{if(!v)throw Error(m);},clone=v=>JSON.parse(JSON.stringify(v));
class TimingHost{
 constructor(runtime,{emit=()=>{},selected=()=>false,isRacing=()=>false,clock=()=>performance.timeOrigin+performance.now()}={}){
  Object.assign(this,{runtime,emit,selected,isRacing,clock});this.connected=false;this.connection=null;this.generation=null;this.config=null;this.identity=null;this.descriptor=null;this.reservation=null;this.error='';this.sequence=0;this.rejected=0;this.lastAt=-Infinity;this.offset=0;this.uncertainty=null;this.pending=[];this.accepting=false;this.tail=Promise.resolve();this.queued=0;this.values={};this.lastAlive=clock();
  this.watch=setInterval(()=>{if(this.connected&&this.clock()-this.lastAlive>1500)this.fail('Main window heartbeat expired.');},250);this.watch.unref?.();runtime.timing=this;
 }
 entries(){return this.runtime.store.state.plugins.filter(r=>r.current.manifest.timing).map(r=>({id:r.current.manifest.id,name:r.current.manifest.name,version:r.current.manifest.version,digest:r.current.digest,timing:r.current.manifest.timing,state:this.runtime.state(r.current.manifest.id).state,settings:r.current.settings,fields:r.current.manifest.settings}));}
 state(){return {type:'state',connected:this.connected,connection:this.connection,generation:this.generation,config:this.config&&clone(this.config),identity:this.identity&&clone(this.identity),capabilities:this.descriptor&&clone(this.descriptor),race:!!this.reservation,error:this.error,values:{...this.values},uncertainty:this.uncertainty,rejected:this.rejected};}
 notify(){this.emit(this.state());}
 enqueue(fn){if(this.queued>=16)return Promise.reject(Error('Timing operation queue is full.'));this.queued++;const result=this.tail.then(fn,fn);this.tail=result.catch(()=>{}).finally(()=>this.queued--);return result;}
 async rpc(operation,payload={}){ok(this.identity,'Choose a timing plugin.');return this.runtime.hardware(this.identity.id,operation,{connection:this.connection,generation:this.generation,...payload});}
 canRecover(id){const r=this.reservation,e=this.entries().find(e=>e.id===id);return !!(r&&r.identity.id===id&&e&&e.digest===r.identity.digest&&JSON.stringify(e.settings)===JSON.stringify(r.identity.settings)&&this.selected());}
 uses(id){return this.identity?.id===id&&(this.connected||!!this.connection||!!this.reservation);}
 validate(raw){const e=this.entries().find(e=>e.id===raw?.id);ok(e,'Install a plugin with a timing contribution first.');return C.validateConfig(raw,e.timing);}
 snapshot(result){
  ok(Array.isArray(result?.inputs)&&Number.isFinite(result.at),'Timing driver must return a sensor snapshot.');
  const wanted=C.channels(this.descriptor),keys=new Set();
  for(const e of result.inputs){ok(e&&wanted.some(x=>x.kind===e.kind&&x.channel===e.channel)&&typeof e.on==='boolean'&&!keys.has(C.channelKey(e.kind,e.channel)),'Invalid sensor snapshot.');keys.add(C.channelKey(e.kind,e.channel));}
  ok(keys.size===wanted.length,'Sensor snapshot is incomplete.');
  const at=this.convertTime(result.at);this.lastAt=at;this.connected=true;this.accepting=true;this.lastAlive=this.clock();
  this.emit({...this.state(),type:'snapshot',inputs:clone(result.inputs),at});
  const buffered=this.pending;this.pending=[];for(const e of buffered){if(e.at+this.offset<=at){this.sequence=Math.max(this.sequence,e.sequence||0);continue;}this.receive(this.identity.id,e);}
  this.notify();
 }
 convertTime(at){const now=this.clock(),converted=at+this.offset;ok(Number.isFinite(at)&&now-converted<=2000&&converted-now<=this.uncertainty+5,'Timing timestamp is stale or outside the synchronized clock.');return Math.min(now,converted);}
 connect(raw){return this.enqueue(async()=>{
  ok(this.selected(),'Choose Plugin interface as the timing hardware first.');ok(!this.connected&&!this.connection,'Disconnect the current plugin interface first.');
  const c=this.validate(raw),entry=this.entries().find(e=>e.id===c.id);
  const identity={id:entry.id,name:entry.name,version:entry.version,digest:entry.digest,settings:clone(entry.settings),settingsDigest:crypto.createHash('sha256').update(JSON.stringify(entry.settings)).digest('hex'),configuration:clone(c)};
  if(this.reservation)ok(JSON.stringify(identity)===JSON.stringify(this.reservation.identity),'Reconnect the same plugin version, settings and lane configuration used by this race.');else ok(!this.isRacing(),'Cannot introduce a new timing connection during a race.');
  if(entry.state!=='running'){ok(this.canRecover(c.id),'Start this trusted plugin in Plugins first.');await this.runtime.start(c.id,{recovery:true});}
  this.identity=identity;this.config=c;this.descriptor=C.descriptor(entry.timing);this.connection=crypto.randomUUID();this.generation=crypto.randomUUID();this.sequence=0;this.pending=[];this.accepting=false;this.error='';this.values={};
  try{
   const before=this.clock(),sync=await this.rpc('clock'),after=this.clock();ok(Number.isFinite(sync?.now)&&after-before<250,'Could not synchronize the plugin clock. Try connecting again.');this.offset=(before+after)/2-sync.now;this.uncertainty=(after-before)/2;
   const result=await this.rpc('connect');await this.writeOff();this.snapshot(result);return this.state();
  }catch(e){this.fail(e.message);throw e;}
 });}
 async writeOff(){const values=Object.fromEntries(this.descriptor.outputs.map(k=>[k,false]));const result=await this.rpc('outputs',{values});ok(result?.ack===true,'Outputs were not acknowledged.');this.values=values;}
 async closeIO(){const id=this.identity?.id;this.accepting=false;this.connected=false;this.pending=[];this.connection=null;this.generation=null;this.values={};this.notify();if(id&&this.runtime.state(id).state==='running')try{await this.runtime.hardware(id,'disconnect',{});}catch(e){this.error='Disconnect failed: '+e.message;this.notify();}}
 disconnect(){return this.enqueue(()=>this.closeIO());}
 disconnectFor(id){if(!this.uses(id))return Promise.resolve();return this.disconnect();}
 lost(id,reason){if(this.identity?.id!==id||!this.connection)return;this.accepting=false;this.connected=false;this.pending=[];this.connection=null;this.generation=null;this.values={};this.error=reason;this.notify();}
 fail(reason){const id=this.identity?.id;this.lost(id,reason);this.enqueue(()=>this.closeIO()).catch(()=>{});}
 receive(id,e){
  if(id!==this.identity?.id||!this.connection||e.connection!==this.connection||e.generation!==this.generation){this.rejected++;return;}
  if(e.type==='timing-lost'){this.fail(String(e.reason||'Device disconnected.').slice(0,500));return;}
  if(!Number.isSafeInteger(e.sequence)||e.sequence<1||!Number.isFinite(e.at)||typeof e.on!=='boolean'||!C.channels(this.descriptor).some(x=>x.kind===e.kind&&x.channel===e.channel)){this.fail('Invalid timing sensor message.');return;}
  if(!this.accepting){if(this.pending.length<512)this.pending.push(e);else this.fail('Timing startup buffer overflow.');return;}
  if(!Number.isSafeInteger(e.sequence)||e.sequence<=this.sequence){this.rejected++;return;}
  try{
   ok(e.sequence===this.sequence+1,'Timing sensor sequence gap. Reconnect before continuing the race.');
   ok(C.channels(this.descriptor).some(x=>x.kind===e.kind&&x.channel===e.channel)&&typeof e.on==='boolean','Invalid timing sensor message.');
   const at=this.convertTime(e.at);ok(at>=this.lastAt,'Timing sensor messages arrived out of capture order.');this.sequence=e.sequence;this.lastAt=at;
   this.emit({type:'sample',connection:this.connection,generation:this.generation,kind:e.kind,channel:e.channel,on:e.on,at});
  }catch(x){this.fail(x.message);}
 }
 alive(){if(this.connected){this.lastAlive=this.clock();this.runtime.hardwarePulse(this.identity.id,this.connection,this.generation);}return this.state();}
 race(on,lanes,previous){return this.enqueue(async()=>{
  ok(typeof on==='boolean','Invalid race state.');
  if(!on){
   if(!this.reservation||previous!==this.reservation.lease)return this.state();
   this.reservation=null;
   if(this.connected)try{await this.writeOff();this.accepting=false;this.pending=[];this.sequence=0;this.generation=crypto.randomUUID();this.snapshot(await this.rpc('arm',{active:false,lanes:0}));}catch(e){this.fail(e.message);}
   this.notify();return this.state();
  }
  ok(this.selected()&&this.connected,'Connect the selected timing plugin first.');ok(Number.isInteger(lanes)&&lanes>0&&lanes<=this.config.lanes,'The plugin does not cover all race lanes.');
  ok(!this.reservation||previous===this.reservation.lease,'Another race owns this timing interface.');
  const old=this.reservation;
  try{
   await this.writeOff();this.accepting=false;this.pending=[];this.sequence=0;this.generation=crypto.randomUUID();
   const next={lease:crypto.randomUUID(),lanes,identity:clone(this.identity)};this.reservation=next;
   this.snapshot(await this.rpc('arm',{active:true,lanes}));return {lease:next.lease};
  }catch(e){this.reservation=old;this.fail(e.message);throw e;}
 });}
 outputs(wants,lease){return this.enqueue(async()=>{
  ok(this.connected&&this.reservation&&lease===this.reservation.lease&&this.selected(),'Race output ownership is no longer valid.');
  ok(wants&&typeof wants==='object'&&!Array.isArray(wants)&&Object.entries(wants).every(([k,v])=>C.roles.includes(k)&&typeof v==='boolean'),'Invalid race outputs.');
  const values=Object.fromEntries(this.descriptor.outputs.map(k=>[k,this.config.outputsOn&&wants[k]===true]));
  try{const r=await this.rpc('outputs',{values});ok(r?.ack===true,'Outputs were not acknowledged.');this.values=values;return {ack:true,values};}catch(e){this.fail(e.message);throw e;}
 });}
 simulate(event){return this.enqueue(async()=>{
  ok(this.connected&&this.descriptor.simulation,'Simulation controls require a connected simulated interface.');
  ok(event&&(['disconnect'].includes(event.kind)||C.channels(this.descriptor).some(x=>x.kind===event.kind&&x.channel===event.channel)&&typeof event.on==='boolean'),'Invalid simulated input.');
  return this.rpc('simulate',{event:{kind:event.kind,channel:event.channel,on:event.on}});
 });}
 reset(){this.reservation=null;return this.disconnect();}
 async shutdown(){clearInterval(this.watch);await this.reset();}
}
module.exports={TimingHost};
