// Runs inside the actual app renderer. Detached diagnostic host, production markup.
const host=document.createElement('div');host.className='canvas';host.style.cssText='position:fixed;left:0;top:0;width:1000px;height:700px;z-index:9999;background:var(--bg)';document.body.appendChild(host);
const layout={ratioW:10,ratioH:7,widgets:[],laneColors:Widgets.LANES},failures=[],details=[];let checks=0;
state.editing={draft:layout,sel:[],drivers:[],cars:[],teams:[],customWidgets:[],imageSets:[],rowDesigns:[],chartDesigns:[]};
const check=(v,m)=>{checks++;if(!v)failures.push(m);};
const settle=()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
const make=(type,w,h,extra={})=>({...Widgets.newWidget(type,0,0,0),w,h,typography:{mode:'auto'},...extra});
async function renderOne(w,text){host.innerHTML=widgetHtml(w,true,true,layout);const el=host.querySelector('.lw');if(text!==undefined)el.querySelector('.lw-val').textContent=text;Frame.present(el,w,layout);await document.fonts.ready;Frame.fit(el,w);await settle();Frame.fit(el,w);return el;}
function fits(el){const ok=Frame.textFits(el.querySelector('.lw-val'))&&el.dataset.fitStatus==='fits';if(!ok)details.push({html:el.outerHTML,rect:el.getBoundingClientRect().toJSON(),textFits:Frame.textFits(el.querySelector('.lw-val')),local:[...el.querySelectorAll('.twlf,.twgr,.twpct,.psp,.pspill>span,.psbox>small,.aio-fact b,.aio-who>strong,.aio-who>span,.aio-laprow strong')].map(n=>{const r=document.createRange();r.selectNodeContents(n);return {text:n.textContent,fits:Frame.textFits(n),box:n.getBoundingClientRect().toJSON(),range:r.getBoundingClientRect().toJSON(),font:getComputedStyle(n).fontSize};})});return ok;}
for(const font of ['theme','highvis','condensed','mono'])for(const columns of [1,2,3])for(const count of [1,7]){
 const w=make('lastlap',columns*150,220,{opt:{columns,lapsPerColumn:count},fonts:{value:font}}),el=await renderOne(w),v=el.querySelector('.lw-val');
 check(fits(el),`editor list ${font}/${columns}/${count}`);const before=parseFloat(getComputedStyle(v).fontSize);
 el.classList.remove('sel');el.classList.add('live');LiveCanvas.fitValue({w,el,val:v,layout});
 check(fits(el),`live list ${font}/${columns}/${count}`);check(Math.abs(before-parseFloat(getComputedStyle(v).fontSize))<.2,`editor/live agreement ${font}/${columns}/${count}`);
}
let el=await renderOne(make('bestlap',150,80,{showTitle:false}),'8.402'),small=parseFloat(getComputedStyle(el.querySelector('.lw-val')).fontSize);
el=await renderOne(make('bestlap',500,200,{showTitle:false}),'8.402');check(parseFloat(getComputedStyle(el.querySelector('.lw-val')).fontSize)>small*2,'automatic grows with widget');check(fits(el),'500×200 fits');
el=await renderOne(make('bestlap',300,150,{showTitle:false,typography:{mode:'manual',valueSize:200,minSize:14,shrink:true}}),'12345.678');check(fits(el),'manual 200 shrinks completely');
el=await renderOne(make('bestlap',500,200,{showTitle:false,typography:{mode:'manual',valueSize:32,shrink:false}}),'8.402');check(Math.abs(parseFloat(getComputedStyle(el.querySelector('.lw-val')).fontSize)-32)<.2,'manual exact size');
el=await renderOne(make('lastlap',150,100,{opt:{columns:3,lapsPerColumn:30}}));check(el.classList.contains('wf-crowded'),'impossible grid warns rather than reducing below minimum');check(el.querySelectorAll('.lli').length===90,'no laps silently removed');
el=await renderOne(make('bestlap',180,100,{title:'Fastest legal lap in this championship',titleAlign:'left',fonts:{title:'highvis'}}));check(fits(el),'long title value fits');check(el.querySelector('.lw-title').getBoundingClientRect().right<=el.getBoundingClientRect().right,'long title bounded');
for(const [type,w,h]of [['tyresets',360,90],['tyrelife',160,130],['pace',180,130],['aiolane',400,320],['aiotiming',500,180]]){el=await renderOne(make(type,w,h));check(fits(el),type+' fits');}
for(const lane of [0,1,2])for(const width of [200,320]){
 el=await renderOne(make('pace',width,220,{lane,opt:{look:'gauge',showRef:true},fonts:{value:'highvis'}}));
 check(fits(el),`pace gauge state ${lane} at ${width}`);
 const gauge=el.querySelector('.psgauge');check(gauge.getBoundingClientRect().height>0,'gauge remains visible');
}
el=await renderOne(make('tyrelife',220,200,{typography:{mode:'auto',iconSize:40}}));
check(el.querySelector('.twpic,.twringw').getBoundingClientRect().height<=40.5,'manual icon cap honoured');
el=await renderOne(make('textlane',250,100,{typography:{mode:'manual',valueSize:100,shrink:true},opt:{composition:WidgetCompose.clean({root:{kind:'value',key:'best'}})}}));check(fits(el),'Builder text shrinks');
el=await renderOne(make('textlane',350,220,{opt:{composition:WidgetCompose.clean({root:{kind:'component',component:'lastlap',options:{columns:2,lapsPerColumn:7}}})}}));check(fits(el),'Builder nested Last Laps fits');
// Content changes and resize invalidate measurements; same-width timer digits stay stable.
const w=make('bestlap',300,120,{showTitle:false});el=await renderOne(w,'8.402');let v=el.querySelector('.lw-val'),font=getComputedStyle(v).fontSize;
v.textContent='9.999';Frame.fit(el,w);check(getComputedStyle(v).fontSize===font,'tabular digits stable');v.textContent='1:23:45.678';Frame.fit(el,w);check(fits(el),'longer timing value refits without splitting');
host.remove();return {checks,failures,details};
