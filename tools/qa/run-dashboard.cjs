const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const out=path.resolve(__dirname,'../../../outputs/sqlite-conversion/dashboard-ui');fs.mkdirSync(out,{recursive:true});
const fd=fs.openSync(path.join(out,'launcher.log'),'w'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
let result;try{result=spawnSync(require('electron'),[path.join(__dirname,'dashboard-electron.cjs')],{env,stdio:['ignore',fd,fd],windowsHide:true,timeout:120000});}finally{fs.closeSync(fd);}
if(result.error)console.error(result.error);console.log('Dashboard Electron exit: '+result.status+'; diagnostics: '+out);process.exitCode=result.status??1;
