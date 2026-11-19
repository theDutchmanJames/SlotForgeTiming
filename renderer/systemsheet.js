// (2.4.0) The System Sheet: the editor of a race system, a race setup, a championship or a rotation (the frame of railform.js) set as one calm page, like a Settings Sheet.
// - Every section is open and stays open, one under the other; the rail is a table of contents: a click scrolls to the section, and while the page scrolls the rail shows where you are.
// - The sentence "In plain words" goes into a Page Note at the top: what the thing is (editor.js, SETUP_NOTES), what it does now (the live sentence), and where you use it.
// - Every field becomes a slim two-half row: the name and one line on the left, the control on the right (the app's own buttons, switches and number boxes, restyled).
// Only the real page is changed, after the frame is drawn: the elements keep their ids, data-key and handlers, so the code of the forms and the tests (which read the markup) stay as they are.
const SystemSheet = (() => {
  // the colour class of a frame -> the words of its Page Note (editor.js, SETUP_NOTES)
  const NOTE = {
    race: 'racesetups',
    pen: 'penalties',
    dmg: 'damage',
    tyre: 'tyrewear',
    sc: 'safetycar',
    ps: 'pushsave',
    wx: 'weather',
    fuel: 'fuel',
    bop: 'bop',
    ch: 'championships',
    mc: 'multiclass',
    resource: 'resources',
    rot: 'rotation',
    tok: 'tokens',
    vr: 'virtualrivals'
  };
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const esc = s =>
    String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  const txt = n => (n ? n.textContent.replace(/\s+/g, ' ').trim() : '');
  const kindOf = form => {
    const m = /\bss-([a-z]+)\b/.exec(form.className);
    return m ? m[1] : '';
  };

  // ---- the Page Note ----
  function note(form) {
    const say = form.querySelector('#rssay');
    if (!say || say.closest('.sn')) return;
    // (on a Race Setup page that has its own Page Note above the editor, the note in the editor only says what the settings do now)
    const twice = !!(form.closest('.setuppage') && document.getElementById('setupnote')) && !form.classList.contains('sy-pop');
    const words = !twice && typeof SETUP_NOTES !== 'undefined' ? SETUP_NOTES[NOTE[kindOf(form)]] : null;
    const tile = form.querySelector('#rstile');
    const box = el('div', 'sn sy-note');
    box.append(el('span', 'sn-tile', tile && !twice ? tile.innerHTML : ''));
    if (words && words[0]) box.append(el('p', 'sn-lead', esc(words[0])));
    say.classList.add('sn-more');
    say.before(box);
    box.append(say);
    if (words && words[2]) box.append(el('p', 'sn-use', `<span>${esc(words[2])}</span>`));
  }

  // ---- a field as a row ----
  const unitOf = f => {
    const u = f.querySelector('.inunit > span');
    return u ? txt(u) : '';
  };
  function rowOf(f) {
    if (f.dataset.sy) return;
    f.dataset.sy = '1';
    // a table, a list, a picture: the name over it, the thing at full width
    if (f.matches('.listfield') || f.querySelector('table,.rsstrip,canvas,.twtable,.fu-cards,.fu-card,[class*="grid"]:not(.fgrid)')) {
      f.classList.add('sy-row', 'sy-stack');
      return;
    }
    const t = el('div', 'ss-t'),
      c = el('div', 'ss-ctl');
    const hint = [...f.querySelectorAll(':scope > .hint, :scope > span.muted.hint, :scope > p.hint')].slice(0, 1);
    // a switch of the app: its name and words come out of the button, the button keeps the switch
    const sw = f.querySelector(':scope > .fu-sw');
    if (sw) {
      const b = sw.querySelector('.fu-swt > b'),
        h = sw.querySelector('.fu-swt > .hint');
      if (b) t.append(b);
      if (h) t.append(h);
      const swt = sw.querySelector('.fu-swt');
      if (swt && !txt(swt)) swt.remove();
      c.append(sw);
    } else {
      // the name: a label, or the question of a segmented choice
      const lab = f.querySelector(':scope > label, :scope > .fu-q');
      if (lab && !lab.querySelector('input,select,textarea')) {
        // (a name and its short line, written as 'Amber · life left when the widgets turn amber')
        const [name, line] = txt(lab).split(' · ');
        const b = el('b', '', esc(name));
        if (line) t.append(b, el('span', 'ss-desc', esc(line[0].toUpperCase() + line.slice(1))));
        if (lab.id) {
          b.id = lab.id;
          lab.removeAttribute('id');
        }
        if (lab.htmlFor) b.dataset.for = lab.htmlFor;
        lab.classList.add('sy-gone');
        if (!line) t.append(b);
      }
      // the control: the app's segmented buttons, a number with its unit, a list, a text
      const seg = f.querySelector(':scope > .fu-seg');
      if (seg) c.append(seg);
      const iu = f.querySelector(':scope > .inunit');
      if (iu) {
        const inp = iu.querySelector('input');
        const u = unitOf(f);
        if (inp && inp.type === 'number' && typeof SettingsSheet !== 'undefined') {
          c.append(SettingsSheet.kit(inp, u));
          iu.remove();
        } else c.append(iu);
      }
      [...f.children].forEach(x => {
        if (x === t || x === c || x.classList.contains('sy-gone') || hint.includes(x)) return;
        if (x.matches('input[type=checkbox]:not([hidden]),input[type=number]:not([hidden])') && typeof SettingsSheet !== 'undefined')
          c.append(SettingsSheet.kit(x));
        else if (x.matches('input:not([type=hidden]):not([hidden]),select:not([hidden]),textarea,button,.btn,.fu-seg,.inunit,output'))
          c.append(x);
      });
      // (a label that holds its control: its own words, the text beside the control, are the name)
      if (!t.querySelector('b')) {
        const own = [...f.childNodes].filter(
          n =>
            (n.nodeType === 3 && n.textContent.trim()) ||
            (n.nodeType === 1 && n.matches('span:not(.hint):not(.muted):not(.inunit),strong,b') && !n.querySelector('input,select'))
        );
        const name = own
          .map(n => n.textContent)
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
        if (name) {
          const [nm, line] = name.split(' · ');
          t.prepend(el('b', '', esc(nm)));
          if (line) t.querySelector('b').after(el('span', 'ss-desc', esc(line)));
          own.forEach(n => n.remove());
        }
      }
    }
    hint.forEach(h => {
      h.classList.add('ss-hint');
      t.append(h);
    });
    // (2.4.0) what is left of a field the form draws itself: its words go with the name, a box of its own (the system switches of a race setup) is the
    // control across the whole row. Left where it was, it took the row's first column and squeezed the name to nothing.
    [...f.children].forEach(x => {
      if (x === t || x === c || x.classList.contains('sy-gone') || x.matches('input[type=hidden]')) return;
      if (x.matches('small.muted,small.hint,span.muted,p.muted')) {
        x.classList.add('ss-hint');
        t.append(x);
      } else if (x.matches('div,fieldset,table') && !x.closest('.ss-t,.ss-ctl')) {
        c.append(x);
        f.classList.add('sy-wide');
      }
    });
    if (!t.childNodes.length && !c.childNodes.length) {
      f.classList.add('sy-row', 'sy-stack');
      return;
    }
    f.classList.add('ss-row', 'sy-row');
    if (c.querySelector('textarea')) f.classList.add('sy-wide');
    f.prepend(t, c);
    f.querySelectorAll(':scope > .sy-gone').forEach(x => (x.hidden = true));
  }
  function sheet(grid) {
    if (!grid) return;
    grid.classList.add('ss-sheet', 'sy-sheet');
    [...grid.children].forEach(f => f.matches('.field') && rowOf(f));
    // (a field inside a box of its own in the sheet, which the form shows and hides)
    grid.querySelectorAll(':scope > div:not(.field) > .field').forEach(rowOf);
  }

  // a label with a checkbox, loose in a section: a row of a sheet (the one just before it, or one of its own)
  function loose(d) {
    [
      ...d.querySelectorAll(
        ':scope > .field, :scope > label.inline, :scope > label:has(> input[type=checkbox]), :scope > .rssub > .field, :scope > .rssub > label.inline'
      )
    ].forEach(l => {
      if (l.dataset.sy) return;
      let sh = l.previousElementSibling;
      if (!sh || !sh.classList.contains('sy-sheet')) {
        sh = el('div', 'fgrid ss-sheet sy-sheet');
        l.before(sh);
      }
      l.classList.add('field');
      sh.append(l);
      rowOf(l);
    });
    d.querySelectorAll(':scope > p.muted, :scope > .rssub > p.muted').forEach(p => p.classList.add('sy-words'));
    // any other checkbox in the section (on a card, in a box of its own): the kit's switch, where it is
    d.querySelectorAll('label > input[type=checkbox]').forEach(cb => {
      if (cb.closest('.sy-row') || cb.classList.contains('ss-switch')) return;
      cb.classList.add('ss-switch');
      cb.parentElement.classList.add('sy-swlabel');
    });
    // a box of the form's own with settings in it: a sheet too; a slider beside a number box gives way to the number
    d.querySelectorAll(':scope > div, :scope > .rssub > div').forEach(box => {
      if (box.matches('.fgrid,.sy-sheet,.rsnote,.rsstrip,[class*="choice"],[class*="card"],[class*="grid"],[class*="list"]')) return;
      const fields = [...box.querySelectorAll(':scope > label.field, :scope > .field')];
      if (!fields.length) return;
      box.classList.add('fgrid', 'ss-sheet', 'sy-sheet', 'sy-box');
      box.querySelectorAll(':scope > label:not(.field)').forEach(l => {
        if (l.querySelector('input[type=range]') && box.querySelector('input[type=number]')) l.hidden = true;
      });
      fields.forEach(rowOf);
      box.querySelectorAll(':scope > p').forEach(p => p.classList.add('sy-boxwords'));
    });
  }
  // a grid of tiles that each hold one number (Resource: the sets of every tyre): rows of a sheet, the tyre's colour as a dot, the number as the stepper
  function tiles(d) {
    d.querySelectorAll('[class*="grid"]:not(.fgrid):not(.sy-sheet)').forEach(g => {
      const kids = [...g.children];
      if (
        g.dataset.syTiles ||
        kids.length < 2 ||
        !kids.every(c => c.matches('label') && c.querySelectorAll('input[type=number]').length === 1)
      )
        return;
      g.dataset.syTiles = '1';
      g.classList.add('sy-tilelist');
      kids.forEach(c => {
        const inp = c.querySelector('input[type=number]');
        const t = el('span', 'sy-tilet');
        [...c.childNodes].filter(n => n !== inp && !(n.nodeType === 1 && n.contains(inp))).forEach(n => t.append(n));
        c.classList.add('sy-tile');
        c.append(t, typeof SettingsSheet !== 'undefined' ? SettingsSheet.kit(inp) : inp);
      });
    });
  }
  // a long explanation shows two lines and a More; the whole text stays (for a search and a screen reader), More opens it
  const LONG = 150;
  function more(d) {
    d.querySelectorAll('.sy-words, .sy-boxwords, .fgrid.sy-sheet > p, .fgrid.sy-sheet > .hint, .sy-row > .ss-t > .hint').forEach(p => {
      if (p.dataset.syMore || p.closest('.rsnote') || txt(p).length < LONG) return;
      p.dataset.syMore = '1';
      p.classList.add('sy-clamp');
      const b = el('button', 'sy-more', 'More');
      b.type = 'button';
      b.setAttribute('aria-expanded', 'false');
      b.onclick = () => {
        const open = p.classList.toggle('open');
        b.textContent = open ? 'Less' : 'More';
        b.setAttribute('aria-expanded', String(open));
      };
      p.after(b);
    });
  }
  // ---- the sections: open, one under the other ----
  function sections(form) {
    form.querySelectorAll('details.rssec').forEach(d => {
      if (d.dataset.sy) return;
      d.dataset.sy = '1';
      if (!d.open) d.open = true;
      const sum = d.querySelector(':scope > summary');
      if (sum) {
        sum.tabIndex = -1;
        sum.addEventListener('click', ev => ev.preventDefault());
      }
      d.addEventListener('toggle', () => {
        if (!d.open) d.open = true;
      });
      d.querySelectorAll('.fgrid').forEach(sheet);
      loose(d);
      tiles(d);
      more(d);
    });
  }

  // ---- the rail: a table of contents that follows the scroll ----
  const scroller = n => {
    for (let p = n && n.parentElement; p; p = p.parentElement) {
      const o = getComputedStyle(p).overflowY;
      if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) return p;
    }
    return document.scrollingElement;
  };
  function follow(form) {
    if (form.dataset.syFollow) return;
    const first = form.querySelector('details.rssec');
    if (!first) return;
    form.dataset.syFollow = '1';
    const sc = scroller(first);
    const target = sc === document.scrollingElement ? window : sc;
    let raf = 0;
    const mark = () => {
      raf = 0;
      if (!form.isConnected) return target.removeEventListener('scroll', onScroll);
      const top = sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top;
      const secs = [...form.querySelectorAll('details.rssec')].filter(s => !s.hidden);
      let cur = secs[0];
      secs.forEach(s => {
        if (s.getBoundingClientRect().top - top < 140) cur = s;
      });
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4 && secs.length) cur = secs[secs.length - 1];
      form.querySelectorAll('.rsri').forEach(r => r.classList.toggle('sy-on', !!cur && r.dataset.rail === cur.dataset.fg));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(mark);
    };
    target.addEventListener('scroll', onScroll, { passive: true });
    // a click on the rail: the form scrolls there itself; mark it at once
    form.addEventListener('click', ev => {
      const r = ev.target.closest && ev.target.closest('.rsri');
      if (!r) return;
      form.querySelectorAll('.rsri').forEach(x => x.classList.toggle('sy-on', x === r));
    });
    requestAnimationFrame(mark);
  }

  // ---- an editor that opens from a list on a page (Virtual Rival, Multi-Class, Resource, Championship, Rotation): a window over the page ----
  // (it stays where the page draws it, so its code is unchanged; Back closes it, and so does Escape)
  const backOf = form => form.querySelector('.rsfoot [id$="-back"]');
  function pop(form) {
    if (!form.matches('.rspage') || form.dataset.syLaunch || !backOf(form) || form.classList.contains('sy-pop')) return;
    form.classList.add('sy-pop');
    const prev = form.previousElementSibling;
    if (!prev || !prev.classList.contains('sy-backdrop')) form.before(el('div', 'sy-backdrop'));
  }
  // ---- an editor that is the whole page (Balance of Power, Time Tokens): a card on the page with what is set now, and the editor as a window ----
  // (their settings are saved as you change them, so Done only closes the window; the window stays open when the editor draws itself again)
  let openKind = '';
  function launcher(form) {
    if (!form.matches('.rspage') || form.dataset.syLaunch || backOf(form)) return;
    const kind = kindOf(form) || 'page';
    form.dataset.syLaunch = kind;
    const head = form.querySelector('.rshd'),
      title = head && head.querySelector('.rstitle');
    const nameEl = title && [...title.children].find(c => !c.matches('.rseye,.rspills,#rshead'));
    const eye = txt(head && head.querySelector('.rseye')),
      name = txt(nameEl),
      tile = (head && head.querySelector('#rstile') && head.querySelector('#rstile').innerHTML) || '';
    const foot = form.querySelector('.rsfoot');
    const done = el('button', 'btn primary', 'Done');
    done.type = 'button';
    done.id = 'sy-close-back';
    if (foot) foot.append(done);
    const card = el('section', 'sy-launch');
    card.setAttribute('aria-label', name || eye);
    const draw = () => {
      const state = txt(head && head.querySelector('.rsready'));
      const items = [...form.querySelectorAll('.rsri')].filter(r => !r.hidden);
      card.innerHTML =
        `<div class="sy-lhead"><span class="sy-ltile">${tile}</span><div class="sy-ltitle"><span class="sy-leye">${esc(eye)}</span><b class="sy-lname">${esc(name)}</b></div>` +
        (state ? `<span class="sy-lstate">${esc(state)}</span>` : '') +
        '<button type="button" class="btn primary sy-lopen">Open settings</button></div>' +
        `<div class="sy-lrows">${items
          .map(
            r =>
              `<button type="button" class="sy-lrow" data-go="${esc(r.dataset.rail)}"><b>${esc(txt(r.querySelector('b')))}</b><span>${esc(txt(r.querySelector('small')))}</span></button>`
          )
          .join('')}</div>`;
      card.querySelector('.sy-lopen').onclick = () => open();
      card.querySelectorAll('.sy-lrow').forEach(b => (b.onclick = () => open(b.dataset.go)));
    };
    const open = go => {
      openKind = kind;
      form.hidden = false;
      form.classList.add('sy-pop');
      if (!form.previousElementSibling || !form.previousElementSibling.classList.contains('sy-backdrop'))
        form.before(el('div', 'sy-backdrop'));
      follow(form);
      const r = go && form.querySelector('#rs-rail-' + go);
      if (r) r.click();
    };
    const close = () => {
      openKind = '';
      form.classList.remove('sy-pop');
      form.hidden = true;
      const b = form.previousElementSibling;
      if (b && b.classList.contains('sy-backdrop')) b.remove();
      draw();
      const o = card.querySelector('.sy-lopen');
      if (o) o.focus();
    };
    done.onclick = close;
    form.before(card);
    form.hidden = true;
    draw();
    if (openKind === kind) open();
  }
  function enhance(form) {
    if (!form || !form.isConnected) return;
    form.classList.add('sy');
    launcher(form);
    pop(form);
    note(form);
    sections(form);
    if (!form.hidden) follow(form);
    // a section that draws its settings again later gets its rows again
    if (!form.dataset.syWatch) {
      form.dataset.syWatch = '1';
      let pending = false;
      new MutationObserver(() => {
        if (pending) return;
        pending = true;
        queueMicrotask(() => {
          pending = false;
          if (!form.isConnected) return;
          sections(form);
          form.querySelectorAll('details.rssec .fgrid').forEach(g => {
            if (!g.classList.contains('sy-sheet') || [...g.children].some(f => f.matches('.field') && !f.dataset.sy)) sheet(g);
          });
        });
      }).observe(form, { childList: true, subtree: true });
    }
  }
  // every frame that is drawn, wherever it is (a window or a page)
  function start() {
    if (typeof MutationObserver === 'undefined' || typeof document === 'undefined' || !document.body) return;
    let pending = false;
    const scan = () => {
      pending = false;
      document.querySelectorAll('.rsform:not(.sy)').forEach(enhance);
      // (a page editor that is gone, the page left: its window is not open the next time)
      if (openKind && !document.querySelector('.rsform[data-sy-launch="' + openKind + '"]')) openKind = '';
      // (a card whose editor was drawn again is drawn again with it)
      document.querySelectorAll('.sy-launch').forEach(c => {
        const n = c.nextElementSibling;
        if (!n || !n.matches('.rsform, .sy-backdrop')) c.remove();
      });
      // (a window that was closed leaves no shade behind)
      document.querySelectorAll('.sy-backdrop').forEach(b => {
        const n = b.nextElementSibling;
        if (!n || !n.classList.contains('sy-pop')) b.remove();
      });
    };
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'Escape' || ev.defaultPrevented || document.querySelector('dialog[open]')) return;
      const f = [...document.querySelectorAll('.rsform.sy-pop')].pop();
      const b = f && backOf(f);
      if (b && !b.disabled) {
        ev.preventDefault();
        b.click();
      }
    });
    // (in the same turn, before the page is painted, so the old look never shows; one check for a batch of changes)
    new MutationObserver(() => {
      if (pending || (typeof state !== 'undefined' && state.tab === 'race')) return; // (2.4.0: no editor on the race screen, which redraws all the time)
      pending = true;
      queueMicrotask(scan);
    }).observe(document.body, { childList: true, subtree: true });
    scan();
  }
  if (typeof document !== 'undefined' && document.readyState !== 'loading') start();
  else if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', start);
  return { enhance, rowOf, NOTE };
})();
