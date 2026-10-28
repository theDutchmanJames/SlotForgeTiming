const assert=require('node:assert/strict');
const Ty=require('../renderer/tyrewidgets'),W=require('../renderer/widgets'),T=require('../renderer/timing');
const row=Ty.sampleRow(1);
for(const name of ['Club $1','Club $&',"Club $'",'Club $`','<img src=x>']){
 const h=Ty.rowHtml({...row,tyre:name},{look:'bar',barStyle:'digital',showName:true}).html;
 const escaped=name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
 assert(h.includes(`<span class="tg-name">${escaped}</span>`));
 assert.equal((h.match(/class="fg-meter /g)||[]).length,1);
}
for(const field of ['showPct','showLeft','showGrip'])for(const dir of ['horizontal','vertical']){
 const h=Ty.rowHtml(row,{look:'bar',barStyle:'digital',dir,showPct:false,showLeft:false,showGrip:false,[field]:true}).html;
 assert(h.includes('fg-single'));assert(!h.includes('<strong class="fg-value"></strong>'));assert(!h.includes('class="fg-detail"'));
 assert(h.includes(field==='showPct'?'62%':field==='showLeft'?'14 laps left':'grip +2%'));
}
const style=Ty.OPTIONS.find(o=>o.key==='barStyle'),icon=Ty.OPTIONS.find(o=>o.key==='showIcon');
const old={look:'bar',dir:'vertical'},before=JSON.stringify(old),fresh=W.newWidget('tyrelife',0,0,0);
assert.equal(style.defaultOf(old),'legacy');assert(!icon.show(old));
assert(!Ty.rowHtml(row,old).html.includes('fuel-gauge'));assert.equal(JSON.stringify(old),before);
assert.equal(fresh.opt.barStyle,'original');assert(icon.show({...fresh.opt,look:'bar'}));
for(const opt of [{showIcon:false},{barWarning:false},{imageSet:''}]){
 assert.equal(style.defaultOf(opt),'original');assert(Ty.rowHtml(row,{look:'bar',...opt}).html.includes('fuel-gauge'));
}
assert(!Ty.rowHtml(row,{...old,barStyle:'legacy',showIcon:true}).html.includes('fuel-gauge'));
const leader={lane:0,laps:[10000,12000,14000]},car={lane:1,laps:[]},rows=[{car:leader,pos:1},{car,pos:2,gapMs:6000}];
const base={setup:{sessionType:'race'},eng:{cars:[leader,car],cfg:{calculations:{estimates:{gapMethod:'median'}}},gapInfo:()=>[]},standings:()=>rows,rowOf:c=>rows.find(r=>r.car===c)};
let sorts=0;const original=Array.prototype.sort;
try{
 Array.prototype.sort=function(...args){sorts++;return original.apply(this,args)};
 const frame=T.beginFrame(base);for(let i=0;i<32;i++)assert.equal(T.gapLaps(frame,car),'+0.5 laps');assert.equal(sorts,1);
 base.eng.cfg.calculations.estimates.gapWindow=1;assert.equal(T.gapLaps(frame,car),'+0.4 laps');assert.equal(sorts,2);
 leader.laps=[20000];assert.equal(T.gapLaps(T.beginFrame(base),car),'+0.3 laps');assert.equal(sorts,3);
 leader.laps=[10000];assert.equal(T.gapLaps(base,car),'+0.6 laps'); // non-frame callers must not retain stale values
 leader.laps=[30000];assert.equal(T.gapLaps(base,car),'+0.2 laps');
}finally{Array.prototype.sort=original}
console.log('TYRE REPAIRS PASSED: literal names, single facts, saved/new defaults, per-frame cache and invalidation');
