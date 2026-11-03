'use strict';
const { randomUUID } = require('node:crypto');
const { checkedReceipt } = require('./paddock');
// Transport is supplied by the authenticated Paddock client. No sockets or timing
// work run in storage. JSON production and isolated SQLite workers use this pump.
class DeliveryService {
  constructor(client, { call, isRacing = () => false, isStopped = () => false }) {
    this.client = client; this.call = call; this.isRacing = isRacing; this.isStopped = isStopped; this.busy = false;
  }
  stopped() { return this.isRacing() || this.isStopped(); }
  async checkReceipt(deliveryKey) {
    if (this.busy || this.stopped()) throw Error('Finish the race or current delivery operation first.');
    this.busy=true;
    try {
      const row=await this.client.deliverySnapshot(deliveryKey);
      if (!row.current || row.status!=='sent') throw Error('Choose a currently delivered result.');
      if (this.stopped()) return {deferred:true};
      const p=row.payload; let receipt,failure;
      try { receipt=checkedReceipt(await this.call('/v1/timing/sessions/'+encodeURIComponent(p.source.id)+'/'+encodeURIComponent(p.sessionId)),p); }
      catch(error) { failure=error; }
      if(this.stopped())return {deferred:true};
      const result=await this.client.command({id:randomUUID(),type:'recordDeliveryCheck',deliveryKey,expectedHash:row.payloadHash,
        ...(failure?{error:failure.code==='SESSION_NOT_FOUND'?'Paddock no longer has a receipt for this result. Verify the original database before resending.':String(failure.message).slice(0,2000)}:{receipt})});
      if(failure && result.applied)throw failure;
      return result;
    } finally {this.busy=false;}
  }
  async retry(databaseId) {
    if(this.busy||this.stopped())throw Error('Finish the race or current delivery operation first.');
    this.busy=true;
    try{let after=0;for(;;){const rows=await this.client.outbox(databaseId,{status:'all',after,limit:50});if(!rows.length)break;for(const row of rows){if(this.stopped())return;if(!['attention','pending'].includes(row.status))continue;const snap=await this.client.deliverySnapshot(row.key);if(this.stopped())return;if(snap.payload?.state==='active'||snap.payload?.state==='withdrawn'){try{await this.client.command({id:randomUUID(),type:'retryDelivery',deliveryKey:row.key,expectedHash:row.payloadHash});}catch(error){if(error.code!=='DELIVERY_NOT_READY')throw error;}}}after=rows.at(-1).sequence;}}
    finally{this.busy=false;}
  }
  async flush(databaseId) {
    if (this.busy || this.stopped()) return { deferred:true, sent:0 };
    this.busy = true; let sent = 0;
    try {
      let rows = await this.client.outbox(databaseId,{status:'pending',limit:50});
      if (!rows.length) return {sent};
      if (this.stopped()) return {deferred:true,sent};
      const host = await this.call('/v1/status');
      if (host.id !== databaseId) throw Object.assign(Error('Paddock database identity changed.'),{code:'DATABASE_MISMATCH'});
      if (!host.permissions?.timingResults) throw Error('This connection cannot send results. Use the Dealership password.');
      while (rows.length) {
        for (const row of rows) {
          if (this.stopped()) return {deferred:true,sent};
          let attempt;
          try { attempt = await this.client.command({ id:randomUUID(),type:'claimDelivery',deliveryKey:row.key,databaseId }); }
          catch (error) { if (error.code === 'DELIVERY_NOT_READY') continue; throw error; }
          try {
            if (this.stopped()) return {deferred:true,sent};
            const payload = await this.client.deliveryPayload(row.key,attempt.attemptToken);
            if (this.stopped()) return {deferred:true,sent};
            const receipt = await this.call('/v1/timing/sessions',payload);
            const result = await this.client.command({ id:randomUUID(),type:'acknowledgeDelivery',deliveryKey:row.key,attemptToken:attempt.attemptToken,receipt });
            if (result.applied) sent++;
          } catch (error) {
            await this.client.command({ id:randomUUID(),type:'failDelivery',deliveryKey:row.key,attemptToken:attempt.attemptToken,
              code:String(error.code || '').slice(0,100),message:String(error.message).slice(0,2000),retryAfterMs:Math.max(0,Math.min(86400000,error.retryAfterMs || 60000)) });
            throw error;
          }
        }
        rows = await this.client.outbox(databaseId,{status:'pending',after:rows.at(-1).sequence,limit:50});
      }
      return {sent,verified:true};
    } finally { this.busy = false; }
  }
}
module.exports = DeliveryService;
