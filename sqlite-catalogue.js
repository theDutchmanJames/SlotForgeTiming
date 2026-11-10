'use strict';
const C=require('./catalogue-read'),schema=require('./schema');
const {randomUUID}=require('node:crypto');
function read(s,entity,id,parts) {
  // Scalar leaves are selected directly; framed objects are reconstructed only when requested.
  const path=JSON.stringify(parts),leaf=s.statement('SELECT json FROM fields WHERE entity=? AND id=? AND path=?').get(entity,id,path);
  if(leaf)return JSON.parse(leaf.json);
  const prefix=path.slice(0,-1)+',';
  const leaves=s.statement('SELECT path,json FROM fields WHERE entity=? AND id=? AND substr(path,1,?)=?').all(entity,id,prefix.length,prefix);
  if(!leaves.length)return undefined;
  const result={};for(const l of leaves){const p=JSON.parse(l.path).slice(parts.length);let target=result;for(const k of p.slice(0,-1)){if(!Object.hasOwn(target,k))Object.defineProperty(target,k,{value:{},enumerable:true});target=target[k];}Object.defineProperty(target,p.at(-1),{value:JSON.parse(l.json),enumerable:true});}return result;
}
function index(s,entity,id) {
  s.statement('DELETE FROM catalogue_index WHERE entity=? AND id=?').run(entity,id);
  if(!s.statement('SELECT 1 FROM records WHERE entity=? AND id=?').get(entity,id))return;
  const name=C.label(entity,p=>read(s,entity,id,p));
  const linked=entity==='slotcars'&&(s.statement(`SELECT 1 FROM fields WHERE entity=? AND id=? AND (path='["paddock"]' AND json NOT IN ('null','false','0','""') OR substr(path,1,11)='["paddock",') LIMIT 1`).get(entity,id)
    ||s.statement(`SELECT 1 FROM records r,json_each(r.shape,'$[1]') m WHERE r.entity=? AND r.id=? AND json_extract(m.value,'$[0]')='paddock' AND json_extract(m.value,'$[1][0]')='object' LIMIT 1`).get(entity,id));
  const local=!linked;
  s.statement('INSERT INTO catalogue_index VALUES(?,?,?,?,?,?)').run(entity,id,C.key(name),C.fold(name),name,local?1:0);
}
function upgrade(s) {
  s.transaction(()=>{
    const format=s.statement("SELECT value FROM info WHERE key='workingFormat'").get().value;
    if(['3','4','5','6'].includes(format)){if(!s.statement("SELECT value FROM info WHERE key='catalogueIdentity'").get()?.value)throw Error('Missing catalogue identity.');if(require('./sqlite-derived').tables(s,['catalogue_index'])){s.db.exec('CREATE INDEX IF NOT EXISTS catalogue_order ON catalogue_index(entity,local,sortKey,id);');return;}}
    if(!['2','3','4','5','6'].includes(format))throw Error('Unsupported catalogue format.');
    s.db.exec(`CREATE TABLE catalogue_index(entity TEXT NOT NULL,id TEXT NOT NULL,sortKey TEXT NOT NULL,search TEXT NOT NULL,label TEXT NOT NULL,local INTEGER NOT NULL,PRIMARY KEY(entity,id));
      CREATE INDEX catalogue_order ON catalogue_index(entity,local,sortKey,id);`);
    for(const entity of C.ENTITIES)for(const {id} of s.statement('SELECT id FROM records WHERE entity=?').all(entity))index(s,entity,id);
    if(format==='2'){s.statement("INSERT INTO info(key,value) VALUES('catalogueIdentity',?)").run(randomUUID());s.statement("UPDATE info SET value='3' WHERE key='workingFormat'").run();}
  });
}
function sync(s) {for(const {entity,id} of s.changed.values())if(C.ENTITIES.includes(entity))index(s,entity,id);}
function revision(s) {return s.statement("SELECT value FROM info WHERE key='catalogueIdentity'").get().value+':'+String(s.statement('SELECT COALESCE(MAX(sequence),0) AS n FROM changes').get().n);}
function page(s,entity,options) {
  const o=C.options(entity,options);
  return s.transaction(()=>{
    const rev=revision(s);if(o.cursor&&o.cursor.revision!==rev)throw C.stale();
    const where=['entity=?','local=1'],args=[entity];
    if(o.cursor){where.push('(sortKey,id)>(?,?)');args.push(o.cursor.key,o.cursor.id);}
    if(o.query){where.push('instr(search,?)>0');args.push(o.query);}
    const rows=s.statement(`SELECT id,sortKey FROM catalogue_index WHERE ${where.join(' AND ')} ORDER BY sortKey,id LIMIT ?`).all(...args,o.limit+1);
    const custom=read(s,'@meta','customFields',[entity])||[];
    const items=rows.slice(0,o.limit).map(r=>({record:C.summary(entity,r.id,p=>read(s,entity,r.id,p),custom),
      hasPicture:!!s.statement('SELECT 1 FROM assets WHERE entity=? AND id=? AND path=?').get(entity,r.id,JSON.stringify([schema[entity].image]))||!!read(s,entity,r.id,[schema[entity].image]),
      galleryCount:schema[entity].gallery?s.statement("SELECT CASE WHEN json_valid(json) AND json_type(json)='array' THEN json_array_length(json) ELSE 0 END AS n FROM fields WHERE entity=? AND id=? AND path=?").get(entity,r.id,JSON.stringify([schema[entity].gallery]))?.n||0:0}));
    const last=rows[Math.min(rows.length,o.limit)-1];
    return {items,revision:rev,next:rows.length>o.limit?{entity,query:o.query,revision:rev,key:last.sortKey,id:last.id}:null};
  });
}
function picture(s,entity,id,expected) {
  C.check(entity);return s.transaction(()=>{
    if(revision(s)!==expected)throw C.stale();
    const parts=[schema[entity].image],asset=s.asset(entity,id,parts);
    return asset?`data:${asset.mime};base64,${asset.bytes.toString('base64')}`:read(s,entity,id,parts)||null;
  });
}
module.exports={upgrade,sync,page,picture,read,revision};
