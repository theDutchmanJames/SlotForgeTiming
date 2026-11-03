'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{create}=require('../renderer/cataloguethumbnails');
test('previews share concurrent work, retain revisions and evict by memory and item budgets',async()=>{
 let calls=0;const cache=create({transform:async s=>'thumb-'+s,maxBytes:32,maxItems:2}),load=async()=>{calls++;return 'a';};assert.deepEqual(await Promise.all([cache.get('car:rev1',load),cache.get('car:rev1',load)]),['thumb-a','thumb-a']);assert.equal(calls,1);
 await cache.get('car:rev2',async()=>'b');await cache.get('other',async()=>'c');assert.equal(cache.stats().items,2);assert(cache.stats().bytes<=32);await cache.get('car:rev1',load);assert.equal(calls,2);
});
test('failed and empty previews can retry; oversized media never enters cache',async()=>{
 const cache=create({transform:async s=>s,maxBytes:8});await assert.rejects(cache.get('x',async()=>{throw Error('offline');}),/offline/);assert.equal(await cache.get('x',async()=>''),'');assert.equal(cache.stats().items,0);assert.equal(await cache.get('x',async()=>'long media'),'long media');assert.equal(cache.stats().items,0);assert.equal(cache.stats().pending,0);assert.equal(await cache.get('x',async()=>'ok'),'ok');assert.equal(cache.stats().items,1);
});
