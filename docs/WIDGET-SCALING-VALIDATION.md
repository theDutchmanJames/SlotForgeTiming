# Shared widget fitting and Virtual Rival entries

Implemented 28 October 2026.

## User behaviour

Home now presents recorded drivers in the same entry list as physical drivers. Use **Add driver** to select a Database driver designated Virtual. Its V entry has a **Rival Setup** selector instead of a slotcar selector. The driver's linked setup is the default; an override is saved for this race setup without changing the Database driver. Legacy ID-only selections still load. Track mismatches, missing recordings and duplicate virtual drivers fail validation. Virtual entries remain outside physical lane assignments and hardware routing.

Widget text uses `Frame.fit` for shared safe-area and fitting decisions in the editor and live canvases. Single values and lap grids fit both dimensions; primary values honour the minimum size and supporting text keeps an 11px floor. Manual sizing and shrink-to-fit remain available. Titles stay in a bounded top row. Explicit padding wins; otherwise the frame uses up to 10 screen pixels of safety space. Numeric values never wrap. Explicit description ellipsis remains available.

Compound widgets retain role hierarchy. Tyre and pace artwork gives room to text and respects the selected icon cap. Available Tyres keeps counts readable while resizing pictures. Builder values and embedded standard components share the fitting helpers; leaderboard cells retain their designed size with a shared overflow guard. Charts, weather, delta badges and decorative clocks retain specialised geometry.

Impossible layouts show **Enlarge widget or show fewer fields** instead of clipped figures. No laps or optional fields are silently removed. This is intentional at very small on-screen sizes, including a dense two-column, seven-row lap list in a narrow editor preview.

## Implementation notes

- `fitSize` uses bounded binary search rather than a 30-pixel decrement limit.
- DOM Range geometry catches centred overflow that `scrollWidth` misses.
- The title and lane badge have separate bounded space.
- Lap grids use uniform text sizing and a measured lap-number column.
- Whole-widget text transforms were removed. The live paint path calls the common fitter once after appearance has been applied.
- Single-value/list measurements are cached by available dimensions, text shape, typography and font-loading epoch. Known tabular fonts reuse a fit across digit changes; arbitrary installed fonts use the complete text.
- Performance reporting counts fitting in its fitting phase.
- Saved layout coordinates, appearance settings and font selections are preserved.

## Verification

- 166 regression commands passed across the complete test chain and affected reruns. Sandbox-blocked persistence/local-loopback tests were rerun with access. The long live-race suite completed with a 360-second allowance. A source-code assertion now accepts both LF and CRLF.
- `tests/widgetfit.test.js`: bounded sizing, impossible minima, legacy selections, per-race replay overrides, validation and physical sensor isolation.
- `npm run test:widget-scaling:electron`: 102 geometry assertions plus real Home selection, persistence, reopening and race start. Covers columns 1–3, multiple fonts, title bounds, individual resizing, large manual sizes, impossible grids, compound cards, gauge states, icon caps, Builder values and nested Last Laps. Captures actual Home and Layout Editor at 1200px and 600px.
- Widget Builder Electron suite: save/reopen, undo/redo, components, rules, actual second-screen rendering and 12 width/theme cases.
- Virtual Rival Electron suite: replay source, driver linking, race starts, heat restarts/recovery, second-screen results and physical-record isolation.
- Widget Settings Electron suite: 92 option panels, 30 live shared cases, 276 gradient/depth/accent cases, persistence and responsive settings.
- Race Clock Electron suite: 72 style/size/theme/flag cases, shared rendering and paused clock.

Screenshots and diagnostic results are in `../outputs/widget-scaling-implementation/` relative to the project workspace (one level above the app directory). No physical timing hardware was used.
