'use strict';
// Shared pure ledger transition; persistence and serialization belong to each backend.
const { isDeepStrictEqual } = require('node:util');
const own = (map, key) => Object.hasOwn(map, key) ? map[key] : undefined;
const put = (map, key, value) => Object.defineProperty(map, key, { value, enumerable: true, configurable: true, writable: true });
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
function applyCheckpoint(ledger, snap) {
    // The acknowledged state must not remain aliased to a caller's mutable race snapshot.
    snap=JSON.parse(JSON.stringify(snap));
    if(!record(ledger)||ledger.v!==1||!record(ledger.accounts)||!record(ledger.runs)||!Array.isArray(ledger.history))throw Error('Invalid or unsupported resource ledger.');
    const state=snap?.race?.resources;if(!state||state.v!==1||!Array.isArray(state.events)||typeof state.runId!=='string'||!state.runId||!state.profile?.id||!state.accounts||Array.isArray(state.accounts))throw Error('Invalid resource checkpoint.');
    const next=JSON.parse(JSON.stringify(ledger)),run=own(next.runs,state.runId)||{count:0,closed:false};
    if(!record(run)||!Number.isSafeInteger(run.count)||run.count<0)throw Error('Invalid resource run state.');
    if(run.closed)throw Error('This resource event has already ended.');
    if(next.checkpoint&&next.checkpoint.race.resources.runId!==state.runId)throw Error('Another resource event is awaiting recovery.');
    if(state.events.length<run.count)throw Error('Resource recovery would lose recorded spending.');
    const previous=next.checkpoint?.race?.resources?.events||[];
    if(run.count && !isDeepStrictEqual(state.events.slice(0,run.count),previous.slice(0,run.count)))throw Error('Previously recorded resource spending cannot be changed.');
    // Initial allocations are durable even when nothing has been spent yet.
    for(const [key,src] of Object.entries(state.accounts||{})){
      if(src.profileId!==state.profile.id||src.key!==key)throw Error('Invalid resource account.');
      if(!own(next.accounts,key))put(next.accounts,key,{...JSON.parse(JSON.stringify(src)),balance:{...src.initial}});
    }
    for(let i=run.count;i<state.events.length;i++){
      const e=state.events[i],src=e&&own(state.accounts,e.account);
      if(e.id!==state.runId+':'+(i+1)||!src||src.profileId!==state.profile.id)throw Error('Invalid resource transaction.');
      let a=own(next.accounts,e.account);if(!a){a={...JSON.parse(JSON.stringify(src)),balance:{...src.initial}};put(next.accounts,e.account,a);}
      for(const[k,n]of Object.entries(e.delta)){if(!Number.isInteger(n)||Math.abs(n)>100000||(a.balance[k]||0)+n<0)throw Error('Resource balance conflict. Reload the saved race before continuing.');a.balance[k]=(a.balance[k]||0)+n;}
      next.history.push({...e,runId:state.runId,date:new Date().toISOString(),ownerName:a.name,profileId:a.profileId});
    }
    // A checkpoint may be saved again without new spending. The engine balance must still agree.
    for(const [key,b] of Object.entries(state.accounts)){const a=next.accounts[key];for(const k of new Set([...Object.keys(a.balance),...Object.keys(b.balance)]))if(a.balance[k]!==b.balance[k])throw Error('Resource balances do not match the ledger.');}
    put(next.runs,state.runId,{count:state.events.length,closed:false});next.checkpoint=snap;return next;
}
module.exports = { applyCheckpoint };
