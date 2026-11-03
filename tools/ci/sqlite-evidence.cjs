// Publish only small QA evidence, never database files or synthetic media collections.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../../outputs'),target=path.resolve(__dirname,'../../.tmp-test/sqlite-evidence');
function copy(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())copy(file);else if(entry.isFile()&&(/\.(log|png)$/.test(entry.name)||/^(results?|completion)\.json$/.test(entry.name))&&fs.statSync(file).size<=16*1024*1024){const dest=path.join(target,path.relative(source,file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}}}
for(const directory of ['sqlite-conversion','paddock-specs'])copy(path.join(source,directory));
