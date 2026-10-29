// Executable extensions deliberately use a different format from content packs.
const crypto = require('node:crypto');
const FORMAT = 'slotforge-code-plugin', API = 1, MAX_BYTES = 32 * 1024 * 1024;
const ok = (condition, message) => { if (!condition) throw Error(message); };
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
const clone = x => JSON.parse(JSON.stringify(x));
const version = x => typeof x === 'string' && /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(x);
const compare = (a,b) => { const x=a.split('.').map(Number), y=b.split('.').map(Number); return Math.sign(x[0]-y[0] || x[1]-y[1] || x[2]-y[2]); };
const id = x => typeof x === 'string' && /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(x) && x.length <= 80;
function keys(value, allowed, label) {
  ok(object(value), 'Invalid '+label+'.');
  for (const k of Object.keys(value)) ok(allowed.includes(k), 'Unsupported '+label+' field: '+k);
}
function text(value, label, max=200, optional=false) {
  if (optional && value === undefined) return '';
  ok(typeof value === 'string' && value.length<=max && (optional || value.trim()) && !/[<>\x00-\x1f]/.test(value), 'Invalid '+label+'.');
  return value.trim();
}
function relative(file) {
  ok(typeof file === 'string' && file.length<=200 && /^[a-zA-Z0-9_./-]+$/.test(file), 'Invalid package path.');
  const parts=file.split('/');
  ok(parts.length<=8 && parts.every(p => p && p!=='.' && p!=='..' && !p.endsWith('.') && !/^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i.test(p)), 'Unsafe package path: '+file);
  ok(/\.(?:cjs|js|json|txt|md|png|jpg|jpeg|webp|gif|css|html)$/i.test(file), 'Unsupported file type: '+file+'. Native modules are not supported by runtime API 1.');
  return file;
}
function manifest(raw) {
  keys(raw,['id','name','version','author','description','license','minAppVersion','maxAppVersion','runtime','platforms','architectures','commands','settings','timing','display','rules'],'manifest');
  ok(id(raw.id), 'Use a stable plugin ID such as club.example.');
  ok(version(raw.version) && version(raw.minAppVersion), 'Use three-part plugin and app versions.');
  if(raw.maxAppVersion) ok(version(raw.maxAppVersion) && compare(raw.maxAppVersion,raw.minAppVersion)>=0,'Invalid maximum app version.');
  ok(raw.runtime==='node','Runtime API 1 supports trusted Node.js plugins only.');
  const platforms=raw.platforms||['win32','linux','darwin'], architectures=raw.architectures||['x64','arm64'];
  ok(Array.isArray(platforms)&&platforms.length>0&&platforms.length<=3&&platforms.every(v=>['win32','linux','darwin'].includes(v)),'Invalid supported platforms.');
  ok(Array.isArray(architectures)&&architectures.length>0&&architectures.length<=3&&architectures.every(v=>['x64','arm64','ia32'].includes(v)),'Invalid architectures.');
  const commands=raw.commands||[], settings=raw.settings||[];
  ok(Array.isArray(commands)&&commands.length<=16&&Array.isArray(settings)&&settings.length<=24,'Too many commands or settings.');
  const identifiers=new Set();
  const fieldId=(v,prefix)=>{ok(typeof v==='string'&&/^[a-z][a-z0-9_-]{0,39}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v)&&!identifiers.has(prefix+v),'Invalid or duplicate field ID.');identifiers.add(prefix+v);return v;};
  const cleanCommands=commands.map(c=>{keys(c,['id','label'],'command');return {id:fieldId(c.id,'c'),label:text(c.label,'command label',80)};});
  const cleanSettings=settings.map(f=>{
    keys(f,['id','label','type','default','min','max','choices'],'setting');
    ok(['text','number','boolean','select'].includes(f.type),'Unsupported setting type.');
    const n={id:fieldId(f.id,'s'),label:text(f.label,'setting label',80),type:f.type};
    if(f.type==='number'){ok(Number.isFinite(f.min)&&Number.isFinite(f.max)&&f.min<=f.max&&Math.abs(f.min)<=1e9&&Math.abs(f.max)<=1e9,'Invalid numeric range.');n.min=f.min;n.max=f.max;}
    if(f.type==='select'){ok(Array.isArray(f.choices)&&f.choices.length>0&&f.choices.length<=30,'Invalid setting choices.');n.choices=f.choices.map(v=>text(v,'choice',80));ok(new Set(n.choices).size===n.choices.length,'Duplicate setting choices.');}
    n.default=setting(n,f.default);return n;
  });
  return {id:raw.id,name:text(raw.name,'plugin name',100),version:raw.version,author:text(raw.author,'author',100),description:text(raw.description,'description',1000,true),license:text(raw.license,'licence',200),minAppVersion:raw.minAppVersion,...(raw.maxAppVersion?{maxAppVersion:raw.maxAppVersion}:{}),runtime:'node',platforms,architectures,commands:cleanCommands,settings:cleanSettings,...(raw.timing===undefined?{}:{timing:require('./renderer/timingplugin').descriptor(raw.timing)}),...(raw.display===undefined?{}:{display:require('./renderer/plugindisplay').descriptor(raw.display)}),...(raw.rules===undefined?{}:{rules:require('./renderer/ruleplugin').descriptor(raw.rules)})};
}
function setting(field,value) {
  if(field.type==='text') return text(value,'setting '+field.id,1000,true);
  if(field.type==='boolean'){ok(typeof value==='boolean','Setting '+field.id+' must be on or off.');return value;}
  if(field.type==='number'){ok(typeof value==='number'&&Number.isFinite(value)&&value>=field.min&&value<=field.max,'Setting '+field.id+' is outside its range.');return value;}
  ok(field.choices.includes(value),'Invalid choice for '+field.id+'.');return value;
}
function settings(m, raw={}) {
  keys(raw,m.settings.map(f=>f.id),'settings');
  return Object.fromEntries(m.settings.map(f=>[f.id,setting(f,raw[f.id]===undefined?f.default:raw[f.id])]));
}
function compatible(m,appVersion,platform=process.platform,arch=process.arch) {
  ok(compare(appVersion,m.minAppVersion)>=0&&(!m.maxAppVersion||compare(appVersion,m.maxAppVersion)<=0),'Plugin is incompatible with this SlotForge version.');
  ok(m.platforms.includes(platform)&&m.architectures.includes(arch),'Plugin does not support this platform and architecture.');
}
function validate(raw, appVersion) {
  ok(Buffer.byteLength(JSON.stringify(raw)||'')<=MAX_BYTES,'Plugin exceeds 32 MB.');
  keys(raw,['format','apiVersion','manifest','entry','files'],'plugin package');
  ok(raw.format===FORMAT&&raw.apiVersion===API,'Not a supported executable plugin package. Content packs belong under Import and Export.');
  const m=manifest(raw.manifest);if(appVersion)compatible(m,appVersion);
  keys(raw.files,Object.keys(raw.files||{}),'files');
  const names=Object.keys(raw.files).sort(), seen=new Set();let total=0;
  ok(names.length>0&&names.length<=256,'A plugin needs 1–256 files.');
  const files={};
  for(const name of names){
    relative(name);const lower=name.toLowerCase();ok(!seen.has(lower),'Case-insensitive duplicate file path.');seen.add(lower);
    const encoded=raw.files[name];ok(typeof encoded==='string'&&encoded.length<=12*1024*1024&&encoded.length%4===0&&/^[A-Za-z0-9+/]*={0,2}$/.test(encoded),'Invalid encoded file: '+name);
    const bytes=Buffer.from(encoded,'base64');ok(bytes.toString('base64')===encoded,'Invalid base64 encoding.');total+=bytes.length;ok(total<=20*1024*1024,'Decoded plugin exceeds 20 MB.');files[name]=encoded;
  }
  for(const name of seen) {let p=name;while(p.includes('/')){p=p.slice(0,p.lastIndexOf('/'));ok(!seen.has(p),'A package path is both a file and directory.');}}
  relative(raw.entry);ok(raw.entry.endsWith('.cjs')&&Object.hasOwn(files,raw.entry),'Entry point must be a packaged .cjs file.');
  return {format:FORMAT,apiVersion:API,manifest:m,entry:raw.entry,files};
}
const digest=pack=>crypto.createHash('sha256').update(JSON.stringify(pack)).digest('hex');
const summary=pack=>({manifest:clone(pack.manifest),digest:digest(pack),fileCount:Object.keys(pack.files).length,bytes:Object.values(pack.files).reduce((n,v)=>n+Buffer.byteLength(v,'base64'),0)});
module.exports={FORMAT,API,MAX_BYTES,ok,object,clone,version,compare,id,relative,manifest,settings,compatible,validate,digest,summary};
