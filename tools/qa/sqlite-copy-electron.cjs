// Real Electron runtime, isolated fixture; optionally load storage from an ASAR.
const { app } = require('electron');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = process.argv[2] || path.resolve(__dirname, '../..');
const Client = require(path.join(root, 'sqlite-client.js'));
const out = path.resolve(__dirname, '../../../outputs/sqlite-conversion');
fs.mkdirSync(out, { recursive: true });
const dir = fs.mkdtempSync(path.join(out, 'runtime-'));
require('./file-diagnostics.cjs')(path.join(dir,'diagnostics.log'),()=>app.exit(1));
app.setPath('userData', path.join(dir, 'profile')); app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const client = new Client(), writer = new Client(), reopened = new Client();
  try {
    const source = path.join(dir, 'copy.json'), destination = path.join(dir, 'bundle');
    fs.writeFileSync(source, JSON.stringify({ version: 1, drivers: [{ id: 'd', name: 'Runtime', custom: { club: 'SlotForge' } }], slotcars:[{id:'car',model:'Runtime car'}], sessions: [], laps: [] }));
    const report = await client.migrate(source, destination);
    await client.open(destination);
    assert.equal((await client.field('drivers', 'd', ['custom', 'club'])).value, 'SlotForge');
    assert.equal((await client.get('drivers', 'd')).value.name, 'Runtime');
    await client.close();
    const work = path.join(dir, 'working');
    await writer.forkCopy(destination, work); await writer.openWorking(work);
    const Repository=require(path.join(root,'sqlite-repository.js')),repository=new Repository(writer);
    await repository.update('drivers','d',{name:'Updated runtime'},{commandId:'edit-driver',expectedRevision:0});
    await writer.command({id:'connection',type:'setPaddockConnection',expectedRevision:0,connection:{databaseId:'runtime-host',address:'127.0.0.1:51234',name:'Fixture',timing:true,results:true}});
    const command = { id: 'runtime-finalize', type: 'finalizeSession', session: { setupName: 'Runtime test', standings: [],
      paddockJournal:{captures:{car:{name:'Runtime car',configuration:{databaseId:'runtime-host',carId:'remote'}}},lanes:[20],
        heats:[{id:'1',name:'Heat',startedAt:100000,endedAt:120000,entries:[{carId:'car',driverId:'d',driverName:'Runtime',lane:1,laps:[{number:1,time:10000,at:110000,driverId:'d',valid:true,pit:false}]}]}]} },
      laps: [{ carId:'car',driverId: 'd',lane:1,lapNumber:1,time: 10000 }] };
    const result = await writer.command(command), row=(await writer.outbox('runtime-host'))[0];
    const attempt=await writer.command({id:'claim',type:'claimDelivery',deliveryKey:row.key,databaseId:'runtime-host'});
    const payload=await writer.deliveryPayload(row.key,attempt.attemptToken);
    const receipt={ok:true,databaseId:payload.databaseId,sourceId:payload.source.id,sessionId:payload.sessionId,revision:payload.revision,state:payload.state,contentHash:require(path.join(root,'paddock.js')).hash(payload)};
    await writer.command({id:'ack',type:'acknowledgeDelivery',deliveryKey:row.key,attemptToken:attempt.attemptToken,receipt});
    await writer.close();
    await reopened.openWorking(work);
    assert.deepEqual(await reopened.command(command), result);
    assert.equal((await reopened.sessionLaps(result.sessionId)).length, 1);
    assert.equal((await reopened.changes()).length, 5);
    assert.equal((await reopened.outbox('runtime-host'))[0].status,'sent');
    assert.equal((await reopened.get('drivers','d')).value.name,'Updated runtime');
    const compat=new(require(path.join(root,'compatibility-read')).SqliteCompatibilityReads)(reopened);
    const appRecords=new(require(path.join(root,'sqlite-app-repository')))(reopened);
    const appTrack=await appRecords.add('tracks',{name:'Packaged editor track',lanes:2});
    assert.equal((await appRecords.update('tracks',appTrack.id,{name:'Edited packaged track'})).name,'Edited packaged track');
    await appRecords.remove('tracks',appTrack.id);assert.equal(await appRecords.get('tracks',appTrack.id),null);
    assert.equal((await compat.list('drivers'))[0].name,'Updated runtime');assert.equal((await compat.choices('drivers'))[0].id,'d');assert.equal(await compat.linkedLaps('drivers','d'),1);
    const catalogue=await reopened.catalogue('drivers',{limit:1,search:'updated'});
    assert.equal(catalogue.items[0].record.name,'Updated runtime');assert.equal(catalogue.next,null);
    assert.equal((await reopened.historyPage('racing')).sessions.items.length,1);
    assert.equal((await reopened.historySession('racing',result.sessionId)).laps.length,1);
    assert.equal((await reopened.carStatistics('car')).sessions,1);
    const dashboard=await reopened.homeStatistics({trackId:'',now:new Date().toISOString(),driverIds:[],grid:[],boards:[{key:'glance',count:5,period:'all',scope:'all'}]});
    assert.equal(dashboard.cards.glance.glance.laps,1);
    const raceInputs=await reopened.raceInputs({trackId:'',setup:{sessionType:'race'},rows:[{driverId:'d',carId:'car'}],championship:false});
    assert.equal(raceInputs.collections.drivers[0].name,'Updated runtime');assert.equal(raceInputs.collections.laps.length,0);
    assert.equal(await reopened.raceSeason({tag:{id:'missing',kind:'race'},people:[]}),null);
    assert.deepEqual(await reopened.raceCharts(['missing']),[]);
    const references=await reopened.referencePage('drivers',{limit:1});
    assert.equal(references.items[0].name,'Updated runtime');
    assert.equal((await reopened.referenceDetails('drivers',['d'],references.revision))[0].name,'Updated runtime');
    const Delivery=require(path.join(root,'sqlite-delivery.js')),delivery=new Delivery(reopened,{call:async()=>receipt});
    assert.equal((await delivery.checkReceipt(row.key)).applied,true);
    const workingRepo=new Repository(reopened);
    const profile=await workingRepo.add('resourcesystems',{name:'Packaged supplies',owner:'car',scope:'event',tyres:{M:3}},{commandId:'packaged-resources'});
    const ResourceStore=require(path.join(root,'resource-store')),Backend=require(path.join(root,'resource-backends')).SqliteResources;
    const resources=new ResourceStore(null,{backend:new Backend(workingRepo)});
    const resource=await resources.begin(profile.recordId,{runId:'packaged-run'});
    await resources.save({v:1,race:{resources:resource},eng:{v:1}});
    assert.equal((await resources.read()).checkpoint.race.resources.runId,'packaged-run');
    await resources.clear();assert.equal((await resources.read()).checkpoint,null);
    const Paddock=require(path.join(root,'paddock')).Paddock,PaddockStorage=require(path.join(root,'paddock-storage')).SqlitePaddockStorage;
    const paddock=new Paddock(null,{storage:new PaddockStorage(workingRepo),deliveryStore:reopened});
    const remote={integrationVersion:1,databaseId:'runtime-host',car:{id:'remote',name:'Packaged car'},configuration:{databaseId:'runtime-host',carId:'remote',capturedAt:new Date().toISOString(),signature:'a'.repeat(64),technical:{}}};
    paddock.code='test';paddock.profile=async()=>remote;
    assert.equal((await paddock.link('remote','car')).paddock.carId,'remote');
    assert.equal((await paddock.prepare(['car'])).captures.car.configuration.signature,remote.configuration.signature);
    assert.equal((await paddock.status()).linked[0].id,'car');
    paddock.stop();
    const Life=require(path.join(root,'storage-lifecycle')),lifecycle=await new Life.StorageLifecycle(new Life.SqliteLifecycleBackend(reopened)).initialize();
    await lifecycle.updateSettings({theme:'light',packagedLifecycle:true});
    await lifecycle.saveResume({v:1,race:{name:'Packaged ordinary race'},eng:{v:1,laps:[10,11]}});
    assert.equal((await lifecycle.resume()).race.name,'Packaged ordinary race');
    assert.equal((await lifecycle.diagnostics()).backend,'sqlite');
    const bulkFile=path.join(dir,'legacy-backup.json');await reopened.exportLegacy(bulkFile);assert.equal(JSON.parse(fs.readFileSync(bulkFile)).data.drivers[0].name,'Updated runtime');
    const snapshot=path.join(dir,'native-backup'),restore=path.join(dir,'native-restore');await reopened.backupSnapshot(snapshot);await reopened.restoreSnapshot(snapshot,restore);
    const restoredClient=new Client();try{await restoredClient.openWorking(restore);assert.equal((await restoredClient.get('drivers','d')).value.name,'Updated runtime');assert.equal((await restoredClient.outbox('runtime-host'))[0].status,'sent');const restoredLife=await new Life.StorageLifecycle(new Life.SqliteLifecycleBackend(restoredClient)).initialize();assert.equal(restoredLife.settings().packagedLifecycle,true);assert.equal((await restoredLife.resume()).race.name,'Packaged ordinary race');await restoredLife.shutdown();}finally{await restoredClient.close();}
    await lifecycle.shutdown();
    const activeProfile=path.join(dir,'activation-profile');fs.mkdirSync(activeProfile);fs.copyFileSync(source,path.join(activeProfile,'slotforge-timing.json'));
    const Activation=require(path.join(root,'storage-activation'));Activation.request(activeProfile);const selection=await Activation.startup(activeProfile);
    const activated=await require(path.join(root,'sqlite-runtime')).open(selection.directory,{profileRoot:activeProfile});
    try{assert.equal((await activated.records.get('drivers','d')).name,'Runtime');await activated.records.update('drivers','d',{name:'Activated in ASAR'});}finally{await activated.lifecycle.shutdown();}
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ passed: true, root, versions: process.versions, report }, null, 2));
    console.log('SQLITE ELECTRON COPY, WRITE ADAPTERS AND DELIVERY ACKNOWLEDGEMENTS PASS: ' + root); app.exit(0);
  } catch (error) { console.error(error); await Promise.all([client.cancel(), writer.cancel(), reopened.cancel()]); app.exit(1); }
});
