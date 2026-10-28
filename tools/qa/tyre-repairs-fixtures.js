const findings={};
const host=document.createElement('div');host.className='canvas';Object.assign(host.style,{position:'fixed',inset:'0',width:'1000px',height:'1000px',zIndex:99999,background:'#171c22'});document.body.append(host);
const mount=(opt,extra={},row={})=>{const w={...Widgets.newWidget('tyrelife',0,0,0),w:450,h:300,showTitle:false,opt:{look:'bar',barStyle:'digital',showName:true,...opt},...extra};const n=WidgetView.mount(host,w,{ratioW:1,ratioH:1,widgets:[w]});n.val.innerHTML=TyreWidgets.rowHtml({...TyreWidgets.sampleRow(1),...row},w.opt).html;WidgetView.fit(n,{});return n;};
findings.typography=[];
for(const supportSize of [11,32]){host.replaceChildren();const n=mount({}, {typography:{mode:'manual',valueSize:44,supportSize,iconSize:supportSize===11?20:100,shrink:false},fonts:{value:'inter',valueWeight:900,support:'mono',supportWeight:700}});await document.fonts.ready;WidgetView.fit(n,{});const cs=q=>getComputedStyle(n.val.querySelector(q));findings.typography.push({requestedSupport:supportSize,detailSize:cs('.fg-detail').fontSize,detailFont:cs('.fg-detail').fontFamily,primaryWeight:cs('.fg-value').fontWeight,iconWidth:n.val.querySelector('svg').getBoundingClientRect().width,status:n.el.dataset.fitStatus});}
host.replaceChildren();
const fuel={...Widgets.newWidget('fuel',0,0,0),w:450,h:300,showTitle:false,opt:{mode:'both',barStyle:'digital',barValues:'both'},fonts:{value:'inter',valueWeight:900,support:'mono',supportWeight:700}};
const fuelNode=WidgetView.mount(host,fuel,{ratioW:1,ratioH:1,widgets:[fuel]});fuelNode.val.innerHTML=Widgets.fuelHtml(62,100,fuel.opt);WidgetView.fit(fuelNode,{});
findings.fuelTypography={weight:getComputedStyle(fuelNode.val.querySelector('.fg-value')).fontWeight,supportFont:getComputedStyle(fuelNode.val.querySelector('.fg-detail')).fontFamily,supportWeight:getComputedStyle(fuelNode.val.querySelector('.fg-detail')).fontWeight,status:fuelNode.el.dataset.fitStatus};
findings.oneFact=[];
for(const fields of [{showPct:true,showLeft:false,showGrip:false,showName:false},{showPct:false,showLeft:false,showGrip:true,showName:false},{showPct:false,showLeft:true,showGrip:false,showName:false}]){host.replaceChildren();const n=mount(fields,{w:450,h:250});const v=n.val.querySelector('.fg-value'),details=n.val.querySelector('.fg-detail');findings.oneFact.push({fields,text:n.val.textContent,primaryWidth:v?.clientWidth,footerWidth:n.val.querySelector('.fg-values')?.clientWidth,detailWidth:details?.clientWidth,status:n.el.dataset.fitStatus});}
findings.labels=[];
for(const tyre of ['Club $1','Club $&',"Club $'",'Club $`','<img src=x>']){host.replaceChildren();const n=mount({}, {},{tyre});findings.labels.push({tyre,shown:n.val.querySelector('.tg-name')?.textContent,heads:n.val.querySelectorAll('.tg-head').length,meters:n.val.querySelectorAll('.fg-meter').length,status:n.el.dataset.fitStatus});}
findings.legacy=[];
for(const opt of [{look:'bar',dir:'vertical'},{look:'bar',dir:'vertical',barStyle:'original'}]){const html=TyreWidgets.rowHtml({...TyreWidgets.sampleRow(1),life:20,shown:20,level:'warn'},opt).html;findings.legacy.push({opt,icon:html.includes('data-tyre-letter'),warning:html.includes('Tyres wearing low'),style:html.includes('fuel-gauge')?'new':'legacy'});}
findings.geometry=[];
for(const dir of ['horizontal','vertical'])for(const style of ['original','digital','scale'])for(const title of [false,true])for(const fields of [{showPct:true,showLeft:false,showGrip:false,showIcon:false},{showPct:false,showLeft:true,showGrip:false,showName:false},{showPct:false,showLeft:false,showGrip:true,showIcon:false,showName:false}]){host.replaceChildren();const n=mount({...fields,dir,barStyle:style},{w:dir==='vertical'?100:350,h:dir==='vertical'?260:60,showTitle:title});findings.geometry.push({dir,style,title,fields,status:n.el.dataset.fitStatus,text:n.val.textContent,detailHidden:n.val.querySelector('.fg-detail')?.hidden});}
host.remove();
document.body.append(host);host.replaceChildren();Object.assign(host.style,{width:'1200px',height:'950px',color:'#e7e9ed',fontFamily:'sans-serif'});
const heading=document.createElement('h2');heading.textContent='Audit fixtures — actual widget renderer';heading.style.cssText='margin:20px';host.append(heading);
const cases=[
  ['Manual support: 11px · icon: 20px',{showName:true},{typography:{mode:'manual',valueSize:44,supportSize:11,iconSize:20,shrink:false},fonts:{value:'inter',valueWeight:900,support:'mono',supportWeight:700}},{}],
  ['Manual support: 32px · icon: 100px',{showName:true},{typography:{mode:'manual',valueSize:44,supportSize:32,iconSize:100,shrink:false},fonts:{value:'inter',valueWeight:900,support:'mono',supportWeight:700}},{}],
  ['Grip is the only selected fact',{showPct:false,showLeft:false,showGrip:true,showName:false,showIcon:false},{},{}],
  ["Custom tyre name: Club $'",{showName:true},{},{tyre:"Club $'"}]
];
for(let i=0;i<cases.length;i++){const [title,opt,extra,row]=cases[i],x=35+(i%2)*580,y=115+Math.floor(i/2)*400;const label=document.createElement('div');label.textContent=title;label.style.cssText=`position:absolute;left:${x}px;top:${y-32}px;font-size:18px`;host.append(label);const n=mount(opt,{...extra,x,y,w:530,h:310},row);Object.assign(n.el.style,{left:x+'px',top:y+'px',width:'530px',height:'310px'});WidgetView.fit(n,{});}
await document.fonts.ready;
return findings;


