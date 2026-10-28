const assert=require('node:assert/strict');
const W=require('../renderer/widgets'),T=require('../renderer/timing'),E=require('../renderer/engine'),Share=require('../renderer/liveshare');
let groups=0;const test=(name,fn)=>{fn();groups++;console.log('ok '+name);};
const draw=(level,opt={})=>W.fuelHtml(level,100,{mode:'both',...opt});
test('saved fuel widgets retain Original; unknown styles fall back safely',()=>{
 assert.equal(draw(72),draw(72,{barStyle:'original'}));assert.equal(draw(72),draw(72,{barStyle:'unknown'}));
 assert.match(draw(72),/class="ftxt">72 L/);assert(!draw(20).includes('LOW FUEL'));
 for(const dir of ['horizontal','vertical'])assert.match(draw(72,{dir}),dir==='vertical'?/height:72%/:/width:72%/);
});
test('digital segments represent exact fractional quantities without a false full segment at empty',()=>{
 for(const dir of ['horizontal','vertical']){
  const o={barStyle:'digital',dir,segments:12};
  assert.equal((draw(100,o).match(/class="fg-segment fg-lit"/g)||[]).length,12);
  assert.equal((draw(0,o).match(/class="fg-segment fg-lit"/g)||[]).length,0);
  assert.equal((draw(1,o).match(/class="fg-segment fg-lit"/g)||[]).length,1);assert.match(draw(1,o),/--lit:12%/);
  assert.match(draw(72,o),/--lit:64%/);assert.match(draw(0,o),/EMPTY/);
 }
 for(const [segments,count]of [[-1,8],[1000,20],['invalid',12]])assert.equal((draw(50,{barStyle:'digital',segments}).match(/class="fg-segment/g)||[]).length,count);
 assert(!draw(70,{barStyle:'digital',glow:false}).includes('fg-glow'));
});
test('Reserve Scale uses the chosen warning threshold and both orientations',()=>{
 for(const dir of ['horizontal','vertical']){const h=draw(50,{barStyle:'scale',dir,lowAt:35});assert.match(h,/--reserve:35%/);assert.match(h,/fg-scale-labels/);assert.equal(h.includes('fg-vertical'),dir==='vertical');}
 assert.match(draw(50,{barStyle:'scale',lowAt:1,critAt:10}),/--reserve:10%/);
});
test('quantity colours, warning visibility, values and invalid input behave in every style',()=>{
 for(const barStyle of ['original','digital','scale']){
  assert(draw(100,{barStyle}).includes('#2fb86a'));assert(!draw(100,{barStyle}).includes('var(--accent)'));
  assert(draw(25,{barStyle}).includes('#ffd400'));assert(draw(10,{barStyle}).includes('#d62828'));
  assert.match(draw(20,{barStyle,warningText:'show'}),/LOW FUEL/);assert(!draw(20,{barStyle,warningText:'hide'}).includes('LOW FUEL'));
  assert.match(draw(72,{barStyle,barValues:'percent'}),/72%/);assert(!draw(72,{barStyle,barValues:'percent'}).includes('72 L'));
  assert.match(draw(72,{barStyle,barValues:'both'}),/72 \/ 100 L/);
  assert(!draw(72,{barStyle,mode:'bar'}).includes('fg-values'));assert(!draw(72,{barStyle,mode:'bar'}).includes('ftxt'));
  assert.equal(draw(72,{barStyle,mode:'number'}),'<span class="fnum">72 L</span>');
  assert.equal(W.fuelHtml(NaN,100,{barStyle}),'–');assert.equal(W.fuelHtml(20,0,{barStyle}),'–');
  assert(!draw(8,{barStyle,critColor:'red;" onmouseover="bad'}).includes('onmouseover'));
 }
 assert.match(draw(150,{barStyle:'digital'}),/--amount:100%/);assert.match(draw(-1,{barStyle:'scale'}),/--amount:0%/);
});
test('only relevant editor options appear; samples use the shared renderer',()=>{
 const ops=Object.fromEntries(W.def('fuel').options.map(o=>[o.key,o]));
 assert.equal(ops.barStyle.default,'original');assert.equal(ops.barStyle.choices.length,3);
 assert(!ops.barStyle.show({mode:'number'}));assert(!ops.segments.show({barStyle:'scale'}));assert(ops.segments.show({barStyle:'digital'}));
 assert(!ops.barValues.show({mode:'bar'}));
 for(const barStyle of ['digital','scale'])assert(W.sampleOf(W.def('fuel'),0,{opt:{barStyle}}).includes('fg-'+barStyle));
});
test('live and shared displays use adjusted tank size, preserve options, and never change the race',()=>{
 const eng=E.createRace({type:'race',laps:10,entries:[{lane:0,driverId:'a',driverName:'Alex'}],fuel:{on:true,tank:100,perLap:2,rate:10}});eng.start(0);eng.cars[0].fuel=20;
 const layout={widgets:[{...W.newWidget('fuel',0,0,0),opt:{barStyle:'digital',segments:16,dir:'vertical',glow:false,barValues:'both',warningText:'show'}}]};
 const c={raceId:'fuel-styles',eng,now:0,phase:'running',setup:{sessionType:'race'},layout,track:{},lanes:1,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
 const S=Share.makeShared(c),before=JSON.stringify(eng.snapshot(0)),v=Share.viewer();
 v.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(c))));v.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(c))),0);
 const w=layout.widgets[0],html=T.content(w,S).html;assert.equal(T.content(w,v.shared(0)).html,html);assert.match(html,/fg-vertical/);assert.match(html,/LOW FUEL/);
 assert.equal(JSON.stringify(eng.snapshot(0)),before);
 eng.tankOf=()=>80;assert.match(T.content(w,S).html,/--amount:25%/);
 eng.setSystem('fuel',false,0);assert.equal(T.content(w,S).html,'–');
});
console.log(`FUEL STYLES PASSED: ${groups} groups`);
