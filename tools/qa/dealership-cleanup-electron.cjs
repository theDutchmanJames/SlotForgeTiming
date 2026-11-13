const fs=require('fs'),path=require('path'),os=require('os'),repo=path.resolve(__dirname,'../..'),req=require('module').createRequire(path.join(repo,'package.json'));
const {app,dialog}=req('electron'),out=path.resolve(__dirname,'../../../outputs/dealership-cleanup');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-dealership-review-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);new(req('./db'))(path.join(profile,'slotforge-timing.json')).saveNow();fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
const lib=req('./vendor/slotforge-library/index.cjs'),open=lib.open;lib.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
req('./tools/qa/qa-completion.cjs').preventRelaunch(app);req('./tools/qa/file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));dialog.showErrorBox=(t,m)=>{console.error(t,m);app.exit(1);};
const assert=require('assert/strict'),capture=true,images=out;
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => { console.error('Dealership Electron check timed out'); app.exit(1); }, 70000); timeout.unref();
app.on('browser-window-created', (_e, win) => {
  win.hide(); win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message', e => { if (e.level === 'error') console.error('RENDERER', e.message); });
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    const shot = async name => { if (!capture) return; win.webContents.invalidate(); await wait(100); win.webContents.invalidate(); await wait(100); fs.writeFileSync(path.join(images, name + '.png'), (await win.webContents.capturePage()).toPNG()); console.log('Captured ' + name); };

    try {
      for(let i=0;i<200;i++){if(await run('return !!state.schema.slotcars'))break;await wait(40);}win.setSize(1320,960);
      await run(`state.tab='database';state.sub='slotcars';render();`);await wait(300);assert.equal(await run("return document.querySelector('#paddock-open');"),null);assert.equal(await run("return document.querySelector('#paddock-view')?.textContent;"),'Dealership Cars');
      await run(`window.dq={calls:[],status:{connected:false,connection:null,linked:[],deliveries:[{sessionId:'pending-race',name:'Offline race',databaseId:'original',status:'pending'}],cooldowns:[]},transfers:[]};
       dq.api={paddockStatus:async()=>structuredClone(dq.status),paddockLocalCars:async()=>[],paddockTransfers:async()=>structuredClone(dq.transfers),paddockCatalogue:async()=>({cars:[],connection:dq.status.connection}),paddockLocalDiscover:async()=>[{key:'protected-key',name:'Older service',databaseId:'original'}],paddockConnect:async input=>{dq.calls.push(['connect',input]);dq.status.connection=input.mode==='local'?{mode:'local',databaseId:input.databaseId,name:'Older service',address:'http://127.0.0.1:9000'}:{databaseId:'original',name:'Club',address:input.address};dq.status.connected=true;return structuredClone(dq.status);},paddockDisconnect:async forget=>{dq.calls.push(['disconnect',forget]);dq.status.connected=false;if(forget)dq.status.connection=null;},paddockLocalStart:async()=>dq.calls.push(['start']),paddockRetry:async()=>dq.calls.push(['retry']),paddockCheckReceipt:async id=>dq.calls.push(['receipt',id]),paddockTransferRefresh:async id=>dq.calls.push(['transfer',id])};
       await PaddockUI.open(dq.api);`);
      assert(await run(`const d=document.querySelector('.paddock-dialog');return !d.querySelector('#paddock-advanced').open&&d.querySelector('[data-address]').checkVisibility()&&d.querySelector('[data-deliveries]').textContent.includes('Offline race')&&dq.calls.length===0;`));
      for(const theme of await run('return Theme.THEMES.map(x=>x[0]);')){
       await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();document.querySelector('.paddock-dialog').scrollTop=0;`);await shot('dealership-'+theme);
      }
      await run(`document.querySelector('[data-jump="advanced"]').click();`);
      assert(await run(`return document.querySelector('#paddock-advanced').open&&document.querySelector('[data-local-find]').checkVisibility();`));
      await wait(500);await shot('advanced-custom');
      await run(`document.querySelector('[data-close]').click();await new Promise(r=>setTimeout(r,50));dq.status.connection={mode:'local',databaseId:'original',name:'Older service',address:'http://127.0.0.1:9000'};dq.transfers=[{id:'review-1',name:'Preserved transfer',databaseId:'original',state:'pending',action:'create'}];await PaddockUI.open(dq.api);`);
      assert(await run(`return document.querySelector('#paddock-advanced').open&&document.querySelector('[data-connect]').disabled&&!document.querySelector('[data-local-disconnect]').disabled&&document.querySelector('[data-transfer-check]').dataset.transferCheck==='review-1'&&document.querySelector('[data-deliveries]').textContent.includes('Offline race')&&dq.calls.length===0;`));
      await run(`document.querySelector('[data-transfer-check]').click();`);await wait(100);
      assert.deepEqual(await run('return dq.calls;'),[['transfer','review-1']]);
      await run(`document.querySelector('[data-close]').click();await new Promise(r=>setTimeout(r,50));dq.status.connection=null;await PaddockUI.open(dq.api);`);
      assert(await run(`return !document.querySelector('#paddock-transfers').hidden&&document.querySelector('[data-transfer-list]').textContent.includes('Reconnect the original')&&!document.querySelector('[data-transfer-check]');`));
      await run(`document.querySelector('[data-jump="advanced"]').click();document.querySelector('[data-local-find]').click();`);await wait(100);
      await run(`document.querySelector('[data-local-connect]').click();`);await wait(100);
      assert.equal(await run('return dq.status.connection.mode;'),'local');
      assert.equal(await run('return dq.calls.at(-1)[1].databaseId;'),'original');
      await run(`document.querySelector('[data-local-disconnect]').click();`);await wait(100);
      assert.deepEqual(await run('return dq.calls.at(-1);'),['disconnect',false]);
      await run(`document.querySelector('[data-close]').click();await new Promise(r=>setTimeout(r,50));dq.status.connection=null;dq.status.cooldowns=[{host:'127.0.0.1',until:Date.now()+60000,code:'HOST_MIGRATING'}];await PaddockUI.open(dq.api);document.querySelector('[data-address]').value='127.0.0.1:9000';document.querySelector('[data-address]').dispatchEvent(new Event('input'));`);
      assert(await run(`return document.querySelector('[data-connect]').disabled&&document.querySelector('[data-cooldown]').textContent.includes('changing sharing mode');`));
      win.setMinimumSize(500,600);win.setSize(600,960);await run(`state.settings.theme='light';applyTheme();document.querySelector('.paddock-dialog').scrollTop=0;`);await shot('narrow-light');
      assert(await run(`const d=document.querySelector('.paddock-dialog');return d.scrollWidth<=d.clientWidth+2;`));
      await run(`document.querySelector('[data-jump="advanced"]').click();`);await wait(600);await shot('narrow-advanced');
      await run(`document.querySelector('[data-close]').click();`);
      fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:true,themes:9,defaultDealership:true,existingService:true,pendingTransfers:true,serviceConnect:true,serviceDisconnect:true,migrationCooldown:true,narrowWidth:600}));
      req('./tools/qa/qa-completion.cjs').complete();clearTimeout(timeout);app.quit();
    }catch(e){console.error(e.stack||e);app.exit(1);}
  });
});
req('./main');
