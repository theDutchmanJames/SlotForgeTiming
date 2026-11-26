// The checks before a race (2.4.0, SlotForgeRestyle.md "Status Lights"): what the three lights of the main menu say and what their drop-down shows.
// Three subjects, each a light: Timing (the timing hardware), Next race (the race setup on Home: what must be fixed before Start, what is good to know,
// what is ready) and Sharing (the network, the shared library, the backup). Red: must be put right (for the race: Start stays off); amber: good to
// know; green: ready; grey: off. Pure: Home gives it what it knows (landing.js), the main menu draws it (mainbar.js).
(function (root) {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const RANK = { bad: 3, warn: 2, ok: 1, off: 0 };
  const worst = items => items.reduce((w, x) => (RANK[x.level] > RANK[w] ? x.level : w), 'off'); // (only things that are off: grey)
  const plural = (n, one, more) => `${n} ${n === 1 ? one : more}`;

  // what to do about a problem of the race, from its words: the button and where it goes (Home has the row, the plan, the setup)
  function fixOf(text) {
    const t = String(text || '');
    if (/no track|number of lanes|length of the lanes|lane lengths/i.test(t)) return { go: 'setup', label: 'Open the race setup' };
    if (/heat plan|every heat|each heat/i.test(t)) return { go: 'home', label: 'Adjust the plan' };
    if (/\bcar\b|cars?\b.*(used|choose)|slotcar|paddock car/i.test(t)) return { go: 'home', label: 'Choose a car' };
    if (/team/i.test(t)) return { go: 'home', label: 'Choose the teams' };
    if (/driver|rival/i.test(t)) return { go: 'home', label: 'Choose the drivers' };
    if (/class/i.test(t)) return { go: 'home', label: 'Choose the classes' };
    return { go: 'home', label: 'Show on Home' };
  }

  // o = { hasSetup, setupName, issues: [text], raceOn, entries (filled rows), lanes, trackName, systems: [names], layoutName, audioName, chips: HomeStats.chips }
  function build(o = {}) {
    const chips = o.chips || [],
      chip = k => chips.find(c => c.key === k);
    // ---- the next race ----
    const race = [];
    if (o.raceOn)
      race.push({
        level: 'ok',
        title: 'A race is on',
        sub: 'Finish it on the Race tab before the next one',
        fix: { go: 'race', label: 'Open the race' }
      });
    else if (o.stale && o.hasSetup)
      race.push({
        level: 'warn',
        title: 'Open Home to check the next race again',
        sub: 'Drivers, cars or setups may have changed since',
        fix: { go: 'home', label: 'Open Home' }
      });
    if (o.raceOn) {
      /* (said above) */
    } else if (!o.hasSetup)
      race.push({ level: 'warn', title: 'No race setup chosen', sub: 'Pick one on Home', fix: { go: 'home', label: 'Choose one' } });
    else {
      const issues = (o.issues || []).filter(Boolean);
      issues.forEach(t => race.push({ level: 'bad', title: String(t), fix: fixOf(t) }));
      const rowsBad = issues.some(t => /driver|car|team|rival|class/i.test(t));
      if (!rowsBad && o.entries)
        race.push({
          level: 'ok',
          // (audit 2026-11) said for the kind of race: a heat race has participants (or teams), not lanes; Solo is one driver and one car
          title:
            o.kind === 'solo'
              ? 'Driver and car ready'
              : o.kind === 'teams'
                ? `${plural(o.entries, 'team', 'teams')} with a car`
                : o.kind === 'seats'
                  ? `${plural(o.entries, 'participant', 'participants')}, a car on every lane`
                  : o.kind === 'heats'
                    ? `${plural(o.entries, 'participant', 'participants')} with a car`
                    : `Drivers and cars on ${o.entries === o.lanes ? 'all ' : ''}${plural(o.entries, 'lane', 'lanes')}`,
          sub: o.names || ''
        });
      if (o.trackName && !issues.some(t => /track|lanes/i.test(t)))
        race.push({ level: 'ok', title: `${o.trackName} · ${plural(o.lanes || 0, 'lane', 'lanes')}` });
      race.push(
        o.systems && o.systems.length
          ? { level: 'ok', title: 'Race systems ready', sub: o.systems.join(' · ') }
          : { level: 'ok', title: 'No race systems', sub: 'Laps and time only' }
      );
      if (o.layoutName) race.push({ level: 'ok', title: 'Race screen', sub: o.layoutName });
      race.push(
        o.audioName
          ? { level: 'ok', title: 'Audio set', sub: o.audioName }
          : { level: 'warn', title: 'No audio set', sub: 'Nothing is announced during the race', fix: { go: 'setup', label: 'Choose one' } }
      );
    }
    // (what must be fixed first, then what is good to know, then what is ready)
    race.sort((a, b) => RANK[b.level] - RANK[a.level]);
    // ---- the timing hardware ----
    const tm = chip('tm'),
      timing = [];
    if (tm) {
      const lvl = tm.state === 'on' || tm.state === 'ok' ? 'ok' : tm.state === 'warn' || tm.state === 'bad' ? 'bad' : 'bad';
      timing.push({
        level: lvl,
        title: tm.text,
        sub:
          lvl === 'ok'
            ? ''
            : /none|no timing/i.test(tm.text)
              ? 'Laps are only counted by hand (the number keys) or simulated'
              : 'Laps are not counted until it is connected',
        fix:
          lvl === 'ok'
            ? { go: 'sensors', label: 'Test sensors' }
            : { go: 'hardware', label: /none|no timing/i.test(tm.text) ? 'Choose hardware' : 'Connect it' }
      });
    }
    const unused = chip('unused');
    if (unused)
      timing.push({
        level: 'warn',
        title: unused.text,
        sub: 'Only the timing hardware in use counts race laps',
        fix: { go: 'hardware', label: 'Choose it' }
      });
    // ---- sharing ----
    const sharing = [],
      net = chip('net'),
      lib = chip('library'),
      bk = chip('backup');
    if (net)
      sharing.push({
        level: net.state === 'on' ? 'ok' : net.state === 'warn' ? 'warn' : 'off',
        title: net.text,
        sub: o.netAddress || '',
        fix: net.state === 'on' ? { go: 'qr', label: 'Show QR code' } : { go: 'connections', label: 'Connections' }
      });
    if (lib)
      sharing.push({
        level: 'warn',
        title: lib.text,
        sub: 'They are sent when the library can be reached',
        fix: { go: 'connections', label: 'See why' }
      });
    if (bk) sharing.push({ level: 'warn', title: bk.text, sub: 'Make a backup now, or see why', fix: { go: 'backup', label: 'Backups' } });
    const count = chip('count');
    const sections = [
      { key: 'race', title: o.raceOn ? 'This race' : o.setupName ? 'Next race · ' + o.setupName : 'Next race', items: race },
      { key: 'timing', title: 'Timing', items: timing },
      { key: 'sharing', title: 'Sharing', items: sharing }
    ].map(s => ({ ...s, level: worst(s.items) }));
    const bad = race.filter(x => x.level === 'bad').length,
      warn = race.filter(x => x.level === 'warn').length;
    sections[0].note = o.raceOn
      ? 'On the Race tab'
      : bad
        ? `Not ready: ${bad} to fix`
        : warn
          ? `Ready to start · ${warn} to know`
          : o.hasSetup
            ? 'Ready to start'
            : '';
    sections[1].note = timing[0] && timing[0].level === 'ok' ? 'Counting laps' : timing.length ? 'Not counting laps' : '';
    sections[2].note = lib
      ? lib.text.replace(/ waiting (for the shared library|in Paddock)$/, ' to send')
      : sections[2].level === 'ok'
        ? 'Shared'
        : '';
    // (sharing that is off is grey, not red: it is a choice)
    return {
      sections,
      lights: { timing: sections[1].level, race: sections[0].level, sharing: sections[2].level },
      ready: !bad,
      bad,
      warn,
      foot: count ? count.text : ''
    };
  }

  const COLOR = { bad: '#e5484d', warn: '#f2b705', ok: '#3ecf8e', off: '#5b6270' };
  const NAMES = { timing: 'Timing', race: 'Next race', sharing: 'Sharing' };
  // the button of the main menu: three lights in the order Timing, Next race, Sharing
  function lightsHtml(c, open) {
    const say = k => `${NAMES[k]}: ${{ bad: 'needs you', warn: 'good to know', ok: 'ready', off: 'off' }[c.lights[k]]}`;
    return `<button type="button" class="mb-st" id="mb-st" aria-haspopup="dialog" aria-expanded="${open ? 'true' : 'false'}" title="${esc(['timing', 'race', 'sharing'].map(say).join(' · '))}" aria-label="Status: ${esc(['timing', 'race', 'sharing'].map(say).join(', '))}">${[
      'timing',
      'race',
      'sharing'
    ]
      .map(k => `<i class="${esc(c.lights[k])}" style="--c:${COLOR[c.lights[k]]}" aria-hidden="true"></i>`)
      .join('')}<b aria-hidden="true">▾</b></button>`;
  }
  const mark = { ok: '✓', bad: '!', warn: 'i', off: '–' };
  // the drop-down: a section per light, what is in it, a button to put it right; along the bottom what is in the database
  function panelHtml(c, o = {}) {
    const order = ['race', 'timing', 'sharing'];
    return `${order
      .map(k => c.sections.find(s => s.key === k))
      .filter(s => s && s.items.length)
      .map(
        s =>
          `<section class="mbs-sec" data-sec="${esc(s.key)}"><div class="mbs-h" style="--c:${COLOR[s.level]}"><i aria-hidden="true"></i><b>${esc(s.title)}</b>${s.note ? `<small>${esc(s.note)}</small>` : ''}</div><ul>${s.items
            .map(
              x =>
                `<li class="${esc(x.level)}"><i aria-hidden="true">${mark[x.level]}</i><span>${esc(x.title)}${x.sub && x.sub !== x.title ? `<small>${esc(x.sub)}</small>` : ''}</span>${x.fix ? `<button type="button" class="btn" data-st-go="${esc(x.fix.go)}">${esc(x.fix.label)}</button>` : '<span></span>'}</li>`
            )
            .join('')}</ul></section>`
      )
      .join(
        ''
      )}${c.foot || o.live ? `<div class="mbs-foot"><span>${esc(c.foot || '')}</span>${o.live ? `<span>${esc(o.live)}</span>` : ''}</div>` : ''}`;
  }

  const api = { build, fixOf, lightsHtml, panelHtml, COLOR, worst };
  root.RaceCheck = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
