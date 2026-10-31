// Records measured completion times independently of the race clock (which pauses).
// No network requests, DOM work or configuration changes occur on a crossing.
(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.PaddockRace=value;})(globalThis,()=>{
  const clone=x=>JSON.parse(JSON.stringify(x));
  function attach(engine,journal,id,clock=()=>Date.now(),toWall=()=>clock()){
    if(!journal)return engine;
    let heat=journal.heats.find(h=>h.id===id);
    const ensure=()=>heat||(heat={id,name:'Heat '+id,startedAt:clock(),endedAt:null,entries:[],crossings:{}},journal.heats.push(heat),heat);
    const driverAt=(c,n)=>{
      const stint=(c.en?.stints||[]).findLast(s=>n>=s.l0),driverId=stint?.d||c.driverId||'guest';
      return {driverId,driverName:(c.roster||[]).find(d=>d.id===driverId)?.name||c.driverName||'Guest'};
    };
    const start=engine.start,cross=engine.cross;
    engine.start=function(...args){const answer=start.apply(this,args);if(engine.status==='running'){const h=ensure();h.startedAt=toWall(args[0]);h.endedAt=null;h.crossings={};h.entries=engine.cars.map(c=>({carId:c.carId||'',driverId:c.driverId||'guest',driverName:c.driverName||'Guest',lane:c.lane+1}));}return answer;};
    engine.cross=function(...args){
      const c=engine.cars[args[0]],count=c?.laps.length,before=engine.status;
      const answer=cross.apply(this,args);
      if(c&&c.laps.length>count){
        // Resolve at completion, after any engine-triggered swap, while original lap indices still exist.
        const h=ensure(),key=String(c.lane),list=h.crossings[key]||(h.crossings[key]=[]);list[c.laps.length-1]={at:toWall(args[1]),...driverAt(c,c.laps.length-1)};
      }
      if(before!=='finished'&&engine.status==='finished'&&ensure().endedAt==null)heat.endedAt=clock();
      return answer;
    };
    const removeLap=engine.removeLap;
    engine.removeLap=function(i,n,recalc){
      const c=engine.cars[i],count=c?.laps.length;
      // Upgrade existing checkpoints before their original indices change.
      if(c)ensure().crossings[String(c.lane)]?.forEach((crossing,index)=>{if(crossing&&!crossing.driverId)Object.assign(crossing,driverAt(c,index));});
      const result=removeLap.call(this,i,n,recalc);
      if(c&&c.laps.length<count)ensure().crossings[String(c.lane)]?.splice(n,1);
      return result;
    };
    for(const method of ['tick','stop']){const original=engine[method];engine[method]=function(...args){const before=engine.status,result=original.apply(this,args);if(before!=='finished'&&engine.status==='finished')ensure().endedAt=clock();return result;};}
    engine.paddockReview=(driverAtLap)=>{
      const h=ensure();h.endedAt=h.endedAt||clock();
      h.entries=engine.cars.map(c=>({carId:c.carId||'',driverId:h.entries.find(e=>e.lane===c.lane+1)?.driverId||c.driverId||'guest',driverName:h.entries.find(e=>e.lane===c.lane+1)?.driverName||c.driverName||'Guest',lane:c.lane+1,
        changes:engine.events.filter(e=>e.type==='swapdone'&&e.lane===c.lane&&Number.isFinite(e.paddockAt)).map(e=>({at:e.paddockAt,driverId:e.to,driverName:e.toName})),
        laps:c.laps.map((time,n)=>({number:n+1,time,at:h.crossings[String(c.lane)]?.[n]?.at,
          driverId:h.crossings[String(c.lane)]?.[n]?.driverId||driverAtLap?.(c,n)||c.driverId||'guest',driverName:h.crossings[String(c.lane)]?.[n]?.driverName||(c.roster||[]).find(d=>d.id===(driverAtLap?.(c,n)||c.driverId))?.name||c.driverName||'Guest',
          removed:c.removed.includes(n),valid:!c.bad[n]&&!c.invalid.includes(n)&&!(c.redLaps||[]).includes(n),pit:(c.pitLaps||[]).includes(n)}))}));
      return clone(h);
    };
    return engine;
  }
  return {attach};
});
