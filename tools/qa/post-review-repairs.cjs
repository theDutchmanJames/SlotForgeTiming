// Real renderer regression coverage; isolated profile, no connected hardware.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/post-review-repairs');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/post-review-repairs-'+process.pid));app.disableHardwareAcceleration();
let done=false,checks=0;const check=(ok,label)=>{checks++;assert(ok,label);},wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=async s=>{const r=await win.webContents.executeJavaScript('(async()=>{try{'+s+'}catch(e){return {qaFailure:e.stack||String(e)}}})()');if(r?.qaFailure)throw new Error(r.qaFailure);return r;};
 try{
  await wait(400);win.setMinimumSize(0,0);win.setContentSize(1250,950);
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));state.tab='custom';state.customSub='widgets';await render();document.getElementById('new-composer').click();`);await wait(100);
  await run(`window.qaChart=await api.add('chartdesigns',{...ChartWidgets.clean({name:'Live Track regression',style:'track',drivers:'one',lane:0,legend:true}),id:undefined});
   window.qaComposition=WidgetCompose.clean({root:{id:'root',kind:'free',children:[{id:'track',kind:'component',component:'racechart',options:{chartDesign:qaChart.id},frame:{x:0,y:0,w:100,h:100}}]}});
   wbEd.charts=[qaChart];wbEd.draft.composition=qaComposition;wbEd.draft.w=600;wbEd.draft.h=350;wbEd.composerUI.selected='track';WidgetStudio.edit(document.getElementById('setupbox'));`);
  const size=()=>run(`const p=document.querySelector('#wc-preview .wc-standard'),s=p.querySelector('svg');return {width:p.clientWidth,height:p.clientHeight,svgWidth:s?.getBoundingClientRect().width,svgHeight:s?.getBoundingClientRect().height,note:p.innerText};`);
  const builder=await size();check(builder.svgWidth>500&&builder.svgHeight>200,'Builder chart fills actual component box');check(builder.svgHeight<builder.height,'legend has its own room');
  fs.writeFileSync(path.join(out,'builder-chart.png'),(await win.webContents.capturePage()).toPNG());
  // Refit an existing component during drag, without rebuilding the whole preview.
  await run(`wbEd.draft.composition.root.children[0].frame={x:0,y:0,w:35,h:35};document.querySelector('#wc-preview .wc-block[data-wc-id="track"]')?.style.setProperty('width','35%');const el=document.querySelector('#wc-preview [data-wc-component="track"]').parentElement;el.style.setProperty('--wc-w','35%');el.style.setProperty('--wc-h','35%');WidgetCompose.fit(document.getElementById('wc-preview'),wbToWidget(wbEd.draft,0));`);
  check((await size()).note.includes('Enlarge chart'),'Builder drag refit replaces undersized chart with guidance');
  await run(`wbEd.composerUI.play=false;clearTimeout(wbEd.composerUI.timer);wbEd.composerUI.freeDispose?.();
   document.body.innerHTML='<h2 style="padding:0 20px">Standalone Live Track / the same chart in a custom widget</h2><div id="qaCanvas" class="canvas"></div>';
   window.qaS={...WidgetPreview.state({}, {scenario:'race'}),preview:false,now:51000,chartDesigns:[qaChart]};
   window.qaLayout={ratioW:1000,ratioH:600,laneColors:[],widgets:[{...Widgets.newWidget('racechart',0,0,0),w:480,h:320,showTitle:false,opt:{chartDesign:qaChart.id}},{...Widgets.newWidget('textrace',0,500,0),w:480,h:320,showTitle:false,opt:{composition:qaComposition}}]};
   qaLayout.widgets[1].opt.composition.root.children[0].frame={x:0,y:0,w:100,h:100};qaS.layout=qaLayout;
   window.qaNodes=LiveCanvas.build(document.getElementById('qaCanvas'),qaLayout,8);LiveCanvas.paint(qaNodes,qaS);
   window.qaPositions=()=>qaNodes.map(n=>n.val.querySelector('[data-track-marker]')?.getAttribute('transform'));`);
  const before=await run('return qaPositions();');await wait(300);
  const after=await run('qaS.now=54000;LiveCanvas.paint(qaNodes,qaS);return qaPositions();');
  check(before[0]!==after[0]&&before[1]!==after[1],'standalone and embedded markers both move');
  check(await run(`return qaNodes.every(n=>n.val.querySelector('[data-track-status]').textContent==='40%');`),'same live progress in both legends');
  const liveSize=await run(`return qaNodes.map(n=>{const p=n.val.querySelector('.race-chart'),s=p.querySelector('svg');return {width:p.clientWidth,height:p.clientHeight,svgWidth:s.getBoundingClientRect().width,svgHeight:s.getBoundingClientRect().height};});`);
  check(liveSize.every(s=>Math.abs(s.width-s.svgWidth)<2&&s.svgHeight<s.height),'live dimensions follow allocation');
  fs.writeFileSync(path.join(out,'live-charts.png'),(await win.webContents.capturePage()).toPNG());
  // An unchanged frame keeps the same SVG and its chart throttle record.
  check(await run(`const svg=qaNodes[1].val.querySelector('svg');LiveCanvas.paint(qaNodes,qaS);return svg===qaNodes[1].val.querySelector('svg');`),'stable frames retain DOM');
  await run(`qaS.eng.status='paused';LiveCanvas.paint(qaNodes,qaS);`);
  const paused=await run('return qaPositions();');await wait(150);
  check(JSON.stringify(paused)===JSON.stringify(await run('LiveCanvas.paint(qaNodes,qaS);return qaPositions();')),'paused frame holds positions');
  check(await run(`return qaNodes.every(n=>n.val.querySelector('[data-track-status]').textContent==='Paused');`),'paused legends agree');
  await run(`qaS.eng.status='running';qaS.eng.cars[0].pitHold=true;LiveCanvas.paint(qaNodes,qaS);`);
  check(await run(`return qaNodes.every(n=>n.val.querySelector('[data-track-status]').textContent==='In pits');`),'pit state reaches embedded chart');
  await run(`qaS.eng.cars[0].pitHold=false;qaS.eng.cars[0].done=true;LiveCanvas.paint(qaNodes,qaS);`);
  check(await run(`return qaNodes.every(n=>n.val.querySelector('[data-track-status]').textContent==='Finished');`),'finish reaches embedded chart');
  await run(`qaS.eng.cars[0].done=false;qaNodes[1].el.style.width='18%';qaNodes[1].el.style.height='20%';qaNodes.resize();`);await wait(100);
  check(await run(`return qaNodes[1].val.textContent.includes('Enlarge chart')&&!qaNodes[1].val.querySelector('svg');`),'resize observer refits embedded chart without a new lap');
  fs.writeFileSync(path.join(out,'small-chart.png'),(await win.webContents.capturePage()).toPNG());
  // Repeated row compositions must retain independent descriptors and fit to
  // row cells, not the surrounding leaderboard or another driver's chart.
  await run(`LiveCanvas.dispose(qaNodes);qaComposition.root.children[0].frame={x:0,y:0,w:100,h:100};window.qaRow={...Rows.defaultDesign(),id:'qa-row',ratioH:400,header:false,widgets:[{...Widgets.newWidget('textlane',0,0,0),w:1000,h:400,opt:{composition:qaComposition}}]};qaS.rowDesigns=[qaRow];window.qaBoard=Timing.content({type:'leaderboard',opt:{design:'qa-row',to:2}},qaS);document.body.innerHTML='<div id="qaRows" style="width:900px;height:780px;position:relative;overflow:auto"></div>';document.getElementById('qaRows').innerHTML=qaBoard.html;Rows.fitText(document.getElementById('qaRows'));WidgetView.updateComponents({val:document.getElementById('qaRows')},qaBoard);`);
  check(await run(`const cells=[...document.querySelectorAll('#qaRows [data-wc-component]')];return cells.length===2&&new Set(qaBoard.components.map(c=>c.id)).size===2&&cells.every(c=>!!c.querySelector('svg'));`),'leaderboard row charts hydrate with distinct identities');
  fs.writeFileSync(path.join(out,'row-charts.png'),(await win.webContents.capturePage()).toPNG());
  await run(`LiveCanvas.dispose(qaNodes);document.body.innerHTML='<div id="hwbox"></div>';window.qaWrites=[];ab.open=true;ab.writer={write:async bytes=>qaWrites.push(String.fromCharCode(...bytes))};ArduinoBox.link.setConnected(true);state.race={};window.qaStopCount=0;live={alive:true,phase:'paused',box:{},actions:{hardwareStop:()=>qaStopCount++}};`);
  for(const phase of ['ready','countdown','running','paused','between','review','finished']){
   const r=await run(`live.phase=${JSON.stringify(phase)};renderArduinoSettings(document.getElementById('hwbox'));qaWrites.length=0;const power=document.getElementById('ab-pon'),calibrate=document.getElementById('ab-calib');power.onclick();calibrate.onclick();document.getElementById('ab-save').onclick();const pin=document.querySelector('[data-pinrole]');const old=JSON.stringify(ArduinoBox.link.pins);pin.value='L';await document.getElementById('hwbox').onchange({target:pin});return {disabled:power.disabled&&calibrate.disabled&&pin.disabled,writes:qaWrites,pinsUnchanged:old===JSON.stringify(ArduinoBox.link.pins)};`);
   check(r.disabled&&!r.writes.length&&r.pinsUnchanged,'race ownership protects '+phase+' even direct handlers');
  }
  await run(`live.phase='paused';document.getElementById('ab-poff').click();`);
  check(await run(`return qaWrites.includes('M0\\n')&&qaStopCount===1&&live.phase==='paused';`),'emergency power off works without red-flag toggle');
  check(await run(`return !document.getElementById('ab-copy').disabled&&!document.getElementById('ab-clear').disabled;`),'read-only diagnostics remain usable');
  fs.writeFileSync(path.join(out,'arduino-race-lock.png'),(await win.webContents.capturePage()).toPNG());
  await run(`live=null;state.race=null;renderArduinoSettings(document.getElementById('hwbox'));qaWrites.length=0;document.getElementById('ab-calib').click();`);
  check(await run(`return !document.getElementById('ab-calib').disabled&&qaWrites.includes('X\\n');`),'configuration restores after leaving race');
  check((await run('return qaErrors')).length===0,'no renderer errors');
  fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,builder,liveSize,before,after,failures:[]},null,2));
  console.log('POST-REVIEW ELECTRON PASS:',checks,'checks');app.exit(0);
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
 });});require('../../main');
