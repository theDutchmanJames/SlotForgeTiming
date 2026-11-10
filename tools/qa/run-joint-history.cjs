'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{randomUUID}=require('node:crypto');
const out=path.resolve(__dirname,'../../../outputs/joint-history'),source=process.env.SLOTFORGE_PADDOCK_SOURCE||path.resolve(__dirname,'../../../../SlotForge Slotcar Database');
fs.mkdirSync(out,{recursive:true});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const gates=[path.resolve(__dirname,'../../paddock-rich-gate.js'),path.join(source,'src/rich-history-gate.cjs'),path.join(source,'src/historical-approval-gate.cjs')];
const originals=gates.map(file=>{const value=fs.readFileSync(file);assert(value.toString().includes('const VERIFIED = false;'));return value;});
const active=new Set();
function launch(role,root,backend){
 const env={...process.env,SF_UI_QA_RUN_ID:randomUUID()};delete env.ELECTRON_RUN_AS_NODE;
 const fd=fs.openSync(path.join(root,role+'-launcher.log'),'a');
 const electron=role==='paddock'?require(path.join(source,'node_modules/electron')):require('electron');
 const child=spawn(electron,[path.join(__dirname,'joint-history-app.cjs'),role,root,backend,source],{env,stdio:['ignore',fd,fd,'ipc'],windowsHide:true});fs.closeSync(fd);active.add(child);
 let number=0;const pending=new Map();let readyResolve,readyReject;
 const ready=new Promise((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});
 const startupTimer=setTimeout(()=>{readyReject(Error(role+' startup timed out'));child.kill();},60000);
 child.on('message',m=>{if(m.ready){clearTimeout(startupTimer);return readyResolve();}const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.value);}});
 const exited=new Promise(resolve=>child.on('exit',(code,signal)=>{clearTimeout(startupTimer);active.delete(child);const error=Error(role+' exited: '+code+'/'+signal);readyReject(error);for(const p of pending.values()){clearTimeout(p.timer);p.reject(error);}pending.clear();resolve({code,signal});}));
 child.on('error',readyReject);
 function request(action,extra={}){return new Promise((resolve,reject)=>{const id=++number,timer=setTimeout(()=>{pending.delete(id);reject(Error(role+' command timed out: '+action));},30000);pending.set(id,{resolve,reject,timer});child.send({id,action,...extra});});}
 return {ready,run:code=>request('eval',{code}),shot:name=>request('screenshot',{name}),async quit(){child.send({action:'quit'});const timer=setTimeout(()=>child.kill(),15000);const result=await exited;clearTimeout(timer);assert.equal(result.code,0,role+' orderly shutdown');}};
}
async function until(app,condition){for(let i=0;i<250;i++){if(await app.run('return '+condition))return;await delay(80);}await app.shot('failure');throw Error('Timeout: '+condition+'; '+await app.run('return document.body.innerText.slice(-2500)'));}
async function idle(app){await until(app,'!(await api.paddockStatus()).busy');}
async function results(app){await idle(app);await app.run("state.tab='database';state.sub='results';state.resultsSub='racing';await render();");await until(app,'!!document.querySelector("[data-historical-review] details")');}
async function submit(app,name,laps){
 await idle(app);
 const saved=await app.run(`return api.saveSession({setupName:${JSON.stringify(name)},sessionType:'race',date:'2020-04-12',trackId:'old-track',trackName:'Original club circuit',standings:[{carId:'old-car',driverId:'old-driver',driverName:'Historic driver',carName:'Original car',pos:1,laps:${laps},total:${laps*8500},best:8500}]},Array.from({length:${laps}},(_,i)=>({carId:'old-car',driverId:'old-driver',driverName:'Historic driver',trackId:'old-track',lane:1,heat:1,lapNumber:i+1,time:8500,valid:true,pit:false})));`);
 await results(app);
 await app.run(`window.qaCard=[...document.querySelectorAll('details.sess')].find(x=>x.textContent.includes(${JSON.stringify(name)}));qaCard.querySelector('[data-history-open]').click();`);
 await until(app,'!!document.querySelector("[data-historical-session]")');await idle(app);
 await app.run('document.querySelector("[data-historical-session]").click()');
 await until(app,'!!document.querySelector("[data-historical-submit]")');
 assert(await app.run('return document.querySelector(".historical-dialog").textContent.includes("Received is not accepted")'));
 await app.run('document.querySelector("[data-historical-submit]").click()');
 await until(app,'document.querySelector(".historical-dialog")?.textContent.includes("Pending review — not accepted")');
 await app.shot('pending');await app.run('document.querySelector("[data-historical-close]").click()');
 return saved;
}
async function review(app,name){
 await app.run("await loadView();openReview('Historical imports');");
 await until(app,`[...document.querySelectorAll('[data-action="history-import-inspect"]')].some(b=>b.closest('.panel')?.textContent.includes(${JSON.stringify(name)}))`);
 await app.run(`const button=[...document.querySelectorAll('[data-action="history-import-inspect"]')].find(b=>b.closest('.panel')?.textContent.includes(${JSON.stringify(name)}));button.click();`);
 await until(app,'!!document.querySelector("[data-action=history-evidence-approve]")');
}
async function run(backend){
 const root=fs.mkdtempSync(path.join(out,backend+'-'));fs.writeFileSync(path.join(root,'qualification.json'),JSON.stringify({backend,synthetic:true}));
 console.log(backend+': opening two isolated desktop apps');
 let paddock=launch('paddock',root,backend);await paddock.ready;await until(paddock,"typeof db!=='undefined'&&!!db?.id");
 let timing=launch('timing',root,backend);await timing.ready;await until(timing,'!!state.schema.slotcars');assert.equal(await timing.run('return (await api.storageStatus()).backend'),backend);
 await until(timing,'(await api.paddockStatus()).connected');
 const session=await submit(timing,'Joint approval '+backend,1800);
 const original=await timing.run(`const v=await api.historySession('racing',${JSON.stringify(session)},{exportAll:true});return {session:v.session,laps:v.laps};`);
 assert.equal(original.laps.length,1800);
 await idle(timing);assert.equal(await timing.run("return (await api.paddockHistory({kind:'list'})).value.results.length"),0);
 await review(paddock,'Joint approval '+backend);
 await paddock.shot('owner-review');
 // Lose only the renderer acknowledgement after its real IPC and worker commit.
 await paddock.run("globalThis.originalApi=api;api=async(...args)=>{const result=await originalApi(...args);if(args[0]==='historyImport'&&args[1].action==='approve'&&!globalThis.lost){globalThis.lost=true;throw Error('Qualification lost reply');}return result;};");
 await paddock.run("document.querySelector('[data-action=history-evidence-approve]').click()");
 await until(paddock,"document.querySelector('#dialog').textContent.includes('Qualification lost reply')");
 assert(await paddock.run("return document.querySelector('#history-reject-note').disabled"));
 await paddock.run("document.querySelector('[data-action=history-evidence-approve]').click()");
 await until(paddock,"!document.querySelector('#dialog').open");
 await paddock.shot('approved-inbox');
 assert.deepEqual(await paddock.run('return qaErrors'),[]);assert.deepEqual(await timing.run('return qaErrors'),[]);
 console.log(backend+': restarting both apps with the durable decision');
 await timing.quit();await paddock.quit();
 paddock=launch('paddock',root,backend);await paddock.ready;await until(paddock,"typeof db!=='undefined'&&!!db?.id");
 timing=launch('timing',root,backend);await timing.ready;await until(timing,'!!state.schema.slotcars');await until(timing,'(await api.paddockStatus()).connected');await results(timing);
 await idle(timing);
 await timing.run("document.querySelector('[data-historical-review] details').open=true;document.querySelector('[data-review-refresh]')?.click()");
 await until(timing,"document.querySelector('[data-historical-review]').textContent.includes('original acceptance confirmed')");
 assert(await timing.run("return !document.querySelector('[data-review-cancel]')"));await timing.shot('approved');
 await idle(timing);await timing.run("document.querySelector('[data-central-refresh]').click()");await until(timing,'document.querySelectorAll(".central-session").length===1');
 await idle(timing);await timing.run("document.querySelector('.central-session').open=true");await until(timing,'!!document.querySelector("[data-central-laps] table")');
 assert(await timing.run("return document.querySelector('.central-session').textContent.includes('Accepted historical evidence')"));await timing.shot('central-history');
 // Reject a second item through the owner dialog, cancel a third from Timing.
 await submit(timing,'Joint reject '+backend,3);await review(paddock,'Joint reject '+backend);
 await paddock.run("document.querySelector('#history-reject-note').value='Rejected in joint test';document.querySelector('#dialog button[type=submit]').click()");await until(paddock,"!document.querySelector('#dialog').open");
 await idle(timing);await timing.run("document.querySelector('[data-review-refresh]').click()");await until(timing,"document.querySelector('[data-historical-review]').textContent.includes('Rejected — not accepted')");
 await submit(timing,'Joint cancel '+backend,2);await idle(timing);await timing.run("document.querySelector('[data-review-cancel]').click()");await until(timing,"document.querySelector('[data-historical-review]').textContent.includes('Cancelled — not accepted')");
 const statuses=await timing.run("return (await api.paddockHistoricalReview({action:'list'})).map(r=>({state:r.state,status:r.items[0].status}))");assert.deepEqual(statuses.map(x=>x.status).sort(),['approved','cancelled','rejected']);assert(statuses.every(x=>x.state==='complete'));
 assert.equal(await timing.run("return (await api.historyPage('racing',{})).sessions.items.length"),3);
 await idle(timing);await timing.run("document.querySelector('[data-central-refresh]').click()");await until(timing,'document.querySelectorAll(".central-session").length===1');
 await timing.shot('decisions');
 assert.deepEqual(await timing.run(`const v=await api.historySession('racing',${JSON.stringify(session)},{exportAll:true});return {session:v.session,laps:v.laps};`),original);
 assert.deepEqual(await paddock.run('return qaErrors'),[]);
 // Explicitly disconnect before stopping the host so automatic service startup
 // cannot launch an uninstrumented app outside this two-process test.
 await idle(timing);await timing.run('await api.paddockDisconnect(false)');await paddock.quit();
 await timing.run("document.querySelector('[data-central-refresh]').click()");await until(timing,"document.querySelector('.central-history').textContent.includes('Cached copy')");
 assert.equal(await timing.run("return document.querySelectorAll('.central-session').length"),1);await timing.shot('offline-history');
 assert.deepEqual(await timing.run('return qaErrors'),[]);await timing.quit();
 if(backend==='sqlite')assert.deepEqual(fs.readFileSync(path.join(root,'timing-appdata/slotforge-timing/slotforge-timing.json')),fs.readFileSync(path.join(root,'timing-original.json')));
 const result={passed:true,backend,root,session,statuses,checks:['two independent desktop apps and normal startup','real local discovery and HTTP','1800-lap resumable submission','pending evidence excludes central history','owner Review IPC and actual worker','lost owner acknowledgement and retry','restart both apps before polling','approved receipt plus central lap reads','owner rejection and Timing cancellation','three local sessions, one accepted central session','original session and every lap unchanged','offline accepted history cache','no renderer errors',...(backend==='sqlite'?['original SQLite migration JSON preserved']:[])]};
 fs.writeFileSync(path.join(root,'result.json'),JSON.stringify(result,null,2));console.log(backend+': passed');return result;
}
(async()=>{
 try{const results=[];for(const backend of ['json','sqlite'])results.push(await run(backend));gates.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),originals[i]));fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({passed:true,gatesDisabled:true,results},null,2));}
 finally{for(const child of active)child.kill();gates.forEach((file,i)=>assert.deepEqual(fs.readFileSync(file),originals[i]));}
})().catch(e=>{console.error(e);process.exitCode=1;});
