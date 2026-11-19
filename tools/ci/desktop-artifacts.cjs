// Shared names keep collection, publication and tests in agreement.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
function names(version,platform){
  if(!/^\d+\.\d+\.\d+$/.test(version))throw Error('Expected a three-part release version');
  switch(platform){
    // (2.4.0) the names the update check of every SlotForge app looks for (update-check.cjs): <prefix>-<version>-<kind>-<arch>.<ext>
    case 'win32':return [`SlotForgeTiming-${version}-Portable-x64.exe`,`SlotForgeTiming-${version}-Setup-x64.exe`];
    case 'linux':return [`SlotForgeTiming-${version}-linux-x86_64.AppImage`,`SlotForgeTiming-${version}-linux-amd64.deb`];
    case 'darwin':return [`SlotForgeTiming-${version}-mac-universal.dmg`,`SlotForgeTiming-${version}-mac-universal.zip`];
    default:throw Error('Unsupported desktop platform');
  }
}
const digest=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const assetName=name=>name.replaceAll(' ','.');
function validate(version,tag){if(tag)assert.equal(tag,'v'+version,'Release tag must match package.json');}
function collect(version,platform,commit){
  const dest=path.join(root,'dist/downloads');fs.mkdirSync(dest,{recursive:true});
  const assets=names(version,platform).map(name=>{
    const source=path.join(root,'dist',name),bytes=fs.readFileSync(source);
    assert(bytes.length>1000000,'Package is unexpectedly small: '+name);
    const published=assetName(name);fs.copyFileSync(source,path.join(dest,published));
    return {name:published,size:bytes.length,sha256:digest(bytes)};
  });
  fs.writeFileSync(path.join(dest,'manifest.json'),JSON.stringify({version,platform,commit,assets},null,2));
  fs.writeFileSync(path.join(dest,'SHA256SUMS.txt'),assets.map(a=>`${a.sha256}  ${a.name}`).join('\n')+'\n');
}
if(require.main===module){
  const version=require('../../package.json').version;validate(version,process.env.RELEASE_TAG);
  if(process.argv[2]==='collect')collect(version,process.platform,cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim());
  else assert.equal(process.argv[2],'validate');
}
module.exports={names,digest,assetName,validate};
