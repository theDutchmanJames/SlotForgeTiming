'use strict';
// Credentials never leave the main process. Reading discovery must not change its permissions.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {execFile}=require('node:child_process');
const ID=/^[A-Za-z0-9_-]{1,100}$/,KEY=/^[a-f0-9]{64}\.json$/;
function directory(platform=process.platform,env=process.env,home=os.homedir()){
 const base=platform==='win32'?env.LOCALAPPDATA:platform==='darwin'?path.join(home,'Library','Application Support'):env.XDG_RUNTIME_DIR||env.XDG_STATE_HOME||path.join(home,'.local','state');
 if(!base||!path.isAbsolute(base))throw Error('A private user directory is required for the local Paddock library.');
 return path.join(base,platform==='linux'?'slotforge':'SlotForge','local-libraries','v1');
}
function descriptor(v){
 const keys=['format','version','instanceId','pid','address','token','databaseId','name'];
 if(!v||Object.keys(v).length!==keys.length||keys.some(k=>!Object.hasOwn(v,k))||v.format!=='slotforge-local-library'||v.version!==1||typeof v.instanceId!=='string'||!ID.test(v.instanceId)||typeof v.databaseId!=='string'||!ID.test(v.databaseId)||!Number.isSafeInteger(v.pid)||v.pid<1||typeof v.name!=='string'||v.name.length>200||typeof v.token!=='string'||!(/^[A-Za-z0-9_-]{43}$/).test(v.token)||typeof v.address!=='string'||!(/^http:\/\/127\.0\.0\.1:[0-9]{1,5}$/).test(v.address))throw Error('Invalid local Paddock discovery information.');
 const u=new URL(v.address);if(!u.port||Number(u.port)>65535||u.origin!==v.address)throw Error('Invalid local Paddock endpoint.');return v;
}
async function windowsPermissions(folder,names){
 const script=`$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
$folder=$env:SLOTFORGE_CHECK_DIRECTORY
$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
function Assert-Private($p){
 $item=Get-Item -LiteralPath $p -Force
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Redirected discovery'}
 $acl=if($item -is [IO.DirectoryInfo]){[IO.Directory]::GetAccessControl($p)}else{[IO.File]::GetAccessControl($p)}
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ne $sid.Value){throw 'Wrong discovery owner'}
 foreach($r in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){
  if($r.AccessControlType -eq 'Allow' -and $r.IdentityReference.Value -ne $sid.Value){throw 'Discovery is not private'}
 }
}
Assert-Private $folder
$valid=@(foreach($name in (ConvertFrom-Json $env:SLOTFORGE_CHECK_FILES)){
 try{Assert-Private (Join-Path $folder $name);$name}catch{}
})
ConvertTo-Json -InputObject $valid -Compress`;
 return new Promise((resolve,reject)=>execFile('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],{windowsHide:true,timeout:15000,maxBuffer:16384,env:{...process.env,SLOTFORGE_CHECK_DIRECTORY:folder,SLOTFORGE_CHECK_FILES:JSON.stringify(names)}},(e,out)=>{
  const failure=()=>reject(Error('Local Paddock discovery permissions could not be verified. Enable Local library access again in Paddock.'));
  if(e)return failure();try{const valid=JSON.parse(out);if(!Array.isArray(valid)||valid.some(n=>!names.includes(n)))return failure();resolve(valid);}catch{failure();}
 }));
}
async function scan({folder=directory(),platform=process.platform,uid=process.getuid?.(),checkWindows=windowsPermissions,validate=descriptor}={}){
 try{for(let p=folder;;p=path.dirname(p)){const s=await fs.lstat(p);if(s.isSymbolicLink())throw Error('Local Paddock discovery cannot use redirected paths.');if(p===path.dirname(p))break;}}
 catch(e){if(e.code==='ENOENT')return [];throw e;}
 const stat=await fs.lstat(folder);
 const privateStat=s=>s.uid===uid&&(s.mode&0o077)===0;
 if(!stat.isDirectory()||platform!=='win32'&&!privateStat(stat))throw Error('Local Paddock discovery is not private to this user.');
 const names=(await fs.readdir(folder)).filter(n=>KEY.test(n)).sort();if(names.length>64)throw Error('Too many local Paddock descriptors.');
 const permitted=platform==='win32'?await checkWindows(folder,names):names;
 const found=[];
 for(const name of names){
  if(permitted&&!permitted.includes(name))continue;
  let handle;try{
   const file=path.join(folder,name),before=await fs.lstat(file);
   if(!before.isFile()||before.isSymbolicLink()||before.size>8192||platform!=='win32'&&!privateStat(before))throw Error('Unprotected local Paddock descriptor.');
   handle=await fs.open(file,'r');const opened=await handle.stat();
   if(!opened.isFile()||opened.ino!==before.ino||opened.dev!==before.dev||opened.size>8192||platform!=='win32'&&!privateStat(opened))throw Error('Local Paddock discovery changed while reading.');
   const buffer=Buffer.alloc(8193),{bytesRead}=await handle.read(buffer,0,buffer.length,0);
   if(bytesRead>8192)throw Error('Local Paddock descriptor exceeds its size limit.');
   let v;try{v=JSON.parse(buffer.subarray(0,bytesRead).toString('utf8'));}catch{throw Error('Invalid local Paddock discovery information.');}
   found.push({...await validate(v,name),key:name});
  // Reject an unsafe/stale entry, not every other valid library in this folder.
  }catch{}finally{await handle?.close();}
 }
 return found;
}
module.exports={directory,descriptor,scan,KEY};
