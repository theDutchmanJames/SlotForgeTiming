// Recorded opponents run on the race clock, never through physical lane input.
(function(root) {
  const copy=x=>JSON.parse(JSON.stringify(x)), text=x=>String(x||'').slice(0,160), num=(v,d,min,max)=>Number.isFinite(Number(v))&&v!==''?Math.max(min,Math.min(max,Number(v))):d;
  const MAX_LAPS=100000;
  function clean(v={}) {
    return {name:text(v.name)||'Virtual Rival',trackId:text(v.trackId),trackName:text(v.trackName),laneLength:num(v.laneLength,0,0,100000),sourceId:text(v.sourceId),sourceDriverId:text(v.sourceDriverId),sourceHeat:text(v.sourceHeat),sourceName:text(v.sourceName),carName:text(v.carName),
      recording:(Array.isArray(v.recording)?v.recording:[]).slice(0,MAX_LAPS).filter(l=>l&&Number.isFinite(l.time)&&l.time>=1&&l.time<=86400000).map(l=>({time:l.time,lap:Math.max(1,Math.floor(Number(l.lap)||1)),pit:l.pit===true,invalid:l.invalid===true})),
      from:Math.floor(num(v.from,1,1,MAX_LAPS)),to:Math.floor(num(v.to,MAX_LAPS,1,MAX_LAPS)),includePits:v.includePits===true,speed:num(v.speed,100,80,120),end:['finish','repeat','reference'].includes(v.end)?v.end:'finish',reference:num(v.reference,8.5,.1,3600),mode:v.mode==='competitor'?'competitor':'comparison',canFinish:v.canFinish===true};
  }
  const sequence=v=>{const p=clean(v);return p.recording.filter(l=>!l.invalid&&(p.includePits||!l.pit)&&l.lap>=p.from&&l.lap<=p.to).map(l=>({...l,time:l.time*100/p.speed}));};
  function capture(session,laps,driverId,heat) {
    const s=session||{}, rows=(laps||[]).filter(l=>l.sessionId===s.id&&l.driverId===driverId&&!l.virtualRival&&(heat===undefined||String(l.heat||'')===String(heat))).sort((a,b)=>Number(a.lapNumber)-Number(b.lapNumber));
    const who=(s.heatResults||[]).find(h=>String(h.heat)===String(heat))?.rows?.find(x=>x.driverId===driverId)||(s.standings||[]).find(x=>x.driverId===driverId)||{};
    return {sourceId:s.id,sourceDriverId:driverId,sourceHeat:heat==null?'':String(heat),sourceName:who.driverName||'',trackId:s.trackId||'',trackName:s.trackName||'',carName:who.carName||'',from:1,to:rows.reduce((n,l)=>Math.max(n,Number(l.lapNumber)||1),1),recording:rows.map(l=>({lap:Number(l.lapNumber)||1,time:l.time,pit:!!l.pit,invalid:!!(l.invalid||l.redFlag||l.tooSlow||l.noPersonalBest||l.noTrackRecord)}))};
  }
  function issues(profile,trackId) {const p=clean(profile);return [!p.trackId?'Choose a saved recording with a track.':'',trackId&&p.trackId!==trackId?'This replay belongs to a different track.':'',p.from>p.to?'The first lap must not be later than the last lap.':'',!sequence(p).length?'Choose a range with at least one eligible lap.':''].filter(Boolean);}
  // Legacy lists contain driver IDs; new entries may override the driver's
  // default replay for this race setup without changing the database driver.
  const selection = raw => typeof raw === 'string' ? {driverId:raw,profileId:''} : {driverId:text(raw?.driverId),profileId:text(raw?.profileId)};
  function entries(ids,drivers,profiles,trackId) {
    const out=[],errors=[];
    const seen=new Set(),list=Array.isArray(ids)?ids:[];
    if(list.length>8)errors.push('Choose at most eight virtual drivers.');
    list.slice(0,8).map(selection).forEach(({driverId:id,profileId})=>{
      if(seen.has(id)){errors.push('Choose each virtual driver only once.');return;}seen.add(id);
      const d=drivers.find(x=>x.id===id),p=d&&profiles.find(x=>x.id===(profileId||d.virtualRivalSystem));
      if(!d||d.driverType!=='virtual'){errors.push('Choose a virtual driver from the database.');return;}
      if(!p){errors.push((d.name||'Virtual driver')+' needs a saved Rival Setup.');return;}
      const bad=issues(p,trackId);if(bad.length){errors.push(...bad.map(x=>(d.name||'Virtual driver')+': '+x));return;}
      out.push({driverId:d.id,driverName:d.name||'Virtual Rival',nickname:d.nickname||'',callsign:d.callsign||'',avatar:d.avatar||'',flag:d.flag||'',profileId:p.id,profile:clean(p)});
    });
    return {entries:out,errors};
  }
  const isDriver = (row,drivers) => drivers.some(d=>d.id===row?.driverId&&d.driverType==='virtual');
  function gridEntries(rows,drivers,profiles,trackId) {
    const result=entries(rows.filter(r=>!r.absent&&isDriver(r,drivers)).map(r=>({driverId:r.driverId,profileId:r.rivalProfileId||''})),drivers,profiles,trackId);
    return {...result,entries:result.entries.map(e=>({...e,grid:true}))};
  }
  // Keep row/lane identity, but never construct a physical car for a replay.
  // Bound configurations are also accepted when a viewer/resume reconstructs
  // an engine whose entries have already been split. Legacy extra rivals stay valid.
  function bindGrid(entries=[],rivals=[]) {
    const gridIds=new Set(rivals.filter(e=>e.grid).map(e=>e.driverId));
    const physical=entries.filter(e=>!gridIds.has(e.driverId));
    const virtualRivals=rivals.flatMap(e=>{
      if(!e.grid)return [e];
      const row=entries.find(r=>r.driverId===e.driverId);
      if(row)return [{...e,lane:row.lane,participant:row.participant}];
      return Number.isInteger(e.lane)&&e.lane>=0&&e.lane<8&&!physical.some(r=>r.lane===e.lane)?[e]:[];
    });
    return {entries:physical,virtualRivals};
  }
  function makeCar(entry,i) {return {driverId:entry.driverId,driverName:entry.driverName+' · Virtual',nickname:entry.nickname,callsign:entry.callsign,avatar:entry.avatar,flag:entry.flag,carName:entry.profile.carName,carId:'',participant:entry.participant??'rival:'+entry.driverId,lane:entry.grid&&Number.isInteger(entry.lane)&&entry.lane>=0&&entry.lane<8?entry.lane:-1-i,virtualRival:true,comparisonOnly:entry.profile.mode!=='competitor',profile:entry.profile,
    laps:[],bad:[],invalid:[],removed:[],pitLaps:[],pits:[],points:0,extraMs:0,specialLaps:0,adjMs:0,adjLaps:0,adjPoints:0,swapLost:0,repairs:[],pending:[],served:[],best:null,total:0,last:0,done:false,dq:false,retired:false,blockAt:null,place:0};}
  function attach(R,cfg) {
    const specs=(cfg.virtualRivals||[]).slice(0,8).filter(e=>e&&e.profile&&!issues(e.profile).length).map(e=>({...e,profile:clean(e.profile)}));
    R.rivals=specs.map(makeCar);
    if(!specs.length){R.displayStandings=()=>R.standings();return;}
    const sequences=specs.map(e=>sequence(e.profile));
    const next=(c,k)=>{const a=sequences[k],p=c.profile,n=c.laps.length;return n<a.length?a[n]:p.end==='repeat'?a[n%a.length]:p.end==='reference'?{time:p.reference*1000*100/p.speed,pit:false}:null;};
    const length=c=>c.profile.laneLength||cfg.distance?.lanes?.[0]?.length||cfg.compare?.lanes?.[0]?.length||0;
    const limit=c=>{
      if(cfg.type!=='race')return 0;
      if(!cfg.distance)return Number(cfg.laps)||0;
      if(cfg.distance.mode==='laps')return Number(cfg.distance.lanes?.[0]?.laps)||0;
      const laps=Number(cfg.distance.distance)/length(c);
      return Number.isFinite(laps)&&laps>0?Math.max(1,cfg.distance.round==='nearest'?Math.round(laps+1e-6):Math.ceil(laps-1e-6)):0;
    };
    const timed=(cfg.type==='timed'||cfg.type==='qualifying')?Number(cfg.duration)*60000:cfg.distance?Number(cfg.distance.max)*60000:0;
    // Only elapsed race time is authoritative. The profile is frozen in cfg;
    // restore and remote viewers can reconstruct exactly without wall-clock drift.
    R.syncRivals=(elapsed,allowFinish=false)=>{
      const el=Math.max(0,Number(elapsed)||0);let finishAt=Infinity;
      R.rivals.forEach((c,k)=>{if(el<c.total){R.rivals[k]=c=makeCar(specs[k],k);}let n;
        while(!c.done&&(n=next(c,k))&&c.total+n.time<=el+1e-7&&c.laps.length<MAX_LAPS){c.total+=n.time;c.laps.push(n.time);c.bad.push(false);if(n.pit)c.pitLaps.push(c.laps.length-1);else c.best=c.best===null?n.time:Math.min(c.best,n.time);c.last=R.t0+c.total;
          const reached=(limit(c)>0&&c.laps.length>=limit(c))||(timed>0&&c.total>=timed);
          if(reached)c.done=true;
          if(reached&&!c.comparisonOnly&&c.profile.canFinish&&cfg.endRule==='leader')finishAt=Math.min(finishAt,c.total);
        }
        if(!next(c,k)||c.laps.length>=MAX_LAPS)c.done=true;
      });
      if(allowFinish&&Number.isFinite(finishAt)&&R.status==='running'&&R.finishByRival){if(finishAt<el)R.syncRivals(finishAt,false);R.finishByRival(R.t0+finishAt);}
    };
    const tick=R.tick,cross=R.cross,start=R.start,pause=R.pause,stop=R.stop,restore=R.restore;
    R.start=t=>{if(start(t)===false)return false;R.rivals=specs.map(makeCar);};
    R.tick=t=>{if(R.status==='running')R.syncRivals(R.elapsed(t),true);tick(t);};
    R.cross=(i,t,o)=>{if(R.status==='running')R.syncRivals(R.elapsed(t),true);return cross(i,t,o);};
    R.pause=t=>{if(R.status==='running')R.syncRivals(R.elapsed(t),true);pause(t);};
    R.stop=t=>{if(R.status==='running')R.syncRivals(R.elapsed(t),false);stop(t);};
    R.restore=s=>{const ok=restore(s);if(ok)R.syncRivals(R.elapsed(R.status==='paused'?R.pausedAt:R.endAt),false);return ok;};
    R.displayStandings=()=>classify(R,R.standings());
  }
  function classify(R,physical) {
    if(!R.rivals?.length)return physical;
    const best=R.type==='practice'||R.type==='qualifying',all=physical.concat(R.rivals.map((car,i)=>({car,index:-1-i,pos:0,gap:''}))),comp=all.filter(x=>!x.car.comparisonOnly);
    const laps=c=>R.lapsOf(c),time=c=>R.timeOf(c),sum=(c,n)=>c.laps.slice(0,n).reduce((a,b)=>a+b,0)+(c.total-c.laps.reduce((a,b)=>a+b,0))+time(c)-c.total;
    // Preserve physical order (including sector/review decisions). Virtual rivals
    // are inserted using the same lap/time or best-lap measure.
    const ds=R.cfg.distance||R.cfg.compare,progress=c=>ds?laps(c)*(c.virtualRival?(c.profile.laneLength||ds.lanes?.[0]?.length||0):(ds.lanes?.find(l=>l.lane===c.lane)?.length||0)):laps(c);
    const compare=(a,b)=>Number(!!a.car.dq)-Number(!!b.car.dq)||Number(!!a.car.retired)-Number(!!b.car.retired)||(best?(a.car.best??Infinity)-(b.car.best??Infinity):progress(b.car)-progress(a.car)||time(a.car)-time(b.car));
    const sorted=physical.slice();for(const x of comp.filter(x=>x.car.virtualRival)){let i=sorted.findIndex(y=>compare(x,y)<0);if(i<0)i=sorted.length;sorted.splice(i,0,x);}
    const lead=sorted[0]?.car;
    const gapMs=c=>!best&&!ds&&lead&&c!==lead&&c.laps.length&&!c.dq&&!c.retired?Math.max(0,sum(c,c.laps.length)-sum(lead,c.laps.length)):null;
    const gap=c=>c.dq?'DQ':c.retired?'Out':!lead||c===lead?'':best?(c.best===null||lead.best===null?'':'+'+fmt(Math.max(0,c.best-lead.best))):ds?'+'+Math.max(0,progress(lead)-progress(c)).toFixed(1)+' m':c.laps.length?'+'+fmt(gapMs(c)):'';
    // If the physical leader is unchanged, retain the engine's precise gap
    // calculations, including distance interpolation and review adjustments.
    return sorted.map((x,i)=>({...x,pos:i+1,physicalPos:x.car.virtualRival?null:x.pos,gapMs:!x.car.virtualRival&&lead===physical[0]?.car?null:gapMs(x.car),gap:!x.car.virtualRival&&lead===physical[0]?.car?x.gap:gap(x.car)})).concat(all.filter(x=>x.car.comparisonOnly).map(x=>({...x,pos:'—',gapMs:gapMs(x.car),gap:gap(x.car)})));
  }
  const fmt=n=>{const m=Math.floor(n/60000),s=((n%60000)/1000).toFixed(3);return m?m+':'+s.padStart(6,'0'):s;};
  function summary(R,details=true) {return R.displayStandings().filter(x=>x.car.virtualRival).map(x=>({pos:x.pos,lane:x.car.lane,driverId:x.car.driverId,driverName:x.car.driverName,carName:x.car.carName,virtualRival:true,comparisonOnly:x.car.comparisonOnly,laps:x.car.laps.length,best:x.car.best,total:x.car.total,gap:x.gap,...(details?{profile:copy(x.car.profile),lapTimes:x.car.laps.slice(),pitLaps:x.car.pitLaps.slice()}:{})}));}
  function savedStandings(session) {
    if(!session.rivalClassification?.length)return session.standings||[];
    return session.rivalClassification.map(row=>{
      const source=(row.virtualRival?session.virtualRivals:session.standings)||[];
      const result=source.find(x=>!row.virtualRival&&row.physicalPos!=null?x.pos===row.physicalPos:x.driverId===row.driverId);
      return result?{...result,pos:row.pos,physicalPos:row.virtualRival?null:result.pos}:null;
    }).filter(Boolean);
  }
  function historyHtml(session) {
    const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const rows=session.rivalClassification?.length?savedStandings(session):(session.virtualRivals||[]).flatMap(x=>x.rivals?x.rivals.map(r=>({...r,heat:x.heat})):x);
    if(!rows.length)return '';
    return '<section class="vr-live-summary"><h4>'+ (session.rivalClassification?.length?'Race classification including virtual rivals':'Virtual rivals') +'</h4><p class="muted">Virtual rivals earn no physical records, mileage, heat or championship points. Physical-field standings remain separate.</p><div class="wrap"><table class="fields"><tr><th>Driver</th><th>Classification</th><th>Laps</th><th>Best lap</th><th>Total time</th></tr>'+rows.map(x=>`<tr><td>${escape(x.driverName)}${x.heat?' · Heat '+escape(x.heat):''}</td><td>${x.comparisonOnly?'Comparison':escape(x.pos)}</td><td>${escape(x.laps)}</td><td>${x.best==null?'–':fmt(x.best)}</td><td>${fmt(x.total+(x.penalty||0)+(x.adjMs||0))}</td></tr>`).join('')+'</table></div></section>';
  }
  const api={selection,clean,sequence,capture,issues,entries,isDriver,gridEntries,bindGrid,attach,classify,summary,savedStandings,historyHtml,MAX_LAPS};root.VirtualRival=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
