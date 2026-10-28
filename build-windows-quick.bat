@echo off
rem SlotForge Timing: the quick version of build-windows.bat.
rem It skips the check of the app (the slow step) and does not download the building blocks when they are already here,
rem so a second build takes a fraction of the time. The first time it still fetches them (it cannot build without them).
call "%~dp0build-windows.bat" quick
