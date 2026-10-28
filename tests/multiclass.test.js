const assert=require('node:assert/strict'),M=require('../renderer/multiclass'),E=require('../renderer/engine'),C=require('../renderer/championship'),CP=require('../renderer/champpoints'),LS=require('../renderer/liveshare');
let n=0;function test(name,f){f();console.log('ok '+name);n++;}
const profile=extra=>M.clean({name:'Club classes',classes:[{id:'gt',name:'GT3',color:'#53ba8a'},{id:'proto',name:'Prototypes',color:'#ab9eff'}],...extra});
const entries=[{lane:0,participant:0,driverId:'a',driverName:'Alex',raceClass:'gt'},{lane:1,participant:1,driverId:'b',driverName:'Sam',raceClass:'proto'},{lane:2,participant:2,driverId:'c',driverName:'Kim',raceClass:'gt'}];
const cfg=extra=>({type:'race',laps:10,endRule:'all',skipFirst:false,multiclass:profile(),entries:structuredClone(entries),classPoints:[10,8,6],...extra});
const race=extra=>{const r=E.createRace(cfg(extra));r.start(100);return r;};
test('assignment defaults, overrides and missing classes are explicit',()=>{
 const p=profile(),db={cars:[{id:'car',raceClass:'gt'}]};assert.equal(M.resolve({carId:'car'},p,db),'gt');assert.equal(M.resolve({carId:'car',raceClass:'proto'},p,db),'proto');assert.equal(M.validate(p,[{raceClass:'deleted'}]).length,1);assert.equal(M.validate(p,entries).length,0);assert(M.validate({...p,heats:'separate'},entries,{finals:'ab'}).length);
 const defs=p.classes;const frozen=M.freeze(p,defs);defs[0].name='Changed';assert.equal(frozen.classes[0].name,'GT3');assert.equal(M.freeze(p,[]).classes.length,0);
});
test('class positions and gap use adjusted physical classification',()=>{
 const r=race();r.cross(1,8100);r.cross(0,9100);r.cross(2,10100);let s=r.classStandings();assert.deepEqual(s.map(x=>[x.car.driverId,x.pos,x.classPos]),[['b',1,1],['a',2,1],['c',3,2]]);assert.equal(s[2].classGap.value,1000);assert.equal(s[1].classPoints,10);assert.equal(s[2].classPoints,8);
 r.adjust(0,{ms:5000});s=r.classStandings();assert.equal(s.find(x=>x.car.driverId==='c').classPos,1);assert.equal(s.find(x=>x.car.driverId==='a').classGap.value,4000);
 r.cars[2].dq=true;assert.equal(r.classStandings().find(x=>x.car.driverId==='c').classPos,null);assert.equal(r.classStandings().find(x=>x.car.driverId==='c').classPoints,0);
});
test('multi-class never changes physical timing or systems and replay cannot finish the race',()=>{
 const a=race(),b=race({multiclass:null});for(const [l,t] of [[0,8100],[1,9100],[2,10100],[0,16100]]){a.cross(l,t);b.cross(l,t);}assert.deepEqual(a.events,b.events);assert.deepEqual(a.standings().map(x=>[x.pos,x.gap,x.car.laps]),b.standings().map(x=>[x.pos,x.gap,x.car.laps]));
 const r=race({laps:1,endRule:'leader',virtualRivals:[{driverId:'v',profile:{trackId:'track',recording:[{time:1000,lap:1}],mode:'competitor',canFinish:true,end:'repeat'}}]});r.tick(4100);assert.equal(r.status,'running');assert(r.rivals[0].comparisonOnly);assert(!r.classStandings().some(x=>x.car.virtualRival));
});
test('separate heats retain all entries, lane exposure and class boundaries',()=>{
 const s=[[{p:0,lane:0},{p:1,lane:1},{p:2,lane:2}],[{p:1,lane:0},{p:2,lane:1},{p:0,lane:2}]],split=M.splitSchedule(s,entries,{...profile(),heats:'separate'});assert.equal(split.length,4);assert.deepEqual(split.flat().sort((a,b)=>a.p-b.p||a.lane-b.lane),s.flat().sort((a,b)=>a.p-b.p||a.lane-b.lane));assert(split.every(h=>new Set(h.map(x=>entries[x.p].raceClass)).size===1));
});
test('class points, fastest bonuses and dropped heats reuse heat scoring independently',()=>{
 const H=E.createHeatRace({participants:entries,schedule:[entries.map((e,p)=>({p,lane:e.lane})),entries.map((e,p)=>({p,lane:e.lane}))],lanes:3,resultBy:'points',points:[10,8,6],fastestBonus:2,dropWorst:true,multiclass:profile()});
 const r=race();r.cross(1,8100);r.cross(0,9100);r.cross(2,10100);r.stop(10101);H.record(r);
 const r2=race();r2.cross(2,7100);r2.cross(1,8100);r2.cross(0,9100);r2.stop(9101);H.record(r2);
 const o=H.overall(),c=H.classOverall();assert.equal(o.find(x=>x.driverId==='a').scorePoints,8);assert.equal(c.find(x=>x.driverId==='a').classPoints,12);assert.equal(c.find(x=>x.driverId==='b').classPoints,12);assert.equal(c.find(x=>x.driverId==='a').counted,1);assert.deepEqual(c.map(x=>[x.driverId,x.classPos]),[['c',1],['a',2],['b',1]]);
 const snap=H.snapshot(),rest=E.createHeatRace({participants:entries,schedule:H.schedule,lanes:3,resultBy:'points',points:[10,8,6],fastestBonus:2,dropWorst:true,multiclass:profile()});assert(rest.restore(snap));assert.deepEqual(rest.classOverall(),c);
});
test('class-only heat points never add to overall points',()=>{
 const H=E.createHeatRace({participants:entries,schedule:[entries.map((e,p)=>({p,lane:e.lane}))],lanes:3,resultBy:'points',points:[10,8,6],multiclass:profile({pointsMode:'class'})}),r=race();r.cross(0,8100);r.cross(1,9100);r.cross(2,10100);H.record(r);assert(H.overall().every(x=>x.points===0));assert.equal(H.classOverall().find(x=>x.driverId==='b').classPoints,10);
});
test('championship class positions, guests, bonuses, overrides and drops are independent',()=>{
 const c=C.clean({id:'ch',name:'Season',rounds:[{id:'r',sessions:[{id:'s',setup:'setup',share:100}]}],roster:entries.map(e=>({driver:e.driverId,from:1})),points:[25,18,15],bonusFast:1},true);
 const s={id:'s1',date:'2026-10-27',sessionType:'race',champ:{id:'ch',roundId:'r',sessionId:'s',kind:'race',awarded:1},multiclass:profile(),standings:[{pos:1,driverId:'b',driverName:'Sam',raceClass:'proto',laps:5,best:8000},{pos:2,driverId:'a',driverName:'Alex',raceClass:'gt',laps:5,best:9000},{pos:3,driverId:'c',driverName:'Kim',raceClass:'gt',laps:5,best:10000}]};
 const o=CP.standings(c,[s]),gt=CP.standings(c,[s],{classId:'gt'});assert.equal(o.drivers.find(x=>x.id==='a').total,18);assert.equal(gt.drivers.find(x=>x.id==='a').total,26);assert.equal(gt.drivers.length,2);
 s.multiclass.classes[0].points=[12,6];assert.equal(CP.standings(c,[s],{classId:'gt'}).drivers[0].total,13);
 s.multiclass.pointsMode='class';assert(CP.standings(c,[s]).drivers.every(x=>x.total===0));assert.equal(CP.standings(c,[s],{classId:'gt'}).drivers[0].total,13);
});
test('snapshot and second-screen reconstruction retain classes and review state',()=>{
 const r=race();r.cross(0,8100);r.cross(1,9100);const snap=r.snapshot(10100),q=E.createRace(cfg());q.restore(snap,20100);assert.deepEqual(q.classStandings().map(x=>[x.className,x.classPos]),r.classStandings().map(x=>[x.className,x.classPos]));
 assert.equal(r.rulesSnapshot().config.multiclass.classes.length,2);
});
test('class views and HTML escape data without changing race ordering',()=>{
 const r=race();r.cross(1,7100);r.cross(0,8100);const all=r.displayStandings(),gt=M.view(all,'class','gt');assert.equal(gt.length,2);assert.equal(all[0].car.driverId,'b');assert(M.resultsHtml(r.classStandings(),r.multiclass,true).includes('Class winners'));assert(!M.badge({className:'<script>',classColor:'#ffffff'}).includes('<script>'));
});
test('class-only heat adjustments, aggregate class gap and class best stay independent',()=>{
 const H=E.createHeatRace({participants:entries,schedule:[entries.map((e,p)=>({p,lane:e.lane}))],lanes:3,resultBy:'points',points:[10,8,6],multiclass:profile({pointsMode:'class'})}),r=race();r.cross(0,8100);r.cross(1,9100);r.cross(2,10100);r.adjust(2,{points:5});H.record(r);
 const cls=H.classOverall(),kim=cls.find(x=>x.driverId==='c'),alex=cls.find(x=>x.driverId==='a');assert.equal(kim.classPoints,13);assert.equal(kim.classPos,1);assert.deepEqual(alex.classGap,{kind:'points',value:3});assert.equal(kim.classBest,8000);assert(H.overall().every(x=>x.points===0));
});
test('class championship teams split their own class points between actual drivers',()=>{
 const c=C.clean({id:'ch',name:'Season',rounds:[{id:'r',sessions:[{id:'s',setup:'setup',share:100}]}],roster:[{driver:'a',team:'T1'},{driver:'c',team:'T1'},{driver:'b',team:'T2'}],teamRace:'split',points:[25,18,15]},true);
 const rows=[{pos:1,asTeam:true,teamId:'T2',raceClass:'proto',laps:10,best:8000,drivers:[{driverId:'b',laps:10}]},{pos:2,asTeam:true,teamId:'T1',raceClass:'gt',laps:10,best:9000,drivers:[{driverId:'a',laps:6},{driverId:'c',laps:4}],bestBy:'a'}];
 const s={id:'s1',sessionType:'endurance',champ:{id:'ch',roundId:'r',sessionId:'s',kind:'race',awarded:1},multiclass:profile(),standings:rows};
 const gt=CP.standings(c,[s],{classId:'gt'});assert.deepEqual(gt.drivers.map(r=>[r.id,r.total]),[['a',15],['c',10]]);assert.deepEqual(gt.teams.map(r=>[r.id,r.total]),[['T1',25]]);assert.equal(CP.standings(c,[s]).teams.find(r=>r.id==='T1').total,18);
 const unawarded={...s,champ:{...s.champ,awarded:undefined},multiclass:profile({pointsMode:'class'})};assert(CP.awardView(c,unawarded,[unawarded],{classId:'gt'}));
});
test('saved class identities export and remap exactly once, including team members',()=>{
 const T=require('../transfer'),schema=require('../schema'),data=Object.fromEntries(Object.keys(schema).map(k=>[k,[]]));data.customFields={};
 data.raceclasses=profile().classes;data.drivers=[{id:'a',name:'Alex',raceClass:'gt'}];data.slotcars=[{id:'car',brand:'Car',raceClass:'gt'}];data.teams=[{id:'team',name:'Team',drivers:['a'],raceClass:'gt'}];
 const row={raceClass:'gt',driverId:'a',carId:'car',teamId:'team',bestBy:'a',drivers:[{driverId:'a',laps:3}],stints:[{driverId:'a',laps:3}]};data.sessions=[{id:'session',multiclass:profile(),standings:[structuredClone(row)],classStandings:[structuredClone(row)],heatResults:[{rows:[structuredClone(row)]}]}];
 const bundle=T.collect(data,{sessions:['session']}),target={data:Object.fromEntries(Object.keys(schema).map(k=>[k,[]])),save(){}};target.data.customFields={};T.apply(target,JSON.parse(JSON.stringify(bundle)));
 const d=target.data,saved=d.sessions[0];for(const row of [saved.standings[0],saved.classStandings[0],saved.heatResults[0].rows[0]]){assert.equal(row.driverId,d.drivers[0].id);assert.equal(row.carId,d.slotcars[0].id);assert.equal(row.teamId,d.teams[0].id);assert.equal(row.raceClass,d.raceclasses.find(c=>c.name==='GT3').id);assert.equal(row.bestBy,d.drivers[0].id);assert.equal(row.drivers[0].driverId,d.drivers[0].id);assert.equal(row.stints[0].driverId,d.drivers[0].id);}
 assert.equal(saved.classStandings[0].drivers[0].driverId,d.drivers[0].id);assert.equal(saved.classStandings[0].stints[0].driverId,d.drivers[0].id);assert.equal(saved.classStandings[0].bestBy,d.drivers[0].id);assert.equal(saved.multiclass.classes[0].id,d.drivers[0].raceClass);
});
test('distance-class gaps reuse distance interpolation rather than unequal lane lap counts',()=>{
 const D=require('../renderer/distance'),dist=D.config({sessionType:'race',raceBy:'distance',distance:100},{length:20,lanes:3,laneModifier:'measured',laneLengths:'20,20,25'},3);
 const r=race({distance:dist});r.cross(0,8100);r.cross(2,9100);r.cross(0,16100);const rows=r.classStandings(),follower=rows.find(x=>x.classPos===2);assert.equal(follower.classGap.kind,'time');const lead=rows.find(x=>x.classPos===1&&x.raceClass===follower.raceClass);assert.equal(follower.classGap.value,r.distanceGapTo(follower.car,lead.car));
});
test('finished separate heats show the entire event, not the last heat field',()=>{
 const H=E.createHeatRace({participants:entries,schedule:[[{p:0,lane:0},{p:2,lane:2}],[{p:1,lane:1}]],lanes:3,resultBy:'points',points:[10,8,6],multiclass:profile({pointsMode:'class'})});
 const first=race({entries:entries.filter(e=>e.lane!==1),laps:1}),last=race({entries:[entries[1]],laps:1});first.cross(0,8100);first.cross(1,9100);H.record(first);last.cross(0,10100);H.record(last);
 const laps=[{driverId:'a',time:8000},{driverId:'c',time:9000},{driverId:'b',time:10000}],rows=M.eventRows(H,entries,laps,H.spentBy());assert.equal(rows.length,3);assert.equal(rows[0].driverName,'Alex');assert.equal(rows[0].resultStats.total,8000);assert.equal(rows[2].resultStats.average,10000);
 global.RaceEngine=E;global.Stats=require('../renderer/stats');const RV=require('../renderer/resultsview'),html=RV.html(last,{summary:['total','best','average','laps']},{phase:'finished',heat:{resultRows:rows,classRows:H.classOverall()}});assert(html.includes('<h2>Alex</h2>'));assert.equal((html.match(/<h2>(Alex|Sam|Kim)<\/h2>/g)||[]).length,3);assert(!html.includes('Lane 1001'));assert.equal(RV.value(last,rows[0],'laps'),1);
});
test('class leader audio distinguishes teammates and final calls use class winners',()=>{
 const A=require('../renderer/announcer'),r=race({entries:entries.map(x=>({...x,teamId:'club'}))}),a=A.create({calls:{classleader:{on:true}}});a.observe(r,{phase:'running',now:100});r.cross(0,8100);let calls=a.observe(r,{phase:'running',now:8100});assert(calls.some(x=>x.call==='classleader'&&x.vars.classname==='GT3'));r.cross(2,16100);r.cross(2,24100);calls=a.observe(r,{phase:'running',now:24100});assert(calls.some(x=>x.call==='classleader'&&x.vars.driver==='Kim'));
 const result=A.catalogue.resultCalls({multiclass:profile(),classStandings:[{driverName:'Alex',driverId:'a',classPos:1,className:'GT3',classPoints:25,laps:2},{driverName:'Sam',driverId:'b',classPos:1,className:'Prototypes',laps:0}],standings:[]});assert.equal(result.filter(x=>x.call==='classwinner').length,1);assert.equal(result.find(x=>x.call==='classwinner').vars.classpoints,25);
});
console.log(`PASS ${n} Multi-Class integration groups`);
