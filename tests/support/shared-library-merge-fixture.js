'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SharedLibraryClient}=require('../../shared-library-client'),engine=require('../../vendor/slotforge-library/index.cjs');
async function fixture(t,backend,seed=()=>{}){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-common-engine-')),profile=path.join(root,'slotforge-timing');fs.mkdirSync(profile);
 const Database=require('../../db'),db=new Database(path.join(profile,'slotforge-timing.json'));db.data.paddock={sourceId:'timing-test'};db.data.customFields.slotcars=[{id:'keep',label:'Legacy note',type:'number',options:[]}];db.data.slotcars=[{id:'old-car',brand:'NSR',model:'Historic',gearing:'9/27',tyres:'Rubber',weight:'80 g',damageFactor:1.3,custom:{keep:42}}];db.saveNow();
 seed(db.data);db.saveNow();const original=fs.readFileSync(db.file);let worker,storage;
 if(backend==='sqlite'){
  const generation=require('node:crypto').randomUUID(),copy=path.join(profile,'sqlite',generation),work=path.join(copy,'working');fs.mkdirSync(path.dirname(copy),{recursive:true});
  require('../../sqlite-migration').migrateCopy({source:db.file,destination:copy});require('../../sqlite-working').forkCopy(copy,work);
  fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation}));
  worker=new(require('../../sqlite-client'))();await worker.openWorking(work);storage=new(require('../../paddock-storage').SqlitePaddockStorage)(new(require('../../sqlite-repository'))(worker));
 }else storage=new(require('../../paddock-storage').JsonPaddockStorage)(db);
 const options={installationId:'timing-test',storage,sharedRoot:path.join(root,'shared'),legacyProfiles:[profile],mergeCompatibility:true};
 const client=await SharedLibraryClient.open(options),peer=await engine.open({application:'SlotForge Paddock',installationId:'paddock-test',sharedRoot:options.sharedRoot,legacyProfiles:[]});
 t.after(async()=>{await client.close();await peer.close();await worker?.close();await db.writesIdle();if(backend==='sqlite')assert.deepEqual(fs.readFileSync(db.file),original);fs.rmSync(root,{recursive:true,force:true});});
 return {client,peer,storage,options,db,worker};
}

module.exports=fixture;
