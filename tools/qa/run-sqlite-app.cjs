const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/app-ui');fs.mkdirSync(out,{recursive:true});const base=fs.mkdtempSync(path.join(out,'run-'));
const D=require('../../db'),db=new D(path.join(base,'source.json'));db.saveNow();const files=[db.file,db.settingsPath].filter(p=>fs.existsSync(p)).map(p=>[p,fs.readFileSync(p)]);
const profile=path.join(base,'sqlite-profile');fs.mkdirSync(profile);fs.writeFileSync(path.join(profile,'sqlite-test-profile.json'),JSON.stringify({format:require('../../sqlite-runtime').FORMAT,version:1}));
require('../../sqlite-migration').migrateCopy({source:db.file,destination:path.join(base,'copy')});require('../../sqlite-working').forkCopy(path.join(base,'copy'),path.join(profile,'working'));
const env={...process.env,SF_SQLITE_QA_ROOT:base};delete env.ELECTRON_RUN_AS_NODE;
for(const stage of ['write','resume','verify']){
 const fd=fs.openSync(path.join(base,stage+'-launcher.log'),'w');let result;
 try{result=spawnSync(require('electron'),[path.join(__dirname,'sqlite-app-electron.cjs'),'--sqlite-test-profile='+profile,...(process.platform==='linux'&&process.env.CI?['--no-sandbox']:[])],{env:{...env,SF_SQLITE_QA_STAGE:stage},stdio:['ignore',fd,fd],windowsHide:true,timeout:90000});}finally{fs.closeSync(fd);}
 if(result.error||result.status!==0){console.error(result.error||'Stage failed: '+stage);console.log(base);process.exit(1);}
 assert(fs.readFileSync(path.join(base,stage+'.log'),'utf8').includes('SQLITE APP '+stage+' PASS'));
}
for(const [file,bytes] of files)assert.deepEqual(fs.readFileSync(file),bytes);assert(!fs.existsSync(path.join(profile,'slotforge-timing.json')));
console.log('SQLITE COMPLETE APP STARTUP/REOPEN PASS: '+base);
