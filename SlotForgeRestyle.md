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
| [Page Note](#page-note) | The box under a page title that explains the page | Every Race Setup page |
| [Control Strip](#control-strip) | One tight toolbar: Add, tools, search, List / Grid, pager | Database lists, system lists |
| [Gear Selector](#gear-selector) | A quiet segmented control | List / Grid, filters, choices in forms, inner tabs |
| [Garage Card](#garage-card) | A picture card: picture edge to edge, title, detail rows, button foot | Database grid (tracks, cars, drivers…) |
| [Entry Card](#entry-card) | An icon card: tile, eyebrow, name, facts, "Used by", button foot | Race setups, race systems, rotations, championships |
| [Workshop Window](#workshop-window) | The baseline window (dialog) | Add Track and every Database form, Circuit design |
| [Folder](#folder) | A collapsible section with a Barlow title and a chevron | Groups in forms, settings, results |
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
| **Customization** | Paddock Rail + cards in the Garage Card pattern (sketch instead of picture) |
| **App Settings** | Paddock Rail (with a search under the title) + Folder |
| **Racing Rules** | Rulebook |
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
the arrow line says *where* it is used. Keep all three short. In Timing the texts live in one table,
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
| 2026-11 | Timing Tower, Rulebook | Personal Bests as a timing tower; Racing Rules as a document page with a grouped toolbar |
