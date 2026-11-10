'use strict';
// These lookup indexes belong to authoritative lap, delivery and media storage.
// Recreate only absent indexes; never rebuild those tables or their rows.
const definitions={
  lap_session:'ON lap_index(sessionId,id)',
  lap_car:'ON lap_index(carId,valid,pit,time)',
  lap_driver:'ON lap_index(driverId,valid,pit,time)',
  lap_track:'ON lap_index(trackId,valid,pit,time)',
  delivery_ready:'ON delivery_outbox(databaseId,current,status,nextAttemptAt,leaseUntil,sequence)',
  delivery_owner:'ON delivery_outbox(owner,current)',
  asset_digest:'ON asset_refs(digest)'
};
function ensure(s){s.transaction(()=>{
  const names=new Set(s.statement("SELECT name FROM sqlite_master WHERE type='index'").all().map(r=>r.name));
  for(const [name,definition] of Object.entries(definitions))if(!names.has(name))s.db.exec('CREATE INDEX '+name+' '+definition);
  s.checkpoint?.('lookup-indexes-repaired');
});}
module.exports={ensure,definitions};
