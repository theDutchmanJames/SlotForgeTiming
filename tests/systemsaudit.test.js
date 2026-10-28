const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const E=require('../renderer/engine'),M=require('../renderer/multiclass'),R=require('../renderer/resources'),T=require('../renderer/tyrewear'),Temp=require('../renderer/tyretemperature'),LS=require('../renderer/liveshare'),En=require('../renderer/endurance'),Store=require('../resource-store'),C=require('../renderer/championship'),CP=require('../renderer/champpoints'),Transfer=require('../transfer'),schema=require('../schema');
let n=0;const test=async(name,fn)=>{await fn();console.log('ok '+name);n++;};
const entry=(i=0)=>({lane:i,participant:i,driverId:'d'+i,driverName:'Driver '+i,carId:'c'+i,tyre:'M',raceClass:'gt'});
const mc=M.clean({classes:[{id:'gt',name:'GT3'}]});
const heat=(mode='laps',extra={})=>E.createHeatRace({participants:[entry(),entry(1)],schedule:[[{p:0,lane:0},{p:1,lane:1}],[{p:0,lane:0},{p:1,lane:1}],[{p:0,lane:0},{p:1,lane:1}]],lanes:2,resultBy:mode,points:[10,8],fastestBonus:2,multiclass:mc,...extra});
function round(dq=true){const e=E.createRace({type:'race',laps:7,entries:[entry(),entry(1)],multiclass:mc});e.start(0);for(let i=1;i<=7;i++){e.cross(0,i*1000);if(i%2===0)e.cross(1,i*1000);}e.stop(8000);if(dq)e.setDq(0,true);return e;}
const profile=extra=>({id:'supplies',...R.clean({owner:'driver',tyres:{M:3,H:2},...extra})});
const race=(state,extra={})=>E.createRace({type:'race',laps:100,entries:[entry()],resources:state,tyrewear:T.clean({}),...extra});
const thermal=T.clean({tempOn:'on',paceWear:'off',temperature:{tyres:{M:{...Temp.DEFAULT}}}});
function hot(){const e=race(null,{tyrewear:thermal});e.start(0);e.cars[0].twTemp=90;e.pause(1000);return e;}
(async()=>{
await test('DQ heat contributes no class score, record or championship award in every scoring mode',()=>{
 for(const mode of ['laps','points','time']){const h=heat(mode),e=round();h.record(e);const rows=h.classOverall(),bad=rows.find(r=>r.driverId==='d0');assert.equal(rows[0].driverId,'d1');assert.equal(bad.classPos,null);assert.equal(bad.laps,0);assert.equal(bad.best,null);assert.equal(bad.classPoints,0);assert.equal(h.results[0].rows.find(r=>r.participant===0).points,0);assert(!M.resultsHtml(rows,mc,true).includes('1. Driver 0'));
 const c=C.clean({id:'ch',rounds:[{id:'r',sessions:[{id:'s',setup:'setup',share:100}]}],roster:[{driver:'d0',from:1},{driver:'d1',from:1}],points:[25,18]},true),session={id:'saved',date:'2026-10-27',sessionType:'heats',champ:{id:'ch',roundId:'r',sessionId:'s',kind:'race',awarded:1},multiclass:mc,standings:h.overall(),classStandings:rows};
 assert.equal(CP.standings(c,[session],{classId:'gt'}).drivers.find(r=>r.id==='d0').total,0);
 }
});
await test('valid heats survive a DQ and the dropped worst heat is the DQ',()=>{
 const h=heat('laps',{dropWorst:true});h.record(round());h.record(round(false));h.record(round(false));const d=h.classOverall().find(r=>r.driverId==='d0');assert.equal(d.scoreLaps,14);assert.equal(d.dq,undefined);assert.deepEqual(d.dropped,[1]);assert.equal(d.classPos,1);
 const mean=heat('laps',{countBy:'average'});mean.record(round());mean.record(round(false));assert.equal(mean.classOverall().find(r=>r.driverId==='d0').scoreLaps,3.5);
});
await test('a disqualified class result cannot supply tie-breaking wins or a class best lap',()=>{
 const h=heat('points',{tieBreak:'wins'}),e=round();e.setDq(1,true);h.record(e);h.record(round(false));
 assert.equal(h.classOverall().find(r=>r.driverId==='d0').wins,1);
 // A final DQ in places mode excludes the driver even when a valid heat had a faster lap.
 const final=heat('points',{finals:'single',finalMode:'places'});final.record(round(false));final.results.push({heat:2,final:'A',rows:[{participant:0,raceClass:'gt',pos:2,dq:true,laps:7,best:900,total:7000,points:0},{participant:1,raceClass:'gt',pos:1,laps:7,best:1800,total:14000,points:10}]});
 final.finalPlan=[{name:'A',drivers:[0,1]}];const rows=final.classOverall();assert(rows.find(r=>r.participant===0).dq);assert.equal(rows[0].classBest,1800);
});
await test('a tyre correction exchanges the original supplying account after a real driver swap',()=>{
 const s=R.prepare(profile(),{runId:'swap'}),e=race(s,{entries:[{...entry(),teamId:'team',roster:[{id:'d0',name:'Alex'},{id:'relief',name:'Blair'}]}],endurance:En.clean({sessionType:'endurance',swapMode:'free',swapConfirm:'button',swapSeconds:0,stintMin:0})});e.start(0);assert(e.swap(0,10000).ok);assert.equal(e.cars[0].driverId,'relief');e.cars[0].twLife=40;assert(e.setTyre(0,'H',11000));assert.equal(e.cars[0].twLife,40);
 const a=Object.values(s.accounts).find(a=>a.ownerId==='d0');assert.equal(a.balance['tyre:M'],3);assert.equal(a.balance['tyre:H'],1);assert.equal(e.resourceBalance(e.cars[0])['tyre:M'],3);
 const copy=race(structuredClone(s),{entries:[entry()]});assert(copy.restore(e.snapshot(12000)));assert.equal(copy.cars[0].resourceTyreAccount,a.key);assert(copy.setTyre(0,'M',13000));assert.equal(copy.resources.accounts[a.key].balance['tyre:H'],2);
 const before=JSON.stringify(copy.resources);assert(!copy.setTyre(0,'W',14000));assert.equal(JSON.stringify(copy.resources),before);
 // A subsequent real fit belongs to the incoming driver; its later correction must follow that new provenance.
 const fit=race(R.prepare(profile(),{runId:'fit'}),{fuel:{on:true,tank:100,perLap:1,rate:20,pitHold:1000},tyrewear:T.clean({changeSeconds:2})});fit.start(0);fit.cars[0].driverId='relief';fit.block(0,10000);fit.tick(12500);assert.equal(fit.cars[0].twStops,1);assert.equal(fit.resources.accounts[fit.cars[0].resourceTyreAccount].ownerId,'relief');assert(fit.setTyre(0,'H',13000));assert.equal(fit.resourceBalance(fit.cars[0])['tyre:M'],3);
 assert.equal(Object.values(fit.resources.accounts).find(a=>a.ownerId==='d0').balance['tyre:M'],2);

});
await test('incomplete ownership produces an empty tyre allowance and a helpful blocked start',()=>{
 for(const owner of ['car','driver','team']){const c={...entry(),carId:'',driverId:'',teamId:''},s=R.prepare(profile({owner}),{runId:owner}),e=race(s,{entries:[c]});assert.doesNotThrow(()=>T.view(e,[0],0));assert.equal(e.twOf(0,0).sets.M,0);assert.equal(e.start(0),false);assert.match(e.resourceError,/needs a/);assert.equal(s.events.length,0);assert.equal(Object.keys(s.accounts).length,0);}
});
await test('unused and zero championship allocations persist, with rollback and idempotent checkpoints',async()=>{
 for(const allowance of [0,5]){const p=profile({owner:'car',scope:'championship',tyresOn:false,repairsOn:true,repairs:allowance}),db={data:{},list:()=>[p],commit:async()=>true},store=new Store(db),s=await store.begin(p.id,{runId:'one',champId:'cup'}),e=race(s);e.start(0);const snap={race:{resources:structuredClone(s)}};
 db.commit=async()=>{throw Error('disk');};await assert.rejects(store.save(snap),/disk/);assert.equal(Object.keys((await store.read()).accounts).length,0);db.commit=async()=>true;
 await store.save(snap);await store.save(snap);assert.equal((await store.read()).history.length,0);await store.clear();p.repairs=99;const next=await store.begin(p.id,{runId:'two',champId:'cup'});assert.equal(R.available(next,entry(),0,'repair'),allowance);}
});
await test('paused toggles settle active cooling and exclude disabled time regardless of checkpoint cadence',()=>{
 for(const cadence of [0,1000,30000]){const e=hot();e.setSystem('tyrewear',false,31000);if(cadence)for(let t=31000;t<=91000;t+=cadence)e.snapshot(t);e.setSystem('tyrewear',true,91000);assert.equal(e.twOf(0,91000).temperature.value,80);e.resume(91000);assert.equal(e.cars[0].twTemp,80);}
});
await test('paused Weather toggles settle cooling using the previous ambient',()=>{
 const e=race(null,{tyrewear:thermal,weather:require('../renderer/weather').clean({startMode:'manual',airTempWet:15})});e.start(0);e.wxSet('wet',0,'director');e.cars[0].twTemp=18;e.pause(1000);
 e.setSystem('weather',false,31000);assert.equal(e.twOf(0,31000).temperature.value,15);
 e.setSystem('weather',true,61000);assert.equal(e.twOf(0,61000).temperature.value,20);assert.equal(e.twOf(0,91000).temperature.value,15);
});
await test('the recovered paused thermal clock is identical in the second-screen engine',()=>{
 const original=hot(),e=race(null,{tyrewear:thermal});e.restore(original.snapshot(31000));const v=LS.viewer(),ctx={raceId:'recovery',eng:e,setup:{sessionType:'race'},layout:{widgets:[]},track:{},lanes:1,phase:'paused',now:1000000,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity},sender=LS.sender();
 v.feedStatic(JSON.parse(JSON.stringify(LS.packStatic(ctx))));v.feedDynamic(JSON.parse(JSON.stringify(sender.pack(ctx,ctx.now))),500);assert.equal(v.shared(500).eng.twOf(0,v.clock(500)).temperature.value,80);
 e.resume(1000000);e.setFlag('yellow',1000000);e.tick(1030000);ctx.now=1030000;ctx.phase='running';v.feedDynamic(JSON.parse(JSON.stringify(sender.pack(ctx,ctx.now))),30500);assert.equal(v.shared(30500).eng.twOf(0,v.clock(30500)).temperature.value,e.twOf(0,1030000).temperature.value);
});
await test('resource profiles can be picked and exported without balances',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../renderer/transferui.js'),'utf8');for(const name of ['TR_GROUPS','ORDER_DEPS']){const x=vm.runInNewContext(ui.match(new RegExp('const '+name+' = ([^\\r\\n]+);'))[1]);assert(name==='TR_GROUPS'?x.some(([,a])=>a.includes('resourcesystems')):x.includes('resourcesystems'));}
 const data=Object.fromEntries(Object.keys(schema).map(k=>[k,[]]));data.customFields={};data.resourcesystems=[profile()];data.resourceLedger={accounts:{secret:{}}};const bundle=Transfer.collect(data,{resourcesystems:['supplies']});assert.equal(bundle.items.resourcesystems.length,1);assert(!JSON.stringify(bundle).includes('secret'));
});
await test('car labels drive the class catalogue and enforce driver-car combinations',()=>{
 const defs=[{id:'gt',name:'GT3'},{id:'p',name:'Prototype'},{id:'unused',name:'Unused'}],db={cars:[{id:'gtcar',raceClass:'gt'},{id:'pcar',raceClass:'p'},{id:'unlabelled'}],drivers:[{id:'a'},{id:'b'}],teams:[]},p=M.clean({assignment:'roster',classes:defs.slice(0,2),driverClasses:[{driverId:'a',classId:'gt'},{driverId:'b',classId:'p'}]});
 assert.deepEqual(M.catalogue(db.cars,defs).map(c=>c.id),['gt','p']);assert.equal(M.resolve({driverId:'a',raceClass:'p'},p,db),'gt');assert.deepEqual(M.carsFor({driverId:'a'},p,db).map(c=>c.id),['gtcar']);assert.equal(M.carsFor({driverId:'unknown'},p,db).length,0);assert(M.entryIssues(p,[{driverId:'a',carId:'pcar'}],db).length);assert.equal(M.entryIssues(p,[{driverId:'a',carId:'gtcar'}],db).length,0);
 db.cars[0].raceClass='p';assert(M.entryIssues(p,[{driverId:'a',carId:'gtcar'}],db).length);assert.equal(M.entryIssues(p,[{absent:true}],db).length,0);
});
await test('a shared car requires the whole team roster to be assigned to the same class',()=>{
 const db={cars:[{id:'c',raceClass:'gt'}],teams:[{id:'team',drivers:['a','b']} ]},p=M.clean({assignment:'roster',classes:[{id:'gt',name:'GT3'},{id:'p',name:'Prototype'}],driverClasses:[{driverId:'a',classId:'gt'},{driverId:'b',classId:'p'}]}),row={teamId:'team',carId:'c'};assert(M.entryIssues(p,[row],db).length);p.driverClasses[1].classId='gt';assert.equal(M.resolve(row,p,db),'gt');assert.equal(M.entryIssues(p,[row],db).length,0);
 const frozen=M.freeze(p,p.classes);p.driverClasses[0].classId='p';assert.equal(M.driverClass(frozen,'a'),'gt');
});
await test('new driver assignments export/import with remapped identities',()=>{
 const data=Object.fromEntries(Object.keys(schema).map(k=>[k,[]]));data.customFields={};data.raceclasses=[{id:'gt',name:'GT3'}];data.drivers=[{id:'a',name:'Alex'}];data.multiclasssystems=[{id:'mc',...M.clean({assignment:'roster',classes:data.raceclasses,driverClasses:[{driverId:'a',classId:'gt'}]})}];
 const bundle=Transfer.collect(data,{multiclasssystems:['mc']}),target={data:Object.fromEntries(Object.keys(schema).map(k=>[k,[]])),save(){}};target.data.customFields={};Transfer.apply(target,JSON.parse(JSON.stringify(bundle)));const p=target.data.multiclasssystems[0];assert.equal(p.driverClasses[0].driverId,target.data.drivers[0].id);assert.equal(p.driverClasses[0].classId,target.data.raceclasses[0].id);
});
console.log(`${n} systems audit repair groups passed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
