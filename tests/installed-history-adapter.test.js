'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {isolateBootstrap,strictVerification}=require('../tools/qa/installed-history-adapter.cjs');
test('packaged QA protections apply once to original and already-protected bootstrap',()=>{
 const old='app.disableHardwareAcceleration();\nmainWindow=win;win.setSize(1280,1000);';
 const fixed=isolateBootstrap(old);assert.equal(isolateBootstrap(fixed),fixed);
 assert(fixed.indexOf('app.setAsDefaultProtocolClient=()=>false;')<fixed.indexOf('app.disableHardwareAcceleration();'));
 assert.equal((fixed.match(/BrowserWindow.prototype.showInactive.call/g)||[]).length,1);
 assert.throws(()=>isolateBootstrap('unknown bootstrap'),/Unknown/);
});
test('package verification rejects candidate exceptions in both published formats',()=>{
 for(const prefix of ['', 'allowCandidate&&']){
  const code=`if(gates.includes(file))check();\n else if(${prefix}role==='timing'&&file==='sqlite-paddock.js')candidate();\n else throw Error('Unexpected change');`;
  const fixed=strictVerification(code);assert(!fixed.includes('candidate()'));assert(fixed.includes("else throw Error('Unexpected change')"));
 }
 assert.throws(()=>strictVerification('different implementation'),/review/);
});
const source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../SlotForge Slotcar Database');
test('current published Paddock harness remains compatible',{skip:!fs.existsSync(path.join(source,'tests/support/installed-history-bootstrap.cjs'))},()=>{
 const boot=isolateBootstrap(fs.readFileSync(path.join(source,'tests/support/installed-history-bootstrap.cjs'),'utf8'));
 assert.equal(isolateBootstrap(boot),boot);
 const verify=strictVerification(fs.readFileSync(path.join(source,'scripts/verify-installed-history.cjs'),'utf8'));
 assert(!verify.includes("file==='sqlite-paddock.js'"));
});
