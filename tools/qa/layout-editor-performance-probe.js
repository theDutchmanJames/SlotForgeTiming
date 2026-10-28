const result={layout:qaInput.layout.name,widgets:qaInput.layout.widgets.length,cases:[]};
state.tab='custom';state.customSub='layouts';state.sideOpen=new Set();
Object.assign(state.settings,qaInput.settings);if(typeof applyDepth==='function')applyDepth();if(typeof applyTheme==='function')applyTheme();if(typeof applyLayers==='function')applyLayers();
const clone=x=>JSON.parse(JSON.stringify(x));
const next=()=>new Promise(r=>requestAnimationFrame(r));
const originals={content:WidgetPreview.content,fit:WidgetView.fit,html:WidgetView.html};
let totals={},fontEvents=0,gestureTimes=[];const fontReady=()=>fontEvents++;window.addEventListener('widget-fonts-ready',fontReady);
const originalLatest=typeof EditorCanvas!=='undefined'?EditorCanvas.latest:null;
if(originalLatest)EditorCanvas.latest=(fn,...args)=>originalLatest((...values)=>{const t=performance.now();try{return fn(...values);}finally{gestureTimes.push(performance.now()-t);}},...args);
for(const [obj,key] of [[WidgetPreview,'content'],[WidgetView,'fit'],[WidgetView,'html']]){
 const original=obj[key];obj[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{const x=totals[key]||(totals[key]={calls:0,ms:0});x.calls++;x.ms+=performance.now()-start;}};
}
const stats=xs=>{const s=[...xs].sort((a,b)=>a-b);return {medianMs:+s[Math.floor(s.length/2)].toFixed(2),p95Ms:+s[Math.min(s.length-1,Math.floor(s.length*.95))].toFixed(2),minMs:+s[0].toFixed(2),maxMs:+s.at(-1).toFixed(2)};};
async function setup(flat=false){
 if(state.editing?.history)state.editing.history.dispose();
 state.editing={id:null,draft:clone(qaInput.layout),sel:[],snap:true,dirty:false,drivers:[],cars:[],teams:[],...Object.fromEntries(['rowDesigns','chartDesigns','imageSets','customWidgets'].map(k=>[k,qaInput[k]||[]]))};
 // Calling render() would reload empty assets from the isolated database.
 // Render this in-memory copy directly so its saved picture sets stay attached.
 renderEditor();await document.fonts.ready;await next();await next();
 if(flat){const style=document.createElement('style');style.id='qa-flat';style.textContent='#canvas,#canvas * ,#canvas *::before,#canvas *::after{box-shadow:none!important;text-shadow:none!important;filter:none!important;backdrop-filter:none!important}';document.head.append(style);}
 else document.getElementById('qa-flat')?.remove();
 const index=state.editing.draft.widgets.findIndex(w=>w.type==='slotcarpic'||w.type==='carpic'||w.type==='pace');
 const w=state.editing.draft.widgets[index<0?0:index];state.editing.sel=[w];renderEditor();for(let i=0;i<8;i++)await next();
 const el=document.querySelector('#canvas .lw[data-i="'+state.editing.draft.widgets.indexOf(w)+'"]');
 return {w,el};
}
for(const flat of [false,true])for(const resize of [false,true]){
 const {w,el}=await setup(flat),canvas=document.getElementById('canvas'),r=el.getBoundingClientRect();
 const oldNodes=[...canvas.querySelectorAll('.lw')];let records=[];
 const observer=new MutationObserver(a=>records.push(...a));observer.observe(canvas,{childList:true});
 const target=resize?el.querySelector('[data-h="se"]'):el;
 const x=resize?r.right:r.left+r.width/2,y=resize?r.bottom:r.top+r.height/2;
 target.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:x,clientY:y,pointerId:1,buttons:1}));
 totals={};gestureTimes=[];const times=[];
 for(let i=1;i<=16;i++){const t=performance.now();window.dispatchEvent(new PointerEvent('pointermove',{clientX:x+i,clientY:y+i/2,pointerId:1,buttons:1}));times.push(performance.now()-t);await next();}
 const replaced=oldNodes.filter(n=>!n.isConnected).length,counts=clone(totals);
 const end=performance.now();window.dispatchEvent(new PointerEvent('pointerup',{clientX:x+16,clientY:y+8,pointerId:1}));const releaseMs=performance.now()-end;
 await next();observer.disconnect();
 result.cases.push({name:(flat?'effects-disabled':'current')+(resize?'-resize':'-drag'),events:times.length,...stats(gestureTimes.length?gestureTimes:times),dispatch:stats(times),releaseMs:+releaseMs.toFixed(2),replacedWidgets:replaced,canvasMutationRecords:records.length,work:counts});
}
// Feasibility experiment: same snapping/geometry and styles, only update the
// selected existing element. This is NOT a replacement production drag handler.
for(const resize of [false,true]){
 const {w,el}=await setup(),canvas=document.getElementById('canvas'),cr=canvas.getBoundingClientRect(),from={x:w.x,y:w.y,w:w.w,h:w.h},others=state.editing.draft.widgets.filter(x=>x!==w),U=Widgets.U,H=Widgets.heightOf(state.editing.draft),k=U/cr.width;
const before=canvas.querySelectorAll('.lw'),times=[];totals={};
 for(let i=1;i<=16;i++){
  const t=performance.now(),nextBox=resize?Widgets.resizeWidget(from,'se',i*k,i*.5*k,others,U,H,true,state.editing.draft.guides):Widgets.moveWidget(from,i*k,i*.5*k,others,U,H,true,state.editing.draft.guides);
  Object.assign(w,nextBox);Widgets.snapLines(Widgets.bbox([w]),others,U,H,state.editing.draft.guides);
  Object.assign(el.style,{left:w.x/U*100+'%',top:w.y/H*100+'%',width:w.w/U*100+'%',height:w.h/H*100+'%'});
  if(resize){const val=el.querySelector(':scope > .lw-val'),preview=WidgetPreview.content({...w,previewContext:editorPreviewContext(state.editing)});WidgetView.fit({el,val,w,layout:state.editing.draft},preview);}
  void el.offsetWidth; // include a layout flush, so CSS write deferral cannot hide its cost
  times.push(performance.now()-t);await next();
 }
 result.cases.push({name:'in-place-prototype'+(resize?'-resize':'-drag'),widget:w.type,events:times.length,...stats(times),replacedWidgets:[...before].filter(n=>!n.isConnected).length,work:clone(totals)});
}
await setup();totals={};fontEvents=0;const idleStart=performance.now();renderEditor();const immediate=clone(totals);for(let i=0;i<8;i++)await next();
result.afterSingleRedraw={immediate,includingDeferred:clone(totals),fontEvents,elapsedMs:performance.now()-idleStart};
window.removeEventListener('widget-fonts-ready',fontReady);
if(originalLatest)EditorCanvas.latest=originalLatest;
Object.assign(WidgetPreview,{content:originals.content});Object.assign(WidgetView,{fit:originals.fit,html:originals.html});
result.canvas={width:document.getElementById('canvas').clientWidth,height:document.getElementById('canvas').clientHeight};
return result;
