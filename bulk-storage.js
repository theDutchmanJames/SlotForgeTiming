'use strict';
const Transfer=require('./transfer'), Backup=require('./backup'), Database=require('./db');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
// Production remains JSON. This boundary also serves content-pack copies.
class JsonBulkStorage {
  constructor(db){this.db=db;}
  assertExportTarget(file){
    const normalized=x=>process.platform==='win32'?path.resolve(x).toLowerCase():path.resolve(x);
    if([this.db.file,this.db.settingsPath,this.db.resumeFile()].some(x=>normalized(x)===normalized(file)))throw Error('Choose a separate export file, not an active database or recovery file.');
  }
  collect(picks,deps=true,info={}){return Transfer.collect(this.db.data,picks,deps,info);}
  createPack(picks,manifest,themes,version){return require('./contentpacks').create(this.db.data,picks,manifest,themes,version);}
  dependencies(picks){return Transfer.dependencies(this.db.data,picks);}
  async importItems(bundle){await this.db.fileIdle();return Transfer.apply(this.db,bundle);}
  async backup(file,info={}){this.assertExportTarget(file);await this.db.writesIdle();Database.writeAtomic(file,JSON.stringify(Backup.make(this.db.data,info)));return {saved:true,path:file};}
  async safetyCopy(){
    await this.db.writesIdle();
    const file=path.join(path.dirname(this.db.file),'slotforge-timing.before-restore-'+crypto.randomUUID()+'.json');
    // Include current settings, not a potentially older main-file copy. Never swallow failure.
    const fd=fs.openSync(file,'wx');try{fs.writeFileSync(fd,JSON.stringify(Backup.make(this.db.data)));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    return file;
  }
  restore(bundle){const c=Backup.check(bundle);if(!c.ok)throw Error(c.error);this.db.replaceAll(bundle.data);}
}
class SqliteBulkStorage {
  constructor(client){this.client=client;}
  collect(picks,deps=true,info={}){return this.client.bulkCollect(picks,deps,info);}
  dependencies(picks){return this.client.bulkDependencies(picks);}
  async createPack(picks,manifest,themes,version){
    const Packs=require('./contentpacks');
    if(!picks||Object.keys(picks).some(e=>!Packs.ENTITIES.includes(e)))throw Error('Unsupported content type.');
    const bundle=await this.collect(picks,true);
    return Packs.validate({format:Packs.FORMAT,apiVersion:1,manifest,items:bundle.items,themes:themes||[]},version);
  }
  importItems(bundle,{commandId}){return this.client.command({id:commandId,type:'importItems',bundle});}
  backup(destination,info={}){return this.client.backupSnapshot(destination,info);}
  restore(source,destination){return this.client.restoreSnapshot(source,destination);}
}
module.exports={JsonBulkStorage,SqliteBulkStorage};
