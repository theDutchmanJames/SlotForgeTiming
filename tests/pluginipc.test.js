const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),P=require('../pluginpackage');
const root=path.resolve(__dirname,'../.tmp-test/plugins-ipc-'+process.pid);fs.mkdirSync(root,{recursive:true});
const file=path.join(root,'example.slotforge-plugin'),pack={format:P.FORMAT,apiVersion:1,manifest:{id:'test.ipc',name:'IPC',version:'1.0.0',author:'Tests',license:'MIT',minAppVersion:'1.99.2',runtime:'node'},entry:'index.cjs',files:{'index.cjs':Buffer.from('module.exports={};').toString('base64')}};fs.writeFileSync(file,JSON.stringify(pack));
const handlers={},frame={},sender={mainFrame:frame},event={sender,senderFrame:frame},win={webContents:sender,isDestroyed:()=>false};let racing=false,launched=0,dialogRace=false;
const runtime=require('../pluginipc').register({ipcMain:{handle:(n,f)=>handlers[n]=f},dialog:{showOpenDialog:async()=>{if(dialogRace)racing=true;return {filePaths:[file]};}},BrowserWindow:{fromWebContents:()=>win},app:{},getMain:()=>win,isRacing:()=>racing,appVersion:'1.99.2',root,launch:()=>{launched++;throw Error('Launch stub');}});
const call=(n,...a)=>handlers['plugins:'+n](event,...a);
(async()=>{try{
 await assert.rejects(()=>handlers['plugins:list']({sender:{},senderFrame:frame}));await assert.rejects(()=>handlers['plugins:list']({sender,senderFrame:{}}));
 await assert.rejects(()=>call('install'),/review/);const reviewed=await call('open');assert.equal(launched,0);await call('install');assert.equal(launched,0);
 await assert.rejects(()=>call('open'),/newer version/);await assert.rejects(()=>call('install'),/review/);
 await assert.rejects(()=>call('start','test.ipc',reviewed.digest,false),/trust/);await assert.rejects(()=>call('start','test.ipc','wrong',true),/changed/);assert.equal(launched,0);
 racing=true;for(const action of ['open','install','start','stop','rollback','remove','disableAll','restartSafe','settings','command','displayTool','rulePrepare'])await assert.rejects(()=>call(action),/Finish the race/);assert.equal((await call('list')).raceLocked,true);
 racing=false;dialogRace=true;await assert.rejects(()=>call('open'),/Finish the race/);racing=false;dialogRace=false;await assert.rejects(()=>call('install'),/review/);
 await assert.rejects(()=>call('start','test.ipc',reviewed.digest,true),/Launch stub/);assert.equal(launched,1);assert.equal((await call('list')).plugins[0].enabled,false);
 await call('remove','test.ipc',false);assert.equal((await call('list')).plugins.length,0);
 console.log('PLUGIN IPC PASSED: main-frame ownership, staging, explicit fingerprint trust, race locks, dialog race and launch failure.');
}finally{await runtime.shutdown();}})().catch(e=>{console.error(e);process.exitCode=1;});
