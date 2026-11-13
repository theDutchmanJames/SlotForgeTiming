'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),vm=require('node:vm'),fs=require('node:fs');
test('thumbnail bridge accepts only the main window and rejects interrupted jobs',async()=>{
 const ipcMain=new EventEmitter(),wc=new EventEmitter();wc.mainFrame={};const sent=[];wc.send=(...args)=>sent.push(args);
 const win={isDestroyed:()=>false,webContents:wc},event={sender:wc,senderFrame:wc.mainFrame};
 const encode=require('../shared-thumbnail-encoder')({ipcMain,getMain:()=>win});
 await assert.rejects(encode('photo'),/not ready/);
 ipcMain.emit('library:thumbnail-ready',event);const first=encode('original');const id=sent[0][1].id;
 ipcMain.emit('library:thumbnail-result',{sender:{},senderFrame:{}},id,'wrong');
 ipcMain.emit('library:thumbnail-result',event,id,'preview');assert.equal(await first,'preview');
 const interrupted=encode('photo');wc.emit('did-start-navigation',{},'file:///app',false,true);await assert.rejects(interrupted,/interrupted/);
 await assert.rejects(encode('photo'),/not ready/);ipcMain.emit('library:thumbnail-ready',event);
 const afterReload=encode('photo');wc.emit('render-process-gone');await assert.rejects(afterReload,/interrupted/);assert.equal(wc.listenerCount('render-process-gone'),1);
});
function manager(){
 const text=fs.readFileSync(require.resolve('../renderer/database.js'),'utf8');
 const source=text.slice(text.indexOf('const managerLoads='),text.indexOf('async function mountManagerPage'));
 const jobs=[],context=vm.createContext({subRun:0,esc:x=>String(x),mountManagerPage:()=>{context.subRun++;return new Promise((resolve,reject)=>jobs.push({resolve,reject}));}});
 vm.runInContext(source,context);return {context,jobs,mount:context.mountManager};
}
test('catalogue loading coalesces repeat requests and offers a working retry after failure',async()=>{
 const {mount,jobs}=manager(),box={isConnected:true};const a=mount(box,'slotcars'),b=mount(box,'slotcars');assert.equal(a,b);assert.equal(jobs.length,1);
 jobs[0].reject(Error('Unavailable'));await a;assert.match(box.innerHTML,/Unavailable/);assert.match(box.innerHTML,/Retry/);
 box.onclick({target:{closest:()=>true}});assert.equal(jobs.length,2);jobs[1].resolve();await new Promise(r=>setImmediate(r));
});
test('a failed obsolete catalogue request cannot replace a newly selected tab',async()=>{
 const {mount,jobs}=manager(),box={isConnected:true,innerHTML:'new tab'};const old=mount(box,'slotcars'),next=mount(box,'drivers');
 jobs[0].reject(Error('obsolete'));await old;assert.equal(box.innerHTML,'new tab');jobs[1].resolve();await next;
});
