# SlotForge Timing

<img src="build/icon.png" alt="SlotForge Timing icon" width="96" align="right">

**Lap timing, race management and custom race displays for analogue slot-car tracks.**

SlotForge Timing brings your track, drivers, cars and race rules together in a desktop app. Run practice sessions, qualifying, club races, heats, championships and team endurance events, then review and publish the results. Build a simple timing screen or a complete race-day dashboard for a second monitor or TV.

**Current version: 1.99.1.** This repository contains the application source, build scripts, firmware sources and automated tests. See the [changelog](CHANGELOG.md) for this release.

**On this page:** [Features and Race Systems](#what-you-can-do-with-slotforge) · [Timing hardware](#timing-hardware) · [Install and run](#install-and-run) · [First race](#first-race) · [Development](#development-and-testing)

## What you can do with SlotForge

Use SlotForge for a few laps on your home track or a complete club race meeting. Start with basic timing, then choose the extra rules, displays and announcements that suit your event.

### Race formats and competition management

- Run **Free Practice, Qualifying, Races, Heat-based races, Endurance Races and Time Token Sessions**.
- Set races to end by time, laps or distance, with configurable start lights, first-lap behaviour, track calls and red-flag restarts.
- Plan heats and lane rotations, combine results, organise championship rounds and award points.
- Run teams with driver swaps, mixed car classes or recorded Virtual Rivals.
- Review the finished session as Race Director: invalidate or remove laps, disqualify entries and finalise the classification before saving it.
- Show a **Victory Spotlight**, podium cards, configurable driver facts and comparison charts on the Results screen. For larger fields, use a saved leaderboard design.
- Keep personal bests and track records. Laps interrupted by a red flag are marked invalid for records, so coasting during a stoppage cannot create an artificial personal best or track record.

### Race Systems and what they do

Make reusable setups under **Race Setup**, then select the systems you want in a Race Setup. Each system adds its own rules to the shared race engine. You can keep a race simple or combine supported systems for a more strategic event; availability depends on the session format.

| System or setup | What it adds to your race |
| --- | --- |
| **Fuel Systems** | Set tank capacity, fuel consumption, refuelling speed and what happens when the tank runs empty. Use a track's target lap time or a manual reference to configure the system. |
| **Penalty Systems** | Award penalty points and decide their consequences: added time, lap adjustments, forced pit stops or custom combinations. Build escalating points tiers, named special penalties and disqualification rules. |
| **Safety Car Systems** | Configure yellow-flag target pace, penalties for driving too fast, pit-time adjustments and optional random flags with conditions. Track-call power behaviour follows the Race Setup. |
| **Tyre Wear Systems** | Choose standard or custom tyre compounds, wear/lifespan, tyre-changing time, weather suitability, mandatory stops, available sets and warnings. Faster or slower driving can change wear through the configured pace rules. |
| **Tyre Temperature & Warm-Up** | An optional part of Tyre Wear. Simulate cold, working and hot tyres, with compound-specific warm-up, cooling and wear effects. Weather, pits, pauses and completed tyre changes feed into the simulation. |
| **Weather Systems** | Simulate changing weather and track conditions, tyre suitability, wrong-tyre penalties and configurable race effects. Combine them with Tyre Wear, Fuel and other supported rules. |
| **Push & Save Systems** | Make pace affect fuel use, tyre wear or both. Faster laps can cost more resources; slower laps can save them. Set the Push/Save thresholds, benchmark and effect strength. |
| **Damage Systems & car failures** | Apply damage and supported failure events, determine the resulting hindrance, and require repairs or retirement/disqualification under your chosen rules. Repairs integrate with pit service. |
| **Balance of Power** | Help slower cars or hinder faster ones through fuel consumption, refuelling speed and optionally tank capacity. Supports director decisions and automatic balancing; it requires a Fuel System. |
| **Resource Systems** | Limit tyre sets, repair credits and replacement-component supplies for a driver, car or team. Track allocations across a race, event or championship and record director adjustments. |
| **Multi-Class Systems** | Race GT3s, Prototypes or your own classes together or in separate class heats. Select car classes, assign drivers, restrict eligible cars and keep overall/class classifications and points. |
| **Virtual Rival Systems** | Turn saved lap sequences into replay opponents. Link a setup to a Virtual driver, select that driver in a lane, and choose its replay instead of a slotcar. Replays follow the race clock and pause with it; physical timing inputs do not drive the virtual entry. |
| **Rotation Setups** | Build a reusable heat and lane-rotation plan so drivers or teams move through the event in the order you choose. |
| **Championship Setups** | Combine rounds and sessions into a competition with a roster, points tables, bonuses, dropped results, teams and tie-breaking rules. |
| **Time Tokens** | Give each lane an allowance of track time. Add or subtract time, set warnings and show when a lane's time expires. This is a timed-use session rather than a race with a winner; supported lane relays can control lane power. |
| **Endurance & driver swaps** | Race as a team, choose who is driving, define swap windows and minimum driving requirements, and track stints and swap penalties. These controls live in the Race Setup. |
| **Service Stop** | A Race Setup option that works independently of other Race Systems. Hold a pit stop while a car is removed for service, choose timed/manual release and combine fuel, tyres and repairs sequentially or in parallel. A fixed service timer can override calculated work time; penalty time remains additive. |

Tyres, fuel, damage, weather and related effects are race simulations. Their interaction is handled by SlotForge's rules; direct hardware actions depend on the interface and relays connected to your track.

### Completely freely customisable Race Screens

Build your own Race Screens in **Customization → Layout Editor**. Place, move, resize and layer widgets freely instead of being limited to a fixed dashboard. Create separate layouts for the **main screen** and **second display**, from a clean two-lane timing page to a large TV display with race statistics and graphics.

- Choose individual timing, driver, fuel, tyre, weather, penalty, strategy, team and race-control widgets.
- Use **All-in-One widgets** when you want essential driver, timing or race information together without arranging many separate pieces.
- Change fonts, title/value alignment, automatic or manual text sizing, backgrounds, one-colour gradients and gradient angles.
- Configure borders, rounded corners, depth and lane-colour accents at the top, left or right.
- Apply race-state colours to the background, text, or text and border.
- Use pictures, lane colours, shadows and front/back ordering to build the appearance you want.

### Widget Builder

Create reusable widgets in **Customization → Widget Builder**, starting with a blank canvas or a template. Add values, labels, pictures, icons, conditional status indicators, bars, rings, gauges and supported standard widget components.

Drag and resize individual elements in the live preview. Arrange them freely or use rows, columns, grids and groups. Browse grouped variables, format values and add rules that change an element when its data changes. Save the result, then place it in a Race Screen using the same appearance controls as the built-in widgets.

### Leaderboard Editor

Design the rows of your leaderboard: choose which values to show, their order, widths, labels, colours and presentation. Reuse a saved design in **Leaderboard widgets**, the **Live Race leaderboard** and the **Race Results list**. Configure overall, class-specific or grouped class views where supported.

### Chart Editor and live comparisons

Create a saved chart design in **Customization → Chart Editor**, then place a Race Chart widget in a layout or use it as a supported Widget Builder component. Choose drivers, values, lap history, references, legends and display options.

Chart styles include **Lap Trend, Driver Comparison, Delta Trend, Lap Time Spread (box plot), Lap Time Distribution (histogram), Position History, Lap Heatmap and Live Track**. Live Track shows estimated progress from lap timing; it is not a physical position sensor. It uses the shared, throttled display-update path rather than adding an unrestricted animation loop per chart.

### Custom Audio Sets

Create different Audio Sets for different race nights or tracks. Configure spoken commentary, custom messages, recorded clips, sound effects and ambient sounds in **Customization → Audio Settings**.

Calls are grouped by race activity and Race System. Insert supported values such as driver names, lap times, positions, gaps and system status into messages. Choose playback modes, conditions, repeat limits, voice/mix options and which calls are enabled. Link the Audio Set to a Race Setup so the right announcements load with the event.

### Custom Image Sets

Create reusable **Image Sets** in **Customization → Image Settings** and assign them to compatible widgets. Use your own artwork for supported elements such as driver avatars, tyres, start lights, fuel indicators and weather graphics. A saved set makes it easier to keep matching visuals across several layouts.

### Powerful app theming and personal branding

Make SlotForge look and feel like your own app. Choose a ready-made theme or give the app the colours you want, add your own **logo and header images**, and coordinate the Race Screens, widgets and image sets. Build a personal style for your home track, or match your **club or company branding**. The app's [licence terms](#licence-and-copyright) govern its use.

### Driver, Slotcar and Track Databases

Keep drivers, teams, slotcars and tracks together with their pictures, descriptions, class labels and settings. Track records and personal bests stay linked to the people, cars and tracks that produced them.

The **Slotcar Database** includes more than a car list. View laps driven, mileage, sessions, wins, last use, fastest laps, per-track lap statistics, service intervals and mileage/laps since servicing. Deslot estimates use the track's configured lap-time threshold. Set a **Race Class** label, such as GT3 or Prototype, to make the car available to the matching Multi-Class entries.

### Import, Export and sharing between users

**App Settings → Import and Export** lets users freely share **Widgets, Layouts and custom Audio and Image Sets** with each other. Export a design or a collection, send the file to another user, and let them import it into their own app—there is no need to exchange the entire database.

You can also export drivers, slotcars, tracks, teams, Race System setups, championship setups, leaderboard designs, chart designs and saved sessions. Choose the related items to include, such as an Image Set used by a layout. **Individual imports add copies**, preserving links between the included items; a conflicting name gets an imported suffix.

For moving a complete installation's data, create a **Complete backup**. It includes the database, layouts, pictures, sounds, settings, past races and laps. **Restoring a complete backup replaces the current database**, so use an individual export when your aim is simply to add another user's designs. Complete backups also include settings such as the Race Director password; individual design exports are the appropriate files for sharing publicly.

### Expansive Help and a Calculations reference

The in-app **Help** has grouped, expandable sections covering race preparation, Race Systems, hardware, editors, results and day-to-day workflows. Setup pages also provide **IN PLAIN WORDS** summaries, explanations, tooltips and previews.

**App Settings → Calculations** explains the documented formulas and worked examples behind pace benchmarks, fuel, tyres, race effects, resource allocation, pit service, penalties, timing estimates and scoring. Explore available choices such as median or average pace and save supported calculation settings. The page distinguishes examples from settings that actually change race behaviour; it is not an unrestricted code editor.

### Second screens, local-network viewing and race control

Display live timing and results on another monitor or TV, or let devices on the same local network follow a race in their browser. The Race Director can manage calls, penalties, pit service and supported Race System controls while racing. Remote director access uses the password configured in App Settings.

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

### Which download should I use?

| Option | Best for | How you use it |
| --- | --- | --- |
| **Portable.exe** | Trying the app, checking its features or testing a new version. | Ready to use: download it and double-click. If supplied inside a ZIP, extract it first. No installation is required. |
| **Setup.exe installer** | Regular, long-term use once you are happy with the app. | Run the installer and follow its steps. It installs the app and can create shortcuts for convenient everyday use. |
| **Source ZIP** | Building the app yourself or working on its code. | Install Node.js, extract the source and run a build file. This produces the Portable and Setup programs. |

**Portable and installed builds do not need Node.js.** Both use the app's normal user-data folder on the computer, so Portable does not mean a separate database is stored beside the executable. Interface-specific drivers or libraries may still be needed for timing hardware.

### Ready-made Windows programs

Check the [Releases page](https://github.com/theDutchmanJames/SlotForgeTiming/releases) for ready-made **Portable.exe** and **Setup.exe** files. If a release only offers source code, use the source-build guide below.

**To try SlotForge:**

1. Download the Portable program. Extract it first if it comes in a ZIP.
2. Double-click **SlotForge Timing-1.99.1-Portable.exe**.
3. Explore with **No hardware**, manual controls or the Arduino virtual box before configuring your real timing interface.

**To keep using SlotForge:**

1. Download **SlotForge Timing-1.99.1-Setup.exe**.
2. Double-click it and follow the installation steps.
3. Open SlotForge Timing using its shortcut. Use **Import and Export** for backups or moving your data to another PC.

The GitHub **Code → Download ZIP** button provides source files, not a ready-made program. If you do not see a Portable or Setup executable in your download, build the source as described next.

### Windows: build it without typing terminal commands

For new or inexperienced users, **Quick Build is the recommended way to make a program you can try**. It skips the automated test/check phase and goes straight to building after obtaining any missing dependencies. It creates the same Portable and Setup program formats as the normal build.

1. **Install Node.js.** Visit [nodejs.org](https://nodejs.org/), download the Windows installer and run it. Keep the npm and PATH options enabled. This source release was developed and checked with Node.js **24.x**. Close and reopen any terminals after installing it.
2. **Download the source.** On [the repository page](https://github.com/theDutchmanJames/SlotForgeTiming), click the green **Code** button and choose **Download ZIP**. You can also use a separately provided SlotForge source ZIP.
3. **Extract the ZIP.** Right-click the downloaded file, choose **Extract All**, and extract it to a normal writable folder, such as Documents. Do not run the build from inside the ZIP.
4. **Find the app folder.** Open the extracted folders until you can see **package.json**, **build-windows.bat** and **build-windows-quick.bat** together. GitHub downloads usually name this folder **SlotForgeTiming-main**; a separate source ZIP may contain **SlotForgeTiming**.
5. **Double-click build-windows-quick.bat.** Keep the build window open. The first run needs an internet connection to download dependencies; it can take several minutes. Quick Build skips the automated checks. If a filename's extension is hidden, Windows may show it as **build-windows-quick** with type **Windows Batch File**.
6. **Open the dist folder.** A successful build opens it automatically. You can also open **dist** yourself inside the app folder.
7. **Try Portable first.** Double-click **SlotForge Timing-1.99.1-Portable.exe**. If you are happy and want to use the app long term, run **SlotForge Timing-1.99.1-Setup.exe**.

**What does Quick Build skip?** It skips `npm test`, the automated test suite. It still installs missing build dependencies and compiles/packages the app. The normal **build-windows.bat** runs the checks before building; developers and anyone validating changes can use that file instead.

### Windows: running commands for the first time

You do not need this section if the double-click Quick Build route works for you. These instructions are useful when running the development app or reading an error from the build.

**Open a command window in the correct folder:**

1. In File Explorer, open the extracted app folder that contains **package.json**.
2. Click the address bar at the top of File Explorer.
3. Type **cmd** and press **Enter**. A Command Prompt window opens in that folder.
4. Copy a command from the guide, paste it into that window and press **Enter**. Run one command at a time, and wait for it to finish before running the next one. Do not copy the surrounding Markdown marks or add a prompt such as `C:\>`.

Check that Node.js and npm are available:

```bat
node --version
npm.cmd --version
```

Each command should print a version number. npm is the dependency tool installed with Node.js. The commands below use **npm.cmd** so they also work if you choose PowerShell and its script policy blocks `npm.ps1`; no execution-policy change is needed.

**To start the app from source:**

```bat
npm.cmd ci
npm.cmd start
```

`ci` downloads the exact dependencies recorded in the lockfile. `start` opens the development app. Leave its command window open while using the app; after closing the app, you can run `npm.cmd start` again without reinstalling dependencies.

**To run Quick Build from Command Prompt:**

```bat
build-windows-quick.bat
```

In PowerShell, the equivalent command is:

```powershell
.\build-windows-quick.bat
```

**To build using the locked dependency versions, without running checks:**

```bat
npm.cmd ci
npm.cmd run dist
```

**To check the app before building:**

```bat
npm.cmd ci
npm.cmd test
npm.cmd run dist
```

The last step creates both the Portable and Setup executables in **dist**. If the check or build reports a failure, keep the window open and copy the error when requesting help.

### Optional: download with Git

Git is optional; ZIP downloads work without it. If you already have [Git](https://git-scm.com/) and Node.js installed, open Command Prompt in a folder where you want to store the source, then run:

```bat
git clone https://github.com/theDutchmanJames/SlotForgeTiming.git
cd SlotForgeTiming
build-windows-quick.bat
```

`git clone` downloads the repository into a new **SlotForgeTiming** folder. `cd` changes the command window's current folder. The last command starts Quick Build.

### Linux and macOS builds

Build on the operating system you are targeting. Linux and macOS build scripts are provided; this release's desktop verification was performed on Windows, and timing-interface availability differs by platform.

1. Install [Node.js](https://nodejs.org/) and extract the source ZIP.
2. Open Terminal. On macOS, find it through Spotlight; on Linux, use your desktop's application menu.
3. Type `cd `, including the space, followed by the full path of the folder containing **package.json**. Put a path containing spaces in double quotes. For example, adjust this path to your own extracted folder:

```sh
cd "/full/path/to/SlotForgeTiming-main"
```

4. Run the matching **Quick Build** command below. These quick files skip the automated checks, as on Windows.

**Linux:**

```sh
chmod +x build-linux.sh build-linux-quick.sh
bash build-linux-quick.sh --no-install
```

**macOS:**

```sh
chmod +x build-mac.command build-mac-quick.command
bash build-mac-quick.command --no-install
```

`chmod +x` gives the build scripts permission to run, which may be needed after extracting a ZIP. The scripts download missing dependencies and put finished packages in **dist**. `--no-install` builds the packages without installing the app at this stage. Linux produces AppImage and Debian packages; macOS produces DMG and ZIP packages.

For a normal build that includes checks, use **build-linux.sh** or **build-mac.command** in the same command instead. To run the source app directly on either platform:

```sh
npm ci
npm start
```

### Common first-time setup problems

| Message or situation | What to do |
| --- | --- |
| **node or npm is not recognised** | Install Node.js with npm/PATH enabled, then close and reopen the command window. Check `node --version` again. |
| **Cannot find package.json**, or **ENOENT** referring to that file | The command window is in the wrong folder. Open the folder containing package.json in File Explorer and use the address-bar **cmd** method above. |
| **npm.ps1 cannot be loaded** in PowerShell | Use the shown `npm.cmd` commands, or open Command Prompt with the **cmd** method. |
| The ZIP shows source files but no executable | Extract it, then run the Quick Build file. Ready-made executables come from a release download or the build's **dist** folder. |
| The build has not finished yet | Keep its window open while dependencies download and packaging runs. A successful Windows build opens **dist**. |
| A build ends with an error | Keep the error message. Include it, your operating system and app version when opening an issue. |

## First race

1. Open **Database** and add your track, drivers and slotcars. Set a car's **Race Class** if you plan to use Multi-Class racing.
2. Open **App Settings → Timing Hardware**, choose the interface and check its lane sensors. To explore without hardware, choose **None** or the Arduino virtual box.
3. Create a **Race Setup**, select the track and session type, and choose the finish rule. Add optional Race Systems as needed.
4. On **Home → Start a Race**, assign drivers and cars to lanes. For a Virtual Rival driver, the car selector becomes the saved replay-setup selector.
5. Start the session. After it ends, review the laps and classification on the director's finalize-results page before saving the results.
6. Configure timing layouts, leaderboard rows, charts, widgets and the Results screen under **Customization**.

Open **App Settings → Help** whenever you need an explanation. **App Settings → Calculations** provides worked examples of the race rules and the settings that control them.

## Where your data is stored

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

Additional focused checks are listed in `package.json`. Electron checks use isolated profiles and simulated race data where supported. The complete regression chain and 11 Electron/performance suites passed for the 1.99.1 source snapshot. Software tests do not replace physical sensor and relay validation.

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
