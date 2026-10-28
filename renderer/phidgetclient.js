// One native connection per main window. Test/demo events never enter the production bridge.
const ph = { initialized:false,opening:false,pending:[],backend:{},listeners:new Set(),logs:[],error:'' };
const phSettings=()=>Phidget.config(state.settings.phidget);
const phNotify=()=>ph.listeners.forEach(f=>f());
const phLog=text=>{ph.logs.push(text);if(ph.logs.length>300)ph.logs.shift();phNotify();};
function phInit(){
  if(ph.initialized||!api.onPhidget)return;ph.initialized=true;Phidget.link.configure(phSettings());
  api.phidgetState().then(v=>{ph.backend=v;phNotify();}).catch(e=>{ph.error=e.message;phNotify();});
  api.onPhidget(e=>{if(e.type==='state'){ph.backend=e;ph.error=e.error||'';if(!e.connected)Phidget.link.setConnected(false);phNotify();return;}
    const sample={...e,at:e.at-performance.timeOrigin};if(ph.opening){if(ph.pending.length<16384)ph.pending.push(sample);else{ph.error='Phidget startup buffer overflow.';api.phidgetClose().catch(()=>{});}return;}phFeed(sample);
  });
  Phidget.link.on(e=>phLog((e.at/1000).toFixed(3)+' s · '+(e.type==='call'?'Track call':'Lane '+(e.lane+1)+' · '+e.type)));
  // Main process stops the helper if this window can no longer service its heartbeat.
  setInterval(()=>{if(ph.backend.connected)api.phidgetAlive().catch(()=>{});},500);
}
function phFeed(e){if(e.type==='sample')Phidget.link.feed(e);else if(e.type==='tick')Phidget.link.tick(e.at);}
async function phConnect(){phInit();if(ph.opening)throw Error('Wait for the current Phidget operation.');if(Hardware.timingChosen(state.settings)!=='phidget')throw Error('Choose Phidget as the timing hardware in use first.');ph.opening=true;ph.pending=[];ph.error='';Phidget.link.configure(phSettings());try{ph.backend=await api.phidgetOpen(phSettings());if(ph.error)throw Error(ph.error);Phidget.link.setConnected(true);ph.opening=false;for(const e of ph.pending)phFeed(e);ph.pending=[];phLog('Phidget connected. Physical timing accuracy remains unverified.');return true;}catch(e){Phidget.link.setConnected(false);ph.error=e.message;throw e;}finally{ph.opening=false;ph.pending=[];phNotify();}}
async function phClose(){await api.phidgetClose();Phidget.link.setConnected(false);phNotify();}
async function phAutoConnect(){phInit();if(phSettings().autoConnect&&Hardware.timingChosen(state.settings)==='phidget'&&!Phidget.link.connected){try{await phConnect();}catch(e){phLog(e.message);}}}
