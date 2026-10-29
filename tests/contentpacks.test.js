const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const P=require('../contentpacks'),D=require('../db'),W=require('../renderer/widgets'),Theme=require('../renderer/theme');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'sf-packs-')),db=new D(path.join(tmp,'db.json'));
const manifest={id:'club.test',name:'Club collection',author:'Club',license:'CC0-1.0',description:'A content-only collection',version:'1.0.0',minAppVersion:'1.99.2'};
const theme={id:'club',name:'Club theme',colors:Theme.DEFAULT};
const chart=db.add('chartdesigns',{name:'Comparison',style:'bars'}),rows=db.add('rowdesigns',{name:'Leaderboard',widgets:[W.newWidget('name',0,0,0)]});
const chartWidget=W.newWidget('racechart',0,0,0);chartWidget.opt={chartDesign:chart.id};
const board=W.newWidget('leaderboard',null,0,0);board.opt={design:rows.id};
const layout=db.add('layouts',{name:'Race night',ratioW:16,ratioH:9,widgets:[chartWidget,board],widgetStyles:[{id:'club-style',name:'Club',style:{appearance:{baseColor:'#123456'}}}]});
const pack=P.create(db.data,{layouts:[layout.id]},manifest,[theme],'1.99.2');
assert.equal(pack.items.chartdesigns[0].id,chart.id);assert.equal(pack.items.rowdesigns[0].id,rows.id);
const store=new P.Store(path.join(tmp,'packs.json'),'1.99.2');store.install(pack);
assert.equal(store.list().packs[0].enabled,true);assert.throws(()=>store.install(pack),/already installed/);
const counts=store.copy(db,'club.test');assert.equal(counts.layouts,1);
const copy=db.data.layouts.at(-1);assert.notEqual(copy.id,layout.id);assert.notEqual(copy.widgets[0].opt.chartDesign,chart.id);
assert.equal(db.data.chartdesigns.at(-1).id,copy.widgets[0].opt.chartDesign);assert.equal(db.data.rowdesigns.at(-1).id,copy.widgets[1].opt.design);assert.deepEqual(copy.widgetStyles,layout.widgetStyles);
db.update('layouts',copy.id,{name:'My edited copy'});const existing=JSON.stringify(db.data);
store.enable('club.test',false);assert.throws(()=>store.copy(db,'club.test'),/Enable/);assert.equal(JSON.stringify(db.data),existing);
store.enable('club.test',true);assert.deepEqual(store.theme('club.test','club'),{theme:'custom',customColors:Theme.DEFAULT});
const update=structuredClone(pack);update.manifest.version='1.1.0';update.manifest.name='Updated';store.install(update);assert.equal(store.list().packs[0].previousVersion,'1.0.0');assert.equal(JSON.stringify(db.data),existing);
store.rollback('club.test');assert.equal(store.list().packs[0].manifest.version,'1.0.0');
const reopened=new P.Store(store.file,'1.99.2');assert.equal(reopened.error,'');assert.equal(reopened.list().packs.length,1);reopened.disableAll();assert.equal(reopened.list().packs[0].enabled,false);reopened.remove('club.test');assert.equal(reopened.list().packs.length,0);assert.equal(JSON.stringify(db.data),existing);
assert(fs.existsSync(store.file+'.bak'));
const invalid=change=>{const x=structuredClone(pack);change(x);assert.throws(()=>P.validate(x,'1.99.2'));};
invalid(p=>p.apiVersion=2);invalid(p=>p.manifest.minAppVersion='2.0.0');invalid(p=>p.manifest.maxAppVersion='1.99.1');invalid(p=>p.manifest.id='../../escape');invalid(p=>p.manifest.version='1.0');invalid(p=>p.main='evil.js');invalid(p=>p.items.sessions=[]);
invalid(p=>p.items.layouts[0].name='<img src=x onerror=alert(1)>');invalid(p=>p.items.layouts[0].bgColor='url(https://example.com)');invalid(p=>p.items.layouts[0].script='run()');invalid(p=>p.items.layouts[0].image='file:///secret.png');invalid(p=>p.items.layouts[0].image='data:image/svg+xml;base64,PHN2Zz4=');invalid(p=>p.items.layouts[0].image='data:image/png;base64,PHN2Zz4=');
invalid(p=>p.items.layouts[0].widgets[0].type='external-code');invalid(p=>p.items.layouts.push(p.items.layouts[0]));invalid(p=>delete p.items.chartdesigns);invalid(p=>p.themes[0].colors.bg='red;display:none');invalid(p=>p.items.layouts[0].custom={private:1});
const proto=JSON.parse(JSON.stringify(pack).replace('"ratioW":16','"__proto__":{"polluted":true},"ratioW":16'));assert.throws(()=>P.validate(proto),/unsupported property/);assert.equal({}.polluted,undefined);
const future=new P.Store(path.join(tmp,'future.json'),'1.99.1');assert.throws(()=>future.install(pack),/Update SlotForge/);
// Disk failures never leave a half-installed in-memory catalogue.
const atomic=D.writeAtomic;D.writeAtomic=()=>{throw Error('disk full');};const before=JSON.stringify(store.state);assert.throws(()=>store.install({...pack,manifest:{...manifest,version:'1.2.0'}}),/disk full/);assert.equal(JSON.stringify(store.state),before);D.writeAtomic=atomic;
fs.writeFileSync(path.join(tmp,'broken.json'),'not json');const broken=new P.Store(path.join(tmp,'broken.json'),'1.99.2');assert(broken.list().error);assert.throws(()=>broken.install(pack),/could not be loaded/);assert.equal(fs.readFileSync(broken.file,'utf8'),'not json');
// Existing editor formats (including keyed image sets and free-canvas widgets).
const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=';
const media={...pack,items:{audiosets:[{id:'sound',...require('../renderer/sound').defaultSet('Club calls')}],imagesets:[{id:'lights',name:'Club lights',kind:'lights',images:{on:png,off:null}}],customwidgets:[{id:'custom',name:'Custom timing',type:'textlane',composition:require('../renderer/widgetcompose').freeTemplate('timing')}]}};
assert.equal(P.validate(media,'1.99.2').items.customwidgets.length,1);
const presetDb=new D(path.join(tmp,'presets.json'));
for(const entity of P.ENTITIES.filter(e=>require('../schema')[e].fields.length)){
 const preset=presetDb.add(entity,{name:'Shared '+entity});
 assert.equal(P.create(presetDb.data,{[entity]:[preset.id]},manifest,[],'1.99.2').items[entity].length,1);
}
invalid(p=>p.items.layouts[0].widgets[0].opt.composition={root:{kind:'component',component:'textlane'}});
invalid(p=>p.items.fuelrules=[{id:'fuel',name:'Personal track',paceTrack:'some-track'}]);
const backup=P.Store;const recovery=new backup(path.join(tmp,'recover.json'),'1.99.2');recovery.install(pack);recovery.enable('club.test',false);
fs.writeFileSync(recovery.file,'broken');const damaged=new P.Store(recovery.file,'1.99.2');assert(damaged.error);damaged.recover();assert.equal(damaged.error,'');assert(damaged.get('club.test').enabled);assert(fs.readdirSync(tmp).some(n=>n.startsWith('recover.json.before-recovery-')));
console.log('CONTENT PACKS PASSED: dependencies, editable copies, styles, versioning, rollback, removal, media/code rejection, compatibility, atomic failures and corruption isolation.');
