#!/usr/bin/env bash
# SlotForge Timing: make the Mac programs, and install the app for yourself if you like.
# The Mac version of build-windows.bat and build-linux.sh. Double-click it in Finder (it opens Terminal), or run it from a terminal.
#
#   ./build-mac.command               makes the programs, then asks if you want to install the app
#   ./build-mac.command --install     makes the programs and installs the app without asking
#   ./build-mac.command --no-install  only makes the programs (the files are in the "dist" folder)
#   ./build-mac.command --uninstall   removes an app that was installed this way (your data is kept)
#   add --quick to skip the check of the app (the slow step) and the download of the building blocks when they are already here
#   add --no-pause to not wait for Enter at the end
#
# What it makes in "dist" (one app for Apple Silicon and Intel Macs):
#   SlotForgeTiming-x.y.z-mac.dmg   open it and drag SlotForge Timing onto Applications
#   SlotForgeTiming-x.y.z-mac.zip   the same app in a zip, nothing to install
# "Install" here means: the app is copied to /Applications (or to the Applications folder in your home folder, when you may
# not write to /Applications). It needs no password and touches nothing else.
#
# (SLOTFORGE_APPS and SLOTFORGE_ALLOW_ROOT below are only there so the tests can pretend to be another system.)
# This file is written for the bash that comes with macOS (version 3.2): no newer bash features in here.

APP_NAME="SlotForge Timing"
APP_BUNDLE="$APP_NAME.app"
APPS_DIR="${SLOTFORGE_APPS:-/Applications}"

MODE="ask"   # ask | yes | no | uninstall
PAUSE=1
QUICK=0     # 1: skip the check of the app and the download of the building blocks that are already here

say() { printf '%s\n' "$*"; }

# The three building blocks that step 1 gets: with them all here, a quick build does not need the internet at all.
blocks_here() { [ -f node_modules/electron/package.json ] && [ -f node_modules/electron-builder/package.json ] && [ -f node_modules/flag-icons/package.json ]; }

wait_for_enter() {
  if [ "$PAUSE" = 1 ] && [ -t 0 ]; then read -r -p " Press Enter to close. " _ || true; fi
}

fail() {
  say ""
  say " $*"
  wait_for_enter
  exit 1
}

# ---- what is where ----

is_running() { pgrep -x "$APP_NAME" >/dev/null 2>&1; }

# The folder the app goes into: /Applications, or Applications in your home folder when /Applications is not yours to write in.
install_dir() {
  if [ -d "$APPS_DIR" ] && [ -w "$APPS_DIR" ]; then printf '%s' "$APPS_DIR"; else printf '%s' "$HOME/Applications"; fi
}

# The app that the build made (one app for both kinds of Mac; the other folders are for a build of one kind only).
built_app() {
  local d
  for d in mac-universal mac-arm64 mac; do
    if [ -d "$ROOT/dist/$d/$APP_BUNDLE" ]; then printf '%s' "$ROOT/dist/$d/$APP_BUNDLE"; return 0; fi
  done
  return 1
}

# ---- install and uninstall (for this user only) ----

install_app() {
  local src="$1" dir dest
  dir="$(install_dir)"
  dest="$dir/$APP_BUNDLE"
  if is_running; then
    say " $APP_NAME is open. Quit it (Cmd+Q) and run ./build-mac.command --install again."
    return 1
  fi
  mkdir -p "$dir" || return 1
  rm -rf "$dest" || { say " The old copy in $dir could not be replaced."; return 1; }
  # ditto copies an app the way Finder does (links, permissions and all)
  if command -v ditto >/dev/null 2>&1; then ditto "$src" "$dest" || return 1; else cp -R "$src" "$dest" || return 1; fi
  # a program you made yourself has no "downloaded from the internet" mark, but a copy that came in a zip has: take it off, so the app just opens
  if command -v xattr >/dev/null 2>&1; then xattr -dr com.apple.quarantine "$dest" >/dev/null 2>&1 || true; fi
  # an app without a valid signature does not start on a Mac with an Apple chip: sign it for this Mac (a signature that is already good is left alone)
  if command -v codesign >/dev/null 2>&1 && ! codesign --verify --deep "$dest" >/dev/null 2>&1; then
    codesign --force --deep --sign - "$dest" >/dev/null 2>&1 || say " Note: the app could not be signed for this Mac. If it will not open, see the README."
  fi
  say " Installed: $dest"
  say " Open it from Launchpad, from Finder (Applications) or with Spotlight (Cmd+Space). To keep it in the Dock, drag its icon there."
  case "$dir" in
    "$HOME/Applications") say " (It is in the Applications folder in your home folder, because you may not write in /Applications.)" ;;
  esac
  say " To remove it again: ./build-mac.command --uninstall"
}

uninstall_app() {
  local dir found=0
  if is_running; then say " $APP_NAME is open. Quit it (Cmd+Q) and run ./build-mac.command --uninstall again."; return 1; fi
  for dir in "$APPS_DIR" "$HOME/Applications"; do
    if [ -d "$dir/$APP_BUNDLE" ]; then
      if rm -rf "$dir/$APP_BUNDLE"; then say " Removed: $dir/$APP_BUNDLE"; found=1
      else say " Could not remove $dir/$APP_BUNDLE (drag it to the Bin yourself)."; return 1; fi
    fi
  done
  if [ "$found" = 0 ]; then say " The app was not installed this way: nothing to remove."; fi
  say " Your races and settings are kept in ~/Library/Application Support/slotforge-timing. Delete that folder too if you want them gone."
}

# ---- the steps ----

main() {
  local arg version node_major app dmg zip answer
  for arg in "$@"; do
    case "$arg" in
      --install) MODE="yes" ;;
      --no-install) MODE="no" ;;
      --uninstall) MODE="uninstall" ;;
      --quick) QUICK=1 ;;
      --no-pause) PAUSE=0 ;;
      -h|--help) sed -n '2,18p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
      *) fail "Unknown option: $arg  (see ./build-mac.command --help)" ;;
    esac
  done

  [ "$(uname -s)" = "Darwin" ] || fail "This file makes the programs for a Mac and has to be run on a Mac. For Windows use build-windows.bat, for Linux build-linux.sh."

  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || fail "Could not find the folder of this file."
  cd "$ROOT" || fail "Could not open $ROOT"

  if [ "$(id -u)" = "0" ] && [ -z "${SLOTFORGE_ALLOW_ROOT:-}" ]; then
    fail "Please run this as yourself, not with sudo or as root: the app would be installed for the root account and leave files you cannot change."
  fi

  if [ "$MODE" = "uninstall" ]; then
    say ""
    uninstall_app || true
    wait_for_enter
    exit 0
  fi

  say ""
  say " This makes the files you can share:"
  say "   dist/SlotForgeTiming-x.y.z-mac.dmg   (open it and drag the app onto Applications; for Apple Silicon and Intel Macs)"
  say "   dist/SlotForgeTiming-x.y.z-mac.zip   (the same app in a zip, nothing to install)"
  say " It needs Node.js (https://nodejs.org) and an internet connection the first time. It takes a few minutes."
  say " If macOS offers to install the command line developer tools along the way, choose Install, then run this file again."
  say ""

  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 \
    || fail "Node.js was not found. Install the LTS version from https://nodejs.org, then run this file again."
  node_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null)"
  case "$node_major" in
    ''|*[!0-9]*) fail "Could not tell which version of Node.js is installed." ;;
  esac
  [ "$node_major" -ge 18 ] || fail "Node.js $node_major is too old. Install the LTS version from https://nodejs.org, then run this file again."
  version="$(node -p "require('./package.json').version" 2>/dev/null)" || fail "Could not read the version from package.json."

  [ -f build/icon.png ] || say " Note: there is no build/icon.png, so the standard Electron icon is used."
  say ""
  if [ "$QUICK" = 1 ]; then
    say " Quick build: the check of the app is skipped, and so is getting the building blocks when they are already here."
    say " (Use the normal build for a version that has not been checked yet: it catches a broken app before it is made.)"
    say ""
  fi
  say " Step 1 of 3: getting the building blocks..."
  if [ "$QUICK" = 1 ] && blocks_here; then
    say " Quick: they are already here, so this step is skipped."
  else
    if [ "$QUICK" = 1 ]; then say " Quick: they are not all here yet, so they are fetched this one time."; fi
    npm install --save-dev electron electron-builder || fail "Something went wrong, see the messages above."
    npm install flag-icons || fail "Something went wrong, see the messages above."
  fi
  say ""
  say " Step 2 of 3: checking the app..."
  if [ "$QUICK" = 1 ]; then
    say " Quick: the check is skipped."
  else
    npm test || fail "Something went wrong, see the messages above."
  fi
  say ""
  say " Step 3 of 3: making the programs..."
  dmg="$ROOT/dist/SlotForgeTiming-$version-mac.dmg"
  zip="$ROOT/dist/SlotForgeTiming-$version-mac.zip"
  rm -f "$dmg" "$zip"
  rm -rf "$ROOT/dist/mac" "$ROOT/dist/mac-arm64" "$ROOT/dist/mac-universal" # (what an earlier run left must not be mistaken for the result of this one)
  if ! npm run dist:mac; then
    # the .dmg and the .zip are made from the app: when the app is there, it is what matters
    if built_app >/dev/null; then
      say ""
      say " The app was made, but not every file (see the messages above). The app is all you need."
    else
      fail "Something went wrong, see the messages above."
    fi
  fi
  app="$(built_app)" || fail "The build finished but the app is not there. See the messages above."

  say ""
  say " Ready. The files are in the \"dist\" folder:"
  if [ -f "$dmg" ]; then say "   $dmg"; fi
  if [ -f "$zip" ]; then say "   $zip"; fi
  say " The app is not signed with a paid Apple certificate. On another Mac, the first time: right-click the app, choose Open, then Open"
  say " again (macOS 15 and later: System Settings > Privacy & Security > Open Anyway). On the Mac that made it, it just opens."

  case "$MODE" in
    yes) answer="y" ;;
    no) answer="n" ;;
    *) answer="n"
       if [ -t 0 ]; then
         say ""
         read -r -p " Install $APP_NAME for you now (in $(install_dir), no password needed)? [Y/n] " answer || answer="n"
         case "$answer" in ''|y|Y|yes|YES|Yes) answer="y" ;; *) answer="n" ;; esac
       fi ;;
  esac
  if [ "$answer" = "y" ]; then
    say ""
    install_app "$app" || say " The app was not installed."
  else
    say ""
    say " Not installed. To install it later: ./build-mac.command --install   (or open the .dmg and drag the app onto Applications)"
  fi

  if command -v open >/dev/null 2>&1; then open "$ROOT/dist" >/dev/null 2>&1 || true; fi # (Finder shows the folder; open returns at once)
  say ""
  wait_for_enter
  exit 0
}

# (when the file is loaded by another script, for the tests, nothing runs)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
