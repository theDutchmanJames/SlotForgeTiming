'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createHash}=require('node:crypto');
const methods=require('../paddock-shared-startup'),Launcher=require('../paddock-local-launch');
function context(connection=null,disabled=false){const p={...methods,connection:async()=>({connection}),storage:{sharedRead:async()=>({disabled})},localScan:async()=>[],launcherScan:async()=>[],connected:[],catalogue:async()=>{},connectLocal:async x=>p.connected.push(x)};return p;}
const one={key:'a'.repeat(64)+'.json',databaseId:'db',name:'Local library'};
test('startup selects exactly one eligible library; preserves network, opt-out and multiple-library choice',async()=>{
 for(const [saved,disabled,count]of [[null,false,1],[null,false,2],[null,true,1],[{mode:'network'},false,1],[{mode:'local',automatic:false},false,1]]){
  const p=context(saved,disabled);p.localScan=async()=>count===1?[one]:[one,{...one,key:'b'.repeat(64)+'.json'}];await p.startSharedLibrary();assert.equal(p.connected.length,!saved&&!disabled&&count===1?1:0);await p.startSharedLibrary();assert(p.connected.length<=1);
 }
});
test('registered background startup is bounded, launched once, and verifies the selected identity',async()=>{
 const p=context();p.launcherScan=async()=>[one];p.launchWaitMs=5;p.launchPollMs=1;let calls=0;
 p.localLaunch=async()=>calls++;await assert.rejects(p.launchSelected({localKey:one.key,databaseId:'db'}),/did not become ready/);assert.equal(calls,1);
 await assert.rejects(p.launchSelected({localKey:one.key,databaseId:'db'}),/Retry connection/);assert.equal(calls,1);
 p.launchAttempts.clear();p.localScan=async()=>[{...one,databaseId:'replacement'}];await assert.rejects(p.launchSelected({localKey:one.key,databaseId:'db'}),/different database/);
 p.launchAttempts.clear();p.localScan=async()=>[one];p.ensureLocal=async c=>assert.equal(c.databaseId,'db');await p.launchSelected({localKey:one.key,databaseId:'db'});
});
test('launcher validation binds the profile hash and exact argv; unprotected records are rejected',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-launcher-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const key=createHash('sha256').update(path.resolve(dir)).digest('hex'),v={format:'slotforge-local-library-launcher',version:1,libraryKey:key,databaseId:'db',name:'Test',profile:dir,executable:process.execPath,args:['--slotforge-library-start='+key]};
 assert.equal(await Launcher.validate(v,key+'.json'),v);
 for(const patch of [{args:['--eval=evil']},{libraryKey:'b'.repeat(64)},{executable:'relative.exe'},{profile:'relative'}])await assert.rejects(Launcher.validate({...v,...patch},key+'.json'));
 fs.writeFileSync(path.join(dir,key+'.json'),JSON.stringify(v));assert.equal((await Launcher.scan({folder:dir,platform:'win32',checkWindows:async()=>[key+'.json']})).length,1);
 assert.deepEqual(await Launcher.scan({folder:dir,platform:'win32',checkWindows:async()=>[]}),[]);
});
