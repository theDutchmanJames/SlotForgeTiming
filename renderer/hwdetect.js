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

  // ---- Home: one card per offer ----
  function homeHtml(list) {
    return list
      .map(o => {
        const { name, hint } = describe(o.info);
        if (o.action === 'switch')
          return `<section class="card hm-detect" data-detect="${esc(o.key)}"><div><b>${esc(NAMES[o.hw])} is plugged in</b><span class="muted">It is not the timing hardware in use, so its laps would not count.</span></div>
            <div class="row"><button type="button" class="btn primary" data-detect-use="${esc(o.hw)}">Use ${esc(NAMES[o.hw])} for races</button><button type="button" class="btn" data-detect-later>Not now</button></div></section>`;
        const order = o.hw ? [o.hw, ...Object.keys(NAMES).filter(k => k !== o.hw)] : Object.keys(NAMES);
        return `<section class="card hm-detect" data-detect="${esc(o.key)}"><div><b>A USB device was plugged in: ${esc(name)}</b><span class="muted">${hint ? esc(hint) + ' ' : ''}Is it timing hardware? Choose what it is, and the app connects it and uses it for races.</span></div>
          <div class="row">${order.map((k, i) => `<button type="button" class="btn${i === 0 && o.hw ? ' primary' : ''}" data-detect-use="${k}">${esc(SHORT[k])}</button>`).join('')}<button type="button" class="btn" data-detect-later>Not now</button><button type="button" class="btn" data-detect-ignore>Not timing hardware</button></div></section>`;
      })
      .join('');
  }
  // o: { use(hw, offer), ignore(offer) }
  function mountHome(el, o) {
    if (!el) return;
    el.innerHTML = homeHtml(offers);
    el.hidden = !offers.length;
    el.onclick = async ev => {
      const b = ev.target && ev.target.closest ? ev.target.closest('button') : null,
        card = b && b.closest('[data-detect]');
      if (!card) return;
      const offer = offers.find(x => x.key === card.dataset.detect);
      if (!offer) return;
      if (b.dataset.detectUse) {
        drop(offer.key);
        await o.use(b.dataset.detectUse, offer);
      } else if (b.hasAttribute('data-detect-ignore')) {
        drop(offer.key);
        await o.ignore(offer);
      } else if (b.hasAttribute('data-detect-later')) drop(offer.key);
    };
  }

  const api = { describe, decide, rememberedFor, idOf, start, consider, offers, homeHtml, mountHome, KEYS, NAMES };
  root.HwDetect = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
