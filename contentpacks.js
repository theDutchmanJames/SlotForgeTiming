// Content packs are inert data. No scripts, CSS, archive extraction or network loads.
const fs = require('node:fs');
const Database = require('./db'), Transfer = require('./transfer'), Theme = require('./renderer/theme');
const Schema = require('./schema');
const FORMAT = 'slotforge-content-pack', API = 1, MAX_BYTES = 32 * 1024 * 1024;
const ENTITIES = ['layouts','rowdesigns','chartdesigns','customwidgets','imagesets','audiosets','fuelrules','penaltysystems','damagesystems','tyrewearsystems','safetycarsystems','pushsavesystems','weathersystems'];
const clone = x => JSON.parse(JSON.stringify(x));
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
function assert(ok, message) { if (!ok) throw Error(message); }
const version = v => typeof v === 'string' && /^(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(v);
function compare(a,b) { const x=a.split('.').map(Number),y=b.split('.').map(Number);return Math.sign(x[0]-y[0]||x[1]-y[1]||x[2]-y[2]); }
function text(v, max, field, required=false) {assert(typeof v==='string' && v.length<=max && (!required||v.trim()),'Invalid '+field+'.');return v.trim();}
function keys(o, allowed, at) {assert(object(o),'Invalid '+at+'.');for(const k of Object.keys(o))assert(allowed.includes(k),'Unsupported '+at+' field: '+k);}
// Reject active markup, remote/local resource addresses and prototype keys before
// handing data to the existing renderers. Raster/audio media is embedded only.
function inspect(value) {
 let nodes=0;
 function visit(v, depth, key='') {
  assert(++nodes<=100000 && depth<=24,'Pack is too complex.');
  if(typeof v==='string') {
   if(v.startsWith('data:')) {
    const m=/^data:(image\/(?:png|jpeg|webp|gif)|audio\/(?:mpeg|mp3|wav|x-wav|ogg|webm|mp4));base64,([A-Za-z0-9+/]*={0,2})$/.exec(v);
    assert(m && m[2].length%4===0,'Only embedded PNG, JPEG, WebP, GIF and audio media are supported.');
    assert(v.length<=16*1024*1024,'An embedded media file is too large.');
    const b=Buffer.from(m[2],'base64');assert(b.length>0 && b.toString('base64')===m[2],'Invalid embedded media.');
    if(m[1].startsWith('image/')) {
     const valid=m[1]==='image/png'?b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):m[1]==='image/jpeg'?b[0]===255&&b[1]===216&&b[2]===255:m[1]==='image/gif'?/^GIF8[79]a$/.test(b.toString('ascii',0,6)):b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP';
     assert(valid,'Embedded image does not match its declared type.');
    }
   } else {
    assert(v.length<=12000,'A text value is too long.');
    assert(!/[<>\u0000]/.test(v) && !/(?:javascript|vbscript|file|https?|ftp|blob|data)\s*:|url\s*\(|expression\s*\(|@import|(?:^|\s)[a-z]:[\\/]|\\\\/i.test(v),'Active markup, resource paths and URLs are not supported in content packs.');
    if(['src','url','path','file','image','picture','audio','recording'].includes(key))assert(!v || !/[\\/]/.test(v),'External media paths are not supported.');
   }
  } else if(Array.isArray(v)) {assert(v.length<=1000,'A list is too long.');v.forEach(x=>visit(x,depth+1,key));}
  else if(object(v))for(const [k,x]of Object.entries(v)){assert(!['__proto__','prototype','constructor','script','scripts','javascript','css','html','entrypoint','permissions','main'].includes(k.toLowerCase()),'Executable or unsupported property: '+k);visit(x,depth+1,k);}
  else assert(v===null||typeof v==='boolean'||typeof v==='number'&&Number.isFinite(v),'Invalid content value.');
 }
 visit(value,0);
}
function validate(raw, appVersion) {
 assert(Buffer.byteLength(JSON.stringify(raw)||'')<=MAX_BYTES,'Pack exceeds 32 MB.');
 keys(raw,['format','apiVersion','manifest','items','themes'],'pack');assert(raw.format===FORMAT,'This is not a SlotForge content pack.');assert(raw.apiVersion===API,'This pack needs a different content-pack API version.');
 const m=raw.manifest;keys(m,['id','name','version','author','description','license','minAppVersion','maxAppVersion'],'manifest');
 assert(typeof m.id==='string'&&/^[a-z0-9]+(?:[.-][a-z0-9]+)+$/.test(m.id)&&m.id.length<=100,'Use a stable pack ID such as club.race-night.');
 assert(version(m.version)&&version(m.minAppVersion),'Use three-part versions, for example 1.0.0.');
 if(m.maxAppVersion)assert(version(m.maxAppVersion)&&compare(m.maxAppVersion,m.minAppVersion)>=0,'Invalid maximum app version.');
 if(appVersion){assert(compare(appVersion,m.minAppVersion)>=0,'Update SlotForge: this pack requires '+m.minAppVersion+' or newer.');if(m.maxAppVersion)assert(compare(appVersion,m.maxAppVersion)<=0,'This pack does not declare compatibility with this SlotForge version.');}
 const manifest={id:m.id,name:text(m.name,100,'pack name',true),version:m.version,author:text(m.author,100,'author',true),description:text(m.description||'',1200,'description'),license:text(m.license,200,'license',true),minAppVersion:m.minAppVersion,...(m.maxAppVersion?{maxAppVersion:m.maxAppVersion}:{})};
 const items=clone(raw.items||{});assert(object(items),'Invalid items.');let count=0;
 for(const [entity,rows]of Object.entries(items)){
  assert(ENTITIES.includes(entity),'Unsupported content type: '+entity);assert(Array.isArray(rows),'Invalid '+entity+' list.');const ids=new Set();
  for(const row of rows){assert(object(row)&&typeof row.id==='string'&&/^[\w.-]{1,100}$/.test(row.id)&&!['__proto__','constructor','prototype'].includes(row.id)&&!ids.has(row.id),'Invalid or duplicate item ID in '+entity);ids.add(row.id);assert(++count<=300,'A pack may contain at most 300 items.');text(row.name,200,'item name',true);assert(!Object.keys(row.custom||{}).length,'Custom database fields are not supported in packs.');
   for(const f of Schema[entity].fields||[]){const v=row[f.key];if(v===undefined||v===null||v==='')continue;if(f.type==='ref')assert(false,'Remove the personal database link '+f.label+' before exporting this preset.');if(f.type==='number')assert((typeof v==='number'||typeof v==='string')&&Number.isFinite(Number(v)),'Invalid numeric setting: '+f.label);if(f.type==='select')assert(typeof v==='string'||typeof v==='number'||typeof v==='boolean','Invalid choice: '+f.label);}
  }
 }
 const themes=clone(raw.themes||[]);assert(Array.isArray(themes)&&themes.length<=20,'A pack may contain at most 20 themes.');const themeIds=new Set();
 for(const theme of themes){keys(theme,['id','name','colors'],'theme');assert(typeof theme.id==='string'&&/^[\w.-]{1,100}$/.test(theme.id)&&!themeIds.has(theme.id),'Invalid or duplicate theme ID.');themeIds.add(theme.id);text(theme.name,100,'theme name',true);keys(theme.colors,Theme.COLORS.map(c=>c[0]),'theme colours');assert(Theme.COLORS.every(([k])=>Theme.hex6(theme.colors[k])),'Supply all six theme colours as hex colours.');theme.colors=Theme.customOf({customColors:theme.colors});}
 assert(count||themes.length,'The pack has no content.');const pack={format:FORMAT,apiVersion:API,manifest,items,themes};inspect(pack);
 // All database dependencies must be inside the pack; no accidental binding to
 // an unrelated driver's, track's or team's ID on the recipient's computer.
 for(const [entity,rows]of Object.entries(items))for(const row of rows)for(const ref of Transfer.refsOf(entity,row)){const id=ref.get();if(id&&id!=='none')assert((items[ref.entity]||[]).some(r=>r.id===id),'Missing dependency: '+ref.entity+' / '+id+'. Include it, or remove the link before exporting.');}
 const Widgets=require('./renderer/widgets'),Compose=require('./renderer/widgetcompose');
 function composition(doc){assert(object(doc)&&object(doc.root),'Invalid widget composition.');let count=0;const walk=(n,depth)=>{assert(object(n)&&++count<=80&&depth<=6,'Invalid or oversized widget composition.');if(n.kind==='component')assert(Compose.components().some(c=>c.type===n.component),'Unsupported embedded widget.');if(n.children!==undefined){assert(Array.isArray(n.children),'Invalid composition children.');n.children.forEach(c=>walk(c,depth+1));}};walk(doc.root,0);}
 for(const entity of ['layouts','rowdesigns'])for(const row of items[entity]||[]){assert(Array.isArray(row.widgets)&&row.widgets.length<=300,'Invalid widget list.');for(const w of row.widgets){assert(object(w)&&Widgets.def(w.type),'Unsupported widget type.');if(w.opt!==undefined)assert(object(w.opt),'Invalid widget options.');for(const k of ['x','y','w','h'])if(w[k]!==undefined)assert(typeof w[k]==='number'&&Number.isFinite(w[k])&&Math.abs(w[k])<=100000,'Invalid widget geometry.');if(w.opt?.composition)composition(w.opt.composition);}}
 for(const row of items.customwidgets||[]){assert(['textlane','textrace','imagelane','imagerace'].includes(row.type),'Unsupported custom widget type.');if(row.composition)composition(row.composition);}
 for(const row of items.audiosets||[]){if(row.calls!==undefined){assert(object(row.calls),'Invalid audio calls.');for(const c of Object.values(row.calls)){assert(object(c)&&Array.isArray(c.lines),'Invalid audio call variations.');for(const l of c.lines)assert(object(l)&&(!l.file||l.file.startsWith('data:audio/')),'Audio recordings must be embedded.');}}}
 for(const row of items.imagesets||[])if(row.images!==undefined){assert(Array.isArray(row.images)||object(row.images),'Invalid image list.');for(const image of Object.values(row.images))assert(image===null||typeof image==='string'&&(!image||image.startsWith('data:image/')),'Image sets need embedded raster images.');}
 return pack;
}
function summary(pack){return {manifest:pack.manifest,counts:Object.fromEntries(Object.entries(pack.items).map(([k,v])=>[k,v.length])),themes:pack.themes.map(t=>({id:t.id,name:t.name,colors:t.colors,warnings:Theme.problems(t.colors)}))};}
function create(data,picks,manifest,themes,appVersion){
 assert(object(picks),'Choose items for the pack.');for(const e of Object.keys(picks))assert(ENTITIES.includes(e),'Unsupported content type.');
 const bundle=Transfer.collect(data,picks,true);return validate({format:FORMAT,apiVersion:API,manifest,items:bundle.items,themes:themes||[]},appVersion);
}
class Store {
 constructor(file,appVersion){this.file=file;this.appVersion=appVersion;this.error='';this.state={format:'slotforge-pack-library',version:1,packs:[]};
  if(fs.existsSync(file))try{assert(fs.statSync(file).size<=128*1024*1024,'Library is too large.');const s=JSON.parse(fs.readFileSync(file,'utf8'));assert(s.format===this.state.format&&s.version===1&&Array.isArray(s.packs)&&s.packs.length<=40,'Invalid library.');const ids=new Set();for(const r of s.packs){r.pack=validate(r.pack);assert(!ids.has(r.pack.manifest.id),'Duplicate pack ID.');ids.add(r.pack.manifest.id);if(r.previous){r.previous=validate(r.previous);assert(r.previous.manifest.id===r.pack.manifest.id,'Invalid rollback identity.');}r.enabled=r.enabled===true;}this.state=s;}catch(e){this.error='Pack library could not be loaded. Existing app content is unaffected. '+e.message;}
 }
 // Entries were fully validated on load/install. Listing must not decode every
 // embedded image again, particularly while the timing window is running.
 compatible(pack){const m=pack.manifest;if(compare(this.appVersion,m.minAppVersion)<0)return 'Update SlotForge: this pack requires '+m.minAppVersion+' or newer.';if(m.maxAppVersion&&compare(this.appVersion,m.maxAppVersion)>0)return 'This pack does not declare compatibility with this SlotForge version.';return '';}
 list(){return {error:this.error,canRecover:fs.existsSync(this.file+'.bak'),apiVersion:API,appVersion:this.appVersion,entities:ENTITIES,packs:this.state.packs.map(r=>({...summary(r.pack),enabled:r.enabled,installed:r.installed,previousVersion:r.previous?.manifest.version||'',compatibility:this.compatible(r.pack)}))};}
 recover(){const backup=new Store(this.file+'.bak',this.appVersion);assert(fs.existsSync(backup.file)&&!backup.error,'No readable library backup is available.');if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.before-recovery-'+Date.now());Database.writeAtomic(this.file,JSON.stringify(backup.state));this.state=backup.state;this.error='';}
 mutate(fn){assert(!this.error,this.error);const next=clone(this.state),result=fn(next);const text=JSON.stringify(next);assert(Buffer.byteLength(text)<=128*1024*1024,'Pack library exceeds 128 MB. Remove an unused pack first.');if(fs.existsSync(this.file))fs.copyFileSync(this.file,this.file+'.bak');Database.writeAtomic(this.file,text);this.state=next;return result;}
 get(id){const r=this.state.packs.find(r=>r.pack.manifest.id===id);assert(r,'Pack not found.');return r;}
 install(raw){const pack=validate(raw,this.appVersion);return this.mutate(s=>{const i=s.packs.findIndex(r=>r.pack.manifest.id===pack.manifest.id),old=s.packs[i];if(old)assert(compare(pack.manifest.version,old.pack.manifest.version)>0,'This version is already installed, or is older. Use Roll back for the previous version.');else assert(s.packs.length<40,'The library supports at most 40 packs.');const r={pack,enabled:old?old.enabled:true,installed:new Date().toISOString(),...(old?{previous:old.pack}:{})};if(old)s.packs[i]=r;else s.packs.push(r);return summary(pack);});}
 enable(id,on){assert(typeof on==='boolean','Invalid enabled state.');if(on)validate(this.get(id).pack,this.appVersion);return this.mutate(s=>{const r=s.packs.find(r=>r.pack.manifest.id===id);assert(r,'Pack not found.');r.enabled=on;});}
 disableAll(){return this.mutate(s=>s.packs.forEach(r=>r.enabled=false));}
 remove(id){this.get(id);return this.mutate(s=>{s.packs=s.packs.filter(r=>r.pack.manifest.id!==id);});}
 rollback(id){const old=this.get(id);assert(old.previous,'No earlier version is available.');validate(old.previous,this.appVersion);return this.mutate(s=>{const r=s.packs.find(r=>r.pack.manifest.id===id);[r.pack,r.previous]=[r.previous,r.pack];});}
 available(id){const r=this.get(id);assert(r.enabled,'Enable this pack first.');return validate(r.pack,this.appVersion);}
 copy(db,id){const p=this.available(id);assert(Object.values(p.items).some(a=>a.length),'This pack contains themes only. Use Apply theme.');return Transfer.apply(db,{format:Transfer.FORMAT,fileVersion:1,items:p.items,customFields:{}});}
 theme(id,themeId){const p=this.available(id),t=p.themes.find(t=>t.id===themeId);assert(t,'Theme not found.');return {theme:'custom',customColors:clone(t.colors)};}
}
module.exports={FORMAT,API,MAX_BYTES,ENTITIES,validate,summary,create,Store,compare};
