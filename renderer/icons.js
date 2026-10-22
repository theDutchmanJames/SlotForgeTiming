// The line pictures of the app: the tiles of the Live Race page and the tabs along the top. All of them are drawn the same way:
// 24 x 24, a thin rounded line in the colour of the text around them (currentColor), no fill, so a theme or a CSS rule can colour them.
// Pure functions that make SVG text, so they can be tested without a screen.
(function (root) {
  const PATHS = {
    // the tiles of the Live Race page
    timing: '<circle cx="12" cy="13.5" r="8"/><path d="M12 13.5V8.5M9.5 2.5h5M12 2.5v3M18.5 6.5l1.5-1.5"/>',
    board: '<path d="M8 3.5h8v6a4 4 0 0 1-8 0zM8 5.5H4.5v2a3.5 3.5 0 0 0 3.5 3.5M16 5.5h3.5v2a3.5 3.5 0 0 1-3.5 3.5M12 13.5v4M8.5 20.5h7M9.5 17.5h5"/>',
    driver: '<path d="M3.5 15.5a8.5 8.5 0 0 1 17 0v2.5a1 1 0 0 1-1 1h-15a1 1 0 0 1-1-1zM11 11.5h9.5"/><path d="M7 19v1.5M17 19v1.5"/>',
    database: '<path d="M4.5 5.5a2 2 0 0 1 2-2h13v14h-13a2 2 0 0 0-2 2zM4.5 19.5a2 2 0 0 1 2-2h13v3h-13a2 2 0 0 1-2-1zM9 7.5h7M9 10.5h5"/>',
    rules: '<path d="M6 3.5h9l4 4v13H6zM15 3.5v4h4M9.5 12h6.5M9.5 15.5h6.5M9.5 8.5h2.5"/>',
    director: '<path d="M5.5 21V3.5M5.5 4.5h13.5l-2.5 4 2.5 4H5.5"/><path d="M9.5 4.5v8M13.5 4.5v8M5.5 8.5h13"/>',
    tokens: '<path d="M7 3.5h10M7 20.5h10M8 3.5c0 4.5 4 6 4 8.5s-4 4-4 8.5M16 3.5c0 4.5-4 6-4 8.5s4 4 4 8.5"/>',
    // the tabs that have no tile: a house, a race track with its start line, a paint palette, a cog
    home: '<path d="M3.5 11 12 3.8l8.5 7.2M5.5 9.6V20h13V9.6M10 20v-5.5h4V20"/>',
    setup: '<path d="M9.5 4.5h5a7.5 7.5 0 0 1 0 15h-5a7.5 7.5 0 0 1 0-15z"/><path d="M10 9.5h4a2.5 2.5 0 0 1 0 5h-4a2.5 2.5 0 0 1 0-5z"/><path d="M12 4.5v5"/>',
    custom: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.5 0 2.1-.9 2.1-1.9 0-1.5-1.4-1.7-1.4-3 0-1 .8-1.8 1.9-1.8H17a3.5 3.5 0 0 0 3.5-3.5C20.5 6.7 16.7 3.5 12 3.5z"/><path d="M7.6 12h.01M9.8 7.9h.01M14.2 7.4h.01"/>',
    // the sub-tabs of the Race Setup tab (1.45.0): a flag, a warning sign, a spanner, a tyre, a cloud with rain, two arrows going round, a fuel pump, a pair of scales
    // (Time Tokens, the ninth sub-tab, uses the hourglass of the Live Race tile)
    racesetups: '<path d="M4 22V4"/><path d="M4 4h14l-2.5 4.5L18 13H4"/>',
    penalty: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    damage: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    tyre: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21"/>',
    weather: '<path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 14v6M8 14v6M12 16v6"/>',
    safetycar: '<path d="M3.5 17v-3.4l1.9-3.9a2 2 0 0 1 1.8-1.2h9.6a2 2 0 0 1 1.8 1.2l1.9 3.9V17"/><path d="M3 17h18"/><circle cx="7.5" cy="17.5" r="1.8"/><circle cx="16.5" cy="17.5" r="1.8"/><path d="M10.5 8.5V6.2h3v2.3M12 3.8v.5"/>',
    pushsave: '<path d="M4.5 17a8.5 8.5 0 1 1 15 0"/><path d="M12 17l4-6"/><circle cx="12" cy="17" r="1.2"/><path d="M7 9.5l.9.9M12 6.5v1.3M17 9.5l-.9.9"/>',
    championship: '<path d="M7 4h10v5.5a5 5 0 0 1-10 0zM7 6H4v1.5A3 3 0 0 0 7 10.5M17 6h3v1.5a3 3 0 0 1-3 3M12 14.5v3M8 20.5h8M9.5 17.5h5"/><path d="M12 6.2l.8 1.6 1.7.2-1.3 1.2.3 1.7-1.5-.8-1.5.8.3-1.7-1.3-1.2 1.7-.2z"/>',
    rotation: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    fuel: '<path d="M3 22h12M4 9h10"/><path d="M14 22V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v18"/><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0 2-2V9.83a2 2 0 0 0-.59-1.42L18 5"/>',
    balance: '<path d="M12 3v18M5 21h14M5 7h14"/><path d="m5 7-3 8a4 4 0 0 0 6 0z"/><path d="m19 7-3 8a4 4 0 0 0 6 0z"/>',
    // the Start a race card (1.58.0): a slot car, a tick, a warning mark, the little arrow of a choice, and a map pin
    car: '<path d="M1.88 14.62v-1.65c0-.75.52-1.35 1.27-1.5l3.97-.9 2.7-2.47c.3-.3.75-.45 1.12-.45h3.3c.52 0 .98.22 1.27.6l2.1 2.47 3.15.6c.75.15 1.35.83 1.35 1.65v1.65z"/><circle cx="6.75" cy="15.15" r="1.95"/><circle cx="18" cy="15.15" r="1.95"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    alert: '<path d="M12 6v8M12 18.2v.1"/>',
    chevron: '<path d="M6 9.5l6 6 6-6"/>',
    // the Race Setups page (1.69.0): the pile of layers (heats) and the plus of "Start from a kind"
    layers: '<path d="M12 3.5l9 5-9 5-9-5z"/><path d="M3 13.5l9 5 9-5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    // the Race Setup form (1.70.0): the arrow of One race
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    pin: '<path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
    // the Race Setup form with a rail (1.71.0): the start lights (three), a shield (rules and systems), a screen, sliders (Advanced) and a speech bubble (In plain words)
    lights: '<circle cx="5.5" cy="12" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="18.5" cy="12" r="2.5"/>',
    shield: '<path d="M12 3.5l7 2.5v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6z"/>',
    screen: '<path d="M5.5 4.5h13a2 2 0 0 1 2 2V14a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.5a2 2 0 0 1 2-2z"/><path d="M8.5 20.5h7M12 16v4.5"/>',
    sliders: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    say: '<path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-7.5L7 20v-3.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z"/>',
    // the system forms with a rail (1.73.0): a clock (the time rule), a ban (disqualification), steps, lines, a bolt (incidents), a garage (the stop in the pits), the cog of a failure, two parallel jobs, a bin and the "i" of a note
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ban: '<circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/>',
    stairs: '<path d="M4 18h4v-4h4v-4h4V6h4"/>',
    lines: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    garage: '<path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M10 21v-6h4v6"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/>',
    parallel: '<path d="M4 8h16M4 16h16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    // the form of a weather system (1.74.0): a die (a random moment), the wind (the wrong tyres hinder a car) and a thermometer (the conditions on the track)
    dice: '<path d="M7 4h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3z"/><circle cx="9" cy="9" r="1"/><circle cx="15" cy="15" r="1"/><circle cx="15" cy="9" r="1"/><circle cx="9" cy="15" r="1"/>',
    wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
    thermo: '<path d="M14 14.8V5a2 2 0 0 0-4 0v9.8a4 4 0 1 0 4 0z"/>',
    // the tyre wear system form (1.75.0): a dial with a needle (what worn tyres do) and a bell (the warnings)
    gauge: '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4-6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4"/>',
    // a button: a page with a folded corner and an arrow going down (Export to PDF)
    pdf: '<path d="M6 3.5h8l4 4v13H6zM14 3.5v4h4M12 10.5v6M9.5 14l2.5 2.5 2.5-2.5"/>',
    settings: '<path d="M10.3 4.9 10.75 2.68h2.5L13.7 4.9A7.3 7.3 0 0 1 15.81 5.78L17.7 4.53 19.47 6.3 18.22 8.19A7.3 7.3 0 0 1 19.1 10.3L21.32 10.75v2.5L19.1 13.7A7.3 7.3 0 0 1 18.22 15.81L19.47 17.7 17.7 19.47 15.81 18.22A7.3 7.3 0 0 1 13.7 19.1L13.25 21.32h-2.5L10.3 19.1A7.3 7.3 0 0 1 8.19 18.22L6.3 19.47 4.53 17.7 5.78 15.81A7.3 7.3 0 0 1 4.9 13.7L2.68 13.25v-2.5L4.9 10.3A7.3 7.3 0 0 1 5.78 8.19L4.53 6.3 6.3 4.53 8.19 5.78A7.3 7.3 0 0 1 10.3 4.9z"/><circle cx="12" cy="12" r="3"/>'
  };
  const has = id => Object.prototype.hasOwnProperty.call(PATHS, id);
  // o.size: width and height in pixels; o.cls: the class of the picture; o.stroke: the thickness of the line (in the 24 x 24 drawing)
  const svg = (id, o) => {
    if (!has(id)) return '';
    const size = Math.round(Number(o && o.size)) || 24, stroke = Number(o && o.stroke) || 1.6, cls = String((o && o.cls) || '').replace(/[^\w -]/g, '');
    return `<svg${cls ? ` class="${cls}"` : ''} viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[id]}</svg>`;
  };
  // The winner's cup (next to the winner of a race or a heat in the results, the PDF and the race review). Unlike the line pictures above it has its own colours (gold),
  // so it looks the same on every theme and on paper. o.size: width and height in pixels.
  const trophy = o => {
    const size = Math.round(Number(o && o.size)) || 16;
    return `<svg class="trophy" viewBox="0 0 24 24" width="${size}" height="${size}" role="img" aria-label="Winner"><title>Winner</title>`
      + '<path d="M7.5 5.5H4.2v2a3.6 3.6 0 0 0 3.5 3.6M16.5 5.5h3.3v2a3.6 3.6 0 0 1-3.5 3.6" fill="none" stroke="#a86f00" stroke-width="1.5" stroke-linecap="round"/>'
      + '<path d="M7 3h10v6.7a5 5 0 0 1-10 0z" fill="#f5b800" stroke="#a86f00" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<path d="M12 14.7v2.6" stroke="#a86f00" stroke-width="1.5" stroke-linecap="round"/>'
      + '<path d="M8.2 21h7.6l-.9-3.7H9.1z" fill="#f5b800" stroke="#a86f00" stroke-width="1.5" stroke-linejoin="round"/>'
      + '<path d="M9.6 5.2v4" stroke="#fff3b0" stroke-width="1.3" stroke-linecap="round"/></svg>';
  };
  const api = { PATHS, has, svg, trophy };
  root.Icons = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
