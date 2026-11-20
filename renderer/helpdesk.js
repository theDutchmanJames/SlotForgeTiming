// (2.4.0, SlotForgeRestyle.md "Help Desk") Help where you are: a "?" beside the title of every page and F1 open the article of that page in a drawer on
// the right (the page stays as it is), with its own search, Before / Next, Open in Help. A short note at the top of a page gets "Read more in Help".
// Help (help.js, helpview.js) keeps the articles; this file keeps what you read lately, the figures of your first race, and the drawer.
const HelpDesk = (() => {
  const RECENT_KEY = 'sf-help-recent';
  let box = null,
    view = null,
    progressAt = 0,
    progressP = null;
  const HV = () => (typeof HelpView !== 'undefined' ? HelpView : null);
  // ---- what you read lately (this computer only; nothing breaks without it) ----
  function recent() {
    try {
      const v = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(v) ? v.filter(x => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  function read(id) {
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 6)));
    } catch {
      /* (no storage: no list) */
    }
  }
  // the settings that match a search of Help: they open where they are
  function settings(q) {
    if (typeof SettingsIndex === 'undefined' || !String(q || '').trim()) return [];
    return SettingsIndex.search(q, 6).map(e => ({
      ...e,
      where: e.where || (SettingsIndex.where ? SettingsIndex.where(e) : 'App Settings')
    }));
  }
  // the figures of the first race: tracks, drivers, cars, setups, races (read again after half a minute)
  function progress() {
    if (progressP && Date.now() - progressAt < 30000) return progressP;
    progressAt = Date.now();
    const n = e =>
      typeof api !== 'undefined' && api.list
        ? Promise.resolve(api.list(e))
            .then(l => (Array.isArray(l) ? l.length : 0))
            .catch(() => 0)
        : Promise.resolve(0);
    progressP = Promise.all(['tracks', 'drivers', 'slotcars', 'racesetups', 'sessions'].map(n)).then(
      ([tracks, drivers, cars, setups, races]) => ({
        tracks,
        drivers,
        cars,
        setups,
        races
      })
    );
    return progressP;
  }
  // the article of the page that is open (a dialog of its own first)
  const DIALOG_HELP = [
    ['.chadj-dlg', 'championshippoints'],
    ['.lc-head', 'hardware'],
    ['#st-title', 'hardware']
  ];
  function topicNow() {
    const dlg =
      typeof document !== 'undefined'
        ? [...document.querySelectorAll('dialog[open]')].filter(d => !d.classList.contains('hlp-drawer')).pop()
        : null;
    if (dlg) {
      const hit = DIALOG_HELP.find(([sel]) => (dlg.matches && dlg.matches(sel)) || dlg.querySelector(sel));
      if (hit) return hit[1];
    }
    return HV() && typeof state !== 'undefined' ? HV().topicOfPage(state) : '';
  }
  const go = async dest => {
    if (typeof MainBar !== 'undefined' && MainBar.leave && !(await MainBar.leave())) return; // (unsaved layout changes are asked about first)
    Object.assign(state, dest);
    await render();
  };
  // ---- the drawer ----
  function open(topic = topicNow()) {
    if (typeof Help === 'undefined' || !HV()) return;
    if (!box) {
      box = document.createElement('dialog');
      box.className = 'hlp-drawer';
      box.setAttribute('aria-label', 'Help');
      document.body.append(box);
      box.addEventListener('cancel', ev => {
        ev.preventDefault();
        close();
      });
      view = HV().create({
        folders: Help.folders,
        WELCOME: Help.WELCOME,
        tones: Help.tones,
        recent,
        read,
        settings
      });
    }
    view.state.drawer = true;
    view.state.page = HV().topicOfPage(typeof state !== 'undefined' ? state : null);
    view.state.query = '';
    // over a form the page must stay as it is: the drawer has no page buttons then
    const modal = [...document.querySelectorAll('dialog[open]')].some(d => d !== box && d.matches(':modal'));
    view.state.locked = modal;
    if (!topic || !view.select(topic)) view.select('help-home');
    const draw = () =>
      view.render(box, {
        progress: progress(),
        onClose: close,
        onFull: id => full(id),
        onNavigate: async dest => {
          if (view.state.locked) return; // (over a form: the page stays)
          await go(dest);
          view.state.page = HV().topicOfPage(state);
          draw();
        },
        onSetting: async e => {
          if (view.state.locked) return;
          close();
          await go({ tab: 'settings' });
          if (typeof settingsGo === 'function') settingsGo(e);
        }
      });
    draw();
    // over a dialog that is open (a form) the drawer must be in the top layer too; otherwise the page stays usable beside it
    if (box.open) box.close();
    if (modal) box.showModal();
    else box.show();
    document.body.classList.add('hlp-on');
    const h = box.querySelector('#help-reader h3');
    if (h) h.focus({ preventScroll: true });
    else box.querySelector('[data-help-search]')?.focus();
  }
  function close() {
    if (!box || !box.open) return;
    box.close();
    document.body.classList.remove('hlp-on');
  }
  const isOpen = () => !!(box && box.open);
  // Open in Help: the article in App Settings, Help
  async function full(id) {
    close();
    if (typeof Help !== 'undefined' && id) Help.view().select(id);
    await go({ tab: 'settings', settingsSub: 'help' });
  }
  // ---- the "?" beside the page title, and "Read more in Help" under a page note ----
  function decorate() {
    if (typeof document === 'undefined' || !HV() || typeof state === 'undefined' || ['home', 'live', 'race'].includes(state.tab)) return;
    if (state.tab === 'settings' && state.settingsSub === 'help') return;
    const id = HV().topicOfPage(state);
    if (!id) return;
    const title = document.querySelector('#view h2');
    if (title && title.dataset.hlpTopic !== id) {
      title.querySelector('.hlp-q')?.remove();
      title.dataset.hlpTopic = id;
      title.insertAdjacentHTML(
        'beforeend',
        `<button type="button" class="hlp-q" data-hlp-open="${id}" title="Help for this page (F1)" aria-label="Help for this page"><b aria-hidden="true">?</b><span>Help</span><kbd>F1</kbd></button>`
      );
    }
    const use = document.querySelector('#view .sn-use');
    if (use && !use.querySelector('.hlp-more'))
      use.insertAdjacentHTML('beforeend', `<button type="button" class="hlp-more" data-hlp-open="${id}">Read more in Help →</button>`);
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('[data-hlp-open]') : null;
      if (!b) return;
      ev.preventDefault();
      ev.stopPropagation();
      if (isOpen() && view && view.state.topic === b.dataset.hlpOpen) return close();
      open(b.dataset.hlpOpen);
    });
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'F1') return;
      if (document.body.classList.contains('lv-window')) return; // (the second screen and the phones have no Help)
      ev.preventDefault();
      if (isOpen() && view && view.state.topic === topicNow()) return close();
      open();
    });
    setInterval(decorate, 600);
  }
  return { open, close, isOpen, recent, read, settings, progress, topicNow, decorate };
})();
if (typeof module !== 'undefined') module.exports = HelpDesk;
