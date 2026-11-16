'use strict';
// Deliberately separate from SqliteRepository's revision-bearing command contract.
// This matches the old renderer-facing read shapes, including embedded media.
const MAX_ROWS = 100000, MAX_BYTES = 256 * 1024 * 1024;
class SqliteCompatibilityReads {
  constructor(client) { this.client = client; }
  // (audit 2.2.5) a collection that changed between two pages is read again from the start, a few times
  async collect(entity, mode) {
    for (let attempt = 1; ; attempt++) {
      try { return await this.collectOnce(entity, mode); }
      catch (error) { if (error?.code !== 'CATALOGUE_CHANGED' || attempt >= 4) throw error; }
    }
  }
  async collectOnce(entity, mode) {
    const items = []; let cursor = null, bytes = 0;
    do {
      const page = await this.client.compatibilityRead('page',entity,{mode,cursor});
      bytes += page.bytes;
      if (bytes > MAX_BYTES || items.length + page.items.length > MAX_ROWS) throw Error('This collection is too large for a compatibility list. Use a paged or targeted view.');
      items.push(...page.items); cursor = page.next;
    } while (cursor);
    return items;
  }
  list(entity) { return this.collect(entity,'full'); }
  choices(entity) { return this.collect(entity,'choices'); }
  transferChoices(entity) { return this.collect(entity,'transfer'); }
  get(entity,id) { return this.client.compatibilityRead('get',entity,id); }
  customFields(entity) { return this.client.compatibilityRead('custom',entity); }
  linkedLaps(entity,id) { return this.client.compatibilityRead('linked',entity,id); }
}
module.exports = {SqliteCompatibilityReads,MAX_ROWS,MAX_BYTES};
