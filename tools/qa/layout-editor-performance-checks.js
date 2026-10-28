const report={checks:0,failures:[],coverage:[]},check=(yes,label)=>{report.checks++;if(!yes)report.failures.push(label);};
const errors=[],onError=e=>errors.push(e.message);addEventListener('error',onError);
const copy=x=>JSON.parse(JSON.stringify(x)),settle=async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));};
const geometry=w=>({x:w.x,y:w.y,w:w.w,h:w.h}),near=(a,b)=>Object.keys(b).every(k=>Math.abs(a[k]-b[k])<.001);
const base={name:'Performance QA',ratioW:16,ratioH:9,widgetFonts:{value:'highvis',support:'inter',title:'condensed'},guides:{v:[500],h:[]},widgets:[
 {...Widgets.newWidget('laptime',0,50,40),w:250,h:140},
 {...Widgets.newWidget('pace',1,350,40),w:250,h:140,opt:{look:'gauge'}},
 {...Widgets.newWidget('lastlap',0,50,240),w:250,h:240,opt:{columns:2,lapsPerColumn:7}},
 {...Widgets.newWidget('tyrelife',1,350,240),w:250,h:240}
]};
async function mount(d=base,selected=[0]){
 state.editing?.cancelGesture?.();state.editing?.history?.dispose();
 state.editing={id:null,draft:copy(d),sel:[],snap:false,dirty:false,drivers:[],cars:[],teams:[],imageSets:qaInput.imageSets,rowDesigns:[],chartDesigns:[],customWidgets:[]};
 state.editing.sel=selected.map(i=>state.editing.draft.widgets[i]);renderEditor();await document.fonts.ready;await settle();
 return state.editing;
}
const els=()=>[...document.querySelectorAll('#canvas > .lw')];
function down(el,resize=false){const r=el.getBoundingClientRect(),p={clientX:resize?r.right:r.left+r.width/2,clientY:resize?r.bottom:r.top+r.height/2,pointerId:17,buttons:1};(resize?el.querySelector('[data-h="se"]'):el).dispatchEvent(new PointerEvent('pointerdown',{...p,bubbles:true}));return p;}
const move=(p,dx,dy,id=17)=>window.dispatchEvent(new PointerEvent('pointermove',{...p,clientX:p.clientX+dx,clientY:p.clientY+dy,pointerId:id}));
const up=()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:17}));
let ed=await mount(),before=copy(ed.draft),nodes=els(),w=ed.sel[0],start=geometry(w),k=1000/document.getElementById('canvas').clientWidth;
let fits=[];const originalFit=WidgetView.fit;WidgetView.fit=(n,...args)=>{fits.push(n.w.type);return originalFit(n,...args);};
let p=down(nodes[0]);for(let i=1;i<=100;i++)move(p,i*.3,i*.1);
check(near(w,start),'pointer burst waits for one frame');up();
check(near(w,Widgets.moveWidget(start,30*k,10*k,ed.draft.widgets.slice(1),1000,Widgets.heightOf(ed.draft),false,ed.draft.guides)),'release flushes final queued movement');
check(nodes.every((n,i)=>n===els()[i]),'drag preserves every mounted node');check(!fits.length,'moving does not fit any widgets');
check(ed.history.stats().undo===1,'one drag is one undo step');
window.editorUndo();check(JSON.stringify(state.editing.draft)===JSON.stringify(before),'undo restores original layout');window.editorRedo();check(near(state.editing.draft.widgets[0],geometry(w)),'redo restores final move');

ed=await mount();nodes=els();w=ed.sel[0];start=geometry(w);k=1000/document.getElementById('canvas').clientWidth;fits=[];p=down(nodes[0],true);move(p,25,15);up();
check(near(w,Widgets.resizeWidget(start,'se',25*k,15*k,ed.draft.widgets.slice(1),1000,Widgets.heightOf(ed.draft),false,ed.draft.guides)),'single resize uses existing geometry rules');
check(nodes.every((n,i)=>n===els()[i]),'resize preserves every mounted node');check(fits.length===1&&fits[0]==='laptime','resize fits only changed widget once');
ed=await mount(base,[0,1]);nodes=els();let group=ed.sel,from=group.map(geometry),box=Widgets.bbox(from);k=1000/document.getElementById('canvas').clientWidth;p=down(nodes[0]);move(p,35,20);up();
const movedBox=Widgets.moveWidget(box,35*k,20*k,ed.draft.widgets.slice(2),1000,Widgets.heightOf(ed.draft),false,ed.draft.guides);check(group.every((x,i)=>near(x,{...from[i],x:from[i].x+movedBox.x-box.x,y:from[i].y+movedBox.y-box.y})),'group movement retains offsets');check(nodes.every((n,i)=>n===els()[i]),'group drag preserves nodes');
from=group.map(geometry);box=Widgets.bbox(from);const handle=document.querySelector('.gbox [data-gh="se"]'),r=handle.getBoundingClientRect();p={clientX:r.x+2,clientY:r.y+2,pointerId:17,buttons:1};handle.dispatchEvent(new PointerEvent('pointerdown',{...p,bubbles:true}));move(p,20,10);up();
const next=Widgets.resizeWidget(box,'se',20*k,10*k,ed.draft.widgets.filter(x=>!group.includes(x)),1000,Widgets.heightOf(ed.draft),false,ed.draft.guides),scaled=Widgets.scaleGroup(from,box,next,false,1000,Widgets.heightOf(ed.draft));
check(group.every((x,i)=>near(x,scaled[i])),'group resizing retains existing scale rules');check(!document.querySelector('.snapl'),'guides cleared on release');

for(const mode of [true,'grid',false]){
 ed=await mount();ed.snap=!!mode;w=ed.sel[0];start=geometry(w);p=down(els()[0]);k=1000/document.getElementById('canvas').clientWidth;
 const ev={...p,ctrlKey:mode==='grid'};move(ev,49,27);up();
 check(near(w,Widgets.moveWidget(start,49*k,27*k,ed.draft.widgets.slice(1),1000,Widgets.heightOf(ed.draft),mode,ed.draft.guides)),'snapping mode '+mode);
}
for(const end of ['pointercancel','blur','rerender','undo']){
 ed=await mount();w=ed.sel[0];start=geometry(w);p=down(els()[0]);move(p,30,20,99);await settle();check(near(w,start),'unrelated pointer ignored '+end);move(p,30,20);
 if(end==='rerender')renderEditor();else if(end==='undo')window.editorUndo();else window.dispatchEvent(end==='blur'?new Event('blur'):new PointerEvent(end,{pointerId:17}));
 const saved=JSON.stringify(state.editing.draft);move(p,80,60);up();await settle();check(JSON.stringify(state.editing.draft)===saved,'no stale handler after '+end);check(state.editing.cancelGesture===null,'gesture disposed '+end);
 if(end==='undo')check(near(state.editing.draft.widgets[0],start),'undo flushes then reverses pending movement');
}

ed=await mount();nodes=els();fits=[];const input=document.querySelector('#side [data-ws="appearance"][data-key="surfaceOpacity"]');
check(!!input,'appearance control available');if(input){input.value='9';input.dispatchEvent(new Event('input',{bubbles:true}));check(nodes.slice(1).every((n,i)=>n===els()[i+1]),'option edit preserves unrelated widgets');check(fits.length===1,'option edit fits only selected widget');}
nodes=els();document.querySelector('[data-arr="layer-front"]').click();check(els().at(-1)===nodes[0],'bring to front reorders existing node');check(els().every((n,i)=>Number(n.dataset.i)===i),'DOM indices follow stacking order');
document.getElementById('s-dup').click();check(ed.draft.widgets.length===5&&els().length===5,'duplicate creates one widget');document.getElementById('s-del').click();check(ed.draft.widgets.length===4&&els().length===4,'remove drops only selected duplicate');
const snapshot=copy(ed.draft);await window.editorSave();const stored=await api.list('layouts');check(JSON.stringify(stored.find(x=>x.id===ed.id).widgets)===JSON.stringify(snapshot.widgets),'saved layout retains widgets and appearance');

// Compare incremental resize with a fresh render across every stock widget,
// charts, Builder content and row designs. Both use the same presentation rules.
const types=Widgets.REGISTRY.map(d=>d.type);const fixtures=types.map(type=>({...Widgets.newWidget(type,0,20,20),w:500,h:330}));
fixtures.push({...Widgets.newWidget('textlane',0,20,20),w:500,h:330,opt:{composition:WidgetCompose.template('lane')}});
function visual(el){return [...el.querySelectorAll('*')].filter(n=>!n.matches('.h')).map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return [n.tagName,n.className?.baseVal??n.className,n.childNodes.length===1&&n.firstChild.nodeType===3?n.textContent:'',...['fontSize','fontFamily','fontWeight','fontStyle','color','backgroundColor','borderRadius','display'].map(k=>s[k]),...[r.x,r.y,r.width,r.height].map(v=>Math.round(v*10)/10)];});}
for(const fixture of fixtures){
 const d={...base,widgets:[fixture]};ed=await mount(d);ed.chartDesigns=[{...ChartWidgets.clean({name:'QA'}),id:'qa'}];ed.rowDesigns=[{...Rows.defaultDesign(),id:'qa'}];
 if(fixture.type==='racechart')ed.sel[0].opt={chartDesign:'qa'};
 if(fixture.type==='leaderboard')ed.sel[0].opt={design:'qa'};
 renderEditor();await settle();p=down(els()[0],true);move(p,30,15);up();await settle();
 const incremental=visual(els()[0]);renderEditor();await settle();const fresh=visual(els()[0]);
 if(JSON.stringify(incremental)!==JSON.stringify(fresh))(report.differences||=[]).push({type:fixture.type,incremental,fresh});check(JSON.stringify(incremental)===JSON.stringify(fresh),'resize visual parity '+fixture.type+(fixture.opt?.composition?' Builder':''));report.coverage.push(fixture.type);
}
const rd={...Rows.defaultDesign(),kind:'row',guides:{v:[],h:[]}};ed=await mount(rd);nodes=els();p=down(nodes[0],true);move(p,10,2);up();await settle();const rowPreview=document.getElementById('e-preview').textContent;renderEditor();await settle();check(document.getElementById('e-preview').textContent===rowPreview,'row preview refreshes after resizing');
WidgetView.fit=originalFit;removeEventListener('error',onError);check(!errors.length,'no renderer errors: '+errors.join('; '));
await mount({...base,ratioW:1000,ratioH:1180,widgets:[...base.widgets,{...Widgets.newWidget('racechart',0,650,40),w:320,h:220},{...Widgets.newWidget('textlane',0,650,280),w:320,h:220,opt:{composition:WidgetCompose.template('lane')}}].map((w,i)=>({...w,x:20+i%2*490,y:20+Math.floor(i/2)*380,w:470,h:350}))});
state.editing.chartDesigns=[{...ChartWidgets.clean({name:'Lap trend'}),id:'qa'}];state.editing.draft.widgets[4].opt={chartDesign:'qa'};renderEditor();await settle();
return report;
