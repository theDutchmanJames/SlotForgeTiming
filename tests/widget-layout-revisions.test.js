const test=require('node:test'),assert=require('node:assert/strict');
const Frame=global.Frame=require('../renderer/frame'),Settings=require('../renderer/widgetsettings'),W=require('../renderer/widgets'),T=require('../renderer/timing'),Preview=require('../renderer/widgetpreview');
test('6-unit manual typography survives control editing and JSON round trips; defaults stay readable',()=>{
 const w=W.newWidget('aiodriver',0,0,0);
 for(const key of ['titleSize','valueSize','supportSize','labelSize','minSize']){Settings.change(w,'typography',key,6);assert.equal(Frame.typography(w)[key],6);}
 assert.deepEqual(Frame.typography(JSON.parse(JSON.stringify(w))),Frame.typography(w));
 assert.equal(Frame.typography({}).minSize,14);assert.equal(Frame.typography({}).titleSize,12);
 for(const key of ['titleSize','valueSize','supportSize','labelSize','minSize'])assert.equal(Frame.typography({typography:{[key]:-5}})[key],6);
});
test('Last Laps retains newest-first column order and selected count in all emphasis modes',()=>{
 const laps=Array.from({length:40},(_,i)=>({n:90-i,t:`${90-i}.123`}));
 for(const latestLap of ['none','row','spotlight'])for(const columns of [1,2,3]){
  const html=W.lapListHtml(laps,7,columns,true,{latestLap,rowGap:8,columnGap:72,columnDivider:false});
  assert.equal((html.match(/class="lli(?: ll-newest)?"/g)||[]).length,7*columns);
  for(let i=1;i<7*columns;i++)assert(html.indexOf(`${91-i}.123`)<html.indexOf(`${90-i}.123`));
  assert(!html.includes('ll-dividers'));assert(html.includes('--ll-gap:8'));assert(html.includes('--ll-column-gap:72'));
  assert.equal((html.match(/ll-newest/g)||[]).length,latestLap==='row'?1:0);
  assert.equal(html.includes('ll-latest'),latestLap==='spotlight');
 }
 assert.equal(W.lapListHtml(laps,1,1,true,{latestLap:'spotlight'}),'90.123');
 assert.equal(W.lapListHtml([],15,3),'–');
 const short=W.lapListHtml(laps.slice(0,3),2,2);
 assert.match(short,/<span class="llcol">.*90\.123.*89\.123.*<span class="llcol">.*88\.123/);
 assert(!W.lapListHtml([{n:'<script>',t:'<img>'}],2,2).includes('<script>'));
 for(const [raw,expected] of [[undefined,0],[-10,0],[999,160],['invalid',0],[42,42]])assert(W.lapListHtml(laps,7,2,true,{columnGap:raw}).includes('--ll-column-gap:'+expected));
 const options=W.resolveOpt({...W.newWidget('lastlap',0,0,0),opt:{columnGap:72}});
 assert.equal(JSON.parse(JSON.stringify(options)).columnGap,72);
});
test('live and preview Last Laps forward spacing, divider and emphasis settings',()=>{
 const w={...W.newWidget('lastlap',0,0,0),opt:{columns:2,lapsPerColumn:3,rowGap:9,columnGap:60,columnDivider:false,latestLap:'spotlight'}};
 const state=Preview.state(w),before=JSON.stringify(state.eng.cars[0].laps),html=T.content(w,state).html;
 assert(html.includes('ll-latest'));assert(html.includes('--ll-gap:9'));assert(html.includes('--ll-column-gap:60'));assert(!html.includes('ll-dividers'));
 assert.equal(JSON.stringify(state.eng.cars[0].laps),before);
});
test('fuel placements cover all styles/orientations while preserving quantities and tyre geometry',()=>{
 for(const barStyle of ['original','digital','scale'])for(const dir of ['horizontal','vertical'])for(const valuePlacement of ['overlay','above']){
  const h=W.fuelHtml(96.8,100,{mode:'both',barStyle,dir,valuePlacement,barValues:'both'});
  assert(h.includes(`data-fuel-placement="${valuePlacement}"`));assert.equal((h.match(/96\.8%<\/strong>/g)||[]).length,1);assert(h.includes('96.8 / 100 L'));
  assert.equal(h.includes('fg-vertical'),dir==='vertical');
 }
 assert.match(W.fuelHtml(50,100,{mode:'both'}),/class="ftxt">50 L/);
 assert(!W.fuelHtml(50,100,{mode:'bar',barStyle:'digital'}).includes('fg-values'));
 assert(!W.fuelHtml(50,100,{mode:'number',barStyle:'digital'}).includes('fuel-gauge'));
 assert(!W.quantityBarHtml({tyre:true,main:'50%',colour:'#0f0'}).includes('data-fuel-placement'));
});
