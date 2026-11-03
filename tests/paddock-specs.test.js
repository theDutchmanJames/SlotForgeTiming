'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const Specs=require('../renderer/paddockspecs'),Database=require('../db'),{Paddock}=require('../paddock');
const profile=()=>JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/paddock/fixtures/profile-car-a.json')));
function item(){const p=profile();return {paddock:{databaseId:p.databaseId,carId:p.car.id,configuration:p.configuration}};}
test('all public technical fields have one label and group, and no private fields are exposed',()=>{
 const car=item(),fields=Specs.groups.flatMap(g=>g[3]);assert.equal(new Set(fields.map(f=>f[0])).size,fields.length);
 car.paddock.configuration.technical=Object.fromEntries(fields.map(([k])=>[k,'Value for '+k]));car.paddock.configuration.technical.technicalNotes='PRIVATE';car.paddock.configuration.secret='SECRET';
 const before=JSON.stringify(car),m=Specs.model(car);assert.equal(m.groups.flatMap(g=>g.fields).length,fields.length);assert(!Specs.html(car).includes('PRIVATE'));assert(!Specs.html(car).includes('SECRET'));assert.equal(JSON.stringify(car),before);
});
test('public field list agrees with the current Paddock contract',{skip:!process.env.PADDOCK_SOURCE},()=>{const actual=require(path.join(process.env.PADDOCK_SOURCE,'src/timing-schema.cjs')).fields;assert.deepEqual(Specs.groups.flatMap(g=>g[3].map(f=>f[0])).sort(),[...actual].sort());});
test('normal cars, empty profiles, incorrect identities and invalid dates have safe states',()=>{
 assert.equal(Specs.html({model:'Local'}),'');assert.match(Specs.html({paddock:{carId:'x'}}),/No saved/);const car=item();car.paddock.configuration.carId='wrong';assert.equal(Specs.model(car).groups.length,0);assert.match(Specs.html(car),/does not match/);
 const empty=item();empty.paddock.configuration.technical={motor:'  ',weight:null,ratedRpm:123};empty.paddock.configuration.components=[];empty.paddock.configuration.capturedAt='bad';assert.match(Specs.html(empty),/Date unavailable/);assert.match(Specs.html(empty),/No public specifications/);assert.equal(Specs.model(empty).groups.length,0);
 const unlinked=item();delete unlinked.paddock.carId;delete unlinked.paddock.configuration.carId;assert.match(Specs.html(unlinked),/does not match/);
 const parts=item();parts.paddock.configuration.components=[{name:'Valid part',quantity:1,field:'constructor'},{name:'Fractional',quantity:1.5},{name:'Overflow',quantity:1000001},{name:'  ',quantity:1}];assert.deepEqual(Specs.model(parts).components,[{name:'Valid part',quantity:1,field:'',position:''}]);
});
test('specifications and component text are escaped; source text is preserved exactly',()=>{
 const car=item();car.paddock.configuration.technical.motor='<img src=x onerror=alert(1)>\n  Second line';car.paddock.configuration.components=[{name:'<script>bad()</script>',quantity:2,field:'motor',position:'<unsafe>',partId:'hidden',assemblyId:'internal'}];const html=Specs.html(car);
 assert(html.includes('&lt;img'));assert(!html.includes('<script>'));assert(!html.includes('<input'));assert(!html.includes('assemblyId'));assert.equal(Specs.model(car).groups.flatMap(g=>g.fields).find(f=>f.key==='motor').value,car.paddock.configuration.technical.motor);assert(html.includes('Quantity: 2'));
});
test('installed components render at most 50 at a time and paging cannot submit the edit form',()=>{
 const car=item();car.paddock.configuration.components=Array.from({length:120},(_,i)=>({name:'Component '+i,quantity:1,field:'motor',position:'Rear'}));const html=Specs.html(car);assert.equal((html.match(/Quantity: 1/g)||[]).length,50);assert(html.includes('Page 1 of 3'));assert(!html.includes('Component 50<'));
 let handler,markup='',focused=false;const target={set innerHTML(v){markup=v;},querySelector:()=>({focus:()=>{focused=true;}})};const section={addEventListener:(_k,h)=>{handler=h;},contains:()=>true,querySelector:()=>target};Specs.mount(section,car);let prevented=false;handler({target:{closest:()=>({dataset:{pcsPage:'2'}})},preventDefault:()=>{prevented=true;}});assert.equal((markup.match(/Quantity: 1/g)||[]).length,20);assert(markup.includes('Component 119'));assert(prevented&&focused);assert(!/<button(?![^>]*type="button")/.test(html));
});
for(const kind of ['json','sqlite'])test(kind+': rich profile survives link, local edit, offline reopen and render without changing signed data',async t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'timing-specs-')),file=path.join(dir,'database.json'),db=new Database(file);db.saveNow();const original=fs.readFileSync(file);let worker,repo,client;
 if(kind==='sqlite'){const {migrateCopy}=require('../sqlite-migration'),{forkCopy}=require('../sqlite-working');migrateCopy({source:file,destination:path.join(dir,'copy')});forkCopy(path.join(dir,'copy'),path.join(dir,'work'));worker=new(require('../sqlite-client'))();await worker.openWorking(path.join(dir,'work'));repo=new(require('../sqlite-repository'))(worker);client=new Paddock(null,{storage:new(require('../paddock-storage').SqlitePaddockStorage)(repo),deliveryStore:worker});}else client=new Paddock(db);
 t.after(async()=>{client.stop();await client.idle();await worker?.close();await db.writesIdle();if(repo)assert.deepEqual(fs.readFileSync(file),original);fs.rmSync(dir,{recursive:true,force:true});});
 const p=profile();p.configuration.technical.frontAxlePlay='0.15 mm';p.configuration.technical.measuredRpm='21800';p.configuration.components=[{partId:'part',name:'Motor screws',quantity:2,field:'fasteners',position:'Rear',assemblyId:null}];const signed=structuredClone(p.configuration);
 client.hostRequest=async(_b,route)=>route==='/v1/status'?{id:p.databaseId,name:'Test host',permissions:{timingResults:true},capabilities:{timing:{versions:[1]}}}:structuredClone(p);
 await client.connect({address:'127.0.0.1:5050',code:'test'});const car=await client.link(p.car.id);
 if(repo){await repo.update('slotcars',car.id,{damageFactor:1.4,motor:'Attempted overwrite',paddock:{configuration:{}}},{commandId:'local-edit',expectedRevision:(await repo.get('slotcars',car.id)).revision});}
 else {const R=require('../data-repository');await new R(db).update('slotcars',car.id,{damageFactor:1.4,motor:'Attempted overwrite',paddock:{configuration:{}}});}
 client.stop();let saved;
 if(repo){await worker.close();worker=new(require('../sqlite-client'))();await worker.openWorking(path.join(dir,'work'));repo=new(require('../sqlite-repository'))(worker);saved=(await repo.get('slotcars',car.id,true)).record.value;}else{await db.writesIdle();saved=new Database(file).data.slotcars.find(c=>c.id===car.id);}
 assert.equal(saved.damageFactor,1.4);assert.equal(saved.motor,p.configuration.technical.motor);assert.deepEqual(saved.paddock.configuration,signed);const before=JSON.stringify(saved);assert.match(Specs.html(saved),/21800/);assert.match(Specs.html(saved),/Motor screws/);assert.equal(JSON.stringify(saved),before);
});
