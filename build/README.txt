The app icon is here: icon.png (1024 x 1024, PNG), icon.svg (the same picture as a vector drawing, the source of icon.png) and icon.ico (the Windows icon, 16 to 256 pixels).
It is round: a square picture with see-through corners and a circle in the middle that touches the four sides.
build-windows.bat uses it for the installer, the portable program and the desktop shortcut.
On Linux, build-linux.sh uses the same icon.png for the AppImage, the .deb and the menu entry.
To change it: replace icon.png with a square PNG of at least 512 x 512 (1024 x 1024 is best: a Mac needs it for a sharp icon on a Retina screen) with see-through corners and make icon.ico from it. icon.svg is the drawing the 1024 icon is made from: change it and save it again as a 1024 x 1024 PNG with a see-through background.
Without icon.png, the standard Electron icon is used.
On a Mac, build-mac.command uses the same icon.png for the app and the .dmg (a Mac app icon must be a square PNG of at least 512 x 512; the electron-builder tool makes the Mac icon file from it).
