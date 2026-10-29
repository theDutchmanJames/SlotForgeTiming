# Content packs — API 1

Content packs are versioned collections for the existing import/export system. They add a reusable library and compatibility metadata, but do not add new app functionality. Find them under **App Settings → Import and Export → Content Packs**.

Separately installed executable extensions use the [plugin runtime](PLUGIN-RUNTIME.md), with APIs for [timing interfaces](PLUGIN-TIMING.md), [widgets, pages and tools](PLUGIN-DISPLAYS.md), and [race rules](PLUGIN-RULES.md). Third-party plugin code remains outside SlotForge's source and standard build. Content Packs remain data-only: sharing a layout does not install or activate its code-plugin dependencies.

## Using a pack

1. Open **Install or update → Choose content pack** and select a `.slotforge-pack` file.
2. Review its name, author, version and included content, then select **Install pack**. Author and licence are supplied by the pack creator; they are not verified publisher identities.
3. In **Installed packs**, select **Add to my content**. SlotForge adds editable copies to its normal editors, with new IDs and links between included items preserved. Select a copied layout in Race Setup, or a copied system preset in the appropriate system selector.
4. A theme is separate: choose **Apply theme** to make its six colours your Custom app theme.

Installing or enabling a pack never automatically applies its presets or theme. Adding content again makes another set of copies. Disabling, updating, rolling back or removing a pack changes its library entry only: existing copies and applied themes remain yours. Edit or delete them in their normal editors.

Pack changes are locked during a race and results review. Finish and finalise the race first.

Try [the example club pack](content-packs/example.slotforge-pack). It supplies a timing layout, its comparison chart and a teal theme.

## Creating and sharing

Use **Create and share**, enter a name, author, version and sharing terms, then tick saved content to include. No terminal or JSON editing is needed. The current app colour palette can also be included. Choose a stable Pack ID, such as `your-club.race-night`; updates keep that ID and increase the version, for example `1.0.0` to `1.1.0`.

Linked charts, leaderboard designs and image sets are included automatically. Personal database links must be removed before exporting: use a manual pace reference instead of a named track, remove driver-specific audio conditions, and remove team or race-class references from shared designs. SlotForge rejects unsupported or missing dependencies instead of binding them to another user's database.

Supported content:

- Race Screen layouts, leaderboard row designs, chart designs and Widget Builder designs.
- Image sets containing embedded PNG, JPEG, WebP or GIF images.
- Audio sets with speech text and embedded MP3, WAV, OGG, WebM or MP4 audio.
- Fuel, Penalty, Damage, Tyre Wear, Safety Car, Push & Save and Weather System presets.
- App colour palettes: background, panels, text, quiet text, lines and accent.

Only distribute media and content you have permission to share. The pack's licence field describes its sharing terms; it does not grant rights to other people's material.

## Updates, backups and recovery

Choose a newer file through **Install or update**. Only a higher version with the same Pack ID replaces a library entry. The previous pack version is retained for rollback. There are no automatic downloads or updates.

The library is a separate `.packs.json` file beside the database. **Export pack** backs up one installed pack. A complete database backup includes any copies already added, but does not include the installed library itself. Export packs separately when moving computers.

Library writes keep a `.bak` safety copy. If the library becomes unreadable, it is not silently overwritten and existing app content remains available. **Compatibility and recovery → Restore library backup** restores a readable backup and preserves the damaged file under a timestamped name. **Disable all packs** stops library use; it does not undo copied content or theme changes.

## File format and limits

The extension contains UTF-8 JSON, not a ZIP archive. Its top-level structure is:

```json
{
  "format": "slotforge-content-pack",
  "apiVersion": 1,
  "manifest": {
    "id": "your-club.teal-theme",
    "name": "Club Teal",
    "version": "1.0.0",
    "author": "Your club",
    "description": "A colour palette for club nights.",
    "license": "Your sharing terms",
    "minAppVersion": "1.99.2"
  },
  "items": {},
  "themes": [{
    "id": "teal",
    "name": "Teal",
    "colors": {
      "bg": "#171b21", "panel": "#222831", "ink": "#e8e6e1",
      "muted": "#98a0ab", "line": "#343b47", "accent": "#43c9b0"
    }
  }]
}
```

`maxAppVersion` is optional. All versions use `major.minor.patch`. API versions must match; incompatible packs cannot be applied. The first implementation accepts up to 32 MB per pack, 300 content items, 20 palettes, 40 installed packs and 128 MB for the library including retained versions. Individual embedded media values are limited to 16 MB of encoded text. Layouts allow 300 widgets; compositions allow 80 nodes and six nested levels. Keep packs small for convenient sharing.

Within the data-only `.slotforge-pack` format, scripts, arbitrary formulas, executable entry points, HTML, CSS, SVG, external media paths and network URLs are not supported. Packs cannot add new engine rules, hardware drivers or app pages. They do not receive filesystem, network, race-control or hardware APIs. Normal app code remains responsible for interpreting their validated content.

Implementation: `contentpacks.js` validates and manages the library; `packipc.js` exposes explicit main-window operations; `renderer/packsui.js` provides the page. Copying uses the existing dependency-remapping importer. New content categories should be introduced with explicit validation, dependency handling and tests before being added to API 1.
