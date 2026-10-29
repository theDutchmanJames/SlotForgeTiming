// Trusted Node extension host. This process is isolated for failure recovery,
// not a security sandbox. It never exposes Electron/main-process objects.
const fs=require('node:fs'),path=require('node:path');
const port=process.parentPort;
const send=value=>{try{if(port)port.postMessage(value);else if(process.send)process.send(value);}catch{process.exit(1);}};
const listen=fn=>port?port.on('message',e=>fn(e.data)):process.on('message',fn);
let plugin=null,context=null,started=false,stopping=false,heartbeat=null,timing=null,display=null;
const bounded=v=>String(v??'').slice(0,2000);
const fatal=e=>{send({type:'fatal',message:bounded(e?.stack||e)});process.exit(1);};
process.on('uncaughtException',fatal);process.on('unhandledRejection',fatal);
listen(async message=>{
 try{
  if(message?.type==='init'&&!started){
   started=true;const {entry,dataDir,manifest,settings}=message;
   const storageFile=key=>{if(!/^[a-z][a-z0-9_-]{0,39}$/.test(key))throw Error('Invalid storage key.');return path.join(dataDir,key+'.json');};
   context=Object.freeze({id:manifest.id,version:manifest.version,settings:Object.freeze(settings),dataDir,
    log:text=>send({type:'log',message:bounded(text)}),status:text=>send({type:'status',message:bounded(text)}),
    storage:Object.freeze({get(key){const file=storageFile(key);if(!fs.existsSync(file))return null;if(fs.statSync(file).size>65536)throw Error('Storage item is too large.');return JSON.parse(fs.readFileSync(file,'utf8'));},set(key,value){const file=storageFile(key),json=JSON.stringify(value);if(!json||Buffer.byteLength(json)>65536)throw Error('Storage item is too large.');const tmp=file+'.tmp';fs.writeFileSync(tmp,json);fs.renameSync(tmp,file);}})});
   plugin=require(entry);
   if(manifest.rules&&typeof plugin.rules!=='function')throw Error('Missing race rule preparation function.');
   if(manifest.display){display=manifest.display;for(const kind of ['widgets','pages','tools'])for(const d of display[kind])if(typeof plugin[kind]?.[d.id]!=='function')throw Error('Missing '+kind+': '+d.id);}
   if(manifest.timing)timing=require('./plugintimingworker').create(plugin,context,manifest.timing,send);
   for(const c of manifest.commands)if(typeof plugin.commands?.[c.id]!=='function')throw Error('Missing declared command: '+c.id);
   if(plugin.activate)await plugin.activate(context);
   if(stopping)return;
   heartbeat=setInterval(()=>send({type:'heartbeat'}),500);send({type:'ready'});
  }else if(message?.type==='rule-prepare'&&plugin&&!stopping){
   try{const result=require('./renderer/ruleplugin').plan(await plugin.rules(context));send({type:'result',request:message.request,result});}catch(e){send({type:'result',request:message.request,error:bounded(e.message||e)});}
  }else if(message?.type==='display'&&display&&!stopping){
   try{
    const D=require('./renderer/plugindisplay'),p=message.payload;
    const freeze=v=>{if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;};
    const snapshot=freeze(p.snapshot||null);
    const invoke=async r=>{const d=display[r.kind]?.find(x=>x.id===r.item);if(!d)throw Error('Unknown display contribution.');return D.view(await plugin[r.kind][r.item](context,Object.freeze({settings:Object.freeze(D.inputs(d.settings,r.settings)),lane:r.lane??null,snapshot})));};
    const result=p.tool?await invoke(p.tool):await Promise.all(p.requests.map(invoke));
    if(JSON.stringify(result).length>128000)throw Error('Display batch exceeds 128 KB.');send({type:'display-result',request:message.request,result});
   }catch(e){send({type:'display-result',request:message.request,error:bounded(e.message||e)});}
  }else if(message?.type==='hardware-pulse'&&timing&&!stopping){timing.pulse(message);
  }else if(message?.type==='hardware'&&timing&&!stopping){
   try{const result=await timing.handle(message.operation,message.payload);send({type:'result',request:message.request,result});}catch(e){send({type:'result',request:message.request,error:bounded(e.message)});}
  }else if(message?.type==='command'&&plugin&&!stopping){
   const fn=plugin.commands?.[message.command];if(typeof fn!=='function')throw Error('Unknown plugin command.');
   try{const result=await fn(context);const text=typeof result==='string'?result:JSON.stringify(result??null);send({type:'result',request:message.request,result:bounded(text)});}catch(e){send({type:'result',request:message.request,error:bounded(e.message||e)});}
  }else if(message?.type==='stop'){
   stopping=true;clearInterval(heartbeat);if(timing)await timing.close();if(plugin?.deactivate)await plugin.deactivate(context);process.exit(0);
  }
 }catch(e){fatal(e);}
});
