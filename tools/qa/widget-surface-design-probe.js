document.documentElement.dataset.theme='dark';
document.body.innerHTML=`<main id="proposal"><header><small>WIDGET APPEARANCE · PROPOSED CORRECTION</small><h1>Your background. A colour overlay. Independent labels.</h1><p>Rendered from SlotForge widgets. Preview only — the app has not been changed.</p></header><div class="columns"><b>Current behaviour</b><b>Proposed behaviour</b></div><section class="pair" id="gradient"><div><h2>Lane gradient replaces the white base</h2></div><div><h2>Lane colour fades into the white base</h2></div></section><section class="settings"><div><b>Background colour</b><span>Custom · #DDDDDD</span></div><div><b>Gradient colour</b><span>Lane colour · Lane 1</span></div><div><b>Gradient opacity</b><span>100% → transparent</span></div><div><b>Direction</b><span>Top → bottom</span></div></section><section class="pair" id="right"><div><h2>Right title is inset by the lane tag</h2></div><div><h2>Right title follows the card’s right edge</h2></div></section><section class="pair" id="left"><div><h2>Title is close to the corner and stripe</h2></div><div><h2>Consistent inset · value stays centred</h2></div></section><section class="pair" id="record"><div><h2>Track Record is pushed below the title</h2></div><div><h2>Record stays in the card’s centre</h2></div></section><footer>The title and editor lane tag do not reserve content space. Centre marks are review guides only.</footer></main>`;
const style=document.createElement('style');style.id='proposal-css';style.textContent=`body{margin:0;background:#171c22;color:#e8e6e1;font-family:system-ui,sans-serif}#proposal{max-width:1000px;margin:auto;padding:26px 32px}#proposal header small{font-size:11px;color:#74c7ef;letter-spacing:1.2px}#proposal h1{font-size:27px;margin:6px 0}#proposal header p{font-size:13px;color:#aab7c5;margin:0 0 18px}#proposal .columns,#proposal .pair{display:grid;grid-template-columns:1fr 1fr;gap:40px}#proposal .columns{font-size:14px;color:#aab7c5;border-bottom:1px solid #39424d;padding-bottom:8px}#proposal h2{font-size:13px;font-weight:500;color:#b8c6d2;margin:15px 0 24px}#proposal .canvas{position:relative;container-type:inline-size;width:100%;overflow:visible;background:none;box-shadow:none}#proposal .lw{box-sizing:border-box}#proposal .proposed .lw-title{left:12px!important;right:12px!important;top:6px!important;max-width:calc(100% - 24px)!important;width:auto!important;transform:none!important}#proposal .proposed .lw-lane{top:-19px;right:2px;font:11px/16px system-ui;color:#b8c6d2;background:#293440;padding:0 5px;border-radius:3px;opacity:1}#proposal .proposed .lw-val{top:8px!important;bottom:8px!important;left:10px!important;right:10px!important}#proposal .settings{margin-top:12px;padding:12px 14px;border:1px solid #3e5665;background:#202c35;border-radius:8px;display:grid;grid-template-columns:repeat(4,1fr);gap:14px;font-size:12px}#proposal .settings div{display:grid;gap:4px}#proposal .settings span{color:#b8c6d2}#proposal .centre{position:absolute;inset:50% 0 auto;height:0;border-top:1px dashed #369eb455;z-index:0;pointer-events:none}#proposal .centre.vertical{inset:0 auto 0 50%;height:auto;width:0;border-top:0;border-left:1px dashed #369eb455}#proposal .record-main{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:27px;line-height:1;font-weight:900;font-style:italic}#proposal .record-by{position:absolute;left:calc(50% + 49px);top:50%;transform:translateY(-50%);font-size:12px;font-weight:600;font-style:italic}#proposal footer{font-size:12px;color:#aab7c5;margin-top:19px}@media(max-width:740px){#proposal{padding:20px}.pair,.columns{gap:20px!important}#proposal .settings{grid-template-columns:1fr 1fr}#proposal h1{font-size:22px}}`;
document.head.append(style);
const checks=[];
function card(section,side,type,props={},height=100){
 const host=document.createElement('div');host.className='canvas'+(side?' proposed':'');host.style.height=height+'px';
 document.querySelector('#'+section).children[side].append(host);
 const w={...Widgets.newWidget(type,0,0,0),w:1000,h:height/host.clientWidth*1000,bgColor:'#dddddd',textColor:'#333333',titleBold:true,title:'BEST LAP',titleAlign:'left',radius:6,textSize:140,fonts:{title:'condensed',titleWeight:700,value:'highvis'},laneColorStyle:'side',...props};
 const layout={ratioW:1000,ratioH:w.h,laneColors:[{bg:'#2f9fc5'},{bg:'#76a747'}],widgets:[w]};
 const content=type==='name'?'James':type==='bestlap'?(side?'10.073':'10.073'):WidgetPreview.content(w).html;
 host.innerHTML=WidgetView.html(w,layout,content,{decoration:type==='trackrecord'?'':'<span class="lw-lane">L'+(w.lane+1)+'</span>'});
 const el=host.querySelector('.lw'),val=el.querySelector('.lw-val');WidgetView.fit({el,val,w,layout},{});
 if(side){const badge=el.querySelector('.lw-lane');if(badge)host.append(badge);}
 return {host,w,layout,el,val};
}
const originals=[],proposed=[];
for(const side of [0,1]){
 const name=card('gradient',side,'name',{showTitle:false,valueAlign:'left',textSize:125,laneColorStyle:'top',appearance:{fill:'gradient',source:'lane',baseColor:'#dddddd',strength:'medium',angle:180}},80);
 if(side){name.el.style.background='linear-gradient(180deg, rgba(47,159,197,1), rgba(47,159,197,0)) #dddddd';name.el.style.color='#333333';name.el.dataset.proposedGradient='true';}
 const right=card('right',side,'bestlap',{titleAlign:'right',lane:1,laneColorStyle:'right'});
 const left=card('left',side,'bestlap');
 const rec=card('record',side,'trackrecord',{title:'Track Record:',bgColor:'#333a41',textColor:'#fff',fonts:{title:'condensed',titleWeight:700,value:'inter',valueWeight:900},textSize:65,valueItalic:true,laneColorStyle:'none'},58);
 for(const c of [right,left,rec]){c.host.insertAdjacentHTML('beforeend','<i class="centre"></i><i class="centre vertical"></i>');}
 if(side){rec.val.innerHTML='<span class="record-main">9.500</span><span class="record-by">James</span>';}
 (side?proposed:originals).push(name,right,left,rec);
}
await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
for(const c of [...originals,...proposed]){
 if(c.w.type==='trackrecord'&&c.host.classList.contains('proposed'))continue;
 WidgetView.fit({el:c.el,val:c.val,w:c.w,layout:c.layout},{});
 if(c.el.dataset.proposedGradient)c.el.style.background='linear-gradient(180deg, rgba(47,159,197,1), rgba(47,159,197,0)) #dddddd';
}
for(const c of proposed){const r=c.el.getBoundingClientRect(),v=c.val.getBoundingClientRect();checks.push({type:c.w.type,centreOffset:Math.abs((v.top+v.bottom-r.top-r.bottom)/2),laneLabelOutside:!c.host.querySelector('.lw-lane')||c.host.querySelector('.lw-lane').getBoundingClientRect().bottom<=r.top});}
window.proposalChecks=checks;if(checks.some(x=>x.centreOffset>.75||!x.laneLabelOutside))throw Error(JSON.stringify(checks));
