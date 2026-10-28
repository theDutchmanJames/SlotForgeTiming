// Production Race Results flow check. Uses private app data and the normal race engine.
const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const data = path.join(__dirname, '../../.tmp-test/race-results-electron-' + process.pid); fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const wait = ms => new Promise(resolve => setTimeout(resolve, ms)); let done = false;
const qaWidth = Math.max(320, Math.round(Number(process.env.RACE_RESULTS_QA_WIDTH) || 1200));
const timeout = setTimeout(() => { console.error('Race Results Electron check timed out'); app.exit(1); }, 30000);
app.on('browser-window-created', (_event, win) => {
  win.hide();
  win.webContents.on('did-finish-load', async () => {
    if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
    const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
    try {
      await wait(600); win.setMinimumSize(0, 0); win.setSize(qaWidth, 900); win.showInactive();
      await run(`const track=await api.add('tracks',{name:'Results QA',lanes:2}),a=await api.add('drivers',{name:'James'}),b=await api.add('drivers',{name:'Bjornie'}),ca=await api.add('slotcars',{brand:'NSR',model:'Mosler MT900R'}),cb=await api.add('slotcars',{brand:'NSR',model:'Corvette C.08R'}); state.speed=25; state.race={setup:{name:'Results QA',sessionType:'race',laps:2,endRule:'all',firstLap:'count',lightsMin:0,lightsMax:0,layout:''},track,rows:[{driverId:a.id,carId:ca.id},{driverId:b.id,carId:cb.id}]}; state.tab='race'; await render(); live.actions.start();`);
      for (let i = 0; i < 80 && !await run(`return live.phase==='running';`); i++) await wait(35);
      // Seed deterministic laps through the engine, then use the normal director
      // stop action to reach the finalize/results screens. `crossLane` is private
      // to race.js and was never available to this renderer check.
      await run(`const e=live.engine(),t=performance.now();e.cross(0,t+1000);e.cross(1,t+1200);e.cross(0,t+2200);e.cross(1,t+2400);live.actions.stop(true);`);
      for (let i = 0; i < 80 && !await run(`return live.phase==='review';`); i++) await wait(35);
      const finalCheck = await run(`return {phase:live.phase,finishHidden:document.getElementById('finishreview').hidden,raceHidden:document.getElementById('raceactive').hidden,review:document.getElementById('review').innerHTML,finalCards:document.querySelectorAll('.rfinish-card').length,lapReview:!!document.querySelector('[data-rv="laps"]'),laps:live.engine().cars.map(c=>c.laps.length)};`);
      assert(finalCheck.phase === 'review' && !finalCheck.finishHidden && finalCheck.raceHidden && finalCheck.review.includes('Finalize race results') && finalCheck.finalCards === 2 && finalCheck.lapReview, 'main final check did not render: ' + JSON.stringify(finalCheck));
      await run(`window.__resultsQaHost=document.createElement('div');window.__resultsQaHost.style.cssText='display:block;position:fixed;inset:0;z-index:999;background:var(--bg)';document.body.appendChild(window.__resultsQaHost);await LiveView.mount(window.__resultsQaHost,{second:true});`); await wait(180);
      const secondCheck = await run(`const host=window.__resultsQaHost;return {ok:host.innerHTML.includes('Race results')&&host.querySelectorAll('.results-spotlight').length===2&&host.querySelectorAll('.result-card').length===0&&host.innerHTML.includes('results-podium-2')&&host.innerHTML.includes('results-spotlight-gold')&&host.innerHTML.includes('results-spotlight-silver')&&host.innerHTML.includes('Provisional'),text:host.textContent.slice(0,500),spotlights:host.querySelectorAll('.results-spotlight').length,cards:host.querySelectorAll('.result-card').length,classes:[...host.querySelectorAll('[class]')].map(x=>x.className).filter(x=>String(x).includes('results')).slice(0,20)};`);
      assert(secondCheck.ok, 'second-screen results podium did not render: ' + JSON.stringify(secondCheck));
      const podiumVisual = await run(`const host=window.__resultsQaHost,podium=host.querySelector('.results-podium-2'),gold=host.querySelector('.results-spotlight-gold'),silver=host.querySelector('.results-spotlight-silver'),feature=gold.querySelector('.result-feature'),featureValue=feature.querySelector('strong'),raw=getComputedStyle(podium).gridTemplateColumns,goldBox=gold.getBoundingClientRect(),silverBox=silver.getBoundingClientRect(),featureStyle=getComputedStyle(feature),valueStyle=getComputedStyle(featureValue);return {gold:getComputedStyle(gold).getPropertyValue('--podium').trim(),silver:getComputedStyle(silver).getPropertyValue('--podium').trim(),goldWidth:goldBox.width,silverWidth:silverBox.width,goldTop:goldBox.top,silverTop:silverBox.top,raw,featuredRow:featureStyle.gridColumnStart==='1'&&featureStyle.gridColumnEnd==='-1',featuredNoWrap:valueStyle.whiteSpace==='nowrap',innerWidth:innerWidth};`);
      assert.equal(podiumVisual.gold, '#efb811', 'the winner must render the gold Spotlight token'); assert.equal(podiumVisual.silver, '#c4ccd8', 'second place must render the silver Spotlight token');
      const narrow = qaWidth <= 860, equalWidth = podiumVisual.goldWidth > 0 && Math.abs(podiumVisual.goldWidth - podiumVisual.silverWidth) < .1, sameRow = Math.abs(podiumVisual.goldTop - podiumVisual.silverTop) < .1;
      assert(narrow ? equalWidth && !sameRow : equalWidth && sameRow, `the ${narrow ? 'narrow' : 'wide'} podium layout did not reflow correctly: ${JSON.stringify(podiumVisual)}`);
      assert(podiumVisual.featuredRow && podiumVisual.featuredNoWrap, 'a medium-width podium card must give its deciding fact an unwrapped full row: ' + JSON.stringify(podiumVisual));
      const out=path.resolve(__dirname,'../../../outputs/code-audit');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'results-repaired-'+qaWidth+'.png'),(await win.webContents.capturePage()).toPNG());
      await run(`await LiveView.mount(window.__resultsQaHost,{});LiveView.go('timing');`); await wait(80);
      assert(await run(`const host=window.__resultsQaHost;return host.innerHTML.includes('Race results')&&host.querySelectorAll('.results-spotlight').length===2&&host.innerHTML.includes('results-podium-2')&&!host.innerHTML.includes('id="lv-canvas"');`), 'Timing page did not replace widgets with results after the race');
      await run(`live.actions.finalize();`);
      for(let i=0;i<40&&!await run(`return (await api.list('sessions')).some(s=>s.setupName==='Results QA'&&s.rulesSnapshot?.version===1);`);i++)await wait(50);
      assert(await run(`return (await api.list('sessions')).some(s=>s.setupName==='Results QA'&&s.rulesSnapshot?.config?.type==='race');`),'Finalized race must persist its starting rules');
      await run(`LiveView.go('results');const a=document.getElementById('lv-body');if(!a.innerHTML.includes('Best legal lap'))throw Error('result defaults missing');state.customSub='results';state.tab='custom';await render();if(!document.getElementById('rv-comparison')||!document.getElementById('rv-large'))throw Error('results settings missing');const large=document.getElementById('rv-large');large.value='leaderboard';large.dispatchEvent(new Event('change',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,80));if(!document.getElementById('rv-leaderboard'))throw Error('leaderboard result setting did not open');LiveView.unmount();delete window.__resultsQaHost;live.leave();live.alive=false;state.race=null;`);
      console.log('ELECTRON RACE RESULTS PASSED ' + JSON.stringify({ finalCheck:true, secondScreen:true, settings:true, width:qaWidth, podium:podiumVisual })); clearTimeout(timeout); app.quit();
    } catch (e) { console.error(e.stack || e); app.exit(1); }
  });
});
require('../../main');
