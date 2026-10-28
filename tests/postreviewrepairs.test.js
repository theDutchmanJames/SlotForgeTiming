const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const B=require('../renderer/arduinobox'),C=require('../renderer/widgetcompose'),T=require('../renderer/timing'),P=require('../renderer/widgetpreview'),Charts=require('../renderer/chartwidgets');
async function main(){
  const writes=[],timers=[];
  const ctx=vm.createContext({ArduinoBox:B,document:{getElementById:()=>null},performance:{now:()=>0},Hardware:{line:()=>''},setTimeout:fn=>timers.push(fn),clearTimeout(){},setInterval(){},clearInterval(){}});
  vm.runInContext(fs.readFileSync(require.resolve('../renderer/arduinoui'),'utf8'),ctx);
  vm.runInContext('let kept=false;let live=null;const raceKept=()=>kept;ab.open=true;',ctx);
  ctx.writer={write:async bytes=>writes.push(Buffer.from(bytes).toString())};
  vm.runInContext('ab.writer=writer',ctx);
  for(const phase of ['ready','countdown','running','paused','between','review','finished']){
    vm.runInContext(`kept=true;live={phase:${JSON.stringify(phase)}}`,ctx);
    assert.equal(await vm.runInContext('abDiagnostic(ArduinoBox.C.mainPower(true))',ctx),false,phase+' power locked');
    assert.equal(await vm.runInContext('abDiagnostic(ArduinoBox.C.calibrate())',ctx),false,phase+' calibration locked');
  }
  assert.deepEqual(writes,[]);
  await vm.runInContext('abSend(ArduinoBox.C.keepalive());abSend(ArduinoBox.C.mainPower(false))',ctx);
  assert.equal(writes.length,2,'maintenance and emergency shutdown still available');
  vm.runInContext('kept=false;live={box:{}}',ctx);
  assert.equal(vm.runInContext('abLocked()',ctx),true,'bound interface protects even without page state');
  vm.runInContext('live=null',ctx);
  assert.equal(await vm.runInContext('abDiagnostic(ArduinoBox.C.calibrate())',ctx),true);
  writes.length=0;
  const test=vm.runInContext('abTestLights()',ctx);
  await new Promise(setImmediate);
  assert.equal(writes.length,2,'test starts outside a race');
  vm.runInContext('kept=true;abCancelTests();kept=false',ctx);
  timers.shift()();await test;
  assert.equal(writes.length,2,'test cannot resume after a race opened and closed');
  const ui=fs.readFileSync(require.resolve('../renderer/arduinoui'),'utf8');
  assert(ui.includes('live?.actions?.hardwareStop?.()'),'emergency off never toggles the red flag');
  assert(fs.readFileSync(require.resolve('../renderer/race'),'utf8').includes("if(typeof abCancelTests==='function')abCancelTests();"));
  for(const scope of ['textlane','textrace']){
    const chart={...Charts.clean({style:'track',name:'Track',drivers:'one',lane:0}),id:'track'};
    const composition=C.clean({root:{kind:'free',id:'root',children:[{kind:'component',id:'chart',component:'racechart',options:{chartDesign:'track'},frame:{x:0,y:0,w:100,h:100}}]}});
    const w={type:scope,lane:0,opt:{composition}},S={...P.state(w),preview:false,chartDesigns:[chart]};
    const before=JSON.stringify(composition),out=T.content(w,S);
    assert.equal(out.components.length,1);assert(out.html.includes('data-wc-component="chart"'));
    const large=out.components[0].render({width:560,height:330}),small=out.components[0].render({width:200,height:130});
    assert(large.chartTrack,'live metadata retained');assert(large.html.includes('width="560"'));
    assert(small.html.includes('Enlarge chart'),'small chart uses supported minimum instead of clipping');
    assert.equal(JSON.stringify(composition),before,'saved design unchanged');
    if(scope==='textlane'){
      const R=require('../renderer/rows'),row={...R.defaultDesign(),id:'row',widgets:[{...w,x:0,y:0,w:1000,h:300}],ratioH:300};
      const nested=T.content({type:'leaderboard',opt:{design:'row'}},{...S,rowDesigns:[row]});
      assert(nested.components.length>1,'all leaderboard rows keep embedded charts');
      assert.equal(new Set(nested.components.map(c=>c.id)).size,nested.components.length,'row component identities do not collide');
      for(const descriptor of nested.components)assert(nested.html.includes('data-wc-component="'+descriptor.id+'"'));
    }
  }
  console.log('POST-REVIEW REPAIRS PASSED: Arduino ownership/cancellation and nested chart lifecycle/size contracts.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
