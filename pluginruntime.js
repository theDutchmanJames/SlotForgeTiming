const fs=require('node:fs'),path=require('node:path');
const P=require('./pluginpackage'),{noLinks}=require('./pluginstore');
// Supervision is fault recovery, not an OS security boundary for trusted code.
class Runtime {
 constructor(store,launch,{disabled=false,canStart=()=>true,startMs=10000,heartbeatMs=4000,commandMs=5000,stopMs=1000}={}){
  Object.assign(this,{store,launch,disabled,canStart,startMs,heartbeatMs,commandMs,stopMs});this.workers=new Map();this.history=new Map();this.closing=false;this.counter=0;
  this.marker=path.join(store.root,'session-active.json');this.error=store.error;this.recovery=false;
  if(!this.error)try{noLinks(this.marker);this.recovery=fs.existsSync(this.marker);fs.writeFileSync(this.marker,JSON.stringify({started:new Date().toISOString()}));}catch(e){this.error='Plugin recovery marker unavailable: '+e.message;}
 }
 async boot(){if(this.disabled||this.recovery||this.error)return;for(const r of this.store.state.plugins){if(this.closing||!this.canStart())break;if(r.enabled){try{await this.start(r.current.manifest.id);}catch{}}}}
 state(id){const w=this.workers.get(id);return w?{state:w.phase,message:w.message,logs:w.logs.slice(),commandPending:!!w.pending}:this.history.get(id)||{state:'stopped',message:'',logs:[],commandPending:false};}
 list(){return {error:this.error,safeMode:this.disabled,recovery:this.recovery,plugins:this.store.state.plugins.map(r=>({...P.clone(r.current),previousVersion:r.previous?.manifest.version||'',enabled:r.enabled,...this.state(r.current.manifest.id)}))};}
 log(w,text){w.logs.push(String(text).slice(0,2000));if(w.logs.length>40)w.logs.shift();}
 async start(id,{recovery=false}={}){
  P.ok(!this.closing&&!this.disabled&&!this.error,this.error||'Plugins are off for this session.');P.ok(!this.workers.has(id),'Plugin is already active or stopping.');
  P.ok(this.canStart()||(recovery&&this.timing?.canRecover(id)),'Finish the race before starting plugins.');
  let init;try{init=this.store.verify(id);}catch(e){try{this.store.enable(id,false);}catch{}throw e;}
  this.store.enable(id,true);
  let child;try{child=this.launch(init);}catch(e){this.store.enable(id,false);throw e;}
  const w={child,phase:'starting',message:'Starting…',logs:[],last:Date.now(),window:Date.now(),count:0,bytes:0,stopping:false};this.workers.set(id,w);
  w.exited=new Promise(resolve=>w.exitResolve=resolve);
  const ready=new Promise((resolve,reject)=>{w.readyResolve=resolve;w.readyReject=reject;});
  const send=msg=>{try{child.postMessage(msg);}catch(e){this.fault(id,w,e.message);}};w.send=send;
  child.once('spawn',()=>{if(w.stopping)this.kill(w);else send({type:'init',...init});});
  child.on('error',e=>this.fault(id,w,'Plugin process error: '+String(e?.message||e).slice(0,500)));
  child.once('exit',code=>{
   if(this.workers.get(id)!==w)return;
   this.timing?.lost(id,'Plugin process exited.');this.clearDisplay(w,'Plugin stopped.');
   if(!w.stopping){w.phase='failed';w.message='Plugin exited unexpectedly ('+code+').';this.persistOff(id,w);}
   clearInterval(w.watch);clearTimeout(w.startTimer);clearTimeout(w.killTimer);clearTimeout(w.pending?.timer);
   w.readyReject(Error(w.message||'Plugin stopped before starting.'));w.pending?.reject(Error(w.message||'Plugin stopped.'));w.pending=null;
   this.history.set(id,{state:w.phase==='failed'?'failed':'stopped',message:w.message,logs:w.logs.slice(),commandPending:false});this.workers.delete(id);w.exitResolve();
  });
  const budget=bytes=>{const now=Date.now();if(now-w.window>=1000){w.window=now;w.count=w.bytes=0;}w.count++;w.bytes+=bytes;if(w.count>(init.manifest.timing?512:120)||w.bytes>(init.manifest.timing?131072:65536)){this.fault(id,w,'Plugin exceeded its message/log limit.');return false;}return !w.stopping;};
  for(const stream of [child.stdout,child.stderr])stream?.on('data',data=>{if(budget(data.length))this.log(w,data.toString());});
  child.on('message',m=>{
   if(this.workers.get(id)!==w||!budget(0)||!m||typeof m!=='object')return;
   if(m.type==='timing-input'||m.type==='timing-lost'){this.timing?.receive(id,m);return;}
   if(m.type==='heartbeat'){w.last=Date.now();return;}
   if(m.type==='ready'&&w.phase==='starting'){clearTimeout(w.startTimer);w.phase='running';w.message='Running';w.last=Date.now();w.readyResolve();return;}
   if(m.type==='fatal'){this.fault(id,w,String(m.message||'Plugin failed.').slice(0,2000));return;}
   if(m.type==='log'||m.type==='status'){const msg=typeof m.message==='string'?m.message.slice(0,2000):'';w.bytes+=Buffer.byteLength(msg);if(m.type==='status')w.message=msg;else this.log(w,msg);return;}
   if(m.type==='display-result'&&w.displayPending&&m.request===w.displayPending.id){const p=w.displayPending;clearTimeout(p.timer);w.displayPending=null;if(m.error)p.reject(Error(String(m.error).slice(0,2000)));else {let size;try{size=JSON.stringify(m.result).length;}catch{}if(!(size<=128000))p.reject(Error('Display response is too large.'));else p.resolve(m.result);}return;}
   if(m.type==='result'&&w.pending&&m.request===w.pending.id){const p=w.pending;clearTimeout(p.timer);w.pending=null;if(m.error)p.reject(Error(String(m.error).slice(0,2000)));else p.resolve(p.json?m.result:String(m.result??'').slice(0,2000));}
  });
  w.startTimer=setTimeout(()=>this.fault(id,w,'Plugin startup timed out.'),this.startMs);
  w.watch=setInterval(()=>{if(w.phase==='running'&&Date.now()-w.last>this.heartbeatMs)this.fault(id,w,'Plugin stopped responding.');},Math.min(500,this.heartbeatMs));
  return ready;
 }
 persistOff(id,w){try{this.store.enable(id,false);}catch(e){w.message+=' Could not save disabled state: '+e.message;this.error=w.message;}}
 kill(w){try{w.child.kill();}catch(e){this.log(w,'Could not terminate plugin: '+e.message);}}
 fault(id,w,message){if(w.stopping||this.workers.get(id)!==w)return;w.phase='failed';w.message=message;w.stopping=true;this.clearDisplay(w,message);this.timing?.lost(id,message);this.log(w,message);this.persistOff(id,w);w.readyReject(Error(message));w.pending?.reject(Error(message));clearTimeout(w.pending?.timer);w.pending=null;this.kill(w);}
 async stop(id,{disable=true}={}){
  await this.timing?.disconnectFor(id);
  let saveError;
  if(disable)try{this.store.enable(id,false);}catch(e){saveError=e;this.error='Could not save disabled plugin state: '+e.message;}
  const w=this.workers.get(id);if(!w){if(saveError)throw saveError;return;}
  this.clearDisplay(w,'Plugin stopped.');
  if(!w.stopping){w.stopping=true;w.phase='stopping';w.message='Stopped by user';w.send({type:'stop'});w.killTimer=setTimeout(()=>this.kill(w),this.stopMs);}
  let timer;try{await Promise.race([w.exited,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Plugin did not exit. Restart SlotForge with --disable-plugins.')),this.stopMs+3000);})]);}finally{clearTimeout(timer);}if(saveError)throw saveError;
 }
 command(id,command){
  const w=this.workers.get(id);P.ok(w?.phase==='running'&&!w.stopping,'Start the plugin first.');P.ok(!w.pending,'A plugin command is already running.');P.ok(this.store.get(id).current.manifest.commands.some(c=>c.id===command),'Unknown plugin command.');
  return new Promise((resolve,reject)=>{const request=++this.counter;w.pending={id:request,resolve,reject,timer:setTimeout(()=>this.fault(id,w,'Plugin command timed out.'),this.commandMs)};w.send({type:'command',command,request});});
 }
 hardware(id,operation,payload={},timeout=5000){
  const w=this.workers.get(id);P.ok(w?.phase==='running'&&!w.stopping,'Start the timing plugin first.');P.ok(!w.pending,'A plugin operation is already running.');
  return new Promise((resolve,reject)=>{const request=++this.counter;w.pending={id:request,resolve,reject,json:true,timer:setTimeout(()=>this.fault(id,w,'Timing plugin operation timed out: '+operation),timeout)};w.send({type:'hardware',operation,payload,request});});
 }
 hardwarePulse(id,connection,generation){const w=this.workers.get(id);if(w?.phase==='running'&&!w.stopping)w.send({type:'hardware-pulse',connection,generation});}
 prepareRule(id){
  const w=this.workers.get(id);P.ok(w?.phase==='running'&&!w.stopping,'Start the selected rule plugin in App Settings → Plugins first.');P.ok(!w.pending,'The rule plugin is busy.');
  return new Promise((resolve,reject)=>{const request=++this.counter;w.pending={id:request,resolve,reject,json:true,timer:setTimeout(()=>this.fault(id,w,'Race rule preparation timed out.'),2000)};w.send({type:'rule-prepare',request});});
 }
 clearDisplay(w,message){if(w.displayPending){clearTimeout(w.displayPending.timer);w.displayPending.reject(Error(message));w.displayPending=null;}}
 display(id,payload){
  const w=this.workers.get(id);P.ok(w?.phase==='running'&&!w.stopping,'Plugin is not running. Start it in App Settings → Plugins.');P.ok(!w.displayPending,'Plugin display is still busy.');P.ok(!w.displayFailed,'Display timed out. Restart the plugin outside a race.');
  return new Promise((resolve,reject)=>{const request=++this.counter;w.displayPending={id:request,resolve,reject,timer:setTimeout(()=>{w.displayFailed=true;this.clearDisplay(w,'Plugin display timed out.');},2000)};w.send({type:'display',request,payload});});
 }
 async disableAll(){let saveError;try{this.store.disableAll();}catch(e){saveError=e;this.error='Could not save disabled plugin states: '+e.message;}await Promise.all([...this.workers.keys()].map(id=>this.stop(id,{disable:false})));if(saveError)throw saveError;}
 shutdown(){
  if(this.shutdownPromise)return this.shutdownPromise;this.closing=true;
  this.shutdownPromise=(async()=>{await this.timing?.shutdown();const results=await Promise.allSettled([...this.workers.keys()].map(id=>this.stop(id,{disable:false})));if(results.every(r=>r.status==='fulfilled')&&!this.error){noLinks(this.marker);if(fs.existsSync(this.marker))fs.unlinkSync(this.marker);}})();return this.shutdownPromise;
 }
}
module.exports={Runtime};
