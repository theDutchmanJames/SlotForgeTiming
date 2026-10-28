// Read-only Pit Stops overviews. Event indexing is incremental and bounded;
// mounting a widget never creates events, starts timers or changes race rules.
(function(root) {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const CATEGORIES=[['damage','Damage and failures','#ed777b'],['penalty','Penalties','#edbf45'],['fuel','Fuel','#45bf88'],['tyres','Tyres','#ba96fa'],['flags','Flags and track calls','#edce65'],['pits','Pit stops and swaps','#65bde6'],['weather','Weather','#6ba6f0'],['resources','Resources','#d5aa78'],['systems','System switches','#b3b9c4']];
  const TYPES=new Set(['needsattention','recentevents']);
  const lane={key:'lanes',label:'Show lanes',type:'select',default:'all',choices:[['all','All lanes'],...Array.from({length:8},(_,i)=>[String(i),'Lane '+(i+1)])]};
  const options=type=>[{...lane},{key:'maxItems',label:type==='needsattention'?'Maximum alerts shown':'Maximum recent events shown',type:'number',default:6,min:1,max:20,step:1},
    {key:'details',label:'Show supporting detail',type:'checkbox',default:true},{key:'laneLabels',label:'Show lane numbers',type:'checkbox',default:true},
    ...(type==='recentevents'?[{key:'timestamps',label:'Show race elapsed time',type:'checkbox',default:true}]:[{key:'raceFlag',label:'Show current race flag',type:'checkbox',default:true}]),
    ...CATEGORIES.filter(([key])=>type==='recentevents'||key!=='systems').map(([key,label])=>({key:'show'+key,label:'Include '+label.toLowerCase(),type:'checkbox',default:true}))];
  const bound=(v,d,min,max)=>Number.isFinite(Number(v))?Math.min(max,Math.max(min,Math.round(Number(v)))):d;
  const selected=(lane,opt)=>opt.lanes===undefined||opt.lanes==='all'||String(lane)===String(opt.lanes);
  const enabled=(e,key,fallback)=>e.systemEnabled?e.systemEnabled(key):!!fallback;
  const tone=category=>CATEGORIES.find(c=>c[0]===category)?.[2]||'#aab3be';
  const tyreName=(e,code)=>e.cfg?.tyrewear?.tyres?.[code]?.name||code||'';
  const clock=ms=>Number.isFinite(ms)?Math.floor(Math.max(0,ms)/60000).toString().padStart(2,'0')+':'+Math.floor(Math.max(0,ms)/1000%60).toString().padStart(2,'0'):'—';
  const flagName=flag=>flag==='red'?'Red flag · race paused':flag==='yellow'?'Yellow flag · caution':'Green flag';
  const pitDetail=(action,laps)=>{const job=action==='dq'?'disqualification':action==='retire'?'retirement':'repair';return laps!==null&&laps!==undefined?(laps<=0?'Pit now':'Pit within '+laps+' laps')+' · '+job:'Pit for '+job;};
  function attention(S,opt={}) {
    const e=S.eng,rows=[],now=e.status==='paused'?e.pausedAt:e.status==='finished'?e.endAt:S.now;
    if(['ready','finished'].includes(e.status))return {rows,total:0,flag:'',status:e.status};
    const add=(car,category,title,detail,priority=1)=>{if(opt['show'+category]!==false&&selected(car.lane,opt))rows.push({lane:car.lane,name:car.driverName||'Driver',category,title,detail,priority});};
    for(const [i,c] of e.cars.entries()) {
      if(c.virtual||c.virtualRival||c.done||c.dq||c.retired)continue;
      if(enabled(e,'damage',e.damage)) {
        const d=e.damageOf?.(i,now),f=e.failureOf?.(i,now);
        if(d?.points>0)add(c,'damage',d.name||'Damage recorded',d.action?`${d.points} damage points · ${pitDetail(d.action,d.lapsLeft)}`:`${d.points} damage points`,d.urgent?3:2);
        if(f?.active)add(c,'damage',f.name||'Car failure',pitDetail(f.action,f.lapsLeft),f.urgent?3:2);
      }
      // Turning a system off prevents new penalties; assigned stops still apply.
      if((c.pending||[]).length) {
        const pending=c.pending,seconds=pending.reduce((n,p)=>n+(p.kind==='stopgo'?Number(p.seconds)||0:0),0);
        add(c,'penalty',pending.length===1?pending[0].name||'Pit penalty to serve':pending.length+' pit penalties to serve',seconds>0?seconds+' seconds · not yet served':'Drive through the pits',2);
      }
      if(enabled(e,'fuel',e.fuel?.on)) {
        const litres=e.fuelOf(i,now),tank=e.tankOf?e.tankOf(i):e.fuel.tank,pct=100*litres/tank;
        if(Number.isFinite(litres)&&litres!==null&&tank>0&&pct<=25)add(c,'fuel',pct<=0?'Fuel tank empty':`Low fuel · ${Math.max(0,Math.round(pct))}%`,c.pit&&c.pit.systemJobs?.fuel!==false?'Refuelling in progress':'Plan a fuel stop',pct<=10?3:1);
      }
      if(enabled(e,'tyrewear',e.tyrewear)&&Number.isFinite(c.twLife)&&c.twLife<=Math.max(e.tyrewear.warn,e.tyrewear.crit))add(c,'tyres',c.twLife<=0?'Tyres worn out':`Tyre life · ${Math.max(0,Math.round(c.twLife))}%`,tyreName(e,c.tyre)+' tyres · change '+(c.twLife<=e.tyrewear.crit?'now':'soon'),c.twLife<=e.tyrewear.crit?3:1);
      if(enabled(e,'tyrewear',e.tyrewear)) {
        const temperature=e.temperatureOf?.(i,now);
        if(temperature?.state==='hot'&&temperature.multiplier>1)add(c,'tyres','Tyres overheating',`${Math.round(temperature.value)}°C · wear ×${temperature.multiplier.toFixed(2)}`,2);
      }
      // Mandatory stops remain a race obligation even if wear is switched off.
      const mandatory=e.mandOf?.(i);
      if(mandatory&&!mandatory.ok&&!mandatory.judged)add(c,'tyres','Mandatory tyre stop outstanding',`${mandatory.stops} of ${mandatory.need} stops completed${!mandatory.tyresOk?' · compound requirement not met':''}`,1);
      if(enabled(e,'weather',e.weather)) {
        const weather=e.wxOf?.(i),left=c.wxDue?Math.max(0,c.wxDue.lap-c.laps.length):null;
        if(weather?.need)add(c,'weather','Weather tyre change required',`${weather.need==='wet'?'Wet':'Dry'} tyres needed${left===null?'':left===0?' · pit now':` · within ${left} laps`}`,left===0?3:2);
      }
      const swap=e.enLook?.(i,now);
      if(swap&&(swap.soon||swap.due||swap.overdue))add(c,'pits',swap.overdue?'Driver swap overdue':swap.due?'Driver swap due':'Driver swap approaching',swap.lost?'Laps no longer count until the swap':swap.next?'Next: '+(c.roster?.find(d=>d.id===swap.next)?.name||swap.next):'Choose the next driver',swap.overdue?3:swap.due?2:1);
      if(c.pit) {
        const jobs=new Set(Object.entries(c.resourceBlocks||{}).filter(([,at])=>at===c.blockAt).map(([job])=>job));
        if(c.resourceBlocked)jobs.add(c.resourceBlocked);
        for(const job of jobs)if((job==='damage'&&c.dmg>0)||(job==='failure'&&c.fail)||job.startsWith('tyre:'))add(c,'resources','Service blocked · resources exhausted',job.startsWith('tyre:')?'No available '+tyreName(e,job.slice(5))+' tyre set':job==='failure'?'Failure repair needs stock':'Damage repair needs stock',3);
        const hold=e.pitHoldOf?.(i,now);
        if(hold?.randomHold||c.rndPitExit&&(e.sharedPitExitHeld??e.pitExitHeld?.()))add(c,'pits','Pit exit held','Wait until the Random Flag ends',2);
        else if(hold?.ready)add(c,'pits',e.status==='paused'?'Service complete · race paused':hold.mode==='manual'?'Ready for director release':'Service Stop ready',e.status==='paused'?'Wait for the race to resume':hold.text,2);
      }
      for(const call of e.calls||[])if(call.open&&call.car===i)add(c,'flags','Track call waiting','Awaiting the Race Director',2);
    }
    rows.sort((a,b)=>b.priority-a.priority||a.lane-b.lane);
    return {rows,total:rows.length,flag:opt.raceFlag!==false&&opt.showflags!==false&&['running','paused'].includes(e.status)&&['red','yellow'].includes(e.flag)?e.flag:'',status:e.status};
  }
  function describe(event,compound=code=>code||'') {
    const x=event,n=Number(x.points)||0,seconds=v=>Number.isFinite(v)?(v/1000).toFixed(1)+' s':'';
    switch(x.type) {
      case 'damage': return ['damage',x.delta<0?'Damage reduced':'Damage recorded',n+' damage points'+(x.name?' · '+x.name:'')];
      case 'failure': return ['damage',x.name||'Car failure','Pit service required'];
      case 'repaired': return ['damage','Damage repaired',x.name||'Repair completed'];
      case 'failurerepaired': case 'failurecleared': return ['damage','Failure cleared',x.name||''];
      case 'damageout': case 'failureout': return ['damage',x.how==='dq'?'Driver disqualified':'Car retired',x.name||''];
      case 'damagelate': case 'failurelate': return ['damage','Repair deadline missed',x.name||'Pit now'];
      case 'repairearly': case 'failureearly': return ['damage','Repair unfinished',x.name||'Left the pits early'];
      case 'penalty': return ['penalty',x.delta<0?'Penalty points reduced':'Penalty points added',n+' points total'];
      case 'assigned': return ['penalty','Penalty assigned',x.name||''];
      case 'served': return ['penalty','Penalty served',x.name||''];
      case 'forgiven': return ['penalty','Penalty forgiven',x.name||''];
      case 'leftearly': return ['penalty','Penalty not completed',x.name||'Left the pits early'];
      case 'disqualified': return ['penalty','Driver disqualified',x.why==='unserved'?'Unserved penalty':''];
      case 'reinstated': return ['penalty','Driver reinstated',''];
      case 'fuelwarning': return ['fuel',x.level===2?'Fuel critical':'Low fuel',Math.max(0,Math.round(x.percent))+'% remaining'];
      case 'fuelrecovered': return ['fuel',x.level===0?'Fuel warning cleared':'Fuel level improving',Math.max(0,Math.round(x.percent))+'% remaining'];
      case 'outoffuel': return ['fuel','Fuel tank empty',''];
      case 'retired': return [x.why==='tyres'?'tyres':'fuel','Car retired',x.why==='tyres'?'Tyres worn out':'Fuel tank empty'];
      case 'tyrelevel': return ['tyres','Tyre life warning',compound(x.tyre)+' tyres · '+Math.round(x.life)+'% life'];
      case 'tyreworn': return ['tyres','Tyres worn out',compound(x.tyre)];
      case 'tyrefresh': return ['tyres','New tyres fitted',compound(x.tyre)+' tyres · 100% life'];
      case 'tyreset': return ['tyres','Tyres changed',compound(x.tyre)];
      case 'tyres': return ['tyres','Weather tyres fitted',compound(x.tyre)];
      case 'tyrequeue': return ['tyres',x.tyre?'Tyre change queued':'Tyre choice reset',compound(x.tyre)];
      case 'tyrelast': return ['tyres','Last tyre set fitted',compound(x.tyre)];
      case 'mandatory': return x.ok?null:['tyres','Mandatory tyre rule missed',(x.stops||0)+' of '+(x.need||0)+' stops completed'+(x.how?' · '+x.how+' consequence':'')];
      case 'tyreearly': return ['tyres','Tyre change unfinished','Left the pits early'];
      case 'tyrenone': return ['tyres','No tyre set available',compound(x.asked||x.tyre)];
      case 'tyredue': return ['tyres','Tyre stop due',compound(x.tyre)];
      case 'raceflag': return ['flags',x.flag==='red'?'Red flag raised':x.flag==='yellow'?'Yellow flag raised':'Green flag · racing resumed',x.by==='random'?'Random Flag':x.by==='call'?'Track call':x.by==='resume'?'Race resumed':'Race Director'];
      case 'yellowfast': return ['flags','Too fast under yellow',seconds(x.ms)+' · target '+seconds(x.target)+(x.points?' · '+x.points+' penalty points':'')];
      case 'redlap': return ['flags','Lap invalidated · red flag','Excluded from best laps and records'];
      case 'safetycar': return ['flags',x.out?'Safety Car deployed':'Safety Car withdrawn',''];
      case 'randomsoon': return ['flags','Random Flag approaching',''];
      case 'call': return ['flags','Track call requested','Awaiting the Race Director'];
      case 'callend': return ['flags','Track call resolved',x.how==='penalty'?'Penalty assigned':'Dismissed'];
      case 'pitstart': return ['pits','Entered the pits',''];
      case 'pitend': return ['pits','Left the pits',seconds(x.duration)+(x.refuelled>0?' · '+Number(x.refuelled).toFixed(1)+' L added':'')];
      case 'pitrelease': return ['pits','Service Stop released',x.early?'Released early':'Service completed'];
      case 'swapdone': return ['pits','Driver swap completed',x.fromName+' → '+x.toName];
      case 'swapsoon': case 'swapdue': case 'swaplate': return ['pits',x.type==='swapsoon'?'Driver swap approaching':x.type==='swapdue'?'Driver swap due':'Driver swap overdue',x.stop?'Laps no longer count':x.nextName?'Next: '+x.nextName:''];
      case 'swapshort': return ['pits','Minimum driving requirement missed',x.points?x.points+' penalty points':''];
      case 'resourceblocked': return ['resources','Service blocked · resources exhausted',(x.missing||[]).map(k=>k==='repair'?'repair credits':k==='component'?'replacement components':k.startsWith('tyre:')?'tyre set '+compound(k.slice(5)):k).join(', ')];
      case 'systemtoggle': return ['systems',({fuel:'Fuel',penalty:'Penalties',damage:'Damage and failures',safetycar:'Safety Car',tyrewear:'Tyre Wear',weather:'Weather',pushsave:'Push & Save',bop:'Balance of Power'}[x.system]||'Race system')+(x.enabled?' enabled':' disabled'),'Existing obligations are retained'];
      case 'weather': return ['weather','Weather changed',x.state||''];
      default:return null;
    }
  }
  // One index per engine. Viewers replace arrays but preserve the unchanged prefix.
  // Keep only the newest 50 entries per category/lane, rather than rescanning laps.
  const indexes=new WeakMap();
  function recent(S,opt={}) {
    const e=S.eng,events=e.events||[];let index=indexes.get(e);
    if(!index||events.length<index.length||(index.length&&events[index.length-1]!==index.last))index={length:0,last:null,buckets:new Map()};
    const changed=events.length!==index.length||!index.rows;
    for(let i=index.length;i<events.length;i++) {
      const event=events[i];if(!event||typeof event!=='object')continue;
      // The engine records the compound change and fresh life together. Present one stop.
      const next=events[i+1];if(event.type==='tyres'&&next?.type==='tyrefresh'&&next.car===event.car&&next.t===event.t)continue;
      const d=describe(event,code=>tyreName(e,code));if(!d)continue;
      const c=e.cars[event.car],candidate=Number.isInteger(event.lane)?event.lane:c?.lane,lane=Number.isInteger(candidate)&&candidate>=0&&candidate<8?candidate:-1;
      const row={category:d[0],title:d[1],detail:d[2],lane,name:event.driverName??c?.driverName??'',raceMs:Number.isFinite(event.raceMs)?event.raceMs:null,sequence:i};
      const key=row.category+':'+lane,list=index.buckets.get(key)||[];list.push(row);if(list.length>50)list.shift();index.buckets.set(key,list);
    }
    index.length=events.length;index.last=events.at(-1);indexes.set(e,index);
    if(changed)index.rows=[...index.buckets.values()].flat().sort((a,b)=>(b.raceMs??-Infinity)-(a.raceMs??-Infinity)||b.sequence-a.sequence);
    const rows=[],limit=bound(opt.maxItems,6,1,20);let total=0;
    // Multiple widgets share the sorted index; unchanged paint frames never re-sort history.
    for(const row of index.rows)if(opt['show'+row.category]!==false&&(row.lane<0||selected(row.lane,opt))){total++;if(rows.length<limit)rows.push(row);}
    return {rows,total,status:e.status};
  }
  function html(type,m,opt={}) {
    const limit=bound(opt.maxItems,6,1,20),rows=m.rows.slice(0,limit),events=type==='recentevents';
    const items=rows.map(row=>`<div class="pcw-row" style="--pcw-tone:${tone(row.category)}">${events&&opt.timestamps!==false?`<time>${clock(row.raceMs)}</time>`:''}${opt.laneLabels!==false&&row.lane>=0?`<span class="pcw-lane">${row.lane+1}</span>`:''}<div class="pcw-message"><strong>${esc(row.name?row.name+' · ':'')}${esc(row.title)}</strong>${opt.details!==false&&row.detail?`<small>${esc(row.detail)}</small>`:''}</div></div>`).join('');
    const empty=events?'No matching events yet':m.status==='ready'?'Ready to start':m.status==='finished'?'Race finished · no active alerts':'No active alerts';
    return `<div class="pcw" data-total="${m.total}" role="group" aria-label="${events?'Recent Events':'Needs Attention'}"><div class="pcw-meta">${!events&&m.flag?`<span class="pcw-flag pcw-${m.flag}">${flagName(m.flag)}</span>`:`<span>${events?'Newest first':m.total+' active'}</span>`}</div><div class="pcw-rows">${items||`<div class="pcw-empty">${empty}</div>`}</div><small class="pcw-more"${m.total<=rows.length?' hidden':''}>+${Math.max(0,m.total-rows.length)} more</small></div>`;
  }
  function content(type,S,opt={}) {return {html:html(type,type==='needsattention'?attention(S,opt):recent(S,opt),opt)};}
  function fit(n) {
    const frame=root.Frame,box=n.val.querySelector('.pcw');if(!box)return;
    const rows=[...box.querySelectorAll('.pcw-row')],more=box.querySelector('.pcw-more'),total=Number(box.dataset.total)||0;
    rows.forEach(row=>row.hidden=false);
    const update=count=>{more.hidden=total<=count;more.textContent='+'+Math.max(0,total-count)+' more · enlarge widget to see more';};
    let count=rows.length;update(count);frame.fit(n.el,{...n.w,layoutKind:'pitcontrol'});
    while(count>0&&n.el.dataset.fitStatus==='too-small'){rows[--count].hidden=true;update(count);frame.fit(n.el,{...n.w,layoutKind:'pitcontrol'});}
  }
  const api={TYPES,CATEGORIES,options,attention,recent,describe,html,content,fit,clock};root.PitWidgets=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
