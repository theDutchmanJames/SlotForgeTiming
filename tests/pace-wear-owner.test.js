'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Tw=require('../renderer/tyrewear'),Ps=require('../renderer/pushsave'),Engine=require('../renderer/engine');
const close=(a,b)=>assert(Math.abs(a-b)<.00001,`${a} != ${b}`);
function race({combine='both',push=true,enabled=true,thermal=false}={}){
 const record={paceWear:'on',paceStrength:'strong',effect:'off',zero:'none',setsMode:'none',tempOn:thermal?'on':'off',tyres:{M:{wear:2}}};
 const tyre=Tw.clean(record,{laneLen:[20],pace:{benchmark:'track',trackTarget:10000,response:{combine,custom:true,strength:3,minimum:.1,maximum:3}}});
 assert.equal(record.paceWear,'on','cleaning leaves saved setups untouched');
 const cfg={type:'race',laps:100,skipFirst:false,entries:[{lane:0,driverName:'A',tyre:'M'}],tyrewear:tyre,
  ...(push?{pushsave:{...Ps.clean({...Ps.defaults(),from:1}),benchmark:'track',trackTarget:10000}}:{}),
  ...(!enabled?{systemsDisabled:['pushsave']}:{})};
 const e=Engine.createRace(cfg);e.start(0);e.cars[0].started=true;return e;
}
for(const combine of ['both','tyres','pushsave'])test(`new races use exactly one pace factor despite old ${combine} settings`,()=>{
 for(const ms of [8000,12000]){
  const e=race({combine}),c=e.cars[0],base=Tw.wearPerLap(e.cfg.tyrewear,c.tyre,'dry',20);e.cross(0,ms);
  close(100-c.twLife,base*(ms===8000?1.4:.7));assert.equal(c.laps[0],ms);assert.equal(c.twPaceNow.multiplier,1);
  const snapshot=e.snapshot(ms),reopened=Engine.createRace(e.cfg);assert(reopened.restore(snapshot));
  close(reopened.cars[0].twLife,c.twLife);reopened.resume(ms);
  // The interrupted first lap after recovery is deliberately neutral.
  let life=reopened.cars[0].twLife;reopened.cross(0,ms*2);close(life-reopened.cars[0].twLife,base);
  life=reopened.cars[0].twLife;reopened.cross(0,ms*3);close(life-reopened.cars[0].twLife,base*(ms===8000?1.4:.7));
 }
});
test('absent or disabled Push & Save means base wear, regardless of obsolete pace settings',()=>{
 for(const option of [{push:false},{enabled:false}]){const e=race(option),c=e.cars[0],base=Tw.wearPerLap(e.cfg.tyrewear,c.tyre,'dry',20);e.cross(0,8000);close(100-c.twLife,base);}
});
test('Full Save savings multiply the temperature penalty once and still save tyres',()=>{
 const e=race({thermal:true}),c=e.cars[0],base=Tw.wearPerLap(e.cfg.tyrewear,c.tyre,'dry',20);e.cross(0,12000);
 assert(c.twTempWear>1);close(100-c.twLife,base*.7*c.twTempWear);assert(100-c.twLife<base);
});
test('schema no longer offers a second pace control',()=>{
 const schema=require('../schema');const s=schema.tyrewearsystems||schema.entities?.tyrewearsystems;
 assert(s);assert(!s.fields.some(f=>['paceWear','paceStrength'].includes(f.key)));assert(!s.groups.some(g=>g.id==='pace'));
});
test('new starting-rule metadata cannot claim an obsolete contributor preference',()=>{
 const settings={tyreResponse:{combine:'tyres',custom:true,strength:3}};
 assert.equal(Ps.calculationSettings(settings).response.combine,'pushsave');
 assert.equal(settings.tyreResponse.combine,'tyres','stored preferences are not rewritten');
});
