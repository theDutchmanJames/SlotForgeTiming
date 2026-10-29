const P=require('./pluginpackage'),Rules=require('./renderer/ruleplugin');
class RuleHost{
 constructor(runtime){this.runtime=runtime;}
 catalog(){return this.runtime.list().plugins.filter(p=>p.manifest.rules).map(p=>({id:p.manifest.id,label:p.manifest.rules.label,description:p.manifest.rules.description,state:p.state,version:p.manifest.version}));}
 async prepare(id,saved){
  P.ok(typeof id==='string'&&P.id(id),'Choose a valid rule plugin.');
  const r=this.runtime.store.get(id),current=r.current;
  P.ok(current.manifest.rules,'This plugin does not contribute race rules.');
  this.runtime.store.verify(id); // Recheck installed files, not just library metadata.
  if(saved){const snap=Rules.snapshot(saved);P.ok(snap.id===id&&snap.digest===current.digest&&snap.version===current.manifest.version,'The saved race requires the exact original rule plugin version and fingerprint. Restore that version before resuming.');return snap;}
  const plan=Rules.plan(await this.runtime.prepareRule(id));
  return Rules.snapshot({api:1,id,name:current.manifest.rules.label,version:current.manifest.version,digest:current.digest,settings:current.settings,plan});
 }
}
module.exports={RuleHost};
