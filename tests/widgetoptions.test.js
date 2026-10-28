const assert=require('assert/strict');
const W=require('../renderer/widgets'),T=require('../renderer/timing'),P=require('../renderer/widgetpreview');
const Tw=require('../renderer/tyrewidgets'),Pw=require('../renderer/pacewidgets'),Ps=require('../renderer/pushsave');
let checks=0;const check=(v,m)=>{assert.ok(v,m);checks++;};
const row=Tw.sampleRow(1),html=opt=>Tw.rowHtml(row,opt).html;
check(!html({look:'number',showPct:false,showLeft:false,showGrip:false}).includes('62%'),'Hidden percentage must stay hidden');
check(html({look:'number',showPct:false,showLeft:false,showName:true}).includes('Medium'),'Name can be the only selected fact');
for(const dir of ['vertical','horizontal']){
 const out=html({look:'bar',dir,showName:true,showGrip:true,showTemperature:true});
 for(const text of ['Medium','grip','Simulated:','laps'])check(out.includes(text),'Bar '+dir+' displays selected '+text);
 const hidden=html({look:'bar',dir,showName:false,showGrip:false,showTemperature:false,showLeft:false});
 for(const text of ['Medium','grip','Simulated:','laps'])check(!hidden.includes(text),'Bar '+dir+' hides '+text);
}
for(const option of Pw.OPTIONS.filter(o=>['showPct','showWear','showRef','pushColor','normalColor','saveColor'].includes(o.key))){
 check(!option.show({look:'wear'})&&option.show({look:'gauge'}),'Only applicable pace controls: '+option.key);
}
check(Pw.rowHtml(Pw.sampleInfo(0),Ps.clean(Ps.defaults()),{look:'wear'}).html.includes('Tyres'),'Wear-only still shows its multipliers');
check(Tw.OPTIONS.find(o=>o.key==='imageSet').show({look:'ring'})&&!Tw.OPTIONS.find(o=>o.key==='imageSet').show({look:'wear'}),'Picture set belongs to the ring look');
for(const type of P.TYPES){
 const def=W.def(type),S=P.context(type==='swapsignal'?'swap-due':'race');
 for(const lane of [0,1,2])for(const option of def.options||[]){
  const values=option.choices?option.choices.map(c=>c[0]):option.type==='checkbox'?[false,true]:option.type==='color'?['#123456']:option.type==='text'?['Custom <safe>']:[];
  for(const value of values){
   const w={type,lane,opt:{[option.key]:value}},before=JSON.stringify(w),live=T.content(w,P.state(w));
   // Use the same scenario for timers; other families use the shared race fixture.
   if(!['swaptimer','swapsignal'].includes(type))assert.deepEqual(P.content(w),live,type+'.'+option.key+' preview/live parity');
   check(JSON.stringify(w)===before,'Preview/formatter does not mutate '+type+'.'+option.key);
   check(typeof W.sampleOf(def,lane,w)==='string',type+'.'+option.key+' sample');
  }
 }
}
check(W.sampleOf(W.def('bop'),0,{opt:{showPercent:false}})==='BoP ▼','BOP preview honours percentage');
check(W.sampleOf(W.def('bop'),1,{opt:{showOff:false}})==='','BOP preview honours hidden off state');
check(W.sampleOf(W.def('damage'),0,{opt:{showNone:false}})==='','Damage preview honours no damage');
check(W.sampleOf(W.def('currentdriver'),0,{opt:{show:'callsign',stint:true}}).includes('P1 ·'),'Current driver preview honours name and stint');
check(W.sampleOf(W.def('nextdriver'),0,{opt:{show:'callsign',prefix:true}})==='Next: R1','Next driver preview honours name and prefix');
check(W.sampleOf(W.def('swaptimer'),1,{opt:{show:'clock'}})==='0:30','Swap timer preview honours clock only');
const light=P.content({type:'lights',previewState:'red',opt:{lights_red:'off',lightcol_red:'#123456'}}).html;
check(!light.includes('class="sl on"'),'Red lights preview follows configured state');
check(W.layoutOfWidget({type:'fuel'})==='gauge'&&W.layoutOfWidget({type:'swapsignal'})==='text','Text-bearing former media use a fitting adapter');
{
 const E=require('../renderer/engine'),V=require('../renderer/virtualrival'),Live=require('../renderer/liveshare');
 const make=lap=>{const eng=E.createRace({type:'race',laps:100,firstLap:'count',minLap:100,entries:[{lane:0,driverId:'real',driverName:'Real'}],virtualRivals:[{driverId:'rival',driverName:'Rival',profile:V.clean({name:'Replay',trackId:'track',trackName:'Circuit',laneLength:20,mode:'competitor',recording:[{time:8000,lap:1}],end:'repeat'})}]});eng.start(0);eng.cross(0,lap);eng.cross(0,lap*2);eng.tick(Math.max(lap*2,16000));return eng;};
 const shared=eng=>Live.makeShared({eng,now:20000,phase:'running',layout:{widgets:[]},setup:{sessionType:'race',laps:100},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity});
 const eng=make(7000),S=shared(eng),rival=eng.rivals[0];
 check(T.content({type:'gap',lane:rival.lane,opt:{display:'laps'}},S).html==='+0.3 laps','Rival gap honours fractional laps');
 check(T.content({type:'gap',lane:rival.lane,opt:{display:'both'}},S).html==='+2.000 · +0.3 laps','Rival gap honours both');
 const leading=shared(make(9000));
 check(T.content({type:'gap',lane:0,opt:{display:'laps'}},leading).html==='+0.3 laps','Physical car uses actual virtual leader pace, not physical-only gap');
 check(T.content({type:'totaltime',lane:rival.lane,opt:{scope:'both'}},S).html.includes('in all'),'Rival total time honours display scope');
 check(T.content({type:'totaltime',lane:rival.lane,opt:{scope:'all'}},{...S,heat:{idx:1}}).html==='–','Unrecorded rival cumulative heat time is unavailable');
 const filter=E.averageLaps;let reads=0;E.averageLaps=c=>{reads++;return filter(c);};try{T.content({type:'name',lane:rival.lane,opt:{}},S);check(reads===0,'Rival identity does not calculate lap statistics');}finally{E.averageLaps=filter;}
 const fn=E.fmtTime;let calls=0;E.fmtTime=v=>{calls++;return fn(v);};
 try{rival.laps=Array.from({length:1000},()=>8000);const out=T.content({type:'lastlap',lane:rival.lane,opt:{columns:2,lapsPerColumn:3}},S).html;check(calls<20&&out.includes('1000')&&!out.includes('>994<'),'Rival Last Laps formats only the selected tail');}finally{E.fmtTime=fn;}
}
console.log('WIDGET OPTION REGRESSIONS PASSED: '+checks+' checks');
