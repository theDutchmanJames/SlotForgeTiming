// Run every declared pretest/test command and retain individual logs.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../../../outputs/widget-engine-repairs/tests'));fs.mkdirSync(out,{recursive:true});
const pkg=require('../../package.json');const commands=(pkg.scripts.pretest+' && '+pkg.scripts.test).split(/\s*&&\s*/);
const results=[];
for(const [i,command]of commands.entries()){
 const args=command.split(/\s+/).slice(1),name=path.basename(args[0]);
 const r=cp.spawnSync(process.execPath,args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 fs.writeFileSync(path.join(out,name+'.log'),(r.stdout||'')+(r.stderr||'')+(r.error?String(r.error):''));
 results.push({command,status:r.status,error:r.error?.message});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
 console.log(`${i+1}/${commands.length} ${r.status===0?'PASS':'FAIL'} ${name}`);
}
process.exitCode=results.some(r=>r.status!==0)?1:0;
