const fs=require('fs'),path=require('path'),cp=require('child_process');
const out=path.resolve(__dirname,'../../../outputs/widget-surface-implementation/tests');
const results=JSON.parse(fs.readFileSync(path.join(out,'results.json'),'utf8'));
const changed=new Set(['widgetsurface','frame','widgetsettings','widgetpolish','allinone','chartwidgets','timing','delta','widgetview','help-current','help','depth','widgetfit','editorperformance','widgetoptions'].map(x=>'node tests/'+x+'.test.js'));
for(const r of results){
 if(r.status===0&&!changed.has(r.command))continue;
 const args=r.command.split(/\s+/).slice(1),name=path.basename(args[0]);
 const run=cp.spawnSync(process.execPath,args,{encoding:'utf8',timeout:180000,maxBuffer:8*1024*1024});
 fs.writeFileSync(path.join(out,name+'.recheck.log'),(run.stdout||'')+(run.stderr||'')+(run.error?String(run.error):''));
 r.status=run.status;r.error=run.error?.message;r.rechecked=true;console.log((run.status===0?'PASS ':'FAIL ')+name);
 fs.writeFileSync(path.join(out,'final-results.json'),JSON.stringify(results,null,2));
}
process.exitCode=results.some(r=>r.status!==0)?1:0;
