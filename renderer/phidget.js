// Phidget channel configuration and event processing. No renderer or native-library dependency.
(function (root) {
  const clone = v => JSON.parse(JSON.stringify(v));
  const sensor = () => ({ address: null, active: true, below: true, trigger: 1.5, clear: 2 });
  const defaults = () => ({ name: 'Phidget 1', autoConnect: false, lanes: 4, lap: Array.from({length:8}, sensor), pitMode: 'shared', pit: Array.from({length:8}, sensor), pitAsLap: false, trackcall: false, call: sensor(), outputsOn: false, outputs: [], rearm: 0 });
  function config(v) {
    const d = defaults(), object = x => x && typeof x === 'object' && !Array.isArray(x);
    if (object(v)) for (const k of Object.keys(d)) if (v[k] !== undefined) d[k] = clone(v[k]);
    // Old/incomplete backup data remains editable; missing addresses still prevent connection.
    for (const k of ['lap','pit']) d[k] = Array.from({length:8}, (_,i) => ({...sensor(), ...(object(d[k]?.[i]) ? d[k][i] : {})}));
    d.call = {...sensor(), ...(object(d.call) ? d.call : {})};
    d.outputs = Array.isArray(d.outputs) ? d.outputs.map(a => ({address:null,active:true,role:'master',...(object(a)?a:{})})) : [];
    return d;
  }
  const addressValid = a => a && Number.isInteger(a.serial) && a.serial > 0 && a.serial <= 2147483647 && Number.isInteger(a.channel) && a.channel >= 0 && a.channel < 128 && Number.isInteger(a.hubPort) && a.hubPort >= -1 && a.hubPort <= 63 && typeof a.hubDevice === 'boolean' && (!a.hubDevice || (a.hubPort>=0&&a.channel===0)) && ['digital','voltage','ratio','output'].includes(a.type);
  const key = a => addressValid(a) ? [a.serial,a.hubPort,a.hubDevice?1:0,a.type,a.channel].join(':') : '';
  const label = a => addressValid(a) ? `SN ${a.serial}${a.hubPort >= 0 ? ' · hub '+a.hubPort : ''} · ${a.type} ${a.channel}` : 'Choose a channel';
  const roles = lanes => [['master','Master track power'], ...Array.from({length:Math.max(1,Math.min(8,lanes||4))},(_,i)=>['relay'+(i+1),'Lane '+(i+1)+' power']), ...Array.from({length:5},(_,i)=>['start'+(i+1),'Start light '+(i+1)]), ['go','GO light'],['yellow','Yellow flag light'],['red','Red flag light'],['power','Power indicator'],['buzzer','Buzzer']];
  function assignments(c) {
    const a = [], n = Number.isInteger(c.lanes) ? Math.max(0,Math.min(8,c.lanes)) : 0;
    if (Array.isArray(c.lap)) c.lap.slice(0,n).forEach((s,lane)=>a.push({...s,kind:'lap',lane}));
    if (c.pitMode === 'separate' && Array.isArray(c.pit)) c.pit.slice(0,n).forEach((s,lane)=>a.push({...s,kind:'pit',lane}));
    if (c.trackcall) a.push({...c.call,kind:'call'});
    if (c.outputsOn && Array.isArray(c.outputs)) c.outputs.forEach(s=>a.push({...s,kind:'output'}));
    return a;
  }
  function validate(c) {
    const errors=[];
    if (!c || typeof c !== 'object') return ['Phidget settings are missing.'];
    if (typeof c.name !== 'string' || !c.name.trim() || c.name.length>60) errors.push('Give this interface a name of up to 60 characters.');
    if (!Number.isInteger(c.lanes)||c.lanes<1||c.lanes>8) errors.push('Choose one to eight lanes.');
    if (!['shared','separate','none'].includes(c.pitMode)) errors.push('Choose a pit detection mode.');
    for(const f of ['autoConnect','pitAsLap','trackcall','outputsOn']) if(typeof c[f]!=='boolean') errors.push('Invalid '+f+' setting.');
    if(!Number.isFinite(c.rearm)||c.rearm<0||c.rearm>1000) errors.push('Clear time must be between 0 and 1000 ms.');
    if(!Array.isArray(c.lap)||c.lap.length!==8||!Array.isArray(c.pit)||c.pit.length!==8||!Array.isArray(c.outputs)||c.outputs.length>32) return [...errors,'Invalid channel list.'];
    const used=new Set(), outputRoles=new Set(), hubModes=new Map();
    for(const a of assignments(c)) {
      const where=a.kind==='call'?'Track call':a.kind==='output'?'Output':'Lane '+(a.lane+1)+' '+a.kind;
      if(!addressValid(a.address)|| (a.kind==='output') !== (a.address.type==='output')) { errors.push(where+': choose a compatible channel.'); continue; }
      if(a.address.hubPort>=0){
        const port=a.address.serial+':'+a.address.hubPort;
        if(hubModes.has(port)&&hubModes.get(port)!==a.address.hubDevice)errors.push(where+': a hub port cannot be both a direct sensor/output and a connected VINT device.');
        hubModes.set(port,a.address.hubDevice);
      }
      const physical={...a.address,type:['voltage','ratio'].includes(a.address.type)?'voltage':a.address.type};
      const k=a.address.hubDevice?[a.address.serial,a.address.hubPort,'hub-port'].join(':'):key(physical); if(used.has(k)) errors.push(where+': this channel is already assigned. Use shared lap/pit mode or another channel.'); used.add(k);
      if(typeof a.active!=='boolean') errors.push(where+': select the active state.');
      if(a.kind==='output') { if(!roles(c.lanes).some(r=>r[0]===a.role)||outputRoles.has(a.role)) errors.push('Choose a unique function for each output.'); if(a.active!==true) errors.push('Phidget outputs must be wired inactive at API FALSE. Inverted outputs can energise when the library closes the channel.'); outputRoles.add(a.role); }
      else if(a.address.type!=='digital') { const max=a.address.type==='ratio'?1:5; if(typeof a.below!=='boolean'||![a.trigger,a.clear].every(v=>Number.isFinite(v)&&v>=0&&v<=max)||(a.below?a.trigger>=a.clear:a.trigger<=a.clear)) errors.push(where+': set separate detect and clear thresholds in the '+(max===1?'0–1 ratio':'0–5 V')+' range.'); }
    }
    return errors;
  }
  function createLink(o={}) {
    const listeners=new Set(),statuses=new Set(),observers=new Set(); let c=config(o.config), sensors=new Map(),hold=2000,last=-Infinity;
    const L={connected:false,power:null,config:c,counts:Array(8).fill(0),total:0,lastAt:null};
    const publish=(set,e)=>set.forEach(f=>{try{f(e);}catch(x){if(o.onError)o.onError(x);else console.error(x);}});
    L.on=f=>(listeners.add(f),()=>listeners.delete(f)); L.onStatus=f=>(statuses.add(f),()=>statuses.delete(f)); L.onSensor=f=>(observers.add(f),()=>observers.delete(f));
    L.configure=v=>{c=config(v);L.config=c;sensors.clear();last=-Infinity;};
    L.setConnected=v=>{v=!!v;if(v===L.connected)return;L.connected=v;L.power=null;sensors.clear();last=-Infinity;publish(statuses,v);};
    L.setPower=v=>{if(L.power===!!v)return;L.power=!!v;publish(statuses,L.connected);};
    L.setHold=ms=>{hold=Number.isFinite(ms)?Math.max(0,ms):2000;};
    L.rearm=(options={})=>{
      const keep=new Set(options.keepBlocked||[]);
      for(const a of assignments(c)){
        const st=sensors.get(key(a.address));if(!st)continue;
        if(keep.has(a.lane)&&st.on&&st.blocked)continue;
        st.armed=!st.on;st.accepted=false;st.blocked=false;
      }
    };
    L.clearMonitor=()=>{L.counts.fill(0);L.total=0;};
    L.sensorLevels=()=>assignments(c).filter(a=>['lap','pit','call'].includes(a.kind)).map(a=>({lane:a.lane,kind:a.kind,on:sensors.get(key(a.address))?.on??null,value:sensors.get(key(a.address))?.value??null,type:a.address?.type}));
    const presence=(a,on,at)=>publish(observers,{lane:a.lane,kind:a.kind,on,at});
    L.tick=at=>{if(!L.connected||!Number.isFinite(at))return;for(const a of assignments(c)){const st=sensors.get(key(a.address));if(a.kind==='lap'&&c.pitMode==='shared'&&st?.on&&st.accepted&&!st.blocked&&at-st.start>=hold){st.blocked=true;publish(listeners,{type:'block',lane:a.lane,at:st.start});}}};
    L.feed=e=>{
      if(!L.connected||!e||!Number.isFinite(e.at)||e.at<last)return false;
      const a=assignments(c).find(a=>a.kind!=='output'&&key(a.address)===e.key); if(!a||!Number.isFinite(e.value))return false;
      if(a.address.type==='digital'&&e.value!==0&&e.value!==1)return false;
      last=e.at;L.lastAt=e.at;let st=sensors.get(e.key),on;
      if(a.address.type==='digital')on=!!e.value===a.active;
      else on=a.below?(st?.on?e.value<a.clear:e.value<=a.trigger):(st?.on?e.value>a.clear:e.value>=a.trigger);
      if(!st){st={on,value:e.value,armed:!on,start:e.at,clearAt:on?null:e.at,accepted:false,blocked:false};sensors.set(e.key,st);presence(a,on,e.at);return true;}
      st.value=e.value;L.tick(e.at);
      if(on===st.on)return true;
      st.on=on;presence(a,on,e.at);
      if(on){st.start=e.at;st.accepted=st.armed&&st.clearAt!==null&&e.at-st.clearAt>=c.rearm;st.armed=false;st.blocked=false;
        if(st.accepted){if(a.kind==='lap'||(a.kind==='pit'&&c.pitAsLap)){L.counts[a.lane]++;L.total++;publish(listeners,{type:'hit',lane:a.lane,at:e.at,shared:a.kind==='lap'&&c.pitMode==='shared'});}if(a.kind==='pit'){st.blocked=true;publish(listeners,{type:'pit',lane:a.lane,in:true,at:e.at});}if(a.kind==='call')publish(listeners,{type:'call',at:e.at});}
      }else{if(st.blocked)publish(listeners,{type:a.kind==='pit'?'pit':'free',lane:a.lane,in:false,at:e.at});st.clearAt=e.at;st.armed=true;st.accepted=st.blocked=false;}
      L.tick(e.at);return true;
    };
    return L;
  }
  const api={defaults,config,addressValid,key,label,roles,assignments,validate,createLink,link:createLink()};root.Phidget=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
