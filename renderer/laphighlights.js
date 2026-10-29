// Transient, lane-scoped presentation. No timing, layout or content mutations.
(function(root){
  const F=()=>typeof module!=='undefined'?require('./frame.js'):root.Frame;
  const keys=['lapEnabled','lapAppearance','lapSource','lapKeepRecords','lapIntensity','lapDuration','lapColor','lapPbColor','lapRecordColor'];
  function settings(w={},layout={}){
    const a=F().appearance(w,layout),saved={...layout.widgetAppearance,...w.appearance};
    // Old explicitly saved Lap Time colours remain meaningful. New widgets use
    // the shared defaults, and a new colour selection takes precedence.
    if(!Object.hasOwn(saved,'lapPbColor')&&F().hex(w.opt?.pbColor))a.lapPbColor=F().hex(w.opt.pbColor);
    if(!Object.hasOwn(saved,'lapRecordColor')&&F().hex(w.opt?.recordColor))a.lapRecordColor=F().hex(w.opt.recordColor);
    return a;
  }
  function eligible(c,index){return Number.isFinite(c.laps[index])&&!c.bad?.[index]&&!c.invalid?.includes(index)&&!c.removed?.includes(index)&&!c.swapLaps?.includes(index)&&!c.dq;}
  // Called after an accepted physical crossing, including a combined pit sensor.
  function record(c,before,live,base,at){
    if(c.laps.length<=before)return false;
    const index=c.laps.length-1,time=c.laps[index];let kind='';
    if(eligible(c,index)){
      const personal=c.driverId?Math.min(base.personal.get(c.driverId)??Infinity,live.bestBy.get(c.driverId)??Infinity):Infinity;
      const track=Math.min(base.track,live.bestAll);
      kind=Number.isFinite(track)&&time<track?'record':Number.isFinite(personal)&&time<personal?'pb':'';
      if(c.driverId)live.bestBy.set(c.driverId,Math.min(live.bestBy.get(c.driverId)??Infinity,time));
      if(time<live.bestAll){live.bestAll=time;live.bestAllName=c.driverName;}
    }
    live.flash.set(c,{at,time,kind,index});return true;
  }
  function eventFor(c,S){
    if(!Array.isArray(c?.laps))return null;
    const f=S.flashOf?.(c),index=c.laps.length-1;
    if(f&&Number.isFinite(f.at)&&f.time===c.laps[index]&&(f.index==null||f.index===index))return {...f,kind:eligible(c,index)?f.kind:'',key:[c.driverId,c.laps.length,f.at,f.time].join(':')};
    // Virtual replays have no physical sensor and cannot set database records.
    if(c.virtualRival&&index>=0)return {at:S.now,time:c.laps[index],kind:'',key:['virtual',c.driverId,c.laps.length,c.total].join(':')};
    return null;
  }
  const mounted=new WeakMap();
  function cancel(el){const m=mounted.get(el);if(m){m.animations.forEach(a=>a.cancel());m.layers.forEach(e=>e.remove());mounted.delete(el);}}
  function pulse(el,w,layout,kind='',age=0){
    const a=settings(w,layout);cancel(el);
    if(!a.lapEnabled||el?.nodeType!==1||!el.animate||age<0||age>=a.lapDuration)return;
    const lane=F().laneColour(w,layout),eventColour=kind==='record'?a.lapRecordColor:kind==='pb'?a.lapPbColor:a.lapColor;
    const colour=a.lapSource==='lane'&&lane&&!(a.lapKeepRecords&&kind)?lane:eventColour;
    const m={layers:[],animations:[]};mounted.set(el,m);
    for(const type of ['surface','glow']){
      if(a.lapAppearance!=='both'&&a.lapAppearance!==type)continue;
      const layer=el.ownerDocument.createElement('span');layer.className='lap-highlight lap-highlight-'+type;layer.setAttribute('aria-hidden','true');layer.style.setProperty('--lap-flash',colour);el.appendChild(layer);m.layers.push(layer);
      const peak=Math.min(1,a.lapIntensity/100*(type==='glow'?1.7:.65)),reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const frames=reduced?[{opacity:peak},{opacity:peak}]:[{opacity:0,offset:0},{opacity:peak,offset:.12},{opacity:peak*.6,offset:.38},{opacity:0,offset:1}];
      const animation=layer.animate(frames,{duration:a.lapDuration,easing:'ease-out'});animation.currentTime=age;m.animations.push(animation);
    }
    Promise.all(m.animations.map(a=>a.finished.catch(()=>{}))).then(()=>{if(mounted.get(el)===m)cancel(el);});
  }
  function dispose(n){for(const el of n.lapTargets||[])cancel(el);n.lapTargets?.clear();n.lapSeen?.clear();n.lapActive?.clear();}
  function update(n,S){
    const rows=n.w.type==='leaderboard',bound=Number.isInteger(n.w.lane)&&n.w.lane>=0;
    if(!rows&&!bound)return;
    const first=!n.lapSeen;n.lapSeen||=new Map();n.lapActive||=new Map();n.lapTargets||=new Set();
    for(const el of n.lapTargets)if(!el.isConnected){cancel(el);n.lapTargets.delete(el);}
    const hidden=root.document?.hidden||n.el.isConnected===false;
    const cars=rows?[...(S.eng?.cars||[]),...(S.eng?.rivals||[])]:[S.carByLane?.(n.w.lane)].filter(Boolean);
    for(const c of cars){
      const f=eventFor(c,S),previous=n.lapSeen.get(c.lane),key=f?.key||'';n.lapSeen.set(c.lane,key);
      if(hidden){n.lapActive.delete(c.lane);continue;}
      if(!first&&previous!==undefined&&key&&key!==previous)n.lapActive.set(c.lane,{...f,at:c.virtualRival?S.now:f.at});
      const active=n.lapActive.get(c.lane);
      if(!active)continue;
      const a=settings(n.w,n.layout);
      const age=S.now-active.at;
      if(age<0||age>=a.lapDuration||!a.lapEnabled||active.key!==key){n.lapActive.delete(c.lane);if(!a.lapEnabled){for(const el of n.lapTargets)cancel(el);n.lapTargets.clear();}continue;}
      const targets=rows?[...n.val.querySelectorAll('[data-lap-lane="'+c.lane+'"]')].flatMap(el=>el.tagName==='TR'?[...el.children]:[el]):[n.el];
      for(const el of targets){
        const token=active.key+':'+(f?.kind||'');
        if(el.dataset.lapPulse===token)continue;
        el.dataset.lapPulse=token;n.lapTargets.add(el);pulse(el,{...n.w,lane:c.lane},n.layout,f?.kind||'',age);
      }
    }
    if(hidden){for(const el of n.lapTargets)cancel(el);n.lapTargets.clear();}
  }
  const api={keys,settings,eligible,record,eventFor,pulse,cancel,update,dispose};root.LapHighlights=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
