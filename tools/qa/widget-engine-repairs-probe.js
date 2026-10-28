// Executes in the real app renderer. Uses production widgets and isolated fixtures.
const results={checks:0,failures:[],performance:[],coverage:[],geometry:[]};
const check=(ok,label)=>{results.checks++;if(!ok)results.failures.push(label);};
const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const host=document.createElement('div');host.className='canvas live';host.style.cssText='position:fixed;inset:0;z-index:99999;background:var(--bg);container-type:inline-size';document.body.append(host);
const originalContent=Timing.content,originalFit=Frame.fit,originalCell=WidgetView.fitCell,NativeObserver=window.ResizeObserver;
let created=0,disconnected=0,nodes;const observers=[];
const make=(type,lane,x,y,w,h,extra={})=>({...Widgets.newWidget(type,lane,x,y),w,h,typography:{mode:'auto'},...extra});
const layout={ratioW:2,ratioH:1,laneColors:[{bg:'#2f9fc5',text:'#fff'},{bg:'#76a747',text:'#fff'}],widgets:[make('bestlap',0,0,0,450,180),make('bestlap',1,500,0,450,180)]};
function build(l,lanes=8){nodes=LiveCanvas.build(host,l,lanes,{maxH:0});host.style.width='100%';host.style.height='100%';return nodes;}
try{
 window.ResizeObserver=class extends NativeObserver{constructor(cb){super(cb);created++;observers.push(this);}disconnect(){disconnected++;super.disconnect();}};
 for(let i=0;i<5;i++)build(layout,2);
 const full=LiveCanvas.fullView(layout,2);full.close();
 check(created===12&&disconnected===10,'rebuild/fullscreen dispose all old observers');
 Timing.content=()=>({html:'<b>8.402</b>',bg:'#222831',color:'#fff'});LiveCanvas.paint(nodes,{carByLane:()=>null});
 const child=nodes[0].val.firstChild;
 Timing.content=()=>({html:'<b>8.402</b>',bg:'#884444',color:'#fff'});LiveCanvas.paint(nodes,{carByLane:()=>null});
 check(nodes[0].val.firstChild===child,'colour change retains real DOM child');
 Frame.fit=(el,w)=>{if(w.id===nodes[0].w.id)throw Error('QA injected fit failure');return originalFit(el,w);};
 Timing.content=()=>({html:'9.999',bg:'#222831',color:'#fff'});LiveCanvas.paint(nodes,{carByLane:()=>null});
 check(nodes[1].val.textContent==='9.999','fit error does not stop next widget');
 check(nodes[0].last[0]==='<b>8.402</b>','fit error does not commit content cache');
 check(nodes[0].el.classList.contains('widget-error'),'failed widget visibly marked');
 Frame.fit=originalFit;await new Promise(r=>setTimeout(r,1050));LiveCanvas.paint(nodes,{carByLane:()=>null});
 check(!nodes[0].error&&nodes[0].last[0]==='9.999','failed widget recovers automatically');
 nodes.dispose();check(created===disconnected,'every owned observer disposed');
 results.lifecycle={created,disconnected};window.ResizeObserver=NativeObserver;
 Timing.content=originalContent;

 // The same frame code supports old persisted fields and current appearance.
 for(const edge of ['left','right','top'])for(const radius of [0,2,14,40]){
  const modern={...layout,widgetAppearance:{source:'theme',accent:'lane',edge,radiusPixels:radius}};
  build(modern,2);Timing.content=()=>({html:'8.402'});LiveCanvas.paint(nodes,{carByLane:()=>null});await settle();
  check(nodes.every(n=>n.el.classList.contains('lcstripe-'+(edge==='left'?'side':edge))),'stripe '+edge+'/'+radius);
  check(nodes.every(n=>Math.abs(parseFloat(getComputedStyle(n.el).borderTopLeftRadius)-radius*host.clientWidth/1000)<.1),'radius '+edge+'/'+radius);
 }
 Timing.content=originalContent;
 const row=Rows.defaultDesign();
 for(const modern of [false,true]){
  nodes.dispose();host.innerHTML=Rows.sampleHtml(row,2,[],{laneColorStyle:'side',layout:{laneColors:[{bg:'#2f9fc5',text:'#fff'},{bg:'#76a747',text:'#fff'}],...(modern?{widgetAppearance:{accent:'lane',edge:'left'}}:{})}});
  let cells=0;WidgetView.fitCell=(...args)=>{cells++;return originalCell(...args);};Rows.fitText(host);WidgetView.fitCell=originalCell;
  check(host.querySelectorAll('.rrow-bg.lcstripe-side').length===2,'row stripes '+(modern?'modern':'legacy'));
  check(cells>0,'rows use shared adapter '+modern);
 }
 const rowEngine=RaceEngine.createRace({type:'race',laps:100,entries:[{lane:0,driverName:'James'},{lane:1,driverName:'Bjornie'}]});rowEngine.start(0);
 const rowContext={raceId:'row-parity',eng:rowEngine,now:1000,phase:'running',setup:{sessionType:'race',laps:100},track:{},base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
 for(const edge of ['left','right','top'])for(const modern of [false,true]){
  const laneStyle=edge==='left'?'side':edge;
  const l={...layout,laneColorStyle:laneStyle,...(modern?{widgetAppearance:{accent:'lane',edge}}:{})};
  const options={laneColorStyle:laneStyle,layout:l};
  const viewer=LiveShare.viewer();const ctx={...rowContext,layout:l,lanes:2};viewer.feedStatic(LiveShare.packStatic(ctx));viewer.feedDynamic(LiveShare.packDynamic(ctx),performance.now());
  host.innerHTML=Rows.sampleHtml(row,2,[],options);const preview=[...host.querySelectorAll('.rrow-bg')].map(e=>[e.className,e.style.getPropertyValue('--lane-stripe')]);
  host.innerHTML=Rows.html(row,viewer.shared(performance.now()),2,options);const actual=[...host.querySelectorAll('.rrow-bg')].map(e=>[e.className,e.style.getPropertyValue('--lane-stripe')]);
  check(JSON.stringify(preview)===JSON.stringify(actual),'row preview/live stripe parity '+edge+'/'+modern);
  check(actual.every(x=>x[0].includes('lcstripe-'+laneStyle)&&x[1]),'row edge and palette '+edge+'/'+modern);
 }

 // Exercise every registered family with its real sample in the production mount.
 for(const d of Widgets.REGISTRY.filter(d=>!d.hidden&&!d.button)){
  const w=make(d.type,0,0,0,450,230),l={...layout,widgets:[w]};build(l);
  Timing.content=originalContent;const sampleOutput={html:Widgets.sampleOf(d,0,w)};Timing.content=()=>sampleOutput;LiveCanvas.paint(nodes,{carByLane:()=>null});await settle();
  results.coverage.push({type:d.type,adapter:WidgetView.kind(w),error:nodes[0].error||null,status:nodes[0].el.dataset.fitStatus||'specialised'});
  check(!nodes[0].error,'adapter renders '+d.type);
 }

 // Long-race profiling uses live engine cars and 1,000 historical laps per lane.
 Timing.content=originalContent;
 for(const lanes of [2,4,8]){
  const eng=RaceEngine.createRace({type:'race',laps:5000,entries:Array.from({length:lanes},(_,lane)=>({lane,driverName:['James','Bjornie','Maria','Sam'][lane%4]+' '+(lane+1),carName:'NSR Mosler MT900R'}))});eng.start(0);
  eng.cars.forEach((c,i)=>{c.laps=Array.from({length:1000},(_,j)=>8000+i*100+j%19);c.best=Math.min(...c.laps);c.total=c.laps.reduce((a,b)=>a+b,0);});
  const standings=eng.standings(),S={eng,now:8100000,phase:'running',lights:0,setup:{sessionType:'race',laps:5000},heat:null,layout,carByLane:l=>eng.cars[l],rowOf:c=>standings.find(r=>r.car===c),flashOf:()=>null,personalBest:()=>Infinity};
  const widgets=[];for(let lane=0;lane<lanes;lane++)for(const [i,type]of ['name','laptime','bestlap','avglap','medlap','lastlap'].entries())widgets.push(make(type,lane,i*166,lane*90,160,85,{showTitle:true,opt:type==='lastlap'?{columns:2,lapsPerColumn:3}:{}}));
  const l={...layout,ratioW:1000,ratioH:lanes*90,widgets,widgetAppearance:{source:'theme',accent:'lane',edge:'left',radiusPixels:14}};S.layout=l;
  build(l,lanes);for(let i=0;i<8;i++)LiveCanvas.paint(nodes,S);await settle();
  const times=[];let averageReads=0,formatCalls=0;const avg=RaceEngine.averageLaps,content=Timing.content;
  RaceEngine.averageLaps=c=>{averageReads++;return avg(c);};Timing.content=(...a)=>{formatCalls++;return content(...a);};
  for(let i=0;i<120;i++){S.now+=25;const start=performance.now();LiveCanvas.paint(nodes,S);times.push(performance.now()-start);}
  RaceEngine.averageLaps=avg;Timing.content=content;times.sort((a,b)=>a-b);
  check(nodes.every(n=>!n.error),'long race '+lanes+' lanes');
  check(formatCalls<=120*(widgets.length-lanes),'stable identity formatting skipped '+lanes);
  check(averageReads<=120*lanes,'one average lap filter per car per paint '+lanes);
  results.performance.push({lanes,lapsPerLane:1000,widgets:widgets.length,paints:120,p50:times[60],p95:times[114],max:times[119],averageReads,formatCalls});
 }
}finally{Timing.content=originalContent;Frame.fit=originalFit;WidgetView.fitCell=originalCell;window.ResizeObserver=NativeObserver;nodes?.dispose();observers.forEach(o=>NativeObserver.prototype.disconnect.call(o));host.remove();}
return results;
