# Widget Builder composer

The composed-widget editor is under **Customization > Widget Builder > New composed widget**. The original text/image editor remains available for existing widgets.

Content blocks include values, combined text, images, state icons, bars, rings, gauges, standard display widgets, rows, columns, grids, dividers and spacers. Start from a Driver Card, Timing Bar, Pit & Strategy, Race Overview, blank template or standard display component. Choose lane or race scope. Controls and nested leaderboards are deliberately excluded.

The value catalogue has searchable coloured folders. Values have explicit numeric/text/boolean types; numeric comparisons do not parse rendered units. Missing readings remain missing. Rules use first-match priority, all/any conditions, and can hide blocks, replace text/icons or change emphasis. Unsupported scope, invalid numeric rules and meter ranges are rejected on save.

The preview uses an isolated in-memory engine and the production timing/component renderer. Its race, pit, warning, red-flag and finished scenarios cannot affect hardware or actual races. Missing-data and long-name scenarios, editable example values, play/pause, theme selection and dimensions support visual checks. Example-value overrides affect value blocks and their rules; standard components use the isolated sample race.

Saved content is copied into layouts, not linked. Editing a library item does not silently alter existing layouts. A placed copy still uses the shared background, gradient, accent, border, typography and depth controls. Source widget IDs are not required at runtime. Embedded chart/picture-set/team dependencies are included and remapped by export/import.

Implementation entry points:

- `renderer/widgetcompose.js`: bounded declarative model, catalogue, conditions, content renderer and sample templates.
- `renderer/widgetstudio.js`: editor, isolated preview and validation.
- `renderer/timing.js`: typed read-only engine values and composition dispatch.
- `renderer/widgetbuilder.js`: library, legacy editor and conversion to placed copies.

Limits: 80 blocks, six nested layout levels, 12 rules per block, eight conditions per rule. These guard runtime rendering; no arbitrary JavaScript or CSS is evaluated. Layouts use automatic rows/columns/grids rather than free absolute positioning inside a widget.

The editor explains when the rule/condition limit is reached instead of accepting and discarding an extra entry. Imported leaf-root compositions are wrapped in a column when edited, so blocks can still be added. Malformed imported containers and rules are normalized before rendering.

Embedded standard widgets expose their applicable options, including picture sets, team choice, size sliders, picture uploads and picture position/zoom. Their own warning background and contrast text stay together. The surrounding composed widget still owns its shared appearance. Picture-set and chart previews resolve saved references; missing saved selections are labelled explicitly.

Long text wraps within its block. Crowding feedback appears below the Builder preview and never covers the content or reuses the lane-accent layer. Leaderboard cell styling remains owned by the row design; adding a composition does not change the outer leaderboard padding.

Verification: `npm run test:widget-composer` and `npm run test:widget-composer:electron`. The Electron test uses a temporary application profile and covers persistence, undo/redo, responsive themes, layout placement and the live canvas with shared appearance.

See [the October 27 review](WIDGET-COMPOSER-REVIEW.md) for repaired findings and verification limits.
