'use strict';
const Home = require('./renderer/homestats'),
  Stats = require('./renderer/stats'),
  H = require('./history-read');
const CARDS = [
  'record',
  'glance',
  'recent',
  'fastest',
  'records',
  'top',
  'mileage',
  'bests',
  'lanes',
  'form',
  'h2h',
  'milestones',
  'heats'
]; // (2.4.0: Lane balance, Grid form, Head to head, Milestones, Heat standings)
const SESSION = ['id', 'date', 'setupName', 'trackName', 'trackId', 'sessionType', 'resultBy', 'champ', 'standings'];
const STANDING = [
  'pos',
  'driverId',
  'driverName',
  'teamId',
  'teamName',
  'asTeam',
  'carId',
  'carName',
  'laps',
  'best',
  'points',
  'dq',
  'retired'
];
const pick = H.pick;
function session(row) {
  return {
    ...pick(
      row,
      SESSION.filter(k => k !== 'standings')
    ),
    standings: (Array.isArray(row.standings) ? row.standings : []).map(x => pick(x, STANDING))
  };
}
function options(o = {}) {
  if (
    !o ||
    typeof o !== 'object' ||
    typeof o.trackId !== 'string' ||
    !Array.isArray(o.boards) ||
    o.boards.length > 32 ||
    !Array.isArray(o.grid) ||
    o.grid.length > 512 ||
    !Array.isArray(o.driverIds) ||
    o.driverIds.length > 512 ||
    o.driverIds.some(x => typeof x !== 'string') ||
    o.grid.some(x => !x || typeof x.driverId !== 'string' || typeof x.color !== 'string') ||
    !Number.isFinite(Date.parse(o.now))
  )
    throw Error('Invalid Home statistics request.');
  if (
    o.boards.some(
      b =>
        !b ||
        !CARDS.includes(b.key) ||
        !Number.isInteger(b.count) ||
        b.count < 1 ||
        b.count > 20 ||
        !['all', 'year'].includes(b.period) ||
        !['track', 'all'].includes(b.scope)
    )
  )
    throw Error('Invalid Home card request.');
  return o;
}
// Single history pass. Retained laps are only record/weekly candidates; totals
// retain counters per car/track, never an array containing the entire lap history.
function home(source, value) {
  const o = options(value),
    sessions = [...source.sessions()].map(session),
    now = new Date(o.now),
    last = Home.lastSession(sessions),
    dates = new Map(sessions.map(s => [s.id, s.date]));
  const drivers = new Map(
      source
        .meta('drivers')
        .filter(x => x.driverType !== 'virtual')
        .map(x => [x.id, x.name || '(unnamed)'])
    ),
    cars = new Map(
      source
        .meta('slotcars')
        .map(x => [x.id, x.paddock?.name || [x.brand, x.manufacturer, x.model].filter(Boolean).join(' ') || '(unnamed)'])
    ),
    tracks = new Map(source.meta('tracks').map(x => [x.id, x]));
  const ctx = {
    sessions,
    trackId: o.trackId,
    driverIds: o.driverIds,
    grid: o.grid,
    now,
    driverName: id => drivers.get(id) || '',
    carName: id => cars.get(id) || '',
    trackName: id => (tracks.has(id) ? tracks.get(id).name || '(unnamed)' : '(deleted)')
  };
  const { rec, personal, weekly, mile, distances, trackOrder, lastLap, valid, compact, lanes } = source.homeSummary
    ? source.homeSummary(o, { last, dates, tracks, cars, now })
    : summarize(source, o, { last, dates, tracks, cars, now });
  const result = { last: Home.lastRace({ ...ctx, laps: lastLap ? [lastLap] : [] }), cards: {} };
  for (const b of o.boards) {
    let data = {};
    const c = { ...ctx, count: b.count, scope: b.scope };
    if (b.key === 'record' || b.key === 'bests') data.rec = o.trackId ? Home.recordCard({ ...c, laps: compact }) : null; // (2.4.0: Personal Bests shows the track record too)
    if (b.key === 'recent') data.recent = Home.recent(c);
    if (b.key === 'records')
      data.records = Home.allRecords({
        ...c,
        laps: [...rec.values()].sort((a, b) => trackOrder.get(a.trackId) - trackOrder.get(b.trackId))
      });
    if (b.key === 'bests') data.bests = Home.gridBests({ ...c, laps: [...personal.values()] });
    if (b.key === 'fastest') {
      data.fastestScope = b.scope;
      data.fastest = Home.fastestWeek({ ...c, laps: [...weekly.values()] });
    }
    if (b.key === 'top') {
      data.topPeriod = b.period;
      data.top = Home.winners({ ...c, since: b.period === 'year' ? Home.yearStart(now) : null }).slice(0, b.count);
    }
    if (b.key === 'glance') {
      const top = Home.winners(c)[0];
      data.glance = {
        races: sessions.filter(s => s.sessionType !== 'tokens' && Stats.WINNER_TYPES.includes(s.sessionType)).length,
        laps: valid,
        distance: distances.size ? [...trackOrder.keys()].reduce((sum, id) => sum + (distances.get(id) || 0), 0) : null,
        wins: top ? { name: top.name, count: top.count } : null
      };
      data.glanceWeeks = Home.racesPerWeek(sessions, now, 12); // (2.4.0: the bars of races a week)
    }
    // (2.4.0) the new cards: from the laps of the lanes, or from the standings of the sessions
    if (b.key === 'lanes') data.lanes = o.trackId ? Home.laneRows(lanes || []) : [];
    if (b.key === 'form') data.form = Home.gridForm({ ...c, driverIds: o.driverIds, count: 10 }); // (the card has no count of its own: ten races, as on this computer; it shows five when the grid is big)
    if (b.key === 'h2h') data.h2h = Home.headToHead({ ...c, driverIds: o.driverIds });
    if (b.key === 'milestones') data.milestones = Home.milestones({ ...c, driverIds: o.driverIds, cars: [] });
    if (b.key === 'heats') data.heats = Home.heatStandings(c);
    if (b.key === 'mileage')
      data.mileage = [...mile[b.period].values()]
        .map(({ dist, ...m }) => ({ ...m, distance: dist.size ? [...dist.values()].reduce((a, b) => a + b, 0) : null }))
        .sort((a, b) => b.laps - a.laps || (b.distance || 0) - (a.distance || 0) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, b.count);
    result.cards[b.key] = data;
  }
  return result;
}
function summarize(source, o, { last, dates, tracks, cars, now }) {
  const needed = new Set(o.boards.map(x => x.key)),
    rec = new Map(),
    personal = new Map(),
    weekly = new Map(),
    mile = { all: new Map(), year: new Map() },
    distances = new Map(),
    trackOrder = new Map();
  let lastLap = null,
    valid = 0;
  const laneBest = new Map();
  const week = Home.weekStart(now).getTime(),
    year = Home.yearStart(now).getTime();
  const order = new WeakMap();
  let ordinal = 0;
  const best = (map, key, l) => {
    if (!map.has(key) || Number(l.time) < Number(map.get(key).time)) {
      map.set(key, l);
      order.set(l, ordinal);
    }
  };
  for (const l of source.laps()) {
    ordinal++;
    if (!l.token && !trackOrder.has(l.trackId)) trackOrder.set(l.trackId, trackOrder.size);
    if (l.token || !Number.isFinite(Number(l.time)) || !(Number(l.time) > 0)) continue;
    if (!l.noTrackRecord && (needed.has('records') || (needed.has('record') && l.trackId === o.trackId))) best(rec, l.trackId, l);
    if (!l.noPersonalBest && l.trackId === o.trackId && (needed.has('record') || needed.has('bests'))) best(personal, l.driverId, l);
    if (l.invalid || l.tooSlow || l.late) continue;
    if (needed.has('lanes') && l.trackId === o.trackId && Math.round(Number(l.lane)) >= 1) {
      const k = Math.round(Number(l.lane)),
        b = laneBest.get(k) || { lane: k, time: Infinity, laps: 0 };
      b.laps++;
      if (Number(l.time) < b.time) b.time = Number(l.time);
      laneBest.set(k, b);
    }
    if (last && l.sessionId === last.id && (!lastLap || Number(l.time) < Number(lastLap.time))) lastLap = l;
    if (needed.has('fastest') && l.trackId && l.driverId && Date.parse(l.date || dates.get(l.sessionId)) >= week)
      best(weekly, JSON.stringify([l.trackId, l.driverId]), l);
    if (needed.has('glance') || needed.has('mileage')) {
      const len = Stats.lapLength(tracks.get(l.trackId) || {}, l);
      valid++;
      if (needed.has('glance') && len > 0) distances.set(l.trackId, (distances.get(l.trackId) || 0) + len);
      if (needed.has('mileage') && l.carId && cars.has(l.carId))
        for (const period of ['all', 'year']) {
          if (period === 'year' && !(Date.parse(l.date) >= year)) continue;
          let m = mile[period].get(l.carId);
          if (!m) {
            m = { carId: l.carId, name: cars.get(l.carId), picture: '', laps: 0, dist: new Map() };
            mile[period].set(l.carId, m);
          }
          m.laps++;
          if (len > 0) m.dist.set(l.trackId, (m.dist.get(l.trackId) || 0) + len);
        }
    }
  }
  const compact = [...new Set([...rec.values(), ...personal.values()])].sort((a, b) => order.get(a) - order.get(b));
  return { rec, personal, weekly, mile, distances, trackOrder, lastLap, valid, compact, lanes: [...laneBest.values()] };
}
function navigation(source, o) {
  if (!o || typeof o.trackId !== 'string' || typeof o.champId !== 'string') throw Error('Invalid Home sessions request.');
  const out = [];
  let latest = null,
    latestWithRows = null;
  for (const s of source.navigationSessions ? source.navigationSessions(o) : source.sessions()) {
    if (o.champId && s.champ?.id === o.champId) {
      out.push(source.navigationSession ? source.navigationSession(s.id) : H.sessionValue(s));
      continue;
    }
    if (s.sessionType === 'qualifying' && s.trackId === o.trackId) {
      if (!latest || String(s.date || '') >= String(latest.date || '')) latest = s;
      if (s.standings?.length && (!latestWithRows || String(s.date || '') >= String(latestWithRows.date || ''))) latestWithRows = s;
    }
  }
  for (const s of [latest, latestWithRows]) if (s && !out.some(x => x.id === s.id)) out.push(session(s));
  return out;
}
function records(laps, trackId, token) {
  const personal = new Map(),
    pace = new Map();
  let track = Infinity,
    driverId = '';
  for (const l of laps) {
    if (l.trackId !== trackId) continue;
    if (!l.token && !l.noPersonalBest && l.driverId && l.time > 0) pace.set(l.driverId, Math.min(pace.get(l.driverId) ?? Infinity, l.time));
    if (!!l.token !== token) continue;
    if (!l.noTrackRecord && l.time < track) {
      track = l.time;
      driverId = l.driverId || '';
    }
    if (!l.noPersonalBest && l.driverId) personal.set(l.driverId, Math.min(personal.get(l.driverId) ?? Infinity, l.time));
  }
  return { track, driverId, personal: [...personal], pace: [...pace] };
}
// (2.4.0 review, speed) the pass over every lap is kept for the next Home visit while nothing was saved (the catalogue revision changes on every commit)
// and the same track, cards, last race, week and year are asked for: 150-250 ms of the main process for a big database, on every visit to Home
const summaryCache = new WeakMap();
function jsonSource(db) {
  const src = { meta: e => db.list(e), sessions: () => db.list('sessions'), laps: () => db.list('laps') };
  src.homeSummary = (o, ctx) => {
    let rev = null;
    try {
      rev = require('./catalogue-read').jsonRevision(db);
    } catch {
      /* (no revision: no cache) */
    }
    if (!rev || !db || typeof db !== 'object') return summarize(src, o, ctx);
    const key = JSON.stringify([
      rev,
      o.trackId,
      [...new Set(o.boards.map(b => b.key))].sort(),
      ctx.last ? ctx.last.id : '',
      Home.weekStart(ctx.now).getTime(),
      Home.yearStart(ctx.now).getTime()
    ]);
    const hit = summaryCache.get(db);
    const value = hit && hit.key === key ? hit.value : summarize(src, o, ctx);
    if (!hit || hit.key !== key) summaryCache.set(db, { key, value });
    return { ...value, compact: value.compact.slice(), lanes: value.lanes.map(x => ({ ...x })) }; // (the lists are copied: a card may sort them)
  };
  return src;
}
module.exports = { CARDS, SESSION, session, options, home, navigation, records, jsonSource };
