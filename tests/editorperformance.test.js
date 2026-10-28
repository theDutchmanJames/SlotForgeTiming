const assert=require('assert/strict'),fs=require('fs'),vm=require('vm');
const E=require('../renderer/editorcanvas');
const frames=new Map();let id=0;const request=f=>{frames.set(++id,f);return id;},cancel=i=>frames.delete(i),tick=()=>{const batch=[...frames.values()];frames.clear();batch.forEach(f=>f());};
const calls=[],q=E.latest(v=>calls.push(v),request,cancel);
for(let i=0;i<100;i++)q.push(i);
assert.equal(frames.size,1);tick();assert.deepEqual(calls,[99]);
q.push('last movement');q.flush();assert.deepEqual(calls,[99,'last movement']);assert.equal(frames.size,0);tick();assert.equal(calls.length,2);
q.push('old editor');q.cancel();tick();assert.equal(calls.length,2);
const again=E.latest(v=>{calls.push(v);if(v===1)again.push(2);},request,cancel);again.push(1);tick();assert.equal(frames.size,1);tick();assert.deepEqual(calls.slice(-2),[1,2]);
const w={type:'pace',x:1,y:2,w:100,h:50,opt:{look:'gauge'},fonts:{value:'inter'}};
assert.equal(E.signature(w),E.signature({...w,x:20,y:30,w:200,h:75}));
assert.notEqual(E.signature(w),E.signature({...w,opt:{look:'text'}}));

// A cold font fans out to many widgets but publishes one notification. Warm
// fonts, detached widgets and superseded font choices must not refit the page.
(async()=>{
 let resolveFont,loads=0;const pending=new Promise(r=>resolveFont=r),events=[];
 const context={Map,Set,WeakMap,Promise,console,requestAnimationFrame:request,cancelAnimationFrame:cancel,
  document:{fonts:{load(){loads++;return pending;},ready:Promise.resolve()},querySelectorAll:()=>[]},
  CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail;}},dispatchEvent:e=>events.push(e)};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync('renderer/widgetfonts.js','utf8'),context);
 const F=context.WidgetFonts,mk=()=>({isConnected:true,style:{setProperty(){},removeProperty(){}},toggleAttribute(){}});
 const nodes=Array.from({length:64},mk),widget={fonts:{value:'inter'}};let refits=0;
 nodes.forEach(n=>F.apply(n,widget,{},()=>refits++));assert.equal(loads,1);
 nodes[0].isConnected=false;F.apply(nodes[1],{},{});
 resolveFont();await new Promise(setImmediate);tick();
 assert.equal(events.length,1);assert.equal(events[0].detail.elements.length,62);assert.equal(refits,62);
 F.apply(mk(),widget,{},()=>refits++);await new Promise(setImmediate);tick();assert.equal(events.length,1,'warm font needs no second fit');
 nodes.slice(2).forEach(n=>F.apply(n,widget,{}));tick();assert.equal(events.length,1,'same binding remains quiet');
 console.log('EDITOR PERFORMANCE PASSED: frame coalescing, final flush, cancellation, signatures, cold/warm fonts, stale bindings');
})().catch(e=>{console.error(e);process.exitCode=1;});
