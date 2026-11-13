// Digital level processing shared by timing plugins. No native hardware dependency.
(function(root){
  const key = address => typeof address === 'string' ? address : '';
  const sensor = () => ({address:null,active:true});
  function config(v={}){return {...v,lanes:v.lanes??2,lap:Array.from({length:8},(_,i)=>({...sensor(),...v.lap?.[i]})),pit:Array.from({length:8},(_,i)=>({...sensor(),...v.pit?.[i]})),call:{...sensor(),...v.call},pitMode:v.pitMode??'shared',pitAsLap:v.pitAsLap??false,trackcall:v.trackcall??false,rearm:v.rearm??0};}
  function assignments(c){const a=c.lap.slice(0,c.lanes).map((s,lane)=>({...s,kind:'lap',lane}));if(c.pitMode==='separate')a.push(...c.pit.slice(0,c.lanes).map((s,lane)=>({...s,kind:'pit',lane})));if(c.trackcall)a.push({...c.call,kind:'call'});return a;}
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
    L.sensorLevels=()=>assignments(c).filter(a=>['lap','pit','call'].includes(a.kind)).map(a=>({lane:a.lane,kind:a.kind,on:sensors.get(key(a.address))?.on??null,value:sensors.get(key(a.address))?.value??null,type:'digital'}));
    const presence=(a,on,at)=>publish(observers,{lane:a.lane,kind:a.kind,on,at});
    L.tick=at=>{if(!L.connected||!Number.isFinite(at))return;for(const a of assignments(c)){const st=sensors.get(key(a.address));if(a.kind==='lap'&&c.pitMode==='shared'&&st?.on&&st.accepted&&!st.blocked&&at-st.start>=hold){st.blocked=true;publish(listeners,{type:'block',lane:a.lane,at:st.start});}}};
    L.feed=e=>{
      if(!L.connected||!e||!Number.isFinite(e.at)||e.at<last)return false;
      const a=assignments(c).find(a=>a.kind!=='output'&&key(a.address)===e.key); if(!a||!Number.isFinite(e.value))return false;
      if(e.value!==0&&e.value!==1)return false;
      last=e.at;L.lastAt=e.at;let st=sensors.get(e.key),on;
      on=!!e.value===a.active;
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
  const api={key,createLink};root.DigitalInputs=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
