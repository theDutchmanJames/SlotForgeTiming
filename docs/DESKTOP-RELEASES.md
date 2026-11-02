# Native desktop builds

The **Desktop builds** GitHub Actions workflow builds on Windows, macOS and Ubuntu. Each job uses `npm ci`, runs the regression suite, creates packages and loads the packaged `app.asar` code using the installed Electron runtime in an isolated profile. Linux uses a virtual display for this smoke test. This verifies packaged application code, renderer assets and the widget/Paddock UI. It does not launch the installer, mounted DMG or AppImage, test operating-system installation prompts, or certify physical timing hardware. A universal Mac package is created, but the smoke test runs only on the runner's native architecture.

| Platform | Downloads |
| --- | --- |
| Windows x64 | Portable EXE and Setup EXE |
| macOS, Intel and Apple Silicon | Universal DMG and ZIP |
| Linux x64 | AppImage and Debian package |

Publishing a release starts the workflow for that exact tag. The version in `package.json` must match the tag. Only after every platform passes does the publication job add missing files to the existing release. Existing downloads are retained; the workflow never moves tags or replaces binaries. `SHA256SUMS-desktop.txt` lists the actual six published desktop files, including files already supplied by a local Windows build. A separately supplied source ZIP and its existing checksum file are left intact.

For a test build, go to **Actions → Desktop builds → Run workflow**, choose a branch and leave the release tag blank. Downloads appear under the completed run's **Artifacts** for 14 days. To fill missing assets on an existing release, enter its tag (for example `v1.99.4`) and enable **Add missing downloads**. Do not use this to overwrite a released binary: publish a new version, or perform an explicitly reviewed release refresh first. Immutable releases cannot have downloads added this way.

The build jobs have read-only repository access; only the final publication job can upload release assets. No personal token is required. Release events created using another workflow's `GITHUB_TOKEN` do not trigger another workflow automatically; use manual dispatch in that case.

## Signing and hardware

The Linux build also runs `npm run fwtest` with its desktop C++ compiler. This executes the actual Nano and Mega sketch against simulated ADC, serial and relay-pin behavior. Missing compiler support fails this strict check. It supplements the application suite; it is not an AVR compilation or physical hardware test. When changing firmware, also compile it for the supported boards with Arduino CLI/IDE and regenerate the embedded download using `npm run sketch`.

The Mac app uses an ad-hoc signature so its universal binary has a valid local signature. It is **not Apple Developer ID signed or notarized**; macOS may require approval in System Settings → Privacy & Security. Do not describe it as notarized. Windows downloads are also unsigned. Developer certificates and notarization can be added later.

Parallel Port and the current Phidget USB helper are **Windows-only**. Other timing interfaces depend on OS drivers, serial/network access and the device. A successful build and smoke test do not certify a physical interface on that OS. Linux AppImage support also depends on the distribution's AppImage/FUSE support; Debian/Ubuntu users can choose the `.deb` instead.
