const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {names,digest,assetName,validate}=require('../tools/ci/desktop-artifacts.cjs');
const publish=require('../tools/ci/publish-desktop.cjs'),version=require('../package.json').version;
const commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
test('desktop release names cover all configured targets and reject wrong versions',()=>{
  assert.equal(new Set(['win32','darwin','linux'].flatMap(p=>names(version,p))).size,6);
  validate(version,'v'+version);assert.throws(()=>validate(version,'v0.0.1'));
  assert.throws(()=>names('../../file','linux'));assert.throws(()=>names(version,'unknown'));
});
test('publisher verifies artifacts, preserves existing downloads and is repeatable',async()=>{
  const cwd=process.cwd(),oldTag=process.env.RELEASE_TAG,temp=fs.mkdtempSync(path.join(os.tmpdir(),'desktop-publish-'));
  const remote=[],uploads=[];let remoteCommit=commit;
  try{
    for(const [folder,platform] of [['windows','win32'],['linux','linux'],['mac','darwin']]){
      const dir=path.join(temp,'native-downloads','desktop-'+folder);fs.mkdirSync(dir,{recursive:true});
      const assets=names(version,platform).map(n=>{const name=assetName(n),b=Buffer.from(name);fs.writeFileSync(path.join(dir,name),b);return {name,size:b.length,sha256:digest(b)};});
      fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify({version,platform,commit,assets}));
    }
    // The publisher checks out and resolves the exact release tag; simulate that Git checkout.
    const original=cp.execFileSync;cp.execFileSync=(command,args,options)=>command==='git'&&args.join(' ')==='rev-parse HEAD'?commit+'\n':original(command,args,options);
    process.chdir(temp);process.env.RELEASE_TAG='v'+version;
    try{
      const github={rest:{repos:{
        getCommit:async()=>({data:{sha:remoteCommit}}),
        getReleaseByTag:async()=>({data:{id:123,draft:false,immutable:false,html_url:'test'}}),
        listReleaseAssets:()=>{},
        uploadReleaseAsset:async({name,data})=>{uploads.push(name);const a={name,size:data.length,state:'uploaded',digest:'sha256:'+digest(data)};remote.push(a);return {data:a};}
      }},paginate:async()=>remote.slice()};
      const invoke=()=>publish({github,context:{repo:{owner:'test',repo:'test'}},core:{info:()=>{}}});
      remoteCommit='moved';await assert.rejects(invoke(),/tag moved/);assert.equal(uploads.length,0);remoteCommit=commit;
      const file=path.join('native-downloads','desktop-linux',names(version,'linux')[0]),bytes=fs.readFileSync(file);
      fs.writeFileSync(file,'bad');await assert.rejects(invoke());assert.equal(uploads.length,0);fs.writeFileSync(file,bytes);
      // A local Windows build may already have been published. Keep it and checksum that actual asset.
      remote.push({name:assetName(names(version,'win32')[0]),size:888,state:'uploaded',digest:'sha256:'+'f'.repeat(64)});
      await invoke();assert.equal(uploads.length,6);assert(!uploads.includes(remote[0].name));
      await invoke();assert.equal(uploads.length,6,'Rerun never reuploads an existing asset');
      remote[0].digest='sha256:'+'e'.repeat(64);await assert.rejects(invoke(),/checksums differ/);
    }finally{cp.execFileSync=original;}
  }finally{process.chdir(cwd);if(oldTag===undefined)delete process.env.RELEASE_TAG;else process.env.RELEASE_TAG=oldTag;fs.rmSync(temp,{recursive:true,force:true});}
});
