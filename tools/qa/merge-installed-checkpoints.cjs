'use strict';
// Called by the single paired-run controller at agreed checkpoints. Does not
// start apps or send overlapping commands; all effects use normal Timing IPC.
const assert=require('node:assert/strict');
module.exports=function checkpoints(control){
 const js=code=>control.js('timing',code);let baseline,stale,latePending;
 const snapshot=()=>js("const p=await api.historyPage('racing',{});return {tracks:p.tracks.items,personal:p.personal.items};");
 async function inspect(){return js("const c=await api.catalogue('slotcars',{});return {ids:c.items.map(x=>x.record.id),status:await api.libraryStatus(),storage:await api.storageStatus()};");}
 return {
  async baseline(){
   const view=await inspect();assert.deepEqual([...view.ids].sort(),['car-a','car-b']);baseline=await snapshot();assert(baseline.tracks.length);assert(baseline.tracks.some(x=>x.carId==='car-a'));
   stale=await js("return await api.libraryCar('car-a');");assert.equal(stale.timing.sourceId,'timing-ui','Seed the private Timing source ID before launch');
   const captured=await js("return await api.paddockPrepare(['car-a']);");assert.equal(captured.captures['car-a'].configuration.carId,'car-a');
   assert.equal((await js("return await api.libraryCar('car-b');")).timing.values.serviceInterval,null);
   return view;
  },
  async pending(){assert.deepEqual([...(await inspect()).ids].sort(),['car-a','car-b']);assert.deepEqual(await snapshot(),baseline);},
  async approved({damageFactor=2}={}){
   assert.deepEqual((await inspect()).ids,['car-b']);assert.deepEqual(await snapshot(),baseline);
   const retired=await js("try{await api.paddockPrepare(['car-a']);return {rejected:false};}catch(e){return {rejected:true,message:e.message};}");assert.equal(retired.rejected,true);assert.match(retired.message,/merged|archived/i);
   const prepared=await js("return await api.paddockPrepare(['car-b']);");assert.equal(prepared.timingSettings['car-b'].effective.damageFactor,damageFactor);
   const input={databaseId:stale.schema.databaseId,recoveryId:stale.schema.recoveryId,action:'patch',carId:'car-a',expectedRevision:stale.car.revision,set:{name:'Must not overwrite merged car'},clear:[]};
   const blocked=await js('return await api.librarySave('+JSON.stringify(input)+');');assert.equal(blocked.state,'blocked');assert.equal(blocked.code,'CAR_MERGED');
   await js("state.tab='database';state.sub='results';state.resultsSub='racing';await render();if(document.body.innerText.includes('Original session evidence'))throw Error('Unexpected history panel');");
   return {retired,blocked,prepared};
  },
  async saveSettings(){
   const result=await js("const e=await api.libraryCar('car-b'),b=e.timing.binding;return await api.librarySave({databaseId:e.schema.databaseId,recoveryId:e.schema.recoveryId,action:'patch',carId:'car-b',expectedRevision:e.car.revision,set:{},clear:[],timingSettings:{expectedRevision:b.revision,expectedBindingToken:b.bindingToken,set:{failureFactor:0,serviceInterval:null}}});");assert.equal(result.state,'committed');
   const current=await js("return await api.libraryCar('car-b');");assert.equal(current.timing.values.failureFactor,0);assert.equal(current.timing.values.serviceInterval,null);return result;
  },
  async latePending(){latePending=await snapshot();assert.equal((await js("return await api.carStatistics('car-b');")).mileage.laps,0);return latePending;},
  async lateIncluded(){const current=await snapshot();assert.deepEqual(current,latePending);assert((await js("return await api.carStatistics('car-b');")).mileage.laps>0);return current;},
  async restarted(){assert.deepEqual((await inspect()).ids,['car-b']);const e=await js("return await api.libraryCar('car-b');");assert.equal(e.timing.values.failureFactor,0);assert.equal(e.timing.values.serviceInterval,null);return e.timing;},
  async restored(){assert.deepEqual([...(await inspect()).ids].sort(),['car-a','car-b']);const p=await js("return await api.paddockPrepare(['car-a']);");assert.equal(p.captures['car-a'].configuration.carId,'car-a');return inspect();}
 };
};
