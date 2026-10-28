// Exercise all Tyre/Push & Save looks and wrapped text at actual screen sizes.
const cases=[
 ['tyrelife',{look:'wear',showTemperature:true,showName:true}],
 ['tyrelife',{look:'ring',showTemperature:true}],
 ['tyrelife',{look:'bar',showName:true,showGrip:true,showTemperature:true}],
 ['tyrelife',{look:'bar',dir:'vertical',showName:true,showGrip:true}],
 ['tyrelife',{look:'number',showTemperature:true,showName:true}],
 ['pace',{look:'gauge',showRef:true}],['pace',{look:'wear'}],['pace',{look:'bar',showRef:true}],
 ['fuel',{mode:'number'}],['fuel',{mode:'both',dir:'vertical'}],
 ['swapsignal',{text:'CHANGE DRIVERS',names:true}],['textlane',{text:'{name} · {best}'}]
];
document.body.innerHTML='<main id="audit" style="padding:12px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px"></main>';
await document.fonts.ready;
const failures=[],results=[];
for(const [index,[type,opt]] of cases.entries()){
 const w={...Widgets.newWidget(type,0,0,0),w:1000,h:800,opt,appearance:{source:'theme',accent:'lane',edge:'left',radiusPixels:14},fonts:{value:'highvis'}};
 const layout={ratioW:10,ratioH:8,widgets:[w]};
 const holder=document.createElement('section');holder.innerHTML='<div class="muted" style="font-size:12px;margin-bottom:5px">'+type+' · '+(opt.look||opt.mode||'text')+'</div><div class="canvas" style="width:100%;aspect-ratio:10/8"></div>';document.getElementById('audit').append(holder);
 const host=holder.lastElementChild,el=WidgetView.mount(host,w,layout);el.val.innerHTML=Widgets.sampleOf(Widgets.def(type),0,w);
 WidgetView.fit(el,WidgetPreview.content(w)||{});
 for(const width of [280,400]){
  host.style.width=width+'px';host.style.height=(width*.8)+'px';WidgetView.fit(el,WidgetPreview.content(w)||{});
  const v=el.val,box=v.getBoundingClientRect();
  const visible=!el.el.classList.contains('wf-crowded');
  const textNodes=[];const walker=document.createTreeWalker(v,NodeFilter.SHOW_TEXT);while(walker.nextNode()){if(!walker.currentNode.textContent.trim()||walker.currentNode.parentElement.closest('svg'))continue;const range=document.createRange();range.selectNodeContents(walker.currentNode);for(const r of range.getClientRects())textNodes.push({text:walker.currentNode.textContent,font:parseFloat(getComputedStyle(walker.currentNode.parentElement).fontSize),inside:r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1});}
  const overflow=textNodes.filter(n=>!n.inside||n.font<10.99);for(const n of v.querySelectorAll('.ftxt'))if(!Frame.textFits(n))overflow.push({text:n.textContent,barClipped:true});results.push({type,opt,width,visible,status:el.el.dataset.fitStatus||'no-fit',overflow});
  if(!visible||overflow.length)failures.push(type+' '+(opt.look||opt.mode||'text')+' '+width+' '+(!visible?'too-small':JSON.stringify(overflow)));
 }
 host.style.width='100%';host.style.height='';WidgetView.fit(el,WidgetPreview.content(w)||{});for(const n of el.val.querySelectorAll('.ftxt'))if(!Frame.textFits(n))failures.push(type+' final bar clipping');
 const bar=el.val.querySelector('.tt-widgetbar .fbar'),details=el.val.querySelector('.twbar-details');if(bar&&details&&bar.getBoundingClientRect().bottom>details.getBoundingClientRect().top)failures.push(type+' bar overlaps supporting text');
 const pic=el.val.querySelector('.twpic,.twringw,.psgauge');if(pic&&pic.getBoundingClientRect().height<24)failures.push(type+' icon too small');
}
return {results,failures};
