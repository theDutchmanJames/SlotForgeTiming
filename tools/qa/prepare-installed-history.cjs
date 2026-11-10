'use strict';
// Reuse Paddock's published packaged acceptance drivers in a new Timing-owned
// evidence directory. Never overwrite its prior qualification or either profile.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const timing=path.resolve(__dirname,'../..'),paddock=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(timing,'../../SlotForge Slotcar Database');
const out=path.resolve(timing,'../outputs');
const parent=fs.mkdtempSync(path.join(out,'installed-activation-')),root=path.join(parent,'.qa/installed-history'),scripts=path.join(parent,'scripts');
fs.mkdirSync(root,{recursive:true});fs.mkdirSync(scripts);
fs.writeFileSync(path.join(out,'installed-activation-latest.json'),JSON.stringify({parent,root,scripts}));
const {build,Platform}=require('electron-builder');
function replace(text,before,after){assert(text.includes(before),'Published qualification driver changed: '+before);return text.replace(before,after);}
async function main(){
 for(const [role,projectDir]of [['paddock',paddock],['timing',timing]]){
  await build({projectDir,targets:Platform.WINDOWS.createTarget('dir'),config:{directories:{output:path.join(root,role)},electronDist:path.join(projectDir,'node_modules/electron/dist'),npmRebuild:false,win:{signAndEditExecutable:false}},publish:'never'});
 }
 const bootstrap=path.join(parent,'installed-history-bootstrap.cjs');
 let boot=fs.readFileSync(path.join(paddock,'tests/support/installed-history-bootstrap.cjs'),'utf8');
 // A packaged Paddock normally registers its URL protocol. A disposable test
 // executable must never become the user's Windows handler.
 boot=require('./installed-history-adapter.cjs').isolateBootstrap(boot);
 // Hidden Chromium windows can return an old compositor frame despite correct
 // DOM assertions. Paint without taking focus before recording visual evidence.
 // Fault injection only: drop an actual successful first-chunk response. The
 // runner kills this disposable Timing process before its request can time out.
 boot=replace(boot,"const timer=setInterval",`const http=require('node:http'),originalEmit=http.ClientRequest.prototype.emit;let interruptUpload=false,uploadInterrupted=null;const uploadRequests=[];
http.ClientRequest.prototype.emit=function(event,...args){
 if(role==='timing'&&event==='response'&&/\\/shared-history\\/uploads\\/[^/]+\\/chunks\\/\\d+$/.test(this.path||'')){
  uploadRequests.push(this.path);
  if(interruptUpload&&/\\/chunks\\/0$/.test(this.path)&&args[0].statusCode===200){interruptUpload=false;uploadInterrupted={path:this.path,status:args[0].statusCode};args[0].resume();return true;}
 }
 return originalEmit.call(this,event,...args);
};
const timer=setInterval`);
 boot=replace(boot,"else if(cmd.action==='status')value={errors,packaged:app.isPackaged,profile:app.getPath('userData')};","else if(cmd.action==='arm-upload-interruption'){if(role!=='timing')throw Error('Timing only');interruptUpload=true;value=true;}else if(cmd.action==='status')value={errors,packaged:app.isPackaged,profile:app.getPath('userData'),uploadInterrupted,uploadRequests};");
 fs.writeFileSync(bootstrap,boot);
 for(const name of ['prepare-installed-history.cjs','qualify-installed-history.cjs','qualify-installed-recovery.cjs','qualify-installed-rich.cjs','verify-installed-history.cjs']){
  let code=fs.readFileSync(path.join(paddock,'scripts',name),'utf8');
  if(code.includes("path.resolve(__dirname,'../.qa/installed-history')"))code=replace(code,"path.resolve(__dirname,'../.qa/installed-history')",JSON.stringify(root));
  else assert(code.includes("require('./qualify-installed-history.cjs')"),'Expected imported qualification root');
  code=code.replace("require('@electron/asar')",`require(${JSON.stringify(require.resolve('@electron/asar'))})`);
  code=code.replace("require('../tests/support/timing-fixtures.cjs')",`require(${JSON.stringify(path.join(paddock,'tests/support/timing-fixtures.cjs'))})`);
  code=code.replace("require('../tests/fixtures/timing-production-mapper/race.json')",`require(${JSON.stringify(path.join(paddock,'tests/fixtures/timing-production-mapper/race.json'))})`);
  code=code.replaceAll("path.join(__dirname,'../tests/support/installed-history-bootstrap.cjs')",JSON.stringify(bootstrap));
  if(name==='verify-installed-history.cjs'){
   // The final production file must be identical; no candidate exception.
   code=require('./installed-history-adapter.cjs').strictVerification(code);
  }
  if(name==='qualify-installed-rich.cjs')code=code.replaceAll('Candidate preserves','Corrected source preserves').replaceAll('candidate-rich','source-rich').replace('Candidate Timing sqlite-paddock.js projection fix in QA package only; not original-client qualification or public activation','Corrected production Timing source; qualification-only copied gates and bootstrap; no candidate patch or public activation');
  fs.writeFileSync(path.join(scripts,name),code);
 }
 fs.copyFileSync(path.join(__dirname,'installed-history-extra.cjs'),path.join(scripts,'installed-history-extra.cjs'));
 fs.writeFileSync(path.join(parent,'source.json'),JSON.stringify({timing,paddock,bootstrap,root},null,2));
 console.log('Prepared fresh package drivers: '+scripts);
}
main().catch(error=>{console.error(error);process.exitCode=1;});
