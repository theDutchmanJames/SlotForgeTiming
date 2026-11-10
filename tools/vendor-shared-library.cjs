'use strict';
// Import a reviewed common-engine artifact without reaching into the host app.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const source=path.resolve(process.argv[2]||''),target=path.resolve(__dirname,'../vendor/slotforge-library');
if(!process.argv[2])throw Error('Supply the shared-engine candidate directory.');
const sourceManifest=fs.readFileSync(path.join(source,'MANIFEST.json'));
const manifest=JSON.parse(sourceManifest);
if(manifest.engineVersion!=='1.0.0'||!Array.isArray(manifest.files))throw Error('Unsupported shared-engine artifact.');
const seen=new Set(),files=manifest.files.map(entry=>{
 if(typeof entry.path!=='string'||entry.path.includes('\\')||entry.path.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(entry.path)||seen.has(entry.path))throw Error('Invalid manifest path.');
 seen.add(entry.path);const file=path.join(source,entry.path);if(!fs.lstatSync(file).isFile())throw Error('Not a regular source file.');
 const bytes=fs.readFileSync(file);if(crypto.createHash('sha256').update(bytes).digest('hex')!==entry.sha256)throw Error('Artifact checksum mismatch: '+entry.path);
 return {name:entry.path,bytes};
});
// Human coordination reports are not runtime or regression fixtures. Verify
// their upstream bytes above, but omit them from the distributable manifest.
const coordination=name=>name.startsWith('merge-contract/')&&name.endsWith('.md');
for(const {name,bytes}of files){if(coordination(name))continue;const file=path.join(target,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes);}
manifest.upstreamManifestSha256=crypto.createHash('sha256').update(sourceManifest).digest('hex');
manifest.files=manifest.files.filter(entry=>!coordination(entry.path));
fs.writeFileSync(path.join(target,'MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
console.log('Verified and vendored '+files.length+' shared-engine files.');
