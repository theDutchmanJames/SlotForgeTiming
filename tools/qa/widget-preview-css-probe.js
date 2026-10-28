const failures=[],differencesByWidget={};let cases=0,properties=0,differences=0;
const sheets=qaSheets.files.map(file=>{const link=[...document.querySelectorAll('link[rel=stylesheet]')].find(e=>e.getAttribute('href')===file);const style=document.createElement('style');link.after(style);link.disabled=true;return style;});
const use=version=>sheets.forEach((s,i)=>s.textContent=qaSheets[version][i]);
document.body.innerHTML='<main id="css-audit"></main>';await document.fonts.ready;
const host=document.querySelector('#css-audit');host.className='canvas';host.style.cssText='position:relative;width:400px;height:300px;';
const snapshot=el=>[el,...el.querySelectorAll('*')].map(n=>['', '::before','::after'].map(p=>{const s=getComputedStyle(n,p);const v={};for(const k of s){if(!['caret-color','cursor'].includes(k))v[k]=s.getPropertyValue(k);}return v;}));
for(const theme of ['dark','light','ocean'])for(const modern of [false,true])for(const width of [240,400]){
 document.documentElement.dataset.theme=theme;host.style.width=width+'px';host.style.height=width*.75+'px';
 for(const d of Widgets.REGISTRY){
  const w={...Widgets.newWidget(d.type,1,0,0),w:1000,h:750,laneColorStyle:'side',...(modern?{appearance:{source:'theme',fill:'gradient',accent:'lane',edge:'right'},typography:{mode:'manual',valueSize:30,supportSize:13}}:{})};
  if(d.type==='lastlap')w.opt={columns:2,lapsPerColumn:7};if(d.type==='pace')w.opt={look:'gauge'};if(d.type==='tyrelife')w.opt={look:'bar',showTemperature:true};
  const layout={ratioW:4,ratioH:3,widgets:[w],laneColors:[{bg:'#35a8cf'},{bg:'#80b354'}]};
  const output=WidgetPreview.content({...w,previewLayout:layout})||{html:d.sample};
  const draw=version=>{use(version);host.replaceChildren();const cell=WidgetView.mount(host,w,layout);cell.val.innerHTML=output.html;WidgetView.fit(cell,output);return snapshot(cell.el);};
  const a=draw('baseline'),b=draw('current');cases++;
  const title=host.querySelector('.lw-title');if(title&&!w.titleSize&&!w.typography?.titleSize&&parseFloat(getComputedStyle(title).fontSize)<11)failures.push({type:d.type,reason:'default title too small'});
  if(d.type==='wxforecast'&&!modern){const text=host.querySelector('.wxt');if(text&&parseFloat(getComputedStyle(text).fontSize)<11)failures.push({type:d.type,reason:'weather text too small'});}
  if(a.length!==b.length){failures.push({type:d.type,theme,modern,width,reason:'node count'});continue;}
  for(let i=0;i<a.length;i++)for(let p=0;p<3;p++)for(const k in a[i][p]){properties++;if(a[i][p][k]!==b[i][p][k]){
   differences++;differencesByWidget[d.type]=(differencesByWidget[d.type]||0)+1;
   if(failures.length<40)failures.push({type:d.type,theme,modern,width,node:i,pseudo:p,key:k,before:a[i][p][k],after:b[i][p][k]});
  }}
 }
}
use('current');return {cases,properties,differences,differencesByWidget,failures};
