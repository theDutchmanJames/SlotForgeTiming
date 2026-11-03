'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process'),{randomUUID}=require('node:crypto');
// Single-process app checks must finish their assertions; exit zero alone is not proof.
module.exports=function run(script,out,timeout=120000){
 fs.mkdirSync(out,{recursive:true});
 const runId=randomUUID(),completion=path.join(out,'completion.json');
 const env={...process.env,SF_UI_QA_RUN_ID:runId,SF_UI_QA_COMPLETION:completion};delete env.ELECTRON_RUN_AS_NODE;
 const fd=fs.openSync(path.join(out,'launcher.log'),'w');let result;
 try{result=spawnSync(require('electron'),[path.resolve(__dirname,script),...(process.platform==='linux'&&process.env.CI?['--no-sandbox']:[])],{env,stdio:['ignore',fd,fd],windowsHide:true,timeout});}finally{fs.closeSync(fd);}
 if(result.error)throw result.error;
 require('./qa-completion.cjs').verify(completion,runId,result.status);
 console.log(script+' completed; evidence: '+out);
};
