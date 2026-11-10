'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'../outputs/timing-legacy-reader'));
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(path.join(out,'projection'),{recursive:true});
const pairs=[['integration/timing-legacy/index.cjs','index.cjs'],['integration/timing-legacy/project.cjs','project.cjs'],...['paddock-historical-evidence.js','paddock-rich-mapper.js','paddock-rich-read.js','paddock-rich-schema.js','paddock-value-hash.js'].map(f=>[f,'projection/'+f])];
const files=[];for(const [source,target]of pairs){const bytes=fs.readFileSync(path.join(root,source));fs.writeFileSync(path.join(out,target),bytes);files.push({file:target,source,sha256:crypto.createHash('sha256').update(bytes).digest('hex')});}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({format:'slotforge-timing-legacy-reader',version:1,files},null,2));
console.log(out);
