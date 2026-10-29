// Renderer lifecycle and cache contracts; geometry is tested in real Electron.
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const Widgets=require('../renderer/widgets'),Timing=require('../renderer/timing'),Engine=require('../renderer/engine');
const V=require('../renderer/widgetview');
global.Widgets=Widgets;
for(const d of Widgets.REGISTRY)assert.equal(typeof V.adapters[V.kind(Widgets.newWidget(d.type,0,0,0))],'function',d.type);
assert.equal(V.kind({type:'textlane',opt:{composition:{}}}),'composition');
assert.equal(V.kind({type:'clock',opt:{style:'digital'}}),'clock');
const stored={type:'lastlap',lane:0,titleSpace:true,radius:14,opt:{columns:2},fonts:{value:'highvis'}};
const before=JSON.stringify(stored);V.kind(stored);V.attributes(stored);assert.equal(JSON.stringify(stored),before);
assert(!V.attributes({type:'avatar',opt:{picture:'data:image/png;base64,SECRET'}}).includes('SECRET'));

const c={laps:[8000,9000,10000],bad:[],invalid:[],pitLaps:[],removed:[]};
const original=Engine.averageLaps;let reads=0;Engine.averageLaps=c=>{reads++;return original(c);};
try{
 const frame=Timing.beginFrame({});assert.equal(Timing.lapStats(frame,c).mean,9000);assert.equal(Timing.lapStats(frame,c).median,9000);assert.equal(reads,1);
 c.laps[0]=6000;assert.equal(Timing.lapStats(Timing.beginFrame({}),c).mean,25000/3);
 c.invalid=[1];assert.equal(Timing.lapStats(Timing.beginFrame({}),c).median,8000);
 c.pitLaps=[2];assert.equal(Timing.lapStats(Timing.beginFrame({}),c).mean,6000);
 c.removed=[0];assert.equal(Timing.lapStats(Timing.beginFrame({}),c).laps.length,0);
 c.laps=[12000];c.invalid=[];c.pitLaps=[];c.removed=[];
 assert.equal(Timing.lapStats(Timing.beginFrame({}),c).mean,12000,'restore/new heat with same car object');
 const direct={};assert.equal(Timing.lapStats(direct,c).mean,12000);c.laps[0]=13000;assert.equal(Timing.lapStats(direct,c).mean,13000,'non-frame callers never retain cache');
}finally{Engine.averageLaps=original;}
const S={carByLane:()=>({driverName:'James',carName:'Mosler'})};
assert.equal(Timing.contentKey({type:'name',lane:0},S),Timing.contentKey({type:'name',lane:0},S));
assert.notEqual(Timing.contentKey({type:'name',lane:0},S),Timing.contentKey({type:'name',lane:0},{carByLane:()=>({driverName:'Sam'})}));
assert.equal(Timing.contentKey({type:'name',opt:{text:'custom'}},S),null);
assert.equal(Timing.contentKey({type:'bestlap'},S),null);

// A long race formats only visible laps, preserving numbering and column order.
const race=Engine.createRace({type:'race',laps:5000,entries:[{lane:0,driverName:'James'}]});race.start(0);
const state={eng:race,now:10000,phase:'running',setup:{sessionType:'race',laps:5000},carByLane:()=>race.cars[0],rowOf:()=>({pos:1}),personalBest:()=>Infinity,flashOf:()=>null};
for(const length of [0,1,9,1000])for(const columns of [1,2,3])for(const per of [1,7,30]){
 race.cars[0].laps=Array.from({length},(_,i)=>8000+i);
 const opt={columns,lapsPerColumn:per};const expected=Widgets.lapListHtml(race.cars[0].laps.map((t,i)=>({n:i+1,t:Engine.fmtTime(t)})).reverse(),per,columns);
 assert.equal(Timing.content({type:'lastlap',lane:0,opt},state).html,expected);
}
const fmt=Engine.fmtTime;let formatted=0;Engine.fmtTime=t=>{formatted++;return fmt(t);};
try{Timing.content({type:'lastlap',lane:0,opt:{columns:2,lapsPerColumn:7}},state);assert.equal(formatted,14);}finally{Engine.fmtTime=fmt;}

let now=0,fitError=false,formatError=false,colour='white',text='8.402',calls=0,created=0,disconnected=0,fits=0;
let nextRAF=0;const callbacks=new Map();
const el=()=>({style:{setProperty(){}},classList:{add(){},remove(){}},setAttribute(){},removeAttribute(){},isConnected:true});
const ctx=vm.createContext({console:{error(){}},performance:{now:()=>now},
 requestAnimationFrame:fn=>{callbacks.set(++nextRAF,fn);return nextRAF;},cancelAnimationFrame:id=>callbacks.delete(id),
 ResizeObserver:class{constructor(fn){created++;this.fn=fn;}observe(){}disconnect(){disconnected++;}},
 LapHighlights:require('../renderer/laphighlights'),Backdrop:{node:()=>null},Frame:{themeKey:()=>'',style:()=>({}),solidity:()=>1},Widgets:{def:()=>({})},
 Timing:{beginFrame:s=>s,content:w=>{calls++;if(formatError&&w.id===1)throw Error('formatter');return {html:text,color:colour};}},
 WidgetView:{kind:()=> 'text',mount:(_,w,l)=>{let html='',writes=0;const val={style:{},get innerHTML(){return html;},set innerHTML(s){html=s;writes++;},get writes(){return writes;}};return {w,el:el(),val,layout:l,base:{},last:null};},fit:n=>{fits++;if(fitError&&n.w.id===1)throw Error('fit');}}
});
vm.runInContext(fs.readFileSync(require.resolve('../renderer/canvas'),'utf8'),ctx);const L=vm.runInContext('LiveCanvas',ctx);
const host={style:{},appendChild(){}},layout={ratioW:2,ratioH:1,widgets:[{id:1,type:'bestlap'},{id:2,type:'bestlap'}]};
let nodes=L.build(host,layout,2);fitError=true;L.paint(nodes,{});
assert.equal(nodes[0].last,null,'failed fit does not advance cache');assert.equal(nodes[1].last[0],text,'other widgets continue');assert(nodes[0].error);
const failedCalls=calls;L.paint(nodes,{});assert.equal(calls,failedCalls+1,'failed widget backs off, others continue');
fitError=false;now=1001;L.paint(nodes,{});assert.equal(nodes[0].error,null);assert.equal(nodes[0].last[0],text);
const writes=nodes.map(n=>n.val.writes);colour='yellow';L.paint(nodes,{});assert.deepEqual(nodes.map(n=>n.val.writes),writes,'colour-only does not rewrite content');
const previousFits=fits;L.paint(nodes,{});assert.equal(fits,previousFits,'unchanged content does not refit');
formatError=true;text='9.999';L.paint(nodes,{});assert.equal(nodes[0].last[0],'8.402');assert.equal(nodes[1].last[0],'9.999');
formatError=false;now=2002;L.paint(nodes,{});assert.equal(nodes[0].last[0],'9.999');
nodes.resize();assert.equal(callbacks.size,2);const oldNodes=nodes;
nodes=L.build(host,layout,2);assert.equal(disconnected,2);assert.equal(callbacks.size,0);assert(oldNodes.disposed);
const savedCalls=calls;oldNodes.update({});oldNodes.resize();assert.equal(calls,savedCalls);assert.equal(callbacks.size,0);
nodes.dispose();nodes.dispose();assert.equal(disconnected,created,'idempotent disposal releases every observer');
delete global.Widgets;
console.log('Widget view registry, lifecycle, failure isolation, DOM retention and frame-cache regressions passed.');
