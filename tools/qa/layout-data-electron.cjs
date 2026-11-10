'use strict';
const {app,dialog}=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const out=path.resolve(__dirname,'../../../outputs/layout-editor-repair');fs.mkdirSync(out,{recursive:true});
const profile=fs.mkdtempSync(path.join(out,'profile-'));app.setPath('appData',profile);app.disableHardwareAcceleration();
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(profile,'diagnostics.log'),()=>app.exit(1));
const Database=require('../../db'),db=new Database(path.join(profile,'fixture.json'));
const picture='data:image/png;base64,'+fs.readFileSync(path.join(__dirname,'../../renderer/avatars/Lane1.png')).toString('base64'),unused='data:image/png;base64,BAUG';
const Track=require('../../renderer/trackdesign'),document=Track.normalize(JSON.parse(fs.readFileSync(path.join(__dirname,'../../tests/fixtures/trackbuilder/01-two-lane.slotforge.json'),'utf8')));
db.data.tracks=[{id:'qa-track',name:'Imported QA circuit',lanes:2,trackDesign:Track.configure(document,document.track.lanes.map(l=>l.id),true),gallery:[unused]}];
db.data.chartdesigns=[{id:'qa-chart',...require('../../renderer/chartwidgets').clean({name:'Imported tracker',style:'track',drivers:'selected',lanes:[0,1]})}];
db.data.drivers=[{id:'driver',name:'Test driver',avatar:picture,gallery:[unused]}];db.data.slotcars=[{id:'car',model:'Test car',picture,gallery:[unused]}];db.data.teams=[{id:'team',name:'Test team',picture}];
db.data.imagesets=[{id:'qa-fuel',name:'Selected fuel pictures',kind:'fuel',steps:2,images:[picture,picture]},{id:'unused',name:'Large unused set',kind:'flag',images:{green:unused}}];
db.data.layouts=[{id:'saved',name:'Existing layout',ratioW:16,ratioH:9,note:'Preserved',widgets:[{type:'name',lane:0,x:10,y:10,w:300,h:150,opt:{}}],bgImage:picture},{id:'oversized',name:'Large unrelated layout',widgets:[],bgImage:unused}];
db.saveNow();const source=fs.readFileSync(db.file),copy=path.join(profile,'copy'),testProfile=path.join(profile,'test');fs.mkdirSync(testProfile);
require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(testProfile,'working'));
fs.writeFileSync(path.join(testProfile,'sqlite-test-profile.json'),JSON.stringify({format:require('../../sqlite-runtime').FORMAT,version:1}));
const store=new(require('../../sqlite-working').WorkingStore)(path.join(testProfile,'working')),bytes=Buffer.alloc(34*1024*1024,7),digest=crypto.createHash('sha256').update(bytes).digest('hex');
store.statement('INSERT INTO media_blobs(digest,bytes) VALUES(?,?)').run(digest,bytes);store.statement('UPDATE asset_refs SET digest=?,original=NULL WHERE digest=?').run(digest,crypto.createHash('sha256').update(Buffer.from([4,5,6])).digest('hex'));
assert.throws(()=>store.compatibilityRead('page','slotcars',{}),/too large for a compatibility list/);store.close();process.argv.push('--sqlite-test-profile='+testProfile);
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};let stage=0,savedId;
const timer=setTimeout(()=>app.exit(2),90000),wait=ms=>new Promise(r=>setTimeout(r,ms));
app.on('browser-window-created',(_,win)=>{win.show=()=>{};win.hide();win.webContents.on('did-finish-load',async()=>{
 if(!win.webContents.getURL().endsWith('index.html'))return;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()'),until=async expression=>{for(let i=0;i<150;i++){if(await run('return '+expression))return;await wait(30);}throw Error('Timed out: '+expression);};
 try{
  await until('!!state.schema.layouts');
  await run("state.tab='custom';state.customSub='layouts';await render();");await until("!!document.querySelector('#newl')");
  assert.match(await run('return view.textContent'),/Large unrelated layout/);
  assert.equal(await run("return document.querySelector('[data-edit=\"saved\"]').closest('tr').children[3].textContent"),'1');
  if(stage===0){stage=1;
   await run("document.querySelector('#newl').click()");await until("!!document.querySelector('#canvas')");
   await run("state.editing.draft.name='Verified new layout';editorAdd('fuel');state.editing.sel[0].opt.imageSet='qa-fuel';state.editing.sel[0].opt.mode='images';state.editing.sel[0].w=350;state.editing.sel[0].h=220;renderEditor();");
   await until("state.editing.imageSets.find(s=>s.id==='qa-fuel').images?.length===2");
   assert(await run("return !state.editing.imageSets.find(s=>s.id==='unused').images"));
   await until("document.querySelector('#canvas .lw-val img')?.naturalWidth>0");
   assert(await run('return editorSave()'));savedId=await run('return state.editing.id');
   for(const theme of ['dark','light']){await run(`state.settings.theme='${theme}';applyTheme();`);win.setMinimumSize(0,0);win.setContentSize(1200,900);win.setOpacity(0);win.showInactive();await wait(200);fs.writeFileSync(path.join(out,'new-'+theme+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());}
   win.reload();return;
  }
  assert.equal(stage,1);stage=2;
  await run(`document.querySelector('[data-edit="${savedId}"]').click()`);await until("!!document.querySelector('#canvas')");
  assert.equal(await run('return state.editing.draft.name'),'Verified new layout');assert.equal(await run('return state.editing.draft.widgets[0].opt.imageSet'),'qa-fuel');
  await run("state.editing.draft.note='Edited and reopened';await editorSave();editorLeave();await render();document.querySelector('[data-edit=\"saved\"]').click();");await until("!!document.querySelector('#canvas')");
  assert.equal(await run('return state.editing.draft.note'),'Preserved');assert.equal(await run('return state.editing.draft.widgets[0].type'),'name');assert.equal(await run('return state.editing.draft.bgImage'),picture);
  await run("state.editing.draft.name='Existing layout edited';await editorSave();");
  win.setContentSize(1200,900);await wait(200);fs.writeFileSync(path.join(out,'existing.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG());
  assert.equal(await run(`return (await api.getRecord('layouts','${savedId}')).note`),'Edited and reopened');
  await run("editorAdd('racechart');const w=state.editing.sel[0];w.opt.chartDesign='qa-chart';w.w=800;w.h=500;renderEditor();");
  await until("!!state.editing.previewTracks.find(t=>t.id==='qa-track').trackDesign");
  await until("document.querySelector('#canvas').textContent.includes('imported layout')");
  await run("const select=document.querySelector('[data-chart-preview]');select.value='';select.dispatchEvent(new Event('change',{bubbles:true}));");
  await until("!document.querySelector('#canvas').textContent.includes('imported layout')");
  assert.deepEqual(fs.readFileSync(db.file),source);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,profile,checks:['same compatibility error reproduced','large unused layout listed','blank layout opened','selected image set loaded','unused image set excluded','create and save','window reload','edit and save','existing widget and background preserved','dark/light captures','imported Live Tracker preview and switching back to sample oval','source fixture unchanged']},null,2));
  require('./qa-completion.cjs').complete();clearTimeout(timer);app.quit();
 }catch(error){console.error(error);clearTimeout(timer);app.exit(1);}
});});require('../../main');
