// (2.4.0, SlotForgeRestyle.md "Sensor Bench") the Trackmate page's Live monitor and Track power: the passes of every sensor (a car over a sensor sends
// letters for as long as it is there: one pass), the time between two passes of a lane, the best, the Trackcall button, a list of what came in; and the
// state of the track power with what a race does with it (read from the race setup). Nothing here records a lap. Pure; hardwareui.js draws it.
(function (root) {
  'use strict';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const GAP = 400; // ms without a letter from a sensor: the car has left it, the next letter is a new pass
  const MIN_LAP = 1000; // two passes closer than this are one car bouncing on the sensor
  const KEEP = 12; // lines kept in "What came in"
  const LANE_COLORS = ['#e5484d', '#3b82f6', '#f5c211', '#3ecf8e', '#a855f7', '#f97316', '#14b8a6', '#ec4899'];
  const secs = ms => (ms / 1000).toFixed(3);
  function create() {
    return { sensors: Array.from({ length: 8 }, () => ({ seen: 0, start: 0 })), lanes: {}, call: { count: 0, at: 0, gap: 0 }, log: [] };
  }
  const say = (st, line) => {
    st.log.unshift(line);
    st.log.length = Math.min(st.log.length, KEEP);
  };
  // a letter from a sensor (0-7) at now (ms); o.laneMap: the lane of every sensor; o.lanesOn: the sensors the Trackmate is told about
  // -> 'pass' (a new pass), 'still' (the same car), 'bounce'
  function hit(st, sensor, now, o = {}) {
    const s = st.sensors[sensor];
    if (!s) return '';
    const still = s.seen && now - s.seen < GAP;
    s.seen = now;
    if (still) return 'still';
    const lane = (o.laneMap && o.laneMap[sensor] !== undefined ? o.laneMap[sensor] : sensor) | 0,
      off = sensor >= (o.lanesOn || 8),
      L = st.lanes[lane] || (st.lanes[lane] = { passes: 0, at: 0, lap: 0, best: 0 });
    if (off) {
      say(st, {
        at: now,
        who: 'Sensor ' + String.fromCharCode(65 + sensor),
        lane: -1,
        what: 'switched off by the lane count: is a cable on the wrong input?'
      });
      return 'pass';
    }
    if (L.at && now - L.at < MIN_LAP) return 'bounce';
    const lap = L.at ? now - L.at : 0;
    L.passes++;
    L.at = now;
    if (lap) {
      L.lap = lap;
      const best = !L.best || lap < L.best;
      if (best) L.best = lap;
      say(st, { at: now, who: 'Lane ' + (lane + 1), lane, what: `${secs(lap)} s${best ? ' · best' : ''}` });
    } else say(st, { at: now, who: 'Lane ' + (lane + 1), lane, what: 'first pass' });
    return 'pass';
  }
  function call(st, now) {
    st.call.gap = st.call.at ? now - st.call.at : 0;
    st.call.at = now;
    st.call.count++;
    say(st, { at: now, who: 'Trackcall', lane: -2, what: st.call.gap ? `${secs(st.call.gap)} s after the press before` : 'pressed' });
  }
  const ago = (ms, now) => {
    if (!ms) return '';
    const s = Math.round((now - ms) / 1000);
    return s < 2 ? 'now' : s < 60 ? `${s} s ago` : `${Math.round(s / 60)} min ago`;
  };
  // the clock time of an event: o.wall turns a performance.now() into a clock (Date.now() - performance.now() at the start)
  const clock = (ms, o) => {
    const d = new Date((o.wall || 0) + ms);
    return d.toLocaleTimeString('en-GB', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };
  // o: { lanesOn, open, now, wall, lit: [bool x 9] }
  function html(st, o = {}) {
    const n = Math.max(1, Math.min(8, o.lanesOn || 2)),
      now = o.now || 0;
    if (!o.open)
      return `<div class="tmx-mon"><div class="tmx-top"><b class="tmx-wait">● Not connected</b><span>Connect the Trackmate (or the virtual one) to watch its sensors here.</span></div></div>`;
    const lanes = Array.from({ length: n }, (_, i) => {
      const L = st.lanes[i] || { passes: 0 };
      return `<div class="tmx-lane" style="--c:${LANE_COLORS[i]}"><span class="tmx-led${o.lit && o.lit[i] ? ' on' : ''}" data-tmx-led="${i}" role="img" aria-label="Lane ${i + 1}: ${o.lit && o.lit[i] ? 'a car is over the sensor' : 'clear'}"></span><h4>Lane ${i + 1}</h4><div class="tmx-t"><b>${L.lap ? secs(L.lap) : '–'}</b><span>last lap${L.best ? ` · best <em>${secs(L.best)}</em>` : ''}</span></div><small>${L.passes ? `${L.passes} ${L.passes === 1 ? 'pass' : 'passes'} · ${ago(L.at, now)}` : 'Pass a car over its sensor'}</small></div>`;
    }).join('');
    const c = st.call;
    return `<div class="tmx-mon"><div class="tmx-top"><b class="tmx-live">● Listening</b><span>Pass a car over each sensor: its light, the time between two passes. Nothing is saved; this is not a race.</span><button type="button" class="btn sm" data-tmx-clear>Clear</button></div>
      <div class="tmx-lanes">${lanes}</div>
      <div class="tmx-call"><span class="tmx-led${o.lit && o.lit[8] ? ' on' : ''}" data-tmx-led="8" role="img" aria-label="Trackcall"></span><b>Trackcall button</b><span>${c.count ? `${c.count} ${c.count === 1 ? 'press' : 'presses'} · ${ago(c.at, now)}${c.gap ? ` · ${secs(c.gap)} s after the press before` : ''}` : 'Not pressed yet · press it to test'}</span></div>
      <div class="tmx-k">What came in</div>${
        st.log.length
          ? `<ol class="tmx-log">${st.log.map(e => `<li><span>${esc(clock(e.at, o))}</span><i style="--c:${e.lane >= 0 ? LANE_COLORS[e.lane % 8] : e.lane === -2 ? 'var(--accent-text,var(--accent))' : 'var(--tmx-amber)'}">${esc(e.who)}</i><span>${esc(e.what)}</span></li>`).join('')}</ol>`
          : '<p class="tmx-none">Nothing yet.</p>'
      }</div>`;
  }

  // ---- the track power ----
  // what a race does with the power, from a race setup (none: the defaults) -> [[when, 'ON' | 'OFF' | 'BUTTON' | '', where]]
  function rules(setup) {
    const s = setup || {},
      action = s.trackCallAction || 'yellowred',
      flags = !['power', 'none'].includes(action);
    const pw = v => (v === 'off' ? 'OFF' : 'ON');
    return [
      ['While the lights count down', pw(s.startPower), 'Race Setup › Track power when a race starts'],
      ['Lights out, racing', 'ON', ''],
      ...(flags
        ? [
            ...(['yellow', 'yellowred'].includes(action)
              ? [['Yellow flag', pw(s.trackCallYellowPower), 'Race Setup › Track power during Yellow']]
              : []),
            ...(['red', 'yellowred'].includes(action) ? [['Red flag', pw(s.trackCallRedPower), 'Race Setup › Track power during Red']] : [])
          ]
        : []),
      ...(action === 'power'
        ? [['The Trackcall button', 'BUTTON', 'switches the power on and off (Race Setup › When a driver presses the call button)']]
        : []),
      ['The interface is lost in a race', 'OFF', 'until the race is started again']
    ];
  }
  // o: { power: true | false | null, at (ms or 0), relayNC, open, setupName, setup }
  function powerHtml(o = {}) {
    const on = o.power === true,
      off = o.power === false,
      known = on || off;
    return `<div class="tmx-pw"><div class="tmx-state${on ? ' on' : off ? ' off' : ''}"><span class="tmx-bolt" aria-hidden="true">ϟ</span><div><span class="tmx-k">The track now</span><h3>${known ? (on ? 'Power on' : 'Power off') : 'Not switched yet'}</h3><small>${known && o.at ? `Switched ${on ? 'on' : 'off'} at ${esc(o.at)}` : 'The app does not know until it switches it'} · relay ${o.relayNC ? 'normally closed' : 'normally open'}</small></div><span class="tmx-sw" role="group" aria-label="Track power"><button type="button" data-tmx-power="0" aria-pressed="${off}"${off ? ' class="on off"' : ''}${o.open ? '' : ' disabled'}>Off</button><button type="button" data-tmx-power="1" aria-pressed="${on}"${on ? ' class="on"' : ''}${o.open ? '' : ' disabled'}>On</button></span></div>
      <div class="tmx-race"><span class="tmx-k">In a race the app switches it${o.setupName ? ` · ${esc(o.setupName)}` : ''}</span><ul>${rules(
        o.setup
      )
        .map(
          ([w, v, where]) =>
            `<li><span>${esc(w)}</span><b class="${v === 'ON' ? 'on' : v === 'OFF' ? 'off' : ''}">${esc(v)}</b><span>${esc(where)}</span></li>`
        )
        .join('')}</ul></div>
      <div class="tmx-rel"><div><b>Power relay</b><small>If On switches the track off, choose the other.</small></div><span class="tmx-sw" role="group" aria-label="Power relay"><button type="button" data-tmx-relay="0" aria-pressed="${!o.relayNC}"${o.relayNC ? '' : ' class="on"'}>Normally open</button><button type="button" data-tmx-relay="1" aria-pressed="${!!o.relayNC}"${o.relayNC ? ' class="on"' : ''}>Normally closed</button></span></div>
      <p class="tmx-safe">Only use this if a relay circuit is connected to the Trackmate.</p></div>`;
  }
  const api = { GAP, MIN_LAP, LANE_COLORS, create, hit, call, html, rules, powerHtml };
  root.TmMonitor = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
