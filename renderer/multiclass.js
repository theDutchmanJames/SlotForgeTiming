// Classification is a view of the physical field. It never changes sensor events,
// lane indices, race clocks, pit work or the overall finish condition.
(function(root){
  const clone=x=>JSON.parse(JSON.stringify(x)), text=x=>String(x??'').trim().slice(0,100);
  const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const table=x=>(Array.isArray(x)?x:String(x||'').split(',')).filter(v=>String(v).trim()!=='').map(Number).filter(v=>Number.isFinite(v)&&v>=0&&v<=1000).slice(0,60);
  function cleanAssignments(rows){
    const used=new Set();return (Array.isArray(rows)?rows:[]).filter(r=>r&&text(r.driverId)&&text(r.classId)&&!used.has(text(r.driverId))&&used.add(text(r.driverId))).map(r=>({driverId:text(r.driverId),classId:text(r.classId)}));
  }
  const catalogue=(cars,defs)=>defs.filter(c=>cars.some(car=>car.raceClass===c.id));
  const driverClass=(p,id)=>p?.driverClasses?.find(r=>r.driverId===id)?.classId||'';
  function assignedClass(row,p,db){
    if(row.teamId){const ids=db.teams?.find(t=>t.id===row.teamId)?.drivers||[];
      const all=[...new Set([...ids,...(row.driverId?[row.driverId]:[])])].map(id=>driverClass(p,id));
      return all.length&&all[0]&&all.every(c=>c===all[0])?all[0]:'';
    }
    return driverClass(p,row.driverId);
  }
  const carsFor=(row,p,db)=>p?.assignment==='roster'?db.cars.filter(c=>c.raceClass===assignedClass(row,p,db)&&p.classes.some(k=>k.id===c.raceClass)):db.cars;
  function entryIssues(p,rows,db){
    if(p?.assignment!=='roster')return [];
    return rows.flatMap((r,i)=>{if(r.absent)return [];const cls=assignedClass(r,p,db),label=r.teamId?'Team '+(i+1):'Entry '+(i+1);
      if(!cls||!p.classes.some(c=>c.id===cls))return [label+(r.teamId?' needs every team driver assigned to the same selected class.':' needs a driver assigned to a selected class in the Multi-Class setup.')];
      const car=db.cars.find(c=>c.id===r.carId);return !car||car.raceClass!==cls?[label+' needs a slotcar labelled '+(p.classes.find(c=>c.id===cls)?.name||'with its assigned class')+'.']:[];
    });
  }
  function clean(raw={}) {
    const seen=new Set();
    return {name:text(raw.name)||'New Multi-Class System',classes:(Array.isArray(raw.classes)?raw.classes:[]).slice(0,24).filter(x=>x&&text(x.id)&&!seen.has(x.id)&&seen.add(x.id)).map(x=>({id:text(x.id),name:text(x.name),color:/^#[0-9a-f]{6}$/i.test(x.color)?x.color:'#63b9db',icon:['car','driver','layers','racesetups','none'].includes(x.icon)?x.icon:'car',points:table(x.points)})),
      assignment:['car','driver','team','roster'].includes(raw.assignment)?raw.assignment:'car',driverClasses:cleanAssignments(raw.driverClasses),heats:raw.heats==='separate'?'separate':'mixed',pointsMode:['overall','class','both'].includes(raw.pointsMode)?raw.pointsMode:'both',display:['overall','grouped'].includes(raw.display)?raw.display:'grouped',announcements:raw.announcements!==false};
  }
  function freeze(profile,definitions){
    if(!profile)return null;
    const p=clean(profile);p.classes=p.classes.map(c=>{const d=definitions.find(x=>x.id===c.id);return d?{...c,name:text(d.name),color:/^#[0-9a-f]{6}$/i.test(d.color)?d.color:c.color,icon:d.icon||'car'}:null;}).filter(Boolean);
    return p;
  }
  function resolve(row,p,db){
    if(!p)return '';
    if(p.assignment==='roster')return assignedClass(row,p,db);
    if(row.raceClass)return row.raceClass;
    const source=p.assignment==='team'?db.teams?.find(x=>x.id===row.teamId):p.assignment==='driver'?db.drivers?.find(x=>x.id===row.driverId):db.cars?.find(x=>x.id===row.carId);
    return source?.raceClass||'';
  }
  function validate(p,rows,setup={}){
    if(!p)return [];
    const errors=[];
    if(!p.classes.length)errors.push('Choose at least one class in the Multi-Class System.');
    rows.forEach((r,i)=>{if(!r.absent&&!p.classes.some(c=>c.id===r.raceClass))errors.push(`Entry ${i+1} needs a class included in this system.`);});
    if(p.heats==='separate'&&setup.finals&&setup.finals!=='none')errors.push('Separate class heats require finals to be off. Overall A/B finals mix classes; use mixed heats for that format.');
    return errors;
  }
  function splitSchedule(schedule,rows,p){
    if(!p||p.heats!=='separate')return schedule;
    return schedule.flatMap(h=>p.classes.map(c=>h.filter(e=>rows[e.p]?.raceClass===c.id)).filter(h=>h.length));
  }
  const out=c=>!!(c.dq||c.retired||c.damageOut||c.dmgOut||c.failOut);
  function decorate(rows,p,measure){
    if(!p)return rows;
    const by=new Map();
    return rows.map(x=>{const c=x.car||x,cls=!c.virtualRival&&p.classes.find(k=>k.id===(c.raceClass||x.raceClass));if(!cls)return x;
      const a=by.get(cls.id)||[];by.set(cls.id,a);const leader=a[0],v=measure?measure(x):{laps:c.laps,time:c.total,best:c.best};
      const z={...x,raceClass:cls.id,className:cls.name,classColor:cls.color,classIcon:cls.icon,classPos:out(c)?null:a.length+1,classBest:c.best??null,classGap:null};
      if(!out(c)){if(!leader)z.classGap={kind:'leader',value:0};else if(v.bestMode)z.classGap=Number.isFinite(v.best)&&Number.isFinite(leader.v.best)?{kind:'time',value:Math.max(0,v.best-leader.v.best)}:null;
        else z.classGap=v.laps!==leader.v.laps?{kind:'laps',value:Math.max(0,leader.v.laps-v.laps)}:Number.isFinite(v.time)&&Number.isFinite(leader.v.time)?{kind:'time',value:Math.max(0,v.time-leader.v.time)}:null;
        a.push({v});}
      return z;
    });
  }
  function attach(R,cfg){
    if(!cfg.multiclass)return;
    R.multiclass=clean(cfg.multiclass);
    R.cars.forEach(c=>{const cls=R.multiclass.classes.find(x=>x.id===c.raceClass);if(cls)Object.assign(c,{className:cls.name,classColor:cls.color});});
    R.classStandings=()=>{
      const rows=decorate(R.standings(),R.multiclass,x=>({laps:R.lapsOf(x.car),time:R.timeOf(x.car),best:x.car.best,bestMode:R.type==='practice'||R.type==='qualifying'}));
      if(R.distance||R.compare)rows.forEach(x=>{if(x.classPos>1){const leader=rows.find(y=>y.raceClass===x.raceClass&&y.classPos===1);const v=leader?R.distanceGapTo(x.car,leader.car):null;x.classGap=Number.isFinite(v)?{kind:'time',value:v}:null;}});
      const pts=scoreHeat(rows.map(x=>({...x.car,pos:x.pos,laps:R.lapsOf(x.car),adjPoints:R.adjOf(x.car).points})),R.multiclass,cfg.classPoints||[],cfg.classFastestBonus||0);
      return rows.map(x=>{const times=rows.filter(y=>y.raceClass===x.raceClass&&!out(y.car)&&Number.isFinite(y.car.best)&&y.car.best>0).map(y=>y.car.best);return {...x,classBest:times.length?Math.min(...times):null,classPoints:R.multiclass.pointsMode==='overall'||!cfg.classPoints?.length?null:pts.find(y=>y.lane===x.car.lane)?.points??null};});
    };
    const display=R.displayStandings?.bind(R)||R.standings.bind(R);
    R.displayStandings=()=>{const cls=new Map(R.classStandings().map(x=>[x.car,x]));return display().map(x=>cls.has(x.car)?{...cls.get(x.car),...x,classPos:cls.get(x.car).classPos,classGap:cls.get(x.car).classGap}:x);};
  }
  function scoreHeat(rows,p,points,bonus=0){
    return p.classes.flatMap(cls=>{const pool=rows.filter(r=>r.raceClass===cls.id),eligible=pool.filter(r=>!out(r)),best=eligible.filter(r=>Number.isFinite(r.best)&&r.best>0).sort((a,b)=>a.best-b.best)[0],pt=cls.points.length?cls.points:points;
      return pool.map(r=>{const pos=eligible.indexOf(r)+1;return {...r,overallPos:r.pos,pos:pos||pool.indexOf(r)+1,classPos:pos||null,points:pos?(pt[pos-1]||0)+(r.adjPoints||0)+(r===best?bonus:0):0,bonus:r===best?bonus:0};});});
  }
  function heatStandings(H,cfg,extra,create){
    const p=cfg.multiclass;if(!p)return [];
    const main=new Map(H.overall(extra).map(x=>[x.participant,x.pos]));
    return p.classes.flatMap(cls=>{
      // Reuse the existing dropped/best/average heat and final scoring rules.
      const C=create({...cfg,resultBy:cfg.classResultBy||cfg.resultBy,points:cfg.classPointsTable||cfg.points,multiclass:null});C.idx=H.idx;C.finalPlan=H.finalPlan;
      C.results=(extra?H.results.concat([extra]):H.results).map(h=>({...h,rows:scoreHeat(h.rows,p,cfg.classPointsTable||cfg.points||[],H.scoring.fastestBonus).filter(r=>r.raceClass===cls.id)}));
      const rows=C.overall().filter(r=>r.raceClass===cls.id),kind=C.kind(rows),lead=rows[0]?.score,best=rows.filter(r=>!r.dq&&Number.isFinite(r.best)&&r.best>0).map(r=>r.best);
      let place=0;return rows.map((r,i)=>({...r,classPos:r.dq?null:++place,className:cls.name,classColor:cls.color,classIcon:cls.icon,classPoints:p.pointsMode==='overall'?null:r.scorePoints,classBest:best.length?Math.min(...best):null,classGap:r.dq?null:i===0?{kind:'leader',value:0}:Number.isFinite(r.score)&&Number.isFinite(lead)?{kind,value:Math.max(0,kind==='time'?r.score-lead:lead-r.score)}:null,overallPos:main.get(r.participant)}));
    });
  }
  function scopedSession(s,id){
    if(!s?.multiclass?.classes?.some(c=>c.id===id))return {...s,standings:[],classScope:id};
    const source=s.classStandings?.length?s.classStandings:s.standings||[];
    return {...s,classScope:id,standings:source.filter(r=>r.raceClass===id&&!r.virtualRival).map((r,i)=>({...r,pos:r.classPos||i+1}))};
  }
  // A compact finished-event view. Send totals, not a second full lap history,
  // to viewers; the last heat's engine does not represent the whole field.
  function eventRows(H,people,laps,spent,extras=new Map()){
    const S=typeof module!=='undefined'?require('./stats.js'):root.Stats;
    const rows=H.overall(),classes=H.classOverall(),kind=H.kind(rows),lead=rows[0]?.score;
    return rows.map(r=>{
      const p=people[r.participant]||{},mine=laps.filter(l=>p.asTeam?l.teamId===p.teamId:l.driverId===p.driverId&&(!p.carId||l.carId===p.carId));
      const valid=mine.filter(l=>!l.invalid&&!l.tooSlow&&!l.late&&l.time>0),times=valid.map(l=>l.time),extra=extras.get(r.participant);
      const cls=classes.find(c=>c.participant===r.participant),gap=r.pos===1?{kind:'leader',value:0}:Number.isFinite(r.score)&&Number.isFinite(lead)?{kind,value:Math.max(0,kind==='time'?r.score-lead:lead-r.score)}:null;
      return {...p,dq:!!r.dq,retired:!!r.retired,participant:r.participant,pos:r.pos,aggregate:true,lane:r.participant,driverName:p.asTeam?p.teamName:p.driverName,
        raceClass:r.raceClass,className:cls?.className,classColor:cls?.classColor,classIcon:cls?.classIcon,classPos:cls?.classPos,classPoints:cls?.classPoints,classBest:cls?.classBest,classGap:cls?.classGap,gap:r.pos===1?'':gapText(gap),
        resultStats:{laps:r.laps,total:spent.find(x=>x[0]===r.participant)?.[1]??null,best:r.best,average:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,consistency:S.consistency(valid.filter(l=>!l.pit).map(l=>l.time)),penalties:extra?.pen||0,invalid:mine.filter(l=>l.invalid).length,pit:mine.filter(l=>l.pit).length}};
    });
  }
  function view(rows,mode,id){
    if(mode==='class')return rows.filter(x=>(x.raceClass||x.car?.raceClass)===id).sort((a,b)=>(a.classPos||999)-(b.classPos||999));
    if(mode==='grouped')return rows.slice().sort((a,b)=>(a.className||'~').localeCompare(b.className||'~')||(a.classPos||999)-(b.classPos||999));
    return rows;
  }
  const gapText=g=>!g?'—':g.kind==='leader'?'Class leader':g.kind==='laps'?`+${g.value} lap${g.value===1?'':'s'}`:g.kind==='points'?`−${Math.round(g.value*100)/100} pts`:g.kind==='distance'?`+${Math.round(g.value*100)/100} m`:`+${(g.value/1000).toFixed(3)}`;
  const badge=x=>x?.className?`<span class="mc-badge" style="--mc:${esc(x.classColor)}">${x.classIcon&&x.classIcon!=='none'&&root.Icons?root.Icons.svg(x.classIcon,{size:14}):''}${esc(x.className)}</span>`:'';
  function resultsHtml(rows,p,winners=false){
    if(!p)return '';
    const lists=p.classes.map(cls=>({cls,rows:rows.filter(r=>(r.raceClass||r.car?.raceClass)===cls.id)})).filter(g=>g.rows.length);
    return `<section class="mc-results"><h3>${winners?'Class winners':'Class classification'}</h3><div class="mc-results-grid">${lists.map(({cls,rows})=>{const list=winners?rows.filter(x=>x.classPos===1&&(Array.isArray(x.car?.laps)?x.car.laps.length:Number(x.laps))>0).slice(0,1):rows;return `<article style="--mc:${esc(cls.color)}"><h4>${esc(cls.name)}</h4>${list.length?list.map(x=>`<div class="mc-result-row"><b>${x.classPos||'—'}. ${esc(x.car?.driverName||x.teamName||x.driverName)}</b><span>${winners?'Class winner':gapText(x.classGap)}</span>${Number.isFinite(x.classPoints)&&p.pointsMode!=='overall'?`<strong>${x.classPoints} class points</strong>`:''}</div>`).join(''):'No classified finisher'}</article>`;}).join('')}</div></section>`;
  }
  const api={clean,catalogue,driverClass,assignedClass,carsFor,entryIssues,freeze,resolve,validate,splitSchedule,decorate,attach,scoreHeat,heatStandings,scopedSession,eventRows,view,gapText,badge,resultsHtml,table};root.MultiClass=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
