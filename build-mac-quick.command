#!/usr/bin/env bash
# SlotForge Timing: the quick version of build-mac.command. Double-click it in Finder (it opens Terminal), or run it from a terminal.
# It skips the check of the app (the slow step) and does not download the building blocks when they are already here,
# so a second build takes a fraction of the time. The first time it still fetches them (it cannot build without them).
# Everything else is as in build-mac.command, and the same options work here: --install, --no-install, --uninstall, --no-pause.
# This file is written for the bash that comes with macOS (version 3.2): no newer bash features in here.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-mac.command" --quick "$@"
