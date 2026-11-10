'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../renderer/database.js'),'utf8');
const start=source.indexOf("    if (e === 'racesetups' && b.dataset.systemSetup"),end=source.indexOf('    if (b.dataset.rsf)',start);
function harness(update){
 const buttons=['fuel','weather'].map(key=>({disabled:false,dataset:{systemSetup:'race',systemKey:key,systemOn:'0'}}));
 const box={isConnected:true,querySelectorAll:()=>buttons},row={id:'race',disabledSystems:''},alerts=[];
 const c=vm.createContext({e:'racesetups',items:[row],box,manager:{box,e:'racesetups'},run:1,subRun:1,systemSaveBusy:false,RaceSystems:require('../renderer/racesystems'),api:{update},alert:x=>alerts.push(x),mountManager:async()=>{c.mounts++;},mounts:0});
 vm.runInContext('this.click=async b=>{'+source.slice(start,end)+'}',c);return {c,buttons,row,alerts};
}
test('pending icon save blocks overlapping writes and the next save keeps the first change',async()=>{
 let release;const writes=[],h=harness(async(e,id,patch)=>{writes.push(patch);await new Promise(r=>{release=r;});});
 const first=h.c.click(h.buttons[0]);assert(h.buttons.every(b=>b.disabled));await h.c.click(h.buttons[1]);assert.equal(writes.length,1);
 release();await first;assert(h.buttons.every(b=>!b.disabled));assert.equal(h.row.disabledSystems,'fuel');
 const next=h.c.click(h.buttons[1]);release();await next;assert.equal(h.row.disabledSystems,'fuel,weather');assert.equal(h.c.mounts,2);
});
test('failed save keeps the previous setting, explains the failure and allows retry',async()=>{
 let fail=true;const h=harness(async()=>{if(fail)throw Error('Disk full');});await h.c.click(h.buttons[0]);
 assert.equal(h.row.disabledSystems,'');assert(h.alerts[0].includes('Disk full'));assert(h.buttons.every(b=>!b.disabled));assert.equal(h.c.mounts,0);
 fail=false;await h.c.click(h.buttons[0]);assert.equal(h.row.disabledSystems,'fuel');assert.equal(h.c.mounts,1);
});
test('finishing a save after navigation cannot reopen the previous manager',async()=>{
 let release;const h=harness(()=>new Promise(r=>{release=r;})),pending=h.c.click(h.buttons[0]);h.c.subRun=2;release();await pending;
 assert.equal(h.c.mounts,0);assert.equal(h.row.disabledSystems,'fuel');
});
test('saving does not enable a control that was already unavailable',async()=>{
 const h=harness(async()=>{});h.buttons[1].disabled=true;await h.c.click(h.buttons[0]);assert.equal(h.buttons[1].disabled,true);
});
