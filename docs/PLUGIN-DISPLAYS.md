# Display and tool API 1

Stage 3 adds separately installed **widgets, pages and tools** to the existing trusted Node plugin runtime. They do not change race rules or sensor timing. Race-system and scoring contributions use the separate [Rule API](PLUGIN-RULES.md).

## Using a plugin

1. Install its `.slotforge-plugin` in **App Settings → Plugins**. Review and explicitly start it. No example plugin is installed automatically.
2. In **Customization → Layout Editor → Plugins**, add **Plugin lane widget** or **Plugin race widget**. Choose the contributed widget in **Content**, then set its inputs. Existing typography, appearance, border, accent, layout and scaling controls apply.
3. Open **Customization → Plugin Pages & Tools** for contributed pages and tools. Pages refresh automatically after you apply inputs. Tools run only when you press **Run tool**; they are locked during races/results review and while the same plugin owns a timing connection.

The Layout Editor uses a clearly separate sample race. Pages use the open race, or label their sample data when no race is open. Missing or disabled plugins leave explanatory placeholders. Their selection and inputs remain in saved layouts, including imported layouts. Exporting a layout or Content Pack does **not** include executable code: share/install the plugin package separately.

## Manifest and worker exports

The optional `display` field is part of the package fingerprint. Old packages without it retain their existing normalized manifest and digest. It requires explicit trust again on update through the existing manager.

```js
display: {
  api: 1,
  widgets: [{
    id: 'pace', label: 'Lane pace', scope: 'lane', // or 'race'
    settings: [{id:'target', label:'Target lap (seconds)',
      type:'number', min:1, max:120, default:10}]
  }],
  pages: [{id:'overview', label:'Race overview'}],
  tools: [{id:'estimate', label:'Duration calculator', settings:[] }]
}
```

Each category supports up to 12 contributions. Each contribution supports up to 12 settings: `text`, `number`, `boolean`, `select`. Numbers require finite `min`, `max` and `default`; selects require `choices` and `default`. IDs are stable lowercase letters/digits/underscores/hyphens, starting with a letter. Labels and descriptions are plain text. Renaming an ID makes existing references unavailable; retain IDs between versions.

Export the declared functions from the plugin's `.cjs` entry:

```js
exports.widgets = {
  pace(context, { snapshot, lane, settings }) {
    const values = snapshot.lanes.find(x => x.lane === lane)?.values;
    return {
      kind: 'row', children: [
        {kind:'metric', label:'Last lap', text:values?.last?.toFixed(3) ?? '—'},
        {kind:'metric', label:'Target', text:settings.target.toFixed(3), tone:'green'}
      ]
    };
  }
};
exports.pages = { overview: (context, input) => ({kind:'text', text:input.snapshot.track}) };
exports.tools = { estimate: async (context, {settings}) => {
  // Explicit tool action: use existing context.storage, or your own Node code.
  return {kind:'metric', label:'Estimate', text:'10 minutes'};
}};
```

Widget/page functions must be fast, read-only and safe to repeat. They may return promises. Tools may perform plugin-owned operations; their input has `snapshot:null`, avoiding accidental reliance on stale race data. Existing plugin-level settings and storage remain on `context`. Per-widget inputs are separate from plugin-level settings and are stored with that widget. Inputs removed from a newer widget schema are ignored at runtime but retained in the layout for rollback; incompatible values in existing fields show an error until corrected. Page/tool form inputs are temporary unless the plugin explicitly stores them.

## Read-only snapshot

`snapshot` contains:

- `api`, `session`, `preview`, `phase`, `elapsedMs`, `track`.
- `race`: the scalar values available to the built-in Widget Builder.
- `lanes`: up to eight objects with zero-based `lane`, scalar `values`, the last 100 `lapTimesMs`, their absolute zero-based `lapStartIndex`, and up to 100 `invalidLapIndices` within that sample (absolute indices). For sample element `i`, its original lap index is `lapStartIndex + i`. Do not infer the origin from `values.laps`, which can include scoring adjustments. Older API 1 senders may omit `lapStartIndex`; in that case the origin is unknown.

Builder timing values such as `last`, `best`, `median`, `avg` and `total` use **seconds**. `elapsedMs` and `lapTimesMs` use **milliseconds**. `null` means unavailable; do not replace it with zero. Lane values include driver/car identity text, position, laps, fuel/tyre information, pit/service, penalty and pace values when available. Use the public catalog in `renderer/widgetcompose.js` as the list of Builder value keys. Raw device handles, database access, personal file paths and engine functions are not passed through this API. Snapshot size is limited to 64 KB.

Snapshots are informational, not a lossless event stream. Do not use this API to count laps, implement penalties or control hardware. Virtual rivals retain the same unavailable-system values as ordinary built-in displays.

## Display blocks

Supported blocks:

| Kind | Fields / meaning |
| --- | --- |
| `text` | `text`, optional `label`: explanatory text |
| `metric` | `text`, optional `label`: prominent value |
| `bar` | `value`, `min` (default 0), `max` (default 100), optional `label` |
| `line` | `points` (2–120 finite numbers), optional `label`; min/max are shown |
| `row`, `column` | `children` (1–16 blocks) |

All blocks accept optional `tone`: `normal`, `muted`, `green`, `amber`, `red`, `blue`, `purple`, `lane`. `normal` inherits the user's widget text styling. Lane tone uses the assigned layout lane colour when available. Charts are display-only, with no interactive pointer actions.

Views are limited to 64 blocks, nesting depth 6, text 500 characters, and 16 KB after validation. Only known fields are accepted; SlotForge escapes text and renders markup itself. There is no raw HTML, CSS, URL, script, iframe or arbitrary DOM API in this version. This is a deliberate scope choice for the first display API: richer scripted renderer pages would need a separate sandboxed-view protocol. Plugin Node code remains executable and unrestricted at OS level; declarative rendering does not turn the worker into a security sandbox.

## Performance, failures and viewers

- Main renderer requests display data at most twice a second. If previews and a live race are both active they alternate, at most once a second each. No animation loop or race tick waits for a plugin.
- Maximum 32 distinct views per context per batch, 128 KB combined returned data. Repeated widgets with the same source/lane/inputs share one request. Avoid layouts with more than 32 distinct plugin views.
- Unused editor/page demands expire after 1.2 seconds. Active second-display layout demand is maintained while the race is shared, even if the main race screen is parked. No plugin rendering is requested when no display has demand.
- Requests time out after two seconds. A timed-out display channel stays unavailable until the plugin restarts, preventing accumulating unresolved work. Ordinary async display failure does not stop an otherwise responsive timing worker. A blocked JavaScript event loop still triggers existing process supervision and timing loss handling: keep heavy work off that event loop.
- Display and timing operations have separate pending requests. General tools remain blocked while that plugin owns timing. A timeout cannot undo a tool's already performed filesystem/network actions.
- Main and second Electron screens use the same renderer. Browser viewers receive validated view data through the existing LiveShare connection; they have no plugin execution or tool API. Page/tool results are not broadcast as widget data.
- Plugins remain independent of SlotForge releases and database backups. Keep their original package files. No marketplace or automatic code download is introduced.

## Example and tests

`tools/fixtures/display-plugin.cjs` exports `make()`, which creates a **Race Companion** package with a lane pace card, field overview, custom page and duration tool. It is a fixture for developers, not an installed app feature. The Electron QA script writes an installable example to `outputs/plugin-display/race-companion.slotforge-plugin` in the parent workspace.

- `node tests/plugindisplayclient.test.js`: request deduplication, batch limits, hidden-demand expiry, page-output privacy and race isolation.
- `node tests/plugindisplay.test.js`: schemas, escaping, limits, snapshot data, real workers, placeholders, timing/display concurrency and timeout containment.
- `electron tools/qa/plugin-display-electron.cjs`: real editor controls and persistence, all eight built-in themes at 1440/600 px, race integration, second screen, HTTP viewer, IPC isolation and missing-plugin handling.
- `electron tools/qa/plugins-asar.cjs`: worker, timing helper and display renderer loaded from a packaged archive.
