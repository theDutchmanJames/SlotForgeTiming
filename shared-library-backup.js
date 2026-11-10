'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const FORMAT='slotforge-timing-shared-backup';
async function digest(file){const h=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
async function files(root,relative=''){
 const rows=[];for(const name of await fs.promises.readdir(path.join(root,relative))){const key=path.join(relative,name),stat=await fs.promises.lstat(path.join(root,key));if(stat.isSymbolicLink())throw Error('A backup cannot contain symbolic links.');if(stat.isDirectory())rows.push(...await files(root,key));else if(stat.isFile())rows.push({path:key.split(path.sep).join('/'),bytes:stat.size,sha256:await digest(path.join(root,key))});else throw Error('Unexpected backup file.');}return rows;
}
async function create({client,destination,privateBackup,version='',backend,profile}){
 if(!path.isAbsolute(destination)||!['json','sqlite'].includes(backend))throw Error('Choose a new absolute backup folder.');
 // Exclusive folder plus a final manifest: an interrupted attempt is never
 // mistaken for a verified backup, and no existing backup can be overwritten.
 await fs.promises.mkdir(destination);
 const privatePath=path.join(destination,backend==='sqlite'?'timing-private.sqlite-backup':'timing-private.json');
 await privateBackup(privatePath);
 if(profile)for(const name of ['shared-library-import.json','shared-library-restore.json']){const source=path.join(profile,name);if(!fs.existsSync(source))continue;const stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>64*1024*1024)throw Error('Invalid recovery journal.');const before=await digest(source),target=path.join(destination,name);await fs.promises.copyFile(source,target,fs.constants.COPYFILE_EXCL);if(await digest(target)!==before||await digest(source)!==before)throw Error('A recovery journal changed during backup. Try again after the operation finishes.');}
 const s=await client.status();const common=await client.handle.backup({databaseId:s.databaseId,recoveryId:s.recoveryId,revision:s.revision,destination:path.join(destination,'library.sfpbackup')});
 if(common.databaseId!==s.databaseId||common.recoveryId!==s.recoveryId||common.revision!==s.revision)throw Error('Shared backup identity changed.');
 const manifest={format:FORMAT,version:1,state:'verified',appVersion:version,createdAt:new Date().toISOString(),backend,sourceId:client.installationId,library:{databaseId:s.databaseId,recoveryId:s.recoveryId,revision:s.revision},files:await files(destination)};
 const pending=path.join(destination,'manifest.pending'),fd=await fs.promises.open(pending,'wx');try{await fd.writeFile(JSON.stringify(manifest,null,2));await fd.sync();}finally{await fd.close();}
 await fs.promises.rename(pending,path.join(destination,'manifest.json'));return {saved:true,path:destination,manifest};
}
async function verify(directory){
 const target=path.join(directory,'manifest.json'),stat=await fs.promises.lstat(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>1024*1024)throw Error('Invalid backup manifest.');
 const m=JSON.parse(await fs.promises.readFile(target,'utf8'));if(m.format!==FORMAT||m.version!==1||m.state!=='verified'||!['json','sqlite'].includes(m.backend)||!Array.isArray(m.files)||!m.files.some(f=>f.path==='library.sfpbackup'))throw Error('Incomplete shared-library backup.');
 const actual=(await files(directory)).filter(f=>f.path!=='manifest.json');
 const canonical=a=>JSON.stringify([...a].sort((a,b)=>a.path.localeCompare(b.path)));
 if(canonical(actual)!==canonical(m.files))throw Error('Backup files or checksums changed. Nothing was restored.');return m;
}
module.exports={create,verify,FORMAT};
