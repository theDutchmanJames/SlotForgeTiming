'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const R=require('../integration/timing-legacy/index.cjs'),P=require('../integration/timing-legacy/project.cjs');
const picture='data:image/png;base64,Y2Fy';
function fixture(t,backend){const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-legacy-reader-')),profile=path.join(root,'slotforge-timing');fs.mkdirSync(profile);const file=path.join(profile,'slotforge-timing.json');
 const raw={version:1,paddock:{sourceId:'old-installation'},slotcars:[{id:'car-1',model:'Historic',picture,custom:{unknown:42},damageFactor:1.2}],sessions:[{id:'session-1',sessionType:'race',date:'2017-01-01',setupName:'Old race',standings:[]}],laps:[1,2,3].map(n=>({id:'lap-'+n,sessionId:'session-1',carId:'car-1',lapNumber:n,lane:1,time:8000+n})),tracks:[],drivers:[],teams:[],raceclasses:[]};
 fs.writeFileSync(file,JSON.stringify(raw));let work;
 if(backend==='sqlite'){const gen=crypto.randomUUID(),dest=path.join(profile,'sqlite',gen);fs.mkdirSync(path.dirname(dest),{recursive:true});require('../sqlite-migration').migrateCopy({source:file,destination:dest});work=path.join(dest,'working');require('../sqlite-working').forkCopy(dest,work);fs.writeFileSync(path.join(profile,'storage-backend.json'),JSON.stringify({format:'slotforge-storage-selection',version:1,backend:'sqlite',generation:gen}));}
 const bytes=fs.readFileSync(file);t.after(()=>{assert.deepEqual(fs.readFileSync(file),bytes);fs.rmSync(root,{recursive:true,force:true});});return {root,profile,file,raw,work};
}
for(const backend of ['json','sqlite'])test(backend+': discovers active source, pages exact originals/media, maps without captured configuration, leaves source unchanged',t=>{
 const f=fixture(t,backend),[d]=R.discover({appData:f.root});assert.equal(d.backend,backend);const r=R.open({profile:d.profile});try{
  assert.equal(r.sourceId,'old-installation');assert.deepEqual(r.counts(),{slotcars:1,sessions:1,laps:3,tracks:0,drivers:0,teams:0,raceclasses:0});
  assert.deepEqual(r.page('slotcars').rows[0].value,f.raw.slotcars[0]);const a=r.sessionLaps('session-1',{limit:2}),b=r.sessionLaps('session-1',{limit:2,after:a.next});assert.deepEqual([...a.rows,...b.rows].map(l=>l.value),f.raw.laps);assert.equal(b.next,null);
  const projected=P.session(f.raw.sessions[0],f.raw.laps,{databaseId:'db',carIds:{'car-1':'shared-car'}});assert.equal(projected.bundle.race.participants[0].carId,'shared-car');assert.equal(projected.bundle.race.participants[0].configuration,null);assert.equal(projected.bundle.race.participants[0].laps[0].trackRecordEligible,true);assert.deepEqual(projected.rawOriginal,{session:f.raw.sessions[0],laps:f.raw.laps});
  assert.equal(r.finish().unchanged,true);assert.throws(()=>r.page('slotcars'),/closed/);
 }finally{r.close();}
});
test('selected SQLite never falls back to stale JSON; missing old identity remains unassigned',t=>{
 const f=fixture(t,'sqlite'),marker=path.join(f.profile,'storage-backend.json');const m=JSON.parse(fs.readFileSync(marker));m.generation=crypto.randomUUID();fs.writeFileSync(marker,JSON.stringify(m));assert.throws(()=>R.discover({appData:f.root}));
});
test('SQLite snapshot is stable while another writer changes a car; finish detects the new generation',t=>{
 const f=fixture(t,'sqlite'),r=R.open({profile:f.profile}),Store=require('../sqlite-working').WorkingStore;let writer;try{
  writer=new Store(f.work);const car=writer.get('slotcars','car-1',true).value;writer.command({id:'concurrent-edit',type:'updateRecord',entity:'slotcars',recordId:'car-1',expectedRevision:writer.revision('slotcars','car-1'),patch:{model:'Changed elsewhere'}});writer.close();writer=null;
  assert.equal(r.get('slotcars','car-1').model,'Historic');assert.equal(r.finish().unchanged,false);
 }finally{writer?.close();r.close();}
});
test('unprojectable token history and arbitrary car fields remain in raw originals',()=>{
 const raw={id:'token-1',sessionType:'tokens',unknown:{future:'value'}},laps=[{id:'a',time:9000}];const p=P.session(raw,laps,{databaseId:'db'});assert.equal(p.bundle,null);assert.equal(p.projectionStatus,'raw-only');assert.deepEqual(p.rawOriginal,{session:raw,laps});
 const c=P.car({id:'a',model:'Car',picture,unknown:'keep',paddock:{databaseId:'db',carId:'existing'}},{databaseId:'db'});assert.equal(c.existingCarId,'existing');assert.equal(c.rawOriginal.unknown,'keep');assert.equal(c.data.picture,picture);
});
test('projection hash stays compatible with existing delivery hashes',()=>{const v={b:[null,1,'x'],a:{z:true}};assert.equal(require('../paddock-value-hash')(v),require('../paddock').hash(v));});
test('car projection uses canonical technical fields and stable gallery identities without losing originals',()=>{
 const raw={id:'old-car',motor:123,tyres:'Rubber',gearing:'09 / 27',weight:'83,5 grams',number:7,livery:'Blue',extraPictures:[picture,picture]};
 const p=P.car(raw);assert.deepEqual(p.data.technical,{motor:'123',rearTyres:'Rubber',pinion:'9',gear:'27',weight:'83.5'});
 assert.equal(p.data.number,'7');assert.equal(p.data.livery,'Blue');assert.equal(p.data.photos[0].data,picture);
 assert.notEqual(p.data.photos[0].id,p.data.photos[1].id);assert.deepEqual(p.data.photos,P.car(raw).data.photos);assert.deepEqual(p.rawOriginal,raw);
 const unknown=P.car({id:'x',gearing:'3:1 ratio',weight:'3 oz'});assert.equal(unknown.data.technical.pinion,undefined);assert.equal(unknown.data.technical.weight,undefined);assert.equal(unknown.rawOriginal.weight,'3 oz');
});
test('legacy duplicate identities stop adoption instead of copying the first record twice',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'timing-legacy-duplicate-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 fs.writeFileSync(path.join(root,'slotforge-timing.json'),JSON.stringify({version:1,slotcars:[{id:'same',model:'First'},{id:'same',model:'Second'}]}));
 assert.throws(()=>R.open({profile:root}),/duplicate/);
});
