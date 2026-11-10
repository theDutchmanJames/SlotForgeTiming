'use strict';
// Historical pre-activation builder; its closed-gate assertions deliberately
// reject activated source. Never activate the working source: build a baseline and instrument a separate
// disposable package. The manifest lists every qualification-only difference.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),outputs=path.resolve(root,'../outputs');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
async function main(){
 const original=fs.readFileSync(path.join(root,'shared-library-client.js')),closed='mergeCompatibility=false';assert(original.toString().includes(closed));
 assert.equal(require('../../vendor/slotforge-library/engine/src/car-merge-storage.cjs').enabled(),false);
 const parent=process.argv[2]?path.resolve(process.argv[2]):fs.mkdtempSync(path.join(outputs,'merge-installed-'));assert.equal(path.dirname(parent),outputs);assert(path.basename(parent).startsWith('merge-installed-'));assert(!fs.existsSync(path.join(parent,'candidate-manifest.json')),'Completed candidates are immutable');
 const baseline=path.join(parent,'baseline'),candidate=path.join(parent,'timing'),staging=path.join(parent,'staging');
 const {build,Platform}=require('electron-builder');
 if(!process.argv[2])await build({projectDir:root,targets:Platform.WINDOWS.createTarget('dir'),publish:'never',config:{directories:{output:baseline},electronDist:path.join(root,'node_modules/electron/dist'),npmRebuild:false,win:{signAndEditExecutable:false}}});
 const asar=require('@electron/asar'),relative='win-unpacked/resources/app.asar',sourceArchive=path.join(baseline,relative);
 assert(asar.extractFile(sourceArchive,'shared-library-client.js').equals(original));
 const engineManifest=require('../../vendor/slotforge-library/MANIFEST.json');
 for(const file of engineManifest.files)assert.equal(hash(asar.extractFile(sourceArchive,path.normalize('vendor/slotforge-library/'+file.path))),file.sha256,'Packaged engine mismatch: '+file.path);
 fs.cpSync(baseline,candidate,{recursive:true});asar.extractAll(sourceArchive,staging);
 const client=path.join(staging,'shared-library-client.js');fs.writeFileSync(client,original.toString().replace(closed,'mergeCompatibility=true'));
 const pkgFile=path.join(staging,'package.json'),pkg=JSON.parse(fs.readFileSync(pkgFile));assert.equal(pkg.main,'main.js');pkg.main='merge-qualification.cjs';fs.writeFileSync(pkgFile,JSON.stringify(pkg,null,2));
 fs.copyFileSync(path.join(__dirname,'merge-candidate-bootstrap.cjs'),path.join(staging,pkg.main));
 const archive=path.join(candidate,relative);await asar.createPackageWithOptions(staging,archive,{unpack:'native/**/*.exe'});
 const changed=new Set(['package.json','shared-library-client.js','merge-qualification.cjs']);let verified=0;
 for(const item of asar.listPackage(archive)){
  const file=item.replace(/^[/\\]/,'').replaceAll('\\','/');if(asar.statFile(archive,path.normalize(file)).files)continue;
  if(changed.has(file))continue;assert(asar.extractFile(archive,path.normalize(file)).equals(asar.extractFile(sourceArchive,path.normalize(file))),'Unexpected candidate change: '+file);verified++;
 }
 assert(fs.readFileSync(path.join(root,'shared-library-client.js')).equals(original));
 const manifest={version:pkg.version,platform:process.platform,arch:process.arch,parent,baselineArchive:sourceArchive,baselineSha256:hash(fs.readFileSync(sourceArchive)),archive,archiveSha256:hash(fs.readFileSync(archive)),executable:path.join(candidate,'win-unpacked',require('../../package.json').build.productName+'.exe'),engineArtifact:'merge-phase5-20261110-r3',engineManifestSha256:'e9c09361a6f9439f9687ddc8a1ff56c613fc1ed2e314f5c0b4876c29b932705f',verifiedUnchangedFiles:verified,qualificationOnlyChanges:[...changed],published:false,productionMergeActivation:false};
 fs.writeFileSync(path.join(parent,'candidate-manifest.json'),JSON.stringify(manifest,null,2));fs.writeFileSync(path.join(outputs,'merge-installed-latest.json'),JSON.stringify({parent,manifest:path.join(parent,'candidate-manifest.json')},null,2));console.log(JSON.stringify(manifest,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
