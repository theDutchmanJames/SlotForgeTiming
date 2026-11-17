'use strict';
// Read-only setup projections. Original order and the existing scoring/replay
// functions remain authoritative; no derived scores or recordings are persisted.
const C = require('./catalogue-read'),
  H = require('./history-read');
const KINDS = ['rival-sources', 'rival-laps', 'champ-progress', 'champ-sessions'];
const LAP = [
  'sessionId',
  'driverId',
  'virtualRival',
  'token',
  'heat',
  'lapNumber',
  'time',
  'pit',
  'invalid',
  'redFlag',
  'tooSlow',
  'noPersonalBest',
  'noTrackRecord',
  'lane'
];
const RIVAL = ['id', 'setupName', 'date', 'trackId', 'trackName'];
// JSON is already resident. Retain only eligible session IDs between metadata
// pages, tied to the same revision used to reject mixed snapshots.
const sourceIds = new WeakMap();
function jsonSources(db, revision) {
  let cached = sourceIds.get(db);
  if (!cached || cached.revision !== revision || cached.laps !== db.data.laps) {
    const ids = new Set();
    for (const l of db.data.laps) if (!l.virtualRival && !l.token) ids.add(l.sessionId);
    cached = { revision, laps: db.data.laps, ids };
    sourceIds.set(db, cached);
  }
  return cached.ids;
}
function options(kind, entity, value = {}) {
  if (!KINDS.includes(kind) || entity !== (kind === 'rival-laps' ? 'laps' : 'sessions') || !value || typeof value !== 'object')
    throw Error('Invalid setup history request.');
  const ids = key => {
    const rows = value[key] ?? [];
    if (!Array.isArray(rows) || rows.length > 4096 || rows.some(id => typeof id !== 'string' || !id || id.length > 500))
      throw Error('Invalid setup history selection.');
    return [...new Set(rows)].sort();
  };
  const champIds = ids('champIds'),
    sessionIds = ids('sessionIds'),
    id = value.id ?? '';
  if (typeof id !== 'string' || id.length > 500 || (kind === 'rival-laps' && !id)) throw Error('Invalid recording selection.');
  const key = JSON.stringify([kind, id, champIds, sessionIds]),
    cursor = value.cursor ?? null;
  if (cursor && (!Number.isSafeInteger(cursor.ordinal) || cursor.ordinal < 0 || cursor.key !== key || typeof cursor.revision !== 'string'))
    throw Error('Invalid setup history cursor.');
  return { kind, id, champIds, sessionIds, key, cursor, limit: kind === 'rival-laps' ? 500 : 100 };
}
function rivalSession(s) {
  if (!s) return null;
  const who = row => H.pick(row, ['driverId', 'driverName', 'carName']);
  return {
    ...H.pick(s, RIVAL),
    standings: (s.standings || []).map(who),
    heatResults: (s.heatResults || []).map(h => ({ heat: h.heat, rows: (h.rows || []).map(who) }))
  };
}
function result(o, revision, rows, extra = {}) {
  if (o.cursor && o.cursor.revision !== revision) throw C.stale();
  return {
    items: rows.slice(0, o.limit).map(r => r.value),
    revision,
    ...extra,
    next: rows.length > o.limit ? { key: o.key, revision, ordinal: rows[o.limit - 1].ordinal } : null
  };
}
function json(db, kind, entity, value) {
  const o = options(kind, entity, value),
    revision = C.jsonRevision(db);
  if (o.cursor && o.cursor.revision !== revision) throw C.stale();
  const after = o.cursor?.ordinal ?? -1,
    rows = [],
    data = db.data;
  if (kind === 'rival-laps') {
    const s = data.sessions.find(s => s.id === o.id);
    if (s)
      for (let i = after + 1; i < data.laps.length && rows.length <= o.limit; i++) {
        const l = data.laps[i];
        if (l.sessionId === o.id) rows.push({ ordinal: i, value: H.pick(l, LAP) });
      }
    return result(
      o,
      revision,
      rows,
      o.cursor
        ? {}
        : {
            session: rivalSession(s),
            track: H.pick(
              data.tracks.find(t => t.id === s?.trackId),
              H.TRACK
            )
          }
    );
  }
  const ids = new Set(o.champIds);
  for (const s of data.sessions) if (o.sessionIds.includes(s.id) && typeof s.champ?.id === 'string') ids.add(s.champ.id);
  const sources = kind === 'rival-sources' ? jsonSources(db, revision) : null;
  for (let i = after + 1; i < data.sessions.length && rows.length <= o.limit; i++) {
    const s = data.sessions[i];
    if (sources ? !sources.has(s.id) : !ids.has(s.champ?.id)) continue;
    rows.push({
      ordinal: i,
      value:
        kind === 'rival-sources' ? H.pick(s, RIVAL) : kind === 'champ-progress' ? H.pick(s, ['id', 'date', 'champ']) : H.sessionValue(s)
    });
  }
  return result(o, revision, rows);
}
function sqlite(store, kind, entity, value) {
  const o = options(kind, entity, value),
    S = require('./sqlite-history'),
    R = require('./sqlite-catalogue');
  return store.transaction(() => {
    const revision = R.revision(store);
    if (o.cursor && o.cursor.revision !== revision) throw C.stale();
    const after = o.cursor?.ordinal ?? -1;
    let rows,
      extra = {};
    if (kind === 'rival-laps') {
      const s = o.cursor ? { id: o.id } : S.selected(store, 'sessions', o.id, [...RIVAL, 'standings', 'heatResults']);
      // Keep the indexed session selection as the outer loop. Otherwise SQLite can
      // choose ordinal order first and scan unrelated laps to fill a final page.
      rows = s
        ? store
            .statement(
              "SELECT r.ordinal,f.json FROM lap_index l INDEXED BY lap_session CROSS JOIN records r ON r.entity='laps' AND r.id=l.id CROSS JOIN fields f ON f.entity='laps' AND f.id=l.id AND f.path='[]' WHERE l.sessionId=? AND r.ordinal>? ORDER BY r.ordinal LIMIT ?"
            )
            .all(o.id, after, o.limit + 1)
            .map(r => ({ ordinal: r.ordinal, value: H.pick(JSON.parse(r.json), LAP) }))
        : [];
      if (!o.cursor) extra = { session: rivalSession(s), track: S.selected(store, 'tracks', s?.trackId, H.TRACK) || {} };
    } else {
      const ids = new Set(o.champIds);
      for (const id of o.sessionIds) {
        const champ = R.read(store, 'sessions', id, ['champ', 'id']);
        if (typeof champ === 'string') ids.add(champ);
      }
      if (kind === 'rival-sources') {
        // EXISTS stops at the first physical, non-token lap. The lap_session index
        // avoids reconstructing the full lap history just to offer recordings.
        rows = store
          .statement(
            `SELECT h.id,h.ordinal FROM history_sessions h WHERE h.ordinal>? AND EXISTS(SELECT 1 FROM lap_index l JOIN fields f ON f.entity='laps' AND f.id=l.id AND f.path='[]' WHERE l.sessionId=h.id AND COALESCE(json_extract(f.json,'$.virtualRival'),0) IN (0,'') AND COALESCE(json_extract(f.json,'$.token'),0) IN (0,'')) ORDER BY h.ordinal LIMIT ?`
          )
          .all(after, o.limit + 1);
      } else
        rows = store
          .statement(
            "SELECT id,ordinal FROM history_sessions WHERE json_extract(summary,'$.champ.id') IN (SELECT value FROM json_each(?)) AND ordinal>? ORDER BY ordinal LIMIT ?"
          )
          .all(JSON.stringify([...ids]), after, o.limit + 1);
      rows = rows.map(r => ({
        ordinal: r.ordinal,
        value:
          kind === 'champ-sessions'
            ? S.sessionValue(store, r.id)
            : S.selected(store, 'sessions', r.id, kind === 'rival-sources' ? RIVAL : ['id', 'date', 'champ'])
      }));
    }
    return result(o, revision, rows, extra);
  });
}
module.exports = { KINDS, LAP, RIVAL, options, rivalSession, json, sqlite };
