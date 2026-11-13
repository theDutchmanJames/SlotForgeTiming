// Runs against production modules in the real app, using only synthetic widgets.
document.body.innerHTML='<main id="revision-canvas" style="position:relative;container-type:inline-size;width:1400px;height:1000px"></main>';
await document.fonts.ready;
const canvas=document.getElementById('revision-canvas'),layout={ratioW:14,ratioH:10,laneColors:[{bg:'#2f9fc5'}]},checks=[];
const assert=(condition,message)=>{if(!condition)throw Error(message);checks.push(message);};
window.revisionDraw=(w,width,height,x=0,y=0)=>{
 const out=WidgetPreview.content(w,{layout})||{html:Widgets.sampleOf(Widgets.def(w.type),0,w)};
 const n=WidgetView.mount(canvas,w,layout);n.val.innerHTML=out.html??out.text??'';
 Object.assign(n.el.style,{left:x+'px',top:y+'px',width:width+'px',height:height+'px'});
 WidgetView.fit(n,out);n.out=out;return n;
};
const widget=(type,opt={})=>({...Widgets.newWidget(type,0,0,0),appearance:{source:'theme',accent:'lane'},...opt});
const valid=(n,label)=>{
 if(n.el.dataset.fitStatus!=='fits'){n.el.classList.remove('wf-crowded');throw Error(label+' '+JSON.stringify({html:n.val.innerHTML,box:n.val.getBoundingClientRect().toJSON(),textFits:Frame.textFits(n.val),parts:[...n.val.querySelectorAll('.fg-values,.fg-value,.fg-detail,.fg-meter,.fg-meter-space')].map(e=>({cls:e.className,font:getComputedStyle(e).fontSize,rect:e.getBoundingClientRect().toJSON(),fits:Frame.textFits(e)}))}));}
 assert(n.el.dataset.fitStatus==='fits',label+' fits');
 assert(getComputedStyle(n.val).visibility!=='hidden',label+' is visible');
 assert(Frame.textFits(n.val),label+' text stays inside the content area');
};
const resize=(n,width,height)=>{Object.assign(n.el.style,{width:width+'px',height:height+'px'});WidgetView.fit(n,n.out);};
for(const columns of [2,3]){
 const w=widget('lastlap',{w:680,h:750,opt:{columns,lapsPerColumn:15,latestLap:'spotlight'},typography:{mode:'manual',valueSize:24,minSize:6}}),n=revisionDraw(w,680,750);
 const gap=()=>parseFloat(getComputedStyle(n.val.querySelector('.ll-columns')).columnGap),originalGap=gap();
 w.opt.columnGap=80;n.out=WidgetPreview.content(w,{layout});n.val.innerHTML=n.out.html;WidgetView.fit(n,n.out);
 valid(n,columns+' columns with extra spacing');assert(Math.abs(gap()-originalGap-80)<.2,'column spacing adds the selected amount');
 resize(n,340,500);valid(n,columns+' columns scaled down');assert(gap()>=40,'column spacing scales with the widget');n.el.remove();
}
for(const type of ['laptime','recordlap']){
 const w=widget(type,{w:200,h:80,showTitle:false,typography:{mode:'auto',minSize:6}}),n=revisionDraw(w,200,80);
 const large=parseFloat(getComputedStyle(n.val).fontSize);resize(n,80,28);valid(n,type+' small');
 assert(parseFloat(getComputedStyle(n.val).fontSize)<large,type+' shrinks');
 resize(n,200,80);valid(n,type+' enlarged');assert(parseFloat(getComputedStyle(n.val).fontSize)>=large-.2,type+' regrows');n.el.remove();
}
for(const latestLap of ['none','row','spotlight'])for(const columns of [1,2,3]){
 const w=widget('lastlap',{w:420,h:680,typography:{minSize:6},titleSize:18,opt:{columns,lapsPerColumn:15,rowGap:3,columnDivider:true,latestLap}});
 const n=revisionDraw(w,420,680); // Populate a full list, matching the reported screenshot.
 n.out={html:Widgets.lapListHtml(Array.from({length:45},(_,i)=>({n:90-i,t:i%3?'10.116':'9.713'})),15,columns,true,w.opt)};n.val.innerHTML=n.out.html;
 for(const [width,height] of [[420,680],[300,540],[180,360],[420,680]]){
  resize(n,width,height);valid(n,`last laps ${latestLap}/${columns} ${width}`);
  const title=n.el.querySelector('.lw-title').getBoundingClientRect(),first=n.val.querySelector('.lli').getBoundingClientRect();assert(first.top>=title.bottom,`title clear ${latestLap}/${columns} ${width}`);
  assert(n.val.querySelectorAll('.lli').length===15*columns,'all selected laps remain visible');
 }
 n.el.remove();
}
{
 const w=widget('lastlap',{w:340,h:500,opt:{columns:2,lapsPerColumn:7},numberFormat:{digits:1}}),n=revisionDraw(w,340,500);
 assert([...n.val.querySelectorAll('.llt')].every(e=>/^\d+\.\d$/.test(e.textContent.trim())),'Last Laps retains number-format integration');
 assert([...n.val.querySelectorAll('.lln')].every(e=>/^\d+$/.test(e.textContent.trim())),'number formatting leaves lap numbers intact');n.el.remove();
}
for(const [type,,width,height] of AllInOne.DEFINITIONS)for(const arrangement of ['auto','wide','stacked','compact']){
 const w=widget(type,{w:width,h:height,opt:{preset:'detailed',arrangement},typography:{minSize:6}}),n=revisionDraw(w,width,height);
 valid(n,type+' '+arrangement+' default');const text=n.val.textContent;
 resize(n,260,210);valid(n,type+' '+arrangement+' compact');assert(n.val.textContent===text,type+' preserves fields');
 resize(n,25,20);assert(n.el.dataset.fitStatus==='too-small',type+' impossible size is reported');
 resize(n,width,height);valid(n,type+' '+arrangement+' recovery');
 n.el.remove();
}
for(const type of ['laptime','aiodriver']){
 const w=widget(type,{w:400,h:300,showTitle:true,typography:{mode:'manual',titleSize:6,valueSize:6,supportSize:6,labelSize:6,minSize:14,shrink:false}}),n=revisionDraw(w,400,300);valid(n,type+' explicit six');
 assert(parseFloat(getComputedStyle(n.el.querySelector('.lw-title')).fontSize)===6,type+' title accepts six');
 assert(parseFloat(getComputedStyle(type==='aiodriver'?n.val.querySelector('.aio-primary b'):n.val).fontSize)===6,type+' value accepts six despite default floor');n.el.remove();
}
for(const opt of [{fuel:true,tyres:false,pace:false},{fuel:true,tyres:true,pace:false},{fuel:false,tyres:false,pace:false}]){
 const n=revisionDraw(widget('aiodriver',{w:400,h:300,opt}),400,300);valid(n,'dashboard optional systems');
 assert(n.val.querySelectorAll('.aio-system').length===[opt.fuel,opt.tyres,opt.pace].filter(Boolean).length,'dashboard contains only selected systems');
 if(opt.fuel&&!opt.tyres)assert(n.val.querySelector('.aio-system').getBoundingClientRect().width>=n.val.clientWidth-1,'single system uses available width');n.el.remove();
}
{
 const n=revisionDraw(widget('aiolane',{appearance:{source:'theme',accent:'none'}}),340,175);valid(n,'lane card without accent');
 assert(getComputedStyle(n.val.querySelector('.aio-position')).color!=='rgba(0, 0, 0, 0)','position remains visible without an accent');n.el.remove();
}
{
 const w=widget('lastlap',{w:300,h:200,opt:{columns:2,lapsPerColumn:5},typography:{mode:'manual',valueSize:6,shrink:false}}),n=revisionDraw(w,300,200);
 valid(n,'manual six Last Laps');assert(parseFloat(getComputedStyle(n.val.querySelector('.llt')).fontSize)===6,'manual list size refers to lap values');
 assert([...n.val.querySelectorAll('.lln')].every(e=>parseFloat(getComputedStyle(e).fontSize)>=6),'lap numbers retain six-pixel floor');n.el.remove();
}
for(const style of ['original','digital','scale'])for(const dir of ['horizontal','vertical'])for(const placement of ['overlay','above'])for(const mode of ['bar','both']){
 const width=dir==='vertical'?100:400,height=dir==='vertical'?260:70;
 const w=widget('fuel',{w:width,h:height,typography:{minSize:6},opt:{barStyle:style,mode,dir,barValues:'both',valuePlacement:placement,warningText:'hide'}}),n=revisionDraw(w,width,height);
 valid(n,`fuel ${style}/${dir}/${placement}/${mode}`);
 const meter=n.val.querySelector('.fg-meter'),space=n.val.querySelector('.fg-meter-space');
 if(dir==='horizontal')assert(Math.abs(meter.getBoundingClientRect().width-space.getBoundingClientRect().width)<1,'fuel retains full bar width');
  if(placement==='overlay'&&mode==='both')assert(Frame.textFits(meter.querySelector('.fg-values'),meter),'overlay values fit inside the bar');
 if(mode==='both')assert(!n.val.querySelector('.fg-detail').hidden,'selected capacity remains visible');
 n.el.remove();
}
// Manual sizing with shrink disabled is deliberately not silently reduced.
{
 const w=widget('textlane',{w:400,h:240,typography:{mode:'manual',valueSize:6,labelSize:6,supportSize:6},opt:{composition:WidgetCompose.template('lane')}}),n=revisionDraw(w,400,240);
 if(n.el.dataset.fitStatus!=='fits')throw Error('Builder fit '+JSON.stringify({status:n.el.dataset.fitStatus,root:[n.val.querySelector('.wc-root').clientHeight,n.val.querySelector('.wc-root').scrollHeight],parts:[...n.val.querySelectorAll('.wc-text,.wc-label')].map(e=>({text:e.textContent,fit:Frame.textFits(e,e.parentElement),rect:e.parentElement.getBoundingClientRect().toJSON()}))}));
 valid(n,'Builder six-pixel inherited typography');
 assert([...n.val.querySelectorAll('.wc-text,.wc-label')].every(e=>Math.abs(parseFloat(getComputedStyle(e).fontSize)-6)<.1),'Builder values and labels inherit six-pixel typography');n.el.remove();
}
{
 const w=widget('aiodriver',{w:400,h:300,typography:{mode:'manual',valueSize:200,shrink:false}}),n=revisionDraw(w,400,300);
 assert(n.el.dataset.fitStatus==='too-small','manual no-shrink reports insufficient space');n.el.remove();
}
{
 const w=widget('aiodriver',{w:400,h:300}),n=revisionDraw(w,400,300),search=Frame.fitSize;let calls=0;
 Frame.fitSize=(...args)=>{calls++;return search(...args);};
 try{
  n.val.querySelector('.aio-primary b').textContent='33.001';WidgetView.fit(n,n.out);valid(n,'cached timer update');
  assert(calls===0,'same-width timer update avoids a full fit search');
  resize(n,260,210);assert(calls>0,'resizing invalidates cached card fit');
 }finally{Frame.fitSize=search;n.el.remove();}
}
window.revisionGallery=()=>{
 canvas.innerHTML='';
 for(const [i,[type,,width,height]] of AllInOne.DEFINITIONS.entries())revisionDraw(widget(type,{w:width,h:height,opt:{preset:'detailed'},typography:{minSize:6}}),420,290,(i%3)*450,Math.floor(i/3)*315);
};
window.revisionDetailGallery=()=>{
 canvas.innerHTML='';
 for(const [i,latestLap] of ['row','spotlight'].entries()){
  const w=widget('lastlap',{w:340,h:680,opt:{columns:2,lapsPerColumn:15,rowGap:3,columnDivider:true,latestLap},typography:{minSize:6}}),n=revisionDraw(w,340,680,i*360,10);
  n.out={html:Widgets.lapListHtml(Array.from({length:30},(_,i)=>({n:90-i,t:i%3?'10.116':'9.713'})),15,2,true,w.opt)};n.val.innerHTML=n.out.html;WidgetView.fit(n,n.out);
 }
 for(const [i,barStyle] of ['original','digital','scale'].entries())for(const [j,valuePlacement] of ['overlay','above'].entries())revisionDraw(widget('fuel',{w:290,h:90,opt:{barStyle,mode:'both',barValues:'both',valuePlacement},typography:{minSize:6}}),290,90,735+j*315,20+i*120);
 for(const [i,barStyle] of ['original','digital','scale'].entries())revisionDraw(widget('fuel',{w:130,h:280,opt:{barStyle,dir:'vertical',mode:'both',barValues:'both'},typography:{minSize:6}}),130,280,755+i*185,420);
};
window.columnSpacingGallery=()=>{
 canvas.innerHTML='';
 for(const [i,columnGap]of [0,80].entries()){
  const w=widget('lastlap',{w:660,h:740,title:i?'Last Laps · extra column space: 80':'Last Laps · standard column space',opt:{columns:2,lapsPerColumn:15,latestLap:'spotlight',columnGap},typography:{minSize:6}}),n=revisionDraw(w,660,740,i*700,0);
  n.out={html:Widgets.lapListHtml(Array.from({length:30},(_,j)=>({n:90-j,t:j%3?'10.116':'9.713'})),15,2,true,w.opt)};n.val.innerHTML=n.out.html;WidgetView.fit(n,n.out);valid(n,'column spacing gallery');
 }
};
revisionGallery();
return {checks:checks.length};
