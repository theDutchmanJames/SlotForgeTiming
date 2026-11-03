'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{spawnSync}=require('node:child_process');
const Rollout=require('../storage-rollout'),Activation=require('../storage-activation'),Runtime=require('../sqlite-runtime'),D=require('../db');
function profile(t,json=false){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sf-rollout-'));if(json){const d=new D(path.join(dir,'slotforge-timing.json'));d.data.drivers=[{id:'kept',name:'Original'}];d.saveNow();}t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
const noPrompt=()=>{throw Error('Unexpected prompt');};
test('fresh installation uses SQLite defaults, persists writes and reopens without JSON or a prompt',async t=>{
 const p=profile(t);fs.mkdirSync(path.join(p,'Cache'));const chosen=await Rollout.startup(p,{ask:noPrompt});assert.equal(chosen.origin,'new');assert(!fs.existsSync(path.join(p,'slotforge-timing.json')));
 let r=await Runtime.open(chosen.directory,{profileRoot:p});assert.equal(r.lifecycle.settings().theme,'dark');await r.records.add('drivers',{name:'New driver'});await r.lifecycle.shutdown();
 assert.equal((await Rollout.startup(p,{ask:noPrompt})).generation,chosen.generation);r=await Runtime.open(chosen.directory,{profileRoot:p});try{assert.equal((await r.records.list('drivers'))[0].name,'New driver');}finally{await r.lifecycle.shutdown();}
});
for(const choice of [1,2])test('existing JSON choice '+choice+' preserves source bytes and controls reminders',async t=>{
 const p=profile(t,true),file=path.join(p,'slotforge-timing.json'),bytes=fs.readFileSync(file),settings=fs.readFileSync(path.join(p,'slotforge-timing.settings.json'));let asked=0;
 assert.equal(await Rollout.startup(p,{now:100,ask:async options=>{asked++;assert.equal(options.defaultId,1);assert.equal(options.cancelId,1);return {response:choice};}}),null);
 assert.equal(await Rollout.startup(p,{now:101,ask:noPrompt}),null);assert.equal(Rollout.due(p,100+Rollout.WEEK),choice===1);assert.equal(asked,1);
 assert.deepEqual(fs.readFileSync(file),bytes);assert.deepEqual(fs.readFileSync(path.join(p,'slotforge-timing.settings.json')),settings);assert(!fs.existsSync(path.join(p,'sqlite')));
 // Keeping JSON never prevents conversion from the settings button.
 Activation.request(p);assert.equal((await Rollout.startup(p,{ask:noPrompt})).backend,'sqlite');assert.deepEqual(fs.readFileSync(file),bytes);
});
test('conversion prompt migrates the current settings and records while preserving originals',async t=>{
 const p=profile(t,true),files=['slotforge-timing.json','slotforge-timing.settings.json'];fs.writeFileSync(path.join(p,files[1]),JSON.stringify({theme:'light',customSetting:'preserved'}));
 const bytes=files.map(f=>fs.readFileSync(path.join(p,f)));const chosen=await Rollout.startup(p,{ask:async()=>({response:0})}),r=await Runtime.open(chosen.directory,{profileRoot:p});
 try{assert.equal((await r.records.get('drivers','kept')).name,'Original');assert.equal(r.lifecycle.settings().customSetting,'preserved');await r.records.update('drivers','kept',{name:'SQLite only'});}finally{await r.lifecycle.shutdown();}
 files.forEach((f,i)=>assert.deepEqual(fs.readFileSync(path.join(p,f)),bytes[i]));await Rollout.startup(p,{ask:noPrompt});
});
for(const phase of ['before-copy','copy-verified','fork-created','working-verified','before-publish','after-publish'])test('fresh installation recovers an abrupt exit at '+phase,async t=>{
 const p=profile(t),script="require(process.argv[1]).startup(process.argv[2],{checkpoint:p=>{if(p===process.argv[3])process.exit(73)}}).catch(e=>{console.error(e);process.exit(1)});";
 const result=spawnSync(process.execPath,['-e',script,require.resolve('../storage-rollout'),p,phase],{stdio:'pipe',windowsHide:true,timeout:30000});assert.equal(result.status,73,String(result.stderr));assert.equal(Activation.canCancel(p),false);
 const published=Activation.selected(p),chosen=await Rollout.startup(p,{ask:noPrompt});if(published)assert.equal(chosen.generation,published.generation);assert(!fs.existsSync(path.join(p,'slotforge-timing.json')));
 const r=await Runtime.open(chosen.directory,{profileRoot:p});await r.lifecycle.shutdown();
});
for(const trace of ['slotforge-timing.settings.json','slotforge-timing.damaged-123.json','race-resume.json','sqlite','storage-backend.json','storage-conversion-prompt.json'])test('missing JSON with '+trace+' never creates an empty replacement',async t=>{
 const p=profile(t);fs.writeFileSync(path.join(p,trace),'{}');await assert.rejects(Rollout.startup(p,{ask:noPrompt}));assert(!fs.existsSync(path.join(p,'sqlite-activation-request.json')));
});
test('new creation refuses legacy data appearing before publication',async t=>{
 const p=profile(t);await assert.rejects(Rollout.startup(p,{checkpoint:stage=>{if(stage==='working-verified')fs.writeFileSync(path.join(p,'slotforge-timing.json'),'{}');}}),/Legacy files appeared/);assert.equal(Activation.selected(p),null);assert.equal(fs.readFileSync(path.join(p,'slotforge-timing.json'),'utf8'),'{}');
});
test('malformed prompt preferences ask again rather than converting implicitly',async t=>{const p=profile(t,true);fs.writeFileSync(path.join(p,'storage-conversion-prompt.json'),'{');let count=0;await Rollout.startup(p,{ask:async()=>{count++;return{response:1};}});assert.equal(count,1);assert.equal(Activation.selected(p),null);});
test('null prompt preferences ask again; null storage metadata never falls back to JSON',async t=>{
 const p=profile(t,true);fs.writeFileSync(path.join(p,'storage-conversion-prompt.json'),'null');assert.equal(Rollout.due(p,0),true);
 for(const name of ['storage-backend.json','sqlite-activation-request.json']){fs.writeFileSync(path.join(p,name),'null');await assert.rejects(Rollout.startup(p,{ask:noPrompt}),/cannot be read/);fs.unlinkSync(path.join(p,name));}
});
test('failed conversion preserves JSON and resumes without asking for consent again',async t=>{
 const p=profile(t,true),bytes=fs.readFileSync(path.join(p,'slotforge-timing.json'));
 await assert.rejects(Rollout.startup(p,{ask:async()=>({response:0}),checkpoint:phase=>{if(phase==='copy-verified')throw Error('Injected disk failure');}}),/Injected/);
 assert.equal(Activation.selected(p),null);assert.deepEqual(fs.readFileSync(path.join(p,'slotforge-timing.json')),bytes);
 assert.equal((await Rollout.startup(p,{ask:noPrompt})).backend,'sqlite');assert.deepEqual(fs.readFileSync(path.join(p,'slotforge-timing.json')),bytes);
});
test('a failed old-name migration is surfaced and cannot publish the main database early',t=>{
 const p=profile(t),old=path.join(p,'slot-lap-timer'),current=path.join(p,'slotforge-timing');fs.mkdirSync(old);fs.mkdirSync(current);fs.writeFileSync(path.join(old,'slot-lap-timer.json'),'{}');fs.writeFileSync(path.join(old,'slot-lap-timer.settings.json'),'{}');fs.mkdirSync(path.join(current,'slotforge-timing.settings.json.migration-pending'));
 assert.throws(()=>require('../migrate').migrate(p,{strict:true}),/could not finish/);assert(!fs.existsSync(path.join(current,'slotforge-timing.json')));assert.equal(fs.readFileSync(path.join(old,'slot-lap-timer.json'),'utf8'),'{}');
});
