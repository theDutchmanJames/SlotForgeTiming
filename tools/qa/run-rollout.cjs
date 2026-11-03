const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/rollout-ui');fs.mkdirSync(out,{recursive:true});
function launch(base,stage){
 const fd=fs.openSync(path.join(base,stage+'-launcher.log'),'w'),env={...process.env,SF_ROLLOUT_QA:base,SF_ROLLOUT_STAGE:stage};delete env.ELECTRON_RUN_AS_NODE;let result;
 try{result=spawnSync(require('electron'),[path.join(__dirname,'rollout-electron.cjs'),...(process.platform==='linux'&&process.env.CI?['--no-sandbox']:[])],{env,stdio:['ignore',fd,fd],windowsHide:true,timeout:75000});}finally{fs.closeSync(fd);}
 if(result.error||result.status!==0)throw result.error||Error(stage+' exited '+result.status+'; evidence: '+base);
 assert(fs.readFileSync(path.join(base,stage+'.log'),'utf8').includes('ROLLOUT '+stage+' PASS'));
}
const fresh=fs.mkdtempSync(path.join(out,'fresh-'));fs.mkdirSync(path.join(fresh,'appdata'));launch(fresh,'fresh');launch(fresh,'reopen');assert(!fs.existsSync(path.join(fresh,'appdata','slotforge-timing','slotforge-timing.json')));
const existing=fs.mkdtempSync(path.join(out,'existing-')),p=path.join(existing,'appdata','slotforge-timing');fs.mkdirSync(p,{recursive:true});const db=new(require('../../db'))(path.join(p,'slotforge-timing.json'));db.data.drivers=[{id:'original',name:'Original JSON driver'}];db.saveNow();const bytes=fs.readFileSync(db.file);
launch(existing,'later');launch(existing,'deferred');fs.unlinkSync(path.join(p,'storage-conversion-prompt.json'));launch(existing,'keep');launch(existing,'deferred');fs.unlinkSync(path.join(p,'storage-conversion-prompt.json'));launch(existing,'convert');launch(existing,'converted');assert.deepEqual(fs.readFileSync(db.file),bytes);
console.log('FRESH / REOPEN / REMIND / KEEP / CONVERT PASS: '+fresh+' ; '+existing);
