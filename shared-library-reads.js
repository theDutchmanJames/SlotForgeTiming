'use strict';
const H = require('./history-read'),
  D = require('./dashboard-read'),
  Home = require('./renderer/homestats'),
  E = require('./renderer/engine'),
  C = require('./catalogue-read');
const scoped = (source, id, own) => (source === own ? id : 'shared:' + JSON.stringify([source, id]));
const tokenString = v => JSON.stringify(v);
function decode(v) {
  try {
    const r = JSON.parse(v);
    if (!r || typeof r.private !== 'string' || !r.shared) throw Error();
    return r;
  } catch {
    throw Error('Invalid shared history page.');
  }
}
async function read(client, options) {
  try {
    const before = await client.status(),
      result = await client.handle.timingRead(options);
    if (result.databaseId !== before.databaseId || result.recoveryId !== before.recoveryId) throw C.stale();
    return result;
  } catch (e) {
    if (['QUERY_CHANGED', 'SNAPSHOT_CHANGED'].includes(e.code)) throw C.stale();
    throw e;
  }
}
function mappedRecord(r, client) {
  return {
    id:
      r.sourceId === client.installationId && r.originLapId
        ? r.originLapId
        : 'shared:' + JSON.stringify([r.sourceId, r.sessionId, r.lapId]),
    readOnly: r.sourceId !== client.installationId || !r.originLapId,
    sessionId: scoped(r.sourceId, r.sessionId, client.installationId),
    trackId: scoped(r.sourceId, r.trackId, client.installationId),
    driverId: scoped(r.sourceId, r.driverId, client.installationId),
    carId: client.localId(r.carId),
    lane: r.lane,
    lapNumber: r.lapNumber,
    time: r.durationMs,
    date: r.startedAt || r.savedAt || '',
    dateBasis: r.startedAt ? 'started' : r.savedAt ? 'saved' : null,
    noPersonalBest: false,
    noTrackRecord: false
  };
}
// ---- records of races that did not reach the shared library (2.3.0) ----
// The records the library shows only hold the races it accepted. A race of this computer that is still on its way, held for attention or refused keeps
// its laps here; its track record and personal bests count too, marked pendingLibrary, until the library has the race. Only this computer's own sessions
// that the library does not have (or has an older copy of: a correction still waiting) count, so a lap is never counted twice.
async function undeliveredRecords(base, client, pool, token, only = {}) {
  // (performance: the races still on their way, held or refused are the ones in the delivery list of this computer with that state; one read of that list
  // instead of a question to the library for every race that holds a record, which took seconds with a few hundred races)
  let waiting = null;
  try {
    const sum = client.storage && typeof client.storage.summary === 'function' ? await client.storage.summary() : null;
    if (sum && Array.isArray(sum.deliveries))
      waiting = new Set(
        sum.deliveries
          .filter(d => d && (!d.transport || d.transport === 'engine') && ['pending', 'attention'].includes(d.status))
          .map(d => d.sessionId)
      );
  } catch {
    waiting = null; // (then each race is asked about, as before)
  }
  // (and nothing is waiting, as after almost every race: the local records are not even read)
  if (waiting && !waiting.size) return { tracks: [], personal: [], refs: { tracks: [], drivers: [], slotcars: [], sessions: [] } };
  const first = await base.historyPage(pool),
    out = { tracks: [], personal: [], refs: first.refs };
  for (const section of ['tracks', 'personal']) {
    const items = [...first[section].items];
    let next = first[section].next,
      pages = 0;
    while (next && pages++ < 25) {
      const p = await base.historyPage(pool, { [section]: next });
      items.push(...p[section].items);
      for (const k of Object.keys(out.refs)) out.refs[k].push(...(p.refs[k] || []));
      next = p[section].next;
    }
    out[section] = items.filter(
      r => (!only.trackId || r.trackId === only.trackId) && (!only.driverIds || only.driverIds.includes(r.driverId))
    );
  }
  const known = new Map();
  const undelivered = async sessionId => {
    if (!sessionId) return false;
    if (waiting) return waiting.has(sessionId);
    if (!known.has(sessionId))
      known.set(
        sessionId,
        (async () => {
          const st = await read(client, { kind: 'sessionState', sourceId: client.installationId, sessionId, token });
          if (!st.row) return true; // (never reached the library)
          if (st.row.state !== 'active') return false; // (withdrawn: it does not count anywhere)
          const saved = await Promise.resolve()
            .then(() => base.historySession(pool, sessionId, { revision: first.revision, summaryOnly: true }))
            .catch(() => null);
          return ['pending', 'attention'].includes(saved?.deliveryStatus);
        })()
      );
    return known.get(sessionId);
  };
  for (const section of ['tracks', 'personal']) {
    const kept = [];
    for (const r of out[section]) if (await undelivered(r.sessionId)) kept.push({ ...r, pendingLibrary: true });
    out[section] = kept;
  }
  return out;
}
const recordKey = (section, r) => (section === 'tracks' ? r.trackId : r.trackId + '\n' + r.driverId);
// a page of library records with the faster local ones in place (a key that is not on this page is added on the last page only)
function mergeRecords(section, items, local, lastPage) {
  const out = items.slice();
  for (const l of local) {
    const i = out.findIndex(r => recordKey(section, r) === recordKey(section, l));
    if (i >= 0) {
      if (Number(l.time) < Number(out[i].time)) out[i] = l;
    } else if (lastPage) out.push(l);
  }
  return out;
}
async function historyPage(base, client, pool, options = {}) {
  const o = H.options(pool, options),
    active = Object.values(o).filter(Boolean),
    expected = active.length ? decode(active[0].revision) : null;
  if (active.some(c => c.revision !== active[0].revision)) throw C.stale();
  const local = await base.historyPage(pool);
  if (expected && local.revision !== expected.private) throw C.stale();
  let token = expected?.shared;
  const sections = {},
    refs = local.refs;
  if (!token) token = (await read(client, { kind: 'resultSessions', limit: 1 })).token;
  let pendingOnce = null;
  for (const section of ['tracks', 'personal']) {
    if (pool === 'tokens') continue;
    const page = await read(client, {
      kind: 'records',
      grouping: 'timing',
      scope: section === 'tracks' ? 'track' : 'personal',
      offset: o[section]?.offset || 0,
      limit: 40,
      token
    });
    token = page.token;
    sections[section] = { items: page.rows.map(r => mappedRecord(r, client)), nextOffset: page.nextOffset };
    if (!(o[section]?.offset > 0)) {
      // (the first page: the records of races that did not reach the library yet)
      const first = !pendingOnce;
      const pending = (pendingOnce ||= await undeliveredRecords(base, client, pool, token)); // (once for both sections)
      sections[section].items = mergeRecords(section, sections[section].items, pending[section], page.nextOffset === null);
      if (first) for (const k of Object.keys(refs)) refs[k].push(...(pending.refs[k] || []));
    }
    for (const r of page.rows) {
      const m = mappedRecord(r, client),
        [track, car] = await base.historyReferences([
          { entity: 'tracks', id: r.sourceId === client.installationId ? r.trackId : '' },
          { entity: 'slotcars', id: m.carId }
        ]);
      refs.tracks.push({ ...H.pick(track, H.TRACK), id: m.trackId, name: r.trackName });
      refs.drivers.push({ id: m.driverId, name: r.driverName || 'Unknown driver' });
      refs.slotcars.push({ ...H.pick(car, ['scale']), id: m.carId, name: r.carName, model: r.carName });
      refs.sessions.push({ id: m.sessionId, setupName: r.sessionName });
    }
  }
  if (pool === 'tokens') {
    const p = await base.historyPage(
      pool,
      Object.fromEntries(['tracks', 'personal'].map(k => [k, o[k] ? { ...o[k], revision: local.revision } : null]))
    );
    sections.tracks = p.tracks;
    sections.personal = p.personal;
    Object.keys(refs).forEach(k => refs[k].push(...(p.refs[k] || [])));
  }
  const sessions = await require('./shared-library-results').sessions(base, client, pool, o.sessions, local.revision, token, read);
  const revision = tokenString({ private: local.revision, shared: token });
  for (const section of ['tracks', 'personal']) {
    const p = sections[section];
    if (pool === 'tokens') {
      if (p.next) p.next = { ...p.next, revision };
    } else {
      p.next = p.nextOffset === null ? null : { pool, section, revision, offset: p.nextOffset };
      delete p.nextOffset;
    }
  }
  if (sessions.next) sessions.next = { ...sessions.next, pool, section: 'sessions', revision };
  return { ...local, ...sections, sessions, revision, refs };
}
async function historySession(base, client, pool, id, options = {}) {
  const revision = options.revision || (await historyPage(base, client, pool)).revision,
    r = decode(revision);
  return require('./shared-library-results').detail(base, client, pool, id, options, r, read);
}
async function carStatistics(client, id, car) {
  const carId = car.sharedLibrary?.carId || client.canonicalId(id),
    page = await read(client, { kind: 'carStatistics', carId, limit: 100 }),
    s = page.summary;
  const since =
    car.serviceDate && Number.isFinite(Date.parse(car.serviceDate))
      ? (await read(client, { kind: 'carStatistics', carId, from: new Date(car.serviceDate).toISOString(), limit: 1, token: page.token }))
          .summary
      : s;
  const distance = x => (x.distanceComplete ? x.distanceM : null);
  const tracks = page.tracks.rows.map(r => ({
    trackId: scoped(r.sourceId, r.trackId, client.installationId),
    name: r.trackName,
    laps: r.validLaps,
    best: r.bestPersonalLapMs ?? r.bestTrackLapMs,
    avg: r.averageLapMs
  }));
  const fast = tracks.filter(r => r.best !== null).sort((a, b) => a.best - b.best)[0];
  return {
    mileage: { laps: s.recordedLaps, distance: distance(s) },
    mileageSince: { laps: since.recordedLaps, distance: distance(since) },
    lastDriven: s.lastDrivenAt || '',
    sessions: s.acceptedSessions,
    wins: s.overallWins,
    deslots: null,
    fastest: fast ? { time: fast.best, trackId: fast.trackId, trackName: fast.name } : null,
    tracks,
    tracksTotal: page.tracks.total,
    shared: true
  };
}
async function homeStatistics(base, client, options) {
  const o = D.options(options),
    now = new Date(o.now),
    week = Home.weekStart(now).toISOString(),
    own = client.installationId;
  const global = await read(client, { kind: 'home', weekStart: week }),
    token = global.token,
    drivers = await base.list('drivers'),
    driverName = id => drivers.find(d => d.id === id)?.name || 'Unknown driver',
    cards = {};
  const needYear = o.boards.some(b => b.period === 'year' && ['top', 'mileage'].includes(b.key)),
    year = needYear ? await read(client, { kind: 'home', from: Home.yearStart(now).toISOString(), weekStart: week, token }) : global;
  const recordRows = o.trackId
    ? (await read(client, { kind: 'records', scope: 'track', sort: 'time', sourceId: own, trackId: o.trackId, limit: 100, token })).rows
    : [];
  let best = recordRows.sort((a, b) => a.durationMs - b.durationMs)[0];
  // (2.3.0: a race that did not reach the library still holds its records here)
  const pending = o.trackId
    ? await undeliveredRecords(base, client, 'racing', token, { trackId: o.trackId }).catch(() => ({
        tracks: [],
        personal: [],
        refs: { slotcars: [], sessions: [] }
      }))
    : { tracks: [], personal: [], refs: { slotcars: [], sessions: [] } };
  const localTrack = pending.tracks[0];
  if (localTrack && (!best || Number(localTrack.time) < best.durationMs)) {
    const car = (pending.refs.slotcars || []).find(c => c.id === localTrack.carId),
      session = (pending.refs.sessions || []).find(x => x.id === localTrack.sessionId);
    best = {
      durationMs: Number(localTrack.time),
      driverId: localTrack.driverId,
      driverName: '',
      carName: car ? car.name || [car.brand, car.manufacturer, car.model].filter(Boolean).join(' ') : '',
      startedAt: localTrack.date || '',
      savedAt: '',
      sessionName: session?.setupName || '',
      pendingLibrary: true
    };
  }
  const grid = [];
  for (const g of o.grid) {
    if (grid.some(r => r.driverId === g.driverId) || !g.driverId) continue;
    const p = o.trackId
      ? await read(client, {
          kind: 'records',
          scope: 'personal',
          sort: 'time',
          sourceId: own,
          trackId: o.trackId,
          driverId: g.driverId,
          limit: 100,
          token
        })
      : { rows: [] };
    let r = p.rows.sort((a, b) => a.durationMs - b.durationMs)[0];
    const mine = pending.personal.find(x => x.driverId === g.driverId);
    if (mine && (!r || Number(mine.time) < r.durationMs)) r = { durationMs: Number(mine.time) };
    grid.push({
      driverId: g.driverId,
      name: driverName(g.driverId),
      color: g.color,
      time: r?.durationMs ?? null,
      text: r ? E.fmtTime(r.durationMs) : '–'
    });
  }
  for (const b of o.boards) {
    const view = b.period === 'year' ? year : global;
    if (b.key === 'glance')
      cards[b.key] = {
        glance: {
          races: global.summary.acceptedSessions,
          laps: global.summary.recordedLaps,
          distance: global.summary.distanceComplete ? global.summary.distanceM : null,
          wins: global.topWinners?.length
            ? { name: global.topWinners[0].teamName || global.topWinners[0].driverName, count: global.topWinners[0].wins }
            : null
        }
      };
    if (b.key === 'bests') cards[b.key] = { bests: grid };
    if (b.key === 'record') {
      const nearest = grid.filter(x => x.time !== null).sort((a, b) => a.time - b.time)[0];
      cards[b.key] = {
        rec: !o.trackId
          ? null
          : {
              record: best
                ? {
                    time: best.durationMs,
                    text: E.fmtTime(best.durationMs),
                    driver: best.driverName || driverName(best.driverId),
                    car: best.carName,
                    date: best.startedAt || best.savedAt || '',
                    dateBasis: best.startedAt ? 'started' : best.savedAt ? 'saved' : null,
                    setupName: best.sessionName || '',
                    ...(best.pendingLibrary ? { pendingLibrary: true } : {})
                  }
                : null,
              line:
                best && nearest
                  ? nearest.time <= best.durationMs
                    ? nearest.name + ' is on the grid and holds the record.'
                    : `Closest on the grid: ${nearest.name}, ${E.fmtTime(nearest.time)} (+${E.fmtTime(nearest.time - best.durationMs)}).`
                  : ''
            }
      };
    }
    if (b.key === 'mileage')
      cards[b.key] = {
        mileage: view.topDistanceCars.slice(0, b.count).map(c => ({
          carId: client.localId(c.carId),
          name: c.carName,
          picture: '',
          laps: c.recordedLaps,
          distance: c.unknownDistanceLaps ? null : c.distanceM
        }))
      };
    if (b.key === 'top')
      cards[b.key] = {
        topPeriod: b.period,
        top: (view.topWinners || [])
          .slice(0, b.count)
          .map(w => ({ name: w.teamName || w.driverName, count: w.wins, date: w.lastWinAt || '' }))
      };
    if (b.key === 'recent')
      cards[b.key] = {
        recent: global.recentSessions.slice(0, b.count).map(s => ({
          id: scoped(s.sourceId, s.sessionId, own),
          date: s.startedAt || s.savedAt || '',
          dateBasis: s.startedAt ? 'started' : s.savedAt ? 'saved' : null,
          name: s.name,
          kind: s.sessionType || 'Race',
          result: s.winnerName ? s.winnerName + ' won' : ''
        }))
      };
    if (b.key === 'records') {
      const p = await read(client, { kind: 'records', scope: 'track', limit: Math.min(100, b.count * 4), token });
      cards[b.key] = {
        records: p.rows.slice(0, b.count).map(r => ({
          trackId: scoped(r.sourceId, r.trackId, own),
          trackName: r.trackName,
          time: r.durationMs,
          text: E.fmtTime(r.durationMs),
          driver: r.driverName,
          car: r.carName,
          date: r.startedAt || r.savedAt || '',
          dateBasis: r.startedAt ? 'started' : r.savedAt ? 'saved' : null
        }))
      };
    }
    if (b.key === 'fastest') {
      const p = await read(client, {
        kind: 'records',
        scope: 'personal',
        sort: 'time',
        from: week,
        ...(b.scope !== 'all' && o.trackId ? { sourceId: own, trackId: o.trackId } : {}),
        limit: 100,
        token
      });
      const tracks = new Map();
      for (const r of p.rows) {
        const id = scoped(r.sourceId, r.trackId, own);
        if (!tracks.has(id)) tracks.set(id, { trackId: id, trackName: r.trackName, rows: [] });
        const rows = tracks.get(id).rows,
          driverId = scoped(r.sourceId, r.driverId, own),
          old = rows.find(x => x.driverId === driverId);
        if (!old || r.durationMs < old.time) {
          if (old) rows.splice(rows.indexOf(old), 1);
          rows.push({ driverId, driver: r.driverName, time: r.durationMs, text: E.fmtTime(r.durationMs) });
        }
      }
      cards[b.key] = {
        fastestScope: b.scope,
        fastest: {
          since: week,
          tracks: [...tracks.values()].map(t => ({ ...t, rows: t.rows.sort((a, b) => a.time - b.time).slice(0, b.count) }))
        }
      };
    }
  }
  const s = global.recentSessions[0],
    last = s
      ? {
          label: 'Last session',
          date: s.startedAt || s.savedAt || '',
          dateBasis: s.startedAt ? 'started' : s.savedAt ? 'saved' : null,
          setupName: s.name,
          trackName: s.trackName,
          podium: [],
          fastest: null
        }
      : null;
  if (last) {
    const head = await client.handle.historyRead({ kind: 'detail', sourceId: s.sourceId, sessionId: s.sessionId }),
      body = head.body;
    if (body?.race) {
      const entries = new Map(body.race.participants.map(p => [p.id, p]));
      last.podium = (body.context?.classification || [])
        .filter(a => a.scope === 'overall' && a.position !== null && a.status !== 'disqualified')
        .sort((a, b) => a.position - b.position)
        .slice(0, 3)
        .map(a => ({
          pos: a.position,
          name: entries.get(a.participantId)?.displayName || entries.get(a.participantId)?.carName || 'Unknown driver',
          detail: a.laps === null ? '' : a.laps + ' laps'
        }));
    }
    last.emptyReason = 'No verified classification was supplied for this session.';
    await read(client, { kind: 'home', limit: 1, token });
  }
  return { last, cards };
}
module.exports = {
  read,
  scoped,
  mappedRecord,
  mergeRecords,
  undeliveredRecords,
  historyPage,
  historySession,
  carStatistics,
  homeStatistics
};
