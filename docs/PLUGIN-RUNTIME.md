# Code plugins — runtime API 1

Stage 1 provides separately installed, **trusted Node.js background code**. It includes a manager, generated settings, command buttons, session logs, local storage, compatibility checks, manual updates and rollback. Timing API 1 now adds hardware registration and generated setup pages. Display and bounded rule APIs are now available: see [the plan](PLUGIN-PLAN.md).

No third-party plugins ship with SlotForge. Installing one does not change the app source or require rebuilding. `.slotforge-pack` files remain data-only collections under Import and Export; they are never executed by this loader.

## For users

1. Open **App Settings → Plugins → Install or update** and choose a `.slotforge-plugin` file.
2. Review its author, version, description and fingerprint. These are not proof of a verified author or a security review.
3. Install the package. It remains **disabled**, including after updates and rollback.
4. Open Installed plugins, adjust its settings, then choose **Start trusted plugin**. Confirm only if you trust the code: it can access files and the network with your operating-system privileges.
5. Started plugins start automatically on normal future launches. **Stop and disable** turns that off. Refresh status to see current logs. Stop a plugin before changing its settings.

Background code runs in an Electron utility process. This helps recover from crashes and unresponsive code; **it is not an OS security sandbox**. A malicious or resource-intensive plugin can still damage data or affect performance. There is no arbitrary bridge to Electron's main process, the race database, sensors or track-power controllers. Authors must use supported APIs; direct access to internal app files is unsupported.

Changes and manager commands are blocked during a race and results review. Already-running background plugins keep running, while timing and rule contributions use their dedicated APIs. Rule programs are frozen before racing and are not changed by later worker state.

## Recovery and data

- A startup timeout (10 seconds), missing heartbeat (4 seconds), command timeout (5 seconds), process exit or excessive messages disables the plugin. There is no automatic crash restart loop.
- Stop allows one second for `deactivate`, then requests termination. If termination is not confirmed, further activation is blocked; restart with plugins off.
- **Restart with plugins off** relaunches SlotForge with `--disable-plugins`. The flag prevents automatic and manual activation for that session; installation and removal remain available. Close the app and launch normally to leave this mode.
- From source, open a terminal in the folder containing `package.json` and use `npm.cmd start -- --disable-plugins`. For an installed Windows app, add ` --disable-plugins` after the closing quote of the executable path in a shortcut's Target field.
- If the previous session ended without clean plugin shutdown, automatic startup is skipped. Review and explicitly start trusted plugins again.
- Update keeps one prior version/settings snapshot; rollback swaps these snapshots and disables the plugin. **Plugin-written data is not rolled back.** Plugin authors must make data migrations backwards-compatible or provide their own recovery.
- Remove retains plugin data so reinstallation can reuse it. App database backups do not contain the plugin library or its data. Keep original packages and back up the `plugins` directory with SlotForge closed.
- Storage is under SlotForge's user-data directory: `plugins/library.json`, `plugins/packages/<id>/<version-fingerprint>/` and `plugins/data/<id>/`. An unreadable library fails closed; no plugins run. A `.bak` library is retained by the atomic writer for manual recovery while the app is closed. Do not edit library entries to bypass compatibility or trust checks.
- Session logs retain the last 40 entries of at most 2,000 characters. Status is read on refresh; there is no continuous UI polling.

## Package format

A `.slotforge-plugin` is a UTF-8 JSON document, not a ZIP archive:

```json
{
  "format": "slotforge-code-plugin",
  "apiVersion": 1,
  "manifest": {
    "id": "example.counter",
    "name": "Counter",
    "version": "1.0.0",
    "author": "Your name",
    "description": "A small example background plugin.",
    "license": "MIT",
    "minAppVersion": "1.99.2",
    "runtime": "node",
    "commands": [{"id": "count", "label": "Count one visit"}],
    "settings": [{"id": "step", "label": "Count increase", "type": "number", "min": 1, "max": 10, "default": 1}]
  },
  "entry": "main.cjs",
  "files": {"main.cjs": "BASE64_OF_YOUR_JAVASCRIPT_FILE"}
}
```

Encode each file's bytes as standard base64. Bundled CommonJS JavaScript dependencies can be supplied as additional files; there is no automatic dependency installation or `npm install` step. Native binaries/modules are not supported in API 1. Package assets are not automatically rendered as UI.

Limits: 32 MB JSON, 20 MB total decoded files, 256 files, 32 installed plugins, 16 commands and 24 settings per plugin. Paths are relative, ASCII, case-insensitively unique, at most 200 characters and eight components deep. Traversal, links, Windows device names, file/directory collisions and unexpected file types are rejected. Supported extensions: `.cjs`, `.js`, `.json`, `.txt`, `.md`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.css`, `.html`. The entry must be a packaged `.cjs` file. Installed files are checked against their fingerprint before every activation.

Manifest optional fields: `maxAppVersion`, `platforms` (`win32`, `linux`, `darwin`), `architectures` (`x64`, `arm64`, `ia32`). Defaults are all three platforms and x64/arm64. Versions have three numeric components. This describes loader compatibility, not a claim that every plugin is tested on those systems.

Settings use `text`, `number`, `boolean` or `select`. Every field has `id`, `label`, `type`, `default`; numbers also require finite `min` and `max`; selects require a `choices` array of strings. IDs must be stable lowercase identifiers. Unknown fields and invalid values are rejected, not silently clamped. Updates start with the new manifest's defaults; rollback restores the previous settings snapshot.

## Plugin module

```js
exports.activate = context => context.status('Ready');

exports.commands = {
  count(context) {
    const next = (context.storage.get('count') || 0) + context.settings.step;
    context.storage.set('count', next);
    context.log('Count: ' + next);
    return 'Visits: ' + next;
  }
};

exports.deactivate = async context => {
  // Close your timers, devices and connections promptly.
};
```

`activate(context)` and `deactivate(context)` are optional and may return promises. Export a function for every declared command. Commands receive the same context; they do not accept arbitrary UI arguments in API 1. Return text or JSON-serializable data for the result banner. Only one command per plugin runs at a time. Throwing from a command reports its error; unhandled exceptions stop the plugin.

The frozen context exposes `id`, `version`, a settings snapshot, `dataDir`, `log(text)`, `status(text)` and `storage.get(key)` / `storage.set(key, value)`. Storage keys are lowercase identifiers up to 40 characters; values are JSON of at most 64 KB each. Missing keys return `null`. Store files in `dataDir`, not the installed package: modifying package files prevents future activation. The storage helper is a convenience, not an access restriction on trusted Node.js code.

Keep background work asynchronous. The supervisor checks heartbeats and bounds incoming log/message traffic (120 messages or 64 KB per second for ordinary plugins; timing drivers allow 512 messages or 128 KB per second); it is not a CPU, memory or disk quota. Plugins that intentionally bypass supervision are outside this trust model.

## Timing drivers

An optional `manifest.timing` contribution registers a driver under Timing Hardware → Plugin Interface. See [Timing API 1](PLUGIN-TIMING.md) for sensor levels, timestamps, output leases and a separately installed simulator. General commands are unavailable while that plugin owns a timing connection. Plugin mutations are locked while a timing race is reserved, including its ready screen.

## Widgets, pages and tools

An optional `manifest.display` contributes data-rendered widgets, custom pages and explicit tools. Tools accept schema-defined inputs; the older general commands still take no arguments. Displays use read-only snapshots and never run third-party JavaScript in the main renderer or network browser. See [Display API 1](PLUGIN-DISPLAYS.md).

## Race rules

An optional `manifest.rules` contribution appears in Race Setup → Rules and Systems. Its `rules(context)` export prepares a bounded program before racing. Fuel/tyre modifiers, lap-time consequences and competition bonuses run through the existing engine, without per-crossing worker requests. Results and recovery retain the exact program and provenance. See [Rule API 1](PLUGIN-RULES.md) for the supported expressions, ordering and limits.

## Verification

`tests/pluginpackage.test.js`, `tests/pluginruntime.test.js` and `tests/pluginipc.test.js` cover validation, integrity, persistence, lifecycle, crash/hang recovery, ownership and race locks. `tools/qa/plugins-electron.cjs` exercises the real renderer, preload, IPC and Electron utility process with isolated test data. Run it once normally and once with `--disable-plugins`. `tools/qa/plugins-asar.cjs` checks an archived worker loading an external plugin, as used by packaged builds. Third-party plugins and physical hardware require their own verification.

Electron's [utility-process documentation](https://www.electronjs.org/docs/latest/api/utility-process) describes the process and message API used by the host.
