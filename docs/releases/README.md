# Release notes

Each release has its notes here (`vX.Y.Z.md`), and the same text is the GitHub release description.

## What's new: shown in the app

When Timing starts and finds a newer version, its update window shows the **What's new** section of
that release's notes. Timing reads only the lines under the heading `## What's new`, up to the next
heading, and shows them as plain text (bold, links and code marks are removed).

Keep it for users, short and concise:

- **At most six lines.** Longer lines are cut at about 280 characters.
- **One change per line**, best as `- **Name:** what it means for you.`
- **No "under the hood" changes** (tests, builds, code): put those under another heading, such as
  `## Verification` or `## Details`, which the app does not show.

```markdown
## What's new

- **Lane Desk:** the controls under the race screen, a card for every lane.
- **Race report PDF:** a page for every driver, in Colour or Monochrome.
```

The update window also needs the download for each copy attached to the release with its usual name
(`SlotForgeTiming-X.Y.Z-Setup-x64.exe`, `-Portable-x64.exe`, `-mac-universal.dmg`,
`-linux-x86_64.AppImage`, `-linux-amd64.deb`, …). A copy whose file is not attached yet (macOS and
Linux follow a little later) is told about the new version once it is there.
