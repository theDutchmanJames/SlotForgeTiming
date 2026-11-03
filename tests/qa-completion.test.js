'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {preventRelaunch,verify}=require('../tools/qa/qa-completion.cjs');
test('single-process QA blocks relaunch before a child can be scheduled',()=>{let called=false;const app={relaunch(){called=true;}};preventRelaunch(app);assert.throws(()=>app.relaunch(),/Unexpected app relaunch/);assert.equal(called,false);});
test('zero exit alone and stale completion files cannot pass a QA run',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-qa-completion-')),file=path.join(dir,'done.json');t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 assert.throws(()=>verify(file,'current',0),/without a completed/);fs.writeFileSync(file,JSON.stringify({passed:true,runId:'old'}));assert.throws(()=>verify(file,'current',0),/another run/);fs.writeFileSync(file,JSON.stringify({passed:true,runId:'current'}));assert.throws(()=>verify(file,'current',1),/not exit successfully/);assert.equal(verify(file,'current',0).passed,true);
});
test('completion is written only for an explicitly identified launcher run',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-qa-complete-')),file=path.join(dir,'completion.json');
 const priorId=process.env.SF_UI_QA_RUN_ID,priorFile=process.env.SF_UI_QA_COMPLETION;
 t.after(()=>{for(const [key,value] of [['SF_UI_QA_RUN_ID',priorId],['SF_UI_QA_COMPLETION',priorFile]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}fs.rmSync(dir,{recursive:true,force:true});});
 delete process.env.SF_UI_QA_RUN_ID;delete process.env.SF_UI_QA_COMPLETION;
 assert.throws(()=>require('../tools/qa/qa-completion.cjs').complete(),/launcher/);
 process.env.SF_UI_QA_RUN_ID='this-run';process.env.SF_UI_QA_COMPLETION=file;
 require('../tools/qa/qa-completion.cjs').complete();assert.equal(verify(file,'this-run',0).passed,true);
});
