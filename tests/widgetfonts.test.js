const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const Fonts=require('../renderer/widgetfonts'),Frame=global.Frame=require('../renderer/frame'),Settings=require('../renderer/widgetsettings');
assert.equal(Fonts.enabled({},{}),false);
assert.deepEqual(Fonts.clean({title:'inter',value:'local:Segoe UI',support:'same',valueWeight:900,evil:1,titleWeight:123}),{title:'inter',value:'local:Segoe UI',valueWeight:900,support:'same'});
for(const value of ['local:<script>','local:foo; color:red','local:"oops','local:foo\nbar','not-a-font','local:',null,{}])assert.deepEqual(Fonts.clean({value}),{});
const defaults={widgetFonts:{title:'inter',titleWeight:700,value:'mono',valueWeight:500,support:'same'}};
assert.equal(Fonts.resolve({},defaults).support,'mono');
assert.equal(Fonts.resolve({fonts:{value:'condensed',valueWeight:600}},defaults).valueWeight,700);
assert.equal(Fonts.resolve({fonts:{value:'highvis',valueWeight:400}},defaults).valueWeight,900);
assert.equal(Fonts.resolve({fonts:{support:'theme'}},defaults).support,'theme');
const w={type:'laptime',lane:0,opt:{a:1},fonts:{value:'mono',valueWeight:700}};
Settings.change(w,'fonts','value','inter');assert.deepEqual(w.fonts,{value:'inter'});
Settings.change(w,'fonts','value','');assert.equal(w.fonts,undefined);assert.deepEqual(w.opt,{a:1});
Fonts.highVisibility(w);assert.equal(Fonts.resolve(w).valueWeight,900);assert.equal(Fonts.resolve(w).supportWeight,700);assert.equal(w.typography,undefined);
const saved=JSON.parse(JSON.stringify({...Frame.pickLayout(defaults),widgets:[w]}));assert.deepEqual(saved.widgetFonts,defaults.widgetFonts);assert.deepEqual(saved.widgets[0].fonts,w.fonts);
const original=JSON.stringify(w);Settings.copy(w,{});const other={type:'pace',fonts:{value:'condensed'}};Settings.paste(other);assert.equal(other.fonts.value,'condensed');assert.equal(JSON.stringify(w),original);
assert.match(Fonts.panel({},defaults),/Follow layout/);assert.match(Fonts.panel(w,{}),/High Visibility/);assert.match(Fonts.panel({fonts:{value:'local:Missing Font'}},{}),/saved font/);
assert.match(Fonts.rowStyle({fonts:{value:'local:A & B'}},{}),/&amp;/);assert.doesNotMatch(Fonts.rowStyle({fonts:{value:'local:A & B'}},{}),/"/);
// Every bundled binary has an independently recorded hash and a packaged license.
const root=path.resolve(__dirname,'../renderer/fonts'),manifest=JSON.parse(fs.readFileSync(path.join(root,'sources.json'),'utf8').replace(/^\uFEFF/,''));
for(const item of manifest){const data=fs.readFileSync(path.join(root,item.file));assert.equal(crypto.createHash('sha256').update(data).digest('hex'),item.sha256,item.file);if(item.file.endsWith('.ttf'))assert.equal(data.readUInt32BE(0),0x10000,item.file);}
for(const family of ['inter','barlowcondensed','robotomono'])assert.match(fs.readFileSync(path.join(root,family,'OFL.txt'),'utf8'),/SIL OPEN FONT LICENSE/);
assert.equal(manifest.filter(x=>x.file.endsWith('.ttf')).length,10);
console.log('WIDGET FONTS PASSED: sanitization, inheritance, weights, reset, save/copy isolation, safe HTML and 10 licensed font binaries');
