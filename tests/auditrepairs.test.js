// Behavioural regressions from the October code/integration audit.
const assert = require('assert/strict'), fs = require('fs'), os = require('os'), path = require('path');
const E = require('../renderer/engine'), Ps = require('../renderer/pushsave'), Tw = require('../renderer/tyrewear'), Pw = require('../renderer/pacewidgets');
const Results = require('../renderer/resultsview'), Review = require('../renderer/review'), DB = require('../db');
global.RaceEngine=E;global.Stats=require('../renderer/stats');global.Icons=require('../renderer/icons');
global.esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let groups = 0;
const test = (name, fn) => { fn(); groups++; console.log('ok ' + name); };
const config = () => ({ type: 'race', laps: 100, entries: [{ lane: 0, driverName: 'Alex', tyre: 'S' }],
  fuel: { on: true, tank: 100, perLap: 1, rate: 5 }, tyrewear: Tw.clean({ paceWear: 'on', effect: 'off' }), pushsave: Ps.clean(Ps.defaults()) });
const make = () => { const r = E.createRace(config()); r.start(0); r.cars[0].started = true; return r; };
const drive = (r, times) => { let at = r.cars[0].last; times.forEach(dt => r.cross(0, at += dt)); return at; };
const near = (a, b) => assert(Math.abs(a - b) < .00001, `${a} != ${b}`);

test('live corrections change future consumption, never rewrite consumed fuel or wear', () => {
  const r = make(), at = drive(r, [10000,10000,10000,6000,6000,6000]), c = r.cars[0], fuel = c.fuel, life = c.twLife;
  [0,1,2].forEach(n => r.setInvalid(0,n,true));
  assert.equal(r.psRef(c).ms,6000); assert.deepEqual(c.twPace,[6000,6000,6000]);
  assert.equal(c.fuel,fuel); assert.equal(c.twLife,life);
  r.cross(0,at+6000); assert.equal(c.psNow.k,'normal'); near(fuel-c.fuel,1); near(life-c.twLife,4.5);
  r.setInvalid(0,0,false); assert.deepEqual(c.psPace,[10000,6000,6000,6000,6000]);
  r.removeLap(0,0,false); assert.deepEqual(c.psPace,[6000,6000,6000,6000]);
  r.removeLap(0,0,true); assert.equal(c.paceEligibility.length,c.laps.length); assert.deepEqual(c.twPace,[6000,6000,6000,6000]);
});
test('yellow and disabled-tyre laps remain excluded after edits, including equal lap times', () => {
  const r=make();drive(r,[10000,10000,10000]); r.setFlag('yellow',30000); drive(r,[10000]); r.setFlag('yellow',40000);
  r.setSystem('tyrewear',false,40000);drive(r,[10000]); r.setSystem('tyrewear',true,50000);
  r.setInvalid(0,0,true);r.setInvalid(0,0,false);
  assert.equal(r.cars[0].psPace.length,4);assert.equal(r.cars[0].twPace.length,3);
});
test('pace identity survives checkpoint restore and old ambiguous samples are not guessed', () => {
  const r=make();drive(r,[10000,10000,10000,6000,6000,6000]);r.setInvalid(0,0,true);
  const snap=r.snapshot(48000), restored=E.createRace(config());assert(restored.restore(snap));
  restored.setInvalid(0,1,true);restored.setInvalid(0,2,true);assert.equal(restored.psRef(restored.cars[0]).ms,6000);
  const old=JSON.parse(JSON.stringify(snap));delete old.cars[0].paceEligibility;old.cars[0].psPace=[10000,6000,6000,6000];
  const legacy=E.createRace(config());assert(legacy.restore(old));assert.deepEqual(legacy.cars[0].psPace,[6000,6000,6000]);
  r.restartCar(0,50000);assert.deepEqual(r.cars[0].paceEligibility,[]);
});
test('median gauge and bar agree with states and asymmetric configured thresholds', () => {
  for(const bounds of [[3,8],[.1,2.3],[10,1]]){
    const cfg=Ps.clean({...Ps.defaults(),pushAt:bounds[0],saveAt:bounds[1]});
    assert.equal(Pw.share(cfg,0),.5);assert.equal(Pw.share(cfg,-bounds[0]),0);assert.equal(Pw.share(cfg,bounds[1]),1);
    assert(Pw.share(cfg,-bounds[0]/2)>0&&Pw.share(cfg,-bounds[0]/2)<.48);
    assert(Pw.share(cfg,bounds[1]/2)>.52&&Pw.share(cfg,bounds[1]/2)<1);
    const info={p:0,kind:'normal',tyres:1,fuel:1};assert.match(Pw.gaugeSvg(info,cfg,{}),/M80 78L80 35/);assert.match(Pw.barHtml(info,cfg,{}),/left:50%/);
  }
  assert.equal(Pw.share(Ps.clean({normal:3,saveAt:8}),3),.3); // legacy unchanged
});
test('lifespan survives cleaning and database roundtrip', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-audit-'));
  try { const db=new DB(path.join(dir,'db.json'));
    for(const unit of ['lap','distance']) for(const life of [unit==='distance'?100:60,600,800,1000]){
      const wear=Tw.wearForLife(unit,'m',life), tyres=Tw.cleanTyres({S:{wear}});
      const saved=db.add('tyrewearsystems',{name:'Life '+life,unit,tyres});
      const reopened=new DB(db.file).list('tyrewearsystems').find(x=>x.id===saved.id);
      const actual=Tw.lifeForWear(unit,'m',Tw.clean(reopened).tyres.S.wear);
      assert(Math.abs(actual-life)/life<.00001,`${unit} ${life} became ${actual}`);
    }
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('results count unique exclusions and keep unavailable points unavailable', () => {
  const r=make();drive(r,[10000]);r.setInvalid(0,0,true);r.removeLap(0,0,false);r.stop(10001);
  assert.equal(Results.value(r,r.cars[0],'invalid'),1);assert.match(Review.finishHtml(r,{}),/1 lap marked/);
  global.RaceEngine=E;global.Stats=require('../renderer/stats');
  const html=Results.html(r,{summary:['champpoints','none','none','none'],comparison:'none'});
  assert.match(html,/Championship points<\/span><strong>–<\/strong>/);
});
test('starting rules are immutable copies and survive checkpoint and session persistence', () => {
  const cfg=config(),r=E.createRace(cfg),original=r.rulesSnapshot();cfg.pushsave.benchmark='average';
  const first=r.rulesSnapshot();assert.equal(first.config.pushsave.benchmark,'median');assert(!('entries' in first.config));
  first.config.pushsave.benchmark='last';assert.deepEqual(r.rulesSnapshot(),original);
  r.start(0);const restored=E.createRace(cfg);restored.restore(r.snapshot(100));assert.deepEqual(restored.rulesSnapshot(),original);
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-rules-'));
  try { const db=new DB(path.join(dir,'db.json'));db.saveSession({rulesSnapshot:original,heatResults:[{heat:1,rulesSnapshot:original}]},[]);
    const result=new DB(db.file).list('sessions')[0];assert.deepEqual(result.rulesSnapshot,original);assert.deepEqual(result.heatResults[0].rulesSnapshot,original);
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test('shared screens retain the authoritative pace reference after corrections',()=>{
  const LS=require('../renderer/liveshare'),r=make(),at=drive(r,[10000,10000,10000,6000,6000,6000]);
  const ctx={raceId:'pace',eng:r,setup:{sessionType:'race'},layout:{widgets:[]},track:{},lanes:1,phase:'running',now:at,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
  const viewer=LS.viewer(),sender=LS.sender();viewer.feedStatic(JSON.parse(JSON.stringify(LS.packStatic(ctx))));
  const check=()=>{viewer.feedDynamic(JSON.parse(JSON.stringify(sender.pack(ctx,ctx.now))),ctx.now);const remote=viewer.engine();assert.deepEqual(remote.psRef(remote.cars[0]),r.psRef(r.cars[0]));assert.deepEqual(remote.psInfo(remote.cars[0]),r.psInfo(r.cars[0]));};
  check();[0,1,2].forEach(n=>r.setInvalid(0,n,true));ctx.now++;check();assert.equal(viewer.engine().psRef(viewer.engine().cars[0]).ms,6000);
});
test('comparison bars preserve real proportions instead of exaggerating small differences',()=>{
  const r=E.createRace({type:'race',laps:10,entries:[{lane:0,driverName:'A'},{lane:1,driverName:'B'}]});r.start(0);r.cross(0,9644);r.cross(1,9851);r.stop(10000);
  const html=Results.html(r,{comparison:'average'}),bars=[...html.matchAll(/<b style="width:([\d.]+)%;margin-left:0%;background/g)].map(m=>Number(m[1]));
  assert.equal(bars.length,2);near(bars[0],9644/9851*100);assert.equal(bars[1],100);
});
console.log(`${groups} AUDIT REPAIR GROUPS PASSED`);
