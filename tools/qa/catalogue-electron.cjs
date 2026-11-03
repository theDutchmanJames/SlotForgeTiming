// Actual app/preload/renderer, isolated profile; never opens the personal database.
const {app,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/catalogue-ui');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const image=nativeImage.createFromPath(path.resolve(__dirname,'../../build/icon.png')).resize({width:64}).toDataURL();
let done=false;const timer=setTimeout(()=>app.exit(2),90000),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
  if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
  const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
  const until=async expression=>{for(let i=0;i<60;i++){if(await run('return '+expression))return;await wait(50);}throw Error('Timed out: '+expression);};
  try{
    await wait(300);win.setContentSize(1200,800);
    await run(`window.catalogueErrors=[];addEventListener('error',e=>catalogueErrors.push(e.message));addEventListener('unhandledrejection',e=>catalogueErrors.push(String(e.reason)));
      for(let i=0;i<125;i++)await api.add('drivers',{name:'Driver '+i,nickname:'Club racer',avatar:${JSON.stringify(image)},avatarFrame:{zoom:1,x:0,y:0},unknown:{keep:'yes'}});
      await api.add('tracks',{name:'Club Circuit',lanes:4,length:22,picture:${JSON.stringify(image)},notes:'Full notes '+ 'original '.repeat(30)});
      await api.add('slotcars',{brand:'SlotForge',model:'GT3',picture:${JSON.stringify(image)},extraPictures:[${JSON.stringify(image)}]});
      await api.add('teams',{name:'Club team',drivers:[],picture:${JSON.stringify(image)}});
      state.tab='database';state.sub='drivers';state.settings.dbView='grid';await render();`);
    assert.equal(await run("return document.querySelectorAll('#subview .gcard').length"),48);
    await until("document.querySelector('#subview [data-catalogue-picture]')?.naturalWidth>0");
    const first=await run("return document.querySelector('#subview [data-edit]').dataset.edit");
    await run("document.querySelector('[data-catalogue-next]').click()");await until("document.querySelector('.catalogue-navigation').textContent.includes('Page 2')");
    assert.equal(await run("return document.querySelector('#subview .gcard h3').textContent"),'Driver 48');
    await run("document.querySelector('[data-catalogue-prev]').click()");await until("document.querySelector('.catalogue-navigation').textContent.includes('Page 1')");
    await run("document.querySelector('[data-catalogue-search] input').value='Driver 124';document.querySelector('[data-catalogue-search]').requestSubmit()");
    await until("document.querySelectorAll('#subview .gcard').length===1");assert.equal(await run("return document.querySelector('#subview .gcard h3').textContent"),'Driver 124');
    await run("document.querySelector('#subview [data-edit]').click()");await until("dlg.open&&!!document.querySelector('#f-name')");
    assert.equal(await run("return document.querySelector('#f-name').value"),'Driver 124');
    await run("document.querySelector('#f-name').value='Edited driver';document.querySelector('#frm').requestSubmit()");await until('!dlg.open');
    const edited=await run("return (await api.list('drivers')).find(x=>x.name==='Edited driver')");assert.equal(edited.avatar,image);assert.equal(edited.unknown.keep,'yes');
    await run("cataloguePages.get('drivers').search='';cataloguePages.get('drivers').index=0;await mountManager(byId('subview'),'drivers');");
    // A page change after a mutation cannot mix revisions.
    await run(`await api.update('drivers',${JSON.stringify(first)},{nickname:'Changed outside the page'});document.querySelector('[data-catalogue-next]').click();`);
    await until("document.querySelector('[data-catalogue-search]').textContent.includes('catalogue changed')");
    assert(await run("return document.querySelector('.catalogue-navigation').textContent.includes('Page 1')"));
    const themes=await run('return Theme.THEMES.map(x=>x[0])');
    for(const theme of themes){
      await run(`state.settings.theme=${JSON.stringify(theme)};applyTheme();await mountManager(byId('subview'),'drivers');`);await wait(80);
      assert(await run("return [...document.querySelectorAll('.catalogue-navigation button,.catalogue-search button')].every(b=>{const r=b.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})"));
      fs.writeFileSync(path.join(out,theme+'.png'),(await win.webContents.capturePage()).toPNG());
    }
    for(const entity of ['tracks','teams','slotcars']){await run(`state.sub='${entity}';await render();`);assert.equal(await run("return document.querySelectorAll('#subview .gcard').length"),1);}
    await run("state.sub='drivers';state.settings.dbView='list';await render();");
    assert.equal(await run("return document.querySelectorAll('#subview tr[data-view]').length"),48);
    await until("document.querySelector('#subview .thumb')?.naturalWidth>0");
    fs.writeFileSync(path.join(out,'table.png'),(await win.webContents.capturePage()).toPNG());
    await run("state.settings.theme='custom';state.settings.customColors={bg:'#f3f1ed',panel:'#ffffff',ink:'#20252b',muted:'#536071',line:'#bfc7d1',accent:'#a82538'};applyTheme();state.settings.dbView='grid';await mountManager(byId('subview'),'drivers');");
    fs.writeFileSync(path.join(out,'custom-light.png'),(await win.webContents.capturePage()).toPNG());
    // Full track notes survive a view request; no shortened summary is used as the record.
    await run("state.sub='tracks';await render();document.querySelector('#subview [data-view]').click()");await until('dlg.open');
    assert(await run("return dlg.textContent.includes('original '.repeat(20).trim())"));
    await run('dlg.close()');await wait(50);
    win.setMinimumSize(0,0);win.setContentSize(600,800);await run("state.sub='drivers';state.settings.dbView='grid';state.settings.theme='dark';applyTheme();await render();");await wait(100);
    assert.equal(await run('return innerWidth'),600);
    assert(await run("return [...document.querySelectorAll('.catalogue-navigation button,.catalogue-search button')].every(b=>b.getBoundingClientRect().right<=innerWidth)"));
    fs.writeFileSync(path.join(out,'narrow.png'),(await win.webContents.capturePage()).toPNG());
    assert.deepEqual(await run('return catalogueErrors'),[]);
    fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,themes,profile,checks:['48-row bound','natural order','next/previous','search','selected-record edit preserves media and unknown fields','stale cursor refresh','all four catalogues','full track details','visible pictures','600px controls','runtime errors']},null,2));
    console.log('CATALOGUE ELECTRON PASS: '+out);clearTimeout(timer);app.exit(0);
  }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timer);app.exit(1);}
});});require('../../main');
