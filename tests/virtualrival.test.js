const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const V=require('../renderer/virtualrival'),E=require('../renderer/engine'),Live=require('../renderer/liveshare'),Tw=require('../renderer/tyrewear'),Wx=require('../renderer/weather'),Dm=require('../renderer/damage'),Sc=require('../renderer/safetycar'),Ps=require('../renderer/pushsave');
global.RaceEngine=E;global.Stats=require('../renderer/stats');global.Icons=require('../renderer/icons');global.Avatars=require('../renderer/avatars');
const Results=require('../renderer/resultsview'),Timing=require('../renderer/timing'),Rows=require('../renderer/rows'),Widgets=require('../renderer/widgets'),Transfer=require('../transfer'),Database=require('../db');
let checks=0;function test(name,fn){fn();checks++;console.log('ok '+name);}
const profile=extra=>V.clean({name:'Replay',trackId:'track',trackName:'Club',laneLength:20,recording:[{time:8000,lap:1},{time:9000,lap:2},{time:18000,lap:3,pit:true},{time:2000,lap:4,invalid:true}],end:'repeat',...extra});
const entry=p=>({driverId:'virtual',driverName:'Rival',profile:p||profile()});
const cfg=extra=>({type:'race',laps:20,endRule:'all',entries:[{lane:0,driverId:'human',driverName:'Human',carId:'car'}],virtualRivals:[entry()],...extra});
const mk=extra=>{const r=E.createRace(cfg(extra));r.start(100);return r;};
const context=(eng,t)=>({eng,now:t,phase:eng.status,track:{id:'track',length:20},setup:{sessionType:'race',laps:20},layout:{laneColors:[]},base:{personal:new Map(),track:Infinity,trackName:''},flash:new Map(),bestBy:new Map(),bestAll:Infinity,bestAllName:'',raceId:'r'});
test('source copy excludes invalid/red/slow laps, preserves pit provenance and heat boundaries',()=>{
 const laps=[{sessionId:'s',driverId:'d',heat:1,lapNumber:1,time:8000},{sessionId:'s',driverId:'d',heat:1,lapNumber:2,time:19000,pit:true},{sessionId:'s',driverId:'d',heat:1,lapNumber:3,time:1000,redFlag:true},{sessionId:'s',driverId:'d',heat:2,lapNumber:1,time:7000}];
 const p=V.capture({id:'s',trackId:'track',standings:[{driverId:'d',driverName:'Driver'}]},laps,'d',1);assert.equal(p.recording.length,3);assert.equal(V.clean(p).sourceHeat,'1');assert.deepEqual(V.sequence(p).map(l=>l.time),[8000]);assert.deepEqual(V.sequence({...p,includePits:true}).map(l=>l.time),[8000,19000]);laps[0].time=1;assert.equal(p.recording[0].time,8000);
});
test('links require a virtual driver, a system and the same track; copied source is independent',()=>{
 const drivers=[{id:'v',name:'V',driverType:'virtual',virtualRivalSystem:'p'}],profiles=[{id:'p',...profile()}];assert.equal(V.entries(['v'],drivers,profiles,'track').entries.length,1);assert(V.entries(['v'],drivers,profiles,'other').errors.length);assert(V.entries(['v'],drivers,[],'track').errors.length);assert(V.entries(['v'],[{...drivers[0],driverType:'human'}],profiles,'track').errors.length);assert(V.issues(profile({from:9,to:2})).length);assert(Math.abs(V.sequence(profile({speed:110}))[0].time-8000/1.1)<1e-8);
});
test('exact replay deadlines, repeat, reference and finish work independently of sensor first lap',()=>{
 let r=mk({skipFirst:true});r.tick(8100);assert.deepEqual(r.rivals[0].laps,[8000]);assert.equal(r.cars[0].laps.length,0);r.tick(25100);assert.deepEqual(r.rivals[0].laps,[8000,9000,8000]);r.tick(25101);assert.equal(r.rivals[0].laps.length,3);
 r=mk({virtualRivals:[entry(profile({end:'finish'}))]});r.tick(50000);assert.equal(r.rivals[0].laps.length,2);assert(r.rivals[0].done);assert.equal(r.status,'running');
 r=mk({virtualRivals:[entry(profile({end:'reference',reference:10}))]});r.tick(37100);assert.deepEqual(r.rivals[0].laps,[8000,9000,10000,10000]);
});
test('pause/red flag freeze replay without corrupting lap validity; yellow remains on clock',()=>{
 const r=mk();r.setFlag('red',4100);r.tick(99999);assert.equal(r.rivals[0].laps.length,0);r.setFlag('red',14100);r.tick(18100);assert.deepEqual(r.rivals[0].laps,[8000]);assert.deepEqual(r.rivals[0].invalid,[]);r.setFlag('yellow',18101);r.tick(27100);assert.equal(r.rivals[0].laps.length,2);
});
test('competitor finish is opt in, exact and cannot record a physical crossing after race end',()=>{
 let r=mk({laps:1,endRule:'leader',virtualRivals:[entry(profile({mode:'competitor',canFinish:false}))]});r.tick(20000);assert.equal(r.status,'running');
 r=mk({laps:1,endRule:'leader',virtualRivals:[entry(profile({mode:'competitor',canFinish:true})),{...entry(profile({speed:80})),driverId:'other'}]});assert.equal(r.cross(0,30100),false);assert.equal(r.endAt,8100);assert.equal(r.rivals[1].laps.length,0);assert.equal(r.cars[0].laps.length,0);
});
test('classification and comparison never change physical ranking or finish progress',()=>{
 let r=mk();r.tick(8100);r.cross(0,9100);assert.equal(r.displayStandings()[0].car.driverId,'human');assert.equal(r.displayStandings()[1].pos,'—');assert.equal(r.finished,0);
 r=mk({virtualRivals:[entry(profile({mode:'competitor'}))]});r.tick(8100);r.cross(0,9100);assert.equal(r.displayStandings()[0].car.driverId,'virtual');assert.equal(r.displayStandings()[1].physicalPos,1);assert.equal(r.standings()[0].pos,1);
});
test('timed and distance replay finishes use the correct clock and source lane length',()=>{
 let r=mk({type:'timed',duration:.3});r.tick(18099);assert(!r.rivals[0].done);r.tick(25100);assert(r.rivals[0].done);assert.equal(r.rivals[0].laps.length,3);
 r=mk({distance:{distance:40,lanes:[{lane:0,length:20,laps:2}],max:0}});r.tick(17100);assert.equal(r.rivals[0].laps.length,2);assert(r.rivals[0].done);
});
test('physical race systems produce identical state with and without a rival',()=>{
 const extra={fuel:{on:true,tank:100,rate:10,perLap:2,pitHold:1000},penalty:E.penaltyConfig({everyPoints:1,everySeconds:2}),tyrewear:Tw.clean({setsMode:'none'}),weather:Wx.clean({startMode:'director'},1),damage:Dm.clean({deslotMs:20000}),pushsave:Ps.clean({mode:'median'}),safetycar:Sc.clean({target:10000}),bop:{on:true}};
 const a=E.createRace(cfg(extra)),b=E.createRace(cfg({...extra,virtualRivals:[]}));
 for(const r of [a,b]){r.start(100);r.cross(0,10100);r.setSystem('fuel',false,11100);r.cross(0,20100);r.setSystem('fuel',true,21100);r.addPoints(0,1,22100);r.block(0,25100,true);r.tick(28100);r.unblock(0,29100);r.setFlag('red',30100);r.setFlag('red',40100);r.cross(0,50100);}
 assert.deepEqual(a.cars,b.cars);assert.deepEqual(a.events,b.events);assert(a.rivals[0].laps.length>0);assert.equal(a.rivals[0].points,0);assert.equal(a.rivals[0].carId,'');
});
test('snapshot and remote viewer reconstruct replay from frozen settings, without drift or duplicates',()=>{
 const r=mk();r.tick(20100);const snap=r.snapshot(20100),restored=E.createRace(cfg());assert(restored.restore(snap));assert.deepEqual(restored.rivals[0].laps,r.rivals[0].laps);restored.resume(50100);restored.tick(55100);assert.equal(restored.rivals[0].laps.length,3);
 const v=Live.viewer();v.feedStatic(Live.packStatic(context(r,20100)));assert(v.feedDynamic(Live.packDynamic(context(r,20100)),777));assert.deepEqual(v.engine().rivals[0].laps,r.rivals[0].laps);assert.equal(v.shared(777).standings().length,2);
});
test('leaderboards, reusable row widgets and results render rivals without hardware lookups',()=>{
 const r=mk({virtualRivals:[entry(profile({mode:'competitor'})),{...entry(),driverId:'comparison'}]});r.cross(0,10100);const S=Live.makeShared(context(r,10100));assert.equal(S.standings().length,3);assert(S.carByLane(-1).virtualRival);
 for(const type of ['name','avatar','carname','position','laptime','gap','bestlap','avglap','medlap','fuel','pace','tyrelife','totaltime','textlane','aiolane','aiotiming','aiodriver','aioresults'])assert.equal(typeof Timing.content({type,lane:-1,opt:{}},S).html,'string',type);
 assert(Timing.content({type:'aiolane',lane:-1,opt:{}},S).html.includes('Virtual rival'));
 const composition={root:{kind:'column',children:[{kind:'value',key:'laps'},{kind:'component',component:'aiotiming'}]}};
 assert(Timing.content({type:'textlane',lane:-1,opt:{composition}},S).html.includes('1'));
 const values=Timing.composeValues(S,r.rivals[0],10100);assert.equal(values.laps,1);assert.equal(values.fuelpct,null);assert.equal(values.tyrelife,null);assert.equal(values.champ,null);
 assert(Timing.content({type:'leaderboard',opt:{}},S).html.includes('Virtual'));
 assert(Results.html(r,{},{}).includes('Virtual'));assert(!Results.html(r,{},{}).includes('Lane 0'));
 const design=Rows.blank?Rows.blank():{widgets:[Widgets.newWidget('name',0,0,0)],settings:{}};assert.equal(typeof Rows.html(design,S),'string');
});
test('database, export/import and deletion retain profile copies and links without virtual mileage',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sft-rival-')),db=new Database(path.join(dir,'db.json'));const t=db.add('tracks',{name:'Club',lanes:1}),p=db.add('virtualrivalsystems',profile({trackId:t.id})),d=db.add('drivers',{name:'Virtual',driverType:'virtual',virtualRivalSystem:p.id});
 const bundle=Transfer.collect(db.data,{drivers:[d.id]},true);assert(JSON.stringify(bundle).includes('virtualrivalsystems'));
 const copy=new Database(path.join(dir,'copy.json'));Transfer.apply(copy,bundle);const imported=copy.list('drivers')[0];assert(copy.list('virtualrivalsystems').some(x=>x.id===imported.virtualRivalSystem));assert(copy.list('tracks').some(x=>x.id===copy.list('virtualrivalsystems')[0].trackId));
 const r=mk();r.tick(17100);const id=db.saveSession({trackId:t.id,standings:[],virtualRivals:V.summary(r)},[]);assert.equal(db.list('laps').length,0);assert.equal(db.list('sessions').find(x=>x.id===id).virtualRivals[0].lapTimes.length,2);assert(V.historyHtml(db.list('sessions')[0]).includes('Virtual'));
 const rival={...V.summary(r)[0],driverId:d.id};const sessionId=db.saveSession({trackId:t.id,standings:[],virtualRivals:[rival],rivalClassification:[{driverId:d.id,pos:1,virtualRival:true}]},[]);
 const history=Transfer.collect(db.data,{sessions:[sessionId]},true),target=new Database(path.join(dir,'history.json'));Transfer.apply(target,history);const restored=target.list('sessions')[0];assert(target.list('drivers').some(x=>x.id===restored.virtualRivals[0].driverId));assert.equal(V.savedStandings(restored)[0].driverId,restored.virtualRivals[0].driverId);
});
test('physical penalties and review corrections survive display classification',()=>{
 const r=mk({entries:[{lane:0,driverId:'a'},{lane:1,driverId:'b'}]});r.cross(0,9100);r.cross(1,10100);r.adjust(1,{ms:3000});
 assert.deepEqual(r.displayStandings().filter(x=>!x.car.virtualRival).map(x=>x.gap),r.standings().map(x=>x.gap));
 const competing=mk({virtualRivals:[entry(profile({mode:'competitor'}))]});competing.cross(0,9100);competing.adjust(0,{ms:3000});assert.equal(competing.displayStandings()[1].gap,'+4.000');
});
test('distance rounding and equal-lap distance races use the configured finish rule',()=>{
 for(const [distance,count] of [[{distance:49,round:'nearest',lanes:[{lane:0,length:20,laps:2}]},2],[{distance:49,round:'up',lanes:[{lane:0,length:20,laps:3}]},3],[{distance:49,mode:'laps',lanes:[{lane:0,length:30,laps:2}]},2]]) {
  const r=mk({distance});r.tick(50000);assert.equal(r.rivals[0].laps.length,count);
 }
});
test('saved classification, report and final announcement agree without changing physical points',()=>{
 const r=mk({virtualRivals:[entry(profile({mode:'competitor'}))]});r.cross(0,10100);r.stop(10100);
 const physical=r.standings().map(x=>({pos:x.pos,driverId:x.car.driverId,driverName:x.car.driverName,laps:1,total:10000,best:10000}));
 const session={sessionType:'race',setupName:'Replay race',standings:physical,virtualRivals:V.summary(r),rivalClassification:r.displayStandings().map(x=>({driverId:x.car.driverId,pos:x.pos,physicalPos:x.physicalPos,virtualRival:!!x.car.virtualRival}))};
 assert.equal(V.savedStandings(session)[0].driverId,'virtual');assert.equal(session.standings[0].pos,1);assert.equal(V.savedStandings(session)[1].pos,2);
 assert(V.historyHtml(session).includes('Human'));assert(require('../renderer/report').sessionHtml({session,laps:[],tracks:[],cars:[]}).includes('Race classification including virtual rivals'));
 global.Announcer=require('../renderer/announcer');assert.equal(global.Announcer.catalogue.resultCalls(session).find(x=>x.call==='finalwinner').facts.driverId,'virtual');
 const a=global.Announcer.create({calls:{winner:{on:true}}});const calls=a.observe(r,{phase:'review',now:10100});assert.equal(calls.find(x=>x.call==='winner').vars.name,r.rivals[0].driverName);
});
test('each heat starts a fresh replay and manual record changes never mutate copied source',()=>{
 const p=profile(),a=mk({virtualRivals:[entry(p)]});a.tick(25100);p.recording[0].time=1;
 const b=mk();assert.equal(b.rivals[0].laps.length,0);b.tick(8100);assert.deepEqual(b.rivals[0].laps,[8000]);assert.equal(a.rivals[0].profile.recording[0].time,8000);
});
test('large recordings and malformed imported values are bounded and usable',()=>{
 const p=profile({recording:Array.from({length:100000},(_,i)=>({lap:i+1,time:8000})),speed:Infinity});assert.equal(V.sequence(p).length,100000);assert.equal(p.speed,100);
 assert.equal(V.sequence(profile({recording:[null,{time:-1},{time:Infinity},{time:'8000'},{time:8000,lap:1}]})).length,1);
 const r=mk({virtualRivals:[entry(p)]});assert(JSON.stringify(V.summary(r,false)).length<1000,'live summaries do not copy the recording every frame');
});
console.log('PASS '+checks+' Virtual Rival integration groups');


