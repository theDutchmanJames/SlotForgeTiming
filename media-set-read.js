'use strict';
// Overview-only data: truthy picture slots and call switches preserve the existing
// renderer's counts without transferring pictures, recordings or call sentences.
function check(entity) {
  if (!['imagesets', 'audiosets'].includes(entity)) throw Error('Unsupported media set collection.');
}
function summary(entity, row) {
  check(entity);
  if (entity === 'imagesets')
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      steps: row.steps,
      images: Object.fromEntries(Object.entries(row.images || {}).map(([key, value]) => [key, !!value]))
    };
  return {
    id: row.id,
    name: row.name,
    voice: row.voice,
    calls: Object.fromEntries(Object.entries(row.calls || {}).map(([key, value]) => [key, value ? { on: value.on !== false } : null]))
  };
}
function sqliteSummary(store, entity, id) {
  check(entity);
  const C = require('./sqlite-catalogue'),
    read = parts => C.read(store, entity, id, parts);
  const row = { id, name: read(['name']) };
  // Shape includes keys and structure, never media bytes or sentence values.
  const shape = JSON.parse(store.statement('SELECT shape FROM records WHERE entity=? AND id=?').get(entity, id).shape);
  const branch = key => shape[1].find(([name]) => name === key)?.[1];
  const entries = key => {
    const node = branch(key);
    return node?.[0] === 'object'
      ? node[1].map(([name, next]) => [name, next[0] === 'object' ? {} : read([key, name])])
      : Object.entries(read([key]) || {});
  };
  if (entity === 'imagesets') {
    row.kind = read(['kind']);
    row.steps = read(['steps']);
    row.images = Object.fromEntries(entries('images').map(([key, value]) => [key, !!value]));
    // Extracted media is null in metadata. Only its path is needed for counting.
    for (const asset of store.statement('SELECT path FROM assets WHERE entity=? AND id=?').all(entity, id)) {
      const parts = JSON.parse(asset.path);
      if (parts[0] === 'images' && parts.length === 2)
        Object.defineProperty(row.images, parts[1], { value: true, enumerable: true, configurable: true });
    }
  } else {
    row.voice = read(['voice']);
    const calls = branch('calls');
    const switchPaths =
      calls?.[0] === 'object'
        ? calls[1].flatMap(([, node]) => {
            const flag = node[0] === 'object' ? node[1].find(([key]) => key === 'on')?.[1] : null;
            return flag?.[0] === 'field' ? [flag[1]] : [];
          })
        : [];
    const switches = new Map(
      store
        .statement('SELECT path,json FROM fields WHERE entity=? AND id=? AND path IN (SELECT value FROM json_each(?))')
        .all(entity, id, JSON.stringify(switchPaths))
        .map(field => [JSON.parse(field.path)[1], JSON.parse(field.json)])
    );
    row.calls =
      branch('calls')?.[0] === 'object'
        ? Object.fromEntries(entries('calls').map(([key, value]) => [key, value ? { on: switches.get(key) !== false } : null]))
        : read(['calls']);
  }
  return summary(entity, row);
}
module.exports = { check, summary, sqliteSummary };
