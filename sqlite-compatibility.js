'use strict';
// Explicit compatibility reads for editors that still need complete collections.
// Pages are consistent across revisions; callers never receive a truncated list.
const schema = require('./schema');
const Catalogue = require('./sqlite-catalogue');
const {stale} = require('./catalogue-read');
const PAGE_ROWS = 64, PAGE_BYTES = 4 * 1024 * 1024, MAX_RECORD_BYTES = 64 * 1024 * 1024;
function entity(value) {
  if (typeof value !== 'string' || !Object.hasOwn(schema,value)) throw Error('Unknown item type.');
}
function identity(value) { if (typeof value !== 'string') throw Error('Invalid record identity.'); }
function page(store, table, options = {}) {
  entity(table);
  const {cursor = null, mode = 'full'} = options;
  if (!['full','choices','cars'].includes(mode)) throw Error('Invalid compatibility projection.');
  if (mode==='cars' && table!=='slotcars')throw Error('Invalid car projection.');
  if (cursor && (cursor.entity !== table || cursor.mode !== mode || typeof cursor.revision !== 'string' || !Number.isSafeInteger(cursor.ordinal) || cursor.ordinal < 0)) throw Error('Invalid compatibility cursor.');
  return store.transaction(() => {
    const revision = Catalogue.revision(store);
    if (cursor && cursor.revision !== revision) throw stale();
    const rows = store.statement('SELECT id,ordinal FROM records WHERE entity=? AND ordinal>? ORDER BY ordinal LIMIT ?').all(table,cursor?.ordinal ?? -1,PAGE_ROWS + 1);
    const items = []; let bytes = 2, last = null;
    for (const row of rows.slice(0,PAGE_ROWS)) {
      if (mode === 'full') {
        // Refuse an oversized record before loading its media into the worker.
        const size = store.statement(`SELECT
          (SELECT length(CAST(shape AS BLOB)) FROM records WHERE entity=? AND id=?) +
          (SELECT coalesce(sum(length(CAST(json AS BLOB))),0) FROM fields WHERE entity=? AND id=?) +
          (SELECT coalesce(sum(coalesce(length(CAST(original AS BLOB)),length(bytes)*2+100)),0) FROM assets WHERE entity=? AND id=?) n`).get(table,row.id,table,row.id,table,row.id).n;
        if (size > MAX_RECORD_BYTES) throw Error('This item is too large for a compatibility list. Open it through a targeted view.');
      }
      const value = mode === 'cars' ? {id:row.id,...Object.fromEntries(['brand','manufacturer','model'].map(k=>[k,Catalogue.read(store,table,row.id,[k])])),paddock:Catalogue.read(store,table,row.id,['paddock','databaseId'])?{databaseId:Catalogue.read(store,table,row.id,['paddock','databaseId']),carId:Catalogue.read(store,table,row.id,['paddock','carId'])}:null} : mode === 'choices' ? {id:row.id,name:Catalogue.read(store,table,row.id,['name']) || 'Untitled'} : store.get(table,row.id,true).value;
      const size = Buffer.byteLength(JSON.stringify(value)) + 1;
      if (size > MAX_RECORD_BYTES) throw Error('This item is too large for a compatibility list. Open it through a targeted view.');
      if (items.length && bytes + size > PAGE_BYTES) break;
      items.push(value); bytes += size; last = row;
    }
    const more = rows.length > items.length;
    return {items,bytes,revision,next:more ? {entity:table,mode,ordinal:last.ordinal,revision} : null};
  });
}
function read(store, kind, table, value) {
  entity(table);
  if (kind === 'page') return page(store,table,value);
  if (kind === 'get') { identity(value); return store.get(table,value,true)?.value ?? null; }
  if (kind === 'custom') return Catalogue.read(store,'@meta','customFields',[table]) || [];
  if (kind === 'linked') {
    identity(value);
    const key = {tracks:'trackId',drivers:'driverId',slotcars:'carId'}[table];
    return key ? store.statement(`SELECT count(*) n FROM lap_index WHERE ${key}=?`).get(value).n : 0;
  }
  throw Error('Unsupported compatibility read.');
}
module.exports = {read,page,PAGE_ROWS,PAGE_BYTES,MAX_RECORD_BYTES};
