const assert=require('assert/strict'),fs=require('fs');
const W=require('../renderer/widgets'),P=require('../renderer/widgetpreview'),T=require('../renderer/timing'),R=require('../renderer/rows'),C=require('../renderer/chartwidgets'),B=require('../renderer/widgetcompose');
let checks=0;const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;};
for(const d of W.REGISTRY){
 const w=W.newWidget(d.type,1,0,0),before=JSON.stringify(w);
 if(!d.button){eq(d.sample(1,w),T.content(w,P.state(w)).html,d.type+' registry uses production renderer');eq(W.sampleOf(d,1,w),d.sample(1,w),d.type+' shared entry point');}
 eq(JSON.stringify(w),before,d.type+' saved widget unchanged');
}
const row={...R.defaultDesign(),id:'row'},chart={...C.clean({name:'Timing',reference:'manual',drivers:'selected',lanes:[0,1,2,3]}),id:'chart'};
const assets={rowDesigns:[row],chartDesigns:[chart],imageSets:[],layout:{laneColors:[{bg:'#123456'},{bg:'#abcdef'}]}};
for(const orderBy of ['race','bestlap','name'])for(const from of [1,3,7]){
 const w={type:'leaderboard',opt:{design:'row',orderBy,from,to:from+1,scale:60,gaps:0,fill:'rows'},previewContext:assets},S=P.state(w);
 eq(P.content(w).html,T.content(w,S).html,'saved leaderboard order/range parity');
 eq((P.content(w).html.match(/class="rrow /g)||[]).length,2,'range actually limits rows');
}
for(const style of ['trend','bars','delta']){
 chart.style=style;
 const w={type:'racechart',opt:{chartDesign:'chart'},chartSize:{width:400,height:260},previewContext:assets};
 const h=P.content(w).html;assert(h.includes('<svg'));checks++;
 eq(h,C.html(C.model(chart,P.state(w)),400,260),'chart production model '+style);
 // Synchronous edits may not reuse the live 250ms cache.
 chart.name='Changed '+style;assert(P.content(w).html.includes('Changed '+style));checks++;
}
for(const scope of ['race','lane'])for(const scenario of ['race','long','warning','pit','red','finished']){
 const S=P.state({}, {scenario});eq(B.sampleValues(scope,scenario,1),T.composeValues(S,scope==='lane'?S.carByLane(1):null,S.now),'Builder values '+scope+'/'+scenario);
}
const w={type:'textlane',lane:1,opt:{composition:B.template('lane')},previewContext:assets};eq(W.sampleOf(W.def(w.type),1,w),T.content(w,P.state(w)).html,'Builder placed content uses live values');
const picture='data:image/png;base64,aA==';eq(P.content({type:'logo',opt:{},previewContext:{clubLogo:picture}}).html.includes(picture),true,'club logo passed through');
eq(P.content({type:'racechart',opt:{chartDesign:'deleted'}}).html.includes('Choose a saved design'),true,'deleted design guidance matches live');
eq(P.values('lane','missing',0).name,null,'missing-data rule test remains available');
const before=JSON.stringify(P.context());for(const d of W.REGISTRY)if(!d.button)P.content({type:d.type,lane:1,opt:{}});eq(JSON.stringify(P.context()),before,'preview rendering does not mutate the fixture');
// Appearance and registry metadata are not part of this migration.
const source=fs.readFileSync('renderer/widgets.js','utf8');assert(!source.includes('HEATLIST_SAMPLE')&&!source.includes('distSample'));checks++;
console.log('PREVIEW MIGRATION PASSED:',checks,'checks');
