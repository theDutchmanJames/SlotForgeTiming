# UI reference images

Design mock-ups made together with Dutch, kept as a reference for later UI work. They are **pictures of a design**, not of the built app: when a feature is built the real screens can differ, and the real app is the truth. Use them for the look (spacing, folders, colours, wording) when a screen is made or improved.

Every set has the PNG pictures (1x) and a `source/` folder with the editable boards (`*.dc.html`, plus `canvas.json` with the layout of the canvas). The boards were made on a Claude Design canvas; the live canvas is private, so the PNGs and the sources here are the copy that stays with the code.

Palette used in the mock-ups (dark theme): background `#171b21`, panel `#222831`, panel header `#2b323d`, border `#343b47`, text `#e8e6e1`, muted `#98a0ab`, red button `#c8363c`, green `#3ecf8e`, amber `#ffb84d`, red `#e5484d`, purple folder `#2d2440` / `#4a3a6b` / `#c79bff`.

## tyre-wear/ (19 Oct 2026, design of the Tyre Wear feature, NOT built yet)

| Picture | What it shows |
|---|---|
| `1-tyre-wear-system-tyres.png` | Race Setup tab, sub-tab **Tyre Wear Systems** (between Damage Systems and Weather Systems): per-tyre numbers, grip curve, lap or distance counting, weather multipliers |
| `2-tyre-wear-system-rules.png` | The same record: where the system is chosen (race setup, folder Rule sets), where it applies, what worn tyres do, pit stops, sets per car or team, warning levels, Distance Racing |
| `3-race-screen-tyre-change-folder.png` | Race screen / Race Director page: the Tyre Change folder with the queue for the next stop |
| `4-widget-tyre-degradation.png` | Tyre Degradation widget: a tyre whose tread wears away, own picture with a life ring, bars (horizontal and vertical), number only, widget settings |
| `5-widget-available-tyres-and-cells.png` | Available Tyres widget (numbers, dots, list, number only, team pool) and the Tyre life cell in the Driver stats grid and the Leaderboard |
| `6-results-tyre-stints.png` | Results page: tyre stints per driver (also in the PDF); no tyre information in the Slotcar statistics |
| `7-audio-calls.png` | Audio set editor: group "Tyre wear" with six calls and the wear levels |

The decisions behind these pictures are in the roadmap (Project doc `claude/roadmap-and-decisions.md`, entry "Tyre Wear").

## race-setup-tabs/ (19 Oct 2026, design of the Race Setup sub-tab strip; option A built in 1.45.0, option B kept for later)

| Picture | What it shows |
|---|---|
| `1-option-a-top-strip.png` | **Option A (built):** a big solid **Race Setups** button, and the other eight sub-tabs as coloured buttons in three groups: Systems, Setups, Extras. The open one gets a stronger tint and a bar, and the panel below gets a top edge in its colour |
| `2-option-a-states.png` | Option A: Race Setups open, the light theme, and a narrow window (the groups wrap, the big button goes full width) |
| `3-option-b-side-rail.png` | **Option B (not built, for when more systems arrive):** the same buttons as a list on the left (236 px wide) instead of a strip on top; it costs width instead of height and takes any number of systems |

Colours (each sub-tab has the colour of its folder on the race screen): Penalty Systems yellow `#f2b705`, Damage Systems red `#e5484d`, Tyre Wear Systems purple `#9b4dff`, Weather Systems blue `#4c9aff`, Balance of Power white `#e8e6e1`, Time Tokens teal `#1fb5ad`; Rotation Setups brown `#c4803f` and Fuel Setups green `#2fb86a` (they have no folder, Dutch approved these two). The big button is the theme's accent colour (`#c8363c` in the dark theme). On the light themes the colours are a little darker: `#8a5124`, `#1e8a4c`, `#9a7400`, `#d62828`, `#7c3aed`, `#0f6fd6`, `#5b6470`, `#0e8a84`.

## depth/ (19 Oct 2026, the depth of the app: option A, Soft lift, built in 1.46.0; option B, Thick card, is the 75 level)

Dutch asked for a very slight feeling of depth on the race screen: a thick card, a shallow button. The design was made on a Claude Design canvas (*Race Screen Depth*: today flat, A Soft lift, B Thick card, and the parts, button states and themes). He chose **A** and asked for it in the whole app, with a setting to turn it down or off. For this set the pictures are **screenshots of the built app** (1.46.0, the real stylesheet in headless Chromium), not renders of the boards: the boards in `source/` need the Claude Design runtime to draw. The built app is the truth.

| Picture | What it shows |
|---|---|
| `1-race-screen-flat.png` | The race screen with Depth **Flat (no depth)**: the plain look of before 1.46.0 |
| `2-race-screen-soft-lift.png` | **Soft lift (standard)**, depth 35: a light edge on top, a thin lip underneath and a soft shadow |
| `3-race-screen-thick-card.png` | **Thick card**, depth 75 (design B): the same, stronger. **Medium** is 55 |
| `4-race-screen-light-soft-lift.png` | Soft lift in the light theme (the lip and the shadow are lighter there; the Ocean theme and a Custom theme with a light panel do the same) |
| `5-widget-border-colour-and-thickness.png` | Widgets with a border of their own: a colour (any) and a thickness; a see-through widget (60%) stays flat |
| `6-home-soft-lift.png` | Home with Soft lift: cards and buttons stand up a little, fields are a little sunk |
| `7-settings-depth.png` | App Settings > General > Display: the **Depth** choice |

How it is made (renderer/styles.css, the layer at the end, and renderer/depth.js): box-shadows only, no extra elements and no change of colour, so it works on any theme colour and on a widget colour of your own. The page has `--depth` (0 to 1; Flat 0, Soft lift .35, Medium .55, Thick card .75), and a widget fades it with its own solidity (`--wf`), so a transparent widget stays flat. A button that is pressed moves down. The light themes take the light values through `data-theme` (light, ocean) or `data-tone="light"` (a Custom theme with a light panel).

## championship/ (19 Oct 2026, design of the Championship feature; release 1 built in 1.55.0, release 2 NOT built yet)

No PNG pictures yet, only the editable boards in `championship/source/` (open the `*.dc.html` files on a Claude Design canvas; `canvas.json` has the layout).

| Board | What it shows | Built |
|---|---|---|
| `Main.dc.html` | Race Setup, sub-tab **Championships**: the list of championships | 1.55.0 |
| `Rounds.dc.html` | A championship: name, rounds and their sessions (race setup, kind, share), the roster | 1.55.0 |
| `Home.dc.html` | Home: the card with the next session of the championship, loading it, the "Counts for" line, the standings on the right | the card and the loading in 1.55.0; the standings and "Maria leads by 5" are release 2 |
| `Points.dc.html` | Points table and presets, bonuses, dropped results, team points, tie rule, and the roster with the guest rule | the roster in 1.55.0 (the guest rule is stored, not applied yet); the rest is release 2 (not built) |
| `After.dc.html` | The race screen after a race: **Award these points / Do not count this race / Undo** | release 2 (not built) |
| `Standings.dc.html` | The pool **Championships** in Results and Records: drivers and teams, round by round | release 2 (not built) |

The decisions behind these boards are in the roadmap (Project doc `claude/roadmap-and-decisions.md`, entry "Championship").

## start-race/ (20 Oct 2026, the Start a race card on Home: option A built in 1.58.0, option B kept for later)

Dutch asked for a look at the **Start a race** card and a small re-design in the spirit of the Championship card and these reference sets. The design was made on a Claude Design canvas (*Start a race redesign*: today, A lanes as rows, B a starting grid). He chose **A**. As for *depth*, the pictures here are **screenshots of the built app** (1.58.0, the real stylesheet in headless Chromium); the boards of the design are in `source/` (open the `*.dc.html` files on a Claude Design canvas; `canvas.json` has the layout, `start-race.css` is the stylesheet the boards link to).

| Picture | What it shows |
|---|---|
| `1-start-race-dark-lane-needs-a-driver.png` | The card in the dark theme: the name of the race setup as the title, the pills (kind, laps, track, lanes), a ready lane with a green tick and a lane that says what it needs, "1 of 2 lanes is ready" and Start off |
| `2-start-race-light-heat-teams.png` | The light theme, a heat race of teams: the rows with a team, a car and Remove, the heat plan under them |
| `3-start-race-rotation.png` | A rotation: participants with their names and the Not here today tick |
| `4-start-race-narrow-window.png` | A narrow window: the rows keep the number, the choices and the tick; the note goes under them |
| `5-start-race-endurance.png` | An Endurance Race: every lane is a team with its starting driver |
| `6-start-race-time-tokens.png` | A Time Token Session: nothing is needed to fill a lane, the button says Open the session |
| `7-start-race-driver-twice.png` | A problem that is not about one row (a driver on two lanes): it stays in the list under the rows |

Option **B (not built)**: the lanes as a starting grid (a card per lane, side by side) with the driver and the car under the lane number; `source/B-*.dc.html`. How it is made: `renderer/landing.js` (`rowHtml`, `chipsHtml`, `lightsHtml`) and the block "Start a race (1.58.0)" in `renderer/styles.css`; the colours are the ones of the lanes on the race screen and the accent, green and amber of the theme.

## race-setups/ (21 Oct 2026, design of the Race Setups editor and list; Stage 1 built in 1.69.0, Stage 2a in 1.70.0, Stage 2b in 1.71.0)

Dutch asked why the Race Setup form feels cluttered: "Session type" is one dropdown that answers three questions (what kind of session, one race or heats, do teams swap drivers), and laps / time / distance come back as a second question further down. The design says what a session is, how it ends and who wins, in short words. He said the pictures stay in this reference set, because **all the Systems and Setups pages will get this look later** (the plain-words sentence, the header pills, the section rail, cards on the list page). The PNGs are renders of the boards in `source/` (Inter font, 1x); `source/rs.css` is the shared stylesheet of the boards and holds the exact sizes and colours.

| Picture | What it shows |
|---|---|
| `1-editor-one-race.png` | The editor of a single race: header with name, pills and "Ready to race"; the **section rail** (Option B of race-setup-tabs: every section with its value and a status dot, "Advanced" at the bottom, a "Used by" note); the **In plain words** sentence; **Session** (Kind cards, Format cards, swaps switch, Track); **Ends and winner** (Laps / Time / Distance with the number, how the race ends, who wins said in words); the other sections folded with their value on the row |
| `2-editor-heats.png` | The same editor for a race in heats: the **Heats** section (who races, how the heats are planned, heats per driver, break, who races together) and **Ends and winner** with the overall winner (Most points / Most laps / Lowest total time), the points boxes, how the heats are added up, drop the worst heat, tie rule, finals |
| `3-one-dropdown-three-questions.png` | Why: today's one dropdown against the questions one by one, the stored values that stay the same (nothing to migrate), and who wins for each way a race can end |
| `4-wording-before-after.png` | The wording: today's label, the proposed one and why, for 14 settings, and the four rules for every label |
| `5-race-setups-cards.png` | The Race Setups page as cards: kind eyebrow, pills, **Ends** and **Wins** in words, Edit / Delete, a kind filter, List / Cards, and "Start from a kind" |
| `6-built-1.70.0-race.png` | **Screenshot of the built app (1.70.0, dark theme):** the form of a race of 10 laps with the picker (Kind cards, Format cards, the swaps switch), *The race is over after* as a row of buttons with the number beside it, *The race ends* as a row of buttons; the other sections still fold (the side rail is stage 2b) |
| `7-built-1.70.0-heats-by-time.png` | **Screenshot of the built app (1.70.0, dark theme):** a race in heats of a set time with all the new controls: the plan and the overall winner as cards, who races together and how the heats are added up as rows of buttons, the points as boxes (1st 10, 2nd 8 ...), the switch *Drop the worst heat of every driver*, and the finals |
| `8-built-1.71.0-race.png` | **Screenshot of the built app (1.71.0, dark theme):** the form of a race of 10 laps with the **side rail**: Session, Ends and winner, Start, Rules and systems, Screens and sound, and Advanced under *Only if you need it*, each with its note and dot, *Used by* at the bottom of the rail, the header with the name, the pills and *Ready to race*, the sentence *In plain words* in its tile, and the bar with *Everything else keeps its default.*, Cancel and Save |
| `9-built-1.71.0-heats-collapsed.png` | **Screenshot of the built app (1.71.0, dark theme):** a race in heats: the rail now has *Heats* too; *Session* and *Heats* are closed and show their note on one line (*Race, heats, no driver swaps, on Living room*, *3 heats, shuffled*); *Ends and winner* is open with the overall winner as cards |
| `10-built-1.71.0-advanced.png` | **Screenshot of the built app (1.71.0, dark theme):** **Advanced** open: the *Yellow flag* part and the *Adjust pads* part (with Trackmate and SlotForge box below) as one section, and the rail row *Advanced* marked |

The stored values do not change: Kind x Format x Swaps maps one to one onto `sessionType` (practice, qualifying, race, heats, endurance, tokens) and `enduranceBy`, so old setups open unchanged. The sample numbers in the pictures (start lights 3 to 5 s, "Used by", 8 drivers on 4 lanes) are placeholders. Stage 1 (wording, merged sections, the plain-words sentence, header pills, cards on the list page) keeps today's folding sections and was built in 1.69.0; Stage 2a (the Kind / Format / Swaps picker and the new controls: segmented choices, cards, switches, boxes for the points) was built in 1.70.0; Stage 2b (the side rail, the Advanced merge, the Used by note) was built in 1.71.0 (differences from the design: the *Winner:* note box and the *4 lanes* pill beside the track are not built; Advanced is one card with four parts inside), and Dutch said these pictures are the reference for updating all the systems and setups pages later. **Win rule:** a race of laps is won by the first car to finish, a race of time by the most laps (or the furthest distance) and then the shortest total time, a race of distance by the first car to drive it; the first version of these pictures said "most laps, then the shortest time" for laps and distance, which is not what the engine does, and was corrected in 1.69.0 (pictures 1, 3 and 5). Built differently from the pictures in Stage 1: a heat card has the pill "3 heats of 8 laps" (the picture says "8 laps per heat"), a card has no picture of the track, and "Start from a kind" has a sixth button, Endurance, because the session type was still a dropdown (in 1.70.0 the picker has Free practice, Qualifying, Race and Time tokens, and Endurance is Race with the swaps switch; the *Start from a kind* row keeps its six buttons). **Built differently from the pictures in Stage 2a (1.70.0):** the number of *The race is over after* sits in a column beside the buttons, not inside the same box; for a heat of time the cards are the ones the engine has (*Most points*, *Most laps, then total time*, *Most laps*), not *Lowest total time* as picture 2 shows; the *Winner:* note box is not built (the plain-words sentence says it); *Open all* / *Close all* are still there; four more yes / no questions are switches than the pictures show (Balance of Power, track power at the start, box beeps, lane lights).

## lane-cards/ (21 Oct 2026, the Race Director as a card for each lane, built in 1.72.0)

Dutch asked for a Race Director that is nicer to look at and fits more on the screen. The design (*Race Director Panel Redesign*, a Claude Design canvas) had **B Lane cards** for the desktop (2 lanes the usual, 4 lanes supported), **C Pick a lane** for phones only, a separate bar for Track actions, and the amounts pop-up of the *Parts and states* board. The boards of the design are in `source/` (`Main`, `B-Cards`, `C-Pick`, `Phone`, `Parts`, with `canvas.json`); the design PNGs were not kept, the live canvas is private. The pictures here are **screenshots of the built app** (1.72.0, Chromium with a stand-in for the app, 1x), so they are the truth for the built look.

| Picture | What it shows |
|---|---|
| `1-built-1.72.0-two-lanes-running.png` | Two lanes (the usual), dark theme: Undo and the weather in the bar, a card for each lane with chip, pads, Penalty / Damage / Failure and Balance of Power, the log docked at the right, then the Weather and Tyre Change folders |
| `2-built-1.72.0-pop-amounts.png` | The amounts pop-up of a pad: every value of the list as + and −, and the field *other* with Give and Take back |
| `3-built-1.72.0-pop-penalty.png` | **Penalty ▾**: the named penalties of the system with their cost (grey when the car has too few points) |
| `4-built-1.72.0-pop-damage.png` | **Damage ▾**: the incidents of the Damage System |
| `5-built-1.72.0-pop-failure.png` | **Failure ▾**: a list to choose from (*At random* first), then Give |
| `6-built-1.72.0-four-lanes-bop-weather.png` | Four lanes (a friend of Dutch): four cards in a row, the log as a drawer, Balance of Power pressed and the weather on Wet |
| `7-built-1.72.0-four-lanes-log-drawer-light.png` | Four lanes in the light theme with the log drawer open |
| `8-built-1.72.0-phone-pick-a-lane.png` | A narrow screen (390 px): the strip of lanes and the card of the lane that is picked, with the amounts pop-up open |
| `9-built-1.72.0-race-director-page.png` | The Race Director page (Live Race): the same folder with the cards, under Track actions, with the weather and the log |
| `10-built-1.72.0-race-director-page-phone.png` | The race window (left) and the Race Director page at the width of a phone (right) side by side, with the Penalty pop-up open |

Colours of the pads are the ones of the Pad values: penalty points yellow `#f2b705`, race time orange `#f08a24`, laps purple `#9b7bff`, damage red `#e5484d`, championship points green `#3fb950`; the minus button is the same colour, darker. A card is green, amber or red at the top (the worst chip).


## race-systems/ (22 Oct 2026, the window of Race Setups for the seven systems; Penalty and Damage built in 1.73.0, Weather in 1.74.0, the rest NOT built yet)

Dutch asked to give the other setup windows the look of the Race Setups window (header with pills, the sentence *In plain words*, a side rail with notes and dots, folding section cards, *Used by*). The design (*Race systems with the side rail*, a Claude Design canvas) has an overview board and one board for each system, in the colour the system already has (Penalty yellow `#f2b705`, Damage red `#e5484d`, Weather blue `#4c9aff`, Tyre wear purple `#9b4dff`, Safety car orange `#ff7a1a`, Push and save lime `#a6d23c`, Fuel green `#2fb86a`). **Penalty and Damage stay two separate systems** (Dutch, 22 Oct). The order of building: release 1 Penalty and Damage (1.73.0), release 2 Weather (1.74.0), release 3 Tyre wear, release 4 Safety car, Push and save and Fuel together; each release waits for Dutch's go.

The boards are in `source/` (`Main` overview, `Penalty`, `Damage`, `Weather`, `Tyres`, `SafetyCar`, `PushSave`, `Fuel`, the shared `sys.css` and `canvas.json`). **The PNGs of the design boards were not exported** (the canvas is private and has no export): open the `*.dc.html` files on a canvas to see them. The pictures here are **screenshots of the built app** (1.73.0 and 1.74.0), drawn in Chromium with a stand-in for the app.

| Picture | What it shows |
|---|---|
| `1-built-1.73.0-penalty.png` | Penalty system, dark theme: the yellow header with the system's picture, the pills, *Ready to use*, the rail, *In plain words*, the time rule as two cards, the sentence *Every [5] points add [5] seconds* and the note under it, *Used by* |
| `2-built-1.73.0-penalty-special-and-limits.png` | The same form scrolled: the table of special penalties and *Disqualification and fuel* (under *Only if you need it*) |
| `3-built-1.73.0-penalty-steps.png` | *Steps I define*: the cards, the steps typed as before (`5=5, 10=12, 15=30`) and the note for the steps |
| `4-built-1.73.0-penalty-new-and-unused.png` | A penalty system that no race setup uses (*Used by* says where to choose it), with the focus in the name |
| `5-built-1.73.0-penalty-light.png` | The light theme |
| `6-built-1.73.0-damage.png` | Damage system, dark theme: the red header, the rail with its five sections, *In plain words*, the stop as two cards, the bar of the levels |
| `7-built-1.73.0-damage-levels.png` | The table of levels (36 px rows, the columns of the design), the incidents below it |
| `8-built-1.73.0-damage-failures-on.png` | *Car failures* switched on (the switch in the red of the system), *Penalty points* folded under it |
| `9-built-1.73.0-damage-ocean.png` | The Ocean theme |
| `10-built-1.73.0-damage-phone.png` | A narrow window (420 px): the rail becomes a row of chips, the sections follow |
| `11-built-1.74.0-weather.png` | Weather system, dark theme: the blue header with the weather picture, the pills (*Rain after 8 laps*, *Lasts 6 laps*), the rail with its five sections, *In plain words*, *Counted in* as two buttons, and the bar of the weather over the race (Dry, Cloudy, Wet, Clearing, Dry, in laps of the leader) |
| `12-built-1.74.0-weather-tyres.png` | *Tyres and penalties*: which tyres a pit stop gives in Cloudy and in Clearing, the laps to change, the penalty points, and how often they are given |
| `13-built-1.74.0-weather-random.png` | Rain at a random moment (in minutes): the sentence *The rain starts at the earliest after [5] minutes and at the latest after [12] minutes*, the pill *Rain after 5–12 minutes* and the bar that draws the middle |
| `14-built-1.74.0-weather-director.png` | *Only when the Race Director says so*: one pill, no bar, a line of words instead, and the numbers of a forecast are hidden |
| `15-built-1.74.0-weather-hinder.png` | *Hindering the cars* (under *Only if you need it*): the switch and the three ways as three switches on one row |
| `16-built-1.74.0-weather-hinder-table.png` | The table of 12 percentages: the state of the weather against the kind of tyre |
| `17-built-1.74.0-weather-conditions.png` | *Track conditions*: the units as two buttons, the table of the track and air temperature, the wind speed and the wind direction for every state of the weather |
| `18-built-1.74.0-weather-conditions-imperial-light.png` | The light theme, with Fahrenheit and mph chosen: the heads of the table say °F and mph |
| `19-built-1.74.0-weather-ocean.png` | The Ocean theme |
| `20-built-1.74.0-weather-phone.png` | A narrow window (420 px) |
| `21-built-1.74.0-weather-phone-conditions.png` | The conditions on a phone: every number has its own small heading and two sit side by side |
