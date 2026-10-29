# Executable plugins — revised plan

Status: 29 October 2026. **Stages 1–4 are implemented within their API 1 scope:** the executable runtime and manager, generated settings, commands, storage and recovery. See [runtime API 1](PLUGIN-RUNTIME.md). The [timing API and simulator](PLUGIN-TIMING.md) now connect separately installed drivers to the shared race adapter. [Display API 1](PLUGIN-DISPLAYS.md) adds widgets, app-rendered custom pages and explicit tools. [Rule API 1](PLUGIN-RULES.md) adds pre-race preparation of bounded deterministic programs for consumption, lap consequences and competition bonuses. Arbitrary live engine callbacks and full classification replacement are not part of this API. Content Packs live under Import and Export.

## Intended ownership and scope

Third-party plugins may contain executable code. Their authors distribute and maintain them independently; installing one does not merge that code into SlotForge's repository or standard build. SlotForge provides the loader, extension APIs and integration points. Plugin authors choose their features and behaviour. This separation is an engineering model, not a legal liability guarantee.

The earlier interpretation that all plugins must be inert data is superseded. Content Packs remain useful as versioned import/export collections; they are not the executable extension mechanism. Their existing files, metadata, library and editable-copy behaviour remain compatible.

## Two distinct workflows

| Workflow | Purpose | Status |
| --- | --- | --- |
| Import and Export: items / database backups | Share selected data or back up and restore the database | Existing |
| Import and Export: Content Packs | Store and share named collections with versions and compatibility checks; import editable copies | Implemented |
| Plugins | Independently installed code that adds capabilities | Runtime, timing, display/tool and bounded rule APIs implemented |

Code plugins need a distinct manifest/package format and executable review/activation flow. Never reinterpret an existing `.slotforge-pack` as code. Reuse compatible metadata concepts, not the content importer's execution path. A plugin may supply a separate content pack, with an explicit import action.

## Extension targets

1. **Timing interfaces:** device discovery, connection, protocol parsing, settings pages, diagnostics and normalized sensor events.
2. **Widgets and visual features:** new widget types, chart renderers and presentation presets registered with the editor and supported race displays.
3. **Pages and tools:** custom workflows, importers/exporters and external-service integrations.
4. **Race behaviour:** new systems, calculation strategies and scoring rules through defined hooks. Hooks determine what can be changed; this is not a promise that every internal function can be replaced.

Plugin code should use versioned APIs rather than patching global variables, replacing app files or accessing the database file directly. Behaviour changes can be powerful while still having a defined place in the event flow.

## Runtime and access model

- Store installed extensions outside the application directory, in versioned plugin-owned directories. Install, validate and stage updates before activation; keep the old version available for rollback. No install-time package-manager scripts or automatic remote code downloads.
- Start background code in a supervised process per plugin, with a bounded message protocol, startup/shutdown deadlines and logs. Never require third-party modules directly into `main.js` or the race renderer.
- Stage 1 uses Electron's utility-process API for the Node-capable host. It supplies child processes and message ports. **Process separation is not a security sandbox for arbitrary Node.js code.** A Node-capable plugin can have the user's OS access even when it only declares a small set of SlotForge API permissions. Do not present permission toggles as an OS security boundary. See [Electron utilityProcess](https://www.electronjs.org/docs/latest/api/utility-process).
- Distinguish restricted UI extensions from trusted Node/native extensions. The first runtime milestone must document and test its actual access model before executable installation is enabled. Native hardware libraries require explicit platform/architecture/runtime compatibility handling and trusted-code acknowledgement.
- Standard settings pages use schema-defined controls in SlotForge's own style. Display API 1 renders plugin-authored page blocks and typed inputs using SlotForge code; it does not accept arbitrary HTML or renderer scripts. A future rich scripted-page API would require a separate sandboxed view with Node integration disabled and a narrow, sender-validated bridge. Do not reuse the main app session's broad device permissions for plugin views. Follow [Electron security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
- Plugin-specific settings and storage are namespaced. Uninstalling stops workers and removes registered contributions, but offers retention of plugin-owned data. A plugin must not be able to impersonate another plugin through its message ID.
- Manifest fields should include stable identity, author, version, plugin API version, app compatibility, supported OS/architectures, entry point, contributed features and declared access. Identity strings are not publisher verification. Updates that change capabilities need renewed review.

## First complete integration: a timing interface

The current app has explicit hardware branches in `main.js` and `renderer/race.js`, plus separate hardware bindings and controllers. A settings page alone will not integrate a new interface. Timing contributions are discovered from installed plugin manifests. The plugin controller reuses the digital-level decoder and shared race adapter already used by Phidget and Parallel Port; existing hardware drivers keep their own connections. Moving all built-in drivers onto one registry is deliberately deferred.

Proposed flow:

```text
Device → plugin worker → hardware event adapter → existing race actions / pit processing
                                                       ↓
                                            timing engine and race systems
```

The adapter needs:

- Interface registration, settings validation, connection state and device ownership.
- Explicit lane mapping and capabilities: lap crossings, blocked/released pit sensors, track calls, power and lights. Reject unsupported commands rather than pretending success.
- Sequence numbers and a connection/race generation identifier to reject duplicates and stale events after reconnects or a new race.
- Defined monotonic timestamp units and clock conversion. Device time, plugin-worker time and host arrival time are not interchangeable. Preserve event capture time where possible; expose the accuracy limitations of arrival-time fallback.
- Tests for formation laps, debounce/minimum-lap rules, sensor holds, service stops, penalties, fuel/tyres, red flags, virtual lanes, race review, records and result persistence through the shared race path.
- Output ownership and expiring leases, adapting the existing Parallel Port/Phidget model. Test disconnects and worker crashes. A host shutdown command cannot guarantee power removal when the physical device is unreachable; devices need an appropriate failsafe where required.
- No automatic race restart or silent switch to a different timing source after failure. Surface the fault and use the established pause/recovery flow.

Acceptance example: a separately installed simulated timing-interface plugin with its own settings page, controlled lap/pit events, connection-loss simulation and output acknowledgements. This proves the runtime/API path without physical hardware. Actual hardware and driver compatibility remain separate validation work.

## Widgets, pages and race hooks

Widget registrations need stable IDs, settings schemas, sizing rules and bounded refresh schedules. Follow the shared widget appearance/scaling contract. Cache snapshots and suspend hidden views. Define how plugin widgets reach the second Electron window and browser viewers; code in a desktop worker does not automatically exist on a phone. Missing/disabled plugins should leave a readable placeholder and preserve layout settings.

Rule API 1 executes plugin preparation before racing, freezes the returned program and evaluates it inside the engine without live worker calls. One rule plugin per setup avoids conflicting writers; fuel/tyre modifiers follow native calculations, time consequences remain separate from raw timing, and competition bonuses follow native eligibility. Resume requires the original package fingerprint and uses the saved plan. More general race-affecting extensions would require ordered hooks, bounded deadlines, conflict handling and version/settings snapshots recorded with results. Preserve raw sensor timing; store plugin-derived adjustments separately. If a required rule plugin fails, pause or block the affected operation rather than silently changing the rules. Resume and replay must detect missing or incompatible dependencies. Do not hot-swap required plugins during a race or results review.

## Delivery order and verification

1. **Manager and runtime:** separate package type, install/review, activation, compatibility, logs, disable/remove, rollback, crash recovery and a start-without-plugins option that works before loading plugins.
2. **Hardware API:** registry, settings page integration and the simulated interface above. Prove that existing timing interfaces and race systems still behave identically.
3. **Display/tool APIs:** widgets, pages and commands, including second-screen/network-view decisions, theme consistency and performance limits.
4. **Rule APIs:** deterministic event order, deadlines, saved results, restart/replay and integration testing across Race Systems.

Each milestone includes malformed manifests/packages, path traversal and symlink rejection, failed/interrupted updates, incompatible dependencies, worker crashes/timeouts, stale messages and clean disable/restart tests. Do not advertise crash containment as protection from malicious unrestricted native code. Measure responsiveness with the plugin worker busy and the Layout Editor loaded.

No marketplace or automatic updates are required for the first runtime. Third-party code stays separately installed; minimal first-party test fixtures can demonstrate and verify the API without incorporating user plugins into the product.
