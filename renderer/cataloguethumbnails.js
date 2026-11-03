// List previews only. Full car views, race artwork and exports keep original media.
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CatalogueThumbnails={...api.create(),create:api.create};})(globalThis,()=>{
 async function resize(source){
  if(typeof createImageBitmap!=='function'||typeof OffscreenCanvas!=='function'||!/^data:image\/(png|jpeg|webp);base64,/i.test(source))return source;
  let bitmap;
  try{
   bitmap=await createImageBitmap(await (await fetch(source)).blob());
   const ratio=Math.min(1,512/Math.max(bitmap.width,bitmap.height));if(ratio===1)return source;
   const canvas=new OffscreenCanvas(Math.max(1,Math.round(bitmap.width*ratio)),Math.max(1,Math.round(bitmap.height*ratio)));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await canvas.convertToBlob({type:'image/png'});
   const result=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});
   return result.length<source.length?result:source;
  }catch{return source;}finally{bitmap?.close();}
 }
 function create({transform=resize,maxBytes=12*1024*1024,maxItems=128}={}){
  const cache=new Map(),pending=new Map();let bytes=0;
  async function get(key,load){
   if(cache.has(key)){const v=cache.get(key);cache.delete(key);cache.set(key,v);return v;}
   if(pending.has(key))return pending.get(key);
   const job=(async()=>{
    const source=await load();if(!source)return source;const value=await transform(source),size=value.length*2;
    if(size<=maxBytes){while(cache.size&&(bytes+size>maxBytes||cache.size>=maxItems)){const old=cache.keys().next().value;bytes-=cache.get(old).length*2;cache.delete(old);}cache.set(key,value);bytes+=size;}
    return value;
   })();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
  }
  return {get,stats:()=>({bytes,items:cache.size,pending:pending.size})};
 }
 return {create,resize};
});
