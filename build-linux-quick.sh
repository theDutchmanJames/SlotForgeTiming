#!/usr/bin/env bash
# SlotForge Timing: the quick version of build-linux.sh.
# It skips the check of the app (the slow step) and does not download the building blocks when they are already here,
# so a second build takes a fraction of the time. The first time it still fetches them (it cannot build without them).
# Everything else is as in build-linux.sh, and the same options work here: --install, --no-install, --uninstall, --no-pause.
exec "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/build-linux.sh" --quick "$@"
