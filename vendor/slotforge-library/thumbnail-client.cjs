'use strict';
// Shared by host apps. Encoding runs in their browser worker, never SQLite's worker.
module.exports=function(invoke,encode){
 const flights=new Map();let tail=Promise.resolve(),closed=false;
 async function get(input){
  if(closed)return null;
  const key=JSON.stringify(input);if(flights.has(key))return flights.get(key);
  const job=tail.then(async()=>{
   if(closed)return null;
   for(let n=0;n<70&&!closed;n++){
    const r=await invoke('thumbnailRead',input);if(!r.lease&&!r.pending)return r.data;
    if(r.pending){await new Promise(resolve=>setTimeout(resolve,1000));continue;}
    let data=null;
    try{if(typeof encode!=='function')throw Error('Thumbnail encoder is unavailable.');data=await encode(r.source);const saved=await invoke('thumbnailStore',{key:r.key,lease:r.lease,data});if(!saved.stored)continue;return data;}
    catch(e){await invoke('thumbnailStore',{key:r.key,lease:r.lease,data:null}).catch(()=>{});throw e;}
   }
   return null;
  });tail=job.catch(()=>{});flights.set(key,job);try{return await job;}finally{flights.delete(key);}
 }
 return {get,warm(carId){if(typeof encode==='function'&&flights.size<32)get({carId}).catch(()=>{});},close(){closed=true;return tail;}};
};
