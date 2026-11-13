const fs=require('fs'),path=require('path'),os=require('os'),repo=path.resolve(__dirname,'../..'),req=require('module').createRequire(path.join(repo,'package.json'));
const {app,dialog}=req('electron'),out=path.resolve(__dirname,'../../../outputs/connections-navigation');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-dealership-review-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);new(req('./db'))(path.join(profile,'slotforge-timing.json')).saveNow();fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const lib=req('./vendor/slotforge-library/index.cjs'),open=lib.open;lib.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
req('./tools/qa/qa-completion.cjs').preventRelaunch(app);req('./tools/qa/file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const assert=require('assert/strict'),capture=true,images=out;
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Dealership Electron check timed out'); app.exit(1); }, 120000); timeout.unref();
app.on('browser-window-created', (_e, win) => {
  win.hide(); win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message', e => { if (e.level === 'error') console.error('RENDERER', e.message); });
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    const shot = async name => { if (!capture) return; win.webContents.invalidate(); await wait(100); win.webContents.invalidate(); await wait(100); fs.writeFileSync(path.join(images, name + '.png'), (await win.webContents.capturePage()).toPNG()); console.log('Captured ' + name); };


    try {
      for(let i=0;i<200;i++){if(await run('return !!state.schema.slotcars'))break;await wait(40);}win.setSize(1320,960);await run("window.dqErrors=[];addEventListener('error',e=>dqErrors.push(e.message));addEventListener('unhandledrejection',e=>dqErrors.push(String(e.reason)));");
      await run("state.tab='database';state.sub='slotcars';await render();");await wait(600);
      assert.equal(await run("return !!document.querySelector('#paddock-open');"),false);
      assert.equal(await run("return document.querySelector('#paddock-view')?.textContent;"),'Dealership Cars');
      await run("state.tab='settings';state.settingsSub='network';await render();");
      assert(await run("return document.querySelector('#settingstabs').textContent.includes('Connections')&&document.querySelector('.connections-tabs').textContent.includes('Race Sharing')&&!!document.querySelector('#net-on');"));
      const network=await run('return [state.settings.netOn,state.settings.netPort,state.settings.netPassword];');
      await run(String.raw`
        window.dq={calls:[],delay:0,status:{connected:false,connection:null,linked:[],deliveries:[{sessionId:'pending-race',name:'Offline race',databaseId:'original',status:'pending'}],cooldowns:[]},cars:[{id:'one',name:'Cached club car',maker:'NSR',linked:'local-one',capturedAt:1700000000000}],transfers:[]};
        dq.api={paddockStatus:async()=>{if(dq.delay)await new Promise(r=>setTimeout(r,dq.delay));return structuredClone(dq.status);},paddockLocalCars:async()=>[],paddockTransfers:async()=>structuredClone(dq.transfers),paddockCatalogue:async()=>({cars:structuredClone(dq.cars),connection:dq.status.connection,connected:dq.status.connected}),paddockDiscover:async()=>[{name:'Club Dealership',address:'127.0.0.1:51234'}],paddockConnect:async input=>{dq.calls.push(['connect',input]);if(input.code==='bad!')throw Error('Incorrect Dealership password');dq.status.connection={databaseId:'original',name:'Club Dealership',address:input.address};dq.status.connected=true;return structuredClone(dq.status);},paddockDisconnect:async forget=>{dq.calls.push(['disconnect',forget]);dq.status.connected=false;if(forget)dq.status.connection=null;},paddockRetry:async()=>dq.calls.push(['retry']),getRecord:async()=>({id:'local-one',model:'Cached club car'}),paddockLink:async()=>({id:'local-one'}),paddockRefresh:async()=>dq.calls.push(['refresh']),paddockCheckReceipt:async id=>dq.calls.push(['receipt',id])};
        dq.mount=PaddockUI.mount;PaddockUI.mount=(_api,box,opts)=>dq.mount(dq.api,box,opts);
        dq.browser=PaddockBrowser.mount;PaddockBrowser.mount=(box,_api,opts)=>dq.browser(box,dq.api,{...opts,view:car=>{dq.selected=car.id;}});
        document.querySelector('.connections-tabs [data-id="dealership"]').click();
      `);await wait(150);
      assert(await run("return !!document.querySelector('[data-address]')&&!document.querySelector('#paddock-advanced').open&&document.querySelector('[data-deliveries]').textContent.includes('Offline race');"));
      for(const theme of await run('return Theme.THEMES.map(x=>x[0]);')){
        await run('state.settings.theme='+JSON.stringify(theme)+';applyTheme();window.scrollTo(0,0);');await shot('settings-'+theme);
      }
      await run("document.querySelector('[data-find]').click();");await wait(100);
      await run("const h=document.querySelector('[data-hosts]');h.value='127.0.0.1:51234';h.dispatchEvent(new Event('change'));document.querySelector('[data-code]').value='bad!';document.querySelector('[data-connect]').click();");await wait(150);
      assert(await run("return document.querySelector('[data-error]').textContent.includes('Incorrect')&&!dq.status.connected;"));
      await run("document.querySelector('[data-code]').value='pass';document.querySelector('[data-connect]').click();");await wait(150);
      assert(await run("return dq.status.connected&&document.querySelector('[data-code]').value===''&&dq.status.deliveries[0].status==='pending';"));
      await run("document.querySelector('.connections-tabs [data-id=\"race\"]').click();");await wait(100);
      assert.deepEqual(await run('return [state.settings.netOn,state.settings.netPort,state.settings.netPassword];'),network);
      await shot('race-sharing');
      await run("state.tab='database';state.sub='slotcars';await render();document.querySelector('#paddock-view').click();");await wait(250);
      assert(await run("return document.querySelector('[data-source=paddock]').textContent==='Dealership Cars'&&!document.querySelector('[data-connection-panel]').open&&document.querySelector('.pb-cars').textContent.includes('Cached club car');"));
      await shot('cars-connected');
      await run("document.querySelector('[data-connection-panel] > summary').click();");await wait(150);
      assert(await run("return document.querySelector('[data-address]').value==='127.0.0.1:51234'&&document.querySelector('[data-connect]').checkVisibility();"));
      await run("document.querySelector('[data-disconnect]').click();");await wait(150);
      assert(await run("return document.querySelector('[data-connection-panel]').open&&document.querySelector('.pb-cars').textContent.includes('Cached club car')&&!document.querySelector('[data-use]').disabled&&dq.status.deliveries[0].status==='pending';"));
      await run("document.querySelector('[data-use]').click();");await wait(150);
      assert.equal(await run('return dq.selected;'),'local-one');
      for(const theme of await run('return Theme.THEMES.map(x=>x[0]);')){
        await run('state.settings.theme='+JSON.stringify(theme)+';applyTheme();window.scrollTo(0,0);');await shot('cars-offline-'+theme);
      }
      await run("document.querySelector('.paddock-browser > [data-search]').value='missing';document.querySelector('.paddock-browser > [data-search]').dispatchEvent(new Event('input'));");
      assert(await run("return document.querySelector('.pb-cars').textContent.includes('No matching');"));
      await run("document.querySelector('.paddock-browser > [data-search]').value='';document.querySelector('.paddock-browser > [data-search]').dispatchEvent(new Event('input'));document.querySelector('[data-code]').value='pass';document.querySelector('[data-connect]').click();");await wait(150);
      assert(await run("return dq.status.connected&&!document.querySelector('[data-connection-panel]').open;"));
      // A host going offline refreshes the form without discarding a typed password.
      await run("document.querySelector('[data-code]').value='draft';dq.status.connected=false;document.querySelector('.pb-toolbar [data-refresh]').click();");await wait(150);
      assert(await run("return document.querySelector('[data-connection-panel]').open&&document.querySelector('[data-status]').textContent.includes('reconnect')&&document.querySelector('[data-code]').value==='draft';"));
      await run("document.querySelector('[data-code]').value='pass';document.querySelector('[data-connect]').click();");await wait(150);
      // Narrow layout and settings tabs use the same connection, without reconnecting.
      win.setMinimumSize(500,600);win.setSize(600,960);
      await run("document.querySelector('[data-connection-panel] > summary').click();state.settings.theme='light';applyTheme();window.scrollTo(0,0);");await wait(100);await shot('cars-600-light');
      assert(await run('return document.documentElement.scrollWidth<=window.innerWidth+2;'));
      const calls=await run('return dq.calls.length;');
      await run("state.tab='settings';state.settingsSub='network';connectionsTab='dealership';await render();");await wait(100);await shot('settings-600-light');
      assert(await run("return document.querySelector('[data-address]').value==='127.0.0.1:51234'&&document.documentElement.scrollWidth<=window.innerWidth+2;"));
      assert.equal(await run('return dq.calls.length;'),calls);
      await run("document.querySelector('[data-jump=results]').click();document.querySelector('[data-retry]').click();");await wait(100);
      assert.deepEqual(await run('return dq.calls.at(-1);'),['retry']);
      // Leaving while status loads must not resurrect a discarded page or mutate storage.
      await run("dq.delay=120;renderConnectionsSettings(document.querySelector('#settingsbox'));connectionsTab='race';await renderConnectionsSettings(document.querySelector('#settingsbox'));");await wait(250);
      assert(await run("return !!document.querySelector('#net-on')&&!document.querySelector('[data-address]');"));
      assert.equal(await run('return dq.status.deliveries[0].status;'),'pending');
      assert.deepEqual(await run('return dqErrors;'),[]);
      fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes:9,narrow:600,settingsNavigation:true,inlineConnect:true,discovery:true,wrongPassword:true,disconnectKeepsCache:true,offlineSelection:true,pendingResultsPreserved:true,detachedPage:true}));
      req('./tools/qa/qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
    }catch(e){console.error(e.stack||e);app.exit(1);}
  });
});
req('./main');
