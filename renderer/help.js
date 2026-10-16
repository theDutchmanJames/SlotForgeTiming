// App Settings > Help: a welcome with the first steps, then a folder for every part of the app.
// The text is written here once (SECTIONS); html() draws it and render() makes it work on screen.
// Pure apart from render(), so tests/help.test.js can read all of it without a screen.
const Help = (() => {
  // Folders are closed until the person opens one; what was opened stays open while the app runs.
  const opened = new Set();

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
        <li><b>Set up a race</b> under Race Setup. Give it a name, pick a Session Type and your track, and hit Save.</li>
        <li>Go back to <b>Home</b>, pick your race, choose a driver and a car for every lane and hit <b>Start race</b> (<b>Open the session</b> for a Time Token Session).</li>
      </ol>
      <p>This sets up a basic race. For more in-depth explanations of the possibilities, read the information below.</p>
      <p class="hw-tip"><b>No Trackmate yet?</b> You can still try everything: tick <b>Simulated cars</b> on the race screen, or press the number keys 1 to 8 to count a lap for a lane.</p>
    </div>
  </section>`;

  // [group heading, [folders]]; a folder is { id, title, note, body }
  const SECTIONS = [
    ['Setting things up', [
      { id: 'home', title: 'The Home tab', note: 'Pick a race and start it', body: `
        <ul>
          <li>Pick a <b>race setup</b>, then choose a <b>driver</b> and a <b>car</b> for every lane. In a heat-based race you add participants instead. A lane has the colour its layout gives it on the race screen.</li>
          <li>The start lights under the lanes light up as lanes get ready. What is still missing is listed above the button, so you can see why <b>Start race</b> is greyed out.</li>
          <li>If a <b>qualifying</b> was driven on the same track, its winner picks their lane first.</li>
          <li>The band at the top shows the date and the track, and lights for the <b>Trackmate</b>, sharing on the network and the <b>audio set</b> of the setup. The welcome message and the header picture are changed in App Settings, General.</li>
          <li>On the right: the <b>record to beat</b> on this track (and who on the grid is closest), the <b>last race</b> with its podium and fastest lap, and <b>At a glance</b> (races, laps, distance, most wins). They come from your saved races, not from Time Token Sessions.</li>
          <li>When a race was stopped by a crash or a power cut, a note at the top offers <b>Resume the race</b> (it comes back paused, press Space to go on), <b>Save what was recorded</b> or <b>Delete it</b>.</li>
        </ul>` },
      { id: 'database', title: 'Database', note: 'Tracks, drivers and slot cars', body: `
        <ul>
          <li><b>Tracks</b>: a name and the number of lanes are needed. The rest is optional: scale, surface, a picture and the <b>track length</b>. Type the length in, or let the calculator work it out from the pieces of your track. With a length, the Slotcar Speed widget can show speeds. A <b>lane length modifier</b>, or the length of every lane, gives each lane its own length. A <b>minimum and maximum lap time</b> lets the app ignore crossings that cannot be a real lap.</li>
          <li><b>Drivers</b>: a name, and if you like a nickname, a three-letter callsign, a date of birth, a country flag and an avatar.</li>
          <li><b>Teams</b>: drivers who race together (see Teams, below).</li>
          <li><b>Slotcars</b>: a brand, manufacturer or model, then scale, motor, tyres, gearing, weight, a main picture and more pictures. The laps driven are counted for you.</li>
          <li><b>Extra fields…</b> on every list adds fields of your own (text, number, date or pick-list). They are for your information and never change timing.</li>
          <li>The forms are in folders you can keep closed.</li>
          <li><b>View settings</b> (on every page) opens a small bar where you turn the columns of the list, or the rows of the cards, on and off. It is kept for each page and view.</li>
          <li>Click a <b>row or a card</b> of Slotcars, Tracks or Drivers to see all of it in a window, like a trading card: the main picture, the details and (slotcars) the other pictures, which you can click to see large. Nothing can be changed there; <b>Edit</b> opens the form.</li>
        </ul>` },
      { id: 'results', title: 'Results and Records', note: 'What has been driven', body: `
        <ul>
          <li>Find it in the Database, last sub-tab. <b>Racing Records</b> and <b>Token Records</b> are two separate pools, so a token lap never mixes with a racing lap.</li>
          <li>Three folders: <b>Track records</b> (the fastest lap on each track), <b>Personal bests</b> and <b>Sessions</b> (in Token Records they are called <b>Stints</b>).</li>
          <li>Open a session to see the standings and every lap. Besides the standard columns it shows the average and median lap, consistency, average speed, distance, pit stops and pit time, and penalty points (what the session has).</li>
          <li><b>View settings</b> (after Open all and Close all) turns the columns of the record and session tables on and off. <b>Export to PDF</b> first asks what to include (results, heats, every lap time, and the columns) and then makes a report you can print.</li>
          <li>An invalid lap, or one outside the lap limits of the track, is kept but shown struck through. It never counts for a personal best or a track record.</li>
          <li>A small <b>trophy</b> marks the winner of a race, a timed race or a heat (not in practice or qualifying). A result the Race Director adjusted says so next to the driver's name.</li>
        </ul>` },
      { id: 'setups', title: 'Race Setup', note: 'Race setups, fuel, penalties, balance of power and time tokens', body: `
        <ul>
          <li><b>Race Setups</b> hold the rules of one kind of race: the session type, the track, the length, the start lights, penalties and fuel, the timing page and the audio set. Make as many as you like. Every option has a default and sits in a folder.</li>
          <li><b>Rotation Setups</b>: a heat plan that you make yourself, for a heat-based race (see Rotation setups, below).</li>
          <li><b>Fuel Setups</b>: tank size, fuel per lap and what happens when the tank is empty.</li>
          <li><b>Penalty Systems</b>: how penalty points turn into seconds, when a driver is disqualified, and special penalties such as a Drivethrough or a Stop-and-Go.</li>
          <li><b>Damage Systems</b>: damage points, and the stop in the pits that repairs them (see Damage System, below).</li>
          <li><b>Weather Systems</b>: a spell of rain with a forecast, the tyres to change in the pits, what the wrong tyres cost, and the temperatures and the wind of every weather.</li>
          <li><b>Balance of Power</b>: how much a fast car is hindered and a slow car helped, by hand or by itself.</li>
          <li><b>Time Tokens</b>: the time buttons and the warning for a Time Token Session.</li>
          <li>Fuel setups, penalty systems, damage systems and weather systems do nothing until you choose them in the <b>Rule sets</b> folder of a race setup (Balance of Power and the pit hold time are there too).</li>
        </ul>` },
      { id: 'types', title: 'Session types', note: 'Seven ways to race', body: `
        <ul>
          <li><b>Free practice</b>: no finish. It runs until you stop it and ranks the drivers by their best lap.</li>
          <li><b>Qualifying</b>: a timed session ranked by best lap. Two drivers with the same best lap: the one who set it first ranks higher. Its winner picks their lane first in the next race on the same track.</li>
          <li><b>Race by laps</b>: the first to reach the number of laps wins. The race ends when the lead car finishes, or when every car has finished.</li>
          <li><b>Timed race</b>: the most laps in the time wins.</li>
          <li><b>Heat-based race</b>: several heats, each limited by laps or by time; the overall result adds the heats up. How the heats are planned and counted, and the finals, are explained in Heat races, below.</li>
          <li><b>Endurance Race</b>: a long race for teams, where the drivers of a team swap at the wheel in the pits (see Endurance Race, below).</li>
          <li><b>Time Token Session</b>: not a race. You sell track time per lane (see Time Token Sessions below).</li>
        </ul>` },
      { id: 'heatraces', title: 'Heat races', note: 'How the heats are planned', body: `
        <ul>
          <li><b>How the heats are planned</b> has four choices: you choose the number of heats; <b>every driver races the same number of heats</b> (you say how many); <b>round robin</b>, where every driver meets every other driver (with <i>Same number of heats for everyone</i> on Yes, a few heats are added so nobody races less than the busiest driver); or <b>lane rotation</b>, where every driver races once in every lane. In every plan the lanes are shared as evenly as possible.</li>
          <li>To make the plan yourself, choose a <b>Rotation setup</b> in the race setup. Then the settings that plan the heats are not used.</li>
          <li><b>Who races together</b> can use the latest qualifying on the track: the fastest drivers together (the best heat last), or every heat with fast and slow drivers mixed.</li>
        </ul>` },
      { id: 'heatplan', title: 'Heat plan and break', note: 'See, change and time the heats', body: `
        <ul>
          <li>On the Home tab a <b>Heat plan</b> shows the heats by lane, how often every driver races and in which lane; <b>Shuffle again</b> makes another plan, and the plan you see is the plan that is raced. To change the plan yourself, click a place and then another place: the two swap (a place with a dash is empty, so a driver can move there). A driver can not race twice in a heat. <b>Reset my changes</b> brings back the plan that was made; changing the number of participants or the heat settings makes a new plan.</li>
          <li>On the Race tab the <b>Heat list</b> shows every heat with its drivers by lane, the heat that is racing or next, and for a finished heat its winner and the points, laps or times. The <b>Heat List</b> widget shows it on the Live Race page. <b>Print the heat list</b> (also on Home) makes a PDF sheet. The audio call <b>line-up</b> reads the drivers of the next heat.</li>
          <li><b>Break between heats</b>: with a number of seconds, the race counts down after each heat (the Race Info widget and the Live Race page show "next heat in 1:30"). <b>When the break is over</b> either waits for Start or lets the start lights begin by themselves; Start (Space) always starts the next heat at once, and Stop ends the race.</li>
        </ul>` },
      { id: 'rotation', title: 'Rotation setups', note: 'Make your own heat schedule', body: `
        <ul>
          <li>Under <b>Race Setup</b>, on the <b>Rotation Setups</b> tab, you make a heat schedule by hand: set the <b>Size</b> (how many <b>participants</b> and <b>lanes</b>), then <b>drag</b> a participant onto a place (heat and lane), or click a participant and then a place. Drag a place onto another, or click two places, to swap them; drag a place back onto the participants to empty it, and a heat by its grip to move it. Each participant has a colour. Pick a participant to give it a name. 20 racers on 4 lanes: 5 heats, or 10 so that everybody races twice.</li>
          <li><b>Groups</b> put some participants in a heat at once. <b>Lock</b> keeps a heat where it is when you shuffle; the <b>⋯</b> button of a heat copies, empties or deletes it. The <b>Tools</b> menu has <b>Shuffle the heat order</b>, <b>Shuffle the lanes</b> and <b>Even out the lanes</b>, and <b>Start from a plan</b> (four plans) fills the heats for you. A warning can come with a button, such as one that adds a heat for participants who race none. Undo and Redo (Ctrl+Z, Ctrl+Y) take a change back.</li>
          <li>Choose the rotation in a race setup (<b>Rotation setup</b>, in Length and result). On the Home tab the participants are the rows (drivers, or teams when you set <b>Participants are</b> to Teams). Tick <b>Not here today</b> for anybody who does not come: the others stay in their places and an empty heat is left out. The track needs as many lanes as the rotation uses. <b>Pick the drivers by name</b> uses the rotation's names.</li>
          <li>Finals and the break work as in every heat race.</li>
        </ul>` },
      { id: 'teams', title: 'Teams', note: 'Drivers who race together', body: `
        <ul>
          <li>On the <b>Teams</b> page of the Database you make a team: a name, a picture and its drivers, in the order they take their turn. A driver can be in more than one team. A driver who is deleted leaves his teams.</li>
          <li>On the <b>Home tab</b> a session with teams (an Endurance Race, or heats whose participants are teams) has a <b>Team</b> on every lane; the driver is then one of the team. A session without teams has no Team choice. The <b>Team Name</b> and <b>Team Picture</b> widgets show the team of the lane (or one team you choose), {team} works in custom texts and audio calls, and the results get a Team column.</li>
          <li>The participants of a heat race can be <b>teams</b>: choose Teams in the race setup (<b>The participants of the heats are</b>) or in the rotation setup (<b>Participants are</b>, which wins). On Home you choose a team and a car for each. In every heat one driver of the team drives: <b>in turn</b>, <b>by lot</b>, or the one you choose before the heat.</li>
          <li>A driver who is in two teams drives for one of them in a heat. The result has a row per team with the drivers who drove for it; every lap still counts for the driver who drove it.</li>
        </ul>` },
      { id: 'endurance', title: 'Endurance Race', note: 'Teams that swap drivers in the pits', body: `
        <ul>
          <li>Choose the session type <b>Endurance Race</b>. A team shares one car, and its drivers take turns. Give every lane a <b>Team</b> on Home. The race runs by time, by laps, or heat by heat (<b>The Endurance Race is</b>).</li>
          <li>The folder <b>Endurance: driver swaps</b> of the race setup says when a swap is due: <b>every so often</b>, <b>at fixed moments</b> (30 minutes, 2 hours), or <b>free</b> within the shortest and longest stint. All times are in minutes or in laps. You can also set the least and the most a driver drives in the whole race.</li>
          <li>The swap is made when the car stops on the pit sensor (like a Stop-and-Go), or when <b>Swap done</b> is pressed on the Race Director page or a phone. The driver who steps in is the next one in the team's order, chosen at each swap, or picked by lot.</li>
          <li>When the swap is late, the laps keep counting or stop counting, and the team can get penalty points (they need a penalty system), again and again if you like.</li>
          <li>The widgets <b>Current Driver</b>, <b>Next Driver</b> and <b>Swap Timer</b> (amber before the swap is due, red when it is late) show it on the timing page. The audio folder <b>Endurance</b> says "{team} needs to swap positions! Box Box!" and who came in and who took over.</li>
          <li>The results show every driver's time at the wheel and stints. A race in one go that a crash or a power cut stops can be continued from the Home tab.</li>
        </ul>` },
      { id: 'damage', title: 'Damage System', note: 'Damage points, and the stop in the pits that repairs them', body: `
        <ul>
          <li>A damage system (Race Setup, <b>Damage Systems</b>) gives cars <b>damage points</b>. Every <b>level</b> (Light damage from 3 points, Medium from 6...) says how long the car must stand still on the pit sensor to be repaired, whether it should pit <b>whenever it can</b> or <b>as fast as it can</b>, and can have a deadline in laps. The highest level reached counts. Choose it in the race setup (<b>Damage system</b>); it works in a race and a timed race.</li>
          <li>Points come from <b>incidents</b> (Contact +2, Hard crash +4: buttons on the race screen, the Race Director page and phones, and -1 to take a point back) and from a <b>deslot</b>: fill in the <b>Deslot time</b> of the track (Tracks, Lap time limits) and every slower lap gives the points of the system.</li>
          <li>After the stop the damage is gone. The repair can run <b>at the same time</b> as refuelling and a driver swap, or <b>after</b> them. A car that leaves too early keeps its damage; with a penalty system that, and a lap after the deadline, cost penalty points.</li>
          <li>A level can <b>retire</b> or <b>disqualify</b> the car when it stops in the pits; its laps count until then. A slot car with a <b>Damage factor</b> above 1 takes more damage.</li>
          <li>The widgets <b>Damage</b> and <b>Repair Timer</b>, {damage} in texts, and the audio folder <b>Damage</b> show and say it. The results list the points, repairs and time in the pits.</li>
        </ul>` },
      { id: 'heatresults', title: 'Heat results', note: 'How the heats add up', body: `
        <ul>
          <li><b>How the heats are added up</b> can be all heats, the <b>average per heat</b> (fair when drivers race a different number of heats) or <b>only the best heats</b> of every driver. <b>Drop the worst heat</b> takes away each driver's worst heat. With points you can give <b>bonus points for the fastest lap</b> of a heat. <b>A tie is decided by</b> chooses between the other measure, the fastest lap, the most heat wins and the lowest total time.</li>
          <li><b>Total race time</b> (for heats limited by laps) adds up each driver's finish times; the lowest total wins. A driver who did not finish a heat ranks below those who did, by laps, or, with <b>A heat that is not finished</b> on estimate, gets a finish time worked out from their own average lap.</li>
          <li>When something other than the standard is chosen, the race screen, the saved results and the PDF report say how the result was counted and show a <b>Result</b> column.</li>
        </ul>` },
      { id: 'heatfinals', title: 'Finals', note: 'A final A and a final B after the heats', body: `
        <ul>
          <li><b>Finals after the heats</b>: none, a final A, or a final B and a final A. The best drivers of the heat result race the final A, with as many drivers as the track has lanes. The final B is the next group (when at least two drivers are left) and races first. A final has its own length in laps or minutes (0 is as long as a heat).</li>
          <li><b>What the finals decide</b>: the final places (the heat result only decides who races in which final), or the result of the final is <b>added to the heat result</b>. It is not averaged or dropped. Either way the A final drivers stay above the B final drivers.</li>
          <li><b>Before a final</b> the race screen asks the drivers to choose their lanes, the best-placed driver first. The last driver gets the last free lane. <b>Pick the rest at random</b> and <b>Clear choices</b> help. The final does not start, also not by itself after a break, before every lane is chosen.</li>
          <li>The audio sets have two more calls, <b>next final</b> and <b>final finished</b>, and a <b>{final}</b> word.</li>
        </ul>` }
    ]],
    ['Racing', [
      { id: 'start', title: 'Starting a race', note: 'Lights, flags and the first lap', body: `
        <ul>
          <li>Press <b>Space</b> (or Start). The five start lights come on one by one, wait a random time between the shortest and longest you set, and go out. The race starts.</li>
          <li>After the start the lights can go out, or follow the race flag: green while racing, yellow after a yellow flag, red after a red flag.</li>
          <li>After a red flag the lights can count down again, or the race can go on at once.</li>
          <li>The first crossing of the start line can only start the timing, so the short lap from the grid is not counted. Or it can count as a lap.</li>
          <li>With a Trackmate you also choose whether the track power is on during the countdown, or comes on as the lights go out.</li>
        </ul>` },
      { id: 'screen', title: 'The race screen', note: 'Keys, buttons and the end of a race', body: `
        <ul>
          <li>The race screen shows the timing page of the race setup (a second layout can go on a second screen). <b>Simulated cars</b> races without hardware.</li>
          <li>Keys: <b>Space</b> starts, pauses and resumes. <b>Y</b> yellow flag, <b>R</b> red flag, <b>S</b> stop (it asks once). <b>1 to 8</b> count a lap for that lane without hardware, <b>Shift + 1 to 8</b> send it into the pit, <b>Ctrl + 1 to 8</b> make a call from it.</li>
          <li><b>Full screen widgets</b> (or <b>F</b>) shows only the widgets, as large as the window allows. <b>Esc</b>, <b>F</b> or the <b>Exit full screen</b> button goes back. The race keeps running.</li>
          <li>A race keeps running when you open another tab. A <b>Race</b> tab with a green dot takes you back to it. The keys above only work on the Race tab. Only one race can run at a time.</li>
          <li><b>Review laps</b> marks a lap invalid or deletes it during the race.</li>
          <li>Below are the coloured folders of the Race Director page: <b>Track actions</b> (green: a card for each lane with big <b>Lap</b> (counts a lap by hand, while the race runs), <b>Pit</b> and <b>Call</b> buttons), <b>Adjust</b> (pads for penalty points, damage points, time, laps and championship points), <b>Penalties</b>, <b>Balance of Power</b>, <b>Damage</b>, <b>Weather</b> and <b>Endurance</b>, when the race uses them.</li>
          <li>When a race (or a heat) ends, a <b>review</b> opens before anything is saved: check the order, clear penalty points, disqualify or reinstate, correct laps, or <b>Adjust</b> the race time, the laps and (in a heat race decided on points) the championship points of a driver. <b>Finalize results</b> saves them.</li>
        </ul>` },
      { id: 'director', title: 'Race Director, flags and penalties', note: 'Control the race from anywhere', body: `
        <ul>
          <li>The <b>Race Director</b> page (Live Race tab) has Start, Pause, Yellow, Red and Stop, the calls and folders. It also works on a phone or tablet, behind a password.</li>
          <li><b>Adjust</b>: pick a lane, then press the pads, <b>[+] value [−]</b>: penalty points, damage points, time, laps, championship points, also during the race. Undo takes the last one back. Values and layout: App Settings, Race Director.</li>
          <li><b>Penalty points</b> turn into seconds added to the driver's time (the penalty system sets how, and can disqualify at a limit).</li>
          <li><b>Special penalties</b> take points off and must be served: a Drivethrough when the next pit stop starts, a Stop-and-Go by standing still on the sensor.</li>
          <li>A <b>call from a lane</b> raises the yellow flag and waits for the Race Director, who dismisses it or gives a penalty point.</li>
          <li><b>Yellow flag target lap time</b> (race setup, Yellow flag group): while the flag is up the race says the target. A full lap under yellow that is faster is called out, marked in the lap review and costs the penalty points you set (a penalty system is needed).</li>
          <li>The Trackmate <b>Trackcall</b> button can raise the flags and switch the track power. You choose how in the race setup.</li>
        </ul>` },
      { id: 'fuel', title: 'Fuel and pit stops', note: 'Tanks, refuelling and pit time', body: `
        <ul>
          <li>Choose a <b>fuel setup</b> in the race setup. A car that runs dry retires, stops counting laps until it has refuelled, or only gets a warning, as you decided. A lap driven on an empty tank can also cost penalty points.</li>
          <li>A fast lap uses a little more fuel and a slow lap saves some, within the limits you set.</li>
          <li>A <b>pit stop</b> starts when a car stays on the sensor for the hold time of the race setup (2 seconds by default). The tank fills while it stands there. Fuel is optional: pit stops work without it.</li>
          <li>The <b>Fuel</b> and <b>Pitstop time</b> widgets show it on the timing page, and the leaderboard has a Fuel left column.</li>
        </ul>` },
      { id: 'bop', title: 'Balance of Power', note: 'Even out fast and slow cars', body: `
        <ul>
          <li><b>Balance of Power</b> (BoP) hinders a car that is too fast and helps a car that is too slow. It works through the fuel rules, so the race setup needs a <b>fuel setup</b> and Balance of Power set to On (races, timed races and heat races).</li>
          <li>A car hindered by 20% uses 20% more fuel a lap and refuels 20% slower (and, if you choose, has a 20% smaller tank), so it pits sooner or has to drive slower. A helped car gets the opposite. It counts from the next lap and the next pit stop.</li>
          <li>Set it up under Race Setup, <b>Balance of Power</b>: the percentage (a slider), only the fastest and slowest car or every car by its distance from the middle, and which of the three effects are on. It fine-tunes: a car that is seconds a lap faster will not be caught by fuel alone.</li>
          <li><b>Manual</b>: the Race Director presses Hinder, Help or Off for a lane. <b>Suggest</b>: the app proposes and he presses Accept. <b>Automatic</b>: the app applies it at the lap time difference you set and removes it a little below that. A lane you press stays as you set it until you press Auto.</li>
          <li>The race screen and the Race Director page have the lane buttons. The <b>Balance of Power</b> widget shows it per lane, and the audio set can say it comes on and goes off. The result says what it did, for example hindered 20% (from the start to lap 12).</li>
        </ul>` },
      { id: 'weather', title: 'Weather', note: 'Rain, tyres and pit stops', body: `
        <ul>
          <li>A <b>weather system</b> (Race Setup, Weather Systems) is a spell of rain: it starts after some laps of the leader or minutes, at a random moment, or when the Race Director says so, and lasts as long as you set. Choose one in a race setup (races, timed races and heats).</li>
          <li>The weather goes <b>Dry</b>, <b>Cloudy</b> (the warning), <b>Wet</b>, <b>Clearing</b> and Dry again. The race screen and the Race Director page show it and what comes next; the Race Director can press the four weather buttons there.</li>
          <li>Cars change tyres <b>in a pit stop</b>, from the <b>Tyre choice</b> of their slot car (Database, Slotcars) to Wet (or Intermediate) in Cloudy and Wet, and back in Clearing and Dry.</li>
          <li>When it rains a car on dry tyres has to pit within the laps you set, and when it is dry again a car on Wet tyres has to. Otherwise it gets <b>penalty points</b> (needs a penalty system) and can be <b>hindered</b> like with Balance of Power (needs a fuel setup). Both add up, to 90% at most.</li>
          <li>The result says what the weather and the tyres did. The audio set has calls for it, and simulated cars change tyres too.</li>
        </ul>` },
      { id: 'wxwidgets', title: 'Weather widgets', note: 'Tyres, forecast and conditions on the timing page', body: `
        <ul>
          <li>Every weather has its <b>conditions</b>: track temperature, air temperature, wind speed and the direction the wind comes from (Weather Systems, folder Track conditions; Celsius and km/h, or Fahrenheit and mph). They change when the weather does. The audio says them at lights out and after every change, and custom text has them as {variables}.</li>
          <li>In the Layout Editor, folder <b>Weather</b>: <b>Tyres</b> (the tyre of a lane's car; amber with "Change tyres" when it has to change), <b>Weather Forecast</b> (the weather now and what comes next, "Rain in 3 laps") and <b>Track Conditions</b> (temperatures, wind speed and an arrow for the wind).</li>
          <li>They are drawn, or you make <b>picture sets</b> for them in Image Settings (Tyres, Weather, Track conditions). Track Conditions can show your own numbers instead of those of a weather system.</li>
        </ul>` },
      { id: 'tokens', title: 'Time Token Sessions', note: 'Selling track time per lane', body: `
        <ul>
          <li>Choose the session type <b>Time Token Session</b> in a race setup. It has no start lights, laps, fuel or penalties. On Home the button says <b>Open the session</b>. Drivers and cars are optional: a lane without a driver is a Guest.</li>
          <li>Every lane starts switched off. Press a time button on a lane (the buttons are set under Race Setup, Time Tokens) and the lane is on while the <b>Token Clock</b> counts down. The minus buttons take time off again.</li>
          <li>The clock turns amber in the last minute (you can change that) and everything of that lane turns <b>red</b> when the time is up.</li>
          <li>A lap driven after the time was up is kept but never counts for a record.</li>
          <li><b>Undo</b>, <b>End time now</b> and <b>Clear</b> correct a lane. Choose another driver in a lane's list when the next person takes over.</li>
          <li>The <b>Tokens</b> tile on the Live Race tab adds time from a phone or tablet, behind the password.</li>
          <li>Stopping the session opens a review. <b>Finalize</b> saves every stint, <b>Delete all data</b> throws them away.</li>
        </ul>` }
    ]],
    ['Making it yours', [
      { id: 'custom', title: 'Customization', note: 'Layouts, audio, pictures and your own widgets', body: `
        <ul>
          <li><b>Layout Editor</b>: design a timing page by placing widgets (lap times, the leaderboard, start lights, the race flag, Race Laps counting up or down, fuel, speed and many more). Drag, resize, undo and redo. Make a different layout for the second screen.</li>
          <li><b>Leaderboard Editor</b>: design the rows of the Leaderboard widget, also side by side in the grid of the Leaderboard page.</li>
          <li><b>Audio Settings</b>: what the race says (see Audio calls below).</li>
          <li><b>Image Settings</b>: picture sets for the start lights, the race flag, the fuel level, the avatars, the tyres, the weather and the track conditions (what you leave empty is drawn). A start lights set is a grid: a picture for every light and every state of the race, such as the yellow flag. An <b>Avatars</b> set has a picture for each of the 8 lanes: the Avatar widget shows the picture of the driver, and a driver without one gets the avatar of the lane he or she drives in (the built-in standard avatars, unless you choose a set). Choose a set in the widget in the Layout Editor. The Race Flag widget can mirror the pictures of a set, and the Avatar widget can mirror its pictures.</li>
          <li>Every widget can align its <b>title</b> and its <b>text</b> to the left, the center or the right (the Leaderboard only its title).</li>
          <li><b>Widget Builder</b>: make your own text or image widgets with {variables} such as the driver's name or a lap time.</li>
          <li>You choose the layouts and the audio set per race setup.</li>
        </ul>` },
      { id: 'delta', title: 'Delta Timers', note: 'How far a lane is from another time', body: `
        <ul>
          <li>A folder of widgets in the Layout Editor: a time on the left and a badge on the right that shows how far a lane is from another time. Green with ▲ and a minus (▲ −0.045) is faster, red with ▼ and a plus (▼ +0.321) is slower. <b>Value and badge</b> can put them <b>top and bottom</b> instead: the time on top, the badge below it.</li>
          <li><b>What is compared</b>: a lane's value against theirs, its last lap against theirs, or its last lap against its own value. <b>Compare with</b>: a chosen lane, the leader, the fastest in the race, the track record or the session record.</li>
          <li><b>Left (or top) value shows</b>: this lane's own value (the standard), or the value it is compared with, for example lane 2's time. The badge always says how far this lane is from it.</li>
          <li>The look: a solid block or only an outline, the size of the whole badge, the thickness of the outline, bold and italic text, the arrow, the number of decimals and the three colours.</li>
          <li>The Session Record and Track Record deltas always compare with that record, and show it on the left.</li>
        </ul>` },
      { id: 'audio', title: 'Audio calls', note: 'A voice for the race', body: `
        <ul>
          <li>An <b>audio set</b> (Customization, Audio Settings) says what the race announces. The calls are in folders; switch each one on or off. Some calls start off.</li>
          <li><b>Race progress</b>: laps or minutes to go, the last lap, the heats. <b>Gaps and battles</b>, <b>Laps and records</b>, <b>Pit and fuel</b>, <b>Penalties</b>, <b>Safety</b> (a marshal call, no lap for a while, the Trackmate lost) and <b>Time tokens</b> have calls too. <b>Weather</b>: weather, conditions, tyres. <b>Endurance</b>: driver swaps. <b>Damage</b>: a hit, a repair, out.</li>
          <li>A call can have <b>several sentences</b>; one is picked at random each time. Use placeholders such as {driver}, {team}, {time}, {gap}, {gapahead}, {record} and {position}; the list is at the top. Press Test to hear it.</li>
          <li>A sentence can be spoken by a <b>voice of your computer</b>, or you can choose a <b>sound file</b> (up to 10 MB) that plays instead. Drivers can be called by name, nickname or callsign. A voice is missing? <b>Voice report</b> next to the voice shows what your computer offers the app; copy it to send it. The Natural voices of Narrator (such as Andrew HD) are, as far as we know, not offered to other apps.</li>
          <li>Under a sentence, <b>Only if</b> limits it to one driver, the top places, a fast lap or a small gap; a sentence whose conditions hold is said instead of the others. <b>Not again within</b> holds a call back for some seconds.</li>
          <li>Pick the set in the race setup. <b>No audio</b> keeps the race silent. Sound plays on the computer that runs the race, not on phones.</li>
        </ul>` },
      { id: 'look', title: 'Look and feel', note: 'Themes, name, header picture and logo', body: `
        <ul>
          <li><b>App Theme</b>: choose a ready-made colour theme, or make your own colours.</li>
          <li><b>General</b>: type your own app name and welcome message, add a header picture to the Home tab (and choose which part of it shows), and add your club logo. <b>Display</b> makes the whole app bigger (100% to 200%) for reading from a distance; it does not change the widgets of your layouts. <b>Pictures</b> sets how sharp the pictures you upload stay: Original (as uploaded, with transparency), High or Standard (smaller, for a lighter database).</li>
          <li><b>Racing Rules</b> is a tab of its own. Write the rules of your club there. They show on the Racing rules tile of the Live Race tab, also on phones.</li>
        </ul>` }
    ]],
    ['Connecting and sharing', [
      { id: 'live', title: 'Live Race', note: 'Follow the race on another screen', body: `
        <ul>
          <li>The Live Race tab has a tile per page: <b>Race timing</b>, <b>Leaderboard</b>, <b>Driver stats</b>, <b>Database</b> (read only), <b>Racing rules</b>, and the control pages <b>Race Director</b> and <b>Tokens</b>.</li>
          <li><b>Open on a second screen</b> puts these pages in their own window, for a TV or a projector. <b>Full screen</b> fills it.</li>
          <li>The <b>Race timing</b> page shows only the widget layout, without race buttons. Move the mouse or touch the screen to bring back the bar with the page choice and the full screen button.</li>
          <li>The pages follow the race that is running. They fill in as soon as a race starts.</li>
          <li>The <b>Leaderboard</b> page is a grid: under <b>Customize</b> pick the number of columns and rows with the little squares, and choose a leaderboard for every cell (a row design from the Leaderboard Editor, or the classic table). A board can cover more cells and show only some places, such as 5 to 8.</li>
          <li>The <b>Live Race</b> button in the top bar has its red light on while a race is on, and is greyed out with the light off when no race is running. It opens the pages either way.</li>
          <li>The Race Director and Tokens pages are the only ones that change anything, so they have their own look. On the Race Director page the Calls come first, then coloured folders: Adjust, Penalties, Balance of Power, Damage and Weather, and Endurance (brown) in an Endurance Race.</li>
        </ul>` },
      { id: 'network', title: 'Phones and tablets', note: 'Watch and control from the wifi', body: `
        <ul>
          <li>In <b>App Settings, Network</b>, tick <b>Share on my network</b>. An address and a QR code appear; scan the code with a phone or tablet on the same wifi.</li>
          <li>The browser shows the Live Race pages. It can only watch, apart from the Race Director and Tokens pages.</li>
          <li>Those two need the <b>password</b> you type in the same place. With no password they stay closed to other devices.</li>
          <li>The first time, Windows may ask whether the app may use the network: allow it on private networks. On a Mac the question is whether the app may accept incoming network connections: choose Allow.</li>
        </ul>` },
      { id: 'hardware', title: 'Timing hardware', note: 'Trackmate, DS Electronics or no hardware', body: `
        <ul>
          <li>App Settings, <b>Timing Hardware</b> has a page per kind of hardware. On <b>Trackmate Interface</b> you connect the box by USB and check the sensors; the check lights show which sensor is seen. You choose which lane each sensor counts for.</li>
          <li>The Trackmate can also switch the <b>track power</b> (relay) and has a <b>Trackcall</b> button. What they do is set in the race setup.</li>
          <li><b>DS Electronics</b> is a listening version for now.</li>
          <li>The Monitor shows what the box sends, which helps when something does not count.</li>
          <li>No hardware? Use the number keys, or <b>Simulated cars</b>.</li>
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
  const folderHtml = f => `<details class="dbfolder helpfolder" data-help="${f.id}"${opened.has(f.id) ? ' open' : ''}><summary><strong>${f.title}</strong> <span class="muted">${f.note}</span></summary><div class="hf-body">${f.body}</div></details>`;
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
