// (2.4.0, SlotForgeRestyle.md "Try It") the Layout Editor tried with a sample race: a bar above the canvas plays a race through the app's own engine
// (WidgetPreview.play) at a moment (the lights, racing, yellow, red, a pit stop, finished) with 2 to 8 cars, at 1x or 4x; nothing is saved by it. Also the
// race setups that use the layout (a chip in the editor, a line on the cards), the widgets with words they do not know, and Delete that says what changes.
const LayoutTry = (() => {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ico = (n, size = 14) => (typeof Icons !== 'undefined' && Icons.has(n) ? Icons.svg(n, { size, stroke: 1.8 }) : '');
  const MOMENTS = [
    ['lights', 'Lights'],
    ['racing', 'Racing'],
    ['yellow', 'Yellow'],
    ['red', 'Red'],
    ['pit', 'Pit stop'],
    ['finished', 'Finished']
  ];
  const STILL = new Set(['red', 'finished']); // (the race stands still: the clock does not go on)
  // the lanes a layout shows: one more than its highest lane widget, 2 to 8
  const lanesOf = d => {
    const per = (d.widgets || []).filter(w => typeof Widgets !== 'undefined' && Widgets.def(w.type)?.perLane);
    return Math.max(2, Math.min(8, per.length ? Math.max(...per.map(w => (Number(w.lane) || 0) + 1)) : 4));
  };
  // ---- the sample race ----
  function start(ed, o = {}) {
    ed.play = { t: 0, moment: 'lights', lanes: lanesOf(ed.draft), speed: 1, running: true, ...(ed.play || {}), ...o };
    if (o.fresh) Object.assign(ed.play, { t: 0, moment: 'lights', running: true });
    compute(ed);
  }
  function compute(ed) {
    if (!ed.play || typeof WidgetPreview === 'undefined' || !WidgetPreview.play) return;
    const r = WidgetPreview.play({ lanes: ed.play.lanes, t: ed.play.t, moment: ed.play.moment });
    Object.assign(ed.play, { shared: r.shared, lap: r.lap, clock: r.clock });
  }
  // the shared state the widgets of the canvas read (null: the still sample of before)
  const shared = ed => (ed && ed.play ? ed.play.shared || null : null);
  // a widget of a lane the sample race does not have is shown faded, as the race leaves it out
  const off = (ed, w) =>
    !!(ed && ed.play && typeof Widgets !== 'undefined' && Widgets.def(w.type)?.perLane && (Number(w.lane) || 0) >= ed.play.lanes);
  function barHtml(ed) {
    const p = ed.play;
    if (!p)
      return `<button type="button" class="lt-play" data-lt="start">${ico('lights')}<span>Try it</span></button><span class="lt-hint">Play a sample race on the canvas: the lights, laps, a yellow flag, a pit stop, the finish. Nothing is saved.</span>`;
    const seg = (key, list, on) =>
      `<span class="lt-seg" role="group">${list.map(([v, t]) => `<button type="button" data-lt-${key}="${v}" aria-pressed="${String(v) === String(on)}"${String(v) === String(on) ? ' class="on"' : ''}>${esc(t)}</button>`).join('')}</span>`;
    return `<button type="button" class="lt-play${p.running ? ' on' : ''}" data-lt="${p.running ? 'pause' : 'resume'}">${p.running ? '❚❚ Pause' : '▶ Play'}</button><span class="lt-k">Sample race · ${p.lanes} cars</span><span class="lt-clock" aria-live="off">${p.moment === 'lights' ? 'LIGHTS' : 'LAP ' + esc(p.lap)} · ${esc(p.clock)}</span><span class="lt-sep"></span>${seg('moment', MOMENTS, p.moment)}<span class="lt-sep"></span><span class="lt-k">Lanes</span>${seg(
      'lanes',
      [2, 4, 6, 8].map(n => [n, n]),
      p.lanes
    )}${seg(
      'speed',
      [
        [1, '1×'],
        [4, '4×']
      ],
      p.speed
    )}<button type="button" class="btn sm ghost lt-stop" data-lt="stop">Stop</button>`;
  }
  // (2.4.0) the numbers of a widget changed, nothing else (most frames of the sample race): the new numbers are written into the widget as it stands, so the
  // sizes its last fit set are kept and it is not measured again. -> false when anything else changed (then it is drawn and fitted afresh)
  const shapeOf = h => h.replace(/\d/g, '0');
  const nodesOf = root => {
    const out = [],
      walk = root.ownerDocument.createTreeWalker(root, 5); // (elements and text)
    for (let n = walk.nextNode(); n; n = walk.nextNode()) out.push(n);
    return out;
  };
  function patchDigits(val, last, html) {
    if (typeof last !== 'string' || last.length !== html.length || shapeOf(last) !== shapeOf(html)) return false;
    const parse = h => {
      const t = val.ownerDocument.createElement('template');
      t.innerHTML = h;
      return nodesOf(t.content);
    };
    const live = nodesOf(val),
      a = parse(last),
      b = parse(html);
    if (live.length !== a.length || a.length !== b.length || live.some((n, i) => n.nodeName !== a[i].nodeName)) return false;
    for (let i = 0; i < b.length; i++) {
      if (b[i].nodeType === 3) {
        if (a[i].data !== b[i].data) live[i].data = b[i].data;
      } else for (const at of b[i].attributes) if (a[i].getAttribute(at.name) !== at.value) live[i].setAttribute(at.name, at.value);
    }
    return true;
  }
  // a plain text whose last fit holds for any digits (a font with equal-width digits, as on the race screen) needs no new fit; the others are fitted again
  const fitHolds = (val, w) =>
    !(typeof WidgetView !== 'undefined' && WidgetView.kind?.(w) === 'text') ||
    (val._sfDigitsFit != null && typeof Frame !== 'undefined' && val._sfDigitsFit === Frame.fontEpoch?.());
  // a frame of the race: only the widgets whose content changed are painted, and only those whose shape or colour changed are fitted again
  function paintFrame(ed) {
    const canvas = document.getElementById('canvas');
    if (!canvas || typeof previewOf !== 'function') return 0;
    const changed = [],
      ctx = typeof editorPreviewContext === 'function' ? editorPreviewContext(ed) : null;
    canvas.querySelectorAll('.lw[data-i]').forEach(el => {
      const w = ed.draft.widgets[Number(el.dataset.i)],
        val = el.querySelector(':scope > .lw-val'),
        def = w && Widgets.def(w.type);
      if (!val || !def || def.button) return;
      // (one content() call gives the words and the colour; previewOf would make the same call for the words alone)
      const o =
          ctx && typeof WidgetPreview !== 'undefined' ? WidgetPreview.content({ ...w, lane: w.lane || 0, previewContext: ctx }) : null,
        html = o ? o.html : previewOf(def, w),
        look = o ? [o.color, o.bg, o.disabled].join('|') : ''; // (a car in the pits or under a penalty: the colour changes, the text may not)
      if (el._ltHtml === html && el._ltLook === look) return;
      const last = el._ltHtml,
        sameLook = el._ltLook === look;
      el._ltHtml = html;
      el._ltLook = look;
      if (sameLook && patchDigits(val, last, html) && fitHolds(val, w)) return;
      if (!sameLook && last === html) return changed.push(el); // (the colour alone)
      val.innerHTML = html;
      changed.push(el);
    });
    if (changed.length && typeof fitEditorWidgets === 'function') fitEditorWidgets(changed);
    return changed.length;
  }
  // the bar and its timer; refresh() draws the canvas again
  function mount({ ed, refresh, select }) {
    ed.ltSelect = select; // (a widget named in a warning: a click selects it)
    const bar = document.getElementById('e-try');
    if (!bar) return;
    const paint = () => {
      bar.innerHTML = barHtml(ed);
      bar.classList.toggle('on', !!ed.play);
    };
    const redraw = () => {
      compute(ed);
      paint();
      refresh();
    };
    paint();
    bar.onclick = ev => {
      const b = ev.target.closest && ev.target.closest('button');
      if (!b) return;
      const d = b.dataset;
      if (d.lt === 'start') start(ed, { fresh: true });
      if (d.lt === 'pause') ed.play.running = false;
      if (d.lt === 'resume') ed.play.running = true;
      if (d.lt === 'stop') ed.play = null;
      if (d.ltMoment) {
        ed.play.moment = d.ltMoment;
        if (d.ltMoment === 'lights') ed.play.t = 0;
        else if (ed.play.t < 30000) ed.play.t = 30000; // (a few laps in, so there is something to see)
        ed.play.running = !STILL.has(d.ltMoment);
      }
      if (d.ltLanes) ed.play.lanes = Number(d.ltLanes);
      if (d.ltSpeed) ed.play.speed = Number(d.ltSpeed);
      redraw();
    };
    if (ed.playTimer) clearInterval(ed.playTimer);
    ed.playTimer = setInterval(() => {
      if (state.editing !== ed || !document.getElementById('e-try')) {
        clearInterval(ed.playTimer);
        ed.playTimer = null;
        return;
      }
      const p = ed.play;
      if (!p || !p.running || document.hidden) return;
      p.t += 500 * p.speed;
      if (p.moment === 'lights' && p.t >= 4000) {
        p.moment = 'racing'; // (the lights go out: the race is on)
        p.t = 0;
      }
      if (p.t > 45 * 60000) p.t = 30000; // (a long try starts again)
      compute(ed);
      paint();
      paintFrame(ed);
    }, 500);
    if (ed.play) redraw();
  }

  // ---- the widgets with words they do not know ----
  function warnHtml(ed) {
    if (typeof LayoutCheck === 'undefined') return '';
    const sel = ed.sel || [],
      list = LayoutCheck.problems(ed.draft).filter(p => !sel.length || sel.includes(ed.draft.widgets[p.index]));
    if (!list.length) return '';
    const n = list.length;
    return `<b>⚠ ${sel.length ? 'This widget shows' : n === 1 ? '1 widget shows' : n + ' widgets show'} a word it does not know</b>${list
      .map(
        p =>
          `<p>${sel.length ? '' : `<button type="button" class="lt-pick" data-lt-pick="${p.index}">“${esc(p.title)}”${p.lane ? ` (lane ${p.lane})` : ''}</button>: `}${p.words
            .map(x => esc(LayoutCheck.advice(x, ed.draft.widgets[p.index].type)).replace(/\{(\w+)\}/g, '<code>{$1}</code>'))
            .join(' ')}</p>`
      )
      .join('')}`;
  }
  function refreshWarn(ed, side) {
    if (!side) return;
    let el = side.querySelector('#lt-warn');
    const html = warnHtml(ed);
    if (!html) return el && el.remove();
    if (!el) {
      el = document.createElement('div');
      el.id = 'lt-warn';
      el.className = 'lt-warn';
      el.setAttribute('role', 'status');
      el.onclick = ev => {
        const b = ev.target.closest && ev.target.closest('[data-lt-pick]');
        if (b && ed.ltSelect) ed.ltSelect(Number(b.dataset.ltPick));
      };
      side.append(el);
    }
    if (el.innerHTML !== html) el.innerHTML = html;
  }
  const bad = w => typeof LayoutCheck !== 'undefined' && LayoutCheck.unknownWords(w).length > 0;

  // ---- the race setups that use a layout ----
  let setupsP = null,
    setupsAt = 0;
  function setups(fresh) {
    if (!fresh && setupsP && Date.now() - setupsAt < 5000) return setupsP;
    setupsAt = Date.now();
    setupsP = Promise.resolve(api.list ? api.list('racesetups') : []).catch(() => []);
    return setupsP;
  }
  const SCREEN = { main: 'main screen', second: 'second display' };
  function usedLine(list) {
    if (!list.length) return '<span class="lt-none">Not used by a race setup yet</span>';
    const names = [...new Set(list.map(u => u.id))].length;
    return `${ico('setup')}<b>Used by ${names} race ${names === 1 ? 'setup' : 'setups'}</b>${list
      .slice(0, 4)
      .map(u => `<span class="lt-pill">${esc(u.name)} · ${SCREEN[u.screen]}</span>`)
      .join('')}${list.length > 4 ? `<span class="lt-pill">+${list.length - 4}</span>` : ''}`;
  }
  // the chip in the editor: the race setups, each opens its form
  async function chip(ed, host) {
    if (!host || !ed.id) return;
    const list = LayoutCheck.usedBy(await setups(), ed.id);
    if (state.editing !== ed) return;
    host.querySelector('.lt-used')?.remove();
    const names = [...new Set(list.map(u => u.id))].length;
    host.insertAdjacentHTML(
      'afterbegin',
      `<details class="lt-used"><summary>${ico('setup')}${names ? `Used by ${names} race ${names === 1 ? 'setup' : 'setups'}` : 'Not used yet'}</summary><div class="lt-usedlist">${
        list.length
          ? list
              .map(
                u => `<button type="button" data-lt-setup="${esc(u.id)}"><b>${esc(u.name)}</b><small>${SCREEN[u.screen]}</small></button>`
              )
              .join('')
          : '<p>No race setup uses this layout. Choose it in a race setup, under Timing Page/Race Screen.</p>'
      }</div></details>`
    );
    host.querySelector('.lt-used').onclick = async ev => {
      const b = ev.target.closest && ev.target.closest('[data-lt-setup]');
      if (!b) return;
      if (typeof MainBar !== 'undefined' && MainBar.leave && !(await MainBar.leave())) return;
      const rec = (await setups(true)).find(s => s.id === b.dataset.ltSetup);
      state.editing = null;
      state.tab = 'setup';
      state.setupSub = 'setups';
      await render();
      if (rec && typeof openForm === 'function') openForm('racesetups', rec);
    };
  }
  // the cards of the list: who uses each layout
  async function cards(box, layouts) {
    const all = await setups(true);
    layouts.forEach(l => {
      const el = box.querySelector(`[data-lt-used="${typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(l.id) : l.id}"]`);
      if (el) el.innerHTML = usedLine(LayoutCheck.usedBy(all, l.id));
    });
  }

  // (2.4.0) the chart designs and picture sets: the layouts and leaderboard rows that use each, filled in under its card
  async function uses(box) {
    if (!box || !box.querySelectorAll || typeof LayoutCheck === 'undefined') return;
    const els = [...box.querySelectorAll('[data-lt-uses]')];
    if (!els.length) return;
    const read = e => Promise.resolve(api.list ? api.list(e) : []).catch(() => []);
    const lists = await Promise.all([read('layouts'), read('rowdesigns')]);
    els.forEach(el => {
      if (el.isConnected !== false) el.innerHTML = LayoutCheck.usesLine(LayoutCheck.layoutsUsing(el.dataset.ltUses, lists));
    });
  }
  // ---- Delete: the race setups that use it, and what they use instead -> { instead } or null ----
  async function askDelete(l, layouts) {
    const all = await setups(true),
      used = LayoutCheck.usedBy(all, l.id);
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.className = 'appdlg lt-del';
      const others = layouts.filter(x => x.id !== l.id);
      d.innerHTML = `<h3>Delete “${esc(l.name)}”?</h3><div class="appdlg-body">${
        used.length
          ? `<p>These race setups use it. Choose what they show instead.</p><ul class="lt-dellist">${used.map(u => `<li><b>${esc(u.name)}</b><small>${SCREEN[u.screen]}</small></li>`).join('')}</ul>
        <label class="lt-instead">They use instead<select data-lt-instead><option value="">The default layout</option>${others.map(x => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join('')}</select></label>${used.some(u => u.screen === 'second') ? '<small class="lt-note">With the default layout, a second display shows the same as the main screen.</small>' : ''}`
          : '<p>No race setup uses it.</p>'
      }<p class="muted">This can't be undone.${used.length ? ' A backup is made first.' : ''}</p></div><div class="row appdlg-buttons"><button type="button" class="btn" data-lt-no>Keep it</button><button type="button" class="btn danger" data-lt-yes>${used.length ? 'Delete and use the default layout' : 'Delete'}</button></div>`;
      document.body.append(d);
      const sel = d.querySelector('[data-lt-instead]'),
        yes = d.querySelector('[data-lt-yes]');
      if (sel)
        sel.onchange = () => {
          const o = others.find(x => x.id === sel.value);
          yes.textContent = o ? `Delete and use “${o.name}”` : 'Delete and use the default layout';
        };
      const done = v => {
        d.close();
        d.remove();
        resolve(v);
      };
      d.addEventListener('cancel', ev => {
        ev.preventDefault();
        done(null);
      });
      d.querySelector('[data-lt-no]').onclick = () => done(null);
      yes.onclick = () => done({ instead: sel ? sel.value : '', setups: all, used });
      d.showModal();
      d.querySelector('[data-lt-no]').focus();
    });
  }
  // deletes the layout after asking; the race setups that use it are changed first (a backup before) -> true when it was deleted
  async function remove(l, layouts) {
    const a = await askDelete(l, layouts);
    if (!a) return false;
    const plan = LayoutCheck.deletePlan(a.setups, l.id, a.instead);
    if (plan.length && api.backupMake) {
      const r = await api
        .backupMake({ kind: 'safety', note: `Before deleting the layout ${l.name}` })
        .catch(e => ({ ok: false, error: e.message }));
      if (r && r.ok === false) {
        await Dialog.alert('The backup could not be made, so the layout is kept: ' + r.error);
        return false;
      }
    }
    for (const p of plan) await api.update('racesetups', p.id, p.patch);
    await api.remove('layouts', l.id);
    setupsP = null;
    return true;
  }
  return {
    MOMENTS,
    uses,
    paintFrame,
    patchDigits,
    lanesOf,
    start,
    compute,
    shared,
    off,
    barHtml,
    mount,
    warnHtml,
    refreshWarn,
    bad,
    usedLine,
    chip,
    cards,
    askDelete,
    remove,
    setups
  };
})();
if (typeof module !== 'undefined') module.exports = LayoutTry;
