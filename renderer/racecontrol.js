// Race Control (2.4.0, SlotForgeRestyle.md "Race Control"): the race window while a race is on. A bar that stays on top: the state of the race in
// plain words with the colour of its flag (a stripe across the page), the clock, the controls (Start or Resume, Pause, Yellow, Red, Stop, whatever the
// layout has), the timing status and Tools. Under it the track call that waits for a decision, the order of the race as a timing tower, and the race
// screen (the layout) as a monitor at a size you choose. Pure: it builds HTML; race.js gives it what it knows and wires the buttons (data-rc="...").
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const s3 = ms => (Number.isFinite(ms) && ms > 0 ? (ms / 1000).toFixed(3) : '–');
  const COLOR = {
    ready: '#8a93a0',
    countdown: '#f2b705',
    green: '#3ecf8e',
    yellow: '#f5c518',
    red: '#e5484d',
    paused: '#6b9bd8',
    between: '#8a93a0',
    done: '#8a93a0'
  };

  // what the race is doing, in words: { key, kicker, title, sub } from what race.js knows
  // o = { phase, flag, restarting, calls: [{ lane, name, at }], lapLine, leader, picking }
  function stateOf(o) {
    const call = (o.calls || [])[0],
      more = (o.calls || []).length > 1 ? ` (and ${(o.calls || []).length - 1} more)` : '';
    if (o.phase === 'ready')
      return { key: 'ready', kicker: 'Ready', title: 'Grid is set', sub: 'Press Start or Space: five lights, then the race is on.' };
    if (o.phase === 'countdown' || o.restarting)
      return {
        key: 'countdown',
        kicker: 'Start lights',
        title: o.restarting ? 'Restart' : 'Lights on',
        sub: 'The race starts when the lights go out.'
      };
    if (o.flag === 'red')
      return { key: 'red', kicker: 'Red flag', title: 'Race stopped', sub: 'Power is off. Resume starts the race again.' };
    if (o.phase === 'paused')
      return { key: 'paused', kicker: 'Paused', title: 'Clock stopped', sub: 'Resume (or Space) and the race goes on.' };
    if (o.flag === 'yellow')
      return call
        ? {
            key: 'yellow',
            kicker: 'Yellow flag',
            title: `Track call · lane ${call.lane + 1}`,
            sub: `${call.name} called${call.at ? ' at ' + call.at : ''}${more}. Decide below.`
          }
        : { key: 'yellow', kicker: 'Yellow flag', title: 'Caution', sub: 'The cars hold their places. Yellow again (or Y) goes green.' };
    if (o.phase === 'running') return { key: 'green', kicker: 'Green flag', title: 'Racing', sub: o.lapLine || '' };
    if (o.phase === 'between')
      return {
        key: 'between',
        kicker: 'Break',
        title: 'Between heats',
        sub: o.picking ? 'Choose the lanes of the final first.' : 'Start the next heat when the drivers are ready.'
      };
    return { key: 'done', kicker: 'Race over', title: 'Chequered flag', sub: '' };
  }
  // the controls for that state: one main action, the flags outlined in their colour (filled while out), Stop as red text
  function controlsOf(st, o = {}) {
    const k = st.key,
      b = (act, label, key, cls, dis) => ({ act, label, key, cls: cls || '', disabled: !!dis });
    const flags = on => [
      b('yellow', 'Yellow', 'Y', 'rc-yellow' + (on === 'yellow' ? ' on' : ''), !['green', 'yellow'].includes(k)),
      b('red', 'Red', 'R', 'rc-redf' + (on === 'red' ? ' on' : ''), !['green', 'yellow', 'red', 'paused'].includes(k))
    ];
    const stop = b('stop', 'Stop', 'S', 'rc-stop', !['green', 'yellow', 'red', 'paused', 'between'].includes(k));
    if (k === 'ready') return [b('start', 'Start', 'Space', 'primary'), ...flags(''), b('home', 'Back to Home', '', 'rc-quiet')];
    if (k === 'countdown') return [b('start', 'Start', 'Space', '', true), ...flags(''), stop];
    if (k === 'red') return [b('red', 'Resume', 'R', 'primary'), ...flags('red'), stop];
    if (k === 'paused') return [b('pause', 'Resume', 'Space', 'primary'), ...flags(''), stop];
    if (k === 'between') return [b('start', 'Start next', 'Space', 'primary', !!o.picking), stop];
    return [b('pause', 'Pause', 'Space'), ...flags(o.flag), stop];
  }
  // the bar: o = { state, clock, clockNote, race, controls, hw: { text, tone }, sim, tools (html of the Tools menu) }
  // The bar is a frame drawn once (shell) with parts that are drawn again when they change: the state, the clock, the controls, the pills. The status
  // line of the race (#msg) and the Tools menu (the tool bar of before) are moved into the frame by race.js and stay there.
  const shell = race =>
    `<div class="rc-flag" aria-hidden="true"></div><div class="rc-in"><div class="rc-state"><span class="rc-dot" aria-hidden="true"></span><div class="rc-words"><div class="rc-race">${esc(race || '')}</div><div data-rc-part="state" role="status" aria-live="polite"></div><div class="rc-msg" data-rc-msg></div></div></div><div class="rc-clock" data-rc-part="clock"></div><div class="rc-ctl" role="group" aria-label="Race controls" data-rc-part="ctl"></div><div class="rc-more"><span class="rc-pills" data-rc-part="pills"></span><details class="rc-tools" data-rc-tools><summary class="btn">Tools</summary><div class="rc-menu" data-rc-menu></div></details></div></div>`;
  const parts = o => ({
    state: `<div class="rc-k">${esc(o.state.kicker)}</div><div class="rc-t">${esc(o.state.title)}</div>${o.state.sub ? `<div class="rc-s">${esc(o.state.sub)}</div>` : ''}`,
    clock: `<b>${esc(o.clock || '0:00')}</b>${o.clockNote ? `<small>${esc(o.clockNote)}</small>` : ''}`,
    ctl: (o.controls || [])
      .map(
        x =>
          `<button type="button" class="btn ${esc(x.cls)}" data-rc="${esc(x.act)}"${x.disabled ? ' disabled' : ''}><span>${esc(x.label)}</span>${x.key ? `<kbd>${esc(x.key)}</kbd>` : ''}</button>`
      )
      .join(''),
    pills:
      (o.sim ? '<span class="rc-pill sim" title="Simulated cars drive laps by themselves (Tools)"><i></i>Simulated</span>' : '') +
      (o.hw ? `<span class="rc-pill ${esc(o.hw.tone || '')}"><i></i>${esc(o.hw.text)}</span>` : '')
  });
  // the whole bar at once (the tests, and a first look)
  function barHtml(o) {
    const p = parts(o);
    return shell(o.race).replace(/(data-rc-part="(state|clock|ctl|pills)"[^>]*>)/g, (m, open, k) => open + p[k]);
  }
  // the calls that wait: the lane in its colour, who called, when, how long it waits, and the decisions; o.penalty: a penalty system is on
  function callsHtml(calls, o = {}) {
    if (!calls || !calls.length) return '';
    return calls
      .map(
        c =>
          `<div class="rc-call" style="--c:${esc(c.color || '#f5c518')}"><span class="rc-cl-lane">${esc(c.lane + 1)}</span><div class="rc-cl-w"><h3>Track call · lane ${esc(c.lane + 1)} · ${esc(c.name)}</h3><p>Called${c.at ? ' at ' + esc(c.at) : ''}${c.lap ? ', lap ' + esc(c.lap) : ''}. The yellow flag is out: the clock runs, the cars hold their places.</p></div><span class="rc-cl-t">${c.waited ? 'waiting ' + esc(c.waited) : ''}</span><div class="rc-cl-acts"><button type="button" class="btn primary" data-call="resume" data-id="${esc(c.id)}">Resume racing</button>${
            o.penalty && !c.dq ? `<button type="button" class="btn" data-call="penalty" data-id="${esc(c.id)}">Penalty point</button>` : ''
          }<button type="button" class="btn" data-call="lapplus" data-id="${esc(c.id)}">Give a lap</button><button type="button" class="btn" data-call="lapminus" data-id="${esc(c.id)}">Take a lap</button><button type="button" class="btn rc-redb" data-call="red" data-id="${esc(c.id)}">Red flag</button><input type="text" maxlength="120" data-call-note="${esc(c.id)}" aria-label="What happened" placeholder="What happened (goes in the log): deslot, crash, lane change…"></div></div>`
      )
      .join('');
  }
  // the order of the race: rows = [{ pos, name, car, lane, color, laps, last, best, gap, chips: [{ text, kind }] }]; o.fastest: the best lap of all
  function towerHtml(rows, o = {}) {
    if (!rows || !rows.length) return '<p class="muted rc-empty">The order shows here once the race is on.</p>';
    return `<div class="rc-tw" role="table" aria-label="The order of the race">${rows
      .map(
        r =>
          `<div class="rc-tr" role="row"${r.color ? ` style="--c:${esc(r.color)}"` : ''}><span class="rc-p p${esc(r.pos)}" role="cell">${esc(r.pos)}</span><span class="rc-strp" aria-hidden="true"></span><span class="rc-n" role="cell"><b>${esc(r.name)}</b><small>${Number.isInteger(r.lane) ? 'lane ' + (r.lane + 1) : ''}${r.car ? ' · ' + esc(r.car) : ''}</small></span><span class="rc-chips" role="cell">${(r.chips || []).map(x => `<span class="rc-chip ${esc(x.kind || '')}">${esc(x.text)}</span>`).join('')}</span><span class="rc-v" role="cell">${esc(r.laps)}<small>laps</small></span><span class="rc-v" role="cell">${esc(s3(r.last))}<small>last</small></span><span class="rc-v${o.fastest && r.best === o.fastest ? ' fl' : ''}" role="cell">${esc(s3(r.best))}<small>best</small></span><span class="rc-g${r.pos === 1 ? ' lead' : ''}" role="cell">${esc(r.pos === 1 ? 'Leader' : r.gap || '–')}</span></div>`
      )
      .join('')}</div>`;
  }
  const SIZES = [
    ['hide', 'Hide'],
    ['s', 'S'],
    ['m', 'M'],
    ['l', 'L']
  ];
  const sizeOf = v => (SIZES.some(x => x[0] === v) ? v : 'm');
  // the head of the race screen monitor: ON SCREEN, the name of the layout, the sizes, full screen
  function monitorHead(size, layoutName) {
    return `<span class="rc-live"><i></i>On screen</span><b>Race screen</b><small>${esc(layoutName || '')}</small><span class="rc-seg" role="group" aria-label="Size of the race screen">${SIZES.map(([k, t]) => `<button type="button" data-rc-size="${k}" aria-pressed="${k === sizeOf(size)}" class="${k === sizeOf(size) ? 'on' : ''}">${t}</button>`).join('')}</span><button type="button" class="btn rc-fs" data-rc="fullscreen" title="Full screen: only the race screen, as large as the window allows (F). Esc closes it." aria-label="Full screen">⛶</button>`;
  }

  const api = { COLOR, stateOf, controlsOf, shell, parts, barHtml, callsHtml, towerHtml, monitorHead, sizeOf, SIZES };
  root.RaceControl = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
