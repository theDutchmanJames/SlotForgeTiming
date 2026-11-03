'use strict';
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const FORMAT='slotforge-sqlite-test-profile';
function validateProfile(directory,normalProfile,packaged=false){
  if(packaged)throw Error('SQLite test profiles are unavailable in packaged releases.');
  const real=fs.realpathSync(directory),normal=path.resolve(normalProfile);
  const key=p=>process.platform==='win32'?p.toLowerCase():p;
  const normalReal=fs.existsSync(normal)?fs.realpathSync(normal):normal;
  if(key(real)===key(normalReal)||fs.existsSync(path.join(real,'slotforge-timing.json')))throw Error('Use a separate SQLite test profile, never the existing application database.');
  const marker=JSON.parse(fs.readFileSync(path.join(real,'sqlite-test-profile.json'),'utf8'));
  if(marker.format!==FORMAT||marker.version!==1)throw Error('Not a marked SQLite test profile.');
  // No path supplied by the marker: only this fixed working directory is opened.
  const work=fs.realpathSync(path.join(real,'working'));
  if(key(path.dirname(work))!==key(real)||!fs.lstatSync(path.join(work,'working.sqlite')).isFile())throw Error('Invalid SQLite test working directory.');
  return real;
}
async function open(directory,{profileRoot=directory}={}){
  const Client=require('./sqlite-client'),client=new Client();
  try{
    await client.openWorking(path.join(directory,'working'));
    const commands=new(require('./sqlite-repository'))(client);
    const resources=new(require('./resource-store'))(null,{backend:new(require('./resource-backends').SqliteResources)(commands)});
    const records=new(require('./sqlite-app-repository'))(client,{resources,afterSession:()=>lifecycle.stopping?Promise.resolve():lifecycle.refreshSettings()});
    const Life=require('./storage-lifecycle'),backend=new Life.SqliteLifecycleBackend(client);
    const barrier=backend.idle.bind(backend),pending=backend.pending.bind(backend);
    backend.idle=async()=>{await records.idle();await barrier();};backend.pending=()=>records.pending>0||pending();
    const lifecycle=await new Life.StorageLifecycle(backend,{resources}).initialize();
    const shutdown=lifecycle.shutdown.bind(lifecycle);lifecycle.shutdown=()=>{records.stop();return shutdown();};
    const file=path.join(directory,'working','working.sqlite');
    const bulk=new(require('./bulk-storage').SqliteBulkStorage)(client);
    const importItems=bulk.importItems.bind(bulk);bulk.importItems=(bundle,options={commandId:randomUUID()})=>importItems(bundle,options);
    const profile=fs.realpathSync(profileRoot);
    bulk.assertExportTarget=target=>{
      const absolute=path.resolve(target);
      // Resolve directory junctions as well as existing file symlinks before protecting the profile.
      const resolved=fs.existsSync(absolute)?fs.realpathSync(absolute):path.join(fs.realpathSync(path.dirname(absolute)),path.basename(absolute));
      const rel=path.relative(profile,resolved);
      if(!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))throw Error('Export outside the application profile to protect its database and recovery files.');
    };
    // Preserve the existing JSON backup dialog contract; native backups remain available to the worker tools.
    bulk.backup=async(target,info)=>{bulk.assertExportTarget(target);await lifecycle.idle();return client.exportLegacy(target,info);};
    bulk.safetyCopy=()=>{throw Error('Restore to a separate working copy with the SQLite tools; in-place test-profile restore is not enabled.');};
    bulk.restore=bulk.safetyCopy;
    const createPaddock=()=>new(require('./paddock').Paddock)(null,{storage:new(require('./paddock-storage').SqlitePaddockStorage)(commands),deliveryStore:client});
    return {file,client,records,resources,lifecycle,bulk,createPaddock};
  }catch(error){await client.cancel();throw error;}
}
module.exports={FORMAT,validateProfile,open};
