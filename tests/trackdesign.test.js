const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');
const D=require('../renderer/trackdesign'),I=require('../renderer/trackbuilder/integration'),C=require('../renderer/chartwidgets'),X=require('../renderer/chartextras'),DB=require('../db'),T=require('../transfer'),Share=require('../renderer/liveshare');
const dir=path.join(__dirname,'fixtures/trackbuilder'),read=n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'));
let checks=0;const test=(name,fn)=>{fn();console.log('ok '+name);checks++;};
const doc=D.normalize(read('01-two-lane.slotforge.json')),ids=doc.track.lanes.map(l=>l.id),saved=D.configure(doc,ids,true);
test('all supplied drawings regenerate; invalid dimensions fail; open circuits remain static',()=>{
  for(const file of fs.readdirSync(dir)){
    if(file.startsWith('11-')){assert.throws(()=>D.normalize(read(file)));continue;}
    const d=D.normalize(read(file));assert.equal(d.units,'mm');assert(!d.preparedGeometry);
    if(['08','09','14'].some(p=>file.startsWith(p)))assert.equal(d.compatibility.liveTracker,'unavailable');
    if(file.startsWith('03'))assert.equal(d.track.laneCount,8);
    if(file.startsWith('16'))assert(d.definitions.some(d=>d.parameters.type==='reference'));
  }
});
test('derived caches, unknown units, contracts and oversized inputs cannot change routes',()=>{
  const forged=read('01-two-lane.slotforge.json');forged.preparedGeometry={routes:[{lengthMm:1}]};forged.track.lanes[0].lengthMm=1;
  assert.deepEqual(D.normalize(forged).track,doc.track);
  for(const bad of [{...forged,units:'ft'},{...forged,integration:{contractVersion:'999'}},{...forged,timing:{version:2,direction:1}}])assert.throws(()=>D.normalize(bad));
  assert.throws(()=>D.normalize(' '.repeat(D.MAX_BYTES+1)),/5 MiB/);
});
test('lane mapping is unique, explicit, and invalidated after topology or lane count changes',()=>{
  assert.throws(()=>D.configure(doc,[ids[0],ids[0]],true),/different/);
  assert.throws(()=>D.configure(doc,[ids[0],'wrong'],true),/valid/);
  assert.throws(()=>D.configure(doc,[ids[0],''],true),/every/);
  assert(D.runtime(D.configure(doc,ids,false),2).error);
  assert(D.runtime(saved,3).error);
  const changed={...saved,confirmedMappingRevision:'a'.repeat(64)};assert.equal(D.validateSaved(changed).confirmedMappingRevision,null);
  const latched={...doc,timing:{...doc.timing,requiresLaneRemap:true}};assert(!D.runtime(D.configure(latched,ids,true),2).error);
});
test('reference artwork cannot be a timing line or contribute to lap lengths',()=>{
  const ref=D.normalize(read('16-reference.slotforge.json')),def=ref.definitions.find(d=>d.parameters.type==='reference'),piece=ref.pieces.find(p=>p.definitionId===def.id);
  const bad=I.prepare(ref,{...I.readState(ref),startFinish:{pieceId:piece.id,fraction:.5}},false);
  assert.throws(()=>D.configure(bad,ref.track.lanes.map(l=>l.id),true),/timing line/);
  const without={...ref,pieces:ref.pieces.filter(p=>p.id!==piece.id)};
  assert.deepEqual(D.normalize(without).track,ref.track);
});
test('embedded PNG headers have a bounded combined decode budget',()=>{
  const raw=read('16-reference.slotforge.json'),ref=raw.definitions.find(d=>d.parameters.type==='reference');
  const png=(w,h)=>{const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(w,16);b.writeUInt32BE(h,20);return 'data:image/png;base64,'+b.toString('base64');};
  ref.referenceImage=png(5000,1);assert(!D.normalize(raw).definitions.find(d=>d.id===ref.id).referenceImage);
  ref.referenceImage=png(2048,4096);for(let n=0;n<5;n++)raw.definitions.push({...ref,id:'extra-'+n});
  assert.equal(D.normalize(raw).definitions.filter(d=>d.referenceImage).length,4);
});
test('patch preserves measured lengths and record identity by default; nominal copy follows mapping',()=>{
  const old={id:'track',name:'Measured',lanes:2,length:22,laneLengths:'21,22',laneModifier:'measured',picture:'old',targetLap:8,minLap:2};
  assert.deepEqual(Object.keys(D.patch(old,saved)),['trackDesign']);
  const patch=D.patch(old,D.configure(doc,[ids[1],ids[0]],true),{name:true,lengths:true});
  assert.equal(patch.name,doc.title);assert.equal(patch.laneLengths.split(',')[0],String(Number((doc.track.lanes[1].lengthMm/1000).toFixed(6))));assert.equal(patch.laneLengthSource,'track-builder-nominal');
  assert(!('id'in patch));assert(!('minLap'in patch));assert(!('targetLap'in patch));
});
test('profile uses cumulative travel time, wraps at the timing line, and reverses heading',()=>{
  const rt=D.runtime(saved,2),p=rt.plans[0],start=D.pose(rt,0,0),end=D.pose(rt,0,1),expected=I.atTravel(p.route,0,p.offset,1);
  assert(Math.hypot(start.x-end.x,start.y-end.y)<.00001);assert(Math.hypot(start.x-expected.x,start.y-expected.y)<.00001);
  const reverse=I.prepare(doc,{...I.readState(doc),direction:-1},false),r=D.pose(D.runtime(D.configure(reverse,ids,true),2),0,0);assert(Math.abs(r.heading-start.heading)===180);
  assert(p.total>0&&p.times.every((t,i)=>!i||t>p.times[i-1]));
  const a=D.pose(rt,0,.25),uniform=I.atTravel(p.route,p.route.lengthMm*.25,p.offset,1);assert(Math.hypot(a.x-uniform.x,a.y-uniform.y)>1,'profile must not use uniform distance');
  assert.equal(D.runtime(saved,2),rt,'one cached geometry/profile per saved object');
});
test('chart uses mapped routes, defaults old designs to coloured lanes, and safely falls back',()=>{
  const car={lane:0,driverName:'Test',laps:[10000],bad:[],started:true,total:10000,last:0},S={track:{lanes:2,trackDesign:saved},eng:{cars:[car],rivals:[],status:'running',lapElapsed:()=>5000},now:5000};
  assert.equal(C.clean({style:'track'}).trackDrawing,'oval');
  const m=C.model({style:'track',trackDrawing:'design'},S);assert(m.design);assert.match(C.html(m,600,400),/Track Builder/);assert(!C.html(m,600,400).includes('NaN'));
  assert(!C.model({style:'track',trackDrawing:'design'},{...S,track:{lanes:2}}).design);
  assert.match(C.html(C.model({style:'track',trackDrawing:'design'},{...S,track:{lanes:3,trackDesign:saved}}),600,400),/Oval fallback/);
  assert.equal(X.progress(m.track[0],car,S,m.d).p,.5);car.pitHold=true;assert.equal(X.progress(m.track[0],car,S,m.d).p,0);delete car.pitHold;S.eng.lapElapsed=()=>20000;assert.equal(X.progress(m.track[0],car,S,m.d).p,.96);
});
test('appearance changes artwork only: coloured lanes follow the same imported routes and poses',()=>{
  const S={track:{lanes:2,trackDesign:saved},layout:{laneColors:['#ef3145','#31a7d3']},eng:{cars:[{lane:0,driverName:'A',laps:[10000],bad:[]},{lane:1,driverName:'B',laps:[11000],bad:[]}],rivals:[],status:'running',lapElapsed:()=>5000},now:5000,preview:true};
  const plain=C.model({style:'track',trackDrawing:'oval'},S),art=C.model({style:'track',trackDrawing:'design'},S);
  assert.equal(plain.design,art.design);assert(plain.design);assert.deepEqual(plain.track,art.track);
  const a=C.html(plain,640,400),b=C.html(art,640,400);
  assert.match(a,/Coloured lanes · imported layout/);assert.match(a,/data-track-lane="0"/);assert.match(a,/data-track-lane="1"/);
  assert(!b.includes('data-track-lane'));assert.match(b,/Track Builder artwork/);assert.notEqual(a,b);
  assert.deepEqual([...a.matchAll(/data-track-marker="\d+" transform="([^"]+)"/g)].map(m=>m[1]),[...b.matchAll(/data-track-marker="\d+" transform="([^"]+)"/g)].map(m=>m[1]));
  // Reversed lane mapping determines the coloured route, rather than array order.
  const rt=D.runtime(D.configure(doc,[ids[1],ids[0]],true),2),svg=D.drawing(rt,640,400,[{lane:0,color:'#ff1234'}]);
  assert(svg.includes(rt.plans.find(p=>p.route.id===ids[1]).path));assert(!svg.includes(rt.plans.find(p=>p.route.id===ids[0]).path));assert.match(svg,/#ff1234/);
  const fallback=C.model({style:'track'}, {...S,track:{lanes:2}});assert(!fallback.design);assert.match(C.html(fallback,640,400),/START \/ FINISH/);
});
test('per-widget appearance overrides are isolated, cached, inherited and previewed without mutating charts',()=>{
  const raw={id:'shared',style:'track',trackDrawing:'design'},S={chartDesigns:[raw],track:{lanes:2,trackDesign:saved},eng:{cars:[{lane:0,driverName:'A',laps:[10000],bad:[]}],rivals:[],status:'running',lapElapsed:()=>5000},now:5000};
  const widget=style=>({type:'racechart',opt:{chartDesign:'shared',...(style?{trackDrawing:style}:{})},chartSize:{width:640,height:400}});
  const lanes=C.content(widget('oval'),S),art=C.content(widget('design'),S);
  assert.notEqual(lanes.html,art.html);assert.equal(lanes.chartTrack.design,art.chartTrack.design);
  assert.equal(C.content(widget('oval'),S).chartTrack,lanes.chartTrack,'cached model is retained');
  assert.equal(C.content(widget('design'),S).chartTrack,art.chartTrack);
  for(const v of ['inherit',undefined,'invalid'])assert.equal(C.content(widget(v),S).html,art.html);
  assert.equal(raw.trackDrawing,'design');assert.match(C.content(widget('oval'),{...S,preview:true}).html,/Coloured lanes/);
  S.chartDesigns=[{...raw,style:'bars'}];assert.equal(C.content(widget('oval'),S).html,C.content(widget('design'),S).html);
});
test('profile pace uses the mapped tuning duration before any timed lap, without creating laps',()=>{
  const E=require('../renderer/engine'),eng=E.createRace({type:'practice',minLap:100,entries:[{lane:0,driverId:'a'}]});eng.start(0);eng.cross(0,1000);
  const rt=D.runtime(saved,2),ms=D.lapDuration(rt,0),S={track:{name:'Imported',lanes:2,trackDesign:saved},eng,now:1000+ms/3};
  assert.equal(C.clean({pace:'profile'}).pace,'profile');assert(ms>0);assert.equal(D.lapDuration(rt,7),null);assert.equal(D.lapDuration(null,0),null);
  const m=C.model({style:'track',pace:'profile'},S);assert.equal(m.track[0].ms,ms);assert(Math.abs(X.progress(m.track[0],eng.cars[0],S,m.d).p-1/3)<1e-9);
  const slow={...doc,profile:{...doc.profile,speed:200,acceleration:100,brake:100,corner:.2}},slowRt=D.runtime(D.configure(slow,ids,true),2);assert(D.lapDuration(slowRt,0)>ms);
  const reversed=D.runtime(D.configure(doc,[ids[1],ids[0]],true),2);assert.equal(D.lapDuration(reversed,0),D.lapDuration(rt,1));
  const before=JSON.stringify(eng.snapshot(S.now));C.html(m,640,400);assert.equal(JSON.stringify(eng.snapshot(S.now)),before);
  eng.pause(S.now);const paused=X.progress(m.track[0],eng.cars[0],{...S,now:S.now+5000},m.d);assert(Math.abs(paused.p-1/3)<1e-9);
  const missing=C.model({style:'track',trackDrawing:'design',pace:'profile'},{...S,track:{name:'No artwork',lanes:2}});assert.equal(missing.track[0].ms,null);assert.match(missing.designNote,/No artwork/);
});
test('Layout Editor previews imported artwork using real lane count without mutating shared samples',()=>{
  const P=require('../renderer/widgetpreview'),raw={id:'preview',style:'track',trackDrawing:'design',pace:'profile'},track={lanes:2,trackDesign:saved},assets={chartDesigns:[raw],chartPreviewTrack:track};
  const w={type:'racechart',opt:{chartDesign:raw.id},chartSize:{width:640,height:400},previewContext:assets};
  const count=P.context('history').eng.cars.length,S=P.state(w);assert.equal(S.track,track);assert.equal(S.eng.cars.length,2);assert.equal(P.context('history').eng.cars.length,count);
  assert.match(P.content(w).html,/Track Builder artwork/);assert(!P.content(w).html.includes('Oval fallback'));
  assert.match(P.content({...w,opt:{...w.opt,trackDrawing:'oval'}}).html,/Coloured lanes · imported layout/);
  assert.match(P.content({...w,previewContext:{chartDesigns:[raw]}}).html,/Oval fallback/);
  assert.equal(P.state({...w,opt:{chartDesign:'bars'},previewContext:{...assets,chartDesigns:[{id:'bars',style:'bars'}]}}).eng.cars.length,count);
});
test('unfinished lane mappings survive reopen; confirmation is separate from saved choices',()=>{
  const unfinished=D.configure(doc,[ids[1],''],false),restored=D.restoreMapping(doc,unfinished,2);
  assert.deepEqual(restored,{laneRoutes:[ids[1],''],confirmed:false});
  assert.deepEqual(D.restoreMapping(doc,D.configure(doc,[ids[1],ids[0]],false),2).laneRoutes,[ids[1],ids[0]]);
  assert(D.restoreMapping(doc,saved,2).confirmed);
  const reverse=I.prepare(doc,{...I.readState(doc),direction:-1},false),r=D.restoreMapping(reverse,saved,2);assert.deepEqual(r.laneRoutes,ids);assert(!r.confirmed);
  assert(!D.restoreMapping(doc,saved,1).confirmed);
});
test('paused and crossings-only trackers repaint after SVG replacement, resize or motion preference change',()=>{
  const names=['document','innerHeight','innerWidth','matchMedia'],prior=names.map(k=>Object.getOwnPropertyDescriptor(globalThis,k));
  let reduced=false,viewBox='0 0 640 300',calls=0,transform='',svg={getAttribute:()=>viewBox};
  const marker={setAttribute:(k,v)=>{if(k==='transform'){transform=v;calls++;}},querySelector:sel=>sel==='title'?{textContent:''}:null};
  const node={el:{isConnected:true,getBoundingClientRect:()=>({top:0,left:0,bottom:300,right:640})},val:{querySelector:sel=>sel==='svg'?svg:sel.startsWith('[data-track-marker')?marker:null}};
  try{
    globalThis.document={hidden:false};globalThis.innerHeight=1000;globalThis.innerWidth=1400;globalThis.matchMedia=()=>({matches:reduced});
    const S={track:{lanes:2,trackDesign:saved},eng:{cars:[{lane:0,laps:[10000],last:0,bad:[]}],rivals:[],status:'paused',lapElapsed:()=>5000},now:5000};
    const m=C.model({style:'track'},S);X.update(node,m,S);const initial=transform;assert.equal(calls,1);X.update(node,m,S);assert.equal(calls,1,'unchanged paused frame does no extra work');
    svg={getAttribute:()=>viewBox};X.update(node,m,S);assert.equal(calls,2);assert.equal(transform,initial,'new SVG receives paused car position');
    viewBox='0 0 420 250';X.update(node,m,S);assert.equal(calls,3);assert.notEqual(transform,initial);
    reduced=true;X.update(node,m,S);assert.equal(calls,4);const line=transform;reduced=false;X.update(node,m,S);assert.equal(calls,5);assert.notEqual(transform,line);
  }finally{names.forEach((k,i)=>{if(prior[i])Object.defineProperty(globalThis,k,prior[i]);else delete globalThis[k];});}
});
test('save/reopen, transfer, correction and unlink keep track and lap identity intact',()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sft-track-design-')),file=path.join(folder,'db.json'),db=new DB(file);
  const track=db.add('tracks',{name:'Existing',lanes:2,laneLengths:'21,22',laneModifier:'measured'});
  db.data.laps.push({id:'lap',trackId:track.id,time:6000});db.update('tracks',track.id,D.patch(track,saved));
  const reload=new DB(file);assert.deepEqual(reload.list('tracks')[0].trackDesign,saved);assert.equal(reload.list('laps')[0].trackId,track.id);assert.equal(reload.list('tracks')[0].laneLengths,'21,22');
  const bundle=T.collect(reload.data,{tracks:[track.id]},true),other=new DB(path.join(folder,'other.json'));T.apply(other,JSON.parse(JSON.stringify(bundle)));assert.deepEqual(other.list('tracks')[0].trackDesign,saved);
  const corrupt=JSON.parse(JSON.stringify(bundle));corrupt.items.tracks[0].trackDesign.version=99;const before=JSON.stringify(other.data);assert.throws(()=>T.apply(other,corrupt),/Nothing was imported/);assert.equal(JSON.stringify(other.data),before,'damaged transfer rolls back completely');
  assert.throws(()=>reload.update('tracks',track.id,{trackDesign:{version:999}}));assert.deepEqual(reload.list('tracks')[0].trackDesign,saved);
  reload.update('tracks',track.id,{trackDesign:null});assert.equal(reload.list('laps')[0].time,6000);assert.equal(reload.list('tracks')[0].laneLengths,'21,22');
});
test('second-display static snapshot carries design, dynamic updates do not duplicate it',()=>{
  const state={raceId:'r',title:'Race',eng:{cfg:{}},setup:{},layout:{},track:{lanes:2,trackDesign:saved},lanes:[],base:{personal:new Map(),track:Infinity,trackName:''}};
  const stat=Share.packStatic(state);assert.deepEqual(JSON.parse(JSON.stringify(stat)).track.trackDesign,saved);
});
test('remote viewer renders the same design and estimated poses as the paused main race',()=>{
  const E=require('../renderer/engine'),eng=E.createRace({type:'practice',entries:[{lane:0,driverId:'a'},{lane:1,driverId:'b'}]});eng.start(0);eng.cross(0,10000);eng.cross(1,11000);eng.pause(15000);
  const ctx={eng,now:15000,raceId:'designqa',layout:{},track:{lanes:2,targetLap:10,trackDesign:saved},phase:'paused',setup:{},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
  const dynamic=Share.packDynamic(ctx),delta=Share.sender().pack(ctx,15000);
  for(const update of [dynamic,delta]){assert(!Object.hasOwn(update,'track'));assert(!JSON.stringify(update).includes('trackDesign'),'geometry is not repeated in dynamic updates');}
  const viewer=Share.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));assert(viewer.feedDynamic(JSON.parse(JSON.stringify(dynamic)),25000));
  const local=Share.makeShared(ctx),remote=viewer.shared(25000),a=C.model({style:'track',trackDrawing:'design'},local),b=C.model({style:'track',trackDrawing:'design'},remote);
  assert.deepEqual(a.track,b.track);assert.equal(C.html(a,640,400),C.html(b,640,400));
  assert.deepEqual(D.pose(a.design,0,.25),D.pose(b.design,0,.25));
  for(const appearance of ['oval','design']){
    const charts=[{id:'shared',style:'track',trackDrawing:'design',pace:'profile'}],widget={type:'racechart',opt:{chartDesign:'shared',trackDrawing:appearance}};
    assert.equal(C.content(widget,{...local,chartDesigns:charts}).html,C.content(widget,{...remote,chartDesigns:charts}).html);
  }
});
console.log(checks+' Track Builder integration groups passed');
