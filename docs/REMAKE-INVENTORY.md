# Remake inventory (2.4.0)

Which screens were built "to work" and would do well with a **remake**, not just a restyle. A remake rethinks what the screen
is for, its flow and its features, and checks for missing features to suggest (each one is approved before it is added). A
**redesign** keeps the function and only changes the look. Line numbers are from commit 37920e4.

Verdicts: **Remake** · **Rework** (a smaller remake of one part) · **Fine**.

## Tier 1: the biggest wins

### 1. After the race: single race, heats and championships (the flow) · Remake
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

### 2. Race window during the race · Remake
- Start, Pause, Yellow and Red exist only as widgets in the layout (widgets.js:2114) or as keys. A layout without them leaves
  only the keyboard. The toolbar has Stop but no Start.
- There are two Race Director forms, lane cards or folders, switched in App Settings. Every panel exists twice.
- "Simulated cars" is on the live toolbar, one mis-click from fake laps in a real race.
- A track call can only be dismissed or given a penalty point (race.js:2097). There is no "give the lap back" and no reason
  to note.
- The default layout has 6 lanes, while the app supports 8.
- **Ideas:** a fixed control strip, a clear race-state banner, a full Race Director decision dialog.

### 3. Race Setup form and start checks · Remake
- About 100 fields. "Race Settings" holds 36 of them, mixing length, heat scoring, start lights, red flag, pit hold and
  track call (schema.js around 600-1380). Heat scoring is not in Heats.
- The session type mixes format and kind (race, heats, endurance, tokens). The engine still knows a `timed` type that is
  not offered.
- Problems show only *after* Start: an alert, then back to Home (race.js:552, 663, 824, 975). A heat plan that does not fit
  is silently replaced by a newly generated one (race.js:967).
- **Ideas:** choose the format first (Practice, Qualifying, Single race, Heats + finals, Endurance) and show only its fields;
  presets; a summary; a pre-race checklist on Home (lanes, cars, systems, hardware) before the race window opens.

### 4. Timing Hardware area · Remake of the flow
- The "Other" tab is an empty page (app.js:536). oXigen Digital is a "Coming." placeholder (app.js:547).
- Connecting "does not put it in use" (app.js:485), so the "not counting laps" banner has to patch it.
- Each page works differently: Trackmate saves at once and loses its serial settings when a port is picked, Parallel Port
  has Save/Undo, Arduino has its fields locked until connected. The lane count is in two places.
- **Ideas:** one "Connect & use" action, one status card per interface (connected, lanes seen, last hit), the same page frame
  everywhere (Parallel Port is the best model).

### 5. DS Electronics page · Remake
- It is a protocol-capture tool for the developer shown as a setup page: "How to make a capture", "physical verification
  pending" (dsui.js:322-395).
- It has no lane lights and no sensor check, only raw hex. Its serial settings last only for this app session.
- **Ideas:** lane lights with the measured lap times, lane mapping as on Trackmate, the capture tools behind a Diagnostics
  switch.

### 6. Audio set editor · Remake
- The old page (131 calls in fieldsets) is built first and then moved into the new shell, and its labels are rewritten text
  node by text node (audiostudio.js:99-190). Almost every edit rebuilds the whole editor, so the scroll position is lost.
- The presets (Essential, Club, Broadcast), the main choice for most people, are tucked away under "Only if you need them".
- **Ideas:** presets first, then a short list of the calls; a "play a sample race" button; how each driver's name is said
  (or a recorded name per driver); a choice of speaker (`setSinkId`).

### 7. Widget Builder and canvas editor · Remake
- Two editors for one idea, with different rules: a simple picture allows one condition, the canvas editor allows many.
- A widget is *copied* into a layout, so no "used in N layouts" and no "update the copies". Chart designs are linked,
  which makes the two inconsistent.
- Saving dead-ends with "Add it from My widgets in the Layout Editor" (widgetstudio.js:972). Colours and the place are set
  elsewhere again.
- The preview offers lanes 1-4 only (widgetbuilder.js:234).
- **Ideas:** one editor with a simple mode, linked widgets, "Add to layout…" from the builder.

### 8. Results and Records · Remake
- Each folder (track records, personal bests, sessions) has its own "Page N" paging. There is no search and no filter by
  driver, track, date or championship. Two code paths (SQLite and the old one) patched together.
- No way to correct a result after Finalize, only delete.
- **Ideas:** a filter bar, a driver's history across races, the history of a track record, correct a finalized result.

### 9. Paddock connection screens · Remake
- Plumbing shown as buttons: Find local services, Retry, Forget service connection, Refresh transfers, Check/retry.
- The way in is in three places (Database › Slotcars, App Settings › Connections, Import and Export). Help has about 14
  recovery articles for it.
- **Ideas:** one Paddock hub with a status summary and one "Fix it" action.

## Tier 2: rework one part

| Screen | What to rework | Ideas |
|---|---|---|
| Lane Check (sensor test) | Not connected? It says where to go but has no Connect button. A sensor on the wrong lane is only described. | Fix "lane 2 lit lane 3: swap?" in the dialog; test pit sensors, track call and track power |
| Setup guide on Home | The hardware step sends you to App Settings with no way back. No lane-mapping step. Cars step skipped with the shared library. | Connect inside the guide, a lane-mapping step, an audio step |
| Detected hardware card | "Not timing hardware" can never be undone (`hwIgnored`, app.js:436). Errors send you to App Settings. | A "Forgotten devices" list; the reason shown on the card |
| Balance of Power, Time Tokens | One global setting each, unlike every other system (named, per setup). No "discard changes?" when leaving. | Named profiles chosen in the setup |
| Multi-Class, Virtual Rival | Who is in which class is saved inside the reusable system. Virtual Rival is chosen on the driver, and errors show only at Start. | Classes from the entry list of the race |
| Rotation Setups | Built on a typed lane count, not the track's. | Lane fairness per driver; build from the entry list |
| Finalize review | In a heat race "Delete all data" deletes every earlier heat too (review.js:517). No summary of the changes before Finalize. | Discard or re-run only this heat; a changes summary |
| Database lists and forms | Deleting a driver also takes them out of past results, with no undo. Lane lengths and points tables are typed as comma lists. | Retire instead of delete, merge duplicate drivers, import a club roster (CSV) |
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

## Suggested order
1. After the race (#1): the flow you notice every race night, and it settles where results, standings and the PDF show.
2. Race window controls (#2), then Race Setup and start checks (#3): they share the race page.
3. Timing Hardware with DS and the Lane Check (#4, #5, Tier 2).
4. Results and Records (#8), which builds on #1.
5. Audio (#6), Widgets (#7), Paddock (#9), then the Tier 2 reworks.
