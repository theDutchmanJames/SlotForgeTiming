@echo off
setlocal
cd /d "%~dp0"
title SlotForge Timing - make the Windows programs
echo.
echo  This makes the files you can share:
echo    dist\SlotForge Timing-x.y.z-Setup.exe     (installs the app, with a desktop shortcut)
echo    dist\SlotForge Timing-x.y.z-Portable.exe  (runs by double-clicking, nothing is installed)
echo  It needs Node.js (https://nodejs.org) and an internet connection the first time. It takes a few minutes.
echo  To skip the check of the app (the slow step), use build-windows-quick.bat instead.
echo.
set "QUICK=0"
if /i "%~1"=="quick" set "QUICK=1"
if /i "%~1"=="/quick" set "QUICK=1"
if /i "%~1"=="--quick" set "QUICK=1"
if "%QUICK%"=="1" echo  Quick build: the check of the app is skipped, and so is getting the building blocks when they are already here.
if "%QUICK%"=="1" echo  (Use the normal build for a version that has not been checked yet: it catches a broken app before it is made.)
if "%QUICK%"=="1" echo.
where node >nul 2>nul
if errorlevel 1 (
  echo  Node.js was not found. Install the LTS version from https://nodejs.org, then run this file again.
  pause
  exit /b 1
)
if not exist "build\icon.png" echo  Note: there is no build\icon.png, so the standard Electron icon is used.
echo.
echo  Step 1 of 3: getting the building blocks...
if not "%QUICK%"=="1" goto getblocks
if not exist "node_modules\electron\package.json" goto getblocks
if not exist "node_modules\electron-builder\package.json" goto getblocks
if not exist "node_modules\flag-icons\package.json" goto getblocks
echo  Quick: they are already here, so this step is skipped.
goto checkapp
:getblocks
if "%QUICK%"=="1" echo  Quick: they are not all here yet, so they are fetched this one time.
call npm install --save-dev electron electron-builder
if errorlevel 1 goto failed
call npm install flag-icons
if errorlevel 1 goto failed
:checkapp
echo.
echo  Step 2 of 3: checking the app...
if "%QUICK%"=="1" goto skipcheck
call npm test
if errorlevel 1 goto failed
goto makeapp
:skipcheck
echo  Quick: the check is skipped.
:makeapp
echo.
echo  Step 3 of 3: making the programs...
call npm run dist
if errorlevel 1 goto failed
echo.
echo  Ready. The files are in the "dist" folder.
start "" "%~dp0dist"
pause
exit /b 0
:failed
echo.
echo  Something went wrong, see the messages above.
pause
exit /b 1
