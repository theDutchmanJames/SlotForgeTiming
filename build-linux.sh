#!/usr/bin/env bash
# SlotForge Timing: make the Linux programs, and install the app for yourself if you like.
# The Linux version of build-windows.bat. Run it from a terminal, or double-click it in your file manager and choose "Run in Terminal".
#
#   ./build-linux.sh               makes the programs, then asks if you want to install the app
#   ./build-linux.sh --install     makes the programs and installs the app without asking
#   ./build-linux.sh --no-install  only makes the programs (the files are in the "dist" folder)
#   ./build-linux.sh --uninstall   removes an app that was installed this way (your data is kept)
#   add --quick to skip the check of the app (the slow step) and the download of the building blocks when they are already here
#   add --no-pause to not wait for Enter at the end
#
# What it makes in "dist":
#   SlotForgeTiming-x.y.z.AppImage   runs by itself on most Linux systems, nothing to install
#   SlotForgeTiming-x.y.z.deb        for Debian, Ubuntu, Mint and the like: sudo apt install ./SlotForgeTiming-x.y.z.deb
# "Install" here means: the AppImage is copied to ~/.local/share/slotforge-timing and a menu entry (and a desktop
# shortcut, when there is a Desktop folder) is made. It needs no password and touches nothing outside your home folder.
#
# (SLOTFORGE_PROC, SLOTFORGE_LDCONFIG and SLOTFORGE_ALLOW_ROOT below are only there so the tests can pretend to be another system.)

APP_NAME="SlotForge Timing"
APP_ID="slotforge-timing"
PROC_DIR="${SLOTFORGE_PROC:-/proc}"

DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
INSTALL_DIR="$DATA_HOME/$APP_ID"
APPS_DIR="$DATA_HOME/applications"
DESKTOP_FILE="$APPS_DIR/$APP_ID.desktop"

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

# ---- what this computer needs ----

# The AppImage cannot start without libfuse2; where it is missing, the menu entry runs it by unpacking itself first.
has_fuse2() {
  local ldc="${SLOTFORGE_LDCONFIG:-ldconfig}"
  { "$ldc" -p 2>/dev/null || /sbin/ldconfig -p 2>/dev/null; } | grep -q 'libfuse\.so\.2'
}

# Some systems (for instance Ubuntu 24.04) do not let a program start its own sandbox. Electron then does not start at all
# unless it is told to run without it. The menu entry only gets that flag on systems where it is needed.
needs_no_sandbox() {
  [ "$(cat "$PROC_DIR/sys/kernel/apparmor_restrict_unprivileged_userns" 2>/dev/null)" = "1" ] && return 0
  [ "$(cat "$PROC_DIR/sys/kernel/unprivileged_userns_clone" 2>/dev/null)" = "0" ] && return 0
  [ "$(cat "$PROC_DIR/sys/user/max_user_namespaces" 2>/dev/null)" = "0" ] && return 0
  return 1
}

# The Trackmate is a serial device: on most systems you have to be in the group that may use serial ports.
serial_hint() {
  local group="" g
  for g in dialout uucp; do
    if getent group "$g" >/dev/null 2>&1; then group="$g"; break; fi
  done
  [ -n "$group" ] || return 0
  case " $(id -nG 2>/dev/null) " in
    *" $group "*) return 0 ;;
  esac
  say ""
  say " To use the Trackmate over USB you must be allowed to use serial ports. Run this once, then log out and in again:"
  say "   sudo usermod -aG $group \$USER"
}

desktop_dir() {
  local d=""
  if command -v xdg-user-dir >/dev/null 2>&1; then d="$(xdg-user-dir DESKTOP 2>/dev/null)"; fi
  [ -n "$d" ] && [ "$d" != "$HOME" ] || d="$HOME/Desktop"
  [ -d "$d" ] && printf '%s' "$d"
}

# ---- install and uninstall (for this user only) ----

install_app() {
  local appimage="$1" icon="$ROOT/build/icon.png" file exec_line desk
  file="$(basename "$appimage")"
  case "$INSTALL_DIR" in
    *[\"\$\`\\%]*) say " Your home folder has a character in its name that a menu entry cannot hold, so the app was not installed."
                  say " You can still run it: $appimage"
                  return 1 ;;
  esac
  mkdir -p "$INSTALL_DIR" "$APPS_DIR" || return 1
  cp -f "$appimage" "$INSTALL_DIR/$file" || return 1
  chmod +x "$INSTALL_DIR/$file"
  if [ -f "$icon" ]; then cp -f "$icon" "$INSTALL_DIR/icon.png"; fi

  exec_line="\"$INSTALL_DIR/$file\""
  if needs_no_sandbox; then exec_line="$exec_line --no-sandbox"; say " This system does not allow the app's own sandbox, so the menu entry starts it with --no-sandbox."; fi
  if ! has_fuse2; then exec_line="env APPIMAGE_EXTRACT_AND_RUN=1 $exec_line"; say " libfuse2 was not found, so the menu entry unpacks the app each time it starts (a bit slower). Installing libfuse2 avoids that."; fi

  write_desktop_file "$DESKTOP_FILE" "$exec_line"
  if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true; fi
  say " Installed: $INSTALL_DIR/$file"
  say " It is in your applications menu as \"$APP_NAME\"."

  if desk="$(desktop_dir)"; then
    write_desktop_file "$desk/$APP_ID.desktop" "$exec_line"
    chmod +x "$desk/$APP_ID.desktop"
    if command -v gio >/dev/null 2>&1; then gio set "$desk/$APP_ID.desktop" metadata::trusted true >/dev/null 2>&1 || true; fi
    say " A shortcut was put on your desktop (if it shows a warning, right-click it and choose Allow Launching)."
  fi
  say " To remove it again: ./build-linux.sh --uninstall"
}

write_desktop_file() {
  local path="$1" exec_line="$2" icon_line=""
  if [ -f "$INSTALL_DIR/icon.png" ]; then icon_line="Icon=$INSTALL_DIR/icon.png"; fi
  {
    printf '%s\n' "[Desktop Entry]" "Type=Application" "Name=$APP_NAME" "Comment=Slot car lap timer and lap counter" \
      "Exec=$exec_line" "Terminal=false" "Categories=Utility;" "Keywords=slot car;lap timer;racing;"
    if [ -n "$icon_line" ]; then printf '%s\n' "$icon_line"; fi
  } > "$path"
}

uninstall_app() {
  local desk
  rm -rf "$INSTALL_DIR"
  rm -f "$DESKTOP_FILE"
  if desk="$(desktop_dir)"; then rm -f "$desk/$APP_ID.desktop"; fi
  if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$APPS_DIR" >/dev/null 2>&1 || true; fi
  say " The app is removed from this account (the menu entry, the desktop shortcut and the program)."
  say " Your races and settings are kept in ~/.config/$APP_ID. Delete that folder too if you want them gone."
}

# ---- the steps ----

main() {
  local arg version node_major appimage deb answer
  for arg in "$@"; do
    case "$arg" in
      --install) MODE="yes" ;;
      --no-install) MODE="no" ;;
      --uninstall) MODE="uninstall" ;;
      --quick) QUICK=1 ;;
      --no-pause) PAUSE=0 ;;
      -h|--help) sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'; exit 0 ;;
      *) fail "Unknown option: $arg  (see ./build-linux.sh --help)" ;;
    esac
  done

  ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || fail "Could not find the folder of this file."
  cd "$ROOT" || fail "Could not open $ROOT"

  if [ "$(id -u)" = "0" ] && [ -z "${SLOTFORGE_ALLOW_ROOT:-}" ]; then
    fail "Please run this as yourself, not with sudo or as root: the app would be installed into the root account and leave files you cannot change."
  fi

  if [ "$MODE" = "uninstall" ]; then
    say ""
    uninstall_app
    wait_for_enter
    exit 0
  fi

  say ""
  say " This makes the files you can share:"
  say "   dist/SlotForgeTiming-x.y.z.AppImage   (runs by itself, nothing to install)"
  say "   dist/SlotForgeTiming-x.y.z.deb        (for Debian, Ubuntu, Mint and the like)"
  say " It needs Node.js (https://nodejs.org) and an internet connection the first time. It takes a few minutes."
  say ""

  command -v node >/dev/null 2>&1 && command -v npm >/dev/null 2>&1 \
    || fail "Node.js was not found. Install the LTS version from https://nodejs.org (or with your package manager), then run this file again."
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
  appimage="$ROOT/dist/SlotForgeTiming-$version.AppImage"
  deb="$ROOT/dist/SlotForgeTiming-$version.deb"
  rm -f "$appimage" "$deb"
  if ! npm run dist:linux; then
    # the .deb needs one more helper to be downloaded; the AppImage is the one that matters
    if [ -f "$appimage" ]; then
      say ""
      say " The AppImage was made, but the .deb was not (see the messages above). The AppImage is all you need."
    else
      fail "Something went wrong, see the messages above."
    fi
  fi
  [ -f "$appimage" ] || fail "The build finished but $appimage is not there. See the messages above."
  chmod +x "$appimage"

  say ""
  say " Ready. The files are in the \"dist\" folder:"
  say "   $appimage"
  if [ -f "$deb" ]; then say "   $deb   (install with: sudo apt install \"$deb\")"; fi

  case "$MODE" in
    yes) answer="y" ;;
    no) answer="n" ;;
    *) answer="n"
       if [ -t 0 ]; then
         say ""
         read -r -p " Install $APP_NAME for you now (menu entry and desktop shortcut, no password needed)? [Y/n] " answer || answer="n"
         case "$answer" in ''|y|Y|yes|YES|Yes) answer="y" ;; *) answer="n" ;; esac
       fi ;;
  esac
  if [ "$answer" = "y" ]; then
    say ""
    install_app "$appimage" || say " The app was not installed."
  else
    say ""
    say " Not installed. To run it: \"$appimage\"   (to install it later: ./build-linux.sh --install)"
  fi

  serial_hint
  if [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ] && command -v xdg-open >/dev/null 2>&1; then xdg-open "$ROOT/dist" >/dev/null 2>&1 & fi
  say ""
  wait_for_enter
  exit 0
}

# (when the file is loaded by another script, for the tests, nothing runs)
if [ "${BASH_SOURCE[0]}" = "$0" ]; then main "$@"; fi
