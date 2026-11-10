'use strict';
const crypto = require('node:crypto');
const { hash: payloadHash, checkedReceipt, TERMINAL_CODES } = require('./paddock');
const { setPath } = require('./sqlite-records');
const SCHEMA = `CREATE TABLE delivery_outbox(
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,key TEXT NOT NULL UNIQUE,owner TEXT NOT NULL,
  databaseId TEXT NOT NULL,sourceId TEXT NOT NULL,sessionId TEXT NOT NULL,revision INTEGER NOT NULL,state TEXT NOT NULL,
  payloadHash TEXT NOT NULL,payload TEXT NOT NULL,current INTEGER NOT NULL,status TEXT NOT NULL,error TEXT NOT NULL,
  receipt TEXT,receiptCheckedAt TEXT,receiptCheckError TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,attemptToken TEXT,leaseUntil INTEGER NOT NULL DEFAULT 0,nextAttemptAt INTEGER NOT NULL DEFAULT 0);
  CREATE INDEX delivery_ready ON delivery_outbox(databaseId,current,status,nextAttemptAt,leaseUntil,sequence);
  CREATE INDEX delivery_owner ON delivery_outbox(owner,current);`;
const {keyOf}=require('./delivery-key');
function index(s, owner, delivery) {
  const p = delivery?.payload, key = keyOf(p);
  if (!key) {
    // Keep conversion failures visible, but never offer them to the sender.
    const blockedKey=payloadHash(['blocked',owner,p ?? null]);
    s.statement(`INSERT INTO delivery_outbox(key,owner,databaseId,sourceId,sessionId,revision,state,payloadHash,payload,current,status,error,receiptCheckError)
      VALUES(?,?,?,'',?,0,'blocked',?,?,1,'attention',?,'') ON CONFLICT(key) DO UPDATE SET current=1,error=excluded.error`)
      .run(blockedKey,owner,String(delivery?.databaseId || delivery?.previousPayload?.databaseId || p?.databaseId || ''),String(delivery?.sessionId || p?.sessionId || owner.slice(8)),payloadHash(p ?? null),JSON.stringify(p ?? null),delivery?.error || 'Review this result before it can be sent.');
    return;
  }
  const digest = payloadHash(p), old = s.statement('SELECT payloadHash FROM delivery_outbox WHERE key=?').get(key);
  if (old && old.payloadHash !== digest) throw Error('A delivery revision cannot be reused with different content.');
  s.statement(`INSERT INTO delivery_outbox(key,owner,databaseId,sourceId,sessionId,revision,state,payloadHash,payload,current,status,error,receipt,receiptCheckedAt,receiptCheckError)
    VALUES(?,?,?,?,?,?,?,?,?,1,?,?,?,?,?) ON CONFLICT(key) DO UPDATE SET current=1,status=excluded.status,error=excluded.error,
    receipt=excluded.receipt,receiptCheckedAt=excluded.receiptCheckedAt,receiptCheckError=excluded.receiptCheckError`)
    .run(key,owner,p.databaseId,p.source.id,p.sessionId,p.revision,p.state,digest,JSON.stringify(p),delivery.status || 'pending',delivery.error || '',delivery.receipt ? JSON.stringify(delivery.receipt) : null,delivery.receiptCheckedAt || null,delivery.receiptCheckError || '');
}
function syncSession(s, id) {
  const owner = 'session:' + id;
  s.statement('UPDATE delivery_outbox SET current=0 WHERE owner=?').run(owner);
  const delivery = s.get('sessions', id, true)?.value?.paddockDelivery;
  if (delivery && delivery.status !== 'withdrawn') index(s, owner, delivery);
}
function syncWithdrawals(s) {
  s.statement("UPDATE delivery_outbox SET current=0 WHERE owner='withdrawal'").run();
  for (const delivery of s.field('@meta','paddock',['withdrawals']).value || []) index(s, 'withdrawal', delivery);
}
function upgrade(s) {
  const current = s.statement("SELECT value FROM info WHERE key='workingFormat'").get()?.value;
  if (['2','3','4','5','6'].includes(current)) { s.statement('SELECT key,owner,payloadHash,current,attemptToken,leaseUntil,nextAttemptAt FROM delivery_outbox LIMIT 0').all(); return; }
  if (current !== '1') throw Error('Unsupported SQLite working format.');
  s.transaction(() => {
    if (['2','3','4','5','6'].includes(s.statement("SELECT value FROM info WHERE key='workingFormat'").get()?.value)) return;
    s.db.exec(SCHEMA);
    for (const row of s.statement("SELECT id FROM records WHERE entity='sessions' ORDER BY ordinal").all()) syncSession(s, row.id);
    syncWithdrawals(s);
    s.statement("UPDATE info SET value='2' WHERE key='workingFormat'").run();
  });
}
function syncChanges(s) {
  for (const change of s.changed.values()) {
    if (change.entity === 'sessions') syncSession(s, change.id);
    if (change.entity === '@meta' && change.id === 'paddock') syncWithdrawals(s);
  }
}
function get(s, key) {
  if (typeof key !== 'string' || !/^[a-f0-9]{64}$/.test(key)) throw Error('Invalid delivery identity.');
  const row = s.statement('SELECT * FROM delivery_outbox WHERE key=?').get(key);
  if (!row) throw Error('Delivery not found.'); return row;
}
function page(s, databaseId, { after = 0, limit = 50, status = 'all' } = {}) {
  if (typeof databaseId !== 'string' || !databaseId || !Number.isSafeInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 200 || !['all','pending','sent','attention'].includes(status)) throw Error('Invalid delivery query.');
  return s.statement(`SELECT sequence,key,databaseId,sourceId,sessionId,revision,state,payloadHash,status,error,receiptCheckedAt,receiptCheckError,attempts,leaseUntil,nextAttemptAt
    FROM delivery_outbox WHERE databaseId=? AND current=1 AND sequence>? AND (?='all' OR status=?) ORDER BY sequence LIMIT ?`).all(databaseId,after,status,status,limit);
}
function payload(s, key, token) {
  const row = get(s,key);
  if (!row.current || row.status !== 'pending' || row.attemptToken !== token || row.leaseUntil <= s.clock()) throw Error('Delivery attempt expired or was superseded.');
  return JSON.parse(row.payload);
}
function snapshot(s,key,options={}) {
  const row=get(s,key);
  return {key:row.key,current:!!row.current,status:row.status,payloadHash:row.payloadHash,payload:JSON.parse(row.payload),...guard(s,row,options.engineOriginals===true)};
}
function guard(s,row,includeOriginals=false){
 const C=require('./sqlite-catalogue');const d=row.owner.startsWith('session:')?Object.fromEntries(['guard','guardBlocked','transport',...(includeOriginals?['engineOriginals']:[])].map(k=>[k,C.read(s,'sessions',row.owner.slice(8),['paddockDelivery',k])])):(s.field('@meta','paddock',['withdrawals']).value||[]).find(d=>keyOf(d.payload)===row.key);
 return {guard:d?.guard||null,guardBlocked:d?.guardBlocked||null,transport:d?.transport||'network',...(includeOriginals?{engineOriginals:d?.engineOriginals||null}:{})};
}
function mirror(s, row, patch) {
  if (!row.current) return false;
  if (row.owner.startsWith('session:')) {
    const id = row.owner.slice(8), session = s.get('sessions', id, true)?.value;
    if (keyOf(session?.paddockDelivery?.payload) !== row.key) return false;
    setPath(s,'sessions',id,['paddockDelivery'],{ ...session.paddockDelivery, ...patch }); return true;
  }
  const list = s.field('@meta','paddock',['withdrawals']).value || [];
  let matched = false;
  for (const d of list) if (keyOf(d.payload) === row.key) { Object.assign(d, patch); matched = true; }
  if (matched) setPath(s,'@meta','paddock',['withdrawals'],list);
  return matched;
}
function claimDelivery(s, { deliveryKey, databaseId, leaseMs = 30000, transport = 'network' }) {
  const row = get(s,deliveryKey), now = s.clock();
  if (row.databaseId !== databaseId) throw Error('Delivery belongs to another Paddock database.');
  const connected = s.field('@meta','paddock',['connection','databaseId']);
  const actual=guard(s,row).transport;if(actual!==transport)throw Error('Result transport mismatch.');
  if (actual!=='engine'&&(!connected.present || connected.value !== databaseId)) throw Error('Connect to the original Paddock database before sending.');
  if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300000) throw Error('Invalid delivery lease.');
  if (!row.current || row.status !== 'pending' || row.leaseUntil > now || row.nextAttemptAt > now) throw Object.assign(Error('Delivery is unavailable, leased or waiting to retry.'),{code:'DELIVERY_NOT_READY'});
  const attemptToken = crypto.randomUUID();
  s.statement('UPDATE delivery_outbox SET attempts=attempts+1,attemptToken=?,leaseUntil=? WHERE key=?').run(attemptToken,now+leaseMs,row.key);
  s.touch('@delivery',row.key);
  return { deliveryKey: row.key, attemptToken, payloadHash: row.payloadHash, leaseUntil: now + leaseMs };
}
function prepareDeliveryUpload(s,c){
 const row=get(s,c.deliveryKey),g=guard(s,row);if(!row.current||row.status!=='pending'||g.guardBlocked||row.attemptToken!==c.attemptToken||typeof c.attemptToken!=='string')throw Object.assign(Error('Delivery changed.'),{code:'DELIVERY_NOT_READY'});
 const next=require('./paddock-history-upload').prepare(g.guard,c.operationId,c.replaceUploadId);mirror(s,row,{guard:next.guard});s.statement('UPDATE delivery_outbox SET leaseUntil=? WHERE key=?').run(s.clock()+30000,row.key);s.touch('@delivery',row.key);return next.upload;
}
function acknowledgeDelivery(s, { deliveryKey, attemptToken, receipt, guardReceipt, checkError }) {
  const row = get(s,deliveryKey);
  if (row.attemptToken !== attemptToken || typeof attemptToken !== 'string') return { applied: false, stale: true };
  checkedReceipt(receipt,JSON.parse(row.payload));
  const g=guard(s,row);if(g.guard&&row.current){if(g.guardBlocked)throw Error(g.guardBlocked);const p=JSON.parse(row.payload);require(g.transport==='engine'&&require('./shared-library-original-history').isOriginal(p)?'./shared-library-original-history':'./paddock-history-write').receipt(guardReceipt,g.guard.operations.at(-1),p);}
  const checkedAt = new Date(s.clock()).toISOString();
  s.statement("UPDATE delivery_outbox SET status='sent',error='',receipt=?,receiptCheckedAt=?,receiptCheckError=?,leaseUntil=0,nextAttemptAt=0,attemptToken=NULL WHERE key=?").run(JSON.stringify(receipt),checkedAt,checkError||'',row.key);
  const applied = mirror(s,row,{ status:'sent', error:'', receipt, receiptCheckedAt:checkedAt, receiptCheckError:checkError||'',...(guardReceipt&&g.guard?{guardReceipt,guard:{version:1,operations:[g.guard.operations.at(-1)]}}:{}) });
  s.touch('@delivery',row.key); s.checkpoint('delivery-acknowledged');
  return { applied, superseded: !applied };
}
function failDelivery(s, { deliveryKey, attemptToken, code = '', message, retryAfterMs = 60000 }) {
  const row = get(s,deliveryKey);
  if (row.attemptToken !== attemptToken || typeof attemptToken !== 'string') return { applied:false, stale:true };
  if (typeof message !== 'string' || message.length > 2000 || typeof code !== 'string' || code.length > 100 || !Number.isFinite(retryAfterMs) || retryAfterMs < 0 || retryAfterMs > 86400000) throw Error('Invalid delivery failure.');
  const status = TERMINAL_CODES.has(code) ? 'attention' : 'pending';
  s.statement('UPDATE delivery_outbox SET status=?,error=?,attemptToken=NULL,leaseUntil=0,nextAttemptAt=? WHERE key=?').run(status,message,s.clock()+retryAfterMs,row.key);
  const applied = mirror(s,row,{ status,error:message }); s.touch('@delivery',row.key);
  return { applied, superseded: !applied, status };
}
function retryDelivery(s, { deliveryKey, expectedHash }) {
  const row = get(s,deliveryKey);
  if(row.leaseUntil>s.clock())throw Object.assign(Error('Delivery is leased.'),{code:'DELIVERY_NOT_READY'});
  if (!row.current || row.payloadHash !== expectedHash || !['attention','pending'].includes(row.status) || !keyOf(JSON.parse(row.payload))) throw Error('Delivery changed or needs review before retrying.');
  s.statement("UPDATE delivery_outbox SET status='pending',error='',nextAttemptAt=0,leaseUntil=0,attemptToken=NULL WHERE key=?").run(row.key);
  mirror(s,row,{status:'pending',error:''}); s.touch('@delivery',row.key); return { pending:true };
}
function recordDeliveryCheck(s, { deliveryKey, expectedHash, receipt, error }) {
  const row = get(s,deliveryKey);
  if (!row.current || row.status !== 'sent' || row.payloadHash !== expectedHash) return { applied:false, stale:true };
  const patch = receipt ? { receipt:checkedReceipt(receipt,JSON.parse(row.payload)), receiptCheckedAt:new Date(s.clock()).toISOString(),receiptCheckError:'' } : {receiptCheckError:error};
  if (!receipt && (typeof error !== 'string' || !error || error.length > 2000)) throw Error('Invalid receipt-check failure.');
  const applied = mirror(s,row,patch); s.touch('@delivery',row.key); return { applied };
}
module.exports = { upgrade, syncChanges, page, payload, snapshot, keyOf, commands: { prepareDeliveryUpload, claimDelivery, acknowledgeDelivery, failDelivery, retryDelivery, recordDeliveryCheck } };
