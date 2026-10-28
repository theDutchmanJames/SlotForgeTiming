const assert=require('assert/strict'),E=require('../renderer/engine'),T=require('../renderer/tyrewear'),W=require('../renderer/weather'),A=require('../renderer/announcer'),LS=require('../renderer/liveshare'),TW=require('../renderer/tyrewidgets'),WW=require('../renderer/weatherwidgets');
const dry='C_1234567890ABCDEF',wet='C_1234567890ABCDE0';
const tyres={...T.defaults().tyres,[dry]:{...T.defaults().tyres.S,name:'Club slick',icon:'S',cls:'dry',wear:.125},[wet]:{...T.defaults().tyres.W,name:'Club rain',icon:'W',cls:'wet',wear:2}};
const cfg=()=>({type:'race',laps:99,entries:[{lane:0,driverName:'Alex',tyre:dry}],fuel:{on:true,tank:100,perLap:.5,rate:10,pitHold:2000},tyrewear:T.clean({tyres,paceWear:'off',effect:'off',changeSeconds:0,setsMode:'car',sets:{[dry]:3,[wet]:2}}),weather:W.clean({startMode:'manual'})});
const race=()=>{const r=E.createRace(cfg());r.start(0);r.cross(0,10000);return r;};
const stop=(r,t)=>{r.block(0,t);r.tick(t+2500);r.unblock(0,t+3000);};
let n=0;const test=(name,fn)=>{fn();n++;console.log('ok '+name);};
test('custom definitions retain precise wear, icons and category without leaking to other races',()=>{
 const c=T.clean({tyres}),local=W.withTyres(c.tyres);assert.equal(c.tyres[dry].wear,.125);assert.equal(local.tyreName(dry),'Club slick');assert.equal(local.classOf(wet),'wet');assert.equal(W.tyreOf(dry),null);
 const r=race(),old=r.rulesSnapshot();tyres[dry].name='Renamed slick';assert.equal(T.view(r,[0],10000).rows[0].tyre,'Club slick');assert.equal(old.config.tyrewear.tyres[dry].name,'Club slick');assert.equal(W.withTyres(tyres).tyreName(dry),'Renamed slick');tyres[dry].name='Club slick';
 assert.equal(W.withTyres({[dry]:{name:'Invalid',icon:'unknown'}}).tyreOf(dry),null);
 assert.equal(W.withTyres({'<script>':{name:'Bad',icon:'M'}}).TYRES.length,9);
});
test('custom starting tyres consume sets and exact configured wear; missing definitions safely fall back',()=>{
 const r=race(),c=r.cars[0];assert.equal(c.tyre,dry);assert.equal(c.twSets[dry],2);assert.equal(c.twLife,99.875);
 assert.equal(E.createRace({type:'race',entries:[{lane:0,tyre:dry}]}).cars[0].tyre,'M');
});
test('custom rain queues wait for weather, fit the matching category, then return to own slick',()=>{
 const r=race(),c=r.cars[0];assert(r.twQueue(0,wet,10001));stop(r,12000);assert.equal(c.tyre,dry);assert.equal(c.twNext,wet);
 r.wxSet('wet',16000);stop(r,17000);assert.equal(c.tyre,wet);assert.equal(c.twNext,'');assert.equal(c.twSets[wet],1);assert.equal(c.tyreOwn,dry);
 assert.equal(W.withTyres(tyres).classOf(c.tyre),'wet');assert.equal(c.wx,0);
 r.wxSet('dry',21000);stop(r,22000);assert.equal(c.tyre,dry);assert.equal(c.twSets[dry],0);assert.equal(c.twStops,3);
});
test('custom names reach audio, checkpoint recovery, shared displays and widget icons',()=>{
 const r=race(),an=A.create({});an.observe(r,{phase:'running'});assert(r.twQueue(0,wet,10001));
 const call=an.observe(r,{phase:'running'}).find(x=>x.call==='tyrequeued');assert.equal(call.vars.tyre,'Club rain');
 const snap=r.snapshot(10001),recovered=E.createRace(cfg());assert(recovered.restore(snap));assert.equal(recovered.cars[0].twNext,wet);
 const context={raceId:'custom',eng:r,setup:{sessionType:'race'},layout:{widgets:[]},track:{},lanes:1,phase:'running',now:10001,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
 const viewer=LS.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(LS.packStatic(context))));viewer.feedDynamic(JSON.parse(JSON.stringify(LS.sender().pack(context,10001))),10001);
 const shared=viewer.shared(10001);assert.equal(T.view(shared.eng,[0],10001).rows[0].tyre,'Club slick');assert.equal(WW.laneVars(shared.eng.cars[0],shared.eng).tyre,'Club slick');
 const row=T.view(shared.eng,[0],10001).rows[0];assert.equal(row.icon,'S');assert(row.catalog.some(t=>t.code===wet));
});
test('custom compound identity counts for mandatory dry choices and survives result history',()=>{
 const config=cfg();config.tyrewear=T.clean({tyres,mandTwo:'on',changeSeconds:0,setsMode:'none'});const r=E.createRace(config);r.start(0);r.cross(0,10000);
 assert.equal(r.mandOf(0).dry,1);r.twQueue(0,'M',11000);stop(r,12000);r.cross(0,25000);assert.equal(r.mandOf(0).dry,2);
 const session={rulesSnapshot:r.rulesSnapshot(),standings:[{driverName:'Alex',tyres:r.twStintsOf(0)}]},ST=require('../renderer/stats');
 const saved=ST.tyreStints(session,'m')[0].groups[0].stints[0];assert.equal(saved.name,'Club slick');assert.match(saved.label,/^S ·/);assert.equal(saved.color,W.tyreOf('S').color);
 const atFlag=race(),savedFlag={rulesSnapshot:atFlag.rulesSnapshot(),standings:[{driverName:'Alex',tyres:atFlag.twStintsOf(0)}]};assert.equal(ST.text('tyres',ST.forSession(savedFlag,[],[],[])[0]),'Club slick');
 const words=require('../renderer/systemwords').describe('tyrewearsystems',{tyres,setsMode:'none'});assert(words.pills.some(p=>p.text==='11 tyres'));
 const row=T.view(r,[0],25000).rows[0],html=TW.setsRowHtml({...row,setsMode:'car',sets:{[dry]:2,[wet]:1},setsStart:{[dry]:3,[wet]:2}},{look:'list'}).html;assert(html.includes('Club slick')&&html.includes('Club rain'));
});
test('exporting a car with dependencies carries custom definitions through import',()=>{
 const fs=require('fs'),os=require('os'),path=require('path'),DB=require('../db'),Transfer=require('../transfer'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-custom-'));
 try{const a=new DB(path.join(dir,'a.json')),b=new DB(path.join(dir,'b.json'));a.add('tyrewearsystems',{name:'Club tyres',tyres,sets:{[dry]:4,[wet]:2}});const car=a.add('slotcars',{brand:'Club',model:'GT',tyreCompound:dry});
  const bundle=Transfer.collect(a.data,{slotcars:[car.id]},true);assert.equal(bundle.items.tyrewearsystems.length,1);assert.equal(Transfer.dependencies(a.data,{slotcars:[car.id]}).tyrewearsystems.length,1);assert(!Transfer.collect(a.data,{slotcars:[car.id]},false).items.tyrewearsystems);
  Transfer.apply(b,bundle);const imported=b.list('tyrewearsystems')[0],importedCar=b.list('slotcars')[0];assert.equal(importedCar.tyreCompound,dry);assert.equal(T.clean(imported).tyres[dry].wear,.125);assert.equal(W.withTyres(imported.tyres).tyreName(importedCar.tyreCompound),'Club slick');assert.equal(imported.sets[dry],4);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
console.log(n+' CUSTOM TYRE INTEGRATION GROUPS PASSED');
