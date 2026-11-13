// DS timing transport and race adapter. No serial commands or hardware power control.
(function(root) {
  'use strict';
  const Protocol=typeof module!=='undefined'?require('./dsprotocol'):root.DsProtocol;
  const supported=model=>model==='ds200'||model==='ds300';
  const lanes=model=>model==='ds200'?2:model==='ds300'?8:0;
  function createLink(options={}) {
    const now=options.now||(()=>performance.now()), events=new Set(), statuses=new Set(), beforeFeed=new Set();
    let parser=null;
    const link={connected:false,model:'',packets:0,rejected:0};
    const report=options.onError||((error)=>console.error('DS observer failed:',error));
    const notify=(set,value)=>{for(const f of set){try{f(value);}catch(error){try{report(error);}catch(_){/* Reporting cannot block hardware cleanup. */}}}};
    link.beforeFeed=f=>{beforeFeed.add(f);return()=>beforeFeed.delete(f);};
    link.discardPartial=()=>{if(parser)parser.pending.length=0;};
    link.on=f=>{events.add(f);return()=>events.delete(f);};
    link.onStatus=f=>{statuses.add(f);return()=>statuses.delete(f);};
    link.setConnected=(on,model=link.model)=>{
      link.model=model;link.connected=!!on&&supported(model);
      parser=link.connected?new Protocol.FrameStream(model):null;link.packets=0;link.rejected=0;
      notify(statuses,link.connected);
    };
    link.feed=bytes=>{
      notify(beforeFeed);
      if(!parser)return [];
      const at=now(), decoded=parser.push(bytes);link.rejected=parser.rejectedCandidates;
      for(const e of decoded){link.packets++;notify(events,{...e,at});}
      return decoded;
    };
    return link;
  }
  function bind(o) {
    const {link}=o, model=o.model||link.model, seen=new Map();
    let engine=null, phase=null, previousStart=null, stopped=false;
    // A pause, a new heat or a recovered race invalidates the measured interval.
    // The first resumed crossing uses Timing's pause-adjusted clock; subsequent
    // uninterrupted intervals use the device measurement.
    function sync(){
      const next=o.engine(), state=o.phase();
      const changedEngine=next!==engine;
      if(changedEngine){seen.clear();engine=next;}
      if(changedEngine||state!==phase||next.t0!==previousStart){
        link.discardPartial();
        for(const v of seen.values())v.last=null;
        phase=state;previousStart=next.t0;
      }
    }
    sync();
    const offBeforeFeed=link.beforeFeed(sync);
    const active=()=>['running','countdown'].includes(o.phase());
    const fault=message=>{for(const v of seen.values())v.last=null;if(active())o.onFault(message);};
    const offStatus=link.onStatus(()=>{if(!link.connected||link.model!==model)fault('Connection lost or model changed. Check the DS box and reconnect the same model before resuming manually.');});
    const offEvent=link.on(e=>{
      if(stopped||!link.connected||link.model!==model)return;sync();
      if(e.kind==='control') {
        if(['end','pause','abort'].includes(e.action))fault('DS box reported '+e.action+'. Check the track and resume manually in Timing.');
        if(e.action==='start-phase-1')fault('DS timer restarted during the race. Check the results before resuming manually.');
        return; // A DS start or resume never starts Timing.
      }
      if(!['lap','first-crossing-marker'].includes(e.kind)||!link.connected||link.model!==model)return;
      const i=engine.cars.findIndex(c=>c.lane===e.lane-1&&!c.virtualRival), c=engine.cars[i];
      if(!c||c.done||(o.laneAllowed&&!o.laneAllowed(c.lane))){seen.delete(e.lane);return;}
      const previous=seen.get(e.lane);
      // restartCar replaces the lap list while retaining the car object.
      if(previous&&(previous.car!==c||previous.laps!==c.laps))seen.delete(e.lane);
      const old=seen.get(e.lane), marker=e.kind==='first-crossing-marker';
      if(old&&e.counter===old.counter){
        if(e.timeTicks!==old.ticks||marker!==old.marker)fault('Conflicting DS lap counter on lane '+e.lane+'. Check the lap history before resuming.');
        return;
      }
      const sample={counter:e.counter,ticks:e.timeTicks,marker,last:null,car:c,laps:c.laps};seen.set(e.lane,sample);
      if(o.phase()!=='running')return;
      if(old&&(marker||(e.counter-old.counter+10000)%10000!==1)) {
        fault('DS counter reset or missed crossing on lane '+e.lane+'. No missing laps were added; review before resuming.');return;
      }
      const measuredMs=!marker&&old&&old.last===c.last&&!c.resumed&&!c.redInterrupted&&e.timeTicks>0?e.timeTicks/10:undefined;
      if(!marker&&!(e.timeTicks>0)){fault('DS reported a zero lap time on lane '+e.lane+'. Check the sensor before resuming.');return;}
      // The marker is not a timed lap, even with a standing-start setup.
      const before={last:c.last,started:c.started,laps:c.laps.length};
      try{o.crossCar(i,e.at,false,{measuredMs,startOnly:marker});}
      catch(error){fault('DS crossing could not be processed. Review the lap history before resuming.');throw error;}
      // A buffered batch shares one arrival timestamp. A rejected crossing may
      // therefore equal c.last without actually advancing the engine.
      if(c.last===e.at&&(c.last!==before.last||c.started!==before.started||c.laps.length!==before.laps))sample.last=c.last; // rejected/manual/pit crossings cannot lend their interval to a later lap
    });
    return {sync,ready:()=>link.connected&&link.model===model&&o.lanes<=lanes(model),off(){stopped=true;offBeforeFeed();offEvent();offStatus();seen.clear();}};
  }
  const api={supported,lanes,createLink,bind,link:createLink()};
  root.DsTiming=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
