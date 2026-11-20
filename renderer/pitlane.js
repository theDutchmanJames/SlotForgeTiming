// (2.4.0, SlotForgeRestyle.md "Paddock Pit Lane") App Settings › Connections › Paddock as one page: what it says and does. Pure (plain objects in,
// words and rows out), so it can be tested without a screen; pitlaneview.js draws it and does what its buttons do.
//   the shared library on this computer, the Dealership on the network, and the results sent to them after each race;
//   one headline that says how things stand, and Fix it: the steps that put it right, in order.
(function (root) {
  'use strict';
  const G = '#3ecf8e',
    A = '#f2b705',
    R = '#e5484d',
    N = '#8a94a6';

  // the reason of a result or a connection in plain words (the engine's words stay in the title of the row)
  const REASONS = [
    [/captured driver boundary/i, 'A lap has no driver change recorded, so Paddock cannot share this race.'],
    [/time token/i, 'Time Token sessions stay in Timing.'],
    [/without captured|older race/i, 'This race is from before Paddock sharing, so it stays in Timing.'],
    [/UNAUTHENTICATED|password|unauthori[sz]ed/i, 'The Dealership did not accept the password.'],
    [/DATABASE_MISMATCH|different Paddock database/i, 'That is another Paddock database than the one these results belong to.'],
    [/cooldown|limiting connection|rate.?limit/i, 'Paddock asked to wait a moment before trying again.'],
    [/changing sharing mode|HOST_MIGRATING/i, 'Paddock is changing how it shares. Try again in a minute.'],
    [
      /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|network|fetch failed|socket|offline|not reachable|timed? ?out/i,
      'The Dealership could not be reached on the network.'
    ],
    [/finish the race/i, 'It waits until the race is over.'],
    [/locked|busy|SQLITE_BUSY/i, 'The shared library was busy. It tries again by itself.']
  ];
  function reason(text) {
    const t = String(text || '').replace(/^Error invoking remote method '[^']+': (?:Error: )?/, '');
    if (!t) return '';
    const hit = REASONS.find(([re]) => re.test(t));
    return hit ? hit[1] : t;
  }

  // a delivery (paddock status) -> its state on the page
  function stateOf(d) {
    if (d.status === 'sent') return { kind: 'ok', label: 'DELIVERED', c: G };
    if (d.status === 'withdrawn') return { kind: 'ok', label: 'WITHDRAWN', c: N };
    if (d.status === 'attention' && /time token|without captured|older race/i.test(d.error || ''))
      return { kind: 'stay', label: 'STAYS HERE', c: N };
    if (d.status === 'attention') return { kind: 'att', label: 'NEEDS A LOOK', c: R };
    return { kind: 'wait', label: 'WAITING', c: A };
  }
  const where = d => (d.transport === 'engine' ? 'the shared library' : 'the Dealership');
  function whyOf(d, st, o = {}) {
    if (st.kind === 'ok')
      return d.status === 'withdrawn'
        ? `Taken back from ${where(d)}`
        : `Sent to ${where(d)}${d.receiptCheckedAt || d.receivedAt ? ' · receipt ' + clock(d.receiptCheckedAt || d.receivedAt) : ''}`;
    if (st.kind === 'stay') return reason(d.error);
    if (st.kind === 'att') return reason(d.error) || 'Paddock could not take this race.';
    if (d.transport !== 'engine' && !o.dealershipOn)
      return 'Waiting for the Dealership (it is offline). It is sent by itself when it is back.';
    return d.error ? reason(d.error) + ' It is sent again by itself.' : `Waiting to be sent to ${where(d)}.`;
  }
  const pad = n => String(n).padStart(2, '0');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function clock(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function when(iso) {
    const d = new Date(iso);
    return isNaN(d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} · ${clock(iso)}`;
  }

  // the results, newest first: one row per race (a race sent to both places shows once, with the state that needs you most)
  function rows(deliveries, sessions, o = {}) {
    const byId = new Map((sessions || []).map(s => [s.id, s]));
    const rank = { att: 0, wait: 1, stay: 2, ok: 3 };
    const out = new Map();
    for (const d of deliveries || []) {
      if (!d || !d.sessionId) continue;
      const st = stateOf(d),
        s = byId.get(d.sessionId) || {};
      const row = {
        id: d.sessionId,
        name: s.setupName ? s.setupName + (s.trackName ? ' · ' + s.trackName : '') : d.name || 'Race',
        date: s.date || d.receivedAt || '',
        when: when(s.date || d.receivedAt || ''),
        kind: st.kind,
        label: st.label,
        c: st.c,
        why: whyOf(d, st, o),
        detail: d.error || '',
        transport: d.transport === 'engine' ? 'library' : 'dealership',
        removable: d.transport === 'engine' && !!d.neverShared && st.kind !== 'ok',
        canSend: st.kind === 'wait' || (st.kind === 'att' && d.convertFailed)
      };
      const had = out.get(d.sessionId);
      if (!had) out.set(d.sessionId, row);
      else if (rank[row.kind] < rank[had.kind]) out.set(d.sessionId, { ...row, why: row.why });
      else if (row.kind === 'ok' && had.kind === 'ok' && had.transport !== row.transport)
        had.why = 'Sent to the shared library and the Dealership';
    }
    return [...out.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }
  const count = (list, kind) => list.filter(r => r.kind === kind).length;

  // the whole page: { tone ('ok' | 'fix' | 'off'), kicker, headline, line, pills, cards, rows, counts, fix: the steps of Fix it }
  function summary(input) {
    const st = input.status || {},
      lib = input.library || {},
      c = st.connection && st.connection.mode !== 'local' ? st.connection : null,
      libOn = !!lib.available,
      dealerOn = !!(c && st.connected && st.hasCode);
    const list = rows(st.deliveries, input.sessions, { dealershipOn: dealerOn });
    const att = count(list, 'att'),
      wait = count(list, 'wait'),
      sent = count(list, 'ok'),
      open = att + wait;
    const last = list.find(r => r.kind === 'ok');
    const dealer = !c
      ? { state: 'NOT SET UP', c: N, line: 'Connect to Paddock on another computer to race its cars and send it results.' }
      : dealerOn
        ? {
            state: `CONNECTED · ${c.name}`,
            c: G,
            line: input.remembered
              ? 'Password remembered on this computer. Reconnects by itself.'
              : 'Connected until Timing closes. Remember the password to reconnect by itself.'
          }
        : {
            state: `OFFLINE · ${c.name}${hostOf(c.address) ? ' ' + hostOf(c.address) : ''}`,
            c: A,
            line: st.error
              ? reason(st.error)
              : st.hasCode
                ? 'Paddock may have restarted on another port.'
                : 'Enter the Dealership password to connect again.'
          };
    const fix = [];
    if (c && !dealerOn)
      fix.push({
        act: 'reconnect',
        text: input.remembered ? 'Connect to the Dealership again' : 'Find the Dealership and ask for its password'
      });
    const retry = list.filter(r => r.kind === 'att' && r.canSend).length;
    if (wait)
      fix.push({ act: 'send', text: `Send the ${wait} ${wait === 1 ? 'result' : 'results'} that ${wait === 1 ? 'waits' : 'wait'}` });
    else if (retry) fix.push({ act: 'send', text: 'Try the races that could not be shared again' });
    if (att) fix.push({ act: 'open', text: att === 1 ? 'Open the race that needs a look' : `Show the ${att} races that need a look` });
    const tone = fix.length ? 'fix' : !libOn && !c ? 'off' : 'ok';
    const headline =
      tone === 'fix'
        ? open
          ? `${open} ${open === 1 ? 'result needs' : 'results need'} you`
          : 'The Dealership is offline'
        : tone === 'off'
          ? 'Paddock is not connected'
          : sent
            ? 'All results are in Paddock'
            : 'Paddock is ready';
    const bits = [];
    if (att)
      bits.push(att === 1 ? 'One race cannot be shared until you look at it' : `${att} races cannot be shared until you look at them`);
    if (wait) bits.push(wait === 1 ? 'one is waiting to be sent' : `${wait} are waiting to be sent`);
    if (c && !dealerOn) bits.push(`the Dealership ${c.name} is offline`);
    const line =
      tone === 'fix'
        ? bits.join(', ').replace(/^./, x => x.toUpperCase()) + '. Your cars and racing are not affected.'
        : tone === 'off'
          ? 'Start Paddock on this computer to share its cars, or connect to a Dealership on the network.'
          : `${input.cars ? input.cars + ' cars from Paddock are ready to race. ' : ''}${sent ? `Every finished race has been delivered${last && last.when ? ', the last one on ' + last.when.replace(' · ', ' at ') : ''}.` : 'Finished races are sent by themselves.'}`;
    return {
      tone,
      kicker: 'Paddock · results and cars',
      headline,
      line,
      pills: [
        { text: libOn ? 'THIS COMPUTER · ON' : 'THIS COMPUTER · OFF', c: libOn ? G : N },
        {
          text: !c ? 'DEALERSHIP · NOT SET UP' : dealerOn ? 'DEALERSHIP · CONNECTED' : 'DEALERSHIP · OFFLINE',
          c: !c ? N : dealerOn ? G : A
        }
      ],
      cards: {
        library: {
          on: libOn,
          state: libOn ? 'ON · NO PASSWORD NEEDED' : 'OFF',
          c: libOn ? G : N,
          cars: input.cars || 0,
          shared: list.filter(r => r.kind === 'ok' && r.transport === 'library').length
        },
        dealer: {
          ...dealer,
          set: !!c,
          on: dealerOn,
          cars: dealerOn ? input.dealerCars || 0 : null,
          waiting: list.filter(r => r.kind === 'wait' && r.transport === 'dealership').length
        },
        results: {
          state: open
            ? [att && `${att} NEED${att === 1 ? 'S' : ''} A LOOK`, wait && `${wait} WAITING`].filter(Boolean).join(' · ')
            : 'ALL DELIVERED',
          c: att ? R : wait ? A : G,
          sent,
          open
        }
      },
      rows: list,
      counts: { all: list.length, open, sent },
      fix
    };
  }
  const hostOf = a => {
    try {
      return new URL(a).hostname;
    } catch {
      return '';
    }
  };

  // the connection check, step by step, from what happened: [{ text, state: 'ok' | 'bad' | 'busy' | 'todo' }]
  function connectSteps(o) {
    const name = o.name || 'the Dealership',
      Name = name.charAt(0).toUpperCase() + name.slice(1);
    const steps = [
      { text: `Find ${name} on the network`, state: 'todo' },
      { text: 'Password accepted', state: 'todo' },
      { text: 'It is the same Paddock database', state: 'todo' }
    ];
    if (o.busy) {
      steps[0].state = 'busy';
      return steps;
    }
    if (o.ok)
      return [
        { text: `Found ${name} on the network`, state: 'ok' },
        { ...steps[1], state: 'ok' },
        { ...steps[2], state: 'ok' }
      ];
    if (!o.error) return steps;
    const e = String(o.error);
    if (/UNAUTHENTICATED|password|unauthori[sz]ed/i.test(e)) {
      steps[0] = { text: `Found ${name} on the network`, state: 'ok' };
      steps[1] = { text: 'The password was not accepted', state: 'bad' };
    } else if (/DATABASE_MISMATCH|different Paddock database|host identity/i.test(e)) {
      steps[0] = { text: `Found ${name} on the network`, state: 'ok' };
      steps[1].state = 'ok';
      steps[2] = { text: 'This is another Paddock database', state: 'bad' };
    } else steps[0] = { text: `${Name} could not be reached`, state: 'bad' };
    return steps;
  }

  // the Dealerships found on the network: one card per Paddock (it answers on every network adapter), on its most likely address
  function hosts(found) {
    const score = a =>
      /\/\/192\.168\./.test(a) ? 0 : /\/\/10\./.test(a) ? 1 : /\/\/172\./.test(a) ? 2 : /\/\/(127\.|localhost)/.test(a) ? 4 : 3;
    const best = new Map();
    for (const h of Array.isArray(found) ? found : []) {
      if (!h || !h.id || !h.address) continue;
      const had = best.get(h.id);
      if (!had || score(h.address) < score(had.address)) best.set(h.id, h);
    }
    return [...best.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }
  const api = { reason, hosts, stateOf, rows, summary, connectSteps, when, clock, COLORS: { G, A, R, N } };
  root.PitLane = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
