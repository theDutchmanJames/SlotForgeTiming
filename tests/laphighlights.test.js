const assert=require('node:assert/strict');
const H=require('../renderer/laphighlights'),F=require('../renderer/frame'),E=require('../renderer/engine'),LS=require('../renderer/liveshare');
const base={personal:new Map([['a',9000]]),track:8000},live={flash:new Map(),bestBy:new Map(),bestAll:Infinity};
const car={driverId:'a',driverName:'Alex',lane:0,laps:[],bad:[],invalid:[],removed:[]};
assert.equal(H.record(car,0,live,base,1),false,'formation has no completed lap');
for(const [time,kind]of [[9500,''],[8500,'pb'],[7500,'record']]){const before=car.laps.length;car.laps.push(time);H.record(car,before,live,base,10+before);assert.equal(live.flash.get(car).kind,kind);}
const best=live.bestAll;car.invalid.push(car.laps.length);car.laps.push(1000);H.record(car,3,live,base,50);assert.equal(live.flash.get(car).kind,'');assert.equal(live.bestAll,best,'invalid red-flag lap never changes records');
car.bad[4]=true;car.laps.push(20000);H.record(car,4,live,base,60);assert.equal(live.flash.get(car).kind,'','slow lap confirms recording only');
assert.equal(H.settings().lapEnabled,true);assert.equal(H.settings().lapPbColor,'#38d27a');
assert.equal(H.settings({opt:{pbColor:'#abc'}}).lapPbColor,'#aabbcc');assert.equal(H.settings({opt:{pbColor:'#abc'}},{widgetAppearance:{lapPbColor:'#123456'}}).lapPbColor,'#123456');
assert.equal(H.settings({appearance:{lapEnabled:false}},{widgetAppearance:{lapEnabled:true}}).lapEnabled,false);
assert.equal(F.modern({appearance:{lapEnabled:false,lapDuration:800}},{}),false,'Highlight controls do not migrate legacy surfaces');
const clean=F.cleanAppearance({lapEnabled:false,lapDuration:9000,lapIntensity:-1,lapSource:'evil',lapRecordColor:'url(x)'});assert.deepEqual(clean,{lapIntensity:5,lapDuration:1500,lapEnabled:false});
assert.deepEqual(F.pickLayout({widgetAppearance:clean}).widgetAppearance,clean);
// No DOM writes are needed for initial snapshots, unchanged frames, global
// widgets, expired events or hidden tabs. Animation geometry is tested in Electron.
const c={lane:0,driverId:'a',laps:[9000],bad:[],invalid:[],removed:[]};let flash={at:100,time:9000,kind:'pb',index:0};
const S={eng:{cars:[c]},now:100,carByLane:()=>c,flashOf:()=>flash};const n={w:{type:'name',lane:0},layout:{},el:{isConnected:true,dataset:{}},val:{}};
H.update(n,S);assert.equal(n.lapActive.size,0,'opening a display does not replay history');H.update(n,S);assert.equal(n.lapActive.size,0);
c.laps.push(8500);flash={at:200,time:8500,kind:'pb',index:1};S.now=200;H.update(n,S);assert.equal(n.lapActive.size,1);H.update(n,S);assert.equal(n.lapTargets.size,1);
c.invalid.push(1);assert.equal(H.eventFor(c,S).kind,'');S.now=900;H.update(n,S);assert.equal(n.lapActive.size,0);H.dispose(n);assert.equal(n.lapSeen.size,0);
const globalNode={w:{type:'clock',lane:-1}};H.update(globalNode,S);assert.equal(globalNode.lapSeen,undefined);
const rival={...c,virtualRival:true};assert.equal(H.eventFor(rival,{now:10}).kind,'');
// The actual engine's invalidation and network clock translation feed the same
// eligibility on the viewer, including the index of the accepted crossing.
const eng=E.createRace({type:'race',laps:20,entries:[{lane:0,driverId:'a',driverName:'Alex'}]});eng.start(0);eng.cross(0,1000);const count=eng.cars[0].laps.length;eng.cross(0,10000);
const l={flash:new Map(),bestAll:Infinity,bestBy:new Map()},b={personal:new Map([['a',12000]]),track:8500};H.record(eng.cars[0],count,l,b,10000);
const ctx={raceId:'lap-qa',eng,setup:{},layout:{widgets:[]},track:{},lanes:1,base:b,now:10000,phase:'running',...l};
const d=LS.packDynamic(ctx);assert.equal(d.flash[0][4],eng.cars[0].laps.length-1);assert.equal(JSON.parse(JSON.stringify(d)).flash[0][3],l.flash.get(eng.cars[0]).kind);
eng.cars[0].invalid.push(eng.cars[0].laps.length-1);assert.equal(H.eligible(eng.cars[0],eng.cars[0].laps.length-1),false);
const viewer=LS.viewer();viewer.feedStatic(LS.packStatic(ctx));viewer.feedDynamic(d,50000);const view=viewer.shared(50000);
assert.equal(view.flashOf(view.eng.cars[0]).at,10000,'Viewer preserves host event time');assert.equal(view.now,10000,'Viewer converts its local clock');
const pit=E.createRace({type:'race',skipFirst:true,minLap:2000,laps:10,entries:[{lane:0,driverId:'a'}]});pit.start(0);
const pl={flash:new Map(),bestBy:new Map(),bestAll:Infinity};pit.cross(0,1000);assert.equal(H.record(pit.cars[0],0,pl,b,1000),false);pit.cross(0,1500);assert.equal(H.record(pit.cars[0],0,pl,b,1500),false,'Debounced sensor has no pulse');
pit.block(0,10000);assert.equal(H.record(pit.cars[0],0,pl,b,10000),true,'Combined pit sensor can record a lap');assert.equal(pl.flash.size,1);
console.log('Lap Highlights: eligibility, priority, inheritance, saved colours, snapshot suppression, deduplication, expiry and sharing passed.');
