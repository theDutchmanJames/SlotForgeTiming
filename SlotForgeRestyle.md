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
| [Garage Card](#garage-card) | A picture card: picture edge to edge, title, detail rows, button foot | Database grid (tracks, cars, drivers…) |
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
| [Timing Tower](#timing-tower) | A ranked list: position, colour stripe, time, gap chip | Personal Bests card |
| [Rulebook](#rulebook) | A document page: header, sheet with a grouped toolbar | Racing Rules |
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
Tokens are the page itself and stay on the page.

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
