'use strict';
// Full application and native IPC, private profiles only. No user's library,
// network pairing or hardware. Baseline HTML comes from the last committed UI.
const {app,dialog,nativeImage}=require('electron'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const backend=process.env.SF_MEDIA_QA_BACKEND||'json',out=path.resolve(__dirname,'../../../outputs/media-read-review',backend);fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(os.tmpdir(),'sf-media-ui-'));app.setPath('appData',isolated);process.env.LOCALAPPDATA=path.join(isolated,'local');app.disableHardwareAcceleration();
const profile=path.join(isolated,'slotforge-timing');fs.mkdirSync(profile);
const engine=require('../../vendor/slotforge-library/index.cjs'),open=engine.open;engine.open=o=>open({...o,sharedRoot:path.join(isolated,'shared'),legacyProfiles:[profile]});
require('./qa-completion.cjs').preventRelaunch(app);require('./file-diagnostics.cjs')(path.join(out,'diagnostics.log'),()=>app.exit(1));
dialog.showErrorBox=(title,message)=>{console.error(title,message);app.exit(1);};
const db=new(require('../../db'))(path.join(profile,'slotforge-timing.json'));
const picture=nativeImage.createFromPath(path.resolve(__dirname,'../../build/icon.png')).resize({width:32}).toDataURL(),sound='data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
db.data.imagesets=['fuel','flags','lights','avatars','tyres','weather','conditions'].map((kind,i)=>({id:'im-'+i,name:'Club '+kind,kind,steps:4,images:kind==='fuel'?[picture,'',picture,'']:{green:picture,red:'',dry:picture,'1':picture,countdown_all:picture}}));
db.data.audiosets=[{id:'au-0',name:'Club commentary',voice:'',calls:{prerace:{on:true,lines:[{text:'Welcome to the club',file:sound,mode:'both'}]},finished:{on:false,lines:[{text:'Finished'}]}}},{id:'au-1',name:'Quiet practice',voice:'Test voice',calls:{prerace:{on:false,lines:[{text:'Practice'}]}}}];
db.data.drivers=Array.from({length:203},(_,i)=>({id:'driver-'+i,name:'Driver '+i,avatar:picture}));db.saveNow();const original=fs.readFileSync(db.file),untouched=structuredClone({images:db.data.imagesets.slice(1),audio:db.data.audiosets[1]});
if(backend==='sqlite'){const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation);fs.mkdirSync(path.dirname(copy),{recursive:true});require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,path.join(copy,'working'));fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));}
fs.writeFileSync(path.join(profile,'storage-conversion-prompt.json'),JSON.stringify({version:1,choice:'keep'}));
let guard=false,delayRead=false;const fullReads=[];
for(const Repository of [require('../../data-repository'),require('../../compatibility-read').SqliteCompatibilityReads]){
 const list=Repository.prototype.list,get=Repository.prototype.get;
 Repository.prototype.list=function(entity){if(guard&&['imagesets','audiosets','drivers'].includes(entity))throw Error('Unexpected broad read: '+entity);return list.call(this,entity);};
 Repository.prototype.get=function(entity,id){if(guard&&['imagesets','audiosets'].includes(entity))fullReads.push({entity,id});return delayRead?new Promise(resolve=>setTimeout(()=>resolve(get.call(this,entity,id)),150)):get.call(this,entity,id);};
}
const oldFile=file=>require('node:child_process').execFileSync('git',['show','v2.2.3:renderer/'+file],{cwd:path.resolve(__dirname,'../..'),encoding:'utf8'});
const oldImage=oldFile('editor.js').split('async function renderImageSets(box) {')[1].split('// The grid of a Start lights set.')[0],oldAudio=oldFile('audioedit.js').split('async function renderAudioSets(box) {')[1].split('function renderAudioSetEditor(box)')[0];
let done=false;const wait=ms=>new Promise(r=>setTimeout(r,ms)),timeout=setTimeout(()=>app.exit(2),110000);
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.setBackgroundThrottling(false);win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>win.webContents.executeJavaScript('(async()=>{'+code+'})()');
 const until=async condition=>{for(let i=0;i<150;i++){if(await run('return '+condition))return;await wait(50);}throw Error('Timeout: '+condition);};
 const shot=async name=>{await wait(80);fs.writeFileSync(path.join(out,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{
  await until('!!state.schema.slotcars');win.setContentSize(1350,950);assert.equal(await run('return (await api.storageStatus()).backend'),backend);
  await run("window.qaErrors=[];window.qaAlerts=[];window.alert=m=>qaAlerts.push(m);window.confirm=()=>true;addEventListener('error',e=>qaErrors.push(e.message));addEventListener('unhandledrejection',e=>qaErrors.push(String(e.reason)));state.tab='custom';state.customSub='images';await render();");
  for(const [sub,fn,old] of [['images','renderImageSets',oldImage],['audio','renderAudioSets',oldAudio]]){
   guard=true;await run(`state.customSub='${sub}';await renderCustom();`);
   const current=await run('return document.getElementById("setupbox").innerHTML');
   guard=false;const before=await run(`const box=document.getElementById('setupbox');await (async function(box){${old.slice(0,old.lastIndexOf('}'))}})(box);return box.innerHTML;`);
   assert.equal(current,before,sub+' overview HTML unchanged');guard=true;await run(`await ${fn}(document.getElementById('setupbox'));`);
   for(const theme of ['dark','light']){await run(`state.settings.theme='${theme}';applyTheme();`);await shot(sub+'-'+theme);}
  }
  fullReads.length=0;
  await run("state.customSub='images';await renderCustom();document.querySelector('[data-edit=im-0]').click();");await until('!!imgEd');
  assert.deepEqual(await run('return imgEd.draft.images'),db.data.imagesets[0].images);assert.deepEqual(fullReads,[{entity:'imagesets',id:'im-0'}]);
  await shot('image-editor');await run("const n=document.getElementById('is-name');n.value='Renamed pictures';n.dispatchEvent(new Event('input'));await document.getElementById('is-save').onclick();document.getElementById('is-back').click();");await until('!!document.querySelector("[data-dup=im-0]")');
  await run("document.querySelector('[data-dup=im-0]').click();document.querySelector('[data-dup=im-0]').click();");await until('document.querySelectorAll("[data-dup]").length===8');
  const images=await run("return await EditorData.choices(api,'imagesets','media')"),copy=images.find(x=>x.name==='Renamed pictures (copy)');assert(copy);
  assert.deepEqual(await run(`return (await api.getRecord('imagesets',${JSON.stringify(copy.id)})).images`),db.data.imagesets[0].images);
  await run(`document.querySelector('[data-del="${copy.id}"]').click();`);await until('document.querySelectorAll("[data-dup]").length===7');
  await run("state.customSub='audio';await renderCustom();document.querySelector('[data-edit=au-0]').click();");await until('!!audEd');
  assert.equal(await run('return audDrivers.length'),203);assert.equal(await run('return audEd.draft.calls.prerace.lines[0].file'),sound);
  await shot('audio-editor');await run("const n=document.getElementById('au-name');n.value='Renamed commentary';n.dispatchEvent(new Event('input'));await document.getElementById('au-save').onclick();document.getElementById('au-back').click();");await until('!!document.querySelector("[data-dup=au-0]")');
  await run("document.querySelector('[data-dup=au-0]').click();");await until('document.querySelectorAll("[data-dup]").length===3');
  const audio=await run("return await EditorData.choices(api,'audiosets','media')"),audioCopy=audio.find(x=>x.name==='Renamed commentary (copy)');assert(audioCopy);
  assert.equal(await run(`return (await api.getRecord('audiosets',${JSON.stringify(audioCopy.id)})).calls.prerace.lines[0].file`),sound);
  // A deleted selection must not open an empty editor or resurrect its data.
  await run("await api.remove('audiosets','au-1');document.querySelector('[data-edit=au-1]').click();");await until('qaAlerts.length===1');assert.equal(await run('return audEd'),null);
  // Navigating away while a selected set loads must not reopen its editor.
  delayRead=true;await run("document.querySelector('[data-edit=au-0]').click();state.tab='rules';await render();");await wait(250);delayRead=false;assert.equal(await run('return audEd'),null);assert.equal(await run('return state.tab'),'rules');
  for(const image of untouched.images)assert.deepEqual(await run(`return await api.getRecord('imagesets',${JSON.stringify(image.id)})`),image);
  if(backend==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);
  assert.deepEqual(await run('return qaErrors'),[]);
  fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,backend,isolated,checks:['overview HTML identical to previous UI','light/dark screenshots','no full media or driver list reads','selected image/audio edit and save','pictures and recordings preserved','duplicate/remove','double click','203 driver choices','deleted selection','late navigation','unrelated sets unchanged','SQLite original JSON unchanged']},null,2));
  clearTimeout(timeout);require('./qa-completion.cjs').complete();app.exit(0);
 }catch(error){console.error(error);fs.writeFileSync(path.join(out,'failure.png'),(await win.webContents.capturePage()).toPNG());clearTimeout(timeout);app.exit(1);}
});});
db.writesIdle().then(()=>require('../../main')).catch(error=>{console.error(error);app.exit(1);});
