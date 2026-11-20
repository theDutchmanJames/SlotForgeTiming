// Timing hardware found by itself (2.3.0). When a USB serial device is plugged in (or is already there when the app starts):
//  - the device remembered for the timing hardware in use connects by itself (also after the cable was pulled out and put back);
//  - a device remembered for another interface: Home offers to use that one for races;
//  - a device the app has not seen: Home asks what it is (Arduino Sketch, Trackmate or DS Electronics), or it can be ignored for good.
// Only USB devices can be told apart (a COM port of the computer itself has no USB numbers), and the app never writes to a device it was not told about.
// Pure part: describe() and decide(), tested without a screen. The rest listens to navigator.serial and keeps the offers for Home.
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const hex4 = n => Number(n).toString(16).padStart(4, '0').toUpperCase();
  const VENDORS = {
    0x2341: ['Arduino board', 'arduino', 'Probably the SlotForge box.'],
    0x2a03: ['Arduino board', 'arduino', 'Probably the SlotForge box.'],
    0x1a86: ['CH340 USB serial', null, 'Many Arduino Nano boards use this chip.'],
    0x0403: ['FTDI USB serial', null, ''],
    0x067b: ['Prolific USB serial', null, ''],
    0x10c4: ['Silicon Labs USB serial', null, '']
  };
  const NAMES = { trackmate: 'Trackmate Interface', arduino: 'Arduino Sketch', ds: 'DS Electronics' };
  const SHORT = { trackmate: 'Trackmate', arduino: 'Arduino (SlotForge sketch)', ds: 'DS-200 / DS-300' }; // (the answers to "what is it?")
  const KEYS = { trackmate: 'tmDevice', arduino: 'abDevice', ds: 'dsDevice' };
  const idOf = info => (info && info.usbVendorId !== undefined ? hex4(info.usbVendorId) + ':' + hex4(info.usbProductId) : '');
  function describe(info) {
    const v = VENDORS[info && info.usbVendorId];
    return { name: (v ? v[0] : 'USB serial device') + ' (' + idOf(info) + ')', likely: v ? v[1] : null, hint: v ? v[2] : '' };
  }
  const same = (d, info) => !!d && d.vid === info.usbVendorId && d.pid === info.usbProductId;
  // which interface remembers this device (the one in use first)
  function rememberedFor(settings, info, chosen) {
    if (same(settings[KEYS[chosen]], info)) return chosen;
    return Object.keys(KEYS).find(k => same(settings[KEYS[k]], info)) || null;
  }
  // settings; info (the port's USB numbers); ctx: { chosen (the timing hardware in use), open (it is connected now), racing }
  // -> { action: 'connect' | 'switch' | 'ask' | 'none', hw }
  function decide(settings, info, ctx = {}) {
    if (!info || info.usbVendorId === undefined || info.virtual) return { action: 'none' };
    const known = rememberedFor(settings, info, ctx.chosen);
    if (known && known === ctx.chosen) return ctx.open || ctx.racing ? { action: 'none' } : { action: 'connect', hw: known };
    if (known) return ctx.open || ctx.racing ? { action: 'none' } : { action: 'switch', hw: known }; // (the hardware in use works: two devices plugged in is no question)
    if ((settings.hwIgnored || []).includes(idOf(info))) return { action: 'none' };
    return { action: 'ask', hw: describe(info).likely };
  }

  // ---- the offers that Home shows: [{ key, port, info, action, hw }] ----
  const offers = [];
  let ctxOf = () => ({}),
    onChange = () => {},
    connect = async () => false;
  const changed = () => {
    try {
      onChange(offers.slice());
    } catch (x) {
      /* the page is redrawn later */
    }
  };
  async function consider(port) {
    const info = port && port.getInfo ? port.getInfo() : {},
      c = ctxOf(),
      d = decide(c.settings || {}, info, c);
    const key = idOf(info);
    if (d.action === 'none' || !key) return d;
    if (d.action === 'connect') {
      await connect(d.hw, port, info);
      return d;
    }
    const i = offers.findIndex(o => o.key === key);
    const offer = { key, port, info, action: d.action, hw: d.hw };
    if (i >= 0) offers[i] = offer;
    else offers.push(offer);
    changed();
    return d;
  }
  // the app's own glue: o = { context() -> { settings, chosen, open, racing }, connect(hw, port, info), changed(offers) }
  async function start(o) {
    ctxOf = o.context;
    onChange = o.changed || onChange;
    connect = o.connect || connect;
    const serial = typeof navigator !== 'undefined' && navigator.serial;
    if (!serial) return;
    serial.addEventListener('connect', ev => {
      consider(ev.target || ev.port).catch(() => {});
    });
    serial.addEventListener('disconnect', ev => {
      const key = idOf((ev.target || ev.port)?.getInfo?.() || {}),
        i = offers.findIndex(x => x.key === key);
      if (i >= 0) {
        offers.splice(i, 1);
        changed();
      }
    });
    for (const p of await serial.getPorts().catch(() => [])) await consider(p).catch(() => {});
  }
  const drop = key => {
    const i = offers.findIndex(x => x.key === key);
    if (i >= 0) offers.splice(i, 1);
    changed();
  };

  // ---- Home: one card per offer (2.4.0, SlotForgeRestyle.md "Plugged In") ----
  // offers: { key, port, info, action ('ask' | 'switch' | 'failed' | 'aside'), hw, error, ds (the DS model chosen on the card) }
  // ctx: { chosen (the timing hardware in use), chosenOn, lastUsed(hw) -> 'd Mon' | '' }
  const SUB = {
    trackmate: 'The Trackmate interface (USB)',
    arduino: 'The SlotForge sketch on an Arduino Nano or Mega',
    ds: 'A DS lap counter on a serial cable'
  };
  const CARD_NAME = { trackmate: 'Trackmate', arduino: 'Arduino box', ds: 'DS Electronics' };
  const nameOfHw = id => CARD_NAME[id] || NAMES[id] || id;
  // why the card asks, in words: { kicker, chips }
  function reason(o, ctx = {}) {
    const d = describe(o.info),
      chips = [];
    if (o.action === 'switch') {
      const now =
        ctx.chosen && ctx.chosen !== 'none'
          ? `Races use: ${ctx.names && ctx.names[ctx.chosen] ? ctx.names[ctx.chosen] : nameOfHw(ctx.chosen)}${ctx.chosenOn ? '' : ' (not connected)'}`
          : 'Races use: no timing hardware';
      chips.push(now);
      const last = ctx.lastUsed ? ctx.lastUsed(o.hw) : '';
      if (last) chips.push(`${nameOfHw(o.hw)} last used ${last}`);
      return { kicker: `Plugged in · remembered as the ${nameOfHw(o.hw)}`, chips };
    }
    chips.push(d.name.replace(/ \([0-9A-F:]+\)$/, ''), idOf(o.info));
    if (d.hint) chips.push(d.hint.replace(/\.$/, ''));
    return { kicker: 'Plugged in · new to Timing', chips };
  }
  // a failed connect in plain words
  function failText(hw, error) {
    const e = String(error || ''),
      an = /^[AEIOU]/i.test(nameOfHw(hw)) ? 'an' : 'a';
    if (/in use|busy|access|denied|already open|failed to open/i.test(e))
      return 'The port is in use by another program (often a second copy of Timing, or the Arduino IDE). Close it, or unplug the cable and plug it in again.';
    if (/timeout|did not answer|no answer|version/i.test(e))
      return `It did not answer as ${an} ${nameOfHw(hw)}. Is it switched on, and is it really ${an} ${nameOfHw(hw)}?`;
    return `The port did not open as ${an} ${nameOfHw(hw)}. Unplug the cable and plug it in again, or choose what it is once more.`;
  }
  function homeHtml(list, ctx = {}) {
    const chip = t => `<span>${esc(t)}</span>`;
    return list
      .map(o => {
        const { name } = describe(o.info),
          r = reason(o, ctx);
        if (o.action === 'aside')
          return `<div class="dx-thin" data-detect="${esc(o.key)}"><span aria-hidden="true">✓</span><span><b>${esc(name)}</b> is set aside: Timing will not ask about it again.</span><button type="button" class="btn sm" data-detect-undo>Undo</button><button type="button" class="btn sm ghost" data-detect-forgotten>Forgotten devices</button><button type="button" class="btn sm ghost icon" data-detect-later aria-label="Close" title="Close">×</button></div>`;
        if (o.action === 'failed')
          return `<section class="card hm-detect dx dx-fail" data-detect="${esc(o.key)}"><span class="dx-ic" aria-hidden="true">!</span><div><span class="dx-k">${esc(nameOfHw(o.hw))} · USB ${esc(idOf(o.info))}</span><h3>Could not connect the ${esc(nameOfHw(o.hw))}</h3><p>${esc(failText(o.hw, o.error))}</p>
            <div class="dx-foot"><button type="button" class="btn primary sm" data-detect-use="${esc(o.hw)}">Try again</button><button type="button" class="btn sm" data-detect-other>It is something else</button><span class="dx-sp"></span><button type="button" class="btn sm ghost" data-detect-page="${esc(o.hw)}">Open its page</button><button type="button" class="btn sm ghost" data-detect-later>Not now</button></div></div></section>`;
        if (o.action === 'switch')
          return `<section class="card hm-detect dx dx-switch" data-detect="${esc(o.key)}"><span class="dx-ic" aria-hidden="true">⇄</span><div><span class="dx-k">${esc(r.kicker)}</span><h3>The ${esc(nameOfHw(o.hw))} is here</h3><div class="dx-why">${r.chips.map(chip).join('')}</div><p>${esc(NAMES[o.hw])} is plugged in. Its laps only count when it is the timing hardware in use.</p>
            <div class="dx-foot"><button type="button" class="btn primary sm" data-detect-use="${esc(o.hw)}">Use ${esc(NAMES[o.hw])} for races</button><button type="button" class="btn sm" data-detect-later>${ctx.chosen && ctx.chosen !== 'none' && ctx.chosen !== o.hw ? `Keep the ${esc(nameOfHw(ctx.chosen))}` : 'Not now'}</button></div></div></section>`;
        const order = o.hw ? [o.hw, ...Object.keys(NAMES).filter(k => k !== o.hw)] : Object.keys(NAMES);
        const ds = o.ds === 'ds200' ? 'ds200' : 'ds300';
        return `<section class="card hm-detect dx dx-ask" data-detect="${esc(o.key)}"><span class="dx-ic" aria-hidden="true">USB</span><div><span class="dx-k">${esc(r.kicker)}</span><h3>What is this device?</h3><div class="dx-why">${r.chips.map(chip).join('')}</div><p>A USB device was plugged in: ${esc(name)}. Timing asks because it has not seen it before. Choose what it is: Timing connects it and counts the laps with it from now on.</p>
          <div class="dx-opts">${order
            .map(
              k =>
                `<div class="dx-opt${k === o.hw ? ' dx-like' : ''}"><button type="button" class="dx-pick" data-detect-use="${k}">${k === o.hw ? '<em>Likely</em>' : ''}<b>${esc(SHORT[k])}</b><small>${esc(SUB[k])}</small></button>${
                  k === 'ds'
                    ? `<span class="dx-seg" role="group" aria-label="DS model"><button type="button" class="${ds === 'ds300' ? 'on' : ''}" data-detect-ds="ds300" aria-pressed="${ds === 'ds300'}">DS-300</button><button type="button" class="${ds === 'ds200' ? 'on' : ''}" data-detect-ds="ds200" aria-pressed="${ds === 'ds200'}">DS-200</button></span>`
                    : ''
                }</div>`
            )
            .join('')}</div>
          <div class="dx-foot"><button type="button" class="btn sm ghost" data-detect-later>Not now</button><span class="dx-sp"></span><button type="button" class="btn sm ghost" data-detect-ignore>Not timing hardware…</button></div></div></section>`;
      })
      .join('');
  }
  // o: { use(hw, offer, { ds }) -> { ok, error } | undefined, ignore(offer), unignore(offer), open(hw), forgotten(), context() -> ctx, confirmIgnore(offer) -> bool }
  function mountHome(el, o) {
    if (!el) return;
    const ctx = () => (typeof o.context === 'function' ? o.context() : {});
    const draw = () => {
      el.innerHTML = homeHtml(offers, ctx());
      el.hidden = !offers.length;
    };
    draw();
    const put = (offer, patch) => {
      const i = offers.findIndex(x => x.key === offer.key);
      if (i >= 0) offers[i] = { ...offers[i], ...patch };
      draw();
    };
    el.onclick = async ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('button') : null,
        card = b && b.closest('[data-detect]');
      if (!card) return;
      const offer = offers.find(x => x.key === card.dataset.detect);
      if (!offer) return;
      if (b.dataset.detectDs) return put(offer, { ds: b.dataset.detectDs });
      if (b.dataset.detectUse) {
        b.disabled = true;
        const hw = b.dataset.detectUse;
        let res;
        try {
          res = await o.use(hw, offer, { ds: offer.ds === 'ds200' ? 'ds200' : 'ds300' });
        } catch (e) {
          res = { ok: false, error: e && e.message ? e.message : String(e) };
        }
        if (res && res.ok === false) return put(offer, { action: 'failed', hw, error: res.error || '' });
        return drop(offer.key);
      }
      if (b.hasAttribute('data-detect-other')) return put(offer, { action: 'ask', error: '' });
      if (b.dataset.detectPage) {
        drop(offer.key);
        return o.open && o.open(b.dataset.detectPage);
      }
      if (b.hasAttribute('data-detect-ignore')) {
        if (o.confirmIgnore && !(await o.confirmIgnore(offer))) return;
        await o.ignore(offer);
        return put(offer, { action: 'aside' });
      }
      if (b.hasAttribute('data-detect-undo')) {
        if (o.unignore) await o.unignore(offer);
        return put(offer, { action: 'ask' });
      }
      if (b.hasAttribute('data-detect-forgotten')) {
        drop(offer.key);
        return o.forgotten && o.forgotten();
      }
      if (b.hasAttribute('data-detect-later')) drop(offer.key);
    };
  }

  const api = { describe, decide, rememberedFor, idOf, start, consider, offers, homeHtml, mountHome, reason, failText, KEYS, NAMES };
  root.HwDetect = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
