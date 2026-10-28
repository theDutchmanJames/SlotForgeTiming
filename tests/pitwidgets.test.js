const assert=require('node:assert/strict');
const P=require('../renderer/pitwidgets'),W=require('../renderer/widgets'),T=require('../renderer/timing'),E=require('../renderer/engine'),D=require('../renderer/damage'),Tw=require('../renderer/tyrewear'),Share=require('../renderer/liveshare'),Preview=require('../renderer/widgetpreview');
let groups=0;const test=(name,fn)=>{fn();groups++;console.log('ok '+name);};
const entries=[{lane:0,driverId:'a',driverName:'Alex'},{lane:1,driverId:'b',driverName:'Sam'}];
const fuel={on:true,tank:100,perLap:10,rate:20,pitHold:1000,empty:'warn'};
const create=extra=>{const e=E.createRace({type:'timed',duration:60,firstLap:'count',minLap:100,entries,fuel,damage:D.clean(D.defaults()),penalty:{on:true,perPoint:5},tyrewear:Tw.clean({}),...extra});e.start(0);return e;};
const context=(eng,now=20000)=>({raceId:'pit-widget-test',eng,now,phase:eng.status,setup:{sessionType:'timed'},layout:{widgets:[],laneColors:[]},track:{},lanes:2,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity});
const shared=(e,now)=>Share.makeShared(context(e,now));
const read=(type,e,opt={},now=20000)=>P.content(type,shared(e,now),opt).html;
test('two independent race-wide widgets are registered in Pit Stops and have production previews',()=>{
 for(const type of P.TYPES){const d=W.def(type);assert.equal(d.group,'Pit Stops');assert.equal(d.perLane,false);assert.equal(d.layout,'pitcontrol');assert(Preview.content({type}).html.includes('pcw-row'));assert(d.options.some(o=>o.key==='lanes'));}
});
test('active alerts are derived from enabled systems, sorted by urgency, and honour lane/category filters',()=>{
 const e=create();e.cars[0].fuel=8;e.cars[1].twLife=15;e.addDamage(0,9,1000);e.cars[1].pending.push({kind:'stopgo',name:'Stop & go',seconds:8});
 const S=shared(e),all=P.attention(S);assert(all.rows.some(r=>r.category==='fuel'));assert(all.rows.some(r=>r.category==='tyres'));assert(all.rows.some(r=>r.category==='damage'));assert(all.rows.some(r=>r.category==='penalty'));assert.equal(all.rows[0].priority,3);
 assert(P.attention(S,{lanes:'1'}).rows.every(r=>r.lane===1));assert(!P.attention(S,{showfuel:false}).rows.some(r=>r.category==='fuel'));
 e.setSystem('fuel',false,2000);assert(!P.attention(shared(e)).rows.some(r=>r.category==='fuel'));
 e.setSystem('penalty',false,2000);assert(P.attention(shared(e)).rows.some(r=>r.category==='penalty'));
});
test('refuel, tyre change and penalty resolution remove active rows without deleting history',()=>{
 const e=create();e.cars[0].fuel=12;e.cars[0].twLife=5;e.cars[0].pending.push({kind:'stopgo',name:'Stop & go',seconds:1});e.tick(1000);
 assert.equal(P.attention(shared(e)).rows.filter(r=>r.lane===0).length,3);
 e.block(0,2000);e.tick(3000);e.tick(12000);e.unblock(0,13000);
 assert(!P.attention(shared(e,13000)).rows.some(r=>r.lane===0));
 const h=P.recent(shared(e,13000)).rows;assert(h.some(r=>r.category==='fuel'));assert(h.some(r=>r.title==='New tyres fitted'));assert(h.some(r=>r.title==='Penalty served'));
});
test('completed repairs clear damage alerts through the real service engine',()=>{
 const e=create();e.addDamage(0,3,1000);assert(P.attention(shared(e)).rows.some(r=>r.category==='damage'));
 e.block(0,2000);e.tick(3000);e.tick(20000);assert.equal(e.cars[0].dmg,0);assert(!P.attention(shared(e)).rows.some(r=>r.category==='damage'));
 assert(read('recentevents',e).includes('Damage repaired'));
});
test('fuel warnings are recorded once per transition with audio and widgets absent',()=>{
 const e=create({damage:undefined,tyrewear:undefined});for(let n=1;n<=8;n++)e.cross(0,n*1000);
 assert.equal(e.events.filter(x=>x.type==='fuelwarning').length,1);for(let n=0;n<40;n++)e.tick(8000+n);
 assert.equal(e.events.filter(x=>x.type==='fuelwarning').length,1);e.cross(0,9000);assert.equal(e.events.filter(x=>x.type==='fuelwarning').length,2);
 const restored=E.createRace(e.cfg);assert(restored.restore(e.snapshot(9000)));restored.tick(9000);assert.equal(restored.events.filter(x=>x.type==='fuelwarning').length,2);
 e.block(0,10000);e.tick(11000);e.tick(15000);assert(e.events.some(x=>x.type==='fuelrecovered'));
 assert.equal(P.describe({type:'fuelrecovered',level:1,percent:15})[1],'Fuel level improving');assert.equal(P.describe({type:'fuelrecovered',level:0,percent:50})[1],'Fuel warning cleared');
});
test('flag records and timestamps remain accurate across yellow, red, resume, snapshots and driver changes',()=>{
 const e=create();e.setFlag('yellow',10000);e.setFlag('yellow',11000);e.setFlag('red',12000);e.resume(62000);e.addDamage(0,3,65000);
 const flags=e.events.filter(x=>x.type==='raceflag');assert.deepEqual(flags.map(x=>x.flag),['yellow','','red','']);assert.deepEqual(flags.map(x=>x.raceMs),[10000,11000,12000,12000]);
 const damage=e.events.find(x=>x.type==='damage');assert.equal(damage.raceMs,15000);e.cars[0].driverName='Replacement';assert(P.recent(shared(e,65000)).rows.some(x=>x.name==='Alex'&&x.category==='damage'));
 const restored=E.createRace(e.cfg);assert(restored.restore(e.snapshot(65000)));assert.deepEqual(P.recent(shared(restored,65000)).rows,P.recent(shared(e,65000)).rows);
});
test('track calls create one flag edge and remain active until resolved',()=>{
 const e=create();e.call(0,1000);e.call(0,1100);assert.equal(e.events.filter(x=>x.type==='raceflag').length,1);assert.equal(P.attention(shared(e)).rows.filter(x=>x.category==='flags').length,1);
 e.resolveCall(e.calls[0].id,'dismiss',2000);assert(!P.attention(shared(e)).rows.some(x=>x.category==='flags'));
});
test('recent filters are independent; global flags remain visible with a lane selected',()=>{
 const e=create();e.addDamage(0,3,1000);e.addDamage(1,3,2000);e.setFlag('yellow',3000);const S=shared(e);
 const lane=P.recent(S,{lanes:'0'}).rows;assert(lane.some(x=>x.lane===-1));assert(!lane.some(x=>x.lane===1));assert(!P.recent(S,{showflags:false}).rows.some(x=>x.category==='flags'));
 assert(P.attention(S,{showdamage:false}).rows.length===0);assert(P.recent(S).rows.some(x=>x.category==='damage'));
});
test('main and serialized second-screen widgets match without mutating race state',()=>{
 const e=create();e.cars[0].fuel=12;e.addDamage(1,3,1000);e.tick(2000);e.setFlag('yellow',3000);const ctx=context(e,4000),v=Share.viewer();
 v.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));v.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),9000);
 const before=JSON.stringify(e.snapshot(4000));for(const type of P.TYPES)for(const opt of [{},{lanes:'0',showdamage:false},{timestamps:false,details:false,laneLabels:false}])assert.equal(T.content({type,opt},Share.makeShared(ctx)).html,T.content({type,opt},v.shared(9000)).html);
 assert.equal(JSON.stringify(e.snapshot(4000)),before);
});
test('ready, finished, retired, missing and virtual lanes do not create active service alerts',()=>{
 const e=create();e.cars[0].fuel=0;e.cars[0].virtualRival=true;e.cars[1].retired=true;e.cars[1].fuel=0;assert.equal(P.attention(shared(e)).rows.length,0);
 e.cars[0].virtualRival=false;e.stop(5000);assert.equal(P.attention(shared(e)).rows.length,0);assert(read('needsattention',e).includes('Race finished'));
 assert.equal(P.recent(shared(e),{lanes:'7'}).rows.length,0);
});
test('history is bounded, ordered newest first and resets when an engine or restored journal changes',()=>{
 const e=create();for(let i=0;i<12000;i++)e.events.push({type:'penalty',car:0,raceMs:i,points:i,driverName:'Alex',lane:0});
 assert.equal(P.recent(shared(e),{maxItems:20}).rows.length,20);assert.equal(P.recent(shared(e)).total,50);assert.equal(P.recent(shared(e)).rows[0].raceMs,11999);
 e.events.push({type:'pitstart',car:1,raceMs:12000});assert.equal(P.recent(shared(e)).rows[0].title,'Entered the pits');e.events=[];assert.equal(P.recent(shared(e)).rows.length,0);assert.equal(P.recent(shared(create())).rows.length,0);
});
test('untrusted labels are escaped; malformed limits are bounded and legacy times are explicitly unavailable',()=>{
 const e=create();e.events.push({type:'assigned',car:0,name:'<img src=x onerror=evil()>',driverName:'<script>',raceMs:0});
 const h=read('recentevents',e,{maxItems:-5});assert(h.includes('&lt;script&gt;'));assert(!h.includes('<img'));assert(h.includes('00:00'));
 e.events.push({type:'pitstart',car:0,t:1234});assert(read('recentevents',e).includes('<time>—</time>'));assert.equal(P.clock(3600000),'60:00');assert.equal(P.clock(NaN),'—');
 e.events.push(null,{type:'pitstart',car:0,raceMs:10000},{type:'pitend',car:0,raceMs:9000});assert.equal(P.recent(shared(e)).rows[0].raceMs,10000);
 e.flag='red" onclick="evil()';assert(!read('needsattention',e).includes('onclick='));
});
const Wx=require('../renderer/weather'),En=require('../renderer/endurance'),Res=require('../renderer/resources');
const parity=(e,now)=>{
 const ctx=context(e,now),v=Share.viewer(),before=JSON.stringify(e.snapshot(now));
 v.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));v.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),90000);
 for(const type of P.TYPES)assert.equal(T.content({type},Share.makeShared(ctx)).html,T.content({type},v.shared(90000)).html,type+' display parity');
 assert.equal(JSON.stringify(e.snapshot(now)),before,'rendering must be read-only');
};
test('weather-only tyre deadlines and changes appear without a Tyre Wear System',()=>{
 const e=create({tyrewear:null,weather:Wx.clean({startMode:'manual'})});e.wxSet('wet',1000);
 assert(P.attention(shared(e,1000)).rows.some(r=>r.category==='weather'&&r.detail.includes('Wet')));parity(e,1000);
 e.setSystem('weather',false,1500);assert(!P.attention(shared(e,1500)).rows.some(r=>r.category==='weather'));
 e.setSystem('weather',true,1600);e.block(0,2000);e.tick(3000);
 assert(!P.attention(shared(e,3000)).rows.some(r=>r.lane===0&&r.category==='weather'));
 assert(P.recent(shared(e,3000),{maxItems:20}).rows.some(r=>r.title==='Weather tyres fitted'));parity(e,3000);
});
test('mandatory stops survive disabled wear; simulated overheating uses the engine temperature',()=>{
 const e=create({tyrewear:Tw.clean({mandStops:1,tempOn:'on'})});e.cars[0].twTemp=150;e.cars[0].twTempAt=1000;
 assert(P.attention(shared(e,1000)).rows.some(r=>r.title==='Tyres overheating'));parity(e,1000);
 e.setSystem('tyrewear',false,1000);const rows=P.attention(shared(e,1000)).rows;
 assert(!rows.some(r=>r.title==='Tyres overheating'));assert(rows.some(r=>r.title==='Mandatory tyre stop outstanding'));
 e.setSystem('tyrewear',true,1000);e.block(0,2000);e.tick(3000);e.tick(20000);
 assert(!P.attention(shared(e,20000)).rows.some(r=>r.lane===0&&r.title==='Mandatory tyre stop outstanding'));
});
test('endurance due, overdue and completion use the current driver and preserve historic identity',()=>{
 const e=create({entries:[{...entries[0],roster:[{id:'a',name:'Alex'},{id:'relief',name:'Relief'}]},entries[1]],endurance:En.clean({sessionType:'endurance',swapUnit:'laps',swapEvery:2,swapGrace:1,swapConfirm:'button',swapLate:'stop'})});
 e.cross(0,1000);e.cross(0,2000);assert(P.attention(shared(e,2000)).rows.some(r=>r.title==='Driver swap due'));
 e.tick(4000);assert(P.attention(shared(e,4000)).rows.some(r=>r.title==='Driver swap overdue'&&r.detail.includes('no longer count')));parity(e,4000);
 assert(e.swap(0,5000,'relief'));assert(!P.attention(shared(e,5000)).rows.some(r=>r.title==='Driver swap overdue'));
 assert(P.recent(shared(e,5000),{maxItems:20}).rows.some(r=>r.title==='Driver swap overdue'&&r.name==='Alex'));
 parity(e,5000);
});
test('resource shortages remain distinct, frozen in history and clear after a successful repair',()=>{
 const resources=Res.prepare({id:'pit-audit',...Res.clean({owner:'driver',tyresOn:false,repairsOn:true,repairs:0,componentsOn:true,components:0})},{runId:'audit'});
 const e=create({resources,tyrewear:null,damage:D.clean({levels:[{name:'Dent',from:1,seconds:2,action:'repair'}],failuresOn:'on',failures:[{name:'Motor',chance:0,seconds:2}],failMax:0})});
 e.addDamage(0,1,1000);e.giveFailure(0,0,1100);e.block(0,2000);e.tick(3000);e.tick(6000);
 const alerts=P.attention(shared(e,6000)).rows.filter(r=>r.category==='resources');assert.equal(alerts.length,2);parity(e,6000);
 const events=e.events.filter(x=>x.type==='resourceblocked');assert.equal(events.length,2);assert.equal(events[0].raceMs,6000);assert.equal(events[0].driverName,'Alex');
 e.tick(7000);assert.equal(e.events.filter(x=>x.type==='resourceblocked').length,2);
 e.pause(7000);e.resume(17000);e.tick(17001);assert.equal(e.events.filter(x=>x.type==='resourceblocked').length,2,'pausing must not duplicate shortage events');
 assert.equal(P.attention(shared(e,17001)).rows.filter(r=>r.category==='resources').length,2);parity(e,17001);
 const recovered=E.createRace(e.cfg);assert(recovered.restore(e.snapshot(17001)));recovered.resume(27001);recovered.tick(27002);
 assert.equal(recovered.events.filter(x=>x.type==='resourceblocked').length,2,'recovery must not duplicate shortage events');
 e.resourceAdjust(0,'repair',2,'Repair allowance',17100);e.resourceAdjust(0,'component',1,'New motor',17100);e.tick(18000);
 assert(!P.attention(shared(e,18000)).rows.some(r=>r.category==='resources'));assert(P.recent(shared(e,18000),{maxItems:20}).rows.some(r=>r.category==='resources'));parity(e,18000);
});
test('Service Stop shows manual release, return-to-sensor, pause and Random Flag holds',()=>{
 for(const mode of ['manual','auto']){
  const e=create({damage:null,tyrewear:null,pitControl:{mode,seconds:2,waitReturn:true}});
  e.pitSensor(0,true,1000);e.block(0,1000);e.tick(2000);e.pitSensor(0,false,2100);e.tick(4100);
  const row=P.attention(shared(e,4100)).rows.find(r=>r.category==='pits');assert(row);assert.match(row.title+row.detail,mode==='manual'?/director release/:/Return car to sensor/);parity(e,4100);
  e.setFlag('red',4200);assert(P.attention(shared(e,50000)).rows.some(r=>r.title==='Service complete · race paused'));parity(e,50000);
  e.resume(52000);e.cars[0].rndPitExit=true;e.sharedPitExitHeld=true;
  assert(P.attention(shared(e,52000)).rows.some(r=>r.title==='Pit exit held'));
 }
});
test('yellow pace infractions use frozen journal metadata and the system switch category is independent',()=>{
 const e=create({yellow:{target:2000,points:1}});e.setFlag('yellow',500);e.cross(0,1000);e.cross(0,2000);
 const event=e.events.find(x=>x.type==='yellowfast');assert(event);assert.equal(event.raceMs,2000);assert.equal(event.driverName,'Alex');
 assert(P.recent(shared(e,2000)).rows.some(r=>r.title==='Too fast under yellow'));
 e.setSystem('fuel',false,3000);assert(P.recent(shared(e,3000)).rows.some(r=>r.title==='Fuel disabled'));
 assert(!P.recent(shared(e,3000),{showsystems:false}).rows.some(r=>r.category==='systems'));parity(e,3000);
});
test('refuelling between timer ticks clears the warning; a restarted lane does not inherit the former warning',()=>{
 const e=create({tyrewear:null,damage:null});e.cars[0].fuel=15;e.tick(1000);e.block(0,2000);e.tick(3000);
 e.unblock(0,8000);assert(e.events.some(x=>x.type==='fuelrecovered'&&x.raceMs===8000));
 e.cars[0].fuel=5;e.tick(9000);const count=e.events.length;e.restartCar(0,10000,{driverName:'New driver'});e.tick(11000);
 assert.equal(e.events.length,count,'a new full tank must not announce the previous driver’s warning clearing');
});
test('Fuel Bar refuses invalid readings instead of emitting NaN or Infinity styles',()=>{
 for(const [fuel,tank]of [[NaN,100],[Infinity,100],[10,Infinity],[10,NaN],[10,0],[null,100]])assert.equal(W.fuelHtml(fuel,tank,{mode:'bar'}),'–');
});
test('a compound change with fresh life is one history row, and unavailable tyres name the requested set',()=>{
 const e=create();e.twQueue(0,'H',1000);e.block(0,2000);e.tick(3000);e.tick(20000);
 const rows=P.recent(shared(e,20000),{maxItems:20}).rows;
 assert.equal(rows.filter(r=>r.title==='New tyres fitted').length,1);assert(!rows.some(r=>r.title==='Weather tyres fitted'));
 assert.equal(P.describe({type:'tyrenone',tyre:'S',asked:'W'})[2],'W');
});
test('Push & Save and Balance of Power use the engine consumption and adjusted tank, even in Multi-Class',()=>{
 const Ps=require('../renderer/pushsave'),MC=require('../renderer/multiclass');
 const e=create({fuel:{...fuel,perLap:1},bop:{mode:'manual',tank:true},pushsave:Ps.clean({from:3}),multiclass:MC.clean({classes:[{id:'gt',name:'GT3'},{id:'proto',name:'Prototype'}]}),entries:entries.map((c,i)=>({...c,raceClass:i?'proto':'gt'}))});
 e.bopSet(0,-50,0);assert.equal(e.tankOf(0),50);e.cars[0].fuel=20;
 assert(!P.attention(shared(e,0)).rows.some(r=>r.category==='fuel'),'20 litres of a 50-litre tank is not low fuel');
 for(const t of [10000,20000,30000])e.cross(0,t);e.cars[0].fuel=13;e.cross(0,38000);
 assert.equal(e.cars[0].psNow.k,'push');const expected=Math.round(e.fuelOf(0,38000)/e.tankOf(0)*100);
 assert(P.attention(shared(e,38000)).rows.some(r=>r.title==='Low fuel · '+expected+'%'));parity(e,38000);
});
test('a real Random Flag pit-exit hold matches the viewer and requires Service Stop',()=>{
 const Sc=require('../renderer/safetycar');
 for(const held of [false,true]){
  const e=create({duration:1,damage:null,tyrewear:null,safetycar:Sc.clean({rndOn:'on',rndMode:'exact',rndMin:1,rndFrom:10,rndTo:10,rndLen:10,rndGap:0,rndPitExit:'on'}),rnd:()=>0,pitControl:held?{mode:'manual',seconds:2}:undefined});
  e.block(0,1000);e.tick(2000);e.tick(7000);
  assert.equal(e.flag,'yellow');assert.equal(e.pitExitHeld(),held);assert.equal(P.attention(shared(e,7000)).rows.some(r=>r.title==='Pit exit held'),held);parity(e,7000);
  e.tick(18000);assert(!P.attention(shared(e,18000)).rows.some(r=>r.title==='Pit exit held'));parity(e,18000);
 }
});
test('custom tyre names and every new category remain readable, filterable and escaped',()=>{
 const code='C_1234567890ABCDEF',name='Club <slick>';
 const e=create({entries:[{...entries[0],tyre:code},entries[1]],tyrewear:Tw.clean({tyres:{[code]:{name,icon:'M',cls:'dry',wear:2}}})});
 e.cars[0].twLife=5;e.logEvent('tyrefresh',0,1000,{tyre:code});
 assert(P.attention(shared(e,1000)).rows.some(r=>r.detail.includes(name)));assert(P.recent(shared(e,1000)).rows.some(r=>r.detail.includes(name)));
 assert(read('needsattention',e,{},1000).includes('Club &lt;slick&gt;'));parity(e,1000);
 const fixtures=[{type:'resourceblocked',missing:['tyre:'+code]},{type:'systemtoggle',system:'pushsave',enabled:false},{type:'swapdue'},{type:'weather',state:'wet'}];
 for(const event of fixtures)e.logEvent(event.type,0,2000,event);
 for(const category of ['resources','systems','pits','weather']){assert(P.options('recentevents').some(o=>o.key==='show'+category));assert(P.recent(shared(e),{maxItems:20}).rows.some(r=>r.category===category));assert(!P.recent(shared(e),{['show'+category]:false}).rows.some(r=>r.category===category));}
});
console.log('PIT WIDGETS PASSED: '+groups+' groups');
