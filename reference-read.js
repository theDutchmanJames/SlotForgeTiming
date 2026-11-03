'use strict';
const schema=require('./schema'),C=require('./catalogue-read');
const ENTITIES=['tracks','drivers','slotcars','teams','layouts','audiosets','imagesets'];
function check(entity){if(!ENTITIES.includes(entity))throw Error('Unsupported reference collection.');}
function options(entity,value={}){
 check(entity);const {limit=200,cursor=null}=value;
 if(!Number.isInteger(limit)||limit<1||limit>200||cursor!==null&&(!cursor||cursor.entity!==entity||cursor.kind!=='references'||typeof cursor.revision!=='string'||!Number.isSafeInteger(cursor.ordinal)||cursor.ordinal<0))throw Error('Invalid reference query.');
 return {limit,cursor};
}
function project(entity,id,read){
 check(entity);const keys=entity==='layouts'?['name','laneColors']:entity==='audiosets'?['name']:entity==='imagesets'?['name','kind']:schema[entity].fields.filter(f=>!['image','gallery','longtext'].includes(f.type)).map(f=>f.key);
 const result={id};for(const key of keys){const value=read([key]);if(value!==undefined)Object.defineProperty(result,key,{value,enumerable:true});}
 if(entity==='slotcars'){
   const fields=['name','archived'],paddock={};for(const key of fields){const value=read(['paddock',key]);if(value!==undefined)paddock[key]=value;}
   if(read(['paddock']))result.paddock=paddock;
 }
 return structuredClone(result);
}
function cursor(entity,revision,ordinal){return {entity,kind:'references',revision,ordinal};}
function jsonPage(db,entity,value){const o=options(entity,value),revision=C.jsonRevision(db);if(o.cursor&&o.cursor.revision!==revision)throw C.stale();
 const offset=o.cursor?o.cursor.ordinal+1:0,rows=db.list(entity),items=rows.slice(offset,offset+o.limit).map(row=>project(entity,row.id,parts=>parts.reduce((v,k)=>v?.[k],row)));
 return {items,revision,next:rows.length>offset+o.limit?cursor(entity,revision,offset+o.limit-1):null};
}
function selection(entity,ids,revision){check(entity);if(!Array.isArray(ids)||ids.length>32||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length||typeof revision!=='string')throw Error('Invalid reference selection.');}
function jsonDetails(db,entity,ids,revision){selection(entity,ids,revision);if(C.jsonRevision(db)!==revision)throw C.stale();return ids.map(id=>db.getRecord(entity,id));}
module.exports={ENTITIES,check,options,project,cursor,selection,jsonPage,jsonDetails};
