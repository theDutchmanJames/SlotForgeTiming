const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const D=require('../db'),P=require('../contentpacks');
(async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sf-packipc-')),db=new D(path.join(tmp,'db.json')),handlers={};let racing=false;
 const sender={mainFrame:{}},win={webContents:sender,isDestroyed:()=>false},event={sender,senderFrame:sender.mainFrame};
 const pack={format:P.FORMAT,apiVersion:1,manifest:{id:'example.test',name:'Example',author:'Tester',license:'CC0',version:'1.0.0',minAppVersion:'1.99.2'},items:{chartdesigns:[{id:'chart',name:'Chart',style:'bars'}]}};
 const input=path.join(tmp,'input.slotforge-pack');fs.writeFileSync(input,JSON.stringify(pack));
 let choose=async()=>({canceled:false,filePaths:[input]});
 const store=require('../packipc').register({ipcMain:{handle:(k,v)=>handlers[k]=v},dialog:{showOpenDialog:()=>choose(),showSaveDialog:async()=>({canceled:true})},BrowserWindow:{fromWebContents:()=>win},db,getMain:()=>win,isRacing:()=>racing,appVersion:'1.99.2'});
 const call=(name,...args)=>handlers['packs:'+name](event,...args);
 await assert.rejects(()=>handlers['packs:list']({sender:{}}),/main app/);await assert.rejects(()=>handlers['packs:list']({sender,senderFrame:{}}),/main app/);
 await assert.rejects(()=>call('install'),/review/);await call('open');assert.equal(store.list().packs.length,0);await call('install');assert.equal(store.list().packs.length,1);
 racing=true;for(const name of ['open','install','enable','remove','rollback','disableAll','recover','copy','theme','create','export'])await assert.rejects(()=>call(name,'example.test'),/Finish the race/);
 assert.equal((await call('list')).raceLocked,true);racing=false;await call('copy','example.test');assert.equal(db.list('chartdesigns').length,1);
 // Race starts while the native file chooser is open: recheck after it returns.
 choose=async()=>{racing=true;return {filePaths:[input]};};await assert.rejects(()=>call('open'),/Finish/);racing=false;await assert.rejects(()=>call('install'),/review/);
 // A failed read cannot leave an older pending file installable.
 choose=async()=>({filePaths:[input]});await call('open');fs.writeFileSync(input,'invalid');await assert.rejects(()=>call('open'),/readable/);await assert.rejects(()=>call('install'),/review/);
 await call('remove','example.test');assert.equal(db.list('chartdesigns').length,1);
 console.log('PACK IPC PASSED: owner/frame validation, staged review, race locks, dialog race, stale pending files and independent imported copies.');
})().catch(e=>{console.error(e);process.exitCode=1;});
