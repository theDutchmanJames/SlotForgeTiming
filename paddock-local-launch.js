'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),{createHash}=require('node:crypto');
const Discovery=require('./paddock-local-discovery');
async function plainPath(file,type){
 if(typeof file!=='string'||!path.isAbsolute(file))throw Error('Expected an absolute local path.');
 const stat=await fs.lstat(file);if(type==='file'&&!stat.isFile()||type==='directory'&&!stat.isDirectory())throw Error('Invalid registered path.');
 for(let p=file;;p=path.dirname(p)){if((await fs.lstat(p)).isSymbolicLink())throw Error('Redirected launcher path.');if(p===path.dirname(p))break;}
}
async function validate(v,name){
 if(!v||v.format!=='slotforge-local-library-launcher'||v.version!==1||!Discovery.KEY.test(v.libraryKey+'.json')||name!==v.libraryKey+'.json'||typeof v.databaseId!=='string'||!(/^[A-Za-z0-9_-]{1,100}$/).test(v.databaseId)||typeof v.name!=='string'||v.name.length>200||!Array.isArray(v.args)||v.args.length<1||v.args.length>2)throw Error('Invalid local library registration.');
 await plainPath(v.profile,'directory');await plainPath(v.executable,'file');
 if(createHash('sha256').update(path.resolve(v.profile)).digest('hex')!==v.libraryKey||v.args.at(-1)!=='--slotforge-library-start='+v.libraryKey)throw Error('Registered library identity does not match.');
 if(v.args.length===2)await plainPath(v.args[0]);
 return v;
}
const scan=options=>Discovery.scan({...options,folder:options?.folder||path.join(Discovery.directory(),'launchers'),validate});
async function launch(v){
 // Revalidate immediately before spawning. Never use a shell or inherit an Electron/Node override.
 await validate(v,v.libraryKey+'.json');
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=require('node:child_process').spawn(v.executable,v.args,{shell:false,windowsHide:true,detached:true,stdio:'ignore',env});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();return child.pid;
}
module.exports={scan,validate,launch};
