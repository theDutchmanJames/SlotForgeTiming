const assert=require('node:assert/strict'),Ty=require('../renderer/tyrewidgets'),W=require('../renderer/widgets'),Wx=require('../renderer/weather'),Icons=require('../renderer/weatherwidgets'),E=require('../renderer/engine'),T=require('../renderer/timing'),Share=require('../renderer/liveshare');
for(const t of Wx.TYRES){const html=Icons.tyreSvg(t.code,'test');assert.match(html,/fill="#121619"/);assert(html.includes('data-tyre-letter="'+(t.code==='INT'?'I':t.code)+'"'));assert(html.includes(t.color));assert(!html.includes('gradient'));assert(!html.includes('<text'));}
for(const style of ['original','digital','scale'])for(const dir of ['horizontal','vertical']){
 const opt={look:'bar',barStyle:style,dir,showName:true,segments:12};
 const r={...Ty.sampleRow(1),life:1,shown:1,level:'crit'};
 const h=Ty.rowHtml(r,opt).html;assert(h.includes('tyre-gauge'));assert(h.includes('1%'));assert(h.includes('Change tyres'));assert(h.includes('Medium'));assert.equal(h.includes('fg-vertical'),dir==='vertical');
 if(style==='digital'){assert.equal((h.match(/class="fg-segment/g)||[]).length,12);assert.match(h,/--lit:12%/);}
 assert(!Ty.rowHtml(r,{...opt,showIcon:false}).html.includes('data-tyre-letter'));
 const hidden=Ty.rowHtml(r,{...opt,showPct:false,showLeft:false,showGrip:false,showName:false,barWarning:false}).html;assert(!hidden.includes('fg-values'));assert(!hidden.includes('fg-warning'));
 assert(Ty.rowHtml({...r,level:'out',life:0,shown:0},opt).html.includes('BOX NOW'));
 assert(Ty.rowHtml({...r,tyre:'<script>bad</script>'},opt).html.includes('&lt;script&gt;'));
 assert(Ty.rowHtml(r,{...opt,tyreImages:{M:'data:image/png;base64,AA'}}).html.includes('<img'));
}
const eng=E.createRace({type:'race',laps:20,entries:[{lane:0,driverName:'Alex',tyre:'US'}],tyrewear:require('../renderer/tyrewear').clean({})});eng.start(0);
const legacy=Ty.rowHtml(Ty.sampleRow(1),{look:'bar'}).html;
assert(legacy.includes('twbarw'),'Existing layouts keep their original bar geometry');
assert(!Ty.rowHtml(Ty.sampleRow(1),{look:'bar',showIcon:false}).html.includes('data-tyre-letter'),'New icon control also applies to old layouts');
assert(!Ty.rowHtml(Ty.sampleRow(3),{look:'bar',barWarning:false}).html.includes('fg-warning'));
const scale=Ty.rowHtml(Ty.sampleRow(1),{look:'bar',barStyle:'scale'}).html;
assert(scale.includes('<span>100%</span>')&&!scale.includes('fg-reserve'),'Tyre scale uses life percentages without a fuel reserve marker');
for(const [segments,count] of [[-5,8],[99,20]])assert.equal((Ty.rowHtml(Ty.sampleRow(1),{look:'bar',barStyle:'digital',segments}).html.match(/class="fg-segment/g)||[]).length,count);
const layout={widgets:[{...W.newWidget('tyrelife',0,0,0),opt:{look:'bar',barStyle:'digital'}}]},ctx={raceId:'tyre-style',eng,now:0,phase:'running',setup:{sessionType:'race'},layout,track:{},lanes:1,base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
const before=JSON.stringify(eng.snapshot(0)),viewer=Share.viewer();viewer.feedStatic(JSON.parse(JSON.stringify(Share.packStatic(ctx))));viewer.feedDynamic(JSON.parse(JSON.stringify(Share.packDynamic(ctx))),0);
assert.equal(T.content(layout.widgets[0],Share.makeShared(ctx)).html,T.content(layout.widgets[0],viewer.shared(0)).html);assert.equal(JSON.stringify(eng.snapshot(0)),before);
eng.setSystem('tyrewear',false,0);assert.equal(T.content(layout.widgets[0],Share.makeShared(ctx)).html,'–');
console.log('TYRE STYLES PASSED: nine icons, three styles, both directions, toggles, images, warnings, escaping and live/shared race state');
