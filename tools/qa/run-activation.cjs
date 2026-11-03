const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/activation-ui');fs.mkdirSync(out,{recursive:true});const base=fs.mkdtempSync(path.join(out,'run-'));
const appData=path.join(base,'appdata'),profile=path.join(appData,'slotforge-timing');fs.mkdirSync(profile,{recursive:true});
const D=require('../../db'),db=new D(path.join(profile,'slotforge-timing.json'));db.saveNow();const original=fs.readFileSync(db.file);
const env={...process.env,SF_ACTIVATION_QA:base};delete env.ELECTRON_RUN_AS_NODE;
for(const stage of ['activate','race','finalize','verify','restored']){
 const fd=fs.openSync(path.join(base,stage+'-launcher.log'),'w');let result;
 try{result=spawnSync(require('electron'),[path.join(__dirname,'activation-electron.cjs'),...(process.platform==='linux'&&process.env.CI?['--no-sandbox']:[])],{env:{...env,SF_ACTIVATION_STAGE:stage},stdio:['ignore',fd,fd],windowsHide:true,timeout:75000});}finally{fs.closeSync(fd);}
 const expected=['race','finalize'].includes(stage)?73:0;
 if(result.error||result.status!==expected){console.log(base);throw result.error||Error(stage+' exited '+result.status);}
 assert(fs.readFileSync(path.join(base,stage+'.log'),'utf8').includes('ACTIVATION '+stage+' PASS'));
}
assert.deepEqual(fs.readFileSync(db.file),original);assert.equal(require('../../storage-activation').selected(profile).backend,'sqlite');
console.log('PRODUCTION ACTIVATION / ABRUPT EXIT / RESTORE PASS: '+base);
