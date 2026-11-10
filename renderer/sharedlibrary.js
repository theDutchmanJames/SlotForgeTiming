(function(root){
 'use strict';
 // One lightweight status request at a time. Never replace an editor, active
 // race, focused control or open result while someone is using it.
 function watch({read,canRefresh,refresh,schedule=fn=>setTimeout(fn,2000),cancel=clearTimeout,initial}){
  const version=s=>Number.isSafeInteger(s?.revision)?JSON.stringify([s.databaseId,s.recoveryId,s.revision]):s?.changeCursor||null;
  let stopped=false,timer,baseline=version(initial);
  async function tick(){try{if(canRefresh()){const current=await read();if(stopped)return;if(current.available&&version(current)!==baseline){if(baseline){if(!canRefresh())return;await refresh();if(stopped)return;}baseline=version(current);}}}catch{/* A transient unavailable library keeps the current view and retries. */}finally{if(!stopped)timer=schedule(tick);}}
  timer=schedule(tick);return ()=>{stopped=true;cancel(timer);};
 }
 root.SharedLibraryWatch={watch};if(typeof module!=='undefined')module.exports={watch};
})(globalThis);
