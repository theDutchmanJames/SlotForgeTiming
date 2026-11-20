# Remake inventory (2.4.0)

Which screens were built "to work" and would do well with a **remake**, not just a restyle. A remake rethinks what the screen
is for, its flow and its features, and checks for missing features to suggest (each one is approved before it is added). A
**redesign** keeps the function and only changes the look. Line numbers are from commit 37920e4.

Verdicts: **Remake** · **Rework** (a smaller remake of one part) · **Fine**.

## Tier 1: the biggest wins

### 1. After the race: single race, heats and championships (the flow) · Remake · **Done (2.4.0, "Chequered Flag")**
Race over, a championship race with the title fight, the break between heats and Event over replace the frozen race page; points are awarded on
Finalize with Undo; Race again, Go to round N; Delete all data goes Home. Still open from this item: re-run or skip a heat, a no-show or substitute,
correcting a result after Finalize (with Results and Records, #8).
This is a flow across several screens, not one screen.
- **Single race.** Finalize runs `closeReview()` (renderer/race.js:2532), which brings back the race page: frozen widgets,
  the director desk, Stop greyed out. The only sign that it is over is a status line (race.js:2968). The page has no results,
  no podium and no PDF (the PDF exists only under Database › Results). After Discard the same page stays with "The race was
  deleted".
- **Heats.** Each heat is reviewed and finalized, then a "Next up" card offers "Start heat N" (race.js:2171). The standings
  between heats are an "Overall result" table at the very bottom of the page (race.js:1108). After the last heat you get the
  same frozen page. Stop during the break ends the whole event. There is no re-run, skip, no-show or substitute.
- **Championships.** After a race a points panel says "Not awarded yet". The points only count after **Award these points**
  (championshipui.js:839). Going Back to Home without awarding gives no warning. The standings live only in Database ›
  Results › Championships. The next round is loaded by Home itself, and there is no "Next race" button after a race.
- **Ideas:** a *Race Over* screen (classification, podium, Print report, Race again, Home); a *Between heats* screen
  (standings with the points just added, who's next, Start heat N); after a championship race, the points shown and awarded
  in the flow (or awarded by default, with Undo), the standings with movement arrows, then *Next round*; the race report on
  the second screen at the same time.

### 2. Race window during the race · Remake · **Done (2.4.0, "Race Control")**
The bar on top (state, flag stripe, clock, the controls whatever the layout has, Tools), a track call as a decision (Resume racing, Give or Take a lap,
Red flag, a note in the log), the order as a timing tower, the race screen as a monitor (Hide, S, M, L), a default layout for eight lanes. Still open:
the Race Director as folders (App Settings) next to the Lane Desk.
- Start, Pause, Yellow and Red exist only as widgets in the layout (widgets.js:2114) or as keys. A layout without them leaves
  only the keyboard. The toolbar has Stop but no Start.
- There are two Race Director forms, lane cards or folders, switched in App Settings. Every panel exists twice.
- "Simulated cars" is on the live toolbar, one mis-click from fake laps in a real race.
- A track call can only be dismissed or given a penalty point (race.js:2097). There is no "give the lap back" and no reason
  to note.
- The default layout has 6 lanes, while the app supports 8.
- **Ideas:** a fixed control strip, a clear race-state banner, a full Race Director decision dialog.

### 3. Race Setup form and start checks · Remake · **Done (2.4.0, "Setup Sheet" and "Status Lights")**
The race in one line, the sections regrouped (The race, Heats with its scoring, Start and flags with Track Call together, Race systems with On at the
start per row), six kinds, the tracks as cards; the check before the start is the drop-down of the status lights, on every page.
- About 100 fields. "Race Settings" holds 36 of them, mixing length, heat scoring, start lights, red flag, pit hold and
  track call (schema.js around 600-1380). Heat scoring is not in Heats.
- The session type mixes format and kind (race, heats, endurance, tokens). The engine still knows a `timed` type that is
  not offered.
- Problems show only *after* Start: an alert, then back to Home (race.js:552, 663, 824, 975). A heat plan that does not fit
  is silently replaced by a newly generated one (race.js:967).
- **Ideas:** choose the format first (Practice, Qualifying, Single race, Heats + finals, Endurance) and show only its fields;
  presets; a summary; a pre-race checklist on Home (lanes, cars, systems, hardware) before the race window opens.

### 4. Timing Hardware area · Remake of the flow · **Done (2.4.0, "Timing Desk")**
- The "Other" tab is an empty page (app.js:536). oXigen Digital is a "Coming." placeholder (app.js:547).
- Connecting "does not put it in use" (app.js:485), so the "not counting laps" banner has to patch it.
- Each page works differently: Trackmate saves at once and loses its serial settings when a port is picked, Parallel Port
  has Save/Undo, Arduino has its fields locked until connected. The lane count is in two places.
- **Ideas:** one "Connect & use" action, one status card per interface (connected, lanes seen, last hit), the same page frame
  everywhere (Parallel Port is the best model).

### 5. DS Electronics page · Remake · **Done (2.4.0, part of "Timing Desk")**
- It is a protocol-capture tool for the developer shown as a setup page: "How to make a capture", "physical verification
  pending" (dsui.js:322-395).
- It has no lane lights and no sensor check, only raw hex. Its serial settings last only for this app session.
- **Ideas:** lane lights with the measured lap times, lane mapping as on Trackmate, the capture tools behind a Diagnostics
  switch.

### 6. Audio set editor · Remake · **Done (2.4.0, "Commentary Booth")**
- The old page (131 calls in fieldsets) is built first and then moved into the new shell, and its labels are rewritten text
  node by text node (audiostudio.js:99-190). Almost every edit rebuilds the whole editor, so the scroll position is lost.
- The presets (Essential, Club, Broadcast), the main choice for most people, are tucked away under "Only if you need them".
- **Ideas:** presets first, then a short list of the calls; a "play a sample race" button; how each driver's name is said
  (or a recorded name per driver); a choice of speaker (`setSinkId`).

### 7. Widget Builder and canvas editor · Remake · **Done (2.4.0, "Widget Workshop")**
- Two editors for one idea, with different rules: a simple picture allows one condition, the canvas editor allows many.
- A widget is *copied* into a layout, so no "used in N layouts" and no "update the copies". Chart designs are linked,
  which makes the two inconsistent.
- Saving dead-ends with "Add it from My widgets in the Layout Editor" (widgetstudio.js:972). Colours and the place are set
  elsewhere again.
- The preview offers lanes 1-4 only (widgetbuilder.js:234).
- **Ideas:** one editor with a simple mode, linked widgets, "Add to layout…" from the builder.

### 8. Results and Records · Remake · **Done (2.4.0, "Record Book")**
- Each folder (track records, personal bests, sessions) has its own "Page N" paging. There is no search and no filter by
  driver, track, date or championship. Two code paths (SQLite and the old one) patched together.
- No way to correct a result after Finalize, only delete.
- **Ideas:** a filter bar, a driver's history across races, the history of a track record, correct a finalized result.

### 9. Paddock connection screens · Remake · **Done (2.4.0, "Paddock Pit Lane")**
- Plumbing shown as buttons: Find local services, Retry, Forget service connection, Refresh transfers, Check/retry.
- The way in is in three places (Database › Slotcars, App Settings › Connections, Import and Export). Help has about 14
  recovery articles for it.
- **Ideas:** one Paddock hub with a status summary and one "Fix it" action.

## Tier 2: rework one part

| Screen | What to rework | Ideas |
|---|---|---|
| Lane Check (sensor test) · **Done (2.4.0)** | Not connected? It says where to go but has no Connect button. A sensor on the wrong lane is only described. | Fix "lane 2 lit lane 3: swap?" in the dialog; test pit sensors, track call and track power |
| Setup guide on Home · **Done (2.4.0)** | The hardware step sends you to App Settings with no way back. No lane-mapping step. Cars step skipped with the shared library. | Connect inside the guide, a lane-mapping step, an audio step |
| Detected hardware card · **Done (2.4.0, "Plugged In")** | "Not timing hardware" can never be undone (`hwIgnored`, app.js:436). Errors send you to App Settings. | A "Forgotten devices" list; the reason shown on the card |
| Balance of Power, Time Tokens · **Done (2.4.0, "Profile Cards")** | One global setting each, unlike every other system (named, per setup). No "discard changes?" when leaving. | Named profiles chosen in the setup |
| Multi-Class, Virtual Rival · **Done (2.4.0, "Entry Classes")** | Who is in which class is saved inside the reusable system. Virtual Rival is chosen on the driver, and errors show only at Start. | Classes from the entry list of the race |
| Rotation Setups · **Done (2.4.0, "Rotation Board")** | Built on a typed lane count, not the track's. | Lane fairness per driver; build from the entry list |
| Finalize review · **Done (2.4.0, "Finalize Review")** | In a heat race "Delete all data" deletes every earlier heat too (review.js:517). No summary of the changes before Finalize. | Discard or re-run only this heat; a changes summary |
| Database lists and forms · **Done (2.4.0, "Track Sheet", "Driver Sheet", "Team Sheet"; Retire, Merge and the club list were in "Garage")** | Deleting a driver also takes them out of past results, with no undo. Lane lengths and points tables are typed as comma lists. | Retire instead of delete, merge duplicate drivers, import a club roster (CSV) |
| Import and Export | Three backup systems on one page. You can't pick an automatic backup to restore. Import always adds a copy. | A list of backups with dates and Restore; "replace existing" on import |
| App Settings structure | Database storage under General but backups under Import and Export; Director password apart from the Director page. | Group by task |
| Championships | The round date is free text. No points adjustment (a penalty or a correction). | A date picker, adjustments with a reason |
| Find (Ctrl K) | Only drivers, cars, tracks, setups and settings. | Teams, layouts, championships, past races, Help; more actions |
| Help | Topics in the order they were built. The only ways in are App Settings and Home. | A "?" on each page opening its article, F1 |
| Layout Editor | Mature. No "try it with a simulated race". Deleting a layout doesn't say which setups use it. "Image/Audio Settings" are libraries, not settings. | Try-out race, "used by" |
| Trackmate page | A HID finder and a raw hex sender sit among the club settings. | Behind Diagnostics (part of Tier 1 #4) |

## Fine as they are
Home, Chart Editor, Live Race pages, Leaderboard Editor, Parallel Port page (the model for the other hardware pages),
Startup screen, Statistics and Performance. The rules files without a screen (heats, endurance, tokens, tyre wear, weather,
delta, points) need nothing. No raw `prompt()` or `alert()` is left: everything uses the app's own Dialog.

## Design pass: how the pages look and read
Judged from screenshots of every page, editor and race state (QA profile, dark theme, 1366 px), apart from the code.
Verdicts here are about the design only: **Design remake** · **Design rework** · **Good**.

### What keeps coming back
1. **Help before content.** Nearly every list and editor opens with an outlined explainer box (often 3-5 lines), so
   help text wins the hierarchy over the content and the main action. On a page with one or two items it is most of what
   you see.
2. **Every setting looks the same.** The two things set every night (race over after, number of laps) look exactly
   like "Sensor must be blocked… (seconds)". The rail has "Only if you need it", the content doesn't.
3. **Red is louder than the main action.** Delete, Archive, trash icons and "Delete all data" are red and repeat on every
   card; Timing Hardware has 2-3 red primary buttons per page; a disabled primary is a muddy red that still looks clickable.
4. **Cards that carry no information.** Database lists default to tiles that are 75 % a random colour with one letter
   (B, B, B…). About 8 cars per screen, nothing that tells them apart.
5. **Wide screens used poorly.** List pages with 1-2 cards leave half the screen empty; editors stack single columns
   (the points table is 10+ full-width rows).
6. **Every editor is framed differently.** Layout and Leaderboard go full width, Chart, Widget and Image stay under the
   page's explainer; Multi-Class and Resource say "Back to systems" and "Saved" where the others say "Cancel" and
   "Ready to use". Four save models (autosave, Undo/Save footer, inline save buttons, "saved automatically").
7. **Uneven empty states.** A proper card on Token Records and Plugin Pages; plain grey text on Teams, Plugins and Virtual
   Rival; empty table headers on Championships; a blank page on "Other"; a black box for an empty layout.
8. **Labels as sentences, help cut off.** "The track length is that of (optional)", "Callsign (3 letters)" on every card,
   descriptions cut off at "…More" right where the choice is explained, truncated race-display labels ("Positi…").
9. **Unlabelled dots.** Red, yellow and green dots on rails and cards, never explained, sometimes contradicting the badge
   next to them (red dots on the rail beside a green "Ready to race").
10. **Race states reuse the running page.** After Finalize and between heats the app shows the running layout greyed
    out, instead of a layout made for that moment.

### Per page

| Page | Design verdict | What you see |
|---|---|---|
| Race window, running | Design remake | Cell labels overlap their values ("Race clock" over the time); an empty "Drive…" column; Start/Pause/Stop/Yellow/Red look alike, Stop and Red not marked as dangerous; display buttons and the director panel duplicate each other; lane cards below the fold |
| Race window, after Finalize | Design remake | The race board greyed out, "Lap time 0.000", every control disabled; the only confirmation a small grey line |
| Race window, between heats | Design rework | "Next up heat 2" is good, but there are two Start buttons; the board is sorted by grid position (3, 2, 4, 1); heat list and overall result are at the very bottom |
| Finalize review | Good | Clear and ranked, the lap sparklines work. "Delete all data" sits right next to Finalize at the same size, and again at the bottom |
| Race Setup editor | Design remake | Race Settings is one flat list of 13 identical rows; Track Call spread over 4 rows; a system is picked in a dropdown and then switched on again in a pill row; a native dropdown plus a duplicate track card; long engineering labels |
| Slotcars, Drivers lists | Design remake | Letter tiles (see 4); "Archive…" in red 48 times; a red trash on every driver |
| Car editor | Design remake | About 30 fields of equal weight in a long modal; the footer cut off; "Reload current record", "Save history"; 6-7 lines of help under fields |
| Calculations | Design remake · **Done (2.4.0, "Engineer's Bench")** | About 2600 px of demo, prose, a "try it" sandbox and real settings mixed, with two small save buttons; sandbox and real settings look identical |
| Home | Design rework | Start a Race is the right centrepiece, but the race picker looks like a heading, the helmet art squeezes the driver and car pickers, and "No timing hardware chosen" has the same weight as "34 drivers". (The title showed "TRACK" doubled behind it in the capture; check on a real screen.) |
| Tracks | Design rework | Letter tiles for 9 tracks (two are "C") where a layout drawing would say it at once; an overloaded toolbar |
| Track editor | Design rework | Fine structure; Length and Lanes is a wall of "(optional)" and π maths |
| Driver editor | Good | Clear sections, sticky footer; virtual-rival help in Basics |
| Results and Records | Design rework | The sessions list is good; the help line comes first; a ragged last column mixing Remove and sync notes; Track Records and Personal Bests repeat the same rows |
| Championships, Rounds (Results) | Design rework | Empty standings as bare headers; a lone "R1" floating in the progress bar; "Export to PDF" as the primary on a page with no data; one small round card on a full-width panel |
| Teams, Plugins, Virtual Rival, Other (empty) | Design rework | Plain text, or nothing, where a designed empty card belongs |
| Race Setups list | Design rework | Add, a 7-pill filter and a view toggle at equal weight; the kinds shown twice; cards of different heights; an unlabelled green dot |
| Race system lists (fuel … resource) | Design rework | The explainer takes the top third; 1-2 cards on a 3-column grid; Add/New and Copy/Duplicate mixed; List/Grid on some pages only |
| Race system editors | Design rework | A strong shell (rail with summaries, sticky footer), but prose intros of 5 lines; empty steppers that look broken (Damage: rail says "deslot 1 point", the field is empty); dependent switches not nested; the championship points table as one tall column |
| Timing Hardware pages | Design rework | 2-3 red primaries per page; actions loose on one page, in a form card on the next; a long middle rail; fine print inside the Parallel Port card |
| Connections | Design rework | Two nested navs in one rail; what organisers need on the night (address, QR, password) is behind sub-links |
| Race Director (settings) | Design rework | A 5-line explainer above a single two-way toggle |
| Customization editors | Design rework | No shared editor shell (see 6); the layout canvas is small, its widget tree 18 bare headings; the image type picker is greyed out yet the biggest block |
| Customization libraries | Good | Real previews; one card in the top-left of an empty page; only Audio says "Used by" |
| Race Results (customization) | Good | The settings-and-preview split is the best page here; the preview text is too small to read |
| App Settings › General | Good | The rail with value summaries is excellent; Picture quality and Units are too thin for pages of their own; Performance hides its explanations behind "More" |
| App Theme, Import and Export, Help, Racing Rules, Plugin Pages, Balance of Power, Time Tokens | Good | Small points only (a full temp path in bold, a detached search field, the explainer repeating the header) |

### What this changes in the order
The design pass agrees with the feature pass on the race window, the Race Setup editor and the screens after a race. It
adds three that the feature pass rated lower: the **Database lists and the Car editor** (letter tiles, 30-field modal),
**Calculations**, and a set of **shared fixes** that touch every page: one explainer style that stays small, one editor
shell, one empty-state card, one rule for red, and settings in tiers (everyday first, the rest folded away).

## Suggested order
1. After the race (#1): the flow you notice every race night, and it settles where results, standings and the PDF show.
2. Race window during the race (#2): one control strip, no duplicate controls, a board that doesn't overlap itself.
3. Race Setup editor and start checks (#3), with settings in tiers.
4. The shared fixes (explainer, editor shell, empty state, red, tiers), so every later remake starts from them.
5. Database lists and the Car editor (**done, 2.4.0, "Garage" and "Build Sheet"**), then Results and Records (#8, **done, "Record Book"**).
6. Timing Hardware with DS and the Lane Check (#4, #5, **done: "Timing Desk"**).
7. Audio (#6), Widgets (#7), Paddock (#9), Calculations, then the Tier 2 reworks.
