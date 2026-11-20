// (2.4.0, SlotForgeRestyle.md "Paddock Pit Lane") App Settings › Connections › Paddock: the shared library on this computer, the Dealership on the network
// and the results sent after each race on one page, with Fix it. The words and rows come from pitlane.js; the full tools of before (cars to link, the
// older local service, the delivery log) stay under "Older connections and repair" (paddockui.js).
let plFilter = 'all',
  plMore = false,
  plHosts = null, // the Dealerships found on the network (null: not looked yet)
  plPick = '',
  plTyped = null, // (an address typed by hand: kept while the page is drawn again)
  plSteps = null,
  plBusy = false,
  plFinding = false;
const PL_ICON = {
  pc: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>',
  net: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5a10 10 0 0 1 14 0M8 15.5a6 6 0 0 1 8 0M12 19h.01M2 9.5a14 14 0 0 1 20 0"/></svg>',
  flag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  wrench:
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z"/></svg>',
  check:
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>'
};
async function plLoad() {
  const [status, library, keep, sessions] = await Promise.all([
    api.paddockStatus(),
    api.libraryStatus ? api.libraryStatus().catch(() => null) : null,
    api.paddockKeep ? api.paddockKeep().catch(() => ({})) : {},
    api.list('sessions').catch(() => [])
  ]);
  let cars = 0,
    dealerCars = 0;
  if (library?.available) cars = (await api.list('slotcars').catch(() => [])).filter(c => !c.retired).length;
  if (status.connected && status.connection?.mode !== 'local' && api.paddockCatalogue)
    dealerCars = ((await api.paddockCatalogue(false).catch(() => [])) || []).length;
  return { status, library, keep: keep || {}, sessions, cars, dealerCars };
}
const plPill = (c, t) => `<span class="pl-pill" style="--c:${c}"><i></i>${esc(t)}</span>`;
async function renderPitLane(box, note = '') {
  let data;
  try {
    data = await plLoad();
  } catch (e) {
    box.innerHTML = `<p class="err">Could not read the Paddock connection: ${esc(e.message)}</p>`;
    return;
  }
  if (box.isConnected === false) return;
  const S = PitLane.summary({ ...data, remembered: !!data.keep.remembered });
  if (typeof homeLibraryWaiting !== 'undefined' && homeLibraryWaiting !== S.counts.open) {
    homeLibraryWaiting = S.counts.open; // (the light in the main menu follows)
    if (typeof MainBar !== 'undefined' && MainBar.lights) MainBar.lights();
  }
  const c = data.status.connection && data.status.connection.mode !== 'local' ? data.status.connection : null;
  const K = S.cards;
  const hero = `<section class="pl-hero ${S.tone}" id="paddock-overview"><div><span class="pl-k">${esc(S.kicker)}</span><h1>${esc(S.headline)}</h1><p>${esc(S.line)}</p><div class="pl-pills">${S.pills.map(p => plPill(p.c, p.text)).join('')}</div></div><div class="pl-acts">${
    S.tone === 'fix'
      ? `<button type="button" class="btn primary" data-pl="fix"${plBusy ? ' disabled' : ''}>${PL_ICON.wrench} Fix it</button><small>${esc(S.fix.map((f, i) => (i ? f.text.charAt(0).toLowerCase() + f.text.slice(1) : f.text)).join(', then '))}</small>`
      : S.tone === 'off'
        ? `<button type="button" class="btn primary" data-pl="goconnect">Connect to a Dealership</button><small>Or start Paddock on this computer</small>`
        : `<button type="button" class="btn" data-pl="cars">Browse Paddock cars</button><small>Opens Database › Slotcars</small>`
  }</div><p class="pl-note" role="status">${esc(note)}</p></section>`;
  const card = (c2, icon, k, title, state, big, line, buttons) =>
    `<article class="pl-card" style="--c:${c2}"><div class="pl-top"><span class="pl-ic">${icon}</span><div><span class="pl-k">${k}</span><h3>${title}</h3></div></div><span class="pl-st">● ${esc(state)}</span><div class="pl-big">${big.map(([v, l]) => `<div><b>${v === null || v === undefined ? '—' : esc(v)}</b><small>${l}</small></div>`).join('')}</div><p>${esc(line)}</p><div class="pl-row">${buttons}</div></article>`;
  const trio = `<div class="pl-trio">${card(
    K.library.c,
    PL_ICON.pc,
    'On this computer',
    'Shared library',
    K.library.state,
    [
      [K.library.on ? K.library.cars : null, 'cars'],
      [K.library.on ? K.library.shared : null, 'races shared']
    ],
    K.library.on
      ? 'Paddock on this PC shares its cars and receives your results by itself.'
      : 'Start SlotForge Paddock on this computer to share its cars here.',
    K.library.on ? '<button type="button" class="btn sm ghost" data-pl="cars">Show cars</button>' : ''
  )}${card(
    K.dealer.c,
    PL_ICON.net,
    'On the network',
    'Dealership',
    K.dealer.state,
    [
      [K.dealer.cars, 'cars'],
      [K.dealer.set ? K.dealer.waiting : null, 'waiting']
    ],
    K.dealer.line,
    !K.dealer.set
      ? '<button type="button" class="btn sm" data-pl="goconnect">Connect…</button>'
      : K.dealer.on
        ? `<button type="button" class="btn sm ghost" data-pl="disconnect">Disconnect</button><button type="button" class="btn sm ghost" data-pl="goconnect">Change…</button>`
        : `<button type="button" class="btn sm" data-pl="reconnect">Find it again</button><button type="button" class="btn sm ghost" data-pl="goconnect">Change…</button>`
  )}${card(
    K.results.c,
    PL_ICON.flag,
    'After each race',
    'Results',
    K.results.state,
    [
      [K.results.sent, 'delivered'],
      [K.results.open, 'open']
    ],
    'Saved here first, then sent. Corrections replace the earlier result.',
    '<button type="button" class="btn sm ghost" data-pl="results">See all</button>'
  )}</div>`;
  const shown = S.rows.filter(r => plFilter === 'all' || (plFilter === 'open' ? r.kind === 'att' || r.kind === 'wait' : r.kind === 'ok'));
  const cut = plMore ? shown : shown.slice(0, 12);
  const rowHtml = r =>
    `<div class="pl-tr ${r.kind}"><span class="pl-d">${esc(r.when)}</span><span><b>${esc(r.name)}</b><small${r.detail ? ` title="${esc(r.detail)}"` : ''}>${esc(r.why)}</small></span><span>${plPill(r.c, r.label)}</span><span class="pl-a">${
      r.kind === 'att' ? `<button type="button" class="btn sm" data-pl-open="${esc(r.id)}">Open the race</button>` : ''
    }${r.canSend ? `<button type="button" class="btn sm" data-pl="send">${r.kind === 'att' ? 'Try again' : 'Send now'}</button>` : ''}${r.removable ? `<button type="button" class="btn sm ghost" data-pl-leave="${esc(r.id)}" title="Do not share this race">Leave out</button>` : ''}${
      r.kind === 'ok' || r.kind === 'stay' ? `<button type="button" class="btn sm ghost" data-pl-open="${esc(r.id)}">Open</button>` : ''
    }</span></div>`;
  const results = `<div class="pl-panel" id="paddock-results"><div class="pl-ph"><h2>Results</h2><span class="pl-k">newest first</span><div class="gx-chips pl-chips" role="group" aria-label="Show">${[
    ['all', 'All', S.counts.all],
    ['open', 'Open', S.counts.open],
    ['sent', 'Delivered', S.counts.sent]
  ]
    .map(
      ([k, l, n]) =>
        `<button type="button" class="gx-chip${plFilter === k ? ' on' : ''}${k === 'open' && n ? ' amber' : ''}" data-pl-filter="${k}" aria-pressed="${plFilter === k}">${l}<small>${n}</small></button>`
    )
    .join('')}</div></div>${
    cut.length
      ? cut.map(rowHtml).join('')
      : `<p class="pl-empty">${S.rows.length ? 'Nothing here.' : 'No race has been sent to Paddock yet. Finished races are sent by themselves.'}</p>`
  }${shown.length > cut.length ? `<div class="pl-moreline"><button type="button" class="btn sm ghost" data-pl="more">Show all ${shown.length}</button></div>` : ''}</div>`;
  const hosts = plHosts || [];
  const pick = hosts.find(h => h.address === plPick) || null;
  const connect = `<div class="pl-panel" id="paddock-connect"><div class="pl-ph"><h2>${c ? 'Dealership' : 'Connect to a Dealership'}</h2><span class="pl-k">Paddock on another computer</span></div><div class="pl-conn"><div><span class="pl-k">Found on your network</span><div class="pl-hosts">${
    plHosts === null
      ? '<p class="pl-empty">Looking for Paddock on your network…</p>'
      : hosts.length
        ? hosts
            .map(
              h =>
                `<button type="button" class="pl-host${h.address === plPick ? ' on' : ''}" data-pl-host="${esc(h.address)}" aria-pressed="${h.address === plPick}">${PL_ICON.net}<span><b>${esc(h.name)}</b><small>${esc(h.address.replace(/^https?:\/\//, ''))}</small></span>${c && c.databaseId === h.id ? '<em>yours</em>' : ''}${h.address === plPick ? `<i>${PL_ICON.check}</i>` : ''}</button>`
            )
            .join('')
        : '<p class="pl-empty">No Dealership answered. Start Dealership hosting in Paddock, or type its address.</p>'
  }<div class="pl-row"><button type="button" class="btn sm ghost" data-pl="find">Look again</button><button type="button" class="btn sm ghost" data-pl="typeaddr">Type an address instead…</button></div><label class="pl-f" id="pl-addrbox"${plTyped !== null ? '' : ' hidden'}>Address and port<input id="pl-addr" placeholder="192.168.1.20:51234" value="${esc(plTyped || '')}" autocomplete="off"></label></div></div><div class="pl-side"><label class="pl-f">Dealership password<input id="pl-code" type="password" maxlength="128" autocomplete="off" spellcheck="false" placeholder="The password set in Paddock"></label><label class="pl-chk"><input type="checkbox" id="pl-remember"${data.keep.canRemember === false ? ' disabled' : ' checked'}> ${
    data.keep.canRemember === false
      ? 'Windows cannot keep it encrypted here: it is kept until Timing closes'
      : 'Remember it on this computer (kept encrypted by Windows)'
  }</label><button type="button" class="btn${K.dealer.on ? '' : ' primary'}" data-pl="connect"${plBusy ? ' disabled' : ''}>${K.dealer.on ? 'Connect again' : 'Connect'}${pick ? ' to ' + esc(pick.name) : ''}</button>${
    plSteps
      ? `<ul class="pl-steps">${plSteps.map(s => `<li class="${s.state}"><i>${s.state === 'ok' ? '✓' : s.state === 'bad' ? '!' : s.state === 'busy' ? '…' : '·'}</i>${esc(s.text)}</li>`).join('')}</ul>`
      : ''
  }<p class="pl-fine">Passwords are case-sensitive. ${data.keep.remembered ? 'A password is remembered on this computer. <button type="button" class="pl-link" data-pl="forgetpw">Forget it</button>' : ''}</p></div></div></div>`;
  const older = `<details class="pl-older" id="paddock-older"><summary>Older connections and repair</summary><p>Linking Paddock cars to your own Timing cars, the local integration service of Paddock before 2.0, forgetting a host, and the delivery log.</p><div data-pl-older></div></details>`;
  box.innerHTML = `<div class="pl">${hero}${trio}${results}${connect}${older}</div>`;
  if (plHosts === null && !(c && data.status.connected)) plFind(box);
  box.querySelector('#paddock-older').ontoggle = ev => {
    const host = box.querySelector('[data-pl-older]');
    if (ev.target.open && !host.childElementCount && typeof PaddockUI !== 'undefined') PaddockUI.mount(api, host);
  };
  box.onclick = async ev => {
    const b = ev.target.closest('button');
    if (!b || !box.contains(b)) return;
    const q = b.dataset,
      redraw = n => renderPitLane(box, n);
    if (q.plFilter) {
      plFilter = q.plFilter;
      plMore = false;
      return redraw();
    }
    if (q.plHost) {
      plPick = q.plHost;
      plTyped = null;
      plSteps = null;
      return redraw();
    }
    if (q.plOpen) return plOpenRace(q.plOpen);
    if (q.plLeave) {
      if (!(await Dialog.confirm('Leave this race out of Paddock?\n\nIt stays in Timing; it is only not shared.', { ok: 'Leave it out' })))
        return;
      try {
        await api.libraryResultsRemove(q.plLeave);
        return redraw('Left out of Paddock.');
      } catch (e) {
        return redraw(PitLane.reason(e.message));
      }
    }
    const act = q.pl;
    if (act === 'more') {
      plMore = true;
      return redraw();
    }
    if (act === 'results') return box.querySelector('#paddock-results')?.scrollIntoView({ behavior: 'smooth' });
    if (act === 'goconnect') {
      box.querySelector('#paddock-connect')?.scrollIntoView({ behavior: 'smooth' });
      return box.querySelector('#pl-code')?.focus();
    }
    if (act === 'typeaddr') {
      plPick = '';
      plTyped = c ? c.address.replace(/^https?:\/\//, '') : '';
      box.querySelector('#pl-addrbox').hidden = false;
      return box.querySelector('#pl-addr').focus();
    }
    if (act === 'find') {
      plHosts = null;
      await redraw();
      return;
    }
    if (act === 'cars') {
      state.tab = 'database';
      state.sub = 'slotcars';
      return render();
    }
    if (act === 'forgetpw') {
      await api.paddockKeep('forget');
      return redraw('The remembered password is forgotten.');
    }
    if (act === 'disconnect') {
      await api.paddockDisconnect(false).catch(() => {});
      return redraw('Disconnected. Results wait here until you connect again.');
    }
    if (act === 'reconnect') return plReconnect(box);
    if (act === 'send') return plSend(box);
    if (act === 'connect') return plConnect(box, c);
    if (act === 'fix') return plFix(box, S);
  };
}
async function plFind(box) {
  if (plFinding) return;
  plFinding = true;
  try {
    plHosts = PitLane.hosts(await api.paddockDiscover());
  } catch {
    plHosts = [];
  } finally {
    plFinding = false;
  }
  if (!plPick && plHosts.length) plPick = plHosts[0].address;
  if (box.isConnected !== false && box.querySelector('.pl')) renderPitLane(box);
}
function plOpenRace(id) {
  state.focusSession = id;
  state.resultsSub = 'racing';
  state.tab = 'database';
  state.sub = 'results';
  render();
}
async function plSend(box) {
  plBusy = true;
  let n = '';
  try {
    const [a, b] = await Promise.all([
      api.paddockRetry().catch(e => ({ error: e.message })),
      api.libraryResultsRetry ? api.libraryResultsRetry().catch(e => ({ error: e.message })) : null
    ]);
    n =
      a?.error && b?.error
        ? PitLane.reason(a.error)
        : b?.background
          ? 'Sending goes on by itself.'
          : b?.failed
            ? `${b.failed} ${b.failed === 1 ? 'race still cannot' : 'races still cannot'} be shared${b.converted ? `; ${b.converted} can now` : ''}.`
            : 'Sent what was waiting.';
  } finally {
    plBusy = false;
  }
  return renderPitLane(box, n);
}
async function plReconnect(box) {
  plBusy = true;
  let r;
  try {
    r = await api.paddockKeep('reconnect');
  } catch (e) {
    r = { ok: false, reason: e.message };
  } finally {
    plBusy = false;
  }
  if (r.ok)
    return renderPitLane(
      box,
      r.how === 'found' ? 'Found the Dealership on a new address and connected.' : 'Connected to the Dealership again.'
    );
  plHosts = null;
  await renderPitLane(
    box,
    r.reason === 'password'
      ? 'The Dealership did not accept the remembered password. Enter it again.'
      : r.reason === 'no-password'
        ? 'Enter the Dealership password to connect again.'
        : 'The Dealership did not answer. Is Paddock running with Dealership hosting on?'
  );
  box.querySelector('#paddock-connect')?.scrollIntoView({ behavior: 'smooth' });
  box.querySelector('#pl-code')?.focus();
  return r;
}
async function plConnect(box, c) {
  const code = box.querySelector('#pl-code').value,
    typed = box.querySelector('#pl-addrbox').hidden ? '' : box.querySelector('#pl-addr').value.trim(),
    address = typed || plPick || c?.address || '';
  if (typed) plTyped = typed;
  const remember = !!box.querySelector('#pl-remember')?.checked;
  const host = (plHosts || []).find(h => h.address === address);
  const name = host?.name || c?.name || '';
  if (!address) return renderPitLane(box, 'Choose a Dealership, or type its address.');
  if (!code) return renderPitLane(box, 'Enter the Dealership password.');
  plSteps = PitLane.connectSteps({ name, busy: true });
  plBusy = true;
  await renderPitLane(box);
  try {
    if (c && host && host.id !== c.databaseId)
      throw Error('This is a different Paddock database. Forget the old host (under Older connections and repair) before pairing another.');
    await api.paddockConnect({ address, code, remember });
    plSteps = PitLane.connectSteps({ name, ok: true });
    plBusy = false;
    return renderPitLane(box, `Connected${name ? ' to ' + name : ''}.${remember ? ' The password is remembered on this computer.' : ''}`);
  } catch (e) {
    plSteps = PitLane.connectSteps({ name, error: e.message });
    plBusy = false;
    await renderPitLane(box, PitLane.reason(e.message));
    box.querySelector('#paddock-connect')?.scrollIntoView({ block: 'nearest' });
  }
}
// Fix it: the steps of the summary in order (connect again, send what waits, open the race that needs a look)
async function plFix(box, S) {
  for (const step of S.fix) {
    if (step.act === 'reconnect') {
      const r = await plReconnect(box);
      if (!r || !r.ok) return; // (it asks for the password: the rest waits for the connection)
    }
    if (step.act === 'send') await plSend(box);
    if (step.act === 'open') {
      const att = S.rows.filter(r => r.kind === 'att');
      if (att.length === 1) return plOpenRace(att[0].id);
      plFilter = 'open';
      await renderPitLane(box, `${att.length} races need a look: open each one to see why.`);
      return box.querySelector('#paddock-results')?.scrollIntoView({ behavior: 'smooth' });
    }
  }
}
