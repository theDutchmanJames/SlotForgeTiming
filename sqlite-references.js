'use strict';
const R = require('./reference-read'),
  C = require('./sqlite-catalogue'),
  Order = require('./catalogue-read');
function page(s, entity, value) {
  const o = R.options(entity, value);
  return s.transaction(() => {
    const revision = C.revision(s);
    // (2.4.0 review) only a change of this collection makes a cursor stale, not a recovery point or a delivery attempt
    if (o.cursor && !C.unchangedSince(s, [entity], o.cursor.revision)) throw Order.stale();
    const rows = s
      .statement('SELECT id,ordinal FROM records WHERE entity=? AND ordinal>? ORDER BY ordinal LIMIT ?')
      .all(entity, o.cursor?.ordinal ?? -1, o.limit + 1);
    const items = rows.slice(0, o.limit).map(({ id }) => project(s, entity, id));
    return { items, revision, next: rows.length > o.limit ? R.cursor(entity, revision, rows[o.limit - 1].ordinal) : null };
  });
}
function details(s, entity, ids, revision) {
  R.selection(entity, ids, revision);
  return s.transaction(() => {
    if (!C.unchangedSince(s, [entity], revision)) throw Order.stale(); // (2.4.0 review)
    return ids.map(id => s.get(entity, id, true)?.value ?? null);
  });
}
function project(s, entity, id) {
  return R.project(entity, id, parts => {
    if (entity === 'slotcars' && parts.length === 1 && parts[0] === 'paddock')
      return s.statement("SELECT local FROM catalogue_index WHERE entity='slotcars' AND id=?").get(id)?.local === 0 ? true : undefined;
    return C.read(s, entity, id, parts);
  });
}
module.exports = { page, details, project };
