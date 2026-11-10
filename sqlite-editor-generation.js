'use strict';
const {randomUUID}=require('node:crypto');
const KEY='editorGeneration';
function read(s){
  const value=s.statement('SELECT value FROM info WHERE key=?').get(KEY)?.value;
  if(typeof value!=='string'||!/^[a-f0-9-]{36}$/.test(value))throw Error('Missing or invalid editor save generation.');
  return value;
}
function initialize(s){s.transaction(()=>{
  // Preserve pending IDs from the first retry implementation on ordinary upgrade.
  // Native restores explicitly assign a fresh generation before publication.
  if(!s.statement('SELECT 1 FROM info WHERE key=?').get(KEY))s.statement("INSERT INTO info(key,value) SELECT ?,value FROM info WHERE key='catalogueIdentity'").run(KEY);
  read(s);
});}
function reset(s){s.transaction(()=>{
  s.statement('INSERT INTO info VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(KEY,randomUUID());
});}
function check(s,scope){if(scope!==read(s))throw Object.assign(Error('The database was replaced. Review the current data and reopen the editor before saving again.'),{code:'EDITOR_GENERATION_CHANGED'});}
module.exports={read,initialize,reset,check};
