// QA-only diagnostics. A detached Windows GUI helper may outlive its console pipe.
// Never turn a logging failure into Electron's repeated native exception dialogs.
const fs=require('node:fs'),util=require('node:util');
module.exports=function install(file,onFatal){
  const log=(...args)=>fs.appendFileSync(file,util.format(...args)+'\n');
  for(const method of ['log','info','warn','error','debug'])console[method]=log;
  const streamError=error=>{log(error.stack||String(error));if(error.code!=='EPIPE')onFatal(error);};
  process.stdout.on('error',streamError);process.stderr.on('error',streamError);
  process.on('uncaughtException',error=>{log(error.stack||String(error));onFatal(error);});
  process.on('unhandledRejection',error=>{log(error?.stack||String(error));onFatal(error);});
  return log;
};
