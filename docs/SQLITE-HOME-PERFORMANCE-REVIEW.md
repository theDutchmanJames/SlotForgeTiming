# Home history performance review

3 November 2026. Changes and tests use generated profiles and a separate copy of the earlier volume fixture. No personal database was opened or converted. Default-branch and release publication are outside this task; native CI uses the existing codex/sqlite-qualification test branch.

## Cause and implementation

The SQLite Home reader reconstructed every saved lap from JSON for every statistics request. At one million laps the shared JavaScript aggregation took about 9.9 seconds and queued unrelated worker reads behind it.

Home now uses a derived home_laps projection of eligible numeric laps, small home_dates session-date references, and home_totals counts by track/car/lane. Existing record indexes answer fastest-track and selected-grid personal-best queries. Only winning lap objects are loaded for labels. Last-race lookup is indexed by session/time; weekly and current-year cards aggregate typed rows only when requested. Ordinary record/glance/recent/top/all-time-mileage views avoid a full lap scan.

Totals and projections update in the same transaction as finalization, corrections, imports and deletions. Current track metadata determines lane length at read time, so track edits immediately update distances. Current names, Paddock labels, removed drivers/cars, invalid/late/slow laps, token sessions, weekly fallback dates, year boundaries, team winners and stable ties retain their meanings. The review caught and corrected a tied grid-personal-best ordering difference; candidate ordering now follows original lap order on both backends.

These tables are derived data, not a replacement for original records. An atomic upgrade builds them once. A command-sequence marker detects writes from an older build; a timezone marker detects changes affecting locally parsed dates. Either causes a rebuild on reopen. An interrupted rebuild rolls back and can be retried. Native backups carry the indexes; legacy JSON exports retain the original public data format. JSON-backed profiles retain their existing read path.

## Measurements

Windows x64, same generated million-lap history and approximately 2 GiB of media from the previous qualification. New measurements operate on a separate copy, not that original fixture. Results compare the prior streaming calculation against indexed queries in the same process; they are a single-machine benchmark, not an FPS or hardware timing guarantee.

| Measurement | Result |
| --- | ---: |
| Prior default record/glance calculation | 9,867.7 ms |
| Indexed default, three calls | 4.43 / 2.32 / 1.62 ms |
| Full Home render in actual Electron app | 9.4 ms |
| Reopen plus app checks/screenshots | 1.18 seconds |
| One-time index build for this million-lap copy | 40.9 seconds |
| Reopen repository with index already built | 9.9 ms |
| All history cards requested together, first measured call | 4.27 seconds |

The all-cards measurement was taken while other tests were running. Separate warm probes measured weekly comparison at about 827 ms, all-track records at 315 ms and year mileage at 291 ms. Those optional views still scale with the relevant indexed history; this change does not promise constant-time loading for every card or for unlimited numbers of drivers/sessions.

The indexes add approximately 285 MiB to this roughly 3 GiB fixture. First open after upgrading an existing SQLite database can therefore take longer and requires extra disk space. Subsequent Home loads reuse the index; normal result saves maintain it incrementally. Help explains the first-open cost. Grouping lap counts changes floating-point accumulation order: this fixture's 19.37-million-metre distance differs from repeated addition by approximately 0.00009 metres. Tests compare distance within explicit tiny tolerances, while counts, records, names, eligibility and every other result remain exact. Displayed distances are unchanged.

Evidence: ../outputs/sqlite-conversion/home-performance-Sm3emG/result.json, app-first-result.json, app-reopen-result.json and home-*.png; home-history-scale-totals.log. The script home-history-scale.cjs requires a completed synthetic volume fixture and creates a fresh copy. The app probe accepts only a completed home-performance fixture and a marked isolated test profile.

## Tests and review

The dashboard suite covers all cards and periods/scopes against original Home functions, malformed times and date fallback, token/invalid laps, tied grid records, targeted reads, metadata edits, result finalization/retry, eligibility changes, session removal, reopen, native backup/restore, rollback before commit, older-writer detection and abrupt process exit during index creation. Storage regressions also exercise disk-full finalization, recovery, Paddock integration and import/export with the new indexes active.

The actual Windows app passed conversion/crash/recovery/native-restore QA. Its existing dashboard probe passed all themes and card types on generated data. The million-lap app probe passed first open and reopen with zero full-history/media-collection reads and screenshots in light/dark themes. The requested 600 px window is clamped by the existing app minimum to a 744 px content viewport; this is recorded rather than reported as a true 600 px render.

Final local storage regressions passed **297 tests**, plus the legacy Home, Help and package checks. The [native qualification run](https://github.com/theDutchmanJames/SlotForgeTiming/actions/runs/41658498423) passed on **Windows, Linux and Intel macOS** at source revision 28aae76ac350adf5ec86bc5856b8f24fca38a91a. It includes the same storage suite, the bounded volume fixture, production activation/crash/recovery/restore, complete app startup/reopen and ASAR worker execution. Apple Silicon was not tested. No new release or change to automatic migration defaults is part of this work. Physical power cuts and live hardware timing are not tested here.
