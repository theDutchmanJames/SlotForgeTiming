'use strict';
// Advisory preflight; SQLite transactions remain the authority if space changes later.
const fs=require('node:fs'),path=require('node:path');
const RESERVE=32*1024*1024;
function available(target,statfs=fs.statfsSync){
  let parent=path.resolve(target);
  while(!fs.existsSync(parent)){const next=path.dirname(parent);if(next===parent)return null;parent=next;}
  try{const s=statfs(parent,{bigint:true}),n=BigInt(s.bavail)*BigInt(s.bsize);return n>BigInt(Number.MAX_SAFE_INTEGER)?Number.MAX_SAFE_INTEGER:Number(n);}catch{return null;}
}
function check(target,bytes,operation='Storage operation',probe=available){
  if(!Number.isSafeInteger(bytes)||bytes<0)throw Error('Invalid storage space estimate.');
  const required=Math.min(Number.MAX_SAFE_INTEGER,bytes+RESERVE),free=probe(target);
  if(free!==null&&free<required){const error=Error(`${operation} needs an estimated ${Math.ceil(required/1048576)} MiB of free space; ${Math.floor(free/1048576)} MiB is available. Free space and retry. Existing source data is unchanged.`);error.code='ENOSPC';throw error;}
  return {requiredBytes:required,availableBytes:free};
}
module.exports={available,check,RESERVE};
