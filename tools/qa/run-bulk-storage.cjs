const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/bulk-ui');fs.mkdirSync(out,{recursive:true});
const fd=fs.openSync(path.join(out,'launcher.log'),'w'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
env.SF_BULK_QA_RUN_ID=require('node:crypto').randomUUID();
let result;try{result=spawnSync(require('electron'),[path.join(__dirname,'bulk-storage-electron.cjs'),...(process.platform==='linux'&&process.env.CI?['--no-sandbox']:[])],{env,stdio:['ignore',fd,fd],windowsHide:true,timeout:90000});}finally{fs.closeSync(fd);}
if(result.error)console.error(result.error);
try{require('./qa-completion.cjs').verify(path.join(out,'completion.json'),env.SF_BULK_QA_RUN_ID,result.status);console.log('Bulk integration completed: '+out);}
catch(error){console.error(error.message);process.exitCode=1;}
