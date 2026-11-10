'use strict';
// Native startup qualification: a fresh private registration, synthetic profiles,
// and only the process created by this script may be stopped during cleanup.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const out=path.resolve(__dirname,'../../../outputs/shared-car-library-startup');fs.mkdirSync(out,{recursive:true});
const isolated=fs.mkdtempSync(path.join(out,'profile-')),profile=path.join(isolated,'paddock');fs.mkdirSync(profile);
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database');
const {Store}=require(path.join(source,'src/store.cjs')),{Launcher}=require(path.join(source,'src/local-library-launcher.cjs'));
const Discovery=require('../../paddock-local-discovery'),Launch=require('../../paddock-local-launch');
const previous=process.env.LOCALAPPDATA;process.env.LOCALAPPDATA=path.join(isolated,'local-app-data');
const folder=Discovery.directory(),store=new Store(path.join(profile,'database.json'));store.persist(store.data);
const registration=new Launcher({folder,profile,command:{executable:require(path.join(source,'node_modules/electron')),args:[source]}});
let pid,p;const timer=setTimeout(()=>{console.error('Background qualification timed out');process.exitCode=1;},45000);timer.unref();
(async()=>{
 await require(path.join(source,'src/local-library-security.cjs')).secureDirectory(folder);await registration.prepare();registration.publish(store);
 p=new(require('../../paddock').Paddock)(new(require('../../db'))(path.join(isolated,'timing.json')));
 p.localScan=()=>Discovery.scan({folder});p.launcherScan=()=>Launch.scan({folder:path.join(folder,'launchers')});p.localLaunch=async value=>{pid=await Launch.launch(value);};
 await p.startSharedLibrary();assert(p.connected,p.error);assert(pid,'used the registered command');
 assert.equal((await p.connection()).connection.databaseId,store.data.id);
 const opened=await p.sharedCar();const saved=await p.sharedSave({databaseId:opened.schema.databaseId,recoveryId:opened.schema.recoveryId,action:'create',set:{name:'Background startup test'}});assert.equal(saved.state,'committed',saved.error);
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,isolated,pid,checks:['protected registration discovery','actual hidden Paddock startup','verified instance and database identity','direct shared write through the started host']},null,2));
 console.log('Native local-library startup passed.');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 clearTimeout(timer);p?.stop();await p?.idle();
 if(pid){try{if(process.platform==='win32')execFileSync('taskkill',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'pipe'});else process.kill(pid,'SIGTERM');}catch(e){if(e.code!=='ESRCH')console.error('Test process cleanup:',e.message);}}
 if(previous===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=previous;
});
