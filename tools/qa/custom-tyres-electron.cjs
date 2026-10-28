// Real form persistence, shared controls and visual checks. No physical hardware.
const {app}=require('electron'),fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../../../outputs/code-audit'),data=path.resolve(__dirname,'../../.tmp-test/custom-tyres-'+process.pid);
fs.mkdirSync(data,{recursive:true});app.setPath('appData',data);app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let done=false;
const timeout=setTimeout(()=>app.exit(1),55000);timeout.unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=s=>win.webContents.executeJavaScript('(async()=>{'+s+'})()');
 try{
  await wait(500);win.setMinimumSize(0,0);win.setContentSize(1200,950);win.showInactive();
  await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));window.ck=(v,m)=>{if(!v)throw Error(m)};window.input=(q,v)=>{const el=document.querySelector(q);ck(el,'Missing '+q);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));};
   openForm('tyrewearsystems',null);input('#f-name','Club compounds QA');document.querySelector('[data-twsel="SS"]').click();ck(document.querySelector('.twprofile [data-twk="bonus"]').dataset.tw==='SS'&&document.querySelector('#tw-curve').textContent.includes('Supersoft'),'Tune selects matching fields and curve');input('[data-twlife="S"]',10);ck(document.querySelector('.twprofile [data-twk="bonus"]').dataset.tw==='SS','Lifetime editing must not switch profile silently');document.querySelector('[data-twadd]').click();window.customCode=document.querySelector('[data-twmeta]').dataset.twmeta;
   input('[data-twmeta][data-twkey="name"]','Club slick');input('[data-twmeta][data-twkey="icon"]','S');input('[data-twlife="'+customCode+'"]',800);
   input('#f-setsMode','car');input('[data-tws="'+customCode+'"]',4);
   await document.getElementById('frm').onsubmit({preventDefault(){}});window.saved=(await api.list('tyrewearsystems')).find(x=>x.name==='Club compounds QA');
   ck(saved?.tyres[customCode].name==='Club slick'&&saved.tyres[customCode].wear===.125&&saved.sets[customCode]===4,'Saved custom definition/life/sets');
   openForm('tyrewearsystems',saved);ck(document.querySelector('[data-twmeta]').value==='Club slick','Reopen custom name');ck(document.querySelector('.rshd').textContent.includes('10 tyres'),'Header custom compound count');document.querySelector('[data-twmeta]').scrollIntoView({block:'center'});`);
  await wait(200);fs.writeFileSync(path.join(out,'custom-tyres-1200.png'),(await win.webContents.capturePage()).toPNG());
  win.setContentSize(600,950);await run(`document.querySelector('[data-twmeta]').scrollIntoView({block:'center'});`);await wait(250);fs.writeFileSync(path.join(out,'custom-tyres-600.png'),(await win.webContents.capturePage()).toPNG());
  await run(`const fields=[...document.querySelectorAll('.twcustom input,.twcustom select,.twcustom button')];for(const el of fields){const b=el.getBoundingClientRect();ck(b.width>70&&b.left>=0&&b.right<=innerWidth,'Custom control clips at 600px');}
   input('[data-twmeta][data-twkey="name"]','A'.repeat(60));const label=document.querySelector('[data-twrow="'+customCode+'"] .twname');ck(label.scrollWidth<=label.clientWidth+1,'Long custom name must wrap');
   document.getElementById('cancel').click();state.refs.tyrewearsystems=[saved];openForm('slotcars',null);ck([...document.getElementById('f-tyreCompound').options].some(x=>x.value===customCode&&x.textContent.includes('Club slick')),'Slotcar custom choice');document.getElementById('cancel').click();
   openForm('tyrewearsystems',saved);input('[data-twmeta][data-twkey="name"]','Renamed club slick');await document.getElementById('frm').onsubmit({preventDefault(){}});saved=(await api.list('tyrewearsystems')).find(x=>x.id===saved.id);ck(saved.tyres[customCode].name==='Renamed club slick','Stable rename');
   openForm('tyrewearsystems',saved);document.querySelector('[data-twremove]').click();await document.getElementById('frm').onsubmit({preventDefault(){}});const removed=(await api.list('tyrewearsystems')).find(x=>x.id===saved.id);ck(!removed.tyres[customCode]&&!Object.hasOwn(removed.sets,customCode),'Delete definition and sets');ck(!qaErrors.length,qaErrors.join(';'));`);
  console.log('CUSTOM TYRE ELECTRON PASSED: create, save, reopen, rename, delete, slotcar choices and 600px controls');clearTimeout(timeout);app.quit();
 }catch(e){console.error(e);fs.writeFileSync(path.join(out,'custom-tyres-failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
});});require('../../main');
