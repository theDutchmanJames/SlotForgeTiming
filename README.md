# SlotForge Timing

<img src="build/icon.png" alt="SlotForge Timing icon" width="96" align="right">

**Lap timing, race management and custom race displays for analogue slot-car tracks.**

SlotForge Timing brings your track, drivers, cars and race rules together in a desktop app. Run practice sessions, qualifying, club races, heats, championships and team endurance events, then review and publish the results. Build a simple timing screen or a complete race-day dashboard for a second monitor or TV.

**Current version: 1.99.1.** This repository contains the application source, build scripts, firmware sources and automated tests. See the [changelog](CHANGELOG.md) for this release.

## Features

- **Race management:** timed, lap and distance races; heat plans and lane rotations; championships; multi-class scoring; team racing and driver swaps; Time Token sessions.
- **Connected race systems:** configurable fuel use and refuelling, tyre wear and simulated tyre temperature, weather, Push & Save, penalties, damage and repairs, Safety Car rules, Balance of Power and limited resources.
- **Pit service:** shared or separate pit sensors, configurable Service Stops, fuel/tyre/repair work and additive penalty time.
- **Virtual Rivals:** race against saved lap sequences. Create a virtual driver, link a replay setup, then select that driver in a lane instead of a physical car.
- **Custom displays:** Layout Editor, Leaderboard Editor, Chart Editor, Race Results settings and a free-canvas Widget Builder. Choose fonts, backgrounds, gradients, borders, accent stripes and race-state colours.
- **Live charts:** lap trends, driver comparisons, deltas, lap-time distributions, box plots, position history, heatmaps and an estimated Live Track display.
- **Audio:** configurable spoken calls, recordings and sound effects, with editable messages, values, conditions and repeat limits.
- **Driver, slotcar and track databases:** avatars, car descriptions, racing classes, records and reusable setups.
- **Results and records:** director review, lap invalidation and disqualification, personal bests, track records, podium displays, comparison statistics and PDF reports. Red-flag-interrupted laps cannot set a personal best or track record.
- **Second displays and local-network viewing:** show timing and results on another screen, or let devices on your local network follow the race. Remote director controls use the configured password.
- **Local data and backups:** keep your data on your computer; export selected setups or make complete backups from the app.

Race systems are optional. Start with basic lap timing and enable the additional rules you want for your track.

## Timing hardware

Choose the active interface in **App Settings → Timing Hardware**. One interface supplies race timing at a time.

| Interface | Support in this version |
| --- | --- |
| Trackmate | Serial connection, lane mapping, track calls and supported relay control. |
| SlotForge Arduino box | SlotForge firmware for compatible Nano/Mega boards, sensors, pits, lights, relays and buttons. A virtual box is available for simulation. |
| Parallel Port | Windows native LPT/compatible expansion hardware through a separately installed compatible InpOut driver. A USB printer adapter does not provide the required direct pin access. |
| Phidget | Local USB on Windows 64-bit through the official Phidget22 libraries; digital, voltage and voltage-ratio sensor inputs, plus supported outputs. |
| DS Electronics | Serial capture and diagnostics. Race timing is not implemented yet. |
| oXigen Digital | Reserved interface page; not implemented yet. |
| No hardware | Keyboard/manual controls and simulated cars for trying the app. |

Parallel Port and Phidget support have been tested in software with simulated inputs. Physical hardware compatibility and timing accuracy have not been verified for these implementations. Check the interface documentation before connecting a track:

- [Parallel Port setup and requirements](docs/PARALLEL-PORT.md)
- [Phidget setup and limitations](docs/phidget-interface.md)
- [Arduino box documentation](docs/arduino-box/)
- [Service Stop behaviour](docs/SERVICE-STOP.md)

## Install and run

### Using a packaged Windows build

If an installer or portable build is available on the [Releases page](https://github.com/theDutchmanJames/SlotForgeTiming/releases):

1. Download the **Setup.exe** installer or **Portable.exe** file for the version you want.
2. Run the installer and open SlotForge Timing, or double-click the portable executable.
3. Select your timing interface and configure your track in the app.

**Node.js is not needed to run a packaged application.** Interface-specific drivers or libraries may still be required. This repository's **Code → Download ZIP** downloads source code, which must be built using the instructions below.

### Run from source

Windows is the currently validated development platform. Linux and macOS build scripts are included; timing-interface availability differs by platform. Use a current Windows 10/11 environment for the Windows build.

Prerequisites:

- [Node.js](https://nodejs.org/) and npm. Development and regression checks for this source release used Node.js 24.x.
- An internet connection for the initial dependency download.
- [Git](https://git-scm.com/) if you want to clone the repository; alternatively, download and extract the source ZIP.

Clone the repository and install the locked dependencies:

```sh
git clone https://github.com/theDutchmanJames/SlotForgeTiming.git
cd SlotForgeTiming
npm ci
npm start
```

If you downloaded a ZIP, open a terminal in the extracted folder containing `package.json`, then run `npm ci` and `npm start` there.

### Build the Windows installer and portable app

The easiest route is to double-click **build-windows.bat** in the source folder. It installs the build dependencies, runs the tests and creates both programs in **dist**.

For a build using the versions in the lockfile, use:

```sh
npm ci
npm test
npm run dist
```

The output files are named:

```text
dist/SlotForge Timing-1.99.1-Setup.exe
dist/SlotForge Timing-1.99.1-Portable.exe
```

For later local rebuilds, **build-windows-quick.bat** reuses installed dependencies and skips the tests. Use the normal build or `npm test` when you need validation.

### Linux and macOS builds

Build on the operating system you are targeting. After installing Node.js, run:

```sh
# Linux
bash build-linux.sh --no-install

# macOS
bash build-mac.command --no-install
```

Linux builds produce AppImage and Debian packages. macOS builds produce DMG and ZIP packages. Outputs go to **dist**. These scripts are included in the source; this release's desktop verification was performed on Windows.

## First race

1. Open **Database** and add your track, drivers and slotcars. Set a car's **Race Class** if you plan to use Multi-Class racing.
2. Open **App Settings → Timing Hardware**, choose the interface and check its lane sensors. To explore without hardware, choose **None** or the Arduino virtual box.
3. Create a **Race Setup**, select the track and session type, and choose the finish rule. Add optional Race Systems as needed.
4. On **Home → Start a Race**, assign drivers and cars to lanes. For a Virtual Rival driver, the car selector becomes the saved replay-setup selector.
5. Start the session. After it ends, review the laps and classification on the director's finalize-results page before saving the results.
6. Configure timing layouts, leaderboard rows, charts, widgets and the Results screen under **Customization**.

The in-app **Help** explains the settings and workflows. **App Settings → Calculations** describes the race-system formulas and the available calculation choices.

## Data and backups

The app keeps its database in its user-data folder, separately from the source and installed program. On Windows this is normally:

```text
%APPDATA%/slotforge-timing/slotforge-timing.json
```

Use **App Settings → Import and Export** to make a complete backup before moving to another computer or replacing an existing database. The portable executable also uses the app's normal user-data folder; it does not make a separate database alongside the executable.

## Development and testing

```sh
npm test                         # Complete automated regression chain
npm run test:postreview:electron  # Embedded charts and Arduino race ownership
npm run test:widget-preview:electron
npm run test:charts:electron
```

Additional focused checks are listed in `package.json`. Electron checks use isolated profiles and simulated race data where supported. The complete regression chain and 11 Electron/performance suites passed for the 1.99.1 source snapshot before this repository reset. Software tests do not replace physical sensor and relay validation.

| Folder | Contents |
| --- | --- |
| `renderer/` | App screens, race systems, widgets and display code. |
| `native/` | Windows interface helpers and their source. |
| `firmware/` | SlotForge Arduino firmware. |
| `tests/` | Automated model and integration tests. |
| `tools/` | Build helpers and Electron verification scripts. |
| `docs/` | Feature, interface and validation documentation. |

## Reporting problems

Open an [issue](https://github.com/theDutchmanJames/SlotForgeTiming/issues) with the app version, operating system, timing hardware, steps to reproduce and any relevant screenshot or error message. For timing problems, include the affected lane, sensor configuration and race systems that were enabled.

## Licence and copyright

SlotForge Timing is made by theDutchmanJames. Copyright 2026 theDutchmanJames.

The source is provided under the **PolyForm Noncommercial License 1.0.0**. See [LICENSE](LICENSE) for the full terms, permissions and required notices. Third-party components retain their own licences.
