// Diagnostic reproductions, deliberately not regression tests that endorse bugs.
const findings={};
const host=document.createElement('div');host.className='canvas live';host.style.cssText='position:relative;width:1000px;height:500px;container-type:inline-size';document.body.append(host);
const w=Widgets.newWidget('bestlap',0,0,0);Object.assign(w,{w:400,h:160,typography:{mode:'auto'}});
const laneColours=[{bg:'#2f9fc5',text:'#ffffff'},{bg:'#76a747',text:'#ffffff'}];
const layout={ratioW:2,ratioH:1,widgets:[w,{...w,id:w.id+'2',lane:1,x:450}],laneColors:laneColours};
const originalContent=Timing.content,originalFit=Frame.fit,NativeObserver=window.ResizeObserver;
let calls=0,created=0,disconnected=0;const observers=[];
try{
 window.ResizeObserver=class extends NativeObserver{constructor(cb){super(cb);created++;observers.push(this);}disconnect(){disconnected++;super.disconnect();}};
 let nodes;for(let i=0;i<5;i++)nodes=LiveCanvas.build(host,layout,2);
 const full=LiveCanvas.fullView(layout,2);full.close();
 findings.observerLifecycle={builds:5,fullScreenOpenClose:1,created,explicitDisconnects:disconnected,note:'Counts explicit cleanup only; does not establish retained heap memory.'};
 Timing.content=()=>{calls++;return {html:'<b>8.402</b>',bg:'#222831',color:'#ffffff'};};
 LiveCanvas.paint(nodes,{});const originalChild=nodes[0].val.firstChild;
 LiveCanvas.paint(nodes,{});findings.unchangedPaint={formatterCalls:calls,widgets:nodes.length,paints:2,domRetained:nodes[0].val.firstChild===originalChild};
 Timing.content=()=>({html:'<b>8.402</b>',bg:'#884444',color:'#ffffff'});LiveCanvas.paint(nodes,{});
 findings.colourOnly={contentNodeReplaced:nodes[0].val.firstChild!==originalChild};
 Frame.fit=(el,w)=>{if(w.id===nodes[0].w.id)throw Error('Injected sizing failure');return originalFit(el,w);};
 Timing.content=()=>({html:'9.999',bg:'#222831',color:'#ffffff'});
 let error='';try{LiveCanvas.paint(nodes,{});}catch(e){error=e.message;}
 findings.fitFailure={error,secondWidgetUpdated:nodes[1].val.textContent==='9.999',firstCacheAlreadyAdvanced:nodes[0].last[0]==='9.999'};
 Frame.fit=originalFit;
 const row=Rows.defaultDesign(),legacy=Rows.sampleHtml(row,2,[],{laneColorStyle:'side',layout:{laneColors:laneColours}}),modern=Rows.sampleHtml(row,2,[],{laneColorStyle:'side',layout:{laneColors:laneColours,widgetAppearance:{accent:'lane',edge:'left'}}});
 findings.rowStripe={legacyStripes:(legacy.match(/rrow-bg lcstripe-side/g)||[]).length,modernStripes:(modern.match(/rrow-bg lcstripe-side/g)||[]).length};
 // Fitting coverage uses the actual registered samples in real browser boxes.
 // A false result is an adapter boundary, not proof the widget is visually broken.
 findings.fitCoverage=[];
 for(const d of Widgets.REGISTRY.filter(d=>!d.button&&!d.hidden)){
  const sample={...Widgets.newWidget(d.type,0,0,0),w:450,h:250,typography:{mode:'auto'}};
  const el=document.createElement('div');el.className='lw live'+(AllInOne.TYPES.has(d.type)?' aio-widget':'');el.style.cssText='position:relative;width:450px;height:250px;font-size:30px';
  el.innerHTML='<span class="lw-val">'+Widgets.sampleOf(d,0,sample)+'</span>';host.append(el);
  try{Frame.present(el,sample,layout);findings.fitCoverage.push({type:d.type,handled:!!Frame.fit(el,sample),status:el.dataset.fitStatus||'specialised'});}catch(e){findings.fitCoverage.push({type:d.type,error:e.message});}el.remove();
 }
}finally{Timing.content=originalContent;Frame.fit=originalFit;window.ResizeObserver=NativeObserver;observers.forEach(o=>NativeObserver.prototype.disconnect.call(o));host.remove();}
return findings;
