const assert=require('node:assert/strict'),C=require('../renderer/widgetcompose'),W=require('../renderer/widgets'),T=require('../renderer/timing'),E=require('../renderer/engine'),Share=require('../renderer/liveshare'),Tw=require('../renderer/tyrewear'),Ps=require('../renderer/pushsave');
let count=0;const test=(name,fn)=>{fn();count++;console.log('ok '+name);};
const race=()=>{const e=E.createRace({type:'race',laps:20,minLap:100,entries:[{lane:0,driverName:'James & <Co>',driverId:'a',carName:'Mosler'}],fuel:{on:true,tank:100,perLap:2,rate:2,pitHold:2000,empty:'warn'},tyrewear:Tw.clean({}),pushsave:Ps.clean({}),pitControl:{mode:'manual',seconds:30}});e.start(0);for(let i=1;i<=5;i++)e.cross(0,i*10000);return e;};
const context=(eng,now=55000)=>({raceId:'compose',eng,now,phase:eng.status,setup:{name:'Club',sessionType:'race',laps:20},track:{name:'Track'},layout:{widgets:[],laneColors:[]},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity});
test('catalogue is unique, contains all old values and modern system data',()=>{const a=C.catalog('lane'),keys=a.map(x=>x.key);assert.equal(new Set(keys).size,keys.length);for(const [k] of W.TEXT_LANE_VARS)assert(keys.includes(k));for(const k of ['tyrelife','pace','service','inpit','fuelmult'])assert(keys.includes(k));assert(!C.catalog('race').some(x=>x.key==='fuelpct'));});
test('limits imported nesting and block count, repairs duplicate ids and rejects unsafe images',()=>{let n={kind:'value'};for(let i=0;i<100;i++)n={kind:'row',children:[n]};assert(JSON.stringify(C.clean({root:n})).length<10000);const d=C.clean({root:{kind:'row',children:Array.from({length:100},()=>({kind:'image',id:'same',image:'javascript:alert(1)'}))}});assert.equal(d.root.children.length,79);assert.equal(new Set(d.root.children.map(x=>x.id)).size,79);assert.equal(d.root.children[0].image,'');});
test('typed rules distinguish missing, false and zero; first match wins',()=>{assert(C.test({key:'x',op:'eq',value:'0'},{x:0}));assert(!C.test({key:'x',op:'lt',value:'5'},{x:null}));assert(C.test({key:'x',op:'missing'},{}));assert(C.test({key:'x',op:'eq',value:'false'},{x:false}));assert(!C.test({key:'x',op:'lt',value:'5'},{x:'2 L'}));const n={rules:[{conditions:[{key:'x',op:'eq',value:'0'}],action:'hide'},{conditions:[{key:'x',op:'present'}],action:'text'}]};assert.equal(C.matched(n,{x:0}).action,'hide');});
test('text and rule replacements are escaped and unknown data does not become zero',()=>{const doc={root:{kind:'column',children:[{kind:'value',key:'name'},{kind:'text',text:'<b>{name}</b>'},{kind:'bar',key:'fuelpct'}]}};const h=C.render(doc,{name:'<script>x</script>',fuelpct:null});assert(!h.includes('<script>'));assert(h.includes('&lt;script&gt;'));assert(!h.includes('aria-valuenow'));assert(h.includes('—'));});
test('every template produces samples and engine-driven output',()=>{const e=race(),s=Share.makeShared(context(e));for(const kind of ['lane','timing','strategy','race','blank']){const w=W.newWidget(kind==='race'?'textrace':'textlane',0,0,0);w.opt={composition:C.template(kind)};assert(W.sampleOf(W.def(w.type),0,w).includes('wc-root'));assert(T.content(w,s).html.includes('wc-root'));}});
test('typed values come from real legal laps and system switches preserve unavailable states',()=>{const e=race(),s=Share.makeShared(context(e)),v=T.composeValues(s,e.cars[0],55000);assert.equal(v.name,'James & <Co>');assert.equal(v.best,10);assert.equal(typeof v.fuelpct,'number');assert.equal(typeof v.tyrelife,'number');assert.equal(typeof v.tyrelaps,'number');e.setSystem('fuel',false,55000);e.setSystem('tyrewear',false,55000);e.setSystem('pushsave',false,55000);const off=T.composeValues(Share.makeShared(context(e)),e.cars[0],55000);assert.equal(off.fuelpct,null);assert.equal(off.tyrelife,null);assert.equal(off.pace,null);e.cross(0,56000);e.setInvalid(0,e.cars[0].laps.length-1,true);assert.equal(T.composeValues(Share.makeShared(context(e,57000)),e.cars[0],57000).avg,10);});
test('service and race clocks freeze during a pause',()=>{const e=race();e.pitSensor(0,true,60000);e.block(0,60000);e.tick(62000);e.pause(64000);const one=T.composeValues(Share.makeShared(context(e,65000)),e.cars[0],65000),two=T.composeValues(Share.makeShared(context(e,95000)),e.cars[0],95000);assert.equal(one.clock,two.clock);assert.equal(one.service,two.service);assert.equal(one.serviceprogress,two.serviceprogress);});
test('standard components retain their renderer; custom/control recursion is unavailable',()=>{const e=race(),s=Share.makeShared(context(e)),w=W.newWidget('textlane',0,0,0);w.opt={composition:{root:{kind:'component',component:'bestlap'}}};assert(T.content(w,s).html.includes(T.content(W.newWidget('bestlap',0,0,0),s).html));assert(!C.components('lane').some(x=>x.button||x.type==='textlane'||x.type==='leaderboard'));assert(!C.components('race').some(x=>x.perLane));});
test('main and serialized second-screen output match without altering race state',()=>{const e=race(),ctx=context(e),viewer=Share.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),ctx.now);const before=JSON.stringify(e.cars);for(const k of ['lane','timing','strategy','race']){const w=W.newWidget(k==='race'?'textrace':'textlane',0,0,0);w.opt={composition:C.template(k)};assert.equal(T.content(w,Share.makeShared(ctx)).html,T.content(w,viewer.shared(ctx.now)).html);}assert.equal(JSON.stringify(e.cars),before);});
test('every offered standard component renders with a real shared race context',()=>{const e=race(),s=Share.makeShared(context(e));for(const component of C.components('lane')){const w=W.newWidget('textlane',0,0,0);w.opt={composition:{root:{kind:'component',component:component.type}}};assert.doesNotThrow(()=>T.content(w,s),component.type);}});
test('export/import carries chart dependencies and remaps embedded references',()=>{const DB=require('../db'),Transfer=require('../transfer'),fs=require('fs'),os=require('os'),path=require('path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'composer-'));const a=new DB(path.join(dir,'a.json')),b=new DB(path.join(dir,'b.json'));const chart=a.add('chartdesigns',{name:'Trend'}),doc={root:{kind:'component',component:'racechart',options:{chartDesign:chart.id}}},custom=a.add('customwidgets',{name:'Chart card',type:'textrace',composition:doc}),layout=a.add('layouts',{name:'Display',widgets:[{type:'textrace',opt:{composition:doc}}]});const bundle=Transfer.collect(a.data,{customwidgets:[custom.id],layouts:[layout.id]},true);assert.equal(bundle.items.chartdesigns.length,1);Transfer.apply(b,bundle);const id=b.list('chartdesigns')[0].id;assert.notEqual(id,chart.id);assert.equal(b.list('customwidgets')[0].composition.root.options.chartDesign,id);assert.equal(b.list('layouts')[0].widgets[0].opt.composition.root.options.chartDesign,id);});
test('overall leaderboard rows use aggregate laps and points without a physical lane',()=>{const e=race(),base=Share.makeShared(context(e)),c={...e.cars[0],virtual:true,real:null,lane:1002,participant:2,lapsAll:38,prior:{t0:100000,t1:100000},past:null,recorded:true};const s=Object.assign(Object.create(base),{base,carByLane:()=>c,rowOf:()=>({pos:2,car:c,gap:'−1 lap'})});base.heat={before:[[2,100000,100000]]};const values=T.composeValues(s,c,55000);assert.equal(values.laps,38);assert.equal(values.position,2);assert.equal(values.lane,null);assert.equal(values.fuelpct,null);assert.equal(values.total,100);const w=W.newWidget('textlane',1002,0,0);w.opt={composition:C.template('lane')};assert(T.content(w,s).html.includes('38'));});
test('championship points follow the shared live championship totals',()=>{const e=race();e.cars[0].participant=42;const s=Share.makeShared({...context(e),season:{pts:[[42,17,9]]}});assert.equal(T.composeValues(s,e.cars[0],55000).champ,17);});
test('malformed imported nodes, rules and containers cannot crash rendering',()=>{
  for(const doc of [null,[],42,{root:42},{root:[]},{root:{kind:'row',children:{}}},{root:{rules:[null,42,{conditions:{}},{conditions:[null,42]}]}}])
    assert.doesNotThrow(()=>C.render(doc),JSON.stringify(doc));
});
test('non-finite readings are unavailable and never produce invalid meter geometry',()=>{
  for(const value of [NaN,Infinity,-Infinity]){
    assert(C.test({key:'fuelpct',op:'missing'},{fuelpct:value}));
    assert(!C.test({key:'fuelpct',op:'present'},{fuelpct:value}));
    const html=C.render({root:{kind:'gauge',key:'fuelpct'}},{fuelpct:value});
    assert(!html.includes('aria-valuenow'));assert(!html.includes('NaN'));
  }
});
test('numeric catalogue matches live values, and absent system readings satisfy missing rules',()=>{
  const e=race(),ctx={...context(e),bestAll:10000,track:{name:'Track',scale:'1:32',laneLengths:[10]}},s=Share.makeShared(ctx),v=T.composeValues(s,e.cars[0],ctx.now);
  for(const f of C.catalog('lane').filter(f=>f.type==='number'))assert(v[f.key]==null||typeof v[f.key]==='number',f.key+' is not numeric');
  for(const key of ['damage','repairs','failure','failures','weather','yellowtarget'])assert(C.test({key,op:'missing'},v),key);
  assert.equal(v.sessionrecord,10);assert.equal(C.catalog('lane').find(f=>f.key==='champ').type,'number');
  assert.equal(v.service,'Not in pits');
  const noStop=E.createRace({entries:[{lane:0,driverName:'A'}]});assert.equal(T.composeValues(Share.makeShared(context(noStop)),noStop.cars[0],55000).service,null);
});
test('composed championship points include the live placing just like the standard widget',()=>{
  const e=race(),ctx={...context(e),champ:{on:true,list:[25,18],done:[['a',12]]}},s=Share.makeShared(ctx),v=T.composeValues(s,e.cars[0],ctx.now);
  assert.equal(v.champ,37);
  assert.equal(String(v.champ),T.content(W.newWidget('champpoints',0,0,0),s).html);
  assert(C.test({key:'champ',op:'gt',value:'30'},v));
});
test('empty icon text can be supplied by a matching rule',()=>{
  const html=C.render({root:{kind:'icon',text:'',rules:[{conditions:[{key:'inpit',op:'eq',value:'true'}],action:'text',text:'PIT OPEN'}]}},{inpit:true});
  assert(html.includes('PIT OPEN'));
});
test('embedded flag warnings retain their paired background and contrast colour',()=>{
  const e=race();e.setFlag('yellow',55000);const s=Share.makeShared(context(e)),standard={...W.newWidget('flag',0,0,0),opt:{flagStyle:'text'}},out=T.content(standard,s);
  const w=W.newWidget('textrace',0,0,0);w.opt={composition:{root:{kind:'component',component:'flag',options:{flagStyle:'text'}}}};
  const html=T.content(w,s).html;assert(out.bg);assert(html.includes('background:'+out.bg));assert(html.includes('color:'+out.color));
});
test('saved picture sets and teams travel with custom widgets, layouts and leaderboard rows',()=>{
  const Transfer=require('../transfer'),doc={root:{kind:'row',children:[{kind:'component',component:'avatar',options:{imageSet:'none'}},{kind:'component',component:'tyrelife',options:{imageSet:'pics'}},{kind:'component',component:'teamname',options:{team:'team'}}]}};
  const data={imagesets:[{id:'pics',name:'Tyres',kind:'tyres'}],teams:[{id:'team',name:'Blue',drivers:[]}],customwidgets:[{id:'custom',name:'Custom',composition:doc}],layouts:[{id:'layout',widgets:[{type:'textlane',opt:{composition:doc}}]}],rowdesigns:[{id:'row',widgets:[{type:'textlane',opt:{composition:doc}}]}]};
  for(const entity of ['customwidgets','layouts','rowdesigns']){
    const bundle=Transfer.collect(data,{[entity]:[data[entity][0].id]});assert.equal(bundle.items.imagesets.length,1);assert.equal(bundle.items.teams.length,1);
    const DB=require('../db'),fs=require('fs'),os=require('os'),path=require('path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'composer-refs-'));
    try{const db=new DB(path.join(dir,'db.json'));Transfer.apply(db,bundle);const row=db.list(entity)[0],copied=entity==='customwidgets'?row.composition:row.widgets[0].opt.composition;
      assert.equal(copied.root.children[0].options.imageSet,'none');assert.equal(copied.root.children[1].options.imageSet,db.list('imagesets')[0].id);assert.equal(copied.root.children[2].options.team,db.list('teams')[0].id);
    }finally{fs.rmSync(dir,{recursive:true,force:true});}
  }
});
test('serialized viewers agree with every typed field through pause and system changes',()=>{
  const e=race();e.pause(56000);const ctx=context(e,60000),viewer=Share.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),ctx.now);
  const remote=viewer.shared(ctx.now),local=Share.makeShared(ctx);assert.deepEqual(T.composeValues(remote,remote.carByLane(0),ctx.now),T.composeValues(local,e.cars[0],ctx.now));
  assert.equal(T.composeValues(local,e.cars[0],ctx.now).driverstatus,'Paused');
});
test('free canvas templates agree on main and serialized displays',()=>{
  const e=race(),ctx=context(e),viewer=Share.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),ctx.now);
  for(const kind of ['lane','timing','strategy','race']){const w=W.newWidget(kind==='race'?'textrace':'textlane',0,0,0);w.opt={composition:C.freeTemplate(kind)};assert.equal(T.content(w,Share.makeShared(ctx)).html,T.content(w,viewer.shared(ctx.now)).html);}
});
test('free canvas geometry, locks and groups survive database export and import',()=>{
  const DB=require('../db'),Transfer=require('../transfer'),fs=require('fs'),os=require('os'),path=require('path'),dir=fs.mkdtempSync(path.join(os.tmpdir(),'free-transfer-'));
  try{const a=new DB(path.join(dir,'a.json')),b=new DB(path.join(dir,'b.json')),doc=C.freeTemplate('timing');doc.root.children[0].locked=true;doc.root.children[1].frame.x=34.1234;
    const row=a.add('customwidgets',{name:'Free timing',type:'textlane',composition:doc});Transfer.apply(b,Transfer.collect(a.data,{customwidgets:[row.id]}));assert.deepEqual(b.list('customwidgets')[0].composition,doc);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
console.log('WIDGET COMPOSER PASSED ('+count+' groups)');
