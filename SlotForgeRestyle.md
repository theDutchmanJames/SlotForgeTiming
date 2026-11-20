# SlotForge Restyle

The shared look of the SlotForge apps, first built in SlotForge Timing 2.4.0 (November 2026).
This file is the source to copy from: every style has a **name**, what it is for, which elements it applies to,
the markup it expects, and CSS you can paste. Timing's own `renderer/styles.css` holds the same rules,
spread over older layers; the CSS here is the final result in one block per style.

**For a Claude session restyling another SlotForge app:** read [How to adopt](#how-to-adopt) first, then
take the styles you need from the [catalogue](#the-catalogue). Rename the class names to the app's own,
or add these class names to its markup. Keep the [Rules of the look](#rules-of-the-look).

---

## The catalogue

| Name | What it is | Used in Timing for |
|---|---|---|
| [Graphite](#graphite) | The colour tokens: neutral surfaces, one accent | Everything |
| [Type Trio](#type-trio) | Barlow Condensed titles, Segoe UI / Inter text, Roboto Mono numbers | Everything |
| [Paint](#paint) | The colour of a system (`--c`), used only as a highlight | Race systems, their icons, tiles and bars |
| [Pit Buttons](#pit-buttons) | One button family: primary, secondary, outline, danger, icon, small | Every button outside the race screen |
| [Paddock Rail](#paddock-rail) | A page with a side list of its sections on the left | Race Setup, Customization, Database, App Settings |
| [Double Rail](#double-rail) | A second Paddock Rail beside the first, for the tabs and sections of one page, and a plain canvas with one section at a time | Every page of App Settings |
| [Settings Sheet](#settings-sheet) | Groups of slim two-half rows (name and one line left, control right) with one 30px control kit; no sliders | The canvas of every App Settings page |
| [System Sheet](#system-sheet) | A system or setup editor as one page of sheets, the rail as its table of contents, a Page Note at the top | Every editor with a rail (Race Systems, Race Setups, Extras, Championships, Rotation) |
| [Help Reader](#help-reader) | A help article as a calm one-column document with a plain-words lead and pill chips for related guides | App Settings › Help |
| [Page Note](#page-note) | The box under a page title that explains the page | Every Race Setup page |
| [Control Strip](#control-strip) | One tight toolbar: Add, tools, search, List / Grid, pager | Database lists, system lists |
| [Gear Selector](#gear-selector) | A quiet segmented control | List / Grid, filters, choices in forms, inner tabs |
| [Garage Card](#garage-card) | A picture card: picture edge to edge, title, detail rows, button foot | Other picture lists (the Database lists are a [Garage](#garage) since 2.4.0) |
| [Showroom Card](#showroom-card) | A card whose top is a real, scaled preview of the design it stands for | Layouts, row designs, charts, widgets, picture sets |
| [Entry Card](#entry-card) | An icon card: tile, eyebrow, name, facts, "Used by", button foot | Race setups, race systems, rotations, championships |
| [Replay Monitor](#replay-monitor) | Settings in folders on the left, a live preview of the real screen on the right | Race Results |
| [Workshop Window](#workshop-window) | The baseline window (dialog) | Add Track and every Database form, Circuit design |
| [Folder](#folder) | A collapsible section with a Barlow title and a chevron | Groups in forms, settings, results |
| [Pit Board](#pit-board) | The two-layer bar on top of a full-screen editor: back, big name, saved state, Undo / Redo / Save; tools below | Layout, Leaderboard, Chart, Widget, picture and audio set editors |
| [Widget Bench](#widget-bench) | Settings on the left, the real widget on a sample race screen on the right | Widget Builder › Simple text or image |
| [Picture Bench](#picture-bench) | Kind cards, drop-on picture tiles, a big live preview with a slider | Image Settings › a picture set |
| [Tech Sheet](#tech-sheet) | A big editor: header with name, side list of sections, plain-words summary, folders, sticky foot | Add / Edit Race System, Race Setup editor |
| [Toggle Chips](#toggle-chips) | Checkboxes as pill switches | View settings, Hide unused systems |
| [Broadcast Hero](#broadcast-hero) | A header picture across the page with big titles on it | Home |
| [Grid Slot](#grid-slot) | A lane of Start a race: name, car and Browse cars on the left, the driver as a full-height portrait on the right | Home › Start a race |
| [Home Cards](#home-cards) | Every card under Start a race with an idea of its own, and seven new cards | Home |
| [Pit Wall](#pit-wall) | The main menu as one slim bar: grouped tabs, status lights, Find, ON AIR, and a race strip while a race runs | The top of every page |
| [Start Lights](#start-lights) | A step-by-step card with a gantry of step lights, lane-coloured name rows, choice tiles and a ticket; connect inside, cars from the library, Commentary, Back to the guide | The setup guide on Home |
| [Plugged In](#plugged-in) | The Home cards for a USB device that was plugged in: why they ask, a failed connect on the card, the DS model, Undo | Home |
| [Profile Cards](#profile-cards) | Balance of Power and Time Tokens as named profiles: the Club default and profile cards with Used by; the editor of a profile as its window | Race Setup › Balance of Power, Time Tokens |
| [Entry Classes](#entry-classes) | The class of an entry picked in its lane on Home, the class counts, a virtual rival added in a lane | Home (Start a race) |
| [Rotation Board](#rotation-board) | The rotation editor's lanes from a track, participants from an entry list, and Lane fairness | Race Setup › Rotation Setups |
| [Lane Check](#lane-check) | A column per lane in its colour with a sensor light that turns green; the lanes one at a time with a swap found, the pit lane, Track call and track power as checks, Connect | Test sensors (Home, Timing Desk, setup guide) |
| [Flag Dialog](#flag-dialog) | Yes / No and message windows with a badge for the kind and a filled red answer for what cannot be undone | Every confirm and message window |
| [Lane Desk](#lane-desk) | The race screen under the widgets: a card per lane with everything for that car, a race column, the tables as tabs, the keys as key caps | Race tab (with the lane cards on) |
| [Race Sheet](#race-sheet) | The tables of a race: small grey capitals over the columns, quiet rows, numbers in Roboto Mono, notes as a grey line | The Lane Desk's tabs, the Race Director page |
| [Scrutineering](#scrutineering) | Finalize race results: the classification as slim rows with a tiny lap chart, a lap explorer with a chart, filters, suspect laps and several laps at once | After the race |
| [Cue Card](#cue-card) | A call of an audio set: when it plays, every line at once with ▶ and ⋯, race values as chips, one more line | Customization › Audio Settings |
| [Race Report](#race-report) | A saved race: a row with a date tile and the winner, opened as a report with the podium, the classification and a lap table | Database › Results and Records |
| [Heat Board](#heat-board) | A heat race under the race screen: Next up with Start, the heats as cards, the overall result, the lanes of a final as tiles | Race tab (heat races) |
| [Title Fight](#title-fight) | The standings of a championship: the season as a band, the first three as podium cards, the standings as a Race Sheet, the rounds as cards | Database › Results and Records › Championships |
| [Status Lights](#status-lights) | The three lights of the main menu (Timing, Next race, Sharing) as one button; its drop-down is the check before the start | Main menu, every page |
| [Setup Sheet](#setup-sheet) | The race setup form: the race in one line with chips, Set and Missing in the rail, six kinds, the tracks as cards, Start and flags, a system and its switch on one row | Race Setup › Edit |
| [Garage](#garage) | The Database lists: a car drawn in its livery, a driver's helmet and callsign, a track with its lanes; figures from the races; filters with counts, sort, ticks; no red on a card | Database › Slotcars, Drivers, Tracks, Teams |
| [Build Sheet](#build-sheet) | The car editor: the drawn car on top, a rail of sections, the gearing worked out, a service meter and log, More for the rest | Database › Slotcars › Edit |
| [Record Book](#record-book) | Results and Records: track records as cards with their history, one filter bar, the races by month, a driver panel, a driver's history, correcting a result | Database › Results and Records › Racing Records |
| [Timing Desk](#timing-desk) | Timing Hardware: a big card for what counts the laps, live lanes, the interfaces as cards with Connect & use, an interface's parts as tabs, Diagnostics folded away, finding the lane order | App Settings › Timing Hardware |
| [Commentary Booth](#commentary-booth) | The audio set editor: the voice on air first, the presets as cards, driver names said or recorded, a sample race | Customization › Audio Settings › Edit |
| [Widget Workshop](#widget-workshop) | The Widget Builder: widgets as cards on a race screen, Used in, Add to a layout, Simple / Canvas, eight lanes, Play a race; the Fuel Strip | Customization › Widget Builder |
| [Race Control](#race-control) | The race window while a race is on: a bar with the state in words and the colour of its flag, the clock and the controls; a track call as a decision; the order as a timing tower; the race screen as a monitor | Race tab |
| [Chequered Flag](#chequered-flag) | The screens after a race as broadcast graphics: the winner big with the lane's helmet, a timing tower, the race story, the title fight as big as the race, the break between heats | Race tab, after Finalize |
| [Record Card](#record-card) | The card of a slotcar, a driver or a track: the picture beside the name, the statistics as tiles, the service with a meter, the progress of a driver as track cards | Database (a click on a row or card) |
| [Token Desk](#token-desk) | The time tokens of a Time Token Session: a card for every lane with the clock large, the buttons as a grid, the state as the edge | Race tab and Live Race › Tokens (Time Token Sessions) |
| [Live Pages](#live-pages) | The Live Race pages that follow the race: a Page Bar with the phase as a pill, Customize as a button, the classic leaderboard as a Race Sheet in the lane colours, Driver stats as tiles | Live Race (second screen, tablets, phones) |
| [Plugin Desk](#plugin-desk) | The open page or tool of a plugin: a head with the plugin as a status pill, the inputs and the output in boxes, the figures as tiles | Customization › Plugin Pages & Tools |
| [Dealership Sheet](#dealership-sheet) | Dealership Mode: the connection as a status pill, rows with several controls stacked, the long words folded | App Settings › Connections › Paddock › Older connections and repair (since the Paddock Pit Lane) |
| [Paddock Pit Lane](#paddock-pit-lane) | Paddock on one page: a headline that says how things stand with Fix it, three equal cards (shared library, Dealership, results), the results in plain words, Dealerships found as cards | App Settings › Connections › Paddock |
| [Engineer's Bench](#engineers-bench) | Calculations: each topic as a question, Try it (dashed, nothing is saved) beside Your rules (one save bar), the formulas with your numbers | App Settings › Calculations |
| [Review Sheet](#review-sheet) | Historical Review: the race as a head, the notice as a callout, the drivers tagged, Submit in the foot, the decisions as pills | Results and Records (a Paddock race) |
| [Performance Gauges](#performance-gauges) | The Performance line as a row of small gauges, each with a health colour | Race tab (App Settings › General, Performance line) |
| [Race Report PDF](#race-report-pdf) | The race on paper: page one as clubs post a race, then a page for every driver with the lap chart of Scrutineering; Colour or Monochrome | Results and Records › Export to PDF |
| [Update Window](#update-window) | A newer version: the window with What's new, Skip and Download, and the Updates section in App Settings | Every SlotForge app (as Circuit has it) |
| [Live Desk](#live-desk) | An ON AIR panel and the pages as row tiles in two groups, a compact list on a phone | Live Race landing, second screen, phones |
| [Parc Fermé](#parc-fermé) | A picker window: sticky head, one Control Strip with search, small picture cards | Choose a car (Browse cars) |
| [Choice Rows](#choice-rows) | Radio rows as whole-row buttons, short options as tiles; signs as line pictures in the rail | App Settings › Timing Hardware |
| [Timing Tower](#timing-tower) | A ranked list: position, colour stripe, time, gap chip | Personal Bests card |
| [Rulebook](#rulebook) | A document page: header, sheet with a grouped toolbar | Racing Rules |
| [Light themes](#light-themes) | Theme tokens for the dark tracks and the unlit lights | Every light theme |
| [Finishing Touches](#finishing-touches) | Scroll bars and file pickers in the theme | Everything |

### Recipes: which styles make a page

| Page in Timing | Built from |
|---|---|
| **Database main page** | Paddock Rail + Control Strip + Garage Card (+ Gear Selector for List / Grid) |
| **Add Track** (and every "Add …" form of the Database) | Workshop Window + Folder + Pit Buttons |
| **Add Race System** (Add Fuel, Safety Car, Weather…) | Tech Sheet (with Folder, Gear Selector, Pit Buttons inside) |
| **Race Setup page** (list of systems) | Paddock Rail + Page Note + Control Strip + Entry Card |
| **Customization** | Paddock Rail + Page Note + Showroom Cards (Layout, Leaderboard, Chart, Widget Builder, Image Settings), Entry Cards (Audio), Replay Monitor (Race Results) |
| **App Settings** | Double Rail on every page; **General** also has Choice Tiles, switch rows and stat tiles |
| **Racing Rules** | Rulebook |
| **Layout / Leaderboard / Chart editor** | Pit Board + the editor's own canvas and side panels |
| **Simple widget** | Pit Board + Widget Bench |
| **Picture set** | Pit Board + Picture Bench |
| **Audio set** | Pit Board + Tech Sheet with a call list |
| **Home** | Broadcast Hero + cards (Timing Tower inside one) |
| **Setup guide** | Start Lights (+ Lane Check at step 5) |
| **Race tab** (under the widgets) | Lane Desk (Control Strip on top, Gear Selector for the weather, Toggle Chips for the racing systems) |
| **Race Director page** (Live Race) | Lane Desk (the race buttons as its Control Strip) + Race Sheet |
| **Finalize race results** | Scrutineering (+ Pit Buttons) |
| **Live Race** (also on phones) | Live Desk |
| **Choose a car** | Parc Fermé (Workshop Window + Control Strip + Gear Selector + Garage Cards) |

So you can say: *"give the Results page a Paddock Rail and make its rows Entry Cards"* or
*"the import window should be a Workshop Window, not a Tech Sheet"*.

---

## Rules of the look

1. **One accent.** The theme accent (red in the default theme) is for the main action of a screen, the
   selected thing and focus. Never for titles, never as a big fill. A title in red is a mistake.
2. **Neutral surfaces.** Backgrounds, cards, side lists and boxes are graphite: `--bg`, `--panel` and mixes
   of `--ink` into `--panel` (4–13 %). No coloured gradients behind text.
3. **Paint only as a highlight.** A system colour (`--c`) shows on its icon tile, the icon of the open item
   and its bars. Never on the window, its title or its buttons.
4. **Titles in Barlow.** Page titles, card titles, folder titles and window titles: Barlow Condensed,
   bold, italic, capitals. Everything you read (text, labels, buttons, fields, tables) stays in the plain type.
   Numbers that are data (times, laps, values) are in Roboto Mono.
5. **Explain in plain words.** A page starts with a Page Note: what it is in one line, a few words more,
   and where you use it. Simple settings first; the rest under "Only if you need it".
6. **Quiet controls.** Buttons are flat, 32 px high (28 px small). Choices are a Gear Selector, not a row
   of coloured buttons. Danger is red text, not a red block.
7. **Side lists, not tab strips,** for the sections of a big page. Plain icons, small group headings.

---

## Graphite

The colour tokens. Every style below uses only these (plus `--c` from [Paint](#paint)).

```css
/* default dark theme */
[data-theme="dark"]{
  --bg:#171b21;        /* page background */
  --panel:#222831;     /* cards, windows, side lists */
  --ink:#e8e6e1;       /* text */
  --muted:#98a0ab;     /* secondary text, icons at rest */
  --line:#343b47;      /* borders, dividers */
  --accent:#e5484d;    /* the one accent */
  --accent-fill:#d6383e; /* fill of a primary button (a touch darker for contrast) */
  --accent-text:#f06b6f; /* accent used as text on dark (a touch lighter) */
  --on-accent:#fff;    /* text on the accent */
}
[data-theme="light"]{--bg:#f1efea;--panel:#ffffff;--ink:#1d2229;--muted:#656c76;--line:#d9d6cf;--accent:#c92424;--on-accent:#fff}
```

Timing has more themes (midnight, forest, sunset, violet, carbon, ocean); they only change these values.
Use `var(--accent-fill,var(--accent))` and `var(--accent-text,var(--accent))` so themes without them still work.

Common mixes (use these, not new colours):

| Use | Value |
|---|---|
| Hover on a transparent item | `color-mix(in srgb,var(--ink) 6%,transparent)` |
| Selected item in a list | `color-mix(in srgb,var(--ink) 10%,var(--panel))` |
| Secondary button | `color-mix(in srgb,var(--ink) 8%,var(--panel))` (hover 13 %, pressed 17 %) |
| Side list / foot background | `color-mix(in srgb,var(--bg) 55%,var(--panel))` |
| Quiet inner box | `color-mix(in srgb,var(--ink) 4%,var(--panel))` |
| Soft tile behind an icon | `color-mix(in srgb,var(--c) 16%,var(--panel))`, icon `var(--c)` |
| "Good / ready" dot | `#3ecf8e` |
| Focus ring | `outline:3px solid #4c9aff;outline-offset:2px` |

---

## Type Trio

| Role | Font | Where |
|---|---|---|
| **Titles** | `'SF Barlow Condensed','Bahnschrift',sans-serif`, 700, italic, uppercase, `letter-spacing:.02em` | h1–h3, card / folder / window titles, side list title |
| **Text** | `"Segoe UI",system-ui,sans-serif` (Inter is bundled as `'SF Inter'` for widgets) | Body, labels, buttons, fields |
| **Numbers** | `'SF Roboto Mono',Consolas,monospace`, 500 | Times, values in detail rows, counters |

Fonts are bundled (all SIL Open Font License, see each folder's licence file) in Timing's
`renderer/fonts/` (`barlowcondensed/`, `inter/`, `robotomono/`). Copy the folders and these faces:

```css
@font-face{font-family:'SF Barlow Condensed';src:url('fonts/barlowcondensed/BarlowCondensed-Bold.ttf') format('truetype');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'SF Barlow Condensed';src:url('fonts/barlowcondensed/BarlowCondensed-BoldItalic.ttf') format('truetype');font-weight:700;font-style:italic;font-display:swap}
@font-face{font-family:'SF Inter';src:url('fonts/inter/Inter[opsz,wght].ttf') format('truetype');font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:'SF Roboto Mono';src:url('fonts/robotomono/RobotoMono[wght].ttf') format('truetype');font-weight:100 700;font-style:normal;font-display:swap}
```

The app-wide title rule (`#view` is the page area, adjust to the app's root; exclude rich text that people write themselves):

```css
#view :is(h1,h2,h3):not(.rte *):not(.rte),
dialog :is(h2,h3){
  font-family:'SF Barlow Condensed','Bahnschrift',sans-serif;
  font-weight:700;font-style:italic;text-transform:uppercase;letter-spacing:.02em}
```

Sizes in use: page title 26–30 px, window title 24 px, big name field 30 px, card title 18 px, folder title 17–18 px,
side list title 22 px. Eyebrows above a name are **not** Barlow: `700 11px "Segoe UI"`, `letter-spacing:.14em`, uppercase, `--muted`.

Watch out: Segoe UI at weight 500 renders bold on Windows. Use 400 for normal and 600 for strong.

---

## Paint

Each race system has a colour. It is set as `--c` by a class (`.ss-fuel`, `.ss-sc`, `.ss-wx`…) on the page,
card or window, so the same CSS works for every system.

```css
.setuppage,.setupstrip,.setupform{
  --c-race:var(--accent);--c-fuel:#2fb86a;--c-pen:#f2b705;--c-dmg:#e5484d;--c-tyre:#9b4dff;
  --c-wx:#4c9aff;--c-sc:#ff7a1a;--c-ps:#a6d23c;--c-rot:#c4803f;--c-ch:#ec5f9a;
  --c-vr:#62cbd5;--c-mc:#c6a5f0;--c-resource:#56bfaa;--c-bop:#e8e6e1;--c-tok:#1fb5ad}
.ss-fuel{--c:var(--c-fuel)} .ss-pen{--c:var(--c-pen)} /* …one per system */
```

(These are the dark-theme colours. The light themes use darker ones, e.g. fuel `#1e8a4c`, weather `#0f6fd6`: see the top of Timing's `renderer/styles.css`.)
Practice uses the weather blue and qualifying the penalty yellow, so a session kind has a colour too.

**Where Paint goes:** the icon tile, the icon of the open side-list item, the icon of an open folder, progress and level bars.
**Where it never goes:** window background, titles, buttons, the selected state (that is `--accent` or neutral).

---

## Pit Buttons

One family for every button outside the race screen. Markup: `<button class="btn [primary|ghost|danger|icon|sm]">`.
Icons go inside as an `<svg>` before the text. `.big` (the race screen's huge buttons) is left alone.

| Kind | Class | Use |
|---|---|---|
| Primary | `.btn.primary` | The one main action (Add, Save, Start) |
| Secondary | `.btn` | Normal actions (Edit, Duplicate, Cancel) |
| Outline | `.btn.ghost` | Tools used now and then (Extra fields…, View settings) |
| Danger | `.btn.danger` | Delete, Remove: red text, red tint on hover |
| Icon | `.btn.icon` (+ `aria-label` and `title`) | Pager, bin, refresh: square |
| Small | `.btn.sm` | In card feet and dense rows: 28 px |

```css
:where(#view,dialog) .btn:not(.big){display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:32px;padding:0 12px;border:1px solid transparent;border-radius:7px;background:color-mix(in srgb,var(--ink) 8%,var(--panel));color:var(--ink);font:400 13px/1.2 "Segoe UI",system-ui,sans-serif;box-shadow:none;transform:none;white-space:nowrap;transition:background .12s,border-color .12s}
:where(#view,dialog) .btn:not(.big):hover:where(:not(:disabled)){background:color-mix(in srgb,var(--ink) 13%,var(--panel));border-color:transparent}
:where(#view,dialog) .btn:not(.big):active:where(:not(:disabled)){background:color-mix(in srgb,var(--ink) 17%,var(--panel))}
:where(#view,dialog) .btn:not(.big):disabled{opacity:.45;cursor:not-allowed}
:where(#view,dialog) .btn.primary:not(.big){background:var(--accent-fill,var(--accent));color:var(--on-accent);font-weight:600}
:where(#view,dialog) .btn.primary:not(.big):hover:where(:not(:disabled)){background:var(--accent)}
:where(#view,dialog) .btn.ghost:not(.big){background:transparent;border-color:var(--line)}
:where(#view,dialog) .btn.ghost:not(.big):hover:where(:not(:disabled)){background:color-mix(in srgb,var(--ink) 6%,transparent);border-color:color-mix(in srgb,var(--ink) 25%,var(--line))}
:where(#view,dialog) .btn.danger:not(.big){background:transparent;color:var(--accent-text,var(--accent))}
:where(#view,dialog) .btn.danger:not(.big):hover:where(:not(:disabled)){background:color-mix(in srgb,var(--accent) 12%,transparent)}
:where(#view,dialog) .btn.icon:not(.big){width:32px;padding:0}
:where(#view,dialog) .btn.sm:not(.big){min-height:28px;padding:0 10px;font-size:12.5px}
:where(#view,dialog) .btn.sm.icon:not(.big){width:28px}
:where(#view,dialog) .btn:not(.big) svg{flex:none}
```

`:where()` keeps the specificity low, so an app's special buttons can still override it. In a row of card buttons,
put Delete last with `margin-left:auto`.

---

## Paddock Rail

A page with its sections in a side list on the left (240 px) and the page on the right. Replaces rows of tabs.

```html
<div class="setupshell">
  <nav class="setupstrip" role="tablist" aria-orientation="vertical" aria-label="Race Setup sections">
    <div class="ssrailtitle">Race Setup</div>
    <div class="ssgroup">
      <span class="sslabel">Race systems</span>
      <button class="sstab ss-fuel" role="tab" aria-selected="true" data-id="fuel">
        <svg class="ssico">…</svg><span class="sstext">Fuel Systems</span><i class="ssuse" title="Used by a race setup"></i>
      </button>
      …
    </div>
    <div class="sstools"><button class="sstool"><svg>…</svg><span class="sstext">Hide unused systems…</span></button></div>
  </nav>
  <div class="setuppage ss-fuel"><h2>Fuel Systems</h2><div class="sn" id="setupnote">…</div><div id="setupmgr">…</div></div>
</div>
```

```css
.setupshell{display:grid;grid-template-columns:240px minmax(0,1fr)}
/* fill the window exactly: the page area is a column that grows (body: flex column, min-height 100vh), the shell takes what the header leaves.
   Never a guessed height like calc(100vh - 70px): a header of another height then makes the page scroll a few pixels. */
#view:has(>.setupshell){display:flex;flex-direction:column}
#view>.setupshell{flex:1 0 auto;min-height:0}
/* the app logo in the footer: in the bottom-right corner of the page, not on a strip of its own under the side list */
body:has(>#view>.setupshell)>#app-footer{height:0;padding:0;position:relative;z-index:1;pointer-events:none}
body:has(>#view>.setupshell)>#app-footer .app-brand-logo{position:absolute;right:20px;bottom:16px;pointer-events:auto}
.setupstrip{display:flex;flex-direction:column;gap:2px;padding:22px 12px 24px;border-right:1px solid var(--line);background:color-mix(in srgb,var(--bg) 55%,var(--panel))}
.ssrailtitle{margin:0 10px 14px;font:italic 700 22px/1.1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase;letter-spacing:.02em}
.ssgroup{display:flex;flex-direction:column;gap:2px;margin-top:14px}
.sslabel{margin:0 10px 6px;font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 80%,var(--bg))}
.sstab{display:flex;align-items:center;gap:11px;width:100%;min-height:36px;padding:7px 10px;border:0;border-radius:8px;background:transparent;color:color-mix(in srgb,var(--ink) 82%,var(--muted));font:inherit;font-size:13.5px;font-weight:400;line-height:1.25;text-align:left;cursor:pointer}
.sstab:hover{background:color-mix(in srgb,var(--ink) 6%,transparent)}
.sstab[aria-selected="true"]{background:color-mix(in srgb,var(--ink) 10%,var(--panel));color:var(--ink);font-weight:600}
.sstab .ssico{width:18px;height:18px;flex:none;color:var(--muted)}
.sstab[aria-selected="true"] .ssico{color:var(--c,var(--accent))}   /* Paint on the open item only */
.sstab:focus-visible{outline:3px solid #4c9aff;outline-offset:3px}
.sstext{flex:1;min-width:0;overflow-wrap:anywhere}
.ssuse{width:6px;height:6px;border-radius:50%;background:#3ecf8e;flex:none}  /* "in use" dot */
/* tools at the end of the list: list items with an icon, the first one dashed so it is found */
.sstools{display:flex;flex-direction:column;gap:2px;margin:16px 0 0;padding-top:12px;border-top:1px solid var(--line)}
.sstool{display:flex;align-items:center;gap:11px;width:100%;min-height:34px;padding:7px 10px;border:1px dashed color-mix(in srgb,var(--ink) 18%,transparent);border-radius:8px;background:transparent;color:color-mix(in srgb,var(--ink) 82%,var(--muted));font:inherit;font-size:13px;text-align:left;cursor:pointer}
.sstool+.sstool{border-color:transparent}
.sstool svg{flex:none;color:var(--muted)}
.sstool:hover{background:color-mix(in srgb,var(--ink) 6%,transparent);color:var(--ink)}
/* the page */
.setuppage{min-width:0;padding:24px 30px 64px}   /* 64px: room for the logo in the corner */
.setuppage>h2{margin:0 0 6px;font-size:26px}
/* narrow: the list becomes a wrapping row on top */
@media (max-width:900px){.setupshell{grid-template-columns:minmax(0,1fr)}.setupstrip{flex-direction:row;flex-wrap:wrap;border-right:0;border-bottom:1px solid var(--line);padding:12px}.ssgroup{flex-direction:row;flex-wrap:wrap;margin:0}.sslabel,.ssrailtitle{display:none}.sstab{width:auto}.sstools{flex-direction:row;margin:0;border:0;padding:0}.setuppage{padding:20px}}
```

Timing has a generic builder for it in `renderer/app.js`: `sideShellHtml(title, tabsId, current, names, boxId, extra)`
plus `sideGroups(el, groups)` to put the group headings in. Database, Customization and App Settings use it.
In App Settings a search field sits under the title (`.custrail>.settings-search`, full width, 13 px, `--bg` fill).

---

## Double Rail

For a section with several topics, instead of a window inside the page: a **second Paddock Rail stuck to the first**, one topic at a time on a plain
canvas. The second rail has the section's name in Barlow and every topic with its icon and a one-line status under its name ("100% · Soft lift",
"km/h · metres"), so you see the state of everything without opening it. The canvas shows the topic's header (accent tile, Barlow title, one line of
what it is) and then cards.

Inside the cards:

- **Choice Tiles** for a choice of a few options (a drop-down list becomes tiles that each *show* the option): sizes as letters that grow, depth as small
  cards that stand up more, units with real example values, quality levels with what they mean. The list stays in the page, hidden, and a tile sets it
  and sends its change, so the app's code is unchanged.
- **Switch rows** for on/off settings: the name in bold with a switch on the right, the words under it.
- **Stat tiles** for numbers (database size, media, free disk): the value large in Roboto Mono, a small caption above and a note under.
- A **preview** where a setting changes something you can see (the name and welcome as they look on Home).

```css
.gs{display:grid;grid-template-columns:232px minmax(0,1fr);min-height:100%}
.gs-rail{display:flex;flex-direction:column;gap:2px;padding:22px 10px 24px;border-right:1px solid var(--line);background:color-mix(in srgb,var(--bg) 30%,var(--panel))}
.gs-ri{display:flex;align-items:flex-start;gap:11px;width:100%;padding:8px 10px;border:0;border-radius:8px;background:transparent;text-align:left}
.gs-ri small{font-size:11.5px;color:var(--muted)}                          /* the status line */
.gs-ri[aria-pressed="true"]{background:color-mix(in srgb,var(--ink) 10%,var(--panel));color:var(--ink)}
.gs-canvas{padding:26px 32px 64px}
.gs-head{display:flex;align-items:center;gap:14px}
.gs-headico{display:grid;place-items:center;width:44px;height:44px;border-radius:11px;background:color-mix(in srgb,var(--accent) 14%,var(--panel));color:var(--accent-text,var(--accent))}
.gs-card{display:flex;flex-direction:column;gap:12px;padding:18px 20px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.gs-lead{margin:-6px 0 0;color:var(--muted);font-size:13px}
/* Choice Tiles */
.gs-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
.gs-tile{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;min-height:92px;padding:12px 8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--bg);cursor:pointer}
.gs-tile[aria-pressed="true"]{border-color:color-mix(in srgb,var(--accent) 65%,var(--line));background:color-mix(in srgb,var(--ink) 7%,var(--panel));box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--accent) 40%,transparent)}
.gs-tile em{font:500 12px 'SF Roboto Mono',Consolas,monospace;font-style:normal}   /* an example value */
/* switch rows */
.gs-switchrow{padding:12px 0;border-top:1px solid var(--line)}
.gs-switchrow>label{display:flex;flex-direction:row-reverse;justify-content:space-between;align-items:center;gap:16px;font-weight:600}
.gs-switchrow input{appearance:none;position:relative;width:36px;height:20px;border-radius:10px;background:var(--line)}
.gs-switchrow input::after{content:'';position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff}
.gs-switchrow input:checked{background:var(--accent-fill,var(--accent))}
.gs-switchrow input:checked::after{left:18px}
/* stat tiles */
.gs-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.gs-stat{display:flex;flex-direction:column;gap:3px;padding:14px 16px;border:1px solid var(--line);border-radius:10px;background:var(--bg)}
.gs-stat b{font:500 22px/1.2 'SF Roboto Mono',Consolas,monospace}
```

In Timing the page is first drawn as folders (the tests, the settings search and the code use those controls) and `GeneralPage.build(box)` in
`renderer/generalpage.js` moves the same controls into the topics in a real window. The settings search opens the topic of a setting it finds
(`GeneralPage.show(topic)`) and marks its card. A label that only repeats its card's title stays in the page for the search and screen readers, out of sight.

### The Double Rail on any page

Every other page of App Settings gets the same two rails without being rewritten. The page draws itself as before; then:

- The second rail shows the page's name in Barlow and one line of what it is for, then the page's **own tabs** under a caption
  ("Interfaces", "Connections", "Views", "Topics") with their status lines ("Not in use", "In use · not connected"), then the page's **sections**
  ("On this page", with captions such as "Only if you need it" carried over and a green dot for a section that is set up).
- The canvas shows **one section at a time**: its own title bar becomes the heading (accent icon tile, Barlow title, caption after a thin line),
  its content is one card. The page's old header, its inner side list and its Open all / Close all go out of sight.
- The page's original tab buttons stay in the page, hidden, and the rail clicks them for you, so every handler keeps working.
- A page redraws parts of itself (another interface, another view): a `MutationObserver` on the box redraws the rail when the tabs or sections changed
  (a signature of their names, states and the open one), and does nothing otherwise.

```css
.sr-canvas .tm-header,.sr-canvas .tm-rail{display:none}                 /* the sheet loses its own head and list */
.sr-canvas .tm-frame{border:0;background:none;box-shadow:none}
.sr-sec[hidden]{display:none!important}                                 /* one section at a time */
#settingsbox .sr-canvas .sr-sec>summary{display:flex;align-items:center;gap:14px;padding:0 0 14px;border:0;background:none;pointer-events:none}
#settingsbox .sr-canvas .sr-sec>summary>strong{font:italic 700 28px/1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
#settingsbox .sr-canvas .sr-sec>.tm-content{padding:18px 20px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.sr-cap{display:block;margin:14px 10px 6px;font:600 10.5px "Segoe UI",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.sr-tabsource{display:none!important}                                   /* the page's own tab buttons, still clicked by the rail */
```

Timing: `SettingsRail.attach(box, page)` in `renderer/generalpage.js`, with one line per page saying where its tabs are
(`hardware: { tabs: '#hwtabs > .tab', tabsLabel: 'Interfaces' }`). A page with its own topic list (Help) gets the same look with CSS only:
its list becomes the second rail (`display:contents` on its inner shell, a grid with the list spanning both rows).

---

## Page Note

The box under a page title that explains the page: an icon tile in the section's Paint, **what it is** in one line,
a few more words in grey, and **where you use it** after an arrow. The user called this the explaining text.

```html
<div class="sn" id="setupnote">
  <span class="sn-tile"><svg>…section icon…</svg></span>
  <p class="sn-lead">A Fuel System sets the tank, the fuel used per lap, the refuel speed and what happens when it runs out.</p>
  <p class="sn-more">It can also give Push &amp; Save a pace reference (Track or Manual).</p>
  <p class="sn-use"><svg>…arrow…</svg><span>Choose one in a race setup (Rules and Systems) to race with fuel.</span></p>
</div>
```

```css
.sn{display:grid;grid-template-columns:40px minmax(0,1fr);column-gap:14px;row-gap:3px;align-items:start;max-width:860px;margin:4px 0 22px;padding:14px 18px 14px 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.sn-tile{grid-row:1 / span 3;display:grid;place-items:center;width:40px;height:40px;border-radius:10px;background:color-mix(in srgb,var(--c,var(--accent)) 16%,var(--panel));color:var(--c,var(--accent))}
.sn-lead{grid-column:2;margin:0;color:var(--ink);font-size:14.5px;font-weight:500;line-height:1.45}
.sn-more{grid-column:2;margin:0;color:var(--muted);font-size:13.5px;line-height:1.55}
.sn-use{grid-column:2;display:flex;align-items:center;gap:7px;margin:7px 0 0;color:color-mix(in srgb,var(--ink) 82%,var(--muted));font-size:12.5px;line-height:1.4}
.sn-use svg{flex:none;color:var(--accent-text,var(--accent))}
.sn:empty{display:none}
```

Writing the words: the lead says what the thing *is* ("A … is …"), the second line says how it behaves,
the arrow line says *where* it is used. Keep all three short. Since 2.4.0 the note is used wherever a page or section opens with a few words: the System Sheet editors (with the live sentence as the second line) and the sections of App Settings (`.sn.ss-intro`: the first sentence leads, the rest is the grey line). In Timing the texts live in one table,
`SETUP_NOTES` in `renderer/editor.js`, drawn by `setupNote(box, sub)`.

---

## Control Strip

The toolbar above a list. Left: the primary Add button, then a thin divider and the occasional tools (outline buttons).
Right: search with a magnifier, the List / Grid [Gear Selector](#gear-selector), and the pager as icon buttons.

```html
<div class="row catalogue-toolbar">
  <button class="btn primary" id="add">Add track</button>
  <button class="btn" id="track-import">Import from Circuit</button>
  <button class="btn ghost" id="extra">Extra fields…</button>
  <button class="btn ghost">View settings</button>
  <div class="catalogue-controls">
    <div class="catalogue-search"><span class="catalogue-field"><svg>…magnifier…</svg><input type="search" placeholder="Search"></span></div>
    <span class="seg"><button class="btn">List</button><button class="btn on" aria-pressed="true">Grid</button></span>
    <div class="catalogue-navigation"><span role="status">Page 1 · 24 shown</span>
      <button class="btn ghost icon" aria-label="Previous page" title="Previous page">‹</button>
      <button class="btn ghost icon" aria-label="Next page" title="Next page">›</button>
      <button class="btn ghost icon" aria-label="Refresh" title="Refresh the list">↻</button></div>
  </div>
</div>
```

```css
.catalogue-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.catalogue-toolbar>#extra{position:relative;margin-left:9px}
.catalogue-toolbar>#extra::before{content:'';position:absolute;left:-9px;top:6px;bottom:6px;width:1px;background:var(--line)}
.catalogue-controls{display:flex;align-items:center;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto}
.catalogue-field{position:relative;display:flex;align-items:center}
.catalogue-field>svg{position:absolute;left:10px;color:var(--muted);pointer-events:none}
.catalogue-search input{width:220px;min-height:32px;padding:0 10px 0 32px;border-radius:7px;background:var(--bg);font-size:13px}
.catalogue-navigation{display:flex;gap:4px;align-items:center}
.catalogue-navigation [role=status]{margin-right:6px;font-size:12px;color:var(--muted)}
.catalogue-navigation .btn.icon{width:28px;min-height:28px;padding:0}
.catalogue-toolbar~.cards{margin-top:16px}
@media(max-width:900px){.catalogue-controls{width:100%;justify-content:flex-start}.catalogue-search input{width:160px}}
```

Button names follow "Add *thing*" in lower case after Add ("Add resource system"), never "New … System".

---

## Gear Selector

A segmented control for a small choice: List / Grid, a filter, a choice inside a form, tabs inside a page.

```html
<span class="seg" role="group" aria-label="Show">
  <button class="btn on" aria-pressed="true">All</button><button class="btn" aria-pressed="false">Race</button>
</span>
```

```css
.seg{display:inline-flex;flex-wrap:wrap;gap:2px;padding:3px;border:1px solid var(--line);border-radius:10px;background:color-mix(in srgb,var(--bg) 60%,var(--panel))}
.seg>.btn{min-height:26px;padding:6px 13px;border:0;border-radius:7px;background:transparent;box-shadow:none;color:var(--muted);font-weight:500}
.seg>.btn:hover:where(:not(:disabled)){background:color-mix(in srgb,var(--ink) 6%,transparent);color:var(--ink)}
.seg>.btn:is(.on,[aria-pressed="true"],[aria-selected="true"]){background:color-mix(in srgb,var(--ink) 12%,var(--panel));color:var(--ink);font-weight:600}
```

The chosen segment is a quiet grey, **not** the accent. Use the same look for a `role="tablist"` inside a page
(Timing: `.custpage .sub[role="tablist"] .tab`).

---

## Garage Card

The card for things with a picture (tracks, cars, drivers, teams). Picture from edge to edge, body with a Barlow title
and detail rows (name left, value in Roboto Mono right), a darker foot with the buttons and Delete as a bin at the end.

```html
<div class="cards">
  <article class="gcard clickable">
    <div class="gimg"><img src="…" alt=""></div>
    <div class="gbody">
      <h3>Spa Club Circuit</h3>
      <div class="gd"><span class="muted">Length</span> 28.45 m</div>
      <div class="gd"><span class="muted">Lanes</span> 4</div>
    </div>
    <div class="row gfoot">
      <button class="btn sm"><svg>…</svg>Edit</button>
      <button class="btn sm"><svg>…</svg>Track design</button>
      <button class="btn sm danger icon" aria-label="Delete"><svg>…bin…</svg></button>
    </div>
  </article>
</div>
```

```css
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.gcard{display:flex;flex-direction:column;padding:0;gap:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden;container:gcard/inline-size}
.gcard.clickable:is(:hover,:focus-visible){border-color:color-mix(in srgb,var(--ink) 30%,var(--line))}
.gcard>.gimg{aspect-ratio:16 / 9;border-bottom:1px solid var(--line);overflow:hidden}
.gcard>.gimg img{width:100%;height:100%;object-fit:cover;display:block}
.gcard>.gbody{display:flex;flex-direction:column;gap:4px;flex:1 1 auto;min-width:0;padding:12px 14px}
.gcard>.gbody>h3{margin:0 0 4px;font-size:18px;line-height:1.1;overflow-wrap:anywhere}
.gcard .gd{display:flex;align-items:baseline;justify-content:space-between;gap:12px;white-space:nowrap;font:500 12.5px/1.45 'SF Roboto Mono',Consolas,monospace;color:var(--ink)}
.gcard .gd>.muted{min-width:0;white-space:normal;font:400 12.5px/1.45 "Segoe UI",system-ui,sans-serif;color:var(--muted)}
.gcard>.gfoot{display:flex;margin:0;padding:8px 10px;gap:6px;flex-wrap:nowrap;border-top:1px solid var(--line);background:color-mix(in srgb,var(--bg) 50%,var(--panel))}
.gcard>.gfoot>.btn{min-width:0;flex:0 1 auto}
.gcard>.gfoot>.btn.danger{flex:none;margin-left:auto}
/* a narrow card: secondary buttons drop their text so the bin never falls off */
@container gcard (max-width:250px){.gcard>.gfoot>.btn[data-track-design]{width:28px;padding:0;gap:0;font-size:0;flex:none}}
@container gcard (max-width:180px){.gcard>.gfoot>.btn[data-edit]{width:28px;padding:0;gap:0;font-size:0;flex:none}}
```

Without a picture, show the thing's icon large on a soft tile, or its first letter. Customization's layout cards
use the same pattern with an SVG sketch in place of the picture (`.lcard`, `.lsketch`, `.lbody`, `.lactions`).

---

## Showroom Card

A [Garage Card](#garage-card) for a *design*: instead of a photo, the top shows the design itself, drawn by the app's own
renderer with sample data and scaled to the card. You see what you'll get before you open it.

| In Timing | The top of the card shows |
|---|---|
| Layout Editor | A sketch of the page: every widget as a box |
| Leaderboard Editor | Three sample drivers in the row design (the real rows) |
| Chart Editor | The chart with the sample race, drawn at 640 × 360 and scaled down (a track map shows an icon) |
| Widget Builder | The widget with sample values |
| Image Settings | A few of the pictures, plus a progress bar of how many are filled |

```html
<div class="lgrid">
  <div class="card lcard">
    <div class="lsketch lchart"><div class="lchart-stage">…the real chart, 640 × 360…</div></div>
    <div class="lbody"><h3>Lap trend</h3><p class="muted">Lap time</p><div class="lmeta"><span>Lap Trend</span></div></div>
    <div class="lactions"><button class="btn">Edit</button><button class="btn">Duplicate</button><button class="btn danger">Delete</button></div>
  </div>
</div>
```

```css
.lgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:16px;margin-top:16px}
.lcard{display:flex;flex-direction:column;padding:0;overflow:hidden;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.lcard:hover{border-color:color-mix(in srgb,var(--ink) 22%,var(--line))}
.lsketch{position:relative;width:100%;max-height:200px;padding:10px;box-sizing:border-box;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 80%,#000)}
.lsketch svg{display:block;width:100%;height:100%}
.lsketch rect{fill:color-mix(in srgb,var(--ink) 13%,transparent);stroke:color-mix(in srgb,var(--ink) 22%,transparent);stroke-width:1;vector-effect:non-scaling-stroke}
.lbody{display:flex;flex-direction:column;gap:4px;flex:1;padding:14px 16px}
.lbody h3{margin:0;font-size:15px;overflow-wrap:anywhere}          /* Barlow via the title rule */
.lbody p{margin:0;font-size:12.5px}
.lmeta{display:flex;gap:14px;margin-top:6px;font:500 12px 'SF Roboto Mono',Consolas,monospace;color:var(--muted)}
.lprog{height:4px;margin-top:8px;border-radius:4px;background:var(--line);overflow:hidden}
.lprog i{display:block;height:100%;background:color-mix(in srgb,var(--ink) 60%,var(--panel))}
.lprog.full i{background:#3ecf8e}
.lactions{display:flex;gap:6px;flex-wrap:wrap;padding:10px 12px;border-top:1px solid var(--line);background:color-mix(in srgb,var(--bg) 50%,var(--panel))}
.lactions .danger{margin-left:auto}
/* a preview drawn at a fixed size and scaled to the card (JS sets transform: scale(card width / 640)) */
.lsketch.lchart{aspect-ratio:16 / 9;padding:0;overflow:hidden}
.lchart-stage{position:absolute;left:0;top:0;width:640px;height:360px;transform-origin:0 0}
/* a preview that sizes itself to its container */
.lsketch.lrows{container-type:inline-size;display:flex;flex-direction:column;justify-content:center;min-height:130px;padding:14px 12px}
/* the empty list: one calm dashed box with a sentence that says what to do */
.lempty{margin-top:16px;padding:28px 24px;border:1px dashed color-mix(in srgb,var(--ink) 18%,var(--line));border-radius:12px;text-align:center}
```

Scaling a fixed-size preview:

```js
const fit = () => (stage.style.transform = `scale(${(card.clientWidth || 640) / 640})`);
fit();
new ResizeObserver(fit).observe(card);
```

Use real sample data from the app's own preview helpers (Timing: `Rows.sampleHtml`, `ChartWidgets.sample`, `Widgets.sampleOf`),
never a drawing made only for the card: the preview must look like the real thing.

---

## Replay Monitor

A settings page that shows the result of its settings: the settings in [Folders](#folder) on the left (380 px), and on the
right a live preview of the real screen, drawn with a sample race at its true size and scaled to fit. A
[Gear Selector](#gear-selector) in the preview's head changes the sample (Timing: 2, 3, 4, 6 or 8 drivers, so you see what a
big field does). Every change of a setting redraws the preview. Timing uses it for **Race Results** (the Results Wall).

```html
<div class="rvpage">
  <div class="rvsettings">
    <details class="fgroup rvfold" open><summary><strong>On the cards</strong><span class="muted">What every driver card shows</span></summary>
      <div class="rvfields"><div class="field"><label>Featured fact</label><select>…</select><span class="muted hint">…</span></div></div></details>
  </div>
  <section class="rvpreview">
    <header class="rvprevhead"><div><strong>Preview</strong><span class="muted">A sample race with your choices</span></div>
      <span class="seg"><button class="btn">2</button><button class="btn on">4</button><button class="btn">8</button></span></header>
    <div class="rvscreen"><div class="rvstage">…the real screen at 1600 px wide…</div></div>
    <p class="muted rvprevnote">4 drivers · sample data, not a saved race</p>
  </section>
</div>
```

```css
.rvpage{display:grid;grid-template-columns:minmax(300px,380px) minmax(0,1fr);gap:20px;align-items:start}
.rvsettings{display:flex;flex-direction:column;gap:12px;min-width:0}
.rvfold>summary{display:flex;flex-direction:column;align-items:flex-start;gap:2px}
.rvfold>summary>.muted{font-size:12px}
.rvfields{display:flex;flex-direction:column;gap:14px;padding:14px 16px 16px}
.rvfields .field{display:flex;flex-direction:column;gap:6px;margin:0}
.rvfields .field>label{font-size:13px;font-weight:600;color:var(--ink)}
.rvfields select{width:100%;font-size:14px}
.rvfields .hint{font-size:12px;line-height:1.45}
.rvpreview{position:sticky;top:12px;min-width:0;border:1px solid var(--line);border-radius:12px;background:var(--panel);overflow:hidden}
.rvprevhead{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 16px;border-bottom:1px solid var(--line)}
.rvprevhead strong{display:block;font:italic 700 18px/1.1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase;letter-spacing:.02em}
.rvscreen{position:relative;overflow:hidden;background:var(--bg)}       /* JS sets its height to the scaled stage */
.rvstage{position:absolute;left:0;top:0;transform-origin:0 0;pointer-events:none}
.rvprevnote{margin:0;padding:8px 16px;border-top:1px solid var(--line);font-size:12px}
@media(max-width:1100px){.rvpage{grid-template-columns:minmax(0,1fr)}.rvpreview{position:static}}
```

```js
const W = 1600; // the size the real screen is designed for
const fit = () => {
  const k = Math.min(1, screen.clientWidth / W);
  stage.style.width = W + 'px';
  stage.style.transform = `scale(${k})`;
  screen.style.height = Math.ceil(stage.scrollHeight * k) + 'px';
};
fit();
new ResizeObserver(fit).observe(screen);
```

Always say on the preview that it is sample data, so nobody mistakes it for a saved race.

---

## Entry Card

The card for things without a picture that are defined by settings: race setups, race systems, rotations,
championships. Icon tile, eyebrow (the kind) and name, facts, a "Used by" part, and a button foot.

```html
<div class="rscards syscards">
  <article class="rscard syscard ss-fuel">
    <div class="rsidentity" data-kind="system">
      <div class="rshead">
        <span class="rstile"><svg>…</svg></span>
        <div class="rstitle"><div class="rseye">Fuel system</div><div class="rsname">Club endurance</div></div>
      </div>
      <div class="rsfacts sysfacts">
        <div class="gd"><span class="muted">Tank</span> 100 L</div>
        <div class="gd"><span class="muted">Per lap</span> 2.5 L</div>
      </div>
    </div>
    <section class="rslinked"><div class="rslinked-head"><strong>Used by</strong><span>2 race setups</span></div>
      <div class="rspills"><span class="rspill">6h of Spa</span><span class="rspill">Club night</span></div></section>
    <div class="row rsactions"><button class="btn">Edit</button><button class="btn">Duplicate</button><button class="btn danger" data-del>Delete</button></div>
  </article>
</div>
```

```css
.rscards{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;align-items:stretch;margin:16px 0}
@media(min-width:800px){.rscards{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(min-width:1200px){.rscards{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(min-width:1600px){.rscards{grid-template-columns:repeat(4,minmax(0,1fr))}}
.rscard{display:flex;flex-direction:column;gap:12px;min-width:0;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.rscard:hover{border-color:color-mix(in srgb,var(--ink) 22%,var(--line))}
.rsidentity{display:flex;flex-direction:column;gap:10px;min-width:0}
.rshead{display:flex;align-items:center;gap:12px}
.rstile{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex:none;background:color-mix(in srgb,var(--ink) 8%,var(--panel));color:color-mix(in srgb,var(--ink) 80%,var(--muted))}
.syscard .rstile{background:color-mix(in srgb,var(--c) 16%,var(--panel));color:var(--c)}   /* Paint */
.rsidentity[data-kind=race] .rstile{background:color-mix(in srgb,var(--accent) 14%,var(--panel));color:var(--accent-text,var(--accent))}
.rstitle{flex:1;min-width:0}
.rseye{font-size:11.5px;letter-spacing:.09em;text-transform:uppercase;font-weight:700;color:var(--muted)}
.rsname{font-weight:700;font-size:16.5px;overflow-wrap:anywhere}
.rsfacts{display:grid;gap:8px;padding-top:10px;border-top:1px solid var(--line)}
.sysfacts .gd{display:flex;align-items:baseline;justify-content:space-between;gap:12px;white-space:nowrap;font:500 12.5px/1.5 'SF Roboto Mono',Consolas,monospace}
.sysfacts .gd>.muted{white-space:normal;font:400 12.5px/1.5 "Segoe UI",system-ui,sans-serif}
.rspills{display:flex;gap:8px;flex-wrap:wrap}
.rspill{display:inline-flex;align-items:center;gap:6px;padding:3px 12px;border:1px solid var(--line);border-radius:999px;background:var(--bg);color:var(--ink);font:inherit;font-size:13px}
.rslinked{min-width:0}
.rslinked-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:13px}
.rslinked-head>span,.rslinked-empty{color:var(--muted);font-size:13px}
.rslinked-empty{margin:0;padding:12px 0}
.rscard .rsactions{display:flex;flex-wrap:wrap;gap:6px;margin:auto -14px -14px;padding:10px 14px;border-top:1px solid var(--line);border-radius:0 0 12px 12px;background:color-mix(in srgb,var(--bg) 50%,var(--panel))}
.rscard .rsactions .btn{min-height:28px;padding:0 10px;font-size:12.5px}
.rsactions .danger,.rsactions [data-del]{margin-left:auto}
.rsdot{width:10px;height:10px;border-radius:50%;background:#2fb86a;flex:none}   /* ready */
.rsdot.off{background:none;border:1.5px solid var(--muted)}                    /* not ready */
```

In Timing, `sysCardHtml({look, icon, eyebrow, name, facts, used, what, empty, actions})` in `renderer/editor.js`
builds one; the Database manager has its own `sysCard` (`renderer/database/manager.js`).
Race setups get the same card with a session-kind tile (practice blue, qualifying yellow, race accent).

---

## Workshop Window

The baseline window, set by **Add Track**: rounded, big Barlow title with a line under it, an intro line in grey,
the fields in [Folders](#folder), and the buttons at the bottom right with the main one last.

```html
<dialog class="appdlg">
  <form>
    <h3>Add track</h3>
    <p class="muted lead">A track is a circuit you race on…</p>
    <div class="formgrid grouped">
      <details class="fgroup" open><summary><strong>Basics</strong></summary> …fields… </details>
      <details class="fgroup"><summary><strong>Lanes</strong></summary> … </details>
    </div>
    <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn" type="button">Cancel</button></div>
  </form>
</dialog>
```

```css
dialog{border:1px solid var(--line);border-radius:14px;padding:22px 24px;background:var(--panel);color:var(--ink);box-shadow:0 30px 80px rgba(0,0,0,.5);font-size:14px}
dialog::backdrop{background:rgba(5,7,10,.62);backdrop-filter:blur(2px)}
dialog>h3:first-child,dialog>:is(form,div)>h3:first-child{margin:0 0 14px;padding-bottom:12px;border-bottom:1px solid var(--line);font-size:24px;line-height:1.1}
/* the buttons: the main one is first in the markup, shown last on the right */
dialog>:is(form,div)>.row:last-child,dialog>.row:last-child{display:flex;flex-direction:row-reverse;justify-content:flex-start;gap:8px;margin:14px 0 0;padding-top:14px;border-top:1px solid var(--line)}
dialog .field>label{font-size:12.5px;color:var(--muted)}
:where(dialog,#view) :is(input[type=text],input[type=number],input[type=date],input[type=search],input:not([type]),select,textarea){min-height:34px;border-radius:7px;box-shadow:none}
dialog :is(select,input[type=text],input[type=number],input[type=date],input:not([type])){font-size:14px}
```

A Workshop Window has no coloured top bar, no little menu of its own on the left and no oversized text.
**Import from Circuit** and **Circuit design** were rebuilt to this pattern. Use a [Tech Sheet](#tech-sheet) instead only
when the editor has many sections that benefit from a side list.

---

**Circuit design** (2.4.0): the Circuit file is a **drop card** (a dashed edge in the accent tint, an icon, *Choose a Circuit file, or drop it
here* with the size under it, a Browse… button); the real file input lies over the card, so a click and a dropped file both work. The body of the window
is focused when it opens (so it opens at the top) and draws no ring.

## Folder

A collapsible group (`<details>`) for forms, settings and results: quiet box, Barlow title on the left,
a chevron on the right, and when open a thin accent mark on the left and a line under the title.

```html
<details class="fgroup" open><summary><strong>Lanes</strong> <span class="muted">4 lanes</span></summary><div class="fgrid">…</div></details>
```

```css
.fgroup{border:1px solid var(--line);border-radius:11px;background:var(--panel);overflow:clip}
.fgroup>summary{position:relative;list-style:none;padding:12px 42px 12px 16px;cursor:pointer;transition:background .12s}
.fgroup>summary::-webkit-details-marker{display:none}
.fgroup>summary:hover{background:color-mix(in srgb,var(--ink) 4%,var(--panel))}
.fgroup>summary::before{content:'';position:absolute;right:18px;top:50%;width:7px;height:7px;margin-top:-6px;border-right:2px solid var(--muted);border-bottom:2px solid var(--muted);transform:rotate(45deg)}
.fgroup[open]>summary{background:color-mix(in srgb,var(--ink) 4%,var(--panel));border-bottom:1px solid var(--line);box-shadow:inset 3px 0 0 var(--accent)}
.fgroup[open]>summary::before{transform:rotate(-135deg);margin-top:-2px}
.fgroup>summary strong{font:italic 700 17px/1.15 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase;letter-spacing:.02em}
```

---

## Pit Board

The bar on top of every full-screen editor, in two layers.

- **Top:** a back button that names where it goes ("‹ Layouts"), a thin divider, then a muted eyebrow ("New layout · 16:9"), the **name as a big Barlow field**
  and a note field under it in grey. On the right: a message slot, the saved state ("● Unsaved changes" in yellow, or "✓ Saved" in green), Undo and
  Redo as icon buttons, and the primary Save.
- **Below:** the tools as small icon buttons in named groups ("Arrange", "Look", "Kind"), split by thin lines. A toggle (Snap) lights up in the accent when on.
  Rarely used settings (proportions, corners, lane colour style; row height, spacing, classification) go into **one panel** (`<details>` that opens as a popover),
  not a line of fields.

```html
<header class="pitboard">
  <div class="pb-top">
    <button class="pb-back"><svg>‹</svg><span>Layouts</span></button><span class="pb-vline"></span>
    <div class="pb-who"><span class="pb-eye">New layout · 16:9</span><input class="pb-name" value="Club night"><input class="pb-note" placeholder="Click to add a note"></div>
    <div class="pb-end"><span class="pb-msg" role="status"></span><span class="pb-state dirty">Unsaved changes</span>
      <button class="btn ghost icon" aria-label="Undo">…</button><button class="btn ghost icon" aria-label="Redo">…</button><button class="btn primary">Save layout</button></div>
  </div>
  <div class="pb-tools">
    <div class="pb-grp"><span class="pb-gl">Arrange</span><label class="pb-tool pb-toggle"><input type="checkbox" checked><svg>…</svg><span>Snap</span></label><button class="pb-tool">Guidelines</button></div>
    <details class="pb-pop"><summary class="pb-tool"><svg>…</svg><span>Page settings</span></summary><div class="pb-popbody"><label class="pb-field"><span>Proportions</span><select>…</select></label></div></details>
  </div>
</header>
```

```css
.pitboard{position:relative;z-index:5;margin:0 0 14px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
.pb-top{display:flex;align-items:center;gap:14px;padding:10px 14px}
.pb-back{display:inline-flex;align-items:center;gap:6px;padding:6px 10px 6px 6px;border:0;border-radius:7px;background:transparent;color:color-mix(in srgb,var(--ink) 82%,var(--muted));font-size:13px;cursor:pointer}
.pb-back:hover{background:color-mix(in srgb,var(--ink) 7%,transparent);color:var(--ink)}
.pb-vline{width:1px;align-self:stretch;margin:4px 0;background:var(--line)}
.pb-who{display:flex;flex-direction:column;min-width:0;flex:1}
.pb-eye{font:700 10.5px/1.4 "Segoe UI",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.pb-name{width:100%;max-width:520px;padding:0 0 1px;border:0;border-bottom:1px dashed var(--line);border-radius:0;background:none;color:var(--ink);font:italic 700 24px/1.1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
.pb-note{width:100%;max-width:520px;margin-top:2px;padding:0;border:0;background:none;color:var(--muted);font-size:12px}
.pb-end{display:flex;align-items:center;gap:8px;margin-left:auto}
.pb-state{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;color:var(--muted)}
.pb-state.dirty::before{content:'';width:8px;height:8px;border-radius:50%;background:#f2b705}
.pb-state.clean{color:#3ecf8e}
.pb-tools{display:flex;align-items:center;flex-wrap:wrap;gap:4px 6px;padding:7px 12px;border-top:1px solid var(--line);border-radius:0 0 12px 12px;background:color-mix(in srgb,var(--bg) 50%,var(--panel))}
.pb-grp{display:flex;align-items:center;gap:2px;padding-right:8px;border-right:1px solid var(--line)}
.pb-gl{margin:0 6px 0 2px;font:600 10px "Segoe UI",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.pb-tool{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 9px;border:0;border-radius:7px;background:transparent;color:color-mix(in srgb,var(--ink) 82%,var(--muted));font-size:12.5px;cursor:pointer}
.pb-tool:hover{background:color-mix(in srgb,var(--ink) 8%,transparent)}
.pb-tool:is([aria-pressed="true"],:has(input:checked)){background:color-mix(in srgb,var(--accent) 14%,var(--panel));color:var(--ink)}
.pb-toggle input{position:absolute;opacity:0;width:1px;height:1px}
.pb-popbody{position:absolute;top:calc(100% + 6px);z-index:20;display:flex;flex-direction:column;gap:10px;width:300px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--panel);box-shadow:0 20px 50px rgba(0,0,0,.45)}
```

The state beside Save follows the editor (Timing: `pbWatch(root, () => ed.dirty)` checks it every 400 ms while it is on screen).
Timing builds the bar with `pitBoard({ back, backId, eyebrow, name, note, msgId, undoId, redoId, saveId, save, tools })` in `renderer/editor.js`,
keeping each editor's own element ids so its code and tests are unchanged. If the app has a generic `header{…}` rule, reset it for `header.pitboard`.

---

## Widget Bench

For a small widget made from settings: two columns. Left: **what it is** as cards (radio buttons styled as cards), then [Folders](#folder) for the
content (a big text field; the variables sorted by subject in a side list with a search, each as `{code}` + what it says) and for size and type.
Right (sticky): **the widget itself on a sample race screen**. The screen is 1000 × 562.5 units (a 16:9 layout), scaled to the column; dashed grey boxes
stand for the rest of a layout so the size reads right; the widget is drawn by the real renderer with sample values, in the lane colour, with a
Gear Selector for the sample lane.

```css
.wb-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(320px,440px);gap:18px;align-items:start}
.wb-kgrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.wb-kind{display:flex;flex-direction:column;gap:4px;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--panel);cursor:pointer}
.wb-kind:has(input:checked){border-color:color-mix(in srgb,var(--accent) 65%,var(--line));background:color-mix(in srgb,var(--ink) 7%,var(--panel))}
.wbvars{display:grid;grid-template-columns:170px minmax(0,1fr);border:1px solid var(--line);border-radius:9px;overflow:hidden}
.wbv code{font:500 12px 'SF Roboto Mono',Consolas,monospace;color:#9cc8ff}
.wb-preview{position:sticky;top:12px;padding:14px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--bg) 70%,#000)}
.wb-screen{position:relative;overflow:hidden;border:1px solid var(--line);border-radius:10px;background:#0b0e12}  /* JS sets its height */
.wb-stage{position:absolute;left:0;top:0;width:1000px;height:562.5px;transform-origin:0 0}               /* JS: scale(screen width / 1000) */
.wb-ghost{position:absolute;border:1px dashed rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.035)}
.wb-widget{position:absolute;border-radius:10px;background:var(--lane);color:#fff;box-shadow:0 0 0 3px rgba(255,255,255,.85),0 0 0 9px color-mix(in srgb,var(--accent) 30%,transparent)}
```

A legend floated above a grid needs `clear:both` on the grid, or the grid lands beside it.

---

## Picture Bench

For a set of pictures. Left: what the set is for as seven icon cards; the pictures as **tiles** (a checkered area that shows the picture, or a dashed
"Drop a picture or click" over the standard picture dimmed) with their name and a bin in the foot; drag a file onto a tile to fill it; a progress bar of
how many are filled. Right (sticky): a **big live preview**. For a range (fuel) a slider walks from full to empty and shows the picture that the widget
would show at that level, or says what the widget shows when that picture is missing; for states a select picks the state.

```css
.ps-cols{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,360px);gap:18px;align-items:start}
.ps-kgrid{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px}
.ps-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.ps-tile{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:10px;background:var(--panel);overflow:hidden}
.ps-tile.over{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 25%,transparent)}   /* while a file is dragged over */
.ps-pic{position:relative;display:grid;place-items:center;aspect-ratio:1;cursor:pointer;background:var(--bg)}
.ps-tile.has .ps-pic,.ps-big{background:repeating-conic-gradient(color-mix(in srgb,var(--ink) 6%,var(--bg)) 0 25%,var(--bg) 0 50%) 0 0/16px 16px}
.ps-drop{position:absolute;inset:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;border:1.5px dashed color-mix(in srgb,var(--ink) 18%,var(--line));border-radius:8px;font-size:11.5px;color:var(--muted)}
.ps-lab{display:flex;align-items:center;gap:6px;min-height:34px;padding:4px 6px 4px 9px;border-top:1px solid var(--line);font-size:12px}
.ps-preview{position:sticky;top:12px;padding:14px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--bg) 70%,#000)}
.ps-big{display:grid;place-items:center;aspect-ratio:1;border:1px solid var(--line);border-radius:12px}
```

The file input sits inside the tile's `<label>` (visually hidden), so a click opens the file chooser; a drop on the tile hands the file to the same code.
While a slider is dragged, update only the picture and its words, not the slider itself, or the drag stops.

---

## Tech Sheet

The big editor for things with many settings: **Add / Edit Race System** (Fuel, Safety Car, Weather, Penalties,
Damage, Tyre Wear, Push & Save, Virtual Rival, Multi-Class, Resource) and the Race Setup editor.
It opens as a window or on the page itself (`.rspage`).

Parts, top to bottom:

1. **Header** (`.rshd`): the Paint tile, a muted eyebrow ("Fuel system"), the **name as a big Barlow field**, pills with
   the key settings, and a ready badge on the right. The background is neutral with only a faint touch of Paint.
2. **Side list** (`.rsrail`): the sections under "This setup", the advanced ones under **"Only if you need it"**, each
   with an icon, a one-line state ("100 L · 2.5 L a lap") and a dot (green ready, yellow to do). At the bottom, "Used by".
3. **In plain words** (`.rssay`): one sentence that says what the current settings do. It updates live.
4. **Sections**: [Folders](#folder) with an icon, a Barlow title and a question as subtitle
   ("Whose recorded laps should the rival use?"). Two columns of fields. **A setting that a switch turns on is indented
   under that switch with a thin line**, so you see what belongs together.
5. **Foot** (`.rsfoot`): the message, "Everything else keeps its default.", Cancel and the primary Save. Sticky on a page.

```html
<form class="rsform ss-fuel">
  <header class="rshd">
    <span class="rstile"><svg>…</svg></span>
    <div class="rstitle"><h3 class="rseye">Fuel system</h3>
      <div class="field"><label>Name</label><input value="Club endurance"></div>
      <div class="rspills"><span class="rspill">100 L tank</span></div></div>
    <span class="rsready">Ready</span>
  </header>
  <div class="rsbody">
    <nav class="rsrail"><p class="rsrl">This setup</p>
      <button class="rsri on"><span class="rsic"><svg>…</svg></span><span><b>Tank</b><small>100 L · 2.5 L a lap</small></span></button>
      <p class="rsrl rsrl2">Only if you need it</p> …
      <div class="rsused">…Used by…</div></nav>
    <div class="rsmain">
      <div class="rssay"><span class="rssayic"><svg>…</svg></span><div class="rssaytext"><b>In plain words</b><p>…</p></div></div>
      <details class="fgroup rssec" open><summary><span class="rsic"><svg>…</svg></span><strong>Tank</strong><span class="rsq">How much fuel fits?</span></summary>
        <div class="fgrid c3">
          <label class="field fu-switchfield">…switch…</label>
          <label class="field">…the setting it turns on…</label>
        </div></details>
    </div>
  </div>
  <footer class="rsfoot"><p class="error" role="alert"></p><span class="muted rsdef">Everything else keeps its default.</span>
    <button class="btn" type="button">Cancel</button><button class="btn primary" type="submit">Save system</button></footer>
</form>
```

```css
.rsform{display:flex;flex-direction:column;max-height:94vh;min-height:0;font-size:14px}
/* header */
.rshd{display:flex;align-items:center;gap:16px;padding:20px 24px 16px;border-bottom:1px solid var(--line);flex:none;background:linear-gradient(110deg,color-mix(in srgb,var(--c,var(--accent)) 10%,var(--panel)),var(--panel) 55%)}
.rshd .rstile{width:52px;height:52px;border-radius:12px;display:flex;align-items:center;justify-content:center;flex:none;background:color-mix(in srgb,var(--c,var(--accent)) 16%,var(--panel));color:var(--c,var(--accent))}
.rshd .rstitle{flex:1;min-width:0;display:flex;flex-direction:column;gap:6px}
.rsform .rseye{margin:0;font:700 11px/1.4 "Segoe UI",system-ui,sans-serif;font-style:normal;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.rshd .field label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
.rshd input{width:100%;max-width:640px;padding:2px 0 4px;border:0;border-bottom:1px dashed var(--line);border-radius:0;background:none;box-shadow:none;color:var(--ink);font:italic 700 30px/1.1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase;letter-spacing:.01em}
.rshd input:hover{border-bottom-color:var(--muted)}
.rshd input:focus-visible{outline:none;border-bottom:1px solid var(--accent)}
.rshd .rspill{font-size:12px}
.rsready{flex:none;padding:6px 14px;border-radius:999px;border:1px solid color-mix(in srgb,currentColor 45%,transparent);background:color-mix(in srgb,currentColor 12%,transparent)}
/* body: side list + main */
.rsbody{display:grid;grid-template-columns:236px minmax(0,1fr);flex:1 1 auto;min-height:0;overflow:hidden}
.rsrail{display:flex;flex-direction:column;gap:2px;padding:16px 12px;border-right:1px solid var(--line);overflow-y:auto;background:color-mix(in srgb,var(--bg) 55%,var(--panel))}
.rsrl{margin:4px 8px 6px;font-size:10.5px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:color-mix(in srgb,var(--muted) 80%,var(--bg))}
.rsrl2{margin-top:16px}
.rsri{display:flex;align-items:center;gap:10px;width:100%;padding:9px 10px;border:0;border-radius:9px;background:none;color:var(--ink);font:inherit;text-align:left;cursor:pointer}
.rsri:hover{background:color-mix(in srgb,var(--ink) 6%,transparent)}
.rsri.on{background:color-mix(in srgb,var(--ink) 10%,var(--panel))}
.rsri .rsic{color:var(--muted)}
.rsri.on .rsic{color:var(--c,var(--accent))}
.rsri b{font-weight:600}
.rsri small{display:block;color:var(--muted)}
.rsused{margin-top:12px;padding:12px;border:1px solid var(--line);border-radius:10px;font-size:13px}
.rsmain{overflow-y:auto;min-height:0;padding:18px 24px 24px}
/* in plain words */
.rssay{display:flex;align-items:flex-start;gap:14px;margin:0 0 14px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:color-mix(in srgb,var(--bg) 45%,var(--panel))}
.rssayic{display:grid;place-items:center;width:36px;height:36px;flex:none;border-radius:10px;background:color-mix(in srgb,var(--ink) 8%,var(--panel));color:var(--muted)}
.rssaytext b{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.rssaytext p{margin:2px 0 0;font-size:14px;line-height:1.5}
/* sections (Folders with an icon and a question) */
.rssec{margin:0 0 12px}
.rssec>summary{display:flex;align-items:center;gap:10px;padding:12px 44px 12px 14px}
.rssec>summary .rsic{display:grid;place-items:center;width:32px;height:32px;border-radius:9px;background:color-mix(in srgb,var(--ink) 7%,var(--panel));color:var(--muted)}
.rssec[open]>summary .rsic{background:color-mix(in srgb,var(--c,var(--accent)) 14%,var(--panel));color:var(--c,var(--accent))}
.rssec>summary strong{font:italic 700 18px/1.15 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase;letter-spacing:.02em}
.rssec>summary .rsq{font-size:12.5px;color:var(--muted)}
/* fields: two columns, help at full width, a switch's setting indented under it */
.rssec .fgrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px;padding:16px 18px 18px}
.rssec .field>label:not(.inline){font-size:13px;font-weight:600;color:var(--ink)}
.rssec .field :is(input,select,textarea){font-weight:400;font-size:14px}
.rssec .field .hint{font-size:12.5px;line-height:1.5;max-width:75ch;color:var(--muted)}
.rssec .fgrid>.fu-switchfield+.field:not(.fu-switchfield){grid-column:1 / -1;margin:-6px 0 0 21px;padding:2px 0 4px 31px;border-left:2px solid var(--line)}
/* content that is not in a grid gets the same inner spacing */
.rssec>:not(summary):not(.fgrid){margin:14px 18px}
/* choices inside: Gear Selector; option cards: a calm fill with an accent edge */
.rsform .fu-card.on{background:color-mix(in srgb,var(--ink) 7%,var(--panel));border-color:color-mix(in srgb,var(--accent) 65%,var(--line))}
/* foot */
.rsfoot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;padding:12px 24px;border-top:1px solid var(--line);flex:none;background:color-mix(in srgb,var(--bg) 40%,var(--panel))}
.rsfoot .rsdef{margin-right:auto;font-size:13px}
/* on a page rather than in a window */
.rsform.rspage{max-height:none;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
.rspage .rsbody{overflow:visible}
.rspage .rsrail{position:sticky;top:8px;align-self:start;max-height:calc(100vh - 80px)}
.rspage .rsmain{overflow:visible}
.rspage .rsfoot{position:sticky;bottom:0;z-index:6;border-radius:0 0 14px 14px}
```

**With a call list** (Timing: audio sets): when a sheet holds many similar items (134 race calls), the side list holds the *subjects* with
"on / total" counts, and the page shows **every item of the subject as a row**: a switch, the name, its first sentence in grey, a short meta
("2 sentences"), and a listen button. A row opens its item right under it (accent edge, a second click closes it). One big search goes over names and
sentences, with quick filter chips (All, On, Off, Changed, New). Back is always the Pit Board's "‹ Audio sets".

```css
.audio-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;align-items:center;gap:12px;padding:8px 10px 8px 14px;border-top:1px solid var(--line)}
.audio-row.open{background:color-mix(in srgb,var(--ink) 5%,var(--panel));box-shadow:inset 3px 0 0 var(--accent)}
.audio-row.off .audio-rowmain{opacity:.55}
.audio-rowmain span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px;color:var(--muted)}
.audio-sw i{position:relative;width:32px;height:18px;border-radius:9px;background:var(--line)}
.audio-sw input:checked+i{background:var(--accent-fill,var(--accent))}
.audio-chip[aria-pressed="true"]{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));background:color-mix(in srgb,var(--accent) 12%,var(--panel))}
```

In Timing, `RailForm.shell(o)` in `renderer/railform.js` builds the whole thing from a list of sections
(`{id, title, question, icon, optional, body}`); `RailForm.sync` updates the side-list states and dots.
**Guidance rules for a Tech Sheet:** the plain-words sentence must always describe the current values; every section has
a question as subtitle; anything most people never change goes under "Only if you need it" and stays folded.

---

## Toggle Chips

Checkboxes shown as pill switches with a tick, grouped under small headings. For "show these columns",
"which systems does your club use" and similar many-choice settings.

```html
<fieldset class="vsgroup"><legend>Columns</legend>
  <label class="vschip"><input type="checkbox" checked> Length</label>
  <label class="vschip"><input type="checkbox"> Lanes</label>
</fieldset>
```

```css
.vsgroup{display:flex;flex-wrap:wrap;gap:8px;border:0;margin:12px 0 0;padding:0}
.vsgroup legend{float:left;width:100%;margin:0 0 8px;padding:0;font:600 11px/1.4 "Segoe UI",system-ui,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:var(--muted)}
.vschip{position:relative;display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 9px;border:1px solid var(--line);border-radius:999px;background:var(--bg);font-size:13px;color:color-mix(in srgb,var(--ink) 80%,var(--muted));cursor:pointer;transition:background .12s,border-color .12s}
.vschip:hover{border-color:color-mix(in srgb,var(--ink) 25%,var(--line));color:var(--ink)}
.vschip input{position:absolute;opacity:0;width:1px;height:1px;pointer-events:none}
.vschip::before{content:'';width:14px;height:14px;flex:none;border-radius:4px;border:1.5px solid color-mix(in srgb,var(--ink) 35%,var(--line));background:transparent no-repeat center/10px 10px}
.vschip:has(input:checked){border-color:color-mix(in srgb,var(--accent) 45%,var(--line));background:color-mix(in srgb,var(--accent) 12%,var(--panel));color:var(--ink)}
.vschip:has(input:checked)::before{border-color:var(--accent-fill,var(--accent));background-color:var(--accent-fill,var(--accent));background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2.5 6.2 5 8.5 9.5 3.5' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")}
.vschip:has(input:focus-visible){outline:2px solid #4c9aff;outline-offset:2px}
.vschip:has(input:disabled){opacity:.65;cursor:not-allowed}
```

A View settings panel puts these under a head with a Barlow title and a Reset button (`.viewbar`, `.vb-head`, `.vb-title`).

---

## Broadcast Hero

The Home header, like a race broadcast: the header picture (or a dark accent glow if there is none) across the whole page,
the welcome words in big Barlow on it, and the main action bar rising into the bottom of it.
Timing-specific in its content (lanes, start bar), but the frame can be reused for any app's start screen.

```css
.hm-hero{position:relative;display:grid;grid-template:minmax(0,1fr)/minmax(0,1fr);margin:-20px -20px 16px;overflow:hidden;border-bottom:1px solid var(--line);
  background:radial-gradient(60% 130% at 0% 100%,color-mix(in srgb,var(--accent) 28%,transparent),transparent 70%),
             linear-gradient(110deg,color-mix(in srgb,var(--accent) 12%,var(--panel)) 0%,var(--bg) 60%,color-mix(in srgb,var(--panel) 70%,var(--bg)) 100%)}
.hm-hero>*{grid-area:1/1}                       /* picture and text stack in one cell */
.hm-hero>.hm-band{display:flex;flex-direction:column;justify-content:flex-end;min-height:300px;padding:40px 34px 34px}
```

Big title on it: `font:italic 700 clamp(40px,4.4vw,68px)/.92 'SF Barlow Condensed'`, uppercase, `max-width:26ch;text-wrap:balance`. A club logo can sit at the
left or right, or over the picture. The full set (with the start bar and lane cards) is the "2.4.0 Broadcast Home" block in
Timing's `renderer/styles.css`.

---

## Timing Tower

A ranked list like a TV timing tower: an optional record row on top, then rows of position, a colour stripe, the name,
the time in Roboto Mono and a gap chip (green faster, red slower, purple the fastest of all).
Timing uses it for the Personal Bests card (`.hm-pbrec`, `.hm-pblist`, `.hm-pbpos`, `.hm-pbchip.best|down|none`).

```css
.tower{display:flex;flex-direction:column;gap:2px}
.tower-row{display:grid;grid-template-columns:22px 4px minmax(0,1fr) auto auto;align-items:center;gap:10px;padding:6px 8px;border-radius:7px;background:color-mix(in srgb,var(--ink) 4%,var(--panel))}
.tower-pos{font:700 13px 'SF Roboto Mono',Consolas,monospace;color:var(--muted);text-align:right}
.tower-stripe{width:4px;height:18px;border-radius:2px;background:var(--lane,var(--muted))}
.tower-time{font:500 13px 'SF Roboto Mono',Consolas,monospace}
.tower-chip{padding:1px 7px;border-radius:999px;font:600 11.5px 'SF Roboto Mono',Consolas,monospace}
.tower-chip.up{background:color-mix(in srgb,#3ecf8e 18%,transparent);color:#3ecf8e}
.tower-chip.down{background:color-mix(in srgb,#ff6b6b 18%,transparent);color:#ff6b6b}
.tower-chip.best{background:color-mix(in srgb,#b57aff 20%,transparent);color:#c79bff}
```

(Generic class names here; map them to the app's own. Timing's exact rules are the "Personal Bests as a timing tower" block.)

---

## Rulebook

A document page: a header with an accent eyebrow, a big Barlow title, when it was saved (green dot) and the export action;
then a **sheet** with a sticky, grouped toolbar on top (groups split by thin lines: undo/redo, paragraph style, text,
lists, align, insert) and the text under it with generous margins; a word count in the foot.

```css
.rulespage{max-width:1140px;margin:0 auto;padding:8px 0 24px}
.rules-head{display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;margin-bottom:18px}
.rules-eyebrow{font-size:11px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--accent-text,var(--accent))}
.rules-head h2{margin:6px 0;font:italic 700 clamp(32px,3vw,44px)/1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
.rules-saved{font-size:12.5px;color:var(--muted)}
.rules-saved:not(:empty)::before{content:'';display:inline-block;width:7px;height:7px;margin-right:7px;border-radius:50%;background:#3ecf8e}
.rules-sheet{border:1px solid var(--line);border-radius:14px;background:var(--panel);box-shadow:0 18px 50px rgba(0,0,0,.25);overflow:clip}
.rules-sheet>.rte-bar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;align-items:center;gap:6px 4px;padding:8px 12px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 45%,var(--panel))}
.rte-group{display:inline-flex;align-items:center;gap:2px;padding-right:8px;margin-right:4px;border-right:1px solid var(--line)}
.rte-group.rte-end{border-right:0;margin-left:auto}
.rte-b{min-width:34px;height:32px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--ink);font:inherit;font-size:13.5px;cursor:pointer}
.rte-b:hover{background:color-mix(in srgb,var(--ink) 9%,transparent)}
.rules-sheet>.rte{min-height:58vh;margin:0;padding:40px clamp(20px,6vw,64px) 48px;font-size:16px;line-height:1.7;outline:none}
.rules-foot{display:flex;justify-content:flex-end;padding:8px 16px;border-top:1px solid var(--line);font:500 12px 'SF Roboto Mono',Consolas,monospace;color:var(--muted)}
```

The text people write keeps its own fonts: exclude it from the Barlow title rule.

---

## Settings Sheet

What goes on the canvas of a **Double Rail** in App Settings (it replaced the cards and Choice Tiles there). Sleek and quiet: a page head, then
**groups**, each a small heading in spaced capitals and one **sheet** (a panel with thin lines between its rows). Every setting is one **slim
two-half row**: on the left the name in bold and one short line under it, on the right the control. Longer explanations are cut to one line with a
small **More** behind the short line. Dependent settings sit indented and lighter under the setting they depend on (`ss-sub`) and fade when it is off
(`ss-off`). Words that are not a setting are a quiet line between groups (`ss-note`). Whatever is a picture of something (a pad preview, the sensors
of a track, the theme palette, a QR code) stays as it is drawn.

**The control kit**, every control 30px high, nothing else:

| Kit part | Is | Made from |
| --- | --- | --- |
| Switch | 34×20 pill, the accent when on | a checkbox |
| Segmented choice | up to five words in a sunken strip, the chosen one lifted | a list with ≤ 5 short options (the list stays, hidden) |
| List | a 190–320px drop-down | a longer list |
| Stepper | − number + with the unit beside it, Roboto Mono | a number field or a slider (**no sliders**) |
| Text field | 280px | a text field |
| File row | the file button, then the file name or a thumbnail | a file field |
| Path | the path in Roboto Mono with Copy | a path |
| Status pill | a small pill, green when fine, amber when it needs you | a status |

Pictures are framed without sliders: **drag** the picture, or click it and use the **arrow keys** (1%, Shift 10%), **double-click** centres it,
and a "Position" sub-row has two steppers and **Centre** for exact numbers.

Code: `renderer/settingssheet.js` (`SettingsSheet`). `SettingsSheet.convert(box)` turns a page's own folder markup into sheets in the real page only
(the controls are moved, never rebuilt, so their ids and handlers stay); `SettingsRail` calls it for each section it shows, and again when a page
draws itself again (`SettingsSheet.fresh`). General is built by hand in `generalpage.js` with `SettingsSheet.row`, `kit`, `segmented` and `stepper`.

```css
.ss-gh{margin:22px 2px 8px;font:600 10.5px "Segoe UI",system-ui,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}
.ss-sheet{margin:0 0 18px;border:1px solid var(--ss-line);border-radius:10px;background:var(--panel);overflow:hidden}
.ss-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 20px;min-height:52px;padding:10px 16px;border-top:1px solid var(--ss-line)}
.ss-t>b{font-size:13.5px;font-weight:600}  .ss-t>.ss-desc{font-size:12.5px;color:var(--muted)}
.ss-t>.ss-hint{-webkit-line-clamp:1}  .ss-t>.ss-hint.open{-webkit-line-clamp:unset}
.ss-row.ss-sub{padding-left:38px;background:color-mix(in srgb,var(--bg) 22%,var(--panel))}
.ss-row.ss-off>*{opacity:.45}
input.ss-switch{appearance:none;width:34px;height:20px;border-radius:10px;background:var(--line)}  input.ss-switch:checked{background:var(--accent-fill,var(--accent))}
.ss-seg{display:inline-flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--bg)}
.ss-seg>button.on{background:color-mix(in srgb,var(--ink) 13%,var(--panel));color:var(--ink);font-weight:600}
.ss-step{display:inline-flex;height:30px;border:1px solid var(--line);border-radius:7px;background:var(--bg)}
.ss-step>input{width:64px;text-align:center;font:500 13px 'SF Roboto Mono',Consolas,monospace}
```

## System Sheet

The editor of a race system, a race setup, a championship, a rotation or an Extras page (the frame of `railform.js`) set like a
[Settings Sheet](#settings-sheet). Everything is on **one page**: every section is open and stays open, one under the other, each with its
Barlow title and its question as one quiet line. The **rail is the table of contents**: a click scrolls to the section, and while the page
scrolls the rail shows where you are (`.rsri.sy-on`). A row of the rail has its short note and a small dot only where something is changed
(red) or missing (amber). The page opens with a **[Page Note](#page-note)**: the tile, what the thing is (`SETUP_NOTES`), what it does with
the settings as they are now (the live sentence, `#rssay`), and where you use it. On a Race Setup page that already has its own Page Note
above the editor, the note in the editor only says what the settings do now.

Every field is a slim two-half row in a sheet (`.fgrid.sy-sheet > .field.sy-row`): the name and one line left, the control right. The app's
own controls are restyled into the kit: its segmented buttons (`.fu-seg`) as the segmented choice, its switches (`.fu-sw`) as the 34×20 switch,
a number with its unit as the stepper. A label written as `Name · short line` shows the short line under the name. Tables, cards and pictures
(the tyre table, the weather curve, choice cards) keep their own look inside the sheet at full width (`.sy-stack`).

Regrouped: **Tyre Wear** has six sections instead of nine: Wear (Counting, Tyres), Worn tyres, Pit stops and sets (Tyre change, Sets,
Mandatory stops), Warnings, and under "Only if you need it" Temperature and Weather.

Also regrouped and reworded: **Fuel** (Tank and pit, Empty tank, and Pace reference under "Only if you need it"), **Penalty** (Points and what
they cost, Named penalties, Disqualification), **Damage** (The repair stop, Damage levels with the penalty points for a late or early stop, Incidents,
Car failures), **Weather** (The rain with how it is counted, Tyres, Hindering the cars, Track conditions), **Push & Save** (What it changes, Push and
save, How much, Which laps count).

**Clear groups:** a sheet, the Page Note and every box of information sit a little darker than the window (`--sy-box`), so each group stands
out. Loose pieces are tidied too: fields straight in a section become a sheet, a checkbox anywhere becomes the switch, a slider beside a number
box gives way to the number stepper, a choice of buttons with a name and a line each becomes choice cards (`[class$="-choices"]`).

**A window over the page:** an editor that opens from a list on a Race Setup page (Virtual Rival, Multi-Class, Resource, Championship, Rotation)
opens as a window over the page (`.sy-pop` and a `.sy-backdrop`), like the Database systems; Back or Escape closes it. Balance of Power and Time
Tokens are the page itself: the page shows a card with what is set now (one row per section, `.sy-launch`), and **Open settings** (or
a row) opens the editor as the same window; **Done** or Escape closes it. Words that sit straight inside a sheet get the padding and line of a row.

**More (2.4.0):** a long explanation in an editor (150 characters or more) shows two lines and a **More** (`.sy-clamp`, `.sy-more`).
**Safety Car** has four sections: Target pace, Penalty points, Pit work and Random flags. **Form labels:** a field can have a shorter label for the form
only (`formLabel` in schema.js, `Name · one short line`, read by `ffl()` in database/basics.js); lists, cards and columns keep `label`.
**Number tiles** (Resource tyre sets) are rows in two columns with the colour as a dot and the stepper (`.sy-tilelist`); **tables** of settings
(Damage levels, tyre and weather tables, sets) have the 30px controls and quiet column heads.

Code: `renderer/systemsheet.js` (`SystemSheet`). It changes the real page only, after the frame is drawn (a watcher on the page finds every
new `.rsform`): ids, `data-key` and handlers stay, so the forms' code and the tests that read their markup are unchanged.

```css
html .rsform.sy details.rssec{margin:0 0 30px;padding:0;border:0;background:none}
html .rsform.sy details.rssec+details.rssec{padding-top:26px;border-top:1px solid var(--ss-line,var(--line))}
html .rsform.sy details.rssec>summary strong{display:block;font:italic 700 22px/1.05 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
html .rsform.sy .fgrid.sy-sheet{display:block;border:1px solid var(--ss-line,var(--line));border-radius:10px;background:var(--panel);overflow:hidden}
html .rsform.sy .fgrid.sy-sheet>.field{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:6px 20px;min-height:52px;padding:10px 16px;border-top:1px solid var(--ss-line,var(--line))}
html .rsform.sy .rsri.sy-on{background:color-mix(in srgb,var(--ink) 10%,var(--panel))}
html .rsform.sy .rsdot.ok{background:var(--accent-text,var(--accent))}  html .rsform.sy .rsdot.off{visibility:hidden}
```

## Help Reader

The Help page set as a calm document: one column of about 70 characters (max 700px), the search beside a small page title, a trail in spaced
capitals, one Barlow title (32px), the plain-words summary as the lead (16px, a thin accent line on its left, no box; the short note that repeats it is
left out), body text 14.5px with 1.7 line height and air between list items, group headings in spaced capitals, and related guides as quiet pill chips
under a thin line. A title focused by the app shows no outline; keyboard focus still does.

```css
html #view .help-hub .help-reader{padding:26px 40px 80px;max-width:780px}
html #view .help-hub .help-article>h3{margin:0 0 16px;font-size:32px;line-height:1.05}
html #view .help-hub .help-reader .help-plain{padding:2px 0 2px 16px;border:0;border-left:2px solid var(--accent);background:none}
html #view .help-hub .help-article-body{font-size:14.5px;line-height:1.7}
html #view .help-hub .help-related .btn{min-height:30px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:transparent}
```

## Grid Slot

A lane of **Start a race** on Home, the same at every width. The lane number and the driver's name (Barlow) on the first line, the car under
it, **Browse cars** under that; the driver's picture as a portrait on the right that fills the card from top to bottom and fades into it
(`--gs-pic`: 132px, 180px when the lanes are wide, 104px when narrow or with four lanes or more); the ready tick in the top corner; a faint
tint of the lane colour behind the portrait. **Start a race** goes to its stacked layout (choices on top, the lanes in a full-width row, Start
race under them) when a lane would get less than about 340px: below 1400px with 2 lanes, 1650px with 3, 1950px with 4; 5 or more always.

**Up to 8 lanes in rows:** `laneCols` (landing.js) gives the most lanes on a row: up to 4 lanes all on one row, 5 or 6 in rows of 3, 7 or 8 in rows of
4. The card narrows that by its own width (container `hm-start`): rows of 4 become 3 below 1440px (8 lanes: 3 + 3 + 2) or 2 (4 lanes: 2 + 2), rows of 3 or 4
become 2 below 1080px, and 1 below 720px. A last row that is not full shares its whole width (`renderer/gridslot.js`: the lanes sit on 12 small columns,
a lane spans 12 / lanes in its row), so there is never an empty place.

```css
html #hmc-start .hs-lanes[data-cols] .lane.lane.lane{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-areas:"n f" ". m" "w w";min-height:116px;padding:16px 18px 14px;overflow:hidden}
html #hmc-start .hs-lanes[data-cols] .lane.lane.lane>.hs-avatar{display:block;position:absolute;top:0;right:0;bottom:0;width:var(--gs-pic,132px);mask-image:linear-gradient(90deg,transparent 0,#000 38%)}
html #hmc-start .hs-lanes[data-cols] .lane.lane.lane>.hs-tick{position:absolute;top:12px;right:12px}
```

## Home Cards

The cards under Start a race on Home (`renderer/homecards.js`). One frame for all (the Barlow title in the header, a quiet tag on the right, an
optional foot line `.hm-foot`), but **every card has an idea of its own**, like a small broadcast graphic. Drivers on the grid carry the colour of
their lane (`d.laneOf`, `.hm-lane`, `.hm-stripe`); purple is the fastest, gold, silver and bronze are the podium. A box inside a card is `--hc-box`.

| Card | Idea |
| --- | --- |
| Last race | **Result board**: the winner as a gold lower third, the others as rows with their place, the fastest lap as a purple pill |
| At a glance | **Odometer**: rolling digits for races and laps, and a bar of races per week for twelve weeks (`glanceWeeks`) |
| Recent races | **Race log**: a timeline, a stop per race in the colour of its kind, the kind as a chip |
| Fastest laps this week | **Timing tower**: position, the lane colour, the time and the gap, the fastest in purple |
| Records on all tracks | **Wall of tiles**, the track of the race setup with a red edge |
| Top drivers | **Hall of fame**: the leader as a gold banner with the wins, the others as bars |
| Rules of this race | **Race brief**: a tile per rule in its own colour; a system that is off fades |
| Shortcuts | **Launch pad**: tiles with a picture, the first one twice as wide |
| Weather | **The sky**: the card takes the colour of the weather, the air temperature big |
| Tyres available | **Sidewalls** with the sets as small blocks |
| Notes | **Race control board**: more lines become numbered points, a strip of tape on top |
| Car mileage | **Odometers**: the value in mono, a thin bar |
| Service due | **Pit wall**: a gauge per car, red past its interval |

**New cards (2.4.0):** **Lane balance** (the best lap of every lane as a bar in its colour), **Grid form** (the places of the last races as squares in
podium colours; up to four drivers the last ten with a line about their form, more drivers the last five, tighter), **Head to head** (two drivers: a
face-off with the score; more: **Rivalry**, a table of wins), **Championship** (the standings with the gap, the rounds as a strip, the next round),
**Heat standings** (the last heat-based race), **Countdown** (to an event you type in Customize), **Milestones** (the next round numbers of the
drivers and cars on the grid, gold when it is the next race). The figures are in `homestats.js` (`laneBalance`, `gridForm`, `headToHead`,
`heatStandings`, `milestones`, `racesPerWeek`), worked out in the main process too (`dashboard-read.js`, `sqlite-home.js`, and from this computer's
own sessions when a shared library is used).

```css
html .hm-grid .hm-last .hm-resw{display:grid;grid-template-columns:auto minmax(0,1fr) auto;background:linear-gradient(100deg,color-mix(in srgb,var(--hc-gold) 22%,var(--panel)) 0,var(--panel) 75%)}
html .hm-grid .hm-tower li{grid-template-columns:22px 4px minmax(0,1fr) auto 62px;min-height:34px}
html .hm-grid .hm-odo i{width:20px;height:30px;border-radius:4px;background:#0f1216;font:600 18px 'SF Roboto Mono',Consolas,monospace}
html .hm-grid .hm-brief{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px}
html .hm-grid .hm-lbbar i{background:color-mix(in srgb,var(--c) 75%,var(--panel))}
```

## Pit Wall

The main menu (`renderer/mainbar.js`) as one slim bar that **never wraps**. The tabs that app.js draws keep their names and order and sit in three
groups on a dark track (Home · Database, Race Setup · Customization, App Settings, Racing Rules); the open one is lifted with its picture in the accent.
On the right: **status lights** (the timing hardware, the shared library, the network; hover for the words), **Find** (Ctrl K) and **Live Race** as
an ON AIR button (red and pulsing while a race runs). Narrower windows lose first the words of the lights, then the word Find and the app name;
below 1080px each tab shows its **name small under its picture**, so the names never go. The bar also **measures itself**: when it does not fit
(for instance with the Race tab of a kept race, or a big Interface size) it takes the same steps one by one until it does (`MainBar.fit`, classes
`mb-t1` … `mb-t7`: the last two make everything tighter, and only as a last resort show the pictures alone with the names as tooltips).

While a race runs and another page is shown, a **race strip** under the bar says the race, the lap, the clock and the leader, with **Back to the race**
(`live.strip`, filled in race.js). **Find** searches the pages, the settings (`SettingsIndex`), the drivers, cars, tracks and race setups, and a few
things to do (open the Live Race, test the sensors, start the race); Enter opens it, a driver or car opens its form.

```css
html body.app-shell>header{flex-wrap:nowrap;min-height:60px;padding:0 18px}
html body.app-shell>header>#tabs .mb-grp{display:flex;gap:2px;height:38px;padding:3px;border-radius:10px;background:rgba(0,0,0,.22)}
html body.app-shell>header>#tabs .mb-grp>.tab[aria-selected="true"]{background:color-mix(in srgb,var(--ink) 12%,var(--panel));color:var(--ink)}
.mb-strip{display:flex;align-items:center;gap:18px;height:40px;background:linear-gradient(90deg,color-mix(in srgb,var(--accent) 26%,var(--bg)),var(--bg) 60%)}
```

## Rotation Board

The rotation editor (`renderer/rotationui.js`, `rotation.js` fairness; styles under `.ro-opt`, `.ro-fair*`, `.ro-mismatch`).

- **Size**: *Lanes · From the track you race on* as option tiles (`.ro-opt`: the name, the lanes in Roboto Mono, a bar of lane colours), the chosen one with
  the accent ring, and *Another number…* for the number box of before; *Participants · From an entry list, or a number*: a tile per race setup entry list
  (*Check race entry list · 3 drivers*) and *Pick drivers…* (a window with a tick per driver, in the order ticked).
- **How often** opens with *Lane fairness* and a pill (*2 not even* in amber, *Even* in green); the table has a lane-colour underline per lane, a lane never
  raced in amber and one raced too often in red; under it the words (*Anna races lane 1 4 times and never lanes 2, 3 and 4*) and *Even out the lanes*.
- **The card**: an amber note when a race setup that uses the rotation races on a track with fewer lanes.

```css
html .ro-opt.on{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
html .ro-lanebar i{width:22px;height:6px;border-radius:3px;background:var(--c)}
html .rohow td.num.ro-zero{color:#f2b705}
html .rohow td.num.ro-over{color:#ff8a8d}
```

## Entry Classes

Home's lanes with a Multi-Class System (`renderer/landing.js`, `multiclass.js`; styles `.hs-cpick`, `.hs-classnote`, `.hs-classchip`). The class of every
entry is chosen in its lane for this race and kept with the race setup's entry list; the system's driver list (now *Defaults*) gives the start.

- **The class pick**: a button per class (`.hs-cpick`, Roboto Mono, 26 px), the chosen one outlined and tinted in the class colour; after it a small
  check (`.hs-classnote`): *✓ Car is GT3* in green, *Choose a class* in amber.
- **The counts**: chips beside the race chips (`.hs-classchip`, *GT3 · 2*), tinted in the class colour.
- **Classes of this race** (the fold above the lanes): how it works, and *Copy these classes to the Multi-Class System as defaults*.
- **A virtual rival**: the driver list of a lane has *Add a virtual rival* with the Rival Setups and *From a race…*; the rival's lane says what it still
  needs (*Lane 4: This replay belongs to a different track.*).

```css
html .hs-cpick.on{border-color:var(--mc);background:color-mix(in srgb,var(--mc) 20%,transparent);color:var(--ink)}
html .hs-chip.hs-classchip{border-color:color-mix(in srgb,var(--mc) 55%,var(--line));background:color-mix(in srgb,var(--mc) 14%,transparent)}
```

## Profile Cards

Race Setup › **Balance of Power** and **Time Tokens** (`renderer/profiles.js`; the editors are those of before, `bopui.js` and `tokenui.js`, editing the profile
that is open; styles under `.pf-`). A bar with *＋ New … profile* and one line on how a setup chooses; then a card per profile, the **Club default** first.

- **A card** (`.pf-card`): an icon tile in the colour of the system (purple for Balance of Power, teal for Time Tokens), the kicker in Roboto Mono caps,
  the name in Barlow italic, chips (*Manual · 20% · Both*, *6 add buttons · Warning · 60 s*), the rows of the editor in two columns (Roboto Mono caps
  titles), *Used by …* in bold names, and *Edit*, *Copy*, *Rename*, *Delete* (red text, on the right). The Club default has a 3 px accent edge on top
  and a *Club default* badge, and no Rename or Delete.
- **Edit** opens the editor of before as its window, its eyebrow saying which profile (*Balance of Power profile · Endurance*, or *Club default · …*).
- **A name** is asked in the app's own small window (`.pf-ask`). Delete asks first, and says which setups still use a profile instead of deleting it.
- **The race setup** has *Balance of Power profile* (under Rules, when Balance of Power is on) and *Time Token profile* (in a Time Token Session),
  *Club default* first.

```css
html .pf-card.pf-def{box-shadow:inset 0 3px 0 var(--accent)}
html .pf-ic{background:color-mix(in srgb,var(--pf) 18%,transparent);color:var(--pf)}
html .pf-top h3{font:800 italic 20px/1.1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
```

## Plugged In

The Home cards for a USB device that was plugged in (`renderer/hwdetect.js`, glue in `app.js` mountHwDetect; styles under `#hm-detect .dx`). Each card has
an icon tile in its colour, a kicker in Roboto Mono caps, a Barlow italic title and chips with why it asks; a 3 px left edge and a soft glow in its colour.

- **A new device** (blue): *Plugged in · new to Timing*, *What is this device?*, chips with the chip name, the USB number and a hint; the three answers as
  tiles (*Likely* on the likely one, outlined in the accent), the DS tile with *DS-300 / DS-200*; *Not now* and *Not timing hardware…* (it asks first).
- **A remembered device** (amber): *The Arduino box is here*, chips *Races use: Trackmate Interface (not connected)* and *last used 12 Nov*; *Use … for races*
  and *Keep the Trackmate*.
- **A failed connect** (red): *Could not connect the Trackmate* with the reason in plain words; *Try again*, *It is something else*, *Open its page*.
- **Set aside**: a thin dashed line *… is set aside: Timing will not ask about it again* with *Undo* and *Forgotten devices*.

```css
html #hm-detect .dx{border-radius:16px;background:radial-gradient(130% 140% at 0% 0%,color-mix(in srgb,var(--c) 11%,var(--panel)),var(--panel) 62%);box-shadow:inset 3px 0 0 var(--c)}
html #hm-detect .dx-opt.dx-like{border-color:var(--accent)}
html #hm-detect .dx-thin{border:1px dashed var(--line);border-radius:12px}
```

## Start Lights

The setup guide on Home (`renderer/setupwizard.js`) as **one card**. On top a band with an eyebrow (Setup guide · step 2 of 6) and a **gantry of
step lights**: a dark light per step on one line; a finished step is lit red, the open one is lit with a ring that glows, and at the test race every
light turns green. Under it a big Barlow title, the words, and the step itself:

- **Welcome**: the words left, the plan right (every step as a row with its picture in an accent tile).
- **Names per lane**: every box has the lane's number in its colour in front (`.wz-lane`, the colours of the race screen, else one of eight);
  drivers that were already added are chips with their lane.
- **Timing hardware**: choice tiles with a picture each; the chosen one is outlined in the accent with a tick, its picture filled.
- **2.4.0 rework**: eight steps (Lanes & sensors and Commentary are new), the gantry on one line. **Timing hardware** shows the chosen interface as a
  big card (`.wz-hwcard`: its picture in an accent tile, the name in Roboto Mono caps, *Plug it in, then connect* in Barlow, a pill, and *Choose its port…*,
  *Connect* for a remembered device, the virtual one), three dashed how-to tiles (`.wz-how`) and *Choose another interface* for the tiles of before.
  **Cars** from the shared library: a green line with the number of cars (`.wz-src`) and a row per driver with a car picker (`.wz-carpick`). **Lanes &
  sensors** is the Lane Check. **Commentary**: Essential, Club and Broadcast as cards (`.wz-set`, the chosen one with the accent ring), *▶ Hear it*, one of
  your own sets, the voice and a sentence, *No commentary for now*. A page the guide sends you to has a floating pill at the bottom (`#wz-back`: *Setup
  guide · step 4 · Timing hardware* and *← Back to the guide*).
- **Test race**: a ticket (track, laps, lanes, drivers) with dashed lines between the parts.
- A **foot bar**: Back left, Skip the guide quiet, the next step as the primary button.
- **Narrow** (below 860px): the lights stay, only the open step says its name under its light; the welcome plan moves under the words; the
  ticket folds to two by two.

```css
html #view .wz-steps{position:relative;display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px}
html #view .wz-step>i{width:22px;height:22px;border-radius:50%;background:#1b1f25;box-shadow:inset 0 2px 4px rgba(0,0,0,.6)}
html #view .wz-step.wz-done>i{background:radial-gradient(circle at 40% 35%,#ff8a8e,#e5484d 55%,#a3242a)}
html #view .wz-steps.wz-go .wz-step>i{background:radial-gradient(circle at 40% 35%,#9ff2c8,#3ecf8e 55%,#1f8a58)}
.wz-lane{display:grid;place-items:center;width:40px;background:var(--c);color:#111418;font:italic 700 19px 'SF Barlow Condensed',sans-serif}
html #view .wz-hwopt.wz-on{border-color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--panel))}
.wz-ticket{display:grid;grid-template-columns:2fr repeat(3,1fr);border:1px solid var(--line);border-radius:11px}
```

The start-up window (`startup.html`) already has the logo, the wordmark and a thin red bar; it stays as it is.

**The startup window** (`renderer/startup.html`, `startup.css`, 460 × 270): a 3 px accent rule and a faint checkered strip on top, the brand, *Starting
Timing…* in Barlow Condensed bold italic, and five **start lights** that come on one after the other while the database is prepared (three held on when
motion is reduced), the note under them. The page may load the app's own fonts (`font-src 'self'`).

## Lane Check

The sensor test (`renderer/sensortest.js`): Home's **Test sensors** window and step 5 of the setup guide. A connection pill on top (green when the
hardware is connected, amber when not), then **a column per lane**: a head in the lane's colour with its number tile, a big round **sensor light**
that turns green when its sensor sees a car (and flashes bright on every crossing), the number of crossings in big mono and the last lap. The lanes
sit in the same balanced rows as Home's Grid Slot (up to 4 in a row; 5 and 6 lanes in rows of three). The summary is a line with a dot, Start again
beside it.

**2.4.0 rework.** The window head: *Lane Check · hardware* in Roboto Mono caps, *Test the sensors* in Barlow italic and the pill on the right
(`.lc-pill`, green *Connected · 4 lanes* or amber *Not connected*). Not connected: a dashed amber box (`.lc-offbox`) *Connect the … first* with
**Connect** and *Open Timing Hardware*. Connected: a row of checks (`.lc-steps`: *Lanes 2 of 4*, *Pit lane*, *Track call*, *Track power*; a green ✓ when
done, the current one with the accent ring). The lanes are asked for one at a time: the lane to drive has the accent ring and a red *Go*; a lane that lit
another lane's sensor turns amber (*!* · *lit lane 4*) and an amber bar (`.lc-swap`) says *Lane 3 lit lane 4* with **Swap 3 and 4** (Trackmate and
Arduino box) and *Not now*. Each lane has a *Pit lane* line (✓ seen in green). Under the lanes two boxes (`.lc-box`): *Track call button* (✓ Works) and
*Track power* with an Off / On switch (green when on). The summary says what to do next; *Done* closes.

```css
html .lc-step.lc-done em{background:var(--st-ok);color:#08130d}
html .st-lane.lc-wrong .st-light{background:radial-gradient(circle at 40% 35%,#ffe7a3,#f2b705 55%,#a07400)}
html .lc-swap{border:1px solid color-mix(in srgb,var(--st-warn) 55%,var(--line));background:color-mix(in srgb,var(--st-warn) 9%,var(--panel))}
html .lc-seg button.on{background:var(--st-ok);color:#08130d}
```

```css
html .st-lanes{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));max-width:calc(var(--n,4) * 210px);margin:0 auto 14px;gap:10px}
html .st-lane .st-num{background:color-mix(in srgb,var(--c) 14%,var(--panel));text-transform:uppercase}
.st-light{width:38px;height:38px;border-radius:50%;background:#1b1f25;box-shadow:inset 0 3px 6px rgba(0,0,0,.65)}
.st-lane.st-seen .st-light{background:radial-gradient(circle at 40% 35%,#9ff2c8,#3ecf8e 55%,#1f8a58);box-shadow:0 0 16px rgba(62,207,142,.55)}
```

## Flag Dialog

The app's own Yes / No and message windows (`renderer/dialogs.js`, a [Workshop Window](#workshop-window)). A **badge** in front of the title says
what kind it is: **?** a question (grey), **i** a message (grey), **!** an action that cannot be undone (accent). The text lines up with the title,
not with the badge. The buttons sit on the right with Cancel first and the answer last; a dangerous answer is a **filled red button** (in a card
elsewhere a danger button stays quiet text). The kind is a class: `appdlg-confirm`, `appdlg-alert`, plus `appdlg-danger`.

```css
html dialog.appdlg>h3:first-child{display:flex;align-items:center;gap:14px;padding:0;border-bottom:0}
html dialog.appdlg>h3:first-child::before{content:'?';display:grid;place-items:center;width:36px;height:36px;border-radius:10px;background:color-mix(in srgb,var(--ink) 9%,var(--panel));text-transform:none}
html dialog.appdlg-alert>h3:first-child::before{content:'i';font-family:Georgia,serif;font-style:italic}
html dialog.appdlg-danger>h3:first-child::before{content:'!';background:color-mix(in srgb,var(--accent) 18%,var(--panel));color:var(--accent-text,var(--accent))}
html dialog.appdlg>.appdlg-body{padding-left:50px}
html dialog.appdlg>.row.appdlg-buttons{flex-direction:row;justify-content:flex-end}
html dialog.appdlg-danger>.appdlg-buttons>.btn.danger{background:var(--accent-fill,var(--accent));color:#fff}
```

The **update notice** on Home has the same idea: a red download badge in front, the title in Barlow, a soft accent wash from the left.

## Lane Desk

The race screen under the widgets (`renderer/racedeck.js`, styles under `.rdeck`, `.rd-tabs`, `.rd-keys`). It replaces up to thirteen
full-width folders in eight colours. The widgets above are not touched.

- **The tool bar** is one Control Strip: Simulated cars, the timing status, the tools as outline buttons, Stop race (red text, red rim) and Back to Home.
- **A card per lane**, in the lane's colour (a 3px top stripe and the number tile; the colour of the layout's lanes, else one of eight).
  From top to bottom:
  - the driver and car;
  - the **Lap** button (2/4 of the width, tinted in the lane colour, with its key), then **Pit** and **Call** (quiet, their icon in their colour,
    filled only while the car is on the sensor or the call is open);
  - the **facts**, one 34px row each with a small grey label: *Tyres* (ring in the tyre colour, life bar, "72% · 29 laps", the Next-stop list),
    *Fuel* (blue bar, "% · laps"), *Pace* (the Push / Normal / Save pill and why), *Weather* (only when there is something to do);
  - the state chips (All clear, penalties), the four Race Director pads (quiet ± buttons, the pad's name in its colour, values in Roboto Mono),
    the Penalty / Damage / Failure menus and Balance of Power.
- **Lanes:** 1 lane one card of at most 620px; 2–3 in a row; 4 as 2 × 2; 5–6 in three; 7–8 in four (compact: no car name, pads two by two).
- **The race column** (340px, at the right): *Race Director* (the last action and Undo), *Weather* (the state in Barlow, the forecast, the
  Dry / Cloudy / Wet / Clearing Gear Selector), *Tyre rule* (the mandatory stops and where every lane stands), *Racing systems* (Toggle Chips:
  a green dot when on, dashed when off; "(needs Fuel)" stays in words), *Log*.
- **Tabs** under the desk for the tables (Tyres, Weather, Push and Save, Pit stops, Endurance, Resources): a quiet tab bar, the open tab with a
  2px accent line on top; the tables at their own width, not stretched; the open tab stays open for the next race.
- **The keys** as key caps in one line (Space, 1…8, ⇧+1, Ctrl+1, Y, R, S, F, Esc); the full sentence stays for screen readers.
- **Smaller windows:** under 1280px the race column goes under the lanes in two columns; under 760px everything is one column.
- **The Control Strip** starts with the race (name in Barlow, its kind, length and track under it) and its clock in Roboto Mono; the timing
  status is a pill with a light (green connected, red not connected, grey none chosen); Simulated cars is a switch.
- **The Race Director page** of Live Race (second screen, phones, tablets) has the same desk: Start / Pause / Yellow / Red / Stop as its Control
  Strip (a flag button filled in its colour while the flag is out), the Call button of a lane in its card, the open calls in the race column.
  On a phone the lane cards keep their own view: the lane picked in a strip, one card, then the race column and the tabs.
- The tables in the tabs are a [Race Sheet](#race-sheet).
- The setting "folders" (App Settings › Race Director) and time tokens keep their folders.

```css
html .rdeck{display:grid;grid-template-columns:minmax(0,1fr) 340px;grid-template-rows:repeat(7,auto) 1fr;column-gap:12px}
html .rdeck>#lcpanel,html .rdeck .lc,html .rdeck .lc-main{display:contents} /* (the lane cards' own box keeps its clicks) */
html .rdeck .lc-card{border:1px solid var(--line);border-top:3px solid var(--c);border-radius:10px;background:var(--panel)}
html .rdeck .lc-card .trk-card{display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px}
html .rdeck .lc-card .trk-lap{background:color-mix(in srgb,var(--c) 22%,var(--panel));border-color:color-mix(in srgb,var(--c) 60%,var(--line))}
html .rdeck .rd-fr{display:grid;grid-template-columns:62px minmax(0,1fr) auto;min-height:34px;border-bottom:1px solid var(--line)}
html .rd-tab[aria-selected="true"]{background:var(--panel);font-weight:600;box-shadow:inset 0 2px 0 var(--accent)}
html .rd-keys kbd{min-width:20px;height:20px;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;font:600 11px "Roboto Mono",monospace}
```

**With the Lane Desk off** (App Settings › Race Director › folders) the race folders are cards in the same look: a 3 px edge and a 7% tint of their
colour, the title in Barlow Condensed bold italic, the tables of the systems (Balance of Power, weather, tyres, damage, failures) as a Race Sheet in a box,
the Lap, Pit and Call buttons tinted in their colour instead of solid, the pads of Adjust a size smaller.

## Race Sheet

The tables of a race (Tyres, Weather, Push and Save, Pit stops, Endurance, Resources), in the Lane Desk's tabs and on the Race Director page
(the class `.rd-sheet` on what holds them). The column names in small grey capitals (10px, letter-spaced), rows quiet with a thin line, the lane
in a small tile, times, laps and multipliers in Roboto Mono, the tables at most 1100px wide. A note is one grey line with a 2px rule in the
accent at the left, not a blue box. *Correct the tyres now* is one compact box with a small-capitals title. Push and Save's lap by lap list sits
under its own small label.

```css
html .rd-sheet table.fields{width:100%;max-width:1100px;border-collapse:collapse;font-size:12.5px}
html .rd-sheet table.fields th{border-bottom:1px solid var(--line);color:var(--muted);font:600 10px "Segoe UI";letter-spacing:.12em;text-transform:uppercase}
html .rd-sheet table.fields td{padding:7px 10px;border-bottom:1px solid color-mix(in srgb,var(--line) 65%,transparent)}
html .rd-sheet .twnote{padding:3px 0 3px 10px;border-left:2px solid color-mix(in srgb,var(--accent) 55%,var(--line));background:none}
```

## Scrutineering

Finalize race results, after the race (`renderer/review.js` finishHtml, styles under `.race-finish`). Two parts:

- **The classification**: a slim row per driver (an `article.rfinish-card` with a 4px left edge in the lane colour; the winner with a thin gold ring
  and the place tile in gold). Left the place and the driver (car, lane, Winner / Position / Out / Disqualified, chips for *adjusted*, *n marked*,
  *n suspect*, *n not served*), then a **tiny lap chart** (one bar per lap, a click opens the laps), then Laps, Total (with the gap to the leader
  under it), Best lap, Points and Penalties in Roboto Mono, and the actions as small buttons. Alerts (red flag, unserved penalties, sectors) and the
  Adjust pads open under the row.
- **The lap explorer** for one driver at a time: a Gear Selector with the drivers (a dot in their lane colour) and ‹ ›; six figures (Laps, Best,
  Median, Average, Consistency, Marked); a **chart** of every lap (120px, a click goes to the lap in the list, the median dashed, the scale that of
  the clean laps so a pit stop or a missed crossing runs into the top); filters with counts (All, Marked, Suspect, Flags, Pit); several laps picked
  with a tick box and marked at once (Mark invalid, Mark valid, Take out of the records); the list in a scrolling box with a sticky head that keeps
  where it was after every change; stint rows in an Endurance race.
- **One colour per kind of lap**, the same in the charts and as the 3px mark at the left of a row: clean grey, best purple, pit orange, flag amber,
  suspect magenta, invalid red, not in the records dim. A suspect, invalid or removed lap also gets a faint full-height column in the chart.
- **The Race Director page** of Live Race has the same: after the race the whole desk, during the race the drivers as small cards (lane tile, laps,
  last and best, their lap chart) and the explorer for the one picked. On a phone every lap is a small two-line card.
- **Suspect** (found by the screen, nothing is changed by itself): a lap shorter than 0.6 × the median (*counted twice?*) or longer than 1.75 × the
  median without a pit stop, flag or pause (*about 2 laps: a crossing missed?*). When the best lap is suspect the figures say it goes in the records.

```css
html .race-finish .rf-row{display:grid;grid-template-columns:32px minmax(160px,1.4fr) minmax(120px,1fr) repeat(4,minmax(74px,auto)) auto;gap:6px 16px}
html .race-finish .rf-list>.rfinish-card{border:1px solid var(--line);border-left:4px solid var(--c);border-radius:10px}
html .race-finish{--rx-ok:color-mix(in srgb,var(--ink) 42%,var(--panel));--rx-best:#b07cff;--rx-pit:#f08a24;--rx-flag:#f2b705;--rx-sus:#d16bff;--rx-bad:#e5484d}
html .race-finish .rx-row.rx-k-sus{box-shadow:inset 3px 0 0 var(--rx-sus);background:color-mix(in srgb,var(--rx-sus) 7%,transparent)}
html .race-finish .rx-table thead th{position:sticky;top:0;font:600 10px "Segoe UI";letter-spacing:.12em;text-transform:uppercase}
```

## Cue Card

A call of an audio set, open under its row (`renderer/audiostudio.js`, styles under `.cue`). It reads from top to bottom, with no folders and no
Variation list:

- **Plays when**: the moment in one plain sentence, and its own settings next to it (the pause before the first light, the gap of a battle…).
- **What it says**: every line of the call at once, each a row with **▶** (hear it), the text field, and **⋯** (How it plays: *Say it*, *Play a sound
  file*, *Sound file, then say it*; then *Delete this line*). A sound file shows as a chip with its name, or a quiet *Choose a sound file…* button.
- **Race values** are chips under the line you are typing in ({driver}, {other}…), with the rest in a short list; *Sounds like: “Alex takes the lead”*
  shows only when a line has a value, or says what is wrong (a value the call does not know, a file that is missing).
- **Only when…** is a small dashed pill under a line (solid when conditions are set); it shows on the line you are editing and where it is set.
- **+ Add another line** (dashed), with one line saying that a line is picked at random each time.
- **The repeat limit** is one quiet row at the bottom, under a thin line.
- The row of a call says *n lines* and has ▶ in the accent. An ambient sound has the same card: its files as lines, its options under *Plays*.
- **Voice & playback**: the groups are quiet (titles in small capitals), the fields as wide as what they hold.

```css
html .audio-editor fieldset.audcall.cue{display:flex;flex-direction:column;gap:14px;border-left:3px solid var(--accent);border-radius:0 0 10px 10px}
html .audio-editor .cue-line{display:grid;grid-template-columns:32px minmax(0,1fr) 32px;gap:8px;padding:6px;border:1px solid var(--line);border-radius:9px}
html .audio-editor .cue-line:focus-within .cue-vars{display:flex}
html .audio-editor .cue-var{padding:2px 9px;border:1px solid var(--line);border-radius:11px;font:500 11.5px "Roboto Mono",monospace}
```

## Race Report

Database › Results and Records (`renderer/database/results.js`, styles under `.rr-`).

- **A saved race in the list** is a row: a **date tile** (day in Barlow, month in small capitals), the race name with its weekday, time, kind and
  track under it, championship tags, and the **winner** (or the fastest in a practice) as a pill with the cup. The open race has an accent edge.
- **Opened, as a report:** the actions as one Control Strip on top (Export to PDF filled, the share buttons, Historical Review…, Delete at the far
  end); the **podium** (three cards with a 3px top in gold, silver and bronze, the place tile in that colour, laps and time in mono); the
  **classification** as a Race Sheet table in its own box; the race notes (weather, scoring, interruptions) as grey lines with an accent rule;
  the heats as small cards; and the **lap times as a table**: a row per lap (H1 / F A for heats and finals), a column per driver, times in mono,
  the best lap of every driver in purple, a pit lap orange, an invalid or too slow lap struck through in red, the head sticky, at most 520px high.
  The page buttons of the laps sit right above it.
- **Track records and personal bests** are Race Sheet tables (small capitals, times in mono).

```css
html .rr-date{display:grid;place-items:center;width:44px;height:44px;border-radius:9px;background:color-mix(in srgb,var(--ink) 9%,var(--panel))}
html .rr-p{display:grid;grid-template-columns:34px minmax(0,1fr) auto;border:1px solid var(--line);border-top:3px solid var(--pc);border-radius:10px}
html .rr-laps thead th{position:sticky;top:0;background:var(--panel)}
html .rr-laps td.rr-best{background:color-mix(in srgb,#b07cff 16%,transparent)}
```

**The record tables** (track records, personal bests): a note in place of Remove (*Recorded by another source*, *Not yet in the shared library*) wraps
as a small grey line, so the table fits its folder. **An empty page** (no races, no stints) is a dashed card: a 52 px icon tile, *No races yet* or *No
stints yet* in Barlow, and the words of where they come from.

## Heat Board

A heat race under the race screen (`renderer/race.js`: drawHeatNext, drawHeatList, drawOverall, drawFinalPick; styles under `.hn`, `#heatlist`, `#overall`).

- **Next up**: while the race waits for a heat, a card on top with an accent edge: *First up* / *Next up · 2 of 4 done*, the heat in Barlow, its
  drivers as lane pills (the number in the lane colour), and **Start heat 2** (Space starts it too). Before a final it says to choose the lanes first.
- **The heat list** is a grid of **heat cards**: the heat in Barlow with its state tag (*Done* green, *Racing now* filled accent, *Next* accent tint),
  a row per lane with a dot in the lane colour, then *Winner* and the result and laps in mono. The heat racing or next has an accent top. (The table
  is kept for screen readers: its rows are the cards.)
- **The overall result** is a Race Sheet in a box; the places 1–3 in gold, silver and bronze.
- **Choose the lanes of a final** and **who drives** (teams) are cards with an accent edge; the lanes are tiles in their lane colour.

```css
html #raceactive>.hn{display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr) auto;border-left:4px solid var(--accent);border-radius:10px}
html #heatlist table.hl>tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:8px}
html #heatlist table.hl tr.hl-next{box-shadow:inset 0 3px 0 var(--accent)}
html #finalpick .fp-lane{border-left:5px solid var(--c);background:color-mix(in srgb,var(--c) 12%,var(--panel))}
```

## Title Fight

The standings of a championship (`renderer/championshipui.js`: renderChampStandings, champTableHtml; styles under `.chstbar`, `.chseason`, `.chpod`,
`.chsec`, `.chtable`, `.chrounds`). The championship colour (`--c-ch`, pink; darker in the light themes) is the accent of the page.

- **One [Control Strip](#control-strip)**: the championship (and the classification of a multi-class championship), Drivers / Teams / Rounds, and
  Export to PDF at the far end.
- **The season band**: the name in Barlow with *4 of 6 rounds driven*, the rounds as a **track** of segments (driven: filled; next: outlined; later:
  grey; R1… under them in mono), and on the right *Next round* with its name and date (or *The season · Complete*).
- **Who leads** is a quiet line with an edge in the championship colour; races saved and not awarded are an amber note.
- **The first three** as podium cards like the [Race Report](#race-report): the place in a gold, silver or bronze tile, the name with the team and
  wins (for teams: their drivers), the points in Barlow and the gap under them. Not shown on Rounds or before a race is awarded.
- **The standings** are a Race Sheet in a box: the title as a kicker, the place in Barlow (1–3 in their colours), the place and the name stay in view
  when the table scrolls sideways, the numbers in mono, **the best score of every round lit** (gold tint), dropped results struck through, a fastest
  lap in the championship colour, and **a bar under the points** (its length the share of the leader's points).
- **Rounds**: a card for every round with its state tag (*Done* green, *Next* in the championship colour with a coloured top, *Later* grey), the
  winner and the date.

```css
html .chseason{display:grid;grid-template-columns:minmax(180px,auto) minmax(0,1fr) auto;border-left:4px solid var(--c-ch);background:color-mix(in srgb,var(--c-ch) 6%,var(--panel))}
html .chs-track>li.done::before{background:var(--c-ch)}
html .chtable tr td.chtop{background:color-mix(in srgb,#d4a400 16%,var(--panel));font-weight:700}
html .chbar{display:block;width:var(--w);height:3px;margin:4px 0 0 auto;border-radius:2px;background:var(--c-ch)}
html .chrc.next{box-shadow:inset 0 3px 0 var(--c-ch)}
```

The PDF of the standings is unchanged.

## Record Card

The card of a record in the Database (`renderer/database/viewer.js`: openView; `renderer/driverprogress.js`; styles under `.vchead`, `.vcsec`, `.vcstats`,
`.vcmeter`, `.svc-tracks`, `.dp-`). It opens on a click on a row or a card, to look at; Edit opens the form.

- **The head**: the picture (or the coloured initial) on the left, beside it the kind (*Slotcar*, *Driver*, *Track*) as an accent kicker and the name
  in Barlow; *Service due* under it when the car is due. On a phone the picture is on top.
- **The parts are boxes**, each with a kicker: **Statistics** (a slotcar: Mileage, Last Driven, Sessions, Wins, Deslots, Fastest Lap Ever as
  **tiles**, the figure in Barlow, the track of the fastest lap small under it), **Service** (a **meter** of the laps since the last service against
  the interval, green, in the accent colour when it is due; then the service fields), **Best lap per track** (a Race Sheet, the best lap in purple),
  **Details** (the other fields as a quiet list in columns), and the **progress** of a driver last.
- **The progress of a driver**: the clean laps, sessions and tracks as tiles, then a **card for every track**: its name in Barlow, the best lap in
  purple and the laps on the right, the trend as **chips** (▲ green: faster or steadier; ▼ orange: slower or less steady), the chart full width with a
  legend and the months it covers, and the table of the months folded away (*Month by month · 11 months*). The sentence of the trend stays for
  screen readers.

```css
html .vchead{display:grid;grid-template-columns:minmax(150px,220px) minmax(0,1fr);align-items:center;gap:18px}
html .vcsec{padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--panel)}
html .vcsec .vcstats dd{font:700 22px/1.1 "Barlow Condensed","Segoe UI",sans-serif}
html .vcmeter>i{width:var(--p);background:color-mix(in srgb,#3ecf8e 55%,var(--panel))}
html .dp-chip.up{background:color-mix(in srgb,#3ecf8e 12%,var(--panel));color:#3ecf8e}
```

## Token Desk

The time tokens of a Time Token Session (`renderer/tokenui.js`: TokenPanel; styles under `.tkpanel`), on the race screen and on the Tokens page of
Live Race. On the race screen the Time tokens folder comes first (before Track actions): it is what a token night is run with.

- **The head**: the hint, then **what the lanes are doing** as a pill (*2 running · 1 almost up · 1 time's up*, or *No lane has time*), and Pause all
  on the right.
- **A card for every lane** (the table is kept for screen readers and the tests: its rows are the cards), in a grid of 290px and up:
  *LANE* and its number in a disc of the lane colour, the driver choice beside it; **the clock** in mono 38px in a dark box with its state pill; the
  **buttons that add time** as a 3-column grid (tinted green while they can be pressed), **the ones that take time off** smaller under them, and
  **Undo · End time now · Clear** in the foot.
- **The state is the edge**: a grey top for no time, green while it runs, the warning colour (Time Tokens settings) when it is almost up, and the
  colour of time up with a tint of the card when it is up (the clock in that colour too).
- **Penalties** beside the time tokens (and in the folders whenever the Lane Desk is off) are a Race Sheet in a box; the log is quiet lines.

```css
html .tkpanel .tktable>tbody{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:10px}
html .tkpanel .tktable tr{grid-template-areas:"lane who" "clock clock" "add add" "foot foot";border-top:4px solid var(--line);border-radius:12px}
html .tkpanel .tktable tr.tk-out{border-top-color:var(--tkc,#d62828);background:color-mix(in srgb,var(--tkc,#d62828) 11%,var(--panel))}
html .tkpanel .tkclock{font:700 38px/1.05 "Roboto Mono",Consolas,monospace}
```

## Live Desk

The landing page of Live Race (`renderer/liveview.js`): the second screen, and what phones and tablets open on the network. On top an **ON AIR
panel**: off air (a quiet outlined tag, "No race is running") or on air (a red tag with a pulsing dot, the race in Barlow, its phase as a pill, and on
the right the clock, the lap of the leader and the leader in their lane colour). Then the pages in **two groups**: *Follow the race* (they only
show it) and *Run the race* (Race Director and Tokens, they change it). Every page is a **row tile**: its picture in a 52px tile (accent tint;
filled red for the pages that run the race; gold for Results), the name in Barlow, its line, an arrow. On a phone the tiles are a compact list.
On the landing the header's status line is hidden (the ON AIR panel says it); the pages behind it keep it. The lap is the leader's current lap of the
total when the setup races by laps, else the laps driven.

```css
.lv-air.on{border-color:color-mix(in srgb,var(--accent) 45%,var(--line));background:linear-gradient(100deg,color-mix(in srgb,var(--accent) 24%,var(--panel)),var(--panel) 65%)}
.lv-airtag{height:36px;padding:0 14px;border:1.5px solid var(--line);border-radius:8px;font:italic 700 16px 'SF Barlow Condensed',sans-serif;letter-spacing:.12em;text-transform:uppercase}
html .lv-desk .lv-tile{display:grid;grid-template-columns:52px minmax(0,1fr) 16px;column-gap:14px;min-height:86px;padding:14px 16px;border-radius:12px}
html .lv-desk .lv-tile>svg{grid-row:1 / 3;width:52px;height:52px;padding:12px;border-radius:12px;background:color-mix(in srgb,var(--accent) 13%,var(--panel))}
html .lv-desk .lv-tile.special>svg{background:var(--accent-fill,var(--accent));color:#fff}
```

## Live Pages

The pages of Live Race behind the [Live Desk](#live-desk) that follow the race (`renderer/liveview.js`: shell, status, drawBoard, drawDriver; styles
under `.lv-head`, `.lv-titles`, `.lv-opts`, `.lv-board.classic`, `.lv-lanes`, `.lv-dg`). Built for a phone as much as for a second screen.

- **The Page Bar**: a sticky bar with a soft edge: *‹ Live Race*, the page in Barlow over the race (the race in small type, cut off with … when it is
  long) and **the phase as a pill**: *Racing* green with a pulsing dot, *Lights* red, *Paused* / *Heat finished* amber, *Finished* plain. Full screen on
  the right (an icon on a phone). The words of the status (*Check race · Racing*) stay for a screen reader. The Race Director and Tokens keep their
  tinted bar with the Control badge. (Race timing keeps its clean full-screen header.)
- **Customize** is a button (three lines, the name, a chevron) that opens its settings in boxes, the names of the boxes as kickers.
- **The classic leaderboard** is a Race Sheet: the names of the columns (*Pos · Driver · Laps · Best · Gap*), the lane colour as a bar on the left of
  every row, the leader in a gold tint, the times in mono, the gap grey, never smaller than 15px. A row design from the Leaderboard Editor is drawn as
  it is designed.
- **Driver stats**: the drivers as **pills** with the lane number in a disc of the lane colour (in a row that scrolls sideways on a phone); the
  driver as a **head card** (avatar, the name in Barlow, the car and the lane with its dot); the figures as tiles with a kicker and the number in
  Barlow; a figure that is empty shows a dash.
- **Racing rules** is a page to read (a card of 820px at most); **a page with nothing to show** is a dashed card in the middle.

```css
html :not(.lv-clean)>.lv-head:has(#lv-back){position:sticky;top:0;border:1px solid var(--line);border-radius:12px;backdrop-filter:blur(6px)}
html .lv-st-ph[data-phase="running"]{background:color-mix(in srgb,#3ecf8e 14%,var(--panel));color:#3ecf8e}
html .lv-board.classic table.lb tr[data-lap-lane] td.lb-pos{box-shadow:inset .22em 0 0 var(--c,transparent)}
html .lv-lanes .btn>i{width:28px;height:28px;border-radius:50%;background:var(--c,var(--muted))}
```

## Plugin Desk

The open page or tool of Customization › Plugin Pages & Tools (`renderer/pluginpages.js`; styles under `.pd-phead`, `.pd-sec`, `.pd-page-output`). The
side list of pages and tools and the empty page are as they were.

- **The head**: *Page* or *Tool* as an accent kicker, the name in Barlow, what it does; on the right **the plugin as a status pill** (*Lap Coach /
  running*): green dot while it runs, red when it failed or is missing, grey otherwise.
- **Inputs** in a box with its kicker (the fields, then Apply inputs or Run tool); a page without inputs has no box.
- **The output** in a box (*Live* for a page, *Result* for a tool): a metric is a **tile** with a kicker and the figure in Barlow, a bar is an 8px meter,
  a line is a chart of at most 96px on a soft ground in the accent colour, text in 14px. (A plugin widget on the race screen draws as it did.)

```css
html .pd-runtime:is([data-state="running"]){border-color:color-mix(in srgb,#3ecf8e 45%,var(--line));color:#3ecf8e}
html .pd-sec{padding:12px 14px;border:1px solid var(--line);border-radius:10px}
html .pd-page-output .pd-row>.pd-metric{padding:10px 12px;border:1px solid var(--line);border-radius:9px}
```

## Dealership Sheet

App Settings › Connections › Dealership Mode (`renderer/paddockui.js`, `renderer/paddocklocalui.js`, as a [Settings Sheet](#settings-sheet)).

- **The connection is a status pill** under the title: a grey dot with no host, amber for a saved host that is not connected, green with a halo when
  it is connected (`data-state` off / saved / on).
- **A row with more than one control stacks**: its words on top, the buttons and the list under them, from the left (no row squeezes its words to
  nothing any more: *Find Dealership on network*, *Older local integration service*).
- The pages of the cars (*Previous · 0 cars · Page 1 of 1 · Next*) are one line in the middle.
- Result delivery says its first sentence, and the rest is folded under **How result delivery works**.

## Review Sheet

Paddock's Historical Review: submit an older race (`renderer/paddockhistorical.js`; styles under `.historical-dialog`, `.hr-`).

- **The head**: *Paddock · Historical Review* as an accent kicker over the title, a line under it.
- **The race** as a head card with an accent edge: *Older race*, the name in Barlow, the track and laps, the review destination.
- **The notice** (*Received is not accepted…*) is an amber callout.
- **The drivers in the evidence** as a list: the name, the laps in mono, and a tag: *Recorded collection car* green, *not linked automatically*
  amber, *Virtual* grey. What is missing is a row of grey chips; the fine print is folded under *What is sent, and the limits*.
- **The foot**: Close on the left, **Submit evidence for review** on the right (it leaves once it is sent).
- **A submission** is a card: its name, and every decision as a pill with a dot (*Pending* amber, *Approved* green, *Rejected* / *Conflict* red,
  *Cancelled* grey), the ids in small mono.

## Performance Gauges

The Performance line under the race tools (App Settings › General, `renderer/perfui.js`, `Perf.gauges` in `renderer/perf.js`). The words of the line
stay for a screen reader; the eye gets a row of **gauges**: what it measures as a kicker, the figure in mono, a word under it (the parts of the CPU,
*up to, last 10 s*), and an edge in the colour of how healthy it is: green, amber (a warning) or red with a tint (a slow screen).

| Gauge | Green | Amber | Red |
|---|---|---|---|
| Frames | 50/s and up | 30–49 | under 30 |
| Slowest frame | up to 50 ms | up to 150 ms | more |
| Screen update | up to 8 ms | up to 16 ms | more |
| App CPU | up to 40% | up to 75% | more |
| Core stalled | up to 50 ms | up to 100 ms | more |
| Race save | up to 50 ms | up to 150 ms | more |

```css
html .pg{display:inline-flex;flex-direction:column;min-width:92px;padding:5px 10px 6px;border-left:3px solid var(--pc);border-radius:8px}
html .pg-bad{--pc:#e5484d;background:color-mix(in srgb,#e5484d 8%,var(--panel))}
```

## Status Lights

The three lights of the main menu as one button (`renderer/racecheck.js` builds what they say, `mainbar.js` draws them; styles under `.mb-st`,
`.mb-status`). Each light is a subject, in this order: **Timing** (the timing hardware), **Next race** (the race setup on Home) and **Sharing** (the
network, the shared library, the backup). Red: must be put right (for the next race Start race stays off); amber: good to know; green: ready; grey:
off by choice. The names are in the hover and for a screen reader.

- **The drop-down** (`.mb-status`, under the button, on every page): a section per light with its dot, its title in Barlow (*Next race · Check race*)
  and a note on the right (*Ready to start · 1 to know*, *Not ready: 2 to fix*, *Not counting laps*, *9 results to send*). Its lines are rows with a
  round mark (✓ green, i amber, ! red filled) and a button that goes where it is put right (*Choose a car*, *Adjust the plan*, *Choose hardware*,
  *Test sensors*, *Show QR code*, *See why*). Red lines first, then amber, then green. Along the bottom what is in the database.
- **Home** has no strip of chips under the start card any more (the start card keeps a 16 px gap to the cards under it). The pill by Start race says
  how the lanes are and opens the drop-down (*Check ▾*).
- During a race the first section is *This race*.

```css
html .mb-st{display:flex;gap:6px;height:34px;padding:0 10px 0 12px;border-radius:999px;border:1px solid var(--line)}
html .mb-st i{width:10px;height:10px;border-radius:50%;background:var(--c);box-shadow:0 0 8px color-mix(in srgb,var(--c) 65%,transparent)}
html .mb-status{position:fixed;width:min(560px,calc(100vw - 24px));border:1px solid var(--line);border-radius:14px;background:var(--panel)}
html .mb-status li{display:grid;grid-template-columns:20px minmax(0,1fr) auto;gap:10px;border-radius:9px}
html .mb-status li.bad{box-shadow:inset 0 0 0 1px color-mix(in srgb,#e5484d 45%,transparent)}
```

---

## Setup Sheet

The race setup form (`schema.js` racesetups groups and rail, `database.js`, `setupwords.js` rail, `formui.js` kind). Nothing changed in how a setup
is stored.

- **This race in one line** on top: the sentence of before with chips under it (ready or not, Track Call, the systems that are on in green, the
  screen and the sound in grey). The explaining lines above it are gone.
- **The rail**, *This setup*: The race · Heats (only for heats) · Start and flags · Driver swaps (only with teams) · Race systems · Screen and sound;
  *Only if you need it*: Pits and service · Timing hardware. A section says **Set** (green) when it is filled in or changed and **Missing** (amber)
  when something it needs is not there; a section at its standard says nothing (every Rail form: the dot is a word now).
- **The race**: the kind as six cards (Free practice, Qualifying, Race, Heats, Endurance, Time tokens; the Format choice is gone, the switch for a
  team that swaps is under Heats), the **tracks as cards** (a drawn oval with its lanes in the lane colours, or the track's picture; the name, the
  lanes, the length; the chosen one lit), the length with **quick picks** (20 · 50 · 100 · 200 laps, 5 · 10 · 15 · 30 minutes), who wins.
- **Heats** holds how the heats are added up (*Points and finals*).
- **Start and flags**: *Start lights* (out after at least … at most …), *The first lap and a red flag*, *Track Call* (what the button does, the
  power under yellow and red, the second-press window) as three parts of one section.
- **Race systems**: a row per system with **On at the start** right under its choice (the row of switches of before is gone; a system that is hidden
  on this computer has none).

```css
html .rsform .rsri .rsdot{width:auto;height:auto;padding:2px 7px;border:0;border-radius:999px;font-size:10.5px;font-weight:700}
html .rsform .rsri .rsdot.ok{color:#3ecf8e;background:color-mix(in srgb,#3ecf8e 14%,transparent)}
html .rs-chip{display:inline-flex;gap:6px;padding:3px 10px;border-radius:999px;border:1px solid var(--line)}
html .rs-tracks{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px}
html .rs-track.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
html .rs-quick .btn{height:28px;border-radius:999px;font:500 12.5px 'SF Roboto Mono',monospace}
```

---

## Garage

The Database lists of tracks, drivers, teams and slotcars (`renderer/garage.js` makes the markup, `renderer/database/manager.js` draws it,
`renderer/database/garageactions.js` does what the menus do; styles under `.gx-`). It replaces the [Garage Card](#garage-card) of these lists and their
letter tiles. Nothing changed in how a record is stored; the livery colours and the service log of a car are kept by Timing (`settings.garage.cars`).

- **On top**: what is in the list in figures (*48 cars · 23,501 laps driven · 3 due for a service*), in Roboto Mono with words after them; for slotcars
  the *Slotcar library · Dealership cars* switch on the right.
- **The Control Strip** (`.gx-strip`): Add (the one accent), the page's own import (*Import a club list*, *Import from Circuit*), the search, the
  **filters as chips with their counts** (*Service due* with an amber dot), *Sort*, Cards or List as a [Gear Selector](#gear-selector), and **⋯** for
  Extra fields, View settings and Refresh.
- **A card** (`.gx-card`): the picture area shows the thing's own photo, else its **drawing**: a car seen from above in its livery with its number
  on a roundel, a driver's helmet in their colour with the callsign big in Roboto Mono and the country, a track as an oval with its lanes in the lane
  colours. Badges on the picture (class; *Service due* amber, *Retired*, *Virtual rival* purple, *Raced most*). Under it a small caps line, the
  name in Barlow, and **three figures** from the races (laps, best lap in purple, raced; races, wins, best; record, by, races). The foot has Edit
  and **⋯** (no red on a card: Delete and Archive are in the menu). A driver card has a line in the driver's colour under the picture.
- **The list** (`.gx-table`): a tick, a small drawing, the name, the columns chosen in View settings, the three figures, Edit and ⋯. Ticked rows
  get a bar over the list (*2 chosen · Set class… · Mark serviced · Archive · Clear*).
- **Empty** (`.gx-empty`): a dashed card with a big icon, what the thing is, and Add (and the import).

```css
html .gx-strip{display:flex;gap:8px;padding:8px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
html .gx-chip.on{border-color:var(--ink);background:color-mix(in srgb,var(--ink) 10%,var(--panel))}
html .gx-pic{aspect-ratio:16/8.4;background:radial-gradient(120% 90% at 50% 100%,color-mix(in srgb,var(--ink) 9%,var(--panel)),color-mix(in srgb,var(--bg) 70%,var(--panel)))}
html .gx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid var(--line)}
html .gx-stats b.fl{color:#b48cff}
html .gx-menu{position:fixed;padding:5px;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
```

---

## Build Sheet

The car editor (`renderer/paddockshared.js` for a car of the shared library; the local form is a [Tech Sheet](#tech-sheet) by `schema.js` slotcars
`rail`; styles under `.bs-`).

- **The header**: the drawn car (its livery colours, its number), *Edit car · shared library* as a kicker, the name in Barlow (it follows the name
  field), pills (class, scale, number) and a state on the right (*Ready to race* green, *Service due* amber, *Out for repair* or *Archived* grey).
- **The rail**: *This car*: The car · Motor and gearing · In the race · Service, each with a one-line note in Roboto Mono (*12:36 · 3.00 : 1 · 21k rpm*,
  *Due now · 1,204 laps*); *Only if you need it*: Extra fields.
- **The sections** are boxes with a Barlow title and a question as subtitle, fields in a 6-column grid with the unit in the box (*teeth*, *mm*, *rpm*).
  *Livery colours* as swatches, *Can it race?* as a Gear Selector (Available · Kept for one driver · Out for repair). Under the gearing **three tiles
  worked out**: gear ratio, one motor turn, top speed in theory. *Service*: a meter of the laps since the last service (green, amber when due),
  the counters, a note for the log, *Mark serviced now* (amber outline), and the service log.
- **The foot**: a note, **More** (Archive car, Reload current record, Save history), Cancel and Save.

```css
html dialog.bs-dialog{width:min(1180px,calc(100vw - 48px));height:min(760px,calc(100vh - 40px));padding:0;border-radius:16px}
html .bs-hd{display:grid;grid-template-columns:170px minmax(0,1fr) auto;gap:18px;padding:14px 18px}
html .bs-g{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px 14px}
html .bs-tile b{font:700 20px 'SF Roboto Mono',Consolas,monospace}
html .bs-meter.due{border-color:color-mix(in srgb,#f2b705 40%,var(--line))}
```

---

## Record Book

Results and Records › Racing Records (`renderer/recordbook.js` makes the words and rows, `renderer/database/recordbookview.js` draws the page and its
windows; styles under `.rb-`). Token Records and Championships keep their pages. Nothing changed in how a race is stored; a correction adds
`correction` to the session and changes its standings.

- **Track records** first, as cards of equal weight (`.rb-rec`): the track drawn with its lanes, its name in Barlow, lanes and races; the record big
  in Roboto Mono purple; the holder with their helmet and car; a foot with *Set 19 Nov*, **Beaten 11×** (opens the history) and ⋯. A fresh record
  has a purple *New* badge. Four are shown; *All 8 tracks ›* shows the rest.
- **One filter bar** (`.rb-strip`): search, Track, Driver, the kinds as chips with counts (Championship with a pink edge), Period, ⋯ (CSV).
- **The race log** (`.rb-log`): by month (*November 2026 · 28 sessions*), a row per race: a date tile, the name with its kind, track and round
  (*Winter Cup 2026 · R5* in pink; *Corrected* in amber), the winner with a gold 1 and their helmet with second and third after them (in practice the
  fastest), the best lap in purple. One *Show more* instead of pages.
- **The driver panel** (`.rb-box`, sticky): helmet and name, their personal best per track with the gap to the record, their form as place badges
  (gold, silver, bronze), *Full history ›*.
- **Windows** (`dialog.rb-win`): a picture, a kicker and a Barlow title on top, tiles, then a list: the history of a record (the record row tinted
  purple, the gain in green, how long each stood), a driver's history (a line of their places, every race, their personal bests), *Correct the result*
  (a row per car with time to add, laps to take, Out, the new place as ▲ green or ▼ orange, the reason).
- **A race opened** shows its report in place under *‹ Record book*.

```css
html .rb-recs{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:12px}
html .rb-time{font:700 30px/1 'SF Roboto Mono',Consolas,monospace;color:#b48cff}
html .rb-row{display:grid;grid-template-columns:46px minmax(0,1.4fr) minmax(0,1.3fr) 80px 14px;gap:12px}
html .rb-pos.p1{background:#f5c211}html .rb-pos.p2{background:#c8ced6}html .rb-pos.p3{background:#d08a4c}
html .rb-tag.ch{color:var(--c-ch,#ec4899);background:color-mix(in srgb,var(--c-ch,#ec4899) 14%,transparent)}
html .rb-cols{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:16px}
```

---

## Timing Desk

App Settings › Timing Hardware (`renderer/hwdesk.js` makes the cards, `renderer/hwdeskview.js` draws the pages and wires them; the sections of an interface are tabs by
`SettingsRail` (`secTabs`); styles under `.hd-` and `.sr-sectabs`). Nothing changed in how an interface is set up or stored; the DS serial settings are kept now
(`dsSerial`), and `hwDiagnostics` says whether the developer sections are shown.

- **The rail**: Overview · Trackmate · Arduino box · Parallel port · DS Electronics · Plugin · Forgotten devices, each with how it stands (*In use · connected*,
  *Ready · remembered device*, *Not set up*). The dropdown *Timing hardware in use*, the yellow "not counting laps" banner, the *Other* page and the oXigen page
  are gone.
- **The big card** (`.hd-hero`) on the overview and on every interface page: the device's picture, a kicker (*Counts the laps* or *Interface*), the name in big
  Barlow, its state as a pill (green connected and counting, amber not connected, blue connected but not counting, grey not set up), the lanes and where they
  come from (*4 lanes, from Club Oval*), and the buttons: *Test the sensors*, *Disconnect*, *Connect & use*, *Connect*, *Choose the port*, *Find the lane
  order*. A green or amber glow in its corner says how it stands. When the big card has a main button, the main buttons of the page under it turn plain.
- **The live lanes** (`.hd-lanes`): a card per lane in its lane colour with a light that flashes on a crossing, the last lap in Roboto Mono, how long ago,
  the sensor and the crossings since the app started.
- **The interfaces as cards** (`.hd-card`) of equal weight: picture, name in Barlow, what it is, how it stands, *Set up* and *Connect & use*; the one in use
  has a green edge; oXigen Digital is a dimmed *Coming later* card.
- **An interface page**: its parts as tabs under the big card (`.sr-sectabs`), one shown at a time; its own header and side list are hidden. *Diagnostics*
  (`.hd-fold`, dashed) at the bottom shows the developer parts.
- **Find the lane order** (`dialog.hd-win`): a step per lane in its colour (done: filled with a tick and its sensor, now: lit), what was swapped in an amber
  box, *Use this order*.

```css
html .hd-hero{display:grid;grid-template-columns:150px minmax(0,1fr) auto;gap:22px;padding:20px 22px;border-radius:18px}
html .hd-hero.ok{background:radial-gradient(130% 120% at 0% 0%,color-mix(in srgb,#3ecf8e 9%,var(--panel)),var(--panel) 60%)}
html .hd-id h1{font:700 italic 38px/1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
html .hd-led.hit{background:var(--c);border-color:var(--c);box-shadow:0 0 14px var(--c)}
html .hd-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
html .sr-sectab.on{background:color-mix(in srgb,var(--ink) 12%,var(--panel));color:var(--ink);font-weight:600}
```

---

## Commentary Booth

The audio set editor (`renderer/audiobooth.js` makes the cards, rows and words, `renderer/audioboothview.js` does what its buttons do, `audiostudio.js` lays it out;
styles under `.ab-`). Nothing changed in how a set is stored, apart from two new parts: `names` (how each driver is said: `say`, or a recording `file`) and `sink`
(the speaker).

- **The rail** starts *On air*: **The voice & presets** (where a set opens) and **Driver names**; then the race calls by subject and the ambient sounds, as before.
- **On air** (`.ab-air`): a red *On air* plate, *The voice* in big Barlow, the voice, speed, pitch and how drivers are called, *Plays on* (the speaker), and a
  sentence with *Hear it*. A red glow in its corner. Beside it the balance of the calls and the ambient sounds as two bars, and *Play a sample race* with a
  round red play button.
- **How much it says** (`.ab-presets`): Essential, Club and Broadcast as cards of equal weight: the name in Barlow, the number of calls in Roboto Mono, what it
  is for, a bar of 20 blocks (green: the share of calls on), what it would change, and its button. The preset closest to the set has the accent edge.
- **Driver names** (`.ab-names`): a row per driver: helmet, name, callsign, *Said as* (empty: as written), ▶, *Record* (a red dot; *■ Stop* while it records)
  or *File…*, and *✓ Recorded* in green with *Remove*.
- **The sample race** (`.ab-samplebox`): a red progress bar and a row per call: the time, the call, what was said; the row being said is tinted red with
  *● speaking*.

```css
html .ab-air{padding:18px 20px;border-radius:18px;background:radial-gradient(130% 120% at 0% 0%,color-mix(in srgb,#e5484d 10%,var(--panel)),var(--panel) 60%)}
html .ab-onair{border:1.5px solid #e5484d;color:#ff6b6b;font:700 italic 13px 'SF Barlow Condensed','Bahnschrift',sans-serif;letter-spacing:.12em}
html .ab-presets{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
html .ab-pbar span.on{background:#3ecf8e}
html .ab-tr.now{background:color-mix(in srgb,#e5484d 9%,var(--panel));box-shadow:inset 3px 0 0 #e5484d}
```

---

## Engineer's Bench

App Settings › **Calculations** (`renderer/calcbench.js` holds the words, lists and the formula sheet; `renderer/calculationsui.js` lays out the bench; styles
under `.cb-`, in `main.calc-content.cb-on`). The examples, rules and formulas of before are the same; they are sorted onto the bench.

- **The header** (`.cb-hd`): *Calculations · topic* in Roboto Mono caps, the topic as a question in 38 px Barlow italic (*How fast is normal?*, *How long is a
  stop?*, *Who scores what?*), one line, chips with the systems in use and the race setups that use them; *Find a calculation…* and *Formula sheet*.
  A glow in the colour of the topic.
- **Try it** (`.cb-try`): a dashed panel in the colour of the topic with a striped head and the tag *Preview · nothing is saved*, and *Reset*. For pace:
  *Example laps / From a real race* (a race and a driver), the laps as bars with the benchmark as a dashed green line and left-out laps striped, a
  *New lap* slider, and the lap as a verdict in 30 px Barlow (*5.9% faster · full push*) with a gauge from full push to full save and chips (tyres, fuel,
  benchmark). The other examples follow, each with *Compare with* (another saved system) and *With the saved values* while a rule is not saved yet.
- **Your rules** (`.cb-rules`): a solid panel with the colour of the topic on its left edge, sticky beside Try it: the saved settings as labelled fields,
  each system with its picker, *Edit all … rules* and *Create …*; at the bottom one **save bar** (`.cb-save`: a green dot, or amber with *N unsaved
  changes*, *Undo*, *Save*). Leaving the topic with unsaved changes asks first.
- **How it is worked out** (`.cb-how`): the formulas as cards (title, the equation in Roboto Mono on a dark plate, the words) and *With your numbers* in the
  colour of the topic, following Try it. A formula found with *Find* flashes.

```css
html .calc-content.cb-on .cb-try{border:1.5px dashed color-mix(in srgb,var(--cb) 45%,var(--line));border-radius:16px}
html .calc-content.cb-on .cb-tryh{background:repeating-linear-gradient(135deg,color-mix(in srgb,var(--cb) 10%,transparent) 0 10px,transparent 10px 20px)}
html .calc-content.cb-on .cb-rules{position:sticky;top:12px;box-shadow:inset 3px 0 0 var(--cb)}
html .calc-content.cb-on .cb-out h3{font:800 italic 30px/1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
html .calc-content.cb-on .cb-barrow em{border-top:2px dashed #3ecf8e}
html .calc-content.cb-on .cb-save.dirty .cb-dot{background:#f2b705}
```

---

## Paddock Pit Lane

App Settings › Connections › **Paddock** (`renderer/pitlane.js` says what the page says, `renderer/pitlaneview.js` draws it and does what its buttons do; styles
under `.pl-`). Dealership Mode and Shared Library are one tab. The Dealership Sheet of before (paddockui.js) is folded under *Older connections and repair*.
The Dealership password can be remembered (encrypted by Windows, `paddock-keep.js`), and Timing reconnects by itself every minute while it is offline.

- **The headline** (`.pl-hero`): *Paddock · results and cars* in Roboto Mono caps; a 40 px Barlow italic headline that says how things stand (*2 results need
  you*, *The Dealership is offline*, *All results are in Paddock*, *Paddock is not connected*); one line under it; two pills (*This computer · on*,
  *Dealership · connected / offline / not set up*) with a glowing dot. A green glow in the corner when all is well, amber when something needs you. On the
  right one action: **Fix it** (red, with a wrench) and the steps it will take under it; *Browse Paddock cars* when all is well.
- **Three equal cards** (`.pl-card`, a 3 px top edge in its state colour): *Shared library* (on this computer), *Dealership* (on the network) and *Results*
  (after each race). Each: an icon tile, the kicker and a Barlow title, the state in Roboto Mono in its colour, two big figures, one line, its buttons.
- **Results** (`.pl-panel`): a row per race, newest first: the date in Roboto Mono, the race and the reason in plain words, a state pill (*Delivered* green,
  *Waiting* amber, *Needs a look* red, *Stays here* grey) and its buttons (*Open the race*, *Try again* / *Send now*, *Leave out*). A row that needs a look is
  tinted red with a red left edge; a waiting row has an amber edge. Chips *All / Open / Delivered*.
- **Connect to a Dealership**: the Dealerships found on the network as cards (`.pl-host`: name, address in Roboto Mono, *yours* in green, the chosen one with
  the accent edge), *Type an address instead…*; the password, *Remember it on this computer*, *Connect to CLUB-PC*, and the check step by step (`.pl-steps`:
  ✓ green, ! red, … amber).
- **Older connections and repair** (`.pl-older`): a dashed fold at the bottom.

```css
html .pl-hero{padding:22px 24px;border-radius:18px;background:radial-gradient(130% 140% at 0% 0%,color-mix(in srgb,#3ecf8e 11%,var(--panel)),var(--panel) 62%)}
html .pl-hero h1{font:800 italic 40px/1 'SF Barlow Condensed','Bahnschrift',sans-serif;text-transform:uppercase}
html .pl-pill{border-radius:999px;font:600 12px 'SF Roboto Mono',Consolas,monospace;background:color-mix(in srgb,var(--c) 14%,transparent);color:var(--c)}
html .pl-card{border-radius:14px;box-shadow:inset 0 3px 0 var(--c)}
html .pl-tr.att{background:color-mix(in srgb,#e5484d 6%,var(--panel));box-shadow:inset 3px 0 0 #e5484d}
html .pl-host.on{border-color:var(--accent);box-shadow:0 0 0 3px color-mix(in srgb,var(--accent) 22%,transparent)}
```

---

## Widget Workshop

The Widget Builder (`renderer/widgetworkshop.js` makes the list, the Add to a layout window and the Simple / Canvas switch; `renderer/widgetlinks.js` works out
the links between a widget and its copies; the editors stay in `widgetbuilder.js` and `widgetstudio.js`; styles under `.wk-`). A layout still keeps its own copy of
a widget, but the copy now has `src` (the id of the saved widget), so the builder knows where a widget is used. Copies from before are found by their content.

- **The list** (`.wk-grid`): a card per widget. On top a dark race screen (`.wk-stage`, a radial gradient from #1d2330 to #0b0e14) with the kind in Roboto Mono
  caps (*Per driver · text*) and the widget's sample with a lane-colour edge; under it the name in Barlow and *Used in N layouts · names* (or *Not in a layout
  yet*); then *Edit*, *Add to a layout…* (red when the widget is in no layout yet) and ⋯ (Duplicate, Delete). Filter chips *All / Per driver / Once on screen*
  (`.gx-chip`) beside *＋ New widget*, and a dashed *New widget* card with *Simple* and *Canvas*.
- **Add to a layout** (`.wk-win`): the layouts as small dark pictures of their widgets (`.wk-mini`; this widget's copies in the accent colour), the name, and
  *has it* / *add it here*; the chosen one has the accent edge. The button says where it goes (*Add to QA layout*).
- **Saving** a widget that layouts use asks *Update the layouts*: *Update N layouts* or *Keep their copies*. The status says *Saved · 2 layouts updated.*
- **Simple / Canvas** (`.wk-mode`): a pill switch beside Save, the chosen side filled with the ink colour; *Add to a layout…* beside it once the widget is saved.
- **The preview** of a simple widget: eight lane buttons (`.wk-lanes`, square, with a 3 px underline in the lane colour, tinted when chosen) and *▶ Play a race*
  (`.wk-bar`): the sample race moves on a lap a second.
- **Picture rules**: *+ and…* under a rule adds a condition (`.wb-and`, dashed and indented, *AND* in Roboto Mono caps).
- **Fuel Strip** (`.fstrip`): the Fuel widget as a dark pill: *FUEL* in small spaced caps, a thin bar from #3ecf8e to the fuel colour, and the value in Roboto
  Mono. A Fuel Bar style of the Fuel Level widget, and its own pick (*Fuel Strip*) in the Layout Editor under Slotcar.

```css
html .wk-stage{height:150px;background:radial-gradient(120% 90% at 50% 0%,#1d2330,#0b0e14);color:#f3f5f8}
html .wk-sample{border-radius:8px;background:rgba(255,255,255,.06);box-shadow:inset 3px 0 0 var(--lane)}
html .wk-mode button.on{background:var(--ink);color:var(--panel);font-weight:600}
html .wk-lanes button{width:28px;height:28px;border-radius:7px;box-shadow:inset 0 -3px 0 var(--c)}
html .wk-mini i.me{background:var(--accent)}
.fstrip{border-radius:clamp(4px,14cqmin,12px);background:rgba(10,12,16,.85)}
.fsfill{background:linear-gradient(90deg,#3ecf8e,var(--fc))}
```

---

## Race Control

The race window while a race is on (`renderer/racecontrol.js`, wired in `race.js`: rcInit, rcDraw, rcMonitor; styles under `.rc-`). The Lane Desk
under it is unchanged. A Time Token Session keeps its tool bar.

- **The bar** (`.rc-bar`, sticky under the main menu): a 6 px **stripe in the colour of the flag** across the page (grey ready, amber lights, green,
  yellow, red, blue paused) and a soft tint of it behind the state. From left to right:
  - the race (name, length, track) as a small line, the **state** as a kicker in the flag colour and a title in Barlow (*Ready · Grid is set*,
    *Green flag · Racing*, *Yellow flag · Track call · lane 1*, *Red flag · Race stopped*, *Paused · Clock stopped*), one line of what is happening or
    what to do, and the status line of the race (`#msg`) under it;
  - the **clock** in 40 px Roboto Mono with laps to go;
  - the **controls**, whatever the layout has: one primary (Start, Resume, Start next), Pause, **Yellow** and **Red** outlined in their colour and filled
    while that flag is out, Stop as red text; each says its key (Space, Y, R, S); what the state cannot do is dimmed;
  - the timing status pill, an amber *Simulated* pill when simulated cars are on, and **Tools** (a menu with the tool bar of before: Simulated cars,
    Full screen widgets, Review laps, Announce summary, Back to Home).
- **A track call** (`.rc-call`): a card with a 6 px yellow edge, the lane number in its lane colour, *Track call · lane 1 · Anna* in Barlow, when it was
  called and on which lap, then **Resume racing** (primary), Penalty point (with a penalty system), Give a lap, Take a lap, Red flag, and a field for
  what happened (it goes in the log). Settling the last call takes in the yellow that the call raised; a yellow the Race Director raised stays.
- **The order** (`.rc-order`): the race as a timing tower: the place in gold, silver, bronze, the lane stripe, name and car, chips (*Call* yellow, *Pit*
  orange, *DQ* / *Out* red), laps, last and best lap in Roboto Mono (the fastest of all in purple), the gap as a red chip.
- **The race screen** (`.rc-mon`): the layout as a monitor, marked *On screen* in red, with **Hide · S · M · L** (remembered, `raceMonitor`) and full
  screen. It leaves the layout's own buttons out, as the second screen does (`Widgets.withoutControls`). S: the order two thirds; M: 5 to 4; L: the
  monitor full width above the order; Hide: the head only.
- **The default layout** has eight lanes: a header row with the names of the columns (*Pos, Driver, Lap, Lap time, Last lap, Best lap, Gap*), then a row
  per lane (a lane colour and seven cells without a title of their own).

```css
html .rc-bar{position:sticky;top:61px;z-index:30;margin:-20px -20px 14px;border-bottom:1px solid var(--line)}
html .rc-bar .rc-flag{height:6px;background:var(--rc)}
html .rc-bar .rc-in{display:grid;grid-template-columns:minmax(280px,1fr) auto auto auto;background:linear-gradient(90deg,color-mix(in srgb,var(--rc) 13%,var(--panel)),var(--panel) 45%)}
html .rc-bar .rc-ctl .btn.rc-yellow.on{background:#f5c518;color:#1d1600}
html .rc-call{border-left:6px solid #f5c518;background:color-mix(in srgb,#f5c518 9%,var(--panel))}
html .rc-row{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px}
html .rc-tr{display:grid;grid-template-columns:34px 5px minmax(0,1fr) auto 50px 64px 64px 84px}
```

---

## Chequered Flag

The screens after a race (`renderer/raceover.js`, wired in `race.js`: roStart, roBreak, roOver; styles under `.ro-`). The race page is hidden while one is
shown. Built on the [Broadcast Hero](#broadcast-hero), the [Timing Tower](#timing-tower), [Title Fight](#title-fight) and the [Race Report](#race-report).

- **The band** (`.ro-hero`): a chequered strip on top, the kicker (what, where, when; a championship and its round in pink first), the headline in big
  Barlow that says what happened (*Anna wins*, *Anna wins & leads* with the second part grey, *Heat 2 next up*, *Iris T. wins the event*), one line of
  what the winner did, the **highlights as chips** (fastest lap purple, a new or first track record gold, the championship pink, lead changes, laps),
  the **helmet of the winner's lane** (`avatars/LaneN.png`, or the driver's own avatar) with a gold *1*, and the **actions as one bar** along the bottom
  (one primary: Back to Home, or Go to round N in a championship; Race again, Print the race report, Open in Results, Announce the result).
- **Race over**: the classification as a timing tower (place tile in gold, silver, bronze; the lane stripe and helmet; laps, time, the gap as a red chip,
  the best lap, purple for the fastest of all) and the **race story**: the place of every driver on every lap in lane colours, the moments under it
  (lead changes, who led the last laps, the record).
- **A championship race**: *This race* and *Title fight* side by side, **as big as each other**. The title fight has the rounds as a pink strip, the first
  three as podium cards (points, move, gap, this race's points as a green chip), the standings with a pink bar under every total (drivers without points
  are one line), and *The points of this race are in the standings* with Undo and Do not count this race. Under both, the **next round** as a band with an edge
  in pink: its name and track in Barlow, the date, its sessions as pills.
- **The break between two heats**: the next heat as the headline with one big *Start heat 2* (Space too), its **line-up as lane tiles** (the lane colour on
  top, the number, points so far, the helmet, name and car; a final before its lanes are chosen: grey helmets and the lane picks under the band), the
  heats as a strip, the **standings with a column per heat** (the best score of every heat lit gold, this heat's points, the move) and the heat that was
  just driven as a result board (the winner as a gold lower third). *Show the race screen* and *End the event…* (red text) in the bar.
- **Event over**: the band for the winner of the event, the heats as a strip, the final standings, the result of the final.
- **Delete all data** in the review goes back to Home, which says *The race was deleted* for half a minute.
- **On the second screen** (`.ro-tv`, `RaceOver.tvHtml`, drawn by `liveview.js` drawAfter): the same screens for the audience, without buttons (the bar,
  Undo, the lane picks and the next-round band are hidden), made for 1920 × 1080 and zoomed to fit the window whole, never scrolling: the headline at
  132 px, names at 24 px, times at 21 px. A **line along the bottom** (`.ro-tvfoot`) says what comes next: the next round of a championship in pink, the
  heats in a break, otherwise *Thank you for racing* and the club name. In a break the time left shows as *Starts in 1:45*. On the title fight the table
  starts at 4th place (the first three are the podium cards). Customization › Race Results › *After the race* chooses the broadcast or the Results Wall.

```css
html .ro-hero{margin:-20px -20px 0;border-bottom:1px solid var(--line);background:radial-gradient(55% 140% at 0% 100%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 70%),linear-gradient(110deg,color-mix(in srgb,var(--accent) 10%,var(--panel)) 0%,var(--bg) 62%)}
html .ro-chq{height:10px;background:repeating-conic-gradient(color-mix(in srgb,var(--ink) 85%,transparent) 0 25%,transparent 0 50%) 0 0/10px 10px;opacity:.35}
html .ro-host .ro-big{font:italic 700 clamp(52px,6vw,92px)/.88 'SF Barlow Condensed';text-transform:uppercase}
html .ro-row{display:grid;grid-template-columns:40px 5px 40px minmax(0,1fr) 50px 90px 84px 72px;border-radius:10px;background:color-mix(in srgb,var(--ink) 4%,var(--panel))}
html .ro-main.eq{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
html .ro-lt{border-top:4px solid var(--c);background:linear-gradient(180deg,color-mix(in srgb,var(--c) 16%,var(--panel)),var(--panel))}
html .ro-st td.h.top{background:color-mix(in srgb,#d4a400 16%,var(--panel))}
```

---

## Race Report PDF

The race on paper (`renderer/racereport.js`, put together by `Report.sessionHtml` in `renderer/report.js`; the fonts and the wordmark are put in by
`pdfAssets` in `main.js`). A4 portrait, 10–11 mm margins, 8.6 pt body: dense, as a club sheet is. The page is white either way, and colour is only in
thin lines and pale tints. Looked at what clubs post on the forums (SlotForum, SlotRacer, SlotBlog, HomeRacingWorld, the BSCRA sheets): the order and
total laps, the margins, the best lap and **its lane**, the fastest lap of the night, the laps per lane, the heats, and the stories (offs, a newcomer
improving, the strongest finish).

**Page one**
- **The head**: a 3 pt accent rule, *Race report · Race* as a kicker, the race name in Barlow Condensed bold italic 25 pt, the meta line; on the right
  the SlotForge wordmark and a date tile (the day in Barlow, the month small). A **checkered strip** under it.
- **The podium**: three cards (second, winner, third; the winner wider), a 3 pt top and a place tile in gold, silver and bronze, the name in Barlow,
  the car, the laps in mono and the gap (or the best lap of the winner).
- **Results**: a Race Sheet (the heads small capitals over a 1 pt rule, zebra rows, the place in Barlow in its podium colour, **the lane colour as a
  bar on the left** of every row).
- **Race notes**: tiles with an icon and a 2.4 pt accent edge: fastest lap (who, the time in purple, the lap and lane), winning margin, closest fight
  (not the winner's), most consistent, fastest lane (the lowest median), strongest finish, offs, out of the race.
- **Laps per lane**: a row per driver, a column per lane (a lane disc in its colour): the laps and the best on that lane, the fastest on every lane in
  purple, *Lane best* under it. Beside the notes with up to four lanes, under them with more.
- **The race lap by lap**: the place of every driver after every lap (P1 on top), a line per driver in its lane colour, the names in finishing order in
  a column on the right; who led, and how many laps.
- Then the heats (cards in two columns), the driver swaps and the tyre stints.

**A page for every driver** (one page, never more: a page is 275 mm high and what does not fit is cut)
- **The head**: the place in a 44 pt tile (gold, silver, bronze or plain), *Driver report · 2 of 6*, the name in Barlow 23 pt, the car, the team, the
  lane disc; the race on the right.
- **Six tiles**: laps, best lap (purple; the lap and lane), average, median, spread, the gap behind the winner (or *Winner*).
- **Every lap**: the chart of Scrutineering on paper: every lap left to right, faster higher, the median dashed, the best lap a purple dot, an off a
  pale red column with an ×, a pit stop a triangle, **the lane of every lap as a strip** along the bottom with its number.
- **Per lane** (the disc, laps, best, average), **Through the race** (start, middle and end: the average and best, and ▲ how much faster the end was),
  **Lap spread** (a histogram of the clean laps, the fastest bar purple).
- **Place lap by lap** and **Gap to the leader** (two small charts), for a race without heats.
- **The heats** of the driver (place, laps, lane), and a **note line** with the best three laps, the offs, the pit stops, the penalties and who was
  ahead and behind.
- **The lap sheet**: every lap in narrow columns (4 to 12, as many as the laps need), the best purple on a tint, an off struck, a pit lap in italics;
  past 240 laps the ten fastest and the ten slowest.
- Every lap time (the table at the end) is a choice in Export to PDF, off to begin with.

**Colour or Monochrome** (Export to PDF › *Print in*, remembered): Monochrome sets every colour to black and greys: a lane is an outlined number, the
best lap is bold and underlined, the podium tiles are outlined (the winner's thicker), the lines of the race lap by lap are told apart by their
dashes, an off is hatched, the lane strip alternates dark and light grey.

```css
body { font: 8.6pt/1.35 "Segoe UI", Arial, sans-serif; --a: #e5484d; --best: #7c3aed; --gold: #d4a400; --silver: #9aa4b2; --bronze: #c9824f; }
h1 { font: italic 700 25pt/1 "SF Barlow", "Barlow Condensed", sans-serif; text-transform: uppercase; }
.rp-check { height: 5pt; background: repeating-conic-gradient(#15181d 0 25%, #fff 0 50%) 0 0 / 5pt 5pt; }
.rp-class td:first-child { box-shadow: inset 2.4pt 0 0 var(--c, transparent); }
.rp-dpage { break-before: page; height: 275mm; overflow: hidden; }
```

**The other prints** use the same page (`RaceReport.printDoc`: the style sheet, Colour or Monochrome, portrait or landscape): the head (accent rule,
kicker, the title in Barlow, the date tile, the wordmark) and the checkered strip, a footer line.
- **Heat list** (landscape): a Race Sheet with a column per lane, the lane disc before *LANE 1* (a ring in Monochrome), the heat in Barlow with an accent
  edge, zebra rows, the result of a raced heat, or a dotted line to write the winner on.
- **Championship standings** (landscape): the first three as podium cards (Leader, Second, Third, the points), the table with the place in its podium
  colour, the leader's row tinted, the points in mono, a dropped result struck, a fastest lap bonus in the championship colour (underlined in Monochrome).
- **Racing rules**: the club's own page, so no wordmark and no credit: the club's formatting with headings in Barlow (h2 with an accent edge), red list
  markers, a quote as a tinted note.
- **QR code of Live Race**: the code in a card with a dark double edge, the address in mono, three numbered steps (open the camera, point it at the code,
  follow the race live).
- **App Settings › General › Units › PDF prints**: Colour or Monochrome for every print (the same choice as *Print in* of Export to PDF).

## Update Window

The update check of every SlotForge app, copied as it is from Circuit (`update-check.cjs`, `renderer/update-ui.js`, `renderer/update-window.css`; how it
works and what it may never do: `docs/update-check-handoff.md`). Once at the start, a newer version opens a [Workshop Window](#workshop-window):
*UPDATE AVAILABLE* as a trail, **Timing 2.4.0** in Barlow, a lead with an accent line (*You have version 2.3.0*), *What's new* (at most six lines from
the release notes), a sheet of *Your copy*, *Released* and *Download* (the file of this copy and its size), then **Skip this version** and **Download**
on the right. Downloading shows a bar in the accent colour and Cancel; when it is done, a green line *Saved in Downloads* with how to install this
copy, Close and **Show in folder**. Nothing is run or installed. **App Settings › General › Updates and help › Updates**: a Settings Sheet with this
version, the newest version as a pill (green: the latest; amber: a new one), last checked, Check when Timing starts (packaged copies), Check now, and
a button for the window when there is a new version; its messages in a line under it.

Timing adds only the basics Circuit's window sits on that it names differently (the dialog heading and actions rows, the quiet ✕ button, the
focus and success colours, the numbers font, the pills good and needs), in `styles.css` under "Update window".

## Parc Fermé

Choosing a car (`renderer/paddockbrowser.js`, **Browse cars** on Home). A [Workshop Window](#workshop-window) with a **sticky head** (eyebrow
Parc fermé, the title, a round close button), then **one [Control Strip](#control-strip)**: the car source as a [Gear Selector](#gear-selector)
(Slotcar library / Dealership cars), the search with a magnifier, Connection settings and Refresh. The cars are small
[Garage Cards](#garage-card): the picture across the top on a soft spotlight (a car outline when there is none), the name in Barlow, the maker and
class, a chip for its state (Not yet linked, Available offline…), and **Select car** at the foot (red on hover). The Dealership connection inside
is a [Folder](#folder) whose fields are Settings Sheet rows: a status pill, then a row per field, the buttons in a foot row. A car **without a picture**
takes one of ten clearly different colours from its model (`--h`; the same model of another maker gets the same colour), so a page of them is not
all grey. The Dealership's own message (offline…) shows only on the Dealership tab, and as a quiet grey note while it is only offline.

```css
html dialog.paddock-dialog>header{position:sticky;top:0;z-index:5;padding:16px 22px 14px 24px;border-bottom:1px solid var(--line)}
html .paddock-browser .pb-toolbar{display:flex;gap:8px;padding:7px;border:1px solid var(--line);border-radius:11px;background:color-mix(in srgb,var(--bg) 40%,var(--panel))}
html .paddock-browser .pb-cars{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
html .paddock-browser .pb-car{display:flex;flex-direction:column;padding:0;border-radius:12px;overflow:hidden}
html .paddock-browser .pb-car>img,html .paddock-browser .pb-car>.pb-car-placeholder{width:100%;height:118px;object-fit:contain;border-bottom:1px solid var(--line)}
```

## Choice Rows

In a [Settings Sheet](#settings-sheet), a row that holds **only a radio button** is one big button: the whole row picks it, the chosen row is tinted
with a filled accent ring. When a choice has few short options (the DS unit: DS-030 … DS-0045) the rows stand **side by side as tiles** (six in a
row, three on a narrower window). In the Double Rail, **signs as icons** (⌁ ◉ ⇄ ≋ …, used by the hardware pages) are drawn as the line picture that
means the same, and the **Parallel Port** page joins the Double Rail like the other interfaces: its sections are in the side list, its own list and
title card step aside, its section titles are the same Barlow headings, and its *By lane / Pin map* switch is a Gear Selector.

```css
html .ss-sheet>.ss-row:has(>.ss-ctl>input[type=radio]:only-child){position:relative;cursor:pointer}
html .ss-sheet>.ss-row:has(>.ss-ctl>input[type=radio]:only-child)>.ss-ctl>input{position:absolute;inset:0;opacity:0}
html .ss-sheet>.ss-row:has(>.ss-ctl>input[type=radio]:checked){background:color-mix(in srgb,var(--accent) 9%,transparent)}
html .ss-sheet:has(input[name=dstype]){display:grid;grid-template-columns:repeat(6,minmax(0,1fr))}
```

## Light themes

The dark **tracks** behind groups and switches (Pit Wall groups and lights, the Gear Selectors of Parc Fermé and the Parallel Port, the phase pills)
and the **unlit lights** of Start Lights and Lane Check are tokens that follow the theme. In Light, Ocean and a light Custom theme the track is a
thin ink tint and an unlit light is a soft grey, not a black dot.

```css
:root{--sf-track:rgba(0,0,0,.22);--sf-lightoff:#1b1f25;--sf-lightoff-ring:color-mix(in srgb,var(--panel) 70%,#000)}
:root:is([data-theme="light"],[data-theme="ocean"],[data-tone="light"]){--sf-track:color-mix(in srgb,var(--ink) 7%,transparent);--sf-lightoff:#d5d9df;--sf-lightoff-ring:color-mix(in srgb,var(--ink) 8%,var(--panel))}
```

## Finishing Touches

```css
/* file pickers as secondary buttons */
:where(#view,dialog) input[type=file]{font-size:13px;color:var(--muted)}
:where(#view,dialog) input[type=file]::file-selector-button{margin-right:10px;min-height:30px;padding:0 12px;border:1px solid transparent;border-radius:7px;background:color-mix(in srgb,var(--ink) 9%,var(--panel));color:var(--ink);font:400 13px "Segoe UI",system-ui,sans-serif;cursor:pointer}
:where(#view,dialog) input[type=file]::file-selector-button:hover{background:color-mix(in srgb,var(--ink) 14%,var(--panel))}
/* thin scroll bars in the theme */
*::-webkit-scrollbar{width:11px;height:11px}
*::-webkit-scrollbar-track,*::-webkit-scrollbar-corner{background:transparent}
*::-webkit-scrollbar-thumb{border:3px solid transparent;border-radius:8px;background:color-mix(in srgb,var(--ink) 22%,transparent) padding-box}
*::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,var(--ink) 34%,transparent)}
```

Numbers: round lengths to at most 2 decimals (`28.45 m`), and keep a number with its short unit on one line (`5 s`, `10 L`).

---

## How to adopt

For a Claude session restyling another SlotForge app:

1. **Tokens first.** Map the app's colour variables to [Graphite](#graphite). If it has its own names, alias them
   (`--panel:var(--card)`), don't rewrite every rule.
2. **Fonts.** Copy the three font folders and the `@font-face` rules, then add the [Type Trio](#type-trio) title rule.
   Exclude anything users write or design themselves (rich text, layouts, widgets).
3. **Buttons.** Paste [Pit Buttons](#pit-buttons). Find the app's buttons (`<button`, `.btn`, `.button`) and give each a kind:
   the one main action per screen is `primary`, occasional tools are `ghost`, delete and remove are `danger`, square glyph buttons are `icon`
   (with `aria-label`). Remove old raised or gradient button styles that would fight it.
4. **Windows and folders.** Paste [Workshop Window](#workshop-window) and [Folder](#folder). Check every dialog: title as the first
   `h3`, buttons in the last `.row` (main button first in the markup), no coloured top bars.
5. **Pages.** A page with more than ~4 sections gets a [Paddock Rail](#paddock-rail). Lists of things get a
   [Control Strip](#control-strip) and [Garage Cards](#garage-card) (with pictures) or [Entry Cards](#entry-card) (without).
   Put a [Page Note](#page-note) under titles where people need to know what the page is for.
6. **Specificity.** Load this CSS after the app's own, or scope it (`#view`, `html …`) to win. Prefer `:where()` for base rules.
7. **Check by eye** at 1600 px and at 900 px wide, in a dark and a light theme, and check that the app's tests still pass:
   tests that look for old class names or old texts need updating, not the new look reverting.

---

## Change log

Add a line here for every style change, so the other apps can follow.

| Date | Style | Change |
|---|---|---|
| 2026-11 | Broadcast Hero | New Home: header picture across the page, start bar rising into it, logo over the picture as an option |
| 2026-11 | Paddock Rail | Race Setup, Customization, Database and App Settings get side lists |
| 2026-11 | Type Trio | Barlow Condensed for all titles app-wide |
| 2026-11 | Pit Buttons | One flat button family with five kinds |
| 2026-11 | Control Strip | Database toolbar with search icon and icon pager |
| 2026-11 | Workshop Window, Folder | Dialog baseline (Add Track); Import from Circuit and Circuit design rebuilt to it |
| 2026-11 | Toggle Chips | View settings as switches |
| 2026-11 | Garage Card | Database cards: picture edge to edge, detail rows, bin in the foot |
| 2026-11 | Entry Card | System, rotation and championship cards share the race setup card; soft kind colours |
| 2026-11 | Tech Sheet | Race system windows: neutral header, Barlow name, calm side list, two columns, indented switch settings, no red titles |
| 2026-11 | Page Note | The explaining text under every Race Setup title as a box with lead, more and where-to-use |
| 2026-11 | Paddock Rail | "Choose systems…" became the dashed "Hide unused systems…" item at the end of the list |
| 2026-11 | Entry Card, Tech Sheet | Virtual Rival, Multi-Class and Resource Systems moved to cards and the Tech Sheet sizes |
| 2026-11 | Paddock Rail | The shell fills the window exactly (no small scroll); the side list runs to the bottom; the logo sits in the page corner |
| 2026-11 | Page Note | Every Customization page gets one; the old intro paragraphs moved into it |
| 2026-11 | Showroom Card | Leaderboard Editor (three sample drivers), Chart Editor (mini chart) and Widget Builder as cards with a real preview |
| 2026-11 | Entry Card | Audio sets as Entry Cards (voice, calls on, used by) |
| 2026-11 | Replay Monitor | New: Race Results settings in folders with a live, scaled preview of the Results Wall (2–8 sample drivers) |
| 2026-11 | Paddock Rail | Plugin Pages & Tools: the pages and tools in a side list; without any, one calm box with a button to App Settings › Plugins |
| 2026-11 | Pit Board | New: Layout, Leaderboard, Chart, canvas Widget, picture and audio set editors share one two-layer bar; page settings in one panel; widget search |
| 2026-11 | Widget Bench | New: simple text or picture widgets with kind cards, variables by subject, and the widget on a sample race screen |
| 2026-11 | Picture Bench | New: picture sets as drop-on tiles with a live preview and a fuel slider |
| 2026-11 | Tech Sheet | Audio sets: subjects in the side list, every call as a row with a switch, a call opens under its row, one search with filter chips |
| 2026-11 | Folder | The canvas Widget Builder's tinted folders became the calm Folders; its blocks are icon tiles that wrap |
| 2026-11 | Double Rail | New: App Settings › General as two side lists and a canvas, with Choice Tiles, switch rows, stat tiles and a name preview |
| 2026-11 | Double Rail | Every page of App Settings: the page's tabs and sections in the second rail, one section at a time; Help's topic list as the second rail |
| 2026-11 | Timing Tower, Rulebook | Personal Bests as a timing tower; Racing Rules as a document page with a grouped toolbar |
| 2026-11 | Settings Sheet | New: every page of App Settings as groups of slim two-half rows with one 30px control kit (switch, segmented choice, stepper, list, text, file, path, pill); no sliders, pictures framed by dragging, arrow keys and Position steppers |
| 2026-11 | Settings Sheet | The switch keeps its 34×20 pill shape when off; theme tiles stay tiles |
| 2026-11 | Help Reader | New: Help articles retypeset (one column, plain-words lead, calmer body, chips) |
| 2026-11 | System Sheet | New: every editor with a rail as one page of sheets; the rail jumps and follows the scroll; Tyre Wear regrouped into six sections |
| 2026-11 | Page Note | Also in the System Sheet editors and on the sections of App Settings |
| 2026-11 | System Sheet | Darker sheets and boxes; the page editors open as a window; Fuel, Penalty, Damage, Weather and Push & Save regrouped and reworded |
| 2026-11 | System Sheet | Balance of Power and Time Tokens: a card on the page, the editor as a window; padding for words inside a sheet |
| 2026-11 | System Sheet | Safety Car in four sections; More for long explanations; form labels; Resource tyre sets as rows; tables with the 30px kit |
| 2026-11 | Grid Slot | New: the lanes of Start a race on Home fill their card at every width, with the driver as a full-height portrait |
| 2026-11 | Grid Slot | Start a race stacks sooner (2 lanes below 1400px, 3 below 1650px, 4 below 1950px) |
| 2026-11 | Grid Slot | Up to 8 lanes in balanced rows (4, 3 or 2 a row by the width); a last row that is not full fills the width |
| 2026-11 | Grid Slot | The hairlines are only between lanes (no line beside Start a race) |
| 2026-11 | Home cards | Record to beat: the title on the red label is large Barlow (26 to 44px, growing with the label) |
| 2026-11 | Home Cards | New: all cards redesigned; Lane balance, Grid form, Head to head, Championship, Heat standings, Countdown and Milestones added |
| 2026-11 | Pit Wall | New: the main menu as one bar that never wraps, with status lights, Find (Ctrl K), ON AIR and a race strip |
| 2026-11 | Start Lights | New: the setup guide with step lights, lane-coloured names, hardware choice tiles and a test-race ticket |
| 2026-11 | Lane Check | New: the sensor test as lane columns in their colours with sensor lights, in Home's balanced rows |
| 2026-11 | Flag Dialog | New: a badge for the kind of window, text aligned with the title, Cancel then the answer, a filled red dangerous answer; the update notice with a download badge |
| 2026-11 | Live Desk | New: the Live Race landing with an ON AIR panel and the pages in two groups as row tiles; a compact list on phones |
| 2026-11 | Parc Fermé | New: the car picker with a sticky head, one toolbar with search, picture cards and the Dealership form as rows |
| 2026-11 | Choice Rows | New: radio rows as whole-row buttons, the DS unit as tiles, line pictures in place of signs, the Parallel Port page in the Double Rail |
| 2026-11 | Pit Wall | The bar measures itself and steps down when it does not fit (the Race tab); the lap in the strip follows the setup's race by laps or by time |
| 2026-11 | Light themes | Tracks and unlit lights are theme tokens (`--sf-track`, `--sf-lightoff`): soft in Light, Ocean and light Custom themes |
| 2026-11 | Pit Wall | Two more fitting steps for a big Interface size on a small window (tighter, then pictures only) |
| 2026-11 | Parc Fermé | Cars without a picture in one of ten colours by model; the Dealership message only on its own tab, quiet while offline |
| 2026-11 | Lane Desk | New: the race screen under the widgets as one desk: a card per lane (Lap / Pit / Call, tyres, fuel, pace, weather, the Race Director's pads), a race column (Race Director, weather, tyre rule, systems, log), the tables as tabs, the keys as key caps |
| 2026-11 | Lane Desk | The Control Strip starts with the race and its clock, the status as a pill, Simulated cars as a switch; the same desk on the Race Director page of Live Race (phones keep the one-lane view) |
| 2026-11 | Race Sheet | New: the tables of a race in small capitals and mono, the notes as a grey line, the tyre correction as one compact box |
| 2026-11 | Scrutineering | New: Finalize race results with a gold stripe for the winner, slim lap rows with small buttons, quiet Adjust pads |
| 2026-11 | Pit Wall | The shared library's light shows the results waiting to be sent in amber with their number ("1 to send"), never as a red "Library" |
| 2026-11 | Scrutineering | Reimagined: the classification as slim rows with a lap chart each, and a lap explorer (chart of every lap, figures, filters, suspect laps, several laps at once, back in the records); one colour per kind of lap |
| 2026-11 | Scrutineering | The Race Director page of Live Race has the desk after the race and the lap explorer during it; on a phone the laps are two-line cards |
| 2026-11 | Scrutineering | The race window's Review laps during the race has the same drivers and lap explorer as the Race Director page |
| 2026-11 | Cue Card | New: a call of an audio set as one card (Plays when, What it says with every line, ▶ and ⋯, race values as chips, Only when…, one more line); Voice & playback quieter |
| 2026-11 | System Sheet | A field with a control of its own (the system switches of a race setup) is a wide row: the name and note above, the control across the row; the switches are Toggle Chips |
| 2026-11 | Race Report | New: a saved race as a row with a date tile and the winner, opened as a report (actions, podium, classification, notes, heats) with the lap times as a table |
| 2026-11 | Heat Board | New: Next up with Start between heats, the heat list as heat cards, the overall result as a Race Sheet, the lanes of a final as tiles in the lane colours |
| 2026-11 | Title Fight | New: the championship standings with the season as a band, the first three as podium cards, the best score of every round lit, a bar for the points, the rounds as cards |
| 2026-11 | Record Card | New: the card of a slotcar, a driver or a track; the statistics as tiles, a service meter, the progress of a driver as track cards with trend chips and the months folded away |
| 2026-11 | Token Desk | New: the time tokens as a card for every lane (lane colour, a large clock, the buttons as a grid, the state as the edge), a line of what the lanes are doing, the folder first; the penalties folder as a Race Sheet |
| 2026-11 | Live Pages | New: the Live Race pages that follow the race; a sticky Page Bar with the phase as a pill, Customize as a button, the classic leaderboard as a Race Sheet in the lane colours, Driver stats as pills, a head card and tiles, the rules as a page, an empty page as a card |
| 2026-11 | Plugin Desk, Dealership Sheet, Review Sheet, Performance Gauges | New: the smaller pages. A plugin page with a head, a status pill and boxes; Dealership Mode with a status pill and no squeezed rows; Historical Review as a sheet with tags, pills and Submit in the foot; the Performance line as gauges |
| 2026-11 | Race Report PDF | New: the race PDF in the look of SlotForge: page one with the podium, race notes, laps per lane and the race lap by lap; a page for every driver with the lap chart, per lane, through the race, the spread and the lap sheet; Colour or Monochrome |
| 2026-11 | Race Report PDF | The heat list, the championship standings, the racing rules and the QR code in the same look; PDF prints: Colour or Monochrome in App Settings |
| 2026-11 | Start Lights, Workshop Window, Race Report, Lane Desk | The last screens: the startup window with start lights, the Circuit file as a drop card, the record tables fit, an empty Results and Records as a card, the race folders with the Lane Desk off |
| 2026-11 | Update Window | New: the update check of every SlotForge app (from Circuit): the window with What's new, Skip and Download, Settings › Updates; the notice on Home is gone |
| 2026-11 | Chequered Flag | New: the screens after a race (Race over, a championship race with the title fight as big as the race, the break between heats, Event over) replace the frozen race page; the points of a championship race are awarded on Finalize, with Undo |
| 2026-11 | Chequered Flag | The screens after a race on the second screen: without buttons, one 16:9 screen zoomed to the window, a line along the bottom; Race Results › After the race chooses it or the Results Wall |
| 2026-11 | Race Control | New: the bar on top of the race window (state, flag stripe, clock, the controls whatever the layout has, Tools), a track call with Resume racing, Give or Take a lap and a note, the order as a timing tower, the race screen as a monitor (Hide, S, M, L); the default layout has eight lanes and a header row |
| 2026-11 | Status Lights | New: the lights of the main menu are one button (Timing, Next race, Sharing) with the check before the start in a drop-down; the strip of chips on Home is in it |
| 2026-11 | Setup Sheet | The race setup form: the race in one line with chips, Set and Missing instead of dots, six kinds, the tracks as cards, quick picks, Start and flags with Track Call together, the heat scoring in Heats, a system and On at the start on one row |
| 2026-11 | Garage | New: the Database lists as Garage cards (drawn cars, helmets, tracks, figures from the races), a Control Strip with filters, sort and ⋯, a list with ticks and a bar for many at once, empty cards |
| 2026-11 | Build Sheet | New: the car editor with the drawn car, a rail, the gearing worked out, livery colours, Can it race?, a service meter and log, More for Archive, Reload and Save history |
| 2026-11 | Record Book | New: Racing Records as a record book (record cards, filter bar, race log by month, driver panel, record history, driver history, Correct the result, CSV) |
| 2026-11 | Timing Desk | New: Timing Hardware as a desk (big card, live lanes, interface cards, Connect & use, parts as tabs, Diagnostics, Find the lane order, Forgotten devices); the dropdown, the banner, Other and the oXigen page are gone |
| 2026-11 | Commentary Booth | New: the audio set editor opens on the voice (On air, Plays on, Hear it) and the presets as cards; Driver names; Play a sample race; the editor keeps its place |
| 2026-11 | Widget Workshop | New: the Widget Builder list as cards on a race screen with Used in and Add to a layout; saving updates the layouts that use it; Simple / Canvas switch; eight lanes and Play a race; "and" conditions; the Fuel Strip |
| 2026-11 | Paddock Pit Lane | New: Dealership Mode and Shared Library as one Paddock page: a headline with Fix it, three equal cards, the results in plain words, Dealerships found as cards, the connection check step by step, the password remembered; the Dealership Sheet folded under Older connections and repair |
| 2026-11 | Engineer's Bench | New: Calculations as Try it beside Your rules with one save bar and Undo; each topic as a question; laps of a real race as bars with a slider; compare with another system; the formulas with your numbers; find a calculation; the formula sheet |
| 2026-11 | Lane Check (rework) | The sensor test asks for the lanes one at a time and offers to swap a lane that lit another's sensor; pit lane, Track call and track power as checks; Connect in the window |
| 2026-11 | Start Lights (rework) | The setup guide connects inside the guide, picks cars from the shared library, has Lanes & sensors (the Lane Check) and a Commentary step, and a Back to the guide pill |
| 2026-11 | Plugged In | New: the detected hardware cards on Home say why they ask, keep a failed connect on the card, take the DS model, and can undo Not timing hardware |
| 2026-11 | Profile Cards | New: Balance of Power and Time Tokens as named profiles a race setup chooses; the Club default keeps the settings of before |
| 2026-11 | Entry Classes | New: the Multi-Class class of an entry picked in its lane on Home, class counts, copy to the system; a virtual rival added in a lane with its reason there |
| 2026-11 | Rotation Board | New: rotation lanes from a track, participants from an entry list or picked drivers, Lane fairness with the words and Even out, a lane warning on the card |
