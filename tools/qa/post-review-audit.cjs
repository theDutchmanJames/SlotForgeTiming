// Audit reproductions only: isolated data, no hardware or external network.
const {app}=require('electron'),fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../../../outputs/post-review-audit');
fs.mkdirSync(out,{recursive:true});app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/post-review-audit-'+process.pid));app.disableHardwareAcceleration();
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>app.exit(2),90000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1250,950);
  const result={};
  await run(`window.auditErrors=[];addEventListener('error',e=>auditErrors.push(e.message));state.tab='custom';state.customSub='widgets';await render();document.getElementById('new-composer').click();`);await wait(150);
  await run(`window.auditChart=await api.add('chartdesigns',{...ChartWidgets.clean({name:'Audit Live Track',style:'track',drivers:'one',lane:0,legend:true}),id:undefined});
   wbEd.charts=[auditChart];wbEd.draft.composition=WidgetCompose.clean({root:{id:'root',kind:'free',children:[{id:'track',kind:'component',component:'racechart',options:{chartDesign:auditChart.id},frame:{x:0,y:0,w:100,h:100}}]}});wbEd.draft.w=600;wbEd.draft.h=350;wbEd.composerUI.selected='track';WidgetStudio.edit(document.getElementById('setupbox'));`);await wait(100);
  result.builderChartSize=await run(`const p=document.querySelector('#wc-preview .wc-standard'),s=p.querySelector('svg');return {box:{width:p.clientWidth,height:p.clientHeight},svg:s?{width:s.getBoundingClientRect().width,height:s.getBoundingClientRect().height}:null,note:p.innerText};`);
  fs.writeFileSync(path.join(out,'builder-chart.png'),(await win.webContents.capturePage()).toPNG());
  await run(`wbEd.composerUI.play=false;clearTimeout(wbEd.composerUI.timer);wbEd.composerUI.freeDispose?.();
   document.body.innerHTML='<h2 style="padding:0 20px">Standalone Live Track (left) / same chart inside a custom widget (right)</h2><div id="auditCanvas" class="canvas"></div>';
   window.auditS={...WidgetPreview.state({}, {scenario:'race'}),preview:false,now:51000,chartDesigns:[auditChart]};
   const direct={...Widgets.newWidget('racechart',0,0,0),w:480,h:320,showTitle:false,opt:{chartDesign:auditChart.id}};
   const composed={...Widgets.newWidget('textrace',0,500,0),w:480,h:320,showTitle:false,opt:{composition:wbEd.draft.composition}};
   window.auditLayout={ratioW:1000,ratioH:600,widgets:[direct,composed],laneColors:[]};auditS.layout=auditLayout;
   window.auditNodes=LiveCanvas.build(document.getElementById('auditCanvas'),auditLayout,8);LiveCanvas.paint(auditNodes,auditS);
   window.positions=()=>auditNodes.map(n=>n.val.querySelector('[data-track-marker]')?.getAttribute('transform'));`);await wait(300);
  result.trackBefore=await run('LiveCanvas.paint(auditNodes,auditS);return positions();');await wait(300);
  result.trackAfter=await run('auditS.now=54000;LiveCanvas.paint(auditNodes,auditS);return positions();');
  result.liveChartSize=await run(`return auditNodes.map(n=>{const p=n.val.querySelector('.race-chart'),s=p?.querySelector('svg');return {box:{width:p?.clientWidth,height:p?.clientHeight},svg:s?{width:s.getBoundingClientRect().width,height:s.getBoundingClientRect().height}:null,note:p?.innerText};});`);
  fs.writeFileSync(path.join(out,'embedded-live-track.png'),(await win.webContents.capturePage()).toPNG());
  result.smallChartSize=await run(`LiveCanvas.dispose(auditNodes);auditLayout.widgets[1].opt.composition=WidgetCompose.clean({root:{id:'root',kind:'free',children:[{id:'track',kind:'component',component:'racechart',options:{chartDesign:auditChart.id},frame:{x:0,y:0,w:40,h:40}}]}});auditNodes=LiveCanvas.build(document.getElementById('auditCanvas'),auditLayout,8);LiveCanvas.paint(auditNodes,auditS);const b=auditNodes[1].val.querySelector('.wc-standard'),s=b.querySelector('svg');return {box:{width:b.clientWidth,height:b.clientHeight},svg:{width:s.getBoundingClientRect().width,height:s.getBoundingClientRect().height},scroll:{width:b.scrollWidth,height:b.scrollHeight}};`);
  fs.writeFileSync(path.join(out,'small-embedded-chart.png'),(await win.webContents.capturePage()).toPNG());
  result.arduinoRaceLock=await run(`LiveCanvas.dispose(auditNodes);document.body.innerHTML='<div id="auditHardware"></div>';window.auditWrites=[];live={alive:true,phase:'paused',box:{},eng:{flag:'red'}};state.race={};ab.open=true;ab.writer={write:async bytes=>auditWrites.push(Array.from(bytes))};ArduinoBox.link.setConnected(true);renderArduinoSettings(document.getElementById('auditHardware'));const before={raceKept:raceKept(),raceActive:raceActive(),flag:live.eng.flag,phase:live.phase,powerDisabled:document.getElementById('ab-pon').disabled,calibrateDisabled:document.getElementById('ab-calib').disabled};document.getElementById('ab-pon').click();document.getElementById('ab-calib').click();await new Promise(r=>setTimeout(r,10));return {before,writes:auditWrites.map(b=>String.fromCharCode(...b)),after:{flag:live.eng.flag,phase:live.phase}};`);
  result.runtimeErrors=await run('return auditErrors');
  fs.writeFileSync(path.join(out,'edge-cases.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));app.exit(0);
 }catch(e){console.error(e);app.exit(1);}
 });});require('../../main');
