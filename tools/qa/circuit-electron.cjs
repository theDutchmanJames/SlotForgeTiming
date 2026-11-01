// Production application and widget renderer; isolated database, no user records.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/circuit-integration');fs.mkdirSync(out,{recursive:true});
const data=path.resolve(__dirname,'../../.tmp-test/circuit-'+process.pid);fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const names=['closed-routed-oval','closed-flowing-track','closed-tabletop-track','closed-freeform-circuit','l-table-with-squeeze'];
const fixtures=Object.fromEntries(names.map(n=>[n,JSON.parse(fs.readFileSync(path.resolve(__dirname,'../../tests/fixtures/circuit',n+'.slotforge.json')))]));
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;setTimeout(()=>app.exit(2),180000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
  if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  const shot=async name=>{await wait(120);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
  try{
    win.setMinimumSize(0,0);win.setContentSize(1440,1000);await wait(350);
    await run(`window.qaErrors=[];window.ck=(v,m)=>{if(!v)throw Error(m);};addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));window.fixtures=${JSON.stringify(fixtures)};state.tab='database';state.sub='tracks';await render();`);
    // A FreeForm drawing with no timing line must require an explicit selection.
    await run(`window.ed=await TrackDesignUI.open(api,null);await ed.loadRaw(fixtures['l-table-with-squeeze']);ck(!ed.dialog.querySelector('[data-confirm]').checked,'Confirmation starts off');
      const line=ed.dialog.querySelector('[data-line]');line.value=fixtures['l-table-with-squeeze'].pieces[0].id;line.dispatchEvent(new Event('change'));
      const fraction=ed.dialog.querySelector('[data-fraction]');fraction.value='27';fraction.dispatchEvent(new Event('change'));`);
    await wait(350);
    await run(`ck(ed.dialog.querySelector('[data-position-label]').textContent.includes('around the circuit'),'FreeForm position label');ck(ed.dialog.querySelector('[data-sensor-help]').textContent.includes('reference lane'),'Reference distance explained');ck(ed.dialog.querySelector('[data-preview] svg'),'Preview with lane arrows');`);
    await shot('freeform-import');
    win.setContentSize(600,800);await wait(100);
    await run(`ck(ed.dialog.scrollWidth<=ed.dialog.clientWidth+2,'Import fits at 600px');ed.dialog.querySelector('[data-section="mapping"]').click();`);await shot('import-600');
    await run(`ed.dialog.querySelector('[data-confirm]').checked=true;ed.dialog.querySelector('[data-confirm]').dispatchEvent(new Event('change'));await ed.dialog.querySelector('[data-save]').onclick();ck(!ed.dialog.open,'Database save completed');window.saved=(await api.list('tracks')).find(t=>t.trackDesign?.document.design.id===fixtures['l-table-with-squeeze'].design.id);ck(saved?.trackDesign.confirmedMappingRevision,'Confirmation persisted');ed=await TrackDesignUI.open(api,saved);ck(ed.dialog.querySelector('[data-confirm]').checked,'Reopened mapping confirmed');ck(ed.dialog.querySelector('[data-fraction]').value==='27','Sensor position persisted');ed.dialog.close();`);
    win.setContentSize(1440,1000);
    for(const name of names){
      await run(`window.doc=TrackDesign.normalize(fixtures[${JSON.stringify(name)}]);doc=SlotForgeIntegration.prepare(doc,{...SlotForgeIntegration.readState(doc),startFinish:doc.timing.startFinish||{pieceId:doc.pieces[0].id,fraction:.27}},false);
        window.config=TrackDesign.configure(doc,doc.track.lanes.map(l=>l.id),true);window.track={name:doc.title,lanes:config.laneRoutes.length,trackDesign:config,targetLap:10};
        window.chart={...ChartWidgets.clean({name:'Live Tracker',style:'track',pace:'profile'}),id:'circuit'};
        window.eng=RaceEngine.createRace({type:'practice',minLap:100,entries:config.laneRoutes.map((_,lane)=>({lane,driverId:'driver-'+lane,driverName:['James','Bjornie','Alex','Robin','Sam','Chris'][lane]}))});eng.start(0);eng.cars.forEach((_,i)=>eng.cross(i,1000));
        window.layout={name:doc.title,ratioW:10,ratioH:6,widgets:[{...Widgets.newWidget('racechart',0,10,10),w:485,h:570,title:'Original · Coloured Lanes',opt:{chartDesign:'circuit',trackDrawing:'oval'}},{...Widgets.newWidget('racechart',0,505,10),w:485,h:570,title:'Circuit Artwork',opt:{chartDesign:'circuit',trackDrawing:'design'}}]};
        window.ctx={raceId:'circuit-test',eng,now:2300,phase:'running',setup:{sessionType:'practice'},layout,track,chartDesigns:[chart],base:{personal:new Map(),track:Infinity},flash:new Map(),bestBy:new Map(),bestAll:Infinity};
        window.actualLive=LiveCanvas.fullView(layout,track.lanes);LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));
        window.positions=()=>actualLive.nodes.map(n=>[...n.val.querySelectorAll('[data-track-marker]')].map(m=>m.getAttribute('transform')));window.samePositions=()=>{const pp=positions(),frames=actualLive.nodes.map(n=>n.val.querySelector('svg > g[transform]').transform.baseVal.consolidate().matrix);return pp[0].every((p,i)=>{const a=p.match(/translate\\(([^ ]+) ([^)]+)\\)/).slice(1).map(Number),b=pp[1][i].match(/translate\\(([^ ]+) ([^)]+)\\)/).slice(1).map(Number);return Math.hypot((a[0]-frames[0].e)/frames[0].a-(b[0]-frames[1].e)/frames[1].a,(a[1]-frames[0].f)/frames[0].d-(b[1]-frames[1].f)/frames[1].d)<.03/Math.min(frames[0].a,frames[1].a);});};window.first=positions();ck(first[0].length===track.lanes,'All lanes rendered');ck(samePositions(),'Both styles use identical positions');ck(actualLive.nodes[0].val.querySelector('[data-track-lane]'),'Original lane paths');ck(!actualLive.nodes[1].val.querySelector('[data-track-lane]'),'Circuit artwork');`);
      await shot(name);await wait(120);
      await run(`ctx.now=2500;LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));ck(JSON.stringify(first)!==JSON.stringify(positions()),'Cars advance on lane paths');ck(samePositions(),'Styles stay in sync');eng.pause(2500);ctx.now=2600;LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));window.paused=positions();`);await wait(120);
      await run(`ctx.now=3500;LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));ck(JSON.stringify(paused)===JSON.stringify(positions()),'Pause freezes cars');ck(eng.cars.every(c=>c.laps.length===1),'Animation cannot add laps');`);
      if(name==='l-table-with-squeeze'){
        for(const theme of ['dark','light','midnight','forest','sunset','violet','carbon','ocean']){await run(`state.settings.theme='${theme}';applyTheme();LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));`);await shot('live-'+theme);}
        win.setContentSize(600,800);await wait(120);await run(`LiveCanvas.paint(actualLive.nodes,LiveShare.makeShared(ctx));ck(actualLive.nodes.every(n=>n.val.querySelectorAll('[data-track-marker]').length===4),'Both styles retain four cars at 600px');`);await shot('live-600');
      }
      await run('actualLive.close();');
    }
    assert.deepEqual(await run('return qaErrors'),[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed:true,examples:names,checks:['FreeForm sensor guidance and preview','600px scrollable import','Database save and reopen','Real LiveCanvas renderer in both appearances','All cars present, moving and synchronized','Pause stops movement, no invented laps','Eight themes','600px widgets','No renderer errors']},null,2));console.log('CIRCUIT ELECTRON PASS');app.quit();
  }catch(e){fs.writeFileSync(path.join(out,'failure.txt'),String(e.stack||e));console.error(e);await shot('failure');app.exit(1);}
});});require('../../main');
