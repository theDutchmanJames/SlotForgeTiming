const {app}=require('electron'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const output=path.resolve(__dirname,'../../../outputs/systems-repairs');fs.mkdirSync(output,{recursive:true});app.setPath('appData',path.resolve(__dirname,'../../.tmp-test/roster-'+process.pid));app.disableHardwareAcceleration();
let done=false,step=0;const wait=ms=>new Promise(r=>setTimeout(r,ms));setTimeout(()=>{console.error('QA timeout '+step);app.exit(1);},120000).unref();
app.on('browser-window-created',(_,win)=>{win.hide();win.webContents.on('did-finish-load',async()=>{
 if(done||!win.webContents.getURL().endsWith('index.html'))return;done=true;
 const run=code=>{console.log('STEP '+(++step));return win.webContents.executeJavaScript('(async()=>{'+code+'})()');},shot=async name=>{await wait(400);fs.writeFileSync(path.join(output,name+'.png'),(await win.webContents.capturePage()).toPNG());};
 try{await wait(600);win.setMinimumSize(0,0);win.setContentSize(1200,1000);
 await run(`window.qaErrors=[];window.alert=m=>{throw Error(m);};window.confirm=()=>true;addEventListener('error',e=>qaErrors.push(e.message));state.settings=await api.setSettings({timingHw:'none'});window.car=await api.add('slotcars',{brand:'NSR',model:'Corvette'});state.tab='database';state.sub='slotcars';await render();openForm('slotcars',car);document.querySelector('#f-raceClass-new').value='GT3';document.querySelector('[data-class-create]').click();`);await wait(250);
 assert.equal(await run(`return document.querySelector('label[for="f-raceClass"]').textContent;`),'Race Class');
 await shot('slotcar-class');await run(`document.querySelector('#frm').requestSubmit();`);await wait(250);
 assert(await run(`window.gt=(await api.list('raceclasses'))[0];window.car=(await api.list('slotcars'))[0];return !!gt&&car.raceClass===gt.id;`));
 // Creating a case-insensitive duplicate reuses the shared class rather than fragmenting the label.
 await run(`await render();openForm('slotcars',car);document.querySelector('#f-raceClass-new').value='  gt3 ';document.querySelector('[data-class-create]').click();`);await wait(200);
 assert.equal(await run(`return (await api.list('raceclasses')).length;`),1);await run(`document.querySelector('#frm').requestSubmit();`);await wait(200);
 await run(`window.defs=[gt];window.cars=[car];for(const name of ['Prototype','Touring','Classic','Open']){const c=await api.add('raceclasses',{name,color:'#ab9eff',icon:'car'});defs.push(c);cars.push(await api.add('slotcars',{brand:'Club',model:name,raceClass:c.id}));}window.drivers=await Promise.all(['Alex','Blair','Unassigned'].map(name=>api.add('drivers',{name})));state.tab='setup';state.setupSub='multiclass';await render();document.querySelector('#mc-new').click();`);await wait(150);
 assert.equal(await run(`return document.querySelectorAll('[data-include]').length;`),5);
 await run(`const name=document.querySelector('[data-mc=name]');name.value='GT3 and Prototypes';name.dispatchEvent(new Event('input',{bubbles:true}));for(const c of defs.slice(0,2)){const el=document.querySelector('[data-include="'+c.id+'"]');el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}));}for(let i=0;i<2;i++){const el=document.querySelector('[data-driver-class="'+drivers[i].id+'"]');el.value=defs[i].id;el.dispatchEvent(new Event('change',{bubbles:true}));}`);
 assert.equal(await run(`return document.querySelector('#mc-save').disabled;`),false);await shot('class-setup-1200');win.setContentSize(600,1000);await wait(150);await run(`document.querySelector('#mc-drivers').scrollIntoView({block:'center'});`);await shot('class-drivers-600');assert(await run(`return document.documentElement.scrollWidth<=innerWidth+1;`));
 await run(`document.querySelector('#mc-form').requestSubmit();`);await wait(250);
 assert(await run(`window.profile=(await api.list('multiclasssystems'))[0];return profile.assignment==='roster'&&profile.classes.length===2&&profile.driverClasses.length===2;`));
 await run(`multiEditor=null;await render();document.querySelector('[data-mc-edit]').click();`);await wait(150);assert(await run(`return document.querySelector('[data-driver-class="'+drivers[1].id+'"]').value===defs[1].id;`));
 win.setContentSize(1200,1000);
 await run(`window.track=await api.add('tracks',{name:'Club',lanes:2,length:20,minLap:.1});window.setup=await api.add('racesetups',{name:'Class race',track:track.id,sessionType:'race',raceBy:'laps',laps:2,endRule:'all',firstLap:'count',startMin:0,startMax:0,startStep:0,multiClass:profile.id});state.settings=await api.setSettings({lastSetupId:setup.id,assignments:{[setup.id]:drivers.slice(0,2).map((d,i)=>({driverId:d.id,carId:cars[1-i].id}))}});state.tab='home';await render();`);
 assert(await run(`return document.querySelector('#start').disabled&&[...document.querySelector('[data-row="0"] [data-k="carId"]').options].filter(o=>o.value).map(o=>o.value).join()===cars[0].id;`),'wrong saved cars block start; only matching car offered');
 assert(await run(`return ![...document.querySelector('[data-row="0"] [data-k="driverId"]').options].some(o=>o.value===drivers[2].id);`),'unassigned driver not offered');
 for(let i=0;i<2;i++){await run(`const el=document.querySelector('[data-row="${i}"] [data-k="carId"]');el.value=cars[${i}].id;el.dispatchEvent(new Event('change',{bubbles:true}));`);await wait(200);}
 assert.equal(await run(`return document.querySelector('#start').disabled;`),false);await shot('home-class-cars');
 await run(`const el=document.querySelector('[data-row="0"] [data-k="driverId"]');el.value=drivers[1].id;el.dispatchEvent(new Event('change',{bubbles:true}));`);await wait(200);
 assert.equal(await run(`return state.settings.assignments[setup.id][0].carId;`),'','driver change clears incompatible car');
 await run(`const el=document.querySelector('[data-row="0"] [data-k="driverId"]');el.value=drivers[0].id;el.dispatchEvent(new Event('change',{bubbles:true}));`);await wait(200);
 await run(`const el=document.querySelector('[data-row="0"] [data-k="carId"]');el.value=cars[0].id;el.dispatchEvent(new Event('change',{bubbles:true}));`);await wait(200);
 await run(`document.querySelector('#start').click();`);await wait(250);assert(await run(`return live.engine().cars.every((c,i)=>c.raceClass===defs[i].id);`));
 await run(`live.actions.start();`);for(let i=0;i<400&&!await run(`return live.phase==='running';`);i++)await wait(30);assert.equal(await run(`return live.phase;`),'running');
 await run(`const e=live.engine(),t=performance.now();e.t0=t-20000;e.cars.forEach(c=>c.last=e.t0);e.cross(0,t-12000);e.cross(1,t-11000);e.cross(0,t-4000);e.cross(1,t-2000);`);await wait(250);assert.equal(await run(`return live.phase;`),'review');await run(`live.actions.finalize();`);await wait(250);
 assert(await run(`const s=(await api.list('sessions')).find(s=>s.setupName===setup.name);return s.classStandings.length===2&&s.classStandings.every(r=>r.classPos===1)&&s.multiclass.driverClasses.length===2;`));
 assert.deepEqual(await run(`return qaErrors;`),[]);console.log('MULTI-CLASS ROSTER ELECTRON PASS');app.exit(0);
 }catch(e){console.error('Step '+step,e);try{await shot('failure');}catch{}app.exit(1);}
});});require('../../main.js');
