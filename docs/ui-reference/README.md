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
