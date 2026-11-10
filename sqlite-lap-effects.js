'use strict';
// Transaction-local input snapshots, never persisted as source data. Unknown
// mutation paths conservatively invalidate; repeated edits compare with the
// first value before the command, not an intermediate value.
const commands=new WeakMap();
const keys={
 detail:['sessionId','token','heat','lapNumber','trackId','driverId','carId','teamId','time','lane','invalid','tooSlow','late','pit'],
 car:['sessionId','token','trackId','carId','time','lane','invalid','tooSlow','late','pit','date'],
 home:['sessionId','token','trackId','driverId','carId','time','lane','invalid','tooSlow','late','date']
};
function signatures(value){return Object.fromEntries(Object.entries(keys).map(([kind,list])=>[kind,value===null?null:JSON.stringify(list.map(k=>[typeof value[k],value[k]]))]));}
function remember(s,id,insert=false){
 if(!s.changed)return;
 let changes=commands.get(s.changed);if(!changes){changes=new Map();commands.set(s.changed,changes);}if(changes.has(id))return;
 const row=insert?null:s.statement("SELECT json FROM fields WHERE entity='laps' AND id=? AND path='[]'").get(id);
 changes.set(id,{before:signatures(row?JSON.parse(row.json):null)});
}
function changed(s,id,kind){
 const row=commands.get(s.changed)?.get(id);if(!row)return true;
 if(!row.after){const current=s.statement("SELECT json FROM fields WHERE entity='laps' AND id=? AND path='[]'").get(id);row.after=signatures(current?JSON.parse(current.json):null);}
 return row.before[kind]!==row.after[kind];
}
module.exports={remember,changed};
