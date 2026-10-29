// Shared, data-only timing-plugin contract. Sensor interpretation reuses Phidget's
// tested digital-level state machine; it does not require a Phidget device.
(function(root){
 const ok=(v,m)=>{if(!v)throw Error(m);},object=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const roles=['master','power','go','yellow','red','buzzer',...Array.from({length:5},(_,i)=>'start'+(i+1)),...Array.from({length:8},(_,i)=>'relay'+(i+1))];
 function descriptor(v){
  ok(object(v)&&Object.keys(v).every(k=>['api','label','channels','inputs','outputs','simulation'].includes(k)),'Invalid timing contribution.');
  ok(v.api===1&&typeof v.label==='string'&&v.label.trim()&&v.label.length<=80&&!/[<>\x00-\x1f]/.test(v.label),'Invalid timing API or label.');
  ok(Number.isInteger(v.channels)&&v.channels>=1&&v.channels<=8,'Timing plugins support one to eight input channels per kind.');
  ok(Array.isArray(v.inputs)&&v.inputs.includes('lap')&&v.inputs.every(x=>['lap','pit','call'].includes(x))&&new Set(v.inputs).size===v.inputs.length,'Invalid timing inputs.');
  ok(Array.isArray(v.outputs)&&v.outputs.every(x=>roles.includes(x))&&new Set(v.outputs).size===v.outputs.length,'Invalid timing outputs.');
  ok(typeof v.simulation==='boolean','Declare whether this is a simulated timing interface.');
  return {api:1,label:v.label.trim(),channels:v.channels,inputs:[...v.inputs],outputs:[...v.outputs],simulation:v.simulation};
 }
 function config(v={}){return {id:v.id||'',lanes:v.lanes??2,lapMap:v.lapMap||Array.from({length:8},(_,i)=>i),pitMap:v.pitMap||Array.from({length:8},(_,i)=>i),pitMode:v.pitMode||'shared',pitAsLap:v.pitAsLap??false,trackcall:v.trackcall??false,outputsOn:v.outputsOn??false,rearm:v.rearm??0};}
 function validateConfig(raw,d){
  ok(object(raw)&&Object.keys(raw).every(k=>Object.hasOwn(config(),k)),'Invalid timing configuration.');const c=config(raw);d=descriptor(d);
  ok(typeof c.id==='string'&&/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(c.id)&&c.id.length<=80,'Choose a timing plugin.');
  ok(Number.isInteger(c.lanes)&&c.lanes>=1&&c.lanes<=d.channels,'Choose lanes supported by the plugin.');
  ok(['shared','separate','none'].includes(c.pitMode)&&(!c.trackcall||d.inputs.includes('call'))&&(c.pitMode!=='separate'||d.inputs.includes('pit')),'Plugin does not support the chosen sensors.');
  for(const k of ['pitAsLap','trackcall','outputsOn'])ok(typeof c[k]==='boolean','Invalid '+k+' option.');
  ok(!c.outputsOn||d.outputs.length>0,'This plugin has no outputs.');
  ok(Number.isFinite(c.rearm)&&c.rearm>=0&&c.rearm<=1000,'Clear time must be 0–1000 ms.');
  for(const k of ['lapMap','pitMap']){ok(Array.isArray(c[k])&&c[k].length===8&&c[k].every(n=>Number.isInteger(n)&&n>=0&&n<8),'Invalid lane mapping.');if(k==='lapMap'||c.pitMode==='separate')ok(c[k].slice(0,c.lanes).every(n=>n<d.channels)&&new Set(c[k].slice(0,c.lanes)).size===c.lanes,'Assign each lane a unique supported channel.');}
  return JSON.parse(JSON.stringify(c));
 }
 const channelKey=(kind,channel)=>kind+':'+channel;
 const channels=d=>d.inputs.flatMap(kind=>Array.from({length:kind==='call'?1:d.channels},(_,channel)=>({kind,channel})));
 const address=(kind,channel)=>({serial:1,hubPort:-1,hubDevice:false,type:'digital',channel:kind==='call'?16:channel+(kind==='pit'?8:0)});
 function sensorConfig(c){return {name:'Plugin interface',lanes:c.lanes,lap:c.lapMap.map(n=>({address:address('lap',n),active:true})),pit:c.pitMap.map(n=>({address:address('pit',n),active:true})),call:{address:address('call',0),active:true},pitMode:c.pitMode,pitAsLap:c.pitAsLap,trackcall:c.trackcall,outputsOn:c.outputsOn,outputs:[],rearm:c.rearm};}
 const provenance=i=>i?{id:i.id,version:i.version,digest:i.digest,settingsDigest:i.settingsDigest,configuration:JSON.parse(JSON.stringify(i.configuration))}:null;
 const api={roles,descriptor,config,validateConfig,channels,channelKey,address,sensorConfig,provenance};
 root.TimingPlugin=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
