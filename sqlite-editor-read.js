'use strict';
const C=require('./sqlite-catalogue'),E=require('./editor-read');
// Reconstruct only the requested top-level field, including its own media.
// Galleries, Paddock captures and other unrelated fields never enter memory.
function field(s,e,id,key,media=false){
 if(!media)return C.read(s,e,id,[key]);
 const record=s.statement('SELECT shape FROM records WHERE entity=? AND id=?').get(e,id);if(!record)return undefined;
 const shape=JSON.parse(record.shape)[1].find(([name])=>name===key)?.[1];if(!shape)return undefined;
 const build=node=>node[0]==='field'?JSON.parse(s.statement('SELECT json FROM fields WHERE entity=? AND id=? AND path=?').get(e,id,node[1]).json):Object.fromEntries(node[1].map(([name,next])=>[name,build(next)]));
 let result=build(shape);const path=JSON.stringify([key]),prefix=path.slice(0,-1)+',';
 for(const a of s.statement('SELECT path,mime,bytes,original FROM assets WHERE entity=? AND id=? AND (path=? OR substr(path,1,?)=?)').all(e,id,path,prefix.length,prefix)){
  const parts=JSON.parse(a.path).slice(1),uri=a.original??`data:${a.mime};base64,${Buffer.from(a.bytes).toString('base64')}`;
  if(!parts.length)result=uri;else{let parent=result;for(const k of parts.slice(0,-1))parent=parent[k];Object.defineProperty(parent,parts.at(-1),{value:uri,enumerable:true,writable:true,configurable:true});}
 }
 return result;
}
function read(s,kind,entity,value){return s.transaction(()=>E.read({
 revision:()=>C.revision(s),rows:(e,after,limit)=>s.page(e,after,limit),
 exists:(e,id)=>!!s.statement('SELECT 1 FROM records WHERE entity=? AND id=?').get(e,id),field:(...args)=>field(s,...args),
 count:(e,id,key)=>s.statement("SELECT CASE WHEN json_type(json)='array' THEN json_array_length(json) ELSE 0 END n FROM fields WHERE entity=? AND id=? AND path=?").get(e,id,JSON.stringify([key]))?.n||0,
 has:(e,id,key)=>!!s.statement("SELECT 1 FROM records r,json_each(r.shape,'$[1]') m WHERE r.entity=? AND r.id=? AND json_extract(m.value,'$[0]')=? AND (json_extract(m.value,'$[1][0]')='object' OR EXISTS(SELECT 1 FROM fields f WHERE f.entity=r.entity AND f.id=r.id AND f.path=? AND f.json NOT IN ('null','false','0','\"\"'))) LIMIT 1").get(e,id,key,JSON.stringify([key])),
 firstPicture:(e,key)=>s.statement("SELECT r.id FROM records r WHERE r.entity=? AND (EXISTS(SELECT 1 FROM assets a WHERE a.entity=r.entity AND a.id=r.id AND a.path=?) OR EXISTS(SELECT 1 FROM fields f WHERE f.entity=r.entity AND f.id=r.id AND f.path=? AND f.json NOT IN ('null','false','0','\"\"'))) ORDER BY r.ordinal LIMIT 1").get(e,JSON.stringify([key]),JSON.stringify([key]))?.id
},kind,entity,value));}
module.exports={read};
