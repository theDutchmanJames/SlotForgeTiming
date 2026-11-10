'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),{watch}=require('../renderer/sharedlibrary');
test('shared-library refresh is quiet, pauses during edits and does not lose a change during an in-flight read',async()=>{
 let next,allowed=true,reads=0,refreshes=0,cursor='a',duringRead=()=>{},cancelled=false;
 const stop=watch({initial:{changeCursor:'a'},schedule:fn=>{next=fn;return 1;},cancel:()=>cancelled=true,canRefresh:()=>allowed,read:async()=>{reads++;duringRead();return {available:true,changeCursor:cursor};},refresh:async()=>refreshes++});
 await next();assert.equal(reads,1);assert.equal(refreshes,0);
 cursor='b';allowed=false;await next();assert.equal(reads,1);
 allowed=true;duringRead=()=>{allowed=false;};await next();assert.equal(refreshes,0);
 duringRead=()=>{};allowed=true;await next();assert.equal(refreshes,1);await next();assert.equal(refreshes,1);
 stop();assert(cancelled);
});
test('private original history and companion edits refresh on library revision without a public cursor change',async()=>{
 let next,refreshes=0;const initial={available:true,databaseId:'db',recoveryId:'epoch',revision:1,changeCursor:'same'};
 const stop=watch({initial,canRefresh:()=>true,read:async()=>({...initial,revision:2}),refresh:async()=>refreshes++,schedule:fn=>{next=fn;},cancel:()=>{}});await next();assert.equal(refreshes,1);await next();assert.equal(refreshes,1);stop();
});
