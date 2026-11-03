'use strict';
// Shared, media-free list contract. Full records are fetched only for viewing/editing.
const schema = require('./schema');
const {randomUUID}=require('node:crypto');
const ENTITIES = ['tracks','drivers','teams','slotcars'];
function check(entity) { if (!ENTITIES.includes(entity)) throw Error('Unsupported catalogue.'); }
const fold = text => String(text ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const key = text => fold(text).replace(/\d+/g,n=>{const value=n.replace(/^0+(?=\d)/,'');return '\u0001'+String(value.length).padStart(8,'0')+value+'\u0002';});
const compare = (a,b) => Buffer.compare(Buffer.from(a),Buffer.from(b));
function options(entity, value = {}) {
  check(entity);
  const {search='',limit=48,cursor=null}=value;
  if(typeof search!=='string'||search.length>200||!Number.isInteger(limit)||limit<1||limit>100)throw Error('Invalid catalogue query.');
  const query=fold(search.trim());
  if(cursor!==null&&(!cursor||typeof cursor!=='object'||typeof cursor.key!=='string'||typeof cursor.id!=='string'||cursor.entity!==entity||cursor.query!==query||typeof cursor.revision!=='string'))throw Error('Invalid catalogue cursor.');
  return {query,limit,cursor};
}
function stale() { return Object.assign(Error('The catalogue changed. Refresh the list before continuing.'),{code:'CATALOGUE_CHANGED'}); }
function label(entity,read) { return schema[entity].title.map(k=>String(read([k])??'')).filter(Boolean).join(' ').trim(); }
function summary(entity,id,read,custom=[]) {
  const row={id,custom:{}};
  for(const f of schema[entity].fields) {
    if(['image','gallery'].includes(f.type))continue;
    const v=read([f.key]);if(v!==undefined)row[f.key]=f.type==='longtext'?String(v).slice(0,60):v;
  }
  for(const f of custom) {const v=read(['custom',f.id]);if(v!==undefined)Object.defineProperty(row.custom,f.id,{value:v,enumerable:true});}
  // Frames are tiny; geometry, galleries, photo data and Paddock captures are excluded.
  const frame=read([schema[entity].image+'Frame']);if(frame!==undefined)row[schema[entity].image+'Frame']=frame;
  return structuredClone(row);
}
function jsonRead(row,parts) {let value=row;for(const part of parts)value=value?.[part];return value;}
function jsonPage(db,entity,value) {
  const o=options(entity,value),revision=jsonRevision(db);
  if(o.cursor&&o.cursor.revision!==revision)throw stale();
  const rows=db.list(entity).filter(r=>entity!=='slotcars'||!r.paddock).map(r=>({row:r,label:label(entity,p=>jsonRead(r,p))}));
  const selected=rows.filter(r=>fold(r.label).includes(o.query)).map(r=>({...r,key:key(r.label)})).sort((a,b)=>compare(a.key,b.key)||compare(a.row.id,b.row.id));
  const remaining=selected.filter(r=>!o.cursor||compare(r.key,o.cursor.key)>0||(r.key===o.cursor.key&&compare(r.row.id,o.cursor.id)>0));
  const page=remaining.slice(0,o.limit),custom=db.listCustomFields(entity);
  const items=page.map(r=>({record:summary(entity,r.row.id,p=>jsonRead(r.row,p),custom),hasPicture:!!r.row[schema[entity].image],galleryCount:Array.isArray(r.row[schema[entity].gallery])?r.row[schema[entity].gallery].length:0}));
  const last=page.at(-1);
  return {items,revision,next:remaining.length>o.limit?{entity,query:o.query,revision,key:last.key,id:last.row.id}:null};
}
function jsonPicture(db,entity,id,revision) {
  check(entity);if(jsonRevision(db)!==revision)throw stale();
  const row=db.list(entity).find(r=>r.id===id);return row?.[schema[entity].image]||null;
}
function jsonRevision(db){db.catalogueIdentity ||= randomUUID();return db.catalogueIdentity+':'+String(db.catalogueEpoch||0);}
module.exports={ENTITIES,check,fold,key,compare,options,stale,label,summary,jsonPage,jsonPicture,jsonRevision};
