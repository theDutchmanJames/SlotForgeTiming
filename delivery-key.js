'use strict';
const {createHash}=require('node:crypto');
// Stable identity shared by the JSON sender and SQLite outbox; no storage imports.
function keyOf(p){
 if(!p||typeof p.databaseId!=='string'||!p.databaseId||typeof p.source?.id!=='string'||!p.source.id||typeof p.sessionId!=='string'||!p.sessionId||!Number.isSafeInteger(p.revision)||p.revision<1||!['active','withdrawn'].includes(p.state))return null;
 return createHash('sha256').update(JSON.stringify([p.databaseId,p.source.id,p.sessionId,p.revision,p.state])).digest('hex');
}
module.exports={keyOf};
