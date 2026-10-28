const failures=[];let checks=0;const check=(ok,label)=>{checks++;if(!ok)failures.push(label);};
const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const make=(type,lane,x,y,w,h,extra={})=>({...Widgets.newWidget(type,lane,x,y),w,h,bgColor:'#dddddd',textColor:'#333333',radius:14,typography:{mode:'manual',valueSize:85,minSize:14,shrink:true},fonts:{value:'highvis'},...extra});
window.surfaceDesign={name:'Widget surface verification',ratioW:10,ratioH:7,widgets:[
 make('name',0,20,40,460,100,{showTitle:false,valueAlign:'left',appearance:{fill:'gradient',source:'custom',baseColor:'#dddddd',gradientSource:'lane',gradientOpacity:100,angle:180}}),
 make('name',1,520,40,460,100,{showTitle:false,valueAlign:'left',appearance:{fill:'gradient',source:'custom',baseColor:'#dddddd',gradientSource:'lane',gradientOpacity:100,angle:180}}),
 make('bestlap',0,20,190,460,120,{titleAlign:'left',laneColorStyle:'side'}),
 make('bestlap',1,520,190,460,120,{titleAlign:'right',laneColorStyle:'right'}),
 make('trackrecord',0,20,350,460,70,{title:'Track Record:',bgColor:'#333a41',textColor:'#fff',typography:{mode:'manual',valueSize:36,minSize:14,shrink:true}}),
 make('sessionrecord',0,520,350,460,70,{title:'Session Record:',bgColor:'#333a41',textColor:'#fff',typography:{mode:'manual',valueSize:36,minSize:14,shrink:true}}),
 make('aiotiming',0,20,460,460,200,{opt:{arrangement:'wide'},showTitle:false,typography:{mode:'auto'},appearance:{fill:'gradient',source:'custom',baseColor:'#dddddd',gradientSource:'lane',gradientOpacity:60,angle:90}}),
 make('lastlap',1,520,460,460,200,{showTitle:false,typography:{mode:'auto'},opt:{columns:2,lapsPerColumn:3}})
],laneColors:[{bg:'#2f9fc5'},{bg:'#76a747'}],guides:{v:[],h:[]}};
state.tab='custom';state.customSub='layouts';state.editing={id:null,draft:surfaceDesign,sel:[surfaceDesign.widgets[0]],snap:false,dirty:true,drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};state.sideOpen=new Set(['frame']);await render();await document.fonts.ready;fitEditorWidgets();await settle();
const select=(w)=>{state.editing.sel=[w];renderEditor();};
function change(key,value){const input=document.querySelector(`#side [data-ws="appearance"][data-key="${key}"]`);check(!!input,'control '+key);input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
const first=surfaceDesign.widgets[0];select(first);change('gradientSource','custom');change('gradientColor','#d85c89');change('gradientOpacity',72);
check(first.appearance.gradientColor==='#d85c89'&&first.appearance.gradientOpacity===72,'actual editor writes gradient settings');check(Frame.baseColour(first,surfaceDesign)==='#dddddd','editing overlay preserves chosen background');
change('gradientSource','lane');change('gradientOpacity',100);state.editing.sel=[];renderEditor();await document.fonts.ready;fitEditorWidgets();await settle();
for(const [i,w]of surfaceDesign.widgets.entries()){
 const el=document.querySelector(`#canvas > .lw[data-i="${i}"]`),v=el.querySelector('.lw-val'),r=el.getBoundingClientRect(),b=v.getBoundingClientRect();
 check(Math.abs((b.top+b.bottom-r.top-r.bottom)/2)<.75,w.type+' full-frame vertical centre');
 check(Frame.textFits(v),w.type+' visible text fits');
 const title=el.querySelector('.lw-title');if(title){const t=title.getBoundingClientRect();check(Math.abs(t.left-r.left-13)<1.5,w.type+' title left inset');check(Math.abs(r.right-t.right-13)<1.5,w.type+' title right inset');}
 if(Widgets.def(w.type).perLane)check(!el.querySelector('.lw-lane'),'lane label outside '+w.type);
 const number=el.querySelector('.record-value');if(number){const n=number.getBoundingClientRect();check(Math.abs((n.left+n.right-r.left-r.right)/2)<.75,'record number horizontal centre');}
}
check(document.querySelectorAll('#canvas > .lw-lane').length===6,'lane tags remain available in the editor');
// Title visibility and badge presence must not alter the value's fitting box.
const w=surfaceDesign.widgets[2],snapshot=()=>{const v=document.querySelector('#canvas > .lw[data-i="2"] .lw-val');return [v.clientWidth,v.clientHeight,getComputedStyle(v).fontSize];},before=snapshot();
w.showTitle=false;renderEditor();fitEditorWidgets();check(JSON.stringify(before)===JSON.stringify(snapshot()),'title toggle does not change value size');w.showTitle=true;renderEditor();fitEditorWidgets();
const saved=await api.add('layouts',surfaceDesign),reopened=(await api.list('layouts')).find(l=>l.id===saved.id);check(JSON.stringify(reopened.widgets)===JSON.stringify(surfaceDesign.widgets),'save/reopen keeps all surface controls');
// Automatic contrast samples the actual custom base, independently of theme.
for(const theme of ['dark','light','ocean']){document.documentElement.dataset.theme=theme;const white={type:'name',lane:0,bgColor:'#ffffff',appearance:{fill:'gradient',gradientOpacity:0}};check(['#101820','#000000'].includes(Frame.inkFor(white,{})),'white base readable in '+theme);}
// Every adapter must keep the same content box when its title is toggled.
const host=document.createElement('div');host.className='canvas';host.style.cssText='position:fixed;left:0;top:0;width:1000px;height:700px;visibility:hidden';document.body.append(host);
for(const def of Widgets.REGISTRY){
 const w={...Widgets.newWidget(def.type,0,0,0),w:500,h:300,typography:{mode:'auto'}},layout={ratioW:10,ratioH:7,widgets:[w]};
 const content=Widgets.sampleOf(def,0,w),measure=showTitle=>{
  w.showTitle=showTitle;host.innerHTML=WidgetView.html(w,layout,content);const el=host.querySelector('.lw'),val=el.querySelector('.lw-val');WidgetView.fit({el,val,w,layout});const r=val.getBoundingClientRect();return [r.x,r.y,r.width,r.height,getComputedStyle(val).fontSize];
 };
 check(JSON.stringify(measure(true))===JSON.stringify(measure(false)),def.type+' title-independent content geometry');
}
host.remove();
document.documentElement.dataset.theme='dark';state.editing.sel=[first];renderEditor();await document.fonts.ready;fitEditorWidgets();await settle();
return {checks,failures};
