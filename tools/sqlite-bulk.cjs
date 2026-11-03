// Developer-only operations on explicit experimental copies. Never activates SQLite in the app.
const path=require('node:path'),Client=require('../sqlite-client');
async function main(){
 const [operation,source,destination,...extra]=process.argv.slice(2);
 if(!source||!destination||extra.length||!['backup','restore','export-json','restore-json'].includes(operation))throw Error('Usage: node tools/sqlite-bulk.cjs <backup|restore|export-json|restore-json> <source> <new destination>');
 const client=new Client();try{
  let result;
  if(operation==='restore')result=await client.restoreSnapshot(path.resolve(source),path.resolve(destination));
  else if(operation==='restore-json')result=await client.restoreLegacy(path.resolve(source),path.resolve(destination));
  else{await client.openWorking(path.resolve(source));result=operation==='backup'?await client.backupSnapshot(path.resolve(destination)):await client.exportLegacy(path.resolve(destination));}
  console.log(JSON.stringify(result,null,2));
 }finally{await client.close();}
}main().catch(error=>{console.error(error.message);process.exitCode=1;});
