// Production renderer with isolated data: both appearances share imported geometry.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/track-appearance');fs.mkdirSync(out,{recursive:true});
const data=path.resolve(__dirname,'../../.tmp-test/track-appearance-'+process.pid);fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const fixture=fs.readFileSync(path.resolve(__dirname,'../../tests/fixtures/trackbuilder/04-mirrored-rotated.slotforge.json'),'utf8');
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
  if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  const shot=async name=>{await wait(150);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
  try{
    win.setMinimumSize(0,0);win.setContentSize(1440,1000);await wait(350);
    await run(`window.qaErrors=[];window.ck=(v,m)=>{if(!v)throw Error(m);};addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));
      const doc=TrackDesign.normalize(${fixture}),config=TrackDesign.configure(doc,doc.track.lanes.map(l=>l.id),true);
      window.track=await api.add('tracks',{...TrackDesign.patch(null,config),name:'Imported circuit',targetLap:10});
      state.tab='custom';state.customSub='charts';chartEd={id:null,draft:ChartWidgets.clean({name:'Shared Live Track',style:'track',trackDrawing:'oval'}),dirty:true};await render();
      ck(document.querySelector('#chart-preview [data-track-lane]'),'Coloured preview uses imported shape');
      const p=document.querySelector('[data-chart-field="trackDrawing"]');p.value='design';p.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('change',{bubbles:true}));
      ck(!document.querySelector('#chart-preview [data-track-lane]'),'Artwork replaces lane lines');ck(document.querySelector('#chart-preview').textContent.includes('Track Builder artwork'),'Artwork preview');
      const pace=document.querySelector('[data-chart-field="pace"]');pace.value='profile';pace.dispatchEvent(new Event('input',{bubbles:true}));await document.querySelector('#chart-save').onclick();window.chart=(await api.list('chartdesigns')).find(c=>c.name==='Shared Live Track');ck(chart.trackDrawing==='design'&&chart.pace==='profile','Appearance and tuning pace saved');`);
    await shot('chart-editor');
    await run(`chartEd.observer.disconnect();chartEd=null;
      window.w=Widgets.newWidget('racechart',0,10,10);w.w=970;w.h=520;w.opt={chartDesign:chart.id};
      state.customSub='layouts';state.sideOpen=new Set(['opts']);state.editing={id:null,draft:{name:'Appearance override',ratioW:10,ratioH:6,guides:{v:[],h:[]},widgets:[w]},sel:[w],snap:true,dirty:true};await render();
      ck(document.querySelector('#o-trackDrawing').value==='inherit','Widget defaults to inherited appearance');
      ck(document.querySelector('#canvas').textContent.includes('Track Builder artwork'),'Layout Editor shows imported artwork');
      const preview=document.querySelector('#chart-preview-track');ck(preview.value===track.id,'Imported track selected for preview');preview.value='';preview.dispatchEvent(new Event('change',{bubbles:true}));ck(document.querySelector('#canvas').textContent.includes('Oval fallback'),'Sample track fallback explained');preview.value=track.id;preview.dispatchEvent(new Event('change',{bubbles:true}));ck(document.querySelector('#canvas').textContent.includes('Track Builder artwork'),'Preview selector refreshes imported artwork');
      const p=document.querySelector('#o-trackDrawing');p.value='oval';p.dispatchEvent(new Event('input',{bubbles:true}));p.dispatchEvent(new Event('change',{bubbles:true}));
      ck(state.editing.sel[0].opt.trackDrawing==='oval','Widget override updated');await editorSave();window.savedLayout=(await api.list('layouts')).find(l=>l.name==='Appearance override');ck(savedLayout.widgets[0].opt.trackDrawing==='oval','Widget override persisted');ck(!('previewTrackId' in savedLayout)&&!('chartPreviewTrack' in savedLayout.widgets[0]),'Preview does not alter saved race-track selection');
      const other=await api.add('chartdesigns',{...ChartWidgets.clean(),name:'Trend'});state.editing.chartDesigns.push(other);
      const c=document.querySelector('#o-chartDesign');const opt=document.createElement('option');opt.value=other.id;c.append(opt);c.value=other.id;c.dispatchEvent(new Event('change',{bubbles:true}));
      ck(!document.querySelector('#o-trackDrawing'),'Track-only control hidden for trend');
      const back=document.querySelector('#o-chartDesign');back.value=chart.id;back.dispatchEvent(new Event('change',{bubbles:true}));
      ck(document.querySelector('#o-trackDrawing').value==='oval','Switching chart restores override');`);
    await shot('widget-options');
    await run(`state.editing=null;
      window.eng=RaceEngine.createRace({type:'practice',minLap:100,entries:[{lane:0,driverId:'a',driverName:'James'},{lane:1,driverId:'b',driverName:'Bjornie'}]});eng.start(0);eng.cross(0,10000);eng.cross(1,11000);
      window.layout={name:'Same imported circuit · two appearances',ratioW:10,ratioH:6,widgets:[
        {...Widgets.newWidget('racechart',0,10,10),w:485,h:570,title:'Original · Coloured Lanes',opt:{chartDesign:chart.id,trackDrawing:'oval'}},
        {...Widgets.newWidget('racechart',0,505,10),w:485,h:570,title:'Track Builder Artwork',opt:{chartDesign:chart.id,trackDrawing:'design'}}]};
      window.ctx={raceId:'appearance',eng,now:11010,phase:'running',setup:{sessionType:'practice'},layout,track,chartDesigns:[chart],base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
      window.actualLive=LiveCanvas.fullView(layout,2);LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));
      window.positions=()=>actualLive.nodes.map(n=>Array.from(n.val.querySelectorAll('[data-track-marker]')).map(m=>m.getAttribute('transform')));
      window.first=positions();ck(JSON.stringify(first[0])===JSON.stringify(first[1]),'Both appearances use identical marker positions');
      ck(actualLive.nodes[0].val.querySelector('[data-track-lane]'),'Coloured lanes live');ck(!actualLive.nodes[1].val.querySelector('[data-track-lane]'),'Artwork live');`);
    await wait(150);
    await run(`ctx.now=11110;LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));const next=positions();ck(JSON.stringify(next)!==JSON.stringify(first),'Cars move');ck(JSON.stringify(next[0])===JSON.stringify(next[1]),'Motion remains identical');eng.pause(11110);`);
    const themes=['dark','light','midnight','forest','sunset','violet','carbon','ocean'];
    for(const theme of themes){await run(`state.settings.theme='${theme}';applyTheme();LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));`);await shot('live-'+theme);}
    win.setContentSize(800,800);await wait(150);await run(`LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));ck(actualLive.nodes.every(n=>n.val.querySelectorAll('[data-track-marker]').length===2),'Both render at narrow width');`);await shot('live-800');
    await run('actualLive.close();');assert.deepEqual(await run('return qaErrors'),[]);
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,themes,checks:['Chart Editor appearance and tuning-profile pace saved','Imported artwork selectable in Layout Editor','Preview-only track choice never persisted','Imported shape in both views','Widget override and conditional controls','Save and reload','Identical positions and movement','Shared design isolated per widget','Eight themes and narrow width','No renderer errors']},null,2));
    console.log('TRACK APPEARANCE ELECTRON PASS');app.quit();
  }catch(e){console.error(e);await shot('failure');app.exit(1);}
});});require('../../main');
