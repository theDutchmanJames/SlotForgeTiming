// Exercise repaired production forms and review controls with isolated app data.
const { app } = require('electron');
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const out = path.resolve(__dirname, '../../../outputs/regression-repairs');
fs.mkdirSync(out, { recursive: true });
const data = path.resolve(__dirname, '../../.tmp-test/repairs-' + process.pid);
fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const wait = ms => new Promise(r => setTimeout(r, ms));
const timeout = setTimeout(() => app.exit(1), 55000); let done = false;
app.on('browser-window-created', (_, win) => {
  win.hide(); win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return;
    done = true;
    const run = s => win.webContents.executeJavaScript('(async()=>{' + s + '})()');
    try {
      await wait(600); win.setMinimumSize(0, 0); win.setContentSize(1200, 1000); win.showInactive();
      await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));
        openForm('pushsavesystems',null);
        for(const [k,v] of Object.entries({name:'Small median thresholds',mode:'median',pushAt:0.1,saveAt:2.3})){
          const el=document.getElementById('f-'+k);el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
        }`);
      await wait(200);
      fs.writeFileSync(path.join(out, 'median-thresholds-1200.png'), (await win.webContents.capturePage()).toPNG());
      await run(`document.getElementById('frm').requestSubmit();`); await wait(300);
      await run(`const r=(await api.list('pushsavesystems')).find(x=>x.name==='Small median thresholds');
        if(!r||r.pushAt!==0.1||r.saveAt!==2.3||PushSave.clean(r).saveAt!==2.3)throw Error('Threshold form roundtrip failed');
        window.qaRace=RaceEngine.createRace({type:'race',laps:10,endRule:'all',sectors:{count:3,names:['Start straight','Hairpin','Back straight']},entries:[{lane:0,driverName:'James',carName:'NSR Mosler MT900R'},{lane:1,driverName:'Bjornie',carName:'NSR Corvette C.08R'}]});
        qaRace.start(0); for(const t of [0,10000,20000]){qaRace.cross(0,t);qaRace.cross(1,t+100);}qaRace.stop(25000);
        qaRace.setSector(0,2);qaRace.setSector(1,2);qaRace.adjust(0,{ms:5000});Review.reset();
        document.body.innerHTML='<main id="qa-review" style="padding:16px"></main>';
        window.drawReview=()=>document.getElementById('qa-review').innerHTML=Review.finishHtml(qaRace,{settings:state.settings});
        drawReview();Review.bind(document.getElementById('qa-review'),c=>{Review.apply(qaRace,c);drawReview();},drawReview);
        if(!document.body.innerText.includes('adjusted: +5 s'))throw Error('Missing persistent adjustment');
        const order=qaRace.standings().map(x=>x.index).join();
        const arrow=document.querySelector('[data-rv="sectormove"][data-dir="1"]:not(:disabled)');
        if(!arrow)throw Error('Missing ordering arrow');arrow.click();
        if(qaRace.standings().map(x=>x.index).join()===order)throw Error('Ordering click did not reorder');
        const sel=document.querySelector('[data-rvs="1"]');sel.value='3';sel.dispatchEvent(new Event('change',{bubbles:true}));
        if(qaRace.cars[1].sector!==3)throw Error('Sector selection failed');qaRace.setSector(1,2);drawReview();`);
      for (const width of [1200, 600]) {
        win.setContentSize(width, 1000); await wait(150);
        const g = await run(`return {overflow:document.documentElement.scrollWidth>innerWidth+1,buttons:[...document.querySelectorAll('.rfinish-sector button')].length,adjusted:document.body.innerText.includes('adjusted: +5 s')};`);
        assert(!g.overflow && g.buttons === 4 && g.adjusted, JSON.stringify(g));
        fs.writeFileSync(path.join(out, 'final-check-' + width + '.png'), (await win.webContents.capturePage()).toPNG());
      }
      assert.deepEqual(await run('return qaErrors'), []);
      console.log('REPAIR QA PASSED: real form save/reload, small median thresholds, sector select, ordering arrows, persistent adjustments, 1200/600px, no runtime errors');
      clearTimeout(timeout); app.quit();
    } catch (e) {
      console.error(e); console.error(await run('return document.body.innerText.slice(-2500)'));
      fs.writeFileSync(path.join(out, 'failure.png'), (await win.webContents.capturePage()).toPNG()); app.exit(1);
    }
  });
});
require('../../main');
