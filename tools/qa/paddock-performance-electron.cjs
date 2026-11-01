// Isolated real Timing renderer + synthetic photo-heavy HTTP catalogue.
const {app,nativeImage}=require('electron'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const out=path.resolve(__dirname,'../../../outputs/paddock-performance');fs.mkdirSync(out,{recursive:true});
const profile=path.resolve(__dirname,'../../.tmp-test/paddock-performance-'+process.pid);fs.mkdirSync(profile,{recursive:true});app.setPath('appData',profile);app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false,server;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
  if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  const until=async code=>{for(let i=0;i<300;i++){if(await run(code))return;await wait(30);}throw Error('Timed out: '+code);};
  try{
    // Distinct photos, about 16 MB in total. No user's collection is read.
    const cars=Array.from({length:90},(_,i)=>{const pixels=crypto.randomBytes(256*128*4);for(let n=3;n<pixels.length;n+=4)pixels[n]=255;return {id:'car-'+i,name:'Test car '+String(i+1).padStart(3,'0'),maker:'Synthetic club',raceClass:'GT3',picture:nativeImage.createFromBitmap(pixels,{width:256,height:128}).toDataURL()};});
    let revision=1;const status=()=>({id:'perf-host',name:'Photo-heavy test collection',revision,catalogueRevision:revision,permissions:{timingResults:true},capabilities:{timing:{versions:[1]}}});
    server=http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');const car=req.url.startsWith('/v1/timing/cars/')?cars.find(c=>c.id===decodeURIComponent(req.url.split('/').at(-1))):null;const value=car?{integrationVersion:1,databaseId:'perf-host',car,configuration:{databaseId:'perf-host',carId:car.id,capturedAt:new Date().toISOString(),signature:'a'.repeat(64),technical:{}}}:req.url==='/v1/status'?status():{...status(),cars,nextOffset:null};res.end(JSON.stringify(value));});
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));win.setContentSize(1280,960);await wait(300);
    await run(`window.ck=(v,m)=>{if(!v)throw Error(m);};await api.paddockConnect({address:'127.0.0.1:${server.address().port}',code:'test password'});state.tab='database';state.sub='slotcars';await render();window.box=document.createElement('section');document.getElementById('subview').replaceChildren(box);window.photoRequests=0;window.concurrent=0;window.maxConcurrent=0;window.photoIds=[];window.longTasks=[];new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>e.duration))).observe({type:'longtask'});window.browser=PaddockBrowser.mount(box,{...api,paddockCatalogue:async force=>{const v=await api.paddockCatalogue(force);if(window.delayRefresh)await new Promise(resolve=>window.finishRefresh=resolve);return v;},paddockPicture:async(id,key)=>{photoRequests++;photoIds.push(id);maxConcurrent=Math.max(maxConcurrent,++concurrent);try{return await api.paddockPicture(id,key);}finally{concurrent--;}}},{view:async car=>{window.chosenCar=car;}});`);
    await until(`return photoRequests===40&&!concurrent&&[...box.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0);`);
    const initial=await run(`const view=await api.paddockCatalogue();ck(JSON.stringify(view).length<50000,'Catalogue IPC excludes photos');ck(maxConcurrent===1,'One image transfer at a time');ck(photoIds.every(id=>Number(id.slice(4))<40),'Only visible-page photos requested');window.firstCard=box.querySelector('.pb-car');window.firstImage=box.querySelector('img');return {catalogueIpcBytes:JSON.stringify(view).length,photoRequests,maxConcurrent,longTasks};`);
    await run(`window.focusedCar=box.querySelector('[data-use]');focusedCar.focus();await browser.refresh();ck(document.activeElement===focusedCar,'Unchanged polling preserves keyboard focus');ck(box.querySelector('.pb-car')===firstCard,'Unchanged refresh keeps cards');ck(box.querySelector('img')===firstImage,'Unchanged refresh keeps decoded images');ck(photoRequests===40,'Unchanged refresh transfers no images');box.querySelector('[data-next]').click();`);
    await until(`return photoRequests===80&&!concurrent&&[...box.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0);`);
    await run(`ck(photoIds.slice(40).every(id=>Number(id.slice(4))>=40&&Number(id.slice(4))<80),'Second-page images only');box.querySelector('[data-search]').value='Test car 090';box.querySelector('[data-search]').dispatchEvent(new Event('input'));`);
    await until(`return photoRequests===81&&box.querySelector('img')?.naturalWidth>0;`);
    revision++;cars[89].name='Renamed club car';cars[89].picture=cars[0].picture;
    await run(`box.querySelector('[data-search]').value='Renamed';box.querySelector('[data-search]').dispatchEvent(new Event('input'));await browser.refresh(true);`);
    await until(`return photoRequests===82&&box.querySelector('img')?.naturalWidth>0;`);
    await run(`ck(box.querySelector('.pb-car').textContent.includes('Renamed'),'Changed metadata refreshed');ck(box.querySelector('img').src===firstImage.src,'Changed image loaded');`);
    await run(`box.querySelector('[data-search]').value='';box.querySelector('[data-search]').dispatchEvent(new Event('input'));`);
    await until(`return !concurrent&&[...box.querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0);`);
    fs.writeFileSync(path.join(out,'catalogue-1280.png'),(await win.webContents.capturePage()).toPNG());
    win.setContentSize(600,900);await wait(200);await run(`ck(box.scrollWidth<=box.clientWidth+2,'Compact catalogue fits');`);fs.writeFileSync(path.join(out,'catalogue-600.png'),(await win.webContents.capturePage()).toPNG());
    await run(`window.delayRefresh=true;window.refreshWork=browser.refresh();`);
    await until(`return typeof finishRefresh==='function';`);
    await run(`box.querySelector('[data-use]').click();ck(!window.chosenCar,'Selection waits for refresh');delayRefresh=false;finishRefresh();await refreshWork;`);
    await until(`return !!window.chosenCar?.paddock;`);
    // Closing while pictures are loading must stop further IPC requests.
    await run(`box.querySelector('[data-next]').click();browser.stop();window.stoppedAt=photoRequests;`);await wait(150);await run(`ck(photoRequests===stoppedAt,'Closed browser stops photo work');`);
    await run(`box.remove();window.connection=await PaddockUI.open(api);await connection.dialog.querySelector('[data-browse]').onclick();ck(connection.dialog.querySelectorAll('.paddock-car').length===40,'Connection list is bounded');connection.dialog.querySelector('[data-car-next]').click();ck(connection.dialog.querySelector('[data-car-count]').textContent.includes('Page 2'),'Connection pagination');connection.dialog.querySelector('[data-search]').value='Renamed';connection.dialog.querySelector('[data-search]').dispatchEvent(new Event('input'));ck(connection.dialog.querySelectorAll('.paddock-car').length===1,'Connection search searches all cars');connection.dialog.close();`);
    const result={passed:true,photoCollectionBytes:Buffer.byteLength(JSON.stringify(cars)),...initial,checks:['lightweight catalogue IPC','40 visible images only','serial photo loading','unchanged DOM and zero image requests on refresh','pagination','search','renamed car and replacement photo','600px fit','teardown cancels image queue','connection dialogue pagination and search','keyboard focus during polling','selection queued during refresh']};
    fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));await new Promise(resolve=>server.close(resolve));app.quit();
  }catch(e){console.error(e);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());server?.close();app.exit(1);}
});});require('../../main');
