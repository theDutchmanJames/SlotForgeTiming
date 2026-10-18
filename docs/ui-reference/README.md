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
