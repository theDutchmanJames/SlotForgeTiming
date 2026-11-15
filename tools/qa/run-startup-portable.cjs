'use strict';
// Build a test-only launcher. The QA entry redirects all data before requiring
// the unchanged production main.js. Never run a normal package on a real profile.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),{randomUUID}=require('node:crypto');
const root=path.resolve(__dirname,'../..'),out=path.resolve(root,'../outputs/startup-feedback/portable'),pkg=require('../../package.json');
async function main(){
 if(process.platform!=='win32')throw Error('This checks the Windows portable launcher.');
 fs.mkdirSync(out,{recursive:true});
 const {build,Platform}=require('electron-builder');
 await build({projectDir:root,targets:Platform.WINDOWS.createTarget(['portable']),publish:'never',config:{
  extraMetadata:{main:'tools/qa/startup-electron.cjs'},
  files:[...pkg.build.files,'tools/qa/startup-electron.cjs','tools/qa/qa-completion.cjs','tools/qa/file-diagnostics.cjs'],
  directories:{output:path.join(out,'package')},electronDist:path.join(root,'node_modules/electron/dist'),npmRebuild:false,
  portable:{...pkg.build.portable,artifactName:'Timing-Startup-QA.exe'}
 }});
 for(const [mode,executable] of [['portable','package/Timing-Startup-QA.exe'],['installed-payload','package/win-unpacked/SlotForge Timing.exe']]){
  const evidence=path.join(out,mode);fs.mkdirSync(evidence,{recursive:true});
  const runId=randomUUID(),completion=path.join(evidence,'completion.json'),env={...process.env,SF_STARTUP_QA_MODE:mode,SF_STARTUP_QA_OUTPUT:evidence,SF_UI_QA_RUN_ID:runId,SF_UI_QA_COMPLETION:completion};
  delete env.ELECTRON_RUN_AS_NODE;delete env.SF_STARTUP_QA_APP_ROOT;
  const fd=fs.openSync(path.join(evidence,'launcher.log'),'w');let result;
  try{result=cp.spawnSync(path.join(out,executable),[],{env,stdio:['ignore',fd,fd],windowsHide:false,timeout:90000});}finally{fs.closeSync(fd);}
  if(result.error)throw result.error;
  require('./qa-completion.cjs').verify(completion,runId,result.status);console.log(mode+' STARTUP PASSED: '+evidence);
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
