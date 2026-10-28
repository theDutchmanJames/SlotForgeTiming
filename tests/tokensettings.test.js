// Board 12: use the real renderer, controlling storage latency and failure explicitly.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const Tokens = require('../renderer/tokens.js');
const { TokenSettings: T } = require('../renderer/tokenui.js');

async function check() {
  const standard = Tokens.settingsOf({});
  assert.deepEqual(Object.keys(T.standard()).sort(), ['tokenIncrements','tokenDecrements','tokenWarnSeconds','tokenWarnColor','tokenOutColor'].sort());
  assert.deepEqual(Tokens.settingsOf(T.standard()), standard);
  for (const values of [[''],['x'],[0],[-1],[1440.01],[Infinity],[1,1],Array.from({length:9},(_,i)=>i+1)]) assert.ok(T.minutes(values,true).error, JSON.stringify(values));
  assert.ok(T.minutes([],true).error);
  assert.deepEqual(T.minutes([],false),{list:[]});
  assert.deepEqual(T.minutes(['7,5',1,1440],true),{list:[7.5,1,1440]});
  assert.deepEqual(T.minutes([60,5],true),{list:[60,5]}, 'Keep the chosen button order');
  const words = T.describe(standard);
  assert.equal(words.warning,'00:45');assert.equal(words.running,'12:34');
  assert.equal(words.rail.add.state,'plain');assert.equal(words.rail.take.state,'plain');assert.equal(words.rail.warning.state,'plain');
  const off=T.describe({...standard,warnSeconds:0,decrements:[]});assert.equal(off.warning,'—:—');assert.ok(off.say.includes('no take-off buttons')&&off.say.includes('no early warning'));
  assert.equal(T.describe({...standard,warnColor:'#123456'}).rail.warning.state,'ok');
  assert.equal(T.describe({...standard,warnSeconds:3600}).running,'1:01:15');
  assert.equal(T.describe({...standard,warnSeconds:.6}).warning,'00:01','Use the real Token Clock rounding for fractional seconds');

  const elements = new Map();const document={activeElement:null,getElementById(id){if(!elements.has(id))elements.set(id,element(id));return elements.get(id);}};
  function element(id) {return {id,innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,open:true,isConnected:true,style:{},dataset:{},attributes:{},classList:{toggle(){}},setAttribute(k,v){this.attributes[k]=v;},removeAttribute(k){delete this.attributes[k];},focus(){document.activeElement=this;},scrollIntoView(){this.scrolled=true;}};}
  const writes=[];let fail=false;
  const state={tab:'setup',setupSub:'tokens',settings:{theme:'ocean',unrelated:'kept'}};
  const api={async setSettings(patch){writes.push(structuredClone(patch));if(fail)throw Error('disk full');return {...state.settings,...patch};}};
  const ctx=vm.createContext({document,state,api,console,Promise,Set,Icons:{svg:()=>''},esc:s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;')});ctx.window=ctx;
  for(const f of ['listnum.js','tokens.js','railform.js','tokenui.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../renderer',f),'utf8'),ctx,{filename:f});
  const E=id=>document.getElementById(id),box=E('setupmgr');
  await vm.runInContext('renderTokenSettings(document.getElementById("setupmgr"))',ctx);
  assert.ok(box.innerHTML.includes('setupform ss-tok')&&box.innerHTML.includes('tk-section-warning'));
  assert.equal(writes.length,0,'Opening never writes defaults');
  E('tk-section-warning').ontoggle();assert.equal(box.tokenPage.rail,'add','Initial open events keep the first rail row selected');
  const shell=box.innerHTML;
  const set=async(id,value)=>{E(id).value=String(value);return E(id).onchange({target:E(id)});};
  const click=async data=>box.onclick({target:{closest:()=>({dataset:data})}});
  E('tk-add-0').value='7,5';E('tk-add-0').oninput();
  assert.equal(writes.length,0,'Typing previews before committing');assert.ok(E('tk-preview').innerHTML.includes('+7,5 min'));
  E('tk-add-0').focus();await set('tk-add-0','7,5');
  assert.equal(state.settings.tokenIncrements,'7.5, 5, 10, 15, 30, 60');assert.equal(state.settings.unrelated,'kept');
  assert.equal(document.activeElement,E('tk-add-0'));assert.equal(box.innerHTML,shell,'Saving keeps the page and focus intact');
  const count=writes.length;await set('tk-add-0','5');assert.equal(writes.length,count);assert.ok(E('tk-add-error').textContent.includes('different'));await set('tk-add-0','7.5');
  await click({tkAdd:'add'});await click({tkAdd:'add'});const eight=state.settings.tokenIncrements;await click({tkAdd:'add'});assert.equal(eight.split(',').length,8);assert.equal(state.settings.tokenIncrements,eight);
  for(let i=0;i<3;i++)await click({tkRemove:'take',index:'0'});assert.equal(state.settings.tokenDecrements,'');assert.ok(E('tk-dpreview').innerHTML.includes('No minus buttons'));assert.equal(document.activeElement,E('tk-more-take'));
  await E('tk-reset').onclick();
  for(let i=0;i<5;i++)await click({tkRemove:'add',index:'0'});await click({tkRemove:'add',index:'0'});assert.equal(state.settings.tokenIncrements,'60');assert.ok(E('tk-add-error').textContent.includes('at least one'));
  await set('tk-warn','45');assert.equal(state.settings.tokenWarnSeconds,45,'A refused deletion must not block otherwise valid settings');
  await E('tk-reset').onclick();await set('tk-warn','90');await E('tk-warning-on').onclick();assert.equal(state.settings.tokenWarnSeconds,0);assert.equal(E('tk-clock-warning-title').textContent,'Warning off');assert.equal(E('tk-warn').disabled,true);
  await E('tk-warning-on').onclick();assert.equal(state.settings.tokenWarnSeconds,90);assert.equal(E('tk-warn').disabled,false);
  await set('tk-warn','.6');assert.equal(state.settings.tokenWarnSeconds,.6,'Keep fractional seconds from existing settings');
  E('tk-warn').value='0';E('tk-warn').oninput({target:E('tk-warn')});assert.equal(E('tk-warn').disabled,false,'Typing zero must not disable before change saves it');await E('tk-warn').onchange({target:E('tk-warn')});assert.equal(state.settings.tokenWarnSeconds,0);
  await E('tk-warning-on').onclick();await set('tk-warn','3600');assert.equal(E('tk-clock-running-digits').textContent,'1:01:15');
  await set('tk-warncolor','#ffffff');assert.equal(E('tk-clock-warning').style.color,'#000');await set('tk-outcolor','#000000');assert.equal(E('tk-clock-out').style.color,'#fff');
  await click({rail:'take'});assert.equal(E('tk-section-take').open,true);assert.equal(E('tk-section-take').scrolled,true);E('tk-section-take').open=false;
  await set('tk-warn','40');assert.equal(E('tk-section-take').open,false,'Saving does not reopen sections');

  fail=true;await set('tk-warn','80');assert.equal(state.settings.tokenWarnSeconds,40);assert.equal(E('rsready').textContent,'Could not save');assert.equal(E('tk-retry').hidden,false);assert.ok(E('tk-msg').textContent.includes('disk full'));
  fail=false;await E('tk-retry').onclick();assert.equal(state.settings.tokenWarnSeconds,80);assert.equal(E('tk-retry').hidden,true);
  const normal=api.setSettings;let release;let calls=0;
  api.setSettings=patch=>{calls++;return new Promise(resolve=>{release=()=>resolve({...state.settings,...patch});});};
  const first=set('tk-warn','100');await new Promise(resolve=>setImmediate(resolve));
  const second=set('tk-warncolor','#445566');assert.equal(calls,1,'Writes are serialized');release();await first;await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,2);release();await second;assert.equal(state.settings.tokenWarnSeconds,100);assert.equal(state.settings.tokenWarnColor,'#445566');
  const late=set('tk-warn','120');await new Promise(resolve=>setImmediate(resolve));state.setupSub='bop';E('rsready').textContent='Another page';box.isConnected=false;release();await late;assert.equal(E('rsready').textContent,'Another page','A late save must not redraw another page');
  box.isConnected=true;state.setupSub='tokens';api.setSettings=normal;
  await vm.runInContext('renderTokenSettings(document.getElementById("setupmgr"))',ctx);await E('tk-reset').onclick();assert.deepEqual(T.settings(Tokens.settingsOf(state.settings)),T.standard());
  assert.ok(writes.every(p=>Object.keys(p).length===5),'Only the five token settings are written');
  console.log('ALL TIME TOKEN SETTINGS TESTS PASSED');
}
module.exports=check;
if(require.main===module)check().catch(error=>{console.error(error);process.exitCode=1;});
