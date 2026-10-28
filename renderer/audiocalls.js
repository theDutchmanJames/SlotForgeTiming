// Audio catalogue extensions and read-only observations. Race rules remain in the engine.
(function(root) {
  const numeric = (v, fallback, lo, hi) => v === '' || v == null || !Number.isFinite(Number(v)) ? fallback : Math.max(lo, Math.min(hi, Number(v)));
  const SETTINGS = {
    fuelLow: [25, 1, 99], fuelReset: [50, 2, 100], fuelRange: [3, 0.1, 100], fuelSamples: [5, 3, 20],
    paceLaps: [2, 1, 20], paceHysteresis: [0.2, 0, 10], summaryEvery: [5, 1, 1000], summarySeconds: [60, 5, 3600],
    spokenDecimals: [2, 2, 3], queueAge: [12, 0, 120]
  };
  const cleanSettings = s => Object.fromEntries(Object.entries(SETTINGS).map(([k,[d,lo,hi]]) => [k, numeric(s && s[k],d,lo,hi)]));
  const definitions = [
    ['resourceblocked','Resource Systems','Service blocked by exhausted supplies',['driver','resourcejob','resource','resourceowner'],'{driver}, {resourcejob} is waiting. Not enough {resource} for {resourceowner}.'],
    ['servicestart','Pits & Service Stop','Service Stop started',['driver','servicetotal'],'{driver}, service stop started. {servicetotal}.'],
    ['servicecountdown','Pits & Service Stop','Service countdown',['driver','serviceremaining'],'{driver}, {serviceremaining} remaining.'],
    ['serviceready','Pits & Service Stop','Ready to leave the pits',['driver'],'{driver}, your stop is complete. You may leave the pits.'],
    ['serviceearly','Pits & Service Stop','Released early',['driver'],'{driver} was released before the stop timer finished.'],
    ['pitheld','Pits & Service Stop','Pit exit held',['driver','releasecondition'],'{driver}, hold in the pits. {releasecondition}.'],
    ['pitclear','Pits & Service Stop','Pit exit hold lifted',['driver'],'{driver}, the Safety Car pit exit hold has lifted.'],
    ['fuelrange','Fuel Systems','Fuel range warning',['driver','fuellaps'],'{driver}, about {fuellaps} laps of fuel remaining.'],
    ['fuelfinish','Fuel Systems','Insufficient fuel to finish',['driver','fuellaps','lapsremaining'],'{driver}, about {fuellaps} laps of fuel for {lapsremaining} laps remaining.'],
    ['penaltyconsequence','Penalty Systems','Penalty points and consequence',['driver','pointsadded','pointstotal','penaltytime','penaltylaps','requiredstop','consequence'],'{driver}, {pointsadded} penalty points added, {pointstotal} in total. {consequence}.'],
    ['penaltyupgrade','Penalty Systems','Unserved pit penalty upgraded',['driver','requiredstop'],'{driver}, your unserved pit penalty is now {requiredstop}.'],
    ['safetyout','Flags & Safety Car','Safety Car deployed',[],'Safety Car deployed.'],
    ['safetyin','Flags & Safety Car','Safety Car in',[],'Safety Car in.'],
    ['redlap','Flags & Safety Car','Red-flag lap excluded',['driver','lap','reason'],'{driver}, lap {lap} is excluded from best laps because of the red flag.'],
    ['restart','Flags & Safety Car','Restart countdown',[],'Prepare for the restart countdown.'],
    ['tyreunavailable','Tyre Wear Systems','Requested tyre unavailable',['driver','requestedtyre'],'{driver}, {requestedtyre} tyres are unavailable.'],
    ['tyrefallback','Tyre Wear Systems','Fallback tyre fitted',['driver','requestedtyre','tyre'],'{driver}, {tyre} tyres fitted instead of {requestedtyre}.'],
    ['mandatorydue','Tyre Wear Systems','Mandatory stop outstanding',['driver','stopsremaining','requirement'],'{driver}, {requirement}.'],
    ['mandatorymet','Tyre Wear Systems','Mandatory stop requirements met',['driver'],'{driver}, mandatory stop requirements met.'],
    ['mandatorymissed','Tyre Wear Systems','Mandatory stop missed',['driver','consequence'],'{driver}, mandatory stop requirements were not met. {consequence}.'],
    ['weatherdue','Weather Systems','Weather tyre-change deadline',['driver','tyre','deadline'],'{driver}, change tyres within {deadline} laps.'],
    ['pushstate','Push & Save Systems','Entered Push',['driver','pace','pacedelta'],'{driver} is pushing.'],
    ['savestate','Push & Save Systems','Entered Save',['driver','pace','pacedelta'],'{driver} is saving.'],
    ['normalstate','Push & Save Systems','Returned to Normal',['driver','pace'],'{driver} is back to normal pace.'],
    ['systemchanged','Race control','Race System switched',['system','enabled'],'{system} switched {enabled}.'],
    ['reinstated','Race control','Driver reinstated',['driver'],'{driver} is reinstated.'],
    ['lapinvalid','Race control','Lap invalidated',['driver','lap'],'{driver}, lap {lap} is invalid.'],
    ['laprestored','Race control','Lap validity restored',['driver','lap'],'{driver}, lap {lap} is valid again.'],
    ['resultsfinal','Results & championship','Results finalised',[],'The results are now final.'],
    ['resultcorrected','Results & championship','Classification corrected',[],'The classification has changed during review.'],
    ['classleader','Multi-Class Racing','New class leader',['driver','classname'],'{driver} leads {classname}.'],
    ['classwinner','Multi-Class Racing','Confirmed class winner',['driver','classname'],'{driver} wins {classname}.'],
    ['finalwinner','Results & championship','Confirmed winner',['driver'],'The confirmed winner is {driver}.'],
    ['roundpoints','Results & championship','Championship points awarded',['driver','roundpoints','championshippoints','championshipposition'],'{driver}, {roundpoints} points this round. {championshippoints} championship points in total.'],
    ['champleader','Results & championship','New championship leader',['driver','championshippoints'],'{driver} leads the championship with {championshippoints} points.'],
    ['champwinner','Results & championship','Championship winner',['driver','championshippoints'],'{driver} wins the championship with {championshippoints} points.'],
    ['heatpoints','Results & championship','Heat points awarded',['driver','heatpoints'],'{driver}, {heatpoints} heat points.'],
    ['hardwarelost','Timing hardware','Timing connection lost',['interface'],'{interface} connection lost. Timing is unavailable.'],
    ['hardwareback','Timing hardware','Timing connection restored',['interface'],'{interface} connection restored.'],
    ['laptime','Laps & records','Selected lap times',['driver','time','lap'],'{driver}, lap {lap}, {time}.'],
    ['racesummary','Progress & milestones','Driver race summary',['driver','lapscompleted','position','gapleader'],'{driver}, {lapscompleted} laps, in {position} place.'],
    ['weathersummary','Weather Systems','Conditions on request',['weather','tracktemp','airtemp','windspeed','winddir'],'Conditions: {weather}. Track {tracktemp}, air {airtemp}, wind {windspeed} from {winddir}.']
  ];
  const GROUPS = {'Start':'Start & session','Positions':'Positions & battles','Race progress':'Progress & milestones','Gaps and battles':'Positions & battles','Laps and records':'Laps & records','Pit and fuel':'Fuel Systems','Tyre wear':'Tyre Wear Systems','Penalties':'Penalty Systems','Flags':'Flags & Safety Car','Safety':'Timing hardware','Finish':'Results & championship','Weather':'Weather Systems','Time tokens':'Time Tokens','Car Failures':'Damage & failures','Damage':'Damage & failures','Endurance':'Endurance & driver swaps'};
  const TONES = {'Resource Systems':'resources','Fuel Systems':'fuel','Penalty Systems':'penalty','Flags & Safety Car':'safetycar','Tyre Wear Systems':'tyrewear','Weather Systems':'weather','Push & Save Systems':'pushsave','Damage & failures':'damage','Balance of Power':'bop','Time Tokens':'tokens','Endurance & driver swaps':'endurance','Pits & Service Stop':'tokens'};
  const TITLES = {prerace:'Before the start',lightsout:'Lights out',newleader:'New leader',overtake:'Position gained',lapstogo:'Laps remaining',timetogo:'Minutes remaining',distance:'Race milestones',lastlap:'Leader’s last lap',lastlapother:'Driver’s last lap',nextheat:'Next heat',nextfinal:'Next final',lineup:'Next starting grid',heatend:'Heat finished',finalend:'Final finished',closing:'Closing in',battle:'Close battle',lapped:'Lapped by the leader',fastestlap:'Fastest lap',trackrecord:'Track record',personalbest:'Personal best',firstlap:'First completed lap',nearrecord:'Close to the track record',pitin:'Pit entry',pitout:'Pit exit',fuelhalf:'Half a tank remaining',fuellow:'Low fuel',outoffuel:'Out of fuel',refuelled:'Refuelling complete',bopon:'Balance of Power applied',bopoff:'Balance of Power removed',swapsoon:'Driver swap approaching',swapdue:'Driver swap due',swapdone:'Driver swap complete',swaplate:'Driver swap overdue',swappenalty:'Driver swap penalty',damagehit:'Damage received',damagelevel:'Repair required',damagecritical:'Critical damage',damagelate:'Repair overdue',repairearly:'Repair interrupted',repaired:'Repair complete',damageout:'Retired with damage',damagedq:'Disqualified for damage',failure:'Car failure',failurecritical:'Critical failure',failurelate:'Failure repair overdue',failureearly:'Failure repair interrupted',failurerepaired:'Failure repair complete',failureout:'Retired with failure',failuredq:'Disqualified for failure',weathercloudy:'Cloudy conditions',weatherwet:'Rain begins',weatherclearing:'Track drying',weatherdry:'Dry conditions',weatherconditions:'Track conditions',tyrechange:'Weather tyre fitted',wrongtyres:'Wrong tyres overdue',tyrepenalty:'Wrong-tyre penalty',tyrelevel:'Tyre life warning',tyreworn:'Tyres worn out',tyrenew:'Tyre fitting complete',tyrelast:'Last tyre set fitted',tyrequeued:'Next tyres selected',tyreearly:'Tyre change interrupted',penalty:'Penalty points added',specialpenalty:'Special penalty assigned',penaltyserved:'Penalty served',penaltyforgiven:'Penalty cancelled',penaltytime:'Time penalty added',disqualified:'Driver disqualified',yellowflag:'Yellow flag',yellowsoon:'Yellow flag approaching',yellowtarget:'Yellow-flag target',yellowfast:'Too fast under yellow',redflag:'Red flag',greenflag:'Green flag',lanecall:'Driver track call',nolap:'No lap detected',trackmatelost:'Trackmate disconnected',trackmateback:'Trackmate reconnected',finished:'Session finished',podium:'Provisional podium',winner:'Provisional winner',tokenwarning:'Paid time running low',tokenout:'Paid time expired',tokenadded:'Paid time added',tokenfree:'Lane available'};
  const VALUES = {
    resourcejob:['Work blocked by exhausted supplies','Failure repair'],resource:['Supplies needed for the blocked work','repair credits and replacement components'],resourceowner:['Owner of the shared resource allocation','Club team'],
    classname:['Racing class','GT3'],classposition:['Position within class',1],classpoints:['Class heat points',25],classgap:['Gap to class leader','0.5 seconds'],
    race:['Race setup name','Saturday club night'],session:['Session type','race'],elapsed:['Elapsed race time','5 minutes'],remaining:['Time remaining in a timed session','2 minutes'],
    lapscompleted:['Classified laps completed',12],lapsremaining:['Laps remaining to this car’s limit',8],validlaps:['Valid non-pit laps available for statistics',10],
    lastlap:['Last completed lap time','7.512'],averagelap:['Average of valid non-pit laps','7.610'],medianlap:['Median of valid non-pit laps','7.600'],benchmark:['Configured Push & Save benchmark','7.600'],
    gapleader:['Time gap to leader; leader says leader','0.8 seconds'],gapbehind:['Time gap to following car','1.2 seconds'],
    fuelpercent:['Fuel remaining as percentage of this car’s tank',25],fuellaps:['Estimated laps of fuel, based on recent clean laps','3.2'],
    tyrelife:['Tyre life remaining, percent',42],tyrelaps:['Estimated tyre life in laps','14.2'],tyresets:['Unused sets of current compound',2],
    pace:['Current Push / Normal / Save state','Push'],pacedelta:['Pace change against benchmark, percent','-3.0'],fuelmultiplier:['Current Push & Save fuel multiplier','1.22'],tyremultiplier:['Current Push & Save tyre multiplier','1.35'],
    servicetotal:['Fixed service duration plus additive pit penalties','35 seconds'],serviceremaining:['Remaining service and penalty time','12 seconds'],penaltyremaining:['Remaining pit penalty time','5 seconds'],pitstopnumber:['Current or most recent pit stop number',2],releasecondition:['Reason pit release is held','Safety Car pit exit hold'],
    pointsadded:['Penalty points added by this event',1],pointstotal:['Current penalty point total',3],penaltytime:['Total time consequence from penalty points','5 seconds'],penaltylaps:['Total lap deduction from penalty points',1],requiredstop:['Required unserved pit penalty','10 seconds'],consequence:['Actual consequence of this decision','A 10-second stop is required'],reason:['Reason for the race-control decision','red flag'],
    requestedtyre:['Requested compound, including custom names','Hard'],stopsremaining:['Mandatory stops still required',1],requirement:['Outstanding mandatory stop or compound requirement','1 mandatory stop still required'],deadline:['Laps remaining until tyre-change deadline',2],
    round:['Championship round number',2],roundpoints:['Points earned in this championship round',25],championshippoints:['Championship points after this round',43],championshipposition:['Position in the championship','first'],heatpoints:['Points awarded for the finalised heat',10],interface:['Selected timing interface','Parallel Port'],system:['Race System changed','Fuel System'],enabled:['Whether the system was enabled or disabled','off']
  };
  const GLOBAL = ['track','record','race','session','heat','heats','final','elapsed','remaining','round'];
  const DRIVER = ['classname','classposition','classpoints','classgap','driver','name','nickname','callsign','team','car','best','lane','points','fuel','gapahead','position','lapscompleted','lapsremaining','validlaps','lastlap','averagelap','medianlap','benchmark','gapleader','gapbehind','fuelpercent','fuellaps','tyrelife','tyrelaps','tyresets','pace','pacedelta','fuelmultiplier','tyremultiplier','servicetotal','serviceremaining','penaltyremaining','pitstopnumber','releasecondition','pointstotal'];
  const tokenVars=['driver','name','nickname','callsign','team','car','best','lane'];
  const variablesFor = c => [...new Set([...(c?.vars||[]),...GLOBAL,...(c?.vars?.includes('driver')?(c.group==='Time tokens'||c.tokens?tokenVars:DRIVER):[])])];
  const inspect = (text,c,vars) => { const keys=[...new Set([...String(text||'').matchAll(/\{(\w+)\}/g)].map(m=>m[1]))],allowed=variablesFor(c);return {unknown:keys.filter(k=>!allowed.includes(k)),missing:keys.filter(k=>allowed.includes(k)&&vars&&(vars[k]==null||(vars[k]===''&&!['heat','final','team'].includes(k))))}; };
  const category = c => ['pitin','pitout','refuelled'].includes(c.id)?'Pits & Service Stop':c.id==='lanecall'?'Race control':GROUPS[c.group]||c.group||c.section;
  const title = c => TITLES[c.id] || (c.id.startsWith('countdown')?'Start light '+(6-Number(c.id.slice(-1))):c.label);
  function extend(calls,vars,sample) {
    calls.find(c=>c.id==='penalty').vars.push('pointsadded','pointstotal','penaltytime','penaltylaps','reason');
    definitions.forEach(([id,group,label,v,text])=>calls.push({id,group,label,vars:v,lines:[text],defaultOn:false,added:true}));
    Object.entries(VALUES).forEach(([k,[description,value]])=>{vars[k]=description;sample[k]=value;});
  }
  const on = (s,id) => !!(s?.calls?.[id] && s.calls[id].on!==false);
  const number = n => Number.isFinite(n) ? Math.round(n*10)/10 : '';
  function raceValues(e,o={},ctx={}) {
    const at=Number.isFinite(ctx.now)?ctx.now:e.endAt??e.pausedAt??e.t0,spent=at!=null&&e.elapsed?e.elapsed(at):null;
    return {race:o.raceName||'',session:o.sessionType||e.type||'',track:o.trackName||'',round:o.round??'',elapsed:span(spent),remaining:span(e.cfg?.duration>0?Math.max(0,e.cfg.duration*60000-(spent||0)):null)};
  }
  const span = ms => !Number.isFinite(ms)||ms<0?'':ms===0?'0 seconds':root.Announcer.speakSpan(ms)||'less than a second';
  function driverValues(e,c,o={},ctx={}) {
    const A=root.Announcer, E=typeof module!=='undefined'?require('./engine.js'):root.RaceEngine, i=e.cars.indexOf(c),at=ctx.now??e.endAt??e.pausedAt??e.t0??0;
    const rows=ctx.audioRows||(e.standings?e.standings():[]),pos=rows.findIndex(r=>r.car===c),g=(ctx.audioGaps||(e.gapInfo?e.gapInfo():[]))[i]||{},next=rows[pos+1]?.car,nextGap=next?(ctx.audioGaps||e.gapInfo())[e.cars.indexOf(next)]:null;
    const laps=E.averageLaps(c),sorted=laps.slice().sort((a,b)=>a-b),mid=Math.floor(sorted.length/2),time=ms=>Number.isFinite(ms)?A.speakTime(ms,o.spokenDecimals):'';
    const active=k=>!e.systemOn||e.systemOn(k),fuel=active('fuel')&&e.fuel?.on?(e.fuelOf?e.fuelOf(i,at):c.fuel):null,tank=e.tankOf?e.tankOf(i):e.fuel?.tank;
    const samples=(c.fuelSamples||[]).filter(x=>x&&x.used>0&&x.lap<c.laps.length&&!c.invalid?.includes(x.lap)&&!c.removed?.includes(x.lap)&&!c.bad?.[x.lap]&&!c.pitLaps?.includes(x.lap)).slice(-Math.round(numeric(o.fuelSamples,5,3,20)));
    const range=samples.length>=3&&fuel!=null?fuel/(samples.reduce((n,x)=>n+x.used,0)/samples.length):null,ps=active('pushsave')&&e.psInfo?e.psInfo(c):null;
    const hold=e.pitHoldOf?e.pitHoldOf(i,at):null,pen=(c.pending||[]).reduce((n,p)=>n+(p.kind==='stopgo'?p.seconds*1000:0),0),total=e.pitControl&&c.pitHold?e.pitControl.seconds*1000+(c.pitHold.extraMs||0):null;
    const limit=e.limitOf?e.limitOf(c):o.lapLimit,done=e.lapsOf?e.lapsOf(c):c.laps.length,tyres=active('tyrewear')&&e.tyrewear, W=typeof module!=='undefined'?require('./tyrewear.js'):root.TyreWear;
    const tl=tyres?W.left(e.tyrewear,c.tyre,e.wxState||'dry',c.twLife,e.tyrewear.laneLen?.[c.lane]||0):null;
    const sets=e.twOf?e.twOf(i,at)?.sets:null;
    const cr=e.classStandings?.().find(x=>x.car===c),M=typeof module!=='undefined'?require('./multiclass.js'):root.MultiClass;
    return {classname:cr?.className||'',classposition:cr?.classPos??'',classpoints:cr?.classPoints??'',classgap:cr?M.gapText(cr.classGap):'',position:pos>=0?A.ordinal(pos+1):'',lapscompleted:done,lapsremaining:limit>0?Math.max(0,limit-done):'',validlaps:laps.length,lastlap:time(c.laps.at(-1)),averagelap:time(laps.length?laps.reduce((a,b)=>a+b,0)/laps.length:null),medianlap:time(sorted.length?(sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2):null),benchmark:time(ps?.ref>0?ps.ref:null),gapleader:pos===0?'leader':Number.isFinite(g.lead)?A.speakGap(g.lead):'',gapbehind:Number.isFinite(nextGap?.ahead)?A.speakGap(nextGap.ahead):'',fuelpercent:fuel!=null&&tank>0?number(fuel/tank*100):'',fuellaps:range!=null?number(range):'',tyrelife:tyres?number(c.twLife):'',tyrelaps:number(tl?.laps),tyresets:sets?.[c.tyre]??'',pace:ps?({push:'Push',save:'Save',normal:'Normal'}[ps.kind]||'Normal'):'',pacedelta:number(ps?.p),fuelmultiplier:ps?.fuel??'',tyremultiplier:ps?.tyres??'',servicetotal:span(total),serviceremaining:span(hold?.remaining),penaltyremaining:span(hold?Math.min(c.pitHold?.extraMs||0,hold.remaining):pen),pitstopnumber:(c.pits||[]).length+(c.pit?1:0),releasecondition:hold?.text||'',pointstotal:c.points||0};
  }
  function monitor(options={}) {
    const cfg={...options,...cleanSettings(options)},enabled=id=>on(options,id)||(options.ambient||[]).includes(id);let cursor=null,phase=null,hardware=null,classification=null;
    if (!definitions.some(([id])=>enabled(id))) return ()=>{};
    const memory=new Map();
    return function(e,ctx,ev,who) {
      const live=['running','paused'].includes(ctx.phase),running=ctx.phase==='running',review=ctx.phase==='review';
      const emit=(id,v)=>{if(enabled(id))ev(id,v);};
      if(running&&e.multiclass?.announcements&&e.classStandings){for(const x of e.classStandings().filter(x=>x.classPos===1&&x.car.laps.length)){const key='class:'+x.raceClass,old=memory.get(key),id=x.car.asTeam?x.car.teamId:x.car.driverId||x.car.lane;if(old!==id){memory.set(key,id);emit('classleader',{...who(x.car),classname:x.className,classposition:1});}}}
      if(ctx.phase==='countdown'&&phase==='paused')emit('restart',{});phase=ctx.phase;
      if(ctx.hardware){const hw=ctx.hardware;if(hardware&&hardware.id===hw.id&&hardware.connected!==hw.connected&&live){emit(hw.connected?'hardwareback':'hardwarelost',{interface:hw.name});}hardware={...hw};}
      if(cursor==null)cursor=e.events.length;
      for(;cursor<e.events.length;cursor++) {
        const x=e.events[cursor],c=e.cars[x.car];if(!live&&!review&&!['finished','between'].includes(ctx.phase))continue;
        if(x.type==='systemtoggle'){emit('systemchanged',{system:({fuel:'Fuel System',penalty:'Penalty System',safetycar:'Safety Car System',tyrewear:'Tyre Wear System',weather:'Weather System',pushsave:'Push and Save System',damage:'Damage System',bop:'Balance of Power'})[x.system]||x.system,enabled:x.enabled?'on':'off'});continue;}
        if(x.type==='safetycar'){emit(x.out?'safetyout':'safetyin',{});continue;}
        if(!c)continue;const v=()=>who(c);
        if(x.type==='resourceblocked')emit('resourceblocked',{...v(),resourcejob:x.job==='damage'?'Damage repair':x.job==='failure'?'Failure repair':'Tyre change',resource:(x.missing||[]).map(k=>k==='repair'?'repair credits':k==='component'?'replacement components':tyreName(e,k.slice(5))+' tyre sets').join(' and '),resourceowner:x.owner||c.driverName});
        if(x.type==='redlap')emit('redlap',{...v(),lap:x.lap,reason:'red flag'});
        if(x.type==='reinstated')emit('reinstated',v());
        if(x.type==='pitstart'&&e.pitControl?.mode!=='follow'&&e.pitControl)emit('servicestart',v());
        if(x.type==='pitrelease'&&x.early)emit('serviceearly',v());
        if(x.type==='tyrenone')emit('tyreunavailable',{...v(),requestedtyre:tyreName(e,x.asked||x.tyre)});
        if(x.type==='tyrefresh'&&x.asked&&x.asked!==x.tyre)emit('tyrefallback',{...v(),requestedtyre:tyreName(e,x.asked),tyre:tyreName(e,x.tyre)});
        if(x.type==='mandatory'&&!x.ok)emit('mandatorymissed',{...v(),consequence:x.ms?span(x.ms)+' added':x.points?x.points+' penalty points':x.how==='dq'?'Disqualified':'No additional penalty'});
        if(x.type==='penalty'&&x.delta>0){const pending=c.pending?.filter(p=>p.ladderTier)||[],stop=pending.reduce((n,p)=>n+(p.seconds||0),0);emit('penaltyconsequence',{...v(),pointsadded:x.delta,pointstotal:x.points,penaltytime:span(x.ms||0),penaltylaps:x.laps||0,requiredstop:stop?span(stop*1000):'',consequence:[x.ms?span(x.ms)+' time penalty':'',x.laps?x.laps+' lap deduction':'',stop?'A '+span(stop*1000)+' stop is required':''].filter(Boolean).join('. ')||'No additional consequence'});}
      }
      if(enabled('resultcorrected')) {
        const sign=e.standings().map(r=>[r.car.driverId,r.pos,r.car.dq,e.lapsOf?e.lapsOf(r.car):r.car.laps.length,r.car.total,r.car.extraMs,r.car.points]);
        const key=JSON.stringify(sign);if(review&&classification!==null&&key!==classification)emit('resultcorrected',{});classification=key;
      }
      e.cars.forEach((c,i)=>{
        let m=memory.get(c);if(!m){m={laps:c.laps.length,invalid:new Set(c.invalid||[]),pit:null,ready:false,held:false,low:false,short:false,pace:null,paceCount:0,saidPace:'normal',mandatory:null,weather:null,automatic:0,summaryAt:e.elapsed?.(ctx.now??e.t0)||0};memory.set(c,m);}
        const v=()=>who(c),invalid=new Set(c.invalid||[]);if(live||review){invalid.forEach(n=>{if(!m.invalid.has(n))emit('lapinvalid',{...v(),lap:n+1});});m.invalid.forEach(n=>{if(!invalid.has(n))emit('laprestored',{...v(),lap:n+1});});}m.invalid=invalid;
        const automatic=(c.pending||[]).filter(p=>p.ladderTier).reduce((n,p)=>n+(p.seconds||0),0);if(live&&m.automatic>0&&automatic>m.automatic)emit('penaltyupgrade',{...v(),requiredstop:span(automatic*1000)});m.automatic=automatic;
        if(c.done&&!c.retired&&!c.dq&&c.laps.length>m.laps){
          const n=c.laps.length-1;
          if(c.laps.length%cfg.summaryEvery===0&&!c.bad?.[n]&&!c.invalid?.includes(n)&&!c.removed?.includes(n))emit('laptime',{...v(),time:root.Announcer.speakTime(c.laps[n],cfg.spokenDecimals),lap:n+1,_time:c.laps[n]});
          m.laps=c.laps.length;
        }
        if(!running||c.done||c.retired||c.dq)return;
        const h=e.pitHoldOf?.(i,ctx.now),hold=c.pitHold;
        if(c.pit){
          if(m.pit!==c.pit.start){m.pit=c.pit.start;m.counts=new Set();m.ready=false;m.held=false;}
          const exitHeld=!!h?.randomHold||!!(c.rndPitExit&&e.pitExitHeld?.());
          if(exitHeld&&!m.held)emit('pitheld',{...v(),releasecondition:'Safety Car pit exit hold'});if(!exitHeld&&m.held)emit('pitclear',v());m.held=exitHeld;
        } else {m.pit=null;m.ready=false;m.held=false;}
        if(hold){
          const ready=h?.ready&&!h.randomHold&&h.mode!=='manual'&&h.covered!==null&&!(e.pitControl.waitReturn!==false&&!hold.returned&&h.covered===false);
          if(ready&&!m.ready)emit('serviceready',v());m.ready=!!ready;
          const counts=String(options.serviceCountdown??'10,5').split(/[,;\s]+/).map(Number).filter(n=>n>0&&n<=300).sort((a,b)=>a-b),hit=counts.filter(n=>h?.remaining>0&&h.remaining<=n*1000&&!m.counts.has(n));if(hit.length&&!h.randomHold){hit.forEach(n=>m.counts.add(n));emit('servicecountdown',{...v(),serviceremaining:span(h.remaining)});}
        }else {m.ready=false;}
        const mand=e.mandOf?.(i);if(mand){const ok=mand.ok??mand.met;if(m.mandatory===false&&ok===true)emit('mandatorymet',v());m.mandatory=ok;}
        const due=c.wxDue;if(due&&JSON.stringify(due)!==m.weather){emit('weatherdue',{...v(),tyre:tyreName(e,c.tyre),deadline:Math.max(0,(due.lap??due.at??c.laps.length)-c.laps.length)});}m.weather=JSON.stringify(due);
        const changed=c.laps.length>m.laps;
        if(changed){const n=c.laps.length-1,valid=!c.bad?.[n]&&!c.invalid?.includes(n)&&!c.removed?.includes(n),stats=v();
          if(valid){if(c.laps.length%cfg.summaryEvery===0)emit('laptime',{...stats,time:root.Announcer.speakTime(c.laps[n],cfg.spokenDecimals),lap:n+1,_time:c.laps[n]});
            if(stats.fuellaps!==''){const low=stats.fuellaps<=cfg.fuelRange;if(low&&!m.low)emit('fuelrange',stats);m.low=low;const short=stats.lapsremaining!==''&&stats.fuellaps<stats.lapsremaining;if(short&&!m.short)emit('fuelfinish',stats);m.short=short;}
            const ps=e.psInfo?.(c);if(ps&&(!e.systemOn||e.systemOn('pushsave'))&&ps.p!=null){const k=Math.abs(ps.p)<=cfg.paceHysteresis?'normal':ps.kind;if(m.pace===k)m.paceCount++;else{m.pace=k;m.paceCount=1;}if(k!==m.saidPace&&m.paceCount>=cfg.paceLaps){emit(k==='push'?'pushstate':k==='save'?'savestate':'normalstate',{...stats,pace:{push:'Push',save:'Save',normal:'Normal'}[k]});m.saidPace=k;}}
          }
          if(options.summaryMode!=='time'&&c.laps.length%cfg.summaryEvery===0){emit('racesummary',stats);if(mand&&!m.mandatory){const left=Math.max(0,(mand.need??0)-(c.twStops||0));emit('mandatorydue',{...stats,stopsremaining:left,requirement:[left?left+' mandatory stop'+(left===1?'':'s')+' still required':'',mand.tyresOk===false?'use the required tyre compounds':''].filter(Boolean).join('; ')||'mandatory requirements still outstanding'});}}
        }
        if(options.summaryMode==='time'&&e.elapsed&&ctx.now!=null){const t=e.elapsed(ctx.now);if(t-m.summaryAt>=cfg.summarySeconds*1000){m.summaryAt=t;emit('racesummary',v());}}
        m.laps=c.laps.length;
      });
    };
  }
  const tyreName=(e,code)=>{const W=typeof module!=='undefined'?require('./weather.js'):root.Wx;return W.withTyres(e.cfg?.tyrewear?.tyres).tyreName(code);};
  function resultCalls(session, options={}) {
    const rivals=typeof module!=='undefined'?require('./virtualrival.js'):root.VirtualRival;
    const rows=rivals?rivals.savedStandings(session):session.standings||[], winner=rows.find(r=>r.pos===1&&!r.dq&&!r.retired),out=[{call:'resultsfinal',vars:{}}];
    if(session.multiclass?.announcements)(session.classStandings||[]).filter(r=>r.classPos===1&&!r.dq&&!r.retired&&r.laps>0).forEach(r=>out.push({call:'classwinner',vars:{driver:r.driverName||r.teamName,classname:r.className,classposition:1,classpoints:r.classPoints??''},facts:{driverId:r.driverId||'',place:1}}));
    if(winner)out.push({call:'finalwinner',vars:{driver:winner.driverName||winner.teamName||'',name:winner.driverName||'',team:winner.teamName||'',car:winner.carName||'',position:'first',lapscompleted:winner.laps,pointstotal:winner.penaltyPoints??'',best:Number.isFinite(winner.best)?root.Announcer.speakTime(winner.best,options.spokenDecimals):''},facts:{driverId:winner.driverId||'',place:1}});
    return out;
  }
  function champCalls(view) {
    if(view.state!=='race'||!view.awarded)return [];
    const out=[],seen=new Set(),rows=(view.rows||[]).flatMap(r=>r.kind==='team'?[r,...(r.members||[])]:[r]);
    rows.filter(r=>!r.guest&&r.total!=null&&!r.noPoints&&!r.short).forEach(r=>{const key=(r.kind==='team'?'t:':'d:')+(r.driverId||r.teamId||r.name);if(seen.has(key))return;seen.add(key);out.push({call:'roundpoints',vars:{driver:r.name,name:r.name,round:view.round,roundpoints:r.round,championshippoints:r.total,championshipposition:root.Announcer.ordinal(r.pos)},facts:{driverId:r.driverId||'',place:r.pos}});});
    const after=view.after?.drivers||[],before=view.before?.drivers||[],leaders=after.filter(r=>r.pos===1),prior=before.filter(r=>r.pos===1).map(r=>r.id);
    leaders.forEach(r=>{const vars={driver:r.name,name:r.name,championshippoints:r.total,championshipposition:'first'};if(!prior.includes(r.id))out.push({call:'champleader',vars,facts:{driverId:r.id,place:1}});if(view.decided===view.total&&view.total>0)out.push({call:'champwinner',vars,facts:{driverId:r.id,place:1}});});return out;
  }
  const api={SETTINGS,cleanSettings,definitions,VALUES,GLOBAL,DRIVER,variablesFor,inspect,category,title,TONES,extend,on,raceValues,driverValues,monitor,span,resultCalls,champCalls};root.AudioCalls=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
