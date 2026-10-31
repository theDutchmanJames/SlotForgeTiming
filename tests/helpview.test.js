const assert=require('node:assert/strict'),Help=require('../renderer/help'),V=require('../renderer/helpview');
const v=V.create({folders:Help.folders,WELCOME:Help.WELCOME}),topics=Help.folders(),ids=v.groups.flatMap(g=>g.ids);
assert.equal(topics.length,103,'existing topics plus Track Builder and Paddock guidance');assert(ids.includes('paddock'));assert.equal(new Set(ids).size,ids.length);assert.deepEqual([...ids].sort(),topics.map(t=>t.id).sort());
for(const t of topics){assert(v.search(t.title).some(x=>x.id===t.id),'search reaches '+t.id);assert(v.select(t.id));assert(v.html().includes(t.body),'full article is available: '+t.id);}
assert.equal(v.select('not-a-topic'),false);assert(v.select('start-guide'));assert(v.html().includes('Your first race'));
assert.equal(v.search('Lap Highlights')[0].id,'laphighlights');assert(v.search('flash').some(t=>t.id==='laphighlights'));
assert.deepEqual(v.search('pit stop').map(x=>x.id),v.search('pitstop').map(x=>x.id));assert(v.search('InpOut').some(x=>x.id==='parallel'),'search includes body content');
assert.equal(v.search('no_such_topic_9273').length,0);assert.equal(v.search(' ').length,0);
v.state.query='<img src=x onerror=alert(1)>';assert(!v.html().includes('<img'));assert(v.html().includes('&lt;img'));assert(!v.html().includes('undefined'));
const sample=JSON.stringify(Help.SECTIONS);assert.deepEqual(V.fuelExample(100,2,10),{laps:50,seconds:10});assert.deepEqual(V.fuelExample(60,.5,2),{laps:120,seconds:30});
for(const x of [0,-1,'',NaN,Infinity,'oops',10001])assert.equal(V.fuelExample(x,2,10),null);assert.equal(V.fuelExample(100,0,10),null);assert.equal(V.fuelExample(100,2,0),null);assert.equal(JSON.stringify(Help.SECTIONS),sample);
v.select('fuel');assert(v.state.opened.has('systems'));v.state.articleOpened.add('fuel');assert(v.html().includes('data-help-more="fuel" open'));
assert.deepEqual(V.ROUTES.fuel,{tab:'setup',setupSub:'fuel'});assert.equal(V.ROUTES.unknown,undefined);
// Event delegation must ignore unrelated and forged controls, and copy routes.
let dest;const box={innerHTML:'',querySelectorAll:()=>[]};v.render(box,{onNavigate:d=>{dest=d;}});box.onclick({target:{closest:()=>null}});box.onclick({target:{}});
box.onclick({target:{closest:()=>({dataset:{helpRoute:'unknown'}})}});assert.equal(dest,undefined);
box.onclick({target:{closest:()=>({dataset:{helpRoute:'fuel'}})}});
Promise.resolve().then(()=>{assert.deepEqual(dest,V.ROUTES.fuel);dest.setupSub='wrong';assert.equal(V.ROUTES.fuel.setupSub,'fuel');console.log('Help view: all 100 topics, grouping, full-content search, escaping, example validation, state and navigation passed.');});
