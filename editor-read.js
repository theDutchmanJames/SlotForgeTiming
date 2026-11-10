'use strict';
// Layout editing needs choices, one framing sample and the selected track,
// never complete photo-heavy car/driver/track collections.
const C=require('./catalogue-read');
const KEYS={layouts:['name','note','ratioW','ratioH'],tracks:['name'],teams:['name'],imagesets:['name','kind']};
const PICTURES={drivers:'avatar',slotcars:'picture',teams:'picture'};
const TRACK_KEYS=['name','lanes','length','laneLengths','laneModifier','targetLap','trackDesign'];
function read(source,kind,entity,value={}){
 if(kind==='page'){
  if(!Object.hasOwn(KEYS,entity))throw Error('Unsupported editor choices.');
  const {cursor=null}=value||{},revision=source.revision();
  if(cursor&&(cursor.entity!==entity||cursor.kind!=='editor'||typeof cursor.revision!=='string'||!Number.isSafeInteger(cursor.ordinal)||cursor.ordinal<0))throw Error('Invalid editor cursor.');
  if(cursor&&cursor.revision!==revision)throw C.stale();
  const rows=source.rows(entity,cursor?.ordinal??-1,101),items=rows.slice(0,100).map(({id})=>{
   const item={id};for(const key of KEYS[entity]){const v=source.field(entity,id,key);if(v!==undefined)item[key]=v;}
   if(entity==='layouts')item.widgetCount=source.count(entity,id,'widgets');
   if(entity==='tracks')item.hasTrackDesign=source.has(entity,id,'trackDesign');
   return item;
  });
  return {items,revision,next:rows.length>100?{entity,kind:'editor',revision,ordinal:rows[99].ordinal}:null};
 }
 if(kind==='sample'){
  if(!Object.hasOwn(PICTURES,entity))throw Error('Unsupported framing sample.');
  const key=PICTURES[entity],id=source.firstPicture(entity,key);
  return id?[{id,[key]:source.field(entity,id,key,true)}]:[];
 }
 if(kind==='track'){
  if(entity!=='tracks'||typeof value!=='string')throw Error('Invalid editor track.');
  if(!source.exists(entity,value))return null;
  const item={id:value};for(const key of TRACK_KEYS){const v=source.field(entity,value,key,true);if(v!==undefined)item[key]=v;}return item;
 }
 throw Error('Unsupported editor read.');
}
function jsonSource(db){const row=(e,id)=>db.list(e).find(r=>r.id===id);return {
 revision:()=>C.jsonRevision(db),
 rows:(e,after,limit)=>db.list(e).map((r,ordinal)=>({id:r.id,ordinal})).slice(after+1,after+1+limit),
 exists:(e,id)=>!!row(e,id),
 field:(e,id,key)=>structuredClone(row(e,id)?.[key]),
 count:(e,id,key)=>Array.isArray(row(e,id)?.[key])?row(e,id)[key].length:0,
 has:(e,id,key)=>!!row(e,id)?.[key],
 firstPicture:(e,key)=>db.list(e).find(r=>r[key])?.id
};}
module.exports={read,jsonSource};
