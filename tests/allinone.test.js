const assert=require('node:assert/strict');
const A=require('../renderer/allinone'),W=require('../renderer/widgets'),T=require('../renderer/timing'),E=require('../renderer/engine'),Share=require('../renderer/liveshare'),Tw=require('../renderer/tyrewear'),Ps=require('../renderer/pushsave');
const entries=[{lane:0,driverName:'James',driverId:'a',carName:'NSR Mosler MT900R'},{lane:1,driverName:'Bjornie',driverId:'b',carName:'NSR Corvette'}];
const fuel={on:true,tank:100,perLap:2,rate:2,pitHold:2000,empty:'warn'};
const race=(extra={})=>{const e=E.createRace({type:'race',laps:65,minLap:100,entries,...extra});e.start(0);for(let lap=1;lap<=5;lap++){e.cross(0,lap*10000);e.cross(1,lap*10300);}return e;};
const context=(eng,now=55000,more={})=>({raceId:'aio',eng,now,phase:eng.status,setup:{name:'Club night',sessionType:'race',laps:65},track:{name:'Club track'},layout:{widgets:[],laneColors:[]},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity,...more});
const view=(e,t,more)=>Share.makeShared(context(e,t,more));
const draw=(e,type,opt={},now=55000,more={},lane=0)=>T.content({...W.newWidget(type,lane,0,0),opt},view(e,now,more)).html;
let count=0;const test=(name,fn)=>{fn();count++;console.log('ok   '+name);};
test('seven registered cards, sensible samples, presets and no outer title by default',()=>{
 assert.equal(A.DEFINITIONS.length,7);assert.equal(new Set(W.REGISTRY.map(x=>x.type)).size,W.REGISTRY.length);
 for(const [type,label] of A.DEFINITIONS){const d=W.def(type),w=W.newWidget(type,0,0,0);assert.equal(d.label,label);assert.equal(d.group,'All-in-One');assert.equal(w.showTitle,false);assert(W.sampleOf(d,0,w).includes('aio-content'));assert(draw(race(),type).includes('aio-content'));if(d.perLane)assert.equal(draw(race(),type,{},55000,{},7),'');}
 assert.equal(A.clean({preset:'compact'}).avatar,false);assert.equal(A.clean({preset:'detailed'}).last,true);assert.equal(A.clean({preset:'compact',avatar:true}).avatar,true);assert.equal(A.applyPreset({avatar:false},'standard').avatar,true);assert.equal(A.clean({arrangement:'bad'}).arrangement,'auto');
});
test('timing values reuse current timing, legal best and clean average after review edits',()=>{
 const e=race(),c=e.cars[0];e.cross(0,56000);e.setInvalid(0,c.laps.length-1,true);
 const s=view(e,57000),h=draw(e,'aiotiming',{last:true},57000);
 for(const type of ['laptime','bestlap','avglap'])assert(h.includes(T.content(W.newWidget(type,0,0,0),s).html));
 assert(h.includes('Best legal lap'));assert(!h.includes('>6.000</b>'));assert(h.includes('>6.000</strong>'));
});
test('driver identity is escaped; avatar and car can be independently hidden',()=>{
 const e=race({entries:[{...entries[0],driverName:'<script>x</script>',carName:'<b>car</b>'}]});
 const h=draw(e,'aiolane');assert(h.includes('&lt;script&gt;'));assert(!h.includes('<script>'));assert(h.includes('&lt;b&gt;'));
 const off=draw(e,'aiolane',{avatar:false,car:false});assert(!off.includes('class="aio-avatar"'));assert(!off.includes('&lt;b&gt;'));
});
test('enabled and disabled fuel/tyre/pace slots keep the same structure',()=>{
 const e=race({fuel,tyrewear:Tw.clean({}),pushsave:Ps.clean({})});
 const before=draw(e,'aiodriver');assert(before.includes('aio-meter'));assert(!before.includes('<strong>Off</strong>'));
 for(const k of ['fuel','tyrewear','pushsave'])assert(e.setSystem(k,false,55000));
 const off=draw(e,'aiodriver');assert.equal((off.match(/<strong>Off<\/strong>/g)||[]).length,3);assert.equal((off.match(/class="aio-system /g)||[]).length,3);
 const hidden=draw(e,'aiodriver',{fuel:false,tyres:false,pace:false});assert(!hidden.includes('aio-systems'));
 e.setSystem('fuel',true,55000);assert(!draw(e,'aiostrategy').includes('Fuel system off'));
});
test('custom compounds retain their name and range; missing history is explicit',()=>{
 const cfg=Tw.clean({tyres:{C_1234567890ABCDEF:{name:'Club endurance',icon:'M',cls:'dry',wear:.125,bonus:0,cliff:30,hind:0}}});
 const e=race({fuel,tyrewear:cfg,entries:[{...entries[0],tyre:'C_1234567890ABCDEF'}]});assert(draw(e,'aiodriver').includes('Club endurance'));
 assert(draw(e,'aiostrategy').includes('Estimated'));
 const fresh=E.createRace({type:'race',fuel,entries});assert(draw(fresh,'aiostrategy',{},0).includes('Learning'));
});
test('pit hold, additive penalties and paused clocks use authoritative stop state',()=>{
 const e=race({fuel,pitControl:{mode:'manual',seconds:30,waitReturn:true}});e.pitSensor(0,true,60000);e.block(0,60000);e.tick(62000);e.cars[0].pending.push({kind:'stopgo',seconds:5});e.tick(62000);
 const h=draw(e,'aiopit',{},63000);assert(h.includes('Service stop'));assert(h.includes('penalty'));assert(h.includes('Pit penalties'));
 e.pause(64000);assert.equal(draw(e,'aiopit',{},65000),draw(e,'aiopit',{},95000));
 assert(draw(race({fuel}),'aiopit').includes('Pit time elapsed'));
});
test('Race Overview uses elapsed time and the actual time/lap/no-limit session',()=>{
 const e=race();assert(draw(e,'aiorace').includes('Laps remaining'));assert(draw(e,'aiorace').includes('00:55.0'));
 const timed=draw(e,'aiorace',{},55000,{setup:{sessionType:'race',raceBy:'time',duration:2}});assert(timed.includes('Time remaining'));assert(timed.includes('1:05'));
 const practice=draw(e,'aiorace',{},55000,{setup:{sessionType:'practice'}});assert(practice.includes('Free practice'));assert(!practice.includes('Laps remaining'));
 e.pause(55000);assert.equal(draw(e,'aiorace',{},55000),draw(e,'aiorace',{},85000));
});
test('results stay provisional through review, then distinguish final and disqualified drivers',()=>{
 const e=race();e.stop(55000);assert(draw(e,'aioresults',{},55000,{phase:'review'}).includes('Provisional results'));
 assert(draw(e,'aioresults',{},55000,{phase:'finished'}).includes('Winner'));e.cars[0].dq=true;
 assert(!draw(e,'aioresults',{},55000,{phase:'finished'}).includes('Winner'));assert(draw(e,'aioresults').includes('Disqualified'));
});
test('championship and heat points use their respective shared context and missing points stay unavailable',()=>{
 const e=race();e.cars[0].participant=42;
 assert(draw(e,'aioresults',{points:true},55000,{season:{pts:[[42,17,9]]}}).includes('<b>17</b>'));
 assert(draw(e,'aioresults',{points:true},55000,{champ:{on:true,list:[10,6],done:[['a',7]]},phase:'running'}).includes('<b>17</b>'));
 assert(draw(e,'aioresults',{points:true}).includes('points <b>—</b>'));
});
test('main and serialized shared screens agree for all seven cards, with no race mutation',()=>{
 const e=race({fuel,tyrewear:Tw.clean({}),pushsave:Ps.clean({}),pitControl:{mode:'manual',seconds:30}}),ctx=context(e),v=Share.viewer();
 v.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));v.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),ctx.now);
 const before=JSON.stringify(e.cars);
 for(const [type] of A.DEFINITIONS){const w=W.newWidget(type,0,0,0);assert.equal(T.content(w,Share.makeShared(ctx)).html,T.content(w,v.shared(ctx.now)).html,type);}
 assert.equal(JSON.stringify(e.cars),before);
});
console.log(`ALL-IN-ONE TESTS PASSED (${count} groups)`);
