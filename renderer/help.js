// App Settings > Help: a welcome with the first steps, then a folder for every part of the app.
// The text is written here once (SECTIONS); html() draws it and render() makes it work on screen.
// Pure apart from render(), so tests/help.test.js can read all of it without a screen.
const Help = (() => {
  // Folders are closed until the person opens one; what was opened stays open while the app runs.
  const opened = new Set();
  // Help follows the same visual language as Race Setup and the Audio editor.
  // Mixed-topic folders intentionally stay neutral rather than pretending to be one system.
  const SYSTEM_TONE = {resources:'resources',resourcerecovery:'resources', servicestop: 'fuel', penaltytiers: 'penalty', endurance: 'endurance', damage: 'damage', carfailures: 'damage', fuel: 'fuel', fuelwidgets: 'fuel', bop: 'bop', weather: 'weather', wxwidgets: 'weather', tyrewear: 'tyrewear', customtyres: 'tyrewear', tyretemperature: 'tyrewear', safetycar: 'safetycar', pushsave: 'pushsave', tokens: 'tokens' };

  // The first thing under the Help tab (the quick start).
  const WELCOME = `<section class="helpwelcome" aria-labelledby="hw-title">
    <div class="hw-head"><h3 id="hw-title">Welcome to SlotForge Timing</h3></div>
    <div class="hw-body">
      <p class="hw-lead">To get racing with your own track, driver and cars, follow these quick steps:</p>
      <h4>How do I get started?</h4>
      <p>There are default settings for everything, so you can dive right in. As soon as you have a race setup, click <b>Start race</b> on the Home tab (a Time Token Session says <b>Open the session</b>). Make sure to set up your Trackmate interface first, under the <b>App Settings</b> tab, in <b>Timing Hardware</b>.</p>
      <p>Approach the App like you would a physical track. You start out with a track, so add one on the Database tab under Tracks.</p>
      <ol class="hw-steps">
        <li><b>Add a track</b> under Database, Tracks. You are presented with a bunch of options you can skip for now: a name and the number of lanes are all you really need. The track length might be useful.</li>
        <li>Then <b>add a driver and a slot car</b>. Skip all other options for now.</li>
        <li><b>Set up a race</b> under Race Setup. Give it a name, pick the Kind of session and your track, and hit Save.</li>
        <li>Go back to <b>Home</b>, pick your race, choose a driver and a car for every lane and hit <b>Start race</b> (<b>Open the session</b> for a Time Token Session).</li>
      </ol>
      <p>This sets up a basic race. For more in-depth explanations of the possibilities, read the information below.</p>
      <p class="hw-tip"><b>No Trackmate yet?</b> You can still try everything: tick <b>Simulated cars</b> on the race screen, or press the number keys 1 to 8 to count a lap for a lane.</p>
    </div>
  </section>`;

  // [group heading, [folders]]; a folder is { id, title, note, body }
  const SECTIONS = [
    ['Setting things up', [
      {id:'resources',title:'Resource Systems',note:'Tyre sets, repair credits and spare components',body:`<ul><li>Create a profile in <b>Race Setup › Resource Systems</b>, then select it under <b>Rules and Systems</b>. Choose a driver, slotcar or team as owner. Every entry needs that database assignment.</li><li>Choose one race (each heat), the whole event (including finals), or a whole championship. For championship supplies, load the session from its championship on Home. Accounts follow their owner through lane changes; team accounts stay shared through driver swaps.</li><li>The starting tyre set counts. Completed tyre changes use a new set. Resource tyre limits replace Tyre Wear’s set limits when enabled; wear, weather, service time and mandatory stops still apply.</li><li>A completed damage repair uses one repair credit. A completed failure repair uses one repair credit and one component, when those limits are enabled. Components are a generic allowance. Insufficient stock leaves the affected work undone.</li><li>Enable the optional Resource shortage call in Audio Settings. During a race, open <b>Resources</b> for balances, history and signed director adjustments with a reason. After an exhausted tyre stop, grant stock and make another stop. Repair work can continue in the current stop after a grant.</li></ul>`},
      {id:'resourcerecovery',title:'Resource history & recovery',note:'Persistent balances without duplicate charges',body:`<ul><li>Balances and the recovery checkpoint are saved together. Restoring a race does not charge the same service twice. A storage failure pauses racing; retry saving in the Resources folder before resuming.</li><li>Profile edits apply to new allocations. Existing championship balances do not refill. Use recorded director adjustments for corrections.</li><li>Awarding or undoing points, discarding a race, or deleting results does not refund consumed supplies. Race results keep a copy of the resource history. Full database backups include all balances; exporting a setup transfers its rules, not its spent inventory.</li><li>Resources are fixed for the current event. To switch them off, select Off in Race Setup before the next event. Time Token Sessions do not use Resource Systems. Virtual rivals do not consume physical supplies.</li></ul>`},
      {id:'multiclass',title:'Multi-Class Systems',note:'Entry classes and separate competitions',body:`<ul><li>Create a system in <b>Race Setup › Multi-Class Systems</b>. Add named, coloured classes. Select the system under <b>Race Setup › Rules and Systems</b>.</li><li>In <b>Database → Slotcars → Basics → Race Class</b>, choose or create a label such as GT3 or Prototype, then save the car. Multi-Class setups list all Race Class labels; only classes with labelled slotcars can enter a new driver-assigned system. Select the competing classes and assign each participating driver to one class. Home offers only assigned drivers and matching slotcars; changing the driver clears an incompatible car. Every driver sharing a team/endurance car must be assigned to the same class. Missing assignments or mismatched cars block starting. Existing systems keep their legacy rules until you choose <b>Use driver assignments and matching cars</b> and save.</li><li>Assignments lock at event start, survive lane rotations and driver swaps, and are saved with results. Later database changes do not rewrite history.</li><li>Mixed heats share the track. Separate heats split the existing plan by class, retaining lane assignments; this can add heats and empty lanes. Separate class heats cannot use overall A/B finals.</li><li>One shared race clock and finish rule remain in force. Virtual rivals are comparisons, without official class positions or points.</li></ul>`},
      {id:'classlabels',title:'Managing Race Class labels',note:'Delete unused labels and clear current assignments',body:`<ul><li>Use <b>Delete class</b> in the Classes folder, or expand <b>Race Class labels</b> on the systems list, to remove obsolete labels. Confirmation shows affected cars, defaults and systems. Deletion clears current links immediately; leaving the editor does not undo it. Recorded results and events already started retain their saved classes.</li><li>Labels with no slotcars remain visible here so you can remove them. Unchecking a class only leaves it out of this system; Delete class removes the shared database label.</li><li>Exporting historical race results includes their saved class definitions. Importing those results adds the required labels to the destination database.</li></ul>`},
      {id:'classpoints',title:'Class points and displays',note:'Overall and class scores are never combined',body:`<ul><li>Choose overall points, class points, or both. Class positions determine class points. An empty class table uses the heat or championship table. Each class can override it.</li><li>Heat bonuses, best/dropped heats and ties are recalculated inside each class. Championship guests, fastest-lap and pole bonuses, sprint shares, dropped rounds and team rules use their existing rules within the class.</li><li>Award or undo a saved championship session once for every classification. Use the classification selector to preview its class awards and view class season standings.</li><li>The Leaderboard Editor can show overall, one class or grouped classes. Add Class, Class position, Class gap, Class points and Class best lap cells. Results retain the overall Victory Spotlight and show class winners.</li><li>Enable class announcements in both the system and the Audio Set. Class colours are badges; lane colours retain their usual meaning.</li></ul>`},
      {id:'virtualrivals',title:'Virtual Rival Systems',note:'Recorded opponents linked to drivers',body:`<ul><li>In <b>Race Setup › Virtual Rival Systems</b>, choose a saved session, driver and (for heats) one heat. Select a lap range and whether to retain pit laps. Invalid and red-flag laps are excluded.</li><li>The recording is copied into the system: deleting the source session does not break it.</li><li>Create a separate driver in <b>Database › Drivers</b>, choose <b>Virtual</b> and link the system. On Home, choose this virtual driver in a normal lane row. That lane has a <b>Rival Setup</b> selector instead of a car: keep the driver default or choose a saved replay for this race setup. The override does not change the driver in the Database. The replay fills that display lane and ignores sensor input. It must match the track. Keep at least one human driver in each race or heat; team swaps and Time Token sessions require human drivers.</li><li>100% replays original speed; 110% divides lap times by 1.1. Choose finish, repeat, or continue at a reference lap.</li></ul>`},
      {id:'rivalracing',title:'Racing with virtual rivals',note:'Clock, classification and physical records',body:`<ul><li>Replay starts with the race clock. Pauses and red flags freeze it; yellow flags keep it running. Sensor first-lap behaviour only applies to physical cars.</li><li>Comparison rivals do not change positions. Competitors receive positions in this race. Optionally let a competitor trigger a leader-finish race.</li><li>Replay restarts each heat. Physical heat and championship points remain separate; virtual rivals earn no competition points. Their Total Time can show this heat, but a cumulative all-heats time is unavailable. Gap widgets support time, estimated laps, or both for lap-based races.</li><li>Fuel, tyres, weather, damage and pit work are already represented by recorded lap times and are not charged again.</li><li>Results keep virtual opponents separately. Their laps never become physical track records, human personal bests or car mileage.</li></ul>`},
      { id: 'home', title: 'The Home tab', note: 'Pick a race and start it', body: `
        <ul>
          <li>Pick a <b>race setup</b>, then choose a <b>driver</b> and a <b>car</b> for every lane. In a heat-based race you add participants instead. A lane has the colour of its layout.</li>
          <li>The start lights under the lanes light up as lanes get ready. A row says what it needs; the rest is above the button, so you know why <b>Start race</b> is greyed out.</li>
          <li>If a <b>qualifying</b> was driven on the same track, its winner picks their lane first.</li>
          <li>The band at the top shows the date and the track, and lights for the <b>Trackmate</b> or box, the network and the <b>audio set</b>.</li>
          <li>The cards: the <b>record to beat</b> on this track, the <b>last race</b>, <b>At a glance</b>, <b>Recent races</b> (click one to open its results), <b>Fastest laps this week</b>, <b>Records on all tracks</b>, <b>Top drivers</b>, <b>Personal bests</b> of the drivers in the lanes, <b>Rules of this race</b> and <b>Shortcuts</b>, <b>Car Mileage</b> (laps and distance per slot car) and <b>Service Due</b> (click a car to open it). Most come from saved races, not Time Token Sessions. <b>Weather</b>, <b>Tyres Available</b> and <b>Notes</b> are for show: you type them in <b>Customize</b>.</li>
          <li><b>Customize</b>, in the band, sets up the cards like the Leaderboard page: pick the grid with the little squares and a card for every cell (a card can cover more cells). <b>Back to the usual Home</b> undoes it.</li>
          <li>When a race was stopped by a crash or a power cut, a note at the top offers <b>Resume the race</b> (it comes back paused, press Space to go on; a heat race keeps its finished heats), <b>Save what was recorded</b> or <b>Delete it</b>.</li>
        </ul>` },
      { id: 'database', title: 'Database', note: 'Tracks, drivers and slot cars', body: `
        <ul>
          <li><b>Tracks</b>: a name and the number of lanes are needed. The rest is optional: scale, surface, a picture and the <b>track length</b>. Type the length in (in feet if you chose feet), or let the calculator work it out from the pieces of your track. With a length, the Slotcar Speed widget can show speeds. A <b>lane length modifier</b>, or the length of every lane, gives each lane its own length. A <b>minimum and maximum lap time</b> lets the app ignore crossings that cannot be a real lap.</li>
          <li><b>Drivers</b>: a name, and if you like a nickname, a three-letter callsign, a date of birth, a country flag and an avatar.</li>
          <li><b>Teams</b>: drivers who race together (see Teams, below).</li>
          <li><b>Slotcars</b>: a brand, manufacturer or model, scale, motor, tyres, gearing, weight and pictures. <b>Statistics</b>: a service interval (with a Reset button, and a <b>Service due</b> mark), mileage, wins, deslots and the best lap per track.</li>
          <li><b>Extra fields…</b> on every list adds fields of your own (text, number, date or pick-list). The forms are in folders you can keep closed.</li>
          <li><b>View settings</b> (on every page) opens a small bar where you turn the columns of the list, or the rows of the cards, on and off. It is kept for each page and view.</li>
          <li>Click a <b>row or a card</b> of Slotcars, Tracks or Drivers to see all of it in a window, like a trading card: the main picture, the details, the statistics and (slotcars) the other pictures, which you can click to see large. <b>Edit</b> opens the form.</li>
        </ul>` },
      { id: 'settingsnavigation', title: 'Finding your App Settings', note: 'Page rails and section folders', body: `<ul>
          <li>General, App Theme, Race Director, Network, and Import and Export use the same page frame as the timing interfaces. Pick a section in the side rail to open its folder. On narrow screens, those section buttons move above the folders.</li>
          <li>Folders keep their open state while you work, including when a setting redraws the page. General and Import and Export also offer <b>Open all</b> and <b>Close all</b>.</li>
          <li>Settings save as you change them. Import, export and backup actions still need their own buttons. Import adds copies; restoring a complete backup replaces the database and asks for confirmation.</li>
        </ul>` },
      { id: 'copyandorder', title: 'Copying setups and finding records', note: 'Independent copies and alphabetical lists', body: `<ul>
          <li>Tracks, Drivers and Slotcars appear alphabetically in both List and Grid views. Sorting ignores capital letters and treats numbers naturally: Car 2 comes before Car 10. Slotcars use their displayed brand, manufacturer and model.</li>
          <li>Use <b>Copy</b> beside Edit to make a separate Race Setup or saved system with the same settings. Copies are named “(copy)”, then “(copy 2)” and so on; edit the copy to rename it. Chosen tracks and linked systems stay selected. The original is unchanged.</li>
          <li>Some specialised editors call this action <b>Duplicate</b>. Balance of Power and Time Tokens are shared settings rather than saved setup lists.</li>
        </ul>` },
      { id: 'results', title: 'Results and Records', note: 'What has been driven', body: `
        <ul>
          <li>Find <b>Racing Records</b> and <b>Token Records</b> in the last Database sub-tab. They are separate pools, so a token lap never changes a racing record.</li>
          <li><b>Track records</b>, <b>Personal bests</b> and <b>Sessions</b> (called <b>Stints</b> for tokens) keep the results. Open a session for standings, laps, median and average lap, consistency, speed, distance, pits and penalties.</li>
          <li>An invalid, removed or out-of-range lap stays visible with a strike-through. It never counts for results records, a Personal Best or a Track Record. This includes the lap interrupted by a red flag.</li>
          <li><b>View settings</b> chooses table columns. <b>Export to PDF</b> chooses the results, heats, laps and columns to print.</li>
          <li>A trophy marks a race winner (not in practice or qualifying); an adjusted result says so beside the driver. <i>Total time</i> is also available as a Leaderboard sort.</li>
        </ul>` },
      { id: 'calculations', title: 'Calculations', note: 'Understand and choose the rules behind the numbers', body: `
        <ul>
          <li><b>App Settings → Calculations</b> offers seven coloured sections with formulas, saved-system controls and interactive examples. Preview inputs never change a race.</li>
          <li>Choose independent Push &amp; Save and Tyre Wear benchmarks: median, average, recent-weighted, trimmed average, previous, best or Track target. Set history and minimum samples. The current lap never becomes its own reference.</li>
          <li>Weighted averages favour newer laps. Trimmed averages remove 10% at each end, rounded down; fewer than ten samples use an ordinary average. Automatic sampling requires three laps for averages/median, one for previous/best; Track target needs none.</li>
          <li><b>Tyre pace response</b> can use system strength or bounded custom limits. Choose both pace contributors or one; this does not enable a disabled system. Fuel remains independent.</li>
          <li><b>Estimates</b> chooses median/average and history for lap gaps and Fuel Range. Fuel needs three samples. Zero history keeps all gap laps or each fuel widget’s setting.</li>
          <li>Save applies to new races. Running and recovered races keep their starting rules. Restore defaults fills the form; Save confirms it. Full-yellow saving never teaches the normal benchmark.</li>
        </ul>` },
      { id: 'servicestop', title: 'Service Stop', note: 'Remove the car while its pit stop stays active', body: `
        <ul>
          <li>In <b>Race Setup &gt; Service Stop</b>, switch it <b>On</b> to work on the real car while a stop stays active. It works without any race systems. <b>Off</b> keeps normal sensor-controlled pits and retains your settings.</li>
          <li>Cover the sensor until pit entry is confirmed. The fixed service timer starts then; remove the car for service. Its lap and pit triggers are ignored, but hardware monitoring keeps working.</li>
          <li>Fuel, tyres and repairs can run <b>at the same time</b> (longest timer wins), <b>one after another</b>, or use each system's choice. That schedule fits into your fixed service time. <b>Penalty time always adds afterward</b>. Driver swaps keep their own rules.</li>
          <li><b>Automatic</b>: after the timer and penalties, drive off the sensor. With <b>Wait for car to return</b>, place the car back on the sensor first; without it, an already clear sensor releases the stop. <b>Manual</b>: put the car back, then press <b>Release car</b> in Pit stops on the Race tab or Race Director.</li>
          <li>Pausing freezes the timer. <b>Release early</b> is confirmed and logged; unfinished work and early-departure penalties remain. Clear a covered sensor after release to rearm it.</li>
        </ul>` },
      { id: 'setups', title: 'Race Setup', note: 'Race setups, fuel, penalties, balance of power and time tokens', body: `
        <ul>
          <li><b>Race Setups</b> bring together a session's track, format, end rule, systems, screens and audio. The coloured system tabs hold reusable rules; choosing one does not change the others.</li>
          <li><b>Session</b> chooses Practice, Qualifying, Race or Time Tokens and, for a race, One race, Heats or team swaps. <b>Race Settings</b> makes the track prominent and sets the end, winner, pit-sensor block time, Track Call and red-flag restart.</li>
          <li><b>Race Settings</b> also controls the start sequence: set the shortest and longest <b>Start Lights Off Timer</b>; the lights then follow the racing flags. <b>First Lap Behaviour</b> either starts timing on the first crossing or counts it as a lap.</li>
          <li>In <b>Rules and Systems</b>, every selected system has its own switch. Turn it off for this race without losing its saved setup. Balance of Power is last. <b>Service Stop</b> is independent and can be on or off.</li>
          <li><b>Race UI and Audio</b> chooses the main Timing Page/Race Screen, the Second Display and the Audio Set. <b>Advanced</b> holds timing-hardware options and mirrors the Track Call choice.</li>
          <li>The system tabs are: <b>Fuel Systems</b>, <b>Penalty Systems</b>, <b>Damage Systems</b>, <b>Safety Car Systems</b>, <b>Tyre Wear Systems</b>, <b>Weather Systems</b> and <b>Push &amp; Save Systems</b>; Rotation Setups and Time Tokens have their own tabs.</li>
        </ul>` },
      { id: 'setupwords', title: 'Race Setups in words', note: 'Cards, kinds and the sentence in the form', body: `
        <ul>
          <li>Every setup has an <b>In plain words</b> sentence that changes with the settings. The status dot is green when it can start, amber when something essential is missing and an open ring when nothing was changed.</li>
          <li><b>List</b> and <b>Cards</b> change the overview. <b>Start from a kind</b> makes a setup with Practice, Qualifying, Race or Time Tokens already chosen.</li>
          <li>The left rail opens each section: Session, Heats, Race Settings, Driver swaps, Rules and Systems, Service Stop, Race UI and Audio and Advanced. The note beside each row is a quick summary; click it to jump there.</li>
          <li>Buttons and cards choose a small set of options; switches turn one rule on or off. <b>Used by</b>, below the rail, lists championships that use the setup. Older setups stay compatible.</li>
        </ul>` },
      { id: 'types', title: 'Kinds of session', note: 'Kind, Format and Swaps', body: `
        <ul>
          <li>A race setup asks three short questions: the <b>Kind of session</b>, the <b>Format</b> of a race (<b>One race</b> or <b>Heats</b>) and <b>Teams swap drivers in the pits</b>. They replace the old Session type list; older setups open as they were.</li>
          <li><b>Free practice</b>: no finish. It runs until you stop it and ranks the drivers by their best lap.</li>
          <li><b>Qualifying</b>: a timed session ranked by best lap. Two drivers with the same best lap: the one who set it first ranks higher. Its winner picks their lane first in the next race on the same track.</li>
          <li><b>Race</b>: over after laps, a distance or a time (<i>The race is over after</i>). Laps or distance: the first to reach them wins; the race ends when the lead car finishes, or when every car has (see Distance races). A time: when it is up every car finishes on its next crossing of the line (that lap counts), and the most laps wins, then the lowest total time (or <i>Cars are compared by</i> Distance, see Time races by distance).</li>
          <li>The <b>Format Heats</b>: several heats, each over after laps, time or distance; the overall result adds the heats up (see Heat races, below).</li>
          <li><b>Teams swap drivers in the pits</b>: a long race for teams, where the drivers of a team swap at the wheel in the pits (see Endurance Race, below).</li>
          <li><b>Time tokens</b>: not a race. You sell track time per lane (see Time Token Sessions below).</li>
        </ul>` },
      { id: 'distance', title: 'Distance races', note: 'Race for a distance, not for laps or time', body: `
        <ul>
          <li>A race, the heats of a heat-based race and an Endurance Race can be limited by a <b>distance</b>: choose it under <i>The race is over after</i> (or <i>Each heat is over after</i>). The laps follow from the length of each lane (Database, Tracks: the track length and the lane lengths). Home says when a track has none.</li>
          <li><b>The lanes drive</b> the same distance (a shorter lane drives more laps), the same number of laps, or a distance you set for each lane. A car is only seen at the line, so it drives whole laps: on to the line after the distance, or to the nearest lap.</li>
          <li>The first car to drive its distance wins. The others rank by the distance they drove, and a gap is the time between two cars at the same distance. <i>The race may take at most</i> is a safety net.</li>
          <li><b>Driver swaps by distance</b>: in an Endurance Race choose <i>Distance</i> for the swaps. A swap is due after so many metres (or feet), <i>at the line</i> or <i>anywhere on the track</i> (worked out between two crossings). <b>Driver Swap Timer</b> shows "Swap in 12 m"; <b>Driver Swap Signal</b> flashes "Alex → Sam" until the swap is made. The results give every driver's distance.</li>
          <li>The Layout Editor folder <b>Position and Progress</b> has Distance Driven, Distance To Go and Laps To Go. <i>Smoothly</i> counts between two crossings from the lap time; <i>exact</i> changes at the line. They work in any race with laps. The text widgets know {distance}, {distleft}, {lapstogo} and {racedistance}.</li>
        </ul>` },
      { id: 'comparedist', title: 'Time races by distance', note: 'Rank a race or heat of a set time by the distance driven', body: `
        <ul>
          <li>A race or a heat limited by a <b>time</b> has the setting <b>Cars are compared by</b>: <i>Laps</i> (the standard) or <i>Distance</i>.</li>
          <li>By distance the car that drove the furthest wins: the laps times the length of its lane (Database, Tracks). A shorter lane takes more laps for the same distance, so this is fairer when the lanes differ. With the same distance, or with laps the same laps, the shortest time wins.</li>
          <li>The time ends the race as before: when it is up, every car finishes on its next crossing of the line, and that lap counts.</li>
          <li>Every lane needs a length: Home says when one has none, and the race can not start. The heat results keep the metres of every car, and a saved result says it was ranked by distance.</li>
        </ul>` },
      { id: 'heatraces', title: 'Heat races', note: 'How the heats are planned', body: `
        <ul>
          <li><b>How the heats are planned</b> has four choices: you choose the number of heats; <b>every driver races the same number of heats</b> (you say how many); <b>round robin</b>, where every driver meets every other driver (with <i>Give everyone the same number of heats</i> on, a few heats are added so nobody races less than the busiest driver); or <b>lane rotation</b>, where every driver races once in every lane. In every plan the lanes are shared as evenly as possible.</li>
          <li>To make the plan yourself, choose a <b>Rotation setup</b> in the race setup. Then the settings that plan the heats are not used.</li>
          <li><b>Who races together</b> can use the latest qualifying on the track: the fastest drivers together (the best heat last), or every heat with fast and slow drivers mixed.</li>
        </ul>` },
      { id: 'heatplan', title: 'Heat plan and break', note: 'See, change and time the heats', body: `
        <ul>
          <li>On the Home tab a <b>Heat plan</b> shows the heats by lane, how often every driver races and in which lane; <b>Shuffle again</b> makes another plan, and the plan you see is the plan that is raced. To change the plan yourself, click a place and then another place: the two swap (a place with a dash is empty, so a driver can move there). A driver can not race twice in a heat. <b>Reset my changes</b> brings back the plan that was made; changing the number of participants or the heat settings makes a new plan.</li>
          <li>On the Race tab the <b>Heat list</b> shows every heat with its drivers by lane, the heat that is racing or next, and for a finished heat its winner and the points, laps or times. The <b>Heat List</b> widget shows it on the Live Race page, and the <b>Next Heat</b> widget shows only the drivers of the heat that comes next, with their lanes (before the start, while a heat is racing and between two heats, with the countdown of the break; "Race finished" after the last). <b>Print the heat list</b> (also on Home) makes a PDF sheet. The audio call <b>line-up</b> reads the drivers of the next heat.</li>
          <li><b>Break between heats</b>: with a number of seconds, the race counts down after each heat (the Race Info widget and the Live Race page show "next heat in 1:30"). <b>The start lights begin by themselves when the break is over</b>, off or on: off waits for Start; Start (Space) always starts the next heat at once, and Stop ends the race.</li>
        </ul>` },
      { id: 'rotation', title: 'Rotation setups', note: 'Make your own heat schedule', body: `
        <ul>
          <li>Under <b>Race Setup</b>, on the <b>Rotation Setups</b> tab, you make a heat schedule by hand: set the <b>Size</b> (up to 64 <b>participants</b>: <b>Add a participant</b> adds one, and the <b>×</b> in the list of names takes one out) and the <b>lanes</b>, then <b>drag</b> a participant onto a place (heat and lane), or click a participant and then a place. Drag a place onto another, or click two places, to swap them; drag a place back onto the participants to empty it, and a heat by its grip to move it. Each participant has a colour. Pick one to give it a name.</li>
          <li><b>Groups</b> put some participants in a heat at once. <b>Lock</b> keeps a heat where it is when you shuffle; the <b>⋯</b> button of a heat copies, empties or deletes it. The <b>Tools</b> menu has <b>Shuffle the heat order</b>, <b>Shuffle the lanes</b> and <b>Even out the lanes</b>, and <b>Start from a plan</b> (four plans) fills the heats for you. A warning can come with a button, such as one that adds a heat for participants who race none. Undo and Redo (Ctrl+Z, Ctrl+Y) take a change back.</li>
          <li>Choose the rotation in a race setup (<b>Rotation setup</b>, in Ends and winner). On the Home tab the participants are the rows (drivers, or teams when you set <b>The participants are</b> to Teams). Tick <b>Not here today</b> for anybody who does not come: the others stay in their places and an empty heat is left out. The track needs as many lanes as the rotation uses. <b>Pick the drivers by name</b> uses the rotation's names. Finals work as in every heat race.</li>
        </ul>` },
      { id: 'teams', title: 'Teams', note: 'Drivers who race together', body: `
        <ul>
          <li>On the <b>Teams</b> page of the Database you make a team: a name, a picture and its drivers, in the order they take their turn. A driver can be in more than one team. A driver who is deleted leaves his teams.</li>
          <li>On the <b>Home tab</b> a session with teams (an Endurance Race, or heats whose participants are teams) has a <b>Team</b> on every lane; the driver is then one of the team. A session without teams has no Team choice. The <b>Team Name</b> and <b>Team Picture</b> widgets show the team of the lane (or one team you choose), {team} works in custom texts and audio calls, and the results get a Team column.</li>
          <li>The participants of a heat race can be <b>teams</b>: choose Teams in the race setup (<b>The heats are raced by</b>) or in the rotation setup (<b>The participants are</b>, which wins). On Home you choose a team and a car for each. In every heat one driver of the team drives: <b>in turn</b>, <b>by lot</b>, or the one you choose before the heat.</li>
          <li>A driver who is in two teams drives for one of them in a heat. The result has a row per team with the drivers who drove for it; every lap still counts for the driver who drove it.</li>
        </ul>` },
      { id: 'endurance', title: 'Endurance Race', note: 'Teams that swap drivers in the pits', body: `
        <ul>
          <li>Choose <b>Race</b> and turn on <b>Teams swap drivers in the pits</b> (an Endurance Race). A team shares one car, and its drivers take turns. Give every lane a <b>Team</b> on Home. The race is by time, by laps, or heat by heat (the Format <b>Heats</b>).</li>
          <li>The folder <b>Driver swaps</b> of the race setup says when a swap is due: <b>every so often</b>, <b>at fixed moments</b> (30 minutes, 2 hours), or <b>free</b> within the shortest and longest stint. Count them in minutes, in laps or in distance (see Distance races). You can also set the least and the most a driver drives in the whole race.</li>
          <li>The swap is made when the car stops on the pit sensor, or when <b>Swap done</b> is pressed on the Race Director page or a phone. The driver who steps in is the next one in the team's order, chosen at each swap, or picked by lot.</li>
          <li>When the swap is late, the laps keep counting or stop counting, and the team can get penalty points (they need a penalty system), again and again if you like.</li>
          <li>The widgets <b>Current Driver</b>, <b>Next Driver</b>, <b>Driver Swap Timer</b> (amber before the swap is due, red when it is late) and <b>Driver Swap Signal</b> (a big SWAP, flashing) show it on the timing page (folder <b>Team and Swaps</b>). The audio folder <b>Endurance</b> says "{team} needs to swap positions! Box Box!" and who came in and who took over.</li>
          <li>The results show every driver's time at the wheel and stints. A race that a crash or a power cut stops, also a heat race, can be continued from the Home tab.</li>
        </ul>` },
      { id: 'damage', title: 'Damage System', note: 'Damage points, and the stop in the pits that repairs them', body: `
        <ul>
          <li>A damage system (Race Setup, <b>Damage Systems</b>) gives cars <b>damage points</b>. Every <b>level</b> (Light damage from 3 points, Medium from 6...) says how long the car must stand still on the pit sensor to be repaired, whether it should pit <b>whenever it can</b> or <b>as fast as it can</b>, and can have a deadline in laps. The highest level reached counts. Choose it in the race setup (<b>Damage system</b>); it works in a race and a timed race.</li>
          <li>Points come from <b>incidents</b> (Contact +2, Hard crash +4: buttons on the race screen, the Race Director page and phones, and -1 to take a point back) and from a <b>deslot</b>: fill in the <b>Deslot time</b> of the track (Tracks, Lap time limits) and every slower lap gives the points of the system.</li>
          <li>After the stop the damage is gone. The repair can run <b>at the same time</b> as refuelling and a driver swap, or <b>after</b> them. A car that leaves too early keeps its damage; with a penalty system that, and a lap after the deadline, cost penalty points.</li>
          <li>A level can <b>retire</b> or <b>disqualify</b> the car when it stops in the pits; its laps count until then. A slot car with a <b>Damage factor</b> above 1 takes more damage.</li>
          <li>The widgets <b>Damage</b> and <b>Repair Timer</b> (Layout Editor, folder <b>Slotcar</b>), {damage} in texts, and the audio folder <b>Damage</b> show and say it. The results list the points, repairs and time in the pits, in a heat race per heat too.</li>
        </ul>` },
      { id: 'carfailures', title: 'Car Failures', note: 'Failures that strike a car at random, and the stop that clears them', body: `
        <ul>
          <li>A <b>Damage System</b> can have <b>Car Failures</b>: faults that strike a car at random, without a hit. Switch them on in the folder <b>Car Failures</b> of the system (off to begin with). The standard four: Lift and Coast, Slow Puncture, Brakes not working, Engine Failure, Box to Retire (<b>Add the standard failures</b> brings them back).</li>
          <li>A failure has a <b>name</b>, a <b>level</b> (its rules: pit whenever you can or as fast as you can, a deadline in laps, repair, retire or disqualify), a <b>chance</b> and <b>Stand still (s)</b>, the seconds on the pit sensor that clear it.</li>
          <li>The chance is that a car gets the failure at some point in the race: 5% is about 1 car in 20. It is rolled at the start, at a random moment between the <b>earliest</b> and <b>latest moment</b> (% of the race), never in the first or last lap; <b>Failures for a car in a race, at most</b> is the limit. A slot car with <b>Failure factor</b> 2 has twice the chance, 0 never has one.</li>
          <li>A failure adds <b>no damage points</b>. One stop clears it and any damage (the longest job counts, or both after each other, as the damage system says). Leaving early, or a lap late, costs penalty points like damage.</li>
          <li>On the race screen and the Race Director page the folder <b>Car Failures</b> can <b>Give</b> a car a failure (chosen, or at random) or <b>Clear</b> it; clearing also brings back a car a failure retired.</li>
          <li>The widget <b>Car Failure</b> (folder <b>Slotcar</b>), <b>{failure}</b> in texts, the audio folder <b>Car Failures</b>, the log and the results show it.</li>
        </ul>` },
      { id: 'systemforms', title: 'Penalty, Damage, Weather and Tyre wear systems in words', note: 'The form with a rail, in the colour of the system', body: `
        <ul>
          <li>The form of a <b>Penalty</b>, <b>Damage</b>, <b>Weather</b> or <b>Tyre Wear System</b> looks like the form of a race setup, in the colour of its tab: yellow for penalties, red for damage, blue for weather, purple for tyre wear. They stay separate systems.</li>
          <li>At the top: the name, pills with the main facts, and <b>Ready to use</b> (green) or <b>Give it a name</b> (amber). <b>In plain words</b> reads the system back to you and changes while you type.</li>
          <li>The <b>rail</b> has a row for each section with a note and a dot: green is filled in or changed, amber is something missing, an open ring is nothing changed. Penalty: Basics, Special penalties, Disqualification and fuel. Damage: Basics, Levels, Incidents, and under <b>Only if you need it</b> Car failures and Penalty points. Weather: Basics, The rain, Tyres and penalties, and under <b>Only if you need it</b> Hindering the cars and Track conditions. Tyre wear: Basics, The tyres, What worn tyres do, Pit stops, and under <b>Only if you need it</b> Wear in the weather, Mandatory stops, Sets of tyres and Warnings.</li>
          <li><b>Used by</b> lists the race setups that use the system. Penalty says what 12 points come to in seconds, Damage draws the levels as a bar, Weather draws the rain over the race, Tyre wear says how long a new tyre lasts. What is stored does not change, so every system opens as it was.</li>
        </ul>` },
      { id: 'systemformsmore', title: 'Safety car, Push and save and Fuel systems in words', note: 'The same form, in orange, lime and green', body: `
        <ul>
          <li>The form of a <b>Safety Car</b>, <b>Push and Save</b> or <b>Fuel System</b> has the same frame as the other systems (see the folder before this one), in the colour of its tab: orange, lime and green. They stay separate systems, and what is stored does not change, so every system opens as it was.</li>
          <li>Safety car: <b>Behind the Safety Car</b> (a reference Track, target pace, the penalty points and quicker pit work) and, under <b>Only if you need it</b>, <b>Random Flags</b>. The rules apply whenever yellow is raised, including Track Call. A bar shows where in the race a flag can come, and the words say how many flags and how long each lasts.</li>
          <li>Push and save: <b>Basics</b> (three ready-made systems as cards), <b>Pace</b> (a bar from flat out to the most saving pace), <b>Wear</b>, and under <b>Only if you need it</b> <b>Which laps count</b>. A most saving pace that is not above the normal pace is told at once and cannot be saved.</li>
          <li>Fuel: <b>Basics</b> has tank capacity, fuel per lap and refuel speed, with live estimates for a full tank and an empty-to-full stop. <b>Pace reference</b> optionally takes a Track target time or a Manual time for Push &amp; Save. <b>Empty tank</b> says what happens when there is no fuel left.</li>
        </ul>` },
      { id: 'heatresults', title: 'Heat results', note: 'How the heats add up', body: `
        <ul>
          <li><b>How the heats are added up</b> can be <b>Total</b> (all heats), <b>Average</b> (the <b>average per heat</b>, fair when drivers race a different number of heats) or <b>Best heats</b> (<b>only the best heats</b> of every driver). <b>Drop the worst heat</b> takes away each driver's worst heat. With points you can give <b>bonus points for the fastest lap</b> of a heat. <b>A tie is decided by</b> chooses between the other measure, the fastest lap, the most heat wins and the lowest total time.</li>
          <li><b>The overall winner is</b> follows how the heats are limited. <b>Heats of a time</b>: the most laps wins, then the lowest total time (when the cars are compared by distance: the furthest total distance, then the lowest total time). <b>Heats of laps or a distance</b>: <b>total time, then laps</b>: the lowest total of the finish times wins. Points are there for every kind of heat.</li>
          <li>A driver who did not finish a heat ranks below those who did, by laps, or, with <b>A heat that is not finished</b> on estimate, gets a finish time worked out from their own average lap. Setups from before 1.65.0 count what they counted.</li>
          <li>When something other than the standard is chosen, the race screen, the saved results and the PDF report say how the result was counted and show a <b>Result</b> column.</li>
        </ul>` },
      { id: 'heatfinals', title: 'Finals', note: 'A final A and a final B after the heats', body: `
        <ul>
          <li><b>Finals after the heats</b>: none, a final A, or a final B and a final A. The best drivers of the heat result race the final A, with as many drivers as the track has lanes. The final B is the next group (when at least two drivers are left) and races first. A final has its own length in laps or minutes (0 is as long as a heat).</li>
          <li><b>What the finals decide</b>: the final places (the heat result only decides who races in which final), or the result of the final is <b>added to the heat result</b>. It is not averaged or dropped. Either way the A final drivers stay above the B final drivers.</li>
          <li><b>Before a final</b> the race screen asks the drivers to choose their lanes, the best-placed driver first. The last driver gets the last free lane. <b>Pick the rest at random</b> and <b>Clear choices</b> help. The final does not start, also not by itself after a break, before every lane is chosen.</li>
          <li>The audio sets have two more calls, <b>next final</b> and <b>final finished</b>, and a <b>{final}</b> word.</li>
        </ul>` },
      { id: 'totaltime', title: 'Total time', note: 'How long a driver has been racing', body: `
        <ul>
          <li>The <b>Total Time</b> widget (Layout Editor, folder <b>Lap Times and Records</b>) shows how long a driver has been racing. It counts up from the start and stops when the car has finished: all its laps or its distance driven, or the time is up and the car has crossed the line. A car that is out keeps the time of its last lap, and a car that is still racing when the race is stopped has the time the race lasted.</li>
          <li><i>Time of</i> chooses this race or heat, all heats so far (the heats that are done plus the one that is racing, whatever lane the driver raced in) or both.</li>
          <li><i>Penalties</i> chooses the time the results count (with the time penalties and the corrections of the review) or the time on the clock.</li>
          <li>In a leaderboard row design it is a column like any other. The leaderboard's <b>Order by</b> has <i>Total time</i> for this race or heat and for all heats so far: the shortest time is on top, and the cars that are still racing, or are out, stay below the cars that finished.</li>
        </ul>` }
    ]],
    ['Racing', [
      { id: 'start', title: 'Starting a race', note: 'Lights, flags and the first lap', body: `
        <ul>
          <li>Press <b>Space</b> (or Start). The five lights come on one by one, then go out after a random time between the shortest and longest <b>Start Lights Off Timer</b> values. The race starts as the lights go out.</li>
          <li>Lights follow the racing flags: green while racing, yellow under yellow and red under a red flag.</li>
          <li><b>Red Flag Restart Behaviour</b> is either Start immediately or Countdown Timer. A red-flag interruption marks the affected lap invalid, so it cannot make a fastest lap or record.</li>
          <li><b>First Lap Behaviour</b> either starts timing on the first crossing (Formation Lap) or lets the first trigger count as a lap.</li>
          <li>Track power and the Track Call button follow the behaviour chosen in Race Settings.</li>
        </ul>` },
      { id: 'screen', title: 'The race screen', note: 'Keys, buttons and the end of a race', body: `
        <ul>
          <li>The race screen shows the chosen timing layout; a different layout can go on a second screen. <b>Simulated cars</b> races without hardware.</li>
          <li>Keys: <b>Space</b> starts, pauses and resumes. <b>Y</b> yellow flag, <b>R</b> red flag, <b>S</b> stop (it asks once). <b>1 to 8</b> count a lap for that lane without hardware, <b>Shift + 1 to 8</b> send it into the pit, <b>Ctrl + 1 to 8</b> make a call from it.</li>
          <li><b>Full screen widgets</b> (or <b>F</b>) shows only the widgets, as large as the window allows. <b>Esc</b>, <b>F</b> or the <b>Exit full screen</b> button goes back.</li>
          <li>A race keeps running when you open another tab. A <b>Race</b> tab with a green dot takes you back to it. The keys above only work on the Race tab. Only one race can run at a time.</li>
          <li><b>Review laps</b> marks a lap invalid or deletes it during the race. After a race or heat, the main screen opens <b>Director's Final Check</b>: review laps, disqualify a driver or adjust race time, laps and championship points, then choose <b>Finalize results</b>.</li>
          <li>The second screen, and the finished timing page, show the <b>Race Results</b> Victory Spotlight until a new race starts. It celebrates the winner and compares the facts chosen in Customization.</li>
          <li>Coloured Race Director folders offer Track actions, lane cards, Weather, Tyre Change and Endurance when the race uses them.</li>
        </ul>` },
      { id: 'sectors', title: 'Sectors', note: 'Where a car that did not finish was last seen', body: `
        <ul>
          <li>When the lead car finishes and the race stops, or you stop the race, the cars that did not finish have driven different laps. With the same laps only the order they crossed the line is known. <b>Sectors</b> say more.</li>
          <li>Database, Tracks, the group <b>Sectors</b>: the <b>number of sectors</b> and, if you like, a name for each (separated by commas). <b>Sector 1 starts at the timing line</b>, and they follow in the order the cars drive them.</li>
          <li>In the review, before <b>Finalize results</b>, every car that did not finish has <b>Last seen in</b>: choose its sector. Of two cars with the same laps the one in the <b>later sector</b> ranks higher, but never above a car with more laps (in a race by distance: more distance).</li>
          <li>Two cars in the same sector: the small <b>arrows</b> put one ahead of the other. A car with no sector ranks behind those with one; with no sector chosen the order is as it was: who crossed the line first.</li>
          <li>The result keeps it: <i>11 + sector 3</i> in Results and Records and on the PDF.</li>
        </ul>` },
      { id: 'director', title: 'Race Director, flags and penalties', note: 'Control the race from anywhere', body: `
        <ul>
          <li>The <b>Race Director</b> page (Live Race tab) has Start, Pause, Yellow, Red and Stop, the calls and folders. It also works on a phone or tablet, behind a password.</li>
          <li>The standard view uses <b>lane cards</b>. In <b>Folders</b> view (App Settings, Race Director), open <b>Adjust</b>: pick a lane, then press the pads, <b>[+] value [−]</b>: penalty points, damage points, time, laps, championship points, also during the race. Undo takes the last one back. Values and layout: App Settings, Race Director.</li>
          <li><b>Penalty points</b> use the selected system’s consequence table: added time, deducted scoring laps, mandatory pit stops or a combination. The highest reached level sets the consequence.; <b>Disqualification and automatic points</b> controls limits and empty-tank points.</li>
          <li><b>Special penalties</b> are named buttons that add points and/or time, deduct scoring laps or require a pit stop. Older saved Drivethrough and Stop-and-Go rules retain their original behavior.</li>
          <li>A <b>call from a lane</b> raises the yellow flag and waits for the Race Director, who dismisses it or gives a penalty point.</li>
          <li><b>Safety Car target lap time</b> is set in Safety Car Systems. A full lap under yellow that is too fast is called out, marked in lap review and can cost penalty points. Race Settings chooses Track Call behavior; the retired Yellow flag setup fields are ignored.</li>
          <li>The Trackmate <b>Trackcall</b> button can raise the flags and switch the track power. You choose how in the race setup.</li>
        </ul>` },
      { id: 'lanecards', title: 'Lane cards', note: 'The Race Director, a card for each lane', body: `
        <ul>
          <li>The Race Director (race screen and Race Director page) has a <b>card for each lane</b>: the driver and the car, a chip that says how the car is doing (<i>All clear</i>, <i>+5 s</i>, damage, a failure, <i>Disqualified</i>) and a pad for each of penalty points, time, laps, damage points and championship points that the race has. Two lanes: two cards with the log next to them. Three or four lanes: the log is a drawer (<b>Log</b>). A phone shows one lane: pick it above the card.</li>
          <li><b>[&minus;]</b> and <b>[+]</b> take off or add the <b>first (smallest) value</b> of the list of the pad: 1 point, 5 s, 1 lap, 1 damage point and 1 championship point as the standard. Click the number for the other values and a field for any other amount (<b>Give</b>, <b>Take back</b> or Enter). The lists: App Settings, Race Director (a race setup can have its own).</li>
          <li><b>Undo</b> takes the last press back. <b>Penalty</b> gives a special penalty (it costs points), <b>Damage</b> an incident, <b>Failure</b> a failure (chosen or <b>At random</b>, then <b>Give</b>; <b>Clear</b> takes it away). <b>Hinder</b>, <b>Off</b>, <b>Auto</b> and <b>Help</b> are Balance of Power; the tyre opens Tyre Change. The weather buttons are in the bar above.</li>
          <li>Everything works while the race runs or is paused, with the rules of the old folders. App Settings, Race Director, <b>Race Director view</b> brings the old folders back: <b>Adjust</b>, <b>Penalties</b>, <b>Balance of Power</b>, <b>Damage</b> and <b>Car Failures</b>.</li>
        </ul>` },
      { id: 'fuel', title: 'Fuel and pit stops', note: 'Tanks, refuelling and pit time', body: `
        <ul>
          <li>Choose a <b>Fuel System</b> in the race setup. Set the tank, fuel per lap and refuel speed; the form estimates the empty-to-full refuel time. New systems use fixed fuel per lap before race effects. App Settings chooses the current Push & Save benchmark; a Fuel System’s Track/Manual reference is for legacy Push & Save only.</li>
          <li>Choose what an empty tank does: warn, stop counting until refuelled or retire. It can also award penalty points.</li>
          <li>A <b>pit stop</b> starts after the Pit Stop sensor block time in Race Settings. The tank fills while the car is there. Fuel is optional: pit stops work without it.</li>
          <li>Fuel use itself is steady. Push &amp; Save is the optional system that makes faster laps use more and slower laps use less.</li>
          <li>The <b>Fuel</b> and <b>Pitstop time</b> widgets show the state; the Leaderboard has a Fuel left column. Fuel bars start green when full and gradually turn yellow, then red as fuel runs low, independently of the app theme. The widget's warning and critical thresholds and colours set the transition points (25% yellow and 10% red by default). Number and picture modes keep their own presentation.</li>
        </ul>` },
      { id: 'fuelwidgets', title: 'Fuel Bar styles', note: 'Original, Digital Segments and Reserve Scale', body: `<ul>
        <li>In Layout Editor, select <b>Fuel Level</b> and open <b>Content</b>. Choose Bar or Bar and number, then the Fuel Bar style. Saved layouts keep <b>Original</b>.</li>
        <li><b>Digital Segments</b> offers 8–20 blocks and an optional soft, static glow. The last lit block can be partially filled. <b>Reserve Scale</b> adds empty/full markings and a line at your warning threshold.</li>
        <li>All three work horizontally or vertically. Horizontal bars empty toward the left; vertical bars empty downwards. Values can show litres, percentage, or percentage with litres/capacity. Bar hides the values.</li>
        <li>Warning text can be shown or hidden; Style default shows it on the new styles. LOW FUEL, CRITICAL and EMPTY use your thresholds. Colours remain independent of the theme.</li>
        <li>Small widgets keep the main value readable and omit secondary capacity text and scale labels. Increase the widget size to restore them. Existing fonts, backgrounds, borders and accents still apply.</li>
      </ul>` },
      { id: 'bop', title: 'Balance of Power', note: 'Even out fast and slow cars', body: `
        <ul>
          <li><b>Balance of Power</b> (BoP) hinders a car that is too fast and helps a car that is too slow. It works through the fuel rules, so the race setup needs a <b>fuel system</b> and Balance of Power set to On (races, timed races and heat races).</li>
          <li>A car hindered by 20% uses 20% more fuel a lap and refuels 20% slower (and, if you choose, has a 20% smaller tank), so it pits sooner or has to drive slower. A helped car gets the opposite. It counts from the next lap and the next pit stop.</li>
          <li>Race Setup, <b>Balance of Power</b>: the rail opens <b>Who decides</b>, <b>How much</b>, <b>What changes</b> and <b>Suggest and Automatic</b>. Cards and switches choose the rules; the slider previews both cars. <b>In plain words</b> reads the settings back. Every change is saved immediately. It fine-tunes: a car that is seconds a lap faster will not be caught by fuel alone.</li>
          <li><b>Manual</b>: the Race Director presses Hinder, Help or Off for a lane. <b>Suggest</b>: the app proposes and he presses Accept. <b>Automatic</b>: the app applies it at the lap time difference you set and removes it a little below that. A lane you press stays as you set it until you press Auto.</li>
          <li>The race screen and the Race Director page have the lane buttons. The <b>Balance of Power</b> widget shows it per lane, and the audio set can say it comes on and goes off. The result says what it did, for example hindered 20% (from the start to lap 12).</li>
        </ul>` },
      { id: 'weather', title: 'Weather', note: 'Rain, tyres and pit stops', body: `
        <ul>
          <li>A <b>weather system</b> (Race Setup, Weather Systems) is a spell of rain: it starts after some laps of the leader or minutes, at a random moment, or when the Race Director says so, and lasts as long as you set. Choose one in a race setup (races, timed races and heats).</li>
          <li>The weather goes <b>Dry</b>, <b>Cloudy</b> (the warning), <b>Wet</b>, <b>Clearing</b> and Dry again. The race screen and the Race Director page show it and what comes next; the Race Director can press the four weather buttons there.</li>
          <li>Cars change tyres <b>in a pit stop</b>, from the <b>Tyre choice</b> of their slot car (Database, Slotcars) to Wet (or Intermediate) in Cloudy and Wet, and back in Clearing and Dry.</li>
          <li>In any race, with or without weather, the Race Director can give a car another tyre in the <b>Tyre Change</b> folder (race screen and phone page), for example Soft for Hard in an endurance race. It counts for this race only, unless he ticks the box that changes the slot car in the Database too. With weather only dry tyres can be chosen.</li>
          <li>When it rains a car on dry tyres has to pit within the laps you set, and when it is dry again a car on Wet tyres has to. Otherwise it gets <b>penalty points</b> (needs a penalty system) and can be <b>hindered</b> like with Balance of Power (needs a fuel system). Both add up, to 90% at most.</li>
          <li>The result says what the weather and the tyres did. The audio set has calls for it, and simulated cars change tyres too.</li>
        </ul>` },
      { id: 'wxwidgets', title: 'Weather widgets', note: 'Tyres, forecast and conditions on the timing page', body: `
        <ul>
          <li>Every weather has its <b>conditions</b>: track temperature, air temperature, wind speed and the direction the wind comes from (Weather Systems, folder Track conditions; Celsius and km/h, or Fahrenheit and mph). They change when the weather does. The audio says them at lights out and after every change, and custom text has them as {variables}.</li>
          <li>In the Layout Editor, folder <b>Tyres</b>: <b>Current Tyres</b> (the tyre of a lane's car; amber with "Change tyres" when it has to change). Folder <b>Weather</b>: <b>Weather Forecast</b> (the weather now and what comes next, "Rain in 3 laps") and <b>Track Conditions</b> (temperatures, wind speed and an arrow for the wind).</li>
          <li>They are drawn, or you make <b>picture sets</b> for them in Image Settings (Tyres, Weather, Track conditions). Track Conditions can show your own numbers instead of those of a weather system.</li>
        </ul>` },
      { id: 'tyrewear', title: 'Tyre wear', note: 'Tyres that wear out, and the pit stop that changes them', body: `
        <ul>
          <li>A <b>Tyre Wear System</b> takes tyre life from 100% to 0%. Choose it in Rules and Systems. It works in races, heats and Endurance; practice and qualifying only when enabled; never in Time Tokens. Every heat starts on fresh tyres.</li>
          <li><b>Pace-sensitive wear</b> uses the <b>Tyre Wear benchmark</b> chosen in App Settings > Calculations (median lap by default): faster laps wear more, slower laps wear less. Each tyre shows Wear per lap and <b>Lasts about</b>.</li>
          <li>When both pace-sensitive tyre wear and Push &amp; Save on tyres are enabled, their multipliers apply together. Switch one off if you want only one pace effect.</li>
          <li>Weather compares the correct and wrong tyre with a clear graph. Wrong tyres can require a pit, add points or hinder the car; lap times and records are never rewritten.</li>
          <li>At 0%, choose nothing, points every lap, no counted laps until a pit stop, or retirement. A change takes the pit time you set; Service Stop decides how its work combines with fuel and repairs.</li>
          <li>Mandatory stops and tyre sets still apply. The <b>Tyre Change</b> folder, <b>Tyre Wear</b> and <b>Available Tyres</b> widgets show the current choice and life.</li>
        </ul>` },
      { id: 'penaltytiers', title: 'Escalating pit penalties', note: 'What happens when more points are earned', body: `<ul><li>A higher points tier replaces any lower <b>unserved</b> tier with the new stop duration. It does not queue both durations.</li><li>A completed penalty remains served. Reaching a later tier then creates a new stop. Special Penalties keep their own separate stops and durations.</li><li>During an active stop, time already spent serving the pending tier counts toward its replacement. Service Stop's normal work timer does not erase penalty time.</li></ul>` },
      { id: 'tyretemperature', title: 'Tyre temperature & warm-up', note: 'An optional gameplay simulation', body: `<ul><li>Enable <b>Temperature &amp; Warm-Up</b> inside Tyre Wear. Each standard or custom compound has a fresh-set temperature, working range, warm-up per eligible lap, cooling per minute and maximum extra wear when cold or hot.</li><li>Normal laps approach the middle of the working range. Eligible Push &amp; Save laps target a hotter or cooler temperature. Pit, red-interrupted, very slow and yellow laps do not heat tyres. Pits and yellow/red pauses cool toward ambient. By default ambient comes from the Weather System’s air temperature; without Weather, the dry fallback applies. Manual ambient values are also available.</li><li>Temperature adds one wear multiplier, alongside weather, pace wear and Push &amp; Save. It does not alter lap times or control track power. The preview uses the same formula as racing; its legend shows wear at the end of each sample run.</li><li>A completed tyre change resets temperature, including a zero-time change. An aborted or exhausted-stock change does not. Disabling Tyre Wear freezes temperature. Saved-race recovery preserves the last saved temperature and ignores offline time. Every heat begins on fresh tyres.</li><li>In the Tyre Wear widget options, enable <b>Show simulated temperature and wear effect</b>. Race Director → Tyre Change also displays it. Numbers are always labelled as simulated and shown in Celsius.</li></ul>` },
      { id: 'customtyres', title: 'Custom tyres', note: 'Create compounds for your club and track', body: `<ul><li>Use <b>Add custom tyre</b> to choose a name, a standard icon and colour, and a Dry, Intermediate or Wet category. Set its life, weather wear and available sets. Custom choices belong to this Tyre Wear System; select the same system in the Race Setup. Choose them as a car's starting tyre or queue them in Race Director → Tyre Change. A queued rain tyre is fitted when the weather calls for its category; otherwise it waits.</li><li>Renaming a tyre keeps its identity. Deleting it affects future races: a car whose saved compound is unavailable starts on Medium. Current races and newly saved results keep their starting definitions.</li></ul>` },
      { id: 'safetycar', title: 'Safety Car', note: 'The yellow flag as a Safety Car', body: `
        <ul>
          <li>A <b>safety car system</b> (Race Setup, Safety Car Systems) bundles the Yellow-flag race rules. Choose one in the <b>Rules and Systems</b> section of a race setup.</li>
          <li>The Safety Car is out <b>while the yellow flag is up</b>: the yellow button, a Track Call configured as Yellow in <b>Race Setup → Race Settings</b>, and a call from a lane all bring it out. There is no button of its own. Yellow again, or the red flag, ends it.</li>
          <li><b>Lap times</b>: a full lap behind the Safety Car must be slower than the limit. A lap that is too fast is called out and gets penalty points (they need a penalty system). A lap that began before the Safety Car came out does not count.</li>
          <li><b>Pit stops</b>: refuelling, a repair and changing tyres take a number of percent less time for a car that comes in while the Safety Car is out. Driver swaps and penalties served in the pits are not shorter.</li>
          <li>The flag widget and the yellow button say <b>Safety Car</b>, and the race log says when it came out and went in. The cars do not close up behind it (not yet).</li>
          <li><b>Random Flags</b>: the system can also put the yellow flag up at random moments, as if other cars caused it, whatever the drivers do. You set the chance that a race has any, how many, how long, the earliest and latest moment, and a warning. It can hold cars at pit exit until the flag ends when Service Stop is on, and show a short Race Director instruction. The Race Director can lift one early.</li>
        </ul>` },
      { id: 'pushsave', title: 'Push and Save', note: 'How hard a driver drives wears tyres and fuel', body: `
        <ul>
          <li>A <b>Push &amp; Save System</b> compares a lap with the chosen pace benchmark. In Basics, turn on its effect on <b>Tyres</b>, <b>Fuel</b> or both; either can be switched off quickly.</li>
          <li>The pace bar puts the benchmark in the middle. Drag the left marker for <b>Full push</b> (faster) and the right marker for <b>Full save</b> (slower), or enter exact percentages. A Track target can be shown as the reference.</li>
          <li>Between the two markers, the change is smooth. Push increases the enabled tyre wear and fuel use; Save reduces them. The Wear section gives the multipliers and the actual numerical effect.</li>
          <li>Which Laps Count lets you exclude stops, restarts or flag laps. The system never changes lap times, grip, Personal Bests or Track Records.</li>
          <li>The <b>Push &amp; Save</b> widget (in the <b>Push &amp; Save</b> folder), Driver stats and lap review show PUSH, NORMAL or SAVE.</li>
        </ul>` },
      { id: 'championships', title: 'Championships', note: 'Rounds, sessions and a roster of drivers', body: `
        <ul>
          <li>Make one in <b>Race Setup, Championships</b>: the <b>rounds</b> (a name, a track and a date if you want) and the <b>sessions</b> of every round, each driven with one of your race setups. A new round starts with the sessions of the round before it.</li>
          <li>The kind of a session (Practice, Qualifying or Race) comes from its race setup. A Time Token Session can not be part of a championship. A race counts for 100%, 50% (a sprint) or no points.</li>
          <li>The <b>roster</b> holds the drivers, each with a team and the round he joins in.</li>
          <li>On <b>Home</b>, choose the championship in <b>Start a race</b>, under the name of the race setup (<b>None</b> is a normal race). Its card shows the round that is next and loads the next session with one click; <b>Another session</b> loads any other. It fills the race setup and the lanes, and nothing starts until you press <b>Start race</b>. Roster drivers come first in the driver boxes; others drive as guests.</li>
          <li>The race says <b>Counts for</b> the championship on Home, the race screen and in Results and Records. A session is driven when its race is saved.</li>
          <li>The points, the bonuses, the dropped results and the standings are in the next folder, <b>Championship points</b>.</li>
        </ul>` },
      { id: 'championshippoints', title: 'Championship points', note: 'Table, bonuses, drops, teams and standings', body: `
        <ul>
          <li><b>Points</b> in a championship (Race Setup, Championships) is the table: start from a ready-made one or <b>My own</b>, change any place, and set what the rest get. <b>One point per car beaten</b> needs none.</li>
          <li><b>Bonuses</b>: fastest lap (only in the first places you set), pole position (fastest in the qualifying of the round, if he starts) and a point for starting. A car that is out gets no points for its place.</li>
          <li><b>Dropped results</b> take away the worst rounds of every driver and team. <b>Teams</b> count the best drivers of a team, all of them, or no team standings. A tie goes to the most wins, the last round or the qualifying.</li>
          <li>A race at 50% (a sprint) gives half of the points, rounded as you choose. A driver who is not in the roster is a guest: no points, and the drivers behind him move up (can be switched off).</li>
          <li>After a race a panel shows its points. <b>Award these points</b> puts the race in the standings (a session counts once: a second run replaces the first), <b>Undo</b> takes it out again, and <b>Do not count this race</b> keeps the result but offers the session again on Home.</li>
          <li><b>Races of teams</b> (Endurance, team heats) are scored: the team gets the points of its place once. Each driver who drove for it gets the same, a share by laps, or nothing, as you choose (with a minimum share of laps).</li>
          <li>Results and Records, <b>Championships</b>: Drivers, Teams and Rounds, with <b>Export to PDF</b>. Home shows who leads ("Maria leads by 5") and the top five.</li>
        </ul>` },
      { id: 'tokens', title: 'Time Token Sessions', note: 'Selling track time per lane', body: `
        <ul>
          <li>Choose the kind <b>Time tokens</b> in a race setup. It has no start lights, laps, fuel or penalties. On Home the button says <b>Open the session</b>. Drivers and cars are optional: a lane without a driver is a Guest.</li>
          <li>Every lane starts switched off. Press a time button on a lane (the buttons are set under Race Setup, Time Tokens) and the lane is on while the <b>Token Clock</b> counts down. The minus buttons take time off again.</li>
          <li><b>Race Setup &gt; Time Tokens</b> saves as you change it. Add or remove minute boxes, set the warning and colours, or return to the standard settings. Warning off means no early colour change; when time is up, all timing widgets of that lane use the time's-up colour.</li>
          <li>A lap driven after the time was up is kept but never counts for a record.</li>
          <li><b>Undo</b>, <b>End time now</b> and <b>Clear</b> correct a lane. Choose another driver in a lane's list when the next person takes over.</li>
          <li>The <b>Tokens</b> tile on the Live Race tab adds time from a phone or tablet, behind the password.</li>
          <li>Stopping the session opens a review. <b>Finalize</b> saves every stint, <b>Delete all data</b> throws them away.</li>
        </ul>` }
    ]],
    ['Making it yours', [
      { id: 'custom', title: 'Customization', note: 'Layouts, results, audio and widgets', body: `
        <ul>
          <li><b>Layout Editor</b> makes the Timing Page/Race Screen and a separate Second Display. Drag, resize, align, layer, copy, Undo and Redo widgets for lap times, flags, fuel, speed and more.</li>
          <li><b>Leaderboard Editor</b> arranges row designs used by widgets and the Live Race Leaderboard grid.</li>
          <li><b>Race Results</b> configures the finished-race <b>Victory Spotlight</b>: choose the large featured fact, optional supporting facts and a TV-size comparison chart. Laps, Total time driven, Gap to leader, Heat points and live Championship points are available when the race has them. For five or more results, choose either cards or <b>Victory Spotlight + leaderboard rows</b>, then choose a design made in the Leaderboard Editor. The winner stays featured and the complete classification—including first place—uses that row design. If the design is deleted, results safely return to cards.</li>
          <li><b>Audio Settings</b> chooses what the race says. <b>Image Settings</b> stores picture sets for lights, flags, fuel, avatars, tyres, weather and track conditions; anything left empty is drawn by the app.</li>
          <li>An Avatar widget uses the driver's picture, then its lane avatar. Widget titles and values can align left, centre or right; the widget content scales to fit the available space.</li>
          <li><b>Widget Builder</b> composes values, icons, meters and standard widgets. Simple text and image widgets remain available.</li>
        </ul>` },
      { id: 'widgetcomposer', title: 'Widget Builder', note: 'Content blocks, live preview and conditional states', body: `<ul>
        <li>Choose <b>New canvas widget</b> to start blank. The Starting point menu offers Driver Card, Timing Bar, Pit &amp; Strategy and Race Overview templates. Choose one lane or the whole race.</li>
        <li>Add values, text, pictures, icons, progress bars, rings, gauges or standard widgets. Drag blocks anywhere on the Free Canvas and resize using their handles. Click the preview or structure list to select a block. Rows, columns and grids remain available inside a group.</li>
        <li><b>Available values</b> expands into coloured, searchable groups. Choose a value directly or insert it into combined text. Missing numeric readings show a dash, not zero.</li>
        <li>States use the first matching rule. Match all or any conditions to hide a block, replace text, change an icon or its emphasis. The preview identifies the matching rule; hidden blocks stay outlined while editing.</li>
        <li>Test compact sizes, long names, pit stops and missing data. Preview samples never change a race. If the content is crowded, enlarge it or use fewer blocks.</li>
        <li>Save, then add from <b>My widgets</b>. Each layout receives an independent copy. Backgrounds, gradients, accents, borders, depth and text settings use the normal Layout Editor controls. The Builder saves content, not preview appearance.</li>
      </ul>` },
      { id: 'widgetfreecanvas', title: 'Widget Builder: arranging your canvas', note: 'Drag, resize, group, align and lock', body: `<ul>
        <li>Drag an element to move it. Eight handles resize its box; values and labels fit together inside it. Position and size use percentages, so your arrangement scales with the widget.</li>
        <li>Use <b>Snap</b> with a 1%, 2% or 5% grid, or choose guides only. Guides align edges and centres with the canvas and other elements. Hold Alt to bypass snapping.</li>
        <li>Shift-click or Ctrl-click sibling elements to select several. <b>Group selection</b> lets them move and resize together. Alt-click selects a child inside the selected group. <b>Ungroup</b> keeps their positions.</li>
        <li><b>Position &amp; size</b> provides exact left, top, width and height percentages. Alignment buttons use the canvas for one element, or the selection bounds for several.</li>
        <li>Use <b>Bring to front</b>, <b>Send to back</b>, Forward or Backward for overlapping content. Lock protects placement. Unlock a group and its children before ungrouping.</li>
        <li>With the canvas focused, arrows move 1 pixel; Shift-arrows move 10. Escape cancels a drag. Each completed gesture is one Undo step.</li>
      </ul>` },
      { id: 'widgetcomposeroptions', title: 'Widget Builder options', note: 'Component controls, rule limits and readable previews', body: `<ul>
        <li>Standard widget blocks keep their applicable settings: choose saved picture sets or teams, adjust size sliders, and position or zoom pictures. Their race warnings keep readable colours.</li>
        <li>Each block allows 12 rules, with up to eight conditions per rule. A message explains when the limit is reached; your existing rules remain intact.</li>
        <li>Long names wrap within their block. If a composition is crowded, the Builder explains this below the preview. Enlarge the widget or reduce its contents to keep values readable.</li>
      </ul>` },
      { id: 'strategywidgets', title: 'Race information widgets', note: 'Pit stops, fuel range, gaps and lap validity', body: `
        <ul>
          <li>Add these per-lane widgets in the <b>Layout Editor</b> or <b>Leaderboard Editor</b>. Switch off <b>Show supporting detail</b> for compact layouts.</li>
          <li><b>Pit Stops → Service Stop</b> shows the fixed timer plus penalty time. READY waits for director release; RETURN asks for the car back on the sensor; HOLD means a pause, sensor check or Random Flag restriction. GO appears only when release conditions permit.</li>
          <li><b>Pit Stops → Penalty to Serve</b> shows outstanding pit penalties, including drive-throughs. It is separate from time already added to the result.</li>
          <li><b>Slotcar → Fuel Range</b> estimates laps left from actual consumption over 3–20 recent clean laps. It needs three samples; refuelling changes the range. Red-flag, pit and excluded laps are ignored. Changed conditions take new samples to settle.</li>
          <li><b>Position and Progress → Gap to Next Driver</b> compares the driver immediately ahead using the race's scoring rules.</li>
          <li><b>Lap Times and Records → Lap Validity</b> checks the current or last lap. Current laps are provisional; red-flag laps are invalid for records.</li>
          <li><b>Race → Safety Car Target</b> shows the minimum lap time and last full yellow lap's difference. <b>Team and Swaps → Stint Time</b> shows time at the wheel in driver-rotation races.</li>
        </ul>` },
      { id: 'pitwidgets', title: 'Pit Stops overview widgets', note: 'Needs Attention and Recent Events', body: `
        <ul>
          <li><b>Layout Editor → Pit Stops → Needs Attention</b> shows damage, failures, pit penalties, low fuel, worn or hot tyres, weather tyre changes, mandatory stops, driver swaps, blocked resources, release conditions and track calls. Resolved issues disappear. Finished and virtual drivers have no service alerts. Fuel warns at 25%, critical at 10%; tyre warnings follow the system.</li>
          <li><b>Recent Events</b> keeps history even with audio off: flags, penalties, fuel, damage, tyres, pit stops, swaps, weather, resource shortages and system switches. Times and driver names stay fixed across pauses and swaps. Older events without elapsed time show a dash. Active alerts use engine rules; ordinary pace and classification changes do not flood history.</li>
          <li>Each widget has independent lane/category filters, row limits, details and lane labels, plus shared appearance settings and second-display support. Small frames show fewer rows and a more indicator. Up to 50 records per category/lane are retained in the display index; a widget shows up to 20. The full race log is unchanged.</li>
        </ul>` },
      { id: 'charteditor', title: 'Chart Editor and chart widgets', note: 'Compare completed laps as the race unfolds', body: `
        <ul>
          <li>Open <b>Customization → Chart Editor</b> to create, name, save, duplicate or delete a chart design. It is separate from Layout Editor. Add <b>Charts → Race Chart</b> in Layout Editor and select that saved design; position and resize it like any widget.</li>
          <li><b>Lap Trend</b> plots completed laps. <b>Driver Comparison</b> compares the latest eligible value per driver with bars starting at zero. <b>Delta Trend</b> subtracts a reference: below zero is faster, above is slower.</li>
          <li>Choose lap time, best lap so far, average or median; all lanes, selected lanes or one lane. Average and median can use all eligible laps or a recent-lap window. History controls which completed lap numbers are visible, not the calculation window.</li>
        </ul>` },
      { id: 'chartstyles', title: 'Track, spread and distribution charts', note: 'Estimated motion and honest comparisons', body: `<ul>
          <li><b>Live Track</b> estimates progress between confirmed crossings. Choose direction, a recent median/average/last-lap or track-target reference, and up to 10 or 4 updates per second, or crossings only. Missing references stay at the line; overdue cars wait near it. Pits and finishes stop movement, red flags freeze it, and yellow flags continue timing. Virtual rivals use their replay. Hidden charts do no animation work; reduced motion uses crossings only. The editor preview is static. This schematic never creates laps or changes timing.</li>
          <li><b>Lap Time Spread</b> shows median and middle 50%, with fastest–slowest or 1.5 × IQR whiskers. Outlier dots are still valid laps. <b>Lap Distribution</b> uses shared bins and zero-based count or percentage axes; percentage helps compare unequal sample sizes. Bins widen automatically for extreme ranges.</li>
        </ul>` },
      { id: 'charthistory', title: 'Position history and lap heatmaps', note: 'Crossing order and pace across laps', body: `<ul>
          <li><b>Position History</b> shows recorded lap-count order at common race-clock crossings, with first at the top. It excludes penalties, review changes, sectors and comparison-only rivals, so it is not final classification. Its history limit counts recent crossings across the selected drivers.</li>
          <li><b>Lap Heatmap</b> compares laps with the track target or each driver’s median over the selected history: blue faster, amber slower. Invalid or missing laps keep their original columns. Narrow widgets show fewer recent columns; the caption identifies the visible range. Turn lap labels off for a denser overview. All styles offer virtual-rival inclusion and lane selection.</li>
        </ul>` },
      { id: 'chartoptions', title: 'Chart references and appearance', note: 'Eligible laps, readable labels and shared designs', body: `
        <ul>
          <li>References use the current race track target, track record, each driver's personal best or a manual time in seconds. Missing references remain unavailable. Pit laps are optional; invalid, removed, red-flag and interrupted laps always stay out of statistics. Excluded laps appear as gaps and optional crosses.</li>
          <li>Lane colours follow the layout. Adjust point markers, line patterns, thickness and axis range. Fixed ranges report omitted values. Tiny widgets ask for more room instead of shrinking labels beyond readability. Long races reduce drawing detail while retaining statistical values and local extrema.</li>
          <li>Saving updates all widgets using that design, including the running race and second display. Duplicate a design for an independent variation. Deleting it leaves a clear prompt on linked widgets. Designs travel with layouts during export/import and complete backups. All chart settings are display-only.</li>
        </ul>` },
      { id: 'allinone', title: 'All-in-One widgets', note: 'Ready-made lane, timing, service, strategy and results cards', body: `
        <ul>
          <li>Open <b>Customization → Layout Editor → All-in-One</b>. Lane Card combines driver, position and completed laps. Timing Bar combines current lap, gap and best legal lap. Driver Dashboard combines both, with optional fuel, tyres and Push &amp; Save.</li>
          <li>Pit &amp; Service Card follows the actual stop timer, sensor/release state, repairs, pit penalties and mandatory stops. Its countdown already includes penalties when the engine includes them; do not add the penalty line to it again. Without a held Service Stop, it shows elapsed pit time instead.</li>
          <li>Race Overview is shared across lanes and shows elapsed race time, the session limit and flag. Strategy Card shows estimated fuel/tyre range and pace multipliers. Driver Results Card follows the current race or heat, including review changes; championship/heat points are optional and unavailable points stay blank. Results remain provisional until finalized.</li>
        </ul>` },
      { id: 'allinonesettings', title: 'All-in-One settings', note: 'Readable sizes, optional fields and system availability', body: `<ul>
          <li>Choose <b>Compact, Standard or Detailed</b>, then adjust optional fields individually. Selecting a preset resets those field choices. Avatar uses the driver's picture or the lane's standard avatar; car description comes from the car raced.</li>
          <li><b>Automatic</b> arrangement stacks the main value in narrow cards. Wide and Stacked are optional. Resize a card to give its selected fields enough room; an undersized card asks to be enlarged instead of shrinking all its text. These cards use the existing lane colours, stripes, rounded corners and border settings.</li>
          <li>Fuel, tyres and pace can be shown separately. A disabled system displays <b>Off</b> in its existing place. Estimates need usable lap history; they do not predict future weather or strategy. The cards are read-only and do not change race rules or hardware behavior.</li>
        </ul>` },
      { id: 'raceclockstyles', title: 'Race Clock styles', note: 'Original, Digital and Pit Wall', body: `<ul>
          <li>Select a Race Clock in the Layout Editor and open <b>Appearance → Clock style</b>. <b>Original</b> uses your normal text settings. <b>Digital</b> draws seven-segment alarm-clock digits with fixed spacing; no extra font is needed. <b>Pit Wall</b> separates the tenths and labels the race state. Small Pit Wall widgets show only the time.</li>
          <li><b>Follow flags</b>, under Content, defaults to green text while racing, yellow under a yellow flag and red under a red flag. Ready, paused and finished states use theme text. This takes priority over custom text colour and is independent of surface highlights. Turn it off to use your chosen text colour. Your background and accent remain unchanged; choosing Text + Border under Race-state colours also colours the border.</li>
          <li>Timed sessions count down by default. Disable the countdown to show elapsed time. Red flags still pause the engine's clock; changing a style never changes timing. Manual value sizing controls digit size, with fitting to the available space in Digital and Pit Wall. Older Timing display layouts open as Pit Wall; Classic and Minimal open as Original.</li>
        </ul>` },
      { id: 'widgetfonts', title: 'Widget fonts', note: 'Bundled fonts and High Visibility', body: `<ul>
          <li>Select a widget in the Layout Editor and open <b>Title &amp; text → Fonts</b>. Choose separate title, value and supporting-text fonts and weights. <b>Follow layout</b> uses the defaults under the toolbar's <b>Widget appearance → Fonts</b>. Supporting text can follow the value font. Leaderboard Editor cells have font controls too.</li>
          <li>Inter, Barlow Condensed and Roboto Mono are bundled for offline use. <b>High Visibility fonts</b> chooses Inter Black for titles and values, with bold Inter for supporting details. It changes fonts only; use the existing sizing, spacing and contrast controls for further adjustments.</li>
          <li>Fonts apply to normal widgets, All-in-One cards and Builder content. Automatic and manual sizing still apply; text refits after fonts load. Enlarge crowded widgets to keep labels readable. Digital clock segments, icons and artwork keep their design.</li>
        </ul>` },
      { id: 'widgetlocalfonts', title: 'Installed widget fonts', note: 'This computer, second displays and font fallback', body: `<ul>
          <li><b>Browse installed fonts</b> lists this computer's font families when supported and permitted. With a selector focused, type a font name to find it. If browsing is unavailable, the bundled fonts remain available.</li>
          <li>Only the font name and requested weight are saved, never the local font file. A second window on this computer shares its fonts. A phone or another computer uses bundled Inter if the chosen font is missing. The saved selection is kept; its availability is shown in settings.</li>
          <li>Bundled fonts offer their available weights. Installed fonts use the closest weight provided by that family. Choose a bundled font for consistent lettering across different devices. Reset font overrides to follow the layout again; copying appearance does not copy fonts.</li>
        </ul>` },
      { id: 'widgetappearance', title: 'Widget appearance', note: 'Backgrounds, gradients, borders, accents and depth', body: `<ul>
          <li>Select a widget in the Layout Editor. <b>Content</b> chooses what it shows; <b>Appearance</b> controls its surface. Choose Solid, Gradient or None, then Theme, Lane colour or Custom. Choose the background colour first. Gradient colour is separate: it fades to transparent over that background, including a custom white background in a dark theme. Gradient opacity sets its strength; Background opacity fades the whole surface.</li>
          <li>Titles stay at the top without shifting values. Lane labels sit outside cards in the editor and never affect fitting.</li>
          <li>Choose one of eight gradient directions, type an angle from 0 to 359 degrees, or reverse it. Zero points up, 90 right, 180 down and 270 left. Border and accent colours are independent: use a shade of the background, lane colour, custom colour or none. Accents can follow the top, left or right edge.</li>
          <li><b>Appearance</b> separates Background, Border and Accent stripe into softly coloured groups. Each includes its own opacity and a reset for that group. Folder headings use matching icons and quiet accents; these colours organise settings and do not change lane colours.</li>
          <li><b>Advanced</b> contains shape, depth, spacing and appearance copying. Depth can follow App Settings or have a widget override. Text stays visible when the background fades. Accents follow the widget's corners.</li>
        </ul>` },
      { id: 'widgetoptionviews', title: 'Widget options and previews', note: 'Display styles, readable text and conditional settings', body: `<ul>
          <li>Content controls depend on the chosen display style. Push &amp; Save’s wear-only view shows the enabled fuel and tyre multipliers; badge and reference controls return when you choose a state view. Tyre picture sets apply to the picture-with-ring style.</li>
          <li>Tyre Wear honours selected percentage, laps left, name, grip and temperature details. A vertical bar places extra facts below it. Turning facts off does not secretly restore the percentage.</li>
          <li>Automatic sizing fits the available space. Manual sizing adds an optional <b>Shrink to fit</b> switch. Text has a readable minimum; pictures yield space to words but retain a usable size. Enlarge a crowded widget or show fewer fields.</li>
          <li>Layout, row, chart and Builder previews use an isolated sample race and the same display calculations as live timing. They never change your current race. State-dependent choices only appear in the relevant situation: a low-fuel warning colour needs low fuel, and a swap warning needs an approaching swap. Saved chart and leaderboard designs control their content, including sorting and displayed places. Select a design or picture before expecting its content to appear.</li>
        </ul>` },
      { id: 'widgetstatecolours', title: 'Widget race-state colours', note: 'Choose where warnings and event flashes appear', body: `<ul>
          <li>Open <b>Race-state colours → Apply state colours to</b>. Choose <b>Background</b>, <b>Text</b> or <b>Text + Border</b>. Background keeps the original behaviour.</li>
          <li>The text choices preserve your background and gradient. The event colour temporarily overrides your custom text colour, with a lightness adjustment where needed for contrast. Text + Border also shows a visible state border, even if the normal border is off. Normal text and border styling return when the event ends.</li>
          <li>These choices use each widget's existing warnings and flashes, such as record laps and Time Token expiry; they do not create new alerts. Tyre icons, gauges, badges and chart series keep their own meaning.</li>
          <li>Turn <b>Show race-state colours</b> off to disable these highlights. State badges, warning symbols and values remain visible. The Race Clock's separate Follow flags option still controls its digits. Set layout defaults in the toolbar's Widget appearance dialog or override individual widgets.</li>
        </ul>` },
      { id: 'widgettext', title: 'Widget text and sizing', note: 'Automatic or manual sizes, pictures and readable text', body: `<ul>
          <li><b>Title &amp; text</b> offers Automatic and Manual sizing. Manual can set the primary value, supporting text and labels on composite cards. Titles have their own size and alignment. Sizes use a layout 1000 units wide and scale with the display.</li>
          <li><b>Automatic</b> measures the available space after padding and the title. Single values grow with the widget; Last Laps uses one size across all rows and columns. <b>Manual</b> keeps your chosen size, with optional <b>Shrink to fit</b>. Minimum value size is in screen pixels; supporting text keeps an 11px minimum. All-in-One cards preserve their structure and request more room if the chosen content cannot fit. Enlarge the widget or reduce optional fields rather than forcing tiny text.</li>
          <li>Long names and descriptions can wrap, fit on one line or shorten with an ellipsis. Picture, avatar and gauge size can be adjusted separately. Chart axes and specialised graphics retain their own content controls. Automatic contrast chooses text for the background; Theme and Custom are optional.</li>
        </ul>` },
      { id: 'widgetdefaults', title: 'Layout defaults and copying', note: 'Shared appearance with individual overrides', body: `<ul>
          <li>The toolbar's <b>Widget appearance</b> button sets defaults for this layout, including future widgets. Save defaults to apply them; Cancel discards the dialog changes. A widget's own setting wins. <b>Use layout / original background</b>, <b>border</b> or <b>accent</b> clears only that group's overrides, including opacity, and restores its layout defaults or original settings. Other groups stay unchanged. Depth and spacing still offer individual resets.</li>
          <li><b>Copy appearance</b> and <b>Paste appearance</b> transfer the surface, border, accent, depth and spacing. They do not change lane, content, position or typography. Select several widgets to apply a change together. Undo and Redo restore settings.</li>
          <li>Existing layouts retain their original styling until you change it. New Lane colour controls use the standard lane palette if no colour is saved. A global widget has no lane accent. Leaderboard row designs keep their own row controls; outer widget appearance is separate.</li>
        </ul>` },
      { id: 'layouteditor', title: 'Placing widgets', note: 'Snapping, the pink lines and Tidy to grid in the Layout Editor', body: `
        <ul>
          <li>A widget you drag <b>snaps</b> to the grid (5 units), to the edges of other widgets and to your guidelines. The magnet is small: it pulls from 3 units away. A <b>pink line</b> shows where an edge lines up exactly.</li>
          <li>Hold <b>Ctrl</b> (Cmd on a Mac) while you drag or resize to snap to the grid only, without the magnets. Untick <b>Snap to grid, widgets and guidelines</b> to move freely.</li>
          <li><b>Arrange</b> (side panel): <b>Tidy to grid</b> moves every edge of the selected widgets to the nearest grid line, so widgets that touch keep touching. With nothing selected the button is <b>Tidy all widgets to the grid</b>. Undo puts them back.</li>
          <li>Select several widgets with Shift-click or a rectangle, or all with Ctrl+A. <b>Duplicate</b> makes copies for the next lane.</li>
        </ul>` },
      { id: 'arranging', title: 'Arranging several widgets', note: 'Align, spread out, one size, mirror and resize in the Layout Editor', body: `
        <ul>
          <li>Select several widgets (Shift-click, a rectangle, or Ctrl+A). In <b>Arrange</b> (side panel): <b>Align</b> to the selection (one widget aligns with the page), <b>Spread out evenly</b> across or down (three or more; the outer two stay) and <b>Width</b> and <b>Height</b> to give them all one size.</li>
          <li>A dashed frame with four corner handles shows round the selection. Drag a corner to <b>resize them all together</b>: every widget scales with the frame. It snaps like a single widget does (Ctrl: the grid only).</li>
          <li><b>Mirror</b>: <b>In the selection</b> swaps left and right inside the frame, <b>Flip top to bottom</b> does the same up and down, <b>Across the page</b> moves each widget to the other side of the middle of the page. Made copies for the next lane with <b>Duplicate</b>? Select them and mirror them across the page for a symmetrical layout.</li>
          <li><b>Layer</b> changes which overlapping widget is on top: bring it to the front or forward one layer, or send it backward or all the way to the back. Its shadows follow the same order on the timing page, second display and fullscreen view.</li>
          <li>Mirroring left to right also swaps left and right text alignment and flips the pictures that have a Mirror setting (slotcar picture, avatar, race flag).</li>
          <li>Each action is one step: <b>Undo</b> brings everything back.</li>
        </ul>` },
      { id: 'lanestyles', title: 'Lane colour styles', note: 'Full backgrounds or stripes on either edge', body: `
        <ul>
          <li>In the Layout Editor toolbar, <b>Lane colour style</b> selects <b>Full Widget</b>, <b>Top Stripe</b>, <b>Left Stripe</b> or <b>Right Stripe</b>. Existing layouts start with Full Widget.</li>
          <li>The stripe uses the lane's background colour from <b>Lane colours</b>. A lane set to Theme has no coloured stripe. Stripe widgets use a neutral theme background and text unless you chose custom widget colours.</li>
          <li>Select a widget and open <b>Appearance</b> for independent Background, Border colour and Accent colour settings. Choose Lane colour for the accent and select its edge. These explicit settings override the original lane treatment. Leaderboard row designs keep their own lane styling.</li>
          <li>Both leaderboard formats apply the treatment per lane row. Row-design status colours remain. Warnings, record flashes, flags and time's-up colours still work.</li>
          <li>Stripes are part of the widget frame: they follow its corners and transparency without covering text or pictures. The same styles show in the editor, race, fullscreen and shared Live Race pages. Save, copy, Undo and Redo preserve the choices.</li>
        </ul>` },
      { id: 'delta', title: 'Delta Timers', note: 'How far a lane is from another time', body: `
        <ul>
          <li>A folder of widgets in the Layout Editor: a time on the left and a badge on the right that shows how far a lane is from another time. Green with ▲ and a minus (▲ −0.045) is faster, red with ▼ and a plus (▼ +0.321) is slower. <b>Value and badge</b> can put them <b>top and bottom</b> instead: the time on top, the badge below it.</li>
          <li><b>What is compared</b>: a lane's value against theirs, its last lap against theirs, or its last lap against its own value. <b>Compare with</b>: a chosen lane, the leader, the fastest in the race, the track record or the session record.</li>
          <li><b>Left (or top) value shows</b>: this lane's own value (the standard), or the value it is compared with, for example lane 2's time. The badge always says how far this lane is from it.</li>
          <li>The look: a solid block or only an outline, the size of the whole badge, the thickness of the outline, bold and italic text, the arrow, the number of decimals and the three colours. The arrow and the number shrink by themselves to stay inside the badge when the widget is small or narrow.</li>
          <li>The Session Record and Track Record deltas always compare with that record, and show it on the left.</li>
          <li><b>Lap to Lap Delta</b> shows the last lap and how far it is from the lap before it (on lap 10 it shows lap 9, against lap 8). It needs two laps, so the badge is a dash until then. The time stays for the whole lap.</li>
        </ul>` },
      { id: 'audio', title: 'Audio calls', note: 'Choose, preview and tune race commentary', body: `
        <ul>
          <li>Create an <b>audio set</b> in Customization, Audio Settings, then select it in Race Setup, Race UI and Audio. No audio keeps the race silent. Sound plays on the computer running the race.</li>
          <li><b>Calls</b> has a coloured category rail, search and Enabled, Disabled, Modified and New filters. Select a call to edit it, even while it is off. The switch controls playback, not access to its settings.</li>
          <li><b>When to announce</b> contains thresholds. Low fuel has a warning level and a higher reset level. Push &amp; Save waits for consecutive laps outside the normal pace band. Selected lap times and summaries can be spaced out to avoid constant chatter.</li>
          <li><b>What to play</b> offers Spoken message, Sound file or Sound, then speech. Attach your own recordings, up to 10 MB each. Existing recordings remain file-only unless changed. Several variations are selected at random from those that qualify.</li>
          <li><b>Insert a value</b> lists compatible placeholders with definitions and examples. {pointsadded} means new penalty points; {pointstotal} means the total. {fuellaps} is an estimate from at least three recent clean fuel samples. Missing facts skip that variation; keep a simpler fallback.</li>
        </ul>` },
      { id: 'audioconditions', title: 'Audio conditions and playback', note: 'Fallbacks, profiles and repeat limits', body: `
        <ul>
          <li><b>Conditions</b> can select a driver, top places, lap time or gap. All conditions must match. Matching conditional variations take precedence over unconditional fallbacks. Preview message plays example text; Test conditions checks a labelled example event, not the live race.</li>
          <li><b>Minimum time between calls</b> applies per driver or to the whole call. Voice &amp; mix sets the voice, volume, rate, two/three lap-time decimals and commentary expiry. Flags, start and session-end calls interrupt. Important service, penalty and result calls do not expire behind ordinary commentary. Playback diagnostics explains skipped messages.</li>
          <li>Essential, Club and Broadcast profiles preview which switches change before applying. Messages and recordings are kept. Optional new calls are off in existing sets until enabled; profiles are never applied automatically.</li>
          <li>Drivers can be called by name, nickname or callsign. Voice &amp; mix includes <b>Voice report</b>, which lists voices available to the app. It can be copied for troubleshooting.</li>
        </ul>` },
      { id: 'audiocategories', title: 'Audio categories and values', note: 'Find announcements by their race purpose', body: `
        <ul>
          <li>Start &amp; session; Positions &amp; battles; Laps &amp; records; Progress &amp; milestones cover the racing commentary. Pits &amp; Service Stop separates entry, completed work and actual departure.</li>
          <li>Fuel Systems, Penalty Systems, Flags &amp; Safety Car, Tyre Wear Systems, Weather Systems and Push &amp; Save Systems use their system colours. Weather covers conditions, tyres, temperature and wind.</li>
          <li>Damage &amp; failures, Endurance &amp; driver swaps, Time Tokens and Balance of Power have dedicated categories. Race control, Results &amp; championship and Timing hardware cover decisions, awards and connection changes.</li>
          <li>Identity values include {driver}, {name}, {nickname}, {callsign}, {team} and {car}. Statistics include {averagelap}, {medianlap}, {benchmark} and {gapleader}. Use the selected call's picker for availability; records, estimates and competition points need real data.</li>
        </ul>` },
      { id: 'audioevents', title: 'Audio service and result calls', note: 'Announcements that match race decisions', body: `
        <ul>
          <li>Service Stop readiness includes additive penalties, sensor return and pit-exit holds. Tyre fitting or repair completion alone is not permission to leave. Manual Service Stops still require the director's Release action.</li>
          <li>Finish announcements are provisional. Results finalised and Confirmed winner follow successful saving. Championship calls follow actual points awards, and Championship winner waits until all rounds are decided. During a race, <b>Announce summary</b> requests driver and weather summaries.</li>
        </ul>` },
      { id: 'ambient', title: 'Ambient race sounds', note: 'Engines, pit crews and a crowd', body: `
        <ul>
          <li>The <b>Ambient sounds</b> tab contains effects for laps, pits, flags, results, weather and more. Add your own sound files: no sounds are bundled, and a sound without a file stays silent.</li>
          <li>Ambient sounds use a separate channel. Voice &amp; mix controls their master volume, maximum simultaneous effects and lowering them while speech plays.</li>
          <li>Each sound has Volume, Start after, optional conditions and multiple random files. Repeated effects can have a minimum interval. Service Stop ready and Confirmed winner have their own optional completion tone and podium sting.</li>
          <li>Background loops have Fade in and Fade out. Optionally fade a loop to silence under red and resume it on green. Otherwise its existing start/end events apply. Pit crew effects can stop at actual pit exit.</li>
        </ul>` },
      { id: 'look', title: 'Look and feel', note: 'Themes, name, header picture and logo', body: `
        <ul>
          <li><b>App Theme</b>: choose a ready-made colour theme, or make your own colours.</li>
          <li><b>General</b>: type your own app name and welcome message, add a header picture to the Home tab (and choose which part of it shows), and add your club logo. <b>Display</b> makes the whole app bigger (100% to 200%) for reading from a distance; it does not change the widgets of your layouts. It also sets the <b>speed unit</b> of the tables, km/h or mph, and the <b>distance unit</b>: metres and kilometres, or feet and miles (a track is then typed in feet and inches; it stays saved in metres). <b>Depth</b> sets how much cards, buttons, folders and widgets stand up from the page: Flat (the plain look), Soft lift (the standard), Medium or Thick card. It covers the whole app, the Live Race pages and your widgets, and a see-through widget stays flat. Flat is lighter to draw, which can help on a slow computer such as a Raspberry Pi. <b>Pictures</b> sets how sharp the pictures you upload stay: Original (as uploaded, with transparency), High or Standard (smaller, for a lighter database).</li>
          <li>In the Layout Editor every widget has its own <b>Border</b> with <b>Colour of your own</b> (any colour you pick) and a <b>Border thickness</b> that grows and shrinks with the page like the text. Select several widgets to set them all at once.</li>
          <li><b>Racing Rules</b> is a tab of its own. Write the rules of your club there. They show on the Racing rules tile of the Live Race tab, also on phones.</li>
        </ul>` },
      { id: 'performance', title: 'Performance', note: 'Is the app slow? Measure it', body: `
        <ul>
          <li>Open <b>App Settings, General, Performance</b>. The report there updates every second while the folder is open: the frames a second the window draws, the slowest frame, how long a screen update takes, the CPU the app uses (window, graphics and the core of the app), how long the core was stuck, how long the race save takes, and whether the window is drawn by the graphics card or by the processor. On a Raspberry Pi it also shows the model, the temperature and the processor speed.</li>
          <li><b>Copy report</b> puts it on the clipboard, to paste in a message. It also names the widgets and the parts of a screen update that take the most time, the worst figures since the race started, a row every 30 seconds (does the app get slower during a race?), when the core was stuck and which windows are open (the Live Race tab is a second window). Switch the line on before the race starts; copy the report during the race or after it.</li>
          <li>Tick <b>Show the Performance line on the race screen</b> for a small line with the same figures under the buttons of the race screen. It is off to begin with, and costs a little itself.</li>
          <li>Nothing is measured while the folder is closed and the line is off. On a slow computer, <b>Depth</b> Flat (Look and feel) is lighter to draw, and so is the tickbox <b>Draw the changing text of each widget on its own layer</b> (on to begin with; the report says which look you have).</li>
        </ul>` }
    ]],
    ['Connecting and sharing', [
      { id: 'live', title: 'Live Race', note: 'Follow the race on another screen', body: `
        <ul>
          <li>The Live Race tab follows the race that is running, with a tile per page: <b>Race timing</b>, <b>Leaderboard</b>, <b>Race results</b>, <b>Driver stats</b>, <b>Database</b> (read only), <b>Racing rules</b>, and the control pages <b>Race Director</b> and <b>Tokens</b>.</li>
          <li><b>Open on a second screen</b> puts the pages in their own window, for a TV. <b>Full screen</b> fills it.</li>
          <li>The <b>Race timing</b> page shows only the widget layout. Move the mouse or touch the screen to bring back the bar.</li>
          <li>The <b>Leaderboard</b> page is a grid: under <b>Customize</b> pick the number of columns and rows with the little squares, and choose a leaderboard for every cell (a row design or the classic table). A board can cover more cells and show only some places (5 to 8). <b>Order by</b> sorts a board by a value (best lap for a fastest laps board, laps, points, penalties), best or worst first. <b>Count over</b> set to <i>All heats and rounds so far</i> lets a heat race or championship board show all drivers in the overall order, with time, laps, best and average lap, points added up.</li>
          <li>The <b>Live Race</b> button in the top bar has its red light on while a race is on, and is greyed out with the light off when no race is running. It opens the pages either way.</li>
          <li>Only the Race Director and Tokens pages change anything, so they look different. On the Race Director page the Calls come first, then the lane cards (see Lane cards), Weather, Tyre Change and Endurance (brown) in an Endurance Race.</li>
        </ul>` },
      { id: 'driverstats', title: 'Driver stats', note: 'One driver, in a grid of your own', body: `
        <ul>
          <li>The <b>Driver stats</b> page of Live Race shows one driver at a time: pick the lane at the top. It is a grid, like the Leaderboard page.</li>
          <li>Under <b>Customize</b> pick the grid with the little squares (up to 4 columns and 8 rows). Then pick a cell and choose what it shows. A cell can cover more columns and rows, and its label can be switched off.</li>
          <li>A cell can show the position, the laps, the last, best, average and median lap, the gap, the record lap, the speed, laps to go, the distance, the Swap Signal and Swap Timer, the current and next driver, fuel, tyres, damage, the pitstop time, penalty points, the flag, the start lights, the points and the list of laps.</li>
          <li>A cell the race has nothing for (no driver swaps, no fuel) is left blank, and a row with nothing in it is left out, so a phone does not waste room.</li>
          <li>The grid you set on the computer is the <b>default for every device</b>. A phone that changes it keeps its own grid, and <b>Use the computer's layout again</b> gives it the computer's back.</li>
          <li>A phone also <b>remembers its lane</b>. Switch that off in Customize, under Remember my lane.</li>
        </ul>` },
      { id: 'network', title: 'Phones and tablets', note: 'Watch and control from the wifi', body: `
        <ul>
          <li>In <b>App Settings, Network</b>, tick <b>Share on my network</b>. An address and a QR code appear; scan the code with a phone or tablet on the same wifi.</li>
          <li>The browser shows the Live Race pages. It can only watch, apart from the Race Director and Tokens pages.</li>
          <li>Those two need the <b>password</b> you type in the same place. With no password they stay closed to other devices.</li>
          <li>The first time, Windows may ask whether the app may use the network: allow it on private networks. On a Mac the question is whether the app may accept incoming network connections: choose Allow.</li>
        </ul>` },
      { id: 'hardware', title: 'Timing hardware', note: 'Trackmate, Arduino, Parallel Port, DS Electronics, oXigen Digital or no hardware', body: `
        <ul>
          <li>App Settings, <b>Timing Hardware</b>: at the top you choose the <b>Timing hardware in use</b>: <b>None</b> (keys or simulated cars), the <b>Trackmate Interface</b>, the <b>Arduino box</b> or <b>Parallel Port</b>. One at a time: only the one in use connects by itself, counts the laps of a race and is shown on Home and on the race screen (green when it is connected, red when it is not). If you press Start race while it is not connected, the app asks whether to start anyway. Ticking <b>Use the virtual box</b> makes the Arduino box the one in use.</li>
          <li>Below that, Timing Hardware has a page per kind of hardware. On <b>Trackmate Interface</b> you connect the box by USB and check the sensors; the check lights show which sensor is seen. You choose which lane each sensor counts for.</li>
          <li>The Trackmate can also switch the <b>track power</b> (relay) and has a <b>Trackcall</b> button. What they do is set in the race setup.</li>
          <li>The <b>Arduino</b> page is for a box you build yourself (next folder). <b>DS Electronics</b> is a listening version for now. <b>oXigen Digital</b> is a place held for it: there is nothing to set up there yet.</li>
          <li>The Monitor shows what the box sends, which helps when something does not count.</li>
          <li>No hardware? Use the number keys, or <b>Simulated cars</b>.</li>
        </ul>` },
      { id: 'arduino', title: 'The Arduino box', note: 'Build your own timing box with an Arduino', body: `
        <ul>
          <li>The <b>SlotForge box</b> is an Arduino (Nano or Mega) with the SlotForge sketch: lane sensors, pit sensors, start lights, track power relays, a buzzer and two buttons. It is one of the choices for the timing hardware in use (Trackmate, Arduino box, Parallel Port or None): one at a time.</li>
          <li>App Settings, Timing Hardware, <b>Arduino</b>. Open <b>Firmware and sketch</b>, <b>Download the Arduino sketch</b>, upload it with the Arduino IDE, then <b>Find the box</b> (the COM port) and <b>Connect</b>. No box yet? Tick <b>Use the virtual box</b>: four imaginary cars to try everything.</li>
          <li>Wire the sensors, press <b>Calibrate</b> with the track empty, then <b>Save to the box</b>. Pins that are not wired must be set to Not used, also the lanes a 2- or 3-lane track does not have.</li>
          <li><b>Test the lights</b>, <b>Power on</b>, <b>Power off</b> and <b>Beep</b> check the wiring.</li>
          <li>In a race the start lights, the flags and the track power follow the race. The rest is set in the race setup, folder <b>SlotForge box (Arduino)</b>.</li>
          <li>Without a word from the app for 3 seconds the box cuts the track power by itself (you can change that). Two cars less than 0.3 seconds apart on one lane count as one lap.</li>
          <li>The box is new: so far it has only been tried with the virtual box and in a computer simulation.</li>
        </ul>` },
      { id: 'arduinoracelock', title: 'Arduino during a race', note: 'Race ownership, diagnostics and emergency power off', body: `<ul>
          <li>While a race is open, configuration and output tests are locked, including calibration and lane mapping. Finish or leave the race before changing them. Opening a race cancels a running light test.</li>
          <li><b>Power off</b> remains available. It cancels a countdown or stops a running race under red, without resuming an existing red flag. Restart manually from the race screen.</li>
          <li>The monitor and logs remain available. If the connection is lost, you can reconnect the same remembered box without changing its configuration.</li>
        </ul>` },
      { id: 'interfacepages', title: 'Arduino and DS interface pages', note: 'Side rails, settings folders and capture logs', body: `<ul>
          <li>The side rail opens the matching folder. Open folders stay open while connection or pin information refreshes. On a narrow screen, the rail becomes a compact row of section buttons.</li>
          <li>Arduino separates <b>Connection</b>, <b>Pins and calibration</b>, <b>Lane sensors</b> and <b>Live monitor</b>. Optional folders contain <b>Start lights</b>, <b>Track power</b>, <b>Buttons and buzzer</b> and <b>Firmware and sketch</b>.</li>
          <li>App preferences and lane mapping save automatically. Pin, threshold and output changes go to the connected Arduino; <b>Save to the box</b> stores them for the next power-on.</li>
          <li>DS Electronics is <b>capture only</b>. Choose its model and COM port, then check <b>Serial settings</b>. Disconnect before changing baud, parity, data or stop bits. DTR and RTS control the serial signal lines.</li>
          <li><b>How to make a capture</b> walks through the checks. In <b>Live capture</b>, add notes before sensor passes or button presses, then <b>Save log</b>. No DS lap timing or race control is available yet.</li>
        </ul>` },
      { id: 'parallel', title: 'Parallel Port', note: 'Windows LPT sensors, pits, track call, relays and lights', body: `
        <ul>
          <li>App Settings, Timing Hardware, <b>Parallel Port</b>. Choose the port address, lane pins and active signal. <b>Save settings</b>, then <b>Connect</b>. The timing hardware in use decides which interface counts race laps.</li>
          <li>Windows needs a native LPT port or compatible expansion card and an already installed, running InpOut driver. A USB printer cable does not provide these pins. SlotForge never installs or starts a driver.</li>
          <li>Check every lane in <b>Live monitor</b>. Calibrate with the sensors clear. Pins 10, 11, 12, 13 and 15 are inputs. Extra control-pin inputs need compatible hardware and a sensor check.</li>
          <li>Optional sections set shared or separate pit sensors, track call, outputs and filters. Shared pits use the race setup's pit hold time; minimum lap time also stays in the race setup.</li>
          <li>Output tests need deliberate enabling and last up to 1.5 seconds. Settings and tests are locked while a race is open. Disconnect pauses racing. Reconnect with saved settings, then resume manually; power stays off until resume. Output shutdown is best effort.</li>
          <li>The monitor shows measured polling gaps. <b>Save log</b> exports diagnostics. Physical hardware validation is still pending.</li>
        </ul>` },
      { id: 'phidget', title: 'Phidget Interface', note: 'USB sensors, pit detection and relay outputs', body: `
        <ul>
          <li>App Settings, Timing Hardware, <b>Phidget</b>. Windows 64-bit only for now. Install the official 64-bit <b>Phidget22</b> libraries, connect by USB, and close Control Panel channel tests before connecting SlotForge.</li>
          <li><b>Scan USB devices</b>, assign channels by serial number, then <b>Save settings</b> and <b>Connect</b>. Choose Phidget as the timing hardware in use. Manual entries allow offline setup, not compatibility checks.</li>
          <li>Digital inputs use active/inactive states. Analogue sensors use separate detect and clear thresholds. VINT connections also identify the hub port. At start/resume, covered sensors must clear before a new lap or pit entry.</li>
          <li>Shared or separate pit inputs feed the existing pit rules, including Service Stop and car removal. Track calls follow Race Setup.</li>
          <li>Outputs require suitable relay wiring, inactive at API FALSE. Tests last 1.2 seconds and are locked during races. Hardware failsafes are enabled where supported.</li>
          <li>Disconnect pauses racing and retains its lock. Reconnect, then resume manually. Restored races keep power off until resume. Power-off is best effort if hardware is unreachable. Timestamps are captured on the PC, not on the board. Hardware accuracy remains unverified. <b>Save log</b> exports diagnostics.</li>
        </ul>` },
      { id: 'transfer', title: 'Import, export and backup', note: 'Share items and keep a safe copy', body: `
        <ul>
          <li>App Settings, <b>Import and Export</b>. <b>Export</b> saves ticked items (a track, a layout, a whole group) in a file that another copy of the app can import. What an item depends on can come along.</li>
          <li><b>Import</b> adds copies and never changes what you have. A name you already have gets "(imported)" after it.</li>
          <li>A <b>complete backup</b> is everything in one file: the database, layouts, pictures, sounds, settings and past races. <b>Restore</b> puts the app back exactly as it was.</li>
        </ul>` }
    ]]
  ];

  const folders = () => SECTIONS.reduce((all, [, list]) => all.concat(list), []);
  const folderHtml = f => { const tone = SYSTEM_TONE[f.id] || ''; return `<details class="dbfolder helpfolder" data-help="${f.id}"${tone ? ` data-system="${tone}"` : ''}${opened.has(f.id) ? ' open' : ''}><summary><strong>${f.title}</strong> <span class="muted">${f.note}</span></summary><div class="hf-body">${f.body}</div></details>`; };
  const html = () => '<div class="helppage">' + WELCOME + `<div class="fgtools"><button class="btn" type="button" data-helpall="1">Open all</button><button class="btn" type="button" data-helpall="0">Close all</button></div>`
    + SECTIONS.map(([head, list]) => `<h4 class="helphead">${head}</h4>` + list.map(folderHtml).join('')).join('') + '</div>';

  // draws the Help page into a box and makes the folders and the two buttons work
  function render(box) {
    box.innerHTML = html();
    if (typeof box.querySelectorAll === 'function') box.querySelectorAll('details.helpfolder').forEach(el => { el.ontoggle = () => { if (el.open) opened.add(el.dataset.help); else opened.delete(el.dataset.help); }; });
    box.onclick = e => {
      const b = e.target.closest && e.target.closest('[data-helpall]'); if (!b) return;
      const open = b.dataset.helpall === '1';
      folders().forEach(f => { if (open) opened.add(f.id); else opened.delete(f.id); });
      render(box);
    };
  }

  return { html, render, folders, SECTIONS, WELCOME, opened };
})();
if (typeof module !== 'undefined') module.exports = Help;
