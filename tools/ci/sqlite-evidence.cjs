// Publish only small QA evidence, never database files or synthetic media collections.
const fs=require('node:fs'),path=require('node:path');
const source=path.resolve(__dirname,'../../../outputs/sqlite-conversion'),target=path.resolve(__dirname,'../../.tmp-test/sqlite-evidence');
function copy(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())copy(file);else if(entry.isFile()&&(/\.(log|png)$/.test(entry.name)||entry.name==='result.json')){const dest=path.join(target,path.relative(source,file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}}}
copy(source);
