// Only add missing assets. Never silently replace an already downloaded binary.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const {names,digest,assetName,validate}=require('./desktop-artifacts.cjs');
module.exports=async function({github,context,core}){
  const version=require('../../package.json').version,tag=process.env.RELEASE_TAG;
  assert(tag,'A release tag is required');validate(version,tag);
  const commit=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const ref=await github.rest.repos.getCommit({...context.repo,ref:tag});assert.equal(ref.data.sha,commit,'Release tag moved during build');
  const release=(await github.rest.repos.getReleaseByTag({...context.repo,tag})).data;
  assert(!release.draft&&!release.immutable,'Expected a published, mutable release');
  const existing=await github.paginate(github.rest.repos.listReleaseAssets,{...context.repo,release_id:release.id,per_page:100});
  const packages=[];
  for(const [folder,platform] of [['windows','win32'],['linux','linux'],['mac','darwin']]){
    const dir=path.join('native-downloads','desktop-'+folder),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json')));
    assert.equal(manifest.commit,commit);assert.equal(manifest.version,version);assert.equal(manifest.platform,platform);
    assert.deepEqual(manifest.assets.map(a=>a.name),names(version,platform).map(assetName));
    for(const a of manifest.assets){
      const file=path.join(dir,a.name),bytes=fs.readFileSync(file);assert.equal(bytes.length,a.size);assert.equal(digest(bytes),a.sha256);
      packages.push({...a,file});
    }
  }
  const published=[];
  for(const a of packages){
    let remote=existing.find(x=>x.name===a.name);
    if(remote)core.info('Keeping existing release download: '+a.name);
    else{
      remote=(await github.rest.repos.uploadReleaseAsset({...context.repo,release_id:release.id,name:a.name,data:fs.readFileSync(a.file)})).data;
      assert.equal(remote.digest,'sha256:'+a.sha256);assert.equal(remote.size,a.size);
    }
    assert.equal(remote.state,'uploaded');assert.match(remote.digest||'',/^sha256:[a-f0-9]{64}$/);
    published.push(remote);
  }
  // Use server digests, including any previously published Windows packages.
  const sums=Buffer.from(published.map(a=>`${a.digest.slice(7)}  ${a.name}`).join('\n')+'\n');
  const name='SHA256SUMS-desktop.txt',prior=existing.find(a=>a.name===name);
  if(prior)assert.equal(prior.digest,'sha256:'+digest(sums),'Existing desktop checksums differ; inspect the release manually');
  else{
    const uploaded=(await github.rest.repos.uploadReleaseAsset({...context.repo,release_id:release.id,name,data:sums})).data;
    assert.equal(uploaded.digest,'sha256:'+digest(sums));
  }
  core.info('Desktop downloads verified: '+release.html_url);
};
