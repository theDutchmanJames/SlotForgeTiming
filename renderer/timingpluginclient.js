// Only the main window subscribes. Capture timestamps are converted from the
// host's synchronized monotonic epoch into this renderer's performance clock.
const pt={initialized:false,backend:{},listeners:new Set(),logs:[],link:Phidget.createLink(),identity:null,eventVersion:0,inputs:new Map()};
const ptNotify=()=>pt.listeners.forEach(f=>f());
function ptInit(){
 if(pt.initialized||!api.onPluginTiming)return;pt.initialized=true;
 api.pluginTimingList().then(m=>{if(!pt.eventVersion){pt.backend=m;ptNotify();}}).catch(e=>{pt.backend.error=e.message;ptNotify();});
 api.onPluginTiming(e=>{
  pt.eventVersion++;
  if(e.type==='state'||e.type==='snapshot'){
   pt.backend=e;pt.identity=e.identity;
   if(!e.connected){pt.inputs.clear();pt.link.setConnected(false);}
   if(e.type==='snapshot'){
    pt.link.configure(TimingPlugin.sensorConfig(e.config));pt.link.setConnected(true);
    pt.inputs.clear();for(const v of e.inputs){pt.inputs.set(TimingPlugin.channelKey(v.kind,v.channel),v.on);pt.link.feed({key:Phidget.key(TimingPlugin.address(v.kind,v.channel)),value:v.on?1:0,at:e.at-performance.timeOrigin});}
   }
   ptNotify();return;
  }
  if(e.type==='sample'&&e.connection===pt.backend.connection&&e.generation===pt.backend.generation){
   pt.inputs.set(TimingPlugin.channelKey(e.kind,e.channel),e.on);pt.link.feed({key:Phidget.key(TimingPlugin.address(e.kind,e.channel)),value:e.on?1:0,at:e.at-performance.timeOrigin});
  }
 });
 pt.link.on(e=>{pt.logs.push(`${(e.at/1000).toFixed(3)} s · ${e.type==='call'?'Track call':'Lane '+(e.lane+1)+' · '+e.type}`);if(pt.logs.length>80)pt.logs.shift();ptNotify();});
 setInterval(()=>{if(pt.link.connected)pt.link.tick(performance.now());},50);
 setInterval(()=>{if(pt.backend.connected)api.pluginTimingAlive().catch(e=>{pt.backend.error=e.message;pt.link.setConnected(false);ptNotify();});},400);
}
async function ptConnect(){ptInit();return api.pluginTimingConnect(state.settings.pluginTiming);}
async function ptClose(){await api.pluginTimingClose();pt.link.setConnected(false);}
