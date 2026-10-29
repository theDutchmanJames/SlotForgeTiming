const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const P=require('./pluginpackage'),Database=require('./db');
// All host-managed paths stay inside this root. Never follow package symlinks.
function within(root,...parts){const file=path.resolve(root,...parts),prefix=path.resolve(root)+path.sep;P.ok(file.startsWith(prefix),'Path escapes plugin storage.');return file;}
function noLinks(file){let p=path.resolve(file);while(true){if(fs.existsSync(p))P.ok(!fs.lstatSync(p).isSymbolicLink(),'Symbolic links are not allowed in plugin storage.');const parent=path.dirname(p);if(parent===p)break;p=parent;}}
function safeFile(file){noLinks(file);P.ok(fs.statSync(file).isFile(),'Expected a regular plugin file.');}
function removeTree(root,target){
  const file=within(root,path.relative(root,target));noLinks(file);
  if(!fs.existsSync(file))return;
  const inspect=p=>{P.ok(!fs.lstatSync(p).isSymbolicLink(),'Refusing to remove a linked plugin directory.');if(fs.statSync(p).isDirectory())for(const n of fs.readdirSync(p))inspect(path.join(p,n));};
  inspect(file);fs.rmSync(file,{recursive:true,force:true});
}
class Store {
 constructor(root,appVersion){
  this.root=path.resolve(root);this.appVersion=appVersion;this.file=within(this.root,'library.json');this.error='';this.state={format:'slotforge-plugin-library',version:1,plugins:[]};
  try{
   noLinks(this.root);fs.mkdirSync(this.root,{recursive:true});
   if(fs.existsSync(this.file)){
    safeFile(this.file);P.ok(fs.statSync(this.file).size<2*1024*1024,'Plugin library is too large.');
    const s=JSON.parse(fs.readFileSync(this.file,'utf8'));P.ok(s.format===this.state.format&&s.version===1&&Array.isArray(s.plugins)&&s.plugins.length<=32,'Invalid plugin library.');
    const ids=new Set();for(const r of s.plugins){this.checkRecord(r);P.ok(!ids.has(r.current.manifest.id),'Duplicate plugin ID.');ids.add(r.current.manifest.id);}
    this.state=s;
   }
  }catch(e){this.error='Plugin library unavailable; no plugins will start. '+e.message;}
 }
 checkRecord(r){
  P.ok(P.object(r)&&typeof r.enabled==='boolean','Invalid plugin entry.');
  const snapshot=s=>{P.ok(P.object(s)&&/^[a-f0-9]{64}$/.test(s.digest),'Invalid package fingerprint.');s.manifest=P.manifest(s.manifest);P.ok(s.slot===s.manifest.version+'-'+s.digest.slice(0,16),'Invalid plugin directory.');s.settings=P.settings(s.manifest,s.settings);};
  snapshot(r.current);if(r.previous){snapshot(r.previous);P.ok(r.previous.manifest.id===r.current.manifest.id,'Invalid rollback identity.');}
 }
 get(id){P.ok(!this.error,this.error);const r=this.state.plugins.find(r=>r.current.manifest.id===id);P.ok(r,'Plugin not found.');return r;}
 mutate(change){
  P.ok(!this.error,this.error);const next=P.clone(this.state);change(next);P.ok(next.plugins.length<=32,'At most 32 plugins can be installed.');
  next.plugins.forEach(r=>this.checkRecord(r));noLinks(this.file);
  if(fs.existsSync(this.file)){noLinks(this.file+'.bak');fs.copyFileSync(this.file,this.file+'.bak');}
  Database.writeAtomic(this.file,JSON.stringify(next));this.state=next;
 }
 packageDir(snapshot){return within(this.root,'packages',snapshot.manifest.id,snapshot.slot);}
 install(raw){
  P.ok(!this.error,this.error);
  const pack=P.validate(raw,this.appVersion),m=pack.manifest,hash=P.digest(pack),slot=m.version+'-'+hash.slice(0,16),old=this.state.plugins.find(r=>r.current.manifest.id===m.id);
  P.ok(!old||P.compare(m.version,old.current.manifest.version)>0,'Install a higher version, or use Roll back.');
  P.ok(old||this.state.plugins.length<32,'At most 32 plugins can be installed.');
  const snapshot={manifest:m,digest:hash,slot,settings:P.settings(m)},dest=this.packageDir(snapshot),stage=within(this.root,'staging',crypto.randomUUID());
  noLinks(stage);fs.mkdirSync(stage,{recursive:true});
  try{
   for(const [name,encoded]of Object.entries(pack.files)){const f=within(stage,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,Buffer.from(encoded,'base64'),{flag:'wx'});}
   fs.writeFileSync(path.join(stage,'bundle.slotforge-plugin'),JSON.stringify(pack),{flag:'wx'});
   noLinks(dest);fs.mkdirSync(path.dirname(dest),{recursive:true});
   // A rollback can leave this version referenced as the previous snapshot.
   // Never delete it while installing: verify and reuse the identical package.
   if(fs.existsSync(dest)){
    this.verifySnapshot(snapshot);
   }else fs.renameSync(stage,dest);
   this.mutate(s=>{const i=s.plugins.findIndex(r=>r.current.manifest.id===m.id),prior=s.plugins[i];const r={current:snapshot,enabled:false,...(prior?{previous:prior.current}:{})};if(prior)s.plugins[i]=r;else s.plugins.push(r);});
  }finally{if(fs.existsSync(stage))removeTree(this.root,stage);}
  return P.summary(pack);
 }
 verifySnapshot(s){
  P.compatible(s.manifest,this.appVersion);const dir=this.packageDir(s),file=path.join(dir,'bundle.slotforge-plugin');safeFile(file);
  P.ok(fs.statSync(file).size<=P.MAX_BYTES,'Stored plugin is too large.');const p=P.validate(JSON.parse(fs.readFileSync(file,'utf8')),this.appVersion);
  P.ok(P.digest(p)===s.digest,'Plugin fingerprint changed. Reinstall a reviewed package.');
  P.ok(JSON.stringify(p.manifest)===JSON.stringify(P.manifest(s.manifest)),'Plugin manifest metadata changed. Reinstall a reviewed package.');
  P.settings(p.manifest,s.settings);
  const expected=new Set([...Object.keys(p.files),'bundle.slotforge-plugin']);
  const walk=(folder,prefix='')=>{noLinks(folder);for(const name of fs.readdirSync(folder)){const f=path.join(folder,name),rel=prefix+name;noLinks(f);if(fs.statSync(f).isDirectory())walk(f,rel+'/');else{P.ok(expected.has(rel),'Unexpected file in plugin package.');safeFile(f);if(rel!=='bundle.slotforge-plugin'){P.ok(fs.statSync(f).size<=9*1024*1024,'Stored plugin file is too large.');P.ok(fs.readFileSync(f).equals(Buffer.from(p.files[rel],'base64')),'Plugin file changed after review: '+rel);}expected.delete(rel);}}};
  walk(dir);P.ok(!expected.size,'Plugin files are missing.');
  return {dir,p};
 }
 verify(id){
  const s=this.get(id).current,{dir,p}=this.verifySnapshot(s);
  const data=within(this.root,'data',id);noLinks(data);fs.mkdirSync(data,{recursive:true});
  return {entry:path.join(dir,p.entry),dataDir:data,manifest:P.clone(s.manifest),settings:P.clone(s.settings)};
 }
 enable(id,on){this.get(id);P.ok(typeof on==='boolean','Invalid enabled state.');this.mutate(s=>{s.plugins.find(r=>r.current.manifest.id===id).enabled=on;});}
 disableAll(){this.mutate(s=>s.plugins.forEach(r=>r.enabled=false));}
 saveSettings(id,values){const r=this.get(id),clean=P.settings(r.current.manifest,values);this.mutate(s=>{s.plugins.find(r=>r.current.manifest.id===id).current.settings=clean;});}
 rollback(id){const r=this.get(id);P.ok(r.previous,'No previous version available.');P.compatible(r.previous.manifest,this.appVersion);this.mutate(s=>{const x=s.plugins.find(r=>r.current.manifest.id===id);[x.current,x.previous]=[x.previous,x.current];x.enabled=false;});}
 remove(id,deleteData=false){
  P.ok(P.id(id),'Invalid plugin identity.');this.get(id);this.mutate(s=>{s.plugins=s.plugins.filter(r=>r.current.manifest.id!==id);});
  // Registry removal first: a cleanup failure must not leave executable code enabled.
  removeTree(this.root,within(this.root,'packages',id));if(deleteData)removeTree(this.root,within(this.root,'data',id));
 }
}
module.exports={Store,within,noLinks,removeTree};
