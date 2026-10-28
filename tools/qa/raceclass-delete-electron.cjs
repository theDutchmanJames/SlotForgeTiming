// Uses the real app and an isolated database. No user data or hardware touched.
const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=path.resolve(__dirname,'../../../outputs/widget-engine-review');fs.mkdirSync(out,{recursive:true});
app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/class-delete-electron-'+process.pid));app.disableHardwareAcceleration();
const wait=ms=>new Promise(r=>setTimeout(r,ms));let started=false;setTimeout(()=>app.exit(2),120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(started||!win.webContents.getURL().endsWith('index.html'))return;started=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const shot=async name=>fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());
 const until=async code=>{for(let i=0;i<80;i++){if(await run(code))return;await wait(50);}throw Error('Timeout: '+code);};
 try{
  await wait(350);win.setMinimumSize(0,0);win.setContentSize(1200,900);
  await run(`window.qaErrors=[];window.alert=m=>qaErrors.push(m);window.confirm=m=>{window.qaPrompt=m;return window.qaAccept;};window.qaAccept=false;
   window.qaGT=await api.add('raceclasses',{name:'GT3',color:'#61c498',icon:'car'});window.qaProto=await api.add('raceclasses',{name:'Prototype',color:'#b39aff',icon:'car'});window.qaUnused=await api.add('raceclasses',{name:'Retired catalogue label',color:'#d9955d'});
   window.qaDriver=await api.add('drivers',{name:'James',raceClass:qaGT.id});window.qaCar=await api.add('slotcars',{brand:'NSR',model:'Mosler',raceClass:qaGT.id});await api.add('slotcars',{brand:'Slot.it',model:'Prototype',raceClass:qaProto.id});
   window.qaProfile=await api.add('multiclasssystems',MultiClass.clean({name:'Club classes',assignment:'roster',classes:[qaGT,qaProto],driverClasses:[{driverId:qaDriver.id,classId:qaGT.id}]}));
   state.tab='setup';state.setupSub='multiclass';await render();document.querySelector('.mc-info').open=true;`);
  assert(await run(`return !!document.querySelector('[data-mc-class-delete="'+qaUnused.id+'"]');`),'unused labels accessible on systems list');
  await shot('class-catalogue');
  await run(`document.querySelector('[data-mc-class-delete="'+qaGT.id+'"]').click();`);await until(`return !!window.qaPrompt;`);
  assert(await run(`return (await api.list('raceclasses')).some(c=>c.id===qaGT.id)&&qaPrompt.includes('1 slotcars')&&qaPrompt.includes('1 driver defaults');`),'cancel leaves data intact and describes impact');
  await run(`qaAccept=true;document.querySelector('[data-mc-class-delete="'+qaUnused.id+'"]').click();`);await until(`return !document.querySelector('[data-mc-class-delete="'+qaUnused.id+'"]');`);
  await run(`document.querySelector('[data-mc-edit="'+qaProfile.id+'"]').click();`);await until(`return !!document.querySelector('#mc-form');`);
  await run(`document.querySelector('#mc-classes').scrollIntoView({block:'center'});`);await wait(300);await shot('classes-1200');win.setContentSize(600,950);await wait(200);await run(`document.querySelector('#mc-classes').scrollIntoView({block:'center'});`);await wait(300);await shot('classes-600');
  fs.writeFileSync(path.join(out,'class-geometry.json'),JSON.stringify(await run(`return ['#mc-classes','.rsmain','.rsbody','#mc-form'].map(s=>{const e=document.querySelector(s),r=e.getBoundingClientRect(),c=getComputedStyle(e);return {selector:s,x:r.x,y:r.y,width:r.width,height:r.height,display:c.display,visibility:c.visibility,overflow:c.overflow,html:e.innerHTML.slice(0,180)};});`),null,2));
  assert(await run(`return document.documentElement.scrollWidth<=innerWidth+1&&[...document.querySelectorAll('.mc-remove-class')].every(e=>e.getBoundingClientRect().right<=innerWidth);`),'delete controls fit narrow page');
  await run(`const input=document.querySelector('[data-mc="name"]');input.value='Unsaved name survives';input.dispatchEvent(new Event('input',{bubbles:true}));document.querySelector('[data-mc-class-delete="'+qaGT.id+'"]').click();`);
  await until(`return !document.querySelector('[data-mc-class-delete="'+qaGT.id+'"]');`);
  assert(await run(`return document.querySelector('[data-mc="name"]').value==='Unsaved name survives'&&multiEditor.draft.classes.length===1&&multiEditor.draft.driverClasses.length===0&&(await api.list('slotcars')).find(c=>c.id===qaCar.id).raceClass===''&&(await api.list('drivers')).find(c=>c.id===qaDriver.id).raceClass===''&&(await api.list('multiclasssystems'))[0].classes.length===1;`),'used deletion updates backend and draft without losing unrelated edits');
  await run(`const s=document.querySelector('[data-driver-class]');s.value=qaProto.id;s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#mc-form').requestSubmit();`);
  await until(`return !multiEditor.dirty&&!multiEditor.saving;`);
  assert(await run(`return (await api.list('multiclasssystems'))[0].name==='Unsaved name survives'&&(await api.list('raceclasses')).length===1;`),'save does not resurrect deleted class');
  // Deletion of a draft-only legacy class must never issue database removal.
  await run(`multiEditor={draft:MultiClass.clean({name:'Legacy draft',assignment:'car'}),defs:await api.list('raceclasses'),dirty:false};await renderMultiClass(document.querySelector('#setupmgr'));document.querySelector('#mc-add').click();`);
  await run(`window.qaFresh=multiEditor.defs.find(c=>c.fresh).id;document.querySelector('[data-mc-class-delete="'+qaFresh+'"]').click();`);
  await until(`return !multiEditor.defs.some(c=>c.id===qaFresh);`);
  assert(await run(`return (await api.list('raceclasses')).length===1&&qaErrors.length===0;`),'draft deletion and no unexpected errors');
  fs.writeFileSync(path.join(out,'electron-result.json'),JSON.stringify({passed:true,checks:['catalogue access','cancel','impact counts','unused deletion','1200px/600px layout','used deletion','draft preservation','save/reopen data','fresh draft deletion']},null,2));
  console.log('CLASS DELETION ELECTRON PASS');app.exit(0);
 }catch(e){console.error(e);try{await shot('failure');}catch{}app.exit(1);}
});});require('../../main.js');
