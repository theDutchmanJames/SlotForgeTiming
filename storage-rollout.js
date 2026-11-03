'use strict';
// Runs under the application's single-instance lock, before opening a mutable JSON database.
const fs=require('node:fs'),path=require('node:path'),Activation=require('./storage-activation');
const preferenceFile=p=>path.join(p,'storage-conversion-prompt.json');
const WEEK=7*24*60*60*1000;
const PROMPT={type:'question',title:'Upgrade database storage',message:'Switch your existing database to SQLite?',
  detail:'SQLite saves individual records instead of rewriting the whole collection. Timing will convert and verify a separate copy before opening it. Your original JSON database and settings stay untouched during conversion. Allow space for the original files, recovery copy and SQLite database; a large collection may take several minutes.\n\nAfter switching, new changes are saved only to SQLite. Export a current backup before returning to an older version. You can also convert later under App Settings → General → Database storage.',
  buttons:['Convert and continue','Remind me in a week','Keep using JSON'],defaultId:1,cancelId:1,noLink:true};
function assertFresh(profile){
  const traces=fs.readdirSync(profile).filter(name=>/^slotforge-timing(?:\.|$)/i.test(name)||/^(?:sqlite(?:$|-)|storage-(?:backend|conversion-prompt)\.|race-resume(?:\.|$))/i.test(name));
  if(traces.length)throw Error('Existing database or recovery files were found, but the main database is missing. Restore your database before continuing; Timing has not created an empty replacement.');
}
function due(profile,now){
  try{const p=JSON.parse(fs.readFileSync(preferenceFile(profile),'utf8'));return !(p&&p.version===1&&(p.choice==='keep'||p.choice==='later'&&Number.isFinite(p.nextPromptAt)&&p.nextPromptAt>now));}
  catch(e){if(e.code==='ENOENT'||e instanceof SyntaxError)return true;throw e;}
}
async function startup(profile,{ask,now=Date.now(),checkpoint}={}){
  fs.mkdirSync(profile,{recursive:true});
  // Pending work always resumes, including an interrupted first installation.
  if(fs.existsSync(path.join(profile,'storage-backend.json'))||fs.existsSync(path.join(profile,'sqlite-activation-request.json')))return Activation.startup(profile,{checkpoint});
  const source=path.join(profile,'slotforge-timing.json');
  if(!fs.existsSync(source)){
    assertFresh(profile);Activation.requestNew(profile);return Activation.startup(profile,{checkpoint});
  }
  if(!fs.lstatSync(source).isFile())throw Error('The JSON database must be a regular file.');
  if(!due(profile,now))return null;
  const answer=await ask({...PROMPT,buttons:[...PROMPT.buttons]});
  if(answer.response===0){Activation.request(profile);return Activation.startup(profile,{checkpoint});}
  Activation.publish(preferenceFile(profile),{version:1,choice:answer.response===2?'keep':'later',nextPromptAt:now+WEEK});
  return null;
}
module.exports={startup,assertFresh,due,PROMPT,WEEK};
