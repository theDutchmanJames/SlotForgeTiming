'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const gatePath=require.resolve('../paddock-rich-gate');
// A test-process preload is inherited by real SQLite workers. This exercises
// both compiled release states without a production environment/IPC override.
for(const enabled of [false,true])test(`activation ${enabled}: JSON and SQLite worker compatibility matrix`,t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-activation-'));
 const before=fs.readFileSync(gatePath),preload=path.join(root,'gate.cjs');
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 try{
  const source=before.toString();assert.equal((source.match(/const VERIFIED = (?:false|true);/g)||[]).length,1);
  fs.writeFileSync(preload,`const Module=require('node:module'),p=${JSON.stringify(gatePath)},m=new Module(p);m.filename=p;m.paths=Module._nodeModulePaths(require('node:path').dirname(p));m._compile(${JSON.stringify(source.replace(/const VERIFIED = (?:false|true);/,`const VERIFIED = ${enabled};`))},p);m.loaded=true;require.cache[p]=m;`);
  execFileSync(process.execPath,['--require',preload,path.join(__dirname,'support/paddock-activation.cjs'),root,String(enabled)],{env,encoding:'utf8',timeout:90000,windowsHide:true,stdio:'pipe'});
  if(enabled){
   const output=execFileSync(process.execPath,['--require',preload,'--test','--test-reporter=tap',path.join(__dirname,'paddock-rich-delivery.test.js'),path.join(__dirname,'paddock-historical-approval.test.js')],{env,encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024,windowsHide:true,stdio:'pipe'});
   assert(Number(output.match(/^# tests (\d+)$/m)?.[1])>=37,'Require completed child tests, not merely a successful process exit');
   assert.match(output,/^# fail 0$/m);
   t.diagnostic('Enabled-gate delivery and historical-approval regression suites also passed.');
   t.diagnostic(output.split(/\r?\n/).filter(line=>/^(?:#|ℹ) (?:tests|pass|fail|skipped) /.test(line)).join('; '));
   assert(!/not ok /m.test(output));
   const host=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../..','SlotForge Slotcar Database');
   if(fs.existsSync(path.join(host,'src/rich-history-gate.cjs'))){
    const hostGates=['rich-history-gate.cjs','historical-approval-gate.cjs'].map(name=>path.join(host,'src',name));
    const original=hostGates.map(file=>fs.readFileSync(file)),hostPreload=path.join(root,'host-gates.cjs');
    fs.writeFileSync(hostPreload,hostGates.map((file,i)=>{
     const code=original[i].toString();assert.equal((code.match(/const VERIFIED = (?:false|true);/g)||[]).length,1);
     return `{const Module=require('node:module'),p=${JSON.stringify(file)},m=new Module(p);m.filename=p;m.paths=Module._nodeModulePaths(require('node:path').dirname(p));m._compile(${JSON.stringify(code.replace(/const VERIFIED = (?:false|true);/,'const VERIFIED = true;'))},p);m.loaded=true;require.cache[p]=m;}`;
    }).join('\n'));
    try{
     const result=execFileSync(process.execPath,['--require',preload,'--require',hostPreload,'--test','--test-reporter=tap',path.join(__dirname,'paddock-rich-history.test.js'),path.join(__dirname,'paddock-rich-mapper.test.js')],{env,encoding:'utf8',timeout:90000,maxBuffer:8*1024*1024,windowsHide:true,stdio:'pipe'});
     assert(Number(result.match(/^# tests (\d+)$/m)?.[1])>=25);assert.match(result,/^# fail 0$/m);assert.match(result,/^# skipped 0$/m);
     t.diagnostic('Both host gates enabled in isolated processes: 25 mapping/read tests passed; no host source changed.');
    }finally{hostGates.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),original[i]));}
   }
  }
 }finally{assert.deepEqual(fs.readFileSync(gatePath),before);fs.rmSync(root,{recursive:true,force:true});}
});
