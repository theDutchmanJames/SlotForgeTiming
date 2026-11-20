// database: Results and Records › Racing Records as a Record Book (2.4.0, SlotForgeRestyle.md "Record Book"): the track records as cards, one filter bar,
// the races by month, a driver's personal bests and form, the history of a record, a driver's race history, a race opened in place, a result corrected
// after it was saved, the list as a CSV file. The words and the rows are made by renderer/recordbook.js.
// (part of renderer/database.js: loaded just before it by index.html; the parts share the page's global scope)
const rbView = { q: '', track: '', driver: '', kind: 'all', period: 'all', panel: '', allRecs: false, shown: 60 };
const rbIcon = (d, s = 14) =>
  `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const RB_ICON = {
  hist: rbIcon('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  more: rbIcon('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>', 16),
  search: rbIcon('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', 15),
  back: rbIcon('<path d="m15 6-6 6 6 6"/>', 16),
  x: rbIcon('<path d="M6 6l12 12M18 6 6 18"/>', 16)
};
// everything the book needs, read once per drawing: the sessions, the records (every page), the names
async function rbLoad() {
  const [sessions, tracks, drivers, champs] = await Promise.all([
    api.list('sessions'),
    referenceList('tracks'),
    referenceList('drivers'),
    api.list('championships').catch(() => [])
  ]);
  const records = [],
    personal = [],
    refs = { drivers: [], slotcars: [], tracks: [], sessions: [] };
  let tc = null,
    pc = null,
    first = true,
    revision = null;
  while (first || tc || pc) {
    const page = await api.historyPage('racing', { sessions: null, tracks: first || tc ? tc : null, personal: first || pc ? pc : null });
    revision = page.revision;
    if (first || tc) records.push(...page.tracks.items);
    if (first || pc) personal.push(...page.personal.items);
    for (const k of Object.keys(refs)) refs[k].push(...(page.refs[k] || []));
    tc = page.tracks.next;
    pc = page.personal.next;
    first = false;
    if (records.length + personal.length > 20000) break; // (a page that never ends is not followed for ever)
  }
  return { sessions: sessions.filter(s => s && s.sessionType !== 'tokens'), tracks, drivers, champs, records, personal, refs, revision };
}
const rbName = (list, id) => (list.find(x => x.id === id) || {}).name || '';
const rbHelmet = drivers => id => {
  const d = drivers.find(x => x.id === id) || { id };
  return typeof Garage !== 'undefined' ? `<img class="rb-helm" src="avatars/Lane${Garage.helmetOf(d)}.png" alt="">` : '';
};
// a window of the book: a picture, a kicker and a title on top, the body, a foot
function rbWindow({ pic = '', kicker = '', title = '', body = '', foot = '' }) {
  const d = document.createElement('dialog');
  d.className = 'rb-win';
  d.innerHTML = `<div class="rb-whd"><span class="rb-wpic">${pic}</span><div><small>${esc(kicker)}</small><h2>${esc(title)}</h2></div><button type="button" class="btn ghost icon rb-x" data-close aria-label="Close" title="Close">${RB_ICON.x}</button></div><div class="rb-wbody">${body}</div>${foot ? `<div class="rb-wft">${foot}</div>` : ''}`;
  document.body.appendChild(d);
  d.querySelector('[data-close]').onclick = () => d.close();
  d.onclose = () => d.remove();
  d.showModal();
  return d;
}
async function rbSaveCsv(text, name, msgEl) {
  try {
    const r = await api.shareSave(text, name, 'csv');
    if (msgEl) msgEl.textContent = r.saved ? 'Saved to ' + r.path : 'Not saved.';
  } catch (x) {
    if (msgEl) msgEl.textContent = 'Could not save: ' + x.message;
    else Dialog.alert('Could not save the list: ' + x.message);
  }
}

async function renderRecordBook(box, o = {}) {
  manager = null;
  const run = ++subRun;
  box.innerHTML = '<p role="status" aria-live="polite">Opening the record book…</p>';
  let data;
  try {
    data = await rbLoad();
  } catch (error) {
    if (run !== subRun) return;
    box.innerHTML = `<p role="alert">Could not load the results: ${esc(error.message)}</p><button class="btn" data-rb-retry>Try again</button>`;
    box.querySelector('[data-rb-retry]').onclick = () => renderRecordBook(box);
    return;
  }
  if (run !== subRun) return;
  if (state.focusSession) {
    const id = state.focusSession;
    state.focusSession = null;
    return rbOpenRace(box, id);
  }
  const { sessions, tracks, drivers, champs, records, personal } = data,
    helmet = rbHelmet(drivers),
    nameOfDriver = id => rbName(drivers, id) || rbName(data.refs.drivers, id) || 'Unknown',
    carOf = id => {
      const c = data.refs.slotcars.find(x => x.id === id);
      return c ? titleOf('slotcars', c) : '';
    };
  if (!sessions.length) {
    box.innerHTML = `<div class="rr-empty"><span class="rr-emptyico" aria-hidden="true">${Icons.svg('flag', { size: 26, stroke: 1.6 })}</span><h3>No races yet</h3><p class="muted">No results yet. Run a race from the Home tab and every lap is saved here.</p></div>`;
    return;
  }
  // the record of every track: the lap that holds it (records), its history from the races
  const recs = records
    .map(l => {
      const track = tracks.find(t => t.id === l.trackId) || {
        id: l.trackId,
        name: rbName(data.refs.tracks, l.trackId) || '(deleted)',
        lanes: 0
      };
      const cur = {
        time: l.time,
        driverId: l.driverId,
        driverName: nameOfDriver(l.driverId),
        carName: carOf(l.carId),
        date: l.date,
        sessionId: l.sessionId,
        sessionName: (sessions.find(s => s.id === l.sessionId) || {}).setupName || ''
      };
      return {
        track,
        lap: l,
        races: sessions.filter(s => s.trackId === l.trackId).length,
        history: RecordBook.history(sessions, l.trackId, cur)
      };
    })
    .sort((a, b) => b.races - a.races);
  const recHtml = r =>
    RecordBook.recordCard(r, {
      trackSvg: n => (typeof Garage !== 'undefined' ? Garage.trackSvg(n) : ''),
      helmet,
      icon: RB_ICON.hist,
      more: RB_ICON.more
    });
  // the filters and the list
  const f = rbView,
    base = RecordBook.filter(sessions, { ...f, kind: 'all' }),
    list = RecordBook.filter(sessions, f),
    kindChips = RecordBook.kinds(base),
    champName = c => rbName(champs, c && c.id) || 'Championship';
  const groups = RecordBook.months(list.slice(0, f.shown));
  // the driver of the panel: chosen, else the one of the filter, else who raced most lately
  const recent = {};
  for (const s of sessions.slice(-40))
    for (const x of s.standings || []) if (x.driverId) recent[x.driverId] = (recent[x.driverId] || 0) + 1;
  const panelId = f.panel || f.driver || Object.keys(recent).sort((a, b) => recent[b] - recent[a])[0] || (drivers[0] || {}).id || '';
  const me = RecordBook.driver(sessions, panelId);
  const myBests = personal
    .filter(l => l.driverId === panelId)
    .map(l => ({ l, track: tracks.find(t => t.id === l.trackId), rec: records.find(r => r.trackId === l.trackId) }))
    .sort((a, b) => String((a.track || {}).name || '').localeCompare(String((b.track || {}).name || '')));
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;
  const raced = drivers.filter(d => sessions.some(s => (s.standings || []).some(x => x.driverId === d.id)));
  const shownRecs = f.allRecs ? recs : recs.slice(0, 4);
  box.innerHTML = `<div class="rb">
<section aria-label="Track records"><div class="rb-h"><h3>Track records</h3><span>The fastest lap ever driven on each track${recs.length > 4 ? ` · <button type="button" class="rb-link" data-rb-allrecs>${f.allRecs ? 'Show 4' : `All ${recs.length} tracks ›`}</button>` : ''}</span></div>${recs.length ? `<div class="rb-recs">${shownRecs.map(recHtml).join('')}</div>` : '<p class="muted">No records yet.</p>'}</section>
<div class="rb-strip" role="search"><label class="rb-search">${RB_ICON.search}<span class="hs-vh">Find a race</span><input type="search" data-rb-q value="${esc(f.q)}" placeholder="Race or driver" maxlength="100"></label>
<label class="rb-sel"><span>Track</span><select data-rb-f="track">${opt('', 'All', f.track)}${tracks.map(t => opt(t.id, t.name || 'Track', f.track)).join('')}</select></label>
<label class="rb-sel"><span>Driver</span><select data-rb-f="driver">${opt('', 'All', f.driver)}${raced.map(d => opt(d.id, d.name || 'Driver', f.driver)).join('')}</select></label>
<div class="rb-chips" role="group" aria-label="Kind">${kindChips.map(k => `<button type="button" class="gx-chip${k.id === f.kind ? ' on' : ''}${k.id === 'champ' ? ' ch' : ''}" data-rb-kind="${k.id}" aria-pressed="${k.id === f.kind}">${esc(k.label)}<small>${k.n}</small></button>`).join('')}</div>
<label class="rb-sel"><span>Period</span><select data-rb-f="period">${RecordBook.PERIODS.map(([v, l]) => opt(v, l, f.period)).join('')}</select></label>
<button type="button" class="btn ghost icon gx-more" data-rb-more aria-haspopup="menu" aria-label="More: save the list as CSV" title="More">${RB_ICON.more}</button></div>
<div class="rb-cols"><div class="rb-list">${
    list.length
      ? groups
          .map(
            g =>
              `<div class="rb-month"><b>${esc(g.label)}</b>${g.sessions.length} ${g.sessions.length === 1 ? 'session' : 'sessions'}</div><div class="rb-log">${g.sessions.map(s => RecordBook.rowHtml(s, { helmet, champName })).join('')}</div>`
          )
          .join('') +
        (list.length > f.shown
          ? `<button type="button" class="btn rb-moreraces" data-rb-show>Show ${Math.min(60, list.length - f.shown)} more of ${list.length - f.shown}</button>`
          : '')
      : `<div class="gx-empty small"><div><h3>Nothing found</h3><p>No race matches these filters.</p><div class="row"><button type="button" class="btn" data-rb-clear>Clear the filters</button></div></div></div>`
  }</div>
<aside class="rb-side">${
    panelId
      ? `<div class="rb-box"><div class="hd">${helmet(panelId)}<div><b>${esc(nameOfDriver(panelId))}</b><small>Personal bests</small></div><label class="rb-sel sm"><span class="hs-vh">Driver</span><select data-rb-panel>${raced.map(d => opt(d.id, d.name || 'Driver', panelId)).join('')}</select></label></div>${
          myBests.length
            ? myBests
                .map(({ l, track, rec }) => {
                  const isRec = rec && rec.id === l.id;
                  return `<div class="rb-pb"><span>${esc((track && track.name) || rbName(data.refs.tracks, l.trackId) || 'Track')}</span><b class="${isRec ? 'rec' : ''}">${esc(RecordBook.lap(l.time))}</b><small>${esc(RecordBook.day(l.date))}</small><small class="gap">${isRec ? 'track record' : rec ? '+' + ((l.time - rec.time) / 1000).toFixed(3) + ' to the record' : ''}</small></div>`;
                })
                .join('')
            : '<p class="muted rb-pad">No personal bests yet.</p>'
        }${me.form.length ? `<div class="ft"><span>Form, last ${me.form.length} races</span></div><div class="rb-form">${me.form.map(p => `<span class="${Number(p) >= 1 && Number(p) <= 3 ? 'rb-pos p' + p : ''}">${esc(p)}</span>`).join('')}</div>` : ''}<div class="ft"><span>${me.races} ${me.races === 1 ? 'race' : 'races'} · ${me.wins} ${me.wins === 1 ? 'win' : 'wins'}</span><button type="button" class="rb-link" data-rb-driver="${esc(panelId)}">Full history ›</button></div></div>`
      : ''
  }</aside></div></div>`;
  const redraw = () => renderRecordBook(box);
  let typing = 0;
  box.oninput = ev => {
    if (!ev.target.matches('[data-rb-q]')) return;
    clearTimeout(typing);
    const v = ev.target.value;
    typing = setTimeout(async () => {
      rbView.q = v;
      rbView.shown = 60;
      await redraw();
      const i = box.querySelector('[data-rb-q]');
      if (i) {
        i.focus();
        i.setSelectionRange(i.value.length, i.value.length);
      }
    }, 300);
  };
  box.onchange = ev => {
    const t = ev.target;
    if (t.dataset.rbF !== undefined) {
      rbView[t.dataset.rbF] = t.value;
      rbView.shown = 60;
      return redraw();
    }
    if (t.matches('[data-rb-panel]')) {
      rbView.panel = t.value;
      return redraw();
    }
  };
  const openRecord = id => {
    const r = recs.find(x => x.track.id === id);
    if (r) rbRecordWindow(r, { helmet, redraw, openRace: sid => rbOpenRace(box, sid) });
  };
  box.onkeydown = ev => {
    const card = ev.target.closest && ev.target.closest('[data-rec]');
    if (card && ev.target === card && (ev.key === 'Enter' || ev.key === ' ')) {
      ev.preventDefault();
      openRecord(card.dataset.rec);
    }
  };
  box.onclick = async ev => {
    const t = ev.target;
    const b = t.closest('button');
    if (b && b.dataset.recMore) {
      const r = recs.find(x => x.track.id === b.dataset.recMore);
      if (!r) return;
      return garageMenu(
        b,
        [
          { act: 'history', label: 'History of the record' },
          { act: 'race', label: 'Open the race it was set in', disabled: !r.lap.sessionId },
          '-',
          {
            act: 'out',
            label: 'Take this lap out of the records…',
            disabled: !!r.lap.readOnly,
            note: r.lap.readOnly ? 'Recorded by another source' : ''
          }
        ],
        async act => {
          if (act === 'history') openRecord(r.track.id);
          if (act === 'race') rbOpenRace(box, r.lap.sessionId);
          if (act === 'out' && (await rbTakeOut(r.lap.id, 'track'))) redraw();
        }
      );
    }
    if (b && b.dataset.recHistory) return openRecord(b.dataset.recHistory);
    const card = t.closest('[data-rec]');
    if (card && !b) return openRecord(card.dataset.rec);
    if (!b) return;
    if (b.dataset.openRace) return rbOpenRace(box, b.dataset.openRace);
    if (b.hasAttribute('data-rb-allrecs')) {
      rbView.allRecs = !rbView.allRecs;
      return redraw();
    }
    if (b.dataset.rbKind) {
      rbView.kind = b.dataset.rbKind;
      rbView.shown = 60;
      return redraw();
    }
    if (b.hasAttribute('data-rb-show')) {
      rbView.shown += 60;
      return redraw();
    }
    if (b.hasAttribute('data-rb-clear')) {
      Object.assign(rbView, { q: '', track: '', driver: '', kind: 'all', period: 'all', shown: 60 });
      return redraw();
    }
    if (b.hasAttribute('data-rb-more'))
      return garageMenu(b, [{ act: 'csv', label: `Save these ${list.length} sessions as CSV…` }], () =>
        rbSaveCsv(RecordBook.csv(list), 'SlotForge results.csv')
      );
    if (b.dataset.rbDriver)
      return rbDriverWindow(b.dataset.rbDriver, {
        sessions,
        personal,
        records,
        tracks,
        helmet,
        nameOfDriver,
        refs: data.refs,
        redraw,
        openRace: sid => rbOpenRace(box, sid)
      });
  };
}
// take a lap out of the track records (kind 'track') or the personal bests ('pb'): the lap stays in its race, the next fastest takes over
async function rbTakeOut(lapId, kind) {
  const isTrack = kind === 'track';
  if (
    !(await Dialog.confirm(
      `Take this lap out of the ${isTrack ? 'track records' : 'personal bests'}?\n\nOnly the record is removed. The lap stays in its race, and the next fastest lap takes over.`,
      { ok: isTrack ? 'Take out of the records' : 'Take out of the personal bests', danger: true }
    ))
  )
    return false;
  await api.update('laps', lapId, isTrack ? { noTrackRecord: true } : { noPersonalBest: true });
  return true;
}
// the history of a track record: the record, who holds it, how long it stood, how often it was beaten; each time it was beaten, newest first
function rbRecordWindow(r, o) {
  const h = r.history.slice().reverse(),
    now = new Date().toISOString();
  const d = rbWindow({
    pic: typeof Garage !== 'undefined' ? Garage.trackSvg(r.track.lanes) : '',
    kicker: 'Track record · history',
    title: r.track.name || 'Track',
    body: `<div class="rb-tiles c4"><div class="rb-tile"><small>The record</small><b class="fl">${esc(RecordBook.lap(h[0].time))}</b></div><div class="rb-tile"><small>Held by</small><b class="nm">${esc(h[0].name || 'Unknown')}</b></div><div class="rb-tile"><small>Stood for</small><b>${h[0].date ? RecordBook.daysBetween(h[0].date, now) + ' d' : '—'}</b></div><div class="rb-tile"><small>Times beaten</small><b>${h.length - 1}</b></div></div>
<div class="rb-tl">${h
      .map(
        (x, i) =>
          `<button type="button" class="rb-tli${i === 0 ? ' now' : ''}" ${x.sessionId ? `data-open-race="${esc(x.sessionId)}"` : 'disabled'}><span class="t">${esc(RecordBook.lap(x.time))}</span>${o.helmet(x.driverId)}<span class="n"><b>${esc(x.name || 'Unknown')}</b><small>${esc([x.car, x.race].filter(Boolean).join(' · '))}</small></span><span class="dl">${h[i + 1] ? '−' + ((h[i + 1].time - x.time) / 1000).toFixed(3) : 'first'}</span><span class="when">${esc(RecordBook.day(x.date))}${i > 0 && x.date && h[i - 1].date ? `<small>stood ${RecordBook.daysBetween(x.date, h[i - 1].date)} d</small>` : ''}</span></button>`
      )
      .join('')}</div>`,
    foot: `<small>Each time the record of ${esc(r.track.name || 'this track')} was beaten in a race, newest first. A lap taken out of the records is left out.</small><span class="sp"></span>${r.lap.readOnly ? '' : '<button type="button" class="btn" data-rb-out>Take the record out…</button>'}`
  });
  d.onclick = async ev => {
    const row = ev.target.closest('[data-open-race]');
    if (row) {
      d.close();
      return o.openRace(row.dataset.openRace);
    }
    if (ev.target.closest('[data-rb-out]') && (await rbTakeOut(r.lap.id, 'track'))) {
      d.close();
      o.redraw();
    }
  };
}
// a driver's race history: races, wins, podiums, best lap, last raced; the places as a line; every race; the personal bests
function rbDriverWindow(id, o) {
  const me = RecordBook.driver(o.sessions, id),
    line = RecordBook.formLine(
      me.rows
        .filter(r => ['race', 'timed', 'endurance', 'heats'].includes(r.s.sessionType) && !r.x.dq)
        .slice(0, 30)
        .map(r => Number(r.x.pos))
    ),
    name = o.nameOfDriver(id),
    pbs = o.personal.filter(l => l.driverId === id);
  const colour = p => (p === 1 ? '#f5c211' : p === 2 ? '#c8ced6' : p === 3 ? '#d08a4c' : '#3b82f6');
  const d = rbWindow({
    pic: o.helmet(id),
    kicker: 'Driver · race history',
    title: name,
    body: `<div class="rb-tiles"><div class="rb-tile"><small>Races</small><b>${me.races}</b></div><div class="rb-tile"><small>Wins</small><b>${me.wins}</b></div><div class="rb-tile"><small>Podiums</small><b>${me.podiums}</b></div><div class="rb-tile"><small>Best lap</small><b class="fl">${esc(RecordBook.lap(me.best) || '—')}</b></div><div class="rb-tile"><small>Last raced</small><b class="sm">${esc(RecordBook.day(me.last) || '—')}</b></div></div>
${
  line.points.length > 1
    ? `<div class="rb-chart"><div class="rb-month"><b>Finishing place</b>last ${line.points.length} races, oldest on the left</div><svg viewBox="0 0 ${line.width} ${line.height}" preserveAspectRatio="none" role="img" aria-label="Finishing places of the last ${line.points.length} races"><path d="M20 10H${line.width - 20}M20 ${line.height - 10}H${line.width - 20}" stroke="currentColor" stroke-opacity=".12"/><polyline points="${line.path}" fill="none" stroke="#3b82f6" stroke-width="2.5" vector-effect="non-scaling-stroke"/>${line.points.map(p => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${colour(p.pos)}"><title>${p.pos}</title></circle>`).join('')}</svg></div>`
    : ''
}
<div class="rb-tbl"><div class="rb-tr h"><span>Date</span><span>Race</span><span>Track</span><span>Place</span><span>Best</span><span>Points</span></div>${me.rows
      .map(
        ({ s, x }) =>
          `<button type="button" class="rb-tr" data-open-race="${esc(s.id)}"><span class="m">${esc(RecordBook.day(s.date))}</span><span>${esc(s.setupName || 'Race')}</span><span>${esc(s.trackName || '')}</span><span>${x.dq ? 'DQ' : Number(x.pos) <= 3 ? `<span class="rb-pos p${esc(x.pos)}">${esc(x.pos)}</span>` : esc(x.pos)}</span><span class="m fl">${esc(RecordBook.lap(x.best) || '—')}</span><span class="m">${esc(x.points ?? '—')}</span></button>`
      )
      .join('')}</div>
${
  pbs.length
    ? `<div class="rb-month"><b>Personal bests</b>${pbs.length} ${pbs.length === 1 ? 'track' : 'tracks'}</div><div class="rb-tbl">${pbs
        .map(
          l =>
            `<div class="rb-tr pb"><span>${esc(rbName(o.tracks, l.trackId) || rbName(o.refs.tracks, l.trackId) || 'Track')}</span><span class="m fl">${esc(RecordBook.lap(l.time))}</span><span class="m">${esc(RecordBook.day(l.date))}</span><span>${l.readOnly ? '<small class="muted">Recorded by another source</small>' : `<button type="button" class="btn sm ghost" data-pb-out="${esc(l.id)}">Take out…</button>`}</span></div>`
        )
        .join('')}</div>`
    : ''
}`,
    foot: `<small>Every race ${esc(name)} drove, newest first. Click one to open it.</small><span class="sp"></span><span class="muted" role="status" data-csvmsg></span><button type="button" class="btn" data-rb-csv>Save as CSV…</button>`
  });
  d.onclick = async ev => {
    const row = ev.target.closest('[data-open-race]');
    if (row) {
      d.close();
      return o.openRace(row.dataset.openRace);
    }
    const out = ev.target.closest('[data-pb-out]');
    if (out && (await rbTakeOut(out.dataset.pbOut, 'pb'))) {
      d.close();
      return o.redraw();
    }
    if (ev.target.closest('[data-rb-csv]'))
      rbSaveCsv(RecordBook.driverCsv(me, name), `${name} - races.csv`, d.querySelector('[data-csvmsg]'));
  };
}
// a race opened in place: back to the book, then the race report (lap times 100 at a time)
async function rbOpenRace(box, id) {
  let offset = 0;
  const draw = async () => {
    const run = ++subRun;
    let page, detail;
    try {
      page = await api.historyPage('racing', {});
      detail = await api.historySession('racing', id, { offset, revision: page.revision });
    } catch (error) {
      if (run !== subRun) return;
      box.innerHTML = `<p role="alert">Could not open the race: ${esc(error.message)}</p><button class="btn" data-rb-back>Back to the record book</button>`;
      box.querySelector('[data-rb-back]').onclick = () => renderRecordBook(box);
      return;
    }
    if (run !== subRun) return;
    if (!detail) return renderRecordBook(box);
    box.onclick = box.onchange = box.oninput = box.onkeydown = null;
    box.innerHTML = `<div class="rb-back"><button type="button" class="btn ghost" data-rb-back>${RB_ICON.back}Record book</button>${detail.session.correction && detail.session.correction.length ? '<span class="rb-tag adj">Corrected</span>' : ''}</div><div class="rb-race"></div>`;
    const inner = box.querySelector('.rb-race');
    box.querySelector('[data-rb-back]').onclick = () => renderRecordBook(box);
    const refs = {};
    for (const k of ['sessions', 'tracks', 'drivers', 'slotcars']) refs[k] = [...(page.refs[k] || []), ...(detail.refs[k] || [])];
    await renderResultsPool(inner, 'racing', {
      sessions: [detail.session],
      laps: detail.laps || [],
      refs,
      page: { ...page, tracks: { items: [] }, personal: { items: [] } },
      detail,
      reload: draw,
      only: true
    });
    const card = inner.querySelector('details.sess');
    if (!card) return;
    card.open = true;
    const paging = document.createElement('div');
    paging.className = 'row history-laps';
    paging.innerHTML = `<span>Lap times ${detail.total ? offset + 1 : 0}–${Math.min(detail.total, offset + 100)} of ${detail.total}</span><button class="btn" data-laps-prev ${offset ? '' : 'disabled'}>Previous laps</button><button class="btn" data-laps-next ${offset + 100 < detail.total ? '' : 'disabled'}>Next laps</button>`;
    const lh = card.querySelector('.rr-laphead');
    if (lh) lh.after(paging);
    paging.onclick = ev => {
      ev.stopPropagation();
      if (ev.target.closest('[data-laps-prev]')) offset = Math.max(0, offset - 100);
      else if (ev.target.closest('[data-laps-next]')) offset += 100;
      else return;
      void draw();
    };
  };
  return draw();
}
// correct a saved result: add time, take laps away or put a car out, with a reason; the new order is shown as it is typed
async function rbCorrect(sessionId, done) {
  const all = await api.list('sessions'),
    s = all.find(x => x.id === sessionId);
  if (!s || !RecordBook.canCorrect(s)) {
    await Dialog.alert(
      'This result cannot be corrected here. A heat race or a race scored by points takes its order from the heats or the points.'
    );
    return;
  }
  const rows = (s.standings || []).map((x, i) => ({ x, i })).sort((a, b) => (Number(a.x.pos) || 99) - (Number(b.x.pos) || 99));
  const edits = {};
  const d = rbWindow({
    pic: typeof Garage !== 'undefined' ? Garage.trackSvg(4) : '',
    kicker: `Correct a result · ${s.setupName || 'Race'} · ${RecordBook.day(s.date)}`,
    title: 'Correct the result',
    body: `<p class="muted rb-lead">Add time, take laps away or put a car out after the race was saved. The order is worked out again; the report says it was corrected, with your reason.</p>
<div class="rb-tbl rb-cortbl"><div class="rb-cor h"><span>Place</span><span>Driver</span><span>Laps</span><span>Add time (s)</span><span>Take laps</span><span>Out</span><span>New place</span></div>${rows
      .map(
        ({ x, i }) =>
          `<div class="rb-cor" data-row="${i}"><span>${Number(x.pos) <= 3 ? `<span class="rb-pos p${esc(x.pos)}">${esc(x.pos)}</span>` : esc(x.pos)}</span><span class="nm">${esc(x.driverName || x.teamName || '')}</span><span class="m">${esc(x.laps)}</span><input type="number" step="0.001" value="0" data-ms="${i}" aria-label="Seconds to add for ${esc(x.driverName || '')}"><input type="number" min="0" step="1" value="0" data-laps="${i}" aria-label="Laps to take away from ${esc(x.driverName || '')}"><label class="rb-out"><input type="checkbox" data-dq="${i}"${x.dq ? ' checked' : ''}> Out</label><span class="mv" data-mv="${i}">—</span></div>`
      )
      .join('')}</div>
<label class="rb-why">Why<input type="text" data-why maxlength="300" placeholder="Jump start, seen on the video after the race"></label>
${RecordBook.inChamp(s) ? '<div class="rb-champnote">This race is a round of a championship: its standings follow the new order (the points come from the places).</div>' : ''}<p class="error" data-err role="alert"></p>`,
    foot: `<small>Records and personal bests stay: a correction changes the order, not the laps.</small><span class="sp"></span><button type="button" class="btn" data-cancel>Cancel</button><button type="button" class="btn primary" data-save>Save the correction</button>`
  });
  const preview = () => {
    const next = RecordBook.correct(s.standings, edits);
    for (const y of next) {
      const mv = d.querySelector(`[data-mv="${y.wasIndex}"]`),
        row = d.querySelector(`[data-row="${y.wasIndex}"]`);
      const moved = y.pos !== y.wasPos;
      mv.textContent = !moved ? (y.dq ? 'out' : '—') : y.pos < y.wasPos ? '▲ ' + y.pos : '▼ ' + y.pos;
      mv.className = 'mv' + (moved ? (y.pos < y.wasPos ? ' up' : ' dn') : '');
      row.classList.toggle('chg', !!edits[y.wasIndex] || moved);
    }
  };
  d.oninput = d.onchange = ev => {
    const t = ev.target,
      i = t.dataset.ms ?? t.dataset.laps ?? t.dataset.dq;
    if (i === undefined) return;
    const e = (edits[i] = edits[i] || {});
    if (t.dataset.ms !== undefined) e.ms = Math.round((Number(t.value) || 0) * 1000);
    if (t.dataset.laps !== undefined) e.laps = Math.max(0, Math.floor(Number(t.value) || 0));
    if (t.dataset.dq !== undefined) e.dq = t.checked;
    preview();
  };
  d.querySelector('[data-cancel]').onclick = () => d.close();
  d.querySelector('[data-save]').onclick = async () => {
    const why = d.querySelector('[data-why]').value.trim();
    const changed = Object.entries(edits).some(([i, e]) => e.ms || e.laps || (e.dq !== undefined && !!e.dq !== !!s.standings[i].dq));
    if (!changed) {
      d.querySelector('[data-err]').textContent = 'Nothing is changed yet.';
      return;
    }
    if (!why) {
      d.querySelector('[data-err]').textContent = 'Say why, so the report can tell.';
      return;
    }
    const c = RecordBook.correction(s, edits, why);
    try {
      await api.update('sessions', s.id, {
        standings: c.standings,
        correction: [...(Array.isArray(s.correction) ? s.correction : []), c.entry],
        ...(s.champ ? { champ: s.champ } : {})
      });
      d.close();
      await done();
    } catch (x) {
      d.querySelector('[data-err]').textContent = 'It could not be saved: ' + x.message;
    }
  };
}
