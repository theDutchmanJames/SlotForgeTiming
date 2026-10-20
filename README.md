# SlotForge Timing - Slotcar Timing System (Windows, macOS and Linux Desktop App)

A SlotCar timing app with expansive functionality and customization!

<img width="1301" height="1315" alt="Hometabv2" src="https://github.com/user-attachments/assets/48509bdb-ad8a-4339-be40-6e05f013689d" />

<img width="2560" height="1440" alt="Custom Timing Page" src="https://github.com/user-attachments/assets/0e82f1da-b4ca-4eba-bd21-cacd5f31f0f4" />


## Key Features of SlotForge Timing:  
- Fully and extremely customizable Timing Page - Lots of widgets to choose from with lots of customization options on how it it presented on screen.  ​
- Powerful Leaderboard Style Editor - linked to a widget but also a live leaderboard page. Saveable as a 'setup', make as many as you want for multiple boards.)  ​
- Database for your Tracks, Drivers, Slotcars and Race Results - Extra fields can be added, Race Results can be reviewed and exported to PDF.  ​
- The info contained in the PDF can be chosen to your liking.​  
- Race Results and Records Database - Are linked to Driver, Car, Track, and time. Can display more info.​  
- Setting up races of different Session Types with its own rules - Indefinite Free Practice, Qualifying with carry-over results, Race, Round Robin, Heats, Timed Sessions.  ​
- Customizable Audio settings - A big list of Audio calls with different {variables}, all Text-to-Speech which whatever you have installed on your computer. Can upload custom audio files. Can add custom Calls and build your own using the {variables}.​  
- Customizable Image Settings - Set standard images for the Race Flags, Start Lights or Fuel States, can be applied per race.​  
- Basic Fuel Settings - Tank size, Fuel consumption, variance of fuel usage linked to laptimes, Pitstop refuel speed. All customizable.  ​
- Basic Penalty System - Add Penalty Points, or Special Penalties like a Stop and Go penalty which 'forces' the driver to stop on the sensor for a set amount of time.  ​
- Basic Time Token System - Do you sell Track Time on your Racetrack? There's a simple manual system in place for that which all kinds of visual cues.  ​
- General App Settings - for a Club Logo or Header Image, custom colours for the whole app look and feel.​  
- Live Race Page / Multiple Screens - Want to connect to the Timing Page, Leaderboard or Driver specific statistics? Connect through localhost or QR-code to land on a landing page with several viewing options. Clicking the Live Race tab opens a second window on your second screen (if present, otherwise on main).​
- Import and Export of Race Layouts, Widgets, Audio Sets etc  
.. and some more small tidbits​

## I got the .ZIP, now what?
Unzip it. There is 'build-windows.bat' file (for windows, same for macOS and Linux). Run that for a minute or two, (this pulls and builds all the things it needs to make this an app. It also does a ton of checks, no clue why, but checks are a good thing though right?), then run the Portable .exe so it doesn't have to install to any folders on your computer. If you do want it installed, go with the other one but portable is easy to just check the app out.  

It'll ask for local network access because there is an extra, second screen which you can connect to through localhost IP (e.g: 192.1.68.85:8080) or QR (the QR code and IP can be printed on A4), if you choose to turn it on. (This is the Live Race tab)

## How do I get started?
There are default settings for everything, so you could dive right in by clicking 'Open the Session' on the Home tab. Make sure to setup your TrackMate interface first, under the App Settings tab. Approach the App like you would a physical track. you start out with a track , so add one on Database tab under Tracks.

0. Add Trackmate Timing Interface
1. Add a track under Database, Tracks. You are presented with a bunch of options you can skip for now, only lane number is really necessary. Track length might useful.
2. Then add a Driver and a Slotcar, skip all options.
3. Set up a race under Race Setup. Pick a Session Type. Skip Options, or not.
4. Go back to Home, Pick your race and hit Start Race/Open the Session.

This sets up a basic race. There is a default one in place as well, but this would get you started on customization later on, when you are comfortable with that.


## Licence and copyright
SlotForge Timing is made by theDutchmanJames. Copyright 2026 theDutchmanJames.

You may use it, study it, change it and pass it on for any **non-commercial** purpose: at home, in a club, at a school, for a charity. You may not sell it, or use it for commercial purposes, without permission. The terms are in the file **LICENSE**: the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0), a ready-made licence (the text of the licence is what counts, this paragraph is only the short version). Whoever passes the program on has to pass on the LICENSE file (or its link) and the line `Required Notice: Copyright 2026 theDutchmanJames (https://github.com/theDutchmanJames/SlotForgeTiming)`.

This is a "source available" licence, not an "open source" one in the strict sense: open source licences do not allow a ban on commercial use. The QR code library in `vendor/QRCode` keeps its own licence (`LICENSE-qrcode-terminal.txt`).


## CHANGES
## What to try (batch K1: small improvements)
1. **Home**: the Drivers and Slot cars cards show the 5 used last (the rest fill in if fewer have been used), with a **Show all N in the database** button that opens the matching Database page.
2. **Lap time widget** (and the current lap column of the leaderboard, and a pit stop in progress) now count with three decimals: 0.000 and up.
3. **Race review**: after **Clear points** there is a **Restore** button.
4. **Live Race window**: a **Full screen** button (Esc leaves full screen).
5. **App Settings**: more colour themes (Midnight blue, Forest green, Sunset orange, Violet, Carbon and yellow, Ocean).
6. New **Championship points** widget (Timing group): for heat and round robin races counted by points it shows the points from finished heats plus what the current positions are worth right now. Untick the option on the widget to count finished heats only. It is also on the Driver stats page.
Coming next: fuel rules (their own tab next to Penalty systems, with a target lap and a limit of extra and saved fuel in percent), then the leaderboard row designer.

## What to try (batch I2: special penalties, race review)
1. **Race Setup > Penalty systems > Add**: there is now a **Special penalties** list (starting with Drivethrough, Stop-and-Go 5 s and 10 s). For each you set the **kind**, how long to **stand still** (Stop-and-Go), what it **costs in points**, what **leaving early adds** in points, and how many **seconds are added if it is never served**. Add or remove as many as you like.
2. In a race with that system, the **Race Director** page has a button per special penalty on each driver (greyed out until the driver has enough points). Pressing it takes the points off and the driver has to serve it: **Drivethrough** is served when a pit stop starts (the race setup's pit hold time), **Stop-and-Go** when the car has stood on the sensor long enough. Leaving earlier adds the "leaving early" points and the penalty stays. The Pit buttons on the race screen (Shift + number) can be used to try it. The Penalty widget shows what is still to be served.
3. **After every race (and every heat) there is a review** before anything is saved. It shows the final order, and for every driver you can: **Clear points**, **Disqualify / Reinstate**, and open **Laps** to mark a lap **invalid** or **Delete** it. For a penalty that was never served you can **Add time** (the seconds from the penalty system, which you can change), **Disqualify** or **Forgive**. The same review is on the Race Director page.
4. **Delete a lap** asks how: *from the records only* (the lap is gone from the database, the race result stays as driven) or *from the race too* (one lap fewer and less time, which can change the order).
5. **Finalize results** saves. Invalid and too slow laps are saved but shown struck through (in Results and Records and in the PDF) and are never used for personal bests and track records.
Note: Trackcall is left for the Trackmate step. A special penalty can only be given in the Race Director page (the race screen has the plain +1 point buttons).

## What to try (batch I: penalty points and the Race Director)
1. **Race Setup > Penalty systems**: add one. *Points turn into time* is either **Every X points add Y seconds** (5 and 5: 5 points = 5 s, 10 = 10 s, 15 = 15 s) or a **Steps** table such as `5=5, 10=12, 15=30` (the highest step reached counts, it is not added up). Optionally **Disqualify at** a number of points.
2. In **Race Setup > Race setups** pick the **Penalty system** for a setup (or "No penalties").
3. Start a race with it. On the race screen there is a **Penalty n** button per lane (one point each). On the **Live Race** window the **Race Director** tile has Start, Pause/Resume, Yellow, Red and Stop race, and for every driver **Penalty point +1** and **-1** (to take back a mistake), with the points, the time penalty and a log.
4. The **Penalty points** widget (Layout Editor, Timing group) shows points, the time penalty, or both. Driver stats shows it too.
5. At the end the time penalty is added to the driver's time, which can change the order (in races by laps). Results and the PDF show the time with the penalty included and the points. Reaching the disqualify limit puts the driver out of the race ("DQ"); -1 brings them back as long as the race is not over.
6. The **Live Race** window now uses the setup's *second screen* layout if you chose one.
(Drivethrough and Stop-and-Go penalties, the end-of-race review, invalid laps and the Trackcall button came in later batches.) In timed races and practice the time penalty only counts for ties on laps. Penalty points start again at zero in every heat.

## What to try (batch H2: tabs, app name, header picture)
1. Tabs now run: Home, Database, Race Setup, Customization, App Settings, Racing Rules, Live Race.
2. **Customization** holds the **Layout Editor** (the layouts that used to be in Race Setup) and **Audio Settings**. **Race Setup** is just the race setups.
3. **App Settings** (was Settings): type your own **App name**. It shows at the top of the window and as the window title. Empty brings back "SlotForge Timing".
4. **App Settings** also has the **Header picture**: it is shown as a wide banner at the top of the Home tab. Remove picture takes it away again.
5. **Live Race** is not a page any more: clicking the tab opens the second-screen window (or brings it to the front), also while a race is running.

## What to try (batch H: Live Race)
1. New **Live Race** tab. It shows tiles: Race timing, Leaderboard, Driver stats, Database, Racing rules and Race Director (greyed out, it comes with the penalties step). The pages are read-only.
2. Press **Open on a second screen**. A second window opens on your other monitor (or on the main one if you only have one: drag it where you want it, F11 or Alt > View > Toggle Full Screen for full screen). Closing the main window closes it too.
3. Start a race (with Simulated cars if you like) in the main window. In the second window open **Race timing**: it is your timing page, live, without the control buttons. Pages that need a race say so when none is running.
4. **Leaderboard**: big, with a *Customize* box that has the same columns as the leaderboard widget (name, nickname, callsign, flag, laps, best, last, current lap, gap, fuel). Your choices are saved for this page.
5. **Driver stats**: pick a driver, see position, lap, lap time, best, average, median, gap, record, speed, fuel and pit time, plus all laps.
6. **Database** (read only, no Add/Edit/Delete) and **Racing rules** work with or without a race.
Note: while a race is running the main window stays on the race screen (as before), so the Live Race tab there is for between races; the second window is where you watch.

## What to try (batch G2: lap limits and scrolling)
1. Database > Tracks > Edit: new **Minimum lap time** and **Maximum lap time** (seconds, both optional). A crossing sooner than the minimum after the last one is ignored, as a faulty trigger, and the lap carries on. A lap slower than the maximum still counts as a lap (so the race count stays right), but it is left out of the best lap, the average and median, the personal best and the track record. It is saved with the session flagged as removed from the records.
2. Layouts > editor: the widget list (left) and the options (right) now stay in view and scroll by themselves when the window is too small.
3. Database and Race Setup forms are wider, in two columns, and scroll inside the window. Save and Cancel stay at the bottom. Pictures, notes and the track length calculator use the full width.

## What to try (batch G: car pictures, track length, speed)
1. Database > Slotcars > Add or Edit: the picture is now the **Main picture**, with **More pictures** under it (chassis, a screenshot of a parts list, ...; up to 12). Click a thumbnail to see it larger. **Make main** swaps it with the current main picture; the main picture is the one used on cards and in widgets.
2. Database > Tracks > Add or Edit: **Track length (metres)** has a calculator: *Calculate from track pieces...*, then number of pieces x length of one piece in mm (add a row for every kind of piece), and *Use this length*. Older text lengths are read as metres where possible.
3. Layouts: new **Speed** widget. Choose scaled speed (as a real car, 1:1) or real speed, km/h or mph, and whether it uses the last, best or average lap. It needs the track length; scaled speed also needs the scale (the car's own, or the track's). It is the average speed over the lap, not a top speed.

## What to try (batch F: small fixes)
1. Layouts > select a widget: new settings **Title in bold**, **Title takes its own space**, **Value in bold**, **Value in italic**. By default the title now sits in the corner and no longer pushes the value down (older layouts change accordingly; switch "Title takes its own space" on to get the old look).
2. New **Car** widgets: *Slotcar picture* (with its own position and zoom) and *Slotcar name, make and model*. They show the car assigned to that lane.
3. The **Avatar** now fills the whole widget instead of being round.
4. The **Race clock** always reads 00:00.0 (minutes:seconds.tenths).
5. **Gap to leader** is always a time. A lapped car is compared with the leader at the same lap count.
6. **Last laps** shows lap numbers when more than one lap is shown (can be switched off).
7. Layouts now have a **Note** (in the editor bar, shown in the layout list).

## What to try (batch E: fuel and pit stops)
1. Race Setup > edit a setup: set **Fuel** to On. Then set tank size, fuel per lap, refuelling speed and what happens when the fuel runs out: the car retires, laps stop counting until it has refuelled, or only a warning. (The penalty option comes later.) "Pit stop: the sensor must be blocked this long" (default 2 s) works with or without fuel.
2. Layouts: add the **Fuel** widget (number, bar, bar and number, or your own pictures; choose how many pictures, e.g. 10, and add one for each step from full to empty; colour limits for low and critical fuel are in its settings) and the **Pitstop time** widget. The Leaderboard also has a "Fuel left" column.
3. Race with "Simulated cars" ticked: the cars drive, use fuel and pit by themselves when low.
4. By hand: Shift + a lane number (or the "Pit" button of that lane) puts the car on the sensor (counts as a crossing). After the hold time the stop starts and the tank fills up. Press again ("Leave pit") to drive off. The Pitstop time widget shows how long the sensor was blocked.
5. A car that retires is ranked behind the others (gap shows "Out") and is marked in the saved results and the PDF.

## What to try (batch D: picture framing and Race Setups views)
1. Database > Tracks, Drivers or Slotcars > Add or Edit: under the picture there is now a frame. Drag the picture to move it, use the Zoom slider to zoom, Reset to start again. Switch to Grid to see the result on the card. (A new picture starts centred.)
2. Layouts: add or select an **Avatar** widget. In its settings you can frame the driver pictures separately for that widget (the preview uses the first driver that has a picture).
3. Race Setup > Race setups: there is now a List / Grid switch. The list is shorter (name, track, session type, laps or time). The grid shows the track's picture (with the framing you gave it), name, session type, track and laps or time.
Pictures you add from now on are stored a bit larger (512 px) so zooming stays sharp; older pictures keep their size.

## What to try (batch C: start lights and records)
1. Race Setup > edit or add a setup: two new fields, "Start lights: shortest / longest wait before lights out (seconds)" (default 1 and 5).
2. Start a race (Space). Five lights come on, one per second. When all five are lit, a random wait between your two values starts, then the lights go out and the race begins. Add the Start lights widget to your layout to see them.
3. Database > Results and Records: each Track record and Personal best has a Remove button. It removes the record only; the lap stays in its session and the next fastest lap takes over. Highlights and the record widgets during a race follow this too.

## What to try (batch B: new widgets)
In Race Setup > Layouts, edit a layout and add the new widgets from the left list:
1. **Callsign** (per lane): the driver's 3-letter callsign.
2. **Last lap**: set "Laps per column" (e.g. 10) and "Columns" (1 to 3). The newest lap is top-left and the list fills column by column.
3. **Race flag**: upload a picture for each state (Ready, Get ready, Racing, Paused, Heat finished, Finished, Yellow, Red). A state without a picture shows text. Transparent PNGs keep their transparency.
4. **Race clock**: turns yellow or red with the flag (switch off in its settings).
5. **Session record lap** and **Track record (ever set)**: time plus the name of who set it (the name can be hidden).
6. **Leaderboard**: live standings. Choose the driver column (name, nickname or callsign) and extra columns. Rows use lane colours if you set them.
Then start a race with that layout (tick "Simulated cars") and watch them work.

## What to try (batch A: the layout editor)
1. Race Setup > Layouts > open or create a layout. The snapping grid is finer (half the old step) and the corner handles are smaller.
2. Titles: every widget now shows its name as a small title. Select a widget to rename the title, hide it, or change its size.
3. Select several widgets: Shift-click, drag a rectangle over empty canvas, or Ctrl+A. Drag them together; the side panel changes all of them at once. Delete removes them.
4. Duplicate (next lane): the copy goes to the next lane, just below. Move that copy where you want it and the next Duplicate repeats the same step.
5. Guidelines: the button asks for lanes (2-8) and a direction (vertical, horizontal or both) and places evenly spaced lines that widgets stick to.
   They only show in the editor; click the button again to remove them. They are saved with the layout.
6. Lane colours: set a text and a background colour per lane (up to 8). All widgets of that lane use them unless the widget has its own colour.
   Lanes now go up to 8 in the lane picker.

Run `npm test` to check the race rules on their own.

## Structure
- renderer/database.js  The Database tab (lists, forms, extra fields).
- renderer/canvas.js    Builds and paints a timing page from a layout (used by the race screen and the Live Race pages).
- renderer/liveshare.js Packs the running race into plain data and rebuilds it in another window.
- renderer/review.js    The end-of-race review (corrections before results are saved).
- renderer/liveview.js  The Live Race tiles and read-only pages.
- renderer/help.js      The App Settings > Help tab: the welcome and the folders (tested by tests/help.test.js, which also checks that every name in the text exists in the app).
- renderer/speed.js     Track length from pieces, speed and scale sums (tested by tests/speed.test.js).
- renderer/stats.js     The extra figures of Results and Records (average and median lap, consistency, speed, distance, pits, penalty points) and the columns of the tables (tested by tests/stats.test.js).
- renderer/viewset.js   View settings: which columns of a table are shown, and what is kept (tested by tests/viewset.test.js).
- renderer/theme.js, themeui.js  The colour themes and your own Custom colours, and the App Settings > App Theme tab (tested by tests/theme.test.js). The colours of the ready-made themes are written down once, in styles.css.
- renderer/banner.js  The Home header picture: its height, the part of the picture that shows, and dragging (tested by tests/banner.test.js).
- renderer/frame.js  The frame of a widget: border shade, no border, transparency and rounded corners (tested by tests/frame.test.js).
- renderer/backdrop.js  The background picture of a timing page and its filters: blur, brightness, colour (tested by tests/backdrop.test.js).
- renderer/report.js    The printable session report (tested by tests/report.test.js).
- renderer/timing.js    Works out what every widget shows (tested by tests/timing.test.js).
- renderer/widgets.js   The widget list, snapping/resizing rules and the default layout (tested by tests/widgets.test.js).
- renderer/editor.js    The Race Setup tab and the layout editor.
- renderer/engine.js    The race rules (finish conditions, standings, gaps), tested by tests/engine.test.js.
- renderer/race.js      The live timing page (tested end to end by tests/live.test.js).
- renderer/widgets.js  also holds the colour check (cssVal) that keeps odd values from imported files out of the page.
- renderer/widgetbuilder.js  Customization > Widget Builder (your own text and image widgets).
- renderer/announcer.js, sound.js, audioedit.js  What the race says, how it is played, and the Audio Settings screen.
- renderer/trackmate.js, hardware.js, hardwareui.js  The Trackmate Interface: the byte stream, the USB connection and its screen.
- renderer/arduinobox.js, arduinosim.js, arduinorace.js, arduinoui.js, arduinosketch.js, zipfile.js  The Arduino box: the protocol, the virtual box, the race glue, its page and the embedded sketch. The source of the sketch is in firmware/SlotForgeBox/, the desktop test bench in tools/fwhost/, the AVR compile check in tools/avrcheck/, the documents in docs/arduino-box/.
- renderer/rows.js, richtext.js, landing.js, app.js, webapi.js  Leaderboard rows, the Racing Rules text, the Home tab, the tabs and App Settings, and the browser version of the api.
- transfer.js, renderer/transferui.js  Export and import of single items; backup.js is the complete backup (tested by tests/transfer.test.js and tests/backup.test.js).
- server.js, qr.js  The network access for tablets and phones, and its QR code.
- migrate.js    On the first start after the rename, copies the data of the old Slot Lap Timer folder to the new one (tested by tests/package.test.js).
- schema.js     One definition per kind of item (tracks, slot cars, drivers, race setups). Add a field here and it appears everywhere.
- db.js         The database file (JSON, saved safely) behind a small add/update/remove interface.
- main.js       Electron entry point.
- preload.js    The only bridge between the window and the database.
- renderer/     The screens.

## Build a Windows installer
   npm run dist

## What to try (batch K2: fuel rules, v0.23.0)
- **Race Setup > Fuel rules** (next to Penalty systems): make a rule with tank size, litres per lap, an optional **target lap time**, and the two limits (**most extra fuel a fast lap uses %**, default 25, and **most a slow lap saves %**, default 30). Fuel used = litres per lap x target / lap time, kept inside those limits. No target time = every lap uses the same.
- In a **Race setup**, pick the rule under *Fuel rules* ("No fuel" = off).
- Old race setups that had fuel switched on are converted into a fuel rule automatically.

## What to try (batch L1: leaderboard row designer, v0.24.0)
- **Customization > Leaderboard rows > New row design.** You design ONE row: it opens with position, flag, name, laps, best lap and gap. Add other driver widgets from the list on the left (nickname, callsign, avatar, car picture, car name, last/average lap, fuel, penalty points, championship points, speed...). Drag and resize them like in the Layout Editor, or type the exact place and size in the side panel.
- Top bar: **Row height**, **Space between rows**, **Header row** (column titles come from each widget's "Header text"), and **Colours...** (row, every second row, header, and colours for leader, in the pits, penalty to serve, out of the race).
- The preview under the row shows five sample rows: leader, normal, in the pits, penalty, out.
- **Use it:** in the Layout Editor select a Leaderboard widget and pick the *Row design* (the classic column choices disappear while a design is chosen), or open **Live Race > Leaderboard** and pick it under Customize. Second screens get the designs automatically.

## What to try (v0.24.1)
- Review: **Restore** (was Undo clear) brings cleared penalty points back. **Delete all data** next to Finalize ends the race and saves nothing (in a heat race that includes the earlier heats).
- Row designs: **Rounded corners** in the top bar (default 25% of the row height, 0 = square).

## What to try (v0.25.0)
- **Live Race > Leaderboard > Customize:** *Boards shown: Two*, arranged one under the other or side by side. Each board has its own row design (or classic table settings).
- **Lane colour widget** (Driver group in the Layout Editor and the row designer): shows the colour you gave that lane under *Lane colours* in the layout. Use it as a coloured strip or block in a row.

## What to try (v0.25.1)
- **Lane colour widget:** select it and use *Background colour* (untick "Theme default") to give it its own colour. It then ignores the layout's lane colour, and the other widgets of that lane keep using the lane colour.

## What to try (batch J: network access, v0.26.0)
No new `npm install` is needed. The first time, Windows may ask whether the app may use the network: allow it on **private networks**.
1. **App Settings > Network access:** tick *Share on my network* (port 8787 unless you change it) and type a **password** for the Race Director.
2. The address and a **QR code** appear. Open it on a tablet or phone on the same wifi (scan the code with the camera).
3. The browser opens the **Live Race pages**: race timing, leaderboard (your row designs, one or two boards), driver stats, database (read only) and racing rules. Start a race on the PC and watch it follow along.
4. **Race Director** on the tablet asks for the password, then has the same buttons and penalty controls as on the PC. With no password set it stays closed to other devices.
5. A browser can only watch: nothing can be changed in your database from it. Changing the password logs every device out.
6. Choices made on a device (such as the leaderboard board settings) stay on that device. Audio will only play on the main PC.

## What to try (UI batch, v0.27.0)
- **Tabs renamed:** Race Setup > *Race Setups, Fuel Setups, Penalty Systems*. Customization > *Layout Editor, Leaderboard Editor, Audio Settings, Image Settings*. App Settings > *General, Network*.
- **Customization > Image Settings:** make a **picture set** for the Fuel widget (full to empty, 2 to 20 pictures) or the Race flag widget (one picture per state). In the Layout Editor choose the set in the widget under *Picture set*; the same set works in every layout. A widget that already has its own pictures has a button *Save this widget's pictures as a set*.
- **Racing Rules** is now a small text editor: bold, italic, underline, size, colour, heading, bulleted and numbered lists, clear formatting. Older plain rules still show. The Live Race rules page and tablets show the formatting too.
- **Live Race tiles** have icons.

## What to try (Audio batch, v0.28.0)

1. **Customization > Audio Settings > New audio set.** Every call starts switched on with a few ready-made sentences. Pick a Windows voice, speed, pitch and volume, and choose whether drivers are called by name, nickname or callsign.
2. **Calls**: start lights, lights out, new leader, a driver moving up, last lap, fastest lap, track record, personal best, yellow / red / green flag, race finished, winner. Switch a call off with its checkbox.
3. **Several sentences per call**: press *Add a sentence*; one is picked at random each time. Use placeholders such as `{driver}`, `{other}`, `{time}`, `{position}`, `{laps}`. Press *Test* to hear one sentence with example values.
4. **Sound files**: choose an audio file (up to 1.5 MB) for a sentence; the file plays instead of the spoken text.
5. **Race Setup**: choose the set in the new *Audio set (announcements)* field. "No audio" keeps the race silent.
6. Start a race (with the simulated cars) and listen. Sound plays on the computer that runs the race, not on phones or tablets.
7. Pit, fuel, penalty and podium calls came in the next step.

### Audio v0.28.1: start countdown
Each of the five start lights now has its own call: 5, 4, 3, 2, 1 (under Start in an audio set). Each can have its own sentence or sound file. "Drivers, get ready" is now off in new sets so it does not talk over the 5; switch it on if you want both. Older sets get the countdown automatically.

## What to try (Audio step 2, v0.29.0)

New calls in every audio set (older sets get them automatically, with the ready-made sentences):
- **Halfway** (half the laps of a race by laps with 4 or more laps, or half the time of a timed race).
- **Pit and fuel**: a car stops in the pits, leaves the pits, is low on fuel (once, at 25% of the tank, again after a refill above 50%), is out of fuel.
- **Penalties**: penalty points given (`{points}`), a special penalty (`{penalty}`, e.g. drivethrough), disqualified. Corrections made in the end-of-race review are not announced.
- **Podium**: after the winner, second and third place are called (`{position}`).
Try it with the simulated cars, a fuel setup and a penalty system, giving penalties with the buttons on the live page.

## What to try (small extras, v0.29.1)

1. **QR code on paper**: App Settings > Network, switch sharing on, press *Save QR code as PDF* under an address. Print the A4 page; spectators on the same wifi scan it from the print.
2. **Clear qualifying result**: on Home, when a qualifying winner is shown, press *Clear qualifying result*. The winner note and lane choice disappear for that track. A newer qualifying brings the winner back.

### v0.29.2
`{other}` in the overtake call is now the driver who was directly in front and has really been passed (works with any number of lanes). A car that goes into the pits, retires or is disqualified is not announced as "passed". At most 2 position changes are called at once.

### v0.29.3: race distance call
The "Halfway" call is now **Race distance reached**. In the audio set, fill in the distances in percent, for example `25, 50, 75` (default 50, empty = never). A race by laps counts the leader's laps, a timed race the elapsed time. Each distance is called once. Placeholders: `{percent}`, `{driver}` (the leader), `{left}` (for example "5 laps" or "2 minutes") and `{laps}`. Sets that had sentences for the old Halfway call keep using them.

## What to try (Trackmate step 1: connection monitor, v0.30.0)

Nothing in a race changes yet. This step only lets us see what the Trackmate sends.
1. Plug in the Trackmate USB interface (and the track power / sensors as normal).
2. App Settings > **Timing hardware**. Press **Find a COM port device** (try this first). If the Trackmate is not listed, press **Find a USB (HID) device** instead. Pick it from the list.
3. Press **Connect**. For a COM port keep the speed at 115200 first; if you see only rubbish, try the other speeds (a COM port needs the right baud rate).
4. Drive a car (or wave a metal object/magnet) over each lane's sensor a few times. Lines appear in the log: time, size, hex bytes and text.
5. **Copy log** (or **Save log**) and send it to me, together with: which lane you triggered in which order, what Windows Device Manager shows for the device (Ports (COM & LPT) or Human Interface Devices), and the speed you used.
Use *Send* only if we decide to try sending something to the device.

### v0.30.1: more to look at
The monitor now also logs the port's status lines (CTS, DSR, DCD, RI) whenever one changes, can switch DTR and RTS on or off, and offers lower speeds (300 to 4800), data bits, parity and stop bits. Break conditions are logged as ERROR lines.

## What to try (Trackmate step 2, v0.30.2)

What is known so far (9600 baud, 8 data bits, no parity, 1 stop bit): the Trackmate sends `W` for the Trackcall button and `A`, `B`... for lane 1, 2... sensors, but only after it has been given setup commands.
1. App Settings > Timing Hardware, find the COM port, speed **9600**, press **Connect**.
2. Set *Lanes* to 2, *Sensors* normally closed (the usual for the Trackmate infrared sensors; try normally open if nothing happens), *Debounce* 1.
3. Press **Send Trackmate setup**. The log shows the commands sent (`->`).
4. Drive a car over each lane's sensor. The log shows `lane 1 sensor` / `lane 2 sensor` and other bytes. Press the Trackcall button too.
5. Copy the log and send it. If lane hits do not show, repeat with *Sensors* on the other setting, and with debounce 0.
*Track power on / off* switch the track power through the interface; be ready for the cars to move.

### v0.30.3: readable Trackmate log
After the setup commands the Trackmate sends a "200" message (digits, LF, CR) every 200 ms. The monitor now counts these steady ticks ("ticks received") instead of listing them; untick *Hide the steady 200 ms ticks* to see them all. A tick with a different number, a lane sensor (A, B...), the Trackcall button (W) and anything unknown are always listed. Test: connect at 9600, Send Trackmate setup, then drive a car over each sensor (and press Trackcall) and send the log.

## What to try (Trackmate connected to the race, v0.31.0)

1. **App Settings > Timing Hardware**: *Find the Trackmate (COM port)*, choose it, *Connect*. The setup (lanes, sensor type, debounce) is sent automatically. Leave *Remember this device and connect automatically* ticked: next time the app starts it connects by itself when the Trackmate is plugged in (nothing to click). Sensors: normally closed is the usual; switch to normally open if laps do not register.
2. **Home**: start a race. The race screen shows "Trackmate connected" next to *Simulated cars* (leave that unticked). The setup is sent again with the track's number of lanes.
3. Start the race and drive: each pass over a lane's sensor counts a lap for that lane (a car sitting on the sensor counts once). The times come from the Trackmate's own clock, so USB delays do not matter.
4. **Race Setup > Trackmate Trackcall button**: one press = yellow flag, two presses within 2 seconds = red flag (the race stops; one press while stopped starts it again). You can also choose yellow only, red only, or nothing, and change the 2 seconds.
5. Audio calls (yellow / red / green flag) play as usual. Unplugging the cable mid-race leaves the keyboard keys and Lap buttons working.
6. If the connection fails at startup, nothing is shown; open the Timing hardware page and press Connect by hand.

### v0.31.1: which lane each sensor counts for
App Settings > Timing Hardware > *Which lane does each sensor count for?* Choose a lane for a sensor and the sensor that had that lane takes over the other one (swap). Use it when the sensor leads are plugged into the other lane. Takes effect at once, also in the next race. The number of sensors shown follows the *Lanes* field.

### v0.31.2: track power relay
- The *Track power on / off* buttons were reversed for your relay. A new setting *Power relay* (normally open / normally closed) decides which command means "on"; it starts as **normally open**, which is the other way round from before. Press *Track power on* to check; if it is still wrong, switch the setting.
- New Trackcall choice in Race Setup: **Each press switches the track power off or on (the Trackmate relay)**. It works as soon as the race screen is open, in any phase, and does not flag the race. The race screen shows "track power on/off" next to the Trackmate status.

## What to try (v0.32.0: Trackcall and power choices, start power, first lap)

**Race Setup > Trackmate Trackcall button** now has these choices:
- one press yellow, two quick presses red (no power change) · **one press yellow with power staying on, two quick presses red and power off**
- each press yellow on/off · **yellow flag turns the power off** (and back on when the yellow flag ends)
- each press red flag (stop/restart) · **red flag turns the power off** (and back on when the race restarts)
- each press switches the power · nothing.
The power also follows these flags when they are raised with the keyboard (Y / R) or by the Race Director. When the race ends, the power comes back on.

**Race Setup > Track power when a race starts**: *On* (power during the light countdown) or *Off* (power comes on as the lights go out). With Off, the power is also switched off when the race screen opens.

**Race Setup > First crossing of the start line**: *Only starts the timing* (new default; existing setups were switched to it): the first time a car crosses the sensor after the start does not count a lap, so there is no short lap from the grid. Lap 1 is then timed from that crossing. Choose *Counts as a lap* for the old behaviour.
Both only work with the Trackmate connected (the power part); the first-crossing choice works with keys and simulated cars too.

## What to try (0.32.1): Trackcall button speed
The Trackmate box only reports the Trackcall button about once every 2 seconds, so presses in between never reach the app. The double-press window now defaults to 3 seconds (change it in Race Setup; existing setups keep their own value).
1. **App Settings > Timing Hardware**, connect, and open **Monitor and advanced settings**. Every button press in the log now says how many seconds after the previous press it came.
2. Set **Debounce** to 0, press **Send setup now**, and press the button quickly 5 times. Note the gaps. Repeat with debounce 9. If the gaps stay around 2 s, the lockout is in the box and cannot be changed.
3. Copy the log and send it to me with the debounce values you tried.

## What to try (0.33.0): countdown clock
1. Race Setup > Layouts: select the **Race clock** widget. New setting **Count down the time left in a race with a time limit** (on by default).
2. Start a timed race or qualifying session (or heats counted by time): the clock counts down from the duration to 00:00.0. A race counted in laps, or free practice, still counts up. Switch the setting off to count up in a timed race.

## What to try (0.34.0): custom text widgets
1. Race Setup > Layouts > edit a layout. The widget list has a new **Custom** group with **Custom text (per lane)** and **Custom text (race)**.
2. Add one and select it. In the settings, type your own line in the **Text** box and put `{variables}` where a value should appear.
   - Per lane: `{name} {nickname} {callsign} {car} {position} {lap} {laps} {last} {best} {avg} {gap}`, for example `{position}. {name}  {best} ({gap})`.
   - Race: `{clock} {timeleft} {lapsleft} {leader} {flag} {heat}`, for example `{timeleft} left, {leader} leads`.
3. The preview in the editor fills the line with sample values. A word in braces that is not in the list stays as typed, so a typo is easy to spot.
4. Size, colours, bold/italic and the lane work like on every other widget; the title is hidden by default (tick **Show title** to get it).
5. Start a race and check the line changes as the race goes on. It also shows on the live page and in row designs (per lane version).

## What to try (0.34.1): all variables in the custom text widgets
1. Layouts > add a **Custom text (per lane)** or **Custom text (race)** widget. Under the Text box a list shows every variable and what it means.
2. Per lane now also has: `{lane} {laptime} {median} {record} {fuel} {fuelpct} {penpoints} {pentime} {champ} {pits} {pit} {speed} {speedreal}`.
3. Race now also has: `{lapstotal} {track} {session} {type} {sessionrecord} {sessionrecordby} {trackrecord} {trackrecordby}`.
4. A value that does not apply (no fuel in this race, no penalty system) shows a dash.

## What to try (0.35.0): Widget Builder
1. **Customization > Widget Builder > New widget.** Give it a name, choose **Per lane** (one for each car) or **Race** (one for the whole race), and type the text. Press a variable button to put it in the text at the cursor. The preview shows sample values. Set the width, height, text size, bold and italic, then **Save**.
2. **Customization > Layout Editor**: edit a layout. Your saved widgets are in the list under **My widgets** (the Leaderboard Editor lists the per-lane ones). Pressing one adds a copy with its text, size and look, ready to move; colours and lane are set like on any widget.
3. Change or delete the widget in the Widget Builder: layouts that already use it keep their copy, as you chose.
4. **Duplicate** in the Widget Builder makes a variation of a widget quickly.

## What to try (0.35.1)
The two **Custom text** buttons are gone from the Layout Editor's widget list: make those in the Widget Builder instead. Layouts and saved widgets that already use them keep working.

## What to try (0.36.0): custom image widgets
1. **Customization > Widget Builder > New widget**, then choose the kind **Image, per lane** (one for each car) or **Image, race** (one for the whole race).
2. Choose a **fixed picture** (shown when no rule matches) and whether it shows whole or fills the widget.
3. **Add a rule**: pick a variable, a comparison and a value, and the picture to show. Examples: `{position}` is `1` shows a trophy; `{fuelpct}` is less than `30` shows a fuel warning; (race) `{flag}` is `Red flag` shows a red picture. The first rule that is true wins. Numbers are compared as numbers; words ignore capitals.
4. Save, then add it from **My widgets** in the Layout Editor. Run a race and check the picture changes.

## What to try (0.37.0): export and import
1. **App Settings > Import and Export.** Under **Export**, open a group (Database, Look and sound, History) and tick items: a single layout, one driver, a whole race setup, sessions... **All ...** ticks a whole list.
2. Leave **Also include what the ticked items use** on to take, for example, a race setup together with its track, layouts, picture sets and audio set. Turn it off to take only the ticked items (links to anything not in the file are emptied on import). Sessions always bring their laps, track, drivers and slotcars.
3. **Export ... to a file** asks where to save a `.json` file.
4. On the same or another computer: **Choose a file to import**. The app lists what the file holds; **Add to my data** adds it as copies. Nothing you have is changed or overwritten. Links between the items are kept (a race setup keeps its track and layout). A name you already have gets "(imported)" after it, and importing the same file twice makes two copies.
5. Custom fields (Database > custom fields) travel along: a field with the same name and type is reused instead of made twice.

## What to try (0.37.1): choose what an export takes along
1. The tab is now called **Import and Export**. The groups you open (Database, Look and sound, History and the lists inside them) stay open while you tick boxes.
2. The single "Also include..." tick box is gone. Once you tick items, a section **Also take what these items use** lists the actual things they use (a race setup's track, layout, picture sets, audio set, fuel rule...), each with its own tick box and an **all** box per kind. They start ticked; untick what you do not want, for example the track, and keep a picture set.
3. Things a ticked session needs (its track, drivers, slotcars) are shown but cannot be unticked.
4. Import is unchanged: links to anything left out of the file are emptied on import.

## What to try (0.38.0): widget folders, new names, Logo widget
1. **Layout Editor** (and Leaderboard Editor): the widget list is now a set of folders. Click a group's name to open or close it; the list remembers what you opened while the app runs. Groups: Driver, Slotcar, Timing, Timing Records, Race, Controls, and Custom (your Widget Builder widgets; only shown when you have some).
2. Widgets have their new names (Position in Race, Lap of Lap, Laptime, Best Lap (this session), Gap to Leader, Fuel Level, Slotcar Speed, Slotcar Description, Race Clock...). Record Lap Time, Session record lap and Track Record are in the new **Timing Records** group.
3. The titles that existing widgets show on the timing page are unchanged, so your layouts look the same.
4. New **Logo** widget (Race group): choose your club logo in its settings and whether it is shown whole or fills the widget. It is shown on the timing page and on the live page.

## What to try (0.38.1)
The **Race** folder is now first in the widget list, above Driver. **Session record lap** is renamed **Session Record Lap** (its title on the timing page stays "Session record lap").

## What to try (0.38.2)
1. App Settings > General: the "come in later phases" line is gone.
2. Layout Editor > select a **Race Flag** widget: the eight picture upload fields are gone. Choose a picture set (made under Customization > Image Settings), or choose None to show the flag's name as text. A flag widget that still had pictures of its own keeps showing them, and **Save this widget's pictures as a set** moves them into a set.
3. **Start Lights** are now drawn as one picture that scales with the widget, so the lights stay round at any size or shape of widget. Resize the widget (wide, tall, tiny, huge) and run a start.

## What to try (0.39.0): fuel pictures, custom Start Lights, audio variables
1. **Fuel widget**: the picture upload fields are gone, like on the flag. Choose a fuel picture set in the widget; a fuel widget that still had pictures of its own keeps showing them, and **Save this widget's pictures as a set** moves them into a set.
2. **Customization > Image Settings > New picture set**: the new type **Start lights (a lit and an unlit light)** has two slots, *Light off* and *Light on*. Save it, then select a **Start Lights** widget in the Layout Editor and choose the set. The same two pictures are used for all five lights; a light without a picture stays a plain round one.
3. **Customization > Audio Settings > a set**: the note above the calls is now a folder, **How sentences work, and the variables you can use**, with a table of every variable: what it says, an example and which calls use it. Calls about a lap time (fastest lap, track record, personal best) now also list `{lap}`.

## What to try (0.39.1): Start Lights follow the race, Timing Hardware sub-tabs
1. **Layout Editor > Start Lights widget.** For every state of the race (Ready, Racing (green flag), Paused, Heat finished, Finished, Yellow flag, Red flag) choose **how many of the five lights are on** (None to All 5) and **their colour**. During the countdown the lights still come on one by one. By default nothing is lit outside the countdown, so existing layouts look the same. Try: Racing = All 5 lights green, Yellow flag = All 5 yellow, Red flag = All 5 red. (With a picture set the lit picture is used and the colour is ignored.)
2. **App Settings > Timing Hardware** (capital H) now has two sub-tabs: **Trackmate Interface** (everything that was there) and **Other** (empty for now). The connection stays open when you switch tabs.

## What to try (0.40.0): start lights that follow the race flag
1. **Race Setup > a setup**: new choice **Start lights after the race has started**: *They go out* (as before) or *They follow the race flag*.
2. With *follow*, a **Start Lights** widget shows all five lights green while racing, all five yellow after a yellow flag and all five red after a red flag (and goes dark again when the flag is lifted). During the countdown the lights still come on one by one; Paused, Heat finished and Finished stay dark unless you set them on the widget.
3. The widget's own choices win: if you set "Red flag: lights on" to 2 lights on the widget, that widget shows 2 red lights even when the setup follows the flag. Leave a state on its default to follow the setup. The colours can be changed on the widget.

## What to try (0.41.0): the start lights count down again after a red flag
1. **Race Setup > a setup**: new choice **Restarting after a red flag**: *The start lights count down again, then the race goes on* (the default, also for setups you made before) or *The race goes on at once* (as it was).
2. Start a race and press **R** (red flag): the race stops. Press **R** again: the lights come on one by one like at the start, the usual wait follows, and at lights out the red flag is cleared and the race goes on. The Start Lights widget and the Race Flag widget show the countdown ("Get ready"), the race clock stays where it was stopped, and the audio set says the countdown and "lights out" like at a start.
3. During the restart cars crossing the line are not counted and a yellow flag is ignored. Press **R** again (or stop the race) to cancel the restart: the race stays under the red flag until you press **R** again.
4. With Trackmate power following the red flag, the track stays off during the countdown and comes on at lights out. The Trackcall button lifts the red flag the same way.
5. A plain **Pause** and **Resume** (Space) is unchanged: the race resumes at once.

## What to try (0.41.1): the Race Flag widget always shows a flag
1. The **Race Flag** widget no longer has a "Get ready" countdown state. Before the race and during its start countdown it shows **Ready**; during the countdown of a restart after a red flag it keeps showing the **red flag** until lights out; then **Racing**.
2. A flag picture set has one picture less (seven states: Ready, Racing, Paused, Heat finished, Finished, Yellow flag, Red flag). A picture saved earlier for "Get ready" is simply not used.
3. The lights themselves still count down in the **Start Lights** widget.

## What to try (0.42.0): a track length for each lane
1. **Database > Tracks**: the track length is now the length of the **outside lane**. Two new fields: **The track length is that of** (the last lane, the default, or the first lane) and **Distance between the lanes** (millimetres, default 100). Existing tracks use the last lane and 100 mm.
2. Every lane further in is shorter by about 0.63 m at 100 mm (2 x pi x the distance), because the lanes run side by side and only the corners differ. A track with 4 lanes and an outside length of 20 m gives about 20.0, 19.4, 18.7 and 18.1 m.
3. The **Speed** widget and the `{speed}` / `{speedreal}` variables use the length of the car's own lane. A track without a number of lanes keeps one length for all cars.

## What to try (0.43.0): penalty points for driving on an empty tank
1. **Database > Penalty systems**: new field **Penalty points for every lap driven on an empty tank** (empty or 0 = none, the default). Fill in, for example, 1 or 2.
2. **Database > Fuel setups**: set *When the fuel runs out* to **The car carries on**. (The other two choices are unchanged: retiring, or laps not counting, cannot give points because no lap is driven.)
3. In **Race Setup** choose that fuel setup and that penalty system, and start a race with a small tank. Every lap the car completes without enough fuel adds the points, shown by the usual penalty widgets and the penalty audio call. The points turn into time and disqualification through the penalty system as always.
4. Refuel in the pits (stop on the sensor) and the points stop. A race with no penalty system chosen gives no points.

## What to try (0.44.0): complete backup
1. **App Settings > Import and Export**: a new section **Complete backup** at the top. **Save a complete backup...** writes one file with everything: the database, layouts, pictures, audio sets, custom widgets, settings, past races and laps. The file name has today's date.
2. Change something (delete a driver, edit a layout), then choose **Restore from a backup...** and pick the file. The page shows when it was made and what it contains, with a warning. **Replace everything with this backup** asks once more, then the app reloads exactly as it was when the backup was made.
3. Before a restore, your current data is copied to `slot-lap-timer.before-restore.json` in the same folder as the database (the folder is shown in General), so a mistaken restore can be undone by hand.
4. A file made with **Export** is not accepted here (use Import for those), and a damaged file is refused before anything changes.

## What to try (0.45.0): a full check of the code
Nothing new to look at: this version is the result of reading all the code and testing it again. What was found and fixed:
1. **Installer**: the Windows installer (`npm run dist`) did not contain the import, export and backup code, so an installed copy would have stopped at start. Fixed; `npm start` was never affected. A new test checks that every file the app loads is in the installer.
2. **Fuel penalty**: a car disqualified by fuel points on its last lap was counted as having finished (and in "lead car finished" races that ended the race). It now has no finishing place and the race carries on.
3. **Leaving the race screen** before the start left the race keys (Space, Y, R, S, number keys) and the Trackmate listener active on the other pages. They are switched off when you leave.
4. **A damaged database file** is no longer overwritten by an empty one at the next start: it is kept as `slot-lap-timer.damaged-<number>.json` next to the database.
5. **Imported files**: colours and numbers that come from an imported file or a restored backup can no longer add anything to the page (timing page, editor, results list and the PDF report).
6. **The Layout Editor** leaves out widget types it does not know (from a file of another version) instead of stopping.
7. Smaller things: unused code removed, texts that were out of date updated (Race screen hint, README), and the backup page now says the file holds the Race Director password.
Try: save and restore a backup, open a layout, run a short race with fuel penalties, and press Space on the Database tab before a race has started (nothing should happen).

## What to try (0.46.0): programs you can share (no terminal for the people you share with)
For you, once (and again for each new version you want to share):
1. Optional: put your app icon at `build\icon.png` (a square PNG, at least 256 x 256).
2. Double-click **build-windows.bat**. It installs what it needs, runs the tests and makes the programs. The first time it takes a few minutes and needs internet. When it is ready the **dist** folder opens with two files:
   - `SlotForge Timing-<version>-Setup.exe`: a normal installer (choose the folder, desktop shortcut and Start menu entry, can be removed in Windows Settings).
   - `SlotForge Timing-<version>-Portable.exe`: nothing to install, double-click to run (also from a USB stick).
For the people you share with: they only need one of those files. No Node.js, no terminal.
Good to know:
- Windows may show a blue "Windows protected your PC" screen the first time, because the program is not signed with a paid certificate. They choose **More info** and then **Run anyway**.
- All versions keep their data in the same place (`%APPDATA%\slot-lap-timer`), so your own data is still there after installing, and a person who first tries the portable program and later installs keeps their data. Use the backup in App Settings > Import and Export to move data to another computer.
- Only one copy of the app can run at a time (a second double-click brings the first one forward), so two copies can never damage the database.
- Trackmate over USB and the second screen work the same as before. Windows may ask once whether the app may use the network (only needed for Network access).

## What to try (0.47.0)

- **App icon**: your picture is now the icon of the installer, the portable program, the desktop shortcut and the taskbar.
- **Flag icons**: they are now listed explicitly in the installer files, so the flags show in the installed and portable app too.
- Run `build-windows.bat` again, then install or start the new files from the `dist` folder. Check that the icon and the country flags look right.

## What to try (0.48.0)

The app is now called **SlotForge Timing**: window title, header, report footer, installer and portable file names, shortcuts, and the file names suggested when you save a backup or export.

- **Your data moves along**: the data folder is now `%APPDATA%\slotforge-timing` (database file `slotforge-timing.json`). The first time the new version starts, everything from the old `%APPDATA%\slot-lap-timer` folder is copied over. The old folder is left untouched as a safety copy, and data already in the new folder is never overwritten. Check that your tracks, drivers, cars and results are all there.
- **Old backups and exports still work**: files made under the old name (`slot-lap-timer-backup` / `-export`) restore and import normally. New ones carry the new name, so a new backup does not open in an old version.
- If you typed your own App name in App Settings, it is kept. Only the default name changed.
- Run `build-windows.bat` again: the files in `dist` are now called `SlotForge Timing-0.48.0-Setup.exe` and `...-Portable.exe`. Because the app ID changed, Windows treats the installed version as a new program, so an older Slot Lap Timer install can be removed in Windows Settings.

## What to try (0.49.0)

- **Racing Rules > Export to PDF**: the button under the text makes a neat A4 page with a title (your App name + "Racing Rules"), your rules with all their formatting (bold, colours, sizes, headings, lists) and the credit line at the bottom. You choose where to save it, ready to print and hand out. It uses what is typed so far, so you do not need to wait for "Saved."
- **Credit message**: at the bottom right of the rules text: "This App has been made by Claude AI and theDutchmanJames. For all Slotcar Enthusiast and special greetings to the SlotForum community!" It sits outside the editable text, so it cannot be deleted by accident, and it is also printed at the bottom of the PDF.
- Try a long rules text (more than one page) and check that headings and list items are not cut in half at the page break.

## What to try (0.50.0): a second full check of the code
Nothing new to look at: this version is the result of reading every file again, running the code with odd input and removing what is no longer needed. What was found and fixed:
1. **Round robin on a track with one lane** made the app freeze (the planning of the heats never finished). It now gives every driver one heat. A track saved with 0, a negative or a fractional number of lanes also no longer breaks the heat plan, and the track form now only accepts a whole number of lanes from 1 up (the minimum, maximum and lane distance fields no longer accept negative numbers either).
2. **Audio sets**: editing or duplicating a set put its "race distance" percentages back to 50. They are now kept.
3. **An import that fails halfway** (a damaged export file) used to leave the first half of its items in your data. Import is now all or nothing, with a clear message. A **restore** of a damaged backup is also refused as a whole and leaves your data alone, and a backup with unreadable items or custom fields is refused up front.
4. **Safer files**: the ids of items from a backup or an imported file are now always shown as plain text in the lists (a made-up file can no longer add anything to a page through them).
5. **Live Race pages** now open (empty, filling in as soon as a race starts) when the race data cannot be fetched, instead of staying blank.
6. **Smaller things**: a list of championship points with an empty piece (like `10, 8,, 6`) skips it instead of counting it as 0; the Test button in the audio editor, the per-lane widget list, the Race Director login check and the device chooser were tidied; old unused code was removed: a duplicate list of widgets, a duplicate way to reach the race engine in the tests, several exports nobody used, an unused tab option, an unused device parameter, and the old `reference/` prototype that the app never used.
Try: make a track with 1 lane and a round robin race setup and start it; edit an audio set that has its own distances; export something, restore a backup and import a file as before (nothing should look different); open the Live Race window.

## What to try (0.51.0): Home header height, a new Home title, and the App Theme tab
1. **Home title**: the Home tab now says "Welcome to the SlotForge Slotcar Timing App!" (fixed text; it does not follow the App name, which stays at the top of the window).
2. **Header height**: App Settings > General > Header picture now has a **Height** slider, from 5% to 60% of the window width, with the number shown next to it. The preview above it follows while you drag, and the setting is saved when you let go. Because it is a share of the width, the header looks the same in a small and in a large window; a picture that is taller than the chosen height is cropped (top and bottom). Tick **Automatic** to follow the shape of the picture again (never taller than 220 pixels). With no picture there is nothing to set.
3. **App Theme**: App Settings has a new sub-tab, **App Theme**, between General and Network. The Theme choice moved there from General (your chosen theme is kept). It shows every theme as a small tile with its four main colours, so you can see them before you choose. The theme also reaches tablets and phones that follow the race.
4. **Your own colours**: the last tile is **Custom (your own colours)**. Under the tiles there are six colour boxes: Background, Panels, Text, Quiet text, Lines and Accent, each with a note on where it is used. Click one to open the colour picker; the whole app changes while you choose, the Custom theme is switched on, and the choice is saved when you close the picker. The text on buttons in the Accent colour is made white or black automatically, whichever reads better. Choosing Custom for the first time starts from the theme you were using, so you only change what you want.
5. **Start from**: pick one of the ready-made themes in the list and press "Copy its colours" to use its colours as the start of your own (it asks first if you already made your own colours). Your own colours are kept when you switch to another theme and back.
6. **Warnings**: if your colours would be hard to read (text close to the background, quiet text almost invisible, an accent that blends into the background) a short red message appears under the colour boxes. It is only a warning; nothing is blocked.
Try: choose a theme tile and check the whole app; make your own colours (try a very light background with dark text, then a bad mix on purpose to see the warning); close and start the app again; open a tablet or phone page and check it has the same colours; choose a header picture, drag the Height slider, go to Home, then tick Automatic.

## What to try (0.52.0): choose which part of the Home header picture shows
When the header picture does not fit its box (a set height crops it), you can now choose which part of the picture stays in view instead of always the middle.
1. **App Settings > General > Header picture**: under the Height slider there are now **Left / right** and **Up / down** sliders and a **Center the picture** button. 0% shows the left (or top) of the picture, 100% the right (or bottom), 50% the middle.
2. **Drag the picture**: you can also drag the preview itself with the mouse (or a finger) and let go to save. The picture follows the pointer, so dragging it left shows more of its right side. The cursor turns into a hand when it can be moved.
3. A picture can only be cropped in one direction (sideways for a very wide picture, up and down for a tall one), so only that slider works; the other one is greyed out. A picture of exactly the shape of the box has nothing to move, so both are greyed out.
4. The preview has the same shape as the header on Home when a height is set, so what you see there is what Home shows, whatever the window size. With **Automatic** the position also works, but the preview is a little smaller than the real header, so it can differ slightly.
5. Choosing a **new picture** puts the position back in the middle. The position is saved with the other settings and is also in a backup.
Try: choose a very wide picture, set the Height to about 25%, drag the preview left and right, use the sliders, press Center, go to Home and check it shows the same part; then try a tall picture (up and down) and the Automatic option.

## What to try (0.53.0): calls from a lane
A call from a lane raises the yellow flag and waits for the Race Director, who decides what it means.
1. **Race screen**: next to the Pit buttons there is a **Call 1**, **Call 2**... button for every lane. The keyboard does the same with **Ctrl + the lane's number**. A call can be made while the race runs or is paused (not before the start or after the end).
2. **What a call does**: the yellow flag goes up (and the yellow flag sound plays, as always). If the red flag is up it stays red. A call never switches a yellow flag off. A lane that calls again while its call still waits does not make a second call, but the yellow flag comes back if the Race Director had lifted it.
3. **The Calls strip**: under the buttons in the race window a yellow-edged strip lists every call that waits: the lane, the driver, and two buttons: **Dismiss**, or **Penalty point** (one point for that driver, only with a penalty system and not for a disqualified driver). A decision does not lift the yellow flag: use Y or the Yellow flag button for that. When the race ends nothing waits any more.
4. **Race Director page** (the Live Race window, or a tablet after the password): a new **Calls** panel with a **Call lane 1**, **Call lane 2**... button for every lane, and the waiting calls with **Dismiss** and **Penalty point +1**. The panel is only updated when a call comes or goes, so a button never moves under your finger.
5. **The Trackmate**: the one Trackcall button (W) works exactly as before (the Race Setup choice: flags, power...). The Trackmate sends the same W whichever button is pressed, so it cannot tell the lanes apart. For call buttons per lane on the hardware I need to know what they send: App Settings > Timing Hardware, connect, press the call button of each lane one by one and send me the log (bytes the app does not know are always listed). The app side is ready: when a call comes in from lane N it does the same as the Call button.
Try: start a race (Simulated cars is fine), press Ctrl+1 and watch the yellow flag and the strip; give a Penalty point from the strip and check the point on the Race Director page (or in a Penalty points widget); call lane 2 from the Race Director page on the second screen and Dismiss it from the race window; press Red flag and call again (the flag stays red); stop the race and check the strip is gone.

## What to try (0.54.0): the audio calls in folders
1. **Customization > Audio Settings > New audio set** (or Edit): the list of calls is now in folders, one per group: Start, Positions, Laps and records, Pit and fuel, Penalties, Flags and Finish. They are all closed when you open a set. Click a folder to open or close it. Each folder says how many of its calls are switched on, for example "6 of 7 calls on".
2. **Open all folders** and **Close all folders** are above the list. A folder you opened stays open while you work (adding a sentence, switching a call on or off, removing a sound file); opening another set starts with all folders closed again.
3. Nothing else changed: the sentences, the checkboxes and Test buttons are the same, inside their folder.

## What to try (0.55.0): how to install more voices
In **Customization > Audio Settings** (new or edit a set), hover the **Voice** choice, or the "ⓘ How do I get more voices?" text next to it. The tooltip says how to add voices and languages in Windows: Windows 11: Settings > Time & language > Speech > Manage voices > Add voices. Windows 10: Settings > Time & language > Language, add the language, and tick its Text-to-speech option. Then restart this app so the new voices show in the list.

## What to try (0.56.0): tidier widget settings, border colour and transparency
In **Customization > Layout Editor**, click a widget.
1. **Grouped settings.** The settings on the right are now folders: **Title**, **Text**, **Background and border**, and the widget's own settings (for example "Race Clock settings"). Click a folder's name to close or open it. A folder stays the way you left it when you click the next widget. Lane, Duplicate and Remove stay where they were.
2. **Border.** In *Background and border*, the **Border** choice has three options: *Theme default* (as before, nothing changes until you touch it), *Shade of the background* and *No border*.
3. **Border shade.** With *Shade of the background*, the slider makes the border from the widget's own background colour: 0% is white, 50% is exactly the background colour, 100% is black. It starts at 37.5%, which is the background with a quarter white added. The border follows the background when that changes (for example a colour that changes with the flag).
4. **Transparency.** The **Transparency** slider (0% solid, 100% invisible) fades the background and the border together. The title and the value stay fully visible. It works with a widget colour or the theme colour, and several widgets can be changed at once.

## What to try (0.57.0): rounded corners
1. **For the whole layout.** In **Customization > Layout Editor**, the top bar has a new **Rounded corners** field. 0 is square, 50 is fully round, and empty keeps the classic small corners (nothing changes until you fill it in). The number is a percent of each widget's shorter side, so a big and a small widget get the same look.
2. **For one widget.** Click a widget and open *Background and border*: **Rounded corners** there overrides the layout's setting. Empty follows the layout, 0 makes this widget square, and 50 makes it fully round. On a square widget that is a circle, so make an Avatar widget square (same width and height) and set 50 for a round avatar. On a long widget, 50 gives rounded ends.
3. The setting is saved with the layout and shows on the live timing page, the Race Director page and the tablets. Row designs in the Leaderboard Editor keep their own corner setting.

## What to try (0.58.0): a background picture for the timing page
1. In **Customization > Layout Editor**, the top bar has a new **Background** button. It opens *Page background*.
2. **Picture:** choose a picture (it is shrunk to 1920 pixels wide, so the database stays small). **Remove** takes it away again; without a picture the theme colour is the background, as before. **Fit** is *Fill the page* (crops the edges), *Whole picture* (bars at the sides) or *Stretch*.
3. **Filters:** **Blur** softens the picture so it does not compete with the numbers; **Brightness** makes it darker (or lighter); **Colour** goes from black and white (0%) to full colour (100%) and beyond. The filters only change the picture: widgets, text and their colours are never blurred or dimmed. **Reset filters** puts them back. The preview in the dialog has sample widgets so you can judge how readable the numbers are.
4. The picture is saved with the layout, so each layout can have its own. It shows on the race screen, the second screen, the Race Director page and the tablets and phones. Exporting a layout takes its picture along.
5. To see the picture through the widgets, give them some **Transparency** (Background and border, 0.56.0). The preview in the Layout Editor shows it too.

## What to try (0.59.0): one transparency setting for all widgets
1. In **Customization > Layout Editor**, click **Background**. At the bottom of *Page background*, under *Widgets*, is a new **Widget transparency** slider (0% solid, 100% invisible). It sets the look of every widget in the layout at once, also the widgets you add later. The sample widgets in the preview show it, and so does the Layout Editor behind the dialog.
2. It fades the widget background and border, never the text. It works with a background picture or without one.
3. **Per widget:** click a widget and look at *Background and border*. **Transparency** now has a tick **Same as the layout**, ticked for every widget that has no setting of its own (the slider is off and shows the layout's value). Untick it to give this widget its own value. It starts at what you see now, so nothing jumps. Tick it again to hand control back to the layout. A widget's own setting wins, also 0%, which keeps one widget solid in a see-through layout.
4. Widgets that already had their own transparency (from 0.56.0) keep it as their own setting. Layouts made before this version stay solid.

## What to try (0.60.0): track shape, for a figure-eight
The speed of a car uses the length of its own lane. On a loop (an oval, or any circuit that does not cross itself) each lane further in is shorter by 2 x pi (about 6.3) times the lane spacing: 100 mm gives 0.63 m shorter per lane. That is not "6.3 times shorter", the hint in the track form said it badly and now says it clearly. On a figure-eight the left and right bends cancel out, so all lanes are the same length, which the old rule got wrong.
1. In **Database > Tracks** (add or edit a track) there is a new **Track shape** choice, after the track length:
   - **Loop** (the default, also for every track you already have, so nothing changes): each lane further in is 2 x pi x the spacing shorter.
   - **Figure-eight**: all lanes have the length you entered. "The track length is that of" and "Distance between the lanes" are hidden, as they no longer matter.
   - **Other**: a field appears for the full turns the track makes (left bends minus right bends). 1 is a loop, 0 is a figure-eight, 2 is for instance two loops the same way round that cross over each other with a bridge. Each lane further in is that many times the loop difference shorter.
2. Try it on a track with 8 lanes and a length of 16 m with the Speed widget set to real speed: as a Loop the inner lanes get a lower speed for the same lap time (lane 1 is 4.4 m shorter than lane 8 at 100 mm), as a Figure-eight every lane uses 16 m.

## What to try (0.61.0): Lane length modifier (replaces Track shape of 0.60.0)
The lanes of a track are not equally long, and the speed uses the length of the car's own lane. In **Database > Tracks** (add or edit a track), set the track length, then choose a **Lane length modifier**:
1. **None** (the default for a new track): every lane has the track length.
2. **Calculated from the bends:** the track length is that of the outside lane, and each lane further in is shorter by 2 x pi x the lane spacing for every full turn of the track (100 mm gives 0.63 m per lane on a loop). It is the angle of the bends that counts, not how many there are: a circuit that does not cross itself makes 1 full turn whatever the mix of left and right bends (a lane 0.1 m further in came out exactly 0.628 m shorter on a test circuit with 10 changes between left and right). Use **Full turns the track makes**: 1 is a loop (the default), 0 is a figure-eight (all lanes equally long), 2 is for instance two loops the same way round that cross over each other with a bridge. "The track length is that of" (first or last lane) and "Distance between the lanes" show here.
3. **Measured:** enter the length of every lane, lane 1 first, separated by commas with a dot for decimals, for example `15.4, 15.8, 16.2`. Use it when the lanes swap sides (a lane changer, a crossover that swaps the lanes), when the spacing is not the same everywhere, or when you measured the lanes yourself. The track length can then stay empty. Saving is refused unless there is exactly one length per lane. A lane without a length of its own uses the track length.
4. **Tracks you already have** keep working as they did: they open as *Calculated from the bends* with 1 turn (a loop), so saving one again changes nothing. A track saved with 0.60.0's "figure-eight" shape opens as *None*.

## What to try (0.62.0): eight Trackmate sensors with check lights
In **App Settings > Timing Hardware > Trackmate Interface**:
1. **Eight sensors, A to H.** The code already handled all eight (sensor A is lane 1 ... H is lane 8); the page only listed as many as the **Lanes** setting, which starts at 2. It now always lists all eight. Sensors beyond **Lanes** are dimmed and their lane choice is locked, because the Trackmate only reports as many sensors as the number of lanes it is set to. Set **Lanes** to the number of sensors you have connected.
2. **Changing Lanes while connected** now sends the setup to the Trackmate straight away, so the new sensors start reporting without pressing *Send setup now*.
3. **Check lights.** Each sensor has a light that turns green while a car (or your finger, or a piece of card) is over it, and goes out about a second after the last signal. Connect, then trigger each sensor in turn to test it and its cable without starting a race. A car that stays over a sensor keeps the light on. The Trackcall button and the time messages light nothing.
4. The **lane choice** per sensor works as before (use it when the sensor leads are in the other lane). With **Lanes** at 8 each sensor can take any of the eight lanes.
5. If a sensor you have not connected shows green all the time, tell me which sensor type you use (normally closed or open); a lane with nothing plugged in might look triggered with normally closed sensors. I could not test this without the hardware.

## What to try (0.63.0): Flag style for the Race Flag widget: Flags, LEDs, Text or Image set
Select a **Race Flag** widget (Customization > Layouts, group Race). Its settings now sit under **Flag style**, with a choice of four:
1. **Flags:** a waving flag on a pole in the colour of the flag (blue ready, green racing, grey with pause bars paused, chequered at the end of a heat or race, yellow, red). Tick **Mirror the flag** for the pole on the right and the flag flying to the left, so you can make a left flag and a right flag.
2. **LEDs:** the same states as a round LED lens with a glow, drawn in the same style: blue, green, grey with pause bars, a chequered lens at the end, yellow, red. Nothing to set.
3. **Text:** the state as text (Racing, Paused, ...), and for yellow and red the background of the widget turns yellow or red. This is the look from before 0.62.1.
4. **Image set:** the pictures of a picture set (Customization > Image Settings) per state. A state without a picture shows its name as text.
5. Widgets you made earlier keep their look: one with a picture set shows **Image set**, one you had switched to text in 0.62.1 shows **Text**, the rest show **Flags**.
6. In the Flags and LEDs styles the widget background is not coloured, the picture carries the colour. Pole, outline and base follow the widget's text colour.

## What to try (0.62.1): coloured flag icons for the Race Flag widget (its choices were replaced by Flag style in 0.63.0)
The **Race Flag** widget (Customization > Layouts, group Race) no longer shows plain text by default. It draws a flag on a pole, in the same line style as the Live Race tiles, with the cloth in the colour of the flag:
1. **Blue** flag: ready, and while the lights count down. **Green**: racing. **Grey with pause bars**: paused. **Chequered**: heat finished and race finished. **Yellow** and **red**: the yellow and red flag. The red flag also shows during a restart countdown.
2. The pole and outline use the widget's text colour, so they follow your theme or your own text colour setting. The widget background is not coloured any more in this mode, the flag carries the colour.
3. Select the widget and look at **Show the flag as**: *A flag in its colour* (the default) or *Text (the background turns yellow or red)*, which is the old look.
4. A **picture set** (Customization > Image Settings) still wins: a state with a picture shows that picture, a state without one shows the flag drawn by the app (or the text).
5. The Yellow flag and Red flag **buttons** and the Race Director page are unchanged.

## What to try (0.63.1): Welcome Message in App Settings
1. **App Settings > General** now has a **Welcome Message** field under **App Name** (the label now has a capital N, like the new one). Whatever you type shows as the big title at the top of the Home tab. Leave it empty for the standard "Welcome to the SlotForge Slotcar Timing App!", which is also shown in the field as a grey hint.
2. It is saved when you leave the field. The text is shown as plain text, so characters like < and & appear as typed. The App Name at the top of the window is separate and unchanged.

## What to try (0.63.2): nothing to try, a test fix
One of the built-in checks (the Race Director page, Calls panel) failed now and then when the computer was busy: it looked at the page after a fixed pause of 150 ms, while the race shares its state with the Live Race pages at most about ten times a second, so the page could still show a call that had just been settled. It now waits for the shared state to catch up first (and the check no longer reuses leftovers of an earlier page). I tried to make it fail again with twelve copies of the test running at once on a busy computer and it did not. The check for the Trackmate sensor lights (0.62.0) also used real time, so it now runs on a fake clock. The app itself did not change: I checked how the Live Race page and the Race Director page get their data and found no such gap there.

## What to try (0.63.3): the zip is called SlotForgeTiming-x.y.z
Nothing changes in the app. The zip is now called `SlotForgeTiming-<version>.zip` and unzips into a folder called `SlotForgeTiming` (it was `slot-lap-timer`). The data of the app is not affected: it lives in `%APPDATA%\slotforge-timing`, not in this folder. A new folder next to the old one has no `node_modules`: run `build-windows.bat` there (it installs what it needs), or move the old folder's `node_modules` into the new one.

## What to try (0.64.0): a one-click builder and installer for Linux
Linux version of `build-windows.bat`. On a Linux computer, in the SlotForgeTiming folder:
1. Install Node.js (LTS, version 18 or newer) from https://nodejs.org or with your package manager.
2. Run **`./build-linux.sh`** in a terminal, or double-click it in your file manager and choose *Run in Terminal* (if it will not start: right-click it, Properties, Permissions, allow executing, or run `bash build-linux.sh`). It installs what it needs, runs the tests and makes the programs. The first time it takes a few minutes and needs internet.
3. It puts two files in the **dist** folder: `SlotForgeTiming-<version>.AppImage` (runs by itself on most systems, nothing to install) and `SlotForgeTiming-<version>.deb` (for Debian, Ubuntu, Mint: `sudo apt install ./SlotForgeTiming-<version>.deb`). If only the .deb fails to build, you still get the AppImage and the script says so.
4. At the end it asks whether to **install the app for you**: the AppImage is copied to `~/.local/share/slotforge-timing`, and the app gets an entry in your applications menu and a shortcut on your desktop. No password, nothing outside your home folder. `./build-linux.sh --install` does it without asking, `--no-install` only makes the files, `./build-linux.sh --uninstall` removes it again (your races and settings in `~/.config/slotforge-timing` are kept). Add `--no-pause` to not wait for Enter at the end. Do not run it with sudo: it refuses.
5. Two things the installer looks at for you. If your system has no **libfuse2** (Ubuntu 22.04 and later do not install it), the menu entry starts the AppImage by unpacking it first, a bit slower: installing libfuse2 avoids that. If your system does not allow programs to start their own sandbox (Ubuntu 24.04), the menu entry starts the app with `--no-sandbox`; when you start the AppImage from a terminal on such a system, add `--no-sandbox` yourself.
6. **The Trackmate on Linux:** to use a serial port you must be in the right group: the script tells you the command when you are not (`sudo usermod -aG dialout $USER`, then log out and in). Choose the port with *Find the Trackmate (COM port)*: it shows up as something like `ttyUSB0`.
7. The races and settings are in `~/.config/slotforge-timing` on Linux (on Windows `%APPDATA%\slotforge-timing`).
8. **Not tried on a real Linux computer yet:** the script's logic is tested with stand-ins (the steps, the files it makes, both install situations, the failures), but the real build and the app itself have not been run on Linux. Spoken announcements need a speech voice on the system (`speech-dispatcher` with `espeak-ng`, for example): without one the voice list is empty and the announcements are silent, the rest works. Please tell me what happens.

## What to try (0.64.1): the Live Race tab as a Live on Air sign (the dark fill was dropped again in 0.64.2)
1. The **Live Race** tab at the top now looks like a Live on Air sign: a dark button with a red light in front of the name and red capital letters with a soft red glow. Clicking it still opens the Live Race on a second screen, as before.
2. It always looks like this, in every theme, whether or not a race is running: it is only there to stand out from the other tabs. The light does not blink.
3. Hover over it for a stronger glow. In a narrow window it moves to the next line with the other tabs.

## What to try (0.64.2): the Live on Air sign without a background
1. The **Live Race** tab is now an outline only: red letters and a red light inside a red border, no dark fill, so it works on light themes as well (it looks as before on dark ones). Clicking it still opens the Live Race on a second screen.
2. The red adapts to the theme: it is mixed with the theme's text colour, a little lighter on a dark theme and a little darker on a light one, so it reads on every ready-made theme and on your own colours (Custom theme). The tests check that it keeps at least 4.4 to 1 contrast on the panel of every theme.
3. It still always looks like this, whether or not a race is running, and the light does not blink.

## What to try (0.65.0): pictures on the tabs
1. The tabs along the top now have a small line picture to the left of the name: a house for **Home**, a book for **Database**, a race track with its start line for **Race Setup**, a paint palette for **Customization**, a cog for **App Settings** and a sheet of paper for **Racing Rules**. **Database** and **Racing Rules** use the same pictures as their tiles on the Live Race page; the other four are new and drawn in the same style (a thin rounded line).
2. The pictures are in the **accent colour of the theme**, the colour of the Start race button. Change the theme in *App Settings > App Theme* (also a Custom theme) and they change with it. The tests check that the accent can be seen on the header (at least 3 to 1) in every ready-made theme.
3. The **Live Race** tab has no picture: it keeps its own Live on Air look. The tabs inside a screen (General, Network, Race Setups, Layout Editor and so on) have no pictures either.
4. In a narrow window the tabs move to the next line as before, now a little wider because of the pictures.
5. Nothing else changes. The six tiles on the Live Race page look exactly as before; their pictures now come from one shared place (`renderer/icons.js`), where all ten pictures are kept.

## What to try (0.66.0): DS Electronics, a listening version
**What this is.** *App Settings > Timing Hardware* has a new sub-tab, **DS Electronics**, after Trackmate Interface. It is for the DS Electronics lap counters (DS-030, DS-200, DS-200b, DS-300, DS-300 RC, the models of Race Coordinator's DS setup screen). What these units send over their serial output is not known yet, so this version **only listens**: it writes down everything the unit sends so the data format can be worked out. **A race does not use the unit yet** (no laps are counted from it), and the app **sends nothing** to the unit. It has not been tried with a real DS unit.

**Making a capture** (for someone who has a DS unit; about 5 minutes; the same steps are on the page):
1. Switch the DS unit on, connect its serial cable to the computer (a USB-to-serial adapter is fine) and connect the lane sensors. Close other timing programs (Race Coordinator, for instance): only one program can use a COM port.
2. Choose the **model**, press **Find the DS interface (COM port)**, choose the port, press **Connect**. The light turns green. The speed starts at 9600 (8 data bits, no parity, 1 stop bit, DTR and RTS on); change them *before* connecting if you know better.
3. Type a **note** and press *Add note* (or Enter) before each thing you do, then do it: *lane 1: car over the sensor*, then lane 2 and so on; let a car pass several times; press the unit's own buttons one at a time. If the unit shows times on its display, add a note with what it shows (*display lane 1: 7.35*): that is the best way to find out how times are sent.
4. If nothing appears when a sensor is triggered, or only strange characters or **ERROR** lines (a wrong speed gives framing errors), press *Disconnect*, choose another speed (1200, 2400, 4800, 9600, 19200, 38400) and try again. Several attempts can go in one log: every connection is marked in it with its settings.
5. Press **Save log** (or *Copy log*) and send the file. It starts with a few lines that say the app version, the model and the port (with its USB numbers), then every line: seconds since connecting, `<-` for data from the unit, the number of bytes, the bytes in hex and as text. It also records when the control lines (CTS, DSR, DCD, RI) change, because some units signal with them.

Good to know:
1. The page shows the last 500 lines; the saved file has everything (up to 20 000 lines).
2. The model can be changed at any time (it only labels the capture); the speed and the other serial settings are fixed while connected.
3. The connection stays while you move around in the app. It is separate from the Trackmate connection, which is not touched.
4. **If the log stays empty at every speed**, the unit probably only answers when the computer asks it something. Then this version cannot show it: tell me the model and what you saw.
5. The next version will decode the laps once the data format is known. Until then the Trackmate is the only timing hardware a race can use (besides the keyboard and the lap buttons on screen).

## What to try (0.67.0): undo and redo in the Layout Editor and the Leaderboard Editor
**What this is.** If you press a wrong key in the editor (the Delete or Backspace key removes the selected widgets without asking), you can now take it back. The **Layout Editor** and the **Leaderboard Editor** (they are the same screen) have **Undo** and **Redo** buttons in the top bar, next to *Save*, and the usual keys: **Ctrl+Z** undoes, **Ctrl+Y** or **Ctrl+Shift+Z** redoes (Cmd instead of Ctrl on a Mac).

1. **Customization > Layout Editor > New layout.** Add three widgets from the list on the left. *Undo* lights up. Click one widget and press **Delete**: it is gone. Press **Ctrl+Z**: it comes back, in the same place, and it is **selected** (blue frame), so you see what came back. **Ctrl+Y** deletes it again.
2. **Everything you do in the editor can be undone**, one step at a time: adding a widget, deleting, duplicating, moving, resizing, every setting in the side panel (colours, text size, title, border, transparency, the widget's own options), the proportions, rounded corners, Guidelines, Lane colours, the Background (picture and filters), and in the Leaderboard Editor the row height, spacing, header and colours. After an undo of a move or a change, the widget that was changed back is selected.
3. **What counts as one step:** a single action (adding, deleting, duplicating, ticking a box, choosing from a list, applying a dialog) is one step. A **drag** is one step, however long it takes and however many small moves it has. A **slider** or **typed numbers** in a settings field are one step: all the small changes in a row are undone together (a short pause ends a step). Try it: drag a widget around for a while, then press Ctrl+Z once.
4. **Typing in a text box** (the name, the note, a title, a number) is undone by the browser itself, as in any other program, with Ctrl+Z while the cursor is in the box. Click outside the box and Ctrl+Z takes back the editor's own steps (what you typed in a box is cut into steps by short pauses). When a **tick box, a list or a slider has the focus** (you just changed it), Ctrl+Z works for the editor as well.
5. **Undo asks nothing and stays after Save.** You can save, go on, and still undo to before the save. The history is kept until you leave the editor (*Back*): then it is gone, and a layout you open again starts with no steps. **It remembers the last 100 steps.** A big background picture or the pictures of a widget are kept once, not once per step, so many steps do not fill the memory.
6. **Unsaved changes:** the editor knows what is on disk. If you undo back to exactly what you saved, nothing is unsaved any more, so *Back* does not ask "Discard your unsaved changes?". Redo (or any other change) makes it unsaved again.
7. While a dialog is open (Guidelines, Lane colours, Background, Row colours) Ctrl+Z does nothing to the editor underneath; close the dialog first. The buttons are greyed out when there is nothing to undo or redo, and a short message says "Undone.", "Redone.", "Nothing to undo." or "Nothing to redo.".

Good to know:
1. **Not yet in this version:** the other editors (Audio Settings, Image Settings, Widget Builder), and the Delete buttons in the Database and in the Results (those ask first, and what they delete is deleted from the file). Tell me if you would like those next; the undo part (`renderer/undo.js`) is shared, so each one is a small step.
2. Each undo or redo draws the editor again, so a list you had opened or a setting you were typing in loses its focus.
3. The tests (`tests/undo.test.js`, and the editor part of `tests/screens.test.js`) check the steps, the keys, the buttons, the unsaved flag and the pictures. I also tried it in a real browser with a real mouse and keyboard (delete, undo, drag with a pause, a slider that has the focus); I have not run it in Electron itself.

## What to try (0.68.0): the Leaderboard widget follows its row design, with a size slider
**What this is.** A **Leaderboard** widget that uses one of your row designs (the *Row design* list in its settings) now looks like that design **in the Layout Editor too**: before, the editor kept showing the plain table, whatever you chose. And the rows now always fit inside the widget's frame: with many drivers the rows get smaller **as a whole, text included**, instead of running out of the frame. A new **Size of the rows** slider makes them smaller still if you want.

1. **Customization > Layout Editor**, open a layout with a Leaderboard widget (or add one from the list on the left) and click it. In the side panel choose a design in **Row design**. The widget now shows that design with **8 made-up drivers** (a leader, a car in the pits, a penalty, a retired car and so on), in the colours of the design. The settings for the classic table (columns, "last lap" and so on) disappear, because a design brings its own cells; choose *Classic table* again and they come back.
2. **Drag the frame of the widget** wide and short, then narrow and tall: the rows keep their proportions and are as large as the frame allows, centred. They never cross the edge of the frame. The more drivers a race has, the smaller each row gets (a header row of a design counts too); the text shrinks with its row, so nothing is cut off. In the editor you always see 8 drivers, in the race you see the real number.
3. **Size of the rows** (only shown with a row design): 100% is as large as fits in the frame; drag it down to 20% to make the rows smaller (they stay centred at the top of the frame). It is one setting per widget, so you can use a big leaderboard and a small one on the same page, and with several Leaderboard widgets selected it is set on all of them. Undo (Ctrl+Z) takes a slider move back.
4. **Text that does not fit its cell** (a long name, a title like *Position* in a narrow header column) is made smaller, just enough to fit, instead of being cut off. It is done for each cell on its own, so the other cells keep their size. This works in the Layout Editor, in the Leaderboard Editor's preview, on the Race Timing page and on the Live Race Leaderboard page.
5. Go to **Race Timing** with your layout and start a race: the leaderboard widgets follow the same rules. Your layout with the tall narrow widgets: the rows are as wide as the frame, so their height is whatever the design's proportions give; the empty space under them is the frame that is not needed (see below).

Good to know:
1. **Narrow, tall frames** have rows as wide as the frame, so the rows are short and the text small, with empty space under them. That is the design: a row is a fixed shape (you set its proportions in the Leaderboard Editor). To fill a tall frame, use a design with a taller row (a larger *row height* in the Leaderboard Editor). I can add a "stretch the rows to fill the frame" option if you would like that.
2. **The Live Race Leaderboard page** has no widget frame, so it has no size slider; it only gets the text fitting. Its look is otherwise as before.
3. **A design with many cells** in a small frame gives small text: the cells keep their place in the row, and only the text of a cell that is too wide for it is made smaller (never below a fifth of its size).
4. The tests (`tests/rows.test.js`, and the editor and Live Race parts of `tests/screens.test.js` and `tests/live.test.js`) check the sizes, the preview, the slider, undo and the text fitting. I also looked at it in a real browser (editor and race window) with frames of several shapes, with and without a header, 8 cars and 2 cars: the rows were always inside the frame and no text was cut off. I have not run it in Electron itself.

## What to try (0.69.0): close up the blank space between the leaderboard columns
**What this is.** The rows of a Leaderboard that uses a row design are drawn as wide as the widget. If your design has the position, flag and callsign at the left and the points far away at the right, about half of every row is blank, and in a tall, narrow widget the whole row, with its text, has to be drawn small. The Leaderboard widget has a new setting, **Space between the columns**, that closes up that blank space: the row gets narrower, so it is drawn larger and the text gets bigger.

1. **Customization > Layout Editor**, open your layout, click the Leaderboard widget that uses the design with the far-away points and make it tall and narrow (or use the narrow ones you already have). In the side panel, under *Leaderboard settings*, below *Size of the rows*, is **Space between the columns**, at **100%** (the design as you made it). Drag it down: the columns move together and the text gets bigger. At **0%** the blank space is as small as it goes.
2. **What the percentage means.** 100% keeps every column where the design puts it. 0% closes each blank stretch between two columns to a small gap (1% of the design's width) and trims the blank space at the left and right edge of the row to the same small size. 50% keeps half of the extra space. The columns themselves keep their width and their order, cells that are above each other in the design stay above each other, and the position of a cell in relation to its neighbours does not change.
3. **Everything in the row follows:** the cells, the header row (its titles stay above their columns), the colours of the rows, the rounded corners and the space between the rows. Only the blank space is removed.
4. **It is a setting of the widget, not of the design.** You can use the same design wide, at 100%, in one widget, and closed up in a narrow one. With several Leaderboard widgets selected it is set on all of them. Ctrl+Z takes a slider move back, in one step. It works together with *Size of the rows* (that one makes everything smaller; this one makes the row narrower, so the same frame can show it larger).
5. **Race Timing:** start a race with your layout: the leaderboard widgets draw the same way as in the editor, with the real number of drivers.
6. **A tip for the title:** in your screenshot the word "Leaderboard" lies over the header row. In the side panel, under *Title*, either untick **Show title** or tick **Title takes its own space**; then the rows start below the title.

Good to know:
1. **Wide, short widgets** gain nothing from this: there the height decides how large the rows are, so closing the columns only makes the rows narrower, in the middle of the widget. Leave it at 100% there. It is meant for tall, narrow widgets.
2. **A tall, narrow widget can still have empty space under the last row.** The rows keep the shape of the design (their height is set by the *row height* in the Leaderboard Editor), so after closing the columns the rows are larger but not tall enough to fill the whole frame. A larger row height in the design fills more of it. I can add a "stretch the rows to fill the frame" setting if you want that.
3. **Blank space inside a cell** is not closed up: a callsign that is centred in a wide cell keeps the space on both sides of it. Make that cell narrower in the Leaderboard Editor.
4. **The Live Race Leaderboard page** does not have this setting (it has no widget frame); it is as before.
5. In my check in a real browser, a design like yours in a narrow, tall widget went from text of about 7.6 px to about 16 px (more than twice as large) at 0%, with every row inside the frame and nothing cut off. I have not run it in Electron itself. The tests (`tests/rows.test.js` and the editor and Live Race parts of `tests/screens.test.js` and `tests/live.test.js`) check the layout numbers, the slider, undo, and that the setting reaches the Race Timing page.

## What to try (0.70.0): the Race Setup form in groups
**What this is.** The form for a race setup (Race Setup > *Add race setup*, and *Edit* on an existing one) was one long list of 25 settings. They are now in six sections with a coloured header bar. A section opens and closes when you click its header (the arrow shows which). Nothing about the settings themselves has changed: the same settings, the same choices and the same defaults, and setups you made before open as they were.

1. **Race Setup > Add race setup.** You see six sections: **Session** (name, kind of session, track), **Length and result** (laps or duration, heats, how the race ends, points), **Start** (start lights, restart after a red flag, the first crossing of the start line), **Penalties, fuel and pits** (penalty system, fuel setup, how long the pit sensor must be blocked), **Screens and sound** (the Timing page layouts and the audio set) and **Trackmate** (track power at the start and the Trackcall button). Next to each title is a line saying what is inside.
2. **Session and Length and result are open** (what you set for every race); the others are closed, with settings you set once and then leave. The cursor is in the *Name* field, as before.
3. **Open all / Close all** (above the sections) opens or closes everything. The app remembers which sections you opened: the next time the form opens they are as you left them, until you close the app.
4. **Only what applies is shown.** Change *Session type* to **Free practice**: the whole *Length and result* section disappears, because a practice has no laps or time. Choose **Race by laps**: it comes back with the number of laps and *The race ends*. **Timed race** shows the duration instead; **Heat-based race** shows the heat settings and, if you choose points, the points list.
5. **Save and Cancel** stay at the bottom of the window, in view, however much you have opened. A setting inside a closed section is saved like the others.
6. The header bars take the colour of your theme (the accent colour), so they stand out in every theme. Try App Settings > App Theme.

Good to know:
1. Only the Race Setup form is grouped. The other forms (drivers, slotcars, tracks, fuel setups and so on) are short and look as before. The grouping is data in `schema.js` (a `groups` list and a `group` on every setting), so other forms can get sections the same way later.
2. If you add your own fields to a form that has groups, they go into a last section called *More*.
3. The tests (`tests/screens.test.js`) check the order of the sections and which setting is in which, what is open to begin with, Open all / Close all, that the open sections are remembered, that a section with nothing to show hides, and that settings in closed sections are saved. I also looked at it in a real browser, in the dark and light themes; I have not run it in Electron itself.

## What to try (0.71.0): a Pre-Race call before the start lights
**What this is.** When you press **Start**, the app now says a call first, and the start lights (the countdown) do not begin until it has been said. When it is finished there is a short pause, and then the lights start and the race begins as before. The ready-made sentence is *"Drivers, get ready. The race is about to start!"*

1. **Customization > Audio Settings**, open (or add) an audio set. The **Start** folder now begins with **Pre-race call**. It is on, with the sentence above. Change the sentence, add more sentences (one is picked each time, like the other calls), record a file for it, or turn it off. Under it is **Pause after it, before the first light (seconds)**: the wait between the end of the call and the first light. It is 1 second to begin with; you can set 0 to 10, in steps of half a second.
2. **Race Setup**: choose that audio set (*Screens and sound* section), and open a race with it.
3. **Press Start** (button, space bar, the Race Director page or a tablet). The call is said at once. While it is said:
   - the start lights have not begun, and the race screen says so ("The pre-race call is being said. The start lights follow when it is finished."),
   - the **Start** button is greyed out on the race screen, on the Race Director page and on the tablets, so a second press cannot start a second call or push the countdown forward. The space bar does nothing meanwhile either.
4. **When the call has finished and the pause has gone by**, the countdown starts. The countdown numbers and "lights out" calls are as before.
5. **It is said before every heat**, also the next heats of a race with several heats (press Start between heats, and the call is said again).

Good to know:
1. **No audio set, the call turned off, or an empty sentence:** nothing is said and nothing is waited for; Start goes straight to the lights, as before this version.
2. **Existing audio sets** do not have this call yet. They get it automatically with the ready-made sentence (turned on). If you do not want it, turn it off in Audio Settings, in the Start folder.
3. **The old call "Start lights begin"** is retired. It was said when the first light came on and was cut off by the "5" of the countdown almost at once, so it could not be heard in full. The Pre-race call takes its place, and the countdown no longer has to compete with it. If you had changed that sentence, it is not carried over.
4. **A restart after a red flag** has no Pre-race call; it starts with the lights as before. The call is for the start of a heat, not for every restart.
5. **Leaving the race screen** while the call is being said cancels the start (nothing starts afterwards), and the sound is stopped. The same when you open another race.
6. **A call that never ends** (a sound file or a voice that hangs) does not block the race for ever: after one minute the countdown starts anyway.
7. **There is no key to skip the call.** The call must be finished before the start; that is how you asked for it. If you want a "skip" button for testing, say so.
8. The tests (`tests/audio.test.js`, `tests/live.test.js`, `tests/timing.test.js` and `tests/screens.test.js`) check the order (call, pause, lights), the pause setting and its limits, the buttons being greyed out here and on a viewer, cancelling by leaving, the one-minute limit, a broken sound, and old audio sets. I also made small breakages in the code on purpose to check that the tests notice each one.

## What to try (0.72.0): the Track form in groups
**What this is.** The Add track / Edit form (Database > Tracks) has the same look as the Race Setup form from 0.70.0: four sections with a coloured header bar that you can open and close, instead of one long list of 14 fields.

1. **Database > Tracks > Add track.** The sections are **Basics** (name, number of lanes, scale, surface), **Length and lanes** (the track length with its calculator, and the Lane length modifier), **Lap time limits** (minimum and maximum lap time) and **Picture and notes**.
2. **Basics and Length and lanes are open**; the lap time limits and the picture and notes are closed, as you set those once, if at all. The cursor is in the *Name* field.
3. **Open all / Close all** above the sections, and the app remembers which sections you opened for the next time you open a track form (until you close the app). The Race Setup form has its own memory.
4. **The lane fields still come and go.** In *Length and lanes*, choose **Calculated from the bends**: the outside lane, the distance between the lanes and the full turns appear in the section. Choose **Measured**: the list of lane lengths appears. With **None** they are hidden.
5. **Save and Cancel** stay at the bottom of the window. A field in a closed section is saved like the others (try typing a note, closing the section and pressing Save).
6. **The surface is now next to the scale**, in Basics. It used to be the last field but one, after the lap time limits.

Good to know:
1. **The track list** (the table in Database > Tracks) lists the columns in the order of the fields, so its *Track Surface* column now follows *Scale*. The grid cards are unchanged.
2. **Only the Race Setup and Track forms are grouped.** Drivers, slot cars, fuel setups and so on are shorter and look as before. If you want one of them in sections too, say which. The grouping is data in `schema.js` (a `groups` list and a `group` on each field).
3. **Your own extra fields** (the *Extra fields* button) go into a last section called *More*. It is closed to begin with, so open it to fill them in (it is saved like the rest, also when closed again).
4. The tests (`tests/screens.test.js`) check the sections, which field is in which, what is open to begin with, the lane fields following the Lane length modifier, the memory of the open sections, and saving from closed sections. I also checked the real form in a browser (dark and light theme), and made small breakages in the schema on purpose to see that the tests notice each one.

## What to try (0.73.0): Undo and Redo in Audio Settings, Image Settings and the Widget Builder
**What this is.** The Layout Editor and the Leaderboard Editor have had Undo and Redo since 0.67.0. The other three editors in Customization have them now, with the same rules: every change is a step, until you leave the editor.

1. **Customization > Audio Settings > New audio set** (or *Edit* on one). Next to *Save audio set* there are **Undo** and **Redo** buttons, both greyed out until there is something to undo. Change the speed, the voice, tick a call off, add a sentence, delete one: each is a step. Press **Undo** (or Ctrl+Z): the editor is drawn again as it was, with the sentence back in its place.
2. **Image Settings > New picture set.** The number of pictures, a picture added or removed, and the kind of a new set are steps. **Widget Builder > New widget**: the kind, the size, bold and italic, the rules (added, changed, removed) and their pictures are steps.
3. **Keys:** Ctrl+Z is Undo, Ctrl+Y or Ctrl+Shift+Z is Redo (Cmd instead of Ctrl on a Mac), in all three editors. The buttons show the keys in their tooltip.
4. **Typing is one step.** What you type in a text box (the name, a sentence, the text of a widget, the value of a rule) becomes one step after a quiet moment of about half a second, not one step per letter. Two things typed in a row before that moment (a name and then a sentence) are one step together.
5. **In a text box, Ctrl+Z belongs to the box**: it takes back your typing in that box (the browser's own undo). Click outside the box, or use the **Undo** button, for the editor's Undo. A tick box, a list or a slider does not count as a text box: the editor takes Ctrl+Z there.
6. **Saved or not.** After *Save*, undoing a change takes you back to what is saved, and the editor knows that nothing is unsaved then (*Back* does not ask). Undoing past what you saved is "unsaved" again; Redo to the saved state is clean again. A new set that was never saved stays "unsaved", also when you undo everything.
7. **Sound files and pictures** are kept once, however many steps hold them, so many steps with a big file do not fill the memory. A sound file you choose, and one you remove, are steps too.

Good to know:
1. **Leaving forgets the steps.** *Back* closes the editor and forgets them. In Image Settings and the Widget Builder, clicking another tab of Customization closes the editor too (that was already so: it does not ask about unsaved changes first, so they are lost, and the steps with them; tell me if it should ask). The audio set editor stays open when you look at another page, and keeps its steps.
2. **100 steps** are kept for an editor (the oldest go first), and a new change after an Undo removes what you could have redone, as in the other editors.
3. **Not a step:** opening or closing the folders in Audio Settings, the *Test* button, and the *Open all / Close all* buttons.
4. **The keys work only while the editor is on the screen**, and not while a dialog is open.
5. **A change made while a set is being saved** (a fraction of a second) is not saved: the editor shows it as unsaved afterwards.
6. The tests (`tests/screens.test.js`) check all of this, and I checked the real editors in a browser (dark and light theme). I also made small breakages in the code on purpose, about 70 of them, to see that the tests notice each one; that found 14 weak spots in my tests, which I closed.

## What to try (0.74.0): the Driver, Slot car, Fuel setup and Penalty system forms in groups
**What this is.** The same coloured, collapsible sections as the Race Setup and Track forms (0.70.0 and 0.72.0), now for the four other forms you fill in: **Database > Drivers > Add driver**, **Database > Slotcars > Add slot car**, **Race Setup > Fuel Setups > Add fuel setup** and **Race Setup > Penalty Systems > Add penalty system**. *Edit* on an existing item opens the same sections.

1. **Add driver:** **Basics** (name, nickname, callsign), **Personal details** (date of birth, country flag), **Avatar** (the picture with its framing). The first two are open, the Avatar section is closed.
2. **Add slot car:** **Basics** (brand, manufacturer, model, scale), **Technical details** (motor, tyres, gearing, weight), **Pictures** (the main picture and the extra pictures), **Statistics** (the laps driven, counted by the app, so you cannot change it). The first two are open.
3. **Add fuel setup:** **Basics** (name, tank size, fuel per lap, target lap time), **Empty tank and refuelling** (what happens when the fuel runs out, the refuelling speed), **Fast and slow laps** (the most extra fuel a fast lap can use, the most a slow lap can save). The last one is closed: it fine-tunes, and has sensible values already.
4. **Add penalty system:** **Basics** (name and how penalty points turn into time: *Every X points add Y seconds* or *Steps I define*, which still show only what belongs to your choice), **Special penalties** (the list of Stop-and-Go and Drivethrough penalties, with the *Add a special penalty* button), **Disqualification and fuel** (the points at which a driver is disqualified, the points for an empty tank). The first two are open.
5. **As in the other forms:** *Open all / Close all* above the sections, the app remembers which sections you opened (for each kind of form, until you close the app), the cursor is in the first field, *Save* and *Cancel* stay in view, and what is in a closed section is saved like the rest.

Good to know:
1. **What I opened.** I opened what you normally fill in and closed what you set once or rarely (the avatar, the pictures, the fast and slow laps, disqualification). In the fuel and penalty forms I put the more important sections before the fine-tuning ones, so the order of the fields in those two forms is a little different from before. If you would rather have another section open or closed, or other titles, say so: it is one line each in `schema.js`.
2. **The tables are unchanged.** The list of drivers and the list of slot cars show their columns in the same order as before; the fuel and penalty lists have their own column choice, which did not change either.
3. **Your own extra fields** (the *Extra fields* button on drivers and slot cars) go into a last section called *More*, closed to begin with.
4. **Every form with fields is now grouped.** The grouping is data in `schema.js` (a `groups` list and a `group` on each field); a form without it would still be one flat list, and that is tested too.
5. The tests (`tests/screens.test.js`) check, for each of the four forms, the order of the sections, which field is in which, the titles and notes, what is open to begin with, Open all / Close all, the memory of the open sections, the show-and-hide of the penalty fields, the picture and gallery fields in their sections, and saving from closed sections. I checked the real forms in a browser (dark and light theme), and made small breakages in the schema on purpose (21 of them) to see that the tests notice each one.

## What to try (0.75.0): the group of an extra field, and a question before an editor closes
**What this is.** Two things you asked for. **1. Extra fields (the *Extra fields…* button on Drivers, Slotcars and Tracks) can now be put in one of the sections of the form**, instead of all landing in *More*. **2. Image Settings and the Widget Builder ask before another Customization tab closes them** when they hold changes you did not save.

**Extra fields in a section**
1. **Database > Slotcars > Extra fields…** There is a new choice, **Group in the form**, under the field name and type. It lists the sections of that form in the order of the form (for Slotcars: Basics, Technical details, Pictures, Statistics) and then **More**. **More is chosen to begin with.** Add a field called *Chassis* in *Technical details*, close the dialog and open **Add slot car**: *Chassis* is in the Technical details section, after Motor, Tyres, Gearing and Weight.
2. **Every extra field in the list has its own group choice** beside its name. Pick another group and it is saved at once (no extra button), and the next time you open the form the field is there. A half-typed new field name stays where it is while you do this.
3. **Drivers and Tracks work the same way**, each with the sections of its own form (Drivers: Basics, Personal details, Avatar. Tracks: Basics, Length and lanes, Lap time limits, Picture and notes).
4. **Fields you made before this version** have no group yet, so they stay in More until you pick one.
5. **More only shows up when a field is in it.** If you move every extra field into a section, the form has no More section any more.
6. **Export and import** keep the group: a field that comes in from a file is made in the same group. A field you already have (same name and type) keeps the group you gave it.

**The question before an editor closes**
7. **Image Settings > Edit a set** (or *New picture set*) or **Widget Builder > Edit a widget**: change something, then click another tab (Layout Editor, Leaderboard Editor, Audio Settings…). The question *Discard your unsaved changes to this picture set?* (or *…to this widget?*) appears. **No** keeps you in the editor with your changes and all your Undo steps; **Yes** closes it as before.
8. **No question when nothing is unsaved**, for instance right after *Save*, or when you only looked at a set.
9. **A new set that you never saved counts as unsaved**, also when you did not change anything yet; the *Back* button has always asked about it, and now the tabs do too.
10. **The widget builder's *Back* button now asks the same question** as its tab (before it said *Leave without saving?*), so both ways out sound alike.

Good to know:
1. **Which groups are offered.** Only the sections of the form the field belongs to (a Slotcars field cannot go into a track section). I used the section titles as you see them in the form.
2. **If the section is gone.** Should a field point at a section the form does not have (a file from a newer version, say), the field shows in More, and the dialog says More too.
3. **Where in the section.** An extra field comes after the fixed fields of its section, in the order you made them. I did not add a way to put an extra field in the middle; tell me if you want that.
4. **Not for every form.** The Race Setup, Fuel setup and Penalty system forms have no extra fields (as before), so nothing changes there.
5. **Network view.** The browser view cannot add, delete or move extra fields (it is read-only, as before).
6. **The audio set editor** is not asked about: it stays open when you look at another tab, with its changes and steps, so nothing is lost (that is the 0.73.0 behaviour).
7. This replaces item 1 of "Good to know" in the 0.73.0 section: another tab no longer closes an editor with unsaved changes without asking.
8. The tests check the group choices (order, default, per field), where the field lands in the form, saving the values from every section, the change of group and what happens when it cannot be saved, the database (also that a group is saved to the file and a wrong group becomes More), export and import, the missing and the wrong group, and every case of the question (picture sets, widgets, clean and unsaved, yes and no, the Back button). A new check also tests that every call a screen makes to the main program has a handler there, which would catch a missing connection for the group change (I cannot run Electron here). I checked the real dialog and the form in a browser (dark and light theme, a narrow window), and I made 48 small breakages on purpose to see that the tests notice them: two were missed, I closed those.

## What to try (0.76.0): Fill the frame, for the Leaderboard widget
**What this is.** In a tall, narrow Leaderboard widget the rows keep the shape of their design, so they are small and there is empty space under the last row. The Leaderboard widget has a new choice, **Fill the frame**, with three settings: **Off** (as before), **Taller rows** and **More space between the rows**. It works in the Layout Editor and on the Race Timing page, with the real number of drivers.

1. **Customization > Layout Editor**, open a layout with a Leaderboard widget that uses a row design, make the widget tall and narrow and click it. In the side panel, below *Space between the columns*, is **Fill the frame**, at **Off**.
2. **Taller rows:** the rows keep the width of the frame and grow taller until the whole board fills the frame, top to bottom. The text keeps its size (it follows the width of the row), so a taller row has more room around its text, which stays in the middle of the row. A header row of the design keeps its own height and stays at the top.
3. **More space between the rows:** the rows keep their shape and size, and the empty space is divided equally between them, so the first row is at the top and the last row at the bottom. A header row stays right above the first row.
4. **Size of the rows still works with it:** at 50% the board fills half of the frame (and stays in the top middle), with the rows taller or further apart inside that.
5. **A frame that the rows already fill does not change**, for example a wide frame with many drivers: there the board is as tall as the frame anyway.
6. **It is a setting of the widget, not of the design**: the same design can be used with it in one widget and without in another, and it stays when you choose another design. With several Leaderboard widgets selected it is set on all of them. Each choice is a step for Undo (Ctrl+Z).
7. **Race Timing:** start a race with your layout: the leaderboard widgets draw the same way, with the real number of drivers (the editor always shows 8 made-up drivers).

Good to know:
1. **Few drivers give very tall rows with Taller rows.** With 3 cars in a tall frame each row is about a third of the frame, and with one car the row is as tall as the frame. The text does not grow with it. If that looks too empty, choose *More space between the rows*, make *Size of the rows* smaller, or close up the columns (*Space between the columns*) so the text is larger. If you would like the rows never to grow beyond a number of times their design height, I can add that.
2. **More space between the rows needs two rows or more**: with one car there is no space between rows to enlarge, so nothing changes.
3. **The Live Race Leaderboard page** has no widget frame, so it has no such choice (as before).
4. **Two small changes in the Layout Editor that come with it.** A choice from a list in the side panel (this one, but also *Show fuel as* of the Fuel widget, for instance) is now always a step of its own for Undo (before, two quick choices could end up as one step). And a list choice can now show an explanation under it, as the sliders do; this one does.
5. This replaces the offers of a "stretch the rows to fill the frame" option in the 0.68.0 and 0.69.0 sections.
6. The tests (`tests/rows.test.js`, and the editor and Race Timing parts of `tests/screens.test.js` and `tests/live.test.js`) check the choice, what is drawn for each setting (the rows themselves are the same, with a header, a size choice and closed-up columns), the style sheet rules, the editor (preview, Undo, other designs, several widgets selected) and that the choice reaches the Race Timing page. I measured the real thing in a browser, in the Layout Editor and on a Race Timing page, with 1, 3 and 8 cars, wide and tall frames, with and without a header, at 100% and 50%: with Taller rows or More space the last row ended at the bottom edge of the frame, nothing was cut off, the text kept its size, and a frame that was already full did not change. I also made 25 small breakages on purpose to see that the tests notice them, and they all did. I have not run it in Electron itself.

## What to try (0.77.0): the round app icon
**What this is.** Your new icon (the red sports car on the road) is now the icon of the app, and it is **round**: a circle with see-through corners instead of a square picture. It is in the `build` folder as `icon.png` (512 x 512 pixels) and `icon.ico` (the Windows icon, with the sizes 16, 24, 32, 48, 64, 128 and 256).

1. **Windows:** run `build-windows.bat`. The installer, the portable program, the desktop shortcut, the Start menu entry, the taskbar and the title bar show the round icon.
2. **Linux / Raspberry Pi:** run `./build-linux.sh` (with `--install` for the menu entry). The AppImage, the .deb and the menu entry use the same round `icon.png`.
3. Look at it small too: at 16 and 32 pixels (a taskbar, a list in a folder) the circle is still clean and the car can still be told from the road.

Good to know:
1. **I made the circle myself.** The picture you sent was 4167 x 4075 pixels, so about 2% wider than tall, and the edge of its round shape was not a perfect circle (a few dozen pixels off here and there). I cut it to a square, in the middle, and cut a perfect circle out of it with a smooth edge. What went is a thin strip along the edge (1.4% of the picture): mostly the light grey background, plus a sliver of the black road at the lower left and right edge. The car is untouched. The circle touches the four sides of the icon, with no empty margin around it. If you would like a little space around it (Windows icons often have some), tell me how much.
2. **`npm start` still shows the standard Electron icon** in its window, as before: the icon goes into the built programs (the installer, the portable program, the AppImage). The window of `npm start` is not one of them.
3. **Windows remembers icons.** If you still see the old square icon after installing the new version, that is the icon memory of Windows (the Explorer icon cache), not the file. Restarting Explorer or the PC, or renaming the shortcut, fixes it.
4. **To change the icon later**, send me the picture and I will do the same again, or replace `build/icon.png` yourself with a square PNG of at least 512 x 512 pixels with see-through corners (and make `icon.ico` from it). The tests notice if the icon is a square again.
5. The tests (`tests/package.test.js`) read the real icon files: the picture is square and at least 256 pixels, its four corners are see-through and every point well inside the circle is solid, there is a picture and not an empty circle, and the Windows icon holds the sizes 16, 32, 48 and 256 and more, and is round in every size. I looked at the result on a dark and a light background in 256, 128, 64, 32 and 16 pixels, and I changed the icon files on purpose in 12 ways (the old square icon, a rounded square, a circle that is too small, a hole in the middle, a missing size and so on) to see that the tests notice each one: they did. I have not built the installer here (that needs your computer).

## What to try (0.78.0): your club logo on the Home tab, and in the Logo widget
**What this is.** The app now has one **Club logo**, set once in **App Settings > General**. It can sit beside the header picture on the Home tab, and every **Logo widget** that has no picture of its own shows it, on the timing page, in the Layout Editor and on the Live Race pages.

1. **App Settings > General > Club logo:** choose your logo picture. It is shrunk to 600 pixels and keeps its see-through parts (a PNG with a transparent background stays transparent). **Remove logo** takes it away again.
2. **On the Home tab:** choose *Left of the header picture* or *Right of the header picture*. *Not shown* (the standard) leaves the Home tab as it was; the logo is then only used by Logo widgets.
3. **Width:** the logo gets a share of the width of the header, from 10% to 50% (25% to start). The header picture gets the rest. Move the slider and the preview above it follows at once.
4. **Height:** the logo and the picture always have the same height, the one of the **Height** slider of the header picture. The logo is always shown whole and as large as its space allows, and it is never cropped. Make the header higher for a larger logo.
5. **Left / right and Up / down:** the whole logo is usually smaller than its space in one direction, and these sliders move it inside that space, like the ones for the header picture do (the Center the logo button puts it back in the middle). A slider is greyed out when the logo already fills its space that way. A round or square logo in a wide space moves left and right; a wide logo in a tall space moves up and down.
6. **A header without a picture:** the logo can stand on its own. The Height slider is then offered too (18% of the width to start), and the rest of the header stays empty.
7. **Logo widget:** open the Layout Editor, add a **Logo** widget (Race group) and leave its picture empty: it shows your club logo, and the settings say so. Choose a picture there and that widget shows its own picture instead (other Logo widgets are not affected). **Use the club logo** goes back to the club logo. Logo widgets that already have their own picture keep it.
8. **Race Timing and the Live Race pages:** start a race with a layout that has a Logo widget: it shows the club logo there too, also on a tablet or phone that follows the race.

Good to know:
1. **The header keeps its height when a logo is added.** With *Automatic* the header is as high as it was without the logo (the shape of the picture, 220 pixels at most), so the picture is shown a little more cropped at the sides: it has less width for the same height. You can still choose which part of it shows with the picture sliders or by dragging it. If you want it less cropped, make the logo's share smaller.
2. **A transparent space around the logo** shows what is behind it: the page. There is no colour behind the logo (that was your choice).
3. **The position of the logo and the position of the picture are separate settings**, each with its own sliders.
4. **Existing pictures and settings keep working:** with no logo and no side nothing changes on the Home tab. A Logo widget with its own picture is not touched.
5. **The logo is saved in the settings in the database file** (as a picture of at most 600 pixels), and it is not part of Import and Export of the data, like the header picture.
6. The tests (`tests/banner.test.js`, `tests/widgets.test.js`, `tests/timing.test.js`, `tests/live.test.js`, `tests/screens.test.js`) check the side, the share and the position (also damaged saved values), the two columns, the heights (set, automatic, no picture), which sliders are greyed, saving, the Home tab markup, the Logo widget fallback in the editor, on the timing page and for a viewer, and that nothing damaged reaches the page. I also looked at the Home tab and the settings in a real browser and measured: the widths, the heights (set, and automatic with a flat picture, a taller one, and one above the 220 pixel limit), left and right, logo alone, a narrow window, and dragging the picture with the logo on.

## What to try (0.79.0): a new look for Audio Settings
**What this is.** The Audio Settings editor (Customization > Audio Settings > New audio set, or Edit) has the look of the Add track and Race Setup forms now. Nothing works differently: it is only the look. Before, an open folder was a box with white boxes inside it, and the browser's own black triangle.

1. **Open Audio Settings and make a new audio set.** The folders (Start, Flags, Finish...) have an **accent bar** on the left, a **tinted header** and an accent chevron that turns when the folder opens, like the groups of the Add track form. Each header still says how many of its calls are on.
2. **Open a folder.** The calls inside are no longer in white boxes: each has its name in bold with its tick box, and a thin line between one call and the next.
3. **Switch a call off.** Its name turns grey and its sentences are hidden, as before. It is easy to see which calls are off.
4. **Look at a sentence.** The sound file choice has its own column, so the *Test* and *Delete* buttons line up in every row, also for a sentence that has a sound file (it shows *sound file* and *Remove file* in the same place). The *Choose File* button looks like the other buttons of the app.
5. **Add a sentence** has the accent colour with a dashed edge, so it can be found at the end of each call.
6. **Calls: Open all folders / Close all folders** are in the same bar as Open all / Close all in the forms.
7. **The help at the top** (How sentences work, and the variables) is a folder of the same shape, in grey: grey is for reading, the accent colour is for the places where you change something. The names of the variables in its table (`{nickname}`, `{callsign}`...) no longer break in two.
8. **Make the window narrow** (or use a small screen): the sentence rows wrap, so the text of a sentence keeps a readable width, with its buttons on the next line.
9. **Try another colour theme** (App Settings > App Theme): the bar, the header and the tick boxes follow the accent colour of the theme.

Good to know:
1. **Only the Audio Settings editor changed.** The Add track and Race Setup forms look exactly as before: the folders use the same style rules as those groups now (the rules are shared, not copied), so a later change to the groups changes both.
2. **The help folder is open when you start, as before.** It is long (the table of variables), so the calls start lower down the page. If you would rather have it closed to start, say so and I will change that.
3. **The Choose File buttons in other screens are not changed** (for example the picture of a track or a driver). Only the ones in Audio Settings have the new look. I can do the same for the whole app if you like it.
4. The tests (`tests/screens.test.js`) check that the folders share the rules of the form groups, the colours of the help folder, the lines between calls, the grey of a call that is off, the sound file column (also with a file), the wrapping on a narrow window, and the Open all bar. I looked at the editor in a real browser: dark and light themes, Midnight, Carbon and Sunset, a narrow window, a call that is off and a sentence with a sound file.

## What to try (0.80.0): folders on Results and Records and on Race Setups
**What this is.** The Results and Records page and the Race Setups page have the folder look of Audio Settings and of the Add track form now: an accent bar on the left, a tinted header and a chevron that turns when the folder opens. Nothing is lost or moved to another place: only the way the lists are grouped changed.

1. **Database > Results and Records.** The three parts are folders now: **Track records**, **Personal bests** and **Sessions**. Each header says how many it holds (for example *2 personal bests*). They are open when you start.
2. **Close one** (click its header, or press Enter or Space on it). Do something on the page, for example remove a record, or leave the tab and come back: the folder stays closed. The app remembers it while it runs.
3. **Open all / Close all** are above the folders, in the same bar as in the forms.
4. **The sessions** are rows with a thin line between them, inside the Sessions folder. A row still opens to show the standings, the lap times, *Export to PDF* and *Delete this session*.
5. **Remove** on a track record or a personal best works as before: only the record is removed, the lap stays in its session.
6. **Race Setup > Race Setups.** There is a folder for every session type that has race setups: *Free practice*, *Qualifying*, *Race by laps*, *Timed race*, *Heat-based race*, in that order. Each lists the race setups of that type, and says how many.
7. **A session type without race setups has no folder.** Add a setup of that type and its folder appears.
8. **The Session type column is gone from the list**, and from the cards in the grid: the folder says it. The other columns stay (Name, Track, Laps / time).
9. **List / Grid** works as before, and the choice is still remembered for this page only. In the grid the cards sit in the same folders.
10. **With setups of only one session type** there is one folder, and no Open all / Close all (there is nothing to open or close all of).
11. **Try a narrow window:** a table that is too wide scrolls sideways inside its folder, so a date stays on one line.
12. **Try another colour theme** (App Settings > App Theme): the bar, the header and the chevron follow the accent colour.

Good to know:
1. **The look is shared with the forms and Audio Settings** (the same style rules, not copies), so a later change to the groups changes these folders too.
2. **A race setup whose session type is not in the list** (for example from an old import) goes in a folder called **Other**, so no setup can go missing from the page.
3. **Open or closed is remembered while the app runs, not after you close it.** Every folder is open again at the next start. I can save it in the settings if you would rather have it stay closed.
4. **The other lists** (Tracks, Drivers, Slotcars, Fuel Setups, Penalty Systems) have no folders, because they have nothing to group by. They look as before.
5. **No results yet:** the Results and Records page still shows the sentence about running a race (no empty folders). A race setup page without setups shows the sentence that says so.
6. The tests (`tests/screens.test.js`) check the folders and their counts, the open state kept when the page is drawn again, Open all and Close all on both pages, the Other folder, the folders that are left out, the missing column, the grid, and the style rules. I also broke the code on purpose in 29 ways to see that the tests notice.

## What to try (0.81.0): long sessions and the Live Race pages
**What this is.** The Live Race pages (the second-screen window, and phones and tablets on the wifi) get the race from the race window. Until now that was the whole race, about ten times a second, including the list of every lap time of every car. The longer a session ran, the bigger every message became (after 3 hours with 4 cars: 164 KB, ten times a second). Now only what changed is sent, and of the lap lists only the new laps. Nothing looks different: the pages show the same, and a session can run for hours.

1. **Start a race, or a Free practice, with *Simulated cars*** and open the Live Race pages on a second screen and on a phone (App Settings > Network access). Laps, positions and flags appear at once, and the lap and race clocks run smoothly, as before.
2. **Let it run.** Nothing slows down, and the amount of data stays the same however many laps there are.
3. **Open the second-screen window, or the phone page, in the middle of a race:** it shows everything up to that moment (all the laps) at once and carries on from there.
4. **Switch the phone's wifi off for a few seconds and on again:** the page notices that it missed something, fetches the whole race once, and carries on by itself.
5. **Take a lap out of a driver's laps (Review) or mark one as invalid:** the Live Race pages show the same laps as the race window.
6. **Start the next heat or race:** the Live Race pages follow it.

What got smaller (a 3-hour Free practice, 4 cars, laps of 5.5 to 7 seconds; measured on a simulation of the race window, for each device that follows the race):

| | Before (0.80.0) | Now (0.81.0) |
|---|---|---|
| Messages | 108,000 (ten a second) | 14,088 (1.3 a second) |
| Biggest message | 164 KB | 1.9 KB |
| Everything sent in 3 hours | 8.5 GB | 26 MB |
| Sent in the last hour, per second | 1,368 KB | 2.5 KB |
| Work in the race window to prepare it (3 hours) | 55 seconds | 4 seconds |
| A window that opens late, once | 164 KB | 102 KB |

The amount is the same in hour 1, 2 and 3 (8.6, 8.5 and 8.6 MB). The receiving side needs about 0.3 seconds of work in 3 hours.

Good to know:
1. **A message goes out when something changes** (a lap, a flag, a pit stop, a penalty, the start or the end), and a small one every second, so that the clocks of the other screens stay right. In between, the clocks run on the screen itself, as before. The refuelling level in the pit is worked out from the clock too, so it needs no messages either.
2. **Lap times are sent with at most 3 decimals** (in milliseconds, so `6713.334` instead of `6713.334441091514`). The one exception: a number that would show differently when cut short is sent as it is, so every screen shows exactly the same digits for every lap time as the race window. Your saved laps, results and records are not touched: this is only about what is sent to the Live Race pages.
3. **An average (or another value worked out on a Live Race page from the lap times) can in rare cases differ by 0.001 second from the race window.** I measured it: about 1 in 5,000 early in a session (3 laps), 1 in 66,000 after 100 laps, and not once in 20,000 tries after 1,000 laps.
4. **Every message has a number.** A page that misses one does not guess: it fetches the whole race from the app and carries on. The app does the same with the race window: when something does not fit, it asks the race window to send everything again.
5. **Pages that were open in a phone browser from an older version** need to be reloaded once, because they speak the old way.
6. **The clock stays in minutes** (a 3-hour session shows 180:00.4), as you asked.
7. The tests (`tests/live.test.js`, `tests/package.test.js`) check: only new laps are sent, however long the race; nothing is sent when nothing changes, and a message every second; a lap taken out of the middle; a lost message (also when the lists are as long as before); a window that opens late; a new heat; the 3 decimals (and that cutting short never changes what is shown, 200,000 times); and the handler in `main.js` itself, run against stand-ins. I also tried the Live Race page in a real browser (laps arriving, a lost message, a window that opens late), and I broke the code on purpose in 25 ways to see that the tests notice, and they do.

## What to try (0.82.0): Time Tokens, part 1 (selling track time per lane)

**What this is.** For a club that sells track time. There is no hardware: you add paid time to a lane with a button, the lane is "switched on" for that time, a Token Clock counts down, and when the time is up everything of that lane turns red. This is the first of three parts. In this part everything is done on the main computer (the race window). Part 2 will put a *Tokens* tile on the Live Race pages, protected by the Race Director password, so that time can be added from a phone or tablet.

1. **Race Setup > Time Tokens** (a new subtab). Set the buttons (the default is `5, 10, 15, 30, 60` minutes, up to 8 buttons, decimals such as `7.5` work), the warning (seconds before the end, 60 by default, 0 for no warning), the warning colour (amber) and the time's-up colour (red). *Back to the standard settings* puts the defaults back.
2. **Race Setup > Race Setups > Add:** choose the session type **Time Token Session**. The form asks only what a token session needs (name, track, layouts, audio set, Trackmate settings): no start lights, laps, fuel or penalties. It uses the settings of step 1.
3. **Home tab:** choose that setup. Drivers and cars are optional here: a lane without a driver is a *Guest*. The button says **Open the session**.
4. **The race screen.** The default token layout is used (*Customization > Layout Editor > Default token layout*, which you can copy and change): for each lane of the track the lane number, driver, Token Clock, last lap and best lap. Press **Space** (or Start): the session opens at once, there are no start lights. Every lane is neutral and dimmed, because nothing is bought yet.
5. **Under the timing there is a panel with the lane controls.** For each lane: a driver choice (with *Guest*), the time left and its state, the time buttons, **Undo**, **End time now** and **Clear**, and *Pause all / Resume all* at the top.
   - Press **+10 min**: the lane is on, the Token Clock counts down. The first time the car crosses the line the timing starts, the next crossing is a lap. A crossing on a lane that is not bought is ignored.
   - Press **+5 min** on a lane that is running: the 5 minutes are added to what is left.
   - In the last minute (or whatever you set) the Token Clock turns amber. **When the time is up, every widget of that lane turns red** (also the lane colours and the widget backgrounds you chose; the text changes to white or black, whatever can be read). The other lanes are not touched.
   - **Undo** takes back the last time added (or an *End time now*). **End time now** ends the time of that lane at once. **Clear** switches the lane off again (neutral, not red) for the next driver.
   - Buy time for a lane that is red: it starts again from now, for the same or another driver.
   - **Another driver on a lane that is running:** choose them in the lane's list. The time that is left goes along; the earlier driver's laps are saved as their own result.
   - **Pause all:** the clocks stand still (and crossings are ignored); Resume all lets them run again. Time can still be added while paused.
6. **A lap driven after the time was up** is recorded and kept, with a mark (*Late lap*), but it never counts for the best lap, a personal best or a track record.
7. **Results and Records now has two subtabs: Racing Records and Token Records.** Racing Records is what it was. Token Records works the same way (the same three folders, track records, personal bests), but is a separate pool: a token lap never mixes with the racing laps. A session there is called a **stint** (one driver, on one lane, for one paid time) and shows the time bought, the laps and the late laps. A Guest has no personal bests, but can hold a track record. A stint is saved as soon as it ends (lane cleared, driver changed, new time bought after it ran out, or the session ended).
8. **End the session with Stop (the key S).** It asks once; every lane is switched off, and all stints with laps are saved. Nothing else to check.
9. **Close the app in the middle of a session** (or let it crash) and open the same setup again: the app offers to carry on, with the time that was left on every lane and the laps driven. *Cancel* saves what was recorded and starts a clean session. The session is kept at every change of the time, and every few seconds for laps.
10. **Spoken calls** (Customization > Audio Settings, the folder *Time tokens*): one when a lane's time is almost up (driver, lane and seconds can be said) and one when it is up. Each is said once per period of time.
11. **The second screen and phones that follow the race** show the same Token Clocks and the same red lanes.

Good to know:
1. **Idle lane = neutral, only an expired lane is red.** A lane that has not been bought yet is dimmed, not red.
2. **Red wins** over lane colours and widget backgrounds, with text that can be read. Widgets that are buttons (Start, Pause, flags) are not coloured red.
3. **The Token Clock** is a new widget (group *Time Tokens*). It can be placed in any layout. The option *Turn amber when the time is almost up* can be switched off for a clock that must stay in its own colour.
4. **The clock of a lane is the race clock,** so a pause (or a red flag) stops it. The time is counted in whole seconds, rounded up, so a clock never shows 00:00 while there is time left.
5. **Time is bought in minutes.** In the buttons field a comma (or a space) separates the buttons, and a decimal uses a point: `7.5` is seven and a half minutes.
6. **Not in this part yet:** the Tokens tile with the Race Director password on the Live Race pages (part 2). The panel is only on the race window.
7. **A stint without any laps is not saved** (a lane that was bought but never driven leaves no result). Say if you want the sold time of such stints to be saved too.
8. The tests (`tests/tokens.test.js`, `tests/tokenrace.test.js`, and new parts of `tests/screens.test.js`, `tests/transfer.test.js`) check: stacking, the warning edges, late laps, the driver change with carried time, undo and end now, keeping and restoring a session, a stint that could not be saved is offered again, the red and amber colours on the race window and on a following screen, the two pools, the settings page, the form for the session type, the Home tab for a token setup, and which lane buttons can be pressed when. I also broke the code on purpose in 45 ways in copies of the app to check that the tests notice each one.

## What to try (0.83.0): Time Tokens, part 2 (add time from a phone or tablet)

**What this is.** The lane controls of a Time Token Session are now also on the Live Race pages, so a person at the desk or at the track with a phone or tablet can sell time without going to the main computer. The password is the one you already set for the Race Director (App Settings > Network access): you enter it once on a device, and it covers both pages.

1. **Open a Time Token Session** on the main computer (Home tab, a race setup of the type Time Token Session, *Open the session*).
2. **On the main computer, or on the second-screen window:** open the **Live Race** tab. There is a new tile, **Tokens**. It opens the lane controls at once (there is no login on the main computer, as with the Race Director).
3. **On a phone or tablet** (App Settings > Network access, open the address in the browser): the same tile, **Tokens**. It asks for the password first; after that, the Race Director page needs no password again.
4. **The page shows the same controls as the race window:** the lanes of the track (a 4-lane track shows 4 lanes), the driver of each lane (with *Guest*), the time left and its state (No time, Running, Almost up, Time's up), your time buttons from Race Setup > Time Tokens, **Undo**, **End time now**, **Clear**, and **Pause all / Resume all**.
5. **Press +10 min on the phone:** the lane is on at once on the main computer, and the clock runs on the phone, the main computer and the other screens. Buttons that make no sense at that moment (Undo with nothing to undo, End time now on a lane that is off) are dimmed.
6. **While the session has not been opened yet,** the page has an **Open the session** button, which goes away once it has been opened.
7. **Choose another driver** for a lane in its list: the lane keeps its time, the earlier driver's laps are saved as their own result, and every screen shows the new name (also the Race timing and Leaderboard pages, the second screen, and other phones).
8. **Press a time button twice by accident:** a second press on the same lane within 0.6 seconds is ignored, so a slip of the finger does not sell the time twice. This is also so on the main computer. The other lanes are not held back, and a press a moment later counts.
9. **Open the Tokens tile in a race that is not a Time Token Session:** the page says that no Time Token Session is running.

Good to know:
1. **No second password.** The Race Director password covers the Tokens tile. If no password is set, the Tokens tile (like the Race Director page) can only be used on the main computer, and the page says so.
2. **Everything is checked twice.** The server only lets a command through with a whole lane number from 0 to 15, minutes above 0 and at most 1440 (one day), and a driver that is text; the race window checks again (a lane the track does not have, or a driver that is not in the database, does nothing; a driver that cannot be found never turns a lane into a Guest).
3. **The race window does the work.** The page only sends the button that was pressed. What you see on the phone is what the race window sent back, so the phone and the main computer always agree. If the race window is closed, the page has nothing to show and nothing is queued.
4. **The time buttons and drivers on the page are those of the running session,** so changing the buttons in Race Setup applies from the next session (as on the main computer).
5. **Still the same limits as part 1:** laps after the time is up are marked late, a stint without laps is not saved, and the session is kept for a restart on the main computer.
6. The tests (`tests/tokenrace.test.js`, `tests/web.test.js`, `tests/live.test.js`, `tests/icons.test.js`, `tests/tokens.test.js`) check: the tile and its picture; the login (a wrong password, the right one, both pages with one login, no password set); each button on the page reaching the race window and doing the right thing; the double tap guard (per lane); the commands that make no sense (a lane the track does not have, minutes of 0, a negative number, text, 99999, a missing or unknown driver) being refused by the server and by the race window; the driver change reaching other screens; the page building itself again when the race window sends its setup again; and the dimmed buttons. I also broke the code on purpose in 29 more ways in copies of the app to check that the tests notice each one.

## What to try (0.83.1): fix for a race that would not start after a Time Token Session

**What was wrong.** When a Guest (a lane with no driver) drove the fastest lap in the Token Records of a track, opening the next Time Token Session on that track failed. The failure also switched off every button on the Home page, so it looked as if no race of any type could be started, and it stayed that way after restarting the app, because the fastest Guest lap is saved in the database.

1. **Open a Time Token Session** on a track where a Guest drove the fastest token lap. It opens now. The record shows the name *Guest*.
2. **A record held by a driver that was deleted** since shows as *(deleted)*.
3. **A Guest has no personal best:** the race window no longer compares a Guest lane with other Guest laps.
4. **If a screen ever cannot be opened for another reason,** the app now says so ("This screen could not be opened", with the reason) and offers **Back to Home**, instead of leaving the old page with its buttons switched off. Nothing is lost when this happens.
5. **Nothing in your saved results has to be repaired:** the laps and stints in the database were fine; only reading them back failed.

The tests (`tests/tokenrace.test.js`) check: a Time Token Session opens from the Home tab when a Guest holds the record, when the record's driver was deleted and when a lap was taken out of the records; a race of another type opens too, and the token laps are not in its records; the error screen and the way back. Every test suite now also fails if the app reports a screen that could not be drawn.


## What to try (0.84.0): minus buttons for the lane time, reviewing laps during a race, and a review at the end of a Time Token Session

**What this is.** Four things you asked for: time can be taken off a lane in steps (with +1 and −1 as standard buttons); the Race Director can check laps while any race is going on, and delete or invalidate one straight away; and a Time Token Session now ends in a review, like a race does, before anything is saved.

**1. Taking time off a lane**
1. **Race Setup > Time Tokens** has a new field, *Time buttons that take off*. The standard is `1, 5, 10`; an empty field means no minus buttons at all. *Back to the standard settings* sets both lists.
2. **In a Time Token Session** every lane has a second row of buttons: −1 min, −5 min, −10 min. They work on the main computer and on the Tokens page of the Live Race pages (phone, tablet).
3. **Time is only taken off a lane that is on.** Never more than what is left: if you take off more, the time is up at once and the lane turns red. The time bought goes down by what was taken, so the result of that stint shows the time that was really sold. **Undo** gives it back, also when the lane went red.
4. **Plus buttons now start at +1:** the standard list is `1, 5, 10, 15, 30, 60`. If you saved your own list earlier, it stays as you set it; press *Back to the standard settings* once to get +1 and the minus buttons.

**2. Reviewing laps during a race (every session type)**
1. **Start any session** (practice, race, heats, timed, qualifying, Time Token Session). While it runs or is paused, the bar under the picture has a **Review laps** button.
2. **It opens a panel with every lane:** driver, laps, last lap and best lap. **Laps** unfolds the laps of a lane, the newest on top.
3. **Mark invalid** keeps the lap in the race (it counts for the laps and the time) but it is no best lap, no record and no personal best. **Mark valid** brings it back.
4. **Delete…** asks how: **From the records only** (the lap stays in the race but is not saved in the database), or **From the race too (recalculate)**: one lap fewer, less time, the car has to drive that lap again.
5. **A car that has finished its race** (while others still drive) can only have a lap taken out of the records: taking it out of the race would un-finish it. That choice is not offered for such a car.
6. **The Race Director page** (Live Race tab, also on a phone with the password) has the same thing: a *Review laps* box that you open when you need it.
7. **The shown best laps follow:** the highlights (best lap, personal best, track record) and the record lap are worked out again from the laps that still count, also the bests of earlier heats.
8. **In a Time Token Session** the same is done for the stint that is running on the lane. A lap driven after the time ran out stays invalid (it can't be made valid) but can be taken out of the records.
9. **Laps only.** Penalty points, disqualifying, adding time, Finalize and Delete all data stay in the review after the race; that review is unchanged.

**3. A review at the end of a Time Token Session**
1. **Press Stop** (or S): every lane is switched off and the review opens. It lists every stint (lane, driver, time bought, laps, best lap, how it ended). **Laps** unfolds a stint, with the same Mark invalid / Delete… as above (*From the stint too* instead of *From the race too*).
2. **Finalize results** saves every stint as a result of its own (Token Records). **Delete all data** saves nothing.
3. **Nothing is saved before Finalize.** Until then the stints are held, also across a restart: if the app is closed during the review, opening the session again brings the review back.
4. **A session in which no lap was driven** has nothing to check and ends at once.
5. **A stint of which every lap was taken out** is not saved at all.
6. **If saving fails** (disk full, say) the review stays open and says so; press Finalize again to try once more. Nothing is lost.
7. **Back to Home** is off during the review (as with a race).
8. **The Race Director page** shows a note for such a session: the stints are checked on the main computer, where Finalize is pressed.

Good to know:
1. **A change from 0.82/0.83:** stints used to be saved as they ended (each driver change, each Clear). Now they are held until Finalize, so the Token Records only change when you finalize. If you answer *Cancel* to "A Time Token Session of this race setup was not ended", what it recorded is saved straight away, without a review.
2. **Time sold for a stint without any laps** is still not saved (nothing was driven).
3. **Only laps can be corrected during a race.** A lap command from a phone for a car or lap that does not exist, or for something that is not a lap correction, does nothing.
4. **The panel does not move under your finger:** it is only drawn again when something in it changed (a new lap, a correction, unfolding a lane).
5. **Opening a new race or session starts with all lanes folded.**
6. The tests (`tests/tokens.test.js`, `tests/tokenrace.test.js`, `tests/live.test.js`) check: the minus buttons and Undo (also after a restart); marking invalid, making valid, deleting from the records and from the race, on the race window and on the Race Director page, while running and paused, for a car that is still racing and one that has finished; that the corrections reach the stint of a Time Token Session and come back after a restart; that a lap after the time ran out stays invalid; that the shown best laps are worked out again (also with earlier heats and with held stints); that a wrong or foreign command does nothing; the token review (Stop, Finalize, Delete all data, a second press while saving, a failed save, nothing driven, every lap taken out, the review back after a restart, the note on the Race Director page); and what is saved afterwards.

## What to try (0.85.0): a special look for the control pages, and a Help tab
**What this is.** Two small things. The two Live Race pages that can change the race (Race Director and Tokens) now look a little different from the pages that only show it, and App Settings has a Help tab.

1. **Live Race tab.** The **Race Director** and **Tokens** tiles have a tinted background, a stripe in the accent colour on the left and a small **Control** badge. The five other tiles are as they were. Open one of the two pages: its header bar is tinted in the same way, with the badge next to the title. The colours come from the theme, so it follows every theme (try a few under App Settings > App Theme, also a Custom one).
2. **App Settings > Help** (the last sub-tab). It opens with your welcome text and the four quick steps. Below it are folders in the same style as the Database and Race Setups folders, all closed: *Setting things up* (The Home tab, Database, Results and Records, Race Setup, Session types), *Racing* (Starting a race, The race screen, Race Director flags and penalties, Fuel and pit stops, Time Token Sessions), *Making it yours* (Customization, Audio calls, Look and feel) and *Connecting and sharing* (Live Race, Phones and tablets, Timing hardware, Import export and backup). **Open all** and **Close all** are above the first group. A folder you opened stays open while the app runs.
3. Try it on a phone width too (narrow the window): the text and the numbered steps wrap.

Good to know:
1. **I changed four small things in your welcome text, because the app says otherwise.** (a) The Home button is called **Start race**; only a Time Token Session says **Open the session**, so step 4 and the first paragraph name both. (b) Step 1 says a **name and the number of lanes** are needed (the track form asks for a name). (c) Step 3 also says to pick the **track**, because a race setup without a track cannot start (Home says so). (d) "TrackMate" is written **Trackmate**, as everywhere else in the app, with the place: App Settings > Timing Hardware. Everything else is your wording.
2. **One line was added under the steps:** "No Trackmate yet?" with Simulated cars and the number keys, because Trackmate is the first thing the text asks for. Tell me if you want it removed.
3. **The folders are my text, written from what the app does today.** Read them and tell me what to change. `tests/help.test.js` checks that every tab, tile, button, key, session type and form option the text names exists in the app, so a rename in the app that the Help does not follow is caught by the tests.
4. The Help is plain text in `renderer/help.js` (one list called SECTIONS). A new folder is one more entry there.
5. The tests are now 29 files (`tests/help.test.js` is new); `tests/live.test.js` and `tests/screens.test.js` have new checks for the tiles and the Help tab.
6. The rows of sub-tabs now wrap onto a second line in a narrow window (below 700 pixels). App Settings has six sub-tabs now, and in a narrow window the last ones ran off the screen.

## What to try (0.86.0): a picture for every start light and every race state
**What this is.** A Start lights picture set was two pictures (lit and unlit) used for all five lights in every state. Now it is a grid: every light can have its own picture in every state of the race, such as the yellow flag.

1. **Customization > Image Settings > New picture set**, and choose **For: Start lights**. You see a grid. The rows are **Light off**, **Light on** and one row per race state (Ready, Racing (green flag), Paused, Heat finished, Finished, Yellow flag, Red flag). The columns are **All lights** and **Light 1** to **Light 5**. Click a cell to choose a picture; the small x next to it removes it again.
2. Try this: put a picture in *Light on / All lights* and one in *Light off / All lights*. Every empty cell now shows the picture it will use, dimmed. Then put a picture in *Yellow flag / All lights*, and another one in *Yellow flag / Light 3*. The cells and the **Preview** at the top follow (choose Yellow flag in the Preview list).
3. **Layout Editor:** select a **Start Lights** widget, choose the set under *Picture set*, and for the Yellow flag choose *lights on: All 5 lights* (the lights options of the widget are as before). In a race press **Y**: the lights show your yellow pictures, with the one for light 3 where you put it. The same on the second screen and on a phone.
4. **A set made before 0.86.0** (Light on and Light off only) opens in the grid with those two filled in and looks exactly as before.

**Which picture a light uses.** A light that is on looks for: the picture of that light in that state, the picture of all lights in that state, the Light on picture of that light, and then Light on for all lights. The countdown always uses Light on. A light that is off uses Light off of that light, then Light off for all lights. A light without any picture is a plain round light (with the colour of the widget's settings), also when other lights have one.

Good to know:
1. **The grid is turned the other way round from my proposal** (the states are rows, the lights are columns): nine rows across the width would not fit on a smaller screen, and the flag picture sets already have a row per state.
2. **A light that is off has no picture per state.** It uses Light off (of that light, or of all lights). Say so if an unlit light should look different in a state, for example during a red flag.
3. **How many lights are on in a state, and their colour, are still the widget's settings** (and the race setup choice *Start lights after the race has started*). The grid only decides how a light looks.
4. **A fix that came along:** the pictures of a start lights set were drawn at their own pixel size instead of fitting in the light. They now fit (a picture of any size is drawn at the size of the light), so a large picture no longer covers the other lights.
5. **Removing a picture** takes the cell out of the set: nothing empty is stored. A set can hold 54 pictures, each shrunk to at most 512 pixels, so a full grid makes a large database file. Fill in what you need.
6. **Export, Import and the complete backup** take the whole grid along; the tests check this.
7. The tests (`tests/timing.test.js`, `tests/widgets.test.js`, `tests/screens.test.js`, `tests/transfer.test.js`) cover: the fallback order for lit and unlit lights, every state (including Paused, Ready, Heat finished and Finished), a flag-following race setup, an old two-picture set, a set without pictures, the editor (54 cells, dimming, preview, removing, saving, an old set opening), the export, and the picture size in the style sheet.


## What to try (0.87.0): more spoken calls, part 1: race progress, gaps and battles
**What this is.** The first third of the extra audio calls you asked for. Two new folders in **Customization > Audio Settings** (open or make an audio set): **Race progress** and **Gaps and battles**. Part 2 (laps and records, pits and fuel, penalties, time tokens, safety calls) and part 3 (conditions such as "only for driver X", and a "not again within N seconds" pause) follow in the next versions.

1. **Race progress** (laps to go, minutes to go, race distance, the last lap, the next heat). Open the folder and look at the new calls:
   - **Laps to go in a race by laps.** The box *When this many laps are left* takes numbers separated by commas, for example `5, 3`. Each one is said once, when the leader has that many laps left. Sentence: `{left} to go, {driver} leads`.
   - **Minutes to go** in a timed race or a qualifying. *When this many minutes are left* takes whole minutes, for example `5, 1`. Said once each.
   - **Another driver starts the last lap** (not the leader, who has the last lap call). Off until you switch it on.
   - **The next heat is ready** (said while the race waits between two heats) and **A heat is finished** (said instead of "The race is finished" after every heat except the last one).
2. **Gaps and battles** (all three are off until you switch them on, because they are talkative):
   - **A driver closes in on the car in front.** *Closer than (seconds)* is the gap, from 0.1 to 30. Sentence for example `{driver} is {gap} behind {other}`.
   - **A battle for a place.** Said when two drivers have been that close for *this many laps in a row* (2 to 20, default 3).
   - **A driver is lapped by the leader**: `{driver} is lapped by {other}`.
3. Try it: in a set, switch on *Gaps and battles > closes in*, give it a gap of 5 seconds, and run a race with two or more Simulated cars. Press **Test** on a call to hear the sample sentence. For laps to go, run a race of 6 laps and listen for "3 to go".
4. **New words you can use in a sentence** (the list under each call and the table at the bottom show where they work): `{gap}` (for example "0.8 seconds", or "12 seconds" when it is 10 or more), `{lapsdown}`, `{heat}`, `{heats}`, `{car}`, `{best}` and `{track}`. `{heat}` and `{heats}` also work in the pre-race call, in Lights out and in The race is finished, so "Heat 2 of 3, at {track}" is possible.

Good to know:
1. **Sets you made before keep working.** A set without the new settings says *3 laps to go* and *1 minute left* (the defaults), the talkative calls (closing in, battle, lapped, another driver on the last lap) stay off, and the closing gap is 1 second. An empty list means "never".
2. **The gap is measured at the line**, each time the chasing car completes a lap, from the lap times (including time penalties). It is not a live gap while the cars are on the track, so a call comes a little after the pass, not during it.
3. **Said at most once per approach.** After a closing-in call the same two cars are not called again until the gap has been more than one and a half times the setting. At most two closing or battle calls are made after one lap, so a pack does not talk over itself. Nothing is said about a car that is in the pits, disqualified, retired or already finished, nor about the car in front being in the pits.
4. **Lapped** is judged when the lapped car completes a lap, as soon as the leader has completed more laps than before.
5. **The last lap call** is still the leader's. The new "another driver" call is said at most once per driver, and not for the driver the last lap call was about.
6. **Practice and qualifying** compare best laps, so "closes in" there means "within the gap of the best lap in front of him".
7. The tests (`tests/audio.test.js`, `tests/engine.test.js`, `tests/screens.test.js`, `tests/live.test.js`, `tests/help.test.js`) cover: every new call, its once-only rule, the old-set defaults, the limits of every field, saving, editing and duplicating a set, the engine's gap calculation (new function `gapInfo`), and complete simulated races (laps to go, closing in, a three-heat race with every spoken heat call in order). The Help tab text for Audio Settings mentions both folders.

## What to try (0.88.0): more spoken calls, part 2: records, pits, penalties, safety, time tokens
**What this is.** The second third of the extra audio calls: 13 new calls and a handful of new words for your sentences. They are in **Customization > Audio Settings** (open or make an audio set). There is one new folder, **Safety**, between *Flags* and *Finish*. Part 3 (conditions such as "only for driver X", and a "not again within N seconds" pause) is the next version.

**All 13 new calls are off until you switch them on**, in a new set and in a set you made before. That keeps a set from before 0.88.0 exactly as quiet as it was.

1. **Laps and records**
   - *A driver completes the first lap*: `{driver} completes the first lap, {time}`. Said after a record call, if the lap was also a record.
   - *A lap close to the track record (you choose how close)*: the box *Said when a lap is at most this close to the track record (seconds)* takes 0.01 to 5, default 0.1. Sentence: `{driver} is {off} off the track record`. Only on a track that has a record. A lap that beats the record has its own call, so it is not "close". A close lap that is also the fastest lap or a personal best says both calls, if both are on.
   - The three record calls (fastest lap, track record, personal best) can now say `{improved}` (how much better the lap was than the best before it, for example "0.12 seconds") and `{record}`.
2. **Pit and fuel**
   - *A car has used half of its fuel*: once, until the tank is filled again. A car that starts with half a tank or less is not told.
   - *A car has refuelled*: said when the pit stop is over, with `{refuelled}` (litres), `{fuel}` (litres in the tank now) and `{pit}` (how long the stop took). It comes before "leaves the pits". Only when fuel was put in.
   - *A car leaves the pits* can now say `{pit}` and `{fuel}`.
3. **Penalties**: *a special penalty has been served*, *is forgiven*, and *time is added to a driver*. **The last two are also said in the review after the race**, because they change the result: press Forgive or add time and you hear it. Points taken off or given back in the review are still not announced. Sentence for the time: `{added} added to the time of {driver}` ("5 seconds").
4. **Safety** (new folder)
   - *A lane calls for the marshal (the Call button)*: `{driver}`, `{lane}`. Said after the yellow flag call, which the Call button also raises.
   - *A car has not completed a lap for a while*: the box *Said when a car has not completed a lap for (seconds)* takes 5 to 600, default 30. It counts from the car's last lap (or the start) and is said **once for each stretch without a lap**; after the car completes a lap, the next quiet stretch is announced again. Not for a car in the pits, finished, retired, disqualified or out of fuel, not for a lane without paid time in a Time Token Session, and not while the race is paused.
   - *The Trackmate connection is lost* and *is connected again*: only **during a race** (countdown, running or paused). Connecting the Trackmate before the start says nothing, and the first look at the connection never says anything.
5. **Time tokens**: *Time is added to a lane*: `{added}` ("5 minutes", "1 minute 30 seconds"), `{seconds}`, `{lane}`, `{driver}`. Said when time is bought for a lane that is running, idle or out; also while the session is paused. Taking time back (Undo, minus buttons) says nothing. *A lane is freed*: said when the operator clears a lane, not when a period simply runs out.
6. **New words**, in the table at the top of the audio set (it says where each works). Every call about a driver now also has `{lane}`, `{points}` (his penalty points; in the penalty call it is still the points just given), `{fuel}` (empty in a race without fuel) and `{gapahead}` (the gap to the car in front right now, empty for the leader). Every call has `{record}` (the track record, empty if the track has none). New in single calls: `{improved}`, `{off}`, `{pit}`, `{refuelled}`, `{added}`.
7. Try it: make an audio set, open *Safety*, switch on *A car has not completed a lap for a while*, set it to 10 seconds, and run a practice with Simulated cars off: after 10 seconds without pressing a lane key, you hear it. In a race with fuel, switch on *half of its fuel* and *has refuelled*. In a Time Token Session, switch on *Time is added to a lane*, press +5 on a lane and listen.

Good to know:
1. **Gap wording changed slightly:** a whole-second gap is now spoken "3 seconds", not "3.0 seconds" (also in the closing-in calls of 0.87.0).
2. **A close lap needs a track record.** A track with no laps yet has none, so the close-to-record call stays quiet there. The record is the one the race starts with, and it moves when a lap beats it.
3. **"No lap for a while" is measured on the race clock** and is checked at every look at the race (about 10 times a second), so it can be up to a moment late. After a pause the count continues where it was.
4. **The words are empty when they do not apply** (for example `{gapahead}` before anyone has a lap), and a sentence leaves out an empty word.
5. **Old sets** keep their sentences; the new settings (0.1 seconds, 30 seconds) are filled in when you edit and save the set.
6. The tests (`tests/audio.test.js`, `tests/screens.test.js`, `tests/live.test.js`, `tests/tokenrace.test.js`, `tests/help.test.js`) cover every new call, its once-only and off-by-default rules, the limits of both settings, the review calls, the exclusions of the no-lap call, the Trackmate cases, the new words, saving, editing and duplicating, and complete runs of the race screen and the Time Token Session. The Help tab (Audio calls) names the new folders.

## What to try (0.89.0): more spoken calls, part 3: "Only if" under a sentence, and "Not again within" for a call
**What this is.** The last third of the extra audio calls. In **Customization > Audio Settings** (open or make an audio set) every sentence of a call has an **Only if…** box, and every call has a **Not again within (seconds)** row. A set from before 0.89.0 is unchanged: no sentence has conditions and no call has a wait.

1. **Only if…** (under each sentence, closed to begin with; a short summary of what is set shows next to it, for example *Only if… (Sam, top 3)*). Inside:
   - *the driver is* **anyone** or one of the drivers of your database. The driver is the one the call is about, the one `{driver}` says (in "A driver moves up a place" that is the driver who moves up).
   - *the driver is in the top* N: his position in the race at that moment (1 = leader).
   - *the lap time is under (seconds)*: only in the calls that say a lap time (fastest lap, track record, personal best, first lap, close to the record).
   - *the gap to the car in front is under (seconds)*: the same gap `{gapahead}` says. The leader has no car in front, so this does not hold for him.
   - Empty = no condition. Everything that is filled in must hold. "Under" means really under: with 5.2 a lap of 5.20 does not count.
   - Calls that are not about a driver (flags, countdown, finish...) have no box. The Time Token calls only have the driver.
2. **Which sentence is said.** A sentence whose conditions hold is said **instead of** the sentences without conditions (if several do, one of them at random). If none hold, one of the sentences without conditions is said. If every sentence of a call has conditions and none hold, nothing is said.
   Example: *New leader* has `{driver} takes the lead` and a second sentence `The champion is back in front!` with *Only if the driver is* Alex. When Alex takes the lead you always hear the second one; for everybody else the first one.
3. **Not again within (seconds)**, at the bottom of each call (not in the Start folder and not in the Finish folder, where a call is said once). Whole seconds, 1 to 3600; empty = no limit. In calls about a driver you also choose *counted* **for the whole call** (nobody hears it again for that long) or **for each driver** (the same driver does not hear it again, others do).
   - The time is real time, counted from the last time the call **was said**. A call that was held back does not make the wait longer.
   - A call that is off, or that has no sentence that fits the conditions, does not start a wait.
   - Every audio set has its own waits, and every call its own. **A new race screen starts with no waits.** The waits carry on from one heat to the next heat of the same race.
4. Try it: open *Positions > A driver moves up a place*, set *Not again within* 30 seconds; in a race with three or more cars you now hear at most one of those calls every 30 seconds. Or open the *Laps and records > Fastest lap* call, add a second sentence `Rocket lap, {driver}!` and under *Only if…* put *the lap time is under* 5 seconds: lap times below 5 seconds get the second sentence, slower fastest laps the first.
5. The **Test** button of a sentence always speaks it: it ignores the conditions and the wait, because they are about a real race.

Good to know:
1. **Export, Import and Duplicate take it along.** A sentence "only for Kim" brings Kim with it when you export the audio set and after import it is for the imported Kim. If the driver is not in the export, or is deleted from the database, the sentence stays "for a driver that is gone" (shown that way in the box), so it is not said for everybody. Pick another driver or *anyone* to change it.
2. **It is checked against what the race knows at that moment:** the position, the gap and the lap time are those of the moment of the call, which is when a lap is completed for most calls. A condition about something that is not known (a position before the start, a gap in a Time Token Session) does not hold.
3. **What it cannot do (yet):** "anyone except driver X", "either of two drivers" and a condition on a car instead of a driver. Tell me if you want any of these.
4. The tests (`tests/audio.test.js`, `tests/screens.test.js`, `tests/live.test.js`, `tests/tokenrace.test.js`, `tests/transfer.test.js`, `tests/help.test.js`) cover every condition on its own and together (including the exact edge of "under"), the choice between sentences, the wait (to the millisecond, for each driver, per call and per set, new race, nothing for calls that said nothing), the editor (boxes in the right calls, limits, empty = removed, saving, editing, duplicating, a driver that is gone, boxes that stay open), export and import of the driver link, and complete runs of a race and of a Time Token Session.

## What to try (0.90.0): a one-click builder and installer for the Mac
Mac version of `build-windows.bat` and `build-linux.sh`. On a Mac, in the SlotForgeTiming folder:
1. Install Node.js (LTS, version 18 or newer) from https://nodejs.org.
2. Double-click **`build-mac.command`**: Finder opens it in Terminal. It installs what it needs, runs the tests and makes the programs. The first time it takes a few minutes and needs internet. If macOS offers to install the *command line developer tools* along the way, choose Install and run the file again.
   - Because the zip came from the internet, macOS may refuse to open the file ("Apple cannot check it for malicious software"). Right-click it, choose **Open**, and then **Open** again. Or open Terminal, type `cd ` (with a space), drag the SlotForgeTiming folder into the window, press Enter and run `bash build-mac.command`. If it says "permission denied": `chmod +x build-mac.command`.
3. It puts two files in the **dist** folder: `SlotForgeTiming-<version>-mac.dmg` (open it and drag SlotForge Timing onto Applications) and `SlotForgeTiming-<version>-mac.zip` (the same app in a zip, nothing to install). It is **one app for both kinds of Mac**, Apple Silicon (M1 and newer) and Intel. If only the .dmg or the .zip fails, you still get the app and the script says so.
4. At the end it asks whether to **install the app for you**: the app is copied to `/Applications` (or to the Applications folder in your home folder, if you may not write in `/Applications`). No password, nothing else is touched. It takes off the "downloaded from the internet" mark, and gives the copy a signature for this Mac if it has none (an Apple chip will not start an app without one). `./build-mac.command --install` does it without asking, `--no-install` only makes the files, `./build-mac.command --uninstall` removes it again (your races and settings are kept). Add `--no-pause` to not wait for Enter at the end. It refuses to run with sudo, it refuses to replace or remove the app while it is open (it asks you to quit it first), and it refuses on a computer that is not a Mac (and points to the other builders).
5. **Sharing it with another Mac:** the app is *not* signed with a paid Apple Developer certificate, so on another Mac the first time you right-click the app and choose **Open**, then **Open** again (macOS 15 and later: System Settings > Privacy & Security > scroll down > **Open Anyway**). On the Mac that made the app, it just opens. If you have an Apple Developer account and want the app signed and notarized (no warning anywhere), tell me: that needs your certificate, and I have to build in the settings for it.
6. **Mac things:** your races and settings are in `~/Library/Application Support/slotforge-timing`. The menu is in the Mac menu bar at the top of the screen (the "press Alt for the menu" of Windows and Linux does not apply). Closing the window quits the app, as on Windows. The first time, macOS asks whether the app may accept incoming network connections (for Network access and the phone page): choose Allow. The Trackmate shows up in *Find the Trackmate (COM port)* as something like `usbmodem...` or `usbserial...`.
7. **Not tried on a real Mac yet.** The script is tested with stand-ins for npm and for the Mac tools (`tests/mac.test.js`, 48 checks: the steps and their order, the files, installing in both places, replacing an older copy, the app being open, uninstalling, every failure, a missing Node.js, a computer that is not a Mac). I changed the script and the settings on purpose in 33 ways to see that the tests notice each one; one slipped through at first (a path that is not a folder), and there is a check for it now. What I could not run here: the real build (`electron-builder` can only make a .dmg on a Mac), the merge of the two kinds of Mac into one app, and the app itself. The script is also written for the old bash 3.2 that macOS has: the test refuses newer features, but I have no Mac bash here to run it on. If `build-mac.command` stops somewhere, send me what Terminal shows.
8. **The icon** is the same round `icon.png` as on Windows and Linux. A Mac icon is normally a rounded square with a little space around it, so this one looks a bit larger and rounder than the apps next to it in the Dock. If you want a Mac version with space around the circle, tell me how much.

## What to try (0.91.0): Delta Timers, a new folder of widgets in the Layout Editor
A **Delta Timer** is a time widget with a coloured badge on its right side that shows how far a lane is from another time. **Green with ▼ and a minus (▼ −0.045) = faster, red with ▲ and a plus (▲ +0.321) = slower.** A negative difference is a faster one, so it is green. The badge is a solid block with a bold number, so it can be read from across the room.
1. Open **Customization > Layout Editor**. The widget list has a new folder, **Delta Timers**, with eight widgets: *Laptime Delta*, *Average Lap Delta*, *Median Lap Delta*, *Best Lap Delta*, *Personal Best Delta*, *Pitstop Time Delta*, *Session Record Delta* and *Track Record Delta*. They are the widgets that show one single time (the last-laps list is not one of them). Each is placed on a lane, like the ordinary widget.
2. The left side of a Delta Timer is the ordinary widget (the *Personal Best Delta* shows the lane's personal best just as the *Personal Best* widget does; the *Laptime Delta* has the settings of the *Laptime* widget and the record deltas the *Show who set it* setting of the record widgets); the right side is the badge.
3. **What is compared** (the first setting). You choose one of these for the widget (the whole sentence of the choice is also written under the box, because the settings panel is narrow); you can put several copies on the page with different choices:
   - *This lane's value against theirs* (the static one): for example the personal best of this lane against the personal best of the other lane. It only changes when one of the two values changes.
   - *This lane's last lap against their value* (the live one): the lap this lane has just driven against the other lane's personal best, best lap and so on. It changes with every lap. This is the "how am I doing against their record" tracker.
   - *This lane's last lap against its own value* (against itself): for example your last lap against your own personal best. No other lane is needed.
   Not every widget has all three: the *Average*, *Median*, *Best Lap* and *Personal Best* deltas have all three; the *Session Record* and *Track Record* deltas have the first two; the *Laptime Delta* has two: its last lap against theirs, and its last lap against its own best lap (a lap time only has the one, last lap, number, so there is no live one); the *Pitstop Time Delta* only compares pit stops (and says so in the settings).
4. **Compare with**: *a chosen lane*, *the leader*, *the fastest in this race* (the lowest number of all the cars, for the pit stop widget the fastest pit stop), *the track record* or *the session record*. Under *a chosen lane* the **Which lane** setting appears. Left on the first choice, a widget compares with **the next lane** (and the last lane with lane 1), so two copies on lanes 1 and 2 compare with each other without any setting. A copy of a widget on another lane keeps the lane that was chosen in it: change it there if it should compare with another lane. The *Session Record Delta* and *Track Record Delta* always compare with their own record (the record is what they are for), so they have no *Compare with*.
5. **The look**: *Decimals of the difference* (3, 2 or 1: -0.456, -0.46, -0.5), *Show an arrow in the badge* (on or off), and three colours: faster (green), slower (red) and equal (grey). The text on the badge turns black or white by itself, whichever reads better on the colour you chose. A difference that rounds to nothing with the decimals you chose is *equal* (grey, no sign). From a minute on it is written 1:02.345. Text size, text colour and background are the usual ones of every widget; the badge keeps its own colours.
6. **When there is nothing to show**, the badge shows a grey dash. Point the mouse at it (or at any badge) to read why in words: *No time for this lane yet.* (no lap yet), *Nothing to compare with yet.*, *There is no car in the chosen lane.*, or *This is the lane it is compared with.* (a lane compared with itself, for example the leader compared with the leader).
7. **Leaderboard Editor:** the delta widgets are also in the Leaderboard Editor (they are widgets of one lane), so a row of the Leaderboard can have a column with, for example, the gap to the leader (*Compare with* the leader), to the fastest car or to a record, in every row. Careful with *a chosen lane* and its default *next lane* there: that is the next lane of the track, not the car that is in front in the race.
8. Try it: place a *Personal Best Delta* on lane 1 and one on lane 2. Start a race with the simulated cars: they compare with each other from the first moment, and the badges follow every lap. Then set one of them to *This lane's last lap against its own personal best* and watch it go green with each lap that beats the personal best. Or put a *Track Record Delta* on every lane, set to *last lap against the record*: each lap shows how far you are from the record.

Good to know:
1. **No running delta during the lap.** The badge changes when a car crosses the line: it compares completed laps (the last lap) and values that come from completed laps (best, average, median, personal best). It does not move while a lap is being driven; that would need a reference for every point of the track, and the timing only has the lap time. The one exception is the *Pitstop Time Delta*: it uses the pit stop that is running (so it follows the clock while a car stands in the pits) or else the last one.
2. **The record widgets** compare the lane with a record of this track: the personal best of the lane against the track record (first setting) or its last lap against it (second setting), and the *Session Record Delta* the lane's best lap in this session against the best lap of the session.
3. **The phone page** (the live page for the phones on your network) does not show the Delta Timers: it has its own fixed list of numbers. Tell me if you want a delta there.
4. **Old layouts** are unchanged: Delta Timers are new widgets, so nothing existing changes.
5. The tests (`tests/delta.test.js`, 77 checks; plus new checks in `tests/widgets.test.js`, `tests/screens.test.js`, `tests/live.test.js` and `tests/help.test.js`) cover the sign and the rounding of a difference (including "equal" and the minutes), every widget with every choice of what is compared and of compare with, the dash cases, the colours (only a plain #rrggbb ever reaches the page), the settings of the editor (shown only when they matter), the folder in the palette, a Leaderboard row design with delta columns and a simulated race on the live page where the badges appear, change colour with their sign and show dashes before the first lap. A deliberate-breakage run (changing the code on purpose, in places that matter) was killed by the tests every time. **Not tried in a real race on the hardware yet.**

## What to try (0.91.1): Delta Timers: an outlined look, and the arrow the other way round
Two changes to the badge of the Delta Timers (0.91.0). Open **Customization > Layout Editor**, place or select a Delta Timer and look at its settings:
1. **Look of the badge** (new): *Filled (a solid block)* is the look of 0.91.0 and stays the standard. **Outlined** colours only the outline and the text: the inside of the badge is empty, so it looks like the *Live Race* button at the top. The text has the same colour as the outline. The colours are the three that were already there (see 3).
2. **Arrow in the badge**: the arrow now points **up for a faster time** (green, ▲ −0.045) and **down for a slower time** (red, ▼ +0.321): "you are 0.045 up on the pace". This replaces the tick box. In 0.91.0 it was the other way round (the arrow followed the number: a smaller time = ▼). The choice box has *▲ faster, ▼ slower* (the standard), *▼ faster, ▲ slower* (the old way) and *No arrow*. A widget that you made with 0.91.0 and had the arrow switched off stays without an arrow; one with the arrow on gets the new standard direction. The minus sign for a faster time and the plus sign for a slower one are unchanged.
3. **The colours** can be chosen per widget: *Colour when faster*, *Colour when slower* and *Colour when equal* (further down in the settings of the widget; the labels no longer say "badge", because with the outlined look they colour the outline and the text). With the filled look the text on the badge turns black or white by itself; with the outlined look the text is the colour you choose, so on a light layout pick a darker green (the standard green is made for dark backgrounds and is pale on white).
4. Try it: select a Delta Timer, set *Look of the badge* to Outlined, pick a gold *Colour when faster* and see the number and the outline turn gold. Put one widget on *▼ faster, ▲ slower* next to one on the standard to compare the arrows.
5. The tests (`tests/delta.test.js`, 81 checks, and the editor checks in `tests/screens.test.js`) cover both arrow directions, the old true/false of 0.91.0, the outlined markup and colours (only a plain #rrggbb reaches the page), the style rule and the settings in the side panel. A deliberate-breakage run (11 changes on purpose) was killed by the tests every time.

## What to try (0.92.0): Heats, part 1: clearer settings, and the Heat plan on Home
The first of four steps to make heat races and round robins easier to set up and fairer. This one makes the settings understandable and shows the plan before you start.
1. **Race Setup > a Heat-based race.** The settings in *Length and result* now explain themselves: a grey line under each says what it does. *Number of heats* has been renamed **How the heats are planned** (it never chose a number, it chose a plan): *I choose the number of heats* or *Round robin: every driver meets every other driver*. The same for *Each heat is limited by*, *How many heats*, *Overall result counted by* and *Points per position*. Nothing about how heats are made or counted has changed.
2. **Home > pick the heat race setup and add the participants.** Under the participants there is a new **Heat plan**:
   - a line with the number of heats and how long they are ("5 heats, each 6 laps." or, for heats with a duration, "3 heats, each 4 minutes (12 minutes of racing in total).");
   - **a table of the heats by lane**, so you see who races where;
   - **a warning in red when the drivers do not race the same number of heats** (round robin often makes some drivers race one heat more than others, for example 2 to 3 heats for 7 drivers on 4 lanes). The overall result adds the heats up, so an extra heat is an advantage: that is why it says so. The next steps of this series add ways to even this out;
   - a closed box **How often every driver races, and in which lane**: a table with the number of heats and the number of times in every lane for every driver;
   - **Shuffle again**: makes another plan with the same settings.
3. **The plan you see is the plan that is raced.** Before, the plan was made when the race started and could not be seen before. Now **Start race** takes the plan from Home. The plan is kept with the race setup, so it is the same plan when you come back later; it only changes when you press *Shuffle again*, or when you change the number of participants or the heat settings of the race setup (the plan has to fit them). Choosing another driver for a participant keeps the plan: the plan is about places (participant 1, 2, 3...), not about names.
4. Try it: make a heat race setup (Round robin, 6 laps) on a track with 4 lanes, put 7 participants on Home and look at the plan; press Shuffle again a few times; then change the setup to *I choose the number of heats* and see the plan follow. Start the race and look at the *Heat schedule* on the race screen: it is the same plan.

Good to know:
1. **Lanes are only spread over the heats as well as the old way did** (in this plan a driver can be in lane 1 twice in a row). Even lane use ("every driver races every lane") is the next step.
2. **You cannot edit the plan yet** (swap two drivers, or fix a heat). That comes in the last step; for now you can shuffle until it suits you.
3. The tests (`tests/heats.test.js`, new, 25 checks; plus new checks in `tests/screens.test.js`, `tests/live.test.js` and `tests/help.test.js`) cover the shuffle that can be played again, the settings of a setup (and the defaults of an older one), the checks on a saved plan, the numbers (heats and lanes per driver, who meets whom, lane spread), the lines above the preview, the Home tab with a heat race (the plan, the warning, Shuffle again, the plan kept, Start race passing it on) and the race using the plan from Home (and its own plan when that one does not fit). A deliberate-breakage run (21 changes on purpose) was killed by the tests every time, apart from one that changes nothing in practice.

## What to try (0.93.0): Heats, part 2: four ways to plan the heats, equal lanes, and seeding from a qualifying
The second of four steps for heat races. Open **Race Setup**, make or open a *Heat-based race* and look at *Length and result*.
1. **How the heats are planned** now has four choices:
   - *I choose the number of heats* (as before): the drivers are spread over the heats you type. If that does not divide evenly, some drivers race one heat more; Home says so in red.
   - **Every driver races the same number of heats** (new): you type *Heats for every driver*, and the number of heats follows from it. 7 drivers on 4 lanes with 3 heats each is 6 heats (21 places): some heats have 3 cars. Everybody races exactly 3.
   - *Round robin*: every pair of drivers races in the same heat at least once. New next to it: **Same number of heats for everyone**. *No* (the standard) keeps the old behaviour (the fewest heats; some drivers may race one more). *Yes* adds a few extra heats until everybody has raced as many as the busiest driver. With 7 drivers on 4 lanes that is 7 heats of 4 places and everyone races 4 (in the plan without it some race 2 and some 3).
   - **Lane rotation** (new): every driver races once in every lane. With at least as many drivers as lanes there are as many heats as drivers and everybody races as many heats as the track has lanes (7 drivers on 4 lanes: 7 heats, 4 each). With fewer drivers than lanes every heat has all drivers.
2. **Equal lanes, for every plan.** The lanes are now handed out so that every driver uses every lane equally often, give or take one, and a driver who races as many heats as there are lanes (or fewer) never uses a lane twice. This is not left to luck: the lanes are worked out so it always comes out (the tests check 936 plans, from 2 to 14 drivers on 1 to 6 lanes, for all four plans; a wider run while building it covered 2,340 plans without one exception). Home says "The lanes are shared evenly." or, for lane rotation, "Every driver races once in every lane." If a plan from before (a saved one) is not even, Home says so.
3. **Who races together** (new, for *I choose* and *same number of heats*): *Shuffled* (the standard), **By the latest qualifying** (the fastest drivers race together, the best heat is the last one, so the final heat is the strongest), or **Mixed by the latest qualifying** (every heat has fast and slow drivers, so the heats are about equally strong). It uses the latest qualifying session on the track of the setup. Home tells you what it did: *"Seeded by the latest qualifying on this track (2026-10-01)"*, *"There is no qualifying on this track yet, so the drivers are shuffled"*, *"None of these drivers took part in the latest qualifying, so they are shuffled"* or, when some did not take part, "drivers who did not take part are placed last". Round robin and lane rotation always shuffle: they choose the heats to make everybody meet, so there is no room for seeding.
4. **Home > Heat plan** shows all of this: the line with the heats, the lines about equal heats and lanes, the table by lane, the box with the numbers per driver, and *Shuffle again*. The plan you see is the plan that is raced; with seeding, a shuffle changes who is in which heat inside the ranking you asked for, and the plan is made again when you change the participants.
5. Try it: put 7 drivers on a 4-lane track on Home with the plan *I choose* and 3 heats: you see the red warning. Change the setup to *Every driver races the same number of heats*, 3: the warning is gone. Change it to *Lane rotation* and look at the numbers box: a 1 in every lane for every driver. Then drive a qualifying with the same drivers on that track, set *Who races together* to *By the latest qualifying* and see on Home that the line about the qualifying appears and that the best drivers are in the last heat.

Good to know:
1. **Limits of what is possible.** With few lanes not every pair can meet in lane rotation: on 2 lanes a driver meets at most two other drivers. The Home tab shows it in the table. Round robin is the plan to use when everybody must meet.
2. **Seeding needs a qualifying on the same track** with standings (the finished qualifying sessions you already have). Standings that are only in a running session do not count.
3. **You cannot edit the plan yet** (swap two drivers, fix a heat), and the scoring is unchanged: *Overall result counted by* works as before. Averages per heat, dropping the worst heat, a bonus for the fastest lap and a choice of tie-breaker are the next step; finals and a break timer come after that.
4. A race setup from before has *I choose the number of heats* or *Round robin* and *Shuffled* and *No*: nothing changes for it, except that the lanes are now even.
5. The tests (`tests/heats.test.js`, now 62 checks; plus new checks in `tests/screens.test.js` and `tests/help.test.js`) cover the settings and their defaults, the four plans (sizes, numbers of heats, who races how often), the lane evenness for 936 plans, the lane colouring, the seeding (fastest together, mixed, drivers without a qualifying, the latest qualifying of the right track), the lines above the preview and the Home tab for all of this. A deliberate-breakage run (43 changes on purpose) was killed by the tests every time except four that cannot change a result (a check that is already guaranteed by how the heats are made, a lane label order, a case where two ways of making the plan come out the same, and the safety net that is only used for impossible numbers). The run also found six places the tests did not guard yet; those have tests now. **Not tried in a real race on the hardware yet.**

## What to try (0.94.0): Heats, part 3: how the heats add up
The third of four steps for heat races. This one is about the overall result. Open **Race Setup**, make or open a *Heat-based race* and look at *Length and result*. There are five new settings under *Points per position*; every one starts at what you had before, so an existing setup counts exactly as it did.
1. **How the heats are added up**: *All heats added up* (as before), **The average per heat**, or **Only the best heats of every driver count**. The average is fair when drivers race a different number of heats (a round robin on 7 drivers gives some drivers 2 heats and some 3). With *Only the best heats* a new setting **Heats that count** says how many (standard 2): the best 2 of every driver's heats are added up. A driver who raced fewer heats than that has all of them counted, which is less than the others, and Home warns you.
2. **Drop the worst heat**: the worst heat of every driver who raced at least two heats does not count. "Worst" means the fewest laps (for a result by laps) or the fewest points (for a result by points); if two heats are equal, the one with less of the other measure (points, for a result by laps; laps, for a result by points) is the worse, then the one with the higher total time, then the later heat. It is applied first: *Drop the worst heat* with *Only the best 2 heats* means the best 2 of what is left. With the average it is the average of the heats that are left.
3. **Bonus points for the fastest lap of a heat** (only for a result by points): the driver with the fastest lap of every heat gets these extra points in that heat (0 is no bonus; fractions like 0.5 work). If two cars have exactly the same fastest lap, the one who finished higher gets it. The bonus is part of the points of the heat: it is in the points of that row, it counts when you drop the worst heat or count only the best heats, and the heat summary in the results says "12 pts incl. 2 for the fastest lap".
4. **A tie is decided by**: *The other measure (laps or points), then the fastest lap* (the standard, as before), *The fastest lap first*, *The most heat wins first* (the heats a driver won, among the heats that count) or *The lowest total time first* (the total time of the heats that count; a heat in which a driver set no lap makes the total unknown, so it is the worst; only fair for drivers who drove the same number of laps). Whatever you choose, the other things follow in the order of the standard if the two are still equal. Points or laps always decide before the tie-breaker.
5. **Where you see it:**
   - **Home > Heat plan** says how the result is counted in a last line ("Overall result: the average per heat; the worst heat of every driver is dropped; 1 bonus point for the fastest lap of every heat."). The red warning about unequal numbers of heats now tells you when it is not a problem: counted as an average, or when everybody counts the same number of heats (for example only the best 1, or the worst dropped when drivers race 1 or 2 heats), it says that this is fair. Otherwise it also names the average as a way out.
   - **The race screen**: under *Overall result* the same line, and a **Result** column with the number that counts ("9 avg", "17 (2 of 3 heats)") whenever the counting is the average, the best heats or a dropped heat. *Laps* and *Points* still show everything that was driven. A bonus only (without those) gives the line but no extra column.
   - **Results and Records and the PDF report**: the same Result column and line, kept with the saved race, so an old result is never re-counted in another way; the bonus is named in the heat summary.
6. Try it: make a round robin heat race (points) for 7 drivers on 4 lanes with the plan you had, look at Home (red warning), set *How the heats are added up* to *The average per heat* and see that Home says it is fair; set *Bonus points for the fastest lap of a heat* to 1, tick *Drop the worst heat*, race the heats (the simulation will do) and look at the overall table, the saved result and its PDF.

Good to know:
1. **The Championship Points widget** (in the layouts) still shows the running total of points (with the bonus) plus the points of the current position; it does not know about dropping, the average or the best heats. The overall table, the saved result and the report do.
2. **A tie-breaker never overrules the points or laps**, only the ties.
3. **Dropping the worst heat and the best heats** are most fair when everybody races the same number of heats: use the plan *Every driver races the same number of heats* (0.93.0) or *Same number of heats for everyone* in a round robin.
4. **The phone page** (the live page for the phones on your network) still shows the numbers it showed before.
5. Not yet: finals (an A and a B final from the heat results), a break timer between heats, and editing the plan on Home. Those are the next step.
6. The tests (`tests/scoring.test.js`, new, 54 checks; new checks in `tests/heats.test.js` (68), `tests/live.test.js`, `tests/screens.test.js`, `tests/report.test.js` and `tests/help.test.js`) cover the same order as before for the standard (300 random results, by laps and by points), the average, the best heats, dropping, the bonus (ties, no laps, results by laps), every tie-breaker, the column and the lines on Home, the race screen, Results and Records and the report, and the setup form. A deliberate-breakage run (52 changes on purpose) was killed by the tests every time, after 11 places that the first run showed were not yet covered got tests. **Not tried in a real race on the hardware yet.**

## What to try (0.95.0): Heats, part 4: a break between heats, and changing the plan by hand
The fourth step for heat races (the finals come after this one). Two things: a break timer, and changing the plan on the Home tab yourself.
1. **A break between heats.** Race Setup > a *Heat-based race* > *Length and result* has two new settings:
   - **Break between heats (seconds)**: 0 (the standard) is no break timer, the race waits for Start as before. With a number, the race counts down after every heat (not after the last one). You see it in the line under the race ("Heat 1 finished. Heat 2 starts when you press Space in 1:23 or after the break."), in the **Race Info** widget ("Heat 2 of 3 · next heat in 1:23") and on the **Live Race** page next to the title ("Heat finished · next heat in 1:23").
   - **When the break is over**: *Wait: I press Start for the next heat* (the standard) or *The start lights begin by themselves*. The first changes the line to "The break is over. Press Space for heat 2." and waits. The second does exactly what pressing Start does (the pre-race call if the race has an audio set, then the lights with their random wait).
   - **Start (or Space) always starts the next heat at once**, also during the break. **Stop** ends the race and saves the heats so far, and nothing starts by itself after it.
2. **Change the plan by hand.** Home > *Heat plan*: every place in the table of heats is now a button. Click a place, then click another place: the two swap (the selected place has a coloured edge; click it again to let go). A place with a dash is empty, so a driver can move to it: to another lane in the same heat, or to a free place in another heat. A swap that would put a driver in the same heat twice, or leave a heat empty, is refused with a sentence in red. Everything on the page follows the changed plan at once (the lines, the red warnings, the table of how often every driver races in which lane), and **Start race** races the changed plan.
   - The page says "You changed this plan by hand" and offers **Reset my changes** (the plan that was made comes back). **Shuffle again** also drops your changes.
   - Your changes are saved with the plan they were made for and shown again later. They stay when you only change the length of a heat, the points, the way of counting or the break. They go away (the plan is made again) when the number of participants or the lanes change, when the heat settings of the plan change (the plan, how many heats, seeding...), when you shuffle, or when the qualifying that the plan was seeded by changes. Choosing another driver for a participant keeps them: the plan is about places.
3. Try it: put 6 drivers on a 4-lane track on Home with 3 heats, click a place and another one and see the table, the lines and the numbers change; press Reset my changes. Then set a break of 20 seconds with *The start lights begin by themselves* and race the heats (the simulation will do): after every heat you see the countdown and the next heat starts by itself. Press Space during a break to see it start at once.

Good to know:
1. **Swapping keeps the number of heats and every driver's number of heats the same**, so you cannot add or remove a heat or give a driver an extra heat yet. Moving a driver into a free place changes how many cars the heats have, not how many heats a driver races.
2. **A changed plan can break the equal lanes** (the lane evenness of 0.93.0 is for plans that were made, not for plans you change): Home then says "The lanes are not shared evenly".
3. **The break counts real time.** The Race Director page on the phone starts the next heat as before (it ends the break). The phone page itself (the page for phones on your network) does not show the countdown yet; the Live Race page in the program does.
4. Not yet: the finals (an A and a B final from the heat results). I have some questions about those before I build them.
5. The tests (`tests/heats.test.js`; new checks in `tests/live.test.js`, `tests/screens.test.js` and `tests/help.test.js`) cover the break (setting and its defaults, the countdown in the line, the widget and the Live Race page, Space during the break, a break that is over, automatic start, Stop during the break with automatic start, no break after the last heat, and a whole race of three heats starting by itself), the swapping (every kind of swap, every refusal, the plan not changed in place, every possible swap in a lane rotation of 9 drivers keeping the plan valid), the key of a plan (what changes it and what does not) and the Home tab (the buttons, selecting, letting go, the swap saved and shown, the numbers following it, Start race racing it, the refusal message, Reset, Shuffle, the changes kept or dropped as above). A deliberate-breakage run (54 changes on purpose) was killed by the tests every time except four safety checks that are covered twice over (a check that a plan that is swapped still fits, and three places where the break is also stopped in another way). That run found a real mistake in my own markup too (an invalid `aria-pressed` on the places), which is fixed. **Not tried in a real race on the hardware yet.**

## What to try (0.96.0): Heats, part 5: finals
The last step for heat races: after the heats, a final A, or a final B and a final A. You asked for: a setting for no final / A / A and B, the best-placed driver chooses a lane first, both ways of counting (the finals decide the places, or the final is added to the heat result) as a setting, and a length of its own for a final.
1. **The settings.** Race Setup > a *Heat-based race* > *Length and result* has four new settings:
   - **Finals after the heats**: *No finals* (the standard, as before), *A final* or *A final and a B final*.
   - **What the finals decide** (only with finals): *The finals decide the final places* (the standard) or *The result of the final is added to the heat result*.
   - **Laps in a final** (a race by laps) or **Duration of a final in minutes** (a race by time): 0 is the same length as a heat (the standard).
2. **Who races in the finals.** After the last heat, the heat result (counted the way you set it) decides. The **final A** has as many drivers as the track has lanes (or all drivers, if there are fewer): the best of the heat result. The **final B** is the next group, as many as the track has lanes, and only when at least two drivers are left over (one driver left over has nobody to race against, so there is no final B). There is never a final C. The final B races first, then the final A. With one lane there are no finals.
3. **Choosing lanes.** After the heats (and after the final B) the race screen shows a panel *Final A: choose the lanes*: the best-placed driver of the heat result chooses first (a button for every free lane), then the next one, and so on. The driver who is last gets the last free lane without choosing (when only one lane is free). **Pick the rest at random** gives the drivers who did not choose yet the free lanes by lot, **Clear choices** starts again. The grid on the timing page, the widgets and the other screens follow every choice. **The final does not start before every lane is chosen**: Space says "Choose the lanes for Final A first, then press Space.", the Start widget is off, and a break with *The start lights begin by themselves* waits for the lanes too. If the break ran out while the drivers were still choosing, the final does not start by itself afterwards either: you press Start.
4. **How the finals count.**
   - *The finals decide the final places*: the drivers of the final A are places 1 and up in the order of that final, then the drivers of the final B in the order of theirs, then everybody else in the order of the heat result. The heat result only decided who raced in which final.
   - *The result is added to the heat result*: what a driver scores in the final (laps, or points from the same list as a heat, with the fastest lap bonus if you set one) is added to the result of the heats. It is added after the average, the best heats and the dropped heat, so it is never averaged, dropped or left out. The final B scores like the final A. In both ways **the drivers of the final A stay above the drivers of the final B**, and these above everybody else; inside a final the order is the order of the final (first way) or of the sum (second way).
   - The columns *Laps* and *Points* count everything that was driven, finals included. The table gets a **Final** column ("Final A: 1st", "Final B: 2nd"), and with the final added the **Result** column shows "18 + 10 final = 28".
5. **Names.** A final is called "Final A" / "Final B" everywhere: the Race Info widget ("Final A · 3 laps left", "next final A in 1:23"), the Start widget ("Start final A"), the *Heat* text variable, the Live Race page, the saved results and the PDF report ("Heats and finals", with the laps of a final under their own heading). The title shared with other screens says "3 heats, each 10 laps, then finals B and A of 12 laps".
6. **Sound.** Two new calls in the audio sets, in the folder *Race progress*: *The next final is ready* ("Next up: final A") and *A final is finished*. All calls can use a new word, **{final}** (the letter; empty when it is not a final). In a final {heat} and {heats} are empty. The calls for a heat are said as before.
7. **Home tab.** The *Heat plan* lines tell about the finals ("Then a final A with the best 4 drivers of the heat result, after a final B with the next 2 drivers. In a final the best-placed driver chooses a lane first." and how they count). It cannot name the drivers: that is only known after the heats.
8. Try it: make a heat race for 6 drivers on a 4-lane track with *A final and a B final*, *Laps in a final* 3, and tick *Simulated cars*. Race the heats, and then watch the panel: choose a lane for the best driver, press **Pick the rest at random**, start the final B, then the final A, and look at the table, the saved result and the PDF. Do it again with *The result of the final is added to the heat result*.

Good to know:
1. **Stopping a final** saves what was raced, as for a heat: the final counts as raced with the laps so far. Stopping between the heats and the finals saves the heats, and the table shows which final each driver was in ("Final A" without a place).
2. **The lanes are chosen on the race screen.** The Race Director page on the phone can start the final, but it is refused until the lanes are chosen, and it cannot choose lanes yet.
3. **The Championship Points widget** counts the points of the finals that are finished, like those of a heat.
4. **A driver in the final B** can score more than the last driver of the final A when the finals are added, but never ranks above that driver: the groups keep their order. If you would rather have everybody ranked together after adding the finals, tell me.
5. **Not yet:** a final C, and a different number of drivers per final than the number of lanes.
6. The tests (`tests/finals.test.js`, new, 66 checks; new checks in `tests/live.test.js`, `tests/screens.test.js`, `tests/heats.test.js`, `tests/timing.test.js`, `tests/report.test.js`, `tests/audio.test.js` and `tests/help.test.js`) cover the sizes of the finals (lanes, drivers left over, one lane), the groups, the choosing (order, a taken lane, the last driver, random, clear), both ways of counting (also with the average, a dropped heat, the best heats, by laps and by points), a whole race with a final B and a final A (the choosing panel, no start before the lanes are chosen, the length of a final, what is saved), a break with automatic start that waits for the lanes, the words in the widgets, the announcer, the Results tab, the report and the Help.

## What to try (0.97.0): the new icon, a PDF button that stands out, a quick builder, and folders in General and Import and Export
This is the first part of your list of eleven. It has points 1, 7, 8 and 9. Point 6 (GitHub) could not be done yet, see the end. The rest follows in the next versions: the fullscreen widget view (11), the delta timers (5), the yellow flag target lap time (10), and last the extra columns, the PDF choices and the View settings of the Database (2 and 3).
1. **The new icon.** The dark car on the light grey circle with the red lanes is now the icon of the app (`build/icon.png` and `build/icon.ico`). I did what I did last time:
   - Your picture is 4167 x 4075 pixels, so about 2% wider than tall, and the edge of its round shape was not a perfect circle. I cut a square out of the middle, and a perfect circle out of that with a smooth edge. What went is a thin strip along the edge (1.4% of the picture): the light grey background and a sliver of the road at the lower left and right edge. The car is untouched. The circle touches the four sides, and the four corners are see-through.
   - `icon.png` is 512 x 512 pixels. `icon.ico` (the Windows icon) holds 16, 24, 32, 48, 64, 128 and 256 pixels, each made from the same picture.
   - To see it: run `build-windows.bat` (or `build-linux.sh`, `build-mac.command`): the installer, the portable program, the shortcuts and the title bar use it. If Windows still shows the old icon after installing, that is the icon memory of Windows (see 0.77.0).
2. **Export to PDF stands out.** The button is filled with the accent colour of your theme, has a small page picture in front of the words, a soft ring around it and is a bit larger than the other buttons. It is on every session and stint in Results and Records, and on the Racing Rules page (I gave that one the same look, so the two are the same). Next to it, *Delete this session* keeps its quiet look so the two cannot be mixed up.
3. **A quick builder.** `build-windows.bat` took a long time because it runs the check of the app (all the tests, about four minutes) every time, and downloads the building blocks again. There is now a quick way that skips both when they are not needed:
   - **Windows:** double-click **`build-windows-quick.bat`** instead of `build-windows.bat`.
   - **Linux:** `./build-linux-quick.sh`, or `./build-linux.sh --quick`. **Mac:** double-click `build-mac-quick.command`, or run `./build-mac.command --quick`. The other options (`--install`, `--no-install`, `--uninstall`, `--no-pause`) work with it.
   - What it skips: the check of the app (step 2), always, and getting the building blocks (step 1: Electron, the builder and the flag icons) when all three are already in the `node_modules` folder. If one is missing, it gets them once. It says on the screen what it skipped.
   - It is not possible to skip everything: the first time, the building blocks have to be downloaded (internet needed), because without them nothing can be built. After that, a quick build needs no internet at all.
   - The check exists to catch a broken app before it is built. The zips I send you have been checked here, so the quick build is safe for them. If you change something in the files yourself, use the normal builder.
4. **General and Import and Export look like Results and Records.** Both pages are now made of folders with a coloured title bar, a note beside the title and an arrow, with **Open all** and **Close all** above them. A folder you close stays closed while the app runs.
   - **General:** *Name and welcome*, *Header picture*, *Club logo* and *Database file*. Everything in them works as before.
   - **Import and Export:** *Complete backup*, *Export* and *Import*. The groups in the Export folder (Database, Look and sound, History) are now boxes of their own. The note of the Export folder shows how many items are ticked.
   - Network, Timing Hardware and App Theme are unchanged. If you like the look, I can do the same for Network.
5. **GitHub: not yet.** I tried to connect to https://github.com/theDutchmanJames/SlotForgeTiming in your name, and this session is not linked to a GitHub account, so I cannot see or change the repository. What is needed from you: in claude.ai, open Settings > Connectors, connect GitHub and allow it to use the repository SlotForgeTiming. Then tell me, and I will upload the app, and keep it up to date with a description of every version.

Good to know:
1. **The icon is the 512 pixel one.** For a Mac, 1024 would be sharper on a Retina screen. Tell me if you want the larger one.
2. **The quick builder does not check the app, and does not check that the building blocks are the right version.** If a build fails strangely after you updated the files, run the normal builder once.
3. The tests: `tests/package.test.js` (the colours of the icon, the quick Windows files, and the order of the steps in `build-windows.bat`, followed the way the command prompt does, for a normal and a quick build with and without the building blocks), `tests/linux.test.js` and `tests/mac.test.js` (the scripts are run with stand-ins for npm: which commands run in a normal and a quick build, with all three, one or none of the building blocks, a failing check and a failing build, the quick files, and the other options with them), `tests/icons.test.js` (the new picture of the button) and `tests/screens.test.js` (the button on every session, stint and Racing Rules; the folders of General and Import and Export, Open all and Close all). I looked at the pages in a real browser in a dark and a light theme. I have not built the installer here (that needs your computer).

## What to try (0.98.0): the Timing page without race controls, and a fullscreen widget view for the race screen
This is point 11 of your list. The next versions follow with the delta timers (5), the yellow flag target lap time (10), and the extra Results and Records data with the PDF dialog and the View settings (2 and 3). GitHub (6): see the end.
1. **The Timing page of the Live Race tab shows only the widgets.** Open the Live Race tab and the *Race timing* tile (or press Start Race and look at it on a second screen, a TV or a phone).
   - No race buttons: Start, Pause, Stop, Yellow flag and Red flag are left out, as before. What is new: the top bar ("‹ Live Race", the title and the *Open on a second screen* or *Full screen* button) is gone too, and so is the empty strip that the buttons used to leave. The page is the widget layout and nothing else.
   - **The bar comes back when you need it.** Move the mouse or touch the screen: the bar slides in from the top, and it goes away again after about two and a half seconds. With the keyboard, Tab also brings it back. While it is hidden, the mouse pointer is hidden in the full screen view too.
   - The empty strip is only cut off when the buttons were at the bottom of your layout (where the Start and flag buttons normally are). If you put them in the middle or at the top, the space stays as you designed it. Nothing else of the layout is moved or resized.
   - The other Live Race pages (Leaderboard, Driver stats, Database, Racing rules, Race Director, Tokens) keep their bar, and the Race Director still has its buttons.
2. **A Full screen widgets view on the race screen** (the page that opens with *Start Race* or *Open the session*).
   - There is a new button **Full screen widgets** in the bar under the page. The same view opens with the **F** key.
   - It shows only the widgets of the layout of the race screen, as large as the window allows, without any button. The window itself goes full screen too. When you close the view, the window goes back to what it was (if it was full screen before, it stays so).
   - **Esc**, **F** (again) or the small **Exit full screen** button close it. The button is hidden until you move the mouse or touch the screen (then it shows for about two and a half seconds).
   - **The race keeps running underneath, and you run it with the keys as before:** Space starts, pauses and resumes, Y, R and S for the flags and stop, 1 to 8 count a lap without hardware. Hardware laps (the Trackmate) just come in. The F key does nothing while you type in a field.
   - It also works after the race is over, for the end of a race on a big screen. Leaving the race screen closes the view and puts the window back.
3. **Help.** The help (the *Race screen* and *Live Race* folders) tells about both.

Good to know:
1. **No buttons in the fullscreen view.** That is what you asked for. If you want to run the race with the mouse, close the view (Esc) first, or use the keys. A race with only a second screen can still be run from the Race Director page on the phone.
2. **The view uses the layout of the race screen**, not the layout you chose for the second screen in the race setup. The Live Race page (and so the second screen window, the TV and the phone) shows that second layout when you chose one, and the layout of the race screen when you did not.
3. **In the second screen window** the *Full screen* button (in the bar) and Esc work as before, and the bar comes back when you move the mouse. On a phone or tablet, touching the screen brings the bar back.
4. **GitHub (point 6):** the first commit and the tag v0.97.0 are made on my side, but uploading to https://github.com/theDutchmanJames/SlotForgeTiming was refused: the Claude GitHub App has to be installed for your account and that repository (https://github.com/apps/claude/installations/select_target, choose *Only select repositories* and pick SlotForgeTiming). Enabling the connection was the first step; the app installation is the second.
5. The tests: `tests/widgets.test.js` (the layout without the buttons: trimmed at the bottom only when they were there), `tests/live.test.js` (the clean Live Race page, the bar on pointer move and touch, the fullscreen view: open and close with the button, F, Esc and the Exit button, the window going full screen and back, painting, the key listeners that are left, and leaving the race screen) and `tests/help.test.js`.

## What to try (0.99.0): Delta Timers that show another lane's value, and a yellow flag target lap time
This is points 5 and 10 of your list. What is left: the extra Results and Records data with the PDF dialog and the View settings (2 and 3), and GitHub (6, see the end).
1. **Delta Timers: another lane's value on the left (point 5).** Before, the left side always showed the lane's own value, and the badge told how far that lane was from something else. Now you can choose.
   - There is a new setting **Left value shows** in the Layout Editor, in the six Delta Timers that compare times (Laptime, Average Lap, Median Lap, Best Lap, Personal Best and Pitstop Time Delta), right after *Which lane*. **This lane's own value** is the standard, so every widget you have already looks as before. **The value it is compared with** puts the other value on the left.
   - **The badge says the same in both cases, as you answered: how far this lane is from it** (the lane of the widget against the value on the left), with the same signs and colours (green: this lane is faster).
   - What is on the left follows *Compare with*: a chosen lane (or the next lane) shows that lane's value, made by the same widget (a Best Lap Delta shows their best lap, a Pitstop Time Delta their pit stop); the leader or the fastest shows that car; the track record or session record shows that record (without the name); and for "its last lap against its own best lap" it shows that best lap.
   - Hold the mouse over the left value and it says whose it is ("Shows lane 2 (Sam)"). Only the value comes over, not the colours: when lane 2 sets a record, the widget of lane 1 does not flash for it.
   - Nothing to show yet (the other lane has no time) is a dash. The leader compared with the leader keeps its own value on the left, with a dash in the badge.
   - The two record Delta Timers (Session Record and Track Record) do not have the setting: they already show the record on the left.
   - **Try it:** Layout Editor, add a *Best Lap Delta* for lane 1, set *Which lane* to Lane 2 and *Left value shows* to *The value it is compared with*. The widget of lane 1 now shows lane 2's best lap, and the badge says how far lane 1 is from it. The picture in the editor shows another lane's sample time when you choose that.
2. **The yellow flag target lap time (point 10).** Set a target in the race setup, and a lap that is too fast while the yellow flag is up is called out, marked and penalised.
   - **In the race setup there is a new group, Yellow flag** (after Penalties, fuel and pits) with two settings: **target lap time** in seconds (0 is none, the standard) and **penalty points for a lap that is too fast** (1 is the standard). Your example: a normal lap is 7.500, you set 15.000.
   - **Which laps are judged:** a full lap under yellow, that is a lap that began after the yellow flag went up and ended with it still up. A lap that is faster than the target is too fast; exactly the target is fine. A lap that began before the yellow flag is never judged, because it was partly green. When the yellow flag goes off, laps are free again; a second yellow flag is a new period. A red flag takes the yellow flag away. A pause with the yellow flag up does not count in the lap. The flag can come from the Y key, the Race Director page, the Trackcall button or a call from a lane: it all counts the same.
   - **What a too fast lap does:** it gets **the points you set** from the penalty system (so the time penalty and the disqualify limit work as for any penalty point), it is **called out**, and it is **marked in the lap review** (while the race runs and in the review after it: "faster than the yellow flag target"). Without a penalty system in the race setup no point can be given, but the call and the mark stay. With 0 points it is only called out and marked.
   - **Audio:** two new calls in the folder *Flags*, on in a new audio set: **The yellow flag target lap time**, said right after the yellow flag call ("Target lap time is 15 seconds", or "Yellow flags, target lap time is 15 seconds": one of the two sentences is picked at random), and **A driver is faster than the yellow flag target** ("Alex, too fast under yellow"). When a point is given the ordinary *Penalty points given* call follows. There is a new word, **{target}**, spoken as "15 seconds" or "7.5 seconds". An audio set from before has these calls too, with the ready-made sentences, but only a race with a target ever says them.
   - You wanted "Yellow flags, target lap time is X": to hear only that, delete the first sentence of the target call and switch off the plain *Yellow flag* call (the one that says "Yellow flag, take care").
   - **For the screen:** a custom text widget (race) can show the target with the new variable **{yellowtarget}** (for example "Yellow: {yellowtarget}"). It is empty when the race has no target.
   - **Try it:** make a race setup with *Yellow flag: target lap time* 15 and a penalty system, tick *Simulated cars* on the Home tab, start the race, press **Y**, and listen. Then press **1** twice a second or so: that lap is much faster than 15 seconds, so it is called out and costs a point.

Good to know:
1. **The target is only set in the race setup**, as you chose, so it cannot be changed during the race. If you would like a field next to the Yellow button as well, tell me.
2. **The marks are not saved with the results**, only the penalty points are. And taking a lap out in the lap review does not give the point back: use *Clear points* in the review after the race, or the −1 button of the driver on the Race Director page while it runs.
3. **One call per lap:** a car that stays too fast gets a call and a point for every lap, until the yellow flag goes off. If that is too much for your club, set the penalty points to 0 and use the call only.
4. **Delta Timers:** the left side of the laptime one is the clock of the lane, as for the ordinary widget, so with the other lane on the left it counts that lane's running lap.
5. **GitHub (point 6):** version 0.98.0 and 0.99.0 are committed and tagged on my side, but the upload to the SlotForgeTiming repository is still refused until the Claude GitHub App is installed on that repository: https://github.com/apps/claude/installations/select_target, then *Only select repositories* and SlotForgeTiming.
6. The tests: `tests/delta.test.js` (the left side: every kind of reference, no colours taken over, the tooltip, the editor setting and the sample), `tests/engine.test.js` (the judging: full laps only, the exact target, red flag, pause, calls from a lane, points and disqualifying, lap numbers after a lap is removed, a new stint), `tests/audio.test.js` (the two calls, {target}, the order of the calls, old sets), `tests/screens.test.js` (the new group in the setup form), `tests/timing.test.js` ({yellowtarget}), `tests/live.test.js` (a race screen with a target) and `tests/help.test.js`.

## What to try (1.0.0): more figures in Results and Records, a PDF dialog, and View settings
This is points 2 and 3 of your list. With this, every point of the list is done except the GitHub tags (6, see the end).
1. **More figures in Results and Records (point 2).** The tables now show what the widgets show.
   - **Sessions** (and stints in Token Records) get: **Average lap**, **Median lap**, **Consistency** (how much the lap times vary: ± seconds, the lower the steadier), **Average speed**, **Average scale speed**, **Distance**, **Pit stops**, **Pit time** and **Penalty points**. They follow the widgets: the Average Lap, Median Lap, Slotcar Speed, Pitstop Time and Penalty Points ones.
   - **Track records and personal bests** get: **Average speed** and **Average scale speed** of that lap, the **Session** it was set in, the **Lane** and the **Lap number**.
   - **How the figures are counted** (also said under every table): the lap figures use the *valid* laps only. A lap that is invalid, too slow, late (Time Tokens) or that **includes a pit stop** is left out, otherwise one long pit lap would spoil the average and the consistency. The **distance** is what the car drove, so a pit lap does count there. **Speeds** come from the length of the lane the car drove in (a Lane length modifier or measured lane lengths are used); the **scale speed** is that speed at full size, with the scale of the car or else of the track (as the Slotcar Speed widget does).
   - **Shown to start:** Average lap, Consistency, Average speed, Pit stops, Pit time and Penalty points (besides the old columns). **Off to start** (turn them on in View settings): Median lap, Average scale speed and Distance, and in the records the scale speed, lane and lap number.
   - **A column with nothing to show is left out of that table**: no pit stops saved, no penalty system, no track length for the speed. An old session still shows what can be worked out from its laps (average, median, consistency, and the speeds when the track has a length).
2. **View settings on Results and Records (point 2).** A new button **View settings**, right after *Open all* and *Close all*, opens a small bar. It has a group for the **track records and personal bests** and one for the **sessions** (in Token Records: the **stints**), with a check box for every column. Turn a column off and it leaves the tables at once; the choice is kept. **Back to the standard view** puts everything back. The last column of a table cannot be turned off.
3. **The Export to PDF dialog (point 2).** The button now asks first what to include: **Results table**, **Heats and finals** (heat races), **Every lap time (page 2 onwards)**, and the **columns** of the results table (with *All columns* and *No columns*). The columns start as your View settings have them; the pages start as you left them last time. The PDF holds only what you picked. With all columns on, the table still fits on an A4 page (the print is a bit smaller when there are more than eight columns). A lap with a pit stop is in italics on the lap page.
4. **View settings on Tracks, Drivers and Slotcars (point 3).** The same button, after *Extra fields…* and before the List / Grid choice. In the **List** view it turns **columns** on and off (every field of the form and every extra field; the list starts with all of them, as before). In the **Grid** view it turns the **rows of the cards** on and off (the card starts with what it always had: for a track the lanes, scale and surface; you can add track length, notes and so on). List and Grid remember their own choices, and so does each page.
5. **What is saved now** (so the new figures exist for the races you run from today): every lap row knows its **lane**, the lap with a pit stop is marked, and the standings have the **pit stops and the time in the pits** (when the race had fuel or a pit stop) and the **penalty points** (also in a heat race, added up over the heats). Races from earlier versions have none of these, so they show a dash or leave the column out.
6. **Try it:** run a race setup with a fuel setup and a penalty system with *Simulated cars* on, let it finish, and open **Database > Results and Records**. Open the session: the pit stops, pit time and penalty points are there. Open **View settings** and turn on *Median lap* and *Distance*. Then press **Export to PDF**, untick *Every lap time* and one column, and look at the PDF. Then open **Tracks**, press **View settings**, switch to **Grid** and turn the track length on.

Good to know:
1. **Nothing is turned on for the old sessions.** Pit stops, pit time and penalty points were not saved before, and a lap without a lane is measured on the track length (so the speed of an old lap in an inner lane is a little low). That is the reason they show a dash or no column.
2. **The pit lap is left out of the lap figures, so the average lap here can differ a little from the Average Lap widget during a race with pit stops** (the widget counts every valid lap). I chose the cleaner figure for the results; tell me if you want them the same.
3. **Speeds are in km/h.** The Slotcar Speed widget can show mph; the tables cannot yet. Tell me if you need that.
4. **Only Tracks, Drivers and Slotcars have View settings** (and Results and Records), as asked. The lists of race setups, fuel setups and penalty systems are unchanged. It is a small step to add them.
5. **GitHub (point 6):** version 1.0.0 is committed on my side and pushed to the main branch; the **tags** (v0.97.0 to v1.0.0) are still refused from here. The bundle `SlotForgeTiming-1.0.0.bundle` has them; push them with `git push origin --tags` from a clone, or make the releases on GitHub.
6. The tests: `tests/stats.test.js` (every figure, the lanes, the scales, the columns of a session), `tests/viewset.test.js` (what is shown, the last column, the saved choice), `tests/report.test.js` (the columns and pages of the PDF), `tests/engine.test.js` (the lap with a pit stop), `tests/live.test.js` (what a finished race saves, also for heat races), `tests/screens.test.js` (the bars, the PDF dialog, Tracks, Drivers and Slotcars). A screen test that stops early now counts as a failure.
7. Files: `renderer/stats.js` (the figures and the columns), `renderer/viewset.js` (View settings), `renderer/report.js` (the PDF), `renderer/database.js` (the pages), `renderer/race.js` (what a race saves).


## What to try (1.1.0): mirrored flag pictures, a bigger Delta badge, aligned text, Avatars, a race that keeps running, sharper pictures and bigger sound files
This is the seven points of your list of Thursday 15 October, in the same order.
1. **Mirror the pictures of the Standard Race Flags (point 1).** The *Race Flag* widget could already mirror its standard flag (the pole on the other side). In the layout editor, select a *Race Flag* widget and set *Show the race state as* to **Image set**: there is a new check box, **Mirror the pictures (flip them left to right)**. It works on the race screen, in the editor and in the Live Race window. It does not change the picture set itself, so two flag widgets can use the same set, one mirrored and one not.
2. **The badge of the Delta Timer (point 2).** Select a Delta Timer widget. The badge now has four settings:
   - **Badge size**, in percent of the whole badge (30 to 200, standard 100). It scales the text, the arrow and the shape together and keeps the badge centred in the widget.
   - **Outline thickness** (0 to 40, hundredths of the text size). The *outlined* look starts at 14, the *filled* look at 0 (no line). Choose a thickness and the *filled* look gets a line in the colour of its text. 0 on the outlined look means no line at all.
   - **Bold** (on, as it was) and **Italic** (off).
   - A Delta Timer you made before looks exactly the same until you change one of these.
3. **Align titles and text (point 3).** Every widget with a title has **Title alignment** (left, centre, right) in its *Title* group, and every widget with a value has **Text alignment** in its *Text* group. The **Leaderboard** only has the title alignment, as you suggested, because its layout comes from the leaderboard setup you make yourself. The standard stays as it was: the title on the left and the text in the centre, so nothing moves in your layouts until you choose.
4. **Avatars (point 4).**
   - **A new kind of picture set: Avatars.** In *Customization > Image Settings* make a **New picture set** and choose the kind **Avatars (a picture per lane)**. It has **8 slots**, one per lane (the maximum). A slot you leave empty shows the standard avatar of that lane, dimmed, so you see what a driver gets.
   - **Which picture is shown.** The *Avatar* widget shows the **picture of the driver** if there is one. If not, it shows the **avatar of the lane**, from the picture set you choose in the widget (or the **standard avatars**, which are built in), so there is never an empty circle. A widget can also be set to **No avatars (the first letter of the name)**.
   - **Mirror** the avatars: a new check box in the Avatar widget.
   - **Transparency now stays.** PNG pictures (and other pictures that are not a JPEG) are saved as a PNG, with their transparent parts. Only a JPEG is saved with a white background, because a JPEG cannot be transparent. This also fixes start lights and flags with transparent parts.
   - **The standard avatars are placeholders** (a head and shoulders on a colour per lane, with the lane number). When you send me your 8 avatars as PNG files I will build them in as the standard set; this is one small file (`renderer/avatars.js`).
5. **Look at other tabs while the race runs (point 5).** A race is no longer stopped when you leave the race screen.
   - **A green *Race* tab** appears, before *Live Race*, as long as a race is open. Click it to go back to the same race (nothing is built again). Hover over it to see what the race does ("running", "paused"...).
   - **The race goes on** behind the other tabs: the clock, the Trackmate, the Race Director buttons in the Live Race window and the sharing with the Live Race pages all keep working.
   - **The keys (Space, 1 to 8, S, F...) only work on the Race tab**, otherwise typing in another tab would pause your race.
   - **Home** says *A race is running* with a button **Go to the race**, and *Start* is off, because there is **one race at a time**.
   - A race that has **not started yet**, or one that is **over**, is not kept: when you leave the tab it is closed, as before.
6. **Sharper pictures (point 6).** A new setting in *App Settings > General > Pictures* (a new folder), **Picture quality**:
   - **Original (as uploaded)** is the standard now. A picture is kept exactly as it is; only a picture of more than 4000 pixels on a side, or a file of more than 12 MB, is made smaller.
   - **High** keeps up to 2000 pixels. **Standard** is the small size the older versions used.
   - It works for everything you upload: slotcars, drivers, tracks, the home picture, logos, backgrounds and the picture sets. A picture you uploaded before 1.1.0 stays as it is; upload it again to get the sharp one (and its transparency).
7. **Sound files up to 10 MB (point 7).** The limit was 1.5 MB. It is **10 MB** now (roughly ten minutes of MP3). The reason for a limit at all: the sound files are saved inside the database, which is rewritten at every change, so a very big file would make every save slow.

Try it: make an Avatars set in *Customization > Image Settings*, upload a PNG with transparent parts in lane 1, put an *Avatar* widget on a timing screen, and look at lane 1 (your picture) and lane 2 (the standard avatar). Start a race with *Simulated cars* on, click **Home** while it runs, then **Go to the race**. Set the Delta Timer badge to 150% with a thick outline and italic.

Good to know:
1. **Original pictures make the database bigger.** Pictures and sounds are saved inside the database file, and it is written in one go at every change. A few dozen photos from a phone is fine on a PC. On a **Raspberry Pi** I would use *High* or *Standard*. If it ever feels slow, the setting is the first thing to look at. (Keeping the pictures as separate files is the real fix; it is a bigger change, tell me if you want it.)
2. **Old pictures keep their white background.** They were flattened when they were uploaded; the original is gone. Upload them again.
3. **Keys only on the Race tab.** The Trackmate and the Race Director do not need it.
4. **One race at a time.** The next race can be started when the one that runs is over and you left it.
5. **The standard avatars are placeholders** until I have your pictures.
6. **GitHub tags** (v0.97.0 to v1.1.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch. We said we would look at it later.
7. The tests: `tests/picture.test.js` (the plan of a picture and the reading of it), `tests/avatars.test.js` (the avatar of a lane), `tests/delta.test.js` (the badge), `tests/widgets.test.js` (the alignment), `tests/timing.test.js` (avatars and mirror), `tests/screens.test.js` (the editor, the picture sets, the picture quality, the audio limit) and `tests/live.test.js` (the race that keeps running: tab, keys, Trackmate, Race Director, Home, stopping).
8. Files: `renderer/picture.js` and `renderer/avatars.js` are new; `renderer/race.js`, `renderer/app.js` and `renderer/landing.js` hold the race that keeps running; `renderer/index.html` has a second place for the race page.

## What to try (1.2.0): the thanks under the Racing Rules, a bigger interface, Race Laps, Adjust in the review, cards to look at, and a trophy
This is the nine points of your list of Thursday 15 October, in the same order, and the extra point.
1. **The thanks under the Racing Rules (point 1).** The message is now your new text, with the names of everyone you want to thank. It is in the **Racing Rules tab, under the rules, on the screen only**. It is **not on the printed page** when you print the Racing Rules: that page is your club's own.
2. **A bigger interface (point 2).** It was an easy job: the whole window is zoomed, like the zoom of a browser, so text, buttons and check boxes all grow together.
   - Go to *App Settings > General*, the new first folder **Display**, and choose **Interface size**: 100% (standard), 110%, 125%, 150%, 175% or 200%. It is remembered.
   - It is for the **main window** only. The widgets of your layouts keep the size you give them in the Layout Editor (the race screens are fitted to the window anyway), and the **second-screen Live Race window** stays at 100%.
3. **Race Laps (point 3).** A new widget in the *Race* group: **Race Laps**. It shows the lap the **leader** is on, for the whole race and not for one driver.
   - **Count: Up** shows `7/20` (the lap the leader is on, out of the laps of the race; untick *Show the number of laps of the race* to show only `7`). **Down** shows the laps left, `13`, and `–` when the race has no lap limit (a timed race).
   - When the leader has finished, it stays on the last lap instead of counting one lap too far.
4. **New names for the pictures (point 4).** In the Start Lights picture set the rows are now **Lights off**, **Countdown** and **Pre-Race**. The flag image set also says **Pre-Race** instead of Ready. What is in your sets stays: only the names changed. (The Text style of the race flag widget still says *Ready*; it is a word on the screen, not a picture name. Tell me if you want that one changed too.)
5. **Adjust the result in the review (point 5).** After a race (or a heat) the review has an **Adjust** button for every driver in a race by laps, a timed race and a heat race.
   - A panel opens with **Race time** (seconds), **Laps** and, in a heat race decided on points, **Championship points**. Type an amount and press **Add** or **Deduct**. You can do it more than once; the amounts add up. **Reset adjustments** takes them all away.
   - The race time cannot go below zero and the laps cannot go below none. The laps you add are only a **count**: no lap time is made up. The laps driven are shown under it.
   - The order of the result follows: laps first, then time (in a race by laps, laps you added or took off count before who finished first). Practice and qualifying have no Adjust: they are about the best lap.
   - **Championship points** go on top of the points of the place in that heat, so they are in the overall result too. In a race that is not a heat race there are no championship points.
   - It shows as **adjusted: −1 lap, +5 s, +3 pts** next to the name, in the review, in Results and Records (also per heat) and in the PDF. The total time in the results includes the time you added. The Race Director page has the same Adjust panel.
6. **A card to look at (point 6).** Click a **row** (list) or a **card** (grid) of **Slotcars, Tracks or Drivers**, and a window opens with all there is, like a baseball card.
   - The **main picture** is on top, then every field that has a value (also your extra fields; empty ones are left out), and for a **slotcar** the other pictures as small ones at the bottom. Click a picture, also the main one, to see it **large**; click it or press Esc to close it.
   - You cannot change anything in it. **Close** and **Edit** are at the bottom; Edit opens the form. The Edit and Delete buttons of a row or card work as before.
   - Only slotcars have a gallery, so Tracks and Drivers have the picture they have. (I took your *only for slotcars* as the gallery; the card itself is on all three. Tell me if you meant something else.)
7. **The same lap time in qualifying (point 7).** Before, the order of the list decided. Now the driver who **set that time first** is ranked higher (then the lane order, if two set it at the same moment). The same holds for the practice order.
8. **Your avatars (point 8).** The eight avatars from your folder are built in, untouched, as the standard avatars of the lanes. The placeholders are gone.
9. **A trophy (point 9).** A small gold **trophy** marks the winner of a race, a timed race or a heat race in Results and Records (the table, the line with the winner and every heat), in the PDF and in the review. As we said, **no trophy** in practice, qualifying and Time Token Sessions, and **not on the live leaderboard**. A driver who was disqualified or is out gets none.
10. **The extra point: View settings on Results and Records.** That was a real bug, thank you for finding it. Going to Drivers (or Slotcars, Tracks) and back to Results and Records left the buttons of the Drivers page on the page, so *View settings* opened the Drivers page. Fixed: each page starts clean.

Try it: in *App Settings > General > Display* choose 150%. Put a *Race Laps* widget on a timing screen (set to Down for one and Up for another) and start a race with *Simulated cars* on. When it is over, press **Adjust** on a driver, add 5 seconds, take a lap off, press Finalize and open the session in Results and Records: you see the trophy and the *adjusted* note. Click a slotcar with extra pictures in the Database, and click one of its pictures.

Good to know:
1. **Adding laps does not add lap times.** The lap times in the database are the ones that were driven; the adjustment is kept next to the result.
2. **Adjusting a heat is done in the review of that heat.** Once you pressed Finalize for the heat, it is in the results of the heat race.
3. **The old flag text.** The Text style of the flag widget says *Ready* before the start; the picture sets say *Pre-Race*.
4. **GitHub tags** (v0.97.0 to v1.2.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: `tests/uiscale.test.js` (the sizes), `tests/adjust.test.js` (adding and deducting time, laps and points, the heat result, the review panel), `tests/engine.test.js` (the same best lap), `tests/stats.test.js` and `tests/report.test.js` (the trophy and the *adjusted* text), `tests/avatars.test.js` (your files), `tests/widgets.test.js` and `tests/timing.test.js` (Race Laps), `tests/screens.test.js` and `tests/live.test.js` (the Display folder, the cards, the review, the heat race).
6. Files: `renderer/uiscale.js` is new; `renderer/avatars/Lane1.png` to `Lane8.png` are your pictures; `preload.js` has the zoom; `renderer/review.js` and `renderer/engine.js` have the adjustments; `renderer/database.js` has the card.

## What to try (1.3.0): Balance of Power, to even out fast and slow cars
This is your idea from Thursday 15 October, built the way we agreed: its own page under *Race Setup*, every car graded **or** only the fastest and slowest, the smaller tank as a choice, and the Race Director in charge when he wants to be.
1. **The page (Race Setup > Balance of Power).** It sits between *Penalty Systems* and *Time Tokens*, like the Time Tokens page: the settings are for every race setup that has Balance of Power on, and *Back to the standard settings* puts them all back.
   - **Mode.** *Manual*: the Race Director presses Hinder or Help for a lane. *Suggest*: the app watches the lap times and proposes, he presses **Accept**. *Automatic*: the app applies and removes it by itself (he can still overrule a lane).
   - **Who gets it.** Hinder the fastest and help the slowest, only hinder, or only help.
   - **How many cars.** *Only the fastest and the slowest car* gets the whole percentage. *Every car, by how far it is from the middle of the field*: the fastest car gets the whole percentage as a hindrance, a car in the middle gets nothing, the slowest car gets it as help, and the cars in between get a part of it.
   - **The percentage** is a slider from 1 to 90%. *Strength* can be fixed (always that percentage) or **scaled**: it grows with the difference between the cars, and is the full percentage at the number of seconds you set.
   - **What changes on the car.** Three switches: the **fuel a lap uses**, the **refuelling speed** in the pits, and the **size of the tank** (off to start with; the smaller tank is yours). Hindered by 20%: 20% more fuel a lap, a 20% slower refuel and, with the tank on, a 20% smaller tank. Helped is the opposite. The page shows in words what the percentage does with the switches you chose.
2. **Automatic and Suggest.**
   - The **pace** of a car is the **median** of its last laps (one slow lap hardly counts) or the average, as you choose. It is the last **5** laps that count and a car needs **3** before it takes part. A lap with a pit stop, an invalid lap or a lap taken out does not count.
   - **Apply at** (0.3 seconds a lap to start with, decimals allowed): when the fastest and slowest car are at least this far apart, it comes on. Your example: with 5 seconds, a difference of 4.5 seconds does nothing and 5 does. **Remove below** (half of that to start with) is where it goes off again, a little lower, so it does not flicker on and off.
   - **Correct for the length of the lanes** (on): the pace is divided by how long the lane is (from *Database > Tracks*, when every lane has a length), so a car is not held back for being on the short lane.
   - It looks after every lap, not under a yellow or red flag (a lap under yellow says nothing about the pace). A car that has finished or is out takes no part. A new strength counts **from the next lap and the next pit stop**; a pit stop that has started is not changed.
3. **In the race setup.** A new field **Balance of Power** (Off / On) in the *Rules* group, after the Fuel setup. It is for a race, a timed race and a heat race, and **needs a Fuel setup**: without one it does nothing (there is no fuel to change). Practice and qualifying do not have it.
4. **The Race Director's buttons.** On the race screen (a card under the buttons) and on the **Race Director page** (phone and tablet too) every lane has **Hinder 20%**, **Help 20%**, **Off**, and, depending on the mode, **Auto** (back to automatic) or **Accept** (take over the proposal). The state of the lane and the proposal are in the same row.
   - A lane you press stays as you set it until you press **Auto**: the automatic system does not undo your decision.
   - You can set it before the start. A car that has it before the start begins with a full tank of its own size.
5. **The widget.** *Balance of Power* in the *Timing* group, per lane, like an on/off button: **BoP ▼ −20%** in orange (hindered), **BoP ▲ +10%** in green (helped), **BoP off** when it is not applied. The percentage, the colours and the *BoP off* text are options. In a text widget `{bop}` is the percentage. The Fuel widgets and `{fuelpct}` use the tank of the car.
6. **The audio calls.** A new folder *Balance of Power* with **Balance of Power for {driver}** and **Balance of Power for {driver} removed!** (each call has a second sentence too, and you can change all of them as you like). They are on in a new audio set, and only a race that has Balance of Power ever says them. Going from hindered to helped says the first one again. New variables: `{bop}` (the number) and `{effect}` (hindered or helped).
7. **What is saved.** The race log has every change (who, when, how much, by whom: the Race Director, Accept or the automatic system). The review, **Results and Records** (also per heat) and the **PDF** say what it did next to the name, for example **Balance of Power: hindered 20% (from the start to lap 12), helped 10% (from lap 14)**.

Try it: make a Fuel Setup (tank 100, 2 litres a lap), a race setup of 30 laps with that fuel setup and **Balance of Power: On**, and on the Balance of Power page choose *Automatic*, 20%, apply at 0.3 seconds. Start a race with *Simulated cars* on: after three laps the fastest car shows **BoP ▼ −20%** and the slowest **BoP ▲ +20%** in the *Balance of Power* widget (add it to a layout first) and, with an audio set chosen in the race setup, the voice says it. Press **Off** for a lane on the race screen and it stays off; press **Auto** and the system decides again. Then try *Suggest* and press **Accept**.

Good to know:
1. **It fine-tunes; it does not level a big gap.** Balance of Power only changes the fuel use, the refuelling and (if on) the tank. A car hindered by 20% on a 100 litre tank that uses 2 litres a lap runs 41 laps on a tank instead of 50 and takes 12.5 seconds to fill it instead of 10: that is a longer or earlier pit stop, or a driver who lifts. In a short race that never needs a stop, or with a very big tank, it hardly bites. A car that is 4.5 seconds a lap faster will not be caught by it alone. The harder the fuel rules bite (a smaller tank, more fuel per lap), the more it does.
2. **Pit stops are where it works,** so a race with fuel stops (or drivers who save fuel) gets the most out of it.
3. **My choices where you left it open:** the settings are for the whole app (one page), and each race setup only has an **On/Off** switch. The percentage is a whole number. The automatic system is only looked at after each lap. If you want separate settings per race setup, tell me.
4. **Laps under a yellow flag** are not looked at, but a few slow laps before the flag can still pull an average down; that is why the median is the standard.
5. **GitHub tags** (v0.97.0 to v1.4.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
6. The tests: `tests/bop.test.js` (the numbers, the engine, the Race Director buttons, the audio calls, the other screens), `tests/bopscreen.test.js` (the settings page, the field in the race setup, the race screen, the Race Director page, the saved result), `tests/timing.test.js` and `tests/widgets.test.js` (the widget), `tests/audio.test.js` (the two calls), `tests/web.test.js` (the commands from a phone), `tests/report.test.js` and `tests/screens.test.js` (the note in the PDF and in Results and Records).
7. Files: `renderer/bop.js` (the numbers, new), `renderer/bopui.js` (the page and the lane buttons, new), `renderer/engine.js` (fuel use, refuelling and tank per car, the three modes), `renderer/announcer.js`, `renderer/timing.js`, `renderer/widgets.js`, `renderer/race.js`, `renderer/liveview.js`, `renderer/liveshare.js`, `server.js` and `schema.js`.

## What to try (1.4.0): the Weather System, rain and tyres in the pits
This is your idea from Thursday 15 October, with the changes we agreed: a Cloudy and a Clearing state, Intermediate tyres as a choice for those two, and the hindering stacked on top of Balance of Power. This is **part 1**: the weather itself, the tyres, the penalties, the hindering, the Race Director's buttons and the audio. The three widgets (Tyres, Weather Forecast, Track Conditions) with their picture sets come in **1.5.0**.
1. **The page (Race Setup > Weather Systems).** Weather systems are sets, like Fuel Setups and Penalty Systems: make as many as you like, and choose one in a race setup. A new field **Weather system** (in the *Rules* group, after Balance of Power) is asked for a race, a timed race and a heat race; *No weather* is the standard.
   - **Counted in** laps of the leader or minutes of racing. Everything below is in laps or in minutes, as you choose there.
   - **The rain starts** at a set moment, at a **random** moment between two limits, or **only when the Race Director says so**. "After 8 laps" means once the leading car has completed 8 laps; 0 is rain from the start. In minutes a paused race does not count.
   - **The rain lasts** a set time or a random time between two limits.
   - **Cloudy before the rain** and **Clearing after the rain** have their own lengths (0 = skip it). If the rain starts sooner than the clouds are long, it is cloudy from the start.
   - **In every heat:** the same weather in every heat (fair, the standard) or new random weather in every heat. Only asked when something is random.
2. **The four states.** Dry, Cloudy (the warning), Wet, Clearing (the rain has stopped, the track is drying), then Dry again. One rain per race.
3. **Tyres.** Every slot car has a new field **Tyre choice** (Database > Slotcars): Hard, Medium, Soft, Supersoft, Intermediate or Wet. It is the tyre the car races on when it is dry; a car without a choice has a Medium. In F1 colours: hard white, medium yellow, soft red, supersoft purple, intermediate green, wet blue.
   - **A pit stop changes the tyres when the stop starts** (the sensor blocked for the pit stop time of the race setup, as before). Cloudy and Wet: Wet tyres (in Cloudy you can choose **Intermediate** instead). Clearing and Dry: the car's own tyres back (in Clearing you can choose **Intermediate** instead). Tyres are only changed in a pit stop.
   - **Switching.** When it rains a car on dry tyres has to pit; when it is dry again a car on Wet or Intermediate tyres has to. Cloudy and Clearing ask for nothing (a car on dry tyres in Clearing just drives on). **Laps to change tyres** (2 to start with) is how long a car has: counted from the moment the weather changes, in the car's own laps. A car that comes into the pits on the lap it is due is in time.
4. **Penalty points.** A car that does not change in time gets the points of the penalty system of the race setup: **points for not switching to Wet** and **points for not switching back** (2 each to start with), once or for every lap until it has changed. Without a penalty system the car is only called out (and hindered). The points are in the race log with their reason, and the audio says it with its own call instead of the general penalty call.
5. **Hindering.** The same way Balance of Power does it: a car on the wrong tyres uses more fuel a lap, refuels slower and (if you choose) has a smaller tank. A table of percentages: *weather state* by *kind of tyre* (dry, Intermediate, Wet). Standard: Wet weather: dry tyres 25%, Intermediate 10%, Wet 0%; Cloudy: 0 / 5 / 10%; Clearing: 10 / 0 / 10%; Dry: 0 / 10 / 20%. Fuel use and refuelling are on, the tank is off, each can be changed. It stops when the car has the right tyres. **It needs a Fuel setup** (there is no fuel to change otherwise); the tyres and the penalty points do not.
   - **With Balance of Power** the percentages **add up per effect** (hindered 10% by Balance of Power and 25% by the weather = 35% more fuel), never more than 90%.
6. **The Race Director.** A **Weather** card on the race screen and on the Race Director page (phone and tablet too): the weather now, what comes next ("Next: rain starts in 2 laps"), the four buttons Dry, Cloudy, Wet and Clearing, and a row per lane with its tyre (in colour), what it has to do and how much it is hindered. The buttons can only be pressed when the weather system leaves it to the Race Director; otherwise the forecast decides. He can set any state at any time, also before the start.
7. **Audio.** A new folder **Weather** with 7 calls: the sky clouds over, it starts to rain, the rain has stopped, the track is dry again, a car has new tyres (said right after the pit call), a car did not change in time, and a car gets penalty points for the tyres. New variables: `{tyre}` and `{weather}`. The weather the race starts with is not said. Simulated cars change their tyres too.
8. **What is saved.** The review, **Results and Records** (also per heat) and the **PDF** say what the weather did (**Weather: Cloudy from lap 8, rain from lap 10, clearing from lap 16, dry from lap 18**) and what the tyres did to each car (**Tyres: Wet tyres after lap 9, 2 penalty points for the tyres after lap 11, Soft tyres after lap 18**). In a heat race the weather is said once when it was the same in every heat, otherwise with every heat.

Try it: make a Fuel Setup and a Penalty System, a Weather System with the standard numbers (rain after 8 laps), a race setup of 20 laps that uses all three, and give your slot cars a *Tyre choice*. Start a race with *Simulated cars* on and watch the Weather card: Cloudy, Wet, Clearing, Dry, the cars changing tyres in the pits, the voice calling it. Then try *Only when the Race Director says so* and press the buttons yourself.

Good to know:
1. **Weather and Balance of Power add up; they do not multiply.** I chose this so that two systems can never take more than 90% from a car.
2. **The hindering needs a Fuel setup.** The tyre change and the penalty points work without one.
3. **One spell of rain per race,** and a system counts in laps *or* minutes, not both. "After N laps" is the laps of the leader.
4. **The Race Director's buttons are for the "Race Director decides" systems.** With a forecast the buttons are shown but cannot be pressed, so the forecast and his hand do not fight. If you would like to be able to override a forecast, tell me.
5. **Random weather** is chosen when the race starts and is the same in every heat unless you choose new weather for every heat. The seed is in the race settings that the other screens get, so every screen has the same weather.
6. **A car whose own tyre is Wet or Intermediate** is not asked to change tyres in the dry (it is its own tyre), but the table still hindered it (20% / 10% on a dry track) - give it a Medium, or change the table, if you do not want that.
7. **GitHub tags** (v0.97.0 to v1.4.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
8. The tests: `tests/weather.test.js` (the numbers, the engine, the penalties, the hindering with Balance of Power, the audio calls, the heat result), `tests/weatherscreen.test.js` (the fields, the race window, the Race Director page, simulated cars, heats), `tests/screens.test.js`, `tests/audio.test.js` and `tests/help.test.js` (the new folder, the calls, the fields).
9. Files: `renderer/weather.js` (the numbers, new), `renderer/weatherui.js` (the controls, new), `renderer/engine.js`, `renderer/race.js`, `renderer/liveview.js`, `renderer/liveshare.js`, `renderer/announcer.js`, `renderer/stats.js`, `renderer/database.js`, `renderer/report.js`, `renderer/review.js`, `renderer/editor.js`, `renderer/help.js`, `server.js`, `db.js`, `transfer.js` and `schema.js`.

## What to try (1.5.0): the weather widgets (Tyres, Weather Forecast, Track Conditions)
This is **part 2** of your Weather System idea from Thursday 15 October: the three widgets, their picture sets, the conditions on the track, and what the audio says about them. One thing first: I told you I would show you the design before I built it, and then I built it straight away while you were trying 1.4.0. The design choices are listed under *Good to know*, so you can tell me what you would like different.
1. **Three new widgets** in a new folder **Weather** of the Layout Editor.
   - **Tyres** (one per lane, like the other lane widgets): the tyre of the lane's car. Until the first pit stop in the rain it is the tyre of its Slotcar (the *Tyre choice* of 1.4.0), after the stop it is a Wet (or Intermediate) tyre, and after the rain it is back to the car's own tyre once it has been in the pits again. Without a weather system it simply shows the tyre of the Slotcar. It can show **a picture of the tyre**, **its name** (on the colour of the tyre) or **both**.
   - When the car has to change tyres the widget turns **amber** and says **Change tyres** (you can switch that off with *When the car has to change tyres, say so and turn amber*).
   - **Weather Forecast**: the weather now (a sun for Dry, a cloud for Cloudy, a cloud with rain for Wet, the sun coming out from behind a cloud for Clearing) with the text under it of what comes next and when: **Rain in 3 laps**, **Clearing in 1 minute 30 seconds**. When the Race Director decides the weather there is nothing to forecast, so it only shows the weather now. You can show the picture, the text or both, and switch off the next change.
   - **Track Conditions**: the **track temperature**, the **air temperature**, the **wind speed** and the **wind direction** (SW, or SW 225° if you switch on the degrees) with an icon each. The wind arrow points the way the wind **blows**. You choose which of the four to show and whether they stand in a row, a column or two by two.
2. **Conditions in the Weather System** (Race Setup > Weather Systems > a new folder **Track conditions**, closed to start with). Every weather state (Dry, Cloudy, Wet, Clearing) has its own track temperature, air temperature, wind speed and wind direction (where the wind comes from, in degrees: 0 north, 90 east, 180 south, 270 west). The standard numbers: Dry 30 °C / 24 °C / 10 km/h from the south west; Cloudy 25 / 20 / 16 from 250; Wet 17 / 15 / 22 from the west; Clearing 21 / 17 / 14 from 295. A system has its **Units**: Celsius and km/h, or Fahrenheit and mph. The widget shows the numbers of the weather the race is in right now.
3. **Units and your own numbers** (in the Track Conditions widget). *Units*: as the weather system says (the standard), Celsius and km/h, or Fahrenheit and mph (the numbers are converted). *The values come from*: the weather system of the race, or **My own values**: then there are 16 fields for every state, in the units you chose there. That also works in a race without a weather system.
4. **Picture sets** (Customization > Image Settings, three new kinds): **Tyres** (a picture for each of the six tyres), **Weather** (a picture for each of the four states) and **Track conditions** (an icon for each of the four items: draw the wind direction pointing up, it is turned the way the wind blows). A slot you leave empty keeps the drawn picture, which is shown dimmed in the editor. Choose the set in the widget.
5. **The drawn pictures.** Without a set everything is drawn: the tyres as a black tyre with a ring and a letter in the colour of Formula 1 (Hard white, Medium yellow, Soft red, Supersoft purple, Intermediate green, Wet blue), the weather as a sun and clouds, the conditions as thermometers, the wind and an arrow.
6. **Audio.** A new call **The conditions on the track** in the Weather folder (now 8 calls; on to start with, switch it off in the audio set if you do not want it): *"Track temperature 30 degrees, air temperature 24 degrees, wind 10 kilometres per hour from the south west"*. It is said once at **lights out** and again after **every change of the weather**, with the numbers of the new weather. New variables for every weather call: `{tracktemp}`, `{airtemp}`, `{windspeed}` and `{winddir}`.
7. **Custom text widgets** (Widget Builder) have new variables: `{tyre}` for a lane, and `{weather}`, `{nextweather}`, `{tracktemp}`, `{airtemp}`, `{windspeed}` and `{winddir}` for the race.

Try it: make a Weather System (rain after 8 laps), a race setup that uses it, and in the Layout Editor a layout with the three widgets (the folder **Weather**; give the Tyres widgets lane 1 and 2). Start a race with *Simulated cars* on: the sky goes Cloudy, the Forecast counts down, the conditions change, the Tyres widgets turn amber and the voice says the conditions. Then open Image Settings, make a Tyres set with one picture and choose it in the widget.

Good to know:
1. **The conditions are steps**: every state has its numbers and they jump when the weather changes (a gradual change would be possible, but then there is a time to choose).
2. **Changing the units in a weather system does not convert its numbers**; the widget does convert when it shows the other units.
3. **The numbers do nothing to the race**; they are for show and for the voice. (A cold track could make cars slower, but you did not ask for that, so I did not.)
4. **The audio says the conditions at lights out and after every change.** Together with the weather call that is two sentences in a row; switch the conditions call off in the audio set if that is too much.
5. **The Forecast widget in a race without a weather system shows Dry**, and the Track Conditions widget shows a dash (unless it has values of its own). The Tyres widget works without a weather system.
6. **Only the Tyres widget can sit in a Leaderboard row design** (the other two are not about one lane).
7. **Built before the design check.** The widget names, the folder, the amber warning and the units are my choices; say what you want different.
8. **GitHub tags** (v0.97.0 to v1.5.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
9. The tests: `tests/weatherwidgets.test.js` (new: the pictures, the three widgets, the picture sets, the own values, the units, the variables), `tests/weather.test.js` (the conditions, the units, the forecast text, the audio call), `tests/weatherscreen.test.js` (the widgets on the timing page, also on a screen that follows the race), `tests/screens.test.js` (the Image Settings, the widget options, the new folder of the Weather Systems page), `tests/audio.test.js` and `tests/help.test.js`.
10. Files: `renderer/weatherwidgets.js` (new), `renderer/weather.js`, `renderer/widgets.js`, `renderer/timing.js`, `renderer/editor.js`, `renderer/announcer.js`, `renderer/help.js`, `renderer/styles.css`, `renderer/index.html` and `schema.js`.

## What to try (1.6.0): Rotation Setups (part 1)
This is **part 1** of your Rotation Setups idea from Thursday 15 October, built with the answers you gave: numbers with optional names, a "Not here today" tick, a lane check on Home, and locking of heats. **Part 2 (1.7.0)** is the rest: the result by total race time (with both ways of handling a heat that is not finished), the Heat List overview on the Race tab, and the extras. I will not start it before you have told me what you think of this one.
1. **A new sub-tab, Race Setup > Rotation Setups**, next to Race Setups. It lists your rotation setups (size, and which race setups use them) with **Edit**, **Duplicate** and **Delete**. It is also in Import and Export (the Database group), so you can share a rotation like any other item.
2. **The editor.**
   - At the top: the **name**, the number of **participants** (2 to 64), the number of **lanes** (1 to 8), a note, **Undo** and **Redo** (also Ctrl+Z and Ctrl+Y), **Save** and **Back**. Going to fewer participants or lanes takes places away, so it asks first; Undo brings them back.
   - **Heats** are rows, lanes are columns. To fill a place: click a participant, then a place (the participant who stood there leaves that heat). To swap: click one place, then another. A participant can not race twice in a heat, and the page says so in words. **Empty this place** and **Let go** are in the bar that appears when something is picked.
   - Every heat has a **label** (A, B, Juniors, ...), the buttons Up and Down, **Lock**, **Copy**, **Empty** and **Delete**, and a choice **Put a group here**.
   - **Locked heats** stay where they are when you shuffle or reverse, and their places can not be changed until you unlock them.
   - **Shuffle the heat order**, **Reverse the order**, **Shuffle the lanes** (who races in which heat stays as it is) and **Even out the lanes** (everybody drives in every lane about equally often).
   - **Start from a plan** makes the heats for you, as a start to change by hand: *Shuffled over a number of heats that I choose*, *Everybody races the same number of heats*, *Round robin* or *Lane rotation*. It asks before it replaces heats that are there.
   - **Groups**: tick participants into a group (juniors, pros, ...), then put the group in a heat with the choice in the row of that heat. It takes the lanes in the order of the numbers and refuses a group that is bigger than the number of lanes. A participant can be in more than one group.
   - **Names (optional)**: a participant is "Participant 3" until you give a name. The name only helps you, here and on Home. It does not have to be a driver.
   - Under the grid the page tells you what it sees: who races no heat, empty heats, heats with fewer cars than lanes, a name that is used twice, and how often everybody races. A table shows how often everybody races and in which lane.
3. **In the race setup** (Length and result): a new choice **Rotation setup**, with *None: plan the heats from the settings below* as the first option. With a rotation chosen, the settings that plan the heats (how the heats are planned, the number of heats, who races together) are not asked, because the rotation says it all. How the result is counted, the break and the finals are asked as before. The choice is only there for a heat-based race.
4. **On the Home tab** the participants of the rotation are the rows. The Heat plan shows the heats with their labels, and the same labels are in the heat schedule on the race screen. You still choose a driver and a car for every participant, or press **Pick the drivers by name** (only when the rotation has names): it picks the driver whose name is the name of a participant who has no driver yet, and says which names it could not find.
5. **Not here today**: a tick for every participant. The others do not move up: the places of who is away stay empty and the lanes stay as they are, a heat that nobody is here for is left out, and the page says so. Somebody who is away needs no driver and no car. At least two participants must be here.
6. **The lane check.** A track with fewer lanes than the rotation uses is refused on Home, in words (*The rotation uses lane 4, and this track has 2 lanes (heat 1, 2, 3)*). A track with more lanes is fine, the extra lanes stay unused. Rows are not added or removed by themselves when the number does not match: if you have more rows than the rotation has participants it says so and you remove the rows yourself; if you have fewer, the rows are added.
7. **Changing a plan by hand on Home** still works with a rotation (click a place, then another), and **Reset my changes** brings the rotation back. Your changes are thrown away when somebody is ticked away or back, because that is another plan.
8. A race setup **without** a rotation works exactly as before, and so does one whose rotation has been deleted (the setup plans its heats from its own settings again).

Try it (your example, 20 racers on 4 lanes): Race Setup > Rotation Setups > **New rotation setup**; set 20 participants and 4 lanes; open **Start from a plan**, choose *Everybody races the same number of heats*, 2, and press **Make the heats**: that is 10 heats of 4. Change a few places by hand, lock the first heat, press **Shuffle the heat order**, give two participants a name, and Save. Then make a heat-based race setup, choose the rotation, and go to Home: tick two participants as *Not here today* and look at the plan.

Good to know:
1. **A rotation is made of participant numbers**, not of drivers. The drivers are chosen on Home just before the race, as they always were. That is what makes one rotation usable on any night.
2. **Nobody moves up when somebody is away.** I chose to keep the lanes as they are, so the lane balance you made does not fall apart. If you would rather have the heats filled up from later heats, tell me.
3. **Finals, the break, the tie-break, points and the average per heat** all work as before. The result is still laps or points; the total race time comes in 1.7.0.
4. **Qualifying seeding is not used with a rotation** (the rotation says who races where).
5. **The limits:** 64 participants, 8 lanes, 200 heats, 20 groups.
6. **GitHub tags** (v0.97.0 to v1.6.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
7. The tests: `tests/rotation.test.js` (new: the rotation rules, every change, the groups, locking, the plans, the checks, the names), `tests/rotationscreen.test.js` (new: the tab, the editor, the race setup field and the Home tab), `tests/db.test.js`, `tests/transfer.test.js`, `tests/screens.test.js` and `tests/help.test.js`.
8. Files: `renderer/rotation.js` (new), `renderer/rotationui.js` (new), `renderer/landing.js`, `renderer/editor.js`, `renderer/race.js`, `renderer/heats.js`, `renderer/database.js`, `renderer/transferui.js`, `renderer/help.js`, `renderer/index.html`, `renderer/styles.css`, `db.js`, `transfer.js` and `schema.js`.

## What to try (1.7.0): Rotation Setups (part 2), the Heat List and the result by total race time
This is the rest of your Rotation Setups idea from Thursday 15 October, and all of it also works for heat races that have no rotation. (You said you would look at everything in the morning, so this one was built without waiting for your reaction to 1.6.0. Tell me what to change.)
1. **A new way to count the result: total race time** (Race Setup > Length and result > *Overall result counted by* > **Total race time (heats limited by laps)**). Every heat is a race over a number of laps; the driver with the lowest total of finish times wins. The winner of a heat is the first to finish. *How the heats are added up* (all, the average, only the best heats, drop the worst heat), the finals, and the tie-break all work with times as they do with laps and points. The Result column of the race screen, the saved result, the Results tab and the PDF show the times (*2:05.341 (1 of 2 heats)*, and a final that is added shows *30.000 + 26.000 final = 56.000*).
2. **A heat that is not finished.** A heat can end before every car finished its laps (the race ends when the lead car finishes, you stop it, a car runs out of fuel). You choose what happens, in **A heat that is not finished**:
   - **The driver ranks below the drivers who finished (by laps)**: whoever did not finish every heat that counts is ranked after those who did, by the laps they drove (then by fewer unfinished heats, then by the time they drove).
   - **The finish time is estimated from the average lap of the driver**: the laps that were left are driven at the driver's own average lap, and that time counts like any other. It is marked *(estimated)*. A car without a lap, a car that ran out of fuel and a disqualified car have no estimate and rank below.
3. **Total race time needs heats limited by laps.** With heats limited by time everybody drives the same time, so the laps count and the setup says so.
4. **The Heat List on the Race tab.** The old collapsed *Heat schedule* is now the **Heat list**, open, with a row per heat (and per final): the drivers by lane, the winner, the places with their **points** (or **times**, or **laps**) and, when the result is counted by points or times, a column with the laps. The heat that is racing is marked **Racing now**, the one that waits for Start is **Next**, finished heats are **Done**. A final, whose drivers are not known before the heats are raced, says so, and then lists its drivers best first and with the lanes they chose.
5. **The Heat List widget** (Layout Editor > group *Race*). It shows the same list on the Live Race page, a second screen or a phone: the lanes in front of the names, the winner with a star and his points, laps or time, and the heat that is racing highlighted. You choose in the widget: *Heats shown* (all, from the heat that is racing on, or only the heat that is racing and the two after it), *Result of a finished heat* (the winner, every place, or nothing), *Lane numbers* and *Points, laps or time*. It is not in the standard layout; add it to a layout of your own.
6. **A sheet to print.** **Print the heat list** (on Home, in the Heat plan, and on the Race tab) makes a PDF in landscape A4: a row per heat, a column per lane with the name of the driver, and an empty place to write the winner. From the Race tab, after some heats, the last column holds the results so far.
7. **The announcer reads the line-up.** A new audio call **The line-up of the next heat or final is read** (Race progress folder, with the variables `{lineup}`, `{heat}`, `{heats}` and `{final}`). It is said right after *Next up: heat 2 of 3*: *"Alex in lane 1, Sam in lane 2 and Kim in lane 3"*. The drivers are named as the audio set says (name, nickname or callsign). It is **off** in an audio set: tick it on in the folder. Before a final, when the lanes are not chosen yet, it reads the names without lanes.
8. **The laps per heat** are in the Heat list (a column) and in the PDF report as before.

Try it: make a heat-based race setup with *Overall result counted by: Total race time*, laps 3, 3 heats, and run it with *Simulated cars* on. Look at the Heat list while the heats go by (the highlight moves) and at the Result column afterwards. Then press **Print the heat list** on Home. For the voice: Customization > Audio, tick the line-up call on, and run the heats. For the widget: Layout Editor > Race > Heat List.

Good to know:
1. **The sheet and the widget show names, not nicknames.** (A choice per widget would be easy to add.)
2. **The Heat List is not in the standard layout**, so layouts you already have do not change.
3. **The line-up call is off by default**, because a voice that talks more than before would surprise you.
4. **An estimated time is an estimate**: it is marked everywhere, and a driver without a lap has none.
5. **GitHub tags** (v0.97.0 to v1.7.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
6. The tests: `tests/heattime.test.js` (new: the settings, the race helpers, the rows, the overall result by time, the finals, the wording), `tests/heatlist.test.js` (new: the list, the line-up, the short form, the sheet, the widget and the announcer), `tests/live.test.js` (the Heat List on the race screen, the data for other screens, the widget, the spoken line-up and the result by time), `tests/rotationscreen.test.js` (the print button), `tests/scoring.test.js`, `tests/widgets.test.js`, `tests/audio.test.js`, `tests/screens.test.js` and `tests/help.test.js`.
7. Files: `renderer/engine.js`, `renderer/heats.js`, `renderer/race.js`, `renderer/landing.js`, `renderer/widgets.js`, `renderer/timing.js`, `renderer/announcer.js`, `renderer/report.js`, `renderer/stats.js`, `renderer/database.js`, `renderer/help.js`, `renderer/styles.css` and `schema.js`.

## What to try (1.8.0): Teams
This is the first half of your Endurance Race idea from Thursday 15 October: the **Teams**. They are useful on their own (a team race with heats, a club championship with team names), and the Endurance Race in 1.9.0 builds on them. (You said you would look at everything in the morning, so this one was built without waiting for your reaction to 1.7.0. Tell me what to change.)
1. **Teams in the Database** (Database > **Teams**). A team has a **name**, a **picture** and **drivers**. Drivers are in the order they take their turn (the arrows move a driver up or down), and a driver can be in several teams. A driver that is deleted leaves his teams. Teams are also in the Export and Import (with their drivers) and in the phone Database page.
2. **A Team on Home.** Every row on Home has a **Team** select next to the driver. When you choose a team, the driver of that row is one of the drivers of the team, and the team is shown in the race: the Team column in the standings, the results, the Results tab, the saved races and the PDF. A lap is still driven by a real driver, so the records and personal bests stay with the driver.
3. **Teams as the participants of heats.** In a heat-based race setup choose **The participants of the heats are: Teams**, or choose **Participants are: Teams** in the Rotation editor (the rotation wins when it has one). On Home a row is then a team (with a car), the heats are made and shuffled with teams, and **Pick the teams by name** replaces the driver names. The standings, the Heat List and the totals are per team.
4. **Which driver of the team drives a heat** (Race Setup > Length and result > *Which driver of a team drives a heat*):
   - **In turn**: the order of the team in the database; a team of three drives driver 1, 2, 3, 1, ...
   - **By lot**: the driver who drove the fewest heats goes first, a tie is drawn.
   - **I choose before every heat**: a panel with a select per team before the heat starts, with the driver who is next in turn already filled in. A driver who is in two teams that race in the same heat can drive for one of them only; the panel warns you and the other team gets the next driver.
5. **Two widgets** (Layout Editor > group *Team*): **Team Name** and **Team Picture**. Each shows the team of a lane, or one team that you choose in the widget. They are carried to the Live Race page, a second screen and a phone like every other widget, and only the teams that are used are sent.
6. **`{team}` in texts and audio.** The variable `{team}` (and the team of the lane) works in custom texts and in the audio calls, so a call can say *"{team} is in the lead"*. It is empty for a lane without a team.
7. **The Help** has a new folder, **Teams**.

Try it: Database > Teams, make *Red Bull* with three drivers and *Ferrari* with two (one driver in both). On Home choose a team on two lanes and start a race: the Team Name and Team Picture widgets show them in the Layout Editor preview. Then make a heat-based race setup with *The participants of the heats are: Teams*, 4 heats, *Which driver drives: In turn*, and run it with *Simulated cars* on: in every heat another driver of the team drives, and the result shows *Red Bull (Alex)*. Try *I choose before every heat* once, to see the panel.

Good to know:
1. **Teams that race at the same time with the same driver.** The driver can drive for one team only in a heat; the panel (or the rules in turn and by lot) hands the next driver to the other team. A team with one driver always gets that driver.
2. **The Team widgets are not in the standard layout**, so layouts you already have do not change.
3. **The swap in the pits is not here yet.** In this version a driver changes between heats, not in the middle of a heat. The swap in the middle of a race, the audio calls for it ("Box Box") and the timers are the Endurance Race, 1.9.0.
4. **GitHub tags** (v0.97.0 to v1.8.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: `tests/teams.test.js` (new: the Database entity, the removal, the Export and Import, the driver rules, the rows and results, the statistics, the widgets and the variable), `tests/teamsscreen.test.js` (new: the Teams page, Home, the panel and the race with teams), `tests/rotationscreen.test.js`, `tests/screens.test.js`, `tests/widgets.test.js`, `tests/delta.test.js`, `tests/stats.test.js` and `tests/help.test.js`.
6. Files: `renderer/heats.js`, `renderer/rotation.js`, `renderer/rotationui.js`, `renderer/landing.js`, `renderer/race.js`, `renderer/liveshare.js`, `renderer/widgets.js`, `renderer/timing.js`, `renderer/editor.js`, `renderer/stats.js`, `renderer/report.js`, `renderer/database.js`, `renderer/transferui.js`, `renderer/announcer.js`, `renderer/help.js`, `renderer/styles.css`, `schema.js`, `db.js`, `transfer.js` and `server.js`.

## What to try (1.9.0): the Endurance Race
This is the Endurance Race from your idea of Thursday 15 October, with the answers you gave before you went to sleep: its own session type, all three ways to say when a swap is needed, the swap confirmed by the pit sensor and by a button, all three ways to choose who steps in (in the order of the team, chosen at every swap, or by lot), and a least and a most time at the wheel. It was built without waiting for your reaction to 1.8.0, so please tell me what to change.
1. **A new session type: Endurance Race** (Race Setup > Session type). Choose **The Endurance Race is**: *one long race of a set time*, *one long race of a number of laps*, or *heat-based* (a series of heats, planned by a rotation setup or by the settings, like a heat-based race; each team swaps inside its heats).
2. **A new folder in the race setup: Endurance: driver swaps** (it only shows for an Endurance Race):
   - **The swaps are counted in** minutes or laps (every time below follows it).
   - **A swap is needed**: *every so often* (every 30 minutes, say), *at fixed moments* (a list such as `30, 1:00:00, 2:00:00`), or *free* (the team swaps when it wants, within the shortest and the longest stint).
   - **Shortest and longest time at the wheel** of one stint, and the **least and the most a driver drives in the whole race**. When a driver has driven his most, a swap is due and he is not picked again.
   - **Warn this long before a swap is due** (amber, and the audio call *swap soon*).
   - **The swap is made when**: the car stops on the pit sensor for a number of seconds (like a Stop-and-Go), the **Swap done** button is pressed (Race tab, Race Director page, phone), or either.
   - **The driver who steps in is**: the next one in the order of the team, chosen at every swap (the next one is suggested), or picked by lot. A driver who is at the wheel of another car in the same race is never picked.
   - **Seconds to make the swap**, and then **while a swap is not made** the laps *keep counting* or *stop counting* (they count again once the swap is made), **penalty points** for a swap that is not made (again every so many seconds if you like), penalty points for a swap that is too early, and penalty points for each driver who drove less than the least.
3. **On Home** every lane of an Endurance Race is a **team** (with a car) and the driver who starts; the other drivers of the team come from the order of the team (Database > Teams). A team needs two drivers or more to swap. In a heat-based Endurance Race the participants are teams, like in 1.8.0.
4. **On the Race tab** a **swap panel** shows for every team the driver at the wheel, who is next, how long the stint is, whether a swap is coming (amber) or due (red, with why), and the **Swap done** button. When the next driver is chosen at every swap, the panel has a select. The Race Director page and a phone have the same buttons.
5. **Three new widgets** (Layout Editor > group *Team*): **Current Driver**, **Next Driver** and **Swap Timer** (the time until the swap is due, amber and then red when it is overdue). They show on the Live Race page and on other screens like every widget. Team Name and Team Picture keep showing the team.
6. **Five audio calls** in a new folder **Endurance**: *swap due* (**"{team} needs to swap positions! Box Box!"**), *swap done* (who came in and who took over), *swap late*, *swap penalty*, and *swap soon* (off until you switch it on). The new variables are `{nextdriver}` and `{swapin}`; `{team}` works as before.
7. **The result**: the team is the row, with every driver's laps and **time at the wheel**, the swaps, laps that did not count for a swap that was not made, and who **drove too little**. Under it a part **Driver swaps** lists every stint with the race clock. It is in the Results tab and in the PDF; every lap is still saved for the driver who drove it, so records and personal bests stay with the driver.
8. **A race that survives a crash or a power cut.** While a race in one go is running (or waiting in the review), a snapshot goes to a file next to the database every few seconds. After a crash the Home tab shows **A race was interrupted** with *Resume the race*, *Save what was recorded* and *Delete it*. The race comes back **paused** with its clock where it was; press Space to go on. The laps driven in the meantime are lost (the review can add them), and the lap that was being driven is left out of the records. The result says that the race was carried on.
9. **The Help** has a new folder, **Endurance Race**.

Try it: Database > Teams, make two teams of two drivers. Race Setup > Race Setups: a new setup, *Session type: Endurance Race*, *The Endurance Race is: one long race of a number of laps* (12 laps), *The swaps are counted in: laps*, *A swap is needed: every so often, every 3 laps*, *Warn: 1 lap*, *The swap is made when: the Swap done button*. On Home choose a team and a car on two lanes, tick *Simulated cars*, and start. After three laps a team turns amber, then red ("Box Box"): press **Swap done** and watch Current Driver and the audio change. Leave one swap alone for the grace time and set *penalty points* to see the late call. To try the crash: stop the app in the middle of the race (close the window or end the process), open it again, and use *Resume the race* on Home.

Good to know:
1. **Resume is for a race in one go.** A heat-based Endurance Race (or a heat race) is not carried on after a crash; the finished heats are not kept either. This is the first version of it, so tell me how it feels in a real race. (Since 1.24.0 a heat race is carried on too: see *What to try (1.24.0)*.)
2. **A team with one driver, or a lane without a team, drives like a normal car** in an Endurance Race: no swaps.
3. **Penalties need a penalty system** (Race Setup > Penalty Systems, chosen in the race setup). Without one the team is still called out, but no points are added.
4. **Simulated cars** do not stop on the pit sensor by themselves for a swap, so use the Swap done button when you try it.
5. **A race that is stopped early** has nobody who drove too little.
6. **GitHub tags** (v0.97.0 to v1.9.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
7. The tests: `tests/endurance.test.js` (the rules), `tests/enduranceengine.test.js` (the engine: swaps, penalties, sensor, button, totals), `tests/endurancewidgets.test.js`, `tests/endurancescreen.test.js` (Home, the race, the Race Director, heats, results and the crash), `tests/resume.test.js` (the snapshot and the file), and additions to `tests/audio.test.js`, `tests/help.test.js`, `tests/screens.test.js`, `tests/stats.test.js`, `tests/report.test.js`, `tests/web.test.js`, `tests/live.test.js`, `tests/widgets.test.js` and `tests/delta.test.js`.
8. Files: `renderer/endurance.js` and `renderer/enduranceui.js` (new), `renderer/engine.js`, `renderer/race.js`, `renderer/landing.js`, `renderer/liveshare.js`, `renderer/liveview.js`, `renderer/widgets.js`, `renderer/timing.js`, `renderer/announcer.js`, `renderer/stats.js`, `renderer/report.js`, `renderer/database.js`, `renderer/help.js`, `renderer/index.html`, `renderer/styles.css`, `schema.js`, `server.js`, `db.js`, `main.js`, `preload.js`.

## Fixed in 1.9.1

Starting a race in 1.9.0 could show "This screen could not be opened: An object could not be cloned." The race itself was fine: a function (the random generator used by "a random driver steps in") was part of the settings that go to the Live Race window, and Electron cannot send a function between windows. It is left out now. A snapshot of a race that cannot be kept can no longer stop a race either. If you saw the message, update to 1.9.1 and start the race again; nothing was lost.

## What to try (1.10.0): the Damage System
This is the Damage System from your idea of Friday 16 October, with your answers: damage points that come both from named incidents (buttons) and from automatic deslots (a deslot time on the track), the repair either at the same time as the other work in the pits or after it (a setting), an optional deadline per level, and per level *repair*, *retire* or *disqualify*. The extras I mentioned are in as well: a damage factor for fragile cars, two widgets, audio calls, penalty points for leaving the pits too early, and the damage in the results.
1. **A new sub-tab: Race Setup > Damage Systems** (next to Penalty Systems). A damage system has four folders:
   - **Basics**: the name; **Repair and the other work in the stop** (*at the same time*: the longest job counts, so a repair of 15 seconds with refuelling of 8 seconds is 15 seconds; or *one after the other*: the repair starts when the refuelling and a driver swap by the sensor are done); and the **damage points for a deslot**.
   - **Levels**: as many as you like. Each has a name, the number of damage points it starts at, the **seconds** the car must stand still on the pit sensor, *whenever you can* or *as fast as you can*, an optional **deadline in laps** (within so many laps of reaching the level), and what the stop does: **repair** the car, **retire** it or **disqualify** it. A new damage system starts with your example: 3 = Light damage (10 s), 6 = Medium (15 s), 9 = Heavy (20 s, as fast as you can, within 3 laps), 10 = Critical (retire).
   - **Incidents**: the buttons the Race Director has, such as *Deslot +1*, *Contact +2*, *Hard crash +4*.
   - **Penalty points**: for every lap after the deadline of a level, and for leaving the pits before the repair is done. They need a penalty system in the race setup.
2. **The highest level a car has reached counts.** At that level the car should come into the pits; standing on the sensor for the seconds of the level (after the pit hold time, like every pit stop) repairs it: the damage goes back to 0. A car that leaves before the repair is done keeps its damage. A higher level with a deadline can only make the deadline sooner. A critical level that retires or disqualifies the car does so when the car stands in the pits; its laps keep counting until then, and the result of a retired car is kept.
3. **In the race setup** (Rules folder) choose the **Damage system**. It works in a race, a timed race, heats and an Endurance Race, not in practice or qualifying.
4. **Automatic deslots**: Database > Tracks > **Lap time limits** has a new field, **Deslot time (seconds)**: a lap slower than this counts as a deslot and gives the car the damage points of the damage system. Empty or 0 = none. A pit lap and the first lap after a resume never count.
5. **A damage panel on the Race tab**, and the same on the **Race Director page** and phones: for each lane the points, the level, what it asks (*Pit whenever you can, 10 seconds in the pits, 2 laps left*, *Repairing: stand still for 0:07 more*), the incident buttons and a **-1** to take a point back. Points that are taken back are never changed by the damage factor; a car that damage put out can be brought back by taking its points back.
6. **A damage factor on a slot car** (Database > Slotcars, technical): 1 = as the others, 2 = a fragile car takes double damage, 0 = a car that takes no damage.
7. **Two widgets** (Layout Editor > Timing): **Damage** (the level and the points, amber for a level to pit for whenever you can, red for as fast as you can, a level that ends the car and a car that is late; RETIRED and DQ) and **Repair Timer** (*Pit in 2 laps · 0:15*, *Pit now*, *Pit now, 1 lap late*, and while the car stands on the sensor *Repairing 0:07*). For a custom text there are `{damage}`, `{damagelevel}` and `{repairs}`.
8. **Eight audio calls** in a new folder **Damage**: *damage level* ("{driver}, {level}! Pit {when}"), *damage critical*, *damage late*, *repair early*, *repaired*, *damage out*, *damage disqualified*, and *damage hit* (off until you switch it on). New variables: `{damage}`, `{level}`, `{repair}` and `{when}`. The penalty points of a late or early stop are said by their own call, not a second time as an ordinary penalty.
9. **The result**: the driver's name gets a note, such as *Damage: 18 damage points, 1 repair (0.2 seconds in the pits), late for the pits once, left the pits too early once, retired by damage*, in Results and Records, the PDF and the review after the race. A car that damage put out says *retired, too much damage* (or *disqualified, too much damage*) and not "out of fuel". The result row also has the damage points, repairs and time in the pits.
10. **A pause, a crash and a power cut**: the clock of a repair stops while the race is paused, and a race that is carried on after a crash keeps the damage of its cars. The Race Director page, phones and other windows show the same damage (they work out the levels from the same rules).
11. **The Help** has a new folder, **Damage System**.

Try it: Database > Tracks: fill in *Deslot time* (say 12 seconds) on your track. Race Setup > Damage Systems: add one (it starts with Light, Medium, Heavy and Critical). Race Setup > Race Setups: choose it under *Damage system* (and a penalty system, if you want penalty points). On Home start a race with *Simulated cars*; on the Race tab press *Contact +2* twice on a lane: it turns to Light damage. Press the pit button of that lane, wait 10 seconds, and the damage is gone. Give 10 points and let the car stop in the pits to see it retire.

Good to know:
1. **Changing tyres takes no time** in a stop with a damage system; the repair counts alongside fuel and driver swaps, as you chose in the damage system.
2. **In a heat-based race** the damage works in every heat (the panel, the repairs, the widgets and the calls), but every heat starts without damage. The results list the damage of every heat, and the standings add it up (see 1.23.0).
3. **Penalties need a penalty system** in the race setup (Race Setup > Penalty Systems). Without one, a late or early stop is only called out.
4. **Simulated cars** do not deslot or stop for a repair by themselves; use the buttons and the pit button when you try it.
5. **GitHub tags** (v0.97.0 to v1.10.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
6. The tests: `tests/damage.test.js` (the rules), `tests/damageengine.test.js` (the engine: points, levels, repair, deadline, early, retire, pause, resume), `tests/damagewidgets.test.js`, `tests/damagescreen.test.js` (the panel, the buttons, the Race Director command, the repair, the deslot and the saved result), and additions to `tests/audio.test.js`, `tests/help.test.js`, `tests/screens.test.js`, `tests/db.test.js`, `tests/transfer.test.js`, `tests/stats.test.js`, `tests/web.test.js`, `tests/live.test.js`, `tests/resume.test.js` and `tests/delta.test.js`.
7. Files: `renderer/damage.js` and `renderer/damageui.js` (new), `renderer/engine.js`, `renderer/race.js`, `renderer/liveshare.js`, `renderer/liveview.js`, `renderer/widgets.js`, `renderer/timing.js`, `renderer/announcer.js`, `renderer/stats.js`, `renderer/report.js`, `renderer/review.js`, `renderer/database.js`, `renderer/editor.js`, `renderer/help.js`, `renderer/transferui.js`, `renderer/index.html`, `renderer/styles.css`, `schema.js`, `server.js`, `db.js`, `transfer.js`.


## What to try (1.10.1): Home and the Live Race button
Four changes from your note of Friday 16 October.
1. **The Live Race button has two looks.** With no race running it is switched off: grey letters, a grey light that is out and no red glow. While a race is on (a race screen is open: the Race tab is there) it is lit as before, with the red light. It does the same in both looks: it opens the Live Race on a second screen, so you can still set up the second screen before the race.
2. **Home: everything under Available is gone.** The Drivers, Slot cars, Tracks and Race setups cards (and the *Show all* buttons) are no longer on Home. Home now has *Start a race* and, for a session that has one, the heat plan. The Help no longer mentions them. The drivers and slot cars are chosen in the lanes, as before.
3. **Home: the Team choice only appears when the session has teams.** That is an Endurance Race in one go (every lane is a team), or heats whose participants are teams (in the race setup or the Rotation). A normal race, a timed race, heats with drivers, a Time Token Session and practice have no Team choice any more, even when you have teams in the Database. A team that an earlier session left on a lane is ignored there.
4. **Spacing of the dropdowns.** The three dropdowns (Team, Driver, Slotcar) were in a grid made for two, so the Slotcar was pushed into the narrow last column. A session without teams is back to two dropdowns of the same width. The lanes of an Endurance Race have three equal columns.

Try it: on Home pick a normal race: each lane has a Driver and a Slotcar, side by side, and no Team. Pick an Endurance Race: each lane has Team, Starting driver and Slotcar in three equal columns. Look at the Live Race button on the right of the tabs: grey now. Start a race with *Simulated cars* and the Live Race button lights up red; go back to the Home tab (the race keeps running) and it stays red. Leave the race and it goes grey again.

Good to know:
1. **"A race is running"** means a race screen is open, so the button is already lit while a race waits for its start, and it goes out when you leave the race with the Back button. Tell me if you want it lit only while the clocks run.
2. **A team on a lane of a normal race is no longer possible.** Before 1.10.1 you could give a lane of an ordinary race a team (the drivers of that team were then offered). If you used that, tell me; it can come back as a setting.
3. **The "5 used last" setting** (`recent`) is not saved any more, since nothing shows it. An old settings file that still has it loads as before.
4. **GitHub tags** (v0.97.0 to v1.10.1) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: additions to `tests/screens.test.js` (no Available on Home, both looks of the Live Race button and the stylesheet), `tests/teamsscreen.test.js` (the Team choice only in an Endurance Race and in heats with teams, the three columns, a stale team ignored) and `tests/help.test.js`.
6. Files: `renderer/landing.js`, `renderer/app.js`, `renderer/styles.css`, `renderer/help.js`.

## What to try (1.11.0): a grid of leaderboards, and the Rule sets folder
Two things from your note of Friday 16 October.
1. **The folder "Penalties, fuel and pits" in a race setup is now called "Rule sets".** It holds the Penalty system, Damage system, Fuel setup, Balance of Power, Weather system and the pit hold time, so a short name that covers all of them is better than a list. The grey line under the name lists them. Nothing else changed: the settings are where they were.
2. **The Leaderboard page (Live Race tab > Leaderboard tile) is a grid.** Open **Customize**:
   - **Grid**: little squares, 6 across and 4 down. Click the square at the bottom right of the size you want: 4 across and 1 down is four boards side by side, 2 by 2 is four boards in a square. The size is written next to the squares.
   - **Leaderboard in every cell**: a list per cell with *(empty)*, *Classic table* and every row design you made in Customization > Leaderboard Editor. Choose one and the board is there. Choosing *(empty)* takes the board out again.
   - **Board settings** (press *Board 2 settings* on a cell): **Columns it covers** and **Rows it covers** (a board can be wider or taller, as far as the cells next to it are free: one big board and two small ones), **From place** and **To place** (a board that shows places 1 to 4, another 5 to 8; empty = everybody), and for the classic table its columns.
   - The boards share the row of the grid, so they stay the same height. The text of the classic table gets smaller in a narrow board; row designs scale to the width of their board. On a phone fewer columns read better.
   - What you had before is kept: one board is a grid of 1 by 1, two boards one under the other 1 column by 2 rows, side by side 2 columns by 1 row. Your choices (row design, columns) are in the boards. The grid is saved for the device you set it on (a phone has its own).
3. **The Leaderboard widget has the same two settings** (Layout Editor, the settings of the widget): **From place** and **To place**. So a leaderboard on the timing page can also show only part of the field.

Try it: in Customization > Leaderboard Editor make two small row designs, for example one with the position, name and laps and one with the name and the best lap. Start a race with *Simulated cars*, open Live Race > Leaderboard > Customize, click the fourth square on the first row (4 columns by 1 row) and choose a design for each cell. Press *Board 1 settings* and set *To place* to 4; on the next board set *From place* to 5. In a Race Setup, open the **Rule sets** folder.

Good to know:
1. **The order of a board is always the race order.** A board cannot be sorted by best lap (yet). A "fastest laps" board would need that; tell me if you want it.
2. **An empty cell stays empty**: the other boards do not move into it. Pick a smaller grid if you want no gaps.
3. **A smaller grid drops the boards outside it** and cuts back a board that sticks out; making the grid bigger again does not bring them back.
4. **The Layout Editor** still places leaderboard widgets freely on a timing page; the grid is for the Leaderboard page only.
5. **GitHub tags** (v0.97.0 to v1.11.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
6. The tests: `tests/livegrid.test.js` (new: the rules of the grid, the places, the stylesheet), the Leaderboard page tests in `tests/live.test.js` (the old one-or-two-boards tests are replaced), and additions to `tests/help.test.js` and `tests/screens.test.js`.
7. Files: `renderer/livegrid.js` (new), `renderer/liveview.js`, `renderer/rows.js`, `renderer/timing.js`, `renderer/widgets.js`, `renderer/styles.css`, `renderer/index.html`, `renderer/help.js`, `schema.js`.

## What to try (1.11.1): the Race Director page in folders
From your note of Friday 16 October. The Race Director page (Live Race tab > Race Director, on the main computer, the second screen and the tablets) now looks like the Help.
1. **The buttons and the Calls stay as they were** at the top: Start, Pause, Yellow flag, Red flag, Stop race, then the Calls card. Calls is not a folder.
2. **Under them come folders**, in this order, each with a coloured stripe, a coloured header and an arrow to open and close it, like the folders in the Help:
   - **Penalties** (yellow): the points and the penalties per lane, and the penalty log. A race without a penalty system says so in the folder.
   - **Balance of Power** (white): only when the race has Balance of Power.
   - **Damage** (red): only when the race has a Damage System.
   - **Weather** (blue): only when the race has a Weather system.
   - **Endurance** (the colour of your theme): only in an Endurance Race. You did not name this one, so it is last, in the accent colour. Tell me a colour and a place if you want it elsewhere.
3. **The folders are open when the page opens**, as the page was. A folder you close stays closed while the app is open (and when the page draws again during the race).
4. **White** on a light theme (Light, Ocean) is a grey, because a white stripe would not show on a white page. On a theme you made yourself with a very light panel the white stripe is faint.
5. The name that each panel had inside (for example "Balance of Power" on top of its controls) is left out in the Director page, because the folder has it; the line next to it (the state now) stays. On the Race tab the panels are as they were.

Try it: start a race with *Simulated cars* in a race setup that has a penalty system, Balance of Power, a damage system and a weather system (Race Setup > Rule sets). Open Live Race > Race Director. Close the Damage folder, then watch the race for a while: it stays closed.

Good to know:
1. **The colours are the same in every theme** (white is the exception on the light themes).
2. **The Review laps box and the review after the race** are below the folders and have not changed.
3. **GitHub tags** (v0.97.0 to v1.11.1) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
4. The tests: new ones in `tests/weatherscreen.test.js` (the order, the colours, open and closed, the stylesheet) and `tests/help.test.js`.
5. Files: `renderer/liveview.js`, `renderer/styles.css`, `renderer/help.js`.

## What to try (1.12.0): adjust pads for the Race Director
From your note of Friday 16 October and your answers. The Race Director adds or takes off penalty points, race time, laps and championship points with **pads**: a **+** button, a value and a **−** button.
1. **A new Adjust folder** on the Race Director page (Live Race > Race Director), between the Calls and the Penalties. On the main computer, the second screen and the tablets.
2. **Pick a lane first.** Big lane buttons show the lane and the driver. Nothing is picked when the page opens, so a press never lands on the wrong lane. The line above the pads says *Lane 2 · Sam*.
3. **Then use the pads**, one group each, each in its own colour: **Penalty points** (yellow), **Time** in seconds (orange), **Laps** (violet) and **Championship points** (green). The **−** button is the same colour, darker and less coloured, and the sign is always on the button, so the colour is never the only sign. Every pad has a field for **another amount**.
4. **Horizontal or vertical.** Horizontal: a column for every value, the + buttons on top, the values in the middle, the − buttons below. Vertical: a row for every value, `[+] value [−]`. Choose it on the page itself (the Horizontal and Vertical buttons under the pads) or in App Settings. On a phone or tablet it is kept on that device.
5. **During the race.** Time and laps work while the race runs or is paused (they show in the standings straight away, and the review after the race keeps them). Penalty points work as before. Championship points can be given too; they count at the end of the race. Practice and qualifying have no time, laps or championship points (they are about the best lap), and a Time Token Session has no Adjust folder.
6. **Undo.** Under the pads a line says what you did last (*Last: +10 s to Sam*) and the **Undo** button takes it back, one action at a time. A deduction that stopped at zero is undone by what was really taken.
7. **The values are yours.** App Settings has a new tab, **Race Director** (after App Theme): one list of values for each group (standard: penalty points 1, 2, 5; seconds 5, 10, 30; laps 1, 2; championship points 1, 2, 5), up to six values each, the layout choice and a preview of the four pads. The lists are for the whole app and also reach the pages on phones and tablets.
8. **The review after the race** has the same pads instead of the typed fields: *Adjust* on a driver opens pads for time and laps (and championship points in a heat race decided on points). The **Points column** of the review is green too.
9. **The same look elsewhere on the page:** in the yellow Penalties folder the +1 and the special penalties are yellow and the −1 darker; in the red Damage folder the incidents are red and the −1 darker. Their values stay as they were (the special penalties and the damage incidents have their own lists).

Try it: start a race with *Simulated cars* in a race setup with a penalty system, open Live Race > Race Director, press lane 2 and then +10 on the Time pad. The standings on the Race timing page show the 10 seconds at once. Press Undo. Then open App Settings > Race Director, change the seconds to `2, 4, 8`, choose Vertical and see the pads change on the Race Director page.

Good to know:
1. **Championship points on the Director page** only show in a heat race decided on points; other races hide that pad.
2. **Laps and time cannot go below zero.** A deduction that would do so stops at zero (the line under the pads says what you pressed; Undo gives back what was really taken).
3. **The Race tab of the main window** does not have the pads yet: the Race Director page does (it also opens on the main computer, in the Live Race window). Tell me if you want them on the Race tab too.
4. **GitHub tags** (v0.97.0 to v1.12.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: new `tests/adjustpad.test.js` (lists, colours, markup, clicks, Undo, the style sheet), and new blocks in `tests/live.test.js` (the Adjust folder during a race), `tests/screens.test.js` (the settings page), `tests/adjust.test.js` (the review) and `tests/help.test.js`.
6. Files: `renderer/adjustpad.js` (new), `renderer/padui.js` (new), `renderer/liveview.js`, `renderer/race.js`, `renderer/review.js`, `renderer/app.js`, `renderer/styles.css`, `renderer/help.js`, `renderer/index.html`.

## What to try (1.12.1): Damage points pad, plain Adjust folder, brown Endurance folder
From your notes of Friday 16 October.
1. **Damage points are a pad too.** The Adjust folder on the Race Director page has a red **Damage points** pad, right after the Penalty points. It only shows in a race with a Damage System. Pick a lane, press **+** to give damage points, **−** to take them back, and Undo works for it as for the other pads. It uses the Damage System (levels, repairs, retire or disqualify) like the Damage folder does, and the log says it was a hit of the Race Director. The **+** button is off for a car that damage put out or that has finished, and **−** is off when there is no damage to take back.
2. **App Settings > Race Director** now has a field for the **Damage points** values (standard 1, 2, 4), and its pad in the preview. All five pads are there: penalty points (yellow), damage points (red), time (orange), laps (violet) and championship points (green).
3. **The Adjust folder has the normal colours of the theme** (a grey stripe and the plain panel colour), not the accent colour. It keeps its place between the Calls and the Penalties.
4. **The Endurance folder is brown** (`#a8693a`) in an Endurance Race, still the last folder.

Try it: start a race with *Simulated cars* in a race setup with a damage system. Open Live Race > Race Director, open Adjust, pick lane 2 and press **+** on the red pad. The Damage folder below shows the same points. Then open App Settings > Race Director, change the damage values to `1, 3, 5` and see the pad change.

Good to know:
1. **Damage points** go in whole numbers from 1 to 20 at a time (the same as the Damage folder). A slot car with a damage factor gets more or fewer points than you press, as it does in the Damage folder.
2. **The review after the race** has no damage pad; damage is part of the race, not of the review.
3. **GitHub tags** (v0.97.0 to v1.12.1) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
4. The tests: new blocks in `tests/weatherscreen.test.js` (the damage pad, the plain folder), `tests/endurancescreen.test.js` (the brown folder), `tests/adjustpad.test.js`, `tests/screens.test.js` (the settings page), `tests/web.test.js` (phones) and `tests/help.test.js`.
5. Files: `renderer/adjustpad.js`, `renderer/liveview.js`, `renderer/race.js`, `renderer/styles.css`, `renderer/help.js`, `server.js`.

## What to try (1.13.0): Adjust pads on the Race tab
From your answer of Friday 16 October ("Sounds good, go ahead").
1. **An Adjust button on the Race tab.** While a race is running or paused, the bar under the timing page has an **Adjust** button (next to *Review laps*). It opens an **Adjust** panel with the same lane buttons and pads as the Adjust folder on the Race Director page: pick a lane, then use the coloured pads, `[+] value [−]`, for penalty points (yellow), damage points (red), time (orange), laps (violet) and championship points (green). Press the button again (*Hide adjust*) to close it.
2. **It adjusts the race straight away.** No command goes through the Race Director; the pad changes the race in this window, and the timing page, the standings and the other windows follow. Undo and the line under the pads ("Last: +10 s to Sam") work as on the Race Director page, and the layout buttons (Horizontal or Vertical) change the layout for this device.
3. **Only the pads that apply are there.** Penalty points need a penalty system, damage points need a Damage System, time and laps are for races and timed races, and championship points only show in a heat race that is decided on points. A practice or qualifying without a penalty or damage system has no Adjust button at all. A Time Token Session has no Adjust panel.
4. **The same builder on both pages.** The Adjust folder of the Race Director page and this panel are built by the same code (`renderer/adjustui.js`), so they look and behave the same. The lane you picked and what you did stay when the Race Director page is drawn again.

Try it: start a race with *Simulated cars* and a penalty system. On the Race tab press **Adjust**, pick lane 2, press **+** on the 10 s pad (orange) and watch lane 2's time grow by ten seconds. Press **Undo**: it is back. Then open Live Race > Race Director: the same Adjust folder is there.

Good to know:
1. **Lanes without a car** have no button (a 4-lane track with 2 drivers shows 2 lane buttons).
2. **A new heat** starts again: no lane picked and nothing to undo.
3. **The values** of the pads (and their preview) are still set in App Settings > Race Director.
4. **GitHub tags** (v0.97.0 to v1.13.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: `tests/adjustui.test.js` (the panel on its own), new blocks in `tests/damagescreen.test.js` (the Race tab panel), `tests/tokenrace.test.js` and `tests/help.test.js`; the Race Director tests in `tests/live.test.js` and `tests/weatherscreen.test.js` still pass unchanged.
6. Files: `renderer/adjustui.js` (new), `renderer/liveview.js`, `renderer/race.js`, `renderer/index.html`, `renderer/help.js`.

## What to try (1.14.0): a clearer Rotation Editor
From your note of Friday 16 October ("a bit unclear to me now, so it might be for others as well"). This is step one: how the page is laid out and what it says. Dragging with the mouse comes next, in its own version, if you want it.
1. **A page in order.** Race Setup > Rotation Setups > Edit now reads from top to bottom: the **name** with Undo, Redo, Save and Back; the **Size** (participants, lanes, drivers or teams); **Start from a plan**; the **Participants**; the **Heats** with their tools; the remarks; then the names, the groups and the table. Every part has a short line that says what to click.
2. **Real places.** A place in a heat is a box you can see; an empty one is dashed and says "empty". You still click a participant, then a place, or two places to swap them.
3. **Plans are buttons.** *Shuffled*, *Same number each*, *Round robin* and *Lane rotation* each have a line that says what they make. The number of heats you start from now follows the size (10 drivers on 4 lanes starts at 3 heats, not 2) until you type your own.
4. **Fewer buttons on a heat.** A row has the two arrows, **Lock** and a **⋯** menu with *Copy this heat*, *Empty this heat* and *Delete this heat*. The shuffles and *Even out the lanes* are in a **Tools** menu next to *Add a heat*, each with a line that says what it does. A menu closes when you click somewhere else.
5. **A warning can fix itself.** When some participants race no heat (for example after you add participants), the warning has a button: *Add a heat for them* puts them in a new heat at the end, in lane 1, 2, 3... One Undo takes it back. With more of them than lanes it says "Add a heat for the first 4" and you press it again.
6. **Name a participant where you pick it.** Pick a participant and a Name field appears in the line below the chips. The name shows on the chip, in the grid and in the names list.

Try it: open Race Setup > Rotation Setups > New rotation setup, set Participants to 10, and look at the warning about P9 and P10. Press *Add a heat for them*. Pick P3, type a name, click an empty place. Open the **⋯** of a heat and the **Tools** menu.

Good to know:
1. **Nothing is saved differently.** Rotations you made before open and save as they were; this is only the page. Home and the race use them as before.
2. **Not in this version:** dragging participants and heats with the mouse, a colour per participant, and a new look for the groups (they are still under *Groups* at the bottom). I would like to know how you use groups before I change them.
3. **The table "How often everybody races, and in which lane"** is still folded; the remarks above it already say whether the lanes are shared evenly.
4. **GitHub tags** (v0.97.0 to v1.14.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: new blocks in `tests/rotationscreen.test.js` (the page, the fix button, the names, the menus, the plans) and `tests/rotation.test.js` (`addHeatFor`), and `tests/help.test.js`.
6. Files: `renderer/rotationui.js`, `renderer/rotation.js`, `renderer/styles.css`, `renderer/help.js`.

## What to try (1.15.0): the Race tab in coloured folders, and new track buttons
From your note of Friday 16 October: the options to add time or penalties under the Race tab did not match the coloured folders on the Race Director page, and the buttons for the track actions (calling a car to the pit) could be livelier.
1. **The same folders as the Race Director page.** Under the buttons the Race tab now has coloured folders that open and close: **Track actions** (green), **Adjust**, **Penalties** (yellow), **Balance of Power** (white), **Damage** (red), **Weather** (blue) and **Endurance** (brown), in that order. A Time Token Session has **Track actions** and **Time tokens** (teal). A folder is only there when the race uses it, they are open to begin with, and a folder you close stays closed (also for the next race).
2. **The Adjust button is gone.** The Adjust folder is there while the race waits, runs or is paused; the pads are the same as before.
3. **Penalties in a folder.** The old "Penalty 1", "Penalty 2" buttons in the bar are replaced by the table of the Race Director page: points, time penalty and what is not served yet for every lane, with the buttons **−1**, **Penalty point +1** and the special penalties of the system (Drivethrough, Stop-and-Go), and the penalty log below. It is the same piece of code as on the Race Director page.
4. **Track actions as cards.** Every lane has a card with its number and driver, a large green **Lap** button, an orange **Pit** button and an amber **Call** button, each with a small picture and the key (1, ⇧ 1, Ctrl 1). **Pit** lights up (and says "Leave pit 1") while the car is in the pit; **Call** lights up and pulses while that lane's call waits for the Race Director. A lane without a car has no card.
5. **The Calls strip** (when a lane has called) stays at the top, above the folders.

Try it: start a race with a penalty system, damage and weather, with Simulated cars on. Press Space. Click **Pit 1** (or Shift + 1), then **Call 2**, and look at the cards. Give lane 2 a point in the Penalties folder. Close the Weather folder and start a new race: it stays closed.

Good to know:
1. **The keys are the same:** 1 to 8 for a lap, Shift + number for the pit, Ctrl + number for a call. Nothing else about the race changed.
2. **The Race Director page** looks as before; it now builds its Penalties folder with the same functions as the Race tab.
3. **Not in this version:** dragging in the Rotation Editor, a colour per participant and a groups strip (planned as 1.16.0, when you say go).
4. **GitHub tags** (v0.97.0 to v1.15.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: new `tests/racefolders.test.js` (folders, order, colours, cards, lights, penalties, closed folders, token session) and `tests/penaltyui.test.js` (the penalty panel on its own); updated `tests/damagescreen.test.js`, `tests/tokenrace.test.js`, `tests/live.test.js` and `tests/help.test.js`.
6. Files: `renderer/dirfolder.js` and `renderer/penaltyui.js` (new), `renderer/race.js`, `renderer/liveview.js`, `renderer/styles.css`, `renderer/index.html`, `renderer/help.js`.

## What to try (1.16.0): dragging in the Rotation Editor, and a colour per participant
From your note: "better to have an extra feature than have something missing", and the dragging that was promised in 1.14.0. The click method stays as it is; dragging is on top of it, with the mouse, a finger or a pen.
1. **Drag a participant onto a place.** Take a participant from the row under *Participants* and drop it on a place of a heat. It stands there; whoever stood there leaves that heat (the same as clicking the participant and then the place). A participant who already stands in that heat moves to the new lane.
2. **Drag a place onto another place** and the two swap. Onto an empty place the participant simply moves there. A swap that would put somebody in a heat twice says so and changes nothing.
3. **Drag a place back onto the participants** (the row of chips) to empty it.
4. **Drag a heat by its grip.** The dots in the first column of a heat are a grip: drag it onto another heat and the heat moves there, with its places and its label, the same as the arrows do (one step at a time, not past a locked heat).
5. **You see what happens.** A ghost with the participant follows the pointer; the place under it lights up (a dark outline, or a red dashed one when it cannot be done, for example in a locked heat); the places of the participant you drag are marked while the others fade. **Esc** lets go and nothing changes. Near the top or the bottom of the window the page scrolls on its own, so a heat far away can be reached. A small move (a few pixels) is still a click.
6. **A colour for every participant.** P1 is blue, P2 orange, P3 green, P4 yellow and so on (ten colours; P11 to P20 are lighter versions, P21 to P30 darker). The colour is on the chip, on every place of that participant in the heats, on the name in the list of names and in the table of how often everybody races. It follows the number, so nothing is saved and every rotation you made before has colours at once.
7. **Pick a participant and see where it races.** When a participant (or a filled place) is picked, all places of that participant are marked and the other places fade. Let go and everything is as before.

Try it: Race Setup > Rotation Setups > New rotation setup. Drag P8 onto a place in heat 1. Drag a place onto another place. Drag the dots of heat 2 above heat 1. Lock heat 1 and try to drop something on it. Start a drag and press Esc. Pick P3 by clicking and look at where it races.

Good to know:
1. **Groups are unchanged.** You wanted to keep them, so they are as they were (under *Groups* at the bottom, and the *Put a group here* choice in a heat). No groups strip.
2. **Nothing is saved differently.** Rotations open, save and race as before; the colours are only drawn.
3. **Not in this version:** choosing your own colour for a participant (the colour is by number), and dragging a participant onto the *Groups* box.
4. **GitHub tags** (v0.97.0 to v1.16.0) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
5. The tests: new `tests/rotationdrag.test.js` (what a drop does, what can be picked up and what can be dropped on, the pointer, the ghost, the lights, Esc, scrolling) and new blocks in `tests/rotationscreen.test.js` (the editor with simulated drags, the colours, the marks, locked heats, saving) and `tests/rotation.test.js` (`moveHeatTo`, `colorOf`); `tests/help.test.js` and the screen lists of the other screen tests know the new file.
6. Files: `renderer/rotationdrag.js` (new), `renderer/rotationui.js`, `renderer/rotation.js`, `renderer/styles.css`, `renderer/index.html`, `renderer/help.js`.

## What to try (1.16.1): the Forecast widget, the Lap button and a voice report
From your three notes of Friday 16 October.
1. **Weather Forecast widget in a small widget.** The picture and the text now shrink together until they fit inside the widget, whatever the word (Dry, Cloudy, Clearing, Wet) and the line under it ("Rain in 3 laps"). Nothing is pushed out any more. The Tyres widget does the same (its picture, its name and "Change tyres"). It works on the timing page, the Live Race window and the layout editor. A widget with enough room looks as before. Try it: in the Layout Editor make a Weather Forecast widget small, start a race with a weather system and watch it change from Dry to Cloudy.
2. **The green Lap button.** It counts a lap by hand: it does what the sensor does when a car crosses the line on that lane (keys 1 to 8 do the same). It only works while the race is **running**; before you press Start (or Space), while it is paused, in the countdown and after the finish it is dimmed, which looked like "nothing happens". Now the Track actions folder says why in a line above the cards ("The Lap, Pit and Call buttons work while the race is running. Press Start (or Space) first.", and what is different while paused: Call still works), and the dimmed button says so in its tooltip. While the race runs the line is gone. I tried it in a real browser: two clicks gave two laps.
3. **Voice report (Natural voices).** In Customization > Audio Settings, open an audio set: next to the voice there is a **Voice report** button. It shows what the app is offered by the browser inside it (name, language) and, on Windows, what Windows lists: the **Speech_OneCore** voices, the classic **SAPI 5** voices and the **Windows Runtime** voices. It only reads; nothing is changed and nothing is sent. **Copy the report** and send it to me, and I can see why Andrew HD is missing.

What I found about Natural and Natural HD voices:
- The app speaks with the voices that Windows gives to the browser inside it (Electron). That browser already reads the **Speech_OneCore** list first (and the classic list only when that one cannot be read), so the app does have access to that part of the registry; there is nothing to switch on.
- **Andrew (HD)** is one of the new on-device HD voices that Windows 11 25H2 added for **Narrator and Magnifier**. As far as I can find, Microsoft has not opened the Natural voices of Narrator to other apps. A community project (NaturalVoiceSAPIAdapter) reaches them by a hack and says the newest versions, the HD voices included, no longer work. The Azure HD voices on the Microsoft page you sent (`en-US-Andrew:DragonHDLatestNeural`) are **cloud only** and need an Azure Speech key.
- So I do not promise that Andrew HD can be made to work. The report will tell whether Windows lists it at all.
- If you want these voices anyway, there are two real options: (a) an optional **Azure Speech voice** in the audio set (you bring your own Azure key and region; the speech comes from the cloud; it costs a little per character after a free amount; it needs internet), or (b) the third-party SAPI adapter above for the Narrator and Edge voices that do work. Tell me if you want (a); I did not build it.

Good to know:
1. **Nothing else changed.** The Track actions buttons, the keys and the widgets work as before; a widget that has room is not scaled.
2. **Not in this version:** the Track Conditions widget is not scaled (it wraps by itself); an Azure voice.
3. **GitHub tags** (v0.97.0 to v1.16.1) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
4. The tests: new `tests/voicereport.test.js`; new blocks in `tests/weatherwidgets.test.js` (the fit and where it is called), `tests/racefolders.test.js` (the line and the tooltips), `tests/screens.test.js` (the Voice report button) and `tests/help.test.js`.
5. Files: `voicereport.js` (new), `main.js`, `preload.js`, `renderer/weatherwidgets.js`, `renderer/canvas.js`, `renderer/editor.js`, `renderer/race.js`, `renderer/sound.js`, `renderer/audioedit.js`, `renderer/styles.css`, `renderer/help.js`.

## What to try (1.16.2): the answer to "How do I get more voices?"
From your note: the little ⓘ next to Voice did nothing when you clicked it (the answer was only a tooltip).
1. Open Customization > Audio Settings and an audio set. Click **ⓘ How do I get more voices?** next to Voice: the answer shows under the voice row: "If you want more voices, the safe way is Windows Settings > Time & language > Speech > Manage voices > Add voices. Voices added there should show up in the app after a restart." with the Windows 10 way in brackets. Click it again, or press Enter on it, to hide it.
2. It is a real button now, so the keyboard can reach it, and a screen reader hears whether it is open. The answer stays open while you edit the set, and the tooltip is still there.

Good to know:
1. **Nothing else changed.** Voices work as in 1.16.1; the Voice report button is still there.
2. **GitHub tags** (v0.97.0 to v1.16.2) are still not pushed; they are refused from here. The code itself is pushed to the main branch.
3. The tests: a new block in `tests/screens.test.js` (the button, the answer, it stays open, it hides again).
4. Files: `renderer/audioedit.js`, `renderer/styles.css`.

## What to try (1.17.0): a livelier Home tab
From your note: with the Available cards gone, Home felt empty. It is now a band, the start card and three cards.
1. Open **Home**. At the top is a band with a soft glow in your theme's colour, the date and the track of the selected race setup, and small lights: **Trackmate** (green when it is connected, also when you plug it in while Home is open), **Shared on the network** (green when it runs, red when it was switched on but could not start), the **audio set** of the setup (or "No audio") and how many drivers, slotcars and tracks you have.
2. Under it, **Start a race** has a coloured strip on every lane. If the layout of the race setup gives a lane a colour, that is the colour; otherwise it is one of eight (red, blue, yellow, green, purple, orange, cyan, pink).
3. Under the lanes, **start lights**: one for every lane (or participant), lit in the lane's colour when it has what it needs. The words next to them say "3 of 4 lanes are ready." When every lane is filled in but something else still stops the race (a driver on two lanes), they say "filled in", and the list above the button says what to fix. **Start race** is the bigger button on the right.
4. On the right, three cards, from your saved races (a Time Token Session never counts here):
   - **Record to beat**: the fastest lap on the track of the setup, with the driver, the car, the date and the race. Under it, who on the grid is closest and by how much (or that the record holder is on the grid). A lap that was taken out of the records is not the record.
   - **Last race**: the podium (1 in the middle), what each did (laps, or points in a race on points), the race and the track, and the fastest lap of that race. After a qualifying or a practice it says "Last qualifying" or "Last free practice" with the best laps.
   - **At a glance**: races raced, laps driven, distance (from the length of the lanes) and who won most.
5. Make the window narrow: the cards go under the start card. Try another theme in App Settings: the band, the record time and the podium follow its colour.

Good to know:
1. **No saved race yet**: the right side shows one card that says what will appear.
2. **Fast**: the laps for the cards are fetched once while you stay on Home (changing the race setup does not fetch them again) and again each time you come back to Home.
3. **Not done**: the Sound chip of the mockup became the audio set of the setup, because the app has no general sound switch. Ties in "most wins" go to the one who won last.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/homestats.test.js` (new: the record, last race, podium, totals, chips, lane colours and start lights), a new block in `tests/screens.test.js` (the band, colours, lights, the cards, fetching once, the live Trackmate and network chips), and the Home folder of the help.

## What to try (1.18.0): Delta Timers top and bottom
From your question: could the Delta Timer also be shown vertically, with the time on top and the badge below it, as well as left and right?
1. Open Customization > Layouts, make or open a layout and add a **Delta Timers** widget (for example *Best Lap Delta*). Click it: in its settings there is a new choice, **Value and badge**.
2. **Left and right** is the standard and is exactly as before: the time on the left, the badge on the right, the badge as high as the widget.
3. Choose **Top and bottom**: the time is on top and the coloured badge sits below it, as wide as the widget (green with ▲ for faster, red with ▼ for slower, as always). All eight Delta Timers have it, also the Session Record and Track Record ones.
4. The time and the badge now share the height of the widget, so give it room: drag the widget taller (a box of about twice the old height is a good start) or make the text smaller. The hint under the choice says so.
5. **Size of the badge** works in the new way too: 100% is as wide as the widget, a smaller badge is narrower (and its text smaller), a larger one has bigger text.
6. The Live Race pages and the Race tab draw it the same way. The look (filled or outlined), arrow, decimals and colours all work in both arrangements.

Good to know:
1. The setting that chooses what the first value shows is now called **Left (or top) value shows**, because in the stacked widget that value is on top. Nothing else about it changed.
2. A badge that is made bigger than its widget is wider than the box in the stacked widget, so its text can be cut off: lower the size of the badge or widen the widget.
3. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
4. The tests: new blocks in `tests/delta.test.js` (the choice, the class, the badge size in both arrangements, the live page), `tests/screens.test.js` (the setting in the editor and the canvas) and `tests/help.test.js` (the Delta Timers folder).

## What to try (1.18.1): the badge text always fits
From your note: in the stacked Delta Timer (Top and bottom) the arrow and the difference could stick out of the coloured badge when you made the widget smaller. Now they always stay inside it.
1. Open Customization > Layouts, add a **Best Lap Delta** (or any Delta Timer) and choose **Value and badge: Top and bottom**.
2. Drag a corner of the widget to make it narrower. The arrow and the number get smaller step by step, just enough to stay inside the badge; the time above it keeps its size. Drag it wider again and they grow back to their full size.
3. It also works with a long difference (with 3 decimals a gap of a minute or more reads ▼ +1:02.345), a smaller or larger **Size of the badge**, the outlined look and no arrow.
4. The Race tab and the Live Race pages do the same, also when the window is made smaller. A badge that already fits is not touched, so a widget that looked right before looks exactly the same.

Good to know:
1. The time above (or on the left of) the badge is not changed: if the widget is too small for both, make it taller or use a smaller text size, as the hint under **Value and badge** says. Only the badge text shrinks by itself.
2. This also settles the second point of 1.18.0: a big badge in a narrow stacked widget no longer cuts its text off.
3. Side by side (Left and right) the badge is as wide as its text and as high as the widget, so only a very short widget with big text makes the text shrink there.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: a new block in `tests/delta.test.js` (how much the text shrinks, that it grows back, that a badge that fits is left alone, that it always stops, and that the race page, the editor and the live view call it) and one line in `tests/help.test.js`. I also measured 324 widget sizes in a real browser: before, 108 stacked cases had text outside the badge, after, none.

## What to try (1.19.0): order a leaderboard by any value
From your wish: a board can list its rows by best lap, laps, championship points, penalty points, damage points or any other value we have, so the value you find most important is on top.
1. Open **Live Race > Leaderboard > Customize**, pick a board and look at its new setting **Order by**. It is *Race position* as before: the board follows the race.
2. Choose **Best lap**: the fastest lap is now on top, whoever leads the race. A second setting appears, **Best or worst on top**: *Best first* (the standard) or *Worst first*. Choose **Penalty points** with *Worst first* for a board of who has the most penalty points.
3. The **Leaderboard widget** in the Layout Editor has the same two settings (Layouts > a Leaderboard widget), for the classic table and for your own row designs.
4. The values: race position, best lap, last lap, average lap, median lap, personal best on this track, laps, speed (of the last lap), championship points, penalty points, penalty time, damage points, pit stops, fuel left, lane, driver name (A to Z). The hint under **Order by** says what stands on top for the one you chose.
5. A *fastest laps* board: make a row design with the Best lap in it (Customization > Leaderboard Editor), put it in a cell and choose **Order by: Best lap**. Every board of the grid has its own choice, so one cell can follow the race while the one beside it shows the fastest laps.

Good to know:
1. The **Position** column of an ordered board counts its rows (1, 2, 3...), and the first row gets the leader look (the colour of the race leader in your row design). Other columns keep their own values: the Gap column still shows the gap in the race.
2. A car that has no value yet (no lap, or the race has no such rule: no fuel rule, no damage system, no championship points, no track length for the speed) stays at the bottom, and cars with the same value keep their race order. A disqualified car counts as the worst for penalty points.
3. **From place** and **To place** count in the order of the board: *Best lap* with places 2 to 4 shows the second to the fourth fastest.
4. It works on phones and tablets too (they draw the boards the same way). A board that is set to the race position looks exactly as before.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: the new `tests/boardorder.test.js` (the values, both directions, ties, missing values, names, the list that goes in is not changed), `tests/rows.test.js` (a real race with three cars: every order, in both the classic table and a row design, the Position cell, the leader look, From and To), `tests/live.test.js` (the Customize panel saves it per board) and `tests/screens.test.js` (the two settings in the Layout Editor).

## What to try (1.20.0): Adjust pad values per race setup
From your wish: the values on the Adjust pads can differ per race setup. A sprint race with a small penalty and a long endurance race with a big one no longer share one list.
1. Open **Race Setup > Race Setups**, open a setup and look at the new folder **Adjust pads** (under Yellow flag). It has a field for each pad: *Penalty points*, *Damage points*, *Time* (in seconds), *Laps* and *Championship points*.
2. Type up to six values, separated by commas, for example `1, 3, 10` in the penalty points field and `2.5, 5, 15` in the time field. Save. The list is tidied (smallest first, no doubles); text that is no number is refused with a message.
3. Start a race with that setup. On the **Race tab** (Adjust folder), on the **Race Director page** (also on a phone or tablet) and in the **race review**, those pads now show your values. The other pads, whose field you left empty, keep the values from **App Settings > Race Director**.
4. A setup with all five fields empty works exactly as before.

Good to know:
1. Empty means *use the App Settings values*. If you change the App Settings list later, every setup with an empty field follows it; a setup with its own list keeps it.
2. The layout of the pads (horizontal or vertical) is not part of the setup: it stays a choice of each device.
3. The Damage pad only appears when the race has a damage system, the Championship pad only in a heat race counted in points, the same as before.
4. In a Time Token Session there are no Adjust pads, so the folder is not shown for that kind of session.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/adjustpad.test.js` (the rules: own list or the app-wide one, tidying, the other settings are not changed), `tests/adjustui.test.js` (the panel draws the values of the setup and draws again for the next race), `tests/screens.test.js` (the form: the folder, the tidy-up on save, the refusal), `tests/live.test.js` (a real race: Race tab, Race Director page and review) and `tests/help.test.js`.

## What to try (1.21.0): the app icon at 1024 pixels
From your list: a Mac wants an app icon of 1024 x 1024 pixels, and the icon was 512. I did not just enlarge it (that only makes it blurry): I traced your artwork as a drawing made of lines and shapes and drew it again at 1024.
1. Look at `build/icon.png`: it is 1024 x 1024 pixels, round, with see-through corners, and the same dark car on the light grey circle with the red lanes. Open it next to the old one and zoom in: the edges of the headlights, the bumper and the lanes are sharp now.
2. `build/icon.svg` is the drawing it was made from (it opens in any browser or drawing program). Change it there, save it again as a 1024 x 1024 PNG with a see-through background, and put that PNG in `build/icon.png`.
3. To see it on a Mac: run `build-mac.command`. The app and the .dmg use the new icon, and the Mac makes the sharp Retina version from the 1024 picture. Windows and Linux use the same `icon.png`.

Good to know:
1. The picture is the same: colours, shapes and the round form. The traced version differs from the old one by about one part in two hundred, only along the edges. I added the soft grey glow in the windshield and the thin lines of the grille back as separate shapes, because a trace loses those.
2. `build/icon.ico` (Windows, 16 to 256 pixels) is unchanged; it never needed 1024.
3. The icon is still round. A Mac icon is normally a rounded square with a little space around it (see 0.90.0); if you want a Mac version like that, tell me how much space.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/mac.test.js` (1024 x 1024, see-through background, the drawing `icon.svg` exists and is a real drawing) and `tests/package.test.js` (round, colours, the Windows icon).

## What to try (1.22.0): mph in the tables
From your list: the tables showed speeds in km/h only (the Speed widget in a layout already had a Unit choice). Now the tables have one too.
1. Open **App Settings > General > Display**. Under *Interface size* there is a new choice, **Speed unit in the tables**: *Kilometres per hour (km/h)* (the standard) or *Miles per hour (mph)*. The folder title says which one is on ("speeds in mph").
2. Choose **mph**, then open **Database > Results and Records** (racing records and token records). The *Average speed* and *Average scale speed* columns of the sessions, the stints, the track records and the personal bests are in mph. A lap of 7.1 km/h reads 4.4 mph, and a scale speed of 169 reads 105 mph.
3. Open a session and press **Export to PDF**: the table in the PDF uses the same unit.
4. Choose km/h again and everything is as it was.

Good to know:
1. The choice is kept per computer, like the other settings of App Settings.
2. Only speeds change. Distances (the *Distance* column) stay in metres and kilometres, and lap times are lap times. If you want miles and feet for distances too, tell me.
3. The **Speed widget** in a layout (and the weather widgets) keep their own Unit choice: a race screen can show mph while the tables show km/h, or the other way round.
4. A setting that says something other than mph (a damaged file, say) counts as km/h.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/speed.test.js` and `tests/stats.test.js` (the unit rules, both units, a dash without a speed), `tests/report.test.js` (the PDF in both units), `tests/screens.test.js` (the setting, the sessions, records and stints tables, the PDF call) and `tests/help.test.js`.

## What to try (1.23.0): damage in the results of heat-based races
From your list: in a heat-based race the Damage System already worked in every heat, but the results did not say anything about the damage. Now they do.
1. Choose a race setup that is a **heat-based race** with a **Damage system** (Race Setup > Race Setups, the Rules folder). Start it and give a car some damage with the Damage folder (or the Adjust pads), let it stand still in the pits to repair, and give the same car or the other one more damage, as in a normal race.
2. Finish the heats and open **Database > Results and Records**. Behind the name of every driver in the table there is a muted line such as *(Damage: 15 damage points in 2 heats, 1 repair (10 seconds in the pits), retired by damage in 1 heat)*. It adds up all the heats and the final.
3. Under the table the **Heats** list has the damage of every car in that heat: *Alex (5 laps, Damage: 5 damage points, 1 repair (10 seconds in the pits))*. A car that damage put out of a heat says *retired by damage* (or *disqualified by damage*) there.
4. Press **Export to PDF**: the table and the heats page in the PDF have the same words.

Good to know:
1. Every heat still starts without damage, so the damage of one heat does not carry over to the next. The total only adds up what happened in each heat.
2. A driver without damage has no line at all, and a race without a Damage System has none, so the results look as before.
3. The same words as in a normal race (*damage points*, *repairs*, *in the pits*, *not repaired*, *late for the pits*, *left the pits too early*) are used in the heat lines. The total says how many heats had damage, and in how many the driver was put out.
4. Results that were saved before this version have no damage in their heats (it was not kept). Only races from now on have it.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/damage.test.js` (the total in words), `tests/damageengine.test.js` (the row of a heat and the overall result), `tests/damagescreen.test.js` (a heat race on the race screen, saved), `tests/report.test.js` (the PDF) and `tests/screens.test.js` (the Results table).

## What to try (1.24.0): resume for heat-based races
From your list: a crash or a power cut no longer loses a heat race. The race that is racing, and the heats that are already done, come back.
1. Start a **heat-based race** with three heats (or a heat-based Endurance Race; tick *Simulated cars* if you have no hardware). Let heat 1 finish: the Race tab shows *Done* next to it in the heat list.
2. During heat 2, stop the app the rough way (end the process, or pull the plug of the laptop if you dare). Open the app again.
3. The **Home** tab shows *A race was interrupted* with the name of the race, the track, and where it was, such as *0:42 into heat 2 of 3*. Press **Resume the race**.
4. The Race tab comes back **paused** in heat 2 with the laps it had at the last saving point (a few seconds before the crash). Heat 1 is still in the heat list and in the overall result. Press Space to carry on; heat 3 and the result follow as always.
5. If the race stopped **between two heats** (or between the last heat and a final), it comes back between them: heat 1 done, heat 2 next, *The race was interrupted and is back, between two races.* It does not start by itself, even with a break and an automatic start: press Space when you are ready.
6. **Save what was recorded** ends the race where it was and saves what it has: the finished heats, and the heat that was racing as far as it got (after the review, as before). **Delete it** throws it away.

What comes back, besides the heats and their laps: the lanes of the heat plan, the **lanes the drivers had chosen for a final**, the driver who drives for each **team** in the next heat (and who has driven, so the order or the lot goes on as it would have), the pit stops and penalty points of the finished heats, and the **weather forecast** of the heat that was racing (not a new random one).

Good to know:
1. As with a race in one go, the laps driven after the last saving point are lost (the review can add them), and the lap that was being driven is left out of the records. The result says so (*This race was interrupted and carried on*), as for a race in one go, but only when a heat that was racing came back, not when the race came back between two heats.
2. The file is written about every two seconds while a heat is racing, and at once when a heat is done or a lane for a final is chosen. It is deleted when the result is saved or deleted.
3. Only one interrupted race is kept. Starting a new race replaces an older one at its first saving point (a single race already did).
4. If the race setup was changed so that the heats no longer fit (other drivers or lanes), the race says so and starts as a new race instead of bringing back something that does not fit.
5. Heat races that were interrupted with an older version were not kept, so there is nothing to bring back for those.
6. A **Time Token Session** is still not carried on.
7. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
8. The tests: `tests/heatresume.test.js` (the whole way, on screen: kept while racing, between heats, the Home tab, Resume, Save what was recorded, a final with lanes, teams and the weather), `tests/heats.test.js` (the state of the heats as data, and what does not fit), `tests/resume.test.js` (the file), `tests/endurancescreen.test.js` and `tests/help.test.js`.

## What to try (1.25.0): the cards of Home in a grid
From your list: more cards on Home, in a grid you set up yourself, like the Leaderboard page. The Home you know is where you start: nothing changes until you open Customize.
1. Open the **Home** tab and press **Customize** (top right, in the band). A panel opens with the little squares of the Leaderboard page. Press the square for 4 columns by 2 rows: the grid changes at once, and the cards that no longer fit are gone.
2. Under **Card in every cell** each empty cell has a list. Pick **Recent races** for one, **Personal Bests for Drivers on the Grid** for another. The settings of the card you picked show under the map (*Card 3 settings*): the columns and rows it covers, and the options of the card (how many races, which tracks, the period, which pages for Shortcuts).
3. The cards: **Record to beat**, **Last race** and **At a glance** (as before), and the new ones: **Recent races** (click a race: it opens in Results and Records, with its card open), **Fastest laps this week** (the best lap of every driver since Monday), **Records on all tracks**, **Top drivers** (wins as bars), **Personal bests of the drivers on the grid** (a dot in the colour of the lane), **Rules of this race** and **Shortcuts** (one button for each page you tick).
4. **Start a race** is in the grid too. Give it more room (*Columns it covers*, *Rows it covers*), or make it narrower: its lanes stack when it gets narrow. It is always on Home: it has no list, so it cannot be taken away.
5. To take a card away, choose *(empty)* in its cell. A card can be on Home once. **Back to the usual Home** puts the Home of before back.
6. With no race saved yet the cards that need races have nothing to show: the first of them says what will show up, the others stay empty. **Rules of this race** and **Shortcuts** do not need races.

Good to know:
1. **Rules of this race** has this name so that it is not mixed up with the **Racing Rules** tab (the club rules you write yourself). It shows the length, the penalty, damage, fuel and weather systems and Balance of Power of the race setup that is picked on Home.
2. **Fastest laps this week** starts the week on Monday at midnight. Times of different tracks cannot be compared, so *All tracks* gives a list for every track (the number of laps is per track); the standard is the track of the race setup.
3. **Top drivers** counts wins of races (not qualifying or practice), this year or all time; a team that raced as a team counts under its team name. A Time Token Session is never counted anywhere on Home.
4. The grid is saved for this computer (the setting `homeGrid`), like the grid of the Leaderboard page. A damaged saved grid is mended when Home is drawn: unknown cards are dropped, and Start a race comes back if it is missing.
5. In a window narrower than 960 pixels every card gets a line of its own, wherever it sits in the grid.
6. Cards cannot be dragged: you choose them in the list of a cell, as on the Leaderboard page.
7. **Time Token Sessions** are still not carried on after a crash, and **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
8. The tests: `tests/homegrid.test.js` (the rules of the grid), `tests/homecards.test.js` (the markup of the cards), `tests/homestats.test.js` (the figures), `tests/screens.test.js` (Customize, the cards, a race that opens in Results, the shortcuts) and `tests/help.test.js`.

## What to try (1.26.0): the Weather card and the Tyres Available card
From your list: two more cards for Home, both for show. Nothing on them is read from a race: they say what you type in their settings.
1. Open **Home**, press **Customize**, make the grid big enough (for example 4 columns by 3 rows) and pick **Weather** for one cell and **Tyres Available** for another.
2. **Weather**: the settings show under the map (*Card 2 settings*). Choose the weather (Dry, Cloudy, Wet, Clearing), write a line under it (for example *Clearing after lunch*, or leave it empty), and type the track temperature, the air temperature, the wind speed and the direction the wind comes from (degrees: 0 north, 90 east, 180 south, 270 west). The card shows four tiles: *Track*, *Air*, *Wind* and *From* (SW). Tick or untick each value, add the degrees (*SW 225°*), and put them two by two, in a row or in a column.
3. **Units**: choose *Fahrenheit and mph* and the numbers you typed are changed with them (31 °C becomes 88 °F, 10 km/h becomes 6 mph); back to Celsius gives the first numbers back.
4. **Tyres Available**: a line for each tyre of the weather system, with a tick, your own name for it and how many sets (*Soft* shown as *Grippy*, 6 sets). Hard, Medium and Soft are ticked to begin with. Under the lines: *Show how many there are of each* (the number behind the name), and *Put the tyres* **in a column** or **in a row**.
5. **Pictures**: both cards draw the pictures of the Weather Forecast, Track Conditions and Tyres widgets. If you made a picture set under Customization > Image Settings (Weather, Conditions or Tyres), you can choose it in the card; a slot of the set without a picture is drawn, and a set that was deleted is ignored.

Good to know:
1. A number or a line of text is saved when you leave the field, and Home is drawn again a moment later (not while you are typing in a field, and a click or a Tab that comes next is not lost). The control you went to keeps the cursor, so you can fill in the names of several tyres one after the other with Tab.
2. A number that is too big or too small is held at the limit (temperatures from -60 to 150, wind from 0 to 400, the direction from 0 to 359, tyres from 0 to 99); anything that is not a number is the standard value (30, 24, 10 and 225). A name is cut at 24 characters and the line under the weather at 40.
3. The tyres are the ones of the weather system, each at most once, in its order. The picture of a tyre keeps its compound colour (the Soft ring is red, whatever you call it).
4. The cards do not follow a race or a weather system: the weather and the tyres of a race are on the race screen and in the widgets of the layouts.
5. They need no saved race: a Home without races shows them as they are.
6. Not done: tyres in other numbers than sets (laps, wear), a forecast on the card, and a different name for the card itself.
7. The tests: `tests/homegrid.test.js` (the options: numbers, text, units that change the numbers, tyre rows), `tests/homecards.test.js` (the markup), `tests/screens.test.js` (Customize for both cards, saving, picture sets, the cursor) and `tests/help.test.js`.

## What to try (1.26.1): the Personal Bests card in a small cell
A fix, and a new name: the card is now called **Personal Bests for Drivers on the Grid**.
1. Open **Home**, press **Customize**, make the grid 4 columns by 2 rows (or bigger) and give one cell of 1 by 1 the card **Personal Bests for Drivers on the Grid**.
2. The title wraps over two lines and the track name sits under it at the right. The rows start under the heading, and the times of all the drivers line up on the right edge (before, the first time stood to the left of the others).
3. The same goes for every card with a track or a date at the right of its heading (Record to beat, Last race, Rules of this race and so on): in a narrow cell they can never touch the first row.

Good to know:
1. Only the look changed; nothing is saved differently. A Home you set up before keeps its cards.
2. The tests: `tests/homecards.test.js` (the title) and `tests/homegrid.test.js` (the rule that holds the tag inside the heading).

## What to try (1.27.0): miles and feet for distances
From your list: the speeds had mph since 1.22.0, now the distances have feet and miles too.
1. Open **App Settings > General > Display**. Under *Speed unit in the tables* there is a new choice, **Distance unit**: *Metres and kilometres* (the standard) or *Feet and miles*. The folder title says which one is on.
2. Choose **Feet and miles**, then open **Database > Results and Records**. Turn on the *Distance* column (View settings): it is in feet up to a mile (*2774 ft*) and in miles from there (*1.24 mi*). The PDF of a session uses the same unit, and so does the **At a glance** card of Home.
3. Open **Database > Tracks** and edit a track. The labels say *Track length (feet)*, *Distance between the lanes (inches, centre to centre)* and *Length of every lane (feet)*, and the numbers are the saved metres in feet (12 m is 39.37 ft; 100 mm is 3.94 in). The calculator takes the length of a piece in inches and shows its total in feet; *Use this length* fills the length box in feet.
4. Type a length in feet (say 50) and save: it is kept as 15.24 m. Look at the track again in metres (choose *Metres and kilometres*): 15.24. Nothing else changed.
5. Open the track again in feet and press Save without touching a number: nothing changes, not even in the last decimal.

Good to know:
1. Everything stays saved in metres and millimetres. The unit only changes how a length is shown and typed, so you can change it at any time. Backups, transfer files and the speeds do not change.
2. A number you did not change is saved exactly as it was (the feet on the screen are rounded, the saved metres are not). In a list of lane lengths only the lane you changed is converted.
3. The speed unit is separate: feet and miles with km/h is fine.
4. Track lengths in lists and cards are written as *39.4 ft*; an old text length that was typed by hand ("12,5 m") stays as typed.
5. Not done: the speed widgets and the weather widgets keep their own units; the voice does not say distances; a new piece row in the calculator starts with the length of the row above it.
6. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
7. The tests: `tests/speed.test.js` (the conversions), `tests/stats.test.js` and `tests/report.test.js` (the tables and the PDF), `tests/screens.test.js` (the setting, the tables, Home, the track form in both units: labels, numbers, saving, the calculator) and `tests/help.test.js`.

## What to try (1.28.0): the Notes card and the Car Mileage card
From your list: two more cards for Home, drawn first as a mockup and made as you approved it.
1. Open **Home**, press **Customize**, make the grid big enough (for example 4 columns by 2 rows) and pick **Notes** for one cell and **Car Mileage** for another.
2. **Notes**: the settings show under the map. Give the card a **title** (*Notes* to begin with; *Club night* for example), type your words in the text box (for example *Doors open 19:00*, a new line, *Marshals: Sam and Kim*), choose the **size** (*Normal*, or *Large* for reading from a distance) and tick or untick **Show the title**. The card shows your words with their lines. With nothing typed it says *No notes yet. Open Customize and type them here.*
3. **Car Mileage**: the slot cars with the most laps, the one in front first, with the laps and the distance (*Porsche 917 · 5 laps · 50 m*), the picture of the car and a bar that shows each car against the one in front. Settings: **Show** (*Laps and distance*, *Laps*, *Distance*; with *Distance* the bars follow the distance), **Cars shown** (3, 5, 8 or 10), **Count** (*All time* or *This year*), and ticks for **the picture of the car** and **the bar**.
4. Drive and save a race with two different cars: the card counts every lap of the race for the car that drove it. Choose *This year* and laps of last year are left out (the card says *this year* next to the title).
5. Open **App Settings > General > Display** and choose **Feet and miles**: the distance on the card is in feet and miles.

Good to know:
1. The laps are the same laps as the *At a glance* card: racing laps that count, from saved races. Time Token Sessions, invalid laps and laps that were too slow or too late are not counted. The distance is the laps times the length of the track they were driven on, so a car that raced on two tracks gets both.
2. A car that is no longer in the Database is left out (its laps stay in the races), and so are laps that were saved without a car. A car without a name is left out too. With nothing to show the card says *No lap has been saved with a car yet.* (or *...with a car this year yet.*), and Home still works without any race.
3. Equal laps are ordered by the distance and then by the name of the car.
4. The words of Notes are saved when you leave the text box, and Home is drawn again a moment later (not while you are typing). The box keeps its cursor and selection, so a click or a Tab that comes next is not lost. Anything you type is shown as text (a `<b>` stays `<b>`).
5. Not done: a *since a date* choice for Car Mileage, a check-list in Notes, links or pictures in Notes.
6. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
7. The tests: `tests/homegrid.test.js` (the options, the text kind), `tests/homestats.test.js` (the mileage: laps added up like *At a glance*, this year, ties, no distance), `tests/homecards.test.js` (the markup), `tests/screens.test.js` (Customize for both cards, the text box and its cursor, saving, this year, the distance unit, the empty cards, Back to the usual Home) and `tests/help.test.js`.

## What to try (1.28.1): the Countdown pictures are only for the countdown
A fix, from your note: a picture dropped on *Countdown / All lights* was used for every other state too (Yellow flag, Red flag, Paused and so on).
1. Open **Customization > Image Settings**, make a new set **For: Start lights** and drop one picture on **Countdown / All lights**.
2. Only the five cells of the **Countdown** row show it (dimmed). The cells of Yellow flag, Red flag, Paused and the other rows stay plain round lights. Before, they all showed the Countdown picture.
3. In the **Preview** (above the grid) choose *The countdown*: three lit lights with your picture. Choose *Yellow flag* or *Red flag*: plain round lights.
4. Drop a picture on *Yellow flag / All lights*: the Preview of the Yellow flag and the cells of that row show it. Drop another on *Yellow flag / Light 3*: light 3 has its own picture, the others the *All lights* picture of the row.
5. In a Layout, choose the set in a **Start Lights** widget: the countdown shows the Countdown pictures. In a race press **Y**: the yellow lights show the Yellow flag pictures, or plain round lights when that row is empty.

Good to know:
1. The rule is now: a light that is on uses the picture of that light in its state, then the *All lights* picture of the same state, and nothing else (a plain round light). The countdown is its own state. A light that is off uses *Lights off* (its own picture, then *All lights*) in every state.
2. A set you made before this version with only Countdown pictures: its race states are now plain round lights. Drop the picture on each row you want to have it (for example *Racing (green flag) / All lights*).
3. The colour of a plain round light is the colour in the settings of the Start Lights widget, as before.
4. The tests: `tests/widgets.test.js` (the keys of a light, what a cell shows dimmed), `tests/timing.test.js` (what the widget draws in each state), `tests/screens.test.js` (the grid and the Preview) and `tests/help.test.js`.

## What to try (1.29.0): the Lap to Lap Delta widget
From your note: a Delta Timer that compares your last lap with the lap before it, as a widget of its own.
1. Open **Customization > Layouts**, make or open a layout and look in the **Delta Timers** folder: **Lap to Lap Delta** is the second widget, after *Laptime Delta*. Place it on a lane.
2. In a race the widget shows the last lap you set. On lap 10 it shows lap 9, and the badge says how far lap 9 was from lap 8: green with ▲ and a minus (▲ −0.100) when lap 9 was faster, red with ▼ and a plus (▼ +0.100) when it was slower. Point at the badge and it says it in words (*0.100 s faster than the lap before it*).
3. After the first lap the time is shown and the badge is a dim dash (*Needs two laps*). With no lap yet both are a dash. From the second lap on, the badge compares each new lap with the one before it.
4. The time stays on the last lap for the whole lap, it is not a clock (the *Laptime Delta* shows the running clock of the lap you are driving). The whole widget turns the personal best colour (or the track record colour) for a few seconds after a lap that was a personal best or a record: *Show finished lap for* (seconds), *Personal best colour* and *Track record colour* are in its settings, as in the Laptime widget.
5. The look of the badge is as for every Delta Timer: the time on the left and the badge on the right, or the badge below the time (**Value and badge**), the number of decimals, filled or outlined, the size of the badge, the outline, bold and italic text, the arrow and the three colours.

Good to know:
1. It always compares a lane with its own lap before; there is no choice of another lane, the leader or a record, and no *Left (or top) value shows* (the time on the left is always the last lap). The other Delta Timers are as before, and the *Laptime Delta* still compares your last lap with another lane or with your own best lap.
2. Only laps that are in the list of laps of the lane count (the last two). In a heat race the laps of a lane start again with every heat, so the first lap of a heat has no lap before it.
3. The widget is also in the Leaderboard Editor (a row of the Leaderboard can hold it), on the second screen and on a phone, like the other Delta Timers.
4. The name is *Lap to Lap Delta*; say if you would like another one.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/delta.test.js` (the numbers: lane 1 −0.100, lane 2 +0.100, lane 3 +0.700, one lap, no lap; what the live page draws, the colours; the folder and the register), `tests/widgets.test.js`, `tests/screens.test.js` (the settings in the Layout Editor) and `tests/help.test.js`.

## What to try (1.29.1): closed settings folders and no scrollbar for the app
From your note and screenshot: the long list of settings of a widget is overwhelming, and with all the folders open the app got a scrollbar next to the one of the settings panel.
1. Open **Customization > Layouts**, open a layout and click a widget, for example a Delta Timer. The settings panel on the right now shows only the names of its folders (Title, Text, Frame, the widget's options, Place), all closed.
2. Open the folders you need. They stay as you left them when you click another widget (a folder you opened stays open, the others stay closed), also when you leave the editor and come back, for as long as the app runs. The folders of the widget list on the left work the same way.
3. Open every folder of a long widget. The settings panel gets its own scrollbar and the app (the page behind it) does not get one. The widget list on the left does the same.
4. Resize the window or scroll the page: the panels follow, they always end at the bottom of the window.

Good to know:
1. In a window that is too short for the canvas itself (for example 650 pixels high) the page still scrolls, because the canvas and its toolbar need the room. That is the canvas, not the panels.
2. In a narrow window (under 900 pixels) the panels sit under the canvas as a part of the page, as before.
3. Which folders are open is not saved in the layout or in the settings; it is only remembered while the app runs (after a restart they are closed again).
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/screens.test.js` (the folders start closed, the opened ones are remembered, the room for the panels and how it is applied).

## What to try (1.30.0): statistics for a slot car
From your note: a service interval, the laps since the last service with a Reset button, and the mileage, in the Statistics folder of a slot car.
1. Open **Database > Slotcars**, press **Edit** on a car (or **Add slot car**) and open the **Statistics** folder. It has, in this order: **Service Interval**, **Laps Driven**, **Laps Since Last Interval** (with the **Reset** button), **Last Serviced** and **Mileage**.
2. Type a **Service Interval**, for example 300 laps. Under *Laps Since Last Interval* the form says how many laps are left (*288 laps to go until the next service*), and when the car has reached the interval it says *Service due* in red (and how many laps over).
3. **Laps Driven** counts every lap saved with the car, as before (it now has capitals: *Laps Driven*). **Laps Since Last Interval** counts the laps saved since the car was last serviced. A car from before this version has had no service yet, so all of its laps count.
4. Press **Reset** when you have serviced the car: the count shows 0 at once and **Last Serviced** shows today. It is kept when you press **Save** (**Cancel** leaves it as it was). The laps of the next race count from 0.
5. **Mileage** is the distance the car has driven: every lap that counts times the length of its lane, the same sum as the **Car Mileage** card on Home (so a lap that does not count, a lap of a Time Token Session and a lap on a track without a length are not in it). It is shown in the distance unit of Display (metres and kilometres, or feet and miles). It is worked out when the form opens.
6. Click a car in the list or grid to see its card: it shows the same numbers (the interval, Laps Driven, Laps Since Last Interval, Last Serviced and the Mileage).

Good to know:
1. The counts are updated when a race is saved, as Laps Driven always was; a race that is still running is not in them. A lap is counted for the laps since the last service when its session was saved after the Reset.
2. If you delete a session, or a driver, track or car with laps, the laps leave the counts. A lap from before the last service was not in *Laps Since Last Interval* and stays out of it.
3. *Laps Driven* counts every lap saved with the car (also an invalid lap), the Mileage only the laps that count, so the two can differ a little.
4. There is no alarm yet: *Service due* is only said in the form. Say if you would like it on the card in the list, or on Home.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/carstats.test.js` (the numbers and the words, which laps count, the mileage), `tests/db.test.js` (the counts when sessions are saved and removed, cars from before), `tests/screens.test.js` (the folder, Reset, the interval, the card) and `tests/help.test.js`.

## What to try (1.30.1): mirror the Slotcar Picture
From your note: the same Mirror option that the Avatar widget has, for the Slotcar Picture widget.
1. Open **Customization > Layouts**, make or open a layout, add a **Slotcar Picture** widget (folder *Slotcar*) and click it. The settings on the right have a new tick box **Mirror the picture (flip it left to right)**, above **Picture position and zoom**.
2. Tick it. In a race the picture of the car on that lane is flipped left to right, inside its frame. The position and zoom you set work as before; the flip comes after them.
3. Leave it unticked and nothing changes: the picture is shown as it was.

Good to know:
1. The preview in the Layout Editor shows a placeholder (*Car picture*), because the widget has no car there; the picture itself shows during a race, on the second screen and on a phone.
2. It is a setting of each widget, so one layout can have a mirrored picture on the left lanes and a normal one on the right. The Avatar widget keeps its own Mirror setting.
3. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
4. The tests: `tests/timing.test.js` (the picture, mirrored and not), `tests/widgets.test.js` (the setting) and `tests/screens.test.js` (the tick box in the editor).

## What to try (1.31.0): the Race Director changes a car's dry tyre
From your note: the Race Director can override the tyre of a slot car during a race (a driver who swaps his Soft tyres for Hard ones in an endurance race), and can change the Database entry too.
1. Use a race setup with a **Weather System** (Race Setup, Weather Systems), start a race and look at the **Weather** controls (race screen, or the Weather folder of the Race Director page). There is a new column **Dry tyre**, with a choice for each lane: Hard, Medium, Soft or Supersoft. It shows the tyre of the slot car (Database, Slotcars, Tyre choice) to begin with.
2. Pick another tyre for a lane. The car is on it at once (the Tyres widget and the tyre in the table change), and it counts for the weather rules from then on: a car on Hard has to change to Wet when it rains, as any dry tyre does.
3. Under the table is the tick box **Also change the tyre choice of the Slotcar in the Database**. Not ticked, the change is for this race only; ticked, the tyre choice of that slot car in the Database changes too, so the next race starts from it. In heats, the next heat starts from the tyre of the Database, so with the box not ticked the change counts for the heat that is running.
4. The same choice and tick box are on the Race Director page, so the Race Director can do it from a phone.
5. After the race the result notes it: *Hard tyres, set by the Race Director after lap 14*.

Good to know:
1. Only the dry tyres can be chosen. **Wet** and **Intermediate** come from the pit stops (the weather asks for them), as before.
2. It works in every weather, from the lights until the race is over, and not in the review after the race. A car that is on Wet tyres when you change its dry tyre stays on Wet until it changes tyres in the pits; the new dry tyre is the one it goes back to. Rain still makes a car on any dry tyre (Hard too) change to Wet, also a car whose slot car had a Wet or Intermediate tyre choice and was given a dry tyre in the rain: it gets the same laps to change as the others.
3. A race without a weather system has no Weather controls, so there is nothing to change there (yet). Say if you want the choice in every race.
4. If the Database cannot be written, the race goes on with the new tyre and the Database keeps what it had.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/weather.test.js` (the engine, the result, saving and resuming), `tests/weatherscreen.test.js` (the choice, the tick box, the Database, the Race Director page), `tests/web.test.js` (the command of the phone page) and `tests/help.test.js`.

## What to try (1.32.0): the Tyre Change folder, in every race
From your note: the tyre choice in every race, in a folder of its own under the Race Director called Tyre Change.
1. Start any race: a race, a timed race, heats, a practice, a qualifying, with or without a weather system. Under the track actions of the race screen there is a purple folder **Tyre Change** (after Weather, before Endurance). The Race Director page has the same folder, so it works from a phone too.
2. For each lane it lists the driver, the tyres the car is on now (with the colour) and a **Tyre choice**. Pick another tyre and the car is on it at once (the Tyres widget changes too).
3. Under the table is the tick box **Also change the tyre choice of the Slotcar in the Database**. Not ticked, the change is for this race only; ticked, the Slotcar in the Database gets it too.
4. In a race **without weather** all six tyres can be chosen, including Intermediate and Wet. In a race **with weather** only the four dry tyres can: Wet and Intermediate are greyed out, because the pit stops give those. A car on Wet when you change its dry tyre keeps the Wet tyres and goes back to the new tyre in its next stop.
5. The result notes it, for example *Hard tyres, set by the Race Director after lap 14*, or *before the first lap* when the car had not driven yet.

Good to know:
1. The tyre choice is not in the Weather folder any more: that folder keeps the weather buttons and the tyres the cars are on.
2. A Time Token Session has no Tyre Change folder (its lanes are sold to guests, there is no car to choose a tyre for).
3. It works from the lights until the race is over, and not in the review after the race. In heats, without the tick box the change counts for the heat that is running; the next heat starts from the Database.
4. The phone page asks the race window to do it; the server only accepts a lane from 0 to 15, one of the six tyres and a save that is true or false.
5. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
6. The tests: `tests/weather.test.js` (the engine with and without weather, the view, the words, resuming), `tests/weatherscreen.test.js` (the panel, the tick box, the Database, the Race Director page, a race without weather, heats), `tests/racefolders.test.js` (the folder and its colour), `tests/web.test.js` (the command) and `tests/help.test.js`.


## What to try (1.33.0): more statistics for a slot car, and a Service due mark
From your note: all the statistics ideas, in the Statistics folder of a slot car.
1. Open **Database > Slotcars**, press **Edit** on a car and open the **Statistics** folder. After the four fields of 1.30.0 it now has: **Services Done**, **Mileage**, **Mileage Since Last Service**, **Last Driven**, **Sessions Driven**, **Wins**, **Deslots**, **Fastest Lap Ever** and a table **Best Lap per Track**. Each has a short line under it that says what it counts.
2. **Services Done** counts how many times you pressed **Reset** and saved. A car that was serviced before this version (it has a day under *Last Serviced*) counts as 1; a car that was never serviced is at 0. Press **Reset** and it shows the next number at once, and **Mileage Since Last Service** goes back to 0 (kept when you press **Save**).
3. **Mileage Since Last Service** is the same distance as **Mileage**, counted from the day of the last Reset. Until a car is serviced for the first time it is all of the mileage.
4. **Last Driven** is the day of the last lap saved with the car (*Never* when it has none). **Sessions Driven** is the number of sessions the car has laps in: races, qualifyings and practices.
5. **Wins** are the races the car came first in (a single race, a timed race, a heat race or an endurance race; not when it was disqualified or retired). A practice or a qualifying has no winner.
6. **Deslots** are the laps that took longer than the **deslot time** of their track (Tracks > Lap time limits). A lap with a pit stop is not a deslot, and a track without a deslot time has none.
7. **Fastest Lap Ever** is the best valid lap of the car on any track, and the track it was on. **Best Lap per Track** lists every track with a valid lap: the number of laps, the best lap and the average lap, the track with the most laps first. A lap that is invalid, too slow, late or with a pit stop is not a valid lap.
8. The card of a car (click it in the list or grid) shows the same, with **Next Service** (how many laps are left, or that the service is due) above them.
9. A car whose laps since the last service have reached its interval has a **Service due** mark next to its name, on the card in the grid and in the first column of the list.

Good to know:
1. Services Done is kept with the car. All the other new figures are worked out from your laps, sessions and tracks each time the form or the card opens (a moment of *Calculating…*), so they always match your races and nothing has to be reset. If the laps cannot be read they show a dash.
2. A Time Token Session is a pool of its own: its laps are not in any of these figures, as on the Home cards.
3. The Service due mark is not on the Home tab yet. A Home card *Service Due* (the cars that need servicing) is a good next step: a mockup comes first, to your approval.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/carstats.test.js` (the services, and everything that is worked out: mileage since the service, last driven, sessions, wins, deslots, the fastest lap and the table), `tests/screens.test.js` (the form, Reset, the card, the Service due mark) and `tests/help.test.js`.

## What to try (1.34.0): the Service Due card on Home
From your note: the Home card for the slot cars that need servicing, in both looks of the mockup.
1. On **Home**, press **Customize**, pick a cell and choose the card **Service Due**. It works from your slot cars, so it also shows before the first race has been saved.
2. The card lists the cars that are **due** first (laps since the last service have reached the service interval), the car with the most laps over on top, then the cars **coming up** (within 10% of their interval), the car with the fewest laps to go first. Each car shows *Service due* in red or *22 laps to go* in amber, with *342 of 300 laps · 42 over*, a bar and the picture of the car. A car without a service interval is not in it.
3. **Click a car**: the Database opens on Slotcars with the card of that car (the Statistics are in it).
4. The settings of the card (Customize): **Show** (Due and coming up, or Due only), **Coming up means within** (5, 10, 20 or 25% of the interval), **Cars shown** (3, 5, 8 or 10), **Show a bar for each car** and **Show the picture of the car**. The tag says *3 cars*, or *3 of 7 cars* when more cars need servicing than the card shows.
5. With the bar and the picture both switched off the card is **compact**: one line a car with a dot, the name and *42 laps over*, *due now* or *22 laps to go*.
6. When no car needs servicing the card says *all good* and when a car shows up. When no car has a service interval it says where to set one (Database > Slotcars, the Statistics folder of a car).

Good to know:
1. The laps since the last service are the ones the Database keeps (Laps Since Last Interval), so they are updated when a race is saved, as in 1.30.0. Press **Reset** in the form of the car when you have serviced it.
2. A card for show cannot be edited: change a service interval in the form of the car.
3. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
4. The tests: `tests/carstats.test.js` (the list of cars), `tests/homegrid.test.js` (the card and its settings), `tests/homecards.test.js` (both looks, the words, the safe text), `tests/screens.test.js` (Customize, the card on Home, the click, the card in the Database) and `tests/help.test.js`.

## What to try (1.34.1): widgets as small as you want in the Layout Editor
From your note: the widgets in the Layout Editor could not be scaled down as tiny as you want.
1. Open **Customization > Layouts** (or a layout of a race setup), place a widget, select it and pull a corner handle in. A widget can now be as small as **5 units**: half a percent of the width of the layout, one step of the grid. Before it stopped at 40 units (4% of the width).
2. With **Snap to grid, widgets and guidelines** on, the sizes still jump in steps of 5 and edges are pulled to neighbouring widgets. Switch the tick box off to drag the size to exactly what you want (7 units, 12 units, any whole number).
3. A small widget (less than 60 units wide or high) has its four handles **outside** its corners when it is selected, so you can still grab the widget itself, drag it somewhere else, or pull a handle out again.
4. The text inside keeps the size you gave it and is cut off at the edge of the widget, so a small widget needs a small **Text size** (the Text and Title sizes can go down to 5 and 3). The Widget Builder (Customization) also takes widths and heights from 5.

Good to know:
1. The smallest size is the same for every widget, and for the cells of a row design (the numbers for Left, Top, Width and Height there).
2. A layout you made before keeps its widgets as they are. Only the limit for making them smaller changed.
3. A very small widget is hard to see on the canvas. Drag a rectangle around it (or press Ctrl+A) to select it again, and use Undo if a pull went too far.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/widgets.test.js` (the smallest size from every corner, with and without snapping), `tests/screens.test.js` (the pull in the editor, the handles of a small widget, the Widget Builder).

## What to try (1.35.0): Distance Racing
From your idea: a race that is driven for a distance, instead of laps or time. This is the first half (version 1.35.1 adds the driver swaps by distance).
1. Open **Race Setups** and make or edit a **Race by laps or distance** setup. The new setting **The race is limited by** has *A number of laps* (as before) and *A distance*. The same choice (*By distance*) is there for the heats of a **Heats** race and for an **Endurance Race** (by distance, or by heats by distance). In the Length and result folder you set the **Distance of the race**, in metres (in feet when App Settings > General > Display > Distance unit is feet and miles).
2. **The lanes drive**: *The same distance* (the fairest: a shorter lane drives more laps), *The same number of laps* (every lane drives the laps that the distance takes on a lane of the track length), or *A distance I set for each lane* (type them, lane 1 first, for instance 100, 105, 110; a lane without one drives the distance of the race).
3. **A distance that is not a whole number of laps**: *Drive on to the line after it* (at least the distance, the standard) or *Round to the nearest lap*. A car is only seen when it crosses the line, so it always drives whole laps.
4. **The race may take at most (minutes)**: a safety net, 0 = no limit. When the time is up every car finishes at its next crossing of the line and the cars are ranked by the distance they have driven.
5. The race works out the laps of every lane from the length of the lane (Database > Tracks: the track length, and the lane lengths). **Home** warns you when the distance is missing, or the track or a lane has no length. The cars are ranked by who reached the distance first; the others by the distance driven. The gaps are a time (or laps behind) as in a race by laps.
6. Three new widgets in the group **Distance** of the Layout Editor, all per lane: **Distance Driven** (84 m, or 84 of 103 m, or 81%), **Distance To Go** (19 m, with an option to add *to go*) and **Laps To Go** (5 laps to go, or Last lap). The distance changes **smoothly** (estimated between two crossings of the line from the last laps) or **only when the car crosses the line** (exact): your choice in the settings of the widget, together with the decimals and the unit (as set in App Settings, metres or feet). The Text widget has the variables for them as well.
7. The summaries show the distance: the Home card of the setup rules, the Race Setups list, the header of the race, the heat plan, the results and the report.

Good to know:
1. Old race setups keep working: they are *by laps*. The session type that was called *Race by laps* is now called **Race by laps or distance**.
2. A distance can only be driven when the lane lengths are known: the distance a car has driven is its laps times the length of its lane.
3. The audio calls (last lap, laps to go) use the laps of the lane of each car.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/distance.test.js` (the sums, the engine, the widgets, the settings) and `tests/distancescreen.test.js` (Home, the race screen, a saved session, heats and Endurance by distance), `tests/screens.test.js` (the settings and the folders) and `tests/help.test.js`.

## What to try (1.35.1): driver swaps by distance
The second half of Distance Racing: an Endurance Race whose drivers swap after a distance, with a widget that tells the team when.
1. Open **Race Setups** and make an **Endurance Race** (by time, laps, distance or heats). In the folder **Endurance: driver swaps** the first setting, **Swaps are counted in**, now has a third choice, **Distance**. The settings below it then ask for metres (feet when App Settings > General > Display > Distance unit is feet and miles): **A swap is due every** (50 m), the **fixed distances** (100, 250, 400), the **shortest** and **longest stint**, the **least** and **most** a driver drives in the whole race, and **Warn** a number of metres before.
2. **Where a swap is made**: *At the line* (the standard) or *Anywhere on the track*. A car is only seen when it crosses the line: at the line, the swap is due at the first crossing past the distance. Anywhere, the distance is estimated between two crossings from the last laps, so the swap is due at the right moment, for a swap on the straight.
3. The swap itself is made as before: by the pit sensor or by **Swap done** on the race screen, the Race Director page or a phone; the next driver, the late swap (laps keep counting or stop) and the penalty points work the same.
4. **Home** warns when the track or a lane has no length (the distance a car has driven is its laps times the length of its lane). The Home card **Rules of this race** says *Every 50 m, at the line*.
5. In the Layout Editor (group **Team**): the **Swap Timer** counts down in metres (*Swap in 12 m*, amber in the warning, red when it is late). The new **Swap Signal** is made to be seen from far away: nothing while the swap is not near, then **SWAP** in red with *Alex → Sam* under it, flashing, until the swap is made, with how many seconds late the team is. Its settings: *When* (only when the swap is due, or also in the warning, in amber), the word, the names (name, nickname or call sign, or none), flashing on or off, and the three colours.
6. The audio call *swap soon* says the distance (*swap in 12 metres*, {swapin}); *swap now* is said when it is due. The call *halfway* is the call of the race progress as before: it says half of the race is driven.
7. The results (and the PDF) give every driver's distance and every stint's distance: *Alex (3 laps, 1:30, 30 m)*, in feet when you chose feet.

Good to know:
1. A swap in distance needs the lane lengths of the track (Database > Tracks). Without them no swap is due and Home says so. A race in minutes or laps does not need them.
2. The settings for minutes and laps and the settings for distance are separate: switching the unit does not change the other numbers.
3. A fix on the way: the Home card with the rules did not show the driver swaps of an Endurance Race at all; it does now.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/distanceswap.test.js` (the rules, the engine at the line and anywhere, the widgets, the settings, Home, the results, the audio call), `tests/distancescreen.test.js` (Home, the race screen with the Swap Signal, a saved session with the metres of every driver), `tests/screens.test.js` (the settings) and `tests/help.test.js`.

## What to try (1.35.2): author, licence and app id
The program now says whose it is, and on what terms it may be used. Nothing changes in the way the program works.
1. Open the file **LICENSE** (it is in the zip, in the repository and in the installed program): the PolyForm Noncommercial License 1.0.0, with the line *Required Notice: Copyright 2026 theDutchmanJames*. Free for any non-commercial use; commercial use needs your permission.
2. `package.json` has the **author** (theDutchmanJames), the **licence**, the **home page**, the **repository** and the **bugs** page of the project on GitHub.
3. The placeholder **app id** `com.example.slotforgetiming` is now `io.github.thedutchmanjames.slotforgetiming`, and the Linux package's **maintainer** (it was `noreply@slotforge.invalid`) is `James <thedutchmanjames@gmail.com>`. The installers carry a copyright line (*Copyright © 2026 theDutchmanJames*), which shows in the About / file properties of the installed program.

Good to know:
1. Your data is not touched: the data folder is fixed by name (`slotforge-timing`), not by the app id.
2. A copy that was installed with the old app id is seen as another program by macOS and Windows: macOS asks for its permissions again (for example the local network), and Windows installs next to the old copy instead of replacing it. Uninstall the old copy once. The portable program and a copy started with `npm start` are not affected.
3. You asked for "like MIT, but no commercial selling". PolyForm Noncommercial goes one step further than a ban on selling: it does not allow **any** commercial use (for example a paid slot car track that runs the program for its customers needs your permission). If you only want to forbid selling the program itself, say so and the licence can be changed; a ban on selling alone needs wording that a lawyer should look at.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/package.test.js` (the author, the licence and the LICENSE file, the app id, the maintainer, the copyright, the installer list, the README).

## What to try (1.36.0): the Driver stats grid
The Driver stats page of Live Race is a grid you set up yourself, like the Leaderboard page. Most people will use it on a phone.
1. Start a race (a race with two lanes is enough) and open **Live Race > Driver stats**. Pick a lane at the top. Without any setting you see the **standard layout**: the position big on the left, the last lap and the best lap beside it, the gap to the leader and the laps to go, the flag, and the list of laps at the bottom.
2. Open **Customize**. The little squares are the grid (up to **4 columns by 8 rows**): click one to make the grid that size. Under **Cells** click a cell of the map, and under it choose what the cell **Shows**, how many **columns and rows it covers** and whether its **label** is shown. An empty cell (a +) asks what it shows; *(empty)* takes a cell away again.
3. The cells: **Race** (position, lap, lap time, last lap, best, average and median lap, gap to the leader, record lap time, speed, laps to go, distance driven, distance to go), **Swaps** (swap signal, swap timer, current driver, next driver), **Car** (fuel, tyres, damage, pitstop time, penalty), **Track** (flag, start lights) and **Other** (points, list of laps). Under the list the page says when a cell shows (the Swap signal in a race with driver swaps, Fuel when Fuel is on, and so on).
4. A cell the race has **nothing for** is left blank (a swap signal in a race without swaps), and a row in which nothing is left is **not drawn** at all, so a plain race does not leave holes on a phone. The swap signal flashes in its colours while a swap is due, as the Swap Signal widget does.
5. The grid you set **on the computer is the default for every device**. A phone opens the same grid. When the phone changes anything in Customize, it keeps **its own grid on that phone** (nothing is sent to the computer or to other phones), and Customize says *This device only*. **Use the computer's layout again** drops the phone's own grid and follows the computer again. On the computer the same button goes back to the standard layout.
6. A device **remembers its lane**: pick Sam on your phone and the page opens on Sam next time. Switch it off with **Remember my lane on this device** in Customize. A lane that is not in the race (a smaller race this time) is skipped: the first lane shows.

Good to know:
1. The old page showed all the numbers in a row; the standard layout does not show the average lap, the median lap, the record lap, the speed, the pitstop time, the penalty points and the championship points, but they are all in the list of cells.
2. *Last lap* is the time of the last lap that was driven (new); *Lap time* is the clock of the lap that is being driven.
3. A phone only keeps its own settings in its browser: another browser, or clearing the data of the browser, brings back the computer's grid.
4. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
5. The tests: `tests/drivergrid.test.js` (the rules, the layout of rows, the lane, the phone's own settings), `tests/live.test.js` (the page, Customize, the lane, the reset), `tests/endurancescreen.test.js` (the swap cells), `tests/distancescreen.test.js` (the distance cells), `tests/weatherscreen.test.js` (the tyre cell) and `tests/help.test.js`.

## What to try (1.37.0): the Arduino box
This is the app's side of a timing box you build yourself (an Arduino Nano or Mega). The firmware has been tried **on a computer only**; the first real board is still to come, so please read this as a first checkpoint.
1. App Settings > Timing Hardware > **Arduino**. Tick **Use the virtual box**: the pins fill in (four lanes on A0..A3, four pit sensors on A4..A7), the readings move and the check lights blink as imaginary cars pass. Press **Calibrate**: the thresholds change. Press **Test the lights**.
2. Press **Download the Arduino sketch**: `SlotForgeBox-1.0.3.zip` lands in Downloads, with the sketch folder and a README. `docs/arduino-box/BUILD-GUIDE.md` in the project says what to buy and how to wire it.
3. Home: a race setup on a 4-lane track, four drivers, **Start race** (leave *Simulated cars* off). The laps come from the virtual box. The countdown goes to the box as lights 1 to 5 with a short beep each, GO is green with a long beep, the yellow flag is a yellow light and a red flag or the end of the race is STOP. The virtual cars use the pit sensors, so pit stops happen.
4. Race Setup > a race setup > folder **SlotForge box (Arduino)** (only for sessions that race): **A pit stop starts when** (sensor, button, or both), **Lane power** (cut a lane's power when its car retires or is disqualified, or never), **The box beeps the countdown and GO**, and **The status pixel of each lane shows the lane colour**. The track power at the start and the Track call button are the Trackmate choices in the folder above it; they serve the box too.
5. With a real Nano: open the downloaded sketch in the Arduino IDE, install *Adafruit NeoPixel*, pick the board and upload. Untick the virtual box, **Find the box**, choose the port, **Connect**. The firmware version appears, and readings appear for the pins that have a role. Wire the sensors, press **Calibrate** with the track empty, then **Save to the box**. Cover a sensor with a finger: you see the letter in the log, the check light and the speed-trap figure.
6. After any change in `firmware/SlotForgeBox`: `npm run sketch` (repacks the sketch inside the app) and `npm run fwtest` (the desktop bench; it needs g++ and says SKIPPED without it).

Good to know:
1. **Not built yet**: the jump-start settings (a car that crosses during the countdown is ignored for now) and the speed-trap widget (the figure is already kept on each car as `trapMs`).
2. **Not on a board yet**: the real compiler (16-bit ints), the memory use and the electronics (crosstalk between analog inputs, noise, light) are only checked in the Arduino IDE and on the board. The desktop bench checks the logic and the timing: every lap counted, short passes (a pass of 4 ms is seen), the safe state, saved settings.
3. If the app is silent for 3 seconds the box cuts the track power (a setting on the page). The main window now has `backgroundThrottling: false`, otherwise a minimized window slows its timers and the keep-alive would stop.
4. Two cars less than 0.3 seconds apart on one lane count as one lap (the box's blackout time).
5. When you leave the race screen the box shows STOP and gives a retired car's lane its power back.
6. **GitHub tags** are still not pushed (refused from here); the code is pushed to the main branch.
7. The tests: the package's `tests/arduinobox.test.js`, `arduinosim.test.js`, `arduinorace.test.js` and `arduinosketch.test.js`, `tests/boxscreen.test.js` (the race screen with the box: lights, beeps, power, laps, pit sensor, speed trap, Track call, leaving), `tests/screens.test.js` (the new settings) and `tests/help.test.js`. The desktop bench is `npm run fwtest`; it is not part of `npm test` because it needs g++.

## What to try (1.37.1): the Windows test fix
Nothing to try in the app. Run `npm test` (or the Windows build with checks) on Windows: the last Arduino check, *Python opens it, every CRC checks, and a file reads back identical*, is now ok. Good to know: the check needs Python only as a second opinion on the sketch zip (`python3`, `python` or `py -3`); without Python it says *no Python found on this machine* and goes on. GitHub tags are still not pushed (refused from here).

## What to try (1.37.2): the AVR compile check
Nothing changes in the app. This version adds the check that compiles the box firmware for the real chips, and the updated documents in `docs/arduino-box/`.
1. On a Mac or Linux machine (or Git Bash on Windows) with `git` and a `clang` that has the AVR target (Ubuntu: `apt install clang`; Mac: `brew install llvm`): `bash tools/avrcheck/setup.sh` once (about 120 MB of downloads into `tools/avrcheck/deps`, which git ignores).
2. `bash tools/avrcheck/check.sh`. Expected: `ok nano (atmega328p): the sketch compiles, no warnings in its own files` and the same for the Mega, each with the sizes: the Nano uses 882 of 2048 bytes of static RAM and at most 24036 of 30720 bytes of flash. Without a clang that has AVR it says SKIPPED.
3. Change something in `firmware/SlotForgeBox` on purpose (a call to a method that does not exist): the check fails and names the line. Undo it.

Good to know:
1. It is **clang**, not the Arduino IDE's avr-gcc, and it does not link: the flash figure is an upper bound and the RAM figure leaves out the stack and the 3 bytes a pixel. Press **Verify** in the Arduino IDE once as well; that is the last compile question.
2. `tools/check-firmware.sh`, `tools/fwhost/run.js` and this check are developer tools run by hand after a change in the firmware. They are not part of `npm test` (the installer and the Windows build do not need them); `npm run sketch` and `npm run fwtest` stay the only scripts.
3. **GitHub tags** are still not pushed (refused from here).

## What to try (1.37.3): the Home chip follows the timing hardware
1. App Settings > Timing Hardware > Arduino: tick **Use the virtual box**. Go to Home. The first chip under the date now says **Virtual Arduino box connected**, with the green light (it used to say *Trackmate not connected*).
2. Untick it: the chip is dark again and says *Trackmate not connected* (nothing is chosen). Connect a real box, or a Trackmate: *Arduino box connected* / *Trackmate connected*. With both connected: *Trackmate and Arduino box connected*.
3. With the virtual box ticked but not connected (Auto-connect off), the chip is dark and says *Virtual Arduino box not connected*.

Good to know:
1. There is no separate "which hardware do I use" setting. What is **connected** is named first; when nothing is connected, the chip names what was **chosen** (the virtual box ticked, a remembered box, a remembered Trackmate) and falls back to the Trackmate.
2. The race screen's status line is unchanged: it says *Trackmate not connected · Arduino box connected* when only the box is connected. Say so if it should follow the same wording.

## What to try (1.38.0): the oXigen Digital sub-tab
1. App Settings > Timing Hardware. The sub-tabs are now Trackmate Interface, Arduino, DS Electronics, **oXigen Digital**, Other.
2. Click **oXigen Digital**: a short note says that nothing can be set up there yet. No buttons, no fields.

Good to know:
1. It only holds the place. Nothing connects, nothing is saved and a race does not use it; the page is filled in when the support for oXigen Digital comes.
2. Home still names only the hardware that exists (Trackmate, Arduino box, virtual box); oXigen joins it when it can connect.

## What to try (1.38.1): the port list on the Arduino page, and a window that says why
1. App Settings > Timing Hardware > Arduino, with a box plugged in: press **Find the box (COM port)**. A list **Choose a port** appears under the buttons; click the box (or Cancel). Before this version nothing could be chosen there. Then **Connect**.
2. If the Live Race window ever opens white again, it should now show **This window could not be opened** with a reason and **Try again**. Send me that text. (Also: with the white window in front, Ctrl+Shift+I opens the developer tools; the Console tab has the error.)

Good to know:
1. The white Live Race window you saw could not be reproduced: the window opens fine with no race, with a running race and with the virtual box bound (tried in a real browser with the same page). The card above is there to catch it, not a fix for a known cause.

## What to try (1.39.0): choose the timing hardware
1. App Settings > Timing Hardware. At the top: **Timing hardware in use** with None, Trackmate Interface and Arduino box (SlotForge). Choose **Arduino box**: its page opens, and the Trackmate page now says *This page is not in use for races* with a **Use this one** button.
2. Go to Home. The first chip under the date names the one in use: red **Arduino box not connected** until it is connected, green **Arduino box connected** (or **Virtual Arduino box connected**) once it is. With **None** it is dim: *No timing hardware chosen*.
3. Tick **Use the virtual box** (Arduino page): the Arduino box becomes the one in use and the virtual box connects; Home turns green.
4. Choose the Trackmate again with nothing connected and press **Start race**: a question says that the Trackmate is the timing hardware you chose and is not connected. **OK** starts anyway (keys or simulated cars), **Cancel** does not start.
5. Open a race with the Arduino box in use and a Trackmate connected as well: the race counts laps from the box only, and the status line above the cars names the box.

Good to know:
1. A hardware that is not the one in use is simply ignored by races and by Home. Changing the choice disconnects the one that was in use.
2. Nothing chosen yet means what you had set up: the Trackmate, unless the virtual box is ticked or only a box is remembered. If you never use hardware, choose **None**: then Start race never asks.
3. A box that connects *after* the race screen opened is not picked up by that race (connect first, then Start race; that is what the question is for).
4. DS Electronics and oXigen Digital are not in the list yet: they cannot count laps.

## What to try (1.39.1): the big check-up
Nothing new on the screens: this version fixes faults that a line-by-line check of the whole app found. A few you can see for yourself:
1. Database > Drivers > Add driver. Type a name and **double-click Save** fast: there is one driver, not two. The same goes for every form, the Layout Editor, picture sets, rotation setups and audio sets.
2. Database > Results and Records: the line of a **Qualifying** or **Free practice** now says **Fastest: Alex** (it said *Winner*). Delete the driver who won a race and the runner-up is not called the winner any more (Home shows them second).
3. On a track, type the lane lengths as **15,4  15,8** (a decimal comma, a space between the numbers): they are 15.4 and 15.8 m. In the Adjust pad lists and the token minutes *0,5* is 0.5, and *1, 3, 10* is still a list of three.
4. On the race screen hold down a number key or **Space**: it counts once, not again and again. The number keys also work on a French keyboard and on the number pad.
5. Race Setup with **Heats** where each heat is limited by **Time** and the result is counted by **Total race time**: the table counts the laps (Help says so) and shows a score instead of *not finished*.
6. Export a race that ended at 00:30 to a PDF: the file name has the date you see on the page, not the day before.
7. Arduino box (firmware **1.0.4**, download the sketch again from the Arduino page and upload it): a car that stays on a pit sensor for 8 seconds now gives a pit time of 8 seconds, and the next car that enters the pit is seen.

Good to know:
1. The database file is written to a temporary file first and then renamed, and a file that cannot be read is never replaced by an empty one: the app says so and does not start. Nothing in your data changes.
2. Not changed on purpose: pictures stored at full size make the database file big (App Settings > General > Pictures has a smaller quality); the web page of the LAN share has a 0.6 s delay per wrong password but no lock-out; a track without lanes can still be saved (Home flags it).
3. Firmware 1.0.4 changes nothing in how the box talks: an older app works with it and the other way round.

## What to try (1.39.2): firmware 1.0.5, buffered laps in "ms ago"
Only for the Arduino box (App Settings > Timing Hardware > Arduino). Nothing changes on the screens.
1. Download the sketch from the Arduino page again and upload it to the box. After Connect the box reports version **1.0.5** (the virtual box does too).
2. Race with the box as usual: laps are timed as before. The case this version fixes (a lap the box buffered while the PC was away, on a board that did not restart when the port opened) is hard to make by hand; it is covered by the bench (`node tools/fwhost/run.js`, section 12: 500 s of uptime, 0 ms off) and by the tests.
3. An older box (1.0.4 or earlier) still works with this app: the app reads its version and takes the old absolute times.

Good to know:
1. Firmware 1.0.5 needs this app (1.39.2 or newer): an older app with a 1.0.5 box places a buffered lap near the start of the connection. That is only about the rare laps driven while the PC was away; normal timing is the same with any combination. The sketch from the Arduino page always matches the app you downloaded it from.
2. It only makes a difference for a lap the box buffered while the PC was away, and then only for a board that did not restart when the port was opened (the Nano and Mega normally do).

## What to try (1.39.3): a vertical Fuel bar
1. Layout Editor: add a **Fuel Level** widget (Timing group) and, in the side panel, keep **Show fuel as** on *Bar and number*. Under it are two new settings: **Bar direction** (*Vertical* fills the bar from the bottom and empties it downwards) and **Bar thickness** (10 to 100% of the widget).
2. Make the widget tall and narrow (for example 60 wide, 200 high) and choose Vertical: a fuel gauge standing up. Make it big and small: the bar, its rounded corners and the number in it grow and shrink with the widget, and the number is never cut off.
3. A Fuel widget you already had looks the same in a wide, low shape. In a tall widget the horizontal bar is now thinner than before (a share of the widget's smaller side); set the thickness to taste. The warning and critical colours work in both directions. *Number* and *Pictures* have no bar, so they do not show the two settings.

Good to know:
1. The number in a very narrow vertical bar gets small (it has to fit the width of the bar). Use *Bar* without the number, or a second Fuel widget set to *Number*, if you want it big.

## What to try (1.40.0): Tyre Wear, release 1
Tyres now wear out. A tyre wear system gives every tyre a life from 100% to 0%; a fresh set goes on in every pit stop; new tyres help the car and worn ones hinder it. This is release 1 of three: the rules, the pages, the widget and the cells. (Tyre sets and the "next stop" queue come in release 2; audio calls and the results page come in release 3.)

1. **Race Setup > Tyre Wear Systems** (a new tab between Damage Systems and Weather Systems). Add one: it starts as the **Standard** system. The table has the six tyres with four numbers each: **Wear per lap (%)**, **Fresh bonus (%)**, **Grip drops from (% life left)** and **Hindrance at 0% (%)**, and what a new set lasts. Press **Sprint** or **Endurance** to start from those numbers, and change any number. Under the table is the **grip curve** of one tyre (press *Curve* or type in its row).
2. **Wear is counted per** lap or **per distance** (per 100 m, or 100 ft when App Settings say feet): the right choice for Distance Racing, where the widgets then say how many metres of tyre are left. Under *Wear in the weather* is a table of how much faster or slower a tyre wears in dry, cloudy, wet and clearing weather (Inter and Wet tyres wear slower in the rain).
3. **What worn tyres do**: through the fuel rules (fuel used in a lap, refuelling speed, tank size; the same way as Balance of Power and the weather, added together, never more than 90%), and what happens at **0%**: nothing, penalty points every lap, the lap does not count until the car pits, or the car retires. The 0% rule works without a Fuel setup.
4. **Pit stops**: *Changing tyres takes* some seconds (0 = no time), at the same time as refuelling and repair or one after the other. A car that leaves before the time is up keeps its worn tyres. Practice and qualifying can have tyre wear too (the *Where it applies* folder); a race, a timed race, heats and an Endurance Race always do, and a Time Token Session never.
5. In **Race Setup > Race Setups**, folder **Racing Systems** (called Rule sets before 1.42.0), choose the **Tyre wear system** (after Weather system). Start a race: every car begins on fresh tyres, every heat again.
6. The **Tyre Change** folder (race screen and Race Director page) now has **Life**, **Left**, **Grip effect** and **State** (Driving, Box soon, Box now, Fitting...) for every lane, with a bar that turns amber and red at the warning levels of the system.
7. Layout Editor, folder **Weather**: the new **Tyre Degradation** widget. *Show the tyre life as*: **The tyre wears away** (the tread gets shorter), **The tyre picture with a ring** (your own tyres from a picture set, with a ring that empties), **A bar** (horizontal or vertical, the bar of the Fuel widget) or **A number only**. Switches for the percentage, the laps (or metres) left, the grip effect, the name of the tyre and *BOX NOW* at 0%, and the three colours.
8. The **Leaderboard** widget has a new column **Tyre life** (a chip, the life and a small bar), and the **Driver stats** grid has two new cells, **Tyre life** and **Tyre laps left**. The Home tab's rules card says which tyre wear system a race has.

Good to know:
1. Measured lap times, best laps and records are never changed by tyre wear. The wear shows in the fuel use, the pit stops, the penalty points, the lap that does not count, or the retirement.
2. The grip effect needs a **Fuel setup** in the race setup (it works through the fuel rules). Without one the tyres still wear, the widgets still show the life, and the 0% rule still works; the grip effect is then left out.
3. In a system that counts per distance, a lane that has no length counts every lap as 100 m (100 ft). Set the lane lengths of the track (Database > Tracks) for a real distance.
4. If you delete a tyre wear system that a race setup uses, that setup has no tyre wear afterwards (nothing else in it changes).

## What to try (1.41.0): Tyre Wear, release 2 (sets, next stop, Available Tyres)

1. **Race Setup > Tyre Wear Systems**, open a system (or make a new one): the new folder **Sets of tyres**. *The sets belong to*: **No limit** (every stop gives fresh tyres, as before), **Each car** or **The team**. Under it a number of sets for each tyre; the set a car starts on counts as one, and 0 means that tyre is not allowed in the race.
2. Start a race with that system. The **Tyre Change** folder (race screen and Race Director page) now shows **Sets left** for every car and a **Next stop** list. Pick a tyre in the list: the note under it says *Queued by the Race Director*. In the next pit stop that tyre goes on and one set comes out of the box.
3. With a weather system: when it rains the list says *Wet from the weather* and the stop gives Wet tyres (from the Wet sets); the tyre you queued goes on in the stop after. Intermediate and Wet cannot be queued, they come from the weather.
4. A tyre with no sets left is greyed out in the list and cannot be queued. If the set you queued is gone by the time of the stop (a team-mate took it), the car gets its own tyre, or a dry tyre that is left; when nothing is left it keeps its worn tyres.
5. **Correct the tyres now** (under the table) is the instant tyre change of before: use it when the car really has other tyres than the race thinks. It moves a set in the box and keeps the life of the tyres.
6. Layout Editor, folder **Weather**: the new **Available Tyres** widget (one per lane). *Show the sets as*: tyres with a number, tyres with a dot for each set, a list, or a number only. Switches for the ring on the tyre that is on the car, **NEXT**, dimming, hiding the tyres a race does not allow, and the team name.

Good to know:
1. A Tyre Wear System from before 1.41.0 has no sets: it opens as **No limit** and behaves as it did. New systems start with **Each car** and 2 2 2 1 2 2 sets.
2. With **The team**, the cars of a team share one box. A car that is not in a team always has a box of its own.
3. Every heat starts with full boxes. An interrupted race comes back with the boxes, the queue and the tyres as they were.
4. The audio calls for tyre wear and the tyre stints in the results came in release 3 (1.42.0, below).

## What to try (1.42.0): Tyre Wear, release 3 (audio calls, tyre stints in the results)

1. **Race Setup > Race Setups**: the folder that was called **Rule sets** is now **Racing Systems** (the tab **Racing Rules** is where you write the rules of your club). Nothing in the folder moved.
2. **Race Setup > Tyre Wear Systems**, folder **Warnings** (it was called *Warning colours*): three new numbers, **Audio call at this life (%)**, 50, 25 and 10 to begin with. A box you empty is no call at that level. The colours of the widgets are still set by the amber and red levels above them.
3. **Customization > Audio Settings**, open a set: a new folder **Tyre wear** with six calls, each with two sentences and each can be switched off: a wear level (*Alex, tyres at 46 percent*; you can use {driver} {tyre} {percent} {left}), worn out tyres, new tyres (said when the change is done, with {sets}), the last set of a tyre, a tyre queued by the Race Director, and a car that left the pits too early.
4. Race with a tyre wear system and that audio set. When the life of a set goes down to a level it is said, once for every set; after the stop the levels count again for the new set. {left} says *14 laps*, or *205 metres* (feet) in a Distance Race.
5. After the race, **Database > Results**, open the race: under the table are the **Tyre stints**. Every set is a bar in the colour of the tyre, with its laps (*S . 9 laps*) and under it the life that was left when it came off (*off: 18%*) or at the flag (*flag: 31%*), coloured by the levels of the system. At the end of the line: the stops, the time the tyres took in the pits and the laps on worn out tyres (red when there are some). All bars are on one scale, so a car that stopped early has a shorter strip.
6. The result table has a new column **Tyres** (the tyre at the flag). A heat race has a strip for every heat (and final), each heat on fresh tyres. A Distance Race counts the bars in metres (feet): *S . 120 m*.
7. The two switches above the bars: **Show the tyre stints under the results** and **Show the laps on worn tyres (0%) in red** (a red hatched end on the bar). **Export to PDF** has a box **Tyre stints** (on to begin with) and the Tyres column in its list of columns.

Good to know:
1. Only races with a tyre wear system get this. The results of every other race, and of races from before 1.42.0, look as they did. The Slotcar statistics page has no tyre information.
2. An audio set from before 1.42.0 does not have these six calls; it says them with the ready-made sentences. Open the set and save it to change them, or to switch one off.
3. A race that comes back after an interruption carries on without level calls if it was started before 1.42.0.
4. When it rains, a stop can have two calls: *new tyres* (Tyre wear) and the tyre change of the weather (Weather). Switch one of them off if you find it too much.
5. Lap times, best laps, records and the lap chart are the measured values; the wear only shows as the stints.

## What to try (1.42.1): widget folders and clearer widget names

1. **Layout Editor**, the **Add widget** list: the 68 widgets are in **11 folders** now, always in this order: **Race**, **Driver**, **Slotcar**, **Team and Swaps**, **Position and Progress**, **Lap Times and Records**, **Delta Timers**, **Tyres**, **Weather**, **Custom** (only when you have widgets of your own) and **Controls**. Open a folder to see its widgets; the folders start closed.
2. What is in them: **Race** has the Race Clock, Race Lap Counter, Token Clock, Start Lights, Race Flag, Race Info, Leaderboard, Heat List and Logo. **Driver** has the name, nickname, callsign, avatar, flag and the lane colour. **Slotcar** now also holds what used to be in the folder *Car status* (Fuel Level, Damage, Repair Timer, Penalty Points, Balance of Power, Slotcar Speed) next to the Slotcar Picture and the Slotcar Name. **Team and Swaps** has the team, the driver at the wheel, the next driver and the swap widgets. **Position and Progress** has the position, the gap, the lap number, laps to go, the distance and the championship points. **Lap Times and Records** has the lap time widgets, the averages, the pitstop time and the three records. **Tyres** has Current Tyres, Tyre Degradation and Available Tyres. **Weather** has the forecast and the track conditions.
3. Names that changed, so each one says what it shows: Name, Nickname, Callsign, Avatar are now **Driver Name**, **Driver Nickname**, **Driver Callsign**, **Driver Avatar**; Swap Timer and Swap Signal are **Driver Swap Timer** and **Driver Swap Signal**; Slotcar Description is **Slotcar Name**; Lap of Lap is **Lap Number**; Laptime is **Current Lap Time**; Last lap is **Lap Times List**; Record Lap Time is **Personal Best Lap**; Laptime Delta is **Lap Time Delta**; Race Laps is **Race Lap Counter**; Tyres is **Current Tyres**; the control widgets are called **Start Button**, **Pause / Resume Button**, **Stop Button**, **Yellow Flag Button** and **Red Flag Button**.
4. The folders that went: *Timing*, *Timing Records*, *Distance*, *Time Tokens*, *Team* and the old *Car status*/*Slotcar* split. Their widgets are in the folders above.

Good to know:
1. **Nothing changes on a timing page.** The title a widget shows on the screen is still the one it had (Lap time, Last lap, Nickname, ...), and a title you typed yourself is yours. Only the names in the Add widget list changed.
2. **Saved layouts keep working**: a layout remembers the kind of widget, not its folder or its name in the list.
3. The Help page and the tests use the new names. The Delta Timers folder is as it was (the first widget is now called Lap Time Delta).

## What to try (1.43.0): Car Failures, release 1 (random failures, the stop that clears them, the Car Failure widget)

1. **Race Setup > Damage Systems**, open a system: a new folder **Car Failures** (between *Incidents* and *Fines*). **Car Failures** is **Off** to begin with; switch it on to see the rest. A system you saved before 1.43.0 stays as it was until you do.
2. The table **The failures** has the four standard ones: **Lift and Coast** (level *Light damage*, 10%, 5 s), **Slow Puncture** (*Heavy damage*, 5%, 10 s), **Brakes not working** (*Heavy damage*, 4%, 15 s) and **Engine Failure, Box to Retire** (*Critical damage*, 2%, 0 s). A failure has a **Name**, a **Level**, a **Chance (%)** and **Stand still (s)**; **Add a failure** adds a row, **Remove** takes one away, **Add the standard failures** brings back the ones you removed. The **Level** is one of the levels of the same system: the failure uses its rules (pit *whenever you can* or *as fast as you can*, the deadline in laps, and whether the stop repairs, retires or disqualifies the car). Rename a level and the failures that use it follow.
3. The chance is the chance that **a car gets that failure at some point in the race**: 5% is about 1 car in 20 per race. It is rolled for every car when the race starts, and nobody can see it coming. The moment is random between **Earliest moment of a failure** and **Latest moment of a failure** (10% and 90% of the race to begin with), in a race with laps and in a timed race, and never in the first or the last lap. **Failures for a car in a race, at most** (1 to begin with) is the limit per car.
4. **Database > Slot Cars**, group Technical: **Failure factor (for Car Failures)**. 1 is like the others, 2 is twice the chance, 0 means this car never has a failure.
5. Race with a damage system that has Car Failures and try a race with a few cars (**Simulated cars** works). A car that gets a failure shows it at its moment; to pit for it, stand still on the pit sensor for the **Stand still (s)** of the failure. A failure adds **no damage points**. If the car also has damage, one stop clears both, and the stand still lasts as long as the longest job (or both after each other, when the damage system says the repair comes after the other work).
6. **Race Director page** and the log under the race: *Alex has a failure: Slow Puncture*, *Alex repaired: Slow Puncture (10 s in the pits)*, *Alex is late for the pits (Slow Puncture), +1 penalty point*, *Alex left the pits before the failure was cleared*, and *Alex is retired by a failure (Engine Failure, Box to Retire)*. With a penalty system on, leaving too early and a lap after the deadline cost penalty points, like damage does.
7. **Layout Editor**, folder **Slotcar**: the widget **Car Failure** (after Repair Timer). It shows the name and what it asks (*Slow Puncture . Pit in 2 laps*, amber to pit whenever you can, red as fast as you can or when the car is late, green with the countdown while it is being repaired, and *RETIRED* or *DQ* in grey or red). Its settings: show only the name, the text for a car without failure (or nothing), and the five colours. The **Repair Timer** counts the stand still of a failure down too. In a custom text: **{failure}** (the failure now: *Slow Puncture*, *No failure*) and **{failures}** (the failures the car has had).

Good to know:
1. This is release 1 of Car Failures. **Not in yet** (next release): the audio calls (a folder *Car Failures* in an audio set), the failures in the results and the PDF, and buttons on the Race Director page to give a car a failure or clear one by hand.
2. A damage system without Car Failures, and every race from before 1.43.0, work exactly as before. The failure is a separate state from the damage points: the Damage widget and {damage} do not count it.
3. A race that is interrupted and continued keeps the failures that were rolled and the ones that are going on. A viewer on a phone or another screen (Live Race) sees the failure of a car in the Car Failure widget.
4. Until the audio calls are in, a late failure or an early leave is said like any other penalty, with the ready-made penalty sentence.
5. A failure whose level is not found in the system (you removed or renamed the level yourself) asks the least: pit whenever you can, no deadline, a repair. The table says *(no such level)*.

## What to try (1.44.0): Car Failures, release 2 (Race Director buttons, audio calls, failures in the results)

1. Race with a Damage System that has **Car Failures** switched on (see 1.43.0). On the race screen there is a new red folder **Car Failures**, right after **Damage**. It has a row for every lane: the car, its failure (or *No failure*), what it asks (*Pit in 3 laps, 8 seconds in the pits*, or the clock while it is being repaired) and two controls: a list with **At random** and the failures of the system (with their chances), and a **Give** button; and a **Clear** button.
2. **Give**: while the race runs (or is paused) pick a failure in the list and press **Give**: the car has it now, as if it had been rolled. **At random** takes one by the chances of the list. A car can be given a failure when it has none, is not standing on the pit sensor and is still racing. It counts as a failure of the car; the ones that were rolled for it at the start still come later (the limit *Failures for a car in a race, at most* is for the rolled ones only).
3. **Clear**: takes the failure of the car away without a stop in the pits, with no penalty (a mistake, or a car that must not stop). If a failure **retired or disqualified** a car, **Clear** brings it back in the race, like taking back the damage points that put a car out (a car that has too many penalty points stays out).
4. **Live Race > Race Director** (and a phone on the wifi): the same folder **Car Failures** with the same list and buttons. The log in the **Penalties** folder says *Alex has a failure: Slow Puncture (given by the Race Director)* and *Alex: failure cleared by the Race Director (Slow Puncture)*.
5. **Customization > Audio Settings**, open a set: a new folder **Car Failures** (after *Damage*) with seven calls, all on to begin with, each with two sentences: a failure that asks for a stop (*{driver}, {failure}! Pit {when}*, with {repair} too), a failure that ends the race, late for the pits, left the pits too early, the failure is cleared (said when the stop is done), retired by a failure and disqualified by a failure. The new word is **{failure}** (the name of the failure). The penalty points for a late or early car are part of those calls and are not said a second time as an ordinary penalty. A failure that the Race Director clears says nothing.
6. After the race, **Database > Results**, open the race: behind the name of a car that had failures: *Failures: Slow Puncture (repaired, 10 seconds in the pits), Lift and Coast (not repaired), late for the pits once, left the pits too early once*. A failure the Race Director cleared says *(cleared by the Race Director)*; a car that was put out says *(retired by a failure)* after its name. The review at the end of the race has the same *Failures:* line under the name, and **Export to PDF** has it too.
7. A heat race: every heat says what the failures did to each car, and the overall result adds them up (*3 failures in 2 heats, 1 repaired (8 seconds in the pits), retired by a failure in 1 heat*).

Good to know:
1. Only races with Car Failures get this. The results of every other race, and of races from before 1.44.0, look as they did.
2. An audio set from before 1.44.0 does not have these seven calls; it says them with the ready-made sentences. Open the set and save it to change them or switch one off.
3. A failure that the Race Director gives is announced like any other (the audio call and the log say so; the log adds *given by the Race Director*).
4. Not in (it was not asked for): a failure column in the Leaderboard, a card on the Home tab, and failure figures on the Slotcar statistics page.
## What to try (1.45.0): the Race Setup sub-tabs as coloured buttons, and adding and taking out participants

1. Open the **Race Setup** tab. The sub-tabs are coloured buttons now. **Race Setups** is the big red button on the left (the colour of your theme), with the words *Where it all comes together*. The others are in three groups: **Systems** (Penalty yellow, Damage red, Tyre Wear purple, Weather blue), **Setups** (Rotation brown, Fuel green) and **Extras** (Balance of Power white, Time Tokens teal). Each has the colour of its folder on the race screen.
2. Click through them. The one that is open is stronger (a stronger tint, a line under it), the big button gets a ring when it is open, and the page under the strip gets a line at the top in the same colour. Try the **Light** theme (the colours are darker) and make the window narrow (the big button goes full width and the groups go under each other).
3. **Rotation Setups**: open a rotation (or make one). The **Participants** box in the Size bar was always 2 to 64 (8 is only where a new rotation starts). Above the participants there is a new button **Add a participant**: it adds P9 at the end, in no heat yet, and puts the cursor in its name.
4. Under **Names of the participants** (open to begin with; if you close it, it stays closed) every participant has a **×**. Press it on a participant who is in a heat: it asks first (*Sam is in 1 heat. Taking them out removes them from that heat, and everybody after them moves up one number. Undo brings them back.*). Yes: they are gone from the heats, their name is gone, they leave their groups, and the participants after them move up one number and keep their lanes. **Undo** brings it all back. A participant who is in no heat goes at once.
5. The **×** is off when there are 2 participants, and **Add a participant** is off at 64. For 24 people: type 24 in **Participants**, or press Add 16 times; **Start from a plan** makes the heats.

Good to know:
1. The tab order inside the strip is Race Setups, Systems, Setups, Extras (it was Setups before Systems). The sub-tabs have the same names and work as before.
2. Both designs (A is built, B is a list down the left side for when there are many more systems) are in `docs/ui-reference/race-setup-tabs`.

## What to try (1.46.0): Soft lift (depth in the whole app) and a border colour and thickness for widgets

1. Open the **Race** screen (or any tab). Cards, folders, buttons and the widgets of your layouts stand up from the page a little: a light edge on top, a thin lip underneath, a soft shadow. Text fields are a little sunk. Press and hold a button: it moves down.
2. **App Settings > General > Display > Depth**: **Flat (no depth)** is the look of before (and a little lighter for a slow computer such as a Raspberry Pi), **Soft lift (standard)** is the design you chose, **Medium** and **Thick card** (design B) are stronger. The change is at once, also in the Live Race window and on a phone that follows the race.
3. Try the themes (**App Theme**): dark, carbon, light, ocean, and a Custom theme with a light panel. In the light ones the lip and the shadow are lighter.
4. **Customization > Layout Editor**: select a widget. In the frame settings, **Border** has **Colour of your own**: pick any colour. **Border thickness** (0 to 40, in half steps; empty is the standard thin line): the border grows and shrinks with the page like the text does, also in the full screen widget view and the Live Race pages. The thickness works with every kind of border (the theme's, a shade, your colour). Select several widgets to set them all at once. A layout from before looks as it did.
5. Set **Transparency** of a widget to 60: its depth fades with it, a see-through widget stays flat.

Good to know:
1. Only the look changes: no setting of a race, a layout or a result is touched. The border colour and thickness are saved in the layout, so they go along with an export.
2. The depth is made with shadows only, so it works on any colour. The cells of a leaderboard row design stay flat, and the button widgets (Start, Pause and the like) are shallow buttons that move down when you press them.
3. Not verified in the full Electron window (the real stylesheet was checked in a browser against the real screens). Design option **B** (a side rail) of the Race Setup tabs and the label names are not touched.
4. The design and the pictures are in `docs/ui-reference/depth`.

## What to try (1.46.1): placing widgets exactly (a smaller magnet, Ctrl for the grid only, pink lines, Tidy to grid)

1. **Customization > Layout Editor**, drag a widget. The magnet that pulls an edge to another widget or a guideline reaches **3 units** now (it was 8, more than one grid step of 5, so near an edge the magnets beat the grid almost everywhere). The grid has the say again unless an edge is really close.
2. While you drag (or resize), a **pink line** is drawn where an edge of the widget lines up exactly with an edge of another widget or with a guideline. It is gone when you let go.
3. Hold **Ctrl** (**Cmd** on a Mac) while you drag or resize: the widget snaps to the **grid only**, no magnets, no guidelines. You can press and release it during the drag. With **Snap to grid, widgets and guidelines** unticked nothing snaps (the pink lines still show an exact alignment).
4. Select a widget (or several) and open **Arrange** in the side panel: **Tidy to grid** moves every edge to the nearest grid line (the page's own edge when that is closer), so widgets that touched still touch. With nothing selected the button is **Tidy all widgets to the grid**. The default layout has 57 widgets and 53 of them had an edge off the grid (a height of 58, for example); one press of Tidy all fixes them. **Undo** puts everything back in one step.

Good to know:
1. A layout you made before is not touched until you press Tidy. Tidy can make a widget up to 5 units bigger or smaller (58 high becomes 60), because every edge goes to its own nearest grid line; that keeps the gaps between widgets even.
2. The magnet is still there (3 units): an edge that is not on the grid, as in the default layout, still pulls a widget that comes close. Hold Ctrl or tidy the layout when you want the grid.
3. Coming next (1.47.0): align and distribute, resizing several widgets at once and mirroring a copy for the other side of the page.
4. Not verified in the full Electron window (the real editor was driven with the mouse in a browser, with the real stylesheet).

## What to try (1.47.0): arranging several widgets (align, spread out, one size, mirror, resize together)

1. **Customization > Layout Editor**: select several widgets (Shift-click, drag a rectangle, or Ctrl+A). Open **Arrange** in the side panel. **Align** Left / Center / Right / Top / Middle / Bottom lines them up with the box that holds the selection; with **one** widget selected it lines up with the page (center a widget with one click). **Spread out evenly** (three or more) puts the same gap between them, across or down; the outer two stay where they are. **Same size for all**: type a Width or Height and every selected widget gets it (a widget stops at the edge of the page).
2. A dashed blue **frame with four handles** is drawn round the selection. Drag a corner: **all the widgets are resized together**, each keeping its place in the frame. It snaps like one widget does: to the grid and the magnets, **Ctrl** (Cmd) for the grid only, pink lines when an edge lines up.
3. **Mirror**: **In the selection** swaps left and right inside the frame (a row that reads A B C becomes C B A), **Flip top to bottom** does the same up and down, **Across the page** moves each widget to the other side of the middle of the page. For a symmetrical layout: select a lane's widgets, press **Duplicate** (copies for the next lane), then **Across the page**.
4. Mirroring left to right (the first and the third) also **swaps left and right text alignment** (a title on the left goes right; text in the center stays) and **flips the pictures** of the slotcar picture, the avatar and the race flag (their Mirror setting). Mirror twice and you are back where you started.
5. Each of these is one step: **Undo** brings it all back.

Good to know:
1. Several widgets are resized with the frame by scaling their edges: an edge that is the edge of the frame goes exactly where the frame's edge went, the others go to the grid (to whole units with Snap off). Text sizes are not changed (they follow the widget as before). A widget never gets smaller than 5 units or leaves the page.
2. Align to the center can give a half unit (a widget of 51 is placed at 474.5); **Tidy to grid** puts it on the grid if you want that.
3. The widgets on the layout do not have to be in a row: **Spread out** looks at their places (left to right, or top to bottom) and keeps the order. It says so when the widgets are wider together than the room between the outer two.
4. Not verified in the full Electron window (the real editor was driven with the mouse in a browser, with the real stylesheet).

## What to try (1.47.1): the Race Setup pages (no stripe, a coloured Add button, icons on the cards, a smaller Race Setups button)

What changed: the Race Setup pages, after you looked at the redesigned tab.

1. Open **Race Setup**. The **coloured stripe** under the buttons is gone.
2. Click through the sub-tabs. The button that adds one (*Add penalty system*, *Add damage system*, *Add tyre wear system*, *Add weather system*, *Add fuel setup*, *New rotation setup*, *Add race setup*) is in the **colour of the sub-tab**: yellow, red, purple, blue, green, brown, and the colour of your theme for Race Setups. Try a light theme too: the colours are darker there and the text on them is white.
3. Switch a page to **Grid**. A card without a picture shows the **icon** of the system or setup (the warning sign, the spanner, the tyre, the cloud, the fuel pump, the flag) in the colour of its sub-tab, instead of a red square with a letter. A race setup whose track has a picture still shows that picture.
4. The big **Race Setups** button is **smaller** (and no longer as tall as the groups next to it).

Good to know:
1. Only the main button of a page takes the colour of the sub-tab. The forms that open in a window (*Add tyre wear system* opens one) keep the colour of your theme, and so does the highlighted **Grid** / **List** switch. Say so if you want those in the colour of the sub-tab too.
2. The Database pages (Drivers, Slotcars, Tracks, Teams) keep the first letter of the name on a coloured square when there is no picture; the icon is only for the Race Setup pages.
3. Not verified in the full Electron window (the real stylesheet was drawn in a browser, dark and light, for every sub-tab).

## What to try (1.47.2): the windows of the Race Setup pages in the colour of the sub-tab

What changed: after 1.47.1 only the Add button had the colour of the sub-tab; now the windows have it too.

1. **Race Setup > Tyre Wear Systems > Add tyre wear system.** The window is **purple**: the folders (their header, the bar on the left and the arrow) and the **Save** button. Try the other sub-tabs: Penalty yellow, Damage red, Weather blue, Fuel green. On a light theme the colours are darker and the text on the Save button is white.
2. **Extra fields…** (the button next to Add) opens a window in the same colour.
3. The **Grid / List** switch on these pages has the colour of the sub-tab too.

Good to know:
1. **Race Setups** (the red one) keeps the colour of your theme in its window, because that is the colour of its button. The Database forms (drivers, slotcars, tracks, teams) keep the colour of your theme too.
2. The Rotation Setups page is not a window (it is a page of its own) and has no folders; its Save button already had the brown.
3. Not verified in the full Electron window (the forms were opened in a browser with the real stylesheet, dark and light).

## What to try (1.48.0): Ambient Race Sounds (release 1)

What changed: every audio set has a new folder, **Ambient Race Sounds**, with 15 sounds that make a race feel real: a car passing when a lap is set, the pit crew at work, the start, the flags, the crowd. **No sounds are included**: you add your own sound files and each one plays at its moment of the race. They play on a **separate channel**, so the spoken calls (the voice) can play over them at the same time.

1. **Customization > Audio Settings > New audio set** (or Edit a set). The folder is the last one, below the folders of the spoken calls. Hold the mouse over its name: the tooltip says that these sounds play on a separate channel. Open it: six sections (On the track, Pit lane, The start, Flags, Race moments, The crowd).
2. Under **A car crosses the line (a lap is set)** press **Add a sound file**, choose a file with a car passing and press **Test**. **Played for** chooses the cars: **every car**, **only the leader** or **only cars close together** (the gap to the car in front, or the time the car behind is late, is under the number of seconds you fill in; 3 when empty).
3. Start a race with that set: every time a car sets a lap, the sound plays. Say a call at the same time (a new leader, a flag): the sound is **lowered while the voice speaks** (to 35 percent, you set how far) and comes back when it is done. The tick box at the top of the folder turns the lowering off. The folder also has the **volume** of all the ambient sounds (80 percent to start with) and **most sounds at once** (6: the oldest one stops to make room).
4. A pit stop has three sounds: **a car stops in the pits** (braking, tyre squeal), **the pit crew at work** (wheel guns, tools) and **a car leaves the pits** (pulls away). The pit crew sound stops when that car leaves the pits, unless you untick **stop it when the car leaves the pits**.
5. The others: the start is pressed (before the lights), a start light (a beep), lights out (engines roar), yellow, red and green flag, the last lap (the bell), the finish of a race, a heat or a final (the horn, the crowd), a new leader (the crowd roars), the fastest lap or a track record (applause) and a driver who moves up a place (ooh).
6. Every sound has its own **Volume** (percent) and **Start after** (seconds). A sound can have **several files** (one is picked at random each time), and the **Only if** box under a file gives a driver a file of his own (his own engine for his own car). The sounds that can come quickly after each other (a passing car, a new leader, the fastest lap, a move up) have **Not again within**, for the whole sound or for each driver.
7. Not ticked, or without a file, a sound stays silent. **Test** plays a file as it will sound in the race (with the volume of the folder and of the sound).

Good to know:
1. The files are kept inside the database like the sound files of sentences (up to 10 MB each), so short files are best. They play on the computer that runs the race, like the voice.
2. A sound plays even when the spoken call of the same moment is off; the two do not depend on each other.
3. Later (not in this version): sounds for damage, failures, tokens, the winner and the podium, the heat horn and pit work such as refuelling; and sounds that keep playing in the background (crowd murmur, rain, thunder) with their own start and stop. A different sound for every car is possible already with **Only if**; a sound that moves from left to right was not asked for.
4. Not verified in the full Electron window or with real sound files: the channel was tested with a stand-in player (volume, lowering, cutting, waiting, the limit), and the folder was looked at in a browser. The files play with the same player as the sound files of sentences.

## What to try (1.49.0): Ambient Race Sounds, release 2 (trouble, pit work, winner, swaps and tokens)

What changed: the folder **Ambient Race Sounds** of an audio set (Customization > Audio Settings, the last folder) has **17 more sounds**, 32 in all. Everything about how they play is as in 1.48.0 (own channel, the voice can speak over them, the volume of the folder, lowering while a call is spoken, most sounds at once, volume and start after for every sound). Still no sounds included: you add the files.

1. **Trouble** (a new section): **a car takes a hit** (a crash, a crunch), **a car is in critical trouble** (an alarm: a critical damage level or a critical failure), **a car has a failure** (a bang, a hiss), **fuel is running low**, **a car runs out of fuel**, **a penalty is given** (a short buzzer) and **a car is out of the race** (retired by damage or a failure, thrown out, or disqualified). The hit and the penalty can come quickly after each other, so they have **Not again within**.
2. **Pit lane** has three more, for the moment the stop ends: **a car has been refuelled**, **new tyres have been fitted** (new tyres after a stop, or the tyres for the weather) and **a repair is done** (a damage repair or a failure repair). The pit crew sound of 1.48.0 still plays from the moment the car stops until it leaves.
3. **Race moments** has **the winner** (a fanfare), **the second and third place** (applause, once for each) and **the next heat or final is about to start** (the heat horn).
4. **Driver swaps and time tokens** (a new section): **a driver swap is due** (a bell), **a driver swap is done**, **the time of a lane is almost up** and **the time of a lane is up** (buzzers, in a Time Token Session). The **Only if** box of the two token sounds has only the driver, because a token session has no places or gaps.
5. Try it: add a sound file to **a car runs out of fuel** and to **the winner**, race with the set, and run a car out of fuel. The sound plays when the engine stops, together with the spoken call (if it is on). A sound plays even when the call of the same moment is off.

Good to know:
1. The folder is long now (32 sounds, in 8 sections). **Open all folders** and the browser's find (Ctrl+F) help; say so if you would like the sections to open and close like folders.
2. The refuel, tyre and repair sounds play when the stop is over (that is when the race knows it was done), not while the work is going on; the pit crew sound is the one for that.
3. Still to come (release 3): sounds that keep playing in the background (crowd murmur, the paddock, rain, thunder), with their own start and stop.
4. Not verified in the full Electron window or with real sound files. The new sounds were tested by running a short race through the channel and by checking in the code that every moment a sound waits for is really made by the race.

## What to try (1.50.0): the sections as folders, and Ambient Race Sounds release 3 (sounds that keep playing)

What changed, in two parts. **Part 1:** the ten sections of the folder **Ambient Race Sounds** are folders of their own, closed to start (you asked for that). **Part 2:** five new sounds that **keep playing in the background** from one moment of the race to another: the paddock, the crowd, thunder, rain and dry weather. That makes 37 sounds. Still no sounds included: you add the files.

1. **Customization > Audio Settings > a set > Ambient Race Sounds.** Open it: ten closed folders (On the track, Pit lane, The start, Flags, Race moments, The crowd, Trouble, Driver swaps and time tokens, Background sounds, Weather). Each header says how many of its sounds have a file, so you see at once where you have been. Open the ones you need: they stay open while you work in the set. **Open all folders** and **Close all folders** at the top include them. A set you open next has them closed again.
2. **Background sounds** has two sounds that play again and again: **the paddock** (from the pre-race call, or from the end of a heat or a final, until the lights go out) and **the crowd during the race** (from lights out until the race, the heat or the final is finished). Add a file to each and race: at lights out the paddock fades out while the crowd fades in; at the finish the crowd fades out.
3. Under each of them: **Fade in (seconds)** and **Fade out (seconds)**. Empty is the usual, 2 seconds in and 3 out; 0 is no fade at all. The volume, the wait (start after) and the "lower them while a call is spoken" of the folder work for them too.
4. **Weather** (a race with a Weather System) has **the rain starts** (a clap of thunder, once), **rain** (plays for as long as the weather is wet) and **dry weather** (birds, a light breeze: plays for as long as it is dry, from lights out in a race that starts dry). They end when the weather changes, and at the finish. When the weather changes back while a sound fades out, it fades back in.
5. **Test** on a sound that keeps playing plays the file once, at the volume it will have.

Good to know:
1. A file that keeps playing should join up well at its end and its start (a loop). A short file is fine; the longer, the less you hear it repeat.
2. These sounds are not counted in **Most sounds at once**; they play once at a time (a second start does nothing); and they are lowered while a call is spoken like the others.
3. Pausing the race does not pause them yet, and a red flag does not stop them. The pit lane has no background sound (the pit crew sound is for each car).
4. Not verified in the full Electron window or with real sound files. The fades were tested with a stand-in clock (every step of a tenth of a second), the folders in a browser (dark and light).

## What to try (1.51.0): the same sub-tab buttons everywhere, and Laps Driven you can type

What changed, in two parts. **Part 1:** the sub-tabs of the other main tabs (Database, Customization, App Settings, and the pages inside them) have the buttons of the Race Setup tab, without the colours. **Part 2:** **Laps Driven** of a slot car is a number you can type, for an old car that has driven laps already.

1. **Database, Customization, App Settings.** The sub-tabs (Tracks, Drivers, Teams, Slotcars, Results and Records; Layout Editor and the others; General, App Theme and the others) are rounded buttons now, with a border and a light tint, the same as the Race Setup chips. The page that is open is stronger: a stronger tint, a full border, a bar under the name and bold text. Hover makes a button a little lighter, as there.
2. The pages inside them have them too: **Racing Records / Token Records** (Database, Results and Records) and the five boxes of **App Settings > Timing Hardware** (Trackmate Interface, Arduino and the others). In a narrow window the buttons wrap onto a second line.
3. They have no colour of their own: they take the text colour of the theme (so they follow every theme, also your own). The main tabs along the top keep their underline.
4. **Database > Slotcars > Add slot car** (or **Edit** on a car) **> Statistics > Laps Driven.** The box can be typed in now: for an old car type 5000 and press **Save**. From then on every lap saved with the car counts on from 5000 (5001, 5002, ...), and when you delete a session or a race its laps come off again, as before.
5. A new car can start with laps driven too: type the number in **Add slot car**. An empty box on a new car is 0; on a car that already exists, an empty box leaves the laps as they are.
6. Only a whole number from 0 is taken (**-3** and **12.5** are refused, and the form says so). You can type 0 to start the count again.

Good to know:
1. **Laps Since Last Interval** and the **Mileage** are not changed by the number you type. The laps since the last service go on from where they are (press **Reset** when you service the car), and the Mileage and the other figures are worked out from the laps that are saved in the app, as before.
2. A number you type is only saved when you changed it. If a race is saved while the form is open, its laps are not overwritten by the number the form showed when it opened.
3. The sub-tabs of the other tabs have no little pictures, as the Race Setup chips have.
4. Not verified in the full Electron window. The buttons were checked in a browser (dark, light and ocean themes, and a narrow window), the form with its tests.


## What to try (1.51.1): a car held on a Trackmate sensor is in the pits

On Windows and Linux with the Trackmate hardware, a car that stood on the sensor for the pit hold time was not taken as a pit stop: the app only looked at the first letter the sensor sends (the lap) and threw the letters that follow away. That is fixed. The app now sees that the sensor stays covered, starts the pit stop and ends it when the car drives off. (Found with the two Trackmate logs of Dutch: the box and the connection were right, the app did not use what the box said.)

1. **The pit hold time** is the time that counts: in the race setup, folder **Racing Systems**, **Pit stop: the sensor must be blocked this long to start a stop (seconds)**. It is 2 seconds unless you changed it. Start a race on the Trackmate hardware and drive a car over its sensor as always: the lap is counted at once.
2. **Hold a car on the sensor** for longer than that time. The pit stop starts, counted from the moment the car arrived (so with 2 seconds the stop starts 2 seconds after the arrival, as for the Arduino box), and everything the stop does works as for any stop: new tyres, fuel, repairs, the time in the pits, the penalty for leaving early if the setup has one.
3. **Drive the car off.** The sensor goes quiet, and the stop ends. The app takes the car as gone a little (about 0.13 second) after the last letter the sensor sent, so the time in the pits can be that much off.
4. A car that **only drives past** (a lap) is a lap and nothing else, as before. A car that stands on the sensor shorter than the pit hold time is no stop, as before.
5. **Weather, tyres due:** when the tyres of a car are due on the lap it comes in and the sensor is held, the stop settles it (new tyres, no penalty). When the car drives on over the sensor instead, the penalty for the tyres is given 0.7 second after the pit hold time has gone by, as of the moment of the crossing (and always before the next crossing or the end of the race). In the log of the race it says the crossing, lap and tyre it was.
6. **Timing Hardware > Trackmate Interface** says on its page that a car standing on a sensor is in the pits.

Good to know:
1. A pit hold time shorter than **0.5 second** is taken as 0.5 second for Trackmate: a sensor covered by a car that drives by repeats its letter on its own.
2. The time the sensor is covered is measured on the clock of the box, so the computer being busy does not make a pass look like a stop.
3. A session with **time tokens** has no pit stops; held sensors are ignored there, as the keys are.
4. The Arduino box has its own pit messages and is not changed. The keys and the simulated cars are not changed either.
5. Tested with the two real logs you sent (Windows and Linux): the replay gives the laps, one stop with its end, and nothing for a car that only passes.
6. Not verified in the full Electron window or with the real hardware: please try it on both machines and send a log if it does not work.


## What to try (1.52.0): mandatory stops in the Tyre Wear System

A tyre wear system can now ask every car for **a number of stops for tyres**, and/or for **two different dry tyres**, by the finish, as in a real race. A car that did not keep the rule gets seconds added to its race time, penalty points, or is disqualified; or nothing, with the result only saying so. It is the first part of what Dutch asked for on 19 October (Safety Car, Push and Save and the Championship follow, one at a time).

1. Open **Race Setup > Tyre Wear Systems**, edit a system (or add one) and open the new folder **Mandatory stops**. Set **Stops for tyres every car must make** (0 = none; 1 is the usual one) and/or **Two different dry tyres must be used** to *Yes*. With both at 0 / No there is no rule, as before 1.52.0: every system you made earlier is unchanged.
2. **A car that did not keep the rule gets** (the choice): *Nothing, only noted in the results*; *Seconds added to the race time* (standard 30, any number up to an hour); *Penalty points* (standard 3; they need a penalty system in the race, otherwise only a note is made); or *The car is disqualified*. The two fields below the choice follow what you pick.
3. Choose the system in a race setup (folder **Racing Systems**) and start a race on the track, with the keys or the simulated cars. A stop counts as a mandatory stop **when tyres were fitted in it**: a car that drives off before the tyre change is done, or finds no set left, has not made one. Two different dry tyres means two of Hard, Medium, Soft and Supersoft (the same tyre twice is one tyre). A car that drove on **Intermediate or Wet tyres** has kept this part (a wet race, as in Formula 1), but not the stops.
4. **When it is judged:** once for every car, when it finishes (after its last lap is counted) or, for a car that is still driving, when the race ends. A race that the Race Director stops by hand ('Stop') is not judged. A car that retired, was disqualified or drove no lap is not judged. Every heat of a heat race is judged on its own. Practice and qualifying never have the rule, even when the system has tyre wear there.
5. **Where you see it:** the **Tyre Change** folder (race screen and Race Director page) gets one line with the rule and where every lane stands ('stops 0 of 1, dry tyres 1 of 2', 'done', or after the finish 'kept the rule' / 'did not keep the rule'); the **penalty log** says it in words ('D2: 0 of 1 mandatory stop made, 30 s added'; a kept rule is not in the log); the **results** and the review get 'Tyres: ...' with the same words, together with what the weather did to the tyres. Seconds are added to the race time like any time penalty, so the order of the results follows; penalty points go through the penalty system as usual.
6. The Help folder **Tyre wear** has a bullet for it. The Race Director's correction of a tyre (Change button) counts for the rule too.

Good to know:
1. The penalty is given once, at the finish: seconds go on the race time like any time penalty (so the order of the results follows), nothing changes in the lap times or the records.
2. Nothing is said or shown during the race that a car is 'late' for its stop: the Tyre Change line only counts what is done. A call in the audio set for this is not made yet.
3. A car that is disqualified by this rule is out at its finish; the other cars are not held up (the race ends as it always does: when the lead car or every car has finished).
4. Saved races, snapshots and the live pages (phones, Race Director) know the new rule; a race window of an older version simply has no rule.
5. Tested: a new test file (`tests/mandatory.test.js`) and extra checks in the tyre wear screen, penalty panel and Help tests; 39 deliberate breakages of the new code were all caught.
6. Not verified in the full Electron window or with the real hardware: please try one race with one stop and two tyres, with a car that does and a car that does not make its stop, and tell me what the results say.


## What to try (1.53.0): the Safety Car System

A race setup can now have a **Safety Car**. It comes out with the yellow flag: while it is out, the cars must drive slower than a limit you choose (a lap that is too fast gets penalty points), and the work in a pit stop takes less time. There is no button of its own: the yellow flag *is* the Safety Car, so the flag buttons, the Trackcall button and a marshal call all bring it out.

1. Open **Race Setup > Safety Car Systems** (the new button after Weather Systems, in orange) and add a system. It has three numbers: **Laps must be slower than** (seconds, standard 15; 0 = no limit), **Penalty points for a lap that is too fast** (standard 1) and **The work in a pit stop takes less time by** (percent, standard 50; 0 to 90).
2. Open a race setup, folder **Racing Systems**, and choose it under **Safety car system**. A system **replaces the Yellow flag fields** of the setup (target lap time and penalty points): they are hidden as soon as you choose one and come back when you choose "No safety car".
3. Start a race. Press **Y** (or the Yellow flag button, which now says **Safety Car**, or a call from a lane). The Race Flag widget in text style and the text variable *Flag* say **Safety Car** (the flag and LED pictures stay a yellow flag), the log of the penalty panel has the line **Safety Car out (after lap N)**, and the audio says the yellow flag call and the limit as it did for the yellow flag target.
4. **A lap that is too fast** (a lap that began after the Safety Car came out, ended while it was still out, and took less than the limit) is called out and gets the points, with a penalty system in the race. Exactly the limit is allowed. A lap that was partly before the Safety Car came out does not count. The lap review marks it as **faster than the Safety Car limit**.
5. **Pit stops are shorter.** A car that comes into the pits while the Safety Car is out has its refuelling, repair of damage and tyre change take the percent less time (50% = half). It is decided when the car comes in: a Safety Car that goes in during the stop does not make it longer, and one that comes out during the stop does not make it shorter. Driver swaps, a penalty that is served in the pits (stop and go) and the pit hold time are **not** shortened.
6. Press **Y** again: **Safety Car in (after lap N)**. A red flag brings it in too, and it ends with the race.
7. **Where else it shows:** the Home tab card *Rules of this race* has a line **Safety car** (only when the setup has one), the Race Director page button says Safety Car, the Help has a new folder **Safety Car**, and the system is exported, imported and shared with phones like the other systems.

Good to know:
1. The lap rule is "slower than": a lap *faster* than the limit is the one that is penalised (the direction of the yellow flag target that you know). If you meant it the other way round, tell me.
2. No closing up of the gaps for now, as you said. No dedicated audio calls for "Safety Car out" and "in" yet: the yellow flag call and the limit are said, as before.
3. A race setup from before has no safety car system and works as it always did (the Yellow flag fields included).
4. A practice, qualifying, race, timed, heat and endurance race can have one; a Time Token Session never.
5. Tested: two new test files (`tests/safetycar.test.js`, `tests/safetycarscreen.test.js`) and extra checks in the setup strip, rotation strip, penalty panel, Home, server and Help tests; 66 deliberate breakages of the new code were all caught (one change that makes no difference to the result was left alone).
6. Not verified in the full Electron window or with the real hardware: please try one race with a Safety Car system, a fast lap behind it and one pit stop with the Safety Car out and one with it in, and tell me what you see.

## What to try (1.54.0): the Push and Save System

A race setup can now have a **Push and Save System**: how hard a driver drives decides how fast his tyres and his fuel are used up. Every lap is compared with the driver's **reference lap**. Driving at the reference (flat out) wears the most, a normal race pace is a bit slower and wears as usual, and driving slower than that saves tyres and fuel. Lap times and grip are never changed: the system only changes the wear.

1. Open **Race Setup > Push and Save Systems** (the new button after Safety Car Systems, in lime) and add a system. Start from one of the three buttons in the folder **Basics**: **Standard** (flat out wears 40% more tyres and 25% more fuel, the most saving pace wears 30% and 20% less), **Gentle** (a little) or **Strong** (80 / 50 and 50 / 35). The folder **Pace** has **Normal pace: the best lap plus (%)** (3 to begin with) and **Most saving pace: the best lap plus (%)** (8; it must be more than normal pace). The folder **Wear** has a switch and two numbers for the tyres and for the fuel (more when flat out, less at the most saving pace; the tyres need a Tyre Wear System in the race). The folder **Which laps count** has the first lap the effect works from (3), the slow limit (150% of the reference: slower laps wear as usual) and **Laps under yellow or the Safety Car** (a slow lap there is saving).
2. Open a race setup, folder **Racing Systems**, and choose it under **Push and save system**. With a system chosen, the **target lap time, most extra and most saving of the Fuel Setup are not used** any more: the litres of the Fuel Setup are multiplied by the pace instead. A race setup of a Time Token Session never has one.
3. **The reference lap** of a driver is his best lap on this track in the records (laps of a Time Token Session and laps that are not in the personal bests do not count). A driver without a record has his best lap so far in this race, and a lap that is faster than the reference is the new reference (that lap is flat out). The pace of a lap is how many percent it is slower than the reference.
4. **The wear of a lap** is the usual wear times a number: flat out (the reference lap) x1.40 tyres and x1.25 fuel, normal pace (the best lap +3%) x1.00, and in a straight line down to x0.70 and x0.80 at the most saving pace (+8%), staying there for slower laps. A lap that is more than a percent faster than normal pace is **PUSH**, one that is more than a percent slower is **SAVE**, in between is **NORMAL**. Laps with a stop in the pits, the first lap after a pause, laps before the effect starts, laps without a reference and very slow laps wear as usual.
5. **Race screen and Race Director page:** a new lime folder **Push and Save** has a row for every lane: the pace (PUSH, NORMAL or SAVE and how far over the reference), the last lap, the reference lap (record or this race), what the tyres and the fuel take now (x1.35, and % or litres a lap against the usual) and how many laps they last at this pace. Below it a lap by lap list (the last 10 laps) for the lane you pick. A phone that follows the race has the same.
6. **Widget:** the **Pace meter** (Add widget, folder **Tyres**) shows the pace of the car of its lane as a **badge**, a **gauge** with a needle, a **bar** with a marker or the **wear only**, with options for the percentage, the wear, the reference lap and the three colours. The **Leaderboard** has an option **Pace** (off to begin with) and the **Driver stats** grid has the cells **Pace** and **Wear now**.
7. **Elsewhere:** the lap review tags every lap with its pace ("PUSH +0.4%, tyres x1.35, fuel x1.22") or why it wore as usual, the Home card *Rules of this race* has a line **Push and save**, the Help has a folder **Push and Save**, and the system is exported, imported and sent to phones like the other systems.

Good to know:
1. Normal pace is the best lap **+3%**, not the best lap itself: otherwise a driver could never drive faster than his own best lap and could only ever save. You can change every number of a system.
2. The pace is the driver's: nobody can change it from the Race Director page, and there is no audio call for it yet.
3. The wear numbers work on top of Balance of Power and the effects of the weather and of worn tyres on the fuel use, so the litres of a lap also depend on how worn the tyres are.
4. A race setup from before has no system and works as it always did.
5. Tested: three new test files (`tests/pushsave.test.js`, `tests/pushsavescreen.test.js`, `tests/pacewidgets.test.js`) and extra checks in the widgets, grids, setup strip, icons and screen tests; 161 deliberate breakages of the new code were all caught except one that changes nothing (a check that the engine repeats).
6. Not verified in the full Electron window or with the real hardware: please try one race with a Push and Save system and a driver who has a record on the track: one lap flat out, a few at a normal pace and a few slow ones, and look at the Push and Save folder and the Pace meter widget.

## What to try (1.55.0): Championships, release 1 (rounds, sessions, roster and the card on Home)

A **championship** is a series of rounds, and every round is a few sessions (a practice, a qualifying, a race) that you drive one after the other. This first release does the setting up and the driving: you make the championship, the Home tab shows which session is next, one click loads it, and the race you drive is saved with the name of the championship, the round and the kind of session. **Points and standings come in release 2** (see "Good to know").

1. Open **Race Setup > Championships** (a new button in the group of the Setups, after Fuel Setups, in pink) and press **New championship**. Give it a **name**. **Add a round**: it has a name (empty is "Round 1", "Round 2"...), a **track** (empty means the track of the race setup of each session) and a date you type yourself ("Sat 24 Oct 2026"). A new round starts with the sessions of the round before it.
2. **Add a session** to a round and choose one of your **race setups**. The kind comes from the race setup: a race, a timed race, a heat race or an Endurance Race is a **Race**; the sessions of type practice and qualifying are **Practice** and **Qualifying**. A Time Token Session can not be part of a championship (it is not offered, and the page says so). Only a race has a choice of the points it will count for: **100%**, **50% (a sprint)** or **None**. The arrows move a session up and down, the cross removes it. **Copy the sessions of round 1 to all rounds** asks first, because it replaces what the other rounds have. Rounds move up and down and are deleted with their own buttons; the round that is next is open and marked **Next**, the finished ones **Done**.
3. The **roster** is the list of the drivers of the championship (from Database > Drivers and Teams). Add them one by one, or **Add all drivers of a team**. Each has a team (the first team that has the driver, which you can change) and the round that he **joins in**. A driver who is not in the roster drives as a guest. Undo and Redo work on everything on the page, **Save championship** writes it, and Back asks first when there are changes that are not saved. The list has **Edit**, **Duplicate** (new ids, so races of the first one never count for the copy) and **Delete** (the races stay in Results and Records, as normal races), and shows how many sessions are driven.
4. On the **Home tab** a pink card sits above Start a race: the championship, "Round 2 of 6 · Hairpin Hill · Sat 24 Oct", how many sessions are driven and the sessions of the round as steps (the next one in bold, the driven ones with a tick, a race with "points: 100%"). **Load Qualifying** (the name follows the next session) puts the race setup of that session in the Race setup box and the track of the round on the card; **Another session...** loads any other session, also to drive one again. Nothing starts until you press Start race. With more than one championship the card has a choice of them.
5. While a session of a championship is loaded the card of the race says **Counts for Club Cup 2026 · Round 2 · Qualifying** and the drivers of the roster come first in the driver boxes (in the order of the roster; the others follow under "Other drivers (they drive as guests)"). Changing the race setup in the Race setup box makes it a normal race again. A session whose race setup was deleted, or that is a Time Token Session, can not be loaded and the card says why.
6. **The race is saved with the tag.** The race screen shows it next to the name of the race, the message after the race says "It is part of Club Cup 2026.", a race that is interrupted and comes back keeps it, and **Results and Records** shows it in the line of the race ("Club Cup 2026 · Round 1 · Race at 50%"). A session counts as **driven** once a saved race carries the tag; if you drive it again the latest one counts. The next session is always the first one that is not driven yet, so you can drive in any order.
7. **Elsewhere:** the Help has a folder **Championships**, a championship is exported and imported like the other setups (it brings its track, its race setups, its drivers and its teams along when you ask for the dependencies; an import adds a copy with new ids), and deleting a track, a team or a driver also takes it out of the championships that use it.

Good to know:
1. **No points yet.** Nothing is calculated in this release: no points table, no bonuses, no dropped results, no team points, no standings, no "Maria leads by 5" and no **Award these points** panel. Those are release 2, which will use the sessions you drive now, so everything you drive with this version counts then. The 50% of a sprint and the **guest rule** (a guest gets no points, the drivers behind him move up) are already stored with the championship but do nothing yet.
2. A session counts as driven only when its race is saved with the tag, so a race you abort and do not save does not count. Changing or removing sessions of a championship afterwards does not change races that were saved; they stay in the results as normal races.
3. Limits: a name of 60 characters, a round name of 40, a date of 24, 40 rounds, 8 sessions in a round, 60 drivers in the roster.
4. Tested: two new test files (`tests/championship.test.js` for the rules, the database and export/import, `tests/championshipscreen.test.js` for the pages, the card on Home, the race and the results) and extra checks in the setup strip, icons, rotation and 17 other screen tests; 167 deliberate breakages of the new code were tried and 164 were caught, the other three change nothing (a check that is already true one line before it, a round that is not shown any more once the championship is finished, and a check that a value is there before it is looked up).
5. Not verified in the full Electron window or with the real hardware: please make a championship with a practice, a qualifying and a race in two rounds, look at the card on Home, load the practice, drive it, and check that the card moves on to the qualifying and that the race shows up in Results and Records with its tag.


## What to try (1.56.0): Championships, release 2 (points, standings and the awarding of a race)

The championship now **counts points**. You set the points table, the bonuses, the dropped results, the team points and the tie rule in the championship; after a race a panel shows the points of that race and you **award** them; the standings (Drivers, Teams, Rounds, with Export to PDF) are in Results and Records, and Home says who leads. Everything you drove for a championship with 1.55.0 counts: the sessions only have to be awarded.

1. Open **Race Setup > Championships**, edit a championship and look at the new **Points** section (between the rounds and the roster). Start from a ready-made table (**25-18-15-12-10-8-6-4-2-1**, which is on in a new championship, **10-8-6-5-4-3-2-1**, **One point per car beaten**) or **My own**, change any place, **Add a place** (up to 20) or **Remove the last place**, and set what **every finisher after the last place gets**. A car that was disqualified or did not finish gets no points for its place; a car that finished, even many laps down, counts as a finisher.
2. **Bonus points**: the **fastest lap** of the race (points, and "only when the driver finishes in the first N places"), **pole position** (fastest in the qualifying of the same round; he has to start the race, so a disqualified pole sitter gets nothing) and **starting the race** (points for every driver who starts; a disqualified driver gets none). The bonuses are added to the points of the race.
3. **Dropped results**: how many of the worst round results do not count, for every driver and for every team **on its own** (a team can drop a round that none of its drivers dropped). The note under it says "Best 5 of 6 rounds count." and a dropped result is crossed out in the standings.
4. **Teams, ties and sprints**: team points in a race are the points of the **best N drivers** of the team (standard 2), of **all drivers**, or there are **no team standings**. A tie is decided by **most wins** (then most 2nd places, and so on), by **the best result of the last round** or by **the best qualifying results**; if that does not decide it, the order of the roster does. A race at **50%** (a sprint) gives half of the points and the bonuses together, rounded to the nearest point (or up, down, or not rounded). The check box **a driver who is not in the roster drives as a guest** is on: a guest gets no points and the drivers behind him move up one place (off: the places stay as they are and nobody moves up).
5. **After a race** a panel appears under the lap review: "Championship points: Club Cup 2026, Round 3" with every driver, his place, the points of the race, the bonus columns the championship has, **This round**, **Total now** and the **Change**, notes (a guest, a pole bonus that was not given, the teams of this round) and two buttons: **Award these points** and **Do not count this race**. After awarding it says "Points awarded", how many rounds are driven and who leads ("Club Cup 2026 now has 3 of 6 rounds driven. Maria leads by 5."), with **Open standings** and **Undo**. The same panel is in the card of every race of a championship in **Results and Records** (Racing Records), and the line of the race says **points awarded**, **not awarded yet** or **not counted**. A practice has nothing to award; a qualifying says who is on pole and what that is worth. If you drive the same session again and award it, the new race **replaces** the first (a session counts once).
6. **Results and Records > Championships** (a new tab next to Racing Records and Token Records): choose the championship, then **Drivers** (position, driver, team, the points of every round, total, behind, wins), **Teams** (with the drivers of each team) or **Rounds** (the winner of every race). The leader's row is shaded, the fastest lap bonus is pink, a dropped result is crossed out, a round that is not driven is a dash. Under the title: who leads and what is left ("One round is left: it gives up to 25 points a driver, so Sam and Kim can still pass Alex.", "Alex can no longer be caught.", "Alex is the champion."), and a note when a race is saved but not awarded yet. **Export to PDF** makes an A4 landscape page of the table you are looking at and asks where to save it.
7. **Home**: the pink card of the championship gets a tag "**Maria leads by 5**" (or "Maria and Dutch are level"), and under it **Standings after round N** with the first five (**Drivers** / **Teams** buttons), what is left, and **All standings**, which opens the Championships tab at that championship.
8. **Elsewhere:** the Help has a new folder **Championship points**; the points rules, and the awarded / not counted marks of the races, travel with a championship when you export and import it (a race that comes with it still counts for the copy).

Good to know:
1. **How the points are kept.** No points are written into the races. The standings are worked out from the saved races every time you look, using the rules of the championship as they are now. So if you correct the table, a bonus or the drops, the standings change at once, also for races you already awarded. **Award these points** only marks the race as one that counts, **Undo** takes the mark off, and **Do not count this race** takes it out of the championship altogether (the race stays in the results as a normal race, and Home offers that session again). This is a small difference from the drawing, which wrote the points down at the moment of awarding.
2. **Dropped results** are set as "the worst N results do not count" and shown as "Best N of M rounds count" (M = the rounds that have a race). With one round driven nothing is dropped (at least one result always counts).
3. **Races of teams are not scored** in this release: an Endurance Race or a heat race where the teams drive has no driver to give points to. Such a race says so in its panel and stays in the results.
4. The **fastest lap** is the best lap of a car that finished and counts for the championship; he only gets the bonus when he finishes in the first places you set. The **pole** bonus needs a qualifying session of the same round that was driven (and saved with the tag); when a round has more than one, the last of them counts. A race that counts for **0%** gives nothing and has nothing to award. A driver who joins in a later round has "n/a" before it.
5. Only the sessions that are **awarded** are in the standings; a race that is saved but not awarded is not, and the Championships tab and the panel say so. The panel works out the points from the result as it is saved, so change penalties in the lap review before you press Award.
6. Limits: a table of 1 to 20 places with 0 to 1000 points (two decimals), the fastest lap in the first 1 to 99 places, 0 to 10 dropped results, 1 to 20 drivers of a team count.
7. Tested: two new test files (`tests/champpoints.test.js`, 169 checks, for the rules, the standings, the sentences and the changes written to a race, and `tests/champpointsscreen.test.js`, 72 checks, for the Points section, the panel on the race screen and in Results and Records, the Championships tab with the PDF and Home), extra checks in the championship test (export and import), the Help test and the 18 screen tests that load the program; 198 deliberate breakages of the new code were tried and 186 were caught, the other 12 change nothing (for example a shortcut whose answer is the same without it, a number that is only stored and not used, and a test that is already true one line before it).
8. Not verified in the full Electron window or with the real hardware: please drive a qualifying and a race of a championship that has a fastest lap bonus and a pole bonus, look at the panel under the lap review, press **Award these points**, open **Results and Records > Championships** and look at Home. Then press **Undo** and check that the standings go back, and try **Export to PDF**.

## What to try (1.56.1): the championship is chosen in Start a race

The card of the championship was on Home for good as soon as a championship existed. Now **Start a race** has a **Championship** choice at the top, and the card appears **inside Start a race**, under that choice, only when you choose a championship. Nothing else about the championship changed.

1. Open **Home**. With at least one championship, **Start a race** starts with the choice **Championship**, set to **None: a normal race**. Nothing of the championship is on Home. (With no championship the choice is not there either.)
2. Choose your championship in it. Its card appears right under the choice and above the **Race setup** box: the round, its track and date, how many sessions are driven, who leads, the steps of the round, **Load** (the next session), **Another session...** and the top of the standings. The card has a pink edge and a light pink tint, so it is clear what belongs to the championship and what is the race below it.
3. Press **Load Qualifying** (or whatever is next) as before: it fills the race setup and the lanes below and the line **Counts for ...** says the race is part of the championship. Nothing starts until **Start race**.
4. Choose **None: a normal race** again: the card is gone, a session that was loaded is let go (it is a normal race again), and the race setup and lanes stay as they are. The choice is remembered, so Home comes back the way you left it.
5. With more than one championship the choice lists them all. Choosing another one lets go of a session that was loaded for the first one.

Good to know:
- A championship that you chose before this version (by loading a session) is still chosen. If you never chose one, Home shows none until you do; before, the first one was shown for you.
- The name of the championship is in the choice only; the card shows the round.
- Tested: the two championship screen tests (`championshipscreen`, `champpointsscreen`) changed with it (the choice, the card inside Start a race, None, two championships, a loaded session that is let go) and a check of the style, the Help test says where to choose it; 16 deliberate breakages of the change were tried and all were caught (two gaps in the tests were closed, and one needless line was removed). The picture was looked at in a real browser (dark, light and a narrow window). Not verified in the full Electron window.

## What to try (1.57.0): races of teams are scored

Until now a race that the teams drove **as teams** (an Endurance Race, a heat race for teams) was not scored. Now it is. The team is the entrant: it gets the points of its place **once**, in the **Teams** standings, and the drivers who drove for it get points in the **Drivers** standings. A championship can have a drivers' title and a teams' title, like the World Driver Championship and the Constructors' Championship in Formula 1.

1. Open **Race Setup > Championships**, edit a championship and look at **Points > Teams, ties and sprints**. Two new choices: **A race of teams ... gives the drivers who drove for a team**: **The points of the team: every driver who drove gets them** (the standard), **A share of the points, by the laps each one drove**, or **Nothing: only the team gets points**; and **A driver needs at least this share of the laps of his team** (percent; 0 = no minimum, and the box is off when the drivers get nothing).
2. Put an **Endurance Race** (or a heat race where teams drive) in a round, choose the championship in **Start a race**, load the session and race it as always.
3. After the race the panel says **Championship points** as for any race, with the teams as the lines of the table (marked "team", with their place, points and the Teams total) and the **drivers who drove under their team**, each with his laps and his own points, round, total and change. A driver who drove too little (under the minimum share) is marked "too few" and gets nothing; a guest who drove for a team gets nothing, the team still gets its points. Notes say what a race of teams gives, which teams scored this round, and (when the championship has no team standings) that only the drivers get points.
4. **Bonuses** in a race of teams: the **fastest lap** goes to the team and to the **driver who set the lap**; **pole position** to the team of the pole sitter and to him, if he drove for it; **starting** to the team and to every driver who drove. A team that is disqualified gets nothing (and its drivers either); a team that is out (retired) gets the start bonus only.
5. A sprint (50%) halves the points of the team and of the drivers, rounded as you chose. **Dropped results** work for teams and drivers on their own, as before.
6. **Results and Records > Championships**: **Drivers** has every driver who drove for a team (Alex and Sam 25 each when Foxes won), **Teams** has the team once (Foxes 25, not 50), **Rounds** names the team that won. A note under the title says what a race of teams gave. The Home standings follow the same numbers.
7. A race can also have **single drivers and teams together** (an Endurance Race where a driver races alone): all of them are entrants in the order of the result; the team of the single drivers gets the points of its best drivers, as in any race of drivers.

Good to know:
1. **How I read "the team gets points too".** The team gets the points of its place **once**, not the sum of the points of its drivers. So when Foxes win, the Foxes get 25 and Alex and Sam get 25 each. If you would rather have the team get the sum of its drivers (50 here), say so; it is a small change.
2. The sessions you drove **before** this version are scored too, as soon as you award them (older Endurance Races are in the file already). They do not say which driver set the best lap of the team (new races do, in `bestBy` on the team row), so for those the **team** gets the fastest lap bonus and no driver does.
3. **Practice and qualifying** still give no points (qualifying gives the pole position bonus to a race). **Time Token Sessions** are still not part of a championship. A team that no driver of the roster belongs to (in that round) is a **guest** team, like a guest driver: no points, and the teams behind it move up (switch it off with the guest rule).
4. With **no team standings** (Team points in a race: No team standings) a race of teams still gives its points to the drivers; the team row shows no total.
5. When a driver drove for two teams in one race (the heats of a race of teams), he gets the points of both. A driver who drove only for time (no complete lap) counts as having driven; with "a share by laps" he then has no share unless nobody has a lap, in which case the points are shared equally.
6. Tested: a new test file (`tests/teamraces.test.js`, 84 checks: the rules, the sharing, the minimum share, the bonuses, guests, a team that is out, sprints, mixed races, heats, the standings over rounds, the panel, the tables), changed or added checks in the points test, the two screen tests (the editor with the two new rules, the panel of a race of teams, the standings pages, the style), the Help test, and the two screen tests that save a race of teams (the team row says who set the best lap); 94 deliberate breakages of the new code were tried and all were caught (the first run missed 11: the gaps in the tests were closed and two needless conditions were removed).
7. Not verified in the full Electron window or with the real hardware: please drive an **Endurance Race** (or a team heat race) as part of a championship that has a fastest lap bonus, look at the panel after the race, press **Award these points**, then open **Results and Records > Championships** and look at Drivers, Teams and Rounds. Try the three choices for what the drivers get and a minimum share of the laps.

## What to try (1.58.0): the Start a race card, redesigned

The card on Home that starts a race now looks like the Championship card: the same edge, a tile with a flag, the name of the race setup as a large title with its facts under it, the lanes as dark rows in the colour of each lane, and one pill at the bottom that says whether the race can start. This is option **A (lanes as rows)** of the design you chose. Nothing about how a race starts changed.

1. Open **Home**. The small red label **Start a race** is above the name of the race setup; the name *is* the choice (click it to pick another race setup, as before). Under it are pills: the kind of session in bold, how long (laps or minutes), the track with a pin, the number of lanes.
2. With a championship made, its **Championship** choice is one quiet row under the title (**None: a normal race** to begin with). Choose one and the pink card opens under it, as in 1.56.1.
3. Every lane is a dark row in its colour: the number in a circle, the **driver** and the **car** (a little helmet and a little car in front), and a **tick** on the right. Green means the row is filled in.
4. Take the driver of lane 2 away: the row gets an **amber edge and tick** and says **Lane 2 needs a driver and a car** inside the row. The pill at the bottom turns amber (**1 of 2 lanes is ready**) and **Start race** is dim. Choose the driver again: the row, the pill and the lights go green (**All 2 lanes are ready**).
5. Put the same driver on two lanes: both rows are filled in (tick), but the pill says **All 2 lanes are filled in** in amber, and the list under the rows says **A driver is used more than once.** Anything that is not about one row stays in that list.
6. Try the other kinds: a **heat race** (teams or drivers; **Remove** and **Add** as before), a **rotation** (the name of the participant is in the row; **Not here today** gives a ring instead of a tick, and the lights do not count that participant), an **Endurance Race** (a team and its starting driver per lane), a **Time Token Session** (the button says **Open the session**).
7. Make the window narrow (or the card one column wide): the number, the choices and the tick stay on one line and the rest goes under them; **Start race** takes the whole width.

Good to know:
- "Race by laps or distance" is just **Race** in the pill (the next pill says how long). A race by time or by distance has no length pill, since "how long" is not one number there.
- The other cards of Home are as they were. The question whether they should get the same header (a tile and a small label) is still open; Start a race stays the hero card for now.
- The card keeps everything it had: the qualifying winner's lane choice, the heat plan, the rotation text, **A race is running**. Only the look of the rows, the title and the bottom changed.
- The Help text of the Home tab and of Championships says where things are now. The pictures and the boards of the design are in `docs/ui-reference/start-race/`.
- Tested: a new test file `tests/startcard.test.js` (40 checks) and the Home checks of seven other test files that pinned the old markup; 57 deliberate breakages of the change were tried and all were caught in the end (4 guards that could never be false were removed and one loose style check was tightened). The card was looked at in a real browser (dark, light, a narrow window, a championship chosen, heats, teams, rotation, Time Tokens, Endurance, a driver twice, a lane not ready). Not verified in the full Electron window or on the Raspberry Pi: please look at Home on the Pi (the card on a small screen) and on Windows, with a race setup of two lanes and one of four.

## What to try (1.58.1): the list under the name of the race setup is dark again

On Windows the list that opens when you click the name of the race setup in **Start a race** was white, with the names in a pale colour that was hard to read. Now the list has the colours of the card (dark in the dark themes, light in the light themes), like the lists of the driver, the car and the championship.

1. Open **Home** and click the **name of the race setup** (the large title of **Start a race**). The list is dark, with the names readable; the one that is chosen is marked.
2. Try it in a light theme as well (App Settings > App Theme): the list is light with dark names.
3. Click the driver, the car and (with a championship) the championship choice: they were dark before and still are.

Good to know:
- The other cards of Home keep the look they have; you told me you do not want the new header on them, so nothing is planned there.
- Chromium draws the opened list by itself, so I could check the colours the options have (in a dark and a light theme) but not photograph the open list here. Please look at it on Windows and on the Pi (Linux draws that list in the same way).
- Tested: one check more in `tests/startcard.test.js` (41 now); 6 deliberate breakages of the rule were tried and all were caught.

## What to try (1.58.2): Fuel Systems, with the other systems

**Fuel Setups** is now called **Fuel Systems**, and its green button has moved to where it belongs: in the **Systems** group of the **Race Setup** tab, between Damage Systems and Tyre Wear Systems. The **Setups** group keeps Rotation Setups and Championships.

1. Open **Race Setup**. In the group **Systems** you see Penalty, Damage, **Fuel**, Tyre Wear, Weather, Safety Car and Push and Save Systems. The group **Setups** has two buttons left.
2. Click **Fuel Systems**: the page, the **Add fuel system** button and the form say fuel system. Your saved fuel setups are all still there, just under the new name.
3. Make or edit a race setup: the choice in the Racing Systems folder is now called **Fuel system** (still "No fuel" when you pick nothing).
4. Open App Settings > Help > Race Setup: the list names Fuel Systems with the other systems.

Good to know:
- Only the name and the place changed. The saved data, the colour and the picture are the same, so nothing needs to be redone.
- The Balance of Power page, the hints of the Weather, Tyre Wear and Push and Save forms and the help now say fuel system too.
- Tested: the order and the groups (7, 2 and 2) in `tests/setupstrip.test.js`, the help folder in `tests/help.test.js`; 99 PASSED in `npm test`. 18 deliberate breakages (the chip back in Setups, the old name in the chip, the table, the field, the help or the hints) were tried and all were caught.

## What to try (1.59.0): Random flags in the Safety Car System

A Safety car system has a new folder, **Random flags**. Switched on, the yellow flag (the Safety Car) goes up at random moments in the race, whatever the drivers do, as if one of eighteen other cars on the track had caused it. The rules of the system work as always while it is out: a lap must be slower than the limit, the work in a pit stop takes less time. The red flag is not part of it (parked, as you said).

Everything is yours to set, in the folder Random flags of the system (it starts closed; the settings show when the switch is On):
- **Random yellow flags**: Off or On.
- **Chance that a race has random flags (percent)**: 100 = every race, 60 = six races in ten (the others get none). Good for a championship, where not every round has them.
- **How many flags**: Exactly N, From N to M, or At least N with a chance of one more (and then one more again).
- **A flag ends**: by itself when its time is up, or only when the Race Director lifts it.
- **How long**: always the same time, or a time between two (5 to 600 seconds), drawn for each flag.
- **Earliest and latest moment** (percent of the race), **at least this long between two flags**, and for a free practice (it has no end) **the minutes to spread them over**.
- **Warning** (seconds, 0 = none): the Race Flag widget flashes yellow and says SAFETY CAR SOON, and the new audio call **Yellow flag soon** is said (Audio Settings, Flags folder; on for a new set).

1. Open **Race Setup > Safety Car Systems**, add a system (or open yours) and open the folder **Random flags**. Switch it On, and try: exactly 2 flags, 20 seconds each, earliest 10%, latest 80%, a warning of 5 seconds.
2. In a race setup choose that system (Racing Systems) and start a short race, say 10 laps. Nothing shows beforehand: the moments are drawn when the race starts.
3. A few seconds before the first flag the Race Flag widget flashes (SAFETY CAR SOON) and the call is said. Then the yellow flag goes up by itself: the Safety Car is out, laps that are too fast are called out as always, and it comes down again after its time (the green flag call is said).
4. Press the yellow flag button (Safety Car) while a random flag is up: it is lifted, just like a flag you raised yourself. With "Only when the Race Director lifts it" it stays up until you do.
5. Open the race log on the Race Director page: it lists them, for example "Random yellow flag 1 of 2 (20 s)", "... is over (the time was up)" and "... is about to come".
6. Try a qualifying or a timed race too: there the moments are on the clock, not in laps.

Good to know:
- In a race by laps a moment is a place in the laps of the leader, never in the first lap or the last. In a timed race, a qualifying and a practice it is a time on the race clock.
- If the flags do not fit between the earliest and the latest moment (with their length and the gap), fewer are drawn; never more than 20. When a flag is due while another yellow flag is up (a marshal call, the Race Director), it waits for that one to end and for the gap. During a red flag the plan stands still. After the time is up, or when a car has finished, no new flag comes.
- The plan is kept with the race: a race that is carried on after an interruption goes on by the same plan. Every heat of a heat race draws for itself. A phone or second screen that follows the race flashes the warning too.
- Not done: the Red Flag randomizer (parked), a line about random flags in the Rules of this race card on Home, and a way to see the plan during the race (on purpose: it is a surprise).
- Tested: a new `tests/randomflags.test.js` (106 checks: the rules, the plan, the form, the engine, the warning, the snapshot) and `tests/randomflagsscreen.test.js` (22 checks: the form and its saving, and a race on screen with the warning, the flag and the log), and checks more in the audio, timing, penalty panel, help and Safety Car tests. 80 deliberate breakages were tried: 79 were caught, and one is a guard that can never matter (the plan is empty either way). The flags were watched in a simulated race, not on the Pi or with real cars: please try a short race on the Pi and on Windows, with the warning on a second screen.

## What to try (1.60.0): The Performance line, a quieter race screen, and a race save that does not wait

For the Raspberry Pi that got slow on the race screen. Three things, and the first two need nothing from you:
- **A quieter race screen.** The race screen is brought up to date ten times a second, and many of its parts were given the same value again every time (a button's text, whether it is disabled or hidden, its colours). The window then lays out and draws that part again for nothing. In a race of 6 lanes that was more than a thousand writes a second, of which about fifty were real changes. Now a value that is already there is not written again, and a widget whose text changes is no longer given the same colours and border again. The screen looks and works the same.
- **A race save that does not wait for the disk.** While a race runs the app saves its state every few seconds (that is how a race can be carried on after the app closed). It waited until the disk had really written it, which on an SD card can take a long time, and the whole window stood still meanwhile. It is now written in the background. It is still written next to the old file and put in its place when complete, so the old file stays whole until the new one is. If saves pile up only the newest is written. When you close the app while a save is on its way, the app waits for it (three seconds at the most).
- **The Performance line** (new): see for yourself what the Pi is struggling with, instead of guessing. In **App Settings > General** there is a new folder **Performance**.

What the Performance folder has:
- **Show the Performance line on the race screen** (off to begin with): a small line under the buttons of the race screen, for example `58 frames/s · slowest frame 41 ms · screen update 0.6 ms (10/s) · app CPU 24% (window 14, graphics 7, core 3) · core stalled up to 14 ms · race save 3.4 ms`.
- **The report**: a box that updates every second while the folder is open, with more: the computer (a Raspberry Pi says which one, how hot it is and how fast the processor runs), the screen and whether it is a Wayland or X11 session, **whether the window is drawn by the graphics card or by the processor (software)**, how the app was started, the frames a second and the slowest frame, how long a screen update takes, the CPU of the app (window, graphics, core), how long the core of the app was stuck, how long the race save takes, and notes in words when a figure looks wrong (a hot processor, drawing in software, a slow save).
- **Copy report** puts the report on the clipboard, to paste in a message.

1. Open **App Settings > General**, open the folder **Performance** and look at the report. Nothing is measured while the folder is closed and the line is off.
2. Tick **Show the Performance line on the race screen**, start a race (keys or simulated cars) with your layout, and look at the line under the buttons. It costs a little itself (about 3 points of one core in my measurements).
3. On the Pi: with the race screen open and a race running, open the Performance folder (or leave the line on) and **Copy report** during the race. Please send me that report: it shows whether the window is drawn in software, how hot the Pi gets, and where the CPU goes. The next step (the idea of a "Pi Performance Mode" tickbox) waits for it.
4. Compare: set **Depth** (App Settings > General > Display) to **Flat** and watch the line again. In my measurements Flat was lighter to draw.
5. Start a race, close the app in the middle, open it again: the race can still be carried on (the save is written in the background and closing waits for it).
6. Open the **Help** tab: the new folder **Performance** (under Making it yours) says the same in short.

Good to know:
- The numbers I have are from a normal PC (Chromium, 1920 x 1080, 6 lanes, a Leaderboard layout), not from a Pi and not from the Electron window: the browser used 26 to 29% of one core before and 16% with the quieter page (12% with Depth Flat as well). With all the systems switched on (Safety Car, penalties, damage, tyres...) it was 45% before and 32% now. The JavaScript itself was only about 2%: the cost is in drawing. How much the Pi gains, I do not know: that is what the report is for.
- The shadows (Depth) are left as they are, as agreed; Flat is the way to switch them off.
- The core of the app only looks at its own stalls and processes while somebody asks (the report or the line), and stops thirty seconds after the last question. A phone or a browser that follows the race has no core to ask: its report has the window figures only.
- Not done: the **Pi Performance Mode** tickbox (1.61.0, after your report), redrawing the race screen five times a second instead of ten, and any change to the shadows.
- Tested: new `tests/quiet.test.js` (42 checks: the guard for each way of writing, the colours of a widget), `tests/resumeasync.test.js` (35: the background save, the order, the newest only, a clear that is never undone, the slow disk, closing), `tests/perf.test.js` (57: the figures, the line, the notes and their limits, the report), `tests/perfstats.test.js` (34: what the core of the app tells, from a made-up Pi) and `tests/perfscreen.test.js` (49: the folder, the switch, the report, the Copy button and the line on the race screen), and more checks in the help and settings tests. 233 deliberate breakages were tried: 223 were caught and 10 cannot matter (a second check that does the same, or a value that is the same either way). Everything was measured and tested in Chromium and in test stand-ins: **not on the Pi, not in the Electron window, not on Windows**. Please try it on the Pi and on Windows (with the Trackmate), and tell me what the report says.

## What to try (1.60.1): The report now says where the time goes

For the Raspberry Pi that is still laggy at the start of a race. Nothing in the race itself changes: this release only makes the **Performance report** tell much more, so the next report can point at the cause. Your last reports showed that the screen update itself is what takes the time (73 ms, then 82, then 122 ms, where 100 ms is all there is), that it gets slower during the race, and that the app's memory grew from 1.2 to 2.7 GB. They did not say what takes the time. Now they do.

What is new in the report (App Settings > General > Performance, and Copy report):
- **Where a screen update spends its time**: the parts of one update (the state, the widgets, the panels, the pads, the buttons, the sharing with other windows), as an average per update, biggest first.
- **Slowest widgets**: per type of widget, the time per update, split in making its text, putting it in the page and fitting it to its place (the part that makes the page measure itself, which is the expensive one on a slow computer). If one widget takes more than a third of the update, a note says so.
- **Slow frames**: the browser's own account of every frame over 50 ms: how much was script and how much was drawing the page, how much of the script was the page measuring itself again and again (a forced layout), and which scripts were slowest.
- **Worst since the race started**: the slowest frame, the longest update, the longest stall and the fewest frames a second of the whole race. They stay after the race, so you can copy the report afterwards.
- **One row every 30 seconds since the race started**: frames, screen update time, memory of the app, memory of the page, number of elements in the page and CPU of the window. If the screen gets slower, or the memory grows, during a race, the notes say so.
- **When the core of the app was stuck** (over 100 ms), with the clock time, and **what happened** (the race started, a tab was chosen, the Live Race tab was pressed, the Live Race window opened and how long that took in the core).
- **Windows**: how many windows are open, and the CPU and memory of each. The **Live Race tab opens a second window** that draws the timing page again, in a process of its own; the report now names it.

How to try it:
1. Switch the Performance line on (App Settings > General > Performance) **before** you start the race. Keep the **Live Race tab closed** for the first race, as you planned.
2. Start the race. When it lags, and again when one car has finished and it runs smoothly, press **Copy report** (the folder can stay open in App Settings, or copy from the Performance folder after the race: the worst figures and the rows stay).
3. Send me the report(s). I can then see which widget or which part of the update it is, and whether it grows during the race.
4. If you like, race a second time with the Live Race tab open, and send that report too: the **Windows** part and the CPU of each window show what the second window costs.

Good to know:
- Nothing is measured while the line is off and the folder is closed, as before. Measuring the parts costs a little (a few readings of the clock per widget per update), only while somebody looks.
- The Performance mode (1.61.0) still waits: what to turn off depends on what these reports show. Flat shadows alone would not help a screen update that takes 70 to 120 ms of script.
- A report from a phone or a browser has the window figures only (no processes, windows or stalls: those come from the core of the app).
- Tested: `tests/perf.test.js` (207 checks: the parts and widgets, the slow frames, the worst figures, the rows, the marks, the windows, the stalls, the notes and the text of the report), `tests/perfstats.test.js` (61: the stalls with their clock time, the marks, the windows, and that main.js tells the collector when the Live Race window opens), `tests/perfscreen.test.js` (81: the timers for the parts and widgets, the marks, the race that starts, the rows, the observer of slow frames, and a real race with the line on), `tests/quiet.test.js` (50: the painter reports the time of each part of a widget) and the help test. Besides that the code was broken on purpose 320 times to see whether the tests notice: they did, except for a few places that were then tested better, and a few lines that did nothing and were taken out. Everything was measured and tested in Chromium and in test stand-ins: **not on the Pi, not in the Electron window, not on Windows**.
