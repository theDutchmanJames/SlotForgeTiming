# Track Builder integration

SlotForge Timing accepts SlotForge Track Builder layout exports, including the
0.2.2 integration contract (`1.0.0-draft.2`), draft.1 and legacy v1 layouts.
The importer accepts JSON data only, up to 5 MiB, with at most 500 pieces and
500 embedded definitions. Existing charts keep the original coloured-lane appearance. Both appearances use
the imported route geometry when available; the oval is a fallback only.

## User workflow

1. Export `.slotforge.json` from Track Builder.
2. Open **Database → Tracks → Import from Track Builder**. A track's **Track
   design** button reopens these settings.
3. Choose a new track or explicitly select the existing destination. For an
   existing track, copying the name, lane count, nominal lengths and picture is
   opt-in. Updating a design never replaces the database track ID or records.
4. Map physical timing lanes to unique routes. Select the sensor's road piece,
   position within that piece, and direction. Verify the preview arrows and
   confirm the mapping. An unconfirmed/open design can be saved for its picture,
   but cannot drive the tracker. Disable nominal-length copying for open designs.
5. In **Customization → Chart Editor → Live Track**, choose
   **Original · Coloured Lanes** or **Track Builder Artwork**. Both follow the same
   imported routes, timing line, direction and movement profile. Appearance can
   also be overridden per widget in Layout Editor.
   The preview track selector is local to the editor. During racing, the selected
   Race Setup's track supplies the design. Place the saved chart in a Race Chart
   widget through Layout Editor as usual.

The transparent PNG is generated locally. Embedded PNG references are bounded
(4096 pixels per edge, 8 megapixels per image, 32 megapixels combined) and
decoded; invalid artwork becomes a reference placeholder. No external images
or supplied SVG/JavaScript execute. Reference pieces never supply timing routes.

## Storage and validation

`tracks[].trackDesign` contains:

| Field | Purpose |
| --- | --- |
| `version: 1` | Timing's saved configuration version |
| `document` | Normalized, self-contained Builder source and timing metadata |
| `laneRoutes` | Route ID for each physical timing lane, starting at lane 1 |
| `confirmedMappingRevision` | Confirmed topology hash, or null |

Prepared geometry and supplied lane lengths are never trusted: the vendored
runtime regenerates them from validated piece templates. Track Builder's design
identity remains separate from Timing's track identity. Replacing topology,
changing the lane count, sensor placement or direction requires confirmation.
A latched Builder remapping flag does not repeatedly invalidate a topology that
the user has already confirmed in Timing.

Reopening an unfinished mapping preserves its selected routes and blank lanes;
confirmation is a separate step. Saves capture the document and destination and
lock editing until the write finishes. A failed save restores the controls for
retry. Item transfer validates track designs before committing and rolls back
the whole import if validation fails.

Nominal lengths are converted from millimetres to metres and follow the selected
lane mapping. Opting into them writes the existing per-lane length fields and
sets `laneLengthSource: 'track-builder-nominal'`. This provenance does not alter
speed calculations. Measured lengths are otherwise untouched. Removing the
linked design retains the track, lengths, picture and race history.

Track export/import and database backups carry the configuration with the track.
Race snapshots retain their selected design; subsequent database edits apply to
the next race. Old tracks require no migration.

## Rendering and estimation

The drawing and speed tables are built once per saved configuration object and
cached. Motion updates reuse the existing shared widget paint loop, capped at
10 or 4 updates per second, or crossings only. Offscreen/hidden views skip work.
Only car marker transforms and status text change during motion.
Replacing or resizing a chart refreshes its marker positions even while paused
or using crossings-only movement. Changing reduced-motion preferences also
refreshes the display without advancing the race.

The Builder profile supplies acceleration, braking and corner speed. A bounded
cumulative travel-time table maps elapsed-lap fraction to distance; it is
normalized to the chart's chosen lap benchmark. Reverse travel uses a reversed
speed plan, including braking. The guide remains on its lane; body drift is
illustrative. Existing pit, pause, finish and Virtual Rival timing remain in use.
Overdue estimates wait before the line; rendering never creates a lap crossing.

If geometry, confirmation or a displayed driver's mapping is unavailable, the
chart falls back to the original oval with a reason. Second displays receive the track
once in the static race snapshot, not in each dynamic update.

This is an estimate between sensors, not physical position sensing. Only through
routes are supported. Digital lane switching, alternate pit routes, elevations
and bridge drawing order are not simulated.

## Verification

- `npm run test:track-design`: supplied fixtures, validation, mapping, measured
  data preservation, profile geometry, persistence, transfer and shared displays.
- `node tests/chartextras.test.js`: existing chart behaviour and event handling.
- `electron tools/qa/track-design-electron.cjs`: actual application import/save,
  PNG alpha, embedded references, all eight themes, narrow screens, chart preview,
  real engine motion/pause, paused resizing, unfinished mappings, delayed saves,
  failed-save recovery and both imported/legacy live widgets.
- `electron tools/qa/track-appearance-electron.cjs`: saved chart appearance,
  tuning-profile pace, per-widget overrides, transient preview selection and
  matching car positions in both appearances across all eight themes.
  Both Electron checks use isolated test databases and no physical hardware.
- `npm test`: complete application regression suite.

Vendored runtime provenance is in `renderer/trackbuilder/PROVENANCE.txt`.

## Appearance and tuning-profile pace

The Layout Editor's Live Track content controls offer a transient **Preview track**
selector. It previews only the matching number of sample lanes and never changes
a Race Setup or saves a track binding in a shared layout. Race-time artwork
comes from the track selected in that Race Setup, not the editor's example.
Other chart styles retain their full sample field when an imported circuit is
available; only Live Track previews use its lane count.

**Estimate lap progress using → Imported tuning profile** uses each mapped
route's integrated speed-plan duration. Acceleration, braking, corner speed and
straight speed therefore determine both motion within the lap and its estimated
duration. Other pace choices scale the profile to the measured/target lap time.
Virtual rivals retain replay durations. Missing or unconfirmed geometry cannot
provide a profile duration. Cars wait near the line when overdue, and only actual
sensor crossings create race laps. Pauses, pits and finish states still apply.
