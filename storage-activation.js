'use strict';
// Selection is published last. Legacy files and every attempted conversion are retained.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FORMAT='slotforge-storage-selection',REQUEST='slotforge-sqlite-activation';
const selectionFile=p=>path.join(p,'storage-backend.json');
const requestFile=p=>path.join(p,'sqlite-activation-request.json');
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
function read(file){try{const value=JSON.parse(fs.readFileSync(file,'utf8'));if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid storage metadata.');return value;}catch(e){if(e.code==='ENOENT')return null;throw Error('Storage selection cannot be read. Keep the profile intact and recover from its verified backup.');}}
function publish(file,value){
  const temp=file+'.'+crypto.randomUUID()+'.pending',fd=fs.openSync(temp,'wx');
  try{fs.writeFileSync(fd,JSON.stringify(value,null,2));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  fs.renameSync(temp,file);
  // Directory fsync is supported on Unix; Windows relies on the flushed file and rename.
  if(process.platform!=='win32'){const d=fs.openSync(path.dirname(file),'r');try{fs.fsyncSync(d);}finally{fs.closeSync(d);}}
}
function selected(profile){
  const value=read(selectionFile(profile));if(!value)return null;
  if(value.format!==FORMAT||value.version!==1||value.backend!=='sqlite'||!uuid(value.generation))throw Error('Unsupported storage selection. JSON fallback is disabled to protect newer data.');
  const root=fs.realpathSync(profile),directory=path.join(root,'sqlite',value.generation);
  // Neither a marker nor a directory alias can redirect database access outside this profile.
  if(fs.realpathSync(directory)!==directory||fs.realpathSync(path.join(directory,'working'))!==path.join(directory,'working')||!fs.lstatSync(path.join(directory,'working','working.sqlite')).isFile())throw Error('The selected SQLite database is missing or redirected. JSON fallback is disabled.');
  return {...value,directory};
}
function request(profile){
  if(selected(profile))throw Error('SQLite is already active.');
  if(!fs.statSync(path.join(profile,'slotforge-timing.json')).isFile())throw Error('No legacy database to convert.');
  const existing=read(requestFile(profile));
  if(existing){validateRequest(existing);return existing;}
  const value={format:REQUEST,version:1,id:crypto.randomUUID(),createdAt:new Date().toISOString()};publish(requestFile(profile),value);return value;
}
function validateRequest(v){if(v.format!==REQUEST||v.version!==1||!uuid(v.id))throw Error('Invalid SQLite activation request. No database was selected.');}
function requestNew(profile){
  require('./storage-rollout').assertFresh(profile);
  const value={format:REQUEST,version:1,id:crypto.randomUUID(),kind:'new',createdAt:new Date().toISOString()};
  publish(requestFile(profile),value);return value;
}
function assertNoLegacy(profile){
  if(fs.readdirSync(profile).some(name=>/^slotforge-timing(?:\.|$)|^race-resume(?:\.|$)/i.test(name)))throw Error('Legacy files appeared during new database creation. No empty database was selected.');
}
async function digest(file){const hash=crypto.createHash('sha256');for await(const block of fs.createReadStream(file))hash.update(block);return hash.digest('hex');}
async function requestRestore(profile,file,sha256,{beforePublish=()=>{}}={}){
  const active=selected(profile);if(!active)throw Error('SQLite must be active before staging this restore.');
  const value={format:REQUEST,version:1,id:crypto.randomUUID(),kind:'restore',baseGeneration:active.generation,sha256};
  const target=path.join(profile,'sqlite','restore-input-'+value.id+'.json');
  require('./storage-space').check(target,fs.statSync(file).size*8,'Stage database restore');
  await fs.promises.copyFile(file,target,fs.constants.COPYFILE_EXCL);
  if(await digest(target)!==sha256)throw Error('Backup changed after it was reviewed. Open it again before restoring.');
  const fd=fs.openSync(target,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  await beforePublish();publish(requestFile(profile),value);return value;
}
async function requestNativeRestore(profile,source,{beforePublish=()=>{}}={}){
  const active=selected(profile);if(!active)throw Error('SQLite must be active before staging this restore.');
  const manifestFile=path.join(source,'manifest.json'),snapshot=path.join(source,'snapshot.sqlite');
  if(!fs.lstatSync(manifestFile).isFile()||fs.statSync(manifestFile).size>65536||!fs.lstatSync(snapshot).isFile()||fs.existsSync(snapshot+'-wal')||fs.existsSync(snapshot+'-journal'))throw Error('Choose a sealed native SQLite backup folder.');
  const bytes=fs.readFileSync(manifestFile),manifest=JSON.parse(bytes);
  if(manifest.format!==require('./sqlite-bulk').FORMAT||manifest.version!==1||manifest.state!=='verified'||!/^[a-f0-9]{64}$/.test(manifest.sha256||''))throw Error('Unsupported or incomplete native backup.');
  const value={format:REQUEST,version:1,id:crypto.randomUUID(),kind:'restore-native',baseGeneration:active.generation,sha256:manifest.sha256};
  const target=path.join(profile,'sqlite','restore-input-'+value.id);fs.mkdirSync(target);
  require('./storage-space').check(target,fs.statSync(snapshot).size*3,'Stage native restore');
  const staged=path.join(target,'snapshot.sqlite');await fs.promises.copyFile(snapshot,staged,fs.constants.COPYFILE_EXCL);
  if(await digest(staged)!==manifest.sha256)throw Error('Native backup checksum mismatch. Nothing was selected.');
  const fd=fs.openSync(staged,'r+');try{fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  publish(path.join(target,'manifest.json'),manifest);await beforePublish();publish(requestFile(profile),value);return value;
}
function canCancel(profile){try{const pending=read(requestFile(profile));if(!pending||pending.kind==='new')return false;validateRequest(pending);const active=selected(profile);return active?.requestId!==pending.id;}catch{return false;}}
function cancel(profile){if(!canCancel(profile))throw Error('No safely cancellable storage request.');fs.unlinkSync(requestFile(profile));}
async function startup(profile,{checkpoint=()=>{}}={}){
  const active=selected(profile),pending=read(requestFile(profile));
  const restoring=pending&&['restore','restore-native'].includes(pending.kind);
  if(active&&(!pending||active.requestId===pending.id||!restoring))return active;
  if(!pending)return null;validateRequest(pending);
  const fresh=pending.kind==='new';
  if(pending.kind!==undefined&&!restoring&&!fresh)throw Error('Unknown storage request.');
  if(fresh)assertNoLegacy(profile);
  if(restoring&&(!active||pending.baseGeneration!==active.generation))throw Error('Restore request belongs to another database generation.');
  const generation=crypto.randomUUID(),root=fs.realpathSync(profile),parent=path.join(root,'sqlite');
  fs.mkdirSync(parent,{recursive:true});if(fs.realpathSync(parent)!==parent)throw Error('SQLite directory must be inside the application profile.');
  const directory=path.join(parent,generation);fs.mkdirSync(directory);
  const Client=require('./sqlite-client');let client=new Client();
  try{
    checkpoint('before-copy');
    let sources=[];
    if(restoring){
      const native=pending.kind==='restore-native',source=path.join(root,'sqlite','restore-input-'+pending.id+(native?'':'.json')),file=native?path.join(source,'snapshot.sqlite'):source;
      if(!fs.lstatSync(file).isFile()||await digest(file)!==pending.sha256)throw Error('Staged restore checksum mismatch. The active database has not been changed.');
      await client.openWorking(path.join(active.directory,'working'));await client.backupSnapshot(path.join(directory,'before-restore'));await client.close();client=new Client();checkpoint('copy-verified');
      if(native)await client.restoreSnapshot(source,path.join(directory,'working'));
      else {const restored=await client.restoreLegacy(source,path.join(directory,'restore'));fs.renameSync(restored.destination,path.join(directory,'working'));}
    }else{
      let source=path.join(root,'slotforge-timing.json');
      if(fresh){
        // Default records are seeded only inside this unpublished generation, never in the user's JSON location.
        const seed=path.join(directory,'seed');fs.mkdirSync(seed);source=path.join(seed,'slotforge-timing.json');
        const db=new (require('./db'))(source);db.saveNow();
      }
      const report=await client.migrate(source,path.join(directory,'copy'));sources=report.sources;checkpoint('copy-verified');
      await client.forkCopy(path.join(directory,'copy'),path.join(directory,'working'));
    }
    checkpoint('fork-created');
    await client.openWorking(path.join(directory,'working'));await client.lifecycleDiagnostics();await client.close();checkpoint('working-verified');
    if(fresh)assertNoLegacy(root);
    if(!restoring&&!fresh){
      for(const [name,file] of [['source.json','slotforge-timing.json'],['source.settings.json','slotforge-timing.settings.json'],['race-resume.json','race-resume.json']]){
        const expected=sources.find(s=>s.name===name)?.sha256||null;let actual=null;try{actual=await digest(path.join(root,file));}catch(e){if(e.code!=='ENOENT')throw e;}if(actual!==expected)throw Error('Legacy files changed before activation. Nothing was selected; retry with the app closed.');
      }
    }
    const value={format:FORMAT,version:1,backend:'sqlite',generation,requestId:pending.id,activatedAt:new Date().toISOString(),sources,...(fresh?{origin:'new'}:{}),...(active?{previousGeneration:active.generation}:{})};
    checkpoint('before-publish');publish(selectionFile(root),value);checkpoint('after-publish');
    fs.unlinkSync(requestFile(root));return selected(root);
  }finally{await client.close().catch(()=>{});}
}
module.exports={FORMAT,REQUEST,selected,request,requestNew,requestRestore,requestNativeRestore,startup,publish,digest,canCancel,cancel};
