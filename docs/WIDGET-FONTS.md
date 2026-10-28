# Widget fonts — 27 October 2026

Widget font choices are available under Layout Editor → Title & text → Fonts. Layout-wide choices are under the toolbar's Widget appearance → Fonts. Leaderboard Editor cells also offer font controls. Title, primary value and supporting text have independent families and weights; resetting an override restores inheritance. Existing layouts do not acquire new font styles automatically.

## Included choices

- Inter, including Black (900), exposed as High Visibility.
- Barlow Condensed, Regular (400), Bold (700) and Black (900).
- Roboto Mono, variable weights 100–700.
- Original/theme lettering and installed font families.

Normal and italic binaries are bundled for all three families. The unmodified font files and OFL licenses are in `renderer/fonts/`. `sources.json` records download sources and SHA-256 hashes. No runtime connection to a font service is needed. The existing `renderer/**` packaging rule includes these assets.

High Visibility fonts selects Inter Black for titles and primary values, with Inter Bold supporting text. This shortcut changes fonts only: manual/automatic sizing, minimum size, spacing and contrast remain independent controls. Explicit font weights override the old Bold switch; the editor disables that switch and explains where to change the weight.

## Rendering and persistence

`WidgetFonts` sanitizes stored references and resolves `layout.widgetFonts` with `widget.fonts`. The same roles reach ordinary widgets, All-in-One cards, Builder content and leaderboard cells. Title-only changes do not override value lettering. Digital clock segments and artwork keep their existing design. Primary numbers use tabular digits where supported.

Font loading triggers another fitting pass after fonts and layout settle. The live canvas defers resize fitting until the next animation frame to avoid ResizeObserver delivery loops. This is presentation work only; timing, sensors, race calculations and scoring are unchanged.

Local Font Access enumerates installed families only after the user requests it. Permission failures, unsupported browsers and non-responsive enumeration leave bundled choices available. Only the family name and requested weight are saved, not local font files. Missing local fonts use bundled Inter while retaining the original selection; the settings display availability on the current device. Native font matching chooses the nearest installed weight. Layout transfers and live-view snapshots already carry these plain settings.

## Verification

- Full `npm test`: all 156 commands passed.
- New font unit tests cover sanitization, inheritance, available weights, reset, persistence, appearance-copy isolation, safe HTML and all ten font-file hashes/licenses.
- Real Electron controls: saved/reopened fonts; layout defaults and individual overrides; title/value separation; All-in-One and Builder roles; leaderboard headers/values; native enumeration (333 families on this PC); an available Windows font and a deliberately missing family; denied enumeration; unchanged Digital segments.
- Actual shared-view data rendered at 1540, 800 and 600 px in dark and light themes. Screenshots were inspected. The cramped 600 px All-in-One card uses its existing “Enlarge widget” message instead of shrinking every label.
- Separate Electron window independently loaded Inter Black. Local web-server checks verify font binaries and CSS are available to remote displays.
- Targeted live-view, frame, row, settings and widget-polish tests cover the later fitting and role refinements.

Run the isolated desktop checks with `electron tools/qa/widget-fonts-electron.cjs`. They use a temporary database and write screenshots and a check log to the workspace's `outputs/widget-fonts/` folder. No physical timing hardware was used.
