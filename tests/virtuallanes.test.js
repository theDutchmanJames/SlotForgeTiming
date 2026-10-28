const assert=require('node:assert/strict');
const V=require('../renderer/virtualrival'),E=require('../renderer/engine'),Live=require('../renderer/liveshare');
const Timing=require('../renderer/timing');
const drivers=[{id:'h',name:'Human'},{id:'v',name:'Rival',driverType:'virtual',virtualRivalSystem:'p'}];
const profiles=[{id:'p',name:'Replay',trackId:'t',recording:[{lap:1,time:8000}],end:'repeat',mode:'competitor'},{id:'q',name:'Other',trackId:'t',recording:[{lap:1,time:9000}]}];
const human={driverId:'h',driverName:'Human',carId:'car'},rival={driverId:'v',virtualRival:true};
const selection=rows=>V.gridEntries(rows,drivers,profiles,'t');
const specs=selection([human,rival]).entries;
const config=(lane=1,extra={})=>({type:'race',laps:10,endRule:'all',entries:[{...human,lane:1-lane},{...rival,lane}],virtualRivals:specs,...extra});
let checks=0;const test=(name,fn)=>{fn();checks++;console.log('ok '+name);};
test('lane selections use linked defaults or per-row replay overrides, never need a car',()=>{
 assert.equal(specs.length,1);assert(specs[0].grid);assert.equal(specs[0].profileId,'p');
 assert.equal(selection([{...rival,rivalProfileId:'q'}]).entries[0].profileId,'q');
 assert.equal(drivers[1].virtualRivalSystem,'p');
 assert(selection([{...rival,rivalProfileId:'deleted'}]).errors.length);
 assert(V.gridEntries([rival],drivers,profiles,'wrong-track').errors.length);
 assert(selection([rival,rival]).errors.length);
 assert.equal(selection([{...rival,absent:true}]).entries.length,0);
 assert.equal(selection([human]).entries.length,0);
});
for(const lane of [0,1])test('replay in lane '+(lane+1)+' preserves physical indices and shared display identity',()=>{
 const r=E.createRace(config(lane));r.start(100);r.tick(8100);
 assert.equal(r.cars.length,1);assert.equal(r.cars[0].lane,1-lane);assert.equal(r.rivals[0].lane,lane);
 assert.equal(r.cars.findIndex(c=>c.lane===lane),-1,'hardware lookup cannot find a virtual car');
 assert.deepEqual(r.rivals[0].laps,[8000]);r.cross(0,9100);assert.deepEqual(r.cars[0].laps,[9000]);
 const ctx={eng:r,now:9100,phase:'running',track:{id:'t'},setup:{sessionType:'race'},layout:{laneColors:[]},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map()};
 const S=Live.makeShared(ctx);assert.equal(S.carByLane(lane),r.rivals[0]);
 assert.equal(Timing.content({type:'textlane',lane,opt:{text:'{lane}'}} ,S).html,String(lane+1));
 assert(Timing.content({type:'laptime',lane,opt:{}},S).html);
 assert.equal(V.summary(r)[0].lane,lane);
 const viewer=Live.viewer();viewer.feedStatic(Live.packStatic(ctx));assert(viewer.feedDynamic(Live.packDynamic(ctx),100));
 assert.equal(viewer.engine().cars.length,1);assert.equal(viewer.engine().rivals[0].lane,lane);
 const restored=E.createRace({...r.rulesSnapshot().config,entries:r.cfg.entries});assert(restored.restore(r.snapshot(9100)));
 assert.equal(restored.cars[0].lane,1-lane);assert.equal(restored.rivals[0].lane,lane);assert.deepEqual(restored.rivals[0].laps,[8000]);
});
test('physical fuel, pits, penalties and red flags behave identically with an assigned replay',()=>{
 const cfg=config(0,{fuel:{on:true,tank:100,rate:10,perLap:2,pitHold:1000},penalty:E.penaltyConfig({everyPoints:1,everySeconds:2})});
 const a=E.createRace(cfg),b=E.createRace({...cfg,entries:cfg.entries.filter(e=>e.driverId==='h'),virtualRivals:[]});
 for(const r of [a,b]){r.start(100);r.cross(0,10100);r.addPoints(0,1,11100);r.block(0,12100,true);r.tick(15100);r.unblock(0,16100);r.setFlag('red',17100);r.setFlag('red',27100);r.cross(0,30100);}
 assert.deepEqual(a.cars,b.cars);assert.deepEqual(a.events,b.events);assert.equal(a.rivals[0].points,0);assert.equal(a.rivals[0].carId,'');
});
test('heats rotate virtual display lanes, omit inactive rivals and exclude them from points and finals',()=>{
 const participants=[human,rival,{driverId:'h2',driverName:'Other human',carId:'c2'}];
 const schedule=[[{p:0,lane:0},{p:1,lane:1}],[{p:1,lane:0},{p:2,lane:1}],[{p:0,lane:0},{p:2,lane:1}]];
 const h=E.createHeatRace({participants,schedule,lanes:2,resultBy:'points',points:[10,8],finals:'a'});
 for(let i=0;i<3;i++){
   const r=E.createRace(config(1,{entries:h.entries(),laps:1}));
   assert.equal(r.rivals.length,i<2?1:0);if(i<2)assert.equal(r.rivals[0].lane,1-i);
   r.start(100);r.cars.forEach((c,k)=>r.cross(k,10100+k*1000));h.record(r);
 }
 assert.deepEqual(h.overall().map(x=>x.driverId).sort(),['h','h2']);
 assert(h.overall().every(x=>x.points>0));
 assert(h.entries().every(x=>x.driverId!=='v'),'finals have human qualifiers only');
});
test('old separate replay configurations retain their negative lane and do not displace humans',()=>{
 const r=E.createRace(config(1,{entries:[{...human,lane:0}],virtualRivals:specs.map(({grid,...e})=>e)}));
 assert.equal(r.cars.length,1);assert.equal(r.rivals[0].lane,-1);
});
test('championship totals exclude virtual participants without renumbering human participants',()=>{
 const Season=require('../renderer/season'),Champ=require('../renderer/championship');
 const c=Champ.clean({id:'ch',name:'Club',roster:[],rounds:[]},true);
 const result=Season.now(c,[],{id:'ch',roundId:'r',kind:'race'},[rival,human],null);
 assert.deepEqual(result.order.map(x=>x[0]),[1]);assert.deepEqual(result.pts.map(x=>x[0]),[1]);
});
console.log(checks+' VIRTUAL LANE TESTS PASSED');
