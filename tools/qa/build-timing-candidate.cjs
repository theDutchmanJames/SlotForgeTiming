'use strict';
// Build normal, unpublished Windows artifacts. Never launch an installed app.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),outputs=path.resolve(root,'../outputs');
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const pkg=require('../../package.json'),lock=require('../../package-lock.json');
 assert.equal(pkg.version,'2.2.0');assert.equal(lock.version,pkg.version);assert.equal(lock.packages[''].version,pkg.version);
 assert.equal(require('../../paddock-rich-gate').enabled(),true);
 const parent=fs.mkdtempSync(path.join(outputs,'timing-2.2.0-candidate-')),dist=path.join(parent,'dist');
 const {build,Platform}=require('electron-builder');
 await build({projectDir:root,targets:Platform.WINDOWS.createTarget(['nsis','portable']),publish:'never',config:{directories:{output:dist},electronDist:path.join(root,'node_modules/electron/dist'),npmRebuild:false}});
 const asar=require('@electron/asar'),archive=path.join(dist,'win-unpacked/resources/app.asar');
 const meta=JSON.parse(asar.extractFile(archive,'package.json'));
 assert.equal(meta.version,pkg.version);assert.equal(meta.main,'main.js');assert.equal(meta.installedQaRole,undefined);
 const gate=asar.extractFile(archive,'paddock-rich-gate.js');assert(gate.equals(fs.readFileSync(path.join(root,'paddock-rich-gate.js'))));assert.match(gate.toString(),/const VERIFIED = true;/);
 const files=asar.listPackage(archive).map(f=>f.replace(/^[/\\]/,'').replaceAll('\\','/')),sources=[];
 for(const file of files){
  const stat=asar.statFile(archive,path.normalize(file));if(stat.files)continue;
  assert(!/^(?:tools|tests|outputs|docs)\//.test(file),'QA/development directory shipped: '+file);
  assert(!/installed-history-bootstrap|joint-history-app|candidate.*bootstrap/.test(file),'QA entry point shipped');
  if(file==='package.json'||file.startsWith('node_modules/'))continue;
  const source=path.join(root,file);assert(fs.existsSync(source),'Packaged file has no source: '+file);
  const bytes=stat.unpacked?fs.readFileSync(path.join(archive+'.unpacked',file)):asar.extractFile(archive,path.normalize(file));
  assert(bytes.equals(fs.readFileSync(source)),'Packaged/source mismatch: '+file);
  sources.push({file,sha256:digest(bytes),unpacked:!!stat.unpacked});
 }
 const artifactNames=[`SlotForge Timing-${pkg.version}-Portable.exe`,`SlotForge Timing-${pkg.version}-Setup.exe`];
 const artifacts=artifactNames.map(name=>{const file=path.join(dist,name),bytes=fs.readFileSync(file);assert(bytes.length>1000000);return {file,size:bytes.length,sha256:digest(bytes)};});
 const head=cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 const dirty=!!cp.execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim();
 const manifest={version:pkg.version,platform:process.platform,arch:process.arch,published:false,baseCommit:head,workingTreeDirty:dirty,releaseCommit:null,archive,archiveSha256:digest(fs.readFileSync(archive)),sources,artifacts,inspection:{normalEntry:true,richDeliveryEnabled:true,noQaBootstrap:true,sourceMatched:true},jointQualification:'pending Paddock activation candidate'};
 fs.writeFileSync(path.join(parent,'candidate-manifest.json'),JSON.stringify(manifest,null,2));
 fs.writeFileSync(path.join(parent,'SHA256SUMS.txt'),artifacts.map(a=>`${a.sha256}  ${path.basename(a.file)}`).join('\n')+'\n');
 fs.writeFileSync(path.join(outputs,'timing-2.2.0-candidate-latest.json'),JSON.stringify({parent,dist,manifest:path.join(parent,'candidate-manifest.json')},null,2));
 console.log(JSON.stringify({parent,filesVerified:sources.length,artifacts},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
