# Run or build SlotForge Timing from source

For a ready-to-use app, choose a desktop download from the [latest release](https://github.com/theDutchmanJames/SlotForgeTiming/releases/latest). You do not need Node.js or terminal commands for those downloads.

This guide is for building or running the source yourself. **Quick Build is the easiest source-build route for new users:** it installs missing build dependencies and creates the app while skipping the automated test suite. Use the normal build scripts when validating changes.

## Windows: build it without typing terminal commands

For new or inexperienced users, **Quick Build is the recommended way to make a program you can try**. It skips the automated test/check phase and goes straight to building after obtaining any missing dependencies. It creates the same Portable and Setup program formats as the normal build.

1. **Install Node.js.** Visit [nodejs.org](https://nodejs.org/), download the Windows installer and run it. Keep the npm and PATH options enabled. This source release was developed and checked with Node.js **24.x**. Close and reopen any terminals after installing it.
2. **Download the source.** On [the repository page](https://github.com/theDutchmanJames/SlotForgeTiming), click the green **Code** button and choose **Download ZIP**. You can also use a separately provided SlotForge source ZIP.
3. **Extract the ZIP.** Right-click the downloaded file, choose **Extract All**, and extract it to a normal writable folder, such as Documents. Do not run the build from inside the ZIP.
4. **Find the app folder.** Open the extracted folders until you can see **package.json**, **build-windows.bat** and **build-windows-quick.bat** together. GitHub downloads usually name this folder **SlotForgeTiming-main**; a separate source ZIP may contain **SlotForgeTiming**.
5. **Double-click build-windows-quick.bat.** Keep the build window open. The first run needs an internet connection to download dependencies; it can take several minutes. Quick Build skips the automated checks. If a filename's extension is hidden, Windows may show it as **build-windows-quick** with type **Windows Batch File**.
6. **Open the dist folder.** A successful build opens it automatically. You can also open **dist** yourself inside the app folder.
7. **Try Portable first.** In **dist**, double-click **SlotForge Timing-2.0.0-Portable.exe**. If you are happy and want to use the app long term, run **SlotForge Timing-2.0.0-Setup.exe**.

**What does Quick Build skip?** It skips `npm test`, the automated test suite. It still installs missing build dependencies and compiles/packages the app. The normal **build-windows.bat** runs the checks before building; developers and anyone validating changes can use that file instead.

## Windows: start the app from any terminal folder

**npm does not search your computer for SlotForge.** It runs against the project in the terminal's **current working folder**, using that project's `package.json` and `package-lock.json`. Opening a random terminal and entering `npm ci` is therefore not enough: you must first select SlotForge's extracted source folder.

The instructions below start from scratch. You do not need to have opened a terminal in the right folder or completed another terminal guide first.

### 1. Install Node.js and extract the source

1. Install [Node.js](https://nodejs.org/) with npm and the PATH option enabled; this release was checked with Node.js **24.x**. Close and reopen terminals after installation.
2. Download the **source ZIP** and use **Extract All**. A ZIP open in File Explorer is not an extracted folder.
3. Open the extracted folders until **package.json**, **package-lock.json** and **build-windows-quick.bat** are visible together. GitHub downloads usually call this folder **SlotForgeTiming-main**; the separate release ZIP contains **SlotForgeTiming**. There may be an outer folder with another folder inside it: choose the inner app folder containing those files.
4. In that folder, click File Explorer's **address bar** to reveal the full path, then copy it. Copy the folder path, not the path of `package.json` itself. For example, a real path might look like `D:\Slotcar Projects\SlotForgeTiming-main`. Yours will usually be different.

### 2. Open PowerShell, wherever it starts

Press **Windows + R**, type **powershell.exe -NoProfile**, and press **Enter**. Alternatively, if you already opened Command Prompt or another Windows terminal, type this and press Enter to open the PowerShell session used by this guide:

```text
powershell.exe -NoProfile
```

Its prompt usually starts with **PS**, for example `PS C:\Users\YourName>`. It is fine if it starts in a completely different folder or on a different drive. Do not type the `PS C:\...>` prompt itself.

### 3. Paste the complete start block

Copy **all** of the following block, including `& {` and the final `}`, paste it into PowerShell, and press **Enter**. Do not enter the lines individually. The opening and closing braces keep the steps together so a folder or install error stops the later steps.

When it asks **Paste the full extracted SlotForge folder path**, paste the path you copied in step 1 and press **Enter**. You do not need to edit a username or placeholder path in the commands. Paths with spaces and paths on another drive are supported.

```powershell
& {
    $slotForgeFolder = (Read-Host "Paste the full extracted SlotForge folder path").Trim().Trim('"')
    if (-not $slotForgeFolder) { throw "No folder was entered. Run this block again and paste the folder path." }
    Set-Location -LiteralPath $slotForgeFolder -ErrorAction Stop
    if (-not (Test-Path -LiteralPath ".\package.json" -PathType Leaf)) { throw "Wrong folder: package.json is missing. Open the extracted app folder, not its parent or the ZIP." }
    $slotForgeProject = Get-Content -LiteralPath ".\package.json" -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($slotForgeProject.name -ne "slotforge-timing") { throw "This is another project, not SlotForge Timing. Run this block again with the correct folder." }
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Read the error above." }
    npm.cmd start
}
```

What happens next:

1. **Select the folder:** `Set-Location` moves this PowerShell session to the folder you supplied, even if it is on another drive. It does not move the source files.
2. **Check the project:** the block requires `package.json` and checks that its project name is `slotforge-timing`. If the folder is wrong, it stops before running npm.
3. **Install dependencies:** `npm.cmd ci` downloads the dependencies specified by that folder's lockfile. Wait for it to finish. If it fails, the block does not start the app.
4. **Open SlotForge:** `npm.cmd start` reads SlotForge's start command from the same `package.json` and opens the development app. Leave this terminal open while using it.

`npm.cmd` is npm's Windows launcher. It also works when PowerShell blocks `npm.ps1`; you do not need to change the execution policy.

**Next time:** run the complete block again from any terminal location, or, if you have kept this same PowerShell session open and it is still in the verified SlotForge folder, enter `npm.cmd start`. A newly opened terminal does not remember this session's folder—use the full block again.

## Windows: Quick Build from any terminal folder

For beginners, double-clicking **build-windows-quick.bat** in the extracted app folder is still the easiest route. If you prefer a terminal, use the self-contained block below.

Install Node.js, extract the source, and copy the full folder path containing **package.json** and **build-windows-quick.bat**. Open PowerShell with **Windows + R → powershell.exe -NoProfile**. Paste the whole block at once; when it asks for a path, paste your app folder and press Enter. The terminal may initially be in any folder.

```powershell
& {
    $slotForgeFolder = (Read-Host "Paste the full extracted SlotForge folder path").Trim().Trim('"')
    if (-not $slotForgeFolder) { throw "No folder was entered. Run this block again and paste the folder path." }
    Set-Location -LiteralPath $slotForgeFolder -ErrorAction Stop
    if (-not (Test-Path -LiteralPath ".\package.json" -PathType Leaf)) { throw "Wrong folder: package.json is missing. Open the extracted app folder, not its parent or the ZIP." }
    $slotForgeProject = Get-Content -LiteralPath ".\package.json" -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($slotForgeProject.name -ne "slotforge-timing") { throw "This is another project, not SlotForge Timing. Run this block again with the correct folder." }
    & .\build-windows-quick.bat
}
```

Quick Build downloads any missing build dependencies and creates both executables in that app folder's **dist** directory. It **skips the automated checks**. Try the **Portable.exe** first; use the **Setup.exe** for long-term installation.

## Windows: build from the lockfile, without checks

This is an alternative to Quick Build for people who want to install the exact dependency versions in the lockfile. Install Node.js, extract the source, copy the app folder's full path, and open **PowerShell** with `powershell.exe -NoProfile`. Paste the complete block below. Supply the folder containing **package.json** when prompted; no particular starting folder is required.

```powershell
& {
    $slotForgeFolder = (Read-Host "Paste the full extracted SlotForge folder path").Trim().Trim('"')
    if (-not $slotForgeFolder) { throw "No folder was entered. Run this block again and paste the folder path." }
    Set-Location -LiteralPath $slotForgeFolder -ErrorAction Stop
    if (-not (Test-Path -LiteralPath ".\package.json" -PathType Leaf)) { throw "Wrong folder: package.json is missing. Open the extracted app folder, not its parent or the ZIP." }
    $slotForgeProject = Get-Content -LiteralPath ".\package.json" -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($slotForgeProject.name -ne "slotforge-timing") { throw "This is another project, not SlotForge Timing. Run this block again with the correct folder." }
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Read the error above." }
    npm.cmd run dist
}
```

The programs are written to **dist** inside the folder you supplied.

## Windows: run checks before building

Use this route to validate source changes. Install Node.js, extract the source, copy the full path of the app folder containing **package.json**, and open **PowerShell** with `powershell.exe -NoProfile`. Paste the complete block and supply that folder when asked. If the folder, dependency installation or checks fail, later steps do not run.

```powershell
& {
    $slotForgeFolder = (Read-Host "Paste the full extracted SlotForge folder path").Trim().Trim('"')
    if (-not $slotForgeFolder) { throw "No folder was entered. Run this block again and paste the folder path." }
    Set-Location -LiteralPath $slotForgeFolder -ErrorAction Stop
    if (-not (Test-Path -LiteralPath ".\package.json" -PathType Leaf)) { throw "Wrong folder: package.json is missing. Open the extracted app folder, not its parent or the ZIP." }
    $slotForgeProject = Get-Content -LiteralPath ".\package.json" -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
    if ($slotForgeProject.name -ne "slotforge-timing") { throw "This is another project, not SlotForge Timing. Run this block again with the correct folder." }
    npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed. Read the error above." }
    npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw "Checks failed. The build has not been started." }
    npm.cmd run dist
}
```

## Optional: download with Git

Git is optional; ZIP downloads work without it. If you have [Git](https://git-scm.com/) and Node.js installed, this sequence creates the source folder for you, so there is no extracted source path to find.

1. Press **Windows + R**, type **cmd.exe**, and press Enter. These commands use **Command Prompt**, not PowerShell. From an existing terminal, type `cmd.exe` first.
2. Run this command to move to your Windows user folder, whichever folder or drive the terminal started in:

```bat
cd /d "%USERPROFILE%"
```

3. Download the repository and enter it only if the download succeeds, then run Quick Build:

```bat
git clone https://github.com/theDutchmanJames/SlotForgeTiming.git SlotForgeTiming-source && cd /d "%USERPROFILE%\SlotForgeTiming-source" && build-windows-quick.bat
```

`%USERPROFILE%` is your Windows user folder, such as `C:\Users\James`. `cd /d` changes both the drive and folder. `&&` runs the next command only when the preceding command succeeds. If **SlotForgeTiming-source already exists**, cloning stops: use the existing app folder and one of the path-prompt blocks above, or choose a different new folder name. Do not enter bare npm commands in the original terminal folder.

## Linux and macOS: select the source folder before commands

Build on the operating system you are targeting. Native release jobs build and check packaged code on Windows, macOS and Linux. Timing-interface availability still differs by platform.

For **each block below**:

1. Install [Node.js](https://nodejs.org/) and extract the source ZIP.
2. Find the extracted app folder containing **package.json**, **package-lock.json** and the build scripts. Copy its full folder path from your file manager. On macOS, selecting the folder in Finder and pressing **Option + Command + C** copies its pathname.
3. Open Terminal from your application menu; any starting folder is fine.
4. Copy the **entire block** for the action you want, paste it, and press Enter. When it asks for the path, paste the folder path **without surrounding quotes** and press Enter. Spaces in the path are supported.

The `cd` command selects that folder. The Node check confirms this is SlotForge's project before later commands run. Every `&&` means “continue only if the previous step succeeded”.

**Linux Quick Build — skips checks:**

```sh
{
    printf 'Paste the full extracted SlotForge folder path: '
    IFS= read -r slotforge_source
    cd -- "$slotforge_source" &&
    node -e "if (require('./package.json').name !== 'slotforge-timing') { console.error('Wrong project folder'); process.exit(1); }" &&
    chmod +x build-linux.sh build-linux-quick.sh &&
    bash build-linux-quick.sh --no-install
}
```

**macOS Quick Build — skips checks:**

```sh
{
    printf 'Paste the full extracted SlotForge folder path: '
    IFS= read -r slotforge_source
    cd -- "$slotforge_source" &&
    node -e "if (require('./package.json').name !== 'slotforge-timing') { console.error('Wrong project folder'); process.exit(1); }" &&
    chmod +x build-mac.command build-mac-quick.command &&
    bash build-mac-quick.command --no-install
}
```

`chmod +x` gives extracted scripts permission to run. `--no-install` creates packages without installing the app. Outputs go to **dist** in the app folder: AppImage/Debian packages on Linux, DMG/ZIP on macOS. For builds with checks, use `build-linux.sh` or `build-mac.command` instead of the quick filename in the matching block.

**Start the source app on Linux or macOS:**

```sh
{
    printf 'Paste the full extracted SlotForge folder path: '
    IFS= read -r slotforge_source
    cd -- "$slotforge_source" &&
    node -e "if (require('./package.json').name !== 'slotforge-timing') { console.error('Wrong project folder'); process.exit(1); }" &&
    npm ci &&
    npm start
}
```

Leave that Terminal window open while using the development app. For a new Terminal window, repeat the full block; do not assume it opens in the app folder.

## Common first-time setup problems

| Message or situation | What to do |
| --- | --- |
| **node or npm is not recognised** | Install Node.js with npm/PATH enabled, then close and reopen the command window. Check `node --version` again. |
| **Cannot find package.json**, or **ENOENT** referring to that file | Select the extracted app folder containing package.json and package-lock.json. Run the complete path-prompt block again; do not continue with bare npm commands from the current folder. |
| **npm.ps1 cannot be loaded** in PowerShell | Use the PowerShell blocks containing `npm.cmd`. They avoid npm.ps1 and do not require changing the execution policy. |
| The ZIP shows source files but no executable | Extract it, then run the Quick Build file. Ready-made executables come from a release download or the build's **dist** folder. |
| The build has not finished yet | Keep its window open while dependencies download and packaging runs. A successful Windows build opens **dist**. |
| A build ends with an error | Keep the error message. Include it, your operating system and app version when opening an issue. |

## Development and testing

Use the self-contained **Windows: run checks before building** guide above for a complete validated build. The focused commands below are a **reference for contributors**, to run after selecting the app folder and installing its dependencies; they are not a standalone installation sequence.

| Command | Purpose |
| --- | --- |
| `npm test` | Complete automated regression chain. |
| `npm run test:postreview:electron` | Embedded charts and Arduino race ownership. |
| `npm run test:widget-preview:electron` | Preview/CSS and widget-surface verification. |
| `npm run test:charts:electron` | Chart editor integration checks. |

On Windows, use `npm.cmd` in place of `npm` when working in PowerShell.

Additional focused checks are listed in `package.json`. Electron checks use isolated profiles and simulated race data where supported. Native release jobs rerun regressions and packaged-code checks on Windows, macOS and Linux; software tests do not certify physical sensors or relays.

| Folder | Contents |
| --- | --- |
| `renderer/` | App screens, race systems, widgets and display code. |
| `native/` | Windows interface helpers and their source. |
| `firmware/` | SlotForge Arduino firmware. |
| `tests/` | Automated model and integration tests. |
| `tools/` | Build helpers and Electron verification scripts. |
| `docs/` | Feature, interface and validation documentation. |

[Back to the README](../README.md#how-to-install).
