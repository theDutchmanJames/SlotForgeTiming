'use strict';
const T=require('./transfer');
function wrap(bulk,records,client,profile){
 async function collect(picks,deps=true,info={}){
  const data={customFields:{}},queue=[],seen=new Set();let bytes=0;
  for(const e of T.ORDER){data[e]=[];data.customFields[e]=await records.customFields(e);}
  const add=async(e,id,follow)=>{const key=JSON.stringify([e,id]);if(seen.has(key))return;seen.add(key);const row=await records.get(e,id);if(!row)return;bytes+=Buffer.byteLength(JSON.stringify(row));if(bytes>48*1024*1024)throw Error('Selected items exceed 48 MiB. Create a complete backup instead.');data[e].push(row);queue.push([e,row,follow]);};
  for(const [e,ids] of Object.entries(picks||{})){if(!T.ORDER.includes(e)||!Array.isArray(ids))throw Error('Invalid export selection.');for(const id of ids)await add(e,id,deps||e==='sessions');}
  for(let n=0;n<queue.length;n++){const [e,row,follow]=queue[n];if(e==='sessions'){const detail=await records.historySession(row.sessionType==='tokens'?'tokens':'racing',row.id,{exportAll:true});for(const lap of detail?.laps||[]){bytes+=Buffer.byteLength(JSON.stringify(lap));if(bytes>48*1024*1024)throw Error('Selected race evidence exceeds 48 MiB. Create a complete backup instead.');data.laps.push(lap);queue.push(['laps',lap,true]);}}
   if(follow&&e==='slotcars'&&/^C_[A-F0-9]{16,32}$/.test(row.tyreCompound||''))for(const system of await records.list('tyrewearsystems'))if(system.tyres?.[row.tyreCompound])await add('tyrewearsystems',system.id,true);
   if(follow)for(const ref of T.refsOf(e,row))await add(ref.entity,ref.get(),true);
  }
  return T.collect(data,picks,deps,info);
 }
 const adapter={collect,async dependencies(picks){const all=(await collect(picks,true)).items,required=(await collect({sessions:picks?.sessions||[]},false)).items,out={};for(const e of T.ORDER){if(e==='laps'||!all[e])continue;const own=new Set(picks?.[e]||[]),need=new Set((required[e]||[]).map(x=>x.id));const rows=all[e].filter(r=>!own.has(r.id)).map(r=>({id:r.id,required:need.has(r.id)}));if(rows.length)out[e]=rows;}return out;},
  async importItems(bundle){await require('./shared-library-import').prepare(client,profile,bundle);return require('./shared-library-import').resume(client,records,profile);}
 };
 return new Proxy(bulk,{get(target,key){return key in adapter?adapter[key]:typeof target[key]==='function'?target[key].bind(target):target[key];}});
}
module.exports={wrap};
