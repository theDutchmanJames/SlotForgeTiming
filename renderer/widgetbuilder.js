// Customization > Widget Builder: make compositions or simple text/image widgets, save them, and add them from the Layout Editor's "My widgets" list.
// A widget is copied into the layout when you add it, so changing it here later does not touch layouts that already use it.
let wbEd = null; // { id, draft, dirty }

const wbKinds = [
  ['textlane', 'Text, per lane (one for each car)'],
  ['textrace', 'Text, race (one for the whole race)'],
  ['imagelane', 'Image, per lane'],
  ['imagerace', 'Image, race']
];
const wbIsImage = t => t === 'imagelane' || t === 'imagerace';
const wbVars = t => (t === 'textrace' || t === 'imagerace' ? Widgets.TEXT_RACE_VARS : Widgets.TEXT_LANE_VARS);
const wbNew = () => ({
  name: '',
  type: 'textlane',
  text: Widgets.TEXT_LANE_DEFAULT,
  w: 300,
  h: 60,
  textSize: 30,
  valueBold: true,
  valueItalic: false
});

// a saved widget -> a widget for a layout (position is set by the editor)
function wbToWidget(r, lane) {
  const g = Widgets.newWidget(r.type, lane, 20, 20);
  g.opt = wbIsImage(r.type) ? { image: r.image || '', fit: r.fit || 'contain', rules: clone(r.rules || []) } : { text: r.text };
  g.w = Number(r.w) || g.w;
  g.h = Number(r.h) || g.h;
  g.textSize = r.textSize ?? g.textSize;
  g.valueBold = r.valueBold !== false;
  g.valueItalic = !!r.valueItalic;
  g.title = r.name || '';
  g.showTitle = false;
  if (r.composition) g.opt = { composition: clone(r.composition) };
  return g;
}

async function renderWidgetBuilder(box) {
  if (wbEd?.draft?.composition && typeof WidgetStudio !== 'undefined') return WidgetStudio.edit(box);
  if (wbEd) return renderWidgetBuilderEditor(box);
  manager = null;
  box.onchange = box.oninput = null;
  const list = await api.list('customwidgets');
  box.innerHTML =
    `<div class="row"><button class="btn primary" id="new-composer">New canvas widget</button><button class="btn" id="newwb">Simple text or image</button></div>` +
    (list.length
      ? '<div class="lgrid">' +
        list
          .map(r => {
            const w = wbToWidget(r, 0),
              label = r.composition
                ? r.type === 'textrace'
                  ? 'Composed · whole race'
                  : 'Composed · per lane'
                : (wbKinds.find(k => k[0] === r.type) || [0, ''])[1] +
                  (wbIsImage(r.type) ? ' · ' + (r.rules || []).length + ' rule(s)' : '');
            return `<div class="card lcard"><div class="lsketch lwidget wc-saved-preview">${Widgets.sampleOf(Widgets.def(r.type), 0, w)}</div><div class="lbody"><h3>${esc(r.name)}</h3><p class="muted">${esc(label)}</p></div><div class="lactions"><button class="btn" data-edit="${esc(r.id)}">Edit</button><button class="btn" data-dup="${esc(r.id)}">Duplicate</button><button class="btn danger" data-del="${esc(r.id)}">Delete</button></div></div>`;
          })
          .join('') +
        '</div>'
      : '<div class="lempty"><p class="muted">No widgets yet. Combine a driver identity, timing values and system indicators: start with a canvas widget, then make it your own.</p></div>');

  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.id === 'new-composer' && typeof WidgetStudio !== 'undefined') {
      wbEd = {
        id: null,
        draft: { name: 'New widget', type: 'textlane', w: 420, h: 240, composition: WidgetCompose.freeTemplate('blank') },
        dirty: true
      };
      return renderWidgetBuilder(box);
    }
    if (b.id === 'newwb') {
      wbEd = { id: null, draft: wbNew(), dirty: true };
      return renderWidgetBuilder(box);
    }
    const r = list.find(x => x.id === (b.dataset.edit || b.dataset.dup || b.dataset.del));
    if (!r) return;
    const own = () =>
      clone({
        name: r.name,
        type: r.type,
        text: r.text,
        image: r.image,
        fit: r.fit,
        rules: r.rules,
        w: r.w,
        h: r.h,
        textSize: r.textSize,
        valueBold: r.valueBold,
        valueItalic: r.valueItalic,
        composition: r.composition
      });
    if (b.dataset.edit) {
      wbEd = { id: r.id, draft: own(), dirty: false };
      return renderWidgetBuilder(box);
    }
    if (b.dataset.dup) {
      const d = own();
      d.name = r.name + ' (copy)';
      await api.add('customwidgets', d);
      return renderWidgetBuilder(box);
    }
    if (
      b.dataset.del &&
      (await Dialog.confirm(`Delete the widget "${r.name}"?\n\nLayouts that already use it keep their copy.\n\nThis can't be undone.`, {
        ok: 'Delete',
        danger: true
      }))
    ) {
      await api.remove('customwidgets', r.id);
      if (box.isConnected !== false) renderWidgetBuilder(box); // (the page may have been left while the question was open)
    }
  };
}

// (2.4.0) Widget Bench: what it is as four cards, the text with its variables sorted by subject, and on the right the widget itself on a sample
// race screen (1000 units wide, as a 16:9 layout), in the colour of the lane chosen
const WB_KIND_CARDS = {
  textlane: ['alignleft', 'Text per driver', 'One for each lane'],
  textrace: ['alignleft', 'Text for the race', 'Once on the screen'],
  imagelane: ['square', 'Picture per driver', 'Changes with rules'],
  imagerace: ['square', 'Picture for the race', 'Changes with rules']
};
const WB_VAR_GROUPS = [
  ['Driver', ['name', 'nickname', 'callsign', 'team', 'car', 'lane', 'driver', 'drivers']],
  ['Position', ['position', 'gap', 'champ', 'leader', 'interval', 'classpos']],
  ['Laps & times', ['lap', 'laps', 'laptime', 'last', 'best', 'avg', 'median', 'record', 'speed', 'speedreal', 'fastest', 'trackrecord']],
  ['Fuel & tyres', ['fuel', 'fuelpct', 'tyre', 'pits', 'pit', 'bop']],
  ['Penalties & damage', ['penpoints', 'pentime', 'damage', 'damagelevel', 'repairs', 'failure', 'failures']],
  ['Distance', ['distance', 'distleft', 'lapstogo']],
  ['Endurance', ['nextdriver', 'swap', 'stint']],
  ['Race', ['timeleft', 'elapsed', 'flag', 'weather', 'session', 'track', 'heat', 'heats', 'time', 'clock']]
];
const wbGroupOf = key => (WB_VAR_GROUPS.find(g => g[1].includes(key)) || ['More'])[0];
let wbVarCat = 'all',
  wbPrevLane = 0;
const WB_STAGE = { w: 1000, h: 562.5 };
function renderWidgetBuilderEditor(box) {
  box.onclick = box.onchange = box.oninput = null;
  const d = wbEd.draft,
    img = wbIsImage(d.type),
    vars = wbVars(d.type);
  if (img) {
    d.rules = d.rules || [];
    d.fit = d.fit || 'contain';
  }
  const prevWidget = () => {
    const w = Widgets.newWidget(d.type, 0, 0, 0);
    w.opt = img ? { image: d.image, fit: d.fit, rules: d.rules } : { text: d.text };
    w.valueBold = d.valueBold !== false;
    w.valueItalic = !!d.valueItalic;
    return w;
  };
  const preview = () => {
    const w = prevWidget(),
      lane = d.type === 'textlane' || d.type === 'imagelane' ? wbPrevLane : 0,
      cw = Math.max(Widgets.MIN, Math.min(WB_STAGE.w - 40, Number(d.w) || 300)),
      ch = Math.max(Widgets.MIN, Math.min(WB_STAGE.h - 40, Number(d.h) || 60)),
      colour = ['#2d6fc6', '#2f9e44', '#c98a12', '#8a4fd1'][lane];
    const ghosts =
      '<i class="wb-ghost" style="left:20px;top:20px;right:20px;height:70px"></i><i class="wb-ghost" style="right:20px;bottom:20px;width:300px;height:150px"></i><i class="wb-ghost" style="left:20px;right:340px;bottom:20px;height:80px"></i>';
    const body = img
      ? `<div class="wbprev" style="width:100%;height:100%">${Widgets.sampleOf(Widgets.def(d.type), lane, w)}</div>`
      : `<div class="wbprev" style="font-size:${Math.max(5, Number(d.textSize) || 30)}px;${Widgets.valueStyleOf(w)}">${Widgets.sampleOf(Widgets.def(d.type), lane, w)}</div>`;
    return `${ghosts}<div class="wb-widget${img ? ' pic' : ''}" style="left:40px;top:120px;width:${cw}px;height:${ch}px;--lane:${img ? 'transparent' : colour}">${body}</div><span class="wb-size">${esc(cw)} × ${esc(ch)}${img ? '' : ' · text ' + esc(d.textSize)}</span>`;
  };
  // the sample screen is 1000 wide and is scaled down to the width of the preview
  const fitStage = () => {
    const stage = typeof document !== 'undefined' && document.getElementById ? document.getElementById('wb-prev') : null,
      screen = stage && stage.parentElement;
    if (!stage || !screen || !screen.clientWidth) return;
    const k = screen.clientWidth / WB_STAGE.w;
    stage.style.transform = `scale(${k})`;
    screen.style.height = Math.ceil(WB_STAGE.h * k) + 'px';
  };
  const varSel = (cur, attr) =>
    `<select ${attr} aria-label="Variable">${vars.map(v => `<option value="${v[0]}"${v[0] === cur ? ' selected' : ''}>{${v[0]}} ${esc(v[1])}</option>`).join('')}</select>`;
  const pic = (src, attr, none) =>
    `${src ? `<img class="optimg" src="${esc(src)}" alt=""> ` : `<span class="muted">${none} </span>`}<input type="file" accept="image/*" ${attr}>${src ? ` <button class="btn" type="button" data-clr="${attr.replace(/^data-pic=/, '').replace(/"/g, '')}">Remove</button>` : ''}`;
  const groups = [...WB_VAR_GROUPS.map(g => g[0]), 'More'].filter(g => vars.some(v => wbGroupOf(v[0]) === g));
  if (wbVarCat !== 'all' && !groups.includes(wbVarCat)) wbVarCat = 'all';
  const textBody = `<section class="wb-fold"><header><strong>Text</strong><span>What should it say?</span></header><div class="wb-foldbody"><input id="wb-text" class="wb-textline" type="text" maxlength="200" value="${esc(d.text)}" aria-label="Text"><p class="wb-hint">Click a variable to put it where the cursor is. Type normal words around it.</p>
    <div class="wbvars"><nav class="wbv-cats" aria-label="Subjects"><input type="search" class="wbv-find" placeholder="Find a variable" aria-label="Find a variable"><button type="button" class="wbv-cat${wbVarCat === 'all' ? ' on' : ''}" data-wbcat="all">All</button>${groups
      .map(g => `<button type="button" class="wbv-cat${wbVarCat === g ? ' on' : ''}" data-wbcat="${esc(g)}">${esc(g)}</button>`)
      .join('')}</nav><div class="wbv-list">${vars
      .map(
        v =>
          `<button class="wbv" type="button" data-var="${v[0]}" data-cat="${esc(wbGroupOf(v[0]))}" title="${esc(v[1])}"${wbVarCat !== 'all' && wbGroupOf(v[0]) !== wbVarCat ? ' hidden' : ''}><code>{${v[0]}}</code><span>${esc(v[1])}</span></button>`
      )
      .join('')}</div></div></div></section>`;
  const imgBody =
    () => `<section class="wb-fold"><header><strong>Picture</strong><span>What it shows when no rule matches</span></header><div class="wb-foldbody"><div class="wb-picrow"><div class="inline">${pic(d.image, 'data-pic="fixed"', 'No picture yet')}</div><label class="wb-field">Fit<select id="wb-fit"><option value="contain"${d.fit === 'contain' ? ' selected' : ''}>Show the whole picture</option><option value="cover"${d.fit === 'cover' ? ' selected' : ''}>Fill the widget (may crop)</option></select></label></div></div></section>
    <section class="wb-fold"><header><strong>Rules</strong><span>The first rule that is true shows its picture</span></header><div class="wb-foldbody"><p class="wb-hint">Numbers are compared as numbers (position, lap, fuel %…); words without capitals (flag, name…).</p>
    <div id="wb-rules">${
      d.rules
        .map(
          (r, i) => `<div class="row wb-rule" data-rule="${i}"><span class="wb-if">If</span>${varSel(r.var, `data-rv="${i}"`)}
      <select data-ro="${i}" aria-label="Comparison">${Widgets.IMG_OPS.map(o => `<option value="${esc(o[0])}"${o[0] === (r.op || '=') ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select>
      <input type="text" data-rval="${i}" value="${esc(r.value)}" placeholder="value" aria-label="Value"><span class="wb-if">show</span><span class="wb-rulepic">${pic(r.image, `data-pic="${i}"`, 'no picture')}</span>
      <button class="btn danger sm" type="button" data-rdel="${i}">Remove rule</button></div>`
        )
        .join('') || '<p class="muted">No rules yet.</p>'
    }</div>
    <div class="row"><button class="btn ghost" type="button" id="wb-addrule">Add a rule</button></div></div></section>`;
  const kinds = `<fieldset id="wb-type" class="wb-kinds"><legend>What is it?</legend><div class="wb-kgrid">${wbKinds
    .map(([k]) => {
      const [icon, title, sub] = WB_KIND_CARDS[k];
      return `<label class="wb-kind${k === d.type ? ' on' : ''}"><input type="radio" name="wb-kind" value="${k}"${k === d.type ? ' checked' : ''}><span class="wb-kico">${typeof Icons !== 'undefined' ? Icons.svg(icon, { size: 16, stroke: 1.8 }) : ''}</span><b>${esc(title)}</b><small>${esc(sub)}</small></label>`;
    })
    .join('')}</div></fieldset>`;
  const sizeBody = `<section class="wb-fold"><header><strong>Size${img ? '' : ' and type'}</strong><span>How big${img ? '' : ', how bold'}</span></header><div class="wb-foldbody"><div class="wb-sizes"><label class="wb-field">Width<input id="wb-w" type="number" min="${Widgets.MIN}" max="1000" step="5" value="${esc(d.w)}"></label><label class="wb-field">Height<input id="wb-h" type="number" min="${Widgets.MIN}" max="1000" step="5" value="${esc(d.h)}"></label>${
    img
      ? ''
      : `<label class="wb-field">Text size<input id="wb-size" type="number" min="5" max="200" step="1" value="${esc(d.textSize)}"></label><div class="wb-field">Style<span class="wb-styles"><label class="inline"><input type="checkbox" id="wb-bold" ${d.valueBold !== false ? 'checked' : ''}> Bold</label><label class="inline"><input type="checkbox" id="wb-italic" ${d.valueItalic ? 'checked' : ''}> Italic</label></span></div>`
  }</div></div></section>`;
  const lanes = d.type === 'textlane' || d.type === 'imagelane';
  box.innerHTML = `<div class="wb-bench">${pitBoard({
    cls: 'wb-pitboard',
    back: 'Widgets',
    backId: 'wb-back',
    eyebrow: 'Simple widget · ' + (img ? 'picture' : 'text'),
    name: `<input type="text" class="pb-name" id="wb-name" maxlength="60" value="${esc(d.name)}" placeholder="Name your widget" aria-label="Name">`,
    msgId: 'wb-msg',
    undoId: 'wb-undo',
    redoId: 'wb-redo',
    saveId: 'wb-save',
    save: 'Save widget'
  })}<div class="wb-cols"><div class="wb-set">${kinds}${img ? imgBody() : textBody}${sizeBody}</div>
    <aside class="wb-preview" aria-label="Preview"><header><strong>On the race screen</strong>${
      lanes
        ? `<span class="seg" role="group" aria-label="Sample lane">${[0, 1, 2, 3].map(i => `<button type="button" class="btn${i === wbPrevLane ? ' on' : ''}" aria-pressed="${i === wbPrevLane}" data-wblane="${i}">Lane ${i + 1}</button>`).join('')}</span>`
        : ''
    }</header><div class="wb-screen"><div class="wb-stage" id="wb-prev">${preview()}</div></div><p class="wb-hint">${
      img ? 'The fixed picture, or the picture of the first rule that is true, with sample values.' : 'With sample values.'
    } The grey boxes stand for the rest of a layout, so you see how big your widget is. Colours and the exact place are set in the Layout Editor.</p></aside></div></div>`;
  const $ = id => document.getElementById(id),
    show = () => {
      $('wb-prev').innerHTML = preview();
      fitStage();
    };
  fitStage();
  if (typeof ResizeObserver !== 'undefined' && $('wb-prev')?.parentElement) {
    const ro = new ResizeObserver(() => ($('wb-prev') ? fitStage() : ro.disconnect()));
    ro.observe($('wb-prev').parentElement);
  }
  // the lane of the sample, and the subjects and the search of the variables (they only show and hide; nothing in the widget changes)
  box._wbShow = show;
  if (!box._wbLane && box.addEventListener) {
    box._wbLane = true; // (the box stays while the editor is drawn again: one listener, which calls the latest preview)
    box.addEventListener('click', ev => {
      const l = ev.target.closest?.('[data-wblane]');
      if (!l || !box._wbShow) return;
      wbPrevLane = Number(l.dataset.wblane) || 0;
      box.querySelectorAll('[data-wblane]').forEach(x => {
        x.classList.toggle('on', x === l);
        x.setAttribute('aria-pressed', String(x === l));
      });
      box._wbShow();
    });
  }
  const find = box.querySelector?.('.wbv-find');
  const filterVars = () => {
    const q = String(find?.value || '')
      .trim()
      .toLowerCase();
    box.querySelectorAll('.wbv').forEach(x => {
      const inCat = wbVarCat === 'all' || x.dataset.cat === wbVarCat,
        hit =
          !q ||
          String(x.textContent || '')
            .toLowerCase()
            .includes(q);
      x.hidden = q ? !hit : !inCat;
    });
  };
  if (find) find.oninput = filterVars;
  pbWatch(box, () => wbEd && wbEd.dirty);
  const msg = t => {
    $('wb-msg').textContent = t;
  };
  // Undo and redo (typing is one step after a quiet moment; every other change is a step of its own)
  const U = draftUndo(wbEd, 'wb', () => renderWidgetBuilderEditor(box)),
    mark = U.mark,
    step = U.step;
  const set = (k, v, typing) => {
    d[k] = v;
    (typing ? mark : step)();
    show();
  };
  $('wb-name').oninput = e => {
    d.name = e.target.value;
    mark();
  };
  $('wb-type').onchange = e => {
    const was = d.type;
    if (!e.target.value || e.target.value === was) return;
    d.type = e.target.value;
    if (!wbIsImage(was) && !wbIsImage(d.type) && d.text === (was === 'textrace' ? Widgets.TEXT_RACE_DEFAULT : Widgets.TEXT_LANE_DEFAULT))
      d.text = d.type === 'textrace' ? Widgets.TEXT_RACE_DEFAULT : Widgets.TEXT_LANE_DEFAULT;
    if (wbIsImage(d.type)) {
      const ok = wbVars(d.type).map(v => v[0]);
      d.rules = (d.rules || []).filter(r => ok.includes(r.var));
    } // rules that use a variable the new kind does not have are dropped
    if (!d.text) d.text = d.type === 'textrace' ? Widgets.TEXT_RACE_DEFAULT : Widgets.TEXT_LANE_DEFAULT;
    step();
    renderWidgetBuilderEditor(box);
  };
  $('wb-w').onchange = e => set('w', Number(e.target.value));
  $('wb-h').onchange = e => set('h', Number(e.target.value));
  if (!img) {
    $('wb-text').oninput = e => set('text', e.target.value, true);
    $('wb-size').onchange = e => set('textSize', Number(e.target.value));
    $('wb-bold').onchange = e => set('valueBold', !!e.target.checked);
    $('wb-italic').onchange = e => set('valueItalic', !!e.target.checked);
    box.querySelector('.wbvars').onclick = ev => {
      const c = ev.target.closest('[data-wbcat]');
      if (c) {
        wbVarCat = c.dataset.wbcat;
        box.querySelectorAll('[data-wbcat]').forEach(x => x.classList.toggle('on', x === c));
        if (find) find.value = '';
        return filterVars();
      }
      const b = ev.target.closest('[data-var]');
      if (!b) return;
      const t = $('wb-text'),
        a = t.selectionStart ?? t.value.length,
        z = t.selectionEnd ?? a,
        ins = '{' + b.dataset.var + '}';
      t.value = t.value.slice(0, a) + ins + t.value.slice(z);
      t.focus();
      try {
        t.setSelectionRange(a + ins.length, a + ins.length);
      } catch (x) {
        /* not a text box */
      }
      set('text', t.value);
    };
  } else {
    $('wb-fit').onchange = e => set('fit', e.target.value);
    $('wb-addrule').onclick = () => {
      d.rules.push({ var: vars[0][0], op: '=', value: '', image: '' });
      step();
      renderWidgetBuilderEditor(box);
    };
    box.onchange = async ev => {
      const t = ev.target,
        ds = t.dataset || {};
      if (ds.rv !== undefined) return set('rules', ((d.rules[Number(ds.rv)].var = t.value), d.rules));
      if (ds.ro !== undefined) return set('rules', ((d.rules[Number(ds.ro)].op = t.value), d.rules));
      if (ds.rval !== undefined) return set('rules', ((d.rules[Number(ds.rval)].value = t.value), d.rules));
      if (ds.pic !== undefined && t.files && t.files[0]) {
        try {
          const data = await resizeImage(t.files[0], 512, true);
          if (ds.pic === 'fixed') d.image = data;
          else d.rules[Number(ds.pic)].image = data;
          step();
          renderWidgetBuilderEditor(box);
        } catch (x) {
          msg(x.message || 'Could not read that picture.');
        }
      }
    };
    box.oninput = ev => {
      const ds = (ev.target && ev.target.dataset) || {};
      if (ds.rval !== undefined) {
        d.rules[Number(ds.rval)].value = ev.target.value;
        mark();
        show();
      }
    };
    box.onclick = ev => {
      const b = ev.target.closest('button');
      if (!b) return;
      const ds = b.dataset || {};
      if (ds.rdel !== undefined) {
        d.rules.splice(Number(ds.rdel), 1);
        step();
        return renderWidgetBuilderEditor(box);
      }
      if (ds.clr !== undefined) {
        if (ds.clr === 'fixed') d.image = '';
        else d.rules[Number(ds.clr)].image = '';
        step();
        return renderWidgetBuilderEditor(box);
      }
    };
  }
  $('wb-back').onclick = async () => {
    if (
      wbEd.dirty &&
      !(await Dialog.confirm('Discard your unsaved changes to this widget?', {
        ok: 'Discard changes',
        cancel: 'Keep editing',
        danger: true
      }))
    )
      return;
    if (!wbEd || wbEd.draft !== d) return; // (the widget was left while the question was open)
    draftUndoEnd(wbEd);
    wbEd = null;
    renderWidgetBuilder(box);
  };
  let saving = false; // (a second click while the first is being written would add the widget twice)
  $('wb-save').onclick = async () => {
    if (saving) return;
    if (!String(d.name).trim()) return msg('Give the widget a name.');
    saving = true;
    try {
      const token = U.hist.commit(),
        data = clone({ ...d, name: String(d.name).trim() }); // (the state that is written is the one the steps call saved)
      if (wbEd.id) await api.update('customwidgets', wbEd.id, data);
      else {
        const row = await api.add('customwidgets', data);
        wbEd.id = row.id;
      }
      U.hist.markSaved(token);
      wbEd.dirty = !U.hist.isClean();
      msg('Saved.'); // (a change made while it was being written is not saved yet)
    } finally {
      saving = false;
    }
  };
}
