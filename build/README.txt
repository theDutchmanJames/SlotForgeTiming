SlotForge Timing application icon

Design: a flat red rounded tile with a white and charcoal chequered flag.
The transparent outer margin and rounded corners match the SlotForge family.

icon.svg is the editable vector master (256 x 256 viewBox).
icon.png is its transparent 1024 x 1024 export.
icon.ico contains PNG images at 16, 24, 32, 48, 64, 128 and 256 pixels.

Windows packaging uses icon.ico for the installer, portable app and shortcuts.
Linux packaging uses icon.png for the AppImage, .deb and menu entry.
macOS packaging converts icon.png for the application and disk image.
The PNG is also included in the packaged application and assigned to the main
and Live Race windows, so source builds use the same design.

When changing the design, export both PNG and ICO from icon.svg, preserving
transparency. Inspect the small sizes before replacing the generated files.
