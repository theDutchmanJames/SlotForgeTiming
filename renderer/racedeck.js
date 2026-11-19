// The Lane Desk (2.4.0, SlotForgeRestyle.md "Lane Desk"): everything under the widgets of the race screen as one desk.
// One card per lane holds what is for that car: its Lap / Pit / Call buttons, its tyres, fuel, pace and weather, and the Race Director's
// pads and menus (the lane card of LaneCards). A race column holds what is for the whole race: the Race Director's last action and Undo,
// the weather and its forecast, the mandatory tyre rule, the racing systems and the log. The wide tables (Tyres, Weather, Push and Save,
// Pit stops, Endurance, Resources) are tabs under the desk.
// Nothing is built twice: the existing panels are moved into place and keep their own handlers and updates. The Race Director box
// (#lcpanel, with its clicks delegated on it) is moved as a whole; CSS (display: contents) lets its parts sit in the desk's grid.
// Only on the race screen with the lane cards on (App Settings > Race Director); the folders setting, time tokens and the Race Director
// page of other devices keep their folders.
(function (root) {
  const TABS = [
    ['tyre', 'Tyres'],
    ['weather', 'Weather'],
    ['pushsave', 'Push and Save'],
    ['pitstops', 'Pit stops'],
    ['endurance', 'Endurance'],
    ['resources', 'Resources']
  ];
  let lastTab = ''; // (the tab that was open stays open for the next race of this app session)
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const set = (e, v) => {
    if (e && e.textContent !== v) e.textContent = v;
  };
  const show = (e, on) => {
    if (e && e.hidden === !!on) e.hidden = !on;
  };
  const pctOf = (a, b) => (b > 0 ? Math.max(0, Math.min(100, Math.round((a / b) * 100))) : 0);
  const lapsText = n => `${n} ${n === 1 ? 'lap' : 'laps'}`;

  function mount(host, o) {
    if (typeof document === 'undefined' || typeof Element === 'undefined' || !(host instanceof Element)) return null;
    const dirPage = o.page === 'director', // (the Race Director page of Live Race: the same desk, its own buttons; every click there goes through the page)
      q = s => host.querySelector(s),
      folders = q(dirPage ? '#lv-dir' : '.rt-folders'),
      lc = q(dirPage ? '#dir-cards' : '#lcpanel');
    if (!folders || !lc) return null;
    const getE = () => o.eng(),
      lanes = o.lanes;
    const deck = el('div', 'rdeck');
    deck.setAttribute('role', 'region');
    deck.setAttribute('aria-label', 'Race Control');
    deck.style.setProperty('--n', String(lanes.length));
    deck.dataset.n = String(lanes.length);
    const fTrack = q('[data-dirf="track"]'),
      fDir = q('[data-dirf="director"]');
    if (dirPage && fDir) fDir.before(deck);
    else folders.prepend(deck);
    folders.classList.add('rd-on');
    deck.dataset.page = dirPage ? 'director' : 'race';
    // the hint (press Start first), the Race Director box, and the track buttons when there is nothing to direct (a practice)
    const hint = q('#trkhint'),
      grid = q('#trackgrid');
    if (hint) folders.insertBefore(hint, deck);
    deck.appendChild(lc);
    if (grid) deck.appendChild(grid);
    show(fTrack, false);
    if (fDir) fDir.classList.add('rd-gone'); // (empty now; its hidden state still says whether there is anything to direct)

    // ---- the Control Strip: the race, its clock, then the tools that are there already ----
    const tools = q(dirPage ? '#lv-dir > .lv-ctl' : '#raceactive .rt-tools'),
      clock = el('span', 'rd-clock', '0:00');
    if (tools) {
      if (o.title) {
        const who = el('div', 'rd-race');
        who.append(el('b', null, o.title), el('span', null, o.sub || ''));
        tools.prepend(who, clock);
      } else tools.prepend(clock);
      tools.classList.add('rd-strip');
    }
    const clockText = ms => {
      const s = Math.max(0, Math.floor((Number(ms) || 0) / 1000)),
        h = Math.floor(s / 3600),
        m = Math.floor((s % 3600) / 60),
        x = String(s % 60).padStart(2, '0');
      return h ? `${h}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`;
    };

    // ---- the race column ----
    const box = (cls, title) => {
      const b = el('section', 'rd-box ' + cls),
        h = el('div', 'rd-bh');
      h.appendChild(el('b', null, title));
      b.appendChild(h);
      deck.appendChild(b);
      return { b, h };
    };
    const side = {};
    const e0 = getE();
    if (e0.weather) {
      side.wx = box('rd-wx', 'Weather');
      side.wxNow = el('div', 'rd-wxnow');
      side.wxInfo = el('p', 'rd-wxinfo');
      side.wxSlot = el('div', 'rd-wxslot');
      side.wx.b.append(side.wxNow, side.wxInfo, side.wxSlot);
      // (the Dry / Cloudy / Wet / Clearing buttons are the lane cards' own; out of their box, a click is passed on to the same action)
      side.wx.b.addEventListener('click', ev => {
        const b = ev.target.closest && ev.target.closest('[data-lc-wx]');
        if (!b || b.disabled) return;
        o.weather(b.dataset.lcWx);
        b.blur();
      });
    }
    if (e0.tyrewear) {
      side.rule = box('rd-rule', 'Tyre rule');
      side.ruleText = el('span', 'rd-bhnote');
      side.rule.h.appendChild(side.ruleText);
      side.ruleRows = el('div', 'rd-rulerows');
      side.rule.b.appendChild(side.ruleRows);
      side.rule.b.hidden = true;
    }
    // the calls that wait (Race Director page): the list in the race column, the Call button of a lane in its card
    const calls = dirPage ? q('#dir-calls') : null;
    if (calls) {
      side.calls = box('rd-calls', 'Calls');
      const card = calls.closest('.card');
      side.calls.b.appendChild(calls);
      if (card) card.classList.add('rd-gone');
    }
    const sys = q(dirPage ? '#dir-systems' : '#systempanel'),
      fSys = q('[data-dirf="systems"]');
    if (sys && fSys) {
      side.sys = box('rd-sys', 'Racing systems');
      side.sys.h.appendChild(el('span', 'rd-bhnote', 'this race only'));
      side.sys.b.appendChild(sys);
      fSys.classList.add('rd-gone'); // (the Race Director page shows its folder again on every update: a class keeps it away)
    }

    // ---- the tabs under the desk ----
    const tabs = el('div', 'rd-tabs'),
      bar = el('div', 'rd-tabbar'),
      panes = el('div', 'rd-panes rd-sheet');
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Race details');
    tabs.append(bar, panes);
    deck.after(tabs);
    const tabList = [];
    TABS.forEach(([id, label]) => {
      const f = q(`[data-dirf="${id}"]`);
      if (!f) return;
      if (!f.id) f.id = 'fd-' + id;
      const b = el('button', 'rd-tab', label);
      b.type = 'button';
      b.id = 'rdt-' + id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', f.id);
      b.dataset.rdTab = id;
      f.open = true;
      f.classList.add('rd-pane');
      f.setAttribute('role', 'tabpanel');
      f.setAttribute('aria-labelledby', b.id);
      bar.appendChild(b);
      panes.appendChild(f);
      tabList.push({ id, b, f });
    });
    const pick = id => {
      tabList.forEach(t => {
        const on = t.id === id;
        t.b.setAttribute('aria-selected', String(on));
        t.b.tabIndex = on ? 0 : -1;
        t.f.classList.toggle('rd-off', !on);
      });
      if (id) lastTab = id;
    };
    bar.addEventListener('click', ev => {
      const b = ev.target.closest('[data-rd-tab]');
      if (b) pick(b.dataset.rdTab);
    });
    bar.addEventListener('pointerdown', () => bar.classList.remove('rd-kbd'));
    bar.addEventListener('keydown', ev => {
      bar.classList.add('rd-kbd');
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
      const on = tabList.filter(t => !t.b.hidden),
        i = on.findIndex(t => t.b.getAttribute('aria-selected') === 'true');
      if (!on.length) return;
      const n = ev.key === 'Home' ? 0 : ev.key === 'End' ? on.length - 1 : (i + (ev.key === 'ArrowRight' ? 1 : -1) + on.length) % on.length;
      pick(on[n].id);
      on[n].b.focus();
      ev.preventDefault();
    });
    // the tyre button of a lane card opens the Tyre Change folder: here that is the Tyres tab
    lc.addEventListener(
      'click',
      ev => {
        if (ev.target.closest && ev.target.closest('[data-lc-tyre]') && tabList.some(t => t.id === 'tyre')) pick('tyre');
      },
      true
    );

    // ---- the lanes ----
    const facts = new Map();
    const factsOf = lane => {
      if (facts.has(lane)) return facts.get(lane);
      const e = getE(),
        f = { box: el('div', 'rd-facts') };
      const row = (key, label) => {
        const r = el('div', 'rd-fr rd-fr-' + key),
          v = el('div', 'rd-v');
        r.append(el('i', null, label), v);
        f.box.appendChild(r);
        return { r, v };
      };
      if (e.tyrewear) {
        f.ty = row('tyre', 'Tyres');
        f.ring = el('span', 'rd-ring');
        f.bar = el('span', 'rd-bar');
        f.barIn = el('b');
        f.bar.appendChild(f.barIn);
        f.tyText = el('span', 'rd-num');
        f.next = el('select', 'rd-next');
        f.next.setAttribute('aria-label', `Tyre for the next stop of lane ${lane + 1}`);
        ['', ...Wx.TYRES.map(t => t.code)].forEach(c => {
          const op = el('option', null, c ? Wx.tyreName(c) : 'Same');
          op.value = c;
          f.next.appendChild(op);
        });
        f.next.addEventListener('change', () => o.tyreNext(lane, f.next.value));
        f.ty.v.append(f.ring, f.bar, f.tyText);
        f.ty.r.appendChild(f.next);
      }
      if (e.fuel && e.fuel.on) {
        f.fu = row('fuel', 'Fuel');
        f.fbar = el('span', 'rd-bar rd-fuel');
        f.fbarIn = el('b');
        f.fbar.appendChild(f.fbarIn);
        f.fuText = el('span', 'rd-num');
        f.fu.v.append(f.fbar, f.fuText);
      }
      if (e.pushSave) {
        f.ps = row('pace', 'Pace');
        f.pill = el('span', 'pspill');
        f.psText = el('span', 'rd-sub');
        f.ps.v.append(f.pill, f.psText);
      }
      if (e.weather) {
        f.wx = row('wx', 'Weather');
        f.wxText = el('span', 'rd-sub');
        f.wx.v.appendChild(f.wxText);
      }
      facts.set(lane, f);
      return f;
    };

    // (Race Director page) the Call button of a lane, in its card
    const callRows = new Map();
    const callRow = lane => {
      if (!dirPage) return null;
      if (callRows.has(lane)) return callRows.get(lane);
      const b = q(`[data-cmd="call"][data-lane="${lane}"]`);
      if (!b) return null;
      const r = el('div', 'rd-callrow');
      r.appendChild(b);
      callRows.set(lane, r);
      return r;
    };
    function update() {
      const e = getE(),
        t = o.now(),
        usable = !!fDir && !fDir.hidden;
      deck.dataset.mode = usable ? 'desk' : 'track';
      if (o.elapsed) set(clock, clockText(o.elapsed()));
      show(lc, usable);
      if (grid) show(grid, !usable);
      // the Lap / Pit / Call buttons into the lane cards (again after the lane cards were drawn anew: a new layout of the pads)
      const trk = o.trkCards ? o.trkCards() : [];
      for (const lane of lanes) {
        const card = usable ? lc.querySelector(`.lc-card[data-lc-lane="${lane}"]`) : null,
          tc = trk.find(x => x.lane === lane);
        if (!card) {
          if (tc && grid && tc.card.parentNode !== grid) grid.appendChild(tc.card);
          continue;
        }
        if (!card.dataset.rdc) {
          card.dataset.rdc = '1';
          card.style.setProperty('--c', o.color(lane));
          card.classList.add('rd-lane');
        }
        const head = card.querySelector('.lc-head'),
          f = factsOf(lane),
          top = tc ? tc.card : callRow(lane);
        if (top && top.parentNode !== card) head.after(top);
        const anchor = top || head;
        if (f.box.previousSibling !== anchor) anchor.after(f.box);
      }
      if (usable) lanes.forEach(l => drawFacts(e, t, l));
      drawSide(e, t);
      // the tabs: one for every folder that has something to show
      let open = '';
      tabList.forEach(x => {
        show(x.b, !x.f.hidden);
        if (!x.f.hidden && x.b.getAttribute('aria-selected') === 'true') open = x.id;
      });
      const vis = tabList.filter(x => !x.f.hidden);
      show(tabs, vis.length > 0);
      if (!open && vis.length) pick((vis.find(x => x.id === lastTab) || vis[0]).id);
    }

    function drawFacts(e, t, lane) {
      const i = e.cars.findIndex(c => c.lane === lane),
        f = facts.get(lane);
      if (!f || i < 0) return;
      const c = e.cars[i];
      if (f.ty) {
        const row = (TyreWear.view(e, [lane], t).rows || [])[0];
        show(f.ty.r, !!row);
        if (row) {
          set(f.ring, row.icon || row.code);
          f.ring.style.setProperty('--tc', row.color || 'var(--muted)');
          f.ring.title = row.tyre;
          const life = Math.max(0, Math.min(100, Number(row.shown ?? row.life) || 0));
          f.barIn.style.width = life + '%';
          f.bar.classList.toggle('lo', life < 35);
          set(f.tyText, row.fitting ? 'Changing tyres' : `${Math.round(life)}%${row.leftText ? ' · ' + row.leftText : ''}`);
          const ch = TyreWear.nextChoices(row, !!e.weather);
          if (document.activeElement !== f.next) {
            Array.from(f.next.options).forEach((op, k) => {
              const x = ch[k];
              if (!x) return;
              if (op.textContent !== x.text) op.textContent = x.text;
              if (op.disabled !== x.disabled) op.disabled = x.disabled;
              if (op.hidden !== x.hidden) op.hidden = x.hidden;
            });
            if (f.next.value !== row.queued) f.next.value = row.queued;
          }
          f.next.disabled = !['ready', 'countdown', 'running', 'paused', 'between'].includes(o.phase()) || !!row.fitting;
          f.next.title = TyreWear.nextNote(row);
        }
      }
      if (f.fu) {
        const on = !e.systemEnabled || e.systemEnabled('fuel'),
          tank = e.tankOf ? e.tankOf(i) : e.fuel.tank,
          now = e.fuelOf ? e.fuelOf(i, t) : c.fuel,
          p = pctOf(now, tank),
          per = Number(e.fuel.perLap) || 0,
          laps = per > 0 ? Math.floor(now / per) : null;
        show(f.fu.r, on);
        f.fbarIn.style.width = p + '%';
        f.fbar.classList.toggle('lo', p < 20);
        set(f.fuText, c.outOfFuel ? 'Empty' : `${p}%${laps !== null ? ' · ' + lapsText(laps) : ''}`);
      }
      if (f.ps) {
        const on = !e.systemEnabled || e.systemEnabled('pushsave');
        show(f.ps.r, on);
        if (on) {
          const r = PushSavePanel.rowTexts(e, c, e.pushSave);
          set(f.pill, r.pill);
          const cls = 'pspill psk-' + r.kind;
          if (f.pill.className !== cls) f.pill.className = cls;
          set(f.psText, r.pct);
        }
      }
      if (f.wx) {
        const w = (Wx.view(e, o.phase(), t, [lane]).rows || [])[0],
          text = w ? [w.todo, w.hinderText].filter(Boolean).join(' · ') : '';
        show(f.wx.r, !!text);
        set(f.wxText, text);
      }
    }

    function drawSide(e, t) {
      if (side.wx) {
        const v = Wx.view(e, o.phase(), t, lanes),
          on = v.on && (!e.systemEnabled || e.systemEnabled('weather'));
        show(side.wx.b, on);
        set(side.wxNow, v.name || '');
        set(side.wxInfo, (v.info || '').replace(/^[^.]*\.\s*/, ''));
        const seg = lc.querySelector('.lc-wx') || side.wxSlot.querySelector('.lc-wx');
        if (seg && seg.parentNode !== side.wxSlot) side.wxSlot.appendChild(seg);
      }
      if (side.rule) {
        const rows = (TyreWear.view(e, lanes, t).rows || []).filter(r => r.mand);
        show(side.rule.b, rows.length > 0);
        if (rows.length) {
          set(side.ruleText, (rows[0].mand.rule || '').replace(/^Mandatory:\s*/, ''));
          const key = rows.map(r => r.lane + ':' + TyreWear.mandStateText(r.mand)).join('|');
          if (side.ruleRows.dataset.k !== key) {
            side.ruleRows.dataset.k = key;
            side.ruleRows.textContent = '';
            rows.forEach(r => {
              const d = el('div', 'rd-rulerow'),
                n = el('span', 'rd-ln', String(r.lane + 1)),
                st = TyreWear.mandStateText(r.mand);
              n.style.setProperty('--c', o.color(r.lane));
              d.append(
                n,
                el('span', null, st),
                el('span', 'rd-rulest' + (r.mand.ok ? ' ok' : ''), r.mand.ok ? 'done' : r.mand.judged ? '' : 'to do')
              );
              side.ruleRows.appendChild(d);
            });
          }
        }
      }
    }

    pick('');
    return { update, pick, deck };
  }

  const api = { mount, TABS };
  root.RaceDeck = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
