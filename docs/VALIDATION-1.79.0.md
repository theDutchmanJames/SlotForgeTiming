# SlotForge Timing 1.79.0 — validation

Date: 26 October 2026.

## Results

- 128 of the project's 130 test commands passed.
- The first 71 commands of `npm test` passed, including the database, BoP rules, packaging and main screen suites.
- `tests/server.test.js` then failed to connect to its own local server: `connect EACCES 127.0.0.1`. This session restricts network access.
- `tests/web.test.js` also needs real local socket connections, so it was not executed under the same restriction.
- The remaining 57 commands were run in their original order and all passed, including the extended Balance of Power screen tests, race simulations, recovery, help and audit checks.
- All 111 app JavaScript files parsed successfully.

The two socket-based suites still need an unrestricted local run. This is not a claim that the complete `npm test` chain passed in this session.

## Changes exercised

The existing BoP rule tests now cover the page's explanation, all eight combinations of fuel effects, cleaned defaults and threshold-bar bounds. The screen suite also exercises the visible cards and switches, live previews, section navigation and folding state, keyboard focus, queued writes, save errors and recovery, reset, and a save that completes after leaving the page. Existing race and Director controls continue to pass.

The race engine (`renderer/engine.js`), BoP rules (`renderer/bop.js`) and schema are byte-for-byte identical to the imported baseline. The database contains the earlier Windows transient-lock fix; the editor refresh does not alter it.

## Visual and hardware limits

Visual testing was attempted but could not be completed. The cached Electron 45.0.0 runtime matched the package's SHA-256 checksum and was installed locally; its process exited before opening the test window. Automatic approval review rejected launching Edge because that action required a disabled approval category. The available browser surface could not connect to the local preview, and its URL policy rejected a standalone data-URL preview.

No new screenshots, physical-phone tests, hardware tests or mutation-testing results are claimed. The README contains the local review checklist and differences from board 11.

## Delivery

The ZIP contains one folder named `SlotForgeTiming`, source, assets, tests, firmware, documentation and build scripts. It excludes dependencies, caches, temporary test databases and QA launchers. Every archived file is checked against the working source by SHA-256.

The work was based on the supplied 1.78.0 ZIP. No remote Git push, tag or publication was performed.
