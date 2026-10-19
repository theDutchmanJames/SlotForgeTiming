# UI reference images

Design mock-ups made together with Dutch, kept as a reference for later UI work. They are **pictures of a design**, not of the built app: when a feature is built the real screens can differ, and the real app is the truth. Use them for the look (spacing, folders, colours, wording) when a screen is made or improved.

Every set has the PNG pictures (1x) and a `source/` folder with the editable boards (`*.dc.html`, plus `canvas.json` with the layout of the canvas). The boards were made on a Claude Design canvas; the live canvas is private, so the PNGs and the sources here are the copy that stays with the code.

Palette used in the mock-ups (dark theme): background `#171b21`, panel `#222831`, panel header `#2b323d`, border `#343b47`, text `#e8e6e1`, muted `#98a0ab`, red button `#c8363c`, green `#3ecf8e`, amber `#ffb84d`, red `#e5484d`, purple folder `#2d2440` / `#4a3a6b` / `#c79bff`.

## tyre-wear/ (19 Oct 2026, design of the Tyre Wear feature, NOT built yet)

| Picture | What it shows |
|---|---|
| `1-tyre-wear-system-tyres.png` | Race Setup tab, sub-tab **Tyre Wear Systems** (between Damage Systems and Weather Systems): per-tyre numbers, grip curve, lap or distance counting, weather multipliers |
| `2-tyre-wear-system-rules.png` | The same record: where the system is chosen (race setup, folder Rule sets), where it applies, what worn tyres do, pit stops, sets per car or team, warning levels, Distance Racing |
| `3-race-screen-tyre-change-folder.png` | Race screen / Race Director page: the Tyre Change folder with the queue for the next stop |
| `4-widget-tyre-degradation.png` | Tyre Degradation widget: a tyre whose tread wears away, own picture with a life ring, bars (horizontal and vertical), number only, widget settings |
| `5-widget-available-tyres-and-cells.png` | Available Tyres widget (numbers, dots, list, number only, team pool) and the Tyre life cell in the Driver stats grid and the Leaderboard |
| `6-results-tyre-stints.png` | Results page: tyre stints per driver (also in the PDF); no tyre information in the Slotcar statistics |
| `7-audio-calls.png` | Audio set editor: group "Tyre wear" with six calls and the wear levels |

The decisions behind these pictures are in the roadmap (Project doc `claude/roadmap-and-decisions.md`, entry "Tyre Wear").

## race-setup-tabs/ (19 Oct 2026, design of the Race Setup sub-tab strip; option A built in 1.45.0, option B kept for later)

| Picture | What it shows |
|---|---|
| `1-option-a-top-strip.png` | **Option A (built):** a big solid **Race Setups** button, and the other eight sub-tabs as coloured buttons in three groups: Systems, Setups, Extras. The open one gets a stronger tint and a bar, and the panel below gets a top edge in its colour |
| `2-option-a-states.png` | Option A: Race Setups open, the light theme, and a narrow window (the groups wrap, the big button goes full width) |
| `3-option-b-side-rail.png` | **Option B (not built, for when more systems arrive):** the same buttons as a list on the left (236 px wide) instead of a strip on top; it costs width instead of height and takes any number of systems |

Colours (each sub-tab has the colour of its folder on the race screen): Penalty Systems yellow `#f2b705`, Damage Systems red `#e5484d`, Tyre Wear Systems purple `#9b4dff`, Weather Systems blue `#4c9aff`, Balance of Power white `#e8e6e1`, Time Tokens teal `#1fb5ad`; Rotation Setups brown `#c4803f` and Fuel Setups green `#2fb86a` (they have no folder, Dutch approved these two). The big button is the theme's accent colour (`#c8363c` in the dark theme). On the light themes the colours are a little darker: `#8a5124`, `#1e8a4c`, `#9a7400`, `#d62828`, `#7c3aed`, `#0f6fd6`, `#5b6470`, `#0e8a84`.

## depth/ (19 Oct 2026, the depth of the app: option A, Soft lift, built in 1.46.0; option B, Thick card, is the 75 level)

Dutch asked for a very slight feeling of depth on the race screen: a thick card, a shallow button. The design was made on a Claude Design canvas (*Race Screen Depth*: today flat, A Soft lift, B Thick card, and the parts, button states and themes). He chose **A** and asked for it in the whole app, with a setting to turn it down or off. For this set the pictures are **screenshots of the built app** (1.46.0, the real stylesheet in headless Chromium), not renders of the boards: the boards in `source/` need the Claude Design runtime to draw. The built app is the truth.

| Picture | What it shows |
|---|---|
| `1-race-screen-flat.png` | The race screen with Depth **Flat (no depth)**: the plain look of before 1.46.0 |
| `2-race-screen-soft-lift.png` | **Soft lift (standard)**, depth 35: a light edge on top, a thin lip underneath and a soft shadow |
| `3-race-screen-thick-card.png` | **Thick card**, depth 75 (design B): the same, stronger. **Medium** is 55 |
| `4-race-screen-light-soft-lift.png` | Soft lift in the light theme (the lip and the shadow are lighter there; the Ocean theme and a Custom theme with a light panel do the same) |
| `5-widget-border-colour-and-thickness.png` | Widgets with a border of their own: a colour (any) and a thickness; a see-through widget (60%) stays flat |
| `6-home-soft-lift.png` | Home with Soft lift: cards and buttons stand up a little, fields are a little sunk |
| `7-settings-depth.png` | App Settings > General > Display: the **Depth** choice |

How it is made (renderer/styles.css, the layer at the end, and renderer/depth.js): box-shadows only, no extra elements and no change of colour, so it works on any theme colour and on a widget colour of your own. The page has `--depth` (0 to 1; Flat 0, Soft lift .35, Medium .55, Thick card .75), and a widget fades it with its own solidity (`--wf`), so a transparent widget stays flat. A button that is pressed moves down. The light themes take the light values through `data-theme` (light, ocean) or `data-tone="light"` (a Custom theme with a light panel).

## championship/ (19 Oct 2026, design of the Championship feature; release 1 built in 1.55.0, release 2 NOT built yet)

No PNG pictures yet, only the editable boards in `championship/source/` (open the `*.dc.html` files on a Claude Design canvas; `canvas.json` has the layout).

| Board | What it shows | Built |
|---|---|---|
| `Main.dc.html` | Race Setup, sub-tab **Championships**: the list of championships | 1.55.0 |
| `Rounds.dc.html` | A championship: name, rounds and their sessions (race setup, kind, share), the roster | 1.55.0 |
| `Home.dc.html` | Home: the card with the next session of the championship, loading it, the "Counts for" line, the standings on the right | the card and the loading in 1.55.0; the standings and "Maria leads by 5" are release 2 |
| `Points.dc.html` | Points table and presets, bonuses, dropped results, team points, tie rule, and the roster with the guest rule | the roster in 1.55.0 (the guest rule is stored, not applied yet); the rest is release 2 (not built) |
| `After.dc.html` | The race screen after a race: **Award these points / Do not count this race / Undo** | release 2 (not built) |
| `Standings.dc.html` | The pool **Championships** in Results and Records: drivers and teams, round by round | release 2 (not built) |

The decisions behind these boards are in the roadmap (Project doc `claude/roadmap-and-decisions.md`, entry "Championship").
