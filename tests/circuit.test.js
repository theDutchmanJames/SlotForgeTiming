const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const D=require('../renderer/trackdesign'),I=require('../renderer/trackbuilder/integration'),C=require('../renderer/chartwidgets');
const read=(dir,name)=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',dir,name+'.slotforge.json'),'utf8'));
const examples=['closed-routed-oval','closed-flowing-track','closed-tabletop-track','closed-freeform-circuit','l-table-with-squeeze'];
function configured(name,direction=1){
  let doc=D.normalize(read('circuit',name));
  doc=I.prepare(doc,{...I.readState(doc),direction,startFinish:doc.timing.startFinish||{pieceId:doc.pieces[0].id,fraction:.27}},false);
  return D.configure(doc,doc.track.lanes.map(l=>l.id),true);
}
test('all 15 legacy fixtures preserve geometry, identities and timing offsets',()=>{
  const expected=require('./fixtures/trackbuilder/expected-results.json');
  for(const [name,want] of Object.entries(expected.files)){
    const raw=read('trackbuilder',name);
    if(want.reject){assert.throws(()=>D.normalize(raw));continue;}
    const doc=D.normalize(raw);
    assert.equal(doc.track.lanes.length,want.lengthsMm.length,name);
    doc.track.lanes.forEach((l,i)=>assert(Math.abs(l.lengthMm-want.lengthsMm[i])<1e-6,name));
    if(!want.newDesignIdOnImport){assert.equal(doc.design.id,want.designId);assert.equal(doc.design.revision,want.revision);assert.equal(doc.timing.routeMappingRevision,want.routeMappingRevision);assert.deepEqual(doc.track.lanes.map(l=>l.id),want.routeIds);assert.deepEqual(doc.timing.startFinishOffsets,want.timingOffsets);}
  }
});
for(const name of examples)test(name+': import, save/reopen, tuning and both appearances',()=>{
  const saved=configured(name),n=saved.laneRoutes.length;
  const reopened=D.validateSaved(JSON.parse(JSON.stringify(saved)));assert.deepEqual(reopened,saved);
  const rt=D.runtime(reopened,n);assert(!rt.error,rt.error);assert.equal(D.runtime(reopened,n),rt,'cached between frames');
  const patch=D.patch({id:'keep',name:'Measured',lanes:n,length:20,laneLengths:'20'},reopened);
  assert.deepEqual(Object.keys(patch),['trackDesign']);
  const nominal=D.patch(null,reopened,{lengths:true});assert.equal(nominal.laneLengths.split(',').length,n);
  const cars=Array.from({length:n},(_,lane)=>({lane,driverName:'Driver '+lane,laps:[10000],bad:[],started:true}));
  const S={track:{lanes:n,trackDesign:reopened},eng:{cars,rivals:[],status:'running',lapElapsed:()=>2500},layout:{},now:2500};
  for(const pace of ['profile','last','median','average','track']){
    const a=C.model({style:'track',pace,trackDrawing:'oval'},S),b=C.model({style:'track',pace,trackDrawing:'design'},S);
    assert.equal(a.design,b.design);assert(a.design);
    const plain=C.html(a,640,400),art=C.html(b,640,400);
    assert.match(plain,/data-track-lane/);assert(!art.includes('data-track-lane'));assert(!/NaN|Infinity/.test(plain+art));
    const positions=html=>[...html.matchAll(/data-track-marker="\d+" transform="([^"]+)"/g)].map(x=>x[1]);
    sameWorldPositions(plain,art);assert.equal(positions(plain).length,n);
  }
  for(let lane=0;lane<n;lane++){
    const p=rt.plans[lane],a=D.pose(rt,lane,0),z=D.pose(rt,lane,1);assert(Math.hypot(a.x-z.x,a.y-z.y)<1e-5);
    assert(p.total>0&&p.times.every((v,i)=>!i||v>p.times[i-1]));
    for(let f=0;f<=1;f+=.03125){const q=D.pose(rt,lane,f);assert([q.x,q.y,q.heading,q.curvature].every(Number.isFinite));}
  }
  const reverse=D.runtime(configured(name,-1),n),a=D.pose(rt,0,0),b=D.pose(reverse,0,0);
  assert(Math.hypot(a.x-b.x,a.y-b.y)<1e-5);assert(Math.abs(Math.abs(a.heading-b.heading)-180)<1e-6);
  const changed=I.prepare(saved.document,{...I.readState(saved.document),direction:-1},false);
  assert(!D.restoreMapping(changed,saved,n).confirmed);
});
test('FreeForm timing fractions use the reference path, not fraction times lane length',()=>{
  const saved=configured('l-table-with-squeeze'),doc=I.prepare(saved.document),offsets=doc.timing.startFinishOffsets;
  assert(offsets.some(o=>Math.abs(o.offsetMm-doc.track.lanes.find(l=>l.id===o.routeId).lengthMm*.27)>.5));
  for(const route of doc.preparedGeometry.routes){
    const seg=route.segments[0],f=doc.timing.startFinish.fraction;
    const i=seg.referenceFractions.findIndex(x=>x>=f),lo=i-1;
    const expected=seg.distancesMm[lo]+(seg.distancesMm[i]-seg.distancesMm[lo])*(f-seg.referenceFractions[lo])/(seg.referenceFractions[i]-seg.referenceFractions[lo]);
    assert(Math.abs(offsets.find(o=>o.routeId===route.id).offsetMm-expected)<1e-5);
  }
});
test('untrusted prepared routes are regenerated and future contracts still reject',()=>{
  const raw=read('circuit','closed-freeform-circuit'),expected=D.normalize(raw);
  raw.preparedGeometry={closed:true,routes:[{lengthMm:1,segments:[{type:'polyline',points:[[0,0],[1,1]]}]}]};
  assert.deepEqual(D.normalize(raw),expected);
  raw.integration.contractVersion='1.0.0-draft.999';assert.throws(()=>D.normalize(raw),/Unsupported/);
});
test('open FreeForm drawings cannot be confirmed as a racing circuit',()=>{
  const raw=read('circuit','closed-freeform-circuit');raw.definitions.find(d=>d.parameters.type==='freeform').parameters.freeform.closed=false;
  const doc=D.normalize(raw);assert.throws(()=>D.configure(doc,doc.track.lanes.map(l=>l.id),true),/closed circuit/);
});
test('height-bearing files still provide 2D paths without a new simulation mode',()=>{
  const saved=configured('figure-eight-with-bridge'),rt=D.runtime(saved,saved.laneRoutes.length);
  assert(!rt.error,rt.error);assert(rt.plans.every(p=>p.route.segments.every(s=>s.type==='polyline')));
  assert(Number.isFinite(D.pose(rt,0,.5).x));
});
test('both legacy and smooth-apex section squeezes retain their geometry and timing',()=>{
  for(const squeeze of [{version:1,spacingMm:80,transitionMm:150,anchorLane:'centre'},{version:2,shape:'apex',spacingMm:80,anchorLane:1}]){
    const raw=read('circuit','closed-flowing-track');
    raw.definitions.find(d=>d.parameters.type==='routed-spline').parameters.squeeze=squeeze;
    raw.integration.contractVersion='1.0.0-draft.'+(squeeze.version===1?6:7);
    const doc=D.normalize(raw),saved=D.configure(doc,doc.track.lanes.map(l=>l.id),true),rt=D.runtime(saved,3);
    assert(!rt.error,rt.error);assert.deepEqual(D.validateSaved(JSON.parse(JSON.stringify(saved))),saved);
    assert.deepEqual(doc.definitions.find(d=>d.parameters.type==='routed-spline').parameters.squeeze,squeeze);
    assert(rt.plans.some(p=>p.route.segments.some(s=>s.type==='polyline')));
    for(let lane=0;lane<3;lane++)assert(Number.isFinite(D.pose(rt,lane,.4).heading));
  }
});
test('import guidance omits already-satisfied runtime requirements but retains real problems',()=>{
  const doc=D.normalize(read('circuit','l-table-with-squeeze'));
  const issues=D.importIssues(doc);assert(issues.some(i=>i.code==='start-finish-unset'));
  assert(!issues.some(i=>i.code==='freeform-runtime'||i.code==='elevation-order-unavailable'));
  const raw=read('circuit','closed-freeform-circuit');raw.definitions.find(d=>d.parameters.type==='freeform').parameters.freeform.closed=false;
  assert(D.importIssues(D.normalize(raw)).some(i=>i.severity==='error'));
});
test('new FreeForm paths survive second-display transfer without repeating geometry on each update',()=>{
  const Share=require('../renderer/liveshare'),E=require('../renderer/engine');
  const saved=configured('l-table-with-squeeze');
  const eng=E.createRace({type:'practice',entries:saved.laneRoutes.map((_,lane)=>({lane,driverId:'d'+lane}))});
  eng.start(0);eng.cars.forEach((_,i)=>eng.cross(i,10000));eng.pause(11500);
  const ctx={eng,now:11500,raceId:'circuit-share',layout:{},track:{lanes:4,targetLap:10,trackDesign:saved},phase:'paused',setup:{},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
  const dynamic=Share.packDynamic(ctx),viewer=Share.viewer();assert(!JSON.stringify(dynamic).includes('trackDesign'));
  viewer.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));assert(viewer.feedDynamic(JSON.parse(JSON.stringify(dynamic)),25000));
  for(const trackDrawing of ['oval','design']){
    const a=C.model({style:'track',pace:'profile',trackDrawing},Share.makeShared(ctx)),b=C.model({style:'track',pace:'profile',trackDrawing},viewer.shared(25000));
    assert.equal(C.html(a,640,400),C.html(b,640,400));assert.deepEqual(D.pose(a.design,2,.3),D.pose(b.design,2,.3));
  }
});

function worldPositions(html){
  const frame=html.match(/<g transform="translate\(([-\d.e]+) ([-\d.e]+)\) scale\(([-\d.e]+)\)">/).slice(1).map(Number);
  return [...html.matchAll(/data-track-marker="\d+" transform="translate\(([-\d.e]+) ([-\d.e]+)\)/g)].map(m=>[(Number(m[1])-frame[0])/frame[2],(Number(m[2])-frame[1])/frame[2]]);
}
function sameWorldPositions(a,b){const x=worldPositions(a),y=worldPositions(b);assert.equal(x.length,y.length);x.forEach((p,i)=>assert(Math.hypot(p[0]-y[i][0],p[1]-y[i][1])<1e-5));}
test('coloured lanes fit their own paths, independently of invisible table dimensions',()=>{
  const raw=read('circuit','closed-freeform-circuit');raw.workspace.spaceGuide.lengthMm=40000;raw.workspace.spaceGuide.widthMm=40000;
  const doc=D.normalize(raw),rt=D.runtime(D.configure(doc,doc.track.lanes.map(l=>l.id),true),6);
  const points=coloured=>Array.from({length:201},(_,i)=>D.point(rt,0,i/200,600,400,coloured));
  const width=ps=>Math.max(...ps.map(p=>p.x))-Math.min(...ps.map(p=>p.x));
  assert(width(points(false))<20,'artwork retains the full large table');
  assert(width(points(true))>300,'coloured lanes use the available widget space');
  assert(points(true).every(p=>p.x>=19.99&&p.x<=580.01&&p.y>=19.99&&p.y<=380.01),'fixed-size cars have a safe edge margin');
  for(const name of examples){const saved=configured(name),live=D.runtime(saved,saved.laneRoutes.length);for(let lane=0;lane<saved.laneRoutes.length;lane++)for(let i=0;i<100;i++){const p=D.point(live,lane,i/100,600,400,true);assert(p.x>=19.99&&p.x<=580.01&&p.y>=19.99&&p.y<=380.01,name);}}
});
test('runtime regenerates untrusted geometry once, then reuses it without bypassing saved validation',()=>{
  const saved=configured('closed-freeform-circuit'),original=I.prepare;let calls=0;
  I.prepare=(...args)=>{calls++;return original(...args);};
  try{
    const rt=D.runtime(saved,6);assert(!rt.error,rt.error);assert.equal(calls,1);
    assert.equal(D.runtime(saved,6),rt);assert.equal(calls,1);
    const duplicate={...saved,laneRoutes:Array(6).fill(saved.laneRoutes[0])};assert.match(D.runtime(duplicate,6).error,/different design route/);
    assert(!D.validateSaved(saved).document.preparedGeometry,'expanded geometry is never added to persisted configurations');
  }finally{I.prepare=original;}
});
