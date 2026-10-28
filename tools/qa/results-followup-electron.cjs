const { app } = require('electron'), fs = require('fs'), path = require('path'), assert = require('assert/strict');
const out = path.resolve(__dirname, '../../../outputs/code-audit'), data = path.resolve(__dirname, '../../.tmp-test/results-followup-' + process.pid);
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(data, { recursive: true }); app.setPath('appData', data); app.disableHardwareAcceleration();
const priorPath = path.join(out, 'results-styles-before-cleanup.css');
const prior = fs.existsSync(priorPath) ? fs.readFileSync(priorPath, 'utf8') : null;
const wait = ms => new Promise(r => setTimeout(r, ms)); let done = false;
const timeout = setTimeout(() => app.exit(1), 60000); timeout.unref();
app.on('browser-window-created', (_, win) => { win.hide(); win.webContents.on('did-finish-load', async () => {
  if (done || !win.webContents.getURL().endsWith('index.html')) return; done = true;
  const run = code => win.webContents.executeJavaScript('(async()=>{' + code + '})()');
  try {
    await wait(500); win.setMinimumSize(0, 0); win.showInactive();
    await run(`window.qaErrors=[];addEventListener('error',e=>qaErrors.push(e.message));window.check=(v,m)=>{if(!v)throw Error(m)};
      window.qaHost=document.createElement('div');qaHost.style.cssText='position:fixed;inset:0;overflow:auto;z-index:9999;background:var(--bg)';document.body.appendChild(qaHost);
      window.qaDraw=count=>{const e=RaceEngine.createRace({type:'race',laps:3,endRule:'all',entries:Array.from({length:count},(_,lane)=>({lane,driverName:['James','Bjornie','Maria','Sam','Alex','Lee'][lane],carName:'NSR Mosler MT900R'}))});e.start(0);for(let lane=0;lane<count;lane++){e.cars[lane].started=true;for(let lap=1;lap<=3;lap++)e.cross(lane,lap*(10421+lane*6));}qaHost.innerHTML=ResultsView.html(e,{summary:['total','laps','best','consistency'],comparison:'best'},{phase:'review',title:'Club night · 3 laps',layout:{laneColors:['#2fafd7','#74a64b','#ac8bf2','#e5484d','#e49d4d','#599be6'].map(bg=>({bg}))}});qaHost.scrollTop=0;};
      window.qaMeasure=()=>[...qaHost.querySelectorAll('.results-wall,.results-podium,.results-spotlight,.results-spotlight-head,.results-spotlight-summary,.result-card,.result-cardhead,.result-summary,.result-feature strong,.result-avatar,.result-place')].map(el=>{const c=getComputedStyle(el);return {class:el.className,width:c.width,padding:c.padding,margin:c.margin,grid:c.gridTemplateColumns,font:c.fontSize,color:c.color,bg:c.backgroundImage,radius:c.borderRadius,display:c.display,minHeight:c.minHeight,wrap:c.whiteSpace};});
      window.qaOld=document.createElement('style');document.head.appendChild(qaOld);window.qaLink=[...document.querySelectorAll('link')].find(x=>x.getAttribute('href')==='styles.css');check(qaLink,'Stylesheet link');`);
    const differences = [];
    for (const width of [1200, 900, 600, 420]) {
      win.setContentSize(width, 1000);
      for (const count of [2, 4, 6]) {
        await run(`qaDraw(${count});`);
        if (prior) {
          await run(`qaLink.disabled=true;qaOld.textContent=${JSON.stringify(prior)};`); await wait(50);
          const before = await run('return qaMeasure();');
          await run(`qaOld.textContent='';qaLink.disabled=false;`); await wait(50);
          const after = await run('return qaMeasure();');
          if (JSON.stringify(before) !== JSON.stringify(after)) {
            before.forEach((a,i) => { if (JSON.stringify(a)!==JSON.stringify(after[i])) differences.push({width,count,before:a,after:after[i]}); });
          }
        }
        await run(`check(qaHost.scrollWidth<=qaHost.clientWidth+1,'No horizontal overflow at ${width}px');
          const axis=qaHost.querySelector('.results-chart-axis'),ticks=axis.querySelectorAll('.results-chart-ticks span'),bar=qaHost.querySelector('.results-chart-row i');
          check(axis.textContent.includes('Seconds')&&ticks.length===3,'Axis units and ticks');
          const bounds=axis.querySelector('.results-chart-ticks').getBoundingClientRect(),b=bar.getBoundingClientRect();
          check(Math.abs(bounds.left-b.left)<1&&Math.abs(bounds.width-b.width)<1,'Axis and bars align');
          for(const tick of ticks){const r=tick.getBoundingClientRect();check(r.left>=bounds.left-1&&r.right<=bounds.right+1,'Tick labels fit');}
          for(let i=1;i<ticks.length;i++)check(ticks[i-1].getBoundingClientRect().right<=ticks[i].getBoundingClientRect().left,'Tick labels do not overlap');
          const bars=[...qaHost.querySelectorAll('.results-chart-row b')].map(x=>parseFloat(x.style.width));check(Math.min(...bars)>99,'Close laps retain close bar lengths');`);
      }
      if (width===1200||width===600) {
        await run(`qaDraw(2);qaHost.querySelector('.results-chart').scrollIntoView({block:'end'});`); await wait(100);
        fs.writeFileSync(path.join(out,'results-followup-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
      }
    }
    fs.writeFileSync(path.join(out,'results-css-comparison.json'),JSON.stringify({compared:!!prior,cases:12,differences},null,2));
    assert.equal(differences.length,0,'Unintended Results CSS changes: '+JSON.stringify(differences.slice(0,3)));
    await run(`state.settings.theme='light';applyTheme();qaDraw(4);qaHost.querySelector('.results-chart').scrollIntoView({block:'end'});check(!qaErrors.length,qaErrors.join(';'));`); await wait(100);
    fs.writeFileSync(path.join(out,'results-followup-light-420.png'),(await win.webContents.capturePage()).toPNG());
    console.log('RESULTS FOLLOW-UP ELECTRON PASSED: 12 layout cases, unchanged podium/card styles, proportional bars, aligned numeric axes, readable tick labels, dark/light');
    clearTimeout(timeout); app.quit();
  } catch(e) { console.error(e.stack||e);fs.writeFileSync(path.join(out,'results-followup-failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1); }
}); }); require('../../main');
